const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const moment = require('moment-jalaali');
const { authMiddleware } = require('../middleware/auth');
const { letters } = require('../middleware/validate');
const prisma = require('../database/prisma');
const { mapRow, flattenJoins } = require('../utils/dbAdapter');

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

function getNowString() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

module.exports = function() {
  const router = express.Router();
  router.use(authMiddleware);

  async function notify(userId, title, body, link) {
    await prisma.notification.create({ data: { userId: Number(userId), title, body, link } });
  }

  async function addHistory(letterId, userId, userName, action, comment) {
    await prisma.letterHistory.create({
      data: { letterId: Number(letterId), userId: Number(userId), userName, action, comment: comment || '' },
    });
  }

  async function isSantral(user) {
    if (user.role === 'admin') return true;
    const userPerm = await prisma.permission.findFirst({ where: { userId: Number(user.id), moduleKey: 'letters_central' } });
    if (userPerm !== null && userPerm !== undefined) {
      return userPerm.isEnabled === true;
    }
    if (user.department_id) {
      const deptPerm = await prisma.permission.findFirst({ where: { departmentId: Number(user.department_id), userId: null, moduleKey: 'letters_central' } });
      if (deptPerm !== null && deptPerm !== undefined) {
        return deptPerm.isEnabled === true;
      }
    }
    return false;
  }

  async function getSantralUsers() {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, role: true, departmentId: true },
    });
    const perms = await prisma.permission.findMany({
      where: { moduleKey: 'letters_central' },
      select: { userId: true, departmentId: true, isEnabled: true },
    });
    const result = [];
    for (const u of users) {
      let ok = u.role === 'admin';
      if (!ok) {
        const userPerms = perms.filter(p => p.userId === u.id);
        if (userPerms.length > 0) {
          ok = userPerms.some(p => p.isEnabled);
        } else {
          const deptPerm = perms.find(p => p.userId === null && p.departmentId === u.departmentId);
          if (deptPerm) ok = deptPerm.isEnabled;
        }
      }
      if (ok) result.push({ id: u.id });
    }
    return result;
  }

  async function attachFiles(letters) {
    if (!letters || letters.length === 0) return [];
    const letterIds = letters.map(l => l.letter_id || l.id).filter(Boolean);
    const allAttachments = letterIds.length > 0
      ? await prisma.letterAttachment.findMany({ where: { letterId: { in: letterIds } } })
      : [];

    const attachmentsMap = {};
    for (const att of allAttachments) {
      if (!attachmentsMap[att.letterId]) {
        attachmentsMap[att.letterId] = [];
      }
      attachmentsMap[att.letterId].push({
        name: att.fileName,
        path: att.filePath
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

  async function getNextLetterNumber() {
    const currentYear = moment().jYear();
    return prisma.$transaction(async (tx) => {
      const counter = await tx.letterCounter.findUnique({ where: { year: currentYear } });
      let lastNumber;
      if (counter) {
        lastNumber = counter.lastNumber + 1;
        await tx.letterCounter.update({ where: { id: counter.id }, data: { lastNumber } });
      } else {
        lastNumber = 1;
        await tx.letterCounter.create({ data: { year: currentYear, lastNumber } });
      }
      const paddedNum = String(lastNumber).padStart(3, '0');
      return `${currentYear}/${paddedNum}`;
    });
  }

  async function peekNextLetterNumber() {
    const currentYear = moment().jYear();
    const counter = await prisma.letterCounter.findUnique({ where: { year: currentYear } });

    const nextNum = counter ? counter.lastNumber + 1 : 1;
    const paddedNum = String(nextNum).padStart(3, '0');
    return `${currentYear}/${paddedNum}`;
  }

  function flattenLetterList(rows, withManager) {
    const aliases = {
      sender_name: 'sender.fullName',
      sender_unit_name: 'senderUnit.name',
    };
    if (withManager) aliases.manager_name = 'selectedManager.fullName';
    return rows.map(r => flattenJoins(r, aliases));
  }

  // ============================================================
  // ایجاد نامه جدید
  // ============================================================
  router.post('/', upload.array('attachments', 10), (req, res, next) => {
    // Check if body parameter is parsed but express-validator needs a custom validation
    // Since we upload using multer, body is populated inside multer.
    // Let's validate subject and other values using express-validator array.
    next();
  }, letters, async (req, res) => {
    try {
      const { subject, body, priority } = req.body;
      const letter_number = await getNextLetterNumber();
      const senderUnitId = req.user.department_id || 1;

      const letter = await prisma.$transaction(async (tx) => {
        const created = await tx.letter.create({
          data: {
            letterNumber: letter_number,
            subject,
            body: body || '',
            senderId: Number(req.user.id),
            senderUnitId: Number(senderUnitId),
            priority: priority || 'normal',
            status: 'pending_central',
          },
        });

        if (req.files && req.files.length > 0) {
          for (const file of req.files) {
            const filePath = '/uploads/letters/' + file.filename;
            await tx.letterAttachment.create({
              data: { letterId: created.id, fileName: file.originalname, filePath },
            });
          }
        }

        await tx.letterHistory.create({
          data: { letterId: created.id, userId: Number(req.user.id), userName: req.user.full_name, action: 'created', comment: 'ثبت نامه' },
        });

        return created;
      });

      const santralUsers = await getSantralUsers();
      for (const u of santralUsers) {
        await notify(u.id, 'نامه جدید', `نامه "${subject}" ثبت شده و منتظر بررسی است`, '/letters');
      }

      res.json({ id: letter.id, letter_number, message: 'نامه ثبت شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ============================================================
  // GET routes (static paths first, then parameterized)
  // ============================================================

  router.get('/managers', async (req, res) => {
    try {
      const managers = await prisma.user.findMany({
        where: { role: 'manager', isActive: true },
        select: { id: true, fullName: true },
      });
      res.json(mapRow(managers));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/next-number', async (req, res) => {
    try {
      const nextNumber = await peekNextLetterNumber();
      res.json({ next_number: nextNumber });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/my-letters', async (req, res) => {
    try {
      const letters = await prisma.letter.findMany({
        where: { senderId: Number(req.user.id) },
        orderBy: { createdAt: 'desc' },
        include: {
          sender: { select: { fullName: true } },
          senderUnit: { select: { name: true } },
          selectedManager: { select: { fullName: true } },
        },
      });
      const mapped = mapRow(flattenLetterList(letters, true));
      res.json(await attachFiles(mapped));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/my-unit', async (req, res) => {
    try {
      const letterUnits = await prisma.letterUnit.findMany({
        where: { unitId: Number(req.user.department_id) },
        orderBy: { id: 'desc' },
        include: {
          letter: {
            select: {
              subject: true,
              letterNumber: true,
              priority: true,
              body: true,
              attachmentName: true,
              attachmentPath: true,
              status: true,
              sender: { select: { fullName: true } },
              senderUnit: { select: { name: true } },
            },
          },
        },
      });
      const mapped = mapRow(letterUnits.map(r => flattenJoins(r, {
        subject: 'letter.subject',
        letter_number: 'letter.letterNumber',
        priority: 'letter.priority',
        body: 'letter.body',
        attachment_name: 'letter.attachmentName',
        attachment_path: 'letter.attachmentPath',
        letter_status: 'letter.status',
        sender_name: 'letter.sender.fullName',
        sender_unit_name: 'letter.senderUnit.name',
      })));
      res.json(await attachFiles(mapped));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/pending-central', async (req, res) => {
    try {
      if (!(await isSantral(req.user))) return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      const letters = await prisma.letter.findMany({
        where: { status: 'pending_central' },
        orderBy: { createdAt: 'desc' },
        include: {
          sender: { select: { fullName: true } },
          senderUnit: { select: { name: true } },
        },
      });
      const mapped = mapRow(flattenLetterList(letters, false));
      res.json(await attachFiles(mapped));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/returned-central', async (req, res) => {
    try {
      if (!(await isSantral(req.user))) return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      const letters = await prisma.letter.findMany({
        where: { status: { in: ['approved', 'rejected'] } },
        orderBy: { createdAt: 'desc' },
        include: {
          sender: { select: { fullName: true } },
          senderUnit: { select: { name: true } },
          selectedManager: { select: { fullName: true } },
        },
      });
      const mapped = mapRow(flattenLetterList(letters, true));
      res.json(await attachFiles(mapped));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/archived', async (req, res) => {
    try {
      if (!(await isSantral(req.user))) return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      const letters = await prisma.letter.findMany({
        where: { status: { in: ['archived', 'forwarded'] } },
        orderBy: { createdAt: 'desc' },
        include: {
          sender: { select: { fullName: true } },
          senderUnit: { select: { name: true } },
          selectedManager: { select: { fullName: true } },
        },
      });
      const mapped = mapRow(flattenLetterList(letters, true));
      res.json(await attachFiles(mapped));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/pending-manager', async (req, res) => {
    try {
      const letters = await prisma.letter.findMany({
        where: { status: 'pending_manager', selectedManagerId: Number(req.user.id) },
        orderBy: { createdAt: 'desc' },
        include: {
          sender: { select: { fullName: true } },
          senderUnit: { select: { name: true } },
          selectedManager: { select: { fullName: true } },
        },
      });
      const mapped = mapRow(flattenLetterList(letters, true));
      res.json(await attachFiles(mapped));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/processed-manager', async (req, res) => {
    try {
      const letters = await prisma.letter.findMany({
        where: {
          selectedManagerId: Number(req.user.id),
          status: { in: ['approved', 'rejected', 'archived', 'forwarded'] },
        },
        orderBy: { createdAt: 'desc' },
        include: {
          sender: { select: { fullName: true } },
          senderUnit: { select: { name: true } },
          selectedManager: { select: { fullName: true } },
        },
      });
      const mapped = mapRow(flattenLetterList(letters, true));
      res.json(await attachFiles(mapped));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/all', async (req, res) => {
    try {
      if (!(await isSantral(req.user))) return res.status(403).json({ error: 'دسترسی غیرمجاز' });

      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
      const offset = (page - 1) * limit;
      const search = req.query.search || '';

      const where = search
        ? {
            OR: [
              { subject: { contains: search, mode: 'insensitive' } },
              { letterNumber: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {};

      const total = await prisma.letter.count({ where });

      const letters = await prisma.letter.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          sender: { select: { fullName: true } },
          senderUnit: { select: { name: true } },
          selectedManager: { select: { fullName: true } },
        },
      });
      const mapped = mapRow(flattenLetterList(letters, true));
      res.json({ data: await attachFiles(mapped), total, page, limit });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ============================================================
  // PUT routes
  // ============================================================

  router.put('/:id/send-to-manager', async (req, res) => {
    try {
      if (!(await isSantral(req.user))) return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      const { manager_id, comment } = req.body;
      if (!manager_id) return res.status(400).json({ error: 'انتخاب مدیر الزامی است' });

      const letterId = Number(req.params.id);
      if (isNaN(letterId)) {
        return res.status(400).json({ error: 'شناسه نامعتبر است' });
      }

      const letter = await prisma.letter.findFirst({ where: { id: letterId, status: 'pending_central' } });
      if (!letter) return res.status(404).json({ error: 'نامه یافت نشد' });

      const manager = await prisma.user.findUnique({ where: { id: Number(manager_id) }, select: { fullName: true } });

      await prisma.letter.update({
        where: { id: letterId },
        data: {
          status: 'pending_manager',
          selectedManagerId: Number(manager_id),
          centralId: Number(req.user.id),
          centralDate: getNowString(),
          centralComment: comment || '',
        },
      });

      await addHistory(letterId, req.user.id, req.user.full_name, 'sent_to_manager', `ارسال به مدیر: ${manager?.fullName}${comment ? ` - توضیح: ${comment}` : ''}`);
      await notify(manager_id, 'نامه جدید', `نامه "${letter.subject}" برای شما ارسال شده`, '/letters');

      res.json({ message: 'نامه به مدیر ارسال شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id/approve', async (req, res) => {
    try {
      const { comment } = req.body;
      const letterId = Number(req.params.id);
      if (isNaN(letterId)) {
        return res.status(400).json({ error: 'شناسه نامعتبر است' });
      }
      const letter = await prisma.letter.findFirst({
        where: { id: letterId, status: 'pending_manager', selectedManagerId: Number(req.user.id) },
      });
      if (!letter) return res.status(404).json({ error: 'نامه یافت نشد' });

      await prisma.letter.update({
        where: { id: letterId },
        data: {
          status: 'approved',
          managerId: Number(req.user.id),
          managerComment: comment || '',
          managerDate: getNowString(),
        },
      });

      await addHistory(letterId, req.user.id, req.user.full_name, 'approved', comment || 'تایید شده');

      const sender = await prisma.user.findUnique({ where: { id: letter.senderId }, select: { id: true, fullName: true } });
      if (sender) await notify(sender.id, 'تایید نامه', `نامه "${letter.subject}" تایید شد`, '/letters');
      const santralUsers = await getSantralUsers();
      for (const u of santralUsers) await notify(u.id, 'نامه تایید شده', `نامه "${letter.subject}" تایید شده`, '/letters');

      res.json({ message: 'تایید شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id/reject', async (req, res) => {
    try {
      const { comment } = req.body;
      const letterId = Number(req.params.id);
      if (isNaN(letterId)) {
        return res.status(400).json({ error: 'شناسه نامعتبر است' });
      }
      const letter = await prisma.letter.findFirst({
        where: { id: letterId, status: 'pending_manager', selectedManagerId: Number(req.user.id) },
      });
      if (!letter) return res.status(404).json({ error: 'نامه یافت نشد' });

      await prisma.letter.update({
        where: { id: letterId },
        data: {
          status: 'rejected',
          managerId: Number(req.user.id),
          managerComment: comment || 'رد شده',
          managerDate: getNowString(),
        },
      });

      await addHistory(letterId, req.user.id, req.user.full_name, 'rejected', comment || 'رد شده');

      const sender = await prisma.user.findUnique({ where: { id: letter.senderId }, select: { id: true, fullName: true } });
      if (sender) await notify(sender.id, 'رد نامه', `نامه "${letter.subject}" رد شد`, '/letters');
      const santralUsers = await getSantralUsers();
      for (const u of santralUsers) await notify(u.id, 'نامه رد شده', `نامه "${letter.subject}" رد شده`, '/letters');

      res.json({ message: 'رد شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id/archive', async (req, res) => {
    try {
      if (!(await isSantral(req.user))) return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      const letterId = Number(req.params.id);
      if (isNaN(letterId)) {
        return res.status(400).json({ error: 'شناسه نامعتبر است' });
      }
      const letter = await prisma.letter.findFirst({ where: { id: letterId, status: 'approved' } });
      if (!letter) return res.status(404).json({ error: 'نامه یافت نشد' });

      await prisma.letter.update({ where: { id: letterId }, data: { status: 'archived' } });
      await addHistory(letterId, req.user.id, req.user.full_name, 'archived', 'بایگانی شد');

      const sender = await prisma.user.findUnique({ where: { id: letter.senderId }, select: { id: true, fullName: true } });
      if (sender) await notify(sender.id, 'بایگانی نامه', `نامه "${letter.subject}" بایگانی شد`, '/letters');

      res.json({ message: 'بایگانی شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id/forward', async (req, res) => {
    try {
      if (!(await isSantral(req.user))) return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      const { unit_ids } = req.body;
      if (!unit_ids || unit_ids.length === 0) return res.status(400).json({ error: 'انتخاب حداقل یک واحد الزامی است' });

      const letterId = Number(req.params.id);
      if (isNaN(letterId)) {
        return res.status(400).json({ error: 'شناسه نامعتبر است' });
      }
      const letter = await prisma.letter.findUnique({ where: { id: letterId } });
      if (!letter) return res.status(404).json({ error: 'نامه یافت نشد' });

      await prisma.letter.update({ where: { id: letterId }, data: { status: 'forwarded' } });

      const deptNames = [];
      const depts = await prisma.department.findMany({
        where: { id: { in: unit_ids.map(Number) } },
        select: { id: true, name: true },
      });
      const deptMap = {};
      for (const d of depts) {
        deptMap[d.id] = d.name;
        deptNames.push(d.name);
      }

      for (const uid of unit_ids) {
        await prisma.letterUnit.create({
          data: { letterId: letterId, unitId: Number(uid), status: 'pending' },
        });
      }

      const usersToNotify = await prisma.user.findMany({
        where: { departmentId: { in: unit_ids.map(Number) }, isActive: true },
        select: { id: true },
      });
      for (const u of usersToNotify) {
        await notify(u.id, 'نامه ارجاعی', `نامه "${letter.subject}" به واحد شما ارجاع شده`, '/letters');
      }

      await addHistory(letterId, req.user.id, req.user.full_name, 'forwarded', `ارجاع: ${deptNames.join('، ')}`);

      const sender = await prisma.user.findUnique({ where: { id: letter.senderId }, select: { id: true, fullName: true } });
      if (sender) await notify(sender.id, 'ارجاع نامه', `نامه "${letter.subject}" ارجاع شد`, '/letters');

      res.json({ message: 'ارجاع شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id/seen-unit', async (req, res) => {
    try {
      const letterId = Number(req.params.id);
      if (isNaN(letterId)) {
        return res.status(400).json({ error: 'شناسه نامعتبر است' });
      }
      const lu = await prisma.letterUnit.findFirst({
        where: { letterId: letterId, unitId: Number(req.user.department_id), status: 'pending' },
      });
      if (!lu) return res.status(404).json({ error: 'نامه یافت نشد' });

      await prisma.letterUnit.update({ where: { id: lu.id }, data: { status: 'seen', seenDate: getNowString() } });
      await addHistory(letterId, req.user.id, req.user.full_name, 'seen_unit', 'رویت شده');
      res.json({ message: 'رویت شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ============================================================
  // GET parameterized (MUST be after static GETs)
  // ============================================================

  router.get('/:id/history', async (req, res) => {
    try {
      const letterId = Number(req.params.id);
      if (isNaN(letterId)) {
        return res.status(400).json({ error: 'شناسه نامعتبر است' });
      }
      const history = await prisma.letterHistory.findMany({
        where: { letterId: letterId },
        orderBy: { createdAt: 'asc' },
      });
      res.json(mapRow(history));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
