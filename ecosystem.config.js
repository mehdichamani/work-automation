const path = require('path');

module.exports = {
  apps: [
    {
      name: 'edari-backend',
      script: './backend/server.js',
      instances: 1,
      exec_mode: 'fork',
      env_file: path.join(__dirname, '.env'),
      max_memory_restart: '500M'
    }
  ]
};
