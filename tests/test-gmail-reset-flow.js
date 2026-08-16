// scratch/test-gmail-reset-flow.js
const http = require('http');
const fs = require('fs');

const PORT = 3004;
process.env.PORT = String(PORT);
process.env.NODE_ENV = 'development';

require('../server.js');

function req(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const reqOptions = {
      hostname: 'localhost',
      port: PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...headers
      }
    };
    const r = http.request(reqOptions, res => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(raw); } catch { json = raw; }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: json
        });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function assert(cond, msg) {
  if (!cond) {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${msg}`);
}

async function run() {
  console.log('🚀 Running Gmail Password Reset Flow Verification...\n');

  // Verify store email configuration
  const store = JSON.parse(fs.readFileSync('data/store.json', 'utf8'));
  const user = store.users.find(u => u.email === 'abuhouriramdabdulaziz85@gmail.com');
  assert(!!user, 'Found target Gmail account in store (abuhouriramdabdulaziz85@gmail.com)');

  // 1. Request Password Reset for real Gmail account
  console.log('1. Triggering /api/auth/forgot-password for Gmail account...');
  const forgotRes = await req('POST', '/api/auth/forgot-password', {
    email: 'abuhouriramdabdulaziz85@gmail.com'
  });
  assert(forgotRes.status === 200, 'Forgot password returns 200 OK');
  assert(forgotRes.body.ok === true, 'Forgot password response indicates ok: true');
  assert(!!forgotRes.body.devCode, 'DevCode / OTP received: ' + forgotRes.body.devCode);
  const otpCode = forgotRes.body.devCode;

  // 2. Cooldown check (immediate second request should trigger 429 cooldown)
  const rapidRes = await req('POST', '/api/auth/forgot-password', {
    email: 'abuhouriramdabdulaziz85@gmail.com'
  });
  assert(rapidRes.status === 429, 'Immediate second request blocked by cooldown (429 Too Many Requests)');
  assert(rapidRes.body.cooldown > 0, `Cooldown returned (${rapidRes.body.cooldown}s)`);

  // 3. Reset password using the 6-digit OTP code and a new password
  const newTestPass = 'GmailPass2026!#';
  const resetRes = await req('POST', '/api/auth/reset-password', {
    email: 'abuhouriramdabdulaziz85@gmail.com',
    otp: otpCode,
    newPassword: newTestPass
  });
  assert(resetRes.status === 200, 'Password reset with OTP returns 200 OK');
  assert(resetRes.body.ok === true, 'Password reset response indicates ok: true');

  // 4. Log in with the newly set password
  const loginRes = await req('POST', '/api/auth/login', {
    email: 'abuhouriramdabdulaziz85@gmail.com',
    password: newTestPass
  });
  assert(loginRes.status === 200, 'Login with newly reset password succeeds with 200 OK');
  assert(loginRes.body.user.email === 'abuhouriramdabdulaziz85@gmail.com', 'Logged in as abuhouriramdabdulaziz85@gmail.com');

  console.log('\n🎉 ALL GMAIL PASSWORD RESET TESTS PASSED SUCCESSFULLY!\n');
  process.exit(0);
}

setTimeout(() => {
  run().catch(err => {
    console.error('❌ Test error:', err);
    process.exit(1);
  });
}, 500);
