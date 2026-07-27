/* ==========================================================================
   SIREC - Servicio de Firestore (firestoreService.js)
   ========================================================================== */

import { firebaseConfig } from '../config/firebase.js';

let app = null;
let db = null;
let isFirebaseActive = false;
const API_BASE_URL = 'http://localhost:3000/api';

// Memoria caché local
let cache = {
  pacientes: [],
  citas: [],
  triajes: [],
  consultas: [],
  pagos: [],
  medicamentos: []
};

export const firestoreService = {
  
  async init() {
    if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "") {
      try {
        const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
        const { getFirestore } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        isFirebaseActive = true;
        console.log("SIREC: Conectado a Firestore Cloud con éxito.");
      } catch (err) {
        console.error("SIREC: Error conectando a Firebase Firestore Cloud. Usando almacenamiento local.", err);
        isFirebaseActive = false;
      }
    } else {
      console.log("SIREC: Operando base de datos en modo LocalStorage.");
      isFirebaseActive = false;
    }

    this._loadLocalStorageFallback();
  },

  isCloud() {
    return isFirebaseActive;
  },

  getDbInstance() {
    return db;
  },

  _endpointFor(localKey) {
    const endpoints = {
      pacientes: 'pacientes',
      citas: 'citas',
      triajes: 'triajes',
      consultas: 'consultas',
      pagos: 'pagos',
      medicamentos: 'medicamentos'
    };

    return endpoints[localKey] || localKey;
  },

  async _apiRequest(localKey, options = {}) {
    const endpoint = this._endpointFor(localKey);
    const response = await fetch(`${API_BASE_URL}/${endpoint}${options.path || ''}`, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Error HTTP ${response.status}`);
    }

    if (response.status === 204) return null;
    return await response.json();
  },

  _loadLocalStorageFallback() {
    cache.pacientes = JSON.parse(localStorage.getItem('sirec_patients')) || [];
    const citas = JSON.parse(localStorage.getItem('sirec_citas')) || [];
    const appointments = JSON.parse(localStorage.getItem('sirec_appointments')) || [];
    cache.citas = citas.length > 0 ? citas : appointments;
    this._syncCollectionAliases('citas', cache.citas);
    cache.triajes = JSON.parse(localStorage.getItem('sirec_triage')) || [];
    cache.consultas = JSON.parse(localStorage.getItem('sirec_consultations')) || [];
    cache.pagos = JSON.parse(localStorage.getItem('sirec_pagos')) || [];
    cache.medicamentos = JSON.parse(localStorage.getItem('sirec_medicamentos')) || [];
  },

  _syncLocal(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  },

  _syncCollectionAliases(localKey, data) {
    if (localKey === 'citas') {
      localStorage.setItem('sirec_citas', JSON.stringify(data));
      localStorage.setItem('sirec_appointments', JSON.stringify(data));
      return;
    }
    this._syncLocal(`sirec_${localKey}`, data);
  },

  // Operaciones de lectura y escritura genéricas
  async getAll(collectionName, localKey) {
    if (isFirebaseActive) {
      try {
        const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        const querySnapshot = await getDocs(collection(db, collectionName));
        const list = [];
        querySnapshot.forEach(doc => {
          list.push({ ...doc.data(), id: doc.id });
        });
        cache[localKey] = list;
        this._syncCollectionAliases(localKey, list);
        return list;
      } catch (err) {
        console.error(`Error leyendo de Firestore en ${collectionName}:`, err);
        return cache[localKey];
      }
    } else {
      try {
        const list = await this._apiRequest(localKey);
        cache[localKey] = Array.isArray(list) ? list : [];
        this._syncCollectionAliases(localKey, cache[localKey]);
        return cache[localKey];
      } catch (err) {
        console.error(`Error leyendo API MySQL en ${localKey}:`, err);
        return cache[localKey];
      }
    }
  },

  async set(collectionName, documentId, data, localKey) {
    if (isFirebaseActive) {
      try {
        const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        await setDoc(doc(db, collectionName, documentId), data);
        
        if (!cache[localKey]) cache[localKey] = [];
        const idx = cache[localKey].findIndex(item => (item.id === documentId || item.dni === documentId || item.txnId === documentId));
        if (idx !== -1) cache[localKey][idx] = { ...data, id: documentId };
        else cache[localKey].push({ ...data, id: documentId });
        
        this._syncCollectionAliases(localKey, cache[localKey]);
        return true;
      } catch (err) {
        console.error(`Error grabando en Firestore en ${collectionName}:`, err);
        throw err;
      }
    } else {
      const saved = await this._apiRequest(localKey, {
        method: 'POST',
        body: data
      });

      if (!cache[localKey]) cache[localKey] = [];
      const savedId = saved?.id || saved?.dni || saved?.citaId || saved?.txnId || documentId;
      const idx = cache[localKey].findIndex(item =>
        item.id === savedId ||
        item.dni === savedId ||
        item.citaId === savedId ||
        item.txnId === savedId ||
        item.id === documentId ||
        item.dni === documentId ||
        item.citaId === documentId ||
        item.txnId === documentId
      );
      const merged = { ...data, ...(saved || {}) };
      if (idx !== -1) cache[localKey][idx] = merged;
      else cache[localKey].push(merged);

      this._syncCollectionAliases(localKey, cache[localKey]);
      return true;
    }
  },

  async update(collectionName, documentId, updateFields, localKey) {
    if (isFirebaseActive) {
      try {
        const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        await updateDoc(doc(db, collectionName, documentId), updateFields);
        
        if (!cache[localKey]) cache[localKey] = [];
        const idx = cache[localKey].findIndex(item => (item.id === documentId || item.dni === documentId || item.txnId === documentId));
        if (idx !== -1) cache[localKey][idx] = { ...cache[localKey][idx], ...updateFields };
        
        this._syncCollectionAliases(localKey, cache[localKey]);
        return true;
      } catch (err) {
        console.error(`Error actualizando en Firestore en ${collectionName}:`, err);
        throw err;
      }
    } else {
      await this._apiRequest(localKey, {
        method: 'PUT',
        path: `/${encodeURIComponent(documentId)}`,
        body: updateFields
      });

      if (!cache[localKey]) cache[localKey] = [];
      const idx = cache[localKey].findIndex(item => (item.id === documentId || item.dni === documentId || item.citaId === documentId || item.txnId === documentId));
      if (idx !== -1) {
        cache[localKey][idx] = { ...cache[localKey][idx], ...updateFields };
        this._syncCollectionAliases(localKey, cache[localKey]);
      }
      return true;
    }
  },

  async delete(collectionName, documentId, localKey) {
    if (isFirebaseActive) {
      try {
        const { doc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        await deleteDoc(doc(db, collectionName, documentId));
        
        if (!cache[localKey]) cache[localKey] = [];
        cache[localKey] = cache[localKey].filter(item => item.id !== documentId && item.dni !== documentId && item.txnId !== documentId);
        
        this._syncCollectionAliases(localKey, cache[localKey]);
        return true;
      } catch (err) {
        console.error(`Error eliminando en Firestore en ${collectionName}:`, err);
        throw err;
      }
    } else {
      await this._apiRequest(localKey, {
        method: 'DELETE',
        path: `/${encodeURIComponent(documentId)}`
      });

      if (!cache[localKey]) cache[localKey] = [];
      cache[localKey] = cache[localKey].filter(item => item.id !== documentId && item.dni !== documentId && item.citaId !== documentId && item.txnId !== documentId);
      this._syncCollectionAliases(localKey, cache[localKey]);
      
      return true;
    }
  }
};
