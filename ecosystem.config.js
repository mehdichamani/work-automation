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
        CORS_ORIGIN: 'http://uromsachi.ir,https://uromsachi.ir,http://uromsachi.ir:2833,https://uromsachi.ir:2833,http://localhost:2833,http://127.0.0.1:2833,http://172.30.39.126:2833,http://172.20.2.200:2833'
      },
      max_memory_restart: '500M'
    }
  ]
};
