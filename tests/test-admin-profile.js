const http = require('http');

async function main() {
  console.log('Testing Super Admin Profile Customization...');

  // 1. Login as superadmin
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'superadmin@enmar.bd', password: 'SuperAdmin123!' })
  });
  if (!loginRes.ok) {
    const err = await loginRes.json();
    throw new Error('Login failed: ' + JSON.stringify(err));
  }
  const cookie = loginRes.headers.get('set-cookie');
  console.log('[PASS] Super Admin Login successful');

  // 2. Fetch current user
  const meRes = await fetch('http://localhost:3000/api/auth/me', {
    headers: { cookie }
  });
  const meData = await meRes.json();
  console.log('[PASS] Me endpoint returned:', meData.user.name, `(${meData.user.role})`);

  // 3. Customize profile
  const testAvatarBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const patchRes = await fetch('http://localhost:3000/api/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({
      name: 'Abu Hourira (Superadmin)',
      designation: 'Founder & CEO',
      phone: '01898765432',
      city: 'Dhaka',
      address: 'Plot 15, Block B, Bashundhara R/A',
      bio: 'Managing and directing ENMAR Fresh Harvest Organic Market.',
      avatar: testAvatarBase64
    })
  });
  if (!patchRes.ok) {
    const err = await patchRes.json();
    throw new Error('Profile update failed: ' + JSON.stringify(err));
  }
  const patchData = await patchRes.json();
  console.log('[PASS] Profile updated successfully:', patchData.user);

  // Assertions
  if (patchData.user.name !== 'Abu Hourira (Superadmin)') throw new Error('Name mismatch');
  if (patchData.user.designation !== 'Founder & CEO') throw new Error('Designation mismatch');
  if (patchData.user.city !== 'Dhaka') throw new Error('City mismatch');
  if (!patchData.user.avatar || !patchData.user.avatar.includes('/uploads/')) throw new Error('Avatar not saved to uploads');
  if (patchData.user.email !== 'superadmin@enmar.bd') throw new Error('Email should not change');
  if (patchData.user.role !== 'superadmin') throw new Error('Role should not change');

  console.log('ALL SUPER ADMIN PROFILE TESTS PASSED SUCCESSFULLY!');
}

main().catch(err => {
  console.error('[FAIL]', err);
  process.exit(1);
});
