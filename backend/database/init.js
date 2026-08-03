const { Worker, isMainThread, parentPort } = require('worker_threads');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

if (!isMainThread) {
  // =========================================================================
  // WORKER THREAD: Database Connection & Query Execution
  // =========================================================================
  const { Pool } = require('pg');
  const { getDbConfig } = require('./config');
  const dbConfig = getDbConfig();
  
  const pool = new Pool({
    ...dbConfig,
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
  sab = new SharedArrayBuffer(32 * 1024 * 1024); // 32MB buffer
  stateArray = new Int32Array(sab, 0, 4);
  stateArray[0] = 0; // Idle
  
  worker = new Worker(__filename);
  worker.on('error', (err) => {
    console.error('Database Worker Thread Error:', err);
  });
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
    res = res.replace(/datetime\('now'\)/gi, "to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)");
    
    // Replace SQLite "?" placeholders with PostgreSQL "$1, $2, ..."
    let index = 1;
    res = res.replace(/\?/g, () => `$${index++}`);
    
    // Append returning clause for INSERT queries to get inserted IDs reliably
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
      work_type TEXT DEFAULT 'normal',
      is_active INTEGER DEFAULT 1,
      must_change_password INTEGER DEFAULT 0,
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
      edited_by INTEGER,
      edited_at TEXT,
      edit_reason TEXT,
      created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (supervisor_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (security_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (edited_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS overtime_requests (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      start_hour TEXT,
      end_hour TEXT,
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
      edited_by INTEGER,
      edited_at TEXT,
      edit_reason TEXT,
      created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (supervisor_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (security_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (edited_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS leave_balance (
      id SERIAL PRIMARY KEY,
      user_id INTEGER UNIQUE NOT NULL,
      total_days INTEGER DEFAULT 0,
      used_hours REAL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS leave_change_logs (
      id SERIAL PRIMARY KEY,
      action_by INTEGER NOT NULL,
      action_type TEXT NOT NULL, -- 'quota_edit' or 'leave_edit'
      target_id INTEGER NOT NULL, -- user_id or leave_id
      old_value TEXT,
      new_value TEXT,
      details TEXT,
      created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
      FOREIGN KEY (action_by) REFERENCES users(id) ON DELETE CASCADE
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
      central_comment TEXT,
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

    CREATE TABLE IF NOT EXISTS letter_attachments (
      id SERIAL PRIMARY KEY,
      letter_id INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
      FOREIGN KEY (letter_id) REFERENCES letters(id) ON DELETE CASCADE
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
    "ALTER TABLE leave_requests ADD COLUMN edited_by INTEGER",
    "ALTER TABLE leave_requests ADD COLUMN edited_at TEXT",
    "ALTER TABLE leave_requests ADD COLUMN edit_reason TEXT",
    "ALTER TABLE leave_balance ALTER COLUMN total_days TYPE DOUBLE PRECISION",
    "ALTER TABLE users ADD COLUMN work_type TEXT DEFAULT 'normal'",
    "ALTER TABLE letters ADD COLUMN central_comment TEXT",
    "ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 0",
    "ALTER TABLE users ADD COLUMN username TEXT",
    "ALTER TABLE users ADD COLUMN phone TEXT",
    "ALTER TABLE users ADD COLUMN email TEXT",
    "ALTER TABLE users ADD COLUMN last_login TEXT",
    "ALTER TABLE leave_requests ADD COLUMN admin_id INTEGER",
    "ALTER TABLE leave_requests ADD COLUMN admin_comment TEXT",
    "ALTER TABLE leave_requests ADD COLUMN admin_date TEXT",
    "ALTER TABLE leave_requests ADD COLUMN remaining_leave_days REAL",
"ALTER TABLE digital_signatures ADD COLUMN scanned_signature TEXT",
    "ALTER TABLE digital_signatures ADD COLUMN employee_code TEXT",
    "ALTER TABLE repair_requests ADD COLUMN images TEXT",
  ];

  // Create backup tables
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS backup_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        daily_path TEXT,
        weekly_path TEXT,
        daily_hour INTEGER DEFAULT 23,
        daily_minute INTEGER DEFAULT 0,
        weekly_day INTEGER DEFAULT 5,
        weekly_hour INTEGER DEFAULT 14,
        weekly_minute INTEGER DEFAULT 0,
        daily_retention_days INTEGER DEFAULT 30,
        weekly_retention_weeks INTEGER DEFAULT 12,
        daily_enabled INTEGER DEFAULT 1,
        weekly_enabled INTEGER DEFAULT 1,
        created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
        updated_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
      );
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS backup_logs (
        id SERIAL PRIMARY KEY,
        type TEXT NOT NULL,
        date TEXT NOT NULL,
        db_file TEXT,
        db_size INTEGER,
        uploads_file TEXT,
        uploads_size INTEGER,
        uploads_files INTEGER,
        backup_dir TEXT,
        status TEXT DEFAULT 'success',
        error TEXT,
        created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
      );
    `);
  } catch (e) {
    console.error('Backup tables creation error:', e.message);
  }

  // External repair tables
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS repair_external_requests (
        id SERIAL PRIMARY KEY,
        request_number TEXT,
        user_id INTEGER NOT NULL,
        department_id INTEGER,
        status TEXT DEFAULT 'draft',
        doc_code TEXT DEFAULT 'PM_01',
        edit_date TEXT DEFAULT '۱۴۰۴/۰۹/۲۶',
        revision_number TEXT,
        form_date TEXT,
        from_unit TEXT,
        to_unit TEXT DEFAULT 'واحد PM',
        manager_name TEXT,
        request_date TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
        urgency TEXT DEFAULT 'normal',
        repair_speed TEXT DEFAULT 'urgent',
        deadline TEXT,
        work_type TEXT,
        tech_description TEXT,
        estimated_cost TEXT,
        fault_description TEXT,
        fault_reason TEXT DEFAULT 'کارکرد زیاد / استهلاک قطعات داخلی',
        warehouse_stock INTEGER DEFAULT 0,
        warehouse_stock_status TEXT,
        sketch_file TEXT,
        photo_file TEXT,
        delivery_date TEXT,
        send_date TEXT,
        send_serial TEXT,
        destination TEXT,
        contractor_name TEXT,
        contractor_address TEXT,
        repair_description TEXT,
        repair_cost TEXT,
        supporter_name TEXT,
        return_date TEXT,
        return_serial TEXT,
        quality_status TEXT,
        quality_notes TEXT,
        images TEXT,
        pm_approved INTEGER DEFAULT 0,
        pm_approved_at TEXT,
        dept_manager_approved INTEGER DEFAULT 0,
        dept_manager_approved_at TEXT,
        dept_manager_id INTEGER REFERENCES users(id),
        tech_manager_approved INTEGER DEFAULT 0,
        tech_manager_approved_at TEXT,
        tech_manager_id INTEGER REFERENCES users(id),
        pm_id INTEGER REFERENCES users(id),
        warehouse_approved INTEGER DEFAULT 0,
        warehouse_approved_at TEXT,
        warehouse_id INTEGER REFERENCES users(id),
        factory_manager_approved INTEGER DEFAULT 0,
        factory_manager_approved_at TEXT,
        factory_manager_id INTEGER REFERENCES users(id),
        support_completed INTEGER DEFAULT 0,
        support_completed_at TEXT,
        quality_approved INTEGER DEFAULT 0,
        quality_approved_at TEXT,
        final_warehouse_approved INTEGER DEFAULT 0,
        final_warehouse_approved_at TEXT,
        created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
        updated_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (department_id) REFERENCES departments(id)
      );
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS repair_external_items (
        id SERIAL PRIMARY KEY,
        request_id INTEGER NOT NULL,
        item_name TEXT,
        tech_specs TEXT,
        serial_number TEXT,
        quantity INTEGER DEFAULT 1,
        attachments_desc TEXT,
        created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
        FOREIGN KEY (request_id) REFERENCES repair_external_requests(id) ON DELETE CASCADE
      );
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS repair_external_history (
        id SERIAL PRIMARY KEY,
        request_id INTEGER NOT NULL,
        user_id INTEGER,
        user_name TEXT,
        action TEXT NOT NULL,
        comment TEXT,
        old_status TEXT,
        new_status TEXT,
        created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
        FOREIGN KEY (request_id) REFERENCES repair_external_requests(id) ON DELETE CASCADE
      );
    `);

    // Migration: add new columns for PM_01 spec
    const newCols = [
      "ALTER TABLE repair_external_requests ADD COLUMN IF NOT EXISTS doc_code TEXT DEFAULT 'PM_01'",
      "ALTER TABLE repair_external_requests ADD COLUMN IF NOT EXISTS edit_date TEXT DEFAULT '۱۴۰۴/۰۹/۲۶'",
      "ALTER TABLE repair_external_requests ADD COLUMN IF NOT EXISTS revision_number TEXT",
      "ALTER TABLE repair_external_requests ADD COLUMN IF NOT EXISTS form_date TEXT",
      "ALTER TABLE repair_external_requests ADD COLUMN IF NOT EXISTS repair_speed TEXT DEFAULT 'urgent'",
      "ALTER TABLE repair_external_requests ADD COLUMN IF NOT EXISTS sketch_file TEXT",
      "ALTER TABLE repair_external_requests ADD COLUMN IF NOT EXISTS photo_file TEXT",
      "ALTER TABLE repair_external_requests ADD COLUMN IF NOT EXISTS equipment_name TEXT",
"ALTER TABLE repair_external_requests ADD COLUMN IF NOT EXISTS pm_approved INTEGER DEFAULT 0",
       "ALTER TABLE repair_external_requests ADD COLUMN IF NOT EXISTS pm_approved_at TEXT",
       "ALTER TABLE repair_external_requests ADD COLUMN IF NOT EXISTS pm_id INTEGER",
       "ALTER TABLE repair_external_requests ADD COLUMN IF NOT EXISTS dept_manager_id INTEGER",
       "ALTER TABLE repair_external_requests ADD COLUMN IF NOT EXISTS tech_manager_id INTEGER",
       "ALTER TABLE repair_external_requests ADD COLUMN IF NOT EXISTS warehouse_id INTEGER",
       "ALTER TABLE repair_external_requests ADD COLUMN IF NOT EXISTS factory_manager_id INTEGER",
     ];
    for (const sql of newCols) {
      try { db.exec(sql); } catch (e) { /* column may already exist */ }
    }
  } catch (e) {
    console.error('External repair tables creation error:', e.message);
  }

  for (const sql of alterStatements) {
    try { db.exec(sql); } catch (e) {}
  }

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS purchase_requests (
        id SERIAL PRIMARY KEY,
        request_number TEXT,
        user_id INTEGER NOT NULL,
        department TEXT,
        description TEXT,
        urgency TEXT DEFAULT 'normal',
        status TEXT DEFAULT 'pending_supervisor',
        supervisor_id INTEGER,
        supervisor_comment TEXT,
        supervisor_date TEXT,
        manager_id INTEGER,
        manager_comment TEXT,
        manager_date TEXT,
        warehouse_id INTEGER,
        warehouse_comment TEXT,
        warehouse_date TEXT,
        factory_manager_id INTEGER,
        factory_manager_comment TEXT,
        factory_manager_date TEXT,
        budget_id INTEGER,
        budget_comment TEXT,
        budget_date TEXT,
        created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
  } catch (e) {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS purchase_items (
        id SERIAL PRIMARY KEY,
        request_id INTEGER NOT NULL,
        row_index INTEGER DEFAULT 0,
        item_code TEXT,
        description TEXT,
        purchase_location TEXT CHECK (purchase_location IN ('Tehran', 'Urmia')),
        technical_specs TEXT,
        requested_quantity REAL DEFAULT 0,
        approved_quantity REAL DEFAULT 0,
        usage_location TEXT,
        price REAL DEFAULT 0,
        unit TEXT,
        FOREIGN KEY (request_id) REFERENCES purchase_requests(id) ON DELETE CASCADE
      );
    `);
  } catch (e) {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS mission_requests (
        id SERIAL PRIMARY KEY,
        request_number TEXT,
        user_id INTEGER NOT NULL,
        mission_date TEXT NOT NULL,
        destination TEXT,
        description TEXT,
        status TEXT DEFAULT 'pending_supervisor',
        supervisor_id INTEGER,
        supervisor_comment TEXT,
        supervisor_date TEXT,
        manager_id INTEGER,
        manager_comment TEXT,
        manager_date TEXT,
        created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
  } catch (e) {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS work_orders (
        id SERIAL PRIMARY KEY,
        request_number TEXT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        work_type TEXT,
        priority TEXT DEFAULT 'normal',
        estimated_cost TEXT,
        deadline TEXT,
        status TEXT DEFAULT 'pending_supervisor',
        supervisor_id INTEGER,
        supervisor_comment TEXT,
        supervisor_date TEXT,
        manager_id INTEGER,
        manager_comment TEXT,
        manager_date TEXT,
        created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
  } catch (e) {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS payment_requests (
        id SERIAL PRIMARY KEY,
        request_number TEXT,
        user_id INTEGER NOT NULL,
        amount TEXT NOT NULL,
        payment_type TEXT NOT NULL,
        description TEXT,
        reason TEXT,
        recipient_name TEXT,
        bank_name TEXT,
        card_number TEXT,
        payment_date TEXT,
        status TEXT DEFAULT 'pending_supervisor',
        supervisor_id INTEGER,
        supervisor_comment TEXT,
        supervisor_date TEXT,
        manager_id INTEGER,
        manager_comment TEXT,
        manager_date TEXT,
        created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
  } catch (e) {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS repair_requests (
        id SERIAL PRIMARY KEY,
        request_number TEXT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        equipment_name TEXT,
        location TEXT,
        urgency TEXT DEFAULT 'normal',
        estimated_cost TEXT,
        desired_date TEXT,
        status TEXT DEFAULT 'pending_supervisor',
        supervisor_id INTEGER,
        supervisor_comment TEXT,
        supervisor_date TEXT,
        manager_id INTEGER,
        manager_comment TEXT,
        manager_date TEXT,
        created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
  } catch (e) {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS it_requests (
        id SERIAL PRIMARY KEY,
        request_number TEXT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        request_type TEXT,
        urgency TEXT DEFAULT 'normal',
        device_info TEXT,
        assigned_to INTEGER,
        status TEXT DEFAULT 'pending',
        completion_comment TEXT,
        reject_comment TEXT,
        completed_at TEXT,
        created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
      );
    `);
  } catch (e) {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS conference_bookings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        booking_date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        title TEXT,
        description TEXT,
        attendees_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'approved',
        created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
  } catch (e) {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS security_reports (
        id SERIAL PRIMARY KEY,
        report_number TEXT,
        user_id INTEGER NOT NULL,
        report_date TEXT NOT NULL,
        report_type TEXT,
        description TEXT,
        location TEXT,
        status TEXT DEFAULT 'pending',
        supervisor_id INTEGER,
        supervisor_comment TEXT,
        supervisor_date TEXT,
        manager_id INTEGER,
        manager_comment TEXT,
        manager_date TEXT,
        created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
  } catch (e) {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS daily_output (
        id SERIAL PRIMARY KEY,
        report_number TEXT,
        user_id INTEGER NOT NULL,
        report_date TEXT NOT NULL,
        product_name TEXT,
        quantity REAL DEFAULT 0,
        unit TEXT DEFAULT 'عدد',
        description TEXT,
        status TEXT DEFAULT 'pending',
        supervisor_id INTEGER,
        supervisor_comment TEXT,
        supervisor_date TEXT,
        manager_id INTEGER,
        manager_comment TEXT,
        manager_date TEXT,
        created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
  } catch (e) {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS project_supply_requests (
        id SERIAL PRIMARY KEY,
        request_number TEXT,
        user_id INTEGER NOT NULL,
        project_name TEXT NOT NULL,
        items TEXT NOT NULL,
        description TEXT,
        estimated_cost TEXT,
        urgency TEXT DEFAULT 'normal',
        deadline TEXT,
        status TEXT DEFAULT 'pending_supervisor',
        supervisor_id INTEGER,
        supervisor_comment TEXT,
        supervisor_date TEXT,
        manager_id INTEGER,
        manager_comment TEXT,
        manager_date TEXT,
        created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
  } catch (e) {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS inspection_requests (
        id SERIAL PRIMARY KEY,
        request_number TEXT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        equipment_name TEXT,
        location TEXT,
        inspection_type TEXT,
        urgency TEXT DEFAULT 'normal',
        deadline TEXT,
        status TEXT DEFAULT 'pending_supervisor',
        supervisor_id INTEGER,
        supervisor_comment TEXT,
        supervisor_date TEXT,
        manager_id INTEGER,
        manager_comment TEXT,
        manager_date TEXT,
        result TEXT,
        inspector_id INTEGER,
        inspector_comment TEXT,
        inspected_at TEXT,
        created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
  } catch (e) {}

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

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS daily_work_reports (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        report_date TEXT NOT NULL,
        work_description TEXT NOT NULL,
        work_duration TEXT,
        department_id INTEGER,
        status TEXT DEFAULT 'pending_central',
        central_comment TEXT,
        central_by INTEGER,
        central_at TEXT,
        manager_comment TEXT,
        manager_by INTEGER,
        manager_at TEXT,
        project_control_comment TEXT,
        project_control_by INTEGER,
        project_control_at TEXT,
        created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
        updated_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (department_id) REFERENCES departments(id),
        FOREIGN KEY (central_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (manager_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (project_control_by) REFERENCES users(id) ON DELETE SET NULL
      );
    `);
  } catch (e) {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS daily_work_report_history (
        id SERIAL PRIMARY KEY,
        report_id INTEGER NOT NULL,
        user_id INTEGER,
        user_name TEXT,
        action TEXT NOT NULL,
        comment TEXT,
        created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
        FOREIGN KEY (report_id) REFERENCES daily_work_reports(id) ON DELETE CASCADE
      );
    `);
  } catch (e) {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS chat_rooms (
        id SERIAL PRIMARY KEY,
        name TEXT,
        type TEXT DEFAULT 'direct',
        created_by INTEGER,
        created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      );
    `);
  } catch (e) {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS chat_members (
        id SERIAL PRIMARY KEY,
        room_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        last_read_at TEXT,
        joined_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
        FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(room_id, user_id)
      );
    `);
  } catch (e) {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        room_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        message_type TEXT DEFAULT 'text',
        attachment_url TEXT,
        created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
        FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
  } catch (e) {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS digital_signatures (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        signature_data TEXT NOT NULL,
        signature_type TEXT DEFAULT 'drawn',
        created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
  } catch (e) {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS signature_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        signature_id INTEGER,
        module_name TEXT,
        record_id INTEGER,
        action TEXT NOT NULL,
        ip_address TEXT,
        created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (signature_id) REFERENCES digital_signatures(id) ON DELETE SET NULL
      );
    `);
  } catch (e) {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS workflow_templates (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        module_name TEXT NOT NULL,
        steps JSONB NOT NULL DEFAULT '[]',
        is_active INTEGER DEFAULT 1,
        created_by INTEGER,
        created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
        updated_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
      );
    `);
  } catch (e) {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS workflow_instances (
        id SERIAL PRIMARY KEY,
        template_id INTEGER NOT NULL,
        record_id INTEGER NOT NULL,
        current_step INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        started_by INTEGER,
        created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
        completed_at TEXT,
        FOREIGN KEY (template_id) REFERENCES workflow_templates(id) ON DELETE CASCADE,
        FOREIGN KEY (started_by) REFERENCES users(id) ON DELETE SET NULL
      );
    `);
  } catch (e) {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS workflow_steps_log (
        id SERIAL PRIMARY KEY,
        instance_id INTEGER NOT NULL,
        step_index INTEGER NOT NULL,
        actor_id INTEGER,
        action TEXT NOT NULL,
        comment TEXT,
        created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
        FOREIGN KEY (instance_id) REFERENCES workflow_instances(id) ON DELETE CASCADE,
        FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
      );
    `);
  } catch (e) {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS sms_codes (
        id SERIAL PRIMARY KEY,
        phone TEXT NOT NULL,
        code TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used INTEGER DEFAULT 0,
        created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
      );
      CREATE INDEX IF NOT EXISTS idx_sms_codes_phone ON sms_codes(phone);
    `);
  } catch (e) {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS attachments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        filename TEXT NOT NULL,
        original_name TEXT,
        mimetype TEXT,
        size INTEGER,
        url TEXT NOT NULL,
        module_name TEXT,
        record_id INTEGER,
        created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
  } catch (e) {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS activity_log (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        module_name TEXT,
        action TEXT NOT NULL,
        details TEXT,
        ip_address TEXT,
        created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
  } catch (e) {}

  const historyCounterTables = [
    { history: 'overtime_history', counter: 'overtime_counter', req: 'overtime_requests' },
    { history: 'purchase_history', counter: 'purchase_counter', req: 'purchase_requests' },
    { history: 'mission_history', counter: 'mission_counter', req: 'mission_requests' },
    { history: 'work_order_history', counter: 'work_order_counter', req: 'work_orders' },
    { history: 'payment_history', counter: 'payment_counter', req: 'payment_requests' },
    { history: 'repair_history', counter: 'repair_counter', req: 'repair_requests' },
    { history: 'it_request_history', counter: 'it_request_counter', req: 'it_requests' },
    { history: 'conference_history', counter: 'conference_counter', req: 'conference_bookings' },
    { history: 'security_history', counter: null, req: 'security_reports' },
    { history: 'daily_output_history', counter: null, req: 'daily_output' },
    { history: 'project_supply_history', counter: 'project_supply_counter', req: 'project_supply_requests' },
    { history: 'inspection_history', counter: 'inspection_counter', req: 'inspection_requests' },
  ];

  for (const t of historyCounterTables) {
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS ${t.history} (
          id SERIAL PRIMARY KEY,
          request_id INTEGER NOT NULL,
          user_id INTEGER,
          user_name TEXT,
          action TEXT NOT NULL,
          comment TEXT,
          old_status TEXT,
          new_status TEXT,
          created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
        );
      `);
    } catch (e) {}
    if (t.counter) {
      try {
        db.exec(`
          CREATE TABLE IF NOT EXISTS ${t.counter} (
            id SERIAL PRIMARY KEY,
            year INTEGER NOT NULL,
            last_number INTEGER DEFAULT 0,
            UNIQUE(year)
          );
        `);
      } catch (e) {}
    }
  }

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        endpoint TEXT NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
  } catch (e) {}

  const deptTables = ['purchase_requests', 'mission_requests', 'work_orders', 'payment_requests', 'repair_requests', 'inspection_requests', 'daily_output', 'project_supply_requests'];
  for (const tbl of deptTables) {
    try {
      db.exec(`ALTER TABLE ${tbl} ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id)`);
    } catch (e) {}
  }
  try { db.exec(`ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS reason TEXT`); } catch (e) {}
  try { db.exec(`ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS department TEXT`); } catch (e) {}
  try { db.exec(`ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS warehouse_id INTEGER`); } catch (e) {}
  try { db.exec(`ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS warehouse_comment TEXT`); } catch (e) {}
  try { db.exec(`ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS warehouse_date TEXT`); } catch (e) {}
  try { db.exec(`ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS factory_manager_id INTEGER`); } catch (e) {}
  try { db.exec(`ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS factory_manager_comment TEXT`); } catch (e) {}
  try { db.exec(`ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS factory_manager_date TEXT`); } catch (e) {}
  try { db.exec(`ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS budget_id INTEGER`); } catch (e) {}
  try { db.exec(`ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS budget_comment TEXT`); } catch (e) {}
  try { db.exec(`ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS budget_date TEXT`); } catch (e) {}
  try { db.exec(`ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS unit TEXT`); } catch (e) {}
  try { db.exec(`ALTER TABLE mission_requests ADD COLUMN IF NOT EXISTS start_time TEXT`); } catch (e) {}
  try { db.exec(`ALTER TABLE mission_requests ADD COLUMN IF NOT EXISTS end_time TEXT`); } catch (e) {}
  try { db.exec(`ALTER TABLE mission_requests ADD COLUMN IF NOT EXISTS mission_type TEXT`); } catch (e) {}
  try { db.exec(`ALTER TABLE mission_requests ADD COLUMN IF NOT EXISTS reason TEXT`); } catch (e) {}
  try { db.exec(`ALTER TABLE daily_output ADD COLUMN IF NOT EXISTS quality_score REAL`); } catch (e) {}
  try { db.exec(`ALTER TABLE daily_output ADD COLUMN IF NOT EXISTS machine_number TEXT`); } catch (e) {}
  try { db.exec(`ALTER TABLE daily_output ADD COLUMN IF NOT EXISTS product_type TEXT`); } catch (e) {}

  const existingDept = db.prepare('SELECT id FROM departments LIMIT 1').get();
  if (!existingDept) {
    db.prepare('INSERT INTO departments (name, parent_id) VALUES (?, ?)').run('بدون واحد', null);
  }

  const existingAdmin = db.prepare("SELECT id FROM users WHERE role = 'admin'").get();
  if (!existingAdmin) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare("INSERT INTO users (id, password, full_name, role, department_id, must_change_password) VALUES (?, ?, ?, ?, ?, 1)").run(1000, hash, 'مدیر سیستم', 'admin', 1);
    
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
    db.exec(`
      CREATE TABLE IF NOT EXISTS csv_imports_log (
        id SERIAL PRIMARY KEY,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        imported_by INTEGER NOT NULL,
        imported_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text),
        row_count INTEGER NOT NULL,
        FOREIGN KEY (imported_by) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
  } catch (e) {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        key TEXT UNIQUE NOT NULL,
        value TEXT,
        updated_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text)
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
    "CREATE INDEX IF NOT EXISTS idx_letter_attachments_letter ON letter_attachments(letter_id)",
    "CREATE INDEX IF NOT EXISTS idx_overtime_user ON overtime_requests(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_overtime_status ON overtime_requests(status)",
    "CREATE INDEX IF NOT EXISTS idx_overtime_user_status ON overtime_requests(user_id, status)",
    "CREATE INDEX IF NOT EXISTS idx_leave_change_action_by ON leave_change_logs(action_by)",
    "CREATE INDEX IF NOT EXISTS idx_leave_change_target ON leave_change_logs(target_id)",
    "CREATE INDEX IF NOT EXISTS idx_letter_history_letter ON letter_history(letter_id)",
    "CREATE INDEX IF NOT EXISTS idx_job_app_status ON job_applications(status)",
    "CREATE INDEX IF NOT EXISTS idx_user_shift_user ON user_shift_assignments(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_shift_req_user ON shift_change_requests(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_purchase_user ON purchase_requests(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_purchase_status ON purchase_requests(status)",
    "CREATE INDEX IF NOT EXISTS idx_mission_user ON mission_requests(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_mission_status ON mission_requests(status)",
    "CREATE INDEX IF NOT EXISTS idx_work_order_user ON work_orders(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_work_order_status ON work_orders(status)",
    "CREATE INDEX IF NOT EXISTS idx_payment_user ON payment_requests(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_payment_status ON payment_requests(status)",
    "CREATE INDEX IF NOT EXISTS idx_repair_user ON repair_requests(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_repair_status ON repair_requests(status)",
    "CREATE INDEX IF NOT EXISTS idx_it_user ON it_requests(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_it_status ON it_requests(status)",
    "CREATE INDEX IF NOT EXISTS idx_conference_user ON conference_bookings(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_security_user ON security_reports(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_daily_output_user ON daily_output(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_project_supply_user ON project_supply_requests(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_inspection_user ON inspection_requests(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_activity_log_module ON activity_log(module_name)",
    "CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id)",
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
