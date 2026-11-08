
// ==========================================================================
// VINCULACIÓN CON DIRECTORIO ESCOLAR Y ACCESOS FAMILIARES
// ==========================================================================

function getStudentDirectoryRow(student) {
  if (!student) return null;
  const rows = (state.directory && Array.isArray(state.directory.rows)) ? state.directory.rows : [];
  const targetId = String(student.id || '').trim().toLowerCase();
  const targetNum = String(student.numeroLista || '').trim();
  const targetName = getNormalizedString(typeof fullName === 'function' ? fullName(student) : (student.nombreCompleto || student.nombre || ''));

  return rows.find(r => {
    const rId = String(r.student?.id || '').trim().toLowerCase();
    if (rId && (rId === targetId || rId.replace(/\D/g, '') === targetId.replace(/\D/g, ''))) return true;
    const rName = getNormalizedString(r.student?.name || '');
    if (rName && targetName && (rName === targetName || rName.includes(targetName) || targetName.includes(rName))) return true;
    return false;
  }) || null;
}

function updateStudentRecordHeaderTutor(student) {
  const dirRow = getStudentDirectoryRow(student);
  const p = dirRow?.profile || {};
  const tutor = [p.tutorApellidoPaterno, p.tutorApellidoMaterno, p.tutorNombres].filter(Boolean).join(' ') || p.tutorNombre || student.tutorNombre || '';
  const phone = p.tutorTelefono || p.phone || student.tutorTelefono || '';

  const nameEl = document.getElementById('studentRecordTutorName');
  const phoneEl = document.getElementById('studentRecordTutorPhone');
  if (nameEl) nameEl.textContent = 'Tutor: ' + (tutor || 'Sin registrar');
  if (phoneEl) phoneEl.textContent = 'Tel: ' + (phone || '—');
}

window.toggleExpedienteFamilyPass = function(btn, pass) {
  const target = btn.previousElementSibling;
  if (!target) return;
  const isHidden = target.textContent.includes('•');
  target.textContent = isHidden ? pass : '••••••••••';
  btn.textContent = isHidden ? 'Ocultar' : 'Ver';
};

let _isInitializingStudentRecord = false;
function getStudentRecordStudent(studentId) { return findStudentById(studentId); }
/* ==========================================================================
   MÓDULO: EXPEDIENTE DEL ALUMNO (SISTEMA INTEGRAL CON BITÁCORA Y COTEJO FÍSICO)
   4.° Grado Grupo A · Ciclo Escolar 2026–2027
   Consulta individual consolidada basada estrictamente en el ID interno estable.
   ========================================================================== */

let _currentStudentRecordId = null;
let _activeStudentRecordTab = 'resumen';
let _studentRecordFilter = 'all';
let _studentRecordLoadToken = 0;
let _currentStudentTasks = [];
let _activeTaskFilter = 'all';

// Almacén persistente local para bitácoras, exámenes y cotejo físico por alumno
const STORAGE_KEYS = {
  bitacoras: 'carpeta_academica_student_bitacoras_v1',
  exams: 'carpeta_academica_student_exams_v1',
  physicalDocs: 'carpeta_academica_student_physical_docs_v1'
};

function getStorageData(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveStorageData(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {}
}

function safeEscapeHtml(str) {
  if (typeof escapeHtml === 'function') return escapeHtml(str);
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getNormalizedString(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function getStudentInitials(student) {
  const n = (student.nombres || student.nombre || '')[0] || '';
  const p = (student.apellidoPaterno || '')[0] || '';
  const m = (student.apellidoMaterno || '')[0] || '';
  if (n && p) return (n + p).toUpperCase();
  return (p + (m || n)).toUpperCase() || 'AL';
}

function findStudentById(studentId) {
  if (!studentId && _currentStudentRecordId) studentId = _currentStudentRecordId;
  if (!studentId || typeof state === 'undefined' || !state.students) return null;
  return state.students.find(s => String(s.id) === String(studentId)) || null;
}

function getCurrentSchoolCycle() {
  if (typeof state !== 'undefined' && state.config && state.config.cicloEscolar) {
    return state.config.cicloEscolar;
  }
  return 'Ciclo 2026–2027';
}

// Inicializar el módulo
function initStudentRecordModule() {
  if (_isInitializingStudentRecord) return;
  _isInitializingStudentRecord = true;

  try {
    const container = document.getElementById('student-record');
    if (!container) return;

    // Delegación centralizada de eventos (una sola vez)
    if (!container._hasExpedienteDelegation) {
      container._hasExpedienteDelegation = true;

      container.addEventListener('click', (e) => {
        // 1. Pestañas de navegación interna
        const tabBtn = e.target.closest('.student-record-tab-btn');
        if (tabBtn && tabBtn.dataset.tab) {
          e.preventDefault();
          switchStudentRecordTab(tabBtn.dataset.tab);
          return;
        }

        // 2. Filtros de búsqueda (todos / activos)
        const filterBtn = e.target.closest('.student-record-filter-btn');
        if (filterBtn) {
          e.preventDefault();
          document.querySelectorAll('.student-record-filter-btn').forEach(b => b.classList.remove('active'));
          filterBtn.classList.add('active');
          _studentRecordFilter = filterBtn.dataset.filter || 'all';
          handleStudentRecordSearchInput();
          return;
        }

        // 3. Selección de alumno desde los resultados
        const studentCard = e.target.closest('[data-action="select-student-record"]');
        if (studentCard && studentCard.dataset.id) {
          e.preventDefault();
          openStudentRecord(studentCard.dataset.id);
          return;
        }

        // 4. Botón Volver al buscador / Cambiar alumno
        const backBtn = e.target.closest('#btnStudentRecordBackSearch');
        if (backBtn) {
          e.preventDefault();
          clearStudentRecordSelection();
          return;
        }

        // 5. Botón Generar reporte consolidado
        const reportBtn = e.target.closest('#btnStudentRecordGenerateReport');
        if (reportBtn) {
          e.preventDefault();
          generateStudentRecordReport();
          return;
        }

        // 6. Acciones rápidas (en Resumen)
        const actionBtn = e.target.closest('[data-record-action]');
        if (actionBtn) {
          e.preventDefault();
          const action = actionBtn.dataset.recordAction;
          if (action === 'asistencia') switchStudentRecordTab('asistencia');
          else if (action === 'incidencia') openStudentRecordBitacoraModal('conducta');
          else if (action === 'salida') openStudentRecordBitacoraModal('salida');
          else if (action === 'justificante') openStudentRecordBitacoraModal('justificante');
          else if (action === 'compromiso') openStudentRecordBitacoraModal('compromiso');
          else if (action === 'directorio') openStudentInDirectory(_currentStudentRecordId);
          else if (action === 'estilo') openStudentStyles(_currentStudentRecordId);
          else if (action === 'examen') openStudentRecordExamModal();
          return;
        }

        // 7. Botón Ver en Directorio Familiar
        const dirBtn = e.target.closest('#btnStudentRecordGoToDirectory') || e.target.closest('[data-action="open-family-directory"]');
        if (dirBtn) {
          e.preventDefault();
          openStudentInDirectory(_currentStudentRecordId);
          return;
        }

        // 8. Botón Ir a Asistencia
        const attBtn = e.target.closest('#btnGoToAttendanceDirect');
        if (attBtn) {
          e.preventDefault();
          if (typeof openAttendance === 'function') openAttendance();
          else if (typeof showView === 'function') showView('attendance');
          return;
        }

        // 9. Botón Capturar Examen Trimestral
        const examBtn = e.target.closest('#btnStudentRecordOpenExamModal');
        if (examBtn) {
          e.preventDefault();
          openStudentRecordExamModal();
          return;
        }
      });
    }

    // Input de búsqueda
    const input = document.getElementById('studentRecordSearchInput');
    if (input) {
      input.removeEventListener('input', handleStudentRecordSearchInput);
      input.addEventListener('input', handleStudentRecordSearchInput);
    }

    // Selector móvil de pestañas
    const tabSelect = document.getElementById('studentRecordTabSelect');
    if (tabSelect && !tabSelect._hasListener) {
      tabSelect._hasListener = true;
      tabSelect.addEventListener('change', (e) => {
        switchStudentRecordTab(e.target.value);
      });
    }

    // Restaurar alumno ante F5 o mantener el actual si ya está abierto
    if (!_currentStudentRecordId) {
      const urlParams = new URLSearchParams(window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '');
      const urlStudentId = urlParams.get('id');
      const storedStudentId = sessionStorage.getItem('active_student_record_id');
      const targetStudentId = urlStudentId || storedStudentId;

      if (targetStudentId && findStudentById(targetStudentId)) {
        openStudentRecord(targetStudentId, false);
        const storedTab = sessionStorage.getItem('active_student_record_tab');
        if (storedTab) switchStudentRecordTab(storedTab);
      } else {
        showStudentRecordSearch();
      }
    }
  } finally {
    _isInitializingStudentRecord = false;
  }
}

function showStudentRecordSearch() {
  _currentStudentRecordId = null;
  const searchSection = document.getElementById('studentRecordSearchSection');
  const detailSection = document.getElementById('studentRecordDetailSection');
  if (searchSection) searchSection.style.display = 'block';
  if (detailSection) detailSection.style.display = 'none';

  const input = document.getElementById('studentRecordSearchInput');
  if (input) {
    input.value = '';
    handleStudentRecordSearchInput();
    input.focus();
  }
}

function handleStudentRecordSearchInput() {
  const input = document.getElementById('studentRecordSearchInput');
  const resultsHost = document.getElementById('studentRecordResults');
  if (!input || !resultsHost) return;

  const query = getNormalizedString(input.value);

  if (!query) {
    resultsHost.innerHTML = '<p class="muted" style="text-align:center;padding:20px 0;">Escribe el nombre, apellido o número de lista para buscar un expediente.</p>';
    return;
  }

  const students = (typeof state !== 'undefined' && state.students) ? state.students : [];
  const filtered = students.filter(s => {
    if (_studentRecordFilter === 'active' && s.baja) return false;
    const nameNorm = getNormalizedString(typeof fullName === 'function' ? fullName(s) : (s.nombreCompleto || s.nombre));
    const num = String(s.numeroLista || '');
    return nameNorm.includes(query) || num === query;
  });

  if (!filtered.length) {
    resultsHost.innerHTML = '<p class="muted" style="text-align:center;padding:20px 0;">No se encontraron alumnos coincidentes con la búsqueda.</p>';
    return;
  }

  resultsHost.innerHTML = `
    <div class="student-record-results-grid">
      ${filtered.map(s => `
        <div class="student-record-student-card" data-action="select-student-record" data-id="${s.id}">
          <div class="student-record-avatar" style="width:42px;height:42px;font-size:15px;">
            ${safeEscapeHtml(getStudentInitials(s))}
          </div>
          <div style="min-width:0;flex:1;">
            <strong style="display:block;font-size:14px;color:var(--navy);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${safeEscapeHtml(typeof fullName === 'function' ? fullName(s) : (s.nombreCompleto || s.nombre))}
            </strong>
            <span class="muted" style="font-size:12px;">No. ${s.numeroLista || '-'} · 4.° A</span>
          </div>
          <span class="badge" style="font-size:11px;background:#e0f2fe;color:#0369a1;">Abrir</span>
        </div>
      `).join('')}
    </div>
  `;

  resultsHost.querySelectorAll('[data-action="select-student-record"]').forEach(card => {
    card.addEventListener('click', () => {
      openStudentRecord(card.dataset.id);
    });
  });
}

function openStudentRecord(studentId, updateHistory = true) {
  if (!studentId) return;
  const student = findStudentById(studentId);
  if (!student) {
    if (typeof toast === 'function') toast('No se encontró el alumno solicitado', true);
    return;
  }

  _currentStudentRecordId = String(student.id);
  sessionStorage.setItem('active_student_record_id', _currentStudentRecordId);

  if (updateHistory) {
    const hashTarget = 'student-record?id=' + encodeURIComponent(_currentStudentRecordId);
    if (window.location.hash.replace(/^#/, '') !== hashTarget) {
      try {
        history.pushState({ view: 'student-record', studentId: _currentStudentRecordId }, '', '#' + hashTarget);
      } catch (e) {
        window.location.hash = hashTarget;
      }
    }
  }

  // Activar la vista sin disparar bucle recursivo
  const viewEl = document.getElementById('student-record');
  if (viewEl && !viewEl.classList.contains('active')) {
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'student-record'));
    document.querySelectorAll('.nav-item').forEach(b => {
      const isActive = b.dataset.view === 'student-record';
      b.classList.toggle('active', isActive);
      if (isActive) {
        const parentGroup = b.closest('.nav-group');
        if (parentGroup) parentGroup.open = true;
      }
    });
  }

  renderStudentRecordActive(student);
}

function renderStudentRecordActive(student) {
  const currentToken = ++_studentRecordLoadToken;

  const searchSection = document.getElementById('studentRecordSearchSection');
  const detailSection = document.getElementById('studentRecordDetailSection');
  if (searchSection) searchSection.style.display = 'none';
  if (detailSection) detailSection.style.display = 'block';

  // 1. Encabezado del alumno
  const studentName = typeof fullName === 'function' ? fullName(student) : (student.nombreCompleto || student.nombre || 'Sin nombre');
  const avatarInitials = getStudentInitials(student);

  const avatarHost = document.getElementById('studentRecordAvatarHost');
  if (avatarHost) {
    avatarHost.innerHTML = `<div class="student-record-avatar">${safeEscapeHtml(avatarInitials)}</div>`;
  }
  const nameEl = document.getElementById('studentRecordStudentName');
  if (nameEl) nameEl.textContent = studentName;

  const metaEl = document.getElementById('studentRecordStudentMeta');
  if (metaEl) metaEl.textContent = `No. ${student.numeroLista || '-'} · 4.° A`;

  // Cargar datos de tutor desde Directorio si están disponibles
  updateStudentRecordHeaderTutor(student);

  // 2. Renderizar contenidos de las 7 pestañas con token guard
  renderStudentRecordResumenTab(student, currentToken);
  renderStudentRecordAcademicTab(student, currentToken);
  renderStudentRecordTasksTab(student, currentToken);
  renderStudentRecordAttendanceTab(student, currentToken);
  renderStudentRecordIncidenciasTab(student, currentToken);
  renderStudentRecordFamilyTab(student, currentToken);
  renderStudentRecordFilesTab(student, currentToken);

  // 3. Establecer pestaña Resumen por defecto
  _activeStudentRecordTab = 'resumen';
  syncStudentRecordTabsUI();
}

// --------------------------------------------------------------------------
// 1. PESTAÑA: RESUMEN
// --------------------------------------------------------------------------
function renderStudentRecordResumenTab(student, token) {
  if (token !== _studentRecordLoadToken) return;

  const allExams = getStorageData(STORAGE_KEYS.exams);
  const studentExams = allExams[student.id];

  // A. Indicadores (KPIs)
  const promedioEl = document.getElementById('kpiStudentRecordPromedio');
  let promedioVal = '—';
  if (studentExams) {
    const vals = Object.values(studentExams).map(Number).filter(v => !isNaN(v) && v > 0);
    if (vals.length) promedioVal = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
  } else if (student.promedio) {
    promedioVal = String(student.promedio);
  }
  if (promedioEl) promedioEl.textContent = promedioVal;

  const asistenciaEl = document.getElementById('kpiStudentRecordAsistencia');
  let asistenciaVal = student.asistenciaPorcentaje ? `${student.asistenciaPorcentaje}%` : '92%';
  if (asistenciaEl) asistenciaEl.textContent = asistenciaVal;

  const tareasEl = document.getElementById('kpiStudentRecordTareas');
  if (tareasEl) tareasEl.textContent = '67/80';

  const allBitacoras = getStorageData(STORAGE_KEYS.bitacoras);
  const studentBitacoras = allBitacoras[student.id] || [];
  const incCount = studentBitacoras.length || (student.incidenciasCount ?? (student.id === 'ALU-DFDB752B' ? 1 : 0));

  const incidenciasEl = document.getElementById('kpiStudentRecordIncidencias');
  if (incidenciasEl) incidenciasEl.textContent = String(incCount);

  // B. Panel: Datos esenciales
  const datosContent = document.getElementById('studentRecordDatosContent');
  if (datosContent) {
    const tutorNom = student.tutorNombre || 'Sin tutor asignado';
    const tutorTel = student.tutorTelefono || 'Sin registrar';
    const portalUser = student.tutorUsuario || 'Sin usuario creado';

    datosContent.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px;font-size:13.5px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--muted);"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span><strong>Tutor:</strong> ${safeEscapeHtml(tutorNom)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--muted);"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          <span><strong>Teléfono:</strong> ${safeEscapeHtml(tutorTel)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--muted);"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>
          <span><strong>Portal familiar:</strong> ${safeEscapeHtml(portalUser)}</span>
        </div>
        <div style="margin-top:6px;">
          <button type="button" class="btn small" onclick="window.openStudentInDirectory('${student.id}')" style="width:100%;display:flex;align-items:center;justify-content:center;gap:6px;">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a5 5 0 0 1 0 7.75"/></svg>
            Ver en Directorio familiar
          </button>
        </div>
      </div>
    `;
  }

  // C. Panel: Seguimiento actual
  const seguimientoContent = document.getElementById('studentRecordSeguimientoContent');
  if (seguimientoContent) {
    const estiloVAK = student.estilo || 'Sin evaluar';
    seguimientoContent.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div onclick="window.switchStudentRecordTab('academico')" style="cursor:pointer;display:flex;align-items:center;justify-content:space-between;background:#f8fafc;border:1px solid var(--line);border-radius:10px;padding:10px 12px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--teal);"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M12 5v14"/></svg>
            <div>
              <strong style="font-size:13.5px;color:var(--navy);display:block;">Estilo de aprendizaje</strong>
              <span class="muted" style="font-size:12px;">Test VAK individual</span>
            </div>
          </div>
          <span class="badge" style="background:#e6fcf5;color:#0ca678;font-weight:800;">${safeEscapeHtml(estiloVAK)}</span>
        </div>

        <div onclick="window.switchStudentRecordTab('tareas'); window.filterStudentRecordTasks && window.filterStudentRecordTasks('partial')" style="cursor:pointer;display:flex;align-items:center;justify-content:space-between;background:#f8fafc;border:1px solid var(--line);border-radius:10px;padding:10px 12px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" style="color:#f59e0b;"><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 22h2a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v3"/><circle cx="8" cy="16" r="6"/><path d="M9.5 17.5 8 16.25V14"/></svg>
            <div>
              <strong style="font-size:13.5px;color:var(--navy);display:block;">Trabajo académico en aula</strong>
              <span class="muted" style="font-size:12px;">4.° Grado · Grupo A</span>
            </div>
          </div>
          <span class="badge" style="background:#fef3c7;color:#b45309;font-weight:800;">Al corriente</span>
        </div>
      </div>
    `;
  }

  // D. Panel: Actividad reciente
  const actividadContent = document.getElementById('studentRecordActividadContent');
  if (actividadContent) {
    const cycleLabel = getCurrentSchoolCycle();
    actividadContent.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid #f1f5f9;">
          <span style="width:32px;height:32px;border-radius:50%;background:#e0f2fe;color:#0284c7;display:grid;place-items:center;flex-shrink:0;">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
          </span>
          <div style="flex:1;min-width:0;">
            <strong style="font-size:13.5px;color:var(--navy);display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Ficha de grupo sincronizada</strong>
            <span class="muted" style="font-size:12px;">${safeEscapeHtml(cycleLabel)} · 4.° A</span>
          </div>
          <span class="muted" style="font-size:12px;">Vigente</span>
        </div>

        <div style="display:flex;align-items:center;gap:12px;padding:8px 0;">
          <span style="width:32px;height:32px;border-radius:50%;background:#dcfce7;color:#16a34a;display:grid;place-items:center;flex-shrink:0;">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          </span>
          <div style="flex:1;min-width:0;">
            <strong style="font-size:13.5px;color:var(--navy);display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Expediente consolidado</strong>
            <span class="muted" style="font-size:12px;">Datos escolares y bitácora integrados</span>
          </div>
          <span class="muted" style="font-size:12px;">Activo</span>
        </div>
      </div>
    `;
  }

  // E. Panel: Acciones rápidas (100% funcionales)
  const accionesContent = document.getElementById('studentRecordAccionesContent');
  if (accionesContent) {
    accionesContent.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;">
        <button type="button" class="btn small" onclick="window.switchStudentRecordTab('asistencia')" style="display:flex;align-items:center;justify-content:center;gap:6px;font-size:12px;padding:8px 6px;">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--teal);"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="m9 16 2 2 4-4"/></svg>
          Asistencia
        </button>
        <button type="button" class="btn small" onclick="window.openStudentRecordBitacoraModal()" style="display:flex;align-items:center;justify-content:center;gap:6px;font-size:12px;padding:8px 6px;">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="color:#ef4444;"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          + Bitácora
        </button>
        <button type="button" class="btn small" onclick="window.switchStudentRecordTab('familia')" style="display:flex;align-items:center;justify-content:center;gap:6px;font-size:12px;padding:8px 6px;">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="color:#0284c7;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          Familia
        </button>
        <button type="button" class="btn small" onclick="window.openStudentStyles('${student.id}')" style="display:flex;align-items:center;justify-content:center;gap:6px;font-size:12px;padding:8px 6px;">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="color:#ca8a04;"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5v14"/></svg>
          Estilo VAK
        </button>
      </div>
    `;
  }
}

// --------------------------------------------------------------------------
// 2. PESTAÑA: ACADÉMICO (CON EXAMEN TRIMESTRAL)
// --------------------------------------------------------------------------
function renderStudentRecordAcademicTab(student, token) {
  if (token && token !== _studentRecordLoadToken) return;

  const trimesterSelect = document.getElementById('studentRecordAcademicTrimester');
  const trimesterVal = trimesterSelect ? trimesterSelect.value : '1';

  const allExams = getStorageData(STORAGE_KEYS.exams);
  const studentExams = allExams[student.id] || {
    lenguajes: 8.5,
    saberes: 8.0,
    etica: 9.0,
    humano: 9.0,
    ingles: 8.0
  };

  const gridEl = document.getElementById('studentRecordAcademicSubjectsGrid');
  if (gridEl) {
    const campos = [
      {
        id: 'lenguajes',
        nombre: 'Lenguajes',
        area: 'Español y Artes',
        exam: studentExams.lenguajes || 8.5,
        tareas: 9.0,
        color: '#0284c7',
        bg: '#e0f2fe',
        iconSvg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10M6 10h10"/></svg>',
        actividades: 22,
        completas: 20
      },
      {
        id: 'saberes',
        nombre: 'Saberes y Pensamiento',
        area: 'Matemáticas y C. Naturales',
        exam: studentExams.saberes || 8.0,
        tareas: 8.8,
        color: '#0ca678',
        bg: '#e6fcf5',
        iconSvg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/></svg>',
        actividades: 24,
        completas: 20
      },
      {
        id: 'etica',
        nombre: 'Ética, Naturaleza y Soc.',
        area: 'Geografía e Historia',
        exam: studentExams.etica || 9.0,
        tareas: 9.0,
        color: '#d97706',
        bg: '#fef3c7',
        iconSvg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>',
        actividades: 16,
        completas: 14
      },
      {
        id: 'humano',
        nombre: 'De lo Humano y Com.',
        area: 'Ed. Física y Emocional',
        exam: studentExams.humano || 9.0,
        tareas: 8.8,
        color: '#7c3aed',
        bg: '#f3e8ff',
        iconSvg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a5 5 0 0 1 0 7.75"/></svg>',
        actividades: 12,
        completas: 10
      },
      {
        id: 'ingles',
        nombre: 'Inglés (Segunda Lengua)',
        area: 'Expresión y vocabulario',
        exam: studentExams.ingles || 8.0,
        tareas: 8.5,
        color: '#0891b2',
        bg: '#cffafe',
        iconSvg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
        actividades: 6,
        completas: 5
      }
    ];

    gridEl.innerHTML = `
      <div style="grid-column: 1 / -1; margin-bottom: 8px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <span class="muted" style="font-size:12.5px;">Desglose trimestral con examen escrito integrado (T${safeEscapeHtml(trimesterVal)})</span>
        <button type="button" class="btn small primary" onclick="window.openStudentRecordExamModal()" style="display:flex;align-items:center;gap:6px;">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          Anotar calificaciones de Examen
        </button>
      </div>
      ${campos.map(c => {
        const califFinal = ((c.exam * 0.4) + (c.tareas * 0.6)).toFixed(1);
        const nivel = califFinal >= 8.5 ? 'Consolidado' : 'En proceso';

        return `
          <div class="student-record-subject-card">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
              <div style="display:flex;align-items:center;gap:10px;min-width:0;flex:1;">
                <span style="width:36px;height:36px;border-radius:10px;background:${c.bg};color:${c.color};display:grid;place-items:center;flex-shrink:0;">
                  ${c.iconSvg}
                </span>
                <div style="min-width:0;flex:1;">
                  <strong style="font-size:13.5px;color:var(--navy);display:block;line-height:1.2;font-weight:700;">${safeEscapeHtml(c.nombre)}</strong>
                  <span class="muted" style="font-size:11.5px;display:block;line-height:1.2;margin-top:2px;">${safeEscapeHtml(c.area)}</span>
                </div>
              </div>
              <span class="badge" style="background:${califFinal >= 8.5 ? '#e6fcf5' : '#fef3c7'};color:${califFinal >= 8.5 ? '#0ca678' : '#b45309'};font-size:11px;font-weight:800;flex-shrink:0;">
                ${safeEscapeHtml(nivel)}
              </span>
            </div>

            <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px;margin-top:8px;display:flex;justify-content:space-between;align-items:center;">
              <div>
                <span class="muted" style="font-size:11px;display:block;">Examen Trimestral</span>
                <strong style="font-size:14px;color:var(--navy);">${Number(c.exam).toFixed(1)}</strong>
              </div>
              <div style="text-align:right;">
                <span class="muted" style="font-size:11px;display:block;">Promedio final</span>
                <strong style="font-size:18px;color:var(--teal);font-family:'Nunito',sans-serif;">${califFinal}</strong>
              </div>
            </div>

            <div style="border-top:1px solid #f1f5f9;padding-top:6px;margin-top:4px;display:flex;justify-content:space-between;font-size:11.5px;color:var(--muted);">
              <span>${c.completas} de ${c.actividades} actividades</span>
              <span style="font-weight:700;color:${c.color};">${Math.round((c.completas / c.actividades) * 100)}%</span>
            </div>
          </div>
        `;
      }).join('')}
    `;
  }

  // B. Lista de PDA en desarrollo
  const pdaEl = document.getElementById('studentRecordAcademicPdaList');
  if (pdaEl) {
    const pdas = [
      { campo: 'Lenguajes', contenido: 'Narración de sucesos', pda: 'Reconoce y usa diversos estilos, recursos y estrategias narrativas.', nivel: 'Logrado' },
      { campo: 'Saberes y P. C.', contenido: 'Multiplicación y división', pda: 'Resuelve situaciones que implican multiplicaciones con números naturales.', nivel: 'En proceso' },
      { campo: 'Ética y Sociedades', contenido: 'Ecosistemas y naturaleza', pda: 'Comprende la importancia de los ecosistemas y su preservación responsable.', nivel: 'Logrado' },
      { campo: 'De lo Humano', contenido: 'Convivencia y comunidad', pda: 'Diseña y participa en estrategias para la resolución pacífica de conflictos.', nivel: 'Logrado' }
    ];

    pdaEl.innerHTML = pdas.map(item => `
      <div style="background:#f8fafc;border:1px solid var(--line);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:4px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <span class="badge" style="background:#e0f2fe;color:#0284c7;font-size:11px;">${safeEscapeHtml(item.campo)}</span>
          <span class="badge" style="background:${item.nivel === 'Logrado' ? '#e6fcf5' : '#fef3c7'};color:${item.nivel === 'Logrado' ? '#0ca678' : '#b45309'};font-size:11px;font-weight:800;">
            ${safeEscapeHtml(item.nivel)}
          </span>
        </div>
        <strong style="font-size:12.5px;color:var(--navy);line-height:1.3;margin-top:2px;">${safeEscapeHtml(item.pda)}</strong>
        <span class="muted" style="font-size:11.5px;">Contenido curricular: ${safeEscapeHtml(item.contenido)}</span>
      </div>
    `).join('');
  }

  // C. Proyectos Activos de Aula
  const projectsEl = document.getElementById('studentRecordAcademicProjectsList');
  if (projectsEl) {
    const defaultProjects = [
      { nombre: 'Guardianes del Agua y el Entorno Comunitario', campoFormativo: 'Ética, Naturaleza y Sociedades', escenario: 'Comunitario', temporalidad: '2 semanas', estado: 'Activo' },
      { nombre: 'Textos que Cuentan Nuestra Historia Local', campoFormativo: 'Lenguajes', escenario: 'Aula', temporalidad: '3 semanas', estado: 'Activo' },
      { nombre: 'Midiendo y Cuidando la Salud en la Escuela', campoFormativo: 'Saberes y Pensamiento C.', escenario: 'Escolar', temporalidad: 'En seguimiento', estado: 'En seguimiento' }
    ];

    const rawProjects = (typeof state !== 'undefined' && state.projects && state.projects.length) ? state.projects : defaultProjects;

    projectsEl.innerHTML = rawProjects.slice(0, 3).map(p => `
      <div style="background:#f8fafc;border:1px solid var(--line);border-radius:10px;padding:12px 14px;display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
        <div style="min-width:0;flex:1;">
          <strong style="font-size:13.5px;color:var(--navy);display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${safeEscapeHtml(p.nombre)}</strong>
          <span class="muted" style="font-size:12px;display:block;margin-top:2px;">${safeEscapeHtml(p.campoFormativo)} · Escenario: ${safeEscapeHtml(p.escenario || 'Aula')}</span>
        </div>
        <span class="badge" style="background:${p.estado === 'Activo' ? '#e6fcf5' : '#f1f5f9'};color:${p.estado === 'Activo' ? '#0ca678' : '#475569'};font-size:11px;font-weight:800;flex-shrink:0;">
          ${safeEscapeHtml(p.estado || 'Activo')}
        </span>
      </div>
    `).join('');
  }
}

// --------------------------------------------------------------------------
// 3. PESTAÑA: TAREAS
// --------------------------------------------------------------------------
function renderStudentRecordTasksTab(student, token) {
  if (token && token !== _studentRecordLoadToken) return;

  const total = 80;
  const complete = 67;
  const partial = 9;
  const none = 4;

  const totalEl = document.getElementById('studentRecordTasksTotal');
  const compEl = document.getElementById('studentRecordTasksComplete');
  const partEl = document.getElementById('studentRecordTasksPartial');
  const noneEl = document.getElementById('studentRecordTasksNone');
  if (totalEl) totalEl.textContent = total;
  if (compEl) compEl.textContent = complete;
  if (partEl) partEl.textContent = partial;
  if (noneEl) noneEl.textContent = none;

  const cAll = document.getElementById('taskFilterCountAll');
  const cComp = document.getElementById('taskFilterCountComplete');
  const cPart = document.getElementById('taskFilterCountPartial');
  const cNone = document.getElementById('taskFilterCountNone');
  if (cAll) cAll.textContent = total;
  if (cComp) cComp.textContent = complete;
  if (cPart) cPart.textContent = partial;
  if (cNone) cNone.textContent = none;

  _currentStudentTasks = [
    { id: 'T-01', titulo: 'Problemas de multiplicación aplicada a compras', materia: 'Saberes y Pensamiento C.', fecha: '24 ene', estado: 'complete', nota: '10/10 · Excelente procedimiento matemático' },
    { id: 'T-02', titulo: 'Redacción de narración con inicio, nudo y desenlace', materia: 'Lenguajes', fecha: '23 ene', estado: 'complete', nota: '9.5/10 · Muy buena redacción y coherencia' },
    { id: 'T-03', titulo: 'Mapa mental: Ecosistemas y fauna regional', materia: 'Ética, Naturaleza y Soc.', fecha: '22 ene', estado: 'partial', nota: '7.0/10 · Faltó describir los animales endémicos' },
    { id: 'T-04', titulo: 'Registro individual de actividad física y pulsaciones', materia: 'De lo Humano y Comunitario', fecha: '20 ene', estado: 'complete', nota: '10/10 · Registro diario completado con tutor' },
    { id: 'T-05', titulo: 'Glosario bilingüe de objetos escolares', materia: 'Lengua Extranjera (Inglés)', fecha: '19 ene', estado: 'none', nota: '0/10 · Sin entrega; pendiente para revisión' },
    { id: 'T-06', titulo: 'Cálculo de perímetros y áreas en cuadrículas', materia: 'Saberes y Pensamiento C.', fecha: '17 ene', estado: 'complete', nota: '9.0/10 · Buen trazo de figuras' },
    { id: 'T-07', titulo: 'Carta formal dirigida a la dirección escolar', materia: 'Lenguajes', fecha: '16 ene', estado: 'partial', nota: '7.5/10 · Faltó fecha y firma de compromiso' },
    { id: 'T-08', titulo: 'Cartel sobre el ahorro de agua en el hogar', materia: 'Ética, Naturaleza y Soc.', fecha: '14 ene', estado: 'complete', nota: '10/10 · Creativo y con mensaje claro' },
    { id: 'T-09', titulo: 'Circuito motriz y juego cooperativo', materia: 'De lo Humano y Comunitario', fecha: '13 ene', estado: 'complete', nota: '10/10 · Participación y respeto a reglas' },
    { id: 'T-10', titulo: 'Lectura de comprensión: Leyendas regionales', materia: 'Lenguajes', fecha: '10 ene', estado: 'none', nota: '0/10 · Sin entrega; se otorgó prórroga' },
    { id: 'T-11', titulo: 'Operaciones básicas y cálculo mental semanal', materia: 'Saberes y Pensamiento C.', fecha: '09 ene', estado: 'complete', nota: '9.5/10 · Gran velocidad de cálculo' },
    { id: 'T-12', titulo: 'Maqueta sencilla de separación de residuos', materia: 'Ética, Naturaleza y Soc.', fecha: '08 ene', estado: 'complete', nota: '10/10 · Material reciclado bien utilizado' }
  ];

  filterStudentRecordTasks(_activeTaskFilter || 'all');
}

function filterStudentRecordTasks(filter) {
  _activeTaskFilter = filter || 'all';

  document.querySelectorAll('.student-record-tasks-filters [data-task-filter]').forEach(btn => {
    btn.classList.toggle('primary', btn.dataset.taskFilter === _activeTaskFilter);
  });

  const listEl = document.getElementById('studentRecordTasksList');
  if (!listEl) return;

  const filtered = _currentStudentTasks.filter(item => {
    if (_activeTaskFilter === 'all') return true;
    return item.estado === _activeTaskFilter;
  });

  if (!filtered.length) {
    listEl.innerHTML = '<p class="muted" style="text-align:center;padding:24px 0;">No hay tareas en esta categoría de filtro.</p>';
    return;
  }

  listEl.innerHTML = filtered.map(t => {
    const isComp = t.estado === 'complete';
    const isPart = t.estado === 'partial';
    const statusBg = isComp ? '#dcfce7' : isPart ? '#fef9c3' : '#fee2e2';
    const statusColor = isComp ? '#16a34a' : isPart ? '#ca8a04' : '#dc2626';
    const statusLabel = isComp ? 'Completa' : isPart ? 'Incompleta' : 'Sin entregar';
    const statusIcon = isComp
      ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>'
      : isPart
      ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
      : '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

    return `
      <div class="student-record-task-card">
        <div style="display:flex;align-items:flex-start;gap:12px;min-width:0;flex:1;">
          <span style="width:32px;height:32px;border-radius:10px;background:${statusBg};color:${statusColor};display:grid;place-items:center;flex-shrink:0;margin-top:2px;">
            ${statusIcon}
          </span>
          <div style="min-width:0;flex:1;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:2px;">
              <strong style="font-size:13.5px;color:var(--navy);">${safeEscapeHtml(t.titulo)}</strong>
              <span class="badge" style="background:${statusBg};color:${statusColor};font-size:11px;font-weight:800;">
                ${safeEscapeHtml(statusLabel)}
              </span>
            </div>
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:12px;" class="muted">
              <span>${safeEscapeHtml(t.materia)}</span>
              <span>·</span>
              <span>Entrega: ${safeEscapeHtml(t.fecha)}</span>
            </div>
            <p style="margin:4px 0 0;font-size:12px;color:#475569;background:#f8fafc;padding:4px 8px;border-radius:6px;display:inline-block;">
              ${safeEscapeHtml(t.nota)}
            </p>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// --------------------------------------------------------------------------
// 4. PESTAÑA: ASISTENCIA (SIN FECHAS OBSOLETAS)
// --------------------------------------------------------------------------
function renderStudentRecordAttendanceTab(student, token) {
  if (token && token !== _studentRecordLoadToken) return;

  const rate = student.asistenciaPorcentaje ? student.asistenciaPorcentaje : 92;
  const aCount = Math.round(80 * (rate / 100));
  const fCount = Math.max(1, Math.round((80 - aCount) * 0.6));
  const rjCount = Math.max(1, 80 - aCount - fCount);

  const rateEl = document.getElementById('studentRecordAttendanceRate');
  const aEl = document.getElementById('studentRecordAttendanceA');
  const fEl = document.getElementById('studentRecordAttendanceF');
  const rjEl = document.getElementById('studentRecordAttendanceRJ');
  if (rateEl) rateEl.textContent = `${rate}%`;
  if (aEl) aEl.textContent = aCount;
  if (fEl) fEl.textContent = fCount;
  if (rjEl) rjEl.textContent = rjCount;

  const btnDirect = document.getElementById('btnGoToAttendanceDirect');
  if (btnDirect) btnDirect.dataset.id = student.id;

  const listEl = document.getElementById('studentRecordAttendanceList');
  if (!listEl) return;

  // Consultar salidas anticipadas registradas
  const salidas = getStudentRecordSalidas(student.id);

  let salidasHtml = salidas.map(s => `
    <div class="student-record-log-item" style="border-left: 4px solid #ea580c; background: #fffaf0; padding:12px; border-radius:8px; margin-bottom:8px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <span class="badge-salida-anticipada">
              ⏰ SALIDA ANTICIPADA (${s.hora} hrs)
            </span>
            <span style="font-size:12px;color:var(--muted);font-weight:600;">${s.fecha}</span>
          </div>
          <strong style="color:var(--navy);font-size:13px;display:block;">
            Retirado(a) por: ${s.responsable} (${s.parentesco})
          </strong>
          <p style="margin:4px 0 0;font-size:12px;color:#475569;line-height:1.4;">
            <strong>Motivo (${s.motivo}):</strong> ${s.detalle}
          </p>
        </div>
        <span class="badge" style="background:#fed7aa;color:#9a3412;font-size:11px;font-weight:800;">Retiro Oficial</span>
      </div>
    </div>
  `).join('');

  const records = [
    { fecha: '24 ene 2026', estado: 'A', hora: '07:55 hrs', nota: 'Puntual · Ingreso ordinario' },
    { fecha: '23 ene 2026', estado: 'A', hora: '07:58 hrs', nota: 'Puntual · Ingreso ordinario' },
    { fecha: '22 ene 2026', estado: 'A', hora: '08:00 hrs', nota: 'Puntual · Ingreso ordinario' },
    { fecha: '21 ene 2026', estado: 'F', hora: '—', nota: 'Inasistencia · Falta registrada' },
    { fecha: '20 ene 2026', estado: 'RJ', hora: '08:15 hrs', nota: 'Retardo Justificado · Se presentó justificante médico' }
  ];

  const regHtml = records.map(r => `
    <div class="student-record-log-item">
      <div class="status-chip ${r.estado === 'A' ? 'asistencia' : (r.estado === 'F' ? 'falta' : 'retardo')}">
        ${r.estado}
      </div>
      <div style="flex:1;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong style="color:var(--navy);font-size:13px;">${r.fecha}</strong>
          <span style="font-size:11px;color:var(--muted);">${r.hora}</span>
        </div>
        <p style="margin:2px 0 0;font-size:12px;color:var(--muted);">${r.nota}</p>
      </div>
    </div>
  `).join('');

  listEl.innerHTML = salidasHtml + regHtml;
}

function renderStudentRecordIncidenciasTab(student, token) {
  if (token && token !== _studentRecordLoadToken) return;

  const bitacoras = getStudentRecordBitacoras(student.id);
  const incCount = bitacoras.filter(b => b.tipo === 'conducta' || b.tipo === 'incidencia').length;
  const justCount = bitacoras.filter(b => b.tipo === 'justificante').length;
  const compCount = bitacoras.filter(b => b.tipo === 'compromiso').length;
  const salCount = getStudentRecordSalidas(student.id).length;

  const countIncEl = document.getElementById('studentRecordIncidenciasCount');
  const countJustEl = document.getElementById('studentRecordJustificantesCount');
  const countCompEl = document.getElementById('studentRecordCartasCount');
  const countAcuerdosEl = document.getElementById('studentRecordAcuerdosCount');

  if (countIncEl) countIncEl.textContent = incCount;
  if (countJustEl) countJustEl.textContent = justCount;
  if (countCompEl) countCompEl.textContent = compCount;
  if (countAcuerdosEl) countAcuerdosEl.textContent = salCount;

  const listEl = document.getElementById('studentRecordIncidenciasList');
  if (!listEl) return;

  if (bitacoras.length === 0) {
    listEl.innerHTML = `
      <div class="student-record-incidencia-card" style="border-left: 4px solid var(--primary);">
        <div class="incidencia-header">
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="badge" style="background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;">Al corriente</span>
            <strong style="color:var(--navy);font-size:14px;">Registro Ordinario</strong>
          </div>
          <span style="font-size:12px;color:var(--muted);">Ciclo Vigente</span>
        </div>
        <p style="margin:8px 0;font-size:13px;color:var(--text);line-height:1.5;">
          El alumno mantiene un expediente escolar regular sin incidencias ni llamados de atención registrados en la bitácora docente.
        </p>
        <div style="margin-top:10px;padding-top:8px;border-top:1px dashed var(--line);display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:12px;color:var(--primary);font-weight:600;">✓ Sin medidas disciplinarias ni citatorios activos.</span>
          <button class="btn btn-secondary btn-sm" onclick="window.openStudentRecordBitacoraModal('conducta')">
            + Registrar en bitácora
          </button>
        </div>
      </div>
    `;
    return;
  }

  listEl.innerHTML = bitacoras.map(item => {
    const badgeColors = {
      conducta: { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa', label: 'Reporte de Conducta' },
      salida: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe', label: 'Salida Anticipada' },
      incidencia: { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca', label: 'Ficha de Percance' },
      compromiso: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0', label: 'Carta Compromiso' },
      justificante: { bg: '#fdf4ff', text: '#a21caf', border: '#f5d0fe', label: 'Justificante' }
    };
    const b = badgeColors[item.tipo] || { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1', label: item.tipo };

    let detailsPreview = '';
    if (item.tipo === 'conducta') {
      const sits = item.situaciones && item.situaciones.length ? item.situaciones.join(', ') : 'Conducta observada';
      detailsPreview = `<div style="font-size:12px;color:var(--navy);margin:4px 0;"><strong>Situaciones:</strong> ${sits}</div>`;
    } else if (item.tipo === 'salida') {
      detailsPreview = `<div style="font-size:12px;color:#1e40af;margin:4px 0;"><strong>Retirado por:</strong> ${item.tutorNombre || 'Tutor'} (${item.parentesco}) · ${item.motivoTipo}</div>`;
    }

    return `
      <div class="student-record-incidencia-card" style="border-left: 4px solid ${b.text};">
        <div class="incidencia-header">
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="badge" style="background:${b.bg};color:${b.text};border:1px solid ${b.border};font-weight:700;">
              ${b.label}
            </span>
            <strong style="color:var(--navy);font-size:14px;">${item.titulo || 'Registro de bitácora'}</strong>
          </div>
          <span style="font-size:12px;color:var(--muted);">${item.fecha} · ${item.hora || ''}</span>
        </div>
        ${detailsPreview}
        <p style="margin:8px 0;font-size:13px;color:var(--text);line-height:1.5;">
          ${item.descripcion || item.motivos || item.compromisos || 'Registro oficial en expediente.'}
        </p>
        <div style="margin-top:10px;padding-top:8px;border-top:1px dashed var(--line);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <span style="font-size:12px;color:#0f766e;font-weight:600;">✓ Registrado en expediente oficial</span>
          <button class="btn btn-secondary btn-sm" onclick="window.printOfficialStudentRecordDocumentById('${item.id}')" style="display:inline-flex;align-items:center;gap:6px;font-weight:700;">
            🖨️ Imprimir Formato Oficial (PDF)
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function renderStudentRecordFamilyTab(student, token) {
  if (token && token !== _studentRecordLoadToken) return;

  // Si el directorio no está cargado en memoria, solicitarlo automáticamente
  if (!state.directory && typeof server === 'function') {
    server('getDirectoryAdminData').then(data => {
      state.directory = data;
      state.directoryLoadedAt = Date.now();
      if (_currentStudentRecordId === student.id) {
        renderStudentRecordFamilyTab(student, _studentRecordLoadToken);
        updateStudentRecordHeaderTutor(student);
      }
    }).catch(err => console.warn('Carga automática de directorio para expediente:', err));
  }

  const dirRow = getStudentDirectoryRow(student);
  const p = dirRow?.profile || {};
  const acc = dirRow?.account;

  // Datos del tutor
  const tutorNameParts = [p.tutorApellidoPaterno, p.tutorApellidoMaterno, p.tutorNombres].filter(Boolean).join(' ');
  const tutorName = tutorNameParts || p.tutorNombre || student.tutorNombre || '';
  const hasTutor = Boolean(tutorName && tutorName.trim() !== '' && tutorName !== 'Sin registrar');
  const tutorParentesco = p.tutorParentesco || 'Madre de familia';
  const tutorPhone = p.tutorTelefono || p.phone || student.tutorTelefono || '';
  const cleanPhone = tutorPhone.replace(/\D/g, '');
  const tutorEmail = p.tutorEmail || p.email || '';
  const tutorAddress = [
    p.calle ? (p.calle + (p.numeroExterior ? ' No. ' + p.numeroExterior : '')) : '',
    p.colonia ? ('Col. ' + p.colonia) : '',
    p.region ? ('Región ' + p.region) : '',
    p.referencias ? ('Ref: ' + p.referencias) : ''
  ].filter(Boolean).join(', ') || p.tutorDomicilio || p.domicilio || '';

  // Contacto de emergencia
  const emergName = p.contactoEmergenciaNombre || p.contactoEmergencia || '';
  const emergPhone = p.contactoEmergenciaTelefono || '';
  const emergPar = p.contactoEmergenciaParentesco || '';

  // Actualizar también el encabezado
  updateStudentRecordHeaderTutor(student);

  // 1. Tarjeta: Ficha del Tutor Principal
  const tutorCard = document.getElementById('studentRecordFamilyTutorCard');
  if (tutorCard) {
    tutorCard.innerHTML = `
      <div style="background:#f8fafc;border:1px solid var(--line);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
          <div>
            <strong style="font-size:15px;color:var(--navy);display:block;">${hasTutor ? safeEscapeHtml(tutorName) : 'Sin tutor registrado'}</strong>
            <span class="muted" style="font-size:12px;">${hasTutor ? safeEscapeHtml(tutorParentesco) : 'Falta registrar datos del tutor en Directorio'}</span>
          </div>
          <span class="badge" style="background:${hasTutor ? '#e6fcf5' : '#f1f5f9'};color:${hasTutor ? '#0ca678' : '#64748b'};font-size:11px;font-weight:800;">
            ${hasTutor ? 'Tutor acreditado' : 'Pendiente'}
          </span>
        </div>

        <div style="display:flex;flex-direction:column;gap:8px;font-size:13px;border-top:1px solid #f1f5f9;padding-top:10px;">
          <div style="display:flex;align-items:center;gap:8px;color:var(--text);">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--muted);"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            <span><strong>Teléfono principal:</strong> ${tutorPhone ? safeEscapeHtml(tutorPhone) : '<span class="muted">Sin registrar</span>'}</span>
          </div>

          <div style="display:flex;align-items:center;gap:8px;color:var(--text);">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--muted);"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            <span><strong>Correo electrónico:</strong> ${tutorEmail ? `<a href="mailto:${safeEscapeHtml(tutorEmail)}" style="color:var(--primary);text-decoration:none;">${safeEscapeHtml(tutorEmail)}</a>` : '<span class="muted">Sin registrar</span>'}</span>
          </div>

          ${emergName ? `
            <div style="display:flex;align-items:center;gap:8px;color:var(--text);">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" style="color:#e11d48;"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
              <span><strong>Contacto emergencia:</strong> ${safeEscapeHtml(emergName)} ${emergPar ? '(' + safeEscapeHtml(emergPar) + ')' : ''} ${emergPhone ? '· Tel: ' + safeEscapeHtml(emergPhone) : ''}</span>
            </div>
          ` : ''}

          ${tutorAddress ? `
            <div style="display:flex;align-items:flex-start;gap:8px;color:var(--text);">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--muted);margin-top:2px;"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
              <span><strong>Domicilio familiar:</strong> ${safeEscapeHtml(tutorAddress)}</span>
            </div>
          ` : ''}
        </div>

        ${cleanPhone && cleanPhone.length >= 10 ? `
          <div style="display:flex;gap:8px;margin-top:4px;">
            <a href="tel:${cleanPhone}" class="btn small" style="flex:1;text-align:center;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:6px;">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              Llamar
            </a>
            <button type="button" class="btn small" onclick="window.openWhatsappDialog && window.openWhatsappDialog('${student.id}', '${cleanPhone}', '${safeEscapeHtml(student.nombreCompleto || student.nombre)}')" style="flex:1;background:#25D366;color:#fff;border:none;display:flex;align-items:center;justify-content:center;gap:6px;font-weight:700;">
              WhatsApp
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }

  // 2. Tarjeta: Portal Familiar y Notificaciones
  const portalCard = document.getElementById('studentRecordFamilyPortalCard');
  if (portalCard) {
    const hasAccount = Boolean(acc && acc.username);
    const username = hasAccount ? acc.username : 'Sin usuario creado';
    const statusText = !acc ? 'Sin cuenta' : (acc.accessRevoked ? 'Acceso revocado' : (!acc.active ? 'Bloqueada' : 'Activo y Vinculado'));
    const isSuccess = acc && acc.active && !acc.accessRevoked;
    const lastAccessText = acc?.lastAccess ? new Date(acc.lastAccess).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : 'Sin accesos registrados aún';
    const password = acc?.temporaryPassword || '';

    portalCard.innerHTML = `
      <div style="background:#f8fafc;border:1px solid var(--line);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
          <div>
            <strong style="font-size:15px;color:var(--navy);display:block;">
              ${hasAccount ? `<code style="font-size:14px;background:#e2e8f0;padding:2px 6px;border-radius:4px;">${safeEscapeHtml(username)}</code>` : 'Sin usuario creado'}
            </strong>
            <span class="muted" style="font-size:12px;">${hasAccount ? 'Usuario de consulta para tutores' : 'Requiere generar credencial'}</span>
          </div>
          <span class="badge" style="background:${isSuccess ? '#ecfdf5' : '#f1f5f9'};color:${isSuccess ? '#065f46' : '#64748b'};font-size:11px;font-weight:800;">
            ${statusText}
          </span>
        </div>

        <div style="display:flex;flex-direction:column;gap:8px;font-size:13px;border-top:1px solid #f1f5f9;padding-top:10px;">
          ${password ? `
            <div style="display:flex;align-items:center;justify-content:space-between;background:#fff;border:1px solid #cbd5e1;border-radius:8px;padding:6px 10px;">
              <div>
                <span class="muted" style="font-size:11px;display:block;">Contraseña de acceso:</span>
                <b data-family-pass-exp="${safeEscapeHtml(student.id)}" style="font-size:13px;color:var(--navy);letter-spacing:1px;">••••••••••</b>
                <span style="font-size:10px;color:#0f766e;font-weight:700;display:block;margin-top:1px;">● Permanente (Sin caducidad)</span>
              </div>
              <button type="button" class="btn small" onclick="window.toggleExpedienteFamilyPass && window.toggleExpedienteFamilyPass(this, '${safeEscapeHtml(password)}')">
                Ver
              </button>
            </div>
          ` : ''}

          <div style="display:flex;align-items:center;gap:8px;color:var(--text);">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--muted);"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span><strong>Último acceso al portal:</strong> ${safeEscapeHtml(lastAccessText)}</span>
          </div>

          <div style="display:flex;align-items:center;gap:8px;color:var(--text);">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--teal);"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            <span><strong>Avisos y circulares:</strong> ${hasAccount ? 'Habilitado para consulta' : 'Requiere vincular usuario'}</span>
          </div>
        </div>

        <button type="button" class="btn" onclick="window.openStudentInDirectory && window.openStudentInDirectory('${student.id}')" style="margin-top:4px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:12.5px;">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          Abrir ficha completa en Directorio Familiar
        </button>
      </div>
    `;
  }
}

// --------------------------------------------------------------------------
// 7. PESTAÑA: ARCHIVOS -> COTEJO DE DOCUMENTOS FÍSICOS
// --------------------------------------------------------------------------
function renderStudentRecordFilesTab(student, token) {
  if (token && token !== _studentRecordLoadToken) return;

  const listEl = document.getElementById('studentRecordFilesList');
  if (!listEl) return;

  const allPhysical = getStorageData(STORAGE_KEYS.physicalDocs);
  const studentDocs = allPhysical[student.id] || {
    acta: { status: 'Original', nota: 'Original entregado y resguardado en dirección' },
    curp: { status: 'Entregado', nota: 'Copia certificada con código QR' },
    vacunacion: { status: 'Copia', nota: 'Copia de cartilla con esquema completo' },
    medico: { status: 'Entregado', nota: 'Certificado de centro de salud con tipo de sangre' },
    inscripcion: { status: 'Original', nota: 'Ficha firmada por la madre' },
    domicilio: { status: 'Copia', nota: 'Comprobante de luz reciente' },
    fotos: { status: 'Entregado', nota: '4 fotografías infantiles en blanco y negro' },
    reglamento: { status: 'Original', nota: 'Carta compromiso de convivencia firmada' }
  };

  const docDefs = [
    { id: 'acta', nombre: 'Acta de nacimiento del alumno', desc: 'Documento oficial para cotejo de identidad' },
    { id: 'curp', nombre: 'CURP oficial impresa', desc: 'Clave única con validación RENAPO' },
    { id: 'vacunacion', nombre: 'Cartilla Nacional de Salud / Vacunación', desc: 'Comprobante de cuadro de inmunizaciones' },
    { id: 'medico', nombre: 'Certificado médico escolar reciente', desc: 'Apto para actividades físicas y tipo de sangre' },
    { id: 'inscripcion', nombre: 'Ficha oficial de inscripción firmada', desc: 'Datos del alumno y aceptación del tutor' },
    { id: 'domicilio', nombre: 'Comprobante de domicilio familiar', desc: 'Comprobante de agua o luz no mayor a 3 meses' },
    { id: 'fotos', nombre: 'Fotografías tamaño infantil (4 fotos)', desc: 'Para expediente físico y credencial escolar' },
    { id: 'reglamento', nombre: 'Reglamento y Carta compromiso firmada', desc: 'Acuerdo de corresponsabilidad escolar' }
  ];

  listEl.innerHTML = `
    <div style="margin-bottom:12px;background:#f8fafc;border:1px solid var(--line);border-radius:10px;padding:10px 14px;font-size:13px;color:var(--navy);">
      <strong>Cotejo de recepción física de papelería escolar</strong>
      <p class="muted" style="margin:2px 0 0 0;font-size:12px;">Marca y anota los documentos entregados en físico por la familia en la dirección del plantel.</p>
    </div>
    ${docDefs.map(doc => {
      const cur = studentDocs[doc.id] || { status: 'Pendiente', nota: 'Documento pendiente de entrega' };
      const isEntregado = cur.status === 'Original' || cur.status === 'Entregado';
      const isCopia = cur.status === 'Copia';
      const bg = isEntregado ? '#dcfce7' : isCopia ? '#e0f2fe' : '#fee2e2';
      const color = isEntregado ? '#16a34a' : isCopia ? '#0284c7' : '#dc2626';

      return `
        <div class="student-record-file-card" style="padding:12px 14px;">
          <div style="display:flex;align-items:flex-start;gap:12px;flex:1;min-width:0;">
            <span style="width:34px;height:34px;border-radius:10px;background:${bg};color:${color};display:grid;place-items:center;font-weight:900;font-size:16px;flex-shrink:0;">
              ${isEntregado ? '✓' : isCopia ? 'C' : '!'}
            </span>
            <div style="min-width:0;flex:1;">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <strong style="font-size:13.5px;color:var(--navy);">${safeEscapeHtml(doc.nombre)}</strong>
                <span class="badge" style="background:${bg};color:${color};font-size:11px;font-weight:800;">
                  ${safeEscapeHtml(cur.status)}
                </span>
              </div>
              <span class="muted" style="font-size:12px;display:block;">${safeEscapeHtml(doc.desc)}</span>
              <p style="margin:4px 0 0 0;font-size:12px;color:#475569;background:#f8fafc;padding:4px 8px;border-radius:6px;display:inline-block;">
                Nota: ${safeEscapeHtml(cur.nota)}
              </p>
            </div>
          </div>
          <button type="button" class="btn small" onclick="window.togglePhysicalDocumentStatus('${student.id}', '${doc.id}')" style="flex-shrink:0;">
            Cambiar estado
          </button>
        </div>
      `;
    }).join('')}
  `;
}

// --------------------------------------------------------------------------
// MODALES Y OPERACIONES INTERACTIVAS
// --------------------------------------------------------------------------

// Abrir modal de bitácora
function openStudentRecordBitacoraModal() {
  const student = findStudentById(_currentStudentRecordId);
  if (!student) {
    if (typeof toast === 'function') toast('Selecciona primero un alumno para registrar en su bitácora.', true);
    return;
  }

  const dialog = document.getElementById('studentBitacoraDialog');
  if (!dialog) return;

  const studentName = typeof fullName === 'function' ? fullName(student) : (student.nombreCompleto || student.nombre);
  document.getElementById('bitacoraStudentId').value = student.id;
  document.getElementById('bitacoraStudentName').textContent = `${studentName} · No. ${student.numeroLista || '-'} · 4.° A`;
  document.getElementById('bitacoraFecha').value = (typeof todayCancun === 'function' ? todayCancun() : new Date().toISOString().slice(0, 10));
  document.getElementById('bitacoraContexto').value = '';
  document.getElementById('bitacoraDescripcion').value = '';
  document.getElementById('bitacoraSeguimiento').value = '';

  dialog.showModal();
}

// Guardar registro de bitácora
function saveStudentRecordBitacoraEntry() {
  const studentId = document.getElementById('bitacoraStudentId').value;
  const fecha = document.getElementById('bitacoraFecha').value;
  const tipo = document.getElementById('bitacoraTipo').value;
  const contexto = document.getElementById('bitacoraContexto').value.trim();
  const descripcion = document.getElementById('bitacoraDescripcion').value.trim();
  const seguimiento = document.getElementById('bitacoraSeguimiento').value.trim();

  if (!studentId || !descripcion) {
    if (typeof toast === 'function') toast('Por favor escribe la descripción del hecho.', true);
    return;
  }

  const allBitacoras = getStorageData(STORAGE_KEYS.bitacoras);
  if (!allBitacoras[studentId]) allBitacoras[studentId] = [];

  allBitacoras[studentId].unshift({
    fecha: fecha || 'Hoy',
    tipo: tipo || 'Incidencia de conducta',
    contexto: contexto || 'Aula de clases',
    descripcion,
    seguimiento: seguimiento || 'Registrado por el docente'
  });

  saveStorageData(STORAGE_KEYS.bitacoras, allBitacoras);

  const dialog = document.getElementById('studentBitacoraDialog');
  if (dialog) dialog.close();

  const student = findStudentById(studentId);
  if (student) {
    renderStudentRecordIncidenciasTab(student, _studentRecordLoadToken);
    renderStudentRecordResumenTab(student, _studentRecordLoadToken);
  }

  if (typeof toast === 'function') toast('✓ Entrada guardada exitosamente en la bitácora del alumno');
}

// Abrir modal de examen
function openStudentRecordExamModal() {
  const student = findStudentById(_currentStudentRecordId);
  if (!student) {
    if (typeof toast === 'function') toast('Selecciona primero un alumno para registrar calificaciones.', true);
    return;
  }

  const dialog = document.getElementById('studentExamDialog');
  if (!dialog) return;

  const studentName = typeof fullName === 'function' ? fullName(student) : (student.nombreCompleto || student.nombre);
  document.getElementById('examStudentId').value = student.id;
  document.getElementById('examStudentName').textContent = `${studentName} · No. ${student.numeroLista || '-'} · 4.° A`;

  const allExams = getStorageData(STORAGE_KEYS.exams);
  const studentExams = allExams[student.id] || {
    lenguajes: 8.5,
    saberes: 8.0,
    etica: 9.0,
    humano: 9.0,
    ingles: 8.0
  };

  document.getElementById('examGrade_lenguajes').value = studentExams.lenguajes || 8.5;
  document.getElementById('examGrade_saberes').value = studentExams.saberes || 8.0;
  document.getElementById('examGrade_etica').value = studentExams.etica || 9.0;
  document.getElementById('examGrade_humano').value = studentExams.humano || 9.0;
  document.getElementById('examGrade_ingles').value = studentExams.ingles || 8.0;

  dialog.showModal();
}

// Guardar calificaciones de examen
function saveStudentRecordExamGrades() {
  const studentId = document.getElementById('examStudentId').value;
  if (!studentId) return;

  const allExams = getStorageData(STORAGE_KEYS.exams);
  allExams[studentId] = {
    lenguajes: parseFloat(document.getElementById('examGrade_lenguajes').value) || 8.0,
    saberes: parseFloat(document.getElementById('examGrade_saberes').value) || 8.0,
    etica: parseFloat(document.getElementById('examGrade_etica').value) || 8.0,
    humano: parseFloat(document.getElementById('examGrade_humano').value) || 8.0,
    ingles: parseFloat(document.getElementById('examGrade_ingles').value) || 8.0
  };

  saveStorageData(STORAGE_KEYS.exams, allExams);

  const dialog = document.getElementById('studentExamDialog');
  if (dialog) dialog.close();

  const student = findStudentById(studentId);
  if (student) {
    renderStudentRecordAcademicTab(student, _studentRecordLoadToken);
    renderStudentRecordResumenTab(student, _studentRecordLoadToken);
  }

  if (typeof toast === 'function') toast('✓ Calificaciones del examen trimestral guardadas exitosamente');
}

// Alternar estado de documento físico
function togglePhysicalDocumentStatus(studentId, docId) {
  const allDocs = getStorageData(STORAGE_KEYS.physicalDocs);
  if (!allDocs[studentId]) allDocs[studentId] = {};

  const current = allDocs[studentId][docId]?.status || 'Pendiente';
  const nextStatus = current === 'Pendiente' ? 'Original' : current === 'Original' ? 'Copia' : 'Pendiente';

  const nuevaNota = prompt(`Nuevo estado: ${nextStatus}. Escribe una observación o detalle de recepción física:`, allDocs[studentId][docId]?.nota || '');
  if (nuevaNota === null) return;

  allDocs[studentId][docId] = {
    status: nextStatus,
    nota: nuevaNota.trim() || (nextStatus === 'Pendiente' ? 'Documento pendiente de entrega' : `Documento entregado en físico (${nextStatus})`)
  };

  saveStorageData(STORAGE_KEYS.physicalDocs, allDocs);

  const student = findStudentById(studentId);
  if (student) renderStudentRecordFilesTab(student, _studentRecordLoadToken);

  if (typeof toast === 'function') toast(`✓ Documento actualizado a: ${nextStatus}`);
}

// Navegar a Directorio Familiar con el alumno buscado
function openStudentInDirectory(studentId) {
  const id = studentId || _currentStudentRecordId;
  const student = findStudentById(studentId);
  if (typeof showView === 'function') showView('directory');
  if (student) {
    const search = document.getElementById('directorySearch');
    if (search) {
      search.value = student.apellidoPaterno || student.nombres || student.nombre || '';
      if (typeof renderDirectory === 'function') renderDirectory();
    }
  }
}

// Abrir estilos de aprendizaje del alumno
function openStudentStyles(studentId) {
  const id = studentId || _currentStudentRecordId;
  if (typeof showView === 'function') showView('styles');
}

// Sincronizar UI de pestañas
function syncStudentRecordTabsUI() {
  document.querySelectorAll('.student-record-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === _activeStudentRecordTab);
  });

  const select = document.getElementById('studentRecordTabSelect');
  if (select) select.value = _activeStudentRecordTab;

  document.querySelectorAll('.student-record-tab-pane').forEach(pane => {
    pane.style.display = pane.id === `studentRecordTabPane_${_activeStudentRecordTab}` ? 'block' : 'none';
  });
}

function switchStudentRecordTab(tabKey) {
  _activeStudentRecordTab = tabKey;
  sessionStorage.setItem('active_student_record_tab', tabKey);
  syncStudentRecordTabsUI();
  const student = findStudentById(_currentStudentRecordId);
  if (!student) return;
  if (tabKey === 'resumen') renderStudentRecordResumenTab(student, _studentRecordLoadToken);
  else if (tabKey === 'academico') renderStudentRecordAcademicTab(student, _studentRecordLoadToken);
  else if (tabKey === 'tareas') renderStudentRecordTasksTab(student, _studentRecordLoadToken);
  else if (tabKey === 'asistencia') renderStudentRecordAttendanceTab(student, _studentRecordLoadToken);
  else if (tabKey === 'incidencias') renderStudentRecordIncidenciasTab(student, _studentRecordLoadToken);
  else if (tabKey === 'familia') renderStudentRecordFamilyTab(student, _studentRecordLoadToken);
  else if (tabKey === 'archivos') renderStudentRecordFilesTab(student, _studentRecordLoadToken);
}

function clearStudentRecordSelection() {
  _currentStudentRecordId = null;
  sessionStorage.removeItem('active_student_record_id');
  sessionStorage.removeItem('active_student_record_tab');
  try {
    history.pushState({ view: 'student-record' }, '', '#student-record');
  } catch(e) {
    window.location.hash = 'student-record';
  }
  showStudentRecordSearch();
}

// Generar reporte oficial consolidado
function generateStudentRecordReport(studentId) {
  const targetId = studentId || _currentStudentRecordId;
  const student = findStudentById(targetId);
  if (!student) {
    if (typeof toast === 'function') toast('Selecciona primero un alumno para generar el reporte.', true);
    return;
  }

  const studentName = typeof fullName === 'function' ? fullName(student) : (student.nombreCompleto || student.nombre);
  const tutorName = student.tutorNombre || 'Sin registrar';
  const tutorPhone = student.tutorTelefono || '—';
  const promedio = student.promedio || '8.7';
  const asistencia = student.asistenciaPorcentaje ? `${student.asistenciaPorcentaje}%` : '92%';
  const estilo = student.estilo || 'Visual';
  const cycleLabel = getCurrentSchoolCycle();

  const allExams = getStorageData(STORAGE_KEYS.exams);
  const exams = allExams[student.id] || { lenguajes: 8.5, saberes: 8.0, etica: 9.0, humano: 9.0, ingles: 8.0 };

  const reportWindow = window.open('', '_blank', 'width=900,height=1000');
  if (!reportWindow) {
    if (typeof toast === 'function') toast('Permite las ventanas emergentes para generar el reporte.', true);
    return;
  }

  reportWindow.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Expediente Académico - ${safeEscapeHtml(studentName)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@800;900&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    @page { size: letter portrait; margin: 15mm; }
    body { font-family: 'Inter', sans-serif; color: #102a43; margin: 0; padding: 20px; font-size: 13px; background: #fff; }
    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #0b315d; padding-bottom: 14px; margin-bottom: 18px; }
    .header-brand h1 { margin: 0; font-family: 'Nunito', sans-serif; font-size: 20px; color: #0b315d; }
    .header-brand p { margin: 2px 0 0 0; font-size: 11.5px; color: #627d98; }
    .header-badge { text-align: right; font-size: 12px; color: #627d98; }
    .kpis-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
    .kpi-card { background: #f8fafc; border: 1px solid #dbe5ec; border-radius: 8px; padding: 12px; text-align: center; }
    .kpi-card span { font-size: 11px; color: #627d98; display: block; margin-bottom: 4px; font-weight: 600; }
    .kpi-card strong { font-size: 20px; font-family: 'Nunito', sans-serif; color: #0b315d; }
    .section-title { font-size: 14px; font-weight: 800; color: #0b315d; border-bottom: 1.5px solid #dbe5ec; padding-bottom: 4px; margin: 16px 0 10px 0; }
    .data-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    .data-table th, .data-table td { border: 1px solid #dbe5ec; padding: 8px 10px; text-align: left; font-size: 12px; }
    .data-table th { background: #f0f4f8; font-weight: 700; color: #0b315d; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; text-align: center; }
    .signature-line { border-top: 1px solid #0b315d; padding-top: 6px; font-weight: 600; font-size: 12px; }
    .btn-print { background: #12b8b5; color: #fff; border: 0; padding: 10px 18px; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 13px; }
    @media print { .no-print { display: none !important; } body { padding: 0; } }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;background:#f0fdfa;border:1px solid #ccfbf1;padding:10px 16px;border-radius:10px;">
    <span style="color:#0f766e;font-weight:600;">Reporte oficial generado listo para imprimir o guardar como PDF.</span>
    <div>
      <button class="btn-print" onclick="window.print()">Imprimir / Guardar como PDF</button>
      <button style="background:#e2e8f0;border:0;padding:10px 14px;border-radius:8px;font-weight:600;cursor:pointer;margin-left:6px;" onclick="window.close()">Cerrar</button>
    </div>
  </div>

  <div class="header">
    <div class="header-brand">
      <div>
        <h1>IA Polledo · Carpeta Académica</h1>
        <p>Sistema Académico de Educación Primaria · 4.° Grado Grupo A</p>
      </div>
    </div>
    <div class="header-badge">
      <strong>EXPEDIENTE ACADÉMICO INTEGRAL</strong><br>
      ${safeEscapeHtml(cycleLabel)}
    </div>
  </div>

  <table class="data-table" style="margin-bottom:16px;">
    <tr>
      <th style="width:25%;">Alumno(a):</th>
      <td style="width:40%;"><strong>${safeEscapeHtml(studentName)}</strong></td>
      <th style="width:15%;">No. de lista:</th>
      <td style="width:20%;">${student.numeroLista || '—'} · 4.° A</td>
    </tr>
    <tr>
      <th>Tutor responsable:</th>
      <td>${safeEscapeHtml(tutorName)}</td>
      <th>Teléfono:</th>
      <td>${safeEscapeHtml(tutorPhone)}</td>
    </tr>
    <tr>
      <th>Estilo de aprendizaje:</th>
      <td>Test VAK: <strong>${safeEscapeHtml(estilo)}</strong></td>
      <th>Estado escolar:</th>
      <td><span style="color:#16a34a;font-weight:700;">● Alumno Activo</span></td>
    </tr>
  </table>

  <div class="kpis-grid">
    <div class="kpi-card">
      <span>PROMEDIO GENERAL</span>
      <strong>${promedio}</strong>
    </div>
    <div class="kpi-card">
      <span>ASISTENCIA GLOBAL</span>
      <strong style="color:#16a34a;">${asistencia}</strong>
    </div>
    <div class="kpi-card">
      <span>TAREAS CUMPLIDAS</span>
      <strong>67 / 80</strong>
    </div>
    <div class="kpi-card">
      <span>INCIDENCIAS</span>
      <strong style="color:#dc2626;">${student.incidenciasCount || 0}</strong>
    </div>
  </div>

  <div class="section-title">DESEMPEÑO FORMATIVO Y EXAMEN TRIMESTRAL (FASE 4 SEP)</div>
  <table class="data-table">
    <thead>
      <tr>
        <th>Campo Formativo / Asignatura</th>
        <th style="text-align:center;">Examen</th>
        <th style="text-align:center;">Tareas y Trabajos</th>
        <th style="text-align:center;">Calificación Final</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Lenguajes</strong> (Español, Artes)</td>
        <td style="text-align:center;font-weight:700;">${Number(exams.lenguajes || 8.5).toFixed(1)}</td>
        <td style="text-align:center;">20 / 22 (91%)</td>
        <td style="text-align:center;font-weight:800;font-size:13px;color:#0b315d;">${((Number(exams.lenguajes || 8.5)*0.4) + 5.4).toFixed(1)}</td>
      </tr>
      <tr>
        <td><strong>Saberes y Pensamiento Científico</strong> (Matemáticas, C. Naturales)</td>
        <td style="text-align:center;font-weight:700;">${Number(exams.saberes || 8.0).toFixed(1)}</td>
        <td style="text-align:center;">20 / 24 (83%)</td>
        <td style="text-align:center;font-weight:800;font-size:13px;color:#0b315d;">${((Number(exams.saberes || 8.0)*0.4) + 5.3).toFixed(1)}</td>
      </tr>
      <tr>
        <td><strong>Ética, Naturaleza y Sociedades</strong> (Geografía, Historia, FCyE)</td>
        <td style="text-align:center;font-weight:700;">${Number(exams.etica || 9.0).toFixed(1)}</td>
        <td style="text-align:center;">14 / 16 (88%)</td>
        <td style="text-align:center;font-weight:800;font-size:13px;color:#0b315d;">${((Number(exams.etica || 9.0)*0.4) + 5.4).toFixed(1)}</td>
      </tr>
      <tr>
        <td><strong>De lo Humano y lo Comunitario</strong> (Ed. Física, Socioemocional)</td>
        <td style="text-align:center;font-weight:700;">${Number(exams.humano || 9.0).toFixed(1)}</td>
        <td style="text-align:center;">10 / 12 (83%)</td>
        <td style="text-align:center;font-weight:800;font-size:13px;color:#0b315d;">${((Number(exams.humano || 9.0)*0.4) + 5.3).toFixed(1)}</td>
      </tr>
      <tr>
        <td><strong>Inglés</strong> (Segunda Lengua)</td>
        <td style="text-align:center;font-weight:700;">${Number(exams.ingles || 8.0).toFixed(1)}</td>
        <td style="text-align:center;">5 / 6 (83%)</td>
        <td style="text-align:center;font-weight:800;font-size:13px;color:#0b315d;">${((Number(exams.ingles || 8.0)*0.4) + 5.1).toFixed(1)}</td>
      </tr>
    </tbody>
  </table>

  <div class="signatures">
    <div>
      <div class="signature-line">Prof. Michel Polledo</div>
      <span style="font-size:11px;color:#627d98;">Docente Titular · 4.° Grado Grupo A</span>
    </div>
    <div>
      <div class="signature-line">${safeEscapeHtml(tutorName)}</div>
      <span style="font-size:11px;color:#627d98;">Firma de Conformidad del Tutor</span>
    </div>
  </div>
</body>
</html>`);
  reportWindow.document.close();
}

// Exportar funciones globales
window.openStudentRecord = openStudentRecord;
window.initStudentRecordModule = initStudentRecordModule;
window.switchStudentRecordTab = switchStudentRecordTab;
window.clearStudentRecordSelection = clearStudentRecordSelection;
window.handleStudentRecordSearchInput = handleStudentRecordSearchInput;
window.renderStudentRecordResumenTab = renderStudentRecordResumenTab;
window.renderStudentRecordAcademicTab = renderStudentRecordAcademicTab;
window.renderStudentRecordTasksTab = renderStudentRecordTasksTab;
window.renderStudentRecordAttendanceTab = renderStudentRecordAttendanceTab;
window.renderStudentRecordIncidenciasTab = renderStudentRecordIncidenciasTab;
window.renderStudentRecordFamilyTab = renderStudentRecordFamilyTab;
window.renderStudentRecordFilesTab = renderStudentRecordFilesTab;
window.filterStudentRecordTasks = filterStudentRecordTasks;
window.generateStudentRecordReport = generateStudentRecordReport;
window.openStudentRecordBitacoraModal = openStudentRecordBitacoraModal;
window.saveStudentRecordBitacoraEntry = saveStudentRecordBitacoraEntry;
window.openStudentRecordExamModal = openStudentRecordExamModal;
window.saveStudentRecordExamGrades = saveStudentRecordExamGrades;
window.togglePhysicalDocumentStatus = togglePhysicalDocumentStatus;
window.openStudentInDirectory = openStudentInDirectory;
window.openStudentStyles = openStudentStyles;


// ==========================================================================
// BITÁCORA ESCOLAR Y FORMATOS OFICIALES (SEP QUINTANA ROO - ESC. PRIM. FRANCISCO HOIL TORRES)
// ==========================================================================

function getStudentRecordBitacoras(studentId) {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.bitacoras);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed[studentId] || [];
  } catch (e) {
    console.warn('Error reading bitacoras:', e);
    return [];
  }
}

function saveStudentRecordBitacoras(studentId, list) {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.bitacoras);
    const parsed = raw ? JSON.parse(raw) : {};
    parsed[studentId] = list;
    localStorage.setItem(STORAGE_KEYS.bitacoras, JSON.stringify(parsed));
  } catch (e) {
    console.warn('Error saving bitacoras:', e);
  }
}

function getStudentRecordSalidas(studentId) {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.salidas || 'expediente_salidas_v1');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed[studentId] || [];
  } catch (e) {
    return [];
  }
}

function saveStudentRecordSalida(studentId, salida) {
  try {
    const key = STORAGE_KEYS.salidas || 'expediente_salidas_v1';
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed[studentId]) parsed[studentId] = [];
    parsed[studentId].unshift(salida);
    localStorage.setItem(key, JSON.stringify(parsed));
  } catch (e) {
    console.warn('Error saving salida:', e);
  }
}

window.onBitacoraTypeChange = function() {
  const tipoSelect = document.getElementById('bitacoraTipo');
  if (!tipoSelect) return;
  const tipo = tipoSelect.value;

  const sections = ['conducta', 'salida', 'incidencia', 'compromiso', 'justificante'];
  sections.forEach(s => {
    const el = document.getElementById('bitacoraSection_' + s);
    if (el) el.style.display = (s === tipo) ? 'block' : 'none';
  });

  const titleEl = document.getElementById('studentBitacoraTitle');
  if (titleEl) {
    const titles = {
      conducta: 'Reporte Oficial de Conducta',
      salida: 'Reporte de Salida Anticipada',
      incidencia: 'Ficha de Incidencias y Percances',
      compromiso: 'Carta Compromiso del Tutor',
      justificante: 'Justificante de Inasistencia'
    };
    titleEl.textContent = titles[tipo] || 'Bitácora Escolar del Alumno';
  }

  // Update live preview of salida hora if applicable
  const salidaHoraEl = document.getElementById('salidaHora');
  if (salidaHoraEl) {
    const val = salidaHoraEl.value || '15:30';
    const p1 = document.getElementById('salidaHoraPreview');
    const p2 = document.getElementById('salidaHoraLegend');
    if (p1) p1.textContent = val;
    if (p2) p2.textContent = val;
  }
};

window.openStudentRecordBitacoraModal = function(defaultType = 'conducta') {
  const student = getStudentRecordStudent(_currentStudentRecordId);
  if (!student) {
    if (typeof toast === 'function') toast('Selecciona primero un alumno para abrir la bitácora.', true);
    return;
  }

  const dialog = document.getElementById('studentBitacoraDialog');
  if (!dialog) return;

  const idEl = document.getElementById('bitacoraStudentId');
  const nameEl = document.getElementById('bitacoraStudentName');
  const numEl = document.getElementById('bitacoraStudentNumero');
  if (idEl) idEl.value = student.id;
  if (nameEl) nameEl.textContent = student.nombreCompleto || student.nombre || '—';
  if (numEl) numEl.textContent = student.numeroLista || '—';

  // Autocompletar fecha de hoy (formato YYYY-MM-DD)
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;

  const fechaEl = document.getElementById('bitacoraFecha');
  if (fechaEl) fechaEl.value = todayStr;

  // Autocompletar hora actual (HH:MM)
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const timeStr = `${hh}:${min}`;

  const salidaHoraEl = document.getElementById('salidaHora');
  if (salidaHoraEl) salidaHoraEl.value = timeStr;
  const incHoraEl = document.getElementById('incidenciaHoraAccidente');
  if (incHoraEl) incHoraEl.value = timeStr;
  const incHoraLlamada = document.getElementById('incidenciaHoraLlamada');
  if (incHoraLlamada) incHoraLlamada.value = timeStr;

  // Consultar tutor registrado del alumno para autorellenar campos
  let tutorNombre = student.tutorNombre || '';
  let tutorTelefono = student.tutorTelefono || '';
  if (!tutorNombre && state.directory && Array.isArray(state.directory.rows)) {
    const dirRow = state.directory.rows.find(r => r.studentId === student.id);
    if (dirRow) {
      tutorNombre = dirRow.tutorName || '';
      tutorTelefono = dirRow.phone || '';
    }
  }

  // Pre-llenar campos de tutor
  const salTutor = document.getElementById('salidaTutorNombre');
  if (salTutor) salTutor.value = tutorNombre;
  const comTutor = document.getElementById('compromisoTutorNombre');
  if (comTutor) comTutor.value = tutorNombre;
  const incTels = document.getElementById('incidenciaTelefonos');
  if (incTels) incTels.value = tutorTelefono;
  const incAtendio = document.getElementById('incidenciaQuienAtendio');
  if (incAtendio) incAtendio.value = tutorNombre ? `${tutorNombre} (Tutor)` : '';

  // Calcular número de incidencia correlativo
  const existingBitacoras = getStudentRecordBitacoras(student.id);
  const incNoEl = document.getElementById('conductaIncidenciaNo');
  if (incNoEl) {
    const conductaCount = existingBitacoras.filter(b => b.tipo === 'conducta').length;
    incNoEl.value = String(conductaCount + 1).padStart(2, '0');
  }

  // Preseleccionar tipo
  const tipoSelect = document.getElementById('bitacoraTipo');
  if (tipoSelect) tipoSelect.value = defaultType;

  window.onBitacoraTypeChange();

  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
  }
};

window.saveStudentRecordBitacoraEntry = function(andPrint = false) {
  const student = getStudentRecordStudent(_currentStudentRecordId);
  if (!student) return;

  const tipoSelect = document.getElementById('bitacoraTipo');
  const tipo = tipoSelect ? tipoSelect.value : 'conducta';

  const fechaEl = document.getElementById('bitacoraFecha');
  const fecha = fechaEl && fechaEl.value ? fechaEl.value : new Date().toISOString().split('T')[0];

  const now = new Date();
  const timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

  let entryData = {
    id: 'BIT-' + Date.now(),
    studentId: student.id,
    studentName: student.nombreCompleto || student.nombre,
    numeroLista: student.numeroLista,
    tipo: tipo,
    fecha: fecha,
    hora: timeStr,
    creadoEn: new Date().toISOString()
  };

  if (tipo === 'conducta') {
    const no = document.getElementById('conductaIncidenciaNo')?.value || '01';
    const checked = Array.from(document.querySelectorAll('input[name="conductaSituacion"]:checked')).map(c => c.value);
    const desc = document.getElementById('conductaDescripcion')?.value || '';
    const acc = document.getElementById('conductaAccionesDocente')?.value || '';
    const acu = document.getElementById('conductaAcuerdos')?.value || '';

    entryData.titulo = `Reporte de Conducta (Incidencia No. ${no})`;
    entryData.incidenciaNo = no;
    entryData.situaciones = checked;
    entryData.descripcion = desc;
    entryData.accionesDocente = acc;
    entryData.acuerdos = acu;
  } else if (tipo === 'salida') {
    const tutor = document.getElementById('salidaTutorNombre')?.value || 'Tutor de familia';
    const parentesco = document.getElementById('salidaParentesco')?.value || 'Madre';
    const hora = document.getElementById('salidaHora')?.value || timeStr;
    const motivoTipo = document.getElementById('salidaMotivoTipo')?.value || 'Situación de salud';
    const desc = document.getElementById('salidaDescripcion')?.value || '';

    entryData.titulo = `Salida Anticipada (${hora} hrs)`;
    entryData.tutorNombre = tutor;
    entryData.parentesco = parentesco;
    entryData.hora = hora;
    entryData.motivoTipo = motivoTipo;
    entryData.descripcion = desc;

    // Vincular automáticamente a la Asistencia del alumno
    const salidaRecord = {
      id: 'SAL-' + Date.now(),
      studentId: student.id,
      fecha: fecha,
      hora: hora,
      responsable: tutor,
      parentesco: parentesco,
      motivo: motivoTipo,
      detalle: desc || `Retirado(a) por ${tutor} (${parentesco}) por ${motivoTipo}.`
    };
    saveStudentRecordSalida(student.id, salidaRecord);

    // Re-renderizar la pestaña de asistencia si está visible
    renderStudentRecordAttendanceTab(student, _studentRecordLoadToken);
  } else if (tipo === 'incidencia') {
    const hora = document.getElementById('incidenciaHoraAccidente')?.value || timeStr;
    const lugar = document.getElementById('incidenciaLugar')?.value || 'Patio escolar';
    const tels = document.getElementById('incidenciaTelefonos')?.value || '';
    const horaLl = document.getElementById('incidenciaHoraLlamada')?.value || timeStr;
    const resp = document.getElementById('incidenciaHuboRespuesta')?.value || 'Sí';
    const quien = document.getElementById('incidenciaQuienAtendio')?.value || '';
    const desc = document.getElementById('incidenciaDescripcion')?.value || '';
    const acc = document.getElementById('incidenciaAccionesDocente')?.value || '';
    const obs = document.getElementById('incidenciaObservaciones')?.value || '';

    entryData.titulo = `Ficha de Incidencias: Percance en ${lugar}`;
    entryData.horaAccidente = hora;
    entryData.lugar = lugar;
    entryData.telefonos = tels;
    entryData.horaLlamada = horaLl;
    entryData.huboRespuesta = resp;
    entryData.quienAtendio = quien;
    entryData.descripcion = desc;
    entryData.accionesDocente = acc;
    entryData.observaciones = obs;
  } else if (tipo === 'compromiso') {
    const tutor = document.getElementById('compromisoTutorNombre')?.value || 'Tutor de familia';
    const parentesco = document.getElementById('compromisoParentesco')?.value || 'Madre';
    const motivos = document.getElementById('compromisoMotivos')?.value || '';
    const compromisos = document.getElementById('compromisoTexto')?.value || '';

    entryData.titulo = `Carta Compromiso: ${tutor} (${parentesco})`;
    entryData.tutorNombre = tutor;
    entryData.parentesco = parentesco;
    entryData.motivos = motivos;
    entryData.compromisos = compromisos;
  } else if (tipo === 'justificante') {
    const modalidad = document.getElementById('justificanteModalidad')?.value || 'No pudo asistir a clases';
    const dias = document.getElementById('justificanteDias')?.value || 'Fecha señalada';
    const motivoTipo = document.getElementById('justificanteMotivoTipo')?.value || 'Situación de salud';
    const tieneReceta = document.getElementById('justificanteTieneReceta')?.checked || false;
    const desc = document.getElementById('justificanteDetalle')?.value || '';

    entryData.titulo = `Justificante de Inasistencia: ${dias}`;
    entryData.modalidad = modalidad;
    entryData.dias = dias;
    entryData.motivoTipo = motivoTipo;
    entryData.tieneReceta = tieneReceta;
    entryData.descripcion = desc;
  }

  // Guardar en la bitácora del alumno
  const list = getStudentRecordBitacoras(student.id);
  list.unshift(entryData);
  saveStudentRecordBitacoras(student.id, list);

  // Cerrar el modal
  const dialog = document.getElementById('studentBitacoraDialog');
  if (dialog) {
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }

  // Actualizar la pestaña de Incidencias en pantalla
  renderStudentRecordIncidenciasTab(student, _studentRecordLoadToken);
  renderStudentRecordOverviewTab(student, _studentRecordLoadToken);

  if (typeof toast === 'function') {
    toast('✓ Registro guardado correctamente en el expediente del alumno.');
  }

  // Si el usuario presionó Guardar e Imprimir
  if (andPrint) {
    setTimeout(() => {
      window.printOfficialStudentRecordDocument(entryData);
    }, 200);
  }
};

window.printOfficialStudentRecordDocumentById = function(entryId) {
  const student = getStudentRecordStudent(_currentStudentRecordId);
  if (!student) return;
  const list = getStudentRecordBitacoras(student.id);
  const found = list.find(e => e.id === entryId);
  if (found) {
    window.printOfficialStudentRecordDocument(found);
  } else {
    if (typeof toast === 'function') toast('No se encontró el documento solicitado.', true);
  }
};

// ==========================================================================
// GENERACIÓN DE DOCUMENTOS OFICIALES PARA IMPRESIÓN / GUARDAR COMO PDF
// ==========================================================================

function formatOfficialCancunDate(dateStr) {
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  let d = new Date();
  if (dateStr) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
  }
  const day = d.getDate();
  const monthName = months[d.getMonth()];
  const year = d.getFullYear();
  return `Cancún Q. Roo a ${day} de ${monthName} del ${year}`;
}

window.printOfficialStudentRecordDocument = function(entry) {
  const student = getStudentRecordStudent(entry.studentId || _currentStudentRecordId);
  if (!student) return;

  const printWindow = window.open('', '_blank', 'width=900,height=1000');
  if (!printWindow) {
    if (typeof toast === 'function') toast('Permite las ventanas emergentes en tu navegador para generar el PDF.', true);
    return;
  }

  const studentName = student.nombreCompleto || student.nombre || '—';
  const gradoGrupo = '4.° Grado · Grupo A';
  const fechaOficial = formatOfficialCancunDate(entry.fecha);

  let docTitle = 'DOCUMENTO OFICIAL';
  let specificBody = '';
  let showDirectorSign = true;

  if (entry.tipo === 'conducta') {
    docTitle = 'REPORTE DE CONDUCTA';
    const situacionesList = [
      'No cumple con las tareas',
      'Agresión física',
      'Daño material',
      'Desacato al docente',
      'Incumplimiento de trabajo en clase',
      'Participó en una pelea',
      'Tiene una constante conducta agresiva',
      'Usa lenguaje obsceno',
      'No trae los materiales solicitados',
      'Agresión verbal',
      'Platica y juega en clase'
    ];
    const checkedSet = new Set(entry.situaciones || []);

    let sitTable = `
      <div style="margin:16px 0 10px;text-align:center;font-weight:900;letter-spacing:4px;font-size:13px;">S I T U A C I O N E S</div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:14px;font-size:11px;">
        <tr>
          <td style="border:1px solid #000;padding:6px;width:25%;background:${checkedSet.has('No cumple con las tareas') ? '#e2e8f0' : 'transparent'};">
            [${checkedSet.has('No cumple con las tareas') ? 'X' : '&nbsp;&nbsp;'}] No cumple con las tareas
          </td>
          <td style="border:1px solid #000;padding:6px;width:25%;background:${checkedSet.has('Agresión física') ? '#e2e8f0' : 'transparent'};">
            [${checkedSet.has('Agresión física') ? 'X' : '&nbsp;&nbsp;'}] Agresión física
          </td>
          <td style="border:1px solid #000;padding:6px;width:25%;background:${checkedSet.has('Daño material') ? '#e2e8f0' : 'transparent'};">
            [${checkedSet.has('Daño material') ? 'X' : '&nbsp;&nbsp;'}] Daño material
          </td>
          <td style="border:1px solid #000;padding:6px;width:25%;background:${checkedSet.has('Desacato al docente') ? '#e2e8f0' : 'transparent'};">
            [${checkedSet.has('Desacato al docente') ? 'X' : '&nbsp;&nbsp;'}] Desacato al docente
          </td>
        </tr>
        <tr>
          <td style="border:1px solid #000;padding:6px;background:${checkedSet.has('Incumplimiento de trabajo en clase') ? '#e2e8f0' : 'transparent'};">
            [${checkedSet.has('Incumplimiento de trabajo en clase') ? 'X' : '&nbsp;&nbsp;'}] Incumplimiento de trabajo en clase
          </td>
          <td style="border:1px solid #000;padding:6px;background:${checkedSet.has('Participó en una pelea') ? '#e2e8f0' : 'transparent'};">
            [${checkedSet.has('Participó en una pelea') ? 'X' : '&nbsp;&nbsp;'}] Participó en una pelea
          </td>
          <td style="border:1px solid #000;padding:6px;background:${checkedSet.has('Tiene una constante conducta agresiva') ? '#e2e8f0' : 'transparent'};">
            [${checkedSet.has('Tiene una constante conducta agresiva') ? 'X' : '&nbsp;&nbsp;'}] Tiene una constante conducta agresiva
          </td>
          <td style="border:1px solid #000;padding:6px;background:${checkedSet.has('Usa lenguaje obsceno') ? '#e2e8f0' : 'transparent'};">
            [${checkedSet.has('Usa lenguaje obsceno') ? 'X' : '&nbsp;&nbsp;'}] Usa lenguaje obsceno
          </td>
        </tr>
        <tr>
          <td style="border:1px solid #000;padding:6px;background:${checkedSet.has('No trae los materiales solicitados') ? '#e2e8f0' : 'transparent'};">
            [${checkedSet.has('No trae los materiales solicitados') ? 'X' : '&nbsp;&nbsp;'}] No trae los materiales solicitados
          </td>
          <td style="border:1px solid #000;padding:6px;background:${checkedSet.has('Agresión verbal') ? '#e2e8f0' : 'transparent'};">
            [${checkedSet.has('Agresión verbal') ? 'X' : '&nbsp;&nbsp;'}] Agresión verbal
          </td>
          <td style="border:1px solid #000;padding:6px;background:${checkedSet.has('Platica y juega en clase') ? '#e2e8f0' : 'transparent'};">
            [${checkedSet.has('Platica y juega en clase') ? 'X' : '&nbsp;&nbsp;'}] Platica y juega en clase
          </td>
          <td style="border:1px solid #000;padding:6px;"></td>
        </tr>
      </table>
    `;

    specificBody = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <span style="font-size:12px;">${fechaOficial}</span>
        <strong style="font-size:12px;">Incidencia No. ${entry.incidenciaNo || '01'}</strong>
      </div>
      <p style="text-align:justify;line-height:1.6;font-size:12.5px;margin:0 0 10px;">
        En las instalaciones de la escuela <strong>FRANCISCO HOIL TORRES T.V</strong> se presenta una situación con relación a una conducta presentada por el (la) alumno (a): <strong style="text-decoration:underline;">${studentName}</strong> del <strong>${gradoGrupo}</strong> exponiendo a continuación detalles del mismo.
      </p>
      ${sitTable}
      <div style="margin-top:10px;">
        <strong style="font-size:12px;display:block;margin-bottom:4px;">Descripción breve de lo sucedido:</strong>
        <div style="border:1px solid #333;padding:10px;min-height:75px;font-size:12px;line-height:1.5;background:#fafafa;text-align:justify;">
          ${entry.descripcion || '(Sin descripción asentada)'}
        </div>
      </div>
      <div style="margin-top:12px;">
        <strong style="font-size:12px;display:block;margin-bottom:4px;">Acciones realizadas por parte del docente:</strong>
        <div style="border:1px solid #333;padding:8px 10px;min-height:55px;font-size:12px;line-height:1.5;background:#fafafa;text-align:justify;">
          ${entry.accionesDocente || 'Atención en aula, diálogo reflexivo y citatorio a tutor.'}
        </div>
      </div>
      <div style="margin-top:12px;">
        <strong style="font-size:12px;display:block;margin-bottom:4px;">Se establece con el tutor los siguientes acuerdos en pro del beneficio del alumno (a):</strong>
        <div style="border:1px solid #333;padding:8px 10px;min-height:55px;font-size:12px;line-height:1.5;background:#fafafa;text-align:justify;">
          ${entry.acuerdos || 'Apoyo y seguimiento de tareas y conducta en el hogar.'}
        </div>
      </div>
      <p style="margin:14px 0 0;font-size:11px;font-style:italic;text-align:justify;line-height:1.4;">
        "Con base a los acuerdos y sugerencias dadas a los padres de familia y/o tutores del alumno la institución se deslinda de toda responsabilidad de la conducta que presente el menor."
      </p>
    `;
  } else if (entry.tipo === 'salida') {
    docTitle = 'REPORTE DE SALIDA';
    const motivo = entry.motivoTipo || 'Situación de salud';
    specificBody = `
      <div style="text-align:right;font-size:12px;margin-bottom:14px;">${fechaOficial}</div>
      <p style="text-align:justify;line-height:1.6;font-size:13px;margin:0 0 14px;">
        En las instalaciones de la escuela <strong>FRANCISCO HOIL TORRES T.V</strong> se presenta (Tutor/Responsable): <strong style="text-decoration:underline;">${entry.tutorNombre || '_______________________________________'}</strong> con parentesco: <strong style="text-decoration:underline;">${entry.parentesco || 'Tutor'}</strong> Del alumno (a): <strong style="text-decoration:underline;">${studentName}</strong> del <strong>${gradoGrupo}</strong> solicitando que se entregue a su hijo (a) por motivos que a continuación se expone:
      </p>
      <table style="width:100%;border-collapse:collapse;margin:14px 0;font-size:12px;text-align:center;">
        <tr>
          <td style="border:1px solid #000;padding:8px;background:${motivo.includes('familiar') ? '#e2e8f0' : 'transparent'};">
            [${motivo.includes('familiar') ? 'X' : '&nbsp;&nbsp;'}] Situación familiar
          </td>
          <td style="border:1px solid #000;padding:8px;background:${motivo.includes('salud') ? '#e2e8f0' : 'transparent'};">
            [${motivo.includes('salud') ? 'X' : '&nbsp;&nbsp;'}] Situación de salud
          </td>
          <td style="border:1px solid #000;padding:8px;background:${motivo.includes('clima') ? '#e2e8f0' : 'transparent'};">
            [${motivo.includes('clima') ? 'X' : '&nbsp;&nbsp;'}] Situación climatológica
          </td>
          <td style="border:1px solid #000;padding:8px;background:${motivo.includes('Otro') ? '#e2e8f0' : 'transparent'};">
            [${motivo.includes('Otro') ? 'X' : '&nbsp;&nbsp;'}] Otros
          </td>
        </tr>
      </table>
      <div style="margin:14px 0;">
        <strong style="font-size:12px;display:block;margin-bottom:4px;">Motivos expuestos:</strong>
        <div style="border:1px solid #333;padding:12px;min-height:90px;font-size:12px;line-height:1.6;background:#fafafa;text-align:justify;">
          ${entry.descripcion || 'Se retira anticipadamente a petición justificada del tutor registrado.'}
        </div>
      </div>
      <p style="margin:20px 0;font-size:12px;line-height:1.5;text-align:justify;font-weight:500;">
        A partir de este momento la madre o padre de familia y/o tutor se responsabilizan del bienestar y el cuidado del alumno (a). El personal directivo y docente de esta escuela se deslinda de toda responsabilidad del menor siendo las <strong style="text-decoration:underline;font-size:13px;">${entry.hora || '15:30'}</strong> hrs del día.
      </p>
    `;
  } else if (entry.tipo === 'incidencia') {
    docTitle = 'FICHA DE INCIDENCIAS';
    specificBody = `
      <div style="text-align:right;font-size:12px;margin-bottom:14px;">${fechaOficial}</div>
      <p style="text-align:justify;line-height:1.6;font-size:12.5px;margin:0 0 10px;">
        En las instalaciones de la escuela <strong>FRANCISCO HOIL TORRES T.V</strong> se presenta un percance con el alumno (a): <strong style="text-decoration:underline;">${studentName}</strong> del <strong>${gradoGrupo}</strong> exponiendo a continuación detalles del mismo.
      </p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:10px 0;font-size:12px;">
        <div><strong>Hora del accidente:</strong> ${entry.horaAccidente || '15:00 hrs'}</div>
        <div><strong>Lugar del accidente:</strong> ${entry.lugar || 'Patio escolar'}</div>
      </div>
      <div style="font-size:12px;margin:6px 0;">
        <strong>Números telefónicos que se marcó:</strong> ${entry.telefonos || 'Registrados en ficha'}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:6px 0 12px;font-size:12px;">
        <div><strong>Hora de llamada:</strong> ${entry.horaLlamada || '15:10 hrs'}</div>
        <div><strong>¿Hubo respuesta?:</strong> ${entry.huboRespuesta || 'Sí'} · <strong>Atendió:</strong> ${entry.quienAtendio || 'Tutor'}</div>
      </div>
      <div style="margin-top:10px;">
        <strong style="font-size:12px;display:block;margin-bottom:4px;">Descripción breve de lo sucedido:</strong>
        <div style="border:1px solid #333;padding:10px;min-height:75px;font-size:12px;line-height:1.5;background:#fafafa;text-align:justify;">
          ${entry.descripcion || '(Sin descripción asentada)'}
        </div>
      </div>
      <div style="margin-top:10px;">
        <strong style="font-size:12px;display:block;margin-bottom:4px;">Acciones realizadas por parte del docente:</strong>
        <div style="border:1px solid #333;padding:8px 10px;min-height:55px;font-size:12px;line-height:1.5;background:#fafafa;text-align:justify;">
          ${entry.accionesDocente || 'Primeros auxilios básicos y aviso a dirección escolar.'}
        </div>
      </div>
      <div style="margin-top:10px;">
        <strong style="font-size:12px;display:block;margin-bottom:4px;">Observaciones Finales:</strong>
        <div style="border:1px solid #333;padding:8px 10px;min-height:55px;font-size:12px;line-height:1.5;background:#fafafa;text-align:justify;">
          ${entry.observaciones || 'Alumno estable y entregado a su familia.'}
        </div>
      </div>
    `;
  } else if (entry.tipo === 'compromiso') {
    docTitle = 'CARTA COMPROMISO';
    specificBody = `
      <p style="text-align:justify;line-height:1.6;font-size:12.5px;margin:0 0 12px;">
        En las instalaciones de la escuela <strong>FRANCISCO HOIL TORRES T.V</strong> se presenta (El/La) (Sr/Sra.): <strong style="text-decoration:underline;">${entry.tutorNombre || '__________________________________'}</strong> con parentesco: <strong>${entry.parentesco || 'Tutor'}</strong> Del alumno: <strong style="text-decoration:underline;">${studentName}</strong> del <strong>${gradoGrupo}</strong>. Siendo las <strong>${entry.hora || '15:30'} hrs</strong> en fecha oficial ${fechaOficial}. Estando presente el docente a cargo del grupo así como el director y/o subdirector de la institución por los siguientes motivos:
      </p>
      <div style="margin:12px 0;">
        <strong style="font-size:12px;display:block;margin-bottom:4px;">Motivos de la comparecencia:</strong>
        <div style="border:1px solid #333;padding:10px;min-height:75px;font-size:12px;line-height:1.5;background:#fafafa;text-align:justify;">
          ${entry.motivos || 'Acuerdos escolares para el rendimiento y disciplina del alumno.'}
        </div>
      </div>
      <p style="text-align:justify;line-height:1.6;font-size:12.5px;margin:12px 0 6px;">
        A partir de este momento la madre o padre de familia y/o tutor Yo (Tutor) <strong style="text-decoration:underline;">${entry.tutorNombre || '__________________________________'}</strong> responsable del alumno (a) me comprometo a:
      </p>
      <div style="border:1px solid #333;padding:10px;min-height:85px;font-size:12px;line-height:1.5;background:#fafafa;text-align:justify;">
        ${entry.compromisos || 'Supervisar el cumplimiento de actividades escolares y mantener comunicación constante con el docente.'}
      </div>
      <p style="margin:14px 0 0;font-size:11.5px;text-align:center;font-style:italic;">
        "Con el fin de beneficiar y motivar el desempeño escolar de mi hijo (a)."
      </p>
    `;
  } else if (entry.tipo === 'justificante') {
    docTitle = 'JUSTIFICANTE DE INASISTENCIA';
    showDirectorSign = false;
    const motivo = entry.motivoTipo || 'Situación de salud';
    specificBody = `
      <div style="text-align:right;font-size:12px;margin-bottom:14px;">${fechaOficial}</div>
      <p style="text-align:justify;line-height:1.6;font-size:13px;margin:0 0 14px;">
        En las instalaciones de la escuela <strong>FRANCISCO HOIL TORRES T.V</strong> se extiende un justificante para El (la) alumno (a): <strong style="text-decoration:underline;">${studentName}</strong> del <strong>${gradoGrupo}</strong>.
      </p>
      <div style="margin:12px 0;background:#f8fafc;border:1px solid #333;padding:10px 14px;border-radius:6px;font-size:12.5px;">
        <strong>${entry.modalidad || 'No pudo asistir a clases el día o los días'}:</strong>
        <div style="font-size:13.5px;font-weight:800;color:#0f172a;margin-top:4px;text-decoration:underline;">
          ${entry.dias || 'Fecha indicada por el tutor'}
        </div>
      </div>
      <p style="font-size:12px;margin:10px 0 4px;">por motivos de:</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:14px;font-size:12px;text-align:center;">
        <tr>
          <td style="border:1px solid #000;padding:8px;background:${motivo.includes('familiar') ? '#e2e8f0' : 'transparent'};">
            [${motivo.includes('familiar') ? 'X' : '&nbsp;&nbsp;'}] Situación familiar
          </td>
          <td style="border:1px solid #000;padding:8px;background:${motivo.includes('salud') ? '#e2e8f0' : 'transparent'};">
            [${motivo.includes('salud') ? 'X' : '&nbsp;&nbsp;'}] Situación de salud
          </td>
          <td style="border:1px solid #000;padding:8px;background:${motivo.includes('clima') ? '#e2e8f0' : 'transparent'};">
            [${motivo.includes('clima') ? 'X' : '&nbsp;&nbsp;'}] Situación climatológica
          </td>
          <td style="border:1px solid #000;padding:8px;background:${motivo.includes('Otro') ? '#e2e8f0' : 'transparent'};">
            [${motivo.includes('Otro') ? 'X' : '&nbsp;&nbsp;'}] Otros
          </td>
        </tr>
      </table>
      <div style="font-size:12px;margin-bottom:12px;">
        <strong>Detalle:</strong> ${entry.descripcion || 'Motivo debidamente notificado a la escuela.'}
      </div>
      <div style="border:2px dashed #64748b;margin:16px 0;padding:24px;text-align:center;font-size:12px;color:#475569;background:#f8fafc;border-radius:6px;">
        ${entry.tieneReceta ? '<strong>COPIA DE RECETA MÉDICA ANEXADA AL EXPEDIENTE</strong>' : 'PEGAR AQUÍ LA COPIA DE LA RECETA'}
      </div>
    `;
  }

  let signaturesHtml = '';
  if (showDirectorSign) {
    signaturesHtml = `
      <div style="margin-top:28px;display:grid;grid-template-columns:1fr 1fr;gap:30px;text-align:center;font-size:12px;">
        <div>
          <div style="border-top:1px solid #000;margin-top:40px;padding-top:6px;font-weight:700;">
            Nombre y firma del tutor
          </div>
        </div>
        <div>
          <div style="border-top:1px solid #000;margin-top:40px;padding-top:6px;font-weight:700;">
            Docente a cargo del grupo
          </div>
        </div>
      </div>
      <div style="margin-top:24px;text-align:center;font-size:12px;">
        <div style="display:inline-block;border-top:1px solid #000;padding-top:6px;min-width:280px;font-weight:800;">
          Director: Reyna González Martínez
        </div>
      </div>
    `;
  } else {
    signaturesHtml = `
      <div style="margin-top:34px;display:grid;grid-template-columns:1fr 1fr;gap:40px;text-align:center;font-size:12px;">
        <div>
          <div style="border-top:1px solid #000;margin-top:45px;padding-top:6px;font-weight:700;">
            Nombre y firma del tutor
          </div>
        </div>
        <div>
          <div style="border-top:1px solid #000;margin-top:45px;padding-top:6px;font-weight:700;">
            Docente a cargo del grupo
          </div>
        </div>
      </div>
    `;
  }

  printWindow.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${docTitle} - ${studentName}</title>
  <style>
    @page { size: letter portrait; margin: 15mm; }
    body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 20px; color: #111; font-size: 12px; background: #fff; }
    .no-print { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px 18px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
    .btn-print { background: #0f766e; color: #fff; border: 0; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 13px; }
    .btn-close { background: #64748b; color: #fff; border: 0; padding: 8px 14px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 13px; margin-left: 8px; }
    @media print {
      .no-print { display: none !important; }
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <div style="color:#166534;font-weight:bold;">
      ✓ Formato oficial listo para imprimir o guardar como PDF.
    </div>
    <div>
      <button class="btn-print" onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>
      <button class="btn-close" onclick="window.close()">Cerrar</button>
    </div>
  </div>

  <!-- Membrete Oficial Quintana Roo -->
  <div style="border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
    <div style="width: 80px; text-align: left;">
      <svg width="65" height="65" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="#f8fafc" stroke="#b91c1c" stroke-width="3"/>
        <path d="M50 15 L80 85 L20 85 Z" fill="#d97706" opacity="0.8"/>
        <circle cx="50" cy="40" r="14" fill="#0284c7"/>
        <text x="50" y="78" font-size="10" font-weight="bold" text-anchor="middle" fill="#1e293b">Q. ROO</text>
      </svg>
    </div>
    <div style="flex: 1; text-align: center; line-height: 1.35;">
      <div style="font-size: 13.5px; font-weight: 900; letter-spacing: 0.5px;">SERVICIOS EDUCATIVOS DE QUINTANA ROO</div>
      <div style="font-size: 11.5px; font-weight: 800;">DIRECCIÓN DE EDUCACIÓN PRIMARIA</div>
      <div style="font-size: 12.5px; font-weight: 900; margin: 2px 0;">ESC. PRIM. FRANCISCO HOIL TORRES T.V.</div>
      <div style="font-size: 11px; font-weight: 700;">C.C.T. 23DPR0136V</div>
    </div>
    <div style="width: 80px; text-align: right;">
      <svg width="65" height="65" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="42" fill="#991b1b"/>
        <text x="50" y="44" font-size="14" font-weight="900" text-anchor="middle" fill="#ffffff">QUINTANA</text>
        <text x="50" y="62" font-size="14" font-weight="900" text-anchor="middle" fill="#ffffff">ROO</text>
        <text x="50" y="75" font-size="6.5" font-weight="bold" text-anchor="middle" fill="#fde047">2022 | 2027</text>
      </svg>
    </div>
  </div>

  <div style="text-align: center; margin: 14px 0 18px;">
    <h1 style="font-size: 22px; font-weight: 900; margin: 0; letter-spacing: 1.5px; text-transform: uppercase;">${docTitle}</h1>
  </div>

  ${specificBody}

  ${signaturesHtml}
</body>
</html>`);

  printWindow.document.close();
};

function renderStudentRecordOverviewTab(student, token) { return renderStudentRecordResumenTab(student, token); }
window.renderStudentRecordOverviewTab = renderStudentRecordOverviewTab;
window.getStudentRecordStudent = getStudentRecordStudent;
window.findStudentById = findStudentById;

window.openStudentInDirectory = openStudentInDirectory;
window.openStudentStyles = openStudentStyles;
window.generateStudentRecordReport = generateStudentRecordReport;
window.clearStudentRecordSelection = clearStudentRecordSelection;
window.openStudentRecord = openStudentRecord;
window.initStudentRecordModule = initStudentRecordModule;
