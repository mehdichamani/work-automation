const { Client } = require('pg');
const readline = require('readline');
const { getDbConfig } = require('./config');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Are you sure you want to WIPE the local database? This will delete all tables and data! (y/N): ', async (answer) => {
  rl.close();
  if (answer.toLowerCase() !== 'y') {
    console.log('Database reset cancelled.');
    process.exit(0);
  }

  const dbConfig = getDbConfig();
  const targetDb = dbConfig.database || 'edari';

  console.log(`Connecting to database "${targetDb}" to wipe it...`);
  const client = new Client(dbConfig);

  try {
    await client.connect();
    console.log('Successfully connected. Dropping and recreating public schema...');
    
    // Drop the public schema and recreate it to clean all tables/views/functions
    await client.query('DROP SCHEMA IF EXISTS public CASCADE');
    await client.query('CREATE SCHEMA public');
    await client.query('GRANT ALL ON SCHEMA public TO postgres');
    await client.query('GRANT ALL ON SCHEMA public TO public');
    
    console.log('Database has been completely wiped and reset successfully!');
    await client.end();
    process.exit(0);
  } catch (err) {
    console.error('Error resetting database:', err.message);
    process.exit(1);
  }
});
