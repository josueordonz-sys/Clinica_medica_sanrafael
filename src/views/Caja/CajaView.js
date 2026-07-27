/* ==========================================================================
   SIREC - Vista: Gestión de Caja
   ========================================================================== */

import { citaController } from '../../controllers/citaController.js';
import { pagoController } from '../../controllers/pagoController.js';
import { medicamentoController } from '../../controllers/medicamentoController.js';

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export class CajaView {
  constructor(router, showAlert, state) {
    this.router = router;
    this.showAlert = showAlert;
    this.state = state;
    this._activeCita = null;
    this._lastPaidCita = null;
    this._eventsBound = false;
  }

  async mount(context = {}) {
    this.state.medicamentos = await medicamentoController.getMedicamentos();
    this._updateDatalists();
    this._bindEvents();
    this._resetPaymentForm();
    this._renderTransactionsTable();

    if (context.prefillDni) {
      document.getElementById('caja-buscar-dni').value = context.prefillDni;
      this._findPendingAppointment(context.prefillDni);
    }
  }

  _updateDatalists() {
    const dl = document.getElementById('dni-list');
    if (!dl) return;
    dl.innerHTML = '';
    (this.state.patients || []).forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.dni;
      opt.label = `${p.nombres} ${p.apellidos}`;
      dl.appendChild(opt);
    });
  }

  _bindEvents() {
    if (this._eventsBound) return;
    this._eventsBound = true;

    document.getElementById('caja-buscar-dni')?.addEventListener('input', (e) => {
      e.target.value = this._formatDni(e.target.value);
    });

    document.getElementById('btn-buscar-caja-paciente')?.addEventListener('click', () => {
      this._findPendingAppointment(document.getElementById('caja-buscar-dni').value);
    });

    document.getElementById('form-procesar-pago')?.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      await this._processPayment();
    });

  }

  _formatDni(value) {
    let v = value.replace(/\D/g, '').slice(0, 13);
    if (v.length > 8) v = `${v.slice(0, 4)}-${v.slice(4, 8)}-${v.slice(8)}`;
    else if (v.length > 4) v = `${v.slice(0, 4)}-${v.slice(4)}`;
    return v;
  }

  _findPendingAppointment(dni) {
    const clean = (dni || '').replace(/-/g, '');
    const pending = (this.state.appointments || [])
      .filter(a => a.estado === 'pendiente_pago')
      .filter(a => a.pacienteDni === dni || a.pacienteDni.replace(/-/g, '') === clean)
      .sort((a, b) => b.timestamp - a.timestamp);

    if (pending.length === 0) {
      this._resetPaymentForm(false);
      this.showAlert('No hay citas pendientes de pago para ese paciente.', 'warning');
      return;
    }

    this._loadPaymentForm(pending[0]);
    this.showAlert(pending.length > 1
      ? 'Se cargó la cita pendiente más reciente del paciente.'
      : 'Cita pendiente de pago cargada.',
      pending.length > 1 ? 'warning' : 'success'
    );
  }

  _loadPaymentForm(cita) {
    const facturaNum = cita.facturaNum || this._nextInvoiceNumber();
    const receta = (cita.receta || []).map(item => ({ ...item, comprado: Boolean(item.comprado) }));
    const montoBase = parseFloat(cita.montoPendiente ?? cita.monto) || 0;

    this._activeCita = {
      ...cita,
      facturaNum,
      receta,
      montoBaseCaja: montoBase
    };

    document.getElementById('caja-nombre-paciente').value = cita.pacienteNombre;
    document.getElementById('caja-txn-id').value = cita.id;
    document.getElementById('caja-factura-num').value = facturaNum;

    this._renderRecipeOptions();
    this._recalculateTotal();
  }

  _nextInvoiceNumber() {
    const paidCount = (this.state.appointments || []).filter(a => a.fechaPago || a.estado === 'finalizado').length + 1;
    return `FAC-${String(paidCount).padStart(4, '0')}`;
  }

  _renderRecipeOptions() {
    const container = document.getElementById('caja-receta-container');
    const tbody = document.querySelector('#tabla-caja-receta tbody');
    if (!container || !tbody) return;

    const receta = this._activeCita?.receta || [];
    if (receta.length === 0) {
      container.style.display = 'none';
      tbody.innerHTML = '';
      return;
    }

    container.style.display = 'block';
    tbody.innerHTML = receta.map((item, idx) => {
      const subtotal = (parseFloat(item.precio_unitario) || 0) * (parseInt(item.cantidad) || 0);
      return `<tr>
        <td><input type="checkbox" class="caja-med-check" data-idx="${idx}" ${item.comprado ? 'checked' : ''}></td>
        <td>${item.nombre}</td>
        <td>${item.cantidad}</td>
        <td>L. ${parseFloat(item.precio_unitario || 0).toFixed(2)}</td>
        <td>L. ${subtotal.toFixed(2)}</td>
      </tr>`;
    }).join('');

    tbody.querySelectorAll('.caja-med-check').forEach(chk => {
      chk.addEventListener('change', (event) => {
        const idx = parseInt(event.currentTarget.dataset.idx);
        this._activeCita.receta[idx].comprado = event.currentTarget.checked;
        this._recalculateTotal();
      });
    });
  }

  _recalculateTotal() {
    if (!this._activeCita) return;

    const montoBase = parseFloat(this._activeCita.montoBaseCaja ?? this._activeCita.montoPendiente ?? this._activeCita.monto) || 0;
    const medicamentosTotal = (this._activeCita.receta || [])
      .filter(item => item.comprado)
      .reduce((sum, item) => {
        return sum + ((parseFloat(item.precio_unitario) || 0) * (parseInt(item.cantidad) || 0));
      }, 0);

    const total = montoBase + medicamentosTotal;
    this._activeCita.montoPendiente = total;
    document.getElementById('caja-monto').value = total.toFixed(2);
    document.getElementById('btn-procesar-pago').disabled = total <= 0;
  }

  async _processPayment() {
    if (!this._activeCita) return;

    const metodoPago = document.getElementById('caja-metodo-pago').value;
    const paidCita = {
      ...this._activeCita,
      facturaNum: document.getElementById('caja-factura-num').value,
      metodoPago,
      montoPendiente: parseFloat(document.getElementById('caja-monto').value) || 0
    };

    try {
      await medicamentoController.descontarRecetaComprada(paidCita.receta || []);
      await pagoController.finalizeAppointmentPayment(paidCita);
      this.state.appointments = await citaController.getAppointments();
      this.state.medicamentos = await medicamentoController.getMedicamentos();
      this._lastPaidCita = {
        ...paidCita,
        estado: 'finalizado',
        montoPagado: paidCita.montoPendiente,
        montoPendiente: 0
      };
      this._activeCita = null;
      this._renderTransactionsTable();
      this.showAlert('Pago procesado. Stock actualizado para medicamentos comprados.', 'success');
      document.getElementById('btn-procesar-pago').disabled = true;

      this._showInvoiceModal(this._lastPaidCita);
    } catch (err) {
      this.showAlert(err.message, 'danger');
    }
  }

  _renderTransactionsTable() {
    const tbody = document.querySelector('#tabla-transacciones tbody');
    if (!tbody) return;

    const today = getLocalDateString();
    const rows = (this.state.appointments || [])
      .filter(a => a.estado === 'finalizado')
      .filter(a => {
        const paidDate = a.fechaPago ? getLocalDateString(new Date(a.fechaPago)) : a.fecha;
        return paidDate === today;
      })
      .sort((a, b) => (b.fechaPago || b.timestamp) - (a.fechaPago || a.timestamp));

    if (rows.length === 0) {
      tbody.innerHTML = `<tr>
        <td colspan="7" style="text-align:center; padding: 28px 12px; color: var(--text-muted); font-size: 0.9rem;">
          No hay pagos procesados hoy.
        </td>
      </tr>`;
      return;
    }

    tbody.innerHTML = rows.map(a => `
      <tr>
        <td><strong>${a.id}</strong></td>
        <td>${a.pacienteDni}</td>
        <td>${a.pacienteNombre}</td>
        <td>L. ${parseFloat(a.montoPagado ?? a.monto ?? 0).toFixed(2)}</td>
        <td>${a.facturaNum || '-'}</td>
        <td><span class="badge badge-completed">Finalizado</span></td>
        <td><button class="btn btn-secondary btn-small btn-print-row" data-id="${a.id}">Factura</button></td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.btn-print-row').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const cita = rows.find(a => a.id === e.currentTarget.dataset.id);
        if (cita) {
          this._lastPaidCita = cita;
          this._showInvoiceModal(cita);
        }
      });
    });
  }

  _resetPaymentForm(clearSearch = true) {
    if (clearSearch) document.getElementById('caja-buscar-dni').value = '';
    document.getElementById('caja-nombre-paciente').value = '';
    document.getElementById('caja-txn-id').value = '';
    document.getElementById('caja-factura-num').value = '';
    document.getElementById('caja-monto').value = '';
    document.getElementById('caja-metodo-pago').value = 'Efectivo';
    document.getElementById('btn-procesar-pago').disabled = true;

    const container = document.getElementById('caja-receta-container');
    const tbody = document.querySelector('#tabla-caja-receta tbody');
    if (container) container.style.display = 'none';
    if (tbody) tbody.innerHTML = '';
    this._activeCita = null;
  }

  async _showInvoiceModal(cita) {
    let consulta = null;
    try {
      // Intentamos cargar el expediente clínico asociado para incluir indicaciones/receta en la factura
      const consultasAll = await citaController.getAppointments(); // Wait, firestoreService is needed. Let's just import firestoreService if not already imported. Or we can just import firestoreService.
      // Wait, firestoreService is not imported. I need to add the import at the top of CajaView.js!
      // I will do that in a separate multi_replace or check if I need to.
      
      // I will just use firestoreService.get('consultas', cita.id). I'll add the import in the next replace_file_content.
      const { firestoreService } = await import('../../services/firestoreService.js');
      consulta = await firestoreService.get('consultas', cita.id, 'consultas');
    } catch (e) {
      console.warn("No se encontró consulta asociada o hubo un error", e);
    }

    document.getElementById('ticket-print-content').innerHTML =
      pagoController.generateInvoiceTicketHTML(cita, consulta);
    document.getElementById('modal-ticket').style.display = 'flex';
  }
}
