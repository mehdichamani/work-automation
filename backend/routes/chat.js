const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware } = require('../middleware/auth');
const { chatMessage } = require('../middleware/validate');
const prisma = require('../database/prisma');
const { mapRow, flattenJoins } = require('../utils/dbAdapter');

function getNowString() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

const chatStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads', 'chat_temp');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, safeName);
  }
});

const chatFileFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'text/plain'
  ];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('فرمت فایل مجاز نیست. فقط عکس، PDF و متن متنی ساده مجاز است.'), false);
  }
};

const chatUpload = multer({
  storage: chatStorage,
  fileFilter: chatFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB strict limit
});

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

      const roomId = Number(req.params.id);
      if (isNaN(roomId)) {
        return res.status(400).json({ error: 'شناسه اتاق نامعتبر است' });
      }

      const member = await prisma.chatMember.findFirst({
        where: { roomId: roomId, userId: Number(req.user.id) },
      });
      if (!member && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }

      const where = { roomId: roomId };
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

      const nowStr = getNowString();
      if (member) {
        await prisma.chatMember.update({
          where: { id: member.id },
          data: { lastReadAt: nowStr },
        });
      }

      // Also get members' last read info so we can check if messages are read
      const otherMembers = await prisma.chatMember.findMany({
        where: { roomId: roomId, userId: { not: Number(req.user.id) } },
        select: { userId: true, lastReadAt: true }
      });

      const result = mapped.map(msg => {
        let isReadByOther = false;
        if (msg.user_id === Number(req.user.id) && otherMembers.length > 0) {
          const msgTime = new Date(msg.created_at).getTime();
          isReadByOther = otherMembers.some(m => m.lastReadAt && new Date(String(m.lastReadAt).replace(' ', 'T')).getTime() >= msgTime);
        }
        return {
          ...msg,
          is_read: isReadByOther
        };
      });

      res.json(mapRow(result));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/rooms/:id/read', async (req, res) => {
    try {
      const roomId = Number(req.params.id);
      if (isNaN(roomId)) return res.status(400).json({ error: 'شناسه نامعتبر است' });

      const nowStr = getNowString();
      await prisma.chatMember.updateMany({
        where: { roomId: roomId, userId: Number(req.user.id) },
        data: { lastReadAt: nowStr },
      });

      if (global.io) {
        global.io.to(`room_${roomId}`).emit('chat:read', {
          roomId,
          userId: Number(req.user.id),
          readAt: nowStr
        });
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/rooms/:id/upload', (req, res, next) => {
    chatUpload.single('file')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message || 'خطا در بارگذاری فایل' });
      }
      if (!req.file) {
        return res.status(400).json({ error: 'فایلی ارسال نشده است' });
      }
      const fileUrl = `/uploads/chat_temp/${req.file.filename}`;
      res.json({
        success: true,
        url: fileUrl,
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      });
    });
  });

  router.post('/rooms/:id/messages', chatMessage, async (req, res) => {
    try {
      const { message, message_type, attachment_url } = req.body;

      const roomId = Number(req.params.id);
      if (isNaN(roomId)) {
        return res.status(400).json({ error: 'شناسه اتاق نامعتبر است' });
      }

      const member = await prisma.chatMember.findFirst({
        where: { roomId: roomId, userId: Number(req.user.id) },
      });
      if (!member && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }

      const createdMsg = await prisma.chatMessage.create({
        data: {
          roomId: roomId,
          userId: Number(req.user.id),
          message: message || '',
          messageType: message_type || 'text',
          attachmentUrl: attachment_url || null,
        },
        include: { user: { select: { fullName: true, role: true } } },
      });

      const mappedMsg = flattenJoins(createdMsg, { user_name: 'user.fullName', user_role: 'user.role' });
      mappedMsg.is_read = false;

      // Realtime emit via Socket.io
      if (global.io) {
        global.io.to(`room_${roomId}`).emit('chat:message', {
          roomId,
          message: mapRow(mappedMsg)
        });

        // Notify room members outside the room
        const roomMembers = await prisma.chatMember.findMany({
          where: { roomId: roomId, userId: { not: Number(req.user.id) } },
          select: { userId: true }
        });

        for (const rm of roomMembers) {
          global.io.to(`user_${rm.userId}`).emit('chat:notification', {
            roomId,
            senderId: Number(req.user.id),
            senderName: req.user.fullName || req.user.full_name || 'کاربر',
            message: message || (message_type === 'image' ? '📷 تصویر' : '📎 فایل پیوست'),
            createdAt: createdMsg.createdAt
          });
        }
      }

      res.json(mapRow({ id: createdMsg.id, success: true, message: mappedMsg }));
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

