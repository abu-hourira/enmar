// scratch/test-db-query.js
const pool = require('../config/db.js');

async function test() {
  console.log('Testing live queries against MySQL enmar_db...');
  const [users] = await pool.query('SELECT id, name, email, role FROM users');
  console.log(`Found ${users.length} users:`, users);

  const [products] = await pool.query('SELECT id, name, price, category FROM products LIMIT 3');
  console.log('Sample products:', products);

  const [orders] = await pool.query('SELECT id, order_number, total, status FROM orders');
  console.log('Orders:', orders);

  await pool.end();
  console.log('✅ All MySQL queries executed successfully!');
}

test().catch(console.error);
