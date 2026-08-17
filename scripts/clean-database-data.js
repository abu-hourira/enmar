const pool = require('../config/db.js');
const crypto = require('crypto');

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return new Promise((resolve, reject) => {
    if (!password) return reject(new Error('Password required'));
    crypto.scrypt(String(password), salt, 64, (error, derived) =>
      error ? reject(error) : resolve(`${salt}:${derived.toString('hex')}`));
  });
}

async function cleanDatabase() {
  console.log('--- Starting Database Data Cleanup (Preserving Table Structures) ---');
  
  // Disable foreign key checks for clean truncate/delete
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  
  const tablesToClear = [
    'order_items',
    'customer_notifications',
    'orders',
    'reviews',
    'community_comments',
    'recycle_bin',
    'subscribers',
    'ads',
    'ad_media',
    'categories',
    'products',
    'user_sessions'
  ];

  for (const table of tablesToClear) {
    await pool.query(`TRUNCATE TABLE ${table}`).catch(async () => {
      await pool.query(`DELETE FROM ${table}`);
    });
    console.log(`✔ Cleared all rows from table: ${table}`);
  }

  // Clear non-superadmin users and recreate default SuperAdmin
  await pool.query('DELETE FROM users');
  const passwordHash = await hashPassword('superadmin123');
  await pool.query(
    'INSERT INTO users (id, name, email, role, password_hash, active, created_at) VALUES (1, ?, ?, ?, ?, 1, NOW())',
    ['Super Admin', 'info@enmar.bd', 'superadmin', passwordHash]
  );
  console.log('✔ Cleared test users. Fresh Superadmin created (info@enmar.bd / superadmin123)');

  await pool.query('SET FOREIGN_KEY_CHECKS = 1');
  console.log('--- Database Cleanup Complete! All tables are empty and ready for fresh input ---');
  process.exit(0);
}

cleanDatabase().catch(err => {
  console.error('Error during cleanup:', err);
  process.exit(1);
});
