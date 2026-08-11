const express = require('express');
const { authMiddleware, roleGuard } = require('../middleware/auth');
const moment = require('moment-jalaali');
const prisma = require('../database/prisma');
const { mapRow, flattenJoins } = require('../utils/dbAdapter');

module.exports = function() {
  const router = express.Router();
  router.use(authMiddleware);

  function getWeekDates() {
    const dates = [];
    const today = moment();
    for (let i = 0; i < 7; i++) {
      const d = today.clone().add(i, 'days');
      dates.push(d.format('jYYYY/jMM/jDD'));
    }
    return dates;
  }

  async function canManageMenu(user) {
    if (user.role === 'admin') return true;
    if (user.role === 'supervisor') {
      const dept = await prisma.department.findUnique({ where: { id: Number(user.department_id) } });
      return dept && dept.name === 'رستوران';
    }
    return false;
  }

  router.get('/menu', async (req, res) => {
    try {
      const weekDates = getWeekDates();
      const menu = await prisma.restaurantMenu.findMany({
        where: { foodDate: { in: weekDates }, isActive: true },
        orderBy: [{ foodDate: 'asc' }, { optionNumber: 'asc' }],
      });
      res.json(mapRow(menu));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/menu-all', async (req, res) => {
    try {
      if (!(await canManageMenu(req.user))) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      const menu = await prisma.restaurantMenu.findMany({
        orderBy: [{ foodDate: 'desc' }, { optionNumber: 'asc' }],
      });
      res.json(mapRow(menu));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/menu', async (req, res) => {
    try {
      if (!(await canManageMenu(req.user))) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      const { food_date, option_number, food_name, description, price } = req.body;
      if (!food_date || !option_number || !food_name) {
        return res.status(400).json({ error: 'تاریخ، شماره گزینه و نام غذا الزامی است' });
      }
      if (option_number < 1 || option_number > 2) {
        return res.status(400).json({ error: 'شماره گزینه باید ۱ یا ۲ باشد' });
      }
      const existing = await prisma.restaurantMenu.findFirst({ where: { foodDate: food_date, optionNumber: Number(option_number), isActive: true } });
      if (existing) {
        return res.status(400).json({ error: 'این گزینه قبلاً برای این تاریخ ثبت شده است' });
      }
      const result = await prisma.restaurantMenu.create({
        data: {
          foodDate: food_date,
          optionNumber: Number(option_number),
          foodName: food_name,
          description: description || '',
          price: Number(price) || 0,
        },
      });
      res.json({ id: result.id, message: 'غذا به منو اضافه شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/menu-bulk', async (req, res) => {
    try {
      if (!(await canManageMenu(req.user))) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      const { items } = req.body;

      const added = await prisma.$transaction(async (tx) => {
        let count = 0;
        for (const item of items) {
          if (!item.food_date || !item.option_number || !item.food_name) continue;
          if (item.option_number < 1 || item.option_number > 2) continue;
          const existing = await tx.restaurantMenu.findFirst({ where: { foodDate: item.food_date, optionNumber: Number(item.option_number), isActive: true } });
          if (existing) continue;
          await tx.restaurantMenu.create({
            data: {
              foodDate: item.food_date,
              optionNumber: Number(item.option_number),
              foodName: item.food_name,
              description: item.description || '',
              price: Number(item.price) || 0,
            },
          });
          count++;
        }
        return count;
      });
      res.json({ message: `${added} غذا به منو اضافه شد` });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/menu/:id', async (req, res) => {
    try {
      if (!(await canManageMenu(req.user))) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      const { food_name, description, price, is_active } = req.body;
      await prisma.restaurantMenu.update({
        where: { id: Number(req.params.id) },
        data: {
          foodName: food_name,
          description: description || '',
          price: Number(price) || 0,
          isActive: is_active !== undefined ? Boolean(Number(is_active)) : true,
        },
      });
      res.json({ message: 'منو ویرایش شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/menu/:id', async (req, res) => {
    try {
      if (!(await canManageMenu(req.user))) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      const food = await prisma.restaurantMenu.findUnique({ where: { id: Number(req.params.id) } });
      if (!food) return res.status(404).json({ error: 'غذا یافت نشد' });
      await prisma.restaurantReservation.updateMany({ where: { foodId: Number(req.params.id), status: 'active' }, data: { status: 'cancelled' } });
      await prisma.restaurantMenu.delete({ where: { id: Number(req.params.id) } });
      res.json({ message: 'غذا حذف شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/reserve', async (req, res) => {
    try {
      const { food_id, quantity, notes } = req.body;
      if (!food_id) {
        return res.status(400).json({ error: 'انتخاب غذا الزامی است' });
      }

      const food = await prisma.restaurantMenu.findFirst({ where: { id: Number(food_id), isActive: true } });
      if (!food) {
        return res.status(404).json({ error: 'غذا یافت نشد' });
      }

      const todayJalali = moment().format('jYYYY/jMM/jDD');
      if (food.foodDate < todayJalali) {
        return res.status(400).json({ error: 'امکان رزرو غذای گذشته وجود ندارد' });
      }

      const foodMoment = moment(food.foodDate, 'jYYYY/jMM/jDD');
      const hoursUntil = Math.floor((foodMoment.toDate().getTime() - moment().toDate().getTime()) / (1000 * 60 * 60));
      if (hoursUntil < 24) {
        return res.status(400).json({ error: 'رزرو غذا کمتر از ۲۴ ساعت قبل امکان‌پذیر نیست' });
      }

      const weekEnd = moment().add(6, 'days').format('jYYYY/jMM/jDD');
      if (food.foodDate > weekEnd) {
        return res.status(400).json({ error: 'فقط تا یک هفته آینده امکان رزرو دارید' });
      }

      const existing = await prisma.restaurantReservation.findFirst({
        where: { userId: Number(req.user.id), foodId: Number(food_id), status: 'active' },
      });
      if (existing) {
        return res.status(400).json({ error: 'شما قبلاً این غذا را رزرو کرده‌اید' });
      }

      const sameDayReservation = await prisma.restaurantReservation.findFirst({
        where: { userId: Number(req.user.id), status: 'active', food: { foodDate: food.foodDate } },
      });
      if (sameDayReservation) {
        return res.status(400).json({ error: 'شما قبلاً برای این روز غذا رزرو کرده‌اید' });
      }

      const result = await prisma.restaurantReservation.create({
        data: {
          userId: Number(req.user.id),
          foodId: Number(food_id),
          foodDate: food.foodDate,
          quantity: Number(quantity) || 1,
          notes: notes || '',
        },
      });

      res.json({ id: result.id, message: 'غذا رزرو شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/my-reservations', async (req, res) => {
    try {
      const reservations = await prisma.restaurantReservation.findMany({
        where: { userId: Number(req.user.id) },
        orderBy: { foodDate: 'desc' },
        include: {
          food: { select: { foodName: true, description: true, optionNumber: true, foodDate: true } },
        },
      });

      const mapped = reservations.map(r => flattenJoins(r, {
        food_name: 'food.foodName',
        food_description: 'food.description',
        option_number: 'food.optionNumber',
        food_date: 'food.foodDate',
      }));

      const now = moment();
      const result = mapped.map(r => {
        const foodMoment = moment(r.food_date, 'jYYYY/jMM/jDD');
        const hoursLeft = foodMoment.toDate().getTime() - now.toDate().getTime();
        const hours = Math.floor(hoursLeft / (1000 * 60 * 60));
        return { ...r, can_cancel: r.status === 'active' && hours >= 24 };
      });

      res.json(mapRow(result));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/cancel/:id', async (req, res) => {
    try {
      const reservation = await prisma.restaurantReservation.findFirst({
        where: { id: Number(req.params.id), userId: Number(req.user.id), status: 'active' },
        include: { food: { select: { foodDate: true } } },
      });
      if (!reservation) {
        return res.status(404).json({ error: 'رزرو یافت نشد' });
      }

      const now = moment();
      const foodMoment = moment(reservation.food.foodDate, 'jYYYY/jMM/jDD');
      const hoursLeft = foodMoment.toDate().getTime() - now.toDate().getTime();
      const hours = Math.floor(hoursLeft / (1000 * 60 * 60));
      if (hours < 24 && req.user.role !== 'admin') {
        return res.status(400).json({ error: 'امکان لغو رزرو کمتر از ۲۴ ساعت قبل از وعده غذا وجود ندارد' });
      }

      await prisma.restaurantReservation.update({ where: { id: Number(req.params.id) }, data: { status: 'cancelled' } });
      res.json({ message: 'رزرو لغو شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/monitoring', async (req, res) => {
    try {
      if (!(await canManageMenu(req.user))) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      const weekDates = getWeekDates();

      const rows = await prisma.restaurantReservation.findMany({
        where: { foodDate: { in: weekDates }, status: 'active' },
        orderBy: [{ foodDate: 'asc' }, { food: { optionNumber: 'asc' } }],
        include: {
          food: { select: { foodName: true, optionNumber: true } },
        },
      });

      const groupMap = new Map();
      for (const r of rows) {
        const key = `${r.foodDate}|${r.food.foodName}`;
        if (!groupMap.has(key)) {
          groupMap.set(key, { food_date: r.foodDate, food_name: r.food.foodName, option_number: r.food.optionNumber, reservation_count: 0, total_quantity: 0 });
        }
        const entry = groupMap.get(key);
        entry.reservation_count++;
        entry.total_quantity += r.quantity;
      }
      const dailyCounts = Array.from(groupMap.values());

      const totalGroups = await prisma.restaurantReservation.groupBy({
        by: ['foodDate'],
        where: { foodDate: { in: weekDates }, status: 'active' },
        _count: { id: true },
        _sum: { quantity: true },
        orderBy: { foodDate: 'asc' },
      });
      const totalCounts = totalGroups.map(g => ({ food_date: g.foodDate, total_reservations: g._count.id, total_meals: g._sum.quantity ?? 0 }));

      res.json({ dailyCounts, totalCounts });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/monitoring-detailed', async (req, res) => {
    try {
      if (!(await canManageMenu(req.user))) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      const weekDates = getWeekDates();

      const reservations = await prisma.restaurantReservation.findMany({
        where: { foodDate: { in: weekDates }, status: 'active' },
        orderBy: [{ foodDate: 'asc' }, { food: { optionNumber: 'asc' } }],
        include: {
          food: { select: { foodName: true, description: true, optionNumber: true } },
          user: { select: { fullName: true, department: { select: { name: true } } } },
        },
      });

      const mapped = reservations.map(r => flattenJoins(r, {
        food_name: 'food.foodName',
        food_description: 'food.description',
        option_number: 'food.optionNumber',
        user_name: 'user.fullName',
        user_dept: 'user.department.name',
      }));

      res.json(mapRow(mapped));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
