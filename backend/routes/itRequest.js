const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { itRequest } = require('../middleware/validate');
const { notify: notifyHelper, getNextNumber: getNextNumberHelper, addHistory: addHistoryHelper } = require('../utils/helpers');

module.exports = function (db) {
  const router = express.Router();
  router.use(authMiddleware);

  function notify(userId, title, body, link) { notifyHelper(db, userId, title, body, link); }
  function addHistory(id, userId, userName, action, comment) { addHistoryHelper(db, 'it_request_history', 'request_id', id, userId, userName, action, comment); }

  function getITUsers() {
    const dept = db.prepare("SELECT id FROM departments WHERE name LIKE '%فنی%' OR name LIKE '%IT%' LIMIT 1").get();
    if (!dept) return [];
    return db.prepare("SELECT id FROM users WHERE department_id = ? AND is_active = 1").all(dept.id);
  }

  function getNextNumber() { return getNextNumberHelper(db, 'it_request_counter', 'TK'); }

  router.get('/stats', (req, res) => {
    try {
      const stats = db.prepare(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'pending') as pending,
          COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
          COUNT(*) FILTER (WHERE status = 'completed') as completed,
          COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
          COUNT(*) FILTER (WHERE urgency = 'urgent') as urgent,
          COUNT(*) FILTER (WHERE urgency = 'high') as high
        FROM it_requests
      `).get();
      res.json(stats);
    } catch (err) {
      res.json({ total: 0, pending: 0, in_progress: 0, completed: 0, rejected: 0, urgent: 0, high: 0 });
    }
  });

  router.get('/', (req, res) => {
    try {
      const { status, priority, urgency, page = 1, limit = 50 } = req.query;
      const offset = (page - 1) * limit;
      let where = '';
      const params = [];

      if (req.user.role === 'user') {
        where = 'WHERE i.user_id = ?';
        params.push(req.user.id);
      } else {
        where = 'WHERE (i.assigned_to = ? OR i.user_id = ? OR i.status = ? OR ? IN (\'admin\',\'manager\',\'supervisor\'))';
        params.push(req.user.id, req.user.id, 'pending', req.user.role);
      }

      if (status) {
        where += ' AND i.status = ?';
        params.push(status);
      }
      if (urgency || priority) {
        where += ' AND i.urgency = ?';
        params.push(urgency || priority);
      }

      const total = db.prepare(`SELECT COUNT(*) as count FROM it_requests i ${where}`).get(...params).count;
      const requests = db.prepare(`
        SELECT i.*, u.full_name as user_name, d.name as department_name,
               a.full_name as assigned_name
        FROM it_requests i
        LEFT JOIN users u ON i.user_id = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN users a ON i.assigned_to = a.id
        ${where}
        ORDER BY
          CASE WHEN i.urgency = 'urgent' THEN 0 WHEN i.urgency = 'high' THEN 1 ELSE 2 END,
          i.created_at DESC
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
               a.full_name as assigned_name
        FROM it_requests i
        LEFT JOIN users u ON i.user_id = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN users a ON i.assigned_to = a.id
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
               a.full_name as assigned_name
        FROM it_requests i
        LEFT JOIN users u ON i.user_id = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN users a ON i.assigned_to = a.id
        WHERE i.id = ?
      `).get(req.params.id);

      if (!request) return res.status(404).json({ error: 'تیکت یافت نشد' });

      const history = db.prepare('SELECT * FROM it_request_history WHERE request_id = ? ORDER BY created_at ASC').all(req.params.id);

      res.json({ request, history });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/', itRequest, (req, res) => {
    try {
      const { title, description, request_type = 'general', urgency = 'normal', device_info } = req.body;
      if (!title) {
        return res.status(400).json({ error: 'عنوان تیکت الزامی است' });
      }

      const requestNumber = getNextNumber();
      const itUsers = getITUsers();
      const assignedTo = itUsers.length > 0 ? itUsers[0].id : null;

      const result = db.prepare(`
        INSERT INTO it_requests (user_id, request_number, title, description, request_type, urgency, device_info, assigned_to, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(req.user.id, requestNumber, title, description || '', request_type, urgency, device_info || '', assignedTo, 'pending');

      addHistory(result.lastInsertRowid, req.user.id, req.user.full_name, 'ثبت تیکت', null);

      itUsers.forEach(u => {
        notify(u.id, 'تیکت جدید', `تیکت شماره ${requestNumber} توسط ${req.user.full_name} ثبت شد`, '/it');
      });

      res.json({ id: result.lastInsertRowid, request_number: requestNumber });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/respond', (req, res) => {
    try {
      const { comment } = req.body;
      if (!comment) return res.status(400).json({ error: 'پیام الزامی است' });

      const request = db.prepare('SELECT * FROM it_requests WHERE id = ?').get(req.params.id);
      if (!request) return res.status(404).json({ error: 'تیکت یافت نشد' });

      addHistory(req.params.id, req.user.id, req.user.full_name, 'پاسخ', comment);

      const notifyUserId = req.user.id === request.user_id ? request.assigned_to : request.user_id;
      if (notifyUserId) {
        notify(notifyUserId, 'پاسخ جدید', `پاسخ جدیدی برای تیکت ${request.request_number} ثبت شد`, '/it');
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id/assign', (req, res) => {
    try {
      if (!['admin', 'manager', 'supervisor'].includes(req.user.role)) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      const { assigned_to } = req.body;
      const request = db.prepare('SELECT * FROM it_requests WHERE id = ?').get(req.params.id);
      if (!request) return res.status(404).json({ error: 'تیکت یافت نشد' });

      db.prepare('UPDATE it_requests SET assigned_to = ? WHERE id = ?').run(assigned_to || null, req.params.id);

      addHistory(req.params.id, req.user.id, req.user.full_name, 'واگذاری', `واگذاری به کاربر ${assigned_to}`);

      if (assigned_to) {
        notify(assigned_to, 'تیکت واگذار شده', `تیکت ${request.request_number} به شما واگذار شد`, '/it');
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/accept', (req, res) => {
    try {
      const request = db.prepare('SELECT * FROM it_requests WHERE id = ?').get(req.params.id);
      if (!request) return res.status(404).json({ error: 'تیکت یافت نشد' });

      db.prepare("UPDATE it_requests SET status = 'in_progress', assigned_to = ? WHERE id = ?")
        .run(req.user.id, req.params.id);

      addHistory(req.params.id, req.user.id, req.user.full_name, 'شروع بررسی', null);
      notify(request.user_id, 'شروع بررسی تیکت', `تیکت شماره ${request.request_number} در حال بررسی است`, '/it');

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/complete', (req, res) => {
    try {
      const { comment } = req.body;
      const request = db.prepare('SELECT * FROM it_requests WHERE id = ?').get(req.params.id);
      if (!request) return res.status(404).json({ error: 'تیکت یافت نشد' });

      db.prepare("UPDATE it_requests SET status = 'completed', completion_comment = ? WHERE id = ?")
        .run(comment || '', req.params.id);

      addHistory(req.params.id, req.user.id, req.user.full_name, 'حل شده', comment);
      notify(request.user_id, 'تیکت حل شد', `تیکت شماره ${request.request_number} حل شد`, '/it');

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/reject', (req, res) => {
    try {
      const { comment } = req.body;
      const request = db.prepare('SELECT * FROM it_requests WHERE id = ?').get(req.params.id);
      if (!request) return res.status(404).json({ error: 'تیکت یافت نشد' });

      db.prepare("UPDATE it_requests SET status = 'rejected', reject_comment = ? WHERE id = ?")
        .run(comment || '', req.params.id);

      addHistory(req.params.id, req.user.id, req.user.full_name, 'رد شده', comment);
      notify(request.user_id, 'تیکت رد شد', `تیکت شماره ${request.request_number} رد شد`, '/it');

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id', (req, res) => {
    try {
      const request = db.prepare('SELECT * FROM it_requests WHERE id = ?').get(req.params.id);
      if (!request) return res.status(404).json({ error: 'تیکت یافت نشد' });
      if (request.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      if (request.status !== 'pending') {
        return res.status(400).json({ error: 'امکان حذف تیکت در این مرحله وجود ندارد' });
      }

      db.prepare('DELETE FROM it_request_history WHERE request_id = ?').run(req.params.id);
      db.prepare('DELETE FROM it_requests WHERE id = ?').run(req.params.id);

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
