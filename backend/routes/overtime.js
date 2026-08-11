const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const moment = require('moment-jalaali');
const prisma = require('../database/prisma');
const { mapRow, flattenJoins } = require('../utils/dbAdapter');
const { overtime } = require('../middleware/validate');

const { getHolidays } = require('../utils/holidayCache');

const pad = (n) => String(n).padStart(2, '0');
function getNowString() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

module.exports = function() {
  const router = express.Router();
  router.use(authMiddleware);

  const userSelect = { fullName: true, department: { select: { name: true } } };

  async function notify(userId, title, body, link) {
    await prisma.notification.create({ data: { userId: Number(userId), title, body, link } });
  }

  async function hasOvertimePerm(user, moduleKey) {
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

  function mapOvertime(o) {
    if (!o) return o;
    const days = Math.floor(o.hours_count / 8);
    const hrs = o.hours_count % 8;
    let formatted = '';
    if (days > 0) formatted += `${days} روز`;
    if (hrs > 0) formatted += `${formatted ? ' و ' : ''}${hrs} ساعت`;
    if (!formatted) formatted = '0 ساعت';
    return { ...o, days_count: formatted, raw_hours: o.hours_count };
  }

  const ACTOR_FIELDS = {
    supervisor_name: 'supervisorId',
    manager_name: 'managerId',
    security_name: 'securityId',
    editor_name: 'editedBy',
  };

  async function decorateOvertimeRows(rows, opts = {}) {
    const { actors = [], supervisorDept = false } = opts;
    const ids = new Set();
    if (actors.length || supervisorDept) {
      for (const r of rows) {
        for (const field of actors) {
          if (r[field]) ids.add(r[field]);
        }
        if (supervisorDept && r.supervisorId) ids.add(r.supervisorId);
      }
    }
    const nameMap = new Map();
    const deptMap = new Map();
    if (ids.size) {
      const users = await prisma.user.findMany({
        where: { id: { in: [...ids] } },
        select: { id: true, fullName: true, department: { select: { name: true } } },
      });
      users.forEach((u) => {
        nameMap.set(u.id, u.fullName);
        deptMap.set(u.id, u.department ? u.department.name : null);
      });
    }
    return rows.map((r) => {
      const flat = flattenJoins(r, { user_name: 'user.fullName', user_dept: 'user.department.name' });
      for (const [alias, field] of Object.entries(ACTOR_FIELDS)) {
        if (actors.includes(field)) {
          flat[alias] = r[field] ? nameMap.get(r[field]) || null : null;
        }
      }
      if (supervisorDept) {
        flat.supervisor_dept = r.supervisorId ? deptMap.get(r.supervisorId) || null : null;
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
      const requests = await prisma.overtimeRequest.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        include: { user: { select: userSelect } },
      });
      const rows = await decorateOvertimeRows(requests, { actors: ['supervisorId', 'managerId', 'securityId', 'editedBy'] });
      res.json(mapRow(rows).map(mapOvertime));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/pending-supervisor', async (req, res) => {
    try {
      let requests;
      if (req.user.role === 'admin') {
        requests = await prisma.overtimeRequest.findMany({
          where: { status: 'pending_supervisor' },
          orderBy: { createdAt: 'desc' },
          include: { user: { select: userSelect } },
        });
      } else {
        requests = await prisma.overtimeRequest.findMany({
          where: { status: 'pending_supervisor', user: { is: { departmentId: req.user.department_id } } },
          orderBy: { createdAt: 'desc' },
          include: { user: { select: userSelect } },
        });
      }
      const rows = await decorateOvertimeRows(requests);
      res.json(mapRow(rows).map(mapOvertime));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/pending-manager', async (req, res) => {
    try {
      const requests = await prisma.overtimeRequest.findMany({
        where: { status: 'pending_manager' },
        orderBy: { createdAt: 'desc' },
        include: { user: { select: userSelect } },
      });
      const rows = await decorateOvertimeRows(requests, { actors: ['supervisorId'], supervisorDept: true });
      res.json(mapRow(rows).map(mapOvertime));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/security', async (req, res) => {
    try {
      if (!(await hasOvertimePerm(req.user, 'overtime_security_view'))) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز - شما دسترسی رویت حراست اضافه کار را ندارید' });
      }
      const requests = await prisma.overtimeRequest.findMany({
        where: { status: 'approved' },
        orderBy: { createdAt: 'desc' },
        include: { user: { select: userSelect } },
      });
      const rows = await decorateOvertimeRows(requests, { actors: ['supervisorId', 'managerId'] });
      res.json(mapRow(rows).map(mapOvertime));
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
        ];
      }

      if (req.user.role === 'supervisor') {
        where.user = { is: { departmentId: req.user.department_id, role: { not: 'admin' } } };
      } else if (!(req.user.role === 'admin' || req.user.role === 'manager' || await hasOvertimePerm(req.user, 'overtime_edit_after_seen'))) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }

      const total = await prisma.overtimeRequest.count({ where });

      const requests = await prisma.overtimeRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
        include: { user: { select: userSelect } },
      });

      const rows = await decorateOvertimeRows(requests, { actors: ['supervisorId', 'managerId', 'securityId', 'editedBy'] });
      res.json({ data: mapRow(rows).map(mapOvertime), total, page, limit });
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
        return res.status(400).json({ error: 'کاربران شیفتی مجاز به ثبت درخواست اضافه کار نیستند' });
      }

      if (user_id && parseInt(user_id) !== req.user.id) {
        if (!['admin', 'manager', 'supervisor'].includes(req.user.role)) {
          return res.status(403).json({ error: 'شما مجاز به ثبت اضافه کار برای دیگران نیستید' });
        }

        const u = await prisma.user.findUnique({
          where: { id: parseInt(user_id) },
          select: { id: true, fullName: true, departmentId: true, isActive: true, role: true, workType: true },
        });
        if (!u || !u.isActive) {
          return res.status(404).json({ error: 'کاربر مورد نظر یافت نشد یا غیرفعال است' });
        }

        if (u.workType === 'shift') {
          return res.status(400).json({ error: 'کاربر مورد نظر شیفتی بوده و مجاز به ثبت درخواست اضافه کار نمی‌باشد' });
        }

        if (req.user.role === 'supervisor') {
          if (u.departmentId !== req.user.department_id) {
            return res.status(403).json({ error: 'شما فقط می‌توانید برای پرسنل واحد خودتان اضافه کار ثبت کنید' });
          }
          targetUserId = u.id;
          targetUser = { ...u, full_name: u.fullName, department_id: u.departmentId };
          initialStatus = 'pending_manager'; // Direct to manager if supervisor registers for subordinate
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
          initialStatus = 'pending_manager';
        } else if (req.user.role === 'admin' || req.user.role === 'manager') {
          initialStatus = 'approved';
          managerId = req.user.id;
          managerDate = getNowString();
        }
      }

      const today = moment().format('jYYYY/jMM/jDD');
      if (start_date < today && req.user.role !== 'admin') {
        return res.status(400).json({ error: 'امکان ثبت اضافه کار برای تاریخ گذشته وجود ندارد' });
      }

      // Check for overlapping/duplicate requests
      const existingRequests = await prisma.overtimeRequest.findMany({
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
          return res.status(400).json({ error: `این درخواست با یکی از درخواست‌های اضافه کار ${userMsg} همپوشانی دارد (${reqOfUser.startDate} تا ${reqOfUser.endDate})` });
        }
      }

      const overtimeHours = await calculateOvertimeHours(start_date, start_time, end_date, end_time);
      if (overtimeHours <= 0) {
        return res.status(400).json({ error: 'زمان انتخاب شده در ساعات اضافه کار معتبر یا روزهای تعطیل قرار ندارد' });
      }

      const result = await prisma.overtimeRequest.create({
        data: {
          userId: targetUserId,
          startDate: start_date,
          endDate: end_date,
          hoursCount: overtimeHours,
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

      // Notifications
      if (targetUserId !== req.user.id) {
        if (req.user.role === 'supervisor') {
          await notify(targetUserId, 'ثبت اضافه کار توسط سرپرست', `اضافه کار برای شما توسط سرپرست (${req.user.full_name}) ثبت گردید و برای تایید مدیر ارسال شد`, '/overtime');

          const managers = await prisma.user.findMany({ where: { role: 'manager', isActive: true }, select: { id: true } });
          for (const m of managers) {
            await notify(m.id, 'درخواست اضافه کار جدید', `درخواست اضافه کار ثبت شده توسط سرپرست برای ${targetUser.full_name} نیاز به تایید مدیر دارد`, '/overtime');
          }
        } else {
          await notify(targetUserId, 'ثبت اضافه کار توسط مدیریت', `اضافه کار برای شما توسط مدیریت (${req.user.full_name}) ثبت و تایید گردید`, '/overtime');
        }
      } else {
        const supervisor = await prisma.user.findFirst({
          where: { role: 'supervisor', departmentId: req.user.department_id, isActive: true },
          select: { id: true },
        });
        if (supervisor) {
          await notify(supervisor.id, 'درخواست اضافه کار جدید', `${req.user.full_name} درخواست اضافه کار ثبت کرده است`, '/overtime');
        }
      }

      res.json({ id: result.id, message: 'درخواست اضافه کار ثبت شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id/edit', async (req, res) => {
    try {
      const request = await prisma.overtimeRequest.findFirst({ where: { id: Number(req.params.id), userId: req.user.id, status: 'pending_supervisor' } });
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد یا قابل ویرایش نیست' });

      const { start_date, start_time, end_date, end_time, reason } = req.body;
      if (!start_date || !start_time || !end_date || !end_time) {
        return res.status(400).json({ error: 'تمام فیلدهای تاریخ و ساعت شروع و پایان الزامی هستند' });
      }

      const today = moment().format('jYYYY/jMM/jDD');
      if (start_date < today && req.user.role !== 'admin') {
        return res.status(400).json({ error: 'امکان ثبت اضافه کار برای تاریخ گذشته وجود ندارد' });
      }

      const existingRequests = await prisma.overtimeRequest.findMany({
        where: { userId: req.user.id, status: { not: 'rejected' }, id: { not: Number(req.params.id) } },
        select: { id: true, startDate: true, startHour: true, endDate: true, endHour: true },
      });

      const newStart = moment(`${start_date} ${start_time}`, 'jYYYY/jMM/jDD HH:mm');
      const newEnd = moment(`${end_date} ${end_time}`, 'jYYYY/jMM/jDD HH:mm');

      for (const reqOfUser of existingRequests) {
        const reqStart = moment(`${reqOfUser.startDate} ${reqOfUser.startHour}`, 'jYYYY/jMM/jDD HH:mm');
        const reqEnd = moment(`${reqOfUser.endDate} ${reqOfUser.endHour}`, 'jYYYY/jMM/jDD HH:mm');

        if (newStart.isBefore(reqEnd) && reqStart.isBefore(newEnd)) {
          return res.status(400).json({ error: `این تغییر با یکی از اضافه کارهای قبلی شما همپوشانی دارد (${reqOfUser.startDate} تا ${reqOfUser.endDate})` });
        }
      }

      const overtimeHours = await calculateOvertimeHours(start_date, start_time, end_date, end_time);
      if (overtimeHours <= 0) {
        return res.status(400).json({ error: 'زمان انتخاب شده در ساعات اضافه کار معتبر یا روزهای تعطیل قرار ندارد' });
      }

      await prisma.overtimeRequest.update({
        where: { id: Number(req.params.id) },
        data: { startDate: start_date, endDate: end_date, hoursCount: overtimeHours, reason: reason || '', startHour: start_time, endHour: end_time },
      });

      res.json({ message: 'درخواست با موفقیت ویرایش شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id/delete', async (req, res) => {
    try {
      const request = await prisma.overtimeRequest.findFirst({ where: { id: Number(req.params.id), userId: req.user.id, status: 'pending_supervisor' } });
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد یا قابل حذف نیست' });

      await prisma.overtimeRequest.deleteMany({ where: { id: Number(req.params.id) } });
      res.json({ message: 'درخواست با موفقیت حذف شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id/admin-delete', async (req, res) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'فقط مدیر سیستم می‌تواند اضافه کار تایید شده را حذف کند' });
    }
    try {
      const request = await prisma.overtimeRequest.findUnique({ where: { id: Number(req.params.id) } });
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });

      await prisma.overtimeRequest.deleteMany({ where: { id: Number(req.params.id) } });

      await notify(request.userId, 'حذف درخواست اضافه کار', `درخواست اضافه کار شما (${request.startDate} تا ${request.endDate}) توسط مدیر سیستم حذف شد`, '/overtime');

      res.json({ message: 'درخواست اضافه کار حذف شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id/approve-supervisor', async (req, res) => {
    try {
      const { comment } = req.body;
      const request = await prisma.overtimeRequest.findFirst({ where: { id: Number(req.params.id), status: 'pending_supervisor' } });
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });

      if (req.user.role !== 'admin') {
        const leaveUser = await prisma.user.findUnique({ where: { id: request.userId }, select: { departmentId: true } });
        if (leaveUser && leaveUser.departmentId !== req.user.department_id) {
          return res.status(403).json({ error: 'دسترسی غیرمجاز' });
        }
      }

      await prisma.overtimeRequest.update({
        where: { id: Number(req.params.id) },
        data: { status: 'pending_manager', supervisorId: req.user.id, supervisorComment: comment || '', supervisorDate: getNowString() },
      });

      await notify(request.userId, 'تایید سرپرست', `درخواست اضافه کار شما توسط سرپرست تایید شد و برای مدیر ارسال شد`, '/overtime');

      const managers = await prisma.user.findMany({ where: { role: 'manager', isActive: true }, select: { id: true } });
      for (const m of managers) {
        await notify(m.id, 'درخواست اضافه کار جدید', `درخواست اضافه کار ${request.userId} نیاز به تایید مدیر دارد`, '/overtime');
      }

      res.json({ message: 'درخواست توسط سرپرست تایید شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id/reject-supervisor', async (req, res) => {
    try {
      const { comment } = req.body;
      const request = await prisma.overtimeRequest.findFirst({ where: { id: Number(req.params.id), status: 'pending_supervisor' } });
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });

      await prisma.overtimeRequest.update({
        where: { id: Number(req.params.id) },
        data: { status: 'rejected', supervisorId: req.user.id, supervisorComment: comment || 'رد شده توسط سرپرست', supervisorDate: getNowString() },
      });

      await notify(request.userId, 'رد درخواست اضافه کار', `درخواست اضافه کار شما توسط سرپرست رد شد`, '/overtime');
      res.json({ message: 'درخواست رد شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id/approve-manager', async (req, res) => {
    try {
      const { comment } = req.body;
      const request = await prisma.overtimeRequest.findFirst({ where: { id: Number(req.params.id), status: 'pending_manager' } });
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });

      await prisma.overtimeRequest.update({
        where: { id: Number(req.params.id) },
        data: { status: 'approved', managerId: req.user.id, managerComment: comment || '', managerDate: getNowString() },
      });

      await notify(request.userId, 'تایید نهایی اضافه کار', `اضافه کار شما توسط مدیر تایید شد`, '/overtime');

      const securityUsers = await prisma.user.findMany({
        where: { department: { is: { name: { contains: 'حراست' } } }, isActive: true },
        select: { id: true },
      });
      for (const s of securityUsers) {
        await notify(s.id, 'اضافه کار تایید شده', `اضافه کار کاربر ${request.userId} تایید شده - لطفاً مشاهده کنید`, '/overtime');
      }

      res.json({ message: 'اضافه کار توسط مدیر تایید شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id/reject-manager', async (req, res) => {
    try {
      const { comment } = req.body;
      const request = await prisma.overtimeRequest.findFirst({ where: { id: Number(req.params.id), status: 'pending_manager' } });
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });

      await prisma.overtimeRequest.update({
        where: { id: Number(req.params.id) },
        data: { status: 'rejected', managerId: req.user.id, managerComment: comment || 'رد شده توسط مدیر', managerDate: getNowString() },
      });

      await notify(request.userId, 'رد درخواست اضافه کار', `درخواست اضافه کار شما توسط مدیر رد شد`, '/overtime');
      res.json({ message: 'درخواست رد شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id/seen-security', async (req, res) => {
    if (!(await hasOvertimePerm(req.user, 'overtime_security_view'))) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز - شما دسترسی رویت حراست را ندارید' });
    }
    try {
      const request = await prisma.overtimeRequest.findFirst({ where: { id: Number(req.params.id), status: 'approved' } });
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });

      await prisma.overtimeRequest.update({
        where: { id: Number(req.params.id) },
        data: { status: 'seen_security', securityId: req.user.id, securityDate: getNowString() },
      });

      res.json({ message: 'اضافه کار رویت شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Calculate endpoint
  router.get('/calculate', async (req, res) => {
    try {
      const { start_date, start_time, end_date, end_time } = req.query;
      if (!start_date || !start_time || !end_date || !end_time) {
        return res.status(400).json({ error: 'تمام فیلدهای تاریخ و ساعت شروع و پایان الزامی هستند' });
      }
      const totalHours = await calculateOvertimeHours(start_date, start_time, end_date, end_time);
      const days = Math.floor(totalHours / 8);
      const remainingHours = totalHours % 8;
      res.json({ total_hours: totalHours, days, remaining_hours: remainingHours });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Total cumulative approved overtime
  router.get('/balance', async (req, res) => {
    try {
      const agg = await prisma.overtimeRequest.aggregate({
        where: { userId: req.user.id, status: { in: ['approved', 'seen_security'] } },
        _sum: { hoursCount: true },
      });
      const totalHours = agg._sum.hoursCount ?? 0;
      const days = Math.floor(totalHours / 8);
      const remainingHours = totalHours % 8;
      res.json({ total_hours: totalHours, days, remaining_hours: remainingHours });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/balance-all', async (req, res) => {
    try {
      let users;
      const selectUser = { id: true, fullName: true, departmentId: true, department: { select: { name: true } } };
      if (req.user.role === 'admin' || req.user.role === 'manager' || await hasOvertimePerm(req.user, 'overtime_manager_approve')) {
        users = await prisma.user.findMany({
          where: { isActive: true },
          select: selectUser,
          orderBy: [{ department: { name: 'asc' } }, { fullName: 'asc' }],
        });
      } else if (req.user.role === 'supervisor') {
        users = await prisma.user.findMany({
          where: { isActive: true, departmentId: req.user.department_id, role: { not: 'admin' } },
          select: selectUser,
          orderBy: { fullName: 'asc' },
        });
      } else {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }

      const userIds = users.map((u) => u.id);
      const totalMap = new Map();
      if (userIds.length) {
        const groups = await prisma.overtimeRequest.groupBy({
          by: ['userId'],
          where: { userId: { in: userIds }, status: { in: ['approved', 'seen_security'] } },
          _sum: { hoursCount: true },
        });
        groups.forEach((g) => totalMap.set(g.userId, g._sum.hoursCount ?? 0));
      }

      res.json(users.map((u) => {
        const totalHours = totalMap.get(u.id) ?? 0;
        const days = Math.floor(totalHours / 8);
        const remainingHours = totalHours % 8;
        return {
          user_id: u.id,
          full_name: u.fullName,
          department_id: u.departmentId,
          department_name: u.department ? u.department.name : null,
          total_hours: totalHours,
          days,
          remaining_hours: remainingHours,
        };
      }));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id/edit-after-seen', async (req, res) => {
    if (req.user.role !== 'admin' && !(await hasOvertimePerm(req.user, 'overtime_edit_after_seen'))) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز - شما دسترسی ویرایش اضافه کار پس از رویت را ندارید' });
    }
    try {
      const { end_date, end_time, hours_count, reason } = req.body;
      const overtimeId = Number(req.params.id);

      const request = await prisma.overtimeRequest.findUnique({ where: { id: overtimeId } });
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });

      if (request.status !== 'seen_security') {
        return res.status(400).json({ error: 'ویرایش اضافه کار فقط پس از رویت حراست امکان‌پذیر است' });
      }

      if (request.editedBy) {
        return res.status(400).json({ error: 'این اضافه کار قبلاً اصلاح شده است و اصلاح مجدد آن امکان‌پذیر نیست' });
      }

      const oldVal = JSON.stringify({
        end_date: request.endDate,
        end_time: request.endHour,
        hours_count: request.hoursCount,
        reason: request.reason
      });

      const newVal = JSON.stringify({
        end_date,
        end_time,
        hours_count,
        reason: reason || request.reason
      });

      await prisma.overtimeRequest.update({
        where: { id: overtimeId },
        data: { endDate: end_date, endHour: end_time, hoursCount: Number(hours_count), reason: reason || request.reason || '', editedBy: req.user.id, editedAt: getNowString(), editReason: reason || '' },
      });

      // Log the change
      await prisma.leaveChangeLog.create({
        data: {
          actionBy: req.user.id,
          actionType: 'overtime_edit',
          targetId: overtimeId,
          oldValue: oldVal,
          newValue: newVal,
          details: `ویرایش اضافه کار کاربر (اصلاح پس از رویت). کارکرد جدید: ${hours_count} ساعت.`,
        },
      });

      res.json({ message: 'درخواست اضافه کار با موفقیت ویرایش و لاگ شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Helper function to calculate overtime hours
  async function calculateOvertimeHours(startDateStr, startTimeStr, endDateStr, endTimeStr) {
    const holidays = await getHolidays();
    const holidaysSet = new Set(holidays.map(h => h.holiday_date));

    let current = moment(startDateStr, 'jYYYY/jMM/jDD');
    const end = moment(endDateStr, 'jYYYY/jMM/jDD');

    let totalMinutes = 0;

    const timeToMinutes = (t) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    while (current.isSameOrBefore(end, 'day')) {
      const dateStr = current.format('jYYYY/jMM/jDD');
      const dayOfWeek = current.day(); // 0 is Sunday, ..., 5 is Friday, 6 is Saturday

      const isFriday = (dayOfWeek === 5);
      const isOfficialHoliday = holidaysSet.has(dateStr);

      let reqStartMin = (dateStr === startDateStr) ? timeToMinutes(startTimeStr) : 0;
      let reqEndMin = (dateStr === endDateStr) ? timeToMinutes(endTimeStr) : 1440;

      // Overtime slots
      let slots = [];
      if (isFriday || isOfficialHoliday) {
        slots = [[0, 1440]];
      } else if (dayOfWeek === 4) {
        // Thursday working: 08:00 to 12:00 (480 to 720)
        slots = [[0, 480], [720, 1440]];
      } else {
        // Saturday-Wednesday working: 08:00-12:00 (480 to 720) and 13:00-17:00 (780 to 1020)
        slots = [[0, 480], [720, 780], [1020, 1440]];
      }

      for (const [slotStart, slotEnd] of slots) {
        const overlapStart = Math.max(reqStartMin, slotStart);
        const overlapEnd = Math.min(reqEndMin, slotEnd);
        if (overlapStart < overlapEnd) {
          totalMinutes += (overlapEnd - overlapStart);
        }
      }

      current.add(1, 'day');
    }

    return totalMinutes / 60;
  }

  return router;
};
