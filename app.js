const state={config:{},subjects:[],rubrics:[],students:[],projects:[],stats:{},attendance:null,attendanceDay:null,attendanceRecords:{}};
const $=(s,r=document)=>r.querySelector(s);const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const API_SOURCE='pase-lista-4a-api';
const API_URL=String(window.CARPETA_ACADEMICA_CONFIG?.apiUrl||'').trim();
const SESSION_KEY='carpeta_academica_session_v1';
const pendingRequests=new Map();
let sessionToken=localStorage.getItem(SESSION_KEY)||'';
document.addEventListener('DOMContentLoaded',()=>{bindUI();startApp()});
window.addEventListener('message',receiveApiMessage);

function validApiOrigin(origin){try{const host=new URL(origin).hostname;return host==='script.google.com'||host.endsWith('.googleusercontent.com')}catch(e){return false}}
function receiveApiMessage(event){
  if(!validApiOrigin(event.origin)||!event.data||event.data.source!==API_SOURCE)return;
  const pending=pendingRequests.get(String(event.data.requestId||''));if(!pending)return;
  pendingRequests.delete(String(event.data.requestId));clearTimeout(pending.timer);pending.iframe.remove();
  event.data.ok?pending.resolve(event.data.data):pending.reject(new Error(event.data.error||'No fue posible completar la solicitud.'));
}
function apiRequest(action,args=[],token=sessionToken){
  return new Promise((resolve,reject)=>{
    if(!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(API_URL))return reject(new Error('Falta colocar la URL /exec de Apps Script en config.js.'));
    const requestId='REQ-'+Date.now()+'-'+Math.random().toString(36).slice(2);
    const iframe=document.createElement('iframe');iframe.name='bridge_'+requestId;iframe.hidden=true;document.body.appendChild(iframe);
    const form=document.createElement('form');form.method='POST';form.action=API_URL;form.target=iframe.name;form.hidden=true;
    const fields={requestId,action,args:JSON.stringify(args),sessionToken:token||''};
    Object.entries(fields).forEach(([name,value])=>{const input=document.createElement('input');input.type='hidden';input.name=name;input.value=value;form.appendChild(input)});
    document.body.appendChild(form);
    const timer=setTimeout(()=>{pendingRequests.delete(requestId);iframe.remove();reject(new Error('La conexión con Google tardó demasiado. Intenta nuevamente.'))},45000);
    pendingRequests.set(requestId,{resolve,reject,iframe,timer});form.submit();form.remove();
  });
}
function server(name,...args){return apiRequest(name,args)}
async function startApp(){if(sessionToken)await loadApp();else{setLoading(false);showLogin()}}
function showLogin(message=''){$('#loginError').textContent=message;const dialog=$('#loginDialog');if(!dialog.open)dialog.showModal();setTimeout(()=>$('#loginForm').elements.username.focus(),50)}
async function login(e){e.preventDefault();const form=e.currentTarget;$('#loginError').textContent='';setLoading(true);try{const r=await apiRequest('login',[form.elements.username.value,form.elements.password.value],'');sessionToken=r.token;localStorage.setItem(SESSION_KEY,sessionToken);form.elements.password.value='';$('#loginDialog').close();await loadApp()}catch(error){showLogin(error.message)}finally{setLoading(false)}}
function logout(confirmFirst=true){if(confirmFirst&&!confirm('¿Cerrar la sesión de Carpeta Académica?'))return;sessionToken='';localStorage.removeItem(SESSION_KEY);location.reload()}
function isSessionError(message){return /sesión|sesion|inicia sesión|inicia sesion|venció|vencio/i.test(String(message||''))}
async function loadApp(){setLoading(true);try{Object.assign(state,await server('getBootstrapData'));renderAll()}catch(e){if(isSessionError(e.message)){sessionToken='';localStorage.removeItem(SESSION_KEY);showLogin(e.message)}else toast(e.message,true)}finally{setLoading(false)}}
function bindUI(){
  $$('.nav-item').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
  $$('[data-view-link]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.viewLink)));
  document.addEventListener('click',e=>{const a=e.target.closest('[data-action]');if(!a)return;actions[a.dataset.action]?.(a)});
  $$('[data-close]').forEach(b=>b.addEventListener('click',()=>$('#'+b.dataset.close).close()));
  $('#menuButton').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
  $('#studentSearch').addEventListener('input',renderStudents);
  $('#projectSearch').addEventListener('input',renderProjects);
  $('#projectStatus').addEventListener('change',renderProjects);
  $('#attendanceDate').addEventListener('change',loadAttendanceDay);
  $('#attendanceReportType').addEventListener('change',toggleAttendanceReportMode);
  $('#attendanceStudent').addEventListener('change',()=>{if($('#attendanceStudent').value)loadAttendanceReport()});
  $('#attendanceReportDate').addEventListener('change',()=>{if($('#attendanceStudent').value&&$('#attendanceReportType').value==='weekly')loadAttendanceReport()});
  $('#attendancePeriod').addEventListener('change',()=>{if($('#attendanceStudent').value&&$('#attendanceReportType').value==='monthly')loadAttendanceReport()});
  $('#attendanceList').addEventListener('click',selectAttendanceStatus);
  $('#attendanceList').addEventListener('input',updateAttendanceNote);
  $('#studentForm').addEventListener('submit',saveStudentForm);
  $('#projectForm').addEventListener('submit',saveProjectForm);
  $('#loginForm').addEventListener('submit',login);
}
const actions={
  'logout':()=>logout(),
  'new-student':()=>openStudent(),
  'new-project':()=>openProject(),
  'go-daily':()=>showView('daily'),
  'weekly-report':()=>{showView('reports');toast('El reporte semanal se habilitará en la siguiente fase.')},
  'individual-report':()=>{showView('reports');toast('El reporte individual se habilitará en la siguiente fase.')},
  'daily-report':loadDailyReport,
  'all-present':()=>{(state.attendance?.students||[]).forEach(s=>state.attendanceRecords[s.id]={status:'A',note:''});renderAttendanceList()},
  'save-attendance':saveAttendanceDay,
  'no-class':saveNoClassDay,
  'attendance-report':loadAttendanceReport,
  'edit-student':btn=>openStudent(state.students.find(x=>x.id===btn.dataset.id)),
  'delete-student':async btn=>{if(!confirm('¿Dar de baja a este alumno?'))return;await runAction(async()=>{await server('deleteStudent',btn.dataset.id);state.students=state.students.filter(x=>x.id!==btn.dataset.id);renderAll();toast('Alumno dado de baja.')})},
  'archive-project':async btn=>{if(!confirm('¿Archivar este proyecto?'))return;await runAction(async()=>{await server('archiveProject',btn.dataset.id);const p=state.projects.find(x=>x.id===btn.dataset.id);if(p)p.estado='Archivado';renderAll();toast('Proyecto archivado.')})}
};
function showView(id){$$('.view').forEach(v=>v.classList.toggle('active',v.id===id));$$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===id));$('#sidebar').classList.remove('open');window.scrollTo(0,0)}
function renderAll(){
  $('#schoolName').textContent=state.config.escuela||'Carpeta Académica';
  $('#groupName').textContent=[state.config.gradoGrupo,state.config.turno].filter(Boolean).join(' · ');
  $('#teacherName').textContent=state.config.docente||'Docente';
  renderGreeting();
  if(!$('#dailyReportDate').value)$('#dailyReportDate').value=state.attendance?.today||new Date().toISOString().slice(0,10);
  renderStats();renderSubjects();renderStudents();renderStyles();renderProjects();renderActiveProjects();renderAttendance();
}
function renderGreeting(){const hour=new Date().getHours();const greeting=hour<12?'Buenos días':hour<19?'Buenas tardes':'Buenas noches';const teacher=String(state.config.docente||'Prof. Michel').replace(/^Prof\.\s*/i,'').split(/\s+/)[0]||'Michel';$('#welcomeGreeting').textContent=`¡${greeting}, Prof. ${teacher}!`}
function renderStats(){const s=state.stats;$('#stats').innerHTML=[['Alumnos',s.students||0],['Proyectos activos',s.projects||0],['Clases registradas',s.activities||0],['Requieren seguimiento',s.followUp||0]].map(([l,v])=>`<div class="stat"><b>${v}</b><span>${escapeHtml(l)}</span></div>`).join('')}
function renderSubjects(){$('#subjectGrid').innerHTML=state.subjects.map((x,i)=>`<div class="subject"><b>${escapeHtml(x.nombre)}</b><p class="muted">${i<5?'Campo formativo':'Complementaria'}</p></div>`).join('')}
function renderStudents(){const q=$('#studentSearch').value.toLowerCase();const rows=state.students.filter(s=>fullName(s).toLowerCase().includes(q));$('#studentCount').textContent=`${rows.length} alumnos`;$('#studentsTable').innerHTML=rows.length?rows.map(s=>`<tr><td><span class="student-name">${escapeHtml(fullName(s))}</span><br><span class="muted">${escapeHtml(s.tutorUsuario||'Sin acceso')}</span></td><td>${s.edad||'—'}</td><td>${escapeHtml(s.tutorNombre||'Sin registrar')}</td><td><span class="badge">${escapeHtml(s.estilo||'Sin evaluar')}</span></td><td><button class="link-button" data-action="edit-student" data-id="${s.id}">Editar</button> <button class="link-button" data-action="delete-student" data-id="${s.id}">Baja</button></td></tr>`).join(''):'<tr><td colspan="5" class="muted">No hay alumnos registrados.</td></tr>'}
function renderStyles(){$('#stylesGrid').innerHTML=state.students.length?state.students.map(s=>`<div class="student-card"><h3>${escapeHtml(fullName(s))}</h3><span class="badge">${escapeHtml(s.estilo||'Sin evaluar')}</span><p class="muted">El resultado se actualizará desde el test VAK.</p></div>`).join(''):'<div class="panel">Primero añade alumnos al grupo.</div>'}
function renderProjects(){const q=$('#projectSearch').value.toLowerCase();const status=$('#projectStatus').value;const rows=state.projects.filter(p=>(!q||p.nombre.toLowerCase().includes(q))&&(!status||p.estado===status));$('#projectsGrid').innerHTML=rows.length?rows.map(projectCard).join(''):'<div class="panel">No hay proyectos registrados.</div>'}
function renderActiveProjects(){const rows=state.projects.filter(p=>p.estado==='Activo').slice(0,3);$('#activeProjects').innerHTML=rows.length?rows.map(projectCard).join(''):'<div class="muted">Añade tu primer proyecto para comenzar.</div>'}
function projectCard(p){return `<article class="project-card"><span class="badge">${escapeHtml(p.estado||'Activo')}</span><h3>${escapeHtml(p.nombre)}</h3><p>${escapeHtml(p.campoFormativo)} · ${escapeHtml(p.temporalidad||'Sin temporalidad')}</p><div class="project-actions"><button class="btn">Abrir</button>${p.estado==='Activo'?`<button class="btn" data-action="archive-project" data-id="${p.id}">Archivar</button>`:''}</div></article>`}
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
  renderAttendanceList();
}
function prepareAttendanceRecords(){state.attendanceRecords={};(state.attendance?.students||[]).forEach(s=>{const saved=state.attendanceDay?.existing?.[s.id];state.attendanceRecords[s.id]=saved?{status:saved.status,note:saved.note||''}:{status:'',note:''}})}
async function loadAttendanceDay(){const date=$('#attendanceDate').value;if(!date)return;await runAction(async()=>{state.attendanceDay=await server('getDayData',date);prepareAttendanceRecords();renderAttendanceList()})}
function renderAttendanceList(){
  const day=state.attendanceDay||{};$('#attendanceDisplayDate').textContent=day.displayDate||'Selecciona una fecha';$('#attendanceNotice').textContent=day.noClass?`Día sin clases: ${day.noClassReason}${day.noClassDetail?' · '+day.noClassDetail:''}`:'';
  $('#attendanceList').innerHTML=(state.attendance?.students||[]).map((s,i)=>{const r=state.attendanceRecords[s.id]||{};return `<div class="attendance-row" data-student="${s.id}"><span class="attendance-number">${i+1}</span><strong>${escapeHtml(s.name)}</strong><div class="attendance-status">${['A','F','R','J'].map(x=>`<button type="button" class="status-button ${r.status===x?'selected':''}" data-status="${x}">${x}</button>`).join('')}</div><input class="attendance-note" value="${escapeHtml(r.note||'')}" placeholder="Observación opcional"></div>`}).join('')||'<p class="muted">No hay alumnos activos.</p>';
}
function selectAttendanceStatus(e){const b=e.target.closest('[data-status]');if(!b)return;const row=b.closest('[data-student]');state.attendanceRecords[row.dataset.student].status=b.dataset.status;renderAttendanceList()}
function updateAttendanceNote(e){if(!e.target.classList.contains('attendance-note'))return;state.attendanceRecords[e.target.closest('[data-student]').dataset.student].note=e.target.value}
async function saveAttendanceDay(){const students=state.attendance?.students||[];const pending=students.filter(s=>!state.attendanceRecords[s.id]?.status);if(pending.length)return toast(`Falta registrar a ${pending.length} alumno(s).`,true);if(!confirm('¿Guardar la asistencia de esta fecha?'))return;await runAction(async()=>{const payload={date:$('#attendanceDate').value,records:students.map(s=>({studentId:s.id,status:state.attendanceRecords[s.id].status,note:state.attendanceRecords[s.id].note||''}))};const r=await server('saveAttendance',payload);state.attendanceDay=await server('getDayData',payload.date);prepareAttendanceRecords();renderAttendanceList();toast(r.message)})}
async function saveNoClassDay(){const reason=prompt('Motivo del día sin clases:','Consejo Técnico Escolar');if(!reason)return;const detail=prompt('Detalle opcional:','')||'';await runAction(async()=>{const r=await server('saveNoClass',{date:$('#attendanceDate').value,reason,detail});state.attendanceDay=await server('getDayData',$('#attendanceDate').value);prepareAttendanceRecords();renderAttendanceList();toast(r.message)})}
function toggleAttendanceReportMode(){const weekly=$('#attendanceReportType').value==='weekly';$('#attendanceWeekControl').classList.toggle('hidden-control',!weekly);$('#attendanceMonthControl').classList.toggle('hidden-control',weekly)}
async function loadAttendanceReport(){const studentId=$('#attendanceStudent').value;if(!studentId){showView('attendance');return toast('Selecciona un alumno para consultar el reporte.',true)}const weekly=$('#attendanceReportType').value==='weekly';await runAction(async()=>{const report=weekly?await server('getWeeklyAttendanceReport',studentId,$('#attendanceReportDate').value):await server('getIndividualReport',studentId,$('#attendancePeriod').value);weekly?renderWeeklyAttendanceReport(report):renderMonthlyAttendanceReport(report);showView('attendance')})}
function attendanceKpis(r){return `<div class="attendance-kpis"><div class="attendance-kpi"><b>${r.percentage}%</b><span>Asistencia</span></div><div class="attendance-kpi"><b>${r.attended}</b><span>A + R</span></div><div class="attendance-kpi"><b>${r.absent}</b><span>F + J</span></div><div class="attendance-kpi"><b>${r.counts.R}</b><span>Retardos</span></div></div>`}
function renderWeeklyAttendanceReport(r){$('#attendanceReport').innerHTML=`<h3>${escapeHtml(r.student.name)}</h3><p class="muted">Semana del ${escapeHtml(r.period)}</p>${attendanceKpis(r)}<div class="weekly-days">${r.days.map(d=>`<div class="weekly-day"><strong>${escapeHtml(d.label)}</strong><span>${escapeHtml(d.displayDate)}</span><span class="day-status status-${(d.status||'none').toLowerCase()}">${escapeHtml(d.statusLabel)}</span>${d.note?`<span class="day-note">${escapeHtml(d.note)}</span>`:''}</div>`).join('')}</div>`}
function renderMonthlyAttendanceReport(r){$('#attendanceReport').innerHTML=`<h3>${escapeHtml(r.student.name)}</h3><p class="muted">${escapeHtml(r.period)} · ${r.totalDays} días registrados</p>${attendanceKpis(r)}<ul class="attendance-details">${r.details.length?r.details.map(d=>`<li>${escapeHtml(d.displayDate)} · ${escapeHtml(d.statusLabel)}${d.note?' · '+escapeHtml(d.note):''}</li>`).join(''):'<li>Sin incidencias en el mes.</li>'}</ul>`}
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
function openStudent(s={}){const f=$('#studentForm');f.reset();Object.entries(s).forEach(([k,v])=>{if(f.elements[k])f.elements[k].value=v??''});$('#studentModalTitle').textContent=s.id?'Editar alumno':'Nuevo alumno';$('#studentDialog').showModal()}
function openProject(p={}){const f=$('#projectForm');f.reset();Object.entries(p).forEach(([k,v])=>{if(!f.elements[k])return;if(f.elements[k].type==='checkbox')f.elements[k].checked=Boolean(v);else f.elements[k].value=v??''});$('#projectDialog').showModal()}
async function saveStudentForm(e){e.preventDefault();const payload=formData(e.target);await runAction(async()=>{const r=await server('saveStudent',payload);const i=state.students.findIndex(x=>x.id===r.student.id);if(i<0)state.students.push(r.student);else state.students[i]=r.student;state.stats.students=state.students.length;e.target.closest('dialog').close();renderAll();toast(r.temporaryPassword?`Alumno guardado. Usuario: ${r.student.tutorUsuario} · Contraseña inicial: ${r.temporaryPassword}`:'Alumno actualizado.')})}
async function saveProjectForm(e){e.preventDefault();const payload=formData(e.target);payload.sinProductoFinal=e.target.elements.sinProductoFinal.checked;await runAction(async()=>{const r=await server('saveProject',payload);const i=state.projects.findIndex(x=>x.id===r.project.id);if(i<0)state.projects.unshift(r.project);else state.projects[i]=r.project;state.stats.projects=state.projects.filter(x=>x.estado==='Activo').length;e.target.closest('dialog').close();renderAll();toast('Proyecto guardado correctamente.')})}
function formData(form){return Object.fromEntries(new FormData(form).entries())}
async function runAction(fn){setLoading(true);try{await fn()}catch(e){if(isSessionError(e.message)){sessionToken='';localStorage.removeItem(SESSION_KEY);showLogin(e.message)}else toast(e.message,true)}finally{setLoading(false)}}
function fullName(s){return s.nombreCompleto||[s.apellidoPaterno,s.apellidoMaterno,s.nombres].filter(Boolean).join(' ')}
function setLoading(v){$('#loading').classList.toggle('hidden',!v)}
function toast(msg,error=false){const t=$('#toast');t.textContent=msg;t.style.background=error?'#9f2d2d':'';t.classList.add('show');setTimeout(()=>t.classList.remove('show'),5000)}
function escapeHtml(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
