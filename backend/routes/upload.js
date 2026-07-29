const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads', 'attachments');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, name);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'application/zip',
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('نوع فایل پشتیبانی نمی‌شود'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
});

module.exports = function(db) {
  const router = express.Router();
  router.use(authMiddleware);

  router.post('/single', upload.single('file'), (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'فایلی انتخاب نشده' });
      const { module_name, record_id } = req.body;

      const url = `/uploads/attachments/${req.file.filename}`;

      db.prepare(`INSERT INTO attachments (user_id, filename, original_name, mimetype, size, url, module_name, record_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
        req.user.id, req.file.filename, req.file.originalname, req.file.mimetype,
        req.file.size, url, module_name || null, record_id || null
      );

      res.json({ url, filename: req.file.filename, originalName: req.file.originalname, size: req.file.size });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/multiple', upload.array('files', 5), (req, res) => {
    try {
      if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'فایلی انتخاب نشده' });
      const { module_name, record_id } = req.body;

      const results = req.files.map(file => {
        const url = `/uploads/attachments/${file.filename}`;
        db.prepare(`INSERT INTO attachments (user_id, filename, original_name, mimetype, size, url, module_name, record_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
          req.user.id, file.filename, file.originalname, file.mimetype,
          file.size, url, module_name || null, record_id || null
        );
        return { url, filename: file.filename, originalName: file.originalname, size: file.size };
      });

      res.json(results);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/list', (req, res) => {
    try {
      const { module_name, record_id } = req.query;
      let where = 'WHERE 1=1';
      const params = [];
      if (module_name) { where += ' AND module_name = ?'; params.push(module_name); }
      if (record_id) { where += ' AND record_id = ?'; params.push(record_id); }

      const files = db.prepare(`SELECT a.*, u.full_name as uploader_name
        FROM attachments a LEFT JOIN users u ON a.user_id = u.id
        ${where} ORDER BY a.created_at DESC`).all(...params);
      res.json(files);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id', (req, res) => {
    try {
      const file = db.prepare('SELECT * FROM attachments WHERE id = ?').get(req.params.id);
      if (!file) return res.status(404).json({ error: 'فایل یافت نشد' });
      if (file.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }

      const filePath = path.join(__dirname, '..', file.url);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

      db.prepare('DELETE FROM attachments WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
