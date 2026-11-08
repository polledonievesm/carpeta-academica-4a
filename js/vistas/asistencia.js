/* ==========================================================================
   MÓDULO DE VISTA: ASISTENCIA DIARIA, MENSUAL Y REPORTES DE ASISTENCIA
   ========================================================================== */
function openAttendance(force=false){showView('attendance');if(state.attendance&&!force){renderAttendance();if(Date.now()-state.attendanceLoadedAt>300000){server('getInitialData').then(data=>{state.attendance=data;state.attendanceLoadedAt=Date.now();renderAttendance()}).catch(err=>console.warn('Revalidación de asistencia:',err))}return}runAction(async()=>{state.attendance=await server('getInitialData');state.attendanceLoadedAt=Date.now();renderAttendance()})}
function renderAttendance(){
  if(!state.attendance)return;
  $('#attendanceDate').value=state.attendance.today;
  state.attendanceDay=state.attendance.day;
  prepareAttendanceRecords();
  $('#attendanceStudent').innerHTML='<option value="">Selecciona un alumno</option>'+state.attendance.allStudents.map(s=>`<option value="${s.id}">${escapeHtml(s.name)}${s.active?'':' (BAJA)'}</option>`).join('');
  $('#attendanceReportDate').value=state.attendance.today;
  $('#attendancePeriod').innerHTML=state.attendance.periods.filter(p=>/^\d{4}-\d{2}$/.test(p.key)).map(p=>`<option value="${p.key}">${escapeHtml(p.label)}</option>`).join('');
  const currentMonth=state.attendance.today.slice(0,7);if([...$('#attendancePeriod').options].some(o=>o.value===currentMonth))$('#attendancePeriod').value=currentMonth;
  toggleAttendanceReportMode();
  renderAttendanceSavedSummary();
  renderAttendanceList();
}
function prepareAttendanceRecords(){
  state.attendanceRecords = {};
  const students = sortStudentsAlphabetically(state.attendance?.students || []);
  students.forEach(s => {
    const saved = state.attendanceDay?.existing?.[s.id] || state.attendanceDay?.existing?.[String(s.id)];
    state.attendanceRecords[s.id] = saved ? { status: String(saved.status || '').toUpperCase(), note: saved.note || '' } : { status: '', note: '' };
  });
}
async function loadAttendanceDay(){const date=$('#attendanceDate').value;if(!date)return;state.attendanceSummary=null;renderAttendanceSavedSummary();await runAction(async()=>{state.attendanceDay=await server('getDayData',date);prepareAttendanceRecords();renderAttendanceList()})}
function renderAttendanceList(){
  const day = state.attendanceDay || {};
  $('#attendanceDisplayDate').textContent = day.displayDate || 'Selecciona una fecha';
  $('#attendanceNotice').textContent = day.noClass ? `Día sin clases: ${day.noClassReason}${day.noClassDetail ? ' · ' + day.noClassDetail : ''}` : '';
  const students = sortStudentsAlphabetically(state.attendance?.students || []);
  $('#attendanceList').innerHTML = students.map((s, i) => {
    const r = state.attendanceRecords[s.id] || {};
    return `<div class="attendance-row" data-student="${s.id}">
      <span class="attendance-number">${i+1}</span>
      <strong>${escapeHtml(s.name)}</strong>
      <div class="attendance-status">${['A','F','R','J'].map(x => `<button type="button" class="status-button ${r.status===x ? 'selected' : ''}" data-status="${x}">${x}</button>`).join('')}</div>
      <input class="attendance-note" value="${escapeHtml(r.note||'')}" placeholder="Observación opcional">
    </div>`;
  }).join('') || '<p class="muted">No hay alumnos activos.</p>';
}
function selectAttendanceStatus(e){const b=e.target.closest('[data-status]');if(!b)return;const row=b.closest('[data-student]');state.attendanceRecords[row.dataset.student].status=b.dataset.status;renderAttendanceList()}
function updateAttendanceNote(e){if(!e.target.classList.contains('attendance-note'))return;state.attendanceRecords[e.target.closest('[data-student]').dataset.student].note=e.target.value}
function renderAttendanceSavedSummary(){const box=$('#attendanceSavedSummary'),r=state.attendanceSummary;if(!r){box.classList.add('hidden-control');box.innerHTML='';return}box.classList.remove('hidden-control');box.innerHTML=`<strong>Asistencia guardada</strong><span><b>${r.attended}</b> asistieron (A + R)</span><span><b>${r.absent}</b> faltaron (F + J)</span><small>A: ${r.counts.A} · R: ${r.counts.R} · F: ${r.counts.F} · J: ${r.counts.J}</small>`}
async function saveAttendanceDay(){
  const rawStudents = state.attendance?.students || [];
  const students = sortStudentsAlphabetically(rawStudents);
  const pending = students.filter(s => !state.attendanceRecords[s.id]?.status);
  if(pending.length) return toast(`Falta registrar la asistencia de ${pending.length} alumno(s).`, true);
  if(!confirm('¿Guardar la asistencia de esta fecha?')) return;
  await runAction(async()=>{
    const payload = {
      date: $('#attendanceDate').value || todayCancun(),
      records: students.map(s => {
        const rec = state.attendanceRecords[s.id] || {};
        let st = String(rec.status || 'A').trim().toUpperCase();
        if(!['A', 'F', 'R', 'J'].includes(st)) st = 'A';
        return {
          studentId: s.id,
          status: st,
          note: String(rec.note || '').trim()
        };
      })
    };
    const r = await server('saveAttendance', payload);
    state.attendanceSummary = r;
    state.attendanceDay = await server('getDayData', payload.date);
    prepareAttendanceRecords();
    renderAttendanceList();
    renderAttendanceSavedSummary();
    window.dispatchEvent(new CustomEvent('attendance-updated'));
    toast(r.message || '✓ Asistencia guardada correctamente');
  });
}
async function saveNoClassDay(){const reason=prompt('Motivo del día sin clases:','Consejo Técnico Escolar');if(!reason)return;const detail=prompt('Detalle opcional:','')||'';await runAction(async()=>{const r=await server('saveNoClass',{date:$('#attendanceDate').value,reason,detail});state.attendanceDay=await server('getDayData',$('#attendanceDate').value);prepareAttendanceRecords();renderAttendanceList();window.dispatchEvent(new CustomEvent('attendance-updated'));toast(r.message)})}
function toggleAttendanceReportMode(){const weekly=$('#attendanceReportType').value==='weekly';$('#attendanceWeekControl').classList.toggle('hidden-control',!weekly);$('#attendanceMonthControl').classList.toggle('hidden-control',weekly)}
async function loadAttendanceReport(){const studentId=$('#attendanceStudent').value;if(!studentId){showView('attendance');return toast('Selecciona un alumno para consultar el reporte.',true)}const weekly=$('#attendanceReportType').value==='weekly';await runAction(async()=>{const report=weekly?await server('getWeeklyAttendanceReport',studentId,$('#attendanceReportDate').value):await server('getIndividualReport',studentId,$('#attendancePeriod').value);weekly?renderWeeklyAttendanceReport(report):renderMonthlyAttendanceReport(report);showView('attendance')})}
function attendanceKpis(r){return `<div class="attendance-kpis"><div class="attendance-kpi"><b>${r.percentage}%</b><span>Asistencia</span></div><div class="attendance-kpi"><b>${r.attended}</b><span>A + R</span></div><div class="attendance-kpi"><b>${r.absent}</b><span>F + J</span></div><div class="attendance-kpi"><b>${r.counts.R}</b><span>Retardos</span></div></div>`}
function renderWeeklyAttendanceReport(r){$('#attendanceReport').innerHTML=`<h3>${escapeHtml(r.student.name)}</h3><p class="muted">Semana del ${escapeHtml(r.period)}</p>${attendanceKpis(r)}<div class="weekly-days">${r.days.map(d=>`<div class="weekly-day"><strong>${escapeHtml(d.label)}</strong><span>${escapeHtml(d.displayDate)}</span><span class="day-status status-${(d.status||'none').toLowerCase()}">${escapeHtml(d.statusLabel)}</span>${d.note?`<span class="day-note">${escapeHtml(d.note)}</span>`:''}</div>`).join('')}</div>`}
function renderMonthlyAttendanceReport(r){$('#attendanceReport').innerHTML=`<h3>${escapeHtml(r.student.name)}</h3><p class="muted">${escapeHtml(r.period)} · ${r.totalDays} días registrados</p>${attendanceKpis(r)}<ul class="attendance-details">${r.details.length?r.details.map(d=>`<li>${escapeHtml(d.displayDate)} · ${escapeHtml(d.statusLabel)}${d.note?' · '+escapeHtml(d.note):''}</li>`).join(''):'<li>Sin incidencias en el mes.</li>'}</ul>`}
