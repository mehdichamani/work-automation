const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { dailyOutput } = require('../middleware/validate');
const prisma = require('../database/prisma');
const { mapRow, flattenJoins } = require('../utils/dbAdapter');

const REPORT_ALIASES = {
  user_name: 'user.fullName',
  department_name: 'dept.name',
};

const REPORT_INCLUDE = {
  user: { select: { fullName: true } },
  dept: { select: { name: true } },
};

module.exports = function () {
  const router = express.Router();
  router.use(authMiddleware);

  async function notify(userId, title, body, link) {
    await prisma.notification.create({ data: { userId: Number(userId), title, body, link } });
  }

  async function addHistory(reportId, userId, userName, action, comment) {
    await prisma.dailyOutputHistory.create({
      data: {
        requestId: Number(reportId),
        userId: userId ? Number(userId) : null,
        userName,
        action,
        comment: comment || '',
      },
    });
  }

  async function findSupervisorId(departmentId) {
    if (!departmentId) return null;
    const dept = await prisma.department.findUnique({ where: { id: Number(departmentId) }, select: { parentId: true } });
    if (!dept || !dept.parentId) return null;
    const sup = await prisma.user.findFirst({
      where: { departmentId: dept.parentId, role: 'supervisor' },
      select: { id: true },
    });
    return sup ? sup.id : null;
  }

  async function isProduction(user) {
    if (user.role === 'admin') return true;
    const dept = await prisma.department.findUnique({ where: { id: Number(user.department_id) }, select: { name: true } });
    return dept && (dept.name.includes('تولید') || dept.name.includes('فنی'));
  }

  function toListResponse(rows) {
    return rows.map(r => mapRow(flattenJoins(r, REPORT_ALIASES)));
  }

  router.get('/', async (req, res) => {
    try {
      const { date, status, page = 1, limit = 20 } = req.query;
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 20;
      const offset = (pageNum - 1) * limitNum;
      const where = {};

      if (!(await isProduction(req.user))) {
        where.userId = req.user.id;
      }

      if (date) {
        where.reportDate = date;
      }

      if (status) {
        where.status = status;
      }

      const total = await prisma.dailyOutput.count({ where });
      const reports = await prisma.dailyOutput.findMany({
        where,
        orderBy: { reportDate: 'desc' },
        include: REPORT_INCLUDE,
        take: limitNum,
        skip: offset,
      });

      res.json({ reports: toListResponse(reports), total, page: pageNum, limit: limitNum });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/my-reports', async (req, res) => {
    try {
      const reports = await prisma.dailyOutput.findMany({
        where: { userId: req.user.id },
        orderBy: { reportDate: 'desc' },
        include: REPORT_INCLUDE,
      });
      res.json(toListResponse(reports));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/summary', async (req, res) => {
    try {
      const { from_date, to_date } = req.query;
      const where = {};

      if (from_date) {
        where.reportDate = { gte: from_date };
      }
      if (to_date) {
        where.reportDate = { lte: to_date };
      }

      const grouped = await prisma.dailyOutput.groupBy({
        by: ['productName'],
        where,
        _sum: { quantity: true },
        _avg: { qualityScore: true },
      });

      const summary = grouped
        .map(g => ({
          product_name: g.productName,
          total_quantity: g._sum.quantity || 0,
          avg_quality: g._avg.qualityScore,
        }))
        .sort((a, b) => (b.total_quantity || 0) - (a.total_quantity || 0));

      res.json(mapRow(summary));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/pending-review', async (req, res) => {
    try {
      const { page = 1, limit = 20 } = req.query;
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 20;
      const offset = (pageNum - 1) * limitNum;

      let where = {};

      if (req.user.role === 'supervisor' || req.user.role === 'manager') {
        where.status = 'pending';
      } else if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }

      const total = await prisma.dailyOutput.count({ where });
      const reports = await prisma.dailyOutput.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        include: REPORT_INCLUDE,
        take: limitNum,
        skip: offset,
      });

      res.json({ reports: toListResponse(reports), total, page: pageNum, limit: limitNum });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const report = await prisma.dailyOutput.findUnique({
        where: { id: Number(req.params.id) },
        include: REPORT_INCLUDE,
      });

      if (!report) return res.status(404).json({ error: 'گزارش یافت نشد' });

      const history = await prisma.dailyOutputHistory.findMany({
        where: { requestId: Number(req.params.id) },
        orderBy: { createdAt: 'asc' },
      });

      res.json({ report: mapRow(flattenJoins(report, REPORT_ALIASES)), history: mapRow(history) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/', dailyOutput, async (req, res) => {
    try {
      const { report_date, product_name, quantity, unit, quality_score, description, machine_number } = req.body;
      if (!report_date || !product_name || quantity === undefined) {
        return res.status(400).json({ error: 'تاریخ، نام محصول و تعداد الزامی است' });
      }

      const user = await prisma.user.findUnique({
        where: { id: Number(req.user.id) },
        select: { departmentId: true },
      });
      const supervisorId = await findSupervisorId(user?.departmentId);

      const result = await prisma.dailyOutput.create({
        data: {
          userId: Number(req.user.id),
          departmentId: user?.departmentId || null,
          reportDate: report_date,
          productName: product_name,
          quantity: Number(quantity),
          unit: unit || 'عدد',
          qualityScore: quality_score !== undefined && quality_score !== null ? Number(quality_score) : null,
          description: description || '',
          machineNumber: machine_number || '',
          status: 'pending',
        },
      });

      await addHistory(result.id, req.user.id, req.user.full_name, 'ثبت گزارش', null);

      if (supervisorId) {
        await notify(supervisorId, 'گزارش تولید روزانه جدید', `گزارش توسط ${req.user.full_name} ثبت شد و نیاز به بررسی دارد`, '/daily-output');
      }

      res.json({ id: result.id, message: 'گزارش ثبت شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/review', async (req, res) => {
    try {
      const { comment } = req.body;
      const report = await prisma.dailyOutput.findUnique({ where: { id: Number(req.params.id) } });
      if (!report) return res.status(404).json({ error: 'گزارش یافت نشد' });
      if (report.status !== 'pending') {
        return res.status(400).json({ error: 'این گزارش قبلاً بررسی شده است' });
      }

      if (req.user.role !== 'supervisor' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'فقط سرپرست می‌تواند گزارش را بررسی کند' });
      }

      await prisma.dailyOutput.update({
        where: { id: Number(req.params.id) },
        data: { status: 'reviewed', supervisorId: Number(req.user.id), supervisorComment: comment || '', supervisorDate: new Date().toISOString() },
      });

      await addHistory(req.params.id, req.user.id, req.user.full_name, 'بررسی توسط سرپرست', comment);

      await notify(report.userId, 'گزارش بررسی شد', `گزارش تولید روزانه شما توسط سرپرست بررسی شد`, '/daily-output');

      res.json({ success: true, status: 'reviewed' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/approve', async (req, res) => {
    try {
      const { comment } = req.body;
      const report = await prisma.dailyOutput.findUnique({ where: { id: Number(req.params.id) } });
      if (!report) return res.status(404).json({ error: 'گزارش یافت نشد' });
      if (report.status !== 'reviewed') {
        return res.status(400).json({ error: 'گزارش باید ابتدا توسط سرپرست بررسی شود' });
      }

      if (req.user.role !== 'manager' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'فقط مدیر می‌تواند گزارش را تایید کند' });
      }

      await prisma.dailyOutput.update({
        where: { id: Number(req.params.id) },
        data: { status: 'approved', managerId: Number(req.user.id), managerComment: comment || '', managerDate: new Date().toISOString() },
      });

      await addHistory(req.params.id, req.user.id, req.user.full_name, 'تایید توسط مدیر', comment);

      await notify(report.userId, 'گزارش تایید شد', `گزارش تولید روزانه شما توسط مدیر تایید شد`, '/daily-output');

      res.json({ success: true, status: 'approved' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/reject', async (req, res) => {
    try {
      const { comment } = req.body;
      const report = await prisma.dailyOutput.findUnique({ where: { id: Number(req.params.id) } });
      if (!report) return res.status(404).json({ error: 'گزارش یافت نشد' });
      if (!comment) return res.status(400).json({ error: 'دلیل رد الزامی است' });
      if (!['pending', 'reviewed'].includes(report.status)) {
        return res.status(400).json({ error: 'این گزارش قبلاً بررسی شده است' });
      }

      if (req.user.role !== 'supervisor' && req.user.role !== 'manager' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }

      const isSupervisor = req.user.role === 'supervisor';
      const action = isSupervisor ? 'رد توسط سرپرست' : 'رد توسط مدیر';

      if (isSupervisor) {
        await prisma.dailyOutput.update({
          where: { id: Number(req.params.id) },
          data: { status: 'rejected', supervisorId: Number(req.user.id), supervisorComment: comment, supervisorDate: new Date().toISOString() },
        });
      } else {
        await prisma.dailyOutput.update({
          where: { id: Number(req.params.id) },
          data: { status: 'rejected', managerId: Number(req.user.id), managerComment: comment, managerDate: new Date().toISOString() },
        });
      }

      await addHistory(req.params.id, req.user.id, req.user.full_name, action, comment);

      await notify(report.userId, 'گزارش رد شد', `گزارش تولید روزانه شما رد شد. دلیل: ${comment}`, '/daily-output');

      res.json({ success: true, status: 'rejected' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id', async (req, res) => {
    try {
      const report = await prisma.dailyOutput.findUnique({ where: { id: Number(req.params.id) } });
      if (!report) return res.status(404).json({ error: 'گزارش یافت نشد' });

      if (report.userId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }

      if (!['pending'].includes(report.status)) {
        return res.status(400).json({ error: 'امکان ویرایش در این مرحله وجود ندارد' });
      }

      const { product_name, quantity, unit, quality_score, description, machine_number } = req.body;

      await prisma.dailyOutput.update({
        where: { id: Number(req.params.id) },
        data: {
          productName: product_name || report.productName,
          quantity: quantity !== undefined && quantity !== '' ? Number(quantity) : report.quantity,
          unit: unit || report.unit,
          qualityScore: quality_score !== undefined && quality_score !== null && quality_score !== '' ? Number(quality_score) : report.qualityScore,
          description: description || report.description,
          machineNumber: machine_number || report.machineNumber,
        },
      });

      await addHistory(req.params.id, req.user.id, req.user.full_name, 'ویرایش گزارش', null);

      res.json({ message: 'گزارش بروزرسانی شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const report = await prisma.dailyOutput.findUnique({ where: { id: Number(req.params.id) } });
      if (!report) return res.status(404).json({ error: 'گزارش یافت نشد' });
      if (report.userId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      if (!['pending'].includes(report.status)) {
        return res.status(400).json({ error: 'امکان حذف در این مرحله وجود ندارد' });
      }

      await prisma.dailyOutputHistory.deleteMany({ where: { requestId: Number(req.params.id) } });
      await prisma.dailyOutput.delete({ where: { id: Number(req.params.id) } });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
