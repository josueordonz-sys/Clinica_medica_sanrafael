/* ==========================================================================
   SIREC - Landing Page (landing.js)
   Lógica para la página principal y agendamiento público
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const API_ORIGIN = ['127.0.0.1:5502', '127.0.0.1:5503', 'localhost:5502', 'localhost:5503'].includes(window.location.host)
    ? 'http://127.0.0.1:3000'
    : '';

  const apiUrl = (path) => `${API_ORIGIN}${path}`;

  const parseApiResponse = async (res, fallbackMessage = 'Error en la solicitud') => {
    const contentType = res.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await res.json()
      : { message: fallbackMessage };

    if (!res.ok) {
      throw new Error(data.message || fallbackMessage);
    }

    return data;
  };

  const getValue = (id) => document.getElementById(id)?.value?.trim() || '';

  const splitNameParts = (value) => {
    const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
    return {
      first: parts.shift() || '',
      rest: parts.join(' ')
    };
  };

  const getRegistrationNames = () => {
    const oldNames = splitNameParts(getValue('reg-nombres'));
    const oldLastNames = splitNameParts(getValue('reg-apellidos'));

    return {
      primerNombre: getValue('reg-primer-nombre') || oldNames.first,
      segundoNombre: getValue('reg-segundo-nombre') || oldNames.rest,
      primerApellido: getValue('reg-primer-apellido') || oldLastNames.first,
      segundoApellido: getValue('reg-segundo-apellido') || oldLastNames.rest
    };
  };

  const normalizeDni = (value) => String(value || '').replace(/\D/g, '');

  // Manejo del Navbar Burger (Mobile)
  const navbarBurgers = Array.prototype.slice.call(document.querySelectorAll('.navbar-burger'), 0);
  if (navbarBurgers.length > 0) {
    navbarBurgers.forEach(el => {
      el.addEventListener('click', () => {
        const target = el.dataset.target;
        const $target = document.getElementById(target);
        if ($target) {
          el.classList.toggle('is-active');
          $target.classList.toggle('is-active');
        }
      });
    });
  }

  // Elementos DOM
  const gridEspecialidades = document.getElementById('specialties-grid');
  const selEspecialidad = document.getElementById('wizard-especialidad');
  const selMedico = document.getElementById('wizard-medico');
  const modalAuth = document.getElementById('modal-auth');
  const btnLoginModal = document.getElementById('btn-login-modal');
  const btnCloseModal = document.getElementById('modal-auth-close');
  const bgModal = document.getElementById('modal-auth-bg');
  
  const formLogin = document.getElementById('form-login-paciente');
  const formRegistro = document.getElementById('form-registro-paciente');
  const linkShowRegister = document.getElementById('link-show-register');
  const linkShowLogin = document.getElementById('link-show-login');
  
  const wizardAuthBanner = document.getElementById('auth-status-banner');
  const wizardGuestFields = document.getElementById('wizard-guest-fields');
  const linkLoginWizard = document.getElementById('link-login-wizard');
  const linkRegisterWizard = document.getElementById('link-register-wizard');
  const formAgendarPublic = document.getElementById('form-agendar-public');

  const modalAskPatient = document.getElementById('modal-ask-patient');
  const btnIsPatientYes = document.getElementById('btn-is-patient-yes');
  const btnIsPatientNo = document.getElementById('btn-is-patient-no');

  // Estado
  let currentUser = JSON.parse(localStorage.getItem('paciente_auth')) || null;

  const updateAuthState = () => {
    if (btnLoginModal) {
      if (currentUser) {
        btnLoginModal.textContent = 'Ir a mi Portal';
        btnLoginModal.classList.replace('is-light', 'is-primary');
        btnLoginModal.onclick = () => window.location.href = 'paciente.html';
      } else {
        btnLoginModal.textContent = 'Iniciar Sesión';
        btnLoginModal.classList.replace('is-primary', 'is-light');
        btnLoginModal.onclick = openModal;
      }
    }
    
    if (wizardAuthBanner) {
      if (currentUser) {
        wizardAuthBanner.innerHTML = `<p class="has-text-success has-text-weight-bold">Sesión iniciada como: ${currentUser.nombre}. Puedes agendar directamente.</p>`;
        if (wizardGuestFields) wizardGuestFields.style.display = 'none';
        
        document.getElementById('wizard-dni')?.removeAttribute('required');
        document.getElementById('wizard-nombre')?.removeAttribute('required');
      } else {
        wizardAuthBanner.innerHTML = `<p>¿Ya eres paciente? <a href="#" id="link-login-wizard">Inicia sesión</a> para agendar más rápido, o <a href="#" id="link-register-wizard">Regístrate</a> si eres nuevo.</p>`;
        if (wizardGuestFields) wizardGuestFields.style.display = 'block';
        
        document.getElementById('wizard-dni')?.setAttribute('required', 'true');
        document.getElementById('wizard-nombre')?.setAttribute('required', 'true');

        // Re-bind events
        document.getElementById('link-login-wizard')?.addEventListener('click', (e) => { e.preventDefault(); showLogin(); openModal(); });
        document.getElementById('link-register-wizard')?.addEventListener('click', (e) => { e.preventDefault(); showRegister(); openModal(); });
      }
    }
  };

  // Ask Patient Modal Logic
  if (modalAskPatient) {
    document.querySelectorAll('a[href="agendar.html"]').forEach(link => {
      link.addEventListener('click', (e) => {
        if (!currentUser) {
          e.preventDefault();
          modalAskPatient.classList.add('is-active');
        }
      });
    });

    if (btnIsPatientYes) {
      btnIsPatientYes.addEventListener('click', () => {
        modalAskPatient.classList.remove('is-active');
        showLogin();
        openModal();
      });
    }

    if (btnIsPatientNo) {
      btnIsPatientNo.addEventListener('click', () => {
        modalAskPatient.classList.remove('is-active');
        showRegister();
        openModal();
      });
    }
  }

  // Cargar Especialidades
  const loadSpecialties = async () => {
    if (!gridEspecialidades && !selEspecialidad) return;

    try {
      const res = await fetch(apiUrl('/api/especialidades/public'));
      if (!res.ok) throw new Error('Error al cargar especialidades');
      const data = await res.json();
      
      if (gridEspecialidades) gridEspecialidades.innerHTML = '';
      if (selEspecialidad) selEspecialidad.innerHTML = '<option value="" disabled selected>Selecciona especialidad</option>';
      
      const iconMap = {
        'Medicina General': '🩺',
        'Pediatría': '👶',
        'Ginecología': '👩‍⚕️',
        'Cardiología': '❤️',
        'Dermatología': '✨',
        'Odontología': '🦷'
      };

      data.forEach(esp => {
        // Renderizar en el Grid (especialidades.html)
        if (gridEspecialidades) {
          const col = document.createElement('div');
          col.className = 'column is-4';
          const icon = iconMap[esp.nombre] || '⚕️';

          // Build doctor profiles HTML
          let medicosHtml = '';
          if (esp.medicos && esp.medicos.length > 0) {
            medicosHtml = `
              <div style="border-top: 1px solid #eee; margin-top: 12px; padding-top: 12px;">
                <p style="font-size: 0.8rem; color: #888; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">Médicos</p>
                <div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: center;">
                  ${esp.medicos.map(m => `
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                      <div style="width: 54px; height: 54px; border-radius: 50%; overflow: hidden; border: 2px solid var(--primary-color, #3498db); background: #f5f5f5; display: flex; align-items: center; justify-content: center;">
                        ${m.foto
                          ? `<img src="${m.foto}" alt="${m.nombre}" style="width: 100%; height: 100%; object-fit: cover;">`
                          : `<svg viewBox="0 0 24 24" style="width: 60%; height: 60%; fill: #ccc;"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`
                        }
                      </div>
                      <span style="font-size: 0.72rem; color: #555; text-align: center; max-width: 70px; line-height: 1.2;">Dr. ${m.nombre.split(' ')[0]}<br>${m.nombre.split(' ').slice(-1)[0]}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            `;
          }

          col.innerHTML = `
            <div class="specialty-card" style="display: flex; flex-direction: column; min-height: 200px;">
              <div class="specialty-icon">${icon}</div>
              <h3 class="title is-5">${esp.nombre}</h3>
              <p class="has-text-grey">${esp.descripcion || 'Atención especializada de alta calidad.'}</p>
              ${medicosHtml}
            </div>
          `;
          gridEspecialidades.appendChild(col);
        }

        // Añadir al Select del wizard de citas
        if (selEspecialidad) {
          const opt = document.createElement('option');
          opt.value = esp.id;
          opt.textContent = esp.nombre;
          selEspecialidad.appendChild(opt);
        }
      });
    } catch (error) {
      console.error(error);
      if (gridEspecialidades) gridEspecialidades.innerHTML = '<div class="column is-12 has-text-centered"><p class="has-text-danger">Error al cargar especialidades.</p></div>';
    }
  };


  // Cargar Médicos por Especialidad
  if (selEspecialidad) {
    selEspecialidad.addEventListener('change', async (e) => {
      if (!selMedico) return;
      const espId = e.target.value;
      selMedico.innerHTML = '<option value="" disabled selected>Cargando médicos...</option>';
      selMedico.disabled = true;

      try {
        const res = await fetch(apiUrl(`/api/medicos/public?esp_id=${espId}`));
        if (!res.ok) throw new Error('Error al cargar médicos');
        const data = await res.json();
        
        selMedico.innerHTML = '<option value="" disabled selected>Selecciona médico</option>';
        if (data.length === 0) {
          selMedico.innerHTML = '<option value="" disabled selected>No hay médicos disponibles</option>';
          return;
        }
        
        data.forEach(med => {
          const opt = document.createElement('option');
          opt.value = med.id;
          opt.textContent = med.nombre;
          selMedico.appendChild(opt);
        });
        selMedico.disabled = false;
      } catch (error) {
        console.error(error);
        selMedico.innerHTML = '<option value="" disabled selected>Error al cargar médicos</option>';
      }
    });
  }

  // Modal Auth
  const openModal = () => { if (modalAuth) modalAuth.classList.add('is-active'); };
  const closeModal = () => { if (modalAuth) modalAuth.classList.remove('is-active'); };
  
  if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
  if (bgModal) bgModal.addEventListener('click', closeModal);

  const showLogin = () => {
    if (formRegistro) formRegistro.style.display = 'none';
    if (formLogin) formLogin.style.display = 'block';
    const formForgot = document.getElementById('form-forgot-password');
    if (formForgot) formForgot.style.display = 'none';
    const formForce = document.getElementById('form-force-password');
    if (formForce) formForce.style.display = 'none';
    const title = document.getElementById('modal-auth-title');
    if (title) title.textContent = 'Iniciar Sesión Paciente';
  };

  const showRegister = () => {
    if (formLogin) formLogin.style.display = 'none';
    if (formRegistro) formRegistro.style.display = 'block';
    const title = document.getElementById('modal-auth-title');
    if (title) title.textContent = 'Registro de Paciente';
  };

  if (linkShowRegister) linkShowRegister.addEventListener('click', (e) => { e.preventDefault(); showRegister(); });
  if (linkShowLogin) linkShowLogin.addEventListener('click', (e) => { e.preventDefault(); showLogin(); });

  // Forgot password logic
  const linkRecover = document.getElementById('link-recover-password');
  const formForgot = document.getElementById('form-forgot-password');
  const linkBackLogin = document.getElementById('link-back-login');
  
  if (linkRecover) {
    linkRecover.addEventListener('click', (e) => {
      e.preventDefault();
      if (formLogin) formLogin.style.display = 'none';
      if (formForgot) formForgot.style.display = 'block';
    });
  }

  if (linkBackLogin) {
    linkBackLogin.addEventListener('click', (e) => {
      e.preventDefault();
      if (formForgot) formForgot.style.display = 'none';
      if (formLogin) formLogin.style.display = 'block';
    });
  }

  if (formForgot) {
    formForgot.addEventListener('submit', async (e) => {
      e.preventDefault();
      const dniOrEmail = document.getElementById('forgot-email').value;
      const btnSubmit = document.getElementById('btn-forgot-submit');
      if (btnSubmit) { btnSubmit.disabled = true; btnSubmit.textContent = 'Enviando...'; }

      try {
        const res = await fetch(apiUrl('/api/pacientes/recuperar-password'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dniOrEmail })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Error al recuperar');
        alert('Se ha enviado una contraseña provisional a su correo electrónico. Revise su bandeja de entrada o spam.');
        if (linkBackLogin) linkBackLogin.click();
      } catch (error) {
        alert(error.message);
      } finally {
        if (btnSubmit) { btnSubmit.disabled = false; btnSubmit.textContent = 'Enviar Clave Provisional'; }
      }
    });
  }

  // Force change logic
  const formForce = document.getElementById('form-force-password');
  const linkCancelForce = document.getElementById('link-cancel-force');
  
  if (linkCancelForce) {
    linkCancelForce.addEventListener('click', (e) => {
      e.preventDefault();
      if (formForce) formForce.style.display = 'none';
      if (formLogin) formLogin.style.display = 'block';
      window.pendingPacienteLogin = null;
    });
  }

  if (formForce) {
    formForce.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newPassword = document.getElementById('force-password').value;
      const confirm = document.getElementById('force-password-confirm').value;

      if (newPassword !== confirm) {
        alert('Las contraseñas no coinciden.');
        return;
      }

      const btnSubmit = document.getElementById('btn-force-submit');
      if (btnSubmit) { btnSubmit.disabled = true; btnSubmit.textContent = 'Actualizando...'; }

      try {
        const res = await fetch(apiUrl('/api/pacientes/reset-password'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dniOrEmail: window.pendingPacienteLogin.dni, newPassword })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Error al actualizar');
        
        alert('Contraseña actualizada correctamente. ¡Bienvenido!');
        
        // Finalize login
        const loggedInUser = window.pendingPacienteLogin;
        delete loggedInUser.mustChangePassword;
        localStorage.setItem('paciente_auth', JSON.stringify(loggedInUser));
        currentUser = loggedInUser;
        updateAuthState();
        closeModal();
      } catch (error) {
        alert(error.message);
      } finally {
        if (btnSubmit) { btnSubmit.disabled = false; btnSubmit.textContent = 'Actualizar y Entrar'; }
      }
    });
  }

  // Auto-formato DNI: XXXX-XXXX-XXXXX
  const regDniInput = document.getElementById('reg-dni');
  if (regDniInput) {
    regDniInput.addEventListener('input', (e) => {
      let raw = e.target.value.replace(/[^0-9]/g, ''); // solo dígitos
      if (raw.length > 13) raw = raw.slice(0, 13);      // máximo 13 dígitos
      let formatted = '';
      if (raw.length <= 4) {
        formatted = raw;
      } else if (raw.length <= 8) {
        formatted = raw.slice(0, 4) + '-' + raw.slice(4);
      } else {
        formatted = raw.slice(0, 4) + '-' + raw.slice(4, 8) + '-' + raw.slice(8);
      }
      e.target.value = formatted;
    });
  }

  // Toggle mostrar/ocultar contraseña (paciente login)
  const btnTogglePassPaciente = document.getElementById('btn-toggle-pass-paciente');
  if (btnTogglePassPaciente) {
    btnTogglePassPaciente.addEventListener('click', () => {
      const input = document.getElementById('login-password');
      const icon = document.getElementById('eye-icon-paciente');
      if (!input || !icon) return;
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      icon.innerHTML = showing
        ? `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`
        : `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>`;
    });
  }

  // Login Submit — con límite de 3 intentos fallidos
  const MAX_LOGIN_ATTEMPTS = 3;
  let loginAttempts = parseInt(sessionStorage.getItem('login_attempts') || '0');

  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Verificar bloqueo
      if (loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        alert(`⛔ Su cuenta ha sido bloqueada temporalmente por ${MAX_LOGIN_ATTEMPTS} intentos fallidos.\nPor favor, contacte al administrador o intente más tarde.`);
        return;
      }

      const dni = document.getElementById('login-dni').value;
      const password = document.getElementById('login-password').value;

      try {
        const res = await fetch(apiUrl('/api/pacientes/login'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dni, password })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Error en login');
        
        // Login exitoso → resetear intentos
        loginAttempts = 0;
        sessionStorage.removeItem('login_attempts');

        if (data.is_admin) {
          localStorage.setItem('sesion_activa', JSON.stringify({
            id: data.id,
            name: data.name,
            email: data.email,
            role: data.role
          }));
          alert(`Bienvenido, ${data.name}`);
          window.location.href = 'admin.html';
        } else {
          if (data.mustChangePassword) {
            window.pendingPacienteLogin = data;
            if (formLogin) formLogin.style.display = 'none';
            if (formForce) formForce.style.display = 'block';
            return;
          }

          localStorage.setItem('paciente_auth', JSON.stringify(data));
          currentUser = data;
          updateAuthState();
          closeModal();
          alert(`Bienvenido, ${data.nombre}`);
        }
      } catch (error) {
        loginAttempts++;
        sessionStorage.setItem('login_attempts', String(loginAttempts));
        const remaining = MAX_LOGIN_ATTEMPTS - loginAttempts;

        if (remaining <= 0) {
          alert(`⛔ Demasiados intentos fallidos. Su acceso ha sido bloqueado temporalmente.\nContacte al administrador.`);
        } else {
          alert(`${error.message}\n\n⚠️ Intentos restantes: ${remaining} de ${MAX_LOGIN_ATTEMPTS}`);
        }
      }
    });
  }

  // Registro Submit
  if (formRegistro) {
    formRegistro.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Validar que nombres y apellidos solo contengan letras y espacios
      const soloLetrasRegex = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]+$/;
      const registrationNames = getRegistrationNames();
      const camposTexto = [
        { id: 'reg-primer-nombre', value: registrationNames.primerNombre, label: 'Primer Nombre', required: true },
        { id: 'reg-segundo-nombre', value: registrationNames.segundoNombre, label: 'Segundo Nombre', required: false },
        { id: 'reg-primer-apellido', value: registrationNames.primerApellido, label: 'Primer Apellido', required: true },
        { id: 'reg-segundo-apellido', value: registrationNames.segundoApellido, label: 'Segundo Apellido', required: false }
      ];

      for (const campo of camposTexto) {
        const valor = campo.value;
        if (campo.required && !valor) {
          alert(`El campo "${campo.label}" es obligatorio.`);
          (document.getElementById(campo.id) || document.getElementById(campo.id.includes('nombre') ? 'reg-nombres' : 'reg-apellidos'))?.focus();
          return;
        }
        if (valor && !soloLetrasRegex.test(valor)) {
          alert(`El campo "${campo.label}" solo permite letras y espacios. No se permiten números ni caracteres especiales.`);
          (document.getElementById(campo.id) || document.getElementById(campo.id.includes('nombre') ? 'reg-nombres' : 'reg-apellidos'))?.focus();
          return;
        }
      }

      const dni = normalizeDni(getValue('reg-dni'));
      if (dni.length !== 13) {
        alert('El DNI debe contener exactamente 13 números.');
        document.getElementById('reg-dni')?.focus();
        return;
      }

      const payload = {
        dni,
        correo: getValue('reg-correo'),
        primerNombre: registrationNames.primerNombre,
        segundoNombre: registrationNames.segundoNombre,
        primerApellido: registrationNames.primerApellido,
        segundoApellido: registrationNames.segundoApellido,
        fechaNacimiento: getValue('reg-fecnac'),
        genero: getValue('reg-genero'),
        telefono: getValue('reg-telefono'),
        password: getValue('reg-password'),
        direccion: getValue('reg-direccion'),
        tipoSangre: getValue('reg-tiposangre') || 'No sabe',
        contactoEmergencia: getValue('reg-contacto_emergencia'),
        alergias: getValue('reg-alergias')
      };

      try {
        const res = await fetch(apiUrl('/api/pacientes/registro'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        await parseApiResponse(res, 'Error en el registro');
        
        alert('Registro exitoso. Ahora puedes iniciar sesión.');
        showLogin();
      } catch (error) {
        alert(error.message);
      }
    });
  }

  // Agendar Cita Submit
  if (formAgendarPublic) {
    formAgendarPublic.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      let payload = {
        esp_id: selEspecialidad.value,
        emp_id: selMedico.value,
        fecha: document.getElementById('wizard-fecha').value,
        hora: document.getElementById('wizard-hora').value,
        motivo: document.getElementById('wizard-motivo').value
      };

      if (currentUser) {
        payload.pac_dni = currentUser.dni;
      } else {
        payload.pac_dni = document.getElementById('wizard-dni').value;
        payload.nombre_temporal = document.getElementById('wizard-nombre').value;
        // Idealmente, se crea una cita pre-registro, pero para este caso exigimos login o registro
        alert('Por favor inicia sesión o regístrate para confirmar la cita.');
        showRegister();
        openModal();
        return;
      }

      try {
        const res = await fetch(apiUrl('/api/citas/public'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentUser.token || ''}` },
          body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Error al agendar cita');
        
        alert('¡Cita agendada con éxito!');
        window.location.href = 'paciente.html'; // Redirigir al portal
      } catch (error) {
        alert(error.message);
      }
    });
    
    // Limitar fecha mínima a hoy
    const today = new Date().toISOString().split('T')[0];
    const wf = document.getElementById('wizard-fecha');
    if (wf) wf.setAttribute('min', today);
  }

  // Cargar Especialistas (Médicos) en el index
  const loadEspecialistas = async () => {
    const gridEspecialistasIndex = document.getElementById('especialistas-grid');
    if (!gridEspecialistasIndex) return; // Solo ejecutar si estamos en index.html o donde exista el grid

    try {
      const res = await fetch(apiUrl('/api/empleados'));
      const data = await res.json();
      if (!res.ok) throw new Error('Error al cargar especialistas');

      const medicos = data.filter(emp => emp.role === 'Medico' && emp.activo);
      
      gridEspecialistasIndex.innerHTML = '';
      if (medicos.length === 0) {
        gridEspecialistasIndex.innerHTML = '<p class="has-text-muted" style="grid-column: 1 / -1;">No hay especialistas disponibles en este momento.</p>';
        return;
      }

      medicos.forEach(medico => {
        const fotoSrc = medico.foto || 'img/default-doctor.png'; // Fallback a un avatar genérico si no hay foto
        const card = document.createElement('div');
        card.className = 'card';
        card.style.cssText = 'border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); transition: transform 0.3s ease;';
        card.innerHTML = `
          <div class="card-image">
            <figure class="image is-4by4" style="height: 250px; overflow: hidden; background: #f5f5f5; display: flex; align-items: center; justify-content: center;">
              ${medico.foto 
                ? `<img src="${fotoSrc}" alt="Foto de ${medico.name}" style="width: 100%; height: 100%; object-fit: cover;">` 
                : `<svg viewBox="0 0 24 24" style="width: 50%; height: 50%; color: #ccc; fill: currentColor;"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`
              }
            </figure>
          </div>
          <div class="card-content has-text-centered">
            <p class="title is-5 mb-2" style="color: var(--primary-color);">Dr. ${medico.name}</p>
            <p class="subtitle is-6 has-text-grey">${medico.especialidad || 'Consulta Médica'}</p>
          </div>
        `;
        // Add hover effect
        card.addEventListener('mouseenter', () => card.style.transform = 'translateY(-5px)');
        card.addEventListener('mouseleave', () => card.style.transform = 'translateY(0)');
        gridEspecialistasIndex.appendChild(card);
      });
    } catch (error) {
      console.error(error);
      gridEspecialistasIndex.innerHTML = '<p class="has-text-danger" style="grid-column: 1 / -1;">Error al cargar el directorio médico.</p>';
    }
  };

  // Init
  updateAuthState();
  loadSpecialties();
  loadEspecialistas();
});
