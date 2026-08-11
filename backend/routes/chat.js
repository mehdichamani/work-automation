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

  router.get('/rooms', async (req, res) => {
    try {
      const memberships = await prisma.chatMember.findMany({
        where: { userId: Number(req.user.id) },
        include: {
          room: {
            include: {
              messages: { orderBy: { createdAt: 'desc' }, take: 1 },
              members: { include: { user: { select: { fullName: true } } } },
            },
          },
        },
      });

      const rooms = [];
      for (const cm of memberships) {
        const room = cm.room;
        const lastMsg = room.messages[0] || null;
        const unreadCount = await prisma.chatMessage.count({
          where: {
            roomId: room.id,
            createdAt: { gt: cm.lastReadAt ? new Date(String(cm.lastReadAt).replace(' ', 'T')) : new Date('2000-01-01') },
          },
        });
        const other = room.members.find(m => m.userId !== Number(req.user.id));
        const { messages, members, ...roomFields } = room;
        rooms.push({
          ...roomFields,
          last_read_at: cm.lastReadAt,
          last_message: lastMsg ? lastMsg.message : null,
          last_message_at: lastMsg ? lastMsg.createdAt : null,
          unread_count: unreadCount,
          display_name: room.type === 'direct' ? (other ? other.user.fullName : room.name) : room.name,
        });
      }

      rooms.sort((a, b) => {
        const ta = a.last_message_at ? a.last_message_at.getTime() : 0;
        const tb = b.last_message_at ? b.last_message_at.getTime() : 0;
        return tb - ta;
      });

      res.json(mapRow(rooms));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/rooms', async (req, res) => {
    try {
      const { user_id, name, type } = req.body;

      if (type === 'direct' && user_id) {
        const candidateRooms = await prisma.chatRoom.findMany({
          where: { type: 'direct', members: { some: { userId: Number(req.user.id) } } },
          select: { id: true, members: { select: { userId: true } } },
        });
        const existing = candidateRooms.find(r => r.members.some(m => m.userId === Number(user_id)));
        if (existing) return res.json({ id: existing.id, existing: true });
      }

      const room = await prisma.$transaction(async (tx) => {
        const created = await tx.chatRoom.create({
          data: { name: name || null, type: type || 'direct', createdBy: Number(req.user.id) },
        });

        await tx.chatMember.create({ data: { roomId: created.id, userId: Number(req.user.id) } });
        if (user_id && Number(user_id) !== Number(req.user.id)) {
          await tx.chatMember.create({ data: { roomId: created.id, userId: Number(user_id) } });
        }

        return created;
      });

      res.json({ id: room.id, success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/rooms/:id/messages', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const before = req.query.before;

      const member = await prisma.chatMember.findFirst({
        where: { roomId: Number(req.params.id), userId: Number(req.user.id) },
      });
      if (!member && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }

      const where = { roomId: Number(req.params.id) };
      if (before) {
        where.id = { lt: Number(before) };
      }

      const messages = await prisma.chatMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: { user: { select: { fullName: true, role: true } } },
      });
      const mapped = messages
        .map(m => flattenJoins(m, { user_name: 'user.fullName', user_role: 'user.role' }))
        .reverse();

      if (member) {
        await prisma.chatMember.update({
          where: { id: member.id },
          data: { lastReadAt: getNowString() },
        });
      }

      res.json(mapRow(mapped));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/rooms/:id/messages', async (req, res) => {
    try {
      const { message, message_type, attachment_url } = req.body;
      if (!message && !attachment_url) return res.status(400).json({ error: 'پیام الزامی است' });

      const member = await prisma.chatMember.findFirst({
        where: { roomId: Number(req.params.id), userId: Number(req.user.id) },
      });
      if (!member && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }

      const result = await prisma.chatMessage.create({
        data: {
          roomId: Number(req.params.id),
          userId: Number(req.user.id),
          message: message || '',
          messageType: message_type || 'text',
          attachmentUrl: attachment_url || null,
        },
      });

      res.json({ id: result.id, success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/users', async (req, res) => {
    try {
      const users = await prisma.user.findMany({
        where: { id: { not: Number(req.user.id) }, isActive: true },
        orderBy: { fullName: 'asc' },
        select: { id: true, fullName: true, role: true },
      });
      res.json(mapRow(users));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
