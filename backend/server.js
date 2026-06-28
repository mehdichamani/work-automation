const express = require('express');
const cors = require('cors');
const path = require('path');
const { execFile } = require('child_process');
const { initDatabase } = require('./database/init');
const { authMiddleware } = require('./middleware/auth');

let server;

async function startServer() {
  const db = await initDatabase();

  const app = express();
  const PORT = process.env.PORT || 3001;

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

  app.use('/api/auth', require('./routes/auth')(db));
  app.use('/api/admin', require('./routes/admin')(db));
  app.use('/api/leave', require('./routes/leave')(db));
  app.use('/api/letters', require('./routes/letters')(db));
  app.use('/api/inventory', require('./routes/inventory')(db));
  app.use('/api/restaurant', require('./routes/restaurant')(db));
  app.use('/api/notifications', require('./routes/notifications')(db));
  app.use('/api/backup', require('./routes/backup')(db));
  app.use('/api/permissions', require('./routes/permissions')(db));
  app.use('/api/announcements', require('./routes/announcements')(db));
  app.use('/api/job-applications', require('./routes/jobApplications')(db));
  app.use('/api/camera', require('./routes/camera')(db));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', company: 'اروم شیشه ساچی', timestamp: new Date().toISOString() });
  });

  app.post('/api/admin/server-restart', authMiddleware, (req, res) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'فقط مدیر سیستم می‌تواند سرور را ری‌استارت کند' });
    }
    res.json({ message: 'سرور در حال ری‌استارت...' });
    setTimeout(() => {
      const child = execFile(process.execPath, [require('path').join(__dirname, 'server.js')], {
        cwd: __dirname,
        detached: true,
        stdio: 'ignore'
      });
      child.unref();
      server.close(() => process.exit(0));
    }, 500);
  });

  server = app.listen(PORT, '0.0.0.0', () => {
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
