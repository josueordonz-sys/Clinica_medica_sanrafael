require('dotenv').config({ quiet: true });
const mysql = require('mysql2/promise');

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
  });

  const conn = await pool.getConnection();

  try {
    // 1. Agregar descripción a ROLES si no existe
    try {
      await conn.execute('ALTER TABLE ROLES ADD COLUMN rol_desc VARCHAR(255) DEFAULT NULL');
      console.log('✓ Columna rol_desc agregada a ROLES');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') console.log('• rol_desc ya existe en ROLES');
      else throw e;
    }

    // 2. Crear tabla SE_OBJETOS
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS SE_OBJETOS (
        obj_id INT AUTO_INCREMENT PRIMARY KEY,
        obj_nombre VARCHAR(100) NOT NULL UNIQUE,
        obj_descripcion VARCHAR(255),
        obj_activo TINYINT(1) NOT NULL DEFAULT 1,
        obj_creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ Tabla SE_OBJETOS creada');

    // 3. Crear tabla SE_PERMISOS
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS SE_PERMISOS (
        perm_id INT AUTO_INCREMENT PRIMARY KEY,
        rol_id INT NOT NULL,
        obj_id INT NOT NULL,
        perm_ver TINYINT(1) NOT NULL DEFAULT 0,
        perm_insertar TINYINT(1) NOT NULL DEFAULT 0,
        perm_editar TINYINT(1) NOT NULL DEFAULT 0,
        perm_eliminar TINYINT(1) NOT NULL DEFAULT 0,
        perm_creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_rol_obj (rol_id, obj_id),
        CONSTRAINT fk_perm_rol FOREIGN KEY (rol_id) REFERENCES ROLES(rol_id)
          ON UPDATE CASCADE ON DELETE CASCADE,
        CONSTRAINT fk_perm_obj FOREIGN KEY (obj_id) REFERENCES SE_OBJETOS(obj_id)
          ON UPDATE CASCADE ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ Tabla SE_PERMISOS creada');

    // 4. Datos semilla de objetos (las pantallas del sistema)
    const objetos = [
      ['Dashboard', 'Panel de control administrativo'],
      ['Pacientes', 'Registro y gestión de pacientes'],
      ['Citas', 'Agenda de citas médicas'],
      ['Consulta Médica', 'Consultorio y expediente digital'],
      ['Triaje', 'Monitor de signos vitales'],
      ['Facturación', 'Facturación y cobros'],
      ['Inventario', 'Inventario de medicamentos'],
      ['Seguridad', 'Módulo de seguridad del sistema'],
    ];

    for (const [nombre, desc] of objetos) {
      try {
        await conn.execute(
          'INSERT INTO SE_OBJETOS (obj_nombre, obj_descripcion) VALUES (?, ?)',
          [nombre, desc]
        );
        console.log(`  + Objeto "${nombre}" insertado`);
      } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') console.log(`  • Objeto "${nombre}" ya existe`);
        else throw e;
      }
    }

    // 5. Permisos por defecto para Administrador (todos activos)
    const [roles] = await conn.execute('SELECT rol_id FROM ROLES WHERE rol_nombre = ?', ['Administrador']);
    if (roles.length > 0) {
      const adminRolId = roles[0].rol_id;
      const [objs] = await conn.execute('SELECT obj_id FROM SE_OBJETOS');
      for (const obj of objs) {
        try {
          await conn.execute(
            'INSERT INTO SE_PERMISOS (rol_id, obj_id, perm_ver, perm_insertar, perm_editar, perm_eliminar) VALUES (?, ?, 1, 1, 1, 1)',
            [adminRolId, obj.obj_id]
          );
        } catch (e) {
          if (e.code !== 'ER_DUP_ENTRY') throw e;
        }
      }
      console.log('✓ Permisos de Administrador creados');
    }

    console.log('\n✅ Migración completada exitosamente.');
  } catch (err) {
    console.error('❌ Error en migración:', err);
  } finally {
    conn.release();
    process.exit(0);
  }
}

main();
