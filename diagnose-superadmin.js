const dbService = require('./db-service.js');

(async () => {
  try {
    const users = await dbService.getAllUsers();
    console.log('All users in database:');
    users.forEach(u => {
      console.log(`ID: ${u.id}, Email: ${u.email}, Role: ${u.role}, Active: ${u.active}`);
    });
    
    const superadmins = users.filter(u => u.role === 'superadmin');
    console.log(`\nFound ${superadmins.length} superadmin(s)`);
    if (superadmins.length > 0) {
      console.log('First superadmin ID:', superadmins[0].id);
    }
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();