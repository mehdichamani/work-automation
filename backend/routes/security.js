const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { security } = require('../middleware/validate');
const prisma = require('../database/prisma');
const { mapRow, flattenJoins } = require('../utils/dbAdapter');

const REPORT_ALIASES = {
  user_name: 'user.fullName',
  supervisor_name: 'supervisor.fullName',
  manager_name: 'manager.fullName',
};

const REPORT_INCLUDE = {
  user: { select: { fullName: true } },
};

const NAME_FK_FIELDS = ['managerId', 'supervisorId'];
const NAME_KEYS = ['manager', 'supervisor'];

const PENDING_ALIASES = {
  user_name: 'user.fullName',
};

const PENDING_INCLUDE = {
  user: { select: { fullName: true } },
};

module.exports = function () {
  const router = express.Router();
  router.use(authMiddleware);

  async function notify(userId, title, body, link) {
    await prisma.notification.create({ data: { userId: Number(userId), title, body, link } });
  }

  async function addHistory(reportId, userId, userName, action, comment) {
    await prisma.securityHistory.create({
      data: {
        requestId: Number(reportId),
        userId: userId ? Number(userId) : null,
        userName,
        action,
        comment: comment || '',
      },
    });
  }

  async function isSecurity(user) {
    if (user.role === 'admin') return true;
    const dept = await prisma.department.findUnique({ where: { id: Number(user.department_id) }, select: { name: true } });
    return dept && dept.name.includes('حراست');
  }

  function isSupervisorOrManager(user) {
    return user.role === 'supervisor' || user.role === 'manager' || user.role === 'admin';
  }

  function toListResponse(rows, aliases, nameMap) {
    return rows.map(r => mapRow(flattenJoins(decorateNames(r, nameMap), aliases || REPORT_ALIASES)));
  }

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

  router.get('/', async (req, res) => {
    try {
      const { status, date, page = 1, limit = 20 } = req.query;
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 20;
      const offset = (pageNum - 1) * limitNum;
      const where = {};

      if (!(await isSecurity(req.user)) && req.user.role !== 'admin') {
        where.userId = req.user.id;
      }

      if (status) {
        where.status = status;
      }

      if (date) {
        where.reportDate = date;
      }

      const total = await prisma.securityReport.count({ where });
      const reports = await prisma.securityReport.findMany({
        where,
        orderBy: [{ reportDate: 'desc' }, { createdAt: 'desc' }],
        include: REPORT_INCLUDE,
        take: limitNum,
        skip: offset,
      });

      const nameMap = await getRelatedUserNames(reports);

      res.json({ reports: toListResponse(reports, REPORT_ALIASES, nameMap), total, page: pageNum, limit: limitNum });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/my-reports', async (req, res) => {
    try {
      const reports = await prisma.securityReport.findMany({
        where: { userId: req.user.id },
        orderBy: { reportDate: 'desc' },
        include: REPORT_INCLUDE,
      });
      const nameMap = await getRelatedUserNames(reports);
      res.json(toListResponse(reports, REPORT_ALIASES, nameMap));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/pending-review', async (req, res) => {
    try {
      if (!isSupervisorOrManager(req.user)) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      const reports = await prisma.securityReport.findMany({
        where: { status: 'pending' },
        orderBy: { reportDate: 'asc' },
        include: PENDING_INCLUDE,
      });
      res.json(toListResponse(reports, PENDING_ALIASES));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const report = await prisma.securityReport.findUnique({
        where: { id: Number(req.params.id) },
        include: REPORT_INCLUDE,
      });

      if (!report) return res.status(404).json({ error: 'گزارش یافت نشد' });

      const history = await prisma.securityHistory.findMany({
        where: { requestId: Number(req.params.id) },
        orderBy: { createdAt: 'asc' },
      });

      const nameMap = await getRelatedUserNames([report]);

      res.json({ report: mapRow(flattenJoins(decorateNames(report, nameMap), REPORT_ALIASES)), history: mapRow(history) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/', security, async (req, res) => {
    try {
      if (!(await isSecurity(req.user))) {
        return res.status(403).json({ error: 'فقط واحد حراست می‌تواند گزارش ثبت کند' });
      }

      const { report_date, shift_type, incidents, visitors, vehicles, notes } = req.body;
      if (!report_date || !shift_type) {
        return res.status(400).json({ error: 'تاریخ و شیفت الزامی است' });
      }

      const existing = await prisma.securityReport.findFirst({
        where: { reportDate: report_date, shiftType: shift_type },
        select: { id: true },
      });
      if (existing) {
        return res.status(400).json({ error: 'گزارش برای این تاریخ و شیفت قبلاً ثبت شده' });
      }

      const result = await prisma.securityReport.create({
        data: {
          userId: Number(req.user.id),
          reportDate: report_date,
          shiftType: shift_type,
          incidents: incidents || '',
          visitors: visitors || '',
          vehicles: vehicles || '',
          notes: notes || '',
          status: 'pending',
        },
      });

      await addHistory(result.id, req.user.id, req.user.full_name, 'ثبت گزارش', null);

      res.json({ id: result.id, message: 'گزارش ثبت شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id', async (req, res) => {
    try {
      const report = await prisma.securityReport.findUnique({ where: { id: Number(req.params.id) } });
      if (!report) return res.status(404).json({ error: 'گزارش یافت نشد' });

      if (report.userId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }

      if (!['pending', 'rejected'].includes(report.status)) {
        return res.status(400).json({ error: 'امکان ویرایش در این مرحله وجود ندارد' });
      }

      const { incidents, visitors, vehicles, notes } = req.body;

      await prisma.securityReport.update({
        where: { id: Number(req.params.id) },
        data: {
          incidents: incidents || report.incidents,
          visitors: visitors || report.visitors,
          vehicles: vehicles || report.vehicles,
          notes: notes || report.notes,
        },
      });

      await addHistory(req.params.id, req.user.id, req.user.full_name, 'ویرایش گزارش', null);

      res.json({ message: 'گزارش بروزرسانی شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/review', async (req, res) => {
    try {
      if (!isSupervisorOrManager(req.user)) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }

      const { status, comment } = req.body;
      if (!status || !['reviewed', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'وضعیت نامعتبر است' });
      }

      const report = await prisma.securityReport.findUnique({ where: { id: Number(req.params.id) } });
      if (!report) return res.status(404).json({ error: 'گزارش یافت نشد' });
      if (report.status !== 'pending') {
        return res.status(400).json({ error: 'گزارش در وضعیت بررسی نیست' });
      }

      const now = new Date().toISOString();

      if (status === 'reviewed') {
        await prisma.securityReport.update({
          where: { id: Number(req.params.id) },
          data: { supervisorId: Number(req.user.id), supervisorComment: comment || '', supervisorDate: now, status: 'reviewed' },
        });
        await addHistory(req.params.id, req.user.id, req.user.full_name, 'بررسی گزارش', comment);
      } else {
        await prisma.securityReport.update({
          where: { id: Number(req.params.id) },
          data: { supervisorId: Number(req.user.id), supervisorComment: comment || '', supervisorDate: now, status: 'rejected' },
        });
        await addHistory(req.params.id, req.user.id, req.user.full_name, 'رد گزارش توسط سرپرست', comment);
      }

      await notify(report.userId, 'بروزرسانی وضعیت گزارش حراست', `گزارش شما ${status === 'reviewed' ? 'بررسی شد' : 'رد شد'}`, '/security');

      res.json({ success: true, status });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/approve', async (req, res) => {
    try {
      if (!isSupervisorOrManager(req.user)) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }

      const { comment } = req.body;
      const report = await prisma.securityReport.findUnique({ where: { id: Number(req.params.id) } });
      if (!report) return res.status(404).json({ error: 'گزارش یافت نشد' });
      if (report.status !== 'reviewed') {
        return res.status(400).json({ error: 'فقط گزارش‌های بررسی شده قابل تایید هستند' });
      }

      const now = new Date().toISOString();

      await prisma.securityReport.update({
        where: { id: Number(req.params.id) },
        data: { managerId: Number(req.user.id), managerComment: comment || '', managerDate: now, status: 'approved' },
      });

      await addHistory(req.params.id, req.user.id, req.user.full_name, 'تایید گزارش توسط مدیر', comment);
      await notify(report.userId, 'تایید گزارش حراست', `گزارش شما توسط مدیر تایید شد`, '/security');

      res.json({ success: true, status: 'approved' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/reject', async (req, res) => {
    try {
      if (!isSupervisorOrManager(req.user)) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }

      const { comment } = req.body;
      if (!comment) return res.status(400).json({ error: 'دلیل رد الزامی است' });

      const report = await prisma.securityReport.findUnique({ where: { id: Number(req.params.id) } });
      if (!report) return res.status(404).json({ error: 'گزارش یافت نشد' });
      if (!['pending', 'reviewed'].includes(report.status)) {
        return res.status(400).json({ error: 'امکان رد در این مرحله وجود ندارد' });
      }

      const now = new Date().toISOString();

      if (report.status === 'pending') {
        await prisma.securityReport.update({
          where: { id: Number(req.params.id) },
          data: { supervisorId: Number(req.user.id), supervisorComment: comment, supervisorDate: now, status: 'rejected' },
        });
        await addHistory(req.params.id, req.user.id, req.user.full_name, 'رد گزارش توسط سرپرست', comment);
      } else {
        await prisma.securityReport.update({
          where: { id: Number(req.params.id) },
          data: { managerId: Number(req.user.id), managerComment: comment, managerDate: now, status: 'rejected' },
        });
        await addHistory(req.params.id, req.user.id, req.user.full_name, 'رد گزارش توسط مدیر', comment);
      }

      await notify(report.userId, 'رد گزارش حراست', `گزارش شما رد شد. دلیل: ${comment}`, '/security');

      res.json({ success: true, status: 'rejected' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const report = await prisma.securityReport.findUnique({ where: { id: Number(req.params.id) } });
      if (!report) return res.status(404).json({ error: 'گزارش یافت نشد' });
      if (report.userId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      if (!['pending', 'rejected'].includes(report.status)) {
        return res.status(400).json({ error: 'امکان حذف گزارش در این مرحله وجود ندارد' });
      }

      await prisma.securityHistory.deleteMany({ where: { requestId: Number(req.params.id) } });
      await prisma.securityReport.delete({ where: { id: Number(req.params.id) } });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
