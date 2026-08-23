const express = require('express');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { authMiddleware, roleGuard } = require('../middleware/auth');
const prisma = require('../database/prisma');
const { mapRow, flattenJoins } = require('../utils/dbAdapter');

module.exports = function() {
  const router = express.Router();
  router.use(authMiddleware);

  const uploadDir = path.join(__dirname, '..', 'uploads', 'csv_imports');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  async function hasAdminPerm(user, key) {
    if (user.role === 'admin') return true;
    const p = await prisma.permission.findFirst({ where: { userId: user.id, moduleKey: key } });
    if (p) return p.isEnabled;
    if (user.department_id) {
      const dp = await prisma.permission.findFirst({ where: { departmentId: Number(user.department_id), moduleKey: key, userId: null } });
      if (dp) return dp.isEnabled;
    }
    return false;
  }

  router.get('/users', async (req, res) => {
    if (req.user.role !== 'admin' && !(await hasAdminPerm(req.user, 'user_import_csv'))) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 100));
      const offset = (page - 1) * limit;
      const search = req.query.search || '';
      const activeOnly = req.query.active_only === '1';

      const where = {};

      if (search) {
        const numSearch = parseInt(search, 10);
        const or = [{ fullName: { contains: search, mode: 'insensitive' } }];
        if (!isNaN(numSearch)) or.push({ id: numSearch });
        where.OR = or;
      }
      if (activeOnly) {
        where.isActive = true;
      }

      const total = await prisma.user.count({ where });

      const users = await prisma.user.findMany({
        where,
        orderBy: { id: 'asc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          fullName: true,
          role: true,
          departmentId: true,
          isActive: true,
          createdAt: true,
          department: { select: { name: true } },
        },
      });

      const mapped = users.map(u => {
        const flat = flattenJoins(u, { department_name: 'department.name' });
        flat.username = flat.id;
        return mapRow(flat);
      });

      res.json({ data: mapped, total, page, limit });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/users', roleGuard('admin'), async (req, res) => {
    try {
      const { id, username, password, full_name, role, department_id } = req.body;
      const targetId = parseInt(id || username, 10);
      const parsedDeptId = department_id ? parseInt(department_id, 10) || null : null;
      if (!targetId || !full_name || !role) {
        return res.status(400).json({ error: 'کد پرسنلی، نام کامل و نقش الزامی هستند' });
      }
      if (targetId < 10000) {
        return res.status(400).json({ error: 'کد پرسنلی باید حداقل ۵ رقم باشد' });
      }
      if (targetId > 2147483647) {
        return res.status(400).json({ error: 'کد پرسنلی نامعتبر است (خارج از محدوده مجاز دیتابیس)' });
      }
      const existing = await prisma.user.findUnique({ where: { id: targetId } });
      if (existing && existing.isActive) {
        return res.status(400).json({ error: 'کد پرسنلی تکراری است' });
      }
      if (password && password.length < 5) {
        return res.status(400).json({ error: 'رمز عبور باید حداقل ۵ کاراکتر باشد' });
      }
      const pass = password || String(targetId);
      const mustChange = password ? false : true;
      const hash = await bcrypt.hash(pass, 10);
      if (existing && !existing.isActive) {
        await prisma.user.update({
          where: { id: targetId },
          data: { password: hash, fullName: full_name, role, departmentId: parsedDeptId, isActive: true, mustChangePassword: mustChange },
        });
      } else {
        await prisma.user.create({
          data: { id: targetId, password: hash, fullName: full_name, role, departmentId: parsedDeptId, mustChangePassword: mustChange },
        });
      }

      const existingBalance = await prisma.leaveBalance.findUnique({ where: { userId: targetId } });
      if (!existingBalance) {
        await prisma.leaveBalance.create({ data: { userId: targetId, totalDays: 0, usedHours: 0 } });
      }

      res.json({ id: targetId, message: 'کاربر با موفقیت ایجاد شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/users/:id', roleGuard('admin'), async (req, res) => {
    try {
      const { full_name, role, department_id, is_active, password } = req.body;
      const userId = Number(req.params.id);
      const parsedDeptId = department_id ? parseInt(department_id, 10) || null : null;

      if (password) {
        if (password.length < 5) {
          return res.status(400).json({ error: 'رمز عبور باید حداقل ۵ کاراکتر باشد' });
        }
        const hash = await bcrypt.hash(password, 10);
        await prisma.user.update({ where: { id: userId }, data: { password: hash } });
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          fullName: full_name,
          role,
          departmentId: parsedDeptId,
          isActive: is_active !== undefined ? (is_active === true || is_active === 1 || is_active === '1') : true,
        },
      });
      res.json({ message: 'کاربر با موفقیت ویرایش شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/users/:id', roleGuard('admin'), async (req, res) => {
    try {
      const userId = Number(req.params.id);
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
      if (user && user.role === 'admin') {
        return res.status(400).json({ error: 'امکان حذف مدیر سیستم وجود ندارد' });
      }
      await prisma.$transaction(async (tx) => {
        await tx.cardex.deleteMany({ where: { userId } });
        await tx.cardex.deleteMany({ where: { warehouseUserId: userId } });
        await tx.userShiftAssignment.deleteMany({ where: { userId } });
        await tx.shiftChangeRequest.deleteMany({ where: { userId } });
        await tx.leaveRequest.deleteMany({ where: { userId } });
        await tx.leaveRequest.updateMany({ where: { supervisorId: userId }, data: { supervisorId: null } });
        await tx.leaveRequest.updateMany({ where: { managerId: userId }, data: { managerId: null } });
        await tx.leaveRequest.updateMany({ where: { securityId: userId }, data: { securityId: null } });
        await tx.overtimeRequest.deleteMany({ where: { userId } });
        await tx.overtimeRequest.updateMany({ where: { supervisorId: userId }, data: { supervisorId: null } });
        await tx.overtimeRequest.updateMany({ where: { managerId: userId }, data: { managerId: null } });
        await tx.overtimeRequest.updateMany({ where: { securityId: userId }, data: { securityId: null } });
        await tx.letter.updateMany({ where: { managerId: userId }, data: { managerId: null } });
        await tx.notification.deleteMany({ where: { userId } });
        await tx.leaveBalance.deleteMany({ where: { userId } });
        await tx.signature.deleteMany({ where: { userId } });
        await tx.user.deleteMany({ where: { id: userId } });
      });
      res.json({ message: 'کاربر با موفقیت حذف شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/departments', async (req, res) => {
    try {
      const departments = await prisma.department.findMany({
        where: { isActive: true },
        orderBy: { id: 'asc' },
      });
      res.json(mapRow(departments));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/departments', roleGuard('admin'), async (req, res) => {
    try {
      const { name, parent_id } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'نام واحد الزامی است' });
      }
      const result = await prisma.department.create({
        data: { name, parentId: parent_id ? parseInt(parent_id, 10) || null : null },
      });
      res.json({ id: result.id, message: 'واحد با موفقیت ایجاد شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/departments/:id', roleGuard('admin'), async (req, res) => {
    try {
      const { name, parent_id } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'نام واحد الزامی است' });
      }
      await prisma.department.update({
        where: { id: Number(req.params.id) },
        data: { name, parentId: parent_id ? parseInt(parent_id, 10) || null : null },
      });
      res.json({ message: 'واحد با موفقیت ویرایش شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/departments/:id', roleGuard('admin'), async (req, res) => {
    try {
      const deptId = Number(req.params.id);
      const userCount = await prisma.user.count({ where: { departmentId: deptId, isActive: true } });
      if (userCount > 0) {
        return res.status(400).json({ error: `امکان حذف واحد وجود ندارد. ${userCount} کاربر فعال در این واحد هستند. ابتدا کاربران را منتقل یا غیرفعال کنید.` });
      }
      await prisma.user.updateMany({ where: { departmentId: deptId }, data: { departmentId: null } });
      await prisma.letterUnit.deleteMany({ where: { unitId: deptId } });
      await prisma.department.update({ where: { id: deptId }, data: { isActive: false } });
      res.json({ message: 'واحد با موفقیت حذف شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/departments/:id/supervisors', roleGuard('admin'), async (req, res) => {
    try {
      const deptId = Number(req.params.id);
      const supervisors = await prisma.user.findMany({
        where: { departmentId: deptId, isActive: true },
        select: { id: true, fullName: true, role: true },
      });
      const sorted = supervisors.sort((a, b) => {
        const sa = a.role === 'supervisor' ? 0 : 1;
        const sb = b.role === 'supervisor' ? 0 : 1;
        if (sa !== sb) return sa - sb;
        return (a.fullName || '').localeCompare(b.fullName || '');
      });
      const mapped = sorted.map(u => {
        const flat = { id: u.id, full_name: u.fullName, username: u.id, role: u.role };
        return mapRow(flat);
      });
      res.json(mapped);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/departments/:id/promote-supervisor', roleGuard('admin'), async (req, res) => {
    try {
      const { user_id } = req.body;
      if (!user_id) {
        return res.status(400).json({ error: 'انتخاب کاربر الزامی است' });
      }
      const target = await prisma.user.findFirst({ where: { id: Number(user_id), isActive: true } });
      if (!target) {
        return res.status(404).json({ error: 'کاربر یافت نشد' });
      }
      if (target.role === 'admin') {
        return res.status(400).json({ error: 'امکان تغییر نقش مدیر سیستم وجود ندارد' });
      }
      await prisma.user.update({
        where: { id: Number(user_id) },
        data: { role: 'supervisor', departmentId: Number(req.params.id) },
      });
      res.json({ message: 'کاربر به سرپرست واحد ارتقا یافت' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/departments/:id/demote-supervisor', roleGuard('admin'), async (req, res) => {
    try {
      const { user_id } = req.body;
      if (!user_id) {
        return res.status(400).json({ error: 'انتخاب کاربر الزامی است' });
      }
      const target = await prisma.user.findFirst({ where: { id: Number(user_id), isActive: true } });
      if (!target) {
        return res.status(404).json({ error: 'کاربر یافت نشد' });
      }
      await prisma.user.update({
        where: { id: Number(user_id) },
        data: { role: 'user' },
      });
      res.json({ message: 'سمت سرپرستی حذف شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/departments/:id/add-member', roleGuard('admin'), async (req, res) => {
    try {
      const { user_id } = req.body;
      if (!user_id) {
        return res.status(400).json({ error: 'انتخاب کاربر الزامی است' });
      }
      const target = await prisma.user.findFirst({ where: { id: Number(user_id), isActive: true } });
      if (!target) {
        return res.status(404).json({ error: 'کاربر یافت نشد' });
      }
      if (target.role === 'admin') {
        return res.status(400).json({ error: 'امکان تغییر واحد مدیر سیستم وجود ندارد' });
      }
      await prisma.user.update({
        where: { id: Number(user_id) },
        data: { departmentId: Number(req.params.id), role: 'user' },
      });
      res.json({ message: 'کاربر به واحد اضافه شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/departments/:id/remove-member', roleGuard('admin'), async (req, res) => {
    try {
      const { user_id } = req.body;
      if (!user_id) {
        return res.status(400).json({ error: 'انتخاب کاربر الزامی است' });
      }
      await prisma.user.update({
        where: { id: Number(user_id) },
        data: { departmentId: null },
      });
      res.json({ message: 'کاربر از واحد خارج شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/stats', roleGuard('admin', 'manager'), async (req, res) => {
    try {
      const totalUsers = await prisma.user.count({ where: { isActive: true } });
      const totalDepts = await prisma.department.count({ where: { isActive: true } });
      const pendingLeaves = await prisma.leaveRequest.count({
        where: { status: { in: ['pending_supervisor', 'pending_admin', 'pending_manager'] } },
      });
      const pendingOvertime = await prisma.overtimeRequest.count({
        where: { status: { in: ['pending_supervisor', 'pending_manager'] } },
      });
      const pendingLetters = await prisma.letter.count({
        where: { status: { in: ['pending_central', 'pending_manager'] } },
      });
      const pendingCardex = await prisma.cardex.count({ where: { status: 'pending_user' } });

      const roleGroups = await prisma.user.groupBy({
        by: ['role'],
        where: { isActive: true },
        _count: { _all: true },
      });
      const roleStats = roleGroups.map(g => ({ role: g.role, count: g._count._all }));

      const activeDepts = await prisma.department.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
      });
      const userGroups = await prisma.user.groupBy({
        by: ['departmentId'],
        where: { isActive: true, departmentId: { not: null } },
        _count: { _all: true },
      });
      const countMap = {};
      userGroups.forEach(g => { countMap[g.departmentId] = g._count._all; });
      const deptStats = activeDepts.map(d => ({ id: d.id, name: d.name, user_count: countMap[d.id] || 0 }));

      res.json({ totalUsers, totalDepts, pendingLeaves, pendingOvertime, pendingLetters, pendingCardex, roleStats, deptStats });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/dept-users/:deptId', async (req, res) => {
    try {
      const users = await prisma.user.findMany({
        where: { departmentId: Number(req.params.deptId), isActive: true },
        select: { id: true, fullName: true, role: true, isActive: true },
        orderBy: { fullName: 'asc' },
      });
      res.json(mapRow(users));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/users/import-csv', async (req, res) => {
    if (req.user.role !== 'admin' && !(await hasAdminPerm(req.user, 'user_import_csv'))) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز - شما دسترسی ورود گروهی کاربران را ندارید' });
    }
    try {
      const { users, csv_text, file_name } = req.body;
      if (!Array.isArray(users) || users.length === 0) {
        return res.status(400).json({ error: 'لیست کاربران برای ثبت نامعتبر است' });
      }

      // Preprocess and hash passwords before starting the database transaction to prevent transaction timeout
      const preparedUsers = [];
      const roleMap = {
        'admin': 'admin',
        'manager': 'manager',
        'supervisor': 'supervisor',
        'user': 'user',
        'مدیر سیستم': 'admin',
        'مدیرسیستم': 'admin',
        'مدیر': 'manager',
        'سرپرست': 'supervisor',
        'کاربر': 'user',
        'عادی': 'user',
        'کاربر عادی': 'user'
      };

      for (const u of users) {
        const userId = parseInt(u.id || u.personal_code, 10);
        if (!userId || !u.full_name || !u.role) continue;

        if (userId < 10000) {
          return res.status(400).json({
            error: `کد پرسنلی برای کاربر ${u.full_name} (${userId}) باید حداقل ۵ رقم باشد`
          });
        }
        if (userId > 2147483647) {
          return res.status(400).json({
            error: `کد پرسنلی برای کاربر ${u.full_name} (${userId}) نامعتبر است (خارج از محدوده مجاز)`
          });
        }

        let role = u.role;
        if (roleMap[role]) {
          role = roleMap[role];
        }

        if (role === 'admin') {
          return res.status(400).json({
            error: `امکان ثبت نقش مدیر سیستم برای کاربر ${u.full_name} (${userId}) از طریق فایل گروهی وجود ندارد`
          });
        }

        let totalDays = 0;
        if (u.total_hours !== undefined) {
          totalDays = Number(u.total_hours) / 8;
        } else if (u.total_days !== undefined) {
          totalDays = Number(u.total_days);
        }

        const pass = u.password || String(userId);
        const mustChange = !u.password;

        preparedUsers.push({
          userId,
          fullName: u.full_name,
          role,
          departmentName: u.department_name ? u.department_name.trim() : null,
          departmentId: u.department_id ? Number(u.department_id) : null,
          workType: u.work_type || 'normal',
          totalDays,
          pass,
          mustChange
        });
      }

      if (preparedUsers.length === 0) {
        return res.status(400).json({ error: 'هیچ کاربری با اطلاعات معتبر برای ثبت یافت نشد' });
      }

      // Hash passwords with caching for identical/default passwords
      const hashCache = new Map();
      const hashedUsers = [];
      for (const u of preparedUsers) {
        let hash = hashCache.get(u.pass);
        if (!hash) {
          hash = await bcrypt.hash(u.pass, 10);
          hashCache.set(u.pass, hash);
        }
        hashedUsers.push({
          ...u,
          passwordHash: hash
        });
      }

      // Execute database operations within transaction with increased timeout
      await prisma.$transaction(async (tx) => {
        for (const u of hashedUsers) {
          let departmentId = u.departmentId;
          if (u.departmentName) {
            const dept = await tx.department.findFirst({
              where: { name: { equals: u.departmentName, mode: 'insensitive' }, isActive: true }
            });
            if (dept) {
              departmentId = dept.id;
            } else {
              const created = await tx.department.create({ data: { name: u.departmentName } });
              departmentId = created.id;
            }
          }

          const existing = await tx.user.findUnique({ where: { id: u.userId } });
          if (existing) {
            await tx.user.update({
              where: { id: u.userId },
              data: {
                password: u.passwordHash,
                fullName: u.fullName,
                role: u.role,
                departmentId,
                workType: u.workType,
                isActive: true,
                mustChangePassword: u.mustChange
              },
            });

            const balanceExists = await tx.leaveBalance.findUnique({ where: { userId: u.userId } });
            if (balanceExists) {
              await tx.leaveBalance.update({
                where: { userId: u.userId },
                data: { totalDays: u.totalDays }
              });
            } else {
              await tx.leaveBalance.create({
                data: { userId: u.userId, totalDays: u.totalDays, usedHours: 0 }
              });
            }
          } else {
            await tx.user.create({
              data: {
                id: u.userId,
                password: u.passwordHash,
                fullName: u.fullName,
                role: u.role,
                departmentId,
                workType: u.workType,
                mustChangePassword: u.mustChange
              },
            });
            await tx.leaveBalance.create({
              data: { userId: u.userId, totalDays: u.totalDays, usedHours: 0 }
            });
          }
        }
      }, {
        maxWait: 10000,
        timeout: 60000
      });

      // Save raw CSV file to disk for audit logs (if not skipped in chunked requests)
      if (!req.body.skip_log && (csv_text || file_name)) {
        const safeName = file_name ? file_name.replace(/[^a-zA-Z0-9.\-_]/g, '_') : 'import.csv';
        const fileBase = `import_${req.user.id}_${Date.now()}_${safeName}`;
        const filePath = path.join(uploadDir, fileBase);
        fs.writeFileSync(filePath, csv_text || '', 'utf8');

        // Record in logs table
        await prisma.csvImportLog.create({
          data: {
            fileName: safeName,
            filePath,
            importedBy: req.user.id,
            rowCount: Number(req.body.total_rows) || users.length
          },
        });
      }

      res.json({
        message: 'کاربران با موفقیت وارد و ثبت شدند',
        importedCount: hashedUsers.length
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/users/import-csv-logs', async (req, res) => {
    if (req.user.role !== 'admin' && !(await hasAdminPerm(req.user, 'user_import_csv'))) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    try {
      const logs = await prisma.csvImportLog.findMany({
        orderBy: { importedAt: 'desc' },
        include: { importer: { select: { fullName: true } } },
      });
      const mapped = logs.map(l => flattenJoins(l, { importer_name: 'importer.fullName' }));
      res.json(mapRow(mapped));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/users/import-csv-download/:id', async (req, res) => {
    if (req.user.role !== 'admin' && !(await hasAdminPerm(req.user, 'user_import_csv'))) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    try {
      const log = await prisma.csvImportLog.findUnique({
        where: { id: Number(req.params.id) },
        select: { filePath: true, fileName: true },
      });
      if (!log) {
        return res.status(404).json({ error: 'فایل مورد نظر یافت نشد' });
      }
      const fullPath = path.resolve(log.filePath);
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: 'فایل فیزیکی روی سرور یافت نشد' });
      }
      res.download(fullPath, log.fileName);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/activity-log', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 20;
      const logs = await prisma.activityLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: { user: { select: { fullName: true } } },
      });
      const mapped = logs.map(l => flattenJoins(l, { full_name: 'user.fullName' }));
      res.json(mapRow(mapped));
    } catch (err) {
      res.json([]);
    }
  });

  return router;
};
