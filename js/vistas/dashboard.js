/* ==========================================================================
   MÓDULO DE VISTA: PANEL PRINCIPAL (DASHBOARD), PROYECTOS Y CAMPOS FORMATIVOS
   ========================================================================== */
function renderAll(){
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
  const form=$('#classForm');form.reset();form.elements.id.value='';form.elements.fecha.value=todayCancun();if(form.elements.horaInicio)form.elements.horaInicio.value='13:00';if(form.elements.horaFin)form.elements.horaFin.value='14:00';
  $('.class-data-panel',form)?.classList.remove('hidden-control');$('#classCompactSummary')?.classList.add('hidden-control');
  $('#classDraftStatus')?.classList.add('hidden-control');
  const selected=projectId||state.currentProject?.id||state.projects.find(p=>p.estado==='Activo')?.id||'';
  form.elements.proyectoId.value=selected;
  const project=state.projects.find(p=>String(p.id)===String(selected));
  if(project&&[...form.elements.materia.options].some(o=>o.value===project.campoFormativo))form.elements.materia.value=project.campoFormativo;
  state.classStudents=[];state.classEvaluations={};state.classAttendanceDay=null;
  let savedEvaluations={},restoredDraft=false;
  if(classId){
    await runAction(async()=>{
      const data=await server('getClassRecord',classId);Object.entries(data.classRecord).forEach(([key,value])=>{if(form.elements[key])form.elements[key].value=value??''});
      data.evaluations.forEach(row=>savedEvaluations[row.alumnoId]={alumnoId:row.alumnoId,trabajo:row.trabajo||'Completo',conducta:row.conducta||'Adecuada',participacion:row.participacion||'Media',desempeno:row.desempeno||'',observacionLibre:row.observacionLibre||'',instrumentResults:row.instrumentResults||{}});
    });
    const draft=readDraft(DRAFT_KEYS.classRecord);
    if(draft&&String(draft.data?.id||'')===String(classId)){
      restoreFormDraft(form,draft.data);savedEvaluations=draft.extra?.evaluations||savedEvaluations;restoredDraft=true;showDraftStatus('classDraftStatus',draft.updatedAt);
    }
  }else{const draft=readDraft(DRAFT_KEYS.classRecord);if(draft&&!draft.data?.id&&(!projectId||!draft.data?.proyectoId||String(draft.data.proyectoId)===String(projectId))){restoreFormDraft(form,draft.data);savedEvaluations=draft.extra?.evaluations||{};restoredDraft=true;showDraftStatus('classDraftStatus',draft.updatedAt)}}
  ensureRequestKey(form,'ACT',restoredDraft);
  $('#classFormTitle').textContent=classId?'Editar actividad':'Registrar actividad';
  await loadClassAttendance(savedEvaluations);
  showView('daily');
  if (classId) {
    if (typeof window.switchDailyMode === 'function') {
      window.switchDailyMode('single');
    }
  } else {
    // Si no es edición y no se ha especificado modo, mantener modo actual o jornada
    const singleWrap = document.getElementById('classForm');
    if (singleWrap && !singleWrap.classList.contains('hidden-control')) {
      // Usuario está en modo individual, no forzar cambio
    } else if (typeof window.openJornadaCapture === 'function') {
      window.openJornadaCapture();
    }
  }
  if(restoredDraft) toast('Se recuperó el borrador de la actividad.');
}
function defaultEvaluation(studentId){return {alumnoId:studentId,trabajo:'Completo',conducta:'Adecuada',participacion:'Media',desempeno:'',observacionLibre:''}}
