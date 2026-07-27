import { securityService } from '../../services/securityService.js';

export class ObjetosView {
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
    const tbody = document.getElementById('objetos-table-body');
    if (!tbody) return;

    try {
      const objetos = await securityService.getObjetos();
      if (!objetos || objetos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="has-text-centered py-5">No hay objetos registrados</td></tr>';
        return;
      }

      tbody.innerHTML = objetos.map(o => `
        <tr class="objeto-row">
          <td class="obj-name font-semibold" style="vertical-align: middle;">${o.nombre}</td>
          <td class="obj-desc" style="vertical-align: middle; color: var(--text-muted); font-size: 0.9rem;">${o.descripcion || '—'}</td>
          <td class="has-text-centered" style="vertical-align: middle;">
            <span class="badge ${o.rolesAsignados > 0 ? 'badge-primary' : 'badge-secondary'}" style="border-radius: 50%; padding: 4px 8px;">
              ${o.rolesAsignados || 0}
            </span>
          </td>
          <td class="has-text-centered" style="vertical-align: middle;">
            <span class="badge ${o.activo ? 'badge-success' : 'badge-danger'}">${o.activo ? 'Activo' : 'Inactivo'}</span>
          </td>
          <td class="has-text-centered" style="vertical-align: middle; display: flex; gap: 8px; justify-content: center;">
            <button class="btn btn-small btn-edit-objeto" data-obj="${encodeURIComponent(JSON.stringify(o))}" style="background-color: #5bc0de; color: white; border: none; padding: 4px 12px; border-radius: 4px; display: flex; align-items: center; gap: 4px;">
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
              Editar
            </button>
            <button class="btn btn-small btn-toggle-obj" data-id="${o.id}" data-activo="${o.activo}" style="background-color: ${o.activo ? '#d9534f' : '#5cb85c'}; color: white; border: none; padding: 4px 12px; border-radius: 4px;">
              ${o.activo ? 'Desactivar' : 'Activar'}
            </button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      this.showAlert(err.message, 'danger');
    }
  }

  _bindEvents() {
    const searchInput = document.getElementById('search-objetos');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        document.querySelectorAll('.objeto-row').forEach(row => {
          const name = row.querySelector('.obj-name')?.textContent.toLowerCase() || '';
          const desc = row.querySelector('.obj-desc')?.textContent.toLowerCase() || '';
          row.style.display = (name.includes(query) || desc.includes(query)) ? '' : 'none';
        });
      });
    }

    const btnAdd = document.getElementById('btn-add-objeto');
    if (btnAdd) {
      btnAdd.addEventListener('click', async () => {
        document.getElementById('modal-objeto-title').textContent = 'Crear Nuevo Objeto';
        document.getElementById('edit-objeto-id').value = '';
        document.getElementById('form-create-objeto').reset();
        await this._loadRolesCheckboxes([]);
        document.getElementById('modal-objeto-form').style.display = 'flex';
      });
    }

    const modal = document.getElementById('modal-objeto-form');
    if (modal) {
      modal.querySelectorAll('.btn-close-modal').forEach(btn => {
        btn.addEventListener('click', () => modal.style.display = 'none');
      });
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
      });
    }

    document.getElementById('objetos-table-body')?.addEventListener('click', async (e) => {
      const editBtn = e.target.closest('.btn-edit-objeto');
      if (editBtn) {
        const o = JSON.parse(decodeURIComponent(editBtn.dataset.obj));
        document.getElementById('modal-objeto-title').textContent = 'Editar Objeto';
        document.getElementById('edit-objeto-id').value = o.id;
        document.getElementById('obj-nombre').value = o.nombre;
        document.getElementById('obj-desc').value = o.descripcion;
        
        const rolesArray = o.roles ? o.roles.split(',').map(Number) : [];
        await this._loadRolesCheckboxes(rolesArray);
        
        document.getElementById('modal-objeto-form').style.display = 'flex';
      }

      const toggleBtn = e.target.closest('.btn-toggle-obj');
      if (toggleBtn) {
        const id = toggleBtn.dataset.id;
        const currentActive = toggleBtn.dataset.activo === '1' || toggleBtn.dataset.activo === 'true';
        try {
          await securityService.toggleObjetoStatus(id, !currentActive);
          this.showAlert(`Objeto ${!currentActive ? 'activado' : 'desactivado'} exitosamente`, 'success');
          await this.refresh();
        } catch(err) {
          this.showAlert(err.message, 'danger');
        }
      }
    });

    const form = document.getElementById('form-create-objeto');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-objeto-id').value;
        
        const roles = [];
        document.querySelectorAll('.rol-checkbox:checked').forEach(cb => {
          roles.push(parseInt(cb.value, 10));
        });

        const data = {
          nombre: document.getElementById('obj-nombre').value.trim(),
          descripcion: document.getElementById('obj-desc').value.trim(),
          roles: roles
        };

        const btn = document.getElementById('btn-submit-objeto');
        btn.disabled = true;

        try {
          if (id) {
            await securityService.updateObjeto(id, data);
            this.showAlert('Objeto actualizado con sus roles', 'success');
          } else {
            await securityService.createObjeto(data);
            this.showAlert('Objeto creado con sus roles', 'success');
          }
          document.getElementById('modal-objeto-form').style.display = 'none';
          await this.refresh();
        } catch (err) {
          const errEl = document.getElementById('objeto-form-error');
          errEl.textContent = err.message;
          errEl.style.display = 'block';
        } finally {
          btn.disabled = false;
        }
      });
    }
  }

  async _loadRolesCheckboxes(checkedIds) {
    const container = document.getElementById('obj-roles-container');
    if (!container) return;
    
    try {
      const roles = await securityService.getRoles();
      if (!roles || roles.length === 0) {
        container.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem;">No hay roles configurados en el sistema.</div>';
        return;
      }
      
      container.innerHTML = roles.map(rol => {
        const isChecked = checkedIds.includes(rol.id) ? 'checked' : '';
        return `
          <label style="display:flex; align-items:center; gap:8px; padding:6px 0; cursor:pointer;">
            <input type="checkbox" class="rol-checkbox" value="${rol.id}" ${isChecked} style="cursor:pointer; width:16px; height:16px;">
            <span style="font-size:0.9rem; font-weight:500;">${rol.nombre}</span>
            <span style="font-size:0.75rem; color:var(--text-muted); margin-left:auto;">${rol.descripcion || ''}</span>
          </label>
        `;
      }).join('<hr style="margin:4px 0; border-color:var(--border-color); opacity:0.5;">');
    } catch (err) {
      container.innerHTML = `<div style="color:red;font-size:0.85rem;">Error cargando roles: ${err.message}</div>`;
    }
  }
}
