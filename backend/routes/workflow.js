const express = require('express');
const { authMiddleware, roleGuard } = require('../middleware/auth');

module.exports = function(db) {
  const router = express.Router();
  router.use(authMiddleware);

  router.get('/templates', roleGuard(['admin']), (req, res) => {
    try {
      const templates = db.prepare(`
        SELECT wt.*, u.full_name as creator_name
        FROM workflow_templates wt
        LEFT JOIN users u ON wt.created_by = u.id
        ORDER BY wt.created_at DESC
      `).all();
      res.json(templates);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/templates', roleGuard(['admin']), (req, res) => {
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

      const result = db.prepare(`
        INSERT INTO workflow_templates (name, module_name, steps, created_by)
        VALUES (?, ?, ?, ?)
      `).run(name, module_name, JSON.stringify(steps), req.user.id);

      res.json({ id: result.lastInsertRowid, success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/templates/:id', roleGuard(['admin']), (req, res) => {
    try {
      const { name, module_name, steps, is_active } = req.body;
      const existing = db.prepare('SELECT * FROM workflow_templates WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'قالب یافت نشد' });

      db.prepare(`
        UPDATE workflow_templates
        SET name = COALESCE(?, name),
            module_name = COALESCE(?, module_name),
            steps = COALESCE(?, steps),
            is_active = COALESCE(?, is_active),
            updated_at = to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
        WHERE id = ?
      `).run(name || null, module_name || null, steps ? JSON.stringify(steps) : null, is_active != null ? is_active : null, req.params.id);

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/templates/:id', roleGuard(['admin']), (req, res) => {
    try {
      db.prepare('DELETE FROM workflow_templates WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/templates/module/:module', (req, res) => {
    try {
      const templates = db.prepare(`
        SELECT * FROM workflow_templates
        WHERE module_name = ? AND is_active = 1
        ORDER BY created_at DESC
      `).all(req.params.module);
      res.json(templates);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/instances', (req, res) => {
    try {
      const { status, template_id } = req.query;
      let where = 'WHERE 1=1';
      const params = [];
      if (status) { where += ' AND wi.status = ?'; params.push(status); }
      if (template_id) { where += ' AND wi.template_id = ?'; params.push(template_id); }

      if (req.user.role === 'user') {
        where += ' AND wi.started_by = ?';
        params.push(req.user.id);
      }

      const instances = db.prepare(`
        SELECT wi.*, wt.name as template_name, wt.module_name, u.full_name as started_by_name
        FROM workflow_instances wi
        LEFT JOIN workflow_templates wt ON wi.template_id = wt.id
        LEFT JOIN users u ON wi.started_by = u.id
        ${where}
        ORDER BY wi.created_at DESC
        LIMIT 100
      `).all(...params);
      res.json(instances);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/instances', (req, res) => {
    try {
      const { template_id, record_id } = req.body;
      if (!template_id || !record_id) {
        return res.status(400).json({ error: 'template_id و record_id الزامی است' });
      }

      const template = db.prepare('SELECT * FROM workflow_templates WHERE id = ? AND is_active = 1').get(template_id);
      if (!template) return res.status(404).json({ error: 'قالب یافت نشد ا غیرفعال است' });

      const result = db.prepare(`
        INSERT INTO workflow_instances (template_id, record_id, current_step, status, started_by)
        VALUES (?, ?, 0, 'active', ?)
      `).run(template_id, record_id, req.user.id);

      res.json({ id: result.lastInsertRowid, success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/instances/:id/action', (req, res) => {
    try {
      const { action, comment } = req.body;
      if (!action || !['approve', 'reject'].includes(action)) {
        return res.status(400).json({ error: 'عملیات نامعتبر (approve یا reject)' });
      }

      const instance = db.prepare(`
        SELECT wi.*, wt.steps
        FROM workflow_instances wi
        LEFT JOIN workflow_templates wt ON wi.template_id = wt.id
        WHERE wi.id = ?
      `).get(req.params.id);

      if (!instance) return res.status(404).json({ error: '实例 یافت نشد' });
      if (instance.status !== 'active') return res.status(400).json({ error: 'این实例 غیرفعال است' });

      const steps = JSON.parse(instance.steps || '[]');
      const currentStep = steps[instance.current_step];
      if (!currentStep) return res.status(400).json({ error: 'مرحله فعلی یافت نشد' });

      if (currentStep.role !== req.user.role && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'شما اجازه عملیات در این مرحله را ندارید' });
      }

      db.prepare(`
        INSERT INTO workflow_steps_log (instance_id, step_index, actor_id, action, comment)
        VALUES (?, ?, ?, ?, ?)
      `).run(instance.id, instance.current_step, req.user.id, action, comment || null);

      if (action === 'reject') {
        db.prepare(`
          UPDATE workflow_instances
          SET status = 'rejected', completed_at = to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
          WHERE id = ?
        `).run(instance.id);
      } else {
        if (instance.current_step >= steps.length - 1) {
          db.prepare(`
            UPDATE workflow_instances
            SET status = 'completed', current_step = ?, completed_at = to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
            WHERE id = ?
          `).run(instance.current_step + 1, instance.id);
        } else {
          db.prepare(`
            UPDATE workflow_instances
            SET current_step = ?
            WHERE id = ?
          `).run(instance.current_step + 1, instance.id);
        }
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/instances/:id/log', (req, res) => {
    try {
      const logs = db.prepare(`
        SELECT wsl.*, u.full_name as actor_name
        FROM workflow_steps_log wsl
        LEFT JOIN users u ON wsl.actor_id = u.id
        WHERE wsl.instance_id = ?
        ORDER BY wsl.created_at ASC
      `).all(req.params.id);
      res.json(logs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
