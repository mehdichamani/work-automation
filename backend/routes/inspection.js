const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { inspection } = require('../middleware/validate');
const { notify: notifyHelper, findSupervisorId: findSupervisorIdHelper, getNextNumber: getNextNumberHelper, addHistory: addHistoryHelper } = require('../utils/helpers');

module.exports = function (db) {
  const router = express.Router();
  router.use(authMiddleware);

  function notify(userId, title, body, link) { notifyHelper(db, userId, title, body, link); }
  function addHistory(id, userId, userName, action, comment) { addHistoryHelper(db, 'inspection_history', 'request_id', id, userId, userName, action, comment); }
  function findSupervisorId(departmentId) { return findSupervisorIdHelper(db, departmentId); }
  function getNextNumber() { return getNextNumberHelper(db, 'inspection_counter', 'بازرسی'); }

  function getTechnicalUsers() {
    const depts = db.prepare("SELECT id FROM departments WHERE name LIKE '%فنی%'").all();
    if (depts.length === 0) return [];
    const placeholders = depts.map(() => '?').join(',');
    return db.prepare(`SELECT id FROM users WHERE department_id IN (${placeholders}) AND is_active = 1`).all(...depts.map(d => d.id));
  }

  router.get('/', (req, res) => {
    try {
      const { status, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;
      let where = '';
      const params = [];

      if (req.user.role === 'user') {
        where = 'WHERE i.user_id = ?';
        params.push(req.user.id);
      } else if (req.user.role === 'supervisor') {
        where = "WHERE i.status = 'pending_supervisor'";
      } else if (req.user.role === 'manager') {
        where = "WHERE i.status = 'pending_manager'";
      }

      if (status) {
        where += (where ? ' AND ' : 'WHERE ') + 'i.status = ?';
        params.push(status);
      }

      const total = db.prepare(`SELECT COUNT(*) as count FROM inspection_requests i ${where}`).get(...params).count;
      const requests = db.prepare(`
        SELECT i.*, u.full_name as user_name, d.name as department_name,
               m.full_name as manager_name, s.full_name as supervisor_name
        FROM inspection_requests i
        LEFT JOIN users u ON i.user_id = u.id
        LEFT JOIN departments d ON i.department_id = d.id
        LEFT JOIN users m ON i.manager_id = m.id
        LEFT JOIN users s ON i.supervisor_id = s.id
        ${where}
        ORDER BY i.created_at DESC
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
        SELECT i.*, u.full_name as user_name, d.name as department_name,
               m.full_name as manager_name, s.full_name as supervisor_name
        FROM inspection_requests i
        LEFT JOIN users u ON i.user_id = u.id
        LEFT JOIN departments d ON i.department_id = d.id
        LEFT JOIN users m ON i.manager_id = m.id
        LEFT JOIN users s ON i.supervisor_id = s.id
        WHERE i.user_id = ?
        ORDER BY i.created_at DESC
      `).all(req.user.id);
      res.json(requests);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/:id', (req, res) => {
    try {
      const request = db.prepare(`
        SELECT i.*, u.full_name as user_name, d.name as department_name,
               m.full_name as manager_name, s.full_name as supervisor_name
        FROM inspection_requests i
        LEFT JOIN users u ON i.user_id = u.id
        LEFT JOIN departments d ON i.department_id = d.id
        LEFT JOIN users m ON i.manager_id = m.id
        LEFT JOIN users s ON i.supervisor_id = s.id
        WHERE i.id = ?
      `).get(req.params.id);

      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });

      const history = db.prepare('SELECT * FROM inspection_history WHERE request_id = ? ORDER BY created_at ASC').all(req.params.id);

      res.json({ request, history });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/', inspection, (req, res) => {
    try {
      const { title, description, equipment_name, location, inspection_type, urgency = 'normal', deadline } = req.body;
      if (!title || !inspection_type) {
        return res.status(400).json({ error: 'عنوان و نوع بازرسی الزامی است' });
      }

      const user = db.prepare('SELECT department_id FROM users WHERE id = ?').get(req.user.id);
      const supervisorId = findSupervisorId(user?.department_id);
      const requestNumber = getNextNumber();
      const technicalUsers = getTechnicalUsers();
      const assignedTo = technicalUsers.length > 0 ? technicalUsers[0].id : null;

      const result = db.prepare(`
        INSERT INTO inspection_requests (user_id, request_number, title, description, equipment_name, location, inspection_type, urgency, deadline, department_id, assigned_to, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(req.user.id, requestNumber, title, description || '', equipment_name || '', location || '', inspection_type, urgency, deadline || null, user?.department_id, assignedTo, 'pending_supervisor');

      addHistory(result.lastInsertRowid, req.user.id, req.user.full_name, 'ثبت درخواست', null);

      if (supervisorId) {
        notify(supervisorId, 'درخواست بازرسی فنی جدید', `درخواست شماره ${requestNumber} توسط ${req.user.full_name} ثبت شد`, '/inspection');
      }

      res.json({ id: result.lastInsertRowid, request_number: requestNumber });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/approve', (req, res) => {
    try {
      const { comment } = req.body;
      const request = db.prepare('SELECT * FROM inspection_requests WHERE id = ?').get(req.params.id);
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });

      const now = new Date().toISOString();
      let newStatus = '';
      let historyAction = '';

      if (request.status === 'pending_supervisor') {
        newStatus = 'pending_manager';
        db.prepare('UPDATE inspection_requests SET supervisor_id = ?, supervisor_comment = ?, supervisor_date = ?, status = ? WHERE id = ?')
          .run(req.user.id, comment, now, newStatus, req.params.id);
        historyAction = 'تایید سرپرست';
        const managers = db.prepare("SELECT id FROM users WHERE role = 'manager'").all();
        managers.forEach(mgr => notify(mgr.id, 'درخواست بازرسی نیاز به تایید', `درخواست شماره ${request.request_number} توسط سرپرست تایید شد`, '/inspection'));
      } else if (request.status === 'pending_manager') {
        newStatus = 'in_progress';
        db.prepare('UPDATE inspection_requests SET manager_id = ?, manager_comment = ?, manager_date = ?, status = ? WHERE id = ?')
          .run(req.user.id, comment, now, newStatus, req.params.id);
        historyAction = 'تایید مدیر و ارجاع به فنی';
      } else {
        return res.status(400).json({ error: 'وضعیت درخواست نامعتبر است' });
      }

      addHistory(req.params.id, req.user.id, req.user.full_name, historyAction, comment);
      notify(request.user_id, 'بروزرسانی درخواست بازرسی', `درخواست شماره ${request.request_number}: ${historyAction}`, '/inspection');

      res.json({ success: true, status: newStatus });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/inspect', (req, res) => {
    try {
      const { result: inspectResult, description } = req.body;
      const request = db.prepare('SELECT * FROM inspection_requests WHERE id = ?').get(req.params.id);
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });

      db.prepare("UPDATE inspection_requests SET status = 'completed', inspection_result = ?, inspection_description = ?, inspect_date = datetime('now') WHERE id = ?")
        .run(inspectResult || '', description || '', req.params.id);

      addHistory(req.params.id, req.user.id, req.user.full_name, 'انجام بازرسی', inspectResult);
      notify(request.user_id, 'تکمیل بازرسی فنی', `بازرسی درخواست شماره ${request.request_number} تکمیل شد`, '/inspection');

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/reject', (req, res) => {
    try {
      const { comment } = req.body;
      const request = db.prepare('SELECT * FROM inspection_requests WHERE id = ?').get(req.params.id);
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });

      const now = new Date().toISOString();

      if (request.status === 'pending_supervisor') {
        db.prepare('UPDATE inspection_requests SET supervisor_id = ?, supervisor_comment = ?, supervisor_date = ?, status = ? WHERE id = ?')
          .run(req.user.id, comment, now, 'rejected', req.params.id);
        addHistory(req.params.id, req.user.id, req.user.full_name, 'رد توسط سرپرست', comment);
      } else if (request.status === 'pending_manager') {
        db.prepare('UPDATE inspection_requests SET manager_id = ?, manager_comment = ?, manager_date = ?, status = ? WHERE id = ?')
          .run(req.user.id, comment, now, 'rejected', req.params.id);
        addHistory(req.params.id, req.user.id, req.user.full_name, 'رد توسط مدیر', comment);
      } else {
        return res.status(400).json({ error: 'وضعیت درخواست نامعتبر است' });
      }

      notify(request.user_id, 'رد درخواست بازرسی', `درخواست شماره ${request.request_number} رد شد`, '/inspection');

      res.json({ success: true, status: 'rejected' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id', (req, res) => {
    try {
      const request = db.prepare('SELECT * FROM inspection_requests WHERE id = ?').get(req.params.id);
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });
      if (request.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      if (!['pending_supervisor'].includes(request.status)) {
        return res.status(400).json({ error: 'امکان حذف درخواست در این مرحله وجود ندارد' });
      }

      db.prepare('DELETE FROM inspection_history WHERE request_id = ?').run(req.params.id);
      db.prepare('DELETE FROM inspection_requests WHERE id = ?').run(req.params.id);

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
