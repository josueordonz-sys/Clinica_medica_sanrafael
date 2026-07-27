/* ==========================================================================
   SIREC - Controlador de Pacientes (pacienteController.js)
   ========================================================================== */

import { PacienteModel } from '../models/pacienteModel.js';
import { firestoreService } from '../services/firestoreService.js';

export const pacienteController = {
  
  async getPatients() {
    return await firestoreService.getAll("pacientes", "pacientes");
  },

  async registerPatient(formData) {
    // 1. Validar reglas de negocio con el Modelo
    const validation = PacienteModel.validate(formData);
    if (!validation.isValid) {
      throw new Error(validation.errors.join(" "));
    }

    // 2. Verificar duplicidad de DNI
    // Se normalizan guiones y espacios para evitar falsos positivos por formato
    const patientsList = await this.getPatients();
    const normDni = (d) => String(d || '').replace(/[-\s]/g, '').toLowerCase();
    const dniNorm = normDni(formData.dni);
    const isDuplicate = patientsList.some(p => normDni(p.dni) === dniNorm);
    if (isDuplicate) {
      throw new Error("El número de identidad (DNI) ingresado ya existe.");
    }

    // 3. Moldear los datos limpios mediante el Modelo
    const patientObj = new PacienteModel(formData);

    // 4. Guardar en Base de Datos (Cloud / Local)
    return await firestoreService.set("pacientes", patientObj.dni, { ...patientObj }, "pacientes");
  },

  async updatePatient(dni, updateData) {
    const patientsList = await this.getPatients();
    const existing = patientsList.find(p => p.dni === dni);
    if (!existing) throw new Error("Paciente no encontrado.");

    const updatedData = { ...existing, ...updateData };
    
    // We can run validation on updatedData if we want, but it might fail on created date format depending on Model logic.
    // Assuming simple update.
    return await firestoreService.update("pacientes", dni, updateData, "pacientes");
  },

  async deactivatePatient(dni) {
    // Marcar paciente como inactivo en lugar de eliminar
    return await firestoreService.update("pacientes", dni, { activo: false }, "pacientes");
  },

  async reactivatePatient(dni) {
    // Volver a marcar el paciente como activo
    return await firestoreService.update("pacientes", dni, { activo: true }, "pacientes");
  }
};
