/* ==========================================================================
   SIREC - Servicio de Autenticación (authService.js)
   Autenticación basada en tabla EMPLEADOS (sin USUARIOS).
   ========================================================================== */

const API_BASE_URL = 'http://127.0.0.1:3000/api';

const BOOTSTRAP_ADMIN = {
  id: 'admin-1',
  dni: '0801-1990-00001',
  email: 'admin@sirec.hn',
  password: 'admin123',
  role: 'Administrador',
  name: 'Admin SIREC',
  pnom: 'Admin',
  pape: 'SIREC'
};

export const authService = {

  async init() {
    // Sin Firebase: toda la autenticación va contra MySQL via /api/login
  },

  /* ─── Login ─────────────────────────────────────────────── */
  async login(email, password) {
    if (email === BOOTSTRAP_ADMIN.email && password === BOOTSTRAP_ADMIN.password) {
      const loggedUser = {
        id: BOOTSTRAP_ADMIN.id,
        email: BOOTSTRAP_ADMIN.email,
        name: BOOTSTRAP_ADMIN.name,
        role: BOOTSTRAP_ADMIN.role,
        dni: BOOTSTRAP_ADMIN.dni,
        allowedModules: ['Dashboard', 'Pacientes', 'Citas', 'Consulta Médica', 'Triaje', 'Facturación', 'Inventario', 'Seguridad']
      };
      localStorage.setItem('sesion_activa', JSON.stringify(loggedUser));
      return loggedUser;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Credenciales inválidas.');
      }

      const user = await response.json();
      localStorage.setItem('sesion_activa', JSON.stringify(user));
      return user;
    } catch (err) {
      // Fallback local si el servidor no responde
      const localUsers = this._getLocalEmployees();
      const cleanInput = String(email).replace(/-/g, '');
      const found = localUsers.find(u => {
        const cleanDni = u.dni ? String(u.dni).replace(/-/g, '') : '';
        return (u.email === email || cleanDni === cleanInput) && u.password === password;
      });
      if (found) {
        if (found.activo === 0 || found.activo === false) {
           throw new Error('Tu usuario ya no está activo');
        }
        const loggedUser = { 
          id: found.id, 
          email: found.email, 
          name: found.name, 
          role: found.role, 
          dni: found.dni,
          allowedModules: found.role === 'Administrador' 
            ? ['Dashboard', 'Pacientes', 'Citas', 'Consulta Médica', 'Triaje', 'Facturación', 'Inventario', 'Seguridad']
            : ['Dashboard'] // minimal access for offline fallback non-admins
        };
        localStorage.setItem('sesion_activa', JSON.stringify(loggedUser));
        return loggedUser;
      }
      throw new Error('Credenciales inválidas o servidor no disponible.');
    }
  },

  /* ─── Recuperar Contraseña (Enviar Email) ────────────────────────────────── */
  async recoverPassword(email) {
    const response = await fetch(`${API_BASE_URL}/recuperar-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'No se pudo enviar el correo de recuperación.');
    }

    return await response.json();
  },

  /* ─── Reset Password ─────────────────────────────────────────────── */
  async resetPassword(email, newPassword) {
    const response = await fetch(`${API_BASE_URL}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, newPassword })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'No se pudo restablecer la contraseña.');
    }

    return await response.json();
  },

  /* ─── Listar Empleados ───────────────────────────────────── */
  async getUsers() {
    try {
      const response = await fetch(`${API_BASE_URL}/empleados`);
      if (!response.ok) throw new Error('No se pudo consultar empleados desde MySQL.');
      const employees = await response.json();

      // Preservar la firma (base64) que solo existe en localStorage
      const localCache = this._getLocalEmployees();
      const merged = employees.map(emp => {
        const cached = localCache.find(c => String(c.id) === String(emp.id));
        return cached && cached.firma ? { ...emp, firma: cached.firma } : emp;
      });

      localStorage.setItem('sirec_empleados', JSON.stringify(merged));
      return merged;
    } catch (error) {
      console.warn('SIREC: usando empleados locales porque el API no respondió.', error);
      return this._getLocalEmployees();
    }
  },

  /* ─── Crear Empleado ─────────────────────────────────────── */
  async createUser(userData) {
    const response = await fetch(`${API_BASE_URL}/empleados`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'No se pudo guardar el empleado en MySQL.');
    }

    const saved = await response.json();

    // Actualizar caché local
    const local = this._getLocalEmployees();
    local.push({ ...userData, ...saved });
    localStorage.setItem('sirec_empleados', JSON.stringify(local));

    return true;
  },

  /* ─── Actualizar Empleado ────────────────────────────────── */
  async updateUser(id, userData) {
    const response = await fetch(`${API_BASE_URL}/empleados/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'No se pudo actualizar el empleado en MySQL.');
    }

    const updated = await response.json();

    // Actualizar caché local
    let local = this._getLocalEmployees();
    const index = local.findIndex(u => String(u.id) === String(id));
    if (index !== -1) {
      local[index] = { ...local[index], ...userData, ...updated };
      localStorage.setItem('sirec_empleados', JSON.stringify(local));
    }

    return true;
  },

  /* ─── Cambiar Estado Empleado ────────────────────────────── */
  async toggleUserStatus(empId, activo) {
    try {
      const response = await fetch(`${API_BASE_URL}/empleados/${encodeURIComponent(empId)}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'No se pudo actualizar el estado del empleado en MySQL.');
      }
    } catch (err) {
      console.warn('Servidor no disponible, actualizando solo caché local.', err);
    }

    // Actualizar caché local
    let local = this._getLocalEmployees();
    const index = local.findIndex(u => String(u.id) === String(empId));
    if (index !== -1) {
      local[index].activo = activo ? 1 : 0;
      localStorage.setItem('sirec_empleados', JSON.stringify(local));
    }
    return true;
  },

  /* ─── Obtener Especialidades ─────────────────────────────── */
  async getEspecialidades() {
    try {
      const response = await fetch(`${API_BASE_URL}/especialidades`);
      if (!response.ok) throw new Error();
      return await response.json();
    } catch {
      // Especialidades por defecto
      return [
        { id: null, nombre: 'Medicina General' },
        { id: null, nombre: 'Cardiología' },
        { id: null, nombre: 'Pediatría' },
        { id: null, nombre: 'Ginecología' },
        { id: null, nombre: 'Dermatología' },
        { id: null, nombre: 'Traumatología' },
        { id: null, nombre: 'Neurología' }
      ];
    }
  },

  /* ─── Helpers locales ────────────────────────────────────── */
  _getLocalEmployees() {
    try {
      return JSON.parse(localStorage.getItem('sirec_empleados')) || [];
    } catch { return []; }
  }
};
