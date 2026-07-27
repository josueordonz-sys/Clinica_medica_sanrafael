/* ==========================================================================
   SIREC - Controlador de Pagos (pagoController.js)
   ========================================================================== */

import { PagoModel } from '../models/pagoModel.js';
import { firestoreService } from '../services/firestoreService.js';

export const pagoController = {
  
  async processPayment(paymentData) {
    const validation = PagoModel.validate(paymentData);
    if (!validation.isValid) {
      throw new Error(validation.errors.join(" "));
    }

    const paymentObj = new PagoModel(paymentData);
    return await firestoreService.set("pagos", paymentObj.txnId, { ...paymentObj }, "pagos");
  },

  async finalizeAppointmentPayment(cita) {
    const paymentData = {
      txnId: cita.id,
      facturaNum: cita.facturaNum,
      monto: parseFloat(cita.montoPendiente ?? cita.monto) || 0,
      metodoPago: cita.metodoPago || "Efectivo",
      pacienteNombre: cita.pacienteNombre,
      timestamp: Date.now()
    };

    await this.processPayment(paymentData);
    return await firestoreService.update("citas", cita.id, {
      estado: "finalizado",
      facturaNum: cita.facturaNum || paymentData.facturaNum,
      metodoPago: paymentData.metodoPago,
      receta: cita.receta || [],
      fechaPago: paymentData.timestamp,
      montoPagado: paymentData.monto,
      montoPendiente: 0
    }, "citas");
  },

  generateInvoiceTicketHTML(cita, consulta = null) {
    const medsComprados = (cita.receta || []).filter(item => item.comprado);
    
    // Si la cita tiene un monto detallado en cargosServicios, lo usamos, si no, lo construimos básico.
    const cargos = cita.cargosServicios || [
      { concepto: 'Consulta Médica', monto: cita.monto }
    ];

    const medsHtml = medsComprados.length > 0
      ? `
        <div style="margin-top: 20px;">
          <h4 style="border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 10px; color: #1e293b;">Medicamentos Comprados en Clínica</h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
            <thead>
              <tr style="background: #f8fafc; text-align: left;">
                <th style="padding: 8px; border-bottom: 1px solid #cbd5e1;">Descripción</th>
                <th style="padding: 8px; border-bottom: 1px solid #cbd5e1; text-align: center;">Cant.</th>
                <th style="padding: 8px; border-bottom: 1px solid #cbd5e1; text-align: right;">P. Unit.</th>
                <th style="padding: 8px; border-bottom: 1px solid #cbd5e1; text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${medsComprados.map(item => {
                const pu = parseFloat(item.precio_unitario) || 0;
                const c = parseInt(item.cantidad) || 0;
                return `
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${item.nombre}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">${c}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">L. ${pu.toFixed(2)}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">L. ${(pu * c).toFixed(2)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `
      : '';

    const cargosHtml = cargos.map(c => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${c.concepto}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">L. ${parseFloat(c.monto || 0).toFixed(2)}</td>
      </tr>
    `).join('');

    let expedienteSection = '';
    if (consulta) {
      const receta = consulta.receta || consulta.medicamentos || [];
      const medsRecetaHtml = receta.length > 0 ? `
        <h4 style="margin-top: 20px; border-bottom: 1px solid #000; padding-bottom: 4px;">RECETA MÉDICA</h4>
        <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem; margin-top: 8px;">
          <thead>
            <tr style="border-bottom: 1px solid #ccc; text-align: left;">
              <th style="padding: 6px 0;">Medicamento</th>
              <th style="padding: 6px 0;">Dosis / Frecuencia</th>
              <th style="padding: 6px 0; text-align: right;">Duración</th>
            </tr>
          </thead>
          <tbody>
            ${receta.map(m => `
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 6px 0;"><strong>${m.nombre || m.farmaco}</strong></td>
                <td style="padding: 6px 0;">${m.dosis || `Cant: ${m.cantidad}`}</td>
                <td style="padding: 6px 0; text-align: right;">${m.duracion ? m.duracion + ' días' : ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '';

      const clinicaHtml = `
        <div style="margin-top: 20px;">
          <h4 style="border-bottom: 1px solid #000; padding-bottom: 4px;">NOTAS CLÍNICAS Y DIAGNÓSTICO</h4>
          ${consulta.motivo ? `<p style="margin-top: 8px; font-size: 0.9rem;"><strong>Motivo de Consulta:</strong> ${consulta.motivo}</p>` : ''}
          ${consulta.diagnostico ? `<p style="margin-top: 4px; font-size: 0.9rem;"><strong>Diagnóstico:</strong> ${consulta.diagnostico}</p>` : ''}
          ${consulta.tratamiento ? `
          <div style="margin-top: 10px;">
            <p style="margin: 0; font-size: 0.9rem;"><strong>Plan / Tratamiento / Recomendaciones:</strong></p>
            <p style="margin-top: 4px; font-size: 0.9rem; white-space: pre-wrap;">${consulta.tratamiento}</p>
          </div>` : ''}
        </div>
      `;

      if (medsRecetaHtml || consulta.motivo || consulta.diagnostico || consulta.tratamiento) {
        expedienteSection = `
          <div style="margin-top: 40px; padding-top: 20px; border-top: 2px dashed #94a3b8; page-break-inside: avoid;">
            <h3 style="color: #0f172a; margin-bottom: 10px;">SECCIÓN CLÍNICA</h3>
            <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 16px;">La siguiente información fue registrada por el médico tratante durante la consulta.</p>
            ${clinicaHtml}
            ${medsRecetaHtml}
            <div style="margin-top: 50px; text-align: center; width: 250px; border-top: 1px solid #000; padding-top: 8px; margin-left: auto; margin-right: auto;">
              Firma y Sello del Médico<br>
              <span style="font-size: 0.85rem;">${consulta.medico}</span>
            </div>
          </div>
        `;
      }
    }

    const total = parseFloat(cita.montoPagado ?? cita.montoPendiente ?? cita.monto).toFixed(2);
    const estadoPago = cita.estado === "finalizado" 
      ? '<span style="color: #16a34a; border: 1px solid #16a34a; padding: 2px 6px; border-radius: 4px;">PAGADO</span>' 
      : '<span style="color: #dc2626; border: 1px solid #dc2626; padding: 2px 6px; border-radius: 4px;">PENDIENTE</span>';

    return `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; line-height: 1.5; padding: 10px;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1e3a8a; padding-bottom: 20px; margin-bottom: 20px;">
          <div style="display: flex; gap: 16px; align-items: center;">
            <div style="width: 60px; height: 60px; background: #1e3a8a; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white;">
              <svg viewBox="0 0 24 24" width="40" height="40" stroke="currentColor" fill="none" stroke-width="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
            <div>
              <h1 style="margin: 0; font-size: 1.5rem; color: #1e3a8a; font-weight: 800;">CLÍNICA SAN RAFAEL</h1>
              <p style="margin: 2px 0; font-size: 0.85rem; color: #64748b;">Avenida Circunvalación, San Pedro Sula</p>
              <p style="margin: 0; font-size: 0.85rem; color: #64748b;">Tel: 2550-1234 | Correo: info@clinicasanrafael.com</p>
              <p style="margin: 0; font-size: 0.85rem; color: #64748b;">RTN: 0501-1990-123456</p>
            </div>
          </div>
          <div style="text-align: right;">
            <h2 style="margin: 0; font-size: 1.8rem; color: #0f172a;">FACTURA</h2>
            <p style="margin: 4px 0 0 0; font-size: 1rem;"><strong>Nº:</strong> ${cita.facturaNum || 'PENDIENTE'}</p>
            <p style="margin: 4px 0 0 0; font-size: 0.9rem;"><strong>Fecha:</strong> ${cita.fecha || new Date().toLocaleDateString()}</p>
            <p style="margin: 4px 0 0 0; font-size: 0.9rem;"><strong>Estado:</strong> ${estadoPago}</p>
          </div>
        </div>

        <!-- Info Paciente -->
        <div style="display: flex; gap: 40px; margin-bottom: 24px; background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0;">
          <div style="flex: 1;">
            <p style="margin: 0 0 4px 0; font-size: 0.85rem; color: #64748b; text-transform: uppercase; font-weight: 600;">Facturar A:</p>
            <p style="margin: 0 0 2px 0; font-weight: 700; font-size: 1.05rem; color: #0f172a;">${cita.pacienteNombre}</p>
            <p style="margin: 0; font-size: 0.9rem; color: #475569;">DNI: ${cita.pacienteDni}</p>
          </div>
          <div style="flex: 1;">
            <p style="margin: 0 0 4px 0; font-size: 0.85rem; color: #64748b; text-transform: uppercase; font-weight: 600;">Detalles Consulta:</p>
            <p style="margin: 0 0 2px 0; font-size: 0.9rem; color: #475569;"><strong>Médico:</strong> ${cita.medico}</p>
            <p style="margin: 0 0 2px 0; font-size: 0.9rem; color: #475569;"><strong>Especialidad:</strong> ${cita.especialidad}</p>
            <p style="margin: 0; font-size: 0.9rem; color: #475569;"><strong>Método de Pago:</strong> ${cita.metodoPago || 'No especificado'}</p>
          </div>
        </div>

        <!-- Detalle de Cargos -->
        <h4 style="border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 10px; color: #1e293b;">Servicios Médicos</h4>
        <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
          <thead>
            <tr style="background: #f8fafc; text-align: left;">
              <th style="padding: 8px; border-bottom: 1px solid #cbd5e1;">Descripción del Servicio</th>
              <th style="padding: 8px; border-bottom: 1px solid #cbd5e1; text-align: right;">Importe</th>
            </tr>
          </thead>
          <tbody>
            ${cargosHtml}
          </tbody>
        </table>

        ${medsHtml}

        <!-- Totales -->
        <div style="display: flex; justify-content: flex-end; margin-top: 20px;">
          <div style="width: 300px;">
            <div style="display: flex; justify-content: space-between; padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 0.95rem;">
              <span>Subtotal:</span>
              <span>L. ${total}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 12px 8px; background: #1e3a8a; color: white; border-radius: 4px; margin-top: 8px; font-weight: bold; font-size: 1.1rem;">
              <span>TOTAL A PAGAR:</span>
              <span>L. ${total}</span>
            </div>
          </div>
        </div>

        <p style="text-align: center; font-size: 0.8rem; color: #64748b; margin-top: 30px;">
          ${cita.estado === "finalizado" ? "¡Gracias por su pago! Este documento es válido como comprobante." : "Documento de cotización/factura proforma. Sujeto a pago en caja."}
        </p>

        ${expedienteSection}
      </div>
    `;
  }
};
