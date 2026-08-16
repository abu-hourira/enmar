// scripts/set-superadmin.js
const crypto = require('crypto');
const pool = require('../config/db.js');

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return new Promise((resolve, reject) => {
    if (!password) return reject(new Error('Password is required for hashing'));
    crypto.scrypt(String(password), salt, 64, (error, derived) =>
      error ? reject(error) : resolve(`${salt}:${derived.toString('hex')}`));
  });
}

async function updateSuperAdmin(email, password, name) {
  if (!email || !email.includes('@')) {
    console.error('❌ Error: Please provide a valid email address.');
    console.log('Usage: node scripts/set-superadmin.js <email> <password> [name]');
    process.exit(1);
  }
  if (!password || password.length < 8) {
    console.error('❌ Error: Password must be at least 8 characters long.');
    console.log('Usage: node scripts/set-superadmin.js <email> <password> [name]');
    process.exit(1);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await hashPassword(password);

  console.log(`Connecting to MySQL database...`);
  const [existing] = await pool.query("SELECT id, name, email, role FROM users WHERE role = 'superadmin' LIMIT 1");

  if (existing && existing.length > 0) {
    const superUser = existing[0];
    const updateName = name ? name.trim() : superUser.name;
    await pool.query(
      "UPDATE users SET email = ?, password_hash = ?, name = ?, active = 1 WHERE id = ?",
      [normalizedEmail, passwordHash, updateName, superUser.id]
    );
    console.log(`\n✅ SUPERADMIN CREDENTIALS UPDATED IN DATABASE (enmar_db):`);
    console.log(`   ID:       ${superUser.id}`);
    console.log(`   Name:     ${updateName}`);
    console.log(`   Email:    ${normalizedEmail}`);
    console.log(`   Password: ${password}`);
    console.log(`   Role:     superadmin`);
    console.log(`   Hash:     ${passwordHash.slice(0, 20)}... (scrypt)\n`);
  } else {
    const adminName = name ? name.trim() : 'Super Administrator';
    const [result] = await pool.query(
      "INSERT INTO users (name, email, password_hash, role, active, created_at) VALUES (?, ?, ?, 'superadmin', 1, NOW())",
      [adminName, normalizedEmail, passwordHash]
    );
    console.log(`\n✅ SUPERADMIN CREATED IN DATABASE (enmar_db):`);
    console.log(`   ID:       ${result.insertId}`);
    console.log(`   Name:     ${adminName}`);
    console.log(`   Email:    ${normalizedEmail}`);
    console.log(`   Password: ${password}`);
    console.log(`   Role:     superadmin\n`);
  }

  process.exit(0);
}

const args = process.argv.slice(2);
const emailArg = args[0] || 'admin@example.com';
const passArg = args[1] || 'AdminPassword123!';
const nameArg = args[2] || undefined;

updateSuperAdmin(emailArg, passArg, nameArg).catch(err => {
  console.error('❌ Failed to update Superadmin in database:', err);
  process.exit(1);
});
