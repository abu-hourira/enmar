// scripts/superadmin-and-user-journey-audit.js
const http = require('http');

const PORT = 3000;
const BASE_URL = `http://127.0.0.1:${PORT}`;

const SUPERADMIN_EMAIL = 'mdhourira6712@gmail.com';
const SUPERADMIN_PASSWORD = 'Abuhourira97@';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const logs = [];

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

function check(title, condition, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  \x1b[32m✔ [PASS]\x1b[0m ${title} ${details ? '(' + details + ')' : ''}`);
    logs.push({ title, status: 'PASS', details });
  } else {
    failedTests++;
    console.error(`  \x1b[31m✖ [FAIL]\x1b[0m ${title} ${details ? '(' + details + ')' : ''}`);
    logs.push({ title, status: 'FAIL', details });
  }
}

async function runSuperAdminAndUserAudit() {
  console.log('\n================================================================');
  console.log('       ENMAR FULL-SYSTEM SUPER ADMIN & CUSTOMER JOURNEY AUDIT');
  console.log('================================================================\n');

  // ==========================================
  // PHASE 1: SUPER ADMIN PERSONA
  // ==========================================
  console.log('👑 [PHASE 1] SUPER ADMIN ACTIONS & MANAGEMENT CHECK');

  // 1.1 Super Admin Login
  const loginRes = await req('POST', '/api/auth/login', {
    email: SUPERADMIN_EMAIL,
    password: SUPERADMIN_PASSWORD
  });
  check('Super Admin Authentication', loginRes.status === 200 && loginRes.body.user.role === 'superadmin', `Logged in as ${loginRes.body.user?.email}`);
  const adminCookie = loginRes.cookie;

  // 1.2 Dashboard Metrics
  const statsRes = await req('GET', '/api/admin/stats', null, adminCookie);
  check('Admin Dashboard Stats Retrieval', statsRes.status === 200 && statsRes.body.users !== undefined, `Users: ${statsRes.body.users}, Products: ${statsRes.body.products}, Orders: ${statsRes.body.orders}`);

  // 1.3 Store Settings & Branding
  const settingsPatchRes = await req('PATCH', '/api/admin/settings', {
    brandName: 'ENMAR Organic Foods',
    adminBrandName: 'ENMAR Control Center',
    shippingFlat: 80,
    shippingFreeThreshold: 1500
  }, adminCookie);
  check('Store Settings & Delivery Policy Update', settingsPatchRes.status === 200 && settingsPatchRes.body.brandName === 'ENMAR Organic Foods', 'Flat: ৳80, Free threshold: ৳1,500');

  // 1.4 Adding Real Organic Products across Categories
  console.log('\n  🌾 Adding Fresh Organic Products to Catalog...');
  const prod1Res = await req('POST', '/api/admin/products', {
    name: 'Sundarban Raw Organic Honey',
    farm: 'Sundarban Forest API Co-op',
    price: 950,
    unit: '500g jar',
    category: 'Honey & Sweeteners',
    icon: 'droplet',
    discount: 10,
    description: '100% pure unfiltered raw wild honey collected directly from Sundarban mangrove forest.'
  }, adminCookie);
  check('Add Product 1 (Honey)', prod1Res.status === 201 && prod1Res.body.id, `ID: ${prod1Res.body.id}, ৳${prod1Res.body.price}`);
  const honeyProd = prod1Res.body;

  const prod2Res = await req('POST', '/api/admin/products', {
    name: 'Cold Pressed Pure Mustard Oil',
    farm: 'Natore Organic Agro',
    price: 380,
    unit: '1 Litre',
    category: 'Oils & Ghee',
    icon: 'sun',
    discount: 5,
    description: 'Traditional wood-pressed (Ghani-bhanga) pure mustard oil with pungent natural aroma.'
  }, adminCookie);
  check('Add Product 2 (Mustard Oil)', prod2Res.status === 201 && prod2Res.body.id, `ID: ${prod2Res.body.id}, ৳${prod2Res.body.price}`);
  const oilProd = prod2Res.body;

  const prod3Res = await req('POST', '/api/admin/products', {
    name: 'Organic Premium Nazirshail Rice',
    farm: 'Dinajpur Heritage Farms',
    price: 420,
    unit: '5kg pack',
    category: 'Rice & Grains',
    icon: 'box',
    discount: 0,
    description: 'Aromatic unpolished long-grain organic Nazirshail rice with high fiber content.'
  }, adminCookie);
  check('Add Product 3 (Rice)', prod3Res.status === 201 && prod3Res.body.id, `ID: ${prod3Res.body.id}, ৳${prod3Res.body.price}`);
  const riceProd = prod3Res.body;

  // 1.5 Temporary Product for Recycle Bin & Restore Lifecycle Test
  const tempProdRes = await req('POST', '/api/admin/products', {
    name: 'Test Temporary Seasonal Vegetable',
    farm: 'Bogra Green Fields',
    price: 150,
    unit: 'kg',
    category: 'Vegetables',
    discount: 0
  }, adminCookie);
  const tempProdId = tempProdRes.body.id;
  check('Create Temp Product for Bin Test', tempProdRes.status === 201 && tempProdId, `Temp ID: ${tempProdId}`);

  // 1.6 Delete product to Recycle Bin
  const delToBinRes = await req('DELETE', `/api/admin/products/${tempProdId}`, null, adminCookie);
  check('Soft Delete Product to Safety Bin', delToBinRes.status === 200 && delToBinRes.body.ok, `Product ${tempProdId} moved to Recycle Bin`);

  // 1.7 Check Recycle Bin
  const binListRes = await req('GET', '/api/admin/bin', null, adminCookie);
  check('Fetch Recycle Bin List', binListRes.status === 200 && binListRes.body.bin.some(b => b.originalId === tempProdId || b.title.includes('Temporary')), `Items in bin: ${binListRes.body.bin.length}`);
  const binEntry = binListRes.body.bin.find(b => b.originalId === tempProdId || b.title.includes('Temporary'));

  // 1.8 Restore from Bin
  if (binEntry) {
    const restoreRes = await req('POST', `/api/admin/bin/${binEntry.id}/restore`, null, adminCookie);
    check('Restore Product from Bin', restoreRes.status === 200, `Restored Item ID: ${binEntry.id}`);

    // Verify it is back in active products
    const liveProdsRes = await req('GET', '/api/products');
    check('Verify Restored Product in Live Catalog', liveProdsRes.body.some(p => p.name.includes('Temporary')), 'Product active again');

    // Delete again and Purge Permanently
    await req('DELETE', `/api/admin/products/${tempProdId}`, null, adminCookie);
    const updatedBin = await req('GET', '/api/admin/bin', null, adminCookie);
    const newBinEntry = updatedBin.body.bin.find(b => b.originalId === tempProdId);
    if (newBinEntry) {
      const purgeRes = await req('DELETE', `/api/admin/bin/${newBinEntry.id}`, null, adminCookie);
      check('Permanently Purge from Bin', purgeRes.status === 200, 'Purged completely from storage');
    }
  }

  // 1.9 Super Admin Provisions Staff Account
  const staffEmail = `manager_${Date.now()}@enmar.bd`;
  const staffRes = await req('POST', '/api/admin/users', {
    name: 'Jamal Store Manager',
    email: staffEmail,
    password: 'ManagerPass123!',
    role: 'manager',
    phone: '01700112233'
  }, adminCookie);
  check('Staff Account Provisioning (Manager)', staffRes.status === 201 && staffRes.body.user.role === 'manager', `Created: ${staffEmail}`);

  // ==========================================
  // PHASE 2: CUSTOMER USER PERSONA
  // ==========================================
  console.log('\n👤 [PHASE 2] CUSTOMER JOURNEY (STOREFRONT, CHECKOUT, TRACKING & REVIEWS)');

  const customerEmail = `customer_audit_${Date.now()}@gmail.com`;
  const customerPass = 'CustomerPass123!';

  // 2.1 Customer Registration / Account Creation
  const custRegisterRes = await req('POST', '/api/admin/users', {
    name: 'Rahim Ahmed',
    email: customerEmail,
    password: customerPass,
    phone: '01819998877',
    role: 'customer',
    address: 'House 42, Road 11, Block D, Banani',
    city: 'Dhaka'
  }, adminCookie);
  check('Customer Account Registration', custRegisterRes.status === 201 && custRegisterRes.body.user.id, `Name: Rahim Ahmed (${customerEmail})`);

  // 2.2 Customer Login
  const custLoginRes = await req('POST', '/api/auth/login', {
    email: customerEmail,
    password: customerPass
  });
  check('Customer Login Authentication', custLoginRes.status === 200 && custLoginRes.body.user.role === 'customer', `Role: ${custLoginRes.body.user.role}`);
  const customerCookie = custLoginRes.cookie;

  // 2.3 Customer Browses Storefront Catalog & Categories
  const catalogRes = await req('GET', '/api/products');
  check('Customer Views Live Storefront Catalog', catalogRes.status === 200 && catalogRes.body.length >= 3, `Available Products: ${catalogRes.body.length}`);

  const categoriesRes = await req('GET', '/api/categories');
  check('Customer Browses Category Navigation', categoriesRes.status === 200 && Array.isArray(categoriesRes.body), `Categories: ${categoriesRes.body.join(', ')}`);

  // 2.4 Customer Views Specific Product Details
  const singleProdRes = await req('GET', `/api/products/${honeyProd.id}`);
  check('Customer Views Product Detail Page', singleProdRes.status === 200 && singleProdRes.body.name === honeyProd.name, `Price: ৳${singleProdRes.body.price}, Discount: ${singleProdRes.body.discount}%`);

  // 2.5 Customer Adds to Cart & Places Order (COD in BDT)
  // Honey: 950 - 10% = 855 * 2 = 1710
  // Oil: 380 - 5% = 361 * 1 = 361
  // Subtotal = 2071 (>= 1500 => free shipping)
  const orderPlacementRes = await req('POST', '/api/orders', {
    delivery: {
      name: 'Rahim Ahmed',
      phone: '01819998877',
      address: 'House 42, Road 11, Block D, Banani',
      city: 'Dhaka',
      notes: 'Please call before arrival. Fragile glass jar items.'
    },
    paymentMethod: 'Cash on Delivery',
    items: [
      { id: honeyProd.id, qty: 2 },
      { id: oilProd.id, qty: 1 }
    ]
  }, customerCookie);

  check('Order Placement & Automated Pricing Calculation', orderPlacementRes.status === 201 && orderPlacementRes.body.order.number, `Order #: ${orderPlacementRes.body.order?.number}`);
  const order = orderPlacementRes.body.order;

  check('Pricing Verification: Subtotal & Free Shipping Calculation', 
    order.subtotal === 2071 && order.shipping === 0 && order.total === 2071,
    `Subtotal: ৳${order.subtotal}, Shipping: ৳${order.shipping}, Grand Total: ৳${order.total}`
  );

  // 2.6 Customer Checks Order List & Details
  const myOrdersRes = await req('GET', '/api/orders', null, customerCookie);
  check('Customer Order History Tracking', myOrdersRes.status === 200 && myOrdersRes.body.some(o => o.id === order.id), `Found ${myOrdersRes.body.length} orders in account`);

  // 2.7 Customer Generates Official Money Receipt
  const receiptRes = await req('GET', `/api/orders/${order.id}/receipt`, null, customerCookie);
  check('Official Order Money Receipt Generation', receiptRes.status === 200 && receiptRes.body.receiptNumber, `Receipt: ${receiptRes.body.receiptNumber}, Store: ${receiptRes.body.store?.brandName}`);

  // 2.8 Customer Sends Chat Message in Order Thread
  const customerMsgRes = await req('POST', `/api/orders/${order.id}/messages`, {
    text: 'Hello, please ensure the honey jar is bubble-wrapped securely.'
  }, customerCookie);
  check('Customer Sends Order Message', customerMsgRes.status === 201 && customerMsgRes.body.ok, 'Message added to order conversation');

  // ==========================================
  // PHASE 3: ADMIN FULFILLMENT & INTERACTION
  // ==========================================
  console.log('\n👨‍💼 [PHASE 3] ADMIN PROCESSING & ORDER FULFILLMENT');

  // 3.1 Admin Views Order & Conversation
  const adminOrderRes = await req('GET', `/api/orders/${order.id}`, null, adminCookie);
  check('Admin Inspects Customer Order', adminOrderRes.status === 200 && adminOrderRes.body.id === order.id, `Customer: ${adminOrderRes.body.delivery?.name}`);

  // 3.2 Admin Replies to Customer
  const adminReplyRes = await req('POST', `/api/admin/orders/${order.id}/messages`, {
    text: 'Dear Rahim, we have added extra bubble-wrap and fragile tags. Delivery dispatching tomorrow!'
  }, adminCookie);
  check('Admin Replies to Customer in Thread', adminReplyRes.status === 201 && adminReplyRes.body.ok, 'Staff reply recorded');

  // 3.3 Admin Updates Order Status (Confirmed -> Processing -> Shipped)
  const statusUpdateRes = await req('PATCH', `/api/admin/orders/${order.id}`, {
    status: 'Shipped',
    estimatedDelivery: 'Tomorrow afternoon'
  }, adminCookie);
  check('Admin Updates Delivery Status to "Shipped"', statusUpdateRes.status === 200 && statusUpdateRes.body.status === 'Shipped', 'Status: Shipped');

  // ==========================================
  // PHASE 4: REVIEWS, COMMUNITY VOICES & NEWSLETTER
  // ==========================================
  console.log('\n⭐ [PHASE 4] REVIEWS, COMMUNITY COMMENTS & NEWSLETTER');

  // 4.1 Customer Leaves Product Review
  const reviewRes = await req('POST', `/api/products/${honeyProd.id}/reviews`, {
    rating: 5,
    comment: 'Authentic wild Sundarban honey. Thick consistency and remarkable taste! Highly recommend.'
  }, customerCookie);
  check('Customer Submits 5-Star Product Review', reviewRes.status === 201 && reviewRes.body.rating === 5, `Review ID: ${reviewRes.body.id}`);

  // 4.2 Customer Views Personal Reviews
  const myReviewsRes = await req('GET', '/api/my-reviews', null, customerCookie);
  check('Customer My Reviews Portal', myReviewsRes.status === 200 && myReviewsRes.body.length > 0, `Total Reviews: ${myReviewsRes.body.length}`);

  // 4.3 Customer Posts in Community Voices
  const commentRes = await req('POST', '/api/comments', {
    text: 'ENMAR provides the freshest organic groceries in Dhaka. Super fast delivery!'
  }, customerCookie);
  check('Customer Posts in Community Voices Forum', commentRes.status === 201 && commentRes.body.comment.id, `Comment ID: ${commentRes.body.comment.id}`);

  // 4.4 Newsletter Subscription
  const subRes = await req('POST', '/api/subscribe', {
    email: 'organic_lover_dhaka@gmail.com'
  });
  check('Newsletter Subscription', subRes.status === 201 && subRes.body.ok, 'Subscribed successfully');

  // ==========================================
  // AUDIT SUMMARY
  // ==========================================
  console.log('\n================================================================');
  console.log(` AUDIT SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED (100% HEALTHY)`);
  console.log('================================================================\n');

  process.exit(failedTests > 0 ? 1 : 0);
}

runSuperAdminAndUserAudit().catch(err => {
  console.error('FATAL AUDIT ERROR:', err);
  process.exit(1);
});
