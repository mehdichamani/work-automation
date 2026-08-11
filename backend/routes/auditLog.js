const express = require('express');
const { authMiddleware, roleGuard } = require('../middleware/auth');
const prisma = require('../database/prisma');
const { mapRow, flattenJoins } = require('../utils/dbAdapter');

module.exports = function() {
  const router = express.Router();
  router.use(authMiddleware);
  router.use(roleGuard('admin'));

  router.get('/', async (req, res) => {
    try {
      const { module: mod, user_id, page = 1, limit = 50 } = req.query;
      const offset = (page - 1) * limit;
      const where = {};

      if (mod) {
        where.moduleName = mod;
      }
      if (user_id) {
        where.userId = Number(user_id);
      }

      const total = await prisma.activityLog.count({ where });

      const logs = await prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset),
        include: {
          user: { select: { fullName: true } },
        },
      });

      const mapped = logs.map(r => flattenJoins(r, { user_name: 'user.fullName' }));

      res.json({ logs: mapRow(mapped), total, page: parseInt(page), limit: parseInt(limit) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
