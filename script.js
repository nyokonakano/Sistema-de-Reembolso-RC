// Variables globales para Three.js
let scene, camera, renderer, controls;
let currentSolid = null;
// Inicialización al cargar la página
document.addEventListener('DOMContentLoaded', function() {
    initThreeJS();
    setupEventListeners();
    // Calcular ejemplo inicial
    calculateAndVisualize();
});
// Configuración inicial de Three.js
function initThreeJS() {
    const canvas = document.getElementById('canvas3d');
    const container = canvas.parentElement;
    
    // Crear escena
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);
    
    // Configurar cámara
    camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(8, 5, 8);
    
    // Crear renderer
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Configurar controles de cámara (OrbitControls simulado)
    setupControls();
    
    // Añadir luces
    setupLighting();
    
    // Añadir ejes de coordenadas
    addAxes();
    
    // Manejar redimensionamiento
    window.addEventListener('resize', onWindowResize);
    
    // Iniciar loop de renderizado
    animate();
}
// Configurar controles de cámara (implementación básica)
function setupControls() {
    let isMouseDown = false;
    let mouseX = 0, mouseY = 0;
    let targetX = 0, targetY = 0;
    
    const canvas = renderer.domElement;
    
    canvas.addEventListener('mousedown', (e) => {
        isMouseDown = true;
        mouseX = e.clientX;
        mouseY = e.clientY;
    });
    
    canvas.addEventListener('mousemove', (e) => {
        if (!isMouseDown) return;
        
        const deltaX = e.clientX - mouseX;
        const deltaY = e.clientY - mouseY;
        
        targetX += deltaX * 0.01;
        targetY += deltaY * 0.01;
        
        mouseX = e.clientX;
        mouseY = e.clientY;
        
        // Rotar cámara alrededor del origen
        const radius = camera.position.length();
        camera.position.x = radius * Math.cos(targetX) * Math.cos(targetY);
        camera.position.y = radius * Math.sin(targetY);
        camera.position.z = radius * Math.sin(targetX) * Math.cos(targetY);
        camera.lookAt(0, 0, 0);
    });
    
    canvas.addEventListener('mouseup', () => isMouseDown = false);
    
    // Zoom con rueda del mouse
    canvas.addEventListener('wheel', (e) => {
        const zoomSpeed = 0.1;
        const direction = e.deltaY > 0 ? 1 : -1;
        camera.position.multiplyScalar(1 + direction * zoomSpeed);
    });
}
// Configurar iluminación
function setupLighting() {
    // Luz ambiental
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);
    
    // Luz direccional principal
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);
    
    // Luz de relleno
    const fillLight = new THREE.DirectionalLight(0x4080ff, 0.3);
    fillLight.position.set(-5, 5, -5);
    scene.add(fillLight);
}
// Añadir ejes de coordenadas
function addAxes() {
    const axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);
    
    // Líneas de grilla en el plano XZ
    const gridHelper = new THREE.GridHelper(10, 20, 0x444444, 0x222222);
    scene.add(gridHelper);
}
// Configurar event listeners
function setupEventListeners() {
    // Botón principal de cálculo
    document.getElementById('calculate').addEventListener('click', calculateAndVisualize);
    
    // Botón de limpiar
    document.getElementById('clear').addEventListener('click', clearAll);
    
    // Botones de ejemplos
    document.querySelectorAll('.example-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.getElementById('function').value = this.dataset.func;
            document.getElementById('limitA').value = this.dataset.a;
            document.getElementById('limitB').value = this.dataset.b;
            calculateAndVisualize();
        });
    });
    
    // Enter en inputs
    ['function', 'limitA', 'limitB'].forEach(id => {
        document.getElementById(id).addEventListener('keypress', function(e) {
            if (e.key === 'Enter') calculateAndVisualize();
        });
    });
}
// Función principal de cálculo y visualización
function calculateAndVisualize() {
    try {
        // Obtener valores de entrada
        const funcStr = document.getElementById('function').value.trim();
        const a = parseFloat(document.getElementById('limitA').value);
        const b = parseFloat(document.getElementById('limitB').value);
        
        // Validar entrada
        if (!funcStr || isNaN(a) || isNaN(b) || a >= b) {
            throw new Error('Por favor ingresa una función válida y límites correctos (a < b)');
        }
        
        // Compilar función con Math.js
        const expr = math.compile(funcStr.replace(/\^/g, '^'));
        const f = (x) => expr.evaluate({x: x});
        
        // Probar la función
        f((a + b) / 2);
        
        // Calcular área superficial
        const result = calculateSurfaceArea(f, a, b, funcStr);
        
        // Mostrar resultados
        displayResults(result);
        
        // Generar y mostrar sólido 3D
        generateSolid(f, a, b);
        
    } catch (error) {
        showError(error.message);
    }
}
// Calcular área superficial usando integración numérica
function calculateSurfaceArea(f, a, b, funcStr) {
    const n = 1000; // Número de subdivisiones
    const h = (b - a) / n;
    
    // Calcular derivada numérica
    const df = (x) => {
        const dx = 0.0001;
        return (f(x + dx) - f(x - dx)) / (2 * dx);
    };
    
    // Integración por método del trapecio
    let sum = 0;
    for (let i = 0; i <= n; i++) {
        const x = a + i * h;
        const fx = f(x);
        const dfx = df(x);
        const integrand = fx * Math.sqrt(1 + dfx * dfx);
        
        if (i === 0 || i === n) {
            sum += integrand / 2;
        } else {
            sum += integrand;
        }
    }
    
    const area = 2 * Math.PI * h * sum;
    
    return {
        formula: `S = 2π ∫[${a},${b}] ${funcStr} √(1 + [f'(x)]²) dx`,
        calculation: `Usando método del trapecio con ${n} subdivisiones`,
        area: area
    };
}
// Mostrar resultados en la interfaz
function displayResults(result) {
    document.getElementById('formula').textContent = result.formula;
    document.getElementById('calculation').textContent = result.calculation;
    document.getElementById('final-result').textContent = `Área Superficial = ${result.area.toFixed(4)} unidades²`;
}
// Generar geometría 3D del sólido de revolución
function generateSolid(f, a, b) {
    // Remover sólido anterior
    if (currentSolid) {
        scene.remove(currentSolid);
        currentSolid = null;
    }
    
    // Crear geometría del sólido de revolución
    const segments = 64; // Resolución radial
    const rings = 100; // Resolución axial
    
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const indices = [];
    const normals = [];
    
    // Generar vértices
    for (let i = 0; i <= rings; i++) {
        const x = a + (b - a) * i / rings;
        const radius = Math.abs(f(x));
        
        for (let j = 0; j <= segments; j++) {
            const theta = 2 * Math.PI * j / segments;
            const y = radius * Math.cos(theta);
            const z = radius * Math.sin(theta);
            
            vertices.push(x, y, z);
            
            // Calcular normal aproximada
            const nx = 1;
            const ny = Math.cos(theta);
            const nz = Math.sin(theta);
            const len = Math.sqrt(nx*nx + ny*ny + nz*nz);
            normals.push(nx/len, ny/len, nz/len);
        }
    }
    
    // Generar índices para triángulos
    for (let i = 0; i < rings; i++) {
        for (let j = 0; j < segments; j++) {
            const a = i * (segments + 1) + j;
            const b = a + segments + 1;
            const c = a + 1;
            const d = b + 1;
            
            indices.push(a, b, c);
            indices.push(b, d, c);
        }
    }
    
    geometry.setIndex(indices);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    
    // Crear material con gradiente
    const material = new THREE.MeshPhongMaterial({
        color: 0x4080ff,
        shininess: 100,
        transparent: true,
        opacity: 0.9
    });
    
    // Crear mesh y añadir a la escena
    currentSolid = new THREE.Mesh(geometry, material);
    currentSolid.castShadow = true;
    currentSolid.receiveShadow = true;
    scene.add(currentSolid);
}
// Limpiar todos los campos y resultados
function clearAll() {
    // Limpiar campos de entrada
    document.getElementById('function').value = '';
    document.getElementById('limitA').value = '';
    document.getElementById('limitB').value = '';
    
    // Limpiar resultados
    document.getElementById('formula').textContent = '';
    document.getElementById('calculation').textContent = '';
    document.getElementById('final-result').textContent = '';
    
    // Remover sólido 3D
    if (currentSolid) {
        scene.remove(currentSolid);
        currentSolid = null;
    }
    
    // Focus en el campo de función
    document.getElementById('function').focus();
}
// Mostrar error en la interfaz
function showError(message) {
    document.getElementById('formula').textContent = 'Error:';
    document.getElementById('calculation').textContent = message;
    document.getElementById('final-result').textContent = '';
}
// Manejar redimensionamiento de ventana
function onWindowResize() {
    const container = document.getElementById('canvas3d').parentElement;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}
// Loop principal de renderizado
function animate() {
    requestAnimationFrame(animate);
    
    // Renderizar sin rotación automática
    renderer.render(scene, camera);
}
