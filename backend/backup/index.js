const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execSync } = require('child_process');
const { ZipArchive } = require('archiver');

const BACKUP_BASE = path.join(__dirname, '..', 'backups');
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const MANIFEST_FILE = path.join(BACKUP_BASE, 'manifest.json');

function getDbConfig() {
  const url = process.env.DATABASE_URL || '';
  // Handle URLs with query params like ?schema=public
  const dbPart = url.replace(/^postgresql:\/\//, '');
  const match = dbPart.match(/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
  if (match) {
    return { user: match[1], password: match[2], host: match[3], port: match[4], database: match[5] };
  }
  return null;
}

function loadManifest() {
  try {
    if (fs.existsSync(MANIFEST_FILE)) {
      return JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
    }
  } catch {}
  return {};
}

function saveManifest(manifest) {
  try {
    fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
  } catch (e) {
    console.error('[Backup] Failed to save manifest:', e.message);
  }
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function runPgDump(outputFile) {
  const cfg = getDbConfig();
  if (!cfg) throw new Error('DATABASE_URL not configured');

  const cmd = `pg_dump -h "${cfg.host}" -p "${cfg.port}" -U "${cfg.user}" -d "${cfg.database}" -f "${outputFile}" --no-owner --no-privileges`;
  execSync(cmd, { env: { ...process.env, PGPASSWORD: cfg.password }, timeout: 300000 });
}

function gzipFile(inputFile) {
  const outputFile = inputFile + '.gz';
  const input = fs.readFileSync(inputFile);
  const compressed = zlib.gzipSync(input, { level: 9 });
  fs.writeFileSync(outputFile, compressed);
  fs.unlinkSync(inputFile);
  return outputFile;
}

async function backupUploadsIncremental(backupDir, type) {
  const manifest = loadManifest();
  const newManifest = {};
  let fileCount = 0;
  let totalSize = 0;

  const archive = new ZipArchive({ zlib: { level: 6 } });
  const zipPath = path.join(backupDir, `uploads_${type}.zip`);

  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    output.on('close', resolve);
    output.on('error', reject);
    archive.pipe(output);

    function walk(dir, base = '') {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.join(base, entry.name);

        if (entry.isDirectory()) {
          walk(fullPath, relPath);
        } else if (entry.isFile()) {
          const stat = fs.statSync(fullPath);
          const key = relPath;
          const mtime = stat.mtimeMs;
          const size = stat.size;

          newManifest[key] = { mtime, size };

          const prev = manifest[key];
          if (!prev || prev.mtime !== mtime || prev.size !== size) {
            archive.file(fullPath, { name: relPath });
            fileCount++;
            totalSize += size;
          }
        }
      }
    }

    if (fs.existsSync(UPLOADS_DIR)) {
      walk(UPLOADS_DIR);
    }

    archive.finalize();
  });

  saveManifest(newManifest);

  const stats = fs.statSync(zipPath);
  return { zipPath, fileCount, totalSize, zipSize: stats.size };
}

async function backupUploadsFull(backupDir, type) {
  const zipPath = path.join(backupDir, `uploads_${type}.zip`);

  const archive = new ZipArchive({ zlib: { level: 6 } });
  let fileCount = 0;
  let totalSize = 0;

  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    output.on('close', resolve);
    output.on('error', reject);
    archive.pipe(output);

    function walk(dir, base = '') {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.join(base, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath, relPath);
        } else if (entry.isFile()) {
          const stat = fs.statSync(fullPath);
          archive.file(fullPath, { name: relPath });
          fileCount++;
          totalSize += stat.size;
        }
      }
    }

    if (fs.existsSync(UPLOADS_DIR)) {
      walk(UPLOADS_DIR);
    }
    archive.finalize();
  });

  // Update manifest with all files
  const manifest = {};
  function updateManifest(dir, base = '') {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.join(base, entry.name);
      if (entry.isDirectory()) {
        updateManifest(fullPath, relPath);
      } else if (entry.isFile()) {
        const stat = fs.statSync(fullPath);
        manifest[relPath] = { mtime: stat.mtimeMs, size: stat.size };
      }
    }
  }
  updateManifest(UPLOADS_DIR);
  saveManifest(manifest);

  const stats = fs.statSync(zipPath);
  return { zipPath, fileCount, totalSize, zipSize: stats.size };
}

async function runBackup(type, dbConfig) {
  // Use DB config if provided, otherwise fallback to defaults
  const cfg = dbConfig || getBackupConfig();
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;

  const baseDir = type === 'daily' ? cfg.dailyPath : cfg.weeklyPath;
  const backupDir = path.join(baseDir, dateStr);
  ensureDir(backupDir);

  console.log(`[Backup] Starting ${type} backup to ${backupDir}`);

  // 1. Database dump
  console.log('[Backup] Dumping database...');
  const sqlFile = path.join(backupDir, `edari_${dateStr}.sql`);
  runPgDump(sqlFile);
  const gzFile = gzipFile(sqlFile);
  const dbStats = fs.statSync(gzFile);
  console.log(`[Backup] DB dump: ${(dbStats.size / 1024 / 1024).toFixed(2)} MB`);

  // 2. Uploads backup
  console.log('[Backup] Backing up uploads...');
  let uploadResult;
  if (type === 'daily') {
    uploadResult = await backupUploadsIncremental(backupDir, dateStr);
  } else {
    uploadResult = await backupUploadsFull(backupDir, dateStr);
  }
  console.log(`[Backup] Uploads: ${uploadResult.fileCount} files, ${(uploadResult.zipSize / 1024 / 1024).toFixed(2)} MB`);

  // 3. Cleanup old backups
  await cleanupOldBackups(type, baseDir, cfg);

  return {
    type,
    date: dateStr,
    backupDir,
    dbFile: path.basename(gzFile),
    dbSize: dbStats.size,
    uploadsFile: path.basename(uploadResult.zipPath),
    uploadsSize: uploadResult.zipSize,
    uploadsFiles: uploadResult.fileCount
  };
}

async function cleanupOldBackups(type, baseDir, cfg) {
  const config = cfg || getBackupConfig();
  const keepDays = type === 'daily' ? config.dailyRetentionDays : config.weeklyRetentionWeeks * 7;
  const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000;

  if (!fs.existsSync(baseDir)) return;

  for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dirPath = path.join(baseDir, entry.name);
    try {
      const stat = fs.statSync(dirPath);
      if (stat.mtimeMs < cutoff) {
        console.log(`[Backup] Removing old ${type} backup: ${entry.name}`);
        fs.rmSync(dirPath, { recursive: true, force: true });
      }
    } catch {}
  }
}

function getBackupConfig() {
  // Default config - will be overridden by DB settings if available
  return {
    dailyPath: path.join(process.env.USERPROFILE || process.env.HOME || '.', 'Documents', 'edari-backups', 'daily'),
    weeklyPath: path.join(process.env.USERPROFILE || process.env.HOME || '.', 'Documents', 'edari-backups', 'weekly'),
    dailyHour: 23,
    dailyMinute: 0,
    weeklyDay: 5, // Friday
    weeklyHour: 14,
    weeklyMinute: 0,
    dailyRetentionDays: 30,
    weeklyRetentionWeeks: 12
  };
}

module.exports = { runBackup, getBackupConfig, loadManifest, saveManifest };