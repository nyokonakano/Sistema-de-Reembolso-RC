let isDropdownOpen = false;
let tasas = [];

document.addEventListener('DOMContentLoaded', function() {
    cargarTasas();
    generarCE2();
    actualizarPlantillas();
    
    document.getElementById('rutaInput').addEventListener('input', actualizarPlantillas);
    
    // Enter para agregar tasa
    document.getElementById('montoTasaInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        agregarTasa();
    }
    });
});

async function cargarTasas() {
    try {
    const result = await window.storage.get('tasas-guardadas');
    if (result && result.value) {
        tasas = JSON.parse(result.value);
        renderizarTasas();
    }
    } catch (error) {
    console.log('No hay tasas guardadas previamente');
    }
}

async function guardarTasas() {
    try {
    await window.storage.set('tasas-guardadas', JSON.stringify(tasas));
    } catch (error) {
    console.error('Error al guardar tasas:', error);
    }
}

function agregarTasa() {
    const nombre = document.getElementById('nombreTasaInput').value.trim();
    const monto = document.getElementById('montoTasaInput').value.trim();

    if (!nombre || !monto) {
    mostrarNotificacion('Por favor completa todos los campos');
    return;
    }

    const nuevaTasa = {
    id: Date.now(),
    nombre: nombre,
    monto: parseFloat(monto)
    };

    tasas.push(nuevaTasa);
    guardarTasas();
    renderizarTasas();

    document.getElementById('nombreTasaInput').value = '';
    document.getElementById('montoTasaInput').value = '';
    document.getElementById('nombreTasaInput').focus();

    mostrarNotificacion('Tasa agregada correctamente');
}

function eliminarTasa(id) {
    tasas = tasas.filter(t => t.id !== id);
    guardarTasas();
    renderizarTasas();
    mostrarNotificacion('Tasa eliminada');
}

function usarTasa(tasa) {
    const texto = `${tasa.nombre}: $${tasa.monto.toFixed(2)}`;
    
    if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(texto)
        .then(() => {
        mostrarNotificacion('Tasa copiada al portapapeles');
        })
        .catch(() => {
        copiarTextoFallback(texto);
        });
    } else {
    copiarTextoFallback(texto);
    }
}

function renderizarTasas() {
    const lista = document.getElementById('tasasList');
    
    if (tasas.length === 0) {
    lista.innerHTML = `
        <div class="empty-state">
        <p>No hay tasas guardadas</p>
        <p style="font-size: 0.85rem; margin-top: 8px;">Agrega tasas para usarlas rápidamente</p>
        </div>
    `;
    return;
    }

    lista.innerHTML = tasas.map(tasa => `
    <div class="tasa-item">
        <div class="tasa-info">
        <div class="tasa-nombre">${tasa.nombre}</div>
        <div class="tasa-monto">$${tasa.monto.toFixed(2)}</div>
        </div>
        <div class="tasa-actions">
        <button class="use-btn" onclick="usarTasa(${JSON.stringify(tasa).replace(/"/g, '&quot;')})">
            📋 Usar
        </button>
        <button class="delete-btn" onclick="eliminarTasa(${tasa.id})">
            🗑️
        </button>
        </div>
    </div>
    `).join('');
}

function generarCE2() {
    let numero;
    do {
    numero = Math.floor(Math.random() * 9000000) + 1000000;
    } while (numero.toString().startsWith('2'));
    
    document.getElementById('ce2Input').value = numero;
    actualizarPlantillas();
}

function actualizarPlantillas() {
    const ruta = document.getElementById('rutaInput').value.trim() || 'LIM';
    const ce2 = document.getElementById('ce2Input').value;

    const template1Content = `RC REFUND
SE SOLICITA REEMBOLSO DE IMPUESTOS.
RUTA: ${ruta}
REEMBOLSO SOLO TAXAS - NO SE ENVIA NOTA DE CREDITO.
DATOS/CE2${ce2}
soportereembolsos@ContinentalTravel.com.pe`;

    const template2Content = `SE SOLICITA REEMBOLSO DE IMPUESTOS.
RUTA: ${ruta}
REEMBOLSO SOLO TAXAS - NO SE ENVIA NOTA DE CREDITO.
DATOS/CE2${ce2}
soportereembolsos@ContinentalTravel.com.pe`;

    document.getElementById('template1').textContent = template1Content;
    document.getElementById('template2').textContent = template2Content;
}

function toggleDropdown() {
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
}

function copiarTexto(templateId, button) {
    const texto = document.getElementById(templateId).textContent;
    
    if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(texto)
        .then(() => {
        mostrarNotificacion('Texto copiado al portapapeles');
        animarBoton(button);
        generarCE2();
        })
        .catch(() => {
        copiarTextoFallback(texto, button);
        });
    } else {
    copiarTextoFallback(texto, button);
    }
}

function copiarTextoFallback(texto, button) {
    const textArea = document.createElement('textarea');
    textArea.value = texto;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
    document.execCommand('copy');
    mostrarNotificacion('Texto copiado al portapapeles');
    if (button) {
        animarBoton(button);
        generarCE2();
    }
    } catch (err) {
    console.error('Error al copiar:', err);
    alert('Error al copiar el texto. Por favor, cópialo manualmente.');
    } finally {
    document.body.removeChild(textArea);
    }
}

function mostrarNotificacion(mensaje) {
    const toast = document.getElementById('toast');
    toast.textContent = mensaje;
    toast.classList.add('show');
    
    setTimeout(() => {
    toast.classList.remove('show');
    }, 3000);
}

function animarBoton(button) {
    const textoOriginal = button.innerHTML;
    button.innerHTML = '✓ ¡Copiado!';
    button.classList.add('copied');
    
    setTimeout(() => {
    button.innerHTML = textoOriginal;
    button.classList.remove('copied');
    }, 2000);
}

let lastTouchEnd = 0;
document.addEventListener('touchend', function (event) {
    const now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) {
    event.preventDefault();
    }
    lastTouchEnd = now;
}, false);