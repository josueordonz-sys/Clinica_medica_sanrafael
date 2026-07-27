/* ==========================================================================
   SIREC - Controlador e Interacciones de la Interfaz (Patrón MVC)
   Cargado como Módulo ES6 - Clínica Médica San Rafael
   ========================================================================== */

import { dbService } from './firebase-service.js';

document.addEventListener('DOMContentLoaded', () => {
  
  // Variables de Estado en Memoria
  let patients = [];
  let appointments = [];
  let triage = [];
  let consultations = [];
  let unsubscribeTriageListener = null;

  // Cargar colecciones iniciales de base de datos
  const refreshData = async () => {
    patients = await dbService.getPatients();
    appointments = await dbService.getAppointments();
    triage = await dbService.getTriage();
    consultations = await dbService.getConsultations();
    updateGlobalUINotifications();
  };

  // Inicializar Servicio de Base de Datos (Firebase Cloud o LocalStorage)
  dbService.init(async () => {
    await refreshData();
    populateTransactionsTable();
    updateDatalists();
    
    // Si estamos operando en el Dashboard por defecto, cargarlo
    if (document.getElementById('view-dashboard').style.display === 'block') {
      renderDashboardCharts();
    }
  });

  const getDoctorsForSpecialty = (specialty) => {
    const employees = JSON.parse(localStorage.getItem('sirec_empleados')) || [];
    const legacyUsers = JSON.parse(localStorage.getItem('usuarios_sistema')) || [];
    return [...employees, ...legacyUsers]
      .filter(u => u.role === 'Medico' && u.especialidad === specialty && u.name)
      .map(u => u.name);
  };

  // Stock Alerts Mock Database
  const stockAlerts = [
    { item: "Jeringas 5ml", stock: 12, min: 50, level: "danger" },
    { item: "Gasas estériles", stock: 85, min: 100, level: "warning" },
    { item: "Reactivos de Glucosa", stock: 8, min: 30, level: "danger" },
    { item: "Cinta de Micropore", stock: 120, min: 40, level: "success" }
  ];

  // Helper date functions
  function getTodayDateString() {
    return new Date().toISOString().split('T')[0];
  }
  function getOffsetDateString(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }

  // ==========================================================================
  // 2. ENRUTADOR VIRTUAL Y SEGURIDAD DE ACCESO POR ROL
  // ==========================================================================
  
  const views = document.querySelectorAll('.app-view');
  const navLinks = document.querySelectorAll('.nav-link');
  const roleSelect = document.getElementById('current-role');
  const profileName = document.getElementById('profile-name');
  const profileRole = document.getElementById('profile-role');
  const avatarLetters = document.getElementById('avatar-letters');

  const showView = async (targetId) => {
    // Cerrar suscripción previa de Triaje si cambiamos de vista para optimizar consumo
    if (unsubscribeTriageListener && targetId !== 'view-triaje' && targetId !== 'view-medico') {
      unsubscribeTriageListener();
      unsubscribeTriageListener = null;
    }

    views.forEach(v => v.style.display = 'none');
    const activeView = document.getElementById(targetId);
    if (activeView) activeView.style.display = 'block';
    
    navLinks.forEach(link => {
      if (link.getAttribute('data-target') === targetId) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Actualizar Colecciones
    await refreshData();

    // Desencadenadores de vistas específicas
    if (targetId === 'view-dashboard') {
      renderDashboardCharts();
    } else if (targetId === 'view-triaje') {
      // Activar listener en tiempo real para Triaje
      if (!unsubscribeTriageListener) {
        unsubscribeTriageListener = await dbService.listenToAppointments((updatedAppointments) => {
          appointments = updatedAppointments;
          populateTriageList();
          updateGlobalUINotifications();
        }, "espera_triaje");
      }
    } else if (targetId === 'view-medico') {
      // Activar listener en tiempo real para médico especialista
      if (!unsubscribeTriageListener) {
        unsubscribeTriageListener = await dbService.listenToAppointments((updatedAppointments) => {
          appointments = updatedAppointments;
          populateDoctorList();
          updateGlobalUINotifications();
        }, "espera_consulta");
      }
    }
  };

  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      showView(link.getAttribute('data-target'));
    });
  });

  // Simulación de Login y cambio de Roles
  const handleRoleChange = () => {
    const selectedRole = roleSelect.value;
    profileRole.textContent = selectedRole;

    if (selectedRole === 'Administrador') {
      profileName.textContent = "Admin SIREC";
      avatarLetters.textContent = "AD";
      navLinks.forEach(l => { l.style.pointerEvents = 'auto'; l.style.opacity = '1'; });
    } else if (selectedRole === 'Recepcionista') {
      profileName.textContent = "Karla Paz (Recepción)";
      avatarLetters.textContent = "KP";
      navLinks.forEach(l => {
        const target = l.getAttribute('data-target');
        if (target === 'view-pacientes' || target === 'view-citas' || target === 'view-dashboard') {
          l.style.pointerEvents = 'auto'; l.style.opacity = '1';
        } else {
          l.style.pointerEvents = 'none'; l.style.opacity = '0.4';
        }
      });
      if (document.getElementById('view-triaje').style.display === 'block' || document.getElementById('view-medico').style.display === 'block') {
        showView('view-pacientes');
      }
    } else if (selectedRole === 'Enfermeria') {
      profileName.textContent = "Lic. Sonia Mejía";
      avatarLetters.textContent = "SM";
      navLinks.forEach(l => {
        const target = l.getAttribute('data-target');
        if (target === 'view-triaje' || target === 'view-dashboard') {
          l.style.pointerEvents = 'auto'; l.style.opacity = '1';
        } else {
          l.style.pointerEvents = 'none'; l.style.opacity = '0.4';
        }
      });
      if (['view-pacientes', 'view-citas', 'view-medico'].some(id => document.getElementById(id).style.display === 'block')) {
        showView('view-triaje');
      }
    } else if (selectedRole === 'Medico') {
      profileName.textContent = "Dra. Ana Torres (Especialista)";
      avatarLetters.textContent = "AT";
      navLinks.forEach(l => {
        const target = l.getAttribute('data-target');
        if (target === 'view-medico' || target === 'view-dashboard') {
          l.style.pointerEvents = 'auto'; l.style.opacity = '1';
        } else {
          l.style.pointerEvents = 'none'; l.style.opacity = '0.4';
        }
      });
      if (['view-pacientes', 'view-citas', 'view-triaje'].some(id => document.getElementById(id).style.display === 'block')) {
        showView('view-medico');
      }
    }
    
    if (document.getElementById('view-dashboard').style.display === 'block') {
      renderDashboardCharts();
    }
  };

  roleSelect.addEventListener('change', handleRoleChange);
  handleRoleChange(); // Init

  // Gestor de alertas globales
  const showAlert = (message, type = 'success') => {
    const alertBox = document.createElement('div');
    alertBox.className = `alert-box alert-${type}`;
    alertBox.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" fill="none" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
      <span>${message}</span>
    `;
    const container = document.getElementById('alert-container');
    container.appendChild(alertBox);

    setTimeout(() => {
      alertBox.style.opacity = '0';
      alertBox.style.transform = 'translateY(-10px)';
      alertBox.style.transition = 'all 0.3s ease';
      setTimeout(() => alertBox.remove(), 300);
    }, 4000);
  };

  // Notificador del Badge en Triaje
  const updateGlobalUINotifications = () => {
    const pendingTriage = appointments.filter(a => a.estado === 'espera_triaje' && a.fecha === getTodayDateString()).length;
    const triageBadge = document.getElementById('triage-badge');
    if (pendingTriage > 0) {
      triageBadge.style.display = 'block';
      triageBadge.textContent = pendingTriage;
    } else {
      triageBadge.style.display = 'none';
    }
  };

  // ==========================================================================
  // 3. PANTALLA 1: REGISTRO ÚNICO DE PACIENTES
  // ==========================================================================
  
  const formRegistroPaciente = document.getElementById('form-registro-paciente');
  const inputDni = document.getElementById('paciente-dni');
  const inputNombres = document.getElementById('paciente-nombres');
  const inputApellidos = document.getElementById('paciente-apellidos');
  const inputFechaNac = document.getElementById('paciente-fecha-nacimiento');
  const autocompleteDniList = document.getElementById('dni-list');

  // Input mask para identidad hondureña: ####-####-#####
  inputDni.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 13) value = value.slice(0, 13);
    
    if (value.length > 8) {
      value = `${value.slice(0, 4)}-${value.slice(4, 8)}-${value.slice(8)}`;
    } else if (value.length > 4) {
      value = `${value.slice(0, 4)}-${value.slice(4)}`;
    }
    e.target.value = value;
  });

  const validateTextOnly = (inputEl) => {
    inputEl.addEventListener('input', (e) => {
      const value = e.target.value;
      if (/\d/.test(value)) {
        inputEl.setCustomValidity("No se permiten números.");
      } else {
        inputEl.setCustomValidity("");
      }
    });
  };
  validateTextOnly(inputNombres);
  validateTextOnly(inputApellidos);

  inputFechaNac.addEventListener('input', (e) => {
    const bday = new Date(e.target.value);
    const today = new Date();
    if (bday >= today) {
      inputFechaNac.setCustomValidity("La fecha debe ser en el pasado.");
    } else {
      inputFechaNac.setCustomValidity("");
    }
  });

  formRegistroPaciente.addEventListener('submit', async (e) => {
    e.preventDefault();

    const cleanDni = inputDni.value;
    
    // Validación de DNI único
    const exists = patients.some(p => p.dni === cleanDni);
    if (exists) {
      showAlert(`El paciente con identidad ${cleanDni} ya está registrado en el sistema.`, 'danger');
      inputDni.setCustomValidity("DNI ya registrado.");
      inputDni.reportValidity();
      return;
    }

    const nuevoPaciente = {
      dni: cleanDni,
      nombres: inputNombres.value,
      apellidos: inputApellidos.value,
      fechaNacimiento: inputFechaNac.value,
      genero: document.getElementById('paciente-genero').value,
      telefono: document.getElementById('paciente-telefono').value,
      correo: document.getElementById('paciente-correo').value || "No especifica",
      direccion: document.getElementById('paciente-direccion').value || "No especifica",
      tipoSangre: document.getElementById('paciente-tipo-sangre').value || "No sabe",
      contactoEmergencia: document.getElementById('paciente-contacto-emergencia').value || "No especifica",
      alergias: document.getElementById('paciente-alergias').value || "Ninguna"
    };

    try {
      await dbService.savePatient(nuevoPaciente);
      showAlert(`Paciente ${nuevoPaciente.nombres} ${nuevoPaciente.apellidos} registrado exitosamente.`);
      
      await refreshData();
      updateDatalists();
      
      // Auto-relleno en citas
      document.getElementById('cita-buscar-dni').value = cleanDni;
      findPatientForCita(cleanDni);
      formRegistroPaciente.reset();
      showView('view-citas');
    } catch (err) {
      showAlert("Ocurrió un error guardando el paciente.", "danger");
    }
  });

  const updateDatalists = () => {
    autocompleteDniList.innerHTML = "";
    patients.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.dni;
      opt.textContent = `${p.nombres} ${p.apellidos}`;
      autocompleteDniList.appendChild(opt);
    });
  };

  // ==========================================================================
  // 4. PANTALLA 2: GESTIÓN DE CITAS Y PAGOS (Caja)
  // ==========================================================================
  
  const citaBuscarDni = document.getElementById('cita-buscar-dni');
  const btnBuscarCitaPac = document.getElementById('btn-buscar-cita-paciente');
  const citaNombrePac = document.getElementById('cita-nombre-paciente');
  const citaTxnId = document.getElementById('cita-txn-id');
  const citaFacturaNum = document.getElementById('cita-factura-num');
  const citaEspecialidad = document.getElementById('cita-especialidad');
  const citaMedico = document.getElementById('cita-medico');
  const citaFecha = document.getElementById('cita-fecha');
  const formCrearCita = document.getElementById('form-crear-cita');
  const btnProcesarPago = document.getElementById('btn-procesar-pago');
  const btnImprimirTicket = document.getElementById('btn-imprimir-ticket');

  let selectedPatient = null;
  let activeCitaCreated = null;

  citaBuscarDni.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 13) value = value.slice(0, 13);
    if (value.length > 8) {
      value = `${value.slice(0, 4)}-${value.slice(4, 8)}-${value.slice(8)}`;
    } else if (value.length > 4) {
      value = `${value.slice(0, 4)}-${value.slice(4)}`;
    }
    e.target.value = value;
  });

  const findPatientForCita = (dni) => {
    const p = patients.find(pat => pat.dni === dni);
    if (p) {
      selectedPatient = p;
      citaNombrePac.value = `${p.nombres} ${p.apellidos}`;
      
      const nextNum = appointments.length + 1;
      citaTxnId.value = `TXN${String(nextNum).padStart(3, '0')}`;
      citaFacturaNum.value = `FAC-${String(nextNum).padStart(4, '0')}`;
      
      citaFecha.min = getTodayDateString();
      btnProcesarPago.disabled = false;
      showAlert(`Paciente validado: ${p.nombres}`);
    } else {
      selectedPatient = null;
      citaNombrePac.value = "";
      btnProcesarPago.disabled = true;
      showAlert("El DNI no se encuentra registrado en SIREC. Regístrelo primero.", "warning");
    }
  };

  btnBuscarCitaPac.addEventListener('click', () => {
    findPatientForCita(citaBuscarDni.value);
  });

  citaEspecialidad.addEventListener('change', () => {
    const spec = citaEspecialidad.value;
    citaMedico.innerHTML = '<option value="" disabled selected>Seleccione médico</option>';

    const doctors = getDoctorsForSpecialty(spec);
    if (doctors.length === 0) {
      citaMedico.disabled = true;
      citaMedico.innerHTML = '<option value="" disabled selected>No hay médicos disponibles</option>';
      return;
    }

    citaMedico.disabled = false;
    doctors.forEach(doc => {
      const opt = document.createElement('option');
      opt.value = doc;
      opt.textContent = doc;
      citaMedico.appendChild(opt);
    });
  });

  formCrearCita.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedPatient) return;

    const chosenDoc = citaMedico.value;
    const chosenDate = citaFecha.value;
    const chosenHour = document.getElementById('cita-hora').value;

    // Validación de disponibilidad de cupos
    const matches = appointments.filter(a => a.medico === chosenDoc && a.fecha === chosenDate && a.hora === chosenHour).length;
    if (matches >= 3) {
      showAlert(`El médico ${chosenDoc} no tiene cupos disponibles en el horario ${chosenHour}.`, "danger");
      return;
    }

    const nuevaCita = {
      id: citaTxnId.value,
      facturaNum: citaFacturaNum.value,
      pacienteDni: selectedPatient.dni,
      pacienteNombre: `${selectedPatient.nombres} ${selectedPatient.apellidos}`,
      especialidad: citaEspecialidad.value,
      medico: chosenDoc,
      fecha: chosenDate,
      hora: chosenHour,
      monto: parseFloat(document.getElementById('cita-monto').value),
      metodoPago: document.getElementById('cita-metodo-pago').value,
      observaciones: document.getElementById('cita-observaciones').value || "Ninguna",
      estado: "espera_triaje",
      montoPendiente: parseFloat(document.getElementById('cita-monto').value),
      cargosServicios: [
        {
          concepto: `Consulta - ${citaEspecialidad.value}`,
          monto: parseFloat(document.getElementById('cita-monto').value)
        }
      ],
      timestamp: Date.now()
    };

    try {
      await dbService.saveAppointment(nuevaCita);
      activeCitaCreated = nuevaCita;
      
      showAlert("¡Cita registrada! Paciente enviado a espera de Triaje.", "success");
      btnImprimirTicket.disabled = false;
      
      await refreshData();
      populateTransactionsTable();
      formCrearCita.reset();
      citaBuscarDni.value = "";
      citaNombrePac.value = "";
      btnProcesarPago.disabled = true;
    } catch (err) {
      showAlert("Error al procesar la cita en la base de datos.", "danger");
    }
  });

  const populateTransactionsTable = () => {
    const tbody = document.querySelector('#tabla-transacciones tbody');
    tbody.innerHTML = "";

    const sorted = [...appointments].sort((a, b) => b.timestamp - a.timestamp).slice(0, 6);
    sorted.forEach(a => {
      const tr = document.createElement('tr');
      
      let stateBadge = `<span class="badge badge-pending">Pendiente</span>`;
      if (a.estado === 'espera_triaje') stateBadge = `<span class="badge badge-paid">Espera triaje</span>`;
      else if (a.estado === 'espera_consulta') stateBadge = `<span class="badge badge-triage">Espera consulta</span>`;
      else if (a.estado === 'pendiente_pago') stateBadge = `<span class="badge badge-pending">Pendiente pago</span>`;
      else if (a.estado === 'finalizado') stateBadge = `<span class="badge badge-completed">Finalizado</span>`;

      const actionButton = a.estado === 'pendiente_pago'
        ? `<button class="btn btn-success btn-small btn-pay-row" data-id="${a.id}">Procesar pago</button>`
        : `<button class="btn btn-secondary btn-small btn-print-row" data-id="${a.id}">Factura</button>`;

      tr.innerHTML = `
        <td><strong>${a.id}</strong></td>
        <td>${a.pacienteDni}</td>
        <td>${a.pacienteNombre}</td>
        <td>${a.medico}</td>
        <td>${a.especialidad}</td>
        <td>L. ${parseFloat(a.montoPendiente ?? a.monto).toFixed(2)}</td>
        <td>${a.facturaNum}</td>
        <td>${stateBadge}</td>
        <td>${actionButton}</td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.btn-print-row').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-id');
        const cita = appointments.find(a => a.id === id);
        if (cita) {
          showInvoiceModal(cita);
        }
      });
    });

    tbody.querySelectorAll('.btn-pay-row').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-id');
        const cita = appointments.find(a => a.id === id);
        if (!cita) return;

        try {
          await dbService.finalizePayment(cita.id, {
            monto: cita.montoPendiente ?? cita.monto,
            metodoPago: cita.metodoPago
          });
          await refreshData();
          populateTransactionsTable();
          showAlert("Pago procesado. Atención finalizada.", "success");
          showInvoiceModal({ ...cita, estado: "finalizado", montoPendiente: 0 });
        } catch (err) {
          showAlert("Error al procesar el pago.", "danger");
        }
      });
    });
  };

  const showInvoiceModal = (cita) => {
    const content = document.getElementById('ticket-print-content');
    content.innerHTML = `
      <div class="ticket-header">
        <h3>CLÍNICA MÉDICA SAN RAFAEL</h3>
        <p>San Pedro Sula, Honduras</p>
        <p>RTN: 0501-1990-123456</p>
        <p>Tel: 2550-1234</p>
      </div>
      <div class="ticket-divider"></div>
      <div class="ticket-row"><span><strong>Factura:</strong></span><span>${cita.facturaNum}</span></div>
      <div class="ticket-row"><span><strong>Transacción:</strong></span><span>${cita.id}</span></div>
      <div class="ticket-row"><span><strong>Fecha:</strong></span><span>${cita.fecha}</span></div>
      <div class="ticket-row"><span><strong>Hora:</strong></span><span>${cita.hora}</span></div>
      <div class="ticket-divider"></div>
      <div class="ticket-row"><span><strong>Paciente:</strong></span><span>${cita.pacienteNombre}</span></div>
      <div class="ticket-row"><span><strong>Identidad:</strong></span><span>${cita.pacienteDni}</span></div>
      <div class="ticket-row"><span><strong>Especialidad:</strong></span><span>${cita.especialidad}</span></div>
      <div class="ticket-row"><span><strong>Médico:</strong></span><span>${cita.medico}</span></div>
      <div class="ticket-divider"></div>
      <div class="ticket-row"><span><strong>Método de Pago:</strong></span><span>${cita.metodoPago}</span></div>
      <div class="ticket-row"><span><strong>Total a Pagar:</strong></span><span><strong>L. ${parseFloat(cita.montoPendiente ?? cita.monto).toFixed(2)}</strong></span></div>
      <div class="ticket-divider"></div>
      <p style="text-align: center; font-size: 0.75rem;">${cita.estado === "finalizado" ? "¡Gracias por su pago!" : "Pago pendiente de procesamiento en Caja."}</p>
    `;
    document.getElementById('modal-ticket').style.display = 'flex';
  };

  btnImprimirTicket.addEventListener('click', () => {
    if (activeCitaCreated) {
      showInvoiceModal(activeCitaCreated);
    }
  });

  // ==========================================================================
  // 5. PANTALLA 3: MONITOR DE TRIAJE Y SIGNOS VITALES
  // ==========================================================================
  
  const triageColaPacientes = document.getElementById('triage-cola-pacientes');
  const formTriajeSignos = document.getElementById('form-triaje-signos');
  const triageFormTitulo = document.getElementById('triage-form-titulo');
  const triageDni = document.getElementById('triage-dni');
  const triagePresion = document.getElementById('triage-presion');
  const triageTemperatura = document.getElementById('triage-temperatura');
  const triagePeso = document.getElementById('triage-peso');
  const triageEstatura = document.getElementById('triage-estatura');
  const triageImc = document.getElementById('triage-imc');
  const triageImcTag = document.getElementById('triage-imc-tag');
  const triageDolor = document.getElementById('triage-dolor');
  const triageDolorLbl = document.getElementById('triage-dolor-lbl');
  const triageDolorDesc = document.getElementById('triage-dolor-desc');
  const triageSinSel = document.getElementById('triage-sin-seleccion');

  let activeTriageCita = null;

  const populateTriageList = () => {
    triageColaPacientes.innerHTML = "";
    // Citas del día en espera de triaje
    const todayPaid = appointments.filter(a => a.estado === 'espera_triaje' && a.fecha === getTodayDateString());
    
    if (todayPaid.length === 0) {
      triageColaPacientes.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">No hay pacientes pendientes de Triaje.</div>`;
      formTriajeSignos.style.display = 'none';
      triageSinSel.style.display = 'block';
      return;
    }

    todayPaid.forEach(a => {
      const item = document.createElement('div');
      item.className = "patient-list-item";
      item.innerHTML = `
        <span class="item-name">${a.pacienteNombre}</span>
        <span class="item-meta">DNI: ${a.pacienteDni} | Hora: ${a.hora}</span>
        <span class="item-meta" style="color: var(--primary); font-weight: 600;">Esp: ${a.especialidad}</span>
      `;

      item.addEventListener('click', () => {
        triageColaPacientes.querySelectorAll('.patient-list-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
        loadTriageForm(a);
      });

      triageColaPacientes.appendChild(item);
    });
  };

  const loadTriageForm = (cita) => {
    activeTriageCita = cita;
    triageSinSel.style.display = 'none';
    formTriajeSignos.style.display = 'block';
    triageFormTitulo.textContent = `Registrar Signos: ${cita.pacienteNombre}`;
    triageDni.value = cita.pacienteDni;
    
    formTriajeSignos.reset();
    triageImc.value = "";
    triageImcTag.style.display = 'none';
    triageDolorLbl.textContent = "1";
    triageDolorDesc.textContent = "Sin Dolor";
  };

  const calculateIMC = () => {
    const peso = parseFloat(triagePeso.value);
    const estaturaCm = parseFloat(triageEstatura.value);

    if (peso > 0 && estaturaCm > 0) {
      const estaturaM = estaturaCm / 100;
      const imc = peso / (estaturaM * estaturaM);
      triageImc.value = imc.toFixed(1);

      triageImcTag.style.display = 'inline-block';
      triageImcTag.className = "imc-badge";
      if (imc < 18.5) {
        triageImcTag.textContent = "Bajo Peso"; triageImcTag.classList.add('imc-under');
      } else if (imc < 25) {
        triageImcTag.textContent = "Normal"; triageImcTag.classList.add('imc-normal');
      } else if (imc < 30) {
        triageImcTag.textContent = "Sobrepeso"; triageImcTag.classList.add('imc-over');
      } else {
        triageImcTag.textContent = "Obesidad"; triageImcTag.classList.add('imc-obese');
      }
    } else {
      triageImc.value = "";
      triageImcTag.style.display = 'none';
    }
  };

  triagePeso.addEventListener('input', calculateIMC);
  triageEstatura.addEventListener('input', calculateIMC);

  const painDescriptions = {
    1: "Sin Dolor", 2: "Leve", 3: "Leve", 4: "Moderado", 5: "Moderado",
    6: "Intenso", 7: "Intenso", 8: "Muy Severo", 9: "Insoluble", 10: "El Peor Dolor"
  };

  triageDolor.addEventListener('input', (e) => {
    const val = e.target.value;
    triageDolorLbl.textContent = val;
    triageDolorDesc.textContent = painDescriptions[val] || "Leve";
  });

  formTriajeSignos.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeTriageCita) return;

    // Validación estricta de temperatura
    const temp = parseFloat(triageTemperatura.value);
    if (temp < 34 || temp > 42) {
      triageTemperatura.setCustomValidity("Rango lógico: 34°C - 42°C.");
      triageTemperatura.reportValidity();
      return;
    }

    const nuevoTriaje = {
      citaId: activeTriageCita.id,
      pacienteDni: activeTriageCita.pacienteDni,
      presion: triagePresion.value,
      temperatura: temp,
      cardiaca: parseInt(document.getElementById('triage-cardiaca').value) || 0,
      respiratoria: parseInt(document.getElementById('triage-respiratoria').value) || 0,
      peso: parseFloat(triagePeso.value),
      estatura: parseFloat(triageEstatura.value),
      imc: triageImc.value,
      oxigeno: parseInt(document.getElementById('triage-oxigeno').value) || 0,
      dolor: parseInt(triageDolor.value),
      timestamp: Date.now()
    };

    try {
      await dbService.saveTriage(nuevoTriaje);
      showAlert("¡Ficha de Triaje guardada! Derivado a la cola del médico.", "success");
      
      activeTriageCita = null;
      await refreshData();
      populateTriageList();
    } catch (err) {
      showAlert("Error al guardar ficha de triaje.", "danger");
    }
  });

  // ==========================================================================
  // 6. PANTALLA 4: CONSULTORIO MÉDICO Y EXPEDIENTE DIGITAL
  // ==========================================================================
  
  const medicoColaPacientes = document.getElementById('medico-cola-pacientes');
  const medicoFormContainer = document.getElementById('medico-form-container');
  const medicoSinSel = document.getElementById('medico-sin-seleccion');
  const medicoVitalsResumen = document.getElementById('medico-vitals-resumen');
  const medicoHistorialClinico = document.getElementById('medico-historial-clinico');
  
  const formConsultaMedica = document.getElementById('form-consulta-medica');
  const medicoMotivo = document.getElementById('medico-motivo');
  const medicoDiagnostico = document.getElementById('medico-diagnostico');
  const medicoSintomatologia = document.getElementById('medico-sintomatologia');
  const medicoAntecedentes = document.getElementById('medico-antecedentes');
  const medicoTratamiento = document.getElementById('medico-tratamiento');
  
  const addRecetaFarmaco = document.getElementById('add-receta-farmaco');
  const addRecetaDosis = document.getElementById('add-receta-dosis');
  const addRecetaDuracion = document.getElementById('add-receta-duracion');
  const addRecetaExpira = document.getElementById('add-receta-expira');
  const btnAgregarMed = document.getElementById('btn-agregar-medicamento');
  const tablaMedReceta = document.querySelector('#tabla-medicamentos-receta tbody');
  const btnImprimirReceta = document.getElementById('btn-imprimir-receta');

  let activeDoctorCita = null;
  let activeRecipeList = [];

  const populateDoctorList = () => {
    medicoColaPacientes.innerHTML = "";
    
    // Citas del día en espera de consulta
    const doctorWaiting = appointments.filter(a => a.estado === 'espera_consulta' && a.fecha === getTodayDateString());

    if (doctorWaiting.length === 0) {
      medicoColaPacientes.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">No hay pacientes en espera médica hoy.</div>`;
      medicoFormContainer.style.display = 'none';
      medicoSinSel.style.display = 'block';
      return;
    }

    doctorWaiting.forEach(a => {
      const item = document.createElement('div');
      item.className = "patient-list-item";
      item.innerHTML = `
        <span class="item-name">${a.pacienteNombre}</span>
        <span class="item-meta">DNI: ${a.pacienteDni} | Hora: ${a.hora}</span>
        <span class="item-meta" style="color: var(--success); font-weight:600;">Dr: ${a.medico}</span>
      `;

      item.addEventListener('click', () => {
        medicoColaPacientes.querySelectorAll('.patient-list-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
        loadDoctorForm(a);
      });

      medicoColaPacientes.appendChild(item);
    });
  };

  const loadDoctorForm = (cita) => {
    activeDoctorCita = cita;
    medicoSinSel.style.display = 'none';
    medicoFormContainer.style.display = 'block';
    
    formConsultaMedica.reset();
    activeRecipeList = [];
    renderRecipeTable();
    btnImprimirReceta.disabled = true;

    // Obtener los Signos de Triaje
    const vit = triage.find(v => v.citaId === cita.id);
    if (vit) {
      const tempColor = vit.temperatura > 37.8 || vit.temperatura < 35.5 ? 'color: var(--danger); font-weight:700;' : 'color: var(--success);';
      const imcBadgeClass = vit.imc < 18.5 ? 'imc-under' : vit.imc < 25 ? 'imc-normal' : vit.imc < 30 ? 'imc-over' : 'imc-obese';

      medicoVitalsResumen.innerHTML = `
        <div class="vitals-card">
          <div class="vitals-header"><span>Presión Arterial</span><span>❤️</span></div>
          <div class="vitals-value">${vit.presion} mmHg</div>
        </div>
        <div class="vitals-card">
          <div class="vitals-header"><span>Temperatura</span><span>🌡️</span></div>
          <div class="vitals-value" style="${tempColor}">${vit.temperatura} °C</div>
        </div>
        <div class="vitals-card">
          <div class="vitals-header"><span>IMC</span><span>⚖️</span></div>
          <div class="vitals-value">${vit.imc} <span class="imc-badge ${imcBadgeClass}" style="font-size:0.75rem;">IMC</span></div>
        </div>
        <div class="vitals-card">
          <div class="vitals-header"><span>Dolor (1-10)</span><span>⚡</span></div>
          <div class="vitals-value">${vit.dolor} / 10</div>
        </div>
      `;
    } else {
      medicoVitalsResumen.innerHTML = `<div style="grid-column: 1/-1; color: var(--danger); font-weight:600;">No hay triaje disponible.</div>`;
    }

    // Historial clínico
    const patientHistory = consultations.filter(c => c.pacienteDni === cita.pacienteDni);
    if (patientHistory.length === 0) {
      medicoHistorialClinico.innerHTML = `<div style="color: var(--text-muted);">Sin consultas previas archivadas.</div>`;
    } else {
      medicoHistorialClinico.innerHTML = "";
      patientHistory.forEach((h) => {
        const hCard = document.createElement('div');
        hCard.className = "glass-card";
        hCard.style.padding = "10px";
        hCard.style.marginBottom = "6px";
        
        // Bloqueo de edición después de 24 horas (simulado)
        const isLocked = (Date.now() - h.timestamp) > 86400000;
        const lockIcon = isLocked ? "🔒 Archivado (Bloqueado)" : "✏️ Editable";

        hCard.innerHTML = `
          <div style="display:flex; justify-content:space-between; font-weight:600; margin-bottom:4px;">
            <span>${new Date(h.timestamp).toLocaleDateString()} - Motivo: ${h.motivo}</span>
            <span style="font-size:0.75rem; color:var(--text-muted);">${lockIcon}</span>
          </div>
          <div><strong>Diagnóstico:</strong> ${h.diagnostico}</div>
          <div><strong>Tratamiento:</strong> ${h.tratamiento}</div>
          <div style="font-size:0.75rem; color:var(--primary); margin-top:4px;">Receta: ${h.medicamentos.map(m => m.farmaco).join(', ')}</div>
        `;
        medicoHistorialClinico.appendChild(hCard);
      });
    }
  };

  addRecetaDuracion.addEventListener('input', () => {
    const days = parseInt(addRecetaDuracion.value);
    if (days > 0) {
      addRecetaExpira.value = getOffsetDateString(days);
    } else {
      addRecetaExpira.value = "";
    }
  });

  btnAgregarMed.addEventListener('click', () => {
    const farmaco = addRecetaFarmaco.value.trim();
    const dosis = addRecetaDosis.value.trim();
    const duracion = parseInt(addRecetaDuracion.value);

    if (!farmaco || !dosis || !duracion) {
      showAlert("Complete todos los campos del fármaco.", "warning");
      return;
    }

    activeRecipeList.push({
      farmaco,
      dosis,
      duracion,
      expira: addRecetaExpira.value
    });

    addRecetaFarmaco.value = "";
    addRecetaDosis.value = "";
    addRecetaDuracion.value = "";
    addRecetaExpira.value = "";
    
    renderRecipeTable();
  });

  const renderRecipeTable = () => {
    tablaMedReceta.innerHTML = "";
    if (activeRecipeList.length === 0) {
      tablaMedReceta.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">Sin medicamentos agregados.</td></tr>`;
      return;
    }

    activeRecipeList.forEach((med, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${med.farmaco}</td>
        <td>${med.dosis}</td>
        <td>${med.duracion} días</td>
        <td>${med.expira}</td>
        <td><button type="button" class="btn btn-danger btn-small btn-remove-med" data-idx="${idx}">X</button></td>
      `;
      tablaMedReceta.appendChild(tr);
    });

    tablaMedReceta.querySelectorAll('.btn-remove-med').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.getAttribute('data-idx'));
        activeRecipeList.splice(idx, 1);
        renderRecipeTable();
      });
    });
  };

  formConsultaMedica.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeDoctorCita) return;

    if (activeRecipeList.length === 0) {
      showAlert("Debe registrar la Receta Médica digital.", "warning");
      return;
    }

    const orderedExams = [];
    document.querySelectorAll('.exam-check:checked').forEach(chk => {
      orderedExams.push(chk.value);
    });

    const nuevaConsulta = {
      citaId: activeDoctorCita.id,
      pacienteDni: activeDoctorCita.pacienteDni,
      pacienteNombre: activeDoctorCita.pacienteNombre,
      medico: activeDoctorCita.medico,
      motivo: medicoMotivo.value,
      diagnostico: medicoDiagnostico.value,
      sintomatologia: medicoSintomatologia.value || "No especifica",
      antecedentes: medicoAntecedentes.value || "Ninguno",
      medicamentos: activeRecipeList,
      tratamiento: medicoTratamiento.value || "Seguir indicaciones",
      examenes: orderedExams,
      privadas: document.getElementById('medico-privadas').value || "",
      timestamp: Date.now(),
      cargosServicios: [
        { concepto: "Consulta médica", monto: parseFloat(activeDoctorCita.monto) || 0 },
        ...orderedExams.map(examen => ({ concepto: `Examen: ${examen}`, monto: 0 }))
      ]
    };

    try {
      await dbService.saveConsultation(nuevaConsulta);
      showAlert("¡Expediente de consulta guardado exitosamente!");
      
      btnImprimirReceta.disabled = false;
      showPrescriptionModal(nuevaConsulta);

      activeDoctorCita = null;
      await refreshData();
      populateDoctorList();
    } catch (err) {
      showAlert("Error al guardar la consulta.", "danger");
    }
  });

  const showPrescriptionModal = (cons) => {
    const content = document.getElementById('receta-print-content');
    
    let medsHtml = "";
    cons.medicamentos.forEach(m => {
      medsHtml += `
        <tr style="border-bottom: 1px solid #ddd;">
          <td style="padding: 10px 0;"><strong>${m.farmaco}</strong></td>
          <td style="padding: 10px 0;">${m.dosis}</td>
          <td style="padding: 10px 0; text-align:right;">Por ${m.duracion} días (Expira: ${m.expira})</td>
        </tr>
      `;
    });

    let examsHtml = "";
    if (cons.examenes && cons.examenes.length > 0) {
      examsHtml = `
        <div style="margin-top: 20px;">
          <h4 style="margin-bottom: 6px; border-bottom: 1px solid #000; padding-bottom:4px;">EXÁMENES DE LABORATORIO</h4>
          <ul style="padding-left: 20px;">
            ${cons.examenes.map(e => `<li>${e}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    content.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px;">
        <div>
          <h2 style="margin:0; color:#1e3a8a;">CLÍNICA MÉDICA SAN RAFAEL</h2>
          <p style="margin:2px 0; font-size:0.85rem; color:#666;">San Pedro Sula | Tel: 2550-1234</p>
        </div>
        <div style="text-align:right;">
          <h3 style="margin:0; color:#475569;">RECETA MÉDICA</h3>
          <p style="margin:2px 0; font-size:0.8rem;">Fecha: ${new Date(cons.timestamp).toLocaleDateString()}</p>
        </div>
      </div>
      <hr style="border: 0; border-top: 2px solid #1e3a8a; margin-bottom: 20px;">
      
      <div style="margin-bottom: 20px; font-size:0.9rem;">
        <p style="margin:4px 0;"><strong>Paciente:</strong> ${cons.pacienteNombre}</p>
        <p style="margin:4px 0;"><strong>Identidad:</strong> ${cons.pacienteDni}</p>
        <p style="margin:4px 0;"><strong>Médico:</strong> ${cons.medico}</p>
        <p style="margin:4px 0;"><strong>Diagnóstico CIE-10:</strong> ${cons.diagnostico}</p>
      </div>

      <h4 style="border-bottom: 1px solid #000; padding-bottom: 4px; margin-top:20px;">PRESCRIPCIÓN</h4>
      <table style="width:100%; border-collapse:collapse; font-size:0.9rem;">
        <thead>
          <tr style="border-bottom: 2px solid #ccc; text-align:left;">
            <th style="padding: 8px 0;">Medicamento</th>
            <th style="padding: 8px 0;">Dosis</th>
            <th style="padding: 8px 0; text-align:right;">Duración</th>
          </tr>
        </thead>
        <tbody>
          ${medsHtml}
        </tbody>
      </table>

      ${examsHtml}

      <div style="margin-top: 30px; font-size: 0.85rem;">
        <p><strong>Recomendaciones:</strong> ${cons.tratamiento}</p>
      </div>

      <div style="margin-top: 60px; display:flex; justify-content:space-around;">
        <div style="text-align:center; width: 200px; border-top: 1px solid #000; padding-top:6px; font-size:0.8rem;">
          Firma Médico Autorizado
        </div>
      </div>
    `;

    document.getElementById('modal-receta').style.display = 'flex';
  };

  btnImprimirReceta.addEventListener('click', () => {
    const cleanDni = triageDni.value;
    const cons = consultations.find(c => c.pacienteDni === cleanDni);
    if (cons) {
      showPrescriptionModal(cons);
    }
  });

  // ==========================================================================
  // 7. PANTALLA 5: PANEL DE CONTROL ADMINISTRATIVO (Dashboard)
  // ==========================================================================
  
  const statIngresosHoy = document.getElementById('stat-ingresos-hoy');
  const statAtendidosHoy = document.getElementById('stat-atendidos-hoy');
  const statEsperaTriaje = document.getElementById('stat-espera-triaje');
  const statEsperaMedica = document.getElementById('stat-espera-medica');
  
  const dashFechaInicio = document.getElementById('dash-fecha-inicio');
  const dashFechaFin = document.getElementById('dash-fecha-fin');
  const btnDashFiltrar = document.getElementById('btn-dash-filtrar');
  const btnDashExportExcel = document.getElementById('btn-dash-export-excel');
  const btnDashExportPdf = document.getElementById('btn-dash-export-pdf');
  const dashboardStock = document.getElementById('dashboard-stock-alerts');
  const tableTopMeds = document.querySelector('#tabla-top-medicamentos tbody');

  let chartSemanalInstance = null;
  let chartEspecialidadesInstance = null;

  dashFechaInicio.value = getOffsetDateString(-7);
  dashFechaFin.value = getTodayDateString();

  const renderDashboardCharts = () => {
    const start = new Date(dashFechaInicio.value).getTime();
    const end = new Date(dashFechaFin.value + "T23:59:59").getTime();

    if (end < start) {
      showAlert("La Fecha Final del filtro no puede ser menor a la Fecha Inicial.", "danger");
      return;
    }

    const filteredApp = appointments.filter(a => a.timestamp >= start && a.timestamp <= end);

    // Control de roles para visibilidad de montos monetarios
    const activeRole = roleSelect.value;
    if (activeRole !== 'Administrador') {
      statIngresosHoy.textContent = "L. [Restringido]";
      statIngresosHoy.style.fontSize = "1.2rem";
      statIngresosHoy.style.color = "var(--text-muted)";
    } else {
      statIngresosHoy.style.fontSize = "1.75rem";
      statIngresosHoy.style.color = "var(--text-primary)";
      const todayEarning = appointments
        .filter(a => a.fecha === getTodayDateString() && a.estado === 'finalizado')
        .reduce((sum, current) => sum + current.monto, 0);
      statIngresosHoy.textContent = `L. ${todayEarning.toFixed(2)}`;
    }

    const todayAttended = appointments.filter(a => a.fecha === getTodayDateString() && a.estado === 'finalizado').length;
    statAtendidosHoy.textContent = todayAttended;

    statEsperaTriaje.textContent = "12 min";
    statEsperaMedica.textContent = "18 min";

    // Dataset para gráficos
    const specCounts = {};
    const dailyEarnings = {};

    for (let i = 6; i >= 0; i--) {
      dailyEarnings[getOffsetDateString(-i)] = { earnings: 0, appointments: 0 };
    }

    filteredApp.forEach(a => {
      if (a.estado === 'finalizado') {
        specCounts[a.especialidad] = (specCounts[a.especialidad] || 0) + a.monto;
      }
      if (dailyEarnings[a.fecha]) {
        dailyEarnings[a.fecha].earnings += a.monto;
        dailyEarnings[a.fecha].appointments += 1;
      }
    });

    // Chart Weekly
    const weeklyCtx = document.getElementById('chart-semanal').getContext('2d');
    if (chartSemanalInstance) chartSemanalInstance.destroy();

    const chartDays = Object.keys(dailyEarnings);
    const chartEarnings = chartDays.map(d => dailyEarnings[d].earnings);
    const chartCount = chartDays.map(d => dailyEarnings[d].appointments);

    chartSemanalInstance = new Chart(weeklyCtx, {
      type: 'bar',
      data: {
        labels: chartDays.map(d => d.slice(5)),
        datasets: [
          {
            label: 'Ingresos (L.)',
            data: activeRole === 'Administrador' ? chartEarnings : chartEarnings.map(() => 0),
            backgroundColor: 'rgba(37, 99, 235, 0.7)',
            borderColor: '#2563eb',
            borderWidth: 1,
            yAxisID: 'y'
          },
          {
            label: 'Citas',
            data: chartCount,
            type: 'line',
            borderColor: '#10b981',
            backgroundColor: '#10b981',
            tension: 0.3,
            borderWidth: 3,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            type: 'linear',
            display: activeRole === 'Administrador',
            position: 'left',
            grid: { color: 'rgba(0,0,0,0.05)' }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            grid: { drawOnChartArea: false }
          }
        }
      }
    });

    // Specialty Chart
    const specCtx = document.getElementById('chart-especialidades').getContext('2d');
    if (chartEspecialidadesInstance) chartEspecialidadesInstance.destroy();

    const specLabels = Object.keys(specCounts);
    const specData = Object.values(specCounts);

    chartEspecialidadesInstance = new Chart(specCtx, {
      type: 'doughnut',
      data: {
        labels: specLabels.length > 0 ? specLabels : ['Sin Datos'],
        datasets: [{
          data: activeRole === 'Administrador' && specData.length > 0 ? specData : [1],
          backgroundColor: ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#06b6d4']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    });

    // Render Top 5 Drugs
    const drugCount = {};
    consultations.forEach(c => {
      c.medicamentos.forEach(m => {
        drugCount[m.farmaco] = (drugCount[m.farmaco] || 0) + 1;
      });
    });

    const sortedMeds = Object.keys(drugCount)
      .map(k => ({ med: k, count: drugCount[k] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    tableTopMeds.innerHTML = "";
    if (sortedMeds.length === 0) {
      tableTopMeds.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--text-muted);">Sin prescripciones médicas aún.</td></tr>`;
    } else {
      sortedMeds.forEach(m => {
        const tr = document.createElement('tr');
        const popValue = Math.min(100, m.count * 20);
        tr.innerHTML = `
          <td><strong>${m.med}</strong></td>
          <td>${m.count} recetas</td>
          <td>
            <div style="background-color: var(--border-color); border-radius: var(--radius-full); height: 8px; width: 100px;">
              <div style="background-color: var(--primary); border-radius: var(--radius-full); height: 100%; width: ${popValue}%;"></div>
            </div>
          </td>
        `;
        tableTopMeds.appendChild(tr);
      });
    }

    // Render Stock Alerts
    dashboardStock.innerHTML = "";
    stockAlerts.forEach(s => {
      const pillClass = s.level === 'danger' ? 'alert-danger' : s.level === 'warning' ? 'alert-warning' : 'alert-success';
      const warningText = s.level === 'success' ? 'Stock Óptimo' : '¡Reabastecer!';
      const itemRow = document.createElement('div');
      itemRow.className = `alert-box ${pillClass}`;
      itemRow.style.padding = "10px 14px";
      itemRow.style.fontSize = "0.8rem";
      itemRow.style.marginBottom = "0";

      itemRow.innerHTML = `
        <div style="display:flex; justify-content:space-between; width:100%;">
          <span><strong>${s.item}</strong> (Stock: ${s.stock} / Mínimo: ${s.min})</span>
          <span>${warningText}</span>
        </div>
      `;
      dashboardStock.appendChild(itemRow);
    });
  };

  btnDashFiltrar.addEventListener('click', renderDashboardCharts);

  btnDashExportExcel.addEventListener('click', () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "ID Transaccion,Factura,DNI Paciente,Nombre Paciente,Especialidad,Medico,Monto,Metodo Pago,Fecha,Estado\n";

    appointments.forEach(a => {
      csvContent += `"${a.id}","${a.facturaNum}","${a.pacienteDni}","${a.pacienteNombre}","${a.especialidad}","${a.medico}",${a.monto},"${a.metodoPago}","${a.fecha}","${a.estado}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Reporte_Caja_SIREC_${getTodayDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showAlert("Excel de transacciones exportado correctamente.");
  });

  btnDashExportPdf.addEventListener('click', () => {
    window.print();
  });

  // ==========================================================================
  // 8. TEMAS Y BÚSQUEDA RÁPIDA GLOBAL
  // ==========================================================================
  
  const themeBtn = document.getElementById('theme-btn');
  const htmlEl = document.documentElement;

  themeBtn.addEventListener('click', () => {
    const currentTheme = htmlEl.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    htmlEl.setAttribute('data-theme', newTheme);
    
    const themeIcon = document.getElementById('theme-icon');
    if (newTheme === 'dark') {
      themeIcon.innerHTML = `<path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.32 11.32l.707.707M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"/>`;
    } else {
      themeIcon.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`;
    }
  });

  const globalDniSearch = document.getElementById('global-dni-search');
  globalDniSearch.addEventListener('change', (e) => {
    const query = e.target.value;
    const p = patients.find(pat => pat.dni === query || pat.dni.replace(/-/g, "") === query.replace(/-/g, ""));
    
    if (p) {
      showAlert(`Paciente encontrado: ${p.nombres} ${p.apellidos}. Abriendo citas...`);
      showView('view-citas');
      citaBuscarDni.value = p.dni;
      findPatientForCita(p.dni);
    } else {
      showAlert("Paciente no registrado en SIREC. Abriendo formulario...", "warning");
      showView('view-pacientes');
      inputDni.value = query;
    }
    e.target.value = "";
  });
});
