const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { validateInput, workOrder } = require('../middleware/validate');
const { notify: notifyHelper, findSupervisorId: findSupervisorIdHelper, getNextNumber: getNextNumberHelper, addHistory: addHistoryHelper } = require('../utils/helpers');

module.exports = function (db) {
  const router = express.Router();
  router.use(authMiddleware);

  function notify(userId, title, body, link) { notifyHelper(db, userId, title, body, link); }
  function addHistory(id, userId, userName, action, comment) { addHistoryHelper(db, 'work_order_history', 'request_id', id, userId, userName, action, comment); }
  function findSupervisorId(departmentId) { return findSupervisorIdHelper(db, departmentId); }
  function getNextNumber() { return getNextNumberHelper(db, 'work_order_counter', 'کار'); }

  router.get('/', (req, res) => {
    try {
      const { status, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;
      let where = '';
      const params = [];

      if (req.user.role === 'user') {
        where = 'WHERE w.user_id = ?';
        params.push(req.user.id);
      } else if (req.user.role === 'supervisor') {
        where = "WHERE w.status = 'pending_supervisor'";
      } else if (req.user.role === 'manager') {
        where = "WHERE w.status = 'pending_manager'";
      }

      if (status) {
        where += (where ? ' AND ' : 'WHERE ') + 'w.status = ?';
        params.push(status);
      }

      const total = db.prepare(`SELECT COUNT(*) as count FROM work_orders w ${where}`).get(...params).count;
      const requests = db.prepare(`
        SELECT w.*, u.full_name as user_name, d.name as department_name,
               m.full_name as manager_name, s.full_name as supervisor_name
        FROM work_orders w
        LEFT JOIN users u ON w.user_id = u.id
        LEFT JOIN departments d ON w.department_id = d.id
        LEFT JOIN users m ON w.manager_id = m.id
        LEFT JOIN users s ON w.supervisor_id = s.id
        ${where}
        ORDER BY w.created_at DESC
        LIMIT ? OFFSET ?
      `).all(...params, parseInt(limit), parseInt(offset));

      res.json({ requests, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/my-requests', (req, res) => {
    try {
      const requests = db.prepare(`
        SELECT w.*, u.full_name as user_name, d.name as department_name,
               m.full_name as manager_name, s.full_name as supervisor_name
        FROM work_orders w
        LEFT JOIN users u ON w.user_id = u.id
        LEFT JOIN departments d ON w.department_id = d.id
        LEFT JOIN users m ON w.manager_id = m.id
        LEFT JOIN users s ON w.supervisor_id = s.id
        WHERE w.user_id = ?
        ORDER BY w.created_at DESC
      `).all(req.user.id);
      res.json(requests);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/:id', (req, res) => {
    try {
      const request = db.prepare(`
        SELECT w.*, u.full_name as user_name, d.name as department_name,
               m.full_name as manager_name, s.full_name as supervisor_name
        FROM work_orders w
        LEFT JOIN users u ON w.user_id = u.id
        LEFT JOIN departments d ON w.department_id = d.id
        LEFT JOIN users m ON w.manager_id = m.id
        LEFT JOIN users s ON w.supervisor_id = s.id
        WHERE w.id = ?
      `).get(req.params.id);

      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });

      const history = db.prepare('SELECT * FROM work_order_history WHERE request_id = ? ORDER BY created_at ASC').all(req.params.id);

      res.json({ request, history });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/', validateInput({ title: 200, description: 1000 }), workOrder, (req, res) => {
    try {
      const { title, description, work_type, priority = 'normal', estimated_cost, deadline } = req.body;
      if (!title) {
        return res.status(400).json({ error: 'عنوان کار الزامی است' });
      }

      const user = db.prepare('SELECT department_id FROM users WHERE id = ?').get(req.user.id);
      const supervisorId = findSupervisorId(user?.department_id);
      const requestNumber = getNextNumber();

      const result = db.prepare(`
        INSERT INTO work_orders (user_id, request_number, title, description, work_type, priority, estimated_cost, deadline, department_id, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(req.user.id, requestNumber, title, description || '', work_type || '', priority, estimated_cost || null, deadline || null, user?.department_id, 'pending_supervisor');

      addHistory(result.lastInsertRowid, req.user.id, req.user.full_name, 'ثبت درخواست', null);

      if (supervisorId) {
        notify(supervisorId, 'درخواست کار داخلی جدید', `درخواست شماره ${requestNumber} توسط ${req.user.full_name} ثبت شد`, '/work-order');
      }

      res.json({ id: result.lastInsertRowid, request_number: requestNumber });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/approve', (req, res) => {
    try {
      const { comment } = req.body;
      const request = db.prepare('SELECT * FROM work_orders WHERE id = ?').get(req.params.id);
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });

      const now = new Date().toISOString();
      let newStatus = '';
      let historyAction = '';

      if (request.status === 'pending_supervisor') {
        newStatus = 'pending_manager';
        db.prepare('UPDATE work_orders SET supervisor_id = ?, supervisor_comment = ?, supervisor_date = ?, status = ? WHERE id = ?')
          .run(req.user.id, comment, now, newStatus, req.params.id);
        historyAction = 'تایید سرپرست';
        const managers = db.prepare("SELECT id FROM users WHERE role = 'manager'").all();
        managers.forEach(mgr => notify(mgr.id, 'درخواست کار نیاز به تایید', `درخواست شماره ${request.request_number} توسط سرپرست تایید شد`, '/work-order'));
      } else if (request.status === 'pending_manager') {
        newStatus = 'approved';
        db.prepare('UPDATE work_orders SET manager_id = ?, manager_comment = ?, manager_date = ?, status = ? WHERE id = ?')
          .run(req.user.id, comment, now, newStatus, req.params.id);
        historyAction = 'تایید مدیر';
      } else {
        return res.status(400).json({ error: 'وضعیت درخواست نامعتبر است' });
      }

      addHistory(req.params.id, req.user.id, req.user.full_name, historyAction, comment);
      notify(request.user_id, 'تایید درخواست کار', `درخواست شماره ${request.request_number} تایید شد`, '/work-order');

      res.json({ success: true, status: newStatus });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/reject', (req, res) => {
    try {
      const { comment } = req.body;
      const request = db.prepare('SELECT * FROM work_orders WHERE id = ?').get(req.params.id);
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });
      if (!comment) return res.status(400).json({ error: 'دلیل رد الزامی است' });

      const now = new Date().toISOString();

      if (request.status === 'pending_supervisor') {
        db.prepare('UPDATE work_orders SET supervisor_id = ?, supervisor_comment = ?, supervisor_date = ?, status = ? WHERE id = ?')
          .run(req.user.id, comment, now, 'rejected', req.params.id);
        addHistory(req.params.id, req.user.id, req.user.full_name, 'رد توسط سرپرست', comment);
      } else if (request.status === 'pending_manager') {
        db.prepare('UPDATE work_orders SET manager_id = ?, manager_comment = ?, manager_date = ?, status = ? WHERE id = ?')
          .run(req.user.id, comment, now, 'rejected', req.params.id);
        addHistory(req.params.id, req.user.id, req.user.full_name, 'رد توسط مدیر', comment);
      } else {
        return res.status(400).json({ error: 'وضعیت درخواست نامعتبر است' });
      }

      notify(request.user_id, 'رد درخواست کار', `درخواست شماره ${request.request_number} رد شد`, '/work-order');

      res.json({ success: true, status: 'rejected' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id', (req, res) => {
    try {
      const request = db.prepare('SELECT * FROM work_orders WHERE id = ?').get(req.params.id);
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });
      if (request.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      if (request.status !== 'pending_supervisor') {
        return res.status(400).json({ error: 'امکان حذف درخواست در این مرحله وجود ندارد' });
      }

      db.prepare('DELETE FROM work_order_history WHERE request_id = ?').run(req.params.id);
      db.prepare('DELETE FROM work_orders WHERE id = ?').run(req.params.id);

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
