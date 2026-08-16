const { spawn } = require('child_process');

console.log('Starting ENMAR server for full system suite...');
const server = spawn('node', ['server.js'], { cwd: process.cwd(), stdio: 'inherit' });

setTimeout(() => {
  const suite = spawn('node', ['scratch/test-all-apis-comprehensive.js'], { cwd: process.cwd(), stdio: 'inherit' });
  suite.on('close', code => {
    server.kill('SIGTERM');
    process.exit(code);
  });
}, 2500);
