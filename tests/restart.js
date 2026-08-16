// scratch/restart.js
const { execSync } = require('child_process');
try {
  const out = execSync('netstat -ano').toString();
  const match = out.split('\n').find(l => l.includes(':3000') && l.includes('LISTENING'));
  if (match) {
    const pid = match.trim().split(/\s+/).pop();
    console.log('Killing PID:', pid);
    execSync('taskkill /F /PID ' + pid);
    console.log('Killed successfully.');
  } else {
    console.log('No process listening on port 3000.');
  }
} catch (e) {
  console.log('Done or error:', e.message);
}
