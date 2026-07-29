const express = require('express');
const { authMiddleware } = require('../middleware/auth');

module.exports = function(db) {
  const router = express.Router();
  router.use(authMiddleware);

  try {
    db.exec(`CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      endpoint TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);
  } catch(e) {}

  router.post('/subscribe', (req, res) => {
    try {
      const { endpoint, p256dh, auth: authKey } = req.body;
      if (!endpoint) return res.status(400).json({ error: 'endpoint الزامی است' });

      db.prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?').run(req.user.id, endpoint);
      db.prepare('INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)')
        .run(req.user.id, endpoint, p256dh || '', authKey || '');

      res.json({ message: 'اعلان Push فعال شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/unsubscribe', (req, res) => {
    try {
      const { endpoint } = req.body;
      if (endpoint) {
        db.prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?').run(req.user.id, endpoint);
      } else {
        db.prepare('DELETE FROM push_subscriptions WHERE user_id = ?').run(req.user.id);
      }
      res.json({ message: 'اعلان Push غیرفعال شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
