const pool = require('../config/database');
const fs = require('fs');
const path = require('path');

async function initializeDatabase() {
  try {
    const schemaSQL = fs.readFileSync(
      path.join(__dirname, 'schema.sql'),
      'utf8'
    );
    
    await pool.query(schemaSQL);
    console.log('✅ Database schema initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
}

module.exports = { initializeDatabase };