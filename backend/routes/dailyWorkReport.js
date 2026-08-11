const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const prisma = require('../database/prisma');
const { mapRow, flattenJoins } = require('../utils/dbAdapter');

const REPORT_ALIASES = {
  user_name: 'user.fullName',
  department_name: 'department.name',
  central_name: 'centralByUser.fullName',
  manager_name: 'managerByUser.fullName',
  project_control_name: 'projectControlByUser.fullName',
};

const REPORT_INCLUDE = {
  user: { select: { fullName: true } },
  department: { select: { name: true } },
};

const NAME_FK_FIELDS = ['centralBy', 'managerBy', 'projectControlBy'];
const NAME_KEYS = ['centralByUser', 'managerByUser', 'projectControlByUser'];

module.exports = function() {
  const router = express.Router();
  router.use(authMiddleware);

  async function notify(userId, title, body, link) {
    await prisma.notification.create({
      data: { userId: Number(userId), title, body, link },
    });
  }

  async function addHistory(reportId, userId, userName, action, comment) {
    await prisma.dailyWorkReportHistory.create({
      data: {
        reportId: Number(reportId),
        userId: userId ? Number(userId) : null,
        userName,
        action,
        comment: comment || '',
      },
    });
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

  function toListResponse(rows, nameMap) {
    return rows.map(r => mapRow(flattenJoins(decorateNames(r, nameMap), REPORT_ALIASES)));
  }

  async function getCentralUsers() {
    return prisma.user.findMany({
      where: { OR: [{ role: 'admin' }, { role: 'manager' }] },
      select: { id: true },
      take: 5,
    });
  }

  async function getProjectControlUsers() {
    return prisma.user.findMany({
      where: { OR: [{ role: 'supervisor' }, { role: 'manager' }] },
      select: { id: true },
      take: 5,
    });
  }

  // ---------- لیست گزارش‌ها ----------
  router.get('/', async (req, res) => {
    try {
      const { status, page = 1, limit = 50 } = req.query;
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 50;
      const offset = (pageNum - 1) * limitNum;
      const where = {};

      if (req.user.role === 'user') {
        where.userId = req.user.id;
      } else if (req.user.role === 'supervisor') {
        const or = [{ userId: req.user.id }];
        if (req.user.department_id) or.push({ departmentId: req.user.department_id });
        where.OR = or;
      }

      if (status) {
        where.status = status;
      }

      const total = await prisma.dailyWorkReport.count({ where });
      const rows = await prisma.dailyWorkReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limitNum,
        skip: offset,
        include: REPORT_INCLUDE,
      });
      const nameMap = await getRelatedUserNames(rows);

      res.json({ reports: toListResponse(rows, nameMap), total, page: pageNum, limit: limitNum });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------- گزارش‌های من ----------
  router.get('/my', async (req, res) => {
    try {
      const rows = await prisma.dailyWorkReport.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        include: REPORT_INCLUDE,
      });
      const nameMap = await getRelatedUserNames(rows);
      res.json(toListResponse(rows, nameMap));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------- ثبت گزارش جدید ----------
  router.post('/', async (req, res) => {
    try {
      const { report_date, work_description, work_duration } = req.body;
      if (!report_date || !work_description) {
        return res.status(400).json({ error: 'تاریخ و شرح کار الزامی است' });
      }

      const result = await prisma.dailyWorkReport.create({
        data: {
          userId: req.user.id,
          reportDate: report_date,
          workDescription: work_description,
          workDuration: work_duration || '',
          departmentId: req.user.department_id || null,
          status: 'pending_central',
        },
      });

      await addHistory(result.id, req.user.id, req.user.full_name, 'ثبت گزارش', null);

      const centralUsers = await getCentralUsers();
      for (const u of centralUsers) {
        await notify(u.id, 'گزارش کار جدید', `گزارش کار روزانه توسط ${req.user.full_name} ثبت شد`, '/daily-work-report');
      }

      res.json({ id: result.id, success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------- مشاهده یک گزارش ----------
  router.get('/:id', async (req, res) => {
    try {
      const report = await prisma.dailyWorkReport.findUnique({
        where: { id: Number(req.params.id) },
        include: REPORT_INCLUDE,
      });
      if (!report) return res.status(404).json({ error: 'گزارش یافت نشد' });

      const history = await prisma.dailyWorkReportHistory.findMany({
        where: { reportId: Number(req.params.id) },
        orderBy: { createdAt: 'asc' },
      });
      const nameMap = await getRelatedUserNames([report]);

      res.json({
        report: mapRow(flattenJoins(decorateNames(report, nameMap), REPORT_ALIASES)),
        history: mapRow(history),
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------- سانترال: تایید اولیه → ارسال به مدیر ----------
  router.post('/:id/central-approve', async (req, res) => {
    try {
      const { comment } = req.body;
      const report = await prisma.dailyWorkReport.findUnique({ where: { id: Number(req.params.id) } });
      if (!report) return res.status(404).json({ error: 'گزارش یافت نشد' });
      if (report.status !== 'pending_central') return res.status(400).json({ error: 'وضعیت فعلی مناسب نیست' });

      const now = new Date().toISOString();
      await prisma.dailyWorkReport.update({
        where: { id: Number(req.params.id) },
        data: { status: 'pending_manager', centralComment: comment || '', centralBy: req.user.id, centralAt: now },
      });

      await addHistory(req.params.id, req.user.id, req.user.full_name, 'سانترال: ارسال به مدیریت', comment);
      await notify(report.userId, 'ارسال به مدیریت', `گزارش کار شما توسط سانترال به مدیریت ارسال شد`, '/daily-work-report');

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------- سانترال: رد گزارش ----------
  router.post('/:id/central-reject', async (req, res) => {
    try {
      const { comment } = req.body;
      if (!comment) return res.status(400).json({ error: 'دلیل رد الزامی است' });
      const report = await prisma.dailyWorkReport.findUnique({ where: { id: Number(req.params.id) } });
      if (!report) return res.status(404).json({ error: 'گزارش یافت نشد' });

      const now = new Date().toISOString();
      await prisma.dailyWorkReport.update({
        where: { id: Number(req.params.id) },
        data: { status: 'rejected_by_central', centralComment: comment, centralBy: req.user.id, centralAt: now },
      });

      await addHistory(req.params.id, req.user.id, req.user.full_name, 'سانترال: رد', comment);
      await notify(report.userId, 'گزارش رد شد', `گزارش کار شما توسط سانترال رد شد`, '/daily-work-report');

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------- مدیر: تایید → برگشت به سانترال ----------
  router.post('/:id/manager-approve', async (req, res) => {
    try {
      const { comment } = req.body;
      const report = await prisma.dailyWorkReport.findUnique({ where: { id: Number(req.params.id) } });
      if (!report) return res.status(404).json({ error: 'گزارش یافت نشد' });
      if (report.status !== 'pending_manager') return res.status(400).json({ error: 'گزارش هنوز به مدیریت نرسیده' });

      const now = new Date().toISOString();
      await prisma.dailyWorkReport.update({
        where: { id: Number(req.params.id) },
        data: { status: 'manager_approved', managerComment: comment || '', managerBy: req.user.id, managerAt: now },
      });

      await addHistory(req.params.id, req.user.id, req.user.full_name, 'مدیر: تایید', comment);

      const centralUsers = await getCentralUsers();
      for (const u of centralUsers) {
        await notify(u.id, 'تایید مدیریت', `گزارش کار ${report.reportDate} توسط مدیر تایید شد - ارجاع به کنترل پروژه`, '/daily-work-report');
      }
      await notify(report.userId, 'گزارش تایید شد', `گزارش کار شما توسط مدیر تایید شد`, '/daily-work-report');

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------- مدیر: رد ----------
  router.post('/:id/manager-reject', async (req, res) => {
    try {
      const { comment } = req.body;
      if (!comment) return res.status(400).json({ error: 'دلیل رد الزامی است' });
      const report = await prisma.dailyWorkReport.findUnique({ where: { id: Number(req.params.id) } });
      if (!report) return res.status(404).json({ error: 'گزارش یافت نشد' });

      const now = new Date().toISOString();
      await prisma.dailyWorkReport.update({
        where: { id: Number(req.params.id) },
        data: { status: 'rejected_by_manager', managerComment: comment, managerBy: req.user.id, managerAt: now },
      });

      await addHistory(req.params.id, req.user.id, req.user.full_name, 'مدیر: رد', comment);
      await notify(report.userId, 'گزارش رد شد', `گزارش کار شما توسط مدیر رد شد`, '/daily-work-report');

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------- سانترال: ارجاع به کنترل پروژه ----------
  router.post('/:id/forward-to-project-control', async (req, res) => {
    try {
      const { comment } = req.body;
      const report = await prisma.dailyWorkReport.findUnique({ where: { id: Number(req.params.id) } });
      if (!report) return res.status(404).json({ error: 'گزارش یافت نشد' });
      if (report.status !== 'manager_approved') return res.status(400).json({ error: 'گزارش هنوز تایید مدیر را ندارد' });

      await prisma.dailyWorkReport.update({
        where: { id: Number(req.params.id) },
        data: { status: 'pending_project_control' },
      });

      await addHistory(req.params.id, req.user.id, req.user.full_name, 'سانترال: ارجاع به کنترل پروژه', comment);

      const pcUsers = await getProjectControlUsers();
      for (const u of pcUsers) {
        await notify(u.id, 'ارجاع به کنترل پروژه', `گزارش کار ${report.reportDate} از سانترال ارجاع داده شد`, '/daily-work-report');
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------- کنترل پروژه: تایید نهایی ----------
  router.post('/:id/project-control-approve', async (req, res) => {
    try {
      const { comment } = req.body;
      const report = await prisma.dailyWorkReport.findUnique({ where: { id: Number(req.params.id) } });
      if (!report) return res.status(404).json({ error: 'گزارش یافت نشد' });
      if (report.status !== 'pending_project_control') return res.status(400).json({ error: 'گزارش به کنترل پروژه نرسیده' });

      const now = new Date().toISOString();
      await prisma.dailyWorkReport.update({
        where: { id: Number(req.params.id) },
        data: { status: 'completed', projectControlComment: comment || '', projectControlBy: req.user.id, projectControlAt: now },
      });

      await addHistory(req.params.id, req.user.id, req.user.full_name, 'کنترل پروژه: تایید نهایی', comment);
      await notify(report.userId, 'تایید نهایی', `گزارش کار شما توسط کنترل پروژه تایید نهایی شد`, '/daily-work-report');

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------- حذف ----------
  router.delete('/:id', async (req, res) => {
    try {
      const report = await prisma.dailyWorkReport.findUnique({ where: { id: Number(req.params.id) } });
      if (!report) return res.status(404).json({ error: 'گزارش یافت نشد' });
      if (report.userId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      if (report.status !== 'pending_central') {
        return res.status(400).json({ error: 'فقط گزارش‌های در انتظار سانترال قابل حذف هستند' });
      }
      await prisma.dailyWorkReportHistory.deleteMany({ where: { reportId: Number(req.params.id) } });
      await prisma.dailyWorkReport.delete({ where: { id: Number(req.params.id) } });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
