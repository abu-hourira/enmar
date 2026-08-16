// scratch/test-email-send.js
const fs = require('fs');
const path = require('path');
const tls = require('tls');

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

function sendTestEmail(toEmail) {
  return new Promise((resolve, reject) => {
    const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
    const port = Number(process.env.EMAIL_PORT) || 465;
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS.replace(/\s+/g, '');

    const socket = tls.connect(port, host, { rejectUnauthorized: false }, () => {
      console.log(`[SMTP] Connected to ${host}:${port}`);
    });

    let buffer = '';
    const waiters = [];
    function reply() { return new Promise(res => waiters.push(res)); }
    function onData(chunk) {
      buffer += chunk.toString('utf8');
      while (waiters.length && (buffer.includes('\r\n') || buffer.includes('\n'))) {
        const idx = buffer.indexOf('\n');
        const line = buffer.slice(0, idx + 1);
        buffer = buffer.slice(idx + 1);
        if (line.match(/^\d{3}[ -]/)) {
          const next = waiters.shift();
          next(line.trim());
        }
      }
    }
    socket.on('data', onData);
    socket.on('error', reject);

    async function exec() {
      try {
        let r = await reply();
        console.log('Greeting:', r);
        socket.write('EHLO localhost\r\n');
        r = await reply();
        console.log('EHLO:', r);
        socket.write('AUTH LOGIN\r\n');
        r = await reply();
        socket.write(Buffer.from(user).toString('base64') + '\r\n');
        r = await reply();
        socket.write(Buffer.from(pass).toString('base64') + '\r\n');
        r = await reply();
        console.log('AUTH Result:', r);

        socket.write(`MAIL FROM:<${user}>\r\n`);
        r = await reply();
        socket.write(`RCPT TO:<${toEmail}>\r\n`);
        r = await reply();
        console.log('RCPT Result:', r);

        socket.write('DATA\r\n');
        r = await reply();

        const mailContent = `From: ENMAR Official <${user}>\r\nTo: <${toEmail}>\r\nSubject: ENMAR Test Verification\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nAssalamu alaikum,\r\n\r\nThis is a test verification from ENMAR Organic Market.\r\nYour system is functioning properly.\r\n.\r\n`;
        socket.write(mailContent);
        r = await reply();
        console.log('DATA Result:', r);

        socket.write('QUIT\r\n');
        resolve(r);
      } catch (err) {
        reject(err);
      }
    }

    exec();
  });
}

sendTestEmail('mdhourira800@gmail.com')
  .then(res => {
    console.log('✅ Email sent successfully:', res);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Email send failed:', err);
    process.exit(1);
  });
