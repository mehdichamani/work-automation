const path = require('path');

module.exports = {
  apps: [
    {
      name: 'edari-backend',
      script: './backend/server.js',
      instances: 1,
      exec_mode: 'fork',
      cwd: path.join(__dirname, 'backend'),
      env: {
        NODE_ENV: 'production',
        PORT: 2833,
        BIND_HOST: '0.0.0.0',
        CORS_ORIGIN: 'http://localhost:2833,http://192.168.1.9:2833,http://172.20.2.212:2833,http://172.30.39.198:2833'
      },
      max_memory_restart: '500M'
    }
  ]
};
