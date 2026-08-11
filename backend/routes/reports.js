const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const moment = require('moment-jalaali');
const prisma = require('../database/prisma');

module.exports = function() {
  const router = express.Router();
  router.use(authMiddleware);

  router.get('/monthly', async (req, res) => {
    try {
      const { year, month } = req.query;
      const jalaliYear = year || moment().jYear();
      const jalaliMonth = month || moment().jMonth() + 1;
      const monthPrefix = `${jalaliYear}/${String(jalaliMonth).padStart(2, '0')}`;

      const monthStart = moment(`${monthPrefix}/01`, 'jYYYY/jMM/jDD').startOf('jMonth');
      const monthEnd = moment(monthStart).endOf('jMonth');
      const createdAtRange = { gte: monthStart.toDate(), lte: monthEnd.toDate() };

      const leaveTotal = await prisma.leaveRequest.count({ where: { startDate: { startsWith: monthPrefix } } });
      const leaveApproved = await prisma.leaveRequest.count({ where: { startDate: { startsWith: monthPrefix }, status: 'approved' } });
      const leaveRejected = await prisma.leaveRequest.count({ where: { startDate: { startsWith: monthPrefix }, status: 'rejected' } });
      const leaveHours = await prisma.leaveRequest.aggregate({
        where: { startDate: { startsWith: monthPrefix } },
        _sum: { hoursCount: true },
      });
      const leaveStats = { total: leaveTotal, approved: leaveApproved, rejected: leaveRejected, total_hours: leaveHours._sum.hoursCount };

      const overtimeTotal = await prisma.overtimeRequest.count({
        where: { startDate: { startsWith: monthPrefix }, status: { not: 'rejected' } },
      });
      const overtimeHours = await prisma.overtimeRequest.aggregate({
        where: { startDate: { startsWith: monthPrefix }, status: { not: 'rejected' } },
        _sum: { hoursCount: true },
      });
      const overtimeStats = { total: overtimeTotal, total_hours: overtimeHours._sum.hoursCount ?? 0 };

      const purchaseStats = { total: await prisma.purchaseRequest.count({ where: { createdAt: createdAtRange } }) };

      const missionStats = { total: await prisma.missionRequest.count({
        where: { missionDate: { startsWith: monthPrefix }, status: { not: 'rejected' } },
      }) };

      const production = await prisma.dailyOutput.aggregate({
        where: { reportDate: { startsWith: monthPrefix } },
        _count: { _all: true },
        _sum: { quantity: true },
      });
      const productionStats = { total: production._count._all, total_quantity: production._sum.quantity ?? 0 };

      const workOrderTotal = await prisma.workOrder.count({ where: { createdAt: createdAtRange } });
      const workOrderApproved = await prisma.workOrder.count({
        where: { createdAt: createdAtRange, status: 'approved' },
      });
      const workOrderStats = { total: workOrderTotal, approved: workOrderApproved };

      const leavesWithDept = await prisma.leaveRequest.findMany({
        where: { startDate: { startsWith: monthPrefix } },
        select: { user: { select: { department: { select: { name: true } } } } },
      });
      const deptCounts = {};
      leavesWithDept.forEach(l => {
        const name = l.user?.department?.name;
        if (name) deptCounts[name] = (deptCounts[name] || 0) + 1;
      });
      const departmentStats = Object.entries(deptCounts)
        .map(([name, request_count]) => ({ name, request_count }))
        .sort((a, b) => b.request_count - a.request_count);

      res.json({
        period: { year: jalaliYear, month: jalaliMonth },
        leave: leaveStats,
        overtime: overtimeStats,
        purchase: purchaseStats,
        mission: missionStats,
        production: productionStats,
        workOrder: workOrderStats,
        departments: departmentStats
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/user-summary', async (req, res) => {
    try {
      const userId = req.user.role === 'admin' ? (req.query.user_id ? Number(req.query.user_id) : req.user.id) : req.user.id;
      const jalaliYear = moment().jYear();
      const jalaliMonth = moment().jMonth() + 1;
      const monthPrefix = `${jalaliYear}/${String(jalaliMonth).padStart(2, '0')}`;

      const leavesCount = await prisma.leaveRequest.count({
        where: { userId, startDate: { startsWith: monthPrefix }, status: 'approved' },
      });
      const leavesHours = await prisma.leaveRequest.aggregate({
        where: { userId, startDate: { startsWith: monthPrefix }, status: 'approved' },
        _sum: { hoursCount: true },
      });
      const leaves = { total: leavesCount, total_hours: leavesHours._sum.hoursCount };

      const overtimeCount = await prisma.overtimeRequest.count({
        where: { userId, startDate: { startsWith: monthPrefix }, status: { not: 'rejected' } },
      });
      const overtimeHours = await prisma.overtimeRequest.aggregate({
        where: { userId, startDate: { startsWith: monthPrefix }, status: { not: 'rejected' } },
        _sum: { hoursCount: true },
      });
      const overtime = { total: overtimeCount, total_hours: overtimeHours._sum.hoursCount ?? 0 };

      const missions = { total: await prisma.missionRequest.count({
        where: { userId, missionDate: { startsWith: monthPrefix }, status: { not: 'rejected' } },
      }) };

      res.json({ leave: leaves, overtime, mission: missions });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
