/* ==========================================================================
   SIREC - Vista: Consultorio Médico y Expediente Digital
   ========================================================================== */

import { firestoreService } from '../../services/firestoreService.js';
import { notificationService } from '../../services/notificationService.js';
import { ExpedienteModel } from '../../models/expedienteModel.js';
import { medicamentoController } from '../../controllers/medicamentoController.js';

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export class ConsultorioView {
  constructor(router, showAlert, state) {
    this.router = router;
    this.showAlert = showAlert;
    this.state = state;
    this._activeCita = null;
    this._recipe = [];
    this._unsubscribe = null;
    this._eventsBound = false;
  }

  async mount() {
    this.state.medicamentos = await medicamentoController.getMedicamentos();
    this._bindFormEvents();
    this._populateMedicationSelect();
    this._renderRecipeTable();
    this._renderDoctorQueue();

    this._unsubscribe = await notificationService.listenToAppointments((updated) => {
      this.state.appointments = updated;
      this._renderDoctorQueue();
    }, 'espera_consulta');
  }

  unmount() {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
  }

  _renderDoctorQueue() {
    const today = getLocalDateString();
    const waiting = (this.state.appointments || [])
      .filter(a => a.estado === 'espera_consulta' && a.fecha === today);

    const container = document.getElementById('medico-cola-pacientes');
    const sinSel = document.getElementById('medico-sin-seleccion');
    const formCont = document.getElementById('medico-form-container');
    if (!container) return;

    if (waiting.length === 0) {
      container.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:.85rem;">
        No hay pacientes en espera médica hoy.
      </div>`;
      formCont.style.display = 'none';
      sinSel.style.display = 'block';
      return;
    }

    container.innerHTML = '';
    waiting.forEach(a => {
      const item = document.createElement('div');
      item.className = 'patient-list-item';
      item.innerHTML = `
        <span class="item-name">${a.pacienteNombre}</span>
        <span class="item-meta">DNI: ${a.pacienteDni} | Hora: ${a.hora}</span>
        <span class="item-meta" style="color:var(--success);font-weight:600;">Dr: ${a.medico}</span>
      `;
      item.addEventListener('click', () => {
        container.querySelectorAll('.patient-list-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
        this._loadPatientChart(a);
      });
      container.appendChild(item);
    });
  }

  async _loadPatientChart(cita) {
    this._activeCita = cita;
    this._recipe = [];
    this._renderRecipeTable();
    this._populateMedicationSelect();

    document.getElementById('medico-sin-seleccion').style.display = 'none';
    document.getElementById('medico-form-container').style.display = 'block';

    document.getElementById('form-consulta-medica').reset();
    document.getElementById('add-receta-cantidad').value = '1';

    this._renderVitals(cita);
    await this._renderHistory(cita);
  }

  _renderVitals(cita) {
    const triage = (this.state.triajes || []).find(t => t.citaId === cita.id);
    const vitGrid = document.getElementById('medico-vitals-resumen');
    if (!vitGrid) return;

    if (!triage) {
      vitGrid.innerHTML = `<div style="grid-column:1/-1;color:var(--danger);font-weight:600;">
        Sin ficha de triaje disponible.
      </div>`;
      return;
    }

    const tempStyle = (triage.temperatura > 37.8 || triage.temperatura < 35.5)
      ? 'color:var(--danger);font-weight:700;'
      : 'color:var(--success);';
    const imcValue = parseFloat(triage.imc);
    const imcClass = imcValue < 18.5 ? 'imc-under'
      : imcValue < 25 ? 'imc-normal'
      : imcValue < 30 ? 'imc-over'
      : 'imc-obese';

    vitGrid.innerHTML = `
      <div class="vitals-card">
        <div class="vitals-header"><span>Presión Arterial</span></div>
        <div class="vitals-value">${triage.presion} mmHg</div>
      </div>
      <div class="vitals-card">
        <div class="vitals-header"><span>Temperatura</span></div>
        <div class="vitals-value" style="${tempStyle}">${triage.temperatura} °C</div>
      </div>
      <div class="vitals-card">
        <div class="vitals-header"><span>IMC</span></div>
        <div class="vitals-value">${triage.imc} <span class="imc-badge ${imcClass}" style="font-size:.7rem;">IMC</span></div>
      </div>
      <div class="vitals-card">
        <div class="vitals-header"><span>Dolor (1-10)</span></div>
        <div class="vitals-value">${triage.dolor} / 10</div>
      </div>
    `;
  }

  async _renderHistory(cita) {
    const allConsultas = await firestoreService.getAll('consultas', 'consultas');
    this.state.consultas = allConsultas;
    const history = allConsultas.filter(c => c.pacienteDni === cita.pacienteDni);
    const histDiv = document.getElementById('medico-historial-clinico');
    if (!histDiv) return;

    if (history.length === 0) {
      histDiv.innerHTML = `<div style="color:var(--text-muted); text-align: center; padding: 10px;">No se visualizan expedientes anteriores</div>`;
      return;
    }

    const expedientesHtml = history.map(h => {
      const locked = ExpedienteModel.isLocked(h.timestamp);
      const lockIcon = locked ? '🔒 Archivado' : '✏️ Editable';
      const receta = h.receta || h.medicamentos || [];
      return `<div class="glass-card" style="padding:10px;font-size:.82rem;">
        <div style="display:flex;justify-content:space-between;font-weight:600;margin-bottom:4px;">
          <span>${new Date(h.timestamp).toLocaleDateString()} - ${h.motivo}</span>
          <span style="color:var(--text-muted);font-size:.72rem;">${lockIcon}</span>
        </div>
        <div><strong>Dx:</strong> ${h.diagnostico}</div>
        <div><strong>Tto:</strong> ${h.tratamiento}</div>
        <div style="color:var(--primary);margin-top:4px;">
          Rx: ${receta.map(m => m.nombre || m.farmaco).join(', ')}
        </div>
      </div>`;
    }).join('');

    histDiv.innerHTML = `
      <details style="background: var(--bg-secondary); border-radius: 8px; padding: 10px;">
        <summary style="cursor: pointer; font-weight: 600; color: var(--primary); outline: none;">
          Visualizar expedientes anteriores (${history.length})
        </summary>
        <div style="margin-top: 12px; display: flex; flex-direction: column; gap: 8px;">
          ${expedientesHtml}
        </div>
      </details>
    `;
  }

  _bindFormEvents() {
    if (this._eventsBound) return;
    this._eventsBound = true;

    document.getElementById('add-receta-duracion')?.addEventListener('input', (e) => {
      const days = parseInt(e.target.value);
      if (days > 0) {
        const d = new Date();
        d.setDate(d.getDate() + days);
        document.getElementById('add-receta-expira').value = getLocalDateString(d);
      } else {
        document.getElementById('add-receta-expira').value = '';
      }
    });

    document.getElementById('add-receta-medicamento')?.addEventListener('change', () => {
      this._syncQuantityLimit();
    });

    document.getElementById('btn-agregar-medicamento')?.addEventListener('click', () => {
      this._addMedicationToRecipe();
    });

    document.getElementById('form-consulta-medica')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this._saveConsultation();
    });


  }

  _syncQuantityLimit() {
    const select = document.getElementById('add-receta-medicamento');
    const cantidadInput = document.getElementById('add-receta-cantidad');
    if (!select || !cantidadInput) return;

    const medId = select.value;
    const med = (this.state.medicamentos || []).find(m => (m.id_medicamento || m.id) === medId);
    const stock = parseInt(med?.stock_actual) || 0;
    const yaAgregado = this._getRecipeQuantityForMedication(medId);
    const disponible = Math.max(stock - yaAgregado, 0);

    cantidadInput.max = String(disponible);
    cantidadInput.placeholder = disponible > 0 ? `Máx. ${disponible}` : 'Sin stock';
    if ((parseInt(cantidadInput.value) || 0) > disponible) {
      cantidadInput.value = disponible > 0 ? String(disponible) : '1';
    }
  }

  _populateMedicationSelect() {
    const select = document.getElementById('add-receta-medicamento');
    if (!select) return;

    const meds = [...(this.state.medicamentos || [])]
      .sort((a, b) => (a.nombre_medicamento || '').localeCompare(b.nombre_medicamento || ''));

    select.innerHTML = '<option value="" disabled selected>Seleccione medicamento</option>';
    meds.forEach(m => {
      const id = m.id_medicamento || m.id;
      const opt = document.createElement('option');
      opt.value = id;
      opt.dataset.stock = String(parseInt(m.stock_actual) || 0);
      opt.textContent = `${m.nombre_medicamento} - Stock: ${m.stock_actual} - L. ${parseFloat(m.precio_venta || 0).toFixed(2)}`;
      select.appendChild(opt);
    });
  }

  _getRecipeQuantityForMedication(medId) {
    return this._recipe
      .filter(item => item.id_medicamento === medId)
      .reduce((sum, item) => sum + (parseInt(item.cantidad) || 0), 0);
  }

  _validateRecipeStock(extraItem = null) {
    const requested = new Map();
    [...this._recipe, extraItem].filter(Boolean).forEach(item => {
      requested.set(
        item.id_medicamento,
        (requested.get(item.id_medicamento) || 0) + (parseInt(item.cantidad) || 0)
      );
    });

    for (const [medId, cantidad] of requested.entries()) {
      const med = (this.state.medicamentos || []).find(m => (m.id_medicamento || m.id) === medId);
      const stock = parseInt(med?.stock_actual) || 0;
      if (!med || cantidad > stock) {
        const nombre = med?.nombre_medicamento || extraItem?.nombre || 'medicamento';
        return {
          isValid: false,
          message: `Stock insuficiente para ${nombre}. Disponible: ${stock}, solicitado: ${cantidad}.`
        };
      }
    }

    return { isValid: true };
  }

  _addMedicationToRecipe() {
    const medId = document.getElementById('add-receta-medicamento').value;
    const cantidad = parseInt(document.getElementById('add-receta-cantidad').value) || 0;
    const dosis = document.getElementById('add-receta-dosis').value.trim();
    const duracion = parseInt(document.getElementById('add-receta-duracion').value);
    const expira = document.getElementById('add-receta-expira').value;
    const med = (this.state.medicamentos || []).find(m => (m.id_medicamento || m.id) === medId);

    if (!med || cantidad <= 0 || !dosis || !duracion) {
      this.showAlert('Seleccione medicamento, cantidad, dosis y duración.', 'warning');
      return;
    }

    const item = {
      id_medicamento: med.id_medicamento || med.id,
      nombre: med.nombre_medicamento,
      cantidad,
      precio_unitario: parseFloat(med.precio_venta) || 0,
      comprado: false,
      dosis,
      duracion,
      expira
    };

    const stockValidation = this._validateRecipeStock(item);
    if (!stockValidation.isValid) {
      this.showAlert(stockValidation.message, 'warning');
      return;
    }

    this._recipe.push(item);

    document.getElementById('add-receta-medicamento').value = '';
    document.getElementById('add-receta-cantidad').value = '1';
    document.getElementById('add-receta-dosis').value = '';
    document.getElementById('add-receta-duracion').value = '';
    document.getElementById('add-receta-expira').value = '';
    document.getElementById('add-receta-cantidad').removeAttribute('max');
    document.getElementById('add-receta-cantidad').placeholder = '';
    this._renderRecipeTable();
  }

  _renderRecipeTable() {
    const tbody = document.querySelector('#tabla-medicamentos-receta tbody');
    if (!tbody) return;

    if (this._recipe.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);">Sin medicamentos.</td></tr>`;
      return;
    }

    tbody.innerHTML = this._recipe.map((m, idx) => `
      <tr>
        <td>${m.nombre}</td>
        <td>${m.cantidad}</td>
        <td>L. ${parseFloat(m.precio_unitario || 0).toFixed(2)}</td>
        <td>${m.dosis}</td>
        <td>${m.duracion} días</td>
        <td>${m.expira}</td>
        <td><button type="button" class="btn btn-danger btn-small" data-idx="${idx}">X</button></td>
      </tr>
    `).join('');

    tbody.querySelectorAll('button[data-idx]').forEach(btn => {
      btn.addEventListener('click', () => {
        this._recipe.splice(parseInt(btn.dataset.idx), 1);
        this._renderRecipeTable();
      });
    });
  }

  async _saveConsultation() {
    if (!this._activeCita) return;

    const validation = ExpedienteModel.validate({
      motivo: document.getElementById('medico-motivo').value,
      diagnostico: document.getElementById('medico-diagnostico').value,
      medicamentos: this._recipe
    });

    if (!validation.isValid) {
      this.showAlert(validation.errors.join(' '), 'warning');
      return;
    }

    const stockValidation = this._validateRecipeStock();
    if (!stockValidation.isValid) {
      this.showAlert(stockValidation.message, 'warning');
      return;
    }

    const exams = [];
    document.querySelectorAll('.exam-check:checked').forEach(c => exams.push(c.value));

    const consulta = new ExpedienteModel({
      citaId: this._activeCita.id,
      pacienteDni: this._activeCita.pacienteDni,
      pacienteNombre: this._activeCita.pacienteNombre,
      medico: this._activeCita.medico,
      motivo: document.getElementById('medico-motivo').value,
      diagnostico: document.getElementById('medico-diagnostico').value,
      sintomatologia: document.getElementById('medico-sintomatologia').value,
      antecedentes: document.getElementById('medico-antecedentes').value,
      medicamentos: this._recipe,
      tratamiento: document.getElementById('medico-tratamiento').value,
      examenes: exams,
      privadas: document.getElementById('medico-privadas').value,
      timestamp: Date.now()
    });

    try {
      const consultaBase = parseFloat(this._activeCita.monto) || 200;
      const receta = this._recipe.map(m => ({
        id_medicamento: m.id_medicamento,
        nombre: m.nombre,
        cantidad: m.cantidad,
        precio_unitario: m.precio_unitario,
        comprado: false,
        dosis: m.dosis,
        duracion: m.duracion,
        expira: m.expira
      }));
      const cargosServicios = [
        { concepto: 'Consulta médica', monto: consultaBase },
        ...exams.map(examen => ({ concepto: `Examen: ${examen}`, monto: 0 }))
      ];
      const montoPendiente = cargosServicios.reduce((sum, cargo) => sum + (parseFloat(cargo.monto) || 0), 0);

      await firestoreService.set('consultas', consulta.citaId, {
        ...consulta,
        receta,
        cargosServicios,
        montoPendiente
      }, 'consultas');
      await firestoreService.update('citas', this._activeCita.id, {
        estado: 'pendiente_pago',
        receta,
        cargosServicios,
        montoPendiente,
        monto: montoPendiente
      }, 'citas');

      // Actualizar el estado local para que Imprimir Receta lo encuentre
      this.state.consultas = this.state.consultas || [];
      const savedConsulta = { ...consulta, receta, cargosServicios, montoPendiente };
      const idx = this.state.consultas.findIndex(c => c.citaId === consulta.citaId);
      if (idx >= 0) this.state.consultas[idx] = savedConsulta;
      else this.state.consultas.push(savedConsulta);

      this.showAlert('Expediente guardado. Cita enviada a Caja.', 'success');

      this._showPrescriptionModal(savedConsulta);
      
      // No anulamos _activeCita para permitir que sigan presionando Imprimir Receta.
    } catch (err) {
      this.showAlert(err.message, 'danger');
    }
  }

  _showPrescriptionModal(cons) {
    const receta = cons.receta || cons.medicamentos || [];
    const medsRows = receta.length > 0 ? receta.map(m => `
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:8px 4px;"><strong>${m.nombre || m.farmaco || 'Medicamento'}</strong></td>
        <td style="padding:8px 4px;">${m.dosis || '—'}</td>
        <td style="padding:8px 4px;text-align:center;">${m.cantidad || 1}</td>
        <td style="padding:8px 4px;text-align:right;">${m.duracion ? `${m.duracion} días` : '—'}</td>
      </tr>
    `).join('') : `<tr><td colspan="4" style="padding:12px 4px;color:#94a3b8;text-align:center;">Sin medicamentos prescritos</td></tr>`;

    const examenes = Array.isArray(cons.examenes) ? cons.examenes : [];
    const examsSection = examenes.length > 0 ? `
      <div style="margin-top:20px;">
        <h4 style="border-bottom:1px solid #1e3a8a;padding-bottom:4px;margin-bottom:8px;color:#1e3a8a;">
          EXÁMENES DE LABORATORIO / GABINETE
        </h4>
        <ul style="padding-left:20px;margin:0;font-size:.9rem;">
          ${examenes.map(e => `<li>${e}</li>`).join('')}
        </ul>
      </div>
    ` : '';

    const triage = (this.state.triajes || []).find(t => t.citaId === cons.citaId || t.citaId === this._activeCita?.id);
    const vitalesSection = triage ? `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:16px;">
        <h4 style="margin:0 0 10px 0;color:#475569;font-size:.85rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;">
          Signos Vitales (Triaje)
        </h4>
        <div style="display:flex;flex-wrap:wrap;gap:12px;font-size:.85rem;">
          ${triage.presion ? `<span><strong>P.A:</strong> ${triage.presion} mmHg</span>` : ''}
          ${triage.temperatura ? `<span><strong>Temp:</strong> ${triage.temperatura} °C</span>` : ''}
          ${triage.imc ? `<span><strong>IMC:</strong> ${triage.imc}</span>` : ''}
          ${triage.peso ? `<span><strong>Peso:</strong> ${triage.peso} kg</span>` : ''}
          ${triage.estatura ? `<span><strong>Talla:</strong> ${triage.estatura} cm</span>` : ''}
          ${triage.oxigeno ? `<span><strong>SpO₂:</strong> ${triage.oxigeno}%</span>` : ''}
          ${triage.dolor != null ? `<span><strong>Dolor:</strong> ${triage.dolor}/10</span>` : ''}
        </div>
      </div>
    ` : '';

    const fechaConsulta = new Date(cons.timestamp || Date.now()).toLocaleDateString('es-HN', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
    const especialidad = this._activeCita?.especialidad || cons.especialidad || 'Consulta Médica';

    document.getElementById('receta-print-content').innerHTML = `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:720px;margin:0 auto;color:#1e293b;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:16px;border-bottom:3px solid #1e3a8a;">
          <div>
            <h2 style="margin:0;color:#1e3a8a;font-size:1.3rem;font-weight:800;">CLÍNICA MÉDICA SAN RAFAEL</h2>
            <p style="margin:3px 0 0;font-size:.8rem;color:#64748b;">San Pedro Sula, Honduras | Tel: 2550-1234</p>
            <p style="margin:2px 0 0;font-size:.78rem;color:#94a3b8;">www.clinicasanrafael.hn</p>
          </div>
          <div style="text-align:right;">
            <h3 style="margin:0;color:#475569;font-size:1rem;">RECETA MÉDICA</h3>
            <p style="margin:3px 0 0;font-size:.8rem;">Fecha de consulta: <strong>${fechaConsulta}</strong></p>
            <p style="margin:2px 0 0;font-size:.78rem;color:#64748b;">No. Cita: <strong>${cons.citaId || this._activeCita?.id || ''}</strong></p>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:.9rem;margin-bottom:16px;padding:12px;background:#f0f9ff;border-radius:8px;border-left:4px solid #1e3a8a;">
          <div>
            <p style="margin:0 0 4px;"><strong>Paciente:</strong> ${cons.pacienteNombre}</p>
            <p style="margin:0 0 4px;"><strong>Identidad:</strong> ${cons.pacienteDni}</p>
          </div>
          <div>
            <p style="margin:0 0 4px;"><strong>Médico:</strong> ${cons.medico}</p>
            <p style="margin:0 0 4px;"><strong>Especialidad:</strong> ${especialidad}</p>
          </div>
        </div>

        ${vitalesSection}

        <div style="margin-bottom:16px;font-size:.9rem;">
          ${cons.motivo ? `<p style="margin:0 0 6px;"><strong>Motivo de Consulta:</strong> ${cons.motivo}</p>` : ''}
          ${cons.sintomatologia ? `<p style="margin:0 0 6px;"><strong>Sintomatología:</strong> ${cons.sintomatologia}</p>` : ''}
          ${cons.antecedentes ? `<p style="margin:0 0 6px;"><strong>Antecedentes:</strong> ${cons.antecedentes}</p>` : ''}
          ${cons.diagnostico ? `<p style="margin:0 0 6px;"><strong>Diagnóstico (CIE-10):</strong> <span style="color:#1e3a8a;font-weight:600;">${cons.diagnostico}</span></p>` : ''}
        </div>

        <div style="margin-bottom:20px;">
          <h4 style="border-bottom:2px solid #1e3a8a;padding-bottom:5px;margin-bottom:8px;color:#1e3a8a;font-size:1rem;">
            PRESCRIPCIÓN MÉDICA
          </h4>
          <table style="width:100%;border-collapse:collapse;font-size:.88rem;">
            <thead>
              <tr style="background:#1e3a8a;color:#fff;">
                <th style="padding:8px 4px;text-align:left;">Medicamento</th>
                <th style="padding:8px 4px;text-align:left;">Dosis</th>
                <th style="padding:8px 4px;text-align:center;">Cantidad</th>
                <th style="padding:8px 4px;text-align:right;">Duración</th>
              </tr>
            </thead>
            <tbody>${medsRows}</tbody>
          </table>
        </div>

        ${examsSection}

        ${cons.tratamiento ? `
        <div style="margin-top:16px;font-size:.9rem;">
          <h4 style="border-bottom:1px solid #cbd5e1;padding-bottom:4px;margin-bottom:8px;color:#1e3a8a;">
            RECOMENDACIONES / PLAN DE TRATAMIENTO
          </h4>
          <p style="margin:0;white-space:pre-wrap;line-height:1.6;">${cons.tratamiento}</p>
        </div>` : ''}

        <div style="margin-top:60px;display:flex;justify-content:flex-end;padding-right:40px;">
          <div style="text-align:center;width:240px;">
            ${(() => {
              try {
                const empleados = JSON.parse(localStorage.getItem('sirec_empleados') || '[]');
                const medicoNombre = (cons.medico || '').toLowerCase().trim();
                const medico = empleados.find(e => {
                  const nombre = `${e.pnom || ''} ${e.snom || ''} ${e.pape || ''} ${e.sape || ''}`.toLowerCase().trim();
                  const nombreCorto = `${e.pnom || ''} ${e.pape || ''}`.toLowerCase().trim();
                  return nombre.includes(medicoNombre) || medicoNombre.includes(nombreCorto);
                });
                if (medico && medico.firma) {
                  return `<img src="${medico.firma}" alt="Firma" style="max-width:200px;max-height:80px;object-fit:contain;display:block;margin:0 auto 4px;">`;
                }
              } catch(e) {}
              return '<div style="height:80px;"></div>';
            })()}
            <div style="border-top:1px solid #1e293b;padding-top:8px;font-size:.85rem;">
              <strong>${cons.medico}</strong><br>
              <span style="font-size:.78rem;color:#64748b;">Médico Autorizado | ${especialidad}</span>
            </div>
          </div>
        </div>

        <div style="margin-top:30px;padding-top:10px;border-top:1px dashed #cbd5e1;text-align:center;font-size:.75rem;color:#94a3b8;">
          Documento generado por SIREC — ${new Date().toLocaleDateString('es-HN')}
        </div>
      </div>
    `;
    document.getElementById('modal-receta').style.display = 'flex';
  }
}
