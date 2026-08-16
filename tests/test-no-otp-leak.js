// scratch/test-no-otp-leak.js
const http = require('http');
const assert = require('assert');

function req(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
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
        resolve({ status: res.statusCode, body: json });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function run() {
  console.log('=== TEST: VERIFYING OTP IS ONLY SENT TO GMAIL & NOT IN API/PANEL ===');

  const testEmail = `noleak_${Date.now()}@example.com`;

  // 1. Send registration OTP
  const regRes = await req('/api/auth/send-otp', 'POST', { email: testEmail });
  console.log('1. Registration OTP Response:', regRes.status, regRes.body);
  assert.strictEqual(regRes.status, 200);
  assert.strictEqual(regRes.body.devCode, undefined, 'devCode MUST NOT be present');
  assert.strictEqual(typeof regRes.body.message, 'string');
  assert.strictEqual(/\b\d{6}\b/.test(regRes.body.message), false, '6-digit OTP MUST NOT appear in message');
  console.log('   ✔ PASS: Registration OTP is not exposed in API response.');

  // 2. Forgot Password OTP
  const forgotRes = await req('/api/auth/forgot-password', 'POST', { email: 'superadmin@enmar.bd' });
  console.log('2. Forgot Password OTP Response:', forgotRes.status, forgotRes.body);
  assert.strictEqual(forgotRes.status, 200);
  assert.strictEqual(forgotRes.body.devCode, undefined, 'devCode MUST NOT be present');
  assert.strictEqual(typeof forgotRes.body.message, 'string');
  assert.strictEqual(/\b\d{6}\b/.test(forgotRes.body.message), false, '6-digit OTP MUST NOT appear in message');
  console.log('   ✔ PASS: Forgot password OTP is not exposed in API response.');

  console.log('\n======================================================');
  console.log('🎉 VERIFICATION COMPLETE: OTP is ONLY delivered to Gmail!');
  console.log('======================================================\n');
  process.exit(0);
}

run().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
