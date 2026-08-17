const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const files = [
  path.join(ROOT, 'index.html'),
  ...fs.readdirSync(path.join(ROOT, 'pages')).map(f => path.join(ROOT, 'pages', f)),
  ...fs.readdirSync(path.join(ROOT, 'admin')).filter(f => f.endsWith('.html')).map(f => path.join(ROOT, 'admin', f))
];

const replacements = [
  [/href="\/admin\/dashboard\.html"/g, 'href="/admin/dashboard"'],
  [/href="\/admin\/orders\.html"/g, 'href="/admin/orders"'],
  [/href="\/admin\/products\.html"/g, 'href="/admin/products"'],
  [/href="\/admin\/customers\.html"/g, 'href="/admin/customers"'],
  [/href="\/admin\/staff\.html"/g, 'href="/admin/staff"'],
  [/href="\/admin\/reviews\.html"/g, 'href="/admin/reviews"'],
  [/href="\/admin\/comments\.html"/g, 'href="/admin/comments"'],
  [/href="\/admin\/ads\.html"/g, 'href="/admin/ads"'],
  [/href="\/admin\/subscribers\.html"/g, 'href="/admin/subscribers"'],
  [/href="\/admin\/analytics\.html"/g, 'href="/admin/analytics"'],
  [/href="\/admin\/settings\.html"/g, 'href="/admin/settings"'],
  [/href="\/admin\/apis\.html"/g, 'href="/admin/apis"'],
  [/href="\/admin\/bin\.html"/g, 'href="/admin/bin"'],
  [/href="\/pages\/checkout\.html"/g, 'href="/checkout"'],
  [/href="\/pages\/my-orders\.html"/g, 'href="/my-orders"'],
  [/href="\/pages\/product\.html/g, 'href="/product'],
  [/href="\/pages\/receipt\.html/g, 'href="/receipt'],
  [/href="\/pages\/bmi-calculator\.html"/g, 'href="/bmi-calculator"']
];

let count = 0;
for (const file of files) {
  if (!fs.existsSync(file)) continue;
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
    console.log('Updated clean URLs in:', path.relative(ROOT, file));
  }
}

console.log('Total files updated to clean URLs:', count);
