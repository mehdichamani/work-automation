const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { security } = require('../middleware/validate');

module.exports = function (db) {
  const router = express.Router();
  router.use(authMiddleware);

  function notify(userId, title, body, link) {
    db.prepare('INSERT INTO notifications (user_id, title, body, link) VALUES (?, ?, ?, ?)').run(userId, title, body, link);
  }

  function addHistory(reportId, userId, userName, action, comment) {
    db.prepare('INSERT INTO security_history (request_id, user_id, user_name, action, comment) VALUES (?, ?, ?, ?, ?)').run(reportId, userId, userName, action, comment || '');
  }

  function isSecurity(user) {
    if (user.role === 'admin') return true;
    const dept = db.prepare('SELECT name FROM departments WHERE id = ?').get(user.department_id);
    return dept && dept.name.includes('حراست');
  }

  function isSupervisorOrManager(user) {
    return user.role === 'supervisor' || user.role === 'manager' || user.role === 'admin';
  }

  router.get('/', (req, res) => {
    try {
      const { status, date, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;
      let where = '';
      const params = [];

      if (!isSecurity(req.user) && req.user.role !== 'admin') {
        where = 'WHERE s.user_id = ?';
        params.push(req.user.id);
      }

      if (status) {
        where += (where ? ' AND ' : 'WHERE ') + 's.status = ?';
        params.push(status);
      }

      if (date) {
        where += (where ? ' AND ' : 'WHERE ') + 's.report_date = ?';
        params.push(date);
      }

      const total = db.prepare(`SELECT COUNT(*) as count FROM security_reports s ${where}`).get(...params).count;
      const reports = db.prepare(`
        SELECT s.*, u.full_name as user_name,
               sup.full_name as supervisor_name, mgr.full_name as manager_name
        FROM security_reports s
        LEFT JOIN users u ON s.user_id = u.id
        LEFT JOIN users sup ON s.supervisor_id = sup.id
        LEFT JOIN users mgr ON s.manager_id = mgr.id
        ${where}
        ORDER BY s.report_date DESC, s.created_at DESC
        LIMIT ? OFFSET ?
      `).all(...params, parseInt(limit), parseInt(offset));

      res.json({ reports, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/my-reports', (req, res) => {
    try {
      const reports = db.prepare(`
        SELECT s.*, u.full_name as user_name,
               sup.full_name as supervisor_name, mgr.full_name as manager_name
        FROM security_reports s
        LEFT JOIN users u ON s.user_id = u.id
        LEFT JOIN users sup ON s.supervisor_id = sup.id
        LEFT JOIN users mgr ON s.manager_id = mgr.id
        WHERE s.user_id = ?
        ORDER BY s.report_date DESC
      `).all(req.user.id);
      res.json(reports);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/pending-review', (req, res) => {
    try {
      if (!isSupervisorOrManager(req.user)) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      const reports = db.prepare(`
        SELECT s.*, u.full_name as user_name
        FROM security_reports s
        LEFT JOIN users u ON s.user_id = u.id
        WHERE s.status = 'pending'
        ORDER BY s.report_date ASC
      `).all();
      res.json(reports);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/:id', (req, res) => {
    try {
      const report = db.prepare(`
        SELECT s.*, u.full_name as user_name,
               sup.full_name as supervisor_name, mgr.full_name as manager_name
        FROM security_reports s
        LEFT JOIN users u ON s.user_id = u.id
        LEFT JOIN users sup ON s.supervisor_id = sup.id
        LEFT JOIN users mgr ON s.manager_id = mgr.id
        WHERE s.id = ?
      `).get(req.params.id);

      if (!report) return res.status(404).json({ error: 'گزارش یافت نشد' });

      const history = db.prepare('SELECT * FROM security_history WHERE request_id = ? ORDER BY created_at ASC').all(req.params.id);

      res.json({ report, history });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/', security, (req, res) => {
    try {
      if (!isSecurity(req.user)) {
        return res.status(403).json({ error: 'فقط واحد حراست می‌تواند گزارش ثبت کند' });
      }

      const { report_date, shift_type, incidents, visitors, vehicles, notes } = req.body;
      if (!report_date || !shift_type) {
        return res.status(400).json({ error: 'تاریخ و شیفت الزامی است' });
      }

      const existing = db.prepare('SELECT id FROM security_reports WHERE report_date = ? AND shift_type = ?').get(report_date, shift_type);
      if (existing) {
        return res.status(400).json({ error: 'گزارش برای این تاریخ و شیفت قبلاً ثبت شده' });
      }

      const result = db.prepare(`
        INSERT INTO security_reports (user_id, report_date, shift_type, incidents, visitors, vehicles, notes, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
      `).run(req.user.id, report_date, shift_type, incidents || '', visitors || '', vehicles || '', notes || '');

      addHistory(result.lastInsertRowid, req.user.id, req.user.full_name, 'ثبت گزارش', null);

      res.json({ id: result.lastInsertRowid, message: 'گزارش ثبت شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id', (req, res) => {
    try {
      const report = db.prepare('SELECT * FROM security_reports WHERE id = ?').get(req.params.id);
      if (!report) return res.status(404).json({ error: 'گزارش یافت نشد' });

      if (report.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }

      if (!['pending', 'rejected'].includes(report.status)) {
        return res.status(400).json({ error: 'امکان ویرایش در این مرحله وجود ندارد' });
      }

      const { incidents, visitors, vehicles, notes } = req.body;

      db.prepare('UPDATE security_reports SET incidents = ?, visitors = ?, vehicles = ?, notes = ? WHERE id = ?')
        .run(incidents || report.incidents, visitors || report.visitors, vehicles || report.vehicles, notes || report.notes, req.params.id);

      addHistory(req.params.id, req.user.id, req.user.full_name, 'ویرایش گزارش', null);

      res.json({ message: 'گزارش بروزرسانی شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/review', (req, res) => {
    try {
      if (!isSupervisorOrManager(req.user)) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }

      const { status, comment } = req.body;
      if (!status || !['reviewed', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'وضعیت نامعتبر است' });
      }

      const report = db.prepare('SELECT * FROM security_reports WHERE id = ?').get(req.params.id);
      if (!report) return res.status(404).json({ error: 'گزارش یافت نشد' });
      if (report.status !== 'pending') {
        return res.status(400).json({ error: 'گزارش در وضعیت بررسی نیست' });
      }

      const now = new Date().toISOString();

      if (status === 'reviewed') {
        db.prepare('UPDATE security_reports SET supervisor_id = ?, supervisor_comment = ?, supervisor_date = ?, status = ? WHERE id = ?')
          .run(req.user.id, comment || '', now, 'reviewed', req.params.id);
        addHistory(req.params.id, req.user.id, req.user.full_name, 'بررسی گزارش', comment);
      } else {
        db.prepare('UPDATE security_reports SET supervisor_id = ?, supervisor_comment = ?, supervisor_date = ?, status = ? WHERE id = ?')
          .run(req.user.id, comment || '', now, 'rejected', req.params.id);
        addHistory(req.params.id, req.user.id, req.user.full_name, 'رد گزارش توسط سرپرست', comment);
      }

      notify(report.user_id, 'بروزرسانی وضعیت گزارش حراست', `گزارش شما ${status === 'reviewed' ? 'بررسی شد' : 'رد شد'}`, '/security');

      res.json({ success: true, status });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/approve', (req, res) => {
    try {
      if (!isSupervisorOrManager(req.user)) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }

      const { comment } = req.body;
      const report = db.prepare('SELECT * FROM security_reports WHERE id = ?').get(req.params.id);
      if (!report) return res.status(404).json({ error: 'گزارش یافت نشد' });
      if (report.status !== 'reviewed') {
        return res.status(400).json({ error: 'فقط گزارش‌های بررسی شده قابل تایید هستند' });
      }

      const now = new Date().toISOString();

      db.prepare('UPDATE security_reports SET manager_id = ?, manager_comment = ?, manager_date = ?, status = ? WHERE id = ?')
        .run(req.user.id, comment || '', now, 'approved', req.params.id);

      addHistory(req.params.id, req.user.id, req.user.full_name, 'تایید گزارش توسط مدیر', comment);
      notify(report.user_id, 'تایید گزارش حراست', `گزارش شما توسط مدیر تایید شد`, '/security');

      res.json({ success: true, status: 'approved' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/reject', (req, res) => {
    try {
      if (!isSupervisorOrManager(req.user)) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }

      const { comment } = req.body;
      if (!comment) return res.status(400).json({ error: 'دلیل رد الزامی است' });

      const report = db.prepare('SELECT * FROM security_reports WHERE id = ?').get(req.params.id);
      if (!report) return res.status(404).json({ error: 'گزارش یافت نشد' });
      if (!['pending', 'reviewed'].includes(report.status)) {
        return res.status(400).json({ error: 'امکان رد در این مرحله وجود ندارد' });
      }

      const now = new Date().toISOString();

      if (report.status === 'pending') {
        db.prepare('UPDATE security_reports SET supervisor_id = ?, supervisor_comment = ?, supervisor_date = ?, status = ? WHERE id = ?')
          .run(req.user.id, comment, now, 'rejected', req.params.id);
        addHistory(req.params.id, req.user.id, req.user.full_name, 'رد گزارش توسط سرپرست', comment);
      } else {
        db.prepare('UPDATE security_reports SET manager_id = ?, manager_comment = ?, manager_date = ?, status = ? WHERE id = ?')
          .run(req.user.id, comment, now, 'rejected', req.params.id);
        addHistory(req.params.id, req.user.id, req.user.full_name, 'رد گزارش توسط مدیر', comment);
      }

      notify(report.user_id, 'رد گزارش حراست', `گزارش شما رد شد. دلیل: ${comment}`, '/security');

      res.json({ success: true, status: 'rejected' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id', (req, res) => {
    try {
      const report = db.prepare('SELECT * FROM security_reports WHERE id = ?').get(req.params.id);
      if (!report) return res.status(404).json({ error: 'گزارش یافت نشد' });
      if (report.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      if (!['pending', 'rejected'].includes(report.status)) {
        return res.status(400).json({ error: 'امکان حذف گزارش در این مرحله وجود ندارد' });
      }

      db.prepare('DELETE FROM security_history WHERE request_id = ?').run(req.params.id);
      db.prepare('DELETE FROM security_reports WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
