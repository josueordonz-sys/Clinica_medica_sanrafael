/* ==========================================================================
   SIREC - Vista: Inventario de Medicamentos
   ========================================================================== */

import { medicamentoController } from '../../controllers/medicamentoController.js';

export class InventarioView {
  constructor(router, showAlert, state) {
    this.router = router;
    this.showAlert = showAlert;
    this.state = state;
    this._eventsBound = false;
  }

  async mount() {
    this.state.medicamentos = await medicamentoController.getMedicamentos();
    this._bindEvents();
    this._renderTable();
  }

  _bindEvents() {
    if (this._eventsBound) return;
    this._eventsBound = true;

    document.getElementById('form-medicamento')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      await this._saveMedication();
    });

    document.querySelector('#tabla-inventario-medicamentos')?.addEventListener('click', async (event) => {
      if (event.target.closest('.btn-delete-med')) {
        const id = event.target.closest('.btn-delete-med').dataset.id;
        if (confirm('¿Estás seguro de que deseas eliminar este medicamento? Esta acción no se puede deshacer.')) {
          try {
            await medicamentoController.deleteMedicamento(id);
            this.state.medicamentos = await medicamentoController.getMedicamentos();
            this._renderTable();
            this.showAlert('Medicamento eliminado correctamente.', 'success');
          } catch (err) {
            this.showAlert(err.message, 'danger');
          }
        }
      }
    });
  }

  async _saveMedication() {
    const data = {
      id_medicamento: document.getElementById('med-id').value.trim() || undefined,
      nombre_medicamento: document.getElementById('med-nombre').value.trim(),
      med_presentacion: document.getElementById('med-present').value.trim() || null,
      stock_actual: document.getElementById('med-stock').value,
      precio_venta: document.getElementById('med-precio').value
    };

    try {
      await medicamentoController.saveMedicamento(data);
      this.state.medicamentos = await medicamentoController.getMedicamentos();
      document.getElementById('form-medicamento').reset();
      this._renderTable();
      this.showAlert('Medicamento guardado en inventario.', 'success');
    } catch (err) {
      this.showAlert(err.message, 'danger');
    }
  }

  _renderTable() {
    const tbody = document.querySelector('#tabla-inventario-medicamentos tbody');
    if (!tbody) return;

    const meds = [...(this.state.medicamentos || [])]
      .sort((a, b) => (a.nombre_medicamento || '').localeCompare(b.nombre_medicamento || ''));

    if (meds.length === 0) {
      tbody.innerHTML = `<tr>
        <td colspan="6" style="text-align:center; padding: 24px; color: var(--text-muted);">
          No hay medicamentos registrados.
        </td>
      </tr>`;
      return;
    }

    tbody.innerHTML = meds.map(m => {
      const stock = parseInt(m.stock_actual) || 0;
      const stockBadge = stock <= 5
        ? '<span class="badge badge-pending">Bajo</span>'
        : '<span class="badge badge-completed">Disponible</span>';

      return `<tr>
        <td><strong>${m.id_medicamento || m.id}</strong></td>
        <td>${m.nombre_medicamento}</td>
        <td>${stock}</td>
        <td>L. ${parseFloat(m.precio_venta || 0).toFixed(2)}</td>
        <td>${stockBadge}</td>
        <td>
          <button class="btn btn-danger btn-small btn-delete-med" data-id="${m.id_medicamento || m.id}" title="Eliminar" style="background-color: var(--danger); border: none; padding: 6px; border-radius: 4px; color: white; cursor: pointer;">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2" style="vertical-align: middle;">
              <polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </td>
      </tr>`;
    }).join('');
  }
}
