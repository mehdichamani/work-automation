const express = require('express');
const path = require('path');
const fs = require('fs');
const { authMiddleware, roleGuard } = require('../middleware/auth');
const prisma = require('../database/prisma');
const { mapRow, flattenJoins } = require('../utils/dbAdapter');

function saveBase64Image(base64Data) {
  const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!matches) return null;
  const ext = matches[1].toLowerCase();
  const allowed = ['jpeg', 'jpg', 'png', 'gif', 'webp'];
  if (!allowed.includes(ext)) return null;

  const buffer = Buffer.from(matches[2], 'base64');
  const MAX_SIZE = 5 * 1024 * 1024;
  if (buffer.length > MAX_SIZE) return null;

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

module.exports = function() {
  const router = express.Router();
  router.use(authMiddleware);

  router.get('/', roleGuard('admin'), async (req, res) => {
    try {
      const announcements = await prisma.announcement.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          creator: { select: { fullName: true } },
        },
      });
      const mapped = announcements.map(r => flattenJoins(r, { creator_name: 'creator.fullName' }));
      res.json(mapRow(mapped));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/active', async (req, res) => {
    try {
      const role = req.user.role;
      let audiences = ['all'];

      if (role === 'admin' || role === 'manager') {
        audiences.push('manager');
      } else if (role === 'supervisor') {
        audiences.push('supervisor');
      }

      const announcements = await prisma.announcement.findMany({
        where: { isActive: true, targetAudience: { in: audiences } },
        orderBy: { createdAt: 'desc' },
        include: {
          creator: { select: { fullName: true } },
        },
      });
      const mapped = announcements.map(r => flattenJoins(r, { creator_name: 'creator.fullName' }));
      res.json(mapRow(mapped));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/', roleGuard('admin'), async (req, res) => {
    try {
      const { title, body, target_audience, priority, image } = req.body;
      if (!title || !title.trim()) {
        return res.status(400).json({ error: 'عنوان الزامی است' });
      }

      let imagePath = null;
      if (image) {
        imagePath = saveBase64Image(image);
      }

      const result = await prisma.announcement.create({
        data: {
          title: title.trim(),
          body: body || '',
          imagePath,
          targetAudience: target_audience || 'all',
          priority: priority || 'normal',
          createdBy: Number(req.user.id),
        },
      });

      const targetRoles = [];
      if (target_audience === 'all') {
        targetRoles.push('admin', 'manager', 'supervisor', 'user');
      } else if (target_audience === 'manager') {
        targetRoles.push('admin', 'manager');
      } else if (target_audience === 'supervisor') {
        targetRoles.push('supervisor');
      }

      if (targetRoles.length > 0) {
        const users = await prisma.user.findMany({
          where: { role: { in: targetRoles }, isActive: true },
          select: { id: true },
        });
        if (users.length > 0) {
          await prisma.notification.createMany({
            data: users.map(u => ({
              userId: u.id,
              title: `📢 ${title.trim()}`,
              body: body || '',
              link: '/dashboard',
            })),
          });
        }
      }

      res.json({ message: 'اطلاعیه ایجاد شد', id: result.id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id', roleGuard('admin'), async (req, res) => {
    try {
      const { title, body, target_audience, priority, is_active, image } = req.body;
      const existing = await prisma.announcement.findUnique({ where: { id: Number(req.params.id) } });
      if (!existing) {
        return res.status(404).json({ error: 'اطلاعیه یافت نشد' });
      }

      let imagePath = existing.imagePath;
      if (image === null) {
        deleteImageFile(existing.imagePath);
        imagePath = null;
      } else if (image && image.startsWith('data:image')) {
        deleteImageFile(existing.imagePath);
        imagePath = saveBase64Image(image);
      }

      await prisma.announcement.update({
        where: { id: Number(req.params.id) },
        data: {
          title: title !== undefined ? title : existing.title,
          body: body !== undefined ? body : existing.body,
          imagePath,
          targetAudience: target_audience || existing.targetAudience,
          priority: priority || existing.priority,
          isActive: is_active !== undefined ? !!Number(is_active) : existing.isActive,
        },
      });

      res.json({ message: 'اطلاعیه ویرایش شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id', roleGuard('admin'), async (req, res) => {
    try {
      const existing = await prisma.announcement.findUnique({ where: { id: Number(req.params.id) } });
      if (!existing) {
        return res.status(404).json({ error: 'اطلاعیه یافت نشد' });
      }

      deleteImageFile(existing.imagePath);
      await prisma.announcement.delete({ where: { id: Number(req.params.id) } });
      res.json({ message: 'اطلاعیه حذف شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
