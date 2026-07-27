/* ==========================================================================
   SIREC - Modelo de Pago (pagoModel.js)
   ========================================================================== */

export class PagoModel {
  constructor(data = {}) {
    this.txnId = data.txnId || "";
    this.facturaNum = data.facturaNum || "";
    this.monto = parseFloat(data.monto) || 0.0;
    this.metodoPago = data.metodoPago || "Efectivo"; // Efectivo, Tarjeta, Seguro
    this.pacienteNombre = data.pacienteNombre || "";
    this.timestamp = data.timestamp || Date.now();
  }

  static validate(data) {
    const errors = [];

    if (parseFloat(data.monto) <= 0) {
      errors.push("El monto a pagar debe ser mayor a L. 0.00.");
    }

    if (!["Efectivo", "Tarjeta", "Seguro", "Transferencia"].includes(data.metodoPago)) {
      errors.push("Método de pago no admitido.");
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
