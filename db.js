// db.js
const mysql = require('mysql2');

const db = mysql.createConnection({
  host: '127.0.0.1',
  user: 'root',          // change if needed
  password: 'Republic_C207',          // change if needed
  database: 'stock_portal'
});

db.connect((err) => {
  if (err) {
    console.warn('⚠️ Warning: Could not connect to MySQL:', err.code);
    console.log('App will continue but database features may not work.');
  } else {
    console.log('✅ Connected to MySQL database: stock_portal');
  }
});

module.exports = db;
