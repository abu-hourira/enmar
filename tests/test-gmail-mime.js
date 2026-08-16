// scratch/test-gmail-mime.js
const fs = require('fs');
const tls = require('node:tls');
const crypto = require('node:crypto');

const store = JSON.parse(fs.readFileSync('data/store.json', 'utf8'));
const cfg = store.apiConfigs.email;

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

function buildMimeMessage(mail, cfg) {
  const boundary = '----=_Part_' + Date.now() + '_' + crypto.randomBytes(6).toString('hex');
  const msgId = `<${Date.now()}.${crypto.randomBytes(8).toString('hex')}@${cfg.host || 'smtp.gmail.com'}>`;
  const dateStr = new Date().toUTCString();

  let headers = [
    `From: ${mail.fromHeader}`,
    `To: <${mail.to}>`,
    `Subject: =?UTF-8?B?${Buffer.from(mail.subject).toString('base64')}?=`,
    `Date: ${dateStr}`,
    `Message-ID: ${msgId}`,
    `MIME-Version: 1.0`
  ];

  if (mail.fromEmail) {
    headers.push(`Reply-To: <${mail.fromEmail}>`);
  }

  if (mail.html) {
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    const body = [
      headers.join('\r\n'),
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(mail.text || '').toString('base64'),
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(mail.html).toString('base64'),
      '',
      `--${boundary}--`,
      ''
    ].join('\r\n');
    return body;
  } else {
    headers.push('Content-Type: text/plain; charset="UTF-8"');
    headers.push('Content-Transfer-Encoding: base64');
    const body = [
      headers.join('\r\n'),
      '',
      Buffer.from(mail.text || '').toString('base64'),
      ''
    ].join('\r\n');
    return body;
  }
}

function smtpSend(cfg, mail) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const waiters = [];
    let socket = null;
    let finished = false;

    const overall = setTimeout(() => finish(new Error('SMTP connection timed out.')), 30000);
    function finish(err, ok) {
      if (finished) return;
      finished = true;
      clearTimeout(overall);
      if (socket) { try { socket.destroy(); } catch {} }
      if (err) reject(err); else resolve(ok);
    }
    function fail(msg) { finish(new Error(msg)); }
    function reply() { return new Promise(res => waiters.push(res)); }
    function onData(chunk) {
      buffer += chunk.toString('utf8');
      while (waiters.length && smtpReplyComplete(buffer)) {
        const next = waiters.shift();
        const { text, rest } = smtpTakeReply(buffer);
        buffer = rest;
        next(text);
      }
    }
    function sendLine(line, noCrlf) {
      socket.write(line + (noCrlf ? '' : '\r\n'));
      return reply();
    }
    function bind(sock) {
      if (socket) { try { socket.removeListener('data', onData); } catch {} }
      socket = sock;
      sock.on('data', onData);
      sock.on('error', err => finish(err));
      sock.on('close', () => finish(new Error('SMTP connection closed unexpectedly.')));
    }
    const code = text => Number(text.slice(0, 3));

    const initial = tls.connect({ host: cfg.host, port: cfg.port, servername: cfg.host });
    bind(initial);

    (async () => {
      try {
        let c = code(await reply()); // greeting
        if (c !== 220) return fail('SMTP greeting failed (code ' + c + ').');
        c = code(await sendLine('EHLO localhost'));
        if (c !== 250) return fail('Server rejected EHLO (code ' + c + ').');

        c = code(await sendLine('AUTH LOGIN'));
        if (c === 334) {
          c = code(await sendLine(Buffer.from(cfg.user).toString('base64')));
          if (c !== 334) return fail('SMTP username rejected.');
          c = code(await sendLine(Buffer.from(cfg.pass).toString('base64')));
          if (c !== 235) return fail('SMTP authentication failed. Check your username and app password.');
        } else {
          return fail('AUTH LOGIN expected');
        }

        c = code(await sendLine('MAIL FROM:<' + mail.fromEmail + '>'));
        if (c !== 250) return fail('Server rejected the sender address (code ' + c + ').');
        c = code(await sendLine('RCPT TO:<' + mail.to + '>'));
        if (c !== 250 && c !== 251) return fail('Server rejected the recipient address (code ' + c + ').');
        c = code(await sendLine('DATA'));
        if (c !== 354) return fail('Server refused the message body (code ' + c + ').');

        const rawMime = buildMimeMessage(mail, cfg);
        socket.write(rawMime + '\r\n');
        const finalReply = await sendLine('.');
        c = code(finalReply);
        if (c !== 250) return fail('Message was rejected by the server (' + finalReply + ').');

        await sendLine('QUIT').catch(() => {});
        return finish(null, { success: true, message: 'Email sent successfully via Gmail SMTP.' });
      } catch (err) {
        return finish(err);
      }
    })();
  });
}

async function test() {
  console.log('Sending multipart HTML+Text password reset email via Gmail SMTP...');
  const brand = 'ENMAR';
  const code = '849201';
  const text = `Assalamu alaikum,\n\nYour ${brand} password reset code is: ${code}\n\nExpires in 10 minutes.\n\nENMAR Team`;
  const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f8f9fa;padding:20px;">
    <div style="max-width:500px;background:#fff;padding:24px;border-radius:8px;border:1px solid #e2e8f0;margin:auto;">
      <h2 style="color:#631e2a;margin:0 0 16px;">${brand} Password Reset</h2>
      <p>Assalamu alaikum,</p>
      <p>We received a request to reset your password. Your 6-digit code is:</p>
      <div style="background:#f1f5f9;border:2px dashed #cbd5e1;padding:16px;text-align:center;font-size:28px;font-weight:bold;letter-spacing:6px;color:#631e2a;margin:16px 0;">${code}</div>
      <p style="color:#64748b;font-size:13px;">⏱️ This code will expire in 10 minutes. Minimum 8 characters required for new password.</p>
    </div>
  </body></html>`;

  try {
    const res = await smtpSend(cfg, {
      to: 'abuhouriramdabdulaziz85@gmail.com',
      fromEmail: cfg.fromEmail || cfg.user,
      fromHeader: '=?UTF-8?B?' + Buffer.from('ENMAR Official').toString('base64') + '?= <' + (cfg.fromEmail || cfg.user) + '>',
      subject: `${brand} Password Reset Code: ${code}`,
      text,
      html
    });
    console.log('🎉 Result:', res);
  } catch (err) {
    console.error('❌ Error:', err);
  }
}

test();
