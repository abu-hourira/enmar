// scripts/test-admin-all-pages-and-categories.js
const http = require('http');

const PORT = 3000;
const SUPERADMIN_EMAIL = 'mdhourira6712@gmail.com';
const SUPERADMIN_PASSWORD = 'Abuhorira97@';

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

function test(name, ok, info = '') {
  if (ok) {
    passCount++;
    console.log(`  \x1b[32m✔ [OK]\x1b[0m ${name} ${info ? '(' + info + ')' : ''}`);
  } else {
    failCount++;
    console.error(`  \x1b[31m✖ [FAIL]\x1b[0m ${name} ${info ? '(' + info + ')' : ''}`);
  }
}

async function run() {
  console.log('\n===============================================================');
  console.log('       ENMAR COMPLETE ADMIN PANEL & CATEGORIES AUDIT');
  console.log('===============================================================\n');

  // 1. Super Admin Authentication
  const loginRes = await req('POST', '/api/auth/login', { email: SUPERADMIN_EMAIL, password: SUPERADMIN_PASSWORD });
  test('Admin Login', loginRes.status === 200 && loginRes.body.user.role === 'superadmin');
  const adminCookie = loginRes.cookie;

  // 2. Category Lifecycle (Creation, Listing, Icon Update, Delete)
  console.log('\n📁 [1. CATEGORIES MANAGEMENT]');
  const catName = `Dairy & Farm Milk ${Date.now()}`;
  
  // 2.1 Create Category
  const createCatRes = await req('POST', '/api/admin/categories', {
    name: catName,
    icon: 'coffee',
    image: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='
  }, adminCookie);
  test('Create Category (POST /api/admin/categories)', createCatRes.status === 201 && createCatRes.body.ok, `Name: ${catName}`);

  // 2.2 List Admin Categories
  const adminCatsRes = await req('GET', '/api/admin/categories', null, adminCookie);
  test('Admin Category List (GET /api/admin/categories)', adminCatsRes.status === 200 && adminCatsRes.body.categories.some(c => c.name === catName));

  // 2.3 Public Storefront Categories List
  const pubCatsRes = await req('GET', '/api/categories');
  test('Public Category List (GET /api/categories)', pubCatsRes.status === 200 && pubCatsRes.body.includes(catName));

  // 2.4 Update Category Icon/Image
  const patchCatIconRes = await req('PATCH', `/api/admin/categories/${encodeURIComponent(catName)}/icon`, {
    icon: 'heart',
    image: 'data:image/svg+xml;base64,PHN2Zz51cGRhdGVkPC9zdmc+'
  }, adminCookie);
  test('Update Category Icon (PATCH /api/admin/categories/:name/icon)', patchCatIconRes.status === 200 && patchCatIconRes.body.icons[catName]?.icon === 'heart');

  // 2.5 Clear Category Icon
  const clearCatIconRes = await req('DELETE', `/api/admin/categories/${encodeURIComponent(catName)}/icon`, null, adminCookie);
  test('Reset Category Icon (DELETE /api/admin/categories/:name/icon)', clearCatIconRes.status === 200 && clearCatIconRes.body.icons[catName]?.icon === 'leaf');

  // 2.6 Delete Category
  const delCatRes = await req('DELETE', `/api/admin/categories/${encodeURIComponent(catName)}`, null, adminCookie);
  test('Delete Category (DELETE /api/admin/categories/:name)', delCatRes.status === 200 && !delCatRes.body.categories.some(c => c.name === catName));

  // 3. Staff & Roles Management
  console.log('\n👥 [2. STAFF MANAGEMENT]');
  const staffEmail = `auditor_staff_${Date.now()}@enmar.bd`;
  const createStaffRes = await req('POST', '/api/admin/staff', {
    name: 'Moderator Kabir',
    email: staffEmail,
    password: 'Moderator123!',
    role: 'moderator'
  }, adminCookie);
  test('Create Staff Account (POST /api/admin/staff)', createStaffRes.status === 201 && createStaffRes.body.user.role === 'moderator', `Created: ${staffEmail}`);

  // 4. Ad Maker & Campaign Slider
  console.log('\n📢 [3. AD MAKER & CAMPAIGNS]');
  const createAdRes = await req('POST', '/api/admin/ads', {
    name: 'Summer Organic Mango Blast',
    tag: 'LIMITED TIME',
    headline: 'Up to 25% Off Fresh Himsagar',
    body: 'Hand-picked from Rajshahi organic orchards.',
    buttonText: 'Shop Mangoes',
    buttonCat: 'Fruits',
    active: true
  }, adminCookie);
  test('Create Promotional Ad Banner (POST /api/admin/ads)', createAdRes.status === 201 && createAdRes.body.id);
  const adId = createAdRes.body.id;

  const getAdsRes = await req('GET', '/api/admin/ads', null, adminCookie);
  test('Fetch Admin Ads List (GET /api/admin/ads)', getAdsRes.status === 200 && getAdsRes.body.some(a => a.id === adId));

  const patchAdRes = await req('PATCH', `/api/admin/ads/${adId}`, { active: false }, adminCookie);
  test('Toggle Ad Active State (PATCH /api/admin/ads/:id)', patchAdRes.status === 200);

  const delAdRes = await req('DELETE', `/api/admin/ads/${adId}`, null, adminCookie);
  test('Delete Ad Banner (DELETE /api/admin/ads/:id)', delAdRes.status === 200);

  // 5. Recycle Bin Actions
  console.log('\n🗑️ [4. RECYCLE BIN & EMPTY]');
  const getBinRes = await req('GET', '/api/admin/bin', null, adminCookie);
  test('Fetch Safety Bin (GET /api/admin/bin)', getBinRes.status === 200 && getBinRes.body.counts);

  const emptyBinRes = await req('POST', '/api/admin/bin/empty', {}, adminCookie);
  test('Empty Safety Bin (POST /api/admin/bin/empty)', emptyBinRes.status === 200 && emptyBinRes.body.ok);

  // 6. Settings & Branding
  console.log('\n⚙️ [5. SETTINGS & BRANDING]');
  const patchSettingsRes = await req('PATCH', '/api/admin/settings', {
    brandName: 'ENMAR Agro Living',
    shippingFlat: 70
  }, adminCookie);
  test('Update Settings (PATCH /api/admin/settings)', patchSettingsRes.status === 200 && patchSettingsRes.body.shippingFlat === 70);

  // Summary
  console.log('\n===============================================================');
  console.log(`TOTAL CHECKS: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log('===============================================================\n');

  process.exit(failCount > 0 ? 1 : 0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
