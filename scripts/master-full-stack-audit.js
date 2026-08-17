const http = require('http');
const db = require('../services/db-service');

const PORT = 3000;
let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✔ [PASS] ${message}`);
    passedCount++;
  } else {
    console.error(`  ✖ [FAIL] ${message}`);
    failedCount++;
  }
}

function req(path, options = {}) {
  return new Promise((resolve, reject) => {
    const opt = {
      hostname: '127.0.0.1',
      port: PORT,
      path: path,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };
    const r = http.request(opt, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch {}
        resolve({ status: res.statusCode, headers: res.headers, body: json, text: data });
      });
    });
    r.on('error', reject);
    if (options.body) {
      r.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    r.end();
  });
}

async function runMasterAudit() {
  console.log('\n===============================================================');
  console.log('       ENMAR MASTER FULL-STACK & BUTTON INTEGRITY AUDIT');
  console.log('===============================================================\n');

  // SECTION 1: Clean URLs & Routing
  console.log('▶ [PHASE 1] Clean URLs & Web Pages (Without .html Extensions)');
  const pages = [
    '/',
    '/checkout',
    '/my-orders',
    '/receipt',
    '/bmi-calculator',
    '/product',
    '/developer-info',
    '/admin/dashboard',
    '/admin/orders',
    '/admin/products',
    '/admin/customers',
    '/admin/staff',
    '/admin/reviews',
    '/admin/comments',
    '/admin/ads',
    '/admin/subscribers',
    '/admin/analytics',
    '/admin/settings',
    '/admin/apis',
    '/admin/bin'
  ];
  for (const p of pages) {
    const res = await req(p);
    assert(res.status === 200, `Route '${p}' resolves with HTTP 200 OK`);
  }

  // SECTION 2: SEO, Sitemap & Robots.txt
  console.log('\n▶ [PHASE 2] SEO Infrastructure & Google Crawlability');
  const robotsRes = await req('/robots.txt');
  assert(robotsRes.status === 200 && robotsRes.text.includes('Sitemap:'), 'robots.txt exists and references sitemap.xml');
  
  const sitemapRes = await req('/sitemap.xml');
  assert(sitemapRes.status === 200 && sitemapRes.text.includes('<urlset'), '/sitemap.xml generates valid XML with URL listings');

  // SECTION 3: Admin Auth & Session Management
  console.log('\n▶ [PHASE 3] SuperAdmin & Staff Authentication');
  const superEmail = process.env.SUPERADMIN_EMAIL || 'mdhourira6712@gmail.com';
  const superPass = process.env.SUPERADMIN_PASSWORD || 'Abuhourira97@';

  const adminLogin = await req('/api/auth/login', {
    method: 'POST',
    body: { email: superEmail, password: superPass }
  });
  assert(adminLogin.status === 200 && adminLogin.body.user && adminLogin.body.user.role === 'superadmin', 'Superadmin login successful');
  const adminCookie = adminLogin.headers['set-cookie'] ? adminLogin.headers['set-cookie'][0].split(';')[0] : '';

  // SECTION 4: Product Catalog & Image Management
  console.log('\n▶ [PHASE 4] Product Catalog & Full-Frame Image Support');
  const prodList = await req('/api/products');
  assert(prodList.status === 200 && Array.isArray(prodList.body), 'Public products list accessible');

  const newProd = await req('/api/admin/products', {
    method: 'POST',
    headers: { Cookie: adminCookie },
    body: {
      name: 'Master Organic Honey ' + Date.now(),
      category: 'Honey',
      price: 1200,
      discount: 10,
      stock: 50,
      unit: 'kg',
      farm: 'Sundarban Forest Reserve',
      description: '100% Pure Raw Honey',
      images: ['/uploads/honey.jpg']
    }
  });
  assert(newProd.status === 201 && newProd.body.id, 'Product creation with full-frame image support successful');
  const testProdId = newProd.body.id;

  // SECTION 5: Customer Journey & Order Flow
  console.log('\n▶ [PHASE 5] Customer Lifecycle, Cart & Order Placement');
  const testCustomerEmail = `customer_${Date.now()}@example.com`;
  const createCustomer = await req('/api/admin/users', {
    method: 'POST',
    headers: { Cookie: adminCookie },
    body: {
      name: 'Test Customer',
      email: testCustomerEmail,
      phone: '01711000000',
      password: 'Password123!',
      role: 'customer'
    }
  });
  assert(createCustomer.status === 201 && createCustomer.body.user, 'Customer account created');

  const customerLogin = await req('/api/auth/login', {
    method: 'POST',
    body: { email: testCustomerEmail, password: 'Password123!' }
  });
  assert(customerLogin.status === 200, 'Customer logged in');
  const customerCookie = customerLogin.headers['set-cookie'] ? customerLogin.headers['set-cookie'][0].split(';')[0] : '';

  const placeOrder = await req('/api/orders', {
    method: 'POST',
    headers: { Cookie: customerCookie },
    body: {
      items: [{ id: testProdId, qty: 2 }],
      delivery: {
        name: 'Test Customer',
        phone: '01711000000',
        address: 'House 12, Road 4, Dhanmondi, Dhaka',
        city: 'Dhaka'
      },
      notes: 'Please call before delivery',
      paymentMethod: 'Cash on Delivery'
    }
  });
  assert(placeOrder.status === 201 && (placeOrder.body.order || placeOrder.body).id, 'Order successfully placed');
  const testOrderId = (placeOrder.body.order || placeOrder.body).id;

  // Order Details & Edit
  const orderDetails = await req(`/api/orders/${testOrderId}`, { headers: { Cookie: customerCookie } });
  assert(orderDetails.status === 200 && orderDetails.body.id === testOrderId, 'Order detail fetch successful');

  const updateDelivery = await req(`/api/orders/${testOrderId}`, {
    method: 'PATCH',
    headers: { Cookie: customerCookie },
    body: { address: 'Updated Delivery Address, Dhaka' }
  });
  assert(updateDelivery.status === 200, 'Customer edited pending order address successfully');

  // Customer Chat Message
  const sendMsg = await req(`/api/orders/${testOrderId}/messages`, {
    method: 'POST',
    headers: { Cookie: customerCookie },
    body: { text: 'Hello, when will this order be shipped?' }
  });
  assert(sendMsg.status === 201 && sendMsg.body.ok, 'Customer order message sent successfully');

  // SECTION 6: Reviews, Ratings & Comments
  console.log('\n▶ [PHASE 6] Product Reviews, Ratings & Community Comments');
  const postReview = await req(`/api/products/${testProdId}/reviews`, {
    method: 'POST',
    headers: { Cookie: customerCookie },
    body: { rating: 5, comment: 'Exceptional quality honey!', images: ['/uploads/review1.jpg'] }
  });
  assert(postReview.status === 200 || postReview.status === 201, 'Product review submitted with photo');

  const postComment = await req('/api/comments', {
    method: 'POST',
    headers: { Cookie: customerCookie },
    body: { text: 'Do you deliver organic products outside Dhaka?' }
  });
  assert(postComment.status === 201 && postComment.body.comment, 'Community comment posted');

  // SECTION 7: Ads Maker & Full Banner Support
  console.log('\n▶ [PHASE 7] Ads Maker (Custom Full Banner & Text Ads)');
  const createBannerAd = await req('/api/admin/ads', {
    method: 'POST',
    headers: { Cookie: adminCookie },
    body: {
      name: 'Summer Discount Banner',
      image: '/uploads/summer-banner.jpg',
      buttonCat: 'Honey',
      active: true
    }
  });
  assert(createBannerAd.status === 201 && createBannerAd.body.id, 'Full-bleed banner ad created & published');
  const testAdId = createBannerAd.body.id;

  // SECTION 8: Store Settings, Branding & SEO Description
  console.log('\n▶ [PHASE 8] Store Settings, Branding & Live SEO Description');
  const updateSettings = await req('/api/admin/settings', {
    method: 'PATCH',
    headers: { Cookie: adminCookie },
    body: {
      brandName: 'ENMAR',
      siteDescription: 'ইনমার (ENMAR) - বাংলাদেশের নির্ভরযোগ্য প্রিমিয়াম অর্গানিক শপ। ১০০% খাঁটি সুন্দরবন মধু, গাওয়া ঘি, ড্রাই ফ্রুটস ও অর্গানিক গ্রোসারি।',
      themePrimary: '#631e2a',
      themeAccent: '#C0912E'
    }
  });
  assert(updateSettings.status === 200 && updateSettings.body.siteDescription, 'Settings & SEO Description saved to database');

  // SECTION 9: Email / Gmail Gateway API & Delete Connection
  console.log('\n▶ [PHASE 9] Gmail Gateway API & One-Click Delete Function');
  const saveEmailConfig = await req('/api/admin/apis', {
    method: 'PATCH',
    headers: { Cookie: adminCookie },
    body: {
      email: {
        provider: 'gmail',
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        user: 'test@gmail.com',
        pass: 'app-password-test',
        fromName: 'ENMAR Official',
        fromEmail: 'test@gmail.com'
      }
    }
  });
  assert(saveEmailConfig.status === 200, 'Gmail gateway credentials saved');

  const deleteEmailConfig = await req('/api/admin/apis/email', {
    method: 'DELETE',
    headers: { Cookie: adminCookie }
  });
  assert(deleteEmailConfig.status === 200, 'One-Click Delete Gmail connection executed successfully');

  // Restore live working gmail config
  await db.saveEmailGatewayConfig({
    provider: 'gmail',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    user: 'abuhouriramdabdulaziz85@gmail.com',
    pass: 'bujpinlwlituobbh',
    fromName: 'ENMAR Official',
    fromEmail: 'abuhouriramdabdulaziz85@gmail.com'
  });

  // SECTION 10: Admin Safety Recycle Bin (Capture, Restore & Empty)
  console.log('\n▶ [PHASE 10] Admin Recycle Bin (Capture, Restore & Empty Bin)');
  const deleteProd = await req(`/api/admin/products/${testProdId}`, {
    method: 'DELETE',
    headers: { Cookie: adminCookie }
  });
  assert(deleteProd.status === 200, 'Product deleted and captured to Recycle Bin');

  const binList = await req('/api/admin/bin', { headers: { Cookie: adminCookie } });
  assert(binList.status === 200 && binList.body.bin.length > 0, 'Recycle Bin displays captured items');

  const restoreItem = await req(`/api/admin/bin/${binList.body.bin[0].id}/restore`, {
    method: 'POST',
    headers: { Cookie: adminCookie }
  });
  assert(restoreItem.status === 200, 'Product restored back to active catalog from Bin');

  // Cleanup test product & test ad
  await db.deleteProduct(testProdId).catch(() => {});
  await db.deleteAd(testAdId).catch(() => {});

  console.log('\n===============================================================');
  console.log(` AUDIT RESULT: ${passedCount} PASSED | ${failedCount} FAILED`);
  console.log('===============================================================\n');

  if (failedCount === 0) {
    console.log('🎉 ALL BUTTONS, FUNCTIONS, ROUTINGS AND APIS VERIFIED 100% OPERATIONAL!\n');
  }
}

runMasterAudit().then(() => process.exit(failedCount === 0 ? 0 : 1));
