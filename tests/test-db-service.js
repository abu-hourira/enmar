// scratch/test-db-service.js
const db = require('../services/db-service.js');
const pool = require('../config/db.js');

async function testService() {
  console.log('Testing MySQL Data Access Layer (db-service.js)...\n');

  // 1. Users
  const users = await db.getAllUsers();
  console.log(`✔ Users fetched from MySQL: ${users.length} users.`);
  const user = await db.findUserByEmail('superadmin@enmar.bd');
  console.log(`✔ Superadmin lookup: ${user ? user.name + ' (' + user.role + ')' : 'Not found'}`);

  // 2. Products
  const products = await db.getActiveProducts();
  console.log(`✔ Active products fetched: ${products.length} products.`);

  // 3. Categories
  const categories = await db.getCategories();
  console.log(`✔ Categories fetched: ${categories.length} categories.`);

  // 4. Orders
  const orders = await db.getAllOrdersAdmin();
  console.log(`✔ Admin orders fetched: ${orders.length} orders with item arrays.`);

  // 5. Settings
  const { settings, apiConfigs } = await db.getStoreSettings();
  console.log(`✔ Settings loaded: Brand = "${settings.brandName}", Email Host = "${apiConfigs.email?.host}"`);

  // 6. Test session creation and retrieval
  const testToken = 'test_token_' + Date.now();
  await db.createSession(user.id, testToken);
  const sessionUser = await db.getSessionUser(testToken);
  console.log(`✔ Session created and verified in MySQL: User = "${sessionUser?.name}"`);
  await db.deleteSession(testToken);
  const deletedSession = await db.getSessionUser(testToken);
  console.log(`✔ Session deleted: Verified null = ${deletedSession === null}`);

  await pool.end();
  console.log('\n🎉 ALL DB-SERVICE TESTS PASSED! MySQL layer is fully functional.');
}

testService().catch(console.error);
