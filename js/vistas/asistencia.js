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

function syncAttendanceControlsState(){
  const ready = isAttendanceReady();
  const locked = !ready;

  $$('[data-action="save-attendance"]').forEach(b => { b.disabled = locked; });
  $$('[data-action="all-present"]').forEach(b => { b.disabled = locked; });
  $$('[data-action="clear-day"]').forEach(b => { b.disabled = locked; });
  $$('[data-action="attendance-today"]').forEach(b => { b.disabled = locked; });
  $$('[data-action="no-class"]').forEach(b => { b.disabled = locked; });

  const dateInput = $('#attendanceDate');
  if (dateInput) {
    dateInput.disabled = Boolean(attendanceFetchPromise) || attendanceSaving || (attendanceLoadStatus === 'loading' && !state.attendance);
  }

  $$('#attendanceList .status-button').forEach(btn => {
    btn.disabled = locked;
  });
  $$('#attendanceList .attendance-note').forEach(input => {
    input.disabled = locked;
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

function openAttendance(force = false, options = {}){
  if (!options.skipShowView && document.getElementById('attendance')?.classList.contains('active') !== true) {
    showView('attendance');
  }

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
    if ($('#attendanceNotice')) {
      $('#attendanceNotice').textContent = day.noClass ? `Día sin clases: ${day.noClassReason}${day.noClassDetail ? ' · ' + day.noClassDetail : ''}` : '';
    }
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
  if (!isAttendanceReady()) return;
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
  if (!isAttendanceReady()) return;
  if (!e.target.classList.contains('attendance-note')) return;
  const row = e.target.closest('[data-student]');
  if (!row) return;
  state.attendanceRecords[row.dataset.student].note = e.target.value;
}

function markAllPresent(){
  if (!isAttendanceReady()) return;
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

  const reason = prompt('Motivo del día sin clases:', 'Consejo Técnico Escolar');
  if (!reason) return;
  const detail = prompt('Detalle opcional:', '') || '';

  const currentSeq = attendanceDateSeq;
  ++attendanceDataGen;
  const payload = { date: targetDate, reason: String(reason).trim(), detail: String(detail).trim() };

  attendanceSaving = true;
  syncAttendanceControlsState();

  try {
    const r = await server('saveNoClass', payload);

    if ($('#attendanceDate')?.value !== targetDate || currentSeq !== attendanceDateSeq) {
      toast(r?.message || 'Día registrado sin clases');
      return;
    }

    let refreshedDay = null;
    let readFailed = false;
    try {
      refreshedDay = await server('getDayData', targetDate);
      if (!isValidDayData(refreshedDay, targetDate)) {
        readFailed = true;
      }
    } catch (readErr) {
      console.warn('Error en la lectura posterior al registrar día sin clases:', readErr);
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
      window.dispatchEvent(new CustomEvent('attendance-updated'));
      toast(r?.message || 'Día registrado sin clases');
    }
  } catch (err) {
    console.error('Error al registrar día sin clases:', err);
    toast((err && err.message) ? err.message : 'No fue posible registrar el día sin clases.', true);
  } finally {
    attendanceSaving = false;
    syncAttendanceControlsState();
  }
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

// Registro descentralizado de acciones del módulo (Regla de Modularidad)
window.actions = window.actions || {};
window.actions['save-attendance'] = (...args) => (window.saveAttendanceDay || saveAttendanceDay)?.(...args);
window.actions['all-present'] = (...args) => (window.markAllPresent || markAllPresent)?.(...args);
window.actions['clear-day'] = (...args) => (window.clearAttendanceDay || clearAttendanceDay)?.(...args);
window.actions['attendance-today'] = (...args) => (window.goToTodayAttendance || goToTodayAttendance)?.(...args);
window.actions['toggle-attendance-reports'] = (...args) => (window.toggleAttendanceReportsPanel || toggleAttendanceReportsPanel)?.(...args);
window.actions['no-class'] = (...args) => (window.saveNoClassDay || saveNoClassDay)?.(...args);
window.actions['retry-attendance'] = () => {
  if (!state.attendance) {
    return openAttendance(true, { skipShowView: true });
  } else {
    return loadAttendanceDay();
  }
};
