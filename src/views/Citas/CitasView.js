/* ==========================================================================
   SIREC - Vista: Citas y Agenda
   ========================================================================== */

import { citaController } from '../../controllers/citaController.js';
import { authService } from '../../services/authService.js';

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export class CitasView {
  constructor(router, showAlert, state) {
    this.router = router;
    this.showAlert = showAlert;
    this.state = state;
    this._selectedPatient = null;
    this._eventsBound = false;
    this._doctorCatalog = new Map();
  }

  async mount(context = {}) {
    await this._loadDoctorCatalog();
    this._bindEvents();
    this._resetForm();

    // If a patient is passed via context (legacy), pre-fill automatically
    if (context.patient) {
      this._setPatient(context.patient);
    }

    // Refresh list of appointments
    this.state.appointments = await citaController.getAppointments();
    this.renderCitasList();
  }

  _setPatient(patient) {
    this._selectedPatient = patient;
    const fullName = `${patient.nombres} ${patient.apellidos}`;
    const nombreEl = document.getElementById('cita-nombre-paciente');
    const infoEl   = document.getElementById('cita-paciente-info');
    const resultEl = document.getElementById('cita-paciente-resultado');
    if (nombreEl) nombreEl.textContent = fullName;
    if (infoEl)   infoEl.textContent   = `DNI: ${patient.dni}`;
    if (resultEl) resultEl.style.display = 'block';
    const dniHidden = document.getElementById('cita-paciente-dni');
    if (dniHidden) dniHidden.value = patient.dni;
    const fechaInput = document.getElementById('cita-fecha');
    if (fechaInput) fechaInput.min = getLocalDateString();
    const btnAgendar = document.getElementById('btn-agendar-cita');
    if (btnAgendar) btnAgendar.disabled = false;
  }

  async _searchPatientByDni() {
    const dniInput = document.getElementById('cita-buscar-dni');
    const rawDni = (dniInput?.value || '').trim();
    if (!rawDni) {
      this.showAlert('Ingrese un número de identidad para buscar.', 'warning');
      return;
    }

    const btnBuscar = document.getElementById('btn-buscar-paciente-cita');
    if (btnBuscar) { btnBuscar.disabled = true; btnBuscar.textContent = 'Buscando…'; }

    try {
      // Use cached patients from state, or fetch from service
      let patients = this.state.patients || [];
      if (patients.length === 0) {
        const { pacienteController } = await import('../../controllers/pacienteController.js');
        patients = await pacienteController.getPatients();
        this.state.patients = patients;
      }

      // Normalize: strip hyphens for comparison
      const normalize = s => String(s || '').replace(/-/g, '').toUpperCase();
      const searchDni = normalize(rawDni);
      const found = patients.find(p => normalize(p.dni) === searchDni);

      if (!found) {
        // Clear previous result
        const resultEl = document.getElementById('cita-paciente-resultado');
        if (resultEl) resultEl.style.display = 'none';
        this._selectedPatient = null;
        document.getElementById('btn-agendar-cita').disabled = true;
        this.showAlert(`No se encontró ningún paciente con el DNI "${rawDni}". Verifique el número o regístrelo primero.`, 'warning');
        return;
      }

      this._setPatient(found);
      this.showAlert(`Paciente encontrado: ${found.nombres} ${found.apellidos}`, 'success');
    } catch (err) {
      console.error('[CitasView] Error buscando paciente:', err);
      this.showAlert('Error al buscar el paciente: ' + err.message, 'danger');
    } finally {
      if (btnBuscar) { btnBuscar.disabled = false; btnBuscar.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2" style="vertical-align:middle;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Buscar'; }
    }
  }

  async _loadDoctorCatalog() {
    const especialidadSelect = document.getElementById('cita-especialidad');
    const editEspecialidadSelect = document.getElementById('edit-cita-especialidad');
    
    try {
      const users = await authService.getUsers();
      const medicos = (users || []).filter(u =>
        u.role === 'Medico' &&
        (u.name || '').trim() &&
        (u.especialidad || '').trim()
      );

      this._doctorCatalog = medicos.reduce((catalog, medico) => {
        const especialidad = medico.especialidad.trim();
        const nombre = medico.name.trim();
        if (!catalog.has(especialidad)) catalog.set(especialidad, []);
        if (!catalog.get(especialidad).includes(nombre)) {
          catalog.get(especialidad).push(nombre);
        }
        return catalog;
      }, new Map());

      if (this._doctorCatalog.size === 0) {
        if (especialidadSelect) {
          especialidadSelect.innerHTML = '<option value="" disabled selected>No hay médicos con especialidad</option>';
          especialidadSelect.disabled = true;
        }
        if (editEspecialidadSelect) {
          editEspecialidadSelect.innerHTML = '<option value="" disabled selected>No hay médicos con especialidad</option>';
          editEspecialidadSelect.disabled = true;
        }
        return;
      }

      const optionsHtml = '<option value="" disabled selected>Seleccione especialidad</option>' + 
        [...this._doctorCatalog.keys()].sort().map(esp => `<option value="${esp}">${esp}</option>`).join('');

      if (especialidadSelect) {
        especialidadSelect.disabled = false;
        especialidadSelect.innerHTML = optionsHtml;
      }
      if (editEspecialidadSelect) {
        editEspecialidadSelect.disabled = false;
        editEspecialidadSelect.innerHTML = optionsHtml;
      }
    } catch (err) {
      console.error('[CitasView] Error cargando médicos:', err);
      this._doctorCatalog = new Map();
      if (especialidadSelect) {
        especialidadSelect.innerHTML = '<option value="" disabled selected>Error cargando médicos</option>';
        especialidadSelect.disabled = true;
      }
      if (editEspecialidadSelect) {
        editEspecialidadSelect.innerHTML = '<option value="" disabled selected>Error cargando médicos</option>';
        editEspecialidadSelect.disabled = true;
      }
    }
  }

  _bindEvents() {
    if (this._eventsBound) return;
    this._eventsBound = true;

    // Búsqueda de paciente por DNI
    document.getElementById('btn-buscar-paciente-cita')?.addEventListener('click', () => {
      this._searchPatientByDni();
    });
    document.getElementById('cita-buscar-dni')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this._searchPatientByDni(); }
    });

    // Crear cita form
    document.getElementById('cita-especialidad')?.addEventListener('change', (e) => {
      this._populateDoctors(e.target.value, 'cita-medico');
    });

    document.getElementById('form-crear-cita')?.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      await this._scheduleAppointment();
    });

    document.getElementById('btn-cancelar-cita')?.addEventListener('click', () => {
      this._resetForm();
    });

    // Filtro lista de citas
    document.getElementById('filtro-citas-fecha')?.addEventListener('change', () => {
      this.renderCitasList();
    });

    document.getElementById('filtro-citas-dni')?.addEventListener('input', () => {
      this.renderCitasList();
    });

    // Modal de edición
    const modalEditar = document.getElementById('modal-editar-cita');
    const closeEditModal = () => { if (modalEditar) modalEditar.style.display = 'none'; };

    document.getElementById('btn-cerrar-modal-editar')?.addEventListener('click', closeEditModal);
    document.getElementById('btn-cancelar-edicion')?.addEventListener('click', closeEditModal);
    modalEditar?.addEventListener('click', (e) => {
      if (e.target === modalEditar) closeEditModal();
    });

    document.getElementById('form-editar-cita')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this._updateAppointment();
    });
  }

  _populateDoctors(especialidad, selectId) {
    const medSel = document.getElementById(selectId);
    if (!medSel) return;

    medSel.disabled = false;
    const opciones = this._doctorCatalog.get(especialidad) || [];

    if (opciones.length === 0) {
      medSel.innerHTML = '<option value="" disabled selected>No hay médicos disponibles</option>';
      medSel.disabled = true;
      return;
    }

    medSel.innerHTML = '<option value="" disabled selected>Seleccione médico</option>';
    opciones.forEach(name => {
      const opt = document.createElement('option');
      opt.value = opt.textContent = name;
      medSel.appendChild(opt);
    });
  }

  _nextAppointmentId() {
    const n = (this.state.appointments || []).length + 1;
    return `CIT${String(n).padStart(4, '0')}`;
  }

  async _scheduleAppointment() {
    if (!this._selectedPatient) return;

    const nuevaCita = {
      id: this._nextAppointmentId(),
      pacienteDni: this._selectedPatient.dni,
      pacienteNombre: `${this._selectedPatient.nombres} ${this._selectedPatient.apellidos}`,
      especialidad: document.getElementById('cita-especialidad').value,
      medico: document.getElementById('cita-medico').value,
      fecha: document.getElementById('cita-fecha').value,
      hora: document.getElementById('cita-hora').value,
      monto: parseFloat(document.getElementById('cita-monto').value) || 0,
      observaciones: document.getElementById('cita-observaciones').value || 'Ninguna',
      estado: 'espera_triaje', // Inicial por defecto, la caja cobrará o cambiará
      timestamp: Date.now()
    };

    try {
      await citaController.scheduleAppointment(nuevaCita);
      this.state.appointments = await citaController.getAppointments();
      this.showAlert('Cita agendada exitosamente.', 'success');
      this._resetForm();
      this.renderCitasList();
    } catch (err) {
      this.showAlert(err.message, 'danger');
    }
  }

  _resetForm() {
    document.getElementById('form-crear-cita')?.reset();
    // Clear DNI search
    const dniInput = document.getElementById('cita-buscar-dni');
    if (dniInput) dniInput.value = '';
    const nombreEl = document.getElementById('cita-nombre-paciente');
    if (nombreEl) nombreEl.textContent = '';
    const infoEl = document.getElementById('cita-paciente-info');
    if (infoEl) infoEl.textContent = '';
    const resultEl = document.getElementById('cita-paciente-resultado');
    if (resultEl) resultEl.style.display = 'none';
    const dniHidden = document.getElementById('cita-paciente-dni');
    if (dniHidden) dniHidden.value = '';
    document.getElementById('btn-agendar-cita').disabled = true;
    const medSel = document.getElementById('cita-medico');
    if (medSel) {
      medSel.disabled = true;
      medSel.innerHTML = '<option value="" disabled selected>Eliga especialidad primero</option>';
    }
    this._selectedPatient = null;
  }

  /* ──────────────────────────────────────────────────────────────
     LISTADO DE CITAS
  ────────────────────────────────────────────────────────────── */
  renderCitasList() {
    const tbody = document.getElementById('tabla-citas-body');
    if (!tbody) return;

    let citas = this.state.appointments || [];

    // Filter by date if selected
    const filterDate = document.getElementById('filtro-citas-fecha')?.value;
    if (filterDate) {
      citas = citas.filter(c => c.fecha === filterDate);
    }

    // Filter by DNI if entered
    const filterDni = (document.getElementById('filtro-citas-dni')?.value || '').trim();
    if (filterDni) {
      const normDni = filterDni.replace(/-/g, '').toUpperCase();
      citas = citas.filter(c => String(c.pacienteDni || '').replace(/-/g, '').toUpperCase().includes(normDni));
    }

    // Sort by timestamp descending
    citas.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    // Filter by pending statuses (not finalizado)
    citas = citas.filter(c => c.estado !== 'finalizado');

    if (citas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 16px;">No hay citas registradas.</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    citas.forEach(cita => {
      const tr = document.createElement('tr');
      
      let badgeClass = 'badge-pending';
      let estadoTexto = 'Pendiente';
      
      if (cita.estado === 'espera_triaje') { badgeClass = 'badge-paid'; estadoTexto = 'Triaje'; }
      else if (cita.estado === 'espera_consulta') { badgeClass = 'badge-triage'; estadoTexto = 'Espera Cons.'; }
      else if (cita.estado === 'finalizado') { badgeClass = 'badge-completed'; estadoTexto = 'Finalizado'; }

      tr.innerHTML = `
        <td style="padding: 8px; border-bottom: 1px solid var(--border-color);">${cita.hora || '—'}<br><small style="color:var(--text-muted)">${cita.fecha}</small></td>
        <td style="padding: 8px; border-bottom: 1px solid var(--border-color);">
          <strong>${cita.pacienteNombre}</strong><br>
          <small style="color:var(--text-muted)">DNI: ${cita.pacienteDni}</small>
        </td>
        <td style="padding: 8px; border-bottom: 1px solid var(--border-color);">${cita.medico}<br><small style="color:var(--text-muted)">${cita.especialidad}</small></td>
        <td style="padding: 8px; border-bottom: 1px solid var(--border-color);"><span class="badge ${badgeClass}">${estadoTexto}</span></td>
        <td style="padding: 8px; border-bottom: 1px solid var(--border-color); text-align: center;">
          <div style="display: flex; gap: 8px; justify-content: center;">
            <button class="btn btn-secondary btn-small btn-editar-cita" data-id="${cita.id}" title="Editar Cita" style="padding: 4px; display: flex; align-items: center; justify-content: center;">
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
            </button>
            <button class="btn btn-danger btn-small btn-eliminar-cita" data-id="${cita.id}" title="Eliminar Cita" style="padding: 4px; display: flex; align-items: center; justify-content: center; background-color: var(--danger); color: white; border: none;">
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.btn-editar-cita').forEach(btn => {
      btn.addEventListener('click', () => {
        const citaId = btn.getAttribute('data-id');
        this._openEditModal(citaId);
      });
    });

    tbody.querySelectorAll('.btn-eliminar-cita').forEach(btn => {
      btn.addEventListener('click', async () => {
        const citaId = btn.getAttribute('data-id');
        const cita = this.state.appointments.find(c => String(c.id) === String(citaId));
        if (confirm(`¿Está seguro que desea eliminar la cita de ${cita.pacienteNombre} programada para el ${cita.fecha}? Esta acción no se puede deshacer.`)) {
          try {
            await citaController.deleteAppointment(citaId);
            this.showAlert('Cita eliminada correctamente.', 'success');
            this.state.appointments = await citaController.getAppointments();
            this.renderCitasList();
          } catch (err) {
            this.showAlert('Error al eliminar la cita: ' + err.message, 'danger');
          }
        }
      });
    });
  }

  /* ──────────────────────────────────────────────────────────────
     EDICIÓN DE CITA
  ────────────────────────────────────────────────────────────── */
  _openEditModal(citaId) {
    const cita = (this.state.appointments || []).find(c => String(c.id) === String(citaId));
    if (!cita) {
      console.error("Cita no encontrada con ID:", citaId);
      return;
    }

    const elId = document.getElementById('edit-cita-id');
    const elFecha = document.getElementById('edit-cita-fecha');
    const elHora = document.getElementById('edit-cita-hora');
    const elEsp = document.getElementById('edit-cita-especialidad');
    const elMonto = document.getElementById('edit-cita-monto');
    const elObs = document.getElementById('edit-cita-observaciones');

    if (elId) elId.value = cita.id;
    if (elFecha) elFecha.value = cita.fecha;
    if (elHora) elHora.value = cita.hora;
    if (elEsp) elEsp.value = cita.especialidad || '';
    if (elMonto) elMonto.value = cita.monto || 800;
    if (elObs) elObs.value = cita.observaciones || '';

    // Rellenar médicos para la especialidad de la cita actual
    this._populateDoctors(cita.especialidad, 'edit-cita-medico');
    setTimeout(() => {
      const elMed = document.getElementById('edit-cita-medico');
      if (elMed) elMed.value = cita.medico;
    }, 50);

    const espSelect = document.getElementById('edit-cita-especialidad');
    if (espSelect) {
      espSelect.onchange = () => {
        this._populateDoctors(espSelect.value, 'edit-cita-medico');
      };
    }

    const modal = document.getElementById('modal-editar-cita');
    if (modal) modal.style.display = 'flex';
  }

  async _updateAppointment() {
    const id = document.getElementById('edit-cita-id').value;
    const newEspecialidad = document.getElementById('edit-cita-especialidad').value;
    const newMedico = document.getElementById('edit-cita-medico').value;
    const newFecha = document.getElementById('edit-cita-fecha').value;
    const newHora = document.getElementById('edit-cita-hora').value;
    const newMonto = document.getElementById('edit-cita-monto').value;
    const newObservaciones = document.getElementById('edit-cita-observaciones').value;

    try {
      await citaController.updateAppointment(id, {
        especialidad: newEspecialidad,
        medico: newMedico,
        fecha: newFecha,
        hora: newHora,
        monto: newMonto,
        observaciones: newObservaciones
      });
      
      this.state.appointments = await citaController.getAppointments();
      this.showAlert('Cita actualizada correctamente.', 'success');
      
      const modal = document.getElementById('modal-editar-cita');
      if (modal) modal.style.display = 'none';
      
      this.renderCitasList();
    } catch (err) {
      this.showAlert(err.message, 'danger');
    }
  }
}
