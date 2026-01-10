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
//VARIABLES PARA FILTROS
let filtrosBusqueda = {
    plantillas: '',
    tipoPlantilla: '',
    tasas: ''
};

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
    await signOut(auth);
    } catch (error) {
    mostrarNotificacion('Error al cerrar sesión');
    }
};

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

// Auth State Observer
onAuthStateChanged(auth, async (user) => {
    document.getElementById('loadingContainer').style.display = 'none';
    
    if (user) {
    window.currentUser = user;
    document.getElementById('authContainer').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
    document.getElementById('userEmail').textContent = user.email;
    
    await cargarDatosFirebase();
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
    mostrarNotificacion('Año agregado - visible para todos ✓');
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
    mostrarNotificacion('Año eliminado - cambio visible para todos ✓');
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
    const nombre = document.getElementById('nombreTasaInput').value.trim();
    const monto = document.getElementById('montoTasaInput').value.trim();
    const periodo = parseInt(document.getElementById('periodoTasaInput').value);

    if (!nombre || !monto) {
    mostrarNotificacion('Completa todos los campos');
    return;
    }

    try {
    await addDoc(collection(db, 'tasas'), {
        nombre: nombre,
        monto: parseFloat(monto),
        periodo: periodo,
        createdBy: currentUser.email,
        createdAt: new Date()
    });

    document.getElementById('nombreTasaInput').value = '';
    document.getElementById('montoTasaInput').value = '';
    document.getElementById('nombreTasaInput').focus();
    mostrarNotificacion('Tasa agregada - visible para todos ✓');
    } catch (error) {
    console.error('Error:', error);
    mostrarNotificacion('Error al agregar tasa');
    }
};

window.eliminarTasa = async function(id) {
    try {
    await deleteDoc(doc(db, 'tasas', id));
    mostrarNotificacion('Tasa eliminada - cambio visible para todos ✓');
    } catch (error) {
    mostrarNotificacion('Error al eliminar tasa');
    }
};

window.abrirModalEditarTasa = function(tasa) {
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
        <div class="form-row" style="grid-template-columns: 1fr;">
            <input 
            type="text" 
            id="editNombreTasa" 
            class="form-input" 
            placeholder="Nombre de la tasa"
            value="${tasa.nombre}"
            >
        </div>
        <div class="form-row" style="grid-template-columns: 1fr 1fr;">
            <input 
            type="number" 
            id="editMontoTasa" 
            class="form-input" 
            placeholder="Monto ($)"
            step="0.01"
            value="${tasa.monto}"
            >
            <select id="editPeriodoTasa" class="form-input">
            ${periodos.map(p => `<option value="${p}" ${p === tasa.periodo ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
        </div>
        <button class="add-btn" onclick="guardarEdicionTasa('${tasa.id}')">
            Guardar Cambios
        </button>
        </div>
    </div>
    `;
    document.body.appendChild(modal);
};

window.cerrarModalEditarTasa = function() {
    const modal = document.getElementById('modalEditarTasa');
    if (modal) modal.remove();
};

window.guardarEdicionTasa = async function(id) {
    const nombre = document.getElementById('editNombreTasa').value.trim();
    const monto = parseFloat(document.getElementById('editMontoTasa').value);
    const periodo = parseInt(document.getElementById('editPeriodoTasa').value);
    
    if (!nombre || !monto) {
    mostrarNotificacion('Completa todos los campos');
    return;
    }
    
    try {
    await updateDoc(doc(db, 'tasas', id), {
        nombre: nombre,
        monto: monto,
        periodo: periodo,
        lastModifiedBy: currentUser.email,
        lastModifiedAt: new Date()
    });

    cerrarModalEditarTasa();
    mostrarNotificacion('Tasa actualizada - cambio visible para todos ✓');
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

    await addDoc(collection(db, 'plantillas'), {
    nombre: nombre,
    tipo: tipo,
    contenido: contenido,
    createdBy: currentUser.email,
    createdAt: new Date()
    });

    document.getElementById('nombrePlantillaInput').value = '';
    document.getElementById('contenidoPlantillaInput').value = '';
    mostrarNotificacion('Plantilla agregada - visible para todos ✓');
    cambiarTab('plantillas');
};

window.eliminarPlantillaPersonalizada = async function(id) {
    if (!confirm('¿Eliminar esta plantilla?')) return;

    try {
    await deleteDoc(doc(db, 'plantillas', id));
    mostrarNotificacion('Plantilla eliminada - cambio visible para todos ✓');
    } catch (error) {
    mostrarNotificacion('Error al eliminar plantilla');
    }
};

window.guardarEdicionPlantilla = async function() {
    if (!plantillaEnEdicion) return;

    const nombre = document.getElementById('editNombrePlantilla').value.trim();
    const tipo = document.getElementById('editTipoPlantilla').value;
    const contenido = document.getElementById('editContenidoPlantilla').value.trim();
    
    if (!nombre || !contenido) {
    mostrarNotificacion('Completa todos los campos');
    return;
    }
    
    try {
    await updateDoc(doc(db, 'plantillas', plantillaEnEdicion.id), {
        nombre: nombre,
        tipo: tipo,
        contenido: contenido,
        lastModifiedBy: currentUser.email,
        lastModifiedAt: new Date()
    });

    cerrarModalEditar();
    mostrarNotificacion('Plantilla actualizada - cambio visible para todos ✓');
    } catch (error) {
    mostrarNotificacion('Error al actualizar plantilla');
    }
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
    mostrarNotificacion('Tipo agregado - visible para todos ✓');
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
    mostrarNotificacion('Tipo eliminado - cambio visible para todos ✓');
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
    let tasasDelPeriodo = tasas.filter(t => t.periodo === periodoActual);
    
    // APLICAR FILTRO DE BÚSQUEDA
    if (filtrosBusqueda.tasas) {
        tasasDelPeriodo = tasasDelPeriodo.filter(t => 
            t.nombre.toLowerCase().includes(filtrosBusqueda.tasas)
        );
    }
    
    if (tasasDelPeriodo.length === 0) {
        const mensajeBusqueda = filtrosBusqueda.tasas 
            ? 'No se encontraron tasas con ese nombre' 
            : `No hay tasas para ${periodoActual}`;
        
        lista.innerHTML = `
            <div class="empty-state">
                <p>${mensajeBusqueda}</p>
                <p style="font-size: 0.85rem; margin-top: 8px;">
                    ${filtrosBusqueda.tasas ? 'Intenta con otros términos' : 'Agrega tasas para este año'}
                </p>
            </div>
        `;
        return;
    }

    lista.innerHTML = tasasDelPeriodo.map(tasa => `
        <div class="tasa-item">
            <input type="checkbox" class="tasa-checkbox" ${tasasSeleccionadas.has(tasa.id) ? 'checked' : ''} onchange="toggleSeleccionTasa('${tasa.id}')">
            <div class="tasa-info">
                <div class="tasa-nombre">${tasa.nombre}</div>
                <div class="tasa-monto">$${tasa.monto.toFixed(2)}</div>
            </div>
            <div class="tasa-actions">
                <button class="use-btn" onclick='usarTasa(${JSON.stringify(tasa)})' title="Copiar monto">📄</button>
                <button class="edit-template-btn" onclick='abrirModalEditarTasa(${JSON.stringify(tasa).replace(/'/g, "&apos;")})' title="Editar" style="padding: 6px 10px; background: #edf2f7; color: #4a5568;">✏️</button>
                <button class="delete-btn" onclick="eliminarTasa('${tasa.id}')" title="Eliminar">🗑️</button>
            </div>
        </div>
    `).join('');
}

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

window.copiarPlantilla = function(plantilla) {
    const ruta = document.getElementById('rutaInput').value.trim() || 'LIM';
    const ce2 = document.getElementById('ce2Input').value;
    const fecha = document.getElementById('fechaInput').value.trim() ||'';
    
    let textoFinal = plantilla.contenido
    .replace(/{RUTA}/g, ruta)
    .replace(/{CE2}/g, ce2)
    .replace(/{FECHA}/g, fecha);
    
    copiarTexto(textoFinal);
    mostrarNotificacion('Plantilla copiada');
    generarCE2();
};

function renderizarTodasLasPlantillas() {
    const grid = document.getElementById('templatesGrid');
    const ruta = document.getElementById('rutaInput').value.trim() || 'LIM';
    const ce2 = document.getElementById('ce2Input').value;
    const fecha = document.getElementById('fechaInput').value.trim() ||'';

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
            .replace(/{RUTA}/g, ruta)
            .replace(/{CE2}/g, ce2)
            .replace(/{FECHA}/g, fecha);
        
        const tipoClass = plantilla.tipo || 'reembolso';
        const puedeEditar = !plantilla.predeterminada;
        
        return `
            <div class="template-card"
            draggable="${puedeEditar ? 'true' : 'false'}"
            ondragstart="${puedeEditar ? `handleDragStart(event, ${JSON.stringify(plantilla).replace(/'/g, '&apos;')})` : ''}"
            ondragover="${puedeEditar ? 'handleDragOver(event)' : ''}"
            ondragenter="${puedeEditar ? 'handleDragEnter(event)' : ''}"
            ondragleave="${puedeEditar ? 'handleDragLeave(event)' : ''}"
            ondrop="${puedeEditar ? `handleDrop(event, ${JSON.stringify(plantilla).replace(/'/g, '&apos;')})` : ''}"
            ondragend="${puedeEditar ? 'handleDragEnd(event)' : ''}">
                <div class="template-header">
                    ${puedeEditar ? '<span class="drag-handle" title="Arrastra para reordenar">⋮⋮</span>' : ''}
                    <div class="template-title-wrapper">
                        <div class="template-title">${plantilla.nombre}</div>
                        <span class="template-type ${tipoClass}">${(plantilla.tipo || 'reembolso').charAt(0).toUpperCase() + (plantilla.tipo || 'reembolso').slice(1)}</span>
                    </div>
                    ${puedeEditar ? `
                        <div class="template-actions">
                        <button class="edit-template-btn" onclick='abrirModalEditar(${JSON.stringify(plantilla).replace(/'/g, "&apos;")})'>✏️</button>
                        <button class="delete-template-btn" onclick="eliminarPlantillaPersonalizada('${plantilla.id}')">🗑️</button>
                        </div>
                    ` : ''}
                </div>
                <div class="template-content">${contenidoPreview}</div>
                <button class="copy-btn" onclick='copiarPlantilla(${JSON.stringify(plantilla).replace(/'/g, "&apos;")})'>Copiar Plantilla</button>
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
        <button class="delete-btn" onclick="eliminarPeriodo(${periodo})">Eliminar</button>
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
        <button class="delete-btn" onclick="eliminarTipo('${tipo}')">Eliminar</button>
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
    e.dataTransfer.setData('text/html', draggedElement.innerHTML);
};

window.handleDragOver = function(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    
    const afterElement = getDragAfterElement(e.currentTarget.parentElement, e.clientY);
    const draggable = document.querySelector('.dragging');
    
    if (afterElement == null) {
        e.currentTarget.parentElement.appendChild(draggable);
    } else {
        e.currentTarget.parentElement.insertBefore(draggable, afterElement);
    }
    
    return false;
};

window.handleDragEnter = function(e) {
    const card = e.target.closest('.template-card');
    if (card && card !== draggedElement) {
        card.classList.add('drag-over');
    }
};

window.handleDragLeave = function(e) {
    const card = e.target.closest('.template-card');
    if (card) {
        card.classList.remove('drag-over');
    }
};

window.handleDrop = async function(e, plantilla) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    e.target.closest('.template-card').classList.remove('drag-over');
    
    if (draggedPlantilla && draggedPlantilla.id !== plantilla.id) {
        // Reordenar el array de plantillas
        const draggedIndex = plantillasPersonalizadas.findIndex(p => p.id === draggedPlantilla.id);
        const targetIndex = plantillasPersonalizadas.findIndex(p => p.id === plantilla.id);
        
        if (draggedIndex !== -1 && targetIndex !== -1) {
            // Remover del índice original
            const [removed] = plantillasPersonalizadas.splice(draggedIndex, 1);
            // Insertar en nuevo índice
            plantillasPersonalizadas.splice(targetIndex, 0, removed);
            
            // Guardar nuevo orden en Firebase
            await guardarOrdenPlantillas();
            
            mostrarNotificacion('Orden actualizado ✓');
        }
    }
    
    return false;
};

window.handleDragEnd = function(e) {
    const cards = document.querySelectorAll('.template-card');
    cards.forEach(card => {
        card.classList.remove('dragging', 'drag-over');
    });
    draggedElement = null;
    draggedPlantilla = null;
};

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.template-card:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

async function guardarOrdenPlantillas() {
    try {
        // Actualizar el orden de cada plantilla en Firebase
        const batch = [];
        plantillasPersonalizadas.forEach((plantilla, index) => {
            if (!plantilla.predeterminada) {
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
    }
}
