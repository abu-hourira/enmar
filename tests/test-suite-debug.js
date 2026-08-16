// scratch/test-suite-debug.js
const http = require('http');

function req(method, path, data, cookie) {
  return new Promise((resolve, reject) => {
    const bodyStr = data ? JSON.stringify(data) : '';
    const headers = { 'Content-Type': 'application/json' };
    if (data) headers['Content-Length'] = Buffer.byteLength(bodyStr);
    if (cookie) headers['Cookie'] = cookie;

    const r = http.request({ hostname: 'localhost', port: 3000, path, method, headers }, (res) => {
      let text = '';
      res.on('data', chunk => text += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(text), rawCookie: res.headers['set-cookie'] });
        } catch {
          resolve({ status: res.statusCode, body: text, rawCookie: res.headers['set-cookie'] });
        }
      });
    });
    r.on('error', reject);
    if (data) r.write(bodyStr);
    r.end();
  });
}

async function debug() {
  console.log('1. Admin login...');
  const adminLogin = await req('POST', '/api/auth/login', { email: 'superadmin@enmar.bd', password: 'SuperAdmin123!' });
  console.log('Admin login status:', adminLogin.status, adminLogin.body);
  const adminCookie = (adminLogin.rawCookie && adminLogin.rawCookie[0]) ? adminLogin.rawCookie[0].split(';')[0] : '';

  console.log('\n2. Creating customer via admin API...');
  const testEmail = `debug_cust_${Date.now()}@example.com`;
  const createRes = await req('POST', '/api/admin/users', {
    name: 'Debug Customer',
    email: testEmail,
    password: 'Password123!',
    role: 'customer'
  }, adminCookie);
  console.log('Create customer status:', createRes.status, createRes.body);

  console.log('\n3. Logging in as newly created customer...');
  const custLogin = await req('POST', '/api/auth/login', {
    email: testEmail,
    password: 'Password123!'
  });
  console.log('Customer login status:', custLogin.status, custLogin.body);
}

debug().catch(console.error);
