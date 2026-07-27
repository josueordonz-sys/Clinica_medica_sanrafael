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
    const [rows] = await pool.execute('SELECT pac_dni, pac_pnom, pac_password FROM PACIENTES');
    console.log("Pacientes:", rows);
    const [empRows] = await pool.execute('SELECT emp_dni, emp_pnom, emp_password FROM EMPLEADOS');
    console.log("Empleados:", empRows);
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
check();
