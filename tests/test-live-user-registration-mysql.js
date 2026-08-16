// scratch/test-live-user-registration-mysql.js
const http = require('http');
const pool = require('../config/db.js');

function post(url, data) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const bodyStr = JSON.stringify(data);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr)
        }
      },
      (res) => {
        let text = '';
        res.on('data', chunk => text += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(text) });
          } catch {
            resolve({ status: res.statusCode, data: text });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

async function run() {
  const ts = Date.now();
  const testEmail = `live_mysql_user_${ts}@example.com`;
  const testPhone = '017' + String(Math.floor(10000000 + Math.random() * 90000000));
  console.log(`1. Registering test user: ${testEmail} (Phone: ${testPhone})`);

  // Send registration OTP
  const otpRes = await post('http://localhost:3000/api/auth/send-otp', {
    email: testEmail,
    phone: testPhone
  });
  console.log('OTP response:', otpRes.data);
  const otp = otpRes.data.devCode;

  // Register account
  const regRes = await post('http://localhost:3000/api/auth/register', {
    name: 'MySQL Live Real-time Account',
    email: testEmail,
    phone: testPhone,
    password: 'Password123!',
    otp: otp
  });
  console.log('Registration result:', regRes.status, regRes.data.message || regRes.data);

  // Wait 100ms for async sync
  await new Promise(r => setTimeout(r, 200));

  // Query MySQL directly
  const [rows] = await pool.query('SELECT id, name, email, phone, role, created_at FROM users WHERE email = ?', [testEmail]);
  console.log('\n2. Direct MySQL Query Result:');
  console.log(rows);

  if (rows.length > 0) {
    console.log('\n🎉 SUCCESS: The registered account is INSTANTLY stored and verified in MySQL enmar_db table users!');
  } else {
    console.error('\n❌ User not found in MySQL.');
  }

  await pool.end();
}

run().catch(console.error);
