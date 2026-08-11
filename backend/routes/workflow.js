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

  router.get('/templates', roleGuard(['admin']), async (req, res) => {
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

  router.post('/templates', roleGuard(['admin']), async (req, res) => {
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
        data: { name, moduleName: module_name, steps, createdBy: Number(req.user.id) },
      });

      res.json({ id: result.id, success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/templates/:id', roleGuard(['admin']), async (req, res) => {
    try {
      const { name, module_name, steps, is_active } = req.body;
      const existing = await prisma.workflowTemplate.findUnique({ where: { id: Number(req.params.id) } });
      if (!existing) return res.status(404).json({ error: 'قالب یافت نشد' });

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

  router.delete('/templates/:id', roleGuard(['admin']), async (req, res) => {
    try {
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
      if (!template) return res.status(404).json({ error: 'قالب یافت نشد ا غیرفعال است' });

      const result = await prisma.workflowInstance.create({
        data: {
          templateId: Number(template_id),
          recordId: Number(record_id),
          currentStep: 0,
          status: 'active',
          startedBy: Number(req.user.id),
        },
      });

      res.json({ id: result.id, success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/instances/:id/action', async (req, res) => {
    try {
      const { action, comment } = req.body;
      if (!action || !['approve', 'reject'].includes(action)) {
        return res.status(400).json({ error: 'عملیات نامعتبر (approve یا reject)' });
      }

      const instance = await prisma.workflowInstance.findUnique({
        where: { id: Number(req.params.id) },
        include: { template: { select: { steps: true } } },
      });

      if (!instance) return res.status(404).json({ error: '实例 یافت نشد' });
      if (instance.status !== 'active') return res.status(400).json({ error: 'این实例 غیرفعال است' });

      const rawSteps = instance.template.steps;
      const steps = Array.isArray(rawSteps)
        ? rawSteps
        : (typeof rawSteps === 'string' ? JSON.parse(rawSteps || '[]') : []);
      const currentStep = steps[instance.currentStep];
      if (!currentStep) return res.status(400).json({ error: 'مرحله فعلی یافت نشد' });

      if (currentStep.role !== req.user.role && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'شما اجازه عملیات در این مرحله را ندارید' });
      }

      await prisma.workflowStepLog.create({
        data: {
          instanceId: instance.id,
          stepIndex: instance.currentStep,
          actorId: Number(req.user.id),
          action,
          comment: comment || null,
        },
      });

      if (action === 'reject') {
        await prisma.workflowInstance.update({
          where: { id: instance.id },
          data: { status: 'rejected', completedAt: getNowString() },
        });
      } else {
        if (instance.currentStep >= steps.length - 1) {
          await prisma.workflowInstance.update({
            where: { id: instance.id },
            data: { status: 'completed', currentStep: instance.currentStep + 1, completedAt: getNowString() },
          });
        } else {
          await prisma.workflowInstance.update({
            where: { id: instance.id },
            data: { currentStep: instance.currentStep + 1 },
          });
        }
      }

      res.json({ success: true });
    } catch (err) {
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
