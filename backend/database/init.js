const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'edari.db');
let sqlDb = null;
let dirty = false;

function markDirty() { dirty = true; }

function saveDb() {
  if (sqlDb) {
    const data = sqlDb.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
    dirty = false;
  }
}

setInterval(() => {
  if (dirty) saveDb();
}, 5000);

process.on('SIGINT', () => { if (dirty) saveDb(); process.exit(); });
process.on('SIGTERM', () => { if (dirty) saveDb(); process.exit(); });

class SqliteWrapper {
  constructor(sqlJsDb) {
    this._db = sqlJsDb;
  }

  exec(sql) {
    this._db.run(sql);
    markDirty();
  }

  query(sql) {
    const execResults = this._db.exec(sql);
    if (!execResults || execResults.length === 0) return [];
    const { columns, values } = execResults[0];
    return values.map(row => {
      const obj = {};
      columns.forEach((c, i) => obj[c] = row[i]);
      return obj;
    });
  }

  transaction(fn) {
    const self = this;
    return function() {
      self._db.run('BEGIN TRANSACTION');
      try {
        fn.apply(null, arguments);
        self._db.run('COMMIT');
        markDirty();
      } catch (err) {
        self._db.run('ROLLBACK');
        throw err;
      }
    };
  }

  prepare(sql) {
    const self = this;
    return {
      run: function() {
        const params = Array.prototype.slice.call(arguments);
        const stmt = self._db.prepare(sql);
        if (params.length > 0 && params[0] !== undefined) {
          stmt.bind(params);
        }
        stmt.step();
        const changes = self._db.getRowsModified();
        let lastId = null;
        try {
          const r = self._db.exec("SELECT last_insert_rowid() as id");
          if (r.length > 0 && r[0].values.length > 0) {
            lastId = r[0].values[0][0];
          }
        } catch(e) {}
        stmt.free();
        markDirty();
        return { changes, lastInsertRowid: lastId };
      },
      get: function() {
        const params = Array.prototype.slice.call(arguments);
        const stmt = self._db.prepare(sql);
        if (params.length > 0 && params[0] !== undefined) {
          stmt.bind(params);
        }
        let result = null;
        if (stmt.step()) {
          const cols = stmt.getColumnNames();
          const vals = stmt.get();
          result = {};
          cols.forEach((c, i) => result[c] = vals[i]);
        }
        stmt.free();
        return result;
      },
      all: function() {
        const params = Array.prototype.slice.call(arguments);
        const results = [];
        const stmt = self._db.prepare(sql);
        if (params.length > 0 && params[0] !== undefined) {
          stmt.bind(params);
        }
        while (stmt.step()) {
          const cols = stmt.getColumnNames();
          const vals = stmt.get();
          const row = {};
          cols.forEach((c, i) => row[c] = vals[i]);
          results.push(row);
        }
        stmt.free();
        return results;
      }
    };
  }
}

async function initDatabase() {
  const SQL = await initSqlJs();

  let sqlBuffer = null;
  if (fs.existsSync(DB_PATH)) {
    sqlBuffer = fs.readFileSync(DB_PATH);
  }

  sqlDb = sqlBuffer ? new SQL.Database(sqlBuffer) : new SQL.Database();
  const db = new SqliteWrapper(sqlDb);

  db.exec(`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      parent_id INTEGER DEFAULT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (parent_id) REFERENCES departments(id)
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      department_id INTEGER,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (department_id) REFERENCES departments(id)
    );

    CREATE TABLE IF NOT EXISTS leave_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      leave_type TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      days_count INTEGER NOT NULL,
      reason TEXT,
      status TEXT DEFAULT 'pending_supervisor',
      supervisor_id INTEGER,
      supervisor_comment TEXT,
      supervisor_date TEXT,
      manager_id INTEGER,
      manager_comment TEXT,
      manager_date TEXT,
      security_id INTEGER,
      security_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (supervisor_id) REFERENCES users(id),
      FOREIGN KEY (manager_id) REFERENCES users(id),
      FOREIGN KEY (security_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS leave_balance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      total_days INTEGER DEFAULT 26,
      used_days INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS letters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      letter_number TEXT,
      subject TEXT NOT NULL,
      body TEXT,
      sender_id INTEGER NOT NULL,
      sender_unit_id INTEGER NOT NULL,
      priority TEXT DEFAULT 'normal',
      status TEXT DEFAULT 'pending_central',
      manager_id INTEGER,
      manager_comment TEXT,
      manager_date TEXT,
      signature_data TEXT,
      attachment_name TEXT,
      attachment_path TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (sender_id) REFERENCES users(id),
      FOREIGN KEY (sender_unit_id) REFERENCES departments(id),
      FOREIGN KEY (manager_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS letter_units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      letter_id INTEGER NOT NULL,
      unit_id INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      seen_date TEXT,
      FOREIGN KEY (letter_id) REFERENCES letters(id),
      FOREIGN KEY (unit_id) REFERENCES departments(id)
    );

    CREATE TABLE IF NOT EXISTS inventory_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      unit TEXT DEFAULT 'عدد',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cardex (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      quantity REAL NOT NULL,
      delivery_date TEXT NOT NULL,
      status TEXT DEFAULT 'pending_user',
      warehouse_user_id INTEGER NOT NULL,
      notes TEXT,
      user_confirm_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (item_id) REFERENCES inventory_items(id),
      FOREIGN KEY (warehouse_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS restaurant_menu (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      food_date TEXT NOT NULL,
      option_number INTEGER NOT NULL DEFAULT 1,
      food_name TEXT NOT NULL,
      description TEXT,
      price REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(food_date, option_number)
    );

    CREATE TABLE IF NOT EXISTS restaurant_reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      food_id INTEGER NOT NULL,
      food_date TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      status TEXT DEFAULT 'active',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (food_id) REFERENCES restaurant_menu(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      link TEXT,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS signatures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      image_data TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS letter_counter (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        year INTEGER NOT NULL,
        last_number INTEGER DEFAULT 0,
        UNIQUE(year)
      );
    `);
  } catch (e) {}

  const alterStatements = [
    "ALTER TABLE letters ADD COLUMN attachment_name TEXT",
    "ALTER TABLE letters ADD COLUMN attachment_path TEXT",
    "ALTER TABLE leave_requests ADD COLUMN start_hour TEXT",
    "ALTER TABLE leave_requests ADD COLUMN end_hour TEXT",
    "ALTER TABLE letters ADD COLUMN central_id INTEGER",
    "ALTER TABLE letters ADD COLUMN central_date TEXT",
    "ALTER TABLE letters ADD COLUMN selected_manager_id INTEGER",
    "ALTER TABLE announcements ADD COLUMN image_path TEXT",
  ];
  for (const sql of alterStatements) {
    try { db.exec(sql); } catch (e) {}
  }

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS letter_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        letter_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        user_name TEXT,
        action TEXT NOT NULL,
        comment TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (letter_id) REFERENCES letters(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);
  } catch (e) {}

  const existingDept = db.prepare('SELECT id FROM departments LIMIT 1').get();
  if (!existingDept) {
    const depts = [
      ['مدیریت', null],
      ['اداری', 1],
      ['انبار', 1],
      ['بایگانی', 1],
      ['اکانتینگ', 1],
      ['تولید', 1],
      ['فروش', 1],
      ['فنی', 1],
      ['حراست و انتظامات', 1],
      ['رستوران', 1],
      ['سانترال', 1]
    ];
    const insert = db.prepare('INSERT INTO departments (name, parent_id) VALUES (?, ?)');
    for (const [name, parent] of depts) {
      insert.run(name, parent);
    }
  }

  const existingAdmin = db.prepare('SELECT id FROM users WHERE role = ?').get('admin');
  if (!existingAdmin) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)').run('admin', hash, 'مدیر سیستم', 'admin');

    const insertUser = db.prepare('INSERT INTO users (username, password, full_name, role, department_id) VALUES (?, ?, ?, ?, ?)');
    const supHash = bcrypt.hashSync('super123', 10);
    const mgrHash = bcrypt.hashSync('manager123', 10);
    const usrHash = bcrypt.hashSync('user123', 10);

    insertUser.run('ali_rezaei', supHash, 'علی رضایی', 'supervisor', 2);
    insertUser.run('mohammad_hossein', supHash, 'محمد حسینی', 'supervisor', 3);
    insertUser.run('ahmad_taghavi', mgrHash, 'احمد تقی‌زاده', 'manager', 1);
    insertUser.run('reza_moradi', mgrHash, 'رضا مرادی', 'manager', 1);
    insertUser.run('sara_ahmadi', usrHash, 'سارا احمدی', 'user', 2);
    insertUser.run('maryam_karimi', usrHash, 'مریم کریمی', 'user', 3);
    insertUser.run('hossein_fazeli', usrHash, 'حسین فاضلی', 'user', 4);
    insertUser.run('fateme_shamsi', usrHash, 'فاطمه شمسی', 'user', 5);
    insertUser.run('amir_hosseini', supHash, 'امیر حسینی', 'supervisor', 8);
    insertUser.run('nasim_raeisi', usrHash, 'نسیم رئیسی', 'user', 9);
    insertUser.run('behnam_jafari', usrHash, 'بهنام جعفری', 'user', 10);
    insertUser.run('zahra_mousavi', usrHash, 'زهرا موسوی', 'user', 11);
  }

  const existingBalance = db.prepare('SELECT id FROM leave_balance LIMIT 1').get();
  if (!existingBalance) {
    const allUsers = db.prepare('SELECT id FROM users WHERE role != ?').all('admin');
    const insertBal = db.prepare('INSERT INTO leave_balance (user_id, total_days, used_days) VALUES (?, 26, 0)');
    for (const u of allUsers) {
      insertBal.run(u.id);
    }
  }

  const existingItems = db.prepare('SELECT id FROM inventory_items LIMIT 1').get();
  if (!existingItems) {
    const items = [
      ['میز اداری', 'میز کار اداری', 'عدد'],
      ['صندلی اداری', 'صندلی گردان', 'عدد'],
      ['کامپیوتر', 'کیس و مانیتور', 'عدد'],
      ['پرینتر', 'پرینتر لیزری', 'عدد'],
      ['کاغذ A4', 'بسته 500 برگی', 'بسته'],
      ['خودکار', 'خودکار آبی', 'عدد'],
      ['پوشه', 'پوشه فنری', 'عدد']
    ];
    const insItem = db.prepare('INSERT INTO inventory_items (name, description, unit) VALUES (?, ?, ?)');
    for (const [name, desc, unit] of items) {
      insItem.run(name, desc, unit);
    }
  }

  try { db.exec("ALTER TABLE restaurant_menu ADD COLUMN option_number INTEGER NOT NULL DEFAULT 1"); } catch(e) {}
  try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_menu_date_option ON restaurant_menu(food_date, option_number)"); } catch(e) {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        module_key TEXT NOT NULL,
        department_id INTEGER DEFAULT NULL,
        user_id INTEGER DEFAULT NULL,
        is_enabled INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);
  } catch (e) {}

  try { db.exec("ALTER TABLE permissions ADD COLUMN user_id INTEGER DEFAULT NULL"); } catch(e) {}
  try { db.exec("ALTER TABLE permissions ADD COLUMN department_id INTEGER DEFAULT NULL"); } catch(e) {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS announcements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        body TEXT,
        image_path TEXT,
        target_audience TEXT NOT NULL DEFAULT 'all',
        priority TEXT DEFAULT 'normal',
        is_active INTEGER DEFAULT 1,
        created_by INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (created_by) REFERENCES users(id)
      );
    `);
  } catch (e) {}

  try {
    const migrated = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='permissions_migrated'").get();
    if (!migrated) {
      db.exec(`CREATE TABLE permissions_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        module_key TEXT NOT NULL,
        department_id INTEGER DEFAULT NULL,
        user_id INTEGER DEFAULT NULL,
        is_enabled INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      )`);
      db.exec(`INSERT INTO permissions_new (id, module_key, department_id, user_id, is_enabled, created_at) SELECT id, module_key, department_id, user_id, is_enabled, created_at FROM permissions`);
      db.exec(`DROP TABLE permissions`);
      db.exec(`ALTER TABLE permissions_new RENAME TO permissions`);
      db.exec(`CREATE TABLE permissions_migrated (id INTEGER PRIMARY KEY)`);
    }
  } catch (e) {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS job_applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        full_name TEXT NOT NULL,
        father_name TEXT,
        national_id TEXT,
        national_id_issued_from TEXT,
        birth_date TEXT,
        birth_place TEXT,
        residence_duration TEXT,
        nationality TEXT DEFAULT 'ایرانی',
        religion TEXT,
        language TEXT,
        education_level TEXT,
        education_place TEXT,
        military_status TEXT,
        military_done TEXT DEFAULT 'خیر',
        military_service_type TEXT,
        military_exempt_non_medical TEXT,
        military_exempt_medical TEXT,
        military_exempt_reason TEXT,
        marital_status TEXT,
        children_count INTEGER DEFAULT 0,
        spouse_job TEXT,
        requested_salary TEXT DEFAULT '0',
        housing_status TEXT,
        housing_rent_amount TEXT DEFAULT '0',
        residential_address TEXT,
        phone_number TEXT,
        moral_traits TEXT,
        relatives_in_company TEXT DEFAULT 'خیر',
        relatives_details TEXT,
        criminal_record TEXT DEFAULT 'خیر',
        kave_factories TEXT,
        smoking TEXT DEFAULT 'خیر',
        smoking_duration TEXT,
        foreign_languages TEXT,
        turkish_known TEXT DEFAULT 'خیر',
        computer_skills TEXT,
        training_courses TEXT,
        references_info TEXT,
        photo TEXT,
        status TEXT DEFAULT 'new',
        reviewed_by INTEGER,
        reviewed_at TEXT,
        review_comment TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (reviewed_by) REFERENCES users(id)
      );
    `);
  } catch (e) {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS job_application_work_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        application_id INTEGER NOT NULL,
        org_name TEXT,
        position TEXT,
        duration TEXT,
        last_salary TEXT,
        leave_reason TEXT,
        contact_info TEXT,
        sort_order INTEGER DEFAULT 0,
        FOREIGN KEY (application_id) REFERENCES job_applications(id) ON DELETE CASCADE
      );
    `);
  } catch (e) {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS job_application_attachments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        application_id INTEGER NOT NULL,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_type TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (application_id) REFERENCES job_applications(id) ON DELETE CASCADE
      );
    `);
  } catch (e) {}

  try { db.exec("ALTER TABLE job_applications ADD COLUMN application_number TEXT"); } catch(e) {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS job_application_counter (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        year INTEGER NOT NULL,
        last_number INTEGER DEFAULT 0,
        UNIQUE(year)
      );
    `);
  } catch (e) {}

  const indexes = [
    "CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)",
    "CREATE INDEX IF NOT EXISTS idx_users_dept ON users(department_id)",
    "CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active)",
    "CREATE INDEX IF NOT EXISTS idx_leave_user ON leave_requests(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_leave_status ON leave_requests(status)",
    "CREATE INDEX IF NOT EXISTS idx_leave_user_status ON leave_requests(user_id, status)",
    "CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read)",
    "CREATE INDEX IF NOT EXISTS idx_cardex_user ON cardex(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_cardex_status ON cardex(status)",
    "CREATE INDEX IF NOT EXISTS idx_letters_status ON letters(status)",
    "CREATE INDEX IF NOT EXISTS idx_letters_sender ON letters(sender_id)",
    "CREATE INDEX IF NOT EXISTS idx_letter_units_letter ON letter_units(letter_id)",
    "CREATE INDEX IF NOT EXISTS idx_letter_units_unit ON letter_units(unit_id)",
    "CREATE INDEX IF NOT EXISTS idx_restaurant_menu_date ON restaurant_menu(food_date)",
    "CREATE INDEX IF NOT EXISTS idx_reservations_user ON restaurant_reservations(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_reservations_food ON restaurant_reservations(food_id)",
    "CREATE INDEX IF NOT EXISTS idx_reservations_status ON restaurant_reservations(status)",
    "CREATE INDEX IF NOT EXISTS idx_job_app_user ON job_applications(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_job_app_active ON job_applications(is_active)",
    "CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at)",
    "CREATE INDEX IF NOT EXISTS idx_permissions_user ON permissions(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_permissions_dept ON permissions(department_id)",
    "CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions(module_key)",
  ];
  for (const sql of indexes) {
    try { db.exec(sql); } catch (e) {}
  }

  saveDb();
  return db;
}

module.exports = { initDatabase };
