const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { projectSupply } = require('../middleware/validate');
const { notify: notifyHelper, findSupervisorId: findSupervisorIdHelper, getNextNumber: getNextNumberHelper, addHistory: addHistoryHelper } = require('../utils/helpers');
const prisma = require('../database/prisma');
const { mapRow, flattenJoins } = require('../utils/dbAdapter');

const REQUEST_ALIASES = {
  user_name: 'user.fullName',
  department_name: 'dept.name',
  supervisor_name: 'supervisor.fullName',
  manager_name: 'manager.fullName',
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
  async function addHistory(id, userId, userName, action, comment) { await addHistoryHelper('project_supply_requests_history', 'supply_id', id, userId, userName, action, comment); }
  async function findSupervisorId(departmentId) { return findSupervisorIdHelper(departmentId); }
  async function getNextNumber() { return getNextNumberHelper('project_supply_requests_counter', 'پروژه'); }

  function toListResponse(rows, nameMap) {
    return rows.map(r => mapRow(flattenJoins(decorateNames(r, nameMap), REQUEST_ALIASES)));
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

      const total = await prisma.projectSupplyRequest.count({ where });
      const requests = await prisma.projectSupplyRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: REQUEST_INCLUDE,
        take: limitNum,
        skip: offset,
      });

      const nameMap = await getRelatedUserNames(requests);

      res.json({ requests: toListResponse(requests, nameMap), total, page: pageNum, limit: limitNum });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/my-requests', async (req, res) => {
    try {
      const requests = await prisma.projectSupplyRequest.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        include: REQUEST_INCLUDE,
      });
      const nameMap = await getRelatedUserNames(requests);
      res.json(toListResponse(requests, nameMap));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const request = await prisma.projectSupplyRequest.findUnique({
        where: { id: Number(req.params.id) },
        include: REQUEST_INCLUDE,
      });

      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });

      const history = await prisma.projectSupplyRequestHistory.findMany({
        where: { supplyId: Number(req.params.id) },
        orderBy: { createdAt: 'asc' },
      });

      const nameMap = await getRelatedUserNames([request]);

      res.json({ request: mapRow(flattenJoins(decorateNames(request, nameMap), REQUEST_ALIASES)), history: mapRow(history) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/', projectSupply, async (req, res) => {
    try {
      const { project_name, items, description, urgency = 'normal', estimated_cost, deadline } = req.body;
      const itemsData = typeof items === 'string' ? JSON.parse(items) : items;
      if (!project_name || !itemsData || itemsData.length === 0) {
        return res.status(400).json({ error: 'نام پروژه و حداقل یک کالا الزامی است' });
      }

      const user = await prisma.user.findUnique({
        where: { id: Number(req.user.id) },
        select: { departmentId: true },
      });
      const supervisorId = await findSupervisorId(user?.departmentId);
      const requestNumber = await getNextNumber();

      const result = await prisma.projectSupplyRequest.create({
        data: {
          userId: Number(req.user.id),
          requestNumber,
          projectName: project_name,
          items: itemsData,
          description: description || '',
          urgency,
          estimatedCost: estimated_cost || null,
          deadline: deadline || null,
          departmentId: user?.departmentId || null,
          status: 'pending_supervisor',
        },
      });

      await addHistory(result.id, req.user.id, req.user.full_name, 'ثبت درخواست', null);

      if (supervisorId) {
        await notify(supervisorId, 'درخواست تامین کالای پروژه جدید', `درخواست شماره ${requestNumber} توسط ${req.user.full_name} ثبت شد`, '/project-supply');
      }

      res.json({ id: result.id, request_number: requestNumber });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/approve', async (req, res) => {
    try {
      const { comment } = req.body;
      const request = await prisma.projectSupplyRequest.findUnique({ where: { id: Number(req.params.id) } });
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });

      const now = new Date().toISOString();
      let newStatus = '';
      let historyAction = '';

      if (request.status === 'pending_supervisor') {
        newStatus = 'pending_manager';
        await prisma.projectSupplyRequest.update({
          where: { id: Number(req.params.id) },
          data: { supervisorId: Number(req.user.id), supervisorComment: comment, supervisorDate: now, status: newStatus },
        });
        historyAction = 'تایید سرپرست';
        const managers = await prisma.user.findMany({ where: { role: 'manager' }, select: { id: true } });
        for (const mgr of managers) {
          await notify(mgr.id, 'درخواست تامین کالا نیاز به تایید', `درخواست شماره ${request.requestNumber} توسط سرپرست تایید شد`, '/project-supply');
        }
      } else if (request.status === 'pending_manager') {
        newStatus = 'approved';
        await prisma.projectSupplyRequest.update({
          where: { id: Number(req.params.id) },
          data: { managerId: Number(req.user.id), managerComment: comment, managerDate: now, status: newStatus },
        });
        historyAction = 'تایید مدیر';
      } else {
        return res.status(400).json({ error: 'وضعیت درخواست نامعتبر است' });
      }

      await addHistory(req.params.id, req.user.id, req.user.full_name, historyAction, comment);
      await notify(request.userId, 'تایید درخواست تامین کالا', `درخواست شماره ${request.requestNumber} تایید شد`, '/project-supply');

      res.json({ success: true, status: newStatus });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/reject', async (req, res) => {
    try {
      const { comment } = req.body;
      const request = await prisma.projectSupplyRequest.findUnique({ where: { id: Number(req.params.id) } });
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });
      if (!comment) return res.status(400).json({ error: 'دلیل رد الزامی است' });

      const now = new Date().toISOString();

      if (request.status === 'pending_supervisor') {
        await prisma.projectSupplyRequest.update({
          where: { id: Number(req.params.id) },
          data: { supervisorId: Number(req.user.id), supervisorComment: comment, supervisorDate: now, status: 'rejected' },
        });
        await addHistory(req.params.id, req.user.id, req.user.full_name, 'رد توسط سرپرست', comment);
      } else if (request.status === 'pending_manager') {
        await prisma.projectSupplyRequest.update({
          where: { id: Number(req.params.id) },
          data: { managerId: Number(req.user.id), managerComment: comment, managerDate: now, status: 'rejected' },
        });
        await addHistory(req.params.id, req.user.id, req.user.full_name, 'رد توسط مدیر', comment);
      } else {
        return res.status(400).json({ error: 'وضعیت درخواست نامعتبر است' });
      }

      await notify(request.userId, 'رد درخواست تامین کالا', `درخواست شماره ${request.requestNumber} رد شد`, '/project-supply');

      res.json({ success: true, status: 'rejected' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const request = await prisma.projectSupplyRequest.findUnique({ where: { id: Number(req.params.id) } });
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });
      if (request.userId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      if (request.status !== 'pending_supervisor') {
        return res.status(400).json({ error: 'امکان حذف درخواست در این مرحله وجود ندارد' });
      }

      await prisma.projectSupplyRequestHistory.deleteMany({ where: { supplyId: Number(req.params.id) } });
      await prisma.projectSupplyRequest.delete({ where: { id: Number(req.params.id) } });

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
