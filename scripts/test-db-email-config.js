// scripts/test-db-email-config.js
const pool = require('../config/db.js');
const dbService = require('../services/db-service.js');

(async () => {
  try {
    console.log('1. Checking getEmailConfig before insert...');
    let cfg = await dbService.getEmailConfig();
    console.log('   Initial DB Result:', cfg);

    console.log('2. Inserting manual email gateway config into MySQL...');
    await pool.query(`
      INSERT INTO email_gateway_config 
        (id, provider, host, port, username, password_encrypted, from_email, from_name, use_tls)
      VALUES 
        (1, 'smtp', 'smtp.gmail.com', 465, 'mdhourira6712@gmail.com', 'abcdefghijklmnop', 'mdhourira6712@gmail.com', 'ENMAR Official', 1)
      ON DUPLICATE KEY UPDATE
        provider=VALUES(provider),
        host=VALUES(host),
        port=VALUES(port),
        username=VALUES(username),
        password_encrypted=VALUES(password_encrypted),
        from_email=VALUES(from_email),
        from_name=VALUES(from_name),
        use_tls=VALUES(use_tls)
    `);

    console.log('3. Reading getEmailConfig after database insert...');
    cfg = await dbService.getEmailConfig();
    console.log('   Retrieved Config:', {
      host: cfg.host,
      port: cfg.port,
      username: cfg.username,
      password: cfg.password,
      fromEmail: cfg.fromEmail,
      fromName: cfg.fromName
    });

    if (cfg && cfg.username === 'mdhourira6712@gmail.com' && cfg.password === 'abcdefghijklmnop') {
      console.log('\n✅ DIRECT DATABASE EMAIL CONFIGURATION IS FULLY FUNCTIONAL!');
    }
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
})();
