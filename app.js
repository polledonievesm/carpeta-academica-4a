const state={config:{},subjects:[],rubrics:[],students:[],projects:[],stats:{},attendance:null,attendanceDay:null,attendanceRecords:{},attendanceSummary:null,currentProject:null,projectWorkspace:null,classEvaluations:{},classStudents:[],classAttendanceDay:null,paymentsInitial:null,paymentsLoadedAt:0,paymentDetail:null,directory:null,directoryLoadedAt:0,grades:null,gradeWeights:[],gradeReport:null,projectMode:'all'};
const $=(s,r=document)=>r.querySelector(s);const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const API_SOURCE='pase-lista-4a-api';
const API_URL=String(window.CARPETA_ACADEMICA_CONFIG?.apiUrl||'').trim();
const SESSION_KEY='carpeta_academica_session_v1';
const FAMILY_SESSION_KEY='carpeta_academica_family_session_v1';
const pendingRequests=new Map();
let sessionToken=localStorage.getItem(SESSION_KEY)||'';
let familySessionToken=localStorage.getItem(FAMILY_SESSION_KEY)||'';
let familyInvitationToken='';
let familyResetToken='';
let familyGroupToken='';
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
function familyServer(name,...args){return apiRequest(name,args,familySessionToken)}
function siteBaseUrl(){return location.origin+location.pathname}
async function startApp(){const params=new URLSearchParams(location.search);familyInvitationToken=params.get('familia')||'';familyResetToken=params.get('recuperar')||'';familyGroupToken=params.get('grupo')||'';if(familyInvitationToken||familyResetToken||familyGroupToken)return startFamilyPortal();if(sessionToken)await loadApp();else{setLoading(false);showLogin()}}
function showLogin(message=''){$('#loginError').textContent=message;const dialog=$('#loginDialog');if(!dialog.open)dialog.showModal();setTimeout(()=>$('#loginForm').elements.username.focus(),50)}
async function login(e){e.preventDefault();const form=e.currentTarget;$('#loginError').textContent='';setLoading(true);try{const r=await apiRequest('login',[form.elements.username.value,form.elements.password.value],'');sessionToken=r.token;localStorage.setItem(SESSION_KEY,sessionToken);form.elements.password.value='';$('#loginDialog').close();await loadApp()}catch(error){showLogin(error.message)}finally{setLoading(false)}}
function logout(confirmFirst=true){if(confirmFirst&&!confirm('¿Cerrar la sesión de Carpeta Académica?'))return;sessionToken='';localStorage.removeItem(SESSION_KEY);location.reload()}
function isSessionError(message){return /sesión|sesion|inicia sesión|inicia sesion|venció|vencio/i.test(String(message||''))}
async function loadApp(){setLoading(true);try{Object.assign(state,await server('getBootstrapData'));renderAll()}catch(e){if(isSessionError(e.message)){sessionToken='';localStorage.removeItem(SESSION_KEY);showLogin(e.message)}else toast(e.message,true)}finally{setLoading(false)}}
function bindUI(){
  $$('.nav-item').forEach(b=>b.addEventListener('click',()=>b.dataset.view==='payments'?openPayments():b.dataset.view==='directory'?openDirectory():b.dataset.view==='grades'?openGrades():showView(b.dataset.view)));
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
  $('#paymentEventForm').addEventListener('submit',createPaymentEvent);
  $('#studentPaymentForm').addEventListener('submit',saveStudentPayment);
  $('#paymentCutForm').addEventListener('submit',savePaymentCut);
  $('#paymentMovementForm').addEventListener('submit',savePaymentMovement);
  $('#paymentStudentSearch').addEventListener('input',renderPaymentStudents);
  $('#paymentStudentFilter').addEventListener('change',renderPaymentStudents);
  $('#directorySearch').addEventListener('input',renderDirectory);
  $('#directoryStatus').addEventListener('change',renderDirectory);
  $('#directoryForm').addEventListener('submit',saveDirectoryForm);
  $('#familyRegisterForm').addEventListener('submit',registerFamilyAccount);
  $('#familyLoginForm').addEventListener('submit',familyLogin);
  $('#familyForgotForm').addEventListener('submit',requestFamilyReset);
  $('#familyResetForm').addEventListener('submit',saveFamilyReset);
  $('#familyProfileForm').addEventListener('submit',saveFamilyProfile);
  $('#familyGroupSearch').addEventListener('input',searchGroupStudents);
  $('#familyGroupRegisterForm').addEventListener('submit',registerGroupFamilyAccount);
  $('#subjectForm').addEventListener('submit',saveSubjectForm);
  $('#gradeWeightsList').addEventListener('input',updateGradeWeightTotal);
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
  'refresh-payments':loadPayments,
  'sync-payment-students':syncPaymentStudents,
  'toggle-payment-event-form':togglePaymentEventForm,
  'open-payment-event':btn=>openPaymentEvent(btn.dataset.id),
  'back-payment-events':backPaymentEvents,
  'archive-payment-event':btn=>setPaymentEventActive(btn.dataset.id,false),
  'reactivate-payment-event':btn=>setPaymentEventActive(btn.dataset.id,true),
  'archive-current-payment-event':()=>state.paymentDetail&&setPaymentEventActive(state.paymentDetail.event.id,false),
  'payment-abono':btn=>openStudentPayment(btn.dataset.id,'ABONO'),
  'payment-total':btn=>openStudentPayment(btn.dataset.id,'TOTAL'),
  'open-directory':openDirectory,
  'refresh-directory':loadDirectory,
  'toggle-directory-report':toggleDirectoryReport,
  'edit-directory':btn=>openDirectoryForm(btn.dataset.id),
  'generate-family-invite':btn=>generateFamilyInvitation(btn.dataset.id),
  'revoke-family-invite':btn=>revokeFamilyInvitation(btn.dataset.id),
  'generate-family-reset':btn=>generateFamilyReset(btn.dataset.id),
  'toggle-family-account':btn=>setFamilyAccountActive(btn.dataset.id,btn.dataset.active==='true'),
  'delete-family-access':btn=>deleteFamilyAccess(btn.dataset.id),
  'directory-delete-student':btn=>deleteDirectoryStudent(btn.dataset.id),
  'copy-directory-link':copyDirectoryLink,
  'select-all-directory':()=>setDirectorySelection(true),
  'clear-directory-selection':()=>setDirectorySelection(false),
  'preview-directory-report':previewDirectoryReport,
  'print-directory-report':printDirectoryReport,
  'print-directory-profile':btn=>printDirectoryProfile(btn.dataset.id),
  'view-directory':btn=>viewDirectoryProfile(btn.dataset.id),
  'group-family-invite':generateGroupFamilyInvitation,
  'select-group-student':btn=>selectGroupStudent(btn.dataset.id,decodeURIComponent(btn.dataset.name||'')),
  'projects-all':()=>setProjectsMode('all'),
  'projects-fields':()=>setProjectsMode('fields'),
  'new-subject':()=>openSubjectForm(),
  'edit-subject':btn=>openSubjectForm(state.subjects.find(x=>x.id===btn.dataset.id)),
  'delete-subject':btn=>deleteSubject(btn.dataset.id),
  'grades-refresh':()=>loadGrades(true),
  'load-grade-weights':loadGradeWeights,
  'add-grade-criterion':()=>addGradeCriterion(),
  'remove-grade-criterion':btn=>{btn.closest('.grade-weight-row').remove();updateGradeWeightTotal()},
  'save-grade-weights':saveGradeWeights,
  'save-manual-grades':saveManualGrades,
  'generate-grade-report':generateGradeReport,
  'generate-consolidated-report':generateConsolidatedReport,
  'print-grade-report':()=>printGradeReport(),
  'open-family-login':()=>{location.href=siteBaseUrl()+'?familia=acceso'},
  'show-family-forgot':()=>showFamilyPanel('familyForgotPanel'),
  'show-family-login':()=>showFamilyPanel('familyLoginPanel'),
  'back-teacher-login':()=>{location.href=siteBaseUrl()},
  'family-logout':familyLogout
};
function showView(id){$$('.view').forEach(v=>v.classList.toggle('active',v.id===id));$$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===id));$('#sidebar').classList.remove('open');window.scrollTo(0,0)}
function renderAll(){
  $('#schoolName').textContent=state.config.escuela||'Carpeta Académica';
  $('#groupName').textContent=[state.config.gradoGrupo,state.config.turno].filter(Boolean).join(' · ');
  $('#teacherName').textContent=state.config.docente||'Docente';
  renderGreeting();
  if(!$('#dailyReportDate').value)$('#dailyReportDate').value=state.attendance?.today||new Date().toISOString().slice(0,10);
  renderStats();renderSubjects();renderStudents();renderStyles();renderProjects();renderActiveProjects();renderClassOptions();renderAttendance();renderAcademicOptions();renderPaymentsHome();renderProjectSubjectOptions();
}
function cancunHour(){try{return Number(new Intl.DateTimeFormat('en-US',{hour:'2-digit',hour12:false,timeZone:'America/Cancun'}).format(new Date()))%24}catch(e){return new Date().getHours()}}
function todayCancun(){try{const parts=new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'America/Cancun'}).formatToParts(new Date()).reduce((a,p)=>(a[p.type]=p.value,a),{});return `${parts.year}-${parts.month}-${parts.day}`}catch(e){return new Date().toISOString().slice(0,10)}}
function renderGreeting(){const hour=cancunHour();const greeting=hour>=6&&hour<12?'Buenos días':hour>=12&&hour<19?'Buenas tardes':'Buenas noches';const teacher=String(state.config.docente||'Prof. Michel').replace(/^Prof\.\s*/i,'').split(/\s+/)[0]||'Michel';$('#welcomeGreeting').textContent=`¡${greeting}, Prof. ${teacher}!`}
function renderStats(){const s=state.stats;$('#stats').innerHTML=[['Alumnos',s.students||0],['Proyectos activos',s.projects||0],['Clases registradas',s.activities||0],['Requieren seguimiento',s.followUp||0]].map(([l,v])=>`<div class="stat"><b>${v}</b><span>${escapeHtml(l)}</span></div>`).join('')}
function renderSubjects(){$('#subjectGrid').innerHTML=state.subjects.map((x,i)=>`<div class="subject"><b>${escapeHtml(x.nombre)}</b><p class="muted">${i<5?'Campo formativo':'Complementaria'}</p></div>`).join('')}
function renderStudents(){const q=$('#studentSearch').value.toLowerCase();const rows=state.students.filter(s=>fullName(s).toLowerCase().includes(q));$('#studentCount').textContent=`${rows.length} alumnos`;$('#studentsTable').innerHTML=rows.length?rows.map(s=>`<tr><td><span class="student-name">${escapeHtml(fullName(s))}</span><br><span class="muted">${escapeHtml(s.tutorUsuario||'Sin acceso')}</span></td><td>${s.edad||'—'}</td><td>${escapeHtml(s.tutorNombre||'Sin registrar')}</td><td><span class="badge">${escapeHtml(s.estilo||'Sin evaluar')}</span></td><td><button class="link-button" data-action="edit-student" data-id="${s.id}">Editar</button> <button class="link-button danger-link" data-action="delete-student" data-id="${s.id}">Eliminar</button></td></tr>`).join(''):'<tr><td colspan="5" class="muted">No hay alumnos registrados.</td></tr>'}
function renderStyles(){const linked=Boolean(state.config.estilosSpreadsheetId);$('#stylesLinkStatus').textContent=linked?'Hoja del test vinculada. Presiona “Actualizar resultados” después de recibir respuestas nuevas.':'Falta vincular la hoja del test. Hazlo desde Google Sheets: Carpeta Académica > Vincular resultados de estilos VAK.';$('#stylesGrid').innerHTML=state.students.length?state.students.map(s=>`<div class="student-card"><h3>${escapeHtml(fullName(s))}</h3><span class="badge">${escapeHtml(s.estilo||'Sin evaluar')}</span><p class="vak-scores">Visual: <b>${s.visual??'—'}</b> · Auditivo: <b>${s.auditivo??'—'}</b> · Kinestésico: <b>${s.kinestesico??'—'}</b></p><p class="muted">${s.fechaEvaluacion?'Evaluado: '+escapeHtml(formatDateShort(s.fechaEvaluacion)):'Sin resultado vinculado'}</p></div>`).join(''):'<div class="panel">Primero añade alumnos al grupo.</div>'}
function renderProjects(){const q=$('#projectSearch').value.toLowerCase();const status=$('#projectStatus').value;const rows=state.projects.filter(p=>(!q||p.nombre.toLowerCase().includes(q))&&(!status||p.estado===status));$('#projectsGrid').innerHTML=rows.length?rows.map(projectCard).join(''):'<div class="panel">No hay proyectos registrados.</div>';renderFields()}
function setProjectsMode(mode){state.projectMode=mode;$('#projectsGrid').classList.toggle('hidden-control',mode!=='all');$('#projectsToolbar').classList.toggle('hidden-control',mode!=='all');$('#fieldsGrid').classList.toggle('hidden-control',mode!=='fields');$$('[data-action="projects-all"],[data-action="projects-fields"]').forEach(btn=>btn.classList.toggle('primary',btn.dataset.action===(mode==='all'?'projects-all':'projects-fields')));if(mode==='fields')renderFields()}
function renderFields(){const host=$('#fieldsGrid');if(!host)return;host.innerHTML=`<article class="panel field-add"><button class="btn primary" data-action="new-subject">+ Agregar campo formativo</button><p class="muted">Puedes editar un nombre. Para eliminarlo, primero debe quedar sin proyectos ni actividades.</p></article>`+state.subjects.map(subject=>{const projects=state.projects.filter(project=>project.campoFormativo===subject.nombre);return `<article class="panel field-card"><div class="section-head"><div><h2>${escapeHtml(subject.nombre)}</h2><span class="badge">${projects.length} proyecto(s)</span></div><div class="button-row"><button class="btn small" data-action="edit-subject" data-id="${escapeHtml(subject.id)}">Modificar</button><button class="btn danger small" data-action="delete-subject" data-id="${escapeHtml(subject.id)}">Eliminar</button></div></div><div class="project-grid">${projects.length?projects.map(projectCard).join(''):'<p class="muted">Sin proyectos.</p>'}</div></article>`}).join('')}
function renderProjectSubjectOptions(){const select=$('#projectSubject');if(select)select.innerHTML='<option value="">Selecciona</option>'+state.subjects.map(s=>`<option>${escapeHtml(s.nombre)}</option>`).join('')}
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
function openDirectory(){showView('directory');if(state.directory&&Date.now()-state.directoryLoadedAt<120000){renderDirectory();return}loadDirectory()}
async function loadDirectory(force=true){await runAction(async()=>{if(state.config.directorioSiteUrl!==siteBaseUrl()){await server('saveDirectorySiteUrl',siteBaseUrl());state.config.directorioSiteUrl=siteBaseUrl()}state.directory=await server('getDirectoryAdminData');state.directoryLoadedAt=Date.now();renderDirectory();renderDirectoryBuilder();$('#directoryNotice').innerHTML='<strong>Directorio protegido.</strong> Escribe al menos dos letras para buscar. Las familias solo consultan la ficha de su propio alumno.'})}
function directoryRowMatches(row,query,status){
  const p=row.profile||{},account=row.account,invitation=row.invitation;
  const text=[row.student.name,p.tutorApellidoPaterno,p.tutorApellidoMaterno,p.tutorNombres,p.tutorTelefono,account?.email].join(' ').toLowerCase();
  if(query&&!text.includes(query))return false;
  if(status==='COMPLETO'&&!row.complete)return false;if(status==='PENDIENTE'&&row.complete)return false;
  if(status==='SIN_CUENTA'&&account)return false;if(status==='ACTIVA'&&(!account||!account.active))return false;if(status==='BLOQUEADA'&&(!account||account.active))return false;
  if(status==='INVITACION'&&invitation?.status!=='PENDIENTE')return false;if(status==='VENCIDA'&&invitation?.status!=='VENCIDA')return false;
  return true;
}
function renderDirectory(){
  if(!state.directory)return;const rows=state.directory.rows||[],query=$('#directorySearch').value.trim().toLowerCase(),status=$('#directoryStatus').value;
  const filtered=query.length>=2?rows.filter(row=>directoryRowMatches(row,query,status)):[];
  const complete=rows.filter(row=>row.complete).length,accounts=rows.filter(row=>row.account).length,pendingInvites=rows.filter(row=>row.invitation?.status==='PENDIENTE').length;
  $('#directoryStats').innerHTML=[['Alumnos',rows.length],['Fichas completas',complete],['Cuentas familiares',accounts],['Invitaciones vigentes',pendingInvites]].map(([label,value])=>`<div class="stat"><b>${value}</b><span>${escapeHtml(label)}</span></div>`).join('');
  $('#directoryList').innerHTML=query.length<2?'<div class="panel empty-history"><strong>Busca un alumno</strong><p>Escribe por lo menos dos letras del apellido o nombre; la lista no se muestra completa.</p></div>':filtered.length?filtered.map(directoryAdminCard).join(''):'<div class="panel empty-history"><strong>No hay resultados</strong><p>Cambia la búsqueda o el filtro.</p></div>';
}
function directoryAdminCard(row){
  const p=row.profile||{},account=row.account,invite=row.invitation;const tutor=[p.tutorApellidoPaterno,p.tutorApellidoMaterno,p.tutorNombres].filter(Boolean).join(' ')||'Tutor sin registrar';
  const accountBadge=account?`<span class="directory-state ${account.active?'success':'danger'}">${account.active?'Cuenta activa':'Cuenta bloqueada'}</span>`:`<span class="directory-state muted-state">Sin cuenta</span>`;
  const formBadge=`<span class="directory-state ${row.complete?'success':'warning'}">${row.complete?'Ficha completa':'Ficha pendiente'}</span>`;
  const inviteText=invite?invite.status==='PENDIENTE'?`Invitación vigente hasta ${escapeHtml(new Date(invite.expiresAt).toLocaleString('es-MX'))}`:`Invitación ${escapeHtml(invite.status.toLowerCase())}`:'Sin invitación';
  const accessActions=account?`<button class="btn small" data-action="generate-family-reset" data-id="${row.student.id}">Restablecer acceso</button><button class="btn small" data-action="toggle-family-account" data-id="${row.student.id}" data-active="${!account.active}">${account.active?'Bloquear cuenta':'Desbloquear cuenta'}</button>`:`<button class="btn primary small" data-action="generate-family-invite" data-id="${row.student.id}">Generar invitación</button>${invite?.status==='PENDIENTE'?`<button class="btn small" data-action="revoke-family-invite" data-id="${row.student.id}">Cancelar invitación</button>`:''}`;
  return `<article class="directory-card"><div class="directory-card-main"><div class="directory-card-number">${escapeHtml(row.student.apellidoPaterno?.slice(0,1)||'A')}</div><div><h3>${escapeHtml(row.student.name)}</h3><p>${escapeHtml(tutor)}${p.tutorTelefono?' · '+escapeHtml(p.tutorTelefono):''}</p><small>${escapeHtml(inviteText)}</small></div></div><div class="directory-badges">${formBadge}${accountBadge}</div><div class="directory-actions"><button class="btn small" data-action="view-directory" data-id="${row.student.id}">Ver información</button><button class="btn small" data-action="edit-directory" data-id="${row.student.id}">Editar información</button><button class="btn small" data-action="print-directory-profile" data-id="${row.student.id}">Imprimir ficha</button>${accessActions}<button class="btn danger small" data-action="delete-family-access" data-id="${row.student.id}">Borrar datos familiares</button><button class="btn danger small" data-action="directory-delete-student" data-id="${row.student.id}">Eliminar alumno</button></div></article>`;
}
function directoryOption(value,current){return `<option ${String(value)===String(current)?'selected':''}>${escapeHtml(value)}</option>`}
function directoryFieldsHtml(data,family=false){
  const p=data.profile||{},contacts=data.contacts||[];const contact=(index)=>{const c=contacts[index]||{};return `<fieldset class="directory-contact"><legend>Persona de confianza ${index+1}${index?' (opcional)':''}</legend><input type="hidden" name="contact${index}Id" value="${escapeHtml(c.id||'')}"><div class="form-grid three"><label>Apellido paterno<input name="contact${index}ApellidoPaterno" value="${escapeHtml(c.apellidoPaterno||'')}"></label><label>Apellido materno<input name="contact${index}ApellidoMaterno" value="${escapeHtml(c.apellidoMaterno||'')}"></label><label>Nombre(s)<input name="contact${index}Nombres" value="${escapeHtml(c.nombres||'')}"></label></div><div class="form-grid two"><label>Parentesco<input name="contact${index}Parentesco" value="${escapeHtml(c.parentesco||'')}"></label><label>Teléfono<input name="contact${index}Telefono" inputmode="tel" value="${escapeHtml(c.telefono||'')}"></label></div></fieldset>`};
  return `<div class="directory-student-banner"><span>Datos del alumno</span><div class="form-grid three"><label>Apellido paterno<input name="alumnoApellidoPaterno" value="${escapeHtml(p.alumnoApellidoPaterno||'')}" required></label><label>Apellido materno<input name="alumnoApellidoMaterno" value="${escapeHtml(p.alumnoApellidoMaterno||'')}"></label><label>Nombre(s)<input name="alumnoNombres" value="${escapeHtml(p.alumnoNombres||'')}" required></label></div><small>Las correcciones se aplican al directorio; la lista académica conserva el nombre oficial.</small></div><h3>Tutor principal</h3><div class="form-grid three"><label>Apellido paterno<input name="tutorApellidoPaterno" value="${escapeHtml(p.tutorApellidoPaterno||'')}" required></label><label>Apellido materno<input name="tutorApellidoMaterno" value="${escapeHtml(p.tutorApellidoMaterno||'')}"></label><label>Nombre(s)<input name="tutorNombres" value="${escapeHtml(p.tutorNombres||'')}" required></label></div><div class="form-grid three"><label>Parentesco<select name="tutorParentesco" required><option value="">Selecciona</option>${['Madre','Padre','Abuela','Abuelo','Hermana','Hermano','Tutora','Tutor','Otro'].map(value=>directoryOption(value,p.tutorParentesco)).join('')}</select></label><label>Teléfono principal<input name="tutorTelefono" inputmode="tel" value="${escapeHtml(p.tutorTelefono||'')}" required></label><label>Teléfono alterno<input name="tutorTelefonoAlterno" inputmode="tel" value="${escapeHtml(p.tutorTelefonoAlterno||'')}"></label></div><h3>Domicilio</h3><div class="form-grid three"><label>Calle<input name="calle" value="${escapeHtml(p.calle||'')}"></label><label>Número exterior<input name="numeroExterior" value="${escapeHtml(p.numeroExterior||'')}"></label><label>Número interior<input name="numeroInterior" value="${escapeHtml(p.numeroInterior||'')}"></label></div><div class="form-grid three"><label>Entre calles<input name="entreCalles" value="${escapeHtml(p.entreCalles||'')}"></label><label>Fraccionamiento o colonia<input name="colonia" value="${escapeHtml(p.colonia||'')}"></label><label>Región o Supermanzana<input name="region" value="${escapeHtml(p.region||'')}"></label></div><div class="form-grid two"><label>Código postal<input name="codigoPostal" inputmode="numeric" value="${escapeHtml(p.codigoPostal||'')}"></label><label>Referencias del domicilio<input name="referencias" value="${escapeHtml(p.referencias||'')}"></label></div><h3>Personas autorizadas o de confianza</h3>${contact(0)+contact(1)+contact(2)}${family?'<div class="family-save"><button class="btn primary" type="submit">Guardar información</button></div>':''}`;
}
function directoryPayloadFromForm(form){const data=formData(form);data.contacts=[0,1,2].map(index=>({id:data[`contact${index}Id`]||'',apellidoPaterno:data[`contact${index}ApellidoPaterno`]||'',apellidoMaterno:data[`contact${index}ApellidoMaterno`]||'',nombres:data[`contact${index}Nombres`]||'',parentesco:data[`contact${index}Parentesco`]||'',telefono:data[`contact${index}Telefono`]||''}));return data}
function openDirectoryForm(studentId){const row=state.directory?.rows.find(item=>String(item.student.id)===String(studentId));if(!row)return;const form=$('#directoryForm');form.elements.studentId.value=row.student.id;$('#directoryDialogTitle').textContent=row.student.name;$('#directoryFormFields').innerHTML=directoryFieldsHtml(row);$('#directoryDialog').showModal()}
function viewDirectoryProfile(studentId){const row=state.directory?.rows.find(item=>String(item.student.id)===String(studentId));if(!row)return;$('#directoryViewTitle').textContent=row.student.name;$('#directoryViewContent').innerHTML=directoryProfilePrintHtml(row);$('#directoryViewDialog').showModal()}
async function saveDirectoryForm(e){e.preventDefault();const payload=directoryPayloadFromForm(e.currentTarget);await runAction(async()=>{const result=await server('saveDirectoryProfile',payload);$('#directoryDialog').close();const index=state.directory.rows.findIndex(row=>String(row.student.id)===String(payload.studentId));if(index>=0){const old=state.directory.rows[index],data=result.data;state.directory.rows[index]=Object.assign({},old,{student:{id:old.student.id,name:[data.profile.alumnoApellidoPaterno,data.profile.alumnoApellidoMaterno,data.profile.alumnoNombres].filter(Boolean).join(' '),apellidoPaterno:data.profile.alumnoApellidoPaterno,apellidoMaterno:data.profile.alumnoApellidoMaterno,nombres:data.profile.alumnoNombres},profile:data.profile,contacts:data.contacts,complete:data.complete})}renderDirectory();renderDirectoryBuilder();toast(result.message)})}
async function generateGroupFamilyInvitation(){await runAction(async()=>{const result=await server('generateGroupInvitation');showDirectoryLink('Invitación grupal','Un solo enlace para las familias. Vence en 36 horas; cada familia debe confirmar los últimos cuatro dígitos del teléfono.',siteBaseUrl()+'?grupo='+encodeURIComponent(result.token));if(state.directory)state.directory.groupInvitation={expiresAt:result.expiresAt}})}
async function generateFamilyInvitation(studentId){await runAction(async()=>{const result=await server('generateFamilyInvitation',studentId);const link=siteBaseUrl()+'?familia='+encodeURIComponent(result.token);showDirectoryLink('Invitación familiar',result.studentName+' · El enlace vence en 36 horas y solo puede utilizarse una vez.',link);state.directory=await server('getDirectoryAdminData');renderDirectory()})}
async function revokeFamilyInvitation(studentId){if(!confirm('¿Cancelar la invitación vigente?'))return;await runAction(async()=>{const result=await server('revokeFamilyInvitation',studentId);state.directory=await server('getDirectoryAdminData');renderDirectory();toast(result.message)})}
async function generateFamilyReset(studentId){await runAction(async()=>{const result=await server('generateFamilyReset',studentId);showDirectoryLink('Restablecer contraseña','El enlace vence en 30 minutos y solo puede utilizarse una vez.',siteBaseUrl()+'?recuperar='+encodeURIComponent(result.token))})}
function showDirectoryLink(title,description,link){$('#directoryLinkTitle').textContent=title;$('#directoryLinkDescription').textContent=description;$('#directoryLinkValue').value=link;$('#directoryLinkDialog').showModal()}
async function copyDirectoryLink(){const input=$('#directoryLinkValue');try{await navigator.clipboard.writeText(input.value);toast('Enlace copiado.')}catch(e){input.select();document.execCommand('copy');toast('Enlace copiado.')}}
async function setFamilyAccountActive(studentId,active){if(!confirm(active?'¿Desbloquear esta cuenta familiar?':'¿Bloquear esta cuenta familiar?'))return;await runAction(async()=>{const result=await server('setFamilyAccountActive',studentId,active);state.directory=await server('getDirectoryAdminData');renderDirectory();toast(result.message)})}
async function deleteFamilyAccess(studentId){if(!confirm('¿Borrar la cuenta y toda la ficha familiar? El alumno permanecerá en el grupo.'))return;await runAction(async()=>{const result=await server('deleteFamilyAccess',studentId);state.directory=await server('getDirectoryAdminData');renderDirectory();renderDirectoryBuilder();toast(result.message)})}
async function deleteDirectoryStudent(studentId){if(!confirm('¿Eliminar definitivamente al alumno, su directorio, asistencia y evaluaciones? Esta acción no se puede deshacer.'))return;await runAction(async()=>{const result=await server('deleteStudent',studentId);Object.assign(state,await server('getBootstrapData'));state.directory=await server('getDirectoryAdminData');renderAll();renderDirectory();renderDirectoryBuilder();showView('directory');toast(result.message)})}
function toggleDirectoryReport(){$('#directoryReportBuilder').classList.toggle('hidden-control')}
function renderDirectoryBuilder(){if(!state.directory)return;$('#directoryStudentChecks').innerHTML=state.directory.rows.map(row=>`<label><input type="checkbox" data-directory-student value="${row.student.id}" checked> ${escapeHtml(row.student.name)}</label>`).join('')}
function setDirectorySelection(checked){$$('[data-directory-student]').forEach(input=>input.checked=checked)}
function directoryAddress(profile){return [profile.calle,profile.numeroExterior&&'Núm. '+profile.numeroExterior,profile.numeroInterior&&'Int. '+profile.numeroInterior,profile.entreCalles&&'entre '+profile.entreCalles,profile.colonia,profile.region&&'Región/SM '+profile.region,profile.codigoPostal&&'C.P. '+profile.codigoPostal,profile.referencias].filter(Boolean).join(', ')}
function directoryContactValue(contact){return contact?[[contact.apellidoPaterno,contact.apellidoMaterno,contact.nombres].filter(Boolean).join(' '),contact.parentesco,contact.telefono].filter(Boolean).join(' · '):'—'}
function selectedDirectoryRows(){const selected=new Set($$('[data-directory-student]:checked').map(input=>input.value));return (state.directory?.rows||[]).filter(row=>selected.has(String(row.student.id)))}
function selectedDirectoryFields(){return new Set($$('#directoryFieldChecks input:checked').map(input=>input.value))}
function directoryReportHtml(rows,fields){
  const columns=[];if(fields.has('student'))columns.push(['Alumno',row=>row.student.name]);if(fields.has('tutor'))columns.push(['Tutor',row=>[row.profile.tutorApellidoPaterno,row.profile.tutorApellidoMaterno,row.profile.tutorNombres].filter(Boolean).join(' ')||'—']);if(fields.has('relation'))columns.push(['Parentesco',row=>row.profile.tutorParentesco||'—']);if(fields.has('phone'))columns.push(['Teléfono',row=>row.profile.tutorTelefono||'—']);if(fields.has('alternatePhone'))columns.push(['Teléfono alterno',row=>row.profile.tutorTelefonoAlterno||'—']);if(fields.has('address'))columns.push(['Domicilio',row=>directoryAddress(row.profile)||'—']);[1,2,3].forEach(number=>{if(fields.has('contact'+number))columns.push(['Persona de confianza '+number,row=>directoryContactValue(row.contacts[number-1])])});
  if(!columns.length)return '<p>Selecciona por lo menos un dato.</p>';return `<div class="directory-print-head"><h1>Directorio familiar 4°A</h1><p>Escuela Primaria Francisco Hoil Torres T.V. · Ciclo 2026-2027</p></div><table class="directory-print-table"><thead><tr><th>Núm.</th>${columns.map(column=>`<th>${escapeHtml(column[0])}</th>`).join('')}</tr></thead><tbody>${rows.map((row,index)=>`<tr><td>${index+1}</td>${columns.map(column=>`<td>${escapeHtml(column[1](row))}</td>`).join('')}</tr>`).join('')}</tbody></table>`
}
function previewDirectoryReport(){const rows=selectedDirectoryRows();if(!rows.length)return toast('Selecciona por lo menos un alumno.',true);const preview=$('#directoryReportPreview');preview.innerHTML=directoryReportHtml(rows,selectedDirectoryFields());preview.classList.remove('hidden-control');preview.scrollIntoView({behavior:'smooth'})}
function printHtmlDocument(content,orientation='portrait'){const popup=window.open('','_blank');if(!popup)return toast('Permite las ventanas emergentes para imprimir.',true);popup.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Carpeta Académica</title><style>@page{size:letter ${orientation};margin:10mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#102a43;font-size:9px;margin:0}h1{font-size:18px;margin:0 0 3px}h2{font-size:13px;margin:8px 0}p{margin:0 0 10px;color:#65798b}table{border-collapse:collapse;width:100%}th,td{border:1px solid #9fb1bd;padding:4px;vertical-align:top}th{background:#0b315d;color:#fff}.profile-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.profile-box{border:1px solid #c6d4dd;border-radius:8px;padding:10px}.profile-box h2{font-size:13px;margin:0 0 6px}.profile-box p{margin:3px 0;color:#102a43}.grade-print-page{break-after:page;page-break-after:always;min-height:185mm}.grade-print-page:last-child{break-after:auto;page-break-after:auto}.grade-print-head{border-bottom:2px solid #0b315d;margin-bottom:7px}.grade-foot{margin-top:6px;font-size:8px}.no-print{display:none!important}</style></head><body>${content}</body></html>`);popup.document.close();popup.focus();setTimeout(()=>popup.print(),400)}
function printDirectoryReport(){const rows=selectedDirectoryRows();if(!rows.length)return toast('Selecciona por lo menos un alumno.',true);printHtmlDocument(directoryReportHtml(rows,selectedDirectoryFields()),$('#directoryOrientation').value)}
function directoryProfilePrintHtml(row){const p=row.profile;const tutor=[p.tutorApellidoPaterno,p.tutorApellidoMaterno,p.tutorNombres].filter(Boolean).join(' ')||'Sin registrar';return `<h1>Ficha familiar</h1><p>${escapeHtml(row.student.name)} · 4°A · Ciclo 2026-2027</p><div class="profile-grid"><div class="profile-box"><h2>Tutor principal</h2><p><b>Nombre:</b> ${escapeHtml(tutor)}</p><p><b>Parentesco:</b> ${escapeHtml(p.tutorParentesco||'—')}</p><p><b>Teléfono:</b> ${escapeHtml(p.tutorTelefono||'—')}</p><p><b>Teléfono alterno:</b> ${escapeHtml(p.tutorTelefonoAlterno||'—')}</p></div><div class="profile-box"><h2>Domicilio</h2><p>${escapeHtml(directoryAddress(p)||'Sin registrar')}</p></div>${[0,1,2].map(index=>`<div class="profile-box"><h2>Persona de confianza ${index+1}</h2><p>${escapeHtml(directoryContactValue(row.contacts[index]))}</p></div>`).join('')}</div>`}
function printDirectoryProfile(studentId){const row=state.directory?.rows.find(item=>String(item.student.id)===String(studentId));if(row)printHtmlDocument(directoryProfilePrintHtml(row),'portrait')}

function showFamilyPanel(id){['familyInvitationPanel','familyGroupPanel','familyLoginPanel','familyForgotPanel','familyResetPanel','familyProfilePanel'].forEach(panel=>$('#'+panel).classList.toggle('hidden-control',panel!==id));$('#familyMessage').classList.add('hidden-control')}
function familyMessage(message,error=false){const box=$('#familyMessage');box.textContent=message;box.classList.remove('hidden-control');box.classList.toggle('family-error',error)}
async function startFamilyPortal(){document.body.classList.add('family-mode');$('#app').classList.add('hidden-control');$('#familyPortal').classList.remove('hidden-control');setLoading(false);try{if(familyResetToken){const result=await apiRequest('validateFamilyReset',[familyResetToken],'');$('#familyResetStudent').textContent='Cuenta de '+result.studentName;showFamilyPanel('familyResetPanel');return}if(familyGroupToken){await apiRequest('validateGroupInvitation',[familyGroupToken],'');showFamilyPanel('familyGroupPanel');return}if(familyInvitationToken&&familyInvitationToken!=='acceso'){const result=await apiRequest('validateFamilyInvitation',[familyInvitationToken],'');$('#familyInvitationStudent').textContent='Crearás el acceso para '+result.student.name+'. La invitación vence el '+new Date(result.expiresAt).toLocaleString('es-MX')+'.';showFamilyPanel('familyInvitationPanel');return}if(familySessionToken){await loadFamilyProfile();return}showFamilyPanel('familyLoginPanel')}catch(error){showFamilyPanel('familyLoginPanel');familyMessage(error.message,true)}}
let groupSearchTimer=0;function searchGroupStudents(){clearTimeout(groupSearchTimer);const query=$('#familyGroupSearch').value.trim();$('#familyGroupRegisterForm').classList.add('hidden-control');if(query.length<2){$('#familyGroupResults').innerHTML='';return}groupSearchTimer=setTimeout(async()=>{try{const rows=await apiRequest('searchGroupStudents',[familyGroupToken,query],'');$('#familyGroupResults').innerHTML=rows.length?rows.map(row=>`<button type="button" class="group-student-choice" data-action="select-group-student" data-id="${escapeHtml(row.id)}" data-name="${encodeURIComponent(row.name)}"><strong>${escapeHtml(row.name)}</strong><small>${row.hasPhone?'Teléfono registrado':'Requiere invitación individual'}</small></button>`).join(''):'<p class="muted">No hay coincidencias disponibles.</p>'}catch(error){familyMessage(error.message,true)}},350)}
function selectGroupStudent(id,name){const form=$('#familyGroupRegisterForm');form.elements.studentId.value=id;$('#familyGroupStudent').textContent='Cuenta para '+name;form.classList.remove('hidden-control');form.scrollIntoView({behavior:'smooth'})}
async function registerGroupFamilyAccount(e){e.preventDefault();const payload=formData(e.currentTarget);payload.groupToken=familyGroupToken;familyMessage('Creando la cuenta…');try{const result=await apiRequest('registerGroupFamilyAccount',[payload],'');familySessionToken=result.token;localStorage.setItem(FAMILY_SESSION_KEY,familySessionToken);familyGroupToken='';history.replaceState({},'',siteBaseUrl()+'?familia=acceso');await loadFamilyProfile()}catch(error){familyMessage(error.message,true)}}
async function registerFamilyAccount(e){e.preventDefault();const payload=formData(e.currentTarget);payload.invitationToken=familyInvitationToken;familyMessage('Creando la cuenta…');try{const result=await apiRequest('registerFamilyAccount',[payload],'');familySessionToken=result.token;localStorage.setItem(FAMILY_SESSION_KEY,familySessionToken);familyInvitationToken='';history.replaceState({},'',siteBaseUrl()+'?familia=acceso');await loadFamilyProfile()}catch(error){familyMessage(error.message,true)}}
async function familyLogin(e){e.preventDefault();const data=formData(e.currentTarget);familyMessage('Comprobando el acceso…');try{const result=await apiRequest('familyLogin',[data.email,data.password],'');familySessionToken=result.token;localStorage.setItem(FAMILY_SESSION_KEY,familySessionToken);await loadFamilyProfile()}catch(error){familyMessage(error.message,true)}}
async function requestFamilyReset(e){e.preventDefault();const data=formData(e.currentTarget);familyMessage('Enviando el enlace…');try{const result=await apiRequest('requestFamilyPasswordReset',[data.email],'');familyMessage(result.message);showFamilyPanel('familyLoginPanel');familyMessage(result.message)}catch(error){familyMessage(error.message,true)}}
async function saveFamilyReset(e){e.preventDefault();const payload=formData(e.currentTarget);payload.resetToken=familyResetToken;familyMessage('Guardando la contraseña…');try{const result=await apiRequest('resetFamilyPassword',[payload],'');familyResetToken='';history.replaceState({},'',siteBaseUrl()+'?familia=acceso');showFamilyPanel('familyLoginPanel');familyMessage(result.message)}catch(error){familyMessage(error.message,true)}}
async function loadFamilyProfile(){try{const data=await familyServer('getFamilyProfile');$('#familyProfileStudent').textContent=data.student.name;$('#familyProfileForm').innerHTML=directoryFieldsHtml(data,true);showFamilyPanel('familyProfilePanel')}catch(error){familySessionToken='';localStorage.removeItem(FAMILY_SESSION_KEY);showFamilyPanel('familyLoginPanel');familyMessage(error.message,true)}}
async function saveFamilyProfile(e){e.preventDefault();familyMessage('Guardando la información…');try{const result=await familyServer('saveFamilyProfile',directoryPayloadFromForm(e.currentTarget));familyMessage(result.message);await loadFamilyProfile();familyMessage(result.message)}catch(error){familyMessage(error.message,true)}}
function familyLogout(){familySessionToken='';localStorage.removeItem(FAMILY_SESSION_KEY);location.href=siteBaseUrl()+'?familia=acceso'}
function paymentMoney(value){return new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(Number(value)||0)}
function openPayments(){showView('payments');if(state.paymentsInitial&&Date.now()-state.paymentsLoadedAt<120000){renderPaymentsHome();return}loadPayments()}
async function loadPayments(){
  $('#paymentsHome').classList.remove('hidden-control');$('#paymentEventDetail').classList.add('hidden-control');
  $('#paymentLinkStatus').textContent='Consultando la hoja de Control de pagos…';setLoading(true);
  try{state.paymentsInitial=await server('getPaymentsInitialData');state.paymentsLoadedAt=Date.now();renderPaymentsHome()}
  catch(e){$('#paymentLinkStatus').innerHTML='<strong>Falta vincular la hoja de pagos.</strong> En tu Google Sheets abre Carpeta Académica → Vincular hoja de Control de pagos y pega la dirección de la hoja que contiene las pestañas Alumnos, Eventos, Participantes, Pagos, Cortes de dinero y Retiros y reposiciones.';if(isSessionError(e.message)){sessionToken='';localStorage.removeItem(SESSION_KEY);showLogin(e.message)}else toast(e.message,true)}
  finally{setLoading(false)}
}
function renderPaymentsHome(){
  const data=state.paymentsInitial;if(!data){$('#paymentLinkStatus').textContent='Abre este módulo para consultar el Control de pagos vinculado.';return}
  $('#paymentLinkStatus').innerHTML='<strong>Control de pagos integrado.</strong> Los movimientos se guardan directamente en tu hoja de cálculo de pagos.';
  const active=data.events||[],archived=data.archivedEvents||[],students=data.students||[];
  $('#paymentOverview').innerHTML=[['Eventos activos',active.length],['Archivados',archived.length],['Alumnos en pagos',students.length],['Cobro potencial',paymentMoney(active.reduce((sum,event)=>sum+event.charge*students.length,0))]].map(([label,value])=>`<div class="stat"><b>${escapeHtml(value)}</b><span>${escapeHtml(label)}</span></div>`).join('');
  $('#paymentEventCount').textContent=`${active.length} ${active.length===1?'evento':'eventos'}`;
  $('#paymentEventsGrid').innerHTML=active.length?active.map(paymentEventCard).join(''):'<div class="empty-history"><strong>No hay eventos activos</strong><p>Crea el primero para registrar pagos del grupo.</p></div>';
  $('#paymentArchivedGrid').innerHTML=archived.length?archived.map(paymentEventCard).join(''):'<p class="muted">No hay eventos archivados.</p>';
}
function paymentEventCard(event){
  const action=event.active?`<button class="btn danger" data-action="archive-payment-event" data-id="${escapeHtml(event.id)}">Archivar</button>`:`<button class="btn" data-action="reactivate-payment-event" data-id="${escapeHtml(event.id)}">Reactivar</button>`;
  return `<article class="payment-event-card"><div><span class="badge">${event.active?'Activo':'Archivado'}</span><h3>${escapeHtml(event.name)}</h3><p>${escapeHtml(formatDateShort(event.date))}${event.time?' · '+escapeHtml(formatTime(event.time)):''}</p></div><div class="payment-values"><span>Cobro <b>${paymentMoney(event.charge)}</b></span><span>Entrega <b>${paymentMoney(event.delivery)}</b></span><span>Margen <b>${paymentMoney(event.margin)}</b></span></div><div class="button-row"><button class="btn primary" data-action="open-payment-event" data-id="${escapeHtml(event.id)}">Abrir</button>${action}</div></article>`
}
function togglePaymentEventForm(){
  const panel=$('#paymentEventFormPanel'),opening=panel.classList.contains('hidden-control');panel.classList.toggle('hidden-control');
  if(opening){const form=$('#paymentEventForm');form.reset();form.elements.date.value=todayCancun();form.elements.time.value='13:00';form.elements.delivery.value='0';form.elements.name.focus()}
}
async function createPaymentEvent(e){e.preventDefault();const payload=formData(e.currentTarget);await runAction(async()=>{const result=await server('createPaymentEvent',payload);$('#paymentEventFormPanel').classList.add('hidden-control');state.paymentsInitial=await server('getPaymentsInitialData');renderPaymentsHome();toast(result.message);await openPaymentEvent(result.eventId)})}
async function openPaymentEvent(eventId){await runAction(async()=>{state.paymentDetail=await server('getPaymentEventDetail',eventId);renderPaymentDetail();$('#paymentsHome').classList.add('hidden-control');$('#paymentEventDetail').classList.remove('hidden-control');window.scrollTo(0,0)})}
function backPaymentEvents(){state.paymentDetail=null;$('#paymentEventDetail').classList.add('hidden-control');$('#paymentsHome').classList.remove('hidden-control');renderPaymentsHome();window.scrollTo(0,0)}
function renderPaymentDetail(){
  const detail=state.paymentDetail;if(!detail)return;const event=detail.event,summary=detail.summary;
  $('#paymentDetailTitle').textContent=event.name;$('#paymentDetailMeta').textContent=[event.description,formatDateShort(event.date),formatTime(event.time),`Cobro ${paymentMoney(event.charge)} por alumno`].filter(Boolean).join(' · ');
  const archiveButton=$('[data-action="archive-current-payment-event"]');archiveButton.classList.toggle('hidden-control',!event.active);
  $('#paymentDetailStats').innerHTML=[['Pagaron',summary.paidCount],['Abonaron',summary.partialCount],['Pendientes',summary.pendingCount],['Efectivo disponible',paymentMoney(summary.cashAvailable)]].map(([label,value])=>`<div class="stat"><b>${escapeHtml(value)}</b><span>${escapeHtml(label)}</span></div>`).join('');
  const today=todayCancun();$('#paymentCutForm').elements.date.value=today;$('#paymentMovementForm').elements.date.value=today;
  renderPaymentStudents();renderPaymentLedgers();renderPaymentFinancial();
}
function renderPaymentStudents(){
  const detail=state.paymentDetail;if(!detail)return;const query=$('#paymentStudentSearch').value.trim().toLowerCase(),filter=$('#paymentStudentFilter').value;
  const students=detail.students.filter(student=>(filter==='TODOS'||student.status===filter)&&student.name.toLowerCase().includes(query));
  $('#paymentStudentList').innerHTML=students.length?students.map((student,index)=>`<article class="payment-student-row"><span class="payment-student-number">${index+1}</span><div><strong>${escapeHtml(student.name)}</strong><p>Pagado: ${paymentMoney(student.paid)} · Falta: ${paymentMoney(student.remaining)}</p></div><span class="payment-status ${student.status.toLowerCase()}">${student.status==='PAGADO'?'Pagado':student.status==='ABONO'?'Abono':'Pendiente'}</span><div class="payment-row-actions">${student.remaining>0?`<button class="btn small" data-action="payment-abono" data-id="${escapeHtml(student.id)}">Abono</button><button class="btn primary small" data-action="payment-total" data-id="${escapeHtml(student.id)}">Pagar total</button>`:'<span class="paid-check">✓ Liquidado</span>'}</div></article>`).join(''):'<div class="empty-history"><strong>Sin resultados</strong><p>Cambia el filtro o la búsqueda.</p></div>';
}
function openStudentPayment(studentId,type){
  const student=state.paymentDetail?.students.find(item=>String(item.id)===String(studentId));if(!student)return;
  const form=$('#studentPaymentForm');form.reset();form.elements.studentId.value=student.id;form.elements.type.value=type;form.elements.date.value=todayCancun();
  $('#paymentDialogTitle').textContent=type==='TOTAL'?'Registrar pago completo':'Registrar abono';$('#paymentDialogStudent').textContent=student.name;$('#paymentDialogBalance').textContent=`Pagado: ${paymentMoney(student.paid)} · Saldo pendiente: ${paymentMoney(student.remaining)}`;
  $('#paymentAmountField').classList.toggle('hidden-control',type==='TOTAL');form.elements.amount.required=type!=='TOTAL';if(type!=='TOTAL')form.elements.amount.max=student.remaining;
  $('#paymentDialog').showModal();
}
async function saveStudentPayment(e){e.preventDefault();const payload=formData(e.currentTarget);payload.eventId=state.paymentDetail.event.id;await runAction(async()=>{const result=await server('saveStudentPayment',payload);state.paymentDetail=result.detail;$('#paymentDialog').close();renderPaymentDetail();toast(result.message)})}
async function savePaymentCut(e){e.preventDefault();const payload=formData(e.currentTarget);payload.eventId=state.paymentDetail.event.id;if(!confirm(`¿Registrar un corte por ${paymentMoney(payload.amount)}?`))return;await runAction(async()=>{const result=await server('savePaymentCut',payload);state.paymentDetail=result.detail;e.currentTarget.reset();renderPaymentDetail();toast(result.message)})}
async function savePaymentMovement(e){e.preventDefault();const payload=formData(e.currentTarget);payload.eventId=state.paymentDetail.event.id;if(!confirm(`¿Registrar ${payload.type.toLowerCase()} por ${paymentMoney(payload.amount)}?`))return;await runAction(async()=>{const result=await server('savePaymentMovement',payload);state.paymentDetail=result.detail;e.currentTarget.reset();renderPaymentDetail();toast(result.message)})}
function renderPaymentLedgers(){
  const detail=state.paymentDetail;const ledger=(rows,kind)=>rows.length?rows.slice().reverse().map(item=>`<div class="payment-ledger-row"><div><strong>${kind==='cut'?'Corte':item.type==='RETIRO'?'Retiro':'Reposición'}</strong><small>${escapeHtml(formatDateShort(item.date))}${item.description?' · '+escapeHtml(item.description):''}</small></div><b>${paymentMoney(item.amount)}</b></div>`).join(''):'<p class="muted">Sin movimientos.</p>';
  $('#paymentCutsList').innerHTML=ledger(detail.cuts,'cut');$('#paymentMovementsList').innerHTML=ledger(detail.movements,'movement');
  $('#paymentHistoryList').innerHTML=detail.payments.length?detail.payments.slice().reverse().map(item=>`<div class="payment-ledger-row"><div><strong>${escapeHtml(item.studentName)}</strong><small>${escapeHtml(item.type)} · ${escapeHtml(formatDateShort(item.date))}${item.note?' · '+escapeHtml(item.note):''}</small></div><b>${paymentMoney(item.amount)}</b></div>`).join(''):'<p class="muted">Todavía no hay pagos registrados.</p>';
}
function renderPaymentFinancial(){const s=state.paymentDetail.summary;const rows=[['Total esperado',s.expectedTotal],['Cobrado',s.collected],['Saldo por cobrar',s.outstanding],['Entrega esperada',s.expectedDelivery],['Margen esperado',s.expectedMargin],['Entrega acumulada',s.accruedDelivery],['Margen acumulado',s.accruedMargin],['Cortes entregados',s.cutsTotal],['Deuda por retiros',s.debt],['Efectivo disponible',s.cashAvailable]];$('#paymentFinancialSummary').innerHTML=rows.map(([label,value])=>`<div class="payment-money-box"><span>${escapeHtml(label)}</span><b>${paymentMoney(value)}</b></div>`).join('')}
function openGrades(){showView('grades');loadGrades(false)}
async function loadGrades(force=false){if(state.grades&&!force){renderGradeOptions();return}await runAction(async()=>{state.grades=await server('getGradesInitialData');renderGradeOptions()})}
function renderGradeOptions(){const select=$('#gradeSubject');const current=select.value;select.innerHTML='<option value="">Selecciona</option>'+state.grades.subjects.map(s=>`<option>${escapeHtml(s.nombre)}</option>`).join('');if([...select.options].some(o=>o.value===current))select.value=current}
async function loadGradeWeights(){const trimester=$('#gradeTrimester').value,subject=$('#gradeSubject').value;if(!subject)return toast('Selecciona un campo formativo.',true);await runAction(async()=>{state.gradeWeights=await server('getGradeWeights',trimester,subject);renderGradeWeights();$('#gradeWeightsPanel').classList.remove('hidden-control')})}
function renderGradeWeights(){const host=$('#gradeWeightsList');host.innerHTML='';state.gradeWeights.forEach(addGradeCriterion);updateGradeWeightTotal()}
function addGradeCriterion(row={}){const automatic=['Tareas','Asistencia','Participación','Conducta','Puntualidad'];const wrapper=document.createElement('div');wrapper.className='grade-weight-row';wrapper.dataset.id=row.id||'';wrapper.innerHTML=`<input class="input" data-grade-name value="${escapeHtml(row.criterio||'')}" placeholder="Nombre del criterio"><select data-grade-type><option value="MANUAL">Captura manual</option><option value="AUTOMATICO">Cálculo automático</option></select><input data-grade-percent type="number" min="0" max="100" step="0.5" value="${row.porcentaje??0}"><span>%</span><button type="button" class="btn danger small" data-action="remove-grade-criterion">Quitar</button>`;wrapper.querySelector('[data-grade-type]').value=row.tipo||(automatic.includes(row.criterio)?'AUTOMATICO':'MANUAL');$('#gradeWeightsList').appendChild(wrapper);updateGradeWeightTotal()}
function updateGradeWeightTotal(){const total=$$('[data-grade-percent]').reduce((sum,input)=>sum+Number(input.value||0),0);const badge=$('#gradeWeightTotal');badge.textContent=total+'%';badge.classList.toggle('danger-state',Math.abs(total-100)>.001)}
function collectGradeWeights(){return $$('.grade-weight-row').map(row=>({id:row.dataset.id||'',criterio:row.querySelector('[data-grade-name]').value.trim(),tipo:row.querySelector('[data-grade-type]').value,porcentaje:Number(row.querySelector('[data-grade-percent]').value||0)}))}
async function saveGradeWeights(){const payload={trimester:Number($('#gradeTrimester').value),subject:$('#gradeSubject').value,criteria:collectGradeWeights()};await runAction(async()=>{const result=await server('saveGradeWeights',payload);state.gradeWeights=result.weights;renderGradeWeights();toast(result.message)})}
async function generateGradeReport(){const trimester=$('#gradeTrimester').value,subject=$('#gradeSubject').value;if(!subject)return toast('Selecciona un campo formativo.',true);await runAction(async()=>{state.gradeReport=await server('getQuarterlyGradeReport',trimester,subject);state.gradeWeights=state.gradeReport.weights;renderGradeWeights();renderManualGrades();$('#gradeWeightsPanel').classList.remove('hidden-control');$('#manualGradesPanel').classList.remove('hidden-control');$('#gradeReportPanel').classList.remove('grade-report-empty');$('#gradeReportPanel').innerHTML=gradeReportHtml(state.gradeReport,true)})}
function renderManualGrades(){const report=state.gradeReport;if(!report)return;const manual=report.weights.filter(w=>String(w.tipo).toUpperCase()!=='AUTOMATICO');$('#manualGradesPanel').classList.toggle('hidden-control',!manual.length);$('#manualGradesTable').innerHTML=manual.length?`<table><thead><tr><th>Alumno</th>${manual.map(w=>`<th>${escapeHtml(w.criterio)}</th>`).join('')}</tr></thead><tbody>${report.rows.map(row=>`<tr><td>${escapeHtml(row.name)}</td>${manual.map(w=>`<td><input type="number" min="0" max="10" step="0.1" data-manual-grade data-student="${escapeHtml(row.studentId)}" data-criterion="${escapeHtml(w.criterio)}" value="${row.scores[w.criterio]??''}"></td>`).join('')}</tr>`).join('')}</tbody></table>`:''}
async function saveManualGrades(){if(!state.gradeReport)return;const groups={};$$('[data-manual-grade]').forEach(input=>{(groups[input.dataset.criterion]||(groups[input.dataset.criterion]=[])).push({studentId:input.dataset.student,grade:input.value})});await runAction(async()=>{for(const criterion of Object.keys(groups))await server('saveManualGrades',{trimester:state.gradeReport.trimester,subject:state.gradeReport.subject,criterion,values:groups[criterion]});toast('Calificaciones manuales guardadas.');await generateGradeReport()})}
function chunks(array,size){const result=[];for(let i=0;i<array.length;i+=size)result.push(array.slice(i,i+size));return result}
function gradeHead(report,title){return `<header class="grade-print-head"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(report.config.escuela||'')} · ${escapeHtml(report.config.gradoGrupo||'')} · ${escapeHtml(report.config.cicloEscolar||'')} · Trimestre ${report.trimester}</p></header>`}
function gradeReportHtml(report,controls=false){const weightNames=report.weights.map(w=>w.criterio);let html=controls?'<div class="button-row no-print"><button class="btn primary" data-action="print-grade-report">Imprimir / guardar PDF tamaño carta</button></div>':'';chunks(report.rows,20).forEach((rows,page)=>{html+=`<section class="grade-print-page">${gradeHead(report,`Reporte trimestral · ${report.subject}`)}<h2>Calificaciones${page?' (continuación)':''}</h2><table><thead><tr><th>Núm.</th><th>Alumno</th>${weightNames.map(name=>`<th>${escapeHtml(name)}</th>`).join('')}<th>Final</th></tr></thead><tbody>${rows.map((row,index)=>`<tr><td>${page*20+index+1}</td><td>${escapeHtml(row.name)}</td>${weightNames.map(name=>`<td>${row.scores[name]==null?'—':Number(row.scores[name]).toFixed(1)}</td>`).join('')}<td><b>${row.final==null?'—':Number(row.final).toFixed(1)}</b></td></tr>`).join('')}</tbody></table><p class="grade-foot">Ponderaciones: ${report.weights.map(w=>`${escapeHtml(w.criterio)} ${w.porcentaje}%`).join(' · ')}</p></section>`});const activityChunks=chunks(report.activities,10);activityChunks.forEach((activities,activityPage)=>{chunks(report.rows,18).forEach((rows,studentPage)=>{html+=`<section class="grade-print-page">${gradeHead(report,`Tareas del trimestre · ${report.subject}`)}<h2>Actividades ${activities[0]?.code||'—'} a ${activities[activities.length-1]?.code||'—'}${studentPage?' · continuación':''}</h2><table><thead><tr><th>Núm.</th><th>Alumno</th>${activities.map(a=>`<th>${escapeHtml(a.code)}</th>`).join('')}</tr></thead><tbody>${rows.map((row,index)=>`<tr><td>${studentPage*18+index+1}</td><td>${escapeHtml(row.name)}</td>${activities.map(a=>`<td>${escapeHtml(row.taskMarks[report.activities.indexOf(a)]||'—')}</td>`).join('')}</tr>`).join('')}</tbody></table><p class="grade-foot">✓ Completa · I Incompleta · NR No realizó · F Falta · — Sin evaluación</p></section>`})});chunks(report.activities,12).forEach((activities,page)=>{html+=`<section class="grade-print-page">${gradeHead(report,`Catálogo de actividades · ${report.subject}`)}<h2>Detalle de actividades${page?' (continuación)':''}</h2><table><thead><tr><th>Clave</th><th>Fecha</th><th>Horario</th><th>Actividad</th><th>Proyecto</th></tr></thead><tbody>${activities.map(a=>`<tr><td>${escapeHtml(a.code)}</td><td>${escapeHtml(formatDateShort(a.date))}</td><td>${escapeHtml(formatTime(a.start))}–${escapeHtml(formatTime(a.end))}</td><td>${escapeHtml(a.name)}</td><td>${escapeHtml(a.project)}</td></tr>`).join('')}</tbody></table></section>`});return html}
function printGradeReport(){if(!state.gradeReport)return;printHtmlDocument(gradeReportHtml(state.gradeReport,false),'landscape')}
async function generateConsolidatedReport(){const trimester=$('#gradeTrimester').value;await runAction(async()=>{const report=await server('getConsolidatedGradeReport',trimester);const content=chunks(report.rows,20).map((rows,page)=>`<section class="grade-print-page"><header class="grade-print-head"><h1>Reporte general trimestral</h1><p>${escapeHtml(report.config.escuela||'')} · Trimestre ${report.trimester}</p></header><table><thead><tr><th>Núm.</th><th>Alumno</th>${report.subjects.map(s=>`<th>${escapeHtml(s)}</th>`).join('')}</tr></thead><tbody>${rows.map((row,index)=>`<tr><td>${page*20+index+1}</td><td>${escapeHtml(row.name)}</td>${row.grades.map(g=>`<td>${g==null?'—':Number(g).toFixed(1)}</td>`).join('')}</tr>`).join('')}</tbody></table></section>`).join('');printHtmlDocument(content,'landscape')})}
async function setPaymentEventActive(eventId,active){if(!confirm(active?'¿Reactivar este evento?':'¿Archivar este evento? Su historial se conservará.'))return;await runAction(async()=>{const result=await server('setPaymentEventActive',eventId,active);state.paymentsInitial=await server('getPaymentsInitialData');backPaymentEvents();toast(result.message)})}
async function syncPaymentStudents(){if(!confirm('¿Sincronizar la lista actual de alumnos con el Control de pagos? El historial anterior se conservará.'))return;await runAction(async()=>{const result=await server('syncPaymentStudents');state.paymentsInitial=result.initialData;renderPaymentsHome();toast(result.message)})}
function openStudent(s={}){const f=$('#studentForm');f.reset();Object.entries(s).forEach(([k,v])=>{if(f.elements[k])f.elements[k].value=v??''});$('#studentModalTitle').textContent=s.id?'Editar alumno':'Nuevo alumno';$('#studentDialog').showModal()}
function openProject(p={}){renderProjectSubjectOptions();const f=$('#projectForm');f.reset();Object.entries(p).forEach(([k,v])=>{if(!f.elements[k]||k==='ejes')return;if(f.elements[k].type==='checkbox')f.elements[k].checked=Boolean(v);else f.elements[k].value=v??''});const selected=new Set(String(p.ejes||'').split('|').map(x=>x.trim()).filter(Boolean));$$('input[name="ejes"]',f).forEach(input=>input.checked=selected.has(input.value));$('#projectDialog').showModal()}
function openSubjectForm(subject={}){const f=$('#subjectForm');f.reset();f.elements.id.value=subject.id||'';f.elements.nombre.value=subject.nombre||'';$('#subjectDialog').showModal()}
async function saveSubjectForm(e){e.preventDefault();const payload=formData(e.currentTarget);await runAction(async()=>{const result=await server('saveSubject',payload);const index=state.subjects.findIndex(x=>x.id===result.subject.id);if(index<0)state.subjects.push(result.subject);else state.subjects[index]=result.subject;$('#subjectDialog').close();renderSubjects();renderFields();renderClassOptions();renderProjectSubjectOptions();toast(result.message)})}
async function deleteSubject(id){if(!confirm('¿Eliminar este campo formativo? Solo será posible si no tiene proyectos ni actividades.'))return;await runAction(async()=>{const result=await server('deleteSubject',id);state.subjects=state.subjects.filter(x=>x.id!==id);renderSubjects();renderFields();renderClassOptions();renderProjectSubjectOptions();toast(result.message)})}
async function saveStudentForm(e){e.preventDefault();const payload=formData(e.target);await runAction(async()=>{const r=await server('saveStudent',payload);Object.assign(state,await server('getBootstrapData'));e.target.closest('dialog').close();renderAll();toast(r.temporaryPassword?`Alumno guardado. Usuario: ${r.student.tutorUsuario} · Contraseña inicial: ${r.temporaryPassword}`:'Alumno actualizado.')})}
async function saveProjectForm(e){e.preventDefault();const payload=formData(e.target);payload.ejes=$$('input[name="ejes"]:checked',e.target).map(input=>input.value).join(' | ');payload.sinProductoFinal=e.target.elements.sinProductoFinal.checked;await runAction(async()=>{const r=await server('saveProject',payload);const i=state.projects.findIndex(x=>x.id===r.project.id);if(i<0)state.projects.unshift(r.project);else state.projects[i]=r.project;state.stats.projects=state.projects.filter(x=>x.estado==='Activo').length;e.target.closest('dialog').close();renderAll();toast('Proyecto guardado correctamente.')})}
function formData(form){return Object.fromEntries(new FormData(form).entries())}
async function runAction(fn){setLoading(true);try{await fn()}catch(e){if(isSessionError(e.message)){sessionToken='';localStorage.removeItem(SESSION_KEY);showLogin(e.message)}else toast(e.message,true)}finally{setLoading(false)}}
function fullName(s){return s.nombreCompleto||[s.apellidoPaterno,s.apellidoMaterno,s.nombres].filter(Boolean).join(' ')}
function setLoading(v){$('#loading').classList.toggle('hidden',!v)}
function toast(msg,error=false){const t=$('#toast');t.textContent=msg;t.style.background=error?'#9f2d2d':'';t.classList.add('show');setTimeout(()=>t.classList.remove('show'),5000)}
function escapeHtml(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
