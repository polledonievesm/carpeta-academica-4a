/* ==========================================================================
   MÓDULO DE VISTA: REGISTRO DIARIO Y EVALUACIONES DE CLASE
   ========================================================================== */
async function loadClassAttendance(savedEvaluations=null){
  const date=$('#classDate').value;if(!date)return;
  await runAction(async()=>{
    state.classAttendanceDay=await server('getDayData',date);
    const existing=state.classAttendanceDay.existing||{};
    const registeredIds=Object.keys(existing);
    const presentIds=new Set();
    registeredIds.forEach(id=>{
      const val=existing[id];
      const st=String(typeof val==='object'?(val?.status||''):val).trim().toUpperCase();
      if(st==='A'||st==='R'||st==='PRESENTE'||st==='RETARDO'){
        presentIds.add(String(id));
        const num=Number(id);
        if(!isNaN(num))presentIds.add(String(num));
      }
    });
    let allStudents=(state.students&&state.students.length)?state.students:(state.attendance?.students||[]);
    state.classStudents=sortStudentsAlphabetically(allStudents.filter((student,idx)=>{
      const sid=String(student.id);
      const snum=Number(student.id);
      if(presentIds.has(sid)||(!isNaN(snum)&&presentIds.has(String(snum)))||presentIds.has(student.id))return true;
      if(student.studentId&&(presentIds.has(String(student.studentId))||presentIds.has(student.studentId)))return true;
      if(presentIds.has(String(idx+1)))return true;
      return false;
    }));
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
  $('#evaluationList').innerHTML=state.classStudents.length?state.classStudents.map((student,index)=>{const r=state.classEvaluations[student.id];return `<article class="evaluation-row" data-student="${student.id}"><div class="evaluation-student"><span>${index+1}</span><strong>${escapeHtml(fullName(student))}</strong></div><label>Entrega<select data-field="trabajo"><option value="Completo" ${r.trabajo==='Completo'?'selected':''}>Entregada</option><option value="Incompleto" ${r.trabajo==='Incompleto'?'selected':''}>Incompleta</option><option value="No trabajó" ${r.trabajo==='No trabajó'?'selected':''}>No entregada</option><option value="Entregada tarde" ${r.trabajo==='Entregada tarde'?'selected':''}>Entregada tarde</option><option value="Pendiente" ${r.trabajo==='Pendiente'?'selected':''}>Pendiente</option></select></label><label>Conducta<select data-field="conducta"><option ${r.conducta==='Excelente'?'selected':''}>Excelente</option><option ${r.conducta==='Adecuada'?'selected':''}>Adecuada</option><option ${r.conducta==='Requiere apoyo'?'selected':''}>Requiere apoyo</option></select></label><label>Participación<select data-field="participacion"><option ${r.participacion==='Alta'?'selected':''}>Alta</option><option ${r.participacion==='Media'?'selected':''}>Media</option><option ${r.participacion==='Nula'?'selected':''}>Nula</option></select></label><label class="note-field" style="grid-column: span 3;">Nota opcional<input data-field="observacionLibre" value="${escapeHtml(r.observacionLibre)}" placeholder="Opcional"></label></article>`}).join(''):'<div class="empty-history"><strong>No hay alumnos disponibles para evaluar</strong><p>Guarda primero la asistencia del día.</p></div>';
  $('#evaluationProgress').textContent=`${state.classStudents.length} alumno(s) presentes preparados`;
}
function updateClassEvaluation(e){const row=e.target.closest('[data-student]'),field=e.target.dataset.field;if(!row||!field)return;state.classEvaluations[row.dataset.student][field]=e.target.value;scheduleDraftSave($('#classForm'),DRAFT_KEYS.classRecord,()=>({evaluations:state.classEvaluations}),'classDraftStatus')}
function setAllEvaluations(field,value){Object.values(state.classEvaluations).forEach(row=>row[field]=value);renderEvaluationList();scheduleDraftSave($('#classForm'),DRAFT_KEYS.classRecord,()=>({evaluations:state.classEvaluations}),'classDraftStatus')}
async function saveClassForm(e){
  e.preventDefault();const form=e.currentTarget;if(form.dataset.saving==='1')return;if(!state.classStudents.length)return toast('Primero guarda la asistencia; no hay alumnos presentes para evaluar.',true);const payload=formData(form);payload.requestKey=ensureRequestKey(form,'ACT');payload.evaluaciones=state.classStudents.map(s=>state.classEvaluations[s.id]);
  if(!confirm(`¿Guardar la actividad y la evaluación de ${payload.evaluaciones.length} alumnos?`))return;
  writeDraft(form,DRAFT_KEYS.classRecord,()=>({evaluations:state.classEvaluations}),'classDraftStatus');setFormSaving(form,true);markDraftState(DRAFT_KEYS.classRecord,'Guardando','');
  const ok=await runAction(async()=>{const result=await server('saveClassRecord',payload);clearDraft(DRAFT_KEYS.classRecord,'classDraftStatus');state.stats.activities=Number(state.stats.activities||0)+(payload.id?0:1);state.stats.followUp=result.followUp;if(state.projectWorkspace&&String(state.currentProject?.id)===String(payload.proyectoId)&&result.activity){const rows=state.projectWorkspace.activities||[],index=rows.findIndex(row=>String(row.id)===String(result.activity.id));if(index<0)rows.unshift(result.activity);else rows[index]=result.activity;state.projectWorkspace.activities=rows}else{state.currentProject=state.projects.find(project=>String(project.id)===String(payload.proyectoId))||{id:payload.proyectoId,nombre:'Proyecto'};state.projectWorkspace={project:state.currentProject,activities:result.activity?[result.activity]:[]}}renderProjectWorkspace();renderStats();showView('project-detail');toast(result.message)});
  setFormSaving(form,false);if(!ok){markDraftState(DRAFT_KEYS.classRecord,'Pendiente de guardar',window.__lastActionError||'No fue posible completar el guardado.');showPendingSaveDialog(DRAFT_KEYS.classRecord)}else resetRequestKey(form);
}
function formatDateShort(value){if(!value)return 'Sin fecha';const [y,m,d]=String(value).split('-');return `${d}/${m}/${y}`}
function formatTime(value){if(!value)return '';const [h,m]=String(value).split(':').map(Number);return `${h%12||12}:${String(m||0).padStart(2,'0')} ${h<12?'a. m.':'p. m.'}`}
