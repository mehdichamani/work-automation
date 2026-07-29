const moment = require('moment-jalaali');

function notify(db, userId, title, body, link) {
  db.prepare('INSERT INTO notifications (user_id, title, body, link) VALUES (?, ?, ?, ?)').run(userId, title, body, link);
}

function notifyAll(db, role, title, body, link) {
  const users = db.prepare("SELECT id FROM users WHERE role = ? AND is_active = 1").all(role);
  users.forEach(u => notify(db, u.id, title, body, link));
}

function findSupervisorId(db, departmentId) {
  if (!departmentId) return null;
  const dept = db.prepare('SELECT parent_id FROM departments WHERE id = ?').get(departmentId);
  if (!dept || !dept.parent_id) return null;
  const sup = db.prepare('SELECT id FROM users WHERE department_id = ? AND role = ? LIMIT 1').get(dept.parent_id, 'supervisor');
  return sup ? sup.id : null;
}

function getNextNumber(db, counterTable, prefix) {
  const ALLOWED_COUNTERS = ['purchase_counter','mission_counter','work_order_counter','payment_counter','repair_counter','it_request_counter','conference_counter','project_supply_requests_counter','inspection_counter','letter_counter'];
  if (!ALLOWED_COUNTERS.includes(counterTable)) throw new Error('Invalid counter table');
  const jalaliYear = moment().jYear();
  db.prepare('BEGIN').run();
  try {
    const counter = db.prepare(`SELECT * FROM ${counterTable} WHERE year = ?`).get(jalaliYear);
    let nextNumber = 1;
    if (counter) {
      nextNumber = counter.last_number + 1;
      db.prepare(`UPDATE ${counterTable} SET last_number = ? WHERE year = ?`).run(nextNumber, jalaliYear);
    } else {
      db.prepare(`INSERT INTO ${counterTable} (year, last_number) VALUES (?, ?)`).run(jalaliYear, 1);
    }
    db.prepare('COMMIT').run();
    return `${prefix}-${jalaliYear}-${String(nextNumber).padStart(3, '0')}`;
  } catch(e) {
    db.prepare('ROLLBACK').run();
    throw e;
  }
}

function addHistory(db, table, idColumn, recordId, userId, userName, action, comment) {
  const ALLOWED_HISTORY_TABLES = ['purchase_history','mission_history','work_order_history','payment_history','repair_history','repair_external_history','it_request_history','conference_history','project_supply_requests_history','inspection_history','letter_history'];
  if (!ALLOWED_HISTORY_TABLES.includes(table)) throw new Error('Invalid history table');
  const ALLOWED_ID_COLUMNS = ['request_id'];
  if (!ALLOWED_ID_COLUMNS.includes(idColumn)) throw new Error('Invalid id column');
  db.prepare(`INSERT INTO ${table} (${idColumn}, user_id, user_name, action, comment) VALUES (?, ?, ?, ?, ?)`)
    .run(recordId, userId, userName, action, comment || '');
}

module.exports = { notify, notifyAll, findSupervisorId, getNextNumber, addHistory };
