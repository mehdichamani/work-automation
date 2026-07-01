const path = require('path');

module.exports = {
  apps: [
    {
      name: 'edari-backend',
      script: './backend/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env_file: path.join(__dirname, '.env')
    }
  ]
};