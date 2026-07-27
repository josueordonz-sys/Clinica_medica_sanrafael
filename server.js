require('dotenv').config({ quiet: true });

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { enviarClaveProvisional, generarClaveProvisional } = require('./emailService');

const BCRYPT_SALT_ROUNDS = 10;

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(require('path').join(__dirname, 'public')));
app.use('/src', express.static(require('path').join(__dirname, 'src')));

// ── Utilidad: Detectar y bloquear patrones de SQL Injection ──
const SQL_INJECTION_PATTERNS = [
  /(\b(OR|AND)\b\s+\d+\s*=\s*\d+)/i,          // OR 1=1, AND 1=1
  /(\b(OR|AND)\b\s+'\w*'\s*=\s*'\w*')/i,       // OR 'a'='a'
  /(UNION\s+(ALL\s+)?SELECT)/i,                  // UNION SELECT
  /(DROP\s+(TABLE|DATABASE))/i,                  // DROP TABLE
  /(INSERT\s+INTO)/i,                             // INSERT INTO
  /(DELETE\s+FROM)/i,                             // DELETE FROM
  /(UPDATE\s+\w+\s+SET)/i,                       // UPDATE SET
  /(ALTER\s+TABLE)/i,                             // ALTER TABLE
  /(-{2}|#|\/\*)/,                                // Comentarios SQL: --, #, /*
  /(;\s*(DROP|DELETE|UPDATE|INSERT|ALTER|CREATE|EXEC|EXECUTE))/i, // Encadenamiento de sentencias
  /(\bEXEC(UTE)?\b\s)/i,                         // EXEC / EXECUTE
  /(\bSLEEP\s*\()/i,                             // SLEEP()
  /(\bBENCHMARK\s*\()/i,                         // BENCHMARK()
  /(\bCHAR\s*\()/i,                              // CHAR()
  /(\bLOAD_FILE\s*\()/i,                         // LOAD_FILE()
  /(\bINFORMATION_SCHEMA\b)/i,                   // INFORMATION_SCHEMA
];

function containsSQLInjection(value) {
  if (typeof value !== 'string') return false;
  return SQL_INJECTION_PATTERNS.some(pattern => pattern.test(value));
}

function sanitizeInput(value) {
  if (typeof value !== 'string') return value;
  // Rechazar si contiene patrones peligrosos
  if (containsSQLInjection(value)) {
    return null; // Señal de input rechazado
  }
  return value.trim();
}

const allowedOrigins = new Set([
  'http://127.0.0.1:3000',
  'http://localhost:3000',
  'https://web-production-e8a98.up.railway.app',
  'http://127.0.0.1:5502',
  'http://127.0.0.1:5503',
  'http://localhost:5502',
  'http://localhost:5503'
]);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`Origen no permitido por CORS: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

function getDatabaseConfig() {
  const connectionUrl = process.env.DATABASE_URL || process.env.MYSQL_URL;
  let urlConfig = {};

  if (connectionUrl) {
    try {
      const parsedUrl = new URL(connectionUrl);
      urlConfig = {
        host: parsedUrl.hostname,
        user: decodeURIComponent(parsedUrl.username),
        password: decodeURIComponent(parsedUrl.password),
        database: parsedUrl.pathname.replace(/^\//, ''),
        port: Number(parsedUrl.port || 3306)
      };
    } catch (error) {
      console.error('La variable DATABASE_URL/MYSQL_URL no tiene un formato valido.');
    }
  }

  return {
    host: process.env.DB_HOST || process.env.MYSQLHOST || process.env.MYSQL_HOST || urlConfig.host,
    user: process.env.DB_USER || process.env.MYSQLUSER || process.env.MYSQL_USER || urlConfig.user,
    password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD || urlConfig.password,
    database: process.env.DB_NAME || process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || urlConfig.database,
    port: Number(process.env.DB_PORT || process.env.MYSQLPORT || process.env.MYSQL_PORT || urlConfig.port || 3306)
  };
}

const databaseConfig = getDatabaseConfig();
const pool = mysql.createPool({
  ...databaseConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function testDatabaseConnection() {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    console.log('Conexion a MySQL establecida correctamente.');
    return true;
  } catch (error) {
    console.error('Error conectando a MySQL:', error.message);
    return false;
  }
}

function isDatabaseConnectionError(error) {
  return [
    'ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT',
    'ER_ACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR'
  ].includes(error?.code);
}

app.get('/api/salud', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    return res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    console.error('Error en comprobacion de salud de MySQL:', error.message);
    return res.status(503).json({ status: 'error', database: 'unavailable' });
  }
});

async function getPatientColumns(connection = pool) {
  const [rows] = await connection.execute('SHOW COLUMNS FROM PACIENTES');
  return new Set(rows.map((row) => row.Field));
}

async function ensurePatientSchema(connection = pool) {
  let columns = await getPatientColumns(connection);

  // No usamos AFTER: las bases antiguas pueden no tener la columna de referencia.
  if (!columns.has('pac_password')) {
    await connection.execute('ALTER TABLE PACIENTES ADD COLUMN pac_password VARCHAR(255) DEFAULT NULL');
    console.log('Columna PACIENTES.pac_password creada correctamente.');
    columns = await getPatientColumns(connection);
  }

  if (!columns.has('pac_activo')) {
    await connection.execute('ALTER TABLE PACIENTES ADD COLUMN pac_activo TINYINT(1) NOT NULL DEFAULT 1');
    console.log('Columna PACIENTES.pac_activo creada correctamente.');
    columns = await getPatientColumns(connection);
  }

  return columns;
}

function splitFullName(fullName = '') {
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts.shift() || 'Sin nombre',
    secondName: parts.length > 1 ? parts.shift() : null,
    firstLastName: parts.shift() || 'Sin apellido',
    secondLastName: parts.length > 0 ? parts.join(' ') : null
  };
}

function normalizeSex(value = '') {
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'f' || normalized.startsWith('femen')) return 'F';
  return 'M';
}

function normalizeDni(value = '') {
  return String(value || '').replace(/\D/g, '');
}

function parseAppointmentId(id) {
  if (typeof id === 'number') return id;
  const match = String(id || '').match(/\d+/);
  return match ? Number(match[0]) : null;
}

function formatAppointmentId(id) {
  return `CIT${String(id).padStart(4, '0')}`;
}

function normalizeTime(value = '') {
  const match = String(value).match(/(\d{1,2}):(\d{2})/);
  if (!match) return '00:00:00';
  return `${match[1].padStart(2, '0')}:${match[2]}:00`;
}

async function getOrCreateSpecialtyId(name, connection = pool) {
  const specialtyName = name || 'Medicina General';
  const [rows] = await connection.execute(
    'SELECT esp_id FROM ESPECIALIDADES WHERE esp_nombre = ? LIMIT 1',
    [specialtyName]
  );

  if (rows.length > 0) return rows[0].esp_id;

  const [result] = await connection.execute(
    'INSERT INTO ESPECIALIDADES (esp_nombre, esp_desc) VALUES (?, ?)',
    [specialtyName, 'Especialidad registrada desde la aplicacion web']
  );

  return result.insertId;
}

async function getOrCreateRoleId(roleName, connection = pool) {
  const normalizedRoleName = roleName || 'Paciente';
  const [roles] = await connection.execute(
    'SELECT rol_id FROM ROLES WHERE rol_nombre = ? LIMIT 1',
    [normalizedRoleName]
  );

  if (roles.length > 0) {
    return roles[0].rol_id;
  }

  const roleLevels = {
    Administrador: 1,
    Recepcionista: 2,
    Enfermeria: 3,
    Medico: 4,
    Paciente: 5
  };

  const [result] = await connection.execute(
    'INSERT INTO ROLES (rol_nombre, rol_nivel) VALUES (?, ?)',
    [normalizedRoleName, roleLevels[normalizedRoleName] || 99]
  );

  return result.insertId;
}

async function getOrCreateEmployeeId(name, specialtyName, connection = pool) {
  const employeeName = name || 'Medico no especificado';
  const generatedEmail = `${employeeName.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '') || 'empleado'}@sirec.local`;
  const [existing] = await connection.execute(
    'SELECT emp_id FROM EMPLEADOS WHERE emp_email = ? LIMIT 1',
    [generatedEmail]
  );

  if (existing.length > 0) return existing[0].emp_id;

  const roleId = await getOrCreateRoleId('Medico', connection);
  const specialtyId = await getOrCreateSpecialtyId(specialtyName, connection);
  const names = splitFullName(employeeName);
  const dni = `EMP${String(Date.now()).slice(-12)}`.slice(0, 15);

  const [result] = await connection.execute(
    `INSERT INTO EMPLEADOS (
      emp_dni,
      emp_pnom,
      emp_snom,
      emp_pape,
      emp_sape,
      emp_email,
      rol_id,
      esp_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      dni,
      names.firstName,
      names.secondName,
      names.firstLastName,
      names.secondLastName,
      generatedEmail,
      roleId,
      specialtyId
    ]
  );

  return result.insertId;
}

async function getAppointmentByDisplayId(displayId, connection = pool) {
  const id = parseAppointmentId(displayId);
  if (!id) return null;

  const [rows] = await connection.execute(
    'SELECT cit_id FROM CITA WHERE cit_id = ? LIMIT 1',
    [id]
  );

  return rows.length > 0 ? rows[0].cit_id : null;
}

function mapPatient(row) {
  return {
    dni: row.pac_dni,
    nombres: [row.pac_pnom, row.pac_snom].filter(Boolean).join(' '),
    apellidos: [row.pac_pape, row.pac_sape].filter(Boolean).join(' '),
    fechaNacimiento: row.pac_fecnac instanceof Date ? row.pac_fecnac.toISOString().slice(0, 10) : row.pac_fecnac,
    genero: row.pac_sexo === 'F' ? 'Femenino' : 'Masculino',
    telefono: row.pac_tel || '',
    correo: row.pac_email || '',
    direccion: row.pac_dir || '',
    tipoSangre: row.pac_tipo_sangre || 'No sabe',
    contactoEmergencia: row.pac_contacto_emergencia || '',
    alergias: row.pac_alergias || '',
    activo: row.pac_activo !== 0
  };
}

function mapAppointment(row) {
  const fecha = row.cit_fecha instanceof Date ? row.cit_fecha.toISOString().slice(0, 10) : row.cit_fecha;
  const hora = String(row.cit_hora || '').slice(0, 5);
  const receta = typeof row.receta_json === 'string'
    ? JSON.parse(row.receta_json)
    : (row.receta_json || []);
  const cargosServicios = typeof row.cargos_json === 'string'
    ? JSON.parse(row.cargos_json)
    : (row.cargos_json || []);

  return {
    id: formatAppointmentId(row.cit_id),
    facturaNum: row.cit_factura_num || '',
    pacienteDni: row.pac_dni,
    pacienteNombre: [row.pac_pnom, row.pac_snom, row.pac_pape, row.pac_sape].filter(Boolean).join(' '),
    especialidad: row.esp_nombre,
    medico: [row.emp_pnom, row.emp_snom, row.emp_pape, row.emp_sape].filter(Boolean).join(' '),
    fecha,
    hora,
    monto: Number(row.cit_monto || 0),
    montoPendiente: Number(row.cit_monto_pendiente || 0),
    observaciones: row.cit_observaciones || '',
    estado: row.cit_estado,
    receta,
    cargosServicios,
    fechaPago: row.pago_fecha ? new Date(row.pago_fecha).getTime() : null,
    montoPagado: row.pago_monto != null ? Number(row.pago_monto) : null,
    metodoPago: row.pago_metodo || 'Efectivo',
    timestamp: row.cit_creada_en ? new Date(row.cit_creada_en).getTime() : Date.now()
  };
}

function mapMedication(row) {
  return {
    id: row.med_codigo,
    id_medicamento: row.med_codigo,
    nombre_medicamento: row.med_nombre,
    stock_actual: Number(row.med_stock_actual || 0),
    precio_venta: Number(row.med_precio_venta || 0)
  };
}

app.post('/api/pacientes', async (req, res) => {
  const {
    pac_dni = req.body.dni,
    pac_pnom,
    pac_snom,
    pac_pape,
    pac_sape,
    pac_sexo,
    pac_fecnac = req.body.fechaNacimiento,
    pac_tel = req.body.telefono,
    pac_dir = req.body.direccion,
    pac_email = req.body.correo
  } = req.body;

  const nombres = String(req.body.nombres || '').trim().split(/\s+/).filter(Boolean);
  const apellidos = String(req.body.apellidos || '').trim().split(/\s+/).filter(Boolean);
  const firstName = pac_pnom || nombres[0];
  const secondName = pac_snom || nombres.slice(1).join(' ') || null;
  const firstLastName = pac_pape || apellidos[0];
  const secondLastName = pac_sape || apellidos.slice(1).join(' ') || null;
  const sex = pac_sexo || normalizeSex(req.body.genero);

  if (!pac_dni || !firstName || !firstLastName || !sex || !pac_fecnac) {
    return res.status(400).json({
      message: 'Los campos pac_dni, pac_pnom, pac_pape, pac_sexo y pac_fecnac son obligatorios.'
    });
  }

  const sql = `
    INSERT INTO PACIENTES (
      pac_dni,
      pac_pnom,
      pac_snom,
      pac_pape,
      pac_sape,
      pac_sexo,
      pac_fecnac,
      pac_tel,
      pac_dir,
      pac_email,
      pac_tipo_sangre,
      pac_contacto_emergencia,
      pac_alergias
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    pac_dni,
    firstName,
    secondName || null,
    firstLastName,
    secondLastName || null,
    sex,
    pac_fecnac,
    pac_tel || null,
    pac_dir || null,
    pac_email || null,
    req.body.tipoSangre || 'No sabe',
    req.body.contactoEmergencia || null,
    req.body.alergias || null
  ];

  try {
    await pool.execute(sql, values);
    return res.status(201).json({
      dni: pac_dni,
      nombres: [firstName, secondName].filter(Boolean).join(' '),
      apellidos: [firstLastName, secondLastName].filter(Boolean).join(' '),
      fechaNacimiento: pac_fecnac,
      genero: sex === 'F' ? 'Femenino' : 'Masculino',
      telefono: pac_tel || '',
      correo: pac_email || '',
      direccion: pac_dir || '',
      tipoSangre: req.body.tipoSangre || 'No sabe',
      contactoEmergencia: req.body.contactoEmergencia || '',
      alergias: req.body.alergias || ''
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Ya existe un paciente con ese DNI.' });
    }

    if (error.code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
      return res.status(400).json({ message: 'El campo pac_sexo solo acepta M o F.' });
    }

    console.error('Error registrando paciente:', error);
    return res.status(500).json({ message: 'Error interno registrando paciente.' });
  }
});

async function getOrCreateRoleId(roleName, connection = pool) {
  const normalizedRoleName = roleName || 'Paciente';
  const [roles] = await connection.execute(
    'SELECT rol_id FROM ROLES WHERE rol_nombre = ? LIMIT 1',
    [normalizedRoleName]
  );

  if (roles.length > 0) {
    return roles[0].rol_id;
  }

  const roleLevels = {
    Administrador: 1,
    Recepcionista: 2,
    Enfermeria: 3,
    Medico: 4,
    Paciente: 5
  };

  const [result] = await connection.execute(
    'INSERT INTO ROLES (rol_nombre, rol_nivel) VALUES (?, ?)',
    [normalizedRoleName, roleLevels[normalizedRoleName] || 99]
  );

  return result.insertId;
}

// ============================================================
// AUTENTICACION: Login contra tabla EMPLEADOS
// ============================================================
app.post('/api/login', async (req, res) => {
  let { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Usuario (Correo o DNI) y contraseña son obligatorios.' });
  }

  // Sanitización de entradas
  email = sanitizeInput(String(email).trim());
  password = sanitizeInput(password);

  if (email === null || password === null) {
    return res.status(403).json({ message: 'Petición bloqueada por seguridad. Se detectaron caracteres no permitidos.' });
  }
  try {
    // Buscar empleado por email o DNI (sin comparar password en SQL)
    const [rows] = await pool.execute(`
      SELECT
        e.emp_id AS id,
        e.emp_dni AS dni,
        CONCAT_WS(' ', e.emp_pnom, e.emp_snom, e.emp_pape, e.emp_sape) AS name,
        e.emp_email AS email,
        e.emp_password AS storedPassword,
        r.rol_nombre AS role,
        COALESCE(esp.esp_nombre, '') AS especialidad,
        e.emp_activo AS activo
      FROM EMPLEADOS e
      INNER JOIN ROLES r ON r.rol_id = e.rol_id
      LEFT JOIN ESPECIALIDADES esp ON esp.esp_id = e.esp_id
      WHERE (LOWER(TRIM(e.emp_email)) = LOWER(TRIM(?)) OR REPLACE(e.emp_dni, '-', '') = REPLACE(?, '-', ''))
      LIMIT 1
    `, [email, email]);

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Credenciales inválidas.' });
    }

    const storedPassword = rows[0].storedPassword;
    let passwordValid = false;

    // Verificar si el hash almacenado es bcrypt (comienza con $2a$ o $2b$)
    if (storedPassword && storedPassword.startsWith('$2')) {
      passwordValid = await bcrypt.compare(password, storedPassword);
    } else {
      // Compatibilidad: contraseña en texto plano (migración gradual)
      passwordValid = (storedPassword === password);
      // Si coincide, actualizar a bcrypt automáticamente
      if (passwordValid && storedPassword) {
        const hashed = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
        await pool.execute('UPDATE EMPLEADOS SET emp_password = ? WHERE emp_id = ?', [hashed, rows[0].id]);
        console.log(`[Seguridad] Contraseña de empleado ${rows[0].id} migrada a bcrypt.`);
      }
    }

    if (!passwordValid) {
      return res.status(401).json({ message: 'Credenciales inválidas.' });
    }

    delete rows[0].storedPassword;

    if (rows[0].activo === 0) {
      return res.status(401).json({ message: 'Tu usuario ya no está activo' });
    }
    
    const user = rows[0];

    // Consultar permisos (módulos permitidos y permisos detallados)
    const [permRows] = await pool.execute(`
      SELECT o.obj_nombre AS modulo,
             p.perm_ver AS ver, p.perm_insertar AS insertar,
             p.perm_editar AS editar, p.perm_eliminar AS eliminar
      FROM SE_PERMISOS p
      INNER JOIN SE_OBJETOS o ON o.obj_id = p.obj_id
      WHERE p.rol_id = (SELECT rol_id FROM ROLES WHERE rol_nombre = ?) 
        AND o.obj_activo = 1
    `, [user.role]);

    const permisosMap = {};
    const allowedModules = [];

    permRows.forEach(r => {
      if (r.ver === 1) {
        allowedModules.push(r.modulo);
      }
      permisosMap[r.modulo] = {
        ver: r.ver,
        insertar: r.insertar,
        editar: r.editar,
        eliminar: r.eliminar
      };
    });

    user.allowedModules = allowedModules;
    user.permisos = permisosMap;

    if (password.startsWith('PROV-')) {
      user.mustChangePassword = true;
    }
    
    return res.json(user);
  } catch (error) {
    console.error('Error en login:', error);
    return res.status(500).json({ message: 'Error interno en login.' });
  }
});

// Recuperación con clave provisional
app.post('/api/recuperar-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'El correo es obligatorio.' });

  try {
    const [rows] = await pool.execute(`
      SELECT emp_id, emp_email, CONCAT_WS(' ', emp_pnom, emp_pape) AS nombre
      FROM EMPLEADOS 
      WHERE emp_email = ? OR REPLACE(emp_dni, '-', '') = REPLACE(?, '-', '')
    `, [email, email]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    const user = rows[0];
    if (!user.emp_email) {
       return res.status(400).json({ message: 'Este usuario no tiene un correo electrónico registrado.' });
    }
    
    const claveProvisional = 'PROV-' + generarClaveProvisional();

    const hashedProvisional = await bcrypt.hash(claveProvisional, BCRYPT_SALT_ROUNDS);
    await pool.execute('UPDATE EMPLEADOS SET emp_password = ? WHERE emp_id = ?', [hashedProvisional, user.emp_id]);
    await enviarClaveProvisional(user.emp_email, user.nombre, claveProvisional);

    return res.json({ message: 'Se ha enviado una contraseña provisional a tu correo electrónico.' });
  } catch (error) {
    console.error('Error al recuperar contraseña:', error);
    return res.status(500).json({ message: 'Error al enviar el correo de recuperación.' });
  }
});

app.post('/api/reset-password', async (req, res) => {
  const { email, newPassword } = req.body;
  if (!email || !newPassword) {
    return res.status(400).json({ message: 'Usuario (Correo o DNI) y nueva contraseña son obligatorios.' });
  }
  try {
    const hashedNewPassword = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    const [result] = await pool.execute(`
      UPDATE EMPLEADOS 
      SET emp_password = ? 
      WHERE emp_email = ? OR REPLACE(emp_dni, '-', '') = REPLACE(?, '-', '')
    `, [hashedNewPassword, email, email]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    return res.json({ message: 'Contraseña actualizada correctamente.' });
  } catch (error) {
    console.error('Error al restablecer contraseña:', error);
    return res.status(500).json({ message: 'Error interno al restablecer contraseña.' });
  }
});

// ============================================================
// EMPLEADOS: Gestión de personal (reemplaza /api/usuarios)
// ============================================================
app.get('/api/empleados', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT
        e.emp_id AS id,
        e.emp_dni AS dni,
        e.emp_pnom AS pnom,
        e.emp_snom AS snom,
        e.emp_pape AS pape,
        e.emp_sape AS sape,
        e.emp_email AS email,
        e.emp_tel AS tel,
        r.rol_nombre AS role,
        r.rol_id,
        COALESCE(esp.esp_nombre, '') AS especialidad,
        COALESCE(esp.esp_id, NULL) AS esp_id,
        e.emp_activo AS activo,
        e.emp_foto AS foto
      FROM EMPLEADOS e
      INNER JOIN ROLES r ON r.rol_id = e.rol_id
      LEFT JOIN ESPECIALIDADES esp ON esp.esp_id = e.esp_id
      ORDER BY r.rol_nivel ASC, e.emp_pape ASC
    `);

    const result = rows.map(r => ({
      ...r,
      name: [r.pnom, r.snom, r.pape, r.sape].filter(Boolean).join(' ')
    }));

    return res.json(result);
  } catch (error) {
    console.error('Error consultando empleados:', error);
    return res.status(500).json({ message: 'Error interno consultando empleados.' });
  }
});

app.post('/api/empleados', async (req, res) => {
  const { dni, pnom, snom, pape, sape, email, tel, password, role, especialidad, foto } = req.body;

  if (!dni || !pnom || !pape || !email || !password || !role) {
    return res.status(400).json({
      message: 'Los campos DNI, primer nombre, primer apellido, email, contraseña y rol son obligatorios.'
    });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const roleId = await getOrCreateRoleId(role, connection);
    let specialtyId = null;

    if (role === 'Medico' && especialidad) {
      const [specs] = await connection.execute(
        'SELECT esp_id FROM ESPECIALIDADES WHERE esp_nombre = ? LIMIT 1', [especialidad]
      );
      if (specs.length > 0) {
        specialtyId = specs[0].esp_id;
      } else {
        const [newSpec] = await connection.execute(
          'INSERT INTO ESPECIALIDADES (esp_nombre, esp_desc) VALUES (?, ?)',
          [especialidad, 'Registrada desde gestión de empleados']
        );
        specialtyId = newSpec.insertId;
      }
    }

    const [result] = await connection.execute(
      `INSERT INTO EMPLEADOS (
        emp_dni, emp_pnom, emp_snom, emp_pape, emp_sape,
        emp_email, emp_tel, emp_password, rol_id, esp_id, emp_activo, emp_foto
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [dni, pnom, snom || null, pape, sape || null, email, tel || null, await bcrypt.hash(password, BCRYPT_SALT_ROUNDS), roleId, specialtyId, foto || null]
    );

    await connection.commit();
    return res.status(201).json({
      id: result.insertId, dni, pnom, snom, pape, sape, email, tel, role, especialidad
    });
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Ya existe un empleado con ese DNI o correo.' });
    }
    console.error('Error registrando empleado:', error);
    return res.status(500).json({ message: 'Error interno registrando empleado.' });
  } finally {
    connection.release();
  }
});

app.put('/api/empleados/:id', async (req, res) => {
  const empId = req.params.id;
  const { dni, pnom, snom, pape, sape, email, tel, password, role, especialidad, foto } = req.body;

  if (!dni || !pnom || !pape || !email || !role) {
    return res.status(400).json({
      message: 'Los campos DNI, primer nombre, primer apellido, email y rol son obligatorios.'
    });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const roleId = await getOrCreateRoleId(role, connection);
    let specialtyId = null;

    if (role === 'Medico' && especialidad) {
      const [specs] = await connection.execute(
        'SELECT esp_id FROM ESPECIALIDADES WHERE esp_nombre = ? LIMIT 1', [especialidad]
      );
      if (specs.length > 0) {
        specialtyId = specs[0].esp_id;
      } else {
        const [newSpec] = await connection.execute(
          'INSERT INTO ESPECIALIDADES (esp_nombre, esp_desc) VALUES (?, ?)',
          [especialidad, 'Registrada desde gestión de empleados']
        );
        specialtyId = newSpec.insertId;
      }
    }

    let sql = `
      UPDATE EMPLEADOS 
      SET emp_dni = ?, emp_pnom = ?, emp_snom = ?, emp_pape = ?, emp_sape = ?,
          emp_email = ?, emp_tel = ?, rol_id = ?, esp_id = ?
    `;
    let params = [dni, pnom, snom || null, pape, sape || null, email, tel || null, roleId, specialtyId];

    if (foto !== undefined) {
      sql += `, emp_foto = ?`;
      params.push(foto || null);
    }

    if (password) {
      sql += `, emp_password = ?`;
      params.push(await bcrypt.hash(password, BCRYPT_SALT_ROUNDS));
    }

    sql += ` WHERE emp_id = ?`;
    params.push(empId);

    const [result] = await connection.execute(sql, params);

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Empleado no encontrado.' });
    }

    await connection.commit();
    return res.json({
      id: empId, dni, pnom, snom, pape, sape, email, tel, role, especialidad
    });
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Ya existe un empleado con ese DNI o correo.' });
    }
    console.error('Error actualizando empleado:', error);
    return res.status(500).json({ message: 'Error interno actualizando empleado.' });
  } finally {
    connection.release();
  }
});

app.put('/api/empleados/:id/status', async (req, res) => {
  const empId = req.params.id;
  const { activo } = req.body;
  
  if (activo === undefined) {
    return res.status(400).json({ message: 'El estado activo es requerido.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.execute(
      'UPDATE EMPLEADOS SET emp_activo = ? WHERE emp_id = ?',
      [activo ? 1 : 0, empId]
    );
    return res.json({ message: 'Estado del empleado actualizado correctamente.' });
  } catch (error) {
    console.error('Error actualizando estado del empleado:', error);
    return res.status(500).json({ message: 'Error interno actualizando estado.' });
  } finally {
    connection.release();
  }
});

// ============================================================
// ESPECIALIDADES: Catálogo de especialidades médicas
// ============================================================
app.get('/api/especialidades', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT esp_id AS id, esp_nombre AS nombre, esp_desc AS descripcion FROM ESPECIALIDADES ORDER BY esp_nombre'
    );
    return res.json(rows);
  } catch (error) {
    console.error('Error consultando especialidades:', error);
    return res.status(500).json({ message: 'Error interno consultando especialidades.' });
  }
});

// ============================================================
// ROLES: Catálogo de roles del sistema (CRUD completo)
// ============================================================
app.get('/api/roles', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT r.rol_id AS id, r.rol_nombre AS nombre, r.rol_nivel AS nivel,
             COALESCE(r.rol_desc, '') AS descripcion,
             COUNT(e.emp_id) AS totalUsuarios,
             (SELECT GROUP_CONCAT(p.obj_id) FROM SE_PERMISOS p WHERE p.rol_id = r.rol_id AND p.perm_ver = 1) AS accesos
      FROM ROLES r
      LEFT JOIN EMPLEADOS e ON e.rol_id = r.rol_id
      GROUP BY r.rol_id
      ORDER BY r.rol_nivel
    `);
    return res.json(rows);
  } catch (error) {
    console.error('Error consultando roles:', error);
    return res.status(500).json({ message: 'Error interno consultando roles.' });
  }
});

app.post('/api/roles', async (req, res) => {
  const { nombre, nivel, descripcion, accesos } = req.body;
  if (!nombre || nivel === undefined) {
    return res.status(400).json({ message: 'Nombre y nivel son obligatorios.' });
  }
  
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [result] = await connection.execute(
      'INSERT INTO ROLES (rol_nombre, rol_nivel, rol_desc) VALUES (?, ?, ?)',
      [nombre, nivel, descripcion || null]
    );
    const rol_id = result.insertId;

    if (Array.isArray(accesos)) {
      for (const obj_id of accesos) {
        await connection.execute(
          'INSERT INTO SE_PERMISOS (rol_id, obj_id, perm_ver, perm_insertar, perm_editar, perm_eliminar) VALUES (?, ?, 1, 1, 1, 1)',
          [rol_id, obj_id]
        );
      }
    }

    await connection.commit();
    connection.release();

    return res.status(201).json({ id: rol_id, nombre, nivel, descripcion, accesos });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      if (connection) { await connection.rollback(); connection.release(); }
      return res.status(409).json({ message: 'Ya existe un rol con ese nombre.' });
    }
    if (connection) { await connection.rollback(); connection.release(); }
    console.error('Error creando rol:', error);
    return res.status(500).json({ message: 'Error interno creando rol.' });
  }
});

app.put('/api/roles/:id', async (req, res) => {
  const { nombre, nivel, descripcion, accesos } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [result] = await connection.execute(
      'UPDATE ROLES SET rol_nombre = COALESCE(?, rol_nombre), rol_nivel = COALESCE(?, rol_nivel), rol_desc = ? WHERE rol_id = ?',
      [nombre || null, nivel !== undefined ? nivel : null, descripcion !== undefined ? descripcion : null, req.params.id]
    );
    
    if (result.affectedRows === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ message: 'Rol no encontrado.' });
    }

    if (Array.isArray(accesos)) {
      // Borramos todos los permisos actuales
      await connection.execute('DELETE FROM SE_PERMISOS WHERE rol_id = ?', [req.params.id]);
      
      // Insertamos los nuevos accesos
      for (const obj_id of accesos) {
        await connection.execute(
          'INSERT INTO SE_PERMISOS (rol_id, obj_id, perm_ver, perm_insertar, perm_editar, perm_eliminar) VALUES (?, ?, 1, 1, 1, 1)',
          [req.params.id, obj_id]
        );
      }
    }

    await connection.commit();
    connection.release();

    return res.json({ message: 'Rol actualizado correctamente.' });
  } catch (error) {
    if (connection) { await connection.rollback(); connection.release(); }
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Ya existe un rol con ese nombre.' });
    }
    console.error('Error actualizando rol:', error);
    return res.status(500).json({ message: 'Error interno actualizando rol.' });
  }
});

// ============================================================
// DELETE ROL
// ============================================================
app.delete('/api/roles/:id', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    // Verificar si hay usuarios con este rol
    const [users] = await connection.execute(
      'SELECT COUNT(*) AS total FROM USUARIOS WHERE rol_id = ?', [req.params.id]
    );
    if (users[0].total > 0) {
      connection.release();
      return res.status(400).json({ message: `No se puede eliminar: hay ${users[0].total} usuario(s) asignado(s) a este rol. Reasígnalos primero.` });
    }

    await connection.beginTransaction();

    // Eliminar permisos asociados
    await connection.execute('DELETE FROM SE_PERMISOS WHERE rol_id = ?', [req.params.id]);

    // Eliminar rol
    const [result] = await connection.execute('DELETE FROM ROLES WHERE rol_id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ message: 'Rol no encontrado.' });
    }

    await connection.commit();
    connection.release();
    return res.json({ message: 'Rol eliminado correctamente.' });
  } catch (error) {
    if (connection) { await connection.rollback(); connection.release(); }
    console.error('Error eliminando rol:', error);
    return res.status(500).json({ message: 'Error interno eliminando rol.' });
  }
});

// ============================================================
// OBJETOS: Módulos / pantallas del sistema
// ============================================================
app.get('/api/objetos', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT o.obj_id AS id, o.obj_nombre AS nombre, o.obj_descripcion AS descripcion,
             o.obj_activo AS activo, o.obj_creado_en AS creadoEn,
             COUNT(DISTINCT p.rol_id) AS rolesAsignados,
             (SELECT GROUP_CONCAT(p2.rol_id) FROM SE_PERMISOS p2 WHERE p2.obj_id = o.obj_id AND p2.perm_ver = 1) AS roles
      FROM SE_OBJETOS o
      LEFT JOIN SE_PERMISOS p ON p.obj_id = o.obj_id AND (p.perm_ver = 1 OR p.perm_insertar = 1 OR p.perm_editar = 1 OR p.perm_eliminar = 1)
      GROUP BY o.obj_id
      ORDER BY o.obj_nombre
    `);
    return res.json(rows);
  } catch (error) {
    console.error('Error consultando objetos:', error);
    return res.status(500).json({ message: 'Error interno consultando objetos.' });
  }
});

app.post('/api/objetos', async (req, res) => {
  const { nombre, descripcion, roles } = req.body;
  if (!nombre) return res.status(400).json({ message: 'El nombre del objeto es obligatorio.' });
  
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [result] = await connection.execute(
      'INSERT INTO SE_OBJETOS (obj_nombre, obj_descripcion) VALUES (?, ?)',
      [nombre, descripcion || null]
    );
    const obj_id = result.insertId;

    if (Array.isArray(roles)) {
      for (const rol_id of roles) {
        await connection.execute(
          'INSERT INTO SE_PERMISOS (rol_id, obj_id, perm_ver, perm_insertar, perm_editar, perm_eliminar) VALUES (?, ?, 1, 1, 1, 1)',
          [rol_id, obj_id]
        );
      }
    }

    await connection.commit();
    connection.release();

    return res.status(201).json({ id: obj_id, nombre, descripcion, roles });
  } catch (error) {
    if (connection) { await connection.rollback(); connection.release(); }
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Ya existe un objeto con ese nombre.' });
    console.error('Error creando objeto:', error);
    return res.status(500).json({ message: 'Error interno creando objeto.' });
  }
});

app.put('/api/objetos/:id', async (req, res) => {
  const { nombre, descripcion, roles } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [result] = await connection.execute(
      'UPDATE SE_OBJETOS SET obj_nombre = COALESCE(?, obj_nombre), obj_descripcion = COALESCE(?, obj_descripcion) WHERE obj_id = ?',
      [nombre || null, descripcion !== undefined ? descripcion : null, req.params.id]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ message: 'Objeto no encontrado.' });
    }

    if (Array.isArray(roles)) {
      await connection.execute('DELETE FROM SE_PERMISOS WHERE obj_id = ?', [req.params.id]);
      for (const rol_id of roles) {
        await connection.execute(
          'INSERT INTO SE_PERMISOS (rol_id, obj_id, perm_ver, perm_insertar, perm_editar, perm_eliminar) VALUES (?, ?, 1, 1, 1, 1)',
          [rol_id, req.params.id]
        );
      }
    }

    await connection.commit();
    connection.release();

    return res.json({ message: 'Objeto actualizado correctamente.' });
  } catch (error) {
    if (connection) { await connection.rollback(); connection.release(); }
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Ya existe un objeto con ese nombre.' });
    console.error('Error actualizando objeto:', error);
    return res.status(500).json({ message: 'Error interno actualizando objeto.' });
  }
});

app.put('/api/objetos/:id/status', async (req, res) => {
  const { activo } = req.body;
  try {
    await pool.execute('UPDATE SE_OBJETOS SET obj_activo = ? WHERE obj_id = ?', [activo ? 1 : 0, req.params.id]);
    return res.json({ message: 'Estado del objeto actualizado.' });
  } catch (error) {
    console.error('Error actualizando estado del objeto:', error);
    return res.status(500).json({ message: 'Error interno.' });
  }
});

// ============================================================
// PERMISOS: Matriz de acceso (rol + objeto + flags CRUD)
// ============================================================
app.get('/api/permisos', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT p.perm_id AS id, p.rol_id AS rolId, p.obj_id AS objId,
             r.rol_nombre AS rol, o.obj_nombre AS objeto,
             p.perm_ver AS ver, p.perm_insertar AS insertar,
             p.perm_editar AS editar, p.perm_eliminar AS eliminar
      FROM SE_PERMISOS p
      INNER JOIN ROLES r ON r.rol_id = p.rol_id
      INNER JOIN SE_OBJETOS o ON o.obj_id = p.obj_id
      ORDER BY r.rol_nivel, o.obj_nombre
    `);
    return res.json(rows);
  } catch (error) {
    console.error('Error consultando permisos:', error);
    return res.status(500).json({ message: 'Error interno consultando permisos.' });
  }
});

app.post('/api/permisos', async (req, res) => {
  const { rolId, objId, ver, insertar, editar, eliminar } = req.body;
  if (!rolId || !objId) return res.status(400).json({ message: 'rolId y objId son obligatorios.' });
  try {
    const [result] = await pool.execute(
      'INSERT INTO SE_PERMISOS (rol_id, obj_id, perm_ver, perm_insertar, perm_editar, perm_eliminar) VALUES (?, ?, ?, ?, ?, ?)',
      [rolId, objId, ver ? 1 : 0, insertar ? 1 : 0, editar ? 1 : 0, eliminar ? 1 : 0]
    );
    return res.status(201).json({ id: result.insertId });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Ya existe un permiso para este rol y objeto.' });
    console.error('Error creando permiso:', error);
    return res.status(500).json({ message: 'Error interno creando permiso.' });
  }
});

// ============================================================
// PERMISOS: Guardado masivo (bulk) de toda la matriz de un rol
// ============================================================
app.put('/api/permisos/bulk', async (req, res) => {
  const { rolId, permisos } = req.body;
  if (!rolId || !Array.isArray(permisos)) {
    return res.status(400).json({ message: 'rolId y permisos[] son obligatorios.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    for (const p of permisos) {
      if (!p.permId) continue;
      await connection.execute(
        'UPDATE SE_PERMISOS SET perm_ver = ?, perm_insertar = ?, perm_editar = ?, perm_eliminar = ? WHERE perm_id = ? AND rol_id = ?',
        [p.ver ? 1 : 0, p.insertar ? 1 : 0, p.editar ? 1 : 0, p.eliminar ? 1 : 0, p.permId, rolId]
      );
    }

    await connection.commit();
    return res.json({ message: 'Permisos actualizados correctamente.' });
  } catch (error) {
    await connection.rollback();
    console.error('Error guardando permisos en bulk:', error);
    return res.status(500).json({ message: 'Error interno guardando permisos.' });
  } finally {
    connection.release();
  }
});

app.put('/api/permisos/:id', async (req, res) => {
  const { ver, insertar, editar, eliminar } = req.body;
  try {
    const [result] = await pool.execute(
      'UPDATE SE_PERMISOS SET perm_ver = ?, perm_insertar = ?, perm_editar = ?, perm_eliminar = ? WHERE perm_id = ?',
      [ver ? 1 : 0, insertar ? 1 : 0, editar ? 1 : 0, eliminar ? 1 : 0, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Permiso no encontrado.' });
    return res.json({ message: 'Permiso actualizado.' });
  } catch (error) {
    console.error('Error actualizando permiso:', error);
    return res.status(500).json({ message: 'Error interno actualizando permiso.' });
  }
});

app.delete('/api/permisos/:id', async (req, res) => {
  try {
    const [result] = await pool.execute('DELETE FROM SE_PERMISOS WHERE perm_id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Permiso no encontrado.' });
    return res.json({ message: 'Permiso eliminado.' });
  } catch (error) {
    console.error('Error eliminando permiso:', error);
    return res.status(500).json({ message: 'Error interno eliminando permiso.' });
  }
});

// ============================================================
// PERMISOS: Matriz completa por Rol (auto-crea registros faltantes)
// ============================================================
app.get('/api/permisos/rol/:rolId', async (req, res) => {
  const rolId = parseInt(req.params.rolId, 10);
  if (!rolId) return res.status(400).json({ message: 'rolId inválido.' });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Obtener todos los objetos activos
    const [objetos] = await connection.execute(
      'SELECT obj_id, obj_nombre, obj_descripcion FROM SE_OBJETOS WHERE obj_activo = 1 ORDER BY obj_nombre'
    );

    // 2. Obtener permisos existentes para este rol
    const [existentes] = await connection.execute(
      'SELECT perm_id, obj_id, perm_ver, perm_insertar, perm_editar, perm_eliminar FROM SE_PERMISOS WHERE rol_id = ?',
      [rolId]
    );

    const permMap = new Map();
    existentes.forEach(p => permMap.set(p.obj_id, p));

    // 3. Auto-crear registros faltantes con permisos en 0
    for (const obj of objetos) {
      if (!permMap.has(obj.obj_id)) {
        const [ins] = await connection.execute(
          'INSERT INTO SE_PERMISOS (rol_id, obj_id, perm_ver, perm_insertar, perm_editar, perm_eliminar) VALUES (?, ?, 0, 0, 0, 0)',
          [rolId, obj.obj_id]
        );
        permMap.set(obj.obj_id, {
          perm_id: ins.insertId,
          obj_id: obj.obj_id,
          perm_ver: 0,
          perm_insertar: 0,
          perm_editar: 0,
          perm_eliminar: 0
        });
      }
    }

    await connection.commit();

    // 4. Construir respuesta ordenada
    const result = objetos.map(obj => {
      const p = permMap.get(obj.obj_id) || {};
      return {
        permId: p.perm_id,
        objId: obj.obj_id,
        objNombre: obj.obj_nombre,
        objDescripcion: obj.obj_descripcion || '',
        ver: p.perm_ver || 0,
        insertar: p.perm_insertar || 0,
        editar: p.perm_editar || 0,
        eliminar: p.perm_eliminar || 0
      };
    });

    return res.json(result);
  } catch (error) {
    await connection.rollback();
    console.error('Error obteniendo matriz de permisos:', error);
    return res.status(500).json({ message: 'Error interno obteniendo permisos del rol.' });
  } finally {
    connection.release();
  }
});


// ============================================================
// PERMISOS: Permisos completos de un usuario por nombre de rol
// ============================================================
app.get('/api/permisos/usuario/:rolNombre', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT o.obj_nombre AS modulo,
             p.perm_ver AS ver, p.perm_insertar AS insertar,
             p.perm_editar AS editar, p.perm_eliminar AS eliminar
      FROM SE_PERMISOS p
      INNER JOIN ROLES r ON r.rol_id = p.rol_id
      INNER JOIN SE_OBJETOS o ON o.obj_id = p.obj_id
      WHERE r.rol_nombre = ? AND o.obj_activo = 1
    `, [req.params.rolNombre]);

    // Convertir a mapa { "Pacientes": { ver: 1, insertar: 1, editar: 0, eliminar: 0 }, ... }
    const permisosMap = {};
    rows.forEach(r => {
      permisosMap[r.modulo] = {
        ver: r.ver,
        insertar: r.insertar,
        editar: r.editar,
        eliminar: r.eliminar
      };
    });

    return res.json(permisosMap);
  } catch (error) {
    console.error('Error consultando permisos de usuario:', error);
    return res.status(500).json({ message: 'Error interno consultando permisos.' });
  }
});

app.get('/api/pacientes', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM PACIENTES ORDER BY pac_fecha_registro DESC');
    return res.json(rows.map(mapPatient));
  } catch (error) {
    console.error('Error consultando pacientes:', error);
    return res.status(500).json({ message: 'Error interno consultando pacientes.' });
  }
});

app.put('/api/pacientes/:id', async (req, res) => {
  const dni = req.params.id;
  
  const nombres = String(req.body.nombres || '').trim().split(/\s+/).filter(Boolean);
  const apellidos = String(req.body.apellidos || '').trim().split(/\s+/).filter(Boolean);
  
  const firstName = req.body.pac_pnom || nombres[0];
  const secondName = req.body.pac_snom || nombres.slice(1).join(' ') || null;
  const firstLastName = req.body.pac_pape || apellidos[0];
  const secondLastName = req.body.pac_sape || apellidos.slice(1).join(' ') || null;
  
  const sex = req.body.pac_sexo || (req.body.genero ? normalizeSex(req.body.genero) : null);
  const fecnac = req.body.pac_fecnac || req.body.fechaNacimiento;
  const tel = req.body.pac_tel || req.body.telefono || null;
  const dir = req.body.pac_dir || req.body.direccion || null;
  const email = req.body.pac_email || req.body.correo || null;
  const tipoSangre = req.body.pac_tipo_sangre || req.body.tipoSangre || 'No sabe';
  const contactoEmergencia = req.body.pac_contacto_emergencia || req.body.contactoEmergencia || null;
  const alergias = req.body.pac_alergias || req.body.alergias || null;
  const activo = req.body.activo;

  try {
    const [result] = await pool.execute(`
      UPDATE PACIENTES
      SET pac_pnom = COALESCE(?, pac_pnom),
          pac_snom = ?,
          pac_pape = COALESCE(?, pac_pape),
          pac_sape = ?,
          pac_sexo = COALESCE(?, pac_sexo),
          pac_fecnac = COALESCE(?, pac_fecnac),
          pac_tel = ?,
          pac_dir = ?,
          pac_email = ?,
          pac_tipo_sangre = ?,
          pac_contacto_emergencia = ?,
          pac_alergias = ?,
          pac_activo = COALESCE(?, pac_activo)
      WHERE pac_dni = ?
    `, [
      firstName || null, secondName, firstLastName || null, secondLastName, sex || null, fecnac || null,
      tel, dir, email, tipoSangre, contactoEmergencia, alergias, activo !== undefined ? (activo ? 1 : 0) : null, dni
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Paciente no encontrado.' });
    }
    return res.json({ message: 'Paciente actualizado correctamente.' });
  } catch (error) {
    console.error('Error actualizando paciente:', error);
    return res.status(500).json({ message: 'Error interno actualizando paciente.' });
  }
});

app.delete('/api/pacientes/:id', async (req, res) => {
  const dni = req.params.id;
  try {
    const [result] = await pool.execute('DELETE FROM PACIENTES WHERE pac_dni = ?', [dni]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Paciente no encontrado.' });
    }
    return res.json({ message: 'Paciente eliminado correctamente.' });
  } catch (error) {
    console.error('Error eliminando paciente:', error);
    if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.code === 'ER_ROW_IS_REFERENCED') {
      return res.status(409).json({ message: 'No se puede eliminar el paciente porque tiene registros asociados (citas, historial).' });
    }
    return res.status(500).json({ message: 'Error interno eliminando paciente.' });
  }
});

app.get('/api/medicamentos', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM MEDICAMENTOS WHERE med_activo = 1 ORDER BY med_nombre'
    );
    return res.json(rows.map(mapMedication));
  } catch (error) {
    console.error('Error consultando medicamentos:', error);
    return res.status(500).json({ message: 'Error interno consultando medicamentos.' });
  }
});

app.post('/api/medicamentos', async (req, res) => {
  const id = req.body.id_medicamento || req.body.id || `MED-${Date.now()}`;
  const nombre = req.body.nombre_medicamento;
  const stock = Number(req.body.stock_actual || 0);
  const precio = Number(req.body.precio_venta || 0);

  if (!nombre) {
    return res.status(400).json({ message: 'El nombre del medicamento es obligatorio.' });
  }

  try {
    await pool.execute(
      `INSERT INTO MEDICAMENTOS (
        med_codigo,
        med_nombre,
        med_presentacion,
        med_stock_actual,
        med_precio_venta
      ) VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        med_nombre = VALUES(med_nombre),
        med_stock_actual = VALUES(med_stock_actual),
        med_precio_venta = VALUES(med_precio_venta),
        med_activo = 1`,
      [id, nombre, req.body.med_presentacion || null, stock, precio]
    );

    return res.status(201).json({
      id,
      id_medicamento: id,
      nombre_medicamento: nombre,
      stock_actual: stock,
      precio_venta: precio
    });
  } catch (error) {
    console.error('Error guardando medicamento:', error);
    return res.status(500).json({ message: 'Error interno guardando medicamento.' });
  }
});

app.put('/api/medicamentos/:id', async (req, res) => {
  try {
    const [result] = await pool.execute(
      `UPDATE MEDICAMENTOS
       SET med_stock_actual = COALESCE(?, med_stock_actual),
           med_nombre = COALESCE(?, med_nombre),
           med_precio_venta = COALESCE(?, med_precio_venta)
       WHERE med_codigo = ?`,
      [
        req.body.stock_actual ?? null,
        req.body.nombre_medicamento ?? null,
        req.body.precio_venta ?? null,
        req.params.id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Medicamento no encontrado.' });
    }

    return res.json({ message: 'Medicamento actualizado correctamente.' });
  } catch (error) {
    console.error('Error actualizando medicamento:', error);
    return res.status(500).json({ message: 'Error interno actualizando medicamento.' });
  }
});

app.delete('/api/medicamentos/:id', async (req, res) => {
  try {
    const [result] = await pool.execute(
      'DELETE FROM MEDICAMENTOS WHERE med_codigo = ?',
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Medicamento no encontrado.' });
    }

    return res.json({ message: 'Medicamento eliminado correctamente.' });
  } catch (error) {
    console.error('Error eliminando medicamento:', error);
    return res.status(500).json({ message: 'Error interno eliminando medicamento.' });
  }
});

app.get('/api/citas', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT
        c.*,
        p.pac_pnom,
        p.pac_snom,
        p.pac_pape,
        p.pac_sape,
        e.emp_pnom,
        e.emp_snom,
        e.emp_pape,
        e.emp_sape,
        esp.esp_nombre,
        pg.pago_fecha,
        pg.pago_monto,
        pg.pago_metodo,
        (
          SELECT JSON_ARRAYAGG(JSON_OBJECT(
            'id_medicamento', m.med_codigo,
            'nombre', dr.det_medicamento_nombre,
            'cantidad', dr.det_cantidad,
            'precio_unitario', m.med_precio_venta,
            'comprado', dr.det_comprado,
            'dosis', dr.det_dosis,
            'duracion', dr.det_durdias
          ))
          FROM EXPEDIENTE_CONSULTA ec
          INNER JOIN RECETAS r ON r.con_id = ec.con_id
          INNER JOIN DETALLE_RECETAS dr ON dr.rec_id = r.rec_id
          LEFT JOIN MEDICAMENTOS m ON m.med_id = dr.med_id
          WHERE ec.cit_id = c.cit_id
        ) AS receta_json,
        NULL AS cargos_json
      FROM CITA c
      INNER JOIN PACIENTES p ON p.pac_dni = c.pac_dni
      INNER JOIN EMPLEADOS e ON e.emp_id = c.emp_id
      INNER JOIN ESPECIALIDADES esp ON esp.esp_id = c.esp_id
      LEFT JOIN PAGOS pg ON pg.cit_id = c.cit_id
      ORDER BY c.cit_fecha DESC, c.cit_hora DESC
    `);

    return res.json(rows.map(mapAppointment));
  } catch (error) {
    console.error('Error consultando citas:', error);
    return res.status(500).json({ message: 'Error interno consultando citas.' });
  }
});

app.post('/api/citas', async (req, res) => {
  const {
    pacienteDni,
    especialidad,
    medico,
    fecha,
    hora,
    observaciones
  } = req.body;

  if (!pacienteDni || !especialidad || !medico || !fecha || !hora) {
    return res.status(400).json({ message: 'Paciente, especialidad, médico, fecha y hora son obligatorios.' });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const specialtyId = await getOrCreateSpecialtyId(especialidad, connection);
    const employeeId = await getOrCreateEmployeeId(medico, especialidad, connection);

    const [result] = await connection.execute(
      `INSERT INTO CITA (
        cit_fecha,
        cit_hora,
        cit_estado,
        cit_monto,
        cit_monto_pendiente,
        cit_observaciones,
        pac_dni,
        emp_id,
        esp_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fecha,
        normalizeTime(hora),
        req.body.estado || 'espera_triaje',
        Number(req.body.monto || 0),
        Number(req.body.montoPendiente || req.body.monto || 0),
        observaciones || null,
        pacienteDni,
        employeeId,
        specialtyId
      ]
    );

    await connection.commit();

    return res.status(201).json({
      ...req.body,
      id: formatAppointmentId(result.insertId)
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error guardando cita:', error);
    return res.status(500).json({ message: 'Error interno guardando cita.' });
  } finally {
    connection.release();
  }
});

app.put('/api/citas/:id', async (req, res) => {
  const citId = await getAppointmentByDisplayId(req.params.id);
  if (!citId) {
    return res.status(404).json({ message: 'Cita no encontrada.' });
  }

  try {
    await pool.execute(
      `UPDATE CITA
       SET cit_estado = COALESCE(?, cit_estado),
           cit_factura_num = COALESCE(?, cit_factura_num),
           cit_monto = COALESCE(?, cit_monto),
           cit_monto_pendiente = COALESCE(?, cit_monto_pendiente)
       WHERE cit_id = ?`,
      [
        req.body.estado ?? null,
        req.body.facturaNum ?? null,
        req.body.monto ?? null,
        req.body.montoPendiente ?? null,
        citId
      ]
    );

    return res.json({ message: 'Cita actualizada correctamente.' });
  } catch (error) {
    console.error('Error actualizando cita:', error);
    return res.status(500).json({ message: 'Error interno actualizando cita.' });
  }
});

app.delete('/api/citas/:id', async (req, res) => {
  const citId = await getAppointmentByDisplayId(req.params.id);
  if (!citId) {
    return res.status(404).json({ message: 'Cita no encontrada.' });
  }

  try {
    const [result] = await pool.execute(
      'DELETE FROM CITA WHERE cit_id = ?',
      [citId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Cita no encontrada.' });
    }

    return res.json({ message: 'Cita eliminada correctamente.' });
  } catch (error) {
    console.error('Error eliminando cita:', error);
    return res.status(500).json({ message: 'Error interno eliminando cita.' });
  }
});

app.get('/api/triajes', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT t.*, c.pac_dni
      FROM TRIAJES_SIGNOS t
      INNER JOIN CITA c ON c.cit_id = t.cit_id
      ORDER BY t.tri_fecha DESC
    `);

    return res.json(rows.map(row => ({
      citaId: formatAppointmentId(row.cit_id),
      pacienteDni: row.pac_dni,
      presion: row.tri_presart,
      temperatura: Number(row.tri_temp),
      cardiaca: row.tri_frec_cardiaca || 0,
      respiratoria: row.tri_frec_respiratoria || 0,
      peso: Number(row.tri_peso),
      estatura: Number(row.tri_talla),
      imc: row.tri_imc != null ? String(row.tri_imc) : '',
      oxigeno: row.tri_oxigeno || 0,
      dolor: row.tri_dolor || 0,
      timestamp: row.tri_fecha ? new Date(row.tri_fecha).getTime() : Date.now()
    })));
  } catch (error) {
    console.error('Error consultando triajes:', error);
    return res.status(500).json({ message: 'Error interno consultando triajes.' });
  }
});

app.post('/api/triajes', async (req, res) => {
  const citId = await getAppointmentByDisplayId(req.body.citaId);
  if (!citId) {
    return res.status(404).json({ message: 'Cita no encontrada para triaje.' });
  }

  try {
    await pool.execute(
      `INSERT INTO TRIAJES_SIGNOS (
        cit_id,
        tri_presart,
        tri_temp,
        tri_frec_cardiaca,
        tri_frec_respiratoria,
        tri_peso,
        tri_talla,
        tri_imc,
        tri_oxigeno,
        tri_dolor
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        tri_presart = VALUES(tri_presart),
        tri_temp = VALUES(tri_temp),
        tri_frec_cardiaca = VALUES(tri_frec_cardiaca),
        tri_frec_respiratoria = VALUES(tri_frec_respiratoria),
        tri_peso = VALUES(tri_peso),
        tri_talla = VALUES(tri_talla),
        tri_imc = VALUES(tri_imc),
        tri_oxigeno = VALUES(tri_oxigeno),
        tri_dolor = VALUES(tri_dolor)`,
      [
        citId,
        req.body.presion,
        req.body.temperatura,
        req.body.cardiaca || null,
        req.body.respiratoria || null,
        req.body.peso,
        req.body.estatura,
        req.body.imc || null,
        req.body.oxigeno || null,
        req.body.dolor || null
      ]
    );

    return res.status(201).json(req.body);
  } catch (error) {
    console.error('Error guardando triaje:', error);
    return res.status(500).json({ message: 'Error interno guardando triaje.' });
  }
});

app.get('/api/consultas', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT
        ec.*,
        c.pac_dni,
        p.pac_pnom,
        p.pac_snom,
        p.pac_pape,
        p.pac_sape,
        e.emp_pnom,
        e.emp_snom,
        e.emp_pape,
        e.emp_sape,
        (
          SELECT JSON_ARRAYAGG(JSON_OBJECT(
            'id_medicamento', m.med_codigo,
            'nombre', dr.det_medicamento_nombre,
            'cantidad', dr.det_cantidad,
            'precio_unitario', m.med_precio_venta,
            'comprado', dr.det_comprado,
            'dosis', dr.det_dosis,
            'duracion', dr.det_durdias,
            'expira', DATE_FORMAT(r.rec_fecexp, '%Y-%m-%d')
          ))
          FROM RECETAS r
          INNER JOIN DETALLE_RECETAS dr ON dr.rec_id = r.rec_id
          LEFT JOIN MEDICAMENTOS m ON m.med_id = dr.med_id
          WHERE r.con_id = ec.con_id
        ) AS receta_json
      FROM EXPEDIENTE_CONSULTA ec
      INNER JOIN CITA c ON c.cit_id = ec.cit_id
      INNER JOIN PACIENTES p ON p.pac_dni = c.pac_dni
      INNER JOIN EMPLEADOS e ON e.emp_id = c.emp_id
      ORDER BY ec.con_fecha DESC
    `);

    return res.json(rows.map(row => ({
      citaId: formatAppointmentId(row.cit_id),
      pacienteDni: row.pac_dni,
      pacienteNombre: [row.pac_pnom, row.pac_snom, row.pac_pape, row.pac_sape].filter(Boolean).join(' '),
      medico: [row.emp_pnom, row.emp_snom, row.emp_pape, row.emp_sape].filter(Boolean).join(' '),
      motivo: row.con_motivo,
      diagnostico: row.cie_codigo || '',
      sintomatologia: row.con_sintomatologia || '',
      antecedentes: row.con_antec || '',
      tratamiento: row.con_plantrat,
      examenes: row.con_examenes ? JSON.parse(row.con_examenes) : [],
      receta: typeof row.receta_json === 'string'
        ? JSON.parse(row.receta_json)
        : (row.receta_json || []),
      privadas: row.con_notas_privadas || '',
      timestamp: row.con_fecha ? new Date(row.con_fecha).getTime() : Date.now()
    })));
  } catch (error) {
    console.error('Error consultando consultas:', error);
    return res.status(500).json({ message: 'Error interno consultando consultas.' });
  }
});

app.post('/api/consultas', async (req, res) => {
  const citId = await getAppointmentByDisplayId(req.body.citaId);
  if (!citId) {
    return res.status(404).json({ message: 'Cita no encontrada para consulta.' });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const cieCode = req.body.diagnostico ? String(req.body.diagnostico).split(' ')[0] : null;

    if (cieCode) {
      await connection.execute(
        'INSERT IGNORE INTO CATALOGO_CIE10 (cie_codigo, cie_desc) VALUES (?, ?)',
        [cieCode, req.body.diagnostico || 'Diagnostico registrado desde consulta']
      );
    }

    const [consultaResult] = await connection.execute(
      `INSERT INTO EXPEDIENTE_CONSULTA (
        cit_id,
        cie_codigo,
        con_motivo,
        con_sintomatologia,
        con_antec,
        con_plantrat,
        con_examenes,
        con_notas_privadas
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        cie_codigo = VALUES(cie_codigo),
        con_motivo = VALUES(con_motivo),
        con_sintomatologia = VALUES(con_sintomatologia),
        con_antec = VALUES(con_antec),
        con_plantrat = VALUES(con_plantrat),
        con_examenes = VALUES(con_examenes),
        con_notas_privadas = VALUES(con_notas_privadas)`,
      [
        citId,
        cieCode,
        req.body.motivo,
        req.body.sintomatologia || null,
        req.body.antecedentes || null,
        req.body.tratamiento,
        JSON.stringify(req.body.examenes || []),
        req.body.privadas || null
      ]
    );

    const [consultas] = await connection.execute(
      'SELECT con_id FROM EXPEDIENTE_CONSULTA WHERE cit_id = ? LIMIT 1',
      [citId]
    );
    const conId = consultas[0]?.con_id || consultaResult.insertId;

    if ((req.body.receta || []).length > 0) {
      await connection.execute(
        `DELETE dr FROM DETALLE_RECETAS dr
         INNER JOIN RECETAS r ON r.rec_id = dr.rec_id
         WHERE r.con_id = ?`,
        [conId]
      );
      await connection.execute('DELETE FROM RECETAS WHERE con_id = ?', [conId]);

      const today = new Date().toISOString().slice(0, 10);
      const expirations = (req.body.receta || [])
        .map(item => item.expira)
        .filter(Boolean)
        .sort();
      const recetaExpira = expirations[expirations.length - 1] || null;
      const [recetaResult] = await connection.execute(
        'INSERT INTO RECETAS (con_id, rec_fecemi, rec_fecexp) VALUES (?, ?, COALESCE(?, DATE_ADD(?, INTERVAL 7 DAY)))',
        [conId, today, recetaExpira, today]
      );

      for (const item of req.body.receta) {
        const [medRows] = await connection.execute(
          'SELECT med_id FROM MEDICAMENTOS WHERE med_codigo = ? LIMIT 1',
          [item.id_medicamento]
        );

        await connection.execute(
          `INSERT INTO DETALLE_RECETAS (
            rec_id,
            med_id,
            det_medicamento_nombre,
            det_dosis,
            det_durdias,
            det_cantidad,
            det_comprado
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            recetaResult.insertId,
            medRows[0]?.med_id || null,
            item.nombre,
            item.dosis || 'Segun indicacion medica',
            item.duracion || 1,
            item.cantidad || 1,
            item.comprado ? 1 : 0
          ]
        );
      }
    }

    await connection.commit();
    return res.status(201).json(req.body);
  } catch (error) {
    await connection.rollback();
    console.error('Error guardando consulta:', error);
    return res.status(500).json({ message: 'Error interno guardando consulta.' });
  } finally {
    connection.release();
  }
});

app.post('/api/pagos', async (req, res) => {
  const citId = await getAppointmentByDisplayId(req.body.txnId);
  if (!citId) {
    return res.status(404).json({ message: 'Cita no encontrada para pago.' });
  }

  try {
    await pool.execute(
      `INSERT INTO PAGOS (
        pago_txn_id,
        cit_id,
        pago_factura_num,
        pago_monto,
        pago_metodo
      ) VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        pago_monto = VALUES(pago_monto),
        pago_metodo = VALUES(pago_metodo)`,
      [
        req.body.txnId,
        citId,
        req.body.facturaNum || `FAC-${String(citId).padStart(4, '0')}`,
        req.body.monto,
        req.body.metodoPago || 'Efectivo'
      ]
    );

    return res.status(201).json(req.body);
  } catch (error) {
    console.error('Error guardando pago:', error);
    return res.status(500).json({ message: 'Error interno guardando pago.' });
  }
});

// ============================================================
// ENDPOINTS PARA LA LANDING PAGE Y PORTAL DE PACIENTES
// ============================================================

app.get('/api/especialidades/public', async (req, res) => {
  try {
    // Get all specialties
    const [especialidades] = await pool.execute('SELECT esp_id AS id, esp_nombre AS nombre, esp_desc AS descripcion FROM ESPECIALIDADES ORDER BY esp_nombre');
    
    // For each specialty, get the doctors with their photos
    const [medicos] = await pool.execute(`
      SELECT 
        e.esp_id,
        CONCAT_WS(' ', emp_pnom, emp_snom, emp_pape, emp_sape) AS nombre,
        emp_foto AS foto
      FROM EMPLEADOS e
      INNER JOIN ROLES r ON r.rol_id = e.rol_id AND r.rol_nombre = 'Medico'
      WHERE e.emp_activo = 1 AND e.esp_id IS NOT NULL
    `);

    // Merge doctors into their respective specialty
    const result = especialidades.map(esp => ({
      ...esp,
      medicos: medicos.filter(m => m.esp_id === esp.id).map(m => ({ nombre: m.nombre, foto: m.foto }))
    }));

    return res.json(result);
  } catch (error) {
    console.error('Error en especialidades/public:', error);
    return res.status(500).json({ message: 'Error interno.' });
  }
});


app.get('/api/medicos/public', async (req, res) => {
  const { esp_id } = req.query;
  try {
    const [rows] = await pool.execute(`
      SELECT emp_id AS id, CONCAT_WS(' ', emp_pnom, emp_snom, emp_pape, emp_sape) AS nombre
      FROM EMPLEADOS 
      WHERE esp_id = ? AND rol_id = (SELECT rol_id FROM ROLES WHERE rol_nombre = 'Medico') AND emp_activo = 1
    `, [esp_id]);
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Error interno.' });
  }
});

app.post('/api/pacientes/registro', async (req, res) => {
  const { correo, primerNombre, segundoNombre, primerApellido, segundoApellido, fechaNacimiento, genero, telefono, password, direccion, tipoSangre, contactoEmergencia, alergias } = req.body;
  const dni = normalizeDni(req.body.dni);

  if (!dni || !primerNombre || !primerApellido || !password || !fechaNacimiento || !genero || !telefono) {
    return res.status(400).json({ message: 'Todos los campos marcados como requeridos (*) son obligatorios.' });
  }

  if (dni.length !== 13) {
    return res.status(400).json({ message: 'El DNI debe contener exactamente 13 numeros.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    const patientColumns = await ensurePatientSchema(connection);
    await connection.beginTransaction();

    const [pacResult] = await connection.execute(
      'SELECT pac_dni FROM PACIENTES WHERE REPLACE(pac_dni, "-", "") = REPLACE(?, "-", "")', [dni]
    );

    let finalDni = dni;
    if (pacResult.length === 0) {
      const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
      const patientData = {
        pac_dni: dni,
        pac_pnom: primerNombre.trim(),
        pac_snom: segundoNombre?.trim() || null,
        pac_pape: primerApellido.trim(),
        pac_sape: segundoApellido?.trim() || null,
        pac_fecnac: fechaNacimiento,
        pac_sexo: normalizeSex(genero),
        pac_email: correo?.trim() || null,
        pac_password: hashedPassword,
        pac_tel: telefono || null,
        pac_dir: direccion || null,
        pac_tipo_sangre: tipoSangre || 'No sabe',
        pac_contacto_emergencia: contactoEmergencia || null,
        pac_alergias: alergias || null,
        pac_activo: 1
      };

      if (!patientColumns.has('pac_password')) {
        throw new Error('La tabla PACIENTES no tiene la columna pac_password.');
      }

      const insertColumns = Object.keys(patientData).filter((column) => patientColumns.has(column));
      const placeholders = insertColumns.map(() => '?').join(', ');
      const values = insertColumns.map((column) => patientData[column]);

      await connection.execute(
        `INSERT INTO PACIENTES (${insertColumns.join(', ')}) VALUES (${placeholders})`,
        values
      );
    } else {
      finalDni = pacResult[0].pac_dni;

      const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
      await connection.execute(`
        UPDATE PACIENTES 
        SET pac_password = ? 
        WHERE pac_dni = ?
      `, [hashedPassword, finalDni]);
    }

    await connection.commit();
    return res.status(201).json({ message: 'Registro exitoso.' });
  } catch (error) {
    if (connection) {
      await connection.rollback().catch((rollbackError) => {
        console.error('Error revirtiendo registro de paciente:', rollbackError);
      });
    }
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'El DNI o el correo ya están registrados.' });
    }
    if (isDatabaseConnectionError(error)) {
      return res.status(503).json({ message: 'La base de datos no esta disponible. Intenta nuevamente en unos minutos.' });
    }
    console.error('Error en registro de paciente:', error);
    return res.status(500).json({ message: 'Error interno registrando paciente.' });
  } finally {
    if (connection) connection.release();
  }
});

app.post('/api/pacientes/login', async (req, res) => {
  let dniStr = String(req.body.dni || req.body.email || '').trim();
  let passwordStr = String(req.body.password || '').trim();

  // Sanitización de entradas
  dniStr = sanitizeInput(dniStr);
  passwordStr = sanitizeInput(passwordStr);

  if (dniStr === null || passwordStr === null) {
    return res.status(403).json({ message: 'Petición bloqueada por seguridad. Se detectaron caracteres no permitidos.' });
  }
  try {
    await ensurePatientSchema();

    // 1. Primero intentar buscar en EMPLEADOS (Administradores, Médicos, etc.)
    const [empRows] = await pool.execute(`
      SELECT e.emp_id AS id, CONCAT(e.emp_pnom, ' ', e.emp_pape) AS name, 
             e.emp_email AS email, r.rol_nombre AS role, e.emp_password AS storedPassword
      FROM EMPLEADOS e
      JOIN ROLES r ON e.rol_id = r.rol_id
      WHERE (REPLACE(e.emp_dni, '-', '') = REPLACE(?, '-', '') OR LOWER(e.emp_email) = LOWER(?))
        AND e.emp_activo = 1
    `, [dniStr, dniStr]);

    if (empRows.length > 0) {
      const emp = empRows[0];
      const storedPwd = emp.storedPassword;
      let empPassValid = false;

      if (storedPwd && storedPwd.startsWith('$2')) {
        empPassValid = await bcrypt.compare(passwordStr, storedPwd);
      } else {
        empPassValid = (storedPwd === passwordStr);
        if (empPassValid && storedPwd) {
          const hashed = await bcrypt.hash(passwordStr, BCRYPT_SALT_ROUNDS);
          await pool.execute('UPDATE EMPLEADOS SET emp_password = ? WHERE emp_id = ?', [hashed, emp.id]);
          console.log(`[Seguridad] Contraseña de empleado ${emp.id} migrada a bcrypt (vía login paciente).`);
        }
      }

      if (empPassValid) {
        delete emp.storedPassword;
        return res.json({
          ...emp,
          is_admin: true,
          redirect: 'admin.html'
        });
      }
    }

    // 2. Si no es empleado, buscar en PACIENTES
    const [pacRows] = await pool.execute(`
      SELECT pac_dni AS dni, CONCAT(pac_pnom, ' ', pac_pape) AS nombre, pac_email AS email, pac_password
      FROM PACIENTES
      WHERE REPLACE(pac_dni, '-', '') = REPLACE(?, '-', '') OR LOWER(pac_email) = LOWER(?)
    `, [dniStr, dniStr]);

    if (pacRows.length === 0) {
      return res.status(401).json({ message: 'Credenciales inválidas.' });
    }
    
    const pac = pacRows[0];
    
    // Validar contraseña con bcrypt o texto plano (compatibilidad)
    const expectedDefaultPass = String(pac.dni).replace(/-/g, '');
    let isPassValid = false;

    if (pac.pac_password && pac.pac_password.startsWith('$2')) {
      // Contraseña hasheada con bcrypt
      isPassValid = await bcrypt.compare(passwordStr, pac.pac_password);
    } else if (pac.pac_password) {
      // Contraseña en texto plano (migración gradual)
      isPassValid = (pac.pac_password === passwordStr);
      if (isPassValid) {
        // Auto-migrar a bcrypt
        const hashed = await bcrypt.hash(passwordStr, BCRYPT_SALT_ROUNDS);
        await pool.execute('UPDATE PACIENTES SET pac_password = ? WHERE pac_dni = ?', [hashed, pac.dni]);
        console.log(`[Seguridad] Contraseña de paciente ${pac.dni} migrada a bcrypt.`);
      }
    } else {
      // Sin contraseña (creado por admin): DNI sin guiones es la contraseña por defecto
      isPassValid = (passwordStr === expectedDefaultPass);
    }

    if (!isPassValid) {
      return res.status(401).json({ message: 'Credenciales inválidas.' });
    }

    // Detectar contraseña provisional (almacenada como hash, pero el usuario la ingresa como PROV-xxx)
    const mustChange = passwordStr.startsWith('PROV-');

    delete pac.pac_password;

    const responseData = {
      ...pac,
      is_admin: false
    };

    if (mustChange) {
      responseData.mustChangePassword = true;
    }

    return res.json(responseData);
  } catch (error) {
    console.error('Error en login unificado:', error);
    if (isDatabaseConnectionError(error)) {
      return res.status(503).json({ message: 'La base de datos no esta disponible. Intenta nuevamente en unos minutos.' });
    }
    return res.status(500).json({ message: 'Error interno.' });
  }
});

app.post('/api/pacientes/recuperar-password', async (req, res) => {
  const { dniOrEmail } = req.body;
  if (!dniOrEmail) return res.status(400).json({ message: 'El DNI o correo es obligatorio.' });

  try {
    const [rows] = await pool.execute(`
      SELECT pac_dni, pac_email, CONCAT(pac_pnom, ' ', pac_pape) AS nombre 
      FROM PACIENTES 
      WHERE pac_email = ? OR REPLACE(pac_dni, '-', '') = REPLACE(?, '-', '')
    `, [dniOrEmail, dniOrEmail]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Paciente no encontrado.' });
    }

    const pac = rows[0];
    if (!pac.pac_email) {
      return res.status(400).json({ message: 'Este paciente no tiene un correo electrónico registrado para recuperar la contraseña.' });
    }

    const claveProvisional = 'PROV-' + generarClaveProvisional();
    const hashedProv = await bcrypt.hash(claveProvisional, BCRYPT_SALT_ROUNDS);
    await pool.execute('UPDATE PACIENTES SET pac_password = ? WHERE pac_dni = ?', [hashedProv, pac.pac_dni]);
    await enviarClaveProvisional(pac.pac_email, pac.nombre, claveProvisional);

    return res.json({ message: 'Se ha enviado una contraseña provisional a tu correo electrónico.' });
  } catch (error) {
    console.error('Error al recuperar contraseña de paciente:', error);
    return res.status(500).json({ message: 'Error al enviar el correo de recuperación.' });
  }
});

app.post('/api/pacientes/reset-password', async (req, res) => {
  const { dniOrEmail, newPassword } = req.body;
  if (!dniOrEmail || !newPassword) {
    return res.status(400).json({ message: 'El DNI o correo y la nueva contraseña son obligatorios.' });
  }

  try {
    const hashedNewPwd = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    const [result] = await pool.execute(`
      UPDATE PACIENTES 
      SET pac_password = ? 
      WHERE pac_email = ? OR REPLACE(pac_dni, '-', '') = REPLACE(?, '-', '')
    `, [hashedNewPwd, dniOrEmail, dniOrEmail]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Paciente no encontrado.' });
    }

    return res.json({ message: 'Contraseña actualizada correctamente.' });
  } catch (error) {
    console.error('Error al restablecer contraseña de paciente:', error);
    return res.status(500).json({ message: 'Error interno al restablecer contraseña.' });
  }
});

app.post('/api/citas/public', async (req, res) => {
  const { pac_dni, emp_id, esp_id, fecha, hora, motivo } = req.body;

  if (!pac_dni || !emp_id || !esp_id || !fecha || !hora) {
    return res.status(400).json({ message: 'Faltan datos para agendar la cita.' });
  }

  try {
    // Validar cupos
    const [cupos] = await pool.execute('SELECT COUNT(*) AS total FROM CITA WHERE emp_id = ? AND cit_fecha = ? AND cit_hora = ? AND cit_estado != "cancelado"', [emp_id, fecha, hora]);
    if (cupos[0].total >= 3) {
      return res.status(400).json({ message: 'El médico no tiene cupos en ese horario.' });
    }

    const facturaNum = `FAC-${Date.now()}`;
    const monto = 500; // Asumir 500 para citas públicas
    
    await pool.execute(`
      INSERT INTO CITA (cit_factura_num, cit_fecha, cit_hora, pac_dni, emp_id, esp_id, cit_monto, cit_monto_pendiente, cit_observaciones)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [facturaNum, fecha, hora, pac_dni, emp_id, esp_id, monto, monto, motivo]);

    return res.status(201).json({ message: 'Cita agendada con éxito.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error interno.' });
  }
});

app.get('/api/pacientes/:dni/citas', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT c.*, 
             CONCAT_WS(' ', e.emp_pnom, e.emp_pape) AS medico,
             es.esp_nombre AS especialidad
      FROM CITA c
      JOIN EMPLEADOS e ON c.emp_id = e.emp_id
      JOIN ESPECIALIDADES es ON c.esp_id = es.esp_id
      WHERE REPLACE(c.pac_dni, '-', '') = REPLACE(?, '-', '')
      ORDER BY c.cit_fecha DESC, c.cit_hora DESC
    `, [req.params.dni]);
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Error interno.' });
  }
});

app.put('/api/citas/:id/cancelar', async (req, res) => {
  try {
    await pool.execute('UPDATE CITA SET cit_estado = "cancelado" WHERE cit_id = ?', [req.params.id]);
    return res.json({ message: 'Cita cancelada.' });
  } catch (error) {
    return res.status(500).json({ message: 'Error interno.' });
  }
});

app.get('/api/pacientes/:dni/expedientes', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT ex.*, c.cit_fecha, c.cit_hora, c.pac_dni,
             CONCAT_WS(' ', e.emp_pnom, e.emp_pape) AS medico,
             es.esp_nombre AS especialidad,
             cie.cie_desc,
             ts.tri_presart, ts.tri_temp, ts.tri_imc, ts.tri_dolor,
             ts.tri_peso, ts.tri_talla, ts.tri_frec_cardiaca, ts.tri_oxigeno
      FROM EXPEDIENTE_CONSULTA ex
      JOIN CITA c ON ex.cit_id = c.cit_id
      JOIN EMPLEADOS e ON c.emp_id = e.emp_id
      JOIN ESPECIALIDADES es ON c.esp_id = es.esp_id
      LEFT JOIN CATALOGO_CIE10 cie ON ex.cie_codigo = cie.cie_codigo
      LEFT JOIN TRIAJES_SIGNOS ts ON ts.cit_id = c.cit_id
      WHERE REPLACE(c.pac_dni, '-', '') = REPLACE(?, '-', '')
      ORDER BY ex.con_fecha DESC
    `, [req.params.dni]);

    // Para cada expediente, cargar los medicamentos de la receta
    for (const exp of rows) {
      const [recetas] = await pool.execute(`
        SELECT r.rec_id, r.rec_fecemi, r.rec_fecexp, r.rec_observaciones
        FROM RECETAS r
        WHERE r.con_id = ?
        ORDER BY r.rec_id ASC
        LIMIT 1
      `, [exp.con_id]);

      if (recetas.length > 0) {
        const receta = recetas[0];
        const [detalles] = await pool.execute(`
          SELECT det.det_medicamento_nombre AS nombre,
                 det.det_dosis AS dosis,
                 det.det_durdias AS duracion,
                 det.det_cantidad AS cantidad,
                 det.det_comprado AS comprado,
                 det.det_frechoras,
                 m.med_precio AS precio_unitario
          FROM DETALLE_RECETAS det
          LEFT JOIN MEDICAMENTOS m ON det.med_id = m.med_id
          WHERE det.rec_id = ?
        `, [receta.rec_id]);
        exp.receta = detalles;
        exp.rec_fecemi = receta.rec_fecemi;
        exp.rec_fecexp = receta.rec_fecexp;
        exp.rec_observaciones = receta.rec_observaciones;
      } else {
        exp.receta = [];
      }
    }

    return res.json(rows);
  } catch (error) {
    console.error('Error en /expedientes:', error);
    return res.status(500).json({ message: 'Error interno.' });
  }
});

app.get('/api/pacientes/:dni', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM PACIENTES WHERE REPLACE(pac_dni, "-", "") = REPLACE(?, "-", "")', [req.params.dni]);
    if (rows.length === 0) return res.status(404).json({ message: 'Paciente no encontrado.' });
    return res.json(rows[0]);
  } catch (error) {
    return res.status(500).json({ message: 'Error interno.' });
  }
});

app.put('/api/pacientes/:dni/perfil', async (req, res) => {
  const { nombres, apellidos, correo, telefono } = req.body;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const n = nombres.trim().split(/\s+/);
    const a = apellidos.trim().split(/\s+/);

    await connection.execute(`
      UPDATE PACIENTES 
      SET pac_pnom = ?, pac_snom = ?, pac_pape = ?, pac_sape = ?, pac_email = ?, pac_tel = ?
      WHERE REPLACE(pac_dni, '-', '') = REPLACE(?, '-', '')
    `, [n[0], n.slice(1).join(' ') || null, a[0], a.slice(1).join(' ') || null, correo, telefono, req.params.dni]);

    await connection.commit();
    return res.json({ message: 'Perfil actualizado.' });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ message: 'Error interno.' });
  } finally {
    connection.release();
  }
});

app.use((error, req, res, next) => {
  console.error('Error no controlado:', error);
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ message: 'Error interno.' });
  }
  return next(error);
});

app.listen(port, async () => {
  console.log(`Servidor local escuchando en http://localhost:${port}`);
  await testDatabaseConnection();
  try {
    await ensurePatientSchema();
  } catch (error) {
    console.error('Error verificando esquema de PACIENTES:', error.message);
  }
});
