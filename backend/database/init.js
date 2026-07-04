const { Worker, isMainThread, parentPort } = require('worker_threads');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

if (!isMainThread) {
  // =========================================================================
  // WORKER THREAD: Database Connection & Query Execution
  // =========================================================================
  const { Pool } = require('pg');
  
  let databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    try {
      const envPath = path.join(__dirname, '..', '..', '.env');
      console.log('Worker: envPath =', envPath);
      console.log('Worker: envPath exists? =', fs.existsSync(envPath));
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/DATABASE_URL=(.+)/);
        if (match) {
          databaseUrl = match[1].trim();
          console.log('Worker: databaseUrl from .env file =', databaseUrl.replace(/:[^:@\s]+@/, ':***@'));
        } else {
          console.log('Worker: no DATABASE_URL match in .env file');
        }
      }
    } catch (e) {
      console.log('Worker: error reading .env:', e.message);
    }
  }
  
  const pool = new Pool({
    connectionString: databaseUrl || 'postgresql://postgres:postgrespassword@localhost:5432/edari',
    max: 2, // Optimize connection count since each worker thread executes queries strictly sequentially
    idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
    connectionTimeoutMillis: 5000 // Fast failure on connection timeout
  });

  parentPort.on('message', async (msg) => {
    if (msg.type === 'init') {
      const sab = msg.sab;
      const stateArray = new Int32Array(sab, 0, 4);
      
      while (true) {
        // Wait until state becomes 1 (Request Ready)
        Atomics.wait(stateArray, 0, 0);
        
        if (stateArray[0] === 1) {
          const len = stateArray[1];
          const reqStr = Buffer.from(sab, 16, len * 2).toString('utf16le');
          
          try {
            const req = JSON.parse(reqStr);
            const { sql, params } = req;
            
            // Automatic query retry mechanism on transient database connection errors
            let res;
            let retries = 3;
            while (retries > 0) {
              try {
                res = await pool.query(sql, params);
                break;
              } catch (queryErr) {
                const isConnError = queryErr.message.includes('terminated') || 
                                    queryErr.message.includes('connection') ||
                                    queryErr.code === 'ECONNREFUSED' ||
                                    queryErr.code === '57P01'; // Admin shutdown / Postgres restart
                if (isConnError && retries > 1) {
                  retries--;
                  await new Promise(resolve => setTimeout(resolve, 500)); // wait 500ms before retrying
                  continue;
                }
                throw queryErr;
              }
            }
            
            const respStr = JSON.stringify({ rows: res.rows, rowCount: res.rowCount });
            const respBuf = Buffer.from(respStr, 'utf16le');
            
            if (respBuf.length > sab.byteLength - 16) {
              throw new Error("Response size (" + respBuf.length + ") exceeds shared buffer size");
            }
            
            respBuf.copy(Buffer.from(sab, 16));
            stateArray[1] = respStr.length;
            stateArray[0] = 2; // Response Ready
          } catch (err) {
            const errStr = JSON.stringify({ error: err.message });
            const errBuf = Buffer.from(errStr, 'utf16le');
            errBuf.copy(Buffer.from(sab, 16));
            stateArray[1] = errStr.length;
            stateArray[0] = 3; // Error Ready
          }
          
          Atomics.notify(stateArray, 0, 1);
        }
      }
    }
  });
  return; // Stop execution here in the worker thread
}

// =========================================================================
// MAIN THREAD: Synchronous Database Interface
// =========================================================================

let worker = null;
let stateArray = null;
let sab = null;

function initSyncPg() {
  sab = new SharedArrayBuffer(16 * 1024 * 1024); // 16MB buffer
  stateArray = new Int32Array(sab, 0, 4);
  stateArray[0] = 0; // Idle
  
  worker = new Worker(__filename);
  worker.unref(); // Allow the program to exit if the worker is running
  worker.postMessage({ type: 'init', sab });
}

function runQuerySync(sql, params = []) {
  if (!worker) {
    initSyncPg();
  }
  
  const cleanedParams = params.map(p => p === undefined ? null : p);
  const reqStr = JSON.stringify({ sql, params: cleanedParams });
  const reqBuf = Buffer.from(reqStr, 'utf16le');
  
  if (reqBuf.length > sab.byteLength - 16) {
    throw new Error("Query parameters are too large for shared buffer");
  }
  
  reqBuf.copy(Buffer.from(sab, 16));
  stateArray[1] = reqStr.length;
  stateArray[0] = 1; // Request Ready
  
  Atomics.notify(stateArray, 0, 1);
  Atomics.wait(stateArray, 0, 1);
  
  const state = stateArray[0];
  const respLen = stateArray[1];
  const respStr = Buffer.from(sab, 16, respLen * 2).toString('utf16le');
  
  stateArray[0] = 0; // Reset to Idle
  
  const resp = JSON.parse(respStr);
  if (state === 3) {
    throw new Error("PostgreSQL Error: " + resp.error + "\nQuery: " + sql);
  }
  
  return resp;
}

class SqliteWrapper {
  exec(sql) {
    const adapted = this._adaptSql(sql);
    runQuerySync(adapted);
  }

  query(sql) {
    const adapted = this._adaptSql(sql);
    const res = runQuerySync(adapted);
    return res.rows;
  }

  transaction(fn) {
    const self = this;
    return function() {
      self.exec('BEGIN TRANSACTION');
      try {
        const res = fn.apply(null, arguments);
        self.exec('COMMIT');
        return res;
      } catch (err) {
        self.exec('ROLLBACK');
        throw err;
      }
    };
  }

  prepare(sql) {
    const self = this;
    const adapted = this._adaptSql(sql);
    
    return {
      run: function() {
        const params = Array.prototype.slice.call(arguments);
        const res = runQuerySync(adapted, params);
        
        let lastId = null;
        if (res.rows && res.rows[0]) {
          lastId = res.rows[0].id || null;
        }
        if (!lastId && /INSERT/i.test(adapted)) {
          try {
            const seqRes = runQuerySync('SELECT lastval() as id');
            if (seqRes.rows && seqRes.rows[0]) {
              lastId = seqRes.rows[0].id;
            }
          } catch(e) {}
        }
        
        return { changes: res.rowCount, lastInsertRowid: lastId };
      },
      get: function() {
        const params = Array.prototype.slice.call(arguments);
        const res = runQuerySync(adapted, params);
        return res.rows[0] || null;
      },
      all: function() {
        const params = Array.prototype.slice.call(arguments);
        const res = runQuerySync(adapted, params);
        return res.rows;
      }
    };
  }

  _adaptSql(sql) {
    if (!sql) return '';
    let res = sql;
    
    // Convert SQLite AUTOINCREMENT to Postgres SERIAL
    res = res.replace(/INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY');
    
    // Convert SQLite datetime('now') defaults
    res = res.replace(/DEFAULT\s+\(datetime\('now'\)\)/gi, "DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)");
    res = res.replace(/DEFAULT\s+datetime\('now'\)/gi, "DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)");
    res = res.replace(/datetime\('now'\)/gi, "to_char(now(), 'YYYY-MM-DD'::text)");
    
    // Replace SQLite "?" placeholders with PostgreSQL "$1, $2, ..."
    let index = 1;
    res = res.replace(/\?/g, () => `$${index++}`);
    
    // Append returning clause for INSERT queries to easily get IDs
    if (/^\s*INSERT\s+INTO/i.test(res) && !/RETURNING/i.test(res)) {
      res += ' RETURNING *';
    }
    
    return res;
  }
}

async function initDatabase() {
  initSyncPg();
  const db = new SqliteWrapper();

  // Acquire advisory lock to prevent concurrent database updates from other PM2 instances
  db.exec('SELECT pg_advisory_lock(123456)');
  try {
    // Create PostgreSQL compatibility functions and view
  db.exec(`
    CREATE OR REPLACE FUNCTION datetime(dummy text DEFAULT 'now') RETURNS text AS $$
    BEGIN
      RETURN to_char(now(), 'YYYY-MM-DD HH24:MI:SS');
    END;
    $$ LANGUAGE plpgsql;

    CREATE OR REPLACE FUNCTION last_insert_rowid() RETURNS integer AS $$
    BEGIN
      RETURN lastval();
    END;
    $$ LANGUAGE plpgsql;

    CREATE OR REPLACE VIEW sqlite_master AS
    SELECT 'table'::text AS type, table_name::text AS name
    FROM information_schema.tables
    WHERE table_schema = 'public';
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS departments (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id INTEGER DEFAULT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
      FOREIGN KEY (parent_id) REFERENCES departments(id)
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      department_id INTEGER,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
      FOREIGN KEY (department_id) REFERENCES departments(id)
    );

    CREATE TABLE IF NOT EXISTS leave_requests (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      leave_type TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      hours_count REAL NOT NULL,
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
      created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (supervisor_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (security_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS leave_balance (
      id SERIAL PRIMARY KEY,
      user_id INTEGER UNIQUE NOT NULL,
      total_days INTEGER DEFAULT 0,
      used_hours REAL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS official_holidays (
      id SERIAL PRIMARY KEY,
      holiday_date TEXT UNIQUE NOT NULL,
      title TEXT,
      created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
    );

    CREATE TABLE IF NOT EXISTS letters (
      id SERIAL PRIMARY KEY,
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
      created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (sender_unit_id) REFERENCES departments(id) ON DELETE CASCADE,
      FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS letter_units (
      id SERIAL PRIMARY KEY,
      letter_id INTEGER NOT NULL,
      unit_id INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      seen_date TEXT,
      FOREIGN KEY (letter_id) REFERENCES letters(id) ON DELETE CASCADE,
      FOREIGN KEY (unit_id) REFERENCES departments(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS inventory_items (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      unit TEXT DEFAULT 'عدد',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
    );

    CREATE TABLE IF NOT EXISTS cardex (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      quantity REAL NOT NULL,
      delivery_date TEXT NOT NULL,
      status TEXT DEFAULT 'pending_user',
      warehouse_user_id INTEGER NOT NULL,
      notes TEXT,
      user_confirm_date TEXT,
      created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
      FOREIGN KEY (warehouse_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS restaurant_menu (
      id SERIAL PRIMARY KEY,
      food_date TEXT NOT NULL,
      option_number INTEGER NOT NULL DEFAULT 1,
      food_name TEXT NOT NULL,
      description TEXT,
      price REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
      UNIQUE(food_date, option_number)
    );

    CREATE TABLE IF NOT EXISTS restaurant_reservations (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      food_id INTEGER NOT NULL,
      food_date TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      status TEXT DEFAULT 'active',
      notes TEXT,
      created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (food_id) REFERENCES restaurant_menu(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      link TEXT,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS signatures (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE,
      image_data TEXT NOT NULL,
      created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS work_shifts (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      start_time TEXT DEFAULT '',
      end_time TEXT DEFAULT '',
      description TEXT,
      color TEXT DEFAULT '#3b82f6',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
    );

    CREATE TABLE IF NOT EXISTS user_shift_assignments (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      shift_id INTEGER NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (shift_id) REFERENCES work_shifts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS shift_change_requests (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      current_shift_id INTEGER,
      requested_shift_id INTEGER NOT NULL,
      requested_date TEXT,
      reason TEXT,
      status TEXT DEFAULT 'pending',
      reviewed_by INTEGER,
      reviewed_at TEXT,
      review_comment TEXT,
      created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (current_shift_id) REFERENCES work_shifts(id) ON DELETE SET NULL,
      FOREIGN KEY (requested_shift_id) REFERENCES work_shifts(id) ON DELETE CASCADE,
      FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
    );
  `);

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS letter_counter (
        id SERIAL PRIMARY KEY,
        year INTEGER NOT NULL,
        last_number INTEGER DEFAULT 0,
        UNIQUE(year)
      );
    `);
  } catch (e) {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS announcements (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        body TEXT,
        image_path TEXT,
        target_audience TEXT NOT NULL DEFAULT 'all',
        priority TEXT DEFAULT 'normal',
        is_active INTEGER DEFAULT 1,
        created_by INTEGER,
        created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
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
        id SERIAL PRIMARY KEY,
        letter_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        user_name TEXT,
        action TEXT NOT NULL,
        comment TEXT,
        created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
        FOREIGN KEY (letter_id) REFERENCES letters(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
  } catch (e) {}

  const existingDept = db.prepare('SELECT id FROM departments LIMIT 1').get();
  if (!existingDept) {
    db.prepare('INSERT INTO departments (name, parent_id) VALUES (?, ?)').run('بدون واحد', null);
  }

  const existingAdmin = db.prepare("SELECT id FROM users WHERE role = 'admin'").get();
  if (!existingAdmin) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare("INSERT INTO users (id, password, full_name, role, department_id) VALUES (?, ?, ?, ?, ?)").run(1000, hash, 'مدیر سیستم', 'admin', 1);
    
    // Also create a leave balance for the admin
    db.prepare('INSERT INTO leave_balance (user_id, total_days, used_hours) VALUES (?, 0, 0)').run(1000);
  }

  const existingBalance = db.prepare('SELECT id FROM leave_balance LIMIT 1').get();
  if (!existingBalance) {
    const allUsers = db.prepare("SELECT id FROM users WHERE role != 'admin'").all();
    const insertBal = db.prepare('INSERT INTO leave_balance (user_id, total_days, used_hours) VALUES (?, 0, 0)');
    for (const u of allUsers) {
      insertBal.run(u.id);
    }
  }

  const existingShift = db.prepare('SELECT id FROM work_shifts LIMIT 1').get();
  if (!existingShift) {
    const insertShift = db.prepare('INSERT INTO work_shifts (name, start_time, end_time, description, color) VALUES (?, ?, ?, ?, ?)');
    insertShift.run('عادی کاری', '08:00', '17:00', 'شیفت عادی کاری', '#3b82f6');
    insertShift.run('شیفت عصر', '13:00', '22:00', 'شیفت عصر', '#f59e0b');
    insertShift.run('شیفت شب', '22:00', '06:00', 'شیفت شب', '#111827');
  }



  const defaultShift = db.prepare('SELECT id FROM work_shifts WHERE name = ?').get('عادی کاری');
  if (defaultShift) {
    const unassignedUsers = db.prepare(`
      SELECT u.id
      FROM users u
      LEFT JOIN user_shift_assignments usa ON usa.user_id = u.id AND usa.is_active = 1
      WHERE usa.id IS NULL
    `).all();
    const assignShift = db.prepare('INSERT INTO user_shift_assignments (user_id, shift_id, is_active) VALUES (?, ?, 1)');
    for (const u of unassignedUsers) {
      assignShift.run(u.id, defaultShift.id);
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

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS permissions (
        id SERIAL PRIMARY KEY,
        module_key TEXT NOT NULL,
        department_id INTEGER DEFAULT NULL,
        user_id INTEGER DEFAULT NULL,
        is_enabled INTEGER DEFAULT 1,
        created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
      );
    `);
  } catch (e) {}



  try {
    const migrated = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='permissions_migrated'").get();
    if (!migrated) {
      db.exec(`CREATE TABLE permissions_new (
        id SERIAL PRIMARY KEY,
        module_key TEXT NOT NULL,
        department_id INTEGER DEFAULT NULL,
        user_id INTEGER DEFAULT NULL,
        is_enabled INTEGER DEFAULT 1,
        created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
      )`);
      db.exec(`INSERT INTO permissions_new (id, module_key, department_id, user_id, is_enabled, created_at) SELECT id, module_key, department_id, user_id, is_enabled, created_at FROM permissions`);
      db.exec(`DROP TABLE permissions`);
      db.exec(`ALTER TABLE permissions_new RENAME TO permissions`);
      db.exec(`CREATE TABLE permissions_migrated (id SERIAL PRIMARY KEY)`);
    }
  } catch (e) {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS job_applications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        application_number TEXT,
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
        created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
      );
    `);
  } catch (e) {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS job_application_work_history (
        id SERIAL PRIMARY KEY,
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
        id SERIAL PRIMARY KEY,
        application_id INTEGER NOT NULL,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_type TEXT,
        created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
        FOREIGN KEY (application_id) REFERENCES job_applications(id) ON DELETE CASCADE
      );
    `);
  } catch (e) {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS job_application_counter (
        id SERIAL PRIMARY KEY,
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

  } finally {
    try {
      db.exec('SELECT pg_advisory_unlock(123456)');
    } catch (e) {}
  }

  return db;
}

module.exports = { initDatabase };
