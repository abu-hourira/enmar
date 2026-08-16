// scripts/alter-ads-table.js
const pool = require('../config/db.js');

(async () => {
  try {
    await pool.query("ALTER TABLE ads MODIFY COLUMN title VARCHAR(200) NULL DEFAULT ''");
    await pool.query("ALTER TABLE ads MODIFY COLUMN bg LONGTEXT NULL");
    await pool.query("ALTER TABLE ads ADD COLUMN IF NOT EXISTS headline TEXT NULL");
    await pool.query("ALTER TABLE ads ADD COLUMN IF NOT EXISTS body TEXT NULL");
    await pool.query("ALTER TABLE ads ADD COLUMN IF NOT EXISTS button_text VARCHAR(100) NOT NULL DEFAULT 'Shop Now →'");
    await pool.query("ALTER TABLE ads ADD COLUMN IF NOT EXISTS button_cat VARCHAR(120) NOT NULL DEFAULT 'None'");
    console.log('Ads table altered successfully');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
