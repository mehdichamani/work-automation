module.exports = {
  apps: [
    {
      name: 'edari-backend',
      script: './backend/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        DATABASE_URL: 'postgresql://postgres:postgrespassword@localhost:5432/edari'
      }
    }
  ]
};
