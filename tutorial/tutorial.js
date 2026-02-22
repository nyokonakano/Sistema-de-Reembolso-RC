class TutorialInteractivo {
  constructor() {
    this.pasoActual = 0;
    this.pasos = [
      {
        elemento: '.header-title',
        titulo: '¡Bienvenido! 👋',
        descripcion: 'Este es el Sistema de Reembolsos RC de Continental Travel. Te guiaré por todas las funcionalidades paso a paso.',
        posicion: 'bottom'
      },
      {
        elemento: '#rutaInput',
        titulo: 'Ruta de Vuelo ✈️',
        descripcion: 'Aquí ingresa la ruta del vuelo. Puedes usar formatos como LIM-MIA-LIM, LIM/MIA/LIM o LIM-MIA // MIA-LIM. El sistema los convertirá automáticamente.',
        posicion: 'bottom'
      },
      {
        elemento: '#ce2Input',
        titulo: 'Número CE2 🔢',
        descripcion: 'Este campo genera automáticamente un número CE2 único. Haz clic en "Generar" para crear uno nuevo. Se genera automáticamente después de copiar cada plantilla.',
        posicion: 'bottom'
      },
      {
        elemento: '#fechaInput',
        titulo: 'Fecha 📅',
        descripcion: 'Ingresa la fecha en formato DD-MMM-YY, por ejemplo: 19-FEB-25. Este campo es opcional pero útil para plantillas que lo requieran.',
        posicion: 'bottom'
      },
      {
        elemento: '#numeroRIInput',
        titulo: 'Número RI 📋',
        descripcion: 'Para reembolsos indirectos, ingresa el número RI aquí. Este campo aparecerá en las plantillas que usen la variable {NUMERO_RI}.',
        posicion: 'bottom'
      },
      {
        elemento: '#searchPlantillas',
        titulo: 'Buscar Plantillas 🔍',
        descripcion: 'Usa esta barra para buscar plantillas por nombre o contenido. También puedes filtrar por tipo de plantilla usando el selector al lado.',
        posicion: 'bottom'
      },
      {
        elemento: '.template-dropdown',
        titulo: 'Tus Plantillas 📝',
        descripcion: 'Aquí verás todas las plantillas disponibles. Las plantillas predeterminadas y las que tú crees aparecerán aquí. Haz clic para expandir.',
        posicion: 'top'
      },
      {
        elemento: '.tabs',
        titulo: 'Navegación por Pestañas 🗂️',
        descripcion: 'El sistema tiene 3 secciones principales: Plantillas (donde estás ahora), Tasas (para gestionar tasas aeroportuarias) y Crear Plantilla (para crear tus propias plantillas).',
        posicion: 'bottom'
      },
      {
        elemento: '.tab:nth-child(2)',
        titulo: 'Pestaña de Tasas 💰',
        descripcion: 'Haz clic aquí para gestionar tasas aeroportuarias por año. Puedes agregar, editar, eliminar y sumar múltiples tasas.',
        posicion: 'bottom',
        accion: () => {
          // Cambiar a la pestaña de tasas
          window.cambiarTab('tasas');
        }
      },
      {
        elemento: '.add-tasa-form',
        titulo: 'Agregar Tasas ➕',
        descripcion: 'Completa estos campos para agregar una nueva tasa: nombre, monto y año. Las tasas se guardan automáticamente y son visibles para todos los usuarios.',
        posicion: 'top'
      },
      {
        elemento: '.periodo-selector',
        titulo: 'Gestión de Años 📆',
        descripcion: 'Aquí puedes cambiar entre años y agregar nuevos períodos fiscales. Cada año tiene sus propias tasas independientes.',
        posicion: 'bottom'
      },

      {
        elemento: '.tab:nth-child(3)',
        titulo: 'Calculadora de Tasas 🧮',
        descripcion: 'Usa esta herramienta para sumar múltiples grupos de tasas. Puedes crear varios grupos independientes y calcular el total general.',
        posicion: 'bottom'
      },

      {
        elemento: '.tab:nth-child(4)',
        titulo: 'Crear Plantillas Personalizadas ✨',
        descripcion: 'Haz clic aquí para crear tus propias plantillas personalizadas con variables dinámicas.',
        posicion: 'bottom',
        accion: () => {
          window.cambiarTab('crear');
        }
      },
      {
        elemento: '#contenidoPlantillaInput',
        titulo: 'Variables Disponibles 🔤',
        descripcion: 'Puedes usar estas variables en tus plantillas: {RUTA}, {CE2}, {FECHA} y {NUMERO_RI}. Se reemplazarán automáticamente con los valores que ingreses.',
        posicion: 'top'
      },
      {
        elemento: '.user-info',
        titulo: 'Tu Cuenta 👤',
        descripcion: 'Aquí ves tu email y puedes cerrar sesión. Todos los cambios que hagas se sincronizan automáticamente con todos los usuarios.',
        posicion: 'bottom'
      },
      {
        elemento: '.header',
        titulo: '¡Tutorial Completado! 🎉',
        descripcion: 'Ahora conoces todas las funcionalidades del sistema. Puedes volver a ver este tutorial en cualquier momento haciendo clic en el botón 📚 flotante. ¡Éxito con tus reembolsos!',
        posicion: 'bottom'
      }
    ];
    
    this.overlay = null;
    this.tooltip = null;
    this.elementoActual = null;
  }

  iniciar() {
    this.pasoActual = 0;
    this.crearOverlay();
    this.crearTooltip();
    this.mostrarPaso();
  }

  crearOverlay() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'tutorial-overlay active';
    document.body.appendChild(this.overlay);
  }

  crearTooltip() {
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'tutorial-tooltip';
    this.tooltip.innerHTML = `
      <div class="tutorial-tooltip-header">
        <span class="tutorial-step-counter">Paso <span id="stepNumber">1</span> de ${this.pasos.length}</span>
        <button class="tutorial-close-btn" onclick="tutorial.cerrar()">×</button>
      </div>
      <h3 class="tutorial-tooltip-title" id="tutorialTitle"></h3>
      <p class="tutorial-tooltip-description" id="tutorialDescription"></p>
      <div class="tutorial-tooltip-actions">
        <button class="tutorial-btn tutorial-btn-skip" onclick="tutorial.cerrar()" id="skipBtn">Saltar tutorial</button>
        <div class="tutorial-btn-group">
          <button class="tutorial-btn tutorial-btn-secondary" onclick="tutorial.anterior()" id="prevBtn">← Anterior</button>
          <button class="tutorial-btn tutorial-btn-primary" onclick="tutorial.siguiente()" id="nextBtn">Siguiente →</button>
        </div>
      </div>
      <div class="tutorial-progress" id="tutorialProgress"></div>
      <div class="tutorial-arrow" id="tutorialArrow"></div>
    `;
    document.body.appendChild(this.tooltip);
  }

  mostrarPaso() {
    const paso = this.pasos[this.pasoActual];
    
    // Ejecutar acción si existe (para cambiar de tab, etc.)
    if (paso.accion) {
      paso.accion();
      // Esperar un poco para que el DOM se actualice
      setTimeout(() => this.continuarMostrandoPaso(paso), 300);
    } else {
      this.continuarMostrandoPaso(paso);
    }
  }

  continuarMostrandoPaso(paso) {
    // Limpiar highlight anterior
    if (this.elementoActual) {
      this.elementoActual.classList.remove('tutorial-highlight');
    }

    // Encontrar y resaltar nuevo elemento
    this.elementoActual = document.querySelector(paso.elemento);
    
    if (this.elementoActual) {
      this.elementoActual.classList.add('tutorial-highlight');
      
      // Scroll suave al elemento
      this.elementoActual.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });

      // Posicionar tooltip
      setTimeout(() => {
        this.posicionarTooltip(paso.posicion);
      }, 400);
    }

    // Actualizar contenido del tooltip
    document.getElementById('stepNumber').textContent = this.pasoActual + 1;
    document.getElementById('tutorialTitle').textContent = paso.titulo;
    document.getElementById('tutorialDescription').textContent = paso.descripcion;

    // Actualizar botones
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const skipBtn = document.getElementById('skipBtn');

    prevBtn.style.display = this.pasoActual === 0 ? 'none' : 'block';
    
    if (this.pasoActual === this.pasos.length - 1) {
      nextBtn.textContent = 'Finalizar ✓';
      skipBtn.style.display = 'none';
    } else {
      nextBtn.textContent = 'Siguiente →';
      skipBtn.style.display = 'block';
    }

    // Actualizar barra de progreso
    this.actualizarProgreso();
  }

  posicionarTooltip(posicion) {
    if (!this.elementoActual) return;

    const rect = this.elementoActual.getBoundingClientRect();
    const tooltip = this.tooltip;
    const arrow = document.getElementById('tutorialArrow');
    
    // Limpiar clases de flecha
    arrow.className = 'tutorial-arrow';

    const offset = 20;

    switch(posicion) {
      case 'top':
        tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
        tooltip.style.top = rect.top - tooltip.offsetHeight - offset + 'px';
        arrow.classList.add('arrow-bottom');
        break;
      
      case 'bottom':
        tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
        tooltip.style.top = rect.bottom + offset + 'px';
        arrow.classList.add('arrow-top');
        break;
      
      case 'left':
        tooltip.style.left = rect.left - tooltip.offsetWidth - offset + 'px';
        tooltip.style.top = rect.top + (rect.height / 2) - (tooltip.offsetHeight / 2) + 'px';
        arrow.classList.add('arrow-right');
        break;
      
      case 'right':
        tooltip.style.left = rect.right + offset + 'px';
        tooltip.style.top = rect.top + (rect.height / 2) - (tooltip.offsetHeight / 2) + 'px';
        arrow.classList.add('arrow-left');
        break;
    }

    // Ajustar si se sale de la pantalla
    const tooltipRect = tooltip.getBoundingClientRect();
    
    if (tooltipRect.right > window.innerWidth) {
      tooltip.style.left = window.innerWidth - tooltipRect.width - 20 + 'px';
    }
    
    if (tooltipRect.left < 0) {
      tooltip.style.left = '20px';
    }
    
    if (tooltipRect.bottom > window.innerHeight) {
      tooltip.style.top = window.innerHeight - tooltipRect.height - 20 + 'px';
    }
  }

  actualizarProgreso() {
    const progressContainer = document.getElementById('tutorialProgress');
    progressContainer.innerHTML = '';
    
    for (let i = 0; i < this.pasos.length; i++) {
      const dot = document.createElement('div');
      dot.className = 'tutorial-progress-dot';
      if (i === this.pasoActual) {
        dot.classList.add('active');
      }
      progressContainer.appendChild(dot);
    }
  }

  siguiente() {
    if (this.pasoActual < this.pasos.length - 1) {
      this.pasoActual++;
      this.mostrarPaso();
    } else {
      this.cerrar();
    }
  }

  anterior() {
    if (this.pasoActual > 0) {
      this.pasoActual--;
      this.mostrarPaso();
    }
  }

  cerrar() {
    // Limpiar highlight
    if (this.elementoActual) {
      this.elementoActual.classList.remove('tutorial-highlight');
    }

    // Remover overlay y tooltip
    if (this.overlay) {
      this.overlay.remove();
    }
    if (this.tooltip) {
      this.tooltip.remove();
    }

    // Mostrar botón FAB
    mostrarBotonTutorial();

    // Guardar que el usuario ya vio el tutorial
    localStorage.setItem('tutorialVisto', 'true');
  }
}

// Instancia global del tutorial
let tutorial = null;

// Función para iniciar el tutorial
window.iniciarTutorial = function() {
  tutorial = new TutorialInteractivo();
  tutorial.iniciar();
  ocultarBotonTutorial();
};

// Crear botón flotante
function crearBotonTutorial() {
  const fab = document.createElement('button');
  fab.className = 'tutorial-fab';
  fab.id = 'tutorialFab';
  fab.innerHTML = '📚';
  fab.title = 'Ver tutorial';
  fab.onclick = iniciarTutorial;
  document.body.appendChild(fab);
}

function mostrarBotonTutorial() {
  const fab = document.getElementById('tutorialFab');
  if (fab) {
    fab.classList.remove('hidden');
  }
}

function ocultarBotonTutorial() {
  const fab = document.getElementById('tutorialFab');
  if (fab) {
    fab.classList.add('hidden');
  }
}

// Inicializar al cargar la página
window.addEventListener('load', function() {
  crearBotonTutorial();
  
  // Si es la primera vez, iniciar tutorial automáticamente
  const tutorialVisto = localStorage.getItem('tutorialVisto');
  if (!tutorialVisto) {
    // Esperar a que el usuario inicie sesión
    setTimeout(() => {
      if (window.currentUser) {
        iniciarTutorial();
      }
    }, 2000);
  }
});