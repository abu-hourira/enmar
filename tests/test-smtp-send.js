// scratch/test-smtp-send.js
const fs = require('fs');
const tls = require('node:tls');
const net = require('node:net');

const store = JSON.parse(fs.readFileSync('data/store.json', 'utf8'));
const cfg = store.apiConfigs.email;

function emailErrorContext(err, cfg) {
  return err;
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
      if (err) reject(emailErrorContext(err, cfg)); else resolve(ok);
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
      console.log('>> SEND:', line.startsWith('AUTH') || line.length > 30 ? line.slice(0, 20) + '...' : line);
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
    const code = text => {
      console.log('<< RECV:', text.replace(/\r\n/g, ' | '));
      return Number(text.slice(0, 3));
    };

    const initial = cfg.secure
      ? tls.connect({ host: cfg.host, port: cfg.port, servername: cfg.host })
      : net.connect({ host: cfg.host, port: cfg.port });
    bind(initial);

    (async () => {
      try {
        let c = code(await reply()); // greeting
        if (c !== 220) return fail('SMTP greeting failed (code ' + c + ').');
        c = code(await sendLine('EHLO localhost'));
        if (c !== 250) return fail('Server rejected EHLO (code ' + c + ').');

        if (!cfg.secure) {
          c = code(await sendLine('STARTTLS'));
          if (c === 220) {
            const tlsSock = tls.connect({ socket, servername: cfg.host });
            await new Promise((res, rej) => { tlsSock.once('secureConnect', res); tlsSock.once('error', rej); });
            bind(tlsSock);
            c = code(await sendLine('EHLO localhost'));
            if (c !== 250) return fail('EHLO after STARTTLS failed (code ' + c + ').');
          }
        }

        c = code(await sendLine('AUTH LOGIN'));
        if (c === 334) {
          c = code(await sendLine(Buffer.from(cfg.user).toString('base64')));
          if (c !== 334) return fail('SMTP username rejected.');
          c = code(await sendLine(Buffer.from(cfg.pass).toString('base64')));
          if (c !== 235) return fail('SMTP authentication failed. Check your username and app password.');
        } else {
          c = code(await sendLine('AUTH PLAIN ' + Buffer.from('\u0000' + cfg.user + '\u0000' + cfg.pass).toString('base64')));
          if (c !== 235) return fail('SMTP authentication failed. Check your credentials.');
        }

        c = code(await sendLine('MAIL FROM:<' + mail.fromEmail + '>'));
        if (c !== 250) return fail('Server rejected the sender address (code ' + c + ').');
        c = code(await sendLine('RCPT TO:<' + mail.to + '>'));
        if (c !== 250 && c !== 251) return fail('Server rejected the recipient address (code ' + c + ').');
        c = code(await sendLine('DATA'));
        if (c !== 354) return fail('Server refused the message body (code ' + c + ').');

        const dataContent = 'From: ' + mail.fromHeader + '\r\n'
          + 'To: <' + mail.to + '>\r\n'
          + 'Subject: =?UTF-8?B?' + Buffer.from(mail.subject).toString('base64') + '?=\r\n'
          + 'Date: ' + new Date().toUTCString() + '\r\n'
          + 'MIME-Version: 1.0\r\n'
          + 'Content-Type: text/plain; charset="UTF-8"\r\n'
          + 'Content-Transfer-Encoding: base64\r\n'
          + '\r\n'
          + Buffer.from(mail.text).toString('base64');
        
        socket.write(dataContent + '\r\n');
        const finalReply = await sendLine('.');
        c = code(finalReply);
        if (c !== 250) return fail('Message was rejected by the server (' + finalReply + ').');

        await sendLine('QUIT').catch(() => {});
        return finish(null, { success: true, message: 'Email sent successfully.' });
      } catch (err) {
        return finish(err);
      }
    })();
  });
}

async function test() {
  console.log('Sending test reset code email via Gmail SMTP...');
  try {
    const res = await smtpSend(cfg, {
      to: 'abuhouriramdabdulaziz85@gmail.com',
      fromEmail: cfg.fromEmail || cfg.user,
      fromHeader: '=?UTF-8?B?' + Buffer.from('ENMAR Official').toString('base64') + '?= <' + (cfg.fromEmail || cfg.user) + '>',
      subject: 'ENMAR Password Reset Code: 123456',
      text: 'Assalamu alaikum,\n\nYour password reset code is 123456.\n\nENMAR Team'
    });
    console.log('🎉 Result:', res);
  } catch (err) {
    console.error('❌ Send error:', err);
  }
}

test();
