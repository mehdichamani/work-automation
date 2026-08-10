const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware, roleGuard } = require('../middleware/auth');

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

module.exports = function(db) {
  const router = express.Router();

  router.get('/', (req, res) => {
    try {
      const { category, search, target_audience } = req.query;
      let where = 'WHERE e.is_active = true';
      const params = [];
      let paramIdx = 0;

      if (category && category !== 'all') {
        paramIdx++;
        where += ` AND e.category = $${paramIdx}`;
        params.push(category);
      }
      if (search) {
        paramIdx++;
        where += ` AND (e.title ILIKE $${paramIdx} OR e.description ILIKE $${paramIdx})`;
        params.push(`%${search}%`);
      }
      if (target_audience && target_audience !== 'all') {
        paramIdx++;
        where += ` AND e.target_audience = $${paramIdx}`;
        params.push(target_audience);
      }

      const materials = db.prepare(`
        SELECT e.*, u.full_name as uploader_name
        FROM educational_materials e
        LEFT JOIN users u ON e.uploaded_by = u.id
        ${where}
        ORDER BY e.created_at DESC
      `).all(...params);

      res.json(materials);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/:id', (req, res) => {
    try {
      const material = db.prepare(`
        SELECT e.*, u.full_name as uploader_name
        FROM educational_materials e
        LEFT JOIN users u ON e.uploaded_by = u.id
        WHERE e.id = ?
      `).get(req.params.id);

      if (!material) return res.status(404).json({ error: 'محتوای آموزشی یافت نشد' });

      db.prepare('UPDATE educational_materials SET view_count = view_count + 1 WHERE id = ?').run(req.params.id);

      res.json(material);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/', authMiddleware, roleGuard('admin'), upload.single('file'), (req, res) => {
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

      const result = db.prepare(`
        INSERT INTO educational_materials (title, description, category, file_url, file_type, file_size, target_audience, tags, uploaded_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        title.trim(),
        description || '',
        category,
        fileUrl,
        fileType,
        fileSize,
        target_audience || 'all',
        tagsArray,
        req.user.id
      );

      res.json({ message: 'محتوای آموزشی با موفقیت اضافه شد', id: result.lastInsertRowid });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id', authMiddleware, roleGuard('admin'), upload.single('file'), (req, res) => {
    try {
      const { title, description, category, target_audience, tags, is_active } = req.body;
      const existing = db.prepare('SELECT * FROM educational_materials WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'محتوای آموزشی یافت نشد' });

      let fileUrl = existing.file_url;
      let fileType = existing.file_type;
      let fileSize = existing.file_size;

      if (req.file) {
        const oldFilePath = path.join(__dirname, '..', existing.file_url);
        if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
        fileUrl = `/uploads/educational/${req.file.filename}`;
        fileType = req.file.mimetype;
        fileSize = req.file.size;
      }

      let tagsArray = existing.tags;
      if (tags) {
        try { tagsArray = JSON.parse(tags); } catch (e) { tagsArray = [tags]; }
      }

      db.prepare(`
        UPDATE educational_materials
        SET title = ?, description = ?, category = ?, file_url = ?, file_type = ?, file_size = ?,
            target_audience = ?, tags = ?, is_active = ?, updated_at = to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
        WHERE id = ?
      `).run(
        title !== undefined ? title.trim() : existing.title,
        description !== undefined ? description : existing.description,
        category !== undefined ? category : existing.category,
        fileUrl,
        fileType,
        fileSize,
        target_audience !== undefined ? target_audience : existing.target_audience,
        tagsArray,
        is_active !== undefined ? (is_active === 'true' || is_active === true ? 1 : 0) : existing.is_active,
        req.params.id
      );

      res.json({ message: 'محتوای آموزشی ویرایش شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id', authMiddleware, roleGuard('admin'), (req, res) => {
    try {
      const existing = db.prepare('SELECT * FROM educational_materials WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'محتوای آموزشی یافت نشد' });

      const filePath = path.join(__dirname, '..', existing.file_url);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

      if (existing.thumbnail_url) {
        const thumbPath = path.join(__dirname, '..', existing.thumbnail_url);
        if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
      }

      db.prepare('DELETE FROM educational_materials WHERE id = ?').run(req.params.id);
      res.json({ message: 'محتوای آموزشی حذف شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};