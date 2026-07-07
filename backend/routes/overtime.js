const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const moment = require('moment-jalaali');

module.exports = function(db) {
  const router = express.Router();
  router.use(authMiddleware);

  function notify(userId, title, body, link) {
    db.prepare('INSERT INTO notifications (user_id, title, body, link) VALUES (?, ?, ?, ?)').run(userId, title, body, link);
  }

  function hasOvertimePerm(user, moduleKey) {
    if (user.role === 'admin') return true;
    const userPerm = db.prepare('SELECT is_enabled FROM permissions WHERE user_id = ? AND module_key = ?').get(user.id, moduleKey);
    if (userPerm !== null && userPerm !== undefined) {
      return userPerm.is_enabled === 1;
    }
    if (user.department_id) {
      const deptPerm = db.prepare('SELECT is_enabled FROM permissions WHERE department_id = ? AND user_id IS NULL AND module_key = ?').get(user.department_id, moduleKey);
      if (deptPerm !== null && deptPerm !== undefined) {
        return deptPerm.is_enabled === 1;
      }
    }
    return false;
  }

  function calcDays(start, end) {
    const s = moment(start, 'jYYYY/jMM/jDD');
    const e = moment(end, 'jYYYY/jMM/jDD');
    return e.diff(s, 'days') + 1;
  }

  function mapOvertime(o) {
    if (!o) return o;
    const days = Math.floor(o.hours_count / 8);
    const hrs = o.hours_count % 8;
    let formatted = '';
    if (days > 0) formatted += `${days} روز`;
    if (hrs > 0) formatted += `${formatted ? ' و ' : ''}${hrs} ساعت`;
    if (!formatted) formatted = '0 ساعت';
    return { ...o, days_count: formatted, raw_hours: o.hours_count };
  }

  router.get('/subordinates', (req, res) => {
    try {
      if (!['admin', 'manager', 'supervisor'].includes(req.user.role)) {
        return res.json([]);
      }
      let users;
      if (req.user.role === 'supervisor') {
        users = db.prepare(`
          SELECT id, full_name, role 
          FROM users 
          WHERE department_id = ? AND id != ? AND is_active = 1 AND work_type != 'shift'
          ORDER BY full_name
        `).all(req.user.department_id, req.user.id);
      } else {
        // admin or manager
        users = db.prepare(`
          SELECT id, full_name, role 
          FROM users 
          WHERE id != ? AND is_active = 1 AND work_type != 'shift'
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
      const requests = db.prepare(`
        SELECT o.*, 
               u.full_name as user_name, d.name as user_dept,
               s.full_name as supervisor_name,
               m.full_name as manager_name,
               sec.full_name as security_name,
               ed.full_name as editor_name
        FROM overtime_requests o
        JOIN users u ON o.user_id = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN users s ON o.supervisor_id = s.id
        LEFT JOIN users m ON o.manager_id = m.id
        LEFT JOIN users sec ON o.security_id = sec.id
        LEFT JOIN users ed ON o.edited_by = ed.id
        WHERE o.user_id = ?
        ORDER BY o.created_at DESC
      `).all(req.user.id);
      res.json(requests.map(mapOvertime));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/pending-supervisor', (req, res) => {
    try {
      let requests;
      if (req.user.role === 'admin') {
        requests = db.prepare(`
          SELECT o.*, u.full_name as user_name, d.name as user_dept
          FROM overtime_requests o
          JOIN users u ON o.user_id = u.id
          LEFT JOIN departments d ON u.department_id = d.id
          WHERE o.status = 'pending_supervisor'
          ORDER BY o.created_at DESC
        `).all();
      } else {
        requests = db.prepare(`
          SELECT o.*, u.full_name as user_name, d.name as user_dept
          FROM overtime_requests o
          JOIN users u ON o.user_id = u.id
          LEFT JOIN departments d ON u.department_id = d.id
          WHERE o.status = 'pending_supervisor' AND u.department_id = ?
          ORDER BY o.created_at DESC
        `).all(req.user.department_id);
      }
      res.json(requests.map(mapOvertime));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/pending-manager', (req, res) => {
    try {
      const requests = db.prepare(`
        SELECT o.*, u.full_name as user_name, d.name as user_dept,
               s.full_name as supervisor_name, s_dept.name as supervisor_dept
        FROM overtime_requests o
        JOIN users u ON o.user_id = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN users s ON o.supervisor_id = s.id
        LEFT JOIN departments s_dept ON s.department_id = s_dept.id
        WHERE o.status = 'pending_manager'
        ORDER BY o.created_at DESC
      `).all();
      res.json(requests.map(mapOvertime));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/security', (req, res) => {
    if (!hasOvertimePerm(req.user, 'overtime_security_view')) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز - شما دسترسی رویت حراست اضافه کار را ندارید' });
    }
    try {
      const requests = db.prepare(`
        SELECT o.*, u.full_name as user_name, d.name as user_dept,
               s.full_name as supervisor_name,
               m.full_name as manager_name
        FROM overtime_requests o
        JOIN users u ON o.user_id = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN users s ON o.supervisor_id = s.id
        LEFT JOIN users m ON o.manager_id = m.id
        WHERE o.status = 'approved'
        ORDER BY o.created_at DESC
      `).all();
      res.json(requests.map(mapOvertime));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/all', (req, res) => {
    try {
      let requests;
      if (req.user.role === 'admin' || req.user.role === 'manager' || hasOvertimePerm(req.user, 'overtime_edit_after_seen')) {
        requests = db.prepare(`
          SELECT o.*, u.full_name as user_name, d.name as user_dept,
                 s.full_name as supervisor_name,
                 m.full_name as manager_name,
                 sec.full_name as security_name,
                 ed.full_name as editor_name
          FROM overtime_requests o
          JOIN users u ON o.user_id = u.id
          LEFT JOIN departments d ON u.department_id = d.id
          LEFT JOIN users s ON o.supervisor_id = s.id
          LEFT JOIN users m ON o.manager_id = m.id
          LEFT JOIN users sec ON o.security_id = sec.id
          LEFT JOIN users ed ON o.edited_by = ed.id
          ORDER BY o.created_at DESC
        `).all();
      } else if (req.user.role === 'supervisor') {
        requests = db.prepare(`
          SELECT o.*, u.full_name as user_name, d.name as user_dept,
                 s.full_name as supervisor_name,
                 m.full_name as manager_name,
                 sec.full_name as security_name,
                 ed.full_name as editor_name
          FROM overtime_requests o
          JOIN users u ON o.user_id = u.id
          LEFT JOIN departments d ON u.department_id = d.id
          LEFT JOIN users s ON o.supervisor_id = s.id
          LEFT JOIN users m ON o.manager_id = m.id
          LEFT JOIN users sec ON o.security_id = sec.id
          LEFT JOIN users ed ON o.edited_by = ed.id
          WHERE u.department_id = ? AND u.role != 'admin'
          ORDER BY o.created_at DESC
        `).all(req.user.department_id);
      } else {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      res.json(requests.map(mapOvertime));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/', (req, res) => {
    try {
      const { user_id, start_date, start_time, end_date, end_time, reason } = req.body;
      if (!start_date || !start_time || !end_date || !end_time) {
        return res.status(400).json({ error: 'تمام فیلدهای تاریخ و ساعت شروع و پایان الزامی هستند' });
      }

      let targetUserId = req.user.id;
      let targetUser = req.user;
      let initialStatus = 'pending_supervisor';
      let supervisorId = null;
      let supervisorDate = null;
      let managerId = null;
      let managerDate = null;
      
      const userTypeCheck = db.prepare("SELECT work_type FROM users WHERE id = ?").get(req.user.id);
      if (userTypeCheck && userTypeCheck.work_type === 'shift' && (!user_id || parseInt(user_id) === req.user.id)) {
        return res.status(400).json({ error: 'کاربران شیفتی مجاز به ثبت درخواست اضافه کار نیستند' });
      }

      const pad = (n) => String(n).padStart(2, '0');
      const getNowString = () => {
        const d = new Date();
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      };

      if (user_id && parseInt(user_id) !== req.user.id) {
        if (!['admin', 'manager', 'supervisor'].includes(req.user.role)) {
          return res.status(403).json({ error: 'شما مجاز به ثبت اضافه کار برای دیگران نیستید' });
        }
        
        const u = db.prepare('SELECT id, full_name, department_id, is_active, role, work_type FROM users WHERE id = ?').get(user_id);
        if (!u || !u.is_active) {
          return res.status(404).json({ error: 'کاربر مورد نظر یافت نشد یا غیرفعال است' });
        }
        
        if (u.work_type === 'shift') {
          return res.status(400).json({ error: 'کاربر مورد نظر شیفتی بوده و مجاز به ثبت درخواست اضافه کار نمی‌باشد' });
        }
        
        if (req.user.role === 'supervisor') {
          if (u.department_id !== req.user.department_id) {
            return res.status(403).json({ error: 'شما فقط می‌توانید برای پرسنل واحد خودتان اضافه کار ثبت کنید' });
          }
          targetUserId = u.id;
          targetUser = u;
          initialStatus = 'pending_manager'; // Direct to manager if supervisor registers for subordinate
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
      } else {
        // Requesting for themselves
        if (req.user.role === 'supervisor') {
          initialStatus = 'pending_manager';
        } else if (req.user.role === 'admin' || req.user.role === 'manager') {
          initialStatus = 'approved';
          managerId = req.user.id;
          managerDate = getNowString();
        }
      }

      const today = moment().format('jYYYY/jMM/jDD');
      if (start_date < today && req.user.role !== 'admin') {
        return res.status(400).json({ error: 'امکان ثبت اضافه کار برای تاریخ گذشته وجود ندارد' });
      }

      // Check for overlapping/duplicate requests
      const existingRequests = db.prepare(`
        SELECT id, start_date, start_hour, end_date, end_hour, status
        FROM overtime_requests
        WHERE user_id = ? AND status != 'rejected'
      `).all(targetUserId);

      const newStart = moment(`${start_date} ${start_time}`, 'jYYYY/jMM/jDD HH:mm');
      const newEnd = moment(`${end_date} ${end_time}`, 'jYYYY/jMM/jDD HH:mm');

      for (const reqOfUser of existingRequests) {
        const reqStart = moment(`${reqOfUser.start_date} ${reqOfUser.start_hour}`, 'jYYYY/jMM/jDD HH:mm');
        const reqEnd = moment(`${reqOfUser.end_date} ${reqOfUser.end_hour}`, 'jYYYY/jMM/jDD HH:mm');
        
        if (newStart.isBefore(reqEnd) && reqStart.isBefore(newEnd)) {
          const userMsg = targetUserId === req.user.id ? 'قبلی شما' : 'قبلی این کاربر';
          return res.status(400).json({ error: `این درخواست با یکی از درخواست‌های اضافه کار ${userMsg} همپوشانی دارد (${reqOfUser.start_date} تا ${reqOfUser.end_date})` });
        }
      }

      const overtimeHours = calculateOvertimeHours(start_date, start_time, end_date, end_time);
      if (overtimeHours <= 0) {
        return res.status(400).json({ error: 'زمان انتخاب شده در ساعات اضافه کار معتبر یا روزهای تعطیل قرار ندارد' });
      }

      const result = db.prepare(`
        INSERT INTO overtime_requests (
          user_id, start_date, end_date, hours_count, reason, status, start_hour, end_hour,
          supervisor_id, supervisor_date, manager_id, manager_date
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        targetUserId,
        start_date,
        end_date,
        overtimeHours,
        reason || '',
        initialStatus,
        start_time,
        end_time,
        supervisorId,
        supervisorDate,
        managerId,
        managerDate
      );

      // Notifications
      if (targetUserId !== req.user.id) {
        if (req.user.role === 'supervisor') {
          notify(targetUserId, 'ثبت اضافه کار توسط سرپرست', `اضافه کار برای شما توسط سرپرست (${req.user.full_name}) ثبت گردید و برای تایید مدیر ارسال شد`, '/overtime');
          
          const managers = db.prepare("SELECT id FROM users WHERE role = 'manager' AND is_active = 1").all();
          managers.forEach(m => {
            notify(m.id, 'درخواست اضافه کار جدید', `درخواست اضافه کار ثبت شده توسط سرپرست برای ${targetUser.full_name} نیاز به تایید مدیر دارد`, '/overtime');
          });
        } else {
          notify(targetUserId, 'ثبت اضافه کار توسط مدیریت', `اضافه کار برای شما توسط مدیریت (${req.user.full_name}) ثبت و تایید گردید`, '/overtime');
        }
      } else {
        const supervisor = db.prepare("SELECT id FROM users WHERE role = 'supervisor' AND department_id = ? AND is_active = 1").get(req.user.department_id);
        if (supervisor) {
          notify(supervisor.id, 'درخواست اضافه کار جدید', `${req.user.full_name} درخواست اضافه کار ثبت کرده است`, '/overtime');
        }
      }

      res.json({ id: result.lastInsertRowid, message: 'درخواست اضافه کار ثبت شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id/edit', (req, res) => {
    try {
      const request = db.prepare("SELECT * FROM overtime_requests WHERE id = ? AND user_id = ? AND status = 'pending_supervisor'").get(req.params.id, req.user.id);
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد یا قابل ویرایش نیست' });

      const { start_date, start_time, end_date, end_time, reason } = req.body;
      if (!start_date || !start_time || !end_date || !end_time) {
        return res.status(400).json({ error: 'تمام فیلدهای تاریخ و ساعت شروع و پایان الزامی هستند' });
      }

      const today = moment().format('jYYYY/jMM/jDD');
      if (start_date < today && req.user.role !== 'admin') {
        return res.status(400).json({ error: 'امکان ثبت اضافه کار برای تاریخ گذشته وجود ندارد' });
      }

      const existingRequests = db.prepare(`
        SELECT id, start_date, start_hour, end_date, end_hour
        FROM overtime_requests
        WHERE user_id = ? AND status != 'rejected' AND id != ?
      `).all(req.user.id, req.params.id);

      const newStart = moment(`${start_date} ${start_time}`, 'jYYYY/jMM/jDD HH:mm');
      const newEnd = moment(`${end_date} ${end_time}`, 'jYYYY/jMM/jDD HH:mm');

      for (const reqOfUser of existingRequests) {
        const reqStart = moment(`${reqOfUser.start_date} ${reqOfUser.start_hour}`, 'jYYYY/jMM/jDD HH:mm');
        const reqEnd = moment(`${reqOfUser.end_date} ${reqOfUser.end_hour}`, 'jYYYY/jMM/jDD HH:mm');
        
        if (newStart.isBefore(reqEnd) && reqStart.isBefore(newEnd)) {
          return res.status(400).json({ error: `این تغییر با یکی از اضافه کارهای قبلی شما همپوشانی دارد (${reqOfUser.start_date} تا ${reqOfUser.end_date})` });
        }
      }

      const overtimeHours = calculateOvertimeHours(start_date, start_time, end_date, end_time);
      if (overtimeHours <= 0) {
        return res.status(400).json({ error: 'زمان انتخاب شده در ساعات اضافه کار معتبر یا روزهای تعطیل قرار ندارد' });
      }

      db.prepare('UPDATE overtime_requests SET start_date = ?, end_date = ?, hours_count = ?, reason = ?, start_hour = ?, end_hour = ? WHERE id = ?')
        .run(start_date, end_date, overtimeHours, reason || '', start_time, end_time, req.params.id);

      res.json({ message: 'درخواست با موفقیت ویرایش شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id/delete', (req, res) => {
    try {
      const request = db.prepare("SELECT * FROM overtime_requests WHERE id = ? AND user_id = ? AND status = 'pending_supervisor'").get(req.params.id, req.user.id);
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد یا قابل حذف نیست' });

      db.prepare('DELETE FROM overtime_requests WHERE id = ?').run(req.params.id);
      res.json({ message: 'درخواست با موفقیت حذف شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id/admin-delete', (req, res) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'فقط مدیر سیستم می‌تواند اضافه کار تایید شده را حذف کند' });
    }
    try {
      const request = db.prepare('SELECT * FROM overtime_requests WHERE id = ?').get(req.params.id);
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });

      db.prepare('DELETE FROM overtime_requests WHERE id = ?').run(req.params.id);

      notify(request.user_id, 'حذف درخواست اضافه کار', `درخواست اضافه کار شما (${request.start_date} تا ${request.end_date}) توسط مدیر سیستم حذف شد`, '/overtime');

      res.json({ message: 'درخواست اضافه کار حذف شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id/approve-supervisor', (req, res) => {
    try {
      const { comment } = req.body;
      const request = db.prepare('SELECT * FROM overtime_requests WHERE id = ? AND status = ?').get(req.params.id, 'pending_supervisor');
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });

      if (req.user.role !== 'admin') {
        const leaveUser = db.prepare('SELECT department_id FROM users WHERE id = ?').get(request.user_id);
        if (leaveUser && leaveUser.department_id !== req.user.department_id) {
          return res.status(403).json({ error: 'دسترسی غیرمجاز' });
        }
      }

      db.prepare(`
        UPDATE overtime_requests SET status = 'pending_manager', supervisor_id = ?, supervisor_comment = ?, supervisor_date = datetime('now')
        WHERE id = ?
      `).run(req.user.id, comment || '', req.params.id);

      notify(request.user_id, 'تایید سرپرست', `درخواست اضافه کار شما توسط سرپرست تایید شد و برای مدیر ارسال شد`, '/overtime');

      const managers = db.prepare("SELECT id FROM users WHERE role = 'manager' AND is_active = 1").all();
      managers.forEach(m => {
        notify(m.id, 'درخواست اضافه کار جدید', `درخواست اضافه کار ${request.user_id} نیاز به تایید مدیر دارد`, '/overtime');
      });

      res.json({ message: 'درخواست توسط سرپرست تایید شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id/reject-supervisor', (req, res) => {
    try {
      const { comment } = req.body;
      const request = db.prepare("SELECT * FROM overtime_requests WHERE id = ? AND status = 'pending_supervisor'").get(req.params.id);
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });

      db.prepare(`
        UPDATE overtime_requests SET status = 'rejected', supervisor_id = ?, supervisor_comment = ?, supervisor_date = datetime('now')
        WHERE id = ?
      `).run(req.user.id, comment || 'رد شده توسط سرپرست', req.params.id);

      notify(request.user_id, 'رد درخواست اضافه کار', `درخواست اضافه کار شما توسط سرپرست رد شد`, '/overtime');
      res.json({ message: 'درخواست رد شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id/approve-manager', (req, res) => {
    try {
      const { comment } = req.body;
      const request = db.prepare("SELECT * FROM overtime_requests WHERE id = ? AND status = 'pending_manager'").get(req.params.id);
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });

      db.prepare(`
        UPDATE overtime_requests SET status = 'approved', manager_id = ?, manager_comment = ?, manager_date = datetime('now')
        WHERE id = ?
      `).run(req.user.id, comment || '', req.params.id);

      notify(request.user_id, 'تایید نهایی اضافه کار', `اضافه کار شما توسط مدیر تایید شد`, '/overtime');

      const securityUsers = db.prepare("SELECT u.id FROM users u JOIN departments d ON u.department_id = d.id WHERE d.name LIKE '%حراست%' AND u.is_active = 1").all();
      securityUsers.forEach(s => {
        notify(s.id, 'اضافه کار تایید شده', `اضافه کار کاربر ${request.user_id} تایید شده - لطفاً مشاهده کنید`, '/overtime');
      });

      res.json({ message: 'اضافه کار توسط مدیر تایید شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id/reject-manager', (req, res) => {
    try {
      const { comment } = req.body;
      const request = db.prepare("SELECT * FROM overtime_requests WHERE id = ? AND status = 'pending_manager'").get(req.params.id);
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });

      db.prepare(`
        UPDATE overtime_requests SET status = 'rejected', manager_id = ?, manager_comment = ?, manager_date = datetime('now')
        WHERE id = ?
      `).run(req.user.id, comment || 'رد شده توسط مدیر', req.params.id);

      notify(request.user_id, 'رد درخواست اضافه کار', `درخواست اضافه کار شما توسط مدیر رد شد`, '/overtime');
      res.json({ message: 'درخواست رد شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id/seen-security', (req, res) => {
    if (!hasOvertimePerm(req.user, 'overtime_security_view')) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز - شما دسترسی رویت حراست را ندارید' });
    }
    try {
      const request = db.prepare("SELECT * FROM overtime_requests WHERE id = ? AND status = 'approved'").get(req.params.id);
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });

      db.prepare(`
        UPDATE overtime_requests SET status = 'seen_security', security_id = ?, security_date = datetime('now')
        WHERE id = ?
      `).run(req.user.id, req.params.id);

      res.json({ message: 'اضافه کار رویت شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Calculate endpoint
  router.get('/calculate', (req, res) => {
    try {
      const { start_date, start_time, end_date, end_time } = req.query;
      if (!start_date || !start_time || !end_date || !end_time) {
        return res.status(400).json({ error: 'تمام فیلدهای تاریخ و ساعت شروع و پایان الزامی هستند' });
      }
      const totalHours = calculateOvertimeHours(start_date, start_time, end_date, end_time);
      const days = Math.floor(totalHours / 8);
      const remainingHours = totalHours % 8;
      res.json({ total_hours: totalHours, days, remaining_hours: remainingHours });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Total cumulative approved overtime
  router.get('/balance', (req, res) => {
    try {
      const totalHours = db.prepare("SELECT COALESCE(SUM(hours_count), 0) as total FROM overtime_requests WHERE user_id = ? AND status IN ('approved', 'seen_security')").get(req.user.id).total;
      const days = Math.floor(totalHours / 8);
      const remainingHours = totalHours % 8;
      res.json({ total_hours: totalHours, days, remaining_hours: remainingHours });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/balance-all', (req, res) => {
    try {
      let balances;
      if (req.user.role === 'admin' || req.user.role === 'manager' || hasOvertimePerm(req.user, 'overtime_manager_approve')) {
        balances = db.prepare(`
          SELECT u.id as user_id, u.full_name, u.department_id, d.name as department_name,
                 COALESCE((SELECT SUM(hours_count) FROM overtime_requests WHERE user_id = u.id AND status IN ('approved', 'seen_security')), 0) as total_hours
          FROM users u
          LEFT JOIN departments d ON u.department_id = d.id
          WHERE u.is_active = 1
          ORDER BY d.name, u.full_name
        `).all();
      } else if (req.user.role === 'supervisor') {
        balances = db.prepare(`
          SELECT u.id as user_id, u.full_name, u.department_id, d.name as department_name,
                 COALESCE((SELECT SUM(hours_count) FROM overtime_requests WHERE user_id = u.id AND status IN ('approved', 'seen_security')), 0) as total_hours
          FROM users u
          LEFT JOIN departments d ON u.department_id = d.id
          WHERE u.is_active = 1 AND u.department_id = ? AND u.role != 'admin'
          ORDER BY u.full_name
        `).all(req.user.department_id);
      } else {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      
      res.json(balances.map(b => {
        const days = Math.floor(b.total_hours / 8);
        const remainingHours = b.total_hours % 8;
        return {
          ...b,
          days,
          remaining_hours: remainingHours
        };
      }));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id/edit-after-seen', (req, res) => {
    if (req.user.role !== 'admin' && !hasOvertimePerm(req.user, 'overtime_edit_after_seen')) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز - شما دسترسی ویرایش اضافه کار پس از رویت را ندارید' });
    }
    try {
      const { end_date, end_time, hours_count, reason } = req.body;
      const overtimeId = req.params.id;
      
      const request = db.prepare("SELECT * FROM overtime_requests WHERE id = ?").get(overtimeId);
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });
      
      if (request.status !== 'seen_security') {
        return res.status(400).json({ error: 'ویرایش اضافه کار فقط پس از رویت حراست امکان‌پذیر است' });
      }
      
      if (request.edited_by) {
        return res.status(400).json({ error: 'این اضافه کار قبلاً اصلاح شده است و اصلاح مجدد آن امکان‌پذیر نیست' });
      }
      
      db.prepare(`
        UPDATE overtime_requests 
        SET end_date = ?, end_hour = ?, hours_count = ?, reason = ?,
            edited_by = ?, edited_at = datetime('now'), edit_reason = ?
        WHERE id = ?
      `).run(end_date, end_time, hours_count, reason || request.reason || '', req.user.id, reason || '', overtimeId);
      
      res.json({ message: 'درخواست اضافه کار با موفقیت ویرایش شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Helper function to calculate overtime hours
  function calculateOvertimeHours(startDateStr, startTimeStr, endDateStr, endTimeStr) {
    const holidays = db.prepare('SELECT holiday_date FROM official_holidays').all();
    const holidaysSet = new Set(holidays.map(h => h.holiday_date));
    
    let current = moment(startDateStr, 'jYYYY/jMM/jDD');
    const end = moment(endDateStr, 'jYYYY/jMM/jDD');
    
    let totalMinutes = 0;
    
    const timeToMinutes = (t) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    
    while (current.isSameOrBefore(end, 'day')) {
      const dateStr = current.format('jYYYY/jMM/jDD');
      const dayOfWeek = current.day(); // 0 is Sunday, ..., 5 is Friday, 6 is Saturday
      
      const isFriday = (dayOfWeek === 5);
      const isOfficialHoliday = holidaysSet.has(dateStr);
      
      let reqStartMin = (dateStr === startDateStr) ? timeToMinutes(startTimeStr) : 0;
      let reqEndMin = (dateStr === endDateStr) ? timeToMinutes(endTimeStr) : 1440;
      
      // Overtime slots
      let slots = [];
      if (isFriday || isOfficialHoliday) {
        slots = [[0, 1440]];
      } else if (dayOfWeek === 4) {
        // Thursday working: 08:00 to 12:00 (480 to 720)
        slots = [[0, 480], [720, 1440]];
      } else {
        // Saturday-Wednesday working: 08:00-12:00 (480 to 720) and 13:00-17:00 (780 to 1020)
        slots = [[0, 480], [720, 780], [1020, 1440]];
      }
      
      for (const [slotStart, slotEnd] of slots) {
        const overlapStart = Math.max(reqStartMin, slotStart);
        const overlapEnd = Math.min(reqEndMin, slotEnd);
        if (overlapStart < overlapEnd) {
          totalMinutes += (overlapEnd - overlapStart);
        }
      }
      
      current.add(1, 'day');
    }
    
    return totalMinutes / 60;
  }

  return router;
};
