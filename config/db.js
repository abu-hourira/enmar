// db.js - MySQL Connection Pool for ENMAR
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Auto-load .env if not yet loaded
(function loadDotEnv() {
  const envCandidates = [
    path.join(__dirname, '..', '.env'),
    path.join(__dirname, '.env'),
    path.join(process.cwd(), '.env'),
    '/home/enmarsho/enmar-web/.env',
    '/home/enmarsho/public_html/.env',
    '/home/enmarsho/repositories/enmar/.env',
    '/home/enmarsho/.env'
  ];
  for (const envPath of envCandidates) {
    try {
      if (!fs.existsSync(envPath)) continue;
      const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const eq = line.indexOf('=');
        if (eq === -1) continue;
        const key = line.slice(0, eq).trim();
        const value = line.slice(eq + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
        if (key && (process.env[key] === undefined || process.env[key] === '')) process.env[key] = value;
      }
    } catch {}
  }
})();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'enmar_db',
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  connectTimeout: 5000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

module.exports = pool;
