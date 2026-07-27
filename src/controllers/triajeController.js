/* ==========================================================================
   SIREC - Controlador de Triaje (triajeController.js)
   ========================================================================== */

import { firestoreService } from '../services/firestoreService.js';

export const triajeController = {
  
  async getTriageRecords() {
    return await firestoreService.getAll("triajes", "triajes");
  },

  calculateBMI(weightKg, heightCm) {
    if (weightKg > 0 && heightCm > 0) {
      const heightM = heightCm / 100;
      const imc = weightKg / (heightM * heightM);
      
      let classification = "Normal";
      let badgeClass = "imc-normal";

      if (imc < 18.5) {
        classification = "Bajo Peso";
        badgeClass = "imc-under";
      } else if (imc < 25) {
        classification = "Normal";
        badgeClass = "imc-normal";
      } else if (imc < 30) {
        classification = "Sobrepeso";
        badgeClass = "imc-over";
      } else {
        classification = "Obesidad";
        badgeClass = "imc-obese";
      }

      return {
        value: imc.toFixed(1),
        classification,
        badgeClass
      };
    }
    return null;
  },

  async registerTriage(triageRecord) {
    if (triageRecord.temperatura < 34 || triageRecord.temperatura > 42) {
      throw new Error("La temperatura debe estar en un rango lógico clínico (34°C - 42°C).");
    }

    // 1. Guardar signos en colección 'triajes'
    await firestoreService.set("triajes", triageRecord.citaId, triageRecord, "triajes");

    // 2. Actualizar estado de cita para derivar al médico
    return await firestoreService.update("citas", triageRecord.citaId, { estado: "espera_consulta" }, "citas");
  }
};
