const express = require('express');
const { authMiddleware, roleGuard } = require('../middleware/auth');

const MODULES = [
  { key: 'inventory_add', label: 'افزودن اقلام به کارتکس', group: 'کارتکس انبار' },
  { key: 'inventory_items', label: 'مدیریت تعریف کالاها', group: 'کارتکس انبار' },
  { key: 'inventory_all', label: 'مشاهده همه کارتکس‌ها', group: 'کارتکس انبار' },
  { key: 'leave_approve', label: 'تایید مرخصی (سرپرست)', group: 'مرخصی' },
  { key: 'leave_manager_approve', label: 'تایید مرخصی (مدیر)', group: 'مرخصی' },
  { key: 'letters_send', label: 'ارسال نامه', group: 'نامه‌ها' },
  { key: 'letters_approve', label: 'تایید نامه (مدیر)', group: 'نامه‌ها' },
  { key: 'restaurant_menu', label: 'مدیریت منوی رستوران', group: 'رستوران' },
  { key: 'restaurant_monitoring', label: 'مانیتورینگ رستوران', group: 'رستوران' },
  { key: 'announcements_manage', label: 'مدیریت اطلاعیه‌ها', group: 'اطلاعیه' },
  { key: 'job_application_fill', label: 'تکمیل پرسشنامه استخدامی', group: 'استخدام' },
  { key: 'job_application_review', label: 'بررسی پرسشنامه‌های استخدامی', group: 'استخدام' },
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
      const allPerms = db.query('SELECT * FROM permissions');
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

  router.get('/my', (req, res) => {
    try {
      if (req.user.role === 'admin') {
        const allPerms = MODULES.map(m => ({ module_key: m.key, is_enabled: 1 }));
        return res.json(allPerms);
      }

      const userPerms = db.prepare('SELECT module_key, is_enabled FROM permissions WHERE user_id = ?').all(req.user.id);
      if (userPerms.length > 0) {
        return res.json(userPerms);
      }

      const deptId = req.user.department_id;
      if (!deptId) return res.json([]);
      const deptPerms = db.prepare('SELECT module_key, is_enabled FROM permissions WHERE department_id = ? AND user_id IS NULL').all(deptId);
      res.json(deptPerms);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
