/* ==========================================================================
   SIREC - Vista: Pacientes (PacientesView.js)
   ========================================================================== */

import { pacienteController } from '../../controllers/pacienteController.js';
import { citaController }     from '../../controllers/citaController.js';
import { firestoreService }   from '../../services/firestoreService.js';

export class PacientesView {
  constructor(router, showAlert, onPatientSaved) {
    this.router         = router;
    this.showAlert      = showAlert;
    this.onPatientSaved = onPatientSaved;
  }

  bind() {
    if (!this._formBound) {
      this._applyInputMasks();
      this._bindFormSubmit();
      this._bindModal();
      this._formBound = true;
    }
    this.renderPacientes();
  }

  /* ──────────────────────────────────────────────────────────────
     LISTA DE PACIENTES
  ────────────────────────────────────────────────────────────── */
  async renderPacientes() {
    const listEl = document.getElementById('lista-pacientes');
    if (!listEl) return;

    listEl.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:24px;">Cargando pacientes...</div>';

    try {
      const pacientes = await pacienteController.getPatients();

      if (!pacientes || pacientes.length === 0) {
        listEl.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:24px;">No hay pacientes registrados.</div>';
        return;
      }

      listEl.innerHTML = pacientes.map(p => {
        const esActivo = p.activo !== false;

        // Badge de estado
        const badge = esActivo
          ? `<span style="
              display:inline-flex;align-items:center;gap:5px;
              background:#d1fae5;color:#065f46;
              border:1px solid #6ee7b7;
              border-radius:9999px;padding:2px 10px;
              font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;
            ">
              <span style="width:7px;height:7px;border-radius:50%;background:#10b981;display:inline-block;"></span>
              Activo
            </span>`
          : `<span style="
              display:inline-flex;align-items:center;gap:5px;
              background:#fee2e2;color:#991b1b;
              border:1px solid #fca5a5;
              border-radius:9999px;padding:2px 10px;
              font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;
            ">
              <span style="width:7px;height:7px;border-radius:50%;background:#ef4444;display:inline-block;"></span>
              Inactivo
            </span>`;

        // Botón toggle: Desactivar si activo, Activar si inactivo
        const btnToggle = esActivo
          ? `<button class="btn-toggle-estado" data-dni="${p.dni}" data-activo="true" data-perm-action="eliminar"
              style="background-color:#f59e0b;color:white;width:36px;height:36px;border-radius:50%;padding:0;
                     display:flex;align-items:center;justify-content:center;border:none;cursor:pointer;"
              title="Desactivar Paciente">
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2">
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"></path>
                <line x1="18" y1="8" x2="23" y2="13"></line>
                <line x1="23" y1="8" x2="18" y2="13"></line>
              </svg>
            </button>`
          : `<button class="btn-toggle-estado" data-dni="${p.dni}" data-activo="false" data-perm-action="eliminar"
              style="background-color:#10b981;color:white;width:36px;height:36px;border-radius:50%;padding:0;
                     display:flex;align-items:center;justify-content:center;border:none;cursor:pointer;"
              title="Activar Paciente">
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2">
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"></path>
                <polyline points="16 11 18 13 22 9"></polyline>
              </svg>
            </button>`;

        return `
          <div class="stat-card" style="
            align-items:flex-start;flex-direction:column;gap:8px;justify-content:flex-start;
            position:relative;
            ${!esActivo ? 'opacity:0.6;border:1px dashed var(--border-color);' : ''}
          ">
            <!-- Badge de estado en la esquina superior izquierda -->
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;">
              <h3 style="margin:0;font-size:1.1rem;color:var(--primary);padding-right:80px;">${p.nombres} ${p.apellidos}</h3>
            </div>
            <div style="margin-bottom:4px;">${badge}</div>

            <div style="font-size:0.9rem;color:var(--text-muted);display:flex;flex-direction:column;gap:6px;width:100%;">
              <span style="display:flex;justify-content:space-between;"><strong>DNI:</strong> <span>${p.dni}</span></span>
              <span style="display:flex;justify-content:space-between;"><strong>Tel:</strong> <span>${p.telefono}</span></span>
              <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border-color);font-size:0.85rem;">
                <span style="display:block;color:var(--text-primary);">Sangre: ${p.tipoSangre}</span>
                ${p.alergias && p.alergias !== 'Ninguna' && p.alergias !== 'No sabe'
                  ? `<span style="display:block;color:var(--danger);margin-top:4px;">Alergias: ${p.alergias}</span>` : ''}
                ${p.contactoEmergencia && p.contactoEmergencia !== 'No especifica'
                  ? `<span style="display:block;margin-top:4px;">Emergencia: ${p.contactoEmergencia}</span>` : ''}
              </div>
            </div>

            <div style="position:absolute; right:16px; top:16px; display:flex; gap:8px;">
              <!-- Editar Paciente -->
              <button class="btn btn-secondary btn-editar" data-dni="${p.dni}" data-perm-action="editar"
                style="width:36px;height:36px;border-radius:50%;padding:0;display:flex;align-items:center;justify-content:center;border:1px solid var(--border-color);"
                title="Editar Paciente">
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2">
                  <path d="M12 20h9"></path>
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                </svg>
              </button>

              <!-- Generar Reporte -->
              <button class="btn btn-secondary btn-reporte" data-dni="${p.dni}"
                style="width:36px;height:36px;border-radius:50%;padding:0;display:flex;align-items:center;justify-content:center;border:1px solid var(--border-color);"
                title="Generar Reporte">
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
              </button>

              <!-- Toggle Activo / Inactivo -->
              ${btnToggle}
            </div>
          </div>
        `;
      }).join('');

      listEl.querySelectorAll('.btn-editar').forEach(btn => {
        btn.addEventListener('click', () => {
          const patient = pacientes.find(p => p.dni === btn.getAttribute('data-dni'));
          this._abrirEditarPaciente(patient);
        });
      });

      listEl.querySelectorAll('.btn-reporte').forEach(btn => {
        btn.addEventListener('click', async () => {
          const patient = pacientes.find(p => p.dni === btn.getAttribute('data-dni'));
          await this._abrirReporte(patient);
        });
      });

      listEl.querySelectorAll('.btn-toggle-estado').forEach(btn => {
        btn.addEventListener('click', async () => {
          const patient = pacientes.find(p => p.dni === btn.getAttribute('data-dni'));
          const estaActivo = btn.getAttribute('data-activo') === 'true';

          if (estaActivo) {
            if (confirm(`¿Desea desactivar a ${patient.nombres} ${patient.apellidos}?\n\nEl paciente quedará inactivo pero sus datos se conservarán en el sistema.`)) {
              try {
                await pacienteController.deactivatePatient(patient.dni);
                this.showAlert(`Paciente ${patient.nombres} ${patient.apellidos} marcado como inactivo.`, 'warning');
                if (typeof this.onPatientSaved === 'function') this.onPatientSaved();
                this.renderPacientes();
              } catch (err) {
                this.showAlert('Error al desactivar paciente: ' + err.message, 'danger');
              }
            }
          } else {
            if (confirm(`¿Desea volver a activar a ${patient.nombres} ${patient.apellidos}?`)) {
              try {
                await pacienteController.reactivatePatient(patient.dni);
                this.showAlert(`Paciente ${patient.nombres} ${patient.apellidos} activado nuevamente.`, 'success');
                if (typeof this.onPatientSaved === 'function') this.onPatientSaved();
                this.renderPacientes();
              } catch (err) {
                this.showAlert('Error al activar paciente: ' + err.message, 'danger');
              }
            }
          }
        });
      });

    } catch (err) {
      listEl.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--danger);padding:24px;">Error al cargar pacientes: ${err.message}</div>`;
    }
  }


  async _abrirReporte(p) {
    const hoy  = new Date();
    const nac  = p.fechaNacimiento ? new Date(p.fechaNacimiento + 'T00:00') : null;
    const edad = nac ? Math.floor((hoy - nac) / (365.25 * 24 * 60 * 60 * 1000)) : '—';

    const fechaReg = p.creadoEn
      ? new Date(p.creadoEn).toLocaleDateString('es-HN', { day:'2-digit', month:'long', year:'numeric' })
      : '—';

    let consultas      = [];
    let totalConsultas = 0;
    let ultimaCita     = '—';
    let citasMap       = {}; // declarado fuera del try para que sea accesible en event listeners
    let historialRows  = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:16px;">No existen consultas registradas para este paciente.</td></tr>';

    try {
      const todasConsultas = await firestoreService.getAll('consultas', 'consultas');
      const todasCitas     = await firestoreService.getAll('citas', 'citas');
      (todasCitas || []).forEach(cita => { citasMap[cita.id] = cita; });

      consultas = (todasConsultas || []).filter(c => c.pacienteDni === p.dni);
      consultas.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      totalConsultas = consultas.length;

      if (consultas.length > 0) {
        const ultimaFecha = consultas[0].timestamp
          ? new Date(consultas[0].timestamp).toLocaleDateString('es-HN', { day:'2-digit', month:'long', year:'numeric' })
          : (consultas[0].fecha || '—');
        ultimaCita = ultimaFecha;

        historialRows = consultas.map((c, idx) => {
          const fecha = c.timestamp
            ? new Date(c.timestamp).toLocaleDateString('es-HN', { day:'2-digit', month:'short', year:'numeric' })
            : (c.fecha || '—');
          // La especialidad vive en el objeto cita (no en ExpedienteModel), se obtiene cruzando por citaId
          const citaRef     = citasMap[c.citaId] || {};
          const especialidad = c.especialidad || citaRef.especialidad || '—';
          return `
            <tr>
              <td style="padding:10px 12px;border-bottom:1px solid var(--border-color);white-space:nowrap;">${fecha}</td>
              <td style="padding:10px 12px;border-bottom:1px solid var(--border-color);">${c.medico || '—'}</td>
              <td style="padding:10px 12px;border-bottom:1px solid var(--border-color);">${especialidad}</td>
              <td style="padding:10px 12px;border-bottom:1px solid var(--border-color);">${c.diagnostico || '—'}</td>
              <td style="padding:10px 12px;border-bottom:1px solid var(--border-color);">${c.tratamiento || '—'}</td>
              <td style="padding:8px 12px;border-bottom:1px solid var(--border-color);text-align:center;">
                <button class="btn-ver-detalle" data-idx="${idx}"
                  style="background:var(--primary-light);color:var(--primary);border:1px solid var(--primary);border-radius:var(--radius-md);padding:4px 10px;font-size:0.75rem;font-weight:600;cursor:pointer;white-space:nowrap;">
                  Ver
                </button>
              </td>
            </tr>`;
        }).join('');
      }
    } catch (_) { /* sin consultas disponibles */ }

    const camposGenerales = [
      ['Nombre Completo',      `${p.nombres} ${p.apellidos}`],
      ['Identidad (DNI)',       p.dni],
      ['Edad',                 `${edad} años`],
      ['Sexo',                 p.genero || '—'],
      ['Teléfono',             p.telefono || '—'],
      ['Correo',               p.correo && p.correo !== 'No especifica' ? p.correo : '—'],
      ['Dirección',            p.direccion && p.direccion !== 'No especifica' ? p.direccion : '—'],
      ['Fecha Nacimiento',     nac ? nac.toLocaleDateString('es-HN', { day:'2-digit', month:'long', year:'numeric' }) : '—'],
      ['Fecha de Registro',    fechaReg],
      ['Tipo de Sangre',       p.tipoSangre || '—'],
      ['Alergias',             p.alergias && p.alergias !== 'No sabe' ? p.alergias : 'Ninguna'],
      ['Contacto Emergencia',  p.contactoEmergencia && p.contactoEmergencia !== 'No especifica' ? p.contactoEmergencia : '—'],
    ];

    let modal = document.getElementById('modal-reporte-paciente');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-reporte-paciente';
      modal.className = 'modal-overlay';
      modal.style.display = 'none';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-content" style="max-width:820px;padding:0;width:95%;">
        <div class="glass-card" style="margin:0;max-height:90vh;overflow-y:auto;" id="reporte-print-area">

          <!-- Encabezado -->
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid var(--primary);">
            <div>
              <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">SIREC · Clínica San Rafael</div>
              <h2 style="margin:0;font-size:1.4rem;font-weight:800;color:var(--primary);">Reporte Individual de Paciente</h2>
              <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;">Generado el ${hoy.toLocaleDateString('es-HN', { day:'2-digit', month:'long', year:'numeric' })}</div>
            </div>
            <button id="btn-cerrar-reporte" style="background:none;border:none;cursor:pointer;color:var(--text-muted);">
              <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" fill="none" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <!-- Datos generales -->
          <h3 style="margin:0 0 12px;font-size:0.85rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Datos Generales</h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-bottom:24px;">
            ${camposGenerales.map(([label, val]) => `
              <div style="background:var(--bg-primary);padding:12px;border-radius:var(--radius-md);border:1px solid var(--border-color);">
                <div style="font-size:0.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px;">${label}</div>
                <div style="font-size:0.9rem;font-weight:600;color:var(--text-primary);">${val}</div>
              </div>`).join('')}
          </div>

          <!-- Resumen estadístico -->
          <div style="display:flex;gap:16px;margin-bottom:24px;flex-wrap:wrap;">
            <div style="flex:1;min-width:150px;background:var(--primary-light);padding:16px;border-radius:var(--radius-md);border:1px solid var(--primary);">
              <div style="font-size:0.72rem;font-weight:700;color:var(--primary);text-transform:uppercase;">Total de Consultas</div>
              <div style="font-size:2rem;font-weight:800;color:var(--primary);">${totalConsultas}</div>
            </div>
            <div style="flex:1;min-width:150px;background:var(--success-light);padding:16px;border-radius:var(--radius-md);border:1px solid var(--success);">
              <div style="font-size:0.72rem;font-weight:700;color:var(--success);text-transform:uppercase;">Última Consulta</div>
              <div style="font-size:1rem;font-weight:700;color:var(--success);margin-top:8px;">${ultimaCita}</div>
            </div>
          </div>

          <!-- Historial Médico -->
          <h3 style="margin:0 0 12px;font-size:0.85rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Historial Médico</h3>
          <div style="overflow-x:auto;border:1px solid var(--border-color);border-radius:var(--radius-md);">
            <table style="width:100%;font-size:0.875rem;border-collapse:collapse;">
              <thead>
                <tr style="background:var(--bg-primary);">
                  <th style="padding:10px 12px;text-align:left;color:var(--text-secondary);font-weight:600;border-bottom:1px solid var(--border-color);">Fecha</th>
                  <th style="padding:10px 12px;text-align:left;color:var(--text-secondary);font-weight:600;border-bottom:1px solid var(--border-color);">Médico</th>
                  <th style="padding:10px 12px;text-align:left;color:var(--text-secondary);font-weight:600;border-bottom:1px solid var(--border-color);">Especialidad</th>
                  <th style="padding:10px 12px;text-align:left;color:var(--text-secondary);font-weight:600;border-bottom:1px solid var(--border-color);">Diagnóstico</th>
                  <th style="padding:10px 12px;text-align:left;color:var(--text-secondary);font-weight:600;border-bottom:1px solid var(--border-color);">Tratamiento</th>
                  <th style="padding:10px 12px;text-align:center;color:var(--text-secondary);font-weight:600;border-bottom:1px solid var(--border-color);width:60px;">Detalle</th>
                </tr>
              </thead>
              <tbody>${historialRows}</tbody>
            </table>
          </div>

          <!-- Acciones -->
          <div id="reporte-acciones" style="display:flex;justify-content:flex-end;gap:12px;margin-top:24px;">
            <button class="btn btn-secondary" id="btn-reporte-csv">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2" style="margin-right:6px;">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Descargar CSV
            </button>
            <button class="btn btn-primary" id="btn-reporte-pdf">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2" style="margin-right:6px;">
                <polyline points="6 9 6 2 18 2 18 9"/>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
              Imprimir / PDF
            </button>
          </div>

        </div>
      </div>`;

    modal.style.display = 'flex';

    document.getElementById('btn-cerrar-reporte').addEventListener('click', () => {
      modal.style.display = 'none';
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.style.display = 'none';
    });

    /* Botones Ver detalle por consulta */
    modal.querySelectorAll('.btn-ver-detalle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-idx'));
        const citaRef = (consultas[idx]?.citaId) ? (citasMap?.[consultas[idx].citaId] || {}) : {};
        this._abrirDetalleConsulta(consultas[idx], citaRef, p);
      });
    });

    document.getElementById('btn-reporte-pdf').addEventListener('click', () => {
      /* ── Construir documento PDF profesional para impresión ── */
      const fechaGeneracion = new Date().toLocaleDateString('es-HN', { day:'2-digit', month:'long', year:'numeric' });

      // ── Historial médico tabla ──
      let historialTabla = '';
      if (consultas.length === 0) {
        historialTabla = `
          <tr>
            <td colspan="5" style="text-align:center;color:#64748b;padding:24px 12px;font-style:italic;font-size:0.9rem;">
              No hay un historial médico previo registrado para este paciente.
            </td>
          </tr>`;
      } else {
        historialTabla = consultas.map(c => {
          const fecha = c.timestamp
            ? new Date(c.timestamp).toLocaleDateString('es-HN', { day:'2-digit', month:'short', year:'numeric' })
            : (c.fecha || '—');
          const citaRef = citasMap[c.citaId] || {};
          const especialidad = c.especialidad || citaRef.especialidad || '—';
          return `
            <tr>
              <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:0.82rem;white-space:nowrap;">${fecha}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:0.82rem;">${c.medico || '—'}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:0.82rem;">${especialidad}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:0.82rem;">${c.diagnostico || '—'}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:0.82rem;">${c.tratamiento || '—'}</td>
            </tr>`;
        }).join('');
      }

      // ── Campos del paciente en pares para la tabla ──
      const camposPDF = [
        ['Nombre Completo', `${p.nombres} ${p.apellidos}`],
        ['Identidad (DNI)', p.dni],
        ['Edad', `${edad} años`],
        ['Sexo', p.genero || '—'],
        ['Fecha de Nacimiento', nac ? nac.toLocaleDateString('es-HN', { day:'2-digit', month:'long', year:'numeric' }) : '—'],
        ['Teléfono', p.telefono || '—'],
        ['Correo', p.correo && p.correo !== 'No especifica' ? p.correo : '—'],
        ['Dirección', p.direccion && p.direccion !== 'No especifica' ? p.direccion : '—'],
        ['Tipo de Sangre', p.tipoSangre || '—'],
        ['Alergias', p.alergias && p.alergias !== 'No sabe' ? p.alergias : 'Ninguna'],
        ['Contacto de Emergencia', p.contactoEmergencia && p.contactoEmergencia !== 'No especifica' ? p.contactoEmergencia : '—'],
        ['Fecha de Registro', fechaReg],
      ];

      // Generar filas de datos en pares (2 columnas label+value por fila)
      let datosPacienteRows = '';
      for (let i = 0; i < camposPDF.length; i += 2) {
        const c1 = camposPDF[i];
        const c2 = camposPDF[i + 1];
        datosPacienteRows += '<tr>';
        datosPacienteRows += `<td style="padding:6px 10px;font-weight:700;color:#475569;width:18%;border-bottom:1px solid #f1f5f9;">${c1[0]}</td>`;
        datosPacienteRows += `<td style="padding:6px 10px;color:#1e293b;width:32%;border-bottom:1px solid #f1f5f9;">${c1[1]}</td>`;
        if (c2) {
          datosPacienteRows += `<td style="padding:6px 10px;font-weight:700;color:#475569;width:18%;border-bottom:1px solid #f1f5f9;">${c2[0]}</td>`;
          datosPacienteRows += `<td style="padding:6px 10px;color:#1e293b;width:32%;border-bottom:1px solid #f1f5f9;">${c2[1]}</td>`;
        } else {
          datosPacienteRows += '<td colspan="2" style="border-bottom:1px solid #f1f5f9;"></td>';
        }
        datosPacienteRows += '</tr>';
      }

      // ── Crear contenedor de impresión separado ──
      let printContainer = document.getElementById('reporte-pdf-container');
      if (printContainer) printContainer.remove();

      printContainer = document.createElement('div');
      printContainer.id = 'reporte-pdf-container';
      printContainer.innerHTML = `
        <div style="
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          color: #1e293b;
          line-height: 1.5;
          padding: 20px;
          max-width: 100%;
          background: white;
        ">
          <!-- ═══ ENCABEZADO CLÍNICA ═══ -->
          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #1e3a8a;padding-bottom:16px;margin-bottom:20px;">
            <div style="display:flex;gap:14px;align-items:center;">
              <div style="width:56px;height:56px;border-radius:10px;overflow:hidden;flex-shrink:0;border:2px solid #1e3a8a;">
                <img src="../src/assets/logo.png" alt="Logo" style="width:100%;height:100%;object-fit:cover;"
                  onerror="this.parentElement.innerHTML='<div style=\\'background:linear-gradient(135deg,#1e3a8a,#3b82f6);width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:white;font-weight:900;font-size:1.5rem;\\'>SR</div>'"
                >
              </div>
              <div>
                <h1 style="margin:0;font-size:1.4rem;color:#1e3a8a;font-weight:800;letter-spacing:-0.3px;">CLÍNICA MÉDICA SAN RAFAEL</h1>
                <p style="margin:2px 0 0 0;font-size:0.82rem;color:#64748b;">Avenida Circunvalación, San Pedro Sula, Honduras</p>
                <p style="margin:1px 0 0 0;font-size:0.82rem;color:#64748b;">Tel: 2550-1234 &nbsp;|&nbsp; Correo: info@clinicasanrafael.com</p>
                <p style="margin:1px 0 0 0;font-size:0.82rem;color:#64748b;">RTN: 0501-1990-123456</p>
              </div>
            </div>
            <div style="text-align:right;">
              <h2 style="margin:0;font-size:1.1rem;color:#0f172a;font-weight:700;">REPORTE DE PACIENTE</h2>
              <p style="margin:4px 0 0 0;font-size:0.82rem;color:#64748b;">Fecha: ${fechaGeneracion}</p>
            </div>
          </div>

          <!-- ═══ DATOS GENERALES DEL PACIENTE ═══ -->
          <div style="margin-bottom:20px;">
            <h3 style="margin:0 0 10px 0;font-size:0.9rem;color:#1e3a8a;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #cbd5e1;padding-bottom:6px;">
              Datos Generales del Paciente
            </h3>
            <table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
              <tbody>
                ${datosPacienteRows}
              </tbody>
            </table>
          </div>

          <!-- ═══ RESUMEN ESTADÍSTICO ═══ -->
          <div style="display:flex;gap:16px;margin-bottom:20px;">
            <div style="flex:1;background:#eff6ff;padding:14px 16px;border-radius:8px;border:1px solid #bfdbfe;">
              <div style="font-size:0.72rem;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:0.5px;">Total de Consultas</div>
              <div style="font-size:1.8rem;font-weight:800;color:#1e3a8a;margin-top:2px;">${totalConsultas}</div>
            </div>
            <div style="flex:1;background:#f0fdf4;padding:14px 16px;border-radius:8px;border:1px solid #bbf7d0;">
              <div style="font-size:0.72rem;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.5px;">Última Consulta</div>
              <div style="font-size:1rem;font-weight:700;color:#15803d;margin-top:6px;">${ultimaCita}</div>
            </div>
          </div>

          <!-- ═══ HISTORIAL MÉDICO ═══ -->
          <div style="margin-bottom:20px;">
            <h3 style="margin:0 0 10px 0;font-size:0.9rem;color:#1e3a8a;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #cbd5e1;padding-bottom:6px;">
              Historial Médico
            </h3>
            <table style="width:100%;border-collapse:collapse;font-size:0.85rem;border:1px solid #e2e8f0;">
              <thead>
                <tr style="background:#f1f5f9;">
                  <th style="padding:8px 10px;text-align:left;font-weight:700;color:#334155;border-bottom:2px solid #cbd5e1;font-size:0.8rem;">Fecha</th>
                  <th style="padding:8px 10px;text-align:left;font-weight:700;color:#334155;border-bottom:2px solid #cbd5e1;font-size:0.8rem;">Médico</th>
                  <th style="padding:8px 10px;text-align:left;font-weight:700;color:#334155;border-bottom:2px solid #cbd5e1;font-size:0.8rem;">Especialidad</th>
                  <th style="padding:8px 10px;text-align:left;font-weight:700;color:#334155;border-bottom:2px solid #cbd5e1;font-size:0.8rem;">Diagnóstico</th>
                  <th style="padding:8px 10px;text-align:left;font-weight:700;color:#334155;border-bottom:2px solid #cbd5e1;font-size:0.8rem;">Tratamiento</th>
                </tr>
              </thead>
              <tbody>
                ${historialTabla}
              </tbody>
            </table>
          </div>

          <!-- ═══ PIE DE PÁGINA ═══ -->
          <div style="margin-top:30px;padding-top:12px;border-top:2px solid #1e3a8a;display:flex;justify-content:space-between;align-items:center;">
            <p style="margin:0;font-size:0.75rem;color:#94a3b8;">
              Documento generado electrónicamente por SIREC — Clínica Médica San Rafael &copy; ${new Date().getFullYear()}
            </p>
            <p style="margin:0;font-size:0.75rem;color:#94a3b8;">
              Página 1 de 1
            </p>
          </div>
        </div>
      `;

      document.body.appendChild(printContainer);

      // Agregar estilo dinámico para impresión
      let printStyle = document.getElementById('reporte-pdf-print-style');
      if (!printStyle) {
        printStyle = document.createElement('style');
        printStyle.id = 'reporte-pdf-print-style';
        document.head.appendChild(printStyle);
      }
      printStyle.innerHTML = `
        #reporte-pdf-container { display: none; }
        @media print {
          #reporte-pdf-container { display: block !important; }
          @page { size: letter; margin: 1cm; }
        }
      `;

      // Ocultar el modal para que solo se imprima el PDF
      modal.style.display = 'none';

      // Limpiar después de cerrar el diálogo de impresión
      const cleanupPrint = () => {
        printContainer.remove();
        printStyle.remove();
        modal.style.display = 'flex';
        window.removeEventListener('afterprint', cleanupPrint);
      };
      window.addEventListener('afterprint', cleanupPrint);

      setTimeout(() => window.print(), 300);
    });

    /* CSV — mismo patrón Data URI que _exportCSV() del Dashboard */
    document.getElementById('btn-reporte-csv').addEventListener('click', () => {
      let csv = 'data:text/csv;charset=utf-8,';
      csv += 'Campo,Valor\n';
      csv += `Nombre,"${p.nombres} ${p.apellidos}"\n`;
      csv += `DNI,"${p.dni}"\n`;
      csv += `Edad,"${edad} años"\n`;
      csv += `Sexo,"${p.genero || ''}"\n`;
      csv += `Teléfono,"${p.telefono || ''}"\n`;
      csv += `Correo,"${p.correo || ''}"\n`;
      csv += `Dirección,"${p.direccion || ''}"\n`;
      csv += `Tipo de Sangre,"${p.tipoSangre || ''}"\n`;
      csv += `Alergias,"${p.alergias || 'Ninguna'}"\n`;
      csv += `Contacto Emergencia,"${p.contactoEmergencia || ''}"\n`;
      csv += `Fecha de Registro,"${fechaReg}"\n`;
      csv += `Total de Consultas,"${totalConsultas}"\n`;
      csv += `Última Consulta,"${ultimaCita}"\n\n`;
      csv += 'Historial Médico\n';
      csv += 'Fecha,Médico,Especialidad,Diagnóstico,Tratamiento\n';
      consultas.forEach(c => {
        const fecha = c.timestamp
          ? new Date(c.timestamp).toLocaleDateString('es-HN')
          : (c.fecha || '');
        csv += `"${fecha}","${c.medico || ''}","${c.especialidad || ''}","${c.diagnostico || ''}","${c.tratamiento || ''}"\n`;
      });

      const link = document.createElement('a');
      link.href     = encodeURI(csv);
      link.download = `Reporte_${p.dni}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      this.showAlert('Reporte CSV descargado correctamente.', 'success');
    });
  }

  /* ──────────────────────────────────────────────────────────────
     DETALLE DE CONSULTA (EXPEDIENTE COMPLETO)
  ────────────────────────────────────────────────────────────── */
  _abrirDetalleConsulta(c, citaRef, paciente) {
    const fecha = c.timestamp
      ? new Date(c.timestamp).toLocaleString('es-HN', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })
      : (c.fecha || '—');
    const especialidad = c.especialidad || citaRef.especialidad || '—';
    const receta = c.receta || c.medicamentos || [];
    const examenes = c.examenes || [];

    const recetaRows = receta.length
      ? receta.map(m => `
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border-color);">${m.nombre || m.farmaco || '—'}</td>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border-color);text-align:center;">${m.cantidad || '—'}</td>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border-color);">${m.dosis || '—'}</td>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border-color);">${m.duracion ? m.duracion + ' días' : '—'}</td>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border-color);">${m.expira || '—'}</td>
          </tr>`).join('')
      : `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:12px;">Sin receta registrada.</td></tr>`;

    const examenesHtml = examenes.length
      ? examenes.map(e => `<span style="display:inline-block;padding:3px 10px;border-radius:9999px;background:var(--primary-light);color:var(--primary);font-size:0.78rem;font-weight:600;margin:2px;">${e}</span>`).join('')
      : `<span style="color:var(--text-muted);font-size:0.875rem;">Sin exámenes registrados.</span>`;

    const campo = (label, val) => `
      <div style="background:var(--bg-primary);padding:12px;border-radius:var(--radius-md);border:1px solid var(--border-color);">
        <div style="font-size:0.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px;">${label}</div>
        <div style="font-size:0.875rem;color:var(--text-primary);white-space:pre-wrap;">${val || 'No registrado'}</div>
      </div>`;

    let detalle = document.getElementById('modal-detalle-consulta');
    if (!detalle) {
      detalle = document.createElement('div');
      detalle.id = 'modal-detalle-consulta';
      detalle.className = 'modal-overlay';
      detalle.style.cssText = 'display:none;z-index:1100;';
      document.body.appendChild(detalle);
    }

    detalle.innerHTML = `
      <div class="modal-content" style="max-width:800px;padding:0;width:95%;">
        <div class="glass-card" style="margin:0;max-height:90vh;overflow-y:auto;">

          <!-- Encabezado -->
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid var(--primary);">
            <div>
              <div style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Expediente Clínico</div>
              <h2 style="margin:0;font-size:1.25rem;font-weight:800;color:var(--primary);">${paciente.nombres} ${paciente.apellidos}</h2>
              <div style="font-size:0.82rem;color:var(--text-muted);margin-top:4px;">${fecha} &nbsp;·&nbsp; ${especialidad}</div>
            </div>
            <button id="btn-cerrar-detalle" style="background:none;border:none;cursor:pointer;color:var(--text-muted);">
              <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" fill="none" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <!-- Datos de la consulta -->
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin-bottom:20px;">
            ${campo('Médico',          c.medico)}
            ${campo('Especialidad',    especialidad)}
            ${campo('Motivo',          c.motivo)}
            ${campo('Diagnóstico (CIE-10)', c.diagnostico)}
            ${campo('Sintomatología',  c.sintomatologia)}
            ${campo('Antecedentes',    c.antecedentes)}
            ${campo('Tratamiento',     c.tratamiento)}
          </div>

          <!-- Receta médica -->
          <h3 style="margin:0 0 10px;font-size:0.82rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Receta Médica</h3>
          <div style="overflow-x:auto;border:1px solid var(--border-color);border-radius:var(--radius-md);margin-bottom:20px;">
            <table style="width:100%;font-size:0.85rem;border-collapse:collapse;">
              <thead>
                <tr style="background:var(--bg-primary);">
                  <th style="padding:8px 12px;text-align:left;color:var(--text-secondary);font-weight:600;border-bottom:1px solid var(--border-color);">Medicamento</th>
                  <th style="padding:8px 12px;text-align:center;color:var(--text-secondary);font-weight:600;border-bottom:1px solid var(--border-color);">Cantidad</th>
                  <th style="padding:8px 12px;text-align:left;color:var(--text-secondary);font-weight:600;border-bottom:1px solid var(--border-color);">Dosis</th>
                  <th style="padding:8px 12px;text-align:left;color:var(--text-secondary);font-weight:600;border-bottom:1px solid var(--border-color);">Duración</th>
                  <th style="padding:8px 12px;text-align:left;color:var(--text-secondary);font-weight:600;border-bottom:1px solid var(--border-color);">Expira</th>
                </tr>
              </thead>
              <tbody>${recetaRows}</tbody>
            </table>
          </div>

          <!-- Exámenes -->
          <h3 style="margin:0 0 10px;font-size:0.82rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Exámenes de Laboratorio</h3>
          <div style="margin-bottom:20px;">${examenesHtml}</div>

          <!-- Volver -->
          <div style="display:flex;justify-content:flex-end;">
            <button class="btn btn-secondary" id="btn-volver-reporte">&#8592; Volver al Reporte</button>
          </div>

        </div>
      </div>`;

    detalle.style.display = 'flex';

    document.getElementById('btn-cerrar-detalle').addEventListener('click', () => {
      detalle.style.display = 'none';
    });
    document.getElementById('btn-volver-reporte').addEventListener('click', () => {
      detalle.style.display = 'none';
    });
    detalle.addEventListener('click', e => {
      if (e.target === detalle) detalle.style.display = 'none';
    });
  }

  /* ──────────────────────────────────────────────────────────────
     MODAL NUEVO PACIENTE
  ────────────────────────────────────────────────────────────── */
  _bindModal() {
    const modal     = document.getElementById('modal-paciente');
    const btnOpen   = document.getElementById('btn-open-modal-paciente');
    const btnClose  = document.getElementById('btn-close-modal-paciente');
    const btnCancel = document.getElementById('btn-cancel-modal-paciente');

    if (btnOpen) {
      btnOpen.addEventListener('click', () => { 
        this._editingDni = null;
        document.getElementById('paciente-dni').readOnly = false;
        const title = modal.querySelector('.card-title');
        if (title) title.textContent = 'Nuevo Paciente';
        const form = document.getElementById('form-registro-paciente');
        if (form) form.reset();
        modal.style.display = 'flex'; 
      });
    }

    const closeModal = () => {
      modal.style.display = 'none';
      const form = document.getElementById('form-registro-paciente');
      if (form) form.reset();
      
      this._editingDni = null;
      document.getElementById('paciente-dni').readOnly = false;
      const title = modal.querySelector('.card-title');
      if (title) title.textContent = 'Nuevo Paciente';
    };
    if (btnClose)  btnClose.addEventListener('click',  closeModal);
    if (btnCancel) btnCancel.addEventListener('click', closeModal);
  }

  /* ──────────────────────────────────────────────────────────────
     MÁSCARAS DE ENTRADA
  ────────────────────────────────────────────────────────────── */
  _applyInputMasks() {
    const dniInput = document.getElementById('paciente-dni');
    if (!dniInput) return;

    dniInput.addEventListener('input', (e) => {
      let v = e.target.value.replace(/\D/g, '').slice(0, 13);
      if (v.length > 8)      v = `${v.slice(0,4)}-${v.slice(4,8)}-${v.slice(8)}`;
      else if (v.length > 4) v = `${v.slice(0,4)}-${v.slice(4)}`;
      e.target.value = v;
    });

    ['paciente-nombres', 'paciente-apellidos'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', () => {
        el.setCustomValidity(/\d/.test(el.value) ? 'No se permiten números.' : '');
      });
    });

    const bday = document.getElementById('paciente-fecha-nacimiento');
    if (bday) {
      bday.addEventListener('input', () => {
        bday.setCustomValidity(
          new Date(bday.value) >= new Date() ? 'La fecha debe estar en el pasado.' : ''
        );
      });
    }
  }

  /* ──────────────────────────────────────────────────────────────
     FORMULARIO NUEVO/EDITAR PACIENTE
  ────────────────────────────────────────────────────────────── */
  _abrirEditarPaciente(patient) {
    this._editingDni = patient.dni; // Flag
    
    const modal = document.getElementById('modal-paciente');
    const title = modal.querySelector('.card-title');
    if (title) title.textContent = 'Editar Paciente';

    document.getElementById('paciente-dni').value = patient.dni;
    document.getElementById('paciente-dni').readOnly = true; 
    
    document.getElementById('paciente-nombres').value = patient.nombres;
    document.getElementById('paciente-apellidos').value = patient.apellidos;
    document.getElementById('paciente-fecha-nacimiento').value = patient.fechaNacimiento;
    document.getElementById('paciente-genero').value = patient.genero;
    document.getElementById('paciente-telefono').value = patient.telefono;
    document.getElementById('paciente-correo').value = patient.correo === 'No especifica' ? '' : patient.correo;
    document.getElementById('paciente-direccion').value = patient.direccion === 'No especifica' ? '' : patient.direccion;
    document.getElementById('paciente-tipo-sangre').value = patient.tipoSangre;
    document.getElementById('paciente-contacto-emergencia').value = patient.contactoEmergencia === 'No especifica' ? '' : patient.contactoEmergencia;
    document.getElementById('paciente-alergias').value = patient.alergias === 'Ninguna' ? '' : patient.alergias;

    modal.style.display = 'flex';
  }

  _bindFormSubmit() {
    const form = document.getElementById('form-registro-paciente');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const formData = {
        dni:                document.getElementById('paciente-dni').value,
        nombres:            document.getElementById('paciente-nombres').value,
        apellidos:          document.getElementById('paciente-apellidos').value,
        fechaNacimiento:    document.getElementById('paciente-fecha-nacimiento').value,
        genero:             document.getElementById('paciente-genero').value,
        telefono:           document.getElementById('paciente-telefono').value,
        correo:             document.getElementById('paciente-correo').value             || 'No especifica',
        direccion:          document.getElementById('paciente-direccion').value           || 'No especifica',
        tipoSangre:         document.getElementById('paciente-tipo-sangre').value        || 'No sabe',
        contactoEmergencia: document.getElementById('paciente-contacto-emergencia').value || 'No especifica',
        alergias:           document.getElementById('paciente-alergias').value           || 'Ninguna'
      };

      try {
        if (this._editingDni) {
          await pacienteController.updatePatient(this._editingDni, formData);
          this.showAlert(`Paciente ${formData.nombres} actualizado exitosamente.`, 'success');
        } else {
          await pacienteController.registerPatient(formData);
          this.showAlert(`Paciente ${formData.nombres} registrado exitosamente.`, 'success');
        }

        form.reset();
        document.getElementById('paciente-dni').readOnly = false;
        this._editingDni = null;
        
        const modal = document.getElementById('modal-paciente');
        if (modal) {
          const title = modal.querySelector('.card-title');
          if (title) title.textContent = 'Nuevo Paciente';
          modal.style.display = 'none';
        }

        if (typeof this.onPatientSaved === 'function') this.onPatientSaved(formData);
        this.renderPacientes();
      } catch (err) {
        this.showAlert(err.message, 'danger');
      }
    });
  }
}
