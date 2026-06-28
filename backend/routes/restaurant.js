const express = require('express');
const { authMiddleware, roleGuard } = require('../middleware/auth');
const moment = require('moment-jalaali');

module.exports = function(db) {
  const router = express.Router();
  router.use(authMiddleware);

  function getWeekDates() {
    const dates = [];
    const today = moment();
    for (let i = 0; i < 7; i++) {
      const d = today.clone().add(i, 'days');
      dates.push(d.format('jYYYY/jMM/jDD'));
    }
    return dates;
  }

  function canManageMenu(user) {
    if (user.role === 'admin') return true;
    if (user.role === 'supervisor') {
      const dept = db.prepare('SELECT name FROM departments WHERE id = ?').get(user.department_id);
      return dept && dept.name === 'رستوران';
    }
    return false;
  }

  router.get('/menu', (req, res) => {
    try {
      const weekDates = getWeekDates();
      const placeholders = weekDates.map(() => '?').join(',');
      const menu = db.prepare(`
        SELECT * FROM restaurant_menu 
        WHERE food_date IN (${placeholders}) AND is_active = 1
        ORDER BY food_date, option_number
      `).all(...weekDates);
      res.json(menu);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/menu-all', (req, res) => {
    try {
      if (!canManageMenu(req.user)) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      const menu = db.prepare('SELECT * FROM restaurant_menu ORDER BY food_date DESC, option_number').all();
      res.json(menu);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/menu', (req, res) => {
    try {
      if (!canManageMenu(req.user)) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      const { food_date, option_number, food_name, description, price } = req.body;
      if (!food_date || !option_number || !food_name) {
        return res.status(400).json({ error: 'تاریخ، شماره گزینه و نام غذا الزامی است' });
      }
      if (option_number < 1 || option_number > 2) {
        return res.status(400).json({ error: 'شماره گزینه باید ۱ یا ۲ باشد' });
      }
      const existing = db.prepare('SELECT id FROM restaurant_menu WHERE food_date = ? AND option_number = ? AND is_active = 1').get(food_date, option_number);
      if (existing) {
        return res.status(400).json({ error: 'این گزینه قبلاً برای این تاریخ ثبت شده است' });
      }
      const result = db.prepare('INSERT INTO restaurant_menu (food_date, option_number, food_name, description, price) VALUES (?, ?, ?, ?, ?)').run(food_date, option_number, food_name, description || '', price || 0);
      res.json({ id: result.lastInsertRowid, message: 'غذا به منو اضافه شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/menu-bulk', (req, res) => {
    try {
      if (!canManageMenu(req.user)) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      const { items } = req.body;
      let added = 0;
      for (const item of items) {
        if (!item.food_date || !item.option_number || !item.food_name) continue;
        if (item.option_number < 1 || item.option_number > 2) continue;
        const existing = db.prepare('SELECT id FROM restaurant_menu WHERE food_date = ? AND option_number = ? AND is_active = 1').get(item.food_date, item.option_number);
        if (existing) continue;
        db.prepare('INSERT INTO restaurant_menu (food_date, option_number, food_name, description, price) VALUES (?, ?, ?, ?, ?)').run(item.food_date, item.option_number, item.food_name, item.description || '', item.price || 0);
        added++;
      }
      res.json({ message: `${added} غذا به منو اضافه شد` });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/menu/:id', (req, res) => {
    try {
      if (!canManageMenu(req.user)) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      const { food_name, description, price, is_active } = req.body;
      db.prepare('UPDATE restaurant_menu SET food_name = ?, description = ?, price = ?, is_active = ? WHERE id = ?')
        .run(food_name, description || '', price || 0, is_active !== undefined ? is_active : 1, req.params.id);
      res.json({ message: 'منو ویرایش شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/menu/:id', (req, res) => {
    try {
      if (!canManageMenu(req.user)) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      const food = db.prepare('SELECT * FROM restaurant_menu WHERE id = ?').get(req.params.id);
      if (!food) return res.status(404).json({ error: 'غذا یافت نشد' });
      db.prepare("UPDATE restaurant_reservations SET status = 'cancelled' WHERE food_id = ? AND status = 'active'").run(req.params.id);
      db.prepare('DELETE FROM restaurant_menu WHERE id = ?').run(req.params.id);
      res.json({ message: 'غذا حذف شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/reserve', (req, res) => {
    try {
      const { food_id, quantity, notes } = req.body;
      if (!food_id) {
        return res.status(400).json({ error: 'انتخاب غذا الزامی است' });
      }

      const food = db.prepare('SELECT * FROM restaurant_menu WHERE id = ? AND is_active = 1').get(food_id);
      if (!food) {
        return res.status(404).json({ error: 'غذا یافت نشد' });
      }

      const todayJalali = moment().format('jYYYY/jMM/jDD');
      if (food.food_date < todayJalali) {
        return res.status(400).json({ error: 'امکان رزرو غذای گذشته وجود ندارد' });
      }

      const foodMoment = moment(food.food_date, 'jYYYY/jMM/jDD');
      const hoursUntil = Math.floor((foodMoment.toDate().getTime() - moment().toDate().getTime()) / (1000 * 60 * 60));
      if (hoursUntil < 24) {
        return res.status(400).json({ error: 'رزرو غذا کمتر از ۲۴ ساعت قبل امکان‌پذیر نیست' });
      }

      const weekEnd = moment().add(6, 'days').format('jYYYY/jMM/jDD');
      if (food.food_date > weekEnd) {
        return res.status(400).json({ error: 'فقط تا یک هفته آینده امکان رزرو دارید' });
      }

      const existing = db.prepare("SELECT r.id FROM restaurant_reservations r WHERE r.user_id = ? AND r.food_id = ? AND r.status = 'active'").get(req.user.id, food_id);
      if (existing) {
        return res.status(400).json({ error: 'شما قبلاً این غذا را رزرو کرده‌اید' });
      }

      const sameDayReservation = db.prepare("SELECT r.id FROM restaurant_reservations r JOIN restaurant_menu rm ON r.food_id = rm.id WHERE r.user_id = ? AND rm.food_date = ? AND r.status = 'active'").get(req.user.id, food.food_date);
      if (sameDayReservation) {
        return res.status(400).json({ error: 'شما قبلاً برای این روز غذا رزرو کرده‌اید' });
      }

      const result = db.prepare(`
        INSERT INTO restaurant_reservations (user_id, food_id, food_date, quantity, notes)
        VALUES (?, ?, ?, ?, ?)
      `).run(req.user.id, food_id, food.food_date, quantity || 1, notes || '');

      res.json({ id: result.lastInsertRowid, message: 'غذا رزرو شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/my-reservations', (req, res) => {
    try {
      const reservations = db.prepare(`
        SELECT r.*, rm.food_name, rm.description as food_description, rm.option_number, rm.food_date
        FROM restaurant_reservations r
        JOIN restaurant_menu rm ON r.food_id = rm.id
        WHERE r.user_id = ?
        ORDER BY r.food_date DESC
      `).all(req.user.id);

      const now = moment();
      const result = reservations.map(r => {
        const foodMoment = moment(r.food_date, 'jYYYY/jMM/jDD');
        const hoursLeft = foodMoment.toDate().getTime() - now.toDate().getTime();
        const hours = Math.floor(hoursLeft / (1000 * 60 * 60));
        return { ...r, can_cancel: r.status === 'active' && hours >= 24 };
      });

      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/cancel/:id', (req, res) => {
    try {
      const reservation = db.prepare("SELECT r.*, rm.food_date FROM restaurant_reservations r JOIN restaurant_menu rm ON r.food_id = rm.id WHERE r.id = ? AND r.user_id = ? AND r.status = 'active'").get(req.params.id, req.user.id);
      if (!reservation) {
        return res.status(404).json({ error: 'رزرو یافت نشد' });
      }

      const now = moment();
      const foodMoment = moment(reservation.food_date, 'jYYYY/jMM/jDD');
      const hoursLeft = foodMoment.toDate().getTime() - now.toDate().getTime();
      const hours = Math.floor(hoursLeft / (1000 * 60 * 60));
      if (hours < 24 && req.user.role !== 'admin') {
        return res.status(400).json({ error: 'امکان لغو رزرو کمتر از ۲۴ ساعت قبل از وعده غذا وجود ندارد' });
      }

      db.prepare("UPDATE restaurant_reservations SET status = 'cancelled' WHERE id = ?").run(req.params.id);
      res.json({ message: 'رزرو لغو شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/monitoring', (req, res) => {
    try {
      if (!canManageMenu(req.user)) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      const weekDates = getWeekDates();
      const placeholders = weekDates.map(() => '?').join(',');

      const dailyCounts = db.prepare(`
        SELECT r.food_date, rm.food_name, rm.option_number, COUNT(*) as reservation_count, SUM(r.quantity) as total_quantity
        FROM restaurant_reservations r
        JOIN restaurant_menu rm ON r.food_id = rm.id
        WHERE r.food_date IN (${placeholders}) AND r.status = 'active'
        GROUP BY r.food_date, rm.food_name
        ORDER BY r.food_date, rm.option_number
      `).all(...weekDates);

      const totalCounts = db.prepare(`
        SELECT r.food_date, COUNT(*) as total_reservations, SUM(r.quantity) as total_meals
        FROM restaurant_reservations r
        WHERE r.food_date IN (${placeholders}) AND r.status = 'active'
        GROUP BY r.food_date
        ORDER BY r.food_date
      `).all(...weekDates);

      res.json({ dailyCounts, totalCounts });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/monitoring-detailed', (req, res) => {
    try {
      if (!canManageMenu(req.user)) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      const weekDates = getWeekDates();
      const placeholders = weekDates.map(() => '?').join(',');

      const reservations = db.prepare(`
        SELECT r.*, rm.food_name, rm.description as food_description, rm.option_number,
               u.full_name as user_name, d.name as user_dept
        FROM restaurant_reservations r
        JOIN restaurant_menu rm ON r.food_id = rm.id
        JOIN users u ON r.user_id = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE r.food_date IN (${placeholders}) AND r.status = 'active'
        ORDER BY r.food_date, rm.option_number
      `).all(...weekDates);

      res.json(reservations);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
