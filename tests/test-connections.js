// scratch/test-connections.js
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const tls = require('node:tls');
const http = require('node:http');

// Load environment variables from .env if present
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

const storePath = path.join(__dirname, '..', 'data', 'store.json');
let store = {};
try {
  store = JSON.parse(fs.readFileSync(storePath, 'utf8'));
} catch (e) {
  console.error('Failed to read data/store.json:', e.message);
}

function smtpReplyComplete(buffer) {
  const nl = buffer.indexOf('\r\n');
  if (nl === -1) return false;
  const first = buffer.slice(0, nl);
  if (first[3] !== '-') return true;
  return buffer.includes('\r\n' + first.slice(0, 3) + ' ');
}

function smtpTakeReply(buffer) {
  const nl1 = buffer.indexOf('\r\n');
  const first = buffer.slice(0, nl1);
  buffer = buffer.slice(nl1 + 2);
  let text = first;
  if (first[3] === '-') {
    for (;;) {
      const nl = buffer.indexOf('\r\n');
      if (nl === -1) break;
      const line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 2);
      text += '\r\n' + line;
      if (line[3] === ' ') break;
    }
  }
  return { text, rest: buffer };
}

function verifySmtp(cfg, timeoutMs = 15000) {
  return new Promise((resolve) => {
    if (!cfg.host || !cfg.user || !cfg.pass) {
      return resolve({ ok: false, message: 'SMTP credentials missing or incomplete in .env' });
    }
    let sock = cfg.secure
      ? tls.connect({ host: cfg.host, port: cfg.port, servername: cfg.host })
      : net.connect({ host: cfg.host, port: cfg.port });
    let buf = '';
    const waiters = [];
    let done = false;
    const overall = setTimeout(() => stepFail('verification timed out'), timeoutMs);
    const finish = (r) => { if (done) return; done = true; clearTimeout(overall); try { sock.destroy(); } catch {} resolve(r); };
    const stepFail = (msg, code) => finish({ ok: false, code: code || 0, message: String(msg) });
    const onData = (chunk) => {
      buf += chunk.toString('utf8');
      while (waiters.length && smtpReplyComplete(buf)) {
        const next = waiters.shift();
        const { text, rest } = smtpTakeReply(buf);
        buf = rest;
        next(text);
      }
    };
    sock.on('data', onData);
    sock.on('error', (e) => stepFail(e.code || e.message, e.code));
    sock.on('close', () => { if (!done) stepFail('connection closed unexpectedly'); });
    const reply = () => new Promise(res => waiters.push(res));
    const send = (l) => { sock.write(l + '\r\n'); return reply(); };
    const codeOf = (l) => Number(l.slice(0, 3));

    (async () => {
      try {
        let l = await reply();
        if (codeOf(l) !== 220) return stepFail('unexpected greeting: ' + l, codeOf(l));
        l = await send('EHLO ' + cfg.host);
        if (codeOf(l) !== 250) return stepFail('EHLO rejected: ' + l, codeOf(l));

        if (!cfg.secure) {
          l = await send('STARTTLS');
          if (codeOf(l) !== 220) return stepFail('STARTTLS refused: ' + l, codeOf(l));
          const up = tls.connect({ socket: sock, servername: cfg.host });
          await new Promise((res, rej) => { up.once('secureConnect', res); up.once('error', rej); });
          sock = up;
          buf = '';
          sock.on('data', onData);
          sock.on('error', (e) => stepFail(e.code || e.message, e.code));
          l = await send('EHLO ' + cfg.host);
          if (codeOf(l) !== 250) return stepFail('EHLO after STARTTLS rejected: ' + l, codeOf(l));
        }

        l = await send('AUTH LOGIN');
        if (codeOf(l) === 334) {
          l = await send(Buffer.from(cfg.user).toString('base64'));
          if (codeOf(l) !== 334) return stepFail('username rejected: ' + l, codeOf(l));
          l = await send(Buffer.from(cfg.pass).toString('base64'));
          if (codeOf(l) === 235) return finish({ ok: true, code: 235, message: 'SMTP handshake & authentication successful (code 235)' });
          return stepFail('password rejected: ' + l, codeOf(l));
        }
        l = await send('AUTH PLAIN ' + Buffer.from('\0' + cfg.user + '\0' + cfg.pass).toString('base64'));
        if (codeOf(l) === 235) return finish({ ok: true, code: 235, message: 'SMTP handshake & authentication successful (code 235)' });
        return stepFail('authentication failed: ' + l, codeOf(l));
      } catch (e) {
        stepFail(e.code || e.message, e.code);
      }
    })();
  });
}

async function testSmsGateway(baseUrl, apiKey) {
  if (!apiKey) {
    return { ok: false, configured: false, message: 'SMS_API_KEY is not set or commented out in .env (SMS runs in Dev Mode)' };
  }
  try {
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, msg: 'PING', to: '8801700000000' })
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch {}
    return {
      ok: res.status < 500,
      configured: true,
      status: res.status,
      response: data || text.slice(0, 100)
    };
  } catch (err) {
    return { ok: false, configured: true, error: err.message };
  }
}

async function runHealthCheck() {
  console.log('\n======================================================');
  console.log('       ENMAR API & SERVICE CONNECTION AUDIT');
  console.log('======================================================\n');

  // 1. DATA STORE CONNECTION
  console.log('▶ [1] Local Data Store (data/store.json)');
  const storeExists = fs.existsSync(storePath);
  console.log(`  File Exists: ${storeExists ? 'YES' : 'NO'}`);
  if (storeExists) {
    console.log(`  Users count: ${(store.users || []).length}`);
    console.log(`  Products count: ${(store.products || []).length}`);
    console.log(`  Orders count: ${(store.orders || []).length}`);
    console.log('  \x1b[32m✔ Local Store: HEALTHY & ACCESSIBLE\x1b[0m\n');
  } else {
    console.log('  \x1b[31m✖ Local Store: NOT FOUND\x1b[0m\n');
  }

  // 2. EMAIL / SMTP CONNECTION
  console.log('▶ [2] Email Gateway (SMTP / Gmail)');
  const emailCfg = {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: Number(process.env.EMAIL_PORT || 465),
    secure: String(process.env.EMAIL_SECURE) === 'true',
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || '',
    from: process.env.EMAIL_FROM || '',
    fromName: process.env.EMAIL_FROM_NAME || 'ENMAR'
  };
  console.log(`  Host: ${emailCfg.host}:${emailCfg.port} (SSL: ${emailCfg.secure})`);
  console.log(`  User: ${emailCfg.user || '(none)'}`);
  console.log(`  From: ${emailCfg.fromName} <${emailCfg.from}>`);
  console.log('  Testing live SMTP handshake & authentication...');
  
  const smtpResult = await verifySmtp(emailCfg);
  if (smtpResult.ok) {
    console.log(`  \x1b[32m✔ SMTP Connection: OK (${smtpResult.message})\x1b[0m\n`);
  } else {
    console.log(`  \x1b[31m✖ SMTP Connection: FAILED -> ${smtpResult.message}\x1b[0m\n`);
  }

  // 3. SMS GATEWAY CONNECTION
  console.log('▶ [3] SMS Gateway (Alpha SMS / SMS.NET.BD)');
  const smsBaseUrl = process.env.SMS_BASE_URL || 'https://api.sms.net.bd/sendsms';
  const smsApiKey = process.env.SMS_API_KEY || '';
  console.log(`  Endpoint: ${smsBaseUrl}`);
  console.log(`  API Key: ${smsApiKey ? (smsApiKey.slice(0, 6) + '...' + smsApiKey.slice(-4)) : '(not configured)'}`);
  
  const smsResult = await testSmsGateway(smsBaseUrl, smsApiKey);
  if (smsResult.configured) {
    if (smsResult.ok) {
      console.log(`  \x1b[32m✔ SMS Gateway Endpoint Reachable (HTTP ${smsResult.status})\x1b[0m`);
      console.log(`  Response:`, JSON.stringify(smsResult.response));
    } else {
      console.log(`  \x1b[31m✖ SMS Gateway Unreachable: ${smsResult.error || smsResult.status}\x1b[0m`);
    }
  } else {
    console.log(`  \x1b[33mℹ SMS Gateway is currently in DEV/SIMULATION mode (SMS_API_KEY is empty/commented in .env).\x1b[0m`);
    console.log(`  (OTPs are delivered via email and logged to server console)`);
  }
  console.log('');

  // 4. UPLOADS DIRECTORY PERMISSIONS
  console.log('▶ [4] Media Uploads Directory (uploads/)');
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  const uploadDirExists = fs.existsSync(uploadsDir);
  console.log(`  Directory Exists: ${uploadDirExists ? 'YES' : 'NO'}`);
  try {
    const testFile = path.join(uploadsDir, '.write-test.tmp');
    fs.writeFileSync(testFile, 'ok');
    fs.unlinkSync(testFile);
    console.log('  \x1b[32m✔ Uploads Directory: Read/Write PERMISSIONS OK\x1b[0m\n');
  } catch (err) {
    console.log(`  \x1b[31m✖ Uploads Directory Write Failed: ${err.message}\x1b[0m\n`);
  }

  console.log('======================================================');
  console.log('                  AUDIT COMPLETE');
  console.log('======================================================\n');
}

runHealthCheck();
