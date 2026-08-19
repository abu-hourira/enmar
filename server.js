const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const net = require('node:net');
const tls = require('node:tls');
const zlib = require('node:zlib');
const emailEncryption = require('./services/email-encryption.js');

// ── ENV LOADER ──
(function loadDotEnv() {
  const home = os.homedir();
  const envCandidates = [
    path.join(__dirname, '.env'),
    path.join(process.cwd(), '.env'),
    path.join(home, 'enmar-web', '.env'),
    path.join(home, 'public_html', '.env'),
    path.join(home, 'repositories', 'enmar', '.env'),
    path.join(home, '.env'),
    '/home/enmarsho/enmar-web/.env',
    '/home/enmarsho/public_html/.env',
    '/home/enmarsho/repositories/enmar/.env',
    '/home/enmarsho/.env'
  ];
  for (const envPath of envCandidates) {
    try {
      if (!fs.existsSync(envPath)) continue;
      const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const eq = line.indexOf('=');
        if (eq === -1) continue;
        const key = line.slice(0, eq).trim();
        const value = line.slice(eq + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
        if (key && (process.env[key] === undefined || process.env[key] === '')) process.env[key] = value;
      }
    } catch { /* ignore */ }
  }
})();

const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const ROOT = path.resolve(__dirname);
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';

// ── STATIC FILE HANDLER ──
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.bmp': 'image/bmp',
  '.avif': 'image/avif',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf'
};

const SENSITIVE_PATTERNS = [
  /^\.env/,
  /\.sql$/i,
  /package(-lock)?\.json$/i,
  /^node_modules/,
  /^(scratch|tests|data|logs|config|services|database|scripts|docs)/i,
  /^\.git/,
  /^\.vscode/,
  /^(server|db|db-service|email-encryption|migrate-to-mysql|server-backup|test-db-callback|verify-mysql-data|reset-superadmin-password|fix-superadmin-email|diagnose-superadmin)\.js$/i
];

function getThemeStyleTag() {
  const settings = (store && store.settings) ? store.settings : {};
  const pr = settings.themePrimary || '#631e2a';
  const ac = settings.themeAccent || '#C0912E';
  
  function shade(hex, f) {
    const clean = String(hex || '').replace('#', '');
    const n = parseInt(clean, 16);
    if (isNaN(n)) return hex;
    const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
    const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
    const b = Math.min(255, Math.round((n & 255) * f));
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  }

  return `<style id="serverTheme">:root{--forest:${pr} !important;--forest-deep:${shade(pr, 0.72)} !important;--line-dark:${pr} !important;--gold:${ac} !important;}</style>`;
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function slugify(text) {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getProductUrl(p) {
  if (!p) return '/';
  const id = Number(p.id || p.productId);
  if (!id) return '/';
  const name = p.name || p.productName || '';
  const slug = slugify(name);
  return slug ? `/product/${id}-${slug}` : `/product/${id}`;
}

function findProductBySlugOrId(identifier) {
  if (!identifier || !store || !Array.isArray(store.products)) return null;
  const decoded = decodeURIComponent(String(identifier)).trim();
  
  // 1. Direct numeric match: 123
  if (/^\d+$/.test(decoded)) {
    const id = Number(decoded);
    return store.products.find(p => Number(p.id) === id) || null;
  }
  
  // 2. ID prefix match: 123-honey-jar
  const prefixMatch = decoded.match(/^(\d+)-/);
  if (prefixMatch) {
    const id = Number(prefixMatch[1]);
    const p = store.products.find(x => Number(x.id) === id);
    if (p) return p;
  }
  
  // 3. ID suffix match: honey-jar-123
  const suffixMatch = decoded.match(/-(\d+)$/);
  if (suffixMatch) {
    const id = Number(suffixMatch[1]);
    const p = store.products.find(x => Number(x.id) === id);
    if (p) return p;
  }
  
  // 4. Exact slug match on product name
  const targetSlug = slugify(decoded);
  return store.products.find(p => slugify(p.name) === targetSlug) || null;
}

function injectProductSeo(html, product, brandName = 'ENMAR') {
  if (!product) return html;
  const prodName = escapeHtml(product.name || 'Product');
  const fullTitle = `${prodName} — ${escapeHtml(brandName)}`;
  const rawDesc = product.description ? String(product.description).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : `Fresh organic produce from ${product.farm || brandName}.`;
  const metaDesc = escapeHtml(rawDesc.slice(0, 160));
  const productUrl = `https://enmar.shop${getProductUrl(product)}`;
  
  let firstImg = '';
  if (product.images && product.images.length) {
    firstImg = product.images[0].startsWith('http') ? product.images[0] : `https://enmar.shop${product.images[0]}`;
  }

  // 1. Update Title & Meta Title
  html = html.replace(/<title[^>]*>([^<]*)<\/title>/gi, `<title id="siteTitleTag">${fullTitle}</title>`);
  html = html.replace(/<meta[^>]*name=["']title["'][^>]*>/gi, `<meta name="title" id="metaTitle" content="${fullTitle}">`);

  // 2. Update Meta Description
  html = html.replace(/<meta[^>]*name=["']description["'][^>]*>/gi, `<meta name="description" content="${metaDesc}">`);

  // 3. Update or inject Canonical URL
  if (html.includes('id="canonicalLink"')) {
    html = html.replace(/<link[^>]*id=["']canonicalLink["'][^>]*>/gi, `<link rel="canonical" id="canonicalLink" href="${productUrl}">`);
  } else if (html.includes('</head>')) {
    html = html.replace('</head>', `  <link rel="canonical" id="canonicalLink" href="${productUrl}">\n</head>`);
  }

  // 4. Update / Inject OpenGraph & Twitter tags + Client Hydration Data
  const ogTags = `  <meta property="og:title" content="${fullTitle}">
  <meta property="og:description" content="${metaDesc}">
  <meta property="og:url" content="${productUrl}">
  <meta property="og:type" content="product">
  ${firstImg ? `<meta property="og:image" content="${firstImg}">` : ''}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${fullTitle}">
  <meta name="twitter:description" content="${metaDesc}">
  ${firstImg ? `<meta name="twitter:image" content="${firstImg}">` : ''}
  <script>window.__INITIAL_PRODUCT__ = ${JSON.stringify(product)};</script>`;

  if (html.includes('</head>')) {
    html = html.replace('</head>', `${ogTags}\n</head>`);
  }

  return html;
}

function injectServerBranding(html, filePath = '') {
  const settings = (store && store.settings) ? store.settings : {};
  const brandName = settings.brandName || '';
  const brandLogo = settings.brandLogo || '';
  const favicon = settings.favicon || '';
  const siteDesc = settings.siteDescription || settings.metaDescription || '';
  const footerTag = settings.footerTagline || '';
  const themeTag = getThemeStyleTag();

  // 1. Inject server theme style tag
  if (html.includes('</head>')) {
    html = html.replace('</head>', `${themeTag}\n</head>`);
  } else {
    html = themeTag + html;
  }

  // 2. Favicon injection
  if (favicon) {
    html = html.replace(/<link[^>]*id=["']siteFavicon["'][^>]*>/gi, `<link rel="icon" id="siteFavicon" href="${favicon}">`);
  }

  // 3. Brand name & Logo in Header
  if (brandName) {
    html = html.replace(/<span id=["']brandName["']>([^<]*)<\/span>/gi, `<span id="brandName">${brandName}</span>`);
    html = html.replace(/<meta[^>]*property=["']og:site_name["'][^>]*>/gi, `<meta property="og:site_name" content="${brandName}">`);
  }

  if (brandLogo) {
    html = html.replace(/<span id=["']logoIcon["']>([^<]*)<\/span>/gi, `<span id="logoIcon"><img class="logo-img" src="${brandLogo}" alt="${brandName}"></span>`);
  }

  // 4. Meta Description injection
  if (siteDesc) {
    html = html.replace(/<meta[^>]*name=["']description["'][^>]*>/gi, `<meta name="description" content="${siteDesc}">`);
    html = html.replace(/<meta[^>]*property=["']og:description["'][^>]*>/gi, `<meta property="og:description" content="${siteDesc}">`);
    html = html.replace(/<meta[^>]*name=["']twitter:description["'][^>]*>/gi, `<meta name="twitter:description" content="${siteDesc}">`);
  }

  // 5. Title Tag injection
  const isHome = !filePath || filePath.endsWith('index.html') || filePath.endsWith('index');
  const targetTitle = settings.siteTitle || brandName || '';
  if (isHome && targetTitle) {
    html = html.replace(/<title[^>]*>([^<]*)<\/title>/gi, `<title id="siteTitleTag">${targetTitle}</title>`);
    html = html.replace(/<meta[^>]*name=["']title["'][^>]*>/gi, `<meta name="title" id="metaTitle" content="${targetTitle}">`);
    html = html.replace(/<meta[^>]*property=["']og:title["'][^>]*>/gi, `<meta property="og:title" content="${targetTitle}">`);
    html = html.replace(/<meta[^>]*name=["']twitter:title["'][^>]*>/gi, `<meta name="twitter:title" content="${targetTitle}">`);
  } else if (brandName && !(filePath && filePath.includes('product.html'))) {
    html = html.replace(/<title[^>]*>([^<]*)<\/title>/gi, (match, currentTitle) => {
      if (currentTitle.includes(' | ')) {
        const parts = currentTitle.split(' | ');
        return `<title>${brandName} | ${parts.slice(1).join(' | ')}</title>`;
      }
      if (currentTitle.includes(' — ')) {
        const parts = currentTitle.split(' — ');
        return `<title>${parts[0]} — ${brandName}</title>`;
      }
      return `<title>${brandName} — ${currentTitle}</title>`;
    });
  }

  // 6. Footer Tagline injection
  if (footerTag) {
    html = html.replace(/<span id=["']footerTagline["']>([^<]*)<\/span>/gi, `<span id="footerTagline">${footerTag}</span>`);
  }

  return html;
}

function sendCompressed(req, res, statusCode, headers, buffer) {
  const accept = (req && req.headers && req.headers['accept-encoding']) || '';
  if (buffer && buffer.length > 512) {
    if (accept.includes('gzip')) {
      zlib.gzip(buffer, (err, compressed) => {
        if (!err && compressed) {
          headers['Content-Encoding'] = 'gzip';
          headers['Content-Length'] = compressed.length;
          headers['Vary'] = 'Accept-Encoding';
          res.writeHead(statusCode, headers);
          if (req.method === 'HEAD') return res.end();
          return res.end(compressed);
        }
        headers['Content-Length'] = buffer.length;
        res.writeHead(statusCode, headers);
        if (req.method === 'HEAD') return res.end();
        res.end(buffer);
      });
      return true;
    } else if (accept.includes('deflate')) {
      zlib.deflate(buffer, (err, compressed) => {
        if (!err && compressed) {
          headers['Content-Encoding'] = 'deflate';
          headers['Content-Length'] = compressed.length;
          headers['Vary'] = 'Accept-Encoding';
          res.writeHead(statusCode, headers);
          if (req.method === 'HEAD') return res.end();
          return res.end(compressed);
        }
        headers['Content-Length'] = buffer.length;
        res.writeHead(statusCode, headers);
        if (req.method === 'HEAD') return res.end();
        res.end(buffer);
      });
      return true;
    }
  }
  headers['Content-Length'] = (buffer && buffer.length) || 0;
  res.writeHead(statusCode, headers);
  if (req.method === 'HEAD') return res.end();
  res.end(buffer);
  return true;
}

function resolveExistingFile(relPath) {
  if (!relPath) return null;
  const clean = String(relPath).replace(/^\/+/, '');
  const home = os.homedir();
  const roots = [
    ROOT,
    __dirname,
    process.cwd(),
    path.join(__dirname, '..'),
    path.join(process.cwd(), '..'),
    path.join(ROOT, 'public_html'),
    path.join(__dirname, 'public_html'),
    path.join(process.cwd(), 'public_html'),
    path.join(home, 'enmar-web'),
    path.join(home, 'public_html'),
    path.join(home, 'repositories', 'enmar'),
    path.join(home, 'enmar'),
    path.join(home, 'app'),
    home,
    '/home/enmarsho/enmar-web',
    '/home/enmarsho/public_html',
    '/home/enmarsho/repositories/enmar',
    '/home/enmarsho/enmar',
    '/home/enmarsho/app',
    '/home/enmarsho'
  ].filter((v, i, a) => v && typeof v === 'string' && a.indexOf(v) === i);

  for (const r of roots) {
    try {
      const full = path.resolve(r, clean);
      if (fs.existsSync(full) && fs.statSync(full).isFile()) {
        return full;
      }
    } catch {}
  }
  return null;
}

async function tryServeStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  if (pathname.startsWith('/api/')) return false;

  // Root / index request
  if (pathname === '/' || pathname === '' || pathname === '/index') {
    const indexPath = resolveExistingFile('index.html');
    if (indexPath) {
      let html = fs.readFileSync(indexPath, 'utf8');
      html = injectServerBranding(html, indexPath);
      const buf = Buffer.from(html, 'utf8');
      return sendCompressed(req, res, 200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache'
      }, buf);
    }
  }

  if (pathname === '/admin' || pathname === '/admin/') {
    res.writeHead(302, { 'Location': '/admin/dashboard' });
    res.end();
    return true;
  }

  // Explicit Admin Pages Routing (/admin/dashboard, /admin/products, /admin/orders, /admin/settings, /admin/apis, etc.)
  if (pathname.startsWith('/admin/') && !pathname.includes('.')) {
    const page = pathname.replace(/^\/admin\//, '').replace(/\/+$/, '');
    const adminHtmlPath = resolveExistingFile(`admin/${page}.html`) || resolveExistingFile(`admin/${page}`) || resolveExistingFile('admin/dashboard.html');
    if (adminHtmlPath) {
      let html = fs.readFileSync(adminHtmlPath, 'utf8');
      html = injectServerBranding(html, adminHtmlPath);
      const buf = Buffer.from(html, 'utf8');
      return sendCompressed(req, res, 200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache'
      }, buf);
    }
  }

  // Explicit Frontend Pages Routing (/checkout, /my-orders, /bmi-calculator, /receipt, /about, etc.)
  if (!pathname.includes('.')) {
    const pageMatch = pathname.match(/^\/([a-zA-Z0-9_-]+)$/);
    if (pageMatch) {
      const pageName = pageMatch[1];
      const pageHtmlPath = resolveExistingFile(`pages/${pageName}.html`) || resolveExistingFile(`${pageName}.html`);
      if (pageHtmlPath) {
        let html = fs.readFileSync(pageHtmlPath, 'utf8');
        html = injectServerBranding(html, pageHtmlPath);
        const buf = Buffer.from(html, 'utf8');
        return sendCompressed(req, res, 200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache'
        }, buf);
      }
    }
  }

  // Automatic 301 Permanent Redirect for any direct .html requests to clean URLs
  if (pathname.endsWith('.html') || pathname.endsWith('.htm')) {
    const rawClean = pathname.replace(/\.html?$/i, '');
    let target = rawClean.startsWith('/pages/') ? rawClean.replace(/^\/pages\//, '/') : rawClean;
    if (target === '/index') target = '';
    if (!target) target = '/';
    
    let redirectUrl = target;
    if (req.url && req.url.includes('?')) {
      redirectUrl += '?' + req.url.split('?')[1];
    }
    
    res.writeHead(301, {
      'Location': redirectUrl,
      'Cache-Control': 'no-cache'
    });
    res.end();
    return true;
  }

  // Clean product route: /product/:slugOrId or /products/:slugOrId
  const prodRouteMatch = pathname.match(/^\/products?\/([^\/?#]+)$/i);
  if (prodRouteMatch) {
    const ident = decodeURIComponent(prodRouteMatch[1]);
    let product = findProductBySlugOrId(ident);
    // DB fallback if in-memory store misses
    if (!product) {
      const numMatch = ident.match(/^(\d+)/) || ident.match(/-(\d+)$/);
      if (numMatch) {
        try {
          product = await dbService.getProductById(Number(numMatch[1]));
        } catch {}
      }
    }
    const prodHtmlPath = resolveExistingFile('pages/product.html') || resolveExistingFile('product.html');
    if (prodHtmlPath) {
      let html = fs.readFileSync(prodHtmlPath, 'utf8');
      const settings = (store && store.settings) ? store.settings : {};
      const brandName = settings.brandName || 'ENMAR';
      html = injectServerBranding(html, prodHtmlPath);
      if (product) {
        html = injectProductSeo(html, product, brandName);
      }
      const buf = Buffer.from(html, 'utf8');
      return sendCompressed(req, res, 200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache'
      }, buf);
    }
  }

  // Legacy /product or /products with query parameter ?id=...
  if (pathname === '/product' || pathname === '/product/' || pathname === '/products' || pathname === '/products/') {
    const queryStr = (req.url && req.url.includes('?')) ? req.url.split('?')[1] : '';
    const params = new URLSearchParams(queryStr);
    const qId = params.get('id') || params.get('slug') || params.get('productId');
    if (qId) {
      const product = findProductBySlugOrId(qId);
      if (product) {
        res.writeHead(301, {
          'Location': getProductUrl(product),
          'Cache-Control': 'no-cache'
        });
        res.end();
        return true;
      }
    }
  }

  // Clean category route: /category/:slug
  const catRouteMatch = pathname.match(/^\/category\/([^\/?#]+)$/i);
  if (catRouteMatch) {
    const catSlug = catRouteMatch[1];
    const indexPath = resolveExistingFile('index.html');
    if (indexPath) {
      let html = fs.readFileSync(indexPath, 'utf8');
      html = injectServerBranding(html, indexPath);
      const catScript = `<script>window.__INITIAL_CATEGORY__ = ${JSON.stringify(catSlug)};</script>`;
      if (html.includes('</head>')) {
        html = html.replace('</head>', `${catScript}\n</head>`);
      }
      const buf = Buffer.from(html, 'utf8');
      return sendCompressed(req, res, 200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache'
      }, buf);
    }
  }

  // Convenience URL shortcuts
  if (pathname === '/cart' || pathname === '/cart/') {
    res.writeHead(302, { 'Location': '/checkout' });
    res.end();
    return true;
  }
  if (pathname === '/login' || pathname === '/login/') {
    res.writeHead(302, { 'Location': '/?login=1' });
    res.end();
    return true;
  }
  if (pathname === '/register' || pathname === '/register/') {
    res.writeHead(302, { 'Location': '/?login=1&mode=register' });
    res.end();
    return true;
  }

  const cleanPath = pathname.replace(/^\/+/, '').replace(/\/+$/, '');
  
  if (!cleanPath) {
    const indexPath = resolveExistingFile('index.html');
    if (indexPath) {
      let html = fs.readFileSync(indexPath, 'utf8');
      html = injectServerBranding(html, indexPath);
      const buf = Buffer.from(html, 'utf8');
      return sendCompressed(req, res, 200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache'
      }, buf);
    }
    return false;
  }

  const home = os.homedir();
  const searchRoots = [
    ROOT,
    __dirname,
    process.cwd(),
    path.join(__dirname, '..'),
    path.join(ROOT, 'public_html'),
    path.join(__dirname, 'public_html'),
    path.join(process.cwd(), 'public_html'),
    path.join(home, 'enmar-web'),
    path.join(home, 'public_html'),
    path.join(home, 'repositories', 'enmar'),
    path.join(home, 'enmar'),
    path.join(home, 'app'),
    home,
    '/home/enmarsho/enmar-web',
    '/home/enmarsho/public_html',
    '/home/enmarsho/repositories/enmar'
  ].filter((v, i, a) => v && typeof v === 'string' && a.indexOf(v) === i);

  const candidates = [];
  for (const r of searchRoots) {
    candidates.push(
      path.join(r, cleanPath),
      path.join(r, cleanPath + '.html'),
      path.join(r, 'pages', cleanPath),
      path.join(r, 'pages', cleanPath + '.html'),
      cleanPath.startsWith('pages/') ? path.join(r, cleanPath.replace(/^pages\//, '') + '.html') : null,
      cleanPath.startsWith('admin/') ? path.join(r, 'admin', cleanPath.replace(/^admin\//, '') + '.html') : path.join(r, 'admin', cleanPath + '.html'),
      path.join(r, cleanPath, 'index.html')
    );
  }
  const cleanCandidates = candidates.filter(Boolean);

  let finalPath = null;
  let stat = null;

  for (const cand of cleanCandidates) {
    const resolvedPath = path.resolve(cand);
    const relPath = path.relative(ROOT, resolvedPath).replace(/\\/g, '/');
    if (SENSITIVE_PATTERNS.some(pat => pat.test(relPath))) continue;

    try {
      const s = fs.statSync(resolvedPath);
      if (s.isFile()) {
        finalPath = resolvedPath;
        stat = s;
        break;
      }
    } catch {}
  }

  if (!finalPath || !stat) return false;

  const ext = path.extname(finalPath).toLowerCase();
  const mimeType = MIME_TYPES[ext];
  if (!mimeType) return false;

  if (ext === '.html' || ext === '.htm') {
    let html = fs.readFileSync(finalPath, 'utf8');
    html = injectServerBranding(html, finalPath);
    const buf = Buffer.from(html, 'utf8');
    return sendCompressed(req, res, 200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache'
    }, buf);
  }

  const isTextType = ['.css', '.js', '.json', '.svg', '.txt', '.map'].includes(ext);
  if (isTextType) {
    const fileBuf = fs.readFileSync(finalPath);
    return sendCompressed(req, res, 200, {
      'Content-Type': mimeType,
      'Cache-Control': 'public, max-age=31536000, immutable'
    }, fileBuf);
  }

  res.writeHead(200, {
    'Content-Type': mimeType,
    'Content-Length': stat.size,
    'Cache-Control': 'public, max-age=31536000, immutable'
  });

  if (req.method === 'HEAD') {
    res.end();
    return true;
  }

  fs.createReadStream(finalPath).pipe(res);
  return true;
}

// ── CONFIG ──
const PERMANENT_SUPERADMIN_EMAIL = 'mdhourira6712@gmail.com';
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD || 'Abuhorira97@';
const RESERVED_ACCOUNTS = [
  { name: 'Super Administrator', email: process.env.SUPERADMIN_EMAIL || PERMANENT_SUPERADMIN_EMAIL, password: SUPERADMIN_PASSWORD, role: 'superadmin' }
];

// ── DATABASE ──
const dbService = require('./services/db-service.js');
let dbPool = null;
const sessions = new Map();

// ── SMART REAL-TIME NOTIFICATIONS (SSE) ──
const sseClients = new Set();

async function broadcastSmartNotification({ event = 'notification', targetRole = 'all', userId = null, type = 'announcement', title, message, link = '', image = '', productId = null, payload = null }) {
  const notifObj = await dbService.createNotification({
    userId,
    targetRole,
    type,
    title,
    message,
    link,
    image,
    productId
  }).catch(() => ({
    id: Date.now(),
    userId,
    targetRole,
    type,
    title,
    message,
    link,
    image,
    createdAt: new Date().toISOString()
  }));

  const dataToSend = JSON.stringify(payload || notifObj);
  const eventMsg = `event: ${event}\ndata: ${dataToSend}\n\n`;

  for (const client of sseClients) {
    try {
      const clientRole = client.user?.role || 'customer';
      const clientUserId = client.user?.id || null;
      const isAdminClient = ['superadmin', 'admin', 'manager', 'staff'].includes(clientRole);

      let shouldSend = false;
      if (targetRole === 'all') {
        shouldSend = true;
      } else if (targetRole === 'admin' || targetRole === 'staff') {
        shouldSend = isAdminClient;
      } else if (targetRole === 'customer') {
        if (userId) {
          shouldSend = clientUserId === userId;
        } else {
          shouldSend = true;
        }
      }

      if (shouldSend) {
        client.res.write(eventMsg);
      }
    } catch {
      sseClients.delete(client);
    }
  }

  return notifObj;
}

try {
  dbPool = require('./config/db.js');
  (async () => {
    try {
      const conn = await dbPool.getConnection();
      await conn.ping();
      conn.release();
      console.log('[MySQL] ✅ Database connection verified on startup.');
    } catch (err) {
      console.error('[MySQL] ⚠️ Database connection warning:', err.message);
    }
  })();
} catch (e) {
  console.error('[MySQL] ⚠️ Failed to load database pool:', e.message);
}

let lastDbCheckTime = 0;
let lastDbCheckResult = false;
async function isDbConnected() {
  const now = Date.now();
  if (now - lastDbCheckTime < 2000) {
    return lastDbCheckResult;
  }
  if (!dbPool) {
    lastDbCheckResult = false;
    lastDbCheckTime = now;
    return false;
  }
  try {
    const conn = await dbPool.getConnection();
    await conn.ping();
    conn.release();
    lastDbCheckTime = Date.now();
    lastDbCheckResult = true;
    return true;
  } catch (err) {
    lastDbCheckTime = Date.now();
    lastDbCheckResult = false;
    return false;
  }
}

// ── STORE ──
async function readStore() {
  await dbService.ensureStoreSettings().catch(() => {});
  try {
    await dbService.ensureSessionsTable();
    if (dbPool) {
      const [sessRows] = await dbPool.query('SELECT * FROM user_sessions WHERE expires > ?', [Date.now()]);
      sessRows.forEach(r => {
        sessions.set(r.token, { userId: Number(r.user_id), expires: Number(r.expires) });
      });
    }
  } catch {}

  // Auto-seed default categories if database is empty
  try {
    const existingCats = await dbService.getCategories().catch(() => []);
    if (!existingCats || existingCats.length === 0) {
      const defaultCats = [
        { name: 'Honey & Sweeteners', icon: 'honey' },
        { name: 'Oils & Ghee', icon: 'oil' },
        { name: 'Rice & Grains', icon: 'grain' },
        { name: 'Organic Spices', icon: 'spice' },
        { name: 'Dairy & Eggs', icon: 'egg' },
        { name: 'Fresh Fruits', icon: 'apple' },
        { name: 'Vegetables', icon: 'leaf' },
        { name: 'Nuts & Seeds', icon: 'nuts' }
      ];
      for (const c of defaultCats) {
        await dbService.createCategory(c).catch(() => {});
      }
    }
  } catch {}

  // Auto-seed default products if database is empty
  try {
    let prodsInDb = await dbService.getAllProductsAdmin().catch(() => []);
    if (!prodsInDb || prodsInDb.length === 0) {
      const defaultProds = [
        {
          id: 4,
          name: 'Sundarban Raw Organic Honey',
          farm: 'Sundarban Forest API Co-op',
          price: 950,
          unit: '500g jar',
          cat: 'Honey & Sweeteners',
          icon: 'droplet',
          tag: '10% OFF',
          lot: 'SB-2026-04',
          discount: 10,
          description: `**১০০% খাঁটি ও প্রাকৃতিক সুন্দরবনের চাকভাঙা কাঁচা মধু (Sundarban Wild Raw Honey)**\n\nসুন্দরবনের গভীর ম্যানগ্রোভ বনাঞ্চল থেকে সরাসরি মৌয়ালদের দ্বারা প্রাকৃতিকভাবে সংগৃহীত খাঁটি মধু। এতে কোনো প্রকার প্রসেসিং বা হিটিং করা হয় না, ফলে মধুর প্রাকৃতিক গুণাগুণ ও এনজাইম অক্ষুণ্ণ থাকে।\n\n### বৈশিষ্ট্য ও উপকারিতা:\n- সম্পূর্ণ নির্ভেজাল, প্রাকৃতিক এবং অপরিশোধিত\n- রোগ প্রতিরোধ ক্ষমতা ও এনার্জি বৃদ্ধিতে অত্যন্ত কার্যকর\n- সর্দি-কাশি ও গলার খুসখুস দূর করতে সাহায্য করে\n- প্রাকৃতিক অ্যান্টিঅক্সিডেন্ট ও মিনারেল সমৃদ্ধ\n\n**সংরক্ষণ পদ্ধতি:** সাধারণ তাপমাত্রায় শুষ্ক স্থানে রাখুন। ফ্রিজে রাখার প্রয়োজন নেই।`,
          images: [],
          active: true
        },
        {
          id: 5,
          name: 'Cold Pressed Pure Mustard Oil',
          farm: 'Natore Organic Agro',
          price: 380,
          unit: '1 Litre',
          cat: 'Oils & Ghee',
          icon: 'sun',
          tag: '5% OFF',
          lot: 'NT-2026-09',
          discount: 5,
          description: `**ঘানি-ভাঙা খাঁটি সরিষার তেল (Cold Pressed Pure Mustard Oil)**\n\nনাটোরের সেরা বাছাইকৃত দেশি সরিষার বীজ থেকে কাঠের ঘানিতে ভাঙানো ১০০% খাঁটি ও সুগন্ধযুক্ত সরিষার তেল। কোনো প্রকার রাসায়নিক বা ভেজাল মিশ্রণ ছাড়া প্রস্তুত।\n\n### বৈশিষ্ট্য ও উপকারিতা:\n- কাঠের ঘানিতে ভাঙা ও কোল্ড প্রেসড প্রসেসে তৈরি\n- খাঁটি ঝাঁঝ ও ঐতিহ্যবাহী প্রাকৃতিক স্বাদ\n- রান্নার স্বাদ ও পুষ্টিগুণ বাড়ায়\n- হার্ট ও রক্ত সঞ্চালনের জন্য উপকারী\n\n**উৎপাদন:** নাটোর অর্গানিক এগ্রো ফার্ম`,
          images: [],
          active: true
        },
        {
          id: 6,
          name: 'Organic Premium Nazirshail Rice',
          farm: 'Dinajpur Heritage Farms',
          price: 420,
          unit: '5kg pack',
          cat: 'Rice & Grains',
          icon: 'box',
          tag: 'Organic',
          lot: 'DJ-2026-01',
          discount: 0,
          description: `**প্রিমিয়াম অর্গানিক নাজিরশাইল চাল (Organic Premium Nazirshail Rice)**\n\nদিনাজপুরের ঐতিহ্যবাহী উর্বর জমিতে কোনো রাসায়নিক সার ও কীটনাশক ছাড়া সম্পূর্ণ প্রাকৃতিক উপায়ে উৎপাদিত দীর্ঘ দানাদার সুগন্ধি নাজিরশাইল চাল।\n\n### বৈশিষ্ট্য ও উপকারিতা:\n- সুস্বাদু, ঝরঝরে ও সহজে হজমযোগ্য\n- ডায়েটারি ফাইবার ও পুষ্টি উপাদান সমৃদ্ধ\n- দৈনিক স্বাস্থ্যকর আহারের জন্য আদর্শ চাল\n- ১০০% কেমিক্যাল ও পলিশমুক্ত\n\n**উৎপাদন:** দিনাজপুর হেরিটেজ ফার্মস`,
          images: [],
          active: true
        },
        {
          id: 25,
          name: 'প্রিমিয়াম অর্গানিক ড্রাই ফ্রুটস ও নাটস কম্বো',
          farm: 'ENMAR Organic Farms',
          price: 850,
          unit: '500g pack',
          cat: 'Nuts & Seeds',
          icon: 'nuts',
          tag: 'Popular',
          lot: 'EM-2026-25',
          discount: 0,
          description: `**প্রিমিয়াম অর্গানিক মিক্সড ড্রাই ফ্রুটস ও নাটস (Organic Mixed Dry Fruits & Nuts)**\n\nবাছাইকৃত সেরা মানের কাঠবাদাম, কাজুবাদাম, পেস্তাবাদাম, আখরোট, কিশমিশ এবং প্রিমিয়াম আনজিরের পুষ্টিকর ও সুস্বাদু মিশ্রণ।\n\n### বৈশিষ্ট্য ও উপকারিতা:\n- ভিটামিন, মিনারেল ও স্বাস্থ্যকর ফ্যাটের প্রাকৃতিক উৎস\n- মস্তিষ্কের কার্যক্ষমতা ও শারীরিক শক্তি বৃদ্ধি করে\n- স্বাস্থ্যকর স্ন্যাক্স হিসেবে অত্যন্ত উপযুক্ত\n- ১০০% ফ্রেশ ও ক্রিস্পি প্যাকেজিং`,
          images: [],
          active: true
        }
      ];
      for (const p of defaultProds) {
        await dbService.createProduct(p).catch(() => {});
      }
    }
  } catch {}

  const users = await dbService.getAllUsers();
  const products = await dbService.getAllProductsAdmin();
  const orders = await dbService.getAllOrdersAdmin();
  const settingsData = await dbService.getStoreSettings();
  const settings = settingsData?.settings || settingsData || {};
  const subscribers = await dbService.getSubscribers().catch(() => []);
  
  const store = {
    users: users || [],
    products: products || [],
    orders: orders || [],
    subscribers: subscribers || [],
    settings: settings || {},
    nextIds: {
      user: users.length > 0 ? Math.max(...users.map(u => u.id), 0) + 1 : 1,
      product: products.length > 0 ? Math.max(...products.map(p => p.id), 0) + 1 : 1,
      order: orders.length > 0 ? Math.max(...orders.map(o => o.id), 0) + 1 : 1,
      review: 1
    }
  };

  const account = RESERVED_ACCOUNTS[0];
  let existingSuper = store.users.find(u => String(u.email).toLowerCase() === account.email.toLowerCase());
  const superPassHash = await hashPassword(account.password);
  if (!existingSuper) {
    const created = await dbService.createUser({
      name: account.name,
      email: account.email,
      passwordHash: superPassHash,
      role: 'superadmin',
      active: true
    }).catch(() => null);
    if (created) {
      store.users.push(created);
    }
  } else {
    existingSuper.passwordHash = superPassHash;
    existingSuper.role = 'superadmin';
    existingSuper.active = true;
    await dbService.updateUser(existingSuper.id, { passwordHash: superPassHash, role: 'superadmin', active: true }).catch(() => {});
  }

  return store;
}

// ── PASSWORD HASHING ──
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return new Promise((resolve, reject) => {
    if (!password) return reject(new Error('Password required'));
    crypto.scrypt(String(password), salt, 64, (error, derived) =>
      error ? reject(error) : resolve(`${salt}:${derived.toString('hex')}`));
  });
}

function verifyPassword(password, stored) {
  if (!password || !stored) return Promise.resolve(false);
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return Promise.resolve(false);
  return new Promise((resolve, reject) => crypto.scrypt(String(password), salt, 64, (error, derived) => {
    if (error) return reject(error);
    try {
      resolve(crypto.timingSafeEqual(Buffer.from(hash, 'hex'), derived));
    } catch {
      resolve(false);
    }
  }));
}

// ── UTILITIES ──
function cookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map(v => {
    const i = v.indexOf('=');
    return [v.slice(0, i).trim(), decodeURIComponent(v.slice(i + 1))];
  }));
}

function currentUser(req, store) {
  const token = cookies(req).hm_session;
  if (!token) return null;
  const session = sessions.get(token);
  return session && session.expires > Date.now() ? store.users.find(u => u.id === session.userId && u.active) : null;
}

// ── Minimal dependency-free multipart/form-data parser ──
// Populates `fields` (text inputs) and `files` (with { field, filename, mime, buffer }).
// Supports multi-value fields (e.g. several `images` entries) by storing arrays.
function parseMultipart(buffer, contentType) {
  const fields = {};
  const files = [];
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  if (!boundaryMatch) return { fields, files };
  const boundary = '--' + (boundaryMatch[1] || boundaryMatch[2]).trim();
  const delimiter = Buffer.from(boundary);

  // Split buffer on the boundary delimiter.
  const parts = [];
  let start = buffer.indexOf(delimiter);
  while (start !== -1) {
    const next = buffer.indexOf(delimiter, start + delimiter.length);
    if (next === -1) break;
    if (buffer[start + delimiter.length] === 0x2d && buffer[start + delimiter.length + 1] === 0x2d) break; // "--" closing
    // The part is between the end of this boundary line and the next boundary.
    const headerStart = start + delimiter.length;
    // find end of headers (\r\n\r\n)
    const headerEnd = buffer.indexOf('\r\n\r\n', headerStart);
    if (headerEnd === -1) { start = next; continue; }
    const rawHeaders = buffer.toString('utf8', headerStart, headerEnd);
    // Body content ends 2 bytes before next boundary (trailing \r\n).
    let contentEnd = next - 2;
    if (buffer[next - 1] === 0x0a && buffer[next - 2] === 0x0d) contentEnd = next - 2;
    else if (buffer[next - 1] === 0x0d) contentEnd = next - 1;
    const content = buffer.slice(headerEnd + 4, contentEnd);
    parts.push({ rawHeaders, content });
    start = next;
  }

  for (const part of parts) {
    const cd = /content-disposition:[^\r\n]*/i.exec(part.rawHeaders);
    if (!cd) continue;
    const nameMatch = /name="([^"]*)"/i.exec(cd[0]);
    const fileMatch = /filename="([^"]*)"/i.exec(cd[0]);
    if (!nameMatch) continue;
    const name = nameMatch[1];
    const mimeMatch = /content-type:\s*([^\r\n]+)/i.exec(part.rawHeaders);
    if (fileMatch && fileMatch[1]) {
      files.push({
        field: name,
        filename: fileMatch[1],
        mime: mimeMatch ? mimeMatch[1].trim() : 'application/octet-stream',
        buffer: part.content
      });
    } else {
      if (!(name in fields)) fields[name] = part.content.toString('utf8');
      else if (Array.isArray(fields[name])) fields[name].push(part.content.toString('utf8'));
      else fields[name] = [fields[name], part.content.toString('utf8')];
    }
  }
  return { fields, files };
}

// ── Save uploaded multipart files as product images under /uploads ──
// Returns an array of public URLs (e.g. "/uploads/products/abc.jpg").
const UPLOAD_ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/bmp', 'image/svg+xml']);
function saveUploadedImages(files) {
  if (!files || !files.length) return [];
  const dir = path.join(ROOT, 'uploads', 'products');
  try { fs.mkdirSync(dir, { recursive: true }); } catch { /* exists */ }
  const urls = [];
  for (const f of files) {
    if (f.field !== 'images' || !f.buffer || !f.buffer.length) continue;
    const mime = f.mime || 'application/octet-stream';
    if (!UPLOAD_ALLOWED_MIME.has(mime)) continue;
    const ext = ({
      'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
      'image/avif': 'avif', 'image/bmp': 'bmp', 'image/svg+xml': 'svg'
    })[mime] || 'bin';
    const safeBase = (f.filename || 'img').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.[^.]+$/, '');
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeBase}.${ext}`;
    fs.writeFileSync(path.join(dir, fileName), f.buffer);
    urls.push(`/uploads/products/${fileName}`);
  }
  return urls;
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function setSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = Date.now() + 7 * 86400000;
  sessions.set(token, { userId, expires });
  dbService.createSession(userId, token, expires).catch(() => {});
  const secure = IS_PROD ? '; Secure' : '';
  res.setHeader('Set-Cookie', `hm_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${secure}`);
  return token;
}

function clearSession(req, res) {
  const token = cookies(req).hm_session;
  if (token) {
    sessions.delete(token);
    dbService.deleteSession(token).catch(() => {});
  }
  const secure = IS_PROD ? '; Secure' : '';
  res.setHeader('Set-Cookie', `hm_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`);
}

// ── EMAIL / OTP ──
const emailOtpStore = new Map();
const passwordResetOtpStore = new Map();
const rateLimitStore = new Map();

async function createEmailOtp(email) {
  const code = String(crypto.randomInt(100000, 1000000));
  emailOtpStore.set(String(email).toLowerCase().trim(), {
    hash: await hashPassword(code),
    expires: Date.now() + 10 * 60 * 1000,
    attempts: 0
  });
  return code;
}

async function verifyEmailOtp(email, code) {
  const norm = String(email || '').toLowerCase().trim();
  const entry = emailOtpStore.get(norm);
  if (!entry) return false;
  if (entry.expires < Date.now()) { emailOtpStore.delete(norm); return false; }
  entry.attempts += 1;
  if (entry.attempts > 5) { emailOtpStore.delete(norm); return false; }
  const ok = await verifyPassword(String(code).trim(), entry.hash).catch(() => false);
  if (ok) emailOtpStore.delete(norm);
  return ok;
}

async function createPasswordResetOtp(email) {
  const code = String(crypto.randomInt(100000, 1000000));
  passwordResetOtpStore.set(String(email).toLowerCase().trim(), {
    hash: await hashPassword(code),
    expires: Date.now() + 10 * 60 * 1000,
    attempts: 0,
    lastSent: Date.now()
  });
  return code;
}

async function verifyPasswordResetOtp(email, code) {
  const norm = String(email || '').toLowerCase().trim();
  const entry = passwordResetOtpStore.get(norm);
  if (!entry) return false;
  if (entry.expires < Date.now()) { passwordResetOtpStore.delete(norm); return false; }
  entry.attempts += 1;
  if (entry.attempts > 5) { passwordResetOtpStore.delete(norm); return false; }
  const ok = await verifyPassword(String(code).trim(), entry.hash).catch(() => false);
  if (ok) passwordResetOtpStore.delete(norm);
  return ok;
}

// ── SMTP / EMAIL ──
function smtpReplyComplete(buffer) {
  const nl = buffer.indexOf('\r\n');
  if (nl === -1) return false;
  const first = buffer.slice(0, nl);
  if (first[3] !== '-') return true;
  return buffer.includes('\r\n' + first.slice(0, 3) + ' ');
}

function smtpTakeReply(buffer) {
  const nl1 = buffer.indexOf('\r\n');
  const first = buffer.slice(0, nl1);
  buffer = buffer.slice(nl1 + 2);
  let text = first;
  if (first[3] === '-') {
    for (;;) {
      const nl = buffer.indexOf('\r\n');
      if (nl === -1) break;
      const line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 2);
      text += '\r\n' + line;
      if (line[3] === ' ') break;
    }
  }
  return { text, rest: buffer };
}

async function resolveEmailConfig(store) {
  try {
    const dbCfg = await dbService.getEmailConfig();
    if (dbCfg && dbCfg.username && dbCfg.password) {
      return {
        host: dbCfg.host || 'smtp.gmail.com',
        port: Number(dbCfg.port) || 465,
        user: String(dbCfg.username).trim(),
        pass: String(dbCfg.password).trim(),
        fromEmail: String(dbCfg.fromEmail || dbCfg.username).trim(),
        fromName: String(dbCfg.fromName || 'ENMAR Official').trim()
      };
    }
  } catch {}

  const c = (store && store.apiConfigs && store.apiConfigs.email) || {};
  const host = c.host || process.env.EMAIL_HOST || 'smtp.gmail.com';
  const port = Number(c.port) || Number(process.env.EMAIL_PORT) || 465;
  const user = c.user || process.env.EMAIL_USER || '';
  const pass = c.pass || process.env.EMAIL_PASS || '';
  const fromEmail = c.fromEmail || process.env.EMAIL_FROM || user || '';
  const fromName = c.fromName || process.env.EMAIL_FROM_NAME || 'ENMAR Official';
  return { host, port, user: String(user || '').trim(), pass: String(pass || '').trim(), fromEmail: String(fromEmail || '').trim(), fromName: String(fromName || '').trim() };
}

function emailConfig(store) {
  const c = (store && store.apiConfigs && store.apiConfigs.email) || {};
  const host = c.host || process.env.EMAIL_HOST || 'smtp.gmail.com';
  const port = Number(c.port) || Number(process.env.EMAIL_PORT) || 465;
  const user = c.user || process.env.EMAIL_USER || '';
  const pass = c.pass || process.env.EMAIL_PASS || '';
  const fromEmail = c.fromEmail || process.env.EMAIL_FROM || user || '';
  const fromName = c.fromName || process.env.EMAIL_FROM_NAME || 'ENMAR Official';
  return { host, port, user: String(user || '').trim(), pass: String(pass || '').trim(), fromEmail: String(fromEmail || '').trim(), fromName: String(fromName || '').trim() };
}

function smtpSend(cfg, mail) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const waiters = [];
    let socket = null;
    let finished = false;
    const overall = setTimeout(() => finish(new Error('SMTP connection timed out after 20 seconds')), 20000);
    
    function finish(err, ok) {
      if (finished) return;
      finished = true;
      clearTimeout(overall);
      if (socket) { try { socket.destroy(); } catch {} }
      if (err) reject(err); else resolve(ok);
    }
    
    function fail(msg) { finish(new Error(msg)); }
    function reply() { return new Promise(res => waiters.push(res)); }
    function onData(chunk) {
      buffer += chunk.toString('utf8');
      while (waiters.length && smtpReplyComplete(buffer)) {
        const next = waiters.shift();
        const { text, rest } = smtpTakeReply(buffer);
        buffer = rest;
        next(text);
      }
    }
    function sendLine(line) { socket.write(line + '\r\n'); return reply(); }
    function bind(sock) {
      if (socket) { try { socket.removeListener('data', onData); } catch {} }
      socket = sock;
      sock.on('data', onData);
      sock.on('error', err => finish(err));
      sock.on('close', () => finish(new Error('SMTP connection closed prematurely')));
    }
    
    const code = text => Number(text.slice(0, 3));
    const isExplicitTls = Number(cfg.port) === 465 || cfg.secure !== false;

    (async () => {
      try {
        if (isExplicitTls) {
          const initial = tls.connect({ host: cfg.host, port: Number(cfg.port) || 465, servername: cfg.host, rejectUnauthorized: false });
          bind(initial);
        } else {
          const tcpSock = net.connect({ host: cfg.host, port: Number(cfg.port) || 587 });
          bind(tcpSock);
          let c = code(await reply());
          if (c !== 220) return fail('SMTP greeting failed');
          c = code(await sendLine('EHLO ' + cfg.host));
          if (c !== 250) return fail('EHLO rejected');
          c = code(await sendLine('STARTTLS'));
          if (c !== 220) return fail('STARTTLS refused');
          
          const tlsSock = tls.connect({ socket: tcpSock, host: cfg.host, servername: cfg.host, rejectUnauthorized: false });
          bind(tlsSock);
        }

        let c = code(await reply().catch(() => '220 OK'));
        c = code(await sendLine('EHLO ' + cfg.host));
        if (c !== 250) return fail('EHLO rejected: ' + cfg.host);

        const cleanUser = String(cfg.user || '').trim();
        const cleanPass = String(cfg.pass || '').replace(/\s+/g, '');

        c = code(await sendLine('AUTH LOGIN'));
        if (c === 334) {
          c = code(await sendLine(Buffer.from(cleanUser).toString('base64')));
          if (c !== 334) return fail('Username rejected by SMTP');
          c = code(await sendLine(Buffer.from(cleanPass).toString('base64')));
          if (c !== 235) return fail('Authentication failed (Check your Gmail address & 16-character App Password)');
        } else {
          c = code(await sendLine('AUTH PLAIN ' + Buffer.from('\0' + cleanUser + '\0' + cleanPass).toString('base64')));
          if (c !== 235) return fail('Authentication failed (Check your Gmail address & 16-character App Password)');
        }

        const senderEmail = mail.fromEmail || cfg.fromEmail || cleanUser;
        c = code(await sendLine('MAIL FROM:<' + senderEmail + '>'));
        if (c !== 250) return fail('Sender address rejected: ' + senderEmail);
        c = code(await sendLine('RCPT TO:<' + mail.to + '>'));
        if (c !== 250 && c !== 251) return fail('Recipient address rejected: ' + mail.to);
        c = code(await sendLine('DATA'));
        if (c !== 354) return fail('Server refused DATA transfer');

        const fromDisplay = mail.fromName || cfg.fromName || 'ENMAR';
        const fromHeader = `"${fromDisplay}" <${senderEmail}>`;

        const dataContent = 'From: ' + fromHeader + '\r\n'
          + 'To: <' + mail.to + '>\r\n'
          + 'Subject: =?UTF-8?B?' + Buffer.from(mail.subject).toString('base64') + '?=\r\n'
          + 'Date: ' + new Date().toUTCString() + '\r\n'
          + 'MIME-Version: 1.0\r\n'
          + 'Content-Type: text/plain; charset="UTF-8"\r\n'
          + 'Content-Transfer-Encoding: base64\r\n'
          + '\r\n'
          + Buffer.from(mail.text).toString('base64');

        socket.write(dataContent + '\r\n');
        const finalReply = await sendLine('.');
        c = code(finalReply);
        if (c !== 250) return fail('Message rejected by SMTP server');

        await sendLine('QUIT').catch(() => {});
        return finish(null, { success: true, message: 'Email sent successfully' });
      } catch (err) {
        return finish(err);
      }
    })();
  });
}

async function sendEmailOtpCode(email, store) {
  const norm = String(email || '').toLowerCase().trim();
  const code = await createEmailOtp(norm);
  const brand = (store && store.settings && store.settings.brandName) || 'ENMAR';
  const mailText = `Hello,\n\nYour ${brand} email verification OTP code is:\n\n   ${code}\n\nThis code will expire in 10 minutes. Please do not share this code with anyone.\n\nThank you,\n${brand} Team`;
  try {
    const cfg = await resolveEmailConfig(store);
    if (!cfg.user || !cfg.pass) {
      console.log(`[OTP Simulated Dev Code] Email: ${norm}, Code: ${code}`);
      return { ok: true, devMode: true, devCode: code, message: 'Verification code generated' };
    }
    await smtpSend(cfg, {
      to: norm,
      fromEmail: cfg.fromEmail,
      fromName: cfg.fromName || brand,
      subject: `[${brand}] Your Email Verification Code: ${code}`,
      text: mailText
    });
    return { ok: true, message: 'Verification code sent to your email' };
  } catch (err) {
    console.error(`[OTP Error] Failed to deliver email to ${norm}:`, err.message);
    return { ok: true, devMode: true, devCode: code, warning: `SMTP Error: ${err.message}` };
  }
}

async function sendPasswordResetCode(email, store) {
  const norm = String(email || '').toLowerCase().trim();
  
  // Rate limit: only 1 reset email per 60 seconds per email
  const rateLimitKey = `pwd_reset:${norm}`;
  const lastSent = rateLimitStore.get(rateLimitKey);
  if (lastSent && Date.now() - lastSent < 60000) {
    return { ok: false, error: 'Too many password reset requests. Please wait a minute.' };
  }
  rateLimitStore.set(rateLimitKey, Date.now());
  
  const code = await createPasswordResetOtp(norm);
  const brand = (store && store.settings && store.settings.brandName) || 'ENMAR';
  const mailText = `Hello,\n\nYour ${brand} password reset OTP code is:\n\n   ${code}\n\nThis code will expire in 10 minutes. If you did not request a password reset, please ignore this email.\n\nThank you,\n${brand} Team`;
  try {
    const cfg = await resolveEmailConfig(store);
    if (!cfg.user || !cfg.pass || norm.endsWith('@example.com') || norm.endsWith('@example.bd') || norm.endsWith('.test')) {
      console.log(`[Password Reset Simulated Dev Code] Email: ${norm}, Code: ${code}`);
      return { ok: true, devMode: true, devCode: code, message: 'Password reset code generated' };
    }
    await smtpSend(cfg, {
      to: norm,
      fromEmail: cfg.fromEmail,
      fromName: cfg.fromName || brand,
      subject: `[${brand}] Password Reset Code: ${code}`,
      text: mailText
    });
    return { ok: true, message: 'Password reset code sent to your email' };
  } catch (err) {
    console.error(`[Password Reset Error] Failed to deliver email to ${norm}:`, err.message);
    return { ok: true, devMode: true, devCode: code, warning: `SMTP Error: ${err.message}` };
  }
}

function syncThemeToCssFiles(primary, accent) {
  const pr = primary || '#631e2a';
  const ac = accent || '#C0912E';
  
  function shade(hex, f) {
    const clean = String(hex || '').replace('#', '');
    const n = parseInt(clean, 16);
    if (isNaN(n)) return hex;
    const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
    const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
    const b = Math.min(255, Math.round((n & 255) * f));
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  }
  const deep = shade(pr, 0.72);

  const hmCssPath = path.join(ROOT, 'css', 'harvest-market.css');
  if (fs.existsSync(hmCssPath)) {
    try {
      let content = fs.readFileSync(hmCssPath, 'utf8');
      content = content.replace(/--forest:\s*[^;]+;/, `--forest: ${pr};`);
      content = content.replace(/--forest-deep:\s*[^;]+;/, `--forest-deep: ${deep};`);
      content = content.replace(/--line-dark:\s*[^;]+;/, `--line-dark: ${pr};`);
      content = content.replace(/--gold:\s*[^;]+;/, `--gold: ${ac};`);
      fs.writeFileSync(hmCssPath, content, 'utf8');
    } catch (e) {
      console.error('[Theme] Could not write harvest-market.css:', e.message);
    }
  }

  const adminCssPath = path.join(ROOT, 'admin', 'admin.css');
  if (fs.existsSync(adminCssPath)) {
    try {
      let content = fs.readFileSync(adminCssPath, 'utf8');
      content = content.replace(/--forest:\s*[^;]+;/, `--forest: ${pr};`);
      content = content.replace(/--forest-deep:\s*[^;]+;/, `--forest-deep: ${deep};`);
      content = content.replace(/--line-dark:\s*[^;]+;/, `--line-dark: ${pr};`);
      content = content.replace(/--gold:\s*[^;]+;/, `--gold: ${ac};`);
      fs.writeFileSync(adminCssPath, content, 'utf8');
    } catch (e) {
      console.error('[Theme] Could not write admin.css:', e.message);
    }
  }
}

function syncBrandingToDisk(settings) {
  // SSR dynamic injection in injectServerBranding handles all branding in-memory with 0ms delay without dirtying git files
}

// ── HTTP SERVER ──
let store = {
  users: [],
  products: [],
  orders: [],
  subscribers: [],
  settings: {},
  apiConfigs: {},
  nextIds: { user: 1, product: 1, order: 1, review: 1 }
};

let storeLoadedPromise = null;
function ensureStoreLoaded() {
  if (!storeLoadedPromise) {
    storeLoadedPromise = readStore().then(s => {
      if (s) {
        Object.assign(store, s);
        if (store.settings) {
          if (store.settings.themePrimary || store.settings.themeAccent) {
            syncThemeToCssFiles(store.settings.themePrimary, store.settings.themeAccent);
          }
          syncBrandingToDisk(store.settings);
        }
      }
      console.log(`[Store] Loaded: ${store.users.length} users, ${store.products.length} products, ${store.orders.length} orders`);
      return store;
    }).catch(async err => {
      console.error('[Store] ⚠️ Failed to load initial store from DB:', err.message);
      return store;
    });
  }
  return storeLoadedPromise;
}

// Pre-load store in background
ensureStoreLoaded();

// ── MULTIPART / FORM-DATA PARSER & IMAGE UPLOAD ──
function parseMultipart(buffer, contentType) {
  const fields = {};
  const files = [];
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!match) return { fields, files };
  const boundary = '--' + (match[1] || match[2]).trim();
  const boundaryBuf = Buffer.from(boundary);
  const boundaryLen = boundaryBuf.length;

  let start = 0;
  while ((start = buffer.indexOf(boundaryBuf, start)) !== -1) {
    start += boundaryLen;
    if (buffer.slice(start, start + 2).toString() === '--') break;
    if (buffer.slice(start, start + 2).toString() === '\r\n') start += 2;

    const headerEnd = buffer.indexOf(Buffer.from('\r\n\r\n'), start);
    if (headerEnd === -1) break;

    const headerText = buffer.slice(start, headerEnd).toString('utf8');
    const partDataStart = headerEnd + 4;
    const partDataEnd = buffer.indexOf(Buffer.from('\r\n' + boundary), partDataStart);
    if (partDataEnd === -1) break;

    const partData = buffer.slice(partDataStart, partDataEnd);
    start = partDataEnd;

    const dispMatch = headerText.match(/Content-Disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]*)")?/i);
    if (!dispMatch) continue;

    const name = dispMatch[1];
    const filename = dispMatch[2];

    if (filename !== undefined && filename !== '') {
      const typeMatch = headerText.match(/Content-Type:\s*([^\r\n]+)/i);
      const mimeType = typeMatch ? typeMatch[1].trim() : 'application/octet-stream';
      files.push({
        fieldname: name,
        filename,
        mimeType,
        data: partData
      });
    } else if (filename === undefined) {
      fields[name] = partData.toString('utf8');
    }
  }
  return { fields, files };
}

async function saveUploadedImages(files) {
  if (!files || !files.length) return [];
  const uploadsDir = path.join(ROOT, 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch {}
  }
  const urls = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file || !file.data || !file.data.length) continue;
    const ext = path.extname(file.filename || '').toLowerCase() || '.png';
    const cleanExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext) ? ext : '.png';
    const fname = `prod-${Date.now()}-${i}${cleanExt}`;
    const targetFile = path.join(uploadsDir, fname);
    try {
      fs.writeFileSync(targetFile, file.data);
      urls.push(`/uploads/${fname}`);
    } catch (err) {
      console.error('[Upload] Failed to save product image:', err.message);
    }
  }
  return urls;
}

const server = http.createServer(async (req, res) => {
  try {
    const { method, url } = req;
    const rawPath = (url || '/').split('?')[0];
    let pathname = rawPath.replace(/^\/(?:enmar\.shop|enmar|public_html)(?=\/|$)/i, '') || '/';

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

    // Security Headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

    // ── DIAGNOSTIC FILE SYSTEM ENDPOINT ──
    if (method === 'GET' && pathname === '/api/debug-files') {
      const home = os.homedir();
      const checkPaths = [
        ROOT,
        __dirname,
        process.cwd(),
        path.join(home, 'enmar-web'),
        path.join(home, 'public_html'),
        path.join(home, 'repositories', 'enmar'),
        '/home/enmarsho/enmar-web',
        '/home/enmarsho/public_html'
      ].filter((v, i, a) => v && typeof v === 'string' && a.indexOf(v) === i);
      const fileListing = {};
      for (const p of checkPaths) {
        try {
          if (fs.existsSync(p)) {
            fileListing[p] = fs.readdirSync(p);
          } else {
            fileListing[p] = 'DOES_NOT_EXIST';
          }
        } catch (e) {
          fileListing[p] = 'ERROR: ' + e.message;
        }
      }
      return json(res, 200, {
        resolvedDashboard: resolveExistingFile('admin/dashboard.html'),
        resolvedIndex: resolveExistingFile('index.html'),
        homedir: home,
        fileListing
      });
    }

    // ── DIAGNOSTIC DATABASE ENDPOINT ──
    if (method === 'GET' && pathname === '/api/test-db-live') {
      try {
        if (!dbPool) {
          return json(res, 500, {
            ok: false,
            error: 'dbPool is null (mysql2 failed to load or config/db.js error)',
            env: {
              DB_HOST: process.env.DB_HOST,
              DB_PORT: process.env.DB_PORT,
              DB_USER: process.env.DB_USER,
              DB_NAME: process.env.DB_NAME,
              DB_PASS_SET: Boolean(process.env.DB_PASSWORD)
            }
          });
        }
        const conn = await dbPool.getConnection();
        await conn.ping();
        const [tables] = await conn.query('SHOW TABLES');
        const [prods] = await conn.query('SELECT COUNT(*) as count FROM products').catch(() => [[{ count: 'table missing' }]]);
        conn.release();
        return json(res, 200, {
          ok: true,
          message: 'Database connected successfully!',
          tables: tables.map(t => Object.values(t)[0]),
          productsCount: prods[0]?.count,
          env: {
            DB_HOST: process.env.DB_HOST,
            DB_PORT: process.env.DB_PORT,
            DB_USER: process.env.DB_USER,
            DB_NAME: process.env.DB_NAME
          }
        });
      } catch (err) {
        return json(res, 500, {
          ok: false,
          error: err.message,
          code: err.code,
          errno: err.errno,
          env: {
            DB_HOST: process.env.DB_HOST,
            DB_PORT: process.env.DB_PORT,
            DB_USER: process.env.DB_USER,
            DB_NAME: process.env.DB_NAME,
            DB_PASS_SET: Boolean(process.env.DB_PASSWORD)
          }
        });
      }
    }

    // ── STRICT DATABASE CONNECTIVITY GATE ──
    const dbOk = await isDbConnected();
    if (!dbOk) {
      if (pathname.startsWith('/api/')) {
        res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache' });
        res.end(JSON.stringify({ error: 'Database is disconnected. Service unavailable.', dbConnected: false }));
        return;
      }
      const errorHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>503 — Database Connection Required</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
    .box { background: #1e293b; border: 1px solid #334155; border-radius: 12px; max-width: 520px; width: 100%; padding: 36px 30px; text-align: center; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
    .icon { font-size: 48px; margin-bottom: 16px; display: inline-block; }
    h1 { margin: 0 0 12px; font-size: 1.5rem; font-weight: 700; color: #f1f5f9; }
    p { margin: 0 0 20px; font-size: 0.95rem; color: #94a3b8; line-height: 1.6; }
    .badge { display: inline-block; background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); padding: 4px 12px; border-radius: 9999px; font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="box">
    <div class="icon">🔌</div>
    <div><span class="badge">Database Disconnected</span></div>
    <h1>503 — Service Unavailable</h1>
    <p>This store is strictly database-driven. An active MySQL database connection is required to load store content, products, and services.</p>
  </div>
</body>
</html>`;
      res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      res.end(errorHtml);
      return;
    }

    // ── STATIC FILE SERVING (Instant response for all HTML, CSS, JS, images) ──
    if (await tryServeStatic(req, res, pathname)) return;
    if (method === 'GET' && (pathname === '/' || pathname === '')) {
      const indexPath = path.join(ROOT, 'index.html');
      if (fs.existsSync(indexPath)) {
        const html = fs.readFileSync(indexPath, 'utf8');
        return res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html);
      }
    }

    // Parse request body for API mutations (JSON or multipart/form-data)
    let body = {};
    req.files = [];
    const _contentType = req.headers['content-type'] || '';
    if (['POST', 'PATCH', 'PUT'].includes(method)) {
      const chunks = [];
      let _bytes = 0;
      await new Promise((resolve) => {
        req.on('data', (chunk) => {
          _bytes += chunk.length;
          if (_bytes > 25 * 1024 * 1024) { req.destroy(); return resolve(); } // 25MB cap
          chunks.push(chunk);
        });
        req.on('end', resolve);
        req.on('error', () => resolve());
      });
      const _rawBuf = Buffer.concat(chunks);
      if (_contentType.includes('multipart/form-data')) {
        const parsed = parseMultipart(_rawBuf, _contentType);
        body = parsed.fields;
        req.files = parsed.files;
      } else {
        const rawText = _rawBuf.toString('utf8');
        try { body = JSON.parse(rawText); } catch { body = {}; }
      }
    }

    // Ensure DB store is loaded before handling API endpoints
    await ensureStoreLoaded().catch(() => {});

    if (method === 'GET' && pathname === '/api/settings') {
      const settings = store.settings || {};
      if (!settings.brandName) settings.brandName = 'ENMAR';
      return json(res, 200, settings);
    }
      if (method === 'GET' && (pathname === '/api/products' || pathname === '/api/product')) {
        return json(res, 200, store.products.filter(p => p.active !== false));
      }
      if (method === 'GET' && pathname.match(/^\/api\/products?\/([^\/]+)$/)) {
        const ident = decodeURIComponent(pathname.split('/')[3]);
        let p = findProductBySlugOrId(ident);
        // DB fallback if in-memory store misses
        if (!p) {
          const numMatch = ident.match(/^(\d+)/) || ident.match(/-(\d+)$/);
          if (numMatch) {
            try {
              const dbProd = await dbService.getProductById(Number(numMatch[1]));
              if (dbProd) p = dbProd;
            } catch {}
          }
        }
        return json(res, p ? 200 : 404, p || { error: 'Not found' });
      }
      if (method === 'GET' && pathname === '/api/categories') {
        const dbCats = await dbService.getCategories().catch(() => []);
        const list = dbCats.map(c => c.name);
        return json(res, 200, list);
      }
      if (method === 'GET' && pathname === '/api/category-icons') {
        const dbCats = await dbService.getCategories().catch(() => []);
        const icons = {};
        for (const c of dbCats) {
          icons[c.name] = { icon: c.icon || 'leaf', image: c.image || '' };
        }
        return json(res, 200, icons);
      }
      if (method === 'GET' && pathname === '/api/admin/categories') {
        const user = currentUser(req, store);
        if (!user || !['admin', 'manager', 'superadmin'].includes(user.role)) return json(res, 403, { error: 'Forbidden' });
        const dbCats = await dbService.getCategories().catch(() => []);
        const icons = {};
        for (const c of dbCats) {
          icons[c.name] = { icon: c.icon || 'leaf', image: c.image || '' };
        }
        return json(res, 200, { categories: dbCats, icons });
      }
      if (method === 'POST' && pathname === '/api/admin/categories') {
        const user = currentUser(req, store);
        if (!user || !['admin', 'manager', 'superadmin'].includes(user.role)) return json(res, 403, { error: 'Forbidden' });
        const name = String(body.name || '').trim();
        if (!name) return json(res, 400, { error: 'Category name is required' });
        const icon = String(body.icon || 'leaf').trim();
        const image = String(body.image || '').trim();
        await dbService.createCategory({ name, icon, image });
        const dbCats = await dbService.getCategories().catch(() => []);
        const icons = {};
        for (const c of dbCats) {
          icons[c.name] = { icon: c.icon || 'leaf', image: c.image || '' };
        }
        return json(res, 201, { ok: true, categories: dbCats, icons });
      }
      if (method === 'DELETE' && pathname.startsWith('/api/admin/categories/')) {
        const user = currentUser(req, store);
        if (!user || !['admin', 'superadmin'].includes(user.role)) return json(res, 403, { error: 'Forbidden' });
        const parts = pathname.split('/');
        const isIconRoute = parts.length === 6 && parts[5] === 'icon';
        const name = decodeURIComponent(parts[4]);
        
        if (isIconRoute) {
          await dbService.updateCategoryIcon(name, { icon: 'leaf', image: '' });
          const dbCats = await dbService.getCategories().catch(() => []);
          const icons = {};
          for (const c of dbCats) {
            icons[c.name] = { icon: c.icon || 'leaf', image: c.image || '' };
          }
          return json(res, 200, { ok: true, icons });
        }

        const dbCatsBefore = await dbService.getCategories().catch(() => []);
        const catObj = dbCatsBefore.find(c => c.name === name) || { name };
        await dbService.addBinItem({
          type: 'category',
          originalId: catObj.id || 0,
          title: name,
          subtitle: 'Product Category',
          data: catObj,
          deletedBy: user.name || 'Admin',
          deletedByEmail: user.email || ''
        });

        await dbService.deleteCategory(name);
        if (dbPool) await dbPool.query('UPDATE products SET category = "General" WHERE category = ?', [name]).catch(() => {});
        store.products.forEach(p => {
          if (p.category === name || p.cat === name) {
            p.category = 'General';
            p.cat = 'General';
          }
        });

        const dbCats = await dbService.getCategories().catch(() => []);
        const icons = {};
        for (const c of dbCats) {
          icons[c.name] = { icon: c.icon || 'leaf', image: c.image || '' };
        }
        return json(res, 200, { ok: true, categories: dbCats, icons });
      }
      if (method === 'PATCH' && pathname.match(/^\/api\/admin\/categories\/[^/]+\/icon$/)) {
        const user = currentUser(req, store);
        if (!user || !['admin', 'manager', 'superadmin'].includes(user.role)) return json(res, 403, { error: 'Forbidden' });
        const name = decodeURIComponent(pathname.split('/')[4]);
        await dbService.updateCategoryIcon(name, { icon: body.icon, image: body.image });
        const dbCats = await dbService.getCategories().catch(() => []);
        const icons = {};
        for (const c of dbCats) {
          icons[c.name] = { icon: c.icon || 'leaf', image: c.image || '' };
        }
        return json(res, 200, { ok: true, icons });
      }
      if (method === 'GET' && pathname === '/sitemap.xml') {
        try {
          const prods = await dbService.getAllProductsAdmin().catch(() => store.products || []);
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
          
          for (const p of prods) {
            const pDate = p.updatedAt ? new Date(p.updatedAt).toISOString().split('T')[0] : now;
            xml += `  <url>\n    <loc>${baseUrl}${getProductUrl(p)}</loc>\n    <lastmod>${pDate}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
          }
          
          xml += `</urlset>`;
          
          res.writeHead(200, {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600'
          });
          return res.end(xml);
        } catch (e) {
          return json(res, 500, { error: 'Failed to generate sitemap' });
        }
      }
      if (method === 'GET' && pathname === '/api/comments') {
        const comments = await dbService.getAllCommentsAdmin().catch(() => []);
        return json(res, 200, comments);
      }
      if (method === 'GET' && pathname.match(/^\/api\/products?\/([^\/]+)\/reviews$/)) {
        const ident = pathname.split('/')[3];
        const p = findProductBySlugOrId(ident);
        const id = p ? p.id : Number(ident);
        const reviews = id ? await dbService.getProductReviews(id).catch(() => []) : [];
        return json(res, 200, reviews);
      }
      // ── REAL-TIME EVENT STREAM (SSE) ──
      if (method === 'GET' && pathname === '/api/events') {
        const user = currentUser(req, store);
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no'
        });
        res.write(': connected\n\n');

        const client = { res, user };
        sseClients.add(client);

        const pingInterval = setInterval(() => {
          try { res.write(': ping\n\n'); } catch { clearInterval(pingInterval); sseClients.delete(client); }
        }, 20000);

        req.on('close', () => {
          clearInterval(pingInterval);
          sseClients.delete(client);
        });
        return;
      }
      if (method === 'GET' && pathname === '/api/notifications') {
        const user = currentUser(req, store);
        const notifs = await dbService.getUserNotifications({
          userId: user ? user.id : null,
          role: user ? user.role : 'customer'
        }).catch(() => []);
        return json(res, 200, notifs);
      }
      if (method === 'PATCH' && pathname.match(/^\/api\/notifications\/\d+\/read$/)) {
        const user = currentUser(req, store);
        const id = Number(pathname.split('/')[3]);
        await dbService.markNotificationRead(id, user?.id);
        return json(res, 200, { ok: true });
      }
      if (method === 'POST' && pathname === '/api/notifications/read-all') {
        const user = currentUser(req, store);
        await dbService.markAllNotificationsRead({
          userId: user ? user.id : null,
          role: user ? user.role : 'customer'
        });
        return json(res, 200, { ok: true });
      }
      if (method === 'POST' && pathname === '/api/admin/notifications/broadcast') {
        const user = currentUser(req, store);
        if (!user || !['admin', 'superadmin'].includes(user.role)) return json(res, 403, { error: 'Forbidden' });
        const { title, message, link, targetRole } = body;
        if (!title || !message) return json(res, 400, { error: 'Title and message required' });
        const notif = await broadcastSmartNotification({
          event: 'notification',
          targetRole: targetRole || 'all',
          type: 'announcement',
          title,
          message,
          link: link || ''
        });
        return json(res, 201, { ok: true, notification: notif });
      }
      if (method === 'POST' && pathname === '/api/subscribe') {
        const email = String(body.email || '').toLowerCase().trim();
        if (!email || !email.includes('@') || !email.includes('.')) {
          return json(res, 400, { error: 'Valid email address required' });
        }
        await dbService.addSubscriber(email).catch(() => {});
        const subs = await dbService.getSubscribers().catch(() => []);
        store.subscribers = subs;

        broadcastSmartNotification({
          event: 'new-subscriber',
          targetRole: 'admin',
          type: 'subscriber',
          title: '📰 New Newsletter Subscriber',
          message: `${email} subscribed to seasonal crop updates.`,
          link: '/admin/subscribers'
        }).catch(() => {});

        return json(res, 201, { ok: true, message: 'Thank you for subscribing to ENMAR newsletter!' });
      }
      if (method === 'GET' && pathname === '/api/ads') {
        const ads = await dbService.getAllAdsAdmin().catch(() => []);
        return json(res, 200, ads);
      }
      if (method === 'GET' && pathname === '/api/ad-media') {
        const media = await dbService.getAdMedia().catch(() => []);
        return json(res, 200, media);
      }

      // ── AUTH ──
      if (method === 'POST' && pathname === '/api/auth/check-user') {
        const email = String(body.email || '').toLowerCase().trim();
        const emailTaken = store.users.some(u => u.email.toLowerCase() === email);
        return json(res, 200, { emailTaken });
      }
      if (method === 'POST' && pathname === '/api/auth/send-otp') {
        const email = String(body.email || '').toLowerCase().trim();
        if (!email) return json(res, 400, { error: 'Email required' });
        const result = await sendEmailOtpCode(email, store);
        return json(res, result.ok ? 200 : 400, result);
      }
      if (method === 'POST' && pathname === '/api/auth/register') {
        const { name, email, phone, otp, password } = body;
        if (!email || !otp || !password) return json(res, 400, { error: 'Missing fields' });
        if (password.length < 8) return json(res, 400, { error: 'Password must be at least 8 characters' });
        if (!await verifyEmailOtp(email, otp)) return json(res, 400, { error: 'Invalid OTP' });
        const passwordHash = await hashPassword(password);
        const user = await dbService.createUser({
          name: name || 'Customer',
          email: String(email).toLowerCase().trim(),
          phone: String(phone || '').trim(),
          passwordHash,
          role: 'customer',
          active: true
        });
        if (!user) return json(res, 400, { error: 'Registration failed' });
        store.users.push(user);
        setSession(res, user.id);

        broadcastSmartNotification({
          event: 'new-customer',
          targetRole: 'admin',
          type: 'new_user',
          title: '👤 New Customer Registered',
          message: `${user.name} (${user.email}) just created an account.`,
          link: '/admin/customers'
        }).catch(() => {});

        broadcastSmartNotification({
          event: 'welcome',
          targetRole: 'customer',
          userId: user.id,
          type: 'welcome',
          title: '🌱 Welcome to ENMAR!',
          message: 'Thank you for joining our organic community. Enjoy fresh farm harvest delivered to your door!',
          link: '/#products'
        }).catch(() => {});

        return json(res, 201, { ok: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
      }
      if (method === 'POST' && pathname === '/api/auth/login') {
        const { email, password } = body;
        if (!email || !password) return json(res, 400, { error: 'Email and password required' });
        const user = store.users.find(u => u.email.toLowerCase() === String(email).toLowerCase().trim());
        if (!user || !user.active) return json(res, 401, { error: 'Invalid credentials' });
        const ok = await verifyPassword(password, user.passwordHash).catch(() => false);
        if (!ok) return json(res, 401, { error: 'Invalid credentials' });
        setSession(res, user.id);
        return json(res, 200, { ok: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
      }
      if (method === 'GET' && pathname === '/api/auth/me') {
        const user = currentUser(req, store);
        if (!user) return json(res, 401, { user: null });
        return json(res, 200, {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            phone: user.phone || '',
            address: user.address || '',
            city: user.city || '',
            avatar: user.avatar || '',
            bio: user.bio || '',
            designation: user.designation || ''
          }
        });
      }
      if (method === 'PATCH' && pathname === '/api/auth/profile') {
        const user = currentUser(req, store);
        if (!user) return json(res, 401, { error: 'Unauthorized' });
        const fields = {};
        if (body.name !== undefined) { user.name = body.name; fields.name = body.name; }
        if (body.phone !== undefined) { user.phone = body.phone; fields.phone = body.phone; }
        if (body.address !== undefined) { user.address = body.address; fields.address = body.address; }
        if (body.city !== undefined) { user.city = body.city; fields.city = body.city; }
        if (body.avatar !== undefined) { user.avatar = body.avatar; fields.avatar = body.avatar; }
        if (body.bio !== undefined) { user.bio = body.bio; fields.bio = body.bio; }
        if (body.designation !== undefined) { user.designation = body.designation; fields.designation = body.designation; }
        await dbService.updateUser(user.id, fields);
        return json(res, 200, {
          ok: true,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            phone: user.phone || '',
            address: user.address || '',
            city: user.city || '',
            avatar: user.avatar || ''
          }
        });
      }
      if (method === 'POST' && pathname === '/api/auth/forgot-password') {
        const email = String(body.email || '').toLowerCase().trim();
        if (!email) return json(res, 400, { error: 'Email required' });
        let user = store.users.find(u => u.email && u.email.toLowerCase() === email);
        if (!user) {
          const dbUser = await dbService.getUserByEmail(email);
          if (dbUser) {
            user = dbUser;
            store.users.push(dbUser);
          }
        }
        if (!user) return json(res, 404, { error: 'User not found' });
        const result = await sendPasswordResetCode(email, store);
        return json(res, result.ok ? 200 : 429, result);
      }
      if (method === 'POST' && pathname === '/api/auth/reset-password') {
        const email = String(body.email || '').toLowerCase().trim();
        const otp = body.otp;
        const password = body.password || body.newPassword;
        if (!email || !otp || !password) return json(res, 400, { error: 'Missing fields' });
        if (password.length < 8) return json(res, 400, { error: 'Password must be at least 8 characters' });
        if (!await verifyPasswordResetOtp(email, otp)) return json(res, 400, { error: 'Invalid or expired reset code' });
        const user = store.users.find(u => u.email.toLowerCase() === email);
        if (!user) return json(res, 404, { error: 'User not found' });
        const passwordHash = await hashPassword(password);
        user.passwordHash = passwordHash;
        await dbService.updateUser(user.id, { passwordHash });
        return json(res, 200, { ok: true, message: 'Password reset successfully' });
      }
      if (method === 'POST' && pathname === '/api/auth/logout') {
        clearSession(req, res);
        return json(res, 200, { ok: true });
      }

      // ── CUSTOMER ──
      if (method === 'GET' && pathname === '/api/orders') {
        const user = currentUser(req, store);
        if (!user) return json(res, 401, { error: 'Unauthorized' });
        const orders = store.orders.filter(o => String(o.userId) === String(user.id) && !o.customerHidden);
        return json(res, 200, orders);
      }
      if (method === 'POST' && pathname === '/api/orders') {
        const user = currentUser(req, store);
        if (!user) return json(res, 401, { error: 'Unauthorized' });
        
        // Validate payment methods
        const paymentMethod = body.paymentMethod || 'Cash on Delivery';
        const unsupportedMethods = ['bKash', 'Nagad', 'Rocket', 'Paypal'];
        if (unsupportedMethods.includes(paymentMethod)) {
          return json(res, 400, { error: `${paymentMethod} is not available at this time` });
        }
        
        // Validate and process items
        const items = body.items || [];
        for (const item of items) {
          const product = store.products.find(p => p.id === item.id);
          if (!product) {
            return json(res, 400, { error: 'Invalid product ID' });
          }
        }
        
        // Calculate pricing
        const processedItems = [];
        let subtotal = 0;
        for (const item of items) {
          const product = store.products.find(p => p.id === item.id);
          const basePrice = Number(product.price) || 0;
          const discount = Number(product.discount) || 0;
          const effectivePrice = discount > 0 ? Math.round(basePrice * (1 - discount / 100) * 100) / 100 : basePrice;
          subtotal += Math.round(effectivePrice * item.qty * 100) / 100;
          processedItems.push({
            id: product.id,
            name: product.name,
            price: effectivePrice,
            qty: item.qty,
            unit: product.unit || 'kg'
          });
        }
        
        // Calculate shipping
        const shippingFlat = Number(store.settings.shippingFlat) || 80;
        const freeThreshold = Number(store.settings.shippingFreeThreshold) || 1500;
        const shipping = subtotal >= freeThreshold ? 0 : shippingFlat;
        const total = Math.round((subtotal + shipping) * 100) / 100;
        
        const order = await dbService.createOrder({
          number: `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
          userId: user.id,
          items: processedItems,
          delivery: body.delivery || {},
          paymentMethod: paymentMethod,
          total: total,
          subtotal: subtotal,
          shipping: shipping,
          status: 'Pending',
          estimatedDelivery: '24-48 hours'
        });
        if (!order) return json(res, 400, { error: 'Order creation failed' });
        store.orders.push(order);

        // Smart real-time notification
        broadcastSmartNotification({
          event: 'new-order',
          targetRole: 'admin',
          type: 'order_placed',
          title: `🛒 New Order #${order.number || order.id}`,
          message: `Order of ৳${order.total} placed by ${user.name || 'Customer'}`,
          link: '/admin/orders',
          payload: order
        }).catch(() => {});

        broadcastSmartNotification({
          event: 'order-received',
          targetRole: 'customer',
          userId: user.id,
          type: 'order_placed',
          title: `📦 Order #${order.number || order.id} Placed!`,
          message: `Thank you! Your order for ৳${order.total} has been received.`,
          link: '/my-orders'
        }).catch(() => {});

        return json(res, 201, { ok: true, order });
      }
      if (method === 'GET' && pathname.match(/^\/api\/orders\/\d+$/)) {
        const user = currentUser(req, store);
        if (!user) return json(res, 401, { error: 'Unauthorized' });
        const id = Number(pathname.split('/')[3]);
        const order = store.orders.find(o => Number(o.id) === id && (String(o.userId) === String(user.id) || user.role !== 'customer'));
        return json(res, order ? 200 : 404, order || { error: 'Not found' });
      }
      if (method === 'PATCH' && pathname.match(/^\/api\/orders\/\d+$/)) {
        const user = currentUser(req, store);
        if (!user) return json(res, 401, { error: 'Unauthorized' });
        const id = Number(pathname.split('/')[3]);
        const order = store.orders.find(o => Number(o.id) === id && String(o.userId) === String(user.id));
        if (!order) return json(res, 404, { error: 'Not found' });
        if (!order.customer) order.customer = {};
        if (!order.delivery) order.delivery = {};
        if (body.address) {
          order.deliveryAddress = body.address;
          order.delivery.address = body.address;
          order.customer.address = body.address;
        }
        if (body.phone) {
          order.customerPhone = body.phone;
          order.delivery.phone = body.phone;
          order.customer.phone = body.phone;
        }
        await dbService.updateOrder(id, order);
        return json(res, 200, order);
      }
      if (method === 'POST' && pathname.match(/^\/api\/orders\/\d+\/cancel$/)) {
        const user = currentUser(req, store);
        if (!user) return json(res, 401, { error: 'Unauthorized' });
        const id = Number(pathname.split('/')[3]);
        const order = store.orders.find(o => Number(o.id) === id && String(o.userId) === String(user.id));
        if (!order) return json(res, 404, { error: 'Not found' });
        if (order.status === 'Cancelled') return json(res, 400, { error: 'Already cancelled' });
        order.status = 'Cancelled';
        order.cancelledBy = 'customer';
        order.cancelledAt = new Date().toISOString();
        order.cancelReason = body.reason || '';
        if (!Array.isArray(order.history)) order.history = [];
        order.history.push({
          id: Date.now(),
          action: 'Order Cancelled by Customer',
          detail: body.reason ? `Reason: ${body.reason}` : 'Cancelled by customer',
          actor: 'customer',
          actorName: user.name || 'Customer',
          timestamp: new Date().toISOString()
        });
        await dbService.updateOrder(id, order);
        return json(res, 200, { ok: true, order });
      }
      if (method === 'DELETE' && pathname.match(/^\/api\/orders\/\d+\/history$/)) {
        const user = currentUser(req, store);
        if (!user) return json(res, 401, { error: 'Unauthorized' });
        const id = Number(pathname.split('/')[3]);
        const order = store.orders.find(o => Number(o.id) === id && String(o.userId) === String(user.id));
        if (!order) return json(res, 404, { error: 'Not found' });
        if (!['Delivered', 'Cancelled'].includes(order.status)) {
          return json(res, 400, { error: 'Can only delete history for Delivered or Cancelled orders' });
        }
        order.customerHidden = true;
        if (!Array.isArray(order.history)) order.history = [];
        order.history.push({
          id: Date.now(),
          action: 'Order History Deleted by Customer',
          detail: 'Removed from customer personal history view',
          actor: 'customer',
          actorName: user.name || 'Customer',
          timestamp: new Date().toISOString()
        });
        await dbService.updateOrder(id, order);
        return json(res, 200, { ok: true });
      }
      if (method === 'GET' && pathname.match(/^\/api\/orders\/\d+\/receipt$/)) {
        const user = currentUser(req, store);
        if (!user) return json(res, 401, { error: 'Unauthorized' });
        const id = Number(pathname.split('/')[3]);
        const order = store.orders.find(o => Number(o.id) === id);
        if (!order || (user.role === 'customer' && String(order.userId) !== String(user.id))) return json(res, 401, { error: 'Unauthorized' });
        return json(res, 200, { ok: true, order, receiptNumber: `REC-${order.id}`, store: { brandName: store.settings.brandName || 'ENMAR' } });
      }
      if (method === 'POST' && pathname.match(/^\/api\/orders\/\d+\/messages$/)) {
        const user = currentUser(req, store);
        if (!user) return json(res, 401, { error: 'Unauthorized' });
        const id = Number(pathname.split('/')[3]);
        const order = store.orders.find(o => Number(o.id) === id && String(o.userId) === String(user.id));
        if (!order) return json(res, 404, { error: 'Not found' });
        const text = body.text || body.message || '';
        if (!text) return json(res, 400, { error: 'Message text required' });
        const msgObj = {
          id: Date.now(),
          text,
          message: text,
          sender: 'customer',
          senderName: user.name || 'Customer',
          timestamp: new Date().toISOString()
        };
        if (!Array.isArray(order.messages)) order.messages = [];
        order.messages.push(msgObj);
        if (!Array.isArray(order.conversation)) order.conversation = [];
        order.conversation.push(msgObj);
        await dbService.updateOrder(id, order);

        broadcastSmartNotification({
          event: 'order-message',
          targetRole: 'admin',
          type: 'order_message',
          title: `💬 Message on Order #${order.number || order.id}`,
          message: `${user.name || 'Customer'}: ${text}`,
          link: '/admin/orders'
        }).catch(() => {});

        return json(res, 201, { ok: true, message: msgObj });
      }
      if (method === 'GET' && pathname === '/api/my-reviews') {
        const user = currentUser(req, store);
        if (!user) return json(res, 401, { error: 'Unauthorized' });
        const reviews = await dbService.getUserReviews(user.id).catch(() => []);
        return json(res, 200, reviews);
      }
      if (method === 'POST' && pathname.match(/^\/api\/products?\/([^\/]+)\/reviews$/)) {
        const user = currentUser(req, store);
        if (!user) return json(res, 401, { error: 'Unauthorized' });
        const ident = pathname.split('/')[3];
        const p = findProductBySlugOrId(ident);
        const productId = p ? p.id : Number(ident);
        if (!productId) return json(res, 400, { error: 'Invalid product' });
        const review = await dbService.createReview({
          productId,
          userId: user.id,
          rating: body.rating || 5,
          comment: body.comment || ''
        });

        broadcastSmartNotification({
          event: 'new-review',
          targetRole: 'admin',
          type: 'review',
          title: `⭐ New ${body.rating || 5}★ Review`,
          message: `${user.name || 'Customer'}: ${body.comment || 'Submitted a rating'}`,
          link: '/admin/reviews'
        }).catch(() => {});

        return json(res, 201, review || { error: 'Failed' });
      }
      if (method === 'DELETE' && pathname.match(/^\/api\/products?\/([^\/]+)\/reviews$/)) {
        const user = currentUser(req, store);
        if (!user) return json(res, 401, { error: 'Unauthorized' });
        const ident = pathname.split('/')[3];
        const p = findProductBySlugOrId(ident);
        const productId = p ? p.id : Number(ident);
        await dbService.deleteReview(body.reviewId, user.id);
        return json(res, 200, { ok: true });
      }
      if (method === 'POST' && pathname === '/api/comments') {
        const user = currentUser(req, store);
        if (!user) return json(res, 401, { error: 'Unauthorized' });
        const comment = await dbService.createComment({
          userId: user.id,
          text: body.text || ''
        });

        broadcastSmartNotification({
          event: 'new-comment',
          targetRole: 'admin',
          type: 'comment',
          title: '💬 New Community Voice Comment',
          message: `${user.name || 'User'}: ${body.text || ''}`,
          link: '/admin/comments'
        }).catch(() => {});

        return json(res, 201, { ok: true, comment });
      }
      if (method === 'PATCH' && pathname.match(/^\/api\/comments\/\d+$/)) {
        const user = currentUser(req, store);
        if (!user) return json(res, 401, { error: 'Unauthorized' });
        const id = Number(pathname.split('/')[3]);
        await dbService.updateComment(id, body.text, user.id);
        return json(res, 200, { ok: true, comment: { id, text: body.text } });
      }
      if (method === 'DELETE' && pathname.match(/^\/api\/comments\/\d+$/)) {
        const user = currentUser(req, store);
        if (!user) return json(res, 401, { error: 'Unauthorized' });
        const id = Number(pathname.split('/')[3]);
        await dbService.deleteComment(id, user.id);
        return json(res, 200, { ok: true });
      }
      if (method === 'PATCH' && pathname === '/api/profile') {
        const user = currentUser(req, store);
        if (!user) return json(res, 401, { error: 'Unauthorized' });
        if (body.name) user.name = body.name;
        if (body.phone) user.phone = body.phone;
        if (body.address) user.address = body.address;
        if (body.avatar) user.avatar = body.avatar;
        await dbService.updateUser(user.id, user);
        return json(res, 200, { ok: true, user });
      }
      if (method === 'DELETE' && pathname.match(/^\/api\/reviews\/\d+$/)) {
        const user = currentUser(req, store);
        if (!user) return json(res, 401, { error: 'Unauthorized' });
        const id = Number(pathname.split('/')[3]);
        await dbService.deleteReview(id, user.id);
        return json(res, 200, { ok: true });
      }

      // ── ADMIN ──
      if (method === 'GET' && pathname === '/api/admin/stats') {
        const user = currentUser(req, store);
        if (!user) return json(res, 401, { error: 'Unauthorized' });
        if (!['admin', 'manager', 'superadmin'].includes(user.role)) return json(res, 403, { error: 'Forbidden' });
        return json(res, 200, {
          orders: store.orders.length,
          products: store.products.length,
          users: store.users.length,
          subscribers: store.subscribers.length
        });
      }
      if (method === 'GET' && pathname === '/api/admin/orders') {
        const user = currentUser(req, store);
        if (!user || !['admin', 'manager', 'superadmin'].includes(user.role)) return json(res, 403, { error: 'Forbidden' });
        return json(res, 200, store.orders);
      }
      if (method === 'GET' && pathname === '/api/admin/users') {
        const user = currentUser(req, store);
        if (!user || !['admin', 'manager', 'superadmin'].includes(user.role)) return json(res, 403, { error: 'Forbidden' });
        return json(res, 200, store.users.map(u => ({
          id: u.id, name: u.name, email: u.email, role: u.role, active: u.active, phone: u.phone || ''
        })));
      }
      if (method === 'POST' && pathname === '/api/admin/users') {
        const user = currentUser(req, store);
        if (!user || !['admin', 'manager', 'superadmin'].includes(user.role)) return json(res, 403, { error: 'Forbidden' });
        const passwordHash = await hashPassword(body.password || 'TempPass123!');
        const newUser = await dbService.createUser({
          name: body.name || 'User',
          email: body.email,
          passwordHash,
          role: body.role || 'customer',
          active: body.active !== false
        });
        if (!newUser) return json(res, 400, { error: 'Creation failed' });
        store.users.push(newUser);
        return json(res, 201, { ok: true, user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role } });
      }
      if (method === 'PATCH' && pathname.match(/^\/api\/admin\/users\/\d+$/)) {
        const user = currentUser(req, store);
        if (!user || !['admin', 'manager', 'superadmin'].includes(user.role)) return json(res, 403, { error: 'Forbidden' });
        const id = Number(pathname.split('/')[4]);
        const target = store.users.find(u => u.id === id);
        if (!target) return json(res, 404, { error: 'Not found' });
        if (target.email && target.email.toLowerCase() === PERMANENT_SUPERADMIN_EMAIL.toLowerCase()) {
          return json(res, 403, { error: 'Permanent Superadmin cannot be modified via API. Changes must be made directly in the database.' });
        }
        if (body.active !== undefined) target.active = body.active;
        if (body.role && user.role === 'superadmin') target.role = body.role;
        await dbService.updateUser(id, target);
        return json(res, 200, { ok: true });
      }
      if (method === 'POST' && pathname.match(/^\/api\/admin\/users\/\d+\/reset-password$/)) {
        const user = currentUser(req, store);
        if (!user || !['admin', 'manager', 'superadmin'].includes(user.role)) return json(res, 403, { error: 'Forbidden' });
        const id = Number(pathname.split('/')[4]);
        const target = store.users.find(u => u.id === id);
        if (!target) return json(res, 404, { error: 'Not found' });
        if (target.email && target.email.toLowerCase() === PERMANENT_SUPERADMIN_EMAIL.toLowerCase()) {
          return json(res, 403, { error: 'Permanent Superadmin password cannot be reset via API. Changes must be made directly in the database.' });
        }
        const passwordHash = await hashPassword(body.password);
        target.passwordHash = passwordHash;
        await dbService.updateUser(id, target);
        return json(res, 200, { ok: true });
      }
      if (method === 'DELETE' && pathname.match(/^\/api\/admin\/users\/\d+$/)) {
        const user = currentUser(req, store);
        if (!user || !['admin', 'superadmin'].includes(user.role)) return json(res, 403, { error: 'Forbidden' });
        const id = Number(pathname.split('/')[4]);
        const target = store.users.find(u => u.id === id);
        if (target && target.email && target.email.toLowerCase() === PERMANENT_SUPERADMIN_EMAIL.toLowerCase()) {
          return json(res, 403, { error: 'Permanent Superadmin cannot be deleted. Changes must be made directly in the database.' });
        }
        if (target) {
          await dbService.addBinItem({
            type: 'user',
            originalId: id,
            title: target.name || 'User',
            subtitle: `${target.email || ''} (${target.role || 'customer'})`,
            data: target,
            deletedBy: user.name || 'Admin',
            deletedByEmail: user.email || ''
          });
        }
        await dbService.deleteUser(id);
        const idx = store.users.findIndex(u => u.id === id);
        if (idx >= 0) store.users.splice(idx, 1);
        return json(res, 200, { ok: true });
      }
      if (method === 'GET' && pathname === '/api/admin/products') {
        const user = currentUser(req, store);
        if (!user || !['admin', 'manager', 'superadmin'].includes(user.role)) return json(res, 403, { error: 'Forbidden' });
        return json(res, 200, store.products);
      }
      if (method === 'POST' && pathname === '/api/admin/products') {
        const user = currentUser(req, store);
        if (!user || !['admin', 'superadmin', 'manager'].includes(user.role)) return json(res, 403, { error: 'Forbidden' });
        // Persist any uploaded product images (multipart 'images' field) to /uploads
        const uploadedImages = await saveUploadedImages(req.files);
        const images = (Array.isArray(body.images) ? body.images : (body.images ? [body.images] : [])).concat(uploadedImages);
        const product = await dbService.createProduct({
          name: body.name,
          farm: body.farm || '',
          price: Number(body.price) || 0,
          unit: body.unit || 'kg',
          category: body.cat || body.category || 'General',
          icon: body.icon || 'leaf',
          tag: body.tag || '',
          lot: body.lot || '',
          discount: Number(body.discount) || 0,
          description: body.description || '',
          images
        });
        if (!product) return json(res, 400, { error: 'Creation failed' });
        store.products.push(product);
        // Optional storefront broadcast when notifyCustomers is enabled
        if (body.notifyCustomers !== 'false' && body.notifyCustomers !== false) {
          try { await dbService.notifyNewProduct?.(product); } catch { /* non-fatal */ }
        }
        return json(res, 201, Object.assign({ ok: true, id: product.id }, product));
      }
      if (method === 'PATCH' && pathname.match(/^\/api\/admin\/products\/\d+$/)) {
        const user = currentUser(req, store);
        if (!user || !['admin', 'superadmin', 'manager'].includes(user.role)) return json(res, 403, { error: 'Forbidden' });
        const id = Number(pathname.split('/')[4]);
        const idx = store.products.findIndex(p => p.id === id);
        if (idx < 0) return json(res, 404, { error: 'Not found' });
        // Merge uploaded images with existing ones (and honor removals) for multipart edits.
        let patch = body;
        if (req.files && req.files.length) {
          const existing = (store.products[idx].images || []).filter(img => {
            try { return !(body.removeImages && JSON.parse(body.removeImages).includes(img)); } catch { return true; }
          });
          const uploaded = await saveUploadedImages(req.files);
          patch = Object.assign({}, body, { images: existing.concat(uploaded) });
        }
        const updated = await dbService.updateProduct(id, patch);
        if (updated) {
          Object.assign(store.products[idx], updated);
        }
        return json(res, 200, { ok: true, product: store.products[idx] });
      }
      if (method === 'DELETE' && pathname.match(/^\/api\/admin\/products\/\d+$/)) {
        const user = currentUser(req, store);
        if (!user || !['admin', 'superadmin', 'manager'].includes(user.role)) return json(res, 403, { error: 'Forbidden' });
        const id = Number(pathname.split('/')[4]);
        const idx = store.products.findIndex(p => p.id === id);
        if (idx < 0) return json(res, 404, { error: 'Not found' });
        const p = store.products[idx];
        const binEntry = await dbService.addBinItem({
          type: 'product',
          originalId: id,
          title: p.name,
          subtitle: `৳${p.price} · ${p.cat || p.category || ''}`,
          data: p,
          deletedBy: user.name || 'Admin',
          deletedByEmail: user.email || ''
        });
        await dbService.deleteProduct(id);
        store.products.splice(idx, 1);
        return json(res, 200, { ok: true, binEntry });
      }
      if (method === 'PATCH' && pathname.match(/^\/api\/admin\/orders\/\d+$/)) {
        const user = currentUser(req, store);
        if (!user || !['admin', 'manager', 'superadmin'].includes(user.role)) return json(res, 403, { error: 'Forbidden' });
        const id = Number(pathname.split('/')[4]);
        let order = store.orders.find(o => o.id === id);
        if (!order) order = await dbService.getOrderById(id);
        if (!order) return json(res, 404, { error: 'Not found' });
        if (order.cancelledBy === 'customer') return json(res, 400, { error: 'Order was cancelled by the customer' });
        
        const prevStatus = order.status;
        if (body.status) {
          order.status = body.status;
          if (body.status === 'Confirmed') {
            order.confirmedAt = new Date().toISOString();
            order.confirmedBy = user.name || 'Admin';
            const countdownHours = Number(store.settings?.deliveryCountdownHours || store.settings?.deliveryHours || 4);
            if (!body.estimatedDelivery) {
              order.estimatedDelivery = new Date(Date.now() + countdownHours * 3600 * 1000).toISOString();
            } else {
              order.estimatedDelivery = body.estimatedDelivery;
            }
          }
        }
        if (body.estimatedDelivery !== undefined && body.status !== 'Confirmed') {
          order.estimatedDelivery = body.estimatedDelivery;
        }

        if (!Array.isArray(order.history)) order.history = [];
        order.history.push({
          id: Date.now(),
          action: body.status && body.status !== prevStatus ? `Status: ${body.status}` : 'Order Updated',
          detail: `Order updated by ${user.name || 'Admin'}${order.status === 'Confirmed' ? ` (Auto delivery countdown: ${store.settings?.deliveryCountdownHours || 4}h)` : ''}`,
          actor: 'staff',
          actorName: user.name || 'Admin',
          timestamp: new Date().toISOString()
        });

        const updated = await dbService.updateOrder(id, order);
        const idx = store.orders.findIndex(o => o.id === id);
        if (idx >= 0) store.orders[idx] = updated || order;

        if (body.status && body.status !== prevStatus) {
          const statusTitle = body.status === 'Confirmed'
            ? '✅ Order Confirmed — Delivery in 4 Hours!'
            : `🚚 Order #${order.number || order.id} Status: ${body.status}`;
          const statusMsg = body.status === 'Confirmed'
            ? `Your order #${order.number || order.id} has been confirmed! Auto delivery countdown is active.`
            : `Your order #${order.number || order.id} is now ${body.status}.`;

          broadcastSmartNotification({
            event: 'order-status',
            targetRole: 'customer',
            userId: order.userId,
            type: 'order_status',
            title: statusTitle,
            message: statusMsg,
            link: '/my-orders'
          }).catch(() => {});
        }

        return json(res, 200, updated || order);
      }
      if (method === 'POST' && pathname.match(/^\/api\/admin\/orders\/\d+\/messages$/)) {
        const user = currentUser(req, store);
        if (!user || !['admin', 'manager', 'superadmin'].includes(user.role)) return json(res, 403, { error: 'Forbidden' });
        const id = Number(pathname.split('/')[4]);
        let order = store.orders.find(o => o.id === id);
        if (!order) order = await dbService.getOrderById(id);
        if (!order) return json(res, 404, { error: 'Not found' });
        const text = body.text || body.message || '';
        if (!text) return json(res, 400, { error: 'Message text required' });
        const msgObj = {
          id: Date.now(),
          text,
          message: text,
          sender: 'staff',
          senderName: user.name || 'Staff',
          timestamp: new Date().toISOString()
        };
        if (!Array.isArray(order.messages)) order.messages = [];
        order.messages.push(msgObj);
        if (!Array.isArray(order.conversation)) order.conversation = [];
        order.conversation.push(msgObj);
        await dbService.updateOrder(id, order);

        broadcastSmartNotification({
          event: 'order-message',
          targetRole: 'customer',
          userId: order.userId,
          type: 'order_message',
          title: `💬 Support Reply on Order #${order.number || order.id}`,
          message: `${user.name || 'Staff'}: ${text}`,
          link: '/my-orders'
        }).catch(() => {});

        return json(res, 201, { ok: true, message: msgObj });
      }
      if (method === 'DELETE' && pathname.match(/^\/api\/admin\/orders\/\d+$/)) {
        const user = currentUser(req, store);
        if (!user || !['admin', 'superadmin'].includes(user.role)) return json(res, 403, { error: 'Forbidden' });
        const id = Number(pathname.split('/')[4]);
        await dbService.deleteOrder(id);
        const idx = store.orders.findIndex(o => o.id === id);
        if (idx >= 0) store.orders.splice(idx, 1);
        return json(res, 200, { ok: true });
      }
      if (method === 'GET' && pathname === '/api/admin/comments') {
        const user = currentUser(req, store);
        if (!user || !['admin', 'superadmin'].includes(user.role)) return json(res, 403, { error: 'Forbidden' });
        const comments = await dbService.getAllCommentsAdmin().catch(() => []);
        return json(res, 200, comments);
      }
      if (method === 'DELETE' && pathname.match(/^\/api\/admin\/comments\/\d+$/)) {
        const user = currentUser(req, store);
        if (!user || !['admin', 'superadmin'].includes(user.role)) return json(res, 403, { error: 'Forbidden' });
        const id = Number(pathname.split('/')[4]);
        const comment = await dbService.getCommentById(id).catch(() => null);
        if (comment) {
          await dbService.addBinItem({
            type: 'comment',
            originalId: id,
            title: `Comment by ${comment.authorName || 'User'}`,
            subtitle: comment.text || '',
            data: comment,
            deletedBy: user.name || 'Admin',
            deletedByEmail: user.email || ''
          });
        }
        await dbService.deleteComment(id);
        return json(res, 200, { ok: true });
      }
      if (method === 'GET' && pathname === '/api/admin/reviews') {
        const user = currentUser(req, store);
        if (!user || !['admin', 'superadmin'].includes(user.role)) return json(res, 403, { error: 'Forbidden' });
        const reviews = await dbService.getAllReviewsAdmin().catch(() => []);
        return json(res, 200, reviews);
      }
      if (method === 'DELETE' && pathname.match(/^\/api\/admin\/reviews\/\d+$/)) {
        const user = currentUser(req, store);
        if (!user || !['admin', 'superadmin'].includes(user.role)) return json(res, 403, { error: 'Forbidden' });
        const id = Number(pathname.split('/')[4]);
        const review = await dbService.getReviewById(id).catch(() => null);
        if (review) {
          await dbService.addBinItem({
            type: 'review',
            originalId: id,
            title: `Review by ${review.authorName || 'User'} (${review.rating}★)`,
            subtitle: review.comment || '',
            data: review,
            deletedBy: user.name || 'Admin',
            deletedByEmail: user.email || ''
          });
        }
        await dbService.deleteReview(id);
        return json(res, 200, { ok: true });
      }
      if (method === 'GET' && pathname === '/api/admin/subscribers') {
        const user = currentUser(req, store);
        if (!user || !['admin', 'manager', 'superadmin'].includes(user.role)) return json(res, 403, { error: 'Forbidden' });
        const subs = await dbService.getSubscribers().catch(() => []);
        return json(res, 200, subs);
      }
      if (method === 'DELETE' && pathname.match(/^\/api\/admin\/subscribers\/\d+$/)) {
        const user = currentUser(req, store);
        if (!user || !['admin', 'manager', 'superadmin'].includes(user.role)) return json(res, 403, { error: 'Forbidden' });
        const id = Number(pathname.split('/')[4]);
        const subs = await dbService.getSubscribers().catch(() => []);
        const target = subs.find(s => s.id === id);
        if (target) {
          await dbService.addBinItem({
            type: 'subscriber',
            originalId: id,
            title: target.email,
            subtitle: `Subscribed: ${target.subscribedAt || ''}`,
            data: target,
            deletedBy: user.name || 'Admin',
            deletedByEmail: user.email || ''
          });
        }
        await dbService.deleteSubscriber(id);
        const updatedSubs = await dbService.getSubscribers().catch(() => []);
        store.subscribers = updatedSubs;
        return json(res, 200, { ok: true });
      }
      if (method === 'GET' && pathname === '/api/admin/settings') {
        const user = currentUser(req, store);
        if (!user || !['admin', 'superadmin'].includes(user.role)) return json(res, 403, { error: 'Forbidden' });
        return json(res, 200, store.settings);
      }
      if (method === 'PATCH' && pathname === '/api/admin/settings') {
        const user = currentUser(req, store);
        if (!user || !['admin', 'superadmin'].includes(user.role)) return json(res, 403, { error: 'Forbidden' });
        Object.assign(store.settings, body);
        if (store.settings.themePrimary || store.settings.themeAccent) {
          syncThemeToCssFiles(store.settings.themePrimary, store.settings.themeAccent);
        }
        syncBrandingToDisk(store.settings);
        await dbService.updateSettings(store.settings);
        return json(res, 200, store.settings);
      }
      if (method === 'GET' && pathname === '/api/admin/bin') {
        const user = currentUser(req, store);
        if (!user || !['admin', 'superadmin'].includes(user.role)) return json(res, 403, { error: 'Forbidden' });
        const binItems = await dbService.getBinItems();
        const counts = await dbService.getBinCounts();
        return json(res, 200, { ok: true, bin: binItems, counts });
      }
      if (method === 'POST' && pathname.match(/^\/api\/admin\/bin\/\d+\/restore$/)) {
        const user = currentUser(req, store);
        if (!user || !['admin', 'superadmin'].includes(user.role)) return json(res, 403, { error: 'Forbidden' });
        const binId = Number(pathname.split('/')[4]);
        const item = await dbService.getBinItemById(binId);
        if (!item) return json(res, 404, { error: 'Item not found in bin' });
        if (item.type === 'product' && item.data) {
          const prodToRestore = { ...item.data, id: item.originalId || item.data.id };
          const restoredProd = await dbService.createProduct(prodToRestore);
          if (restoredProd) store.products.push(restoredProd);
        } else if (item.type === 'category') {
          const catData = item.data || { name: item.title };
          await dbService.createCategory(catData);
        } else if (item.type === 'comment' && item.data) {
          await dbService.createComment(item.data);
        } else if (item.type === 'review' && item.data) {
          await dbService.createReview(item.data);
        } else if (item.type === 'user' && item.data) {
          const restoredUser = await dbService.createUser(item.data);
          if (restoredUser) store.users.push(restoredUser);
        } else if (item.type === 'ad' && item.data) {
          await dbService.createAd(item.data);
        } else if (item.type === 'subscriber' && item.data) {
          await dbService.addSubscriber(item.data.email || item.title);
        }
        await dbService.removeBinItem(binId);
        return json(res, 200, { ok: true, message: 'Item restored successfully' });
      }
      if (method === 'DELETE' && pathname.match(/^\/api\/admin\/bin\/\d+$/)) {
        const user = currentUser(req, store);
        if (!user || !['admin', 'superadmin'].includes(user.role)) return json(res, 403, { error: 'Forbidden' });
        const binId = Number(pathname.split('/')[4]);
        await dbService.removeBinItem(binId);
        return json(res, 200, { ok: true, message: 'Permanently purged' });
      }
      if (method === 'POST' && pathname === '/api/admin/staff') {
        const user = currentUser(req, store);
        if (!user || !['admin', 'superadmin'].includes(user.role)) return json(res, 403, { error: 'Forbidden' });
        const { name, email, password, role } = body;
        if (!email || !password) return json(res, 400, { error: 'Email and password required' });
        const passwordHash = await hashPassword(password);
        const newUser = await dbService.createUser({
          name: name || 'Staff',
          email: String(email).toLowerCase().trim(),
          passwordHash,
          role: role || 'staff',
          active: true
        });
        if (!newUser) return json(res, 400, { error: 'Failed to create staff' });
        store.users.push(newUser);
        return json(res, 201, { ok: true, user: newUser });
      }
      if (method === 'GET' && pathname === '/api/admin/ads') {
        const user = currentUser(req, store);
        if (!user || !['admin', 'manager', 'superadmin'].includes(user.role)) return json(res, 403, { error: 'Forbidden' });
        const ads = await dbService.getAllAdsAdmin().catch(() => []);
        return json(res, 200, ads);
      }
      if (method === 'POST' && pathname === '/api/admin/ads') {
        const user = currentUser(req, store);
        if (!user || !['admin', 'manager', 'superadmin'].includes(user.role)) return json(res, 403, { error: 'Forbidden' });
        const ad = await dbService.createAd(body);
        return json(res, 201, ad);
      }
      if (method === 'PATCH' && pathname.match(/^\/api\/admin\/ads\/[^/]+$/)) {
        const user = currentUser(req, store);
        if (!user || !['admin', 'manager', 'superadmin'].includes(user.role)) return json(res, 403, { error: 'Forbidden' });
        const id = decodeURIComponent(pathname.split('/')[4]);
        const ad = await dbService.updateAd(id, body);
        return json(res, 200, ad || { ok: true });
      }
      if (method === 'DELETE' && pathname.match(/^\/api\/admin\/ads\/[^/]+$/)) {
        const user = currentUser(req, store);
        if (!user || !['admin', 'manager', 'superadmin'].includes(user.role)) return json(res, 403, { error: 'Forbidden' });
        const id = decodeURIComponent(pathname.split('/')[4]);
        const [adsRows] = dbPool ? await dbPool.query('SELECT * FROM ads WHERE id = ?', [id]).catch(() => [[]]) : [[]];
        const ad = adsRows[0];
        if (ad) {
          await dbService.addBinItem({
            type: 'ad',
            originalId: 0,
            title: ad.name || ad.title || 'Banner Ad',
            subtitle: ad.headline || ad.sub || '',
            data: ad,
            deletedBy: user.name || 'Admin',
            deletedByEmail: user.email || ''
          });
        }
        await dbService.deleteAd(id);
        return json(res, 200, { ok: true });
      }
      if (method === 'POST' && pathname === '/api/admin/bin/empty') {
        const user = currentUser(req, store);
        if (!user || !['admin', 'superadmin', 'manager'].includes(user.role)) return json(res, 403, { error: 'Forbidden' });
        await dbService.emptyBin(body.type);
        return json(res, 200, { ok: true, message: 'Recycle bin emptied' });
      }
      if (method === 'GET' && pathname === '/api/admin/apis') {
        const user = currentUser(req, store);
        if (!user || !['superadmin', 'admin', 'manager'].includes(user.role)) return json(res, 403, { error: 'Forbidden' });
        const dbEmail = await dbService.getEmailConfig().catch(() => null);
        const email = dbEmail || (store.apiConfigs && store.apiConfigs.email) || {};
        const sms = (store.apiConfigs && store.apiConfigs.sms) || {};
        return json(res, 200, {
          sms: {
            provider: sms.provider || 'alpha',
            baseUrl: sms.baseUrl || 'https://api.sms.net.bd/sendsms',
            senderId: sms.senderId || '',
            enabled: sms.enabled !== false,
            apiKeySet: Boolean(sms.apiKey)
          },
          email: {
            provider: email.provider || 'gmail',
            host: email.host || 'smtp.gmail.com',
            port: Number(email.port) || 465,
            secure: email.secure !== false,
            user: email.user || email.username || '',
            fromName: email.fromName || email.from_name || 'ENMAR Official',
            fromEmail: email.fromEmail || email.from_email || email.user || email.username || '',
            passSet: Boolean(email.pass || email.password)
          }
        });
      }
      if (method === 'PATCH' && pathname === '/api/admin/apis') {
        const user = currentUser(req, store);
        if (!user || !['superadmin', 'admin', 'manager'].includes(user.role)) return json(res, 403, { error: 'Forbidden' });
        if (!store.apiConfigs) store.apiConfigs = {};
        if (body.sms) {
          const existingKey = store.apiConfigs.sms && store.apiConfigs.sms.apiKey;
          store.apiConfigs.sms = {
            ...(store.apiConfigs.sms || {}),
            ...body.sms,
            apiKey: body.sms.apiKey !== undefined && body.sms.apiKey !== '' ? body.sms.apiKey : existingKey
          };
        }
        if (body.email) {
          const dbEmail = await dbService.getEmailConfig().catch(() => null);
          const existingPass = (dbEmail && (dbEmail.pass || dbEmail.password)) || (store.apiConfigs.email && store.apiConfigs.email.pass);
          store.apiConfigs.email = {
            ...(store.apiConfigs.email || {}),
            ...body.email,
            pass: body.email.pass !== undefined && body.email.pass !== '' ? body.email.pass : existingPass
          };
          // Persist directly to email_gateway_config table in MySQL
          await dbService.saveEmailGatewayConfig(store.apiConfigs.email, user.id);
        }
        await dbService.saveAllSettings(null, store.apiConfigs);
        return json(res, 200, { ok: true, message: 'Settings saved successfully' });
      }
      if ((method === 'DELETE' && pathname === '/api/admin/apis/email') || (method === 'POST' && pathname === '/api/admin/apis/clear-email')) {
        const user = currentUser(req, store);
        if (!user || !['superadmin', 'admin', 'manager'].includes(user.role)) return json(res, 403, { error: 'Forbidden' });
        if (store.apiConfigs) {
          delete store.apiConfigs.email;
        }
        await dbService.deleteEmailGatewayConfig();
        await dbService.saveAllSettings(null, store.apiConfigs);
        return json(res, 200, { ok: true, message: 'Gmail & Email gateway connection deleted successfully' });
      }
      if (method === 'POST' && pathname === '/api/admin/apis/test-email') {
        const user = currentUser(req, store);
        if (!user || !['superadmin', 'admin', 'manager'].includes(user.role)) return json(res, 403, { error: 'Forbidden' });
        const to = (body && body.to) || user.email;
        if (!to) return json(res, 400, { error: 'Recipient email required' });
        const cfg = await resolveEmailConfig(store);
        if (!cfg.user || !cfg.pass) return json(res, 400, { error: 'SMTP username or App Password not set. Please save them first.' });
        const brand = (store.settings && store.settings.brandName) || 'ENMAR';
        try {
          await smtpSend(cfg, {
            to,
            fromEmail: cfg.fromEmail,
            fromName: cfg.fromName || `${brand} Official`,
            subject: `[${brand}] Test Email Verification`,
            text: `Hello,\n\nThis is a test email confirming that your SMTP settings on ${brand} are working perfectly!\n\nTimestamp: ${new Date().toISOString()}`
          });
          return json(res, 200, { ok: true, message: 'Test email sent successfully' });
        } catch (err) {
          return json(res, 400, { error: `SMTP Error: ${err.message}` });
        }
      }
      if (method === 'POST' && pathname === '/api/admin/apis/test-sms') {
        const user = currentUser(req, store);
        if (!user || !['admin', 'superadmin'].includes(user.role)) return json(res, 403, { error: 'Forbidden' });
        const to = body && body.to;
        if (!to) return json(res, 400, { error: 'Recipient phone number required' });
        return json(res, 200, { ok: true, provider: 'Alpha SMS / SIMULATION (Dev mode active)' });
      }

      // ── EVENTS (SSE) ──
      if (method === 'GET' && pathname === '/api/events/live') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
        const interval = setInterval(() => res.write(': heartbeat\n\n'), 30000);
        req.on('close', () => clearInterval(interval));
        return;
      }
      if (method === 'GET' && pathname === '/api/events') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
        const interval = setInterval(() => res.write(': heartbeat\n\n'), 30000);
        req.on('close', () => clearInterval(interval));
        return;
      }

      // Fallback for non-API GET requests: Serve index.html
      if (method === 'GET' && !pathname.startsWith('/api/')) {
        const fallbackIndex = resolveExistingFile('index.html');
        if (fallbackIndex) {
          let html = fs.readFileSync(fallbackIndex, 'utf8');
          html = injectServerBranding(html, fallbackIndex);
          const buf = Buffer.from(html, 'utf8');
          return sendCompressed(req, res, 200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache'
          }, buf);
        }
      }

      // 404
      return json(res, 404, { error: 'Not found' });
    } catch (err) {
      console.error('[Error]', err);
      return json(res, 500, { error: 'Internal server error' });
    }
  });

server.listen(PORT, () => {
  console.log(`[Server] Listening on port ${PORT}`);
  if (IS_PROD) console.log('[Server] Running in production mode');
});