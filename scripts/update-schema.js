require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function updateSchema() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD === undefined ? '' : process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'sjslip',
    port: process.env.DB_PORT || 3306,
    multipleStatements: true
  });

  try {
    const schemaSql = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8');
    await connection.query(schemaSql);
    console.log('Database schema updated successfully.');
  } catch (error) {
    console.error('Error updating schema:', error);
  } finally {
    await connection.end();
  }
}

updateSchema();
