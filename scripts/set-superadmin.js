const pool = require('../config/db.js');
const crypto = require('crypto');

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return new Promise((resolve, reject) => {
    if (!password) return reject(new Error('Password required'));
    crypto.scrypt(String(password), salt, 64, (error, derived) =>
      error ? reject(error) : resolve(`${salt}:${derived.toString('hex')}`));
  });
}

async function setSuperAdmin() {
  const email = 'mdhourira6712@gmail.com';
  const rawPass = 'Abuhorira97@';
  const passwordHash = await hashPassword(rawPass);

  // Check if superadmin already exists
  const [existing] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
  if (existing.length > 0) {
    await pool.query(
      'UPDATE users SET password_hash = ?, role = "superadmin", active = 1 WHERE email = ?',
      [passwordHash, email]
    );
    console.log(`✔ Superadmin password updated for: ${email}`);
  } else {
    await pool.query(
      'INSERT INTO users (name, email, role, password_hash, active, created_at) VALUES (?, ?, "superadmin", ?, 1, NOW())',
      ['Super Administrator', email, passwordHash]
    );
    console.log(`✔ Superadmin account created for: ${email}`);
  }

  // Verify login immediately
  const [user] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
  console.log('User verified in database:', {
    id: user[0].id,
    name: user[0].name,
    email: user[0].email,
    role: user[0].role,
    active: user[0].active
  });

  process.exit(0);
}

setSuperAdmin().catch(err => {
  console.error('Error setting superadmin:', err);
  process.exit(1);
});
