/* ==========================================================================
   SIREC - Modelo de Paciente (pacienteModel.js)
   ========================================================================== */

export class PacienteModel {
  constructor(data = {}) {
    this.dni = data.dni || "";
    this.nombres = data.nombres || "";
    this.apellidos = data.apellidos || "";
    this.fechaNacimiento = data.fechaNacimiento || "";
    this.genero = data.genero || "";
    this.telefono = data.telefono || "";
    this.correo = data.correo || "No especifica";
    this.direccion = data.direccion || "No especifica";
    this.tipoSangre = data.tipoSangre || "No sabe";
    this.contactoEmergencia = data.contactoEmergencia || "No especifica";
    this.alergias = data.alergias || "Ninguna";
    this.activo = data.activo !== undefined ? data.activo : true;
  }

  // Validaciones del modelo
  static validate(data) {
    const errors = [];
    
    // DNI Hondureño format check
    const cleanDni = (data.dni || "").replace(/-/g, "");
    if (cleanDni.length !== 13 || !/^\d+$/.test(cleanDni)) {
      errors.push("El DNI debe contener exactamente 13 números.");
    }

    // Alphabetical checks for names
    if (/\d/.test(data.nombres || "")) {
      errors.push("Los nombres no pueden contener números.");
    }
    if (/\d/.test(data.apellidos || "")) {
      errors.push("Los apellidos no pueden contener números.");
    }

    // Age validation (must be in the past)
    if (new Date(data.fechaNacimiento) >= new Date()) {
      errors.push("La fecha de nacimiento debe estar en el pasado.");
    }

    // Required fields check
    if (!data.dni || !data.nombres || !data.apellidos || !data.fechaNacimiento || !data.genero || !data.telefono) {
      errors.push("Todos los campos obligatorios (*) son requeridos.");
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
