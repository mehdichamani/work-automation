const path = require('path');
const fs = require('fs');

// Read .env directly using native node fs (no external dependencies needed)
const envConfig = {};
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        envConfig[key] = val;
      }
    }
  });
}

module.exports = {
  apps: [
    {
      name: 'edari-backend',
      script: './backend/server.js',
      instances: 1,
      exec_mode: 'fork',
      cwd: path.join(__dirname, 'backend'),
      env: {
        NODE_ENV: envConfig.NODE_ENV || process.env.NODE_ENV || 'production',
        PORT: envConfig.PORT || process.env.PORT || 2833,
        BIND_HOST: envConfig.BIND_HOST || process.env.BIND_HOST || '0.0.0.0',
        CORS_ORIGIN: envConfig.CORS_ORIGIN || process.env.CORS_ORIGIN || ''
      },
      max_memory_restart: '500M'
    }
  ]
};
