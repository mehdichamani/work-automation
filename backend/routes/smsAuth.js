const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { JWT_SECRET } = require('../middleware/auth');
const RATE_LIMIT_WINDOW = 15 * 60 * 1000;
const CODE_EXPIRY = 3 * 60 * 1000;

function generateCode() {
  return String(crypto.randomInt(100000, 999999));
}

async function sendSMS(phone, code) {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[SMS] کد تأیید برای ${phone}: ${code}`);
      }
  // --- Kavenegar Example ---
  // const https = require('https');
  // const apiKey = 'YOUR_KAVENEGAR_API_KEY';
  // const receptor = phone;
  // const template = 'arrom-edari';
  // const url = `https://api.kavenegar.com/v1/${apiKey}/verify.json?receptor=${receptor}&token=${code}&template=${template}`;
  // await new Promise((resolve, reject) => {
  //   https.get(url, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve(JSON.parse(d))); }).on('error', reject);
  // });

  // --- SMS.ir Example ---
  // const https = require('https');
  // const apiKey = 'YOUR_SMSIR_API_KEY';
  // const body = JSON.stringify({ mobile: phone, templateId: 0, parameters: [{ name: 'CODE', value: code }] });
  // const opts = { hostname: 'api.sms.ir', path: '/v1/send/verify', method: 'POST', headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' } };
  // await new Promise((resolve, reject) => {
  //   const req = https.request(opts, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve(JSON.parse(d))); });
  //   req.on('error', reject); req.write(body); req.end();
  // });
}

module.exports = function(db) {
  const router = express.Router();

  router.post('/send-code', (req, res) => {
    try {
      const { phone } = req.body;
      if (!phone || !/^09\d{9}$/.test(phone)) {
        return res.status(400).json({ error: 'شماره موبایل معتبر نیست (مثال: 09141234567)' });
      }

      const recentCode = db.prepare(
        `SELECT created_at FROM sms_codes WHERE phone = ? AND created_at > to_char(now()::timestamp - interval '60 seconds', 'YYYY-MM-DD HH24:MI:SS')`
      ).get(phone);
      if (recentCode) {
        return res.status(429).json({ error: 'لطفاً ۶۰ ثانیه صبر کنید' });
      }

      const code = generateCode();
      const expiresAt = new Date(Date.now() + CODE_EXPIRY).toISOString();

      db.prepare('DELETE FROM sms_codes WHERE phone = ?').run(phone);
      db.prepare('INSERT INTO sms_codes (phone, code, expires_at) VALUES (?, ?, ?)').run(phone, code, expiresAt);

      sendSMS(phone, code);

      res.json({ success: true, message: 'کد تأیید ارسال شد', _dev_code: code });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/verify-code', (req, res) => {
    try {
      const { phone, code } = req.body;
      if (!phone || !code) {
        return res.status(400).json({ error: 'شماره موبایل و کد تأیید الزامی است' });
      }

      const record = db.prepare(
        `SELECT * FROM sms_codes WHERE phone = ? AND code = ? AND used = 0 AND expires_at > to_char(now(), 'YYYY-MM-DD HH24:MI:SS'::text) ORDER BY id DESC LIMIT 1`
      ).get(phone, code);

      if (!record) {
        return res.status(401).json({ error: 'کد تأیید نامعتبر یا منقضی شده است' });
      }

      db.prepare('UPDATE sms_codes SET used = 1 WHERE id = ?').run(record.id);

      let user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);

      if (!user) {
        const maxId = db.prepare('SELECT MAX(id) as m FROM users').get().m || 1000;
        const newId = Number(maxId) + 1;
        const bcrypt = require('bcryptjs');
        const defaultPass = bcrypt.hashSync('123456', 10);
        db.prepare(`INSERT INTO users (id, password, full_name, phone, role, department_id, username)
          VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
          newId, defaultPass, 'کاربر جدید', phone, 'user', 1, String(newId)
        );
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(newId);
      }

      if (!user.is_active) {
        return res.status(403).json({ error: 'حساب کاربری غیرفعال است' });
      }

      const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

      res.json({
        token,
        user: {
          id: user.id, employee_id: user.id, username: user.username,
          full_name: user.full_name, role: user.role, department_id: user.department_id,
        }
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
