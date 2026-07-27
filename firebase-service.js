/* ==========================================================================
   SIREC - Servicio de Base de Datos e Integración de Firebase
   ========================================================================== */

// 1. ESPACIO RESERVADO PARA LA CONFIGURACIÓN DE FIREBASE
// Rellena estos campos al final para conectar la base de datos Firestore y Auth en la nube.
const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
  measurementId: ""
};

// Ecosistema de Servicios a inicializar
let app = null;
let db = null;
let auth = null;
let isFirebaseActive = false;

// Estado en memoria caché local (sincronizada)
let localPatients = [];
let localAppointments = [];
let localTriage = [];
let localConsultations = [];

// ==========================================================================
// 2. DETECCION Y CONFIGURACION DEL MODO DE OPERACION
// ==========================================================================
export const dbService = {
  
  async init(onReadyCallback) {
    // Si la apiKey ha sido provista, procedemos a cargar e inicializar Firebase Cloud
    if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "") {
      try {
        console.log("SIREC: Detectada configuración de Firebase. Conectando a servicios cloud...");
        
        // Importación dinámica de módulos Firebase SDK v10 (para evitar errores si no hay internet)
        const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
        const { getFirestore } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        const { getAuth } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
        
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        isFirebaseActive = true;
        
        console.log("SIREC: Conexión con Firebase establecida exitosamente. Operando en MODO CLOUD.");
      } catch (error) {
        console.error("SIREC: Error inicializando Firebase. Rebotando a Modo LocalStorage.", error);
        isFirebaseActive = false;
      }
    } else {
      console.log("SIREC: Sin credenciales en firebaseConfig. Operando en MODO LOCALSTORAGE (Persistencia local).");
      isFirebaseActive = false;
    }

    // Inicializar colecciones locales de respaldo/semilla
    this._loadLocalCollections();
    
    if (onReadyCallback) onReadyCallback();
  },

  isCloudActive() {
    return isFirebaseActive;
  },

  // Carga e inicialización de datos demo/persistidos en LocalStorage
  _loadLocalCollections() {
    // Pacientes Semilla
    if (!localStorage.getItem('sirec_patients')) {
      const demoPatients = [
        {
          dni: "0501-1988-10245",
          nombres: "Luis Alberto",
          apellidos: "Torres Peña",
          fechaNacimiento: "1988-04-12",
          genero: "Masculino",
          telefono: "9988-1234",
          correo: "luis.torres@gmail.com",
          direccion: "Barrio Los Andes, 7 Ave, San Pedro Sula",
          tipoSangre: "O+",
          contactoEmergencia: "Ana Torres - 9977-5544",
          alergias: "Penicilina"
        },
        {
          dni: "0801-1994-05112",
          nombres: "María Fernanda",
          apellidos: "Gómez Zelaya",
          fechaNacimiento: "1994-08-22",
          genero: "Femenino",
          telefono: "9566-7788",
          correo: "maria.gomez@yahoo.com",
          direccion: "Colonia Trejo, 23 Calle, San Pedro Sula",
          tipoSangre: "A+",
          contactoEmergencia: "Carlos Gómez - 3344-5566",
          alergias: "Ninguna"
        }
      ];
      localStorage.setItem('sirec_patients', JSON.stringify(demoPatients));
    }
    localPatients = JSON.parse(localStorage.getItem('sirec_patients'));

    // Citas Semilla
    if (!localStorage.getItem('sirec_appointments')) {
      const today = new Date().toISOString().split('T')[0];
      const demoAppointments = [
        {
          id: "TXN001",
          facturaNum: "FAC-0001",
          pacienteDni: "0501-1988-10245",
          pacienteNombre: "Luis Alberto Torres Peña",
          especialidad: "Cardiología",
          medico: "Dr. Roberto Pérez",
          fecha: today,
          hora: "09:00 - 09:30",
          monto: 250,
          metodoPago: "Tarjeta",
          observaciones: "Chequeo de rutina por presión",
          estado: "finalizado",
          timestamp: Date.now() - 7200000
        },
        {
          id: "TXN002",
          facturaNum: "FAC-0002",
          pacienteDni: "0801-1994-05112",
          pacienteNombre: "María Fernanda Gómez Zelaya",
          especialidad: "Dermatología",
          medico: "Dra. Lucía Santos",
          fecha: today,
          hora: "10:30 - 11:00",
          monto: 200,
          metodoPago: "Efectivo",
          observaciones: "Control de acné",
          estado: "espera_consulta",
          timestamp: Date.now() - 3600000
        }
      ];
      localStorage.setItem('sirec_appointments', JSON.stringify(demoAppointments));
    }
    localAppointments = JSON.parse(localStorage.getItem('sirec_appointments'));

    // Triajes Semilla
    if (!localStorage.getItem('sirec_triage')) {
      const demoTriage = [
        {
          citaId: "TXN001",
          pacienteDni: "0501-1988-10245",
          presion: "130/85",
          temperatura: 37.1,
          cardiaca: 82,
          respiratoria: 18,
          peso: 78.5,
          estatura: 172,
          imc: "26.5",
          oxigeno: 97,
          dolor: 4,
          timestamp: Date.now() - 5400000
        }
      ];
      localStorage.setItem('sirec_triage', JSON.stringify(demoTriage));
    }
    localTriage = JSON.parse(localStorage.getItem('sirec_triage'));

    // Consultas Semilla
    if (!localStorage.getItem('sirec_consultations')) {
      const demoConsultations = [
        {
          citaId: "TXN001",
          pacienteDni: "0501-1988-10245",
          motivo: "Palpitaciones y fatiga leve",
          diagnostico: "I10 - Hipertensión esencial (primaria)",
          sintomatologia: "Refiere disnea al subir escaleras.",
          antecedentes: "Padre con infarto a los 60 años.",
          medicamentos: [
            { farmaco: "Losartán 50mg", dosis: "1 tableta cada 24 horas", duracion: 30, expira: new Date().toISOString().split('T')[0] }
          ],
          tratamiento: "Reducir el consumo de sal. Ejercicio aeróbico moderado.",
          examenes: ["Perfil Lipídico", "Hemograma Completo"],
          privadas: "Paciente con alta ansiedad por síntomas.",
          timestamp: Date.now() - 7200000
        }
      ];
      localStorage.setItem('sirec_consultations', JSON.stringify(demoConsultations));
    }
    localConsultations = JSON.parse(localStorage.getItem('sirec_consultations'));
  },

  // ==========================================================================
  // 3. OPERACIONES DEL MÓDULO 1: REGISTRO DE PACIENTES
  // ==========================================================================
  
  async getPatients() {
    if (isFirebaseActive) {
      try {
        const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        const querySnapshot = await getDocs(collection(db, "pacientes"));
        const cloudPatients = [];
        querySnapshot.forEach(doc => {
          cloudPatients.push({ ...doc.data(), dni: doc.id });
        });
        localPatients = cloudPatients;
        localStorage.setItem('sirec_patients', JSON.stringify(localPatients));
        return cloudPatients;
      } catch (error) {
        console.error("Error obteniendo pacientes desde Firestore:", error);
        return localPatients;
      }
    } else {
      return localPatients;
    }
  },

  async savePatient(patient) {
    if (isFirebaseActive) {
      try {
        const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        // Se utiliza el DNI como el ID del documento para evitar duplicidades nativamente
        await setDoc(doc(db, "pacientes", patient.dni), patient);
        // Sincronizar local
        const idx = localPatients.findIndex(p => p.dni === patient.dni);
        if (idx !== -1) localPatients[idx] = patient;
        else localPatients.push(patient);
        localStorage.setItem('sirec_patients', JSON.stringify(localPatients));
        return true;
      } catch (error) {
        console.error("Error guardando paciente en Firestore:", error);
        throw error;
      }
    } else {
      localPatients.push(patient);
      localStorage.setItem('sirec_patients', JSON.stringify(localPatients));
      return true;
    }
  },

  // ==========================================================================
  // 4. OPERACIONES DEL MÓDULO 2: GESTIÓN DE CITAS Y CAJA
  // ==========================================================================
  
  async getAppointments() {
    if (isFirebaseActive) {
      try {
        const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        const querySnapshot = await getDocs(collection(db, "citas"));
        const cloudAppointments = [];
        querySnapshot.forEach(doc => {
          cloudAppointments.push({ ...doc.data(), id: doc.id });
        });
        localAppointments = cloudAppointments;
        localStorage.setItem('sirec_appointments', JSON.stringify(localAppointments));
        return cloudAppointments;
      } catch (error) {
        console.error("Error leyendo citas de Firestore:", error);
        return localAppointments;
      }
    } else {
      return localAppointments;
    }
  },

  async saveAppointment(appointment) {
    if (isFirebaseActive) {
      try {
        const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        await setDoc(doc(db, "citas", appointment.id), appointment);
        
        const idx = localAppointments.findIndex(a => a.id === appointment.id);
        if (idx !== -1) localAppointments[idx] = appointment;
        else localAppointments.push(appointment);
        localStorage.setItem('sirec_appointments', JSON.stringify(localAppointments));
        return true;
      } catch (error) {
        console.error("Error guardando cita en Firestore:", error);
        throw error;
      }
    } else {
      localAppointments.push(appointment);
      localStorage.setItem('sirec_appointments', JSON.stringify(localAppointments));
      return true;
    }
  },

  // ==========================================================================
  // 5. OPERACIONES DEL MÓDULO 3: MONITOR DE TRIAJE (TIEMPO REAL)
  // ==========================================================================
  
  // Listener reactivo en tiempo real para citas del día, opcionalmente filtradas por estado
  async listenToAppointments(onUpdateCallback, estado = null) {
    if (isFirebaseActive) {
      try {
        const { collection, query, where, onSnapshot } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        
        const constraints = [
          where("fecha", "==", new Date().toISOString().split('T')[0])
        ];
        if (estado) constraints.push(where("estado", "==", estado));
        const q = query(collection(db, "citas"), ...constraints);

        // Retorna la función de desuscripción
        return onSnapshot(q, (snapshot) => {
          const updatedApps = [];
          snapshot.forEach(doc => {
            updatedApps.push({ ...doc.data(), id: doc.id });
          });
          
          // Sincronizar cache local
          localAppointments = updatedApps;
          localStorage.setItem('sirec_appointments', JSON.stringify(localAppointments));
          
          onUpdateCallback(updatedApps);
        }, (error) => {
          console.error("Error en listener de Firestore para Triaje:", error);
        });
      } catch (error) {
        console.error("Error configurando listener de Firebase:", error);
      }
    } else {
      // Simulación local mediante sondeo de localStorage cada 2 segundos
      const intervalId = setInterval(() => {
        const today = new Date().toISOString().split('T')[0];
        localAppointments = JSON.parse(localStorage.getItem('sirec_appointments')) || [];
        onUpdateCallback(localAppointments.filter(a => a.fecha === today && (!estado || a.estado === estado)));
      }, 2000);

      // Retorna función de desuscripción simulada
      return () => clearInterval(intervalId);
    }
  },

  async saveTriage(triageRecord) {
    if (isFirebaseActive) {
      try {
        const { doc, setDoc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        // Guardar ficha de triaje
        await setDoc(doc(db, "triajes", triageRecord.citaId), triageRecord);
        
        // Actualizar estado de la cita para derivar al médico
        await updateDoc(doc(db, "citas", triageRecord.citaId), {
          estado: "espera_consulta"
        });

        // Sincronizar local
        localTriage.push(triageRecord);
        localStorage.setItem('sirec_triage', JSON.stringify(localTriage));
        
        const idx = localAppointments.findIndex(a => a.id === triageRecord.citaId);
        if (idx !== -1) localAppointments[idx].estado = "espera_consulta";
        localStorage.setItem('sirec_appointments', JSON.stringify(localAppointments));
        
        return true;
      } catch (error) {
        console.error("Error guardando Triaje en Firestore:", error);
        throw error;
      }
    } else {
      localTriage.push(triageRecord);
      localStorage.setItem('sirec_triage', JSON.stringify(localTriage));

      const idx = localAppointments.findIndex(a => a.id === triageRecord.citaId);
      if (idx !== -1) localAppointments[idx].estado = "espera_consulta";
      localStorage.setItem('sirec_appointments', JSON.stringify(localAppointments));
      return true;
    }
  },

  async getTriage() {
    if (isFirebaseActive) {
      try {
        const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        const querySnapshot = await getDocs(collection(db, "triajes"));
        const cloudTriage = [];
        querySnapshot.forEach(doc => {
          cloudTriage.push({ ...doc.data(), id: doc.id });
        });
        localTriage = cloudTriage;
        localStorage.setItem('sirec_triage', JSON.stringify(localTriage));
        return cloudTriage;
      } catch (error) {
        console.error("Error leyendo triajes de Firestore:", error);
        return localTriage;
      }
    } else {
      return localTriage;
    }
  },

  // ==========================================================================
  // 6. OPERACIONES DEL MÓDULO 4: CONSULTORIO E EXPEDIENTE
  // ==========================================================================
  
  async getConsultations() {
    if (isFirebaseActive) {
      try {
        const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        const querySnapshot = await getDocs(collection(db, "consultas"));
        const cloudConsultations = [];
        querySnapshot.forEach(doc => {
          cloudConsultations.push(doc.data());
        });
        localConsultations = cloudConsultations;
        localStorage.setItem('sirec_consultations', JSON.stringify(localConsultations));
        return cloudConsultations;
      } catch (error) {
        console.error("Error leyendo consultas de Firestore:", error);
        return localConsultations;
      }
    } else {
      return localConsultations;
    }
  },

  async saveConsultation(consultation) {
    if (isFirebaseActive) {
      try {
        const { doc, setDoc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        // Guardar consulta
        await setDoc(doc(db, "consultas", consultation.citaId), consultation);
        
        const idx = localAppointments.findIndex(a => a.id === consultation.citaId);
        const baseAmount = idx !== -1 ? parseFloat(localAppointments[idx].monto) || 0 : 0;
        const cargosServicios = consultation.cargosServicios || [
          { concepto: "Consulta médica", monto: baseAmount }
        ];
        const montoPendiente = cargosServicios.reduce((sum, cargo) => sum + (parseFloat(cargo.monto) || 0), 0);

        // Actualizar estado de la cita para cobro en Caja
        await updateDoc(doc(db, "citas", consultation.citaId), {
          estado: "pendiente_pago",
          cargosServicios,
          montoPendiente,
          monto: montoPendiente
        });

        // Sincronizar local
        localConsultations.push(consultation);
        localStorage.setItem('sirec_consultations', JSON.stringify(localConsultations));
        
        if (idx !== -1) {
          localAppointments[idx].estado = "pendiente_pago";
          localAppointments[idx].cargosServicios = cargosServicios;
          localAppointments[idx].montoPendiente = montoPendiente;
          localAppointments[idx].monto = montoPendiente;
        }
        localStorage.setItem('sirec_appointments', JSON.stringify(localAppointments));
        
        return true;
      } catch (error) {
        console.error("Error guardando consulta en Firestore:", error);
        throw error;
      }
    } else {
      localConsultations.push(consultation);
      localStorage.setItem('sirec_consultations', JSON.stringify(localConsultations));

      const idx = localAppointments.findIndex(a => a.id === consultation.citaId);
      const baseAmount = idx !== -1 ? parseFloat(localAppointments[idx].monto) || 0 : 0;
      const cargosServicios = consultation.cargosServicios || [
        { concepto: "Consulta médica", monto: baseAmount }
      ];
      const montoPendiente = cargosServicios.reduce((sum, cargo) => sum + (parseFloat(cargo.monto) || 0), 0);
      if (idx !== -1) {
        localAppointments[idx].estado = "pendiente_pago";
        localAppointments[idx].cargosServicios = cargosServicios;
        localAppointments[idx].montoPendiente = montoPendiente;
        localAppointments[idx].monto = montoPendiente;
      }
      localStorage.setItem('sirec_appointments', JSON.stringify(localAppointments));
      return true;
    }
  },

  async finalizePayment(citaId, paymentData = {}) {
    const updateFields = {
      estado: "finalizado",
      fechaPago: Date.now(),
      montoPagado: parseFloat(paymentData.monto) || 0,
      montoPendiente: 0,
      metodoPago: paymentData.metodoPago || "Efectivo"
    };

    if (isFirebaseActive) {
      try {
        const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        await updateDoc(doc(db, "citas", citaId), updateFields);
      } catch (error) {
        console.error("Error finalizando pago en Firestore:", error);
        throw error;
      }
    }

    const idx = localAppointments.findIndex(a => a.id === citaId);
    if (idx !== -1) localAppointments[idx] = { ...localAppointments[idx], ...updateFields };
    localStorage.setItem('sirec_appointments', JSON.stringify(localAppointments));
    return true;
  },

  // ==========================================================================
  // 7. SEGURIDAD Y CONTROL DE ACCESO (MOCK / FIREBASE AUTH)
  // ==========================================================================
  
  async loginUser(email, password) {
    if (isFirebaseActive) {
      try {
        const { signInWithEmailAndPassword } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return userCredential.user;
      } catch (error) {
        console.error("Error en login con Firebase Auth:", error);
        throw error;
      }
    } else {
      // Simulación de login exitoso local
      console.log(`Login simulado para ${email}`);
      return { email: email, uid: "mock-uid-123" };
    }
  }
};
