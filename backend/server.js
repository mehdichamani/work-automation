require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { exec, execFile } = require('child_process');
const { initDatabase } = require('./database/init');
const { authMiddleware, auditLog } = require('./middleware/auth');

let server;

async function startServer() {
  const db = await initDatabase();

  // Initialize backup cron
  const backupCron = require('./backup/cron');
  backupCron.init(db);
  backupCron.schedule();

  const app = express();
  const PORT = process.env.PORT || 2833;

  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:2833',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }));

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'تعداد تلاش‌های ورود بیش از حد مجاز است. لطفاً ۱۵ دقیقه صبر کنید' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/auth/login', loginLimiter);

  const passwordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'تعداد تلاش‌های تغییر رمز بیش از حد مجاز است. لطفاً ۱۵ دقیقه صبر کنید' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/auth/change-password', passwordLimiter);
  app.use('/api/profile/change-password', passwordLimiter);

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Global WebSocket mutation broadcast middleware
  app.use((req, res, next) => {
    res.on('finish', () => {
      if (['POST', 'PUT', 'DELETE'].includes(req.method) && res.statusCode >= 200 && res.statusCode < 300) {
        if (global.io) {
          const urlParts = req.originalUrl.split('/');
          let module = 'general';
          if (urlParts.length > 2) module = urlParts[2];
          global.io.emit('update', { module, method: req.method, path: req.originalUrl });
        }
      }
    });
    next();
  });

  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

  app.use('/api', auditLog(db));

  app.use('/api/auth', require('./routes/auth')(db));
  app.use('/api/admin', require('./routes/admin')(db));
  app.use('/api/leave', require('./routes/leave')(db));
  app.use('/api/overtime', require('./routes/overtime')(db));
  app.use('/api/letters', require('./routes/letters')(db));
  app.use('/api/inventory', require('./routes/inventory')(db));
  app.use('/api/restaurant', require('./routes/restaurant')(db));
  app.use('/api/notifications', require('./routes/notifications')(db));
  app.use('/api/backup', require('./routes/backup')(db));
  app.use('/api/permissions', require('./routes/permissions')(db));
  app.use('/api/announcements', require('./routes/announcements')(db));
  app.use('/api/job-applications', require('./routes/jobApplications')(db));
  app.use('/api/camera', require('./routes/camera')(db));
  app.use('/api/shifts', require('./routes/shifts')(db));
  app.use('/api/purchase', require('./routes/purchase')(db));
  app.use('/api/mission', require('./routes/mission')(db));
  app.use('/api/work-order', require('./routes/workOrder')(db));
  app.use('/api/payment', require('./routes/payment')(db));
  app.use('/api/repair', require('./routes/repair')(db));
  app.use('/api/repair-external', require('./routes/repairExternal')(db));
  app.use('/api/it', require('./routes/itRequest')(db));
  app.use('/api/conference', require('./routes/conference')(db));
  app.use('/api/security', require('./routes/security')(db));
  app.use('/api/daily-output', require('./routes/dailyOutput')(db));
  app.use('/api/project-supply', require('./routes/projectSupply')(db));
  app.use('/api/inspection', require('./routes/inspection')(db));
  app.use('/api/reports', require('./routes/reports')(db));
  app.use('/api/audit-log', require('./routes/auditLog')(db));
  app.use('/api/profile', require('./routes/profile')(db));
  app.use('/api/push', require('./routes/push')(db));
  app.use('/api/upload', require('./routes/upload')(db));
  app.use('/api/sms', require('./routes/smsAuth')(db));
  app.use('/api/workflow', require('./routes/workflow')(db));
  app.use('/api/signature', require('./routes/signature')(db));
  app.use('/api/chat', require('./routes/chat')(db));
  app.use('/api/daily-work-report', require('./routes/dailyWorkReport')(db));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', company: 'اروم شیشه ساچی', timestamp: new Date().toISOString() });
  });

  // Serve static files from the React frontend build
  const frontendDistPath = path.join(__dirname, '..', 'frontend', 'dist');
  console.log('Serving frontend build from:', frontendDistPath);
  app.use(express.static(frontendDistPath));

  app.get('/', (req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'), (err) => {
      if (err) {
        res.status(404).send('فرانت‌اند هنوز بیلد نشده است. لطفاً دستور npm run build را در پوشه frontend اجرا کنید.');
      }
    });
  });

  app.post('/api/admin/server-restart', authMiddleware, (req, res) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'فقط مدیر سیستم می‌تواند سرور را ری‌استارت کند' });
    }
    res.json({ message: 'سرور در حال ری‌استارت...' });
    setTimeout(() => {
      if (process.env.pm_id !== undefined) {
        exec('pm2 restart edari-backend', (err) => {
          if (err) {
            console.error('Failed to restart server via PM2:', err);
            process.exit(1);
          }
        });
      } else {
        const child = execFile(process.execPath, [require('path').join(__dirname, 'server.js')], {
          cwd: __dirname,
          detached: true,
          stdio: 'ignore'
        });
        child.unref();
        server.close(() => process.exit(0));
      }
    }, 500);
  });

  // Fallback wildcard to serve React Router SPA pages
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.sendFile(path.join(frontendDistPath, 'index.html'), (err) => {
      if (err) {
        res.status(404).send('فرانت‌اند هنوز بیلد نشده است. لطفاً دستور npm run build را در پوشه frontend اجرا کنید.');
      }
    });
  });

  const http = require('http');
  const httpServer = http.createServer(app);
  const { Server } = require('socket.io');
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:2833',
      methods: ['GET', 'POST']
    }
  });

  global.io = io;

  io.on('connection', (socket) => {
    socket.on('disconnect', () => {});
  });

  server = httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`\n========================================`);
    console.log(`  سیستم اتوماسیون اداری اروم شیشه ساچی`);
    console.log(`  Server running on port ${PORT}`);
    console.log(`  http://localhost:${PORT}`);
    console.log(`========================================\n`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
