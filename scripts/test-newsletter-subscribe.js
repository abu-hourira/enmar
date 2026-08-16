// scripts/test-newsletter-subscribe.js
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
  console.log('    ENMAR NEWSLETTER & SUBSCRIBER MANAGEMENT AUDIT');
  console.log('===============================================================\n');

  // 1. Invalid email rejection
  const badSub = await req('POST', '/api/subscribe', { email: 'notanemail' });
  test('Invalid Email Validation', badSub.status === 400);

  // 2. Successful subscription
  const testSubEmail = `newsletter_reader_${Date.now()}@organicbd.com`;
  const subRes = await req('POST', '/api/subscribe', { email: testSubEmail });
  test('Storefront Newsletter Subscribe (POST /api/subscribe)', subRes.status === 201 && subRes.body.ok, `Email: ${testSubEmail}`);

  // 3. Admin Login
  const loginRes = await req('POST', '/api/auth/login', { email: SUPERADMIN_EMAIL, password: SUPERADMIN_PASSWORD });
  const adminCookie = loginRes.cookie;
  test('Admin Login', loginRes.status === 200);

  // 4. Admin Subscribers List
  const adminSubsRes = await req('GET', '/api/admin/subscribers', null, adminCookie);
  test('Fetch Admin Subscribers List (GET /api/admin/subscribers)', adminSubsRes.status === 200 && Array.isArray(adminSubsRes.body));
  const foundSub = adminSubsRes.body.find(s => s.email === testSubEmail);
  test('Newly Subscribed Email Present in Admin Database', Boolean(foundSub), `Subscriber ID: ${foundSub?.id}`);

  // 5. Delete Subscriber
  if (foundSub) {
    const delSubRes = await req('DELETE', `/api/admin/subscribers/${foundSub.id}`, null, adminCookie);
    test('Admin Delete Subscriber (DELETE /api/admin/subscribers/:id)', delSubRes.status === 200 && delSubRes.body.ok);

    const listAfterDel = await req('GET', '/api/admin/subscribers', null, adminCookie);
    test('Subscriber Removed from Active List', !listAfterDel.body.some(s => s.id === foundSub.id));

    // 6. Check Bin for Subscriber
    const binRes = await req('GET', '/api/admin/bin', null, adminCookie);
    const subInBin = binRes.body.bin.find(b => b.type === 'subscriber' && b.originalId === foundSub.id);
    test('Deleted Subscriber Saved in Safety Bin', Boolean(subInBin), `Bin Item ID: ${subInBin?.id}`);

    // 7. Restore Subscriber
    if (subInBin) {
      const restoreRes = await req('POST', `/api/admin/bin/${subInBin.id}/restore`, null, adminCookie);
      test('Restore Subscriber from Safety Bin', restoreRes.status === 200 && restoreRes.body.ok);

      const listAfterRestore = await req('GET', '/api/admin/subscribers', null, adminCookie);
      test('Subscriber Restored in Active Subscribers Database', listAfterRestore.body.some(s => s.email === testSubEmail));
    }
  }

  console.log('\n===============================================================');
  console.log(`TOTAL CHECKS: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log('===============================================================\n');

  process.exit(failCount > 0 ? 1 : 0);
}

verify().catch(err => {
  console.error(err);
  process.exit(1);
});
