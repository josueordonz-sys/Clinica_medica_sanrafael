/* ==========================================================================
   SIREC - Vista: Expedientes Clínicos
   ========================================================================== */

import { firestoreService } from '../../services/firestoreService.js';

function formatDate(timestamp) {
  if (!timestamp) return 'Sin fecha';
  return new Date(timestamp).toLocaleString('es-HN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export class ExpedientesView {
  constructor(router, showAlert, state) {
    this.router = router;
    this.showAlert = showAlert;
    this.state = state;
    this._eventsBound = false;
    this._filtered = [];
    this._selected = null;
  }

  async mount(context = {}) {
    await this._loadData();
    this._bindEvents();
    const search = document.getElementById('expediente-search');
    if (context.dni && search) search.value = context.dni;
    this._applyFilter();
  }

  async _loadData() {
    this.state.consultas = await firestoreService.getAll('consultas', 'consultas');
    this._filtered = [...(this.state.consultas || [])];
  }

  _bindEvents() {
    if (this._eventsBound) return;
    this._eventsBound = true;

    document.getElementById('expediente-search')?.addEventListener('input', () => this._applyFilter());
    document.getElementById('btn-expedientes-recargar')?.addEventListener('click', async () => {
      await this._loadData();
      this._applyFilter();
      this.showAlert('Expedientes actualizados.', 'success');
    });
  }

  _applyFilter() {
    const query = (document.getElementById('expediente-search')?.value || '').trim().toLowerCase();
    const cleanQuery = query.replace(/-/g, '');

    this._filtered = (this.state.consultas || []).filter(c => {
      const dni = String(c.pacienteDni || '').toLowerCase();
      const name = String(c.pacienteNombre || '').toLowerCase();
      const doctor = String(c.medico || '').toLowerCase();
      const motivo = String(c.motivo || '').toLowerCase();
      return !query ||
        dni.includes(query) ||
        dni.replace(/-/g, '').includes(cleanQuery) ||
        name.includes(query) ||
        doctor.includes(query) ||
        motivo.includes(query);
    });

    this._renderList();
    this._renderDetail(this._filtered[0] || null);
  }

  _renderList() {
    const list = document.getElementById('expedientes-list');
    const count = document.getElementById('expedientes-count');
    if (!list) return;

    if (count) count.textContent = `${this._filtered.length} consulta(s)`;

    if (this._filtered.length === 0) {
      list.innerHTML = `
        <div style="padding:28px;text-align:center;color:var(--text-muted);">
          No hay consultas registradas para ese criterio.
        </div>`;
      return;
    }

    list.innerHTML = this._filtered.map((c, idx) => `
      <button type="button" class="patient-list-item expediente-item" data-idx="${idx}" style="width:100%;text-align:left;">
        <span class="item-name">${escapeHtml(c.pacienteNombre || 'Paciente sin nombre')}</span>
        <span class="item-meta">DNI: ${escapeHtml(c.pacienteDni || '')}</span>
        <span class="item-meta">${formatDate(c.timestamp)} | ${escapeHtml(c.medico || 'Sin médico')}</span>
        <span class="item-meta" style="color:var(--primary);font-weight:600;">${escapeHtml(c.motivo || 'Sin motivo')}</span>
      </button>
    `).join('');

    list.querySelectorAll('.expediente-item').forEach(btn => {
      btn.addEventListener('click', () => {
        list.querySelectorAll('.expediente-item').forEach(item => item.classList.remove('selected'));
        btn.classList.add('selected');
        this._renderDetail(this._filtered[parseInt(btn.dataset.idx)]);
      });
    });

    list.querySelector('.expediente-item')?.classList.add('selected');
  }

  _renderDetail(consulta) {
    this._selected = consulta;
    const detail = document.getElementById('expediente-detail');
    if (!detail) return;

    if (!consulta) {
      detail.innerHTML = `
        <div style="padding:48px;text-align:center;color:var(--text-muted);">
          Seleccione una consulta para ver el expediente.
        </div>`;
      return;
    }

    const receta = consulta.receta || consulta.medicamentos || [];
    const examenes = consulta.examenes || [];

    detail.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:18px;">
        <div>
          <h3 style="font-size:1.25rem;margin:0 0 6px 0;">${escapeHtml(consulta.pacienteNombre || 'Paciente')}</h3>
          <div style="color:var(--text-muted);font-size:.9rem;">DNI: ${escapeHtml(consulta.pacienteDni || '')}</div>
        </div>
        <div style="text-align:right;color:var(--text-muted);font-size:.85rem;">
          <div>${formatDate(consulta.timestamp)}</div>
          <div>Cita: ${escapeHtml(consulta.citaId || '')}</div>
        </div>
      </div>

      <div class="form-grid">
        ${this._field('Médico', consulta.medico)}
        ${this._field('Diagnóstico (CIE-10)', consulta.diagnostico)}
        ${this._field('Motivo de Consulta', consulta.motivo, true)}
        ${this._field('Sintomatología', consulta.sintomatologia, true)}
        ${this._field('Antecedentes', consulta.antecedentes, true)}
        ${this._field('Tratamiento General', consulta.tratamiento, true)}
        ${this._field('Notas Privadas', consulta.privadas, true)}
      </div>

      <h4 style="margin:22px 0 10px 0;font-size:1rem;">Receta Médica</h4>
      <div class="table-container">
        <table class="app-table" style="font-size:.82rem;">
          <thead>
            <tr>
              <th>Medicamento</th>
              <th>Cantidad</th>
              <th>Dosis / Frecuencia</th>
              <th>Duración</th>
              <th>Expira</th>
            </tr>
          </thead>
          <tbody>
            ${receta.length ? receta.map(m => `
              <tr>
                <td>${escapeHtml(m.nombre || m.farmaco || '')}</td>
                <td>${escapeHtml(m.cantidad || '')}</td>
                <td>${escapeHtml(m.dosis || '')}</td>
                <td>${escapeHtml(m.duracion ? `${m.duracion} días` : '')}</td>
                <td>${escapeHtml(m.expira || '')}</td>
              </tr>
            `).join('') : '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">Sin receta registrada.</td></tr>'}
          </tbody>
        </table>
      </div>

      <h4 style="margin:22px 0 10px 0;font-size:1rem;">Exámenes de Laboratorio</h4>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${examenes.length
          ? examenes.map(e => `<span class="badge badge-info">${escapeHtml(e)}</span>`).join('')
          : '<span style="color:var(--text-muted);">Sin exámenes registrados.</span>'}
      </div>

      <div style="margin-top: 30px; border-top: 1px solid var(--border-color); padding-top: 16px; text-align: right;">
        <button id="btn-imprimir-expediente" class="btn btn-primary">Imprimir Documento Clínico / Factura</button>
      </div>
    `;

    // Bind event for printing
    const btnPrint = document.getElementById('btn-imprimir-expediente');
    if (btnPrint) {
      btnPrint.addEventListener('click', async () => {
        try {
          const cita = await firestoreService.get('citas', consulta.citaId, 'citas');
          if (!cita) throw new Error("Cita asociada no encontrada");
          const { pagoController } = await import('../../controllers/pagoController.js');
          
          document.getElementById('ticket-print-content').innerHTML =
            pagoController.generateInvoiceTicketHTML(cita, consulta);
          document.getElementById('modal-ticket').style.display = 'flex';
        } catch (e) {
          this.showAlert("Error al generar el documento: " + e.message, "danger");
        }
      });
    }
  }

  _field(label, value, wide = false) {
    return `
      <div class="form-group ${wide ? 'col-span-2' : ''}">
        <label class="form-label">${escapeHtml(label)}</label>
        <div class="form-input" style="height:auto;min-height:44px;background:var(--bg-primary);white-space:pre-wrap;">
          ${escapeHtml(value || 'No registrado')}
        </div>
      </div>
    `;
  }
}
