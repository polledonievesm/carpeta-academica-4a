/* ==========================================================================
   MÓDULO DE VISTA: EVALUACIONES TRIMESTRALES
   ETAPA 1: Estructura, navegación modular y panel de seguimiento
   ETAPA 2: Almacenamiento, configuración de periodos, criterios y valores
   ========================================================================== */

(function () {
  'use strict';

  // Claves para persistencia local y borradores (preparado para sincronizar con backend)
  const STORAGE_KEYS = {
    config: 'carpeta_eval_config_v2',
    draft: 'carpeta_eval_draft_v2',
    evals: 'carpeta_eval_records_v2'
  };

  // Catálogo de criterios de evaluación institucionales con su propuesta inicial
  const CRITERIOS_CATALOGO = [
    { id: 'tareas', nombre: 'Tareas', desc: 'Cumplimiento, calidad y entrega de actividades asignadas', defaultPct: 50 },
    { id: 'actividades', nombre: 'Actividades en clase', desc: 'Trabajos y ejercicios realizados durante la jornada escolar', defaultPct: 0 },
    { id: 'examen', nombre: 'Examen escrito', desc: 'Evaluaciones escritas trimestrales por campo formativo', defaultPct: 30 },
    { id: 'conducta', nombre: 'Conducta', desc: 'Convivencia, seguimiento de acuerdos y autorregulación escolar', defaultPct: 10 },
    { id: 'participacion', nombre: 'Participación', desc: 'Aportaciones y colaboraciones en clases y proyectos', defaultPct: 10 },
    { id: 'asistencia', nombre: 'Asistencia', desc: 'Porcentaje de asistencia regular registrada en el periodo', defaultPct: 0 },
    { id: 'puntualidad', nombre: 'Puntualidad', desc: 'Llegadas a tiempo al inicio de la jornada escolar', defaultPct: 0 }
  ];

  // Configuración inicial por defecto (propuesta editable)
  function createDefaultConfig() {
    return {
      cicloEscolar: '2026-2027',
      grupo: '4.° A',
      zonaHoraria: 'America/Cancun',
      modoPeriodo: 'auto', // 'auto' | 'manual'
      ajusteManualTrimester: 1,
      periodos: {
        1: { id: 1, nombre: 'Primer Trimestre', inicio: '2026-08-26', fin: '2026-11-27', estado: 'in-progress' },
        2: { id: 2, nombre: 'Segundo Trimestre', inicio: '2026-11-30', fin: '2027-03-26', estado: 'pending' },
        3: { id: 3, nombre: 'Tercer Trimestre', inicio: '2027-04-12', fin: '2027-07-16', estado: 'pending' }
      },
      porcentajes: {
        1: { tareas: 50, actividades: 0, examen: 30, conducta: 10, participacion: 10, asistencia: 0, puntualidad: 0 },
        2: { tareas: 50, actividades: 0, examen: 30, conducta: 10, participacion: 10, asistencia: 0, puntualidad: 0 },
        3: { tareas: 50, actividades: 0, examen: 30, conducta: 10, participacion: 10, asistencia: 0, puntualidad: 0 }
      },
      valoresTareas: {
        entregada: 100,
        incompleta: 50,
        tarde: 80,
        noEntregada: 0,
        pendiente: null // Sin valoración definitiva
      },
      valoresConducta: {
        excelente: 100,
        adecuada: 80,
        requiereApoyo: 60
      },
      valoresParticipacion: {
        alta: 100,
        media: 75,
        nula: 0
      },
      updatedAt: new Date().toISOString(),
      version: 1
    };
  }

  // Estado local en memoria de la vista
  const evalState = {
    trimester: 1, // Trimestre actualmente seleccionado en la vista
    activeTab: 'seguimiento', // 'seguimiento' | 'captura-grupal' | 'captura-individual' | 'criterios'
    configTrimesterTab: 1, // Trimestre cuyos porcentajes se editan en la pestaña Criterios
    searchQuery: '',
    statusFilter: '',
    config: loadConfig(),
    hasUnsavedChanges: false,
    evaluations: loadEvaluationsStore()
  };

  /**
   * Obtiene la fecha actual en la zona horaria oficial de Quintana Roo (Cancún)
   * @returns {string} Fecha en formato YYYY-MM-DD
   */
  function getTodayCancunDate() {
    if (typeof todayCancun === 'function') {
      try { return todayCancun(); } catch (e) {}
    }
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Cancun'
      }).formatToParts(new Date()).reduce((a, p) => (a[p.type] = p.value, a), {});
      return `${parts.year}-${parts.month}-${parts.day}`;
    } catch (e) {
      return new Date().toISOString().slice(0, 10);
    }
  }

  /**
   * Determina automáticamente el trimestre escolar actual según las fechas configuradas
   * y la zona horaria de Quintana Roo, o el ajuste administrativo
   * @returns {number} 1, 2 o 3
   */
  function determineCurrentTrimester(cfg = evalState.config) {
    if (!cfg) return 1;
    if (cfg.modoPeriodo === 'manual' && cfg.ajusteManualTrimester) {
      return Number(cfg.ajusteManualTrimester) || 1;
    }

    const today = getTodayCancunDate();
    const p1 = cfg.periodos?.[1];
    const p2 = cfg.periodos?.[2];
    const p3 = cfg.periodos?.[3];

    if (p1 && today >= p1.inicio && today <= p1.fin) return 1;
    if (p2 && today >= p2.inicio && today <= p2.fin) return 2;
    if (p3 && today >= p3.inicio && today <= p3.fin) return 3;

    // Si está entre periodos o después
    if (p1 && p2 && today > p1.fin && today < p2.inicio) return 1; // En cierre de T1
    if (p2 && p3 && today > p2.fin && today < p3.inicio) return 2; // En cierre de T2
    if (p3 && today > p3.fin) return 3; // En cierre anual / T3

    return 1;
  }

  /**
   * Carga la configuración desde almacenamiento local o devuelve la inicial
   */
  function loadConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.config);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Mezclar con valores por defecto para asegurar integridad de claves
        return Object.assign(createDefaultConfig(), parsed);
      }
    } catch (err) {
      console.warn('Error al cargar configuración de evaluaciones:', err);
    }
    return createDefaultConfig();
  }

  /**
   * Carga el almacén de evaluaciones
   */
  function loadEvaluationsStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.evals);
      if (raw) return JSON.parse(raw) || {};
    } catch (e) {}
    return {};
  }

  // Registrar título de vista en el diccionario global si existe
  if (typeof VIEW_TITLES !== 'undefined') {
    VIEW_TITLES['evaluaciones-trimestrales'] = 'Evaluaciones Trimestrales';
  }

  /**
   * Inicializa la vista principal de Evaluaciones Trimestrales
   */
  function initEvaluacionesTrimestrales() {
    const view = document.getElementById('evaluaciones-trimestrales');
    if (!view) return;

    // Asegurar título en la barra superior si la vista está activa
    const title = document.getElementById('currentViewTitle');
    if (title && view.classList.contains('active')) {
      title.textContent = 'Evaluaciones Trimestrales';
    }

    // Configurar listeners si aún no se han asignado
    bindEventsOnce();

    // Actualizar trimestre detectado si está en modo automático
    const currentActual = determineCurrentTrimester();
    if (!evalState.trimester) {
      evalState.trimester = currentActual;
    }

    // Renderizar componentes
    renderTrimesterSelector();
    renderTrackingPanel();
    renderConfigTab();
  }

  /**
   * Asignación de escuchadores de eventos
   */
  let _eventsBound = false;
  function bindEventsOnce() {
    if (_eventsBound) return;

    const searchInput = document.getElementById('evalStudentSearch');
    const statusSelect = document.getElementById('evalStatusFilter');

    if (searchInput) {
      searchInput.addEventListener('input', e => {
        evalState.searchQuery = (e.target.value || '').trim().toLowerCase();
        renderTrackingTable();
      });
    }

    if (statusSelect) {
      statusSelect.addEventListener('change', e => {
        evalState.statusFilter = e.target.value || '';
        renderTrackingTable();
      });
    }

    // Escuchadores de la pestaña Criterios y Periodos
    const criteriaTrimesterSelect = document.getElementById('evalCriteriaTrimesterSelect');
    if (criteriaTrimesterSelect) {
      criteriaTrimesterSelect.addEventListener('change', e => {
        evalState.configTrimesterTab = Number(e.target.value) || 1;
        renderCriteriaInputs();
        updateCriteriaSumDisplay();
      });
    }

    const periodModeSelect = document.getElementById('evalPeriodModeSelect');
    const manualChoiceSelect = document.getElementById('evalManualTrimesterChoice');
    if (periodModeSelect) {
      periodModeSelect.addEventListener('change', e => {
        const isManual = e.target.value === 'manual';
        const overrideRow = document.getElementById('evalManualOverrideRow');
        if (overrideRow) overrideRow.style.display = isManual ? 'flex' : 'none';
        evalState.config.modoPeriodo = isManual ? 'manual' : 'auto';
        markUnsavedChanges();
        validatePeriods();
      });
    }

    if (manualChoiceSelect) {
      manualChoiceSelect.addEventListener('change', e => {
        evalState.config.ajusteManualTrimester = Number(e.target.value) || 1;
        markUnsavedChanges();
        renderTrimesterSelector();
      });
    }

    // Escuchar cambios en campos de fechas y estados de periodos
    [1, 2, 3].forEach(t => {
      const startInput = document.getElementById(`evalDateStart${t}`);
      const endInput = document.getElementById(`evalDateEnd${t}`);
      const statusSelectT = document.getElementById(`evalStatusSelect${t}`);

      startInput?.addEventListener('change', () => {
        if (evalState.config.periodos[t]) evalState.config.periodos[t].inicio = startInput.value;
        markUnsavedChanges();
        validatePeriods();
      });

      endInput?.addEventListener('change', () => {
        if (evalState.config.periodos[t]) evalState.config.periodos[t].fin = endInput.value;
        markUnsavedChanges();
        validatePeriods();
      });

      statusSelectT?.addEventListener('change', () => {
        if (evalState.config.periodos[t]) evalState.config.periodos[t].estado = statusSelectT.value;
        markUnsavedChanges();
        renderTrimesterSelector();
      });
    });

    // Escuchar cambios en ciclo escolar
    const cicloInput = document.getElementById('evalCfgCiclo');
    cicloInput?.addEventListener('input', () => {
      evalState.config.cicloEscolar = cicloInput.value.trim();
      markUnsavedChanges();
    });

    // Escuchar cambios en valores de tareas, conducta y participación
    const bindValInput = (id, objPath, key) => {
      const el = document.getElementById(id);
      el?.addEventListener('input', () => {
        const val = Number(el.value);
        if (!isNaN(val)) {
          evalState.config[objPath][key] = Math.max(0, Math.min(100, val));
          markUnsavedChanges();
        }
      });
    };

    bindValInput('evalValTaskEntregada', 'valoresTareas', 'entregada');
    bindValInput('evalValTaskIncompleta', 'valoresTareas', 'incompleta');
    bindValInput('evalValTaskTarde', 'valoresTareas', 'tarde');
    bindValInput('evalValTaskNoEntregada', 'valoresTareas', 'noEntregada');

    bindValInput('evalValConductaExcelente', 'valoresConducta', 'excelente');
    bindValInput('evalValConductaAdecuada', 'valoresConducta', 'adecuada');
    bindValInput('evalValConductaApoyo', 'valoresConducta', 'requiereApoyo');

    bindValInput('evalValPartAlta', 'valoresParticipacion', 'alta');
    bindValInput('evalValPartMedia', 'valoresParticipacion', 'media');
    bindValInput('evalValPartNula', 'valoresParticipacion', 'nula');

    // Advertencia de navegación con cambios sin guardar
    window.addEventListener('beforeunload', e => {
      if (evalState.hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'Tienes cambios de configuración sin guardar en Evaluaciones Trimestrales.';
      }
    });

    _eventsBound = true;
  }

  /**
   * Marca que hay cambios pendientes de guardar
   */
  function markUnsavedChanges() {
    evalState.hasUnsavedChanges = true;
    const badge = document.getElementById('evalUnsavedNotice');
    if (badge) badge.style.display = 'inline-flex';
    const status = document.getElementById('evalPersistStatus');
    if (status) status.textContent = 'Borrador modificado localmente';
  }

  /**
   * Cambia de trimestre seleccionado en la barra superior
   * @param {number} trimesterNum 
   */
  function selectEvalTrimester(trimesterNum) {
    const num = Number(trimesterNum) || 1;
    if (!evalState.config.periodos[num]) return;

    evalState.trimester = num;
    renderTrimesterSelector();
    renderTrackingPanel();

    if (typeof toast === 'function') {
      toast(`Mostrando registros de ${evalState.config.periodos[num].nombre}.`);
    }
  }

  /**
   * Cambia de pestaña (Tab) interna dentro del módulo
   * @param {string} tabId 
   */
  function switchEvalTab(tabId) {
    const validTabs = ['seguimiento', 'captura-grupal', 'captura-individual', 'criterios'];
    const targetTab = validTabs.includes(tabId) ? tabId : 'seguimiento';

    // Si tiene cambios sin guardar y se cambia de tab, guardar borrador automático
    if (evalState.hasUnsavedChanges && evalState.activeTab === 'criterios' && targetTab !== 'criterios') {
      saveConfigDraftSilently();
    }

    evalState.activeTab = targetTab;

    // Actualizar botones de pestañas
    document.querySelectorAll('.eval-tab-btn').forEach(btn => {
      const isCurrent = btn.dataset.tab === targetTab;
      btn.classList.toggle('active', isCurrent);
      btn.setAttribute('aria-selected', isCurrent ? 'true' : 'false');
    });

    // Actualizar paneles de contenido
    const tabContents = {
      'seguimiento': document.getElementById('evalTabSeguimiento'),
      'captura-grupal': document.getElementById('evalTabCapturaGrupal'),
      'captura-individual': document.getElementById('evalTabCapturaIndividual'),
      'criterios': document.getElementById('evalTabCriterios')
    };

    Object.entries(tabContents).forEach(([tabKey, el]) => {
      if (!el) return;
      const isVisible = tabKey === targetTab;
      el.classList.toggle('active', isVisible);
      el.classList.toggle('hidden-tab', !isVisible);
    });

    if (targetTab === 'criterios') {
      renderConfigTab();
    } else if (targetTab === 'seguimiento') {
      renderTrackingPanel();
    }
  }

  /**
   * Renderiza el selector de trimestres en la cabecera del módulo
   */
  function renderTrimesterSelector() {
    const cfg = evalState.config;
    const currentActual = determineCurrentTrimester(cfg);
    const selectedTrim = cfg.periodos[evalState.trimester] || cfg.periodos[1];

    const titleEl = document.getElementById('evalCurrentPeriodTitle');
    const datesEl = document.getElementById('evalCurrentPeriodDates');
    const statusBadge = document.getElementById('evalPeriodStatusBadge');
    const officialBadge = document.getElementById('evalOfficialCurrentBadge');

    const statusLabels = {
      'in-progress': 'En curso',
      'review': 'En revisión',
      'completed': 'Finalizado',
      'pending': 'Pendiente'
    };

    if (titleEl) {
      const estadoTxt = statusLabels[selectedTrim.estado] || 'Pendiente';
      titleEl.textContent = `${selectedTrim.nombre} (${estadoTxt})`;
    }
    if (datesEl) {
      datesEl.textContent = `${selectedTrim.inicio} – ${selectedTrim.fin} · Cierre independiente de publicaciones`;
    }
    if (statusBadge) {
      statusBadge.className = `eval-status-pill status-${selectedTrim.estado}`;
      statusBadge.textContent = statusLabels[selectedTrim.estado] || 'Pendiente';
    }
    if (officialBadge) {
      const isActual = evalState.trimester === currentActual;
      officialBadge.style.display = isActual ? 'inline-block' : 'none';
      officialBadge.textContent = cfg.modoPeriodo === 'manual'
        ? 'Trimestre activo (Ajuste administrativo)'
        : 'Trimestre escolar actual';
    }

    // Actualizar los 3 botones de trimestre en la cabecera
    [1, 2, 3].forEach(t => {
      const btn = document.querySelector(`.eval-trimester-btn[data-trimester="${t}"]`);
      if (!btn) return;
      const p = cfg.periodos[t];
      const isActive = t === evalState.trimester;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');

      const nameEl = btn.querySelector('.eval-trim-name');
      const datesSpan = btn.querySelector('.eval-trim-dates');
      const statusSpan = btn.querySelector('.eval-trim-status');

      if (nameEl) nameEl.textContent = p.nombre;
      if (datesSpan) datesSpan.textContent = `${p.inicio.slice(5)} a ${p.fin.slice(5)}`;
      if (statusSpan) {
        statusSpan.className = `eval-trim-status status-${p.estado}`;
        statusSpan.textContent = statusLabels[p.estado] || 'Pendiente';
      }
    });
  }

  /**
   * Resuelve el número de lista oficial del alumno evitando índices artificiales
   * @param {Object} student 
   * @returns {number|string}
   */
  function resolveOfficialListNumber(student) {
    if (!student) return '—';
    // 1. Usar función institucional existente si está disponible
    if (typeof window.getStudentOfficialNumber === 'function') {
      const official = window.getStudentOfficialNumber(student);
      if (official !== null && official !== undefined && official > 0) return official;
    }
    // 2. Propiedad canónica en el alumno
    const raw = student.numeroLista ?? student.numero;
    if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
      const parsed = parseInt(String(raw).trim(), 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    // 3. Consulta en directorio si existe
    if (typeof state !== 'undefined' && state.directory && Array.isArray(state.directory.rows)) {
      const row = state.directory.rows.find(r => String(r.student?.id) === String(student.id));
      if (row?.student?.numeroLista) {
        const parsed = parseInt(String(row.student.numeroLista).trim(), 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    }
    return '—';
  }

  /**
   * Obtiene y ordena a los alumnos activos por su número oficial de lista
   */
  function getStudentsList() {
    const raw = (typeof state !== 'undefined' && Array.isArray(state.students)) ? state.students : [];
    const active = raw.filter(s => s.baja !== true && s.activo !== false);

    return active.slice().sort((a, b) => {
      const numA = resolveOfficialListNumber(a);
      const numB = resolveOfficialListNumber(b);

      if (typeof numA === 'number' && typeof numB === 'number') {
        return numA - numB;
      }
      if (typeof numA === 'number') return -1;
      if (typeof numB === 'number') return 1;

      const nameA = String(typeof fullName === 'function' ? fullName(a) : (a.nombreCompleto || a.nombres || '')).trim();
      const nameB = String(typeof fullName === 'function' ? fullName(b) : (b.nombreCompleto || b.nombres || '')).trim();
      return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
    });
  }

  /**
   * Renderiza el panel de seguimiento grupal
   */
  function renderTrackingPanel() {
    updateTrackingStats();
    renderTrackingTable();
  }

  /**
   * Calcula y actualiza las tarjetas de KPIs
   */
  function updateTrackingStats() {
    const students = getStudentsList();
    const total = students.length;

    let evaluados = 0;
    let pendientes = total;
    let incompletas = 0;
    let listas = 0;
    let publicadas = 0;

    const t = evalState.trimester;
    const ciclo = evalState.config.cicloEscolar;
    const grupo = evalState.config.grupo;

    students.forEach(s => {
      // Clave única oficial: ciclo_grupo_T{trimestre}_{alumnoId}
      const evalKey = `${ciclo}_${grupo}_T${t}_${s.id}`;
      const ev = evalState.evaluations[evalKey];
      if (ev) {
        if (ev.estado === 'publicada') {
          publicadas++;
          evaluados++;
          pendientes--;
        } else if (ev.estado === 'cerrada') {
          evaluados++;
          pendientes--;
        } else if (ev.estado === 'lista') {
          listas++;
          pendientes--;
        } else if (ev.estado === 'borrador') {
          incompletas++;
          pendientes--;
        }
      }
    });

    const pct = total > 0 ? Math.round((evaluados / total) * 100) : 0;

    const setTxt = (id, txt) => {
      const el = document.getElementById(id);
      if (el) el.textContent = txt;
    };

    setTxt('evalStatTotal', total);
    setTxt('evalStatEvaluados', evaluados);
    setTxt('evalStatEvaluadosPct', `${pct}% del grupo`);
    setTxt('evalStatPendientes', pendientes);
    setTxt('evalStatIncompletas', incompletas);
    setTxt('evalStatListas', listas);
    setTxt('evalStatPublicadas', publicadas);

    setTxt('evalProgressText', `${pct}%`);
    const progressFill = document.getElementById('evalProgressBarFill');
    if (progressFill) {
      progressFill.style.width = `${pct}%`;
    }
  }

  /**
   * Renderiza las filas de la tabla de seguimiento grupal
   */
  function renderTrackingTable() {
    const tbody = document.getElementById('evalStudentsTableBody');
    if (!tbody) return;

    const students = getStudentsList();
    const q = evalState.searchQuery;
    const filter = evalState.statusFilter;

    const t = evalState.trimester;
    const ciclo = evalState.config.cicloEscolar;
    const grupo = evalState.config.grupo;

    const filtered = students.filter(s => {
      const name = (typeof fullName === 'function' ? fullName(s) : (s.nombreCompleto || s.nombres || '')).toLowerCase();
      const num = String(resolveOfficialListNumber(s));
      if (q && !name.includes(q) && num !== q) return false;

      const evalKey = `${ciclo}_${grupo}_T${t}_${s.id}`;
      const ev = evalState.evaluations[evalKey];
      const status = ev ? ev.estado : 'pendiente';
      if (filter && status !== filter) return false;

      return true;
    });

    if (!filtered.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 32px; color: var(--muted);">
            ${students.length === 0 ? 'No hay alumnos registrados en el grupo.' : 'No se encontraron alumnos con los filtros seleccionados.'}
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(s => {
      const sName = typeof fullName === 'function' ? fullName(s) : (s.nombreCompleto || s.nombres || 'Alumno');
      const initials = (s.nombres ? s.nombres[0] : (sName[0] || 'A')).toUpperCase();
      const numLista = resolveOfficialListNumber(s);

      const evalKey = `${ciclo}_${grupo}_T${t}_${s.id}`;
      const ev = evalState.evaluations[evalKey] || {
        modalidad: 'Mixta',
        campos: { lenguajes: false, saberes: false, etica: false, humano: false },
        indicadores: 0,
        mensaje: false,
        estado: 'pendiente'
      };

      const statusMap = {
        'pendiente': { label: 'Pendiente', cls: 'status-pending' },
        'borrador': { label: 'En borrador', cls: 'status-review' },
        'lista': { label: 'Lista para cerrar', cls: 'status-in-progress' },
        'cerrada': { label: 'Cerrada', cls: 'status-completed' },
        'publicada': { label: 'Publicada', cls: 'status-published' }
      };

      const currentStatus = statusMap[ev.estado] || statusMap['pendiente'];

      return `
        <tr data-student-id="${s.id}">
          <td style="font-weight: 800; color: var(--navy);">${numLista}</td>
          <td>
            <div class="eval-student-cell">
              <span class="eval-student-avatar">${initials}</span>
              <div>
                <div class="eval-student-name">${typeof escapeHtml === 'function' ? escapeHtml(sName) : sName}</div>
                <div class="eval-student-id">${s.matricula || s.curp || (s.id ? `ID: ${s.id}` : '')}</div>
              </div>
            </div>
          </td>
          <td>
            <span class="badge" style="background: #f4f8fb; color: var(--navy); border: 1px solid var(--line); font-size: 11px;">
              ${ev.modalidad || 'Mixta'}
            </span>
          </td>
          <td>
            <div class="eval-fields-pills" title="L: Lenguajes · S: Saberes · E: Ética · H: De lo Humano">
              <span class="eval-field-pill ${ev.campos?.lenguajes ? 'completed' : ''}" title="Lenguajes">L</span>
              <span class="eval-field-pill ${ev.campos?.saberes ? 'completed' : ''}" title="Saberes y Pensamiento Científico">S</span>
              <span class="eval-field-pill ${ev.campos?.etica ? 'completed' : ''}" title="Ética, Naturaleza y Sociedades">E</span>
              <span class="eval-field-pill ${ev.campos?.humano ? 'completed' : ''}" title="De lo Humano y lo Comunitario">H</span>
            </div>
          </td>
          <td>
            <span class="eval-indicators-count ${ev.indicadores === 23 ? 'complete' : ''}" title="${ev.indicadores} de 23 indicadores evaluados">
              ${ev.indicadores} / 23
            </span>
          </td>
          <td>
            <span class="eval-msg-status ${ev.mensaje ? 'done' : ''}">
              ${ev.mensaje ? '✓ Redactado' : '— Pendiente'}
            </span>
          </td>
          <td>
            <span class="eval-status-pill ${currentStatus.cls}" style="font-size: 11px; padding: 3px 8px;">
              ${currentStatus.label}
            </span>
          </td>
          <td style="text-align: right;">
            <button class="btn small primary" data-action="eval-open-student" data-id="${s.id}" title="Evaluar alumno">
              Evaluar
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  // ==========================================================================
  // LÓGICA DE LA PESTAÑA CRITERIOS Y PERIODOS (ETAPA 2)
  // ==========================================================================

  /**
   * Renderiza el formulario completo de Criterios y Periodos
   */
  function renderConfigTab() {
    const cfg = evalState.config;

    // Apartado 1: Ciclo escolar y zona horaria
    const cicloInput = document.getElementById('evalCfgCiclo');
    if (cicloInput) cicloInput.value = cfg.cicloEscolar || '2026-2027';

    const tzDisplay = document.getElementById('evalTimezoneDisplay');
    if (tzDisplay) {
      tzDisplay.textContent = `Quintana Roo (${cfg.zonaHoraria || 'America/Cancun'}) · ${getTodayCancunDate()}`;
    }

    // Apartado 2: Periodos trimestrales
    const periodModeSelect = document.getElementById('evalPeriodModeSelect');
    if (periodModeSelect) periodModeSelect.value = cfg.modoPeriodo || 'auto';

    const overrideRow = document.getElementById('evalManualOverrideRow');
    if (overrideRow) overrideRow.style.display = cfg.modoPeriodo === 'manual' ? 'flex' : 'none';

    const manualChoiceSelect = document.getElementById('evalManualTrimesterChoice');
    if (manualChoiceSelect) manualChoiceSelect.value = String(cfg.ajusteManualTrimester || 1);

    const currentActual = determineCurrentTrimester(cfg);

    [1, 2, 3].forEach(t => {
      const p = cfg.periodos[t];
      if (!p) return;

      const card = document.getElementById(`evalPeriodCard${t}`);
      const startInput = document.getElementById(`evalDateStart${t}`);
      const endInput = document.getElementById(`evalDateEnd${t}`);
      const statusSelect = document.getElementById(`evalStatusSelect${t}`);
      const badge = document.getElementById(`evalCardBadge${t}`);

      if (startInput) startInput.value = p.inicio;
      if (endInput) endInput.value = p.fin;
      if (statusSelect) statusSelect.value = p.estado;

      if (card) {
        card.classList.toggle('is-current-active', t === currentActual);
      }
      if (badge) {
        badge.className = `eval-status-pill status-${p.estado}`;
        badge.textContent = p.estado === 'in-progress' ? 'En curso' : (p.estado === 'review' ? 'En revisión' : (p.estado === 'completed' ? 'Finalizado' : 'Pendiente'));
      }
    });

    validatePeriods();

    // Apartado 3: Criterios y porcentajes
    const criteriaTrimesterSelect = document.getElementById('evalCriteriaTrimesterSelect');
    if (criteriaTrimesterSelect) {
      criteriaTrimesterSelect.value = String(evalState.configTrimesterTab || 1);
    }
    renderCriteriaInputs();
    updateCriteriaSumDisplay();

    // Apartado 4: Valores de tareas
    const setVal = (id, v) => { const el = document.getElementById(id); if (el && v !== null && v !== undefined) el.value = v; };
    setVal('evalValTaskEntregada', cfg.valoresTareas?.entregada ?? 100);
    setVal('evalValTaskIncompleta', cfg.valoresTareas?.incompleta ?? 50);
    setVal('evalValTaskTarde', cfg.valoresTareas?.tarde ?? 80);
    setVal('evalValTaskNoEntregada', cfg.valoresTareas?.noEntregada ?? 0);

    // Apartado 5: Valores de conducta
    setVal('evalValConductaExcelente', cfg.valoresConducta?.excelente ?? 100);
    setVal('evalValConductaAdecuada', cfg.valoresConducta?.adecuada ?? 80);
    setVal('evalValConductaApoyo', cfg.valoresConducta?.requiereApoyo ?? 60);

    // Apartado 6: Valores de participación
    setVal('evalValPartAlta', cfg.valoresParticipacion?.alta ?? 100);
    setVal('evalValPartMedia', cfg.valoresParticipacion?.media ?? 75);
    setVal('evalValPartNula', cfg.valoresParticipacion?.nula ?? 0);
  }

  /**
   * Renderiza la lista de los 7 criterios para el trimestre seleccionado
   */
  function renderCriteriaInputs() {
    const container = document.getElementById('evalCriteriaListContainer');
    if (!container) return;

    const t = evalState.configTrimesterTab || 1;
    const currentPcts = evalState.config.porcentajes[t] || {};

    container.innerHTML = CRITERIOS_CATALOGO.map(crit => {
      const val = Number(currentPcts[crit.id] ?? crit.defaultPct);
      const isActive = val > 0;

      return `
        <div class="eval-criteria-row ${isActive ? 'is-active' : 'is-disabled'}" data-crit-id="${crit.id}">
          <div class="eval-criteria-info">
            <button type="button" class="eval-criteria-toggle-btn ${isActive ? 'checked' : ''}" 
                    data-action="eval-toggle-crit" data-crit="${crit.id}" 
                    title="${isActive ? 'Desactivar criterio (fijar en 0%)' : 'Activar criterio'}">
              ${isActive ? '✓' : ''}
            </button>
            <div>
              <div class="eval-criteria-name">${crit.nombre}</div>
              <div class="eval-criteria-desc">${crit.desc}</div>
            </div>
          </div>
          <div class="eval-criteria-input-box">
            <input type="number" min="0" max="100" step="1" 
                   class="input eval-pct-number-input" 
                   data-crit-input="${crit.id}" 
                   value="${val}">
            <span class="eval-pct-symbol">%</span>
          </div>
        </div>
      `;
    }).join('');

    // Escuchar cambios en los inputs numéricos de porcentajes
    container.querySelectorAll('[data-crit-input]').forEach(input => {
      input.addEventListener('input', e => {
        const critId = e.target.dataset.critInput;
        let numVal = Number(e.target.value);
        if (isNaN(numVal) || numVal < 0) numVal = 0;
        if (numVal > 100) numVal = 100;

        evalState.config.porcentajes[t][critId] = numVal;

        // Actualizar visual del row y checkbox
        const row = container.querySelector(`.eval-criteria-row[data-crit-id="${critId}"]`);
        const toggleBtn = container.querySelector(`.eval-criteria-toggle-btn[data-crit="${critId}"]`);
        const isAct = numVal > 0;

        row?.classList.toggle('is-active', isAct);
        row?.classList.toggle('is-disabled', !isAct);
        toggleBtn?.classList.toggle('checked', isAct);
        if (toggleBtn) toggleBtn.textContent = isAct ? '✓' : '';

        markUnsavedChanges();
        updateCriteriaSumDisplay();
      });
    });
  }

  /**
   * Alterna un criterio entre activado (porcentaje sugerido o previo) y desactivado (0%)
   * @param {string} critId 
   */
  function toggleCriteria(critId) {
    const t = evalState.configTrimesterTab || 1;
    const current = Number(evalState.config.porcentajes[t][critId] || 0);

    if (current > 0) {
      evalState.config.porcentajes[t][critId] = 0;
    } else {
      const def = CRITERIOS_CATALOGO.find(c => c.id === critId);
      evalState.config.porcentajes[t][critId] = def ? (def.defaultPct || 10) : 10;
    }

    markUnsavedChanges();
    renderCriteriaInputs();
    updateCriteriaSumDisplay();
  }

  /**
   * Calcula la suma de porcentajes en tiempo real y actualiza indicadores de validación
   * @returns {number} Suma de porcentajes
   */
  function updateCriteriaSumDisplay() {
    const t = evalState.configTrimesterTab || 1;
    const pcts = evalState.config.porcentajes[t] || {};
    const sum = Object.values(pcts).reduce((acc, v) => acc + (Number(v) || 0), 0);

    const badge = document.getElementById('evalSumBadge');
    const msg = document.getElementById('evalSumStatusMessage');
    const saveBtn = document.getElementById('evalBtnSaveConfig');

    const isValid = Math.abs(sum - 100) < 0.001;

    if (badge) {
      badge.textContent = `Total: ${sum}%`;
      badge.className = `eval-sum-badge ${isValid ? 'valid' : 'invalid'}`;
    }

    if (msg) {
      if (isValid) {
        msg.textContent = '✓ Configuración balanceada y lista para evaluar.';
        msg.style.color = '#1b7c4b';
      } else {
        const diff = 100 - sum;
        msg.textContent = diff > 0
          ? `⚠️ Falta asignar ${diff}% para completar el 100%.`
          : `⚠️ La suma supera el 100% por ${Math.abs(diff)}%. Debe ser exactamente 100%.`;
        msg.style.color = '#a32929';
      }
    }

    if (saveBtn) {
      // No permitir activar/guardar si la suma != 100%
      saveBtn.disabled = !isValid;
      saveBtn.title = isValid ? 'Guardar y aplicar esta configuración' : 'La suma de porcentajes debe ser exactamente 100%';
    }

    return sum;
  }

  /**
   * Valida fechas escolares: orden cronológico y ausencia de superposición
   */
  function validatePeriods() {
    const p1 = evalState.config.periodos[1];
    const p2 = evalState.config.periodos[2];
    const p3 = evalState.config.periodos[3];

    const alertBox = document.getElementById('evalDateValidationAlert');
    if (!alertBox) return true;

    // Validar inicio <= fin
    if (!p1.inicio || !p1.fin || !p2.inicio || !p2.fin || !p3.inicio || !p3.fin) {
      alertBox.className = 'eval-validation-alert danger';
      alertBox.textContent = '⚠️ Todas las fechas de inicio y finalización de los trimestres son obligatorias.';
      return false;
    }

    if (p1.inicio > p1.fin) {
      alertBox.className = 'eval-validation-alert danger';
      alertBox.textContent = '⚠️ En el 1.er Trimestre la fecha de inicio no puede ser posterior a la de finalización.';
      return false;
    }

    if (p2.inicio > p2.fin) {
      alertBox.className = 'eval-validation-alert danger';
      alertBox.textContent = '⚠️ En el 2.º Trimestre la fecha de inicio no puede ser posterior a la de finalización.';
      return false;
    }

    if (p3.inicio > p3.fin) {
      alertBox.className = 'eval-validation-alert danger';
      alertBox.textContent = '⚠️ En el 3.er Trimestre la fecha de inicio no puede ser posterior a la de finalización.';
      return false;
    }

    // Validar orden cronológico sin superposiciones
    if (p1.fin >= p2.inicio) {
      alertBox.className = 'eval-validation-alert danger';
      alertBox.textContent = `⚠️ Superposición detectada: El 1.er Trimestre finaliza el ${p1.fin} y el 2.º Trimestre inicia el ${p2.inicio}.`;
      return false;
    }

    if (p2.fin >= p3.inicio) {
      alertBox.className = 'eval-validation-alert danger';
      alertBox.textContent = `⚠️ Superposición detectada: El 2.º Trimestre finaliza el ${p2.fin} y el 3.er Trimestre inicia el ${p3.inicio}.`;
      return false;
    }

    alertBox.className = 'eval-validation-alert success';
    alertBox.textContent = '✓ Las fechas respetan el orden cronológico escolar y no presentan superposición de periodos.';
    return true;
  }

  /**
   * Guarda un borrador local silencioso sin alertas intrusivas
   */
  function saveConfigDraftSilently() {
    try {
      localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify(evalState.config));
    } catch (e) {
      console.warn('Error al guardar borrador silencioso:', e);
    }
  }

  /**
   * Guarda explícitamente el borrador de configuración
   */
  function saveConfigDraft() {
    try {
      localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify(evalState.config));
      const status = document.getElementById('evalPersistStatus');
      if (status) status.textContent = '✓ Borrador guardado localmente en este dispositivo';
      if (typeof toast === 'function') {
        toast('Borrador de configuración guardado en el dispositivo.');
      }
    } catch (e) {
      if (typeof toast === 'function') toast('Error al guardar el borrador.', true);
    }
  }

  /**
   * Valida, guarda y aplica la configuración en el almacenamiento principal
   */
  function saveConfig() {
    // 1. Validar fechas
    if (!validatePeriods()) {
      if (typeof toast === 'function') toast('Corrige las fechas antes de guardar.', true);
      return false;
    }

    // 2. Validar que los 3 trimestres sumen 100%
    for (let t = 1; t <= 3; t++) {
      const pcts = evalState.config.porcentajes[t] || {};
      const sum = Object.values(pcts).reduce((a, b) => a + (Number(b) || 0), 0);
      if (Math.abs(sum - 100) > 0.001) {
        if (typeof toast === 'function') {
          toast(`La suma de los porcentajes del Trimestre ${t} es ${sum}%. Debe ser exactamente 100%.`, true);
        }
        evalState.configTrimesterTab = t;
        const sel = document.getElementById('evalCriteriaTrimesterSelect');
        if (sel) sel.value = String(t);
        renderCriteriaInputs();
        updateCriteriaSumDisplay();
        return false;
      }
    }

    // 3. Persistir en almacenamiento
    try {
      evalState.config.updatedAt = new Date().toISOString();
      evalState.config.version = (evalState.config.version || 1) + 1;

      localStorage.setItem(STORAGE_KEYS.config, JSON.stringify(evalState.config));
      localStorage.removeItem(STORAGE_KEYS.draft);

      evalState.hasUnsavedChanges = false;

      const badge = document.getElementById('evalUnsavedNotice');
      if (badge) badge.style.display = 'none';

      const status = document.getElementById('evalPersistStatus');
      if (status) status.textContent = '✓ Configuración confirmada y guardada exitosamente';

      renderTrimesterSelector();
      renderTrackingPanel();

      if (typeof toast === 'function') {
        toast('✓ Configuración de periodos y criterios guardada correctamente.');
      }
      return true;
    } catch (err) {
      console.error('Error al guardar configuración:', err);
      if (typeof toast === 'function') {
        toast('No se pudo guardar la configuración.', true);
      }
      return false;
    }
  }

  /**
   * Restablece los cambios sin guardar recargando la configuración previa
   */
  function restoreSavedConfig() {
    evalState.config = loadConfig();
    evalState.hasUnsavedChanges = false;

    const badge = document.getElementById('evalUnsavedNotice');
    if (badge) badge.style.display = 'none';

    renderConfigTab();
    renderTrimesterSelector();

    if (typeof toast === 'function') {
      toast('Se descartaron los cambios y se restauró la última configuración guardada.');
    }
  }

  /**
   * Restablece la propuesta editable por defecto para los porcentajes del trimestre activo
   */
  function restoreDefaultCriteria() {
    const t = evalState.configTrimesterTab || 1;
    const def = createDefaultConfig().porcentajes[t];
    evalState.config.porcentajes[t] = Object.assign({}, def);
    markUnsavedChanges();
    renderCriteriaInputs();
    updateCriteriaSumDisplay();

    if (typeof toast === 'function') {
      toast(`Propuesta editable inicial restaurada para el Trimestre ${t}.`);
    }
  }

  /**
   * Copia los porcentajes del trimestre actual a los otros dos trimestres
   */
  function copyCriteriaToAll() {
    const sourceT = evalState.configTrimesterTab || 1;
    const sourcePcts = evalState.config.porcentajes[sourceT] || {};

    [1, 2, 3].forEach(t => {
      if (t !== sourceT) {
        evalState.config.porcentajes[t] = Object.assign({}, sourcePcts);
      }
    });

    markUnsavedChanges();
    if (typeof toast === 'function') {
      toast(`Porcentajes del Trimestre ${sourceT} copiados a los otros trimestres.`);
    }
  }

  // ==========================================================================
  // REGISTRO DESACOPLADO DE ACCIONES (REGLA 2 DE GEMINI.MD)
  // ==========================================================================
  window.actions = window.actions || {};
  Object.assign(window.actions, {
    'eval-select-trimester': btn => {
      const t = Number(btn?.dataset?.trimester || 1);
      selectEvalTrimester(t);
    },
    'eval-switch-tab': btn => {
      const tab = btn?.dataset?.tab;
      if (tab) switchEvalTab(tab);
    },
    'eval-refresh': () => {
      if (typeof toast === 'function') toast('Actualizando panel de seguimiento...');
      renderTrackingPanel();
    },
    'eval-save-draft': () => {
      saveConfigDraft();
    },
    'eval-open-student': btn => {
      const studentId = btn?.dataset?.id;
      const student = (getStudentsList() || []).find(s => String(s.id) === String(studentId));
      const sName = student ? (typeof fullName === 'function' ? fullName(student) : student.nombres) : 'el alumno';
      const num = student ? resolveOfficialListNumber(student) : '';
      if (typeof toast === 'function') {
        toast(`La captura detallada para ${sName} (No. ${num}) se habilitará en la Etapa 5.`);
      }
    },
    'open-evaluaciones-trimestrales': () => {
      if (typeof showView === 'function') {
        showView('evaluaciones-trimestrales');
      }
    },
    'eval-toggle-crit': btn => {
      const crit = btn?.dataset?.crit;
      if (crit) toggleCriteria(crit);
    },
    'eval-copy-criteria-to-all': () => copyCriteriaToAll(),
    'eval-restore-default-criteria': () => restoreDefaultCriteria(),
    'eval-restore-saved-config': () => restoreSavedConfig(),
    'eval-save-config-draft': () => saveConfigDraft(),
    'eval-save-config': () => saveConfig()
  });

  // Exportar funciones globales de la vista
  window.initEvaluacionesTrimestrales = initEvaluacionesTrimestrales;
  window.selectEvalTrimester = selectEvalTrimester;
  window.switchEvalTab = switchEvalTab;
  window.saveEvalConfig = saveConfig;
  window.saveEvalConfigDraft = saveConfigDraft;
  window.getEvalConfig = () => evalState.config;
  window.getEvalState = () => evalState;
  window.determineCurrentTrimester = determineCurrentTrimester;
  window.resolveOfficialListNumber = resolveOfficialListNumber;

  // Soporte nativo para eventos táctiles en dispositivos móviles y tabletas
  document.addEventListener('touchend', e => {
    const a = e.target?.closest?.('[data-action]');
    if (!a) return;
    const actionName = a.dataset.action;
    if (actionName && actionName.startsWith('eval-')) {
      const handler = window.actions?.[actionName];
      if (typeof handler === 'function') {
        try { handler(a); } catch (err) { console.error('Error táctil en:', actionName, err); }
      }
    }
  }, { passive: true });

  /**
   * Inicialización automática al cargar el DOM o cambiar a la vista
   */
  function setupAutoInit() {
    if (window.location.hash === '#evaluaciones-trimestrales') {
      setTimeout(initEvaluacionesTrimestrales, 100);
    }

    const targetSection = document.getElementById('evaluaciones-trimestrales');
    if (targetSection && window.MutationObserver) {
      const observer = new MutationObserver(mutations => {
        mutations.forEach(m => {
          if (m.type === 'attributes' && m.attributeName === 'class') {
            if (targetSection.classList.contains('active')) {
              initEvaluacionesTrimestrales();
            }
          }
        });
      });
      observer.observe(targetSection, { attributes: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupAutoInit);
  } else {
    setupAutoInit();
  }

})();
