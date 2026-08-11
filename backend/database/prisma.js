const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { getDatabaseUrl } = require('./config');

let prisma;

function createClient() {
  const connectionString = getDatabaseUrl();
  const adapter = new PrismaPg({ connectionString });
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
