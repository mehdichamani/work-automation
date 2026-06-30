module.exports = {
  apps: [
    {
      name: 'edari-backend',
      script: './backend/server.js',
      instances: 1,
      exec_mode: 'fork',
      env_file: '.env'
    }
  ]
};