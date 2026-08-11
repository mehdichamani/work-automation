const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { JWT_SECRET } = require('../middleware/auth');
const prisma = require('../database/prisma');
const { mapRow, flattenJoins } = require('../utils/dbAdapter');
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

module.exports = function() {
  const router = express.Router();

  router.post('/send-code', async (req, res) => {
    try {
      const { phone } = req.body;
      if (!phone || !/^09\d{9}$/.test(phone)) {
        return res.status(400).json({ error: 'شماره موبایل معتبر نیست (مثال: 09141234567)' });
      }

      const recentCode = await prisma.smsCode.findFirst({
        where: { phone: phone, createdAt: { gt: new Date(Date.now() - 60000) } }
      });
      if (recentCode) {
        return res.status(429).json({ error: 'لطفاً ۶۰ ثانیه صبر کنید' });
      }

      const code = generateCode();
      const expiresAt = new Date(Date.now() + CODE_EXPIRY).toISOString();

      await prisma.smsCode.deleteMany({ where: { phone: phone } });
      await prisma.smsCode.create({ data: { phone: phone, code: code, expiresAt: expiresAt } });

      sendSMS(phone, code);

      res.json({ success: true, message: 'کد تأیید ارسال شد' });
    } catch (err) {
      res.status(500).json({ error: 'خطای ارسال کد تأیید' });
    }
  });

  router.post('/verify-code', async (req, res) => {
    try {
      const { phone, code } = req.body;
      if (!phone || !code) {
        return res.status(400).json({ error: 'شماره موبایل و کد تأیید الزامی است' });
      }

      const record = await prisma.smsCode.findFirst({
        where: { phone: phone, code: code, used: false, expiresAt: { gt: new Date().toISOString() } },
        orderBy: { id: 'desc' }
      });

      if (!record) {
        return res.status(401).json({ error: 'کد تأیید نامعتبر یا منقضی شده است' });
      }

      await prisma.smsCode.update({ where: { id: record.id }, data: { used: true } });

      const user = await prisma.user.findFirst({ where: { phone: phone } });

      if (!user) {
        return res.status(404).json({ error: 'کاربری با این شماره موبایل یافت نشد. لطفاً با مدیر سیستم تماس بگیرید' });
      }

      if (!user.isActive) {
        return res.status(403).json({ error: 'حساب کاربری غیرفعال است' });
      }

      const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

      res.json({
        token,
        user: {
          id: user.id, employee_id: user.id, username: user.username,
          full_name: user.fullName, role: user.role, department_id: user.departmentId,
        }
      });
    } catch (err) {
      res.status(500).json({ error: 'خطای سرور' });
    }
  });

  return router;
};
