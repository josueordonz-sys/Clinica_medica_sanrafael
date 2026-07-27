/* ==========================================================================
   SIREC - Controlador de Citas (citaController.js)
   ========================================================================== */

import { CitaModel } from '../models/citaModel.js';
import { firestoreService } from '../services/firestoreService.js';

export const citaController = {
  
  async getAppointments() {
    return await firestoreService.getAll("citas", "citas");
  },

  async scheduleAppointment(appointmentData) {
    const validation = CitaModel.validate(appointmentData);
    if (!validation.isValid) {
      throw new Error(validation.errors.join(" "));
    }

    const appointmentsList = await this.getAppointments();
    
    // Validar disponibilidad de cupos: máximo 3 citas para el mismo médico, fecha y hora
    const bookedCount = appointmentsList.filter(a => 
      a.medico === appointmentData.medico && 
      a.fecha === appointmentData.fecha && 
      a.hora === appointmentData.hora &&
      a.id !== appointmentData.id
    ).length;

    if (bookedCount >= 3) {
      throw new Error(`El médico especialista ${appointmentData.medico} no cuenta con cupos disponibles para el horario de ${appointmentData.hora} el día ${appointmentData.fecha}.`);
    }

    const citaObj = new CitaModel(appointmentData);
    return await firestoreService.set("citas", citaObj.id, { ...citaObj }, "citas");
  },

  async updateAppointment(id, updateData) {
    const appointmentsList = await this.getAppointments();
    const existing = appointmentsList.find(a => a.id === id);
    if (!existing) throw new Error("Cita no encontrada.");

    // Merge new data
    const updatedData = { ...existing, ...updateData };

    // Validar de nuevo (reutilizamos la lógica, así que podemos llamar a validar cupos)
    const validation = CitaModel.validate(updatedData);
    if (!validation.isValid) {
      throw new Error(validation.errors.join(" "));
    }

    const bookedCount = appointmentsList.filter(a => 
      a.medico === updatedData.medico && 
      a.fecha === updatedData.fecha && 
      a.hora === updatedData.hora &&
      a.id !== id
    ).length;

    if (bookedCount >= 3) {
      throw new Error(`El médico especialista ${updatedData.medico} no cuenta con cupos disponibles.`);
    }

    return await firestoreService.set("citas", id, updatedData, "citas");
  },

  async deleteAppointment(id) {
    return await firestoreService.delete("citas", id, "citas");
  }
};
