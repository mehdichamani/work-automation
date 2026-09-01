const express = require('express');
const { authMiddleware, roleGuard } = require('../middleware/auth');
const prisma = require('../database/prisma');
const moment = require('moment-jalaali');

module.exports = function() {
  const router = express.Router();

  // Route to record page views
  router.post('/track', async (req, res) => {
    try {
      const { path: pagePath, pageTitle, userId } = req.body;
      if (!pagePath) {
        return res.status(400).json({ error: 'Path is required' });
      }

      let finalUserId = userId ? parseInt(userId, 10) : null;
      if (!finalUserId && req.headers.authorization) {
        try {
          const jwt = require('jsonwebtoken');
          const token = req.headers.authorization.split(' ')[1];
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
          if (decoded && decoded.id) finalUserId = decoded.id;
        } catch { /* ignore invalid token */ }
      }

      const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
      const userAgent = req.headers['user-agent'] ? req.headers['user-agent'].substring(0, 255) : null;

      await prisma.pageView.create({
        data: {
          path: pagePath.substring(0, 255),
          pageTitle: pageTitle ? pageTitle.substring(0, 255) : null,
          userId: finalUserId,
          ipAddress: ipAddress ? String(ipAddress).substring(0, 100) : null,
          userAgent,
        },
      });

      res.status(201).json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin/Manager stats for page views
  router.get('/stats', authMiddleware, roleGuard('admin', 'manager'), async (req, res) => {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const sevenDaysAgo = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(todayStart.getTime() - 29 * 24 * 60 * 60 * 1000);

      const totalViews = await prisma.pageView.count();
      const todayViews = await prisma.pageView.count({
        where: { createdAt: { gte: todayStart } },
      });
      const weekViews = await prisma.pageView.count({
        where: { createdAt: { gte: sevenDaysAgo } },
      });
      const monthViews = await prisma.pageView.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      });

      const todayUsersRaw = await prisma.pageView.groupBy({
        by: ['userId'],
        where: { createdAt: { gte: todayStart }, userId: { not: null } },
      });
      const todayActiveUsersCount = todayUsersRaw.length;

      const topPagesRaw = await prisma.pageView.groupBy({
        by: ['path', 'pageTitle'],
        where: { createdAt: { gte: thirtyDaysAgo } },
        _count: { _all: true },
        orderBy: { _count: { path: 'desc' } },
        take: 8,
      });

      const topPages = topPagesRaw.map(p => ({
        path: p.path,
        pageTitle: p.pageTitle || p.path,
        count: p._count._all,
      }));

      const recentViews = await prisma.pageView.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        select: { createdAt: true },
      });

      const dailyCounts = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(todayStart.getTime() - i * 24 * 60 * 60 * 1000);
        const jDay = moment(d).format('jMM/jDD');
        dailyCounts[jDay] = 0;
      }

      recentViews.forEach(v => {
        const jDay = moment(v.createdAt).format('jMM/jDD');
        if (dailyCounts[jDay] !== undefined) {
          dailyCounts[jDay]++;
        }
      });

      const dailyTrend = Object.entries(dailyCounts).map(([date, count]) => ({
        date,
        count,
      }));

      const recentVisits = await prisma.pageView.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, fullName: true, role: true, department: { select: { name: true } } },
          },
        },
      });

      const formattedRecentVisits = recentVisits.map(v => ({
        id: v.id,
        path: v.path,
        pageTitle: v.pageTitle || v.path,
        createdAt: v.createdAt,
        user: v.user ? {
          id: v.user.id,
          fullName: v.user.fullName,
          role: v.user.role,
          departmentName: v.user.department?.name || null,
        } : null,
      }));

      res.json({
        totalViews,
        todayViews,
        weekViews,
        monthViews,
        todayActiveUsersCount,
        topPages,
        dailyTrend,
        recentVisits: formattedRecentVisits,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
