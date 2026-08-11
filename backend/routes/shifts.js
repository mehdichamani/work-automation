const express = require('express');
const { authMiddleware } = require('../middleware/auth');
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

  async function notify(userId, title, body, link) {
    await prisma.notification.create({ data: { userId: Number(userId), title, body, link } });
  }

  async function hasShiftPerm(user, key) {
    if (user.role === 'admin') return true;
    const p = await prisma.permission.findFirst({ where: { userId: Number(user.id), moduleKey: key } });
    if (p) return p.isEnabled;
    if (user.department_id) {
      const dp = await prisma.permission.findFirst({ where: { departmentId: Number(user.department_id), moduleKey: key, userId: null } });
      if (dp) return dp.isEnabled;
    }
    return false;
  }

  async function isShiftManager(user) {
    return user.role === 'admin' || await hasShiftPerm(user, 'shifts_manage');
  }

  async function getCurrentShift(userId) {
    const row = await prisma.userShiftAssignment.findFirst({
      where: { userId: Number(userId), isActive: true },
      orderBy: { id: 'desc' },
      include: {
        shift: { select: { id: true, name: true, startTime: true, endTime: true, description: true, color: true } },
      },
    });
    if (!row) return null;
    return {
      assignment_id: row.id,
      user_id: row.userId,
      is_active: row.isActive,
      shift_id: row.shift.id,
      name: row.shift.name,
      start_time: row.shift.startTime,
      end_time: row.shift.endTime,
      description: row.shift.description,
      color: row.shift.color,
    };
  }

  router.get('/my', async (req, res) => {
    try {
      const currentShift = await getCurrentShift(req.user.id);
      res.json({ current_shift: currentShift ? mapRow(currentShift) : null });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/', async (req, res) => {
    try {
      const shifts = await prisma.workShift.findMany({ where: { isActive: true }, orderBy: { id: 'asc' } });
      res.json(mapRow(shifts));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/', async (req, res) => {
    if (!(await isShiftManager(req.user))) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }

    try {
      const { name, start_time, end_time, description, color } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'نام شیفت الزامی است' });
      }

      const result = await prisma.workShift.create({
        data: { name, startTime: start_time || '', endTime: end_time || '', description: description || '', color: color || '#3b82f6' },
      });

      res.json({ id: result.id, message: 'شیفت با موفقیت ایجاد شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id', async (req, res) => {
    if (!(await isShiftManager(req.user))) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }

    try {
      const { name, start_time, end_time, description, color } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'نام شیفت الزامی است' });
      }

      await prisma.workShift.update({
        where: { id: Number(req.params.id) },
        data: { name, startTime: start_time || '', endTime: end_time || '', description: description || '', color: color || '#3b82f6' },
      });

      res.json({ message: 'شیفت با موفقیت ویرایش شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id', async (req, res) => {
    if (!(await isShiftManager(req.user))) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }

    try {
      await prisma.workShift.update({ where: { id: Number(req.params.id) }, data: { isActive: false } });
      res.json({ message: 'شیفت غیرفعال شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/assignments', async (req, res) => {
    if (!(await isShiftManager(req.user))) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }

    try {
      const assignments = await prisma.userShiftAssignment.findMany({
        where: { isActive: true },
        orderBy: { user: { fullName: 'asc' } },
        include: {
          user: { select: { fullName: true, username: true, role: true, departmentId: true, department: { select: { name: true } } } },
          shift: { select: { name: true, startTime: true, endTime: true, color: true, description: true } },
        },
      });
      const mapped = assignments.map(r => flattenJoins(r, {
        full_name: 'user.fullName',
        username: 'user.username',
        role: 'user.role',
        department_id: 'user.departmentId',
        department_name: 'user.department.name',
        shift_name: 'shift.name',
        start_time: 'shift.startTime',
        end_time: 'shift.endTime',
        color: 'shift.color',
        description: 'shift.description',
      }));
      res.json(mapRow(mapped));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/assignments', async (req, res) => {
    if (!(await isShiftManager(req.user))) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }

    try {
      const { user_id, shift_id } = req.body;
      if (!user_id || !shift_id) {
        return res.status(400).json({ error: 'کاربر و شیفت الزامی است' });
      }

      await prisma.userShiftAssignment.updateMany({ where: { userId: Number(user_id) }, data: { isActive: false } });
      const result = await prisma.userShiftAssignment.create({
        data: { userId: Number(user_id), shiftId: Number(shift_id), isActive: true },
      });

      res.json({ id: result.id, message: 'شیفت کاربر با موفقیت تنظیم شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/users', async (req, res) => {
    if (!(await isShiftManager(req.user))) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    try {
      const users = await prisma.user.findMany({
        where: { isActive: true },
        orderBy: [{ department: { name: 'asc' } }, { fullName: 'asc' }],
        include: {
          department: { select: { name: true } },
          userShiftAssignments: {
            where: { isActive: true },
            orderBy: { id: 'desc' },
            take: 1,
            select: { shiftId: true, shift: { select: { name: true, color: true } } },
          },
        },
      });
      const mapped = users.map(u => ({
        id: u.id,
        full_name: u.fullName,
        role: u.role,
        department_id: u.departmentId,
        work_type: u.workType,
        department_name: u.department ? u.department.name : null,
        shift_id: u.userShiftAssignments[0] ? u.userShiftAssignments[0].shiftId : null,
        shift_name: u.userShiftAssignments[0] ? u.userShiftAssignments[0].shift.name : null,
        shift_color: u.userShiftAssignments[0] ? u.userShiftAssignments[0].shift.color : null,
      }));
      res.json(mapped);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/work-type/:userId', async (req, res) => {
    if (!(await isShiftManager(req.user))) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    try {
      const { work_type } = req.body;
      if (!['normal', 'shift'].includes(work_type)) {
        return res.status(400).json({ error: 'نوع وضعیت کاری نامعتبر است' });
      }
      await prisma.user.update({ where: { id: Number(req.params.userId) }, data: { workType: work_type } });
      if (work_type === 'normal') {
        await prisma.userShiftAssignment.updateMany({ where: { userId: Number(req.params.userId) }, data: { isActive: false } });
      }
      res.json({ message: 'وضعیت کاری کاربر با موفقیت بروزرسانی شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/requests/my', async (req, res) => {
    try {
      const requests = await prisma.shiftChangeRequest.findMany({
        where: { userId: Number(req.user.id) },
        orderBy: { createdAt: 'desc' },
        include: {
          currentShift: { select: { name: true } },
          requestedShift: { select: { name: true } },
        },
      });
      const mapped = requests.map(r => flattenJoins(r, { current_shift_name: 'currentShift.name', requested_shift_name: 'requestedShift.name' }));
      res.json(mapRow(mapped));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/requests', async (req, res) => {
    if (!(await isShiftManager(req.user))) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }

    try {
      const requests = await prisma.shiftChangeRequest.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { fullName: true, departmentId: true, department: { select: { name: true } } } },
          currentShift: { select: { name: true } },
          requestedShift: { select: { name: true } },
          reviewer: { select: { fullName: true } },
        },
      });
      const mapped = requests.map(r => flattenJoins(r, {
        user_name: 'user.fullName',
        department_id: 'user.departmentId',
        department_name: 'user.department.name',
        current_shift_name: 'currentShift.name',
        requested_shift_name: 'requestedShift.name',
        reviewer_name: 'reviewer.fullName',
      }));
      res.json(mapRow(mapped));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/requests', async (req, res) => {
    try {
      const { requested_shift_id, reason, requested_date } = req.body;
      if (!requested_shift_id) {
        return res.status(400).json({ error: 'شیفت درخواستی الزامی است' });
      }

      const currentShift = await getCurrentShift(req.user.id);
      const result = await prisma.shiftChangeRequest.create({
        data: {
          userId: Number(req.user.id),
          currentShiftId: currentShift ? currentShift.shift_id : null,
          requestedShiftId: Number(requested_shift_id),
          requestedDate: requested_date || '',
          reason: reason || '',
          status: 'pending',
        },
      });

      const managers = await prisma.user.findMany({ where: { role: { in: ['admin', 'manager'] }, isActive: true }, select: { id: true } });
      for (const manager of managers) {
        await notify(manager.id, 'درخواست تغییر شیفت', `${req.user.full_name} درخواست تغییر شیفت ثبت کرده است`, '/shifts');
      }

      res.json({ id: result.id, message: 'درخواست تغییر شیفت ثبت شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/requests/:id/approve', async (req, res) => {
    if (!(await isShiftManager(req.user))) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }

    try {
      const request = await prisma.shiftChangeRequest.findUnique({ where: { id: Number(req.params.id) } });
      if (!request) {
        return res.status(404).json({ error: 'درخواست یافت نشد' });
      }

      await prisma.shiftChangeRequest.update({
        where: { id: Number(req.params.id) },
        data: { status: 'approved', reviewedBy: Number(req.user.id), reviewedAt: getNowString(), reviewComment: req.body.comment || '' },
      });

      await prisma.userShiftAssignment.updateMany({ where: { userId: request.userId }, data: { isActive: false } });
      await prisma.userShiftAssignment.create({
        data: { userId: request.userId, shiftId: request.requestedShiftId, isActive: true },
      });

      await notify(request.userId, 'تایید تغییر شیفت', 'درخواست تغییر شیفت شما تایید شد', '/shifts');
      res.json({ message: 'درخواست تغییر شیفت تایید شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/requests/:id/reject', async (req, res) => {
    if (!(await isShiftManager(req.user))) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }

    try {
      const request = await prisma.shiftChangeRequest.findUnique({ where: { id: Number(req.params.id) } });
      if (!request) {
        return res.status(404).json({ error: 'درخواست یافت نشد' });
      }

      await prisma.shiftChangeRequest.update({
        where: { id: Number(req.params.id) },
        data: { status: 'rejected', reviewedBy: Number(req.user.id), reviewedAt: getNowString(), reviewComment: req.body.comment || 'رد شد' },
      });

      await notify(request.userId, 'رد درخواست تغییر شیفت', 'درخواست تغییر شیفت شما رد شد', '/shifts');
      res.json({ message: 'درخواست تغییر شیفت رد شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
