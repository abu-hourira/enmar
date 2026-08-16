// scripts/verify-category-and-bin-persistence.js
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
    console.log(`  \x1b[32m✔ [OK]\x1b[0m ${name} ${details ? '(' + details + ')' : ''}`);
  } else {
    failCount++;
    console.error(`  \x1b[31m✖ [FAIL]\x1b[0m ${name} ${details ? '(' + details + ')' : ''}`);
  }
}

async function verify() {
  console.log('\n===============================================================');
  console.log('  VERIFYING CATEGORY DELETION & RECYCLE BIN PERSISTENCE');
  console.log('===============================================================\n');

  // 1. Login
  const loginRes = await req('POST', '/api/auth/login', { email: SUPERADMIN_EMAIL, password: SUPERADMIN_PASSWORD });
  const adminCookie = loginRes.cookie;
  test('Superadmin Login', loginRes.status === 200);

  // 2. Create Category
  const testCatName = `Winter Vegetables ${Date.now()}`;
  const createCat = await req('POST', '/api/admin/categories', { name: testCatName, icon: 'sun' }, adminCookie);
  test('Create Category', createCat.status === 201 && createCat.body.ok, `Name: ${testCatName}`);

  // 3. Verify it is visible
  const listBefore = await req('GET', '/api/categories');
  test('Category Visible in Storefront', listBefore.body.includes(testCatName));

  // 4. Delete Category
  const delCat = await req('DELETE', `/api/admin/categories/${encodeURIComponent(testCatName)}`, null, adminCookie);
  test('Delete Category (DELETE /api/admin/categories/:name)', delCat.status === 200);

  // 5. Verify it is GONE from categories list (No resurrection!)
  const listAfter = await req('GET', '/api/categories');
  test('Category Gone from Storefront (No Ghost Resurrection)', !listAfter.body.includes(testCatName));

  const adminListAfter = await req('GET', '/api/admin/categories', null, adminCookie);
  test('Category Gone from Admin Panel List', !adminListAfter.body.categories.some(c => c.name === testCatName));

  // 6. Check Recycle Bin contains the deleted Category
  const binRes = await req('GET', '/api/admin/bin', null, adminCookie);
  test('Recycle Bin has items', binRes.status === 200 && Array.isArray(binRes.body.bin));
  const foundInBin = binRes.body.bin.find(b => b.type === 'category' && b.title === testCatName);
  test('Deleted Category Appears in Recycle Bin with Full Details', Boolean(foundInBin), `Bin Item ID: ${foundInBin?.id}`);

  // 7. Test Product Deletion to Bin
  const createProd = await req('POST', '/api/admin/products', {
    name: 'Temporary Bin Test Product',
    price: 199,
    category: 'General'
  }, adminCookie);
  const prodId = createProd.body.id;
  test('Create Test Product', Boolean(prodId));

  const delProd = await req('DELETE', `/api/admin/products/${prodId}`, null, adminCookie);
  test('Delete Product', delProd.status === 200);

  const binRes2 = await req('GET', '/api/admin/bin', null, adminCookie);
  const foundProdInBin = binRes2.body.bin.find(b => b.type === 'product' && b.originalId === prodId);
  test('Deleted Product Appears in Recycle Bin', Boolean(foundProdInBin), `Bin Item ID: ${foundProdInBin?.id}`);

  // 8. Test Restore Product from Bin
  if (foundProdInBin) {
    const restoreRes = await req('POST', `/api/admin/bin/${foundProdInBin.id}/restore`, null, adminCookie);
    test('Restore Product from Bin (POST /api/admin/bin/:id/restore)', restoreRes.status === 200 && restoreRes.body.ok);

    const prodsAfterRestore = await req('GET', '/api/products');
    test('Restored Product Back in Storefront', prodsAfterRestore.body.some(p => p.id === prodId));

    // Cleanup: delete again and purge
    await req('DELETE', `/api/admin/products/${prodId}`, null, adminCookie);
    const binRes3 = await req('GET', '/api/admin/bin', null, adminCookie);
    const itemToPurge = binRes3.body.bin.find(b => b.type === 'product' && b.originalId === prodId);
    if (itemToPurge) {
      const purgeRes = await req('DELETE', `/api/admin/bin/${itemToPurge.id}`, null, adminCookie);
      test('Permanent Purge from Bin', purgeRes.status === 200);
    }
  }

  // 9. Test Restore Category from Bin
  if (foundInBin) {
    const restoreCatRes = await req('POST', `/api/admin/bin/${foundInBin.id}/restore`, null, adminCookie);
    test('Restore Category from Bin', restoreCatRes.status === 200 && restoreCatRes.body.ok);

    const listRestored = await req('GET', '/api/categories');
    test('Restored Category Back in Storefront', listRestored.body.includes(testCatName));

    // Cleanup: delete category
    await req('DELETE', `/api/admin/categories/${encodeURIComponent(testCatName)}`, null, adminCookie);
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
