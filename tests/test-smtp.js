// scratch/test-smtp.js
const { pool } = require('../services/db-service.js');
const dbService = require('../services/db-service.js');
const fs = require('fs');
const path = require('path');

// Auto-load .env
try {
  const envPath = path.join(__dirname, '..', '.env');
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

const tls = require('tls');
const net = require('net');

async function testGmail() {
  console.log('Testing Gmail SMTP connection...');
  console.log('User:', process.env.EMAIL_USER);
  console.log('Host:', process.env.EMAIL_HOST, 'Port:', process.env.EMAIL_PORT);

  const socket = tls.connect(465, 'smtp.gmail.com', { rejectUnauthorized: false }, () => {
    console.log('TLS connected to Gmail SMTP!');
  });

  socket.setEncoding('utf8');
  socket.on('data', (data) => {
    console.log('SMTP <', data.trim());
    if (data.startsWith('220')) {
      console.log('SMTP > EHLO localhost');
      socket.write('EHLO localhost\r\n');
    } else if (data.startsWith('250-') || data.startsWith('250 ')) {
      if (data.includes('AUTH')) {
        console.log('SMTP > AUTH LOGIN');
        socket.write('AUTH LOGIN\r\n');
      }
    } else if (data.startsWith('334 VXNlcm5hbWU6')) {
      const uB64 = Buffer.from(process.env.EMAIL_USER).toString('base64');
      console.log('SMTP > [Username b64]');
      socket.write(uB64 + '\r\n');
    } else if (data.startsWith('334 UGFzc3dvcmQ6')) {
      const pB64 = Buffer.from(process.env.EMAIL_PASS.replace(/\s+/g, '')).toString('base64');
      console.log('SMTP > [Password b64]');
      socket.write(pB64 + '\r\n');
    } else if (data.startsWith('235')) {
      console.log('✅ GMAIL AUTH SUCCESSFUL!');
      socket.write('QUIT\r\n');
      setTimeout(() => process.exit(0), 1000);
    } else if (data.startsWith('535') || data.startsWith('534') || data.startsWith('5')) {
      console.error('❌ GMAIL AUTH FAILED:', data.trim());
      process.exit(1);
    }
  });

  socket.on('error', (err) => {
    console.error('Socket error:', err);
    process.exit(1);
  });
}

testGmail().catch(console.error);
