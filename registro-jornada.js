/* ==========================================================================
   CAPTURA RÁPIDA DE LA JORNADA Y CONSULTA DE ACTIVIDADES
   Carpeta Académica - 4.º Grado
   ========================================================================== */

(function () {
  'use strict';

  let currentMode = 'jornada'; // 'jornada', 'single', 'consulta'
  let jornadaActivities = [
    { id: 'act-1', materia: 'Lenguajes', actividad: '', material: 'Lenguajes', tipoActividad: 'Clase', paginas: '' },
    { id: 'act-2', materia: 'Saberes y Pensamiento Científico', actividad: '', material: 'Saberes y Pensamiento Científico', tipoActividad: 'Clase', paginas: '' }
  ];
  let jornadaNextId = 3;
  let jornadaStudents = [];
  let jornadaEvaluations = {};
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

  // Alternar entre: 'jornada' (Múltiple), 'single' (Individual) y 'consulta' (Historial)
  function switchMode(mode) {
    currentMode = mode;
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

  // Agregar una nueva actividad a la jornada
  function addActivity() {
    const newAct = {
      id: 'act-' + (jornadaNextId++),
      materia: 'Lenguajes',
      actividad: '',
      material: 'Lenguajes',
      tipoActividad: 'Clase',
      paginas: ''
    };
    jornadaActivities.push(newAct);

    jornadaStudents.forEach(st => {
      if (!jornadaEvaluations[st.id]) {
        jornadaEvaluations[st.id] = { trabajos: {}, conducta: 'Adecuada', participacion: 'Media', observacionLibre: '' };
      }
      if (!jornadaEvaluations[st.id].trabajos) {
        jornadaEvaluations[st.id].trabajos = {};
      }
      jornadaEvaluations[st.id].trabajos[newAct.id] = 'Completo';
    });

    renderActivitiesList();
    renderEvaluationList();
  }

  // Quitar una actividad de la jornada
  function removeActivity(actId) {
    if (jornadaActivities.length <= 1) {
      showToast('Debes mantener al menos una actividad en la jornada.', true);
      return;
    }
    jornadaActivities = jornadaActivities.filter(a => a.id !== actId);
    jornadaStudents.forEach(st => {
      if (jornadaEvaluations[st.id]?.trabajos) {
        delete jornadaEvaluations[st.id].trabajos[actId];
      }
    });
    renderActivitiesList();
    renderEvaluationList();
  }

  // Renderizar las tarjetas de actividades configuradas
  function renderActivitiesList() {
    const host = document.getElementById('jornadaActivitiesList');
    if (!host) return;

    const subjects = getSubjects();

    let html = '';
    jornadaActivities.forEach((act, index) => {
      const showDelete = jornadaActivities.length > 1;

      html += `
        <article class="jornada-activity-card" data-act-id="${escapeHtml(act.id)}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span class="jornada-activity-badge">Actividad ${index + 1} de la jornada</span>
            ${showDelete ? `<button type="button" class="btn small danger" data-action="remove-jornada-act" data-id="${escapeHtml(act.id)}" style="padding:2px 8px;font-size:0.75rem;">✕ Quitar</button>` : ''}
          </div>
          <div class="form-grid two" style="margin-bottom:8px;">
            <label>Campo formativo o materia
              <select class="input j-field" data-prop="materia">
                ${subjects.map(s => `<option ${s === act.materia ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
              </select>
            </label>
            <label>Nombre de la actividad realizada
              <input class="input j-field" data-prop="actividad" value="${escapeHtml(act.actividad)}" placeholder="Ej. Lectura compartida y cuestionario" required>
            </label>
          </div>
          <div class="form-grid three">
            <label>Cuaderno, libro o material
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
            <label>Tipo de actividad
              <select class="input j-field" data-prop="tipoActividad">
                <option ${act.tipoActividad === 'Clase' ? 'selected' : ''}>Clase</option>
                <option ${act.tipoActividad === 'Tarea para casa' ? 'selected' : ''}>Tarea para casa</option>
              </select>
            </label>
            <label>Páginas realizadas (opcional)
              <input class="input j-field" data-prop="paginas" value="${escapeHtml(act.paginas)}" placeholder="Ej. 34 a 37">
            </label>
          </div>
        </article>
      `;
    });

    host.innerHTML = html;
    updateCounters();
  }

  // Cargar asistencia y alumnos de la fecha (SOLO PRESENTES)
  async function loadAttendanceForDate(date) {
    const notice = document.getElementById('jornadaAttendanceNotice');
    if (!date) return;

    if (notice) {
      notice.className = 'class-attendance-notice';
      notice.textContent = 'Consultando asistencia de la fecha…';
    }

    try {
      let dayData = null;
      if (typeof window.server === 'function') {
        dayData = await window.server('getDayData', date);
      }

      const existing = dayData?.existing || {};
      const registeredIds = Object.keys(existing);
      const presentIds = new Set(registeredIds.filter(id => existing[id].status === 'A' || existing[id].status === 'R'));

      const allStudents = (window.state && Array.isArray(window.state.students)) ? window.state.students : [];
      // Ordenar alfabéticamente estricto de la A a la Z
      const sortedAll = sortStudents(allStudents);
      jornadaStudents = sortedAll.filter(s => presentIds.has(String(s.id)));

      // Inicializar evaluaciones para los alumnos presentes
      jornadaStudents.forEach(st => {
        if (!jornadaEvaluations[st.id]) {
          const trabajos = {};
          jornadaActivities.forEach(a => { trabajos[a.id] = 'Completo'; });
          jornadaEvaluations[st.id] = {
            trabajos: trabajos,
            conducta: 'Adecuada',
            participacion: 'Media',
            observacionLibre: ''
          };
        } else {
          if (!jornadaEvaluations[st.id].trabajos) jornadaEvaluations[st.id].trabajos = {};
          jornadaActivities.forEach(a => {
            if (!jornadaEvaluations[st.id].trabajos[a.id]) {
              jornadaEvaluations[st.id].trabajos[a.id] = 'Completo';
            }
          });
        }
      });

      if (!registeredIds.length) {
        if (notice) {
          notice.className = 'class-attendance-notice error';
          notice.innerHTML = `⚠️ No se ha guardado el pase de lista del día ${escapeHtml(date)}. <button type="button" class="btn small primary" data-action="go-attendance-date" style="margin-left:8px;">Pasar lista ahora →</button>`;
        }
      } else if (!jornadaStudents.length) {
        if (notice) {
          notice.className = 'class-attendance-notice error';
          notice.textContent = 'No hay alumnos con asistencia (A) o retardo (R) en esta fecha.';
        }
      } else {
        if (notice) {
          const absent = registeredIds.length - jornadaStudents.length;
          notice.className = 'class-attendance-notice success';
          notice.textContent = `✓ ${jornadaStudents.length} alumno(s) que asistieron listos para evaluar (${absent} ausentes no aparecen).`;
        }
      }

      renderEvaluationList();
      updateCounters();
    } catch (err) {
      if (notice) {
        notice.className = 'class-attendance-notice error';
        notice.textContent = 'Error al consultar asistencia: ' + (err.message || 'Verifica la conexión');
      }
    }
  }

  // Renderizar la matriz de evaluación de los alumnos
  function renderEvaluationList() {
    const host = document.getElementById('jornadaEvaluationList');
    if (!host) return;

    if (!jornadaStudents.length) {
      host.innerHTML = '<div class="empty-history"><strong>No hay alumnos disponibles para calificar</strong><p>Pasa lista primero en la sección de Asistencia para que aparezcan únicamente quienes asistieron.</p></div>';
      return;
    }

    let html = '';
    jornadaStudents.forEach((student, index) => {
      const evalData = jornadaEvaluations[student.id] || {
        trabajos: {},
        conducta: 'Adecuada',
        participacion: 'Media',
        observacionLibre: ''
      };
      const stName = typeof window.fullName === 'function' ? window.fullName(student) : (student.name || student.nombre || student.id);

      const pillsHtml = jornadaActivities.map((act, actIndex) => {
        const status = evalData.trabajos[act.id] || 'Completo';
        let statusClass = 'status-completo';
        let statusIcon = '✓';
        let statusTitle = 'Entregada completa';

        if (status === 'Incompleto') {
          statusClass = 'status-incompleto';
          statusIcon = '◐';
          statusTitle = 'Incompleta';
        } else if (status === 'No trabajó') {
          statusClass = 'status-no-trabajo';
          statusIcon = '✕';
          statusTitle = 'No entregada';
        }

        const actLabel = act.actividad ? (act.actividad.length > 20 ? act.actividad.slice(0, 18) + '…' : act.actividad) : `Act. ${actIndex + 1}`;

        return `
          <button type="button" class="jornada-pill ${statusClass}" data-action="toggle-pill" data-student="${escapeHtml(student.id)}" data-act-id="${escapeHtml(act.id)}" title="${escapeHtml(statusTitle)} - Haz clic para cambiar">
            <span class="j-icon">${statusIcon}</span>
            <span>Act ${actIndex + 1}: ${escapeHtml(actLabel)}</span>
          </button>
        `;
      }).join('');

      html += `
        <article class="evaluation-row" data-student="${escapeHtml(student.id)}" style="display:grid;grid-template-columns:200px 1fr auto;gap:12px;align-items:center;padding:12px 14px;margin-bottom:8px;background:#fff;border:1px solid #d7e1e9;border-radius:10px;">
          <div class="evaluation-student">
            <span style="font-weight:700;color:#168f98;margin-right:6px;">${index + 1}.</span>
            <strong style="color:#17324d;">${escapeHtml(stName)}</strong>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
            ${pillsHtml}
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <label style="margin:0;font-size:0.75rem;font-weight:700;">Conducta
              <select class="input j-student-field" data-student="${escapeHtml(student.id)}" data-field="conducta" style="padding:4px 6px;height:auto;font-size:0.8rem;">
                <option ${evalData.conducta === 'Adecuada' ? 'selected' : ''}>Adecuada</option>
                <option ${evalData.conducta === 'Excelente' ? 'selected' : ''}>Excelente</option>
                <option ${evalData.conducta === 'Requiere apoyo' ? 'selected' : ''}>Requiere apoyo</option>
              </select>
            </label>
            <label style="margin:0;font-size:0.75rem;font-weight:700;">Participación
              <select class="input j-student-field" data-student="${escapeHtml(student.id)}" data-field="participacion" style="padding:4px 6px;height:auto;font-size:0.8rem;">
                <option ${evalData.participacion === 'Media' ? 'selected' : ''}>Media</option>
                <option ${evalData.participacion === 'Alta' ? 'selected' : ''}>Alta</option>
                <option ${evalData.participacion === 'Nula' ? 'selected' : ''}>Nula</option>
              </select>
            </label>
            <label style="margin:0;font-size:0.75rem;font-weight:700;min-width:140px;">Nota opcional
              <input class="input j-student-field" data-student="${escapeHtml(student.id)}" data-field="observacionLibre" value="${escapeHtml(evalData.observacionLibre || '')}" placeholder="Opcional" style="padding:4px 6px;height:auto;font-size:0.8rem;">
            </label>
          </div>
        </article>
      `;
    });

    host.innerHTML = html;
  }

  // Alternar estado de la pastilla de trabajo
  function togglePill(btn) {
    const studentId = btn.dataset.student;
    const actId = btn.dataset.actId;
    if (!studentId || !actId) return;

    if (!jornadaEvaluations[studentId]) {
      jornadaEvaluations[studentId] = { trabajos: {}, conducta: 'Adecuada', participacion: 'Media', observacionLibre: '' };
    }
    const current = jornadaEvaluations[studentId].trabajos[actId] || 'Completo';
    let next = 'Completo';

    if (current === 'Completo') {
      next = 'Incompleto';
    } else if (current === 'Incompleto') {
      next = 'No trabajó';
    } else {
      next = 'Completo';
    }

    jornadaEvaluations[studentId].trabajos[actId] = next;

    btn.classList.remove('status-completo', 'status-incompleto', 'status-no-trabajo');
    const iconSpan = btn.querySelector('.j-icon');

    if (next === 'Completo') {
      btn.classList.add('status-completo');
      if (iconSpan) iconSpan.textContent = '✓';
      btn.title = 'Entregada completa - Haz clic para cambiar';
    } else if (next === 'Incompleto') {
      btn.classList.add('status-incompleto');
      if (iconSpan) iconSpan.textContent = '◐';
      btn.title = 'Incompleta - Haz clic para cambiar';
    } else {
      btn.classList.add('status-no-trabajo');
      if (iconSpan) iconSpan.textContent = '✕';
      btn.title = 'No entregada - Haz clic para cambiar';
    }
  }

  function markAllComplete() {
    jornadaStudents.forEach(st => {
      if (!jornadaEvaluations[st.id]) {
        jornadaEvaluations[st.id] = { trabajos: {}, conducta: 'Adecuada', participacion: 'Media', observacionLibre: '' };
      }
      jornadaActivities.forEach(a => {
        jornadaEvaluations[st.id].trabajos[a.id] = 'Completo';
      });
    });
    renderEvaluationList();
    showToast('✓ Todas las actividades marcadas como entregadas');
  }

  function markAllAdequate() {
    jornadaStudents.forEach(st => {
      if (!jornadaEvaluations[st.id]) {
        jornadaEvaluations[st.id] = { trabajos: {}, conducta: 'Adecuada', participacion: 'Media', observacionLibre: '' };
      }
      jornadaEvaluations[st.id].conducta = 'Adecuada';
      jornadaEvaluations[st.id].participacion = 'Media';
    });
    renderEvaluationList();
    showToast('✓ Conducta adecuada asignada a todos');
  }

  function updateCounters() {
    const badge = document.getElementById('jornadaSaveProgress');
    const saveBtn = document.getElementById('btnSubmitJornada');
    const totalActs = jornadaActivities.length;
    const totalStudents = jornadaStudents.length;

    if (badge) {
      badge.textContent = `${totalStudents} alumno(s) presentes · ${totalActs} actividad(es) configuradas`;
    }
    if (saveBtn) {
      saveBtn.textContent = `Guardar jornada completa (${totalActs} actividades)`;
    }
  }

  // Guardar la jornada completa
  async function saveJornada(e) {
    e.preventDefault();
    if (isSavingJornada) return;

    if (!jornadaStudents.length) {
      showToast('No hay alumnos presentes para calificar en la fecha seleccionada. Pasa lista primero.', true);
      return;
    }

    for (let i = 0; i < jornadaActivities.length; i++) {
      const act = jornadaActivities[i];
      if (!act.actividad || !act.actividad.trim()) {
        showToast(`Escribe el nombre de la Actividad ${i + 1}.`, true);
        const card = document.querySelector(`.jornada-activity-card[data-act-id="${act.id}"] input[data-prop="actividad"]`);
        card?.focus();
        return;
      }
    }

    const date = document.getElementById('jornadaDate')?.value || getToday();
    const totalActs = jornadaActivities.length;
    const confirmMsg = `¿Guardar la jornada del ${date} con ${totalActs} actividades para ${jornadaStudents.length} alumnos presentes?`;

    if (!confirm(confirmMsg)) return;

    isSavingJornada = true;
    const saveBtn = document.getElementById('btnSubmitJornada');
    const saveBtnTop = document.getElementById('btnSubmitJornadaTop');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Guardando…'; }
    if (saveBtnTop) { saveBtnTop.disabled = true; }

    let savedCount = 0;
    try {
      for (let i = 0; i < totalActs; i++) {
        const act = jornadaActivities[i];

        if (saveBtn) {
          saveBtn.textContent = `Guardando actividad ${i + 1} de ${totalActs} (${act.materia})…`;
        }

        const evaluaciones = jornadaStudents.map(student => {
          const evalData = jornadaEvaluations[student.id] || {};
          return {
            alumnoId: student.id,
            trabajo: evalData.trabajos?.[act.id] || 'Completo',
            conducta: evalData.conducta || 'Adecuada',
            participacion: evalData.participacion || 'Media',
            observacionLibre: evalData.observacionLibre || ''
          };
        });

        const payload = {
          materia: act.materia,
          fecha: date,
          actividad: act.actividad.trim(),
          material: act.material,
          tipoActividad: act.tipoActividad || 'Clase',
          paginas: act.paginas || '',
          instrucciones: '',
          proyectoId: '',
          horaInicio: `${13 + i}:00`,
          horaFin: `${14 + i}:00`,
          requestKey: `ACT-JORNADA-${Date.now()}-${i}`,
          evaluaciones: evaluaciones
        };

        if (typeof window.server === 'function') {
          await window.server('saveClassRecord', payload);
        }

        savedCount++;
      }

      showToast(`✓ Se guardaron exitosamente las ${savedCount} actividades de la jornada.`);

      jornadaActivities.forEach(a => {
        a.actividad = '';
        a.paginas = '';
      });
      renderActivitiesList();
      renderEvaluationList();

      if (window.state && window.state.stats) {
        window.state.stats.activities = Number(window.state.stats.activities || 0) + savedCount;
        if (typeof window.renderStats === 'function') window.renderStats();
      }
    } catch (err) {
      console.error('Error al guardar jornada:', err);
      showToast(`Error al guardar: ${err.message || 'Intente de nuevo'}. Se guardaron ${savedCount} de ${totalActs}.`, true);
    } finally {
      isSavingJornada = false;
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = `Guardar jornada completa (${jornadaActivities.length} actividades)`;
      }
      if (saveBtnTop) { saveBtnTop.disabled = false; }
    }
  }

  // Inicializar vista de jornada
  function initJornada() {
    const dateInput = document.getElementById('jornadaDate');
    if (dateInput && !dateInput.value) {
      dateInput.value = getToday();
    }
    const date = dateInput ? dateInput.value : getToday();
    renderActivitiesList();
    loadAttendanceForDate(date);
  }

  // --- SECCIÓN DE CONSULTA DE ACTIVIDADES (DÍA Y SEMANAL) ---
  function initConsultaView() {
    const dailyDate = document.getElementById('consultaDailyDate');
    const weekDate = document.getElementById('consultaWeekDate');
    const studentSelect = document.getElementById('consultaStudentSelect');

    if (dailyDate && !dailyDate.value) dailyDate.value = getToday();
    if (weekDate && !weekDate.value) weekDate.value = getToday();

    if (studentSelect) {
      const allStudents = (window.state && Array.isArray(window.state.students)) ? window.state.students : [];
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

    host.innerHTML = '<p class="muted" style="padding:16px;text-align:center;">Cargando historial semanal del alumno…</p>';

    try {
      let r = null;
      if (typeof window.server === 'function') {
        r = await window.server('getStudentAcademicReport', studentId, 'weekly', date);
      }

      if (!r || !r.activities || !r.activities.length) {
        host.innerHTML = `<div class="panel" style="text-align:center;padding:24px;"><p class="muted">No hay actividades registradas para este alumno en la semana del <b>${escapeHtml(date)}</b>.</p></div>`;
        return;
      }

      const actsHtml = r.activities.map(x => {
        let statusBadge = 'badge';
        if (x.work === 'Completo') statusBadge = 'badge success';
        else if (x.work === 'Incompleto') statusBadge = 'badge warning';
        else statusBadge = 'badge danger';

        return `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#fff;border:1px solid #d7e1e9;border-radius:8px;margin-bottom:8px;">
            <div>
              <span class="muted" style="font-size:0.75rem;">${escapeHtml(x.date)} · ${escapeHtml(x.subject)}</span>
              <h4 style="margin:2px 0 0 0;color:#17324d;">${escapeHtml(x.activity)}</h4>
            </div>
            <div style="display:flex;gap:8px;align-items:center;">
              <span class="${statusBadge}">${escapeHtml(x.work || 'Entregada')}</span>
              <small class="muted">Conducta: <b>${escapeHtml(x.conduct || 'Adecuada')}</b></small>
            </div>
          </div>
        `;
      }).join('');

      host.innerHTML = `
        <div style="background:#eaf3fa;padding:12px;border-radius:10px;margin-bottom:14px;">
          <h3 style="margin:0;color:#0b315d;">${escapeHtml(r.student.name)}</h3>
          <p class="muted" style="margin:4px 0 0 0;font-size:0.85rem;">Semana del ${escapeHtml(r.period)} · ${r.summary.activities} actividades registradas (${r.summary.complete} completas · ${r.summary.partial} incompletas · ${r.summary.none} no entregadas)</p>
        </div>
        ${actsHtml}
      `;
    } catch (err) {
      host.innerHTML = '<p class="muted" style="padding:16px;text-align:center;">No fue posible cargar el reporte semanal.</p>';
    }
  }

  // Inicialización de eventos al cargar el DOM
  document.addEventListener('DOMContentLoaded', () => {
    // Alternar los 3 modos
    document.getElementById('btnModeJornada')?.addEventListener('click', () => switchMode('jornada'));
    document.getElementById('btnModeSingleActivity')?.addEventListener('click', () => switchMode('single'));
    document.getElementById('btnModeConsulta')?.addEventListener('click', () => switchMode('consulta'));

    // Fechas y agregar actividad
    document.getElementById('jornadaDate')?.addEventListener('change', e => {
      loadAttendanceForDate(e.target.value);
    });

    document.getElementById('btnAddJornadaActivity')?.addEventListener('click', addActivity);
    document.getElementById('jornadaForm')?.addEventListener('submit', saveJornada);

    // Botones rápidos
    document.querySelector('[data-action="jornada-all-complete"]')?.addEventListener('click', markAllComplete);
    document.querySelector('[data-action="jornada-all-adequate"]')?.addEventListener('click', markAllAdequate);
    document.querySelector('[data-action="cancel-jornada"]')?.addEventListener('click', () => {
      if (confirm('¿Deseas reiniciar las actividades de la jornada?')) {
        jornadaActivities = [
          { id: 'act-1', materia: 'Lenguajes', actividad: '', material: 'Lenguajes', tipoActividad: 'Clase', paginas: '' },
          { id: 'act-2', materia: 'Saberes y Pensamiento Científico', actividad: '', material: 'Saberes y Pensamiento Científico', tipoActividad: 'Clase', paginas: '' }
        ];
        renderActivitiesList();
        renderEvaluationList();
      }
    });

    // Delegación de clics
    document.addEventListener('click', e => {
      const pill = e.target.closest('[data-action="toggle-pill"]');
      if (pill) {
        togglePill(pill);
        return;
      }

      const removeBtn = e.target.closest('[data-action="remove-jornada-act"]');
      if (removeBtn) {
        removeActivity(removeBtn.dataset.id);
        return;
      }

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

      const btnConsultDaily = e.target.closest('[data-action="run-consult-daily"]');
      if (btnConsultDaily) {
        loadConsultaDaily();
        return;
      }

      const btnConsultWeekly = e.target.closest('[data-action="run-consult-weekly"]');
      if (btnConsultWeekly) {
        loadConsultaWeekly();
        return;
      }
    });

    // Inputs de actividades
    document.addEventListener('input', e => {
      const field = e.target.closest('.j-field');
      if (field) {
        const card = field.closest('.jornada-activity-card');
        const actId = card?.dataset.actId;
        const prop = field.dataset.prop;
        const act = jornadaActivities.find(a => a.id === actId);
        if (act && prop) {
          act[prop] = field.value;
          if (prop === 'actividad') {
            document.querySelectorAll(`.jornada-pill[data-act-id="${actId}"] span:last-child`).forEach((labelSpan) => {
              const actIndex = jornadaActivities.findIndex(a => a.id === actId);
              const actLabel = act.actividad ? (act.actividad.length > 20 ? act.actividad.slice(0, 18) + '…' : act.actividad) : `Act. ${actIndex + 1}`;
              labelSpan.textContent = `Act ${actIndex + 1}: ${actLabel}`;
            });
          }
        }
      }

      const stField = e.target.closest('.j-student-field');
      if (stField) {
        const stId = stField.dataset.student;
        const fieldName = stField.dataset.field;
        if (stId && fieldName && jornadaEvaluations[stId]) {
          jornadaEvaluations[stId][fieldName] = stField.value;
        }
      }
    });

    document.addEventListener('change', e => {
      const field = e.target.closest('.j-field');
      if (field) {
        const card = field.closest('.jornada-activity-card');
        const actId = card?.dataset.actId;
        const prop = field.dataset.prop;
        const act = jornadaActivities.find(a => a.id === actId);
        if (act && prop) {
          act[prop] = field.value;
          if (prop === 'materia') {
            renderEvaluationList();
          }
        }
      }
    });
  });

  window.openJornadaCapture = function () {
    switchMode('jornada');
  };
})();
