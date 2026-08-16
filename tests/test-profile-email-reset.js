// scratch/test-profile-email-reset.js
const http = require('http');

function req(path, method = 'GET', body = null, cookie = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = {
      'Content-Type': 'application/json'
    };
    if (cookie) headers['Cookie'] = cookie;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);

    const r = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path,
      method,
      headers
    }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        let json = {};
        try { json = JSON.parse(raw); } catch { json = { raw }; }
        const setCookie = res.headers['set-cookie'];
        let sessionCookie = null;
        if (setCookie) {
          for (const c of setCookie) {
            const match = c.match(/hm_session=([^;]+)/);
            if (match) {
              sessionCookie = `hm_session=${match[1]}`;
              break;
            }
          }
        }
        resolve({ status: res.statusCode, body: json, cookie: sessionCookie });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function run() {
  console.log('=== TEST: PROFILE RESET PASSWORD VIA EMAIL OTP ===');
  
  // 1. Create a fresh test customer
  const rnd = Math.floor(10000000 + Math.random() * 90000000);
  const email = `profile_test_${Date.now()}@example.com`;
  const phone = `017${rnd.toString().slice(0, 8)}`;
  console.log('1. Registering test customer:', email, phone);
  
  const otpRes = await req('/api/auth/send-otp', 'POST', { email });
  const regOtp = otpRes.body.devCode;
  console.log('   Registration dev OTP:', regOtp);

  const regRes = await req('/api/auth/register', 'POST', {
    name: 'Profile Tester',
    email,
    phone,
    password: 'InitialPassword123!',
    otp: regOtp
  });
  console.log('   Registration result:', regRes.status, regRes.body.user ? 'User created' : regRes.body);

  // 2. Login as customer
  console.log('2. Logging in...');
  const loginRes = await req('/api/auth/login', 'POST', {
    email,
    password: 'InitialPassword123!'
  });
  const cookie = loginRes.cookie;
  console.log('   Login success, cookie acquired:', !!cookie, cookie);

  // 3. Customer is in profile, clicks "Send Code" in "Forgot? Reset via Email"
  console.log('3. Requesting email reset code in profile...');
  const forgotRes = await req('/api/auth/forgot-password', 'POST', { email }, cookie);
  console.log('   Forgot password response:', forgotRes.status, forgotRes.body.message);
  const resetOtp = forgotRes.body.devCode;
  console.log('   Reset dev OTP received:', resetOtp);

  // 4. Submit change-password with OTP and active session
  console.log('4. Submitting password change via OTP (with session cookie)...');
  const changeRes = await req('/api/change-password', 'POST', {
    email,
    otp: resetOtp,
    newPassword: 'MyNewSecurePassword999!'
  }, cookie);
  console.log('   Change password response:', changeRes.status, changeRes.body);

  if (changeRes.status === 200 && changeRes.body.ok) {
    console.log('✅ PASS: Password changed via email OTP with session!');
  } else {
    console.error('❌ FAIL: Password change failed!');
    process.exit(1);
  }

  // 5. Verify login with new password
  console.log('5. Verifying login with new password...');
  const newLogin = await req('/api/auth/login', 'POST', {
    email,
    password: 'MyNewSecurePassword999!'
  });
  if (newLogin.status === 200) {
    console.log('✅ PASS: Login with new password succeeded!');
  } else {
    console.error('❌ FAIL: Login with new password failed!');
    process.exit(1);
  }

  // 6. Test OTP change even WITHOUT session cookie
  console.log('6. Requesting another OTP to test password change without session cookie...');
  const forgotRes2 = await req('/api/auth/forgot-password', 'POST', { email });
  const resetOtp2 = forgotRes2.body.devCode;
  console.log('   New Reset dev OTP received:', resetOtp2);

  const changeRes2 = await req('/api/change-password', 'POST', {
    email,
    otp: resetOtp2,
    newPassword: 'FinalPassword8888!'
  });
  console.log('   Change password response without session:', changeRes2.status, changeRes2.body);

  if (changeRes2.status === 200 && changeRes2.body.ok) {
    console.log('✅ PASS: Password changed via email OTP without active session cookie!');
  } else {
    console.error('❌ FAIL: Password change without session cookie failed!');
    process.exit(1);
  }

  // 7. Verify login with final password
  const finalLogin = await req('/api/auth/login', 'POST', {
    email,
    password: 'FinalPassword8888!'
  });
  if (finalLogin.status === 200) {
    console.log('✅ PASS: Login with final password succeeded!');
  } else {
    console.error('❌ FAIL: Login with final password failed!');
    process.exit(1);
  }

  console.log('\n======================================================');
  console.log('🎉 ALL PROFILE EMAIL PASSWORD RESET SCENARIOS PASSED!');
  console.log('======================================================\n');
  process.exit(0);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
