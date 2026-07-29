const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { validateInput, mission } = require('../middleware/validate');
const { notify: notifyHelper, findSupervisorId: findSupervisorIdHelper, getNextNumber: getNextNumberHelper, addHistory: addHistoryHelper } = require('../utils/helpers');

module.exports = function (db) {
  const router = express.Router();
  router.use(authMiddleware);

  function notify(userId, title, body, link) { notifyHelper(db, userId, title, body, link); }
  function addHistory(id, userId, userName, action, comment) { addHistoryHelper(db, 'mission_history', 'request_id', id, userId, userName, action, comment); }
  function findSupervisorId(departmentId) { return findSupervisorIdHelper(db, departmentId); }
  function getNextNumber() { return getNextNumberHelper(db, 'mission_counter', 'ماموریت'); }

  router.get('/', (req, res) => {
    try {
      const { status, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;
      let where = '';
      const params = [];

      if (req.user.role === 'user') {
        where = 'WHERE m.user_id = ?';
        params.push(req.user.id);
      } else if (req.user.role === 'supervisor') {
        where = "WHERE m.status = 'pending_supervisor'";
      } else if (req.user.role === 'manager') {
        where = "WHERE m.status = 'pending_manager'";
      }

      if (status) {
        where += (where ? ' AND ' : 'WHERE ') + 'm.status = ?';
        params.push(status);
      }

      const total = db.prepare(`SELECT COUNT(*) as count FROM mission_requests m ${where}`).get(...params).count;
      const requests = db.prepare(`
        SELECT m.*, u.full_name as user_name, d.name as department_name,
               m2.full_name as manager_name, s.full_name as supervisor_name
        FROM mission_requests m
        LEFT JOIN users u ON m.user_id = u.id
        LEFT JOIN departments d ON m.department_id = d.id
        LEFT JOIN users m2 ON m.manager_id = m2.id
        LEFT JOIN users s ON m.supervisor_id = s.id
        ${where}
        ORDER BY m.created_at DESC
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
        SELECT m.*, u.full_name as user_name, d.name as department_name,
               m2.full_name as manager_name, s.full_name as supervisor_name
        FROM mission_requests m
        LEFT JOIN users u ON m.user_id = u.id
        LEFT JOIN departments d ON m.department_id = d.id
        LEFT JOIN users m2 ON m.manager_id = m2.id
        LEFT JOIN users s ON m.supervisor_id = s.id
        WHERE m.user_id = ?
        ORDER BY m.created_at DESC
      `).all(req.user.id);
      res.json(requests);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/:id', (req, res) => {
    try {
      const request = db.prepare(`
        SELECT m.*, u.full_name as user_name, d.name as department_name,
               m2.full_name as manager_name, s.full_name as supervisor_name
        FROM mission_requests m
        LEFT JOIN users u ON m.user_id = u.id
        LEFT JOIN departments d ON m.department_id = d.id
        LEFT JOIN users m2 ON m.manager_id = m2.id
        LEFT JOIN users s ON m.supervisor_id = s.id
        WHERE m.id = ?
      `).get(req.params.id);

      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });

      const history = db.prepare('SELECT * FROM mission_history WHERE request_id = ? ORDER BY created_at ASC').all(req.params.id);

      res.json({ request, history });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/', validateInput({ destination: 200, description: 1000 }), mission, (req, res) => {
    try {
      const { mission_date, start_time, end_time, destination, mission_type = 'internal', description, reason } = req.body;
      if (!mission_date || !destination) {
        return res.status(400).json({ error: 'تاریخ و مقصد ماموریت الزامی است' });
      }

      const user = db.prepare('SELECT department_id FROM users WHERE id = ?').get(req.user.id);
      const supervisorId = findSupervisorId(user?.department_id);
      const requestNumber = getNextNumber();

      const result = db.prepare(`
        INSERT INTO mission_requests (user_id, request_number, mission_date, start_time, end_time, destination, mission_type, description, reason, department_id, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(req.user.id, requestNumber, mission_date, start_time || null, end_time || null, destination, mission_type, description || '', reason || '', user?.department_id, 'pending_supervisor');

      addHistory(result.lastInsertRowid, req.user.id, req.user.full_name, 'ثبت درخواست', null);

      if (supervisorId) {
        notify(supervisorId, 'درخواست ماموریت جدید', `درخواست شماره ${requestNumber} توسط ${req.user.full_name} ثبت شد`, '/mission');
      }

      res.json({ id: result.lastInsertRowid, request_number: requestNumber });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/approve', (req, res) => {
    try {
      const { comment } = req.body;
      const request = db.prepare('SELECT * FROM mission_requests WHERE id = ?').get(req.params.id);
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });

      const now = new Date().toISOString();
      let newStatus = '';
      let historyAction = '';

      if (request.status === 'pending_supervisor') {
        newStatus = 'pending_manager';
        db.prepare('UPDATE mission_requests SET supervisor_id = ?, supervisor_comment = ?, supervisor_date = ?, status = ? WHERE id = ?')
          .run(req.user.id, comment, now, newStatus, req.params.id);
        historyAction = 'تایید سرپرست';
        const managers = db.prepare("SELECT id FROM users WHERE role = 'manager'").all();
        managers.forEach(mgr => notify(mgr.id, 'درخواست ماموریت نیاز به تایید', `درخواست شماره ${request.request_number} توسط سرپرست تایید شد`, '/mission'));
      } else if (request.status === 'pending_manager') {
        newStatus = 'approved';
        db.prepare('UPDATE mission_requests SET manager_id = ?, manager_comment = ?, manager_date = ?, status = ? WHERE id = ?')
          .run(req.user.id, comment, now, newStatus, req.params.id);
        historyAction = 'تایید مدیر';
      } else {
        return res.status(400).json({ error: 'وضعیت درخواست نامعتبر است' });
      }

      addHistory(req.params.id, req.user.id, req.user.full_name, historyAction, comment);
      notify(request.user_id, 'تایید درخواست ماموریت', `درخواست شماره ${request.request_number} تایید شد`, '/mission');

      res.json({ success: true, status: newStatus });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/reject', (req, res) => {
    try {
      const { comment } = req.body;
      const request = db.prepare('SELECT * FROM mission_requests WHERE id = ?').get(req.params.id);
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });
      if (!comment) return res.status(400).json({ error: 'دلیل رد الزامی است' });

      const now = new Date().toISOString();

      if (request.status === 'pending_supervisor') {
        db.prepare('UPDATE mission_requests SET supervisor_id = ?, supervisor_comment = ?, supervisor_date = ?, status = ? WHERE id = ?')
          .run(req.user.id, comment, now, 'rejected', req.params.id);
        addHistory(req.params.id, req.user.id, req.user.full_name, 'رد توسط سرپرست', comment);
      } else if (request.status === 'pending_manager') {
        db.prepare('UPDATE mission_requests SET manager_id = ?, manager_comment = ?, manager_date = ?, status = ? WHERE id = ?')
          .run(req.user.id, comment, now, 'rejected', req.params.id);
        addHistory(req.params.id, req.user.id, req.user.full_name, 'رد توسط مدیر', comment);
      } else {
        return res.status(400).json({ error: 'وضعیت درخواست نامعتبر است' });
      }

      notify(request.user_id, 'رد درخواست ماموریت', `درخواست شماره ${request.request_number} رد شد`, '/mission');

      res.json({ success: true, status: 'rejected' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id', (req, res) => {
    try {
      const request = db.prepare('SELECT * FROM mission_requests WHERE id = ?').get(req.params.id);
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });
      if (request.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      if (request.status !== 'pending_supervisor') {
        return res.status(400).json({ error: 'امکان حذف درخواست در این مرحله وجود ندارد' });
      }

      db.prepare('DELETE FROM mission_history WHERE request_id = ?').run(req.params.id);
      db.prepare('DELETE FROM mission_requests WHERE id = ?').run(req.params.id);

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
