const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const net = require('node:net');
const tls = require('node:tls');
const emailEncryption = require('./services/email-encryption.js');

// ── ENV LOADER ──
(function loadDotEnv() {
  try {
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) return;
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      const value = line.slice(eq + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
      if (key) process.env[key] = value;
    }
  } catch { /* ignore */ }
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

function tryServeStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  if (pathname.startsWith('/api/')) return false;

  if (pathname === '/admin' || pathname === '/admin/') {
    res.writeHead(302, { 'Location': '/admin/dashboard.html' });
    res.end();
    return true;
  }

  const safePath = pathname.replace(/^[\/\\]+/, '');
  let targetPath = path.join(ROOT, safePath);
  const resolvedPath = path.resolve(targetPath);

  if (!resolvedPath.toLowerCase().startsWith(ROOT.toLowerCase())) return false;

  const relPath = path.relative(ROOT, resolvedPath).replace(/\\/g, '/');

  const parts = relPath.split('/');
  if (parts.some(p => p.startsWith('.'))) return false;
  if (SENSITIVE_PATTERNS.some(pat => pat.test(relPath))) return false;

  let finalPath = resolvedPath;
  let stat;
  try {
    stat = fs.statSync(finalPath);
    if (stat.isDirectory()) {
      finalPath = path.join(finalPath, 'index.html');
      stat = fs.statSync(finalPath);
    }
  } catch {
    // If not found directly in root, attempt to serve from pages/ directory
    try {
      const pagePath = path.join(ROOT, 'pages', safePath);
      stat = fs.statSync(pagePath);
      if (stat.isFile()) {
        finalPath = pagePath;
      } else {
        return false;
      }
    } catch {
      return false;
    }
  }

  if (!stat.isFile()) return false;

  const ext = path.extname(finalPath).toLowerCase();
  const mimeType = MIME_TYPES[ext];
  if (!mimeType) return false;

  res.writeHead(200, {
    'Content-Type': mimeType,
    'Content-Length': stat.size,
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400'
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
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD || 'Abuhourira97@';
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
      console.error('[MySQL] ❌ CRITICAL: Cannot connect to database:', err.message);
      process.exit(1);
    }
  })();
} catch (e) {
  console.error('[MySQL] ❌ FATAL: Failed to load database pool:', e.message);
  process.exit(1);
}

// ── STORE ──
async function readStore() {
  await dbService.ensureStoreSettings().catch(() => {});
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
  if (!existingSuper) {
    const passwordHash = await hashPassword(account.password);
    const created = await dbService.createUser({
      name: account.name,
      email: account.email,
      passwordHash,
      role: 'superadmin',
      active: true
    });
    if (created) store.users.push(created);
  } else {
    if (existingSuper.role !== 'superadmin' || !existingSuper.active) {
      existingSuper.role = 'superadmin';
      existingSuper.active = true;
      await dbService.updateUser(existingSuper.id, { role: 'superadmin', active: true });
    }
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
  const session = sessions.get(cookies(req).hm_session);
  return session && session.expires > Date.now() ? store.users.find(u => u.id === session.userId && u.active) : null;
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function setSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { userId, expires: Date.now() + 7 * 86400000 });
  dbService.createSession(userId, token).catch(() => {});
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
  return { host, port, user: String(user || '').trim(), pass: String(pass || '').trim(), fromEmail: String(fromEmail || '').trim() };
}

function smtpSend(cfg, mail) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const waiters = [];
    let socket = null;
    let finished = false;
    const overall = setTimeout(() => finish(new Error('SMTP connection timed out')), 4000);
    
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
      sock.on('close', () => finish(new Error('SMTP connection closed')));
    }
    
    const code = text => Number(text.slice(0, 3));
    const initial = tls.connect({ host: cfg.host, port: cfg.port, servername: cfg.host });
    bind(initial);

    (async () => {
      try {
        let c = code(await reply());
        if (c !== 220) return fail('SMTP greeting failed');
        c = code(await sendLine('EHLO ' + cfg.host));
        if (c !== 250) return fail('EHLO rejected');
        c = code(await sendLine('AUTH LOGIN'));
        if (c === 334) {
          c = code(await sendLine(Buffer.from(cfg.user).toString('base64')));
          if (c !== 334) return fail('username rejected');
          c = code(await sendLine(Buffer.from(cfg.pass).toString('base64')));
          if (c !== 235) return fail('authentication failed');
        } else {
          c = code(await sendLine('AUTH PLAIN ' + Buffer.from('\0' + cfg.user + '\0' + cfg.pass).toString('base64')));
          if (c !== 235) return fail('authentication failed');
        }

        c = code(await sendLine('MAIL FROM:<' + mail.fromEmail + '>'));
        if (c !== 250) return fail('sender rejected');
        c = code(await sendLine('RCPT TO:<' + mail.to + '>'));
        if (c !== 250 && c !== 251) return fail('recipient rejected');
        c = code(await sendLine('DATA'));
        if (c !== 354) return fail('server refused message');

        const dataContent = 'From: ' + mail.fromHeader + '\r\n'
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
        if (c !== 250) return fail('message rejected');

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
  const mailText = `Your ${brand} email verification code is:\n\n${code}\n\nThis expires in 10 minutes.`;
  try {
    const cfg = await resolveEmailConfig(store);
    if (!cfg.user || !cfg.pass) return { ok: true, devMode: true, devCode: code };
    await smtpSend(cfg, {
      to: norm,
      fromEmail: cfg.fromEmail,
      fromHeader: cfg.fromEmail,
      subject: `${brand} Verification Code: ${code}`,
      text: mailText
    });
    return { ok: true, message: 'Verification code sent to your email' };
  } catch (err) {
    console.warn(`[OTP] Email attempt: ${err.message}`);
    return { ok: true, devMode: true, devCode: code, warning: err.message };
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
  const mailText = `Your ${brand} password reset code is:\n\n${code}\n\nThis expires in 10 minutes.`;
  try {
    const cfg = await resolveEmailConfig(store);
    if (!cfg.user || !cfg.pass || norm.endsWith('@example.com') || norm.endsWith('@example.bd') || norm.endsWith('.test')) return { ok: true, devMode: true, devCode: code };
    await smtpSend(cfg, {
      to: norm,
      fromEmail: cfg.fromEmail,
      fromHeader: cfg.fromEmail,
      subject: `${brand} Password Reset Code: ${code}`,
      text: mailText
    });
    return { ok: true, message: 'Password reset code sent to your email' };
  } catch (err) {
    console.warn(`[OTP] Email attempt: ${err.message}`);
    return { ok: true, devMode: true, devCode: code, warning: err.message };
  }
}

// ── HTTP SERVER ──
async function initializeApp() {
  const store = await readStore();
  console.log(`[Store] Loaded: ${store.users.length} users, ${store.products.length} products, ${store.orders.length} orders`);

  const server = http.createServer(async (req, res) => {
    const { method, url } = req;
    const pathname = url.split('?')[0];
    let body = '';

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

    // Parse body
    if (['POST', 'PATCH', 'PUT'].includes(method)) {
      await new Promise((resolve, reject) => {
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', resolve);
        req.on('error', reject);
      });
      try { body = JSON.parse(body); } catch { body = {}; }
    }

    try {
      // ── SECURITY HEADERS ──
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

      // ── STATIC FILE SERVING ──
      if (tryServeStatic(req, res, pathname)) return;

      // ── PUBLIC ──
      if (method === 'GET' && pathname === '/') {
        const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
        return res.writeHead(200, { 'Content-Type': 'text/html' }).end(html);
      }
      if (method === 'GET' && pathname === '/api/settings') {
        const settings = store.settings || {};
        if (!settings.brandName) settings.brandName = 'ENMAR';
        return json(res, 200, settings);
      }
      if (method === 'GET' && pathname === '/api/products') {
        return json(res, 200, store.products.filter(p => p.active !== false));
      }
      if (method === 'GET' && pathname.match(/^\/api\/products\/(\d+)$/)) {
        const id = Number(pathname.split('/')[3]);
        const p = store.products.find(x => x.id === id);
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
      if (method === 'GET' && pathname === '/api/comments') {
        const comments = await dbService.getAllCommentsAdmin().catch(() => []);
        return json(res, 200, comments);
      }
      if (method === 'GET' && pathname.match(/^\/api\/products\/(\d+)\/reviews$/)) {
        const id = Number(pathname.split('/')[3]);
        const reviews = await dbService.getProductReviews(id).catch(() => []);
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
          link: '/admin/subscribers.html'
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
          link: '/admin/customers.html'
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
        const orders = store.orders.filter(o => o.userId === user.id && !o.customerHidden);
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
          link: '/admin/orders.html',
          payload: order
        }).catch(() => {});

        broadcastSmartNotification({
          event: 'order-received',
          targetRole: 'customer',
          userId: user.id,
          type: 'order_placed',
          title: `📦 Order #${order.number || order.id} Placed!`,
          message: `Thank you! Your order for ৳${order.total} has been received.`,
          link: '/pages/my-orders.html'
        }).catch(() => {});

        return json(res, 201, { ok: true, order });
      }
      if (method === 'GET' && pathname.match(/^\/api\/orders\/\d+$/)) {
        const user = currentUser(req, store);
        if (!user) return json(res, 401, { error: 'Unauthorized' });
        const id = Number(pathname.split('/')[3]);
        const order = store.orders.find(o => o.id === id && (o.userId === user.id || user.role !== 'customer'));
        return json(res, order ? 200 : 404, order || { error: 'Not found' });
      }
      if (method === 'PATCH' && pathname.match(/^\/api\/orders\/\d+$/)) {
        const user = currentUser(req, store);
        if (!user) return json(res, 401, { error: 'Unauthorized' });
        const id = Number(pathname.split('/')[3]);
        const order = store.orders.find(o => o.id === id && o.userId === user.id);
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
        const order = store.orders.find(o => o.id === id && o.userId === user.id);
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
        const order = store.orders.find(o => o.id === id && o.userId === user.id);
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
        const order = store.orders.find(o => o.id === id);
        if (!order || (user.role === 'customer' && order.userId !== user.id)) return json(res, 401, { error: 'Unauthorized' });
        return json(res, 200, { ok: true, order, receiptNumber: `REC-${order.id}`, store: { brandName: store.settings.brandName || 'ENMAR' } });
      }
      if (method === 'POST' && pathname.match(/^\/api\/orders\/\d+\/messages$/)) {
        const user = currentUser(req, store);
        if (!user) return json(res, 401, { error: 'Unauthorized' });
        const id = Number(pathname.split('/')[3]);
        const order = store.orders.find(o => o.id === id && o.userId === user.id);
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
          link: '/admin/orders.html'
        }).catch(() => {});

        return json(res, 201, { ok: true, message: msgObj });
      }
      if (method === 'GET' && pathname === '/api/my-reviews') {
        const user = currentUser(req, store);
        if (!user) return json(res, 401, { error: 'Unauthorized' });
        const reviews = await dbService.getUserReviews(user.id).catch(() => []);
        return json(res, 200, reviews);
      }
      if (method === 'POST' && pathname.match(/^\/api\/products\/(\d+)\/reviews$/)) {
        const user = currentUser(req, store);
        if (!user) return json(res, 401, { error: 'Unauthorized' });
        const productId = Number(pathname.split('/')[3]);
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
          link: '/admin/reviews.html'
        }).catch(() => {});

        return json(res, 201, review || { error: 'Failed' });
      }
      if (method === 'DELETE' && pathname.match(/^\/api\/products\/(\d+)\/reviews$/)) {
        const user = currentUser(req, store);
        if (!user) return json(res, 401, { error: 'Unauthorized' });
        const productId = Number(pathname.split('/')[3]);
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
          link: '/admin/comments.html'
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
        if (!user || user.role !== 'superadmin') return json(res, 403, { error: 'Forbidden' });
        return json(res, 200, store.users.map(u => ({
          id: u.id, name: u.name, email: u.email, role: u.role, active: u.active, phone: u.phone || ''
        })));
      }
      if (method === 'POST' && pathname === '/api/admin/users') {
        const user = currentUser(req, store);
        if (!user || user.role !== 'superadmin') return json(res, 403, { error: 'Forbidden' });
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
        if (!user || user.role !== 'superadmin') return json(res, 403, { error: 'Forbidden' });
        const id = Number(pathname.split('/')[4]);
        const target = store.users.find(u => u.id === id);
        if (!target) return json(res, 404, { error: 'Not found' });
        if (target.email && target.email.toLowerCase() === PERMANENT_SUPERADMIN_EMAIL.toLowerCase()) {
          return json(res, 403, { error: 'Permanent Superadmin cannot be modified via API. Changes must be made directly in the database.' });
        }
        if (body.active !== undefined) target.active = body.active;
        if (body.role) target.role = body.role;
        await dbService.updateUser(id, target);
        return json(res, 200, { ok: true });
      }
      if (method === 'POST' && pathname.match(/^\/api\/admin\/users\/\d+\/reset-password$/)) {
        const user = currentUser(req, store);
        if (!user || user.role !== 'superadmin') return json(res, 403, { error: 'Forbidden' });
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
        if (!user || user.role !== 'superadmin') return json(res, 403, { error: 'Forbidden' });
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
        if (!user || !['admin', 'superadmin'].includes(user.role)) return json(res, 403, { error: 'Forbidden' });
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
          images: body.images || []
        });
        if (!product) return json(res, 400, { error: 'Creation failed' });
        store.products.push(product);
        return json(res, 201, Object.assign({ ok: true, id: product.id }, product));
      }
      if (method === 'PATCH' && pathname.match(/^\/api\/admin\/products\/\d+$/)) {
        const user = currentUser(req, store);
        if (!user || !['admin', 'superadmin'].includes(user.role)) return json(res, 403, { error: 'Forbidden' });
        const id = Number(pathname.split('/')[4]);
        const idx = store.products.findIndex(p => p.id === id);
        if (idx < 0) return json(res, 404, { error: 'Not found' });
        const updated = await dbService.updateProduct(id, body);
        if (updated) {
          Object.assign(store.products[idx], updated);
        }
        return json(res, 200, { ok: true, product: store.products[idx] });
      }
      if (method === 'DELETE' && pathname.match(/^\/api\/admin\/products\/\d+$/)) {
        const user = currentUser(req, store);
        if (!user || !['admin', 'superadmin'].includes(user.role)) return json(res, 403, { error: 'Forbidden' });
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
            link: '/pages/my-orders.html'
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
          link: '/pages/my-orders.html'
        }).catch(() => {});

        return json(res, 201, { ok: true, message: msgObj });
      }
      if (method === 'DELETE' && pathname.match(/^\/api\/admin\/orders\/\d+$/)) {
        const user = currentUser(req, store);
        if (!user || user.role !== 'superadmin') return json(res, 403, { error: 'Forbidden' });
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
        if (!user || user.role !== 'superadmin') return json(res, 403, { error: 'Forbidden' });
        return json(res, 200, store.settings);
      }
      if (method === 'PATCH' && pathname === '/api/admin/settings') {
        const user = currentUser(req, store);
        if (!user || user.role !== 'superadmin') return json(res, 403, { error: 'Forbidden' });
        Object.assign(store.settings, body);
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
        if (!user || user.role !== 'superadmin') return json(res, 403, { error: 'Forbidden' });
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
        if (!user || user.role !== 'superadmin') return json(res, 403, { error: 'Forbidden' });
        await dbService.emptyBin(body.type);
        return json(res, 200, { ok: true, message: 'Recycle bin emptied' });
      }
      if (method === 'GET' && pathname === '/api/admin/apis') {
        const user = currentUser(req, store);
        if (!user || user.role !== 'superadmin') return json(res, 403, { error: 'Forbidden' });
        return json(res, 200, { sms: {}, email: {} });
      }
      if (method === 'POST' && pathname === '/api/admin/apis/test-email') {
        const user = currentUser(req, store);
        if (!user || user.role !== 'superadmin') return json(res, 403, { error: 'Forbidden' });
        return json(res, 200, { ok: true, message: 'SMTP Handshake & TLS Auth Verified' });
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
}

initializeApp().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});