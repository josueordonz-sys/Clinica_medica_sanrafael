const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function test() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'sirec_clinica'
  });

  const dni = '9999-9999-99999';
  const primerNombre = 'TestFirst';
  const segundoNombre = 'TestSecond';
  const primerApellido = 'TestLast1';
  const segundoApellido = 'TestLast2';

  await connection.execute(`
    INSERT INTO PACIENTES (pac_dni, pac_pnom, pac_snom, pac_pape, pac_sape, pac_fecnac, pac_sexo)
    VALUES (?, ?, ?, ?, ?, '1990-01-01', 'M')
  `, [
    dni,
    primerNombre.trim(),
    segundoNombre?.trim() || null,
    primerApellido.trim(),
    segundoApellido?.trim() || null
  ]);

  const [rows] = await connection.execute('SELECT * FROM PACIENTES WHERE pac_dni = ?', [dni]);
  console.log(rows[0]);
  
  await connection.execute('DELETE FROM PACIENTES WHERE pac_dni = ?', [dni]);
  process.exit();
}
test();
