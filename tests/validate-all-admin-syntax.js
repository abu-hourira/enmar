const fs = require('fs');
const path = require('path');

const adminDir = 'c:/xampp/htdocs/enma/admin';
const files = fs.readdirSync(adminDir).filter(f => f.endsWith('.html'));

let errorCount = 0;
files.forEach(file => {
  const filePath = path.join(adminDir, file);
  const html = fs.readFileSync(filePath, 'utf8');
  const scripts = [...html.matchAll(/<script[\s\S]*?>([\s\S]*?)<\/script>/gi)];
  scripts.forEach((m, idx) => {
    const code = m[1];
    if (!code.trim()) return;
    try {
      new Function(code);
    } catch (err) {
      console.error(`❌ ${file} (script #${idx + 1}):`, err.message);
      errorCount++;
    }
  });
});

if (errorCount === 0) {
  console.log(`✔ All ${files.length} Admin HTML files passed script syntax verification!`);
} else {
  console.error(`❌ Found ${errorCount} errors across admin HTML files.`);
  process.exit(1);
}
