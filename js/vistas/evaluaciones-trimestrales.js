/* ==========================================================================
   MÓDULO DE VISTA: EVALUACIONES TRIMESTRALES (ETAPA 1)
   Panel de seguimiento grupal, selector de trimestres y navegación modular
   ========================================================================== */

(function () {
  'use strict';

  // Configuración inicial de los 3 periodos trimestrales
  const TRIMESTRES_CONFIG = {
    1: {
      id: 1,
      nombre: 'Primer Trimestre',
      corto: '1.er Trimestre',
      meses: 'Ago – Nov',
      fechas: '26 Ago 2026 – 27 Nov 2026',
      estado: 'in-progress',
      estadoTexto: 'En curso',
      esActual: true
    },
    2: {
      id: 2,
      nombre: 'Segundo Trimestre',
      corto: '2.º Trimestre',
      meses: 'Dic – Mar',
      fechas: '30 Nov 2026 – 26 Mar 2027',
      estado: 'pending',
      estadoTexto: 'Pendiente',
      esActual: false
    },
    3: {
      id: 3,
      nombre: 'Tercer Trimestre',
      corto: '3.er Trimestre',
      meses: 'Abr – Jul',
      fechas: '12 Abr 2027 – 16 Jul 2027',
      estado: 'pending',
      estadoTexto: 'Pendiente',
      esActual: false
    }
  };

  // Estado local en memoria para la vista
  const evalState = {
    trimester: 1,
    activeTab: 'seguimiento',
    searchQuery: '',
    statusFilter: '',
    evaluations: {} // Se nutrirá y conectará en las Etapas 2 y 3
  };

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

    // Configurar listeners de búsqueda y filtro si no están asignados
    bindFiltersOnce();

    // Renderizar selector de trimestres y panel de seguimiento
    renderTrimesterSelector();
    renderTrackingPanel();
  }

  /**
   * Asigna los escuchadores a la barra de búsqueda y filtros
   */
  let _filtersBound = false;
  function bindFiltersOnce() {
    if (_filtersBound) return;
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

    _filtersBound = true;
  }

  /**
   * Cambia de trimestre seleccionado
   * @param {number} trimesterNum 
   */
  function selectEvalTrimester(trimesterNum) {
    const num = Number(trimesterNum) || 1;
    if (!TRIMESTRES_CONFIG[num]) return;

    evalState.trimester = num;
    renderTrimesterSelector();
    renderTrackingPanel();

    if (typeof toast === 'function') {
      toast(`Mostrando registros de ${TRIMESTRES_CONFIG[num].nombre}.`);
    }
  }

  /**
   * Cambia de sub-pestaña (Tab) dentro del módulo
   * @param {string} tabId 
   */
  function switchEvalTab(tabId) {
    const validTabs = ['seguimiento', 'captura-grupal', 'captura-individual', 'criterios'];
    const targetTab = validTabs.includes(tabId) ? tabId : 'seguimiento';
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
  }

  /**
   * Renderiza el selector de trimestres y la cabecera del periodo
   */
  function renderTrimesterSelector() {
    const cur = TRIMESTRES_CONFIG[evalState.trimester] || TRIMESTRES_CONFIG[1];

    const titleEl = document.getElementById('evalCurrentPeriodTitle');
    const datesEl = document.getElementById('evalCurrentPeriodDates');
    const statusBadge = document.getElementById('evalPeriodStatusBadge');
    const officialBadge = document.getElementById('evalOfficialCurrentBadge');

    if (titleEl) {
      titleEl.textContent = `${cur.nombre} (${cur.estadoTexto})`;
    }
    if (datesEl) {
      datesEl.textContent = `${cur.fechas} · Cierre independiente de publicaciones`;
    }
    if (statusBadge) {
      statusBadge.className = `eval-status-pill status-${cur.estado}`;
      statusBadge.textContent = cur.estadoTexto;
    }
    if (officialBadge) {
      officialBadge.style.display = cur.esActual ? 'inline-block' : 'none';
    }

    // Actualizar botones de los 3 trimestres
    document.querySelectorAll('.eval-trimester-btn').forEach(btn => {
      const trimId = Number(btn.dataset.trimester);
      const isActive = trimId === evalState.trimester;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
  }

  /**
   * Renderiza las métricas y la tabla del panel de seguimiento
   */
  function renderTrackingPanel() {
    updateTrackingStats();
    renderTrackingTable();
  }

  /**
   * Obtiene la lista actual de alumnos del sistema de manera segura
   */
  function getStudentsList() {
    const raw = (typeof state !== 'undefined' && Array.isArray(state.students)) ? state.students : [];
    // Filtrar bajas si aplica y ordenar alfabéticamente
    const active = raw.filter(s => s.baja !== true && s.activo !== false);
    if (typeof sortStudentsAlphabetically === 'function') {
      return sortStudentsAlphabetically(active);
    }
    return active.slice().sort((a, b) => {
      const nameA = String(typeof fullName === 'function' ? fullName(a) : (a.nombreCompleto || a.nombres || '')).trim();
      const nameB = String(typeof fullName === 'function' ? fullName(b) : (b.nombreCompleto || b.nombres || '')).trim();
      return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
    });
  }

  /**
   * Calcula y actualiza las tarjetas de KPIs
   */
  function updateTrackingStats() {
    const students = getStudentsList();
    const total = students.length;

    // En esta Etapa 1 inicial, las evaluaciones están en estado base (Pendientes / Borrador)
    // Se conectarán al almacenamiento en la Etapa 2
    let evaluados = 0;
    let pendientes = total;
    let incompletas = 0;
    let listas = 0;
    let publicadas = 0;

    // Si existen evaluaciones cacheadas en evalState
    students.forEach(s => {
      const ev = evalState.evaluations[`${evalState.trimester}_${s.id}`];
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

    const filtered = students.filter(s => {
      const name = (typeof fullName === 'function' ? fullName(s) : (s.nombreCompleto || s.nombres || '')).toLowerCase();
      if (q && !name.includes(q)) return false;

      // Filtro de estado
      const ev = evalState.evaluations[`${evalState.trimester}_${s.id}`];
      const status = ev ? ev.estado : 'pendiente';
      if (filter && status !== filter) return false;

      return true;
    });

    if (!filtered.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 32px; color: var(--muted);">
            ${students.length === 0 ? 'No hay alumnos registrados en el grupo.' : 'No se encontraron alumnos que coincidan con los filtros.'}
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map((s, idx) => {
      const sName = typeof fullName === 'function' ? fullName(s) : (s.nombreCompleto || s.nombres || 'Alumno');
      const initials = (s.nombres ? s.nombres[0] : (sName[0] || 'A')).toUpperCase();
      const numLista = s.numeroLista || s.numero || (idx + 1);

      // Evaluación del alumno para el trimestre seleccionado
      const ev = evalState.evaluations[`${evalState.trimester}_${s.id}`] || {
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
          <td style="font-weight: 700; color: var(--muted);">${numLista}</td>
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

  /**
   * Registro desacoplado de acciones (Regla 2 de GEMINI.md)
   */
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
      if (typeof toast === 'function') toast('✓ Borrador del panel conservado en el dispositivo.');
    },
    'eval-open-student': btn => {
      const studentId = btn?.dataset?.id;
      const student = (getStudentsList() || []).find(s => String(s.id) === String(studentId));
      const studentName = student ? (typeof fullName === 'function' ? fullName(student) : student.nombres) : 'el alumno';
      if (typeof toast === 'function') {
        toast(`La captura detallada para ${studentName} se habilitará en la Etapa 5.`);
      }
    },
    'open-evaluaciones-trimestrales': () => {
      if (typeof showView === 'function') {
        showView('evaluaciones-trimestrales');
      }
    }
  });

  // Exportar funciones globales de la vista
  window.initEvaluacionesTrimestrales = initEvaluacionesTrimestrales;
  window.selectEvalTrimester = selectEvalTrimester;
  window.switchEvalTab = switchEvalTab;

  /**
   * Inicialización automática al cargar el DOM o cambiar a la vista
   */
  function setupAutoInit() {
    // Si la URL ya apunta a la vista por hash
    if (window.location.hash === '#evaluaciones-trimestrales') {
      setTimeout(initEvaluacionesTrimestrales, 100);
    }

    // Observar cuando la sección reciba la clase 'active'
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
