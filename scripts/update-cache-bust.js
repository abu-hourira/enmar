const fs = require('fs');
const path = require('path');

const adminDir = path.join(__dirname, '..', 'admin');
fs.readdirSync(adminDir).filter(f => f.endsWith('.html')).forEach(f => {
  const fp = path.join(adminDir, f);
  let content = fs.readFileSync(fp, 'utf8');
  content = content.replace(/href="\/admin\/admin\.css(?:\?v=[^"]+)?"/g, 'href="/admin/admin.css?v=2.2"');
  fs.writeFileSync(fp, content, 'utf8');
  console.log('Updated admin HTML:', f);
});
