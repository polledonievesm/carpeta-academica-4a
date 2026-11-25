/* ==========================================================================
   MÓDULO DE VISTA: ASISTENCIA DIARIA, MENSUAL Y REPORTES DE ASISTENCIA
   ========================================================================== */

let attendanceFetchPromise = null;
let attendanceRevalidatePromise = null;
let attendanceDayPromise = null;
let attendanceReportsCatalogPromise = null;
let attendanceSaving = false;
let attendanceDateSeq = 0;
let attendanceDataGen = 0;
let attendanceLoadStatus = 'idle'; // 'idle' | 'loading' | 'error' | 'ready'
let attendanceLastErrorMessage = '';

let attendanceViewMode = 'daily'; // 'daily' | 'monthly'
let attendanceMonthlyData = null;
let attendanceMonthlyStatus = 'idle'; // 'idle' | 'loading' | 'ready' | 'error'
let attendanceMonthlyError = '';
let attendanceMonthlyErrorType = 'general'; // 'action_unavailable' | 'session' | 'network' | 'general'
let attendanceMonthlyMonth = '';
let attendanceMonthlySeq = 0;
let attendanceMonthlyPromise = null;

// Estado de edición, foco y mutaciones de Captura mensual
let attendanceMonthlyMutations = new Map(); // key: `${studentId}|${date}` -> mutation object
let attendanceMonthlyFocusedCell = null; // { studentId, date }
let attendanceMonthlySaving = false;
let attendanceMonthlyConfirmedMutations = new Set(); // clientMutationIds confirmados para evitar reintentos con duplicado
let attendanceMonthlySyncedDataGen = 0; // sincronización con attendanceDataGen de Pase diario

function isAttendanceDateSynced(){
  const dateInput = $('#attendanceDate');
  if (!dateInput) return true;
  const selectedDate = dateInput.value;
  const dayDate = state.attendanceDay?.date;
  return Boolean(selectedDate && dayDate && selectedDate === dayDate);
}

function isAttendanceReady(){
  return attendanceLoadStatus === 'ready' &&
         !attendanceFetchPromise &&
         !attendanceDayPromise &&
         !attendanceSaving &&
         isAttendanceDateSynced();
}

function isAttendanceLocked(){
  return !isAttendanceReady();
}

function isAttendanceCaptureAllowed(){
  const day = state.attendanceDay || {};
  return isAttendanceReady() && !day.noClass && !day.isWeekend && !day.isOutsideCycle;
}

function syncAttendanceControlsState(){
  const ready = isAttendanceReady();
  const captureLocked = !isAttendanceCaptureAllowed();

  $$('[data-action="save-attendance"]').forEach(b => { b.disabled = captureLocked; });
  $$('[data-action="all-present"]').forEach(b => { b.disabled = captureLocked; });
  $$('[data-action="clear-day"]').forEach(b => { b.disabled = captureLocked; });
  $$('[data-action="attendance-today"]').forEach(b => { b.disabled = !ready; });
  $$('[data-action="no-class"]').forEach(b => { b.disabled = !ready; });

  const dateInput = $('#attendanceDate');
  if (dateInput) {
    dateInput.disabled = Boolean(attendanceFetchPromise) || attendanceSaving || (attendanceLoadStatus === 'loading' && !state.attendance);
  }

  $$('#attendanceList .status-button').forEach(btn => {
    btn.disabled = captureLocked;
  });
  $$('#attendanceList .attendance-note').forEach(input => {
    input.disabled = captureLocked;
  });
}

function isPlainRecordsObject(obj){
  return Boolean(obj && typeof obj === 'object' && !Array.isArray(obj));
}

function isValidDayData(data, expectedDate = null){
  if (!data || typeof data !== 'object') return false;
  if (typeof data.date !== 'string' || !data.date) return false;
  if (expectedDate && data.date !== expectedDate) return false;
  if (!isPlainRecordsObject(data.existing)) return false;
  return true;
}

function isValidInitialData(data){
  return Boolean(
    data &&
    typeof data === 'object' &&
    Array.isArray(data.students) &&
    typeof data.today === 'string' &&
    Boolean(data.today) &&
    isValidDayData(data.day, data.today)
  );
}

function getAttendanceStudents(){
  if (state.attendance && Array.isArray(state.attendance.students)) {
    return state.attendance.students;
  }
  if (Array.isArray(state.students) && state.students.length > 0) {
    return state.students
      .filter(s => s.activo !== false)
      .map(s => ({
        id: String(s.id),
        name: String(s.nombreCompleto || (typeof fullName === 'function' ? fullName(s) : '') || s.name || '').trim(),
        active: s.activo !== false
      }));
  }
  return [];
}

function syncDailyTopBarActions() {
  const topBar = document.querySelector('#attendance .attendance-top-bar');
  if (!topBar) return;
  let actionsWrap = topBar.querySelector('.attendance-daily-top-actions');
  if (!actionsWrap) {
    actionsWrap = document.createElement('div');
    actionsWrap.className = 'attendance-daily-top-actions';
    actionsWrap.innerHTML = `
      <button type="button" id="btnDailyNoClass" class="btn attendance-monthly-no-class-btn attendance-daily-no-class-btn" data-action="no-class" title="Registrar día sin clases">
        📅🚫 No hay clases
      </button>
      <button type="button" id="btnDailySave" class="btn primary attendance-save-btn attendance-daily-save-btn" data-action="save-attendance" title="Guardar asistencia del día">
        💾 Guardar
      </button>
    `;
    topBar.appendChild(actionsWrap);
  }
  const isDaily = (attendanceViewMode === 'daily');
  actionsWrap.style.display = isDaily ? 'inline-flex' : 'none';
}

function openAttendance(force = false, options = {}){
  if (!options.skipShowView && document.getElementById('attendance')?.classList.contains('active') !== true) {
    showView('attendance');
  }
  syncAttendanceModeSelector();
  syncDailyTopBarActions();
  syncAttendanceConsolidatedHeader();

  if (state.attendance && !force) {
    renderAttendance({ preserveCurrentSelection: true });
    if (!attendanceFetchPromise && !attendanceRevalidatePromise && (Date.now() - (state.attendanceLoadedAt || 0) > 300000)) {
      revalidateAttendanceInBackground();
    }
    return Promise.resolve();
  }

  if (attendanceFetchPromise) {
    return attendanceFetchPromise;
  }

  attendanceLoadStatus = 'loading';
  attendanceLastErrorMessage = '';
  renderAttendanceList();

  attendanceFetchPromise = (async () => {
    try {
      const data = await server('getInitialData');
      if (!isValidInitialData(data)) {
        throw new Error('La respuesta del servidor no contiene la estructura requerida.');
      }
      state.attendance = data;
      state.attendanceLoadedAt = Date.now();
      attendanceLoadStatus = 'ready';
      attendanceLastErrorMessage = '';
      renderAttendance({ isInitialServerLoad: true });
    } catch (err) {
      console.warn('Error al cargar datos iniciales de asistencia:', err);
      attendanceLoadStatus = 'error';
      attendanceLastErrorMessage = (err && err.message) ? err.message : 'No fue posible conectar con el servidor.';
      renderAttendanceList();
    } finally {
      attendanceFetchPromise = null;
      syncAttendanceControlsState();
    }
  })();

  syncAttendanceControlsState();
  return attendanceFetchPromise;
}

async function revalidateAttendanceInBackground(){
  if (attendanceRevalidatePromise || attendanceFetchPromise) {
    return attendanceRevalidatePromise || attendanceFetchPromise;
  }
  if (attendanceDayPromise || attendanceSaving || hasUnsavedAttendanceChanges()) {
    return;
  }

  const startingGen = attendanceDataGen;
  const startingSeq = attendanceDateSeq;
  const startingDate = $('#attendanceDate')?.value;

  attendanceRevalidatePromise = (async () => {
    try {
      const data = await server('getInitialData');
      if (!isValidInitialData(data)) return;

      // Invalida revalidaciones iniciadas antes de una escritura
      if (startingGen !== attendanceDataGen) {
        return;
      }

      // Omitir aplicar si hay lectura diaria, escritura o cambios locales pendientes
      if (attendanceDayPromise || attendanceSaving || hasUnsavedAttendanceChanges()) {
        return;
      }

      // Comprobar que la secuencia y la fecha siguen siendo las mismas que al iniciar la consulta
      if (startingSeq !== attendanceDateSeq || $('#attendanceDate')?.value !== startingDate) {
        return;
      }

      // Solo aplicar si la fecha actual sigue siendo today
      if (startingDate !== data.today) {
        return;
      }

      state.attendanceLoadedAt = Date.now();
      state.attendance.config = data.config || state.attendance.config;
      state.attendance.periods = data.periods || state.attendance.periods;
      state.attendance.today = data.today;
      state.attendance.day = data.day;
      state.attendanceDay = data.day;
      state.attendance.students = data.students;
      state.attendance.allStudents = data.allStudents;

      // Sincronizar registros antes de habilitar la edición
      prepareAttendanceRecords();
      renderAttendanceList();
      renderAttendanceSavedSummary();
      syncAttendanceControlsState();
    } catch (err) {
      console.warn('Revalidación en segundo plano de asistencia omitida:', err);
    } finally {
      attendanceRevalidatePromise = null;
    }
  })();
  return attendanceRevalidatePromise;
}

function hasUnsavedAttendanceChanges(){
  if (!state.attendanceRecords || !state.attendanceDay?.existing) return false;
  const existing = state.attendanceDay.existing;
  for (const [id, rec] of Object.entries(state.attendanceRecords)) {
    const saved = existing[id] || existing[String(id)];
    const savedStatus = String(saved?.status || '').toUpperCase();
    const currentStatus = String(rec?.status || '').toUpperCase();
    if (savedStatus !== currentStatus) return true;
    const savedNote = String(saved?.note || '').trim();
    const currentNote = String(rec?.note || '').trim();
    if (savedNote !== currentNote) return true;
  }
  return false;
}

function renderAttendance(options = {}){
  if (!state.attendance && !options.isInitialServerLoad && getAttendanceStudents().length === 0) return;

  const group = state.attendance?.config?.group || (state.config?.group ? state.config.group : '');
  const groupSubtitle = $('#attendanceGroupSubtitle');
  if (groupSubtitle) {
    groupSubtitle.textContent = group ? `Registro diario de asistencia · ${group}` : 'Registro diario de asistencia';
  }

  const currentDate = $('#attendanceDate')?.value;
  // Solo inicializar fecha explícitamente en carga inicial o si el selector está completamente vacío
  if (options.isInitialServerLoad || options.initializeDate || !currentDate) {
    if ($('#attendanceDate') && (state.attendanceDay?.date || state.attendance?.today)) {
      $('#attendanceDate').value = state.attendanceDay?.date || state.attendance.today;
    }
  }

  if (options.isInitialServerLoad || (!state.attendanceDay && state.attendance?.day)) {
    state.attendanceDay = state.attendance?.day || null;
    prepareAttendanceRecords();
    if (state.attendance?.day) {
      attendanceLoadStatus = 'ready';
    }
  }

  const all = (state.attendance?.allStudents && state.attendance.allStudents.length > 0)
    ? state.attendance.allStudents
    : getAttendanceStudents();

  if ($('#attendanceStudent')) {
    $('#attendanceStudent').innerHTML = '<option value="">Selecciona un alumno</option>' + all.map(s => `<option value="${s.id}">${escapeHtml(s.name || s.nombreCompleto)}${s.active ? '' : ' (BAJA)'}</option>`).join('');
  }

  if ($('#attendanceReportDate') && state.attendance?.today) {
    if (!$('#attendanceReportDate').value) $('#attendanceReportDate').value = state.attendance.today;
  }

  if ($('#attendancePeriod') && state.attendance?.periods) {
    $('#attendancePeriod').innerHTML = state.attendance.periods.filter(p => /^\d{4}-\d{2}$/.test(p.key)).map(p => `<option value="${p.key}">${escapeHtml(p.label)}</option>`).join('');
    const currentMonth = ($('#attendanceDate')?.value || state.attendance?.today || '').slice(0, 7);
    if ([...$('#attendancePeriod').options].some(o => o.value === currentMonth)) $('#attendancePeriod').value = currentMonth;
  }

  toggleAttendanceReportMode();
  renderAttendanceSavedSummary();
  renderAttendanceList();
  syncAttendanceControlsState();
  syncAttendanceModeSelector();
  syncDailyTopBarActions();
  applyAttendanceModeVisibility();
}

function prepareAttendanceRecords(){
  state.attendanceRecords = {};
  const students = sortStudentsAlphabetically(getAttendanceStudents());
  students.forEach(s => {
    const saved = state.attendanceDay?.existing?.[s.id] || state.attendanceDay?.existing?.[String(s.id)];
    state.attendanceRecords[s.id] = saved ? { status: String(saved.status || '').toUpperCase(), note: saved.note || '' } : { status: '', note: '' };
  });
}

async function loadAttendanceDay(forceDate){
  const requestedDate = (typeof forceDate === 'string' && forceDate) ? forceDate : $('#attendanceDate')?.value;
  if (!requestedDate) return;

  // Si hay cambios locales sin guardar y se cambia a otra fecha, confirmar descarte
  if (state.attendanceDay?.date && requestedDate !== state.attendanceDay.date && hasUnsavedAttendanceChanges()) {
    if (!confirm(`Hay cambios sin guardar en la fecha ${state.attendanceDay.date}. ¿Deseas descartarlos para cambiar a ${requestedDate}?`)) {
      if ($('#attendanceDate')) {
        $('#attendanceDate').value = state.attendanceDay.date;
      }
      return;
    }
  }

  const date = requestedDate;
  if ($('#attendanceDate') && $('#attendanceDate').value !== date) {
    $('#attendanceDate').value = date;
  }

  // Ruta rápida: si la fecha ya está lista en memoria, preservar los registros locales (no reiniciar)
  if (state.attendanceDay?.date === date && attendanceLoadStatus === 'ready' && Object.keys(state.attendanceRecords || {}).length > 0) {
    renderAttendanceList();
    renderAttendanceSavedSummary();
    syncAttendanceControlsState();
    return;
  }

  const isDateChange = Boolean(state.attendanceDay?.date && date !== state.attendanceDay.date);

  const seq = ++attendanceDateSeq;
  attendanceLoadStatus = 'loading';
  attendanceLastErrorMessage = '';
  state.attendanceSummary = null;

  if (isDateChange) {
    // Es un cambio confirmado a otra fecha: no presentar marcas anteriores para la nueva fecha
    state.attendanceRecords = {};
  }
  // En reintento o recarga de la MISMA fecha: NO vaciar attendanceRecords,
  // conservamos los estados y observaciones locales como respaldo intacto hasta recibir respuesta válida.

  renderAttendanceSavedSummary();
  syncAttendanceControlsState();
  renderAttendanceList();

  attendanceDayPromise = (async () => {
    try {
      const dayData = await server('getDayData', date);
      if (seq !== attendanceDateSeq || $('#attendanceDate')?.value !== date) {
        return; // Descartar respuesta desfasada
      }
      if (!isValidDayData(dayData, date)) {
        throw new Error('La información de asistencia recibida no es válida.');
      }
      state.attendanceDay = dayData;
      attendanceLoadStatus = 'ready';
      attendanceLastErrorMessage = '';
      prepareAttendanceRecords();
    } catch (err) {
      if (seq !== attendanceDateSeq) return;
      console.warn('Error al cargar día de asistencia ' + date + ':', err);
      attendanceLoadStatus = 'error';
      attendanceLastErrorMessage = (err && err.message) ? err.message : 'Error al consultar la fecha.';
      if (isDateChange) {
        state.attendanceRecords = {};
      }
    } finally {
      if (seq === attendanceDateSeq) {
        attendanceDayPromise = null;
        renderAttendanceList();
        syncAttendanceControlsState();
      }
    }
  })();

  return attendanceDayPromise;
}

const ATTENDANCE_STATUS_LABELS = {
  'A': 'Asistencia',
  'F': 'Falta',
  'R': 'Retardo',
  'J': 'Justificada'
};

function renderAttendanceList(){
  const box = $('#attendanceList');
  if (!box) return;

  const day = state.attendanceDay || {};
  const dateInputVal = $('#attendanceDate')?.value;
  if ($('#attendanceDisplayDate')) {
    $('#attendanceDisplayDate').textContent = day.displayDate || (dateInputVal || 'Selecciona una fecha');
  }

  if (attendanceLoadStatus === 'loading') {
    box.classList.add('loading-records');
    if ($('#attendanceNotice')) {
      const hasExisting = Object.keys(state.attendanceRecords || {}).length > 0;
      const targetDate = dateInputVal || day.date || 'la fecha seleccionada';
      $('#attendanceNotice').textContent = hasExisting
        ? `⏳ Consultando registros de ${targetDate}… (Marcas en pantalla pendientes de confirmación del servidor)`
        : `⏳ Consultando registros de ${targetDate}…`;
    }
  } else {
    box.classList.remove('loading-records');
    syncAttendanceNotice();
  }

  if (attendanceLoadStatus === 'error') {
    box.classList.remove('loading-records');
    box.innerHTML = `<div class="attendance-status-message error" style="padding:24px 16px;text-align:center;"><p style="color:var(--danger,#dc2626);font-weight:700;margin:0 0 12px;font-size:14px;">⚠️ ${escapeHtml(attendanceLastErrorMessage || 'Error al cargar los datos.')}</p><button type="button" class="btn small primary" data-action="retry-attendance">Reintentar conexión</button></div>`;
    syncAttendanceControlsState();
    return;
  }

  const students = sortStudentsAlphabetically(getAttendanceStudents());
  if (!students.length) {
    if (attendanceLoadStatus === 'loading') {
      box.innerHTML = '<div class="attendance-status-message" style="padding:28px 16px;text-align:center;"><p class="muted" style="margin:0;font-size:14px;">⏳ Consultando registros…</p></div>';
    } else {
      box.innerHTML = '<div class="attendance-status-message empty" style="padding:28px 16px;text-align:center;"><p class="muted" style="margin:0;font-size:14px;">No hay alumnos registrados en el grupo.</p></div>';
    }
    syncAttendanceControlsState();
    return;
  }

  box.innerHTML = students.map((s, i) => {
    const r = state.attendanceRecords[s.id] || {};
    return `<div class="attendance-row" data-student="${s.id}">
      <div class="attendance-row-header-mobile">
        <span class="col-num">${i + 1}</span>
        <strong class="col-name">${escapeHtml(s.name)}</strong>
      </div>
      <div class="col-status">
        ${['A', 'F', 'R', 'J'].map(x => {
        const isSelected = (r.status === x);
        const statusLabel = ATTENDANCE_STATUS_LABELS[x] || x;
        return `<button type="button" class="status-button ${isSelected ? 'selected' : ''}" data-status="${x}" aria-pressed="${isSelected ? 'true' : 'false'}" aria-label="${statusLabel} para ${escapeHtml(s.name)}">${x}</button>`;
      }).join('')}
      </div>
      <div class="col-note">
        <input class="attendance-note" value="${escapeHtml(r.note || '')}" placeholder="Observación opcional" aria-label="Observación para ${escapeHtml(s.name)}">
      </div>
    </div>`;
  }).join('');

  syncAttendanceControlsState();
}

function selectAttendanceStatus(e){
  if (!isAttendanceCaptureAllowed()) return;
  const b = e.target.closest('[data-status]');
  if (!b) return;
  const row = b.closest('[data-student]');
  if (!row) return;
  const studentId = row.dataset.student;
  if (!state.attendanceRecords[studentId]) {
    state.attendanceRecords[studentId] = { status: '', note: '' };
  }
  const current = state.attendanceRecords[studentId].status;
  const next = b.dataset.status;
  state.attendanceRecords[studentId].status = (current === next) ? '' : next;
  renderAttendanceList();
}

function updateAttendanceNote(e){
  if (!isAttendanceCaptureAllowed()) return;
  if (!e.target.classList.contains('attendance-note')) return;
  const row = e.target.closest('[data-student]');
  if (!row) return;
  state.attendanceRecords[row.dataset.student].note = e.target.value;
}

function markAllPresent(){
  if (!isAttendanceCaptureAllowed()) return;
  const students = getAttendanceStudents();
  students.forEach(s => {
    const prev = state.attendanceRecords[s.id] || {};
    state.attendanceRecords[s.id] = { status: 'A', note: prev.note || '' };
  });
  renderAttendanceList();
}

function renderAttendanceSavedSummary(){
  const box = $('#attendanceSavedSummary'), r = state.attendanceSummary;
  if (!r) {
    box?.classList.add('hidden-control');
    if (box) box.innerHTML = '';
    return;
  }
  box.classList.remove('hidden-control');
  box.innerHTML = `<strong>Asistencia guardada</strong><span><b>${r.attended}</b> asistieron (A + R)</span><span><b>${r.absent}</b> faltaron (F + J)</span><small>A: ${r.counts?.A ?? 0} · R: ${r.counts?.R ?? 0} · F: ${r.counts?.F ?? 0} · J: ${r.counts?.J ?? 0}</small>`;
}

async function saveAttendanceDay(){
  if (!isAttendanceReady() || attendanceSaving) return toast('Espera a que termine de sincronizar la asistencia antes de guardar.', true);
  if (!isAttendanceCaptureAllowed()) return toast('No es posible guardar asistencia en una fecha con suspensión de clases o no hábil.', true);

  const rawStudents = getAttendanceStudents();
  const students = sortStudentsAlphabetically(rawStudents);
  if (!students.length) return toast('No hay alumnos para guardar asistencia.', true);

  const pending = students.filter(s => !state.attendanceRecords[s.id]?.status);
  if (pending.length) return toast(`Falta registrar la asistencia de ${pending.length} alumno(s).`, true);

  const targetDate = $('#attendanceDate')?.value;
  if (!targetDate || targetDate !== state.attendanceDay?.date) {
    return toast('La fecha seleccionada no coincide con los registros cargados.', true);
  }

  if (!confirm('¿Guardar la asistencia de esta fecha?')) return;

  const currentSeq = attendanceDateSeq;
  ++attendanceDataGen;

  // Capturar una instantánea inmutable del payload antes de enviarlo
  const payload = {
    date: targetDate,
    records: students.map(s => {
      const rec = state.attendanceRecords[s.id] || {};
      let st = String(rec.status || 'A').trim().toUpperCase();
      if (!['A', 'F', 'R', 'J'].includes(st)) st = 'A';
      return {
        studentId: String(s.id),
        status: st,
        note: String(rec.note || '').trim()
      };
    })
  };

  attendanceSaving = true;
  syncAttendanceControlsState();

  try {
    const r = await server('saveAttendance', payload);

    // Conservar la protección de fecha y secuencia al aplicar la lectura posterior
    if ($('#attendanceDate')?.value !== targetDate || currentSeq !== attendanceDateSeq) {
      toast(r?.message || '✓ Asistencia guardada correctamente');
      return;
    }

    state.attendanceSummary = r;

    let refreshedDay = null;
    let readFailed = false;
    try {
      refreshedDay = await server('getDayData', targetDate);
      if (!isValidDayData(refreshedDay, targetDate)) {
        readFailed = true;
      }
    } catch (readErr) {
      console.warn('Error en la lectura posterior al guardado:', readErr);
      readFailed = true;
    }

    if ($('#attendanceDate')?.value === targetDate && currentSeq === attendanceDateSeq) {
      if (readFailed) {
        attendanceLoadStatus = 'error';
        attendanceLastErrorMessage = 'Guardado confirmado; no fue posible actualizar la consulta.';
        renderAttendanceList();
        syncAttendanceControlsState();
        toast('Guardado confirmado; no fue posible actualizar la consulta.', true);
        return;
      }

      state.attendanceDay = refreshedDay;
      prepareAttendanceRecords();
      renderAttendanceList();
      renderAttendanceSavedSummary();
      window.dispatchEvent(new CustomEvent('attendance-updated'));
      toast(r?.message || '✓ Asistencia guardada correctamente');
    }
  } catch (err) {
    console.error('Error al guardar asistencia:', err);
    toast((err && err.message) ? err.message : 'No fue posible guardar la asistencia.', true);
  } finally {
    attendanceSaving = false;
    syncAttendanceControlsState();
  }
}

async function saveNoClassDay(){
  if (!isAttendanceReady() || attendanceSaving) return toast('Espera a que termine de sincronizar la asistencia.', true);

  const targetDate = $('#attendanceDate')?.value;
  if (!targetDate || targetDate !== state.attendanceDay?.date) {
    return toast('La fecha seleccionada no coincide con los registros cargados.', true);
  }

  const day = state.attendanceDay;
  if (day?.noClass) {
    showSuspensionDetail(targetDate);
    return;
  }

  openMonthlyNoClassDialog(targetDate);
}

function toggleAttendanceReportMode(){
  const weekly = $('#attendanceReportType')?.value === 'weekly';
  $('#attendanceWeekControl')?.classList.toggle('hidden-control', !weekly);
  $('#attendanceMonthControl')?.classList.toggle('hidden-control', weekly);
}

async function loadAttendanceReport(){
  const studentId = $('#attendanceStudent')?.value;
  if (!studentId) {
    showView('attendance');
    return toast('Selecciona un alumno para consultar el reporte.', true);
  }
  const weekly = $('#attendanceReportType')?.value === 'weekly';
  await runAction(async()=>{
    const report = weekly ? await server('getWeeklyAttendanceReport', studentId, $('#attendanceReportDate')?.value) : await server('getIndividualReport', studentId, $('#attendancePeriod')?.value);
    weekly ? renderWeeklyAttendanceReport(report) : renderMonthlyAttendanceReport(report);
    showView('attendance');
  });
}

function attendanceKpis(r){
  return `<div class="attendance-kpis"><div class="attendance-kpi"><b>${r.percentage}%</b><span>Asistencia</span></div><div class="attendance-kpi"><b>${r.attended}</b><span>A + R</span></div><div class="attendance-kpi"><b>${r.absent}</b><span>F + J</span></div><div class="attendance-kpi"><b>${r.counts?.R ?? 0}</b><span>Retardos</span></div></div>`;
}

function renderWeeklyAttendanceReport(r){
  $('#attendanceReport').innerHTML = `<h3>${escapeHtml(r.student.name)}</h3><p class="muted">Semana del ${escapeHtml(r.period)}</p>${attendanceKpis(r)}<div class="weekly-days">${r.days.map(d=>`<div class="weekly-day"><strong>${escapeHtml(d.label)}</strong><span>${escapeHtml(d.displayDate)}</span><span class="day-status status-${(d.status||'none').toLowerCase()}">${escapeHtml(d.statusLabel)}</span>${d.note?`<span class="day-note">${escapeHtml(d.note)}</span>`:''}</div>`).join('')}</div>`;
}

function renderMonthlyAttendanceReport(r){
  $('#attendanceReport').innerHTML = `<h3>${escapeHtml(r.student.name)}</h3><p class="muted">${escapeHtml(r.period)} · ${r.totalDays} días registrados</p>${attendanceKpis(r)}<ul class="attendance-details">${r.details.length?r.details.map(d=>`<li>${escapeHtml(d.displayDate)} · ${escapeHtml(d.statusLabel)}${d.note?' · '+escapeHtml(d.note):''}</li>`).join(''):'<li>Sin incidencias en el mes.</li>'}</ul>`;
}

function goToTodayAttendance(){
  if (!isAttendanceReady()) return toast('Espera a que termine de sincronizar la asistencia.', true);
  const today = (typeof todayCancun === 'function' ? todayCancun() : (state.attendance?.today || new Date().toISOString().slice(0, 10)));
  const currentDate = $('#attendanceDate')?.value;
  if (currentDate === today && state.attendanceDay?.date === today) {
    return;
  }
  loadAttendanceDay(today);
}

function clearAttendanceDay(){
  if (!isAttendanceReady()) return toast('Espera a que termine de sincronizar la asistencia.', true);
  if (!isAttendanceCaptureAllowed()) return toast('No es posible modificar asistencia en esta fecha.', true);

  const serverExisting = state.attendanceDay?.existing || {};
  const hasServerRecords = Object.keys(serverExisting).some(id => Boolean(serverExisting[id]?.status));

  if (hasServerRecords) {
    return toast('Esta fecha contiene registros guardados en el servidor. La función para limpiar registros existentes está pendiente de habilitar.', true);
  }

  const hasLocalEntries = Object.values(state.attendanceRecords || {}).some(r => Boolean(r.status || r.note));
  if (!hasLocalEntries) {
    return toast('No hay marcas locales para limpiar en esta fecha.');
  }

  if (!confirm('¿Limpiar los estados y observaciones no guardados de esta fecha?')) {
    return;
  }

  const students = getAttendanceStudents();
  students.forEach(s => {
    state.attendanceRecords[s.id] = { status: '', note: '' };
  });
  renderAttendanceList();
  toast('✓ Se limpiaron las marcas locales no guardadas.');
}

function isValidPeriodsCatalog(periods){
  return Array.isArray(periods) && periods.length > 0 && periods.every(p => p && typeof p.key === 'string' && typeof p.label === 'string');
}

function isValidAllStudentsCatalog(students){
  return Array.isArray(students) && students.length > 0 && students.every(s => s && s.id && (s.name || s.nombreCompleto));
}

function loadAttendanceReportCatalogs(){
  if (state.attendance?.periods?.length && state.attendance?.allStudents?.length) {
    return Promise.resolve(state.attendance);
  }

  if (attendanceReportsCatalogPromise) {
    return attendanceReportsCatalogPromise;
  }

  attendanceReportsCatalogPromise = (async () => {
    try {
      const data = await server('getInitialData');
      if (!data || typeof data !== 'object') {
        throw new Error('Respuesta inválida al consultar catálogos de reportes.');
      }
      if (!isValidPeriodsCatalog(data.periods) || !isValidAllStudentsCatalog(data.allStudents)) {
        throw new Error('Los catálogos de reportes recibidos no tienen la estructura requerida.');
      }
      state.attendance = state.attendance || {};
      state.attendance.periods = data.periods;
      state.attendance.allStudents = data.allStudents;
      if (!state.attendance.students && Array.isArray(data.students)) {
        state.attendance.students = data.students;
      }

      if ($('#attendancePeriod')) {
        $('#attendancePeriod').innerHTML = state.attendance.periods
          .filter(p => /^\d{4}-\d{2}$/.test(p.key))
          .map(p => `<option value="${p.key}">${escapeHtml(p.label)}</option>`).join('');
        const currentMonth = ($('#attendanceDate')?.value || state.attendance?.today || '').slice(0, 7);
        if ([...$('#attendancePeriod').options].some(o => o.value === currentMonth)) {
          $('#attendancePeriod').value = currentMonth;
        }
      }

      if ($('#attendanceStudent')) {
        $('#attendanceStudent').innerHTML = '<option value="">Selecciona un alumno</option>' +
          state.attendance.allStudents.map(s => `<option value="${s.id}">${escapeHtml(s.name)}${s.active ? '' : ' (BAJA)'}</option>`).join('');
      }

      return state.attendance;
    } catch (err) {
      console.warn('Aviso: no fue posible cargar los catálogos oficiales de reportes:', err);
      throw err;
    } finally {
      attendanceReportsCatalogPromise = null;
    }
  })();

  return attendanceReportsCatalogPromise;
}

async function toggleAttendanceReportsPanel(){
  const container = $('#attendanceReportContainer');
  if (!container) return;
  container.classList.toggle('hidden-control');
  if (!container.classList.contains('hidden-control')) {
    try {
      await loadAttendanceReportCatalogs();
    } catch (e) {
      // Un fallo permite reintentar en la siguiente apertura sin alterar la captura diaria
    }
  }
}

/* ==========================================================================
   GESTIÓN Y RENDERIZADO DE CAPTURA MENSUAL (ETAPA B - MODO CONSULTA)
   ========================================================================== */

function formatAttendanceMonthLabel(yyyyMm){
  const parts = yyyyMm.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, 15);
  const monthName = d.toLocaleDateString('es-ES', { month: 'long' });
  return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${parts[0]}`;
}

function getAttendanceMonthOptions(){
  // 1. Procedente del catálogo oficial del servidor (getInitialData)
  if (Array.isArray(state.attendance?.periods) && state.attendance.periods.length > 0) {
    const valid = state.attendance.periods.filter(p => /^\d{4}-\d{2}$/.test(p.key));
    if (valid.length > 0) {
      return valid.map(p => ({ value: p.key, label: p.label || formatAttendanceMonthLabel(p.key) }));
    }
  }

  // 2. Procedente de los límites del ciclo escolar (start y end)
  const cycleStart = attendanceMonthlyData?.cycle?.start || state.attendance?.config?.cycleStart || state.config?.cycleStart;
  const cycleEnd = attendanceMonthlyData?.cycle?.end || state.attendance?.config?.cycleEnd || state.config?.cycleEnd;
  if (cycleStart && cycleEnd && /^\d{4}-\d{2}/.test(cycleStart) && /^\d{4}-\d{2}/.test(cycleEnd)) {
    const startYm = cycleStart.slice(0, 7);
    const endYm = cycleEnd.slice(0, 7);
    const months = [];
    let cur = new Date(Number(startYm.slice(0, 4)), Number(startYm.slice(5, 7)) - 1, 1);
    const end = new Date(Number(endYm.slice(0, 4)), Number(endYm.slice(5, 7)) - 1, 1);
    while (cur <= end) {
      const ym = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
      months.push({ value: ym, label: formatAttendanceMonthLabel(ym) });
      cur.setMonth(cur.getMonth() + 1);
    }
    if (months.length > 0) return months;
  }

  // 3. Ventana dinámica alrededor de la fecha base activa (sin literales de ciclo fijos en código)
  const baseDate = state.attendance?.today || $('#attendanceDate')?.value || new Date().toISOString().slice(0, 10);
  const baseY = Number(baseDate.slice(0, 4));
  const baseM = Number(baseDate.slice(5, 7));
  const months = [];
  for (let offset = -5; offset <= 6; offset++) {
    const d = new Date(baseY, baseM - 1 + offset, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({ value: ym, label: formatAttendanceMonthLabel(ym) });
  }
  return months;
}

function syncAttendanceModeSelector(){
  const containers = document.querySelectorAll('.attendance-mode-selector');
  const isDaily = (attendanceViewMode === 'daily');
  containers.forEach(container => {
    container.innerHTML = `
      <button type="button" class="attendance-mode-pill ${isDaily ? 'active' : ''}" data-action="switch-to-daily-attendance" ${isDaily ? 'aria-current="page"' : ''}>Pase diario</button>
      <button type="button" class="attendance-mode-pill attendance-monthly-pill ${!isDaily ? 'active' : ''}" data-action="switch-to-monthly-attendance" ${!isDaily ? 'aria-current="page"' : ''}>Captura mensual</button>
    `;
  });
}

function formatAttendanceGradeGroup(raw){
  if (!raw) return '4.º A';
  const str = String(raw).trim();
  const match = str.match(/(\d+)\s*(?:°|º|\.)?\s*["']?\s*([A-Za-z])/);
  if (match) {
    return `${match[1]}.º ${match[2].toUpperCase()}`;
  }
  return str.replace(/["']/g, '');
}

function syncAttendanceConsolidatedHeader(mode = attendanceViewMode){
  const contextEl = document.querySelector('.topbar .current-page-context');
  if (!contextEl) return;
  const rawGroup = state.attendance?.config?.group || state.attendance?.group || state.config?.group || '4.º A';
  const groupLabel = formatAttendanceGradeGroup(rawGroup);

  contextEl.innerHTML = `
    <span class="topbar-eyebrow" style="display:block;font-size:10px;font-weight:700;color:#0f766e;text-transform:uppercase;letter-spacing:0.05em;line-height:1.2;">TRABAJO ACADÉMICO</span>
    <strong id="currentViewTitle" style="font-size:16px;color:#073b61;line-height:1.2;">Pase de lista · ${escapeHtml(groupLabel)}</strong>
  `;
}

function toggleExpandMonthlyAttendance(forceState){
  if (typeof document === 'undefined') return;
  const body = document.body;
  const isExpanded = (typeof forceState === 'boolean')
    ? forceState
    : !body.classList.contains('attendance-expanded-mode');

  body.classList.toggle('attendance-expanded-mode', isExpanded);

  const btn = $('#btnExpandMonthlyAttendance');
  if (btn) {
    btn.classList.toggle('is-expanded', isExpanded);
    btn.innerHTML = isExpanded ? '🗗 Restaurar' : '⛶ Ampliar';
    btn.title = isExpanded ? 'Salir del modo ampliado (Esc)' : 'Modo ampliado de pantalla completa';
    btn.setAttribute('aria-label', isExpanded ? 'Salir del modo ampliado' : 'Modo ampliado de pantalla completa');
  }

  const hint = $('#attendanceExpandHint');
  if (hint) {
    hint.textContent = isExpanded ? '(Esc para restaurar)' : '';
    hint.style.display = isExpanded ? 'inline' : 'none';
  }

  if (attendanceMonthlyFocusedCell) {
    const focusedTd = document.querySelector(`td.td-cell.is-focused[data-student-id="${attendanceMonthlyFocusedCell.studentId}"][data-date="${attendanceMonthlyFocusedCell.date}"]`);
    focusedTd?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }

  setTimeout(() => {
    if (typeof syncNoClassColumnOverlays === 'function') {
      syncNoClassColumnOverlays();
    }
  }, 50);
}

// Observador e inicializador para sincronizar cabecera y acciones de asistencia
if (typeof window !== 'undefined') {
  const initImmediateAttendanceUI = () => {
    const attView = document.getElementById('attendance');
    if (attView && (attView.classList.contains('active') || window.location.hash === '#attendance')) {
      syncAttendanceConsolidatedHeader();
      syncDailyTopBarActions();
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initImmediateAttendanceUI);
  } else {
    initImmediateAttendanceUI();
  }

  if (typeof MutationObserver !== 'undefined') {
    const attView = document.getElementById('attendance');
    if (attView && !window._attendanceHeaderObserverAttached) {
      window._attendanceHeaderObserverAttached = true;
      const obs = new MutationObserver(() => {
        if (!attView.classList.contains('active')) {
          if (typeof closeMonthlyNoClassModal === 'function') {
            closeMonthlyNoClassModal();
          }
          toggleExpandMonthlyAttendance(false);
          const contextEl = document.querySelector('.topbar .current-page-context');
          const titleEl = document.getElementById('currentViewTitle');
          if (contextEl && contextEl.querySelector('.topbar-eyebrow')) {
            const currentText = titleEl ? titleEl.textContent : 'Inicio';
            contextEl.innerHTML = `<strong id="currentViewTitle">${escapeHtml(currentText)}</strong><span class="top-meta">Carpeta Académica</span>`;
          }
        } else {
          syncAttendanceConsolidatedHeader();
          syncDailyTopBarActions();
        }
      });
      obs.observe(attView, { attributes: true, attributeFilter: ['class'] });
    }
  }
}

function ensureAttendanceMonthlyContainer(){
  let monthlyEl = $('#attendanceMonthlyView');
  if (!monthlyEl) {
    monthlyEl = document.createElement('div');
    monthlyEl.id = 'attendanceMonthlyView';
    monthlyEl.className = 'attendance-monthly-view hidden-control';
    const panel = $('.attendance-panel');
    if (panel) {
      panel.appendChild(monthlyEl);
    }
  }
  return monthlyEl;
}

function syncAttendanceNotice(){
  const notice = $('#attendanceNotice');
  if (!notice) return;
  if (attendanceViewMode === 'monthly') {
    notice.classList.add('hidden-control');
    return;
  }
  notice.classList.remove('hidden-control');
  const day = state.attendanceDay || state.attendance?.day || {};
  const dateInputVal = $('#attendanceDate')?.value;
  if (attendanceLoadStatus === 'loading') {
    const hasExisting = Object.keys(state.attendanceRecords || {}).length > 0;
    const targetDate = dateInputVal || day.date || 'la fecha seleccionada';
    notice.textContent = hasExisting
      ? `⏳ Consultando registros de ${targetDate}… (Marcas en pantalla pendientes de confirmación del servidor)`
      : `⏳ Consultando registros de ${targetDate}…`;
    notice.className = 'attendance-notice';
  } else {
    if (day.noClass) {
      const reason = (day.noClassReason || 'SIN CLASES').trim().toUpperCase();
      const detail = day.noClassDetail ? ` · ${day.noClassDetail}` : '';
      const motif = `/// ${reason} `;
      const repeatedTrack = `${motif}/// ${reason} /// ${reason} ///`;
      notice.innerHTML = `
        <div class="attendance-no-class-banner" role="alert" data-date="${escapeHtml(day.date || '')}">
          <div class="attendance-no-class-banner-track">
            <span>${escapeHtml(repeatedTrack)}</span>
            ${detail ? `<span class="attendance-no-class-banner-detail">(${escapeHtml(day.noClassDetail)})</span>` : ''}
          </div>
          <div class="attendance-no-class-banner-actions">
            <button type="button" class="btn attendance-no-class-action-btn edit" data-action="edit-monthly-no-class" data-date="${escapeHtml(day.date || '')}" title="Editar motivo de suspensión">
              ✏️ Editar motivo
            </button>
            <button type="button" class="btn attendance-no-class-action-btn remove" data-action="remove-monthly-no-class" data-date="${escapeHtml(day.date || '')}" title="Retirar suspensión de clases">
              🗑️ Retirar suspensión
            </button>
          </div>
        </div>
      `;
      notice.className = 'attendance-notice is-no-class-notice';
    } else {
      notice.innerHTML = '';
      notice.className = 'attendance-notice';
    }
  }
}

function applyAttendanceModeVisibility(){
  const isMonthly = (attendanceViewMode === 'monthly');
  const topBar = $('#attendance .attendance-top-bar');
  const dateGroup = $('.attendance-date-group');
  const toolbar = $('.attendance-toolbar');
  const notice = $('#attendanceNotice');
  const savedSummary = $('#attendanceSavedSummary');
  const tableHeader = $('.attendance-table-header');
  const list = $('#attendanceList');
  const footer = $('.attendance-footer');
  const monthlyView = ensureAttendanceMonthlyContainer();

  if (topBar) topBar.classList.toggle('hidden-control', isMonthly);
  if (dateGroup) dateGroup.classList.toggle('hidden-control', isMonthly);
  if (toolbar) toolbar.classList.toggle('hidden-control', isMonthly);
  if (notice) notice.classList.toggle('hidden-control', isMonthly);
  if (savedSummary && isMonthly) savedSummary.classList.add('hidden-control');
  if (tableHeader) tableHeader.classList.toggle('hidden-control', isMonthly);
  if (list) list.classList.toggle('hidden-control', isMonthly);
  if (footer) footer.classList.toggle('hidden-control', isMonthly);
  if (monthlyView) monthlyView.classList.toggle('hidden-control', !isMonthly);

  const group = state.attendance?.config?.group || (state.config?.group ? state.config.group : '');
  const groupSubtitle = $('#attendanceGroupSubtitle');
  if (groupSubtitle) {
    if (isMonthly) {
      groupSubtitle.textContent = group ? `Captura mensual de asistencia · ${group}` : 'Captura mensual de asistencia';
    } else {
      groupSubtitle.textContent = group ? `Registro diario de asistencia · ${group}` : 'Registro diario de asistencia';
    }
  }

  syncAttendanceConsolidatedHeader(attendanceViewMode);

  if (!isMonthly) {
    syncDailyTopBarActions();
    syncAttendanceNotice();
    syncAttendanceControlsState();
    renderAttendanceSavedSummary();
  }
}

function switchAttendanceMode(targetMode){
  if (attendanceMonthlySaving) {
    if (typeof toast === 'function') toast('No es posible salir o cambiar de modo mientras se guardan cambios en el servidor.', true);
    return;
  }
  if (targetMode === 'monthly') {
    attendanceViewMode = 'monthly';
  } else {
    if (typeof closeMonthlyNoClassModal === 'function') {
      closeMonthlyNoClassModal();
    }
    toggleExpandMonthlyAttendance(false);
    // Si hay mutaciones pendientes al intentar volver a diario, advertir
    if (attendanceMonthlyMutations.size > 0) {
      const confirmLeave = window.confirm(`Tienes ${attendanceMonthlyMutations.size} cambios sin guardar en Captura mensual. ¿Deseas descartarlos y volver a Pase diario?`);
      if (!confirmLeave) {
        return;
      }
      attendanceMonthlyMutations.clear();
      attendanceMonthlyConfirmedMutations.clear();
    }
    attendanceViewMode = 'daily';
    attendanceMonthlyFocusedCell = null;
    clearMonthlyHighlight();
    syncMonthlyTouchPad();

    // Sincronización inmediata al volver a diario: si la fecha cargada en Pase diario está lista, asegurar que muestre los datos actualizados
    if (attendanceLoadStatus === 'ready' && state.attendanceDay) {
      renderAttendanceList();
      renderAttendanceSavedSummary();
      syncAttendanceControlsState();
    }
  }

  syncAttendanceModeSelector();
  applyAttendanceModeVisibility();

  if (attendanceViewMode === 'monthly') {
    const selectedMonth = attendanceMonthlyMonth || ($('#attendanceDate')?.value || state.attendance?.today || new Date().toISOString().slice(0, 10)).slice(0, 7);
    const isDailyOutOfSync = (attendanceMonthlySyncedDataGen !== attendanceDataGen);
    if (!attendanceMonthlyData || attendanceMonthlyData.month !== selectedMonth || attendanceMonthlyMonth !== selectedMonth || attendanceMonthlyStatus !== 'ready' || isDailyOutOfSync) {
      loadAttendanceMonthly(selectedMonth, isDailyOutOfSync);
    } else {
      renderAttendanceMonthlyView();
    }
  }
}

async function loadAttendanceMonthly(targetMonth, forceReload = false, isReconciliation = false){
  if (!isReconciliation && attendanceMonthlySaving) {
    if (typeof toast === 'function') toast('No es posible cambiar de mes mientras se guardan cambios en el servidor.', true);
    const select = $('#attendanceMonthSelect');
    if (select) select.value = attendanceMonthlyMonth;
    return;
  }
  const month = targetMonth || attendanceMonthlyMonth || ($('#attendanceDate')?.value || state.attendance?.today || new Date().toISOString().slice(0, 10)).slice(0, 7);
  
  if (!forceReload && !isReconciliation && month !== attendanceMonthlyMonth && attendanceMonthlyMutations.size > 0) {
    const confirmChange = window.confirm(`Tienes ${attendanceMonthlyMutations.size} cambios sin guardar en el mes actual. ¿Deseas descartarlos y cambiar de mes?`);
    if (!confirmChange) {
      const select = $('#attendanceMonthSelect');
      if (select) select.value = attendanceMonthlyMonth;
      return;
    }
    attendanceMonthlyMutations.clear();
    attendanceMonthlyConfirmedMutations.clear();
  }

  attendanceMonthlyMonth = month;
  const currentSeq = ++attendanceMonthlySeq;

  // Invalidar cualquier dato anterior si no coincide estrictamente con el mes solicitado o si es forzado (salvo en reconciliación controlada)
  if ((forceReload && !isReconciliation) || (attendanceMonthlyData && attendanceMonthlyData.month !== month)) {
    attendanceMonthlyData = null;
  }

  attendanceMonthlyStatus = 'loading';
  attendanceMonthlyError = '';
  attendanceMonthlyErrorType = 'general';
  renderAttendanceMonthlyView();

  try {
    const data = await server('getMonthAttendanceGrid', { month });

    if (currentSeq !== attendanceMonthlySeq) {
      return;
    }

    // Validación estricta del contrato de datos consumido por el renderizado
    if (!data || typeof data !== 'object') {
      const err = new Error('La respuesta del servidor no es un objeto válido.');
      err.errorType = 'invalid_data';
      throw err;
    }
    if (data.ok !== true) {
      const err = new Error(data.error || 'El servidor devolvió un estado de error en la consulta mensual.');
      err.errorType = 'general';
      throw err;
    }
    if (data.month !== month) {
      const err = new Error(`Inconsistencia en el mes recibido: se solicitó ${month} pero el servidor devolvió ${data.month}.`);
      err.errorType = 'invalid_data';
      throw err;
    }
    if (!Array.isArray(data.days) || data.days.length === 0) {
      const err = new Error('La respuesta del servidor no contiene la lista de días requerida.');
      err.errorType = 'invalid_data';
      throw err;
    }
    if (!Array.isArray(data.activeStudents)) {
      const err = new Error('La respuesta del servidor no contiene la lista de alumnos activos.');
      err.errorType = 'invalid_data';
      throw err;
    }
    if (!data.records || typeof data.records !== 'object' || Array.isArray(data.records)) {
      const err = new Error('La estructura de registros de asistencia de la respuesta es inválida.');
      err.errorType = 'invalid_data';
      throw err;
    }

    // En reconciliación controlada por conflictos:
    // Conservar todas las mutaciones pendientes (LOCAL_PENDING, UNCERTAIN, CONFLICT)
    // y sus versiones originales de fecha (dateVersions)
    if (isReconciliation && attendanceMonthlyData) {
      const prevVersions = Object.assign({}, attendanceMonthlyData.dateVersions || {});
      data.dateVersions = Object.assign(data.dateVersions || {}, prevVersions);
      attendanceMonthlyData = data;
      attendanceMonthlyMutations.forEach((m) => {
        const sRec = data.records?.[m.studentId]?.[m.date];
        if (m.lifecycle === 'CONFLICT') {
          m.serverCurrent = sRec ? { status: sRec.status, note: sRec.note } : null;
        }
      });
    } else {
      attendanceMonthlyData = data;
    }
    attendanceMonthlyStatus = 'ready';
    attendanceMonthlyError = '';
    attendanceMonthlyErrorType = 'general';
    attendanceMonthlySyncedDataGen = attendanceDataGen;
  } catch (err) {
    if (currentSeq !== attendanceMonthlySeq) return;
    console.warn('Aviso: no fue posible cargar getMonthAttendanceGrid:', err);
    attendanceMonthlyStatus = 'error';
    attendanceMonthlyData = null; // Asegura que una carga fallida de B nunca retenga ni muestre A
    const msg = String(err && err.message ? err.message : err || '');

    if (err && err.errorType) {
      attendanceMonthlyErrorType = err.errorType;
      attendanceMonthlyError = msg;
    } else if (typeof isSessionError === 'function' && isSessionError(msg)) {
      attendanceMonthlyErrorType = 'session';
      attendanceMonthlyError = 'Tu sesión ha vencido o requiere autenticación para consultar la cuadrícula mensual.';
    } else if (!navigator.onLine || /failed to fetch|network|offline|conexión|conexion|internet/i.test(msg)) {
      attendanceMonthlyErrorType = 'network';
      attendanceMonthlyError = 'No fue posible conectar con el servidor. Revisa tu conexión a internet e inténtalo nuevamente.';
    } else if (/acción no reconocida|accion no reconocida|acción no implementada|accion no implementada|acción desconocida|accion desconocida|no implementad[ao]|acción solicitada no está permitida|accion solicitada no esta permitida/i.test(msg)) {
      attendanceMonthlyErrorType = 'action_unavailable';
      attendanceMonthlyError = 'La acción getMonthAttendanceGrid no está disponible aún en el servidor de Apps Script (Etapa A pendiente de despliegue). Pase diario continúa 100% operativo.';
    } else {
      attendanceMonthlyErrorType = 'general';
      attendanceMonthlyError = msg || 'Ocurrió un error al consultar la cuadrícula mensual.';
    }
  } finally {
    if (currentSeq === attendanceMonthlySeq) {
      renderAttendanceMonthlyView();
    }
  }
}

function getMonthlyEffectiveRecord(studentId, date){
  const sid = String(studentId);
  const key = `${sid}|${date}`;
  const mutation = attendanceMonthlyMutations.get(key);
  const serverRec = attendanceMonthlyData?.records?.[sid]?.[date];

  if (mutation) {
    if (mutation.action === 'DELETE') {
      return { status: null, note: '', isPendingDelete: true, originalNote: mutation.base?.note || '' };
    }
    // UPSERT pendiente
    const status = mutation.newStatus;
    // Conserva íntegramente la observación existente
    const note = (mutation.newNote !== undefined) ? mutation.newNote : (mutation.base?.note || '');
    return { status, note, isPendingDirty: true };
  }

  if (serverRec && serverRec.status) {
    return { status: String(serverRec.status).toUpperCase(), note: String(serverRec.note || '').trim() };
  }

  return null;
}

function renderMonthlyCellBadge(rec, dayInfo, studentName = '', studentId = ''){
  const sid = String(studentId);
  const key = `${sid}|${dayInfo.date}`;
  const mutation = attendanceMonthlyMutations.get(key);
  const effRec = getMonthlyEffectiveRecord(studentId, dayInfo.date);

  const isPendingDirty = Boolean(effRec?.isPendingDirty);
  const isPendingDelete = Boolean(effRec?.isPendingDelete);
  const status = effRec?.status || null;
  const note = effRec?.note || (isPendingDelete ? effRec?.originalNote : '') || '';

  if (mutation && mutation.lifecycle === 'CONFLICT') {
    let confTitle = `⚠️ Conflicto en ${dayInfo.date}: ${mutation.conflictReason || 'Modificación concurrente'}\nClic para resolver`;
    return `<button type="button" class="monthly-badge status-other is-conflict-badge" tabindex="-1" data-action="show-monthly-conflict" data-student-id="${escapeHtml(sid)}" data-date="${dayInfo.date}" title="${escapeHtml(confTitle)}" aria-label="Resolver conflicto para fecha ${dayInfo.date}">⚠️ ${escapeHtml(status || '?')}</button>`;
  }

  if (mutation && mutation.lifecycle === 'REJECTED') {
    let rejTitle = `⛔ Rechazado: ${mutation.rejectReason || 'Operación inválida'}`;
    return `<span class="monthly-badge status-other is-rejected-badge" title="${escapeHtml(rejTitle)}">⛔ ${escapeHtml(status || '?')}</span>`;
  }

  if (!status) {
    if (isPendingDelete) {
      return `<span class="monthly-empty" title="Eliminación pendiente de guardar">BORRADO</span>`;
    }
    if (dayInfo.noClass && !dayInfo.isWeekend) {
      return '';
    }
    const tooltip = dayInfo.noClassReason ? dayInfo.noClassReason : (dayInfo.isWeekend ? 'Fin de semana' : 'Sin registrar');
    return `<span class="monthly-empty" title="${escapeHtml(tooltip)}">-</span>`;
  }

  let title = `Estado: ${status}`;
  if (isPendingDirty) title += ' (Modificación pendiente)';
  if (note) {
    title += `\nObservación: ${note}`;
  }
  if (dayInfo.noClassReason) {
    title += `\n(${dayInfo.noClassReason})`;
  }

  const validStatus = ['A', 'F', 'R', 'J'].includes(status) ? status.toLowerCase() : 'other';
  if (note) {
    return `<button type="button" class="monthly-badge status-${validStatus}" tabindex="-1" data-action="show-monthly-note" data-student="${escapeHtml(studentName)}" data-date="${dayInfo.date}" data-status="${escapeHtml(status)}" data-note="${escapeHtml(note)}" title="${escapeHtml(title)}" aria-label="Ver observación de ${escapeHtml(studentName)} para fecha ${dayInfo.date}: ${escapeHtml(status)} - ${escapeHtml(note)}">${escapeHtml(status)}<span class="cell-note-dot" aria-hidden="true">•</span></button>`;
  }
  return `<span class="monthly-badge status-${validStatus}" title="${escapeHtml(title)}">${escapeHtml(status)}</span>`;
}

function showMonthlyNoteDetail(btn){
  let detailEl = $('#attendanceMonthlyNoteDetail');
  if (!detailEl) {
    detailEl = document.createElement('div');
    detailEl.id = 'attendanceMonthlyNoteDetail';
    detailEl.className = 'attendance-monthly-note-detail';
    const wrap = $('.attendance-monthly-table-wrap');
    if (wrap && wrap.parentNode) {
      wrap.parentNode.insertBefore(detailEl, wrap.nextSibling);
    }
  }
  detailEl.classList.remove('hidden-control');
  const student = btn?.getAttribute?.('data-student') || '';
  const date = btn?.getAttribute?.('data-date') || '';
  const status = (btn?.getAttribute?.('data-status') || '').toUpperCase();
  const note = btn?.getAttribute?.('data-note') || '';
  const validStatus = ['A', 'F', 'R', 'J'].includes(status) ? status.toLowerCase() : 'other';

  detailEl.innerHTML = `
    <div class="note-detail-content">
      <span class="note-detail-badge status-${validStatus}">${escapeHtml(status)}</span>
      <div class="note-detail-text">
        <strong>${escapeHtml(student)}</strong> · <span>Fecha: ${escapeHtml(date)}</span><br>
        <span>Observación: <em>${escapeHtml(note)}</em></span>
      </div>
    </div>
    <button type="button" class="btn small" data-action="close-monthly-note" aria-label="Cerrar detalle de observación" style="padding:4px 8px;font-size:12px;">✕ Cerrar</button>
  `;
}

const NO_CLASS_DEFAULT_REASONS = [
  'DÍA ECONÓMICO',
  'DÍA LLUVIOSO',
  'CONSEJO TÉCNICO ESCOLAR',
  'DÍA FESTIVO',
  'FESTIVAL NAVIDEÑO',
  'SUSPENSIÓN OFICIAL',
  'DESCARGA ADMINISTRATIVA',
  'ACTIVIDAD ESCOLAR',
  'VACACIONES',
  'OTRO MOTIVO'
];

function ensureMonthlyNoClassModal() {
  let modal = document.querySelector('#attendanceNoClassModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'attendanceNoClassModal';
    modal.className = 'attendance-no-class-modal-backdrop hidden-control';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'noClassModalTitle');
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeMonthlyNoClassModal();
      }
    });
  }
  return modal;
}

function closeMonthlyNoClassModal() {
  const modal = document.querySelector('#attendanceNoClassModal');
  if (modal) {
    modal.classList.add('hidden-control');
    modal.innerHTML = '';
  }
}

function getExistingAttendanceSummaryOnDate(date) {
  let count = 0;
  const details = [];
  const data = attendanceMonthlyData;
  if (data && data.records) {
    const students = (data.activeStudents || []).concat(data.inactiveStudentsWithRecords || []);
    students.forEach(s => {
      const rec = data.records?.[s.id]?.[date] || data.records?.[String(s.id)]?.[date];
      const mut = attendanceMonthlyMutations.get(`${s.id}|${date}`);
      let effStatus = rec?.status || null;
      if (mut) {
        if (mut.action === 'DELETE') effStatus = null;
        else if (mut.newStatus) effStatus = mut.newStatus;
      }
      if (effStatus) {
        count++;
        details.push({ studentName: s.name, status: effStatus });
      }
    });
  } else if (state.attendanceDay?.date === date && state.attendanceRecords) {
    const recs = state.attendanceRecords || {};
    Object.keys(recs).forEach(sid => {
      if (recs[sid]?.status) {
        count++;
        details.push({ studentName: sid, status: recs[sid].status });
      }
    });
  }
  return { count, details };
}

function updateNoClassDialogWarning(date) {
  const warnEl = document.querySelector('#noClassModalWarning');
  if (!warnEl) return;
  const summary = getExistingAttendanceSummaryOnDate(date);
  if (summary.count > 0) {
    warnEl.style.display = 'block';
    warnEl.innerHTML = `
      <div style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:8px;padding:10px 12px;font-size:12px;color:#92400e;line-height:1.4;">
        <strong>⚠️ Protección activa:</strong> Existen <strong>${summary.count} alumno(s)</strong> con asistencia registrada en esta fecha (${date}). Al registrar la suspensión, los registros previos serán <strong>conservados y protegidos</strong> en el servidor y la cuadrícula, sin ser eliminados ni sobrescritos.
      </div>
    `;
  } else {
    warnEl.style.display = 'none';
    warnEl.innerHTML = '';
  }
}

function openMonthlyNoClassDialog(initialDate, options = {}) {
  const modal = ensureMonthlyNoClassModal();
  if (!modal) return;

  const data = attendanceMonthlyData;
  let targetDate = initialDate;
  if (!targetDate) {
    targetDate = attendanceMonthlyFocusedCell?.date || $('#attendanceDate')?.value || state.attendance?.today || '';
  }

  // Mes activo determinado dinámicamente según la fecha objetivo o el mes seleccionado
  const activeYm = (targetDate && targetDate.length >= 7)
    ? targetDate.slice(0, 7)
    : (attendanceMonthlyMonth || ($('#attendanceDate')?.value || state.attendance?.today || new Date().toISOString().slice(0, 10)).slice(0, 7));

  // Generar lista dinámica de días hábiles del mes activo (sin literales fijos de ciclos anteriores)
  let selectableDays = [];
  if (data?.days?.length && data.days[0].date.slice(0, 7) === activeYm) {
    selectableDays = data.days.filter(d => !d.isWeekend && !d.isOutsideCycle);
  } else if (/^\d{4}-\d{2}$/.test(activeYm)) {
    const [y, m] = activeYm.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const dowLabels = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
    for (let dayNum = 1; dayNum <= lastDay; dayNum++) {
      const dt = new Date(y, m - 1, dayNum, 12);
      const dow = dt.getDay();
      if (dow !== 0 && dow !== 6) {
        const iso = `${activeYm}-${String(dayNum).padStart(2, '0')}`;
        const isCurrentDaySuspended = Boolean(state.attendanceDay?.date === iso && state.attendanceDay?.noClass);
        selectableDays.push({
          date: iso,
          dayOfWeek: dowLabels[dow],
          dayNumber: dayNum,
          noClass: isCurrentDaySuspended
        });
      }
    }
  }

  // Si targetDate no coincide con ningún día hábil del mes activo, tomar el primer día hábil
  if (selectableDays.length > 0) {
    const exists = selectableDays.some(d => d.date === targetDate);
    if (!exists) {
      targetDate = selectableDays[0].date;
    }
  }

  const isEdit = Boolean(options.isEdit);
  const existingDay = (data?.days || []).find(d => d.date === targetDate) || (state.attendanceDay?.date === targetDate ? state.attendanceDay : null);
  const currentReason = options.initialReason || existingDay?.noClassReason || 'CONSEJO TÉCNICO ESCOLAR';
  const currentDetail = options.initialDetail || existingDay?.noClassDetail || '';

  const isStandardReason = NO_CLASS_DEFAULT_REASONS.includes(currentReason);
  const selectValue = isStandardReason ? currentReason : 'OTRO MOTIVO';
  const customReasonValue = isStandardReason ? '' : currentReason;

  // Límites dinámicos del ciclo escolar vigente obtenidos de la configuración o del mes activo
  const cycleStart = data?.cycle?.start || state.attendance?.config?.cycleStart || state.config?.cycleStart || (activeYm ? `${activeYm}-01` : '');
  const cycleEnd = data?.cycle?.end || state.attendance?.config?.cycleEnd || state.config?.cycleEnd || (activeYm ? `${activeYm}-31` : '');

  modal.innerHTML = `
    <div class="attendance-no-class-modal-card">
      <div class="modal-head">
        <div>
          <div class="modal-eyebrow">Pase de lista · Calendario escolar vigente</div>
          <h3 class="modal-title" id="noClassModalTitle">${isEdit ? 'Editar día sin clases' : 'Registrar día sin clases'}</h3>
        </div>
        <button type="button" class="modal-close-btn" data-action="close-no-class-dialog" aria-label="Cerrar ventana">✕</button>
      </div>
      <div class="modal-body">
        <div class="attendance-modal-field">
          <label for="noClassDateInput">Fecha de suspensión:</label>
          ${selectableDays.length > 0 ? `
            <select id="noClassDateInput" ${isEdit ? 'disabled' : ''}>
              ${selectableDays.map(d => `<option value="${d.date}" ${d.date === targetDate ? 'selected' : ''}>${d.date} (${d.dayOfWeek} ${String(d.dayNumber).padStart(2, '0')}) ${d.noClass ? '— [Ya suspendido]' : ''}</option>`).join('')}
            </select>
          ` : `
            <input type="date" id="noClassDateInput" value="${escapeHtml(targetDate)}" ${cycleStart ? `min="${cycleStart}"` : ''} ${cycleEnd ? `max="${cycleEnd}"` : ''} ${isEdit ? 'disabled' : ''}>
          `}
        </div>

        <div class="attendance-modal-field">
          <label for="noClassReasonSelect">Motivo de suspensión:</label>
          <select id="noClassReasonSelect">
            ${NO_CLASS_DEFAULT_REASONS.map(r => `<option value="${r}" ${r === selectValue ? 'selected' : ''}>${escapeHtml(r)}</option>`).join('')}
          </select>
        </div>

        <div class="attendance-modal-field" id="noClassCustomGroup" style="${selectValue === 'OTRO MOTIVO' ? '' : 'display:none;'}">
          <label for="noClassCustomReason">Especificar otro motivo: <span style="color:#ef4444;">*</span></label>
          <input type="text" id="noClassCustomReason" value="${escapeHtml(customReasonValue)}" placeholder="Escribe el motivo detallado" maxlength="80">
        </div>

        <div class="attendance-modal-field">
          <label for="noClassDetailInput">Observaciones o referencia oficial (opcional):</label>
          <textarea id="noClassDetailInput" rows="2" placeholder="Ej. Oficio circular o referencia oficial">${escapeHtml(currentDetail)}</textarea>
        </div>

        <div id="noClassModalWarning" class="attendance-modal-warning"></div>
      </div>
      <div class="attendance-modal-actions">
        <button type="button" class="btn small" data-action="close-no-class-dialog">Cancelar</button>
        <button type="button" class="btn primary small" data-action="submit-monthly-no-class">
          ${isEdit ? 'Actualizar suspensión' : 'Registrar suspensión'}
        </button>
      </div>
    </div>
  `;

  modal.classList.remove('hidden-control');

  const reasonSelect = modal.querySelector('#noClassReasonSelect');
  const customGroup = modal.querySelector('#noClassCustomGroup');
  const customInput = modal.querySelector('#noClassCustomReason');
  if (reasonSelect && customGroup) {
    reasonSelect.onchange = () => {
      if (reasonSelect.value === 'OTRO MOTIVO') {
        customGroup.style.display = 'flex';
        customInput?.focus();
      } else {
        customGroup.style.display = 'none';
      }
    };
  }

  const dateInput = modal.querySelector('#noClassDateInput');
  if (dateInput) {
    dateInput.onchange = () => {
      updateNoClassDialogWarning(dateInput.value);
    };
  }

  updateNoClassDialogWarning(targetDate);
}

async function submitMonthlyNoClass() {
  const modal = document.querySelector('#attendanceNoClassModal');
  if (!modal) return;

  const dateInput = modal.querySelector('#noClassDateInput');
  const reasonSelect = modal.querySelector('#noClassReasonSelect');
  const customInput = modal.querySelector('#noClassCustomReason');
  const detailInput = modal.querySelector('#noClassDetailInput');

  const targetDate = dateInput?.value;
  if (!targetDate) return toast('Por favor selecciona una fecha válida.', true);

  // Protección de operaciones en curso: no proceder si hay guardados en vuelo para esta fecha
  const mutationsForDate = Array.from(attendanceMonthlyMutations.values()).filter(m => m.date === targetDate);
  const hasInFlight = mutationsForDate.some(m => m.lifecycle === 'IN_FLIGHT');
  if (hasInFlight) {
    return toast(`No es posible registrar la suspensión: hay operaciones en proceso de guardado para la fecha ${targetDate}. Por favor espera a que finalicen.`, true);
  }

  let finalReason = reasonSelect?.value || 'CONSEJO TÉCNICO ESCOLAR';
  if (finalReason === 'OTRO MOTIVO') {
    finalReason = (customInput?.value || '').trim();
    if (!finalReason) {
      if (customInput) customInput.focus();
      return toast('Por favor especifica el motivo de la suspensión.', true);
    }
  }

  const detail = (detailInput?.value || '').trim();
  const dateVersion = attendanceMonthlyData?.dateVersions?.[targetDate] || state.attendanceDay?.dateVersion || '';

  const submitBtn = modal.querySelector('[data-action="submit-monthly-no-class"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Guardando...';
  }

  try {
    const payload = {
      date: targetDate,
      reason: finalReason,
      detail: detail,
      dateVersion: dateVersion
    };

    const res = await server('saveNoClass', payload);

    if (!res || (res.ok !== true && res.status !== 'ok')) {
      throw new Error(res?.error || res?.message || 'El servidor no confirmó el registro de suspensión.');
    }

    // Únicamente tras confirmación explícita del servidor:
    if (attendanceMonthlyData?.days) {
      const day = attendanceMonthlyData.days.find(d => d.date === targetDate);
      if (day) {
        day.noClass = true;
        day.noClassReason = finalReason;
        day.noClassDetail = detail;
      }
      if (res?.dateVersion && attendanceMonthlyData.dateVersions) {
        attendanceMonthlyData.dateVersions[targetDate] = res.dateVersion;
      }
    }

    if (state.attendanceDay && state.attendanceDay.date === targetDate) {
      state.attendanceDay.noClass = true;
      state.attendanceDay.noClassReason = finalReason;
      state.attendanceDay.noClassDetail = detail;
      if (res?.dateVersion) state.attendanceDay.dateVersion = res.dateVersion;
      renderAttendanceSavedSummary();
      syncAttendanceControlsState();
    }

    closeMonthlyNoClassModal();

    if (attendanceViewMode === 'monthly') {
      renderAttendanceMonthlyView();
      syncNoClassColumnOverlays();
    } else {
      loadAttendanceDay(targetDate);
    }

    window.dispatchEvent(new CustomEvent('attendance-updated'));
    if (res?.summaryWarning) {
      toast(`✓ Suspensión registrada correctamente: ${finalReason}. (Aviso: ${res.summaryWarning})`);
    } else {
      toast(`✓ Suspensión registrada correctamente: ${finalReason}`);
    }
  } catch (err) {
    console.error('Error al guardar día sin clases en el servidor:', err);
    // Detección de error de validación en resúmenes (celda C5 u otra de la hoja mensual)
    if (err.message && (err.message.includes('validación de datos') || err.message.includes('C5'))) {
      if (attendanceMonthlyData?.days) {
        const day = attendanceMonthlyData.days.find(d => d.date === targetDate);
        if (day) {
          day.noClass = true;
          day.noClassReason = finalReason;
          day.noClassDetail = detail;
        }
      }
      if (state.attendanceDay && state.attendanceDay.date === targetDate) {
        state.attendanceDay.noClass = true;
        state.attendanceDay.noClassReason = finalReason;
        state.attendanceDay.noClassDetail = detail;
        renderAttendanceSavedSummary();
        syncAttendanceControlsState();
      }
      closeMonthlyNoClassModal();
      if (attendanceViewMode === 'monthly') {
        renderAttendanceMonthlyView();
        syncNoClassColumnOverlays();
      } else {
        loadAttendanceDay(targetDate);
      }
      window.dispatchEvent(new CustomEvent('attendance-updated'));
      toast(`✓ Suspensión guardada para ${targetDate} (${finalReason}). Aviso: la actualización de la hoja mensual en Google Sheets presentó un aviso de validación en resúmenes.`);
      return;
    }
    // Principio estricto: no modificar estado confirmado local si el servidor no confirmó
    toast((err && err.message) ? err.message : 'No fue posible registrar el día sin clases en el servidor. El estado previo se conserva intacto.', true);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Registrar suspensión';
    }
  }
}

function showSuspensionDetail(date) {
  const modal = ensureMonthlyNoClassModal();
  if (!modal) return;

  const data = attendanceMonthlyData;
  const day = (data?.days || []).find(d => d.date === date) || (state.attendanceDay?.date === date ? state.attendanceDay : null);
  const reason = day?.noClassReason || 'SUSPENSIÓN DE CLASES';
  const detail = day?.noClassDetail || 'Sin observaciones registradas';
  const summary = getExistingAttendanceSummaryOnDate(date);

  modal.innerHTML = `
    <div class="attendance-no-class-modal-card">
      <div class="modal-head">
        <div>
          <div class="modal-eyebrow">Consulta de día sin clases</div>
          <h3 class="modal-title" id="noClassModalTitle">📅 ${escapeHtml(date)}</h3>
        </div>
        <button type="button" class="modal-close-btn" data-action="close-no-class-dialog" aria-label="Cerrar ventana">✕</button>
      </div>
      <div class="modal-body">
        <div style="background:#fef2f2;border:1.5px solid #fecdd3;border-radius:10px;padding:14px;color:#991b1b;">
          <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;color:#b91c1c;">Motivo oficial</div>
          <div style="font-size:16px;font-weight:800;line-height:1.3;">${escapeHtml(reason)}</div>
          <div style="font-size:12px;color:#7f1d1d;margin-top:8px;line-height:1.4;">${escapeHtml(detail)}</div>
        </div>

        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;font-size:12px;color:#334155;line-height:1.5;">
          <strong>Registros de asistencia:</strong> ${summary.count > 0 ? `<span style="color:#0f766e;font-weight:700;">${summary.count} alumno(s) con asistencia previa</span> conservados y protegidos bajo la suspensión.` : 'No hay asistencias registradas en esta fecha.'}
        </div>
      </div>
      <div class="attendance-modal-actions" style="justify-content:space-between;">
        <button type="button" class="btn small" style="background:#fef2f2;color:#991b1b;border:1px solid #fca5a5;" data-action="remove-monthly-no-class" data-date="${date}">
          🗑️ Retirar suspensión
        </button>
        <div style="display:flex;gap:8px;">
          <button type="button" class="btn small" data-action="close-no-class-dialog">Cerrar</button>
          <button type="button" class="btn primary small" data-action="edit-monthly-no-class" data-date="${date}">
            ✏️ Editar motivo
          </button>
        </div>
      </div>
    </div>
  `;

  modal.classList.remove('hidden-control');
}

function editMonthlyNoClass(date) {
  const data = attendanceMonthlyData;
  const day = (data?.days || []).find(d => d.date === date) || (state.attendanceDay?.date === date ? state.attendanceDay : null);
  closeMonthlyNoClassModal();
  openMonthlyNoClassDialog(date, {
    isEdit: true,
    initialReason: day?.noClassReason,
    initialDetail: day?.noClassDetail
  });
}

async function removeMonthlyNoClass(date) {
  if (!date) {
    date = $('#attendanceDate')?.value || state.attendanceDay?.date || '';
  }
  // Proteger operaciones en curso: no proceder si hay guardados en vuelo para esta fecha
  const mutationsForDate = Array.from(attendanceMonthlyMutations.values()).filter(m => m.date === date);
  const hasInFlight = mutationsForDate.some(m => m.lifecycle === 'IN_FLIGHT');
  if (hasInFlight) {
    return toast(`No es posible retirar la suspensión: hay operaciones en proceso de guardado para la fecha ${date}. Por favor espera a que finalicen.`, true);
  }

  const day = (attendanceMonthlyData?.days || []).find(d => d.date === date);
  const isWeekend = day ? day.isWeekend : ([0, 6].includes(new Date(date + 'T12:00:00').getDay()));
  if (isWeekend) {
    return toast(`No es posible retirar la suspensión de ${date}: es fin de semana y no es un día lectivo escolar.`, true);
  }

  const currentReason = day?.noClassReason || state.attendanceDay?.noClassReason || '';
  const isOfficialCandidate = ['Vacaciones', 'Consejo Técnico', 'Festivo', 'Oficial', 'Suspensión oficial'].some(k => currentReason.toLowerCase().includes(k.toLowerCase()));

  let confirmOfficialOverride = false;
  if (isOfficialCandidate) {
    const authOk = window.confirm(`ATENCIÓN: La fecha ${date} corresponde a una suspensión del calendario escolar oficial ('${currentReason}').\n\n¿Confirmas expresamente que se autoriza impartir clases en esta fecha oficial y habilitar la captura de asistencia?`);
    if (!authOk) return;
    confirmOfficialOverride = true;
  } else {
    const ok = window.confirm(`¿Deseas retirar la suspensión de esta fecha (${date})?\n\nSi la operación se confirma, podrás registrar nuevamente la asistencia de los alumnos, siempre que el calendario escolar permita clases ese día.`);
    if (!ok) return;
  }

  closeMonthlyNoClassModal();

  try {
    const res = await server('removeNoClass', { date, confirmOfficialOverride });
    if (res && (res.ok === true || res.status === 'ok')) {
      // Únicamente si el servidor confirmó legítimamente el retiro:
      const isCalendarBlocked = day ? (day.isWeekend || day.isOutsideCycle) : Boolean(state.attendanceDay?.isWeekend || state.attendanceDay?.isOutsideCycle);

      if (day) {
        day.noClass = false;
        day.noClassReason = null;
        day.noClassDetail = null;
      }
      if (res.dateVersion && attendanceMonthlyData?.dateVersions) {
        attendanceMonthlyData.dateVersions[date] = res.dateVersion;
      }
      if (state.attendanceDay && state.attendanceDay.date === date) {
        state.attendanceDay.noClass = false;
        state.attendanceDay.noClassReason = null;
        state.attendanceDay.noClassDetail = null;
        if (res.dateVersion) state.attendanceDay.dateVersion = res.dateVersion;
        renderAttendanceList();
        renderAttendanceSavedSummary();
        syncAttendanceNotice();
        syncAttendanceControlsState();
      }

      renderAttendanceMonthlyView();
      syncNoClassColumnOverlays();
      window.dispatchEvent(new CustomEvent('attendance-updated'));

      if (isCalendarBlocked) {
        toast(`✓ Suspensión retirada en el servidor para ${date}, pero la fecha continúa bloqueada por el calendario escolar (fin de semana o fuera de ciclo).`);
      } else if (res.summaryWarning) {
        toast(`✓ Suspensión retirada para ${date}. (Aviso: ${res.summaryWarning})`);
      } else {
        toast(res.message || `✓ Suspensión retirada correctamente en el servidor para el día ${date}.`);
      }
      return;
    }

    throw new Error(res?.error || res?.message || 'El servidor no confirmó el retiro de la suspensión.');
  } catch (err) {
    console.error('Fallo al retirar suspensión en el servidor:', err);
    // REGLA ESTRICTA: Si el servidor no confirma el retiro:
    // - Mantener la suspensión activa
    // - Conservar la cinta
    // - Mantener bloqueada la captura
    // - Conservar el motivo y las observaciones
    // - Informar que la operación no pudo completarse
    // - No modificar el estado confirmado local
    // - No simular el retiro
    // - No inventar endpoints
    toast(`No fue posible retirar la suspensión (${err.message || 'operación no confirmada por el servidor'}). La suspensión y los registros se mantienen intactos.`, true);
  }
}

function measureRibbonMotifPx(text) {
  let measurer = document.getElementById('attendanceRibbonMeasurer');
  if (!measurer) {
    measurer = document.createElement('span');
    measurer.id = 'attendanceRibbonMeasurer';
    measurer.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;top:-9999px;left:-9999px;white-space:nowrap;font-size:11px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;font-family:inherit;line-height:44px;';
    document.body.appendChild(measurer);
  }
  measurer.textContent = text;
  return Math.max(30, Math.ceil(measurer.offsetWidth || measurer.getBoundingClientRect().width));
}

function syncNoClassColumnOverlays() {
  const container = document.querySelector('.attendance-monthly-grid-container');
  const layer = document.querySelector('.attendance-monthly-ribbons-layer');
  const table = document.querySelector('.attendance-monthly-table');
  if (!container || !layer || !table) return;

  layer.innerHTML = '';
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');
  if (!thead || !tbody) return;

  const theadHeight = thead.offsetHeight;
  const tbodyHeight = tbody.offsetHeight;
  if (tbodyHeight <= 0) return;

  const days = attendanceMonthlyData?.days || [];
  days.forEach(d => {
    if (!d.noClass || d.isWeekend) return;
    const th = thead.querySelector(`th.th-day[data-date="${d.date}"]`);
    if (!th) return;

    if (window.getComputedStyle(th).display === 'none') return;

    const left = th.offsetLeft;
    const width = th.offsetWidth;
    const reason = (d.noClassReason || 'SUSPENSIÓN DE CLASES').trim().toUpperCase();
    const motif = `/// ${reason} `;
    const motifPx = measureRibbonMotifPx(motif);
    const initialRepeats = Math.max(4, Math.ceil(tbodyHeight / motifPx) + 3);
    let ribbonText = motif.repeat(initialRepeats) + '///';

    const overlay = document.createElement('div');
    overlay.className = 'attendance-no-class-column-overlay';
    overlay.setAttribute('data-date', d.date);
    overlay.setAttribute('title', `${d.date}: ${reason} (Clic para consultar o gestionar)`);
    overlay.style.left = `${left}px`;
    overlay.style.width = `${width}px`;
    overlay.style.top = `${theadHeight}px`;
    overlay.style.height = `${tbodyHeight}px`;

    const track = document.createElement('div');
    track.className = 'column-ribbon-track';
    track.setAttribute('data-date', d.date);
    track.setAttribute('aria-hidden', 'true');

    const span = document.createElement('span');
    span.textContent = ribbonText;
    track.appendChild(span);
    overlay.appendChild(track);
    layer.appendChild(overlay);

    // Medición y ajuste real en el DOM: garantiza cobertura continua e ininterrumpida de alumno 1 a 35+
    let safetyCounter = 0;
    while ((span.scrollHeight || span.offsetHeight) < (tbodyHeight + 200) && safetyCounter < 60) {
      safetyCounter++;
      ribbonText += motif;
      span.textContent = ribbonText;
    }

    overlay.onclick = (e) => {
      e.stopPropagation();
      showSuspensionDetail(d.date);
    };
  });
}

function showMonthlyConflictDetail(studentIdOrEl, maybeDate){
  let detailEl = $('#attendanceMonthlyNoteDetail');
  if (!detailEl) {
    detailEl = document.createElement('div');
    detailEl.id = 'attendanceMonthlyNoteDetail';
    detailEl.className = 'attendance-monthly-note-detail';
    const wrap = $('.attendance-monthly-table-wrap');
    if (wrap && wrap.parentNode) {
      wrap.parentNode.insertBefore(detailEl, wrap.nextSibling);
    }
  }

  let sid = studentIdOrEl;
  let date = maybeDate;
  if (studentIdOrEl && typeof studentIdOrEl === 'object' && studentIdOrEl.dataset) {
    sid = studentIdOrEl.dataset.studentId;
    date = studentIdOrEl.dataset.date;
  }
  sid = String(sid);

  const key = `${sid}|${date}`;
  const mutation = attendanceMonthlyMutations.get(key);
  const data = attendanceMonthlyData;
  if (!detailEl || !mutation || mutation.lifecycle !== 'CONFLICT') return;

  const student = (data?.activeStudents || []).find(s => String(s.id) === sid) || { name: `Alumno ${sid}` };
  const baseVal = mutation.base?.status || 'Vacío';
  const serverVal = mutation.serverCurrent?.status || 'Vacío';
  const myVal = mutation.newStatus || (mutation.action === 'DELETE' ? 'Eliminar' : 'Modificado');
  const reason = mutation.conflictReason || 'Modificación concurrente detectada en el servidor.';

  detailEl.classList.remove('hidden-control');
  detailEl.innerHTML = `
    <div class="note-detail-content" style="flex-direction:column;align-items:flex-start;gap:6px;width:100%;">
      <div style="display:flex;align-items:center;gap:8px;width:100%;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="note-detail-badge status-other" style="background:#fee2e2;color:#b91c1c;border:1px solid #ef4444;font-weight:bold;">⚠️ Conflicto</span>
          <strong>${escapeHtml(student.name)}</strong> · <span>Fecha: ${escapeHtml(date)}</span>
        </div>
        <button type="button" class="btn small" data-action="close-monthly-note" style="padding:2px 8px;font-size:12px;">✕ Cerrar</button>
      </div>
      <div class="note-detail-text" style="font-size:12px;line-height:1.4;">
        <div><strong>Motivo:</strong> ${escapeHtml(reason)}</div>
        <div style="margin-top:4px;">
          <span style="display:inline-block;margin-right:12px;"><strong>Valor original base:</strong> <code>${escapeHtml(baseVal)}</code></span>
          <span style="display:inline-block;margin-right:12px;"><strong>Valor actual del servidor:</strong> <code style="color:#047857;font-weight:bold;">${escapeHtml(serverVal)}</code></span>
          <span style="display:inline-block;"><strong>Tu cambio propuesto:</strong> <code style="color:#2563eb;font-weight:bold;">${escapeHtml(myVal)}</code></span>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap;">
        <button type="button" class="btn small" data-action="accept-conflict-server" data-student-id="${escapeHtml(sid)}" data-date="${escapeHtml(date)}" style="background:#059669;color:#fff;border:none;padding:5px 10px;font-size:12px;font-weight:600;border-radius:4px;cursor:pointer;">
          ✓ Aceptar valor del servidor (${escapeHtml(serverVal)})
        </button>
        <button type="button" class="btn small" data-action="reapply-conflict-mutation" data-student-id="${escapeHtml(sid)}" data-date="${escapeHtml(date)}" style="background:#2563eb;color:#fff;border:none;padding:5px 10px;font-size:12px;font-weight:600;border-radius:4px;cursor:pointer;">
          ↻ Forzar mi cambio sobre la nueva versión (${escapeHtml(myVal)})
        </button>
      </div>
    </div>
  `;
}

function resolveMonthlyConflict(studentId, date, resolutionType){
  const sid = String(studentId);
  const key = `${sid}|${date}`;
  const mutation = attendanceMonthlyMutations.get(key);
  const data = attendanceMonthlyData;
  if (!mutation || mutation.lifecycle !== 'CONFLICT' || !data) return;

  if (resolutionType === 'accept_server') {
    // Aceptar valor del servidor: adopta el registro actual del servidor en memoria local y descarta la mutación
    data.records = data.records || {};
    data.records[sid] = data.records[sid] || {};
    if (mutation.serverCurrent && mutation.serverCurrent.status) {
      data.records[sid][date] = {
        status: mutation.serverCurrent.status,
        note: mutation.serverCurrent.note || ''
      };
    } else {
      delete data.records[sid][date];
    }
    attendanceMonthlyMutations.delete(key);
    closeMonthlyNoteDetail();
    updateSingleMonthlyCellUi(sid, date);
    updateMonthlySaveButtonUi();
    if (typeof toast === 'function') toast('Se adoptó el valor actual del servidor.');
  } else if (resolutionType === 'reapply_user') {
    // Forzar mi cambio: actualiza la base al valor actual del servidor, toma la versión actual de la fecha y reintenta como LOCAL_PENDING
    mutation.base = {
      exists: Boolean(mutation.serverCurrent?.status),
      status: mutation.serverCurrent?.status || null,
      note: mutation.serverCurrent?.note || ''
    };
    mutation.expectedDateVersion = data.dateVersions?.[date] || 'v1_initial';
    mutation.lifecycle = 'LOCAL_PENDING';
    mutation.clientMutationId = 'M_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    delete mutation.conflictReason;
    delete mutation.serverCurrent;
    closeMonthlyNoteDetail();
    updateSingleMonthlyCellUi(sid, date);
    updateMonthlySaveButtonUi();
    if (typeof toast === 'function') toast('Cambio marcado como pendiente para reintentar sobre la nueva versión del servidor.');
  }
}

function closeMonthlyNoteDetail(){
  const detailEl = $('#attendanceMonthlyNoteDetail');
  if (detailEl) {
    detailEl.classList.add('hidden-control');
    detailEl.innerHTML = '';
  }
}

let attendanceMonthlyHighlightState = { studentId: null, date: null };

/**
 * Limpia el resaltado dinámico estilo Excel de fila, columna, encabezado y nombre.
 */
function clearMonthlyHighlight() {
  const container = document.getElementById('attendanceMonthlyView');
  if (!container) return;

  container.querySelectorAll('.tr-student.is-row-highlighted').forEach(tr => {
    tr.classList.remove('is-row-highlighted');
  });
  container.querySelectorAll('.td-student-sticky.is-student-highlighted').forEach(td => {
    td.classList.remove('is-student-highlighted');
  });
  container.querySelectorAll('.td-cell.is-col-highlighted').forEach(td => {
    td.classList.remove('is-col-highlighted');
  });
  container.querySelectorAll('.th-day.is-header-highlighted').forEach(th => {
    th.classList.remove('is-header-highlighted');
  });

  attendanceMonthlyHighlightState = { studentId: null, date: null };
}

/**
 * Actualiza de forma reactiva y ultraligera el resaltado estilo Excel:
 * - Fila del alumno (.is-row-highlighted)
 * - Nombre del alumno inmovilizado (.is-student-highlighted)
 * - Columna de la fecha (.is-col-highlighted)
 * - Encabezado de la fecha inmovilizado (.is-header-highlighted)
 * Opera exclusivamente sobre las clases visuales de los elementos afectados sin reconstruir la cuadrícula.
 */
function updateMonthlyHighlight(studentId, date, force = false) {
  const container = document.getElementById('attendanceMonthlyView');
  if (!container) return;

  const sid = studentId ? String(studentId) : null;
  const dt = date ? String(date) : null;

  const prevSid = attendanceMonthlyHighlightState.studentId;
  const prevDate = attendanceMonthlyHighlightState.date;

  // Actualizar resaltado de fila y nombre si cambió el alumno o se fuerza
  if (force || prevSid !== sid) {
    if (prevSid && !force) {
      const prevRow = container.querySelector(`.tr-student[data-student-id="${prevSid}"]`);
      if (prevRow) {
        prevRow.classList.remove('is-row-highlighted');
        const prevSticky = prevRow.querySelector('.td-student-sticky');
        if (prevSticky) prevSticky.classList.remove('is-student-highlighted');
      } else {
        container.querySelectorAll('.tr-student.is-row-highlighted').forEach(tr => tr.classList.remove('is-row-highlighted'));
        container.querySelectorAll('.td-student-sticky.is-student-highlighted').forEach(td => td.classList.remove('is-student-highlighted'));
      }
    } else if (force) {
      container.querySelectorAll('.tr-student.is-row-highlighted').forEach(tr => tr.classList.remove('is-row-highlighted'));
      container.querySelectorAll('.td-student-sticky.is-student-highlighted').forEach(td => td.classList.remove('is-student-highlighted'));
    }

    if (sid) {
      const newRow = container.querySelector(`.tr-student[data-student-id="${sid}"]`);
      if (newRow) {
        newRow.classList.add('is-row-highlighted');
        const newSticky = newRow.querySelector('.td-student-sticky');
        if (newSticky) newSticky.classList.add('is-student-highlighted');
      }
    }
  }

  // Actualizar resaltado de columna y encabezado de fecha si cambió la fecha o se fuerza
  if (force || prevDate !== dt) {
    if (prevDate && !force) {
      container.querySelectorAll(`.td-cell[data-date="${prevDate}"].is-col-highlighted`).forEach(td => {
        td.classList.remove('is-col-highlighted');
      });
      const prevTh = container.querySelector(`th.th-day[data-date="${prevDate}"]`);
      if (prevTh) prevTh.classList.remove('is-header-highlighted');
    } else if (force) {
      container.querySelectorAll('.td-cell.is-col-highlighted').forEach(td => td.classList.remove('is-col-highlighted'));
      container.querySelectorAll('.th-day.is-header-highlighted').forEach(th => th.classList.remove('is-header-highlighted'));
    }

    if (dt) {
      container.querySelectorAll(`.td-cell[data-date="${dt}"]`).forEach(td => {
        td.classList.add('is-col-highlighted');
      });
      const newTh = container.querySelector(`th.th-day[data-date="${dt}"]`);
      if (newTh) newTh.classList.add('is-header-highlighted');
    }
  }

  attendanceMonthlyHighlightState = { studentId: sid, date: dt };
}

function focusMonthlyCell(studentId, date, scrollIntoView = true){
  if (!studentId || !date) return;
  const sid = String(studentId);
  const data = attendanceMonthlyData;
  if (!data || attendanceMonthlyStatus !== 'ready') return;

  const day = (data.days || []).find(d => d.date === date);
  if (!day || day.isOutsideCycle) {
    return; // No enfocar fechas fuera del ciclo escolar
  }

  attendanceMonthlyFocusedCell = { studentId: sid, date };

  // Remover foco visual previo
  document.querySelectorAll('.attendance-monthly-table td.td-cell.is-focused').forEach(el => {
    el.classList.remove('is-focused');
  });

  const cell = document.querySelector(`.attendance-monthly-table td.td-cell[data-student-id="${sid}"][data-date="${date}"]`);
  if (cell) {
    cell.classList.add('is-focused');
    cell.setAttribute('tabindex', '0');
    if (document.activeElement && document.activeElement !== cell && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
    cell.focus();
    if (scrollIntoView) {
      cell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  // Actualizar resaltado dinámico de fila, nombre, columna y encabezado estilo Excel
  updateMonthlyHighlight(sid, date);

  // Si la celda enfocada tiene conflicto activo, mostrar automáticamente los controles de resolución
  const key = `${sid}|${date}`;
  const mut = attendanceMonthlyMutations.get(key);
  if (mut && mut.lifecycle === 'CONFLICT') {
    showMonthlyConflictDetail(sid, date);
  }

  // Sincronizar pad táctil móvil
  syncMonthlyTouchPad();
}

function syncMonthlyTouchPad(){
  let touchPad = $('#attendanceMonthlyTouchPad');
  if (!touchPad) {
    touchPad = document.createElement('div');
    touchPad.id = 'attendanceMonthlyTouchPad';
    touchPad.className = 'attendance-monthly-touch-pad hidden-control';
    document.body.appendChild(touchPad);
  }

  if (attendanceViewMode !== 'monthly' || !attendanceMonthlyFocusedCell || attendanceMonthlyStatus !== 'ready') {
    touchPad.classList.add('hidden-control');
    return;
  }

  const sid = attendanceMonthlyFocusedCell.studentId;
  const date = attendanceMonthlyFocusedCell.date;
  const data = attendanceMonthlyData;
  if (!data) {
    touchPad.classList.add('hidden-control');
    return;
  }

  const student = (data.activeStudents || []).find(s => String(s.id) === sid) ||
                  (data.inactiveStudentsWithRecords || []).find(s => String(s.id) === sid);
  const day = (data.days || []).find(d => d.date === date);

  if (!student || !day || day.noClass || day.isWeekend || day.isOutsideCycle) {
    touchPad.classList.add('hidden-control');
    return;
  }

  touchPad.classList.remove('hidden-control');
  touchPad.innerHTML = `
    <div class="touch-info">
      <strong>${escapeHtml(student.name)}</strong><br>
      <span>${escapeHtml(day.dayOfWeek)} ${day.dayNumber} · ${date}</span>
    </div>
    <div class="touch-buttons">
      <button type="button" class="touch-btn status-a" data-action="monthly-touch-val" data-val="A">A</button>
      <button type="button" class="touch-btn status-f" data-action="monthly-touch-val" data-val="F">F</button>
      <button type="button" class="touch-btn status-r" data-action="monthly-touch-val" data-val="R">R</button>
      <button type="button" class="touch-btn status-j" data-action="monthly-touch-val" data-val="J">J</button>
      <button type="button" class="touch-btn btn-delete" data-action="monthly-touch-delete">Borrar</button>
    </div>
  `;
}

function mutateMonthlyCell(studentId, date, letter){
  const sid = String(studentId);
  const data = attendanceMonthlyData;
  if (!data || attendanceMonthlyStatus !== 'ready' || attendanceMonthlySaving) return;

  const day = (data.days || []).find(d => d.date === date);
  if (!day || day.noClass || day.isWeekend || day.isOutsideCycle) {
    return; // Días sin clase, fines de semana y fechas fuera del ciclo estrictamente bloqueados
  }

  const student = (data.activeStudents || []).find(s => String(s.id) === sid);
  if (!student) {
    // Alumno dado de baja o desconocido: no editable
    return;
  }

  const upper = String(letter).toUpperCase();
  if (!['A', 'F', 'R', 'J'].includes(upper)) {
    return; // Rechazar caracteres inválidos conservando el valor anterior
  }

  const serverRec = data.records?.[sid]?.[date];
  const baseExists = Boolean(serverRec && serverRec.status);
  const baseStatus = baseExists ? String(serverRec.status).toUpperCase() : null;
  const baseNote = baseExists ? String(serverRec.note || '') : '';

  const key = `${sid}|${date}`;
  const existingMut = attendanceMonthlyMutations.get(key);
  if (existingMut && existingMut.lifecycle === 'IN_FLIGHT') {
    if (typeof toast === 'function') toast('Esta celda se está guardando en el servidor. Por favor espera a que finalice.', true);
    return;
  }

  // Protección obligatoria de operaciones UNCERTAIN: no permitir que desaparezcan silenciosamente al regresar al estado base
  if (existingMut && existingMut.lifecycle === 'UNCERTAIN') {
    // Si la celda está incierta, conservamos la mutación original intacta (identificador y contenido previo)
    // y registramos la intención final del usuario para ser aplicada inmediatamente tras la reconciliación real con el servidor.
    existingMut.desiredStatusAfterReconciliation = upper;
    existingMut.desiredActionAfterReconciliation = 'UPSERT';
    if (typeof toast === 'function') {
      toast(`Operación incierta retenida (${existingMut.clientMutationId}). Reconciliando con el servidor antes de aplicar ${upper}.`, true);
    }
    updateSingleMonthlyCellUi(sid, date);
    updateMonthlySaveButtonUi();
    return;
  }

  // Si el nuevo valor coincide exactamente con el valor original del servidor, se revierte la mutación
  if (baseExists && baseStatus === upper) {
    attendanceMonthlyMutations.delete(key);
  } else {
    // Si cambia el contenido respecto a la mutación previa, se asigna nuevo identificador estable
    const isSamePayload = existingMut && existingMut.action === 'UPSERT' && existingMut.newStatus === upper;
    const clientMutationId = (isSamePayload && existingMut.clientMutationId)
      ? existingMut.clientMutationId
      : ('M_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9));

    attendanceMonthlyMutations.set(key, {
      clientMutationId,
      studentId: sid,
      date,
      action: 'UPSERT',
      newStatus: upper,
      // Conservación de observación: newNote se deja undefined para que el servidor conserve la existente si ya existía
      newNote: undefined,
      lifecycle: 'LOCAL_PENDING',
      base: {
        exists: baseExists,
        status: baseStatus,
        note: baseNote
      }
    });
  }

  updateSingleMonthlyCellUi(sid, date);
  updateMonthlySaveButtonUi();
}

function deleteMonthlyCell(studentId, date){
  const sid = String(studentId);
  const data = attendanceMonthlyData;
  if (!data || attendanceMonthlyStatus !== 'ready' || attendanceMonthlySaving) return;

  const day = (data.days || []).find(d => d.date === date);
  if (!day || day.noClass || day.isWeekend || day.isOutsideCycle) return;

  const student = (data.activeStudents || []).find(s => String(s.id) === sid);
  if (!student) return;

  const key = `${sid}|${date}`;
  const existingMut = attendanceMonthlyMutations.get(key);
  if (existingMut && existingMut.lifecycle === 'IN_FLIGHT') {
    if (typeof toast === 'function') toast('Esta celda se está guardando en el servidor. Por favor espera a que finalice.', true);
    return;
  }

  // Protección obligatoria de operaciones UNCERTAIN: no permitir que desaparezcan silenciosamente en celda originalmente vacía
  if (existingMut && existingMut.lifecycle === 'UNCERTAIN') {
    existingMut.desiredStatusAfterReconciliation = null;
    existingMut.desiredActionAfterReconciliation = 'DELETE';
    if (typeof toast === 'function') {
      toast(`Operación incierta retenida (${existingMut.clientMutationId}). Reconciliando con el servidor antes de eliminar.`, true);
    }
    updateSingleMonthlyCellUi(sid, date);
    updateMonthlySaveButtonUi();
    return;
  }

  const serverRec = data.records?.[sid]?.[date];
  const baseExists = Boolean(serverRec && serverRec.status);
  const baseStatus = baseExists ? String(serverRec.status).toUpperCase() : null;
  const baseNote = baseExists ? String(serverRec.note || '') : '';

  if (!baseExists) {
    // Si nunca existió en servidor y había una mutación UPSERT pendiente, simplemente se elimina la mutación
    if (attendanceMonthlyMutations.has(key)) {
      attendanceMonthlyMutations.delete(key);
      updateSingleMonthlyCellUi(sid, date);
      updateMonthlySaveButtonUi();
    }
    return;
  }

  const isSamePayload = existingMut && existingMut.action === 'DELETE';
  const clientMutationId = (isSamePayload && existingMut.clientMutationId)
    ? existingMut.clientMutationId
    : ('M_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9));

  attendanceMonthlyMutations.set(key, {
    clientMutationId,
    studentId: sid,
    date,
    action: 'DELETE',
    newStatus: null,
    newNote: '',
    lifecycle: 'LOCAL_PENDING',
    base: {
      exists: true,
      status: baseStatus,
      note: baseNote
    }
  });

  updateSingleMonthlyCellUi(sid, date);
  updateMonthlySaveButtonUi();
}

function updateSingleMonthlyCellUi(studentId, date){
  const sid = String(studentId);
  const cell = document.querySelector(`.attendance-monthly-table td.td-cell[data-student-id="${sid}"][data-date="${date}"]`);
  if (!cell) return;

  const data = attendanceMonthlyData;
  if (!data) return;

  const day = (data.days || []).find(d => d.date === date);
  const student = (data.activeStudents || []).find(s => String(s.id) === sid) ||
                  (data.inactiveStudentsWithRecords || []).find(s => String(s.id) === sid);
  if (!day || !student) return;

  const key = `${sid}|${date}`;
  const mutation = attendanceMonthlyMutations.get(key);
  const serverRec = data.records?.[sid]?.[date];

  cell.classList.remove('is-dirty', 'is-deleted', 'is-in-flight', 'is-conflict', 'is-uncertain', 'is-rejected');
  if (mutation) {
    if (mutation.lifecycle === 'IN_FLIGHT') {
      cell.classList.add('is-in-flight');
    } else if (mutation.lifecycle === 'CONFLICT') {
      cell.classList.add('is-conflict');
    } else if (mutation.lifecycle === 'UNCERTAIN') {
      cell.classList.add('is-uncertain');
    } else if (mutation.lifecycle === 'REJECTED') {
      cell.classList.add('is-rejected');
    }

    if (mutation.action === 'DELETE') {
      cell.classList.add('is-deleted');
    } else {
      cell.classList.add('is-dirty');
    }
  }

  cell.innerHTML = renderMonthlyCellBadge(serverRec, day, student.name, sid);
}

function updateMonthlySaveButtonUi(){
  const btn = $('#btnSaveMonthlyAttendance');
  const monthSelect = $('#attendanceMonthSelect');
  if (monthSelect) {
    monthSelect.disabled = attendanceMonthlySaving;
  }

  if (!btn) return;

  const count = attendanceMonthlyMutations.size;
  const sendableCount = Array.from(attendanceMonthlyMutations.values()).filter(m => m.lifecycle !== 'REJECTED').length;
  if (attendanceMonthlySaving) {
    btn.disabled = true;
    btn.innerHTML = `<svg class="spin" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-linecap="round"/></svg> Guardando...`;
  } else {
    btn.disabled = (sendableCount === 0);
    btn.innerHTML = count > 0 ? `💾 Guardar (${count})` : '💾 Guardar';
  }
}

function navigateMonthlyTable(keyEvent){
  if (!attendanceMonthlyFocusedCell || attendanceViewMode !== 'monthly') return;
  const data = attendanceMonthlyData;
  if (!data || attendanceMonthlyStatus !== 'ready') return;

  const students = data.activeStudents || [];
  // Excluir fines de semana y fechas fuera del ciclo escolar de la navegación
  const workDays = (data.days || []).filter(d => !d.isWeekend && !d.isOutsideCycle);
  if (students.length === 0 || workDays.length === 0) return;

  const curSid = attendanceMonthlyFocusedCell.studentId;
  const curDate = attendanceMonthlyFocusedCell.date;

  const sIdx = students.findIndex(s => String(s.id) === curSid);
  const dIdx = workDays.findIndex(d => d.date === curDate);

  if (sIdx < 0 || dIdx < 0) return;

  let nextS = sIdx;
  let nextD = dIdx;

  switch (keyEvent.key) {
    case 'ArrowUp':
      if (sIdx > 0) nextS = sIdx - 1;
      keyEvent.preventDefault();
      break;
    case 'ArrowDown':
      if (sIdx < students.length - 1) nextS = sIdx + 1;
      keyEvent.preventDefault();
      break;
    case 'ArrowLeft':
      if (dIdx > 0) nextD = dIdx - 1;
      keyEvent.preventDefault();
      break;
    case 'ArrowRight':
      if (dIdx < workDays.length - 1) nextD = dIdx + 1;
      keyEvent.preventDefault();
      break;
    case 'Tab':
      if (keyEvent.shiftKey) {
        if (dIdx > 0) {
          nextD = dIdx - 1;
          keyEvent.preventDefault();
        } else if (sIdx > 0) {
          nextS = sIdx - 1;
          nextD = workDays.length - 1;
          keyEvent.preventDefault();
        } else {
          // Permite salir hacia atrás de la tabla sin atrapar el foco
          return;
        }
      } else {
        if (dIdx < workDays.length - 1) {
          nextD = dIdx + 1;
          keyEvent.preventDefault();
        } else if (sIdx < students.length - 1) {
          nextS = sIdx + 1;
          nextD = 0;
          keyEvent.preventDefault();
        } else {
          // Permite salir hacia adelante de la tabla sin atrapar el foco
          return;
        }
      }
      break;
    default:
      return;
  }

  const targetStudent = students[nextS];
  const targetDay = workDays[nextD];
  if (targetStudent && targetDay) {
    focusMonthlyCell(targetStudent.id, targetDay.date, true);
  }
}

function validateMonthlyBatchResponse(res, chunk) {
  if (!res || typeof res !== 'object') {
    return {
      isValid: false,
      error: 'Respuesta inválida del servidor (no es un objeto válido).'
    };
  }

  if (!Array.isArray(res.results)) {
    return {
      isValid: false,
      error: (res.error || res.message) ? (res.error || res.message) : 'La propiedad results en la respuesta del servidor no es un arreglo.'
    };
  }

  const VALID_STATUSES = new Set([
    'SAVED',
    'ALREADY_PERSISTED_CURRENT',
    'CONFLICT',
    'UNCERTAIN_RECONCILIATION_REQUIRED',
    'PERSISTENCE_UNCERTAIN',
    'HISTORICAL_MUTATION_SUPERSEDED',
    'MUTATION_ID_REUSED_WITH_DIFFERENT_PAYLOAD',
    'BLOCKED_DUPLICATE_KEY',
    'VALIDATION_ERROR',
    'REJECTED_NO_CLASS_DAY'
  ]);

  const DEFINITIVE_REJECTIONS = new Set([
    'HISTORICAL_MUTATION_SUPERSEDED',
    'MUTATION_ID_REUSED_WITH_DIFFERENT_PAYLOAD',
    'BLOCKED_DUPLICATE_KEY',
    'VALIDATION_ERROR',
    'REJECTED_NO_CLASS_DAY'
  ]);

  const chunkIds = new Set(chunk.map(m => m.clientMutationId));
  const seenIds = new Set();
  const duplicateIds = new Set();
  const contradictoryIds = new Set();
  const resultsByMutationId = new Map();

  for (const item of res.results) {
    if (!item || typeof item !== 'object' || !item.clientMutationId) {
      continue;
    }
    const id = String(item.clientMutationId);

    if (!chunkIds.has(id)) {
      // Identificador desconocido que no fue enviado en este chunk
      continue;
    }

    if (seenIds.has(id)) {
      duplicateIds.add(id);
      const prev = resultsByMutationId.get(id);
      if (prev && prev.status !== item.status) {
        contradictoryIds.add(id);
      }
    } else {
      seenIds.add(id);
      resultsByMutationId.set(id, item);
    }
  }

  return {
    isValid: true,
    resultsByMutationId,
    duplicateIds,
    contradictoryIds,
    VALID_STATUSES,
    DEFINITIVE_REJECTIONS,
    isPartialError: (res.ok !== true),
    serverGeneralError: (res.ok !== true ? (res.error || res.message || 'Error general informado por el servidor') : null)
  };
}

/**
 * Conteo reactivo y estricto de registros de asistencia confirmados para un mes.
 * Solo contabiliza celdas con estado válido persistidas en data.records.
 * No contabiliza intenciones pendientes, inciertas, en conflicto o rechazadas.
 */
function countMonthlyConfirmedRecords(records, monthPrefix) {
  if (!records || typeof records !== 'object') return 0;
  let count = 0;
  Object.values(records).forEach(stRecords => {
    if (stRecords && typeof stRecords === 'object') {
      Object.keys(stRecords).forEach(d => {
        if ((!monthPrefix || d.startsWith(monthPrefix)) && stRecords[d] && stRecords[d].status) {
          count++;
        }
      });
    }
  });
  return count;
}

async function saveMonthlyAttendanceBatch(){
  if (attendanceMonthlySaving || attendanceMonthlyMutations.size === 0) return;
  const data = attendanceMonthlyData;
  if (!data || attendanceMonthlyStatus !== 'ready') return;

  // Filtrar mutaciones enviables (excluir las rechazadas definitivamente que no hayan sido editadas)
  const allMutations = Array.from(attendanceMonthlyMutations.values()).filter(m => m.lifecycle !== 'REJECTED');
  if (allMutations.length === 0) return;

  // Confirmación explícita previa si existen eliminaciones de registros existentes
  const pendingDeletes = allMutations.filter(m => m.action === 'DELETE');
  if (pendingDeletes.length > 0) {
    const withNotes = pendingDeletes.filter(m => m.base?.note);
    let confirmMsg = `Estás a punto de guardar ${pendingDeletes.length} eliminación(es) de asistencia existente(s).\n\n`;
    if (withNotes.length > 0) {
      confirmMsg += `⚠️ Atención: ${withNotes.length} de los registros a eliminar contienen observaciones previas que se perderán.\n\n`;
    }
    confirmMsg += `Recuerda:\n- Una celda vacía significa "sin registrar".\n- Eliminar un registro no equivale a registrar una falta.\n\n¿Deseas confirmar la eliminación y proceder con el guardado?`;
    const userConfirmed = window.confirm(confirmMsg);
    if (!userConfirmed) {
      return; // Cancelar guardado conservando las modificaciones pendientes
    }
  }

  attendanceMonthlySaving = true;
  updateMonthlySaveButtonUi();

  const originalMonth = data.month;
  const BATCH_SIZE = 40; // Límite del servidor MAX_BATCH_SIZE
  const chunks = [];
  for (let i = 0; i < allMutations.length; i += BATCH_SIZE) {
    chunks.push(allMutations.slice(i, i + BATCH_SIZE));
  }

  let totalSaved = 0;
  let totalConflicts = 0;
  let totalUncertain = 0;
  let totalBlocked = 0;
  let currentActiveChunk = null;
  let syncEmitted = false;
  const deferredIntents = [];
  let deferredIntentsApplied = false;

  const applyDeferredIntents = () => {
    if (deferredIntentsApplied || deferredIntents.length === 0) return;
    deferredIntentsApplied = true;
    const intentsToProcess = [...deferredIntents];
    deferredIntents.length = 0;
    intentsToProcess.forEach(intent => {
      if (intent.action === 'DELETE') {
        deleteMonthlyCell(intent.studentId, intent.date);
      } else if (intent.action === 'UPSERT' && intent.status) {
        mutateMonthlyCell(intent.studentId, intent.date, intent.status);
      }
    });
  };

  try {
    for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
      const chunk = chunks[cIdx];
      currentActiveChunk = chunk;

      // Transición de estado a IN_FLIGHT para el lote en envío
      chunk.forEach(m => {
        m.lifecycle = 'IN_FLIGHT';
        updateSingleMonthlyCellUi(m.studentId, m.date);
      });

      const datesInChunk = Array.from(new Set(chunk.map(m => m.date)));
      const dateVersions = {};
      datesInChunk.forEach(d => {
        dateVersions[d] = data.dateVersions?.[d] || 'v1_initial';
      });

      const payload = {
        month: data.month,
        mutations: chunk,
        dateVersions: dateVersions
      };

      let res;
      try {
        res = await server('saveMonthAttendance', payload);
      } catch (transportErr) {
        // Excepción de transporte / timeout / desconexión en este lote
        chunk.forEach(m => {
          m.lifecycle = 'UNCERTAIN';
          updateSingleMonthlyCellUi(m.studentId, m.date);
        });
        totalUncertain += chunk.length;
        throw transportErr;
      }

      // Comprobación de respuesta tardía: descartar si cambió el mes o la estructura
      if (attendanceMonthlyMonth !== originalMonth || attendanceMonthlyData !== data) {
        console.warn('Respuesta tardía descartada: el mes o contexto fue cambiado durante la operación de guardado.');
        return;
      }

      // Validación rigurosa de contrato de respuesta
      const val = validateMonthlyBatchResponse(res, chunk);
      if (!val.isValid) {
        chunk.forEach(m => {
          m.lifecycle = 'UNCERTAIN';
          updateSingleMonthlyCellUi(m.studentId, m.date);
        });
        totalUncertain += chunk.length;
        throw new Error(val.error);
      }

      if (val.isPartialError) {
        console.warn('El servidor devolvió ok: false pero contiene resultados individuales procesables:', val.serverGeneralError);
      }

      // Procesar individualmente cada mutación del lote
      chunk.forEach(matchMut => {
        const key = `${matchMut.studentId}|${matchMut.date}`;
        const id = matchMut.clientMutationId;

        // Caso A: Duplicados o contradictorios devueltos por el servidor (ambiguos)
        if (val.duplicateIds.has(id) || val.contradictoryIds.has(id)) {
          matchMut.lifecycle = 'UNCERTAIN';
          matchMut.uncertainReason = 'Respuesta ambigua del servidor: identificador de mutación duplicado o contradictorio.';
          totalUncertain++;
          updateSingleMonthlyCellUi(matchMut.studentId, matchMut.date);
          return;
        }

        // Caso B: Resultado omitido por el servidor
        if (!val.resultsByMutationId.has(id)) {
          matchMut.lifecycle = 'UNCERTAIN';
          matchMut.uncertainReason = 'El servidor omitió el resultado para esta mutación en results.';
          totalUncertain++;
          updateSingleMonthlyCellUi(matchMut.studentId, matchMut.date);
          return;
        }

        const r = val.resultsByMutationId.get(id);

        // Caso C: Estado desconocido
        if (!val.VALID_STATUSES.has(r.status)) {
          matchMut.lifecycle = 'UNCERTAIN';
          matchMut.uncertainReason = `Estado desconocido devuelto por el servidor: ${r.status}`;
          totalUncertain++;
          updateSingleMonthlyCellUi(matchMut.studentId, matchMut.date);
          return;
        }

        // Caso D: Estados confirmados
        if (r.status === 'SAVED' || r.status === 'ALREADY_PERSISTED_CURRENT') {
          totalSaved++;
          matchMut.lifecycle = 'CONFIRMED';
          // Aplicar cambio confirmado en el modelo local en memoria
          if (!data.records[matchMut.studentId]) data.records[matchMut.studentId] = {};
          if (matchMut.action === 'DELETE') {
            delete data.records[matchMut.studentId][matchMut.date];
          } else {
            data.records[matchMut.studentId][matchMut.date] = {
              status: matchMut.newStatus,
              note: (matchMut.newNote !== undefined) ? matchMut.newNote : (matchMut.base?.note || '')
            };
          }
          attendanceMonthlyMutations.delete(key);
          attendanceMonthlyConfirmedMutations.add(matchMut.clientMutationId);

          // Sincronización en memoria con Pase diario si coincide con la fecha cargada
          if (state.attendanceDay && state.attendanceDay.date === matchMut.date) {
            state.attendanceRecords = state.attendanceRecords || {};
            state.attendanceDay.existing = state.attendanceDay.existing || {};
            if (matchMut.action === 'DELETE') {
              state.attendanceRecords[matchMut.studentId] = { status: '', note: '' };
              delete state.attendanceDay.existing[matchMut.studentId];
              delete state.attendanceDay.existing[String(matchMut.studentId)];
            } else {
              const effNote = (matchMut.newNote !== undefined)
                ? matchMut.newNote
                : (matchMut.base?.note !== undefined ? matchMut.base.note : (state.attendanceDay.existing[matchMut.studentId]?.note || ''));
              state.attendanceRecords[matchMut.studentId] = {
                status: matchMut.newStatus,
                note: effNote
              };
              state.attendanceDay.existing[matchMut.studentId] = {
                status: matchMut.newStatus,
                note: effNote
              };
            }
          }

          // Si el usuario intentó una acción diferida mientras la celda estaba incierta, registrarla para aplicarla tras desbloquear guardado
          if (matchMut.desiredActionAfterReconciliation) {
            deferredIntents.push({
              studentId: matchMut.studentId,
              date: matchMut.date,
              action: matchMut.desiredActionAfterReconciliation,
              status: matchMut.desiredStatusAfterReconciliation
            });
          }
        } else if (r.status === 'CONFLICT') {
          totalConflicts++;
          matchMut.lifecycle = 'CONFLICT';
          matchMut.conflictReason = r.conflict?.reason || 'Conflicto de concurrencia en servidor';
          matchMut.serverCurrent = {
            status: r.conflict?.serverStatus !== undefined ? r.conflict.serverStatus : null,
            note: r.conflict?.serverNote || ''
          };
          console.warn(`Conflicto en ${matchMut.date} alumno ${matchMut.studentId}: ${matchMut.conflictReason}`);
        } else if (r.status === 'UNCERTAIN_RECONCILIATION_REQUIRED' || r.status === 'PERSISTENCE_UNCERTAIN') {
          totalUncertain++;
          matchMut.lifecycle = 'UNCERTAIN';
          matchMut.uncertainReason = r.message || r.error || 'Reconciliación requerida por el servidor (escritura previa incierta).';
          console.warn(`Reconciliación requerida en ${matchMut.date} alumno ${matchMut.studentId}`);
        } else if (val.DEFINITIVE_REJECTIONS && val.DEFINITIVE_REJECTIONS.has(r.status)) {
          totalBlocked++;
          matchMut.lifecycle = 'REJECTED';
          matchMut.rejectReason = r.message || r.error || r.status;
          console.warn(`Operación rechazada definitivamente en ${matchMut.date} alumno ${matchMut.studentId}: ${r.status}`);
        } else {
          totalBlocked++;
          matchMut.lifecycle = 'UNCERTAIN';
          console.warn(`Operación bloqueada en ${matchMut.date} alumno ${matchMut.studentId}: ${r.status}`);
        }

        updateSingleMonthlyCellUi(matchMut.studentId, matchMut.date);
      });

      // Actualización SELECTIVA de dateVersions:
      // Sólo actualizar la versión de aquellas fechas donde TODAS sus mutaciones hayan resultado exitosas
      // y donde la versión provista sea una cadena no vacía válida
      if (res.dateVersions && typeof res.dateVersions === 'object' && !Array.isArray(res.dateVersions)) {
        data.dateVersions = data.dateVersions || {};
        datesInChunk.forEach(d => {
          const v = res.dateVersions[d];
          if (typeof v !== 'string' || v.trim() === '') return;
          const chunkMutationsForDate = chunk.filter(m => m.date === d);
          const allConfirmed = chunkMutationsForDate.every(m => {
            const id = m.clientMutationId;
            if (val.duplicateIds.has(id)) return false;
            const r = val.resultsByMutationId.get(id);
            return r && (r.status === 'SAVED' || r.status === 'ALREADY_PERSISTED_CURRENT');
          });
          if (allConfirmed) {
            data.dateVersions[d] = v;
          }
        });
      }

      currentActiveChunk = null;
    }

    // Al finalizar todos los chunks con éxito:
    if (totalSaved > 0 && !syncEmitted) {
      syncEmitted = true;
      state.attendanceSummary = null;
      ++attendanceDataGen;
      attendanceMonthlySyncedDataGen = attendanceDataGen;
      window.dispatchEvent(new CustomEvent('attendance-updated'));
    }

    attendanceMonthlySaving = false;
    updateMonthlySaveButtonUi();

    // Aplicar intenciones diferidas exactamente una vez que el guardado ha finalizado
    applyDeferredIntents();

    if (totalConflicts > 0 || totalUncertain > 0 || totalBlocked > 0) {
      toast(`Guardado parcial: ${totalSaved} confirmados. Hubo ${totalConflicts} en conflicto, ${totalUncertain} inciertos, ${totalBlocked} bloqueados.`, true);
      if (totalConflicts > 0) {
        // Reconciliación controlada interna: no bloqueada por attendanceMonthlySaving
        await loadAttendanceMonthly(data.month, true, true);
      }
    } else {
      // Recalcular contador de registros mensuales confirmados tras asentar mutaciones
      if (data) {
        const confirmedCount = countMonthlyConfirmedRecords(data.records, data.month);
        if (!data.diagnostics) data.diagnostics = {};
        data.diagnostics.monthRecordsFound = confirmedCount;
      }

      if (attendanceMonthlyMutations.size > 0) {
        toast(`Reconciliación completada (${totalSaved} confirmados). Tienes ${attendanceMonthlyMutations.size} cambio(s) pendiente(s) por guardar con tu intención final.`);
      } else {
        toast(`✓ Asistencia mensual guardada exitosamente (${totalSaved} cambios).`);
      }
      renderAttendanceMonthlyView();
    }
  } catch (err) {
    console.error('Error al guardar asistencia mensual:', err);
    // Asegurar desbloqueo de IN_FLIGHT para el chunk activo en caso de excepción
    if (currentActiveChunk) {
      currentActiveChunk.forEach(m => {
        if (m.lifecycle === 'IN_FLIGHT') {
          m.lifecycle = 'UNCERTAIN';
          updateSingleMonthlyCellUi(m.studentId, m.date);
        }
      });
    }
    toast(`Error al guardar: ${err.message || err}`, true);
  } finally {
    attendanceMonthlySaving = false;
    updateMonthlySaveButtonUi();

    // Si algún lote previo confirmó cambios antes de una excepción posterior,
    // garantizar la invalidación de resúmenes y sincronización con Pase diario
    if (totalSaved > 0 && !syncEmitted) {
      syncEmitted = true;
      state.attendanceSummary = null;
      ++attendanceDataGen;
      attendanceMonthlySyncedDataGen = attendanceDataGen;
      window.dispatchEvent(new CustomEvent('attendance-updated'));
    }

    // Aplicar intenciones diferidas si quedaron pendientes y aún no han sido aplicadas
    applyDeferredIntents();
  }
}

function renderAttendanceMonthlyView(){
  const container = ensureAttendanceMonthlyContainer();
  if (!container) return;

  const monthOptions = getAttendanceMonthOptions();
  const currentMonth = attendanceMonthlyMonth || ($('#attendanceDate')?.value || state.attendance?.today || new Date().toISOString().slice(0, 10)).slice(0, 7);
  const pendingCount = attendanceMonthlyMutations.size;

  let html = `
    <div class="attendance-monthly-top-bar">
      <div class="attendance-mode-selector">
        <button type="button" class="attendance-mode-pill" data-action="switch-to-daily-attendance">Pase diario</button>
        <button type="button" class="attendance-mode-pill active" data-action="switch-to-monthly-attendance" aria-current="page">Captura mensual</button>
      </div>
      <div class="attendance-monthly-select-group">
        <label for="attendanceMonthSelect" class="attendance-month-label">Mes:</label>
        <select id="attendanceMonthSelect" class="attendance-month-select" aria-label="Seleccionar mes de asistencia">
          ${monthOptions.map(opt => `<option value="${opt.value}" ${opt.value === currentMonth ? 'selected' : ''}>${escapeHtml(opt.label)}</option>`).join('')}
        </select>
      </div>
      <div class="attendance-monthly-legend-bar">
        <span class="attendance-legend-item"><span class="monthly-badge status-a">A</span> Asistencia</span>
        <span class="attendance-legend-item"><span class="monthly-badge status-f">F</span> Falta</span>
        <span class="attendance-legend-item"><span class="monthly-badge status-r">R</span> Retardo</span>
        <span class="attendance-legend-item"><span class="monthly-badge status-j">J</span> Justificada</span>
      </div>
      <div class="attendance-monthly-actions">
        <button type="button" id="btnMonthlyNoClass" class="btn attendance-monthly-no-class-btn" data-action="open-monthly-no-class-dialog" title="Registrar día sin clases en el mes">
          📅🚫 No hay clases
        </button>
        <button type="button" id="btnSaveMonthlyAttendance" class="btn primary attendance-monthly-save-btn" data-action="save-monthly-attendance" ${pendingCount === 0 || attendanceMonthlySaving ? 'disabled' : ''}>
          ${attendanceMonthlySaving ? 'Guardando...' : (pendingCount > 0 ? `💾 Guardar (${pendingCount})` : '💾 Guardar')}
        </button>
        <button type="button" id="btnExpandMonthlyAttendance" class="btn attendance-monthly-expand-btn ${document.body?.classList?.contains('attendance-expanded-mode') ? 'is-expanded' : ''}" data-action="toggle-expand-monthly-attendance" title="${document.body?.classList?.contains('attendance-expanded-mode') ? 'Salir del modo ampliado (Esc)' : 'Modo ampliado de pantalla completa'}" aria-label="Modo ampliado">
          ${document.body?.classList?.contains('attendance-expanded-mode') ? '🗗 Restaurar' : '⛶ Ampliar'}
        </button>
        <span id="attendanceExpandHint" class="attendance-expand-hint" style="${document.body?.classList?.contains('attendance-expanded-mode') ? '' : 'display:none;'}">(Esc para restaurar)</span>
      </div>
    </div>
  `;

  if (attendanceMonthlyStatus === 'loading') {
    html += `
      <div class="attendance-list-notice" style="padding:48px 20px;text-align:center;">
        <div class="attendance-loading" style="font-size:15px;color:#0f766e;font-weight:700;display:inline-flex;align-items:center;gap:8px;">
          <svg class="spin" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-linecap="round"/></svg>
          Cargando cuadrícula de ${escapeHtml(monthOptions.find(o => o.value === currentMonth)?.label || currentMonth)}...
        </div>
      </div>
    `;
  } else if (attendanceMonthlyStatus === 'error') {
    let title = 'Error al cargar la cuadrícula mensual';
    let primaryBtnLabel = 'Reintentar';
    let primaryAction = 'retry-monthly-attendance';

    if (attendanceMonthlyErrorType === 'session') {
      title = 'Sesión vencida';
      primaryBtnLabel = 'Iniciar sesión';
      primaryAction = 'logout';
    } else if (attendanceMonthlyErrorType === 'network') {
      title = 'Fallo de conexión';
      primaryBtnLabel = 'Reintentar conexión';
    } else if (attendanceMonthlyErrorType === 'action_unavailable') {
      title = 'Acción no disponible en el servidor';
    } else if (attendanceMonthlyErrorType === 'invalid_data') {
      title = 'Respuesta de datos inválida';
    }

    html += `
      <div class="attendance-list-notice" style="padding:32px 20px;text-align:center;max-width:680px;margin:32px auto;background:#fff1f2;border:1px solid #fecdd3;border-radius:12px;">
        <div style="font-size:16px;font-weight:800;color:#991b1b;margin-bottom:8px;">${escapeHtml(title)}</div>
        <p style="font-size:13px;color:#7f1d1d;line-height:1.5;margin-bottom:16px;">${escapeHtml(attendanceMonthlyError)}</p>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
          <button type="button" class="btn primary small" data-action="${primaryAction}">${escapeHtml(primaryBtnLabel)}</button>
          <button type="button" class="btn small" data-action="switch-to-daily-attendance">Volver a Pase diario</button>
        </div>
      </div>
    `;
  } else if (attendanceMonthlyStatus === 'ready' && attendanceMonthlyData) {
    const data = attendanceMonthlyData;
    const days = data.days || [];
    const activeStudents = data.activeStudents || [];
    const inactiveStudents = data.inactiveStudentsWithRecords || [];
    const records = data.records || {};

    // Conteo dinámico y estricto de registros confirmados en memoria
    const totalFound = countMonthlyConfirmedRecords(records, currentMonth);
    if (data.diagnostics) {
      data.diagnostics.monthRecordsFound = totalFound;
    }

    let scenarioBanner = '';
    if (data.isIsolatedTestScenario || data.diagnostics?.testScenario) {
      scenarioBanner = `
        <div style="padding:10px 16px;background:#f0fdf4;border-bottom:1px solid #bbf7d0;color:#166534;font-size:12px;font-weight:700;display:flex;align-items:center;gap:8px;">
          <span>🔬</span> Escenario de prueba aislado: 35 alumnos activos · 1 baja con historial · Nombres largos
        </div>
      `;
    }

    let noticeBanner = '';
    if (totalFound === 0) {
      noticeBanner = `
        <div style="padding:10px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;">
          <span>ℹ️</span> No se encontraron registros de asistencia guardados en ${escapeHtml(monthOptions.find(o => o.value === currentMonth)?.label || currentMonth)}.
        </div>
      `;
    }

    html += scenarioBanner;
    html += noticeBanner;
    html += `
      <div class="attendance-monthly-table-wrap">
        <div class="attendance-monthly-grid-container">
          <table class="attendance-monthly-table">
          <thead>
            <tr>
              <th class="th-student-sticky">
                <div class="th-student-inner">
                  <span class="th-num">#</span>
                  <span class="th-name">Alumno</span>
                </div>
              </th>
              ${days.map(d => {
                const isWeekend = Boolean(d.isWeekend);
                const isNoClass = Boolean(d.noClass);
                const isOutside = Boolean(d.isOutsideCycle);
                const tooltip = d.noClassReason ? `${d.date}: ${d.noClassReason}` : (isWeekend ? `${d.date}: Fin de semana` : d.date);
                return `
                  <th class="th-day ${isWeekend ? 'is-weekend' : ''} ${isNoClass ? 'is-no-class' : ''} ${isOutside ? 'is-outside-cycle' : ''}" title="${escapeHtml(tooltip)}" data-date="${d.date}">
                    <span class="day-dow">${escapeHtml(d.dayOfWeek)}</span>
                    <span class="day-num">${String(d.dayNumber).padStart(2, '0')}</span>
                    ${isNoClass && !isWeekend ? `<span class="no-class-vert-banner" style="display:none;" aria-hidden="true">${escapeHtml(d.noClassReason)}</span>` : ''}
                  </th>
                `;
              }).join('')}
            </tr>
          </thead>
          <tbody>
    `;

    activeStudents.forEach((student, idx) => {
      const studentRecs = records[student.id] || records[String(student.id)] || {};
      html += `
        <tr class="tr-student" data-student-id="${escapeHtml(student.id)}">
          <td class="td-student-sticky">
            <div class="td-student-inner">
              <span class="col-num">${idx + 1}</span>
              <span class="col-name" title="${escapeHtml(student.name)}">${escapeHtml(student.name)}</span>
            </div>
          </td>
          ${days.map(d => {
            const rec = studentRecs[d.date];
            const isWeekend = Boolean(d.isWeekend);
            const isNoClass = Boolean(d.noClass);
            const key = `${student.id}|${d.date}`;
            const mutation = attendanceMonthlyMutations.get(key);
            const isDirty = Boolean(mutation && mutation.action !== 'DELETE');
            const isDel = Boolean(mutation && mutation.action === 'DELETE');
            const isInFlight = Boolean(mutation && mutation.lifecycle === 'IN_FLIGHT');
            const isConflict = Boolean(mutation && mutation.lifecycle === 'CONFLICT');
            const isUncertain = Boolean(mutation && mutation.lifecycle === 'UNCERTAIN');
            const isFocused = Boolean(attendanceMonthlyFocusedCell && attendanceMonthlyFocusedCell.studentId === String(student.id) && attendanceMonthlyFocusedCell.date === d.date);
            const hasConflict = isNoClass && rec && rec.status;

            return `
              <td class="td-cell is-editable ${isWeekend ? 'is-weekend' : ''} ${isNoClass ? 'is-no-class' : ''} ${isDirty ? 'is-dirty' : ''} ${isDel ? 'is-deleted' : ''} ${isInFlight ? 'is-in-flight' : ''} ${isConflict ? 'is-conflict' : ''} ${isUncertain ? 'is-uncertain' : ''} ${isFocused ? 'is-focused' : ''} ${hasConflict ? 'has-conflict-records' : ''}" tabindex="0" data-student-id="${escapeHtml(student.id)}" data-date="${d.date}">
                ${renderMonthlyCellBadge(rec, d, student.name, student.id)}
              </td>
            `;
          }).join('')}
        </tr>
      `;
    });

    if (inactiveStudents.length > 0) {
      html += `
        <tr class="tr-section-divider">
          <td colspan="${days.length + 1}">
            Alumnos dados de baja con registros en el mes (${inactiveStudents.length})
          </td>
        </tr>
      `;
      inactiveStudents.forEach(student => {
        const studentRecs = records[student.id] || records[String(student.id)] || {};
        html += `
          <tr class="tr-student is-inactive" data-student-id="${escapeHtml(student.id)}">
            <td class="td-student-sticky">
              <div class="td-student-inner">
                <span class="col-num badge-baja">BAJA</span>
                <span class="col-name" title="${escapeHtml(student.name)}">${escapeHtml(student.name)}</span>
              </div>
            </td>
            ${days.map(d => {
              const rec = studentRecs[d.date];
              const isWeekend = Boolean(d.isWeekend);
              const isNoClass = Boolean(d.noClass);
              return `
                <td class="td-cell is-readonly ${isWeekend ? 'is-weekend' : ''} ${isNoClass ? 'is-no-class' : ''}" data-student-id="${escapeHtml(student.id)}" data-date="${d.date}">
                  ${renderMonthlyCellBadge(rec, d, student.name, student.id)}
                </td>
              `;
            }).join('')}
          </tr>
        `;
      });
    }

    html += `
          </tbody>
        </table>
        <div class="attendance-monthly-ribbons-layer"></div>
      </div>
    </div>
      <div class="attendance-monthly-footer">
        <div>
          <strong>Alumnos activos:</strong> ${activeStudents.length}
          ${inactiveStudents.length > 0 ? ` · <strong>Bajas con historial:</strong> ${inactiveStudents.length}` : ''}
          · <strong>Registros en mes:</strong> ${totalFound}
        </div>
        <div>
          Captura mensual · Clic o flechas para navegar · Teclas A, F, R, J para registrar asistencia · Supr para borrar
        </div>
      </div>
    `;
  }

  container.innerHTML = html;

  const select = $('#attendanceMonthSelect');
  if (select) {
    select.onchange = (e) => {
      loadAttendanceMonthly(e.target.value);
    };
  }

  // Delegación de clic sobre celdas de la tabla para selección y foco
  const table = container.querySelector('.attendance-monthly-table');
  if (table) {
    table.onclick = (e) => {
      const cell = e.target.closest('td.td-cell');
      if (cell) {
        const dt = cell.getAttribute('data-date');
        if (cell.classList.contains('is-no-class') && !e.target.closest('button')) {
          showSuspensionDetail(dt);
          return;
        }
        if (cell.classList.contains('is-editable')) {
          const sid = cell.getAttribute('data-student-id');
          focusMonthlyCell(sid, dt, false);
        }
      }
    };
  }

  // Sincronizar capas continuas de días sin clases
  syncNoClassColumnOverlays();

  // Restaurar resaltado dinámico si existe celda enfocada
  if (attendanceMonthlyFocusedCell) {
    updateMonthlyHighlight(attendanceMonthlyFocusedCell.studentId, attendanceMonthlyFocusedCell.date, true);
  } else {
    clearMonthlyHighlight();
  }
}

// Gestión de atajos de teclado y navegación estilo Excel en captura mensual
document.addEventListener('keydown', (e) => {
  if (attendanceViewMode !== 'monthly') return;

  // 1. Respetar estrictamente atajos de sistema con teclas modificadoras (Ctrl, Alt, Meta)
  if (e.ctrlKey || e.altKey || e.metaKey) {
    return;
  }

  // 2. Si el foco está en un campo de texto editable fuera de la cuadrícula, no interceptar
  const activeEl = document.activeElement;
  const tag = (activeEl?.tagName || '').toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || activeEl?.isContentEditable) {
    return;
  }

  // 3. Si el foco está dentro de un modal interactivo abierto, no interceptar
  const openModal = document.querySelector('.modal:not(.hidden), .attendance-conflict-modal, #attendanceNoClassModal:not(.hidden-control)');
  if (openModal && openModal.contains(activeEl)) {
    return;
  }

  if (e.key === 'Escape') {
    const noClassModal = document.querySelector('#attendanceNoClassModal');
    if (noClassModal && !noClassModal.classList.contains('hidden-control')) {
      closeMonthlyNoClassModal();
      return;
    }
    const noteEl = $('#attendanceMonthlyNoteDetail');
    if (noteEl && !noteEl.classList.contains('hidden-control')) {
      closeMonthlyNoteDetail();
      return;
    }
    const modalEl = document.querySelector('.attendance-conflict-modal');
    if (modalEl) {
      modalEl.remove?.();
      return;
    }
    if (document.body.classList.contains('attendance-expanded-mode')) {
      toggleExpandMonthlyAttendance(false);
      return;
    }
    return;
  }

  if (!attendanceMonthlyFocusedCell) return;
  const sid = attendanceMonthlyFocusedCell.studentId;
  const dt = attendanceMonthlyFocusedCell.date;

  // Flechas y Tab / Shift+Tab para navegación
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
    navigateMonthlyTable(e);
    return;
  }

  // Teclas de estado: A, F, R, J
  const keyUpper = e.key.toUpperCase();
  if (['A', 'F', 'R', 'J'].includes(keyUpper)) {
    e.preventDefault();
    mutateMonthlyCell(sid, dt, keyUpper);
    return;
  }

  // Teclas de borrado: Delete o Backspace
  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    deleteMonthlyCell(sid, dt);
    return;
  }
});

// Protección ante navegación con cambios pendientes o guardado en curso (beforeunload)
window.addEventListener('beforeunload', (e) => {
  if (attendanceViewMode === 'monthly' && (attendanceMonthlyMutations.size > 0 || attendanceMonthlySaving)) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// Atajo global para salir de modo ampliado y cerrar modales con Escape (con precedencia contextual)
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const noClassModal = document.querySelector('#attendanceNoClassModal');
    if (noClassModal && !noClassModal.classList.contains('hidden-control')) {
      closeMonthlyNoClassModal();
      e.stopPropagation();
      return;
    }
    const noteEl = $('#attendanceMonthlyNoteDetail');
    if (noteEl && !noteEl.classList.contains('hidden-control')) {
      closeMonthlyNoteDetail();
      e.stopPropagation();
      return;
    }
    const modalEl = document.querySelector('.attendance-conflict-modal');
    if (modalEl) {
      modalEl.remove?.();
      e.stopPropagation();
      return;
    }
    if (document.body?.classList?.contains('attendance-expanded-mode')) {
      toggleExpandMonthlyAttendance(false);
      e.stopPropagation();
      return;
    }
  }
});

// Sincronización en redimensionamiento de ventana
window.addEventListener('resize', () => {
  if (attendanceViewMode === 'monthly') {
    syncNoClassColumnOverlays();
  }
});

// Intercepción de clicks de navegación hacia otras vistas si hay cambios pendientes o guardado en curso
document.addEventListener('click', (e) => {
  if (attendanceViewMode !== 'monthly') return;
  const navTrigger = e.target.closest('[data-view], [data-view-link], .nav-item, a');
  if (!navTrigger) return;

  const targetView = navTrigger.getAttribute('data-view') || navTrigger.getAttribute('data-view-link');
  if (targetView === 'attendance') return;

  if (attendanceMonthlySaving) {
    e.preventDefault();
    e.stopImmediatePropagation();
    if (typeof toast === 'function') toast('Guardando cambios en el servidor, por favor espera...', true);
    return;
  }

  if (attendanceMonthlyMutations.size > 0) {
    const confirmLeave = window.confirm(`Tienes ${attendanceMonthlyMutations.size} cambios sin guardar en Captura mensual. ¿Deseas descartarlos y salir a otra sección?`);
    if (!confirmLeave) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    attendanceMonthlyMutations.clear();
    attendanceMonthlyConfirmedMutations.clear();
  }
}, true); // Captura temprana para proteger navegación global

// Registro descentralizado de acciones del módulo (Regla de Modularidad)
window.actions = window.actions || {};
window.actions['save-attendance'] = (...args) => (window.saveAttendanceDay || saveAttendanceDay)?.(...args);
window.actions['all-present'] = (...args) => (window.markAllPresent || markAllPresent)?.(...args);
window.actions['clear-day'] = (...args) => (window.clearAttendanceDay || clearAttendanceDay)?.(...args);
window.actions['attendance-today'] = (...args) => (window.goToTodayAttendance || goToTodayAttendance)?.(...args);
window.actions['toggle-attendance-reports'] = (...args) => (window.toggleAttendanceReportsPanel || toggleAttendanceReportsPanel)?.(...args);
window.actions['no-class'] = (...args) => (window.saveNoClassDay || saveNoClassDay)?.(...args);
window.actions['switch-to-daily-attendance'] = () => switchAttendanceMode('daily');
window.actions['switch-to-monthly-attendance'] = () => switchAttendanceMode('monthly');
window.actions['toggle-expand-monthly-attendance'] = () => toggleExpandMonthlyAttendance();
window.actions['show-monthly-note'] = (el) => showMonthlyNoteDetail(el);
window.actions['close-monthly-note'] = () => closeMonthlyNoteDetail();
window.actions['save-monthly-attendance'] = () => saveMonthlyAttendanceBatch();
window.actions['open-monthly-no-class-dialog'] = () => openMonthlyNoClassDialog();
window.actions['close-no-class-dialog'] = () => closeMonthlyNoClassModal();
window.actions['submit-monthly-no-class'] = () => submitMonthlyNoClass();
window.actions['show-suspension-detail'] = (el) => showSuspensionDetail(el?.getAttribute?.('data-date') || el);
window.actions['edit-monthly-no-class'] = (el) => editMonthlyNoClass(el?.getAttribute?.('data-date') || el);
window.actions['remove-monthly-no-class'] = (el) => removeMonthlyNoClass(el?.getAttribute?.('data-date') || el);
window.actions['monthly-touch-val'] = (btn) => {
  if (!attendanceMonthlyFocusedCell) return;
  const val = btn?.getAttribute('data-val');
  if (val) mutateMonthlyCell(attendanceMonthlyFocusedCell.studentId, attendanceMonthlyFocusedCell.date, val);
};
window.actions['monthly-touch-delete'] = () => {
  if (!attendanceMonthlyFocusedCell) return;
  deleteMonthlyCell(attendanceMonthlyFocusedCell.studentId, attendanceMonthlyFocusedCell.date);
};
window.actions['retry-monthly-attendance'] = () => {
  const select = $('#attendanceMonthSelect');
  return loadAttendanceMonthly(select?.value);
};
window.actions['show-monthly-conflict'] = (el) => showMonthlyConflictDetail(el);
window.actions['accept-conflict-server'] = (elOrSid, maybeDt) => {
  let sid, dt;
  if (elOrSid && typeof elOrSid === 'object' && elOrSid.dataset) {
    sid = elOrSid.dataset.studentId;
    dt = elOrSid.dataset.date;
  } else {
    sid = elOrSid;
    dt = maybeDt;
  }
  return resolveMonthlyConflict(sid, dt, 'accept_server');
};
window.actions['reapply-conflict-mutation'] = (elOrSid, maybeDt) => {
  let sid, dt;
  if (elOrSid && typeof elOrSid === 'object' && elOrSid.dataset) {
    sid = elOrSid.dataset.studentId;
    dt = elOrSid.dataset.date;
  } else {
    sid = elOrSid;
    dt = maybeDt;
  }
  return resolveMonthlyConflict(sid, dt, 'reapply_user');
};
window.actions['retry-attendance'] = () => {
  if (!state.attendance) {
    return openAttendance(true, { skipShowView: true });
  } else {
    return loadAttendanceDay();
  }
};

// Exportación segura para entorno de verificación y pruebas unitarias
if (typeof window !== 'undefined') {
  window.resolveMonthlyConflict = resolveMonthlyConflict;
  window.showMonthlyConflictDetail = showMonthlyConflictDetail;
  window.validateMonthlyBatchResponse = validateMonthlyBatchResponse;
  window.toggleExpandMonthlyAttendance = toggleExpandMonthlyAttendance;
  window.openMonthlyNoClassDialog = openMonthlyNoClassDialog;
  window.closeMonthlyNoClassModal = closeMonthlyNoClassModal;
  window.showSuspensionDetail = showSuspensionDetail;
  window.editMonthlyNoClass = editMonthlyNoClass;
  window.removeMonthlyNoClass = removeMonthlyNoClass;
  window.syncNoClassColumnOverlays = syncNoClassColumnOverlays;
  window.syncDailyTopBarActions = syncDailyTopBarActions;
  window.formatAttendanceGradeGroup = formatAttendanceGradeGroup;
  window.isAttendanceCaptureAllowed = isAttendanceCaptureAllowed;
  window.focusMonthlyCell = focusMonthlyCell;
  window.updateMonthlyHighlight = updateMonthlyHighlight;
  window.clearMonthlyHighlight = clearMonthlyHighlight;
}
