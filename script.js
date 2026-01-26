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
        <button class="modal-close" onclick="cerrarModalEditarTasa()" title="Cerrar Modal">×</button>
        </div>
        <div class="add-tasa-form">
        <div class="form-row" style="grid-template-columns: 1fr;">
            <input 
            type="text" 
            id="editNombreTasa" 
            class="form-input" 
            placeholder="Nombre de la tasa"
            value="${tasa.nombre}"
            title="Nombre de la tasa"
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
            title="Monto de la tasa"
            >
            <select id="editPeriodoTasa" class="form-input">
            ${periodos.map(p => `<option value="${p}" ${p === tasa.periodo ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
        </div>
        <button class="add-btn" onclick="guardarEdicionTasa('${tasa.id}')" title="Guardar Cambios">
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

    document.getElementById('nombrePlantillaInput').value = '';
    document.getElementById('contenidoPlantillaInput').value = '';
    mostrarNotificacion('Plantilla agregada - visible para todos ✓');
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

window.copiarPlantilla = function(plantilla) {
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
