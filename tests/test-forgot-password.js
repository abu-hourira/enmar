// scratch/test-forgot-password.js
// Automated verification for Forgot Password flow & password flexibility (min 8 chars, any format)

const http = require('node:http');
const crypto = require('node:crypto');

const PORT = 3001;
process.env.PORT = String(PORT);
process.env.NODE_ENV = 'development';

// Spawn or require server
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

async function runTests() {
  console.log('🚀 Starting Forgot Password & Password Flexibility Test Suite...\n');

  const testEmail = `forgot_test_${Date.now()}@example.com`;
  const store = JSON.parse(require('fs').readFileSync('data/store.json', 'utf8'));

  // Create test user directly in store
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync('InitialPassword123!', salt, 64);
  const customerUser = {
    id: 999000 + Math.floor(Math.random() * 1000),
    name: 'Forgot Test User',
    email: testEmail,
    phone: '01799887766',
    passwordHash: `${salt}:${derived.toString('hex')}`,
    role: 'customer',
    active: true,
    createdAt: new Date().toISOString()
  };
  store.users.push(customerUser);
  require('fs').writeFileSync('data/store.json', JSON.stringify(store, null, 2));

  // 1. Test Forgot Password for non-existent email
  const unknownRes = await req('POST', '/api/auth/forgot-password', { email: 'nonexistent_test_9999@example.bd' });
  assert(unknownRes.status === 404, 'Forgot password for non-existent email returns 404 Not Found');

  // 2. Test Forgot Password for existing customer
  const forgotRes = await req('POST', '/api/auth/forgot-password', { email: testEmail });
  assert(forgotRes.status === 200 && forgotRes.body.ok, 'Forgot password for valid customer returns 200 OK');
  const otpCode = forgotRes.body.devCode;
  assert(otpCode && otpCode.length === 6, `Password reset OTP generated (${otpCode})`);

  // 3. Test Reset Password with invalid OTP
  const badOtpRes = await req('POST', '/api/auth/reset-password', {
    email: testEmail,
    otp: '000000',
    password: 'NewPassword123!'
  });
  assert(badOtpRes.status === 400, 'Reset password with invalid OTP rejected with 400 Bad Request');

  // 4. Test Reset Password with short password (< 8 chars)
  const shortPassRes = await req('POST', '/api/auth/reset-password', {
    email: testEmail,
    otp: otpCode,
    password: '12345'
  });
  assert(shortPassRes.status === 400, 'Reset password with short password (<8 chars) rejected with 400');

  // 5. Test Reset Password with PURE NUMERIC password (8 digits: '87654321')
  const numResetRes = await req('POST', '/api/auth/reset-password', {
    email: testEmail,
    otp: otpCode,
    password: '87654321'
  });
  assert(numResetRes.status === 200 && numResetRes.body.ok, 'Reset password with pure numeric 8-digit password (87654321) succeeds with 200 OK');

  // 6. Verify login with the newly set pure numeric password
  const numLoginRes = await req('POST', '/api/auth/login', {
    email: testEmail,
    password: '87654321'
  });
  assert(numLoginRes.status === 200 && numLoginRes.body.user.email === testEmail, 'Login with pure numeric password (87654321) succeeds with 200 OK');

  // 7. Test Forgot Password + Reset with PURE CHARACTERS password (8 letters: 'abcdefgh')
  const forgotRes2 = await req('POST', '/api/auth/forgot-password', { email: testEmail });
  assert(forgotRes2.status === 200 && forgotRes2.body.devCode, 'Second forgot password OTP generated');
  const otpCode2 = forgotRes2.body.devCode;

  const charResetRes = await req('POST', '/api/auth/reset-password', {
    email: testEmail,
    otp: otpCode2,
    password: 'abcdefgh'
  });
  assert(charResetRes.status === 200 && charResetRes.body.ok, 'Reset password with pure alphabetic 8-char password (abcdefgh) succeeds with 200 OK');

  // 8. Verify login with the newly set pure alphabetic password
  const charLoginRes = await req('POST', '/api/auth/login', {
    email: testEmail,
    password: 'abcdefgh'
  });
  assert(charLoginRes.status === 200, 'Login with pure alphabetic password (abcdefgh) succeeds with 200 OK');

  // 9. Test Forgot Password + Reset with SPECIAL CHARACTERS / SYMBOLS password ('!@#$%^&*')
  const forgotRes3 = await req('POST', '/api/auth/forgot-password', { email: testEmail });
  assert(forgotRes3.status === 200 && forgotRes3.body.devCode, 'Third forgot password OTP generated');
  const otpCode3 = forgotRes3.body.devCode;

  const symResetRes = await req('POST', '/api/auth/reset-password', {
    email: testEmail,
    otp: otpCode3,
    newPassword: '!@#$%^&*' // Testing newPassword alias
  });
  assert(symResetRes.status === 200 && symResetRes.body.ok, 'Reset password with special characters (!@#$%^&*) and newPassword alias succeeds with 200 OK');

  // 10. Verify login with special characters password
  const symLoginRes = await req('POST', '/api/auth/login', {
    email: testEmail,
    password: '!@#$%^&*'
  });
  assert(symLoginRes.status === 200, 'Login with special symbols password (!@#$%^&*) succeeds with 200 OK');

  // Clean up test user
  const finalStore = JSON.parse(require('fs').readFileSync('data/store.json', 'utf8'));
  finalStore.users = finalStore.users.filter(u => u.email !== testEmail);
  require('fs').writeFileSync('data/store.json', JSON.stringify(finalStore, null, 2));

  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! Forgot password & flexible password rules are fully working!\n');
  process.exit(0);
}

// Give server 500ms to start
setTimeout(() => {
  runTests().catch(err => {
    console.error('❌ Test execution error:', err);
    process.exit(1);
  });
}, 500);
