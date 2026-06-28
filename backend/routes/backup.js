const express = require('express');
const fs = require('fs');
const path = require('path');
const { authMiddleware, roleGuard } = require('../middleware/auth');
const initSqlJs = require('sql.js');

const DB_PATH = path.join(__dirname, '..', 'database', 'edari.db');
const BACKUP_DIR = path.join(__dirname, '..', 'backups');

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

module.exports = function (db) {
  const router = express.Router();
  router.use(authMiddleware);
  router.use(roleGuard('admin'));

  router.post('/create', (req, res) => {
    try {
      ensureBackupDir();
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const filename = `edari_backup_${ts}.db`;
      const backupPath = path.join(BACKUP_DIR, filename);

      const data = db._db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(backupPath, buffer);

      res.json({ message: 'بکاپ با موفقیت ایجاد شد', filename, size: buffer.length });
    } catch (err) {
      res.status(500).json({ error: 'خطا در ایجاد بکاپ: ' + err.message });
    }
  });

  router.get('/list', (req, res) => {
    try {
      ensureBackupDir();
      const files = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.endsWith('.db'))
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
      if (!filename.endsWith('.db') || filename.includes('..')) {
        return res.status(400).json({ error: 'نام فایل نامعتبر' });
      }
      const filePath = path.join(BACKUP_DIR, filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'فایل بکاپ یافت نشد' });
      }
      res.download(filePath, filename);
    } catch (err) {
      res.status(500).json({ error: 'خطا در دانلود: ' + err.message });
    }
  });

  router.post('/restore/:filename', async (req, res) => {
    try {
      const filename = path.basename(req.params.filename);
      if (!filename.endsWith('.db') || filename.includes('..')) {
        return res.status(400).json({ error: 'نام فایل نامعتبر' });
      }
      const backupPath = path.join(BACKUP_DIR, filename);
      if (!fs.existsSync(backupPath)) {
        return res.status(404).json({ error: 'فایل بکاپ یافت نشد' });
      }

      const backupBuffer = fs.readFileSync(backupPath);
      const initSqlJsMod = await initSqlJs();
      const newDb = initSqlJsMod.Database(backupBuffer);
      newDb.exec('SELECT count(*) FROM sqlite_master WHERE type="table"');
      newDb.close();

      const currentData = Buffer.from(db._db.export());
      const safeBackup = path.join(BACKUP_DIR, `pre_restore_${Date.now()}.db`);
      fs.writeFileSync(safeBackup, currentData);

      const restoredDb = initSqlJsMod.Database(backupBuffer);
      db._db.close();
      db._db = restoredDb;

      fs.writeFileSync(DB_PATH, backupBuffer);

      res.json({ message: 'بکاپ با موفقیت بازیابی شد', restoredFrom: filename });
    } catch (err) {
      res.status(500).json({ error: 'خطا در بازیابی بکاپ: ' + err.message });
    }
  });

  router.delete('/:filename', (req, res) => {
    try {
      const filename = path.basename(req.params.filename);
      if (!filename.endsWith('.db') || filename.includes('..')) {
        return res.status(400).json({ error: 'نام فایل نامعتبر' });
      }
      const filePath = path.join(BACKUP_DIR, filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'فایل بکاپ یافت نشد' });
      }
      fs.unlinkSync(filePath);
      res.json({ message: 'بکاپ حذف شد' });
    } catch (err) {
      res.status(500).json({ error: 'خطا در حذف بکاپ: ' + err.message });
    }
  });

  return router;
};
