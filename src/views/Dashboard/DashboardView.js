/* ==========================================================================
   SIREC - Vista: Dashboard Administrativo (DashboardView.js)
   ========================================================================== */

export class DashboardView {
  constructor(showAlert, state, currentRole) {
    this.showAlert   = showAlert;
    this.state       = state;
    this.currentRole = currentRole;
    this._chartSemanal       = null;
    this._chartEspecialidades = null;
  }

  mount() {
    // Rango de fechas por defecto: últimos 7 días
    const today = new Date().toISOString().split('T')[0];
    const week  = this._offsetDate(-7);
    document.getElementById('dash-fecha-inicio').value = week;
    document.getElementById('dash-fecha-fin').value    = today;

    this._bindEvents();
    this.refresh();
  }

  /** Actualiza el rol activo (llamado por App.js al cambiar rol) */
  setRole(role) { this.currentRole = role; }

  refresh() {
    this._renderStats();
    this._renderCharts();
  }

  _bindEvents() {
    document.getElementById('btn-dash-filtrar')?.addEventListener('click', () => {
      const start = document.getElementById('dash-fecha-inicio').value;
      const end   = document.getElementById('dash-fecha-fin').value;
      if (new Date(end) < new Date(start)) {
        this.showAlert('La Fecha Final no puede ser menor a la Fecha Inicial.', 'danger');
        return;
      }
      this.refresh();
    });

    document.getElementById('btn-dash-export-excel')?.addEventListener('click', () => {
      this._exportCSV();
    });

    document.getElementById('btn-dash-export-pdf')?.addEventListener('click', () => {
      window.print();
    });
  }

  _getFilteredAppointments() {
    const start = new Date(document.getElementById('dash-fecha-inicio').value).getTime();
    const end   = new Date(document.getElementById('dash-fecha-fin').value + 'T23:59:59').getTime();
    return (this.state.appointments || []).filter(a =>
      a.timestamp >= start && a.timestamp <= end
    );
  }

  _renderStats() {
    const today    = new Date().toISOString().split('T')[0];
    const todayAll = (this.state.appointments || []).filter(a => a.fecha === today);

    // Ingresos de hoy (sólo Administrador puede verlos)
    const ingresos = todayAll.reduce((sum, a) => sum + (parseFloat(a.monto) || 0), 0);
    const statEl   = document.getElementById('stat-ingresos-hoy');
    if (statEl) {
      if (this.currentRole === 'Administrador') {
        statEl.textContent = `L. ${ingresos.toFixed(2)}`;
        statEl.style.fontSize = '1.75rem';
        statEl.style.color    = 'var(--text-primary)';
      } else {
        statEl.textContent = 'L. [Restringido]';
        statEl.style.fontSize = '1.1rem';
        statEl.style.color    = 'var(--text-muted)';
      }
    }

    const atendidos = todayAll.filter(a => a.estado === 'finalizado').length;
    const elAt = document.getElementById('stat-atendidos-hoy');
    if (elAt) elAt.textContent = atendidos;

    const totalCitas = (this.state.appointments || []).length;
    const elTotal = document.getElementById('stat-total-citas');
    if (elTotal) elTotal.textContent = totalCitas;
  }

  _renderCharts() {
    const filtered = this._getFilteredAppointments();
    const isAdmin  = this.currentRole === 'Administrador';

    // ── Dataset Semanal ──────────────────────────────────────────────────────
    const dailyMap = {};
    for (let i = 6; i >= 0; i--) {
      dailyMap[this._offsetDate(-i)] = { earnings: 0, count: 0 };
    }
    filtered.forEach(a => {
      if (dailyMap[a.fecha]) {
        dailyMap[a.fecha].earnings += parseFloat(a.monto) || 0;
        dailyMap[a.fecha].count    += 1;
      }
    });

    const labels    = Object.keys(dailyMap).map(d => d.slice(5));
    const earnings  = Object.values(dailyMap).map(d => d.earnings);
    const counts    = Object.values(dailyMap).map(d => d.count);

    const ctxSem = document.getElementById('chart-semanal')?.getContext('2d');
    if (ctxSem) {
      if (this._chartSemanal) this._chartSemanal.destroy();
      this._chartSemanal = new Chart(ctxSem, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Ingresos (L.)',
              data: isAdmin ? earnings : earnings.map(() => 0),
              backgroundColor: 'rgba(37,99,235,.7)',
              borderColor: '#2563eb',
              borderWidth: 1,
              yAxisID: 'y'
            },
            {
              type: 'line',
              label: 'Citas',
              data: counts,
              borderColor: '#10b981',
              backgroundColor: '#10b981',
              tension: 0.3,
              borderWidth: 3,
              yAxisID: 'y1'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y:  { display: isAdmin, position: 'left',  grid: { color: 'rgba(0,0,0,.05)' } },
            y1: { display: true,    position: 'right', grid: { drawOnChartArea: false } }
          }
        }
      });
    }

    // ── Dataset por Especialidad ─────────────────────────────────────────────
    const specMap = {};
    filtered.forEach(a => {
      specMap[a.especialidad] = (specMap[a.especialidad] || 0) + (parseFloat(a.monto) || 0);
    });

    const ctxSpec = document.getElementById('chart-especialidades')?.getContext('2d');
    if (ctxSpec) {
      if (this._chartEspecialidades) this._chartEspecialidades.destroy();
      const specLabels = Object.keys(specMap);
      this._chartEspecialidades = new Chart(ctxSpec, {
        type: 'doughnut',
        data: {
          labels: specLabels.length ? specLabels : ['Sin datos'],
          datasets: [{
            data: isAdmin && specLabels.length
              ? Object.values(specMap)
              : [1],
            backgroundColor: ['#2563eb','#10b981','#f59e0b','#ef4444','#06b6d4']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom' } }
        }
      });
    }
  }



  _exportCSV() {
    let csv = 'data:text/csv;charset=utf-8,';
    csv += 'ID,Factura,DNI,Paciente,Especialidad,Medico,Monto,Metodo,Fecha,Estado\n';
    (this.state.appointments || []).forEach(a => {
      csv += `"${a.id}","${a.facturaNum}","${a.pacienteDni}","${a.pacienteNombre}",` +
             `"${a.especialidad}","${a.medico}",${a.monto},"${a.metodoPago}","${a.fecha}","${a.estado}"\n`;
    });
    const link = document.createElement('a');
    link.href     = encodeURI(csv);
    link.download = `Reporte_SIREC_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.showAlert('Reporte Excel exportado correctamente.', 'success');
  }

  _offsetDate(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }
}
