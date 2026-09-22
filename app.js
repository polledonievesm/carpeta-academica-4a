const state={config:{},subjects:[],rubrics:[],students:[],projects:[],stats:{},attendance:null,attendanceDay:null,attendanceRecords:{},attendanceSummary:null,currentProject:null,projectWorkspace:null,classEvaluations:{},classStudents:[],classAttendanceDay:null};
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
  $('#classDate').addEventListener('change',()=>loadClassAttendance());
  $('#attendanceReportType').addEventListener('change',toggleAttendanceReportMode);
  $('#attendanceStudent').addEventListener('change',()=>{if($('#attendanceStudent').value)loadAttendanceReport()});
  $('#attendanceReportDate').addEventListener('change',()=>{if($('#attendanceStudent').value&&$('#attendanceReportType').value==='weekly')loadAttendanceReport()});
  $('#attendancePeriod').addEventListener('change',()=>{if($('#attendanceStudent').value&&$('#attendanceReportType').value==='monthly')loadAttendanceReport()});
  $('#academicReportType').addEventListener('change',toggleAcademicReportMode);
  $('#attendanceList').addEventListener('click',selectAttendanceStatus);
  $('#attendanceList').addEventListener('input',updateAttendanceNote);
  $('#studentForm').addEventListener('submit',saveStudentForm);
  $('#projectForm').addEventListener('submit',saveProjectForm);
  $('#classForm').addEventListener('submit',saveClassForm);
  $('#evaluationList').addEventListener('change',updateClassEvaluation);
  $('#evaluationList').addEventListener('input',updateClassEvaluation);
  $('#loginForm').addEventListener('submit',login);
}
const actions={
  'logout':()=>logout(),
  'new-student':()=>openStudent(),
  'new-project':()=>openProject(),
  'go-daily':()=>openClassForm(),
  'open-project':btn=>openProjectWorkspace(btn.dataset.id),
  'back-projects':()=>showView('projects'),
  'edit-current-project':()=>state.currentProject&&openProject(state.currentProject),
  'new-class':()=>openClassForm(state.currentProject?.id),
  'edit-class':btn=>openClassForm(state.currentProject?.id,btn.dataset.id),
  'cancel-class':()=>state.currentProject?showView('project-detail'):showView('dashboard'),
  'all-complete':()=>setAllEvaluations('trabajo','Completo'),
  'all-adequate':()=>setAllEvaluations('conducta','Adecuada'),
  'weekly-report':()=>openAcademicReports('weekly'),
  'individual-report':()=>openAcademicReports('monthly'),
  'academic-report':loadAcademicReport,
  'print-academic-report':()=>window.print(),
  'daily-report':loadDailyReport,
  'all-present':()=>{(state.attendance?.students||[]).forEach(s=>state.attendanceRecords[s.id]={status:'A',note:''});renderAttendanceList()},
  'save-attendance':saveAttendanceDay,
  'no-class':saveNoClassDay,
  'attendance-report':loadAttendanceReport,
  'edit-student':btn=>openStudent(state.students.find(x=>x.id===btn.dataset.id)),
  'delete-student':async btn=>{if(!confirm('¿Eliminar definitivamente a este alumno y sus registros? Esta acción no se puede deshacer.'))return;await runAction(async()=>{const r=await server('deleteStudent',btn.dataset.id);Object.assign(state,await server('getBootstrapData'));renderAll();toast(r.message)})},
  'delete-project':async btn=>{if(!confirm('¿Eliminar definitivamente este proyecto, sus actividades y evaluaciones? Esta acción no se puede deshacer.'))return;await runAction(async()=>{const r=await server('deleteProject',btn.dataset.id);Object.assign(state,await server('getBootstrapData'));renderAll();showView('projects');toast(r.message)})},
  'sync-styles':syncLearningStyles,
  'open-payments':openPayments,
  'save-payments-url':savePaymentsUrl
};
function showView(id){$$('.view').forEach(v=>v.classList.toggle('active',v.id===id));$$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===id));$('#sidebar').classList.remove('open');window.scrollTo(0,0)}
function renderAll(){
  $('#schoolName').textContent=state.config.escuela||'Carpeta Académica';
  $('#groupName').textContent=[state.config.gradoGrupo,state.config.turno].filter(Boolean).join(' · ');
  $('#teacherName').textContent=state.config.docente||'Docente';
  renderGreeting();
  if(!$('#dailyReportDate').value)$('#dailyReportDate').value=state.attendance?.today||new Date().toISOString().slice(0,10);
  renderStats();renderSubjects();renderStudents();renderStyles();renderProjects();renderActiveProjects();renderClassOptions();renderAttendance();renderAcademicOptions();renderPayments();
}
function cancunHour(){try{return Number(new Intl.DateTimeFormat('en-US',{hour:'2-digit',hour12:false,timeZone:'America/Cancun'}).format(new Date()))%24}catch(e){return new Date().getHours()}}
function todayCancun(){try{const parts=new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'America/Cancun'}).formatToParts(new Date()).reduce((a,p)=>(a[p.type]=p.value,a),{});return `${parts.year}-${parts.month}-${parts.day}`}catch(e){return new Date().toISOString().slice(0,10)}}
function renderGreeting(){const hour=cancunHour();const greeting=hour>=6&&hour<12?'Buenos días':hour>=12&&hour<19?'Buenas tardes':'Buenas noches';const teacher=String(state.config.docente||'Prof. Michel').replace(/^Prof\.\s*/i,'').split(/\s+/)[0]||'Michel';$('#welcomeGreeting').textContent=`¡${greeting}, Prof. ${teacher}!`}
function renderStats(){const s=state.stats;$('#stats').innerHTML=[['Alumnos',s.students||0],['Proyectos activos',s.projects||0],['Clases registradas',s.activities||0],['Requieren seguimiento',s.followUp||0]].map(([l,v])=>`<div class="stat"><b>${v}</b><span>${escapeHtml(l)}</span></div>`).join('')}
function renderSubjects(){$('#subjectGrid').innerHTML=state.subjects.map((x,i)=>`<div class="subject"><b>${escapeHtml(x.nombre)}</b><p class="muted">${i<5?'Campo formativo':'Complementaria'}</p></div>`).join('')}
function renderStudents(){const q=$('#studentSearch').value.toLowerCase();const rows=state.students.filter(s=>fullName(s).toLowerCase().includes(q));$('#studentCount').textContent=`${rows.length} alumnos`;$('#studentsTable').innerHTML=rows.length?rows.map(s=>`<tr><td><span class="student-name">${escapeHtml(fullName(s))}</span><br><span class="muted">${escapeHtml(s.tutorUsuario||'Sin acceso')}</span></td><td>${s.edad||'—'}</td><td>${escapeHtml(s.tutorNombre||'Sin registrar')}</td><td><span class="badge">${escapeHtml(s.estilo||'Sin evaluar')}</span></td><td><button class="link-button" data-action="edit-student" data-id="${s.id}">Editar</button> <button class="link-button danger-link" data-action="delete-student" data-id="${s.id}">Eliminar</button></td></tr>`).join(''):'<tr><td colspan="5" class="muted">No hay alumnos registrados.</td></tr>'}
function renderStyles(){const linked=Boolean(state.config.estilosSpreadsheetId);$('#stylesLinkStatus').textContent=linked?'Hoja del test vinculada. Presiona “Actualizar resultados” después de recibir respuestas nuevas.':'Falta vincular la hoja del test. Hazlo desde Google Sheets: Carpeta Académica > Vincular resultados de estilos VAK.';$('#stylesGrid').innerHTML=state.students.length?state.students.map(s=>`<div class="student-card"><h3>${escapeHtml(fullName(s))}</h3><span class="badge">${escapeHtml(s.estilo||'Sin evaluar')}</span><p class="vak-scores">Visual: <b>${s.visual??'—'}</b> · Auditivo: <b>${s.auditivo??'—'}</b> · Kinestésico: <b>${s.kinestesico??'—'}</b></p><p class="muted">${s.fechaEvaluacion?'Evaluado: '+escapeHtml(formatDateShort(s.fechaEvaluacion)):'Sin resultado vinculado'}</p></div>`).join(''):'<div class="panel">Primero añade alumnos al grupo.</div>'}
function renderProjects(){const q=$('#projectSearch').value.toLowerCase();const status=$('#projectStatus').value;const rows=state.projects.filter(p=>(!q||p.nombre.toLowerCase().includes(q))&&(!status||p.estado===status));$('#projectsGrid').innerHTML=rows.length?rows.map(projectCard).join(''):'<div class="panel">No hay proyectos registrados.</div>'}
function renderActiveProjects(){const rows=state.projects.filter(p=>p.estado==='Activo').slice(0,3);$('#activeProjects').innerHTML=rows.length?rows.map(projectCard).join(''):'<div class="muted">Añade tu primer proyecto para comenzar.</div>'}
function projectCard(p){return `<article class="project-card"><span class="badge">${escapeHtml(p.estado||'Activo')}</span><h3>${escapeHtml(p.nombre)}</h3><p>${escapeHtml(p.campoFormativo)} · ${escapeHtml(p.temporalidad||'Sin temporalidad')}</p><div class="project-actions"><button class="btn primary" data-action="open-project" data-id="${p.id}">Abrir</button><button class="btn danger" data-action="delete-project" data-id="${p.id}">Eliminar</button></div></article>`}
function renderClassOptions(){
  const projectSelect=$('#classProject'),subjectSelect=$('#classSubject');
  projectSelect.innerHTML='<option value="">Selecciona un proyecto</option>'+state.projects.filter(p=>p.estado==='Activo').map(p=>`<option value="${escapeHtml(p.id)}">${escapeHtml(p.nombre)}</option>`).join('');
  subjectSelect.innerHTML='<option value="">Selecciona</option>'+state.subjects.map(s=>`<option>${escapeHtml(s.nombre)}</option>`).join('');
}
async function openProjectWorkspace(projectId){
  await runAction(async()=>{
    state.projectWorkspace=await server('getProjectWorkspace',projectId);
    state.currentProject=state.projectWorkspace.project;
    renderProjectWorkspace();
    showView('project-detail');
  });
}
function renderProjectWorkspace(){
  const p=state.currentProject||{},workspace=state.projectWorkspace||{activities:[]};
  $('#projectDetailName').textContent=p.nombre||'Proyecto';
  $('#projectDetailMeta').textContent=[p.campoFormativo,p.temporalidad,[p.fechaInicio,p.fechaFin].filter(Boolean).join(' a ')].filter(Boolean).join(' · ');
  const info=[['Metodología',p.metodologia],['Escenario',p.escenario],['Ejes articuladores',p.ejes],['Propósito',p.proposito],['Producto final',p.sinProductoFinal?'Sin producto final':p.productoFinal],['Contenidos y PDA',[p.contenidos,p.pda].filter(Boolean).join(' · ')]];
  $('#projectDetailInfo').innerHTML=info.filter(x=>x[1]).map(([label,value])=>`<article class="panel project-info"><span>${escapeHtml(label)}</span><p>${escapeHtml(value)}</p></article>`).join('')||'<article class="panel"><p class="muted">Puedes editar el proyecto para completar sus datos curriculares.</p></article>';
  const activities=workspace.activities||[];
  $('#projectActivityCount').textContent=`${activities.length} ${activities.length===1?'actividad':'actividades'}`;
  $('#projectActivities').innerHTML=activities.length?activities.map(a=>`<article class="history-card"><div class="history-main"><span class="history-date">${escapeHtml(formatDateShort(a.fecha))} · ${escapeHtml(formatTime(a.horaInicio))}–${escapeHtml(formatTime(a.horaFin))}</span><h3>${escapeHtml(a.actividad)}</h3><p>${escapeHtml(a.materia)} · ${escapeHtml(a.material)}</p></div><div class="history-results"><span class="result complete"><b>${a.totals.complete}</b> completas</span><span class="result partial"><b>${a.totals.partial}</b> incompletas</span><span class="result none"><b>${a.totals.none}</b> no trabajaron</span><span class="result conduct"><b>${a.totals.conduct}</b> conducta</span></div><button class="btn" data-action="edit-class" data-id="${a.id}">Ver o editar</button></article>`).join(''):'<div class="empty-history"><strong>Aún no hay actividades</strong><p>Presiona “Registrar actividad” para evaluar al grupo.</p></div>';
}
async function openClassForm(projectId='',classId=''){
  renderClassOptions();
  const form=$('#classForm');form.reset();form.elements.id.value='';form.elements.fecha.value=todayCancun();form.elements.horaInicio.value='13:00';form.elements.horaFin.value='14:00';
  const selected=projectId||state.currentProject?.id||state.projects.find(p=>p.estado==='Activo')?.id||'';
  form.elements.proyectoId.value=selected;
  const project=state.projects.find(p=>String(p.id)===String(selected));
  if(project&&[...form.elements.materia.options].some(o=>o.value===project.campoFormativo))form.elements.materia.value=project.campoFormativo;
  state.classStudents=[];state.classEvaluations={};state.classAttendanceDay=null;
  let savedEvaluations={};
  if(classId){
    await runAction(async()=>{
      const data=await server('getClassRecord',classId);Object.entries(data.classRecord).forEach(([key,value])=>{if(form.elements[key])form.elements[key].value=value??''});
      data.evaluations.forEach(row=>savedEvaluations[row.alumnoId]={alumnoId:row.alumnoId,trabajo:row.trabajo||'Completo',conducta:row.conducta||'Adecuada',participacion:row.participacion||'Media',desempeno:row.desempeno||'',observacionLibre:row.observacionLibre||''});
    });
  }
  $('#classFormTitle').textContent=classId?'Editar actividad':'Registrar actividad';
  await loadClassAttendance(savedEvaluations);
  showView('daily');
}
function defaultEvaluation(studentId){return {alumnoId:studentId,trabajo:'Completo',conducta:'Adecuada',participacion:'Media',desempeno:'',observacionLibre:''}}
async function loadClassAttendance(savedEvaluations=null){
  const date=$('#classDate').value;if(!date)return;
  await runAction(async()=>{
    state.classAttendanceDay=await server('getDayData',date);
    const existing=state.classAttendanceDay.existing||{};
    const registeredIds=Object.keys(existing);
    const presentIds=new Set(registeredIds.filter(id=>existing[id].status==='A'||existing[id].status==='R'));
    state.classStudents=state.students.filter(student=>presentIds.has(String(student.id)));
    const previous=savedEvaluations||state.classEvaluations||{};
    state.classEvaluations={};
    state.classStudents.forEach(student=>state.classEvaluations[student.id]=previous[student.id]||defaultEvaluation(student.id));
    const notice=$('#classAttendanceNotice');
    if(!registeredIds.length){notice.className='class-attendance-notice error';notice.textContent='Primero guarda la asistencia de esta fecha. No se puede calificar hasta hacerlo.'}
    else if(!state.classStudents.length){notice.className='class-attendance-notice error';notice.textContent='No hay alumnos con asistencia (A) o retardo (R) en esta fecha.'}
    else{const absent=registeredIds.length-state.classStudents.length;notice.className='class-attendance-notice success';notice.textContent=`${state.classStudents.length} alumno(s) presentes para evaluar · ${absent} ausente(s) no aparecerán.`}
    renderEvaluationList();
  });
}
function rubricOptions(selected){
  const grouped={};state.rubrics.forEach(r=>{if(!grouped[r.categoria])grouped[r.categoria]=[];grouped[r.categoria].push(r)});
  return '<option value="">Sin observación predeterminada</option>'+Object.entries(grouped).map(([category,rows])=>`<optgroup label="${escapeHtml(category)}">${rows.map(r=>`<option value="${escapeHtml(r.mensaje)}" ${selected===r.mensaje?'selected':''}>${escapeHtml(r.nivel)}: ${escapeHtml(r.mensaje)}</option>`).join('')}</optgroup>`).join('');
}
function renderEvaluationList(){
  $('#evaluationList').innerHTML=state.classStudents.length?state.classStudents.map((student,index)=>{const r=state.classEvaluations[student.id];return `<article class="evaluation-row" data-student="${student.id}"><div class="evaluation-student"><span>${index+1}</span><strong>${escapeHtml(fullName(student))}</strong></div><label>Trabajo<select data-field="trabajo"><option ${r.trabajo==='Completo'?'selected':''}>Completo</option><option ${r.trabajo==='Incompleto'?'selected':''}>Incompleto</option><option ${r.trabajo==='No trabajó'?'selected':''}>No trabajó</option></select></label><label>Conducta<select data-field="conducta"><option ${r.conducta==='Excelente'?'selected':''}>Excelente</option><option ${r.conducta==='Adecuada'?'selected':''}>Adecuada</option><option ${r.conducta==='Requiere apoyo'?'selected':''}>Requiere apoyo</option></select></label><label>Participación<select data-field="participacion"><option ${r.participacion==='Alta'?'selected':''}>Alta</option><option ${r.participacion==='Media'?'selected':''}>Media</option><option ${r.participacion==='Nula'?'selected':''}>Nula</option></select></label><label class="rubric-field">Observación predeterminada<select data-field="desempeno">${rubricOptions(r.desempeno)}</select></label><label class="note-field">Observación adicional<input data-field="observacionLibre" value="${escapeHtml(r.observacionLibre)}" placeholder="Opcional"></label></article>`}).join(''):'<div class="empty-history"><strong>No hay alumnos disponibles para evaluar</strong><p>Guarda primero la asistencia del día.</p></div>';
  $('#evaluationProgress').textContent=`${state.classStudents.length} alumno(s) presentes preparados`;
}
function updateClassEvaluation(e){const row=e.target.closest('[data-student]'),field=e.target.dataset.field;if(!row||!field)return;state.classEvaluations[row.dataset.student][field]=e.target.value}
function setAllEvaluations(field,value){Object.values(state.classEvaluations).forEach(row=>row[field]=value);renderEvaluationList()}
async function saveClassForm(e){
  e.preventDefault();if(!state.classStudents.length)return toast('Primero guarda la asistencia; no hay alumnos presentes para evaluar.',true);const payload=formData(e.currentTarget);payload.evaluaciones=state.classStudents.map(s=>state.classEvaluations[s.id]);
  if(!confirm(`¿Guardar la actividad y la evaluación de ${payload.evaluaciones.length} alumnos?`))return;
  await runAction(async()=>{const result=await server('saveClassRecord',payload);state.stats.activities=Number(state.stats.activities||0)+(payload.id?0:1);state.stats.followUp=result.followUp;state.projectWorkspace=await server('getProjectWorkspace',payload.proyectoId);state.currentProject=state.projectWorkspace.project;renderProjectWorkspace();renderStats();showView('project-detail');toast(result.message)});
}
function formatDateShort(value){if(!value)return 'Sin fecha';const [y,m,d]=String(value).split('-');return `${d}/${m}/${y}`}
function formatTime(value){if(!value)return '';const [h,m]=String(value).split(':').map(Number);return `${h%12||12}:${String(m||0).padStart(2,'0')} ${h<12?'a. m.':'p. m.'}`}
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
function prepareAttendanceRecords(){state.attendanceRecords={};(state.attendance?.students||[]).forEach(s=>{const saved=state.attendanceDay?.existing?.[s.id];state.attendanceRecords[s.id]=saved?{status:saved.status,note:saved.note||''}:{status:'',note:''}})}
async function loadAttendanceDay(){const date=$('#attendanceDate').value;if(!date)return;state.attendanceSummary=null;renderAttendanceSavedSummary();await runAction(async()=>{state.attendanceDay=await server('getDayData',date);prepareAttendanceRecords();renderAttendanceList()})}
function renderAttendanceList(){
  const day=state.attendanceDay||{};$('#attendanceDisplayDate').textContent=day.displayDate||'Selecciona una fecha';$('#attendanceNotice').textContent=day.noClass?`Día sin clases: ${day.noClassReason}${day.noClassDetail?' · '+day.noClassDetail:''}`:'';
  $('#attendanceList').innerHTML=(state.attendance?.students||[]).map((s,i)=>{const r=state.attendanceRecords[s.id]||{};return `<div class="attendance-row" data-student="${s.id}"><span class="attendance-number">${i+1}</span><strong>${escapeHtml(s.name)}</strong><div class="attendance-status">${['A','F','R','J'].map(x=>`<button type="button" class="status-button ${r.status===x?'selected':''}" data-status="${x}">${x}</button>`).join('')}</div><input class="attendance-note" value="${escapeHtml(r.note||'')}" placeholder="Observación opcional"></div>`}).join('')||'<p class="muted">No hay alumnos activos.</p>';
}
function selectAttendanceStatus(e){const b=e.target.closest('[data-status]');if(!b)return;const row=b.closest('[data-student]');state.attendanceRecords[row.dataset.student].status=b.dataset.status;renderAttendanceList()}
function updateAttendanceNote(e){if(!e.target.classList.contains('attendance-note'))return;state.attendanceRecords[e.target.closest('[data-student]').dataset.student].note=e.target.value}
function renderAttendanceSavedSummary(){const box=$('#attendanceSavedSummary'),r=state.attendanceSummary;if(!r){box.classList.add('hidden-control');box.innerHTML='';return}box.classList.remove('hidden-control');box.innerHTML=`<strong>Asistencia guardada</strong><span><b>${r.attended}</b> asistieron (A + R)</span><span><b>${r.absent}</b> faltaron (F + J)</span><small>A: ${r.counts.A} · R: ${r.counts.R} · F: ${r.counts.F} · J: ${r.counts.J}</small>`}
async function saveAttendanceDay(){const students=state.attendance?.students||[];const pending=students.filter(s=>!state.attendanceRecords[s.id]?.status);if(pending.length)return toast(`Falta registrar a ${pending.length} alumno(s).`,true);if(!confirm('¿Guardar la asistencia de esta fecha?'))return;await runAction(async()=>{const payload={date:$('#attendanceDate').value,records:students.map(s=>({studentId:s.id,status:state.attendanceRecords[s.id].status,note:state.attendanceRecords[s.id].note||''}))};const r=await server('saveAttendance',payload);state.attendanceSummary=r;state.attendanceDay=await server('getDayData',payload.date);prepareAttendanceRecords();renderAttendanceList();renderAttendanceSavedSummary();toast(r.message)})}
async function saveNoClassDay(){const reason=prompt('Motivo del día sin clases:','Consejo Técnico Escolar');if(!reason)return;const detail=prompt('Detalle opcional:','')||'';await runAction(async()=>{const r=await server('saveNoClass',{date:$('#attendanceDate').value,reason,detail});state.attendanceDay=await server('getDayData',$('#attendanceDate').value);prepareAttendanceRecords();renderAttendanceList();toast(r.message)})}
function toggleAttendanceReportMode(){const weekly=$('#attendanceReportType').value==='weekly';$('#attendanceWeekControl').classList.toggle('hidden-control',!weekly);$('#attendanceMonthControl').classList.toggle('hidden-control',weekly)}
async function loadAttendanceReport(){const studentId=$('#attendanceStudent').value;if(!studentId){showView('attendance');return toast('Selecciona un alumno para consultar el reporte.',true)}const weekly=$('#attendanceReportType').value==='weekly';await runAction(async()=>{const report=weekly?await server('getWeeklyAttendanceReport',studentId,$('#attendanceReportDate').value):await server('getIndividualReport',studentId,$('#attendancePeriod').value);weekly?renderWeeklyAttendanceReport(report):renderMonthlyAttendanceReport(report);showView('attendance')})}
function attendanceKpis(r){return `<div class="attendance-kpis"><div class="attendance-kpi"><b>${r.percentage}%</b><span>Asistencia</span></div><div class="attendance-kpi"><b>${r.attended}</b><span>A + R</span></div><div class="attendance-kpi"><b>${r.absent}</b><span>F + J</span></div><div class="attendance-kpi"><b>${r.counts.R}</b><span>Retardos</span></div></div>`}
function renderWeeklyAttendanceReport(r){$('#attendanceReport').innerHTML=`<h3>${escapeHtml(r.student.name)}</h3><p class="muted">Semana del ${escapeHtml(r.period)}</p>${attendanceKpis(r)}<div class="weekly-days">${r.days.map(d=>`<div class="weekly-day"><strong>${escapeHtml(d.label)}</strong><span>${escapeHtml(d.displayDate)}</span><span class="day-status status-${(d.status||'none').toLowerCase()}">${escapeHtml(d.statusLabel)}</span>${d.note?`<span class="day-note">${escapeHtml(d.note)}</span>`:''}</div>`).join('')}</div>`}
function renderMonthlyAttendanceReport(r){$('#attendanceReport').innerHTML=`<h3>${escapeHtml(r.student.name)}</h3><p class="muted">${escapeHtml(r.period)} · ${r.totalDays} días registrados</p>${attendanceKpis(r)}<ul class="attendance-details">${r.details.length?r.details.map(d=>`<li>${escapeHtml(d.displayDate)} · ${escapeHtml(d.statusLabel)}${d.note?' · '+escapeHtml(d.note):''}</li>`).join(''):'<li>Sin incidencias en el mes.</li>'}</ul>`}
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
async function syncLearningStyles(){await runAction(async()=>{const r=await server('syncLearningStyles');state.students=r.students;state.config.estilosSpreadsheetId=state.config.estilosSpreadsheetId||'vinculado';renderStudents();renderStyles();renderAcademicOptions();toast(`${r.matched} resultado(s) VAK actualizados${r.unmatched.length?` · ${r.unmatched.length} sin coincidencia`:''}.`)})}
function renderPayments(){const url=String(state.config.controlPagosUrl||'');$('#paymentControlUrl').value=url;$('#paymentStatus').textContent=url?'Control de pagos vinculado: '+url:'Aún no se ha guardado la dirección del control de pagos.'}
function openPayments(){const url=String(state.config.controlPagosUrl||'').trim();if(!url){showView('payments');return toast('Primero guarda la dirección pública de tu control de pagos.',true)}window.open(url,'_blank','noopener,noreferrer')}
async function savePaymentsUrl(){const url=$('#paymentControlUrl').value.trim();await runAction(async()=>{const r=await server('savePaymentControlUrl',url);state.config.controlPagosUrl=r.url;renderPayments();toast(r.message)})}
function openStudent(s={}){const f=$('#studentForm');f.reset();Object.entries(s).forEach(([k,v])=>{if(f.elements[k])f.elements[k].value=v??''});$('#studentModalTitle').textContent=s.id?'Editar alumno':'Nuevo alumno';$('#studentDialog').showModal()}
function openProject(p={}){const f=$('#projectForm');f.reset();Object.entries(p).forEach(([k,v])=>{if(!f.elements[k])return;if(f.elements[k].type==='checkbox')f.elements[k].checked=Boolean(v);else f.elements[k].value=v??''});$('#projectDialog').showModal()}
async function saveStudentForm(e){e.preventDefault();const payload=formData(e.target);await runAction(async()=>{const r=await server('saveStudent',payload);Object.assign(state,await server('getBootstrapData'));e.target.closest('dialog').close();renderAll();toast(r.temporaryPassword?`Alumno guardado. Usuario: ${r.student.tutorUsuario} · Contraseña inicial: ${r.temporaryPassword}`:'Alumno actualizado.')})}
async function saveProjectForm(e){e.preventDefault();const payload=formData(e.target);payload.sinProductoFinal=e.target.elements.sinProductoFinal.checked;await runAction(async()=>{const r=await server('saveProject',payload);const i=state.projects.findIndex(x=>x.id===r.project.id);if(i<0)state.projects.unshift(r.project);else state.projects[i]=r.project;state.stats.projects=state.projects.filter(x=>x.estado==='Activo').length;e.target.closest('dialog').close();renderAll();toast('Proyecto guardado correctamente.')})}
function formData(form){return Object.fromEntries(new FormData(form).entries())}
async function runAction(fn){setLoading(true);try{await fn()}catch(e){if(isSessionError(e.message)){sessionToken='';localStorage.removeItem(SESSION_KEY);showLogin(e.message)}else toast(e.message,true)}finally{setLoading(false)}}
function fullName(s){return s.nombreCompleto||[s.apellidoPaterno,s.apellidoMaterno,s.nombres].filter(Boolean).join(' ')}
function setLoading(v){$('#loading').classList.toggle('hidden',!v)}
function toast(msg,error=false){const t=$('#toast');t.textContent=msg;t.style.background=error?'#9f2d2d':'';t.classList.add('show');setTimeout(()=>t.classList.remove('show'),5000)}
function escapeHtml(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
