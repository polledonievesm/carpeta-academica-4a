/* ==========================================================================
   REGISTRO DIARIO EN 2 PASOS, EVALUACIÓN POR PDA Y CONDUCTA SEMANAL
   Carpeta Académica - 4.º Grado
   ========================================================================== */

(function () {
  'use strict';

  const DRAFT_JORNADA_KEY = 'carpeta_academica_jornada_draft_v2';
  let currentDailyMode = 'jornada'; // 'jornada', 'single', 'consulta'
  let currentStep = 'activities'; // 'activities' (Paso 1) o 'evaluation' (Paso 2)
  let currentEvaluatingActId = null;

  // Actividades del día actual
  let jornadaActivities = [
    {
      id: 'act-1',
      materia: 'Lenguajes',
      actividad: '',
      material: 'Lenguajes',
      tipoActividad: 'Clase',
      paginas: '',
      pdaTema: '',
      saved: false
    },
    {
      id: 'act-2',
      materia: 'Saberes y Pensamiento Científico',
      actividad: '',
      material: 'Saberes y Pensamiento Científico',
      tipoActividad: 'Clase',
      paginas: '',
      pdaTema: '',
      saved: false
    }
  ];
  let jornadaNextId = 3;

  // Alumnos y evaluaciones
  let allGroupStudents = [];
  let dayAttendanceMap = {}; // id -> { status: 'A'|'F'|'R'|'J', note: '' }
  let jornadaStudents = []; // Alumnos a evaluar (presentes + justificados)
  let jornadaEvaluations = {}; // actId -> { studentId -> { entrega, desempeno, observacion, conducta, nota, evaluated } }
  let isSavingJornada = false;

  function getToday() {
    if (typeof window.todayCancun === 'function') {
      return window.todayCancun();
    }
    return new Date().toISOString().slice(0, 10);
  }

  function showToast(msg, isError) {
    if (typeof window.toast === 'function') {
      window.toast(msg, isError);
    } else {
      alert(msg);
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function sortStudents(list) {
    if (typeof window.sortStudentsAlphabetically === 'function') {
      return window.sortStudentsAlphabetically(list);
    }
    return (list || []).slice().sort((a, b) => {
      const nameA = String(a.name || a.nombreCompleto || '').trim();
      const nameB = String(b.name || b.nombreCompleto || '').trim();
      return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
    });
  }

  function getSubjects() {
    if (window.state && Array.isArray(window.state.subjects) && window.state.subjects.length) {
      return window.state.subjects.map(s => s.nombre || s);
    }
    return [
      'Lenguajes',
      'Saberes y Pensamiento Científico',
      'Saberes y Pensamiento Matemático',
      'Ética, Naturaleza y Sociedades',
      'De lo Humano y lo Comunitario',
      'Inglés',
      'Educación Física',
      'Artes'
    ];
  }

  // Resolver ID de proyecto válido obligatorio para Google Sheets
  async function resolveValidProjectId(materia) {
    let projects = window.state?.projects || [];
    if (!projects.length && typeof window.server === 'function') {
      try {
        const boot = await window.server('getBootstrapDataLite');
        if (boot?.projects?.length) {
          window.state = Object.assign(window.state || {}, boot);
          projects = boot.projects;
        }
      } catch (e) {
        console.warn('Carga de proyectos para vinculación:', e);
      }
    }

    if (!projects.length) {
      return '';
    }

    const normMat = String(materia || '').trim().toLowerCase();

    // 1. Proyecto activo que coincida exactamente con la materia o campo formativo
    const matchActive = projects.find(p => p.estado === 'Activo' && (
      String(p.campoFormativo || '').toLowerCase() === normMat ||
      String(p.materia || '').toLowerCase() === normMat ||
      (normMat.includes('matemát') && String(p.campoFormativo || '').toLowerCase().includes('científico'))
    ));
    if (matchActive) return String(matchActive.id);

    // 2. Cualquier proyecto que coincida con el campo formativo
    const matchAny = projects.find(p => (
      String(p.campoFormativo || '').toLowerCase() === normMat ||
      String(p.materia || '').toLowerCase() === normMat ||
      (normMat.includes('matemát') && String(p.campoFormativo || '').toLowerCase().includes('científico'))
    ));
    if (matchAny) return String(matchAny.id);

    // 3. Primer proyecto activo disponible
    const anyActive = projects.find(p => p.estado === 'Activo');
    if (anyActive) return String(anyActive.id);

    // 4. Primer proyecto cualquiera del grupo
    return String(projects[0].id);
  }

  // Guardado continuo automático en borrador (localStorage)
  function saveDraftToStorage() {
    try {
      const dateInput = document.getElementById('jornadaDate');
      const date = dateInput?.value || getToday();
      const draft = {
        date,
        activities: jornadaActivities,
        evaluations: jornadaEvaluations,
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem(DRAFT_JORNADA_KEY + '_' + date, JSON.stringify(draft));
      showAutosaveIndicator();
    } catch (e) {
      console.warn('Error al guardar borrador local:', e);
    }
  }

  function restoreDraftFromStorage(date) {
    try {
      const raw = localStorage.getItem(DRAFT_JORNADA_KEY + '_' + date);
      if (!raw) return false;
      const draft = JSON.parse(raw);
      if (draft && draft.activities && draft.evaluations) {
        jornadaActivities = draft.activities;
        jornadaEvaluations = draft.evaluations;
        return true;
      }
    } catch (e) {}
    return false;
  }

  function clearDraftFromStorage(date) {
    try {
      localStorage.removeItem(DRAFT_JORNADA_KEY + '_' + date);
    } catch (e) {}
  }

  function showAutosaveIndicator() {
    const indicator = document.getElementById('jornadaAutosaveBadge');
    if (indicator) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      indicator.innerHTML = `<span style="color:#0a8754;font-weight:700;">✓ Borrador guardado automáticamente (${timeStr})</span>`;
      indicator.classList.remove('hidden-control');
    }
  }

  // Obtener lista de PDAs / Temas disponibles según la materia
  function getPdasForSubject(materia) {
    const list = [];
    const matNorm = String(materia || '').toLowerCase();

    // 1. Matemáticas
    if (matNorm.includes('matemát') || matNorm.includes('matemat') || matNorm.includes('científico') || matNorm.includes('cientifico')) {
      if (Array.isArray(window.BANCO_OBSERVACIONES_MATEMATICAS)) {
        const seenTemas = new Set();
        window.BANCO_OBSERVACIONES_MATEMATICAS.forEach(item => {
          if (item.tema && !seenTemas.has(item.tema)) {
            seenTemas.add(item.tema);
            list.push({
              area: 'Matemáticas',
              bloque: item.bloque || '',
              tema: item.tema,
              label: (item.bloque ? item.bloque + ': ' : '') + item.tema
            });
          }
        });
      }
    }

    // 2. Banco general de PDA (Lenguajes, Ética, De lo Humano, etc.)
    if (Array.isArray(window.BANCO_OBSERVACIONES_PDA)) {
      const seenPdas = new Set();
      window.BANCO_OBSERVACIONES_PDA.forEach(item => {
        const itemCampo = String(item.campo || '').toLowerCase();
        let match = false;
        if (matNorm.includes('lenguaje') && itemCampo.includes('lenguaje')) match = true;
        else if (matNorm.includes('ética') && itemCampo.includes('ética')) match = true;
        else if (matNorm.includes('humano') && itemCampo.includes('humano')) match = true;
        else if (matNorm.includes('científico') && itemCampo.includes('científico')) match = true;

        if (match && item.pda && !seenPdas.has(item.pda)) {
          seenPdas.add(item.pda);
          list.push({
            area: item.campo,
            bloque: item.contenido || '',
            tema: item.pda,
            label: item.pda
          });
        }
      });
    }

    return list;
  }

  // Obtener las 5 observaciones del banco para una materia, tema y nivel
  function getObservationsForPda(materia, temaOrPda, nivel) {
    const results = [];
    const normTema = String(temaOrPda || '').trim().toLowerCase();
    const normNivel = String(nivel || 'Logrado').trim().toLowerCase();

    // Buscar en Banco de Matemáticas
    if (Array.isArray(window.BANCO_OBSERVACIONES_MATEMATICAS) && normTema) {
      window.BANCO_OBSERVACIONES_MATEMATICAS.forEach(item => {
        if (String(item.tema || '').trim().toLowerCase() === normTema &&
            String(item.nivel || '').trim().toLowerCase() === normNivel) {
          results.push(item.texto);
        }
      });
    }

    // Buscar en Banco de PDA
    if (!results.length && Array.isArray(window.BANCO_OBSERVACIONES_PDA) && normTema) {
      window.BANCO_OBSERVACIONES_PDA.forEach(item => {
        if ((String(item.pda || '').trim().toLowerCase() === normTema ||
             String(item.contenido || '').trim().toLowerCase() === normTema) &&
            String(item.nivel || '').trim().toLowerCase() === normNivel) {
          results.push(item.texto);
        }
      });
    }

    // Observaciones pedagógicas predeterminadas si no se encontró el tema específico
    if (!results.length) {
      if (normNivel === 'logrado') {
        results.push(
          'Resuelve y realiza las actividades demostrando dominio del aprendizaje.',
          'Identifica con facilidad los conceptos y los aplica sin necesidad de ayuda.',
          'Explica con sus propias palabras los procedimientos y conceptos trabajados.',
          'Muestra constancia, orden, limpieza y precisión en sus trabajos diarios.',
          'Alcanzó satisfactoriamente el aprendizaje esperado programado para la jornada.'
        );
      } else if (normNivel === 'en proceso') {
        results.push(
          'Comprende el procedimiento básico, pero requiere afianzar algunos pasos.',
          'Muestra avances significativos, necesitando guía en ejercicios más complejos.',
          'Realiza la actividad con algunas indicaciones y acompañamiento docente.',
          'Resuelve ejercicios pero necesita revisar sus respuestas antes de entregar.',
          'Está en proceso de consolidar el aprendizaje esperado de la sesión.'
        );
      } else if (normNivel === 'requiere apoyo') {
        results.push(
          'Requiere apoyo personalizado y ejemplos sencillos para comprender el tema.',
          'Se le dificulta seguir los pasos requeridos sin acompañamiento cercano.',
          'Necesita mayor tiempo y práctica guiada para completar sus actividades.',
          'Requiere orientación constante para mantenerse enfocado en la tarea.',
          'Presenta dificultad en este aprendizaje; se sugiere practicar en casa.'
        );
      } else {
        results.push(
          'Pendiente de entrega (falta justificada con tolerancia de 5 días hábiles).',
          'Actividad pendiente por ausencia justificada del alumno.',
          'En espera de entrega para regularización académica.'
        );
      }
    }

    return results.slice(0, 5);
  }

  // Cambiar entre pestañas principales: 'jornada', 'single', 'consulta'
  function switchMode(mode) {
    currentDailyMode = mode;
    const btnJornada = document.getElementById('btnModeJornada');
    const btnSingle = document.getElementById('btnModeSingleActivity');
    const btnConsulta = document.getElementById('btnModeConsulta');

    const jornadaWrap = document.getElementById('jornadaWrap');
    const singleWrap = document.getElementById('classForm');
    const consultaWrap = document.getElementById('dailyConsultaWrap');

    btnJornada?.classList.toggle('primary', mode === 'jornada');
    btnSingle?.classList.toggle('primary', mode === 'single');
    btnConsulta?.classList.toggle('primary', mode === 'consulta');

    jornadaWrap?.classList.toggle('hidden-control', mode !== 'jornada');
    singleWrap?.classList.toggle('hidden-control', mode !== 'single');
    consultaWrap?.classList.toggle('hidden-control', mode !== 'consulta');

    if (mode === 'jornada') {
      showStep('activities');
      initJornada();
    } else if (mode === 'single') {
      if (typeof window.renderClassOptions === 'function') window.renderClassOptions();
      const dateEl = document.getElementById('classDate');
      if (dateEl && !dateEl.value) dateEl.value = getToday();
      if (typeof window.loadClassAttendance === 'function') window.loadClassAttendance();
    } else if (mode === 'consulta') {
      initConsultaView();
    }
  }
  window.switchDailyMode = switchMode;

  // Mostrar Paso 1 (actividades) o Paso 2 (calificar actividad)
  async function showStep(step, actId = null) {
    currentStep = step;
    currentEvaluatingActId = actId;

    const stepActivities = document.getElementById('jornadaActivitiesStep');
    const stepEvaluation = document.getElementById('jornadaEvaluationStep');

    if (step === 'activities') {
      stepActivities?.classList.remove('hidden-control');
      stepEvaluation?.classList.add('hidden-control');
      renderActivitiesList();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (step === 'evaluation') {
      stepActivities?.classList.add('hidden-control');
      stepEvaluation?.classList.remove('hidden-control');

      // Si la actividad ya estaba guardada en el servidor y no tenemos sus evaluaciones en memoria, cargarlas
      const act = jornadaActivities.find(a => a.id === actId);
      if (act && act.saved && act.serverClassId && typeof window.server === 'function') {
        try {
          const classData = await window.server('getClassRecord', act.serverClassId);
          if (classData && Array.isArray(classData.evaluations)) {
            if (!jornadaEvaluations[actId]) jornadaEvaluations[actId] = {};
            classData.evaluations.forEach(row => {
              jornadaEvaluations[actId][row.alumnoId] = {
                entrega: row.trabajo === 'Completo' ? 'Entregado' : (row.trabajo === 'No trabajó' ? 'No entregado' : (row.trabajo || 'Entregado')),
                desempeno: row.desempeno || 'Logrado',
                observacion: row.observacionLibre || '',
                conducta: row.conducta || 'Positiva',
                nota: '',
                evaluated: Boolean(row.trabajo && row.trabajo !== 'Pendiente')
              };
            });
          }
        } catch (e) {
          console.warn('Carga de evaluaciones de la actividad:', e);
        }
      }

      renderEvaluationView(actId);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // Navegación de fecha (Anterior, Siguiente, Hoy)
  function changeDateByOffset(offset) {
    const input = document.getElementById('jornadaDate');
    if (!input || !input.value) return;
    const parts = input.value.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() + offset);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    input.value = `${y}-${m}-${day}`;
    loadAttendanceForDate(input.value);
  }

  // Cargar asistencia y actividades existentes de la fecha
  async function loadAttendanceForDate(date) {
    const notice = document.getElementById('jornadaAttendanceNotice');
    const justAlert = document.getElementById('jornadaJustifiedAlert');
    const justText = document.getElementById('jornadaJustifiedText');
    if (!date) return;

    if (notice) {
      notice.className = 'class-attendance-notice';
      notice.textContent = 'Consultando asistencia y actividades de la fecha…';
    }

    try {
      let dayData = null;
      let dailyReport = null;

      if (typeof window.server === 'function') {
        const [dData, dRep] = await Promise.all([
          window.server('getDayData', date).catch(() => null),
          window.server('getDailyAcademicReport', date).catch(() => null)
        ]);
        dayData = dData;
        dailyReport = dRep;
      }

      const existing = dayData?.existing || {};
      const registeredIds = Object.keys(existing);
      dayAttendanceMap = {};

      const presentIds = new Set();
      const justifiedIds = new Set();
      const absentIds = new Set();

      registeredIds.forEach(id => {
        const val = existing[id];
        const st = String(typeof val === 'object' ? (val?.status || '') : val).trim().toUpperCase();
        const note = typeof val === 'object' ? (val?.note || '') : '';
        dayAttendanceMap[id] = { status: st, note: note };

        if (st === 'A' || st === 'R' || st === 'PRESENTE' || st === 'RETARDO') {
          presentIds.add(String(id));
          const num = Number(id);
          if (!isNaN(num)) presentIds.add(String(num));
        } else if (st === 'J' || st === 'JUSTIFICADO' || st === 'JUSTIFICADA') {
          justifiedIds.add(String(id));
          const num = Number(id);
          if (!isNaN(num)) justifiedIds.add(String(num));
        } else if (st === 'F' || st === 'FALTA') {
          absentIds.add(String(id));
          const num = Number(id);
          if (!isNaN(num)) absentIds.add(String(num));
        }
      });

      // Obtener todos los alumnos del grupo
      let allStudents = (window.state && Array.isArray(window.state.students) && window.state.students.length > 0)
        ? window.state.students
        : (window.state?.attendance?.students || []);

      if (!allStudents.length && typeof window.server === 'function') {
        try {
          const boot = await window.server('getBootstrapDataLite');
          if (boot?.students?.length) {
            window.state = Object.assign(window.state || {}, boot);
            allStudents = boot.students;
          }
        } catch (e) {
          console.warn('Carga diferida de alumnos:', e);
        }
      }

      allGroupStudents = sortStudents(allStudents);

      // Alumnos a evaluar: Presentes y Justificados (para regularización)
      jornadaStudents = allGroupStudents.filter((s, idx) => {
        const sid = String(s.id);
        const snum = Number(s.id);
        const isPres = presentIds.has(sid) || (!isNaN(snum) && presentIds.has(String(snum))) || presentIds.has(String(idx + 1));
        const isJust = justifiedIds.has(sid) || (!isNaN(snum) && justifiedIds.has(String(snum))) || justifiedIds.has(String(idx + 1));
        return isPres || isJust;
      });

      // 1. Si el servidor tiene actividades registradas en esta fecha, cargarlas
      if (dailyReport && Array.isArray(dailyReport.activities) && dailyReport.activities.length > 0) {
        jornadaActivities = dailyReport.activities.map((a, i) => {
          const pdaStr = a.instrucciones ? String(a.instrucciones).replace(/^PDA:s*/i, '').trim() : '';
          return {
            id: 'srv-act-' + (a.id || i + 1),
            serverClassId: a.id || '',
            materia: a.subject || 'Lenguajes',
            actividad: a.name || 'Actividad del día',
            material: a.material || a.subject || 'Lenguajes',
            tipoActividad: a.tipoActividad || 'Clase',
            paginas: a.paginas || '',
            pdaTema: pdaStr || a.name || '',
            saved: true
          };
        });
      } else {
        // Intentar restaurar borrador guardado localmente si existe
        const hasDraft = restoreDraftFromStorage(date);
        if (!hasDraft) {
          // Inicialización por defecto para día nuevo
          jornadaActivities = [
            { id: 'act-1', materia: 'Lenguajes', actividad: '', material: 'Lenguajes', tipoActividad: 'Clase', paginas: '', pdaTema: '', saved: false },
            { id: 'act-2', materia: 'Saberes y Pensamiento Científico', actividad: '', material: 'Saberes y Pensamiento Científico', tipoActividad: 'Clase', paginas: '', pdaTema: '', saved: false }
          ];
        }
      }

      // Asegurar que existen evaluaciones para cada alumno en cada actividad
      jornadaActivities.forEach(act => {
        if (!jornadaEvaluations[act.id]) jornadaEvaluations[act.id] = {};
        jornadaStudents.forEach(st => {
          if (!jornadaEvaluations[act.id][st.id]) {
            const att = dayAttendanceMap[st.id]?.status || '';
            const isJust = (att === 'J');
            jornadaEvaluations[act.id][st.id] = {
              entrega: isJust ? 'Pendiente' : 'Entregado',
              desempeno: isJust ? 'Pendiente' : 'Logrado',
              observacion: isJust ? 'Pendiente de entrega (falta justificada con tolerancia de 5 días).' : '',
              conducta: 'Positiva',
              nota: '',
              evaluated: false
            };
          }
        });
      });

      // Actualizar avisos de asistencia
      if (!registeredIds.length) {
        if (notice) {
          notice.className = 'class-attendance-notice error';
          notice.innerHTML = `⚠️ No se ha guardado el pase de lista de esta fecha. <button type="button" class="btn small primary" data-action="go-attendance-date" style="margin-left:8px;">Pasar lista ahora →</button>`;
        }
        if (justAlert) justAlert.classList.add('hidden-control');
      } else {
        if (notice) {
          const presCount = presentIds.size;
          const justCount = justifiedIds.size;
          notice.className = 'class-attendance-notice success';
          notice.textContent = `✓ ${presCount} alumno(s) presentes listos para calificar · ${absentIds.size} faltas · ${justCount} justificados.`;
        }

        if (justAlert && justText) {
          if (justifiedIds.size > 0) {
            justAlert.classList.remove('hidden-control');
            justText.textContent = `⏳ ${justifiedIds.size} alumno(s) con Justificante ("J") en esta fecha (tolerancia de 5 días hábiles para regularizar).`;
          } else {
            justAlert.classList.add('hidden-control');
          }
        }
      }

      renderActivitiesList();
    } catch (err) {
      if (notice) {
        notice.className = 'class-attendance-notice error';
        notice.textContent = 'Error al consultar asistencia: ' + (err.message || 'Verifica la conexión');
      }
    }
  }

  // Agregar actividad al día
  function addActivity() {
    const newAct = {
      id: 'act-' + (jornadaNextId++),
      materia: 'Lenguajes',
      actividad: '',
      material: 'Lenguajes',
      tipoActividad: 'Clase',
      paginas: '',
      pdaTema: '',
      saved: false
    };
    jornadaActivities.push(newAct);

    jornadaEvaluations[newAct.id] = {};
    jornadaStudents.forEach(st => {
      const att = dayAttendanceMap[st.id]?.status || '';
      const isJust = (att === 'J');
      jornadaEvaluations[newAct.id][st.id] = {
        entrega: isJust ? 'Pendiente' : 'Entregado',
        desempeno: isJust ? 'Pendiente' : 'Logrado',
        observacion: isJust ? 'Pendiente de entrega (falta justificada con tolerancia de 5 días).' : '',
        conducta: 'Positiva',
        nota: '',
        evaluated: false
      };
    });

    saveDraftToStorage();
    renderActivitiesList();
  }

  // Quitar actividad
  function removeActivity(actId) {
    if (jornadaActivities.length <= 1) {
      showToast('Debes mantener al menos una actividad en la jornada.', true);
      return;
    }
    jornadaActivities = jornadaActivities.filter(a => a.id !== actId);
    delete jornadaEvaluations[actId];
    saveDraftToStorage();
    renderActivitiesList();
  }

  // Contar estadísticas de cumplimiento para una actividad
  function calculateActivityStats(actId) {
    const evals = jornadaEvaluations[actId] || {};
    let entregados = 0;
    let incompletos = 0;
    let noEntregados = 0;
    let pendientes = 0;
    let calificadosCount = 0;

    jornadaStudents.forEach(st => {
      const e = evals[st.id] || {};
      const stEnt = e.entrega || 'Pendiente';

      if (e.evaluated || (stEnt !== 'Pendiente' && e.desempeno && e.desempeno !== 'Pendiente')) {
        calificadosCount++;
      }

      if (stEnt === 'Entregado' || stEnt === 'Completo') entregados++;
      else if (stEnt === 'Incompleto') incompletos++;
      else if (stEnt === 'No entregado' || stEnt === 'No trabajó') noEntregados++;
      else if (stEnt === 'Pendiente') pendientes++;
    });

    return {
      entregados,
      incompletos,
      noEntregados,
      pendientes,
      calificados: calificadosCount,
      total: jornadaStudents.length
    };
  }

  // Renderizar tarjetas de actividades del día (Paso 1)
  function renderActivitiesList() {
    const host = document.getElementById('jornadaActivitiesList');
    if (!host) return;

    const subjects = getSubjects();
    let html = '';

    jornadaActivities.forEach((act, index) => {
      const stats = calculateActivityStats(act.id);
      const pdas = getPdasForSubject(act.materia);

      let pdaOptionsHtml = '<option value="">-- Selecciona el PDA o aprendizaje evaluado --</option>';
      let lastGroup = '';
      pdas.forEach(p => {
        if (p.bloque && p.bloque !== lastGroup) {
          if (lastGroup) pdaOptionsHtml += '</optgroup>';
          pdaOptionsHtml += `<optgroup label="${escapeHtml(p.bloque)}">`;
          lastGroup = p.bloque;
        }
        const isSel = (act.pdaTema === p.tema || act.pdaTema === p.label);
        pdaOptionsHtml += `<option value="${escapeHtml(p.tema)}" ${isSel ? 'selected' : ''}>${escapeHtml(p.label)}</option>`;
      });
      if (lastGroup) pdaOptionsHtml += '</optgroup>';

      html += `
        <article class="jornada-activity-card" data-act-id="${escapeHtml(act.id)}" style="background:#fff;border:1px solid #d7e1e9;border-radius:12px;padding:16px;margin-bottom:14px;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="jornada-activity-badge">Actividad ${index + 1} de la jornada</span>
              <span class="badge" style="background:#e8f4f8;color:#0b315d;font-weight:700;">${escapeHtml(act.materia)}</span>
              ${act.saved ? '<span class="badge" style="background:#e6f9f0;color:#0a8754;font-size:0.7rem;font-weight:700;">✓ Guardada en Google</span>' : ''}
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <button type="button" class="btn primary small" data-action="open-eval-act" data-id="${escapeHtml(act.id)}" style="padding:5px 12px;font-weight:700;">
                ✏️ Calificar esta actividad
              </button>
              ${jornadaActivities.length > 1 ? `<button type="button" class="btn small danger" data-action="remove-jornada-act" data-id="${escapeHtml(act.id)}" style="padding:4px 9px;">✕ Quitar</button>` : ''}
            </div>
          </div>

          <!-- Campos de configuración rápida -->
          <div class="form-grid two" style="margin-bottom:10px;">
            <label style="font-weight:700;font-size:0.85rem;">Campo formativo o materia
              <select class="input j-field" data-prop="materia">
                ${subjects.map(s => `<option ${act.materia === s ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
              </select>
            </label>
            <label style="font-weight:700;font-size:0.85rem;">Nombre de la actividad realizada
              <input class="input j-field" data-prop="actividad" value="${escapeHtml(act.actividad)}" placeholder="Ej. Ejercicios de fracciones en el LTG" required>
            </label>
          </div>

          <!-- Selector de PDA del banco oficial -->
          <div style="margin-bottom:10px;">
            <label style="font-weight:700;font-size:0.85rem;color:#035388;">PDA o contenido a evaluar (Banco oficial)
              <select class="input j-field" data-prop="pdaTema" style="background:#f4f9fd;border-color:#b6d7ee;font-weight:600;">
                ${pdaOptionsHtml}
              </select>
            </label>
          </div>

          <div class="form-grid three" style="margin-bottom:12px;">
            <label style="font-size:0.82rem;">Cuaderno, libro o material
              <select class="input j-field" data-prop="material">
                <optgroup label="Cuadernos">
                  <option ${act.material === 'Lenguajes' ? 'selected' : ''}>Lenguajes</option>
                  <option ${act.material === 'Saberes y Pensamiento Matemático' ? 'selected' : ''}>Saberes y Pensamiento Matemático</option>
                  <option ${act.material === 'Saberes y Pensamiento Científico' ? 'selected' : ''}>Saberes y Pensamiento Científico</option>
                  <option ${act.material === 'Ética, Naturaleza y Sociedades' ? 'selected' : ''}>Ética, Naturaleza y Sociedades</option>
                  <option ${act.material === 'De lo Humano y lo Comunitario' ? 'selected' : ''}>De lo Humano y lo Comunitario</option>
                  <option ${act.material === 'Dibujo' ? 'selected' : ''}>Dibujo</option>
                  <option ${act.material === 'Ortografía' ? 'selected' : ''}>Ortografía</option>
                </optgroup>
                <optgroup label="Libros">
                  <option ${act.material === 'Libro de Texto Gratuito (LTG)' ? 'selected' : ''}>Libro de Texto Gratuito (LTG)</option>
                  <option ${act.material === 'La Guía Escolar' ? 'selected' : ''}>La Guía Escolar</option>
                  <option ${act.material === 'PRACMATICA' ? 'selected' : ''}>PRACMATICA</option>
                  <option ${act.material === 'C.A.P. (Comprender, Aprender y Practicar)' ? 'selected' : ''}>C.A.P. (Comprender, Aprender y Practicar)</option>
                </optgroup>
                <option ${act.material === 'Hoja de trabajo' ? 'selected' : ''}>Hoja de trabajo</option>
                <option ${act.material === 'Otro material' ? 'selected' : ''}>Otro material</option>
              </select>
            </label>
            <label style="font-size:0.82rem;">Tipo de actividad
              <select class="input j-field" data-prop="tipoActividad">
                <option ${act.tipoActividad === 'Clase' ? 'selected' : ''}>Clase</option>
                <option ${act.tipoActividad === 'Tarea para casa' ? 'selected' : ''}>Tarea para casa</option>
              </select>
            </label>
            <label style="font-size:0.82rem;">Páginas (opcional)
              <input class="input j-field" data-prop="paginas" value="${escapeHtml(act.paginas)}" placeholder="Ej. Págs. 34 a 37">
            </label>
          </div>

          <!-- Contadores de cumplimiento en vivo -->
          <div style="display:flex;align-items:center;justify-content:space-between;padding-top:10px;border-top:1px dashed #e2e8f0;flex-wrap:wrap;gap:8px;">
            <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
              <span class="jornada-stat-pill status-entregado">✓ ${stats.entregados} Entregaron</span>
              <span class="jornada-stat-pill status-incompleto">⚠️ ${stats.incompletos} Incompletos</span>
              <span class="jornada-stat-pill status-no-entrego">✕ ${stats.noEntregados} No entregaron</span>
              <span class="jornada-stat-pill status-pendiente">⏳ ${stats.pendientes} Pendientes</span>
            </div>
            <div>
              <button type="button" class="btn small" data-action="open-eval-act" data-id="${escapeHtml(act.id)}" style="background:#f0f7fb;color:#0b315d;border-color:#c4dff0;">
                📊 Ver y calificar alumnos (${stats.calificados} de ${stats.total}) →
              </button>
            </div>
          </div>
        </article>
      `;
    });

    host.innerHTML = html;
  }

  // Renderizar la pantalla de evaluación de una actividad específica (Paso 2)
  function renderEvaluationView(actId) {
    const act = jornadaActivities.find(a => a.id === actId);
    if (!act) {
      showStep('activities');
      return;
    }

    const titleEl = document.getElementById('evalStepActivityTitle');
    const metaEl = document.getElementById('evalStepActivityMeta');
    const countersBar = document.getElementById('evalCountersBar');
    const host = document.getElementById('jornadaSingleEvaluationList');

    if (titleEl) titleEl.textContent = act.actividad || 'Actividad sin título';
    if (metaEl) {
      metaEl.innerHTML = `
        <b>${escapeHtml(act.materia)}</b> · ${escapeHtml(act.material)} ${act.paginas ? '(' + escapeHtml(act.paginas) + ')' : ''}
        ${act.pdaTema ? `<br><span class="jornada-pda-badge">🎯 PDA: ${escapeHtml(act.pdaTema)}</span>` : ''}
        <span id="jornadaAutosaveBadge" style="margin-left:8px;font-size:0.75rem;"></span>
      `;
    }

    updateEvaluationCounters(actId);

    if (!host) return;
    if (!jornadaStudents.length) {
      host.innerHTML = '<div class="panel" style="text-align:center;padding:24px;"><p class="muted">No hay alumnos registrados con asistencia o justificación en esta fecha.</p></div>';
      return;
    }

    const evals = jornadaEvaluations[actId] || {};
    let html = '';

    jornadaStudents.forEach((student, index) => {
      const e = evals[student.id] || {
        entrega: 'Entregado',
        desempeno: 'Logrado',
        observacion: '',
        conducta: 'Positiva',
        nota: '',
        evaluated: false
      };

      const stName = typeof window.fullName === 'function' ? window.fullName(student) : (student.name || student.nombre || student.id);
      const attInfo = dayAttendanceMap[student.id]?.status || 'A';
      const isJustified = (attInfo === 'J');

      // Determinar si ya está calificado para resaltar en VERDE o ÁMBAR
      const isEvaluated = Boolean(e.evaluated || (e.entrega && e.entrega !== 'Pendiente'));

      let cardClass = 'eval-student-card';
      let statusBadge = '';

      if (isJustified) {
        cardClass += ' is-justified';
        statusBadge = '<span class="badge" style="background:#fffbe6;color:#874d00;border:1px solid #ffe58f;font-size:0.7rem;">⏳ Justificado (5 días)</span>';
      } else if (isEvaluated) {
        cardClass += ' is-evaluated';
        statusBadge = '<span class="badge" style="background:#e6f9f0;color:#0a8754;border:1px solid #b7eed4;font-size:0.72rem;font-weight:700;">✓ Calificado</span>';
      } else {
        cardClass += ' is-pending';
        statusBadge = '<span class="badge" style="background:#fff8e6;color:#b7791f;border:1px solid #fde2a8;font-size:0.72rem;font-weight:700;">⚠️ Sin calificar</span>';
      }

      // Observaciones sugeridas según el nivel seleccionado
      const observations = getObservationsForPda(act.materia, act.pdaTema, e.desempeno);
      let obsOptionsHtml = '<option value="">-- Selecciona observación del banco --</option>';
      observations.forEach((obs, obsIdx) => {
        const isSel = (e.observacion === obs);
        obsOptionsHtml += `<option value="${escapeHtml(obs)}" ${isSel ? 'selected' : ''}>Opción ${obsIdx + 1}: ${escapeHtml(obs)}</option>`;
      });

      html += `
        <article class="${cardClass}" data-student="${escapeHtml(student.id)}">
          <!-- Columna 1: Nombre del alumno y estatus -->
          <div>
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
              <span style="font-weight:800;color:#168f98;font-size:0.85rem;">${index + 1}.</span>
              <strong style="color:#17324d;font-size:0.9rem;">${escapeHtml(stName)}</strong>
            </div>
            <div>${statusBadge}</div>
          </div>

          <!-- Columna 2: Estado de Entrega -->
          <label style="margin:0;font-size:0.78rem;font-weight:700;">Entrega
            <select class="input j-eval-field" data-prop="entrega" style="padding:5px 8px;font-size:0.82rem;font-weight:700;">
              <option ${e.entrega === 'Entregado' ? 'selected' : ''}>Entregado</option>
              <option ${e.entrega === 'Incompleto' ? 'selected' : ''}>Incompleto</option>
              <option ${e.entrega === 'No entregado' ? 'selected' : ''}>No entregado</option>
              <option ${e.entrega === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
            </select>
          </label>

          <!-- Columna 3: Nivel de Desempeño -->
          <label style="margin:0;font-size:0.78rem;font-weight:700;">Desempeño
            <select class="input j-eval-field j-eval-nivel" data-prop="desempeno" style="padding:5px 8px;font-size:0.82rem;font-weight:700;">
              <option ${e.desempeno === 'Logrado' ? 'selected' : ''}>Logrado</option>
              <option ${e.desempeno === 'En proceso' ? 'selected' : ''}>En proceso</option>
              <option ${e.desempeno === 'Requiere apoyo' ? 'selected' : ''}>Requiere apoyo</option>
              <option ${e.desempeno === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
            </select>
          </label>

          <!-- Columna 4: Observación del PDA (Directa del banco) -->
          <div class="eval-col-full" style="display:flex;flex-direction:column;gap:4px;">
            <label style="margin:0;font-size:0.78rem;font-weight:700;color:#035388;">Observación del PDA (Banco de 3,000)
              <select class="input j-eval-field j-obs-select" data-prop="observacionSelect" style="padding:4px 6px;font-size:0.8rem;background:#f8fafc;">
                ${obsOptionsHtml}
              </select>
            </label>
            <input class="input j-eval-field j-obs-input" data-prop="observacion" value="${escapeHtml(e.observacion)}" placeholder="Texto final de la observación (editable)">
          </div>

          <!-- Columna 5: Conducta del día -->
          <div style="display:flex;flex-direction:column;gap:4px;">
            <label style="margin:0;font-size:0.78rem;font-weight:700;">Conducta diaria
              <select class="input j-eval-field" data-prop="conducta" style="padding:4px 6px;font-size:0.8rem;font-weight:700;">
                <option value="Positiva" ${e.conducta === 'Positiva' ? 'selected' : ''}>Positiva (10 pts)</option>
                <option value="Seguimiento" ${e.conducta === 'Seguimiento' ? 'selected' : ''}>Seguimiento (8 pts)</option>
                <option value="Requiere apoyo" ${e.conducta === 'Requiere apoyo' ? 'selected' : ''}>Requiere apoyo (5 pts)</option>
              </select>
            </label>
            <input class="input j-eval-field" data-prop="nota" value="${escapeHtml(e.nota || '')}" placeholder="Nota conducta (opc.)" style="padding:3px 6px;font-size:0.75rem;">
          </div>
        </article>
      `;
    });

    host.innerHTML = html;
  }

  // Actualizar los contadores superiores en tiempo real
  function updateEvaluationCounters(actId) {
    const countersBar = document.getElementById('evalCountersBar');
    const progressEl = document.getElementById('evalStepProgress');
    if (!countersBar) return;

    const stats = calculateActivityStats(actId);
    countersBar.innerHTML = `
      <span class="jornada-stat-pill status-entregado" style="font-size:0.82rem;padding:4px 10px;">✓ ${stats.entregados} Entregaron</span>
      <span class="jornada-stat-pill status-incompleto" style="font-size:0.82rem;padding:4px 10px;">⚠️ ${stats.incompletos} Incompletos</span>
      <span class="jornada-stat-pill status-no-entrego" style="font-size:0.82rem;padding:4px 10px;">✕ ${stats.noEntregados} No entregaron</span>
      <span class="jornada-stat-pill status-pendiente" style="font-size:0.82rem;padding:4px 10px;">⏳ ${stats.pendientes} Pendientes</span>
    `;

    if (progressEl) {
      progressEl.textContent = `${stats.calificados} de ${stats.total} alumnos calificados`;
    }
  }

  // Regla de las 5:20 PM: Cerrar y autocompletar no entregados
  function applyAutoClose520(actId) {
    if (!actId || !jornadaEvaluations[actId]) return;
    let modified = 0;

    jornadaStudents.forEach(st => {
      const e = jornadaEvaluations[actId][st.id];
      const att = dayAttendanceMap[st.id]?.status || '';
      const isJustified = (att === 'J');

      // Si el alumno estuvo presente y no se le marcó entrega o estaba sin evaluar
      if (!isJustified && (!e.evaluated || e.entrega === 'Pendiente' || !e.entrega)) {
        e.entrega = 'No entregado';
        e.desempeno = 'Requiere apoyo';
        e.observacion = 'No presentó la actividad en la fecha programada.';
        e.evaluated = true;
        modified++;
      }
    });

    saveDraftToStorage();
    renderEvaluationView(actId);
    showToast(`✓ Cierre aplicado: se marcaron ${modified} alumno(s) como 'No entregado' y 'Requiere apoyo'.`);
  }

  // Acciones masivas: Todos entregaron
  function markAllDelivered(actId) {
    if (!actId || !jornadaEvaluations[actId]) return;
    const act = jornadaActivities.find(a => a.id === actId);

    jornadaStudents.forEach(st => {
      const att = dayAttendanceMap[st.id]?.status || '';
      if (att !== 'J') {
        const e = jornadaEvaluations[actId][st.id];
        e.entrega = 'Entregado';
        e.desempeno = 'Logrado';
        e.evaluated = true;
        const obsList = getObservationsForPda(act?.materia, act?.pdaTema, 'Logrado');
        e.observacion = obsList[0] || 'Alcanzó satisfactoriamente el aprendizaje esperado del día.';
      }
    });

    saveDraftToStorage();
    renderEvaluationView(actId);
    showToast('✓ Todos los alumnos presentes marcados como Entregado (Logrado)');
  }

  // Acciones masivas: Conducta positiva a todos
  function markAllConductAdequate(actId) {
    if (!actId || !jornadaEvaluations[actId]) return;
    jornadaStudents.forEach(st => {
      const e = jornadaEvaluations[actId][st.id];
      e.conducta = 'Positiva';
    });
    saveDraftToStorage();
    renderEvaluationView(actId);
    showToast('✓ Conducta Positiva (10 pts) asignada a todos los alumnos');
  }

  // Guardar actividades de la jornada (Paso 1)
  async function saveJornadaActivitiesOnly(e) {
    if (e && e.preventDefault) e.preventDefault();
    const dateInput = document.getElementById('jornadaDate');
    const date = dateInput?.value || getToday();

    if (!jornadaActivities.length) {
      showToast('Agrega al menos una actividad.', true);
      return;
    }

    // Validar nombres
    for (let i = 0; i < jornadaActivities.length; i++) {
      if (!jornadaActivities[i].actividad.trim()) {
        showToast(`Escribe el nombre de la Actividad ${i + 1}.`, true);
        return;
      }
    }

    saveDraftToStorage();
    showToast(`✓ Se guardó la configuración de las ${jornadaActivities.length} actividades del día ${date}. Ahora puedes calificar cada una.`);
    renderActivitiesList();
  }

  // Guardar calificaciones de una actividad específica (Paso 2)
  async function saveSingleActivityEvaluations() {
    if (!currentEvaluatingActId) return;
    const act = jornadaActivities.find(a => a.id === currentEvaluatingActId);
    if (!act) return;

    const dateInput = document.getElementById('jornadaDate');
    const date = dateInput?.value || getToday();
    const saveBtn = document.getElementById('btnSaveActivityEvaluations');
    const saveBtnTop = document.getElementById('btnSaveActivityEvaluationsTop');

    if (isSavingJornada) return;
    isSavingJornada = true;

    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Guardando en Google Sheets…'; }
    if (saveBtnTop) { saveBtnTop.disabled = true; }

    try {
      // 1. Obtener ID de proyecto obligatorio para evitar "Selecciona un proyecto válido"
      const projectId = await resolveValidProjectId(act.materia);

      const evals = jornadaEvaluations[act.id] || {};
      const evaluacionesPayload = jornadaStudents.map(st => {
        const e = evals[st.id] || {};
        const rawEntrega = e.entrega || 'Pendiente';

        // Mapear al estándar que reconoce Google Sheets
        let trabajoStandard = 'Completo';
        if (rawEntrega === 'Incompleto') trabajoStandard = 'Incompleto';
        else if (rawEntrega === 'No entregado') trabajoStandard = 'No trabajó';
        else if (rawEntrega === 'Pendiente') trabajoStandard = 'Pendiente';

        return {
          alumnoId: st.id,
          trabajo: trabajoStandard,
          conducta: e.conducta || 'Positiva',
          participacion: 'Media',
          desempeno: e.desempeno || 'Pendiente',
          observacionLibre: e.observacion || (rawEntrega === 'Pendiente' ? 'Pendiente de entrega / regularización.' : '')
        };
      });

      const payload = {
        id: act.serverClassId || '', // Si ya existía, actualiza
        materia: act.materia,
        fecha: date,
        actividad: act.actividad.trim() || 'Actividad del día',
        material: act.material || act.materia,
        tipoActividad: act.tipoActividad || 'Clase',
        paginas: act.paginas || '',
        instrucciones: act.pdaTema ? ('PDA: ' + act.pdaTema) : '',
        proyectoId: projectId || '', // ID de proyecto válido
        horaInicio: '13:00',
        horaFin: '14:00',
        requestKey: `ACT-${Date.now()}-${act.id}`,
        evaluaciones: evaluacionesPayload
      };

      let result = null;
      if (typeof window.server === 'function') {
        result = await window.server('saveClassRecord', payload);
        if (result && result.activity && result.activity.id) {
          act.serverClassId = result.activity.id;
        }
      }

      act.saved = true;
      clearDraftFromStorage(date);

      // Notificar al sistema global que se guardó una actividad
      if (window.state && window.state.stats) {
        window.state.stats.activities = Number(window.state.stats.activities || 0) + (act.serverClassId ? 0 : 1);
        if (typeof window.renderStats === 'function') window.renderStats();
      }
      window.dispatchEvent(new CustomEvent('class-saved', { detail: payload }));

      showToast(`✓ Calificaciones guardadas exitosamente para: ${act.actividad}`);

      // Regresar al Paso 1 con contadores actualizados
      showStep('activities');
    } catch (err) {
      console.error('Error al guardar evaluaciones:', err);
      showToast('Error al guardar: ' + (err.message || 'Intente de nuevo'), true);
    } finally {
      isSavingJornada = false;
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Guardar calificaciones de la actividad'; }
      if (saveBtnTop) { saveBtnTop.disabled = false; }
    }
  }

  // Inicializar vista de jornada
  function initJornada() {
    const dateInput = document.getElementById('jornadaDate');
    if (dateInput && !dateInput.value) {
      dateInput.value = getToday();
    }
    const targetDate = dateInput?.value || getToday();
    loadAttendanceForDate(targetDate);
  }

  // Inicializar vista de historial y consulta (Paso 5: Cálculo semanal de conducta)
  function initConsultaView() {
    const dailyDate = document.getElementById('consultaDailyDate');
    const weekDate = document.getElementById('consultaWeekDate');
    const studentSelect = document.getElementById('consultaStudentSelect');

    if (dailyDate && !dailyDate.value) dailyDate.value = getToday();
    if (weekDate && !weekDate.value) weekDate.value = getToday();

    if (studentSelect) {
      const allStudents = (window.state && Array.isArray(window.state.students))
        ? window.state.students
        : (window.state?.attendance?.students || []);
      const sorted = sortStudents(allStudents);
      let html = '<option value="">Selecciona un alumno</option>';
      sorted.forEach(s => {
        const name = typeof window.fullName === 'function' ? window.fullName(s) : (s.name || s.nombre);
        html += `<option value="${escapeHtml(s.id)}">${escapeHtml(name)}</option>`;
      });
      studentSelect.innerHTML = html;
    }

    loadConsultaDaily();
  }

  async function loadConsultaDaily() {
    const host = document.getElementById('consultaDailyResults');
    const date = document.getElementById('consultaDailyDate')?.value || getToday();
    if (!host || !date) return;

    host.innerHTML = '<p class="muted" style="padding:16px;text-align:center;">Cargando actividades del día…</p>';

    try {
      let report = null;
      if (typeof window.server === 'function') {
        report = await window.server('getDailyAcademicReport', date);
      }

      if (!report || !report.activityCount) {
        host.innerHTML = `<div class="panel" style="text-align:center;padding:24px;"><p class="muted">No hay actividades registradas en la fecha <b>${escapeHtml(date)}</b>.</p></div>`;
        return;
      }

      const actsHtml = report.activities.map(a => `
        <div style="background:#fff;border:1px solid #d7e1e9;border-radius:8px;padding:10px 14px;margin-bottom:8px;">
          <span class="badge">${escapeHtml(a.subject || 'Materia')}</span>
          <strong style="margin-left:6px;color:#17324d;">${escapeHtml(a.name || 'Actividad')}</strong>
          <span class="muted" style="font-size:0.8rem;margin-left:8px;">(${escapeHtml(a.material || 'Clase')})</span>
        </div>
      `).join('');

      host.innerHTML = `
        <div class="stats" style="margin-bottom:14px;">
          <div class="stat"><b>${report.activityCount}</b><span>Actividades</span></div>
          <div class="stat"><b>${report.groups.complete.length}</b><span>Entregaron todo</span></div>
          <div class="stat"><b>${report.groups.partial.length}</b><span>Incompletas</span></div>
          <div class="stat"><b>${report.groups.none.length}</b><span>No trabajaron</span></div>
        </div>
        <h4 style="margin:12px 0 6px 0;">Actividades realizadas:</h4>
        ${actsHtml}
      `;
    } catch (err) {
      host.innerHTML = '<p class="muted" style="padding:16px;text-align:center;">No fue posible cargar el reporte del día.</p>';
    }
  }

  // Cálculo y reporte semanal con fórmula de conducta
  async function loadConsultaWeekly() {
    const host = document.getElementById('consultaWeeklyResults');
    const studentSelect = document.getElementById('consultaStudentSelect');
    const dateInput = document.getElementById('consultaWeekDate');
    const studentId = studentSelect?.value;
    const date = dateInput?.value || getToday();

    if (!host) return;
    if (!studentId) {
      host.innerHTML = '<p class="muted" style="padding:16px;text-align:center;">Selecciona un alumno para consultar sus actividades de la semana.</p>';
      return;
    }

    host.innerHTML = '<p class="muted" style="padding:16px;text-align:center;">Calculando historial y promedio de conducta semanal…</p>';

    try {
      let r = null;
      if (typeof window.server === 'function') {
        r = await window.server('getStudentAcademicReport', studentId, 'weekly', date);
      }

      if (!r || !r.summary) {
        host.innerHTML = '<p class="muted" style="padding:16px;text-align:center;">No hay registros académicos en esta semana para este alumno.</p>';
        return;
      }

      // CÁLCULO PROPORCIONAL DE CONDUCTA SEMANAL (Punto 5)
      // Positiva = 10 pts, Seguimiento = 8 pts, Requiere apoyo = 5 pts
      const days = r.attendance?.days || [];
      let totalPuntosConducta = 0;
      let diasEfectivosClase = 0;
      const desgloseDias = [];

      days.forEach(d => {
        if (!d.noClass && (d.status === 'A' || d.status === 'R')) {
          diasEfectivosClase++;
          // Buscar conducta registrada en las actividades de ese día
          const actsDia = (r.activities || []).filter(a => a.date === d.date);
          let conductaDia = 'Positiva';
          let notaDia = '';

          if (actsDia.length > 0) {
            const first = actsDia[0];
            conductaDia = first.conduct || 'Positiva';
            notaDia = first.observation || '';
          }

          let puntos = 10;
          if (conductaDia === 'Seguimiento') puntos = 8;
          else if (conductaDia === 'Requiere apoyo') puntos = 5;

          totalPuntosConducta += puntos;
          desgloseDias.push({
            dia: d.label || d.displayDate,
            conducta: conductaDia,
            puntos: puntos,
            nota: notaDia
          });
        }
      });

      const promedioConducta = diasEfectivosClase > 0
        ? (totalPuntosConducta / diasEfectivosClase).toFixed(1)
        : '10.0';

      let nivelConducta = 'Conducta adecuada';
      if (Number(promedioConducta) >= 9.0) nivelConducta = 'Excelente desempeño';
      else if (Number(promedioConducta) >= 7.5) nivelConducta = 'Seguimiento favorable';
      else nivelConducta = 'Requiere apoyo y acompañamiento';

      const desgloseHtml = desgloseDias.map(d => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:#f8fafc;border-radius:6px;margin-bottom:6px;">
          <div>
            <strong>${escapeHtml(d.dia)}:</strong>
            <span style="margin-left:6px;font-weight:600;">${escapeHtml(d.conducta)} (${d.puntos} pts)</span>
            ${d.nota ? `<small class="muted" style="display:block;margin-top:2px;">${escapeHtml(d.nota)}</small>` : ''}
          </div>
        </div>
      `).join('') || '<p class="muted">Sin días de asistencia en esta semana.</p>';

      host.innerHTML = `
        <div class="stats" style="margin-bottom:14px;">
          <div class="stat"><b>${r.summary.activities || 0}</b><span>Actividades</span></div>
          <div class="stat"><b>${r.summary.complete || 0}</b><span>Completas</span></div>
          <div class="stat"><b>${r.summary.partial || 0}</b><span>Incompletas</span></div>
          <div class="stat"><b>${r.summary.none || 0}</b><span>No realizadas</span></div>
        </div>

        <!-- Módulo de Conducta Semanal Proporcional -->
        <article class="panel" style="background:#f4fbfb;border:1px solid #bce4e3;border-radius:10px;padding:14px;margin-bottom:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <div>
              <p class="eyebrow" style="margin:0;color:#0d7a82;">EVALUACIÓN SEMANAL DE CONDUCTA</p>
              <h3 style="margin:2px 0;color:#0b315d;">Promedio: ${promedioConducta} / 10 · ${nivelConducta}</h3>
              <small class="muted">Calculado sobre ${diasEfectivosClase} día(s) hábiles con clase evaluada.</small>
            </div>
            <div style="font-size:1.8rem;font-weight:800;color:#0d7a82;">${promedioConducta}</div>
          </div>
          <div style="margin-top:8px;">
            <strong style="font-size:0.8rem;color:#17324d;">Detalle por día:</strong>
            <div style="margin-top:6px;">${desgloseHtml}</div>
          </div>
        </article>
      `;
    } catch (err) {
      host.innerHTML = '<p class="muted" style="padding:16px;text-align:center;">Error al cargar el reporte semanal.</p>';
    }
  }

  // Enlazar eventos de la interfaz
  function bindEvents() {
    // Sincronización automática cuando se guarde o actualice la asistencia en otra pestaña
    window.addEventListener('attendance-updated', () => {
      const dateInput = document.getElementById('jornadaDate');
      const curDate = dateInput?.value || getToday();
      loadAttendanceForDate(curDate);
    });

    // Modo tabs en Registro Diario
    document.getElementById('btnModeJornada')?.addEventListener('click', () => switchMode('jornada'));
    document.getElementById('btnModeSingleActivity')?.addEventListener('click', () => switchMode('single'));
    document.getElementById('btnModeConsulta')?.addEventListener('click', () => switchMode('consulta'));

    // Navegación de fecha
    document.getElementById('btnJornadaPrevDay')?.addEventListener('click', () => changeDateByOffset(-1));
    document.getElementById('btnJornadaNextDay')?.addEventListener('click', () => changeDateByOffset(1));
    document.getElementById('btnJornadaToday')?.addEventListener('click', () => {
      const input = document.getElementById('jornadaDate');
      if (input) {
        input.value = getToday();
        loadAttendanceForDate(input.value);
      }
    });
    document.getElementById('jornadaDate')?.addEventListener('change', e => {
      loadAttendanceForDate(e.target.value);
    });

    // Agregar actividad y limpiar
    document.getElementById('btnAddJornadaActivity')?.addEventListener('click', addActivity);
    document.getElementById('btnLimpiarJornada')?.addEventListener('click', () => {
      if (confirm('¿Limpiar las actividades capturadas para esta jornada?')) {
        jornadaActivities = [
          { id: 'act-1', materia: 'Lenguajes', actividad: '', material: 'Lenguajes', tipoActividad: 'Clase', paginas: '', pdaTema: '', saved: false }
        ];
        saveDraftToStorage();
        renderActivitiesList();
      }
    });

    // Guardar actividades de la jornada (Paso 1)
    document.getElementById('jornadaForm')?.addEventListener('submit', saveJornadaActivitiesOnly);
    document.getElementById('btnSubmitJornadaTop')?.addEventListener('click', saveJornadaActivitiesOnly);
    document.getElementById('btnSubmitJornadaBottom')?.addEventListener('click', saveJornadaActivitiesOnly);

    // Navegación entre Paso 1 y Paso 2
    document.getElementById('btnBackToJornadaActs')?.addEventListener('click', () => showStep('activities'));

    // Guardar evaluaciones de la actividad (Paso 2)
    document.getElementById('btnSaveActivityEvaluations')?.addEventListener('click', saveSingleActivityEvaluations);
    document.getElementById('btnSaveActivityEvaluationsTop')?.addEventListener('click', saveSingleActivityEvaluations);

    // Acciones masivas en Paso 2
    document.getElementById('btnEvalAllComplete')?.addEventListener('click', () => markAllDelivered(currentEvaluatingActId));
    document.getElementById('btnEvalAllAdequate')?.addEventListener('click', () => markAllConductAdequate(currentEvaluatingActId));
    document.getElementById('btnAutoClose520')?.addEventListener('click', () => applyAutoClose520(currentEvaluatingActId));

    // Delegación de clics
    document.addEventListener('click', e => {
      // Abrir calificación de una actividad
      const evalBtn = e.target.closest('[data-action="open-eval-act"]');
      if (evalBtn) {
        const actId = evalBtn.dataset.id;
        showStep('evaluation', actId);
        return;
      }

      // Quitar actividad
      const removeBtn = e.target.closest('[data-action="remove-jornada-act"]');
      if (removeBtn) {
        removeActivity(removeBtn.dataset.id);
        return;
      }

      // Enlace para ir a pasar lista
      const goAttBtn = e.target.closest('[data-action="go-attendance-date"]');
      if (goAttBtn) {
        if (typeof window.showView === 'function') {
          window.showView('attendance');
          const attDate = document.getElementById('attendanceDate');
          const jDate = document.getElementById('jornadaDate');
          if (attDate && jDate && jDate.value) {
            attDate.value = jDate.value;
            if (typeof window.loadAttendanceDay === 'function') window.loadAttendanceDay();
          }
        }
        return;
      }

      // Consulta de actividades
      if (e.target.closest('[data-action="run-consult-daily"]')) {
        loadConsultaDaily();
        return;
      }
      if (e.target.closest('[data-action="run-consult-weekly"]')) {
        loadConsultaWeekly();
        return;
      }
    });

    // Inputs dinámicos en Paso 1 (Actividades)
    document.addEventListener('input', e => {
      const field = e.target.closest('.j-field');
      if (field) {
        const card = field.closest('.jornada-activity-card');
        const actId = card?.dataset.actId;
        const prop = field.dataset.prop;
        const act = jornadaActivities.find(a => a.id === actId);
        if (act && prop) {
          act[prop] = field.value;
          // Si cambió la materia, recargar selector de PDA
          if (prop === 'materia') {
            renderActivitiesList();
          }
          saveDraftToStorage();
        }
      }

      // Inputs dinámicos en Paso 2 (Evaluaciones por alumno)
      const evalField = e.target.closest('.j-eval-field');
      if (evalField && currentEvaluatingActId) {
        const row = evalField.closest('.eval-student-card');
        const studentId = row?.dataset.student;
        const prop = evalField.dataset.prop;

        if (studentId && jornadaEvaluations[currentEvaluatingActId]?.[studentId]) {
          const evalItem = jornadaEvaluations[currentEvaluatingActId][studentId];
          evalItem.evaluated = true; // Marcado explícitamente

          if (prop === 'observacionSelect') {
            evalItem.observacion = evalField.value;
            const inputField = row.querySelector('.j-obs-input');
            if (inputField) inputField.value = evalField.value;
          } else if (prop === 'desempeno') {
            evalItem.desempeno = evalField.value;
            // Actualizar opciones del select de observaciones según el nuevo nivel
            const act = jornadaActivities.find(a => a.id === currentEvaluatingActId);
            const obsSelect = row.querySelector('.j-obs-select');
            if (obsSelect && act) {
              const newObs = getObservationsForPda(act.materia, act.pdaTema, evalField.value);
              let opts = '<option value="">-- Selecciona observación del banco --</option>';
              newObs.forEach((o, i) => {
                opts += `<option value="${escapeHtml(o)}">Opción ${i + 1}: ${escapeHtml(o)}</option>`;
              });
              obsSelect.innerHTML = opts;
              // Asignar primera opción automáticamente
              if (newObs.length) {
                evalItem.observacion = newObs[0];
                const inputField = row.querySelector('.j-obs-input');
                if (inputField) inputField.value = newObs[0];
              }
            }
          } else if (prop) {
            evalItem[prop] = evalField.value;
          }

          // Actualizar estado visual de la tarjeta (Verde si está calificado)
          const att = dayAttendanceMap[studentId]?.status || '';
          const isJustified = (att === 'J');
          if (!isJustified) {
            if (evalItem.entrega && evalItem.entrega !== 'Pendiente') {
              row.classList.add('is-evaluated');
              row.classList.remove('is-pending');
              const badgeWrap = row.querySelector('div > div:last-child');
              if (badgeWrap) badgeWrap.innerHTML = '<span class="badge" style="background:#e6f9f0;color:#0a8754;border:1px solid #b7eed4;font-size:0.72rem;font-weight:700;">✓ Calificado</span>';
            } else {
              row.classList.add('is-pending');
              row.classList.remove('is-evaluated');
              const badgeWrap = row.querySelector('div > div:last-child');
              if (badgeWrap) badgeWrap.innerHTML = '<span class="badge" style="background:#fff8e6;color:#b7791f;border:1px solid #fde2a8;font-size:0.72rem;font-weight:700;">⚠️ Sin calificar</span>';
            }
          }

          saveDraftToStorage();
          updateEvaluationCounters(currentEvaluatingActId);
        }
      }
    });

    // Cambio en select de alumno en consulta semanal
    document.getElementById('consultaStudentSelect')?.addEventListener('change', loadConsultaWeekly);
    document.getElementById('consultaWeekDate')?.addEventListener('change', loadConsultaWeekly);
    document.getElementById('consultaDailyDate')?.addEventListener('change', loadConsultaDaily);
  }

  // Inicialización global
  document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    // Exponer función de apertura para integración con app.js
    window.openJornadaCapture = function () {
      switchMode('jornada');
    };
  });
})();
