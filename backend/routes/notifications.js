const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const prisma = require('../database/prisma');
const { mapRow } = require('../utils/dbAdapter');

module.exports = function() {
  const router = express.Router();
  router.use(authMiddleware);

  router.get('/', async (req, res) => {
    try {
      const notifications = await prisma.notification.findMany({
        where: { userId: Number(req.user.id) },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      res.json(mapRow(notifications));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/unread-count', async (req, res) => {
    try {
      const count = await prisma.notification.count({ where: { userId: Number(req.user.id), isRead: false } });
      res.json({ count });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/read-all', async (req, res) => {
    try {
      await prisma.notification.updateMany({ where: { userId: Number(req.user.id) }, data: { isRead: true } });
      res.json({ message: 'همه خوانده شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id/read', async (req, res) => {
    try {
      await prisma.notification.updateMany({
        where: { id: Number(req.params.id), userId: Number(req.user.id) },
        data: { isRead: true },
      });
      res.json({ message: 'خوانده شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      await prisma.notification.deleteMany({ where: { id: Number(req.params.id), userId: Number(req.user.id) } });
      res.json({ message: 'حذف شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/pending-counts', async (req, res) => {
    try {
      const counts = {
        leave: 0,
        overtime: 0,
        letters: 0,
        inventory: 0,
        jobApplication: 0
      };

      let hasAdminApprove = req.user.role === 'admin' || req.user.role === 'manager';
      if (!hasAdminApprove) {
        const userPerm = await prisma.permission.findFirst({ where: { userId: Number(req.user.id), moduleKey: 'leave_admin_approve' } });
        if (userPerm !== null && userPerm !== undefined) {
          hasAdminApprove = userPerm.isEnabled === true;
        } else if (req.user.department_id) {
          const deptPerm = await prisma.permission.findFirst({ where: { departmentId: Number(req.user.department_id), userId: null, moduleKey: 'leave_admin_approve' } });
          if (deptPerm !== null && deptPerm !== undefined) {
            hasAdminApprove = deptPerm.isEnabled === true;
          }
        }
      }

      if (req.user.role === 'admin' || req.user.role === 'manager') {
        const r = await prisma.leaveRequest.count({ where: { status: { in: ['pending_manager', 'pending_admin'] } } });
        counts.leave = parseInt(r, 10) || 0;

        const ro = await prisma.overtimeRequest.count({ where: { status: 'pending_manager' } });
        counts.overtime = parseInt(ro, 10) || 0;
      } else {
        let leaveCount = 0;
        if (req.user.role === 'supervisor') {
          const deptWhere = { status: 'pending_supervisor' };
          if (req.user.department_id) {
            deptWhere.user = { departmentId: Number(req.user.department_id), role: { not: 'admin' } };
          }
          const r = await prisma.leaveRequest.count({ where: deptWhere });
          leaveCount += parseInt(r, 10) || 0;

          const ro = await prisma.overtimeRequest.count({ where: deptWhere });
          counts.overtime = parseInt(ro, 10) || 0;
        }
        if (hasAdminApprove) {
          const rAdmin = await prisma.leaveRequest.count({ where: { status: 'pending_admin' } });
          leaveCount += parseInt(rAdmin, 10) || 0;
        }
        counts.leave = leaveCount;
      }

      let centralCount = 0;
      let isSantral = req.user.role === 'admin';
      if (!isSantral) {
        const userPerm = await prisma.permission.findFirst({ where: { userId: Number(req.user.id), moduleKey: 'letters_central' } });
        if (userPerm !== null && userPerm !== undefined) {
          isSantral = userPerm.isEnabled === true;
        } else if (req.user.department_id) {
          const deptPerm = await prisma.permission.findFirst({ where: { departmentId: Number(req.user.department_id), userId: null, moduleKey: 'letters_central' } });
          if (deptPerm !== null && deptPerm !== undefined) {
            isSantral = deptPerm.isEnabled === true;
          }
        }
      }
      if (isSantral) {
        const r = await prisma.letter.count({ where: { status: 'pending_central' } });
        centralCount = parseInt(r, 10) || 0;
      }
      let managerCount = 0;
      if (req.user.role === 'admin' || req.user.role === 'manager') {
        const r = await prisma.letter.count({ where: { status: 'pending_manager', selectedManagerId: Number(req.user.id) } });
        managerCount = parseInt(r, 10) || 0;
      }
      counts.letters = centralCount + managerCount;

      const inv = await prisma.cardex.count({ where: { userId: Number(req.user.id), status: 'pending_user' } });
      counts.inventory = parseInt(inv, 10) || 0;

      if (req.user.role === 'admin' || req.user.role === 'manager') {
        const r = await prisma.jobApplication.count({ where: { status: 'pending' } });
        counts.jobApplication = parseInt(r, 10) || 0;
      }

      // Calculate unread chat messages
      const userMemberships = await prisma.chatMember.findMany({
        where: { userId: Number(req.user.id) },
        select: { roomId: true, lastReadAt: true }
      });
      let chatUnread = 0;
      for (const cm of userMemberships) {
        const cnt = await prisma.chatMessage.count({
          where: {
            roomId: cm.roomId,
            userId: { not: Number(req.user.id) },
            createdAt: { gt: cm.lastReadAt ? new Date(String(cm.lastReadAt).replace(' ', 'T')) : new Date('2000-01-01') },
          }
        });
        chatUnread += cnt;
      }
      counts.chat = chatUnread;

      res.json(counts);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
