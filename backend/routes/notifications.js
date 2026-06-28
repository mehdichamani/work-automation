const express = require('express');
const { authMiddleware } = require('../middleware/auth');

module.exports = function(db) {
  const router = express.Router();
  router.use(authMiddleware);

  router.get('/', (req, res) => {
    try {
      const notifications = db.prepare(`
        SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50
      `).all(req.user.id);
      res.json(notifications);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/unread-count', (req, res) => {
    try {
      const result = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0').get(req.user.id);
      res.json({ count: result.count });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/read-all', (req, res) => {
    try {
      db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
      res.json({ message: 'همه خوانده شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id/read', (req, res) => {
    try {
      db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
      res.json({ message: 'خوانده شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id', (req, res) => {
    try {
      db.prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
      res.json({ message: 'حذف شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
