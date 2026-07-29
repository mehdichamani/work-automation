const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { validateInput, repair } = require('../middleware/validate');
const { notify: notifyHelper, findSupervisorId: findSupervisorIdHelper, getNextNumber: getNextNumberHelper, addHistory: addHistoryHelper } = require('../utils/helpers');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', 'uploads', 'repair');
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `repair-${Date.now()}-${Math.random().toString(36).slice(2, 6)}${ext}`);
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

module.exports = function (db) {
  const router = express.Router();
  router.use(authMiddleware);

  function notify(userId, title, body, link) { notifyHelper(db, userId, title, body, link); }
  function addHistory(id, userId, userName, action, comment) { addHistoryHelper(db, 'repair_history', 'request_id', id, userId, userName, action, comment); }
  function findSupervisorId(departmentId) { return findSupervisorIdHelper(db, departmentId); }
  function getNextNumber() { return getNextNumberHelper(db, 'repair_counter', 'تعمیر'); }

  router.get('/', (req, res) => {
    try {
      const { status, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;
      let where = '';
      const params = [];

      if (req.user.role === 'user') {
        where = 'WHERE r.user_id = ?';
        params.push(req.user.id);
      } else if (req.user.role === 'supervisor') {
        where = "WHERE r.status = 'pending_supervisor'";
      } else if (req.user.role === 'manager') {
        where = "WHERE r.status = 'pending_manager'";
      }

      if (status) {
        where += (where ? ' AND ' : 'WHERE ') + 'r.status = ?';
        params.push(status);
      }

      const total = db.prepare(`SELECT COUNT(*) as count FROM repair_requests r ${where}`).get(...params).count;
      const requests = db.prepare(`
        SELECT r.*, u.full_name as user_name, d.name as department_name,
               m.full_name as manager_name, s.full_name as supervisor_name
        FROM repair_requests r
        LEFT JOIN users u ON r.user_id = u.id
        LEFT JOIN departments d ON r.department_id = d.id
        LEFT JOIN users m ON r.manager_id = m.id
        LEFT JOIN users s ON r.supervisor_id = s.id
        ${where}
        ORDER BY r.created_at DESC
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
        SELECT r.*, u.full_name as user_name, d.name as department_name,
               m.full_name as manager_name, s.full_name as supervisor_name
        FROM repair_requests r
        LEFT JOIN users u ON r.user_id = u.id
        LEFT JOIN departments d ON r.department_id = d.id
        LEFT JOIN users m ON r.manager_id = m.id
        LEFT JOIN users s ON r.supervisor_id = s.id
        WHERE r.user_id = ?
        ORDER BY r.created_at DESC
      `).all(req.user.id);
      res.json(requests);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/:id', (req, res) => {
    try {
      const request = db.prepare(`
        SELECT r.*, u.full_name as user_name, d.name as department_name,
               m.full_name as manager_name, s.full_name as supervisor_name
        FROM repair_requests r
        LEFT JOIN users u ON r.user_id = u.id
        LEFT JOIN departments d ON r.department_id = d.id
        LEFT JOIN users m ON r.manager_id = m.id
        LEFT JOIN users s ON r.supervisor_id = s.id
        WHERE r.id = ?
      `).get(req.params.id);

      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });

      const history = db.prepare('SELECT * FROM repair_history WHERE request_id = ? ORDER BY created_at ASC').all(req.params.id);

      res.json({ request, history });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/', upload.array('images', 5), validateInput({ title: 200, description: 1000 }), repair, (req, res) => {
    try {
      const { title, description, equipment_name, location, urgency = 'normal', estimated_cost } = req.body;
      if (!title) {
        return res.status(400).json({ error: 'عنوان درخواست الزامی است' });
      }

      const user = db.prepare('SELECT department_id FROM users WHERE id = ?').get(req.user.id);
      const supervisorId = findSupervisorId(user?.department_id);
      const requestNumber = getNextNumber();

      let images = null;
      if (req.files && req.files.length > 0) {
        images = JSON.stringify(req.files.map(f => `/uploads/repair/${f.filename}`));
      }

      const result = db.prepare(`
        INSERT INTO repair_requests (user_id, request_number, title, description, equipment_name, location, urgency, estimated_cost, department_id, status, images)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(req.user.id, requestNumber, title, description || '', equipment_name || '', location || '', urgency, estimated_cost || null, user?.department_id, 'pending_supervisor', images);

      addHistory(result.lastInsertRowid, req.user.id, req.user.full_name, 'ثبت درخواست', null);

      if (supervisorId) {
        notify(supervisorId, 'درخواست تعمیرات جدید', `درخواست شماره ${requestNumber} توسط ${req.user.full_name} ثبت شد`, '/repair');
      }

      res.json({ id: result.lastInsertRowid, request_number: requestNumber });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/approve', (req, res) => {
    try {
      const { comment } = req.body;
      const request = db.prepare('SELECT * FROM repair_requests WHERE id = ?').get(req.params.id);
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });

      const now = new Date().toISOString();
      let newStatus = '';
      let historyAction = '';

      if (request.status === 'pending_supervisor') {
        newStatus = 'pending_manager';
        db.prepare('UPDATE repair_requests SET supervisor_id = ?, supervisor_comment = ?, supervisor_date = ?, status = ? WHERE id = ?')
          .run(req.user.id, comment, now, newStatus, req.params.id);
        historyAction = 'تایید سرپرست';
        const managers = db.prepare("SELECT id FROM users WHERE role = 'manager'").all();
        managers.forEach(mgr => notify(mgr.id, 'درخواست تعمیرات نیاز به تایید', `درخواست شماره ${request.request_number} توسط سرپرست تایید شد`, '/repair'));
      } else if (request.status === 'pending_manager') {
        newStatus = 'approved';
        db.prepare('UPDATE repair_requests SET manager_id = ?, manager_comment = ?, manager_date = ?, status = ? WHERE id = ?')
          .run(req.user.id, comment, now, newStatus, req.params.id);
        historyAction = 'تایید مدیر';
      } else {
        return res.status(400).json({ error: 'وضعیت درخواست نامعتبر است' });
      }

      addHistory(req.params.id, req.user.id, req.user.full_name, historyAction, comment);
      notify(request.user_id, 'تایید درخواست تعمیرات', `درخواست شماره ${request.request_number} تایید شد`, '/repair');

      res.json({ success: true, status: newStatus });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/reject', (req, res) => {
    try {
      const { comment } = req.body;
      const request = db.prepare('SELECT * FROM repair_requests WHERE id = ?').get(req.params.id);
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });
      if (!comment) return res.status(400).json({ error: 'دلیل رد الزامی است' });

      const now = new Date().toISOString();

      if (request.status === 'pending_supervisor') {
        db.prepare('UPDATE repair_requests SET supervisor_id = ?, supervisor_comment = ?, supervisor_date = ?, status = ? WHERE id = ?')
          .run(req.user.id, comment, now, 'rejected', req.params.id);
        addHistory(req.params.id, req.user.id, req.user.full_name, 'رد توسط سرپرست', comment);
      } else if (request.status === 'pending_manager') {
        db.prepare('UPDATE repair_requests SET manager_id = ?, manager_comment = ?, manager_date = ?, status = ? WHERE id = ?')
          .run(req.user.id, comment, now, 'rejected', req.params.id);
        addHistory(req.params.id, req.user.id, req.user.full_name, 'رد توسط مدیر', comment);
      } else {
        return res.status(400).json({ error: 'وضعیت درخواست نامعتبر است' });
      }

      notify(request.user_id, 'رد درخواست تعمیرات', `درخواست شماره ${request.request_number} رد شد`, '/repair');

      res.json({ success: true, status: 'rejected' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id', (req, res) => {
    try {
      const request = db.prepare('SELECT * FROM repair_requests WHERE id = ?').get(req.params.id);
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });
      if (request.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      if (request.status !== 'pending_supervisor') {
        return res.status(400).json({ error: 'امکان حذف درخواست در این مرحله وجود ندارد' });
      }

      db.prepare('DELETE FROM repair_history WHERE request_id = ?').run(req.params.id);
      if (request.images) {
        try {
          const images = JSON.parse(request.images);
          for (const img of images) {
            const filePath = path.join(__dirname, '..', img);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          }
        } catch {}
      }
      db.prepare('DELETE FROM repair_requests WHERE id = ?').run(req.params.id);

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
