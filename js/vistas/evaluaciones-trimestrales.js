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
    activityDraft: 'carpeta_eval_act_draft_v3',
    adjustments: 'carpeta_eval_adjustments_v4',
    captura: 'carpeta_eval_captura_v5',
    desempeno: 'carpeta_eval_desempeno_v6',
    mensajes: 'carpeta_eval_mensajes_v6',
    bancoMensajes: 'carpeta_eval_banco_mensajes_v6',
    syncMetadata: 'carpeta_eval_sync_meta_v7'
  };

  // =========================================================================
  // CATÁLOGOS INSTITUCIONALES DE DESEMPEÑO INTEGRAL Y MENSAJES (ETAPA 6)
  // =========================================================================

  const CATEGORIAS_DESEMPENO = [
    { id: 'academico', nombre: 'Desempeño académico', icono: '📚', total: 4 },
    { id: 'habitos', nombre: 'Hábitos y responsabilidad escolar', icono: '📝', total: 9 },
    { id: 'conducta', nombre: 'Conducta y convivencia', icono: '🤝', total: 8 },
    { id: 'asistencia', nombre: 'Asistencia y puntualidad', icono: '⏰', total: 2 }
  ];

  const INDICADORES_DESEMPENO = [
    // Desempeño académico — 4 indicadores
    { id: 'acad_lectura', numero: 1, nombre: 'Lectura y comprensión', categoria: 'academico', categoriaNombre: 'Desempeño académico' },
    { id: 'acad_escritura', numero: 2, nombre: 'Escritura y ortografía', categoria: 'academico', categoriaNombre: 'Desempeño académico' },
    { id: 'acad_matematicas', numero: 3, nombre: 'Habilidades matemáticas', categoria: 'academico', categoriaNombre: 'Desempeño académico' },
    { id: 'acad_contenidos', numero: 4, nombre: 'Comprensión de contenidos', categoria: 'academico', categoriaNombre: 'Desempeño académico' },

    // Hábitos y responsabilidad escolar — 9 indicadores
    { id: 'hab_tareas', numero: 5, nombre: 'Cumplimiento de tareas', categoria: 'habitos', categoriaNombre: 'Hábitos y responsabilidad escolar' },
    { id: 'hab_actividades', numero: 6, nombre: 'Finalización de actividades', categoria: 'habitos', categoriaNombre: 'Hábitos y responsabilidad escolar' },
    { id: 'hab_completos', numero: 7, nombre: 'Entrega de trabajos completos', categoria: 'habitos', categoriaNombre: 'Hábitos y responsabilidad escolar' },
    { id: 'hab_materiales', numero: 8, nombre: 'Materiales escolares completos', categoria: 'habitos', categoriaNombre: 'Hábitos y responsabilidad escolar' },
    { id: 'hab_limpieza', numero: 9, nombre: 'Limpieza y presentación de trabajos', categoria: 'habitos', categoriaNombre: 'Hábitos y responsabilidad escolar' },
    { id: 'hab_indicaciones', numero: 10, nombre: 'Seguimiento de indicaciones', categoria: 'habitos', categoriaNombre: 'Hábitos y responsabilidad escolar' },
    { id: 'hab_autonomia', numero: 11, nombre: 'Organización y autonomía', categoria: 'habitos', categoriaNombre: 'Hábitos y responsabilidad escolar' },
    { id: 'hab_concentracion', numero: 12, nombre: 'Atención y concentración', categoria: 'habitos', categoriaNombre: 'Hábitos y responsabilidad escolar' },
    { id: 'hab_participacion', numero: 13, nombre: 'Participación activa', categoria: 'habitos', categoriaNombre: 'Hábitos y responsabilidad escolar' },

    // Conducta y convivencia — 8 indicadores
    { id: 'cond_companeros', numero: 14, nombre: 'Respeto a sus compañeros', categoria: 'conducta', categoriaNombre: 'Conducta y convivencia' },
    { id: 'cond_docente', numero: 15, nombre: 'Respeto al docente', categoria: 'conducta', categoriaNombre: 'Conducta y convivencia' },
    { id: 'cond_acuerdos', numero: 16, nombre: 'Cumplimiento de acuerdos', categoria: 'conducta', categoriaNombre: 'Conducta y convivencia' },
    { id: 'cond_autorregulacion', numero: 17, nombre: 'Autorregulación emocional y conductual', categoria: 'conducta', categoriaNombre: 'Conducta y convivencia' },
    { id: 'cond_conflictos', numero: 18, nombre: 'Resolución pacífica de conflictos', categoria: 'conducta', categoriaNombre: 'Conducta y convivencia' },
    { id: 'cond_colaborativo', numero: 19, nombre: 'Trabajo colaborativo', categoria: 'conducta', categoriaNombre: 'Conducta y convivencia' },
    { id: 'cond_actitud', numero: 20, nombre: 'Actitud y disposición para aprender', categoria: 'conducta', categoriaNombre: 'Conducta y convivencia' },
    { id: 'cond_mobiliario', numero: 21, nombre: 'Cuidado del mobiliario escolar', categoria: 'conducta', categoriaNombre: 'Conducta y convivencia' },

    // Asistencia y puntualidad — 2 indicadores
    { id: 'asis_regular', numero: 22, nombre: 'Asistencia regular', categoria: 'asistencia', categoriaNombre: 'Asistencia y puntualidad' },
    { id: 'asis_puntualidad', numero: 23, nombre: 'Puntualidad', categoria: 'asistencia', categoriaNombre: 'Asistencia y puntualidad' }
  ];

  const NIVELES_DESEMPENO = {
    E: { code: 'E', label: 'Excelente', color: '#1b7c4b', bg: '#e8f5e9', border: '#a5d6a7', badgeClass: 'eval-pill-e' },
    B: { code: 'B', label: 'Bueno', color: '#b45309', bg: '#fef3c7', border: '#fcd34d', badgeClass: 'eval-pill-b' },
    R: { code: 'R', label: 'Regular', color: '#c2410c', bg: '#ffedd5', border: '#fed7aa', badgeClass: 'eval-pill-r' },
    A: { code: 'A', label: 'Requiere apoyo', color: '#dc2626', bg: '#fee2e2', border: '#fca5a5', badgeClass: 'eval-pill-a' }
  };

  const BANCO_MENSAJES_DEFAULT = [
    { id: 'rec_gen_e', category: 'general', level: 'E', text: 'Demuestra un desempeño integral sobresaliente, gran compromiso con su aprendizaje y una actitud colaborativa ejemplar. ¡Felicidades!', approved: false, status: 'propuesta', active: true },
    { id: 'rec_gen_b', category: 'general', level: 'B', text: 'Muestra un buen aprovechamiento académico y responsabilidad constante. Con mayor constancia en sus hábitos alcanzará la excelencia.', approved: false, status: 'propuesta', active: true },
    { id: 'rec_gen_r', category: 'general', level: 'R', text: 'Presenta avances en sus aprendizajes, aunque requiere mayor concentración y seguimiento de hábitos escolares para consolidar sus metas.', approved: false, status: 'propuesta', active: true },
    { id: 'rec_gen_a', category: 'general', level: 'A', text: 'Requiere apoyo constante en el hogar para reforzar contenidos básicos, entrega puntual de actividades y atención en el aula escolar.', approved: false, status: 'propuesta', active: true },

    { id: 'rec_acad_e', category: 'formativo', level: 'E', text: 'Excelente comprensión lectora y razonamiento lógico-matemático. Expresa sus ideas con claridad y fundamenta adecuadamente su trabajo.', approved: false, status: 'propuesta', active: true },
    { id: 'rec_acad_b', category: 'formativo', level: 'B', text: 'Buen desempeño en las actividades académicas. Se sugiere reforzar la ortografía y la práctica diaria de lectura comprensiva en casa.', approved: false, status: 'propuesta', active: true },
    { id: 'rec_acad_r', category: 'formativo', level: 'R', text: 'Avanza a su propio ritmo en los contenidos escolares; es importante repasar operaciones matemáticas básicas y lectura en el hogar.', approved: false, status: 'propuesta', active: true },
    { id: 'rec_acad_a', category: 'formativo', level: 'A', text: 'Se requiere acompañamiento diario en lectura, escritura y cálculo matemático para alcanzar los aprendizajes esperados del grado escolar.', approved: false, status: 'propuesta', active: true },

    { id: 'rec_hab_e', category: 'habitos', level: 'E', text: 'Sus hábitos de estudio, puntualidad en tareas y esmero en la presentación de sus trabajos escolares son sumamente destacados. ¡Bravo!', approved: false, status: 'propuesta', active: true },
    { id: 'rec_hab_b', category: 'habitos', level: 'B', text: 'Cumple habitualmente con sus materiales y tareas escolares. Mantener el orden y la constancia fortalecerá aún más su autonomía escolar.', approved: false, status: 'propuesta', active: true },
    { id: 'rec_hab_r', category: 'habitos', level: 'R', text: 'Es fundamental supervisar diariamente la entrega de tareas completas y la organización de sus útiles escolares antes de salir a la escuela.', approved: false, status: 'propuesta', active: true },
    { id: 'rec_hab_a', category: 'habitos', level: 'A', text: 'Requiere apoyo prioritario en la entrega oportuna de tareas, cuidado de sus materiales escolares y seguimiento de indicaciones diarias.', approved: false, status: 'propuesta', active: true },

    { id: 'rec_cond_e', category: 'conducta', level: 'E', text: 'Excelente conducta, empatía y trato respetuoso hacia sus compañeros y docente. Contribuye activamente a una sana convivencia en el aula.', approved: false, status: 'propuesta', active: true },
    { id: 'rec_cond_b', category: 'conducta', level: 'B', text: 'Mantiene una convivencia pacífica y respetuosa en el aula. Continúa fomentando la resolución dialogada de desacuerdos cotidianos.', approved: false, status: 'propuesta', active: true },
    { id: 'rec_cond_r', category: 'conducta', level: 'R', text: 'Debe trabajar en la autorregulación de sus emociones e impulsos para convivir en armonía y respetar los acuerdos de convivencia escolar.', approved: false, status: 'propuesta', active: true },
    { id: 'rec_cond_a', category: 'conducta', level: 'A', text: 'Se requiere diálogo constante en familia sobre el respeto a las reglas del aula, escucha atenta y resolución pacífica de conflictos.', approved: false, status: 'propuesta', active: true },

    { id: 'rec_asis_e', category: 'asistencia', level: 'E', text: 'Asistencia perfecta y puntualidad intachable durante todo el trimestre. Su presencia continua favorece ampliamente su progreso escolar.', approved: false, status: 'propuesta', active: true },
    { id: 'rec_asis_b', category: 'asistencia', level: 'B', text: 'Asistencia regular y puntual. Continuar procurando no faltar a clases para no perder la secuencia didáctica de los proyectos escolares.', approved: false, status: 'propuesta', active: true },
    { id: 'rec_asis_r', category: 'asistencia', level: 'R', text: 'Registra retardos o ausencias intermitentes. Es necesario mejorar la puntualidad al inicio de la jornada escolar matutina.', approved: false, status: 'propuesta', active: true },
    { id: 'rec_asis_a', category: 'asistencia', level: 'A', text: 'Las inasistencias reiteradas afectan notablemente su ritmo de aprendizaje. Se exhorta a garantizar su asistencia diaria a la escuela.', approved: false, status: 'propuesta', active: true }
  ];

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

  // Padrón escolar de pruebas (desactivado) (utilizada cuando aún no hay conexión remota)
  const CANONICAL_STUDENTS_4A = [];

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
      status: 'all', // 'all' | 'selected' | 'excluded'
      dateStart: '',
      dateEnd: ''
    },
    activitySelections: loadActivitySelections(),
    hasUnsavedActivityChanges: false,

    // Estado específico de la Etapa 4 (Motor de cálculo y vista preliminar)
    selectedStudentId: null,
    selectedSubject: 'Lenguajes',
    calcMode: 'mixta',
    manualAdjustments: loadManualAdjustments(),

    // Estado específico de la Etapa 5 (Captura individual y grupal)
    grupalSubview: 'examenes', // 'examenes' | 'criterios' | 'resumen'
    grupalSearch: '',
    grupalStatusFilter: 'all', // 'all' | 'pending' | 'calculated' | 'authorized' | 'adjusted'
    grupalSubject: 'Lenguajes',
    grupalMode: 'mixta',
    indStudentId: null,
    indSubtab: 'academicas', // 'academicas' | 'desempeno' | 'mensaje' | 'resumen'
    capturaStore: loadCapturaStore(),
    hasUnsavedCaptura: false,

    // Estado específico de la Etapa 6 (Desempeño integral y mensajes personalizados)
    desempenoStore: loadDesempenoStore(),
    mensajesStore: loadMensajesStore(),
    bancoMensajesStore: loadBancoMensajesStore(),
    hasUnsavedDesempeno: false,
    hasUnsavedMensajes: false,
    desempenoCategoryFilter: 'all',
    desempenoIndicatorFilter: 'all',
    desempenoLevelFilter: 'all',
    bancoSearch: '',
    bancoCategory: 'all',
    bancoLevel: 'all',
    lastDesempenoUndo: null
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
   * Carga los ajustes manuales de calificaciones guardados
   */
  function loadManualAdjustments() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.adjustments);
      if (raw) return JSON.parse(raw) || {};
    } catch (e) {}
    return {};
  }

  /**
   * Guarda los ajustes manuales de calificaciones en localStorage
   */
  function saveManualAdjustmentsStore(adjustments = evalState.manualAdjustments) {
    try {
      localStorage.setItem(STORAGE_KEYS.adjustments, JSON.stringify(adjustments));
      return true;
    } catch (e) {
      console.error('Error al guardar ajustes manuales de evaluación:', e);
      return false;
    }
  }

  /**
   * Carga el almacén de calificaciones capturadas (exámenes, modos, autorizaciones)
   */
  function loadCapturaStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.captura);
      if (raw) return JSON.parse(raw) || {};
    } catch (e) {}
    return {};
  }

  /**
   * Guarda el almacén de captura en localStorage
   */
  function saveCapturaStore(store = evalState.capturaStore) {
    try {
      localStorage.setItem(STORAGE_KEYS.captura, JSON.stringify(store));
      evalState.hasUnsavedCaptura = false;
      const notice = document.getElementById('evalCapturaUnsavedNotice');
      if (notice) notice.style.display = 'none';
      const status = document.getElementById('evalCapturaPersistStatus');
      if (status) status.textContent = '✓ Cambios guardados localmente';
      return true;
    } catch (e) {
      console.error('Error al guardar captura de evaluaciones:', e);
      return false;
    }
  }

  function markUnsavedCaptura() {
    evalState.hasUnsavedCaptura = true;
    const notice = document.getElementById('evalCapturaUnsavedNotice');
    if (notice) notice.style.display = 'inline-flex';
    const status = document.getElementById('evalCapturaPersistStatus');
    if (status) status.textContent = '● Calificaciones modificadas sin guardar';
  }

  // =========================================================================
  // PERSISTENCIA DE DESEMPEÑO INTEGRAL Y MENSAJES (ETAPA 6)
  // =========================================================================

  function loadDesempenoStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.desempeno);
      if (raw) return JSON.parse(raw) || { 1: {}, 2: {}, 3: {} };
    } catch (e) {}
    return { 1: {}, 2: {}, 3: {} };
  }

  function saveDesempenoStore(store = evalState.desempenoStore) {
    try {
      localStorage.setItem(STORAGE_KEYS.desempeno, JSON.stringify(store));
      evalState.hasUnsavedDesempeno = false;
      const status = document.getElementById('evalIndDesempenoSaveStatus');
      if (status) status.textContent = '✓ Borrador de desempeño guardado localmente';
      return true;
    } catch (e) {
      console.error('Error al guardar desempeño integral:', e);
      return false;
    }
  }

  function markUnsavedDesempeno() {
    evalState.hasUnsavedDesempeno = true;
    const status = document.getElementById('evalIndDesempenoSaveStatus');
    if (status) status.textContent = '● Valoraciones modificadas sin guardar';
  }

  function loadMensajesStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.mensajes);
      if (raw) return JSON.parse(raw) || { 1: {}, 2: {}, 3: {} };
    } catch (e) {}
    return { 1: {}, 2: {}, 3: {} };
  }

  function saveMensajesStore(store = evalState.mensajesStore) {
    try {
      localStorage.setItem(STORAGE_KEYS.mensajes, JSON.stringify(store));
      evalState.hasUnsavedMensajes = false;
      const status = document.getElementById('evalIndMessageSaveStatus');
      if (status) status.textContent = '✓ Mensaje guardado localmente';
      return true;
    } catch (e) {
      console.error('Error al guardar mensajes familiares:', e);
      return false;
    }
  }

  function markUnsavedMensaje() {
    evalState.hasUnsavedMensajes = true;
    const status = document.getElementById('evalIndMessageSaveStatus');
    if (status) status.textContent = '● Mensaje modificado sin guardar';
  }

  function loadBancoMensajesStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.bancoMensajes);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return JSON.parse(JSON.stringify(BANCO_MENSAJES_DEFAULT));
  }

  function saveBancoMensajesStore(bank = evalState.bancoMensajesStore) {
    try {
      localStorage.setItem(STORAGE_KEYS.bancoMensajes, JSON.stringify(bank));
      return true;
    } catch (e) {
      console.error('Error al guardar banco de recomendaciones:', e);
      return false;
    }
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
    let raw = (typeof state !== 'undefined' && Array.isArray(state.students) && state.students.length > 0)
      ? state.students
      : CANONICAL_STUDENTS_4A;
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
    renderCalculoPreliminar();
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

    const actDateStart = document.getElementById('evalActivityDateStart');
    const actDateEnd = document.getElementById('evalActivityDateEnd');
    actDateStart?.addEventListener('change', e => {
      evalState.activityFilters.dateStart = e.target.value || '';
      renderActivitiesTable();
    });
    actDateEnd?.addEventListener('change', e => {
      evalState.activityFilters.dateEnd = e.target.value || '';
      renderActivitiesTable();
    });

    // Filtros y controles de Cálculo Preliminar (Etapa 4)
    const calcStudent = document.getElementById('evalCalcStudentSelect');
    const calcSubject = document.getElementById('evalCalcSubjectSelect');
    const calcMode = document.getElementById('evalCalcModeSelect');

    calcStudent?.addEventListener('change', e => {
      evalState.selectedStudentId = e.target.value || null;
      renderCalculoPreliminar();
    });
    calcSubject?.addEventListener('change', e => {
      evalState.selectedSubject = e.target.value || 'Lenguajes';
      renderCalculoPreliminar();
    });
    calcMode?.addEventListener('change', e => {
      evalState.calcMode = e.target.value || 'mixta';
      renderCalculoPreliminar();
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
      if (evalState.hasUnsavedChanges || evalState.hasUnsavedActivityChanges || evalState.hasUnsavedCaptura || evalState.hasUnsavedDesempeno || evalState.hasUnsavedMensajes) {
        e.preventDefault();
        e.returnValue = 'Tienes cambios sin guardar en Evaluaciones Trimestrales.';
      }
    });

    // Filtros y controles de Captura Grupal e Individual (Etapa 5 y 6)
    const grupalSearch = document.getElementById('evalGrupalSearch');
    const grupalStatus = document.getElementById('evalGrupalStatusFilter');
    const grupalSubject = document.getElementById('evalGrupalSubjectSelect');
    const grupalMode = document.getElementById('evalGrupalModeSelect');
    const indStudentSelect = document.getElementById('evalIndStudentSelect');

    grupalSearch?.addEventListener('input', e => {
      evalState.grupalSearch = (e.target.value || '').trim().toLowerCase();
      renderCapturaGrupal();
    });
    grupalStatus?.addEventListener('change', e => {
      evalState.grupalStatusFilter = e.target.value || 'all';
      renderCapturaGrupal();
    });
    grupalSubject?.addEventListener('change', e => {
      evalState.grupalSubject = e.target.value || 'Lenguajes';
      renderCapturaGrupal();
    });
    grupalMode?.addEventListener('change', e => {
      evalState.grupalMode = e.target.value || 'asistida';
      renderCapturaGrupal();
    });
    indStudentSelect?.addEventListener('change', e => {
      evalState.indStudentId = e.target.value || null;
      renderCapturaIndividual();
    });

    // Controles de Desempeño Integral y Mensajes (Etapa 6)
    const desempCatSelect = document.getElementById('evalGrupalDesempenoCategorySelect');
    const desempIndSelect = document.getElementById('evalGrupalDesempenoIndicatorSelect');
    const desempLvlSelect = document.getElementById('evalGrupalDesempenoLevelSelect');

    desempCatSelect?.addEventListener('change', e => {
      evalState.desempenoCategoryFilter = e.target.value || 'all';
      // Actualizar el selector de indicadores específicos dependientes
      if (desempIndSelect) {
        const cat = e.target.value;
        const available = cat === 'all' 
          ? INDICADORES_DESEMPENO 
          : INDICADORES_DESEMPENO.filter(i => i.categoria === cat);
        desempIndSelect.innerHTML = '<option value="all">Todos los indicadores de la categoría</option>' +
          available.map(i => `<option value="${i.id}">${i.numero}. ${i.nombre}</option>`).join('');
      }
      renderCapturaGrupal();
    });

    desempIndSelect?.addEventListener('change', e => {
      evalState.desempenoIndicatorFilter = e.target.value || 'all';
      renderCapturaGrupal();
    });

    desempLvlSelect?.addEventListener('change', e => {
      evalState.desempenoLevelFilter = e.target.value || 'all';
      renderCapturaGrupal();
    });

    // Textarea de mensaje personalizado individual (conteo reactivo y validación)
    const msgTextarea = document.getElementById('evalIndMessageTextarea');
    msgTextarea?.addEventListener('input', e => {
      const text = e.target.value || '';
      const valRes = DesempenoEngine.validateMessageText(text);
      const countEl = document.getElementById('evalIndMessageCharCount');
      const alertEl = document.getElementById('evalIndMessageOverLimitAlert');
      const saveBtn = document.getElementById('evalBtnSaveMessage');

      if (countEl) {
        countEl.textContent = `${text.length} / 245 caracteres`;
        countEl.className = 'eval-char-count' + (valRes.isOverLimit ? ' error' : (text.length > 220 ? ' warning' : ''));
      }
      if (alertEl) {
        alertEl.style.display = valRes.isOverLimit ? 'inline-block' : 'none';
      }
      if (saveBtn) {
        saveBtn.disabled = valRes.isOverLimit;
      }

      if (evalState.indStudentId) {
        DesempenoEngine.setStudentMessage(evalState.indStudentId, text, evalState.trimester);
      }
    });

    // Filtros del Banco de Recomendaciones
    const bankSearch = document.getElementById('evalBankSearchInput');
    const bankCat = document.getElementById('evalBankCategorySelect');
    const bankLvl = document.getElementById('evalBankLevelSelect');

    bankSearch?.addEventListener('input', e => {
      evalState.bancoSearch = (e.target.value || '').trim().toLowerCase();
      renderBancoMensajesModal();
    });
    bankCat?.addEventListener('change', e => {
      evalState.bancoCategory = e.target.value || 'all';
      renderBancoMensajesModal();
    });
    bankLvl?.addEventListener('change', e => {
      evalState.bancoLevel = e.target.value || 'all';
      renderBancoMensajesModal();
    });

    // Formulario de nueva recomendación
    const newRecText = document.getElementById('evalNewRecText');
    newRecText?.addEventListener('input', e => {
      const len = (e.target.value || '').length;
      const countEl = document.getElementById('evalNewRecCharCount');
      if (countEl) countEl.textContent = `${len} / 245 caracteres`;
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
    if (evalState.activeTab === 'calculo-preliminar') {
      renderCalculoPreliminar();
    } else if (evalState.activeTab === 'captura-grupal') {
      renderCapturaGrupal();
    } else if (evalState.activeTab === 'captura-individual') {
      renderCapturaIndividual();
    }

    if (typeof toast === 'function') {
      toast(`Mostrando registros del ${evalState.config.periodos[num].nombre}.`);
    }
  }

  /**
   * Cambia de pestaña (Tab) interna dentro del módulo
   * @param {string} tabId 
   */
  function switchEvalTab(tabId) {
    const validTabs = ['seguimiento', 'seleccion-actividades', 'calculo-preliminar', 'captura-grupal', 'captura-individual', 'criterios'];
    const targetTab = validTabs.includes(tabId) ? tabId : 'seguimiento';

    if (evalState.hasUnsavedChanges && evalState.activeTab === 'criterios' && targetTab !== 'criterios') {
      saveConfigDraftSilently();
    }
    if (evalState.hasUnsavedActivityChanges && evalState.activeTab === 'seleccion-actividades' && targetTab !== 'seleccion-actividades') {
      saveActivityDraftSilently();
    }
    if (evalState.hasUnsavedCaptura && (evalState.activeTab === 'captura-grupal' || evalState.activeTab === 'captura-individual') && targetTab !== 'captura-grupal' && targetTab !== 'captura-individual') {
      saveCapturaStore();
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
      'calculo-preliminar': document.getElementById('evalTabCalculoPreliminar'),
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
    } else if (targetTab === 'calculo-preliminar') {
      renderCalculoPreliminar();
    } else if (targetTab === 'captura-grupal') {
      renderCapturaGrupal();
    } else if (targetTab === 'captura-individual') {
      renderCapturaIndividual();
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

      // 6. Filtro por rango de fechas personalizado
      if (f.dateStart && a.fecha && a.fecha < f.dateStart) return false;
      if (f.dateEnd && a.fecha && a.fecha > f.dateEnd) return false;

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
  // ETAPA 4: MOTOR DE CÁLCULO DE CALIFICACIONES (EvaluacionEngine)
  // ==========================================================================
  const EvaluacionEngine = {
    TOLERANCIA_DECIMAL: 0.001,

    DELIVERY_VALUES: {
      'entregada': 100,
      'incompleta': 50,
      'entregada tarde': 80,
      'tarde': 80,
      'no entregada': 0
    },

    CONDUCT_VALUES: {
      'excelente': 100,
      'adecuada': 80,
      'buena': 80,
      'requiere apoyo': 60,
      'apoyo': 60,
      'regular': 60
    },

    PARTICIPATION_VALUES: {
      'alta': 100,
      'media': 75,
      'nula': 0
    },

    /**
     * Valida si la suma de porcentajes activos es exactamente 100%
     */
    validatePercentages(weights) {
      if (!weights || typeof weights !== 'object') {
        return { isValid: false, sum: 0, reason: 'Configuración de porcentajes inexistente o inválida' };
      }
      const criteriaKeys = ['tareas', 'actividades', 'examen', 'conducta', 'participacion', 'asistencia', 'puntualidad'];
      let sum = 0;
      const active = [];

      for (const key of criteriaKeys) {
        const val = Number(weights[key]) || 0;
        if (val < 0) {
          return { isValid: false, sum: 0, reason: `Porcentaje negativo no permitido en ${key}` };
        }
        sum += val;
        if (val > 0) active.push(key);
      }

      const diff = Math.abs(sum - 100);
      const isValid = diff < this.TOLERANCIA_DECIMAL;

      return {
        isValid,
        sum: Number(sum.toFixed(4)),
        activeCriteria: active,
        diff: diff > 0 ? Number(diff.toFixed(4)) : 0
      };
    },

    /**
     * Formateo visual estricto a 2 decimales sin sesgo IEEE-754 (ej. 8.4950 -> 8.50)
     */
    formatGrade(value) {
      if (value === null || value === undefined || isNaN(value)) return '—';
      const num = Number(value);
      const rounded = Number(Math.round(Number(num + 'e2')) + 'e-2');
      return rounded.toFixed(2);
    },

    /**
     * Evalúa un registro individual de una actividad para un alumno
     */
    evaluateActivityRecord(activity, evaluation, options = {}) {
      if (!evaluation) {
        return { status: 'SIN_REGISTRO', value: null, isPending: false, isAbsent: false };
      }

      // Comprobar ausencia escolar
      if (evaluation.ausente === true || String(evaluation.trabajo).toLowerCase() === 'falta') {
        return { status: 'AUSENCIA', value: null, isPending: false, isAbsent: true };
      }

      // Comprobar actividad no aplicable / exento
      if (evaluation.noAplica === true || evaluation.exento === true) {
        return { status: 'NO_APLICA', value: null, isPending: false, isAbsent: false };
      }

      // Comprobar actividad pendiente
      const statusText = String(evaluation.trabajo || evaluation.estadoEntrega || '').trim().toLowerCase();
      if (statusText === 'pendiente') {
        return { status: 'PENDIENTE', value: null, isPending: true, isAbsent: false };
      }

      // Prioridad: calificación numérica válida vs estado de entrega
      if (evaluation.calificacion !== undefined && evaluation.calificacion !== null && evaluation.calificacion !== '') {
        const rawNum = Number(evaluation.calificacion);
        if (!isNaN(rawNum) && rawNum >= 0) {
          const normalized = rawNum <= 10 ? rawNum * 10 : Math.min(100, rawNum);
          return {
            status: normalized === 0 ? 'CERO_REGISTRADO' : 'VALIDO',
            value: normalized,
            rawScore: rawNum,
            isPending: false,
            isAbsent: false,
            source: 'calificacion_numerica'
          };
        }
      }

      // Estado de entrega cualitativo
      if (this.DELIVERY_VALUES[statusText] !== undefined) {
        const val = this.DELIVERY_VALUES[statusText];
        return {
          status: val === 0 ? 'CERO_REGISTRADO' : 'VALIDO',
          value: val,
          rawScore: val,
          isPending: false,
          isAbsent: false,
          source: 'estado_entrega'
        };
      }

      return { status: 'SIN_REGISTRO', value: null, isPending: false, isAbsent: false };
    },

    /**
     * Cálculo del Criterio de Tareas / Actividades
     */
    calculateTasksCriterion(studentId, selectedActivities, evaluations, options = {}) {
      if (!selectedActivities || selectedActivities.length === 0) {
        return {
          status: 'SIN_INFORMACION',
          score: null,
          hasPending: false,
          validCount: 0,
          totalSelected: 0,
          reason: 'No hay actividades seleccionadas para este criterio y campo formativo'
        };
      }

      const weightMode = options.weightMode || 'uniform';
      const customWeights = options.customWeights || {};
      const excludedIds = new Set((options.excludedIds || []).map(String));

      let sumWeightedScores = 0;
      let sumWeights = 0;
      let hasPending = false;
      let validCount = 0;
      let hasInvalidWeight = false;
      const invalidWeightActivities = [];
      const details = [];

      for (const act of selectedActivities) {
        const actId = String(act.id);
        if (excludedIds.has(actId)) continue;

        let weight = 1.0;
        if (weightMode === 'custom') {
          const rawW = Number(customWeights[actId]);
          if (!isNaN(rawW) && isFinite(rawW) && rawW > 0) {
            weight = rawW;
          } else {
            hasInvalidWeight = true;
            invalidWeightActivities.push(actId);
          }
        }

        const sId = String(studentId);
        const evalItem = (evaluations || []).find(ev => 
          String(ev.claseId || ev.activityId) === actId && 
          (String(ev.alumnoId || ev.studentId) === sId)
        );

        const record = this.evaluateActivityRecord(act, evalItem, options);

        if (record.isPending) {
          hasPending = true;
        }

        if (record.status === 'VALIDO' || record.status === 'CERO_REGISTRADO') {
          sumWeightedScores += record.value * weight;
          sumWeights += weight;
          validCount++;
        }

        details.push({
          activityId: actId,
          weight,
          record
        });
      }

      if (hasInvalidWeight) {
        return {
          status: 'ERROR_PONDERACION',
          score: null,
          hasPending,
          hasInvalidWeight: true,
          invalidWeightActivities,
          validCount,
          totalSelected: selectedActivities.length,
          weightMode,
          reason: 'Ponderación personalizada inválida o no asignada en actividades seleccionadas'
        };
      }

      if (validCount === 0) {
        return {
          status: hasPending ? 'PENDIENTE' : 'SIN_INFORMACION',
          score: null,
          hasPending,
          validCount: 0,
          totalSelected: selectedActivities.length,
          details
        };
      }

      const finalScore = sumWeightedScores / sumWeights;

      return {
        status: 'VALIDO',
        score: finalScore,
        normalized10: finalScore / 10,
        hasPending,
        validCount,
        totalSelected: selectedActivities.length,
        weightMode,
        details
      };
    },

    /**
     * Cálculo del Criterio de Conducta (con exclusiones individuales)
     */
    calculateConductCriterion(studentId, evaluationsInPeriod, options = {}) {
      const sId = String(studentId);
      const excludedIds = new Set((options.excludedIds || options.conductaExclusions || []).map(String));
      const validEvals = (evaluationsInPeriod || []).filter(ev => {
        const evId = String(ev.id || ev.claseId || '');
        if (evId && excludedIds.has(evId)) return false;
        return (
          String(ev.alumnoId || ev.studentId) === sId &&
          ev.conducta &&
          !ev.ausente &&
          String(ev.trabajo).toLowerCase() !== 'falta'
        );
      });

      if (validEvals.length === 0) {
        return { status: 'SIN_INFORMACION', score: null, count: 0 };
      }

      let sum = 0;
      let count = 0;

      for (const ev of validEvals) {
        const c = String(ev.conducta).trim().toLowerCase();
        let matchedVal = null;
        for (const [key, val] of Object.entries(this.CONDUCT_VALUES)) {
          if (c.includes(key)) {
            matchedVal = val;
            break;
          }
        }
        if (matchedVal !== null) {
          sum += matchedVal;
          count++;
        }
      }

      if (count === 0) {
        return { status: 'SIN_INFORMACION', score: null, count: 0 };
      }

      const score = sum / count;
      return {
        status: 'VALIDO',
        score,
        normalized10: score / 10,
        count
      };
    },

    /**
     * Cálculo del Criterio de Participación (con exclusiones individuales)
     */
    calculateParticipationCriterion(studentId, evaluationsInPeriod, options = {}) {
      const sId = String(studentId);
      const excludedIds = new Set((options.excludedIds || options.participacionExclusions || []).map(String));
      const studentEvals = (evaluationsInPeriod || []).filter(ev => {
        const evId = String(ev.id || ev.claseId || '');
        if (evId && excludedIds.has(evId)) return false;
        return String(ev.alumnoId || ev.studentId) === sId;
      });

      let sum = 0;
      let count = 0;

      for (const ev of studentEvals) {
        if (ev.ausente === true || String(ev.trabajo).toLowerCase() === 'falta') {
          continue;
        }
        if (!ev.participacion) continue;

        const p = String(ev.participacion).trim().toLowerCase();
        let matchedVal = null;
        for (const [key, val] of Object.entries(this.PARTICIPATION_VALUES)) {
          if (p.includes(key)) {
            matchedVal = val;
            break;
          }
        }
        if (matchedVal !== null) {
          sum += matchedVal;
          count++;
        }
      }

      if (count === 0) {
        return { status: 'SIN_INFORMACION', score: null, count: 0 };
      }

      const score = sum / count;
      return {
        status: 'VALIDO',
        score,
        normalized10: score / 10,
        count
      };
    },

    /**
     * Cálculo del Criterio de Examen Escrito (Manual)
     */
    calculateExamCriterion(manualExamScore, options = {}) {
      if (manualExamScore === undefined || manualExamScore === null || manualExamScore === '') {
        return { status: 'PENDIENTE', score: null, normalized10: null };
      }

      const num = Number(manualExamScore);
      if (isNaN(num) || num < 0 || num > 10) {
        return { status: 'INVALIDO', score: null, normalized10: null, reason: 'La calificación de examen debe estar entre 0 y 10' };
      }

      return {
        status: num === 0 ? 'CERO_REGISTRADO' : 'VALIDO',
        score: num * 10,
        normalized10: num
      };
    },

    /**
     * Cálculo de Calificación por Campo Formativo
     */
    calculateSubjectGrade({ studentId, subject, percentages, criteriaResults, mode = 'mixta', manualGrade = null, manualAdjustment = null }) {
      if (mode === 'manual') {
        if (manualGrade !== null && manualGrade !== undefined && manualGrade !== '') {
          const mg = Number(manualGrade);
          if (!isNaN(mg) && mg >= 0 && mg <= 10) {
            return {
              mode: 'manual',
              subject,
              finalGrade: mg,
              displayGrade: this.formatGrade(mg),
              status: 'VALIDO_MANUAL',
              isComplete: true,
              hasPending: false,
              breakdown: {}
            };
          }
        }
        return {
          mode: 'manual',
          subject,
          finalGrade: null,
          displayGrade: '—',
          status: 'PENDIENTE_MANUAL',
          isComplete: false,
          hasPending: true,
          breakdown: {}
        };
      }

      const pctVal = this.validatePercentages(percentages);
      if (!pctVal.isValid) {
        return {
          mode,
          subject,
          finalGrade: null,
          displayGrade: '—',
          status: 'ERROR_CONFIGURACION',
          isComplete: false,
          error: `Los porcentajes no suman 100% (Suma actual: ${pctVal.sum}%)`,
          breakdown: {}
        };
      }

      let totalWeightedSum = 0;
      let hasPending = false;
      let hasMissingInfo = false;
      const breakdown = {};

      const activeCriteria = pctVal.activeCriteria;

      for (const crit of activeCriteria) {
        const weightPct = Number(percentages[crit]) || 0;
        const res = criteriaResults[crit] || { status: 'SIN_INFORMACION', score: null };

        breakdown[crit] = {
          weightPct,
          result: res,
          contribution: 0
        };

        if (res.hasPending || res.status === 'PENDIENTE') {
          hasPending = true;
        }

        if (res.status === 'VALIDO' || res.status === 'CERO_REGISTRADO') {
          const contribution = (res.score * (weightPct / 100)) / 10;
          breakdown[crit].contribution = contribution;
          totalWeightedSum += contribution;
        } else {
          hasMissingInfo = true;
        }
      }

      const calculatedGrade = totalWeightedSum;

      let finalGrade = calculatedGrade;
      let isAdjusted = false;

      if (manualAdjustment && manualAdjustment.adjustedGrade !== undefined && manualAdjustment.adjustedGrade !== null) {
        const adj = Number(manualAdjustment.adjustedGrade);
        if (!isNaN(adj) && adj >= 0 && adj <= 10) {
          finalGrade = adj;
          isAdjusted = true;
        }
      }

      const hasAnyValid = activeCriteria.some(crit => {
        const res = criteriaResults[crit];
        return res && (res.status === 'VALIDO' || res.status === 'CERO_REGISTRADO');
      });

      const isComplete = !hasMissingInfo && !hasPending && hasAnyValid;

      if (!isComplete && !hasAnyValid && !isAdjusted) {
        finalGrade = null;
      }

      return {
        mode,
        subject,
        studentId,
        originalCalculated: calculatedGrade,
        finalGrade,
        displayGrade: this.formatGrade(finalGrade),
        isAdjusted,
        manualAdjustment: isAdjusted ? manualAdjustment : null,
        status: isComplete ? 'COMPLETO' : (hasPending ? 'PRELIMINAR_CON_PENDIENTES' : 'INCOMPLETO'),
        isComplete,
        hasPending,
        hasMissingInfo,
        breakdown
      };
    },

    /**
     * Cálculo del Promedio General Trimestral (4 campos formativos)
     */
    calculateTrimesterAverage(subjectGrades) {
      const REQUIRED_FIELDS = [
        'Lenguajes',
        'Saberes y Pensamiento Científico',
        'Ética, Naturaleza y Sociedades',
        'De lo Humano y lo Comunitario'
      ];

      let sum = 0;
      let completeCount = 0;
      const missing = [];

      for (const field of REQUIRED_FIELDS) {
        const g = subjectGrades?.[field];
        if (g && (g.status === 'COMPLETO' || g.status === 'VALIDO_MANUAL' || g.isAuthorized) && g.finalGrade !== null && !isNaN(g.finalGrade)) {
          sum += g.finalGrade;
          completeCount++;
        } else {
          missing.push(field);
        }
      }

      if (completeCount < 4) {
        return {
          isComplete: false,
          average: null,
          displayAverage: '—',
          completedCount: completeCount,
          missingFields: missing,
          reason: 'Faltan calificaciones definitivas en uno o más campos formativos'
        };
      }

      const avg = sum / 4;
      return {
        isComplete: true,
        average: avg,
        displayAverage: this.formatGrade(avg),
        completedCount: 4,
        missingFields: []
      };
    },

    /**
     * Cálculo del Promedio Anual (3 trimestres)
     */
    calculateAnnualAverage(trimesterAverages) {
      if (!trimesterAverages || typeof trimesterAverages !== 'object') {
        return { isComplete: false, average: null, displayAverage: '—' };
      }

      const t1 = trimesterAverages[1];
      const t2 = trimesterAverages[2];
      const t3 = trimesterAverages[3];

      const isT1Complete = t1 && t1.isComplete && t1.average !== null;
      const isT2Complete = t2 && t2.isComplete && t2.average !== null;
      const isT3Complete = t3 && t3.isComplete && t3.average !== null;

      if (!isT1Complete || !isT2Complete || !isT3Complete) {
        const pending = [];
        if (!isT1Complete) pending.push('Trimestre 1');
        if (!isT2Complete) pending.push('Trimestre 2');
        if (!isT3Complete) pending.push('Trimestre 3');
        return {
          isComplete: false,
          status: 'Pendiente',
          statusText: 'Pendiente',
          average: null,
          displayAverage: 'Pendiente',
          pendingTrimesters: pending
        };
      }

      const avg = (t1.average + t2.average + t3.average) / 3;
      return {
        isComplete: true,
        status: 'Definitivo',
        statusText: 'Definitivo',
        average: avg,
        displayAverage: this.formatGrade(avg),
        pendingTrimesters: []
      };
    },

    /**
     * Calcula el promedio anual independiente para un campo formativo específico
     */
    calculateFieldAnnualAverage(studentId, fieldName) {
      const sId = String(studentId);
      const t1Eval = calculateStudentFullEvaluation(sId, 1);
      const t2Eval = calculateStudentFullEvaluation(sId, 2);
      const t3Eval = calculateStudentFullEvaluation(sId, 3);

      const t1Grade = t1Eval?.subjects?.[fieldName]?.authorizedGrade ?? t1Eval?.subjects?.[fieldName]?.finalGrade;
      const t2Grade = t2Eval?.subjects?.[fieldName]?.authorizedGrade ?? t2Eval?.subjects?.[fieldName]?.finalGrade;
      const t3Grade = t3Eval?.subjects?.[fieldName]?.authorizedGrade ?? t3Eval?.subjects?.[fieldName]?.finalGrade;

      const isT1 = t1Grade !== null && t1Grade !== undefined && !isNaN(t1Grade);
      const isT2 = t2Grade !== null && t2Grade !== undefined && !isNaN(t2Grade);
      const isT3 = t3Grade !== null && t3Grade !== undefined && !isNaN(t3Grade);

      if (!isT1 || !isT2 || !isT3) {
        return {
          isComplete: false,
          status: 'Pendiente',
          statusText: 'Pendiente',
          average: null,
          displayAverage: 'Pendiente',
          trimesterGrades: {
            1: isT1 ? this.formatGrade(t1Grade) : '—',
            2: isT2 ? this.formatGrade(t2Grade) : '—',
            3: isT3 ? this.formatGrade(t3Grade) : '—'
          }
        };
      }

      const avg = (Number(t1Grade) + Number(t2Grade) + Number(t3Grade)) / 3;
      return {
        isComplete: true,
        status: 'Definitivo',
        statusText: 'Definitivo',
        average: avg,
        displayAverage: this.formatGrade(avg),
        trimesterGrades: {
          1: this.formatGrade(t1Grade),
          2: this.formatGrade(t2Grade),
          3: this.formatGrade(t3Grade)
        }
      };
    }
  };

  /**
   * Genera la clave única de ajuste manual por alumno, trimestre y campo formativo
   */
  function getAdjustmentKey(studentId, subject, trimester = evalState.trimester) {
    const ciclo = evalState.config?.cicloEscolar || '2026-2027';
    const grupo = evalState.config?.grupo || '4.° A';
    return `${ciclo}_${grupo}_T${trimester}_${studentId}_${subject}`;
  }

  /**
   * Guarda un ajuste manual capturado desde la UI
   */
  function saveManualAdjustmentFromUI() {
    const studentId = evalState.selectedStudentId;
    const subject = evalState.selectedSubject;
    const t = evalState.trimester;
    if (!studentId || !subject) return;

    const gradeInput = document.getElementById('evalManualGradeInput');
    const reasonInput = document.getElementById('evalManualReasonInput');

    const rawGrade = gradeInput?.value;
    if (rawGrade === undefined || rawGrade === null || rawGrade === '') {
      if (typeof toast === 'function') toast('Ingresa una calificación válida entre 0 y 10.');
      return;
    }

    const numGrade = Number(rawGrade);
    if (isNaN(numGrade) || numGrade < 0 || numGrade > 10) {
      if (typeof toast === 'function') toast('La calificación debe ser un número entre 0 y 10.');
      return;
    }

    const key = getAdjustmentKey(studentId, subject, t);
    evalState.manualAdjustments[key] = {
      adjustedGrade: numGrade,
      reason: (reasonInput?.value || '').trim() || 'Ajuste docente autorizado',
      author: 'Docente Titular',
      timestamp: new Date().toISOString()
    };

    saveManualAdjustmentsStore();
    renderCalculoPreliminar();
    if (typeof toast === 'function') {
      toast(`Calificación autorizada de ${numGrade.toFixed(2)} aplicada para ${subject}.`);
    }
  }

  /**
   * Restablece el cálculo automático eliminando el ajuste manual
   */
  function resetManualAdjustmentFromUI() {
    const studentId = evalState.selectedStudentId;
    const subject = evalState.selectedSubject;
    const t = evalState.trimester;
    if (!studentId || !subject) return;

    const key = getAdjustmentKey(studentId, subject, t);
    if (evalState.manualAdjustments[key]) {
      delete evalState.manualAdjustments[key];
      saveManualAdjustmentsStore();
      renderCalculoPreliminar();
      if (typeof toast === 'function') {
        toast(`Ajuste eliminado. Resultado automático restablecido.`);
      }
    }
  }

  /**
   * Renderiza la vista de Cálculo Preliminar (Etapa 4)
   */
  function renderCalculoPreliminar() {
    const students = getStudentsList();
    if (!students || students.length === 0) return;

    // 1. Selector de Alumnos (ordenados por número oficial de lista)
    const sortedStudents = [...students].sort((a, b) => resolveOfficialListNumber(a) - resolveOfficialListNumber(b));
    const studentSelect = document.getElementById('evalCalcStudentSelect');

    if (studentSelect) {
      const currentSelected = evalState.selectedStudentId || sortedStudents[0]?.id;
      if (!evalState.selectedStudentId) evalState.selectedStudentId = currentSelected;

      // Solo reconstruir si cambiaron las opciones
      const optionsHtml = sortedStudents.map(s => {
        const num = resolveOfficialListNumber(s);
        const name = s.apellidos ? `${s.apellidos} ${s.nombres || ''}` : (s.nombre || 'Alumno');
        const isSel = String(s.id) === String(evalState.selectedStudentId);
        return `<option value="${s.id}" ${isSel ? 'selected' : ''}>${num < 10 ? '0' + num : num}. ${name}</option>`;
      }).join('');

      if (studentSelect.innerHTML.trim() !== optionsHtml.trim()) {
        studentSelect.innerHTML = optionsHtml;
      }
    }

    const currentStudent = sortedStudents.find(s => String(s.id) === String(evalState.selectedStudentId)) || sortedStudents[0];
    if (!currentStudent) return;

    // Actualizar metadatos del alumno
    const numOficial = resolveOfficialListNumber(currentStudent);
    const fullName = currentStudent.apellidos ? `${currentStudent.apellidos} ${currentStudent.nombres || ''}` : (currentStudent.nombre || 'Alumno');
    const nameEl = document.getElementById('evalCalcStudentName');
    const metaEl = document.getElementById('evalCalcStudentDetails');
    if (nameEl) nameEl.textContent = `${numOficial < 10 ? '0' + numOficial : numOficial}. ${fullName}`;
    if (metaEl) metaEl.textContent = `Lista # ${numOficial} · Matrícula / CURP: ${currentStudent.curp || currentStudent.id || '—'}`;

    // 2. Selectores de Materia y Modalidad
    const subjectSelect = document.getElementById('evalCalcSubjectSelect');
    if (subjectSelect && evalState.selectedSubject) {
      subjectSelect.value = evalState.selectedSubject;
    }
    const modeSelect = document.getElementById('evalCalcModeSelect');
    if (modeSelect && evalState.calcMode) {
      modeSelect.value = evalState.calcMode;
    }

    const t = evalState.trimester;
    const cfg = evalState.config;
    const percentages = cfg.porcentajes?.[t] || { tareas: 50, examen: 30, conducta: 10, participacion: 10 };
    const pctVal = EvaluacionEngine.validatePercentages(percentages);

    // 3. Banner de advertencia de porcentajes o pendientes
    const noticeBox = document.getElementById('evalCalcNoticeBox');
    if (noticeBox) {
      if (!pctVal.isValid) {
        noticeBox.style.display = 'flex';
        noticeBox.className = 'eval-calc-notice-banner danger';
        noticeBox.innerHTML = `⚠️ <b>Configuración incompleta:</b> Los porcentajes del Trimestre ${t} suman ${pctVal.sum}%. Deben sumar exactamente 100% para emitir calificaciones definitivas.`;
      } else {
        noticeBox.style.display = 'none';
      }
    }

    // 4. Recuperación de datos para el cálculo
    const raw = getRawActivities();
    const sel = getCurrentActivitySelection(t);
    const activitiesInPeriod = raw.classes.filter(a => isActivityInPeriod(a, t));
    const evaluations = raw.evaluations;

    const ALL_FIELDS = [
      'Lenguajes',
      'Saberes y Pensamiento Científico',
      'Ética, Naturaleza y Sociedades',
      'De lo Humano y lo Comunitario'
    ];

    const subjectGrades = {};

    ALL_FIELDS.forEach(field => {
      // Filtrar actividades seleccionadas de este campo formativo
      const fieldActs = activitiesInPeriod.filter(a => 
        (a.materia === field) && sel.selectedIds.includes(String(a.id))
      );

      // Calcular criterios
      const tasksRes = EvaluacionEngine.calculateTasksCriterion(currentStudent.id, fieldActs, evaluations, {
        weightMode: sel.weightMode,
        customWeights: sel.customWeights
      });

      const actClassRes = EvaluacionEngine.calculateTasksCriterion(currentStudent.id, [], evaluations);

      const conductRes = EvaluacionEngine.calculateConductCriterion(currentStudent.id, evaluations);
      const partRes = EvaluacionEngine.calculateParticipationCriterion(currentStudent.id, evaluations);

      // Examen escrito (preparado para captura manual por alumno y materia)
      const examManualScore = null; // En Etapa 5 se conectará a la matriz de captura
      const examRes = EvaluacionEngine.calculateExamCriterion(examManualScore);

      const criteriaResults = {
        tareas: tasksRes,
        actividades: actClassRes,
        examen: examRes,
        conducta: conductRes,
        participacion: partRes,
        asistencia: { status: 'PENDIENTE', score: null },
        puntualidad: { status: 'PENDIENTE', score: null }
      };

      const adjKey = getAdjustmentKey(currentStudent.id, field, t);
      const manualAdjustment = evalState.manualAdjustments[adjKey] || null;

      subjectGrades[field] = EvaluacionEngine.calculateSubjectGrade({
        studentId: currentStudent.id,
        subject: field,
        percentages,
        criteriaResults,
        mode: evalState.calcMode,
        manualAdjustment
      });
    });

    // 5. Renderizar los 4 campos formativos rápidos en #evalFourFieldsSummary
    const fourFieldsContainer = document.getElementById('evalFourFieldsSummary');
    if (fourFieldsContainer) {
      fourFieldsContainer.innerHTML = ALL_FIELDS.map(f => {
        const g = subjectGrades[f];
        const isCurrent = f === evalState.selectedSubject;
        const shortName = f.length > 18 ? f.slice(0, 15) + '…' : f;
        return `
          <div class="eval-field-pill-card ${isCurrent ? 'active' : ''}" data-action="eval-select-calc-field" data-field="${f}" title="${f}">
            <span>${shortName}</span>
            <b>${g ? g.displayGrade : '—'}</b>
          </div>
        `;
      }).join('');
    }

    // 6. Promedio general del trimestre
    const trimAvgRes = EvaluacionEngine.calculateTrimesterAverage(subjectGrades);
    const trimAvgEl = document.getElementById('evalCalcTrimesterAvg');
    if (trimAvgEl) {
      trimAvgEl.textContent = trimAvgRes.isComplete 
        ? trimAvgRes.displayAverage 
        : (trimAvgRes.displayAverage !== '—' ? `${trimAvgRes.displayAverage} (Preliminar)` : 'Pendiente');
    }

    // 7. Campo Formativo Seleccionado actualmente
    const currentSubject = evalState.selectedSubject || 'Lenguajes';
    const currentSubGrade = subjectGrades[currentSubject];

    const titleEl = document.getElementById('evalCalcSubjectTitle');
    if (titleEl) titleEl.textContent = currentSubject;

    const gradeEl = document.getElementById('evalCalcFinalGrade');
    if (gradeEl) {
      gradeEl.textContent = currentSubGrade ? currentSubGrade.displayGrade : '0.00';
    }

    const statusBadge = document.getElementById('evalCalcStatusBadge');
    const adjustedBadge = document.getElementById('evalCalcAdjustedBadge');
    const noteEl = document.getElementById('evalCalcOriginalNote');

    if (currentSubGrade) {
      if (statusBadge) {
        if (currentSubGrade.status === 'COMPLETO' || currentSubGrade.status === 'VALIDO_MANUAL') {
          statusBadge.className = 'eval-status-pill status-completed';
          statusBadge.textContent = 'Calculado definitivo';
        } else if (currentSubGrade.status === 'PRELIMINAR_CON_PENDIENTES') {
          statusBadge.className = 'eval-status-pill status-review';
          statusBadge.textContent = 'Preliminar con pendientes';
        } else {
          statusBadge.className = 'eval-status-pill status-pending';
          statusBadge.textContent = 'Incompleto';
        }
      }

      if (adjustedBadge && noteEl) {
        if (currentSubGrade.isAdjusted) {
          adjustedBadge.style.display = 'inline-block';
          noteEl.textContent = `Cálculo automático original: ${EvaluacionEngine.formatGrade(currentSubGrade.originalCalculated)} · Motivo: ${currentSubGrade.manualAdjustment?.reason || '—'}`;
        } else {
          adjustedBadge.style.display = 'none';
          noteEl.textContent = '';
        }
      }

      // Cargar en inputs de ajuste manual
      const gradeInput = document.getElementById('evalManualGradeInput');
      const reasonInput = document.getElementById('evalManualReasonInput');
      if (gradeInput) {
        gradeInput.value = currentSubGrade.isAdjusted ? currentSubGrade.finalGrade : '';
      }
      if (reasonInput) {
        reasonInput.value = currentSubGrade.manualAdjustment?.reason || '';
      }
    }

    // 8. Tabla de desglose de criterios
    const tbody = document.getElementById('evalBreakdownTableBody');
    if (tbody && currentSubGrade && currentSubGrade.breakdown) {
      const criteriaList = [
        { id: 'tareas', name: 'Tareas' },
        { id: 'actividades', name: 'Actividades en clase' },
        { id: 'examen', name: 'Examen escrito' },
        { id: 'conducta', name: 'Conducta' },
        { id: 'participacion', name: 'Participación' },
        { id: 'asistencia', name: 'Asistencia' },
        { id: 'puntualidad', name: 'Puntualidad' }
      ];

      tbody.innerHTML = criteriaList.map(c => {
        const item = currentSubGrade.breakdown[c.id];
        const weightPct = item ? item.weightPct : (percentages[c.id] || 0);
        const res = item ? item.result : null;
        const contrib = item ? item.contribution : 0;

        let statusText = '—';
        let statusClass = 'status-pending';
        let detailText = 'Sin ponderación activa en este trimestre';

        if (weightPct === 0) {
          statusText = 'Desactivado (0%)';
          statusClass = 'status-pending';
          detailText = 'No se computa para la calificación';
        } else if (!res || res.status === 'SIN_INFORMACION') {
          statusText = 'Sin información';
          statusClass = 'status-review';
          detailText = c.id === 'examen' ? 'Examen pendiente de captura' : 'Sin registros válidos en el periodo';
        } else if (res.status === 'PENDIENTE') {
          statusText = 'Pendiente de revisión';
          statusClass = 'status-review';
          detailText = 'Existen actividades o registros pendientes';
        } else if (res.status === 'CERO_REGISTRADO') {
          statusText = 'Cero registrado (0%)';
          statusClass = 'status-completed';
          detailText = 'No entregada / 0 verificado';
        } else if (res.status === 'VALIDO') {
          statusText = 'Válido';
          statusClass = 'status-completed';
          if (c.id === 'tareas') {
            detailText = `${res.validCount} de ${res.totalSelected} actividades seleccionadas`;
          } else if (c.id === 'conducta' || c.id === 'participacion') {
            detailText = `${res.count} registros evaluados`;
          } else {
            detailText = 'Registro verificado';
          }
        }

        const baseVal = (res && res.score !== null) ? `${EvaluacionEngine.formatGrade(res.score)}%` : '—';
        const contribVal = (weightPct > 0 && res && res.score !== null) ? EvaluacionEngine.formatGrade(contrib) : '0.00';

        return `
          <tr>
            <td><b>${c.name}</b></td>
            <td style="text-align: center;"><span class="badge">${weightPct}%</span></td>
            <td style="text-align: center; font-weight: 700;">${baseVal}</td>
            <td style="text-align: center; font-weight: 800; color: var(--teal);">${contribVal}</td>
            <td><span class="eval-status-pill ${statusClass}" style="font-size: 11px;">${statusText}</span></td>
            <td style="font-size: 12px; color: var(--muted);">${detailText}</td>
          </tr>
        `;
      }).join('');
    }

    // 9. Renderizar trayectoria trimestral y promedio anual en #evalAnnualCardsRow
    const annualCardsRow = document.getElementById('evalAnnualCardsRow');
    if (annualCardsRow) {
      const trimAvgMap = {
        1: { isComplete: true, average: trimAvgRes.isComplete ? trimAvgRes.average : null },
        2: { isComplete: false, average: null },
        3: { isComplete: false, average: null }
      };

      const annRes = EvaluacionEngine.calculateAnnualAverage(trimAvgMap);

      annualCardsRow.innerHTML = `
        <div class="eval-annual-card">
          <span>Trimestre 1</span>
          <b>${trimAvgRes.isComplete ? trimAvgRes.displayAverage : '—'}</b>
          <span class="muted">${t === 1 ? 'Periodo actual' : 'Finalizado'}</span>
        </div>
        <div class="eval-annual-card">
          <span>Trimestre 2</span>
          <b>—</b>
          <span class="muted">Pendiente</span>
        </div>
        <div class="eval-annual-card">
          <span>Trimestre 3</span>
          <b>—</b>
          <span class="muted">Pendiente</span>
        </div>
        <div class="eval-annual-card summary">
          <span>Promedio general anual</span>
          <b>${annRes.isComplete ? annRes.displayAverage : '—'}</b>
          <span class="muted">${annRes.isComplete ? 'Definitivo' : 'Requiere 3 trimestres'}</span>
        </div>
      `;
    }
  }

  // ==========================================================================
  // ETAPA 5: MODALIDADES DE CAPTURA INDIVIDUAL Y GRUPAL
  // ==========================================================================

  const EVAL_FIELDS = [
    'Lenguajes',
    'Saberes y Pensamiento Científico',
    'Ética, Naturaleza y Sociedades',
    'De lo Humano y lo Comunitario'
  ];

  /**
   * Obtiene la clave de identificación única para la captura de un alumno y materia
   */
  function getCapturaItemKey(studentId, subject, trimester = evalState.trimester) {
    const ciclo = evalState.config?.cicloEscolar || '2026-2027';
    const grupo = evalState.config?.grupo || '4.° A';
    return `${ciclo}_${grupo}_T${trimester}_${studentId}_${subject}`;
  }

  /**
   * Obtiene los datos de captura de un alumno y materia
   */
  function getStudentFieldData(studentId, subject, trimester = evalState.trimester) {
    const key = getCapturaItemKey(studentId, subject, trimester);
    const stored = evalState.capturaStore?.[key];
    const adjKey = getAdjustmentKey(studentId, subject, trimester);
    const adj = evalState.manualAdjustments?.[adjKey];

    return Object.assign({
      mode: evalState.grupalMode || 'mixta',
      manualExam: null,
      manualGrade: null,
      adjustedGrade: adj ? adj.adjustedGrade : null,
      adjustmentReason: adj ? adj.reason : '',
      authorizedGrade: null,
      isAuthorized: false,
      authorizedAt: null,
      authorizedBy: null
    }, stored || {});
  }

  /**
   * Guarda los datos de captura de un alumno y materia
   */
  function setStudentFieldData(studentId, subject, data, trimester = evalState.trimester) {
    const key = getCapturaItemKey(studentId, subject, trimester);
    evalState.capturaStore = evalState.capturaStore || {};
    const existing = getStudentFieldData(studentId, subject, trimester);
    evalState.capturaStore[key] = Object.assign({}, existing, data);
    markUnsavedCaptura();
  }

  /**
   * Calcula la evaluación completa de un alumno en los 4 campos formativos
   */
  function calculateStudentFullEvaluation(studentId, trimester = evalState.trimester) {
    const t = trimester;
    const cfg = evalState.config;
    const percentages = cfg.porcentajes?.[t] || { tareas: 50, examen: 30, conducta: 10, participacion: 10 };
    const raw = getRawActivities();
    const sel = getCurrentActivitySelection(t);
    const activitiesInPeriod = raw.classes.filter(a => isActivityInPeriod(a, t));
    const evaluations = raw.evaluations;

    const subjects = {};
    let allAuthorized = true;

    EVAL_FIELDS.forEach(field => {
      const fieldData = getStudentFieldData(studentId, field, t);

      // Actividades de este campo formativo (tipo TAREA para tareas, tipo ACTIVIDAD para actividades en clase)
      const taskActs = activitiesInPeriod.filter(a => 
        (a.materia === field) && (a.tipoActividad !== 'ACTIVIDAD') && sel.selectedIds.includes(String(a.id))
      );
      const classActs = activitiesInPeriod.filter(a => 
        (a.materia === field) && (a.tipoActividad === 'ACTIVIDAD') && sel.selectedIds.includes(String(a.id))
      );

      const tasksRes = EvaluacionEngine.calculateTasksCriterion(studentId, taskActs, evaluations, {
        weightMode: sel.weightMode,
        customWeights: sel.customWeights
      });

      const actClassRes = EvaluacionEngine.calculateTasksCriterion(studentId, classActs, evaluations, {
        weightMode: sel.weightMode,
        customWeights: sel.customWeights
      });

      const conductRes = EvaluacionEngine.calculateConductCriterion(studentId, evaluations);
      const partRes = EvaluacionEngine.calculateParticipationCriterion(studentId, evaluations);

      // Examen escrito (desde captura manual)
      const examRes = EvaluacionEngine.calculateExamCriterion(fieldData.manualExam);

      const criteriaResults = {
        tareas: tasksRes,
        actividades: actClassRes,
        examen: examRes,
        conducta: conductRes,
        participacion: partRes,
        asistencia: { status: 'PENDIENTE', score: null },
        puntualidad: { status: 'PENDIENTE', score: null }
      };

      const manualAdjustment = fieldData.adjustedGrade !== null ? {
        adjustedGrade: fieldData.adjustedGrade,
        reason: fieldData.adjustmentReason
      } : null;

      const calcRes = EvaluacionEngine.calculateSubjectGrade({
        studentId,
        subject: field,
        percentages,
        criteriaResults,
        mode: fieldData.mode,
        manualGrade: fieldData.manualGrade,
        manualAdjustment
      });

      calcRes.isAuthorized = fieldData.isAuthorized === true;
      calcRes.authorizedGrade = fieldData.authorizedGrade;
      calcRes.manualExam = fieldData.manualExam;
      calcRes.fieldData = fieldData;

      if (calcRes.isAuthorized && calcRes.authorizedGrade !== null && calcRes.authorizedGrade !== undefined) {
        calcRes.finalGrade = calcRes.authorizedGrade;
        calcRes.displayGrade = EvaluacionEngine.formatGrade(calcRes.authorizedGrade);
        calcRes.status = 'COMPLETO';
      }

      if (!calcRes.isAuthorized) {
        allAuthorized = false;
      }

      subjects[field] = calcRes;
    });

    const trimesterAverage = EvaluacionEngine.calculateTrimesterAverage(subjects);

    return {
      studentId,
      subjects,
      trimesterAverage,
      isAllAuthorized: allAuthorized && trimesterAverage.isComplete
    };
  }

  /**
   * Renderiza la pestaña de Captura Grupal (Etapa 5)
   */
  function renderCapturaGrupal() {
    const tableWrap = document.getElementById('evalGrupalTableWrap');
    if (!tableWrap) return;

    const students = getStudentsList();
    if (!students || students.length === 0) {
      tableWrap.innerHTML = '<p class="muted" style="padding: 24px; text-align: center;">No hay alumnos disponibles.</p>';
      return;
    }

    const t = evalState.trimester;
    const subview = evalState.grupalSubview || 'examenes';
    const searchQuery = (evalState.grupalSearch || '').trim().toLowerCase();
    const statusFilter = evalState.grupalStatusFilter || 'all';

    // Filtrar alumnos
    const filteredStudents = students.filter(s => {
      const num = resolveOfficialListNumber(s);
      const name = String(typeof fullName === 'function' ? fullName(s) : (s.apellidos ? `${s.apellidos} ${s.nombres || ''}` : s.nombre || '')).toLowerCase();
      
      // Búsqueda por texto o número
      if (searchQuery) {
        const matchesName = name.includes(searchQuery);
        const matchesNum = String(num) === searchQuery || `${num < 10 ? '0' + num : num}` === searchQuery;
        if (!matchesName && !matchesNum) return false;
      }

      // Filtro de estado
      if (statusFilter !== 'all') {
        const evalData = calculateStudentFullEvaluation(s.id, t);
        const anyPending = Object.values(evalData.subjects).some(sub => sub.hasPending || sub.status === 'INCOMPLETO' || sub.status === 'PRELIMINAR_CON_PENDIENTES');
        const anyAdjusted = Object.values(evalData.subjects).some(sub => sub.isAdjusted);
        const allAuth = evalData.isAllAuthorized;

        if (statusFilter === 'pending' && !anyPending) return false;
        if (statusFilter === 'authorized' && !allAuth) return false;
        if (statusFilter === 'adjusted' && !anyAdjusted) return false;
        if (statusFilter === 'calculated' && allAuth) return false;
      }

      return true;
    });

    // Actualizar botones de subvista activa
    document.querySelectorAll('[data-action="eval-set-grupal-subview"]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.subview === subview);
    });

    // Mostrar/ocultar controles de la barra de herramientas según la subvista
    const subjGroup = document.getElementById('evalGrupalSubjectFilterGroup');
    const desempCatGroup = document.getElementById('evalGrupalDesempenoCategoryGroup');
    const desempIndGroup = document.getElementById('evalGrupalDesempenoIndicatorGroup');
    const desempLvlGroup = document.getElementById('evalGrupalDesempenoLevelGroup');
    const modeGroup = document.getElementById('evalGrupalModeFilterGroup');
    const statusGroup = document.getElementById('evalGrupalStatusFilterGroup');
    const btnPaste = document.getElementById('evalBtnGrupalPaste');
    const btnAuth = document.getElementById('evalBtnGrupalAuth');
    const btnMsgBank = document.getElementById('evalBtnGrupalMsgBank');
    const btnMassDesemp = document.getElementById('evalBtnGrupalMassDesemp');

    if (subjGroup) subjGroup.style.display = (subview === 'criterios') ? 'flex' : 'none';
    if (desempCatGroup) desempCatGroup.style.display = (subview === 'desempeno') ? 'flex' : 'none';
    if (desempIndGroup) desempIndGroup.style.display = (subview === 'desempeno') ? 'flex' : 'none';
    if (desempLvlGroup) desempLvlGroup.style.display = (subview === 'desempeno') ? 'flex' : 'none';
    if (modeGroup) modeGroup.style.display = (subview === 'examenes' || subview === 'criterios' || subview === 'resumen') ? 'flex' : 'none';
    if (statusGroup) statusGroup.style.display = (subview !== 'desempeno' && subview !== 'mensajes') ? 'flex' : 'none';
    if (btnPaste) btnPaste.style.display = (subview === 'examenes' || subview === 'criterios' || subview === 'resumen') ? 'inline-flex' : 'none';
    if (btnAuth) btnAuth.style.display = (subview === 'examenes' || subview === 'criterios' || subview === 'resumen') ? 'inline-flex' : 'none';
    if (btnMsgBank) btnMsgBank.style.display = (subview === 'mensajes') ? 'inline-flex' : 'none';
    if (btnMassDesemp) btnMassDesemp.style.display = (subview === 'desempeno') ? 'inline-flex' : 'none';

    // Actualizar título y badge de estadísticas
    const titleEl = document.getElementById('evalGrupalMatrixTitle');
    const badgeEl = document.getElementById('evalGrupalStatsBadge');
    if (badgeEl) badgeEl.textContent = `${filteredStudents.length} de ${students.length} alumnos`;

    if (subview === 'examenes') {
      if (titleEl) titleEl.textContent = `Matriz de Exámenes Escritos · Trimestre ${t}`;
      renderMatrizExamenes(tableWrap, filteredStudents, t);
    } else if (subview === 'criterios') {
      const subj = evalState.grupalSubject || 'Lenguajes';
      if (titleEl) titleEl.textContent = `Calificaciones y Criterios: ${subj} · Trimestre ${t}`;
      renderMatrizCriterios(tableWrap, filteredStudents, subj, t);
    } else if (subview === 'resumen') {
      if (titleEl) titleEl.textContent = `Resumen General de Calificaciones · Trimestre ${t}`;
      renderMatrizResumen(tableWrap, filteredStudents, t);
    } else if (subview === 'desempeno') {
      if (titleEl) titleEl.textContent = `Matriz de Desempeño Integral (23 Indicadores) · Trimestre ${t}`;
      renderMatrizDesempeno(tableWrap, filteredStudents, t);
    } else if (subview === 'mensajes') {
      if (titleEl) titleEl.textContent = `Captura Grupal de Mensajes para el Portal Familiar · Trimestre ${t}`;
      renderMatrizMensajes(tableWrap, filteredStudents, t);
    }

    attachMatrixKeyboardNavigation(tableWrap);
  }

  /**
   * Vista A: Matriz de Exámenes Escritos
   */
  function renderMatrizExamenes(container, studentsList, trimester) {
    const t = trimester;

    let html = `
      <table class="eval-tracking-table eval-matrix-table" id="evalMatrixTable">
        <thead>
          <tr>
            <th class="eval-sticky-col" style="width: 50px; text-align: center;">No.</th>
            <th class="eval-sticky-col" style="min-width: 200px;">Nombre del alumno</th>
            <th style="text-align: center; width: 110px;">Lenguajes</th>
            <th style="text-align: center; width: 110px;">Saberes</th>
            <th style="text-align: center; width: 110px;">Ética</th>
            <th style="text-align: center; width: 110px;">De lo Humano</th>
            <th style="text-align: center; width: 120px;">Estado de captura</th>
          </tr>
        </thead>
        <tbody id="evalGrupalTableBody">
    `;

    studentsList.forEach((s, rowIdx) => {
      const num = resolveOfficialListNumber(s);
      const name = s.apellidos ? `${s.apellidos} ${s.nombres || ''}` : (s.nombre || 'Alumno');
      const evalData = calculateStudentFullEvaluation(s.id, t);

      let capturedCount = 0;

      const cellInputsHtml = EVAL_FIELDS.map((field, colIdx) => {
        const fieldData = getStudentFieldData(s.id, field, t);
        const val = fieldData.manualExam !== null && fieldData.manualExam !== undefined ? fieldData.manualExam : '';
        if (val !== '') capturedCount++;
        const isAuth = fieldData.isAuthorized;

        let cellClass = 'eval-cell-input';
        if (val === '') cellClass += ' cell-empty';
        else if (Number(val) === 0) cellClass += ' cell-zero';
        else if (isAuth) cellClass += ' cell-authorized';

        return `
          <td style="text-align: center;">
            <input type="number" step="0.1" min="0" max="10" 
                   class="${cellClass}" 
                   value="${val}" 
                   placeholder="—"
                   data-student-id="${s.id}" 
                   data-field="${field}"
                   data-row="${rowIdx}" 
                   data-col="${colIdx}"
                   title="${field}: ${val !== '' ? val : 'Pendiente de examen'}">
          </td>
        `;
      }).join('');

      let statusBadge = '<span class="eval-status-pill status-pending" style="font-size: 11px;">Pendiente</span>';
      if (capturedCount === 4) {
        statusBadge = '<span class="eval-status-pill status-completed" style="font-size: 11px;">4 exámenes ✓</span>';
      } else if (capturedCount > 0) {
        statusBadge = `<span class="eval-status-pill status-review" style="font-size: 11px;">${capturedCount} de 4</span>`;
      }

      html += `
        <tr>
          <td class="eval-sticky-col" style="text-align: center; font-weight: 800; color: var(--navy);">${num < 10 ? '0' + num : num}</td>
          <td class="eval-sticky-col" style="font-weight: 700; color: var(--navy);">${name}</td>
          ${cellInputsHtml}
          <td style="text-align: center;">${statusBadge}</td>
        </tr>
      `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
  }

  /**
   * Vista B: Matriz de Calificaciones y Criterios por Campo Formativo
   */
  function renderMatrizCriterios(container, studentsList, subject, trimester) {
    const t = trimester;
    const cfg = evalState.config;
    const pcts = cfg.porcentajes?.[t] || {};

    const activeCriteria = CRITERIOS_CATALOGO.filter(c => (pcts[c.id] || 0) > 0);

    let html = `
      <table class="eval-tracking-table eval-matrix-table" id="evalMatrixTable">
        <thead>
          <tr>
            <th class="eval-sticky-col" style="width: 50px; text-align: center;">No.</th>
            <th class="eval-sticky-col" style="min-width: 200px;">Nombre del alumno</th>
            <th style="text-align: center; width: 90px;">Modalidad</th>
            ${activeCriteria.map(c => `<th style="text-align: center; min-width: 90px;" title="${c.desc}">${c.nombre} (${pcts[c.id]}%)</th>`).join('')}
            <th style="text-align: center; width: 95px;">Calculada</th>
            <th style="text-align: center; width: 95px;">Autorizada</th>
            <th style="text-align: center; width: 100px;">Estado</th>
          </tr>
        </thead>
        <tbody id="evalGrupalTableBody">
    `;

    studentsList.forEach((s, rowIdx) => {
      const num = resolveOfficialListNumber(s);
      const name = s.apellidos ? `${s.apellidos} ${s.nombres || ''}` : (s.nombre || 'Alumno');
      const evalData = calculateStudentFullEvaluation(s.id, t);
      const sub = evalData.subjects[subject];
      const fieldData = sub.fieldData;

      const criteriaCells = activeCriteria.map((c, colIdx) => {
        const item = sub.breakdown?.[c.id];
        let valDisplay = '—';
        if (c.id === 'examen') {
          const exVal = fieldData.manualExam !== null && fieldData.manualExam !== undefined ? fieldData.manualExam : '';
          return `
            <td style="text-align: center;">
              <input type="number" step="0.1" min="0" max="10" 
                     class="eval-cell-input ${exVal === '' ? 'cell-empty' : ''}" 
                     value="${exVal}" 
                     placeholder="—"
                     data-student-id="${s.id}" 
                     data-field="${subject}"
                     data-row="${rowIdx}" 
                     data-col="${colIdx}"
                     title="Examen: ${exVal}">
            </td>
          `;
        }
        if (item && item.result && item.result.score !== null) {
          valDisplay = `${EvaluacionEngine.formatGrade(item.result.score / 10)}`;
        }
        return `<td style="text-align: center; font-size: 13px; font-weight: 600;">${valDisplay}</td>`;
      }).join('');

      let statusPill = '<span class="eval-status-pill status-pending" style="font-size: 11px;">Incompleto</span>';
      if (sub.isAuthorized) {
        statusPill = '<span class="eval-status-pill status-completed" style="font-size: 11px;">Autorizado ✓</span>';
      } else if (sub.isComplete) {
        statusPill = '<span class="eval-status-pill status-review" style="font-size: 11px;">Calculado</span>';
      }

      html += `
        <tr>
          <td class="eval-sticky-col" style="text-align: center; font-weight: 800; color: var(--navy);">${num < 10 ? '0' + num : num}</td>
          <td class="eval-sticky-col" style="font-weight: 700; color: var(--navy);">${name}</td>
          <td style="text-align: center;">
            <span class="badge" style="font-size: 10px; text-transform: uppercase;">${fieldData.mode}</span>
          </td>
          ${criteriaCells}
          <td style="text-align: center; font-weight: 800; color: var(--navy);">${sub.displayGrade}</td>
          <td style="text-align: center; font-weight: 800; color: var(--teal);">${sub.isAuthorized ? EvaluacionEngine.formatGrade(sub.authorizedGrade) : '—'}</td>
          <td style="text-align: center;">${statusPill}</td>
        </tr>
      `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
  }

  /**
   * Vista C: Matriz de Resumen General
   */
  function renderMatrizResumen(container, studentsList, trimester) {
    const t = trimester;

    let html = `
      <table class="eval-tracking-table eval-matrix-table" id="evalMatrixTable">
        <thead>
          <tr>
            <th class="eval-sticky-col" style="width: 50px; text-align: center;">No.</th>
            <th class="eval-sticky-col" style="min-width: 200px;">Nombre del alumno</th>
            <th style="text-align: center; width: 95px;">Lenguajes</th>
            <th style="text-align: center; width: 95px;">Saberes</th>
            <th style="text-align: center; width: 95px;">Ética</th>
            <th style="text-align: center; width: 95px;">De lo Humano</th>
            <th style="text-align: center; width: 110px;">Promedio Trim.</th>
            <th style="text-align: center; width: 110px;">Estado</th>
            <th style="text-align: center; width: 90px;">Acción</th>
          </tr>
        </thead>
        <tbody id="evalGrupalTableBody">
    `;

    studentsList.forEach(s => {
      const num = resolveOfficialListNumber(s);
      const name = s.apellidos ? `${s.apellidos} ${s.nombres || ''}` : (s.nombre || 'Alumno');
      const evalData = calculateStudentFullEvaluation(s.id, t);
      const avg = evalData.trimesterAverage;

      const subCells = EVAL_FIELDS.map(f => {
        const sub = evalData.subjects[f];
        const gradeText = sub.isAuthorized ? EvaluacionEngine.formatGrade(sub.authorizedGrade) : sub.displayGrade;
        const color = sub.isAuthorized ? '#1b7c4b' : (sub.isAdjusted ? '#a46d00' : 'var(--navy)');
        return `<td style="text-align: center; font-weight: 800; color: ${color};">${gradeText}</td>`;
      }).join('');

      let statusBadge = '<span class="eval-status-pill status-pending" style="font-size: 11px;">Pendiente</span>';
      if (evalData.isAllAuthorized) {
        statusBadge = '<span class="eval-status-pill status-completed" style="font-size: 11px;">Autorizado ✓</span>';
      } else if (avg.isComplete) {
        statusBadge = '<span class="eval-status-pill status-review" style="font-size: 11px;">Completo</span>';
      }

      html += `
        <tr>
          <td class="eval-sticky-col" style="text-align: center; font-weight: 800; color: var(--navy);">${num < 10 ? '0' + num : num}</td>
          <td class="eval-sticky-col" style="font-weight: 700; color: var(--navy);">${name}</td>
          ${subCells}
          <td style="text-align: center; font-weight: 900; color: var(--teal); font-size: 15px;">${avg.displayAverage}</td>
          <td style="text-align: center;">${statusBadge}</td>
          <td style="text-align: center;">
            <button class="btn small" data-action="eval-open-individual" data-student-id="${s.id}" title="Abrir captura individual de este alumno">
              Abrir
            </button>
          </td>
        </tr>
      `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
  }

  /**
   * Conecta eventos de teclado en la matriz de captura rápida
   */
  function attachMatrixKeyboardNavigation(container) {
    const inputs = container.querySelectorAll('.eval-cell-input');
    inputs.forEach(input => {
      // Selección instantánea de texto al enfocar
      input.addEventListener('focus', () => input.select());

      // Navegación por teclado
      input.addEventListener('keydown', e => {
        const r = parseInt(input.dataset.row, 10);
        const c = parseInt(input.dataset.col, 10);

        let targetR = r;
        let targetC = c;

        if (e.key === 'Enter' || e.key === 'ArrowDown') {
          e.preventDefault();
          targetR = e.shiftKey ? r - 1 : r + 1;
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          targetR = r - 1;
        } else if (e.key === 'Tab' || e.key === 'ArrowRight') {
          if (e.key === 'Tab') e.preventDefault();
          targetC = e.shiftKey ? c - 1 : c + 1;
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          targetC = c - 1;
        } else {
          return;
        }

        const nextInput = container.querySelector(`[data-row="${targetR}"][data-col="${targetC}"]`);
        if (nextInput) {
          nextInput.focus();
        }
      });

      // Guardar cambio en celda
      input.addEventListener('change', () => {
        const studentId = input.dataset.studentId;
        const field = input.dataset.field;
        const val = input.value.trim();

        if (val === '') {
          setStudentFieldData(studentId, field, { manualExam: null });
          input.className = 'eval-cell-input cell-empty';
        } else {
          const num = Number(val);
          if (isNaN(num) || num < 0 || num > 10) {
            if (typeof toast === 'function') toast('La calificación debe ser un número entre 0 y 10.');
            input.value = '';
            setStudentFieldData(studentId, field, { manualExam: null });
            input.className = 'eval-cell-input cell-empty';
          } else {
            setStudentFieldData(studentId, field, { manualExam: num });
            input.className = 'eval-cell-input' + (num === 0 ? ' cell-zero' : '');
          }
        }
      });
    });
  }

  /**
   * Renderiza la pestaña de Captura Individual (Etapa 5)
   */
  function renderCapturaIndividual() {
    const students = getStudentsList();
    if (!students || students.length === 0) return;

    const sortedStudents = [...students].sort((a, b) => resolveOfficialListNumber(a) - resolveOfficialListNumber(b));
    const currentId = evalState.indStudentId || evalState.selectedStudentId || sortedStudents[0]?.id;
    evalState.indStudentId = currentId;

    const student = sortedStudents.find(s => String(s.id) === String(currentId)) || sortedStudents[0];
    if (!student) return;

    const num = resolveOfficialListNumber(student);
    const fullNameText = student.apellidos ? `${student.apellidos} ${student.nombres || ''}` : (student.nombre || 'Alumno');

    // 1. Selector de Alumno en la barra de navegación
    const selEl = document.getElementById('evalIndStudentSelect');
    if (selEl) {
      selEl.innerHTML = sortedStudents.map(s => {
        const sNum = resolveOfficialListNumber(s);
        const sName = s.apellidos ? `${s.apellidos} ${s.nombres || ''}` : (s.nombre || 'Alumno');
        const isSel = String(s.id) === String(student.id);
        return `<option value="${s.id}" ${isSel ? 'selected' : ''}>${sNum < 10 ? '0' + sNum : sNum}. ${sName}</option>`;
      }).join('');
    }

    // 2. Barra de perfil del alumno
    const profileBar = document.getElementById('evalIndStudentProfileBar');
    const t = evalState.trimester;
    const evalData = calculateStudentFullEvaluation(student.id, t);

    if (profileBar) {
      profileBar.innerHTML = `
        <div>
          <h3 style="margin: 0; font-size: 16px; color: var(--navy);">${num < 10 ? '0' + num : num}. ${fullNameText}</h3>
          <span class="muted" style="font-size: 12px;">Lista # ${num} · Matrícula / CURP: ${student.curp || student.matricula || student.id}</span>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <span class="eval-status-pill ${evalData.isAllAuthorized ? 'status-completed' : 'status-pending'}">
            ${evalData.isAllAuthorized ? 'Evaluación autorizada ✓' : 'En proceso de captura'}
          </span>
          <span class="badge">Trimestre ${t}</span>
        </div>
      `;
    }

    // 3. Grid de los 4 campos formativos en el Subtab Académico
    const gridEl = document.getElementById('evalIndSubjectsGrid');
    if (gridEl) {
      gridEl.innerHTML = EVAL_FIELDS.map(field => {
        const sub = evalData.subjects[field];
        const fieldData = sub.fieldData;
        const examVal = fieldData.manualExam !== null && fieldData.manualExam !== undefined ? fieldData.manualExam : '';
        const isAuth = sub.isAuthorized;

        return `
          <div class="eval-ind-subject-card">
            <div class="eval-ind-subject-header">
              <div>
                <h4 style="margin: 0; font-size: 15px; color: var(--navy);">${field}</h4>
                <span class="muted" style="font-size: 11px;">Modalidad: ${fieldData.mode.toUpperCase()}</span>
              </div>
              <span class="eval-status-pill ${isAuth ? 'status-completed' : (sub.isComplete ? 'status-review' : 'status-pending')}" style="font-size: 11px;">
                ${isAuth ? 'Autorizada ✓' : (sub.isComplete ? 'Calculada' : 'Pendiente')}
              </span>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: baseline; margin: 6px 0;">
              <div>
                <span style="font-size: 11px; color: var(--muted); display: block;">Calificación</span>
                <b style="font-size: 28px; color: ${isAuth ? '#1b7c4b' : 'var(--teal)'}; font-weight: 900;">
                  ${isAuth ? EvaluacionEngine.formatGrade(sub.authorizedGrade) : sub.displayGrade}
                </b>
              </div>
              <div style="text-align: right;">
                <label for="evalIndExam_${student.id}_${field}" style="font-size: 11px; font-weight: 700; color: var(--muted); display: block;">Examen escrito:</label>
                <input type="number" step="0.1" min="0" max="10" 
                       id="evalIndExam_${student.id}_${field}"
                       class="eval-cell-input ${examVal === '' ? 'cell-empty' : ''}" 
                       value="${examVal}" 
                       placeholder="—"
                       data-action="eval-ind-exam-change" 
                       data-student-id="${student.id}" 
                       data-field="${field}">
              </div>
            </div>

            <div style="display: flex; gap: 8px; justify-content: space-between; align-items: center; padding-top: 8px; border-top: 1px solid var(--line);">
              <span class="muted" style="font-size: 11px;">${sub.isAdjusted ? 'Con ajuste docente' : 'Cálculo automático'}</span>
              <button class="btn small ${isAuth ? '' : 'primary'}" 
                      data-action="eval-authorize-subject" 
                      data-student-id="${student.id}" 
                      data-field="${field}" 
                      title="${isAuth ? 'Calificación autorizada' : 'Autorizar calificación definitiva'}">
                ${isAuth ? '✓ Autorizada' : 'Autorizar campo'}
              </button>
            </div>
          </div>
        `;
      }).join('');

      // Escuchar cambios en los inputs de examen de la captura individual
      gridEl.querySelectorAll('[data-action="eval-ind-exam-change"]').forEach(inp => {
        inp.addEventListener('change', () => {
          const sId = inp.dataset.studentId;
          const f = inp.dataset.field;
          const val = inp.value.trim();
          const numVal = val === '' ? null : Number(val);
          if (numVal !== null && (isNaN(numVal) || numVal < 0 || numVal > 10)) {
            if (typeof toast === 'function') toast('La calificación debe estar entre 0 y 10.');
            inp.value = '';
            setStudentFieldData(sId, f, { manualExam: null });
          } else {
            setStudentFieldData(sId, f, { manualExam: numVal });
          }
          renderCapturaIndividual();
        });
      });
    }

    // 4. Promedio general trimestral
    const avgDisplay = document.getElementById('evalIndTrimesterAvgDisplay');
    const avgStatus = document.getElementById('evalIndTrimesterAvgStatus');
    if (avgDisplay) {
      avgDisplay.textContent = evalData.isAllAuthorized 
        ? evalData.trimesterAverage.displayAverage 
        : (evalData.trimesterAverage.isComplete ? `${evalData.trimesterAverage.displayAverage} (Preliminar)` : '—');
    }
    if (avgStatus) {
      avgStatus.textContent = evalData.isAllAuthorized 
        ? '(Definitivo y autorizado)' 
        : (evalData.trimesterAverage.isComplete ? '(Pendiente de autorización)' : '(Requiere autorizar los 4 campos)');
    }

    // 5. Resumen consolidado del alumno en Subtab 4
    const summaryPanel = document.getElementById('evalIndSummaryPanel');
    if (summaryPanel) {
      summaryPanel.innerHTML = `
        <div class="section-head">
          <h3>Resumen del Alumno · Trimestre ${t}</h3>
          <span class="badge">${fullNameText}</span>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-top: 14px;">
          <div class="eval-stat-card"><span>Lenguajes</span><b>${evalData.subjects['Lenguajes'].displayGrade}</b></div>
          <div class="eval-stat-card"><span>Saberes y Pensamiento</span><b>${evalData.subjects['Saberes y Pensamiento Científico'].displayGrade}</b></div>
          <div class="eval-stat-card"><span>Ética y Naturaleza</span><b>${evalData.subjects['Ética, Naturaleza y Sociedades'].displayGrade}</b></div>
          <div class="eval-stat-card"><span>De lo Humano</span><b>${evalData.subjects['De lo Humano y lo Comunitario'].displayGrade}</b></div>
        </div>
      `;
    }

    // 6. Activar el subtab seleccionado (académicas, desempeño, mensaje, resumen)
    const curSubtab = evalState.indSubtab || 'academicas';
    const subtabsMap = {
      academicas: 'evalIndSubtabAcademicas',
      desempeno: 'evalIndSubtabDesempeno',
      mensaje: 'evalIndSubtabMensaje',
      resumen: 'evalIndSubtabResumen'
    };

    Object.entries(subtabsMap).forEach(([k, id]) => {
      const pane = document.getElementById(id);
      if (pane) {
        pane.classList.toggle('active', k === curSubtab);
        pane.classList.toggle('hidden-tab', k !== curSubtab);
      }
    });

    document.querySelectorAll('.eval-ind-subtab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.subtab === curSubtab);
    });

    // Renderizar contenidos específicos del subtab activo (Etapa 6)
    if (curSubtab === 'desempeno') {
      renderDesempenoIndividual(student, t);
    } else if (curSubtab === 'mensaje') {
      renderMensajeIndividual(student, t);
    } else if (curSubtab === 'resumen') {
      renderResumenIndividual(student, t);
    }
  }

  // =========================================================================
  // MOTOR DE DESEMPEÑO INTEGRAL Y MENSAJES PERSONALIZADOS (ETAPA 6)
  // =========================================================================

  const DesempenoEngine = {
    INDICADORES: INDICADORES_DESEMPENO,
    CATEGORIAS: CATEGORIAS_DESEMPENO,
    NIVELES: NIVELES_DESEMPENO,

    getStudentEvaluation(studentId, trimester = evalState.trimester) {
      const t = trimester;
      const sId = String(studentId);
      const studentStore = evalState.desempenoStore?.[t]?.[sId] || { ratings: {}, source: 'manual', isReviewed: true };
      const ratings = studentStore.ratings || {};

      let completedCount = 0;
      const pendingIndicators = [];
      const distribution = { E: 0, B: 0, R: 0, A: 0, none: 0 };

      INDICADORES_DESEMPENO.forEach(ind => {
        const val = ratings[ind.id] || null;
        if (val && NIVELES_DESEMPENO[val]) {
          completedCount++;
          distribution[val]++;
        } else {
          pendingIndicators.push(ind.id);
          distribution.none++;
        }
      });

      const isComplete = (completedCount === 23);

      return {
        ratings,
        completedCount,
        pendingCount: 23 - completedCount,
        isComplete,
        distribution,
        pendingIndicators,
        source: studentStore.source || 'manual',
        isReviewed: studentStore.isReviewed !== false,
        updatedAt: studentStore.updatedAt || null
      };
    },

    setIndicatorRating(studentId, indicatorId, rating, trimester = evalState.trimester) {
      const t = trimester;
      const sId = String(studentId);
      if (!evalState.desempenoStore[t]) evalState.desempenoStore[t] = {};
      if (!evalState.desempenoStore[t][sId]) {
        evalState.desempenoStore[t][sId] = { ratings: {}, source: 'manual', isReviewed: true };
      }

      if (rating === null || rating === '' || rating === 'none') {
        delete evalState.desempenoStore[t][sId].ratings[indicatorId];
      } else if (NIVELES_DESEMPENO[rating]) {
        evalState.desempenoStore[t][sId].ratings[indicatorId] = rating;
      }
      evalState.desempenoStore[t][sId].updatedAt = new Date().toISOString();
      markUnsavedDesempeno();
    },

    setCategoryRating(studentId, category, rating, onlyPending = false, trimester = evalState.trimester) {
      const t = trimester;
      const sId = String(studentId);
      if (!evalState.desempenoStore[t]) evalState.desempenoStore[t] = {};
      if (!evalState.desempenoStore[t][sId]) {
        evalState.desempenoStore[t][sId] = { ratings: {}, source: 'manual', isReviewed: true };
      }

      evalState.lastDesempenoUndo = {
        studentId: sId,
        trimester: t,
        ratings: { ...evalState.desempenoStore[t][sId].ratings }
      };

      const catIndicators = INDICADORES_DESEMPENO.filter(i => i.categoria === category);
      catIndicators.forEach(ind => {
        const cur = evalState.desempenoStore[t][sId].ratings[ind.id];
        if (onlyPending) {
          if (!cur) evalState.desempenoStore[t][sId].ratings[ind.id] = rating;
        } else {
          evalState.desempenoStore[t][sId].ratings[ind.id] = rating;
        }
      });
      evalState.desempenoStore[t][sId].updatedAt = new Date().toISOString();
      markUnsavedDesempeno();
    },

    setGeneralRating(studentId, rating, onlyPending = false, trimester = evalState.trimester) {
      const t = trimester;
      const sId = String(studentId);
      if (!evalState.desempenoStore[t]) evalState.desempenoStore[t] = {};
      if (!evalState.desempenoStore[t][sId]) {
        evalState.desempenoStore[t][sId] = { ratings: {}, source: 'manual', isReviewed: true };
      }

      evalState.lastDesempenoUndo = {
        studentId: sId,
        trimester: t,
        ratings: { ...evalState.desempenoStore[t][sId].ratings }
      };

      INDICADORES_DESEMPENO.forEach(ind => {
        const cur = evalState.desempenoStore[t][sId].ratings[ind.id];
        if (onlyPending) {
          if (!cur) evalState.desempenoStore[t][sId].ratings[ind.id] = rating;
        } else {
          evalState.desempenoStore[t][sId].ratings[ind.id] = rating;
        }
      });
      evalState.desempenoStore[t][sId].updatedAt = new Date().toISOString();
      markUnsavedDesempeno();
    },

    setGroupIndicatorRating(studentIds, indicatorId, rating, trimester = evalState.trimester) {
      const t = trimester;
      studentIds.forEach(sId => {
        this.setIndicatorRating(sId, indicatorId, rating, t);
      });
    },

    undoLastOperation(studentId, trimester = evalState.trimester) {
      const t = trimester;
      const sId = String(studentId);
      if (evalState.lastDesempenoUndo && 
          String(evalState.lastDesempenoUndo.studentId) === sId && 
          evalState.lastDesempenoUndo.trimester === t) {
        if (!evalState.desempenoStore[t]) evalState.desempenoStore[t] = {};
        if (!evalState.desempenoStore[t][sId]) evalState.desempenoStore[t][sId] = { ratings: {} };
        evalState.desempenoStore[t][sId].ratings = { ...evalState.lastDesempenoUndo.ratings };
        evalState.lastDesempenoUndo = null;
        markUnsavedDesempeno();
        return true;
      }
      return false;
    },

    copyFromTrimester(studentId, fromTrimester, toTrimester = evalState.trimester, onlyPending = false) {
      const sId = String(studentId);
      const sourceData = evalState.desempenoStore?.[fromTrimester]?.[sId]?.ratings || {};
      const sourceKeys = Object.keys(sourceData).filter(k => Boolean(sourceData[k]));
      if (sourceKeys.length === 0) {
        return { success: false, copiedCount: 0, reason: 'El trimestre de origen no tiene valoraciones capturadas.' };
      }

      if (!evalState.desempenoStore[toTrimester]) evalState.desempenoStore[toTrimester] = {};
      if (!evalState.desempenoStore[toTrimester][sId]) {
        evalState.desempenoStore[toTrimester][sId] = { ratings: {}, source: 'manual', isReviewed: true };
      }

      let copiedCount = 0;
      INDICADORES_DESEMPENO.forEach(ind => {
        const srcVal = sourceData[ind.id];
        const tgtVal = evalState.desempenoStore[toTrimester][sId].ratings[ind.id];
        if (srcVal) {
          if (onlyPending) {
            if (!tgtVal) {
              evalState.desempenoStore[toTrimester][sId].ratings[ind.id] = srcVal;
              copiedCount++;
            }
          } else {
            evalState.desempenoStore[toTrimester][sId].ratings[ind.id] = srcVal;
            copiedCount++;
          }
        }
      });

      evalState.desempenoStore[toTrimester][sId].source = `copia_t${fromTrimester}`;
      evalState.desempenoStore[toTrimester][sId].isReviewed = false;
      evalState.desempenoStore[toTrimester][sId].updatedAt = new Date().toISOString();
      markUnsavedDesempeno();

      return { success: true, copiedCount };
    },

    validateMessageText(text) {
      if (!text || typeof text !== 'string') {
        return { isValid: false, charCount: 0, isOverLimit: false, isEmpty: true };
      }
      const trim = text.trim();
      const count = text.length;
      const isOver = count > 245;
      const isEmpty = trim.length === 0;
      return {
        isValid: (!isEmpty && !isOver),
        charCount: count,
        isOverLimit: isOver,
        isEmpty
      };
    },

    getStudentMessage(studentId, trimester = evalState.trimester) {
      const t = trimester;
      const sId = String(studentId);
      const data = evalState.mensajesStore?.[t]?.[sId] || { message: '', templateId: null, updatedAt: null };
      const valRes = this.validateMessageText(data.message);
      return {
        message: data.message || '',
        templateId: data.templateId || null,
        charCount: valRes.charCount,
        isValid: valRes.isValid,
        isOverLimit: valRes.isOverLimit,
        isEmpty: valRes.isEmpty,
        isComplete: valRes.isValid,
        updatedAt: data.updatedAt
      };
    },

    setStudentMessage(studentId, message, trimester = evalState.trimester, templateId = null) {
      const t = trimester;
      const sId = String(studentId);
      if (!evalState.mensajesStore[t]) evalState.mensajesStore[t] = {};
      evalState.mensajesStore[t][sId] = {
        message: String(message || ''),
        templateId: templateId || null,
        updatedAt: new Date().toISOString()
      };
      markUnsavedMensaje();
    },

    setGroupMessage(studentIds, message, trimester = evalState.trimester) {
      studentIds.forEach(sId => {
        this.setStudentMessage(sId, message, trimester);
      });
    },

    getBancoMensajes() {
      return evalState.bancoMensajesStore || BANCO_MENSAJES_DEFAULT;
    },

    normalizeDraftRatings(ratings) {
      if (!ratings || typeof ratings !== 'object') return { cleanRatings: {}, legacyRatings: {}, hasUnknown: false, requiresReview: false };
      const cleanRatings = {};
      const legacyRatings = {};
      let hasUnknown = false;
      const validIds = new Set(INDICADORES_DESEMPENO.map(i => i.id));

      // Mapeo canónico explícito entre identificadores de etapas previas y los 23 oficiales aprobados
      const CANONICAL_MAPPING = {
        ind_01_lectura_comprension: 'acad_lectura',
        ind_02_escritura_ortografia: 'acad_escritura',
        ind_03_habilidades_matematicas: 'acad_matematicas',
        ind_04_comprension_contenidos: 'acad_contenidos',
        ind_05_cumplimiento_tareas: 'hab_tareas',
        ind_06_finalizacion_actividades: 'hab_actividades',
        ind_07_entrega_trabajos_completos: 'hab_completos',
        ind_08_materiales_escolares_completos: 'hab_materiales',
        ind_09_limpieza_presentacion_trabajos: 'hab_limpieza',
        ind_10_seguimiento_indicaciones: 'hab_indicaciones',
        ind_11_organizacion_autonomia: 'hab_autonomia',
        ind_12_atencion_concentracion: 'hab_concentracion',
        ind_13_participacion_activa: 'hab_participacion',
        ind_14_respeto_companeros: 'cond_companeros',
        ind_15_respeto_docente: 'cond_docente',
        ind_16_cumplimiento_acuerdos: 'cond_acuerdos',
        ind_17_autorregulacion_emocional_conductual: 'cond_autorregulacion',
        ind_18_resolucion_pacifica_conflictos: 'cond_conflictos',
        ind_19_trabajo_colaborativo: 'cond_colaborativo',
        ind_20_actitud_disposicion_aprender: 'cond_actitud',
        ind_21_cuidado_mobiliario_escolar: 'cond_mobiliario',
        ind_22_asistencia_regular: 'asis_regular',
        ind_23_puntualidad: 'asis_puntualidad'
      };

      for (const [k, v] of Object.entries(ratings)) {
        if (!NIVELES_DESEMPENO[v]) continue;

        if (validIds.has(k)) {
          cleanRatings[k] = v;
        } else if (CANONICAL_MAPPING[k] && validIds.has(CANONICAL_MAPPING[k])) {
          cleanRatings[CANONICAL_MAPPING[k]] = v;
        } else {
          // Conceptos no reconocidos, modificados o retirados se conservan como datos legados
          hasUnknown = true;
          legacyRatings[k] = v;
        }
      }

      return {
        cleanRatings,
        legacyRatings,
        hasUnknown,
        requiresReview: hasUnknown
      };
    },

    confirmReview(studentId, trimester = evalState.trimester) {
      const sId = String(studentId);
      const t = trimester;
      if (evalState.desempenoStore?.[t]?.[sId]) {
        evalState.desempenoStore[t][sId].isReviewed = true;
        evalState.desempenoStore[t][sId].requiresReview = false;
        evalState.desempenoStore[t][sId].updatedAt = new Date().toISOString();
        markUnsavedDesempeno();
        return true;
      }
      return false;
    },

    approveBancoMessage(id) {
      const bank = this.getBancoMensajes();
      const item = bank.find(m => m.id === id);
      if (item) {
        item.approved = true;
        item.status = 'aprobada';
        item.updatedAt = new Date().toISOString();
        saveBancoMensajesStore(bank);
        return true;
      }
      return false;
    },

    toggleBancoMessageActive(id) {
      const bank = this.getBancoMensajes();
      const item = bank.find(m => m.id === id);
      if (item) {
        item.active = !item.active;
        item.updatedAt = new Date().toISOString();
        saveBancoMensajesStore(bank);
        return item.active;
      }
      return false;
    },

    importBancoMensajes(newItems, replace = false) {
      if (!Array.isArray(newItems)) return { success: false, count: 0 };
      const validItems = [];
      for (const raw of newItems) {
        if (!raw.text || typeof raw.text !== 'string') continue;
        const text = raw.text.trim();
        if (text.length > 245) continue;
        validItems.push({
          id: raw.id || 'rec_imp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          category: raw.category || 'general',
          level: raw.level || 'E',
          text,
          approved: Boolean(raw.approved),
          status: raw.approved ? 'aprobada' : 'propuesta',
          active: raw.active !== false,
          createdAt: raw.createdAt || new Date().toISOString()
        });
      }
      if (replace) {
        evalState.bancoMensajesStore = validItems;
      } else {
        const current = evalState.bancoMensajesStore || [...BANCO_MENSAJES_DEFAULT];
        evalState.bancoMensajesStore = [...current, ...validItems];
      }
      saveBancoMensajesStore(evalState.bancoMensajesStore);
      return { success: true, count: validItems.length };
    },

    updateBancoMessage(id, updates) {
      const bank = this.getBancoMensajes();
      const idx = bank.findIndex(m => m.id === id);
      if (idx !== -1) {
        // Si se modifica el texto de una recomendación previamente aprobada, requerir nueva revisión docente
        const textChanged = updates.text !== undefined && updates.text.trim() !== (bank[idx].text || '').trim();
        const newApproved = textChanged ? false : (updates.approved !== undefined ? Boolean(updates.approved) : bank[idx].approved);
        const newStatus = textChanged ? 'propuesta' : (updates.status || (newApproved ? 'aprobada' : 'propuesta'));

        bank[idx] = {
          ...bank[idx],
          ...updates,
          approved: newApproved,
          status: newStatus,
          updatedAt: new Date().toISOString()
        };
        saveBancoMensajesStore(bank);
        return true;
      }
      return false;
    },

    addBancoMessage(msgObj) {
      const bank = this.getBancoMensajes();
      const newId = 'rec_' + Date.now();
      const newItem = {
        id: newId,
        category: msgObj.category || 'general',
        level: msgObj.level || 'E',
        text: (msgObj.text || '').slice(0, 245),
        approved: false,
        status: 'propuesta',
        active: true,
        isCustom: true
      };
      bank.push(newItem);
      saveBancoMensajesStore(bank);
      return newItem;
    },

    saveDrafts() {
      saveDesempenoStore();
      saveMensajesStore();
    },

    loadDesempenoStore: () => loadDesempenoStore(),
    loadMensajesStore: () => loadMensajesStore(),
    hasUnsavedChanges: () => Boolean(evalState.hasUnsavedDesempeno || evalState.hasUnsavedMensajes),

    getStudentOverallStatus(studentId, trimester = evalState.trimester) {
      const t = trimester;
      const sId = String(studentId);
      const evalData = calculateStudentFullEvaluation(sId, t);
      const desempeno = this.getStudentEvaluation(sId, t);
      const msg = this.getStudentMessage(sId, t);

      const isReviewed = desempeno.isReviewed !== false && desempeno.requiresReview !== true;
      const isAcademicAuth = Boolean(evalData && evalData.isAllAuthorized);
      const isDesempDone = Boolean(desempeno && desempeno.isComplete && isReviewed);
      const isMsgValid = Boolean(msg && msg.isValid);

      const isReadyToClose = isAcademicAuth && isDesempDone && isMsgValid;
      const hasAnyData = (evalData && evalData.subjects && Object.values(evalData.subjects).some(s => s.finalGrade !== null)) || 
                         desempeno.completedCount > 0 || 
                         !msg.isEmpty;

      let code = 'pendiente';
      let label = 'Pendiente';
      let badgeClass = 'status-pending';

      if (isReadyToClose) {
        code = 'ready_to_close';
        label = 'Lista para cerrar';
        badgeClass = 'status-ready';
      } else if (hasAnyData) {
        code = 'incompleta';
        label = 'Incompleta';
        badgeClass = 'status-incomplete';
      }

      return {
        code,
        label,
        badgeClass,
        isReadyToClose,
        isAcademicAuth,
        isDesempDone,
        isMsgValid,
        isReviewed,
        requiresReview: !isReviewed,
        academicAverage: evalData.trimesterAverage?.displayAverage || '—'
      };
    },

    calculateTrackingMetrics(trimester = evalState.trimester) {
      const t = trimester;
      const students = getStudentsList();
      let academicComplete = 0;
      let desempenoComplete = 0;
      let messagesComplete = 0;
      let readyToClose = 0;
      let incomplete = 0;
      let pending = 0;

      students.forEach(s => {
        const st = this.getStudentOverallStatus(s.id, t);
        if (st.isAcademicAuth) academicComplete++;
        if (st.isDesempDone) desempenoComplete++;
        if (st.isMsgValid) messagesComplete++;
        if (st.isReadyToClose) readyToClose++;
        else if (st.code === 'incompleta') incomplete++;
        else pending++;
      });

      return {
        total: students.length,
        academicComplete,
        desempenoComplete,
        messagesComplete,
        readyToClose,
        incomplete,
        pending
      };
    }
  };

  // =========================================================================
  // MOTOR DE PERSISTENCIA Y SINCRONIZACIÓN REMOTA (ETAPA 7A)
  // =========================================================================

  const EvalSyncEngine = {
    STATUS: {
      SIN_GUARDAR: 'sin_guardar',
      BORRADOR_LOCAL: 'borrador_local',
      PENDIENTE_SYNC: 'pendiente_sync',
      SINCRONIZANDO: 'sincronizando',
      GUARDADO_SERVIDOR: 'guardado_servidor',
      SIMULACION_LOCAL: 'simulacion_local',
      ERROR_SYNC: 'error_sync',
      CONFLICTO_VERSION: 'conflicto_version'
    },

    status: 'guardado_servidor',
    lastSyncTimestamp: null,
    inFlight: false,
    retryCount: 0,
    maxRetries: 3,

    getSyncStatus() {
      return {
        status: this.status,
        lastSyncTimestamp: this.lastSyncTimestamp,
        hasUnsavedChanges: Boolean(evalState.hasUnsavedChanges || evalState.hasUnsavedCaptura || evalState.hasUnsavedDesempeno || evalState.hasUnsavedMensajes),
        inFlight: this.inFlight
      };
    },

    setSyncStatus(status, text = '') {
      this.status = status;
      const indicator = document.getElementById('evalSyncStatusIndicator');
      const label = document.getElementById('evalSyncStatusText');
      if (label) {
        const textMap = {
          sin_guardar: 'Sin guardar',
          borrador_local: 'Borrador local',
          pendiente_sync: 'Pendiente de sincronizar',
          sincronizando: 'Sincronizando con Google Sheets...',
          guardado_servidor: '✓ Guardado en Google Sheets',
          simulacion_local: '[SIMULACIÓN] Guardado de prueba (No persistido en Google Sheets)',
          error_sync: '⚠️ Error de sincronización',
          conflicto_version: '⚠️ Conflicto de versiones'
        };
        label.textContent = text || textMap[status] || status;
      }
      if (indicator) {
        indicator.className = `eval-sync-pill eval-sync-${status}`;
      }
    },

    buildTrimesterBundle(trimester = evalState.trimester) {
      const t = trimester;
      const cfg = evalState.config || {};
      const rawStudents = getStudentsList();
      const sortedStudents = [...rawStudents].sort((a, b) => resolveOfficialListNumber(a) - resolveOfficialListNumber(b));

      const calificaciones = [];
      sortedStudents.forEach(s => {
        const num = resolveOfficialListNumber(s);
        const sEval = calculateStudentFullEvaluation(s.id, t);
        EVAL_FIELDS.forEach(f => {
          const sField = sEval?.subjects?.[f] || {};
          calificaciones.push({
            alumnoId: s.id,
            numeroLista: num,
            campoFormativo: f,
            modalidad: sField.mode || 'asistida',
            examenGrade: sField.examGrade ?? null,
            desgloseCriterios: sField.breakdown || {},
            calcGrade: sField.calcGrade ?? null,
            manualGrade: sField.manualGrade ?? null,
            motivoAjuste: sField.adjustmentReason || '',
            authorizedGrade: sField.authorizedGrade ?? null,
            isAuthorized: Boolean(sField.isAuthorized),
            status: sField.status || 'PENDIENTE'
          });
        });
      });

      const desempeno = [];
      sortedStudents.forEach(s => {
        const num = resolveOfficialListNumber(s);
        const dStore = evalState.desempenoStore?.[t]?.[s.id] || {};
        desempeno.push({
          alumnoId: s.id,
          numeroLista: num,
          ratings: dStore.ratings || {},
          source: dStore.source || 'manual',
          isReviewed: dStore.isReviewed !== false
        });
      });

      const mensajes = [];
      sortedStudents.forEach(s => {
        const num = resolveOfficialListNumber(s);
        const mStore = evalState.mensajesStore?.[t]?.[s.id] || {};
        mensajes.push({
          alumnoId: s.id,
          numeroLista: num,
          mensaje: mStore.message || '',
          templateId: mStore.templateId || null,
          estadoRevision: mStore.estadoRevision || 'pendiente'
        });
      });

      return {
        batchId: 'BATCH_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9),
        consolidationState: 'en_preparacion',
        ciclo: cfg.cicloEscolar || '2026-2027',
        grupo: cfg.grupo || '4.° A',
        trimestre: t,
        version: evalState.syncVersion || 1,
        config: {
          inicio: cfg.periodos?.[t]?.inicio || '',
          fin: cfg.periodos?.[t]?.fin || '',
          estado: cfg.periodos?.[t]?.estado || 'in-progress',
          ponderaciones: cfg.porcentajes?.[t] || {},
          valoresTareas: cfg.valoresTareas || {},
          valoresConducta: cfg.valoresConducta || {},
          valoresParticipacion: cfg.valoresParticipacion || {},
          ajustesAdmin: {}
        },
        calificaciones,
        desempeno,
        mensajes,
        clientTimestamp: new Date().toISOString()
      };
    },

    async syncTrimesterBatch(trimester = evalState.trimester, forceSimulation = false) {
      if (this.inFlight) {
        if (typeof toast === 'function') toast('Ya existe una sincronización en proceso. Por favor, espera.');
        return { success: false, reason: 'in_flight' };
      }

      this.inFlight = true;
      this.setSyncStatus(this.STATUS.SINCRONIZANDO, 'Sincronizando con Google Sheets...');

      const payload = this.buildTrimesterBundle(trimester);

      try {
        let serverRes = null;
        const hasSession = (typeof sessionToken === 'string' && sessionToken.length >= 8) || (typeof window.sessionToken === 'string' && window.sessionToken.length >= 8);
        if (typeof window.server === 'function' && !forceSimulation && hasSession && typeof API_URL === 'string' && API_URL.length > 10) {
          serverRes = await window.server('syncTrimesterEvaluationBatch', payload);
        } else {
          // Entorno controlado / Simulación de persistencia remota (offline / pruebas locales)
          await new Promise(r => setTimeout(r, 600));
          serverRes = {
            ok: true,
            data: {
              batchId: payload.batchId,
              configSaved: true,
              calificacionesCount: payload.calificaciones.length,
              desempenoCount: payload.desempeno.length,
              mensajesCount: payload.mensajes.length,
              timestamp: new Date().toISOString(),
              version: (payload.version || 1) + 1,
              simulated: true,
              consolidationState: 'consolidado_simulado'
            }
          };
        }

        if (serverRes && (serverRes.ok || serverRes.data)) {
          const isSimulated = Boolean(serverRes.data?.simulated);
          this.lastSyncTimestamp = new Date().toISOString();
          evalState.syncVersion = (payload.version || 1) + 1;
          evalState.hasUnsavedChanges = false;
          evalState.hasUnsavedCaptura = false;
          evalState.hasUnsavedDesempeno = false;
          evalState.hasUnsavedMensajes = false;

          try {
            localStorage.setItem(STORAGE_KEYS.syncMetadata, JSON.stringify({
              lastSyncTimestamp: this.lastSyncTimestamp,
              syncVersion: evalState.syncVersion,
              trimester,
              isSimulated
            }));
          } catch (e) {}

          if (isSimulated) {
            this.setSyncStatus(this.STATUS.SIMULACION_LOCAL, '[SIMULACIÓN] Guardado de prueba (No persistido en Google Sheets)');
          } else {
            this.setSyncStatus(this.STATUS.GUARDADO_SERVIDOR, '✓ Guardado en Google Sheets');
          }
          this.retryCount = 0;
          if (typeof toast === 'function') {
            const countMsg = `${payload.calificaciones.length} calificaciones, ${payload.desempeno.length} valoraciones integrales y ${payload.mensajes.length} mensajes ${isSimulated ? 'simulados' : 'sincronizados'}.`;
            toast(`${isSimulated ? '[SIMULACIÓN LOCAL] ' : ''}Operación completada (${countMsg}).`);
          }
          return { success: true, data: serverRes.data, isSimulated };
        } else {
          throw new Error(serverRes?.error || 'Respuesta inválida del servidor.');
        }
      } catch (err) {
        console.error('[EvalSyncEngine] Error durante la sincronización:', err);
        this.setSyncStatus(this.STATUS.ERROR_SYNC, '⚠️ Error de sincronización');
        if (typeof toast === 'function') {
          toast(`Error de sincronización: ${err.message}. Se conservan los borradores locales.`);
        }
        return { success: false, error: err.message };
      } finally {
        this.inFlight = false;
      }
    },

    prepareDraftMigrationPreview() {
      const configRaw = localStorage.getItem(STORAGE_KEYS.config);
      const capturaRaw = localStorage.getItem(STORAGE_KEYS.captura);
      const desempRaw = localStorage.getItem(STORAGE_KEYS.desempeno);
      const msgRaw = localStorage.getItem(STORAGE_KEYS.mensajes);

      let configParsed = null, capturaParsed = null, desempParsed = null, msgParsed = null;
      try { configParsed = configRaw ? JSON.parse(configRaw) : null; } catch (e) {}
      try { capturaParsed = capturaRaw ? JSON.parse(capturaRaw) : null; } catch (e) {}
      try { desempParsed = desempRaw ? JSON.parse(desempRaw) : null; } catch (e) {}
      try { msgParsed = msgRaw ? JSON.parse(msgRaw) : null; } catch (e) {}

      const warnings = [];
      let academicCount = 0;
      let desempCount = 0;
      let msgCount = 0;

      if (capturaParsed) {
        for (const t in capturaParsed) {
          for (const sId in capturaParsed[t]) {
            academicCount++;
          }
        }
      }

      if (desempParsed) {
        for (const t in desempParsed) {
          for (const sId in desempParsed[t]) {
            const ratings = desempParsed[t][sId]?.ratings || {};
            let hasUnknown = false;
            for (const k in ratings) {
              if (!INDICADORES_DESEMPENO.some(i => i.id === k)) {
                hasUnknown = true;
              }
            }
            if (hasUnknown) {
              warnings.push(`Alumno ${sId} en T${t}: contiene valoraciones previas que no corresponden exactamente al catálogo oficial.`);
            }
            desempCount++;
          }
        }
      }

      if (msgParsed) {
        for (const t in msgParsed) {
          for (const sId in msgParsed[t]) {
            const m = msgParsed[t][sId]?.message || '';
            if (m.length > 245) {
              warnings.push(`Alumno ${sId} en T${t}: el mensaje supera 245 caracteres (${m.length} car). Requiere ajuste.`);
            }
            if (m.trim().length > 0) msgCount++;
          }
        }
      }

      return {
        hasDataToMigrate: Boolean(configParsed || academicCount > 0 || desempCount > 0 || msgCount > 0),
        academicCount,
        desempCount,
        msgCount,
        warnings,
        canMigrate: true
      };
    },

    renderDraftMigrationModal() {
      const box = document.getElementById('evalDraftMigrationPreviewBox');
      if (!box) return;
      const preview = this.prepareDraftMigrationPreview();

      let warnHtml = '';
      if (preview.warnings.length > 0) {
        warnHtml = `
          <div style="background: #fff7ed; border: 1px solid #fdba74; padding: 10px; border-radius: 6px; margin-top: 10px;">
            <b style="color: #c2410c; font-size: 12px;">Advertencias de integridad detectadas:</b>
            <ul style="margin: 4px 0 0 16px; padding: 0; font-size: 11px; color: #7c2d12;">
              ${preview.warnings.map(w => `<li>${w}</li>`).join('')}
            </ul>
          </div>
        `;
      }

      box.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; text-align: center; margin-bottom: 12px;">
          <div style="background: #ffffff; border: 1px solid var(--line); padding: 8px; border-radius: 6px;">
            <span class="muted" style="font-size: 11px;">Calificaciones</span>
            <b style="display: block; font-size: 18px; color: var(--navy);">${preview.academicCount}</b>
          </div>
          <div style="background: #ffffff; border: 1px solid var(--line); padding: 8px; border-radius: 6px;">
            <span class="muted" style="font-size: 11px;">Desempeño</span>
            <b style="display: block; font-size: 18px; color: var(--teal);">${preview.desempCount}</b>
          </div>
          <div style="background: #ffffff; border: 1px solid var(--line); padding: 8px; border-radius: 6px;">
            <span class="muted" style="font-size: 11px;">Mensajes</span>
            <b style="display: block; font-size: 18px; color: var(--primary);">${preview.msgCount}</b>
          </div>
        </div>
        <p style="margin: 0; font-size: 12px; color: var(--navy);">
          ${preview.hasDataToMigrate 
            ? 'Los borradores locales analizados son compatibles con la estructura oficial y están listos para persistirse en Google Sheets.' 
            : 'No se encontraron borradores locales pendientes en este dispositivo.'}
        </p>
        ${warnHtml}
      `;
    },

    openDraftMigrationModal() {
      const modal = document.getElementById('evalDraftRecoveryModal');
      if (modal) {
        modal.style.display = 'flex';
        modal.classList.remove('hidden-control');
        this.renderDraftMigrationModal();
      }
    },

    closeDraftMigrationModal() {
      const modal = document.getElementById('evalDraftRecoveryModal');
      if (modal) {
        modal.style.display = 'none';
        modal.classList.add('hidden-control');
      }
    },

    async executeDraftMigration() {
      this.closeDraftMigrationModal();
      if (typeof toast === 'function') toast('Iniciando migración y sincronización de borradores...');
      return await this.syncTrimesterBatch(evalState.trimester);
    }
  };

  /**
   * Renderiza el apartado 2: Desempeño Integral Individual
   */
  function renderDesempenoIndividual(student, trimester) {
    if (!student) return;
    const t = trimester;
    const data = DesempenoEngine.getStudentEvaluation(student.id, t);

    // 1. Contador y porcentaje
    const pct = Math.round((data.completedCount / 23) * 100);
    const progressTxt = document.getElementById('evalIndDesempenoProgressText');
    const progressBar = document.getElementById('evalIndDesempenoProgressBar');
    if (progressTxt) progressTxt.textContent = `${data.completedCount} de 23 indicadores completados (${pct}%)`;
    if (progressBar) progressBar.style.width = `${pct}%`;

    // 2. Pills de distribución
    const pillsWrap = document.getElementById('evalIndDesempenoPills');
    if (pillsWrap) {
      pillsWrap.innerHTML = `
        <span class="eval-pill-e">E: ${data.distribution.E}</span>
        <span class="eval-pill-b">B: ${data.distribution.B}</span>
        <span class="eval-pill-r">R: ${data.distribution.R}</span>
        <span class="eval-pill-a">A: ${data.distribution.A}</span>
        <span class="eval-pill-none">Pendientes: ${data.pendingCount}</span>
      `;
    }

    // 3. Botones Deshacer y Copiar
    const undoBtn = document.getElementById('evalBtnDesempenoUndo');
    if (undoBtn) {
      undoBtn.disabled = !evalState.lastDesempenoUndo || String(evalState.lastDesempenoUndo.studentId) !== String(student.id);
    }
    const copyBtn = document.getElementById('evalBtnCopyTrimester');
    if (copyBtn) {
      copyBtn.style.display = t > 1 ? 'inline-flex' : 'none';
    }

    // 4. Categorías e Indicadores
    const categoriesWrap = document.getElementById('evalIndDesempenoCategoriesWrap');
    if (categoriesWrap) {
      let reviewAlertHtml = '';
      if (data.isReviewed === false || data.requiresReview === true) {
        reviewAlertHtml = `
          <div class="eval-copied-review-alert">
            <div>
              <span style="font-size: 13px; font-weight: 700; color: #c2410c;">⚠️ Valoraciones copiadas o pendientes de revisión docente</span>
              <p class="muted" style="margin: 2px 0 0; font-size: 11px;">Es obligatorio revisar y confirmar las valoraciones antes de autorizar el cierre definitivo de este alumno.</p>
            </div>
            <button class="btn small primary" data-action="eval-confirm-review-desempeno" title="Confirmar que se han revisado las valoraciones">
              ✓ Confirmar revisión docente
            </button>
          </div>
        `;
      }

      categoriesWrap.innerHTML = reviewAlertHtml + CATEGORIAS_DESEMPENO.map(cat => {
        const catIndicators = INDICADORES_DESEMPENO.filter(i => i.categoria === cat.id);
        const catDone = catIndicators.filter(i => Boolean(data.ratings[i.id])).length;

        const indicatorsHtml = catIndicators.map(ind => {
          const currentVal = data.ratings[ind.id] || null;

          return `
            <div class="eval-indicator-item" data-ind-id="${ind.id}">
              <div class="eval-indicator-title">
                <span style="color: var(--teal); font-weight: 800;">${ind.numero}.</span>
                <span>${ind.nombre}</span>
              </div>
              <div class="eval-indicator-buttons" role="group" aria-label="Nivel para ${ind.nombre}">
                <button type="button" class="eval-ind-lvl-btn btn-lvl-e ${currentVal === 'E' ? 'active' : ''}" 
                        data-action="eval-ind-set-indicator-level" data-student-id="${student.id}" data-ind="${ind.id}" data-level="E" title="Excelente (E)">
                  E
                </button>
                <button type="button" class="eval-ind-lvl-btn btn-lvl-b ${currentVal === 'B' ? 'active' : ''}" 
                        data-action="eval-ind-set-indicator-level" data-student-id="${student.id}" data-ind="${ind.id}" data-level="B" title="Bueno (B)">
                  B
                </button>
                <button type="button" class="eval-ind-lvl-btn btn-lvl-r ${currentVal === 'R' ? 'active' : ''}" 
                        data-action="eval-ind-set-indicator-level" data-student-id="${student.id}" data-ind="${ind.id}" data-level="R" title="Regular (R)">
                  R
                </button>
                <button type="button" class="eval-ind-lvl-btn btn-lvl-a ${currentVal === 'A' ? 'active' : ''}" 
                        data-action="eval-ind-set-indicator-level" data-student-id="${student.id}" data-ind="${ind.id}" data-level="A" title="Requiere apoyo (A)">
                  A
                </button>
                <button type="button" class="eval-ind-lvl-btn btn-lvl-clear" 
                        data-action="eval-ind-set-indicator-level" data-student-id="${student.id}" data-ind="${ind.id}" data-level="none" title="Limpiar valoración (Sin valorar)">
                  ✕
                </button>
              </div>
            </div>
          `;
        }).join('');

        return `
          <div class="eval-desempeno-category-card">
            <div class="eval-desempeno-category-head">
              <div>
                <h5>${cat.icono} ${cat.nombre}</h5>
                <span class="muted" style="font-size: 11px;">${catDone} de ${cat.total} indicadores valorados</span>
              </div>
              <div class="button-row" style="gap: 4px;">
                <span style="font-size: 11px; font-weight: 700; color: var(--muted); margin-right: 4px;">Asignar a toda la categoría:</span>
                <button class="btn small eval-lvl-btn-e" data-action="eval-ind-set-cat-level" data-cat="${cat.id}" data-level="E" title="Asignar Excelente a la categoría">E</button>
                <button class="btn small eval-lvl-btn-b" data-action="eval-ind-set-cat-level" data-cat="${cat.id}" data-level="B" title="Asignar Bueno a la categoría">B</button>
                <button class="btn small eval-lvl-btn-r" data-action="eval-ind-set-cat-level" data-cat="${cat.id}" data-level="R" title="Asignar Regular a la categoría">R</button>
                <button class="btn small eval-lvl-btn-a" data-action="eval-ind-set-cat-level" data-cat="${cat.id}" data-level="A" title="Asignar Requiere apoyo a la categoría">A</button>
              </div>
            </div>
            <div class="eval-indicators-list">
              ${indicatorsHtml}
            </div>
          </div>
        `;
      }).join('');
    }
  }

  /**
   * Renderiza el apartado 3: Mensaje Personalizado Individual
   */
  function renderMensajeIndividual(student, trimester) {
    if (!student) return;
    const t = trimester;
    const msgData = DesempenoEngine.getStudentMessage(student.id, t);

    const textarea = document.getElementById('evalIndMessageTextarea');
    const countEl = document.getElementById('evalIndMessageCharCount');
    const alertEl = document.getElementById('evalIndMessageOverLimitAlert');
    const saveBtn = document.getElementById('evalBtnSaveMessage');

    if (textarea) textarea.value = msgData.message;
    if (countEl) {
      countEl.textContent = `${msgData.charCount} / 245 caracteres`;
      countEl.className = 'eval-char-count' + (msgData.isOverLimit ? ' error' : (msgData.charCount > 220 ? ' warning' : ''));
    }
    if (alertEl) alertEl.style.display = msgData.isOverLimit ? 'inline-block' : 'none';
    if (saveBtn) saveBtn.disabled = msgData.isOverLimit;
  }

  /**
   * Renderiza el apartado 4: Resumen Consolidado Individual de Evaluación
   */
  function renderResumenIndividual(student, trimester) {
    if (!student) return;
    const t = trimester;
    const summaryPanel = document.getElementById('evalIndSummaryPanel');
    if (!summaryPanel) return;

    const num = resolveOfficialListNumber(student);
    const fullNameText = student.apellidos ? `${student.apellidos} ${student.nombres || ''}` : (student.nombre || 'Alumno');
    const evalData = calculateStudentFullEvaluation(student.id, t);
    const desemp = DesempenoEngine.getStudentEvaluation(student.id, t);
    const msg = DesempenoEngine.getStudentMessage(student.id, t);
    const overall = DesempenoEngine.getStudentOverallStatus(student.id, t);

    summaryPanel.innerHTML = `
      <div class="section-head" style="align-items: center;">
        <div>
          <h3 style="margin: 0; font-size: 17px; color: var(--navy);">Resumen Consolidado de Evaluación · Trimestre ${t}</h3>
          <span class="muted" style="font-size: 12px;">${num < 10 ? '0' + num : num}. ${fullNameText}</span>
        </div>
        <span class="eval-overall-status-pill ${overall.badgeClass}">
          ${overall.label}
        </span>
      </div>

      <!-- 1. Calificaciones Académicas -->
      <div style="margin-top: 16px;">
        <h4 style="font-size: 14px; color: var(--navy); margin-bottom: 8px;">1. Calificaciones académicas por campo formativo</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px;">
          ${EVAL_FIELDS.map(f => {
            const sub = evalData.subjects[f];
            return `
              <div class="eval-stat-card" style="padding: 10px;">
                <span style="font-size: 11px;">${f}</span>
                <b style="font-size: 20px; color: ${sub.isAuthorized ? '#1b7c4b' : 'var(--teal)'};">${sub.isAuthorized ? EvaluacionEngine.formatGrade(sub.authorizedGrade) : sub.displayGrade}</b>
                <span class="muted" style="font-size: 10px;">${sub.isAuthorized ? '✓ Autorizada' : 'Pendiente de autorización'}</span>
              </div>
            `;
          }).join('')}
        </div>
        <div style="margin-top: 6px; font-size: 12px; font-weight: 700; color: var(--navy);">
          Promedio general trimestral: <span style="color: var(--teal); font-size: 15px;">${evalData.trimesterAverage?.displayAverage || '—'}</span>
        </div>
      </div>

      <!-- 2. Desempeño Integral -->
      <div style="margin-top: 20px; padding-top: 14px; border-top: 1px solid var(--line);">
        <h4 style="font-size: 14px; color: var(--navy); margin-bottom: 8px;">2. Desempeño integral (23 Indicadores)</h4>
        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
          <span class="badge" style="font-size: 13px;">${desemp.completedCount} de 23 evaluados</span>
          <span class="eval-pill-e">E: ${desemp.distribution.E}</span>
          <span class="eval-pill-b">B: ${desemp.distribution.B}</span>
          <span class="eval-pill-r">R: ${desemp.distribution.R}</span>
          <span class="eval-pill-a">A: ${desemp.distribution.A}</span>
          ${desemp.pendingCount > 0 ? `<span class="eval-pill-none" style="color: #dc2626; border-color: #fca5a5;">Pendientes: ${desemp.pendingCount}</span>` : '<span class="eval-pill-e">✓ 23/23 Completos</span>'}
        </div>
      </div>

      <!-- 3. Mensaje Personalizado Familiar -->
      <div style="margin-top: 20px; padding-top: 14px; border-top: 1px solid var(--line);">
        <h4 style="font-size: 14px; color: var(--navy); margin-bottom: 8px;">3. Mensaje personalizado para la familia</h4>
        <div style="background: #f8fafc; border: 1px solid var(--line); border-radius: 8px; padding: 12px;">
          <p style="margin: 0; font-size: 13px; font-style: italic; color: var(--navy);">
            "${msg.message || '<span class=\"muted\">(Sin mensaje familiar redactado)</span>'}"
          </p>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; font-size: 11px;">
            <span class="muted">${msg.charCount} / 245 caracteres</span>
            <span class="${msg.isValid ? 'text-green' : 'text-yellow'}" style="font-weight: 700;">
              ${msg.isValid ? '✓ Válido para publicación' : '⚠️ Mensaje incompleto o pendiente'}
            </span>
          </div>
        </div>
      </div>

      <!-- 4. Checklist para Cierre de Evaluación -->
      <div style="margin-top: 20px; padding: 14px; border-radius: 10px; background: #fafcfd; border: 1px solid var(--line);">
        <h4 style="font-size: 13px; color: var(--navy); margin: 0 0 8px;">Requisitos institucionales para el cierre definitivo:</h4>
        <div style="display: flex; flex-direction: column; gap: 4px; font-size: 12px;">
          <div style="color: ${overall.isAcademicAuth ? '#166534' : '#dc2626'}; font-weight: 700;">
            ${overall.isAcademicAuth ? '✓' : '✗'} 4 campos formativos autorizados con calificación definitiva.
          </div>
          <div style="color: ${overall.isDesempDone ? '#166534' : '#dc2626'}; font-weight: 700;">
            ${overall.isDesempDone ? '✓' : '✗'} 23 indicadores de desempeño integral valorados y revisados.
          </div>
          <div style="color: ${overall.isMsgValid ? '#166534' : '#dc2626'}; font-weight: 700;">
            ${overall.isMsgValid ? '✓' : '✗'} Mensaje familiar redactado dentro del límite de 245 caracteres.
          </div>
        </div>
        <p class="muted" style="margin: 10px 0 0; font-size: 11px;">
          ${overall.isReadyToClose 
            ? '✓ Esta evaluación cumple con todos los requisitos institucionales y está lista para el proceso de cierre y publicación en la Etapa 7.' 
            : '⚠️ Completa los requisitos pendientes antes del cierre institucional.'}
        </p>
      </div>
    `;
  }

  /**
   * Subvista D de Captura Grupal: Matriz de Desempeño Integral
   */
  function renderMatrizDesempeno(container, studentsList, trimester) {
    const t = trimester;
    const catFilter = evalState.desempenoCategoryFilter || 'all';
    const indFilter = evalState.desempenoIndicatorFilter || 'all';
    const lvlFilter = evalState.desempenoLevelFilter || 'all';

    let displayIndicators = INDICADORES_DESEMPENO;
    if (catFilter !== 'all') {
      displayIndicators = displayIndicators.filter(i => i.categoria === catFilter);
    }
    if (indFilter !== 'all') {
      displayIndicators = displayIndicators.filter(i => i.id === indFilter);
    }

    // Filtrar alumnos por nivel si está activo
    const filteredStudents = studentsList.filter(s => {
      if (lvlFilter === 'all') return true;
      const des = DesempenoEngine.getStudentEvaluation(s.id, t);
      if (lvlFilter === 'pending') return des.pendingCount > 0;
      return Object.values(des.ratings).includes(lvlFilter);
    });

    let html = `
      <table class="eval-tracking-table eval-matrix-table" id="evalMatrixTable">
        <thead>
          <tr>
            <th class="eval-sticky-col" style="width: 50px; text-align: center;">No.</th>
            <th class="eval-sticky-col" style="min-width: 200px;">Nombre del alumno</th>
            <th style="text-align: center; width: 120px;">Progreso (23)</th>
            ${displayIndicators.map(ind => `
              <th style="text-align: center; min-width: 130px;" title="${ind.categoriaNombre}: ${ind.nombre}">
                <div style="font-size: 11px; font-weight: 700;">${ind.numero}. ${ind.nombre.slice(0, 18)}${ind.nombre.length > 18 ? '...' : ''}</div>
              </th>
            `).join('')}
          </tr>
        </thead>
        <tbody id="evalGrupalTableBody">
    `;

    filteredStudents.forEach(s => {
      const num = resolveOfficialListNumber(s);
      const name = s.apellidos ? `${s.apellidos} ${s.nombres || ''}` : (s.nombre || 'Alumno');
      const des = DesempenoEngine.getStudentEvaluation(s.id, t);

      html += `
        <tr data-student-id="${s.id}">
          <td class="eval-sticky-col" style="text-align: center; font-weight: 800; color: var(--navy);">${num}</td>
          <td class="eval-sticky-col">
            <span style="font-weight: 700; font-size: 13px;">${name}</span>
          </td>
          <td style="text-align: center;">
            <span class="badge ${des.isComplete ? 'status-completed' : 'status-pending'}" style="font-size: 11px;">
              ${des.completedCount} / 23
            </span>
          </td>
          ${displayIndicators.map(ind => {
            const currentVal = des.ratings[ind.id] || null;
            return `
              <td style="text-align: center;">
                <div class="eval-indicator-buttons" style="justify-content: center; gap: 3px;">
                  <button type="button" class="eval-ind-lvl-btn btn-lvl-e ${currentVal === 'E' ? 'active' : ''}" 
                          style="min-width: 32px; min-height: 32px; font-size: 11px;"
                          data-action="eval-ind-set-indicator-level" data-student-id="${s.id}" data-ind="${ind.id}" data-level="E">E</button>
                  <button type="button" class="eval-ind-lvl-btn btn-lvl-b ${currentVal === 'B' ? 'active' : ''}" 
                          style="min-width: 32px; min-height: 32px; font-size: 11px;"
                          data-action="eval-ind-set-indicator-level" data-student-id="${s.id}" data-ind="${ind.id}" data-level="B">B</button>
                  <button type="button" class="eval-ind-lvl-btn btn-lvl-r ${currentVal === 'R' ? 'active' : ''}" 
                          style="min-width: 32px; min-height: 32px; font-size: 11px;"
                          data-action="eval-ind-set-indicator-level" data-student-id="${s.id}" data-ind="${ind.id}" data-level="R">R</button>
                  <button type="button" class="eval-ind-lvl-btn btn-lvl-a ${currentVal === 'A' ? 'active' : ''}" 
                          style="min-width: 32px; min-height: 32px; font-size: 11px;"
                          data-action="eval-ind-set-indicator-level" data-student-id="${s.id}" data-ind="${ind.id}" data-level="A">A</button>
                </div>
              </td>
            `;
          }).join('')}
        </tr>
      `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
  }

  /**
   * Subvista E de Captura Grupal: Mensajes Personalizados
   */
  function renderMatrizMensajes(container, studentsList, trimester) {
    const t = trimester;

    let html = `
      <table class="eval-tracking-table eval-matrix-table" id="evalMatrixTable">
        <thead>
          <tr>
            <th class="eval-sticky-col" style="width: 50px; text-align: center;">No.</th>
            <th class="eval-sticky-col" style="min-width: 200px;">Nombre del alumno</th>
            <th style="min-width: 320px;">Mensaje para la familia (máx. 245 caracteres)</th>
            <th style="width: 90px; text-align: center;">Caracteres</th>
            <th style="width: 120px; text-align: center;">Estado</th>
            <th style="width: 140px; text-align: center;">Acción</th>
          </tr>
        </thead>
        <tbody id="evalGrupalTableBody">
    `;

    studentsList.forEach(s => {
      const num = resolveOfficialListNumber(s);
      const name = s.apellidos ? `${s.apellidos} ${s.nombres || ''}` : (s.nombre || 'Alumno');
      const msg = DesempenoEngine.getStudentMessage(s.id, t);

      html += `
        <tr data-student-id="${s.id}">
          <td class="eval-sticky-col" style="text-align: center; font-weight: 800; color: var(--navy);">${num}</td>
          <td class="eval-sticky-col">
            <span style="font-weight: 700; font-size: 13px;">${name}</span>
          </td>
          <td>
            <input type="text" class="input compact-input" style="width: 100%; box-sizing: border-box; font-size: 12px;" 
                   value="${typeof escapeHtml === 'function' ? escapeHtml(msg.message) : msg.message}" 
                   placeholder="Redacta mensaje o inserta una recomendación..." 
                   data-action="eval-grupal-msg-input" 
                   data-student-id="${s.id}">
          </td>
          <td style="text-align: center; font-size: 12px; font-weight: 700; color: ${msg.isOverLimit ? '#dc2626' : 'var(--teal)'};">
            ${msg.charCount} / 245
          </td>
          <td style="text-align: center;">
            <span class="eval-status-pill ${msg.isValid ? 'status-completed' : 'status-pending'}" style="font-size: 11px;">
              ${msg.isValid ? '✓ Válido' : 'Pendiente'}
            </span>
          </td>
          <td style="text-align: center;">
            <button class="btn small" data-action="eval-open-individual" data-id="${s.id}" title="Abrir ficha detallada del alumno">
              Abrir ficha
            </button>
          </td>
        </tr>
      `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;

    // Escuchar cambios en los inputs de mensajes grupales
    container.querySelectorAll('[data-action="eval-grupal-msg-input"]').forEach(inp => {
      inp.addEventListener('change', () => {
        const sId = inp.dataset.studentId;
        const txt = inp.value.trim();
        DesempenoEngine.setStudentMessage(sId, txt, t);
        renderMatrizMensajes(container, studentsList, t);
      });
    });
  }

  /**
   * Modal de Banco de Recomendaciones
   */
  function renderBancoMensajesModal() {
    const listWrap = document.getElementById('evalBankListContainer');
    if (!listWrap) return;

    const bank = DesempenoEngine.getBancoMensajes();
    const q = (evalState.bancoSearch || '').toLowerCase();
    const cat = evalState.bancoCategory || 'all';
    const lvl = evalState.bancoLevel || 'all';

    const filtered = bank.filter(item => {
      if (!item.active && item.active !== undefined) return false;
      if (cat !== 'all' && item.category !== cat) return false;
      if (lvl !== 'all' && item.level !== lvl) return false;
      if (q && !item.text.toLowerCase().includes(q)) return false;
      return true;
    });

    if (filtered.length === 0) {
      listWrap.innerHTML = '<p class="muted" style="text-align: center; padding: 20px;">No se encontraron recomendaciones con los filtros seleccionados.</p>';
      return;
    }

    listWrap.innerHTML = filtered.map(item => {
      const lvlInfo = NIVELES_DESEMPENO[item.level] || { label: item.level, badgeClass: 'eval-pill-none' };
      const catObj = CATEGORIAS_DESEMPENO.find(c => c.id === item.category);
      const catLabel = catObj ? catObj.nombre : item.category;

      const approvalBadge = item.approved 
        ? '<span class="badge success" style="font-size: 11px;">✓ Aprobada</span>' 
        : '<span class="badge warning" style="font-size: 11px;">Propuesta pendiente</span>';

      const activeBadge = item.active === false 
        ? '<span class="badge" style="font-size: 11px; background: #e2e8f0; color: #64748b;">Inactiva</span>' 
        : '';

      const approveBtn = !item.approved 
        ? `<button class="btn small" data-action="eval-approve-banco-rec" data-rec-id="${item.id}" title="Aprobar esta propuesta">✓ Aprobar</button>` 
        : '';

      return `
        <div class="eval-bank-item">
          <div class="eval-bank-item-top">
            <span class="badge" style="font-size: 11px;">${catLabel}</span>
            <span class="${lvlInfo.badgeClass}" style="font-size: 11px;">${lvlInfo.label}</span>
            ${approvalBadge}
            ${activeBadge}
          </div>
          <div class="eval-bank-item-text">"${item.text}"</div>
          <div class="eval-bank-item-actions" style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <span class="muted" style="font-size: 11px;">${item.text.length} caracteres</span>
            <div class="button-row" style="gap: 6px;">
              ${approveBtn}
              <button class="btn small" data-action="eval-toggle-banco-rec" data-rec-id="${item.id}">
                ${item.active !== false ? 'Desactivar' : 'Activar'}
              </button>
              <button class="btn small primary" data-action="eval-insert-banco-recommendation" data-rec-id="${item.id}" title="Insertar esta recomendación en la evaluación del alumno">
                Insertar recomendación
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function openMessageBankModal() {
    const modal = document.getElementById('evalMessageBankModal');
    if (modal) {
      modal.style.display = 'flex';
      modal.classList.remove('hidden-control');
      renderBancoMensajesModal();
    }
  }

  function closeMessageBankModal() {
    const modal = document.getElementById('evalMessageBankModal');
    if (modal) {
      modal.style.display = 'none';
      modal.classList.add('hidden-control');
    }
  }

  function openCopyTrimesterModal() {
    const modal = document.getElementById('evalCopyTrimesterModal');
    if (modal) {
      modal.style.display = 'flex';
      modal.classList.remove('hidden-control');
      const srcSelect = document.getElementById('evalCopySourceTrimester');
      if (srcSelect) {
        srcSelect.value = String(Math.max(1, evalState.trimester - 1));
      }
      updateCopyPreviewNotice();
    }
  }

  function closeCopyTrimesterModal() {
    const modal = document.getElementById('evalCopyTrimesterModal');
    if (modal) {
      modal.style.display = 'none';
      modal.classList.add('hidden-control');
    }
  }

  function updateCopyPreviewNotice() {
    const notice = document.getElementById('evalCopyPreviewNotice');
    if (!notice) return;
    const srcTrimester = Number(document.getElementById('evalCopySourceTrimester')?.value) || 1;
    const curStudentId = evalState.indStudentId;
    const srcData = DesempenoEngine.getStudentEvaluation(curStudentId, srcTrimester);
    notice.textContent = `El Trimestre ${srcTrimester} tiene ${srcData.completedCount} de 23 indicadores capturados.`;
  }

  function confirmCopyTrimester() {
    const srcTrimester = Number(document.getElementById('evalCopySourceTrimester')?.value) || 1;
    const onlyPending = document.querySelector('input[name="evalCopyMode"]:checked')?.value === 'only-pending';
    const curStudentId = evalState.indStudentId;

    const res = DesempenoEngine.copyFromTrimester(curStudentId, srcTrimester, evalState.trimester, onlyPending);
    closeCopyTrimesterModal();

    if (res.success) {
      renderDesempenoIndividual(getStudentsList().find(s => s.id === curStudentId), evalState.trimester);
      if (typeof toast === 'function') toast(`Se copiaron ${res.copiedCount} valoraciones del Trimestre ${srcTrimester} como borrador.`);
    } else {
      if (typeof toast === 'function') toast(res.reason || 'No se pudieron copiar las valoraciones.');
    }
  }

  /**
   * Modal de Pegado Masivo: Apertura, previsualización y aplicación
   */
  function openPasteModal() {
    const modal = document.getElementById('evalPasteModal');
    if (modal) {
      modal.style.display = 'flex';
      modal.classList.remove('hidden-control');
    }
  }

  function closePasteModal() {
    const modal = document.getElementById('evalPasteModal');
    if (modal) {
      modal.style.display = 'none';
      modal.classList.add('hidden-control');
    }
  }

  function previewPaste() {
    const textarea = document.getElementById('evalPasteTextarea');
    const previewBox = document.getElementById('evalPastePreviewBox');
    const applyBtn = document.getElementById('evalBtnApplyPaste');
    if (!textarea || !previewBox) return;

    const text = textarea.value.trim();
    if (!text) {
      if (typeof toast === 'function') toast('Pega primero los datos antes de previsualizar.');
      return;
    }

    const lines = text.split(/\r?\n/).map(l => l.split('\t').map(c => c.trim()));
    const rawStudents = getStudentsList();
    const students = [...rawStudents].sort((a, b) => resolveOfficialListNumber(a) - resolveOfficialListNumber(b));

    let validCount = 0;
    let previewHtml = `<table style="width: 100%; border-collapse: collapse; font-size: 11px;">
      <thead><tr style="border-bottom: 1px solid var(--line);"><th style="text-align: left;">No. Alumno</th><th>Valores detectados</th><th>Estado</th></tr></thead><tbody>`;

    lines.slice(0, 35).forEach((row, idx) => {
      const s = students[idx];
      const num = s ? resolveOfficialListNumber(s) : idx + 1;
      const name = s ? (s.apellidos ? `${s.apellidos} ${s.nombres || ''}` : s.nombre) : '—';
      const val = row[0];

      let status = '<span style="color: #1b7c4b;">Válido</span>';
      if (val === '' || val === undefined) {
        status = '<span style="color: var(--muted);">Vacío (sin cambio)</span>';
      } else {
        const numVal = Number(val);
        if (isNaN(numVal) || numVal < 0 || numVal > 10) {
          status = '<span style="color: #a32929;">Inválido (no numérico / fuera de rango)</span>';
        } else {
          validCount++;
        }
      }

      previewHtml += `<tr style="border-bottom: 1px solid #f1f5f8;">
        <td><b>${num < 10 ? '0' + num : num}.</b> ${name}</td>
        <td style="text-align: center; font-weight: 700;">${val !== '' ? val : '—'}</td>
        <td style="text-align: right;">${status}</td>
      </tr>`;
    });

    previewHtml += '</tbody></table>';
    previewBox.innerHTML = previewHtml;
    previewBox.style.display = 'block';

    if (applyBtn) {
      applyBtn.disabled = validCount === 0;
    }
  }

  function applyPaste() {
    const textarea = document.getElementById('evalPasteTextarea');
    const targetSelect = document.getElementById('evalPasteFieldSelect');
    if (!textarea || !targetSelect) return;

    const lines = textarea.value.trim().split(/\r?\n/).map(l => l.split('\t').map(c => c.trim()));
    const rawStudents = getStudentsList();
    const students = [...rawStudents].sort((a, b) => resolveOfficialListNumber(a) - resolveOfficialListNumber(b));
    const targetField = targetSelect.value;
    const t = evalState.trimester;

    let appliedCount = 0;

    lines.slice(0, 35).forEach((row, idx) => {
      const s = students[idx];
      if (!s) return;

      if (targetField === 'all-exams') {
        EVAL_FIELDS.forEach((f, cIdx) => {
          const val = row[cIdx];
          if (val !== undefined && val !== '') {
            const num = Number(val);
            if (!isNaN(num) && num >= 0 && num <= 10) {
              setStudentFieldData(s.id, f, { manualExam: num }, t);
              appliedCount++;
            }
          }
        });
      } else {
        const val = row[0];
        if (val !== undefined && val !== '') {
          const num = Number(val);
          if (!isNaN(num) && num >= 0 && num <= 10) {
            setStudentFieldData(s.id, targetField, { manualExam: num }, t);
            appliedCount++;
          }
        }
      }
    });

    closePasteModal();
    renderCapturaGrupal();
    if (typeof toast === 'function') {
      toast(`${appliedCount} calificaciones aplicadas correctamente.`);
    }
  }

  /**
   * Autoriza individualmente una materia de un alumno
   */
  function authorizeSubject(studentId, subject, trimester = evalState.trimester) {
    const evalData = calculateStudentFullEvaluation(studentId, trimester);
    const sub = evalData.subjects[subject];
    if (!sub || sub.finalGrade === null) {
      if (typeof toast === 'function') toast('No se puede autorizar una materia con información pendiente.');
      return;
    }

    if (sub.status === 'ERROR_PONDERACION' || sub.calcDetails?.tasks?.hasInvalidWeight) {
      if (typeof toast === 'function') toast('No es posible autorizar: existen ponderaciones personalizadas inválidas. Corríjalas antes de continuar.');
      return;
    }

    setStudentFieldData(studentId, subject, {
      isAuthorized: true,
      authorizedGrade: sub.finalGrade,
      authorizedAt: new Date().toISOString()
    }, trimester);

    renderCapturaIndividual();
    renderCapturaGrupal();
    renderTrackingPanel();
    if (typeof toast === 'function') {
      toast(`Calificación definitiva de ${EvaluacionEngine.formatGrade(sub.finalGrade)} autorizada para ${subject}.`);
    }
  }

  /**
   * Autoriza los 4 campos formativos de un alumno
   */
  function authorizeStudent(studentId, trimester = evalState.trimester) {
    const evalData = calculateStudentFullEvaluation(studentId, trimester);
    let authCount = 0;
    let hasWeightError = false;

    EVAL_FIELDS.forEach(f => {
      const sub = evalData.subjects[f];
      if (sub && sub.finalGrade !== null) {
        if (sub.status === 'ERROR_PONDERACION' || sub.calcDetails?.tasks?.hasInvalidWeight) {
          hasWeightError = true;
          return;
        }
        setStudentFieldData(studentId, f, {
          isAuthorized: true,
          authorizedGrade: sub.finalGrade,
          authorizedAt: new Date().toISOString()
        }, trimester);
        authCount++;
      }
    });

    renderCapturaIndividual();
    renderCapturaGrupal();
    renderTrackingPanel();
    if (hasWeightError && typeof toast === 'function') {
      toast('Atención: Algunas materias no pudieron autorizarse debido a ponderaciones personalizadas inválidas.');
    } else if (typeof toast === 'function') {
      toast(`${authCount} de 4 campos formativos autorizados para este alumno.`);
    }
  }

  /**
   * Autoriza calificaciones completas del grupo para los alumnos sin pendientes
   */
  function authorizeGroup(trimester = evalState.trimester) {
    const students = getStudentsList();
    let totalAuth = 0;

    students.forEach(s => {
      const evalData = calculateStudentFullEvaluation(s.id, trimester);
      EVAL_FIELDS.forEach(f => {
        const sub = evalData.subjects[f];
        if (sub && sub.finalGrade !== null && !sub.isAuthorized) {
          if (sub.status === 'ERROR_PONDERACION' || sub.calcDetails?.tasks?.hasInvalidWeight) {
            return;
          }
          setStudentFieldData(s.id, f, {
            isAuthorized: true,
            authorizedGrade: sub.finalGrade,
            authorizedAt: new Date().toISOString()
          }, trimester);
          totalAuth++;
        }
      });
    });

    renderCapturaGrupal();
    renderCapturaIndividual();
    renderTrackingPanel();
    if (typeof toast === 'function') {
      toast(`${totalAuth} calificaciones de materias autorizadas a nivel grupal.`);
    }
  }
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
      if (studentId) {
        evalState.indStudentId = studentId;
        switchEvalTab('captura-individual');
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
    'eval-restore-saved-activities': () => restoreSavedActivities(),

    // Acciones de Cálculo Preliminar (Etapa 4)
    'eval-recalculate': () => {
      renderCalculoPreliminar();
      if (typeof toast === 'function') toast('Calificaciones recalculadas con registros y configuraciones vigentes.');
    },
    'eval-select-calc-field': btn => {
      const field = btn?.dataset?.field;
      if (field) {
        evalState.selectedSubject = field;
        const sel = document.getElementById('evalCalcSubjectSelect');
        if (sel) sel.value = field;
        renderCalculoPreliminar();
      }
    },
    'eval-save-manual-adjustment': () => {
      saveManualAdjustmentFromUI();
    },
    'eval-reset-manual-adjustment': () => {
      resetManualAdjustmentFromUI();
    },

    // Acciones de Captura Grupal e Individual (Etapa 5)
    'eval-set-grupal-subview': btn => {
      const sub = btn?.dataset?.subview;
      if (sub) {
        evalState.grupalSubview = sub;
        renderCapturaGrupal();
      }
    },
    'eval-open-paste-modal': () => openPasteModal(),
    'eval-close-paste-modal': () => closePasteModal(),
    'eval-preview-paste': () => previewPaste(),
    'eval-apply-paste': () => applyPaste(),
    'eval-authorize-group': () => authorizeGroup(),
    'eval-save-captura-draft': () => {
      saveCapturaStore();
      if (typeof toast === 'function') toast('Borrador de calificaciones guardado localmente.');
    },
    'eval-restore-captura': () => {
      evalState.capturaStore = loadCapturaStore();
      evalState.hasUnsavedCaptura = false;
      const b = document.getElementById('evalCapturaUnsavedNotice');
      if (b) b.style.display = 'none';
      renderCapturaGrupal();
      renderCapturaIndividual();
      if (typeof toast === 'function') toast('Datos de captura restaurados desde el almacenamiento local.');
    },
    'eval-ind-prev-student': () => {
      const students = getStudentsList();
      if (!students || !students.length) return;
      const curIdx = students.findIndex(s => String(s.id) === String(evalState.indStudentId));
      const nextIdx = curIdx > 0 ? curIdx - 1 : students.length - 1;
      evalState.indStudentId = students[nextIdx].id;
      renderCapturaIndividual();
    },
    'eval-ind-next-student': () => {
      const students = getStudentsList();
      if (!students || !students.length) return;
      const curIdx = students.findIndex(s => String(s.id) === String(evalState.indStudentId));
      const nextIdx = (curIdx >= 0 && curIdx < students.length - 1) ? curIdx + 1 : 0;
      evalState.indStudentId = students[nextIdx].id;
      renderCapturaIndividual();
    },
    'eval-ind-next-pending': () => {
      const students = getStudentsList();
      if (!students || !students.length) return;
      const curIdx = students.findIndex(s => String(s.id) === String(evalState.indStudentId));
      let pendingFound = null;
      for (let i = 1; i <= students.length; i++) {
        const idx = (curIdx + i) % students.length;
        const s = students[idx];
        const ev = calculateStudentFullEvaluation(s.id, evalState.trimester);
        if (ev.status === 'incompleta' || !ev.isComplete) {
          pendingFound = s.id;
          break;
        }
      }
      if (pendingFound) {
        evalState.indStudentId = pendingFound;
        renderCapturaIndividual();
      } else {
        if (typeof toast === 'function') toast('Todos los alumnos tienen sus 4 campos formativos evaluados.');
      }
    },
    'eval-ind-switch-subtab': btn => {
      const sub = btn?.dataset?.subtab;
      if (sub) {
        evalState.indSubtab = sub;
        renderCapturaIndividual();
      }
    },
    'eval-authorize-subject': btn => {
      const sId = btn?.dataset?.id;
      const subj = btn?.dataset?.subject;
      if (sId && subj) authorizeSubject(sId, subj);
    },
    'eval-authorize-student': btn => {
      const sId = btn?.dataset?.id;
      if (sId) authorizeStudent(sId);
    },
    'eval-open-individual': btn => {
      const sId = btn?.dataset?.id;
      if (sId) evalState.indStudentId = sId;
      switchEvalTab('captura-individual');
    },

    // Acciones de Desempeño Integral y Mensajes (Etapa 6)
    'eval-ind-set-general-level': btn => {
      const lvl = btn?.dataset?.level;
      const onlyPending = Boolean(document.getElementById('evalIndOnlyPendingGeneralCheck')?.checked);
      if (lvl && evalState.indStudentId) {
        DesempenoEngine.setGeneralRating(evalState.indStudentId, lvl, onlyPending, evalState.trimester);
        renderDesempenoIndividual(getStudentsList().find(s => s.id === evalState.indStudentId), evalState.trimester);
        if (typeof toast === 'function') toast(`Nivel ${lvl} asignado a los indicadores.`);
      }
    },
    'eval-ind-set-cat-level': btn => {
      const cat = btn?.dataset?.cat;
      const lvl = btn?.dataset?.level;
      if (cat && lvl && evalState.indStudentId) {
        DesempenoEngine.setCategoryRating(evalState.indStudentId, cat, lvl, false, evalState.trimester);
        renderDesempenoIndividual(getStudentsList().find(s => s.id === evalState.indStudentId), evalState.trimester);
        if (typeof toast === 'function') toast(`Nivel ${lvl} asignado a la categoría.`);
      }
    },
    'eval-ind-set-indicator-level': btn => {
      const sId = btn?.dataset?.studentId || evalState.indStudentId;
      const ind = btn?.dataset?.ind;
      const lvl = btn?.dataset?.level;
      if (sId && ind) {
        const ratingVal = lvl === 'none' ? null : lvl;
        DesempenoEngine.setIndicatorRating(sId, ind, ratingVal, evalState.trimester);
        if (evalState.activeTab === 'captura-grupal') {
          renderCapturaGrupal();
        } else {
          renderDesempenoIndividual(getStudentsList().find(s => s.id === sId), evalState.trimester);
        }
      }
    },
    'eval-ind-desempeno-undo': () => {
      const undone = DesempenoEngine.undoLastOperation(evalState.indStudentId, evalState.trimester);
      if (undone) {
        renderDesempenoIndividual(getStudentsList().find(s => s.id === evalState.indStudentId), evalState.trimester);
        if (typeof toast === 'function') toast('Última valoración masiva deshecha con éxito.');
      }
    },
    'eval-open-copy-trimester-modal': () => openCopyTrimesterModal(),
    'eval-close-copy-trimester-modal': () => closeCopyTrimesterModal(),
    'eval-confirm-copy-trimester': () => confirmCopyTrimester(),
    'eval-save-desempeno-draft': () => {
      saveDesempenoStore();
      if (typeof toast === 'function') toast('Borrador de desempeño integral guardado localmente.');
    },
    'eval-open-message-bank-modal': () => openMessageBankModal(),
    'eval-close-message-bank-modal': () => closeMessageBankModal(),
    'eval-insert-banco-recommendation': btn => {
      const recId = btn?.dataset?.recId;
      const rec = DesempenoEngine.getBancoMensajes().find(r => r.id === recId);
      if (rec && evalState.indStudentId) {
        DesempenoEngine.setStudentMessage(evalState.indStudentId, rec.text, evalState.trimester, rec.id);
        closeMessageBankModal();
        renderMensajeIndividual(getStudentsList().find(s => s.id === evalState.indStudentId), evalState.trimester);
        if (typeof toast === 'function') toast('Recomendación insertada en la evaluación del alumno.');
      }
    },
    'eval-add-banco-recommendation': () => {
      const cat = document.getElementById('evalNewRecCategory')?.value || 'general';
      const lvl = document.getElementById('evalNewRecLevel')?.value || 'E';
      const txt = (document.getElementById('evalNewRecText')?.value || '').trim();
      if (!txt) {
        if (typeof toast === 'function') toast('Escribe el texto de la recomendación antes de guardar.');
        return;
      }
      DesempenoEngine.addBancoMessage({ category: cat, level: lvl, text: txt });
      const txtInput = document.getElementById('evalNewRecText');
      if (txtInput) txtInput.value = '';
      renderBancoMensajesModal();
      if (typeof toast === 'function') toast('Nueva recomendación agregada al banco con éxito.');
    },
    'eval-save-student-message': () => {
      saveMensajesStore();
      if (typeof toast === 'function') toast('Mensaje familiar guardado localmente.');
    },
    'eval-clear-student-message': () => {
      if (evalState.indStudentId) {
        DesempenoEngine.setStudentMessage(evalState.indStudentId, '', evalState.trimester);
        renderMensajeIndividual(getStudentsList().find(s => s.id === evalState.indStudentId), evalState.trimester);
      }
    },
    'eval-ind-execute-jump': () => {
      const jumpType = document.getElementById('evalIndJumpSelect')?.value || 'pending-all';
      const students = getStudentsList();
      if (!students || !students.length) return;
      const curIdx = students.findIndex(s => String(s.id) === String(evalState.indStudentId));
      let foundId = null;

      for (let i = 1; i <= students.length; i++) {
        const idx = (curIdx + i) % students.length;
        const s = students[idx];
        if (jumpType === 'pending-all') {
          const st = DesempenoEngine.getStudentOverallStatus(s.id, evalState.trimester);
          if (!st.isReadyToClose) { foundId = s.id; break; }
        } else if (jumpType === 'pending-grades') {
          const ev = calculateStudentFullEvaluation(s.id, evalState.trimester);
          if (!ev.isAllAuthorized) { foundId = s.id; break; }
        } else if (jumpType === 'pending-desempeno') {
          const des = DesempenoEngine.getStudentEvaluation(s.id, evalState.trimester);
          if (!des.isComplete) { foundId = s.id; break; }
        } else if (jumpType === 'pending-message') {
          const msg = DesempenoEngine.getStudentMessage(s.id, evalState.trimester);
          if (!msg.isValid) { foundId = s.id; break; }
        }
      }

      if (foundId) {
        evalState.indStudentId = foundId;
        renderCapturaIndividual();
      } else {
        if (typeof toast === 'function') toast('No hay más alumnos pendientes con el criterio seleccionado.');
      }
    },
    'eval-open-mass-desempeno-modal': () => {
      const cat = evalState.desempenoCategoryFilter;
      const ind = evalState.desempenoIndicatorFilter;
      const lvl = (evalState.desempenoLevelFilter !== 'all' && evalState.desempenoLevelFilter !== 'pending') 
        ? evalState.desempenoLevelFilter 
        : 'E';
      const students = getStudentsList();

      if (ind !== 'all') {
        DesempenoEngine.setGroupIndicatorRating(students.map(s => s.id), ind, lvl, evalState.trimester);
        if (typeof toast === 'function') toast(`Nivel ${lvl} asignado al grupo para el indicador.`);
      } else {
        students.forEach(s => {
          if (cat === 'all') DesempenoEngine.setGeneralRating(s.id, lvl, false, evalState.trimester);
          else DesempenoEngine.setCategoryRating(s.id, cat, lvl, false, evalState.trimester);
        });
        if (typeof toast === 'function') toast(`Nivel ${lvl} asignado masivamente a los alumnos.`);
      }
      renderCapturaGrupal();
    },
    'eval-close-confirm-modal': () => {
      const m = document.getElementById('evalConfirmModal');
      if (m) {
        m.style.display = 'none';
        m.classList.add('hidden-control');
      }
    },
    'eval-sync-now': () => {
      EvalSyncEngine.syncTrimesterBatch(evalState.trimester);
    },
    'eval-open-draft-migration-modal': () => {
      EvalSyncEngine.openDraftMigrationModal();
    },
    'eval-close-draft-migration-modal': () => {
      EvalSyncEngine.closeDraftMigrationModal();
    },
    'eval-execute-draft-migration': () => {
      EvalSyncEngine.executeDraftMigration();
    },
    'eval-approve-banco-rec': btn => {
      const recId = btn?.dataset?.recId;
      if (recId) {
        DesempenoEngine.approveBancoMessage(recId);
        renderBancoMensajesModal();
        if (typeof toast === 'function') toast('Propuesta aprobada como recomendación docente.');
      }
    },
    'eval-toggle-banco-rec': btn => {
      const recId = btn?.dataset?.recId;
      if (recId) {
        DesempenoEngine.toggleBancoMessageActive(recId);
        renderBancoMensajesModal();
      }
    },
    'eval-confirm-review-desempeno': () => {
      if (evalState.indStudentId) {
        DesempenoEngine.confirmReview(evalState.indStudentId, evalState.trimester);
        const s = getStudentsList().find(stu => stu.id === evalState.indStudentId);
        renderDesempenoIndividual(s, evalState.trimester);
        if (typeof toast === 'function') toast('Valoraciones revisadas y confirmadas correctamente.');
      }
    }
  });

  // Exportar funciones globales de la vista
  EvaluacionEngine.calculateStudentFullEvaluation = calculateStudentFullEvaluation;
  window.EvaluacionEngine = EvaluacionEngine;
  window.DesempenoEngine = DesempenoEngine;
  window.EvalSyncEngine = EvalSyncEngine;
  window.initEvaluacionesTrimestrales = initEvaluacionesTrimestrales;
  window.selectEvalTrimester = selectEvalTrimester;
  window.switchEvalTab = switchEvalTab;
  window.renderCalculoPreliminar = renderCalculoPreliminar;
  window.renderCapturaGrupal = renderCapturaGrupal;
  window.renderCapturaIndividual = renderCapturaIndividual;
  window.renderDesempenoIndividual = renderDesempenoIndividual;
  window.renderMensajeIndividual = renderMensajeIndividual;
  window.renderResumenIndividual = renderResumenIndividual;
  window.renderBancoMensajesModal = renderBancoMensajesModal;
  window.openMessageBankModal = openMessageBankModal;
  window.closeMessageBankModal = closeMessageBankModal;
  window.openCopyTrimesterModal = openCopyTrimesterModal;
  window.closeCopyTrimesterModal = closeCopyTrimesterModal;
  window.confirmCopyTrimester = confirmCopyTrimester;
  window.openPasteModal = openPasteModal;
  window.closePasteModal = closePasteModal;
  window.previewPaste = previewPaste;
  window.applyPaste = applyPaste;
  window.authorizeSubject = authorizeSubject;
  window.authorizeStudent = authorizeStudent;
  window.authorizeGroup = authorizeGroup;
  window.calculateStudentFullEvaluation = calculateStudentFullEvaluation;
  window.getStudentFieldData = getStudentFieldData;
  window.setStudentFieldData = setStudentFieldData;
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
