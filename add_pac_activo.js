const mysql = require('mysql2/promise');
require('dotenv').config();

async function main() {
  try {
    const pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: Number(process.env.DB_PORT || 3306),
    });

    console.log("Adding pac_activo column to PACIENTES table...");
    await pool.execute('ALTER TABLE PACIENTES ADD COLUMN pac_activo TINYINT(1) NOT NULL DEFAULT 1;');
    console.log("Column added successfully!");
    process.exit(0);
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log("Column already exists.");
      process.exit(0);
    }
    console.error("Error:", err);
    process.exit(1);
  }
}

main();
