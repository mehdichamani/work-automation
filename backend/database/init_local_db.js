const { Client } = require('pg');
const { getDbConfig } = require('./config');

async function run() {
  const dbConfig = getDbConfig();
  const targetDb = dbConfig.database || 'edari';

  console.log(`Connecting to PostgreSQL to check database "${targetDb}"...`);
  const client = new Client({
    ...dbConfig,
    database: 'postgres'
  });

  try {
    await client.connect();
    const res = await client.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [targetDb]);
    
    if (res.rowCount === 0) {
      console.log(`Database "${targetDb}" does not exist. Creating it...`);
      await client.query(`CREATE DATABASE ${targetDb}`);
      console.log(`Database "${targetDb}" created successfully!`);
    } else {
      console.log(`Database "${targetDb}" already exists.`);
    }
    await client.end();
    
    // Connect to target database to make sure it is fully accessible
    console.log(`Verifying connection to database "${targetDb}"...`);
    const targetClient = new Client(dbConfig);
    await targetClient.connect();
    console.log(`Successfully connected to database "${targetDb}"!`);
    await targetClient.end();
    process.exit(0);
  } catch (err) {
    console.error('Error during database initialization:', err.message);
    process.exit(1);
  }
}

run();
