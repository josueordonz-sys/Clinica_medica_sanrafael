/* ==========================================================================
   SIREC - Controlador de Inventario de Medicamentos
   ========================================================================== */

import { firestoreService } from '../services/firestoreService.js';

export const medicamentoController = {
  async getMedicamentos() {
    return await firestoreService.getAll('medicamentos', 'medicamentos');
  },

  async saveMedicamento(data) {
    const id = data.id_medicamento || `MED-${Date.now()}`;
    const medicamento = {
      id_medicamento: id,
      nombre_medicamento: data.nombre_medicamento,
      stock_actual: parseInt(data.stock_actual) || 0,
      precio_venta: parseFloat(data.precio_venta) || 0,
      timestamp: data.timestamp || Date.now()
    };

    if (!medicamento.nombre_medicamento) {
      throw new Error('El nombre del medicamento es requerido.');
    }
    if (medicamento.stock_actual < 0) {
      throw new Error('El stock no puede ser negativo.');
    }
    if (medicamento.precio_venta < 0) {
      throw new Error('El precio no puede ser negativo.');
    }

    return await firestoreService.set('medicamentos', id, medicamento, 'medicamentos');
  },

  async updateStock(id, stockActual) {
    return await firestoreService.update('medicamentos', id, {
      stock_actual: parseInt(stockActual) || 0
    }, 'medicamentos');
  },

  async deleteMedicamento(id) {
    return await firestoreService.delete('medicamentos', id, 'medicamentos');
  },

  async descontarRecetaComprada(receta = []) {
    const comprados = receta.filter(item => item.comprado);
    if (comprados.length === 0) return true;

    const inventario = await this.getMedicamentos();
    for (const item of comprados) {
      const med = inventario.find(m => m.id_medicamento === item.id_medicamento || m.id === item.id_medicamento);
      if (!med) throw new Error(`Medicamento no encontrado en inventario: ${item.nombre}`);

      const stockActual = parseInt(med.stock_actual) || 0;
      const cantidad = parseInt(item.cantidad) || 0;
      if (cantidad <= 0) throw new Error(`Cantidad inválida para ${item.nombre}.`);
      if (stockActual < cantidad) {
        throw new Error(`Stock insuficiente para ${item.nombre}. Disponible: ${stockActual}.`);
      }
    }

    for (const item of comprados) {
      const med = inventario.find(m => m.id_medicamento === item.id_medicamento || m.id === item.id_medicamento);
      const stockActual = parseInt(med.stock_actual) || 0;
      await this.updateStock(item.id_medicamento, stockActual - (parseInt(item.cantidad) || 0));
    }

    return true;
  }
};
