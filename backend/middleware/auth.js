const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'arrom-shishe-sazi-edari-2024-secret-key';

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
