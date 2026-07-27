/* ==========================================================================
   SIREC - Portal del Paciente (paciente.js)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const currentUser = JSON.parse(localStorage.getItem('paciente_auth'));

  if (!currentUser) {
    alert('Acceso denegado. Debes iniciar sesión.');
    window.location.href = 'index.html';
    return;
  }

  document.getElementById('patient-name-display').textContent = currentUser.nombre;

  // ── Sidebar móvil ──────────────────────────────────────────────────────────
  const sidebar    = document.getElementById('patient-sidebar');
  const overlay    = document.getElementById('sidebar-overlay');
  const btnHamburger  = document.getElementById('btn-hamburger');
  const btnCloseSidebar = document.getElementById('btn-close-sidebar');

  const openSidebar = () => {
    sidebar?.classList.add('is-open');
    overlay?.classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  const closeSidebar = () => {
    sidebar?.classList.remove('is-open');
    overlay?.classList.remove('active');
    document.body.style.overflow = '';
  };

  btnHamburger?.addEventListener('click', openSidebar);
  btnCloseSidebar?.addEventListener('click', closeSidebar);
  overlay?.addEventListener('click', closeSidebar);

  // ── Navegación ────────────────────────────────────────────────────────────
  const navLinks = document.querySelectorAll('.nav-link');
  const mobileNavItems = document.querySelectorAll('.mobile-nav-item');
  const views = document.querySelectorAll('.app-view');

  // Función centralizada para activar una vista
  const activateView = (targetId) => {
    views.forEach(v => v.style.display = 'none');
    const target = document.getElementById(targetId);
    if (target) target.style.display = 'block';

    // Sincronizar sidebar nav-links
    navLinks.forEach(l => l.classList.remove('active'));
    const activeLink = document.querySelector(`.nav-link[data-target="${targetId}"]`);
    if (activeLink) activeLink.classList.add('active');

    // Sincronizar barra inferior
    mobileNavItems.forEach(b => b.classList.remove('active'));
    const activeMobileBtn = document.querySelector(`.mobile-nav-item[data-target="${targetId}"]`);
    if (activeMobileBtn) activeMobileBtn.classList.add('active');

    // Cargar datos según la vista
    if (targetId === 'view-mis-citas')    loadCitas();
    if (targetId === 'view-historial')    loadHistorial();
    if (targetId === 'view-expedientes')  loadExpedientes();
    if (targetId === 'view-perfil')       loadPerfil();
  };

  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      const targetId = link.getAttribute('data-target');
      activateView(targetId);
      closeSidebar(); // cierra sidebar al navegar en móvil
    });
  });

  mobileNavItems.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      activateView(targetId);
    });
  });

  document.getElementById('btn-logout-paciente').addEventListener('click', () => {
    localStorage.removeItem('paciente_auth');
    window.location.href = 'index.html';
  });


  // Cargar Mis Citas
  const loadCitas = async () => {
    const tbody = document.querySelector('#tabla-mis-citas tbody');
    tbody.innerHTML = '<tr><td colspan="6" class="has-text-centered">Cargando citas...</td></tr>';
    
    try {
      const res = await fetch(`http://localhost:3000/api/pacientes/${currentUser.dni}/citas`);
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.message);
      
      tbody.innerHTML = '';
      if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="has-text-centered">No tienes citas registradas.</td></tr>';
        return;
      }

      data.forEach(cita => {
        let estadoClass = 'is-light';
        let estadoTexto = cita.cit_estado;
        if (estadoTexto === 'finalizado') estadoClass = 'is-success';
        if (estadoTexto === 'cancelado') estadoClass = 'is-danger';
        if (estadoTexto === 'espera_triaje' || estadoTexto === 'espera_consulta') estadoClass = 'is-warning';

        let btnCancelar = '';
        if (estadoTexto !== 'finalizado' && estadoTexto !== 'cancelado') {
          btnCancelar = `<button class="button is-small is-danger is-outlined btn-cancelar-cita" data-id="${cita.cit_id}">Cancelar</button>`;
        }

        const dateFormatted = new Date(cita.cit_fecha).toLocaleDateString('es-HN');

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${dateFormatted}</td>
          <td>${cita.cit_hora.slice(0, 5)}</td>
          <td>${cita.especialidad}</td>
          <td>${cita.medico}</td>
          <td><span class="tag ${estadoClass}">${estadoTexto.replace('_', ' ')}</span></td>
          <td>${btnCancelar}</td>
        `;
        tbody.appendChild(tr);
      });

      // Bind Cancelar
      document.querySelectorAll('.btn-cancelar-cita').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          if (!confirm('¿Seguro que deseas cancelar esta cita?')) return;
          const id = e.target.getAttribute('data-id');
          try {
            await fetch(`http://localhost:3000/api/citas/${id}/cancelar`, { method: 'PUT' });
            loadCitas();
          } catch (err) {
            alert('Error al cancelar');
          }
        });
      });

    } catch (error) {
      console.error(error);
      tbody.innerHTML = '<tr><td colspan="6" class="has-text-centered has-text-danger">Error al cargar citas.</td></tr>';
    }
  };

  // Cargar Historial y Expedientes (Usan el mismo endpoint pero diferente renderizado)
  const loadDataMedica = async () => {
    try {
      const res = await fetch(`http://localhost:3000/api/pacientes/${currentUser.dni}/expedientes`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      return data;
    } catch (error) {
      console.error(error);
      return null;
    }
  };

  const loadHistorial = async () => {
    const container = document.getElementById('historial-container');
    container.innerHTML = '<div class="column is-12"><p>Cargando...</p></div>';
    
    const data = await loadDataMedica();
    if (!data) {
      container.innerHTML = '<div class="column is-12 has-text-danger"><p>Error al cargar historial.</p></div>';
      return;
    }

    if (data.length === 0) {
      container.innerHTML = '<div class="column is-12"><p class="has-text-grey">No tienes historial médico registrado aún.</p></div>';
      return;
    }

    container.innerHTML = '';
    data.forEach(exp => {
      const dateFormatted = new Date(exp.con_fecha).toLocaleDateString('es-HN');
      const div = document.createElement('div');
      div.className = 'column is-12';
      div.innerHTML = `
        <div class="box" style="border-left: 5px solid var(--primary-medical);">
          <h4 class="title is-5 mb-2">${dateFormatted} - ${exp.especialidad}</h4>
          <p class="subtitle is-6 has-text-grey mb-3">Atendido por: ${exp.medico}</p>
          <div class="content">
            <p><strong>Diagnóstico:</strong> ${exp.cie_desc || 'No especificado'}</p>
            <p><strong>Motivo:</strong> ${exp.con_motivo}</p>
            <p><strong>Plan/Tratamiento:</strong> ${exp.con_plantrat}</p>
          </div>
        </div>
      `;
      container.appendChild(div);
    });
  };

  const loadExpedientes = async () => {
    const container = document.getElementById('expedientes-container');
    container.innerHTML = '<div class="column is-12"><p>Cargando...</p></div>';
    
    const data = await loadDataMedica();
    if (!data) {
      container.innerHTML = '<div class="column is-12 has-text-danger"><p>Error al cargar expedientes.</p></div>';
      return;
    }

    if (data.length === 0) {
      container.innerHTML = '<div class="column is-12"><p class="has-text-grey">No hay expedientes disponibles.</p></div>';
      return;
    }

    container.innerHTML = '';
    data.forEach(exp => {
      const dateFormatted = new Date(exp.con_fecha).toLocaleDateString('es-HN');
      const div = document.createElement('div');
      div.className = 'column is-6';
      div.innerHTML = `
        <div class="card">
          <div class="card-content">
            <div class="media">
              <div class="media-left">
                <span class="material-symbols-outlined is-size-1 has-text-danger">picture_as_pdf</span>
              </div>
              <div class="media-content">
                <p class="title is-4">Expediente ${exp.cit_id}</p>
                <p class="subtitle is-6">${dateFormatted}</p>
              </div>
            </div>
            <div class="content">
              Especialidad: ${exp.especialidad}<br>
              Médico: ${exp.medico}
            </div>
          </div>
          <footer class="card-footer">
            <a href="#" class="card-footer-item btn-ver-pdf" data-exp='${JSON.stringify(exp).replace(/'/g, "&#39;")}'>Ver Detalle</a>
          </footer>
        </div>
      `;
      container.appendChild(div);
    });

    // Bind Ver Detalle PDF
    document.querySelectorAll('.btn-ver-pdf').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const expData = JSON.parse(e.target.getAttribute('data-exp'));
        openTicketModal(expData);
      });
    });
  };

  const openTicketModal = (exp) => {
    const modal = document.getElementById('modal-ticket');
    const content = document.getElementById('ticket-print-content');
    if (!modal || !content) return;

    const dateFormatted = new Date(exp.con_fecha).toLocaleDateString('es-HN', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
    const fechaCita = new Date(exp.cit_fecha).toLocaleDateString('es-HN');

    // Receta / medicamentos
    const receta = exp.receta || [];
    const medsRows = receta.length > 0 ? receta.map(m => `
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:8px 4px;"><strong>${m.nombre}</strong></td>
        <td style="padding:8px 4px;">${m.dosis || '—'}</td>
        <td style="padding:8px 4px;text-align:center;">${m.cantidad}</td>
        <td style="padding:8px 4px;text-align:right;">${m.duracion ? `${m.duracion} días` : '—'}</td>
      </tr>
    `).join('') : `<tr><td colspan="4" style="padding:12px 4px;color:#94a3b8;text-align:center;">Sin medicamentos prescritos</td></tr>`;

    // Exámenes ordenados
    const examenesText = exp.con_examenes ? exp.con_examenes.trim() : '';
    const examenesSection = examenesText ? `
      <div style="margin-top:20px;">
        <h4 style="border-bottom:1px solid #1e3a8a;padding-bottom:4px;margin-bottom:8px;color:#1e3a8a;">
          EXÁMENES DE LABORATORIO / GABINETE
        </h4>
        <ul style="padding-left:20px;margin:0;font-size:.9rem;">
          ${examenesText.split(/[\n,]+/).filter(Boolean).map(e => `<li>${e.trim()}</li>`).join('')}
        </ul>
      </div>
    ` : '';

    // Signos vitales (del triaje)
    const vitalesSection = (exp.tri_presart || exp.tri_temp) ? `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:16px;">
        <h4 style="margin:0 0 10px 0;color:#475569;font-size:.85rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;">
          Signos Vitales (Triaje)
        </h4>
        <div style="display:flex;flex-wrap:wrap;gap:12px;font-size:.85rem;">
          ${exp.tri_presart ? `<span><strong>P.A:</strong> ${exp.tri_presart} mmHg</span>` : ''}
          ${exp.tri_temp ? `<span><strong>Temp:</strong> ${exp.tri_temp} °C</span>` : ''}
          ${exp.tri_imc ? `<span><strong>IMC:</strong> ${exp.tri_imc}</span>` : ''}
          ${exp.tri_peso ? `<span><strong>Peso:</strong> ${exp.tri_peso} kg</span>` : ''}
          ${exp.tri_talla ? `<span><strong>Talla:</strong> ${exp.tri_talla} cm</span>` : ''}
          ${exp.tri_oxigeno ? `<span><strong>SpO₂:</strong> ${exp.tri_oxigeno}%</span>` : ''}
          ${exp.tri_dolor != null ? `<span><strong>Dolor:</strong> ${exp.tri_dolor}/10</span>` : ''}
        </div>
      </div>
    ` : '';

    content.innerHTML = `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:720px;margin:0 auto;color:#1e293b;">

        <!-- ENCABEZADO CLÍNICA -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:16px;border-bottom:3px solid #1e3a8a;">
          <div>
            <h2 style="margin:0;color:#1e3a8a;font-size:1.3rem;font-weight:800;">CLÍNICA MÉDICA SAN RAFAEL</h2>
            <p style="margin:3px 0 0;font-size:.8rem;color:#64748b;">San Pedro Sula, Honduras | Tel: 2550-1234</p>
            <p style="margin:2px 0 0;font-size:.78rem;color:#94a3b8;">www.clinicasanrafael.hn</p>
          </div>
          <div style="text-align:right;">
            <h3 style="margin:0;color:#475569;font-size:1rem;">RECETA MÉDICA</h3>
            <p style="margin:3px 0 0;font-size:.8rem;">Fecha de consulta: <strong>${dateFormatted}</strong></p>
            <p style="margin:2px 0 0;font-size:.78rem;color:#64748b;">No. Cita: <strong>${exp.cit_id}</strong></p>
          </div>
        </div>

        <!-- DATOS DEL PACIENTE -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:.9rem;margin-bottom:16px;padding:12px;background:#f0f9ff;border-radius:8px;border-left:4px solid #1e3a8a;">
          <div>
            <p style="margin:0 0 4px;"><strong>Paciente:</strong> ${currentUser.nombre || (currentUser.pac_pnom + ' ' + currentUser.pac_pape)}</p>
            <p style="margin:0 0 4px;"><strong>Identidad:</strong> ${currentUser.dni}</p>
          </div>
          <div>
            <p style="margin:0 0 4px;"><strong>Médico:</strong> ${exp.medico}</p>
            <p style="margin:0 0 4px;"><strong>Especialidad:</strong> ${exp.especialidad}</p>
          </div>
        </div>

        <!-- SIGNOS VITALES -->
        ${vitalesSection}

        <!-- MOTIVO Y DIAGNÓSTICO -->
        <div style="margin-bottom:16px;font-size:.9rem;">
          ${exp.con_motivo ? `<p style="margin:0 0 6px;"><strong>Motivo de Consulta:</strong> ${exp.con_motivo}</p>` : ''}
          ${exp.con_sintomatologia ? `<p style="margin:0 0 6px;"><strong>Sintomatología:</strong> ${exp.con_sintomatologia}</p>` : ''}
          ${exp.con_antec ? `<p style="margin:0 0 6px;"><strong>Antecedentes:</strong> ${exp.con_antec}</p>` : ''}
          ${exp.cie_desc ? `<p style="margin:0 0 6px;"><strong>Diagnóstico (CIE-10):</strong> <span style="color:#1e3a8a;font-weight:600;">${exp.cie_desc}${exp.cie_codigo ? ` [${exp.cie_codigo}]` : ''}</span></p>` : ''}
        </div>

        <!-- PRESCRIPCIÓN -->
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

        <!-- EXÁMENES -->
        ${examenesSection}

        <!-- PLAN / TRATAMIENTO -->
        ${exp.con_plantrat ? `
        <div style="margin-top:16px;font-size:.9rem;">
          <h4 style="border-bottom:1px solid #cbd5e1;padding-bottom:4px;margin-bottom:8px;color:#1e3a8a;">
            RECOMENDACIONES / PLAN DE TRATAMIENTO
          </h4>
          <p style="margin:0;white-space:pre-wrap;line-height:1.6;">${exp.con_plantrat}</p>
        </div>` : ''}

        <!-- FIRMA MÉDICO -->
        <div style="margin-top:60px;display:flex;justify-content:flex-end;padding-right:40px;">
          <div style="text-align:center;width:240px;">
            <div style="height:60px;"></div>
            <div style="border-top:1px solid #1e293b;padding-top:8px;font-size:.85rem;">
              <strong>${exp.medico}</strong><br>
              <span style="font-size:.78rem;color:#64748b;">Médico Autorizado | ${exp.especialidad}</span>
            </div>
          </div>
        </div>

        <!-- PIE DE PÁGINA -->
        <div style="margin-top:30px;padding-top:10px;border-top:1px dashed #cbd5e1;text-align:center;font-size:.75rem;color:#94a3b8;">
          Documento generado por el Portal del Paciente SIREC — ${new Date().toLocaleDateString('es-HN')}
        </div>
      </div>
    `;

    modal.classList.add('is-active');
  };


  // Lógica de impresión global y cerrar modal
  const btnCerrarTicket = document.getElementById('btn-cerrar-ticket');
  const btnImprimirReal = document.getElementById('btn-imprimir-real');
  const modalTicketClose = document.getElementById('modal-ticket-close');
  const modalTicketBg = document.getElementById('modal-ticket-bg');

  const closeTicketModal = () => {
    document.getElementById('modal-ticket')?.classList.remove('is-active');
  };

  if (btnCerrarTicket) btnCerrarTicket.addEventListener('click', closeTicketModal);
  if (modalTicketClose) modalTicketClose.addEventListener('click', closeTicketModal);
  if (modalTicketBg) modalTicketBg.addEventListener('click', closeTicketModal);

  if (btnImprimirReal) {
    btnImprimirReal.addEventListener('click', () => {
      let styleEl = document.getElementById('dynamic-print-style');
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'dynamic-print-style';
        document.head.appendChild(styleEl);
      }
      
      if (confirm("¿Desea imprimir en formato de Ticket Térmico de 80mm? (Pulse Cancelar para tamaño normal A4 o Carta)")) {
        document.body.classList.add('print-thermal');
        styleEl.innerHTML = `
          @media print {
            @page { size: 80mm auto; margin: 0; }
            .ticket-print { max-width: 80mm !important; padding: 5mm !important; }
            .ticket-print > div > div { display: block !important; }
            .ticket-print h1 { font-size: 1.1rem !important; text-align: center; }
            .ticket-print h2 { font-size: 1rem !important; text-align: center; margin-top: 10px !important; }
            .ticket-print p { font-size: 0.75rem !important; text-align: center; }
            .ticket-print table { font-size: 0.75rem !important; width: 100% !important; }
            .ticket-print .flex-1 { margin-bottom: 10px; }
          }
        `;
      } else {
        document.body.classList.remove('print-thermal');
        styleEl.innerHTML = `
          @media print {
            @page { size: letter; margin: 1cm; }
            .ticket-print { zoom: 1.25; max-width: 100% !important; width: 100% !important; }
          }
        `;
      }
      setTimeout(() => window.print(), 150);
    });
  };

  const loadPerfil = async () => {
    try {
      const res = await fetch(`http://localhost:3000/api/pacientes/${currentUser.dni}`);
      const data = await res.json();
      
      if (res.ok) {
        document.getElementById('perfil-nombres').value = data.pac_pnom + (data.pac_snom ? ' ' + data.pac_snom : '');
        document.getElementById('perfil-apellidos').value = data.pac_pape + (data.pac_sape ? ' ' + data.pac_sape : '');
        document.getElementById('perfil-correo').value = data.pac_email;
        document.getElementById('perfil-telefono').value = data.pac_tel || '';
      }
    } catch (error) {
      console.error(error);
    }
  };

  document.getElementById('form-perfil-paciente').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      nombres: document.getElementById('perfil-nombres').value,
      apellidos: document.getElementById('perfil-apellidos').value,
      correo: document.getElementById('perfil-correo').value,
      telefono: document.getElementById('perfil-telefono').value
    };

    try {
      const res = await fetch(`http://localhost:3000/api/pacientes/${currentUser.dni}/perfil`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Error al actualizar perfil');
      alert('Perfil actualizado correctamente.');
    } catch (error) {
      alert(error.message);
    }
  });

  // Init
  loadCitas();
});
