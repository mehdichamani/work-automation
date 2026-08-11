const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const moment = require('moment-jalaali');
const { authMiddleware } = require('../middleware/auth');
const { notify: notifyHelper, getNextNumber: getNextNumberHelper, addHistory: addHistoryHelper } = require('../utils/helpers');
const prisma = require('../database/prisma');
const { mapRow, flattenJoins } = require('../utils/dbAdapter');

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

const REQUEST_ALIASES = {
  user_name: 'user.fullName',
  department_name: 'department.name',
  dept_manager_name: 'deptManager.fullName',
  pm_name: 'pm.fullName',
  tech_manager_name: 'techManager.fullName',
  warehouse_name: 'warehouse.fullName',
  factory_manager_name: 'factoryManager.fullName',
};

const REQUEST_INCLUDE = {
  user: { select: { fullName: true } },
  department: { select: { name: true } },
};

const NAME_FK_FIELDS = ['deptManagerId', 'pmId', 'techManagerId', 'warehouseId', 'factoryManagerId'];
const NAME_KEYS = ['deptManager', 'pm', 'techManager', 'warehouse', 'factoryManager'];

module.exports = function () {
  const router = express.Router();
  router.use(authMiddleware);

  async function notify(userId, title, body, link) { await notifyHelper(userId, title, body, link); }
  async function addHistory(id, userId, userName, action, comment) { await addHistoryHelper('repair_external_history', 'request_id', id, userId, userName, action, comment); }
  async function getNextNumber() { return getNextNumberHelper('repair_counter', 'تعمیر خارجی'); }

  async function getRelatedUserNames(rows) {
    const ids = new Set();
    rows.forEach(r => {
      NAME_FK_FIELDS.forEach(fk => {
        if (r[fk]) ids.add(Number(r[fk]));
      });
    });
    if (ids.size === 0) return {};
    const users = await prisma.user.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true, fullName: true },
    });
    const map = {};
    users.forEach(u => { map[u.id] = u.fullName; });
    return map;
  }

  function decorateNames(row, nameMap) {
    NAME_KEYS.forEach((key, idx) => {
      const fk = NAME_FK_FIELDS[idx];
      const uid = row[fk] ? Number(row[fk]) : null;
      row[key] = uid && nameMap[uid] ? { fullName: nameMap[uid] } : null;
    });
    return row;
  }

  function toListResponse(rows, nameMap) {
    return rows.map(r => mapRow(flattenJoins(decorateNames(r, nameMap), REQUEST_ALIASES)));
  }

  // ─── لیست درخواست‌ها ───
  router.get('/', async (req, res) => {
    try {
      const { status, page = 1, limit = 20 } = req.query;
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 20;
      const offset = (pageNum - 1) * limitNum;
      const where = {};

      if (req.user.role === 'user') {
        where.userId = req.user.id;
      } else if (req.user.role === 'supervisor') {
        where.status = 'pending_dept_manager';
      } else if (req.user.role === 'manager') {
        where.status = { in: ['pending_tech_manager', 'pending_warehouse'] };
      }

      if (status) {
        where.status = status;
      }

      const total = await prisma.repairExternalRequest.count({ where });
      const rows = await prisma.repairExternalRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limitNum,
        skip: offset,
        include: REQUEST_INCLUDE,
      });
      const nameMap = await getRelatedUserNames(rows);

      res.json({ requests: toListResponse(rows, nameMap), total, page: pageNum, limit: limitNum });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── درخواست‌های من ───
  router.get('/my-requests', async (req, res) => {
    try {
      const rows = await prisma.repairExternalRequest.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        include: REQUEST_INCLUDE,
      });
      const nameMap = await getRelatedUserNames(rows);
      res.json(toListResponse(rows, nameMap));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── جزئیات درخواست ───
  router.get('/:id', async (req, res) => {
    try {
      const request = await prisma.repairExternalRequest.findUnique({
        where: { id: Number(req.params.id) },
        include: REQUEST_INCLUDE,
      });
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });

      const items = await prisma.repairExternalItem.findMany({
        where: { requestId: Number(req.params.id) },
        orderBy: { id: 'asc' },
      });
      const history = await prisma.repairExternalHistory.findMany({
        where: { requestId: Number(req.params.id) },
        orderBy: { createdAt: 'asc' },
      });
      const nameMap = await getRelatedUserNames([request]);

      const sigUserIds = [
        { key: 'dept_manager', id: request.deptManagerId },
        { key: 'pm', id: request.pmId },
        { key: 'tech_manager', id: request.techManagerId },
        { key: 'warehouse', id: request.warehouseId },
        { key: 'factory_manager', id: request.factoryManagerId },
      ];
      const signatures = {};
      for (const { key, id } of sigUserIds) {
        if (id) {
          const sig = await prisma.digitalSignature.findFirst({ where: { userId: Number(id) }, orderBy: { createdAt: 'desc' } });
          signatures[key] = sig ? { scanned_signature: sig.scannedSignature || null, signature_data: sig.signatureData || null } : null;
        } else {
          signatures[key] = null;
        }
      }

      res.json({
        request: mapRow(flattenJoins(decorateNames(request, nameMap), REQUEST_ALIASES)),
        items: mapRow(items),
        history: mapRow(history),
        signatures,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── ایجاد درخواست جدید (PM_01) ───
  router.post('/', upload.array('images', 10), async (req, res) => {
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

      const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { departmentId: true } });
      const requestNumber = await getNextNumber();

      let images = null;
      if (req.files && req.files.length > 0) {
        images = JSON.stringify(req.files.map(f => `/uploads/repair-external/${f.filename}`));
      }

      const result = await prisma.repairExternalRequest.create({
        data: {
          requestNumber,
          userId: req.user.id,
          departmentId: user?.departmentId ?? null,
          status: 'pending_dept_manager',
          docCode: doc_code || 'PM_01',
          editDate: edit_date || '۱۴۰۴/۰۹/۲۶',
          revisionNumber: revision_number || null,
          formDate: form_date || toJalali(new Date()),
          fromUnit: from_unit || '',
          toUnit: to_unit || 'واحد PM',
          managerName: manager_name || req.user.full_name,
          repairSpeed: repair_speed || 'urgent',
          deadline: deadline || null,
          workType: work_type || '',
          techDescription: tech_description || '',
          estimatedCost: estimated_cost || null,
          faultDescription: fault_description || '',
          faultReason: fault_reason || 'کارکرد زیاد / استهلاک قطعات داخلی',
          warehouseStock: Number(warehouse_stock || 0),
          warehouseStockStatus: warehouse_stock_status || '',
          equipmentName: equipment_name || '',
          deliveryDate: delivery_date || toJalali(new Date()),
          sendDate: send_date || null,
          sendSerial: send_serial || '',
          destination: destination || '',
          contractorName: contractor_name || '',
          contractorAddress: contractor_address || '',
          repairDescription: repair_description || '',
          repairCost: repair_cost || null,
          supporterName: supporter_name || '',
          returnDate: return_date || null,
          returnSerial: return_serial || '',
          qualityStatus: quality_status || '',
          qualityNotes: quality_notes || '',
          images,
        },
      });

      const requestId = result.id;

      // Save items (equipment list)
      if (items) {
        const parsedItems = typeof items === 'string' ? JSON.parse(items) : items;
        await prisma.$transaction(async (tx) => {
          for (const item of parsedItems) {
            await tx.repairExternalItem.create({
              data: {
                requestId,
                itemName: item.item_name || '',
                techSpecs: item.tech_specs || '',
                serialNumber: item.serial_number || '',
                quantity: Number(item.quantity || 1),
                attachmentsDesc: item.attachments_desc || '',
              },
            });
          }
        });
      }

      await addHistory(requestId, req.user.id, req.user.full_name, 'ثبت درخواست', null);
      res.json({ id: requestId, request_number: requestNumber });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── بروزرسانی درخواست ───
  router.put('/:id', upload.array('images', 10), async (req, res) => {
    try {
      const existing = await prisma.repairExternalRequest.findUnique({ where: { id: Number(req.params.id) } });
      if (!existing) return res.status(404).json({ error: 'درخواست یافت نشد' });
      if (existing.userId !== req.user.id && req.user.role !== 'admin') {
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

      await prisma.repairExternalRequest.update({
        where: { id: Number(req.params.id) },
        data: {
          docCode: doc_code || existing.docCode,
          editDate: edit_date || existing.editDate,
          revisionNumber: revision_number ?? existing.revisionNumber,
          formDate: form_date || existing.formDate,
          fromUnit: from_unit || existing.fromUnit,
          toUnit: to_unit || existing.toUnit,
          managerName: manager_name || existing.managerName,
          repairSpeed: repair_speed || existing.repairSpeed,
          deadline: deadline || existing.deadline,
          workType: work_type || existing.workType,
          techDescription: tech_description || existing.techDescription,
          estimatedCost: estimated_cost || existing.estimatedCost,
          faultDescription: fault_description || existing.faultDescription,
          faultReason: fault_reason || existing.faultReason,
          warehouseStock: (warehouse_stock !== undefined && warehouse_stock !== null && warehouse_stock !== '') ? Number(warehouse_stock) : existing.warehouseStock,
          warehouseStockStatus: warehouse_stock_status || existing.warehouseStockStatus,
          equipmentName: equipment_name || existing.equipmentName,
          deliveryDate: delivery_date || existing.deliveryDate,
          sendDate: send_date || existing.sendDate,
          sendSerial: send_serial || existing.sendSerial,
          destination: destination || existing.destination,
          contractorName: contractor_name || existing.contractorName,
          contractorAddress: contractor_address || existing.contractorAddress,
          repairDescription: repair_description || existing.repairDescription,
          repairCost: repair_cost || existing.repairCost,
          supporterName: supporter_name || existing.supporterName,
          returnDate: return_date || existing.returnDate,
          returnSerial: return_serial || existing.returnSerial,
          qualityStatus: quality_status || existing.qualityStatus,
          qualityNotes: quality_notes || existing.qualityNotes,
          images,
        },
      });

      // Update items
      if (items) {
        const parsedItems = typeof items === 'string' ? JSON.parse(items) : items;
        await prisma.$transaction(async (tx) => {
          await tx.repairExternalItem.deleteMany({ where: { requestId: Number(req.params.id) } });
          for (const item of parsedItems) {
            await tx.repairExternalItem.create({
              data: {
                requestId: Number(req.params.id),
                itemName: item.item_name || '',
                techSpecs: item.tech_specs || '',
                serialNumber: item.serial_number || '',
                quantity: Number(item.quantity || 1),
                attachmentsDesc: item.attachments_desc || '',
              },
            });
          }
        });
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── تایید مراحل ───
  router.post('/:id/approve', async (req, res) => {
    try {
      const { step, comment } = req.body;
      const request = await prisma.repairExternalRequest.findUnique({ where: { id: Number(req.params.id) } });
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });

      const now = new Date().toISOString();
      const updates = {};

      switch (step) {
        case 'dept_manager':
          if (req.user.role !== 'supervisor' && req.user.role !== 'admin') return res.status(403).json({ error: 'عدم دسترسی' });
          updates.deptManagerApproved = true;
          updates.deptManagerApprovedAt = now;
          updates.deptManagerId = req.user.id;
          updates.status = 'pending_pm';
          await addHistory(req.params.id, req.user.id, req.user.full_name, 'تایید مسئول واحد', comment);
          break;
        case 'pm':
          if (req.user.role !== 'manager' && req.user.role !== 'admin') return res.status(403).json({ error: 'عدم دسترسی' });
          updates.pmApproved = true;
          updates.pmApprovedAt = now;
          updates.pmId = req.user.id;
          updates.status = 'pending_tech_manager';
          await addHistory(req.params.id, req.user.id, req.user.full_name, 'تایید PM برنامه‌ریزی', comment);
          break;
        case 'tech_manager':
          if (req.user.role !== 'manager' && req.user.role !== 'admin') return res.status(403).json({ error: 'عدم دسترسی' });
          updates.techManagerApproved = true;
          updates.techManagerApprovedAt = now;
          updates.techManagerId = req.user.id;
          updates.status = 'pending_warehouse';
          await addHistory(req.params.id, req.user.id, req.user.full_name, 'تایید برق/فنی', comment);
          break;
        case 'warehouse':
          if (req.user.role !== 'manager' && req.user.role !== 'admin') return res.status(403).json({ error: 'عدم دسترسی' });
          updates.warehouseApproved = true;
          updates.warehouseApprovedAt = now;
          updates.warehouseId = req.user.id;
          updates.status = 'pending_factory_manager';
          await addHistory(req.params.id, req.user.id, req.user.full_name, 'تایید انبار', comment);
          break;
        case 'factory_manager':
          if (req.user.role !== 'admin') return res.status(403).json({ error: 'عدم دسترسی' });
          updates.factoryManagerApproved = true;
          updates.factoryManagerApprovedAt = now;
          updates.factoryManagerId = req.user.id;
          updates.status = 'completed';
          await addHistory(req.params.id, req.user.id, req.user.full_name, 'تایید مدیر - بستن درخواست', comment);
          break;
        default:
          return res.status(400).json({ error: 'مرحله نامعتبر' });
      }

      await prisma.repairExternalRequest.update({
        where: { id: Number(req.params.id) },
        data: updates,
      });

      res.json({ success: true, status: updates.status || request.status });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── رد درخواست ───
  router.post('/:id/reject', async (req, res) => {
    try {
      const { step, comment } = req.body;
      const request = await prisma.repairExternalRequest.findUnique({ where: { id: Number(req.params.id) } });
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });

      await prisma.repairExternalRequest.update({
        where: { id: Number(req.params.id) },
        data: { status: 'rejected' },
      });
      await addHistory(req.params.id, req.user.id, req.user.full_name, `رد درخواست (${step})`, comment || 'بدون توضیح');
      res.json({ success: true, status: 'rejected' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── حذف درخواست ───
  router.delete('/:id', async (req, res) => {
    try {
      const request = await prisma.repairExternalRequest.findUnique({ where: { id: Number(req.params.id) } });
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });
      if (request.userId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'دسترسی غیرمجاز' });
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

      await prisma.$transaction(async (tx) => {
        await tx.repairExternalItem.deleteMany({ where: { requestId: Number(req.params.id) } });
        await tx.repairExternalHistory.deleteMany({ where: { requestId: Number(req.params.id) } });
        await tx.repairExternalRequest.delete({ where: { id: Number(req.params.id) } });
      });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
