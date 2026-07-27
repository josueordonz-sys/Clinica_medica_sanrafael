/* ==========================================================================
   SIREC - Ruteador Virtual de la SPA (appRoutes.js)
   ========================================================================== */

export const ROUTES = {
  LOGIN:       'view-login',
  PACIENTES:   'view-pacientes',
  CITAS:       'view-citas',
  CAJA:        'view-caja',
  INVENTARIO:  'view-inventario',
  TRIAJE:      'view-triaje',
  CONSULTORIO: 'view-medico',
  USUARIOS:    'view-usuarios',
  ROLES:       'view-roles',
  OBJETOS:     'view-objetos',
  PERMISOS:    'view-permisos',
  DASHBOARD:   'view-dashboard'
};

// Mapa que relaciona el nombre del Objeto en la Base de Datos
// con las rutas internas (constantes) de la aplicación SPA.
export const OBJECT_ROUTE_MAP = {
  'Dashboard':       [ROUTES.DASHBOARD],
  'Pacientes':       [ROUTES.PACIENTES],
  'Citas':           [ROUTES.CITAS],
  'Consulta Médica': [ROUTES.CONSULTORIO],
  'Triaje':          [ROUTES.TRIAJE],
  'Facturación':     [ROUTES.CAJA],
  'Inventario':      [ROUTES.INVENTARIO],
  'Seguridad':       [ROUTES.USUARIOS, ROUTES.ROLES, ROUTES.OBJETOS, ROUTES.PERMISOS]
};

export class AppRouter {
  constructor() {
    this.currentRoute = ROUTES.PACIENTES;
    this.currentRole  = '';
    this.allowedRoutes = []; // Se llena dinámicamente al iniciar sesión
    this.onRouteChange = null;
    this.unsubscribeListener = null;
  }

  setRole(role) {
    this.currentRole = role;
  }

  /**
   * Recibe el arreglo de nombres de módulos desde la base de datos (ej. ['Dashboard', 'Pacientes'])
   * y los traduce a identificadores de ruta internos.
   */
  setAllowedModules(modulesArray) {
    let routes = [];
    if (Array.isArray(modulesArray)) {
      modulesArray.forEach(modName => {
        const mappedRoutes = OBJECT_ROUTE_MAP[modName];
        if (mappedRoutes) {
          routes = routes.concat(mappedRoutes);
        }
      });
    }
    // El login siempre es público si no hay sesión
    this.allowedRoutes = routes;
  }

  canAccess(route) {
    // Si no se han seteado rutas aún (p.ej. no logueado)
    if (this.allowedRoutes.length === 0) return false;
    return this.allowedRoutes.includes(route);
  }

  /**
   * Navega a una vista.
   * @param {string} route - Una de las constantes ROUTES.*
   * @param {object} context - Datos opcionales a pasar a la vista destino
   */
  navigate(route, context = {}) {
    if (!this.canAccess(route)) {
      console.warn(`[AppRouter] Acceso denegado a "${route}" para el rol "${this.currentRole}".`);
      // Redirigir al primer destino permitido para este usuario
      const fallback = this.allowedRoutes[0];
      if (fallback) this.navigate(fallback);
      return;
    }

    this.currentRoute = route;

    // Liberar listener activo si se abandona Triaje / Consultorio
    if (this.unsubscribeListener &&
        route !== ROUTES.TRIAJE && route !== ROUTES.CONSULTORIO) {
      this.unsubscribeListener();
      this.unsubscribeListener = null;
    }

    if (typeof this.onRouteChange === 'function') {
      this.onRouteChange(route, context);
    }
  }

  /** Devuelve las rutas accesibles dinámicas para la sesión actual */
  getAccessibleRoutes() {
    return this.allowedRoutes;
  }
}
