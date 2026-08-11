const express = require('express');
const { authMiddleware, validatePassword } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const prisma = require('../database/prisma');
const { mapRow, flattenJoins } = require('../utils/dbAdapter');

module.exports = function() {
  const router = express.Router();
  router.use(authMiddleware);

  router.get('/', async (req, res) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: Number(req.user.id) },
        select: { id: true, username: true, fullName: true, role: true, departmentId: true, phone: true, email: true, lastLogin: true, isActive: true }
      });
      if (!user) return res.status(404).json({ error: 'کاربر یافت نشد' });
      const dept = user.departmentId ? await prisma.department.findUnique({ where: { id: user.departmentId } }) : null;
      res.json({ ...mapRow(user), department_name: dept?.name || '' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/', async (req, res) => {
    try {
      const { phone, email } = req.body;
      await prisma.user.update({
        where: { id: Number(req.user.id) },
        data: { phone: phone || null, email: email || null }
      });
      res.json({ message: 'پروفایل بروزرسانی شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/change-password', async (req, res) => {
    try {
      const { oldPassword, newPassword } = req.body;
      const pwError = validatePassword(newPassword);
      if (pwError) return res.status(400).json({ error: pwError });

      const user = await prisma.user.findUnique({ where: { id: Number(req.user.id) } });
      const match = await bcrypt.compare(oldPassword, user.password);
      if (!match) {
        return res.status(400).json({ error: 'رمز عبور فعلی اشتباه است' });
      }

      const hash = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({
        where: { id: Number(req.user.id) },
        data: { password: hash, mustChangePassword: false }
      });
      res.json({ message: 'رمز عبور با موفقیت تغییر کرد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
