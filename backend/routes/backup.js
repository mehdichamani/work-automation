const express = require('express');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { authMiddleware, roleGuard } = require('../middleware/auth');
const { getDbConfig } = require('../database/config');

const BACKUP_DIR = path.join(__dirname, '..', 'backups');

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function safeFilename(value) {
  const filename = path.basename(String(value || ''));
  if (!filename || filename.includes('..')) return null;
  if (!filename.endsWith('.sql')) return null;
  return filename;
}

function resolvePostgresBinary(command) {
  const candidates = [];
  const envPath = process.env.PATH || '';
  envPath.split(path.delimiter)
    .filter(Boolean)
    .forEach(dir => {
      candidates.push(path.join(dir, command));
      candidates.push(path.join(dir, `${command}.exe`));
    });

  const windowsRoots = [
    'C:\Program Files\PostgreSQL',
    'C:\Program Files\PostgreSQL\\',
    'C:\Program Files',
    'C:\PostgreSQL'
  ];

  windowsRoots.forEach(root => {
    if (!root) return;
    for (let i = 16; i >= 9; i -= 1) {
      candidates.push(path.join(root, String(i), 'bin', command));
      candidates.push(path.join(root, String(i), 'bin', `${command}.exe`));
    }
    candidates.push(path.join(root, 'bin', command));
    candidates.push(path.join(root, 'bin', `${command}.exe`));
  });

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return command;
}

function buildTimestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function runCommand(command, args, env) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { env }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr && String(stderr).trim() ? String(stderr).trim() : error.message));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

module.exports = function () {
  const router = express.Router();
  router.use(authMiddleware);
  router.use(roleGuard('admin'));

  router.post('/create', async (req, res) => {
    try {
      ensureBackupDir();
      const cfg = getDbConfig();
      if (!cfg || !cfg.database) {
        return res.status(500).json({ error: 'تنظیمات پایگاه‌داده پیدا نشد' });
      }

      const filename = `edari_backup_${buildTimestamp()}.sql`;
      const backupPath = path.join(BACKUP_DIR, filename);
      const pgDumpBinary = resolvePostgresBinary('pg_dump');
      const pgDumpArgs = [
        '-h', cfg.host,
        '-p', String(cfg.port),
        '-U', cfg.user,
        '-d', cfg.database,
        '-f', backupPath,
        '--clean',
        '--if-exists',
        '--no-owner',
        '--no-privileges'
      ];

      await runCommand(pgDumpBinary, pgDumpArgs, { ...process.env, PGPASSWORD: cfg.password });

      const stat = fs.statSync(backupPath);
      res.json({
        message: 'بکاپ با موفقیت ایجاد شد',
        filename,
        size: stat.size,
        path: BACKUP_DIR
      });
    } catch (err) {
      res.status(500).json({ error: 'خطا در ایجاد بکاپ: ' + err.message });
    }
  });

  router.get('/list', (req, res) => {
    try {
      ensureBackupDir();
      const files = fs.readdirSync(BACKUP_DIR)
        .filter(file => file.endsWith('.sql'))
        .map(file => {
          const filePath = path.join(BACKUP_DIR, file);
          const stat = fs.statSync(filePath);
          return { filename: file, size: stat.size, created: stat.mtime };
        })
        .sort((a, b) => new Date(b.created) - new Date(a.created));

      res.json(files);
    } catch (err) {
      res.status(500).json({ error: 'خطا در لیست بکاپ‌ها: ' + err.message });
    }
  });

  router.get('/download/:filename', (req, res) => {
    try {
      const filename = safeFilename(req.params.filename);
      if (!filename) {
        return res.status(400).json({ error: 'نام فایل نامعتبر است' });
      }

      const filePath = path.join(BACKUP_DIR, filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'فایل بکاپ یافت نشد' });
      }

      res.download(filePath, filename);
    } catch (err) {
      res.status(500).json({ error: 'خطا در دانلود بکاپ: ' + err.message });
    }
  });

  router.post('/restore/:filename', async (req, res) => {
    try {
      const filename = safeFilename(req.params.filename);
      if (!filename) {
        return res.status(400).json({ error: 'نام فایل نامعتبر است' });
      }

      const backupPath = path.join(BACKUP_DIR, filename);
      if (!fs.existsSync(backupPath)) {
        return res.status(404).json({ error: 'فایل بکاپ یافت نشد' });
      }

      const cfg = getDbConfig();
      if (!cfg || !cfg.database) {
        return res.status(500).json({ error: 'تنظیمات پایگاه‌داده پیدا نشد' });
      }

      const psqlBinary = resolvePostgresBinary('psql');

      // اجرای DROP SCHEMA public CASCADE و ساخت مجدد آن جهت اطمینان از پاک‌سازی کامل قبل از بازیابی
      const resetSchemaSql = 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;';
      try {
        await runCommand(psqlBinary, [
          '-h', cfg.host,
          '-p', String(cfg.port),
          '-U', cfg.user,
          '-d', cfg.database,
          '-c', resetSchemaSql
        ], { ...process.env, PGPASSWORD: cfg.password });
      } catch (schemaErr) {
        console.warn('هشدار در ریست اسکیما قبل از بازیابی:', schemaErr.message);
      }

      const psqlArgs = [
        '-h', cfg.host,
        '-p', String(cfg.port),
        '-U', cfg.user,
        '-d', cfg.database,
        '-f', backupPath,
        '--set', 'ON_ERROR_STOP=off'
      ];

      await runCommand(psqlBinary, psqlArgs, { ...process.env, PGPASSWORD: cfg.password });

      res.json({ message: 'بکاپ با موفقیت بازیابی شد', restoredFrom: filename });
    } catch (err) {
      res.status(500).json({ error: 'خطا در بازیابی بکاپ: ' + err.message });
    }
  });

  router.delete('/:filename', (req, res) => {
    try {
      const filename = safeFilename(req.params.filename);
      if (!filename) {
        return res.status(400).json({ error: 'نام فایل نامعتبر است' });
      }

      const filePath = path.join(BACKUP_DIR, filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'فایل بکاپ یافت نشد' });
      }

      fs.unlinkSync(filePath);
      res.json({ message: 'بکاپ حذف شد', filename });
    } catch (err) {
      res.status(500).json({ error: 'خطا در حذف بکاپ: ' + err.message });
    }
  });

  return router;
};
