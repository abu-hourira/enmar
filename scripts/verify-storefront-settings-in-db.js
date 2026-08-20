// scripts/verify-storefront-settings-in-db.js
const http = require('http');
const pool = require('../config/db.js');

const PORT = 3000;
const SUPERADMIN_EMAIL = 'mdhourira6712@gmail.com';
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD || 'Abuhorira97@';

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
  console.log('   STOREFRONT SETTINGS DATABASE PERSISTENCE & INTEGRITY AUDIT');
  console.log('===============================================================\n');

  // 1. Check direct MySQL table row count
  const [rows] = await pool.query('SELECT setting_key FROM store_settings');
  test('MySQL store_settings Table Rows Count (>= 70 keys)', rows.length >= 70, `Total keys in DB: ${rows.length}`);

  // 2. Check no corrupted nested keys in DB
  const hasNestedSettings = rows.some(r => r.setting_key === 'allSettings' || r.setting_key === 'settings');
  test('No Corrupted Nested Keys ("allSettings" / "settings")', !hasNestedSettings);

  // 3. Test Public GET /api/settings
  const pubSettings = await req('GET', '/api/settings');
  test('Public API (GET /api/settings) Returns 200 OK', pubSettings.status === 200);

  const keys = Object.keys(pubSettings.body);
  test('Public API Returns Clean Flattened Settings (> 65 keys)', keys.length >= 65, `Keys count: ${keys.length}`);

  // 4. Verify Critical Key Groups are Present
  const hasBranding = pubSettings.body.brandName && pubSettings.body.adminBrandName;
  test('Branding Settings Present (brandName, adminBrandName)', Boolean(hasBranding), `Brand: ${pubSettings.body.brandName}`);

  const hasContact = pubSettings.body.contactPhone && pubSettings.body.contactEmail && pubSettings.body.contactAddress;
  test('Contact Settings Present (Phone, Email, Address)', Boolean(hasContact), `Phone: ${pubSettings.body.contactPhone}`);

  const hasDelivery = pubSettings.body.deliveryCountdownHours !== undefined && pubSettings.body.shippingFlat !== undefined;
  test('Delivery Rules Present (Countdown hours, Flat shipping)', Boolean(hasDelivery), `Countdown: ${pubSettings.body.deliveryCountdownHours}h, Flat: ৳${pubSettings.body.shippingFlat}`);

  const hasPolicies = pubSettings.body.pageAboutUs && pubSettings.body.pageTerms && pubSettings.body.pagePrivacyPolicy;
  test('Policy & Info Pages Present (AboutUs, Terms, Privacy)', Boolean(hasPolicies));

  const hasSupport = pubSettings.body.pageSupportCenter && pubSettings.body.pageHowToOrder && pubSettings.body.pageFaq;
  test('Support Guides Present (SupportCenter, HowToOrder, FAQ)', Boolean(hasSupport));

  const hasRegGuide = pubSettings.body.regGuideTitle && pubSettings.body.regGuideSteps;
  test('Registration Guide Present (regGuideTitle, regGuideSteps)', Boolean(hasRegGuide));

  // 5. Admin Login & Update Settings Test
  const loginRes = await req('POST', '/api/auth/login', { email: SUPERADMIN_EMAIL, password: SUPERADMIN_PASSWORD });
  const adminCookie = loginRes.cookie;
  test('Admin Login', loginRes.status === 200);

  const testTagline = `Farm fresh organic food verified at ${Date.now()}`;
  const patchRes = await req('PATCH', '/api/admin/settings', {
    tagline: testTagline,
    deliveryCountdownHours: 4
  }, adminCookie);
  test('Admin Updates Settings (PATCH /api/admin/settings)', patchRes.status === 200);

  // 6. Direct MySQL Verification of Updated Setting
  const [dbRow] = await pool.query('SELECT setting_val FROM store_settings WHERE setting_key = "tagline"');
  test('Updated Setting Directly Stored in MySQL Row', dbRow[0]?.setting_val === testTagline, `DB Val: ${dbRow[0]?.setting_val}`);

  // 7. Verify Public API immediately reflects the updated setting
  const verifyPub = await req('GET', '/api/settings');
  test('Public API Reflects Updated Setting Immediately', verifyPub.body.tagline === testTagline);

  console.log('\n===============================================================');
  console.log(`TOTAL CHECKS: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log('===============================================================\n');

  process.exit(failCount > 0 ? 1 : 0);
}

verify().catch(err => {
  console.error(err);
  process.exit(1);
});
