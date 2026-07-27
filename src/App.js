/* ==========================================================================
   SIREC - Orquestador Principal (App.js)
   Patrón MVC: Coordina Router, Vistas y Estado Global
   ========================================================================== */

import { AppRouter, ROUTES } from './routes/appRoutes.js';
import { authService }       from './services/authService.js';
import { firestoreService }  from './services/firestoreService.js';
import { pacienteController } from './controllers/pacienteController.js';
import { citaController }    from './controllers/citaController.js';
import { triajeController }  from './controllers/triajeController.js';
import { medicamentoController } from './controllers/medicamentoController.js';

import { LoginView }       from './views/Login/LoginView.js';
import { PacientesView }   from './views/Pacientes/PacientesView.js';
import { CitasView }       from './views/Citas/CitasView.js';
import { CajaView }        from './views/Caja/CajaView.js';
import { InventarioView }  from './views/Inventario/InventarioView.js';
import { TriajeView }      from './views/Triaje/TriajeView.js';
import { ConsultorioView } from './views/Consultorio/ConsultorioView.js';
import { ExpedientesView } from './views/Expedientes/ExpedientesView.js';
import { UsuariosView }    from './views/Usuarios/UsuariosView.js';
import { RolesView }       from './views/Roles/RolesView.js';
import { ObjetosView }     from './views/Objetos/ObjetosView.js';
import { PermisosView }    from './views/Permisos/PermisosView.js';
import { DashboardView }   from './views/Dashboard/DashboardView.js';

export class App {

  constructor() {
    this.router = new AppRouter();

    // Estado Global compartido entre vistas
    this.state = {
      user:         null,
      role:         'Administrador',
      patients:     [],
      appointments: [],
      triajes:      [],
      consultas:    [],
      medicamentos: []
    };

    // Instancias de vistas
    this.views = {};
  }

  /* ─────────────────────────────────────────────
     ARRANQUE
  ───────────────────────────────────────────── */
  async start() {
    // 1. Inicializar capa de datos (Firebase o LocalStorage)
    await firestoreService.init();

    // 2. Cargar datos semilla
    await this._loadAllData();

    // 3. Asegurar que existe el contenedor de login en el DOM
    if (!document.getElementById('view-login')) {
      const viewsContainer = document.getElementById('views-container') || document.querySelector('.app-body');
      const loginSec = document.createElement('section');
      loginSec.id = 'view-login';
      loginSec.className = 'app-view';
      loginSec.style.display = 'none';
      if (viewsContainer) viewsContainer.appendChild(loginSec);
      else document.body.appendChild(loginSec);
    }

    // 4. Instanciar vistas
    this._initViews();

    // 5. Configurar el ruteador
    this.router.onRouteChange = (route, context) => this._activateView(route, context);

    // 6. Vincular eventos globales
    this._bindGlobalEvents();

    // 7. Check session
    const activeSession = localStorage.getItem('sesion_activa');
    if (activeSession) {
      try {
        const user = JSON.parse(activeSession);
        this.state.user = user;
        this.router.setAllowedModules(user.allowedModules || []);
        this._applyRole(user.role);
        const first = this.router.getAccessibleRoutes()[0] || ROUTES.PACIENTES;
        this.router.navigate(first);
        return;
      } catch (e) {
        localStorage.removeItem('sesion_activa');
      }
    }

    // 8. Mostrar Login al arrancar si no hay sesión activa
    this._showSection('view-login');
    this.views.login.render();
  }

  /* ─────────────────────────────────────────────
     NOTA: Las vistas están embebidas en public/index.html
     No se necesita carga dinámica de HTML.
  ───────────────────────────────────────────── */

  /* ─────────────────────────────────────────────
     CARGA LOS DATOS - ERLING
  ───────────────────────────────────────────── */
  async _loadAllData() {
    this.state.patients     = await pacienteController.getPatients();
    this.state.appointments = await citaController.getAppointments();
    this.state.triajes      = await triajeController.getTriageRecords();
    this.state.consultas    = await firestoreService.getAll('consultas', 'consultas');
    this.state.medicamentos = await medicamentoController.getMedicamentos();
  }

  /* ─────────────────────────────────────────────
     INSTANCIACIÓN DE VISTAS
  ───────────────────────────────────────────── */
  _initViews() {
    const alert  = (msg, type) => this.showAlert(msg, type);
    const router = this.router;
    const state  = this.state;

    // Login View
    this.views.login = new LoginView(async (user, role) => {
      this.state.user = user;
      this.router.setAllowedModules(user.allowedModules || []);
      this._applyRole(role);
      const first = this.router.getAccessibleRoutes()[0] || ROUTES.PACIENTES;
      this.router.navigate(first);
    });

    this.views.pacientes = new PacientesView(router, alert, async (savedPatient) => {
      this.state.patients = await pacienteController.getPatients();
      this._refreshDatalists();
    });

    this.views.citas = new CitasView(router, alert, state);
    this.views.caja = new CajaView(router, alert, state);
    this.views.inventario = new InventarioView(router, alert, state);

    this.views.triaje = new TriajeView(router, alert, state);

    this.views.consultorio = new ConsultorioView(router, alert, state);
    this.views.expedientes = new ExpedientesView(router, alert, state);
    this.views.usuarios    = new UsuariosView(router, alert, state);
    this.views.roles       = new RolesView(router, alert, state);
    this.views.objetos     = new ObjetosView(router, alert, state);
    this.views.permisos    = new PermisosView(router, alert, state);
    this.views.dashboard   = new DashboardView(alert, state, this.state.role);
  }

  /* ─────────────────────────────────────────────
     ACTIVACIÓN DE VISTAS (callback del Router)
  ───────────────────────────────────────────── */
  async _activateView(route, context = {}) {
    try {
      // Desmontar vistas con listeners activos
      this.views.triaje?.unmount?.();
      this.views.consultorio?.unmount?.();

      // Cargar plantilla HTML dinámicamente si aún no existe
      await this._loadViewTemplate(route);

      // Recargar datos antes de mostrar
      await this._loadAllData();
      this._refreshDatalists();

      this._showSection(route);
      this._syncNavHighlight(route);

      switch (route) {
        case ROUTES.PACIENTES:
          if (this.views.pacientes?.bind) this.views.pacientes.bind();
          break;
        case ROUTES.CITAS:
          if (this.views.citas?.mount) await this.views.citas.mount(context);
          break;
        case ROUTES.CAJA:
          if (this.views.caja?.mount) await this.views.caja.mount(context);
          break;
        case ROUTES.INVENTARIO:
          if (this.views.inventario?.mount) await this.views.inventario.mount();
          break;
        case ROUTES.TRIAJE:
          if (this.views.triaje?.mount) await this.views.triaje.mount();
          break;
        case ROUTES.CONSULTORIO:
          if (this.views.consultorio?.mount) await this.views.consultorio.mount();
          break;
        case ROUTES.EXPEDIENTES:
          if (this.views.expedientes?.mount) await this.views.expedientes.mount(context);
          break;
        case ROUTES.USUARIOS:
          if (this.views.usuarios?.mount) await this.views.usuarios.mount();
          break;
        case ROUTES.ROLES:
          if (this.views.roles?.mount) await this.views.roles.mount();
          break;
        case ROUTES.OBJETOS:
          if (this.views.objetos?.mount) await this.views.objetos.mount();
          break;
        case ROUTES.PERMISOS:
          if (this.views.permisos?.mount) await this.views.permisos.mount();
          break;
        case ROUTES.DASHBOARD:
          if (this.views.dashboard?.setRole) this.views.dashboard.setRole(this.state.role);
          if (this.views.dashboard?.mount) this.views.dashboard.mount();
          break;
      }

      // Aplicar permisos granulares después de montar la vista
      const routeToModuleMap = {
        [ROUTES.PACIENTES]: 'Pacientes',
        [ROUTES.CITAS]: 'Citas',
        [ROUTES.CAJA]: 'Facturación',
        [ROUTES.INVENTARIO]: 'Inventario',
        [ROUTES.TRIAJE]: 'Triaje',
        [ROUTES.CONSULTORIO]: 'Consulta Médica',
        [ROUTES.USUARIOS]: 'Seguridad',
        [ROUTES.ROLES]: 'Seguridad',
        [ROUTES.OBJETOS]: 'Seguridad',
        [ROUTES.PERMISOS]: 'Seguridad',
        [ROUTES.DASHBOARD]: 'Dashboard'
      };
      
      const moduleName = routeToModuleMap[route];
      if (moduleName) {
        import('./services/securityService.js').then(module => {
          module.securityService.applyPermissions(moduleName, document.getElementById(route));
        });
      }

    } catch (error) {
      console.error(`Error al activar la vista ${route}:`, error);
      this.showAlert(`Error al cargar la pantalla: ${error.message}`, 'danger');
    }
  }

  /* ─────────────────────────────────────────────
     EVENTOS GLOBALES
  ───────────────────────────────────────────── */
  _bindGlobalEvents() {
    // Navegación por Sidebar
    document.querySelectorAll('.nav-link').forEach(link => {
      // Excluir los dropdown toggles
      if (link.classList.contains('nav-dropdown-toggle')) return;
      link.addEventListener('click', () => {
        const target = link.getAttribute('data-target');
        if (target) this.router.navigate(target);
      });
    });

    // Manejo de Dropdowns en Sidebar
    document.querySelectorAll('.nav-dropdown-toggle').forEach(toggle => {
      toggle.addEventListener('click', (e) => {
        const container = toggle.closest('.nav-dropdown-container');
        const items = container.querySelector('.nav-dropdown-items');
        const arrow = toggle.querySelector('.dropdown-arrow');
        
        if (items.style.display === 'none' || !items.style.display) {
          items.style.display = 'block';
          if (arrow) arrow.style.transform = 'rotate(180deg)';
        } else {
          items.style.display = 'none';
          if (arrow) arrow.style.transform = 'rotate(0deg)';
        }
      });
    });

    // Cerrar Sesión
    const btnLogout = document.getElementById('btn-logout');
    btnLogout?.addEventListener('click', () => {
      localStorage.removeItem('sesion_activa');
      this.state.user = null;
      this.state.role = null;
      this.router.setRole(null);
      window.location.reload();
    });

    // Modo Claro / Oscuro
    document.getElementById('theme-btn')?.addEventListener('click', () => {
      const html = document.documentElement;
      const dark  = html.getAttribute('data-theme') === 'dark';
      html.setAttribute('data-theme', dark ? 'light' : 'dark');
      const icon = document.getElementById('theme-icon');
      if (icon) {
        icon.innerHTML = dark
          ? `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`
          : `<path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.32 11.32l.707.707M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"/>`;
      }
    });

    // Voz de lectura: al activarla, lee el elemento tocado por el cursor.
    const voiceBtn = document.getElementById('voice-btn');
    if (voiceBtn) {
      let voiceActive = false;
      let lastSpoken = '';
      let lastSpokenAt = 0;

      const getReadableText = (element) => {
        // En lugar de leer contenedores enteros (.stat-card, .glass-card), 
        // buscamos si es un elemento interactivo específico
        const interactiveTarget = element.closest('button, a, input, select, textarea, [aria-label], [title]');
        const target = interactiveTarget || element;

        const label = target.getAttribute('aria-label')
          || target.getAttribute('title')
          || target.getAttribute('placeholder')
          || target.value;

        if (label) {
          return label.replace(/\s+/g, ' ').trim();
        }

        // Intentar leer solo el texto directo del elemento donde está el cursor, 
        // evitando leer todo el texto de los elementos hijos (todo el módulo)
        let directText = '';
        for (let node of element.childNodes) {
          if (node.nodeType === Node.TEXT_NODE) {
            directText += node.nodeValue + ' ';
          }
        }
        
        directText = directText.replace(/\s+/g, ' ').trim();
        if (directText) {
          return directText;
        }

        return (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
      };

      let hoverTimeout = null;

      const speak = (text) => {
        if (!voiceActive || !text || !('speechSynthesis' in window)) return;

        // Workaround para Chrome/Edge: si el motor de voz se "traba" o queda pausado
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }

        const now = Date.now();
        if (text === lastSpoken && now - lastSpokenAt < 1200) return;
        lastSpoken = text;
        lastSpokenAt = now;

        // Cancelar síntesis previa antes de iniciar la nueva
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'es-ES';
        utterance.rate = 0.95;

        // Asignar manejadores ayuda a evitar pérdidas de memoria en el API de SpeechSynthesis
        utterance.onend = () => {};
        utterance.onerror = (e) => {
           console.warn('SpeechSynthesis error:', e);
        };

        window.speechSynthesis.speak(utterance);
      };

      const readTouchedElement = (event) => {
        if (!voiceActive) return;
        if (voiceBtn.contains(event.target)) return;

        // Debounce: evitar llamadas excesivas al motor cuando el cursor se mueve muy rápido
        if (hoverTimeout) clearTimeout(hoverTimeout);
        hoverTimeout = setTimeout(() => {
          const textToRead = getReadableText(event.target);
          if (textToRead) speak(textToRead);
        }, 250); // Esperar 250ms antes de leer
      };

      voiceBtn.addEventListener('click', () => {
        voiceActive = !voiceActive;
        voiceBtn.classList.toggle('is-active', voiceActive);
        voiceBtn.setAttribute('aria-pressed', String(voiceActive));
        voiceBtn.setAttribute('title', voiceActive ? 'Desactivar voz de lectura' : 'Activar voz de lectura');
        if (voiceActive) speak('Voz de lectura activada');
        else window.speechSynthesis?.cancel();
      });

      document.addEventListener('mouseover', readTouchedElement);
      document.addEventListener('focusin', readTouchedElement);
      document.addEventListener('click', readTouchedElement);
    }

    // Búsqueda Global rápida por DNI
    document.getElementById('global-dni-search')?.addEventListener('change', (e) => {
      const q = e.target.value.trim();
      const patient = (this.state.patients || []).find(
        p => p.dni === q || p.dni.replace(/-/g,'') === q.replace(/-/g,'')
      );
      if (patient) {
        this.showAlert(`Paciente: ${patient.nombres} ${patient.apellidos}. Abriendo Citas...`, 'success');
        this.router.navigate(ROUTES.CITAS, { patient: patient });
      } else {
        this.showAlert('DNI no encontrado. Abriendo Registro de Paciente...', 'warning');
        this.router.navigate(ROUTES.PACIENTES);
      }
      e.target.value = '';
    });

    // Cerrar modales al hacer clic fuera del contenido
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.style.display = 'none';
      });
    });
  }

  /* ─────────────────────────────────────────────
     HELPERS
  ───────────────────────────────────────────── */
  async _loadViewTemplate(route) {
    const section = document.getElementById(route);
    // Si la sección ya tiene contenido interno, no la volvemos a cargar
    if (!section || section.innerHTML.trim() !== '') return;

    const routeMap = {
      'view-pacientes':   'Pacientes/PacientesView.html',
      'view-citas':       'Citas/CitasView.html',
      'view-caja':        'Caja/CajaView.html',
      'view-inventario':  'Inventario/InventarioView.html',
      'view-triaje':      'Triaje/TriajeView.html',
      'view-medico':      'Consultorio/ConsultorioView.html',
      'view-expedientes': 'Expedientes/ExpedientesView.html',
      'view-usuarios':    'Usuarios/UsuariosView.html',
      'view-roles':       'Roles/RolesView.html',
      'view-objetos':     'Objetos/ObjetosView.html',
      'view-permisos':    'Permisos/PermisosView.html',
      'view-dashboard':   'Dashboard/DashboardView.html'
    };

    const filePath = routeMap[route];
    if (!filePath) return;

    try {
      const response = await fetch(`../src/views/${filePath}?v=${Date.now()}`);
      if (response.ok) {
        section.innerHTML = await response.text();
      } else {
        console.error(`Error cargando template para ${route}`);
      }
    } catch (e) {
      console.error(`Fetch fallido para ${route}:`, e);
    }
  }

  _applyRole(role) {
    this.state.role = role;
    this.router.setRole(role);

    const user = this.state.user || {};
    const name = user.name || user.displayName || "Usuario";
    const initials = name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');

    const nameEl   = document.getElementById('profile-name');
    const roleEl   = document.getElementById('profile-role');
    const avatarEl = document.getElementById('avatar-letters');
    if (nameEl)   nameEl.textContent   = name;
    if (roleEl)   roleEl.textContent   = role;
    if (avatarEl) avatarEl.textContent = initials || '?';

    // Mostrar / ocultar enlaces según acceso dinámico
    const allowed = this.router.getAccessibleRoutes();
    document.querySelectorAll('.nav-link').forEach(link => {
      const t = link.getAttribute('data-target');
      if (t) {
        if (allowed.includes(t)) {
          link.style.display       = '';
          link.style.pointerEvents = 'auto';
          link.style.opacity       = '1';
        } else {
          link.style.display = 'none';
        }
      }
    });

    // Controlar visibilidad del contenedor de Seguridad (Dropdown)
    const securitySubRoutes = [ROUTES.USUARIOS, ROUTES.ROLES, ROUTES.OBJETOS, ROUTES.PERMISOS];
    const canSeeSecurity = securitySubRoutes.some(r => allowed.includes(r));
    const securityDropdown = document.querySelector('.nav-dropdown-container[data-module="seguridad"]');
    if (securityDropdown) {
      securityDropdown.style.display = canSeeSecurity ? 'block' : 'none';
    }
  }

  _showSection(activeId) {
    document.querySelectorAll('.app-view').forEach(v => {
      v.style.display = v.id === activeId ? 'block' : 'none';
    });

    const sidebar = document.querySelector('.app-sidebar');
    const header = document.querySelector('.app-header');
    const appBody = document.querySelector('.app-body');
    const headerSearch = document.querySelector('.header-search');
    
    if (activeId === 'view-login') {
      if(sidebar) sidebar.style.display = 'none';
      if(header) header.style.display = 'none';
      if(appBody) {
        appBody.style.marginLeft = '0';
        appBody.style.justifyContent = 'center';
        appBody.style.alignItems = 'center';
        appBody.style.minHeight = '100vh';
      }
    } else {
      if(sidebar) sidebar.style.display = 'flex';
      if(header) header.style.display = 'flex';
      if(appBody) {
        appBody.style.marginLeft = '280px';
        appBody.style.justifyContent = 'flex-start';
        appBody.style.alignItems = 'stretch';
        appBody.style.minHeight = 'auto';
      }

      // Mostrar el buscador de DNI solo en Pacientes y Citas
      const searchViews = ['view-pacientes', 'view-citas'];
      if (headerSearch) {
        headerSearch.style.display = searchViews.includes(activeId) ? 'flex' : 'none';
      }
    }
  }

  _syncNavHighlight(route) {
    document.querySelectorAll('.nav-link').forEach(link => {
      if (link.getAttribute('data-target')) {
        link.classList.toggle('active', link.getAttribute('data-target') === route);
      }
    });
    
    // Si la ruta activa es parte de un dropdown, mantener el toggle visualmente activo y abrirlo
    const securitySubRoutes = ['view-usuarios', 'view-roles', 'view-objetos', 'view-permisos'];
    const securityToggle = document.getElementById('seguridad-dropdown-toggle');
    const securityItems = document.getElementById('seguridad-dropdown-items');
    const securityArrow = securityToggle?.querySelector('.dropdown-arrow');
    
    if (securitySubRoutes.includes(route)) {
      if (securityToggle) securityToggle.classList.add('active');
      if (securityItems) {
        securityItems.style.display = 'block';
        if (securityArrow) securityArrow.style.transform = 'rotate(180deg)';
      }
    } else {
      if (securityToggle) securityToggle.classList.remove('active');
      if (securityItems) {
        securityItems.style.display = 'none';
        if (securityArrow) securityArrow.style.transform = 'rotate(0deg)';
      }
    }
  }

  _refreshDatalists() {
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

  showAlert(message, type = 'success') {
    const div = document.createElement('div');
    div.className = `alert-box alert-${type}`;
    div.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor"
           fill="none" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 8v4"/><path d="M12 16h.01"/>
      </svg>
      <span>${message}</span>
    `;
    const container = document.getElementById('alert-container');
    if (container) {
      container.appendChild(div);
      setTimeout(() => {
        div.style.opacity   = '0';
        div.style.transform = 'translateY(-10px)';
        div.style.transition = 'all .3s ease';
        setTimeout(() => div.remove(), 300);
      }, 4000);
    }
  }
}
