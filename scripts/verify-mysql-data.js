/**
 * MySQL Data Migration Verification Script for ENMAR
 * 
 * This script safely verifies the existing MySQL database migration
 * by checking: tables, row counts, primary keys, foreign keys, indexes,
 * column data types, and whether any application code still references
 * data/store.json.
 * 
 * It does NOT modify or delete any production data.
 */

const pool = require('../config/db.js');
const fs = require('fs');
const path = require('path');

const DB_NAME = 'enmar_db';