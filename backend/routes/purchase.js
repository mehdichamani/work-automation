const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { validateInput } = require('../middleware/validate');
const { notify: notifyHelper, findSupervisorId: findSupervisorIdHelper, getNextNumber: getNextNumberHelper, addHistory: addHistoryHelper } = require('../utils/helpers');

module.exports = function (db) {
  const router = express.Router();
  router.use(authMiddleware);

  function notify(userId, title, body, link) { notifyHelper(db, userId, title, body, link); }
  function addHistory(id, userId, userName, action, comment) { addHistoryHelper(db, 'purchase_history', 'request_id', id, userId, userName, action, comment); }
  function findSupervisorId(departmentId) { return findSupervisorIdHelper(db, departmentId); }
  function getNextNumber() { return getNextNumberHelper(db, 'purchase_counter', 'خرید'); }

  function getItems(requestId) {
    return db.prepare('SELECT * FROM purchase_items WHERE request_id = ? ORDER BY row_index ASC').all(requestId);
  }

  function saveItems(requestId, items) {
    db.prepare('DELETE FROM purchase_items WHERE request_id = ?').run(requestId);
    const stmt = db.prepare(`
      INSERT INTO purchase_items (request_id, row_index, item_code, description, purchase_location, technical_specs, requested_quantity, approved_quantity, usage_location, price, unit)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    items.forEach((item, i) => {
      stmt.run(requestId, i + 1, item.item_code || '', item.description || '', item.purchase_location || 'Urmia', item.technical_specs || '', item.requested_quantity || 0, item.approved_quantity || 0, item.usage_location || '', item.price || 0, item.unit || '');
    });
  }

  router.get('/', (req, res) => {
    try {
      const { status, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;
      let where = '';
      const params = [];

      if (req.user.role === 'user') {
        where = 'WHERE p.user_id = ?';
        params.push(req.user.id);
      } else if (req.user.role === 'supervisor') {
        where = "WHERE p.status = 'pending_supervisor'";
      } else if (req.user.role === 'manager') {
        where = "WHERE p.status = 'pending_manager'";
      }

      if (status) {
        where += (where ? ' AND ' : 'WHERE ') + 'p.status = ?';
        params.push(status);
      }

      const total = db.prepare(`SELECT COUNT(*) as count FROM purchase_requests p ${where}`).get(...params).count;
      const requests = db.prepare(`
        SELECT p.*, u.full_name as user_name, d.name as department_name,
               s.full_name as supervisor_name, m.full_name as manager_name,
               w.full_name as warehouse_name, fm.full_name as factory_manager_name,
               b.full_name as budget_name
        FROM purchase_requests p
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN departments d ON p.department_id = d.id
        LEFT JOIN users s ON p.supervisor_id = s.id
        LEFT JOIN users m ON p.manager_id = m.id
        LEFT JOIN users w ON p.warehouse_id = w.id
        LEFT JOIN users fm ON p.factory_manager_id = fm.id
        LEFT JOIN users b ON p.budget_id = b.id
        ${where}
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?
      `).all(...params, parseInt(limit), parseInt(offset));

      res.json({ requests, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/my-requests', (req, res) => {
    try {
      const requests = db.prepare(`
        SELECT p.*, u.full_name as user_name, d.name as department_name,
               s.full_name as supervisor_name, m.full_name as manager_name,
               w.full_name as warehouse_name, fm.full_name as factory_manager_name,
               b.full_name as budget_name
        FROM purchase_requests p
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN departments d ON p.department_id = d.id
        LEFT JOIN users s ON p.supervisor_id = s.id
        LEFT JOIN users m ON p.manager_id = m.id
        LEFT JOIN users w ON p.warehouse_id = w.id
        LEFT JOIN users fm ON p.factory_manager_id = fm.id
        LEFT JOIN users b ON p.budget_id = b.id
        WHERE p.user_id = ?
        ORDER BY p.created_at DESC
      `).all(req.user.id);
      res.json(requests);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/:id', (req, res) => {
    try {
      const request = db.prepare(`
        SELECT p.*, u.full_name as user_name, d.name as department_name,
               s.full_name as supervisor_name, m.full_name as manager_name,
               w.full_name as warehouse_name, fm.full_name as factory_manager_name,
               b.full_name as budget_name
        FROM purchase_requests p
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN departments d ON p.department_id = d.id
        LEFT JOIN users s ON p.supervisor_id = s.id
        LEFT JOIN users m ON p.manager_id = m.id
        LEFT JOIN users w ON p.warehouse_id = w.id
        LEFT JOIN users fm ON p.factory_manager_id = fm.id
        LEFT JOIN users b ON p.budget_id = b.id
        WHERE p.id = ?
      `).get(req.params.id);

      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });

      request.items = getItems(req.params.id);
      const history = db.prepare('SELECT * FROM purchase_history WHERE request_id = ? ORDER BY created_at ASC').all(req.params.id);

      res.json({ request, history });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/', validateInput({ description: 1000 }), (req, res) => {
    try {
      const { items, department, urgency = 'normal', reason } = req.body;
      if (!items || items.length === 0) {
        return res.status(400).json({ error: 'حداقل یک کالا وارد کنید' });
      }

      const user = db.prepare('SELECT department_id FROM users WHERE id = ?').get(req.user.id);
      const supervisorId = findSupervisorId(user?.department_id);
      const requestNumber = getNextNumber();

      const result = db.prepare(`
        INSERT INTO purchase_requests (user_id, request_number, department, urgency, reason, department_id, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(req.user.id, requestNumber, department || '', urgency, reason || '', user?.department_id, 'pending_supervisor');

      const requestId = result.lastInsertRowid;
      saveItems(requestId, items);

      addHistory(requestId, req.user.id, req.user.full_name, 'ثبت درخواست', null);

      if (supervisorId) {
        notify(supervisorId, 'درخواست خرید جدید', `درخواست شماره ${requestNumber} توسط ${req.user.full_name} ثبت شد`, '/purchase');
      }

      res.json({ id: requestId, request_number: requestNumber });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/approve', (req, res) => {
    try {
      const { comment, items } = req.body;
      const request = db.prepare('SELECT * FROM purchase_requests WHERE id = ?').get(req.params.id);
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });

      const now = new Date().toISOString();
      let newStatus = '';
      let historyAction = '';

      if (request.status === 'pending_supervisor') {
        newStatus = 'pending_manager';
        db.prepare('UPDATE purchase_requests SET supervisor_id = ?, supervisor_comment = ?, supervisor_date = ?, status = ? WHERE id = ?')
          .run(req.user.id, comment, now, newStatus, req.params.id);
        historyAction = 'تایید سرپرست';
        const managers = db.prepare("SELECT id FROM users WHERE role = 'manager'").all();
        managers.forEach(mgr => notify(mgr.id, 'درخواست خرید نیاز به تایید', `درخواست شماره ${request.request_number} توسط سرپرست تایید شد`, '/purchase'));
      } else if (request.status === 'pending_manager') {
        newStatus = 'pending_warehouse';
        db.prepare('UPDATE purchase_requests SET manager_id = ?, manager_comment = ?, manager_date = ?, status = ? WHERE id = ?')
          .run(req.user.id, comment, now, newStatus, req.params.id);
        historyAction = 'تایید مدیر';
        const warehouseUsers = db.prepare("SELECT id FROM users WHERE role = 'admin'").all();
        warehouseUsers.forEach(w => notify(w.id, 'درخواست خرید نیاز به تایید انبار', `درخواست شماره ${request.request_number} توسط مدیر تایید شد`, '/purchase'));
      } else if (request.status === 'pending_warehouse') {
        newStatus = 'pending_factory_manager';
        db.prepare('UPDATE purchase_requests SET warehouse_id = ?, warehouse_comment = ?, warehouse_date = ?, status = ? WHERE id = ?')
          .run(req.user.id, comment, now, newStatus, req.params.id);
        historyAction = 'تایید انبار';
        if (items && items.length > 0) {
          saveItems(req.params.id, items);
        }
        const factoryManagers = db.prepare("SELECT id FROM users WHERE role = 'manager'").all();
        factoryManagers.forEach(fm => notify(fm.id, 'درخواست خرید نیاز به تایید مدیر کارخانه', `درخواست شماره ${request.request_number} توسط انبار تایید شد`, '/purchase'));
      } else if (request.status === 'pending_factory_manager') {
        newStatus = 'pending_budget';
        db.prepare('UPDATE purchase_requests SET factory_manager_id = ?, factory_manager_comment = ?, factory_manager_date = ?, status = ? WHERE id = ?')
          .run(req.user.id, comment, now, newStatus, req.params.id);
        historyAction = 'تایید مدیر کارخانه';
        const budgetUsers = db.prepare("SELECT id FROM users WHERE role = 'admin'").all();
        budgetUsers.forEach(b => notify(b.id, 'درخواست خرید نیاز به تایید بودجه', `درخواست شماره ${request.request_number} توسط مدیر کارخانه تایید شد`, '/purchase'));
      } else if (request.status === 'pending_budget') {
        newStatus = 'approved';
        db.prepare('UPDATE purchase_requests SET budget_id = ?, budget_comment = ?, budget_date = ?, status = ? WHERE id = ?')
          .run(req.user.id, comment, now, newStatus, req.params.id);
        historyAction = 'تایید واحد بودجه';
      } else {
        return res.status(400).json({ error: 'وضعیت درخواست نامعتبر است' });
      }

      addHistory(req.params.id, req.user.id, req.user.full_name, historyAction, comment);
      notify(request.user_id, 'تایید درخواست خرید', `درخواست شماره ${request.request_number} ${historyAction} شد`, '/purchase');

      res.json({ success: true, status: newStatus });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/reject', (req, res) => {
    try {
      const { comment } = req.body;
      const request = db.prepare('SELECT * FROM purchase_requests WHERE id = ?').get(req.params.id);
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });
      if (!comment) return res.status(400).json({ error: 'دلیل رد الزامی است' });

      const now = new Date().toISOString();
      let historyAction = '';

      if (request.status === 'pending_supervisor') {
        db.prepare('UPDATE purchase_requests SET supervisor_id = ?, supervisor_comment = ?, supervisor_date = ?, status = ? WHERE id = ?')
          .run(req.user.id, comment, now, 'rejected', req.params.id);
        historyAction = 'رد توسط سرپرست';
      } else if (request.status === 'pending_manager') {
        db.prepare('UPDATE purchase_requests SET manager_id = ?, manager_comment = ?, manager_date = ?, status = ? WHERE id = ?')
          .run(req.user.id, comment, now, 'rejected', req.params.id);
        historyAction = 'رد توسط مدیر';
      } else if (request.status === 'pending_warehouse') {
        db.prepare('UPDATE purchase_requests SET warehouse_id = ?, warehouse_comment = ?, warehouse_date = ?, status = ? WHERE id = ?')
          .run(req.user.id, comment, now, 'rejected', req.params.id);
        historyAction = 'رد توسط انبار';
      } else if (request.status === 'pending_factory_manager') {
        db.prepare('UPDATE purchase_requests SET factory_manager_id = ?, factory_manager_comment = ?, factory_manager_date = ?, status = ? WHERE id = ?')
          .run(req.user.id, comment, now, 'rejected', req.params.id);
        historyAction = 'رد توسط مدیر کارخانه';
      } else if (request.status === 'pending_budget') {
        db.prepare('UPDATE purchase_requests SET budget_id = ?, budget_comment = ?, budget_date = ?, status = ? WHERE id = ?')
          .run(req.user.id, comment, now, 'rejected', req.params.id);
        historyAction = 'رد توسط واحد بودجه';
      } else {
        return res.status(400).json({ error: 'وضعیت درخواست نامعتبر است' });
      }

      addHistory(req.params.id, req.user.id, req.user.full_name, historyAction, comment);
      notify(request.user_id, 'رد درخواست خرید', `درخواست شماره ${request.request_number} رد شد. دلیل: ${comment}`, '/purchase');

      res.json({ success: true, status: 'rejected' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id', (req, res) => {
    try {
      const request = db.prepare('SELECT * FROM purchase_requests WHERE id = ?').get(req.params.id);
      if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });
      if (request.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
      if (request.status !== 'pending_supervisor') {
        return res.status(400).json({ error: 'امکان حذف درخواست در این مرحله وجود ندارد' });
      }

      db.prepare('DELETE FROM purchase_items WHERE request_id = ?').run(req.params.id);
      db.prepare('DELETE FROM purchase_history WHERE request_id = ?').run(req.params.id);
      db.prepare('DELETE FROM purchase_requests WHERE id = ?').run(req.params.id);

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
