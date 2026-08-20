// scratch/test-production-suite.js
const http = require('http');
const PORT = 3000;
process.env.PORT = String(PORT);
// Running against live daemon on port 3000
let passed = 0;
let failed = 0;

function req(method, urlPath, body = null, cookie = '') {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: '127.0.0.1',
      port: PORT,
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
          rawCookie: res.headers['set-cookie']
        });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function assert(condition, message) {
  if (condition) {
    console.log(`  \x1b[32m✔ PASS\x1b[0m ${message}`);
    passed++;
  } else {
    console.error(`  \x1b[31m✖ FAIL\x1b[0m ${message}`);
    failed++;
  }
}

async function runSuite() {
  console.log('\n======================================================');
  console.log('       ENMAR FULL-STACK PRODUCTION TEST SUITE');
  console.log('======================================================\n');

  // TEST 1: Public Storefront and Security Headers
  console.log('▶ [TEST GROUP 1] Public Storefront & Security Headers');
  const home = await req('GET', '/');
  assert(home.status === 200, 'GET / returns 200 OK');
  assert(home.headers['x-content-type-options'] === 'nosniff', 'X-Content-Type-Options: nosniff header present');
  assert(home.headers['x-frame-options'] === 'SAMEORIGIN', 'X-Frame-Options: SAMEORIGIN header present');
  assert(Boolean(home.headers['referrer-policy']), 'Referrer-Policy header present');
  assert(Boolean(home.headers['permissions-policy']), 'Permissions-Policy header present');

  // TEST 2: Public API Endpoints
  console.log('\n▶ [TEST GROUP 2] Public Catalog & Settings APIs');
  const productsRes = await req('GET', '/api/products');
  assert(productsRes.status === 200 && Array.isArray(productsRes.body), 'GET /api/products returns product array');
  const settingsRes = await req('GET', '/api/settings');
  assert(settingsRes.status === 200 && settingsRes.body.brandName, 'GET /api/settings returns storefront settings');
  const adsRes = await req('GET', '/api/ad-media');
  assert(adsRes.status === 200 && Array.isArray(adsRes.body), 'GET /api/ad-media returns ads banner array');
  const commentsRes = await req('GET', '/api/comments');
  assert(commentsRes.status === 200 && Array.isArray(commentsRes.body), 'GET /api/comments returns community comments');

  // TEST 3: Authentication & Security
  console.log('\n▶ [TEST GROUP 3] Authentication & Authorization Security');
  const superEmail = process.env.SUPERADMIN_EMAIL || 'mdhourira6712@gmail.com';
  const superPass = process.env.SUPERADMIN_PASSWORD || 'Abuhorira97@';

  const invalidLogin = await req('POST', '/api/auth/login', { email: superEmail, password: 'WrongPassword999!' });
  assert(invalidLogin.status === 401, 'Invalid password returns 401 Unauthorized');

  const adminLogin = await req('POST', '/api/auth/login', { email: superEmail, password: superPass });
  assert(adminLogin.status === 200 && adminLogin.body.user.role === 'superadmin', 'Superadmin login returns 200 with role superadmin');
  const adminCookie = (adminLogin.rawCookie && adminLogin.rawCookie[0]) ? adminLogin.rawCookie[0].split(';')[0] : '';
  assert(adminCookie.startsWith('hm_session='), 'Admin session cookie hm_session issued');

  // Unauthenticated and Role Authorization checks
  const unauthStats = await req('GET', '/api/admin/stats');
  assert(unauthStats.status === 401, 'Unauthenticated GET /api/admin/stats rejected with 401');

  const authStats = await req('GET', '/api/admin/stats', null, adminCookie);
  assert(authStats.status === 200 && typeof authStats.body.orders === 'number', 'Authorized Superadmin GET /api/admin/stats returns 200 with metrics');

  // TEST 4: Customer Account & IDOR Protection
  console.log('\n▶ [TEST GROUP 4] Customer Account Creation, Login & IDOR Protection');
  const testCustomerEmail = `customer_${Date.now()}@example.com`;
  const createCustomerRes = await req('POST', '/api/admin/users', {
    name: 'Audit Customer',
    email: testCustomerEmail,
    password: 'Password123!',
    role: 'customer'
  }, adminCookie);
  assert(createCustomerRes.status === 201 && createCustomerRes.body.user.id, 'Customer account created via admin management with 201 Created');

  // Customer Login
  const customerLogin = await req('POST', '/api/auth/login', {
    email: testCustomerEmail,
    password: 'Password123!'
  });
  assert(customerLogin.status === 200 && customerLogin.body.user.role === 'customer', 'Customer login returns 200 with role customer');
  const customerCookie = (customerLogin.rawCookie && customerLogin.rawCookie[0]) ? customerLogin.rawCookie[0].split(';')[0] : '';

  // Customer tries to access admin stats
  const customerForbiddenStats = await req('GET', '/api/admin/stats', null, customerCookie);
  assert(customerForbiddenStats.status === 403, 'Customer accessing /api/admin/stats is blocked with 403 Forbidden');

  // TEST 5: E-Commerce Pricing & Discount Accuracy
  console.log('\n▶ [TEST GROUP 5] Server-Side E-Commerce Pricing & Validation');
  let products = productsRes.body;
  if (!products || products.length === 0) {
    const newProd = await req('POST', '/api/admin/products', {
      name: 'Fresh Organic Mango',
      farm: 'Rajshahi Orchard',
      price: 480,
      unit: 'kg',
      category: 'Fruits',
      discount: 13
    }, adminCookie);
    products = [newProd.body];
  }
  const prodWithDiscount = products.find(p => p.discount && p.discount > 0) || products[0];
  const expectedBase = Number(prodWithDiscount.price);
  const expectedDiscount = Number(prodWithDiscount.discount) || 0;
  const expectedEffective = expectedDiscount > 0
    ? Math.round(expectedBase * (1 - expectedDiscount / 100) * 100) / 100
    : expectedBase;
  const qty = 2;
  const expectedSubtotal = Math.round(expectedEffective * qty * 100) / 100;
  const shippingFlat = Number(settingsRes.body.shippingFlat) || 80;
  const freeThreshold = Number(settingsRes.body.shippingFreeThreshold) || 1500;
  const expectedShipping = expectedSubtotal >= freeThreshold ? 0 : shippingFlat;
  const expectedTotal = Math.round((expectedSubtotal + expectedShipping) * 100) / 100;

  // Invalid item id test
  const badOrder = await req('POST', '/api/orders', {
    items: [{ id: 999999, qty: 1 }],
    delivery: { name: 'Audit User', phone: '01712345678', address: 'Banani', city: 'Dhaka' },
    paymentMethod: 'Cash on Delivery'
  }, customerCookie);
  assert(badOrder.status === 400, 'Order placement with invalid/non-existent product ID rejected with 400');

  // bKash unavailable test
  const bkashOrder = await req('POST', '/api/orders', {
    items: [{ id: prodWithDiscount.id, qty: 1 }],
    delivery: { name: 'Audit User', phone: '01712345678', address: 'Banani', city: 'Dhaka' },
    paymentMethod: 'bKash'
  }, customerCookie);
  assert(bkashOrder.status === 400 && bkashOrder.body.error.includes('not available'), 'bKash payment rejected with informative 400 Not Available error');

  // Nagad unavailable test
  const nagadOrder = await req('POST', '/api/orders', {
    items: [{ id: prodWithDiscount.id, qty: 1 }],
    delivery: { name: 'Audit User', phone: '01712345678', address: 'Banani', city: 'Dhaka' },
    paymentMethod: 'Nagad'
  }, customerCookie);
  assert(nagadOrder.status === 400 && nagadOrder.body.error.includes('not available'), 'Nagad payment rejected with informative 400 Not Available error');

  // Valid order test
  const orderRes = await req('POST', '/api/orders', {
    items: [{ id: prodWithDiscount.id, qty: qty }],
    delivery: { name: 'Audit User', phone: '01712345678', address: 'House 12, Road 4, Banani', city: 'Dhaka' },
    paymentMethod: 'Cash on Delivery'
  }, customerCookie);

  assert(orderRes.status === 201 && orderRes.body.order, 'Order created successfully with 201 Created');
  const createdOrder = orderRes.body.order;
  assert(Math.abs(createdOrder.subtotal - expectedSubtotal) < 0.01, `Order subtotal strictly matches server discount calculation (৳${createdOrder.subtotal} == ৳${expectedSubtotal})`);
  assert(Math.abs(createdOrder.total - expectedTotal) < 0.01, `Order grand total matches subtotal + shipping (৳${createdOrder.total} == ৳${expectedTotal})`);

  // TEST 6: Order Ownership & Customer Cancellation Flow
  console.log('\n▶ [TEST GROUP 6] Order Ownership, Messaging & Cancellation');
  const myOrders = await req('GET', '/api/orders', null, customerCookie);
  assert(myOrders.status === 200 && myOrders.body.some(o => o.id === createdOrder.id), 'Customer can retrieve their own order list');

  // Customer replies to order conversation thread
  const msgRes = await req('POST', `/api/orders/${createdOrder.id}/messages`, {
    message: 'Please deliver after 4 PM.'
  }, customerCookie);
  assert(msgRes.status === 201 && msgRes.body.message.text.includes('after 4 PM'), 'Customer can send message to order conversation');

  // Attempting to delete history while order is still Pending should fail
  const deletePendingHistory = await req('DELETE', `/api/orders/${createdOrder.id}/history`, null, customerCookie);
  assert(deletePendingHistory.status === 400 && String(deletePendingHistory.body.error).includes('Delivered or Cancelled'), 'Customer cannot delete order history while order is still in-flight (Pending)');

  // Customer cancels their pending order
  const cancelRes = await req('POST', `/api/orders/${createdOrder.id}/cancel`, {
    reason: 'Changed delivery date requirement'
  }, customerCookie);
  assert(cancelRes.status === 200 && cancelRes.body.order.status === 'Cancelled', 'Customer can cancel Pending order before confirmation');

  // Cancel again should fail
  const cancelAgain = await req('POST', `/api/orders/${createdOrder.id}/cancel`, {}, customerCookie);
  assert(cancelAgain.status === 400, 'Attempting to cancel an already cancelled order is rejected with 400');

  // Admin trying to change status of customer-cancelled order should be blocked
  const adminChangeCancelled = await req('PATCH', `/api/admin/orders/${createdOrder.id}`, { status: 'Confirmed' }, adminCookie);
  assert(adminChangeCancelled.status === 400 && String(adminChangeCancelled.body.error).includes('cancelled by the customer'), 'Admin attempting to change status of customer-cancelled order is rejected with 400');

  // Customer deletes order from their personal history view
  const deleteHistoryRes = await req('DELETE', `/api/orders/${createdOrder.id}/history`, null, customerCookie);
  assert(deleteHistoryRes.status === 200 && deleteHistoryRes.body.ok, 'Customer can delete order from their personal history');

  // Customer order list should now hide the deleted order
  const customerOrdersAfterDelete = await req('GET', '/api/orders', null, customerCookie);
  const isHiddenFromCustomer = !customerOrdersAfterDelete.body.some(o => o.id === createdOrder.id);
  assert(isHiddenFromCustomer, 'Deleted order is hidden from customer GET /api/orders');

  // Admin order list retains the order with customerHidden = true and full audit history trail
  const adminOrdersAfterDelete = await req('GET', '/api/admin/orders', null, adminCookie);
  const retainedOrder = adminOrdersAfterDelete.body.find(o => o.id === createdOrder.id);
  assert(Boolean(retainedOrder && retainedOrder.customerHidden), 'Admin panel retains order marked as customerHidden');
  assert(Array.isArray(retainedOrder.history) && retainedOrder.history.length >= 3, 'Order retains complete immutable change history log for trust');
  const historyActions = retainedOrder.history.map(h => h.action);
  assert(historyActions.includes('Order Placed'), 'History includes Order Placed event');
  assert(historyActions.includes('Order Cancelled by Customer'), 'History includes Order Cancelled event');
  assert(historyActions.includes('Order History Deleted by Customer'), 'History includes Order History Deleted event');

  // Customer fetches official money receipt
  const unauthReceipt = await req('GET', `/api/orders/${createdOrder.id}/receipt`);
  assert(unauthReceipt.status === 401, 'Unauthenticated receipt request returns 401');

  const customerReceipt = await req('GET', `/api/orders/${createdOrder.id}/receipt`, null, customerCookie);
  assert(customerReceipt.status === 200 && customerReceipt.body.ok, 'Customer can download their money receipt with 200 OK');
  assert(customerReceipt.body.receiptNumber && customerReceipt.body.receiptNumber.startsWith('REC-'), 'Receipt number format generated properly');
  assert(customerReceipt.body.store && customerReceipt.body.store.brandName, 'Receipt includes official site brand name metadata');
  assert(customerReceipt.body.order && customerReceipt.body.order.items.length === 1, 'Receipt includes itemized product list');

  const adminReceipt = await req('GET', `/api/orders/${createdOrder.id}/receipt`, null, adminCookie);
  assert(adminReceipt.status === 200 && adminReceipt.body.ok, 'Admin can also view/print customer order receipt');

  // TEST 7: Forgot Password & OTP Flow
  console.log('\n▶ [TEST GROUP 7] Forgot Password & OTP Integrity');
  const forgotUnknown = await req('POST', '/api/auth/forgot-password', { email: 'nonexistent_user_9999@example.com' });
  assert(forgotUnknown.status === 404, 'Forgot password for non-existent account returns 404');

  const forgotKnown = await req('POST', '/api/auth/forgot-password', { email: testCustomerEmail });
  assert(forgotKnown.status === 200 && forgotKnown.body.ok, 'Forgot password for valid customer triggers OTP flow with 200 OK');

  const badReset = await req('POST', '/api/auth/reset-password', {
    email: testCustomerEmail,
    otp: '000000',
    newPassword: 'BrandNewPassword123!'
  });
  assert(badReset.status === 400, 'Reset password with invalid OTP code rejected with 400');

  // TEST 8: Admin Safety Recycle Bin
  console.log('\n▶ [TEST GROUP 8] Admin Safety Recycle Bin (Recovery & Purge)');
  // 1. Create a test product
  const newProdRes = await req('POST', '/api/admin/products', {
    name: 'Bin Test Organic Apples',
    farm: 'Rajshahi Orchard',
    price: 250,
    unit: 'kg',
    cat: 'Fruits',
    tag: 'Test'
  }, adminCookie);
  assert(newProdRes.status === 201 && newProdRes.body.id, 'Test product created with 201 Created');
  const testProdId = newProdRes.body.id;

  // 2. Delete the product -> should move to safety bin
  const delProdRes = await req('DELETE', `/api/admin/products/${testProdId}`, null, adminCookie);
  assert(delProdRes.status === 200 && delProdRes.body.ok && delProdRes.body.binEntry, 'Deleting product moves it to Safety Bin');

  // 3. Check GET /api/admin/bin
  const binListRes = await req('GET', '/api/admin/bin', null, adminCookie);
  assert(binListRes.status === 200 && binListRes.body.ok, 'GET /api/admin/bin returns 200 OK');
  const foundInBin = (binListRes.body.bin || []).find(b => b.type === 'product' && b.originalId === testProdId);
  assert(Boolean(foundInBin), 'Deleted product is listed inside Recycle Bin');

  // 4. Restore the product from the bin
  const restoreRes = await req('POST', `/api/admin/bin/${foundInBin.id}/restore`, {}, adminCookie);
  assert(restoreRes.status === 200 && restoreRes.body.ok, 'Restoring product from bin succeeds with 200 OK');

  // 5. Verify product is back in catalog
  const catalogAfterRestore = await req('GET', '/api/products');
  const restoredInCatalog = catalogAfterRestore.body.some(p => p.id === testProdId);
  assert(restoredInCatalog, 'Restored product is immediately active in live store catalog');

  // 6. Delete again and permanently purge
  await req('DELETE', `/api/admin/products/${testProdId}`, null, adminCookie);
  const binAfterSecondDelete = await req('GET', '/api/admin/bin', null, adminCookie);
  const secondBinItem = (binAfterSecondDelete.body.bin || []).find(b => b.type === 'product' && b.originalId === testProdId);
  assert(Boolean(secondBinItem), 'Deleted product is back in bin');

  const purgeRes = await req('DELETE', `/api/admin/bin/${secondBinItem.id}`, null, adminCookie);
  assert(purgeRes.status === 200 && purgeRes.body.ok, 'Purging item permanently from bin succeeds with 200 OK');

  // TEST 9: Admin Panel Logo and Name Branding Customization
  console.log('\n▶ [TEST GROUP 9] Storefront & Admin Panel Branding Customization');
  const customAdminName = 'ENMAR Premium HQ';
  const customAdminLogo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  const updateBrandingRes = await req('PATCH', '/api/admin/settings', {
    brandName: 'ENMAR Organics',
    adminBrandName: customAdminName,
    adminLogo: customAdminLogo
  }, adminCookie);
  assert(updateBrandingRes.status === 200, 'PATCH /api/admin/settings branding succeeds with 200 OK');
  assert(updateBrandingRes.body.brandName === 'ENMAR Organics', 'Storefront brandName updated successfully');
  assert(updateBrandingRes.body.adminBrandName === customAdminName, 'Admin Panel adminBrandName updated successfully');
  assert(Boolean(updateBrandingRes.body.adminLogo), 'Admin Panel custom adminLogo updated successfully');

  const publicSettings = await req('GET', '/api/settings');
  assert(publicSettings.status === 200 && publicSettings.body.adminBrandName === customAdminName, 'GET /api/settings serves customized Admin branding');

  // Reset to default
  await req('PATCH', '/api/admin/settings', {
    brandName: 'ENMAR',
    adminBrandName: 'ENMAR Admin',
    adminLogo: ''
  }, adminCookie);

  // CLEANUP TEST ARTIFACTS
  if (createdOrder && createdOrder.id) {
    await req('DELETE', `/api/admin/orders/${createdOrder.id}`, null, adminCookie);
  }
  if (createCustomerRes && createCustomerRes.body && createCustomerRes.body.user) {
    await req('DELETE', `/api/admin/users/${createCustomerRes.body.user.id}`, null, adminCookie);
  }

  // Summary
  console.log('\n======================================================');
  console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('======================================================\n');
  if (failed > 0) process.exit(1);
}

setTimeout(() => {
  runSuite().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
}, 500);
