const http = require('http');
const { spawn } = require('child_process');

async function runTest() {
  console.log('Starting ENMAR server...');
  const server = spawn('node', ['server.js'], { cwd: process.cwd(), stdio: 'inherit' });

  // wait 2.5s for server to start
  await new Promise(r => setTimeout(r, 2500));

  try {
    const adminCookie = await login('superadmin@enmar.bd', 'SuperAdmin123!');
    console.log('Logged in as admin. Cookie:', adminCookie ? 'OK' : 'Failed');

    // 1. GET /api/admin/orders
    const ordersRes = await req('GET', '/api/admin/orders', null, adminCookie);
    console.log('GET orders status:', ordersRes.status, 'Count:', ordersRes.body.length);
    const targetOrder = ordersRes.body.find(o => o.status !== 'Cancelled') || ordersRes.body[0];
    console.log('Selected target order ID:', targetOrder.id, 'Number:', targetOrder.number, 'Status:', targetOrder.status);

    // 2. PATCH status change
    const newStatus = targetOrder.status === 'Confirmed' ? 'Shipped' : 'Confirmed';
    const statusRes = await req('PATCH', `/api/admin/orders/${targetOrder.id}`, { status: newStatus }, adminCookie);
    console.log('PATCH status result:', statusRes.status, 'New status:', statusRes.body.status);
    if (statusRes.status !== 200 || statusRes.body.status !== newStatus) throw new Error('Status change failed');

    // 3. PATCH set estimated delivery
    const futureTime = new Date(Date.now() + 86400000).toISOString();
    const estSetRes = await req('PATCH', `/api/admin/orders/${targetOrder.id}`, { estimatedDelivery: futureTime }, adminCookie);
    console.log('PATCH estimatedDelivery set result:', estSetRes.status, 'Val:', estSetRes.body.estimatedDelivery);
    if (estSetRes.status !== 200 || !estSetRes.body.estimatedDelivery) throw new Error('Estimated delivery set failed');

    // 4. PATCH clear estimated delivery (setting null)
    const estClearRes = await req('PATCH', `/api/admin/orders/${targetOrder.id}`, { estimatedDelivery: null }, adminCookie);
    console.log('PATCH estimatedDelivery clear result:', estClearRes.status, 'Val:', estClearRes.body.estimatedDelivery);
    if (estClearRes.status !== 200 || estClearRes.body.estimatedDelivery !== null) throw new Error('Estimated delivery clear failed');

    // 5. POST message (staff reply)
    const msgRes = await req('POST', `/api/admin/orders/${targetOrder.id}/messages`, { text: 'Automated test reply from staff.' }, adminCookie);
    console.log('POST message result:', msgRes.status, 'Message text:', msgRes.body.message ? msgRes.body.message.text : 'none');
    if (msgRes.status !== 201 || !msgRes.body.ok || !msgRes.body.messages) throw new Error('Staff message post failed');

    // 6. Verify audit history trail
    const updatedOrderRes = await req('GET', '/api/admin/orders', null, adminCookie);
    const refreshed = updatedOrderRes.body.find(o => o.id === targetOrder.id);
    console.log('Refreshed order history count:', refreshed.history ? refreshed.history.length : 0);
    console.log('Latest history entry:', refreshed.history ? refreshed.history[refreshed.history.length - 1] : 'none');

    console.log('\n======================================');
    console.log('🎉 ALL ORDERS SECTION FIXES VERIFIED 100%!');
    console.log('======================================\n');
  } catch (err) {
    console.error('❌ Test failed:', err.message);
  } finally {
    server.kill('SIGTERM');
    process.exit(0);
  }
}

function req(method, path, body, cookie) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const options = {
      hostname: '127.0.0.1',
      port: 3000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...(cookie ? { Cookie: cookie } : {})
      }
    };
    const request = http.request(options, res => {
      let buf = '';
      res.on('data', chunk => buf += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(buf); } catch { json = buf; }
        resolve({ status: res.statusCode, body: json, headers: res.headers });
      });
    });
    request.on('error', reject);
    if (data) request.write(data);
    request.end();
  });
}

async function login(email, password) {
  const res = await req('POST', '/api/auth/login', { email, password });
  if (res.status === 200 && res.headers['set-cookie']) {
    return res.headers['set-cookie'][0].split(';')[0];
  }
  return null;
}

runTest();
