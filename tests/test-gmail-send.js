// scratch/test-gmail-send.js
const { emailConfig, verifySmtp, sendEmail } = require('../server.js');
const fs = require('fs');

async function testGmail() {
  const store = JSON.parse(fs.readFileSync('data/store.json', 'utf8'));
  console.log('Testing Gmail SMTP with config:');
  const cfg = store.apiConfigs.email;
  console.log({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    user: cfg.user,
    fromEmail: cfg.fromEmail,
    passLength: cfg.pass ? cfg.pass.length : 0
  });

  console.log('\n1. Testing verifySmtp...');
  try {
    // We can run verifySmtp logic
    const tls = require('node:tls');
    const net = require('node:net');
    
    console.log('Connecting to Gmail TLS...');
    const sock = tls.connect({ host: cfg.host, port: cfg.port, servername: cfg.host });
    sock.on('secureConnect', () => {
      console.log('✅ TLS socket connected to smtp.gmail.com:465!');
    });
    sock.on('error', err => {
      console.error('❌ Socket error:', err);
    });
    let buffer = '';
    sock.on('data', chunk => {
      buffer += chunk.toString();
      console.log('<< Received from Gmail:', chunk.toString().trim());
      if (buffer.includes('220 ') && buffer.includes('smtp.gmail.com')) {
        console.log('>> Sending EHLO localhost');
        sock.write('EHLO localhost\r\n');
      } else if (buffer.includes('250-AUTH LOGIN') || buffer.includes('250 AUTH')) {
        console.log('>> Sending AUTH LOGIN');
        sock.write('AUTH LOGIN\r\n');
      } else if (buffer.includes('334 VXNlcm5hbWU6')) { // Username: in base64
        console.log('>> Sending Username base64');
        sock.write(Buffer.from(cfg.user).toString('base64') + '\r\n');
      } else if (buffer.includes('334 UGFzc3dvcmQ6')) { // Password: in base64
        console.log('>> Sending Password base64');
        sock.write(Buffer.from(cfg.pass).toString('base64') + '\r\n');
      } else if (buffer.includes('235 ')) {
        console.log('🎉 Gmail Authentication Succeeded (235 2.7.0 Accepted)!');
        sock.destroy();
      } else if (buffer.includes('535 ')) {
        console.log('❌ Gmail Authentication Failed (535):', buffer);
        sock.destroy();
      }
    });
  } catch (err) {
    console.error('Catch error:', err);
  }
}

testGmail();
