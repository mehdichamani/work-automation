const { getDatabaseUrl } = require('./database/config');

module.exports = {
  schema: 'prisma/schema.prisma',
  datasource: {
    url: getDatabaseUrl(),
  },
};
