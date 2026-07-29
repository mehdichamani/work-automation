const express = require('express');
const { authMiddleware, roleGuard } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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

module.exports = function(db) {
  const router = express.Router();
  router.use(authMiddleware);

  // دریافت امضای خود کاربر
  router.get('/my', (req, res) => {
    try {
      const sig = db.prepare('SELECT * FROM digital_signatures WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(req.user.id);
      res.json(sig || null);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // دریافت امضای یک کاربر خاص (برای نمایش در برگه)
  router.get('/user/:userId', (req, res) => {
    try {
      const sig = db.prepare('SELECT * FROM digital_signatures WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(req.params.userId);
      res.json(sig || null);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // دریافت امضای همه کاربران (برای انتظامات)
  router.get('/all-users', roleGuard('admin', 'manager'), (req, res) => {
    try {
      const sigs = db.prepare(`
        SELECT ds.*, u.full_name, ds.employee_code as user_employee_code, u.department_id, d.name as department_name
        FROM digital_signatures ds
        JOIN users u ON ds.user_id = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        ORDER BY ds.employee_code
      `).all();
      res.json(sigs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // آپلود امضای اسکن شده
  router.post('/upload-scan', upload.single('signature'), (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'فایل امضا انتخاب نشده' });

      const url = `/uploads/signatures/${req.file.filename}`;
      const employeeCode = req.body.employee_code || req.user.employee_code || req.user.id;

      // حذف امضای قبلی
      const oldSig = db.prepare('SELECT * FROM digital_signatures WHERE user_id = ?').get(req.user.id);
      if (oldSig && oldSig.scanned_signature) {
        const oldPath = path.join(__dirname, '..', oldSig.scanned_signature);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }

      // بروزرسانی یا درج
      if (oldSig) {
        db.prepare('UPDATE digital_signatures SET scanned_signature = ?, employee_code = ?, signature_type = ?, updated_at = to_char(now(), \'YYYY-MM-DD HH24:MI:SS\'::text) WHERE user_id = ?')
          .run(url, employeeCode, 'scanned', req.user.id);
      } else {
        db.prepare('INSERT INTO digital_signatures (user_id, signature_data, signature_type, scanned_signature, employee_code) VALUES (?, ?, ?, ?, ?)')
          .run(req.user.id, '', 'scanned', url, employeeCode);
      }

      res.json({ url, success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ذخیره امضای کشیده شده
  router.post('/save', (req, res) => {
    try {
      const { signature_data, signature_type, user_id } = req.body;
      if (!signature_data) {
        return res.status(400).json({ error: 'داده امضا الزامی است' });
      }

      const targetUserId = (user_id && req.user.role === 'admin') ? parseInt(user_id, 10) : req.user.id;
      const employeeCode = req.user.employee_code || targetUserId;

      db.prepare('DELETE FROM digital_signatures WHERE user_id = ?').run(targetUserId);

      const result = db.prepare(`
        INSERT INTO digital_signatures (user_id, signature_data, signature_type, employee_code)
        VALUES (?, ?, ?, ?)
      `).run(targetUserId, signature_data, signature_type || 'drawn', employeeCode);

      res.json({ id: result.lastInsertRowid, success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ثبت امضا روی رکورد
  router.post('/sign', (req, res) => {
    try {
      const { module_name, record_id, comment } = req.body;
      if (!module_name || !record_id) {
        return res.status(400).json({ error: 'ماژول و شناسه رکورد الزامی است' });
      }

      const sig = db.prepare('SELECT * FROM digital_signatures WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(req.user.id);
      if (!sig) {
        return res.status(400).json({ error: 'ابتدا امضای خود را ذخیره کنید' });
      }

      const existingSign = db.prepare(
        'SELECT * FROM signature_logs WHERE user_id = ? AND module_name = ? AND record_id = ?'
      ).get(req.user.id, module_name, record_id);
      if (existingSign) {
        return res.status(400).json({ error: 'شما قبلاً این رکورد را امضا کرده‌اید' });
      }

      db.prepare(`
        INSERT INTO signature_logs (user_id, signature_id, module_name, record_id, action, ip_address)
        VALUES (?, ?, ?, ?, 'signed', ?)
      `).run(req.user.id, sig.id, module_name, record_id, req.ip || null);

      res.json({ success: true, message: 'امضا ثبت شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // بررسی امضای رکورد
  router.get('/verify/:module/:recordId', (req, res) => {
    try {
      const logs = db.prepare(`
        SELECT sl.*, ds.signature_data, ds.signature_type, ds.scanned_signature, ds.employee_code,
               u.full_name, u.id as user_id
        FROM signature_logs sl
        LEFT JOIN digital_signatures ds ON sl.signature_id = ds.id
        LEFT JOIN users u ON sl.user_id = u.id
        WHERE sl.module_name = ? AND sl.record_id = ?
        ORDER BY sl.created_at ASC
      `).all(req.params.module, req.params.recordId);
      res.json(logs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // تاریخچه امضا
  router.get('/log/:module/:recordId', (req, res) => {
    try {
      const log = db.prepare(`
        SELECT sl.*, u.full_name, ds.signature_data, ds.scanned_signature, ds.employee_code
        FROM signature_logs sl
        LEFT JOIN users u ON sl.user_id = u.id
        LEFT JOIN digital_signatures ds ON sl.signature_id = ds.id
        WHERE sl.module_name = ? AND sl.record_id = ?
        ORDER BY sl.created_at DESC
      `).all(req.params.module, req.params.recordId);
      res.json(log);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // حذف امضا
  router.delete('/:id', (req, res) => {
    try {
      const sig = db.prepare('SELECT * FROM digital_signatures WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
      if (!sig) return res.status(404).json({ error: 'امضا یافت نشد' });
      if (sig.scanned_signature) {
        const filePath = path.join(__dirname, '..', sig.scanned_signature);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
      db.prepare('DELETE FROM digital_signatures WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // آپلود گروهی امضا — استخراج کد پرسنلی از نام فایل
  router.post('/bulk-upload', roleGuard('admin'), uploadBulk.array('signatures', 100), (req, res) => {
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
        const user = db.prepare('SELECT id, full_name FROM users WHERE id = ?').get(parseInt(employeeCode, 10));
        if (!user) {
          results.push({ file: file.originalname, status: 'error', message: `کاربری با کد پرسنلی ${employeeCode} یافت نشد` });
          continue;
        }

        const url = `/uploads/signatures/${file.filename}`;

        const oldSig = db.prepare('SELECT * FROM digital_signatures WHERE user_id = ?').get(user.id);
        if (oldSig && oldSig.scanned_signature) {
          const oldPath = path.join(__dirname, '..', oldSig.scanned_signature);
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
          db.prepare("UPDATE digital_signatures SET scanned_signature = ?, employee_code = ?, signature_type = 'scanned', updated_at = to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text) WHERE user_id = ?")
            .run(url, employeeCode, user.id);
        } else if (oldSig) {
          db.prepare("UPDATE digital_signatures SET scanned_signature = ?, employee_code = ?, signature_type = 'scanned', updated_at = to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text) WHERE user_id = ?")
            .run(url, employeeCode, user.id);
        } else {
          db.prepare('INSERT INTO digital_signatures (user_id, signature_data, signature_type, scanned_signature, employee_code) VALUES (?, ?, ?, ?, ?)')
            .run(user.id, '', 'scanned', url, employeeCode);
        }

        results.push({ file: file.originalname, status: 'ok', employeeCode, userName: user.full_name });
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
