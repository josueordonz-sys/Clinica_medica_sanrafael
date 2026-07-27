/* ==========================================================================
   SIREC - Servicio de Seguridad (securityService.js)
   Para la gestión de roles, objetos y matriz de permisos.
   ========================================================================== */

const API_BASE_URL = 'http://127.0.0.1:3000/api';

export const securityService = {
  /* ─── Roles ────────────────────────────────────────────────────────── */
  async getRoles() {
    const response = await fetch(`${API_BASE_URL}/roles`);
    if (!response.ok) throw new Error('Error al cargar roles');
    return await response.json();
  },

  async createRole(data) {
    const response = await fetch(`${API_BASE_URL}/roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Error al crear rol');
    }
    return await response.json();
  },

  async updateRole(id, data) {
    const response = await fetch(`${API_BASE_URL}/roles/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Error al actualizar rol');
    }
    return await response.json();
  },

  async deleteRole(id) {
    const response = await fetch(`${API_BASE_URL}/roles/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Error al eliminar rol');
    }
    return await response.json();
  },

  /* ─── Objetos (Módulos/Pantallas) ──────────────────────────────────── */
  async getObjetos() {
    const response = await fetch(`${API_BASE_URL}/objetos`);
    if (!response.ok) throw new Error('Error al cargar objetos');
    return await response.json();
  },

  async createObjeto(data) {
    const response = await fetch(`${API_BASE_URL}/objetos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Error al crear objeto');
    }
    return await response.json();
  },

  async updateObjeto(id, data) {
    const response = await fetch(`${API_BASE_URL}/objetos/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Error al actualizar objeto');
    }
    return await response.json();
  },

  async toggleObjetoStatus(id, activo) {
    const response = await fetch(`${API_BASE_URL}/objetos/${encodeURIComponent(id)}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo })
    });
    if (!response.ok) throw new Error('Error al cambiar estado del objeto');
    return await response.json();
  },

  /* ─── Permisos (Matriz de Acceso) ──────────────────────────────────── */
  async getPermisos() {
    const response = await fetch(`${API_BASE_URL}/permisos`);
    if (!response.ok) throw new Error('Error al cargar permisos');
    return await response.json();
  },

  async createPermiso(data) {
    const response = await fetch(`${API_BASE_URL}/permisos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Error al asignar permiso');
    }
    return await response.json();
  },

  async updatePermiso(id, data) {
    const response = await fetch(`${API_BASE_URL}/permisos/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Error al actualizar permiso');
    }
    return await response.json();
  },

  async deletePermiso(id) {
    const response = await fetch(`${API_BASE_URL}/permisos/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Error al eliminar permiso');
    return await response.json();
  },

  /* ─── Nuevos Endpoints de Matriz de Permisos ──────────────────────── */
  async getPermisosPorRol(rolId) {
    const response = await fetch(`${API_BASE_URL}/permisos/rol/${encodeURIComponent(rolId)}`);
    if (!response.ok) throw new Error('Error al cargar permisos del rol');
    return await response.json();
  },

  async savePermisosBulk(rolId, permisos) {
    const response = await fetch(`${API_BASE_URL}/permisos/bulk`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rolId, permisos })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Error al guardar matriz de permisos');
    }
    return await response.json();
  },

  async getPermisosUsuario(rolNombre) {
    const response = await fetch(`${API_BASE_URL}/permisos/usuario/${encodeURIComponent(rolNombre)}`);
    if (!response.ok) throw new Error('Error al obtener permisos detallados');
    return await response.json();
  },

  /* ─── Utilidad para aplicar permisos en vistas ────────────────────── */
  applyPermissions(moduleName, containerElement) {
    if (!containerElement) return;

    // Obtener permisos desde la sesión actual
    const sessionStr = localStorage.getItem('sesion_activa');
    if (!sessionStr) return;

    try {
      const session = JSON.parse(sessionStr);
      const permisos = (session.permisos && session.permisos[moduleName]) || {
        ver: 0, insertar: 0, editar: 0, eliminar: 0
      };

      let styleTag = document.getElementById('dynamic-perm-styles');
      if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'dynamic-perm-styles';
        document.head.appendChild(styleTag);
      }

      let css = '';
      if (!permisos.insertar) css += `[data-perm-action="insertar"] { display: none !important; }\n`;
      if (!permisos.editar) css += `[data-perm-action="editar"] { display: none !important; }\n`;
      if (!permisos.eliminar) css += `[data-perm-action="eliminar"] { display: none !important; }\n`;
      
      styleTag.innerHTML = css;
    } catch(err) {
      console.error('Error aplicando permisos:', err);
    }
  }
};
