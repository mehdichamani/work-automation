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
    const allowedExts = [
      '.jpeg', '.jpg', '.png', '.gif', '.webp', '.bmp', '.svg', '.tiff',
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv',
      '.zip', '.rar', '.tar', '.gz', '.7z'
    ];
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml', 'image/tiff',
      'application/pdf', 
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain', 'text/csv',
      'application/zip', 'application/x-zip-compressed', 'application/x-rar-compressed', 'application/octet-stream',
      'application/x-tar', 'application/gzip', 'application/x-7z-compressed'
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    const isExtAllowed = allowedExts.includes(ext);
    const isMimeAllowed = allowedMimes.includes(file.mimetype.toLowerCase());
    
    if (isExtAllowed && isMimeAllowed) {
      cb(null, true);
    } else {
      cb(new Error('فرمت فایل پشتیبانی نمی‌شود'));
    }
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
    const userPerm = db.prepare('SELECT is_enabled FROM permissions WHERE user_id = ? AND module_key = ?').get(user.id, 'letters_central');
    if (userPerm !== null && userPerm !== undefined) {
      return userPerm.is_enabled === 1;
    }
    if (user.department_id) {
      const deptPerm = db.prepare('SELECT is_enabled FROM permissions WHERE department_id = ? AND user_id IS NULL AND module_key = ?').get(user.department_id, 'letters_central');
      if (deptPerm !== null && deptPerm !== undefined) {
        return deptPerm.is_enabled === 1;
      }
    }
    return false;
  }

  function getSantralUsers() {
    return db.prepare(`
      SELECT DISTINCT u.id FROM users u
      LEFT JOIN permissions p_user ON u.id = p_user.user_id AND p_user.module_key = 'letters_central'
      LEFT JOIN permissions p_dept ON u.department_id = p_dept.department_id AND p_dept.user_id IS NULL AND p_dept.module_key = 'letters_central'
      WHERE u.is_active = 1 AND (
        u.role = 'admin' OR
        p_user.is_enabled = 1 OR
        (p_user.id IS NULL AND p_dept.is_enabled = 1)
      )
    `).all();
  }

  function attachFiles(letters) {
    if (!letters || letters.length === 0) return [];
    const letterIds = letters.map(l => l.letter_id || l.id);
    const placeholders = letterIds.map(() => '?').join(',');
    const allAttachments = db.prepare(`SELECT * FROM letter_attachments WHERE letter_id IN (${placeholders})`).all(...letterIds);
    
    const attachmentsMap = {};
    for (const att of allAttachments) {
      if (!attachmentsMap[att.letter_id]) {
        attachmentsMap[att.letter_id] = [];
      }
      attachmentsMap[att.letter_id].push({
        name: att.file_name,
        path: att.file_path
      });
    }
    
    return letters.map(l => {
      const id = l.letter_id || l.id;
      const attachments = [...(attachmentsMap[id] || [])];
      if (l.attachment_name && l.attachment_path) {
        attachments.push({
          name: l.attachment_name,
          path: l.attachment_path
        });
      }
      return {
        ...l,
        attachments
      };
    });
  }

  function getNextLetterNumber() {
    const currentYear = moment().jYear();
    const result = db.prepare(`
      INSERT INTO letter_counter (year, last_number) VALUES (?, 1)
      ON CONFLICT (year) DO UPDATE SET last_number = letter_counter.last_number + 1
      RETURNING last_number
    `).get(currentYear);
    
    const paddedNum = String(result.last_number).padStart(3, '0');
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
  router.post('/', upload.array('attachments', 10), (req, res) => {
    try {
      const { subject, body, priority } = req.body;
      if (!subject) return res.status(400).json({ error: 'موضوع نامه الزامی است' });

      const letter_number = getNextLetterNumber();
      const senderUnitId = req.user.department_id || 1;

      const result = db.prepare(`
        INSERT INTO letters (letter_number, subject, body, sender_id, sender_unit_id, priority, status)
        VALUES (?, ?, ?, ?, ?, ?, 'pending_central')
      `).run(letter_number, subject, body || '', req.user.id, senderUnitId, priority || 'normal');

      const letterId = result.lastInsertRowid;

      if (req.files && req.files.length > 0) {
        const insAttachment = db.prepare('INSERT INTO letter_attachments (letter_id, file_name, file_path) VALUES (?, ?, ?)');
        for (const file of req.files) {
          const filePath = '/uploads/letters/' + file.filename;
          insAttachment.run(letterId, file.originalname, filePath);
        }
      }

      addHistory(letterId, req.user.id, req.user.full_name, 'created', 'ثبت نامه');

      getSantralUsers().forEach(u => {
        notify(u.id, 'نامه جدید', `نامه "${subject}" ثبت شده و منتظر بررسی است`, '/letters');
      });

      res.json({ id: letterId, letter_number, message: 'نامه ثبت شد' });
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
      res.json(attachFiles(letters));
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
      res.json(attachFiles(letterUnits));
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
      res.json(attachFiles(letters));
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
      res.json(attachFiles(letters));
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
      res.json(attachFiles(letters));
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
      res.json(attachFiles(letters));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/processed-manager', (req, res) => {
    try {
      const letters = db.prepare(`
        SELECT l.*, u.full_name as sender_name, d.name as sender_unit_name,
               m.full_name as manager_name
        FROM letters l
        JOIN users u ON l.sender_id = u.id
        LEFT JOIN departments d ON l.sender_unit_id = d.id
        LEFT JOIN users m ON l.selected_manager_id = m.id
        WHERE l.selected_manager_id = ? AND l.status IN ('approved', 'rejected', 'archived', 'forwarded')
        ORDER BY l.created_at DESC
      `).all(req.user.id);
      res.json(attachFiles(letters));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/all', (req, res) => {
    try {
      if (!isSantral(req.user)) return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
      const offset = (page - 1) * limit;
      const search = req.query.search || '';
      
      let whereClause = '';
      const params = [];
      if (search) {
        whereClause = ` WHERE (l.subject ILIKE $1 OR l.letter_number ILIKE $1)`;
        params.push(`%${search}%`);
      }
      
      const countResult = db.prepare(`SELECT COUNT(*) as total FROM letters l ${whereClause}`).get(...params);
      const total = countResult ? countResult.total : 0;
      
      const letters = db.prepare(`
        SELECT l.*, u.full_name as sender_name, d.name as sender_unit_name,
               m.full_name as manager_name
        FROM letters l
        JOIN users u ON l.sender_id = u.id
        LEFT JOIN departments d ON l.sender_unit_id = d.id
        LEFT JOIN users m ON l.selected_manager_id = m.id
        ${whereClause}
        ORDER BY l.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `).all(...params);
      res.json({ data: attachFiles(letters), total, page, limit });
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

      db.prepare("UPDATE letters SET status = 'pending_manager', selected_manager_id = ?, central_id = ?, central_date = datetime('now'), central_comment = ? WHERE id = ?")
        .run(manager_id, req.user.id, comment || '', req.params.id);

      addHistory(req.params.id, req.user.id, req.user.full_name, 'sent_to_manager', `ارسال به مدیر: ${manager?.full_name}${comment ? ` - توضیح: ${comment}` : ''}`);
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
      const allUserIds = [];
      
      const placeholders = unit_ids.map(() => '?').join(',');
      const depts = db.prepare(`SELECT id, name FROM departments WHERE id IN (${placeholders})`).all(...unit_ids);
      const deptMap = {};
      for (const d of depts) {
        deptMap[d.id] = d.name;
        deptNames.push(d.name);
      }
      
      for (const uid of unit_ids) {
        insertUnit.run(req.params.id, uid, 'pending');
      }
      
      const userPlaceholders = unit_ids.map(() => '?').join(',');
      const usersToNotify = db.prepare(`SELECT id, department_id FROM users WHERE department_id IN (${userPlaceholders}) AND is_active = 1`).all(...unit_ids);
      for (const u of usersToNotify) {
        notify(u.id, 'نامه ارجاعی', `نامه "${letter.subject}" به واحد شما ارجاع شده`, '/letters');
      }

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
