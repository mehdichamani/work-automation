const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const prisma = require('../database/prisma');
const { mapRow } = require('../utils/dbAdapter');
const { authMiddleware, roleGuard } = require('../middleware/auth');
const { runBackup, getBackupConfig } = require('../backup/index');
const backupCron = require('../backup/cron');
const { getDbConfig } = require('../database/config');

const BACKUP_DIR = path.join(__dirname, '..', 'backups');

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

module.exports = function () {
  const router = express.Router();
  router.use(authMiddleware);
  router.use(roleGuard('admin'));

  // ─── NEW automated backup endpoints (MUST be before /:filename) ───
  router.get('/settings', async (req, res) => {
    try {
      const row = await prisma.backupSetting.findUnique({ where: { id: 1 } });
      if (!row) {
        const def = getBackupConfig();
        return res.json({
          daily_path: def.dailyPath, weekly_path: def.weeklyPath,
          daily_hour: 23, daily_minute: 0,
          weekly_day: 5, weekly_hour: 14, weekly_minute: 0,
          daily_retention_days: 30, weekly_retention_weeks: 12,
          daily_enabled: 1, weekly_enabled: 1,
        });
      }
      res.json(mapRow(row));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/settings', async (req, res) => {
    try {
      const {
        daily_path, weekly_path, daily_hour, daily_minute,
        weekly_day, weekly_hour, weekly_minute,
        daily_retention_days, weekly_retention_weeks,
        daily_enabled, weekly_enabled
      } = req.body;
      const def = getBackupConfig();
      const data = {
        dailyPath: daily_path || def.dailyPath,
        weeklyPath: weekly_path || def.weeklyPath,
        dailyHour: Number(daily_hour ?? 23),
        dailyMinute: Number(daily_minute ?? 0),
        weeklyDay: Number(weekly_day ?? 5),
        weeklyHour: Number(weekly_hour ?? 14),
        weeklyMinute: Number(weekly_minute ?? 0),
        dailyRetentionDays: Number(daily_retention_days ?? 30),
        weeklyRetentionWeeks: Number(weekly_retention_weeks ?? 12),
        dailyEnabled: daily_enabled ? true : false,
        weeklyEnabled: weekly_enabled ? true : false,
      };
      await prisma.backupSetting.upsert({
        where: { id: 1 },
        update: data,
        create: data,
      });
      backupCron.init();
      await backupCron.schedule();
      res.json({ success: true, message: 'تنظیمات بکاپ ذخیره شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/run/:type', async (req, res) => {
    try {
      const type = req.params.type;
      if (type !== 'daily' && type !== 'weekly') {
        return res.status(400).json({ error: 'نوع بکاپ نامعتبر (daily یا weekly)' });
      }
      // Pass DB config so runBackup uses admin settings
      const cfg = await backupCron.loadConfigFromDB();
      const result = await runBackup(type, cfg);
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
            createdBy: req.user ? Number(req.user.id) : null,
          },
        });
      } catch (logErr) {
        console.error('[Backup] Failed to log manual backup:', logErr.message);
      }
      res.json({ success: true, result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/logs', async (req, res) => {
    try {
      const { page = 1, limit = 20 } = req.query;
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;
      const total = await prisma.backupLog.count();
      const logs = await prisma.backupLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: limitNum,
        skip: offset,
      });
      res.json({ logs: mapRow(logs), total, page: pageNum, limit: limitNum });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/status', async (req, res) => {
    try {
      const status = backupCron.getStatus();
      res.json(status);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── OLD manual backup endpoints ───
  router.post('/create', async (req, res) => {
    try {
      ensureBackupDir();
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const filename = `edari_backup_${ts}.sql`;
      const backupPath = path.join(BACKUP_DIR, filename);
      const cfg = getDbConfig();
      if (!cfg) return res.status(500).json({ error: 'DATABASE_URL not set' });

      const pgDumpCmd = `pg_dump -h "${cfg.host}" -p "${cfg.port}" -U "${cfg.user}" -d "${cfg.database}" -f "${backupPath}" --no-owner --no-privileges`;
      const env = { ...process.env, PGPASSWORD: cfg.password };
      exec(pgDumpCmd, { env }, async (err) => {
        if (err) {
          try {
            const tables = await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`;
            let sql = '-- Edari Backup\n-- ' + new Date().toISOString() + '\n\n';
            for (const t of tables) {
              const tableName = t.table_name;
              if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) continue;
              const rows = await prisma.$queryRawUnsafe(`SELECT * FROM "${tableName}"`);
              if (rows.length > 0) {
                const cols = Object.keys(rows[0]);
                sql += `TRUNCATE "${tableName}" CASCADE;\n`;
                for (const row of rows) {
                  const vals = cols.map(c => {
                    const v = row[c];
                    if (v === null) return 'NULL';
                    if (typeof v === 'number') return v;
                    return `'${String(v).replace(/'/g, "''")}'`;
                  });
                  sql += `INSERT INTO "${tableName}" (${cols.map(c => `"${c}"`).join(',')}) VALUES (${vals.join(',')});\n`;
                }
                sql += '\n';
              }
            }
            fs.writeFileSync(backupPath, sql, 'utf8');
            const stat = fs.statSync(backupPath);
            res.json({ message: 'بکاپ با موفقیت ایجاد شد', filename, size: stat.size });
          } catch (fallbackErr) {
            res.status(500).json({ error: 'خطا در ایجاد بکاپ: ' + fallbackErr.message });
          }
          return;
        }
        const stat = fs.statSync(backupPath);
        res.json({ message: 'بکاپ با موفقیت ایجاد شد', filename, size: stat.size });
      });
    } catch (err) {
      res.status(500).json({ error: 'خطا در ایجاد بکاپ: ' + err.message });
    }
  });

  router.get('/list', (req, res) => {
    try {
      ensureBackupDir();
      const files = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.endsWith('.sql') || f.endsWith('.db'))
        .map(f => {
          const stat = fs.statSync(path.join(BACKUP_DIR, f));
          return { filename: f, size: stat.size, created: stat.mtime };
        })
        .sort((a, b) => new Date(b.created) - new Date(a.created));
      res.json(files);
    } catch (err) {
      res.status(500).json({ error: 'خطا در لیست بکاپ‌ها: ' + err.message });
    }
  });

  router.get('/download/:filename', (req, res) => {
    try {
      const filename = path.basename(req.params.filename);
      if ((!filename.endsWith('.sql') && !filename.endsWith('.db')) || filename.includes('..')) {
        return res.status(400).json({ error: 'نام فایل نامعتبر' });
      }
      const filePath = path.join(BACKUP_DIR, filename);
      if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'فایل بکاپ یافت نشد' });
      res.download(filePath, filename);
    } catch (err) {
      res.status(500).json({ error: 'خطا در دانلود: ' + err.message });
    }
  });

  router.post('/restore/:filename', async (req, res) => {
    try {
      const filename = path.basename(req.params.filename);
      if ((!filename.endsWith('.sql') && !filename.endsWith('.db')) || filename.includes('..')) {
        return res.status(400).json({ error: 'نام فایل نامعتبر' });
      }
      const backupPath = path.join(BACKUP_DIR, filename);
      if (!fs.existsSync(backupPath)) return res.status(404).json({ error: 'فایل بکاپ یافت نشد' });

      const cfg = getDbConfig();
      if (!cfg) return res.status(500).json({ error: 'DATABASE_URL not set' });
      const env = { ...process.env, PGPASSWORD: cfg.password };

      if (filename.endsWith('.sql')) {
        const psqlCmd = `psql -h "${cfg.host}" -p "${cfg.port}" -U "${cfg.user}" -d "${cfg.database}" -f "${backupPath}" --set ON_ERROR_STOP=off`;
        exec(psqlCmd, { env }, (err, stdout, stderr) => {
          if (err) return res.status(500).json({ error: 'خطا در بازیابی: ' + (stderr || err.message) });
          res.json({ message: 'بکاپ با موفقیت بازیابی شد', restoredFrom: filename });
        });
      } else {
        return res.status(400).json({ error: 'فایل‌های .db قدیمی پشتیبانی نمی‌شوند' });
      }
    } catch (err) {
      res.status(500).json({ error: 'خطا در بازیابی: ' + err.message });
    }
  });

  // DELETE must be last (matches everything)
  router.delete('/:filename', (req, res) => {
    try {
      const filename = path.basename(req.params.filename);
      if ((!filename.endsWith('.sql') && !filename.endsWith('.db')) || filename.includes('..')) {
        return res.status(400).json({ error: 'نام فایل نامعتبر' });
      }
      const filePath = path.join(BACKUP_DIR, filename);
      if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'فایل بکاپ یافت نشد' });
      fs.unlinkSync(filePath);
      res.json({ message: 'بکاپ حذف شد' });
    } catch (err) {
      res.status(500).json({ error: 'خطا در حذف بکاپ: ' + err.message });
    }
  });

  return router;
};
