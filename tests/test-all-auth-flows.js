// scratch/test-all-auth-flows.js
const http = require('http');
const PORT = 3000;

function req(method, urlPath, body = null, cookie = '') {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: '127.0.0.1',
      port: PORT,
      path: urlPath,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...(cookie ? { 'Cookie': cookie } : {})
      }
    };
    const r = http.request(options, (res) => {
      let chunks = '';
      res.on('data', d => { chunks += d; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(chunks); } catch {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: json || chunks,
          rawCookie: res.headers['set-cookie']
        });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

let passed = 0;
let failed = 0;
function assert(condition, message) {
  if (condition) {
    console.log(`  ✔ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✖ FAIL: ${message}`);
    failed++;
  }
}

async function runAuthSuite() {
  console.log('\n======================================================');
  console.log('       ENMAR FULL AUTH SYSTEM AUDIT & VERIFICATION    ');
  console.log('======================================================\n');

  const timestamp = Date.now();
  const testEmail = `authtest_${timestamp}@example.com`;
  const testPhone = `017${String(timestamp).slice(-8)}`;
  let initialPass = 'InitialPass123!';
  let changedPass1 = 'NewPass123!';
  let digitOnlyPass = '11223344'; // pure numbers, min 8
  let adminResetPass = 'AdminResetPass88!';

  // ── 1. REGISTRATION FLOW ──
  console.log('▶ [1. CUSTOMER REGISTRATION]');
  // Step 1a: Pre-check email
  const checkRes = await req('POST', '/api/auth/check-user', { email: testEmail, phone: testPhone });
  assert(checkRes.status === 200 && !checkRes.body.emailTaken, 'Pre-check shows new email is available');

  // Step 1b: Request Email OTP for registration
  const regOtpRes = await req('POST', '/api/auth/send-otp', { email: testEmail });
  assert(regOtpRes.status === 200 && regOtpRes.body.ok, 'Registration OTP requested with 200 OK');
  const regOtp = regOtpRes.body.devCode;
  assert(Boolean(regOtp && regOtp.length === 6), `Received 6-digit registration OTP: ${regOtp}`);

  // Step 1c: Register with short password (< 8 chars) -> should fail
  const shortPassRes = await req('POST', '/api/auth/register', {
    name: 'Auth Test User',
    email: testEmail,
    phone: testPhone,
    password: '12345',
    otp: regOtp
  });
  assert(shortPassRes.status === 400 && shortPassRes.body.error.includes('8 characters'), 'Password < 8 characters is strictly rejected with 400');

  // Step 1d: Register with valid password and OTP
  const registerRes = await req('POST', '/api/auth/register', {
    name: 'Auth Test User',
    email: testEmail,
    phone: testPhone,
    password: initialPass,
    otp: regOtp,
    address: 'Road 5, Dhanmondi',
    city: 'Dhaka'
  });
  assert(registerRes.status === 201 && registerRes.body.user && registerRes.body.user.email === testEmail, 'Customer account registered successfully with 201 Created');
  const customerId = registerRes.body.user.id;

  // ── 2. LOGIN FLOW ──
  console.log('\n▶ [2. CUSTOMER LOGIN & SESSIONS]');
  // Step 2a: Wrong password fails
  const wrongPassLogin = await req('POST', '/api/auth/login', { email: testEmail, password: 'WrongPassword!' });
  assert(wrongPassLogin.status === 401, 'Login with incorrect password rejected with 401 Unauthorized');

  // Step 2b: Case-insensitive email login succeeds
  const upperEmail = testEmail.toUpperCase();
  const validLogin = await req('POST', '/api/auth/login', { email: upperEmail, password: initialPass });
  assert(validLogin.status === 200 && validLogin.body.user.id === customerId, 'Case-insensitive email login succeeds with 200 OK');
  const custCookie = (validLogin.rawCookie && validLogin.rawCookie[0]) ? validLogin.rawCookie[0].split(';')[0] : '';
  assert(Boolean(custCookie), 'Server issued secure authentication cookie');

  // Step 2c: Verify /api/auth/me returns the logged-in user
  const meRes = await req('GET', '/api/auth/me', null, custCookie);
  assert(meRes.status === 200 && meRes.body.user && meRes.body.user.id === customerId, 'GET /api/auth/me confirms active authenticated session');

  // ── 3. FORGOT PASSWORD VIA GMAIL / EMAIL OTP ──
  console.log('\n▶ [3. FORGOT PASSWORD & RESET VIA EMAIL OTP]');
  // Step 3a: Request forgot password OTP
  const forgotRes = await req('POST', '/api/auth/forgot-password', { email: testEmail });
  assert(forgotRes.status === 200 && forgotRes.body.ok, 'Forgot password OTP request returns 200 OK');
  const forgotOtp = forgotRes.body.devCode;
  assert(Boolean(forgotOtp && forgotOtp.length === 6), `Received 6-digit forgot password OTP: ${forgotOtp}`);

  // Step 3b: Reset with invalid OTP fails
  const badOtpReset = await req('POST', '/api/auth/reset-password', {
    email: testEmail,
    otp: '000000',
    newPassword: changedPass1
  });
  assert(badOtpReset.status === 400, 'Reset with invalid OTP code rejected with 400');

  // Step 3c: Reset with valid OTP and new password
  const validReset = await req('POST', '/api/auth/reset-password', {
    email: testEmail,
    otp: forgotOtp,
    password: changedPass1
  });
  assert(validReset.status === 200 && validReset.body.ok, 'Password reset with valid OTP returns 200 OK');

  // Step 3d: Login with Old Password fails
  const oldLoginFail = await req('POST', '/api/auth/login', { email: testEmail, password: initialPass });
  assert(oldLoginFail.status === 401, 'Login with old password now rejected with 401');

  // Step 3e: Login with New Password succeeds
  const newLoginOk = await req('POST', '/api/auth/login', { email: testEmail, password: changedPass1 });
  assert(newLoginOk.status === 200, 'Login with new password succeeds with 200 OK');
  const custCookie2 = (newLoginOk.rawCookie && newLoginOk.rawCookie[0]) ? newLoginOk.rawCookie[0].split(';')[0] : '';

  // ── 4. PROFILE SECTION: CHANGE PASSWORD WITH CURRENT PASSWORD ──
  console.log('\n▶ [4. PROFILE SECTION: CHANGE PASSWORD WITH CURRENT PASSWORD]');
  // Step 4a: Wrong current password fails
  const wrongCurrent = await req('POST', '/api/change-password', {
    currentPassword: 'IncorrectOldPassword!',
    newPassword: digitOnlyPass
  }, custCookie2);
  assert(wrongCurrent.status === 401, 'Change password with wrong current password rejected with 401');

  // Step 4b: Correct current password, change to pure number password (min 8)
  const changeWithCurrent = await req('POST', '/api/change-password', {
    currentPassword: changedPass1,
    newPassword: digitOnlyPass
  }, custCookie2);
  assert(changeWithCurrent.status === 200 && changeWithCurrent.body.ok, 'Password changed using current password to pure numbers ("11223344")');

  // Step 4c: Verify login with pure number password
  const digitLogin = await req('POST', '/api/auth/login', { email: testEmail, password: digitOnlyPass });
  assert(digitLogin.status === 200, 'Login with pure number password ("11223344") succeeds with 200 OK');
  const custCookie3 = (digitLogin.rawCookie && digitLogin.rawCookie[0]) ? digitLogin.rawCookie[0].split(';')[0] : '';

  // ── 5. PROFILE SECTION: CHANGE PASSWORD VIA EMAIL OTP ──
  console.log('\n▶ [5. PROFILE SECTION: CHANGE PASSWORD VIA EMAIL OTP]');
  const profileForgotRes = await req('POST', '/api/auth/forgot-password', { email: testEmail });
  const profileOtp = profileForgotRes.body.devCode;
  const profileOtpChange = await req('POST', '/api/change-password', {
    otp: profileOtp,
    newPassword: 'ProfileOtpNewPass99!'
  }, custCookie3);
  assert(profileOtpChange.status === 200 && profileOtpChange.body.ok, 'Password changed in profile using Email OTP verification');

  // ── 6. ADMIN PANEL: RESET CUSTOMER PASSWORD ──
  console.log('\n▶ [6. ADMIN PANEL: RESET CUSTOMER PASSWORD]');
  // Step 6a: Superadmin login
  const adminLogin = await req('POST', '/api/auth/login', { email: 'superadmin@enmar.bd', password: 'SuperAdmin123!' });
  const adminCookie = (adminLogin.rawCookie && adminLogin.rawCookie[0]) ? adminLogin.rawCookie[0].split(';')[0] : '';

  // Step 6b: Admin resets customer password
  const adminResetRes = await req('POST', `/api/admin/users/${customerId}/reset-password`, {
    password: adminResetPass
  }, adminCookie);
  assert(adminResetRes.status === 200 && adminResetRes.body.ok, 'Admin resets customer password with 200 OK');

  // Step 6c: Customer logs in with admin-assigned password
  const customerLoginAfterAdminReset = await req('POST', '/api/auth/login', {
    email: testEmail,
    password: adminResetPass
  });
  assert(customerLoginAfterAdminReset.status === 200, 'Customer successfully logs in with password assigned by Admin');

  // ── 7. LOGOUT FLOW ──
  console.log('\n▶ [7. LOGOUT FLOW]');
  const logoutRes = await req('POST', '/api/auth/logout', null, custCookie3);
  assert(logoutRes.status === 200 && logoutRes.body.ok, 'Logout clears session with 200 OK');

  // Cleanup test user
  await req('DELETE', `/api/admin/users/${customerId}`, null, adminCookie);

  console.log('\n======================================================');
  console.log(`AUTH AUDIT SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('======================================================\n');
  if (failed > 0) process.exit(1);
}

runAuthSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
