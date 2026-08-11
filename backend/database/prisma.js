const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const pg = require('pg');
const { getDatabaseUrl } = require('./config');

let prisma;

function createClient() {
  const connectionString = getDatabaseUrl();

  // Read environment variables with sensible fallback defaults
  const maxConnections = parseInt(process.env.DB_POOL_MAX || '10', 10);
  const idleTimeout = parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000', 10);
  const connectionTimeout = parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT || '5000', 10);

  // Configure pg Pool instance explicitly
  const pool = new pg.Pool({
    connectionString,
    max: maxConnections,
    idleTimeoutMillis: idleTimeout,
    connectionTimeoutMillis: connectionTimeout,
  });

  // Attach pool instance to PrismaPg adapter
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

if (process.env.NODE_ENV === 'production') {
  prisma = createClient();
} else {
  if (!global.__prisma) {
    global.__prisma = createClient();
  }
  prisma = global.__prisma;
}

module.exports = prisma;
