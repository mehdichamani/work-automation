require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const mongoSanitize = require('express-mongo-sanitize');
const path = require('path');
const { exec, execFile } = require('child_process');
const prisma = require('./database/prisma');
const { authMiddleware, auditLog } = require('./middleware/auth');

let server;

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 2833;

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'", "ws:", "wss:"],
        fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        upgradeInsecureRequests: null,
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: false,
  }));
  const isOriginAllowed = (origin) => {
    if (!origin) return true;

    if (process.env.CORS_ORIGIN === '*') return true;

    const envOrigins = (process.env.CORS_ORIGIN || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    if (envOrigins.includes(origin) || envOrigins.includes('*')) {
      return true;
    }

    try {
      const url = new URL(origin);
      const hostname = url.hostname;

      // Check if hostname matches any domain or wildcard listed in CORS_ORIGIN
      for (const item of envOrigins) {
        if (item === hostname) return true;
        if (item.startsWith('*.')) {
          const domain = item.slice(2);
          if (hostname === domain || hostname.endsWith('.' + domain)) return true;
        }
        if (item.startsWith('.')) {
          const domain = item.slice(1);
          if (hostname === domain || hostname.endsWith('.' + domain)) return true;
        }
      }

      // Allow localhost and local loopback
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
        return true;
      }

      // Allow uromsachi.ir and all subdomains
      if (hostname === 'uromsachi.ir' || hostname.endsWith('.uromsachi.ir')) {
        return true;
      }

      // Allow private IP address ranges (LAN)
      const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
      if (ipv4Match) {
        const a = Number(ipv4Match[1]);
        const b = Number(ipv4Match[2]);
        if (a === 10) return true;
        if (a === 172 && b >= 16 && b <= 31) return true;
        if (a === 192 && b === 168) return true;
        if (a === 169 && b === 254) return true;
        if (a === 127) return true;
      }
    } catch (e) {
      return false;
    }

    return false;
  };

  app.use(cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }));

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'طھط¹ط¯ط§ط¯ طھظ„ط§ط´â€Œظ‡ط§غŒ ظˆط±ظˆط¯ ط¨غŒط´ ط§ط² ط­ط¯ ظ…ط¬ط§ط² ط§ط³طھ. ظ„ط·ظپط§ظ‹ غ±غµ ط¯ظ‚غŒظ‚ظ‡ طµط¨ط± ع©ظ†غŒط¯' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/auth/login', loginLimiter);

  const passwordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'طھط¹ط¯ط§ط¯ طھظ„ط§ط´â€Œظ‡ط§غŒ طھط؛غŒغŒط± ط±ظ…ط² ط¨غŒط´ ط§ط² ط­ط¯ ظ…ط¬ط§ط² ط§ط³طھ. ظ„ط·ظپط§ظ‹ غ±غµ ط¯ظ‚غŒظ‚ظ‡ طµط¨ط± ع©ظ†غŒط¯' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/auth/change-password', passwordLimiter);
  app.use('/api/profile/change-password', passwordLimiter);

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(hpp());
  app.use(mongoSanitize());

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

  app.use('/api', auditLog());

  app.use('/api/auth', require('./routes/auth')());
  app.use('/api/admin', require('./routes/admin')());
  app.use('/api/leave', require('./routes/leave')());
  app.use('/api/overtime', require('./routes/overtime')());
  app.use('/api/letters', require('./routes/letters')());
  app.use('/api/inventory', require('./routes/inventory')());
  app.use('/api/restaurant', require('./routes/restaurant')());
  app.use('/api/notifications', require('./routes/notifications')());
  app.use('/api/backup', require('./routes/backup')());
  app.use('/api/permissions', require('./routes/permissions')());
  app.use('/api/announcements', require('./routes/announcements')());
  app.use('/api/job-applications', require('./routes/jobApplications')());
  app.use('/api/camera', require('./routes/camera')());
  app.use('/api/shifts', require('./routes/shifts')());
  app.use('/api/purchase', require('./routes/purchase')());
  app.use('/api/mission', require('./routes/mission')());
  app.use('/api/work-order', require('./routes/workOrder')());
  app.use('/api/payment', require('./routes/payment')());
  app.use('/api/repair', require('./routes/repair')());
  app.use('/api/repair-external', require('./routes/repairExternal')());
  app.use('/api/it', require('./routes/itRequest')());
  app.use('/api/conference', require('./routes/conference')());
  app.use('/api/security', require('./routes/security')());
  app.use('/api/daily-output', require('./routes/dailyOutput')());
  app.use('/api/project-supply', require('./routes/projectSupply')());
  app.use('/api/inspection', require('./routes/inspection')());
  app.use('/api/reports', require('./routes/reports')());
  app.use('/api/audit-log', require('./routes/auditLog')());
  app.use('/api/profile', require('./routes/profile')());
  app.use('/api/push', require('./routes/push')());
  app.use('/api/upload', require('./routes/upload')());
  app.use('/api/sms', require('./routes/smsAuth')());
  app.use('/api/workflow', require('./routes/workflow')());
  app.use('/api/signature', require('./routes/signature')());
  app.use('/api/chat', require('./routes/chat')());
  app.use('/api/daily-work-report', require('./routes/dailyWorkReport')());
  app.use('/api/educational', require('./routes/educational')());

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', company: 'ط§ط±ظˆظ… ط´غŒط´ظ‡ ط³ط§ع†غŒ', timestamp: new Date().toISOString() });
  });

  // Serve static files from the React frontend build
  const frontendDistPath = path.join(__dirname, '..', 'frontend', 'dist');
  console.log('Serving frontend build from:', frontendDistPath);
  app.use(express.static(frontendDistPath));

  app.get('/', (req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'), (err) => {
      if (err) {
        res.status(404).send('ظپط±ط§ظ†طھâ€Œط§ظ†ط¯ ظ‡ظ†ظˆط² ط¨غŒظ„ط¯ ظ†ط´ط¯ظ‡ ط§ط³طھ. ظ„ط·ظپط§ظ‹ ط¯ط³طھظˆط± npm run build ط±ط§ ط¯ط± ظ¾ظˆط´ظ‡ frontend ط§ط¬ط±ط§ ع©ظ†غŒط¯.');
      }
    });
  });

  app.post('/api/admin/server-restart', authMiddleware, (req, res) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'ظپظ‚ط· ظ…ط¯غŒط± ط³غŒط³طھظ… ظ…غŒâ€Œطھظˆط§ظ†ط¯ ط³ط±ظˆط± ط±ط§ ط±غŒâ€Œط§ط³طھط§ط±طھ ع©ظ†ط¯' });
    }
    const confirmToken = req.headers['x-restart-confirm'];
    if (!confirmToken || confirmToken !== process.env.RESTART_SECRET) {
      return res.status(403).json({ error: 'تأیید ری‌استارت الزامی است' });
    }
    res.json({ message: 'ط³ط±ظˆط± ط¯ط± ط­ط§ظ„ ط±غŒâ€Œط§ط³طھط§ط±طھ...' });
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
        res.status(404).send('ظپط±ط§ظ†طھâ€Œط§ظ†ط¯ ظ‡ظ†ظˆط² ط¨غŒظ„ط¯ ظ†ط´ط¯ظ‡ ط§ط³طھ. ظ„ط·ظپط§ظ‹ ط¯ط³طھظˆط± npm run build ط±ط§ ط¯ط± ظ¾ظˆط´ظ‡ frontend ط§ط¬ط±ط§ ع©ظ†غŒط¯.');
      }
    });
  });

  const http = require('http');
  const httpServer = http.createServer(app);
  const { Server } = require('socket.io');
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (isOriginAllowed(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  global.io = io;

  io.on('connection', (socket) => {
    socket.on('user:register', (userId) => {
      if (userId) {
        socket.join(`user_${userId}`);
      }
    });

    socket.on('chat:join', (roomId) => {
      if (roomId) {
        socket.join(`room_${roomId}`);
      }
    });

    socket.on('chat:leave', (roomId) => {
      if (roomId) {
        socket.leave(`room_${roomId}`);
      }
    });

    socket.on('chat:typing', ({ roomId, userId, userName, isTyping }) => {
      if (roomId) {
        socket.to(`room_${roomId}`).emit('chat:typing', { roomId, userId, userName, isTyping });
      }
    });

    socket.on('disconnect', () => {});
  });

  // Schedule cleanup of temporary chat attachments (> 24 hours old) every hour
  const chatTempDir = path.join(__dirname, 'uploads', 'chat_temp');
  if (!fs.existsSync(chatTempDir)) {
    fs.mkdirSync(chatTempDir, { recursive: true });
  }

  const cleanOldChatFiles = () => {
    try {
      if (!fs.existsSync(chatTempDir)) return;
      const now = Date.now();
      const maxAgeMs = 24 * 60 * 60 * 1000;
      const files = fs.readdirSync(chatTempDir);
      for (const file of files) {
        const filePath = path.join(chatTempDir, file);
        try {
          const stats = fs.statSync(filePath);
          if (now - stats.mtimeMs > maxAgeMs) {
            fs.unlinkSync(filePath);
          }
        } catch (_) {}
      }
    } catch (e) {
      console.error('Error cleaning old chat files:', e.message);
    }
  };
  setInterval(cleanOldChatFiles, 60 * 60 * 1000);
  cleanOldChatFiles();


  const bindHost = process.env.BIND_HOST || '0.0.0.0';
  server = httpServer.listen(PORT, bindHost, () => {
    console.log(`\n========================================`);
    console.log(`  ط³غŒط³طھظ… ط§طھظˆظ…ط§ط³غŒظˆظ† ط§ط¯ط§ط±غŒ ط§ط±ظˆظ… ط´غŒط´ظ‡ ط³ط§ع†غŒ`);
    console.log(`  Server running on port ${PORT}`);
    console.log(`  http://localhost:${PORT}`);
    console.log(`========================================\n`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
