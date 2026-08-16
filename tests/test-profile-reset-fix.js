// scratch/test-profile-reset-fix.js
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');

const PORT = 3005;
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
          body: json,
          cookies: res.headers['set-cookie']
        });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function extractCookie(setCookieHeaders) {
  if (!setCookieHeaders) return '';
  const first = Array.isArray(setCookieHeaders) ? setCookieHeaders[0] : setCookieHeaders;
  return first.split(';')[0];
}

function assert(cond, msg) {
  if (!cond) {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${msg}`);
}

async function run() {
  console.log('🚀 Running Profile Password Reset OTP & Spaces Test Suite...\n');

  const testEmail = `profile_fix_${Date.now()}@example.com`;
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync('OldSecret123!', salt, 64);
  const newUserId = 999100 + Math.floor(Math.random() * 100);

  const store = JSON.parse(fs.readFileSync('data/store.json', 'utf8'));
  store.users.push({
    id: newUserId,
    name: 'Profile Fix Tester',
    email: testEmail,
    phone: '01799887766',
    passwordHash: `${salt}:${derived.toString('hex')}`,
    role: 'customer',
    active: true,
    createdAt: new Date().toISOString()
  });
  fs.writeFileSync('data/store.json', JSON.stringify(store, null, 2));

  // 1. Sign in
  const loginRes = await req('POST', '/api/auth/login', {
    email: testEmail,
    password: 'OldSecret123!'
  });
  assert(loginRes.status === 200, 'Customer logged in successfully');
  const custCookie = extractCookie(loginRes.cookies);

  // 2. Request OTP for profile reset
  const otpGen = await req('POST', '/api/auth/forgot-password', { email: testEmail });
  assert(otpGen.status === 200, 'Forgot password OTP endpoint returns 200 OK');
  const code = otpGen.body.devCode;
  assert(!!code, 'Generated OTP code: ' + code);

  // 3. Test submitting OTP with spaces like "8 7 9 4 2 9" and newPassword
  const spacedCode = code.split('').join(' ');
  console.log(`Testing change-password with spaced OTP: "${spacedCode}"...`);
  const resetWithSpacedOtp = await req('POST', '/api/change-password', {
    otp: spacedCode,
    newPassword: 'BrandNewPass999$'
  }, { 'Cookie': custCookie });

  assert(resetWithSpacedOtp.status === 200, 'Password reset with spaced OTP succeeds with 200 OK');
  assert(resetWithSpacedOtp.body.ok === true, 'Response body has ok: true');

  // 4. Verify customer can login with BrandNewPass999$
  const newLogin = await req('POST', '/api/auth/login', {
    email: testEmail,
    password: 'BrandNewPass999$'
  });
  assert(newLogin.status === 200, 'Customer successfully logs in with the newly reset password');

  // 5. Test Know Current Password mode with correct current password
  const updatedCookie = extractCookie(newLogin.cookies);
  const changeWithCurrent = await req('POST', '/api/change-password', {
    currentPassword: 'BrandNewPass999$',
    newPassword: 'AnotherGoodPass888#'
  }, { 'Cookie': updatedCookie });
  assert(changeWithCurrent.status === 200, 'Know Current Password mode succeeds with 200 OK');

  // 6. Test with wrong current password -> returns 401 with helpful guidance
  const wrongCurrent = await req('POST', '/api/change-password', {
    currentPassword: 'WrongPassword!',
    newPassword: 'AnotherGoodPass888#'
  }, { 'Cookie': updatedCookie });
  assert(wrongCurrent.status === 401, 'Wrong current password correctly returns 401');
  assert(wrongCurrent.body.error.includes('Forgot? Reset via Email'), 'Helpful guidance included in 401 response');

  // Clean up
  const cleanStore = JSON.parse(fs.readFileSync('data/store.json', 'utf8'));
  cleanStore.users = cleanStore.users.filter(u => u.id !== newUserId);
  fs.writeFileSync('data/store.json', JSON.stringify(cleanStore, null, 2));

  console.log('\n🎉 ALL PROFILE RESET FIX TESTS PASSED SUCCESSFULLY!\n');
  process.exit(0);
}

setTimeout(() => {
  run().catch(err => {
    console.error('❌ Test error:', err);
    process.exit(1);
  });
}, 500);
