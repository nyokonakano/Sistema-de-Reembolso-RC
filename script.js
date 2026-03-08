import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, where, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// CONFIGURACIÓN DE FIREBASE - REEMPLAZA CON TUS CREDENCIALES
const firebaseConfig = {
    apiKey: "AIzaSyB40AsFDc3mDU7DzXe4fwS2IX4uwP3SHVQ",
    authDomain: "sistema-de-reembolsos-rc.firebaseapp.com",
    projectId: "sistema-de-reembolsos-rc",
    storageBucket: "sistema-de-reembolsos-rc.firebasestorage.app",
    messagingSenderId: "919633406296",
    appId: "1:919633406296:web:94ee02ec2d987900a41d2d"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Variables globales
window.auth = auth;
window.db = db;
window.currentUser = null;

let isDropdownOpen = false;
let tasas = [];
let tasasSeleccionadas = new Set();
let plantillasPersonalizadas = [];
let tiposPlantilla = [];
let plantillaEnEdicion = null;
let periodos = [2024];
let periodoActual = 2024;

// Esta función guarda cada acción importante en la colección 'auditLog' de Firestore.

async function registrarAudit(tipo, descripcion) {
  if (!window.currentUser) return;
  try {
    await addDoc(collection(db, 'auditLog'), {
      tipo,
      usuario:   window.currentUser.email,
      descripcion,
      timestamp: new Date()
    });
  } catch(e) { /* silencioso — el audit no debe romper el flujo */ }
}

// ════════════════════════════════════════════════════
// CONFIGURACIÓN DE EMAILJS
// ════════════════════════════════════════════════════

const EMAILJS_PUBLIC_KEY = "GfmZx1aPP8OsPet2s";
const EMAILJS_SERVICE_ID = "service_m69ttdv";
const EMAILJS_TEMPLATE_ID = "template_3gkkotm";

// Inicializar EmailJS
(function() {
  emailjs.init({
    publicKey: EMAILJS_PUBLIC_KEY,
  });
})();

//VARIABLES PARA FILTROS
let filtrosBusqueda = {
    plantillas: '',
    tipoPlantilla: '',
    tasas: ''
};
// variable de reemboso
let tipoTasaActual = 'reembolsable'; // 'reembolsable' o 'no-reembolsable'

const plantillasPredeterminadas = [
    {
    id: 'default1',
    nombre: 'Reembolso Completo',
    tipo: 'reembolso',
    contenido: `RC REFUND TAXAS
SE SOLICITA REEMBOLSO DE IMPUESTOS.
RUTA: {RUTA}
REEMBOLSO SOLO TAXAS - NO SE ENVIA NOTA DE CREDITO.
DATOS/CE2{CE2}
soportereembolsos@ContinentalTravel.com.pe`,
    predeterminada: true
    },
    {
    id: 'default2',
    nombre: 'Reembolso Estándar',
    tipo: 'reembolso',
    contenido: `SE SOLICITA REEMBOLSO DE IMPUESTOS.
RUTA: {RUTA}
REEMBOLSO SOLO TAXAS - NO SE ENVIA NOTA DE CREDITO.
DATOS/CE2{CE2}
soportereembolsos@ContinentalTravel.com.pe`,
    predeterminada: true
    }
];

// AUTH
window.login = async function() {
    const email = document.getElementById('emailInput').value;
    const password = document.getElementById('passwordInput').value;
    const errorDiv = document.getElementById('authError');
    
    try {
    await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
    errorDiv.textContent = getErrorMessage(error.code);
    errorDiv.style.display = 'block';
    }
};

window.register = async function() {
    const email = document.getElementById('emailInput').value;
    const password = document.getElementById('passwordInput').value;
    const errorDiv = document.getElementById('authError');
    
    if (password.length < 6) {
    errorDiv.textContent = 'La contraseña debe tener al menos 6 caracteres';
    errorDiv.style.display = 'block';
    return;
    }
    
    try {
    await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
    errorDiv.textContent = getErrorMessage(error.code);
    errorDiv.style.display = 'block';
    }
};

window.logout = async function() {
    try {
      await registrarAudit('logout', 'Cerró sesión en el sistema');
      await signOut(auth);
    } catch (error) {
    mostrarNotificacion('Error al cerrar sesión');
    }
};

async function actualizarPresencia(email, online) {
  try {
    const q = query(collection(db, 'perfiles'), where('email', '==', email));
    const snap = await getDocs(q);
    if (!snap.empty) {
      await updateDoc(doc(db, 'perfiles', snap.docs[0].id), {
        online,
        lastSeen: new Date()
      });
    } else {
      // Primera vez — crear perfil con rol viewer por defecto
      await addDoc(collection(db, 'perfiles'), {
        email,
        rol:       'user',
        estado:    'active',
        online,
        lastSeen:  new Date(),
        createdAt: new Date()
      });
    }
  } catch(e) { console.error('Presencia error:', e); }
}

function getErrorMessage(code) {
    const messages = {
    'auth/email-already-in-use': 'Este email ya está registrado',
    'auth/invalid-email': 'Email inválido',
    'auth/user-not-found': 'Usuario no encontrado',
    'auth/wrong-password': 'Contraseña incorrecta',
    'auth/weak-password': 'Contraseña muy débil',
    'auth/too-many-requests': 'Demasiados intentos. Intenta más tarde'
    };
    return messages[code] || 'Error al autenticar';
}

//VERIFICAR ROL DE USUARIO PARA MOSTRAR BOTÓN DE ADMIN
async function verificarRolAdmin(email) {
  try {
    const q = query(collection(db, 'perfiles'), where('email', '==', email));
    const snap = await getDocs(q);
    
    if (!snap.empty && snap.docs[0].data().rol === 'admin') {
      const btn = document.getElementById('adminPanelBtn');
      if (btn) btn.style.display = 'inline-block';
    }
  } catch(e) {
    console.error('Error al verificar rol:', e);
  }
}

// Auth State Observer
onAuthStateChanged(auth, async (user) => {
    document.getElementById('loadingContainer').style.display = 'none';
    
    if (user) {
      iniciarNotificaciones(user.email);

      await registrarAudit('login', 'Inició sesión en el sistema');
      
      window.currentUser = user;
      document.getElementById('authContainer').style.display = 'none';
      document.getElementById('appContainer').style.display = 'block';
      document.getElementById('userEmail').textContent = user.email;
      
      await actualizarPresencia(window.currentUser.email, true);
      window.addEventListener('beforeunload', () => {
        actualizarPresencia(window.currentUser.email, false);
      });

      await cargarDatosFirebase();
      verificarRolAdmin(user.email);
      generarCE2();
      renderizarTodasLasPlantillas();
    } else {
      
      window.currentUser = null;
      document.getElementById('authContainer').style.display = 'block';
      document.getElementById('appContainer').style.display = 'none';
    }
});

// FIRESTORE FUNCTIONS
async function cargarDatosFirebase() {
    try {
    //CARGAR DATOS INICIALES
    await Promise.all([
        cargarPeriodos(),
        cargarTasas(),
        cargarPlantillas(),
        cargarTipos()
    ]);
    
    //ACTIVAR LISTENERS
    activarListenersRealTime();
    } catch (error) {
    console.error('ERROR AL CARGAR DATOS: ', error);
    mostrarNotificacion('ERROR AL CARGAR DATOS')
    }
}

// LISTENERS EN TIEMPO REAL
function activarListenersRealTime() {
    // Listener para TASAS
    onSnapshot(collection(db, 'tasas'), (snapshot) => {
    tasas = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
    renderizarTasas();
    actualizarSuma();
    });
    
    // Listener para PLANTILLAS
    onSnapshot(collection(db, 'plantillas'), (snapshot) => {
        plantillasPersonalizadas = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            predeterminada: false
        }));
        
        // ORDENAR por el campo 'orden'
        plantillasPersonalizadas.sort((a, b) => {
            const ordenA = a.orden !== undefined ? a.orden : 999999;
            const ordenB = b.orden !== undefined ? b.orden : 999999;
            return ordenA - ordenB;
        });
        
        renderizarTodasLasPlantillas();
    });
        
    // Listener para PERÍODOS
    onSnapshot(collection(db, 'periodos'), (snapshot) => {
    if (!snapshot.empty) {
        periodos = snapshot.docs[0].data().periodos || [new Date().getFullYear()];
        window.periodoDocId = snapshot.docs[0].id;
        renderizarBotonesPeriodo();
        actualizarSelectPeriodo();
    }
    });
    
    // Listener para TIPOS
    onSnapshot(collection(db, 'tipos'), (snapshot) => {
    if (!snapshot.empty) {
        tiposPlantilla = snapshot.docs[0].data().tipos || ['reembolso', 'reenvio', 'waiver'];
        window.tiposDocId = snapshot.docs[0].id;
        actualizarSelectTipos();
    }
    });
}

// PERÍODOS
async function cargarPeriodos() {
    const snapshot = await getDocs(collection(db, 'periodos'));

    if (snapshot.empty) {
    const anioActual = new Date().getFullYear();
    periodos = [anioActual];
    periodoActual = anioActual;
    const docRef = await addDoc(collection(db, 'periodos'), {
        periodos: periodos,
        createdBy: currentUser.email,
        createdAt: new Date()
    });
    window.periodoDocId = docRef.id;
    } else {
    periodos = snapshot.docs[0].data().periodos || [new Date().getFullYear()];
    periodoActual = periodos[0];
    window.periodoDocId = snapshot.docs[0].id;
    }
    
    renderizarBotonesPeriodo();
    actualizarSelectPeriodo();
}

window.agregarPeriodo = async function() {
    const input = document.getElementById('nuevoPeriodoInput');
    const nuevoPeriodo = parseInt(input.value);
    
    if (!nuevoPeriodo || nuevoPeriodo < 2000 || nuevoPeriodo > 2100) {
    mostrarNotificacion('Por favor ingresa un año válido');
    return;
    }
    
    if (periodos.includes(nuevoPeriodo)) {
    mostrarNotificacion('Este año ya existe');
    return;
    }
    
    periodos.push(nuevoPeriodo);
    periodos.sort((a, b) => b - a);
    
    await updateDoc(doc(db, 'periodos', window.periodoDocId), {
    periodos: periodos,
    lastModifiedBy: currentUser.email,
    lastModifiedAt: new Date()
    });
    
    renderizarBotonesPeriodo();
    actualizarSelectPeriodo();
    renderizarListaPeriodos();
    input.value = '';
    mostrarNotificacion('Año agregado correctamente ✓');
};

window.eliminarPeriodo = async function(periodo) {
    if (periodos.length <= 1) {
mostrarNotificacion('Debe haber al menos un año');
return;
    }

    const tasasDelPeriodo = tasas.filter(t => t.periodo === periodo);
    if (tasasDelPeriodo.length > 0) {
    if (!confirm(`Este año tiene ${tasasDelPeriodo.length} tasa(s). ¿Deseas eliminarlo de todos modos?`)) {
        return;
    }
    }
    
    periodos = periodos.filter(p => p !== periodo);
    
    if (periodoActual === periodo) {
    periodoActual = periodos[0];
    }
    
    await updateDoc(doc(db, 'periodos', window.periodoDocId), {
    periodos: periodos,
    lastModifiedBy: currentUser.email,
    lastModifiedAt: new Date()
    });
    
    renderizarBotonesPeriodo();
    actualizarSelectPeriodo();
    renderizarListaPeriodos();
    renderizarTasas();
    mostrarNotificacion('Año eliminado correctamente ✓');
};

// TASAS
async function cargarTasas() {
    const snapshot = await getDocs(collection(db, 'tasas'));
    
    tasas = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
    
    renderizarTasas();
}

window.agregarTasa = async function() {
  const noReembolsable = document.getElementById('noReembolsableCheckbox').checked;
  const comentario = document.getElementById('comentarioTasaInput').value.trim();
  
  let nombre, monto, periodo;
  
  if (noReembolsable) {
    // Tasa No Reembolsable (solo nombre)
    nombre = document.getElementById('nombreTasaNoReembolsableInput').value.trim();
    monto = 0; // Sin monto
    periodo = 0; // Sin año específico
    
    if (!nombre) {
      mostrarNotificacion('Ingresa el nombre de la tasa');
      return;
    }
  } else {
    // Tasa Reembolsable (nombre, monto, año)
    nombre = document.getElementById('nombreTasaInput').value.trim();
    monto = document.getElementById('montoTasaInput').value.trim();
    periodo = parseInt(document.getElementById('periodoTasaInput').value);
    
    if (!nombre || !monto) {
      mostrarNotificacion('Completa todos los campos');
      return;
    }
    
    monto = parseFloat(monto);
  }

  try {
    await addDoc(collection(db, 'tasas'), {
      nombre: nombre,
      monto: monto,
      periodo: periodo,
      noReembolsable: noReembolsable,
      comentario: comentario || '',
      createdBy: currentUser.email,
      createdAt: new Date()
    });

    await registrarAudit('tasa', `Agregó tasa: "${nombre}" ${noReembolsable ? '(no reembolsable)' : `$${monto}`}`);

    // Limpiar campos
    if (noReembolsable) {
      document.getElementById('nombreTasaNoReembolsableInput').value = '';
    } else {
      document.getElementById('nombreTasaInput').value = '';
      document.getElementById('montoTasaInput').value = '';
    }
    document.getElementById('noReembolsableCheckbox').checked = false;
    document.getElementById('comentarioTasaInput').value = '';
    toggleCamposTasa(); // Resetear vista
    
    mostrarNotificacion(`Tasa ${noReembolsable ? 'no reembolsable' : 'reembolsable'} agregada ✓`);
  } catch (error) {
    console.error('Error:', error);
    mostrarNotificacion('Error al agregar tasa');
  }
};

window.eliminarTasa = async function(id) {
    try {
    await deleteDoc(doc(db, 'tasas', id));
      await registrarAudit('tasa', `Eliminó tasa id: ${id}`);
      mostrarNotificacion('Tasa eliminada correctamente ✓');
    } catch (error) {
      await registrarAudit('tasa', `Error al eliminar tasa id: ${id}`);
      mostrarNotificacion('Error al eliminar tasa');
    }
};

window.abrirModalEditarTasa = function(tasa) {
  const esNoReembolsable = tasa.noReembolsable;
  
  const modal = document.createElement('div');
  modal.className = 'modal show';
  modal.id = 'modalEditarTasa';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <div class="modal-title">Editar Tasa</div>
        <button class="modal-close" onclick="cerrarModalEditarTasa()">×</button>
      </div>
      <div class="add-tasa-form">
        <div class="form-row" style="grid-template-columns: 1fr; margin-bottom: 12px;">
          <label class="checkbox-label-tasa">
            <input type="checkbox" id="editNoReembolsable" ${esNoReembolsable ? 'checked' : ''} onchange="toggleCamposEditarTasa()">
            <span>🚫 Marcar como No Reembolsable</span>
          </label>
        </div>
        
        <!-- Campos para tasa reembolsable -->
        <div id="editCamposReembolsable" style="display: ${esNoReembolsable ? 'none' : 'block'};">
          <div class="form-row" style="grid-template-columns: 1fr;">
            <input 
              type="text" 
              id="editNombreTasa" 
              class="form-input" 
              placeholder="Nombre de la tasa"
              value="${esNoReembolsable ? '' : tasa.nombre}"
            >
          </div>
          <div class="form-row" style="grid-template-columns: 1fr 1fr;">
            <input 
              type="number" 
              id="editMontoTasa" 
              class="form-input" 
              placeholder="Monto ($)"
              step="0.01"
              value="${esNoReembolsable ? '' : tasa.monto}"
            >
            <select id="editPeriodoTasa" class="form-input">
              ${periodos.map(p => `<option value="${p}" ${p === tasa.periodo ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
          </div>
        </div>
        
        <!-- Campos para tasa no reembolsable -->
        <div id="editCamposNoReembolsable" style="display: ${esNoReembolsable ? 'block' : 'none'};">
          <div class="form-row" style="grid-template-columns: 1fr;">
            <input 
              type="text" 
              id="editNombreTasaNoReembolsable" 
              class="form-input" 
              placeholder="Nombre de la tasa no reembolsable"
              value="${esNoReembolsable ? tasa.nombre : ''}"
            >
          </div>
        </div>
        
        <div class="form-row" style="grid-template-columns: 1fr; margin-top: 12px;">
          <textarea 
            id="editComentarioTasa" 
            class="form-input" 
            placeholder="Comentario u observación (opcional)..."
            rows="3"
            style="resize: vertical; font-family: inherit;"
          >${tasa.comentario || ''}</textarea>
        </div>
        <button class="add-btn" onclick="guardarEdicionTasa('${tasa.id}')">
          Guardar Cambios
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
};

window.toggleCamposEditarTasa = function() {
  const noReembolsable = document.getElementById('editNoReembolsable').checked;
  const camposReembolsable = document.getElementById('editCamposReembolsable');
  const camposNoReembolsable = document.getElementById('editCamposNoReembolsable');
  
  if (noReembolsable) {
    camposReembolsable.style.display = 'none';
    camposNoReembolsable.style.display = 'block';
  } else {
    camposReembolsable.style.display = 'block';
    camposNoReembolsable.style.display = 'none';
  }
};

window.cerrarModalEditarTasa = function() {
    const modal = document.getElementById('modalEditarTasa');
    if (modal) modal.remove();
};

window.guardarEdicionTasa = async function(id) {
  const noReembolsable = document.getElementById('editNoReembolsable').checked;
  const comentario = document.getElementById('editComentarioTasa').value.trim();
  
  let nombre, monto, periodo;
  
  if (noReembolsable) {
    nombre = document.getElementById('editNombreTasaNoReembolsable').value.trim();
    monto = 0;
    periodo = 0;
    
    if (!nombre) {
      mostrarNotificacion('Ingresa el nombre de la tasa');
      return;
    }
  } else {
    nombre = document.getElementById('editNombreTasa').value.trim();
    monto = parseFloat(document.getElementById('editMontoTasa').value);
    periodo = parseInt(document.getElementById('editPeriodoTasa').value);
    
    if (!nombre || !monto) {
      mostrarNotificacion('Completa todos los campos');
      return;
    }
  }
  
  try {
    await updateDoc(doc(db, 'tasas', id), {
      nombre: nombre,
      monto: monto,
      periodo: periodo,
      noReembolsable: noReembolsable,
      comentario: comentario || '',
      lastModifiedBy: currentUser.email,
      lastModifiedAt: new Date()
    });

    await registrarAudit('edit', `Editó tasa: "${nombre}"`);

    cerrarModalEditarTasa();
    mostrarNotificacion('Tasa actualizada ✓');
  } catch (error) {
    mostrarNotificacion('Error al actualizar tasa');
  }
};

// PLANTILLAS
async function cargarPlantillas() {
    const snapshot = await getDocs(collection(db, 'plantillas'));
    plantillasPersonalizadas = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        predeterminada: false
    }));
    
    // Ordenar por el campo 'orden' si existe
    plantillasPersonalizadas.sort((a, b) => {
        const ordenA = a.orden !== undefined ? a.orden : 999;
        const ordenB = b.orden !== undefined ? b.orden : 999;
        return ordenA - ordenB;
    });
    
    renderizarTodasLasPlantillas();
}

window.agregarPlantillaPersonalizada = async function() {
    const nombre = document.getElementById('nombrePlantillaInput').value.trim();
    const contenido = document.getElementById('contenidoPlantillaInput').value.trim();
    const tipo = document.getElementById('tipoPlantillaSelect').value;

    if (!nombre || !contenido) {
        mostrarNotificacion('Por favor completa todos los campos');
        return;
    }

    // Calcular el orden más alto actual
    const maxOrden = plantillasPersonalizadas.length > 0 
        ? Math.max(...plantillasPersonalizadas.map(p => p.orden !== undefined ? p.orden : 0))
        : -1;

    await addDoc(collection(db, 'plantillas'), {
        nombre: nombre,
        tipo: tipo,
        contenido: contenido,
        orden: maxOrden + 1,  // ✅ Asignar orden
        createdBy: currentUser.email,
        createdAt: new Date()
    });

    await registrarAudit('plantilla', `Creó plantilla: "${nombre}"`);

    document.getElementById('nombrePlantillaInput').value = '';
    document.getElementById('contenidoPlantillaInput').value = '';
    mostrarNotificacion('Plantilla agregada correctamente ✓');
    cambiarTab('plantillas');
};

window.eliminarPlantillaPersonalizada = async function(id) {
    if (!confirm('¿Eliminar esta plantilla?')) return;

    try {
      await deleteDoc(doc(db, 'plantillas', id));
      await registrarAudit('plantilla', `Eliminó plantilla id: ${id}`);
      mostrarNotificacion('Plantilla eliminada correctamente ✓');
    } catch (error) {
      await registrarAudit('plantilla', `Error al eliminar plantilla id: ${id}`);
      mostrarNotificacion('Error al eliminar plantilla');
    }
};

window.guardarEdicionPlantilla = async function() {
    const nombre = document.getElementById('nombrePlantillaInput').value.trim();
    const contenido = document.getElementById('contenidoPlantillaInput').value.trim();
    const tipo = document.getElementById('tipoPlantillaSelect').value;

    if (!nombre || !contenido) {
        mostrarNotificacion('Por favor completa todos los campos');
        return;
    }

    // Calcular el orden más alto actual
    const maxOrden = plantillasPersonalizadas.length > 0 
        ? Math.max(...plantillasPersonalizadas.map(p => p.orden !== undefined ? p.orden : 0))
        : -1;

    await addDoc(collection(db, 'plantillas'), {
        nombre: nombre,
        tipo: tipo,
        contenido: contenido,
        orden: maxOrden + 1,  // Asignar orden
        createdBy: currentUser.email,
        createdAt: new Date()
    });

    await registrarAudit('edit', `Editó plantilla: "${plantillaEnEdicion?.nombre}"`);

    document.getElementById('nombrePlantillaInput').value = '';
    document.getElementById('contenidoPlantillaInput').value = '';
    mostrarNotificacion('Plantilla agregada correctamente ✓');
    cambiarTab('plantillas');
};

// TIPOS
async function cargarTipos() {
    const snapshot = await getDocs(collection(db, 'tipos'));

    if (snapshot.empty) {
    tiposPlantilla = ['reembolso', 'reenvio', 'waiver'];
    const docRef = await addDoc(collection(db, 'tipos'), {
        tipos: tiposPlantilla,
        createdBy: currentUser.email,
        createdAt: new Date()
    });
    window.tiposDocId = docRef.id;
    } else {
    tiposPlantilla = snapshot.docs[0].data().tipos || ['reembolso', 'reenvio', 'waiver'];
    window.tiposDocId = snapshot.docs[0].id;
    }
    
    actualizarSelectTipos();
}

window.agregarTipo = async function() {
    const input = document.getElementById('nuevoTipoInput');
    const nuevoTipo = input.value.trim().toLowerCase();
    
    if (!nuevoTipo) {
    mostrarNotificacion('Por favor ingresa un nombre');
    return;
    }
    
    if (tiposPlantilla.includes(nuevoTipo)) {
    mostrarNotificacion('Este tipo ya existe');
    return;
    }
    
    tiposPlantilla.push(nuevoTipo);
    
    await updateDoc(doc(db, 'tipos', window.tiposDocId), {
    tipos: tiposPlantilla,
    lastModifiedBy: currentUser.email,
    lastModifiedAt: new Date()
    });
    
    actualizarSelectTipos();
    renderizarListaTipos();
    input.value = '';
    mostrarNotificacion('Tipo agregado correctamente ✓');
};

window.eliminarTipo = async function(tipo) {
    if (tiposPlantilla.length <= 1) {
    mostrarNotificacion('Debe haber al menos un tipo');
    return;
    }
    
    tiposPlantilla = tiposPlantilla.filter(t => t !== tipo);
    
    await updateDoc(doc(db, 'tipos', window.tiposDocId), {
    tipos: tiposPlantilla,
    lastModifiedBy: currentUser.email,
    lastModifiedAt: new Date()
    });
    
    actualizarSelectTipos();
    renderizarListaTipos();
    mostrarNotificacion('Tipo eliminado correctamente ✓');
};

// FUNCIONES DE FILTRADO
window.filtrarPlantillas = function() {
    filtrosBusqueda.plantillas = document.getElementById('searchPlantillas').value.toLowerCase();
    filtrosBusqueda.tipoPlantilla = document.getElementById('filtroTipoPlantilla').value;
    renderizarTodasLasPlantillas();
};

window.limpiarFiltrosPlantillas = function() {
    document.getElementById('searchPlantillas').value = '';
    document.getElementById('filtroTipoPlantilla').value = '';
    filtrosBusqueda.plantillas = '';
    filtrosBusqueda.tipoPlantilla = '';
    renderizarTodasLasPlantillas();
};

window.filtrarTasas = function() {
    filtrosBusqueda.tasas = document.getElementById('searchTasas').value.toLowerCase();
    renderizarTasas();
};

// UI FUNCTIONS
window.cambiarTab = function(tabName) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Buscar el botón de la pestaña y activarlo
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
    if (tab.textContent.toLowerCase().includes(tabName.toLowerCase()) || 
        tab.onclick.toString().includes(tabName)) {
        tab.classList.add('active');
    }
    });
    
    document.getElementById(`tab-${tabName}`).classList.add('active');
};

window.cambiarPeriodo = function(periodo) {
    periodoActual = periodo;
    tasasSeleccionadas.clear();
    renderizarBotonesPeriodo();
    renderizarTasas();
    actualizarSuma();
    document.getElementById('periodoActualBadge').textContent = periodo;
};

function renderizarBotonesPeriodo() {
    const container = document.getElementById('periodoButtons');
    container.innerHTML = periodos.map(periodo => `
    <button 
        class="periodo-btn ${periodo === periodoActual ? 'active' : ''}" 
        onclick="cambiarPeriodo(${periodo})"
    >
        ${periodo}
    </button>
    `).join('');
}

function actualizarSelectPeriodo() {
    const select = document.getElementById('periodoTasaInput');
    select.innerHTML = periodos.map(periodo => 
    `<option value="${periodo}" ${periodo === periodoActual ? 'selected' : ''}>${periodo}</option>`
    ).join('');
}

function actualizarSelectTipos() {
    const select = document.getElementById('tipoPlantillaSelect');
    const editSelect = document.getElementById('editTipoPlantilla');
    const filtroSelect = document.getElementById('filtroTipoPlantilla');
    
    const options = tiposPlantilla.map(tipo => 
        `<option value="${tipo}">${tipo.charAt(0).toUpperCase() + tipo.slice(1)}</option>`
    ).join('');
    
    select.innerHTML = options;
    editSelect.innerHTML = options;
    
    // Actualizar filtro con opción "Todos"
    if (filtroSelect) {
        filtroSelect.innerHTML = '<option value="">Todos los tipos</option>' + options;
    }
}

window.toggleSeleccionTasa = function(id) {
    if (tasasSeleccionadas.has(id)) {
    tasasSeleccionadas.delete(id);
    } else {
    tasasSeleccionadas.add(id);
    }
    actualizarSuma();
};

function actualizarSuma() {
    const sumaPanel = document.getElementById('sumaTotal');
    const sumaMonto = document.getElementById('sumaMonto');
    
    let total = 0;
    tasasSeleccionadas.forEach(id => {
    const tasa = tasas.find(t => t.id === id);
    if (tasa) total += tasa.monto;
    });

    sumaMonto.textContent = '' + total.toFixed(2);
    sumaPanel.style.display = tasasSeleccionadas.size > 0 ? 'block' : 'none';
}

window.copiarSuma = function() {
    const sumaMonto = document.getElementById('sumaMonto').textContent.replace(',' , '');
    copiarTexto(sumaMonto);
    mostrarNotificacion('Total copiado: ' + sumaMonto);
};

window.limpiarSeleccion = function() {
    tasasSeleccionadas.clear();
    renderizarTasas();
    actualizarSuma();
    mostrarNotificacion('Selección limpiada');
};

window.usarTasa = function(tasa) {
    const texto = tasa.monto.toFixed(2);
    copiarTexto(texto);
    mostrarNotificacion('Monto copiado: ' + texto);
};

function renderizarTasas() {
  const lista = document.getElementById('tasasList');
  let tasasDelPeriodo = tasas.filter(t => {
    // Para no reembolsables, mostrar todas (no filtrar por periodo)
    if (tipoTasaActual === 'no-reembolsable') {
      return t.noReembolsable === true;
    } else {
      // Para reembolsables, filtrar por periodo
      return !t.noReembolsable && t.periodo === periodoActual;
    }
  });
  
  // APLICAR FILTRO DE BÚSQUEDA
  if (filtrosBusqueda.tasas) {
    tasasDelPeriodo = tasasDelPeriodo.filter(t => 
      t.nombre.toLowerCase().includes(filtrosBusqueda.tasas)
    );
  }
  
  if (tasasDelPeriodo.length === 0) {
    const mensajeBusqueda = filtrosBusqueda.tasas 
      ? 'No se encontraron tasas con ese nombre' 
      : `No hay tasas ${tipoTasaActual === 'no-reembolsable' ? 'no reembolsables' : 'reembolsables'} ${tipoTasaActual === 'reembolsable' ? `para ${periodoActual}` : ''}`;
    
    lista.innerHTML = `
      <div class="empty-state">
        <p>${mensajeBusqueda}</p>
        <p style="font-size: 0.85rem; margin-top: 8px;">
          ${filtrosBusqueda.tasas ? 'Intenta con otros términos' : 'Agrega tasas'}
        </p>
      </div>
    `;
    return;
  }

  lista.innerHTML = tasasDelPeriodo.map(tasa => {
    const tieneComentario = tasa.comentario && tasa.comentario.length > 0;
    const comentarioCorto = tieneComentario && tasa.comentario.length > 50 
      ? tasa.comentario.substring(0, 50) + '...' 
      : tasa.comentario;
    
    // Renderizado diferente para No Reembolsables
    if (tasa.noReembolsable) {
      return `
        <div class="tasa-item no-reembolsable">
          <div class="tasa-info" style="flex: 1;">
            <div class="tasa-nombre">
              ${tasa.nombre}
              <span class="badge-no-reembolsable">NO REEMBOLSABLE</span>
            </div>
            ${tieneComentario ? `
              <div class="tasa-comentario">
                <span class="tasa-comentario-icon">💬</span>
                ${comentarioCorto}
                ${tasa.comentario.length > 50 ? `
                  <button class="ver-comentario-btn" onclick='verComentarioCompleto(${JSON.stringify(tasa).replace(/'/g, "&apos;")})'>
                    Ver más
                  </button>
                ` : ''}
              </div>
            ` : ''}
          </div>
          <div class="tasa-actions">
            <button class="edit-template-btn" onclick='abrirModalEditarTasa(${JSON.stringify(tasa).replace(/'/g, "&apos;")})' title="Editar" style="padding: 6px 10px; background: #edf2f7; color: #4a5568;">✏️</button>
            <button class="delete-btn" onclick="eliminarTasa('${tasa.id}')" title="Eliminar">🗑️</button>
          </div>
        </div>
      `;
    } else {
      // Renderizado normal para Reembolsables
      return `
        <div class="tasa-item">
          <input 
            type="checkbox" 
            class="tasa-checkbox" 
            ${tasasSeleccionadas.has(tasa.id) ? 'checked' : ''} 
            onchange="toggleSeleccionTasa('${tasa.id}')"
          >
          <div class="tasa-info">
            <div class="tasa-nombre">${tasa.nombre}</div>
            <div class="tasa-monto">$${tasa.monto.toFixed(2)}</div>
            ${tieneComentario ? `
              <div class="tasa-comentario">
                <span class="tasa-comentario-icon">💬</span>
                ${comentarioCorto}
                ${tasa.comentario.length > 50 ? `
                  <button class="ver-comentario-btn" onclick='verComentarioCompleto(${JSON.stringify(tasa).replace(/'/g, "&apos;")})'>
                    Ver más
                  </button>
                ` : ''}
              </div>
            ` : ''}
          </div>
          <div class="tasa-actions">
            <button class="use-btn" onclick='usarTasa(${JSON.stringify(tasa)})' title="Copiar monto">📄</button>
            <button class="edit-template-btn" onclick='abrirModalEditarTasa(${JSON.stringify(tasa).replace(/'/g, "&apos;")})' title="Editar" style="padding: 6px 10px; background: #edf2f7; color: #4a5568;">✏️</button>
            <button class="delete-btn" onclick="eliminarTasa('${tasa.id}')" title="Eliminar">🗑️</button>
          </div>
        </div>
      `;
    }
  }).join('');
}

// FUNCIÓN PARA PROCESAR RUTAS
function procesarRuta(ruta) {
    // Dividir por // para obtener los tramos
    let tramos = ruta.split('//').map(t => t.trim());
    
    // Limpiar cada tramo individualmente
    tramos = tramos.map(tramo => limpiarTramo(tramo));
    
    // Unificar tramos adyacentes si el final de uno = inicio del siguiente
    const tramosUnificados = [];
    
    for (let i = 0; i < tramos.length; i++) {
        if (tramosUnificados.length === 0) {
            // Primer tramo, agregarlo directamente
            tramosUnificados.push(tramos[i]);
        } else {
            // Obtener el último tramo unificado
            const ultimoTramo = tramosUnificados[tramosUnificados.length - 1];
            const tramoActual = tramos[i];
            
            // Dividir en aeropuertos
            const aeropuertosUltimo = ultimoTramo.split('-');
            const aeropuertosActual = tramoActual.split('-');
            
            // Verificar si el final del último = inicio del actual
            const finalUltimo = aeropuertosUltimo[aeropuertosUltimo.length - 1];
            const inicioActual = aeropuertosActual[0];
            
            if (finalUltimo === inicioActual) {
                // UNIFICAR: eliminar el duplicado y juntar
                aeropuertosActual.shift(); // Eliminar el primer elemento del actual
                const tramoUnificado = aeropuertosUltimo.concat(aeropuertosActual).join('-');
                tramosUnificados[tramosUnificados.length - 1] = tramoUnificado;
            } else {
                // NO UNIFICAR: mantener separado
                tramosUnificados.push(tramoActual);
            }
        }
    }
    
    // Unir los tramos con //
    return tramosUnificados.join(' // ');
}

function actualizarPreviewRuta() {
    const rutaRaw = document.getElementById('rutaInput').value.trim();
    const preview = document.getElementById('rutaPreview');
    
    if (!rutaRaw) {
        preview.style.display = 'none';
        return;
    }
    
    const rutaProcesada = procesarRuta(rutaRaw);
    const rutaRawNormalizada = rutaRaw.toUpperCase().replace(/\s+/g, ' ');
    const rutaProcesadaNormalizada = rutaProcesada.replace(/\s+/g, ' ');
    /*
    if (rutaProcesadaNormalizada !== rutaRawNormalizada) {
        preview.style.display = 'block';
        preview.innerHTML = `<strong>Optimizado:</strong> ${rutaProcesada}`;
        preview.style.color = '#38a169';
        preview.style.background = '#f0fff4';
        preview.style.border = '1px solid #c6f6d5';
    } else {
        preview.style.display = 'none';
    }*/
}

// FUNCIÓN PARA LIMPIAR UN TRAMO DE RUTA
function limpiarTramo(tramo) {
    // 1. Reemplazar / por -
    // 2. Reemplazar -- por -
    // 3. Eliminar espacios alrededor de guiones
    // 4. Reemplazar múltiples guiones por uno solo
    let tramoLimpio = tramo
        .replace(/\//g, '-')           // / → -
        .replace(/\s*--\s*/g, '-')     // -- → -
        .replace(/\s*-\s*/g, '-')      // espacios alrededor de - → -
        .replace(/-+/g, '-')           // múltiples - → -
        .trim();
    
    // 5. Eliminar aeropuertos duplicados consecutivos
    const aeropuertos = tramoLimpio.split('-').filter(a => a.trim() !== '');
    const aeropuertosSinDuplicados = aeropuertos.filter((aeropuerto, index) => {
        return index === 0 || aeropuerto !== aeropuertos[index - 1];
    });
    
    return aeropuertosSinDuplicados.join('-');
}

/*
Ejemplos de Optimización

| Entrada Original | Salida Optimizada | Explicación |
|------------------|-------------------|-------------|
| `LIM-MIA // MIA-LIM // CUN-LIM` | `LIM/MIA/LIM // CUN/LIM` | MIA conecta con LIM, pero CUN no conecta |
| `LIM-BOG // BOG-MIA // MIA-LIM` | `LIM/BOG/MIA/LIM` | Todo conectado en una sola ruta |
| `LIM-MIA // MIA-BOG // BOG-CUN` | `LIM/MIA/BOG/CUN` | Cadena completa conectada |
| `LIM-MIA // CUN-BOG` | `LIM/MIA // CUN/BOG` | No hay conexión, se mantienen separadas |
| `LIM-MIA // MIA-LIM // MIA-CUN` | `LIM/MIA/LIM // MIA/CUN` | Primera conexión se une, segunda no |
| `lim-mia // mia-lim` | `LIM/MIA/LIM` | Todo en mayúsculas y conectado |

Cómo Funciona la Lógica
Entrada: LIM-MIA // MIA-LIM // CUN-LIM

Paso 1: Dividir por "//"
  → ["LIM-MIA", "MIA-LIM", "CUN-LIM"]

Paso 2: Convertir cada segmento a array
  → [["LIM", "MIA"], ["MIA", "LIM"], ["CUN", "LIM"]]

Paso 3: Optimizar
  - Inicio: rutaActual = ["LIM", "MIA"]
  
  - Procesar ["MIA", "LIM"]:
    * Último de rutaActual = "MIA"
    * Primero del nuevo = "MIA"
    * Coinciden! → rutaActual = ["LIM", "MIA", "LIM"]
  
  - Procesar ["CUN", "LIM"]:
    * Último de rutaActual = "LIM"
    * Primero del nuevo = "CUN"
    * No coinciden → Guardar "LIM/MIA/LIM", empezar nueva ["CUN", "LIM"]

Paso 4:
    - Formatea la ruta:
        → Cambia / por - dentro de cada segmento

    - Resultado dentro del sistema:
        → ["LIM/MIA/LIM", "CUN/LIM"]

    -- Emplea la función limpiarTramo para el formato final --

Paso 5: Resultado final
  → "LIM-MIA-LIM // CUN-LIM"
*/



window.generarCE2 = function() {
    let numero;
    do {
    numero = Math.floor(Math.random() * 9000000) + 1000000;
    } while (numero.toString().startsWith('2'));
    
    document.getElementById('ce2Input').value = numero;
    renderizarTodasLasPlantillas();
};

window.toggleDropdown = function() {
    const dropdown = document.getElementById('dropdownContent');
    const header = document.querySelector('.dropdown-header');
    
    isDropdownOpen = !isDropdownOpen;
    
    if (isDropdownOpen) {
    dropdown.classList.add('open');
    header.classList.add('open');
    } else {
    dropdown.classList.remove('open');
    header.classList.remove('open');
    }
};

window.copiarPlantilla = async function(plantilla) {
    await registrarAudit('copy', `Copió plantilla: "${plantilla.nombre}"`);  

    const ruta = document.getElementById('rutaInput').value.trim() || 'LIM';
    const ce2 = document.getElementById('ce2Input').value;
    const fecha = document.getElementById('fechaInput').value.trim() || '';
    const numeroRI = document.getElementById('numeroRIInput').value.trim() || '';
    
    // Procesar ruta con lógica inteligente
    const rutaFormateada = procesarRuta(ruta);
    
    let textoFinal = plantilla.contenido
        .replace(/{RUTA}/g, rutaFormateada)
        .replace(/{CE2}/g, ce2)
        .replace(/{FECHA}/g, fecha)
        .replace(/{NUMERO_RI}/g, numeroRI);
    
    copiarTexto(textoFinal);
    mostrarNotificacion('Plantilla copiada');
    generarCE2();
};

function renderizarTodasLasPlantillas() {
    const grid = document.getElementById('templatesGrid');
    const ruta = document.getElementById('rutaInput').value.trim() || 'LIM';
    const ce2 = document.getElementById('ce2Input').value;
    const fecha = document.getElementById('fechaInput').value.trim() || '';
    const numeroRI = document.getElementById('numeroRIInput').value.trim() || '';

    // Usar la función de procesamiento inteligente
    const rutaFormateada = procesarRuta(ruta);

    let todasLasPlantillas = [...plantillasPredeterminadas, ...plantillasPersonalizadas];

    // APLICAR FILTROS
    if (filtrosBusqueda.plantillas) {
        todasLasPlantillas = todasLasPlantillas.filter(p => 
            p.nombre.toLowerCase().includes(filtrosBusqueda.plantillas) ||
            p.contenido.toLowerCase().includes(filtrosBusqueda.plantillas)
        );
    }

    if (filtrosBusqueda.tipoPlantilla) {
        todasLasPlantillas = todasLasPlantillas.filter(p => 
            p.tipo === filtrosBusqueda.tipoPlantilla
        );
    }

    if (todasLasPlantillas.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <p>No se encontraron plantillas</p>
                <p style="font-size: 0.85rem; margin-top: 8px;">Intenta con otros términos de búsqueda</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = todasLasPlantillas.map(plantilla => {
        const contenidoPreview = plantilla.contenido
            .replace(/{RUTA}/g, rutaFormateada)
            .replace(/{CE2}/g, ce2)
            .replace(/{FECHA}/g, fecha)
            .replace(/{NUMERO_RI}/g, numeroRI);
        
        const tipoClass = plantilla.tipo || 'reembolso';
        const puedeEditar = !plantilla.predeterminada;
        
        return `
            <div class="template-card"
                ${puedeEditar ? `
                draggable="true"
                ondragstart="handleDragStart(event, ${JSON.stringify(plantilla).replace(/"/g, '&quot;').replace(/'/g, '&apos;')})"
                ondragover="handleDragOver(event)"
                ondragenter="handleDragEnter(event)"
                ondragleave="handleDragLeave(event)"
                ondrop="handleDrop(event, ${JSON.stringify(plantilla).replace(/"/g, '&quot;').replace(/'/g, '&apos;')})"
                ondragend="handleDragEnd(event)"
                ` : ''}>
                <div class="template-header">
                    ${puedeEditar ? '<span class="drag-handle" title="Arrastra para reordenar">⋮⋮</span>' : ''}
                    <div class="template-title-wrapper">
                        <div class="template-title">${plantilla.nombre}</div>
                        <span class="template-type ${tipoClass}">${(plantilla.tipo || 'reembolso').charAt(0).toUpperCase() + (plantilla.tipo || 'reembolso').slice(1)}</span>
                    </div>
                    ${puedeEditar ? `
                        <div class="template-actions">
                        <button class="edit-template-btn" onclick='abrirModalEditar(${JSON.stringify(plantilla).replace(/"/g, "&quot;").replace(/'/g, "&apos;")})'>✏️</button>
                        <button class="delete-template-btn" onclick="eliminarPlantillaPersonalizada('${plantilla.id}')">🗑️</button>
                        </div>
                    ` : ''}
                </div>
                <div class="template-content">${contenidoPreview}</div>
                <button class="copy-btn" onclick='copiarPlantilla(${JSON.stringify(plantilla).replace(/"/g, "&quot;").replace(/'/g, "&apos;")})'>Copiar Plantilla</button>
            </div>
        `;
    }).join('');
}

// MODALS
window.abrirModalPeriodo = function() {
    renderizarListaPeriodos();
    document.getElementById('modalPeriodo').classList.add('show');
};

window.cerrarModalPeriodo = function() {
    document.getElementById('modalPeriodo').classList.remove('show');
};

function renderizarListaPeriodos() {
    const lista = document.getElementById('listaPeriodos');
    
    lista.innerHTML = periodos.map(periodo => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 4px;">
        <span style="font-weight: 500; color: #2d3748;">${periodo}</span>
        <button class="delete-btn" onclick="eliminarPeriodo(${periodo})" title="Eliminar Periodo">Eliminar</button>
    </div>
    `).join('');
}

window.editarTipos = function() {
    renderizarListaTipos();
    document.getElementById('modalTipos').classList.add('show');
};

window.cerrarModalTipos = function() {
    document.getElementById('modalTipos').classList.remove('show');
};

function renderizarListaTipos() {
    const lista = document.getElementById('listaTipos');
    
    lista.innerHTML = tiposPlantilla.map(tipo => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 4px;">
        <span style="font-weight: 500; color: #2d3748;">${tipo.charAt(0).toUpperCase() + tipo.slice(1)}</span>
        <button class="delete-btn" onclick="eliminarTipo('${tipo}')" title="Eliminar Tipo">Eliminar</button>
    </div>
    `).join('');
}

window.abrirModalEditar = function(plantilla) {
    plantillaEnEdicion = plantilla;
    document.getElementById('editNombrePlantilla').value = plantilla.nombre;
    document.getElementById('editTipoPlantilla').value = plantilla.tipo;
    document.getElementById('editContenidoPlantilla').value = plantilla.contenido;
    document.getElementById('modalEditar').classList.add('show');
};

window.cerrarModalEditar = function() {
    document.getElementById('modalEditar').classList.remove('show');
    plantillaEnEdicion = null;
};

// UTILITIES
function copiarTexto(texto) {
    if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(texto).catch(() => copiarTextoFallback(texto));
    } else {
    copiarTextoFallback(texto);
    }
}

function copiarTextoFallback(texto) {
    const textArea = document.createElement('textarea');
    textArea.value = texto;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();
    
    try {
    document.execCommand('copy');
    } catch (err) {
    console.error('Error al copiar');
    } finally {
    document.body.removeChild(textArea);
    }
}

function mostrarNotificacion(mensaje) {
    const toast = document.getElementById('toast');
    toast.textContent = mensaje;
    toast.classList.add('show');
    
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function(){
    document.getElementById('rutaInput').addEventListener('input', renderizarTodasLasPlantillas);
    document.getElementById('fechaInput').addEventListener('input', renderizarTodasLasPlantillas);
    document.getElementById('numeroRIInput').addEventListener('input', renderizarTodasLasPlantillas);
    
    rutaInput.addEventListener('input', function() {
        actualizarPreviewRuta();
        renderizarTodasLasPlantillas();
    });
    
    document.getElementById('fechaInput').addEventListener('input', renderizarTodasLasPlantillas);
    
    document.getElementById('montoTasaInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            agregarTasa();
        }
    });

    document.getElementById('passwordInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            login();
        }
    });
});

// DRAG & DROP PARA PLANTILLAS
let draggedElement = null;
let draggedPlantilla = null;

window.handleDragStart = function(e, plantilla) {
    draggedElement = e.target.closest('.template-card');
    draggedPlantilla = plantilla;
    draggedElement.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
};

window.handleDragOver = function(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
};

window.handleDragEnter = function(e) {
    const card = e.target.closest('.template-card');
    if (card && card !== draggedElement && !card.classList.contains('dragging')) {
        card.classList.add('drag-over');
    }
};

window.handleDragLeave = function(e) {
    const card = e.target.closest('.template-card');
    if (card && !card.contains(e.relatedTarget)) {
        card.classList.remove('drag-over');
    }
};

window.handleDrop = async function(e, targetPlantilla) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    if (e.preventDefault) {
        e.preventDefault();
    }
    
    // Limpiar estilos
    document.querySelectorAll('.template-card').forEach(card => {
        card.classList.remove('drag-over');
    });
    
    if (!draggedPlantilla || !targetPlantilla) {
        return false;
    }
    
    if (draggedPlantilla.id === targetPlantilla.id) {
        return false;
    }
    
    // Solo permitir reordenar plantillas personalizadas
    if (draggedPlantilla.predeterminada || targetPlantilla.predeterminada) {
        mostrarNotificacion('Solo puedes reordenar plantillas personalizadas');
        return false;
    }
    
    // Encontrar índices en el array de plantillas personalizadas
    const draggedIndex = plantillasPersonalizadas.findIndex(p => p.id === draggedPlantilla.id);
    const targetIndex = plantillasPersonalizadas.findIndex(p => p.id === targetPlantilla.id);
    
    if (draggedIndex !== -1 && targetIndex !== -1) {
        // Crear copia del array
        const newOrder = [...plantillasPersonalizadas];
        
        // Remover elemento arrastrado
        const [removed] = newOrder.splice(draggedIndex, 1);
        
        // Insertar en nueva posición
        newOrder.splice(targetIndex, 0, removed);
        
        // Actualizar array local
        plantillasPersonalizadas = newOrder;
        
        // Guardar orden en Firebase (el listener se encargará de actualizar la UI)
        await guardarOrdenPlantillas();
        
        // NO LLAMAR renderizarTodasLasPlantillas() aquí
        
        mostrarNotificacion('Orden actualizado ✓');
    }
    
    return false;
};

window.handleDragEnd = function(e) {
    document.querySelectorAll('.template-card').forEach(card => {
        card.classList.remove('dragging', 'drag-over');
    });
    draggedElement = null;
    draggedPlantilla = null;
};

async function guardarOrdenPlantillas() {
    try {
        const batch = [];
        plantillasPersonalizadas.forEach((plantilla, index) => {
            if (!plantilla.predeterminada && plantilla.id) {
                batch.push(
                    updateDoc(doc(db, 'plantillas', plantilla.id), {
                        orden: index,
                        lastModifiedBy: currentUser.email,
                        lastModifiedAt: new Date()
                    })
                );
            }
        });
        
        await Promise.all(batch);
    } catch (error) {
        console.error('Error al guardar orden:', error);
        mostrarNotificacion('Error al guardar el orden');
    }
}

// Sistema de doble ESC
let lastEscapeTime = 0;
let camposGuardados = {};

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    const now = Date.now();
    
    if (now - lastEscapeTime < 500) {
      // Doble ESC detectado
      limpiarTodosCampos();
    }
    
    lastEscapeTime = now;
  }
});

function limpiarTodosCampos() {
  // Guardar valores actuales para undo
  camposGuardados = {
    ruta: document.getElementById('rutaInput').value,
    fecha: document.getElementById('fechaInput').value,
    numeroRI: document.getElementById('numeroRIInput').value,
    searchPlantillas: document.getElementById('searchPlantillas').value,
    searchTasas: document.getElementById('searchTasas').value,
    // Guardar calculadora
    calculadoraGrupos: [],
    // Guardar PE
    peFare: document.getElementById('peFare')?.value || '',
    peYR: document.getElementById('peYR')?.value || '',
    peIGV: document.getElementById('peIGV')?.value || ''
  };
  
  // Guardar grupos de calculadora
  const grupos = document.querySelectorAll('.calc-grupo');
  grupos.forEach(grupo => {
    const id = grupo.getAttribute('data-grupo-calc');
    const textarea = document.getElementById(`calcGrupo${id}`);
    if (textarea) {
      camposGuardados.calculadoraGrupos.push({
        id: id,
        valor: textarea.value
      });
    }
  });
  
  // Crear overlay de limpieza
  const overlay = document.createElement('div');
  overlay.className = 'cleaning-overlay';
  overlay.innerHTML = `
    <div class="cleaning-content-fast">
      <div class="cleaning-icon-fast">🧹</div>
      <div class="cleaning-text-fast">Limpiando todo el sistema...</div>
      <div class="cleaning-progress-fast">
        <div class="cleaning-bar-fast" id="cleaningBarFast"></div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  
  // Animar aparición del overlay
  setTimeout(() => overlay.classList.add('active'), 10);
  
  // Array de campos principales
  const campos = ['rutaInput', 'fechaInput', 'numeroRIInput', 'searchPlantillas', 'searchTasas'];
  
  // Progreso animado
  const bar = document.getElementById('cleaningBarFast');
  let progreso = 0;
  const progressInterval = setInterval(() => {
    progreso += 10;
    if (bar) bar.style.width = progreso + '%';
    if (progreso >= 100) clearInterval(progressInterval);
  }, 30);
  
  // Limpiar campos principales
  campos.forEach((id, index) => {
    setTimeout(() => {
      const elemento = document.getElementById(id);
      if (elemento) {
        elemento.classList.add('clearing-flash');
        
        setTimeout(() => {
          elemento.value = '';
          elemento.classList.remove('clearing-flash');
          elemento.dispatchEvent(new Event('input', { bubbles: true }));
        }, 100);
      }
    }, index * 100);
  });
  
  // Limpiar calculadora (todos los grupos)
  setTimeout(() => {
    const gruposCalc = document.querySelectorAll('.calc-grupo');
    gruposCalc.forEach((grupo, index) => {
      const id = grupo.getAttribute('data-grupo-calc');
      const textarea = document.getElementById(`calcGrupo${id}`);
      if (textarea) {
        setTimeout(() => {
          textarea.classList.add('clearing-flash');
          setTimeout(() => {
            textarea.value = '';
            textarea.classList.remove('clearing-flash');
            calcularTotales();
          }, 100);
        }, index * 80);
      }
    });
  }, campos.length * 100 + 200);
  
  // Limpiar campos PE
  setTimeout(() => {
    const camposPE = ['peFare', 'peYR', 'peIGV'];
    camposPE.forEach((id, index) => {
      const elemento = document.getElementById(id);
      if (elemento) {
        setTimeout(() => {
          elemento.classList.add('clearing-flash');
          setTimeout(() => {
            if (id === 'peIGV') {
              elemento.value = '18'; // Resetear IGV a 18%
            } else {
              elemento.value = '';
            }
            elemento.classList.remove('clearing-flash');
            if (typeof calcularPE === 'function') calcularPE();
          }, 100);
        }, index * 80);
      }
    });
  }, campos.length * 100 + 400);
  
  // Generar CE2 y cerrar
  setTimeout(() => {
    document.querySelector('.cleaning-text-fast').textContent = '✓ ¡Todo limpio!';
    document.querySelector('.cleaning-icon-fast').textContent = '✓';
    
    generarCE2();
    
    setTimeout(() => {
      overlay.classList.remove('active');
      setTimeout(() => {
        overlay.remove();
        mostrarNotificacionConUndo('🧹 Todo el sistema limpiado', deshacerLimpiezaCompleta);
      }, 200);
    }, 400);
  }, 1500);
}

// Deshacer limpieza completa (incluyendo calculadora y PE)
function deshacerLimpiezaCompleta() {
  // Restaurar campos principales
  document.getElementById('rutaInput').value = camposGuardados.ruta;
  document.getElementById('fechaInput').value = camposGuardados.fecha;
  document.getElementById('numeroRIInput').value = camposGuardados.numeroRI;
  document.getElementById('searchPlantillas').value = camposGuardados.searchPlantillas;
  document.getElementById('searchTasas').value = camposGuardados.searchTasas;
  
  // Restaurar calculadora
  if (camposGuardados.calculadoraGrupos) {
    camposGuardados.calculadoraGrupos.forEach(grupo => {
      const textarea = document.getElementById(`calcGrupo${grupo.id}`);
      if (textarea) {
        textarea.value = grupo.valor;
      }
    });
    if (typeof calcularTotales === 'function') calcularTotales();
  }
  
  // Restaurar PE
  const peFare = document.getElementById('peFare');
  const peYR = document.getElementById('peYR');
  const peIGV = document.getElementById('peIGV');
  
  if (peFare) peFare.value = camposGuardados.peFare;
  if (peYR) peYR.value = camposGuardados.peYR;
  if (peIGV) peIGV.value = camposGuardados.peIGV;
  
  if (typeof calcularPE === 'function') calcularPE();
  
  // Re-renderizar
  renderizarTodasLasPlantillas();
  filtrarTasas();
  
  mostrarNotificacion('↩️ Todo restaurado');
}

function deshacerLimpieza() {
  document.getElementById('rutaInput').value = camposGuardados.ruta;
  document.getElementById('fechaInput').value = camposGuardados.fecha;
  document.getElementById('numeroRIInput').value = camposGuardados.numeroRI;
  document.getElementById('searchPlantillas').value = camposGuardados.searchPlantillas;
  document.getElementById('searchTasas').value = camposGuardados.searchTasas;
  
  renderizarTodasLasPlantillas();
  filtrarTasas();
  
  mostrarNotificacion('↩️ Cambios revertidos');
}

// Notificación con botón de Undo
function mostrarNotificacionConUndo(mensaje, undoCallback) {
  const toast = document.getElementById('toast');
  toast.innerHTML = `
    <span>${mensaje}</span>
    <button class="undo-btn" onclick="undoCallback()">↩️ Deshacer</button>
  `;
  toast.classList.add('show', 'with-undo');
  
  setTimeout(() => {
    toast.classList.remove('show', 'with-undo');
    toast.innerHTML = 'Texto copiado';
  }, 5000);
}

// Funciones del modal de licencia
window.mostrarLicencia = function() {
  document.getElementById('licenseModal').style.display = 'flex';
  document.body.style.overflow = 'hidden'; // Prevenir scroll del body
};

window.cerrarLicencia = function() {
  document.getElementById('licenseModal').style.display = 'none';
  document.body.style.overflow = 'auto';
};

// Cerrar con ESC
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    const modal = document.getElementById('licenseModal');
    if (modal && modal.style.display === 'flex') {
      cerrarLicencia();
    }
  }
});

// Cerrar al hacer click fuera del modal
document.getElementById('licenseModal')?.addEventListener('click', function(e) {
  if (e.target === this) {
    cerrarLicencia();
  }
});

// cambio de tipo de tasa
window.cambiarTipoTasa = function(tipo) {
  tipoTasaActual = tipo;
  
  // Actiualizar botones
  const btReembolsable = document.getElementById('btnReembolsable');
  const btNoReembolsable = document.getElementById('btnNoReembolsable');

  btReembolsable.classList.remove('active');
  btNoReembolsable.classList.remove('active');
  
  if (tipo === 'reembolsable') {
    btReembolsable.classList.add('active');
  } else {
    btNoReembolsable.classList.add('active');
  }

  //renderizxar tasas
  renderizarTasas();
};

// Validar que Ruta solo tenga letras, guiones, espacios, barras
window.validarRutaSoloTexto = function(input) {
  let valor = input.value;
  
  // Permitir solo letras (A-Z, a-z), guiones (-), espacios, barras (/)
  // Eliminar cualquier número o carácter especial
  valor = valor.replace(/[^A-Za-z\s\-\/]/g, '');
  
  // Convertir a mayúsculas automáticamente
  valor = valor.toUpperCase();
  
  input.value = valor;
  
  // Renderizar plantillas
  renderizarTodasLasPlantillas();
};

window.toggleCamposTasa = function() {
  const noReembolsable = document.getElementById('noReembolsableCheckbox').checked;
  const camposReembolsable = document.getElementById('camposReembolsable');
  const camposNoReembolsable = document.getElementById('camposNoReembolsable');
  
  if (noReembolsable) {
    // Ocultar campos de tasa reembolsable
    camposReembolsable.style.display = 'none';
    camposNoReembolsable.style.display = 'grid';
    
    // Limpiar campos reembolsables
    document.getElementById('nombreTasaInput').value = '';
    document.getElementById('montoTasaInput').value = '';
  } else {
    // Mostrar campos de tasa reembolsable
    camposReembolsable.style.display = 'grid';
    camposNoReembolsable.style.display = 'none';
    
    // Limpiar campo no reembolsable
    document.getElementById('nombreTasaNoReembolsableInput').value = '';
  }
};

// ver comentarios
window.verComentarioCompleto = function(tasa) {
  const modal = document.createElement('div');
  modal.className = 'modal-comentario show';
  modal.id = 'modalComentario';
  modal.innerHTML = `
    <div class="modal-comentario-content">
      <div class="modal-comentario-header">
        <div class="modal-comentario-title">
          💬 Comentario: ${tasa.nombre}
        </div>
        <button class="modal-close-btn" onclick="cerrarModalComentario()">×</button>
      </div>
      <div class="modal-comentario-body">
        ${tasa.comentario}
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  
  // Cerrar al hacer click fuera
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      cerrarModalComentario();
    }
  });
};

window.cerrarModalComentario = function() {
  const modal = document.getElementById('modalComentario');
  if (modal) {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 300);
  }
};

// Variables para calculadora
let contadorGruposCalc = 0;

// Agregar nuevo grupo
window.agregarGrupoCalc = function() {
  contadorGruposCalc++;
  const container = document.getElementById('gruposTasasCalc');
  
  const nuevoGrupo = document.createElement('div');
  nuevoGrupo.className = 'calc-grupo';
  nuevoGrupo.setAttribute('data-grupo-calc', contadorGruposCalc);
  nuevoGrupo.innerHTML = `
    <div class="calc-grupo-header">
      <span class="calc-grupo-numero">Grupo ${contadorGruposCalc + 1}</span>
      <button class="calc-btn-delete" onclick="eliminarGrupoCalc(${contadorGruposCalc})">
        ×
      </button>
    </div>
    <textarea 
      class="calc-textarea" 
      id="calcGrupo${contadorGruposCalc}" 
      placeholder="Ingresa montos (uno por línea o separados por espacios)"
      rows="6"
      oninput="calcularTotales()"
    ></textarea>
    <div class="calc-subtotal-panel">
      <div class="calc-subtotal-row">
        <span style="color: #4a5568; font-weight: 500;">Total:</span>
        <span class="calc-subtotal-monto" id="calcSubtotal${contadorGruposCalc}">$0.00</span>
      </div>
      <button class="calc-btn-copy-individual" onclick="copiarSubtotalCalc(${contadorGruposCalc})">
        Copiar
      </button>
    </div>
  `;
  
  container.appendChild(nuevoGrupo);
  
  // Mostrar botón eliminar en primer grupo si hay más de uno
  actualizarBotonesEliminar();
  
  // Focus en el nuevo textarea
  document.getElementById(`calcGrupo${contadorGruposCalc}`).focus();
};

// Eliminar grupo
window.eliminarGrupoCalc = function(grupoId) {
  const grupo = document.querySelector(`[data-grupo-calc="${grupoId}"]`);
  if (grupo) {
    grupo.classList.add('removing');
    setTimeout(() => {
      grupo.remove();
      calcularTotales();
      renumerarGruposCalc();
      actualizarBotonesEliminar();
    }, 300);
  }
};

// Renumerar grupos
function renumerarGruposCalc() {
  const grupos = document.querySelectorAll('.calc-grupo');
  grupos.forEach((grupo, index) => {
    const titulo = grupo.querySelector('.calc-grupo-numero');
    if (titulo) titulo.textContent = `Grupo ${index + 1}`;
  });
}

// Actualizar visibilidad de botones eliminar
function actualizarBotonesEliminar() {
  const grupos = document.querySelectorAll('.calc-grupo');
  const botones = document.querySelectorAll('.calc-btn-delete');
  
  if (grupos.length === 1) {
    botones.forEach(btn => btn.style.display = 'none');
  } else {
    botones.forEach(btn => btn.style.display = 'flex');
  }
}

// Calcular totales
window.calcularTotales = function() {
  const grupos = document.querySelectorAll('.calc-grupo');
  let totalGeneral = 0;
  
  grupos.forEach(grupo => {
    const grupoId = grupo.getAttribute('data-grupo-calc');
    const textarea = document.getElementById(`calcGrupo${grupoId}`);
    const subtotalElement = document.getElementById(`calcSubtotal${grupoId}`);
    
    if (textarea && subtotalElement) {
      const texto = textarea.value;
      
      // Extraer números (incluyendo decimales)
      const numeros = texto.match(/\d+\.?\d*/g);
      
      let subtotal = 0;
      if (numeros) {
        numeros.forEach(num => {
          const valor = parseFloat(num);
          if (!isNaN(valor)) {
            subtotal += valor;
          }
        });
      }
      
      subtotalElement.textContent = '$' + subtotal.toFixed(2);
      totalGeneral += subtotal;
    }
  });
  
  // Actualizar total general (solo informativo)
  const totalElement = document.getElementById('calcTotalGeneral');
  if (totalElement) {
    totalElement.textContent = '$' + totalGeneral.toFixed(2);
  }
};

// Copiar subtotal de un grupo específico
window.copiarSubtotalCalc = function(grupoId) {
  const subtotalElement = document.getElementById(`calcSubtotal${grupoId}`);
  if (subtotalElement) {
    const subtotal = subtotalElement.textContent.replace('$', '');
    copiarTexto(subtotal);
    
    // Feedback visual en el botón
    const btn = event.target;
    const textoOriginal = btn.textContent;
    btn.textContent = '✓ Copiado';
    btn.style.background = '#38a169';
    
    setTimeout(() => {
      btn.textContent = textoOriginal;
      btn.style.background = '#3182ce';
    }, 1500);
    
    mostrarNotificacion(`💰 Total del Grupo ${parseInt(grupoId) + 1} copiado: $${subtotal}`);
  }
};

// Calcular PapaEcho (PE)
window.calcularPE = function() {
  // Obtener valores
  const fareInput = document.getElementById('peFare').value;
  const yrInput = document.getElementById('peYR').value;
  const igvInput = document.getElementById('peIGV').value;
  
  const fare = parseFloat(fareInput) || 0;
  const yr = parseFloat(yrInput) || 0;
  const igvPercent = parseFloat(igvInput) || 18;
  
  // Calcular
  const subtotal = fare + yr;
  const igvMonto = subtotal * (igvPercent / 100);
  const pe = igvMonto;
  
  // Actualizar breakdown
  document.getElementById('peBreakdownFare').textContent = '$' + fare.toFixed(2);
  document.getElementById('peBreakdownYR').textContent = '$' + yr.toFixed(2);
  document.getElementById('peBreakdownSubtotal').textContent = '$' + subtotal.toFixed(2);
  document.getElementById('peBreakdownIGVPercent').textContent = igvPercent.toFixed(2);
  document.getElementById('peBreakdownIGV').textContent = '$' + igvMonto.toFixed(2);
  
  // Actualizar resultado
  document.getElementById('peResultado').textContent = '$' + pe.toFixed(2);
};

// Copiar resultado PE
window.copiarPE = function() {
  const resultado = document.getElementById('peResultado').textContent.replace('$', '');
  copiarTexto(resultado);

  // FIX: usar closest('button') para siempre apuntar al botón, 
  // no a un texto hijo del botón
  const btn = (event.target).closest('button');
  if (!btn) return;

  const textoOriginal = btn.textContent;
  btn.textContent = '✓ Copiado';
  btn.style.background = '#38a169';  // color sólido, más visible que rgba

  setTimeout(() => {
    btn.textContent = textoOriginal;
    btn.style.background = '#3182ce';  // vuelve al azul base del botón
  }, 1500);

  mostrarNotificacion('📊 PE copiado: $' + resultado);
};

// Inicializar PE con valores por defecto
document.addEventListener('DOMContentLoaded', function() {
  // Si el elemento existe, inicializar
  const peIGV = document.getElementById('peIGV');
  if (peIGV) {
    calcularPE();
  }
});

// Sistema de Feedback/Comentarios
window.abrirModalFeedback = function() {
  document.getElementById('modalFeedback').classList.add('show');
  
  // Auto-llenar email del usuario actual si está disponible
  if (window.currentUser && window.currentUser.email) {
    document.getElementById('feedbackEmail').value = window.currentUser.email;
  }
};

// CTRL+ENTER para enviar feedback desde el textarea
document.getElementById('feedbackMensaje').addEventListener('keydown', function(e) {
  if (e.ctrlKey && e.key === 'Enter') {
    e.preventDefault();
    enviarFeedback();
  }
});

window.cerrarModalFeedback = function() {
  document.getElementById('modalFeedback').classList.remove('show');
  
  // Limpiar campos
  document.getElementById('feedbackEmail').value = '';
  document.getElementById('feedbackMensaje').value = '';
  document.getElementById('feedbackTipo').value = 'sugerencia';
  document.getElementById('feedbackIncluirInfo').checked = false;
  
  // Ocultar status
  const status = document.getElementById('feedbackStatus');
  status.style.display = 'none';
  status.className = 'feedback-status';
};

window.enviarFeedback = async function() {
  const email = document.getElementById('feedbackEmail').value.trim();
  const tipo = document.getElementById('feedbackTipo').value;
  const mensaje = document.getElementById('feedbackMensaje').value.trim();
  const incluirInfo = document.getElementById('feedbackIncluirInfo').checked;
  const status = document.getElementById('feedbackStatus');
  const btn = document.getElementById('btnEnviarFeedback');
  
  // Validar
  if (!mensaje) {
    mostrarFeedbackStatus('Por favor escribe un comentario', 'error');
    return;
  }
  
  if (mensaje.length < 10) {
    mostrarFeedbackStatus('El comentario debe tener al menos 10 caracteres', 'error');
    return;
  }
  
  // Preparar información técnica
  let infoTecnica = '';
  if (incluirInfo) {
    const navegador = obtenerNombreNavegador();
    const fecha = new Date().toLocaleString('es-PE');
    const usuario = window.currentUser ? window.currentUser.email : 'Anónimo';
    
    infoTecnica = `

───────────────────────────
INFORMACIÓN TÉCNICA:
───────────────────────────
Usuario: ${usuario}
Fecha: ${fecha}
Navegador: ${navegador}
User Agent: ${navigator.userAgent}
URL: ${window.location.href}
Resolución: ${window.screen.width}x${window.screen.height}
Idioma: ${navigator.language}
`;
  }
  
  // Emoji según tipo
  const tipoEmoji = {
    'sugerencia': '💡',
    'bug': '🐛',
    'pregunta': '❓',
    'felicitacion': '⭐',
    'otro': '📝'
  };
  
  const emoji = tipoEmoji[tipo] || '📝';
  
  // Mostrar loading
  mostrarFeedbackStatus('📤 Enviando comentario...', 'loading');
  btn.disabled = true;
  btn.textContent = 'Enviando...';
  
  try {
    // 1. Guardar en Firebase para respaldo
    const docRef = await addDoc(collection(db, 'feedback'), {
      email: email || 'anónimo',
      tipo: tipo,
      mensaje: mensaje,
      infoTecnica: incluirInfo ? infoTecnica : null,
      usuario: window.currentUser ? window.currentUser.email : 'anónimo',
      fecha: new Date(),
      enviado: false,
      leido: false
    });
    
    // 2. Preparar parámetros para EmailJS
    const templateParams = {
      to_email: 'jack.theripe@outlook.com',
      from_email: email || 'usuario.anonimo@sistema.com',
      tipo: `${emoji} ${tipo.toUpperCase()}`,
      mensaje: mensaje,
      info_tecnica: infoTecnica || 'Información Técnica No incluida',
      usuario: window.currentUser ? window.currentUser.email : 'Anónimo',
      fecha: new Date().toLocaleString('es-PE', { 
        dateStyle: 'full', 
        timeStyle: 'medium' 
      })
    };
    
    // 3. Enviar email con EmailJS
    const response = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      templateParams
    );
    
    console.log('Email enviado:', response.status, response.text);
    
    // 4. Actualizar documento como enviado
    await updateDoc(doc(db, 'feedback', docRef.id), {
      enviado: true,
      emailjs_status: response.status,
      emailjs_text: response.text,
      fechaEnvio: new Date()
    });
    
    // 5. Éxito
    mostrarFeedbackStatus('✅ ¡Comentario enviado correctamente!', 'success');
    btn.disabled = false;
    btn.textContent = '✓ Enviado';
    
    // Cerrar modal después de 2 segundos
    setTimeout(() => {
      cerrarModalFeedback();
      mostrarNotificacion('Gracias por tu feedback 💚');
    }, 2000);
    
  } catch (error) {
    console.error('Error al enviar feedback:', error);
    
    // Mensajes de error específicos
    let mensajeError = 'Error al enviar. Por favor intenta de nuevo.';
    
    if (error.text) {
      console.error('EmailJS Error:', error.text);
      
      if (error.text.includes('Invalid')) {
        mensajeError = 'Error de configuración. Contacta al administrador.';
      } else if (error.text.includes('Limit')) {
        mensajeError = 'Límite de envíos alcanzado. Intenta más tarde.';
      }
    }
    
    // Marcar como no enviado pero guardado
    try {
      if (docRef) {
        await updateDoc(doc(db, 'feedback', docRef.id), {
          enviado: false,
          error: error.text || error.message,
          fechaError: new Date()
        });
      }
    } catch (updateError) {
      console.error('Error al actualizar estado:', updateError);
    }
    
    mostrarFeedbackStatus('❌ ' + mensajeError, 'error');
    btn.disabled = false;
    btn.textContent = '📤 Reintentar';
  }
};

function mostrarFeedbackStatus(mensaje, tipo) {
  const status = document.getElementById('feedbackStatus');
  status.textContent = mensaje;
  status.className = `feedback-status ${tipo}`;
  status.style.display = 'block';
}

function obtenerNombreNavegador() {
  const ua = navigator.userAgent;
  if (ua.indexOf('Firefox') > -1) return 'Firefox';
  if (ua.indexOf('Chrome') > -1) return 'Chrome';
  if (ua.indexOf('Safari') > -1) return 'Safari';
  if (ua.indexOf('Edge') > -1) return 'Edge';
  if (ua.indexOf('MSIE') > -1 || ua.indexOf('Trident/') > -1) return 'Internet Explorer';
  return 'Desconocido';
}

// ════════════════════════════════════════
// SISTEMA DE NOTIFICACIONES EN FEEDBACK BTN
// ════════════════════════════════════════

function iniciarNotificaciones(email) {
  const q = query(
    collection(db, 'notificaciones'),
    where('paraUsuario', '==', email),
    orderBy('creadoAt', 'desc')
  );

  onSnapshot(q, (snap) => {
    const notifs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    actualizarBadgeNotif(notifs);
    renderNotificaciones(notifs);
  });
}

function actualizarBadgeNotif(notifs) {
  const badge    = document.getElementById('notifBadge');
  if (!badge) return;
  const noLeidas = notifs.filter(n => !n.leida).length;
  badge.textContent   = noLeidas > 9 ? '9+' : noLeidas;
  badge.style.display = noLeidas > 0 ? 'flex' : 'none';
}

function renderNotificaciones(notifs) {
  const lista    = document.getElementById('notifLista');
  const seccion  = document.getElementById('notifSeccion');
  if (!lista || !seccion) return;

  if (!notifs.length) {
    seccion.style.display = 'none';
    return;
  }

  seccion.style.display = 'block';

  const tipoEmoji = { sugerencia:'💡', bug:'🐛', pregunta:'❓', felicitacion:'⭐', otro:'📝' };
  const estadoLabel = { pending:'⏳ Pendiente', review:'🔍 En revisión', resolved:'✅ Resuelto' };

  lista.innerHTML = notifs.map(n => {
    const fecha = n.creadoAt?.toDate ? formatNotifTime(n.creadoAt.toDate()) : '';
    const leida = n.leida;
    const emoji = tipoEmoji[n.feedbackTipo] || '📋';

    return `
      <div onclick="marcarLeida('${n.id}')" style="
        padding: 12px 14px;
        border-bottom: 1px solid #e2e8f0;
        cursor: pointer;
        background: ${leida ? 'white' : '#ebf8ff'};
        transition: background 0.2s;
        display: flex;
        gap: 10px;
        align-items: flex-start;
      ">
        <div style="font-size:1.1rem; flex-shrink:0; margin-top:1px;">${emoji}</div>
        <div style="flex:1; min-width:0;">
          <div style="font-weight:${leida ? '400' : '600'}; color:#2d3748; font-size:0.82rem; margin-bottom:3px;">
            ${n.titulo || 'Notificación'}
            ${!leida ? '<span style="display:inline-block;width:7px;height:7px;background:#3182ce;border-radius:50%;margin-left:5px;vertical-align:middle;"></span>' : ''}
          </div>
          <div style="color:#4a5568; font-size:0.8rem; line-height:1.5;">
            ${n.mensaje || ''}
          </div>
          <div style="color:#a0aec0; font-size:0.7rem; margin-top:4px;">${fecha}</div>
        </div>
      </div>`;
  }).join('');

  // Quitar borde del último elemento
  const items = lista.querySelectorAll('div[onclick]');
  if (items.length) items[items.length - 1].style.borderBottom = 'none';
}

window.marcarLeida = async function (id) {
  try {
    await updateDoc(doc(db, 'notificaciones', id), { leida: true });
  } catch { /* silencioso */ }
};

window.marcarTodasLeidas = async function () {
  const email = window.currentUser?.email;
  if (!email) return;
  try {
    const q    = query(
      collection(db, 'notificaciones'),
      where('paraUsuario', '==', email),
      where('leida', '==', false)
    );
    const snap = await getDocs(q);
    await Promise.all(snap.docs.map(d =>
      updateDoc(doc(db, 'notificaciones', d.id), { leida: true })
    ));
    mostrarNotificacion('✓ Todas marcadas como leídas');
  } catch { /* silencioso */ }
};

function formatNotifTime(date) {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60)    return 'hace unos segundos';
  if (diff < 3600)  return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return date.toLocaleDateString('es-PE', { day:'2-digit', month:'short' });
}
