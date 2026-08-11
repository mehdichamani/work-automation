const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware } = require('../middleware/auth');
const prisma = require('../database/prisma');
const { mapRow, flattenJoins } = require('../utils/dbAdapter');

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

module.exports = function() {
  const router = express.Router();
  router.use(authMiddleware);

  router.post('/single', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'فایلی انتخاب نشده' });
      const { module_name, record_id } = req.body;

      const url = `/uploads/attachments/${req.file.filename}`;

      await prisma.attachment.create({
        data: {
          userId: Number(req.user.id),
          filename: req.file.filename,
          originalName: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          url,
          moduleName: module_name || null,
          recordId: record_id ? Number(record_id) : null,
        },
      });

      res.json({ url, filename: req.file.filename, originalName: req.file.originalname, size: req.file.size });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/multiple', upload.array('files', 5), async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'فایلی انتخاب نشده' });
      const { module_name, record_id } = req.body;

      await prisma.attachment.createMany({
        data: req.files.map(file => ({
          userId: Number(req.user.id),
          filename: file.filename,
          originalName: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          url: `/uploads/attachments/${file.filename}`,
          moduleName: module_name || null,
          recordId: record_id ? Number(record_id) : null,
        })),
      });

      const results = req.files.map(file => ({
        url: `/uploads/attachments/${file.filename}`,
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
      }));

      res.json(results);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/list', async (req, res) => {
    try {
      const { module_name, record_id } = req.query;
      const where = {};
      if (module_name) { where.moduleName = module_name; }
      if (record_id) { where.recordId = Number(record_id); }

      const files = await prisma.attachment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { fullName: true } },
        },
      });
      const mapped = files.map(r => flattenJoins(r, { uploader_name: 'user.fullName' }));
      res.json(mapRow(mapped));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const file = await prisma.attachment.findUnique({ where: { id: Number(req.params.id) } });
      if (!file) return res.status(404).json({ error: 'فایل یافت نشد' });
      if (file.userId !== Number(req.user.id) && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }

      const filePath = path.join(__dirname, '..', file.url);
      const resolvedPath = path.resolve(filePath);
      const uploadsDir = path.resolve(path.join(__dirname, '..', 'uploads'));
      if (!resolvedPath.startsWith(uploadsDir)) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      if (fs.existsSync(resolvedPath)) fs.unlinkSync(resolvedPath);

      await prisma.attachment.delete({ where: { id: Number(req.params.id) } });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
