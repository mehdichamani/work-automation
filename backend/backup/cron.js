const cron = require('node-cron');
const path = require('path');
const { homedir } = require('os');
const prisma = require('../database/prisma');
const { runBackup } = require('./index');

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

async function loadConfigFromDB() {
  const def = getDefaultConfig();
  try {
    const row = await prisma.backupSetting.findUnique({ where: { id: 1 } });
    if (row) {
      return {
        dailyPath: row.dailyPath || def.dailyPath,
        weeklyPath: row.weeklyPath || def.weeklyPath,
        dailyHour: row.dailyHour ?? 23,
        dailyMinute: row.dailyMinute ?? 0,
        weeklyDay: row.weeklyDay ?? 5,
        weeklyHour: row.weeklyHour ?? 14,
        weeklyMinute: row.weeklyMinute ?? 0,
        dailyRetentionDays: row.dailyRetentionDays ?? 30,
        weeklyRetentionWeeks: row.weeklyRetentionWeeks ?? 12,
        dailyEnabled: row.dailyEnabled ?? true,
        weeklyEnabled: row.weeklyEnabled ?? true,
      };
    }
  } catch (e) {
    console.error('[Backup] Failed to load config from DB:', e.message);
  }
  return def;
}

let scheduledJobs = [];

async function schedule() {
  scheduledJobs.forEach(job => job.stop());
  scheduledJobs = [];

  const cfg = await loadConfigFromDB();

  if (cfg.dailyEnabled) {
    const dailyExpr = `${cfg.dailyMinute} ${cfg.dailyHour} * * *`;
    const job = cron.schedule(dailyExpr, async () => {
      console.log('[Backup] Starting scheduled daily backup...');
      try {
        const latestCfg = await loadConfigFromDB();
        const result = await runBackup('daily', latestCfg);
        console.log('[Backup] Daily backup completed:', result);
        await logBackup(result);
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
        const latestCfg = await loadConfigFromDB();
        const result = await runBackup('weekly', latestCfg);
        console.log('[Backup] Weekly backup completed:', result);
        await logBackup(result);
      } catch (e) {
        console.error('[Backup] Weekly backup failed:', e.message);
      }
    }, { timezone: 'Asia/Tehran' });
    scheduledJobs.push(job);
    console.log(`[Backup] Weekly backup scheduled: ${weeklyExpr} (Asia/Tehran)`);
  }
}

async function logBackup(result) {
  try {
    await prisma.backupLog.create({
      data: {
        type: result.type,
        date: result.date,
        dbFile: result.dbFile,
        dbSize: result.dbSize,
        uploadsFile: result.uploadsFile,
        uploadsSize: result.uploadsSize,
        uploadsFiles: result.uploadsFiles,
        backupDir: result.backupDir,
        status: 'success',
        error: '',
      },
    });
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

module.exports = { init: () => {}, schedule, getStatus, loadConfigFromDB };
