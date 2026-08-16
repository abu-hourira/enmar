// scratch/test-all-apis-comprehensive.js
const http = require('http');
const assert = require('assert');
const pool = require('../config/db.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Auto-load .env
try {
  const envPath = path.join(__dirname, '..', '.env');
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
    if (key && (process.env[key] === undefined || process.env[key] === '')) process.env[key] = value;
  }
} catch {}

function req(path, method = 'GET', body = null, cookie = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
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
            if (match) { sessionCookie = `hm_session=${match[1]}`; break; }
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

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(String(password), salt, 64, (error, derived) =>
      error ? reject(error) : resolve(`${salt}:${derived.toString('hex')}`));
  });
}

async function testDatabase() {
  process.stdout.write('1. Testing MySQL Database Connection (enmar_db)... ');
  const [rows] = await pool.query('SELECT 1 + 1 AS result');
  assert.strictEqual(rows[0].result, 2);
  const [tables] = await pool.query('SHOW TABLES');
  console.log(`✔ CONNECTED (${tables.length} tables found in enmar_db)`);
}

async function testStorefrontApis() {
  process.stdout.write('2. Testing Storefront Public APIs... ');
  const [p, c, r, s, m] = await Promise.all([
    req('/api/products'),
    req('/api/categories'),
    req('/api/comments'),
    req('/api/settings'),
    req('/api/ad-media')
  ]);
  assert.strictEqual(p.status, 200, 'GET /api/products');
  assert.strictEqual(c.status, 200, 'GET /api/categories');
  assert.strictEqual(r.status, 200, 'GET /api/comments');
  assert.strictEqual(s.status, 200, 'GET /api/settings');
  assert.strictEqual(m.status, 200, 'GET /api/ad-media');
  console.log(`✔ 5/5 PASSED (Products: ${p.body.length}, Categories: ${c.body.length})`);
}

async function testAuthAndAdminApis() {
  process.stdout.write('3. Testing Admin & Staff Control APIs... ');
  // Create / ensure a test admin account for testing endpoints
  const testAdminEmail = 'audit_admin@enmar.bd';
  const testAdminPass = 'AuditAdmin123!';
  const passHash = await hashPassword(testAdminPass);

  const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [testAdminEmail]);
  if (!existing || existing.length === 0) {
    await pool.query(
      "INSERT INTO users (name, email, password_hash, role, active, created_at) VALUES (?, ?, ?, 'superadmin', 1, NOW())",
      ['Audit Administrator', testAdminEmail, passHash]
    );
  } else {
    await pool.query("UPDATE users SET password_hash = ?, role = 'superadmin', active = 1 WHERE email = ?", [passHash, testAdminEmail]);
  }

  // Login as Admin
  const adminLogin = await req('/api/auth/login', 'POST', { email: testAdminEmail, password: testAdminPass });
  const cookie = adminLogin.cookie;
  assert.strictEqual(adminLogin.status, 200, 'Admin login status');
  assert(!!cookie, 'Admin cookie obtained');

  const [stats, users, orders, apis, bin, settings, subscribers, comments] = await Promise.all([
    req('/api/admin/stats', 'GET', null, cookie),
    req('/api/admin/users', 'GET', null, cookie),
    req('/api/admin/orders', 'GET', null, cookie),
    req('/api/admin/apis', 'GET', null, cookie),
    req('/api/admin/bin', 'GET', null, cookie),
    req('/api/settings', 'GET', null, cookie),
    req('/api/admin/subscribers', 'GET', null, cookie),
    req('/api/admin/comments', 'GET', null, cookie)
  ]);

  assert.strictEqual(stats.status, 200, 'GET /api/admin/stats');
  assert.strictEqual(users.status, 200, 'GET /api/admin/users');
  assert.strictEqual(orders.status, 200, 'GET /api/admin/orders');
  assert.strictEqual(apis.status, 200, 'GET /api/admin/apis');
  assert.strictEqual(bin.status, 200, 'GET /api/admin/bin');
  assert.strictEqual(settings.status, 200, 'GET /api/settings');
  assert.strictEqual(subscribers.status, 200, 'GET /api/admin/subscribers');
  assert.strictEqual(comments.status, 200, 'GET /api/admin/comments');
  console.log(`✔ 8/8 PASSED (Stats, Users: ${users.body.length}, Orders: ${orders.body.length})`);

  // Test live email endpoint through Admin API
  process.stdout.write('4. Testing Live Gmail SMTP API (/api/admin/apis/test-email)... ');
  const emailTestRes = await req('/api/admin/apis/test-email', 'POST', { to: 'abuhouriramdabdulaziz85@gmail.com' }, cookie);
  assert.strictEqual(emailTestRes.status, 200, 'POST /api/admin/apis/test-email: ' + JSON.stringify(emailTestRes.body));
  console.log(`✔ 200 OK (${emailTestRes.body.message || 'SMTP Handshake & TLS Auth Verified'})`);
}

async function testCustomerOrderLifecycle() {
  process.stdout.write('5. Testing Customer Order Lifecycle API (/api/orders)... ');
  const testEmail = `cust_api_${Date.now()}@example.com`;
  const testPass = 'CustPass123!';
  const passHash = await hashPassword(testPass);

  const [ins] = await pool.query(
    "INSERT INTO users (name, email, password_hash, role, active, created_at) VALUES (?, ?, ?, 'customer', 1, NOW())",
    ['Customer Tester', testEmail, passHash]
  );

  const custLogin = await req('/api/auth/login', 'POST', { email: testEmail, password: testPass });
  const cookie = custLogin.cookie;
  assert(!!cookie, 'Customer cookie obtained');

  const prodsRes = await req('/api/products');
  const validProdId = (prodsRes.body && prodsRes.body[0]) ? prodsRes.body[0].id : 1;

  const orderRes = await req('/api/orders', 'POST', {
    items: [{ id: validProdId, qty: 2 }],
    delivery: {
      name: 'Customer Tester',
      phone: '01711223344',
      address: 'House 10, Road 5',
      city: 'Dhaka',
      zip: '1212',
      notes: 'Call before delivery'
    },
    paymentMethod: 'Cash on Delivery'
  }, cookie);

  assert.strictEqual(orderRes.status, 201, 'Order created: ' + JSON.stringify(orderRes.body));
  const orderId = orderRes.body.order.id;

  // Retrieve customer orders
  const myOrders = await req('/api/orders', 'GET', null, cookie);
  assert(myOrders.body.some(o => o.id === orderId), 'Order listed in customer orders');
  console.log(`✔ 201 CREATED (Order #${orderRes.body.order.number}, ID: ${orderId})`);
}

async function main() {
  console.log('\n======================================================');
  console.log('       ENMAR COMPLETE API CONNECTION AUDIT             ');
  console.log('======================================================\n');
  try {
    await testDatabase();
    await testStorefrontApis();
    await testAuthAndAdminApis();
    await testCustomerOrderLifecycle();
    console.log('\n======================================================');
    console.log('🎉 ALL PROJECT APIs ARE PROPERLY CONNECTED & WORKING!');
    console.log('======================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ API Connection Audit Failed:', err);
    process.exit(1);
  }
}

main();
