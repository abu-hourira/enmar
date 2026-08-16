// scripts/ensure-ads-columns.js
const pool = require('../config/db.js');

async function addCol(sql) {
  try {
    await pool.query(sql);
    console.log('Success:', sql);
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('Already exists:', sql);
    } else {
      console.error('Error on:', sql, err.message);
    }
  }
}

(async () => {
  await addCol("ALTER TABLE ads ADD COLUMN headline TEXT NULL");
  await addCol("ALTER TABLE ads ADD COLUMN body TEXT NULL");
  await addCol("ALTER TABLE ads ADD COLUMN button_text VARCHAR(100) NOT NULL DEFAULT 'Shop Now →'");
  await addCol("ALTER TABLE ads ADD COLUMN button_cat VARCHAR(120) NOT NULL DEFAULT 'None'");
  await addCol("ALTER TABLE ads ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
  process.exit(0);
})();
