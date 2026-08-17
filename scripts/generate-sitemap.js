const fs = require('fs');
const path = require('path');
const db = require('../services/db-service');

async function generateSitemap() {
  try {
    const prods = await db.getAllProductsAdmin().catch(() => []);
    const baseUrl = 'https://enmar.shop';
    const now = new Date().toISOString().split('T')[0];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    const staticPages = [
      { path: '/', priority: '1.0', changefreq: 'daily' },
      { path: '/combos', priority: '0.9', changefreq: 'daily' },
      { path: '/checkout', priority: '0.7', changefreq: 'weekly' },
      { path: '/my-orders', priority: '0.6', changefreq: 'weekly' },
      { path: '/bmi-calculator', priority: '0.6', changefreq: 'monthly' }
    ];

    for (const sp of staticPages) {
      xml += `  <url>\n    <loc>${baseUrl}${sp.path}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>${sp.changefreq}</changefreq>\n    <priority>${sp.priority}</priority>\n  </url>\n`;
    }

    function slugify(text) {
      if (!text) return '';
      return String(text).toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
    }

    for (const p of prods) {
      const pDate = p.updatedAt ? new Date(p.updatedAt).toISOString().split('T')[0] : now;
      const slug = slugify(p.name);
      const prodPath = slug ? `/product/${p.id}-${slug}` : `/product/${p.id}`;
      xml += `  <url>\n    <loc>${baseUrl}${prodPath}</loc>\n    <lastmod>${pDate}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
    }

    xml += `</urlset>\n`;

    const target = path.join(__dirname, '..', 'sitemap.xml');
    fs.writeFileSync(target, xml, 'utf8');
    console.log(`[SEO] sitemap.xml generated with ${staticPages.length + prods.length} indexed URLs at ${target}`);
  } catch (err) {
    console.error('[SEO] Sitemap generation failed:', err.message);
  }
}

generateSitemap().then(() => process.exit(0));
