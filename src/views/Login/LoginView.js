/* ==========================================================================
   SIREC - Vista: Login (LoginView.js) - ERLIN FINISH
   ========================================================================== */

import { authService } from '../../services/authService.js';

export class LoginView {
  constructor(onLoginSuccess) {
    this.onLoginSuccess = onLoginSuccess;
    this.container = document.getElementById('view-login');
  }

  render() {
    if (!this.container) {
      console.error('[LoginView] No se encontró #view-login en el DOM');
      return;
    }

    this.container.style.display = 'flex';
    this.container.style.alignItems = 'center';
    this.container.style.justifyContent = 'center';
    this.container.style.width = '100%';
    this.container.style.minHeight = '100vh';

    this.container.innerHTML = `
      <div style="
        width: 100%;
        max-width: 460px;
        padding: 16px;
        animation: fadeInUp 0.4s ease both;
      ">
        <!-- Logo & Brand -->
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="
            width: 96px; height: 96px;
            border-radius: 24px;
            overflow: hidden;
            margin: 0 auto 20px auto;
            box-shadow: 0 8px 32px rgba(37,99,235,0.3);
            border: 3px solid rgba(255,255,255,0.2);
          ">
            <img
              src="../src/assets/logo.png"
              alt="Logo Clínica San Rafael"
              style="width: 100%; height: 100%; object-fit: cover;"
              onerror="this.parentElement.innerHTML='<div style=\'background: linear-gradient(135deg,#2563eb,#7c3aed); width:100%; height:100%; display:flex; align-items:center; justify-content:center;\'><svg viewBox=\'0 0 24 24\' width=\'48\' height=\'48\' fill=\'none\' stroke=\'white\' stroke-width=\'2\'><path d=\'M19 10.5V20a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-9.5a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4Z\'/><path d=\'M12 9v6M9 12h6\'/></svg></div>'"
            >
          </div>
          <h1 style="
            font-size: 2rem;
            font-weight: 800;
            color: var(--text-primary);
            margin: 0 0 6px 0;
            letter-spacing: -0.5px;
          ">SIREC Portal</h1>
          <p style="
            font-size: 0.9rem;
            color: var(--text-muted);
            margin: 0;
            line-height: 1.6;
          ">Clínica Médica San Rafael &bull; San Pedro Sula, Honduras</p>
        </div>

        <!-- Login Card -->
        <div style="
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 20px;
          padding: 36px 32px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.1);
        ">
          <!-- Error Box -->
          <div id="login-error" style="
            display: none;
            background: var(--danger-light);
            border: 1px solid var(--danger);
            color: var(--danger);
            border-radius: 10px;
            padding: 12px 16px;
            font-size: 0.875rem;
            font-weight: 500;
            margin-bottom: 20px;
            text-align: center;
          "></div>

          <form id="form-login" autocomplete="on" novalidate>
            <!-- Email / DNI -->
            <div style="margin-bottom: 18px;">
              <label style="
                display: block;
                font-size: 0.85rem;
                font-weight: 600;
                color: var(--text-secondary);
                margin-bottom: 8px;
              " for="login-email">Correo Electrónico</label>
              <input
                type="text"
                id="login-email"
                class="form-input"
                placeholder="ej.grupogpt@gmail.com"
                autocomplete="username"
                style="width: 100%;"
              >
            </div>

            <!-- Password -->
            <div style="margin-bottom: 24px;">
              <label style="
                display: block;
                font-size: 0.85rem;
                font-weight: 600;
                color: var(--text-secondary);
                margin-bottom: 8px;
              " for="login-password">Contraseña</label>
              <div style="position: relative;">
                <input
                  type="password"
                  id="login-password"
                  class="form-input"
                  placeholder="••••••••"
                  autocomplete="current-password"
                  style="width: 100%; padding-right: 48px;"
                >
                <button
                  type="button"
                  id="btn-toggle-pass"
                  title="Mostrar/Ocultar contraseña"
                  style="
                    position: absolute;
                    right: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    padding: 4px;
                    color: var(--text-muted);
                    display: flex;
                    align-items: center;
                  "
                >
                  <svg id="eye-icon" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" fill="none" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                </button>
              </div>
              <div style="text-align: right; margin-top: 8px;">
                <a href="#" id="link-forgot-password" style="font-size: 0.8rem; color: var(--primary); text-decoration: none; font-weight: 600;">¿Olvidaste tu contraseña?</a>
              </div>
            </div>

            <!-- Submit Button -->
            <button
              type="submit"
              id="btn-login-submit"
              class="btn btn-primary"
              style="width: 100%; padding: 14px; font-size: 1rem; font-weight: 700; border-radius: 12px; letter-spacing: 0.3px;"
            >
              Iniciar Sesión
            </button>
          </form>

          <form id="form-forgot-password" autocomplete="off" novalidate style="display: none;">
            <h2 style="font-size: 1.2rem; margin-bottom: 16px; color: var(--text-primary); text-align: center;">Recuperar Contraseña</h2>
            <p style="font-size: 0.85rem; color: var(--text-muted); text-align: center; margin-bottom: 16px;">
              Te enviaremos una clave provisional a tu correo.
            </p>
            <div style="margin-bottom: 18px;">
              <label style="display: block; font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px;" for="forgot-email">Correo Electrónico o DNI</label>
              <input type="text" id="forgot-email" class="form-input" placeholder="Ingresa tu correo o DNI" style="width: 100%;">
            </div>
            <button type="submit" id="btn-forgot-submit" class="btn btn-primary" style="width: 100%; padding: 14px; font-size: 1rem; font-weight: 700; border-radius: 12px; letter-spacing: 0.3px; margin-bottom: 12px;">Enviar Clave Provisional</button>
            <button type="button" id="btn-back-login" style="width: 100%; padding: 14px; font-size: 1rem; font-weight: 700; border-radius: 12px; background: transparent; border: 1px solid var(--border-color); color: var(--text-primary); cursor: pointer;">Volver al Login</button>
          </form>

          <!-- Force Password Change Form -->
          <form id="form-force-password" autocomplete="off" novalidate style="display: none;">
            <h2 style="font-size: 1.2rem; margin-bottom: 16px; color: var(--danger); text-align: center;">Cambio de Contraseña Obligatorio</h2>
            <p style="font-size: 0.85rem; color: var(--text-muted); text-align: center; margin-bottom: 16px;">
              Estás utilizando una contraseña provisional. Por tu seguridad, debes establecer una nueva.
            </p>
            <div style="margin-bottom: 18px;">
              <label style="display: block; font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px;" for="force-password">Nueva Contraseña</label>
              <input type="password" id="force-password" class="form-input" placeholder="••••••••" style="width: 100%;">
            </div>
            <div style="margin-bottom: 24px;">
              <label style="display: block; font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px;" for="force-password-confirm">Confirmar Contraseña</label>
              <input type="password" id="force-password-confirm" class="form-input" placeholder="••••••••" style="width: 100%;">
            </div>
            <button type="submit" id="btn-force-submit" class="btn btn-primary" style="width: 100%; padding: 14px; font-size: 1rem; font-weight: 700; border-radius: 12px; letter-spacing: 0.3px; margin-bottom: 12px;">Actualizar Contraseña e Ingresar</button>
            <button type="button" id="btn-cancel-force" style="width: 100%; padding: 14px; font-size: 1rem; font-weight: 700; border-radius: 12px; background: transparent; border: 1px solid var(--border-color); color: var(--text-primary); cursor: pointer;">Cancelar</button>
          </form>

        <!-- Footer -->
        <p style="
          text-align: center;
          margin-top: 24px;
          font-size: 0.75rem;
          color: var(--text-muted);
        ">
          Sistema de Registro y Control de Citas &copy; 2026 — Clínica San Rafael - GRUPO GPT
        </p>
      </div>

      <style>
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      </style>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    // Toggle mostrar/ocultar contraseña
    document.getElementById('btn-toggle-pass')?.addEventListener('click', () => {
      const input = document.getElementById('login-password');
      const icon = document.getElementById('eye-icon');
      if (!input) return;
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      icon.innerHTML = showing
        ? `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`
        : `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>`;
    });

    // Submit del formulario
    document.getElementById('form-login')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email')?.value?.trim();
      const password = document.getElementById('login-password')?.value;
      if (!email || !password) {
        this._showError('Por favor ingrese su correo y contraseña.');
        return;
      }
      this._doLogin(email, password);
    });

    document.getElementById('link-forgot-password')?.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('form-login').style.display = 'none';
      document.getElementById('form-forgot-password').style.display = 'block';
      this._hideError();
    });

    document.getElementById('btn-back-login')?.addEventListener('click', () => {
      document.getElementById('form-forgot-password').style.display = 'none';
      document.getElementById('form-login').style.display = 'block';
      this._hideError();
    });

    document.getElementById('form-forgot-password')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('forgot-email')?.value?.trim();

      if (!email) {
        this._showError('El correo es obligatorio.');
        return;
      }

      const submitBtn = document.getElementById('btn-forgot-submit');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviando...';
      }
      this._hideError();

      try {
        await authService.recoverPassword(email);
        alert('Se ha enviado una contraseña provisional a su correo electrónico. Revise su bandeja de entrada o spam.');
        document.getElementById('btn-back-login').click();
      } catch (err) {
        this._showError(err.message || 'Error al solicitar recuperación.');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Enviar Clave Provisional';
        }
      }
    });

    // Force password change form
    document.getElementById('btn-cancel-force')?.addEventListener('click', () => {
      document.getElementById('form-force-password').style.display = 'none';
      document.getElementById('form-login').style.display = 'block';
      this.pendingUser = null;
      this._hideError();
    });

    document.getElementById('form-force-password')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const password = document.getElementById('force-password')?.value;
      const confirm = document.getElementById('force-password-confirm')?.value;

      if (!password || !confirm) {
        this._showError('Todos los campos son obligatorios.');
        return;
      }
      if (password !== confirm) {
        this._showError('Las contraseñas no coinciden.');
        return;
      }

      const submitBtn = document.getElementById('btn-force-submit');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Actualizando...';
      }
      this._hideError();

      try {
        await authService.resetPassword(this.pendingUser.email, password);
        alert('Contraseña actualizada correctamente. ¡Bienvenido!');
        
        // Finalize login
        if (typeof this.onLoginSuccess === 'function') {
          this.onLoginSuccess(this.pendingUser, this.pendingUser.role || 'Administrador');
        }
      } catch (err) {
        this._showError(err.message || 'Error al actualizar la contraseña.');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Actualizar Contraseña e Ingresar';
        }
      }
    });
  }

  async _doLogin(email, password) {
    // Verificar bloqueo por intentos
    const MAX_ATTEMPTS = 3;
    let attempts = parseInt(sessionStorage.getItem('admin_login_attempts') || '0');

    if (attempts >= MAX_ATTEMPTS) {
      this._showError(`⛔ Acceso bloqueado temporalmente por ${MAX_ATTEMPTS} intentos fallidos. Contacte al administrador o cierre y reabra el navegador.`);
      return;
    }

    const submitBtn = document.getElementById('btn-login-submit');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Verificando...';
    }
    this._hideError();

    try {
      const user = await authService.login(email, password);
      
      // Login exitoso → resetear intentos
      sessionStorage.removeItem('admin_login_attempts');

      if (user.mustChangePassword) {
        this.pendingUser = user;
        document.getElementById('form-login').style.display = 'none';
        document.getElementById('form-force-password').style.display = 'block';
      } else {
        if (typeof this.onLoginSuccess === 'function') {
          this.onLoginSuccess(user, user.role || 'Administrador');
        }
      }
    } catch (err) {
      attempts++;
      sessionStorage.setItem('admin_login_attempts', String(attempts));
      const remaining = MAX_ATTEMPTS - attempts;

      if (remaining <= 0) {
        this._showError(`⛔ Demasiados intentos fallidos (${MAX_ATTEMPTS}). Su acceso ha sido bloqueado temporalmente. Contacte al administrador.`);
        if (submitBtn) submitBtn.disabled = true;
        return;
      } else {
        this._showError(`${err.message || 'Credenciales inválidas.'} — Intentos restantes: ${remaining} de ${MAX_ATTEMPTS}`);
      }
    } finally {
      if (submitBtn && parseInt(sessionStorage.getItem('admin_login_attempts') || '0') < MAX_ATTEMPTS) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Iniciar Sesión';
      }
    }
  }

  _showError(msg) {
    const errDiv = document.getElementById('login-error');
    if (errDiv) {
      errDiv.textContent = msg;
      errDiv.style.display = 'block';
    }
  }

  _hideError() {
    const errDiv = document.getElementById('login-error');
    if (errDiv) errDiv.style.display = 'none';
  }
}
