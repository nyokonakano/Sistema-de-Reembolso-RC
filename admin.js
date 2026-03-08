import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {
  getAuth, signOut, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  getFirestore, collection, getDocs, addDoc, updateDoc,
  doc, query, orderBy, limit, where, onSnapshot, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ── FIREBASE CONFIG ──────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyB40AsFDc3mDU7DzXe4fwS2IX4uwP3SHVQ",
  authDomain:        "sistema-de-reembolsos-rc.firebaseapp.com",
  projectId:         "sistema-de-reembolsos-rc",
  storageBucket:     "sistema-de-reembolsos-rc.firebasestorage.app",
  messagingSenderId: "919633406296",
  appId:             "1:919633406296:web:94ee02ec2d987900a41d2d"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ── ESTADO ───────────────────────────────────────────────────
let currentAdmin  = null;
let allUsers      = [];
let allFeedback   = [];
let allAudit      = [];
let editingUserId = null;

// ════════════════════════════════════════════════════════════
// AUTH — detecta sesión activa de index.html
// ════════════════════════════════════════════════════════════

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }

  const perfil = await obtenerPerfil(user.email);

  if (!perfil || perfil.rol !== 'admin') {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('permDenied').classList.add('visible');
    document.getElementById('adminApp').classList.remove('visible');
    return;
  }

  // Es admin
  currentAdmin = user;
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('permDenied').classList.remove('visible');
  document.getElementById('adminApp').classList.add('visible');
  document.getElementById('topbarUser').textContent = user.email;

  await updatePresence(user.email, true);
  await registrarAudit('login', user.email, 'Ingresó al panel de administración');

  iniciarPanel();

  window.addEventListener('beforeunload', () => {
    updatePresence(user.email, false);
  });
});

// ════════════════════════════════════════════════════════════
// INICIALIZAR
// ════════════════════════════════════════════════════════════

function iniciarPanel() {
  escucharUsuarios();
  escucharFeedback();
  escucharAudit();
  cargarEstadisticas();

  // Cerrar modal al clic fuera
  const mu = document.getElementById('modalUser');
  if (mu) mu.addEventListener('click', e => { if (e.target === mu) window.closeModal('modalUser'); });
}

// ════════════════════════════════════════════════════════════
// FUNCIONES GLOBALES (window.*) — usadas desde onclick en HTML
// ════════════════════════════════════════════════════════════

window.adminLogout = async function () {
  if (currentAdmin) {
    await updatePresence(currentAdmin.email, false);
    await registrarAudit('logout', currentAdmin.email, 'Cerró sesión del panel admin');
  }
  await signOut(auth);
  window.location.href = 'index.html';
};

window.switchTab = function (name) {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-'   + name).classList.add('active');
  document.getElementById('panel-' + name).classList.add('active');
  if (name === 'stats') { renderActivityChart(); renderTopUsers(); }
};

window.closeModal = function (id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
};

window.renderUsers = function () {
  const tbody   = document.getElementById('usersTable');
  const search  = (document.getElementById('userSearch')?.value        || '').toLowerCase();
  const rolFil  =  document.getElementById('userRoleFilter')?.value    || '';
  const statFil =  document.getElementById('userStatusFilter')?.value  || '';

  let lista = [...allUsers];
  if (search)              lista = lista.filter(u => u.email?.toLowerCase().includes(search));
  if (rolFil)              lista = lista.filter(u => u.rol === rolFil);
  if (statFil === 'online')  lista = lista.filter(u => u.online  && u.estado !== 'blocked');
  if (statFil === 'offline') lista = lista.filter(u => !u.online && u.estado !== 'blocked');
  if (statFil === 'blocked') lista = lista.filter(u => u.estado === 'blocked');

  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty"><div class="empty-icon">👥</div>Sin resultados</div></td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map(u => {
    const blocked  = u.estado === 'blocked';
    const online   = u.online && !blocked;
    const dotClass = blocked ? 'blocked' : online ? 'online' : 'offline';
    const lbl      = blocked ? 'Bloqueado' : online ? 'En línea' : 'Offline';
    const badgeSt  = blocked ? 'badge-blocked' : online ? 'badge-online' : 'badge-offline';
    const rolBadge = u.rol === 'admin' ? 'badge-admin' : u.rol === 'editor' ? 'badge-editor' : 'badge-viewer';
    const rolLabel = u.rol === 'admin' ? '🛡️ Admin' : u.rol === 'editor' ? '✏️ Editor' : '👁 User';
    const lastSeen = u.lastSeen?.toDate  ? formatRelTime(u.lastSeen.toDate())                    : '—';
    const created  = u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString('es-PE') : '—';
    const esSelf   = u.email === currentAdmin?.email;

    return `<tr>
      <td>
        <span class="status-dot ${dotClass}"></span>
        <span class="badge ${badgeSt}">${lbl}</span>
      </td>
      <td style="color:var(--text);font-size:.82rem">
        ${escapeHtml(u.email || '—')}
        ${esSelf ? '<span style="color:var(--text3);font-size:.7rem"> (tú)</span>' : ''}
      </td>
      <td><span class="badge ${rolBadge}">${rolLabel}</span></td>
      <td>${lastSeen}</td>
      <td>${created}</td>
      <td>
        ${!esSelf
          ? `<button class="btn-xs" onclick="abrirEditarUsuario('${u.id}')">✏️ Editar</button>`
          : '<span style="color:var(--text3);font-size:.7rem">—</span>'
        }
      </td>
    </tr>`;
  }).join('');
};

window.abrirEditarUsuario = function (id) {
  const u = allUsers.find(x => x.id === id);
  if (!u) return;
  editingUserId = id;
  document.getElementById('modalUserEmail').textContent = u.email || '';
  document.getElementById('modalUserRole').value        = u.rol    || 'user';
  document.getElementById('modalUserStatus').value      = u.estado || 'active';
  document.getElementById('modalUser').classList.add('open');
};

window.saveUser = async function () {
  if (!editingUserId) return;
  const rol    = document.getElementById('modalUserRole').value;
  const estado = document.getElementById('modalUserStatus').value;
  const u      = allUsers.find(x => x.id === editingUserId);
  try {
    await updateDoc(doc(db, 'perfiles', editingUserId), {
      rol, estado,
      lastModifiedBy: currentAdmin.email,
      lastModifiedAt: serverTimestamp()
    });
    await registrarAudit('admin', currentAdmin.email,
      `Cambió rol de ${u?.email} → "${rol}", estado → "${estado}"`);
    window.closeModal('modalUser');
    toast('✓ Usuario actualizado');
  } catch (e) {
    toast('❌ Error: ' + e.message);
  }
};

window.renderFeedback = function () {
  const list    = document.getElementById('feedbackList');
  const statFil = document.getElementById('feedbackStatusFilter')?.value || '';
  const typeFil = document.getElementById('feedbackTypeFilter')?.value   || '';
  const search  = (document.getElementById('feedbackSearch')?.value      || '').toLowerCase();

  let data = [...allFeedback];
  if (statFil) data = data.filter(f => (f.adminEstado || 'pending') === statFil);
  if (typeFil) data = data.filter(f => f.tipo === typeFil);
  if (search)  data = data.filter(f =>
    f.mensaje?.toLowerCase().includes(search) ||
    f.email?.toLowerCase().includes(search)
  );

  if (!data.length) {
    list.innerHTML = `<div class="empty"><div class="empty-icon">💬</div>Sin resultados</div>`;
    return;
  }

  const emojiTipo = { sugerencia:'💡', bug:'🐛', pregunta:'❓', felicitacion:'⭐', otro:'📝' };

  list.innerHTML = data.map(f => {
    const estado = f.adminEstado || 'pending';
    const emoji  = emojiTipo[f.tipo] || '📝';
    const fecha  = f.fecha?.toDate ? formatRelTime(f.fecha.toDate()) : '—';
    const nota   = f.adminNota || '';

    const badgeEstado = estado === 'pending' ? 'badge-pending'
                      : estado === 'review'  ? 'badge-review'
                      :                        'badge-resolved';
    const labelEstado = estado === 'pending' ? '⏳ Pendiente'
                      : estado === 'review'  ? '🔍 En revisión'
                      :                        '✅ Resuelto';

    const selP = estado === 'pending'  ? 'style="border-color:var(--warn);color:var(--warn)"'     : '';
    const selR = estado === 'review'   ? 'style="border-color:var(--accent);color:var(--accent)"' : '';
    const selS = estado === 'resolved' ? 'style="border-color:var(--accent2);color:var(--accent2)"': '';

    return `
      <div class="feedback-card ${estado}">
        <div class="feedback-meta">
          <span class="feedback-from">${escapeHtml(f.usuario || f.email || 'Anónimo')}</span>
          <span class="badge ${badgeEstado}">${labelEstado}</span>
          <span class="badge" style="background:var(--surface2);color:var(--text2);border-color:var(--border2)">
            ${emoji} ${f.tipo || 'otro'}
          </span>
          <span class="feedback-date">${fecha}</span>
        </div>
        <div class="feedback-msg">${escapeHtml(f.mensaje || '')}</div>
        ${nota ? `<div class="feedback-note-display">📌 Nota: ${escapeHtml(nota)}</div>` : ''}
        <div class="feedback-actions">
          <input type="text" class="feedback-note-input" id="nota-${f.id}"
            placeholder="Nota interna..." value="${escapeHtml(nota)}">
          <button class="btn-xs" onclick="cambiarEstadoFeedback('${f.id}','pending')"  ${selP}>⏳ Pendiente</button>
          <button class="btn-xs" onclick="cambiarEstadoFeedback('${f.id}','review')"   ${selR}>🔍 Revisión</button>
          <button class="btn-xs success" onclick="cambiarEstadoFeedback('${f.id}','resolved')" ${selS}>✅ Resuelto</button>
          <button class="btn-xs" onclick="guardarNota('${f.id}')">💾 Nota</button>
        </div>
      </div>`;
  }).join('');
};

window.cambiarEstadoFeedback = async function (id, estado) {
  try {
    await updateDoc(doc(db, 'feedback', id), {
      adminEstado:      estado,
      adminAtendidoPor: currentAdmin.email,
      adminAtendidoAt:  serverTimestamp()
    });
    await registrarAudit('feedback', currentAdmin.email, `Cambió estado de feedback a "${estado}"`);
    toast('Estado actualizado → ' + estado);
  } catch { toast('❌ Error al actualizar'); }
};

window.guardarNota = async function (id) {
  const nota = (document.getElementById('nota-' + id)?.value || '').trim();
  try {
    await updateDoc(doc(db, 'feedback', id), {
      adminNota:   nota,
      adminNotaBy: currentAdmin.email,
      adminNotaAt: serverTimestamp()
    });
    toast('📌 Nota guardada');
  } catch { toast('❌ Error al guardar nota'); }
};

window.renderAudit = function () {
  const container = document.getElementById('auditLog');
  const search    = (document.getElementById('auditSearch')?.value     || '').toLowerCase();
  const actFil    =  document.getElementById('auditActionFilter')?.value || '';

  let data = [...allAudit];
  if (search) data = data.filter(a =>
    a.descripcion?.toLowerCase().includes(search) ||
    a.usuario?.toLowerCase().includes(search)
  );
  if (actFil) data = data.filter(a => a.tipo === actFil);

  if (!data.length) {
    container.innerHTML = `<div class="empty"><div class="empty-icon">🗒️</div>Sin registros</div>`;
    return;
  }

  const iconMap = {
    login:'🔑', logout:'🚪', plantilla:'📝', tasa:'💰',
    feedback:'💬', admin:'🛡️', copy:'📋', delete:'🗑️', edit:'✏️'
  };

  container.innerHTML = data.map(a => {
    const icon  = iconMap[a.tipo] || '⚙️';
    const fecha = a.timestamp?.toDate ? formatDateTime(a.timestamp.toDate()) : '—';
    return `
      <div class="log-entry">
        <span class="log-time">${fecha}</span>
        <span class="log-icon">${icon}</span>
        <div class="log-text">
          <strong>${escapeHtml(a.usuario || '—')}</strong> — ${escapeHtml(a.descripcion || '')}
        </div>
      </div>`;
  }).join('');
};

window.exportAuditCSV = function () {
  if (!allAudit.length) { toast('Sin registros para exportar'); return; }
  const header = ['Fecha','Usuario','Tipo','Descripción'];
  const rows   = allAudit.map(a => [
    a.timestamp?.toDate ? a.timestamp.toDate().toLocaleString('es-PE') : '',
    a.usuario || '', a.tipo || '',
    (a.descripcion || '').replace(/"/g, '""')
  ]);
  const csv  = [header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `audit-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('⬇ CSV exportado');
};

// ════════════════════════════════════════════════════════════
// FUNCIONES INTERNAS
// ════════════════════════════════════════════════════════════

async function obtenerPerfil(email) {
  try {
    const snap = await getDocs(query(collection(db, 'perfiles'), where('email', '==', email)));
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() };
  } catch { return null; }
}

async function updatePresence(email, online) {
  try {
    const perfil = await obtenerPerfil(email);
    if (perfil) {
      await updateDoc(doc(db, 'perfiles', perfil.id), { online, lastSeen: serverTimestamp() });
    } else {
      await addDoc(collection(db, 'perfiles'), {
        email, rol: 'user', estado: 'active',
        online, lastSeen: serverTimestamp(), createdAt: serverTimestamp()
      });
    }
  } catch (e) { console.error('Presencia error:', e); }
}

function escucharUsuarios() {
  onSnapshot(collection(db, 'perfiles'), snap => {
    allUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    window.renderUsers();
    renderStats();
  });
}

function escucharFeedback() {
  const q = query(collection(db, 'feedback'), orderBy('fecha', 'desc'));
  onSnapshot(q, snap => {
    allFeedback = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    window.renderFeedback();
    actualizarBadgeFeedback();
    renderStats();
  });
}

function actualizarBadgeFeedback() {
  const n     = allFeedback.filter(f => !f.adminEstado || f.adminEstado === 'pending').length;
  const badge = document.getElementById('feedbackBadge');
  if (!badge) return;
  badge.textContent   = n;
  badge.style.display = n > 0 ? 'inline-block' : 'none';
}

function escucharAudit() {
  const q = query(collection(db, 'auditLog'), orderBy('timestamp', 'desc'), limit(300));
  onSnapshot(q, snap => {
    allAudit = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    window.renderAudit();
    renderStats();
  });
}

async function registrarAudit(tipo, usuario, descripcion) {
  try {
    await addDoc(collection(db, 'auditLog'), { tipo, usuario, descripcion, timestamp: serverTimestamp() });
  } catch { /* silencioso */ }
}

async function cargarEstadisticas() {
  try {
    const [pSnap, tSnap] = await Promise.all([
      getDocs(collection(db, 'plantillas')),
      getDocs(collection(db, 'tasas'))
    ]);
    document.getElementById('statPlantillas').textContent = pSnap.size;
    document.getElementById('statTasas').textContent      = tSnap.size;
  } catch { /**/ }
  renderStats();
  renderActivityChart();
  renderTopUsers();
}

function renderStats() {
  document.getElementById('statUsers').textContent    = allUsers.length;
  document.getElementById('statOnline').textContent   = allUsers.filter(u => u.online && u.estado !== 'blocked').length;
  document.getElementById('statFeedback').textContent = allFeedback.filter(f => !f.adminEstado || f.adminEstado === 'pending').length;
  document.getElementById('statLogs').textContent     = allAudit.length;
}

function renderActivityChart() {
  const chart = document.getElementById('activityChart');
  if (!chart) return;
  const days = [], counts = [];
  const now  = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    days.push(d); counts.push(0);
  }
  allAudit.forEach(a => {
    if (!a.timestamp?.toDate) return;
    const t = a.timestamp.toDate();
    for (let i = 0; i < 7; i++) { if (sameDay(t, days[i])) { counts[i]++; break; } }
  });
  const maxCount = Math.max(...counts, 1);
  const dayNames = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  chart.innerHTML = counts.map((c, i) => {
    const pct = Math.round((c / maxCount) * 100);
    return `
      <div class="chart-bar-wrap" title="${c} acciones">
        <div class="chart-bar" style="height:${Math.max(pct,3)}%"></div>
        <div class="chart-label">${dayNames[days[i].getDay()]}</div>
      </div>`;
  }).join('');
}

function renderTopUsers() {
  const tbody = document.getElementById('topUsersTable');
  if (!allAudit.length) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty" style="padding:16px">Sin datos aún</div></td></tr>`;
    return;
  }
  const conteo = {}, lastSeen = {};
  allAudit.forEach(a => {
    if (!a.usuario) return;
    conteo[a.usuario] = (conteo[a.usuario] || 0) + 1;
    const t = a.timestamp?.toDate ? a.timestamp.toDate() : null;
    if (t && (!lastSeen[a.usuario] || t > lastSeen[a.usuario])) lastSeen[a.usuario] = t;
  });
  const sorted = Object.entries(conteo).sort(([,a],[,b]) => b - a).slice(0, 8);
  tbody.innerHTML = sorted.map(([email, count], i) => `
    <tr>
      <td style="color:var(--text3)">#${i+1}</td>
      <td style="color:var(--text);font-size:.82rem">${escapeHtml(email)}</td>
      <td><span style="color:var(--accent);font-weight:600">${count}</span>
          <span style="color:var(--text3);font-size:.7rem"> acciones</span></td>
      <td style="color:var(--text2)">${lastSeen[email] ? formatRelTime(lastSeen[email]) : '—'}</td>
    </tr>`).join('');
}

// ── Utilidades ────────────────────────────────────────────────
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}

function formatRelTime(date) {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60)    return 'hace unos segundos';
  if (diff < 3600)  return `hace ${Math.floor(diff/60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff/3600)} h`;
  return date.toLocaleDateString('es-PE');
}

function formatDateTime(date) {
  return date.toLocaleString('es-PE', {
    year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit'
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function toast(msg) {
  const el = document.getElementById('adminToast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}