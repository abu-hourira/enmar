// scratch/test-recycle-bin.js - Full Recycle Bin lifecycle test
const http = require('http');
const BASE = 'http://localhost:3000';

function req(method, path, body, cookie) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const opts = {
      method, hostname: url.hostname, port: url.port, path: url.pathname,
      headers: { 'Content-Type': 'application/json' }
    };
    if (cookie) opts.headers.Cookie = cookie;
    const r = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        let body;
        try { body = JSON.parse(d); } catch { body = d; }
        resolve({ status: res.statusCode, body, headers: res.headers });
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

let pass = 0, fail = 0;
function test(label, cond) {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ FAIL: ${label}`); }
}


(async () => {
  console.log('══════════════════════════════════════');
  console.log('  RECYCLE BIN FULL LIFECYCLE TEST');
  console.log('══════════════════════════════════════\n');

  // 1. Login
  console.log('▶ [1] Admin Login');
  let loginRes = await req('POST', '/api/auth/login', { email: 'superadmin@enmar.bd', password: 'SuperAdmin123!' });
  if (loginRes.status !== 200) loginRes = await req('POST', '/api/auth/login', { email: 'admin@example.com', password: 'Abuhourira97@' });
  const setCookie = loginRes.headers['set-cookie'];
  const ck = setCookie ? setCookie[0].split(';')[0] : '';
  test('Admin login successful', loginRes.status === 200 && !!ck);

  // 2. Initial bin state
  console.log('\n▶ [2] Initial Bin State');
  const b1 = await req('GET', '/api/admin/bin', null, ck);
  test('GET /api/admin/bin = 200', b1.status === 200);
  test('Has bin array + counts', Array.isArray(b1.body.bin) && typeof b1.body.counts === 'object');

  // 3. Product → Delete → Bin Capture
  console.log('\n▶ [3] Product Delete → Bin Capture');
  const pr = await req('POST', '/api/admin/products', { name: 'BinTestApple', price: 120, unit: 'kg', category: 'Fruits', farm: 'TestFarm' }, ck);
  test('Created test product', pr.status === 201 && pr.body.ok);
  const pid = pr.body.id;

  const dp = await req('DELETE', `/api/admin/products/${pid}`, null, ck);
  test('Delete returns binEntry', dp.status === 200 && !!dp.body.binEntry);
  test('binEntry.type=product', dp.body.binEntry.type === 'product');
  test('binEntry.originalId matches', dp.body.binEntry.originalId === pid);

  // 4. Verify in bin
  console.log('\n▶ [4] Verify in Bin');
  const b2 = await req('GET', '/api/admin/bin', null, ck);
  const fp = (b2.body.bin || []).find(b => b.type === 'product' && b.originalId === pid);
  test('Product found in bin', !!fp);
  test('Has data snapshot', fp && fp.data && fp.data.name === 'BinTestApple');
  test('Has expiresAt', fp && !!fp.expiresAt);
  test('counts.product >= 1', b2.body.counts.product >= 1);

  // 5. Restore
  console.log('\n▶ [5] Restore Product');
  if (fp) {
    const rr = await req('POST', `/api/admin/bin/${fp.id}/restore`, {}, ck);
    test('Restore returns 200 ok', rr.status === 200 && rr.body.ok);
    const b3 = await req('GET', '/api/admin/bin', null, ck);
    test('Removed from bin', !(b3.body.bin || []).find(b => b.id === fp.id));
    const plist = await req('GET', '/api/admin/products', null, ck);
    test('Product restored to list', (plist.body || []).some(p => p.name === 'BinTestApple'));
  }

  // 6. Delete again → Purge
  console.log('\n▶ [6] Delete Again → Purge');
  const pl2 = await req('GET', '/api/admin/products', null, ck);
  const apple2 = (pl2.body || []).find(p => p.name === 'BinTestApple');
  if (apple2) {
    await req('DELETE', `/api/admin/products/${apple2.id}`, null, ck);
    const b4 = await req('GET', '/api/admin/bin', null, ck);
    const bi2 = (b4.body.bin || []).find(b => b.type === 'product' && b.originalId === apple2.id);
    test('Back in bin after 2nd delete', !!bi2);
    if (bi2) {
      const pg = await req('DELETE', `/api/admin/bin/${bi2.id}`, null, ck);
      test('Purge returns 200', pg.status === 200 && pg.body.ok);
      const b5 = await req('GET', '/api/admin/bin', null, ck);
      test('Permanently gone', !(b5.body.bin || []).find(b => b.id === bi2.id));
    }
  }

  // 7. Empty Bin
  console.log('\n▶ [7] Empty Bin');
  const t1 = await req('POST', '/api/admin/products', { name: 'ET1', price: 10, unit: 'kg', category: 'T' }, ck);
  const t2 = await req('POST', '/api/admin/products', { name: 'ET2', price: 20, unit: 'kg', category: 'T' }, ck);
  await req('DELETE', `/api/admin/products/${t1.body.id}`, null, ck);
  await req('DELETE', `/api/admin/products/${t2.body.id}`, null, ck);
  const er = await req('POST', '/api/admin/bin/empty', { type: 'all' }, ck);
  test('Empty bin returns 200', er.status === 200 && er.body.ok);
  const b6 = await req('GET', '/api/admin/bin', null, ck);
  test('Bin empty after operation', b6.body.counts.all === 0);

  // Summary
  console.log('\n══════════════════════════════════════');
  console.log(`  RESULTS: ${pass} passed, ${fail} failed`);
  console.log('══════════════════════════════════════');
  process.exit(fail > 0 ? 1 : 0);
})().catch(err => { console.error('Error:', err); process.exit(1); });
