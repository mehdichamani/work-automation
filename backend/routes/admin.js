const express = require('express');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { authMiddleware, roleGuard } = require('../middleware/auth');

module.exports = function(db) {
  const router = express.Router();
  router.use(authMiddleware);

  const uploadDir = path.join(__dirname, '..', 'uploads', 'csv_imports');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  router.get('/users', (req, res) => {
    if (req.user.role !== 'admin' && !hasAdminPerm(req.user, 'user_import_csv')) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    try {
      const users = db.prepare(`
        SELECT u.id, u.id as username, u.full_name, u.role, u.department_id, u.is_active, u.created_at,
               d.name as department_name
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        ORDER BY u.id
      `).all();
      res.json(users);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/users', roleGuard('admin'), (req, res) => {
    try {
      const { id, username, password, full_name, role, department_id } = req.body;
      const targetId = parseInt(id || username, 10);
      if (!targetId || !full_name || !role) {
        return res.status(400).json({ error: 'کد پرسنلی، نام کامل و نقش الزامی هستند' });
      }
      const existing = db.prepare('SELECT id, is_active FROM users WHERE id = ?').get(targetId);
      if (existing && existing.is_active) {
        return res.status(400).json({ error: 'کد پرسنلی تکراری است' });
      }
      const pass = password || String(targetId);
      const hash = bcrypt.hashSync(pass, 10);
      if (existing && !existing.is_active) {
        db.prepare('UPDATE users SET password = ?, full_name = ?, role = ?, department_id = ?, is_active = 1 WHERE id = ?')
          .run(hash, full_name, role, department_id || null, targetId);
      } else {
        db.prepare('INSERT INTO users (id, password, full_name, role, department_id) VALUES (?, ?, ?, ?, ?)').run(targetId, hash, full_name, role, department_id || null);
      }
      
      const existingBalance = db.prepare('SELECT id FROM leave_balance WHERE user_id = ?').get(targetId);
      if (!existingBalance) {
        db.prepare('INSERT INTO leave_balance (user_id, total_days, used_hours) VALUES (?, 0, 0)').run(targetId);
      }
      
      res.json({ id: targetId, message: 'کاربر با موفقیت ایجاد شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/users/:id', roleGuard('admin'), (req, res) => {
    try {
      const { full_name, role, department_id, is_active, password } = req.body;
      const userId = req.params.id;

      if (password) {
        const hash = bcrypt.hashSync(password, 10);
        db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, userId);
      }

      db.prepare('UPDATE users SET full_name = ?, role = ?, department_id = ?, is_active = ? WHERE id = ?')
        .run(full_name, role, department_id || null, is_active !== undefined ? is_active : 1, userId);
      res.json({ message: 'کاربر با موفقیت ویرایش شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/users/:id', roleGuard('admin'), (req, res) => {
    try {
      const userId = req.params.id;
      const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId);
      if (user && user.role === 'admin') {
        return res.status(400).json({ error: 'امکان حذف مدیر سیستم وجود ندارد' });
      }
      db.prepare('DELETE FROM cardex WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM cardex WHERE warehouse_user_id = ?').run(userId);
      db.prepare('DELETE FROM user_shift_assignments WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM shift_change_requests WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM leave_requests WHERE user_id = ?').run(userId);
      db.prepare('UPDATE leave_requests SET supervisor_id = NULL WHERE supervisor_id = ?').run(userId);
      db.prepare('UPDATE leave_requests SET manager_id = NULL WHERE manager_id = ?').run(userId);
      db.prepare('UPDATE leave_requests SET security_id = NULL WHERE security_id = ?').run(userId);
      db.prepare('DELETE FROM overtime_requests WHERE user_id = ?').run(userId);
      db.prepare('UPDATE overtime_requests SET supervisor_id = NULL WHERE supervisor_id = ?').run(userId);
      db.prepare('UPDATE overtime_requests SET manager_id = NULL WHERE manager_id = ?').run(userId);
      db.prepare('UPDATE overtime_requests SET security_id = NULL WHERE security_id = ?').run(userId);
      db.prepare('UPDATE letters SET manager_id = NULL WHERE manager_id = ?').run(userId);
      db.prepare('DELETE FROM notifications WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM leave_balance WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM signatures WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM users WHERE id = ?').run(userId);
      res.json({ message: 'کاربر با موفقیت حذف شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/departments', (req, res) => {
    try {
      const departments = db.prepare('SELECT * FROM departments WHERE is_active = 1 ORDER BY id').all();
      res.json(departments);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/departments', roleGuard('admin'), (req, res) => {
    try {
      const { name, parent_id } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'نام واحد الزامی است' });
      }
      const result = db.prepare('INSERT INTO departments (name, parent_id) VALUES (?, ?)').run(name, parent_id || null);
      res.json({ id: result.lastInsertRowid, message: 'واحد با موفقیت ایجاد شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/departments/:id', roleGuard('admin'), (req, res) => {
    try {
      const { name, parent_id } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'نام واحد الزامی است' });
      }
      db.prepare('UPDATE departments SET name = ?, parent_id = ? WHERE id = ?').run(name, parent_id || null, req.params.id);
      res.json({ message: 'واحد با موفقیت ویرایش شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/departments/:id', roleGuard('admin'), (req, res) => {
    try {
      const deptId = req.params.id;
      const userCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE department_id = ? AND is_active = 1').get(deptId).count;
      if (userCount > 0) {
        return res.status(400).json({ error: `امکان حذف واحد وجود ندارد. ${userCount} کاربر فعال در این واحد هستند. ابتدا کاربران را منتقل یا غیرفعال کنید.` });
      }
      db.prepare('UPDATE users SET department_id = NULL WHERE department_id = ?').run(deptId);
      db.prepare('DELETE FROM letter_units WHERE unit_id = ?').run(deptId);
      db.prepare('UPDATE departments SET is_active = 0 WHERE id = ?').run(deptId);
      res.json({ message: 'واحد با موفقیت حذف شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/departments/:id/supervisors', roleGuard('admin'), (req, res) => {
    try {
      const deptId = req.params.id;
      const supervisors = db.prepare(`
        SELECT u.id, u.full_name, u.id as username, u.role
        FROM users u
        WHERE u.department_id = ? AND u.is_active = 1
        ORDER BY u.role = 'supervisor' DESC, u.full_name
      `).all(deptId);
      res.json(supervisors);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/departments/:id/promote-supervisor', roleGuard('admin'), (req, res) => {
    try {
      const { user_id } = req.body;
      if (!user_id) {
        return res.status(400).json({ error: 'انتخاب کاربر الزامی است' });
      }
      const target = db.prepare('SELECT id, role, department_id FROM users WHERE id = ? AND is_active = 1').get(user_id);
      if (!target) {
        return res.status(404).json({ error: 'کاربر یافت نشد' });
      }
      if (target.role === 'admin') {
        return res.status(400).json({ error: 'امکان تغییر نقش مدیر سیستم وجود ندارد' });
      }
      db.prepare('UPDATE users SET role = ?, department_id = ? WHERE id = ?').run('supervisor', req.params.id, user_id);
      res.json({ message: 'کاربر به سرپرست واحد ارتقا یافت' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/departments/:id/demote-supervisor', roleGuard('admin'), (req, res) => {
    try {
      const { user_id } = req.body;
      if (!user_id) {
        return res.status(400).json({ error: 'انتخاب کاربر الزامی است' });
      }
      const target = db.prepare('SELECT id, role FROM users WHERE id = ? AND is_active = 1').get(user_id);
      if (!target) {
        return res.status(404).json({ error: 'کاربر یافت نشد' });
      }
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run('user', user_id);
      res.json({ message: 'سمت سرپرستی حذف شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/departments/:id/add-member', roleGuard('admin'), (req, res) => {
    try {
      const { user_id } = req.body;
      if (!user_id) {
        return res.status(400).json({ error: 'انتخاب کاربر الزامی است' });
      }
      const target = db.prepare('SELECT id, role FROM users WHERE id = ? AND is_active = 1').get(user_id);
      if (!target) {
        return res.status(404).json({ error: 'کاربر یافت نشد' });
      }
      if (target.role === 'admin') {
        return res.status(400).json({ error: 'امکان تغییر واحد مدیر سیستم وجود ندارد' });
      }
      db.prepare('UPDATE users SET department_id = ?, role = ? WHERE id = ?').run(req.params.id, 'user', user_id);
      res.json({ message: 'کاربر به واحد اضافه شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/departments/:id/remove-member', roleGuard('admin'), (req, res) => {
    try {
      const { user_id } = req.body;
      if (!user_id) {
        return res.status(400).json({ error: 'انتخاب کاربر الزامی است' });
      }
      db.prepare('UPDATE users SET department_id = NULL WHERE id = ?').run(user_id);
      res.json({ message: 'کاربر از واحد خارج شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/stats', roleGuard('admin', 'manager'), (req, res) => {
    try {
      const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_active = 1').get().count;
      const totalDepts = db.prepare('SELECT COUNT(*) as count FROM departments WHERE is_active = 1').get().count;
      const pendingLeaves = db.prepare("SELECT COUNT(*) as count FROM leave_requests WHERE status IN ('pending_supervisor','pending_manager')").get().count;
      const pendingOvertime = db.prepare("SELECT COUNT(*) as count FROM overtime_requests WHERE status IN ('pending_supervisor','pending_manager')").get().count;
      const pendingLetters = db.prepare("SELECT COUNT(*) as count FROM letters WHERE status IN ('pending_central','pending_manager')").get().count;
      const pendingCardex = db.prepare("SELECT COUNT(*) as count FROM cardex WHERE status = 'pending_user'").get().count;

      const roleStats = db.prepare('SELECT role, COUNT(*) as count FROM users WHERE is_active = 1 GROUP BY role').all();
      const deptStats = db.prepare(`
        SELECT d.name, COUNT(u.id) as user_count 
        FROM departments d 
        LEFT JOIN users u ON d.id = u.department_id AND u.is_active = 1
        WHERE d.is_active = 1
        GROUP BY d.id
      `).all();

      res.json({ totalUsers, totalDepts, pendingLeaves, pendingOvertime, pendingLetters, pendingCardex, roleStats, deptStats });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  function hasAdminPerm(user, key) {
    if (user.role === 'admin') return true;
    const p = db.prepare('SELECT is_enabled FROM permissions WHERE user_id = ? AND module_key = ?').get(user.id, key);
    if (p) return p.is_enabled === 1;
    if (user.department_id) {
      const dp = db.prepare('SELECT is_enabled FROM permissions WHERE department_id = ? AND module_key = ? AND user_id IS NULL').get(user.department_id, key);
      if (dp) return dp.is_enabled === 1;
    }
    return false;
  }

  router.post('/users/import-csv', (req, res) => {
    if (req.user.role !== 'admin' && !hasAdminPerm(req.user, 'user_import_csv')) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز - شما دسترسی ورود گروهی کاربران را ندارید' });
    }
    try {
      const { users, csv_text, file_name } = req.body;
      if (!Array.isArray(users) || users.length === 0) {
        return res.status(400).json({ error: 'لیست کاربران برای ثبت نامعتبر است' });
      }

      const insertUser = db.prepare(`
        INSERT INTO users (id, password, full_name, role, department_id, work_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      const insertBalance = db.prepare(`
        INSERT INTO leave_balance (user_id, total_days, used_hours)
        VALUES (?, ?, 0)
      `);

      const checkUser = db.prepare('SELECT id FROM users WHERE id = ?');

      db.transaction(() => {
        for (const u of users) {
          const userId = parseInt(u.id || u.personal_code, 10);
          if (!userId || !u.full_name || !u.role) continue;

          let role = u.role;
          const roleMap = {
            'admin': 'admin',
            'manager': 'manager',
            'supervisor': 'supervisor',
            'user': 'user',
            'مدیر سیستم': 'admin',
            'مدیرسیستم': 'admin',
            'مدیر': 'manager',
            'سرپرست': 'supervisor',
            'کاربر': 'user',
            'عادی': 'user',
            'کاربر عادی': 'user'
          };
          if (roleMap[role]) {
            role = roleMap[role];
          }

          if (['admin', 'manager'].includes(role)) {
            throw new Error(`امکان ثبت نقش مدیر یا مدیر سیستم برای کاربر ${u.full_name} (${userId}) از طریق فایل گروهی وجود ندارد`);
          }

          let departmentId = null;
          if (u.department_name && u.department_name.trim()) {
            const deptName = u.department_name.trim();
            const dept = db.prepare('SELECT id FROM departments WHERE LOWER(name) = LOWER(?) AND is_active = 1').get(deptName);
            if (dept) {
              departmentId = dept.id;
            } else {
              const res = db.prepare('INSERT INTO departments (name) VALUES (?)').run(deptName);
              departmentId = res.lastInsertRowid;
            }
          } else if (u.department_id) {
            departmentId = u.department_id;
          }

          let totalDays = 0;
          if (u.total_hours !== undefined) {
            totalDays = Number(u.total_hours) / 8;
          } else if (u.total_days !== undefined) {
            totalDays = Number(u.total_days);
          }
          
          const pass = u.password || String(userId);
          const hash = bcrypt.hashSync(pass, 10);
          
          const existing = checkUser.get(userId);
          if (existing) {
            db.prepare('UPDATE users SET password = ?, full_name = ?, role = ?, department_id = ?, work_type = ?, is_active = 1 WHERE id = ?')
              .run(hash, u.full_name, role, departmentId, u.work_type || 'normal', userId);
            
            const balanceExists = db.prepare('SELECT id FROM leave_balance WHERE user_id = ?').get(userId);
            if (balanceExists) {
              db.prepare('UPDATE leave_balance SET total_days = ? WHERE user_id = ?')
                .run(totalDays, userId);
            } else {
              insertBalance.run(userId, totalDays);
            }
          } else {
            insertUser.run(userId, hash, u.full_name, role, departmentId, u.work_type || 'normal');
            insertBalance.run(userId, totalDays);
          }
        }
      })();

      // Save raw CSV file to disk for audit logs
      const safeName = file_name ? file_name.replace(/[^a-zA-Z0-9.\-_]/g, '_') : 'import.csv';
      const fileBase = `import_${req.user.id}_${Date.now()}_${safeName}`;
      const filePath = path.join(uploadDir, fileBase);
      fs.writeFileSync(filePath, csv_text || '', 'utf8');

      // Record in logs table
      db.prepare('INSERT INTO csv_imports_log (file_name, file_path, imported_by, row_count) VALUES (?, ?, ?, ?)')
        .run(safeName, filePath, req.user.id, users.length);

      res.json({ message: 'کاربران با موفقیت وارد و ثبت شدند' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/users/import-csv-logs', (req, res) => {
    if (req.user.role !== 'admin' && !hasAdminPerm(req.user, 'user_import_csv')) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    try {
      const logs = db.prepare(`
        SELECT l.id, l.file_name, l.imported_at, l.row_count, u.full_name as importer_name
        FROM csv_imports_log l
        JOIN users u ON l.imported_by = u.id
        ORDER BY l.imported_at DESC
      `).all();
      res.json(logs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/users/import-csv-download/:id', (req, res) => {
    if (req.user.role !== 'admin' && !hasAdminPerm(req.user, 'user_import_csv')) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    try {
      const log = db.prepare('SELECT file_path, file_name FROM csv_imports_log WHERE id = ?').get(req.params.id);
      if (!log) {
        return res.status(404).json({ error: 'فایل مورد نظر یافت نشد' });
      }
      const fullPath = path.resolve(log.file_path);
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: 'فایل فیزیکی روی سرور یافت نشد' });
      }
      res.download(fullPath, log.file_name);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
