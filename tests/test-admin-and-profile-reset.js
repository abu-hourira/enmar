// scratch/test-admin-and-profile-reset.js
const http = require('http');
const crypto = require('crypto');

const PORT = 3003;
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
  console.log('🚀 Running Complete Password Reset & Change Test Suite...\n');

  // 1. Log in as superadmin
  const adminLogin = await req('POST', '/api/auth/login', {
    email: 'superadmin@enmar.bd',
    password: 'SuperAdmin123!'
  });
  assert(adminLogin.status === 200, 'Superadmin signs in successfully');
  const adminCookie = extractCookie(adminLogin.cookies);

  // 2. Create a test customer
  const store = JSON.parse(require('fs').readFileSync('data/store.json', 'utf8'));
  const testEmail = `profile_test_${Date.now()}@example.com`;
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync('OldPassword123!', salt, 64);
  const newUserId = 998000 + Math.floor(Math.random() * 1000);
  const testUser = {
    id: newUserId,
    name: 'Profile Test Customer',
    email: testEmail,
    phone: '01711223344',
    passwordHash: `${salt}:${derived.toString('hex')}`,
    role: 'customer',
    active: true,
    createdAt: new Date().toISOString()
  };
  store.users.push(testUser);
  require('fs').writeFileSync('data/store.json', JSON.stringify(store, null, 2));

  // 3. Customer logs in with OldPassword123!
  const custLogin = await req('POST', '/api/auth/login', {
    email: testEmail,
    password: 'OldPassword123!'
  });
  assert(custLogin.status === 200, 'Customer signs in with initial password');
  const custCookie = extractCookie(custLogin.cookies);

  // 4. Customer changes password in profile section to pure numbers: '99887766'
  const changeRes = await req('POST', '/api/change-password', {
    currentPassword: 'OldPassword123!',
    newPassword: '99887766'
  }, { 'Cookie': custCookie });
  assert(changeRes.status === 200 && changeRes.body.ok, 'Customer changes password to pure numbers (99887766) via /api/change-password');

  // 5. Customer logs in with new pure numbers password
  const newCustLogin = await req('POST', '/api/auth/login', {
    email: testEmail,
    password: '99887766'
  });
  assert(newCustLogin.status === 200, 'Customer signs in with new pure numbers password (99887766)');
  const updatedCustCookie = extractCookie(newCustLogin.cookies);

  // 6. Customer resets password in profile section via Email OTP (simulating "Forgot Current Password?" while in profile)
  const forgotOtpRes = await req('POST', '/api/auth/forgot-password', { email: testEmail });
  assert(forgotOtpRes.status === 200 && forgotOtpRes.body.devCode, 'Email OTP generated for profile reset');
  const profileOtp = forgotOtpRes.body.devCode;

  const otpChangeRes = await req('POST', '/api/change-password', {
    otp: profileOtp,
    newPassword: 'OtpResetPass456#'
  }, { 'Cookie': updatedCustCookie });
  assert(otpChangeRes.status === 200 && otpChangeRes.body.ok, 'Customer resets password via OTP in profile section (OtpResetPass456#)');

  // 7. Customer logs in with OTP-reset password
  const otpLoginRes = await req('POST', '/api/auth/login', {
    email: testEmail,
    password: 'OtpResetPass456#'
  });
  assert(otpLoginRes.status === 200, 'Customer signs in with OTP-reset password');

  // 8. Admin resets customer password to 'adminreset123'
  const adminResetRes = await req('POST', `/api/admin/users/${newUserId}/reset-password`, {
    password: 'adminreset123'
  }, { 'Cookie': adminCookie });
  assert(adminResetRes.status === 200 && adminResetRes.body.ok, 'Admin resets customer password to adminreset123');

  // 9. Customer logs in with admin-reset password 'adminreset123'
  const postResetLogin = await req('POST', '/api/auth/login', {
    email: testEmail,
    password: 'adminreset123'
  });
  assert(postResetLogin.status === 200, 'Customer signs in with admin-reset password');

  // 10. Admin resets with pure numeric password '12345678'
  const adminResetNum = await req('POST', `/api/admin/users/${newUserId}/reset-password`, {
    password: '12345678'
  }, { 'Cookie': adminCookie });
  assert(adminResetNum.status === 200 && adminResetNum.body.ok, 'Admin resets customer password with pure numeric password (12345678)');

  const numLogin = await req('POST', '/api/auth/login', {
    email: testEmail,
    password: '12345678'
  });
  assert(numLogin.status === 200, 'Customer signs in with pure numeric admin-reset password (12345678)');

  // 11. Test Staff Account Reset by Admin
  const staffEmail = `staff_test_${Date.now()}@example.com`;
  const staffId = 997000 + Math.floor(Math.random() * 1000);
  const staffSalt = crypto.randomBytes(16).toString('hex');
  const staffHash = crypto.scryptSync('InitialStaffPass123!', staffSalt, 64);
  const currentStore = JSON.parse(require('fs').readFileSync('data/store.json', 'utf8'));
  currentStore.users.push({
    id: staffId,
    name: 'Test Manager Staff',
    email: staffEmail,
    phone: '01899887766',
    passwordHash: `${staffSalt}:${staffHash.toString('hex')}`,
    role: 'manager',
    active: true,
    createdAt: new Date().toISOString()
  });
  require('fs').writeFileSync('data/store.json', JSON.stringify(currentStore, null, 2));

  const staffResetRes = await req('POST', `/api/admin/users/${staffId}/reset-password`, {
    password: 'ManagerNewPass2026!'
  }, { 'Cookie': adminCookie });
  assert(staffResetRes.status === 200 && staffResetRes.body.ok, 'Admin resets staff account password');

  const staffLoginRes = await req('POST', '/api/auth/login', {
    email: staffEmail,
    password: 'ManagerNewPass2026!'
  });
  assert(staffLoginRes.status === 200 && staffLoginRes.body.user.role === 'manager', 'Staff member signs in with newly reset password');

  // Clean up
  const cleanStore = JSON.parse(require('fs').readFileSync('data/store.json', 'utf8'));
  cleanStore.users = cleanStore.users.filter(u => u.id !== newUserId && u.id !== staffId);
  require('fs').writeFileSync('data/store.json', JSON.stringify(cleanStore, null, 2));

  console.log('\n🎉 ALL PROFILE & ADMIN RESET PASSWORD TESTS PASSED PERFECTLY!\n');
  process.exit(0);
}

setTimeout(() => {
  run().catch(err => {
    console.error('❌ Test execution error:', err);
    process.exit(1);
  });
}, 500);
