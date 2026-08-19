const pool = require('../config/db.js');

async function migrate() {
  try {
    console.log('Migrating ad_media and ads tables...');
    
    // 1. ad_media
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ad_media (
        id VARCHAR(80) NOT NULL,
        url LONGTEXT NOT NULL,
        type VARCHAR(40) NOT NULL DEFAULT 'image',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await pool.query("ALTER TABLE ad_media MODIFY COLUMN id VARCHAR(80) NOT NULL").catch(() => {});
    await pool.query("ALTER TABLE ad_media MODIFY COLUMN url LONGTEXT NOT NULL").catch(() => {});
    await pool.query("ALTER TABLE ad_media MODIFY COLUMN type VARCHAR(40) NOT NULL DEFAULT 'image'").catch(() => {});

    // 2. ads
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ads (
        id VARCHAR(80) NOT NULL,
        name VARCHAR(200) NOT NULL DEFAULT '',
        tag VARCHAR(100) NOT NULL DEFAULT '',
        title VARCHAR(200) NOT NULL DEFAULT '',
        sub VARCHAR(300) NOT NULL DEFAULT '',
        badge VARCHAR(100) NOT NULL DEFAULT '',
        bg LONGTEXT NULL,
        category_target VARCHAR(120) NOT NULL DEFAULT '',
        active TINYINT(1) NOT NULL DEFAULT 1,
        image LONGTEXT NULL,
        image_size INT NOT NULL DEFAULT 130,
        text_color VARCHAR(40) NOT NULL DEFAULT '#ffffff',
        headline TEXT NULL,
        body TEXT NULL,
        button_text VARCHAR(100) NOT NULL DEFAULT 'Shop Now →',
        button_cat VARCHAR(120) NOT NULL DEFAULT 'None',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const colsToAdd = [
      ['name', "VARCHAR(200) NOT NULL DEFAULT ''"],
      ['tag', "VARCHAR(100) NOT NULL DEFAULT ''"],
      ['title', "VARCHAR(200) NOT NULL DEFAULT ''"],
      ['sub', "VARCHAR(300) NOT NULL DEFAULT ''"],
      ['badge', "VARCHAR(100) NOT NULL DEFAULT ''"],
      ['bg', "LONGTEXT NULL"],
      ['category_target', "VARCHAR(120) NOT NULL DEFAULT ''"],
      ['active', "TINYINT(1) NOT NULL DEFAULT 1"],
      ['image', "LONGTEXT NULL"],
      ['image_size', "INT NOT NULL DEFAULT 130"],
      ['text_color', "VARCHAR(40) NOT NULL DEFAULT '#ffffff'"],
      ['headline', "TEXT NULL"],
      ['body', "TEXT NULL"],
      ['button_text', "VARCHAR(100) NOT NULL DEFAULT 'Shop Now →'"],
      ['button_cat', "VARCHAR(120) NOT NULL DEFAULT 'None'"]
    ];

    for (const [col, def] of colsToAdd) {
      await pool.query(`ALTER TABLE ads ADD COLUMN ${col} ${def}`).catch(() => {});
      await pool.query(`ALTER TABLE ads MODIFY COLUMN ${col} ${def}`).catch(() => {});
    }

    console.log('✅ Schema migration for ads & ad_media completed successfully.');
  } catch (err) {
    console.error('❌ Migration error:', err);
  }
}

migrate().then(() => process.exit(0));
