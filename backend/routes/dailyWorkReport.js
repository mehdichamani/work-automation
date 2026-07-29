const express = require('express');
const { authMiddleware, roleGuard } = require('../middleware/auth');

module.exports = function(db) {
  const router = express.Router();
  router.use(authMiddleware);

  function notify(userId, title, body, link) {
    db.prepare('INSERT INTO notifications (user_id, title, body, link) VALUES (?, ?, ?, ?)').run(userId, title, body, link);
  }

  function addHistory(reportId, userId, userName, action, comment) {
    db.prepare('INSERT INTO daily_work_report_history (report_id, user_id, user_name, action, comment) VALUES (?, ?, ?, ?, ?)').run(reportId, userId, userName, action, comment || '');
  }

  // ---------- لیست گزارش‌ها ----------
  router.get('/', (req, res) => {
    try {
      const { status, page = 1, limit = 50 } = req.query;
      const offset = (page - 1) * limit;
      let where = '';
      const params = [];

      if (req.user.role === 'user') {
        where = 'WHERE d.user_id = ?';
        params.push(req.user.id);
      } else if (req.user.role === 'supervisor') {
        where = 'WHERE (d.user_id = ? OR d.department_id = ?)';
        params.push(req.user.id, req.user.department_id);
      }

      if (status) {
        where += (where ? ' AND ' : 'WHERE ') + 'd.status = ?';
        params.push(status);
      }

      const total = db.prepare(`SELECT COUNT(*) as count FROM daily_work_reports d ${where}`).get(...params).count;
      const reports = db.prepare(`
        SELECT d.*, u.full_name as user_name, dep.name as department_name,
               cb.full_name as central_name, mb.full_name as manager_name, pb.full_name as project_control_name
        FROM daily_work_reports d
        LEFT JOIN users u ON d.user_id = u.id
        LEFT JOIN departments dep ON d.department_id = dep.id
        LEFT JOIN users cb ON d.central_by = cb.id
        LEFT JOIN users mb ON d.manager_by = mb.id
        LEFT JOIN users pb ON d.project_control_by = pb.id
        ${where}
        ORDER BY d.created_at DESC
        LIMIT ? OFFSET ?
      `).all(...params, parseInt(limit), parseInt(offset));

      res.json({ reports, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------- گزارش‌های من ----------
  router.get('/my', (req, res) => {
    try {
      const reports = db.prepare(`
        SELECT d.*, u.full_name as user_name, dep.name as department_name
        FROM daily_work_reports d
        LEFT JOIN users u ON d.user_id = u.id
        LEFT JOIN departments dep ON d.department_id = dep.id
        WHERE d.user_id = ?
        ORDER BY d.created_at DESC
      `).all(req.user.id);
      res.json(reports);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------- ثبت گزارش جدید ----------
  router.post('/', (req, res) => {
    try {
      const { report_date, work_description, work_duration } = req.body;
      if (!report_date || !work_description) {
        return res.status(400).json({ error: 'تاریخ و شرح کار الزامی است' });
      }

      const result = db.prepare(`
        INSERT INTO daily_work_reports (user_id, report_date, work_description, work_duration, department_id, status)
        VALUES (?, ?, ?, ?, ?, 'pending_central')
      `).run(req.user.id, report_date, work_description, work_duration || '', req.user.department_id || null);

      addHistory(result.lastInsertRowid, req.user.id, req.user.full_name, 'ثبت گزارش', null);

      const centralUsers = db.prepare("SELECT id FROM users WHERE role = 'admin' OR role = 'manager' LIMIT 5").all();
      centralUsers.forEach(u => {
        notify(u.id, 'گزارش کار جدید', `گزارش کار روزانه توسط ${req.user.full_name} ثبت شد`, '/daily-work-report');
      });

      res.json({ id: result.lastInsertRowid, success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------- مشاهده یک گزارش ----------
  router.get('/:id', (req, res) => {
    try {
      const report = db.prepare(`
        SELECT d.*, u.full_name as user_name, dep.name as department_name,
               cb.full_name as central_name, mb.full_name as manager_name, pb.full_name as project_control_name
        FROM daily_work_reports d
        LEFT JOIN users u ON d.user_id = u.id
        LEFT JOIN departments dep ON d.department_id = dep.id
        LEFT JOIN users cb ON d.central_by = cb.id
        LEFT JOIN users mb ON d.manager_by = mb.id
        LEFT JOIN users pb ON d.project_control_by = pb.id
        WHERE d.id = ?
      `).get(req.params.id);
      if (!report) return res.status(404).json({ error: 'گزارش یافت نشد' });

      const history = db.prepare('SELECT * FROM daily_work_report_history WHERE report_id = ? ORDER BY created_at ASC').all(req.params.id);

      res.json({ report, history });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------- سانترال: تایید اولیه → ارسال به مدیر ----------
  router.post('/:id/central-approve', (req, res) => {
    try {
      const { comment } = req.body;
      const report = db.prepare('SELECT * FROM daily_work_reports WHERE id = ?').get(req.params.id);
      if (!report) return res.status(404).json({ error: 'گزارش یافت نشد' });
      if (report.status !== 'pending_central') return res.status(400).json({ error: 'وضعیت فعلی مناسب نیست' });

      db.prepare(`UPDATE daily_work_reports SET status = 'pending_manager', central_comment = ?, central_by = ?, central_at = to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text), updated_at = to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text) WHERE id = ?`)
        .run(comment || '', req.user.id, req.params.id);

      addHistory(req.params.id, req.user.id, req.user.full_name, 'سانترال: ارسال به مدیریت', comment);
      notify(report.user_id, 'ارسال به مدیریت', `گزارش کار شما توسط سانترال به مدیریت ارسال شد`, '/daily-work-report');

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------- سانترال: رد گزارش ----------
  router.post('/:id/central-reject', (req, res) => {
    try {
      const { comment } = req.body;
      if (!comment) return res.status(400).json({ error: 'دلیل رد الزامی است' });
      const report = db.prepare('SELECT * FROM daily_work_reports WHERE id = ?').get(req.params.id);
      if (!report) return res.status(404).json({ error: 'گزارش یافت نشد' });

      db.prepare(`UPDATE daily_work_reports SET status = 'rejected_by_central', central_comment = ?, central_by = ?, central_at = to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text), updated_at = to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text) WHERE id = ?`)
        .run(comment, req.user.id, req.params.id);

      addHistory(req.params.id, req.user.id, req.user.full_name, 'سانترال: رد', comment);
      notify(report.user_id, 'گزارش رد شد', `گزارش کار شما توسط سانترال رد شد`, '/daily-work-report');

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------- مدیر: تایید → برگشت به سانترال ----------
  router.post('/:id/manager-approve', (req, res) => {
    try {
      const { comment } = req.body;
      const report = db.prepare('SELECT * FROM daily_work_reports WHERE id = ?').get(req.params.id);
      if (!report) return res.status(404).json({ error: 'گزارش یافت نشد' });
      if (report.status !== 'pending_manager') return res.status(400).json({ error: 'گزارش هنوز به مدیریت نرسیده' });

      db.prepare(`UPDATE daily_work_reports SET status = 'manager_approved', manager_comment = ?, manager_by = ?, manager_at = to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text), updated_at = to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text) WHERE id = ?`)
        .run(comment || '', req.user.id, req.params.id);

      addHistory(req.params.id, req.user.id, req.user.full_name, 'مدیر: تایید', comment);

      const centralUsers = db.prepare("SELECT id FROM users WHERE role = 'admin' OR role = 'manager' LIMIT 5").all();
      centralUsers.forEach(u => {
        notify(u.id, 'تایید مدیریت', `گزارش کار ${report.report_date} توسط مدیر تایید شد - ارجاع به کنترل پروژه`, '/daily-work-report');
      });
      notify(report.user_id, 'گزارش تایید شد', `گزارش کار شما توسط مدیر تایید شد`, '/daily-work-report');

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------- مدیر: رد ----------
  router.post('/:id/manager-reject', (req, res) => {
    try {
      const { comment } = req.body;
      if (!comment) return res.status(400).json({ error: 'دلیل رد الزامی است' });
      const report = db.prepare('SELECT * FROM daily_work_reports WHERE id = ?').get(req.params.id);
      if (!report) return res.status(404).json({ error: 'گزارش یافت نشد' });

      db.prepare(`UPDATE daily_work_reports SET status = 'rejected_by_manager', manager_comment = ?, manager_by = ?, manager_at = to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text), updated_at = to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text) WHERE id = ?`)
        .run(comment, req.user.id, req.params.id);

      addHistory(req.params.id, req.user.id, req.user.full_name, 'مدیر: رد', comment);
      notify(report.user_id, 'گزارش رد شد', `گزارش کار شما توسط مدیر رد شد`, '/daily-work-report');

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------- سانترال: ارجاع به کنترل پروژه ----------
  router.post('/:id/forward-to-project-control', (req, res) => {
    try {
      const { comment } = req.body;
      const report = db.prepare('SELECT * FROM daily_work_reports WHERE id = ?').get(req.params.id);
      if (!report) return res.status(404).json({ error: 'گزارش یافت نشد' });
      if (report.status !== 'manager_approved') return res.status(400).json({ error: 'گزارش هنوز تایید مدیر را ندارد' });

      db.prepare(`UPDATE daily_work_reports SET status = 'pending_project_control', updated_at = to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text) WHERE id = ?`)
        .run(req.params.id);

      addHistory(req.params.id, req.user.id, req.user.full_name, 'سانترال: ارجاع به کنترل پروژه', comment);

      const pcUsers = db.prepare("SELECT id FROM users WHERE role = 'supervisor' OR role = 'manager' LIMIT 5").all();
      pcUsers.forEach(u => {
        notify(u.id, 'ارجاع به کنترل پروژه', `گزارش کار ${report.report_date} از سانترال ارجاع داده شد`, '/daily-work-report');
      });

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------- کنترل پروژه: تایید نهایی ----------
  router.post('/:id/project-control-approve', (req, res) => {
    try {
      const { comment } = req.body;
      const report = db.prepare('SELECT * FROM daily_work_reports WHERE id = ?').get(req.params.id);
      if (!report) return res.status(404).json({ error: 'گزارش یافت نشد' });
      if (report.status !== 'pending_project_control') return res.status(400).json({ error: 'گزارش به کنترل پروژه نرسیده' });

      db.prepare(`UPDATE daily_work_reports SET status = 'completed', project_control_comment = ?, project_control_by = ?, project_control_at = to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text), updated_at = to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text) WHERE id = ?`)
        .run(comment || '', req.user.id, req.params.id);

      addHistory(req.params.id, req.user.id, req.user.full_name, 'کنترل پروژه: تایید نهایی', comment);
      notify(report.user_id, 'تایید نهایی', `گزارش کار شما توسط کنترل پروژه تایید نهایی شد`, '/daily-work-report');

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------- حذف ----------
  router.delete('/:id', (req, res) => {
    try {
      const report = db.prepare('SELECT * FROM daily_work_reports WHERE id = ?').get(req.params.id);
      if (!report) return res.status(404).json({ error: 'گزارش یافت نشد' });
      if (report.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      if (report.status !== 'pending_central') {
        return res.status(400).json({ error: 'فقط گزارش‌های در انتظار سانترال قابل حذف هستند' });
      }
      db.prepare('DELETE FROM daily_work_report_history WHERE report_id = ?').run(req.params.id);
      db.prepare('DELETE FROM daily_work_reports WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
