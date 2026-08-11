const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const moment = require('moment-jalaali');
const prisma = require('../database/prisma');
const { mapRow, flattenJoins } = require('../utils/dbAdapter');

let holidayCache = null;
let holidayCacheTime = 0;
const HOLIDAY_CACHE_TTL = 60000;

async function getHolidays() {
  const now = Date.now();
  if (!holidayCache || now - holidayCacheTime > HOLIDAY_CACHE_TTL) {
    const rows = await prisma.officialHoliday.findMany({ select: { holidayDate: true } });
    holidayCache = rows.map((r) => ({ holiday_date: r.holidayDate }));
    holidayCacheTime = now;
  }
  return holidayCache;
}

function invalidateHolidayCache() {
  holidayCache = null;
}

const pad = (n) => String(n).padStart(2, '0');
function getNowString() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

module.exports = function() {
  const router = express.Router();
  router.use(authMiddleware);

  const userSelect = { fullName: true, department: { select: { name: true } } };
  const userSelectWithBalance = { ...userSelect, leaveBalance: { select: { totalDays: true, usedHours: true } } };

  async function notify(userId, title, body, link) {
    await prisma.notification.create({ data: { userId: Number(userId), title, body, link } });
  }

  async function hasLeavePerm(user, moduleKey) {
    if (user.role === 'admin') return true;
    const userPerm = await prisma.permission.findFirst({ where: { userId: user.id, moduleKey } });
    if (userPerm) {
      return userPerm.isEnabled === true;
    }
    if (user.department_id) {
      const deptPerm = await prisma.permission.findFirst({ where: { departmentId: user.department_id, userId: null, moduleKey } });
      if (deptPerm) {
        return deptPerm.isEnabled === true;
      }
    }
    return false;
  }

  function calcDays(start, end) {
    const s = moment(start, 'jYYYY/jMM/jDD');
    const e = moment(end, 'jYYYY/jMM/jDD');
    return e.diff(s, 'days') + 1;
  }

  function mapLeave(l) {
    if (!l) return l;
    const days = Math.floor(l.hours_count / 8);
    const hrs = l.hours_count % 8;
    let formatted = '';
    if (days > 0) formatted += `${days} روز`;
    if (hrs > 0) formatted += `${formatted ? ' و ' : ''}${hrs} ساعت`;
    if (!formatted) formatted = '0 ساعت';
    return { ...l, days_count: formatted, raw_hours: l.hours_count, is_daily: l.hours_count >= 8 };
  }

  function isDailyLeave(hoursCount) {
    return hoursCount >= 8;
  }

  function respondLeaves(rows) {
    return mapRow(rows).map(mapLeave);
  }

  const ACTOR_FIELDS = {
    supervisor_name: 'supervisorId',
    admin_name: 'adminId',
    manager_name: 'managerId',
    security_name: 'securityId',
    editor_name: 'editedBy',
  };

  async function decorateLeaveRows(rows, opts = {}) {
    const { withBalance = false, actors = [] } = opts;
    const ids = new Set();
    if (actors.length) {
      for (const r of rows) {
        for (const field of actors) {
          if (r[field]) ids.add(r[field]);
        }
      }
    }
    const nameMap = new Map();
    if (ids.size) {
      const users = await prisma.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, fullName: true } });
      users.forEach((u) => nameMap.set(u.id, u.fullName));
    }
    return rows.map((r) => {
      const aliases = { user_name: 'user.fullName', user_dept: 'user.department.name' };
      if (withBalance) {
        aliases.total_days = 'user.leaveBalance.totalDays';
        aliases.used_hours = 'user.leaveBalance.usedHours';
      }
      const flat = flattenJoins(r, aliases);
      if (withBalance) {
        flat.total_days = flat.total_days ?? 0;
        flat.used_hours = flat.used_hours ?? 0;
      }
      for (const [alias, field] of Object.entries(ACTOR_FIELDS)) {
        if (actors.includes(field)) {
          flat[alias] = r[field] ? nameMap.get(r[field]) || null : null;
        }
      }
      return flat;
    });
  }

  router.get('/subordinates', async (req, res) => {
    try {
      if (!['admin', 'manager', 'supervisor'].includes(req.user.role)) {
        return res.json([]);
      }
      let users;
      if (req.user.role === 'supervisor') {
        users = await prisma.user.findMany({
          where: { departmentId: req.user.department_id, id: { not: req.user.id }, isActive: true, workType: { not: 'shift' } },
          select: { id: true, fullName: true, role: true },
          orderBy: { fullName: 'asc' },
        });
      } else {
        users = await prisma.user.findMany({
          where: { id: { not: req.user.id }, isActive: true, workType: { not: 'shift' } },
          select: { id: true, fullName: true, role: true },
          orderBy: { fullName: 'asc' },
        });
      }
      res.json(mapRow(users));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/my-requests', async (req, res) => {
    try {
      const leaves = await prisma.leaveRequest.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        include: { user: { select: userSelect } },
      });
      const rows = await decorateLeaveRows(leaves, { actors: ['supervisorId', 'adminId', 'managerId', 'securityId', 'editedBy'] });
      res.json(respondLeaves(rows));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/pending-supervisor', async (req, res) => {
    try {
      let leaves;
      if (req.user.role === 'admin') {
        leaves = await prisma.leaveRequest.findMany({
          where: { status: 'pending_supervisor' },
          orderBy: { createdAt: 'desc' },
          include: { user: { select: userSelectWithBalance } },
        });
      } else {
        leaves = await prisma.leaveRequest.findMany({
          where: { status: 'pending_supervisor', user: { is: { departmentId: req.user.department_id } } },
          orderBy: { createdAt: 'desc' },
          include: { user: { select: userSelectWithBalance } },
        });
      }
      const rows = await decorateLeaveRows(leaves, { withBalance: true });
      res.json(respondLeaves(rows));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/pending-manager', async (req, res) => {
    try {
      const leaves = await prisma.leaveRequest.findMany({
        where: { status: 'pending_manager' },
        orderBy: { createdAt: 'desc' },
        include: { user: { select: userSelectWithBalance } },
      });
      const rows = await decorateLeaveRows(leaves, { withBalance: true, actors: ['supervisorId', 'adminId'] });
      res.json(respondLeaves(rows));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/security', async (req, res) => {
    try {
      if (!(await hasLeavePerm(req.user, 'leave_security_view'))) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز - شما دسترسی رویت حراست را ندارید' });
      }
      const leaves = await prisma.leaveRequest.findMany({
        where: { status: 'approved' },
        orderBy: { createdAt: 'desc' },
        include: { user: { select: userSelect } },
      });
      const rows = await decorateLeaveRows(leaves, { actors: ['supervisorId', 'adminId', 'managerId'] });
      res.json(respondLeaves(rows));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/all', async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
      const skip = (page - 1) * limit;
      const search = req.query.search || '';

      const where = {};

      if (search) {
        where.OR = [
          { user: { is: { fullName: { contains: search, mode: 'insensitive' } } } },
          { leaveType: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (req.user.role === 'supervisor') {
        where.user = { is: { departmentId: req.user.department_id, role: { not: 'admin' } } };
      } else if (!(req.user.role === 'admin' || req.user.role === 'manager' || await hasLeavePerm(req.user, 'leave_edit_after_seen'))) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }

      const total = await prisma.leaveRequest.count({ where });

      const leaves = await prisma.leaveRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
        include: { user: { select: userSelect } },
      });

      const rows = await decorateLeaveRows(leaves, { actors: ['supervisorId', 'adminId', 'managerId', 'securityId', 'editedBy'] });
      res.json({ data: respondLeaves(rows), total, page, limit });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const { user_id, start_date, start_time, end_date, end_time, reason } = req.body;
      if (!start_date || !start_time || !end_date || !end_time) {
        return res.status(400).json({ error: 'تمام فیلدهای تاریخ و ساعت شروع و پایان الزامی هستند' });
      }

      let targetUserId = req.user.id;
      let targetUser = req.user;
      let initialStatus = 'pending_supervisor';
      let supervisorId = null;
      let supervisorDate = null;
      let managerId = null;
      let managerDate = null;

      const userTypeCheck = await prisma.user.findUnique({ where: { id: req.user.id }, select: { workType: true } });
      if (userTypeCheck && userTypeCheck.workType === 'shift' && (!user_id || parseInt(user_id) === req.user.id)) {
        return res.status(400).json({ error: 'کاربران شیفتی مجاز به ثبت درخواست مرخصی نیستند' });
      }

      if (user_id && parseInt(user_id) !== req.user.id) {
        if (!['admin', 'manager', 'supervisor'].includes(req.user.role)) {
          return res.status(403).json({ error: 'شما مجاز به ثبت مرخصی برای دیگران نیستید' });
        }

        const u = await prisma.user.findUnique({
          where: { id: parseInt(user_id) },
          select: { id: true, fullName: true, departmentId: true, isActive: true, role: true, workType: true },
        });
        if (!u || !u.isActive) {
          return res.status(404).json({ error: 'کاربر مورد نظر یافت نشد یا غیرفعال است' });
        }

        if (u.workType === 'shift') {
          return res.status(400).json({ error: 'کاربر مورد نظر شیفتی بوده و مجاز به ثبت درخواست مرخصی نمی‌باشد' });
        }

        if (req.user.role === 'supervisor') {
          if (u.departmentId !== req.user.department_id) {
            return res.status(403).json({ error: 'شما فقط می‌توانید برای پرسنل واحد خودتان مرخصی ثبت کنید' });
          }
          targetUserId = u.id;
          targetUser = { ...u, full_name: u.fullName, department_id: u.departmentId };
          // Supervisor registers: calculate hours first to determine daily/hourly
          const tempHours = await calculateLeaveHours(start_date, start_time, end_date, end_time);
          if (isDailyLeave(tempHours)) {
            initialStatus = 'pending_admin';
          } else {
            initialStatus = 'pending_manager';
          }
          supervisorId = req.user.id;
          supervisorDate = getNowString();
        } else {
          // admin or manager
          targetUserId = u.id;
          targetUser = { ...u, full_name: u.fullName, department_id: u.departmentId };
          initialStatus = 'approved';
          managerId = req.user.id;
          managerDate = getNowString();
        }
      } else {
        // Requesting for themselves
        if (req.user.role === 'supervisor') {
          initialStatus = 'pending_supervisor';
        } else if (req.user.role === 'admin' || req.user.role === 'manager') {
          initialStatus = 'approved';
          managerId = req.user.id;
          managerDate = getNowString();
        }
      }

      const today = moment().format('jYYYY/jMM/jDD');
      if (start_date < today && req.user.role !== 'admin') {
        return res.status(400).json({ error: 'امکان ثبت مرخصی برای تاریخ گذشته وجود ندارد' });
      }

      // Check for overlapping/duplicate leave requests
      const existingRequests = await prisma.leaveRequest.findMany({
        where: { userId: targetUserId, status: { not: 'rejected' } },
        select: { id: true, startDate: true, startHour: true, endDate: true, endHour: true, status: true },
      });

      const newStart = moment(`${start_date} ${start_time}`, 'jYYYY/jMM/jDD HH:mm');
      const newEnd = moment(`${end_date} ${end_time}`, 'jYYYY/jMM/jDD HH:mm');

      for (const reqOfUser of existingRequests) {
        const reqStart = moment(`${reqOfUser.startDate} ${reqOfUser.startHour}`, 'jYYYY/jMM/jDD HH:mm');
        const reqEnd = moment(`${reqOfUser.endDate} ${reqOfUser.endHour}`, 'jYYYY/jMM/jDD HH:mm');

        if (newStart.isBefore(reqEnd) && reqStart.isBefore(newEnd)) {
          const userMsg = targetUserId === req.user.id ? 'قبلی شما' : 'قبلی این کاربر';
          return res.status(400).json({ error: `این درخواست با یکی از مرخصی‌های ${userMsg} همپوشانی دارد (${reqOfUser.startDate} تا ${reqOfUser.endDate})` });
        }
      }

      const leaveHours = await calculateLeaveHours(start_date, start_time, end_date, end_time);
      if (leaveHours <= 0) {
        return res.status(400).json({ error: 'زمان انتخاب شده در ساعات کاری معتبر یا روزهای غیر تعطیل قرار ندارد' });
      }

      const balance = await prisma.leaveBalance.findUnique({ where: { userId: targetUserId } });
      if (!balance) {
        await prisma.leaveBalance.create({ data: { userId: targetUserId, totalDays: 0, usedHours: 0 } });
      }

      const result = await prisma.leaveRequest.create({
        data: {
          userId: targetUserId,
          leaveType: 'مرخصی',
          startDate: start_date,
          endDate: end_date,
          hoursCount: leaveHours,
          reason: reason || '',
          status: initialStatus,
          startHour: start_time,
          endHour: end_time,
          supervisorId,
          supervisorDate,
          managerId,
          managerDate,
        },
      });

      if (initialStatus === 'approved') {
        await prisma.leaveBalance.update({ where: { userId: targetUserId }, data: { usedHours: { increment: leaveHours } } });
      }

      // Notifications
      if (targetUserId !== req.user.id) {
        // Registered by supervisor/manager/admin on behalf of user
        if (req.user.role === 'supervisor') {
          await notify(targetUserId, 'ثبت مرخصی توسط سرپرست', `مرخصی برای شما توسط سرپرست (${req.user.full_name}) ثبت گردید و برای تایید مدیر ارسال شد`, '/leave');

          // Notify managers
          const managers = await prisma.user.findMany({ where: { role: 'manager', isActive: true }, select: { id: true } });
          for (const m of managers) {
            await notify(m.id, 'درخواست مرخصی جدید', `درخواست مرخصی ثبت شده توسط سرپرست برای ${targetUser.full_name} نیاز به تایید مدیر دارد`, '/leave');
          }
        } else {
          // Registered by manager/admin
          await notify(targetUserId, 'ثبت مرخصی توسط مدیریت', `مرخصی برای شما توسط مدیریت (${req.user.full_name}) ثبت و تایید گردید`, '/leave');
        }
      } else {
        // Normal flow (self submission)
        const supervisor = await prisma.user.findFirst({
          where: { role: 'supervisor', departmentId: req.user.department_id, isActive: true },
          select: { id: true },
        });
        if (supervisor) {
          await notify(supervisor.id, 'درخواست مرخصی جدید', `${req.user.full_name} درخواست مرخصی ثبت کرده است`, '/leave');
        }
      }

      res.json({ id: result.id, message: 'درخواست مرخصی ثبت شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id/edit', async (req, res) => {
    try {
      const leave = await prisma.leaveRequest.findFirst({ where: { id: Number(req.params.id), userId: req.user.id, status: 'pending_supervisor' } });
      if (!leave) return res.status(404).json({ error: 'درخواست یافت نشد یا قابل ویرایش نیست' });

      const { start_date, start_time, end_date, end_time, reason } = req.body;
      if (!start_date || !start_time || !end_date || !end_time) {
        return res.status(400).json({ error: 'تمام فیلدهای تاریخ و ساعت شروع و پایان الزامی هستند' });
      }

      const today = moment().format('jYYYY/jMM/jDD');
      if (start_date < today && req.user.role !== 'admin') {
        return res.status(400).json({ error: 'امکان ثبت مرخصی برای تاریخ گذشته وجود ندارد' });
      }

      // Check for overlapping/duplicate leave requests (excluding current request)
      const existingRequests = await prisma.leaveRequest.findMany({
        where: { userId: req.user.id, status: { not: 'rejected' }, id: { not: Number(req.params.id) } },
        select: { id: true, startDate: true, startHour: true, endDate: true, endHour: true },
      });

      const newStart = moment(`${start_date} ${start_time}`, 'jYYYY/jMM/jDD HH:mm');
      const newEnd = moment(`${end_date} ${end_time}`, 'jYYYY/jMM/jDD HH:mm');

      for (const reqOfUser of existingRequests) {
        const reqStart = moment(`${reqOfUser.startDate} ${reqOfUser.startHour}`, 'jYYYY/jMM/jDD HH:mm');
        const reqEnd = moment(`${reqOfUser.endDate} ${reqOfUser.endHour}`, 'jYYYY/jMM/jDD HH:mm');

        if (newStart.isBefore(reqEnd) && reqStart.isBefore(newEnd)) {
          return res.status(400).json({ error: `این تغییر با یکی از مرخصی‌های قبلی شما همپوشانی دارد (${reqOfUser.startDate} تا ${reqOfUser.endDate})` });
        }
      }

      const leaveHours = await calculateLeaveHours(start_date, start_time, end_date, end_time);
      if (leaveHours <= 0) {
        return res.status(400).json({ error: 'زمان انتخاب شده در ساعات کاری معتبر یا روزهای غیر تعطیل قرار ندارد' });
      }

      await prisma.leaveRequest.update({
        where: { id: Number(req.params.id) },
        data: { startDate: start_date, endDate: end_date, hoursCount: leaveHours, reason: reason || '', startHour: start_time, endHour: end_time },
      });

      res.json({ message: 'درخواست با موفقیت ویرایش شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id/delete', async (req, res) => {
    try {
      const leave = await prisma.leaveRequest.findFirst({ where: { id: Number(req.params.id), userId: req.user.id, status: 'pending_supervisor' } });
      if (!leave) return res.status(404).json({ error: 'درخواست یافت نشد یا قابل حذف نیست' });

      await prisma.leaveRequest.deleteMany({ where: { id: Number(req.params.id) } });
      res.json({ message: 'درخواست با موفقیت حذف شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id/admin-delete', async (req, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'فقط مدیر سیستم می‌تواند مرخصی تایید شده را حذف کند' });
      }
      const leave = await prisma.leaveRequest.findUnique({ where: { id: Number(req.params.id) } });
      if (!leave) return res.status(404).json({ error: 'درخواست یافت نشد' });

      if (['approved', 'seen_security'].includes(leave.status) && leave.hoursCount > 0) {
        const balanceBefore = await prisma.leaveBalance.findUnique({ where: { userId: leave.userId } });
        if (balanceBefore) {
          const newUsed = Math.max(0, balanceBefore.usedHours - leave.hoursCount);
          await prisma.leaveBalance.update({ where: { userId: leave.userId }, data: { usedHours: newUsed } });
        }
      }

      await prisma.leaveRequest.deleteMany({ where: { id: Number(req.params.id) } });

      await notify(leave.userId, 'حذف درخواست مرخصی', `درخواست مرخصی شما (${leave.startDate} تا ${leave.endDate}) توسط مدیر سیستم حذف شد`, '/leave');

      res.json({ message: 'درخواست مرخصی حذف شد و مانده مرخصی بازگردانده شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id/approve-supervisor', async (req, res) => {
    try {
      const { comment } = req.body;
      const leave = await prisma.leaveRequest.findFirst({ where: { id: Number(req.params.id), status: 'pending_supervisor' } });
      if (!leave) return res.status(404).json({ error: 'درخواست یافت نشد' });

      if (req.user.role !== 'admin') {
        const leaveUser = await prisma.user.findUnique({ where: { id: leave.userId }, select: { departmentId: true } });
        if (leaveUser && leaveUser.departmentId !== req.user.department_id) {
          return res.status(403).json({ error: 'دسترسی غیرمجاز' });
        }
      }

      const nextStatus = isDailyLeave(leave.hoursCount) ? 'pending_admin' : 'pending_manager';

      await prisma.leaveRequest.update({
        where: { id: Number(req.params.id) },
        data: { status: nextStatus, supervisorId: req.user.id, supervisorComment: comment || '', supervisorDate: getNowString() },
      });

      if (nextStatus === 'pending_admin') {
        await notify(leave.userId, 'تایید سرپرست', `درخواست مرخصی شما توسط سرپرست تایید شد و برای اداری ارسال شد`, '/leave');
        const adminUsers = await prisma.user.findMany({ where: { OR: [{ role: 'admin' }, { role: 'manager' }], isActive: true }, select: { id: true } });
        for (const a of adminUsers) {
          await notify(a.id, 'درخواست مرخصی جدید', `درخواست مرخصی روزانه ${leave.userId} نیاز به بررسی اداری دارد`, '/leave');
        }
      } else {
        await notify(leave.userId, 'تایید سرپرست', `درخواست مرخصی شما توسط سرپرست تایید شد و برای مدیر ارسال شد`, '/leave');
        const managers = await prisma.user.findMany({ where: { role: 'manager', isActive: true }, select: { id: true } });
        for (const m of managers) {
          await notify(m.id, 'درخواست مرخصی جدید', `درخواست مرخصی ساعتی ${leave.userId} نیاز به تایید مدیر دارد`, '/leave');
        }
      }

      res.json({ message: 'درخواست توسط سرپرست تایید شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id/reject-supervisor', async (req, res) => {
    try {
      const { comment } = req.body;
      const leave = await prisma.leaveRequest.findFirst({ where: { id: Number(req.params.id), status: 'pending_supervisor' } });
      if (!leave) return res.status(404).json({ error: 'درخواست یافت نشد' });

      await prisma.leaveRequest.update({
        where: { id: Number(req.params.id) },
        data: { status: 'rejected', supervisorId: req.user.id, supervisorComment: comment || 'رد شده توسط سرپرست', supervisorDate: getNowString() },
      });

      await notify(leave.userId, 'رد درخواست مرخصی', `درخواست مرخصی شما توسط سرپرست رد شد`, '/leave');
      res.json({ message: 'درخواست رد شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------- اداری: لیست در انتظار بررسی ----------
  router.get('/pending-admin', async (req, res) => {
    try {
      if (req.user.role !== 'admin' && req.user.role !== 'manager' && !(await hasLeavePerm(req.user, 'leave_admin_approve'))) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      const leaves = await prisma.leaveRequest.findMany({
        where: { status: 'pending_admin' },
        orderBy: { createdAt: 'desc' },
        include: { user: { select: userSelectWithBalance } },
      });
      const rows = await decorateLeaveRows(leaves, { withBalance: true, actors: ['supervisorId'] });
      res.json(respondLeaves(rows));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------- اداری: تایید مرخصی روزانه ----------
  router.put('/:id/approve-admin', async (req, res) => {
    try {
      if (req.user.role !== 'admin' && req.user.role !== 'manager' && !(await hasLeavePerm(req.user, 'leave_admin_approve'))) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      const { comment, remaining_leave_days } = req.body;
      const leave = await prisma.leaveRequest.findFirst({ where: { id: Number(req.params.id), status: 'pending_admin' } });
      if (!leave) return res.status(404).json({ error: 'درخواست یافت نشد' });

      await prisma.leaveRequest.update({
        where: { id: Number(req.params.id) },
        data: { status: 'pending_manager', adminId: req.user.id, adminComment: comment || '', adminDate: getNowString(), remainingLeaveDays: remaining_leave_days ? Number(remaining_leave_days) : null },
      });

      await notify(leave.userId, 'تایید اداری', `مرخصی روزانه شما توسط اداری تایید شد و برای مدیر ارسال شد`, '/leave');

      const managers = await prisma.user.findMany({ where: { role: 'manager', isActive: true }, select: { id: true } });
      for (const m of managers) {
        await notify(m.id, 'درخواست مرخصی جدید', `مرخصی روزانه ${leave.userId} توسط اداری تایید شده و نیاز به تایید مدیر دارد`, '/leave');
      }

      res.json({ message: 'مرخصی توسط اداری تایید شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------- اداری: رد مرخصی روزانه ----------
  router.put('/:id/reject-admin', async (req, res) => {
    try {
      if (req.user.role !== 'admin' && req.user.role !== 'manager' && !(await hasLeavePerm(req.user, 'leave_admin_approve'))) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      const { comment } = req.body;
      if (!comment) return res.status(400).json({ error: 'دلیل رد الزامی است' });
      const leave = await prisma.leaveRequest.findFirst({ where: { id: Number(req.params.id), status: 'pending_admin' } });
      if (!leave) return res.status(404).json({ error: 'درخواست یافت نشد' });

      await prisma.leaveRequest.update({
        where: { id: Number(req.params.id) },
        data: { status: 'rejected', adminId: req.user.id, adminComment: comment, adminDate: getNowString() },
      });

      await notify(leave.userId, 'رد درخواست مرخصی', `مرخصی روزانه شما توسط اداری رد شد`, '/leave');
      res.json({ message: 'درخواست رد شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id/approve-manager', async (req, res) => {
    try {
      const { comment } = req.body;
      const leave = await prisma.leaveRequest.findFirst({ where: { id: Number(req.params.id), status: 'pending_manager' } });
      if (!leave) return res.status(404).json({ error: 'درخواست یافت نشد' });

      await prisma.leaveRequest.update({
        where: { id: Number(req.params.id) },
        data: { status: 'approved', managerId: req.user.id, managerComment: comment || '', managerDate: getNowString() },
      });

      await prisma.leaveBalance.upsert({
        where: { userId: leave.userId },
        create: { userId: leave.userId, totalDays: 0, usedHours: leave.hoursCount },
        update: { usedHours: { increment: leave.hoursCount } },
      });

      await notify(leave.userId, 'تایید نهایی مرخصی', `مرخصی شما توسط مدیر تایید شد`, '/leave');

      const securityUsers = await prisma.user.findMany({
        where: { department: { is: { name: { contains: 'حراست' } } }, isActive: true },
        select: { id: true },
      });
      for (const s of securityUsers) {
        await notify(s.id, 'مرخصی تایید شده', `مرخصی کاربر ${leave.userId} تایید شده - لطفاً مشاهده کنید`, '/leave');
      }

      res.json({ message: 'مرخصی توسط مدیر تایید شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id/reject-manager', async (req, res) => {
    try {
      const { comment } = req.body;
      const leave = await prisma.leaveRequest.findFirst({ where: { id: Number(req.params.id), status: 'pending_manager' } });
      if (!leave) return res.status(404).json({ error: 'درخواست یافت نشد' });

      await prisma.leaveRequest.update({
        where: { id: Number(req.params.id) },
        data: { status: 'rejected', managerId: req.user.id, managerComment: comment || 'رد شده توسط مدیر', managerDate: getNowString() },
      });

      await notify(leave.userId, 'رد درخواست مرخصی', `درخواست مرخصی شما توسط مدیر رد شد`, '/leave');
      res.json({ message: 'درخواست رد شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id/seen-security', async (req, res) => {
    try {
      if (!(await hasLeavePerm(req.user, 'leave_security_view'))) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز - شما دسترسی رویت حراست را ندارید' });
      }
      const leave = await prisma.leaveRequest.findFirst({ where: { id: Number(req.params.id), status: 'approved' } });
      if (!leave) return res.status(404).json({ error: 'درخواست یافت نشد' });

      await prisma.leaveRequest.update({
        where: { id: Number(req.params.id) },
        data: { status: 'seen_security', securityId: req.user.id, securityDate: getNowString() },
      });

      res.json({ message: 'مرخصی رویت شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Holidays endpoints
  router.get('/holidays', async (req, res) => {
    try {
      const holidays = await prisma.officialHoliday.findMany({ orderBy: { holidayDate: 'asc' } });
      res.json(mapRow(holidays));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/holidays', async (req, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      const { holiday_date, title } = req.body;
      if (!holiday_date) {
        return res.status(400).json({ error: 'تاریخ تعطیل الزامی است' });
      }
      await prisma.officialHoliday.createMany({ data: [{ holidayDate: holiday_date, title: title || '' }], skipDuplicates: true });
      invalidateHolidayCache();
      res.json({ message: 'تعطیلی با موفقیت ثبت شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/holidays/import', async (req, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      const { holidays } = req.body;
      if (!Array.isArray(holidays)) {
        return res.status(400).json({ error: 'فرمت داده‌ها نامعتبر است' });
      }

      const data = holidays.filter((h) => h.holiday_date).map((h) => ({ holidayDate: h.holiday_date, title: h.title || '' }));
      if (data.length) {
        await prisma.officialHoliday.createMany({ data, skipDuplicates: true });
      }
      invalidateHolidayCache();
      res.json({ message: 'تعطیلات رسمی با موفقیت وارد شدند' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/holidays/:id', async (req, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      await prisma.officialHoliday.deleteMany({ where: { id: Number(req.params.id) } });
      invalidateHolidayCache();
      res.json({ message: 'تعطیلی حذف شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Helper function to calculate leave hours
  async function calculateLeaveHours(startDateStr, startTimeStr, endDateStr, endTimeStr) {
    const holidays = await getHolidays();
    const holidaysSet = new Set(holidays.map(h => h.holiday_date));

    let current = moment(startDateStr, 'jYYYY/jMM/jDD');
    const end = moment(endDateStr, 'jYYYY/jMM/jDD');

    let totalHours = 0;

    const timeToMinutes = (t) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    const minutesToHours = (m) => m / 60;

    while (current.isSameOrBefore(end, 'day')) {
      const dateStr = current.format('jYYYY/jMM/jDD');
      const dayOfWeek = current.day(); // 0 is Sunday, ..., 5 is Friday, 6 is Saturday

      const isFriday = (dayOfWeek === 5);
      const isOfficialHoliday = holidaysSet.has(dateStr);

      if (!isFriday && !isOfficialHoliday) {
        let dayStart = "08:00";
        let dayEnd = (dayOfWeek === 4) ? "12:00" : "17:00";

        let leaveStart = (dateStr === startDateStr) ? startTimeStr : dayStart;
        let leaveEnd = (dateStr === endDateStr) ? endTimeStr : dayEnd;

        const leaveStartMin = timeToMinutes(leaveStart);
        const leaveEndMin = timeToMinutes(leaveEnd);

        if (dayOfWeek === 4) {
          // Thursday: 08:00 to 12:00
          const startMin = Math.max(leaveStartMin, timeToMinutes("08:00"));
          const endMin = Math.min(leaveEndMin, timeToMinutes("12:00"));
          if (startMin < endMin) {
            totalHours += minutesToHours(endMin - startMin);
          }
        } else {
          // Saturday-Wednesday: 08:00 to 12:00, and 13:00 to 17:00
          // Morning overlap
          const morningStart = Math.max(leaveStartMin, timeToMinutes("08:00"));
          const morningEnd = Math.min(leaveEndMin, timeToMinutes("12:00"));
          if (morningStart < morningEnd) {
            totalHours += minutesToHours(morningEnd - morningStart);
          }
          // Afternoon overlap
          const afternoonStart = Math.max(leaveStartMin, timeToMinutes("13:00"));
          const afternoonEnd = Math.min(leaveEndMin, timeToMinutes("17:00"));
          if (afternoonStart < afternoonEnd) {
            totalHours += minutesToHours(afternoonEnd - afternoonStart);
          }
        }
      }
      current.add(1, 'day');
    }

    return totalHours;
  }

  // Calculate endpoint
  router.get('/calculate', async (req, res) => {
    try {
      const { start_date, start_time, end_date, end_time } = req.query;
      if (!start_date || !start_time || !end_date || !end_time) {
        return res.status(400).json({ error: 'تمام فیلدهای تاریخ و ساعت شروع و پایان الزامی هستند' });
      }
      const totalHours = await calculateLeaveHours(start_date, start_time, end_date, end_time);
      const days = Math.floor(totalHours / 8);
      const remainingHours = totalHours % 8;
      res.json({ total_hours: totalHours, days, remaining_hours: remainingHours });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/balance', async (req, res) => {
    try {
      let balance = await prisma.leaveBalance.findUnique({ where: { userId: req.user.id } });
      if (!balance) {
        await prisma.leaveBalance.create({ data: { userId: req.user.id, totalDays: 0, usedHours: 0 } });
        balance = { totalDays: 0, usedHours: 0 };
      }

      const agg = await prisma.leaveRequest.aggregate({
        where: { userId: req.user.id, status: { in: ['approved', 'seen_security'] } },
        _sum: { hoursCount: true },
      });
      const usedHours = agg._sum.hoursCount ?? 0;
      const totalHours = balance.totalDays * 8;
      const remainingHours = totalHours - usedHours;
      const isNegative = remainingHours < 0;
      const absRemaining = Math.abs(remainingHours);

      res.json({
        total_days: balance.totalDays,
        used_hours: usedHours,
        remaining_days: isNegative ? -Math.floor(absRemaining / 8) : Math.floor(absRemaining / 8),
        remaining_hours_only: absRemaining % 8,
        is_negative: isNegative ? 1 : 0,
        used_days_display: Math.floor(usedHours / 8),
        used_hours_display: usedHours % 8
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/balance-all', async (req, res) => {
    try {
      let balances;
      const includeUser = { include: { user: { select: { fullName: true, departmentId: true, role: true, isActive: true, department: { select: { name: true } } } } } };
      if (req.user.role === 'admin' || req.user.role === 'manager' || await hasLeavePerm(req.user, 'leave_quota_manage')) {
        balances = await prisma.leaveBalance.findMany({
          ...includeUser,
          where: { user: { is: { isActive: true } } },
          orderBy: [{ user: { department: { name: 'asc' } } }, { user: { fullName: 'asc' } }],
        });
      } else if (req.user.role === 'supervisor') {
        balances = await prisma.leaveBalance.findMany({
          ...includeUser,
          where: { user: { is: { departmentId: req.user.department_id, role: { not: 'admin' }, isActive: true } } },
          orderBy: { user: { fullName: 'asc' } },
        });
      } else {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }

      const userIds = balances.map((b) => b.userId);
      const usedMap = new Map();
      if (userIds.length) {
        const groups = await prisma.leaveRequest.groupBy({
          by: ['userId'],
          where: { userId: { in: userIds }, status: { in: ['approved', 'seen_security'] } },
          _sum: { hoursCount: true },
        });
        groups.forEach((g) => usedMap.set(g.userId, g._sum.hoursCount ?? 0));
      }

      res.json(balances.map((b) => {
        const usedHours = usedMap.get(b.userId) ?? 0;
        const totalHours = b.totalDays * 8;
        const remainingHours = totalHours - usedHours;
        const isNegative = remainingHours < 0;
        const absRemaining = Math.abs(remainingHours);
        return {
          user_id: b.userId,
          total_days: b.totalDays,
          full_name: b.user ? b.user.fullName : null,
          department_id: b.user ? b.user.departmentId : null,
          department_name: b.user && b.user.department ? b.user.department.name : null,
          used_hours: usedHours,
          remaining_days: isNegative ? -Math.floor(absRemaining / 8) : Math.floor(absRemaining / 8),
          remaining_hours_only: absRemaining % 8,
          is_negative: isNegative ? 1 : 0,
          used_days_display: Math.floor(usedHours / 8),
          used_hours_display: usedHours % 8
        };
      }));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const row = await prisma.leaveRequest.findUnique({
        where: { id: Number(req.params.id) },
        include: { user: { select: userSelect } },
      });
      if (!row) return res.status(404).json({ error: 'یافت نشد' });
      res.json(mapRow(flattenJoins(row, { user_name: 'user.fullName', user_dept: 'user.department.name' })));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/balance/:userId', async (req, res) => {
    try {
      if (req.user.role !== 'admin' && !(await hasLeavePerm(req.user, 'leave_quota_manage'))) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز - شما دسترسی مدیریت سهمیه مرخصی پرسنل را ندارید' });
      }
      const { total_days } = req.body;
      const targetUserId = Number(req.params.userId);
      const newTotal = Number(total_days);

      const existing = await prisma.leaveBalance.findUnique({ where: { userId: targetUserId } });
      const oldTotal = existing ? existing.totalDays : 0;

      if (existing) {
        await prisma.leaveBalance.update({ where: { userId: targetUserId }, data: { totalDays: newTotal } });
      } else {
        await prisma.leaveBalance.create({ data: { userId: targetUserId, totalDays: newTotal, usedHours: 0 } });
      }

      // Log the change
      await prisma.leaveChangeLog.create({
        data: {
          actionBy: req.user.id,
          actionType: 'quota_edit',
          targetId: targetUserId,
          oldValue: String(oldTotal),
          newValue: String(newTotal),
          details: `ویرایش سهمیه اولیه پرسنل به ${newTotal} روز`,
        },
      });

      res.json({ message: 'سهمیه اولیه بروزرسانی شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id/edit-after-seen', async (req, res) => {
    try {
      if (req.user.role !== 'admin' && !(await hasLeavePerm(req.user, 'leave_edit_after_seen'))) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز - شما دسترسی ویرایش مرخصی پس از رویت را ندارید' });
      }
      const { end_date, end_time, hours_count, reason } = req.body;
      const leaveId = Number(req.params.id);

      const leave = await prisma.leaveRequest.findUnique({ where: { id: leaveId } });
      if (!leave) return res.status(404).json({ error: 'درخواست یافت نشد' });

      if (leave.status !== 'seen_security') {
        return res.status(400).json({ error: 'ویرایش مرخصی فقط پس از رویت حراست امکان‌پذیر است' });
      }

      if (leave.editedBy) {
        return res.status(400).json({ error: 'این مرخصی قبلاً اصلاح شده است و اصلاح مجدد آن امکان‌پذیر نیست' });
      }

      const oldVal = JSON.stringify({
        end_date: leave.endDate,
        end_time: leave.endHour,
        hours_count: leave.hoursCount,
        reason: leave.reason
      });

      const newVal = JSON.stringify({
        end_date,
        end_time,
        hours_count,
        reason: reason || leave.reason
      });

      await prisma.leaveRequest.update({
        where: { id: leaveId },
        data: { endDate: end_date, endHour: end_time, hoursCount: Number(hours_count), reason: reason || leave.reason || '', editedBy: req.user.id, editedAt: getNowString(), editReason: reason || '' },
      });

      // Log the change
      await prisma.leaveChangeLog.create({
        data: {
          actionBy: req.user.id,
          actionType: 'leave_edit',
          targetId: leaveId,
          oldValue: oldVal,
          newValue: newVal,
          details: `ویرایش مرخصی کاربر (کاهش مدت یا اصلاح پس از رویت). کارکرد جدید: ${hours_count} ساعت.`,
        },
      });

      res.json({ message: 'درخواست مرخصی با موفقیت ویرایش و لاگ شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
