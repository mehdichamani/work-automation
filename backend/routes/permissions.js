const express = require('express');
const { authMiddleware, roleGuard } = require('../middleware/auth');
const prisma = require('../database/prisma');
const { mapRow } = require('../utils/dbAdapter');

const MODULES = [
  { key: 'inventory_add', label: 'افزودن اقلام به کارتکس', group: 'کارتکس انبار' },
  { key: 'inventory_items', label: 'مدیریت تعریف کالاها', group: 'کارتکس انبار' },
  { key: 'inventory_all', label: 'مشاهده همه کارتکس‌ها', group: 'کارتکس انبار' },
  { key: 'leave_approve', label: 'تایید مرخصی (سرپرست)', group: 'مرخصی' },
  { key: 'leave_manager_approve', label: 'تایید مرخصی (مدیر)', group: 'مرخصی' },
  { key: 'leave_security_view', label: 'رویت حراست (مرخصی)', group: 'مرخصی' },
  { key: 'leave_quota_manage', label: 'مدیریت سهمیه مرخصی پرسنل', group: 'مرخصی' },
  { key: 'leave_edit_after_seen', label: 'ویرایش مرخصی پس از رویت حراست', group: 'مرخصی' },
  { key: 'overtime_approve', label: 'تایید اضافه کار (سرپرست)', group: 'اضافه کار' },
  { key: 'overtime_manager_approve', label: 'تایید اضافه کار (مدیر)', group: 'اضافه کار' },
  { key: 'overtime_security_view', label: 'رویت حراست (اضافه کار)', group: 'اضافه کار' },
  { key: 'overtime_edit_after_seen', label: 'ویرایش اضافه کار پس از رویت حراست', group: 'اضافه کار' },
  { key: 'shifts_manage', label: 'مدیریت و تغییر وضعیت شیفت کارکنان', group: 'شیفت‌های کاری' },
  { key: 'user_import_csv', label: 'وارد کردن گروهی پرسنل از CSV', group: 'مدیریت کاربران' },
  { key: 'letters_send', label: 'ارسال نامه', group: 'نامه‌ها' },
  { key: 'letters_approve', label: 'تایید نامه (مدیر)', group: 'نامه‌ها' },
  { key: 'letters_central', label: 'دبیرخانه / سانترال (مدیریت نامه‌ها)', group: 'نامه‌ها' },
  { key: 'restaurant_menu', label: 'مدیریت منوی رستوران', group: 'رستوران' },
  { key: 'restaurant_monitoring', label: 'مانیتورینگ رستوران', group: 'رستوران' },
  { key: 'announcements_manage', label: 'مدیریت اطلاعیه‌ها', group: 'اطلاعیه' },
  { key: 'job_application_fill', label: 'تکمیل پرسشنامه استخدامی', group: 'استخدام' },
  { key: 'job_application_review', label: 'بررسی پرسشنامه‌های استخدامی', group: 'استخدام' },
  { key: 'leave_request', label: 'درخواست مرخصی', group: 'دسترسی‌های پایه' },
  { key: 'overtime_request', label: 'درخواست اضافه کار', group: 'دسترسی‌های پایه' },
  { key: 'inventory_view', label: 'کارتکس انبار', group: 'دسترسی‌های پایه' },
  { key: 'restaurant_view', label: 'رستوران', group: 'دسترسی‌های پایه' },
  { key: 'purchase_request', label: 'درخواست خرید', group: 'ماژول‌های جدید' },
  { key: 'mission_request', label: 'درخواست ماموریت', group: 'ماژول‌های جدید' },
  { key: 'work_order_request', label: 'دستور کار', group: 'ماژول‌های جدید' },
  { key: 'payment_request', label: 'درخواست پرداخت', group: 'ماژول‌های جدید' },
  { key: 'repair_request', label: 'درخواست تعمیرات', group: 'ماژول‌های جدید' },
  { key: 'it_request', label: 'درخواست IT', group: 'ماژول‌های جدید' },
  { key: 'conference_request', label: 'رزرو سالن کنفرانس', group: 'ماژول‌های جدید' },
  { key: 'security_report', label: 'گزارش حراست', group: 'ماژول‌های جدید' },
  { key: 'daily_output', label: 'گزارش تولید', group: 'ماژول‌های جدید' },
  { key: 'project_supply', label: 'تامین پروژه', group: 'ماژول‌های جدید' },
  { key: 'inspection_request', label: 'بازدید فنی', group: 'ماژول‌های جدید' },
  { key: 'learning_view', label: 'مشاهده محتوای آموزشی', group: 'دسترسی‌های پایه' },
];

module.exports = function() {
  const router = express.Router();
  router.use(authMiddleware);

  router.get('/modules', (req, res) => {
    res.json(MODULES);
  });

  router.get('/', roleGuard('admin'), async (req, res) => {
    try {
      const perms = await prisma.permission.findMany({ where: { userId: null } });
      res.json(mapRow(perms));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/user-permissions', roleGuard('admin'), async (req, res) => {
    try {
      const allPerms = await prisma.permission.findMany();
      const userPermsMap = {};
      for (const p of allPerms) {
        if (p.userId !== null && p.userId !== undefined) {
          if (!userPermsMap[p.userId]) userPermsMap[p.userId] = [];
          userPermsMap[p.userId].push({ module_key: p.moduleKey, is_enabled: p.isEnabled ? 1 : 0 });
        }
      }
      const userIds = Object.keys(userPermsMap).map(Number);
      const result = [];
      if (userIds.length > 0) {
        const users = await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, fullName: true, username: true },
        });
        for (const user of users) {
          result.push({ user_id: user.id, full_name: user.fullName, username: user.username, permissions: userPermsMap[user.id] });
        }
      }
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/', roleGuard('admin'), async (req, res) => {
    try {
      const { permissions } = req.body;
      if (!Array.isArray(permissions)) {
        return res.status(400).json({ error: 'داده نامعتبر' });
      }
      const now = new Date();
      await prisma.$transaction(async (tx) => {
        await tx.permission.deleteMany({ where: { userId: null } });
        const rows = permissions
          .filter(p => p.module_key && p.department_id !== undefined)
          .map(p => ({
            moduleKey: p.module_key,
            departmentId: Number(p.department_id),
            userId: null,
            isEnabled: !!p.is_enabled,
            updatedAt: now,
          }));
        if (rows.length > 0) {
          await tx.permission.createMany({ data: rows });
        }
      });
      res.json({ message: 'دسترسی‌ها ذخیره شد' });
    } catch (err) {
      console.error('Error saving dept permissions:', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/user-permissions', roleGuard('admin'), async (req, res) => {
    try {
      const { user_id, permissions } = req.body;
      if (!user_id || !Array.isArray(permissions)) {
        return res.status(400).json({ error: 'داده نامعتبر' });
      }
      const uid = Number(user_id);
      const now = new Date();
      await prisma.$transaction(async (tx) => {
        await tx.permission.deleteMany({ where: { userId: uid } });
        const rows = permissions
          .filter(p => p.module_key)
          .map(p => ({
            moduleKey: p.module_key,
            userId: uid,
            isEnabled: !!p.is_enabled,
            updatedAt: now,
          }));
        if (rows.length > 0) {
          await tx.permission.createMany({ data: rows });
        }
      });
      res.json({ message: 'دسترسی‌های کاربر ذخیره شد' });
    } catch (err) {
      console.error('Error saving user permissions:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /permissions/matrix - returns full permission-department-user matrix for both views
  router.get('/matrix', roleGuard('admin'), async (req, res) => {
    try {
      const depts = await prisma.department.findMany({
        where: { isActive: true },
        orderBy: { id: 'asc' },
        select: { id: true, name: true },
      });

      const deptUsers = {};
      for (const dept of depts) {
        const users = await prisma.user.findMany({
          where: { departmentId: dept.id, isActive: true },
          orderBy: { fullName: 'asc' },
          select: { id: true, fullName: true, username: true, role: true },
        });
        deptUsers[dept.id] = mapRow(users);
      }

      const deptPerms = await prisma.permission.findMany({
        where: { userId: null },
        select: { moduleKey: true, departmentId: true, isEnabled: true },
      });

      const userPerms = await prisma.permission.findMany({
        where: { userId: { not: null } },
        select: { moduleKey: true, userId: true, isEnabled: true },
      });

      const deptPermMap = {};
      for (const p of deptPerms) {
        if (!deptPermMap[p.departmentId]) deptPermMap[p.departmentId] = {};
        deptPermMap[p.departmentId][p.moduleKey] = p.isEnabled ? 1 : 0;
      }

      const userPermMap = {};
      for (const p of userPerms) {
        if (!userPermMap[p.userId]) userPermMap[p.userId] = {};
        userPermMap[p.userId][p.moduleKey] = p.isEnabled ? 1 : 0;
      }

      res.json({ departments: mapRow(depts), deptUsers, deptPermMap, userPermMap, modules: MODULES });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /permissions/toggle-user - toggle a single user's permission
  router.put('/toggle-user', roleGuard('admin'), async (req, res) => {
    try {
      const { user_id, module_key, is_enabled } = req.body;
      if (!user_id || !module_key) {
        return res.status(400).json({ error: 'داده نامعتبر' });
      }

      const uid = Number(user_id);
      const existing = await prisma.permission.findFirst({
        where: { userId: uid, moduleKey: module_key },
      });

      if (existing) {
        await prisma.permission.updateMany({
          where: { userId: uid, moduleKey: module_key },
          data: { isEnabled: !!is_enabled },
        });
      } else {
        await prisma.permission.create({
          data: { moduleKey: module_key, userId: uid, isEnabled: !!is_enabled },
        });
      }

      res.json({ message: 'وضعیت دسترسی تغییر کرد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /permissions/bulk-toggle-dept - toggle permission for all members of a department
  router.put('/bulk-toggle-dept', roleGuard('admin'), async (req, res) => {
    try {
      const { department_id, module_key, is_enabled } = req.body;
      if (!department_id || !module_key) {
        return res.status(400).json({ error: 'داده نامعتبر' });
      }

      const members = await prisma.user.findMany({
        where: { departmentId: Number(department_id), isActive: true },
        select: { id: true },
      });

      await prisma.$transaction(async (tx) => {
        for (const m of members) {
          await tx.permission.deleteMany({ where: { userId: m.id, moduleKey: module_key } });
          if (is_enabled) {
            await tx.permission.create({
              data: { moduleKey: module_key, userId: m.id, isEnabled: true },
            });
          }
        }
      });

      res.json({ message: 'دسترسی گروهی اعمال شد', affected: members.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /permissions/bulk-toggle-role - toggle permission for all members with a specific role
  router.put('/bulk-toggle-role', roleGuard('admin'), async (req, res) => {
    try {
      const { role, module_key, is_enabled } = req.body;
      if (!role || !module_key) {
        return res.status(400).json({ error: 'داده نامعتبر' });
      }

      const members = await prisma.user.findMany({
        where: { role: role, isActive: true },
        select: { id: true },
      });

      if (members.length === 0) {
        return res.json({ message: 'کاربری با این سمت یافت نشد', affected: 0 });
      }

      const memberIds = members.map(m => m.id);

      await prisma.$transaction(async (tx) => {
        await tx.permission.deleteMany({
          where: {
            userId: { in: memberIds },
            moduleKey: module_key,
          },
        });

        if (is_enabled) {
          const now = new Date();
          const rows = memberIds.map(uid => ({
            moduleKey: module_key,
            userId: uid,
            isEnabled: true,
            updatedAt: now,
          }));
          await tx.permission.createMany({ data: rows });
        }
      });

      res.json({ message: `دسترسی برای سمت ${role} با موفقیت اعمال شد`, affected: members.length });
    } catch (err) {
      console.error('Error in bulk-toggle-role:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /permissions/bulk-set-role-modules - set all active module permissions for all members of a role
  router.put('/bulk-set-role-modules', roleGuard('admin'), async (req, res) => {
    try {
      const { role, module_keys } = req.body;
      if (!role || !Array.isArray(module_keys)) {
        return res.status(400).json({ error: 'داده نامعتبر' });
      }

      const members = await prisma.user.findMany({
        where: { role: role, isActive: true },
        select: { id: true },
      });

      if (members.length === 0) {
        return res.json({ message: 'کاربری با این سمت یافت نشد', affected: 0 });
      }

      const memberIds = members.map(m => m.id);

      await prisma.$transaction(async (tx) => {
        // Delete all permissions for these users
        await tx.permission.deleteMany({
          where: {
            userId: { in: memberIds },
          },
        });

        if (module_keys.length > 0) {
          const now = new Date();
          const rows = [];
          for (const uid of memberIds) {
            for (const modKey of module_keys) {
              rows.push({
                moduleKey: modKey,
                userId: uid,
                isEnabled: true,
                updatedAt: now,
              });
            }
          }
          if (rows.length > 0) {
            await tx.permission.createMany({ data: rows });
          }
        }
      });

      res.json({ message: 'دسترسی‌های سمت با موفقیت ذخیره شدند', affected: members.length });
    } catch (err) {
      console.error('Error in bulk-set-role-modules:', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/bulk-set-module-users', roleGuard('admin'), async (req, res) => {
    try {
      const { module_key, user_ids } = req.body;
      if (!module_key || !Array.isArray(user_ids)) {
        return res.status(400).json({ error: 'داده‌های ارسالی نامعتبر است' });
      }

      const selectedIds = new Set(user_ids.map(Number));

      await prisma.$transaction(async (tx) => {
        // Find all active users
        const activeUsers = await tx.user.findMany({
          where: { isActive: true },
          select: { id: true }
        });

        const activeUserIds = activeUsers.map(u => u.id);

        // Delete existing module permissions for all active users
        await tx.permission.deleteMany({
          where: {
            userId: { in: activeUserIds },
            moduleKey: module_key
          }
        });

        // Insert new records for the ones selected
        const recordsToInsert = [];
        const now = new Date();
        for (const uid of activeUserIds) {
          if (selectedIds.has(uid)) {
            recordsToInsert.push({
              moduleKey: module_key,
              userId: uid,
              isEnabled: true,
              updatedAt: now,
            });
          }
        }

        if (recordsToInsert.length > 0) {
          await tx.permission.createMany({
            data: recordsToInsert
          });
        }
      });

      res.json({ message: 'دسترسی‌های ماژول با موفقیت ذخیره شدند', count: selectedIds.size });
    } catch (err) {
      console.error('Error in bulk-set-module-users:', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/bulk-set-users', roleGuard('admin'), async (req, res) => {
    try {
      const { userIds } = req.body;
      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ error: 'لیست کاربران نامعتبر' });
      }

      const activeModules = MODULES.map(m => m.key);

      await prisma.$transaction(async (tx) => {
        const now = new Date();
        for (const userId of userIds) {
          const user = await tx.user.findFirst({
            where: { id: Number(userId), isActive: true },
            select: { id: true },
          });
          if (!user) continue;
          await tx.permission.deleteMany({ where: { userId: user.id } });
          if (activeModules.length > 0) {
            await tx.permission.createMany({
              data: activeModules.map(moduleKey => ({ moduleKey, userId: user.id, isEnabled: true, updatedAt: now })),
            });
          }
        }
      });

      res.json({ message: 'دسترسی‌ها با موفقیت برای کاربران انتخاب‌شده ثبت شد', affected: userIds.length });
    } catch (err) {
      console.error('Error in bulk-set-users:', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/my', async (req, res) => {
    try {
      if (req.user.role === 'admin') {
        const allPerms = MODULES.map(m => ({ module_key: m.key, is_enabled: 1 }));
        return res.json(allPerms);
      }

      const combined = {};

      const deptId = req.user.department_id;
      if (deptId) {
        const deptPerms = await prisma.permission.findMany({
          where: { departmentId: Number(deptId), userId: null },
          select: { moduleKey: true, isEnabled: true },
        });
        for (const p of deptPerms) {
          combined[p.moduleKey] = p.isEnabled;
        }
      }

      const userPerms = await prisma.permission.findMany({
        where: { userId: Number(req.user.id) },
        select: { moduleKey: true, isEnabled: true },
      });
      for (const p of userPerms) {
        combined[p.moduleKey] = p.isEnabled;
      }

      const result = Object.keys(combined).map(key => ({
        module_key: key,
        is_enabled: combined[key] ? 1 : 0
      }));

      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
