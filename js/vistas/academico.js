/* ==========================================================================
   MÓDULO DE VISTA: TRABAJO ACADÉMICO, REPORTES DIARIOS Y ESTILOS DE APRENDIZAJE
   ========================================================================== */
function renderAcademicOptions(){
  const select=$('#academicStudent'),previous=select.value;select.innerHTML='<option value="">Selecciona un alumno</option>'+state.students.map(s=>`<option value="${s.id}">${escapeHtml(fullName(s))}</option>`).join('');if([...select.options].some(o=>o.value===previous))select.value=previous;
  if(!$('#academicReportDate').value)$('#academicReportDate').value=todayCancun();
  if(!$('#academicReportMonth').value)$('#academicReportMonth').value=todayCancun().slice(0,7);
  toggleAcademicReportMode();
}
function openAcademicReports(type){$('#academicReportType').value=type;toggleAcademicReportMode();showView('reports');window.scrollTo(0,0);toast(type==='weekly'?'Selecciona un alumno para consultar su semana.':'Selecciona un alumno para consultar su mes.')}
function toggleAcademicReportMode(){const weekly=$('#academicReportType').value==='weekly';$('#academicWeekControl').classList.toggle('hidden-control',!weekly);$('#academicMonthControl').classList.toggle('hidden-control',weekly)}
async function loadAcademicReport(){
  const studentId=$('#academicStudent').value,type=$('#academicReportType').value,reference=type==='weekly'?$('#academicReportDate').value:$('#academicReportMonth').value;
  if(!studentId)return toast('Selecciona un alumno.',true);if(!reference)return toast('Selecciona el periodo.',true);
  await runAction(async()=>renderAcademicReport(await server('getStudentAcademicReport',studentId,type,reference)));
}
function renderAcademicReport(r){
  const a=r.attendance,s=r.summary;
  const subjectCards=r.subjects.map(x=>`<article class="subject-report ${x.activities?'has-data':''}"><h3>${escapeHtml(x.name)}</h3><strong>${x.activities}</strong><span>actividades</span><p><b>${x.complete}</b> completas · <b>${x.partial}</b> incompletas · <b>${x.none}</b> sin realizar</p></article>`).join('');
  const activities=r.activities.length?r.activities.map(x=>`<article class="academic-activity"><div><span>${escapeHtml(formatDateShort(x.date))} · ${escapeHtml(x.subject)}</span><h3>${escapeHtml(x.activity)}</h3><p>${escapeHtml(x.material)}</p></div><div class="academic-tags"><span class="badge">${escapeHtml(x.work)}</span><span>Conducta: <b>${escapeHtml(x.conduct)}</b></span><span>Participación: <b>${escapeHtml(x.participation)}</b></span></div>${x.rubric||x.observation?`<p class="academic-note">${escapeHtml([x.rubric,x.observation].filter(Boolean).join(' · '))}</p>`:''}</article>`).join(''):'<p class="muted">No hay actividades registradas en este periodo.</p>';
  $('#academicReport').className='panel academic-report';
  $('#academicReport').innerHTML=`<div class="academic-report-head"><div><p class="eyebrow">REPORTE ${r.type==='weekly'?'SEMANAL':'MENSUAL'}</p><h2>${escapeHtml(r.student.name)}</h2><p>${escapeHtml(r.period)}</p></div><div class="attendance-circle"><b>${a.percentage}%</b><span>asistencia</span></div></div><div class="academic-kpis"><div><b>${s.activities}</b><span>Actividades</span></div><div><b>${s.complete}</b><span>Completas</span></div><div><b>${s.partial}</b><span>Incompletas</span></div><div><b>${s.none}</b><span>No realizadas</span></div><div><b>${s.conductAttention}</b><span>Conducta por atender</span></div><div><b>${s.noParticipation}</b><span>Participación nula</span></div></div><h3>Resultados de todas las materias</h3><div class="subject-report-grid">${subjectCards}</div><div class="attendance-summary"><h3>Asistencia del periodo</h3><span>A: <b>${a.counts.A}</b></span><span>F: <b>${a.counts.F}</b></span><span>R: <b>${a.counts.R}</b></span><span>J: <b>${a.counts.J}</b></span></div><h3>Detalle de actividades</h3><div class="academic-activities">${activities}</div>`;
}
async function loadDailyReport(){showView('reports');const date=$('#dailyReportDate').value;if(!date)return toast('Selecciona la fecha del reporte.',true);await runAction(async()=>{const report=await server('getDailyAcademicReport',date);renderDailyReport(report)})}
function renderDailyReport(r){
  const empty=$('#dailyReportEmpty'),content=$('#dailyReportContent');
  if(!r.activityCount){empty.classList.remove('hidden-control');empty.innerHTML=`<strong>Sin actividades registradas</strong><p class="muted">No se encontraron actividades entre ${escapeHtml(r.schedule)}. Registra las clases del día para generar resultados.</p>`;content.classList.add('hidden-control');return}
  empty.classList.add('hidden-control');content.classList.remove('hidden-control');
  const attendanceCount=(r.attendance.A?.length||0)+(r.attendance.R?.length||0);
  $('#dailyReportSummary').innerHTML=[['Actividades',r.activityCount],['Materias',r.subjects.length],['Entregaron todo',r.groups.complete.length],['Asistencia A + R',attendanceCount]].map(([label,value])=>`<div class="stat"><b>${value}</b><span>${escapeHtml(label)}</span></div>`).join('');
  renderDailyPeople('dailyComplete','dailyCompleteCount',r.groups.complete,'complete');
  renderDailyPeople('dailyPartial','dailyPartialCount',r.groups.partial,'partial');
  renderDailyPeople('dailyNone','dailyNoneCount',r.groups.none,'none');
  $('#dailyConductCount').textContent=r.conductAlerts.length;
  $('#dailyConduct').innerHTML=r.conductAlerts.length?r.conductAlerts.map(item=>`<div class="report-person"><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.conduct)}</small>${item.observations.length?`<p class="conduct-note">${item.observations.map(escapeHtml).join(' · ')}</p>`:''}</div></div>`).join(''):'<p class="muted">No se registraron conductas que requieran atención.</p>';
  $('#dailyActivities').innerHTML=`<p class="muted">${escapeHtml(r.displayDate)} · ${escapeHtml(r.schedule)}</p>`+r.activities.map(item=>`<div class="activity-row"><strong>${escapeHtml(item.subject||'Sin materia')}</strong><span>${escapeHtml(item.name||'Actividad sin nombre')}</span><span class="muted">${escapeHtml([item.start,item.end].filter(Boolean).join('–'))}</span></div>`).join('');
}
function renderDailyPeople(containerId,countId,items,type){$('#'+countId).textContent=items.length;$('#'+containerId).innerHTML=items.length?items.map(item=>`<div class="report-person"><div><strong>${escapeHtml(item.name)}</strong><small>${type==='complete'?'Entregó todas las actividades':type==='partial'?`Entregó ${item.delivered} de ${item.total}`:'No entregó actividades'} · Conducta: ${escapeHtml(item.conduct)}</small></div><span class="badge">${escapeHtml(item.attendance)}</span></div>`).join(''):'<p class="muted">No hay alumnos en este apartado.</p>'}
