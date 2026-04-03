require('dotenv').config();
const mysql = require('mysql2/promise');

async function testConnection() {
  console.log('Testing connection with:');
  console.log('Host:', process.env.DB_HOST || '127.0.0.1');
  console.log('User:', process.env.DB_USER || 'root');
  console.log('Database:', process.env.DB_NAME || 'sjslip');
  console.log('Password Length:', (process.env.DB_PASSWORD || '').length);

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD === undefined ? '' : process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'sjslip',
      port: process.env.DB_PORT || 3306,
    });
    console.log('\n✅ Connection successful!');
    await connection.end();
  } catch (err) {
    console.error('\n❌ Connection failed!');
    console.error('Error Code:', err.code);
    console.error('Error Message:', err.message);
    
    if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('\n💡 Tip: In XAMPP, the "root" user usually has NO password.');
      console.log('Make sure your .env has "DB_PASSWORD=" (empty) and restart the server.');
    }
    if (err.code === 'ER_BAD_DB_ERROR') {
      console.log('\n💡 Tip: The database "sjslip" was not found.');
      console.log('Please create it in phpMyAdmin first or run the schema.sql.');
    }
  }
}

testConnection();
