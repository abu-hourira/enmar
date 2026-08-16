// scratch/test-db-connection.js
const mysql = require('mysql2/promise');

async function testConnection() {
  console.log('Testing MySQL Connection on localhost:3306...');
  try {
    const conn = await mysql.createConnection({
      host: '127.0.0.1',
      user: 'root',
      password: '',
      port: 3306
    });
    console.log('✅ Connected to MySQL Server successfully!');

    const [dbs] = await conn.query('SHOW DATABASES');
    console.log('Available Databases:', dbs.map(d => d.Database));

    const dbName = dbs.find(d => d.Database === 'enmar_db') ? 'enmar_db' : null;
    if (dbName) {
      console.log(`\nChecking tables in ${dbName}...`);
      await conn.query(`USE ${dbName}`);
      const [tables] = await conn.query('SHOW TABLES');
      console.log('Tables found:', tables.map(t => Object.values(t)[0]));
    } else {
      console.log('Note: enmar_db database not found in list yet.');
    }

    await conn.end();
  } catch (err) {
    console.error('❌ Connection error:', err.message);
  }
}

testConnection();
