SET FOREIGN_KEY_CHECKS = 0;

DROP DATABASE IF EXISTS sirec;

CREATE DATABASE sirec
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE sirec;

CREATE TABLE ROLES (
  rol_id INT AUTO_INCREMENT PRIMARY KEY,
  rol_nombre VARCHAR(50) NOT NULL UNIQUE,
  rol_nivel INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ESPECIALIDADES (
  esp_id INT AUTO_INCREMENT PRIMARY KEY,
  esp_nombre VARCHAR(100) NOT NULL UNIQUE,
  esp_desc VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE CATALOGO_CIE10 (
  cie_codigo VARCHAR(10) PRIMARY KEY,
  cie_desc VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE PACIENTES (
  pac_dni CHAR(15) NOT NULL,
  pac_pnom VARCHAR(50) NOT NULL,
  pac_snom VARCHAR(50),
  pac_pape VARCHAR(50) NOT NULL,
  pac_sape VARCHAR(50),
  pac_sexo ENUM('M', 'F') NOT NULL,
  pac_fecnac DATE NOT NULL,
  pac_tel VARCHAR(20),
  pac_dir VARCHAR(255),
  pac_email VARCHAR(100),
  pac_tipo_sangre VARCHAR(10) DEFAULT 'No sabe',
  pac_contacto_emergencia VARCHAR(150),
  pac_alergias TEXT,
  pac_fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (pac_dni),
  UNIQUE KEY uq_pac_email (pac_email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE EMPLEADOS (
  emp_id INT AUTO_INCREMENT PRIMARY KEY,
  emp_dni CHAR(15) NOT NULL UNIQUE,
  emp_pnom VARCHAR(50) NOT NULL,
  emp_snom VARCHAR(50),
  emp_pape VARCHAR(50) NOT NULL,
  emp_sape VARCHAR(50),
  emp_email VARCHAR(100) NOT NULL UNIQUE,
  emp_tel VARCHAR(20),
  rol_id INT NOT NULL,
  esp_id INT,
  emp_activo TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT fk_emp_rol
    FOREIGN KEY (rol_id) REFERENCES ROLES(rol_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_emp_esp
    FOREIGN KEY (esp_id) REFERENCES ESPECIALIDADES(esp_id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE USUARIOS (
  usu_id INT AUTO_INCREMENT PRIMARY KEY,
  usu_uid VARCHAR(80) UNIQUE,
  usu_dni CHAR(15) NOT NULL UNIQUE,
  usu_nombre VARCHAR(120) NOT NULL,
  usu_email VARCHAR(100) NOT NULL UNIQUE,
  usu_password_hash VARCHAR(255) NOT NULL,
  rol_id INT NOT NULL,
  emp_id INT,
  pac_dni CHAR(15),
  usu_activo TINYINT(1) NOT NULL DEFAULT 1,
  usu_creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_usu_rol
    FOREIGN KEY (rol_id) REFERENCES ROLES(rol_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_usu_emp
    FOREIGN KEY (emp_id) REFERENCES EMPLEADOS(emp_id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_usu_pac
    FOREIGN KEY (pac_dni) REFERENCES PACIENTES(pac_dni)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE MEDICAMENTOS (
  med_id INT AUTO_INCREMENT PRIMARY KEY,
  med_codigo VARCHAR(30) NOT NULL UNIQUE,
  med_nombre VARCHAR(100) NOT NULL,
  med_presentacion VARCHAR(100),
  med_stock_actual INT NOT NULL DEFAULT 0,
  med_precio_venta DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  med_activo TINYINT(1) NOT NULL DEFAULT 1,
  CHECK (med_stock_actual >= 0),
  CHECK (med_precio_venta >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE CITA (
  cit_id INT AUTO_INCREMENT PRIMARY KEY,
  cit_factura_num VARCHAR(30) UNIQUE,
  cit_fecha DATE NOT NULL,
  cit_hora TIME NOT NULL,
  cit_estado ENUM('espera_triaje', 'en_triaje', 'espera_consulta', 'pendiente_pago', 'finalizado', 'cancelado') NOT NULL DEFAULT 'espera_triaje',
  cit_monto DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  cit_monto_pendiente DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  cit_observaciones TEXT,
  pac_dni CHAR(15) NOT NULL,
  emp_id INT NOT NULL,
  esp_id INT NOT NULL,
  cit_creada_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cita_paciente
    FOREIGN KEY (pac_dni) REFERENCES PACIENTES(pac_dni)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_cita_empleado
    FOREIGN KEY (emp_id) REFERENCES EMPLEADOS(emp_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_cita_especialidad
    FOREIGN KEY (esp_id) REFERENCES ESPECIALIDADES(esp_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  KEY idx_cita_fecha_hora (cit_fecha, cit_hora),
  KEY idx_cita_estado (cit_estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE TRIAJES_SIGNOS (
  tri_id INT AUTO_INCREMENT PRIMARY KEY,
  cit_id INT NOT NULL UNIQUE,
  emp_id INT,
  tri_presart VARCHAR(20) NOT NULL,
  tri_temp DECIMAL(4,2) NOT NULL,
  tri_frec_cardiaca INT,
  tri_frec_respiratoria INT,
  tri_peso DECIMAL(5,2) NOT NULL,
  tri_talla DECIMAL(5,2) NOT NULL,
  tri_imc DECIMAL(5,2),
  tri_oxigeno INT,
  tri_dolor INT,
  tri_fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tri_cita
    FOREIGN KEY (cit_id) REFERENCES CITA(cit_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_tri_empleado
    FOREIGN KEY (emp_id) REFERENCES EMPLEADOS(emp_id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE EXPEDIENTE_CONSULTA (
  con_id INT AUTO_INCREMENT PRIMARY KEY,
  cit_id INT NOT NULL UNIQUE,
  cie_codigo VARCHAR(10),
  con_motivo TEXT NOT NULL,
  con_sintomatologia TEXT,
  con_antec TEXT,
  con_plantrat TEXT NOT NULL,
  con_examenes TEXT,
  con_notas_privadas TEXT,
  con_fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_consulta_cita
    FOREIGN KEY (cit_id) REFERENCES CITA(cit_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_consulta_cie
    FOREIGN KEY (cie_codigo) REFERENCES CATALOGO_CIE10(cie_codigo)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE RECETAS (
  rec_id INT AUTO_INCREMENT PRIMARY KEY,
  con_id INT NOT NULL,
  rec_fecemi DATE NOT NULL,
  rec_fecexp DATE NOT NULL,
  rec_observaciones TEXT,
  CONSTRAINT fk_receta_consulta
    FOREIGN KEY (con_id) REFERENCES EXPEDIENTE_CONSULTA(con_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE DETALLE_RECETAS (
  det_id INT AUTO_INCREMENT PRIMARY KEY,
  rec_id INT NOT NULL,
  med_id INT,
  det_medicamento_nombre VARCHAR(120) NOT NULL,
  det_dosis VARCHAR(100) NOT NULL,
  det_frechoras INT,
  det_durdias INT NOT NULL,
  det_cantidad INT NOT NULL DEFAULT 1,
  det_comprado TINYINT(1) NOT NULL DEFAULT 0,
  CONSTRAINT fk_det_receta
    FOREIGN KEY (rec_id) REFERENCES RECETAS(rec_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_det_medicamento
    FOREIGN KEY (med_id) REFERENCES MEDICAMENTOS(med_id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE PAGOS (
  pago_id INT AUTO_INCREMENT PRIMARY KEY,
  pago_txn_id VARCHAR(60) NOT NULL UNIQUE,
  cit_id INT NOT NULL,
  pago_factura_num VARCHAR(30) NOT NULL,
  pago_monto DECIMAL(10,2) NOT NULL,
  pago_metodo ENUM('Efectivo', 'Tarjeta', 'Seguro', 'Transferencia') NOT NULL DEFAULT 'Efectivo',
  pago_fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pago_cita
    FOREIGN KEY (cit_id) REFERENCES CITA(cit_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
