const fs = require('fs');
const html = fs.readFileSync('c:/xampp/htdocs/enma/admin/settings.html', 'utf8');

const scriptMatches = [...html.matchAll(/<script[\s\S]*?>([\s\S]*?)<\/script>/gi)];
console.log(`Found ${scriptMatches.length} script blocks.`);

scriptMatches.forEach((m, idx) => {
  const code = m[1];
  if (!code.trim()) return;
  try {
    new Function(code);
    console.log(`✔ Script block ${idx + 1} passed syntax check.`);
  } catch (err) {
    console.error(`❌ Script block ${idx + 1} syntax error:`, err.message);
    process.exit(1);
  }
});
console.log('All inline scripts in admin/settings.html are 100% syntactically valid!');
