const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const moment = require('moment-jalaali');
const { authMiddleware } = require('../middleware/auth');
const { notify: notifyHelper, getNextNumber: getNextNumberHelper, addHistory: addHistoryHelper } = require('../utils/helpers');

function toJalali(date) {
  return moment(date).format('jYYYY/jMM/jDD');
}

const uploadDir = path.join(__dirname, '..', 'uploads', 'repair-external');
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `ext-repair-${Date.now()}-${Math.random().toString(36).slice(2, 6)}${ext}`);
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    cb(null, allowed.includes(file.mimetype));
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

module.exports = function (db) {
  const router = express.Router();
  router.use(authMiddleware);

  function notify(userId, title, body, link) { notifyHelper(db, userId, title, body, link); }
  function addHistory(id, userId, userName, action, comment) { addHistoryHelper(db, 'repair_external_history', 'request_id', id, userId, userName, action, comment); }
  function getNextNumber() { return getNextNumberHelper(db, 'repair_counter', 'تعمیر خارجی'); }

  // ─── لیست درخواست‌ها ───
  router.get('/', (req, res) => {
    try {
      const { status, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;
      let where = '';
      const params = [];

      if (req.user.role === 'user') {
        where = 'WHERE r.user_id = ?';
        params.push(req.user.id);
      } else if (req.user.role === 'supervisor') {
        where = "WHERE r.status = 'pending_dept_manager'";
      } else if (req.user.role === 'manager') {
        where = "WHERE r.status IN ('pending_tech_manager', 'pending_warehouse')";
      }

      if (status) {
        where += (where ? ' AND ' : 'WHERE ') + 'r.status = ?';
        params.push(status);
      }

      const total = db.prepare(`SELECT COUNT(*) as count FROM repair_external_requests r ${where}`).get(...params).count;
      const requests = db.prepare(`
        SELECT r.*, u.full_name as user_name, d.name as department_name,
               ud.full_name as dept_manager_name, upm.full_name as pm_name,
               ut.full_name as tech_manager_name, uw.full_name as warehouse_name,
               uf.full_name as factory_manager_name
        FROM repair_external_requests r
        LEFT JOIN users u ON r.user_id = u.id
        LEFT JOIN departments d ON r.department_id = d.id
        LEFT JOIN users ud ON r.dept_manager_id = ud.id
        LEFT JOIN users upm ON r.pm_id = upm.id
        LEFT JOIN users ut ON r.tech_manager_id = ut.id
        LEFT JOIN users uw ON r.warehouse_id = uw.id
        LEFT JOIN users uf ON r.factory_manager_id = uf.id
        ${where}
        ORDER BY r.created_at DESC
        LIMIT ? OFFSET ?
      `).all(...params, parseInt(limit), parseInt(offset));

      res.json({ requests, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── درخواست‌های من ───
  router.get('/my-requests', (req, res) => {
    try {
      const requests = db.prepare(`
        SELECT r.*, u.full_name as user_name, d.name as department_name,
               ud.full_name as dept_manager_name, upm.full_name as pm_name,
               ut.full_name as tech_manager_name, uw.full_name as warehouse_name,
               uf.full_name as factory_manager_name
        FROM repair_external_requests r
        LEFT JOIN users u ON r.user_id = u.id
        LEFT JOIN departments d ON r.department_id = d.id
        LEFT JOIN users ud ON r.dept_manager_id = ud.id
        LEFT JOIN users upm ON r.pm_id = upm.id
        LEFT JOIN users ut ON r.tech_manager_id = ut.id
        LEFT JOIN users uw ON r.warehouse_id = uw.id
        LEFT JOIN users uf ON r.factory_manager_id = uf.id
        WHERE r.user_id = ?
        ORDER BY r.created_at DESC
      `).all(req.user.id);
      res.json(requests);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── جزئیات درخواست ───
  router.get('/:id', (req, res) => {
    try {
      const request = db.prepare(`
        SELECT r.*, u.full_name as user_name, d.name as department_name,
               ud.full_name as dept_manager_name, upm.full_name as pm_name,
               ut.full_name as tech_manager_name, uw.full_name as warehouse_name,
               uf.full_name as factory_manager_name
        FROM repair_external_requests r
        LEFT JOIN users u ON r.user_id = u.id
        LEFT JOIN departments d ON r.department_id = d.id
        LEFT JOIN users ud ON r.dept_manager_id = ud.id
        LEFT JOIN users upm ON r.pm_id = upm.id
        LEFT JOIN users ut ON r.tech_manager_id = ut.id
        LEFT JOIN users uw ON r.warehouse_id = uw.id
        LEFT JOIN users uf ON r.factory_manager_id = uf.id
        WHERE r.id = ?
      `).get(req.params.id);
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });

      const items = db.prepare('SELECT * FROM repair_external_items WHERE request_id = ? ORDER BY id').all(req.params.id);
      const history = db.prepare('SELECT * FROM repair_external_history WHERE request_id = ? ORDER BY created_at ASC').all(req.params.id);

      const sigUserIds = [
        { key: 'dept_manager', id: request.dept_manager_id },
        { key: 'pm', id: request.pm_id },
        { key: 'tech_manager', id: request.tech_manager_id },
        { key: 'warehouse', id: request.warehouse_id },
        { key: 'factory_manager', id: request.factory_manager_id },
      ];
      const signatures = {};
      for (const { key, id } of sigUserIds) {
        if (id) {
          const sig = db.prepare('SELECT * FROM digital_signatures WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(id);
          signatures[key] = sig ? { scanned_signature: sig.scanned_signature || null, signature_data: sig.signature_data || null } : null;
        } else {
          signatures[key] = null;
        }
      }

      res.json({ request, items, history, signatures });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── ایجاد درخواست جدید (PM_01) ───
  router.post('/', upload.array('images', 10), (req, res) => {
    try {
      const {
        doc_code, edit_date, revision_number, form_date,
        from_unit, to_unit, manager_name,
        repair_speed, deadline, work_type,
        tech_description, estimated_cost,
        fault_description, fault_reason,
        warehouse_stock, warehouse_stock_status,
        equipment_name,
        delivery_date, send_date, send_serial, destination,
        contractor_name, contractor_address, repair_description, repair_cost, supporter_name,
        return_date, return_serial, quality_status, quality_notes,
        items
      } = req.body;

      const user = db.prepare('SELECT department_id FROM users WHERE id = ?').get(req.user.id);
      const requestNumber = getNextNumber();

      let images = null;
      if (req.files && req.files.length > 0) {
        images = JSON.stringify(req.files.map(f => `/uploads/repair-external/${f.filename}`));
      }

      const result = db.prepare(`
        INSERT INTO repair_external_requests (
          request_number, user_id, department_id, status,
          doc_code, edit_date, revision_number, form_date,
          from_unit, to_unit, manager_name,
          repair_speed, deadline, work_type,
          tech_description, estimated_cost,
          fault_description, fault_reason,
          warehouse_stock, warehouse_stock_status,
          equipment_name,
          delivery_date, send_date, send_serial, destination,
          contractor_name, contractor_address, repair_description, repair_cost, supporter_name,
          return_date, return_serial, quality_status, quality_notes,
          images
        ) VALUES (?, ?, ?, 'pending_dept_manager',
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?,
          ?, ?,
          ?, ?,
          ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?
        )
      `).run(
        requestNumber, req.user.id, user?.department_id,
        doc_code || 'PM_01', edit_date || '۱۴۰۴/۰۹/۲۶', revision_number || null, form_date || toJalali(new Date()),
        from_unit || '', to_unit || 'واحد PM', manager_name || req.user.full_name,
        repair_speed || 'urgent', deadline || null, work_type || '',
        tech_description || '', estimated_cost || null,
        fault_description || '', fault_reason || 'کارکرد زیاد / استهلاک قطعات داخلی',
        warehouse_stock || 0, warehouse_stock_status || '',
        equipment_name || '',
        delivery_date || toJalali(new Date()), send_date || null, send_serial || '', destination || '',
        contractor_name || '', contractor_address || '', repair_description || '', repair_cost || null, supporter_name || '',
        return_date || null, return_serial || '', quality_status || '', quality_notes || '',
        images
      );

      const requestId = result.lastInsertRowid || result.rows?.[0]?.id;

      // Save items (equipment list)
      if (items) {
        const parsedItems = typeof items === 'string' ? JSON.parse(items) : items;
        const insertItem = db.prepare(`
          INSERT INTO repair_external_items (request_id, item_name, tech_specs, serial_number, quantity, attachments_desc)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        for (const item of parsedItems) {
          insertItem.run(requestId, item.item_name || '', item.tech_specs || '', item.serial_number || '', item.quantity || 1, item.attachments_desc || '');
        }
      }

      addHistory(requestId, req.user.id, req.user.full_name, 'ثبت درخواست', null);
      res.json({ id: requestId, request_number: requestNumber });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── بروزرسانی درخواست ───
  router.put('/:id', upload.array('images', 10), (req, res) => {
    try {
      const existing = db.prepare('SELECT * FROM repair_external_requests WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'درخواست یافت نشد' });
      if (existing.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }

      const {
        doc_code, edit_date, revision_number, form_date,
        from_unit, to_unit, manager_name,
        repair_speed, deadline, work_type,
        tech_description, estimated_cost,
        fault_description, fault_reason,
        warehouse_stock, warehouse_stock_status,
        equipment_name,
        delivery_date, send_date, send_serial, destination,
        contractor_name, contractor_address, repair_description, repair_cost, supporter_name,
        return_date, return_serial, quality_status, quality_notes,
        items
      } = req.body;

      let images = existing.images;
      if (req.files && req.files.length > 0) {
        const newImages = req.files.map(f => `/uploads/repair-external/${f.filename}`);
        const oldImages = existing.images ? JSON.parse(existing.images) : [];
        images = JSON.stringify([...oldImages, ...newImages]);
      }

      db.prepare(`
        UPDATE repair_external_requests SET
          doc_code=?, edit_date=?, revision_number=?, form_date=?,
          from_unit=?, to_unit=?, manager_name=?,
          repair_speed=?, deadline=?, work_type=?,
          tech_description=?, estimated_cost=?,
          fault_description=?, fault_reason=?,
          warehouse_stock=?, warehouse_stock_status=?,
          equipment_name=?,
          delivery_date=?, send_date=?, send_serial=?, destination=?,
          contractor_name=?, contractor_address=?, repair_description=?, repair_cost=?, supporter_name=?,
          return_date=?, return_serial=?, quality_status=?, quality_notes=?,
          images=?, updated_at=to_char(now(),'YYYY-MM-DD HH24:MI:SS'::text)
        WHERE id=?
      `).run(
        doc_code || existing.doc_code, edit_date || existing.edit_date,
        revision_number ?? existing.revision_number, form_date || existing.form_date,
        from_unit || existing.from_unit, to_unit || existing.to_unit,
        manager_name || existing.manager_name,
        repair_speed || existing.repair_speed, deadline || existing.deadline,
        work_type || existing.work_type,
        tech_description || existing.tech_description, estimated_cost || existing.estimated_cost,
        fault_description || existing.fault_description, fault_reason || existing.fault_reason,
        warehouse_stock ?? existing.warehouse_stock, warehouse_stock_status || existing.warehouse_stock_status,
        equipment_name || existing.equipment_name,
        delivery_date || existing.delivery_date, send_date || existing.send_date,
        send_serial || existing.send_serial, destination || existing.destination,
        contractor_name || existing.contractor_name, contractor_address || existing.contractor_address,
        repair_description || existing.repair_description, repair_cost || existing.repair_cost,
        supporter_name || existing.supporter_name,
        return_date || existing.return_date, return_serial || existing.return_serial,
        quality_status || existing.quality_status, quality_notes || existing.quality_notes,
        images, req.params.id
      );

      // Update items
      if (items) {
        db.prepare('DELETE FROM repair_external_items WHERE request_id = ?').run(req.params.id);
        const parsedItems = typeof items === 'string' ? JSON.parse(items) : items;
        const insertItem = db.prepare(`
          INSERT INTO repair_external_items (request_id, item_name, tech_specs, serial_number, quantity, attachments_desc)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        for (const item of parsedItems) {
          insertItem.run(req.params.id, item.item_name || '', item.tech_specs || '', item.serial_number || '', item.quantity || 1, item.attachments_desc || '');
        }
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

// ─── تایید مراحل ───
  router.post('/:id/approve', (req, res) => {
    try {
      const { step, comment } = req.body;
      const request = db.prepare('SELECT * FROM repair_external_requests WHERE id = ?').get(req.params.id);
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });

      const now = new Date().toISOString();
      const updates = {};

      switch (step) {
        case 'dept_manager':
          if (req.user.role !== 'supervisor' && req.user.role !== 'admin') return res.status(403).json({ error: 'عدم دسترسی' });
          updates.dept_manager_approved = 1;
          updates.dept_manager_approved_at = now;
          updates.dept_manager_id = req.user.id;
          updates.status = 'pending_pm';
          addHistory(req.params.id, req.user.id, req.user.full_name, 'تایید مسئول واحد', comment);
          break;
        case 'pm':
          if (req.user.role !== 'manager' && req.user.role !== 'admin') return res.status(403).json({ error: 'عدم دسترسی' });
          updates.pm_approved = 1;
          updates.pm_approved_at = now;
          updates.pm_id = req.user.id;
          updates.status = 'pending_tech_manager';
          addHistory(req.params.id, req.user.id, req.user.full_name, 'تایید PM برنامه‌ریزی', comment);
          break;
        case 'tech_manager':
          if (req.user.role !== 'manager' && req.user.role !== 'admin') return res.status(403).json({ error: 'عدم دسترسی' });
          updates.tech_manager_approved = 1;
          updates.tech_manager_approved_at = now;
          updates.tech_manager_id = req.user.id;
          updates.status = 'pending_warehouse';
          addHistory(req.params.id, req.user.id, req.user.full_name, 'تایید برق/فنی', comment);
          break;
        case 'warehouse':
          if (req.user.role !== 'manager' && req.user.role !== 'admin') return res.status(403).json({ error: 'عدم دسترسی' });
          updates.warehouse_approved = 1;
          updates.warehouse_approved_at = now;
          updates.warehouse_id = req.user.id;
          updates.status = 'pending_factory_manager';
          addHistory(req.params.id, req.user.id, req.user.full_name, 'تایید انبار', comment);
          break;
        case 'factory_manager':
          if (req.user.role !== 'admin') return res.status(403).json({ error: 'عدم دسترسی' });
          updates.factory_manager_approved = 1;
          updates.factory_manager_approved_at = now;
          updates.factory_manager_id = req.user.id;
          updates.status = 'completed';
          addHistory(req.params.id, req.user.id, req.user.full_name, 'تایید مدیر - بستن درخواست', comment);
          break;
        default:
          return res.status(400).json({ error: 'مرحله نامعتبر' });
      }

      const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
      db.prepare(`UPDATE repair_external_requests SET ${setClauses}, updated_at = to_char(now(),'YYYY-MM-DD HH24:MI:SS'::text) WHERE id = ?`)
        .run(...Object.values(updates), req.params.id);

      res.json({ success: true, status: updates.status || request.status });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── رد درخواست ───
  router.post('/:id/reject', (req, res) => {
    try {
      const { step, comment } = req.body;
      const request = db.prepare('SELECT * FROM repair_external_requests WHERE id = ?').get(req.params.id);
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });

      db.prepare(`UPDATE repair_external_requests SET status = 'rejected', updated_at = to_char(now(),'YYYY-MM-DD HH24:MI:SS'::text) WHERE id = ?`).run(req.params.id);
      addHistory(req.params.id, req.user.id, req.user.full_name, `رد درخواست (${step})`, comment || 'بدون توضیح');
      res.json({ success: true, status: 'rejected' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── حذف درخواست ───
  router.delete('/:id', (req, res) => {
    try {
      const request = db.prepare('SELECT * FROM repair_external_requests WHERE id = ?').get(req.params.id);
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });
      if (request.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      if (request.status !== 'draft' && request.status !== 'pending_dept_manager' && request.status !== 'pending_pm') {
        return res.status(400).json({ error: 'امکان حذف در این مرحله وجود ندارد' });
      }

      if (request.images) {
        try {
          for (const img of JSON.parse(request.images)) {
            const fp = path.join(__dirname, '..', img);
            if (fs.existsSync(fp)) fs.unlinkSync(fp);
          }
        } catch {}
      }

      db.prepare('DELETE FROM repair_external_items WHERE request_id = ?').run(req.params.id);
      db.prepare('DELETE FROM repair_external_history WHERE request_id = ?').run(req.params.id);
      db.prepare('DELETE FROM repair_external_requests WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
