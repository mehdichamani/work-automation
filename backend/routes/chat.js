const express = require('express');
const { authMiddleware } = require('../middleware/auth');

module.exports = function(db) {
  const router = express.Router();
  router.use(authMiddleware);

  router.get('/rooms', (req, res) => {
    try {
      const rooms = db.prepare(`
        SELECT cr.*, cm.last_read_at,
          (SELECT message FROM chat_messages WHERE room_id = cr.id ORDER BY created_at DESC LIMIT 1) as last_message,
          (SELECT created_at FROM chat_messages WHERE room_id = cr.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
          (SELECT COUNT(*) FROM chat_messages WHERE room_id = cr.id AND created_at > COALESCE(cm.last_read_at, '2000-01-01')) as unread_count,
          CASE WHEN cr.type = 'direct' THEN
            (SELECT u.full_name FROM chat_members cm2 JOIN users u ON cm2.user_id = u.id WHERE cm2.room_id = cr.id AND cm2.user_id != ? LIMIT 1)
          ELSE cr.name END as display_name
        FROM chat_rooms cr
        JOIN chat_members cm ON cr.id = cm.room_id AND cm.user_id = ?
        ORDER BY last_message_at DESC NULLS LAST
      `).all(req.user.id, req.user.id);
      res.json(rooms);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/rooms', (req, res) => {
    try {
      const { user_id, name, type } = req.body;

      if (type === 'direct' && user_id) {
        const existing = db.prepare(`
          SELECT cr.id FROM chat_rooms cr
          JOIN chat_members cm1 ON cr.id = cm1.room_id AND cm1.user_id = ?
          JOIN chat_members cm2 ON cr.id = cm2.room_id AND cm2.user_id = ?
          WHERE cr.type = 'direct'
        `).get(req.user.id, user_id);
        if (existing) return res.json({ id: existing.id, existing: true });
      }

      const result = db.prepare('INSERT INTO chat_rooms (name, type, created_by) VALUES (?, ?, ?)').run(
        name || null, type || 'direct', req.user.id
      );
      const roomId = result.lastInsertRowid;

      db.prepare('INSERT INTO chat_members (room_id, user_id) VALUES (?, ?)').run(roomId, req.user.id);
      if (user_id && user_id !== req.user.id) {
        db.prepare('INSERT INTO chat_members (room_id, user_id) VALUES (?, ?)').run(roomId, user_id);
      }

      res.json({ id: roomId, success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/rooms/:id/messages', (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const before = req.query.before;

      const member = db.prepare('SELECT * FROM chat_members WHERE room_id = ? AND user_id = ?').get(req.params.id, req.user.id);
      if (!member && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }

      let msgWhere = 'WHERE m.room_id = ?';
      const msgParams = [req.params.id];
      if (before) {
        msgWhere += ' AND m.id < ?';
        msgParams.push(before);
      }

      const messages = db.prepare(`
        SELECT m.*, u.full_name as user_name, u.role as user_role
        FROM chat_messages m
        LEFT JOIN users u ON m.user_id = u.id
        ${msgWhere}
        ORDER BY m.created_at DESC
        LIMIT ?
      `).all(...msgParams, limit).reverse();

      if (member) {
        db.prepare(`UPDATE chat_members SET last_read_at = to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text) WHERE room_id = ? AND user_id = ?`)
          .run(req.params.id, req.user.id);
      }

      res.json(messages);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/rooms/:id/messages', (req, res) => {
    try {
      const { message, message_type, attachment_url } = req.body;
      if (!message && !attachment_url) return res.status(400).json({ error: 'پیام الزامی است' });

      const member = db.prepare('SELECT * FROM chat_members WHERE room_id = ? AND user_id = ?').get(req.params.id, req.user.id);
      if (!member && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }

      const result = db.prepare(`
        INSERT INTO chat_messages (room_id, user_id, message, message_type, attachment_url)
        VALUES (?, ?, ?, ?, ?)
      `).run(req.params.id, req.user.id, message || '', message_type || 'text', attachment_url || null);

      res.json({ id: result.lastInsertRowid, success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/users', (req, res) => {
    try {
      const users = db.prepare(`
        SELECT id, full_name, role FROM users WHERE id != ? AND is_active = 1 ORDER BY full_name
      `).all(req.user.id);
      res.json(users);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
