// Test setting delivery time on an order and verify it persists to MySQL
const http = require('node:http');
const mysql = require('../config/db.js');

function req(method, path, body, cookie) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: '127.0.0.1',
      port: 3000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {})
      }
    };
    const r = http.request(options, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(d); } catch { parsed = d; }
        resolve({ status: res.statusCode, body: parsed, cookie: res.headers['set-cookie'] });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  const login = await req('POST', '/api/auth/login', { email: 'superadmin@enmar.bd', password: 'SuperAdmin123!' });
  if (login.status !== 200) { console.log('Login failed:', login.status, login.body); process.exit(1); }
  const cookie = login.cookie[0].split(';')[0];
  console.log('Logged in');

  // Pick a non-cancelled/delivered order (e.g. Confirmed #58)
  const orders = await req('GET', '/api/admin/orders', null, cookie);
  const target = orders.body.find(o => o.id === 58) || orders.body[0];
  console.log('Target order:', target.id, target.number, '| current est:', target.estimatedDelivery);

  // Set a future delivery time
  const future = new Date(Date.now() + 2 * 24 * 3600000).toISOString();
  const patched = await req('PATCH', `/api/admin/orders/${target.id}`, { estimatedDelivery: future }, cookie);
  console.log('PATCH status:', patched.status, '| returned est:', patched.body.estimatedDelivery);
  if (patched.status !== 200) { console.log('PATCH failed'); process.exit(1); }

  // Verify persisted in MySQL
  const [rows] = await mysql.pool.promise().query('SELECT estimated_delivery FROM orders WHERE id = ?', [target.id]);
  console.log('MySQL estimated_delivery:', rows[0].estimated_delivery);

  const inStore = (await req('GET', '/api/admin/orders', null, cookie)).body.find(o => o.id === target.id);
  console.log('Store est after reload:', inStore.estimatedDelivery);

  console.log(rows[0].estimated_delivery && rows[0].estimated_delivery.includes('T') ? 'PASS: delivery time persisted to MySQL' : 'FAIL');
  process.exit(0);
})();
