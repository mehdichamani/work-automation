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

  // دریافت لیست تمام پرسنل به همراه وضعیت و اطلاعات امضا برای مدیر سیستم
  router.get('/admin/list', roleGuard('admin', 'manager'), async (req, res) => {
    try {
      const users = await prisma.user.findMany({
        where: { isActive: true },
        orderBy: { id: 'asc' },
        select: {
          id: true,
          fullName: true,
          role: true,
          departmentId: true,
          department: { select: { name: true } },
          digitalSignature: {
            select: {
              id: true,
              signatureData: true,
              signatureType: true,
              scannedSignature: true,
              employeeCode: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      });

      const mapped = users.map(u => {
        const flat = flattenJoins(u, {
          department_name: 'department.name',
          signature_id: 'digitalSignature.id',
          signature_data: 'digitalSignature.signatureData',
          signature_type: 'digitalSignature.signatureType',
          scanned_signature: 'digitalSignature.scannedSignature',
          signature_employee_code: 'digitalSignature.employeeCode',
          signature_created_at: 'digitalSignature.createdAt',
          signature_updated_at: 'digitalSignature.updatedAt',
        });
        flat.has_signature = Boolean(flat.signature_data || flat.scanned_signature);
        return mapRow(flat);
      });

      res.json(mapped);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // تنظیم یا آپلود امضای اسکن شده برای یک کاربر مشخص توسط مدیر سیستم
  router.post('/admin/upload-user-scan', roleGuard('admin'), upload.single('signature'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'فایل امضا انتخاب نشده است' });

      const targetUserId = parseInt(req.body.user_id, 10);
      if (!targetUserId) return res.status(400).json({ error: 'شناسه یا کد پرسنلی کاربر الزامی است' });

      const user = await prisma.user.findUnique({ where: { id: targetUserId } });
      if (!user) return res.status(404).json({ error: 'کاربر مورد نظر یافت نشد' });

      const url = `/uploads/signatures/${req.file.filename}`;
      const employeeCode = String(user.id);

      const oldSig = await prisma.digitalSignature.findFirst({ where: { userId: user.id } });
      if (oldSig && oldSig.scannedSignature) {
        const oldPath = path.join(__dirname, '..', oldSig.scannedSignature);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }

      if (oldSig) {
        await prisma.digitalSignature.update({
          where: { id: oldSig.id },
          data: { scannedSignature: url, employeeCode, signatureType: 'scanned' },
        });
      } else {
        await prisma.digitalSignature.create({
          data: { userId: user.id, signatureData: '', signatureType: 'scanned', scannedSignature: url, employeeCode },
        });
      }

      res.json({ url, success: true, message: `امضای ${user.fullName} با موفقیت ثبت شد` });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // حذف امضای یک کاربر خاص توسط مدیر سیستم
  router.delete('/admin/user/:userId', roleGuard('admin'), async (req, res) => {
    try {
      const targetUserId = parseInt(req.params.userId, 10);
      const sig = await prisma.digitalSignature.findFirst({
        where: { userId: targetUserId },
      });
      if (!sig) return res.status(404).json({ error: 'امضایی برای این کاربر یافت نشد' });

      if (sig.scannedSignature) {
        const filePath = path.join(__dirname, '..', sig.scannedSignature);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }

      await prisma.digitalSignature.delete({ where: { id: sig.id } });
      res.json({ success: true, message: 'امضای کاربر با موفقیت حذف گردید' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ذخیره امضای کشیده شده برای کاربر توسط مدیر سیستم
  router.post('/save', roleGuard('admin'), async (req, res) => {
    try {
      const { signature_data, signature_type, user_id } = req.body;
      if (!signature_data) {
        return res.status(400).json({ error: 'داده امضا الزامی است' });
      }

      const targetUserId = parseInt(user_id, 10);
      if (!targetUserId) {
        return res.status(400).json({ error: 'شناسه کاربر الزامی است' });
      }

      const user = await prisma.user.findUnique({ where: { id: targetUserId } });
      if (!user) return res.status(404).json({ error: 'کاربر مورد نظر یافت نشد' });

      const employeeCode = String(targetUserId);

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

  // آپلود گروهی امضا — استخراج کد پرسنلی از نام فایل یا ساختار ارسالی
  router.post('/bulk-upload', roleGuard('admin'), uploadBulk.array('signatures', 100), async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'فایلی انتخاب نشده' });
      }

      // در صورتی که نگاشت کدهای پرسنلی به صورت JSON ارسال شده باشد
      let codeMapping = {};
      if (req.body.code_mapping) {
        try {
          codeMapping = JSON.parse(req.body.code_mapping);
        } catch (e) {
          codeMapping = {};
        }
      }

      const results = [];
      for (const file of req.files) {
        const originalName = path.parse(file.originalname).name;
        // تبدیل ارقام فارسی و عربی به انگلیسی
        const normalizedName = originalName
          .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
          .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));

        let employeeCode = codeMapping[file.originalname] || null;

        if (!employeeCode) {
          const match = normalizedName.match(/(\d{4,10})/);
          if (match) {
            employeeCode = match[1];
          } else {
            const anyDigits = normalizedName.match(/^(\d+)/);
            if (anyDigits) employeeCode = anyDigits[1];
          }
        }

        if (!employeeCode) {
          results.push({ file: file.originalname, status: 'error', message: 'کد پرسنلی در نام فایل یافت نشد' });
          continue;
        }

        const targetId = parseInt(employeeCode, 10);
        if (isNaN(targetId)) {
          results.push({ file: file.originalname, status: 'error', message: `کد پرسنلی ${employeeCode} نامعتبر است` });
          continue;
        }

        const user = await prisma.user.findUnique({
          where: { id: targetId },
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
            data: { scannedSignature: url, employeeCode: String(employeeCode), signatureType: 'scanned' },
          });
        } else if (oldSig) {
          await prisma.digitalSignature.update({
            where: { id: oldSig.id },
            data: { scannedSignature: url, employeeCode: String(employeeCode), signatureType: 'scanned' },
          });
        } else {
          await prisma.digitalSignature.create({
            data: { userId: user.id, signatureData: '', signatureType: 'scanned', scannedSignature: url, employeeCode: String(employeeCode) },
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
