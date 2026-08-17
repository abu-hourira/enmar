const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const jsFiles = fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js')).map(f => path.join(ROOT, 'js', f));

const replacements = [
  [/window\.location\.href\s*=\s*['"]\/admin\/dashboard\.html['"]/g, "window.location.href = '/admin/dashboard'"],
  [/window\.location\.href\s*=\s*['"]\/my-orders\.html['"]/g, "window.location.href = '/my-orders'"],
  [/window\.location\.href\s*=\s*['"]\/checkout\.html['"]/g, "window.location.href = '/checkout'"],
  [/\/product\.html\?/g, '/product?'],
  [/\/product\.html"/g, '/product"'],
  [/\/receipt\.html\?/g, '/receipt?'],
  [/\/receipt\.html"/g, '/receipt"'],
  [/\/checkout\.html/g, '/checkout'],
  [/\/my-orders\.html/g, '/my-orders'],
  [/\/bmi-calculator\.html/g, '/bmi-calculator']
];

let count = 0;
for (const file of jsFiles) {
  let content = fs.readFileSync(file, 'utf8');
  let modified = false;
  for (const [regex, replacement] of replacements) {
    if (regex.test(content)) {
      content = content.replace(regex, replacement);
      modified = true;
    }
  }
  if (modified) {
    fs.writeFileSync(file, content, 'utf8');
    count++;
    console.log('Updated clean JS URLs in:', path.relative(ROOT, file));
  }
}
console.log('Total JS files updated:', count);
