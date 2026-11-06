/* ==========================================================================
   CAPTURA RÁPIDA DE LA JORNADA (MÚLTIPLES ACTIVIDADES AL DÍA)
   Carpeta Académica - 4.º Grado
   ========================================================================== */

(function () {
  'use strict';

  let jornadaActivities = [
    { id: 'act-1', materia: 'Lenguajes', actividad: '', material: 'Lenguajes', tipoActividad: 'Clase', paginas: '' },
    { id: 'act-2', materia: 'Saberes y Pensamiento Científico', actividad: '', material: 'Saberes y Pensamiento Científico', tipoActividad: 'Clase', paginas: '' }
  ];
  let jornadaNextId = 3;
  let jornadaStudents = [];
  let jornadaEvaluations = {}; // { [studentId]: { trabajos: { [actId]: 'Completo' }, conducta: 'Adecuada', participacion: 'Media', observacionLibre: '' } }
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

  // Alternar entre modo Jornada (Múltiple) y modo Individual
  function switchMode(mode) {
    const btnJornada = document.getElementById('btnModeJornada');
    const btnSingle = document.getElementById('btnModeSingleActivity');
    const jornadaWrap = document.getElementById('jornadaWrap');
    const singleWrap = document.getElementById('classForm');

    if (!jornadaWrap || !singleWrap) return;

    if (mode === 'jornada') {
      btnJornada?.classList.add('primary');
      btnSingle?.classList.remove('primary');
      jornadaWrap.classList.remove('hidden-control');
      singleWrap.classList.add('hidden-control');
      initJornada();
    } else {
      btnSingle?.classList.add('primary');
      btnJornada?.classList.remove('primary');
      singleWrap.classList.remove('hidden-control');
      jornadaWrap.classList.add('hidden-control');
      if (typeof window.openClassForm === 'function') {
        window.openClassForm();
      }
    }
  }

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

    // Inicializar el trabajo de esta nueva actividad como Completo para los alumnos
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

  // Cargar asistencia y alumnos de la fecha
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
      jornadaStudents = allStudents.filter(s => presentIds.has(String(s.id)));

      // Inicializar evaluaciones si no existen
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
          // Asegurar que cada actividad existe
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
          notice.textContent = 'Primero guarda la asistencia de esta fecha para poder evaluar a los alumnos.';
        }
      } else if (!jornadaStudents.length) {
        if (notice) {
          notice.className = 'class-attendance-notice error';
          notice.textContent = 'No hay alumnos con asistencia o retardo en esta fecha.';
        }
      } else {
        if (notice) {
          const absent = registeredIds.length - jornadaStudents.length;
          notice.className = 'class-attendance-notice success';
          notice.textContent = `✓ ${jornadaStudents.length} alumnos presentes listos para calificar (${absent} ausentes no se incluirán).`;
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
      host.innerHTML = '<div class="empty-history"><strong>No hay alumnos disponibles para evaluar</strong><p>Selecciona una fecha con asistencia guardada o registra la asistencia primero.</p></div>';
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

      // Generar los botones pills para cada actividad
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
        <article class="evaluation-row" data-student="${escapeHtml(student.id)}" style="display:grid;grid-template-columns:190px 1fr auto;gap:12px;align-items:center;padding:12px 14px;margin-bottom:8px;background:#fff;border:1px solid #d7e1e9;border-radius:10px;">
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

  // Alternar estado de la pastilla de trabajo (Completo -> Incompleto -> No trabajó -> Completo)
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

    // Actualizar visualmente la pastilla sin recargar toda la lista
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

  // Acción rápida: Todos entregaron todas las actividades
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
    showToast('✓ Todas las actividades marcadas como entregadas para todos los alumnos');
  }

  // Acción rápida: Conducta adecuada a todos
  function markAllAdequate() {
    jornadaStudents.forEach(st => {
      if (!jornadaEvaluations[st.id]) {
        jornadaEvaluations[st.id] = { trabajos: {}, conducta: 'Adecuada', participacion: 'Media', observacionLibre: '' };
      }
      jornadaEvaluations[st.id].conducta = 'Adecuada';
      jornadaEvaluations[st.id].participacion = 'Media';
    });
    renderEvaluationList();
    showToast('✓ Conducta adecuada y participación media asignada a todos');
  }

  // Actualizar los contadores de la barra inferior
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

  // Guardar la jornada completa en Google Sheets / sistema
  async function saveJornada(e) {
    e.preventDefault();
    if (isSavingJornada) return;

    if (!jornadaStudents.length) {
      showToast('No hay alumnos presentes para calificar en la fecha seleccionada.', true);
      return;
    }

    // Validar que todas las actividades tengan nombre
    for (let i = 0; i < jornadaActivities.length; i++) {
      const act = jornadaActivities[i];
      if (!act.actividad || !act.actividad.trim()) {
        showToast(`Por favor escribe el nombre de la Actividad ${i + 1}.`, true);
        const card = document.querySelector(`.jornada-activity-card[data-act-id="${act.id}"] input[data-prop="actividad"]`);
        card?.focus();
        return;
      }
    }

    const date = document.getElementById('jornadaDate')?.value || getToday();
    const totalActs = jornadaActivities.length;
    const confirmMsg = `¿Guardar la jornada del ${date} con ${totalActs} actividades para ${jornadaStudents.length} alumnos?`;

    if (!confirm(confirmMsg)) return;

    isSavingJornada = true;
    const saveBtn = document.getElementById('btnSubmitJornada');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Guardando actividades…';
    }

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

      // Limpiar solo los nombres de actividades para la siguiente jornada
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
      showToast(`Error al guardar: ${err.message || 'Intente nuevamente'}. Se guardaron ${savedCount} de ${totalActs}.`, true);
    } finally {
      isSavingJornada = false;
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = `Guardar jornada completa (${jornadaActivities.length} actividades)`;
      }
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

  // Eventos de DOM
  document.addEventListener('DOMContentLoaded', () => {
    // Alternar modos
    document.getElementById('btnModeJornada')?.addEventListener('click', () => switchMode('jornada'));
    document.getElementById('btnModeSingleActivity')?.addEventListener('click', () => switchMode('single'));

    // Cambio de fecha
    document.getElementById('jornadaDate')?.addEventListener('change', e => {
      loadAttendanceForDate(e.target.value);
    });

    // Agregar actividad
    document.getElementById('btnAddJornadaActivity')?.addEventListener('click', addActivity);

    // Formulario submit
    document.getElementById('jornadaForm')?.addEventListener('submit', saveJornada);

    // Acciones de encabezado
    document.querySelector('[data-action="jornada-all-complete"]')?.addEventListener('click', markAllComplete);
    document.querySelector('[data-action="jornada-all-adequate"]')?.addEventListener('click', markAllAdequate);
    document.querySelector('[data-action="cancel-jornada"]')?.addEventListener('click', () => {
      if (confirm('¿Deseas limpiar las actividades de la jornada?')) {
        jornadaActivities = [
          { id: 'act-1', materia: 'Lenguajes', actividad: '', material: 'Lenguajes', tipoActividad: 'Clase', paginas: '' },
          { id: 'act-2', materia: 'Saberes y Pensamiento Científico', actividad: '', material: 'Saberes y Pensamiento Científico', tipoActividad: 'Clase', paginas: '' }
        ];
        renderActivitiesList();
        renderEvaluationList();
      }
    });

    // Delegación de clics y cambios en inputs
    document.addEventListener('click', e => {
      // Pastilla de trabajo de alumno
      const pill = e.target.closest('[data-action="toggle-pill"]');
      if (pill) {
        togglePill(pill);
        return;
      }

      // Quitar actividad
      const removeBtn = e.target.closest('[data-action="remove-jornada-act"]');
      if (removeBtn) {
        removeActivity(removeBtn.dataset.id);
        return;
      }
    });

    // Cambio de campos en las tarjetas de actividades
    document.addEventListener('input', e => {
      const field = e.target.closest('.j-field');
      if (field) {
        const card = field.closest('.jornada-activity-card');
        const actId = card?.dataset.actId;
        const prop = field.dataset.prop;
        const act = jornadaActivities.find(a => a.id === actId);
        if (act && prop) {
          act[prop] = field.value;
          // Si cambia el nombre de la actividad, refrescar texto de pastillas
          if (prop === 'actividad') {
            document.querySelectorAll(`.jornada-pill[data-act-id="${actId}"] span:last-child`).forEach((labelSpan, index) => {
              const actIndex = jornadaActivities.findIndex(a => a.id === actId);
              const actLabel = act.actividad ? (act.actividad.length > 20 ? act.actividad.slice(0, 18) + '…' : act.actividad) : `Act. ${actIndex + 1}`;
              labelSpan.textContent = `Act ${actIndex + 1}: ${actLabel}`;
            });
          }
        }
      }

      // Cambio en campos de alumno (conducta, participación, nota)
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

      const stField = e.target.closest('.j-student-field');
      if (stField) {
        const stId = stField.dataset.student;
        const fieldName = stField.dataset.field;
        if (stId && fieldName && jornadaEvaluations[stId]) {
          jornadaEvaluations[stId][fieldName] = stField.value;
        }
      }
    });
  });

  window.openJornadaCapture = function () {
    switchMode('jornada');
  };
})();
