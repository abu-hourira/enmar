const tls = require('tls');

async function sendVerifiedEmail(toEmail) {
  const username = 'abuhouriramdabdulaziz85@gmail.com';
  const pass = 'bujpinlwlituobbh';
  const otpCode = Math.floor(100000 + Math.random() * 900000);

  console.log(`Sending live OTP to: ${toEmail} with code: ${otpCode}`);

  return new Promise((resolve, reject) => {
    let buffer = '';
    const waiters = [];
    let socket = null;
    let finished = false;
    const overall = setTimeout(() => finish(new Error('SMTP timeout')), 15000);

    function finish(err, ok) {
      if (finished) return;
      finished = true;
      clearTimeout(overall);
      if (socket) { try { socket.destroy(); } catch {} }
      if (err) resolve({ ok: false, err: err.message });
      else resolve({ ok: true, code: otpCode, info: ok });
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
    function sendLine(line) { socket.write(line + '\r\n'); return reply(); }
    function bind(sock) {
      socket = sock;
      sock.on('data', onData);
      sock.on('error', err => finish(err));
      sock.on('close', () => finish(new Error('SMTP closed')));
    }

    function smtpReplyComplete(buf) {
      const nl = buf.indexOf('\r\n');
      if (nl === -1) return false;
      const first = buf.slice(0, nl);
      if (first.length < 4 || first[3] === ' ') return true;
      return false;
    }

    function smtpTakeReply(buf) {
      const nl1 = buf.indexOf('\r\n');
      const first = buf.slice(0, nl1);
      return { text: first, rest: buf.slice(nl1 + 2) };
    }

    const code = text => Number(text.slice(0, 3));
    const initial = tls.connect({ host: 'smtp.gmail.com', port: 465, servername: 'smtp.gmail.com' });
    bind(initial);

    (async () => {
      try {
        let c = code(await reply());
        c = code(await sendLine('EHLO smtp.gmail.com'));
        c = code(await sendLine('AUTH LOGIN'));
        c = code(await sendLine(Buffer.from(username).toString('base64')));
        c = code(await sendLine(Buffer.from(pass).toString('base64')));
        if (c !== 235) return fail('Auth failed: ' + c);

        c = code(await sendLine(`MAIL FROM:<${username}>`));
        c = code(await sendLine(`RCPT TO:<${toEmail}>`));
        c = code(await sendLine('DATA'));

        const msgId = `<otp-${Date.now()}-${Math.random().toString(36).substring(2, 8)}@enmar.shop>`;
        const dateStr = new Date().toUTCString();

        const emailBody = `
Dear Customer,

Your ENMAR verification code is: ${otpCode}

Please enter this 6-digit code to complete your registration or verification.
This code is valid for 10 minutes.

If you did not request this code, please ignore this email.

Best regards,
ENMAR Official Team
https://enmar.shop
`.trim();

        const headers = [
          `From: "ENMAR Shop" <${username}>`,
          `To: <${toEmail}>`,
          `Subject: ${otpCode} is your ENMAR verification code`,
          `Date: ${dateStr}`,
          `Message-ID: ${msgId}`,
          `MIME-Version: 1.0`,
          `Content-Type: text/plain; charset=UTF-8`,
          `Content-Transfer-Encoding: 8bit`,
          `Auto-Submitted: auto-generated`,
          '',
          emailBody
        ].join('\r\n');

        socket.write(headers + '\r\n');
        const finalReply = await sendLine('.');
        c = code(finalReply);
        if (c !== 250) return fail('Message rejected: ' + c);

        await sendLine('QUIT').catch(() => {});
        return finish(null, 'OK 250 Delivered');
      } catch (err) {
        return finish(err);
      }
    })();
  });
}

(async () => {
  console.log('Sending to abuhourira4@gmail.com...');
  const r1 = await sendVerifiedEmail('abuhourira4@gmail.com');
  console.log('Result 1:', r1);

  console.log('\nSending to abuhouriramdabdulaziz85@gmail.com...');
  const r2 = await sendVerifiedEmail('abuhouriramdabdulaziz85@gmail.com');
  console.log('Result 2:', r2);
})();
