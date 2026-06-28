const express = require('express');
const { authMiddleware, roleGuard } = require('../middleware/auth');

module.exports = function(db) {
  const router = express.Router();
  router.use(authMiddleware);

  function isWarehouseStaff(req) {
    if (req.user.role === 'admin') return true;
    if (req.user.department_name === 'انبار') return true;
    return false;
  }

  function warehouseGuard(req, res, next) {
    if (!isWarehouseStaff(req)) {
      return res.status(403).json({ error: 'فقط کارکنان انبار اجازه دسترسی دارند' });
    }
    next();
  }

  function notify(userId, title, body, link) {
    db.prepare('INSERT INTO notifications (user_id, title, body, link) VALUES (?, ?, ?, ?)').run(userId, title, body, link);
  }

  router.get('/items', (req, res) => {
    try {
      const items = db.prepare('SELECT * FROM inventory_items WHERE is_active = 1 ORDER BY name').all();
      res.json(items);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/items', warehouseGuard, (req, res) => {
    try {
      const { name, description, unit } = req.body;
      const result = db.prepare('INSERT INTO inventory_items (name, description, unit) VALUES (?, ?, ?)').run(name, description || '', unit || 'عدد');
      res.json({ id: result.lastInsertRowid, message: 'کالا اضافه شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/items/:id', warehouseGuard, (req, res) => {
    try {
      const { name, description, unit } = req.body;
      db.prepare('UPDATE inventory_items SET name = ?, description = ?, unit = ? WHERE id = ?').run(name, description || '', unit || 'عدد', req.params.id);
      res.json({ message: 'کالا ویرایش شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/items/:id', warehouseGuard, (req, res) => {
    try {
      const inUse = db.prepare('SELECT id FROM cardex WHERE item_id = ? LIMIT 1').get(req.params.id);
      if (inUse) return res.status(400).json({ error: 'این کالا در کاردکس استفاده شده و قابل حذف نیست' });
      db.prepare('UPDATE inventory_items SET is_active = 0 WHERE id = ?').run(req.params.id);
      res.json({ message: 'کالا حذف شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/my-cardex', (req, res) => {
    try {
      const cardex = db.prepare(`
        SELECT c.*, i.name as item_name, i.unit as item_unit, wu.full_name as warehouse_user_name
        FROM cardex c
        JOIN inventory_items i ON c.item_id = i.id
        JOIN users wu ON c.warehouse_user_id = wu.id
        WHERE c.user_id = ?
        ORDER BY c.created_at DESC
      `).all(req.user.id);
      res.json(cardex);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/pending-confirm', (req, res) => {
    try {
      const cardex = db.prepare(`
        SELECT c.*, i.name as item_name, i.unit as item_unit, wu.full_name as warehouse_user_name
        FROM cardex c
        JOIN inventory_items i ON c.item_id = i.id
        JOIN users wu ON c.warehouse_user_id = wu.id
        WHERE c.user_id = ? AND c.status = 'pending_user'
        ORDER BY c.created_at DESC
      `).all(req.user.id);
      res.json(cardex);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/all', warehouseGuard, (req, res) => {
    try {
      const cardex = db.prepare(`
        SELECT c.*, i.name as item_name, i.unit as item_unit, u.full_name as user_name, wu.full_name as warehouse_user_name
        FROM cardex c
        JOIN inventory_items i ON c.item_id = i.id
        JOIN users u ON c.user_id = u.id
        JOIN users wu ON c.warehouse_user_id = wu.id
        ORDER BY c.created_at DESC
      `).all();
      res.json(cardex);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/', warehouseGuard, (req, res) => {
    try {
      const { user_id, item_id, quantity, delivery_date, notes } = req.body;
      if (!user_id || !item_id || !quantity || !delivery_date) {
        return res.status(400).json({ error: 'فیلدهای الزامی را پر کنید' });
      }

      const result = db.prepare(`
        INSERT INTO cardex (user_id, item_id, quantity, delivery_date, warehouse_user_id, notes, status)
        VALUES (?, ?, ?, ?, ?, ?, 'pending_user')
      `).run(user_id, item_id, quantity, delivery_date, req.user.id, notes || '');

      notify(user_id, 'اقلام جدید در کارتکس', `اقلام جدیدی به کارتکس شما اضافه شده و منتظر تایید شماست`, '/inventory');

      res.json({ id: result.lastInsertRowid, message: 'اقلام به کارتکس اضافه شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id/confirm', (req, res) => {
    try {
      const cardex = db.prepare("SELECT * FROM cardex WHERE id = ? AND user_id = ? AND status = 'pending_user'").get(req.params.id, req.user.id);
      if (!cardex) return res.status(404).json({ error: 'آیتم یافت نشد یا قبلاً تایید شده' });

      db.prepare("UPDATE cardex SET status = 'confirmed', user_confirm_date = datetime('now') WHERE id = ?").run(req.params.id);
      res.json({ message: 'اقلام تایید شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id/reject', (req, res) => {
    try {
      const cardex = db.prepare("SELECT * FROM cardex WHERE id = ? AND user_id = ? AND status = 'pending_user'").get(req.params.id, req.user.id);
      if (!cardex) return res.status(404).json({ error: 'آیتم یافت نشد' });

      db.prepare("UPDATE cardex SET status = 'rejected' WHERE id = ?").run(req.params.id);
      res.json({ message: 'اقلام رد شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/user-cardex/:userId', warehouseGuard, (req, res) => {
    try {
      const cardex = db.prepare(`
        SELECT c.*, i.name as item_name, i.unit as item_unit, wu.full_name as warehouse_user_name
        FROM cardex c
        JOIN inventory_items i ON c.item_id = i.id
        JOIN users wu ON c.warehouse_user_id = wu.id
        WHERE c.user_id = ? AND c.status = 'confirmed'
        ORDER BY c.delivery_date DESC
      `).all(req.params.userId);
      res.json(cardex);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
