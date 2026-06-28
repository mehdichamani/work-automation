const express = require('express');
const path = require('path');
const fs = require('fs');
const { authMiddleware, roleGuard } = require('../middleware/auth');

function saveBase64Image(base64Data) {
  const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!matches) return null;
  const ext = matches[1];
  const buffer = Buffer.from(matches[2], 'base64');
  const filename = Date.now() + '-' + Math.round(Math.random() * 1E9) + '.' + ext;
  const dir = path.join(__dirname, '..', 'uploads', 'announcements');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), buffer);
  return `/uploads/announcements/${filename}`;
}

function deleteImageFile(imagePath) {
  if (!imagePath) return;
  const fullPath = path.join(__dirname, '..', imagePath);
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
}

module.exports = function(db) {
  const router = express.Router();
  router.use(authMiddleware);

  router.get('/', roleGuard('admin'), (req, res) => {
    try {
      const announcements = db.prepare(`
        SELECT a.*, u.full_name as creator_name 
        FROM announcements a 
        LEFT JOIN users u ON a.created_by = u.id 
        ORDER BY a.created_at DESC
      `).all();
      res.json(announcements);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/active', (req, res) => {
    try {
      const role = req.user.role;
      let audienceFilter = '';
      
      if (role === 'admin' || role === 'manager') {
        audienceFilter = "(target_audience = 'all' OR target_audience = 'manager')";
      } else if (role === 'supervisor') {
        audienceFilter = "(target_audience = 'all' OR target_audience = 'supervisor')";
      } else {
        audienceFilter = "target_audience = 'all'";
      }

      const announcements = db.prepare(`
        SELECT a.*, u.full_name as creator_name 
        FROM announcements a 
        LEFT JOIN users u ON a.created_by = u.id 
        WHERE a.is_active = 1 AND ${audienceFilter}
        ORDER BY a.created_at DESC
      `).all();
      res.json(announcements);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/', roleGuard('admin'), (req, res) => {
    try {
      const { title, body, target_audience, priority, image } = req.body;
      if (!title || !title.trim()) {
        return res.status(400).json({ error: 'عنوان الزامی است' });
      }

      let imagePath = null;
      if (image) {
        imagePath = saveBase64Image(image);
      }

      const result = db.prepare(`
        INSERT INTO announcements (title, body, image_path, target_audience, priority, created_by) 
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(title.trim(), body || '', imagePath, target_audience || 'all', priority || 'normal', req.user.id);

      const targetRoles = [];
      if (target_audience === 'all') {
        targetRoles.push('admin', 'manager', 'supervisor', 'user');
      } else if (target_audience === 'manager') {
        targetRoles.push('admin', 'manager');
      } else if (target_audience === 'supervisor') {
        targetRoles.push('supervisor');
      }

      if (targetRoles.length > 0) {
        const placeholders = targetRoles.map(() => '?').join(',');
        const users = db.prepare(`SELECT id FROM users WHERE role IN (${placeholders}) AND is_active = 1`).all(...targetRoles);
        const insertNotif = db.prepare(`INSERT INTO notifications (user_id, title, body, link) VALUES (?, ?, ?, ?)`);
        for (const u of users) {
          insertNotif.run(u.id, `📢 ${title.trim()}`, body || '', '/dashboard');
        }
      }

      res.json({ message: 'اطلاعیه ایجاد شد', id: result.lastInsertRowid });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id', roleGuard('admin'), (req, res) => {
    try {
      const { title, body, target_audience, priority, is_active, image } = req.body;
      const existing = db.prepare('SELECT * FROM announcements WHERE id = ?').get(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: 'اطلاعیه یافت نشد' });
      }

      let imagePath = existing.image_path;
      if (image === null) {
        deleteImageFile(existing.image_path);
        imagePath = null;
      } else if (image && image.startsWith('data:image')) {
        deleteImageFile(existing.image_path);
        imagePath = saveBase64Image(image);
      }

      db.prepare(`
        UPDATE announcements SET title = ?, body = ?, image_path = ?, target_audience = ?, priority = ?, is_active = ?
        WHERE id = ?
      `).run(
        title !== undefined ? title : existing.title,
        body !== undefined ? body : existing.body,
        imagePath,
        target_audience || existing.target_audience,
        priority || existing.priority,
        is_active !== undefined ? Number(is_active) : existing.is_active,
        req.params.id
      );

      res.json({ message: 'اطلاعیه ویرایش شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id', roleGuard('admin'), (req, res) => {
    try {
      const existing = db.prepare('SELECT * FROM announcements WHERE id = ?').get(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: 'اطلاعیه یافت نشد' });
      }

      deleteImageFile(existing.image_path);
      db.prepare('DELETE FROM announcements WHERE id = ?').run(req.params.id);
      res.json({ message: 'اطلاعیه حذف شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
