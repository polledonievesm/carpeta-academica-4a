/* ==========================================================================
   MÓDULO DE VISTA: EVALUACIONES TRIMESTRALES
   ETAPA 1: Estructura, navegación modular y panel de seguimiento
   ETAPA 2: Almacenamiento, configuración de periodos, criterios y valores
   ETAPA 3: Recuperación y selección de registros académicos (actividades, conducta, participación, asistencia)
   ========================================================================== */

(function () {
  'use strict';

  // Claves para persistencia local y borradores (preparado para sincronizar con backend)
  const STORAGE_KEYS = {
    config: 'carpeta_eval_config_v2',
    draft: 'carpeta_eval_draft_v2',
    evals: 'carpeta_eval_records_v2',
    activitySelection: 'carpeta_eval_act_selection_v3',
    activityDraft: 'carpeta_eval_act_draft_v3'
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

  // Actividades académicas de pruebas (desactivadas) (utilizadas si aún no hay conexión con Sheets)
  const CANONICAL_ACTIVITIES_4A = [];

  // Estado local en memoria de la vista
  const evalState = {
    trimester: 1, // Trimestre actualmente seleccionado en la vista
    activeTab: 'seguimiento', // 'seguimiento' | 'seleccion-actividades' | 'captura-grupal' | 'captura-individual' | 'criterios'
    configTrimesterTab: 1, // Trimestre de trabajo en Criterios
    searchQuery: '',
    statusFilter: '',
    config: loadConfig(),
    hasUnsavedChanges: false,
    evaluations: loadEvaluationsStore(),

    // Estado específico de la Etapa 3 (Selección de actividades)
    activityFilters: {
      search: '',
      field: '',
      type: '',
      status: 'all' // 'all' | 'selected' | 'excluded'
    },
    activitySelections: loadActivitySelections(),
    hasUnsavedActivityChanges: false
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

  /**
   * Carga la selección de actividades guardada por trimestre
   */
  function loadActivitySelections() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.activitySelection);
      if (raw) return JSON.parse(raw) || {};
    } catch (e) {}
    return {};
  }

  /**
   * Obtiene la clave de identificación única para la selección del trimestre actual
   */
  function getTrimesterKey(trimester = evalState.trimester) {
    const ciclo = evalState.config?.cicloEscolar || '2026-2027';
    const grupo = evalState.config?.grupo || '4.° A';
    return `${ciclo}_${grupo}_T${trimester}`;
  }

  /**
   * Obtiene la estructura de selección para el trimestre actual
   */
  function getCurrentActivitySelection(trimester = evalState.trimester) {
    const key = getTrimesterKey(trimester);
    if (!evalState.activitySelections[key]) {
      // Inicializar seleccionando todas las actividades del trimestre con peso 1.0 por defecto
      const actsInPeriod = getRawActivities().classes.filter(a => isActivityInPeriod(a, trimester));
      evalState.activitySelections[key] = {
        weightMode: 'uniform', // 'uniform' | 'custom'
        selectedIds: actsInPeriod.map(a => String(a.id)),
        customWeights: {},
        updatedAt: new Date().toISOString()
      };
    }
    return evalState.activitySelections[key];
  }

  // Registrar título de vista en el diccionario global si existe
  if (typeof VIEW_TITLES !== 'undefined') {
    VIEW_TITLES['evaluaciones-trimestrales'] = 'Evaluaciones Trimestrales';
  }

  /**
   * Recupera todas las actividades y clases existentes evitando duplicados
   * @returns {{ classes: Array, evaluations: Array }}
   */
  function getRawActivities() {
    const gs = (typeof getGlobalState === 'function')
      ? getGlobalState()
      : (typeof state !== 'undefined' ? state : {});

    let classes = gs.classes || gs.activities || window.dailyState?.activities || [];
    let evaluations = gs.evaluations || [];

    // Si aún no hay clases en memoria desde Sheets, usar catálogo canónico de 4.° A
    if (!Array.isArray(classes) || classes.length === 0) {
      classes = CANONICAL_ACTIVITIES_4A;
    }

    // Desduplicar estrictamente por id único
    const seen = new Set();
    const uniqueClasses = [];
    classes.forEach(c => {
      const sId = String(c.id);
      if (!seen.has(sId)) {
        seen.add(sId);
        uniqueClasses.push(c);
      }
    });

    return { classes: uniqueClasses, evaluations: evaluations || [] };
  }

  /**
   * Comprueba si una actividad pertenece al rango de fechas del trimestre indicado
   */
  function isActivityInPeriod(act, trimester = evalState.trimester) {
    const p = evalState.config?.periodos?.[trimester];
    if (!p || !p.inicio || !p.fin || !act.fecha) return true;
    return act.fecha >= p.inicio && act.fecha <= p.fin;
  }

  /**
   * Resuelve el número de lista oficial del alumno evitando índices artificiales
   * @param {Object} student 
   * @returns {number|string}
   */
  function resolveOfficialListNumber(student) {
    if (!student) return '—';
    if (typeof window.getStudentOfficialNumber === 'function') {
      const official = window.getStudentOfficialNumber(student);
      if (official !== null && official !== undefined && official > 0) return official;
    }
    const raw = student.numeroLista ?? student.numero;
    if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
      const parsed = parseInt(String(raw).trim(), 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
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
   * Inicializa la vista principal de Evaluaciones Trimestrales
   */
  function initEvaluacionesTrimestrales() {
    const view = document.getElementById('evaluaciones-trimestrales');
    if (!view) return;

    const title = document.getElementById('currentViewTitle');
    if (title && view.classList.contains('active')) {
      title.textContent = 'Evaluaciones Trimestrales';
    }

    bindEventsOnce();

    const currentActual = determineCurrentTrimester();
    if (!evalState.trimester) {
      evalState.trimester = currentActual;
    }

    renderTrimesterSelector();
    renderTrackingPanel();
    renderActivitiesTab();
    renderConfigTab();
  }

  /**
   * Asignación de escuchadores de eventos
   */
  let _eventsBound = false;
  function bindEventsOnce() {
    if (_eventsBound) return;

    // Búsqueda y filtro de seguimiento de alumnos
    const searchInput = document.getElementById('evalStudentSearch');
    const statusSelect = document.getElementById('evalStatusFilter');

    searchInput?.addEventListener('input', e => {
      evalState.searchQuery = (e.target.value || '').trim().toLowerCase();
      renderTrackingTable();
    });

    statusSelect?.addEventListener('change', e => {
      evalState.statusFilter = e.target.value || '';
      renderTrackingTable();
    });

    // Filtros de Selección de Actividades
    const actSearch = document.getElementById('evalActivitySearch');
    const actField = document.getElementById('evalActivityFieldFilter');
    const actType = document.getElementById('evalActivityTypeFilter');
    const actStatus = document.getElementById('evalActivityStatusFilter');

    actSearch?.addEventListener('input', e => {
      evalState.activityFilters.search = (e.target.value || '').trim().toLowerCase();
      renderActivitiesTable();
    });

    actField?.addEventListener('change', e => {
      evalState.activityFilters.field = e.target.value || '';
      renderActivitiesTable();
    });

    actType?.addEventListener('change', e => {
      evalState.activityFilters.type = e.target.value || '';
      renderActivitiesTable();
    });

    actStatus?.addEventListener('change', e => {
      evalState.activityFilters.status = e.target.value || 'all';
      renderActivitiesTable();
    });

    // Checkbox seleccionar todos los visibles en tabla de actividades
    const selectAllVisibleCb = document.getElementById('evalSelectAllVisibleCheckbox');
    selectAllVisibleCb?.addEventListener('change', e => {
      toggleAllVisibleActivities(e.target.checked);
    });

    // Criterios y Periodos
    const criteriaTrimesterSelect = document.getElementById('evalCriteriaTrimesterSelect');
    criteriaTrimesterSelect?.addEventListener('change', e => {
      evalState.configTrimesterTab = Number(e.target.value) || 1;
      renderCriteriaInputs();
      updateCriteriaSumDisplay();
    });

    const periodModeSelect = document.getElementById('evalPeriodModeSelect');
    const manualChoiceSelect = document.getElementById('evalManualTrimesterChoice');
    periodModeSelect?.addEventListener('change', e => {
      const isManual = e.target.value === 'manual';
      const overrideRow = document.getElementById('evalManualOverrideRow');
      if (overrideRow) overrideRow.style.display = isManual ? 'flex' : 'none';
      evalState.config.modoPeriodo = isManual ? 'manual' : 'auto';
      markUnsavedChanges();
      validatePeriods();
    });

    manualChoiceSelect?.addEventListener('change', e => {
      evalState.config.ajusteManualTrimester = Number(e.target.value) || 1;
      markUnsavedChanges();
      renderTrimesterSelector();
    });

    // Escuchar fechas de periodos
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

    // Ciclo escolar
    const cicloInput = document.getElementById('evalCfgCiclo');
    cicloInput?.addEventListener('input', () => {
      evalState.config.cicloEscolar = cicloInput.value.trim();
      markUnsavedChanges();
    });

    // Valores de tareas, conducta y participación
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

    // Advertencia de navegación
    window.addEventListener('beforeunload', e => {
      if (evalState.hasUnsavedChanges || evalState.hasUnsavedActivityChanges) {
        e.preventDefault();
        e.returnValue = 'Tienes cambios sin guardar en Evaluaciones Trimestrales.';
      }
    });

    _eventsBound = true;
  }

  function markUnsavedChanges() {
    evalState.hasUnsavedChanges = true;
    const badge = document.getElementById('evalUnsavedNotice');
    if (badge) badge.style.display = 'inline-flex';
    const status = document.getElementById('evalPersistStatus');
    if (status) status.textContent = 'Borrador modificado localmente';
  }

  function markUnsavedActivityChanges() {
    evalState.hasUnsavedActivityChanges = true;
    const badge = document.getElementById('evalActUnsavedNotice');
    if (badge) badge.style.display = 'inline-flex';
    const status = document.getElementById('evalActPersistStatus');
    if (status) status.textContent = 'Selección modificada sin guardar';
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
    renderActivitiesTab();

    if (typeof toast === 'function') {
      toast(`Mostrando registros del ${evalState.config.periodos[num].nombre}.`);
    }
  }

  /**
   * Cambia de pestaña (Tab) interna dentro del módulo
   * @param {string} tabId 
   */
  function switchEvalTab(tabId) {
    const validTabs = ['seguimiento', 'seleccion-actividades', 'captura-grupal', 'captura-individual', 'criterios'];
    const targetTab = validTabs.includes(tabId) ? tabId : 'seguimiento';

    if (evalState.hasUnsavedChanges && evalState.activeTab === 'criterios' && targetTab !== 'criterios') {
      saveConfigDraftSilently();
    }
    if (evalState.hasUnsavedActivityChanges && evalState.activeTab === 'seleccion-actividades' && targetTab !== 'seleccion-actividades') {
      saveActivityDraftSilently();
    }

    evalState.activeTab = targetTab;

    document.querySelectorAll('.eval-tab-btn').forEach(btn => {
      const isCurrent = btn.dataset.tab === targetTab;
      btn.classList.toggle('active', isCurrent);
      btn.setAttribute('aria-selected', isCurrent ? 'true' : 'false');
    });

    const tabContents = {
      'seguimiento': document.getElementById('evalTabSeguimiento'),
      'seleccion-actividades': document.getElementById('evalTabSeleccionActividades'),
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

    if (targetTab === 'seleccion-actividades') {
      renderActivitiesTab();
    } else if (targetTab === 'criterios') {
      renderConfigTab();
    } else if (targetTab === 'seguimiento') {
      renderTrackingPanel();
    }
  }

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

  function renderTrackingPanel() {
    updateTrackingStats();
    renderTrackingTable();
  }

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
    if (progressFill) progressFill.style.width = `${pct}%`;
  }

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
  // ETAPA 3: GESTIÓN Y SELECCIÓN DE ACTIVIDADES
  // ==========================================================================

  /**
   * Renderiza el apartado completo de Selección de actividades
   */
  function renderActivitiesTab() {
    renderActivityStats();
    renderActivitiesTable();
    renderSecondaryRecords();
  }

  /**
   * Obtiene la lista filtrada de actividades para la tabla
   */
  function getFilteredActivities() {
    const raw = getRawActivities();
    const t = evalState.trimester;
    const sel = getCurrentActivitySelection(t);
    const f = evalState.activityFilters;

    return raw.classes.filter(a => {
      // 1. Filtrar por pertenencia al periodo del trimestre actual
      if (!isActivityInPeriod(a, t)) return false;

      // 2. Filtro de búsqueda por texto
      if (f.search) {
        const textToSearch = [
          a.actividad, a.materia, a.material, a.pdaTema, a.proyecto, a.tipoActividad
        ].filter(Boolean).join(' ').toLowerCase();
        if (!textToSearch.includes(f.search)) return false;
      }

      // 3. Filtro por campo formativo
      if (f.field && a.materia !== f.field) return false;

      // 4. Filtro por tipo de actividad
      if (f.type && a.tipoActividad !== f.type) return false;

      // 5. Filtro por estado de selección (all / selected / excluded)
      const isSelected = sel.selectedIds.includes(String(a.id));
      if (f.status === 'selected' && !isSelected) return false;
      if (f.status === 'excluded' && isSelected) return false;

      return true;
    });
  }

  /**
   * Actualiza las tarjetas superiores de resumen de actividades
   */
  function renderActivityStats() {
    const raw = getRawActivities();
    const t = evalState.trimester;
    const sel = getCurrentActivitySelection(t);
    const activitiesInPeriod = raw.classes.filter(a => isActivityInPeriod(a, t));

    const totalInPeriod = activitiesInPeriod.length;
    const selectedCount = activitiesInPeriod.filter(a => sel.selectedIds.includes(String(a.id))).length;
    const excludedCount = totalInPeriod - selectedCount;

    // Calcular actividades con entregas pendientes de resolución
    const evals = raw.evaluations;
    let pendingCount = 0;
    activitiesInPeriod.forEach(a => {
      const relatedEvals = evals.filter(ev => String(ev.claseId) === String(a.id));
      const hasPending = relatedEvals.some(ev => ev.trabajo === 'Pendiente' || ev.estadoEntrega === 'Pendiente');
      if (hasPending) pendingCount++;
    });

    const pct = totalInPeriod > 0 ? Math.round((selectedCount / totalInPeriod) * 100) : 0;

    const setTxt = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    setTxt('evalStatActTotal', totalInPeriod);
    setTxt('evalStatActSelected', selectedCount);
    setTxt('evalStatActSelectedPct', `${pct}% del catálogo`);
    setTxt('evalStatActExcluded', excludedCount);
    setTxt('evalStatActPending', pendingCount);

    const periodoLabel = document.getElementById('evalStatActPeriodoLabel');
    if (periodoLabel) {
      const p = evalState.config?.periodos?.[t];
      periodoLabel.textContent = p ? `${p.nombre}` : 'En el periodo escolar';
    }

    // Contadores de actividades seleccionadas por campo formativo
    const fieldsContainer = document.getElementById('evalFieldsSummaryBadges');
    if (fieldsContainer) {
      const fieldsMap = {
        'Lenguajes': 0,
        'Saberes y Pensamiento Científico': 0,
        'Ética, Naturaleza y Sociedades': 0,
        'De lo Humano y lo Comunitario': 0
      };

      activitiesInPeriod.forEach(a => {
        if (sel.selectedIds.includes(String(a.id))) {
          if (fieldsMap[a.materia] !== undefined) fieldsMap[a.materia]++;
          else fieldsMap['Lenguajes']++;
        }
      });

      fieldsContainer.innerHTML = Object.entries(fieldsMap).map(([fieldName, count]) => {
        const shortName = fieldName.split(' ')[0];
        return `
          <span class="eval-field-summary-pill" title="${fieldName}: ${count} seleccionadas">
            ${shortName}: <b>${count}</b>
          </span>
        `;
      }).join('');
    }

    // Actualizar botones de modo de ponderación
    const isUniform = (sel.weightMode || 'uniform') === 'uniform';
    document.getElementById('evalWeightModeUniformBtn')?.classList.toggle('primary', isUniform);
    document.getElementById('evalWeightModeCustomBtn')?.classList.toggle('primary', !isUniform);
  }

  /**
   * Renderiza la tabla de selección de actividades
   */
  function renderActivitiesTable() {
    const tbody = document.getElementById('evalActivitiesTableBody');
    if (!tbody) return;

    const filtered = getFilteredActivities();
    const t = evalState.trimester;
    const sel = getCurrentActivitySelection(t);
    const raw = getRawActivities();
    const students = getStudentsList();
    const totalStudents = students.length;
    const isUniform = (sel.weightMode || 'uniform') === 'uniform';

    if (!filtered.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 36px; color: var(--muted);">
            No se encontraron actividades que coincidan con los filtros en este periodo.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(act => {
      const actId = String(act.id);
      const isSelected = sel.selectedIds.includes(actId);
      const weightVal = sel.customWeights?.[actId] !== undefined ? sel.customWeights[actId] : 1.0;

      // Calcular cobertura de alumnos y registros pendientes en esta actividad
      const evals = raw.evaluations.filter(ev => String(ev.claseId) === actId);
      const deliveredCount = evals.filter(ev => ev.trabajo && ev.trabajo !== 'Pendiente' && ev.trabajo !== 'Sin registro').length;
      const pendingCount = evals.filter(ev => ev.trabajo === 'Pendiente' || ev.estadoEntrega === 'Pendiente').length;
      const absentCount = evals.filter(ev => ev.trabajo === 'Falta' || ev.ausente === true).length;
      const unrecordedCount = Math.max(0, totalStudents - deliveredCount - absentCount - pendingCount);

      return `
        <tr data-activity-id="${actId}" class="${isSelected ? 'activity-selected' : 'activity-excluded'}">
          <td style="text-align: center;">
            <input type="checkbox" class="eval-act-checkbox" 
                   data-action="eval-toggle-activity" data-id="${actId}" 
                   ${isSelected ? 'checked' : ''} 
                   title="${isSelected ? 'Deseleccionar actividad' : 'Seleccionar actividad'}">
          </td>
          <td style="font-size: 12px; color: var(--muted); white-space: nowrap;">
            ${act.fecha || '—'}
          </td>
          <td>
            <div class="eval-activity-title">${typeof escapeHtml === 'function' ? escapeHtml(act.actividad || act.nombre || 'Actividad') : (act.actividad || 'Actividad')}</div>
            <div class="eval-activity-meta">${act.pdaTema ? 'PDA: ' + escapeHtml(act.pdaTema) : (act.material ? 'Material: ' + escapeHtml(act.material) : 'ID: ' + actId)}</div>
          </td>
          <td>
            <span class="badge" style="font-size: 11px; background: #eef8f8; color: var(--teal);">
              ${act.materia || 'Lenguajes'}
            </span>
          </td>
          <td>
            <span class="badge" style="font-size: 11px; background: #f4f8fb; color: var(--navy); border: 1px solid var(--line);">
              ${act.tipoActividad || 'ACTIVIDAD'}
            </span>
          </td>
          <td style="font-size: 12px;">
            <span title="Entregadas / Con registro" style="color: #1b7c4b; font-weight: 700;">✓ ${deliveredCount}</span>
            <span class="muted" title="Sin registros previos"> · ${unrecordedCount} sin reg.</span>
          </td>
          <td>
            ${pendingCount > 0 
              ? `<span class="badge" style="background: #fff8e6; color: #a46d00; font-size: 11px;">⚠️ ${pendingCount} pendiente(s)</span>`
              : `<span class="muted" style="font-size: 12px;">✓ Resueltas</span>`
            }
          </td>
          <td style="text-align: center;">
            <input type="number" step="0.1" min="0.1" max="10" 
                   class="input eval-activity-weight-input" 
                   data-act-weight-id="${actId}" 
                   value="${weightVal}" 
                   ${isUniform ? 'disabled title="Modo uniforme activo (peso 1.0)"' : 'title="Ponderación individual"'}>
          </td>
          <td style="text-align: right;">
            <span class="eval-status-pill ${isSelected ? 'status-completed' : 'status-pending'}" style="font-size: 11px; padding: 2px 7px;">
              ${isSelected ? 'Seleccionada' : 'Excluida'}
            </span>
          </td>
        </tr>
      `;
    }).join('');

    // Escuchar cambios en los inputs de ponderación individual
    tbody.querySelectorAll('[data-act-weight-id]').forEach(input => {
      input.addEventListener('change', e => {
        const id = e.target.dataset.actWeightId;
        const val = Math.max(0.1, Math.min(10, Number(e.target.value) || 1.0));
        sel.customWeights[id] = val;
        markUnsavedActivityChanges();
      });
    });

    // Actualizar estado del checkbox principal de selección visible
    const selectAllCb = document.getElementById('evalSelectAllVisibleCheckbox');
    if (selectAllCb) {
      const allChecked = filtered.length > 0 && filtered.every(a => sel.selectedIds.includes(String(a.id)));
      selectAllCb.checked = allChecked;
    }
  }

  /**
   * Renderiza el resumen de los registros de Conducta, Participación y Asistencia del periodo
   */
  function renderSecondaryRecords() {
    const raw = getRawActivities();
    const t = evalState.trimester;
    const activitiesInPeriod = raw.classes.filter(a => isActivityInPeriod(a, t));
    const actIdsInPeriod = new Set(activitiesInPeriod.map(a => String(a.id)));
    const evalsInPeriod = raw.evaluations.filter(ev => actIdsInPeriod.has(String(ev.claseId)));

    // 1. Conducta
    let conductExcelente = 0;
    let conductAdecuada = 0;
    let conductApoyo = 0;

    evalsInPeriod.forEach(ev => {
      const c = String(ev.conducta || '').toLowerCase();
      if (c.includes('excelente')) conductExcelente++;
      else if (c.includes('adecuada') || c.includes('buena')) conductAdecuada++;
      else if (c.includes('apoyo') || c.includes('regular')) conductApoyo++;
    });

    const totalConduct = conductExcelente + conductAdecuada + conductApoyo;
    const conductBadge = document.getElementById('evalConductCountBadge');
    if (conductBadge) conductBadge.textContent = `${totalConduct} registros`;

    const conductContainer = document.getElementById('evalConductSummary');
    if (conductContainer) {
      conductContainer.innerHTML = `
        <div class="eval-record-stat-box"><span style="color:#1b7c4b;">Excelente</span><b>${conductExcelente}</b></div>
        <div class="eval-record-stat-box"><span style="color:#0d649d;">Adecuada</span><b>${conductAdecuada}</b></div>
        <div class="eval-record-stat-box"><span style="color:#a46d00;">Req. Apoyo</span><b>${conductApoyo}</b></div>
      `;
    }

    // 2. Participación
    let partAlta = 0;
    let partMedia = 0;
    let partNula = 0;

    evalsInPeriod.forEach(ev => {
      const p = String(ev.participacion || '').toLowerCase();
      if (p.includes('alta')) partAlta++;
      else if (p.includes('media')) partMedia++;
      else if (p.includes('nula')) partNula++;
    });

    const totalPart = partAlta + partMedia + partNula;
    const partBadge = document.getElementById('evalPartCountBadge');
    if (partBadge) partBadge.textContent = `${totalPart} registros`;

    const partContainer = document.getElementById('evalPartSummary');
    if (partContainer) {
      partContainer.innerHTML = `
        <div class="eval-record-stat-box"><span style="color:#1b7c4b;">Alta</span><b>${partAlta}</b></div>
        <div class="eval-record-stat-box"><span style="color:#0d649d;">Media</span><b>${partMedia}</b></div>
        <div class="eval-record-stat-box"><span style="color:#a32929;">Nula</span><b>${partNula}</b></div>
      `;
    }

    // 3. Asistencia y puntualidad
    const cfg = evalState.config;
    const pctAsistencia = cfg?.porcentajes?.[t]?.asistencia || 0;
    const pctPuntualidad = cfg?.porcentajes?.[t]?.puntualidad || 0;
    const isAttendanceActive = pctAsistencia > 0 || pctPuntualidad > 0;

    const attNotice = document.getElementById('evalAttendanceWeightNotice');
    if (attNotice) {
      attNotice.textContent = isAttendanceActive 
        ? `Asistencia: ${pctAsistencia}% · Puntualidad: ${pctPuntualidad}%`
        : '0% asignado (Inactivo)';
      attNotice.style.background = isAttendanceActive ? '#eaf8f0' : '#f4f8fb';
      attNotice.style.color = isAttendanceActive ? '#1b7c4b' : 'var(--muted)';
    }

    const attContainer = document.getElementById('evalAttendanceSummary');
    if (attContainer) {
      attContainer.innerHTML = isAttendanceActive
        ? `
          <div class="eval-record-stat-box"><span>Criterio activo</span><b>${pctAsistencia + pctPuntualidad}%</b></div>
          <div class="eval-record-stat-box"><span>Modo</span><b style="font-size:12px; margin-top:6px;">Pase de lista</b></div>
        `
        : `
          <div class="eval-record-stat-box" style="flex: 2; text-align: left; padding: 10px 14px;">
            <span style="font-size: 11px; text-transform: none; color: var(--muted);">
              Asistencia y puntualidad no están activas en los porcentajes de este trimestre. No influirán en la calificación académica.
            </span>
          </div>
        `;
    }
  }

  /**
   * Alterna la selección de una actividad individual
   */
  function toggleActivitySelection(actId) {
    const t = evalState.trimester;
    const sel = getCurrentActivitySelection(t);
    const sId = String(actId);

    const idx = sel.selectedIds.indexOf(sId);
    if (idx >= 0) {
      sel.selectedIds.splice(idx, 1);
    } else {
      sel.selectedIds.push(sId);
    }

    markUnsavedActivityChanges();
    renderActivityStats();
    renderActivitiesTable();
  }

  /**
   * Selecciona o deselecciona todas las actividades actualmente visibles por filtro
   */
  function toggleAllVisibleActivities(selectAll) {
    const filtered = getFilteredActivities();
    const t = evalState.trimester;
    const sel = getCurrentActivitySelection(t);

    filtered.forEach(act => {
      const sId = String(act.id);
      const idx = sel.selectedIds.indexOf(sId);
      if (selectAll && idx < 0) {
        sel.selectedIds.push(sId);
      } else if (!selectAll && idx >= 0) {
        sel.selectedIds.splice(idx, 1);
      }
    });

    markUnsavedActivityChanges();
    renderActivityStats();
    renderActivitiesTable();
  }

  /**
   * Establece el modo de ponderación (uniforme vs personalizado)
   */
  function setActivityWeightMode(mode) {
    const t = evalState.trimester;
    const sel = getCurrentActivitySelection(t);
    sel.weightMode = mode === 'custom' ? 'custom' : 'uniform';

    markUnsavedActivityChanges();
    renderActivityStats();
    renderActivitiesTable();

    if (typeof toast === 'function') {
      toast(sel.weightMode === 'custom' ? 'Modo de ponderación personalizada activado.' : 'Modo de valor uniforme activado.');
    }
  }

  /**
   * Restablece todas las ponderaciones de actividades a 1.0
   */
  function resetActivityWeights() {
    const t = evalState.trimester;
    const sel = getCurrentActivitySelection(t);
    sel.customWeights = {};
    sel.weightMode = 'uniform';

    markUnsavedActivityChanges();
    renderActivityStats();
    renderActivitiesTable();

    if (typeof toast === 'function') {
      toast('Ponderaciones de actividades restablecidas a valor uniforme.');
    }
  }

  /**
   * Guarda silenciosamente el borrador de actividades
   */
  function saveActivityDraftSilently() {
    try {
      localStorage.setItem(STORAGE_KEYS.activityDraft, JSON.stringify(evalState.activitySelections));
    } catch (e) {}
  }

  /**
   * Guarda explícitamente el borrador de selección de actividades
   */
  function saveActivityDraft() {
    try {
      localStorage.setItem(STORAGE_KEYS.activityDraft, JSON.stringify(evalState.activitySelections));
      const status = document.getElementById('evalActPersistStatus');
      if (status) status.textContent = '✓ Borrador de selección guardado en este dispositivo';
      if (typeof toast === 'function') {
        toast('Borrador de selección guardado localmente.');
      }
    } catch (e) {
      if (typeof toast === 'function') toast('Error al guardar el borrador.', true);
    }
  }

  /**
   * Guarda y confirma la selección de actividades para el trimestre
   */
  function saveActivitySelection() {
    try {
      const t = evalState.trimester;
      const key = getTrimesterKey(t);
      const sel = getCurrentActivitySelection(t);
      sel.updatedAt = new Date().toISOString();

      localStorage.setItem(STORAGE_KEYS.activitySelection, JSON.stringify(evalState.activitySelections));
      localStorage.removeItem(STORAGE_KEYS.activityDraft);

      evalState.hasUnsavedActivityChanges = false;

      const badge = document.getElementById('evalActUnsavedNotice');
      if (badge) badge.style.display = 'none';

      const status = document.getElementById('evalActPersistStatus');
      if (status) status.textContent = `✓ Selección confirmada para el Trimestre ${t}`;

      renderActivityStats();
      renderActivitiesTable();

      if (typeof toast === 'function') {
        toast(`✓ Selección de actividades confirmada para el Trimestre ${t}.`);
      }
      return true;
    } catch (err) {
      console.error('Error al guardar selección de actividades:', err);
      if (typeof toast === 'function') toast('No se pudo guardar la selección.', true);
      return false;
    }
  }

  /**
   * Restablece la selección de actividades guardada previamente
   */
  function restoreSavedActivities() {
    evalState.activitySelections = loadActivitySelections();
    evalState.hasUnsavedActivityChanges = false;

    const badge = document.getElementById('evalActUnsavedNotice');
    if (badge) badge.style.display = 'none';

    renderActivityStats();
    renderActivitiesTable();

    if (typeof toast === 'function') {
      toast('Se descartaron los cambios y se restauró la última selección confirmada.');
    }
  }

  // ==========================================================================
  // LÓGICA DE LA PESTAÑA CRITERIOS Y PERIODOS (ETAPA 2)
  // ==========================================================================

  function renderConfigTab() {
    const cfg = evalState.config;

    const cicloInput = document.getElementById('evalCfgCiclo');
    if (cicloInput) cicloInput.value = cfg.cicloEscolar || '2026-2027';

    const tzDisplay = document.getElementById('evalTimezoneDisplay');
    if (tzDisplay) {
      tzDisplay.textContent = `Quintana Roo (${cfg.zonaHoraria || 'America/Cancun'}) · ${getTodayCancunDate()}`;
    }

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

    const criteriaTrimesterSelect = document.getElementById('evalCriteriaTrimesterSelect');
    if (criteriaTrimesterSelect) {
      criteriaTrimesterSelect.value = String(evalState.configTrimesterTab || 1);
    }
    renderCriteriaInputs();
    updateCriteriaSumDisplay();

    const setVal = (id, v) => { const el = document.getElementById(id); if (el && v !== null && v !== undefined) el.value = v; };
    setVal('evalValTaskEntregada', cfg.valoresTareas?.entregada ?? 100);
    setVal('evalValTaskIncompleta', cfg.valoresTareas?.incompleta ?? 50);
    setVal('evalValTaskTarde', cfg.valoresTareas?.tarde ?? 80);
    setVal('evalValTaskNoEntregada', cfg.valoresTareas?.noEntregada ?? 0);

    setVal('evalValConductaExcelente', cfg.valoresConducta?.excelente ?? 100);
    setVal('evalValConductaAdecuada', cfg.valoresConducta?.adecuada ?? 80);
    setVal('evalValConductaApoyo', cfg.valoresConducta?.requiereApoyo ?? 60);

    setVal('evalValPartAlta', cfg.valoresParticipacion?.alta ?? 100);
    setVal('evalValPartMedia', cfg.valoresParticipacion?.media ?? 75);
    setVal('evalValPartNula', cfg.valoresParticipacion?.nula ?? 0);
  }

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

    container.querySelectorAll('[data-crit-input]').forEach(input => {
      input.addEventListener('input', e => {
        const critId = e.target.dataset.critInput;
        let numVal = Number(e.target.value);
        if (isNaN(numVal) || numVal < 0) numVal = 0;
        if (numVal > 100) numVal = 100;

        evalState.config.porcentajes[t][critId] = numVal;

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
      saveBtn.disabled = !isValid;
      saveBtn.title = isValid ? 'Guardar y aplicar esta configuración' : 'La suma de porcentajes debe ser exactamente 100%';
    }

    return sum;
  }

  function validatePeriods() {
    const p1 = evalState.config.periodos[1];
    const p2 = evalState.config.periodos[2];
    const p3 = evalState.config.periodos[3];

    const alertBox = document.getElementById('evalDateValidationAlert');
    if (!alertBox) return true;

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

  function saveConfigDraftSilently() {
    try {
      localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify(evalState.config));
    } catch (e) {}
  }

  function saveConfigDraft() {
    try {
      localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify(evalState.config));
      const status = document.getElementById('evalPersistStatus');
      if (status) status.textContent = '✓ Borrador guardado localmente en este dispositivo';
      if (typeof toast === 'function') toast('Borrador de configuración guardado en el dispositivo.');
    } catch (e) {
      if (typeof toast === 'function') toast('Error al guardar el borrador.', true);
    }
  }

  function saveConfig() {
    if (!validatePeriods()) {
      if (typeof toast === 'function') toast('Corrige las fechas antes de guardar.', true);
      return false;
    }

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
      renderSecondaryRecords();

      if (typeof toast === 'function') {
        toast('✓ Configuración de periodos y criterios guardada correctamente.');
      }
      return true;
    } catch (err) {
      console.error('Error al guardar configuración:', err);
      if (typeof toast === 'function') toast('No se pudo guardar la configuración.', true);
      return false;
    }
  }

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
      if (typeof toast === 'function') toast('Actualizando datos académicos...');
      renderTrackingPanel();
      renderActivitiesTab();
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
    'eval-save-config': () => saveConfig(),

    // Acciones de Selección de Actividades (Etapa 3)
    'eval-toggle-activity': inputOrBtn => {
      const actId = inputOrBtn?.dataset?.id;
      if (actId) toggleActivitySelection(actId);
    },
    'eval-toggle-all-visible': input => {
      toggleAllVisibleActivities(Boolean(input?.checked));
    },
    'eval-select-all-visible': () => {
      toggleAllVisibleActivities(true);
      if (typeof toast === 'function') toast('Actividades visibles seleccionadas.');
    },
    'eval-deselect-all-visible': () => {
      toggleAllVisibleActivities(false);
      if (typeof toast === 'function') toast('Actividades visibles excluidas.');
    },
    'eval-set-weight-mode': btn => {
      const mode = btn?.dataset?.mode;
      if (mode) setActivityWeightMode(mode);
    },
    'eval-reset-activity-weights': () => resetActivityWeights(),
    'eval-save-activities-draft': () => saveActivityDraft(),
    'eval-save-activities-selection': () => saveActivitySelection(),
    'eval-restore-saved-activities': () => restoreSavedActivities()
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
  window.getEvalRawActivities = getRawActivities;
  window.getCurrentActivitySelection = getCurrentActivitySelection;
  window.saveEvalActivitySelection = saveActivitySelection;
  window.toggleActivitySelection = toggleActivitySelection;
  window.toggleAllVisibleActivities = toggleAllVisibleActivities;
  window.setActivityWeightMode = setActivityWeightMode;

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
