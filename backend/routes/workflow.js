const express = require('express');
const { authMiddleware, roleGuard } = require('../middleware/auth');
const prisma = require('../database/prisma');
const { mapRow, flattenJoins } = require('../utils/dbAdapter');

function getNowString() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

module.exports = function() {
  const router = express.Router();
  router.use(authMiddleware);

  router.get('/templates', roleGuard('admin'), async (req, res) => {
    try {
      const templates = await prisma.workflowTemplate.findMany({
        orderBy: { createdAt: 'desc' },
        include: { creator: { select: { fullName: true } } },
      });
      const mapped = templates.map(t => flattenJoins(t, { creator_name: 'creator.fullName' }));
      res.json(mapRow(mapped));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/templates', roleGuard('admin'), async (req, res) => {
    try {
      const { name, module_name, steps } = req.body;
      if (!name || !module_name || !steps || steps.length === 0) {
        return res.status(400).json({ error: 'نام، ماژول و مراحل الزامی است' });
      }

      const validModules = ['purchase', 'mission', 'work_order', 'payment', 'repair', 'it_request', 'conference', 'security', 'daily_output', 'inspection', 'leave', 'project_supply'];
      if (!validModules.includes(module_name)) {
        return res.status(400).json({ error: 'ماژول نامعتبر است' });
      }

      for (const step of steps) {
        if (!step.name || !step.role) {
          return res.status(400).json({ error: 'هر مرحله باید نام و نقش داشته باشد' });
        }
      }

      const result = await prisma.workflowTemplate.create({
        data: { name, moduleName: module_name, steps, createdBy: Number(req.user.id), isActive: true },
      });

      res.json({ id: result.id, success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/templates/:id', roleGuard('admin'), async (req, res) => {
    try {
      const { name, module_name, steps, is_active } = req.body;
      const existing = await prisma.workflowTemplate.findUnique({ where: { id: Number(req.params.id) } });
      if (!existing) return res.status(404).json({ error: 'قالب یافت نشد' });

      // If modifying steps or module_name, prevent if there are active instances
      const hasStepsChanged = steps != null && JSON.stringify(steps) !== JSON.stringify(existing.steps);
      const hasModuleChanged = module_name != null && module_name !== existing.moduleName;

      if (hasStepsChanged || hasModuleChanged) {
        const activeInstance = await prisma.workflowInstance.findFirst({
          where: {
            templateId: Number(req.params.id),
            status: 'active'
          }
        });
        if (activeInstance) {
          return res.status(400).json({ error: 'امکان ویرایش مراحل یا ماژول قالب با جریان‌های کار فعال وجود ندارد' });
        }
      }

      const data = {};
      if (name != null) data.name = name;
      if (module_name != null) data.moduleName = module_name;
      if (steps != null) data.steps = steps;
      if (is_active != null) data.isActive = !!is_active;

      await prisma.workflowTemplate.update({ where: { id: Number(req.params.id) }, data });

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/templates/:id', roleGuard('admin'), async (req, res) => {
    try {
      const hasInstances = await prisma.workflowInstance.findFirst({
        where: { templateId: Number(req.params.id) }
      });
      if (hasInstances) {
        return res.status(400).json({ error: 'این قالب دارای تاریخچه جریان کار است و قابل حذف نیست. لطفاً آن را غیرفعال کنید' });
      }

      await prisma.workflowTemplate.deleteMany({ where: { id: Number(req.params.id) } });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/templates/module/:module', async (req, res) => {
    try {
      const templates = await prisma.workflowTemplate.findMany({
        where: { moduleName: req.params.module, isActive: true },
        orderBy: { createdAt: 'desc' },
      });
      res.json(mapRow(templates));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/instances', async (req, res) => {
    try {
      const { status, template_id } = req.query;
      const where = {};
      if (status) where.status = status;
      if (template_id) where.templateId = Number(template_id);

      if (req.user.role === 'user') {
        where.startedBy = Number(req.user.id);
      }

      const instances = await prisma.workflowInstance.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          template: { select: { name: true, moduleName: true } },
          startedByUser: { select: { fullName: true } },
        },
      });
      const mapped = instances.map(i => flattenJoins(i, {
        template_name: 'template.name',
        module_name: 'template.moduleName',
        started_by_name: 'startedByUser.fullName',
      }));
      res.json(mapRow(mapped));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/instances', async (req, res) => {
    try {
      const { template_id, record_id } = req.body;
      if (!template_id || !record_id) {
        return res.status(400).json({ error: 'template_id و record_id الزامی است' });
      }

      const template = await prisma.workflowTemplate.findFirst({ where: { id: Number(template_id), isActive: true } });
      if (!template) return res.status(404).json({ error: 'قالب یافت نشد یا غیرفعال است' });

      // Prevent concurrent duplicate active instances for the same record
      const result = await prisma.$transaction(async (tx) => {
        const existingActive = await tx.workflowInstance.findFirst({
          where: {
            templateId: Number(template_id),
            recordId: Number(record_id),
            status: 'active'
          }
        });
        if (existingActive) {
          throw new Error('DUPLICATE_ACTIVE_INSTANCE');
        }

        return await tx.workflowInstance.create({
          data: {
            templateId: Number(template_id),
            recordId: Number(record_id),
            currentStep: 0,
            status: 'active',
            startedBy: Number(req.user.id),
          },
        });
      });

      res.json({ id: result.id, success: true });
    } catch (err) {
      if (err.message === 'DUPLICATE_ACTIVE_INSTANCE') {
        return res.status(400).json({ error: 'یک جریان کار فعال برای این رکورد در حال حاضر وجود دارد' });
      }
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/instances/:id/action', async (req, res) => {
    try {
      const { action, comment } = req.body;
      if (!action || !['approve', 'reject'].includes(action)) {
        return res.status(400).json({ error: 'عملیات نامعتبر (approve یا reject)' });
      }

      const instanceId = Number(req.params.id);

      const result = await prisma.$transaction(async (tx) => {
        const instance = await tx.workflowInstance.findUnique({
          where: { id: instanceId },
          include: { template: { select: { steps: true } } },
        });

        if (!instance) {
          throw new Error('NOT_FOUND');
        }
        if (instance.status !== 'active') {
          throw new Error('NOT_ACTIVE');
        }

        const rawSteps = instance.template.steps;
        const steps = Array.isArray(rawSteps)
          ? rawSteps
          : (typeof rawSteps === 'string' ? JSON.parse(rawSteps || '[]') : []);
        const currentStep = steps[instance.currentStep];
        if (!currentStep) {
          throw new Error('STEP_NOT_FOUND');
        }

        if (currentStep.role !== req.user.role && req.user.role !== 'admin') {
          throw new Error('FORBIDDEN');
        }

        // Create log
        await tx.workflowStepLog.create({
          data: {
            instanceId: instance.id,
            stepIndex: instance.currentStep,
            actorId: Number(req.user.id),
            action,
            comment: comment || null,
          },
        });

        // Determine next state
        let updateData = {};
        if (action === 'reject') {
          updateData = { status: 'rejected', completedAt: getNowString() };
        } else {
          if (instance.currentStep >= steps.length - 1) {
            updateData = { status: 'completed', currentStep: instance.currentStep + 1, completedAt: getNowString() };
          } else {
            updateData = { currentStep: instance.currentStep + 1 };
          }
        }

        // Apply OCC check during update to prevent race conditions
        const updateResult = await tx.workflowInstance.updateMany({
          where: {
            id: instance.id,
            status: 'active',
            currentStep: instance.currentStep
          },
          data: updateData
        });

        if (updateResult.count === 0) {
          throw new Error('CONCURRENT_UPDATE');
        }

        return { success: true };
      });

      res.json(result);
    } catch (err) {
      if (err.message === 'NOT_FOUND') {
        return res.status(404).json({ error: 'جریان کار یافت نشد' });
      }
      if (err.message === 'NOT_ACTIVE') {
        return res.status(400).json({ error: 'این جریان کار غیرفعال است' });
      }
      if (err.message === 'STEP_NOT_FOUND') {
        return res.status(400).json({ error: 'مرحله فعلی یافت نشد' });
      }
      if (err.message === 'FORBIDDEN') {
        return res.status(403).json({ error: 'شما اجازه عملیات در این مرحله را ندارید' });
      }
      if (err.message === 'CONCURRENT_UPDATE') {
        return res.status(409).json({ error: 'این درخواست به طور همزمان توسط کاربر دیگری ویرایش شده است. لطفا مجددا تلاش کنید' });
      }
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/instances/:id/log', async (req, res) => {
    try {
      const logs = await prisma.workflowStepLog.findMany({
        where: { instanceId: Number(req.params.id) },
        orderBy: { createdAt: 'asc' },
        include: { actor: { select: { fullName: true } } },
      });
      const mapped = logs.map(l => flattenJoins(l, { actor_name: 'actor.fullName' }));
      res.json(mapRow(mapped));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
