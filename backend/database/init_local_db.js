const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Manually parse .env from the root of workspace
const envPath = path.join(__dirname, '..', '..', '.env');
let databaseUrl = 'postgresql://postgres:postgrespassword@localhost:5432/edari';

try {
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/DATABASE_URL=(.+)/);
    if (match) {
      databaseUrl = match[1].trim();
    }
  }
} catch (e) {
  console.log('Failed to read .env file, using default connection string');
}

async function run() {
  const urlObj = new URL(databaseUrl.startsWith('postgresql://') ? databaseUrl : 'postgresql://' + databaseUrl);
  const targetDb = urlObj.pathname.substring(1) || 'edari';
  
  // Set default database to 'postgres' to check/create the target database
  urlObj.pathname = '/postgres';

  console.log(`Connecting to PostgreSQL to check database "${targetDb}"...`);
  const client = new Client({
    connectionString: urlObj.toString(),
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
    const targetClient = new Client({
      connectionString: databaseUrl,
    });
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
