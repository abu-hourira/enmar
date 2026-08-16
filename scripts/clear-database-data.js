// scripts/clear-database-data.js
const pool = require('../config/db.js');

const TABLES = [
  'order_items',
  'orders',
  'reviews',
  'community_comments',
  'customer_notifications',
  'recycle_bin',
  'subscribers',
  'user_sessions',
  'products',
  'categories',
  'ads',
  'ad_media',
  'email_gateway_config',
  'store_settings',
  'users'
];

(async () => {
  const conn = await pool.getConnection();
  try {
    console.log('🔄 Disabling foreign key checks...');
    await conn.query('SET FOREIGN_KEY_CHECKS = 0;');

    for (const table of TABLES) {
      try {
        await conn.query(`TRUNCATE TABLE \`${table}\``);
        console.log(`  ✔ Emptied table: ${table}`);
      } catch (err) {
        console.warn(`  ⚠️ Could not truncate ${table}: ${err.message}`);
      }
    }

    console.log('🔄 Re-enabling foreign key checks...');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1;');

    console.log('\n✅ All tables kept intact and all table data successfully deleted.');
  } catch (err) {
    console.error('❌ Error clearing database:', err);
  } finally {
    conn.release();
    process.exit(0);
  }
})();
