const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { itRequest } = require('../middleware/validate');
const { notify: notifyHelper, getNextNumber: getNextNumberHelper, addHistory: addHistoryHelper } = require('../utils/helpers');
const prisma = require('../database/prisma');
const { mapRow, flattenJoins } = require('../utils/dbAdapter');

const REQUEST_ALIASES = {
  user_name: 'user.fullName',
  department_name: 'user.department.name',
  assigned_name: 'assignedUser.fullName',
};

const REQUEST_INCLUDE = {
  user: { select: { fullName: true, department: { select: { name: true } } } },
  assignedUser: { select: { fullName: true } },
};

module.exports = function () {
  const router = express.Router();
  router.use(authMiddleware);

  async function notify(userId, title, body, link) { await notifyHelper(userId, title, body, link); }
  async function addHistory(id, userId, userName, action, comment) { await addHistoryHelper('it_request_history', 'request_id', id, userId, userName, action, comment); }

  async function getITUsers() {
    const dept = await prisma.department.findFirst({
      where: { OR: [{ name: { contains: 'فنی' } }, { name: { contains: 'IT' } }] },
      select: { id: true },
    });
    if (!dept) return [];
    return prisma.user.findMany({
      where: { departmentId: dept.id, isActive: true },
      select: { id: true },
    });
  }

  async function getNextNumber() { return getNextNumberHelper('it_request_counter', 'TK'); }

  function toListResponse(rows) {
    return rows.map(r => mapRow(flattenJoins(r, REQUEST_ALIASES)));
  }

  router.get('/stats', async (req, res) => {
    try {
      const [total, pending, in_progress, completed, rejected, urgent, high] = await Promise.all([
        prisma.itRequest.count(),
        prisma.itRequest.count({ where: { status: 'pending' } }),
        prisma.itRequest.count({ where: { status: 'in_progress' } }),
        prisma.itRequest.count({ where: { status: 'completed' } }),
        prisma.itRequest.count({ where: { status: 'rejected' } }),
        prisma.itRequest.count({ where: { urgency: 'urgent' } }),
        prisma.itRequest.count({ where: { urgency: 'high' } }),
      ]);
      res.json({ total, pending, in_progress, completed, rejected, urgent, high });
    } catch (err) {
      res.json({ total: 0, pending: 0, in_progress: 0, completed: 0, rejected: 0, urgent: 0, high: 0 });
    }
  });

  router.get('/', async (req, res) => {
    try {
      const { status, priority, urgency, page = 1, limit = 50 } = req.query;
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 50;
      const offset = (pageNum - 1) * limitNum;
      const where = {};

      if (req.user.role === 'user') {
        where.userId = req.user.id;
      }

      if (status) {
        where.status = status;
      }
      if (urgency || priority) {
        where.urgency = urgency || priority;
      }

      const total = await prisma.itRequest.count({ where });
      const rows = await prisma.itRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: REQUEST_INCLUDE,
      });

      const urgencyRank = { urgent: 0, high: 1 };
      rows.sort((a, b) => {
        const ra = urgencyRank[a.urgency] !== undefined ? urgencyRank[a.urgency] : 2;
        const rb = urgencyRank[b.urgency] !== undefined ? urgencyRank[b.urgency] : 2;
        if (ra !== rb) return ra - rb;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
      const pageRows = rows.slice(offset, offset + limitNum);

      res.json({ requests: toListResponse(pageRows), total, page: pageNum, limit: limitNum });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/my-requests', async (req, res) => {
    try {
      const rows = await prisma.itRequest.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        include: REQUEST_INCLUDE,
      });
      res.json(toListResponse(rows));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const request = await prisma.itRequest.findUnique({
        where: { id: Number(req.params.id) },
        include: REQUEST_INCLUDE,
      });

      if (!request) return res.status(404).json({ error: 'تیکت یافت نشد' });

      const history = await prisma.itRequestHistory.findMany({
        where: { requestId: Number(req.params.id) },
        orderBy: { createdAt: 'asc' },
      });

      res.json({ request: mapRow(flattenJoins(request, REQUEST_ALIASES)), history: mapRow(history) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/', itRequest, async (req, res) => {
    try {
      const { title, description, request_type = 'general', urgency = 'normal', device_info } = req.body;
      if (!title) {
        return res.status(400).json({ error: 'عنوان تیکت الزامی است' });
      }

      const requestNumber = await getNextNumber();
      const itUsers = await getITUsers();
      const assignedTo = itUsers.length > 0 ? itUsers[0].id : null;

      const result = await prisma.itRequest.create({
        data: {
          userId: req.user.id,
          requestNumber,
          title,
          description: description || '',
          requestType: request_type,
          urgency,
          deviceInfo: device_info || '',
          assignedTo,
          status: 'pending',
        },
      });

      await addHistory(result.id, req.user.id, req.user.full_name, 'ثبت تیکت', null);

      for (const u of itUsers) {
        await notify(u.id, 'تیکت جدید', `تیکت شماره ${requestNumber} توسط ${req.user.full_name} ثبت شد`, '/it');
      }

      res.json({ id: result.id, request_number: requestNumber });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/respond', async (req, res) => {
    try {
      const { comment } = req.body;
      if (!comment) return res.status(400).json({ error: 'پیام الزامی است' });

      const request = await prisma.itRequest.findUnique({ where: { id: Number(req.params.id) } });
      if (!request) return res.status(404).json({ error: 'تیکت یافت نشد' });

      await addHistory(req.params.id, req.user.id, req.user.full_name, 'پاسخ', comment);

      const notifyUserId = req.user.id === request.userId ? request.assignedTo : request.userId;
      if (notifyUserId) {
        await notify(notifyUserId, 'پاسخ جدید', `پاسخ جدیدی برای تیکت ${request.request_number} ثبت شد`, '/it');
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id/assign', async (req, res) => {
    try {
      if (!['admin', 'manager', 'supervisor'].includes(req.user.role)) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      const { assigned_to } = req.body;
      const request = await prisma.itRequest.findUnique({ where: { id: Number(req.params.id) } });
      if (!request) return res.status(404).json({ error: 'تیکت یافت نشد' });

      await prisma.itRequest.update({
        where: { id: Number(req.params.id) },
        data: { assignedTo: assigned_to || null },
      });

      await addHistory(req.params.id, req.user.id, req.user.full_name, 'واگذاری', `واگذاری به کاربر ${assigned_to}`);

      if (assigned_to) {
        await notify(assigned_to, 'تیکت واگذار شده', `تیکت ${request.request_number} به شما واگذار شد`, '/it');
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/accept', async (req, res) => {
    try {
      const request = await prisma.itRequest.findUnique({ where: { id: Number(req.params.id) } });
      if (!request) return res.status(404).json({ error: 'تیکت یافت نشد' });

      await prisma.itRequest.update({
        where: { id: Number(req.params.id) },
        data: { status: 'in_progress', assignedTo: req.user.id },
      });

      await addHistory(req.params.id, req.user.id, req.user.full_name, 'شروع بررسی', null);
      await notify(request.userId, 'شروع بررسی تیکت', `تیکت شماره ${request.request_number} در حال بررسی است`, '/it');

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/complete', async (req, res) => {
    try {
      const { comment } = req.body;
      const request = await prisma.itRequest.findUnique({ where: { id: Number(req.params.id) } });
      if (!request) return res.status(404).json({ error: 'تیکت یافت نشد' });

      await prisma.itRequest.update({
        where: { id: Number(req.params.id) },
        data: { status: 'completed', completionComment: comment || '' },
      });

      await addHistory(req.params.id, req.user.id, req.user.full_name, 'حل شده', comment);
      await notify(request.userId, 'تیکت حل شد', `تیکت شماره ${request.request_number} حل شد`, '/it');

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/reject', async (req, res) => {
    try {
      const { comment } = req.body;
      const request = await prisma.itRequest.findUnique({ where: { id: Number(req.params.id) } });
      if (!request) return res.status(404).json({ error: 'تیکت یافت نشد' });

      await prisma.itRequest.update({
        where: { id: Number(req.params.id) },
        data: { status: 'rejected', rejectComment: comment || '' },
      });

      await addHistory(req.params.id, req.user.id, req.user.full_name, 'رد شده', comment);
      await notify(request.userId, 'تیکت رد شد', `تیکت شماره ${request.request_number} رد شد`, '/it');

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const request = await prisma.itRequest.findUnique({ where: { id: Number(req.params.id) } });
      if (!request) return res.status(404).json({ error: 'تیکت یافت نشد' });
      if (request.userId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      if (request.status !== 'pending') {
        return res.status(400).json({ error: 'امکان حذف تیکت در این مرحله وجود ندارد' });
      }

      await prisma.itRequestHistory.deleteMany({ where: { requestId: Number(req.params.id) } });
      await prisma.itRequest.delete({ where: { id: Number(req.params.id) } });

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
