/* Mejoras acumulativas v1.4: navegación, instrumentos, entregas y portal familiar. */
(function(){
  const INSTRUMENT_TYPE_LABELS={RUBRICA:'Rúbrica',LISTA_COTEJO:'Lista de cotejo',ESCALA_VALORACION:'Escala de valoración',EXAMEN:'Examen',CUESTIONARIO:'Cuestionario'};
  const INSTRUMENT_TYPE_CLASSES={RUBRICA:'rubric',LISTA_COTEJO:'checklist',ESCALA_VALORACION:'scale',EXAMEN:'exam',CUESTIONARIO:'quiz'};
  const PERFORMANCE_LEVELS=[{code:'NE',label:'Nivel esperado',value:10,color:'#26a269'},{code:'EN',label:'En desarrollo',value:7,color:'#e4a11b'},{code:'RA',label:'Requiere apoyo',value:5,color:'#d94b4b'}];
  const CHECKLIST_LEVELS=[{code:'C',label:'Cumple',value:10,color:'#26a269'},{code:'NC',label:'No cumple',value:0,color:'#d94b4b'}];
  let nemCatalogPromise=null;

  function loadNemCatalog(){
    if(window.NEM4_CATALOG)return Promise.resolve(window.NEM4_CATALOG);
    if(nemCatalogPromise)return nemCatalogPromise;
    nemCatalogPromise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='nem4-catalog.js';script.async=true;script.onload=()=>window.NEM4_CATALOG?resolve(window.NEM4_CATALOG):reject(new Error('El catálogo curricular no pudo leerse.'));script.onerror=()=>reject(new Error('No se pudo cargar el catálogo oficial de 4.º.'));document.head.appendChild(script)});
    return nemCatalogPromise;
  }
  const catalogRows=()=>window.NEM4_CATALOG?.registros||[];
  const typeLabel=type=>INSTRUMENT_TYPE_LABELS[type]||type||'Instrumento';
  const instrumentLevels=instrument=>instrument?.niveles?.length?instrument.niveles:(instrument?.tipo==='LISTA_COTEJO'?CHECKLIST_LEVELS:PERFORMANCE_LEVELS);
  const levelOptions=(instrument,selected='')=>instrumentLevels(instrument).map(level=>`<option value="${escapeHtml(level.code)}" ${String(selected)===String(level.code)?'selected':''}>${escapeHtml(level.code)} · ${escapeHtml(level.label)}</option>`).join('');
  const currentInstrument=()=> (state.instruments||[]).find(item=>String(item.id)===String($('#classInstrument')?.value||''));

  function renderInstrumentOptions(){
    const select=$('#classInstrument');if(!select)return;
    const previous=select.value;
    select.innerHTML='<option value="">Evaluación sencilla (entrega, conducta y participación)</option>'+(state.instruments||[]).map(item=>`<option value="${escapeHtml(item.id)}">${escapeHtml(item.titulo)} · ${escapeHtml(typeLabel(item.tipo))}</option>`).join('');
    if([...select.options].some(option=>option.value===previous))select.value=previous;
  }
  const originalRenderAll=renderAll;
  renderAll=function(){originalRenderAll();renderInstrumentOptions();renderInstruments()};
  const originalRenderClassOptions=renderClassOptions;
  renderClassOptions=function(){originalRenderClassOptions();renderInstrumentOptions()};

  function renderInstruments(){
    const host=$('#instrumentGrid');if(!host)return;
    const query=($('#instrumentSearch')?.value||'').trim().toLowerCase(),type=$('#instrumentTypeFilter')?.value||'';
    const rows=(state.instruments||[]).filter(item=>(!query||[item.titulo,item.descripcion,item.campoFormativo,item.area,item.contenido,...(item.pda||[])].join(' ').toLowerCase().includes(query))&&(!type||item.tipo===type));
    host.innerHTML=rows.length?rows.map(item=>`<article class="instrument-card"><div class="instrument-card-head"><span class="instrument-kind ${INSTRUMENT_TYPE_CLASSES[item.tipo]||''}">${escapeHtml(typeLabel(item.tipo))}</span><span class="badge">v${item.version||1}</span></div><h2>${escapeHtml(item.titulo)}</h2><p>${escapeHtml(item.descripcion||item.contenido||'Sin descripción')}</p><small>${escapeHtml(item.campoFormativo||'Instrumento general')}${item.area&&item.area!==item.campoFormativo?' · '+escapeHtml(item.area):''} · ${item.tipo==='EXAMEN'?'calificación directa':(item.criterios||[]).length+' elemento(s)'}</small>${item.contenido?`<div class="instrument-curricular-summary"><b>Contenido:</b> ${escapeHtml(item.contenido)}</div>`:''}<ul>${(item.criterios||[]).slice(0,3).map(row=>`<li>${escapeHtml(row.texto)}</li>`).join('')}${(item.criterios||[]).length>3?'<li>…</li>':''}</ul><div class="button-row"><button class="btn small" data-action="edit-instrument" data-id="${escapeHtml(item.id)}">Editar</button><button class="btn small" data-action="duplicate-instrument" data-id="${escapeHtml(item.id)}">Duplicar</button><button class="btn danger small" data-action="deactivate-instrument" data-id="${escapeHtml(item.id)}">Desactivar</button></div></article>`).join(''):'<article class="panel"><strong>No hay instrumentos con esos filtros.</strong><p class="muted">Crea un instrumento a partir de los contenidos y PDA oficiales de 4.º.</p></article>';
  }
  function criterionRow(value='',weight=1,id=''){return `<div class="instrument-criterion"><input type="hidden" data-criterion-id value="${escapeHtml(id)}"><label><span class="criterion-label">Indicador o reactivo</span><textarea data-criterion-text rows="2" placeholder="Escribe el indicador que se evaluará" required>${escapeHtml(value)}</textarea></label><label>Valor<input data-criterion-weight type="number" min="0.1" step="0.1" value="${Number(weight)||1}" required></label><button type="button" class="icon-button danger-link" data-action="remove-instrument-criterion" aria-label="Eliminar criterio">×</button></div>`}
  function unique(values){return [...new Set(values.filter(Boolean))]}
  function setSelectOptions(select,values,placeholder){select.innerHTML=`<option value="">${escapeHtml(placeholder)}</option>`+values.map(value=>`<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');select.disabled=!values.length}
  function populateInstrumentSubjects(selected=''){
    const values=unique(catalogRows().map(row=>row.campoFormativo));setSelectOptions($('#instrumentSubject'),values,'Selecciona');if(selected)$('#instrumentSubject').value=selected;
  }
  function populateInstrumentAreas(selected=''){
    const field=$('#instrumentSubject').value;const values=unique(catalogRows().filter(row=>row.campoFormativo===field).map(row=>row.area));setSelectOptions($('#instrumentArea'),values,field?'Selecciona un área':'Selecciona un campo');if(selected)$('#instrumentArea').value=selected;
  }
  function populateInstrumentContents(selected=''){
    const field=$('#instrumentSubject').value,area=$('#instrumentArea').value;const rows=catalogRows().filter(row=>row.campoFormativo===field&&row.area===area);const select=$('#instrumentContent');select.innerHTML='<option value="">Selecciona un contenido</option>'+rows.map(row=>`<option value="${escapeHtml(row.id)}">${escapeHtml(row.contenido)}</option>`).join('');select.disabled=!rows.length;if(selected)select.value=selected;
  }
  function selectedCatalogContent(){return catalogRows().find(row=>row.id===$('#instrumentContent').value)}
  function renderInstrumentPdas(selected=[]){
    const host=$('#instrumentPdaList'),content=selectedCatalogContent();$('#instrumentContentText').value=content?.contenido||'';
    if(!content){host.innerHTML='<p class="muted">Selecciona primero un contenido.</p>';return}
    if(!content.pda?.length){host.innerHTML='<div class="instrument-no-pda"><b>Este contenido no tiene un PDA específico en la columna de 4.º.</b><p>Puedes conservar el contenido y redactar manualmente el indicador del instrumento.</p></div>';return}
    host.innerHTML=content.pda.map((pda,index)=>`<label><input type="checkbox" data-instrument-pda value="${index}" ${selected.includes(pda)?'checked':''}><span><b>PDA ${index+1}</b>${escapeHtml(pda)}</span></label>`).join('');
  }
  function selectedPdas(){
    const content=selectedCatalogContent();if(!content)return[];
    const indexes=new Set($$('[data-instrument-pda]:checked',$('#instrumentPdaList')).map(input=>Number(input.value)));
    return content.pda.filter((pda,index)=>indexes.has(index));
  }
  function selectedInstrumentType(){return $('#instrumentForm input[name="tipo"]:checked')?.value||'RUBRICA'}
  function compactCriterion(text,max=118){const clean=String(text||'').replace(/\s+/g,' ').replace(/[.;:]$/,'').trim();return clean.length>max?clean.slice(0,max-1).replace(/\s+\S*$/,'')+'…':clean}
  function instrumentBankCriteria(pda,type,content){
    if(type==='CUESTIONARIO')return [{texto:`Explica: ${compactCriterion(pda,105)}`,peso:1},{texto:`Aplica lo aprendido en una situación relacionada con “${compactCriterion(content.contenido,70)}”.`,peso:1}];
    const rows=[compactCriterion(pda)];
    const area=String(content.area||''),field=String(content.campoFormativo||'');
    if(/Matemático/i.test(area))rows.push('Aplica el procedimiento de manera ordenada.','Explica cómo obtuvo su resultado.','Comprueba que su respuesta sea correcta.');
    else if(/Científico/i.test(area))rows.push('Observa, registra o compara la información relevante.','Explica sus hallazgos con base en lo estudiado.','Relaciona el aprendizaje con una situación de su entorno.');
    else if(/Lenguajes/i.test(field))rows.push('Comunica sus ideas con orden y claridad.','Utiliza los elementos del lenguaje solicitados.','Revisa y mejora su producción antes de entregarla.');
    else if(/Ética|Naturaleza|Sociedades/i.test(field))rows.push('Reconoce la situación o problema planteado.','Explica su opinión con respeto y argumentos.','Relaciona lo aprendido con su comunidad o vida cotidiana.');
    else rows.push('Participa responsablemente en la actividad.','Explica lo aprendido con sus propias palabras.','Aplica el aprendizaje en una situación cotidiana.');
    return unique(rows).map(text=>({texto:text,peso:1}));
  }
  function generatedTitle(type,content){const prefix=typeLabel(type);const short=String(content||'Instrumento de 4.º').replace(/[.]$/,'');return `${prefix}: ${short.length>72?short.slice(0,69)+'…':short}`}
  function updateInstrumentTypeUi(){
    const type=selectedInstrumentType(),isExam=type==='EXAMEN';$('#instrumentCriteriaBlock').classList.toggle('hidden-control',isExam);$('#instrumentCriteriaTitle').textContent=type==='CUESTIONARIO'?'Reactivos':'Criterios o indicadores';
    $('#instrumentLevelNote').innerHTML=type==='LISTA_COTEJO'?'<b>Opciones:</b> C · Cumple (10) y NC · No cumple (0).':isExam?'<b>Evaluación:</b> al registrar la actividad se captura directamente una calificación de 0 a 10.':'<b>Niveles:</b> NE · Nivel esperado (10), EN · En desarrollo (7), RA · Requiere apoyo (5).';
    $$('.criterion-label').forEach(label=>label.textContent=type==='CUESTIONARIO'?'Reactivo':'Indicador');
  }
  function renderInstrumentGeneratedPreview(){
    const content=selectedCatalogContent(),pdas=selectedPdas(),type=selectedInstrumentType(),host=$('#instrumentGeneratedPreview');if(!content){host.innerHTML='<span>VISTA PREVIA</span><h4>Selecciona un contenido y un PDA</h4><p>Aquí verás el resumen curricular del instrumento.</p>';return}
    host.innerHTML=`<span>VISTA PREVIA · ${escapeHtml(typeLabel(type))}</span><h4>${escapeHtml(content.contenido)}</h4><p><b>${escapeHtml(content.campoFormativo)}</b>${content.area!==content.campoFormativo?' · '+escapeHtml(content.area):''}</p><ul>${pdas.length?pdas.map(pda=>`<li>${escapeHtml(pda)}</li>`).join(''):'<li>Sin PDA específico para 4.º; los indicadores se redactarán manualmente.</li>'}</ul>`;
  }
  function generateInstrumentDraft(forceTitle=false){
    const content=selectedCatalogContent(),pdas=selectedPdas(),type=selectedInstrumentType(),form=$('#instrumentForm');updateInstrumentTypeUi();renderInstrumentGeneratedPreview();if(!content)return;
    const title=generatedTitle(type,content.contenido);if(forceTitle||!form.elements.titulo.value||form.elements.titulo.dataset.generated==='1'){form.elements.titulo.value=title;form.elements.titulo.dataset.generated='1'}
    if(!form.elements.descripcion.value)form.elements.descripcion.value=`Instrumento para valorar ${pdas.length?pdas.length+' PDA del contenido seleccionado':'el contenido seleccionado'}.`;
    if(type==='EXAMEN'){$('#instrumentCriteria').innerHTML='';return}
    const rows=pdas.length?[].concat(...pdas.map(pda=>instrumentBankCriteria(pda,type,content))):instrumentBankCriteria(content.contenido,type,content);$('#instrumentCriteria').innerHTML=rows.map(row=>criterionRow(row.texto,row.peso,'')).join('');updateInstrumentTypeUi();
  }
  function instrumentDraftExtra(){return{pda:selectedPdas(),criterios:$$('.instrument-criterion',$('#instrumentForm')).map((row,index)=>({id:$('[data-criterion-id]',row).value||`CRI-${index+1}`,texto:$('[data-criterion-text]',row).value,peso:Number($('[data-criterion-weight]',row).value||1)}))}}
  function scheduleInstrumentDraft(){scheduleDraftSave($('#instrumentForm'),DRAFT_KEYS.instrument,instrumentDraftExtra,'instrumentDraftStatus')}
  async function openInstrument(item=null){
    const form=$('#instrumentForm');form.reset();form.elements.id.value=item?.id||'';form.elements.titulo.value=item?.titulo||'';form.elements.titulo.dataset.generated='0';form.elements.descripcion.value=item?.descripcion||'';$('#instrumentDialogTitle').textContent=item?'Editar instrumento':'Nuevo instrumento';$('#instrumentPdaList').innerHTML='<p class="muted">Cargando catálogo oficial…</p>';$('#instrumentDialog').showModal();
    try{await loadNemCatalog();const draft=readDraft(DRAFT_KEYS.instrument),canRestore=draft&&((!item?.id&&!draft.data?.id)||(item?.id&&String(draft.data?.id)===String(item.id))),source=canRestore?draft.data:{};populateInstrumentSubjects(source.campoFormativo||item?.campoFormativo||'');populateInstrumentAreas(source.area||item?.area||'');populateInstrumentContents(source.contenidoId||item?.contenidoId||'');renderInstrumentPdas(canRestore?(draft.extra?.pda||[]):(item?.pda||[]));const radio=form.querySelector(`input[name="tipo"][value="${source.tipo||item?.tipo||'RUBRICA'}"]`);if(radio)radio.checked=true;if(canRestore)restoreFormDraft(form,draft.data);const criteria=canRestore?(draft.extra?.criterios||[]):(item?.criterios?.length?item.criterios:(item?.tipo==='EXAMEN'?[]:[{texto:'',peso:1}]));$('#instrumentCriteria').innerHTML=criteria.map(row=>criterionRow(row.texto,row.peso,row.id)).join('');updateInstrumentTypeUi();renderInstrumentGeneratedPreview();if(canRestore){showDraftStatus('instrumentDraftStatus',draft.updatedAt);toast('Se recuperó el borrador del instrumento.')}else $('#instrumentDraftStatus')?.classList.add('hidden-control');
      if(item&&!item.contenidoId){$('#instrumentSubject').required=false;$('#instrumentArea').required=false;$('#instrumentContent').required=false;$('#instrumentPdaList').innerHTML='<div class="instrument-no-pda"><b>Instrumento anterior sin vínculo curricular.</b><p>Puede conservarlo así o seleccionar ahora un contenido y PDA oficial.</p></div>'}else{$('#instrumentSubject').required=true;$('#instrumentArea').required=true;$('#instrumentContent').required=true}
    }catch(error){$('#instrumentPdaList').innerHTML=`<div class="instrument-no-pda"><b>No se pudo cargar el catálogo.</b><p>${escapeHtml(error.message)}</p></div>`;toast(error.message,'error')}
  }
  async function saveInstrument(event){
    event.preventDefault();const form=event.currentTarget,payload=formData(form),content=selectedCatalogContent();payload.tipo=selectedInstrumentType();payload.contenido=content?.contenido||form.elements.contenido.value||'';payload.pda=selectedPdas();payload.origenCurricular=content?'SEP Programa de Estudio Fase 4, edición 2025':'';payload.configuracion={grado:'4°',fuente:window.NEM4_CATALOG?.fuente||'',paginaFuente:content?.paginaFuente||''};payload.niveles=payload.tipo==='LISTA_COTEJO'?CHECKLIST_LEVELS:PERFORMANCE_LEVELS;payload.criterios=$$('.instrument-criterion',form).map((row,index)=>({id:$('[data-criterion-id]',row).value||`CRI-${index+1}`,texto:$('[data-criterion-text]',row).value,peso:Number($('[data-criterion-weight]',row).value||1)}));
    if(content?.pda?.length&&!payload.pda.length){toast('Selecciona por lo menos un PDA.','error');return}
    await runAction(async()=>{const result=await server('saveEvaluationInstrument',payload);clearDraft(DRAFT_KEYS.instrument,'instrumentDraftStatus');state.instruments=result.instruments||[];$('#instrumentDialog').close();renderInstruments();renderInstrumentOptions();toast(result.message)});
  }
  function updateInstrumentChoice(){const item=currentInstrument(),summary=$('#classInstrumentSummary');if(summary)summary.innerHTML=item?`<b>${escapeHtml(item.titulo)}</b> · ${escapeHtml(typeLabel(item.tipo))} · ${item.tipo==='EXAMEN'?'calificación de 0 a 10':(item.criterios||[]).length+' elemento(s)'}`:'Puedes evaluar únicamente la entrega o seleccionar un instrumento reutilizable.';renderEvaluationList()}

  let compactStudentIndex=0;
  const originalOpenClassFormCompact=openClassForm;
  openClassForm=async function(){compactStudentIndex=0;return originalOpenClassFormCompact.apply(this,arguments)};
  defaultEvaluation=function(studentId){return {alumnoId:studentId,trabajo:'Completo',conducta:'Adecuada',participacion:'Media',desempeno:'',observacionLibre:'',instrumentResults:{}}};
  function instrumentResultSummary(instrument,selections){
    if(!instrument)return null;
    if(instrument.tipo==='EXAMEN'){const grade=selections.__grade===''||selections.__grade==null?null:Math.max(0,Math.min(10,Number(selections.__grade))),label=grade==null?'Sin calificar':grade>=8.5?'Aprendizaje logrado':grade>=6?'Aprendizaje en desarrollo':'Requiere apoyo';return{grade:grade,label:label,message:grade==null?'Captura la calificación para generar el mensaje.':label==='Aprendizaje logrado'?'Logró los aprendizajes evaluados y puede aplicarlos en nuevas actividades.':label==='Aprendizaje en desarrollo'?'Ha mostrado avances, pero necesita continuar practicando los contenidos evaluados.':'Requiere apoyo y acompañamiento para consolidar los contenidos evaluados.'}}
    const levels=instrumentLevels(instrument),max=Math.max(...levels.map(level=>Number(level.value)||0),1);let points=0,weights=0;
    (instrument.criterios||[]).forEach(criterion=>{const fallback=levels[levels.length-1]?.code,level=levels.find(item=>item.code===String(selections[criterion.id]||fallback))||levels[levels.length-1],weight=Number(criterion.peso||1);points+=(Number(level?.value||0)/max)*weight;weights+=weight});
    const grade=weights?Math.round(points/weights*100)/10:0,label=grade>=8.5?'Aprendizaje logrado':grade>=6?'Aprendizaje en desarrollo':'Requiere apoyo',message=label==='Aprendizaje logrado'?'Logró los criterios evaluados con seguridad y puede continuar aplicándolos.':label==='Aprendizaje en desarrollo'?'Ha mostrado avances; necesita seguir practicando los criterios que aún no cumple.':'Requiere apoyo para consolidar los criterios evaluados mediante práctica acompañada.';return{grade:grade,label:label,message:message};
  }
  function criterionButtons(instrument,criterion,selected){
    const levels=instrumentLevels(instrument),fallback=levels[levels.length-1]?.code,current=String(selected||fallback);
    if(instrument.tipo==='LISTA_COTEJO'){const checked=current==='C';return `<button type="button" class="criterion-check ${checked?'selected':''}" data-instrument-criterion="${escapeHtml(criterion.id)}" data-level="${checked?'NC':'C'}"><i>${checked?'✓':''}</i><span>${escapeHtml(criterion.texto)}</span><b>${checked?'Cumplió':'Marcar si cumplió'}</b></button>`}
    return `<div class="criterion-performance"><span>${escapeHtml(criterion.texto)}</span><div>${levels.map(level=>`<button type="button" class="criterion-level ${current===level.code?'selected level-'+level.code.toLowerCase():''}" data-instrument-criterion="${escapeHtml(criterion.id)}" data-level="${escapeHtml(level.code)}"><b>${escapeHtml(level.code)}</b><small>${escapeHtml(level.label)}</small></button>`).join('')}</div></div>`;
  }
  renderEvaluationList=function(){
    const host=$('#evaluationList'),students=state.classStudents||[];if(!students.length){host.innerHTML='<div class="empty-history"><strong>No hay alumnos disponibles para evaluar</strong><p>Guarda primero la asistencia del día.</p></div>';$('#evaluationProgress').textContent='0 alumnos disponibles';return}
    compactStudentIndex=Math.max(0,Math.min(compactStudentIndex,students.length-1));const student=students[compactStudentIndex],row=state.classEvaluations[student.id]||defaultEvaluation(student.id),instrument=currentInstrument(),selections=row.instrumentResults||{},summary=instrumentResultSummary(instrument,selections);
    const instrumentControl=instrument?(instrument.tipo==='EXAMEN'?`<label class="instrument-direct-grade"><span>Calificación del examen</span><input type="number" min="0" max="10" step="0.1" data-instrument-grade value="${escapeHtml(selections.__grade??'')}"></label>`:(instrument.criterios||[]).map(criterion=>criterionButtons(instrument,criterion,selections[criterion.id])).join('')):'';
    host.innerHTML=`<nav class="student-evaluation-nav"><button type="button" class="btn" data-action="student-eval-prev" ${compactStudentIndex===0?'disabled':''}>← Anterior</button><label><span>Alumno ${compactStudentIndex+1} de ${students.length}</span><select id="compactStudentSelect">${students.map((item,index)=>`<option value="${index}" ${index===compactStudentIndex?'selected':''}>${escapeHtml(fullName(item))}</option>`).join('')}</select></label><button type="button" class="btn" data-action="student-eval-next" ${compactStudentIndex===students.length-1?'disabled':''}>Siguiente →</button></nav><article class="evaluation-row compact ${instrument?'with-instrument':''}" data-student="${student.id}"><div class="compact-student-title"><span>${compactStudentIndex+1}</span><div><small>EVALUANDO A</small><strong>${escapeHtml(fullName(student))}</strong></div></div><div class="compact-basic-fields"><label>Entrega<select data-field="trabajo"><option ${row.trabajo==='Completo'?'selected':''}>Completo</option><option ${row.trabajo==='Incompleto'?'selected':''}>Incompleto</option><option ${row.trabajo==='No trabajó'?'selected':''}>No trabajó</option></select></label><label>Conducta<select data-field="conducta"><option ${row.conducta==='Excelente'?'selected':''}>Excelente</option><option ${row.conducta==='Adecuada'?'selected':''}>Adecuada</option><option ${row.conducta==='Requiere apoyo'?'selected':''}>Requiere apoyo</option></select></label><label>Participación<select data-field="participacion"><option ${row.participacion==='Alta'?'selected':''}>Alta</option><option ${row.participacion==='Media'?'selected':''}>Media</option><option ${row.participacion==='Nula'?'selected':''}>Nula</option></select></label></div>${instrument?`<div class="instrument-evaluation compact-instrument"><div class="instrument-evaluation-title"><div><small>${escapeHtml(typeLabel(instrument.tipo))}</small><b>${escapeHtml(instrument.titulo)}</b></div><span class="instrument-grade" data-grade>${summary?.grade==null?'—':summary.grade.toFixed(1)}</span></div><p class="instrument-result-label" data-result-label>${escapeHtml(summary?.label||'Sin calificar')}</p><p class="instrument-result-message" data-result-message>${escapeHtml(summary?.message||'')}</p><div class="compact-criteria">${instrumentControl}</div></div>`:`<label class="rubric-field">Observación predeterminada<select data-field="desempeno">${rubricOptions(row.desempeno)}</select></label>`}<label class="note-field">Observación adicional<input data-field="observacionLibre" value="${escapeHtml(row.observacionLibre||'')}" placeholder="Opcional"></label></article>`;
    $('#compactStudentSelect').addEventListener('change',event=>{compactStudentIndex=Number(event.target.value)||0;renderEvaluationList();window.scrollTo({top:$('#evaluationList').getBoundingClientRect().top+scrollY-120,behavior:'smooth'})});$('#evaluationProgress').textContent=`Alumno ${compactStudentIndex+1} de ${students.length} · ${fullName(student)}`;
  };
  function updateInstrumentPreview(row){const instrument=currentInstrument(),studentId=row?.dataset.student,record=state.classEvaluations[studentId];if(!instrument||!record)return;const summary=instrumentResultSummary(instrument,record.instrumentResults||{}),grade=$('[data-grade]',row),label=$('[data-result-label]',row),message=$('[data-result-message]',row);if(grade)grade.textContent=summary?.grade==null?'—':summary.grade.toFixed(1);if(label)label.textContent=summary?.label||'Sin calificar';if(message)message.textContent=summary?.message||''}
  function selectInstrumentLevel(button){const row=button.closest('[data-student]'),record=state.classEvaluations[row.dataset.student];record.instrumentResults=record.instrumentResults||{};record.instrumentResults[button.dataset.instrumentCriterion]=button.dataset.level;scheduleDraftSave($('#classForm'),DRAFT_KEYS.classRecord,()=>({evaluations:state.classEvaluations}),'classDraftStatus');renderEvaluationList()}
  function moveCompactStudent(delta){compactStudentIndex=Math.max(0,Math.min((state.classStudents||[]).length-1,compactStudentIndex+delta));renderEvaluationList();$('#evaluationList')?.scrollIntoView({behavior:'smooth',block:'start'})}
  function collapseClassSetup(){const form=$('#classForm');if(!form.reportValidity())return;writeDraft(form,DRAFT_KEYS.classRecord,()=>({evaluations:state.classEvaluations}),'classDraftStatus');$('.class-data-panel',form)?.classList.add('hidden-control');$('#classCompactName').textContent=form.elements.actividad.value;$('#classCompactMeta').textContent='Fecha: '+formatDateShort(form.elements.fecha.value);$('#classCompactSummary').classList.remove('hidden-control');$('#evaluationList')?.scrollIntoView({behavior:'smooth',block:'start'})}
  function expandClassSetup(){$('.class-data-panel',$('#classForm'))?.classList.remove('hidden-control');$('#classCompactSummary')?.classList.add('hidden-control');$('.class-data-panel',$('#classForm'))?.scrollIntoView({behavior:'smooth',block:'start'})}
  const originalUpdateClassEvaluation=updateClassEvaluation;
  updateClassEvaluation=function(event){const control=event.target.closest('[data-instrument-criterion],[data-instrument-grade]');if(control){const row=control.closest('[data-student]'),record=state.classEvaluations[row.dataset.student];record.instrumentResults=record.instrumentResults||{};if(control.matches('[data-instrument-grade]'))record.instrumentResults.__grade=control.value;else record.instrumentResults[control.dataset.instrumentCriterion]=control.value;updateInstrumentPreview(row);scheduleDraftSave($('#classForm'),DRAFT_KEYS.classRecord,()=>({evaluations:state.classEvaluations}),'classDraftStatus');return}originalUpdateClassEvaluation(event)};

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
  function taskLine(task){return `<article class="family-task-line ${taskStatusClass(task.status)}"><div><span>${escapeHtml(formatDateShort(task.date))} · ${escapeHtml(formatTime(task.start))}–${escapeHtml(formatTime(task.end))}</span><h4>${escapeHtml(task.name)}</h4><p>${escapeHtml(task.source||'')} · ${escapeHtml(task.project||'Sin proyecto')}</p></div><b>${escapeHtml(task.status)}</b>${task.instrumentGrade!=null?`<small>${escapeHtml(task.instrumentLevel||'Instrumento')} · ${Number(task.instrumentGrade).toFixed(1)}</small>`:''}${task.feedback?`<p class="learning-feedback">${escapeHtml(task.feedback)}</p>`:task.opportunities?`<p class="opportunity"><b>Área de oportunidad:</b> ${escapeHtml(task.opportunities)}</p>`:''}</article>`}
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
      'add-instrument-criterion':()=>{$('#instrumentCriteria').insertAdjacentHTML('beforeend',criterionRow());updateInstrumentTypeUi();scheduleInstrumentDraft()},'remove-instrument-criterion':button=>{button.closest('.instrument-criterion')?.remove();scheduleInstrumentDraft()},'regenerate-instrument':()=>{generateInstrumentDraft(true);scheduleInstrumentDraft()},'discard-instrument-draft':()=>discardDraft(DRAFT_KEYS.instrument,'instrumentDraftStatus'),
      'student-eval-prev':()=>moveCompactStudent(-1),'student-eval-next':()=>moveCompactStudent(1),'continue-class-evaluation':()=>collapseClassSetup(),'edit-class-setup':()=>expandClassSetup(),
      'payment-delivery':button=>openDelivery(button.dataset.id),'undo-payment-delivery':async button=>{if(!confirm('¿Marcar el producto como no entregado?'))return;await runAction(async()=>{const result=await server('setPaymentDelivery',{eventId:state.paymentDetail.event.id,studentId:button.dataset.id,delivered:false});state.paymentDetail=result.detail;renderPaymentDetail();toast(result.message)})},
      'family-change-account':()=>familyLogout(false,'Sesión cerrada. Ya puede entrar otra familia.')
    });
    $('#instrumentForm')?.addEventListener('submit',saveInstrument);$('#instrumentSearch')?.addEventListener('input',renderInstruments);$('#instrumentTypeFilter')?.addEventListener('change',renderInstruments);$('#classInstrument')?.addEventListener('change',updateInstrumentChoice);$('#evaluationList')?.addEventListener('click',event=>{const button=event.target.closest('[data-instrument-criterion][data-level]');if(button)selectInstrumentLevel(button)});$('#deliveryForm')?.addEventListener('submit',saveDelivery);$('#paymentRequiresDelivery')?.addEventListener('change',event=>{const field=$('#paymentProductField');field.classList.toggle('hidden-control',!event.target.checked);field.querySelector('input').required=event.target.checked});
    $('#instrumentSubject')?.addEventListener('change',()=>{populateInstrumentAreas();populateInstrumentContents();renderInstrumentPdas();renderInstrumentGeneratedPreview()});
    $('#instrumentArea')?.addEventListener('change',()=>{populateInstrumentContents();renderInstrumentPdas();renderInstrumentGeneratedPreview()});
    $('#instrumentContent')?.addEventListener('change',()=>{renderInstrumentPdas();generateInstrumentDraft(true)});
    $('#instrumentPdaList')?.addEventListener('change',event=>{if(event.target.matches('[data-instrument-pda]'))generateInstrumentDraft(false)});
    $('#instrumentForm')?.addEventListener('change',event=>{if(event.target.matches('input[name="tipo"]'))generateInstrumentDraft(true)});
    installDraftAutosave($('#instrumentForm'),DRAFT_KEYS.instrument,instrumentDraftExtra,'instrumentDraftStatus');
    window.addEventListener('pagehide',()=>{if($('#instrumentDialog')?.open)writeDraft($('#instrumentForm'),DRAFT_KEYS.instrument,instrumentDraftExtra,'instrumentDraftStatus')});
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
    return `<article class="family-task-line ${status.className}"><div><span>${escapeHtml(formatDateShort(task.date))} · ${escapeHtml(formatTime(task.start))}${task.end ? '–' + escapeHtml(formatTime(task.end)) : ''}</span><h4>${escapeHtml(task.name)}</h4><p>${escapeHtml(task.source || '')} · ${escapeHtml(task.project || 'Sin proyecto')}</p></div><b class="family-task-status">${status.icon} ${status.label}</b>${task.feedback ? `<p class="learning-feedback">${escapeHtml(task.feedback)}</p>` : task.opportunities ? `<p class="opportunity"><b>Área de oportunidad:</b> ${escapeHtml(task.opportunities)}</p>` : ''}</article>`;
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
    const feedback = familyTasksForCurrentPeriod().map(function(task){return task.feedback;}).filter(Boolean);
    if (feedback.length) return Array.from(new Set(feedback)).join(' ');
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
      return `<article><time>${escapeHtml(formatDateShort(task.date))}</time><div><small>${escapeHtml(task.source || 'Campo formativo')}</small><h3>${escapeHtml(task.name)}</h3><p>${escapeHtml(formatTime(task.start))}${task.end ? '–' + escapeHtml(formatTime(task.end)) : ''}${task.project ? ' · ' + escapeHtml(task.project) : ''}</p>${task.feedback?`<p class="learning-feedback">${escapeHtml(task.feedback)}</p>`:''}</div><strong class="${status.className}">${status.icon} ${status.label}</strong></article>`;
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
