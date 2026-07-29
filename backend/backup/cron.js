const cron = require('node-cron');
const path = require('path');
const { homedir } = require('os');
const { runBackup } = require('./index');

let db = null;

function init(database) {
  db = database;
}

function getDefaultConfig() {
  const base = path.join(homedir(), 'Documents', 'edari-backups');
  return {
    dailyPath: path.join(base, 'daily'),
    weeklyPath: path.join(base, 'weekly'),
    dailyHour: 23,
    dailyMinute: 0,
    weeklyDay: 5,
    weeklyHour: 14,
    weeklyMinute: 0,
    dailyRetentionDays: 30,
    weeklyRetentionWeeks: 12,
    dailyEnabled: true,
    weeklyEnabled: true,
  };
}

function loadConfigFromDB() {
  if (!db) return getDefaultConfig();
  try {
    const row = db.prepare('SELECT * FROM backup_settings WHERE id = 1').get();
    if (row) {
      return {
        dailyPath: row.daily_path || getDefaultConfig().dailyPath,
        weeklyPath: row.weekly_path || getDefaultConfig().weeklyPath,
        dailyHour: row.daily_hour ?? 23,
        dailyMinute: row.daily_minute ?? 0,
        weeklyDay: row.weekly_day ?? 5,
        weeklyHour: row.weekly_hour ?? 14,
        weeklyMinute: row.weekly_minute ?? 0,
        dailyRetentionDays: row.daily_retention_days ?? 30,
        weeklyRetentionWeeks: row.weekly_retention_weeks ?? 12,
        dailyEnabled: row.daily_enabled ?? 1,
        weeklyEnabled: row.weekly_enabled ?? 1,
      };
    }
  } catch (e) {
    console.error('[Backup] Failed to load config from DB:', e.message);
  }
  return getDefaultConfig();
}

let scheduledJobs = [];

function schedule() {
  scheduledJobs.forEach(job => job.stop());
  scheduledJobs = [];

  const cfg = loadConfigFromDB();

  if (cfg.dailyEnabled) {
    const dailyExpr = `${cfg.dailyMinute} ${cfg.dailyHour} * * *`;
    const job = cron.schedule(dailyExpr, async () => {
      console.log('[Backup] Starting scheduled daily backup...');
      try {
        const latestCfg = loadConfigFromDB();
        const result = await runBackup('daily', latestCfg);
        console.log('[Backup] Daily backup completed:', result);
        logBackup(result);
      } catch (e) {
        console.error('[Backup] Daily backup failed:', e.message);
      }
    }, { timezone: 'Asia/Tehran' });
    scheduledJobs.push(job);
    console.log(`[Backup] Daily backup scheduled: ${dailyExpr} (Asia/Tehran)`);
  }

  if (cfg.weeklyEnabled) {
    const weeklyExpr = `${cfg.weeklyMinute} ${cfg.weeklyHour} * * ${cfg.weeklyDay}`;
    const job = cron.schedule(weeklyExpr, async () => {
      console.log('[Backup] Starting scheduled weekly backup...');
      try {
        const latestCfg = loadConfigFromDB();
        const result = await runBackup('weekly', latestCfg);
        console.log('[Backup] Weekly backup completed:', result);
        logBackup(result);
      } catch (e) {
        console.error('[Backup] Weekly backup failed:', e.message);
      }
    }, { timezone: 'Asia/Tehran' });
    scheduledJobs.push(job);
    console.log(`[Backup] Weekly backup scheduled: ${weeklyExpr} (Asia/Tehran)`);
  }
}

function logBackup(result) {
  if (!db) return;
  try {
    db.prepare(`
      INSERT INTO backup_logs (type, date, db_file, db_size, uploads_file, uploads_size, uploads_files, backup_dir, status, error)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'success', '')
    `).run(result.type, result.date, result.dbFile, result.dbSize, result.uploadsFile, result.uploadsSize, result.uploadsFiles, result.backupDir);
  } catch (e) {
    console.error('[Backup] Failed to log backup:', e.message);
  }
}

function getStatus() {
  return {
    jobs: scheduledJobs.length,
    nextRuns: scheduledJobs.map(j => j.nextDate())
  };
}

module.exports = { init, schedule, getStatus, loadConfigFromDB };
