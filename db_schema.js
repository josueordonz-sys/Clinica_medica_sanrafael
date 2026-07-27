require('dotenv').config();
const mysql = require('mysql2/promise');

async function check() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306)
  });

  try {
    const [rows] = await pool.execute('DESCRIBE PACIENTES');
    console.log(rows);
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
check();
