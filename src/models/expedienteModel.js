/* ==========================================================================
   SIREC - Modelo de Expediente y Consulta (expedienteModel.js)
   ========================================================================== */

export class ExpedienteModel {
  constructor(data = {}) {
    this.citaId = data.citaId || "";
    this.pacienteDni = data.pacienteDni || "";
    this.pacienteNombre = data.pacienteNombre || "";
    this.medico = data.medico || "";
    this.motivo = data.motivo || "";
    this.diagnostico = data.diagnostico || "";
    this.sintomatologia = data.sintomatologia || "No especifica";
    this.antecedentes = data.antecedentes || "Ninguno";
    this.medicamentos = data.medicamentos || []; // Arreglo de recetas: {farmaco, dosis, duracion, expira}
    this.tratamiento = data.tratamiento || "Seguir indicaciones";
    this.examenes = data.examenes || []; // Exámenes de laboratorio
    this.privadas = data.privadas || "";
    this.timestamp = data.timestamp || Date.now();
  }

  static validate(data) {
    const errors = [];

    if (!data.motivo || !data.motivo.trim()) {
      errors.push("El motivo de la consulta es obligatorio.");
    }

    if (!data.diagnostico || !data.diagnostico.trim()) {
      errors.push("El diagnóstico médico (CIE-10) es obligatorio.");
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Comprueba si la consulta ha excedido las 24 horas para bloqueo legal
  static isLocked(timestamp) {
    const twentyFourHours = 24 * 60 * 60 * 1000;
    return (Date.now() - timestamp) > twentyFourHours;
  }
}
