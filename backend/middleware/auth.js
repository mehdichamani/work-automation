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
    // fallback if file write fails, to ensure system still runs
    JWT_SECRET = 'arrom-shishe-sazi-edari-2024-secret-key-fallback';
  }
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

module.exports = { authMiddleware, roleGuard, JWT_SECRET };
