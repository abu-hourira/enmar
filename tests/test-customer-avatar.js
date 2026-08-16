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

const samplePngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function runTests() {
  console.log('====================================================');
  console.log('    CUSTOMER PROFILE PICTURE AUTOMATED TEST SUITE    ');
  console.log('====================================================\n');

  // 1. Superadmin creates a test customer account
  const testEmail = `cust_avatar_${Date.now()}@test.bd`;
  const adminLogin = await req('/api/auth/login', {
    method: 'POST',
    body: { email: 'superadmin@enmar.bd', password: 'SuperAdmin123!' }
  });
  const adminCookie = (adminLogin.headers['set-cookie'] || []).find(c => c.startsWith('hm_session='));

  const createCust = await req('/api/admin/users', {
    method: 'POST',
    body: {
      name: 'Tamim Iqbal',
      email: testEmail,
      password: 'Password123!',
      role: 'customer'
    }
  }, adminCookie);

  if (createCust.status !== 201) {
    throw new Error('Failed to create test customer: ' + JSON.stringify(createCust.body));
  }
  console.log('✔ PASS [1] Test customer created successfully');

  // 2. Customer logs in
  const custLogin = await req('/api/auth/login', {
    method: 'POST',
    body: { email: testEmail, password: 'Password123!' }
  });
  const custCookie = (custLogin.headers['set-cookie'] || []).find(c => c.startsWith('hm_session='));
  if (custLogin.status !== 200 || !custCookie) {
    throw new Error('Customer login failed');
  }
  console.log('✔ PASS [2] Customer logged in and received session cookie');

  // 3. Customer uploads profile picture
  const uploadRes = await req('/api/profile', {
    method: 'PATCH',
    body: {
      avatar: samplePngBase64
    }
  }, custCookie);

  if (uploadRes.status !== 200) {
    throw new Error('Profile avatar upload failed: ' + JSON.stringify(uploadRes.body));
  }
  if (!uploadRes.body.user || !uploadRes.body.user.avatar || !uploadRes.body.user.avatar.includes('/uploads/')) {
    throw new Error('Avatar not saved to /uploads/: ' + JSON.stringify(uploadRes.body));
  }
  const avatarPath = uploadRes.body.user.avatar;
  console.log(`✔ PASS [3] Profile picture uploaded and saved: ${avatarPath}`);

  // 4. Customer verifies avatar via GET /api/auth/me
  const meRes = await req('/api/auth/me', {}, custCookie);
  if (meRes.status !== 200 || meRes.body.user.avatar !== avatarPath) {
    throw new Error('GET /api/auth/me did not return updated avatar');
  }
  console.log('✔ PASS [4] GET /api/auth/me reflects updated profile picture');

  // 5. Customer submits a comment and verifies avatar in GET /api/comments
  const commentRes = await req('/api/comments', {
    method: 'POST',
    body: { text: 'Testing customer avatar in community comment.' }
  }, custCookie);
  if (commentRes.status !== 201) {
    throw new Error('Comment submission failed: ' + JSON.stringify(commentRes.body));
  }

  const getComments = await req('/api/comments');
  const myComment = (getComments.body || []).find(c => c.id === commentRes.body.comment.id);
  if (!myComment || myComment.authorAvatar !== avatarPath) {
    throw new Error('Comment does not have authorAvatar: ' + JSON.stringify(myComment));
  }
  console.log('✔ PASS [5] Community comments correctly attach customer profile picture');

  // 6. Customer submits a review and verifies avatar in GET /api/products/1/reviews
  const reviewRes = await req('/api/products/1/reviews', {
    method: 'POST',
    body: { rating: 5, comment: 'Great product with avatar test!' }
  }, custCookie);
  if (reviewRes.status !== 200 && reviewRes.status !== 201) {
    throw new Error('Review submission failed: ' + JSON.stringify(reviewRes.body));
  }

  const getReviews = await req('/api/products/1/reviews');
  const myReview = (getReviews.body || []).find(r => r.id === reviewRes.body.id);
  if (!myReview || myReview.authorAvatar !== avatarPath) {
    throw new Error('Review does not have authorAvatar: ' + JSON.stringify(myReview));
  }
  console.log('✔ PASS [6] Product reviews correctly attach customer profile picture');

  // 7. Customer removes profile picture
  const removeRes = await req('/api/profile', {
    method: 'PATCH',
    body: {
      avatar: ''
    }
  }, custCookie);

  if (removeRes.status !== 200 || removeRes.body.user.avatar !== '') {
    throw new Error('Profile avatar removal failed: ' + JSON.stringify(removeRes.body));
  }
  console.log('✔ PASS [7] Customer successfully removed profile picture');

  // 8. Admin customer list renders avatar when present
  const uploadAgain = await req('/api/profile', {
    method: 'PATCH',
    body: { avatar: samplePngBase64 }
  }, custCookie);
  const adminUsers = await req('/api/admin/users', {}, adminCookie);
  const custInAdmin = (adminUsers.body || []).find(u => u.email === testEmail);
  if (!custInAdmin || !custInAdmin.avatar || !custInAdmin.avatar.includes('/uploads/')) {
    throw new Error('Admin users list does not contain customer avatar: ' + JSON.stringify(custInAdmin));
  }
  console.log('✔ PASS [8] Admin panel user records display customer profile picture');

  console.log('\n====================================================');
  console.log('    ALL 8 CUSTOMER PROFILE PICTURE TESTS PASSED     ');
  console.log('====================================================');
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err.message);
  process.exit(1);
});
