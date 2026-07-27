/* ==========================================================================
   SIREC - Servicio de Sincronización en Tiempo Real (notificationService.js)
   ========================================================================== */

import { firestoreService } from './firestoreService.js';

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const notificationService = {
  
  async listenToAppointments(onUpdateCallback, estado = null) {
    const isCloud = firestoreService.isCloud();
    const db = firestoreService.getDbInstance();

    if (isCloud && db) {
      try {
        const { collection, query, where, onSnapshot } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        
        const today = getLocalDateString();
        const constraints = [where("fecha", "==", today)];
        if (estado) constraints.push(where("estado", "==", estado));
        const q = query(collection(db, "citas"), ...constraints);

        return onSnapshot(q, (snapshot) => {
          const list = [];
          snapshot.forEach(doc => {
            list.push({ ...doc.data(), id: doc.id });
          });
          onUpdateCallback(list);
        });
      } catch (err) {
        console.error("Error inicializando onSnapshot en notificationService:", err);
      }
    } else {
      // Fallback MySQL/local: consulta la capa de datos cada 1.5s
      const intervalId = setInterval(async () => {
        const today = getLocalDateString();
        const appointments = await firestoreService.getAll('citas', 'citas');
        const localList = appointments
          .filter(a => a.fecha === today && (!estado || a.estado === estado));
        onUpdateCallback(localList);
      }, 1500);

      return () => clearInterval(intervalId);
    }
  }
};
