const express = require('express');
const { authMiddleware, roleGuard } = require('../middleware/auth');

const MODULES = [
  { key: 'inventory_add', label: 'افزودن اقلام به کارتکس', group: 'کارتکس انبار' },
  { key: 'inventory_items', label: 'مدیریت تعریف کالاها', group: 'کارتکس انبار' },
  { key: 'inventory_all', label: 'مشاهده همه کارتکس‌ها', group: 'کارتکس انبار' },
  { key: 'leave_approve', label: 'تایید مرخصی (سرپرست)', group: 'مرخصی' },
  { key: 'leave_manager_approve', label: 'تایید مرخصی (مدیر)', group: 'مرخصی' },
  { key: 'leave_security_view', label: 'رویت حراست (مرخصی)', group: 'مرخصی' },
  { key: 'leave_quota_manage', label: 'مدیریت سهمیه مرخصی پرسنل', group: 'مرخصی' },
  { key: 'leave_edit_after_seen', label: 'ویرایش مرخصی پس از رویت حراست', group: 'مرخصی' },
  { key: 'overtime_approve', label: 'تایید اضافه کار (سرپرست)', group: 'اضافه کار' },
  { key: 'overtime_manager_approve', label: 'تایید اضافه کار (مدیر)', group: 'اضافه کار' },
  { key: 'overtime_security_view', label: 'رویت حراست (اضافه کار)', group: 'اضافه کار' },
  { key: 'overtime_edit_after_seen', label: 'ویرایش اضافه کار پس از رویت حراست', group: 'اضافه کار' },
  { key: 'shifts_manage', label: 'مدیریت و تغییر وضعیت شیفت کارکنان', group: 'شیفت‌های کاری' },
  { key: 'user_import_csv', label: 'وارد کردن گروهی پرسنل از CSV', group: 'مدیریت کاربران' },
  { key: 'letters_send', label: 'ارسال نامه', group: 'نامه‌ها' },
  { key: 'letters_approve', label: 'تایید نامه (مدیر)', group: 'نامه‌ها' },
  { key: 'letters_central', label: 'دبیرخانه / سانترال (مدیریت نامه‌ها)', group: 'نامه‌ها' },
  { key: 'restaurant_menu', label: 'مدیریت منوی رستوران', group: 'رستوران' },
  { key: 'restaurant_monitoring', label: 'مانیتورینگ رستوران', group: 'رستوران' },
  { key: 'announcements_manage', label: 'مدیریت اطلاعیه‌ها', group: 'اطلاعیه' },
  { key: 'job_application_fill', label: 'تکمیل پرسشنامه استخدامی', group: 'استخدام' },
  { key: 'job_application_review', label: 'بررسی پرسشنامه‌های استخدامی', group: 'استخدام' },
  { key: 'leave_request', label: 'درخواست مرخصی', group: 'دسترسی‌های پایه' },
  { key: 'overtime_request', label: 'درخواست اضافه کار', group: 'دسترسی‌های پایه' },
  { key: 'inventory_view', label: 'کارتکس انبار', group: 'دسترسی‌های پایه' },
  { key: 'restaurant_view', label: 'رستوران', group: 'دسترسی‌های پایه' },
  { key: 'purchase_request', label: 'درخواست خرید', group: 'ماژول‌های جدید' },
  { key: 'mission_request', label: 'درخواست ماموریت', group: 'ماژول‌های جدید' },
  { key: 'work_order_request', label: 'دستور کار', group: 'ماژول‌های جدید' },
  { key: 'payment_request', label: 'درخواست پرداخت', group: 'ماژول‌های جدید' },
  { key: 'repair_request', label: 'درخواست تعمیرات', group: 'ماژول‌های جدید' },
  { key: 'it_request', label: 'درخواست IT', group: 'ماژول‌های جدید' },
  { key: 'conference_request', label: 'رزرو سالن کنفرانس', group: 'ماژول‌های جدید' },
  { key: 'security_report', label: 'گزارش حراست', group: 'ماژول‌های جدید' },
  { key: 'daily_output', label: 'گزارش تولید', group: 'ماژول‌های جدید' },
  { key: 'project_supply', label: 'تامین پروژه', group: 'ماژول‌های جدید' },
  { key: 'inspection_request', label: 'بازدید فنی', group: 'ماژول‌های جدید' },
];

module.exports = function (db) {
  const router = express.Router();
  router.use(authMiddleware);

  router.get('/modules', (req, res) => {
    res.json(MODULES);
  });

  router.get('/', roleGuard('admin'), (req, res) => {
    try {
      const perms = db.prepare('SELECT * FROM permissions WHERE user_id IS NULL').all();
      res.json(perms);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/user-permissions', roleGuard('admin'), (req, res) => {
    try {
      const allPerms = db.prepare('SELECT * FROM permissions').all();
      const userPermsMap = {};
      for (const p of allPerms) {
        if (p.user_id !== null && p.user_id !== undefined) {
          if (!userPermsMap[p.user_id]) userPermsMap[p.user_id] = [];
          userPermsMap[p.user_id].push({ module_key: p.module_key, is_enabled: p.is_enabled });
        }
      }
      const result = [];
      for (const [userId, perms] of Object.entries(userPermsMap)) {
        const uid = Number(userId);
        const users = db.prepare('SELECT id, full_name, username FROM users WHERE id = ?').all(uid);
        if (!users.length) continue;
        const user = users[0];
        result.push({ user_id: user.id, full_name: user.full_name, username: user.username, permissions: perms });
      }
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/', roleGuard('admin'), (req, res) => {
    try {
      const { permissions } = req.body;
      if (!Array.isArray(permissions)) {
        return res.status(400).json({ error: 'داده نامعتبر' });
      }
      db.prepare('DELETE FROM permissions WHERE user_id IS NULL').run();
      const ins = db.prepare('INSERT INTO permissions (module_key, department_id, is_enabled) VALUES (?, ?, ?)');
      for (const p of permissions) {
        if (p.module_key && p.department_id !== undefined) {
          ins.run(p.module_key, p.department_id, p.is_enabled ? 1 : 0);
        }
      }
      res.json({ message: 'دسترسی‌ها ذخیره شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/user-permissions', roleGuard('admin'), (req, res) => {
    try {
      const { user_id, permissions } = req.body;
      if (!user_id || !Array.isArray(permissions)) {
        return res.status(400).json({ error: 'داده نامعتبر' });
      }
      db.prepare('DELETE FROM permissions WHERE user_id = ?').run(user_id);
      const ins = db.prepare('INSERT INTO permissions (module_key, user_id, is_enabled) VALUES (?, ?, ?)');
      for (const p of permissions) {
        if (p.module_key) {
          ins.run(p.module_key, user_id, p.is_enabled ? 1 : 0);
        }
      }
      res.json({ message: 'دسترسی‌های کاربر ذخیره شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /permissions/matrix - returns full permission-department-user matrix for both views
  router.get('/matrix', roleGuard('admin'), (req, res) => {
    try {
      const depts = db.prepare('SELECT id, name FROM departments WHERE is_active = 1 ORDER BY id').all();
      const deptUsers = {};
      for (const dept of depts) {
        deptUsers[dept.id] = db.prepare(
          'SELECT id, full_name, username, role FROM users WHERE department_id = ? AND is_active = 1 ORDER BY full_name'
        ).all(dept.id);
      }

      const deptPerms = db.prepare(
        'SELECT module_key, department_id, is_enabled FROM permissions WHERE user_id IS NULL'
      ).all();

      const userPerms = db.prepare(
        'SELECT module_key, user_id, is_enabled FROM permissions WHERE user_id IS NOT NULL'
      ).all();

      const deptPermMap = {};
      for (const p of deptPerms) {
        if (!deptPermMap[p.department_id]) deptPermMap[p.department_id] = {};
        deptPermMap[p.department_id][p.module_key] = p.is_enabled;
      }

      const userPermMap = {};
      for (const p of userPerms) {
        if (!userPermMap[p.user_id]) userPermMap[p.user_id] = {};
        userPermMap[p.user_id][p.module_key] = p.is_enabled;
      }

      res.json({ departments: depts, deptUsers, deptPermMap, userPermMap, modules: MODULES });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /permissions/toggle-user - toggle a single user's permission
  router.put('/toggle-user', roleGuard('admin'), (req, res) => {
    try {
      const { user_id, module_key, is_enabled } = req.body;
      if (!user_id || !module_key) {
        return res.status(400).json({ error: 'داده نامعتبر' });
      }

      const existing = db.prepare(
        'SELECT id FROM permissions WHERE user_id = ? AND module_key = ?'
      ).get(user_id, module_key);

      if (existing) {
        db.prepare('UPDATE permissions SET is_enabled = ? WHERE user_id = ? AND module_key = ?')
          .run(is_enabled ? 1 : 0, user_id, module_key);
      } else {
        db.prepare('INSERT INTO permissions (module_key, user_id, is_enabled) VALUES (?, ?, ?)')
          .run(module_key, user_id, is_enabled ? 1 : 0);
      }

      res.json({ message: 'وضعیت دسترسی تغییر کرد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /permissions/bulk-toggle-dept - toggle permission for all members of a department
  router.put('/bulk-toggle-dept', roleGuard('admin'), (req, res) => {
    try {
      const { department_id, module_key, is_enabled } = req.body;
      if (!department_id || !module_key) {
        return res.status(400).json({ error: 'داده نامعتبر' });
      }

      const members = db.prepare(
        'SELECT id FROM users WHERE department_id = ? AND is_active = 1'
      ).all(department_id);

      const del = db.prepare('DELETE FROM permissions WHERE user_id = ? AND module_key = ?');
      const ins = db.prepare('INSERT INTO permissions (module_key, user_id, is_enabled) VALUES (?, ?, ?)');

      db.exec('BEGIN TRANSACTION');
      try {
        for (const m of members) {
          del.run(m.id, module_key);
          if (is_enabled) {
            ins.run(module_key, m.id, 1);
          }
        }
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }

      res.json({ message: 'دسترسی گروهی اعمال شد', affected: members.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/bulk-set-users', roleGuard('admin'), (req, res) => {
    try {
      const { userIds } = req.body;
      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ error: 'لیست کاربران نامعتبر' });
      }

      const activeModules = MODULES.map(m => m.key);

      db.exec('BEGIN TRANSACTION');
      try {
        const del = db.prepare('DELETE FROM permissions WHERE user_id = ?');
        const ins = db.prepare('INSERT INTO permissions (module_key, user_id, is_enabled) VALUES (?, ?, ?)');

        for (const userId of userIds) {
          const user = db.prepare('SELECT id FROM users WHERE id = ? AND is_active = 1').get(userId);
          if (!user) continue;
          del.run(user.id);
          for (const moduleKey of activeModules) {
            ins.run(moduleKey, user.id, 1);
          }
        }

        db.exec('COMMIT');
        res.json({ message: 'دسترسی‌ها با موفقیت برای کاربران انتخاب‌شده ثبت شد', affected: userIds.length });
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/my', (req, res) => {
    try {
      if (req.user.role === 'admin') {
        const allPerms = MODULES.map(m => ({ module_key: m.key, is_enabled: 1 }));
        return res.json(allPerms);
      }

      const combined = {};

      const deptId = req.user.department_id;
      if (deptId) {
        const deptPerms = db.prepare('SELECT module_key, is_enabled FROM permissions WHERE department_id = ? AND user_id IS NULL').all(deptId);
        for (const p of deptPerms) {
          combined[p.module_key] = p.is_enabled;
        }
      }

      const userPerms = db.prepare('SELECT module_key, is_enabled FROM permissions WHERE user_id = ?').all(req.user.id);
      for (const p of userPerms) {
        combined[p.module_key] = p.is_enabled;
      }

      const result = Object.keys(combined).map(key => ({
        module_key: key,
        is_enabled: combined[key]
      }));

      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
