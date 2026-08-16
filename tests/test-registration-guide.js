const http = require('node:http');

const BASE_URL = 'http://localhost:3000';

function req(path, options = {}, cookie = '') {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (cookie) headers['Cookie'] = cookie;

    const opt = {
      method: options.method || 'GET',
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers
    };

    const r = http.request(opt, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let body = data;
        try { body = JSON.parse(data); } catch {}
        resolve({ status: res.statusCode, headers: res.headers, body });
      });
    });
    r.on('error', reject);
    if (options.body) {
      r.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    r.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('  REGISTRATION INSTRUCTIONS SETTINGS AUTOMATED TEST  ');
  console.log('====================================================\n');

  // 1. Check default settings
  const defaultRes = await req('/api/settings');
  if (defaultRes.status !== 200 || !defaultRes.body.regGuideTitle) {
    throw new Error('Default registration guide settings missing: ' + JSON.stringify(defaultRes.body));
  }
  console.log('✔ PASS [1] Default registration guide settings available on /api/settings');

  // 2. Admin login
  const adminLogin = await req('/api/auth/login', {
    method: 'POST',
    body: { email: 'superadmin@enmar.bd', password: 'SuperAdmin123!' }
  });
  const adminCookie = (adminLogin.headers['set-cookie'] || []).find(c => c.startsWith('hm_session='));
  if (!adminCookie) throw new Error('Admin login failed');
  console.log('✔ PASS [2] Superadmin authenticated');

  // 3. Update registration guide settings via admin API
  const customTitle = 'How to Register / New Customer Guide';
  const customSubtitle = 'Follow these simple steps to join ENMAR:';
  const customSteps = '1. Click Create Account.\n2. Enter Name, Email, and Phone number.\n3. Request and enter the 6-digit OTP code.\n4. Set a strong password.\n5. Click Create My Account!';

  const updateRes = await req('/api/admin/settings', {
    method: 'PATCH',
    body: {
      regGuideEnabled: 'true',
      regGuideTitle: customTitle,
      regGuideSubtitle: customSubtitle,
      regGuideSteps: customSteps
    }
  }, adminCookie);

  if (updateRes.status !== 200) {
    throw new Error('Failed to update registration guide settings: ' + JSON.stringify(updateRes.body));
  }
  console.log('✔ PASS [3] Admin successfully updated registration instructions');

  // 4. Verify public /api/settings reflects customized instructions
  const publicRes = await req('/api/settings');
  if (
    publicRes.body.regGuideTitle !== customTitle ||
    publicRes.body.regGuideSubtitle !== customSubtitle ||
    publicRes.body.regGuideSteps !== customSteps ||
    publicRes.body.regGuideEnabled !== 'true'
  ) {
    throw new Error('Public /api/settings mismatch: ' + JSON.stringify(publicRes.body));
  }
  console.log('✔ PASS [4] Public storefront /api/settings returns custom registration instructions');

  // 5. Test disabling registration guide from admin
  const disableRes = await req('/api/admin/settings', {
    method: 'PATCH',
    body: {
      regGuideEnabled: 'false'
    }
  }, adminCookie);
  if (disableRes.status !== 200 || disableRes.body.regGuideEnabled !== 'false') {
    throw new Error('Failed to disable registration guide: ' + JSON.stringify(disableRes.body));
  }

  const disabledPublic = await req('/api/settings');
  if (disabledPublic.body.regGuideEnabled !== 'false') {
    throw new Error('Registration guide not disabled in public settings');
  }
  console.log('✔ PASS [5] Admin can toggle registration instructions off');

  // 6. Re-enable registration guide
  await req('/api/admin/settings', {
    method: 'PATCH',
    body: {
      regGuideEnabled: 'true'
    }
  }, adminCookie);
  const reEnabled = await req('/api/settings');
  if (reEnabled.body.regGuideEnabled !== 'true') {
    throw new Error('Failed to re-enable registration guide');
  }
  console.log('✔ PASS [6] Admin can toggle registration instructions back on');

  console.log('\n====================================================');
  console.log('  ALL REGISTRATION INSTRUCTIONS TESTS PASSED!       ');
  console.log('====================================================');
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err.message);
  process.exit(1);
});
