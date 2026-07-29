const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  const secretPath = path.join(__dirname, '..', '.jwt_secret');
  try {
    if (fs.existsSync(secretPath)) {
      JWT_SECRET = fs.readFileSync(secretPath, 'utf8').trim();
    } else {
      JWT_SECRET = require('crypto').randomBytes(32).toString('hex');
      fs.writeFileSync(secretPath, JWT_SECRET, 'utf8');
    }
  } catch (err) {
    console.error('CRITICAL: Could not read or create JWT secret file. Set JWT_SECRET in .env instead.');
    process.exit(1);
  }
}

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('CRITICAL: JWT_SECRET is missing or too short. Set a strong secret in .env or .jwt_secret');
  process.exit(1);
}

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'دسترسی غیرمجاز - توکن ارسال نشد' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'توکن نامعتبر یا منقضی شده' });
  }
}

function roleGuard(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'شما دسترسی به این بخش ندارید' });
    }
    next();
  };
}

function auditLog(db) {
  return (req, res, next) => {
    if (req.method === 'GET' || req.path.includes('/login') || req.path.includes('/health')) {
      return next();
    }
    const originalSend = res.send;
    res.send = function(body) {
      try {
        const userId = req.user?.id;
        const action = `${req.method} ${req.path}`;
        const moduleMatch = req.path.match(/\/api\/([^\/]+)/);
        const moduleName = moduleMatch ? moduleMatch[1] : '';
        const details = typeof body === 'string' ? body.substring(0, 500) : '';
        db.prepare('INSERT INTO activity_log (user_id, module_name, action, details, ip_address) VALUES (?, ?, ?, ?, ?)').run(
          userId || null, moduleName, action, details, req.ip
        );
      } catch (e) {}
      return originalSend.call(this, body);
    };
    next();
  };
}

function validatePassword(pw) {
  if (!pw || pw.length < 6) return 'رمز عبور باید حداقل ۶ کاراکتر باشد';
  return null;
}

module.exports = { authMiddleware, roleGuard, auditLog, JWT_SECRET, validatePassword };
