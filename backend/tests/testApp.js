const express = require('express');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');
const { authMiddleware, auditLog } = require('../middleware/auth');

function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', auditLog());

  app.use('/api/auth', require('../routes/auth')());
  app.use('/api/admin', require('../routes/admin')());
  app.use('/api/leave', require('../routes/leave')());
  app.use('/api/overtime', require('../routes/overtime')());
  app.use('/api/letters', require('../routes/letters')());
  app.use('/api/inventory', require('../routes/inventory')());
  app.use('/api/restaurant', require('../routes/restaurant')());
  app.use('/api/notifications', require('../routes/notifications')());
  app.use('/api/backup', require('../routes/backup')());
  app.use('/api/permissions', require('../routes/permissions')());
  app.use('/api/announcements', require('../routes/announcements')());
  app.use('/api/job-applications', require('../routes/jobApplications')());
  app.use('/api/camera', require('../routes/camera')());
  app.use('/api/shifts', require('../routes/shifts')());
  app.use('/api/purchase', require('../routes/purchase')());
  app.use('/api/mission', require('../routes/mission')());
  app.use('/api/work-order', require('../routes/workOrder')());
  app.use('/api/payment', require('../routes/payment')());
  app.use('/api/repair', require('../routes/repair')());
  app.use('/api/repair-external', require('../routes/repairExternal')());
  app.use('/api/it', require('../routes/itRequest')());
  app.use('/api/conference', require('../routes/conference')());
  app.use('/api/security', require('../routes/security')());
  app.use('/api/daily-output', require('../routes/dailyOutput')());
  app.use('/api/project-supply', require('../routes/projectSupply')());
  app.use('/api/inspection', require('../routes/inspection')());
  app.use('/api/reports', require('../routes/reports')());
  app.use('/api/audit-log', require('../routes/auditLog')());
  app.use('/api/profile', require('../routes/profile')());
  app.use('/api/push', require('../routes/push')());
  app.use('/api/upload', require('../routes/upload')());
  app.use('/api/sms', require('../routes/smsAuth')());
  app.use('/api/workflow', require('../routes/workflow')());
  app.use('/api/signature', require('../routes/signature')());
  app.use('/api/chat', require('../routes/chat')());
  app.use('/api/daily-work-report', require('../routes/dailyWorkReport')());
  app.use('/api/educational', require('../routes/educational')());
  app.use('/api/analytics', require('../routes/analytics')());

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', company: 'test', timestamp: new Date().toISOString() });
  });

  return { app };
}

module.exports = { createTestApp, generateToken };
