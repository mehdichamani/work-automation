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

  router.get('/pending-counts', (req, res) => {
    try {
      const counts = {
        leave: 0,
        letters: 0,
        inventory: 0,
        jobApplication: 0
      };

      if (req.user.role === 'admin' || req.user.role === 'manager') {
        const r = db.prepare("SELECT COUNT(*) as count FROM leave_requests WHERE status = 'pending_manager'").get();
        counts.leave = parseInt(r.count, 10) || 0;
      } else if (req.user.role === 'supervisor') {
        const r = db.prepare(`
          SELECT COUNT(*) as count 
          FROM leave_requests 
          WHERE status = 'pending_supervisor' 
            AND user_id IN (SELECT id FROM users WHERE department_id = ? AND role != 'admin')
        `).get(req.user.department_id);
        counts.leave = parseInt(r.count, 10) || 0;
      }

      let centralCount = 0;
      const dept = db.prepare('SELECT name FROM departments WHERE id = ?').get(req.user.department_id);
      const isSantral = req.user.role === 'admin' || (dept && dept.name.includes('سانترال'));
      if (isSantral) {
        const r = db.prepare("SELECT COUNT(*) as count FROM letters WHERE status = 'pending_central'").get();
        centralCount = parseInt(r.count, 10) || 0;
      }
      let managerCount = 0;
      if (req.user.role === 'admin' || req.user.role === 'manager') {
        const r = db.prepare("SELECT COUNT(*) as count FROM letters WHERE status = 'pending_manager' AND selected_manager_id = ?").get(req.user.id);
        managerCount = parseInt(r.count, 10) || 0;
      }
      counts.letters = centralCount + managerCount;

      const inv = db.prepare("SELECT COUNT(*) as count FROM cardex WHERE user_id = ? AND status = 'pending_user'").get(req.user.id);
      counts.inventory = parseInt(inv.count, 10) || 0;

      if (req.user.role === 'admin' || req.user.role === 'manager') {
        const r = db.prepare("SELECT COUNT(*) as count FROM job_applications WHERE status = 'pending'").get();
        counts.jobApplication = parseInt(r.count, 10) || 0;
      }

      res.json(counts);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
