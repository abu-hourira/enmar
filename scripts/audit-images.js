const pool = require('../config/db');
const fs = require('fs');
const path = require('path');

async function auditAllImages() {
  console.log('=== DATABASE IMAGE INTEGRITY AUDIT ===\n');
  const results = { ok: [], missing: [], externalOrSvg: [] };

  function checkPath(tableName, rowId, colName, url) {
    if (!url) return;
    if (typeof url !== 'string') {
      if (Array.isArray(url)) {
        url.forEach(u => checkPath(tableName, rowId, colName, u));
        return;
      }
      return;
    }
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image/')) {
      results.externalOrSvg.push({ tableName, rowId, colName, url: url.slice(0, 50) + '...' });
      return;
    }
    const cleanUrl = url.split('?')[0];
    const relPath = cleanUrl.startsWith('/') ? cleanUrl.slice(1) : cleanUrl;
    const absPath = path.join(__dirname, '..', relPath);
    const exists = fs.existsSync(absPath);
    if (exists) {
      results.ok.push({ tableName, rowId, colName, url });
    } else {
      results.missing.push({ tableName, rowId, colName, url, lookedIn: absPath });
    }
  }

  // 1. Products
  const [prods] = await pool.query('SELECT id, name, images, icon FROM products');
  prods.forEach(p => {
    let imgs = [];
    try { imgs = JSON.parse(p.images); } catch { imgs = p.images ? [p.images] : []; }
    if (Array.isArray(imgs)) {
      imgs.forEach(img => checkPath('products', p.id, 'images', img));
    }
  });

  // 2. Ad Media
  const [media] = await pool.query('SELECT id, url FROM ad_media');
  media.forEach(m => checkPath('ad_media', m.id, 'url', m.url));

  // 3. Ads
  const [ads] = await pool.query('SELECT id, name, image FROM ads');
  ads.forEach(a => checkPath('ads', a.id, 'image', a.image));

  // 4. Categories
  const [cats] = await pool.query('SELECT id, name, image FROM categories');
  cats.forEach(c => checkPath('categories', c.name, 'image', c.image));

  // 5. Users
  const [users] = await pool.query('SELECT id, name, avatar FROM users');
  users.forEach(u => checkPath('users', u.id, 'avatar', u.avatar));

  // 6. Settings
  const [settings] = await pool.query("SELECT setting_key, setting_val FROM store_settings WHERE setting_key LIKE '%logo%' OR setting_key LIKE '%image%' OR setting_key LIKE '%favicon%' OR setting_key LIKE '%banner%'");
  settings.forEach(s => checkPath('store_settings', s.setting_key, 'setting_val', s.setting_val));

  console.log(`✅ VALID IMAGES FOUND ON DISK (${results.ok.length}):`);
  console.log(JSON.stringify(results.ok, null, 2));

  console.log(`\n❌ MISSING IMAGES NOT FOUND ON DISK (${results.missing.length}):`);
  console.log(JSON.stringify(results.missing, null, 2));

  console.log(`\n🌐 EXTERNAL / SVG / DATA URIS (${results.externalOrSvg.length}):`);
  console.log(JSON.stringify(results.externalOrSvg, null, 2));
}

auditAllImages()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
