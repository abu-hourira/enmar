// scripts/set-permanent-superadmin.js
const crypto = require('node:crypto');
const pool = require('../config/db.js');

const SUPERADMIN_EMAIL = 'mdhourira6712@gmail.com';
const SUPERADMIN_PASSWORD = 'Abuhourira97@';
const SUPERADMIN_NAME = 'Super Administrator';

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(String(password), salt, 64, (error, derived) =>
      error ? reject(error) : resolve(`${salt}:${derived.toString('hex')}`));
  });
}

(async () => {
  try {
    const passwordHash = await hashPassword(SUPERADMIN_PASSWORD);
    
    // Check if user already exists
    const [existing] = await pool.query('SELECT * FROM users WHERE email = ?', [SUPERADMIN_EMAIL]);

    if (existing.length > 0) {
      await pool.query(
        'UPDATE users SET name = ?, password_hash = ?, role = "superadmin", active = 1 WHERE email = ?',
        [SUPERADMIN_NAME, passwordHash, SUPERADMIN_EMAIL]
      );
      console.log(`✅ Permanent Superadmin (${SUPERADMIN_EMAIL}) updated successfully with new credentials.`);
    } else {
      const [res] = await pool.query(
        'INSERT INTO users (name, email, password_hash, role, active, created_at) VALUES (?, ?, ?, "superadmin", 1, NOW())',
        [SUPERADMIN_NAME, SUPERADMIN_EMAIL, passwordHash]
      );
      console.log(`✅ Permanent Superadmin (${SUPERADMIN_EMAIL}) created successfully with ID ${res.insertId}.`);
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Error provisioning permanent superadmin:', err.message);
    process.exit(1);
  }
})();
