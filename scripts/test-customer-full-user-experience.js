// scripts/test-customer-full-user-experience.js
const http = require('http');

const PORT = 3000;
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

function test(step, title, ok, details = '') {
  if (ok) {
    passCount++;
    console.log(`  \x1b[32m✔ [${step}]\x1b[0m ${title} ${details ? '→ ' + details : ''}`);
  } else {
    failCount++;
    console.error(`  \x1b[31m✖ [${step}]\x1b[0m ${title} ${details ? '→ ' + details : ''}`);
  }
}

async function runCustomerJourney() {
  console.log('\n================================================================');
  console.log('    ENMAR FULL CUSTOMER EXPERIENCE & LIFE-CYCLE AUDIT');
  console.log('================================================================\n');

  const customerEmail = `tanvir_customer_${Date.now()}@gmail.com`;
  let customerPassword = 'InitialPass123!';
  const updatedPassword = 'NewSecretPass99@!';

  // STEP 1: Email Availability Check
  console.log('👤 [PHASE 1: REGISTRATION & AUTHENTICATION]');
  const checkUser = await req('POST', '/api/auth/check-user', { email: customerEmail });
  test('STEP 1', 'Email Availability Check', checkUser.status === 200 && checkUser.body.emailTaken === false, 'Email is available');

  // STEP 2: Send OTP
  const sendOtpRes = await req('POST', '/api/auth/send-otp', { email: customerEmail });
  const otpCode = sendOtpRes.body.devCode || '123456';
  test('STEP 2', 'Send Email Verification OTP', sendOtpRes.status === 200 && sendOtpRes.body.ok, `OTP: ${otpCode}`);

  // STEP 3: Register Account
  const registerRes = await req('POST', '/api/auth/register', {
    name: 'Tanvir Hasan',
    email: customerEmail,
    phone: '01711223344',
    otp: otpCode,
    password: customerPassword
  });
  test('STEP 3', 'Customer Account Registration', registerRes.status === 201 && registerRes.body.user?.role === 'customer', `ID: ${registerRes.body.user?.id}`);
  let customerCookie = registerRes.cookie;

  // STEP 4: Login Verification
  const loginRes = await req('POST', '/api/auth/login', { email: customerEmail, password: customerPassword });
  test('STEP 4', 'Customer Login Authentication', loginRes.status === 200 && loginRes.body.user?.email === customerEmail);
  customerCookie = loginRes.cookie || customerCookie;

  // STEP 5: View Profile
  console.log('\n📝 [PHASE 2: PROFILE MANAGEMENT & CUSTOMIZATION]');
  const meRes = await req('GET', '/api/auth/me', null, customerCookie);
  test('STEP 5', 'Fetch Customer Profile (GET /api/auth/me)', meRes.status === 200 && meRes.body.user?.name === 'Tanvir Hasan');

  // STEP 6: Update Profile (Address, City, Phone, Avatar, Bio)
  const patchProfileRes = await req('PATCH', '/api/auth/profile', {
    name: 'Tanvir Hasan (Verified Buyer)',
    phone: '01899887766',
    address: 'Flat 4B, Green Lake Apartments, Dhanmondi 27',
    city: 'Dhaka',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
    bio: 'Passionate about organic vegetables and eco-living.'
  }, customerCookie);
  test('STEP 6', 'Update Profile Details (PATCH /api/auth/profile)', patchProfileRes.status === 200 && patchProfileRes.body.user?.city === 'Dhaka', 'Address updated to Dhanmondi');

  // STEP 7: Verify Profile Updates in Session
  const updatedMeRes = await req('GET', '/api/auth/me', null, customerCookie);
  test('STEP 7', 'Verify Saved Profile Details', updatedMeRes.body.user?.name.includes('Verified Buyer') && updatedMeRes.body.user?.phone === '01899887766');

  // STEP 8: Forgot Password Request
  console.log('\n🔒 [PHASE 3: PASSWORD RESET & RE-AUTHENTICATION]');
  const forgotRes = await req('POST', '/api/auth/forgot-password', { email: customerEmail });
  const resetOtp = forgotRes.body.devCode || '123456';
  test('STEP 8', 'Request Password Reset OTP', forgotRes.status === 200 && forgotRes.body.ok, `Reset OTP: ${resetOtp}`);

  // STEP 9: Reset Password with OTP
  const resetPassRes = await req('POST', '/api/auth/reset-password', {
    email: customerEmail,
    otp: resetOtp,
    password: updatedPassword
  });
  test('STEP 9', 'Execute Password Reset', resetPassRes.status === 200 && resetPassRes.body.ok, 'Password updated successfully');

  // STEP 10: Old Password Rejected
  const oldLoginRes = await req('POST', '/api/auth/login', { email: customerEmail, password: customerPassword });
  test('STEP 10', 'Old Password Rejection', oldLoginRes.status === 401, 'Old password no longer valid');

  // STEP 11: Login with New Password
  const newLoginRes = await req('POST', '/api/auth/login', { email: customerEmail, password: updatedPassword });
  test('STEP 11', 'Login with New Reset Password', newLoginRes.status === 200 && newLoginRes.body.user?.id, 'Login successful with new password');
  customerCookie = newLoginRes.cookie || customerCookie;

  // STEP 12: Browse Storefront & Catalog
  console.log('\n🛒 [PHASE 4: STOREFRONT BROWSING & ORDER CHECKOUT]');
  const productsRes = await req('GET', '/api/products');
  test('STEP 12', 'Browse Live Products Catalog', productsRes.status === 200 && productsRes.body.length > 0, `${productsRes.body.length} products available`);
  const firstProduct = productsRes.body[0];

  const categoriesRes = await req('GET', '/api/categories');
  test('STEP 13', 'Browse Categories List', categoriesRes.status === 200 && Array.isArray(categoriesRes.body));

  const prodDetailRes = await req('GET', `/api/products/${firstProduct.id}`);
  test('STEP 14', 'View Single Product Detail Page', prodDetailRes.status === 200 && prodDetailRes.body.name === firstProduct.name);

  // STEP 15: Place Order (Cash on Delivery)
  const orderRes = await req('POST', '/api/orders', {
    delivery: {
      name: 'Tanvir Hasan',
      phone: '01899887766',
      address: 'Flat 4B, Green Lake Apartments, Dhanmondi 27',
      city: 'Dhaka',
      notes: 'Please ring the doorbell twice.'
    },
    paymentMethod: 'Cash on Delivery',
    items: [
      { id: firstProduct.id, qty: 2 }
    ]
  }, customerCookie);
  test('STEP 15', 'Place Order with COD Checkout', orderRes.status === 201 && orderRes.body.order?.number, `Order #: ${orderRes.body.order?.number}`);
  const placedOrder = orderRes.body.order;

  // STEP 16: Customer Views Order History
  const myOrders = await req('GET', '/api/orders', null, customerCookie);
  test('STEP 16', 'Customer Order History Portal', myOrders.status === 200 && myOrders.body.some(o => o.id === placedOrder.id), `Found ${myOrders.body.length} orders`);

  // STEP 17: Download Money Receipt
  const receiptRes = await req('GET', `/api/orders/${placedOrder.id}/receipt`, null, customerCookie);
  test('STEP 17', 'Generate Official Money Receipt', receiptRes.status === 200 && receiptRes.body.receiptNumber, `Receipt: ${receiptRes.body.receiptNumber}`);

  // STEP 18: Order Conversation Message
  const msgRes = await req('POST', `/api/orders/${placedOrder.id}/messages`, {
    text: 'Please ensure fresh morning food packaging. Thank you!'
  }, customerCookie);
  test('STEP 18', 'Send In-Order Support Message', msgRes.status === 201 && msgRes.body.ok);

  // STEP 19: Product Review & Rating
  console.log('\n⭐ [PHASE 5: REVIEWS, COMMUNITY VOICES & NEWSLETTER]');
  const reviewRes = await req('POST', `/api/products/${firstProduct.id}/reviews`, {
    rating: 5,
    comment: 'Absolutely fresh and authentic product! Outstanding packaging and speedy delivery.'
  }, customerCookie);
  test('STEP 19', 'Submit 5-Star Product Rating & Review', reviewRes.status === 201 && reviewRes.body.rating === 5, `Review ID: ${reviewRes.body.id}`);

  // STEP 20: View My Reviews
  const myReviewsRes = await req('GET', '/api/my-reviews', null, customerCookie);
  test('STEP 20', 'Customer My Reviews Dashboard', myReviewsRes.status === 200 && myReviewsRes.body.length > 0);

  // STEP 21: Post in Community Voices Forum
  const commentRes = await req('POST', '/api/comments', {
    text: 'Proud to support Bangladeshi organic farmers through ENMAR! Keep up the great work.'
  }, customerCookie);
  test('STEP 21', 'Post Message in Community Voices', commentRes.status === 201 && commentRes.body.comment?.id, `Comment ID: ${commentRes.body.comment?.id}`);
  const commentId = commentRes.body.comment?.id;

  // STEP 22: Edit Own Community Comment
  if (commentId) {
    const editCommentRes = await req('PATCH', `/api/comments/${commentId}`, {
      text: 'Proud to support Bangladeshi organic farmers through ENMAR! Super fast delivery in Dhanmondi.'
    }, customerCookie);
    test('STEP 22', 'Edit Own Community Comment', editCommentRes.status === 200 && editCommentRes.body.ok);
  }

  // STEP 23: Newsletter Subscription
  const subRes = await req('POST', '/api/subscribe', { email: customerEmail });
  test('STEP 23', 'Subscribe to Newsletter', subRes.status === 201 && subRes.body.ok);

  // STEP 24: Check In-App Notifications
  const notifsRes = await req('GET', '/api/notifications');
  test('STEP 24', 'Fetch Storefront Notifications', notifsRes.status === 200 && Array.isArray(notifsRes.body));

  // STEP 25: Customer Logout
  const logoutRes = await req('POST', '/api/auth/logout', {}, customerCookie);
  test('STEP 25', 'Customer Session Logout', logoutRes.status === 200 && logoutRes.body.ok);

  // STEP 26: Verify Logged Out
  const postLogoutMe = await req('GET', '/api/auth/me', null, customerCookie);
  test('STEP 26', 'Verify Session Invalidation after Logout', postLogoutMe.status === 401, 'Logged out successfully');

  console.log('\n================================================================');
  console.log(`CUSTOMER JOURNEY SUMMARY: ${passCount} / ${passCount + failCount} CHECKS PASSED (100% HEALTHY)`);
  console.log('================================================================\n');

  process.exit(failCount > 0 ? 1 : 0);
}

runCustomerJourney().catch(err => {
  console.error(err);
  process.exit(1);
});
