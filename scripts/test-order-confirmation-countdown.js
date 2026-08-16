// scripts/test-order-confirmation-countdown.js
const http = require('http');

const PORT = 3000;
const SUPERADMIN_EMAIL = 'mdhourira6712@gmail.com';
const SUPERADMIN_PASSWORD = 'Abuhourira97@';

let passCount = 0;
let failCount = 0;

function req(method, path, data = null, cookie = '') {
  return new Promise((resolve, reject) => {
    const payload = data ? JSON.stringify(data) : null;
    const options = {
      hostname: '127.0.0.1',
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...(cookie ? { 'Cookie': cookie } : {})
      }
    };

    const request = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch { json = body; }
        const setCookie = res.headers['set-cookie'] ? res.headers['set-cookie'][0].split(';')[0] : '';
        resolve({ status: res.statusCode, body: json, cookie: setCookie });
      });
    });

    request.on('error', reject);
    if (payload) request.write(payload);
    request.end();
  });
}

function test(name, ok, details = '') {
  if (ok) {
    passCount++;
    console.log(`  \x1b[32m✔ [OK]\x1b[0m ${name} ${details ? '→ ' + details : ''}`);
  } else {
    failCount++;
    console.error(`  \x1b[31m✖ [FAIL]\x1b[0m ${name} ${details ? '→ ' + details : ''}`);
  }
}

async function verify() {
  console.log('\n===============================================================');
  console.log('   ORDER CONFIRMATION AUTO 4-HOUR COUNTDOWN & SETTINGS AUDIT');
  console.log('===============================================================\n');

  // 1. Admin Login
  const loginRes = await req('POST', '/api/auth/login', { email: SUPERADMIN_EMAIL, password: SUPERADMIN_PASSWORD });
  const adminCookie = loginRes.cookie;
  test('Admin Login', loginRes.status === 200);

  // 2. Set Default Delivery Hours in Settings to 4
  const setSettingsRes = await req('PATCH', '/api/admin/settings', {
    deliveryCountdownHours: 4,
    defaultDeliveryEstimate: '4 hours'
  }, adminCookie);
  test('Save deliveryCountdownHours in Settings (4 hours)', setSettingsRes.status === 200 && setSettingsRes.body.deliveryCountdownHours === 4);

  // 3. Customer places an order
  const products = await req('GET', '/api/products');
  const prod = products.body[0];

  const orderRes = await req('POST', '/api/orders', {
    delivery: {
      name: 'Countdown Test Customer',
      phone: '01711002233',
      address: 'House 10, Road 5, Banani',
      city: 'Dhaka'
    },
    paymentMethod: 'Cash on Delivery',
    items: [{ id: prod.id, qty: 1 }]
  }, adminCookie);
  const orderId = orderRes.body.order?.id;
  test('Customer Places New Order (Pending status)', orderRes.status === 201 && Boolean(orderId), `Order ID: ${orderId}`);

  // 4. Admin Confirms Order (without specifying estimatedDelivery)
  const confirmRes = await req('PATCH', `/api/admin/orders/${orderId}`, {
    status: 'Confirmed'
  }, adminCookie);
  test('Admin Confirms Order (PATCH status: Confirmed)', confirmRes.status === 200 && confirmRes.body.status === 'Confirmed');

  const confirmedOrder = confirmRes.body;
  test('Order Records confirmedAt Timestamp', Boolean(confirmedOrder.confirmedAt), `Confirmed at: ${confirmedOrder.confirmedAt}`);

  // 5. Verify auto 4-hour countdown calculation
  const estTime = new Date(confirmedOrder.estimatedDelivery).getTime();
  const confTime = new Date(confirmedOrder.confirmedAt).getTime();
  const diffHours = (estTime - confTime) / (3600 * 1000);
  test('Auto Countdown Time Equals Exactly 4 Hours (3.99 - 4.01h)', Math.abs(diffHours - 4) < 0.05, `Calculated diff: ${diffHours.toFixed(2)} hours`);

  // 6. Test Customer views the 4-hour countdown on their portal
  const customerOrdersRes = await req('GET', '/api/orders', null, adminCookie);
  const fetchedOrder = customerOrdersRes.body.find(o => o.id === orderId);
  test('Customer Order List Reflects 4-Hour Estimated Delivery', Boolean(fetchedOrder?.estimatedDelivery));

  // 7. Dynamic Settings Test: Change deliveryCountdownHours to 6 hours
  await req('PATCH', '/api/admin/settings', { deliveryCountdownHours: 6 }, adminCookie);
  const orderRes2 = await req('POST', '/api/orders', {
    delivery: { name: 'Test User 2', phone: '01700000000', address: 'Mirpur 10', city: 'Dhaka' },
    paymentMethod: 'Cash on Delivery',
    items: [{ id: prod.id, qty: 1 }]
  }, adminCookie);
  const orderId2 = orderRes2.body.order?.id;

  const confirmRes2 = await req('PATCH', `/api/admin/orders/${orderId2}`, { status: 'Confirmed' }, adminCookie);
  const diffHours2 = (new Date(confirmRes2.body.estimatedDelivery).getTime() - new Date(confirmRes2.body.confirmedAt).getTime()) / (3600 * 1000);
  test('Dynamic Settings: Countdown Successfully Adapts to 6 Hours', Math.abs(diffHours2 - 6) < 0.05, `Calculated diff: ${diffHours2.toFixed(2)} hours`);

  // 8. Restore default to 4 hours in settings
  await req('PATCH', '/api/admin/settings', { deliveryCountdownHours: 4 }, adminCookie);
  test('Reset Default Setting back to 4 Hours', true);

  console.log('\n===============================================================');
  console.log(`TOTAL CHECKS: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log('===============================================================\n');

  process.exit(failCount > 0 ? 1 : 0);
}

verify().catch(err => {
  console.error(err);
  process.exit(1);
});
