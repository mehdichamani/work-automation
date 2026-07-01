const express = require('express');
const { authMiddleware } = require('../middleware/auth');

module.exports = function(db) {
  const router = express.Router();
  router.use(authMiddleware);

  function notify(userId, title, body, link) {
    db.prepare('INSERT INTO notifications (user_id, title, body, link) VALUES (?, ?, ?, ?)').run(userId, title, body, link);
  }

  function isShiftManager(user) {
    return ['admin', 'manager', 'supervisor'].includes(user.role);
  }

  function getCurrentShift(userId) {
    return db.prepare(`
      SELECT sa.id AS assignment_id, sa.user_id, sa.is_active, s.id AS shift_id, s.name, s.start_time, s.end_time, s.description, s.color
      FROM user_shift_assignments sa
      JOIN work_shifts s ON sa.shift_id = s.id
      WHERE sa.user_id = ? AND sa.is_active = 1
      ORDER BY sa.id DESC
      LIMIT 1
    `).get(userId);
  }

  router.get('/my', (req, res) => {
    try {
      const currentShift = getCurrentShift(req.user.id);
      res.json({ current_shift: currentShift || null });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/', (req, res) => {
    try {
      const shifts = db.prepare('SELECT * FROM work_shifts WHERE is_active = 1 ORDER BY id').all();
      res.json(shifts);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/', (req, res) => {
    if (!isShiftManager(req.user)) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }

    try {
      const { name, start_time, end_time, description, color } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'نام شیفت الزامی است' });
      }

      const result = db.prepare(`
        INSERT INTO work_shifts (name, start_time, end_time, description, color)
        VALUES (?, ?, ?, ?, ?)
      `).run(name, start_time || '', end_time || '', description || '', color || '#3b82f6');

      res.json({ id: result.lastInsertRowid, message: 'شیفت با موفقیت ایجاد شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id', (req, res) => {
    if (!isShiftManager(req.user)) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }

    try {
      const { name, start_time, end_time, description, color } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'نام شیفت الزامی است' });
      }

      db.prepare(`
        UPDATE work_shifts
        SET name = ?, start_time = ?, end_time = ?, description = ?, color = ?
        WHERE id = ?
      `).run(name, start_time || '', end_time || '', description || '', color || '#3b82f6', req.params.id);

      res.json({ message: 'شیفت با موفقیت ویرایش شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id', (req, res) => {
    if (!isShiftManager(req.user)) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }

    try {
      db.prepare('UPDATE work_shifts SET is_active = 0 WHERE id = ?').run(req.params.id);
      res.json({ message: 'شیفت غیرفعال شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/assignments', (req, res) => {
    if (!isShiftManager(req.user)) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }

    try {
      const assignments = db.prepare(`
        SELECT sa.id, sa.user_id, sa.is_active, sa.created_at,
               u.full_name, u.username, u.role, u.department_id,
               d.name AS department_name,
               s.name AS shift_name, s.start_time, s.end_time, s.color, s.description
        FROM user_shift_assignments sa
        JOIN users u ON sa.user_id = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        JOIN work_shifts s ON sa.shift_id = s.id
        WHERE sa.is_active = 1
        ORDER BY u.full_name
      `).all();
      res.json(assignments);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/assignments', (req, res) => {
    if (!isShiftManager(req.user)) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }

    try {
      const { user_id, shift_id } = req.body;
      if (!user_id || !shift_id) {
        return res.status(400).json({ error: 'کاربر و شیفت الزامی است' });
      }

      db.prepare('UPDATE user_shift_assignments SET is_active = 0 WHERE user_id = ?').run(user_id);
      const result = db.prepare(`
        INSERT INTO user_shift_assignments (user_id, shift_id, is_active)
        VALUES (?, ?, 1)
      `).run(user_id, shift_id);

      res.json({ id: result.lastInsertRowid, message: 'شیفت کاربر با موفقیت تنظیم شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/requests/my', (req, res) => {
    try {
      const requests = db.prepare(`
        SELECT scr.*, c.name AS current_shift_name, r.name AS requested_shift_name
        FROM shift_change_requests scr
        LEFT JOIN work_shifts c ON scr.current_shift_id = c.id
        LEFT JOIN work_shifts r ON scr.requested_shift_id = r.id
        WHERE scr.user_id = ?
        ORDER BY scr.created_at DESC
      `).all(req.user.id);
      res.json(requests);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/requests', (req, res) => {
    if (!isShiftManager(req.user)) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }

    try {
      const requests = db.prepare(`
        SELECT scr.*, u.full_name AS user_name, u.department_id,
               d.name AS department_name,
               c.name AS current_shift_name,
               r.name AS requested_shift_name,
               reviewer.full_name AS reviewer_name
        FROM shift_change_requests scr
        JOIN users u ON scr.user_id = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN work_shifts c ON scr.current_shift_id = c.id
        LEFT JOIN work_shifts r ON scr.requested_shift_id = r.id
        LEFT JOIN users reviewer ON scr.reviewed_by = reviewer.id
        ORDER BY scr.created_at DESC
      `).all();
      res.json(requests);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/requests', (req, res) => {
    try {
      const { requested_shift_id, reason, requested_date } = req.body;
      if (!requested_shift_id) {
        return res.status(400).json({ error: 'شیفت درخواستی الزامی است' });
      }

      const currentShift = getCurrentShift(req.user.id);
      const result = db.prepare(`
        INSERT INTO shift_change_requests (user_id, current_shift_id, requested_shift_id, requested_date, reason, status)
        VALUES (?, ?, ?, ?, ?, 'pending')
      `).run(req.user.id, currentShift?.shift_id || null, requested_shift_id, requested_date || '', reason || '');

      const managers = db.prepare("SELECT id FROM users WHERE role IN ('admin', 'manager') AND is_active = 1").all();
      managers.forEach(manager => {
        notify(manager.id, 'درخواست تغییر شیفت', `${req.user.full_name} درخواست تغییر شیفت ثبت کرده است`, '/shifts');
      });

      res.json({ id: result.lastInsertRowid, message: 'درخواست تغییر شیفت ثبت شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/requests/:id/approve', (req, res) => {
    if (!isShiftManager(req.user)) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }

    try {
      const request = db.prepare('SELECT * FROM shift_change_requests WHERE id = ?').get(req.params.id);
      if (!request) {
        return res.status(404).json({ error: 'درخواست یافت نشد' });
      }

      db.prepare(`
        UPDATE shift_change_requests
        SET status = 'approved', reviewed_by = ?, reviewed_at = datetime('now'), review_comment = ?
        WHERE id = ?
      `).run(req.user.id, req.body.comment || '', req.params.id);

      db.prepare('UPDATE user_shift_assignments SET is_active = 0 WHERE user_id = ?').run(request.user_id);
      db.prepare(`
        INSERT INTO user_shift_assignments (user_id, shift_id, is_active)
        VALUES (?, ?, 1)
      `).run(request.user_id, request.requested_shift_id);

      notify(request.user_id, 'تایید تغییر شیفت', 'درخواست تغییر شیفت شما تایید شد', '/shifts');
      res.json({ message: 'درخواست تغییر شیفت تایید شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/requests/:id/reject', (req, res) => {
    if (!isShiftManager(req.user)) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }

    try {
      const request = db.prepare('SELECT * FROM shift_change_requests WHERE id = ?').get(req.params.id);
      if (!request) {
        return res.status(404).json({ error: 'درخواست یافت نشد' });
      }

      db.prepare(`
        UPDATE shift_change_requests
        SET status = 'rejected', reviewed_by = ?, reviewed_at = datetime('now'), review_comment = ?
        WHERE id = ?
      `).run(req.user.id, req.body.comment || 'رد شد', req.params.id);

      notify(request.user_id, 'رد درخواست تغییر شیفت', 'درخواست تغییر شیفت شما رد شد', '/shifts');
      res.json({ message: 'درخواست تغییر شیفت رد شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
