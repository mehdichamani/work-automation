const express = require('express');
const { authMiddleware, validatePassword } = require('../middleware/auth');
const bcrypt = require('bcryptjs');

module.exports = function(db) {
  const router = express.Router();
  router.use(authMiddleware);

  router.get('/', (req, res) => {
    try {
      const user = db.prepare('SELECT id, username, full_name, role, department_id, phone, email, last_login, is_active FROM users WHERE id = ?').get(req.user.id);
      if (!user) return res.status(404).json({ error: 'کاربر یافت نشد' });
      const dept = db.prepare('SELECT name FROM departments WHERE id = ?').get(user.department_id);
      res.json({ ...user, department_name: dept?.name || '' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/', (req, res) => {
    try {
      const { phone, email } = req.body;
      db.prepare('UPDATE users SET phone = ?, email = ? WHERE id = ?').run(phone || null, email || null, req.user.id);
      res.json({ message: 'پروفایل بروزرسانی شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/change-password', (req, res) => {
    try {
      const { oldPassword, newPassword } = req.body;
      const pwError = validatePassword(newPassword);
      if (pwError) return res.status(400).json({ error: pwError });

      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
      if (!bcrypt.compareSync(oldPassword, user.password)) {
        return res.status(400).json({ error: 'رمز عبور فعلی اشتباه است' });
      }

      const hash = bcrypt.hashSync(newPassword, 10);
      db.prepare('UPDATE users SET password = ?, must_change_password = 0 WHERE id = ?').run(hash, req.user.id);
      res.json({ message: 'رمز عبور با موفقیت تغییر کرد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
