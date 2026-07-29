process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-minimum-32-chars';
process.env.PORT = '0';
process.env.NODE_ENV = 'test';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

function createMockDb() {
  const data = {
    users: [
      { id: 1000, password: bcrypt.hashSync('123456', 10), full_name: 'مدیر سیستم', role: 'admin', department_id: 1, is_active: 1, must_change_password: 0 },
      { id: 1001, password: bcrypt.hashSync('123456', 10), full_name: 'کارمند تست', role: 'user', department_id: 2, is_active: 1, must_change_password: 0 },
      { id: 1002, password: bcrypt.hashSync('123456', 10), full_name: 'سرپرست تست', role: 'supervisor', department_id: 2, is_active: 1, must_change_password: 0 },
      { id: 1003, password: bcrypt.hashSync('123456', 10), full_name: 'مدیر واحد', role: 'manager', department_id: 2, is_active: 1, must_change_password: 0 },
    ],
    departments: [
      { id: 1, name: 'مدیریت', parent_id: null, is_active: 1 },
      { id: 2, name: 'تولید', parent_id: 1, is_active: 1 },
    ],
    leave_requests: [],
    overtime_requests: [],
    purchase_requests: [],
    mission_requests: [],
    work_orders: [],
    payment_requests: [],
    repair_requests: [],
    it_requests: [],
    conference_bookings: [],
    security_reports: [],
    daily_output: [],
    project_supply_requests: [],
    inspection_requests: [],
    notifications: [],
    announcements: [],
    activity_log: [],
    letters: [],
    cardex: [],
    food_menu: [],
    push_subscriptions: [],
    permissions: [],
    sms_codes: [],
  };

  let nextId = 10000;

  const db = {
    prepare(sql) {
      const self = this;
      return {
        get(...params) {
          const table = self._findTable(sql);
          if (!table) {
            if (sql.includes('COUNT(*)')) return { count: 0, total: 0 };
            return null;
          }
          const rows = data[table] || [];
          if (sql.includes('COUNT(*)')) {
            return { count: rows.length, total: rows.length };
          }
          if (sql.includes('GROUP BY')) {
            return { name: 'test', user_count: rows.length };
          }
          return rows[0] || null;
        },
        all(...params) {
          const table = self._findTable(sql);
          if (!table) return [];
          const rows = data[table] || [];
          if (sql.includes('GROUP BY')) {
            return [{ name: 'تولید', user_count: 5 }];
          }
          return rows;
        },
        run(...params) {
          const table = self._findTable(sql);
          if (!table) return { changes: 0, lastInsertRowid: nextId++ };
          if (sql.startsWith('INSERT')) {
            const id = nextId++;
            return { changes: 1, lastInsertRowid: id };
          }
          if (sql.startsWith('UPDATE')) return { changes: 1 };
          if (sql.startsWith('DELETE')) return { changes: 1 };
          return { changes: 0 };
        }
      };
    },
    exec(sql) {},
    _findTable(sql) {
      const tables = Object.keys(data);
      for (const t of tables) {
        if (sql.toLowerCase().includes(t.toLowerCase())) return t;
      }
      if (sql.includes('departments')) return 'departments';
      if (sql.includes('users')) return 'users';
      return null;
    }
  };

  return db;
}

function createTestApp() {
  const db = createMockDb();
  const app = express();
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use('/api/auth', require('../routes/auth')(db));
  app.use('/api/admin', require('../routes/admin')(db));
  app.use('/api/leave', require('../routes/leave')(db));
  app.use('/api/purchase', require('../routes/purchase')(db));
  app.use('/api/mission', require('../routes/mission')(db));
  app.use('/api/work-order', require('../routes/workOrder')(db));
  app.use('/api/payment', require('../routes/payment')(db));
  app.use('/api/repair', require('../routes/repair')(db));
  app.use('/api/it', require('../routes/itRequest')(db));
  app.use('/api/conference', require('../routes/conference')(db));
  app.use('/api/security', require('../routes/security')(db));
  app.use('/api/daily-output', require('../routes/dailyOutput')(db));
  app.use('/api/project-supply', require('../routes/projectSupply')(db));
  app.use('/api/inspection', require('../routes/inspection')(db));
  app.use('/api/reports', require('../routes/reports')(db));
  app.use('/api/announcements', require('../routes/announcements')(db));
  app.use('/api/notifications', require('../routes/notifications')(db));
  app.use('/api/profile', require('../routes/profile')(db));
  app.use('/api/restaurant', require('../routes/restaurant')(db));
  app.use('/api/sms', require('../routes/smsAuth')(db));
  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  return { app, db };
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: String(user.id), role: user.role, full_name: user.full_name, department_id: user.department_id, department_name: '' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

module.exports = { createTestApp, generateToken };
