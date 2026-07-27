/* ==========================================================================
   SIREC - Punto de Entrada Principal (main.js)
   Inicializa la aplicación al cargar el DOM
   ========================================================================== */

import { App } from './App.js?v=2';

/* ─────────────────────────────────────────────
   Inicialización de colecciones locales vacías
───────────────────────────────────────────── */
function seedLocalStorage() {
  if (!localStorage.getItem('sirec_pacientes') && !localStorage.getItem('sirec_patients')) {
    localStorage.setItem('sirec_pacientes', JSON.stringify([]));
    localStorage.setItem('sirec_patients',  JSON.stringify([]));
  }

  if (!localStorage.getItem('sirec_citas') && !localStorage.getItem('sirec_appointments')) {
    localStorage.setItem('sirec_citas',        JSON.stringify([]));
    localStorage.setItem('sirec_appointments',  JSON.stringify([]));
  }
  if (!localStorage.getItem('sirec_triajes') && !localStorage.getItem('sirec_triage')) {
    localStorage.setItem('sirec_triajes', JSON.stringify([]));
    localStorage.setItem('sirec_triage',  JSON.stringify([]));
  }
  if (!localStorage.getItem('sirec_consultas') && !localStorage.getItem('sirec_consultations')) {
    localStorage.setItem('sirec_consultas',     JSON.stringify([]));
    localStorage.setItem('sirec_consultations', JSON.stringify([]));
  }
  if (!localStorage.getItem('sirec_pagos')) {
    localStorage.setItem('sirec_pagos', JSON.stringify([]));
  }
  if (!localStorage.getItem('sirec_medicamentos')) {
    localStorage.setItem('sirec_medicamentos', JSON.stringify([]));
  }
  if (!localStorage.getItem('usuarios_sistema')) {
    localStorage.setItem('usuarios_sistema', JSON.stringify([]));
  }
}

/* ─────────────────────────────────────────────
Conexion del login parte visual - Erlin
───────────────────────────────────────────── */
function ensureLoginSection() {
  if (!document.getElementById('view-login')) {
    const section = document.createElement('section');
    section.id        = 'view-login';
    section.className = 'app-view';
    section.style.display = 'none';
    // Insert before the sidebar so it covers the full page
    document.body.insertBefore(section, document.body.firstChild);
  }
}

/* ─────────────────────────────────────────────
   Limpieza de datos simulados anteriores
   Purga citas/triajes/consultas que pudieran
   haberse guardado como mock en sesiones previas.
   Se ejecuta una vez; la clave de control impide
   repetirlo en recargas futuras.
───────────────────────────────────────────── */
function clearMockTransactions() {
  const CONTROL_KEY = 'sirec_mock_cleared_v3';
  if (localStorage.getItem(CONTROL_KEY)) return; // Ya se limpió antes

  localStorage.removeItem('sirec_pacientes');
  localStorage.removeItem('sirec_patients');
  localStorage.removeItem('sirec_citas');
  localStorage.removeItem('sirec_appointments');
  localStorage.removeItem('sirec_triajes');
  localStorage.removeItem('sirec_triage');
  localStorage.removeItem('sirec_consultas');
  localStorage.removeItem('sirec_consultations');
  localStorage.removeItem('sirec_pagos');
  localStorage.removeItem('sirec_medicamentos');
  localStorage.removeItem('usuarios_sistema');
  localStorage.removeItem('sirec_mock_users');

  // Marcar como limpiado para no repetir
  localStorage.setItem(CONTROL_KEY, '1');
  console.log('SIREC: Datos locales simulados eliminados. El sistema inicia en cero.');
}

/* ─────────────────────────────────────────────
   Global Print Function (Thermal vs A4)
───────────────────────────────────────────── */
/* ─────────────────────────────────────────────
   Global Print Function (Thermal vs A4)
───────────────────────────────────────────── */
window.printDocument = function(isTicket) {
  let styleEl = document.getElementById('dynamic-print-style');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'dynamic-print-style';
    document.head.appendChild(styleEl);
  }
  
  if (isTicket && confirm("¿Desea imprimir en formato de Ticket Térmico de 80mm? (Pulse Cancelar para tamaño normal A4 o Carta)")) {
    document.body.classList.add('print-thermal');
    styleEl.innerHTML = `
      @media print {
        @page { size: 80mm auto; margin: 0; }
        .ticket-print { max-width: 80mm !important; padding: 5mm !important; }
        .ticket-print > div > div { display: block !important; } /* Romper flexbox para que apile */
        .ticket-print h1 { font-size: 1.1rem !important; text-align: center; }
        .ticket-print h2 { font-size: 1rem !important; text-align: center; margin-top: 10px !important; }
        .ticket-print p { font-size: 0.75rem !important; text-align: center; }
        .ticket-print table { font-size: 0.75rem !important; width: 100% !important; }
        .ticket-print .flex-1 { margin-bottom: 10px; }
      }
    `;
  } else {
    document.body.classList.remove('print-thermal');
    styleEl.innerHTML = `
      @media print {
        @page { size: letter; margin: 1cm; }
        .ticket-print { 
           zoom: 1.25; 
           max-width: 100% !important; 
           width: 100% !important;
        }
      }
    `;
  }
  
  // Pequeño delay para asegurar que el navegador repinte el CSS
  setTimeout(() => window.print(), 150);
};

/* ─────────────────────────────────────────────
   BOOTSTRAP
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  clearMockTransactions(); // Primero limpiar datos mock anteriores
  seedLocalStorage();       // Luego inicializar con arrays vacíos
  ensureLoginSection();

  const app = new App();
  // Exponer globalmente para depuración en consola del navegador
  window.__SIREC__ = app;

  await app.start();
});
