const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

module.exports = function(db) {
  const router = express.Router();

  router.post('/login', (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: 'کد پرسنلی و رمز عبور الزامی است' });
      }

      const userId = parseInt(username, 10);
      if (isNaN(userId)) {
        return res.status(401).json({ error: 'کد پرسنلی یا رمز عبور اشتباه است' });
      }

      const user = db.prepare('SELECT * FROM users WHERE id = ? AND is_active = 1').get(userId);
      if (!user) {
        return res.status(401).json({ error: 'کد پرسنلی یا رمز عبور اشتباه است' });
      }

      if (!bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ error: 'کد پرسنلی یا رمز عبور اشتباه است' });
      }

      const dept = db.prepare('SELECT name FROM departments WHERE id = ?').get(user.department_id);
      const token = jwt.sign(
        { id: user.id, username: String(user.id), role: user.role, full_name: user.full_name, department_id: user.department_id, department_name: dept?.name || '' },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        token,
        user: {
          id: user.id,
          username: String(user.id),
          full_name: user.full_name,
          role: user.role,
          department_id: user.department_id,
          department_name: dept?.name || '',
          must_change_password: user.must_change_password
        }
      });
    } catch (err) {
      res.status(500).json({ error: 'خطای سرور: ' + err.message });
    }
  });

  router.post('/change-password', require('../middleware/auth').authMiddleware, (req, res) => {
    try {
      const { oldPassword, newPassword } = req.body;
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

      if (!bcrypt.compareSync(oldPassword, user.password)) {
        return res.status(400).json({ error: 'رمز عبور فعلی اشتباه است' });
      }

      const hash = bcrypt.hashSync(newPassword, 10);
      db.prepare('UPDATE users SET password = ?, must_change_password = 0 WHERE id = ?').run(hash, req.user.id);
      res.json({ message: 'رمز عبور با موفقیت تغییر کرد' });
    } catch (err) {
      res.status(500).json({ error: 'خطای سرور: ' + err.message });
    }
  });

  return router;
};
