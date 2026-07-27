/* ==========================================================================
   SIREC - Vista: Triaje y Signos Vitales (TriajeView.js)
   ========================================================================== */

import { triajeController } from '../../controllers/triajeController.js';
import { notificationService } from '../../services/notificationService.js';

const PAIN_LABELS = {
  1:'Sin Dolor', 2:'Leve', 3:'Leve', 4:'Moderado', 5:'Moderado',
  6:'Intenso',   7:'Intenso', 8:'Muy Severo', 9:'Insoluble', 10:'El Peor Dolor'
};

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export class TriajeView {
  constructor(router, showAlert, state) {
    this.router    = router;
    this.showAlert = showAlert;
    this.state     = state;
    this._activeCita       = null;
    this._unsubscribe      = null;
  }

  /** Llamado por App.js al entrar a esta vista */
  async mount() {
    this._bindFormEvents();
    this._renderQueue();
    this._updateTriageBadge();

    // Activar listener en tiempo real
    this._unsubscribe = await notificationService.listenToAppointments((updatedAppts) => {
      this.state.appointments = updatedAppts;
      this._renderQueue();
      this._updateTriageBadge();
    }, 'espera_triaje');
  }

  /** Llamado por App.js al salir de esta vista */
  unmount() {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
  }

  _renderQueue() {
    const today = getLocalDateString();
    const queue = (this.state.appointments || [])
      .filter(a => a.estado === 'espera_triaje' && a.fecha === today);

    const container = document.getElementById('triage-cola-pacientes');
    const sinSel    = document.getElementById('triage-sin-seleccion');
    const form      = document.getElementById('form-triaje-signos');
    if (!container) return;

    if (queue.length === 0) {
      container.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:.85rem;">
        No hay pacientes pendientes de Triaje.
      </div>`;
      form.style.display  = 'none';
      sinSel.style.display = 'block';
      return;
    }

    container.innerHTML = '';
    queue.forEach(a => {
      const item = document.createElement('div');
      item.className = 'patient-list-item';
      item.innerHTML = `
        <span class="item-name">${a.pacienteNombre}</span>
        <span class="item-meta">DNI: ${a.pacienteDni} | Hora: ${a.hora}</span>
        <span class="item-meta" style="color:var(--primary);font-weight:600;">Esp: ${a.especialidad}</span>
      `;
      item.addEventListener('click', () => {
        container.querySelectorAll('.patient-list-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
        this._loadForm(a);
      });
      container.appendChild(item);
    });
  }

  _loadForm(cita) {
    this._activeCita = cita;
    const sinSel = document.getElementById('triage-sin-seleccion');
    const form   = document.getElementById('form-triaje-signos');
    sinSel.style.display = 'none';
    form.style.display   = 'block';
    document.getElementById('triage-form-titulo').textContent = `Registrar Signos: ${cita.pacienteNombre}`;
    document.getElementById('triage-dni').value = cita.pacienteDni;
    form.reset();
    document.getElementById('triage-dni').value = cita.pacienteDni;
    document.getElementById('triage-imc').value = '';
    document.getElementById('triage-imc-tag').style.display = 'none';
    document.getElementById('triage-dolor-lbl').textContent  = '1';
    document.getElementById('triage-dolor-desc').textContent = 'Sin Dolor';
  }

  _bindFormEvents() {
    // IMC auto-calculado
    ['triage-peso', 'triage-estatura'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => this._calcIMC());
    });

    // Slider de dolor
    document.getElementById('triage-dolor')?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      document.getElementById('triage-dolor-lbl').textContent  = val;
      document.getElementById('triage-dolor-desc').textContent = PAIN_LABELS[val] || 'Leve';
    });

    // Submit del Triaje
    document.getElementById('form-triaje-signos')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!this._activeCita) return;
      await this._saveVitals();
    });
  }

  _calcIMC() {
    const peso    = parseFloat(document.getElementById('triage-peso')?.value);
    const altura  = parseFloat(document.getElementById('triage-estatura')?.value);
    const imcTag  = document.getElementById('triage-imc-tag');
    const imcInp  = document.getElementById('triage-imc');
    if (!peso || !altura) { imcInp.value = ''; imcTag.style.display='none'; return; }

    const result = triajeController.calculateBMI(peso, altura);
    if (result) {
      imcInp.value = result.value;
      imcTag.style.display = 'inline-block';
      imcTag.className = `imc-badge ${result.badgeClass}`;
      imcTag.textContent = result.classification;
    }
  }

  async _saveVitals() {
    const temp = parseFloat(document.getElementById('triage-temperatura').value);
    if (temp < 34 || temp > 42) {
      const el = document.getElementById('triage-temperatura');
      el.setCustomValidity('Rango lógico: 34°C - 42°C.');
      el.reportValidity();
      return;
    }

    const record = {
      citaId:       this._activeCita.id,
      pacienteDni:  this._activeCita.pacienteDni,
      presion:      document.getElementById('triage-presion').value,
      temperatura:  temp,
      cardiaca:     parseInt(document.getElementById('triage-cardiaca').value) || 0,
      respiratoria: parseInt(document.getElementById('triage-respiratoria').value) || 0,
      peso:         parseFloat(document.getElementById('triage-peso').value),
      estatura:     parseFloat(document.getElementById('triage-estatura').value),
      imc:          document.getElementById('triage-imc').value,
      oxigeno:      parseInt(document.getElementById('triage-oxigeno').value) || 0,
      dolor:        parseInt(document.getElementById('triage-dolor').value),
      timestamp:    Date.now()
    };

    try {
      await triajeController.registerTriage(record);
      this.showAlert('¡Ficha de Triaje guardada! Paciente derivado al médico.', 'success');
      this._activeCita = null;
      document.getElementById('form-triaje-signos').style.display = 'none';
      document.getElementById('triage-sin-seleccion').style.display = 'block';
    } catch (err) {
      this.showAlert(err.message, 'danger');
    }
  }

  _updateTriageBadge() {
    const today   = getLocalDateString();
    const pending = (this.state.appointments || [])
      .filter(a => a.estado === 'espera_triaje' && a.fecha === today).length;
    const badge = document.getElementById('triage-badge');
    if (!badge) return;
    badge.style.display = pending > 0 ? 'block' : 'none';
    badge.textContent   = pending;
  }
}
