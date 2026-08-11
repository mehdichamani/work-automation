const fs = require('fs');
const path = require('path');

/**
 * Loads environment variables from .env file into process.env if not already set.
 */
function loadEnv() {
  const envPath = path.join(__dirname, '..', '..', '.env');
  if (fs.existsSync(envPath)) {
    try {
      require('dotenv').config({ path: envPath });
    } catch (e) {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split(/\r?\n/).forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const idx = trimmed.indexOf('=');
          const key = trimmed.slice(0, idx).trim();
          const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      });
    }
  }
}

/**
 * Retrieves database connection configuration object.
 * Supports separate DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD environment variables,
 * allowing passwords with special characters (!@# etc.) without URL parsing issues.
 */
function getDbConfig() {
  loadEnv();

  if (process.env.DB_HOST || process.env.DB_USER || process.env.DB_NAME || process.env.DB_PASSWORD) {
    return {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'edari',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || ''
    };
  }

  // Fallback to DATABASE_URL parsing if individual variables are not present
  const url = process.env.DATABASE_URL || '';
  if (url) {
    try {
      const parsedUrl = new URL(url.startsWith('postgresql://') || url.startsWith('postgres://') ? url : 'postgresql://' + url);
      return {
        user: decodeURIComponent(parsedUrl.username || 'postgres'),
        password: decodeURIComponent(parsedUrl.password || ''),
        host: parsedUrl.hostname || 'localhost',
        port: parseInt(parsedUrl.port || '5432', 10),
        database: parsedUrl.pathname.replace(/^\//, '').split('?')[0] || 'edari'
      };
    } catch (e) {
      const dbPart = url.replace(/^postgresql:\/\//, '');
      const match = dbPart.match(/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
      if (match) {
        return {
          user: decodeURIComponent(match[1]),
          password: decodeURIComponent(match[2]),
          host: match[3],
          port: parseInt(match[4], 10),
          database: match[5]
        };
      }
    }
  }

  // Default configuration
  console.error('WARNING: No database configuration found. Set DB_PASSWORD or DATABASE_URL in .env');
  return {
    host: 'localhost',
    port: 5432,
    database: 'edari',
    user: 'postgres',
    password: ''
  };
}

/**
 * Returns a PostgreSQL connection URI with properly encoded credentials.
 */
function getDatabaseUrl() {
  const cfg = getDbConfig();
  return `postgresql://${encodeURIComponent(cfg.user)}:${encodeURIComponent(cfg.password)}@${cfg.host}:${cfg.port}/${cfg.database}`;
}

module.exports = { getDbConfig, getDatabaseUrl, loadEnv };
