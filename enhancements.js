/* Mejoras acumulativas v1.4: navegación, instrumentos, entregas y portal familiar. */
(function(){
  const levelOptions=(selected='')=>[['NE','Nivel esperado'],['EN','En desarrollo'],['RA','Requiere apoyo']].map(([code,label])=>`<option value="${code}" ${selected===code?'selected':''}>${code} · ${label}</option>`).join('');
  const currentInstrument=()=> (state.instruments||[]).find(item=>String(item.id)===String($('#classInstrument')?.value||''));

  function renderInstrumentOptions(){
    const select=$('#classInstrument');if(!select)return;
    const previous=select.value;
    select.innerHTML='<option value="">Evaluación sencilla (entrega, conducta y participación)</option>'+(state.instruments||[]).map(item=>`<option value="${escapeHtml(item.id)}">${escapeHtml(item.titulo)} · ${item.tipo==='RUBRICA'?'Rúbrica':'Lista de cotejo'}</option>`).join('');
    if([...select.options].some(option=>option.value===previous))select.value=previous;
    const subject=$('#instrumentSubject');if(subject)subject.innerHTML='<option value="">Todos</option>'+state.subjects.map(item=>`<option>${escapeHtml(item.nombre)}</option>`).join('');
  }
  const originalRenderAll=renderAll;
  renderAll=function(){originalRenderAll();renderInstrumentOptions();renderInstruments()};
  const originalRenderClassOptions=renderClassOptions;
  renderClassOptions=function(){originalRenderClassOptions();renderInstrumentOptions()};

  function renderInstruments(){
    const host=$('#instrumentGrid');if(!host)return;
    const query=($('#instrumentSearch')?.value||'').trim().toLowerCase(),type=$('#instrumentTypeFilter')?.value||'';
    const rows=(state.instruments||[]).filter(item=>(!query||[item.titulo,item.descripcion,item.campoFormativo].join(' ').toLowerCase().includes(query))&&(!type||item.tipo===type));
    host.innerHTML=rows.length?rows.map(item=>`<article class="instrument-card"><div class="instrument-card-head"><span class="instrument-kind ${item.tipo==='RUBRICA'?'rubric':'checklist'}">${item.tipo==='RUBRICA'?'Rúbrica':'Lista de cotejo'}</span><span class="badge">v${item.version||1}</span></div><h2>${escapeHtml(item.titulo)}</h2><p>${escapeHtml(item.descripcion||'Sin descripción')}</p><small>${escapeHtml(item.campoFormativo||'Todos los campos')} · ${(item.criterios||[]).length} criterio(s)</small><ul>${(item.criterios||[]).slice(0,4).map(row=>`<li>${escapeHtml(row.texto)}</li>`).join('')}${(item.criterios||[]).length>4?'<li>…</li>':''}</ul><div class="button-row"><button class="btn small" data-action="edit-instrument" data-id="${escapeHtml(item.id)}">Editar</button><button class="btn small" data-action="duplicate-instrument" data-id="${escapeHtml(item.id)}">Duplicar</button><button class="btn danger small" data-action="deactivate-instrument" data-id="${escapeHtml(item.id)}">Desactivar</button></div></article>`).join(''):'<article class="panel"><strong>No hay instrumentos con esos filtros.</strong><p class="muted">Crea una rúbrica o lista de cotejo para reutilizarla en distintas actividades.</p></article>';
  }
  function criterionRow(value='',weight=1,id=''){return `<div class="instrument-criterion"><input type="hidden" data-criterion-id value="${escapeHtml(id)}"><label>Indicador<input data-criterion-text value="${escapeHtml(value)}" placeholder="Ej. La letra es legible" required></label><label>Peso<input data-criterion-weight type="number" min="0.1" step="0.1" value="${Number(weight)||1}" required></label><button type="button" class="icon-button danger-link" data-action="remove-instrument-criterion" aria-label="Eliminar criterio">×</button></div>`}
  function openInstrument(item=null){
    const form=$('#instrumentForm');form.reset();form.elements.id.value=item?.id||'';form.elements.titulo.value=item?.titulo||'';form.elements.tipo.value=item?.tipo||'RUBRICA';form.elements.campoFormativo.value=item?.campoFormativo||'';form.elements.descripcion.value=item?.descripcion||'';$('#instrumentDialogTitle').textContent=item?'Editar instrumento':'Nuevo instrumento';$('#instrumentCriteria').innerHTML=(item?.criterios?.length?item.criterios:[{texto:'',peso:1},{texto:'',peso:1}]).map(row=>criterionRow(row.texto,row.peso,row.id)).join('');$('#instrumentDialog').showModal();
  }
  async function saveInstrument(event){
    event.preventDefault();const form=event.currentTarget,payload=formData(form);payload.criterios=$$('.instrument-criterion',form).map((row,index)=>({id:$('[data-criterion-id]',row).value||`CRI-${index+1}`,texto:$('[data-criterion-text]',row).value,peso:Number($('[data-criterion-weight]',row).value||1)}));
    await runAction(async()=>{const result=await server('saveEvaluationInstrument',payload);state.instruments=result.instruments||[];$('#instrumentDialog').close();renderInstruments();renderInstrumentOptions();toast(result.message)});
  }
  function updateInstrumentChoice(){const item=currentInstrument(),summary=$('#classInstrumentSummary');if(summary)summary.innerHTML=item?`<b>${escapeHtml(item.titulo)}</b> · ${(item.criterios||[]).length} criterios · niveles NE, EN y RA`:'Puedes evaluar únicamente la entrega o seleccionar una rúbrica/lista de cotejo reutilizable.';renderEvaluationList()}

  defaultEvaluation=function(studentId){return {alumnoId:studentId,trabajo:'Completo',conducta:'Adecuada',participacion:'Media',desempeno:'',observacionLibre:'',instrumentResults:{}}};
  renderEvaluationList=function(){
    const instrument=currentInstrument();
    $('#evaluationList').innerHTML=state.classStudents.length?state.classStudents.map((student,index)=>{const row=state.classEvaluations[student.id]||defaultEvaluation(student.id),selections=row.instrumentResults||{};return `<article class="evaluation-row ${instrument?'with-instrument':''}" data-student="${student.id}"><div class="evaluation-student"><span>${index+1}</span><strong>${escapeHtml(fullName(student))}</strong></div><label>Entrega<select data-field="trabajo"><option ${row.trabajo==='Completo'?'selected':''}>Completo</option><option ${row.trabajo==='Incompleto'?'selected':''}>Incompleto</option><option ${row.trabajo==='No trabajó'?'selected':''}>No trabajó</option></select></label><label>Conducta<select data-field="conducta"><option ${row.conducta==='Excelente'?'selected':''}>Excelente</option><option ${row.conducta==='Adecuada'?'selected':''}>Adecuada</option><option ${row.conducta==='Requiere apoyo'?'selected':''}>Requiere apoyo</option></select></label><label>Participación<select data-field="participacion"><option ${row.participacion==='Alta'?'selected':''}>Alta</option><option ${row.participacion==='Media'?'selected':''}>Media</option><option ${row.participacion==='Nula'?'selected':''}>Nula</option></select></label>${instrument?`<div class="instrument-evaluation"><div class="instrument-evaluation-title"><b>${escapeHtml(instrument.titulo)}</b><span class="instrument-grade" data-grade>—</span></div>${(instrument.criterios||[]).map(criterion=>`<label><span>${escapeHtml(criterion.texto)}</span><select data-instrument-criterion="${escapeHtml(criterion.id)}">${levelOptions(selections[criterion.id]||'NE')}</select></label>`).join('')}</div>`:`<label class="rubric-field">Observación predeterminada<select data-field="desempeno">${rubricOptions(row.desempeno)}</select></label>`}<label class="note-field">Observación adicional<input data-field="observacionLibre" value="${escapeHtml(row.observacionLibre||'')}" placeholder="Opcional"></label></article>`}).join(''):'<div class="empty-history"><strong>No hay alumnos disponibles para evaluar</strong><p>Guarda primero la asistencia del día.</p></div>';
    $('#evaluationProgress').textContent=`${state.classStudents.length} alumno(s) presentes preparados`;if(instrument)$$('.evaluation-row').forEach(updateInstrumentPreview);
  };
  function updateInstrumentPreview(row){const selections={},instrument=currentInstrument();$$('[data-instrument-criterion]',row).forEach(select=>selections[select.dataset.instrumentCriterion]=select.value);const values={NE:10,EN:7,RA:5};let points=0,weights=0;(instrument?.criterios||[]).forEach(c=>{const weight=Number(c.peso||1);points+=(values[selections[c.id]||'RA']/10)*weight;weights+=weight});const grade=weights?Math.round(points/weights*100)/10:null;$('[data-grade]',row).textContent=grade==null?'—':grade.toFixed(1)}
  const originalUpdateClassEvaluation=updateClassEvaluation;
  updateClassEvaluation=function(event){const select=event.target.closest('[data-instrument-criterion]');if(select){const row=select.closest('[data-student]'),record=state.classEvaluations[row.dataset.student];record.instrumentResults=record.instrumentResults||{};record.instrumentResults[select.dataset.instrumentCriterion]=select.value;updateInstrumentPreview(row);return}originalUpdateClassEvaluation(event)};

  function deliveryFilterMatch(student,filter,event){if(filter==='PAGADO_NO_ENTREGADO')return event.requiresDelivery&&student.status==='PAGADO'&&student.deliveryStatus!=='ENTREGADO';if(filter==='ENTREGADO')return event.requiresDelivery&&student.status==='PAGADO'&&student.deliveryStatus==='ENTREGADO';return filter==='TODOS'||student.status===filter}
  renderPaymentDetail=function(){
    const detail=state.paymentDetail;if(!detail)return;const event=detail.event,summary=detail.summary;$('#paymentDetailTitle').textContent=event.name;$('#paymentDetailMeta').textContent=[event.description,formatDateShort(event.date),formatTime(event.time),`Cobro ${paymentMoney(event.charge)} por alumno`,event.requiresDelivery?`Producto: ${event.product||'Sin especificar'}`:''].filter(Boolean).join(' · ');$('[data-action="archive-current-payment-event"]').classList.toggle('hidden-control',!event.active);const cards=[['Pagaron',summary.paidCount],['Abonaron',summary.partialCount],['Pendientes',summary.pendingCount]];if(event.requiresDelivery)cards.push(['Pagado / no entregado',summary.paidNotDeliveredCount],['Entregados',summary.deliveredCount]);cards.push(['Efectivo disponible',paymentMoney(summary.cashAvailable)]);$('#paymentDetailStats').innerHTML=cards.map(([label,value])=>`<div class="stat"><b>${escapeHtml(value)}</b><span>${escapeHtml(label)}</span></div>`).join('');const today=todayCancun();$('#paymentCutForm').elements.date.value=today;$('#paymentMovementForm').elements.date.value=today;renderPaymentStudents();renderPaymentLedgers();renderPaymentFinancial();
  };
  renderPaymentStudents=function(){
    const detail=state.paymentDetail;if(!detail)return;const event=detail.event,query=$('#paymentStudentSearch').value.trim().toLowerCase(),filter=$('#paymentStudentFilter').value;const students=detail.students.filter(student=>deliveryFilterMatch(student,filter,event)&&student.name.toLowerCase().includes(query));$('#paymentStudentList').innerHTML=students.length?students.map((student,index)=>{const paid=student.status==='PAGADO',delivered=student.deliveryStatus==='ENTREGADO';return `<article class="payment-student-row ${delivered?'delivered':''}"><span class="payment-student-number">${index+1}</span><div><strong>${escapeHtml(student.name)}</strong><p>Pagado: ${paymentMoney(student.paid)} · Falta: ${paymentMoney(student.remaining)}</p>${event.requiresDelivery&&delivered?`<small>Entregado ${escapeHtml(formatDateShort(student.deliveryDate))}${student.deliveryReceivedBy?' · Recibió '+escapeHtml(student.deliveryReceivedBy):''}</small>`:''}</div><span class="payment-status ${student.status.toLowerCase()}">${student.status==='PAGADO'?'Pagado':student.status==='ABONO'?'Abono':'No pagado'}</span>${event.requiresDelivery?`<span class="delivery-status ${delivered?'yes':'no'}">${delivered?'Entregado':paid?'No entregado':'Entrega bloqueada'}</span>`:''}<div class="payment-row-actions">${student.remaining>0?`<button class="btn small" data-action="payment-abono" data-id="${escapeHtml(student.id)}">Abono</button><button class="btn primary small" data-action="payment-total" data-id="${escapeHtml(student.id)}">Pagar total</button>`:`<span class="paid-check">✓ Liquidado</span>`}${event.requiresDelivery&&paid?delivered?`<button class="btn small" data-action="undo-payment-delivery" data-id="${escapeHtml(student.id)}">Deshacer entrega</button>`:`<button class="btn primary small" data-action="payment-delivery" data-id="${escapeHtml(student.id)}">Marcar entregado</button>`:''}</div></article>`}).join(''):'<div class="empty-history"><strong>Sin resultados</strong><p>Cambia el filtro o la búsqueda.</p></div>';
  };
  function openDelivery(studentId){const student=state.paymentDetail?.students.find(row=>String(row.id)===String(studentId));if(!student)return;const form=$('#deliveryForm');form.reset();form.elements.studentId.value=student.id;form.elements.date.value=todayCancun();$('#deliveryDialogStudent').textContent=`${student.name} · ${state.paymentDetail.event.product||'Producto'}`;$('#deliveryDialog').showModal()}
  async function saveDelivery(event){event.preventDefault();const payload=formData(event.currentTarget);payload.eventId=state.paymentDetail.event.id;payload.delivered=true;await runAction(async()=>{const result=await server('setPaymentDelivery',payload);state.paymentDetail=result.detail;$('#deliveryDialog').close();renderPaymentDetail();toast(result.message)})}

  function conductGauge(summary){const score=Number(summary?.score),safe=Number.isFinite(score)?Math.max(0,Math.min(10,score)):0,rotation=-90+safe*18,label=summary?.label||'Sin datos';return `<div class="conduct-gauge"><div class="conduct-arc"><i style="transform:rotate(${rotation}deg)"></i></div><div><strong>${escapeHtml(label)}</strong><span>${Number.isFinite(score)?score.toFixed(1)+' de 10':'Sin registros'}</span></div><small><b>Malo</b><b>Regular</b><b>Bueno</b><b>Excelente</b></small></div>`}
  function taskStatusClass(value){return value==='Entregó'?'done':value.includes('incompleta')?'partial':'pending'}
  function familyWeekLabel(start,end){const parse=value=>{const parts=String(value||'').split('-').map(Number);return new Date(parts[0],(parts[1]||1)-1,parts[2]||1)},a=parse(start),b=parse(end),same=a.getMonth()===b.getMonth();return same?`Del ${a.getDate()} al ${b.getDate()} de ${b.toLocaleDateString('es-MX',{month:'long'})}`:`Del ${a.toLocaleDateString('es-MX',{day:'numeric',month:'long'})} al ${b.toLocaleDateString('es-MX',{day:'numeric',month:'long'})}`}
  function taskLine(task){return `<article class="family-task-line ${taskStatusClass(task.status)}"><div><span>${escapeHtml(formatDateShort(task.date))} · ${escapeHtml(formatTime(task.start))}–${escapeHtml(formatTime(task.end))}</span><h4>${escapeHtml(task.name)}</h4><p>${escapeHtml(task.source||'')} · ${escapeHtml(task.project||'Sin proyecto')}</p></div><b>${escapeHtml(task.status)}</b>${task.instrumentGrade!=null?`<small>${escapeHtml(task.instrumentLevel||'Instrumento')} · ${Number(task.instrumentGrade).toFixed(1)}</small>`:''}${task.opportunities?`<p class="opportunity"><b>Área de oportunidad:</b> ${escapeHtml(task.opportunities)}</p>`:''}</article>`}
  renderFamilyAcademic=function(){
    const academic=familyPortalData?.academic;if(!academic)return;const fields=academic.fields||[],summary=academic.taskSummary||{},attendance=academic.attendanceSummary||{},conduct=academic.conductSummary||{},periodLabel=academic.periodLabel||('Trimestre '+(academic.trimester||1)),grades=fields.map(f=>f.grade).filter(v=>v!=null),average=grades.length?grades.reduce((a,b)=>a+Number(b),0)/grades.length:null;$('#familyUpdatedAt').textContent='Actualizado: '+new Date(academic.updatedAt).toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'});$('#familyOverview').innerHTML=`<p class="family-period-label">${escapeHtml(periodLabel)}</p><div class="family-overview-grid"><article class="family-metric"><span>Tareas realizadas</span><strong>${summary.completed||0} de ${summary.total||0}</strong><div class="family-progress"><i style="width:${Math.min(summary.percentage||0,100)}%"></i></div><small>${summary.pending||0} pendiente(s)</small></article><article class="family-metric"><span>Promedio provisional</span><strong>${familyNumber(average)}</strong><small>Promedio de los 4 campos formativos</small></article><article class="family-metric"><span>Asistencia del periodo</span><strong>${attendance.attended||0}/${attendance.total||0}</strong><small>${attendance.percentage||0}% · ${attendance.late||0} retardo(s)</small></article><article class="family-metric conduct-metric"><span>Conducta</span>${conductGauge(conduct)}</article></div><article class="family-info-note"><b>Información en proceso.</b> Los resultados cambian cuando el maestro agrega tareas, asistencias, participación, conducta o examen.</article><div class="family-field-preview">${fields.map(field=>`<article><span>${familyFieldIcon(field.name)}</span><div><h3>${escapeHtml(field.name)}</h3><p>${field.completed} de ${field.total} tareas · Calificación ${familyNumber(field.grade)}</p>${field.sources?.length>1?`<small>Matemático ${familyNumber(field.sources[0].grade)} · Científico ${familyNumber(field.sources[1].grade)}</small>`:''}</div></article>`).join('')}</div>`;
    const weeks=academic.weeklyTasks||[];$('#familyTasks').innerHTML=`<div class="family-page-title"><div><p class="eyebrow">${escapeHtml(periodLabel)}</p><h2>Tareas por semana</h2></div><strong>${summary.completed||0} de ${summary.total||0}</strong></div>${weeks.length?weeks.map(week=>`<details class="family-week" ${weeks.length===1?'open':''}><summary><div><b>Semana ${week.number}</b><span>${escapeHtml(familyWeekLabel(week.start,week.end))}</span></div><strong>${week.completed} realizadas · ${week.pending} pendientes</strong></summary><div>${week.tasks.map(taskLine).join('')}</div></details>`).join(''):'<article class="family-card"><p class="muted">No hay actividades registradas en este periodo.</p></article>'}`;$('#familyGrades').innerHTML=familyGradesHtml(fields);
  };

  function enhancePasswords(){
    $$('input[type="password"]').forEach(input=>{if(input.parentElement?.classList.contains('password-wrap'))return;const wrap=document.createElement('span');wrap.className='password-wrap';input.parentNode.insertBefore(wrap,input);wrap.appendChild(input);const button=document.createElement('button');button.type='button';button.className='password-eye';button.textContent='Ver';button.addEventListener('click',()=>{const show=input.type==='password';input.type=show?'text':'password';button.textContent=show?'Ocultar':'Ver'});wrap.appendChild(button);if(input.autocomplete==='new-password'||input.name==='password'&&input.closest('#familyOnboardingForm,#familyRegisterForm,#familyGroupRegisterForm,#familyResetForm,#enrollmentCreateAccountForm')){input.pattern='(?=.*[a-záéíóúñ])(?=.*[A-ZÁÉÍÓÚÑ])(?=.*\\d)(?=.*[^A-Za-zÁÉÍÓÚáéíóúÑñ0-9]).{10,}';input.title='Usa 10 caracteres como mínimo, con mayúscula, minúscula, número y símbolo.';const hint=document.createElement('small');hint.className='password-rules';hint.textContent='10 caracteres como mínimo: mayúscula, minúscula, número y símbolo.';wrap.after(hint)}})
  }
  function addSaveOverlay(){if($('#saveProgressOverlay'))return;document.body.insertAdjacentHTML('beforeend','<div id="saveProgressOverlay" class="save-progress-overlay hidden-control"><div><span>Guardando información…</span><b id="saveProgressValue">0%</b><i><em></em></i></div></div>')}
  function showSaveProgress(){addSaveOverlay();const box=$('#saveProgressOverlay'),bar=$('em',box),value=$('#saveProgressValue');box.classList.remove('hidden-control');let progress=12;bar.style.width=progress+'%';value.textContent=progress+'%';const timer=setInterval(()=>{progress=Math.min(92,progress+Math.ceil((94-progress)/4));bar.style.width=progress+'%';value.textContent=progress+'%'},180);return ()=>{clearInterval(timer);bar.style.width='100%';value.textContent='100%';setTimeout(()=>box.classList.add('hidden-control'),300)}}
  const originalSaveEnrollmentDraft=typeof saveEnrollmentDraft==='function'?saveEnrollmentDraft:null;if(originalSaveEnrollmentDraft)saveEnrollmentDraft=async function(silent=false){const done=showSaveProgress();try{return await originalSaveEnrollmentDraft(silent)}finally{done()}};

  document.addEventListener('DOMContentLoaded',()=>{
    Object.assign(actions,{
      'open-instruments':()=>showView('instruments'),'new-instrument':()=>openInstrument(),'edit-instrument':button=>openInstrument((state.instruments||[]).find(item=>String(item.id)===String(button.dataset.id))),
      'duplicate-instrument':async button=>runAction(async()=>{const result=await server('duplicateEvaluationInstrument',button.dataset.id);state.instruments=result.instruments||[];renderInstruments();renderInstrumentOptions();toast(result.message)}),
      'deactivate-instrument':async button=>{if(!confirm('¿Desactivar este instrumento? Las evaluaciones anteriores se conservarán.'))return;await runAction(async()=>{const result=await server('setEvaluationInstrumentActive',button.dataset.id,false);state.instruments=result.instruments||[];renderInstruments();renderInstrumentOptions();toast(result.message)})},
      'add-instrument-criterion':()=>$('#instrumentCriteria').insertAdjacentHTML('beforeend',criterionRow()),'remove-instrument-criterion':button=>button.closest('.instrument-criterion')?.remove(),
      'payment-delivery':button=>openDelivery(button.dataset.id),'undo-payment-delivery':async button=>{if(!confirm('¿Marcar el producto como no entregado?'))return;await runAction(async()=>{const result=await server('setPaymentDelivery',{eventId:state.paymentDetail.event.id,studentId:button.dataset.id,delivered:false});state.paymentDetail=result.detail;renderPaymentDetail();toast(result.message)})},
      'family-change-account':()=>familyLogout(false,'Sesión cerrada. Ya puede entrar otra familia.')
    });
    $('#instrumentForm')?.addEventListener('submit',saveInstrument);$('#instrumentSearch')?.addEventListener('input',renderInstruments);$('#instrumentTypeFilter')?.addEventListener('change',renderInstruments);$('#classInstrument')?.addEventListener('change',updateInstrumentChoice);$('#deliveryForm')?.addEventListener('submit',saveDelivery);$('#paymentRequiresDelivery')?.addEventListener('change',event=>{const field=$('#paymentProductField');field.classList.toggle('hidden-control',!event.target.checked);field.querySelector('input').required=event.target.checked});
    const collapse=$('#sidebarCollapse');collapse?.addEventListener('click',()=>{const collapsed=$('#sidebar').classList.toggle('collapsed');$('.main').classList.toggle('sidebar-collapsed',collapsed);localStorage.setItem('carpeta_sidebar_collapsed',collapsed?'1':'0')});if(localStorage.getItem('carpeta_sidebar_collapsed')==='1'&&innerWidth>900){$('#sidebar').classList.add('collapsed');$('.main').classList.add('sidebar-collapsed')}
    enhancePasswords();renderInstrumentOptions();renderInstruments();addSaveOverlay();
  });
})();

/* Panel familiar v1.6: semana escolar centralizada, reporte semanal y credenciales compactas. */
(function () {
  'use strict';
  const planningCalendar = window.CARPETA_PLANNING_CALENDAR;
  if (!planningCalendar) return;

  let planningSelectedDate = planningCalendar.today();
  let planningFollowsToday = true;
  let planningLastToday = planningSelectedDate;

  function ensureFamilyPlanningShell() {
    const app = $('#familyAppPanel');
    if (!app || $('#familyPlanningPanel')) return;
    const studentHead = app.querySelector('.family-student-head');
    studentHead.insertAdjacentHTML('afterend', `
      <section id="familyPlanningPanel" class="family-planning-panel" aria-live="polite">
        <div class="family-planning-top">
          <div class="family-planning-identity"><span class="family-planning-eyebrow">SEMANA DE PLANEACIÓN</span><h2 id="familyPlanningTitle">Semana</h2><p id="familyPlanningRange"></p></div>
          <span id="familyPlanningState" class="family-planning-state"><i></i> Semana actual</span>
          <div class="family-planning-selected"><span class="family-planning-calendar" aria-hidden="true">▣</span><div><small>Fecha seleccionada</small><strong id="familyPlanningSelectedLabel"></strong></div></div>
        </div>
        <div class="family-planning-middle">
          <div id="familyPlanningDays" class="family-planning-days"></div>
          <div class="family-planning-date-actions"><div class="family-date-picker"><button class="btn family-date-button" type="button" data-action="family-open-planning-date">▣&nbsp; Elegir fecha</button><input id="familyPlanningDateInput" class="family-planning-date-input" type="date" aria-label="Elegir fecha"></div><button class="btn primary" data-action="family-planning-today">Hoy</button></div>
        </div>
        <div class="family-planning-footer"><div class="family-report-actions"><button class="btn primary" data-action="family-view-weekly-report">▤&nbsp; Ver reporte semanal</button><button class="btn" data-action="family-print-weekly-report">▣&nbsp; Imprimir / PDF</button></div><p id="familyPlanningNote" class="family-planning-note">ⓘ Sábados y domingos conservan la semana que acaba de finalizar.</p></div>
      </section>`);

    const periodBar = app.querySelector('.family-period-bar');
    const otherPeriods = document.createElement('details');
    otherPeriods.className = 'family-other-periods';
    otherPeriods.innerHTML = '<summary>Consultar otro periodo</summary>';
    periodBar.parentNode.insertBefore(otherPeriods, periodBar);
    otherPeriods.appendChild(periodBar);

    const reportView = document.createElement('div');
    reportView.id = 'familyWeeklyReport';
    reportView.className = 'family-view';
    app.insertBefore(reportView, $('#familyProfile'));

    app.insertAdjacentHTML('beforeend', `
      <nav class="family-bottom-nav" aria-label="Navegación familiar móvil">
        <button class="active" data-family-bottom-view="familyOverview"><span>⌂</span>Inicio</button>
        <button data-family-bottom-view="familyTasks"><span>▣</span>Tareas</button>
        <button data-family-bottom-view="familyGrades"><span>▥</span>Calificaciones</button>
        <button data-family-bottom-view="familyAccount"><span>♙</span>Mi cuenta</button>
      </nav>`);

    const familyHeader = $('#familyPortal .family-header');
    familyHeader.insertAdjacentHTML('beforeend', `
      <button id="familyMobileMenuButton" class="family-mobile-menu-button" type="button" aria-expanded="false" aria-label="Abrir menú">☰</button>
      <div id="familyMobileMenu" class="family-mobile-menu hidden-control">
        <button type="button" data-family-mobile-view="familyProfile">Datos familiares</button>
        <button type="button" data-family-mobile-view="familyAccount">Mi cuenta</button>
        <button type="button" data-action="family-logout">Cerrar sesión</button>
      </div>`);

    $('#familyPlanningDateInput').addEventListener('change', function (event) {
      if (event.target.value) setFamilyPlanningDate(event.target.value, true, false);
    });
    $('.family-bottom-nav').addEventListener('click', function (event) {
      const button = event.target.closest('[data-family-bottom-view]');
      if (!button) return;
      showFamilyView(button.dataset.familyBottomView);
      $$('.family-bottom-nav button').forEach(function (item) { item.classList.toggle('active', item === button); });
    });
    $('#familyMobileMenuButton').addEventListener('click', function () {
      const menu = $('#familyMobileMenu');
      const open = menu.classList.toggle('hidden-control') === false;
      this.setAttribute('aria-expanded', String(open));
    });
    $('#familyMobileMenu').addEventListener('click', function (event) {
      const button = event.target.closest('[data-family-mobile-view]');
      if (!button) return;
      showFamilyView(button.dataset.familyMobileView);
      this.classList.add('hidden-control');
      $('#familyMobileMenuButton').setAttribute('aria-expanded', 'false');
    });
  }

  function capitalize(value) {
    const text = String(value || '');
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
  }

  function selectedDateLabel(value) {
    return capitalize(new Date(value + 'T12:00:00').toLocaleDateString('es-MX', {
      weekday: 'long', day: 'numeric', month: 'long'
    }));
  }

  function renderFamilyPlanningPanel() {
    ensureFamilyPlanningShell();
    const info = planningCalendar.resolve(planningSelectedDate);
    $('#familyPlanningTitle').textContent = info.title;
    $('#familyPlanningRange').textContent = info.rangeLabel;
    $('#familyPlanningSelectedLabel').textContent = selectedDateLabel(planningSelectedDate);
    $('#familyPlanningDateInput').value = planningSelectedDate;
    const isToday = planningSelectedDate === planningCalendar.today();
    const state = $('#familyPlanningState');
    state.className = 'family-planning-state ' + (info.type === 'vacation' ? 'vacation' : info.type === 'suspension' ? 'suspension' : '');
    state.innerHTML = '<i></i> ' + (info.type === 'vacation' ? 'Vacaciones' : info.type === 'suspension' ? 'Suspensión' : isToday ? 'Semana actual' : 'Fecha consultada');
    const days = planningCalendar.daysFor(info);
    $('#familyPlanningDays').innerHTML = days.map(function (day) {
      return `<button type="button" class="${day.selected ? 'active' : ''}" data-action="family-select-planning-day" data-date="${day.date}"><span>${day.label}</span><b>${day.day}</b></button>`;
    }).join('');
    $('#familyPlanningDays').classList.toggle('hidden-control', !days.length);
    $('#familyPlanningNote').textContent = info.type === 'vacation'
      ? 'ⓘ Durante este periodo no se contabilizan días de clase.'
      : info.type === 'suspension'
        ? 'ⓘ El 6 de enero corresponde a la Semana 17, pero no hay clases.'
        : 'ⓘ Sábados y domingos conservan la semana que acaba de finalizar.';
    $$('.family-report-actions .btn').forEach(function (button) {
      button.disabled = !['week', 'suspension'].includes(info.type);
    });
  }

  async function setFamilyPlanningDate(value, loadData, followsToday) {
    planningSelectedDate = value || planningCalendar.today();
    planningFollowsToday = Boolean(followsToday);
    renderFamilyPlanningPanel();
    const type = $('#familyPeriodType');
    const date = $('#familyPeriodDate');
    if (type) type.value = 'week';
    if (date) date.value = planningSelectedDate;
    toggleFamilyPeriodControls();
    if (loadData && familyPortalData) await loadFamilyAcademic();
  }

  const originalLoadFamilyProfileV16 = loadFamilyProfile;
  loadFamilyProfile = async function () {
    ensureFamilyPlanningShell();
    planningSelectedDate = planningCalendar.today();
    planningFollowsToday = true;
    $('#familyPeriodType').value = 'week';
    $('#familyPeriodDate').value = planningSelectedDate;
    toggleFamilyPeriodControls();
    setLoading(true, 'Cargando el avance académico…', function () { loadFamilyProfile(); });
    try {
      resetFamilyIdleTimer();
      familyMessage('Consultando el avance académico…');
      const period = { type: 'week', trimester: Number($('#familyTrimester').value || 1), reference: planningSelectedDate };
      try {
        familyPortalData = await familyServer('getFamilyPortalInitialData', period);
      } catch (error) {
        if (!/acción familiar solicitada no está permitida/i.test(String(error.message || ''))) throw error;
        await originalLoadFamilyProfileV16();
        return;
      }
      renderFamilyPortal();
      renderFamilyPlanningPanel();
      showFamilyPanel('familyAppPanel');
    } catch (error) {
      familySessionToken = '';
      localStorage.removeItem(FAMILY_SESSION_KEY);
      sessionStorage.removeItem(FAMILY_SESSION_KEY);
      showFamilyPanel('familyLoginPanel');
      familyMessage(error.message, true);
    } finally {
      setLoading(false);
    }
  };

  function familyConductGaugeV16(summary) {
    const score = Number(summary && summary.score);
    const valid = Number.isFinite(score);
    const safe = valid ? Math.max(0, Math.min(10, score)) : 0;
    const rotation = -90 + safe * 18;
    const label = summary && summary.label || 'Sin datos';
    return `<div class="conduct-gauge"><div class="conduct-arc"><i style="transform:rotate(${rotation}deg)"></i></div><div><strong>${escapeHtml(label)}</strong><span>${valid ? score.toFixed(1) + ' de 10' : 'Sin registros'}</span></div><small><b>Malo</b><b>Regular</b><b>Bueno</b><b>Excelente</b></small></div>`;
  }

  function familyAttendanceDetailsV161(attendance) {
    const justified = attendance && attendance.justifiedDates || [];
    const missing = attendance && attendance.absenceDates || [];
    const late = attendance && attendance.lateDates || [];
    const items = [];
    justified.forEach(function (date) { items.push(`<span class="justified">✓ ${escapeHtml(formatDateShort(date))} · Justificada</span>`); });
    missing.forEach(function (date) { items.push(`<span class="missing">✕ ${escapeHtml(formatDateShort(date))} · Falta</span>`); });
    late.forEach(function (date) { items.push(`<span class="late">◷ ${escapeHtml(formatDateShort(date))} · Retardo</span>`); });
    return `<div class="family-attendance-statuses">${items.length ? items.join('') : '<span class="complete">✓ Sin faltas registradas</span>'}</div>`;
  }

  function familyReportTaskStatus(task) {
    return String(task && task.status || '') === 'Entregó'
      ? { className: 'done', icon: '✓', label: 'Entregó' }
      : { className: 'missing', icon: '✕', label: 'No entregó' };
  }

  function familyTaskLineV16(task) {
    const status = familyReportTaskStatus(task);
    return `<article class="family-task-line ${status.className}"><div><span>${escapeHtml(formatDateShort(task.date))} · ${escapeHtml(formatTime(task.start))}${task.end ? '–' + escapeHtml(formatTime(task.end)) : ''}</span><h4>${escapeHtml(task.name)}</h4><p>${escapeHtml(task.source || '')} · ${escapeHtml(task.project || 'Sin proyecto')}</p></div><b class="family-task-status">${status.icon} ${status.label}</b>${task.opportunities ? `<p class="opportunity"><b>Área de oportunidad:</b> ${escapeHtml(task.opportunities)}</p>` : ''}</article>`;
  }

  function familyTasksForCurrentPeriod() {
    const academic = familyPortalData && familyPortalData.academic;
    if (!academic) return [];
    if (Array.isArray(academic.tasks)) return academic.tasks;
    return (academic.fields || []).flatMap(function (field) {
      return (field.tasks || []).map(function (task) { return Object.assign({ source: field.name }, task); });
    });
  }

  function weeklyObservation(academic) {
    const opportunities = academic && academic.opportunities || [];
    return opportunities.length
      ? 'Áreas de oportunidad: ' + opportunities.join('; ') + '.'
      : 'Sin observaciones adicionales registradas durante esta semana.';
  }

  function renderFamilyWeeklyReport() {
    const host = $('#familyWeeklyReport');
    if (!host || !familyPortalData) return;
    const academic = familyPortalData.academic || {};
    const tasks = familyTasksForCurrentPeriod();
    const info = planningCalendar.resolve(planningSelectedDate);
    host.innerHTML = `<div class="family-report-mobile-head"><button class="btn" data-action="family-report-back">← Regresar</button><div><p class="eyebrow">REPORTE SEMANAL</p><h2>${escapeHtml(familyPortalData.student.name)}</h2><p>${escapeHtml((familyPortalData.school.group || '') + ' · ' + info.title + ' · ' + info.rangeLabel)}</p></div><button class="btn" data-action="family-print-weekly-report">▣ Imprimir / PDF</button></div><h2 class="family-report-section-title">Tareas y actividades</h2><div class="family-report-task-list">${tasks.length ? tasks.map(function (task) {
      const status = familyReportTaskStatus(task);
      return `<article><time>${escapeHtml(formatDateShort(task.date))}</time><div><small>${escapeHtml(task.source || 'Campo formativo')}</small><h3>${escapeHtml(task.name)}</h3><p>${escapeHtml(formatTime(task.start))}${task.end ? '–' + escapeHtml(formatTime(task.end)) : ''}${task.project ? ' · ' + escapeHtml(task.project) : ''}</p></div><strong class="${status.className}">${status.icon} ${status.label}</strong></article>`;
    }).join('') : '<article class="family-report-empty">No hay tareas registradas para esta semana.</article>'}</div><details class="family-report-note"><summary>Indicaciones para la familia</summary><ul><li>Revisar las actividades marcadas como no entregadas.</li><li>Firmar las tareas corregidas cuando el docente lo solicite.</li><li>Practicar lectura durante 15 minutos diarios.</li></ul></details><details class="family-report-note" open><summary>Observaciones de la semana</summary><p>${escapeHtml(weeklyObservation(academic))}</p></details>`;
  }

  renderFamilyAcademic = function () {
    ensureFamilyPlanningShell();
    const academic = familyPortalData && familyPortalData.academic;
    if (!academic) return;
    const fields = academic.fields || [];
    const summary = academic.taskSummary || {};
    const attendance = academic.attendanceSummary || {};
    const conduct = academic.conductSummary || {};
    const periodLabel = academic.periodLabel || ('Trimestre ' + (academic.trimester || 1));
    const type = $('#familyPeriodType').value;
    const heading = type === 'week' ? 'Resumen del ' + selectedDateLabel(planningSelectedDate).toLowerCase() : 'Resumen de ' + periodLabel;
    $('#familyUpdatedAt').textContent = 'Actualizado: ' + new Date(academic.updatedAt).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
    renderFamilyPlanningPanel();
    $('#familyOverview').innerHTML = `<h2 class="family-summary-heading">${escapeHtml(heading)}</h2><div class="family-dashboard-summary"><article class="family-metric attendance-metric"><span>Asistencia</span><strong>${attendance.attended || 0} de ${attendance.total || 0}</strong><div class="family-progress"><i style="width:${Math.min(attendance.percentage || 0, 100)}%"></i></div><small>${attendance.percentage || 0}% de asistencia${attendance.late ? ' · ' + attendance.late + ' retardo(s)' : ''}</small>${familyAttendanceDetailsV161(attendance)}</article><article class="family-metric task-metric"><span>Tareas</span><strong>${summary.completed || 0} de ${summary.total || 0}</strong><div class="family-progress"><i style="width:${Math.min(summary.percentage || 0, 100)}%"></i></div><small>${summary.percentage || 0}% de tareas entregadas</small></article><article class="family-metric conduct-metric"><span>Conducta</span>${familyConductGaugeV16(conduct)}</article></div><article class="family-info-note"><b>Información en proceso.</b> Los resultados cambian cuando el maestro agrega tareas, asistencias, participación, conducta o examen.</article><div class="family-field-preview">${fields.map(function (field) { return `<article><span>${familyFieldIcon(field.name)}</span><div><h3>${escapeHtml(field.name)}</h3><p>${field.completed} de ${field.total} tareas · Calificación ${familyNumber(field.grade)}</p>${field.sources && field.sources.length > 1 ? `<small>Matemático ${familyNumber(field.sources[0].grade)} · Científico ${familyNumber(field.sources[1].grade)}</small>` : ''}</div></article>`; }).join('')}</div>`;
    const weeks = academic.weeklyTasks || [];
    $('#familyTasks').innerHTML = `<div class="family-page-title"><div><p class="eyebrow">${escapeHtml(periodLabel)}</p><h2>Tareas por semana</h2></div><strong>${summary.completed || 0} de ${summary.total || 0}</strong></div>${weeks.length ? weeks.map(function (week) {
      const calendarWeek = planningCalendar.resolve(week.start);
      return `<details class="family-week" ${weeks.length === 1 ? 'open' : ''}><summary><div><b>${escapeHtml(calendarWeek.title)}</b><span>${escapeHtml(calendarWeek.rangeLabel)}</span></div><strong>${week.completed} realizadas · ${week.pending} pendientes</strong></summary><div>${week.tasks.map(familyTaskLineV16).join('')}</div></details>`;
    }).join('') : '<article class="family-card"><p class="muted">No hay actividades registradas en este periodo.</p></article>'}`;
    $('#familyGrades').innerHTML = familyGradesHtml(fields);
    renderFamilyWeeklyReport();
  };

  async function ensureWeeklyData() {
    if ($('#familyPeriodType').value === 'week' && $('#familyPeriodDate').value === planningSelectedDate) return;
    await setFamilyPlanningDate(planningSelectedDate, true, planningFollowsToday);
  }

  async function openFamilyWeeklyReport() {
    await ensureWeeklyData();
    renderFamilyWeeklyReport();
    showFamilyView('familyWeeklyReport');
    $$('.family-bottom-nav button').forEach(function (button) { button.classList.remove('active'); });
  }

  function weeklyPrintRows(tasks) {
    if (!tasks.length) return '<tr><td colspan="5">No hay tareas registradas para esta semana.</td></tr>';
    return tasks.map(function (task) {
      const delivered = familyReportTaskStatus(task).className === 'done';
      return `<tr><td>${escapeHtml(formatDateShort(task.date))}</td><td>${escapeHtml(task.source || '—')}</td><td>${escapeHtml(task.name)}</td><td class="mark">${delivered ? '✓' : ''}</td><td class="mark">${delivered ? '' : '✕'}</td></tr>`;
    }).join('');
  }

  async function printFamilyWeeklyReport() {
    await ensureWeeklyData();
    const academic = familyPortalData.academic || {};
    const tasks = familyTasksForCurrentPeriod();
    const info = planningCalendar.resolve(planningSelectedDate);
    const popup = window.open('', '_blank');
    if (!popup) return toast('Permite las ventanas emergentes para imprimir.', true);
    const logo = new URL('school-logo.webp', location.href).href;
    const school = familyPortalData.school || {};
    const chunks = [];
    for (let index = 0; index < Math.max(tasks.length, 1); index += 12) chunks.push(tasks.slice(index, index + 12));
    const pages = chunks.map(function (pageTasks, pageIndex) {
      const last = pageIndex === chunks.length - 1;
      return `<section class="weekly-page"><header><img src="${escapeHtml(logo)}"><div><p>${escapeHtml(school.name || 'Escuela Primaria Francisco Hoil Torres T.V.')}</p><h1>REPORTE SEMANAL DEL ALUMNO</h1></div></header><div class="student-data"><p><b>Alumno:</b> ${escapeHtml(familyPortalData.student.name)}</p><p><b>Grado y grupo:</b> ${escapeHtml(school.group || '4° A')}</p><p><b>Docente:</b> ${escapeHtml(school.teacher || 'Prof. Michel Otaner Polledo Nieves')}</p><p><b>${escapeHtml(info.title)}:</b> ${escapeHtml(info.rangeLabel.replace(/^Del /, ''))}</p></div><h2>TAREAS Y ACTIVIDADES DE LA SEMANA${pageIndex ? ' · CONTINUACIÓN' : ''}</h2><table><thead><tr><th>Fecha</th><th>Campo formativo</th><th>Tarea o actividad</th><th>Entregó</th><th>No entregó</th></tr></thead><tbody>${weeklyPrintRows(pageTasks)}</tbody></table>${last ? `<section class="notes"><h2>INDICACIONES PARA MADRES, PADRES O TUTORES</h2><ul><li>Revisar las actividades marcadas como no entregadas.</li><li>Firmar las tareas corregidas cuando el docente lo solicite.</li><li>Practicar lectura durante 15 minutos diarios.</li></ul></section><section class="observations"><h2>OBSERVACIONES DE LA SEMANA</h2><p>${escapeHtml(weeklyObservation(academic))}</p><i></i><i></i><i></i></section>` : ''}<footer>Este reporte corresponde únicamente a la semana indicada.</footer></section>`;
    }).join('');
    popup.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Reporte semanal</title><style>@page{size:letter portrait;margin:9mm}*{box-sizing:border-box}body{margin:0;color:#000;font-family:Arial,sans-serif;font-size:9pt}.weekly-page{min-height:250mm;position:relative;break-after:page;page-break-after:always;padding-bottom:9mm}.weekly-page:last-child{break-after:auto;page-break-after:auto}header{display:flex;align-items:center;justify-content:center;gap:8mm;padding-bottom:3mm}header img{width:14mm;height:14mm;object-fit:contain;filter:grayscale(1)}header div{text-align:center}header p{margin:0 0 1mm;font-size:10pt;font-weight:700}h1{margin:0;font-size:15pt}.student-data{display:grid;grid-template-columns:1.45fr .9fr;border:1px solid #000;margin:1mm 0 5mm}.student-data p{margin:0;padding:2.2mm 3mm;border-right:1px solid #000;border-bottom:1px solid #000}.student-data p:nth-child(2n){border-right:0}.student-data p:nth-last-child(-n+2){border-bottom:0}h2{margin:0;text-align:center;font-size:11pt;background:#eee;border:1px solid #000;padding:2mm}table{width:100%;border-collapse:collapse}th,td{border:1px solid #000;padding:2mm;vertical-align:middle}th{background:#f0f0f0}th:nth-child(1){width:17%}th:nth-child(2){width:23%}th:nth-child(4),th:nth-child(5){width:10%;text-align:center}.mark{text-align:center;font-size:15pt;font-weight:700}.notes,.observations{margin-top:4mm;border:1px solid #000}.notes h2,.observations h2{border-width:0 0 1px}.notes ul{margin:2.5mm 5mm;padding-left:5mm}.notes li{margin:1mm 0}.observations p{margin:2.5mm 4mm 1mm}.observations i{display:block;height:7mm;border-bottom:1px solid #888;margin:0 4mm}footer{position:absolute;bottom:0;width:100%;text-align:center;font-size:8pt}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>${pages}</body></html>`);
    popup.document.close();
    popup.focus();
    setTimeout(function () { popup.print(); }, 700);
  }

  printFamilyCredentials = function (credentials) {
    const rows = Array.isArray(credentials) ? credentials.filter(function (item) { return item && item.password; }) : [];
    if (!rows.length) return toast('Primero genera una contraseña temporal. Por seguridad, las contraseñas anteriores no se pueden volver a mostrar.', true);
    const popup = window.open('', '_blank');
    if (!popup) return toast('Permite las ventanas emergentes para imprimir.', true);
    const logo = new URL('school-logo.webp', location.href).href;
    const qr = new URL('family-access-qr.svg', location.href).href;
    const school = state.config.escuela || 'Escuela Primaria Francisco Hoil Torres T.V.';
    const cards = rows.map(function (item) {
      const nameLength = String(item.studentName || '').length;
      const nameClass = nameLength > 34 ? ' long' : nameLength > 25 ? ' medium' : '';
      const usernameLength = String(item.username || '').length;
      const usernameClass = usernameLength > 21 ? ' long' : usernameLength > 16 ? ' medium' : '';
      return `<article class="credential"><div class="credential-title">ACCESO FAMILIAR</div><header><img src="${escapeHtml(logo)}"><div><b>${escapeHtml(school)}</b><small>${escapeHtml(state.config.gradoGrupo || '4° A')} · ${escapeHtml(state.config.cicloEscolar || '2026-2027')}</small></div></header><h2 class="${nameClass.trim()}">${escapeHtml(item.studentName)}</h2><div class="credential-body"><div class="credential-access"><label>USUARIO</label><strong class="${usernameClass}">${escapeHtml(item.username)}</strong><label>CONTRASEÑA TEMPORAL</label><strong class="password">${escapeHtml(item.password)}</strong></div><figure><img src="${escapeHtml(qr)}"><figcaption>Escanea para entrar</figcaption></figure></div></article>`;
    });
    const pages = [];
    for (let index = 0; index < cards.length; index += 10) pages.push(`<section class="credential-sheet">${cards.slice(index, index + 10).join('')}</section>`);
    popup.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Credenciales familiares</title><style>@page{size:letter portrait;margin:4mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#0b315d}.credential-sheet{height:271mm;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:repeat(5,1fr);gap:1.4mm;break-after:page;page-break-after:always}.credential-sheet:last-child{break-after:auto;page-break-after:auto}.credential{border:1px dashed #1788b8;border-radius:2.2mm;padding:1mm 1.4mm;overflow:hidden;background:#fff}.credential-title{height:4.8mm;display:grid;place-items:center;border-radius:1.5mm;background:#10a9b0;color:#fff;font-size:8.8pt;font-weight:900;letter-spacing:.5px}.credential header{height:6.6mm;display:flex;align-items:center;gap:1.3mm;padding:.45mm .8mm 0}.credential header img{width:6mm;height:6mm;object-fit:contain}.credential header div{min-width:0}.credential header b{display:block;font-size:7pt;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.credential header small{display:block;font-size:6.1pt;line-height:1;margin-top:.35mm}.credential h2{height:7.4mm;font-size:13.5pt;line-height:7.4mm;margin:0 .8mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:900}.credential h2.medium{font-size:11.8pt}.credential h2.long{font-size:10pt}.credential-body{height:31.3mm;display:grid;grid-template-columns:minmax(0,1fr) 29mm;gap:1.3mm;align-items:center;background:#eef8f8;border-radius:1.8mm;padding:1.1mm 1.5mm}.credential-access{min-width:0;align-self:stretch;display:flex;flex-direction:column;justify-content:center}.credential-body label{display:block;font-size:6.5pt;line-height:1;color:#4e6f7b;font-weight:900;letter-spacing:.18px}.credential-body strong{display:block;font-size:14.5pt;line-height:1.04;margin:.45mm 0 1.65mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#0b315d;font-weight:900}.credential-body strong.medium{font-size:12.8pt}.credential-body strong.long{font-size:11.5pt}.credential-body strong.password{font-size:15.3pt;letter-spacing:.25px;margin-bottom:0}.credential figure{margin:0;text-align:center}.credential figure img{width:26.5mm;height:26.5mm;display:block;margin:auto}.credential figcaption{font-size:5.6pt;line-height:1;color:#35606b;margin-top:.35mm;font-weight:800}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>${pages.join('')}</body></html>`);
    popup.document.close();
    popup.focus();
    setTimeout(function () { popup.print(); }, 850);
  };

  document.addEventListener('DOMContentLoaded', function () {
    ensureFamilyPlanningShell();
    renderFamilyPlanningPanel();
    Object.assign(actions, {
      'family-open-planning-date': function () { const input = $('#familyPlanningDateInput'); if (!input) return; try { if (typeof input.showPicker === 'function') input.showPicker(); else { input.classList.add('is-visible'); input.focus(); input.click(); } } catch (error) { input.classList.add('is-visible'); input.focus(); } },
      'family-planning-today': function () { setFamilyPlanningDate(planningCalendar.today(), true, true); },
      'family-select-planning-day': function (button) { setFamilyPlanningDate(button.dataset.date, true, false); },
      'family-view-weekly-report': function () { openFamilyWeeklyReport(); },
      'family-print-weekly-report': function () { printFamilyWeeklyReport(); },
      'family-report-back': function () { showFamilyView('familyOverview'); $('.family-bottom-nav [data-family-bottom-view="familyOverview"]').classList.add('active'); }
    });
    setInterval(function () {
      const currentToday = planningCalendar.today();
      if (currentToday === planningLastToday) return;
      planningLastToday = currentToday;
      if (planningFollowsToday && familySessionToken && !$('#familyAppPanel').classList.contains('hidden-control')) {
        setFamilyPlanningDate(currentToday, true, true);
      }
    }, 60000);
  });
})();
