const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');
const { auth, changePassword } = require('../middleware/validate');
const prisma = require('../database/prisma');
const { mapRow, flattenJoins } = require('../utils/dbAdapter');

const loginAttempts = new Map();
const LOGIN_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

function isRateLimited(ip) {
  const record = loginAttempts.get(ip);
  if (!record) return false;
  if (Date.now() - record.start > LOGIN_WINDOW) {
    loginAttempts.delete(ip);
    return false;
  }
  return record.count >= MAX_ATTEMPTS;
}

function recordFailedAttempt(ip) {
  const record = loginAttempts.get(ip);
  if (!record || Date.now() - record.start > LOGIN_WINDOW) {
    loginAttempts.set(ip, { count: 1, start: Date.now() });
  } else {
    record.count++;
  }
}

function clearAttempts(ip) {
  loginAttempts.delete(ip);
}

module.exports = function() {
  const router = express.Router();

  router.post('/login', auth, async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: 'کد پرسنلی و رمز عبور الزامی است' });
      }

      const ip = req.ip || req.connection.remoteAddress;
      if (isRateLimited(ip)) {
        return res.status(429).json({ error: 'تعداد تلاش‌های ناموفق بیش از حد مجاز است. لطفاً ۱۵ دقیقه صبر کنید' });
      }

      const userId = parseInt(username, 10);
      if (isNaN(userId)) {
        return res.status(401).json({ error: 'کد پرسنلی شما در سیستم تعریف نشده دوباره بررسی کنید' });
      }

      const user = await prisma.user.findFirst({ where: { id: userId, isActive: true } });
      if (!user) {
        recordFailedAttempt(ip);
        return res.status(401).json({ error: 'کد پرسنلی شما در سیستم تعریف نشده دوباره بررسی کنید' });
      }

      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        recordFailedAttempt(ip);
        return res.status(401).json({ error: 'رمز عبور اشتباهه دوباره بررسی کنید' });
      }

      clearAttempts(ip);

      const dept = user.departmentId ? await prisma.department.findUnique({ where: { id: user.departmentId } }) : null;
      const token = jwt.sign(
        { id: user.id, username: String(user.id), role: user.role, full_name: user.fullName, department_id: user.departmentId, department_name: dept?.name || '' },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        token,
        user: {
          id: user.id,
          username: String(user.id),
          full_name: user.fullName,
          role: user.role,
          department_id: user.departmentId,
          department_name: dept?.name || '',
          must_change_password: user.mustChangePassword
        }
      });
    } catch (err) {
      res.status(500).json({ error: 'خطای سرور' });
    }
  });

  router.post('/change-password', require('../middleware/auth').authMiddleware, changePassword, async (req, res) => {
    try {
      const { oldPassword, newPassword } = req.body;
      const user = await prisma.user.findUnique({ where: { id: Number(req.user.id) } });

      const passwordMatch = await bcrypt.compare(oldPassword, user.password);
      if (!passwordMatch) {
        return res.status(400).json({ error: 'رمز عبور فعلی اشتباه است' });
      }

      const hash = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({
        where: { id: Number(req.user.id) },
        data: { password: hash, mustChangePassword: false }
      });
      res.json({ message: 'رمز عبور با موفقیت تغییر کرد' });
    } catch (err) {
      res.status(500).json({ error: 'خطای سرور' });
    }
  });

  return router;
};
