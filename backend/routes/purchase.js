const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { validateInput } = require('../middleware/validate');
const { notify: notifyHelper, findSupervisorId: findSupervisorIdHelper, getNextNumber: getNextNumberHelper, addHistory: addHistoryHelper } = require('../utils/helpers');
const prisma = require('../database/prisma');
const { mapRow, flattenJoins } = require('../utils/dbAdapter');

const REQUEST_ALIASES = {
  user_name: 'user.fullName',
  department_name: 'dept.name',
  supervisor_name: 'supervisor.fullName',
  manager_name: 'manager.fullName',
  warehouse_name: 'warehouse.fullName',
  factory_manager_name: 'factoryManager.fullName',
  budget_name: 'budget.fullName',
};

const REQUEST_INCLUDE = {
  user: { select: { fullName: true } },
  dept: { select: { name: true } },
};

const NAME_FK_FIELDS = ['supervisorId', 'managerId', 'warehouseId', 'factoryManagerId', 'budgetId'];
const NAME_KEYS = ['supervisor', 'manager', 'warehouse', 'factoryManager', 'budget'];

module.exports = function () {
  const router = express.Router();
  router.use(authMiddleware);

  async function notify(userId, title, body, link) { await notifyHelper(userId, title, body, link); }
  async function addHistory(id, userId, userName, action, comment) { await addHistoryHelper('purchase_history', 'request_id', id, userId, userName, action, comment); }
  async function findSupervisorId(departmentId) { return findSupervisorIdHelper(departmentId); }
  async function getNextNumber() { return getNextNumberHelper('purchase_counter', 'خرید'); }

  async function getItems(requestId) {
    return prisma.purchaseItem.findMany({
      where: { requestId: Number(requestId) },
      orderBy: { rowIndex: 'asc' },
    });
  }

  async function saveItems(requestId, items) {
    await prisma.$transaction(async (tx) => {
      await tx.purchaseItem.deleteMany({ where: { requestId: Number(requestId) } });
      if (items && items.length > 0) {
        await tx.purchaseItem.createMany({
          data: items.map((item, i) => ({
            requestId: Number(requestId),
            rowIndex: i + 1,
            itemCode: item.item_code || '',
            description: item.description || '',
            purchaseLocation: item.purchase_location || 'Urmia',
            technicalSpecs: item.technical_specs || '',
            requestedQuantity: Number(item.requested_quantity) || 0,
            approvedQuantity: Number(item.approved_quantity) || 0,
            usageLocation: item.usage_location || '',
            price: Number(item.price) || 0,
            unit: item.unit || '',
          })),
        });
      }
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

      const total = await prisma.purchaseRequest.count({ where });
      const rows = await prisma.purchaseRequest.findMany({
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
      const rows = await prisma.purchaseRequest.findMany({
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
      const request = await prisma.purchaseRequest.findUnique({
        where: { id: Number(req.params.id) },
        include: REQUEST_INCLUDE,
      });

      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });

      request.items = await getItems(req.params.id);
      const history = await prisma.purchaseHistory.findMany({
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

  router.post('/', validateInput({ description: 1000 }), async (req, res) => {
    try {
      const { items, department, urgency = 'normal', reason } = req.body;
      if (!items || items.length === 0) {
        return res.status(400).json({ error: 'حداقل یک کالا وارد کنید' });
      }

      const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { departmentId: true } });
      const supervisorId = await findSupervisorId(user?.departmentId);
      const requestNumber = await getNextNumber();

      const newRequest = await prisma.$transaction(async (tx) => {
        const created = await tx.purchaseRequest.create({
          data: {
            userId: req.user.id,
            requestNumber,
            department: department || '',
            urgency,
            reason: reason || '',
            departmentId: user?.departmentId ?? null,
            status: 'pending_supervisor',
          },
        });
        if (items.length > 0) {
          await tx.purchaseItem.createMany({
            data: items.map((item, i) => ({
              requestId: created.id,
              rowIndex: i + 1,
              itemCode: item.item_code || '',
              description: item.description || '',
              purchaseLocation: item.purchase_location || 'Urmia',
              technicalSpecs: item.technical_specs || '',
              requestedQuantity: Number(item.requested_quantity) || 0,
              approvedQuantity: Number(item.approved_quantity) || 0,
              usageLocation: item.usage_location || '',
              price: Number(item.price) || 0,
              unit: item.unit || '',
            })),
          });
        }
        return created;
      });

      const requestId = newRequest.id;
      await addHistory(requestId, req.user.id, req.user.full_name, 'ثبت درخواست', null);

      if (supervisorId) {
        await notify(supervisorId, 'درخواست خرید جدید', `درخواست شماره ${requestNumber} توسط ${req.user.full_name} ثبت شد`, '/purchase');
      }

      res.json({ id: requestId, request_number: requestNumber });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/approve', async (req, res) => {
    try {
      const { comment, items } = req.body;
      const request = await prisma.purchaseRequest.findUnique({ where: { id: Number(req.params.id) } });
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });

      const now = new Date().toISOString();
      let newStatus = '';
      let historyAction = '';

      if (request.status === 'pending_supervisor') {
        newStatus = 'pending_manager';
        await prisma.purchaseRequest.update({
          where: { id: Number(req.params.id) },
          data: { supervisorId: req.user.id, supervisorComment: comment, supervisorDate: now, status: newStatus },
        });
        historyAction = 'تایید سرپرست';
        const managers = await prisma.user.findMany({ where: { role: 'manager' }, select: { id: true } });
        for (const mgr of managers) {
          await notify(mgr.id, 'درخواست خرید نیاز به تایید', `درخواست شماره ${request.request_number} توسط سرپرست تایید شد`, '/purchase');
        }
      } else if (request.status === 'pending_manager') {
        newStatus = 'pending_warehouse';
        await prisma.purchaseRequest.update({
          where: { id: Number(req.params.id) },
          data: { managerId: req.user.id, managerComment: comment, managerDate: now, status: newStatus },
        });
        historyAction = 'تایید مدیر';
        const warehouseUsers = await prisma.user.findMany({ where: { role: 'admin' }, select: { id: true } });
        for (const w of warehouseUsers) {
          await notify(w.id, 'درخواست خرید نیاز به تایید انبار', `درخواست شماره ${request.request_number} توسط مدیر تایید شد`, '/purchase');
        }
      } else if (request.status === 'pending_warehouse') {
        newStatus = 'approved';
        await prisma.purchaseRequest.update({
          where: { id: Number(req.params.id) },
          data: { warehouseId: req.user.id, warehouseComment: comment, warehouseDate: now, status: newStatus },
        });
        historyAction = 'تایید نهایی انبار';
        if (items && items.length > 0) {
          await saveItems(req.params.id, items);
        }
      } else {
        return res.status(400).json({ error: 'وضعیت درخواست نامعتبر است' });
      }

      await addHistory(req.params.id, req.user.id, req.user.full_name, historyAction, comment);
      await notify(request.userId, 'تایید درخواست خرید', `درخواست شماره ${request.request_number} ${historyAction} شد`, '/purchase');

      res.json({ success: true, status: newStatus });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/reject', async (req, res) => {
    try {
      const { comment } = req.body;
      const request = await prisma.purchaseRequest.findUnique({ where: { id: Number(req.params.id) } });
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });
      if (!comment) return res.status(400).json({ error: 'دلیل رد الزامی است' });

      const now = new Date().toISOString();
      let historyAction = '';

      if (request.status === 'pending_supervisor') {
        await prisma.purchaseRequest.update({
          where: { id: Number(req.params.id) },
          data: { supervisorId: req.user.id, supervisorComment: comment, supervisorDate: now, status: 'rejected' },
        });
        historyAction = 'رد توسط سرپرست';
      } else if (request.status === 'pending_manager') {
        await prisma.purchaseRequest.update({
          where: { id: Number(req.params.id) },
          data: { managerId: req.user.id, managerComment: comment, managerDate: now, status: 'rejected' },
        });
        historyAction = 'رد توسط مدیر';
      } else if (request.status === 'pending_warehouse') {
        await prisma.purchaseRequest.update({
          where: { id: Number(req.params.id) },
          data: { warehouseId: req.user.id, warehouseComment: comment, warehouseDate: now, status: 'rejected' },
        });
        historyAction = 'رد توسط انبار';
      } else {
        return res.status(400).json({ error: 'وضعیت درخواست نامعتبر است' });
      }

      await addHistory(req.params.id, req.user.id, req.user.full_name, historyAction, comment);
      await notify(request.userId, 'رد درخواست خرید', `درخواست شماره ${request.request_number} رد شد. دلیل: ${comment}`, '/purchase');

      res.json({ success: true, status: 'rejected' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const request = await prisma.purchaseRequest.findUnique({ where: { id: Number(req.params.id) } });
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });
      if (request.userId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      if (request.status !== 'pending_supervisor') {
        return res.status(400).json({ error: 'امکان حذف درخواست در این مرحله وجود ندارد' });
      }

      await prisma.purchaseItem.deleteMany({ where: { requestId: Number(req.params.id) } });
      await prisma.purchaseHistory.deleteMany({ where: { requestId: Number(req.params.id) } });
      await prisma.purchaseRequest.delete({ where: { id: Number(req.params.id) } });

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
