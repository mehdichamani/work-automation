const express = require('express');
const { authMiddleware, roleGuard } = require('../middleware/auth');
const prisma = require('../database/prisma');
const { mapRow, flattenJoins } = require('../utils/dbAdapter');

function getNowString() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

module.exports = function() {
  const router = express.Router();
  router.use(authMiddleware);

  function isWarehouseStaff(req) {
    if (req.user.role === 'admin') return true;
    if (req.user.department_name === 'انبار') return true;
    return false;
  }

  function warehouseGuard(req, res, next) {
    if (!isWarehouseStaff(req)) {
      return res.status(403).json({ error: 'فقط کارکنان انبار اجازه دسترسی دارند' });
    }
    next();
  }

  async function notify(userId, title, body, link) {
    await prisma.notification.create({ data: { userId: Number(userId), title, body, link } });
  }

  router.get('/items', async (req, res) => {
    try {
      const items = await prisma.inventoryItem.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
      res.json(mapRow(items));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/items', warehouseGuard, async (req, res) => {
    try {
      const { name, description, unit } = req.body;
      const result = await prisma.inventoryItem.create({ data: { name, description: description || '', unit: unit || 'عدد' } });
      res.json({ id: result.id, message: 'کالا اضافه شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/items/:id', warehouseGuard, async (req, res) => {
    try {
      const { name, description, unit } = req.body;
      await prisma.inventoryItem.update({
        where: { id: Number(req.params.id) },
        data: { name, description: description || '', unit: unit || 'عدد' },
      });
      res.json({ message: 'کالا ویرایش شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/items/:id', warehouseGuard, async (req, res) => {
    try {
      const inUse = await prisma.cardex.findFirst({ where: { itemId: Number(req.params.id) } });
      if (inUse) return res.status(400).json({ error: 'این کالا در کاردکس استفاده شده و قابل حذف نیست' });
      await prisma.inventoryItem.update({ where: { id: Number(req.params.id) }, data: { isActive: false } });
      res.json({ message: 'کالا حذف شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/my-cardex', async (req, res) => {
    try {
      const cardex = await prisma.cardex.findMany({
        where: { userId: Number(req.user.id) },
        orderBy: { createdAt: 'desc' },
        include: {
          item: { select: { name: true, unit: true } },
          warehouseUser: { select: { fullName: true } },
        },
      });
      const mapped = cardex.map(r => flattenJoins(r, { item_name: 'item.name', item_unit: 'item.unit', warehouse_user_name: 'warehouseUser.fullName' }));
      res.json(mapRow(mapped));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/pending-confirm', async (req, res) => {
    try {
      const cardex = await prisma.cardex.findMany({
        where: { userId: Number(req.user.id), status: 'pending_user' },
        orderBy: { createdAt: 'desc' },
        include: {
          item: { select: { name: true, unit: true } },
          warehouseUser: { select: { fullName: true } },
        },
      });
      const mapped = cardex.map(r => flattenJoins(r, { item_name: 'item.name', item_unit: 'item.unit', warehouse_user_name: 'warehouseUser.fullName' }));
      res.json(mapRow(mapped));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/all', warehouseGuard, async (req, res) => {
    try {
      const cardex = await prisma.cardex.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          item: { select: { name: true, unit: true } },
          user: { select: { fullName: true } },
          warehouseUser: { select: { fullName: true } },
        },
      });
      const mapped = cardex.map(r => flattenJoins(r, {
        item_name: 'item.name',
        item_unit: 'item.unit',
        user_name: 'user.fullName',
        warehouse_user_name: 'warehouseUser.fullName',
      }));
      res.json(mapRow(mapped));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/', warehouseGuard, async (req, res) => {
    try {
      const { user_id, item_id, quantity, delivery_date, notes } = req.body;
      if (!user_id || !item_id || !quantity || !delivery_date) {
        return res.status(400).json({ error: 'فیلدهای الزامی را پر کنید' });
      }

      const result = await prisma.cardex.create({
        data: {
          userId: Number(user_id),
          itemId: Number(item_id),
          quantity: Number(quantity),
          deliveryDate: delivery_date,
          warehouseUserId: Number(req.user.id),
          notes: notes || '',
          status: 'pending_user',
        },
      });

      await notify(user_id, 'اقلام جدید در کارتکس', `اقلام جدیدی به کارتکس شما اضافه شده و منتظر تایید شماست`, '/inventory');

      res.json({ id: result.id, message: 'اقلام به کارتکس اضافه شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id/confirm', async (req, res) => {
    try {
      const cardex = await prisma.cardex.findFirst({
        where: { id: Number(req.params.id), userId: Number(req.user.id), status: 'pending_user' },
      });
      if (!cardex) return res.status(404).json({ error: 'آیتم یافت نشد یا قبلاً تایید شده' });

      await prisma.cardex.update({
        where: { id: Number(req.params.id) },
        data: { status: 'confirmed', userConfirmDate: getNowString() },
      });
      res.json({ message: 'اقلام تایید شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id/reject', async (req, res) => {
    try {
      const cardex = await prisma.cardex.findFirst({
        where: { id: Number(req.params.id), userId: Number(req.user.id), status: 'pending_user' },
      });
      if (!cardex) return res.status(404).json({ error: 'آیتم یافت نشد' });

      await prisma.cardex.update({
        where: { id: Number(req.params.id) },
        data: { status: 'rejected' },
      });
      res.json({ message: 'اقلام رد شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/user-cardex/:userId', warehouseGuard, async (req, res) => {
    try {
      const cardex = await prisma.cardex.findMany({
        where: { userId: Number(req.params.userId), status: 'confirmed' },
        orderBy: { deliveryDate: 'desc' },
        include: {
          item: { select: { name: true, unit: true } },
          warehouseUser: { select: { fullName: true } },
        },
      });
      const mapped = cardex.map(r => flattenJoins(r, { item_name: 'item.name', item_unit: 'item.unit', warehouse_user_name: 'warehouseUser.fullName' }));
      res.json(mapRow(mapped));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
