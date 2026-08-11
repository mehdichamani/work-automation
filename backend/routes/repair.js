const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { validateInput, repair } = require('../middleware/validate');
const { notify: notifyHelper, findSupervisorId: findSupervisorIdHelper, getNextNumber: getNextNumberHelper, addHistory: addHistoryHelper } = require('../utils/helpers');
const prisma = require('../database/prisma');
const { mapRow, flattenJoins } = require('../utils/dbAdapter');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', 'uploads', 'repair');
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `repair-${Date.now()}-${Math.random().toString(36).slice(2, 6)}${ext}`);
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

const REQUEST_ALIASES = {
  user_name: 'user.fullName',
  department_name: 'dept.name',
  manager_name: 'manager.fullName',
  supervisor_name: 'supervisor.fullName',
};

const REQUEST_INCLUDE = {
  user: { select: { fullName: true } },
  dept: { select: { name: true } },
};

const NAME_FK_FIELDS = ['managerId', 'supervisorId'];
const NAME_KEYS = ['manager', 'supervisor'];

module.exports = function () {
  const router = express.Router();
  router.use(authMiddleware);

  async function notify(userId, title, body, link) { await notifyHelper(userId, title, body, link); }
  async function addHistory(id, userId, userName, action, comment) { await addHistoryHelper('repair_history', 'request_id', id, userId, userName, action, comment); }
  async function findSupervisorId(departmentId) { return findSupervisorIdHelper(departmentId); }
  async function getNextNumber() { return getNextNumberHelper('repair_counter', 'تعمیر'); }

  async function getRelatedUserNames(rows) {
    const ids = new Set();
    rows.forEach(r => {
      NAME_FK_FIELDS.forEach(fk => {
        if (r[fk]) ids.add(Number(r[fk]));
      });
    });
    if (ids.size === 0) return {};
    const users = await prisma.user.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true, fullName: true },
    });
    const map = {};
    users.forEach(u => { map[u.id] = u.fullName; });
    return map;
  }

  function decorateNames(row, nameMap) {
    NAME_KEYS.forEach((key, idx) => {
      const fk = NAME_FK_FIELDS[idx];
      const uid = row[fk] ? Number(row[fk]) : null;
      row[key] = uid && nameMap[uid] ? { fullName: nameMap[uid] } : null;
    });
    return row;
  }

  function toListResponse(rows, nameMap) {
    return rows.map(r => mapRow(flattenJoins(decorateNames(r, nameMap), REQUEST_ALIASES)));
  }

  router.get('/', async (req, res) => {
    try {
      const { status, page = 1, limit = 20 } = req.query;
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 20;
      const offset = (pageNum - 1) * limitNum;
      const where = {};

      if (req.user.role === 'user') {
        where.userId = req.user.id;
      } else if (req.user.role === 'supervisor') {
        where.status = 'pending_supervisor';
      } else if (req.user.role === 'manager') {
        where.status = 'pending_manager';
      }

      if (status) {
        where.status = status;
      }

      const total = await prisma.repairRequest.count({ where });
      const rows = await prisma.repairRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limitNum,
        skip: offset,
        include: REQUEST_INCLUDE,
      });
      const nameMap = await getRelatedUserNames(rows);

      res.json({ requests: toListResponse(rows, nameMap), total, page: pageNum, limit: limitNum });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/my-requests', async (req, res) => {
    try {
      const rows = await prisma.repairRequest.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        include: REQUEST_INCLUDE,
      });
      const nameMap = await getRelatedUserNames(rows);
      res.json(toListResponse(rows, nameMap));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const request = await prisma.repairRequest.findUnique({
        where: { id: Number(req.params.id) },
        include: REQUEST_INCLUDE,
      });

      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });

      const history = await prisma.repairHistory.findMany({
        where: { requestId: Number(req.params.id) },
        orderBy: { createdAt: 'asc' },
      });
      const nameMap = await getRelatedUserNames([request]);

      res.json({
        request: mapRow(flattenJoins(decorateNames(request, nameMap), REQUEST_ALIASES)),
        history: mapRow(history),
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/', upload.array('images', 5), validateInput({ title: 200, description: 1000 }), repair, async (req, res) => {
    try {
      const { title, description, equipment_name, location, urgency = 'normal', estimated_cost } = req.body;
      if (!title) {
        return res.status(400).json({ error: 'عنوان درخواست الزامی است' });
      }

      const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { departmentId: true } });
      const supervisorId = await findSupervisorId(user?.departmentId);
      const requestNumber = await getNextNumber();

      let images = null;
      if (req.files && req.files.length > 0) {
        images = JSON.stringify(req.files.map(f => `/uploads/repair/${f.filename}`));
      }

      const result = await prisma.repairRequest.create({
        data: {
          userId: req.user.id,
          requestNumber,
          title,
          description: description || '',
          equipmentName: equipment_name || '',
          location: location || '',
          urgency,
          estimatedCost: estimated_cost || null,
          departmentId: user?.departmentId ?? null,
          status: 'pending_supervisor',
          images,
        },
      });

      await addHistory(result.id, req.user.id, req.user.full_name, 'ثبت درخواست', null);

      if (supervisorId) {
        await notify(supervisorId, 'درخواست تعمیرات جدید', `درخواست شماره ${requestNumber} توسط ${req.user.full_name} ثبت شد`, '/repair');
      }

      res.json({ id: result.id, request_number: requestNumber });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/approve', async (req, res) => {
    try {
      const { comment } = req.body;
      const request = await prisma.repairRequest.findUnique({ where: { id: Number(req.params.id) } });
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });

      const now = new Date().toISOString();
      let newStatus = '';
      let historyAction = '';

      if (request.status === 'pending_supervisor') {
        newStatus = 'pending_manager';
        await prisma.repairRequest.update({
          where: { id: Number(req.params.id) },
          data: { supervisorId: req.user.id, supervisorComment: comment, supervisorDate: now, status: newStatus },
        });
        historyAction = 'تایید سرپرست';
        const managers = await prisma.user.findMany({ where: { role: 'manager' }, select: { id: true } });
        for (const mgr of managers) {
          await notify(mgr.id, 'درخواست تعمیرات نیاز به تایید', `درخواست شماره ${request.requestNumber} توسط سرپرست تایید شد`, '/repair');
        }
      } else if (request.status === 'pending_manager') {
        newStatus = 'approved';
        await prisma.repairRequest.update({
          where: { id: Number(req.params.id) },
          data: { managerId: req.user.id, managerComment: comment, managerDate: now, status: newStatus },
        });
        historyAction = 'تایید مدیر';
      } else {
        return res.status(400).json({ error: 'وضعیت درخواست نامعتبر است' });
      }

      await addHistory(req.params.id, req.user.id, req.user.full_name, historyAction, comment);
      await notify(request.userId, 'تایید درخواست تعمیرات', `درخواست شماره ${request.requestNumber} تایید شد`, '/repair');

      res.json({ success: true, status: newStatus });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/reject', async (req, res) => {
    try {
      const { comment } = req.body;
      const request = await prisma.repairRequest.findUnique({ where: { id: Number(req.params.id) } });
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });
      if (!comment) return res.status(400).json({ error: 'دلیل رد الزامی است' });

      const now = new Date().toISOString();

      if (request.status === 'pending_supervisor') {
        await prisma.repairRequest.update({
          where: { id: Number(req.params.id) },
          data: { supervisorId: req.user.id, supervisorComment: comment, supervisorDate: now, status: 'rejected' },
        });
        await addHistory(req.params.id, req.user.id, req.user.full_name, 'رد توسط سرپرست', comment);
      } else if (request.status === 'pending_manager') {
        await prisma.repairRequest.update({
          where: { id: Number(req.params.id) },
          data: { managerId: req.user.id, managerComment: comment, managerDate: now, status: 'rejected' },
        });
        await addHistory(req.params.id, req.user.id, req.user.full_name, 'رد توسط مدیر', comment);
      } else {
        return res.status(400).json({ error: 'وضعیت درخواست نامعتبر است' });
      }

      await notify(request.userId, 'رد درخواست تعمیرات', `درخواست شماره ${request.requestNumber} رد شد`, '/repair');

      res.json({ success: true, status: 'rejected' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const request = await prisma.repairRequest.findUnique({ where: { id: Number(req.params.id) } });
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });
      if (request.userId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      if (request.status !== 'pending_supervisor') {
        return res.status(400).json({ error: 'امکان حذف درخواست در این مرحله وجود ندارد' });
      }

      await prisma.repairHistory.deleteMany({ where: { requestId: Number(req.params.id) } });
      if (request.images) {
        try {
          const images = JSON.parse(request.images);
          for (const img of images) {
            const filePath = path.join(__dirname, '..', img);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          }
        } catch {}
      }
      await prisma.repairRequest.delete({ where: { id: Number(req.params.id) } });

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
