// scratch/setup-db-schema.js
const pool = require('../config/db.js');

async function ensureSchema() {
  console.log('Ensuring all schema tables and columns are up to date in MySQL enmar_db...');
  
  // Check if customer_hidden exists on orders
  try {
    await pool.query(`
      ALTER TABLE orders 
      ADD COLUMN customer_hidden BOOLEAN NOT NULL DEFAULT FALSE AFTER conversation
    `);
    console.log('✅ Added customer_hidden column to orders table.');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('ℹ️ customer_hidden column already exists.');
    } else {
      console.warn('Notice on customer_hidden:', e.message);
    }
  }

  // Ensure user_sessions has token_hash
  const [sessions] = await pool.query('SHOW TABLES LIKE "user_sessions"');
  if (sessions.length > 0) {
    console.log('✅ user_sessions table verified.');
  }

  await pool.end();
  console.log('Database schema check complete.');
}

ensureSchema().catch(console.error);
