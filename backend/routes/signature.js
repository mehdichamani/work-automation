const express = require('express');
const { authMiddleware, roleGuard } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const prisma = require('../database/prisma');
const { mapRow, flattenJoins } = require('../utils/dbAdapter');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads', 'signatures');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `sig-${Date.now()}-${Math.random().toString(36).slice(2, 6)}${ext}`;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

const uploadBulk = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

module.exports = function() {
  const router = express.Router();
  router.use(authMiddleware);

  // دریافت امضای خود کاربر
  router.get('/my', async (req, res) => {
    try {
      const sig = await prisma.digitalSignature.findFirst({
        where: { userId: Number(req.user.id) },
        orderBy: { createdAt: 'desc' },
      });
      res.json(mapRow(sig));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // دریافت امضای یک کاربر خاص (برای نمایش در برگه)
  router.get('/user/:userId', async (req, res) => {
    try {
      const sig = await prisma.digitalSignature.findFirst({
        where: { userId: Number(req.params.userId) },
        orderBy: { createdAt: 'desc' },
      });
      res.json(mapRow(sig));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // دریافت امضای همه کاربران (برای انتظامات)
  router.get('/all-users', roleGuard('admin', 'manager'), async (req, res) => {
    try {
      const sigs = await prisma.digitalSignature.findMany({
        orderBy: { employeeCode: 'asc' },
        include: {
          user: {
            select: {
              fullName: true,
              departmentId: true,
              department: { select: { name: true } },
            },
          },
        },
      });
      const mapped = sigs.map(s => {
        const { user, ...rest } = s;
        return {
          ...rest,
          full_name: user ? user.fullName : null,
          user_employee_code: s.employeeCode,
          department_id: user ? user.departmentId : null,
          department_name: user && user.department ? user.department.name : null,
        };
      });
      res.json(mapRow(mapped));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // آپلود امضای اسکن شده
  router.post('/upload-scan', upload.single('signature'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'فایل امضا انتخاب نشده' });

      const url = `/uploads/signatures/${req.file.filename}`;
      const employeeCode = req.body.employee_code || req.user.employee_code || req.user.id;

      // حذف امضای قبلی
      const oldSig = await prisma.digitalSignature.findFirst({ where: { userId: Number(req.user.id) } });
      if (oldSig && oldSig.scannedSignature) {
        const oldPath = path.join(__dirname, '..', oldSig.scannedSignature);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }

      // بروزرسانی یا درج
      if (oldSig) {
        await prisma.digitalSignature.update({
          where: { id: oldSig.id },
          data: { scannedSignature: url, employeeCode, signatureType: 'scanned' },
        });
      } else {
        await prisma.digitalSignature.create({
          data: { userId: Number(req.user.id), signatureData: '', signatureType: 'scanned', scannedSignature: url, employeeCode },
        });
      }

      res.json({ url, success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ذخیره امضای کشیده شده
  router.post('/save', async (req, res) => {
    try {
      const { signature_data, signature_type, user_id } = req.body;
      if (!signature_data) {
        return res.status(400).json({ error: 'داده امضا الزامی است' });
      }

      const targetUserId = (user_id && req.user.role === 'admin') ? parseInt(user_id, 10) : req.user.id;
      const employeeCode = req.user.employee_code || targetUserId;

      await prisma.digitalSignature.deleteMany({ where: { userId: Number(targetUserId) } });

      const result = await prisma.digitalSignature.create({
        data: { userId: Number(targetUserId), signatureData: signature_data, signatureType: signature_type || 'drawn', employeeCode },
      });

      res.json({ id: result.id, success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ثبت امضا روی رکورد
  router.post('/sign', async (req, res) => {
    try {
      const { module_name, record_id, comment } = req.body;
      if (!module_name || !record_id) {
        return res.status(400).json({ error: 'ماژول و شناسه رکورد الزامی است' });
      }

      const sig = await prisma.digitalSignature.findFirst({
        where: { userId: Number(req.user.id) },
        orderBy: { createdAt: 'desc' },
      });
      if (!sig) {
        return res.status(400).json({ error: 'ابتدا امضای خود را ذخیره کنید' });
      }

      const existingSign = await prisma.signatureLog.findFirst({
        where: { userId: Number(req.user.id), moduleName: module_name, recordId: Number(record_id) },
      });
      if (existingSign) {
        return res.status(400).json({ error: 'شما قبلاً این رکورد را امضا کرده‌اید' });
      }

      await prisma.signatureLog.create({
        data: { userId: Number(req.user.id), signatureId: sig.id, moduleName: module_name, recordId: Number(record_id), action: 'signed', ipAddress: req.ip || null },
      });

      res.json({ success: true, message: 'امضا ثبت شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // بررسی امضای رکورد
  router.get('/verify/:module/:recordId', async (req, res) => {
    try {
      const logs = await prisma.signatureLog.findMany({
        where: { moduleName: req.params.module, recordId: Number(req.params.recordId) },
        orderBy: { createdAt: 'asc' },
        include: {
          signature: {
            select: { signatureData: true, signatureType: true, scannedSignature: true, employeeCode: true },
          },
          user: { select: { fullName: true, id: true } },
        },
      });
      const mapped = logs.map(l => flattenJoins(l, {
        signature_data: 'signature.signatureData',
        signature_type: 'signature.signatureType',
        scanned_signature: 'signature.scannedSignature',
        employee_code: 'signature.employeeCode',
        full_name: 'user.fullName',
        user_id: 'user.id',
      }));
      res.json(mapRow(mapped));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // تاریخچه امضا
  router.get('/log/:module/:recordId', async (req, res) => {
    try {
      const logs = await prisma.signatureLog.findMany({
        where: { moduleName: req.params.module, recordId: Number(req.params.recordId) },
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { fullName: true } },
          signature: {
            select: { signatureData: true, scannedSignature: true, employeeCode: true },
          },
        },
      });
      const mapped = logs.map(l => flattenJoins(l, {
        full_name: 'user.fullName',
        signature_data: 'signature.signatureData',
        scanned_signature: 'signature.scannedSignature',
        employee_code: 'signature.employeeCode',
      }));
      res.json(mapRow(mapped));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // حذف امضا
  router.delete('/:id', async (req, res) => {
    try {
      const sig = await prisma.digitalSignature.findFirst({
        where: { id: Number(req.params.id), userId: Number(req.user.id) },
      });
      if (!sig) return res.status(404).json({ error: 'امضا یافت نشد' });
      if (sig.scannedSignature) {
        const filePath = path.join(__dirname, '..', sig.scannedSignature);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
      await prisma.digitalSignature.delete({ where: { id: Number(req.params.id) } });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // آپلود گروهی امضا — استخراج کد پرسنلی از نام فایل
  router.post('/bulk-upload', roleGuard('admin'), uploadBulk.array('signatures', 100), async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'فایلی انتخاب نشده' });
      }

      const results = [];
      for (const file of req.files) {
        const originalName = path.parse(file.originalname).name;
        const match = originalName.match(/^(\d+)/);
        if (!match) {
          results.push({ file: file.originalname, status: 'error', message: 'کد پرسنلی در نام فایل یافت نشد' });
          continue;
        }

        const employeeCode = match[1];
        const user = await prisma.user.findUnique({
          where: { id: parseInt(employeeCode, 10) },
          select: { id: true, fullName: true },
        });
        if (!user) {
          results.push({ file: file.originalname, status: 'error', message: `کاربری با کد پرسنلی ${employeeCode} یافت نشد` });
          continue;
        }

        const url = `/uploads/signatures/${file.filename}`;

        const oldSig = await prisma.digitalSignature.findFirst({ where: { userId: user.id } });
        if (oldSig && oldSig.scannedSignature) {
          const oldPath = path.join(__dirname, '..', oldSig.scannedSignature);
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
          await prisma.digitalSignature.update({
            where: { id: oldSig.id },
            data: { scannedSignature: url, employeeCode, signatureType: 'scanned' },
          });
        } else if (oldSig) {
          await prisma.digitalSignature.update({
            where: { id: oldSig.id },
            data: { scannedSignature: url, employeeCode, signatureType: 'scanned' },
          });
        } else {
          await prisma.digitalSignature.create({
            data: { userId: user.id, signatureData: '', signatureType: 'scanned', scannedSignature: url, employeeCode },
          });
        }

        results.push({ file: file.originalname, status: 'ok', employeeCode, userName: user.fullName });
      }

      const okCount = results.filter(r => r.status === 'ok').length;
      const failCount = results.filter(r => r.status === 'error').length;
      res.json({ success: true, okCount, failCount, results });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
