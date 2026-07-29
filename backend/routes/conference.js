const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { conference } = require('../middleware/validate');
const { notify: notifyHelper, getNextNumber: getNextNumberHelper, addHistory: addHistoryHelper } = require('../utils/helpers');

module.exports = function (db) {
  const router = express.Router();
  router.use(authMiddleware);

  function notify(userId, title, body, link) { notifyHelper(db, userId, title, body, link); }
  function addHistory(id, userId, userName, action, comment) { addHistoryHelper(db, 'conference_history', 'request_id', id, userId, userName, action, comment); }
  function getNextNumber() { return getNextNumberHelper(db, 'conference_counter', 'جلسه'); }

  router.get('/', (req, res) => {
    try {
      const { status, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;
      let where = '';
      const params = [];

      if (req.user.role === 'user') {
        where = 'WHERE c.user_id = ?';
        params.push(req.user.id);
      } else if (req.user.role === 'supervisor') {
        where = 'WHERE c.user_id = ?';
        params.push(req.user.id);
      } else if (req.user.role === 'manager') {
        where = "WHERE c.status = 'pending_manager'";
      }

      if (status && status !== 'all') {
        where += (where ? ' AND ' : 'WHERE ') + 'c.status = ?';
        params.push(status);
      }

      const total = db.prepare(`SELECT COUNT(*) as count FROM conference_bookings c ${where}`).get(...params).count;
      const bookings = db.prepare(`
        SELECT c.*, u.full_name as user_name, d.name as department_name,
               m.full_name as manager_name
        FROM conference_bookings c
        LEFT JOIN users u ON c.user_id = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN users m ON c.manager_id = m.id
        ${where}
        ORDER BY c.created_at DESC
        LIMIT ? OFFSET ?
      `).all(...params, parseInt(limit), parseInt(offset));

      res.json({ bookings, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/my-bookings', (req, res) => {
    try {
      const bookings = db.prepare(`
        SELECT c.*, u.full_name as user_name, d.name as department_name,
               m.full_name as manager_name
        FROM conference_bookings c
        LEFT JOIN users u ON c.user_id = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN users m ON c.manager_id = m.id
        WHERE c.user_id = ?
        ORDER BY c.created_at DESC
      `).all(req.user.id);
      res.json(bookings);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/pending-manager', (req, res) => {
    try {
      if (req.user.role !== 'manager' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      const bookings = db.prepare(`
        SELECT c.*, u.full_name as user_name, d.name as department_name
        FROM conference_bookings c
        LEFT JOIN users u ON c.user_id = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE c.status = 'pending_manager'
        ORDER BY c.created_at DESC
      `).all();
      res.json(bookings);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/available', (req, res) => {
    try {
      const { date } = req.query;
      if (!date) return res.status(400).json({ error: 'تاریخ الزامی است' });

      const booked = db.prepare(`
        SELECT start_time, end_time FROM conference_bookings
        WHERE booking_date = ? AND status NOT IN ('rejected', 'cancelled')
      `).all(date);

      const allSlots = [
        { start: '08:00', end: '09:30' },
        { start: '09:30', end: '11:00' },
        { start: '11:00', end: '12:30' },
        { start: '13:30', end: '15:00' },
        { start: '15:00', end: '16:30' },
        { start: '16:30', end: '18:00' },
      ];

      const available = allSlots.filter(slot => {
        return !booked.some(b => b.start_time <= slot.start && b.end_time > slot.start);
      });

      res.json({ available, booked });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/:id', (req, res) => {
    try {
      const booking = db.prepare(`
        SELECT c.*, u.full_name as user_name, d.name as department_name,
               m.full_name as manager_name
        FROM conference_bookings c
        LEFT JOIN users u ON c.user_id = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN users m ON c.manager_id = m.id
        WHERE c.id = ?
      `).get(req.params.id);
      if (!booking) return res.status(404).json({ error: 'رزرو یافت نشد' });

      const history = db.prepare('SELECT * FROM conference_history WHERE request_id = ? ORDER BY created_at ASC').all(req.params.id);
      res.json({ booking, history });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/', conference, (req, res) => {
    try {
      const { booking_date, start_time, end_time, title, description, attendees_count } = req.body;
      if (!booking_date || !start_time || !end_time || !title) {
        return res.status(400).json({ error: 'فیلدهای الزامی را پر کنید' });
      }

      const conflict = db.prepare(`
        SELECT id FROM conference_bookings
        WHERE booking_date = ? AND status NOT IN ('rejected', 'cancelled')
        AND NOT (end_time <= ? OR start_time >= ?)
      `).get(booking_date, start_time, end_time);

      if (conflict) {
        return res.status(400).json({ error: 'این بازه زمانی قبلاً رزرو شده است' });
      }

      const requestNumber = getNextNumber();

      const result = db.prepare(`
        INSERT INTO conference_bookings (user_id, booking_date, start_time, end_time, title, description, attendees_count, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending_manager')
      `).run(req.user.id, booking_date, start_time, end_time, title, description || '', attendees_count || 0);

      const bookingId = result.lastInsertRowid;
      addHistory(bookingId, req.user.id, req.user.full_name, 'ثبت درخواست', '');

      const managers = db.prepare("SELECT id FROM users WHERE role = 'manager' AND is_active = 1").all();
      managers.forEach(mgr => notify(mgr.id, 'درخواست رزرو سالن جدید', `رزرو "${title}" توسط ${req.user.full_name} ثبت شده`, '/conference'));

      res.json({ id: bookingId, request_number: requestNumber });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/approve', (req, res) => {
    try {
      if (req.user.role !== 'manager' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      const booking = db.prepare('SELECT * FROM conference_bookings WHERE id = ?').get(req.params.id);
      if (!booking) return res.status(404).json({ error: 'رزرو یافت نشد' });
      if (booking.status !== 'pending_manager') {
        return res.status(400).json({ error: 'این رزرو قبلاً بررسی شده' });
      }

      db.prepare("UPDATE conference_bookings SET status = 'approved', manager_id = ?, manager_comment = ? WHERE id = ?").run(req.user.id, req.body.comment || '', req.params.id);
      addHistory(req.params.id, req.user.id, req.user.full_name, 'تایید مدیر', req.body.comment || '');

      if (booking.user_id) {
        notify(booking.user_id, 'تایید رزرو سالن', `رزرو "${booking.title}" تایید شد`, '/conference');
      }

      res.json({ message: 'رزرو تایید شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/reject', (req, res) => {
    try {
      if (req.user.role !== 'manager' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      const booking = db.prepare('SELECT * FROM conference_bookings WHERE id = ?').get(req.params.id);
      if (!booking) return res.status(404).json({ error: 'رزرو یافت نشد' });

      const { comment } = req.body;
      if (!comment) return res.status(400).json({ error: 'دلیل رد الزامی است' });

      db.prepare("UPDATE conference_bookings SET status = 'rejected', manager_id = ?, manager_comment = ? WHERE id = ?").run(req.user.id, comment, req.params.id);
      addHistory(req.params.id, req.user.id, req.user.full_name, 'رد مدیر', comment);

      if (booking.user_id) {
        notify(booking.user_id, 'رد رزرو سالن', `رزرو "${booking.title}" رد شد. دلیل: ${comment}`, '/conference');
      }

      res.json({ message: 'رزرو رد شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/cancel', (req, res) => {
    try {
      const booking = db.prepare('SELECT * FROM conference_bookings WHERE id = ?').get(req.params.id);
      if (!booking) return res.status(404).json({ error: 'رزرو یافت نشد' });

      if (booking.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }

      db.prepare("UPDATE conference_bookings SET status = 'cancelled' WHERE id = ?").run(req.params.id);
      addHistory(req.params.id, req.user.id, req.user.full_name, 'لغو رزرو', '');

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id', (req, res) => {
    try {
      const booking = db.prepare('SELECT * FROM conference_bookings WHERE id = ?').get(req.params.id);
      if (!booking) return res.status(404).json({ error: 'رزرو یافت نشد' });
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'فقط مدیر سیستم می‌تواند حذف کند' });
      }

      db.prepare('DELETE FROM conference_bookings WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
