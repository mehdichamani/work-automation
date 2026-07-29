const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { validateInput, purchase } = require('../middleware/validate');
const { notify: notifyHelper, findSupervisorId: findSupervisorIdHelper, getNextNumber: getNextNumberHelper, addHistory: addHistoryHelper } = require('../utils/helpers');

module.exports = function (db) {
  const router = express.Router();
  router.use(authMiddleware);

  function notify(userId, title, body, link) { notifyHelper(db, userId, title, body, link); }
  function addHistory(id, userId, userName, action, comment) { addHistoryHelper(db, 'purchase_history', 'request_id', id, userId, userName, action, comment); }
  function findSupervisorId(departmentId) { return findSupervisorIdHelper(db, departmentId); }
  function getNextNumber() { return getNextNumberHelper(db, 'purchase_counter', 'خرید'); }

  router.get('/', (req, res) => {
    try {
      const { status, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;
      let where = '';
      const params = [];

      if (req.user.role === 'user') {
        where = 'WHERE p.user_id = ?';
        params.push(req.user.id);
      } else if (req.user.role === 'supervisor') {
        where = "WHERE p.status = 'pending_supervisor'";
      } else if (req.user.role === 'manager') {
        where = "WHERE p.status = 'pending_manager'";
      }

      if (status) {
        where += (where ? ' AND ' : 'WHERE ') + 'p.status = ?';
        params.push(status);
      }

      const total = db.prepare(`SELECT COUNT(*) as count FROM purchase_requests p ${where}`).get(...params).count;
      const requests = db.prepare(`
        SELECT p.*, u.full_name as user_name, d.name as department_name,
               m.full_name as manager_name, s.full_name as supervisor_name
        FROM purchase_requests p
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN departments d ON p.department_id = d.id
        LEFT JOIN users m ON p.manager_id = m.id
        LEFT JOIN users s ON p.supervisor_id = s.id
        ${where}
        ORDER BY p.created_at DESC
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
        SELECT p.*, u.full_name as user_name, d.name as department_name,
               m.full_name as manager_name, s.full_name as supervisor_name
        FROM purchase_requests p
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN departments d ON p.department_id = d.id
        LEFT JOIN users m ON p.manager_id = m.id
        LEFT JOIN users s ON p.supervisor_id = s.id
        WHERE p.user_id = ?
        ORDER BY p.created_at DESC
      `).all(req.user.id);
      res.json(requests);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/:id', (req, res) => {
    try {
      const request = db.prepare(`
        SELECT p.*, u.full_name as user_name, d.name as department_name,
               m.full_name as manager_name, s.full_name as supervisor_name
        FROM purchase_requests p
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN departments d ON p.department_id = d.id
        LEFT JOIN users m ON p.manager_id = m.id
        LEFT JOIN users s ON p.supervisor_id = s.id
        WHERE p.id = ?
      `).get(req.params.id);

      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });

      const history = db.prepare('SELECT * FROM purchase_history WHERE request_id = ? ORDER BY created_at ASC').all(req.params.id);

      res.json({ request, history });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/', validateInput({ description: 1000 }), purchase, (req, res) => {
    try {
      const { items, urgency = 'normal', reason } = req.body;
      if (!items || items.length === 0) {
        return res.status(400).json({ error: 'حداقل یک کالا وارد کنید' });
      }

      const user = db.prepare('SELECT department_id FROM users WHERE id = ?').get(req.user.id);
      const supervisorId = findSupervisorId(user?.department_id);
      const requestNumber = getNextNumber();

      const itemsJson = JSON.stringify(items);

      const result = db.prepare(`
        INSERT INTO purchase_requests (user_id, request_number, items, urgency, reason, department_id, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(req.user.id, requestNumber, itemsJson, urgency, reason || '', user?.department_id, 'pending_supervisor');

      addHistory(result.lastInsertRowid, req.user.id, req.user.full_name, 'ثبت درخواست', null);

      if (supervisorId) {
        notify(supervisorId, 'درخواست خرید جدید', `درخواست شماره ${requestNumber} توسط ${req.user.full_name} ثبت شد`, '/purchase');
      }

      res.json({ id: result.lastInsertRowid, request_number: requestNumber });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/approve', (req, res) => {
    try {
      const { comment } = req.body;
      const request = db.prepare('SELECT * FROM purchase_requests WHERE id = ?').get(req.params.id);
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });

      const now = new Date().toISOString();
      let newStatus = '';
      let historyAction = '';

      if (request.status === 'pending_supervisor') {
        newStatus = 'pending_manager';
        db.prepare('UPDATE purchase_requests SET supervisor_id = ?, supervisor_comment = ?, supervisor_date = ?, status = ? WHERE id = ?')
          .run(req.user.id, comment, now, newStatus, req.params.id);
        historyAction = 'تایید سرپرست';
        const managers = db.prepare("SELECT id FROM users WHERE role = 'manager'").all();
        managers.forEach(mgr => notify(mgr.id, 'درخواست خرید نیاز به تایید', `درخواست شماره ${request.request_number} توسط سرپرست تایید شد`, '/purchase'));
      } else if (request.status === 'pending_manager') {
        newStatus = 'approved';
        db.prepare('UPDATE purchase_requests SET manager_id = ?, manager_comment = ?, manager_date = ?, status = ? WHERE id = ?')
          .run(req.user.id, comment, now, newStatus, req.params.id);
        historyAction = 'تایید مدیر';
      } else {
        return res.status(400).json({ error: 'وضعیت درخواست نامعتبر است' });
      }

      addHistory(req.params.id, req.user.id, req.user.full_name, historyAction, comment);
      notify(request.user_id, 'تایید درخواست خرید', `درخواست شماره ${request.request_number} تایید شد`, '/purchase');

      res.json({ success: true, status: newStatus });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/reject', (req, res) => {
    try {
      const { comment } = req.body;
      const request = db.prepare('SELECT * FROM purchase_requests WHERE id = ?').get(req.params.id);
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });
      if (!comment) return res.status(400).json({ error: 'دلیل رد الزامی است' });

      const now = new Date().toISOString();

      if (request.status === 'pending_supervisor') {
        db.prepare('UPDATE purchase_requests SET supervisor_id = ?, supervisor_comment = ?, supervisor_date = ?, status = ? WHERE id = ?')
          .run(req.user.id, comment, now, 'rejected', req.params.id);
        addHistory(req.params.id, req.user.id, req.user.full_name, 'رد توسط سرپرست', comment);
      } else if (request.status === 'pending_manager') {
        db.prepare('UPDATE purchase_requests SET manager_id = ?, manager_comment = ?, manager_date = ?, status = ? WHERE id = ?')
          .run(req.user.id, comment, now, 'rejected', req.params.id);
        addHistory(req.params.id, req.user.id, req.user.full_name, 'رد توسط مدیر', comment);
      } else {
        return res.status(400).json({ error: 'وضعیت درخواست نامعتبر است' });
      }

      notify(request.user_id, 'رد درخواست خرید', `درخواست شماره ${request.request_number} رد شد. دلیل: ${comment}`, '/purchase');

      res.json({ success: true, status: 'rejected' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id', (req, res) => {
    try {
      const request = db.prepare('SELECT * FROM purchase_requests WHERE id = ?').get(req.params.id);
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });
      if (request.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      if (request.status !== 'pending_supervisor') {
        return res.status(400).json({ error: 'امکان حذف درخواست در این مرحله وجود ندارد' });
      }

      db.prepare('DELETE FROM purchase_history WHERE request_id = ?').run(req.params.id);
      db.prepare('DELETE FROM purchase_requests WHERE id = ?').run(req.params.id);

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
