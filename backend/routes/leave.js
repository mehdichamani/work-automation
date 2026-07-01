const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const moment = require('moment-jalaali');

module.exports = function(db) {
  const router = express.Router();
  router.use(authMiddleware);

  function notify(userId, title, body, link) {
    db.prepare('INSERT INTO notifications (user_id, title, body, link) VALUES (?, ?, ?, ?)').run(userId, title, body, link);
  }

  function calcDays(start, end) {
    const s = moment(start, 'jYYYY/jMM/jDD');
    const e = moment(end, 'jYYYY/jMM/jDD');
    return e.diff(s, 'days') + 1;
  }

  router.get('/subordinates', (req, res) => {
    try {
      if (!['admin', 'manager', 'supervisor'].includes(req.user.role)) {
        return res.json([]);
      }
      let users;
      if (req.user.role === 'supervisor') {
        users = db.prepare(`
          SELECT id, full_name, username, role 
          FROM users 
          WHERE department_id = ? AND id != ? AND is_active = 1
          ORDER BY full_name
        `).all(req.user.department_id, req.user.id);
      } else {
        // admin or manager
        users = db.prepare(`
          SELECT id, full_name, username, role 
          FROM users 
          WHERE id != ? AND is_active = 1
          ORDER BY full_name
        `).all(req.user.id);
      }
      res.json(users);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/my-requests', (req, res) => {
    try {
      const leaves = db.prepare(`
        SELECT l.*, 
               u.full_name as user_name, d.name as user_dept,
               s.full_name as supervisor_name,
               m.full_name as manager_name,
               sec.full_name as security_name
        FROM leave_requests l
        JOIN users u ON l.user_id = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN users s ON l.supervisor_id = s.id
        LEFT JOIN users m ON l.manager_id = m.id
        LEFT JOIN users sec ON l.security_id = sec.id
        WHERE l.user_id = ?
        ORDER BY l.created_at DESC
      `).all(req.user.id);
      res.json(leaves);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/pending-supervisor', (req, res) => {
    try {
      let leaves;
      if (req.user.role === 'admin') {
        leaves = db.prepare(`
          SELECT l.*, u.full_name as user_name, d.name as user_dept
          FROM leave_requests l
          JOIN users u ON l.user_id = u.id
          LEFT JOIN departments d ON u.department_id = d.id
          WHERE l.status = 'pending_supervisor'
          ORDER BY l.created_at DESC
        `).all();
      } else {
        leaves = db.prepare(`
          SELECT l.*, u.full_name as user_name, d.name as user_dept
          FROM leave_requests l
          JOIN users u ON l.user_id = u.id
          LEFT JOIN departments d ON u.department_id = d.id
          WHERE l.status = 'pending_supervisor' AND u.department_id = ?
          ORDER BY l.created_at DESC
        `).all(req.user.department_id);
      }
      res.json(leaves);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/pending-manager', (req, res) => {
    try {
      const leaves = db.prepare(`
        SELECT l.*, u.full_name as user_name, d.name as user_dept, s.full_name as supervisor_name, s_dept.name as supervisor_dept
        FROM leave_requests l
        JOIN users u ON l.user_id = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN users s ON l.supervisor_id = s.id
        LEFT JOIN departments s_dept ON s.department_id = s_dept.id
        WHERE l.status = 'pending_manager'
        ORDER BY l.created_at DESC
      `).all();
      res.json(leaves);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/security', (req, res) => {
    try {
      const leaves = db.prepare(`
        SELECT l.*, u.full_name as user_name, d.name as user_dept
        FROM leave_requests l
        JOIN users u ON l.user_id = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE l.status = 'approved'
        ORDER BY l.created_at DESC
      `).all();
      res.json(leaves);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/all', (req, res) => {
    try {
      const leaves = db.prepare(`
        SELECT l.*, u.full_name as user_name, d.name as user_dept
        FROM leave_requests l
        JOIN users u ON l.user_id = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        ORDER BY l.created_at DESC
      `).all();
      res.json(leaves);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/', (req, res) => {
    try {
      const { user_id, leave_type, start_date, end_date, reason, start_hour, end_hour } = req.body;
      if (!leave_type || !start_date || !end_date) {
        return res.status(400).json({ error: 'فیلدهای مرخصی الزامی است' });
      }

      let targetUserId = req.user.id;
      let targetUser = req.user;
      let initialStatus = 'pending_supervisor';
      let supervisorId = null;
      let supervisorDate = null;
      let managerId = null;
      let managerDate = null;

      const pad = (n) => String(n).padStart(2, '0');
      const getNowString = () => {
        const d = new Date();
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      };

      if (user_id && parseInt(user_id) !== req.user.id) {
        if (!['admin', 'manager', 'supervisor'].includes(req.user.role)) {
          return res.status(403).json({ error: 'شما مجاز به ثبت مرخصی برای دیگران نیستید' });
        }
        
        const u = db.prepare('SELECT id, full_name, department_id, is_active, role FROM users WHERE id = ?').get(user_id);
        if (!u || !u.is_active) {
          return res.status(404).json({ error: 'کاربر مورد نظر یافت نشد یا غیرفعال است' });
        }
        
        if (req.user.role === 'supervisor') {
          if (u.department_id !== req.user.department_id) {
            return res.status(403).json({ error: 'شما فقط می‌توانید برای پرسنل واحد خودتان مرخصی ثبت کنید' });
          }
          targetUserId = u.id;
          targetUser = u;
          initialStatus = 'pending_manager';
          supervisorId = req.user.id;
          supervisorDate = getNowString();
        } else {
          // admin or manager
          targetUserId = u.id;
          targetUser = u;
          initialStatus = 'approved';
          managerId = req.user.id;
          managerDate = getNowString();
        }
      }

      if (leave_type === 'ساعتی') {
        if (!start_hour || !end_hour) {
          return res.status(400).json({ error: 'ساعت شروع و پایان الزامی است' });
        }
        if (start_hour >= end_hour) {
          return res.status(400).json({ error: 'ساعت پایان باید بعد از ساعت شروع باشد' });
        }
        const dayOfWeek = moment(start_date, 'jYYYY/jMM/jDD').day();
        const maxHour = dayOfWeek === 5 ? '12:00' : '17:00';
        if (end_hour > maxHour) {
          return res.status(400).json({ error: `ساعت پایان نمی‌تواند بیشتر از ${maxHour} باشد` });
        }
        if (start_hour < '08:00') {
          return res.status(400).json({ error: 'ساعت شروع نمی‌تواند قبل از ۰۸:۰۰ باشد' });
        }
      }

      const days = leave_type === 'ساعتی' ? 0.5 : calcDays(start_date, end_date);
      if (days <= 0) {
        return res.status(400).json({ error: 'تاریخ پایان باید بعد از تاریخ شروع باشد' });
      }

      const today = moment().format('jYYYY/jMM/jDD');
      if (start_date < today) {
        return res.status(400).json({ error: 'امکان ثبت مرخصی برای تاریخ گذشته وجود ندارد' });
      }

      const balance = db.prepare('SELECT * FROM leave_balance WHERE user_id = ?').get(targetUserId);
      if (balance && (balance.used_days + days) > balance.total_days) {
        return res.status(400).json({ error: `مانده مرخصی کافی نیست. مانده: ${balance.total_days - balance.used_days} روز` });
      }

      const result = db.prepare(`
        INSERT INTO leave_requests (
          user_id, leave_type, start_date, end_date, days_count, reason, status, start_hour, end_hour,
          supervisor_id, supervisor_date, manager_id, manager_date
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        targetUserId,
        leave_type,
        start_date,
        end_date,
        days,
        reason || '',
        initialStatus,
        start_hour || null,
        end_hour || null,
        supervisorId,
        supervisorDate,
        managerId,
        managerDate
      );

      // Notifications
      if (targetUserId !== req.user.id) {
        // Registered by supervisor/manager/admin on behalf of user
        if (req.user.role === 'supervisor') {
          notify(targetUserId, 'ثبت مرخصی توسط سرپرست', `مرخصی برای شما توسط سرپرست (${req.user.full_name}) ثبت گردید و برای تایید مدیر ارسال شد`, '/leave');
          
          // Notify managers
          const managers = db.prepare("SELECT id FROM users WHERE role = 'manager' AND is_active = 1").all();
          managers.forEach(m => {
            notify(m.id, 'درخواست مرخصی جدید', `درخواست مرخصی ثبت شده توسط سرپرست برای ${targetUser.full_name} نیاز به تایید مدیر دارد`, '/leave');
          });
        } else {
          // Registered by manager/admin
          notify(targetUserId, 'ثبت مرخصی توسط مدیریت', `مرخصی برای شما توسط مدیریت (${req.user.full_name}) ثبت و تایید گردید`, '/leave');
        }
      } else {
        // Normal flow (self submission)
        const supervisor = db.prepare("SELECT id FROM users WHERE role = 'supervisor' AND department_id = ? AND is_active = 1").get(req.user.department_id);
        if (supervisor) {
          notify(supervisor.id, 'درخواست مرخصی جدید', `${req.user.full_name} درخواست مرخصی ثبت کرده است`, '/leave');
        }
      }

      res.json({ id: result.lastInsertRowid, message: 'درخواست مرخصی ثبت شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id/edit', (req, res) => {
    try {
      const leave = db.prepare("SELECT * FROM leave_requests WHERE id = ? AND user_id = ? AND status = 'pending_supervisor'").get(req.params.id, req.user.id);
      if (!leave) return res.status(404).json({ error: 'درخواست یافت نشد یا قابل ویرایش نیست' });

      const { leave_type, start_date, end_date, reason, start_hour, end_hour } = req.body;
      if (!leave_type || !start_date || !end_date) {
        return res.status(400).json({ error: 'فیلدهای مرخصی الزامی است' });
      }

      if (leave_type === 'ساعتی') {
        if (!start_hour || !end_hour) {
          return res.status(400).json({ error: 'ساعت شروع و پایان الزامی است' });
        }
        if (start_hour >= end_hour) {
          return res.status(400).json({ error: 'ساعت پایان باید بعد از ساعت شروع باشد' });
        }
        const dayOfWeek = moment(start_date, 'jYYYY/jMM/jDD').day();
        const maxHour = dayOfWeek === 5 ? '12:00' : '17:00';
        if (end_hour > maxHour) {
          return res.status(400).json({ error: `ساعت پایان نمی‌تواند بیشتر از ${maxHour} باشد` });
        }
        if (start_hour < '08:00') {
          return res.status(400).json({ error: 'ساعت شروع نمی‌تواند قبل از ۰۸:۰۰ باشد' });
        }
      }

      const days = leave_type === 'ساعتی' ? 0.5 : calcDays(start_date, end_date);
      if (days <= 0) {
        return res.status(400).json({ error: 'تاریخ پایان باید بعد از تاریخ شروع باشد' });
      }

      const today = moment().format('jYYYY/jMM/jDD');
      if (start_date < today) {
        return res.status(400).json({ error: 'امکان ثبت مرخصی برای تاریخ گذشته وجود ندارد' });
      }

      db.prepare('UPDATE leave_requests SET leave_type = ?, start_date = ?, end_date = ?, days_count = ?, reason = ?, start_hour = ?, end_hour = ? WHERE id = ?')
        .run(leave_type, start_date, end_date, days, reason || '', start_hour || null, end_hour || null, req.params.id);

      res.json({ message: 'درخواست با موفقیت ویرایش شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id/delete', (req, res) => {
    try {
      const leave = db.prepare("SELECT * FROM leave_requests WHERE id = ? AND user_id = ? AND status = 'pending_supervisor'").get(req.params.id, req.user.id);
      if (!leave) return res.status(404).json({ error: 'درخواست یافت نشد یا قابل حذف نیست' });

      db.prepare('DELETE FROM leave_requests WHERE id = ?').run(req.params.id);
      res.json({ message: 'درخواست با موفقیت حذف شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id/admin-delete', (req, res) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'فقط مدیر سیستم می‌تواند مرخصی تایید شده را حذف کند' });
    }
    try {
      const leave = db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(req.params.id);
      if (!leave) return res.status(404).json({ error: 'درخواست یافت نشد' });

      if (['approved', 'seen_security'].includes(leave.status) && leave.days_count > 0) {
        const balanceBefore = db.prepare('SELECT * FROM leave_balance WHERE user_id = ?').get(leave.user_id);
        if (balanceBefore) {
          const newUsed = Math.max(0, balanceBefore.used_days - leave.days_count);
          db.prepare('UPDATE leave_balance SET used_days = ? WHERE user_id = ?').run(newUsed, leave.user_id);
        }
      }

      db.prepare('DELETE FROM leave_requests WHERE id = ?').run(req.params.id);

      notify(leave.user_id, 'حذف درخواست مرخصی', `درخواست مرخصی شما (${leave.start_date} تا ${leave.end_date}) توسط مدیر سیستم حذف شد`, '/leave');

      res.json({ message: 'درخواست مرخصی حذف شد و مانده مرخصی بازگردانده شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id/approve-supervisor', (req, res) => {
    try {
      const { comment } = req.body;
      const leave = db.prepare('SELECT * FROM leave_requests WHERE id = ? AND status = ?').get(req.params.id, 'pending_supervisor');
      if (!leave) return res.status(404).json({ error: 'درخواست یافت نشد' });

      if (req.user.role !== 'admin') {
        const leaveUser = db.prepare('SELECT department_id FROM users WHERE id = ?').get(leave.user_id);
        if (leaveUser && leaveUser.department_id !== req.user.department_id) {
          return res.status(403).json({ error: 'دسترسی غیرمجاز' });
        }
      }

      db.prepare(`
        UPDATE leave_requests SET status = 'pending_manager', supervisor_id = ?, supervisor_comment = ?, supervisor_date = datetime('now')
        WHERE id = ?
      `).run(req.user.id, comment || '', req.params.id);

      notify(leave.user_id, 'تایید سرپرست', `درخواست مرخصی شما توسط سرپرست تایید شد و برای مدیر ارسال شد`, '/leave');

      const managers = db.prepare("SELECT id FROM users WHERE role = 'manager' AND is_active = 1").all();
      managers.forEach(m => {
        notify(m.id, 'درخواست مرخصی جدید', `درخواست مرخصی ${leave.user_id} نیاز به تایید مدیر دارد`, '/leave');
      });

      res.json({ message: 'درخواست توسط سرپرست تایید شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id/reject-supervisor', (req, res) => {
    try {
      const { comment } = req.body;
      const leave = db.prepare("SELECT * FROM leave_requests WHERE id = ? AND status = 'pending_supervisor'").get(req.params.id);
      if (!leave) return res.status(404).json({ error: 'درخواست یافت نشد' });

      db.prepare(`
        UPDATE leave_requests SET status = 'rejected', supervisor_id = ?, supervisor_comment = ?, supervisor_date = datetime('now')
        WHERE id = ?
      `).run(req.user.id, comment || 'رد شده توسط سرپرست', req.params.id);

      notify(leave.user_id, 'رد درخواست مرخصی', `درخواست مرخصی شما توسط سرپرست رد شد`, '/leave');
      res.json({ message: 'درخواست رد شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id/approve-manager', (req, res) => {
    try {
      const { comment } = req.body;
      const leave = db.prepare("SELECT * FROM leave_requests WHERE id = ? AND status = 'pending_manager'").get(req.params.id);
      if (!leave) return res.status(404).json({ error: 'درخواست یافت نشد' });

      db.prepare(`
        UPDATE leave_requests SET status = 'approved', manager_id = ?, manager_comment = ?, manager_date = datetime('now')
        WHERE id = ?
      `).run(req.user.id, comment || '', req.params.id);

      db.prepare('UPDATE leave_balance SET used_days = used_days + ? WHERE user_id = ?').run(leave.days_count, leave.user_id);

      notify(leave.user_id, 'تایید نهایی مرخصی', `مرخصی شما توسط مدیر تایید شد`, '/leave');

      const securityUsers = db.prepare("SELECT u.id FROM users u JOIN departments d ON u.department_id = d.id WHERE d.name LIKE '%حراست%' AND u.is_active = 1").all();
      securityUsers.forEach(s => {
        notify(s.id, 'مرخصی تایید شده', `مرخصی کاربر ${leave.user_id} تایید شده - لطفاً مشاهده کنید`, '/leave');
      });

      res.json({ message: 'مرخصی توسط مدیر تایید شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id/reject-manager', (req, res) => {
    try {
      const { comment } = req.body;
      const leave = db.prepare("SELECT * FROM leave_requests WHERE id = ? AND status = 'pending_manager'").get(req.params.id);
      if (!leave) return res.status(404).json({ error: 'درخواست یافت نشد' });

      db.prepare(`
        UPDATE leave_requests SET status = 'rejected', manager_id = ?, manager_comment = ?, manager_date = datetime('now')
        WHERE id = ?
      `).run(req.user.id, comment || 'رد شده توسط مدیر', req.params.id);

      notify(leave.user_id, 'رد درخواست مرخصی', `درخواست مرخصی شما توسط مدیر رد شد`, '/leave');
      res.json({ message: 'درخواست رد شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id/seen-security', (req, res) => {
    try {
      const leave = db.prepare("SELECT * FROM leave_requests WHERE id = ? AND status = 'approved'").get(req.params.id);
      if (!leave) return res.status(404).json({ error: 'درخواست یافت نشد' });

      db.prepare(`
        UPDATE leave_requests SET status = 'seen_security', security_id = ?, security_date = datetime('now')
        WHERE id = ?
      `).run(req.user.id, req.params.id);

      res.json({ message: 'مرخصی رویت شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/balance', (req, res) => {
    try {
      const balance = db.prepare('SELECT * FROM leave_balance WHERE user_id = ?').get(req.user.id);
      if (!balance) {
        db.prepare('INSERT INTO leave_balance (user_id, total_days, used_days) VALUES (?, 26, 0)').run(req.user.id);
        return res.json({ total_days: 26, used_days: 0, remaining_days: 26 });
      }
      res.json({ ...balance, remaining_days: balance.total_days - balance.used_days });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/balance-all', (req, res) => {
    try {
      const balances = db.prepare(`
        SELECT lb.*, u.full_name, u.department_id, d.name as department_name
        FROM leave_balance lb
        JOIN users u ON lb.user_id = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.is_active = 1
        ORDER BY d.name, u.full_name
      `).all();
      res.json(balances.map(b => ({ ...b, remaining_days: b.total_days - b.used_days })));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/balance/:userId', (req, res) => {
    try {
      const { total_days, used_days } = req.body;
      const existing = db.prepare('SELECT * FROM leave_balance WHERE user_id = ?').get(req.params.userId);
      if (existing) {
        db.prepare('UPDATE leave_balance SET total_days = ?, used_days = ? WHERE user_id = ?')
          .run(total_days, used_days, req.params.userId);
      } else {
        db.prepare('INSERT INTO leave_balance (user_id, total_days, used_days) VALUES (?, ?, ?)')
          .run(req.params.userId, total_days, used_days);
      }
      res.json({ message: 'مانده مرخصی بروزرسانی شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
