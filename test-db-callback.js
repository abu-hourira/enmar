/**
 * Database Callback Test Script for ENMAR
 * This script verifies database connectivity and performs CRUD operations
 * using a dedicated temporary test table.
 *
 * It connects to MySQL using the configuration from .env (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME).
 * No real application data is modified or deleted.
 */

const pool = require('./db.js'); // MySQL connection pool defined in db.js
const fs = require('fs');
const path = require('path');

const TEST_TABLE = 'db_connectivity_test';

async function runTests() {
  console.log('🔍 Starting database connectivity and CRUD tests...\n');

  // --- Step A: Establish connection ---
  try {
    const connection = await pool.getConnection();
    console.log('✅ Successfully connected to MySQL.');

    // --- Step B: Create test table ---
    const createTestTableQuery = `
      CREATE TABLE IF NOT EXISTS ${TEST_TABLE} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        test_field VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`;
    await connection.execute(createTestTableQuery);
    console.log(`✅ Created test table "${TEST_TABLE}".`);

    // --- Step C: CREATE ---
    const insertRes = await connection.execute(
      `INSERT INTO ${TEST_TABLE} (test_field) VALUES (?)`,
      ['initial-test-value']
    );
    const insertedId = insertRes[0].insertId;
    console.log(`✅ CREATE: Inserted row ID ${insertedId}.`);

    // --- Step D: READ ---
    const readRes = await connection.execute(
      `SELECT * FROM ${TEST_TABLE} WHERE id = ?`,
      [insertedId]
    );
    if (readRes[0].length === 1 && readRes[0][0].test_field === 'initial-test-value') {
      console.log('✅ READ: Retrieved correct value ("initial-test-value").');
    } else {
      throw new Error('READ operation mismatch');
    }

    // --- Step E: UPDATE ---
    const updateRes = await connection.execute(
      `UPDATE ${TEST_TABLE} SET test_field = ? WHERE id = ?`,
      ['updated-value', insertedId]
    );
    if (updateRes[0].affectedRows !== 1) {
      throw new Error('UPDATE did not affect expected number of rows');
    }
    console.log('✅ UPDATE: Row updated.');

    const updatedReadRes = await connection.execute(
      `SELECT * FROM ${TEST_TABLE} WHERE id = ?`,
      [insertedId]
    );
    if (updatedReadRes[0][0].test_field !== 'updated-value') {
      throw new Error('Updated value mismatch');
    }

    // --- Step F: DELETE ---
    const deleteRes = await connection.execute(
      `DELETE FROM ${TEST_TABLE} WHERE id = ?`,
      [insertedId]
    );
    if (deleteRes[0].affectedRows !== 1) {
      throw new Error('DELETE did not clean up properly');
    }
    console.log('✅ DELETE: Removed test row.');

    // --- Step G: Cleanup ---
    await connection.execute(`DROP TABLE ${TEST_TABLE}`);
    console.log(`🧹 Cleaned up test table "${TEST_TABLE}".`);

    connection.release();
    console.log('\n🎉 All tests passed successfully!\n');

  } catch (err) {
    console.error('❌ Database test failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end(); // Gracefully close the pool
  }
}

// Execute test suite
runTests();