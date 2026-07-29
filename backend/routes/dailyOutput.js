const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { dailyOutput } = require('../middleware/validate');

module.exports = function (db) {
  const router = express.Router();
  router.use(authMiddleware);

  function notify(userId, title, body, link) {
    db.prepare('INSERT INTO notifications (user_id, title, body, link) VALUES (?, ?, ?, ?)').run(userId, title, body, link);
  }

  function addHistory(reportId, userId, userName, action, comment) {
    db.prepare('INSERT INTO daily_output_history (request_id, user_id, user_name, action, comment) VALUES (?, ?, ?, ?, ?)').run(reportId, userId, userName, action, comment || '');
  }

  function findSupervisorId(departmentId) {
    if (!departmentId) return null;
    const dept = db.prepare('SELECT parent_id FROM departments WHERE id = ?').get(departmentId);
    if (!dept || !dept.parent_id) return null;
    const sup = db.prepare('SELECT id FROM users WHERE department_id = ? AND role = ? LIMIT 1').get(dept.parent_id, 'supervisor');
    return sup ? sup.id : null;
  }

  function isProduction(user) {
    if (user.role === 'admin') return true;
    const dept = db.prepare('SELECT name FROM departments WHERE id = ?').get(user.department_id);
    return dept && (dept.name.includes('تولید') || dept.name.includes('فنی'));
  }

  router.get('/', (req, res) => {
    try {
      const { date, status, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;
      let where = '';
      const params = [];

      if (!isProduction(req.user)) {
        where = 'WHERE d.user_id = ?';
        params.push(req.user.id);
      }

      if (date) {
        where += (where ? ' AND ' : 'WHERE ') + 'd.report_date = ?';
        params.push(date);
      }

      if (status) {
        where += (where ? ' AND ' : 'WHERE ') + 'd.status = ?';
        params.push(status);
      }

      const total = db.prepare(`SELECT COUNT(*) as count FROM daily_output d ${where}`).get(...params).count;
      const reports = db.prepare(`
        SELECT d.*, u.full_name as user_name, dept.name as department_name
        FROM daily_output d
        LEFT JOIN users u ON d.user_id = u.id
        LEFT JOIN departments dept ON d.department_id = dept.id
        ${where}
        ORDER BY d.report_date DESC
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
        SELECT d.*, u.full_name as user_name, dept.name as department_name
        FROM daily_output d
        LEFT JOIN users u ON d.user_id = u.id
        LEFT JOIN departments dept ON d.department_id = dept.id
        WHERE d.user_id = ?
        ORDER BY d.report_date DESC
      `).all(req.user.id);
      res.json(reports);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/summary', (req, res) => {
    try {
      const { from_date, to_date } = req.query;
      let where = '';
      const params = [];

      if (from_date) {
        where += 'AND d.report_date >= ?';
        params.push(from_date);
      }
      if (to_date) {
        where += 'AND d.report_date <= ?';
        params.push(to_date);
      }

      const summary = db.prepare(`
        SELECT d.product_name, SUM(d.quantity) as total_quantity, AVG(d.quality_score) as avg_quality
        FROM daily_output d
        WHERE 1=1 ${where}
        GROUP BY d.product_name
        ORDER BY total_quantity DESC
      `).all(...params);

      res.json(summary);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/pending-review', (req, res) => {
    try {
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      let where = "WHERE 1=1";
      const params = [];

      if (req.user.role === 'supervisor') {
        where += " AND d.status = 'pending'";
      } else if (req.user.role === 'manager') {
        where += " AND d.status = 'pending'";
      } else if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }

      const total = db.prepare(`SELECT COUNT(*) as count FROM daily_output d ${where}`).get(...params).count;
      const reports = db.prepare(`
        SELECT d.*, u.full_name as user_name, dept.name as department_name
        FROM daily_output d
        LEFT JOIN users u ON d.user_id = u.id
        LEFT JOIN departments dept ON d.department_id = dept.id
        ${where}
        ORDER BY d.created_at ASC
        LIMIT ? OFFSET ?
      `).all(...params, parseInt(limit), parseInt(offset));

      res.json({ reports, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/:id', (req, res) => {
    try {
      const report = db.prepare(`
        SELECT d.*, u.full_name as user_name, dept.name as department_name
        FROM daily_output d
        LEFT JOIN users u ON d.user_id = u.id
        LEFT JOIN departments dept ON d.department_id = dept.id
        WHERE d.id = ?
      `).get(req.params.id);

      if (!report) return res.status(404).json({ error: 'گزارش یافت نشد' });

      const history = db.prepare('SELECT * FROM daily_output_history WHERE request_id = ? ORDER BY created_at ASC').all(req.params.id);

      res.json({ report, history });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/', dailyOutput, (req, res) => {
    try {
      const { report_date, product_name, quantity, unit, quality_score, description, machine_number } = req.body;
      if (!report_date || !product_name || quantity === undefined) {
        return res.status(400).json({ error: 'تاریخ، نام محصول و تعداد الزامی است' });
      }

      const user = db.prepare('SELECT department_id FROM users WHERE id = ?').get(req.user.id);
      const supervisorId = findSupervisorId(user?.department_id);

      const result = db.prepare(`
        INSERT INTO daily_output (user_id, department_id, report_date, product_name, quantity, unit, quality_score, description, machine_number, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(req.user.id, user?.department_id, report_date, product_name, quantity, unit || 'عدد', quality_score || null, description || '', machine_number || '', 'pending');

      addHistory(result.lastInsertRowid, req.user.id, req.user.full_name, 'ثبت گزارش', null);

      if (supervisorId) {
        notify(supervisorId, 'گزارش تولید روزانه جدید', `گزارش توسط ${req.user.full_name} ثبت شد و نیاز به بررسی دارد`, '/daily-output');
      }

      res.json({ id: result.lastInsertRowid, message: 'گزارش ثبت شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/review', (req, res) => {
    try {
      const { comment } = req.body;
      const report = db.prepare('SELECT * FROM daily_output WHERE id = ?').get(req.params.id);
      if (!report) return res.status(404).json({ error: 'گزارش یافت نشد' });
      if (report.status !== 'pending') {
        return res.status(400).json({ error: 'این گزارش قبلاً بررسی شده است' });
      }

      if (req.user.role !== 'supervisor' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'فقط سرپرست می‌تواند گزارش را بررسی کند' });
      }

      db.prepare('UPDATE daily_output SET status = ?, supervisor_id = ?, supervisor_comment = ?, supervisor_date = ? WHERE id = ?')
        .run('reviewed', req.user.id, comment || '', new Date().toISOString(), req.params.id);

      addHistory(req.params.id, req.user.id, req.user.full_name, 'بررسی توسط سرپرست', comment);

      notify(report.user_id, 'گزارش بررسی شد', `گزارش تولید روزانه شما توسط سرپرست بررسی شد`, '/daily-output');

      res.json({ success: true, status: 'reviewed' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/approve', (req, res) => {
    try {
      const { comment } = req.body;
      const report = db.prepare('SELECT * FROM daily_output WHERE id = ?').get(req.params.id);
      if (!report) return res.status(404).json({ error: 'گزارش یافت نشد' });
      if (report.status !== 'reviewed') {
        return res.status(400).json({ error: 'گزارش باید ابتدا توسط سرپرست بررسی شود' });
      }

      if (req.user.role !== 'manager' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'فقط مدیر می‌تواند گزارش را تایید کند' });
      }

      db.prepare('UPDATE daily_output SET status = ?, manager_id = ?, manager_comment = ?, manager_date = ? WHERE id = ?')
        .run('approved', req.user.id, comment || '', new Date().toISOString(), req.params.id);

      addHistory(req.params.id, req.user.id, req.user.full_name, 'تایید توسط مدیر', comment);

      notify(report.user_id, 'گزارش تایید شد', `گزارش تولید روزانه شما توسط مدیر تایید شد`, '/daily-output');

      res.json({ success: true, status: 'approved' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/reject', (req, res) => {
    try {
      const { comment } = req.body;
      const report = db.prepare('SELECT * FROM daily_output WHERE id = ?').get(req.params.id);
      if (!report) return res.status(404).json({ error: 'گزارش یافت نشد' });
      if (!comment) return res.status(400).json({ error: 'دلیل رد الزامی است' });
      if (!['pending', 'reviewed'].includes(report.status)) {
        return res.status(400).json({ error: 'این گزارش قبلاً بررسی شده است' });
      }

      if (req.user.role !== 'supervisor' && req.user.role !== 'manager' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }

      const isSupervisor = req.user.role === 'supervisor';
      const action = isSupervisor ? 'رد توسط سرپرست' : 'رد توسط مدیر';

      if (isSupervisor) {
        db.prepare('UPDATE daily_output SET status = ?, supervisor_id = ?, supervisor_comment = ?, supervisor_date = ? WHERE id = ?')
          .run('rejected', req.user.id, comment, new Date().toISOString(), req.params.id);
      } else {
        db.prepare('UPDATE daily_output SET status = ?, manager_id = ?, manager_comment = ?, manager_date = ? WHERE id = ?')
          .run('rejected', req.user.id, comment, new Date().toISOString(), req.params.id);
      }

      addHistory(req.params.id, req.user.id, req.user.full_name, action, comment);

      notify(report.user_id, 'گزارش رد شد', `گزارش تولید روزانه شما رد شد. دلیل: ${comment}`, '/daily-output');

      res.json({ success: true, status: 'rejected' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id', (req, res) => {
    try {
      const report = db.prepare('SELECT * FROM daily_output WHERE id = ?').get(req.params.id);
      if (!report) return res.status(404).json({ error: 'گزارش یافت نشد' });

      if (report.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }

      if (!['pending'].includes(report.status)) {
        return res.status(400).json({ error: 'امکان ویرایش در این مرحله وجود ندارد' });
      }

      const { product_name, quantity, unit, quality_score, description, machine_number } = req.body;

      db.prepare('UPDATE daily_output SET product_name = ?, quantity = ?, unit = ?, quality_score = ?, description = ?, machine_number = ? WHERE id = ?')
        .run(product_name || report.product_name, quantity || report.quantity, unit || report.unit, quality_score || report.quality_score, description || report.description, machine_number || report.machine_number, req.params.id);

      addHistory(req.params.id, req.user.id, req.user.full_name, 'ویرایش گزارش', null);

      res.json({ message: 'گزارش بروزرسانی شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id', (req, res) => {
    try {
      const report = db.prepare('SELECT * FROM daily_output WHERE id = ?').get(req.params.id);
      if (!report) return res.status(404).json({ error: 'گزارش یافت نشد' });
      if (report.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      if (!['pending'].includes(report.status)) {
        return res.status(400).json({ error: 'امکان حذف در این مرحله وجود ندارد' });
      }

      db.prepare('DELETE FROM daily_output_history WHERE request_id = ?').run(req.params.id);
      db.prepare('DELETE FROM daily_output WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
