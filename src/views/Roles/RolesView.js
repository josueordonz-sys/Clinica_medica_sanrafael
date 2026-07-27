import { securityService } from '../../services/securityService.js';

export class RolesView {
  constructor(router, showAlert, state) {
    this.router = router;
    this.showAlert = showAlert;
    this.state = state;
    this._eventsAttached = false;
  }

  async mount() {
    await this.refresh();
    if (!this._eventsAttached) {
      this._bindEvents();
      this._eventsAttached = true;
    }
  }

  async refresh() {
    const tbody = document.getElementById('roles-table-body');
    if (!tbody) return;

    try {
      const roles = await securityService.getRoles();
      if (!roles || roles.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="has-text-centered py-5">No hay roles registrados</td></tr>';
        return;
      }

      tbody.innerHTML = roles.map(r => `
        <tr class="role-row">
          <td class="role-name font-semibold" style="vertical-align: middle;">${r.nombre}</td>
          <td style="vertical-align: middle;"><span class="badge badge-info">${r.nivel}</span></td>
          <td style="vertical-align: middle; color: var(--text-muted); font-size: 0.9rem;">${r.descripcion || '—'}</td>
          <td class="has-text-centered" style="vertical-align: middle;">
            <span class="badge ${r.totalUsuarios > 0 ? 'badge-primary' : 'badge-secondary'}">${r.totalUsuarios || 0}</span>
          </td>
          <td class="has-text-centered" style="vertical-align: middle; white-space: nowrap;">
            <button class="btn btn-small btn-edit-rol" data-rol="${encodeURIComponent(JSON.stringify(r))}" title="Editar Rol">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
            </button>
            <button class="btn btn-small btn-delete-rol" data-id="${r.id}" data-nombre="${r.nombre}" title="Eliminar Rol" style="background-color: var(--danger, #dc2626); color: white; margin-left: 4px;">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      this.showAlert(err.message, 'danger');
    }
  }

  _bindEvents() {
    const searchInput = document.getElementById('search-roles');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        document.querySelectorAll('.role-row').forEach(row => {
          const name = row.querySelector('.role-name')?.textContent.toLowerCase() || '';
          row.style.display = name.includes(query) ? '' : 'none';
        });
      });
    }

    const btnAdd = document.getElementById('btn-add-rol');
    if (btnAdd) {
      btnAdd.addEventListener('click', async () => {
        document.getElementById('modal-rol-title').textContent = 'Crear Nuevo Rol';
        document.getElementById('edit-rol-id').value = '';
        document.getElementById('form-create-rol').reset();
        await this._loadPermisosCheckboxes([]);
        document.getElementById('modal-rol-form').style.display = 'flex';
      });
    }

    const modal = document.getElementById('modal-rol-form');
    if (modal) {
      modal.querySelectorAll('.btn-close-modal').forEach(btn => {
        btn.addEventListener('click', () => modal.style.display = 'none');
      });
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
      });
    }

    document.getElementById('roles-table-body')?.addEventListener('click', async (e) => {
      const editBtn = e.target.closest('.btn-edit-rol');
      if (editBtn) {
        const r = JSON.parse(decodeURIComponent(editBtn.dataset.rol));
        document.getElementById('modal-rol-title').textContent = 'Editar Rol';
        document.getElementById('edit-rol-id').value = r.id;
        document.getElementById('rol-nombre').value = r.nombre;
        document.getElementById('rol-nivel').value = r.nivel;
        document.getElementById('rol-desc').value = r.descripcion;
        
        const accesosArray = r.accesos ? r.accesos.split(',').map(Number) : [];
        await this._loadPermisosCheckboxes(accesosArray);
        
        document.getElementById('modal-rol-form').style.display = 'flex';
      }

      const deleteBtn = e.target.closest('.btn-delete-rol');
      if (deleteBtn) {
        const id = deleteBtn.dataset.id;
        const nombre = deleteBtn.dataset.nombre;
        if (!confirm(`¿Estás seguro de eliminar el rol "${nombre}"?\n\nEsto también eliminará todos los permisos asociados a este rol.`)) return;
        try {
          await securityService.deleteRole(id);
          this.showAlert(`Rol "${nombre}" eliminado correctamente`, 'success');
          await this.refresh();
        } catch (err) {
          this.showAlert(err.message, 'danger');
        }
      }
    });

    const form = document.getElementById('form-create-rol');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-rol-id').value;
        
        // Recolectar checkboxes marcados
        const accesos = [];
        document.querySelectorAll('.permiso-checkbox:checked').forEach(cb => {
          accesos.push(parseInt(cb.value, 10));
        });

        const data = {
          nombre: document.getElementById('rol-nombre').value.trim(),
          nivel: parseInt(document.getElementById('rol-nivel').value, 10),
          descripcion: document.getElementById('rol-desc').value.trim(),
          accesos: accesos
        };

        const btn = document.getElementById('btn-submit-rol');
        btn.disabled = true;

        try {
          if (id) {
            await securityService.updateRole(id, data);
            this.showAlert('Rol y accesos actualizados', 'success');
          } else {
            await securityService.createRole(data);
            this.showAlert('Rol creado con accesos', 'success');
          }
          document.getElementById('modal-rol-form').style.display = 'none';
          await this.refresh();
        } catch (err) {
          const errEl = document.getElementById('rol-form-error');
          errEl.textContent = err.message;
          errEl.style.display = 'block';
        } finally {
          btn.disabled = false;
        }
      });
    }
  }

  async _loadPermisosCheckboxes(checkedIds) {
    const container = document.getElementById('rol-permisos-container');
    if (!container) return;
    
    try {
      const objetos = await securityService.getObjetos();
      if (!objetos || objetos.length === 0) {
        container.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem;">No hay pantallas configuradas en el sistema.</div>';
        return;
      }
      
      container.innerHTML = objetos.filter(o => o.activo).map(obj => {
        const isChecked = checkedIds.includes(obj.id) ? 'checked' : '';
        return `
          <label style="display:flex; align-items:center; gap:8px; padding:6px 0; cursor:pointer;">
            <input type="checkbox" class="permiso-checkbox" value="${obj.id}" ${isChecked} style="cursor:pointer; width:16px; height:16px;">
            <span style="font-size:0.9rem; font-weight:500;">${obj.nombre}</span>
            <span style="font-size:0.75rem; color:var(--text-muted); margin-left:auto;">${obj.descripcion || ''}</span>
          </label>
        `;
      }).join('<hr style="margin:4px 0; border-color:var(--border-color); opacity:0.5;">');
    } catch (err) {
      container.innerHTML = `<div style="color:red;font-size:0.85rem;">Error cargando pantallas: ${err.message}</div>`;
    }
  }
}
