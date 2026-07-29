const express = require('express');
const { authMiddleware, roleGuard } = require('../middleware/auth');

module.exports = function(db) {
  const router = express.Router();
  router.use(authMiddleware);
  router.use(roleGuard('admin'));

  router.get('/', (req, res) => {
    try {
      const { module: mod, user_id, page = 1, limit = 50 } = req.query;
      const offset = (page - 1) * limit;
      let where = '';
      const params = [];

      if (mod) {
        where = 'WHERE a.module_name = ?';
        params.push(mod);
      }
      if (user_id) {
        where += (where ? ' AND ' : 'WHERE ') + 'a.user_id = ?';
        params.push(user_id);
      }

      const total = db.prepare(`SELECT COUNT(*) as count FROM activity_log a ${where}`).get(...params).count;
      const logs = db.prepare(`
        SELECT a.*, u.full_name as user_name
        FROM activity_log a
        LEFT JOIN users u ON a.user_id = u.id
        ${where}
        ORDER BY a.created_at DESC
        LIMIT ? OFFSET ?
      `).all(...params, parseInt(limit), parseInt(offset));

      res.json({ logs, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
