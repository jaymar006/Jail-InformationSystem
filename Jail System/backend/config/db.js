const mysql = require('mysql2/promise');

const db = mysql.createPool({
  host: 'localhost',
  user: 'root',       
  password: '',
  database: 'jail_visitation', 
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+08:00'  // Set timezone explicitly to Philippine Time
});

(async () => {
  try {
    const [rows] = await db.query('SELECT DATABASE() AS db');
    console.log('✅ Connected to database:', rows[0].db);
  } catch (err) {
    console.error('❌ Failed to connect to database:', err);
  }
})();

module.exports = db;
