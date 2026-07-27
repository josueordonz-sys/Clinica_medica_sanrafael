
# SIREC - Sistema de Registro y Control de Citas
### Clínica Médica San Rafael, San Pedro Sula

Este repositorio contiene la implementación del **Sistema de Registro y Control de Citas (SIREC)** bajo una arquitectura desacoplada **Cliente-Servidor (MVC)** con soporte **Backend as a Service (BaaS)** mediante **Firebase**.

## 📂 Estructura del Proyecto

El sistema está organizado según el siguiente estándar organizativo:

- `public/`: Contiene el punto de entrada HTML (`index.html`) y recursos estáticos del navegador.
- `src/assets/`: Hojas de estilos premium (`estilos.css`) y recursos visuales.
- `src/config/`: Ajustes de inicialización del SDK de Firebase (`firebase.js`).
- `src/models/`: Estructura lógica y esquemas documentales de base de datos (`pacienteModel`, `citaModel`, etc.).
- `src/controllers/`: Controladores encargados de la lógica de negocio y validación de entrada.
- `src/views/`: Controladores de renderizado visual modular por pantalla.
- `src/services/`: Capas de servicios cloud para Base de datos (Firestore), Autenticación (Auth) y Mensajería (Notification).
- `src/routes/`: Ruteador virtual dinámico para la navegación interna en la SPA.
- `src/App.js`: Orquestador y despachador del estado global del sistema.
- `src/main.js`: Inicializador principal del ciclo de vida del DOM.

## 🚀 Despliegue y Ejecución

1. **Prueba Local**: Abra el archivo `public/index.html` en cualquier navegador web moderno.
2. **Conexión a Firebase**: Configure sus credenciales en `src/config/firebase.js`.
3. **Subida a Producción**: Ejecute `npx -y firebase-tools@latest deploy` desde este directorio raíz.
