import { securityService } from '../../services/securityService.js';

export class PermisosView {
  constructor(router, showAlert, state) {
    this.router = router;
    this.showAlert = showAlert;
    this.state = state;
    this._eventsAttached = false;
    this.currentRolId = null;
    this.currentPermisos = [];
  }

  async mount() {
    // Inyectar HTML directamente en la sección para evitar problemas de caché
    const section = document.getElementById('view-permisos');
    if (section) {
      section.innerHTML = this._getTemplate();
    }

    await this._loadRoles();
    this._bindEvents();
    this._eventsAttached = true;
  }

  _getTemplate() {
    return `
    <div class="glass-card" style="margin-bottom: 24px; padding: 20px 24px; border-top: 4px solid var(--warning, #f59e0b);">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
        <div>
          <h2 style="font-size: 1.4rem; font-weight: 700; margin: 0; color: var(--text-primary);">Gestión de Permisos</h2>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 4px 0 0;">
            Configura los permisos de acceso de cada rol a las distintas pantallas del sistema.
          </p>
        </div>
        <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
          <input type="text" id="search-permisos" class="form-input" placeholder="Buscar objeto..." style="min-width: 200px;">
          <select id="filter-rol-permisos" class="form-input" style="min-width: 200px;">
            <option value="" disabled selected>Seleccione un Rol</option>
          </select>
          <button id="btn-save-permisos" class="btn btn-primary" style="display:flex; gap:8px; align-items:center; background-color: #10b981; border-color: #059669;" disabled>
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
            Guardar Cambios
          </button>
        </div>
      </div>
    </div>

    <div class="glass-card" style="padding: 0; overflow: hidden;" id="permisos-container">
      <div style="padding: 40px; text-align: center; color: var(--text-muted);" id="permisos-empty-state">
        <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" stroke-width="1" fill="none" style="margin-bottom: 12px; opacity: 0.5;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
        <p>Seleccione un rol para configurar sus permisos</p>
      </div>
      
      <div class="table-container" style="overflow-x: auto; display: none;" id="permisos-table-container">
        <table class="table is-fullwidth is-hoverable is-striped" style="margin-bottom: 0;">
          <thead style="background: var(--dark, #1f2937); color: #fff;">
            <tr>
              <th style="color: #fff; font-size: 0.8rem; text-transform: uppercase; text-align: left; padding-left: 20px;">Módulo / Objeto</th>
              <th style="color: #fff; font-size: 0.8rem; text-transform: uppercase; text-align: center;">Insertar</th>
              <th style="color: #fff; font-size: 0.8rem; text-transform: uppercase; text-align: center;">Editar</th>
              <th style="color: #fff; font-size: 0.8rem; text-transform: uppercase; text-align: center;">Eliminar</th>
            </tr>
          </thead>
          <tbody id="permisos-table-body">
          </tbody>
        </table>
      </div>
    </div>
    `;
  }

  async refresh() {
    if (this.currentRolId) {
      await this.loadPermisosPorRol(this.currentRolId);
    }
  }

  async _loadRoles() {
    try {
      const roles = await securityService.getRoles();
      const selectRol = document.getElementById('filter-rol-permisos');
      if (selectRol) {
        selectRol.innerHTML = '<option value="" disabled selected>Seleccione un Rol</option>' + 
          roles.map(r => `<option value="${r.id}">${r.nombre}</option>`).join('');
      }
    } catch(err) {
      console.error('Error loading roles', err);
    }
  }

  async loadPermisosPorRol(rolId) {
    this.currentRolId = rolId;
    const tbody = document.getElementById('permisos-table-body');
    const container = document.getElementById('permisos-container');
    const emptyState = document.getElementById('permisos-empty-state');
    const tableContainer = document.getElementById('permisos-table-container');
    const btnSave = document.getElementById('btn-save-permisos');

    if (!tbody || !container) {
      console.error('[Permisos] ERROR: elementos DOM no encontrados');
      return;
    }

    try {
      container.style.opacity = '0.5';
      this.currentPermisos = await securityService.getPermisosPorRol(rolId);
      
      emptyState.style.display = 'none';
      tableContainer.style.display = 'block';
      btnSave.disabled = false;

      this.renderTable();
    } catch (err) {
      console.error('[Permisos] ERROR:', err);
      this.showAlert(err.message, 'danger');
      emptyState.style.display = 'block';
      tableContainer.style.display = 'none';
      btnSave.disabled = true;
    } finally {
      container.style.opacity = '1';
    }
  }

  renderTable() {
    const tbody = document.getElementById('permisos-table-body');
    if (!tbody) return;

    const query = (document.getElementById('search-permisos')?.value || '').toLowerCase();

    const filtered = this.currentPermisos.filter(p => 
      p.objNombre.toLowerCase().includes(query) || 
      (p.objDescripcion && p.objDescripcion.toLowerCase().includes(query))
    );

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-muted);">No se encontraron objetos</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map((p, index) => `
      <tr>
        <td style="vertical-align: middle;">
          <div style="color: var(--text-primary); font-weight: 600; font-size: 0.9rem;">${p.objNombre}</div>
          <div style="color: var(--text-muted); font-size: 0.75rem;">${p.objDescripcion || ''}</div>
        </td>
        <td style="vertical-align: middle; text-align: center;">
          <label class="switch">
            <input type="checkbox" class="toggle-perm" data-index="${index}" data-field="insertar" ${p.insertar ? 'checked' : ''}>
            <span class="slider round"></span>
          </label>
        </td>
        <td style="vertical-align: middle; text-align: center;">
          <label class="switch">
            <input type="checkbox" class="toggle-perm" data-index="${index}" data-field="editar" ${p.editar ? 'checked' : ''}>
            <span class="slider round"></span>
          </label>
        </td>
        <td style="vertical-align: middle; text-align: center;">
          <label class="switch">
            <input type="checkbox" class="toggle-perm" data-index="${index}" data-field="eliminar" ${p.eliminar ? 'checked' : ''}>
            <span class="slider round"></span>
          </label>
        </td>
      </tr>
    `).join('');
  }

  _bindEvents() {
    // Cambio de rol
    document.getElementById('filter-rol-permisos')?.addEventListener('change', (e) => {
      if (e.target.value) {
        this.loadPermisosPorRol(e.target.value);
      }
    });

    // Búsqueda
    document.getElementById('search-permisos')?.addEventListener('input', () => {
      if (this.currentRolId) {
        this.renderTable();
      }
    });

    // Cambios en switches
    document.addEventListener('change', (e) => {
      if (e.target.classList.contains('toggle-perm')) {
        const index = parseInt(e.target.dataset.index, 10);
        const field = e.target.dataset.field;
        const query = (document.getElementById('search-permisos')?.value || '').toLowerCase();
        const filtered = this.currentPermisos.filter(p => 
          p.objNombre.toLowerCase().includes(query) || 
          (p.objDescripcion && p.objDescripcion.toLowerCase().includes(query))
        );
        
        const targetPerm = filtered[index];
        if (targetPerm) {
           targetPerm[field] = e.target.checked ? 1 : 0;
           const originalIndex = this.currentPermisos.findIndex(p => p.permId === targetPerm.permId);
           if (originalIndex !== -1) {
             this.currentPermisos[originalIndex][field] = e.target.checked ? 1 : 0;
           }
        }
      }
    });

    // Guardado masivo
    document.getElementById('btn-save-permisos')?.addEventListener('click', async (e) => {
      if (!this.currentRolId || this.currentPermisos.length === 0) return;
      
      const btn = e.currentTarget;
      const originalHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="loader" style="width: 16px; height: 16px; border-width: 2px; margin-right: 8px;"></span> Guardando...';

      try {
        await securityService.savePermisosBulk(this.currentRolId, this.currentPermisos);
        this.showAlert('Permisos guardados correctamente', 'success');
      } catch (err) {
        this.showAlert('Error al guardar permisos: ' + err.message, 'danger');
      } finally {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
      }
    });
  }
}
