const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const moment = require('moment-jalaali');
const { authMiddleware } = require('../middleware/auth');

const uploadDir = path.join(__dirname, '..', 'uploads', 'letters');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, unique + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt|zip|rar/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext || mime) cb(null, true);
    else cb(new Error('فرمت فایل پشتیبانی نمی‌شود'));
  }
});

module.exports = function(db) {
  const router = express.Router();
  router.use(authMiddleware);

  function notify(userId, title, body, link) {
    db.prepare('INSERT INTO notifications (user_id, title, body, link) VALUES (?, ?, ?, ?)').run(userId, title, body, link);
  }

  function addHistory(letterId, userId, userName, action, comment) {
    db.prepare('INSERT INTO letter_history (letter_id, user_id, user_name, action, comment) VALUES (?, ?, ?, ?, ?)')
      .run(letterId, userId, userName, action, comment || '');
  }

  function isSantral(user) {
    if (user.role === 'admin') return true;
    const dept = db.prepare('SELECT name FROM departments WHERE id = ?').get(user.department_id);
    return dept && dept.name.includes('سانترال');
  }

  function getSantralUsers() {
    return db.prepare(`
      SELECT u.id FROM users u
      JOIN departments d ON u.department_id = d.id
      WHERE d.name LIKE '%سانترال%' AND u.is_active = 1
    `).all();
  }

  function getNextLetterNumber() {
    const currentYear = moment().jYear();
    const counter = db.prepare('SELECT * FROM letter_counter WHERE year = ?').get(currentYear);
    
    if (!counter) {
      db.prepare('INSERT INTO letter_counter (year, last_number) VALUES (?, 1)').run(currentYear);
      return `${currentYear}/001`;
    }
    
    const nextNum = counter.last_number + 1;
    db.prepare('UPDATE letter_counter SET last_number = ? WHERE year = ?').run(nextNum, currentYear);
    
    const paddedNum = String(nextNum).padStart(3, '0');
    return `${currentYear}/${paddedNum}`;
  }

  function peekNextLetterNumber() {
    const currentYear = moment().jYear();
    const counter = db.prepare('SELECT * FROM letter_counter WHERE year = ?').get(currentYear);
    
    const nextNum = counter ? counter.last_number + 1 : 1;
    const paddedNum = String(nextNum).padStart(3, '0');
    return `${currentYear}/${paddedNum}`;
  }

  // ============================================================
  // ایجاد نامه جدید
  // ============================================================
  router.post('/', upload.single('attachment'), (req, res) => {
    try {
      const { subject, body, priority } = req.body;
      if (!subject) return res.status(400).json({ error: 'موضوع نامه الزامی است' });

      const letter_number = getNextLetterNumber();
      const senderUnitId = req.user.department_id || 1;
      const attachmentName = req.file ? req.file.originalname : null;
      const attachmentPath = req.file ? '/uploads/letters/' + req.file.filename : null;

      const result = db.prepare(`
        INSERT INTO letters (letter_number, subject, body, sender_id, sender_unit_id, priority, status, attachment_name, attachment_path)
        VALUES (?, ?, ?, ?, ?, ?, 'pending_central', ?, ?)
      `).run(letter_number, subject, body || '', req.user.id, senderUnitId, priority || 'normal', attachmentName, attachmentPath);

      addHistory(result.lastInsertRowid || result.lastInsertRowid, req.user.id, req.user.full_name, 'created', 'ثبت نامه');

      getSantralUsers().forEach(u => {
        notify(u.id, 'نامه جدید', `نامه "${subject}" ثبت شده و منتظر بررسی است`, '/letters');
      });

      res.json({ id: result.lastInsertRowid, letter_number, message: 'نامه ثبت شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ============================================================
  // GET routes (static paths first, then parameterized)
  // ============================================================

  router.get('/managers', (req, res) => {
    try {
      const managers = db.prepare("SELECT id, full_name FROM users WHERE role = 'manager' AND is_active = 1").all();
      res.json(managers);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/next-number', (req, res) => {
    try {
      const nextNumber = peekNextLetterNumber();
      res.json({ next_number: nextNumber });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/my-letters', (req, res) => {
    try {
      const letters = db.prepare(`
        SELECT l.*, u.full_name as sender_name, d.name as sender_unit_name,
               m.full_name as manager_name
        FROM letters l
        JOIN users u ON l.sender_id = u.id
        LEFT JOIN departments d ON l.sender_unit_id = d.id
        LEFT JOIN users m ON l.selected_manager_id = m.id
        WHERE l.sender_id = ?
        ORDER BY l.created_at DESC
      `).all(req.user.id);
      res.json(letters);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/my-unit', (req, res) => {
    try {
      const letterUnits = db.prepare(`
        SELECT lu.*, l.subject, l.letter_number, l.priority, l.body, l.attachment_name, l.attachment_path, l.status as letter_status,
               u.full_name as sender_name, d.name as sender_unit_name
        FROM letter_units lu
        JOIN letters l ON lu.letter_id = l.id
        JOIN users u ON l.sender_id = u.id
        LEFT JOIN departments d ON l.sender_unit_id = d.id
        WHERE lu.unit_id = ?
        ORDER BY lu.id DESC
      `).all(req.user.department_id);
      res.json(letterUnits);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/pending-central', (req, res) => {
    try {
      if (!isSantral(req.user)) return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      const letters = db.prepare(`
        SELECT l.*, u.full_name as sender_name, d.name as sender_unit_name
        FROM letters l
        JOIN users u ON l.sender_id = u.id
        LEFT JOIN departments d ON l.sender_unit_id = d.id
        WHERE l.status = 'pending_central'
        ORDER BY l.created_at DESC
      `).all();
      res.json(letters);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/returned-central', (req, res) => {
    try {
      if (!isSantral(req.user)) return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      const letters = db.prepare(`
        SELECT l.*, u.full_name as sender_name, d.name as sender_unit_name,
               m.full_name as manager_name
        FROM letters l
        JOIN users u ON l.sender_id = u.id
        LEFT JOIN departments d ON l.sender_unit_id = d.id
        LEFT JOIN users m ON l.selected_manager_id = m.id
        WHERE l.status IN ('approved', 'rejected')
        ORDER BY l.created_at DESC
      `).all();
      res.json(letters);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/archived', (req, res) => {
    try {
      if (!isSantral(req.user)) return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      const letters = db.prepare(`
        SELECT l.*, u.full_name as sender_name, d.name as sender_unit_name,
               m.full_name as manager_name
        FROM letters l
        JOIN users u ON l.sender_id = u.id
        LEFT JOIN departments d ON l.sender_unit_id = d.id
        LEFT JOIN users m ON l.selected_manager_id = m.id
        WHERE l.status IN ('archived', 'forwarded')
        ORDER BY l.created_at DESC
      `).all();
      res.json(letters);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/pending-manager', (req, res) => {
    try {
      const letters = db.prepare(`
        SELECT l.*, u.full_name as sender_name, d.name as sender_unit_name,
               m.full_name as manager_name
        FROM letters l
        JOIN users u ON l.sender_id = u.id
        LEFT JOIN departments d ON l.sender_unit_id = d.id
        LEFT JOIN users m ON l.selected_manager_id = m.id
        WHERE l.status = 'pending_manager' AND l.selected_manager_id = ?
        ORDER BY l.created_at DESC
      `).all(req.user.id);
      res.json(letters);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/all', (req, res) => {
    try {
      if (!isSantral(req.user)) return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      const letters = db.prepare(`
        SELECT l.*, u.full_name as sender_name, d.name as sender_unit_name,
               m.full_name as manager_name
        FROM letters l
        JOIN users u ON l.sender_id = u.id
        LEFT JOIN departments d ON l.sender_unit_id = d.id
        LEFT JOIN users m ON l.selected_manager_id = m.id
        ORDER BY l.created_at DESC
      `).all();
      res.json(letters);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ============================================================
  // PUT routes
  // ============================================================

  router.put('/:id/send-to-manager', (req, res) => {
    try {
      if (!isSantral(req.user)) return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      const { manager_id, comment } = req.body;
      if (!manager_id) return res.status(400).json({ error: 'انتخاب مدیر الزامی است' });

      const letter = db.prepare("SELECT * FROM letters WHERE id = ? AND status = 'pending_central'").get(req.params.id);
      if (!letter) return res.status(404).json({ error: 'نامه یافت نشد' });

      const manager = db.prepare('SELECT full_name FROM users WHERE id = ?').get(manager_id);

      db.prepare("UPDATE letters SET status = 'pending_manager', selected_manager_id = ?, central_id = ?, central_date = datetime('now') WHERE id = ?")
        .run(manager_id, req.user.id, req.params.id);

      addHistory(req.params.id, req.user.id, req.user.full_name, 'sent_to_manager', `ارسال به مدیر: ${manager?.full_name}`);
      notify(manager_id, 'نامه جدید', `نامه "${letter.subject}" برای شما ارسال شده`, '/letters');

      res.json({ message: 'نامه به مدیر ارسال شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id/approve', (req, res) => {
    try {
      const { comment } = req.body;
      const letter = db.prepare("SELECT * FROM letters WHERE id = ? AND status = 'pending_manager' AND selected_manager_id = ?").get(req.params.id, req.user.id);
      if (!letter) return res.status(404).json({ error: 'نامه یافت نشد' });

      db.prepare("UPDATE letters SET status = 'approved', manager_id = ?, manager_comment = ?, manager_date = datetime('now') WHERE id = ?")
        .run(req.user.id, comment || '', req.params.id);

      addHistory(req.params.id, req.user.id, req.user.full_name, 'approved', comment || 'تایید شده');

      const sender = db.prepare('SELECT id, full_name FROM users WHERE id = ?').get(letter.sender_id);
      if (sender) notify(sender.id, 'تایید نامه', `نامه "${letter.subject}" تایید شد`, '/letters');
      getSantralUsers().forEach(u => notify(u.id, 'نامه تایید شده', `نامه "${letter.subject}" تایید شده`, '/letters'));

      res.json({ message: 'تایید شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id/reject', (req, res) => {
    try {
      const { comment } = req.body;
      const letter = db.prepare("SELECT * FROM letters WHERE id = ? AND status = 'pending_manager' AND selected_manager_id = ?").get(req.params.id, req.user.id);
      if (!letter) return res.status(404).json({ error: 'نامه یافت نشد' });

      db.prepare("UPDATE letters SET status = 'rejected', manager_id = ?, manager_comment = ?, manager_date = datetime('now') WHERE id = ?")
        .run(req.user.id, comment || 'رد شده', req.params.id);

      addHistory(req.params.id, req.user.id, req.user.full_name, 'rejected', comment || 'رد شده');

      const sender = db.prepare('SELECT id, full_name FROM users WHERE id = ?').get(letter.sender_id);
      if (sender) notify(sender.id, 'رد نامه', `نامه "${letter.subject}" رد شد`, '/letters');
      getSantralUsers().forEach(u => notify(u.id, 'نامه رد شده', `نامه "${letter.subject}" رد شده`, '/letters'));

      res.json({ message: 'رد شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id/archive', (req, res) => {
    try {
      if (!isSantral(req.user)) return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      const letter = db.prepare("SELECT * FROM letters WHERE id = ? AND status = 'approved'").get(req.params.id);
      if (!letter) return res.status(404).json({ error: 'نامه یافت نشد' });

      db.prepare("UPDATE letters SET status = 'archived' WHERE id = ?").run(req.params.id);
      addHistory(req.params.id, req.user.id, req.user.full_name, 'archived', 'بایگانی شد');

      const sender = db.prepare('SELECT id, full_name FROM users WHERE id = ?').get(letter.sender_id);
      if (sender) notify(sender.id, 'بایگانی نامه', `نامه "${letter.subject}" بایگانی شد`, '/letters');

      res.json({ message: 'بایگانی شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id/forward', (req, res) => {
    try {
      if (!isSantral(req.user)) return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      const { unit_ids } = req.body;
      if (!unit_ids || unit_ids.length === 0) return res.status(400).json({ error: 'انتخاب حداقل یک واحد الزامی است' });

      const letter = db.prepare("SELECT * FROM letters WHERE id = ?").get(req.params.id);
      if (!letter) return res.status(404).json({ error: 'نامه یافت نشد' });

      db.prepare("UPDATE letters SET status = 'forwarded' WHERE id = ?").run(req.params.id);

      const insertUnit = db.prepare('INSERT INTO letter_units (letter_id, unit_id, status) VALUES (?, ?, ?)');
      const deptNames = [];
      unit_ids.forEach(uid => {
        insertUnit.run(req.params.id, uid, 'pending');
        const dept = db.prepare('SELECT name FROM departments WHERE id = ?').get(uid);
        if (dept) deptNames.push(dept.name);
        db.prepare("SELECT id FROM users WHERE department_id = ? AND is_active = 1").all(uid).forEach(u => {
          notify(u.id, 'نامه ارجاعی', `نامه "${letter.subject}" به واحد شما ارجاع شده`, '/letters');
        });
      });

      addHistory(req.params.id, req.user.id, req.user.full_name, 'forwarded', `ارجاع: ${deptNames.join('، ')}`);

      const sender = db.prepare('SELECT id, full_name FROM users WHERE id = ?').get(letter.sender_id);
      if (sender) notify(sender.id, 'ارجاع نامه', `نامه "${letter.subject}" ارجاع شد`, '/letters');

      res.json({ message: 'ارجاع شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id/seen-unit', (req, res) => {
    try {
      const lu = db.prepare("SELECT * FROM letter_units WHERE letter_id = ? AND unit_id = ? AND status = 'pending'").get(req.params.id, req.user.department_id);
      if (!lu) return res.status(404).json({ error: 'نامه یافت نشد' });

      db.prepare("UPDATE letter_units SET status = 'seen', seen_date = datetime('now') WHERE id = ?").run(lu.id);
      addHistory(req.params.id, req.user.id, req.user.full_name, 'seen_unit', 'رویت شده');
      res.json({ message: 'رویت شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ============================================================
  // GET parameterized (MUST be after static GETs)
  // ============================================================

  router.get('/:id/history', (req, res) => {
    try {
      const history = db.prepare('SELECT * FROM letter_history WHERE letter_id = ? ORDER BY created_at ASC').all(req.params.id);
      res.json(history);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
