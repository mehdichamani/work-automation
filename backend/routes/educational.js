const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware, roleGuard } = require('../middleware/auth');
const prisma = require('../database/prisma');
const { mapRow, flattenJoins } = require('../utils/dbAdapter');

const uploadDir = path.join(__dirname, '..', 'uploads', 'educational');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, unique + ext);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'application/pdf',
    'video/mp4', 'video/avi', 'video/quicktime', 'video/x-msvideo',
    'video/x-matroska', 'video/webm',
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3', 'audio/aac', 'audio/x-m4a',
  ];
  const allowedExts = ['.pdf', '.mp4', '.avi', '.mov', '.mkv', '.webm', '.mp3', '.wav', '.ogg', '.aac', '.m4a'];
  const ext = path.extname(file.originalname).toLowerCase();
  const isMimeAllowed = allowedMimes.includes(file.mimetype);
  const isExtAllowed = allowedExts.includes(ext);
  if (isMimeAllowed && isExtAllowed) {
    cb(null, true);
  } else {
    cb(new Error('فرمت فایل پشتیبانی نمی‌شود. فقط PDF و فیلم‌های MP4، AVI، MOV، MKV، WebM پذیرفته می‌شوند'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }
});

module.exports = function() {
  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      const { category, search, target_audience } = req.query;
      const where = { isActive: true };

      if (category && category !== 'all') {
        where.category = category;
      }
      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }
      if (target_audience && target_audience !== 'all') {
        where.targetAudience = target_audience;
      }

      const rows = await prisma.educationalMaterial.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { uploader: { select: { fullName: true } } },
      });

      const materials = rows.map(r => flattenJoins(r, { uploader_name: 'uploader.fullName' }));
      res.json(mapRow(materials));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const material = await prisma.educationalMaterial.findUnique({
        where: { id: Number(req.params.id) },
        include: { uploader: { select: { fullName: true } } },
      });

      if (!material) return res.status(404).json({ error: 'محتوای آموزشی یافت نشد' });

      await prisma.educationalMaterial.update({
        where: { id: Number(req.params.id) },
        data: { viewCount: { increment: 1 } },
      });

      res.json(mapRow(flattenJoins(material, { uploader_name: 'uploader.fullName' })));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/', authMiddleware, roleGuard('admin'), upload.single('file'), async (req, res) => {
    try {
      const { title, description, category, target_audience, tags } = req.body;

      if (!title || !title.trim()) {
        return res.status(400).json({ error: 'عنوان الزامی است' });
      }
      if (!category) {
        return res.status(400).json({ error: 'دسته‌بندی الزامی است' });
      }
      if (!req.file) {
        return res.status(400).json({ error: 'فایل الزامی است' });
      }

      const fileUrl = `/uploads/educational/${req.file.filename}`;
      const fileType = req.file.mimetype;
      const fileSize = req.file.size;

      let tagsArray = null;
      if (tags) {
        try { tagsArray = JSON.parse(tags); } catch (e) { tagsArray = [tags]; }
      }

      const result = await prisma.educationalMaterial.create({
        data: {
          title: title.trim(),
          description: description || '',
          category,
          fileUrl,
          fileType,
          fileSize,
          targetAudience: target_audience || 'all',
          tags: tagsArray || [],
          uploadedBy: req.user.id,
        },
      });

      res.json({ message: 'محتوای آموزشی با موفقیت اضافه شد', id: result.id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id', authMiddleware, roleGuard('admin'), upload.single('file'), async (req, res) => {
    try {
      const { title, description, category, target_audience, tags, is_active } = req.body;
      const existing = await prisma.educationalMaterial.findUnique({ where: { id: Number(req.params.id) } });
      if (!existing) return res.status(404).json({ error: 'محتوای آموزشی یافت نشد' });

      let fileUrl = existing.fileUrl;
      let fileType = existing.fileType;
      let fileSize = existing.fileSize;

      if (req.file) {
        const oldFilePath = path.join(__dirname, '..', existing.fileUrl);
        if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
        fileUrl = `/uploads/educational/${req.file.filename}`;
        fileType = req.file.mimetype;
        fileSize = req.file.size;
      }

      let tagsArray = existing.tags;
      if (tags) {
        try { tagsArray = JSON.parse(tags); } catch (e) { tagsArray = [tags]; }
      }

      const data = {
        title: title !== undefined ? title.trim() : existing.title,
        description: description !== undefined ? description : existing.description,
        category: category !== undefined ? category : existing.category,
        fileUrl,
        fileType,
        fileSize,
        targetAudience: target_audience !== undefined ? target_audience : existing.targetAudience,
        tags: tagsArray || [],
        isActive: is_active !== undefined ? (is_active === 'true' || is_active === true) : existing.isActive,
      };

      await prisma.educationalMaterial.update({
        where: { id: Number(req.params.id) },
        data,
      });

      res.json({ message: 'محتوای آموزشی ویرایش شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id', authMiddleware, roleGuard('admin'), async (req, res) => {
    try {
      const existing = await prisma.educationalMaterial.findUnique({ where: { id: Number(req.params.id) } });
      if (!existing) return res.status(404).json({ error: 'محتوای آموزشی یافت نشد' });

      const filePath = path.join(__dirname, '..', existing.fileUrl);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

      if (existing.thumbnailUrl) {
        const thumbPath = path.join(__dirname, '..', existing.thumbnailUrl);
        if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
      }

      await prisma.educationalMaterial.delete({ where: { id: Number(req.params.id) } });
      res.json({ message: 'محتوای آموزشی حذف شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
