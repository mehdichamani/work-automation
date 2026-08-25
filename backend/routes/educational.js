const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware } = require('../middleware/auth');
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
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 250 * 1024 * 1024 } // 250MB
});

const educationalUpload = upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 },
  { name: 'attachments', maxCount: 10 }
]);

async function canManageEducational(user) {
  if (!user) return false;
  if (user.role === 'admin') return true;

  try {
    const userPerm = await prisma.permission.findFirst({
      where: { userId: Number(user.id), moduleKey: 'learning_manage' }
    });
    if (userPerm) return !!userPerm.isEnabled;

    if (user.department_id) {
      const deptPerm = await prisma.permission.findFirst({
        where: { departmentId: Number(user.department_id), userId: null, moduleKey: 'learning_manage' }
      });
      if (deptPerm) return !!deptPerm.isEnabled;
    }
  } catch (err) {
    console.error('Error checking educational permissions:', err);
  }
  return false;
}

const requireEducationalManager = async (req, res, next) => {
  const allowed = await canManageEducational(req.user);
  if (!allowed) {
    return res.status(403).json({ error: 'شما دسترسی مدیریت محتوای آموزشی را ندارید' });
  }
  next();
};

module.exports = function() {
  const router = express.Router();
  router.use(authMiddleware);

  // ==========================================
  // CATEGORIES CRUD
  // ==========================================

  // GET /api/educational/categories
  router.get('/categories', async (req, res) => {
    try {
      const categories = await prisma.educationalCategory.findMany({
        where: { isActive: true },
        orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
        include: {
          _count: {
            select: { materials: { where: { isActive: true } } }
          }
        }
      });

      const result = categories.map(cat => ({
        id: cat.id,
        title: cat.title,
        description: cat.description,
        icon: cat.icon || '📁',
        color: cat.color || '#3B82F6',
        order_index: cat.orderIndex,
        is_active: cat.isActive,
        material_count: cat._count?.materials || 0,
        created_at: cat.createdAt,
      }));

      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/educational/categories
  router.post('/categories', requireEducationalManager, async (req, res) => {
    try {
      const { title, description, icon, color, order_index } = req.body;
      if (!title || !title.trim()) {
        return res.status(400).json({ error: 'عنوان دسته‌بندی الزامی است' });
      }

      const existing = await prisma.educationalCategory.findUnique({
        where: { title: title.trim() }
      });
      if (existing) {
        return res.status(400).json({ error: 'دسته‌بندی با این عنوان قبلاً ثبت شده است' });
      }

      const cat = await prisma.educationalCategory.create({
        data: {
          title: title.trim(),
          description: description ? description.trim() : '',
          icon: icon || '📁',
          color: color || '#3B82F6',
          orderIndex: order_index !== undefined ? Number(order_index) : 0,
        }
      });

      res.json({ message: 'دسته‌بندی با موفقیت ایجاد شد', category: mapRow(cat) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/educational/categories/:id
  router.put('/categories/:id', requireEducationalManager, async (req, res) => {
    try {
      const catId = Number(req.params.id);
      const { title, description, icon, color, order_index, is_active } = req.body;

      const existing = await prisma.educationalCategory.findUnique({ where: { id: catId } });
      if (!existing) {
        return res.status(404).json({ error: 'دسته‌بندی یافت نشد' });
      }

      const data = {};
      if (title !== undefined) data.title = title.trim();
      if (description !== undefined) data.description = description.trim();
      if (icon !== undefined) data.icon = icon;
      if (color !== undefined) data.color = color;
      if (order_index !== undefined) data.orderIndex = Number(order_index);
      if (is_active !== undefined) data.isActive = !!is_active;

      const updated = await prisma.educationalCategory.update({
        where: { id: catId },
        data,
      });

      res.json({ message: 'دسته‌بندی با موفقیت ویرایش شد', category: mapRow(updated) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/educational/categories/:id
  router.delete('/categories/:id', requireEducationalManager, async (req, res) => {
    try {
      const catId = Number(req.params.id);
      const count = await prisma.educationalMaterial.count({ where: { categoryId: catId } });
      if (count > 0) {
        return res.status(400).json({ error: `امکان حذف وجود ندارد؛ تعداد ${count} محتوا در این دسته‌بندی ثبت است.` });
      }

      await prisma.educationalCategory.delete({ where: { id: catId } });
      res.json({ message: 'دسته‌بندی حذف شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // USER STATS & PROGRESS
  // ==========================================

  // GET /api/educational/my-stats
  router.get('/my-stats', async (req, res) => {
    try {
      const userId = Number(req.user.id);
      const totalMaterials = await prisma.educationalMaterial.count({ where: { isActive: true } });
      const completedCount = await prisma.userLearningProgress.count({
        where: { userId, isCompleted: true, material: { isActive: true } }
      });
      const bookmarkedCount = await prisma.userLearningProgress.count({
        where: { userId, isBookmarked: true, material: { isActive: true } }
      });

      res.json({
        total: totalMaterials,
        completed: completedCount,
        bookmarked: bookmarkedCount,
        progress_percentage: totalMaterials > 0 ? Math.round((completedCount / totalMaterials) * 100) : 0
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/educational/:id/progress
  router.post('/:id/progress', async (req, res) => {
    try {
      const materialId = Number(req.params.id);
      const userId = Number(req.user.id);
      const { is_completed, is_bookmarked } = req.body;

      const existing = await prisma.userLearningProgress.findUnique({
        where: { userId_materialId: { userId, materialId } }
      });

      const completed = is_completed !== undefined ? !!is_completed : (existing ? existing.isCompleted : false);
      const bookmarked = is_bookmarked !== undefined ? !!is_bookmarked : (existing ? existing.isBookmarked : false);

      const progress = await prisma.userLearningProgress.upsert({
        where: { userId_materialId: { userId, materialId } },
        create: {
          userId,
          materialId,
          isCompleted: completed,
          isBookmarked: bookmarked,
          completedAt: completed ? new Date() : null,
        },
        update: {
          isCompleted: completed,
          isBookmarked: bookmarked,
          completedAt: completed ? (existing?.completedAt || new Date()) : null,
        }
      });

      res.json({ message: 'وضعیت پیشرفت به‌روزرسانی شد', progress: mapRow(progress) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // MATERIALS CRUD & LISTING
  // ==========================================

  // GET /api/educational
  router.get('/', async (req, res) => {
    try {
      const {
        category_id,
        content_type,
        search,
        target_audience,
        difficulty,
        bookmarked,
        completed,
        is_pinned
      } = req.query;

      const isManager = await canManageEducational(req.user);
      const where = {};

      if (!isManager) {
        where.isActive = true;

        // Department and role targeting filter
        const userRole = req.user.role;
        const userDeptId = req.user.department_id ? Number(req.user.department_id) : null;

        const audienceConditions = [{ targetAudience: 'all' }, { targetAudience: null }];
        if (userRole === 'manager' || userRole === 'admin') {
          audienceConditions.push({ targetAudience: 'manager' });
        }
        if (userRole === 'supervisor' || userRole === 'manager' || userRole === 'admin') {
          audienceConditions.push({ targetAudience: 'supervisor' });
        }

        const deptConditions = [{ targetDepartmentId: null }];
        if (userDeptId) {
          deptConditions.push({ targetDepartmentId: userDeptId });
        }

        where.AND = [
          { OR: audienceConditions },
          { OR: deptConditions }
        ];
      }

      if (category_id && category_id !== 'all') {
        where.categoryId = Number(category_id);
      }
      if (content_type && content_type !== 'all') {
        where.contentType = content_type;
      }
      if (difficulty && difficulty !== 'all') {
        where.difficulty = difficulty;
      }
      if (is_pinned === 'true') {
        where.isPinned = true;
      }
      if (search) {
        const searchCond = [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
        if (where.AND) {
          where.AND.push({ OR: searchCond });
        } else {
          where.OR = searchCond;
        }
      }

      const rows = await prisma.educationalMaterial.findMany({
        where,
        orderBy: [
          { isPinned: 'desc' },
          { createdAt: 'desc' }
        ],
        include: {
          uploader: { select: { id: true, fullName: true, role: true } },
          educationalCategory: { select: { id: true, title: true, icon: true, color: true } },
          targetDepartment: { select: { id: true, name: true } },
          attachments: { select: { id: true, title: true, fileUrl: true, fileType: true, fileSize: true } },
          userProgress: {
            where: { userId: Number(req.user.id) },
            select: { isCompleted: true, isBookmarked: true, completedAt: true }
          }
        },
      });

      let mapped = rows.map(r => {
        const myProgress = r.userProgress && r.userProgress.length > 0 ? r.userProgress[0] : null;
        return {
          id: r.id,
          title: r.title,
          description: r.description || '',
          category_id: r.categoryId,
          category_title: r.educationalCategory?.title || r.category || 'عمومی',
          category_icon: r.educationalCategory?.icon || '📁',
          category_color: r.educationalCategory?.color || '#3B82F6',
          content_type: r.contentType || 'pdf',
          media_source: r.mediaSource || 'upload',
          file_url: r.fileUrl,
          file_type: r.fileType,
          file_size: r.fileSize,
          content_text: r.contentText,
          embed_code: r.embedCode,
          thumbnail_url: r.thumbnailUrl,
          duration_minutes: r.durationMinutes,
          difficulty: r.difficulty || 'all',
          target_audience: r.targetAudience || 'all',
          target_department_id: r.targetDepartmentId,
          target_department_name: r.targetDepartment?.name || null,
          is_pinned: r.isPinned,
          tags: r.tags || [],
          is_active: r.isActive,
          view_count: r.viewCount || 0,
          created_at: r.createdAt,
          updated_at: r.updatedAt,
          uploader_name: r.uploader?.fullName || 'ناشناس',
          attachments: (r.attachments || []).map(a => ({
            id: a.id,
            title: a.title,
            file_url: a.fileUrl,
            file_type: a.fileType,
            file_size: a.fileSize,
          })),
          is_completed: myProgress?.isCompleted || false,
          is_bookmarked: myProgress?.isBookmarked || false,
          completed_at: myProgress?.completedAt || null,
        };
      });

      if (bookmarked === 'true') {
        mapped = mapped.filter(m => m.is_bookmarked);
      }
      if (completed === 'true') {
        mapped = mapped.filter(m => m.is_completed);
      }

      res.json(mapped);
    } catch (err) {
      console.error('Error fetching educational materials:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/educational/:id
  router.get('/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const material = await prisma.educationalMaterial.findUnique({
        where: { id },
        include: {
          uploader: { select: { id: true, fullName: true, role: true } },
          educationalCategory: { select: { id: true, title: true, icon: true, color: true } },
          targetDepartment: { select: { id: true, name: true } },
          attachments: true,
          userProgress: {
            where: { userId: Number(req.user.id) },
          }
        },
      });

      if (!material) return res.status(404).json({ error: 'محتوای آموزشی یافت نشد' });

      // Increment view count asynchronously
      await prisma.educationalMaterial.update({
        where: { id },
        data: { viewCount: { increment: 1 } },
      }).catch(() => {});

      const myProgress = material.userProgress && material.userProgress.length > 0 ? material.userProgress[0] : null;

      res.json({
        id: material.id,
        title: material.title,
        description: material.description || '',
        category_id: material.categoryId,
        category_title: material.educationalCategory?.title || material.category || 'عمومی',
        category_icon: material.educationalCategory?.icon || '📁',
        category_color: material.educationalCategory?.color || '#3B82F6',
        content_type: material.contentType || 'pdf',
        media_source: material.mediaSource || 'upload',
        file_url: material.fileUrl,
        file_type: material.fileType,
        file_size: material.fileSize,
        content_text: material.contentText,
        embed_code: material.embedCode,
        thumbnail_url: material.thumbnailUrl,
        duration_minutes: material.durationMinutes,
        difficulty: material.difficulty || 'all',
        target_audience: material.targetAudience || 'all',
        target_department_id: material.targetDepartmentId,
        target_department_name: material.targetDepartment?.name || null,
        is_pinned: material.isPinned,
        tags: material.tags || [],
        is_active: material.isActive,
        view_count: (material.viewCount || 0) + 1,
        created_at: material.createdAt,
        updated_at: material.updatedAt,
        uploader_name: material.uploader?.fullName || 'ناشناس',
        attachments: (material.attachments || []).map(a => ({
          id: a.id,
          title: a.title,
          file_url: a.fileUrl,
          file_type: a.fileType,
          file_size: a.fileSize,
        })),
        is_completed: myProgress?.isCompleted || false,
        is_bookmarked: myProgress?.isBookmarked || false,
        completed_at: myProgress?.completedAt || null,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/educational
  router.post('/', requireEducationalManager, educationalUpload, async (req, res) => {
    try {
      const {
        title,
        description,
        category_id,
        content_type,
        media_source,
        external_url,
        content_text,
        embed_code,
        duration_minutes,
        difficulty,
        target_audience,
        target_department_id,
        is_pinned,
        tags,
      } = req.body;

      if (!title || !title.trim()) {
        return res.status(400).json({ error: 'عنوان آموزش الزامی است' });
      }

      const cType = content_type || 'pdf';
      const mSource = media_source || 'upload';

      let fileUrl = null;
      let fileType = null;
      let fileSize = 0;

      if (mSource === 'upload') {
        if (req.files && req.files['file'] && req.files['file'][0]) {
          const mainFile = req.files['file'][0];
          fileUrl = `/uploads/educational/${mainFile.filename}`;
          fileType = mainFile.mimetype;
          fileSize = mainFile.size;
        } else if (cType !== 'article') {
          return res.status(400).json({ error: 'فایل آموزش انتخاب نشده است' });
        }
      } else if (mSource === 'external_url') {
        if (!external_url || !external_url.trim()) {
          return res.status(400).json({ error: 'لینک مستقیم الزامی است' });
        }
        fileUrl = external_url.trim();
        fileType = 'external';
      }

      let thumbnailUrl = null;
      if (req.files && req.files['thumbnail'] && req.files['thumbnail'][0]) {
        thumbnailUrl = `/uploads/educational/${req.files['thumbnail'][0].filename}`;
      } else if (req.body.thumbnail_url) {
        thumbnailUrl = req.body.thumbnail_url;
      }

      let tagsArray = [];
      if (tags) {
        try {
          tagsArray = typeof tags === 'string' ? JSON.parse(tags) : tags;
        } catch (e) {
          tagsArray = tags.split(',').map(t => t.trim()).filter(Boolean);
        }
      }

      const created = await prisma.educationalMaterial.create({
        data: {
          title: title.trim(),
          description: description || '',
          categoryId: category_id ? Number(category_id) : null,
          category: cType,
          contentType: cType,
          mediaSource: mSource,
          fileUrl,
          fileType,
          fileSize,
          contentText: content_text || null,
          embedCode: embed_code || null,
          thumbnailUrl,
          durationMinutes: duration_minutes ? Number(duration_minutes) : null,
          difficulty: difficulty || 'all',
          targetAudience: target_audience || 'all',
          targetDepartmentId: target_department_id ? Number(target_department_id) : null,
          isPinned: is_pinned === 'true' || is_pinned === true,
          tags: tagsArray,
          uploadedBy: Number(req.user.id),
        },
      });

      // Handle multiple attachments if uploaded
      if (req.files && req.files['attachments'] && req.files['attachments'].length > 0) {
        const attachmentData = req.files['attachments'].map(att => ({
          materialId: created.id,
          title: Buffer.from(att.originalname, 'latin1').toString('utf8'),
          fileUrl: `/uploads/educational/${att.filename}`,
          fileType: att.mimetype,
          fileSize: att.size,
        }));
        await prisma.educationalAttachment.createMany({ data: attachmentData });
      }

      res.json({ message: 'محتوای آموزشی با موفقیت اضافه شد', id: created.id });
    } catch (err) {
      console.error('Error creating educational material:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/educational/:id
  router.put('/:id', requireEducationalManager, educationalUpload, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const existing = await prisma.educationalMaterial.findUnique({
        where: { id },
        include: { attachments: true }
      });
      if (!existing) return res.status(404).json({ error: 'محتوای آموزشی یافت نشد' });

      const {
        title,
        description,
        category_id,
        content_type,
        media_source,
        external_url,
        content_text,
        embed_code,
        duration_minutes,
        difficulty,
        target_audience,
        target_department_id,
        is_pinned,
        is_active,
        tags,
      } = req.body;

      let fileUrl = existing.fileUrl;
      let fileType = existing.fileType;
      let fileSize = existing.fileSize;

      const mSource = media_source !== undefined ? media_source : existing.mediaSource;

      if (mSource === 'upload') {
        if (req.files && req.files['file'] && req.files['file'][0]) {
          const oldFilePath = existing.fileUrl && !existing.fileUrl.startsWith('http')
            ? path.join(__dirname, '..', existing.fileUrl)
            : null;
          if (oldFilePath && fs.existsSync(oldFilePath)) {
            try { fs.unlinkSync(oldFilePath); } catch (e) {}
          }

          const mainFile = req.files['file'][0];
          fileUrl = `/uploads/educational/${mainFile.filename}`;
          fileType = mainFile.mimetype;
          fileSize = mainFile.size;
        }
      } else if (mSource === 'external_url') {
        if (external_url) {
          fileUrl = external_url.trim();
          fileType = 'external';
          fileSize = 0;
        }
      }

      let thumbnailUrl = existing.thumbnailUrl;
      if (req.files && req.files['thumbnail'] && req.files['thumbnail'][0]) {
        const oldThumbPath = existing.thumbnailUrl && !existing.thumbnailUrl.startsWith('http')
          ? path.join(__dirname, '..', existing.thumbnailUrl)
          : null;
        if (oldThumbPath && fs.existsSync(oldThumbPath)) {
          try { fs.unlinkSync(oldThumbPath); } catch (e) {}
        }
        thumbnailUrl = `/uploads/educational/${req.files['thumbnail'][0].filename}`;
      } else if (req.body.thumbnail_url !== undefined) {
        thumbnailUrl = req.body.thumbnail_url || null;
      }

      let tagsArray = existing.tags;
      if (tags !== undefined) {
        try {
          tagsArray = typeof tags === 'string' ? JSON.parse(tags) : tags;
        } catch (e) {
          tagsArray = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];
        }
      }

      const data = {
        title: title !== undefined ? title.trim() : existing.title,
        description: description !== undefined ? description : existing.description,
        categoryId: category_id !== undefined ? (category_id ? Number(category_id) : null) : existing.categoryId,
        contentType: content_type !== undefined ? content_type : existing.contentType,
        mediaSource: mSource,
        fileUrl,
        fileType,
        fileSize,
        contentText: content_text !== undefined ? content_text : existing.contentText,
        embedCode: embed_code !== undefined ? embed_code : existing.embedCode,
        thumbnailUrl,
        durationMinutes: duration_minutes !== undefined ? (duration_minutes ? Number(duration_minutes) : null) : existing.durationMinutes,
        difficulty: difficulty !== undefined ? difficulty : existing.difficulty,
        targetAudience: target_audience !== undefined ? target_audience : existing.targetAudience,
        targetDepartmentId: target_department_id !== undefined ? (target_department_id ? Number(target_department_id) : null) : existing.targetDepartmentId,
        isPinned: is_pinned !== undefined ? (is_pinned === 'true' || is_pinned === true) : existing.isPinned,
        isActive: is_active !== undefined ? (is_active === 'true' || is_active === true) : existing.isActive,
        tags: tagsArray,
      };

      await prisma.educationalMaterial.update({
        where: { id },
        data,
      });

      // Add new attachments if uploaded
      if (req.files && req.files['attachments'] && req.files['attachments'].length > 0) {
        const attachmentData = req.files['attachments'].map(att => ({
          materialId: id,
          title: Buffer.from(att.originalname, 'latin1').toString('utf8'),
          fileUrl: `/uploads/educational/${att.filename}`,
          fileType: att.mimetype,
          fileSize: att.size,
        }));
        await prisma.educationalAttachment.createMany({ data: attachmentData });
      }

      res.json({ message: 'محتوای آموزشی با موفقیت ویرایش شد' });
    } catch (err) {
      console.error('Error updating educational material:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/educational/:id
  router.delete('/:id', requireEducationalManager, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const existing = await prisma.educationalMaterial.findUnique({
        where: { id },
        include: { attachments: true }
      });
      if (!existing) return res.status(404).json({ error: 'محتوای آموزشی یافت نشد' });

      // Clean up main file
      if (existing.fileUrl && !existing.fileUrl.startsWith('http')) {
        const filePath = path.join(__dirname, '..', existing.fileUrl);
        if (fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath); } catch (e) {}
        }
      }

      // Clean up thumbnail
      if (existing.thumbnailUrl && !existing.thumbnailUrl.startsWith('http')) {
        const thumbPath = path.join(__dirname, '..', existing.thumbnailUrl);
        if (fs.existsSync(thumbPath)) {
          try { fs.unlinkSync(thumbPath); } catch (e) {}
        }
      }

      // Clean up attachments
      for (const att of existing.attachments || []) {
        if (att.fileUrl && !att.fileUrl.startsWith('http')) {
          const attPath = path.join(__dirname, '..', att.fileUrl);
          if (fs.existsSync(attPath)) {
            try { fs.unlinkSync(attPath); } catch (e) {}
          }
        }
      }

      await prisma.educationalMaterial.delete({ where: { id } });
      res.json({ message: 'محتوای آموزشی و فایل‌های مرتبط حذف شدند' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/educational/attachments/:attachmentId
  router.delete('/attachments/:attachmentId', requireEducationalManager, async (req, res) => {
    try {
      const attId = Number(req.params.attachmentId);
      const att = await prisma.educationalAttachment.findUnique({ where: { id: attId } });
      if (!att) return res.status(404).json({ error: 'فایل ضمیمه یافت نشد' });

      if (att.fileUrl && !att.fileUrl.startsWith('http')) {
        const filePath = path.join(__dirname, '..', att.fileUrl);
        if (fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath); } catch (e) {}
        }
      }

      await prisma.educationalAttachment.delete({ where: { id: attId } });
      res.json({ message: 'فایل ضمیمه حذف شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
