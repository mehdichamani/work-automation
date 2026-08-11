const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { conference } = require('../middleware/validate');
const { notify: notifyHelper, getNextNumber: getNextNumberHelper, addHistory: addHistoryHelper } = require('../utils/helpers');
const prisma = require('../database/prisma');
const { mapRow, flattenJoins } = require('../utils/dbAdapter');

const BOOKING_ALIASES = {
  user_name: 'user.fullName',
  department_name: 'user.department.name',
  manager_name: 'manager.fullName',
};

const BOOKING_INCLUDE = {
  user: { select: { fullName: true, department: { select: { name: true } } } },
};

const NAME_FK_FIELDS = ['managerId'];
const NAME_KEYS = ['manager'];

const PENDING_ALIASES = {
  user_name: 'user.fullName',
  department_name: 'user.department.name',
};

const PENDING_INCLUDE = {
  user: { select: { fullName: true, department: { select: { name: true } } } },
};

module.exports = function () {
  const router = express.Router();
  router.use(authMiddleware);

  async function notify(userId, title, body, link) { await notifyHelper(userId, title, body, link); }
  async function addHistory(id, userId, userName, action, comment) { await addHistoryHelper('conference_history', 'request_id', id, userId, userName, action, comment); }
  async function getNextNumber() { return getNextNumberHelper('conference_counter', 'جلسه'); }

  function toListResponse(rows, aliases, nameMap) {
    return rows.map(r => mapRow(flattenJoins(decorateNames(r, nameMap), aliases || BOOKING_ALIASES)));
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

      if (req.user.role === 'user' || req.user.role === 'supervisor') {
        where.userId = req.user.id;
      } else if (req.user.role === 'manager') {
        where.status = 'pending_manager';
      }

      if (status && status !== 'all') {
        where.status = status;
      }

      const total = await prisma.conferenceBooking.count({ where });
      const bookings = await prisma.conferenceBooking.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: BOOKING_INCLUDE,
        take: limitNum,
        skip: offset,
      });

      const nameMap = await getRelatedUserNames(bookings);

      res.json({ bookings: toListResponse(bookings, BOOKING_ALIASES, nameMap), total, page: pageNum, limit: limitNum });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/my-bookings', async (req, res) => {
    try {
      const bookings = await prisma.conferenceBooking.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        include: BOOKING_INCLUDE,
      });
      const nameMap = await getRelatedUserNames(bookings);
      res.json(toListResponse(bookings, BOOKING_ALIASES, nameMap));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/pending-manager', async (req, res) => {
    try {
      if (req.user.role !== 'manager' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      const bookings = await prisma.conferenceBooking.findMany({
        where: { status: 'pending_manager' },
        orderBy: { createdAt: 'desc' },
        include: PENDING_INCLUDE,
      });
      const nameMap = await getRelatedUserNames(bookings);
      res.json(toListResponse(bookings, PENDING_ALIASES, nameMap));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/available', async (req, res) => {
    try {
      const { date } = req.query;
      if (!date) return res.status(400).json({ error: 'تاریخ الزامی است' });

      const booked = await prisma.conferenceBooking.findMany({
        where: { bookingDate: date, status: { notIn: ['rejected', 'cancelled'] } },
        select: { startTime: true, endTime: true },
      });

      const allSlots = [
        { start: '08:00', end: '09:30' },
        { start: '09:30', end: '11:00' },
        { start: '11:00', end: '12:30' },
        { start: '13:30', end: '15:00' },
        { start: '15:00', end: '16:30' },
        { start: '16:30', end: '18:00' },
      ];

      const available = allSlots.filter(slot => {
        return !booked.some(b => b.startTime <= slot.start && b.endTime > slot.start);
      });

      res.json({ available, booked: mapRow(booked) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const booking = await prisma.conferenceBooking.findUnique({
        where: { id: Number(req.params.id) },
        include: BOOKING_INCLUDE,
      });
      if (!booking) return res.status(404).json({ error: 'رزرو یافت نشد' });

      const history = await prisma.conferenceHistory.findMany({
        where: { requestId: Number(req.params.id) },
        orderBy: { createdAt: 'asc' },
      });
      const nameMap = await getRelatedUserNames([booking]);
      res.json({ booking: mapRow(flattenJoins(decorateNames(booking, nameMap), BOOKING_ALIASES)), history: mapRow(history) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/', conference, async (req, res) => {
    try {
      const { booking_date, start_time, end_time, title, description, attendees_count } = req.body;
      if (!booking_date || !start_time || !end_time || !title) {
        return res.status(400).json({ error: 'فیلدهای الزامی را پر کنید' });
      }

      const conflict = await prisma.conferenceBooking.findFirst({
        where: {
          bookingDate: booking_date,
          status: { notIn: ['rejected', 'cancelled'] },
          NOT: {
            OR: [
              { endTime: { lte: start_time } },
              { startTime: { gte: end_time } },
            ],
          },
        },
        select: { id: true },
      });

      if (conflict) {
        return res.status(400).json({ error: 'این بازه زمانی قبلاً رزرو شده است' });
      }

      const requestNumber = await getNextNumber();

      const result = await prisma.conferenceBooking.create({
        data: {
          userId: Number(req.user.id),
          bookingDate: booking_date,
          startTime: start_time,
          endTime: end_time,
          title,
          description: description || '',
          attendeesCount: attendees_count !== undefined && attendees_count !== '' ? Number(attendees_count) : 0,
          status: 'pending_manager',
        },
      });

      const bookingId = result.id;
      await addHistory(bookingId, req.user.id, req.user.full_name, 'ثبت درخواست', '');

      const managers = await prisma.user.findMany({ where: { role: 'manager', isActive: true }, select: { id: true } });
      for (const mgr of managers) {
        await notify(mgr.id, 'درخواست رزرو سالن جدید', `رزرو "${title}" توسط ${req.user.full_name} ثبت شده`, '/conference');
      }

      res.json({ id: bookingId, request_number: requestNumber });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/approve', async (req, res) => {
    try {
      if (req.user.role !== 'manager' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      const booking = await prisma.conferenceBooking.findUnique({ where: { id: Number(req.params.id) } });
      if (!booking) return res.status(404).json({ error: 'رزرو یافت نشد' });
      if (booking.status !== 'pending_manager') {
        return res.status(400).json({ error: 'این رزرو قبلاً بررسی شده' });
      }

      await prisma.conferenceBooking.update({
        where: { id: Number(req.params.id) },
        data: { status: 'approved', managerId: Number(req.user.id), managerComment: req.body.comment || '' },
      });
      await addHistory(req.params.id, req.user.id, req.user.full_name, 'تایید مدیر', req.body.comment || '');

      if (booking.userId) {
        await notify(booking.userId, 'تایید رزرو سالن', `رزرو "${booking.title}" تایید شد`, '/conference');
      }

      res.json({ message: 'رزرو تایید شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/reject', async (req, res) => {
    try {
      if (req.user.role !== 'manager' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      const booking = await prisma.conferenceBooking.findUnique({ where: { id: Number(req.params.id) } });
      if (!booking) return res.status(404).json({ error: 'رزرو یافت نشد' });

      const { comment } = req.body;
      if (!comment) return res.status(400).json({ error: 'دلیل رد الزامی است' });

      await prisma.conferenceBooking.update({
        where: { id: Number(req.params.id) },
        data: { status: 'rejected', managerId: Number(req.user.id), managerComment: comment },
      });
      await addHistory(req.params.id, req.user.id, req.user.full_name, 'رد مدیر', comment);

      if (booking.userId) {
        await notify(booking.userId, 'رد رزرو سالن', `رزرو "${booking.title}" رد شد. دلیل: ${comment}`, '/conference');
      }

      res.json({ message: 'رزرو رد شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/cancel', async (req, res) => {
    try {
      const booking = await prisma.conferenceBooking.findUnique({ where: { id: Number(req.params.id) } });
      if (!booking) return res.status(404).json({ error: 'رزرو یافت نشد' });

      if (booking.userId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }

      await prisma.conferenceBooking.update({
        where: { id: Number(req.params.id) },
        data: { status: 'cancelled' },
      });
      await addHistory(req.params.id, req.user.id, req.user.full_name, 'لغو رزرو', '');

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const booking = await prisma.conferenceBooking.findUnique({ where: { id: Number(req.params.id) } });
      if (!booking) return res.status(404).json({ error: 'رزرو یافت نشد' });
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'فقط مدیر سیستم می‌تواند حذف کند' });
      }

      await prisma.conferenceBooking.delete({ where: { id: Number(req.params.id) } });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
