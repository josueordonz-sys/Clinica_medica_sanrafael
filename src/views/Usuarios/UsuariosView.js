/* ==========================================================================
   SIREC - Vista: Gestión de Usuarios (UsuariosView.js)
   Solo accesible para el rol Lic Carmen Modifications
   ========================================================================== */

import { authService } from '../../services/authService.js';
import { securityService } from '../../services/securityService.js';

export class UsuariosView {
  constructor(router, showAlert, state) {
    this.router    = router;
    this.showAlert = showAlert;
    this.state     = state;
    this._eventsAttached = false;
  }

  async mount() {
    await this._loadRoles();
    await this._renderCards();
    if (!this._eventsAttached) {
      this._bindEvents();
      this._eventsAttached = true;
    }
  }

  async refresh() {
    await this._loadRoles();
    await this._renderCards();
    await this._loadEspecialidades();
  }

  async _loadRoles() {
    const roleSelect = document.getElementById('new-user-role');
    const roleFilter = document.getElementById('filter-role-usuarios');
    if (!roleSelect && !roleFilter) return;

    const currentRole = roleSelect?.value || 'Administrador';
    const currentFilter = roleFilter?.value || 'Todos';

    try {
      const roles = await securityService.getRoles();
      const roleOptions = roles.map(r => {
        const value = r.nombre;
        const label = this._getRoleLabel(value);
        return `<option value="${value}">${label}</option>`;
      }).join('');

      if (roleSelect) {
        roleSelect.innerHTML = roleOptions;
        roleSelect.value = roles.some(r => r.nombre === currentRole)
          ? currentRole
          : (roles[0]?.nombre || '');
      }

      if (roleFilter) {
        roleFilter.innerHTML = `<option value="Todos">Todos</option>${roleOptions}`;
        roleFilter.value = roles.some(r => r.nombre === currentFilter)
          ? currentFilter
          : 'Todos';
      }
    } catch (e) {
      console.warn('No se pudieron cargar roles', e);
    }
  }

  _getRoleLabel(role) {
    const labels = {
      Administrador: 'Administrador',
      Recepcionista: 'Recepción / Caja',
      Enfermeria: 'Triaje',
      Medico: 'Consulta Médica',
      Paciente: 'Paciente'
    };
    return labels[role] || role;
  }

  async _loadEspecialidades() {
    const list = document.getElementById('lista-especialidades');
    if (!list) return;
    try {
      const especialidades = await authService.getEspecialidades();
      list.innerHTML = especialidades.map(e => `<option value="${e.nombre}">`).join('');
    } catch (e) {
      console.warn('No se pudieron cargar especialidades');
    }
  }

  /* ─── Eventos ────────────────────────────────────────────── */
  _bindEvents() {
    const btnAdd = document.getElementById('btn-add-usuario');
    const modal  = document.getElementById('modal-user-form');
    const form   = document.getElementById('form-create-user');

    if (btnAdd && modal) {
      btnAdd.addEventListener('click', async () => {
        await this._loadRoles();
        await this._loadEspecialidades();
        document.getElementById('modal-user-title').textContent = 'Crear Nuevo Usuario';
        document.getElementById('btn-submit-user').textContent = 'Crear Usuario';
        document.getElementById('edit-user-id').value = '';
        document.getElementById('new-user-password').required = true;
        document.getElementById('password-req-star').style.display = 'inline';
        document.getElementById('password-help-text').style.display = 'none';
        document.getElementById('contenedor-especialidad').style.display = 'none';
        document.getElementById('contenedor-foto').style.display = 'none';
        document.getElementById('contenedor-firma').style.display = 'none';
        const roleSelect = document.getElementById('new-user-role');
        if (roleSelect && [...roleSelect.options].some(option => option.value === 'Administrador')) {
          roleSelect.value = 'Administrador';
        }
        this._clearSignatureCanvas();
        this._clearPhoto();
        modal.style.display = 'flex';
        document.getElementById('user-form-error').style.display = 'none';
      });
    }

    if (modal) {
      modal.querySelectorAll('.btn-close-modal').forEach(btn =>
        btn.addEventListener('click', () => this._closeModal())
      );
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this._closeModal();
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this._handleSubmit();
      });
    }

    const roleSelect = document.getElementById('new-user-role');
    const especialidadContainer = document.getElementById('contenedor-especialidad');
    const firmaContainer = document.getElementById('contenedor-firma');
    const fotoContainer = document.getElementById('contenedor-foto');
    if (roleSelect && especialidadContainer) {
      roleSelect.addEventListener('change', (e) => {
        const esMedico = e.target.value === 'Medico';
        especialidadContainer.style.display = esMedico ? 'block' : 'none';
        fotoContainer.style.display = esMedico ? 'block' : 'none';
        firmaContainer.style.display = esMedico ? 'block' : 'none';
        if (!esMedico) {
          document.getElementById('usuario-especialidad').value = '';
          this._clearSignatureCanvas();
          this._clearPhoto();
        }
      });
    }

    this._initSignaturePad();
    this._initPhotoUpload();

    // Delegación de eventos: cambiar estado de usuario y editar
    const grid = document.getElementById('usuarios-grid');
    if (grid) {
      grid.addEventListener('click', async (e) => {
        const toggleBtn = e.target.closest('.btn-toggle-status');
        if (toggleBtn) {
          const id = toggleBtn.dataset.id;
          const name  = toggleBtn.dataset.name;
          const currentStatus = toggleBtn.dataset.status === '1' || toggleBtn.dataset.status === 'true';
          if (!id) return;
          await this._handleToggleStatus(id, name, !currentStatus);
          return;
        }

        const editBtn = e.target.closest('.btn-edit-user');
        if (editBtn) {
          const u = JSON.parse(decodeURIComponent(editBtn.dataset.user));
          await this._openEditModal(u);
        }
      });
    }

    // Funcionalidad de búsqueda en tiempo real
    const searchInput = document.getElementById('search-usuarios');
    const roleFilter = document.getElementById('filter-role-usuarios');
    
    const filterCards = () => {
      const query = searchInput ? searchInput.value.toLowerCase() : '';
      const selectedRole = roleFilter ? roleFilter.value : 'Todos';
      const cards = document.querySelectorAll('.user-card');
      
      cards.forEach(card => {
        const nameEl = card.querySelector('.user-name-text');
        const roleEl = card.querySelector('.badge');
        
        const nameText = nameEl ? nameEl.textContent.toLowerCase() : '';
        const roleText = roleEl ? roleEl.textContent.toLowerCase() : '';
        
        const matchesQuery = nameText.includes(query) || roleText.includes(query);
        const cardRole = card.dataset.role;
        const matchesRole = selectedRole === 'Todos' || cardRole === selectedRole;
        
        if (matchesQuery && matchesRole) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    };

    if (searchInput) searchInput.addEventListener('input', filterCards);
    if (roleFilter) roleFilter.addEventListener('change', filterCards);
  }

  _closeModal() {
    const modal = document.getElementById('modal-user-form');
    const form  = document.getElementById('form-create-user');
    const errEl = document.getElementById('user-form-error');
    if (modal) modal.style.display = 'none';
    if (form)  form.reset();
    if (errEl) errEl.style.display = 'none';
    const especialidadContainer = document.getElementById('contenedor-especialidad');
    if (especialidadContainer) especialidadContainer.style.display = 'none';
    const fotoContainer = document.getElementById('contenedor-foto');
    if (fotoContainer) fotoContainer.style.display = 'none';
    const firmaContainer = document.getElementById('contenedor-firma');
    if (firmaContainer) firmaContainer.style.display = 'none';
    this._clearSignatureCanvas();
    this._clearPhoto();
  }

  async _openEditModal(user) {
    await this._loadRoles();
    await this._loadEspecialidades();
    const modal = document.getElementById('modal-user-form');
    document.getElementById('modal-user-title').textContent = 'Editar Usuario';
    document.getElementById('btn-submit-user').textContent = 'Guardar Cambios';
    document.getElementById('user-form-error').style.display = 'none';

    document.getElementById('edit-user-id').value = user.id;
    document.getElementById('new-user-dni').value = user.dni || '';
    document.getElementById('new-user-pnom').value = user.pnom || '';
    document.getElementById('new-user-snom').value = user.snom || '';
    document.getElementById('new-user-pape').value = user.pape || '';
    document.getElementById('new-user-sape').value = user.sape || '';
    document.getElementById('new-user-email').value = user.email || '';
    document.getElementById('new-user-tel').value = user.tel || '';
    document.getElementById('new-user-role').value = user.role || 'Paciente';

    document.getElementById('new-user-password').required = false;
    document.getElementById('password-req-star').style.display = 'none';
    document.getElementById('password-help-text').style.display = 'block';

    const especialidadContainer = document.getElementById('contenedor-especialidad');
    const firmaContainer = document.getElementById('contenedor-firma');
    const fotoContainer = document.getElementById('contenedor-foto');
    if (user.role === 'Medico') {
      especialidadContainer.style.display = 'block';
      document.getElementById('usuario-especialidad').value = user.especialidad || '';
      fotoContainer.style.display = 'block';
      this._loadPhotoPreview(user.foto);
      firmaContainer.style.display = 'block';
      if (user.firma) {
        this._loadSignatureToCanvas(user.firma);
      } else {
        this._clearSignatureCanvas();
      }
    } else {
      especialidadContainer.style.display = 'none';
      document.getElementById('usuario-especialidad').value = '';
      fotoContainer.style.display = 'none';
      this._clearPhoto();
      firmaContainer.style.display = 'none';
      this._clearSignatureCanvas();
    }

    modal.style.display = 'flex';
  }

  /* ─── Crear / Editar Usuario ─────────────────────────────── */
  async _handleSubmit() {
    const editId = document.getElementById('edit-user-id').value;
    const submitBtn = document.querySelector('#form-create-user button[type="submit"]');
    const userData = {
      dni:      document.getElementById('new-user-dni').value.trim(),
      pnom:     document.getElementById('new-user-pnom').value.trim(),
      snom:     document.getElementById('new-user-snom').value.trim(),
      pape:     document.getElementById('new-user-pape').value.trim(),
      sape:     document.getElementById('new-user-sape').value.trim(),
      email:    document.getElementById('new-user-email').value.trim(),
      tel:      document.getElementById('new-user-tel').value.trim(),
      password: document.getElementById('new-user-password').value,
      role:     document.getElementById('new-user-role').value
    };

    if (userData.role === 'Medico') {
      if (this._currentPhotoBase64) {
        userData.foto = this._currentPhotoBase64;
      }
      
      const canvas = document.getElementById('firma-canvas');
      const firmaData = canvas ? canvas.toDataURL('image/png') : null;
      // Only save if the canvas has actual content (not just blank)
      const blank = document.createElement('canvas');
      blank.width = canvas?.width; blank.height = canvas?.height;
      if (firmaData && firmaData !== blank.toDataURL('image/png')) {
        userData.firma = firmaData;
      }
    }

    if (userData.role === 'Medico') {
      userData.especialidad = document.getElementById('usuario-especialidad').value;
      if (!userData.especialidad) {
        this._showFormError('Por favor seleccione una especialidad para el médico.');
        return;
      }
    }

    if (!userData.dni || !userData.pnom || !userData.pape || !userData.email) {
      this._showFormError('Por favor completa todos los campos obligatorios (*).');
      return;
    }
    if (!editId && !userData.password) {
      this._showFormError('La contraseña es obligatoria para usuarios nuevos.');
      return;
    }

    try {
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Guardando...'; }
      if (editId) {
        await authService.updateUser(editId, userData);
        this.showAlert(`Empleado actualizado exitosamente.`, 'success');
      } else {
        await authService.createUser(userData);
        this.showAlert(`Empleado creado exitosamente.`, 'success');
      }
      this._closeModal();
      await this.refresh();
    } catch (err) {
      this._showFormError(err.message);
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = editId ? 'Guardar Cambios' : 'Crear Usuario'; }
    }
  }

  /* ─── Cambiar Estado Usuario ─────────────────────────────── */
  async _handleToggleStatus(id, name, newStatus) {
    const actionText = newStatus ? 'activar' : 'desactivar';
    const confirmed = window.confirm(
      `¿Deseas ${actionText} al empleado "${name}"?`
    );
    if (!confirmed) return;

    try {
      await authService.toggleUserStatus(id, newStatus);
      this.showAlert(`Empleado ${newStatus ? 'activado' : 'desactivado'}.`, 'success');
      await this.refresh();
    } catch (err) {
      this.showAlert(err.message, 'danger');
    }
  }

  _showFormError(msg) {
    const errEl = document.getElementById('user-form-error');
    if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
  }

  /* ─── Render Tarjetas ────────────────────────────────────── */
  async _renderCards() {
    const grid = document.getElementById('usuarios-grid');
    if (!grid) return;

    const roleConfig = {
      Administrador: { badge: 'danger',    accent: '#ef4444' },
      Recepcionista: { badge: 'info',      accent: '#0ea5e9' },
      Enfermeria:    { badge: 'warning',   accent: '#f59e0b' },
      Medico:        { badge: 'success',   accent: '#10b981' },
      Paciente:      { badge: 'secondary', accent: '#64748b' }
    };

    try {
      const users = await authService.getUsers();

      if (!users || users.length === 0) {
        grid.innerHTML = `
          <div style="grid-column: 1/-1; text-align:center; padding: 48px; color: var(--text-muted);">
            No hay usuarios registrados en el sistema.
          </div>`;
        return;
      }

      grid.innerHTML = users.map(u => {
        const cfg     = roleConfig[u.role] || { badge: 'secondary', accent: '#64748b' };
        const initials = (u.name || u.email)
          .split(' ')
          .slice(0, 2)
          .map(w => w[0]?.toUpperCase() || '')
          .join('');

        return `
          <div class="user-card" data-role="${u.role}" style="
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-top: 3px solid ${cfg.accent};
            border-radius: 12px;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            transition: box-shadow 0.2s;
          ">
            <!-- Cabecera -->
            <div style="display: flex; align-items: center; gap: 14px;">
              <div style="
                width: 44px; height: 44px;
                border-radius: 50%;
                background: ${cfg.accent}22;
                color: ${cfg.accent};
                display: flex; align-items: center; justify-content: center;
                font-weight: 700; font-size: 1rem;
                flex-shrink: 0;
                border: 2px solid ${cfg.accent}44;
              ">${initials || '?'}</div>
              <div style="overflow: hidden;">
                <div class="user-name-text" style="font-weight: 700; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${u.name || '—'}
                </div>
                <div style="font-size: 0.75rem; color: var(--text-muted); display: flex; gap: 6px; align-items: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" fill="none" stroke-width="2" style="flex-shrink:0;">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>
                  </svg>
                  ${u.dni || 'Sin DNI'}
                </div>
                <div style="font-size: 0.78rem; color: var(--text-muted); margin-top:2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${u.email}
                </div>
              </div>
            </div>

            <!-- Rol -->
            <div>
              <span class="badge badge-${cfg.badge}" style="font-size: 0.78rem;">${this._getRoleLabel(u.role)}</span>
            </div>

            <!-- Acciones y Estado -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 8px; border-top: 1px solid var(--border-color);">
              <span style="font-size: 0.78rem; font-weight: 600; color: ${u.activo ? 'var(--success, #10b981)' : 'var(--danger, #dc2626)'};">
                ${u.activo ? 'Activo' : 'Inactivo'}
              </span>
              <div style="display: flex; gap: 8px;">
                <button
                  title="Editar"
                  class="btn btn-small btn-edit-user"
                  data-user="${encodeURIComponent(JSON.stringify(u))}"
                  style="
                    background: transparent;
                    border: 1px solid var(--text-muted);
                    color: var(--text-muted);
                    padding: 5px 10px;
                    font-size: 0.78rem;
                    border-radius: 7px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    transition: all 0.15s;
                  "
                  onmouseover="this.style.background='var(--text-muted)';this.style.color='#fff';"
                  onmouseout="this.style.background='transparent';this.style.color='var(--text-muted)';"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2">
                    <path d="M12 20h9"></path>
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                  </svg> 

                </button>
                <button
                title="${u.activo ? 'Desactivar usuario' : 'Activar usuario'}"
                  class="btn btn-small btn-toggle-status"
                  data-id="${u.id}"
                  data-name="${u.name}"
                  data-status="${u.activo}"
                style="
                  background: transparent;
                  border: 1px solid ${u.activo ? 'var(--danger, #dc2626)' : 'var(--success, #10b981)'};
                  color: ${u.activo ? 'var(--danger, #dc2626)' : 'var(--success, #10b981)'};
                  padding: 5px 12px;
                  font-size: 0.78rem;
                  border-radius: 7px;
                  cursor: pointer;
                  display: flex;
                  align-items: center;
                  gap: 6px;
                  transition: background 0.15s;
                "
                onmouseover="this.style.background='${u.activo ? 'var(--danger,#dc2626)' : 'var(--success,#10b981)'}';this.style.color='#fff';"
                onmouseout="this.style.background='transparent';this.style.color='${u.activo ? 'var(--danger,#dc2626)' : 'var(--success,#10b981)'}';"
              >
                ${u.activo ? 
                  `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                  </svg> ` 
                  : 
                  `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg> `
                }
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');

    } catch (err) {
      console.error('[UsuariosView] Error al cargar usuarios:', err);
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align:center; padding: 32px; color: var(--danger);">
          Error al cargar los usuarios.
        </div>`;
    }
  }

  /* ─── Signature Pad Helpers ──────────────────────────────── */
  _initSignaturePad() {
    const canvas = document.getElementById('firma-canvas');
    const btnClear = document.getElementById('btn-limpiar-firma');
    if (!canvas) return;

    let drawing = false;
    let lastX = 0, lastY = 0;

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      if (e.touches) {
        return {
          x: (e.touches[0].clientX - rect.left) * scaleX,
          y: (e.touches[0].clientY - rect.top) * scaleY
        };
      }
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    };

    const startDraw = (e) => {
      e.preventDefault();
      drawing = true;
      const pos = getPos(e);
      lastX = pos.x; lastY = pos.y;
    };
    const draw = (e) => {
      if (!drawing) return;
      e.preventDefault();
      const ctx = canvas.getContext('2d');
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(pos.x, pos.y);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      lastX = pos.x; lastY = pos.y;
    };
    const stopDraw = () => { drawing = false; };

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDraw);
    canvas.addEventListener('mouseleave', stopDraw);
    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDraw);

    if (btnClear) {
      btnClear.addEventListener('click', () => this._clearSignatureCanvas());
    }
  }

  _clearSignatureCanvas() {
    const canvas = document.getElementById('firma-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  _loadSignatureToCanvas(dataUrl) {
    const canvas = document.getElementById('firma-canvas');
    if (!canvas || !dataUrl) return;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = dataUrl;
  }

  /* ─── Photo Upload Helpers ───────────────────────────────── */
  _initPhotoUpload() {
    const input = document.getElementById('foto-medico');
    if (!input) return;
    
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) {
        this._clearPhoto();
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target.result;
        this._currentPhotoBase64 = base64;
        this._loadPhotoPreview(base64);
      };
      reader.readAsDataURL(file);
    });
  }

  _clearPhoto() {
    this._currentPhotoBase64 = null;
    const input = document.getElementById('foto-medico');
    if (input) input.value = '';
    
    const preview = document.getElementById('foto-preview');
    const placeholder = document.getElementById('foto-placeholder');
    if (preview && placeholder) {
      preview.src = '';
      preview.style.display = 'none';
      placeholder.style.display = 'block';
    }
  }

  _loadPhotoPreview(base64) {
    if (!base64) {
      this._clearPhoto();
      return;
    }
    this._currentPhotoBase64 = base64;
    const preview = document.getElementById('foto-preview');
    const placeholder = document.getElementById('foto-placeholder');
    if (preview && placeholder) {
      preview.src = base64;
      preview.style.display = 'block';
      placeholder.style.display = 'none';
    }
  }
}
