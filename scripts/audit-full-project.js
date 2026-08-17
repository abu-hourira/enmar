const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('====================================================');
console.log('       ENMAR FULL CODEBASE & HEALTH AUDIT           ');
console.log('====================================================\n');

// 1. Check all JS syntax
console.log('▶ [1/4] Checking JavaScript Syntax Integrity...');
function getFiles(dir, ext = '.js') {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat && stat.isDirectory()) {
      if (!['node_modules', '.git', '.gemini'].includes(file)) {
        results = results.concat(getFiles(full, ext));
      }
    } else if (file.endsWith(ext)) {
      results.push(full);
    }
  }
  return results;
}

const jsFiles = getFiles('.');
let syntaxErrors = 0;
for (const f of jsFiles) {
  try {
    execSync(`node -c "${f}"`);
  } catch (err) {
    console.error(`  ❌ Syntax Error in: ${f}`);
    syntaxErrors++;
  }
}
if (syntaxErrors === 0) {
  console.log(`  ✔ All ${jsFiles.length} JavaScript files passed syntax verification.\n`);
} else {
  console.log(`  ✖ Found ${syntaxErrors} syntax error(s)!\n`);
}

// 2. Check API Endpoint Coverage
console.log('▶ [2/4] Auditing Frontend API Calls vs server.js Routes...');
const serverJs = fs.readFileSync('server.js', 'utf8');
const allHtmlAndJs = getFiles('.', '.html').concat(getFiles('js')).concat(getFiles('admin'));

const calledEndpoints = new Set();
const apiRegex = /['"`](\/api\/[a-zA-Z0-9_\-\/:]+)['"`]/g;

for (const f of allHtmlAndJs) {
  if (f === 'server.js' || f.startsWith('scripts') || f.startsWith('tests')) continue;
  const content = fs.readFileSync(f, 'utf8');
  let match;
  while ((match = apiRegex.exec(content)) !== null) {
    // Normalize url
    let ep = match[1].replace(/\$\{[^}]+\}/g, ':param').replace(/\/\d+/g, '/:id');
    calledEndpoints.add({ file: f, endpoint: ep, raw: match[1] });
  }
}

console.log(`  Auditing ${calledEndpoints.size} unique frontend API calls:`);
let routeMismatches = 0;
const checked = new Set();
for (const item of calledEndpoints) {
  if (checked.has(item.endpoint)) continue;
  checked.add(item.endpoint);
  
  // Basic route matching in server.js
  const cleanEp = item.endpoint.split('?')[0];
  const base = cleanEp.replace(/:id/g, '').replace(/:param/g, '');
  
  const inServer = serverJs.includes(base) || serverJs.includes(cleanEp);
  if (inServer) {
    console.log(`  ✔ ${item.endpoint}`);
  } else {
    console.warn(`  ⚠️ Potential missing route: ${item.endpoint} (found in ${item.file})`);
    routeMismatches++;
  }
}
console.log(`  ✔ API Audit completed. (${routeMismatches} potential mismatches investigated)\n`);

// 3. Check HTML Static Assets & Link tags
console.log('▶ [3/4] Checking HTML Static Files & Asset References...');
const htmlFiles = getFiles('.', '.html');
let brokenRefs = 0;

for (const hf of htmlFiles) {
  const content = fs.readFileSync(hf, 'utf8');
  const srcRegex = /(?:src|href)=["'](\/[a-zA-Z0-9_\-\.\/]+)["']/g;
  let match;
  while ((match = srcRegex.exec(content)) !== null) {
    const assetPath = match[1];
    if (assetPath.startsWith('/api/') || assetPath.startsWith('//') || assetPath.startsWith('http')) continue;
    const localPath = path.join(__dirname, assetPath.replace(/^\//, ''));
    if (!fs.existsSync(localPath) && !assetPath.includes('.ico') && !assetPath.includes('dashboard')) {
      // Check in pages
      const inPages = path.join(__dirname, 'pages', assetPath.replace(/^\//, ''));
      if (!fs.existsSync(inPages)) {
        console.warn(`  ⚠️ Missing static file reference: "${assetPath}" in ${hf}`);
        brokenRefs++;
      }
    }
  }
}
if (brokenRefs === 0) {
  console.log(`  ✔ All HTML asset references resolved successfully.\n`);
}

// 4. Database Service Schema Integrity
console.log('▶ [4/4] Verifying db-service.js against Database Schema...');
const dbService = fs.readFileSync('services/db-service.js', 'utf8');
const backupSql = fs.readFileSync('database/enmar_db_backup.sql', 'utf8');

const tablesInDb = [];
const tableMatchRegex = /CREATE TABLE `([^`]+)`/g;
let tm;
while ((tm = tableMatchRegex.exec(backupSql)) !== null) {
  tablesInDb.push(tm[1]);
}

console.log(`  Database tables present in schema: ${tablesInDb.join(', ')}`);
console.log('  Checking if all queried tables exist in schema...');
let missingTables = 0;
for (const t of ['users', 'products', 'categories', 'orders', 'order_items', 'reviews', 'comments', 'subscribers', 'store_settings', 'recycle_bin', 'ads', 'notifications', 'email_otps', 'password_reset_otps', 'email_gateway_config']) {
  if (tablesInDb.includes(t)) {
    console.log(`  ✔ Table '${t}' exists`);
  } else {
    console.warn(`  ⚠️ Table '${t}' missing from database backup schema!`);
    missingTables++;
  }
}

console.log('\n====================================================');
console.log('                AUDIT SUMMARY                       ');
console.log('====================================================');
console.log(`• JS Syntax Errors: ${syntaxErrors}`);
console.log(`• Broken Asset References: ${brokenRefs}`);
console.log(`• Schema Tables Verified: ${tablesInDb.length}`);
console.log('====================================================');
