const tls = require('tls');
const net = require('net');

async function testGmail(username, pass, to) {
  console.log(`\n==============================================`);
  console.log(`Testing Gmail SMTP connection for: ${username}`);
  console.log(`Recipient: ${to}`);
  console.log(`==============================================`);

  return new Promise((resolve, reject) => {
    let buffer = '';
    const waiters = [];
    let socket = null;
    let finished = false;
    const overall = setTimeout(() => finish(new Error('SMTP timeout after 15s')), 15000);

    function finish(err, ok) {
      if (finished) return;
      finished = true;
      clearTimeout(overall);
      if (socket) { try { socket.destroy(); } catch {} }
      if (err) {
        console.error('❌ Failed:', err.message);
        resolve({ success: false, error: err.message });
      } else {
        console.log('✔ SUCCESS:', ok);
        resolve({ success: true, message: ok });
      }
    }

    function fail(msg) { finish(new Error(msg)); }
    function reply() { return new Promise(res => waiters.push(res)); }
    function onData(chunk) {
      buffer += chunk.toString('utf8');
      while (waiters.length && smtpReplyComplete(buffer)) {
        const next = waiters.shift();
        const { text, rest } = smtpTakeReply(buffer);
        buffer = rest;
        console.log('← ' + text.trim());
        next(text);
      }
    }
    function sendLine(line) {
      console.log('→ ' + (line.startsWith('AUTH') || line.length > 20 ? line.slice(0, 15) + '...' : line));
      socket.write(line + '\r\n');
      return reply();
    }
    function bind(sock) {
      socket = sock;
      sock.on('data', onData);
      sock.on('error', err => finish(err));
      sock.on('close', () => finish(new Error('SMTP connection closed')));
    }

    function smtpReplyComplete(buf) {
      const nl = buf.indexOf('\r\n');
      if (nl === -1) return false;
      const first = buf.slice(0, nl);
      if (first.length < 4 || first[3] === ' ') return true;
      if (first[3] === '-') {
        let idx = nl + 2;
        for (;;) {
          const nextNl = buf.indexOf('\r\n', idx);
          if (nextNl === -1) return false;
          const line = buf.slice(idx, nextNl);
          if (line.length >= 4 && line[3] === ' ') return true;
          idx = nextNl + 2;
        }
      }
      return false;
    }

    function smtpTakeReply(buf) {
      const nl1 = buf.indexOf('\r\n');
      const first = buf.slice(0, nl1);
      if (first[3] === ' ' || first.length < 4) {
        return { text: first, rest: buf.slice(nl1 + 2) };
      }
      buf = buf.slice(nl1 + 2);
      let text = first;
      if (first[3] === '-') {
        for (;;) {
          const nl = buf.indexOf('\r\n');
          if (nl === -1) break;
          const line = buf.slice(0, nl);
          buf = buf.slice(nl + 2);
          text += '\r\n' + line;
          if (line[3] === ' ') break;
        }
      }
      return { text, rest: buf };
    }

    const code = text => Number(text.slice(0, 3));
    const initial = tls.connect({ host: 'smtp.gmail.com', port: 465, servername: 'smtp.gmail.com' });
    bind(initial);

    (async () => {
      try {
        let c = code(await reply());
        if (c !== 220) return fail('Greeting failed: ' + c);

        c = code(await sendLine('EHLO smtp.gmail.com'));
        if (c !== 250) return fail('EHLO failed: ' + c);

        c = code(await sendLine('AUTH LOGIN'));
        if (c === 334) {
          c = code(await sendLine(Buffer.from(username).toString('base64')));
          if (c !== 334) return fail('Username rejected: ' + c);

          c = code(await sendLine(Buffer.from(pass).toString('base64')));
          if (c !== 235) return fail('Authentication failed (Code: ' + c + ')');
        } else {
          return fail('Unexpected AUTH response: ' + c);
        }

        c = code(await sendLine(`MAIL FROM:<${username}>`));
        if (c !== 250) return fail('MAIL FROM rejected: ' + c);

        c = code(await sendLine(`RCPT TO:<${to}>`));
        if (c !== 250 && c !== 251) return fail('RCPT TO rejected: ' + c);

        c = code(await sendLine('DATA'));
        if (c !== 354) return fail('DATA rejected: ' + c);

        const dataContent = `From: "ENMAR Official" <${username}>\r\n`
          + `To: <${to}>\r\n`
          + `Subject: =?UTF-8?B?${Buffer.from('ENMAR Test Verification Mail - Success!').toString('base64')}?=\r\n`
          + `Date: ${new Date().toUTCString()}\r\n`
          + `MIME-Version: 1.0\r\n`
          + `Content-Type: text/plain; charset="UTF-8"\r\n`
          + `Content-Transfer-Encoding: base64\r\n`
          + `\r\n`
          + Buffer.from(`Hello!\n\nThis is a test email sent from ENMAR to verify your Gmail SMTP configuration.\n\nYour 16-character App Password is working 100% successfully!\n\nTimestamp: ${new Date().toISOString()}`).toString('base64');

        socket.write(dataContent + '\r\n');
        const finalReply = await sendLine('.');
        c = code(finalReply);
        if (c !== 250) return fail('Message rejected: ' + c);

        await sendLine('QUIT').catch(() => {});
        return finish(null, 'Email sent successfully via Gmail SMTP!');
      } catch (err) {
        return finish(err);
      }
    })();
  });
}

(async () => {
  const pass = 'bujpinlwlituobbh';
  
  // Test 1: with abuhourira4@gmail.com
  let res1 = await testGmail('abuhourira4@gmail.com', pass, 'abuhourira4@gmail.com');
  
  // If not, test with abuhouriramdabdulaziz85@gmail.com
  if (!res1.success) {
    console.log('\nTrying second account: abuhouriramdabdulaziz85@gmail.com...');
    await testGmail('abuhouriramdabdulaziz85@gmail.com', pass, 'abuhourira4@gmail.com');
  }
})();
