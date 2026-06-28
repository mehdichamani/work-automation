const express = require('express');
const http = require('http');
const crypto = require('crypto');
const { authMiddleware } = require('../middleware/auth');

const DEFAULT_CONFIG = {
  ip: '172.20.2.26',
  port: 80,
  username: 'admin',
  password: 'admin123',
  channel: 1,
  rtsp_port: 554
};

function getConfig(db) {
  try {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('camera_config');
    if (row) return { ...DEFAULT_CONFIG, ...JSON.parse(row.value) };
  } catch (e) {}
  return { ...DEFAULT_CONFIG };
}

function saveConfig(db, config) {
  const row = db.prepare('SELECT key FROM settings WHERE key = ?').get('camera_config');
  if (row) {
    db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(JSON.stringify(config), 'camera_config');
  } else {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('camera_config', JSON.stringify(config));
  }
}

function getStreamUrl(config) {
  return `http://${config.ip}:${config.port}/ISAPI/Streaming/channels/${config.channel}01/httpPreview`;
}

function getRtspUrl(config) {
  return `rtsp://${config.username}:${config.password}@${config.ip}:${config.rtsp_port || 554}/Streaming/Channels/${config.channel}01`;
}

function getSnapshotUrl(config) {
  return `http://${config.ip}:${config.port}/ISAPI/Streaming/channels/${config.channel}01/picture`;
}

function computeDigestResponse(username, password, method, uri, wwwAuth) {
  const nonceMatch = wwwAuth.match(/nonce="([^"]+)"/);
  const realmMatch = wwwAuth.match(/realm="([^"]+)"/);
  const qopMatch = wwwAuth.match(/qop="([^"]+)"/);
  const opaqueMatch = wwwAuth.match(/opaque="([^"]+)"/);

  if (!nonceMatch || !realmMatch) return null;

  const nonce = nonceMatch[1];
  const realm = realmMatch[1];
  const qop = qopMatch ? qopMatch[1] : '';
  const opaque = opaqueMatch ? opaqueMatch[1] : '';
  const nc = '00000001';
  const cnonce = crypto.randomBytes(16).toString('hex');

  const ha1 = crypto.createHash('md5').update(`${username}:${realm}:${password}`).digest('hex');
  const ha2 = crypto.createHash('md5').update(`${method}:${uri}`).digest('hex');

  let response;
  if (qop) {
    response = crypto.createHash('md5').update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`).digest('hex');
  } else {
    response = crypto.createHash('md5').update(`${ha1}:${nonce}:${ha2}`).digest('hex');
  }

  let header = `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}"`;
  if (opaque) header += `, opaque="${opaque}"`;
  if (qop) header += `, qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;
  return header;
}

function digestRequest(config, urlPath, callback) {
  const url = `http://${config.ip}:${config.port}${urlPath}`;

  const firstReq = http.get(url, { timeout: 5000 }, (firstRes) => {
    if (firstRes.statusCode === 200) {
      const chunks = [];
      firstRes.on('data', (c) => chunks.push(c));
      firstRes.on('end', () => callback(null, Buffer.concat(chunks).toString()));
      return;
    }

    if (firstRes.statusCode === 401) {
      const wwwAuth = firstRes.headers['www-authenticate'] || '';
      firstRes.resume();

      const authHeader = computeDigestResponse(config.username, config.password, 'GET', urlPath, wwwAuth);
      if (!authHeader) {
        callback(new Error('امکان پردازش Digest Auth نیست'));
        return;
      }

      const secondReq = http.get(url, { headers: { 'Authorization': authHeader }, timeout: 5000 }, (secondRes) => {
        if (secondRes.statusCode === 200) {
          const chunks = [];
          secondRes.on('data', (c) => chunks.push(c));
          secondRes.on('end', () => callback(null, Buffer.concat(chunks).toString()));
        } else {
          const chunks = [];
          secondRes.on('data', (c) => chunks.push(c));
          secondRes.on('end', () => callback(new Error(`خطای احراز هویت: ${secondRes.statusCode}`)));
        }
      });

      secondReq.on('error', (e) => callback(e));
      secondReq.on('timeout', () => { secondReq.destroy(); callback(new Error('timeout')); });
      return;
    }

    firstRes.resume();
    callback(new Error(`StatusCode: ${firstRes.statusCode}`));
  });

  firstReq.on('error', (e) => callback(e));
  firstReq.on('timeout', () => { firstReq.destroy(); callback(new Error('timeout')); });
}

function digestRequestBinary(config, urlPath, callback) {
  const url = `http://${config.ip}:${config.port}${urlPath}`;

  const firstReq = http.get(url, { timeout: 5000 }, (firstRes) => {
    if (firstRes.statusCode === 200) {
      const chunks = [];
      firstRes.on('data', (c) => chunks.push(c));
      firstRes.on('end', () => callback(null, Buffer.concat(chunks)));
      return;
    }

    if (firstRes.statusCode === 401) {
      const wwwAuth = firstRes.headers['www-authenticate'] || '';
      firstRes.resume();

      const authHeader = computeDigestResponse(config.username, config.password, 'GET', urlPath, wwwAuth);
      if (!authHeader) {
        callback(new Error('امکان پردازش Digest Auth نیست'));
        return;
      }

      const secondReq = http.get(url, { headers: { 'Authorization': authHeader }, timeout: 8000 }, (secondRes) => {
        if (secondRes.statusCode === 200) {
          const chunks = [];
          secondRes.on('data', (c) => chunks.push(c));
          secondRes.on('end', () => callback(null, Buffer.concat(chunks)));
        } else {
          callback(new Error(`خطای احراز هویت: ${secondRes.statusCode}`));
        }
      });

      secondReq.on('error', (e) => callback(e));
      secondReq.on('timeout', () => { secondReq.destroy(); callback(new Error('timeout')); });
      return;
    }

    firstRes.resume();
    callback(new Error(`StatusCode: ${firstRes.statusCode}`));
  });

  firstReq.on('error', (e) => callback(e));
  firstReq.on('timeout', () => { firstReq.destroy(); callback(new Error('timeout')); });
}

module.exports = function (db) {
  try {
    db.prepare(`CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`).run();
  } catch (e) {}

  const router = express.Router();
  router.use(authMiddleware);

  router.get('/config', (req, res) => {
    try {
      const config = getConfig(db);
      res.json({ ip: config.ip, port: config.port, username: config.username, channel: config.channel, rtsp_port: config.rtsp_port || 554 });
    } catch (err) {
      res.status(500).json({ error: 'خطا در خواندن تنظیمات: ' + err.message });
    }
  });

  router.put('/config', (req, res) => {
    try {
      const current = getConfig(db);
      const { ip, port, username, password, channel, rtsp_port } = req.body;
      if (ip !== undefined && ip.trim()) current.ip = ip.trim();
      if (port !== undefined) current.port = parseInt(port) || 80;
      if (username !== undefined && username.trim()) current.username = username.trim();
      if (password !== undefined && password.trim()) current.password = password.trim();
      if (channel !== undefined) current.channel = parseInt(channel) || 1;
      if (rtsp_port !== undefined) current.rtsp_port = parseInt(rtsp_port) || 554;
      saveConfig(db, current);
      res.json({ message: 'تنظیمات دوربین ذخیره شد', config: { ip: current.ip, port: current.port, username: current.username, channel: current.channel, rtsp_port: current.rtsp_port } });
    } catch (err) {
      res.status(500).json({ error: 'خطا در ذخیره تنظیمات: ' + err.message });
    }
  });

  router.get('/test', (req, res) => {
    const config = getConfig(db);
    digestRequest(config, '/ISAPI/System/deviceInfo', (err, data) => {
      if (err) {
        return res.json({ connected: false, error: err.message });
      }
      const modelMatch = data.match(/<model>(.*?)<\/model>/);
      const serialMatch = data.match(/<serialNumber>(.*?)<\/serialNumber>/);
      res.json({ connected: true, ip: config.ip, port: config.port, model: modelMatch ? modelMatch[1] : 'Hikvision', serial: serialMatch ? serialMatch[1] : '-', rtsp_url: getRtspUrl(config) });
    });
  });

  router.get('/status', (req, res) => {
    const config = getConfig(db);
    digestRequest(config, '/ISAPI/System/deviceInfo', (err, data) => {
      if (err) {
        return res.json({ connected: false, ip: config.ip, error: err.message });
      }
      const modelMatch = data.match(/<model>(.*?)<\/model>/);
      res.json({ connected: true, ip: config.ip, model: modelMatch ? modelMatch[1] : 'Hikvision' });
    });
  });

  router.get('/snapshot', (req, res) => {
    const config = getConfig(db);
    const urlPath = getSnapshotUrl(config).replace(`http://${config.ip}:${config.port}`, '');

    digestRequestBinary(config, urlPath, (err, buffer) => {
      if (err) {
        return res.status(503).json({ error: err.message });
      }
      const base64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;
      res.json({ image: base64 });
    });
  });

  router.get('/stream', (req, res) => {
    const config = getConfig(db);
    const urlPath = getStreamUrl(config).replace(`http://${config.ip}:${config.port}`, '');
    const url = `http://${config.ip}:${config.port}${urlPath}`;

    const firstReq = http.get(url, { timeout: 5000 }, (firstRes) => {
      if (firstRes.statusCode === 200) {
        res.writeHead(200, {
          'Content-Type': firstRes.headers['content-type'] || 'multipart/x-mixed-replace; boundary=myboundary',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*'
        });
        firstRes.pipe(res);
        return;
      }

      if (firstRes.statusCode === 401) {
        const wwwAuth = firstRes.headers['www-authenticate'] || '';
        firstRes.resume();

        const authHeader = computeDigestResponse(config.username, config.password, 'GET', urlPath, wwwAuth);
        if (!authHeader) {
          return res.status(503).json({ error: 'امکان پردازش Digest Auth نیست' });
        }

        const secondReq = http.get(url, { headers: { 'Authorization': authHeader }, timeout: 5000 }, (secondRes) => {
          if (secondRes.statusCode === 200) {
            res.writeHead(200, {
              'Content-Type': secondRes.headers['content-type'] || 'multipart/x-mixed-replace; boundary=myboundary',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
              'Access-Control-Allow-Origin': '*'
            });
            secondRes.pipe(res);
          } else {
            res.status(502).json({ error: `خطای احراز هویت: ${secondRes.statusCode}` });
          }
        });
        secondReq.on('error', () => { if (!res.headersSent) res.status(503).json({ error: 'امکان اتصال به دوربین نیست' }); });
        secondReq.on('timeout', () => { secondReq.destroy(); if (!res.headersSent) res.status(504).json({ error: 'timeout' }); });
        return;
      }

      firstRes.resume();
      if (!res.headersSent) res.status(502).json({ error: `StatusCode: ${firstRes.statusCode}` });
    });

    firstReq.on('error', () => { if (!res.headersSent) res.status(503).json({ error: 'امکان اتصال به دوربین نیست' }); });
    firstReq.on('timeout', () => { firstReq.destroy(); if (!res.headersSent) res.status(504).json({ error: 'timeout' }); });
    req.on('close', () => { firstReq.destroy(); });
  });

  return router;
};
