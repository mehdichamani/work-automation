const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const prisma = require('../database/prisma');

module.exports = function() {
  const router = express.Router();
  router.use(authMiddleware);

  router.post('/subscribe', async (req, res) => {
    try {
      const { endpoint, p256dh, auth: authKey } = req.body;
      if (!endpoint) return res.status(400).json({ error: 'endpoint الزامی است' });

      await prisma.pushSubscription.deleteMany({ where: { userId: Number(req.user.id), endpoint } });
      await prisma.pushSubscription.create({
        data: {
          userId: Number(req.user.id),
          endpoint,
          p256dh: p256dh || '',
          auth: authKey || '',
        },
      });

      res.json({ message: 'اعلان Push فعال شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/unsubscribe', async (req, res) => {
    try {
      const { endpoint } = req.body;
      if (endpoint) {
        await prisma.pushSubscription.deleteMany({ where: { userId: Number(req.user.id), endpoint } });
      } else {
        await prisma.pushSubscription.deleteMany({ where: { userId: Number(req.user.id) } });
      }
      res.json({ message: 'اعلان Push غیرفعال شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
