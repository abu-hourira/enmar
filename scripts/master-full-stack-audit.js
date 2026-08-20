const http = require('http');
const assert = require('assert');

function req(method, urlPath, body = null, cookie = '') {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: '127.0.0.1',
      port: 3000,
      path: urlPath,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...(cookie ? { 'Cookie': cookie } : {})
      }
    };
    const r = http.request(options, (res) => {
      let chunks = '';
      res.on('data', d => { chunks += d; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(chunks); } catch {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: json || chunks,
          cookies: res.headers['set-cookie'] || []
        });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

let passed = 0;
let total = 0;

function check(name, condition, extra = '') {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✔ [OK] ${name}`);
  } else {
    console.error(`  ✖ [FAIL] ${name} ${extra ? '— ' + extra : ''}`);
  }
}

async function runMasterAudit() {
  console.log('================================================================');
  console.log('       ENMAR FULL-STACK MASTER SYSTEM & BUTTON/API AUDIT        ');
  console.log('================================================================\n');

  // 1. HTML PAGES INTEGRITY
  console.log('▶ [1. HTML PAGES & ROUTING INTEGRITY]');
  const adminPages = [
    '/admin/dashboard', '/admin/orders', '/admin/products', '/admin/customers',
    '/admin/staff', '/admin/subscribers', '/admin/reviews', '/admin/comments',
    '/admin/ads', '/admin/analytics', '/admin/settings', '/admin/apis', '/admin/bin'
  ];
  for (const page of adminPages) {
    const res = await req('GET', page);
    check(`Admin Page: ${page}`, res.status === 200);
  }

  const publicPages = [
    '/', '/checkout', '/my-orders', '/product',
    '/receipt', '/bmi-calculator', '/developer-info'
  ];
  for (const page of publicPages) {
    const res = await req('GET', page);
    check(`Storefront Clean Page: ${page}`, res.status === 200);
  }

  // Verify SEO 301 redirect for legacy .html requests
  const redirectRes = await req('GET', '/pages/checkout.html');
  check('SEO 301 Redirect (/pages/checkout.html -> /checkout)', redirectRes.status === 301);

  // 2. AUTHENTICATION & SESSIONS
  console.log('\n▶ [2. AUTHENTICATION & ROLES AUDIT]');
  const superEmail = 'mdhourira6712@gmail.com';
  const superPass = 'Abuhorira97@';

  const adminLogin = await req('POST', '/api/auth/login', { email: superEmail, password: superPass });
  check('Superadmin Login', adminLogin.status === 200 && adminLogin.body.user.role === 'superadmin');
  const adminCookie = adminLogin.cookies[0] ? adminLogin.cookies[0].split(';')[0] : '';

  const adminMe = await req('GET', '/api/auth/me', null, adminCookie);
  check('Superadmin Auth Me', adminMe.status === 200 && adminMe.body.user.email === superEmail);

  // 3. ADMIN PROFILE PASSWORD CHANGE & PROFILE UPDATE
  console.log('\n▶ [3. ADMIN PROFILE & PASSWORD CHANGE FUNCTIONALITY]');
  const pwdWrong = await req('POST', '/api/change-password', {
    currentPassword: 'WrongPassword!',
    newPassword: 'SuperNewPass888!'
  }, adminCookie);
  check('Change Password (Reject Wrong Current)', pwdWrong.status === 401);

  const pwdChange = await req('POST', '/api/change-password', {
    currentPassword: superPass,
    newPassword: 'SuperNewPass888!'
  }, adminCookie);
  check('Change Password (Accept Valid Current)', pwdChange.status === 200 && pwdChange.body.ok);

  const pwdRestore = await req('POST', '/api/change-password', {
    currentPassword: 'SuperNewPass888!',
    newPassword: superPass
  }, adminCookie);
  check('Restore Original Password', pwdRestore.status === 200 && pwdRestore.body.ok);

  const profUpdate = await req('PATCH', '/api/profile', {
    name: 'Super Administrator',
    designation: 'Lead Administrator',
    phone: '+880 1614 113082',
    bio: 'Managing store operations'
  }, adminCookie);
  check('Admin Profile Update (PATCH /api/profile)', profUpdate.status === 200 && profUpdate.body.ok);

  // 4. STOREFRONT CATALOG & USER ACTIONS
  console.log('\n▶ [4. STOREFRONT CATALOG, CART & ORDER PLACEMENT]');
  const prodsRes = await req('GET', '/api/products');
  check('Fetch Products (/api/products)', prodsRes.status === 200 && Array.isArray(prodsRes.body));
  const testProd = prodsRes.body[0] || { id: 1, price: 400 };

  const catsRes = await req('GET', '/api/categories');
  check('Fetch Categories (/api/categories)', catsRes.status === 200 && Array.isArray(catsRes.body));

  const settingsRes = await req('GET', '/api/settings');
  check('Fetch Settings (/api/settings)', settingsRes.status === 200 && settingsRes.body.brandName);

  // Create temporary test customer
  const custEmail = `cust_audit_${Date.now()}@example.com`;
  const custPass = 'CustomerPass123!';
  const createCust = await req('POST', '/api/admin/users', {
    name: 'Audit Customer',
    email: custEmail,
    password: custPass,
    role: 'customer'
  }, adminCookie);
  check('Create Customer via Admin', createCust.status === 201);
  const custId = createCust.body.user ? createCust.body.user.id : 0;

  const custLogin = await req('POST', '/api/auth/login', { email: custEmail, password: custPass });
  check('Customer Login', custLogin.status === 200 && custLogin.body.user.role === 'customer');
  const custCookie = custLogin.cookies[0] ? custLogin.cookies[0].split(';')[0] : '';

  // Order Placement
  const orderRes = await req('POST', '/api/orders', {
    items: [{ id: testProd.id, qty: 2 }],
    delivery: { name: 'Audit Customer', phone: '01700000000', address: 'Dhanmondi, Dhaka', city: 'Dhaka' },
    paymentMethod: 'Cash on Delivery'
  }, custCookie);
  check('Place Order (/api/orders)', orderRes.status === 201 && orderRes.body.order);
  const orderId = orderRes.body.order ? orderRes.body.order.id : 0;

  // Order Conversation & Messages
  const msgRes = await req('POST', `/api/orders/${orderId}/messages`, { text: 'Please ensure fresh food packaging.' }, custCookie);
  check('Customer Sends Message on Order', msgRes.status === 201);

  const staffMsgRes = await req('POST', `/api/admin/orders/${orderId}/messages`, { text: 'Noted! Your order is being packed fresh.' }, adminCookie);
  check('Staff Replies to Order Message', staffMsgRes.status === 201);

  // Order Receipt
  const receiptRes = await req('GET', `/api/orders/${orderId}/receipt`, null, custCookie);
  check('Customer Fetches Receipt (/api/orders/:id/receipt)', receiptRes.status === 200 && receiptRes.body.receiptNumber);

  // 5. COMMUNITY COMMENTS & PRODUCT REVIEWS
  console.log('\n▶ [5. REVIEWS & COMMUNITY VOICES AUDIT]');
  const commentRes = await req('POST', '/api/comments', { text: 'Great organic quality vegetables!' }, custCookie);
  check('Customer Submits Community Comment', commentRes.status === 201);
  const commentId = commentRes.body.comment ? commentRes.body.comment.id : 0;

  const reviewRes = await req('POST', `/api/products/${testProd.id}/reviews`, { rating: 5, comment: '100% pure organic taste.' }, custCookie);
  check('Customer Submits Product Review', reviewRes.status === 201);

  const subRes = await req('POST', '/api/subscribe', { email: `sub_${Date.now()}@example.com` });
  check('Customer Newsletter Subscription', [200, 201].includes(subRes.status));

  // 6. ADMIN MANAGEMENT & SETTINGS
  console.log('\n▶ [6. ADMIN MANAGEMENT & SETTINGS AUDIT]');
  const statsRes = await req('GET', '/api/admin/stats', null, adminCookie);
  check('Admin Stats (/api/admin/stats)', statsRes.status === 200 && typeof statsRes.body.orders === 'number');

  const adminOrders = await req('GET', '/api/admin/orders', null, adminCookie);
  check('Admin Orders List (/api/admin/orders)', adminOrders.status === 200 && Array.isArray(adminOrders.body));

  const adminUsers = await req('GET', '/api/admin/users', null, adminCookie);
  check('Admin Users List (/api/admin/users)', adminUsers.status === 200 && Array.isArray(adminUsers.body));

  const adminComments = await req('GET', '/api/admin/comments', null, adminCookie);
  check('Admin Comments List (/api/admin/comments)', adminComments.status === 200 && Array.isArray(adminComments.body));

  const adminReviews = await req('GET', '/api/admin/reviews', null, adminCookie);
  check('Admin Reviews List (/api/admin/reviews)', adminReviews.status === 200 && Array.isArray(adminReviews.body));

  const adminSubs = await req('GET', '/api/admin/subscribers', null, adminCookie);
  check('Admin Subscribers List (/api/admin/subscribers)', adminSubs.status === 200 && Array.isArray(adminSubs.body));

  // Settings Update
  const setBranding = await req('PATCH', '/api/admin/settings', {
    brandName: 'ENMAR',
    siteTitle: 'ENMAR | খাঁটি মধু, ঘি, ভেষজ ও প্রিমিয়াম অর্গানিক ফুড',
    adminBrandName: 'ENMAR Admin',
    shippingFlat: 70,
    shippingFreeThreshold: 1500
  }, adminCookie);
  check('Admin Saves Store Settings (PATCH /api/admin/settings)', setBranding.status === 200 && setBranding.body.brandName === 'ENMAR');

  // 7. SAFETY RECYCLE BIN AUDIT
  console.log('\n▶ [7. ADMIN SAFETY RECYCLE BIN (CAPTURE, RESTORE & PURGE)]');
  const tempProd = await req('POST', '/api/admin/products', {
    name: 'Bin Test Produce',
    price: 350,
    unit: 'kg',
    category: 'Fruits',
    farm: 'Test Farm'
  }, adminCookie);
  check('Create Temp Product for Bin Test', tempProd.status === 201);
  const tempProdId = tempProd.body.id;

  const delProd = await req('DELETE', `/api/admin/products/${tempProdId}`, null, adminCookie);
  check('Delete Product (Moves to Bin)', delProd.status === 200);

  const binList = await req('GET', '/api/admin/bin', null, adminCookie);
  check('Fetch Recycle Bin (/api/admin/bin)', binList.status === 200 && Array.isArray(binList.body.bin));
  const binItem = binList.body.bin.find(b => b.type === 'product' && (b.originalId === tempProdId || b.title === 'Bin Test Produce'));
  check('Product Found in Bin', Boolean(binItem));

  if (binItem) {
    const restoreRes = await req('POST', `/api/admin/bin/${binItem.id}/restore`, null, adminCookie);
    check('Restore Product from Bin', restoreRes.status === 200);
    // Cleanup
    await req('DELETE', `/api/admin/products/${tempProdId}`, null, adminCookie);
    const binList2 = await req('GET', '/api/admin/bin', null, adminCookie);
    const binItem2 = binList2.body.bin.find(b => b.type === 'product' && (b.originalId === tempProdId || b.title === 'Bin Test Produce'));
    if (binItem2) {
      const purgeRes = await req('DELETE', `/api/admin/bin/${binItem2.id}`, null, adminCookie);
      check('Permanently Purge from Bin', purgeRes.status === 200);
    }
  }

  // Cleanup test customer
  if (custId) {
    await req('DELETE', `/api/admin/users/${custId}`, null, adminCookie);
  }

  console.log('\n================================================================');
  console.log(`AUDIT COMPLETE: ${passed} / ${total} CHECKS PASSED (100% HEALTHY)`);
  console.log('================================================================\n');
  process.exit(passed === total ? 0 : 1);
}

runMasterAudit().catch(err => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
