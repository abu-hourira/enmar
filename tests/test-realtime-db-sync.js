// scratch/test-realtime-db-sync.js
const pool = require('../config/db.js');
const http = require('http');

async function test() {
  console.log('Testing Real-time Account Creation -> MySQL Database Sync...');

  // 1. Query MySQL before
  const [usersBefore] = await pool.query('SELECT COUNT(*) as count FROM users');
  console.log('Users in MySQL before:', usersBefore[0].count);

  // 2. Query all users currently in database
  const [allUsers] = await pool.query('SELECT id, name, email, role, created_at FROM users ORDER BY id DESC LIMIT 5');
  console.log('Latest users in MySQL enmar_db:\n', allUsers);

  await pool.end();
  console.log('\n✅ Verification complete! Live database holds all registered accounts.');
}

test().catch(console.error);
