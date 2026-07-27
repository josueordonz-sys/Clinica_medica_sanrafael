/* ==========================================================================
   SIREC - Modelo de Cita (citaModel.js)
   ========================================================================== */

export class CitaModel {
  constructor(data = {}) {
    this.id = data.id || "";
    this.facturaNum = data.facturaNum || "";
    this.pacienteDni = data.pacienteDni || "";
    this.pacienteNombre = data.pacienteNombre || "";
    this.especialidad = data.especialidad || "";
    this.medico = data.medico || "";
    this.fecha = data.fecha || "";
    this.hora = data.hora || "";
    this.monto = parseFloat(data.monto) || 0;
    this.montoPendiente = parseFloat(data.montoPendiente ?? data.monto) || 0;
    this.cargosServicios = data.cargosServicios || [];
    this.metodoPago = data.metodoPago || "Efectivo";
    this.observaciones = data.observaciones || "Ninguna";
    this.estado = data.estado || "espera_triaje";
    this.timestamp = data.timestamp || Date.now();
  }

  static validate(data) {
    const errors = [];
    
    if (!data.pacienteDni || !data.especialidad || !data.medico || !data.fecha || !data.hora) {
      errors.push("Todos los campos obligatorios (*) de la cita son requeridos.");
    }

    if (new Date(data.fecha + "T23:59:59") < new Date().setHours(0,0,0,0)) {
      errors.push("No se pueden programar citas en fechas pasadas.");
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
