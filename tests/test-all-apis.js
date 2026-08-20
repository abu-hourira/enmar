/**
 * test-all-apis.js
 * Comprehensive API Health & Audit Suite
 * Validates every single endpoint in the application.
 */

const http = require('http');

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

let passed = 0;
let failed = 0;
const results = [];

function req(method, path, body = null, cookie = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const payload = body ? JSON.stringify(body) : null;
    const headers = {
      'Accept': 'application/json'
    };
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    if (cookie) headers['Cookie'] = cookie;

    const request = http.request(url, { method, headers }, (res) => {
      let data = '';
      const setCookies = res.headers['set-cookie'] || [];
      const sessionCookie = setCookies.find(c => c.startsWith('hm_session='));
      const returnedCookie = sessionCookie ? sessionCookie.split(';')[0] : cookie;

      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch { json = data; }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: json,
          cookie: returnedCookie
        });
      });
    });

    request.on('error', reject);
    if (payload) request.write(payload);
    request.end();
  });
}

function test(name, ok, details = '') {
  if (ok) {
    passed++;
    console.log(`  ✔ [OK] ${name}`);
    results.push({ name, status: 'PASS', details });
  } else {
    failed++;
    console.error(`  ✖ [FAIL] ${name} ${details ? '(' + details + ')' : ''}`);
    results.push({ name, status: 'FAIL', details });
  }
}

async function runAll() {
  console.log('\n===============================================================');
  console.log('       ENMAR FULL API HEALTH & DIAGNOSTIC AUDIT');
  console.log('===============================================================\n');

  // 1. PUBLIC STOREFRONT ENDPOINTS
  console.log('▶ [CATEGORY 1] Public Catalog, Settings & Content APIs');
  const rProducts = await req('GET', '/api/products');
  test('GET /api/products', rProducts.status === 200 && Array.isArray(rProducts.body));

  const superEmail = process.env.SUPERADMIN_EMAIL || 'mdhourira6712@gmail.com';
  const superPass = process.env.SUPERADMIN_PASSWORD || 'Abuhorira97@';

  const rAdminLogin = await req('POST', '/api/auth/login', { email: superEmail, password: superPass });
  test('POST /api/auth/login (Admin)', rAdminLogin.status === 200 && rAdminLogin.body.user.role === 'superadmin');
  const adminCookie = rAdminLogin.cookie;

  let firstProdId = rProducts.body[0]?.id;
  if (!firstProdId) {
    const newProd = await req('POST', '/api/admin/products', {
      name: 'Fresh Organic Mango',
      farm: 'Rajshahi Orchard',
      price: 480,
      unit: 'kg',
      category: 'Fruits',
      discount: 13
    }, adminCookie);
    firstProdId = newProd.body.id || 1;
  }

  const rProdDetail = await req('GET', `/api/products/${firstProdId}`);
  test('GET /api/products/:id', rProdDetail.status === 200 && rProdDetail.body.id === firstProdId);

  const rCategories = await req('GET', '/api/categories');
  test('GET /api/categories', rCategories.status === 200 && Array.isArray(rCategories.body));

  const rCatIcons = await req('GET', '/api/category-icons');
  test('GET /api/category-icons', rCatIcons.status === 200 && typeof rCatIcons.body === 'object');

  const rSettings = await req('GET', '/api/settings');
  test('GET /api/settings', rSettings.status === 200 && rSettings.body.brandName);

  const rAdMedia = await req('GET', '/api/ad-media');
  test('GET /api/ad-media', rAdMedia.status === 200 && Array.isArray(rAdMedia.body));

  const rComments = await req('GET', '/api/comments');
  test('GET /api/comments', rComments.status === 200 && Array.isArray(rComments.body));

  const rNotifs = await req('GET', '/api/notifications');
  test('GET /api/notifications', rNotifs.status === 200 && Array.isArray(rNotifs.body));

  const rReviews = await req('GET', `/api/products/${firstProdId}/reviews`);
  test('GET /api/products/:id/reviews', rReviews.status === 200 && Array.isArray(rReviews.body));

  // 2. AUTHENTICATION & SECURITY
  console.log('\n▶ [CATEGORY 2] Authentication, Roles & Security Guardrails');
  const rCheckUser = await req('POST', '/api/auth/check-user', { email: superEmail, phone: '01800000000' });
  test('POST /api/auth/check-user', rCheckUser.status === 200 && rCheckUser.body.emailTaken === true);

  const rAuthMe = await req('GET', '/api/auth/me', null, adminCookie);
  test('GET /api/auth/me', rAuthMe.status === 200 && rAuthMe.body.user && rAuthMe.body.user.email === superEmail);

  // Create & authenticate a test customer
  const testCustomerEmail = `api_check_${Date.now()}@example.com`;
  const rCreateCust = await req('POST', '/api/admin/users', {
    name: 'API Health Customer',
    email: testCustomerEmail,
    password: 'CustomerPass123!',
    role: 'customer',
    phone: '01811223344',
    city: 'Dhaka',
    address: 'Gulshan 2'
  }, adminCookie);
  test('POST /api/admin/users (Create Customer)', rCreateCust.status === 201 && rCreateCust.body.user.id);
  const testCustomerId = rCreateCust.body.user.id;

  const rCustLogin = await req('POST', '/api/auth/login', { email: testCustomerEmail, password: 'CustomerPass123!' });
  test('POST /api/auth/login (Customer)', rCustLogin.status === 200 && rCustLogin.body.user.role === 'customer');
  const customerCookie = rCustLogin.cookie;

  const rIdorBlock = await req('GET', '/api/admin/stats', null, customerCookie);
  test('IDOR Guard: Customer blocked from /api/admin/*', rIdorBlock.status === 403);

  // 3. CUSTOMER ORDERS & MONEY RECEIPT FLOW
  console.log('\n▶ [CATEGORY 3] Orders, Invoicing & Change History');
  const rOrderCreate = await req('POST', '/api/orders', {
    delivery: { name: 'API Health Customer', phone: '01811223344', address: 'Gulshan 2', city: 'Dhaka' },
    paymentMethod: 'Cash on Delivery',
    items: [{ id: firstProdId, qty: 2 }]
  }, customerCookie);
  test('POST /api/orders (Create Order)', rOrderCreate.status === 201 && rOrderCreate.body.order.number);
  const testOrder = rOrderCreate.body.order;

  const rCustOrders = await req('GET', '/api/orders', null, customerCookie);
  test('GET /api/orders (Customer list)', rCustOrders.status === 200 && rCustOrders.body.some(o => o.id === testOrder.id));

  const rSingleOrder = await req('GET', `/api/orders/${testOrder.id}`, null, customerCookie);
  test('GET /api/orders/:id', rSingleOrder.status === 200 && rSingleOrder.body.id === testOrder.id);

  const rReceipt = await req('GET', `/api/orders/${testOrder.id}/receipt`, null, customerCookie);
  test('GET /api/orders/:id/receipt (Official Money Receipt)', rReceipt.status === 200 && rReceipt.body.receiptNumber && rReceipt.body.store.brandName);

  const rEditDelivery = await req('PATCH', `/api/orders/${testOrder.id}`, { address: 'Road 11, House 25, Banani' }, customerCookie);
  test('PATCH /api/orders/:id (Edit Delivery Info)', rEditDelivery.status === 200 && rEditDelivery.body.customer.address.includes('Banani'));

  const rOrderMsg = await req('POST', `/api/orders/${testOrder.id}/messages`, { text: 'Please call before delivery' }, customerCookie);
  test('POST /api/orders/:id/messages (Customer Chat)', rOrderMsg.status === 201 && rOrderMsg.body.ok);

  // Lifecycle check: pending orders cannot have history deleted
  const rBlockDeletePending = await req('DELETE', `/api/orders/${testOrder.id}/history`, null, customerCookie);
  test('DELETE /api/orders/:id/history (Blocked for Pending)', rBlockDeletePending.status === 400);

  // Customer cancels order
  const rCancelOrder = await req('POST', `/api/orders/${testOrder.id}/cancel`, { reason: 'Delivery schedule conflict' }, customerCookie);
  test('POST /api/orders/:id/cancel (Customer Cancellation)', rCancelOrder.status === 200 && rCancelOrder.body.order.status === 'Cancelled');

  // Customer can now delete cancelled order from personal view
  const rDeleteHistory = await req('DELETE', `/api/orders/${testOrder.id}/history`, null, customerCookie);
  test('DELETE /api/orders/:id/history (Allowed for Cancelled)', rDeleteHistory.status === 200 && rDeleteHistory.body.ok);

  // 4. COMMUNITY COMMENTS & REVIEWS
  console.log('\n▶ [CATEGORY 4] Community Voices, Comments & Product Reviews');
  const rPostComment = await req('POST', '/api/comments', { text: 'Excellent fresh produce delivered on time!' }, customerCookie);
  test('POST /api/comments', rPostComment.status === 201 && rPostComment.body.comment.id);
  const commentId = rPostComment.body.comment.id;

  const rPatchComment = await req('PATCH', `/api/comments/${commentId}`, { text: 'Updated: Outstanding food quality!' }, customerCookie);
  test('PATCH /api/comments/:id', rPatchComment.status === 200 && rPatchComment.body.comment.text.includes('Updated'));

  const rPostReview = await req('POST', `/api/products/${firstProdId}/reviews`, { rating: 5, comment: 'Crisp and sweet fresh food.' }, customerCookie);
  test('POST /api/products/:id/reviews', rPostReview.status === 201 && rPostReview.body.rating === 5);
  const reviewId = rPostReview.body.id;

  const rMyReviews = await req('GET', '/api/my-reviews', null, customerCookie);
  test('GET /api/my-reviews', rMyReviews.status === 200 && rMyReviews.body.some(r => r.id === reviewId));

  const rNewsletter = await req('POST', '/api/subscribe', { email: `sub_${Date.now()}@example.com` });
  test('POST /api/subscribe', rNewsletter.status === 201 && rNewsletter.body.ok);

  // 5. ADMIN CONTROL PANEL APIS
  console.log('\n▶ [CATEGORY 5] Admin Management & Statistics');
  const rAdminStats = await req('GET', '/api/admin/stats', null, adminCookie);
  test('GET /api/admin/stats', rAdminStats.status === 200 && rAdminStats.body.orders !== undefined);

  const rAdminOrders = await req('GET', '/api/admin/orders', null, adminCookie);
  test('GET /api/admin/orders', rAdminOrders.status === 200 && Array.isArray(rAdminOrders.body));

  const rAdminOrderMsg = await req('POST', `/api/admin/orders/${testOrder.id}/messages`, { text: 'Our support team has noted your update.' }, adminCookie);
  test('POST /api/admin/orders/:id/messages (Staff Reply)', rAdminOrderMsg.status === 201 && rAdminOrderMsg.body.ok);

  const rAdminUsers = await req('GET', '/api/admin/users', null, adminCookie);
  test('GET /api/admin/users', rAdminUsers.status === 200 && Array.isArray(rAdminUsers.body));

  const rAdminSubs = await req('GET', '/api/admin/subscribers', null, adminCookie);
  test('GET /api/admin/subscribers', rAdminSubs.status === 200 && Array.isArray(rAdminSubs.body));

  const rAdminComments = await req('GET', '/api/admin/comments', null, adminCookie);
  test('GET /api/admin/comments', rAdminComments.status === 200 && Array.isArray(rAdminComments.body));

  const rAdminReviews = await req('GET', '/api/admin/reviews', null, adminCookie);
  test('GET /api/admin/reviews', rAdminReviews.status === 200 && Array.isArray(rAdminReviews.body));

  const rAdminApis = await req('GET', '/api/admin/apis', null, adminCookie);
  test('GET /api/admin/apis', rAdminApis.status === 200 && rAdminApis.body.sms !== undefined);

  // 6. ADMIN BRANDING (STOREFRONT & ADMIN PANEL)
  console.log('\n▶ [CATEGORY 6] Storefront & Admin Panel Custom Branding');
  const rAdminBranding = await req('PATCH', '/api/admin/settings', {
    brandName: 'ENMAR Organics',
    adminBrandName: 'ENMAR HQ Admin',
    adminLogo: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='
  }, adminCookie);
  test('PATCH /api/admin/settings (Storefront & Admin Logo/Name)', rAdminBranding.status === 200 && rAdminBranding.body.adminBrandName === 'ENMAR HQ Admin');

  // Reset back to default
  await req('PATCH', '/api/admin/settings', { brandName: 'ENMAR', adminBrandName: 'ENMAR Admin', adminLogo: '' }, adminCookie);

  // 7. ADMIN SAFETY RECYCLE BIN
  console.log('\n▶ [CATEGORY 7] Admin Safety Recycle Bin (Capture, Restore & Purge)');
  // Create dummy item to test full bin lifecycle
  const rDummyProd = await req('POST', '/api/admin/products', {
    name: 'Bin Diagnostic Apple',
    farm: 'Northern Orchard',
    price: 300,
    unit: 'kg',
    cat: 'Fruits',
    tag: 'Diagnostic'
  }, adminCookie);
  const dummyProdId = rDummyProd.body.id;

  const rDelDummy = await req('DELETE', `/api/admin/products/${dummyProdId}`, null, adminCookie);
  test('DELETE /api/admin/products/:id (Captures to Bin)', rDelDummy.status === 200 && rDelDummy.body.binEntry);

  const rGetBin = await req('GET', '/api/admin/bin', null, adminCookie);
  test('GET /api/admin/bin (List & Counters)', rGetBin.status === 200 && Array.isArray(rGetBin.body.bin) && rGetBin.body.counts.all > 0);

  const binItem = rGetBin.body.bin.find(b => b.type === 'product' && b.originalId === dummyProdId);
  test('Bin indexing verified', Boolean(binItem));

  if (binItem) {
    const rRestore = await req('POST', `/api/admin/bin/${binItem.id}/restore`, {}, adminCookie);
    test('POST /api/admin/bin/:id/restore', rRestore.status === 200 && rRestore.body.ok);

    // Delete and purge
    await req('DELETE', `/api/admin/products/${dummyProdId}`, null, adminCookie);
    const rBinAgain = await req('GET', '/api/admin/bin', null, adminCookie);
    const binItem2 = rBinAgain.body.bin.find(b => b.type === 'product' && b.originalId === dummyProdId);
    if (binItem2) {
      const rPurge = await req('DELETE', `/api/admin/bin/${binItem2.id}`, null, adminCookie);
      test('DELETE /api/admin/bin/:id (Permanent Purge)', rPurge.status === 200 && rPurge.body.ok);
    }
  }

  // CLEANUP TEST ENTITIES
  if (testOrder && testOrder.id) await req('DELETE', `/api/admin/orders/${testOrder.id}`, null, adminCookie);
  if (commentId) await req('DELETE', `/api/admin/comments/${commentId}`, null, adminCookie);
  if (reviewId) await req('DELETE', `/api/admin/reviews/${reviewId}`, null, adminCookie);
  if (testCustomerId) await req('DELETE', `/api/admin/users/${testCustomerId}`, null, adminCookie);

  console.log('\n===============================================================');
  console.log(`TOTAL APIS AUDITED: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('===============================================================\n');

  if (failed > 0) process.exit(1);
}

runAll().catch(err => {
  console.error('Fatal API audit error:', err);
  process.exit(1);
});
