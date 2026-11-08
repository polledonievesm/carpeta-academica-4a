/* ==========================================================================
   MÓDULO DE VISTA: EVALUACIÓN, CALIFICACIONES, TRIMESTRES Y REPORTES CONSOLIDADOS
   ========================================================================== */
function openGrades(){showView('grades');loadGrades(false)}
async function loadGrades(force=false){if(state.grades&&!force){renderGradeOptions();return}await runAction(async()=>{state.grades=await server('getGradesInitialData');renderGradeOptions()})}
function renderGradeOptions(){const select=$('#gradeSubject');const current=select.value;select.innerHTML='<option value="">Selecciona</option>'+state.grades.subjects.map(s=>`<option>${escapeHtml(s.nombre)}</option>`).join('');if([...select.options].some(o=>o.value===current))select.value=current}
async function loadGradeWeights(){const trimester=$('#gradeTrimester').value,subject=$('#gradeSubject').value;if(!subject)return toast('Selecciona un campo formativo.',true);await runAction(async()=>{state.gradeWeights=await server('getGradeWeights',trimester,subject);renderGradeWeights();$('#gradeWeightsPanel').classList.remove('hidden-control')})}
function renderGradeWeights(){const host=$('#gradeWeightsList');host.innerHTML='';state.gradeWeights.forEach(addGradeCriterion);updateGradeWeightTotal()}
function addGradeCriterion(row={}){const automatic=['Tareas','Asistencia','Participación','Conducta','Puntualidad'];const wrapper=document.createElement('div');wrapper.className='grade-weight-row';wrapper.dataset.id=row.id||'';wrapper.innerHTML=`<input class="input" data-grade-name value="${escapeHtml(row.criterio||'')}" placeholder="Nombre del criterio"><select data-grade-type><option value="MANUAL">Captura manual</option><option value="AUTOMATICO">Cálculo automático</option></select><input data-grade-percent type="number" min="0" max="100" step="0.5" value="${row.porcentaje??0}"><span>%</span><button type="button" class="btn danger small" data-action="remove-grade-criterion">Quitar</button>`;wrapper.querySelector('[data-grade-type]').value=row.tipo||(automatic.includes(row.criterio)?'AUTOMATICO':'MANUAL');$('#gradeWeightsList').appendChild(wrapper);updateGradeWeightTotal()}
function updateGradeWeightTotal(){const total=$$('[data-grade-percent]').reduce((sum,input)=>sum+Number(input.value||0),0);const badge=$('#gradeWeightTotal');badge.textContent=total+'%';badge.classList.toggle('danger-state',Math.abs(total-100)>.001)}
function collectGradeWeights(){return $$('.grade-weight-row').map(row=>({id:row.dataset.id||'',criterio:row.querySelector('[data-grade-name]').value.trim(),tipo:row.querySelector('[data-grade-type]').value,porcentaje:Number(row.querySelector('[data-grade-percent]').value||0)}))}
async function saveGradeWeights(){const payload={trimester:Number($('#gradeTrimester').value),subject:$('#gradeSubject').value,criteria:collectGradeWeights()};await runAction(async()=>{const result=await server('saveGradeWeights',payload);gradeReportCache.clear();state.gradeWeights=result.weights;renderGradeWeights();toast(result.message)})}
async function generateGradeReport(force=false){
  const trimester=$('#gradeTrimester').value,subject=$('#gradeSubject').value;
  if(!subject)return toast('Selecciona un campo formativo.',true);
  const cacheKey=`${trimester}_${subject}`;
  const cached=gradeReportCache.get(cacheKey);
  if(cached&&!force){
    state.gradeReport=cached;
    state.gradeWeights=cached.weights;
    renderGradeWeights();
    renderManualGrades();
    $('#gradeWeightsPanel').classList.remove('hidden-control');
    $('#manualGradesPanel').classList.remove('hidden-control');
    $('#gradeReportPanel').classList.remove('grade-report-empty');
    $('#gradeReportPanel').innerHTML=gradeReportHtml(state.gradeReport,true);
    server('getQuarterlyGradeReport',trimester,subject).then(report=>{
      gradeReportCache.set(cacheKey,report);
      if(state.gradeReport&&String(state.gradeReport.trimester)===String(trimester)&&state.gradeReport.subject===subject){
        state.gradeReport=report;
        state.gradeWeights=report.weights;
        renderGradeWeights();
        renderManualGrades();
        $('#gradeReportPanel').innerHTML=gradeReportHtml(state.gradeReport,true);
      }
    }).catch(err=>console.warn('Revalidación de calificaciones:',err));
    return;
  }
  await runAction(async()=>{
    state.gradeReport=await server('getQuarterlyGradeReport',trimester,subject);
    gradeReportCache.set(cacheKey,state.gradeReport);
    state.gradeWeights=state.gradeReport.weights;
    renderGradeWeights();
    renderManualGrades();
    $('#gradeWeightsPanel').classList.remove('hidden-control');
    $('#manualGradesPanel').classList.remove('hidden-control');
    $('#gradeReportPanel').classList.remove('grade-report-empty');
    $('#gradeReportPanel').innerHTML=gradeReportHtml(state.gradeReport,true);
  });
}
function renderManualGrades(){const report=state.gradeReport;if(!report)return;const manual=report.weights.filter(w=>String(w.tipo).toUpperCase()!=='AUTOMATICO');$('#manualGradesPanel').classList.toggle('hidden-control',!manual.length);$('#manualGradesTable').innerHTML=manual.length?`<table><thead><tr><th>Alumno</th>${manual.map(w=>`<th>${escapeHtml(w.criterio)}</th>`).join('')}</tr></thead><tbody>${report.rows.map(row=>`<tr><td>${escapeHtml(row.name)}</td>${manual.map(w=>`<td><input type="number" min="0" max="10" step="0.1" data-manual-grade data-student="${escapeHtml(row.studentId)}" data-criterion="${escapeHtml(w.criterio)}" value="${row.scores[w.criterio]??''}"></td>`).join('')}</tr>`).join('')}</tbody></table>`:''}
async function saveManualGrades(){if(!state.gradeReport)return;const groups={};$$('[data-manual-grade]').forEach(input=>{(groups[input.dataset.criterion]||(groups[input.dataset.criterion]=[])).push({studentId:input.dataset.student,grade:input.value})});await runAction(async()=>{for(const criterion of Object.keys(groups))await server('saveManualGrades',{trimester:state.gradeReport.trimester,subject:state.gradeReport.subject,criterion,values:groups[criterion]});gradeReportCache.clear();toast('Calificaciones manuales guardadas.');await generateGradeReport(true)})}
function chunks(array,size){const result=[];for(let i=0;i<array.length;i+=size)result.push(array.slice(i,i+size));return result}
function gradeHead(report,title){return `<header class="grade-print-head"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(report.config.escuela||'')} · ${escapeHtml(report.config.gradoGrupo||'')} · ${escapeHtml(report.config.cicloEscolar||'')} · Trimestre ${report.trimester}</p></header>`}
function gradeReportHtml(report,controls=false){const weightNames=report.weights.map(w=>w.criterio);let html=controls?'<div class="button-row no-print"><button class="btn primary" data-action="print-grade-report">Imprimir / guardar PDF tamaño carta</button></div>':'';chunks(report.rows,20).forEach((rows,page)=>{html+=`<section class="grade-print-page">${gradeHead(report,`Reporte trimestral · ${report.subject}`)}<h2>Calificaciones${page?' (continuación)':''}</h2><table><thead><tr><th>Núm.</th><th>Alumno</th>${weightNames.map(name=>`<th>${escapeHtml(name)}</th>`).join('')}<th>Final</th></tr></thead><tbody>${rows.map((row,index)=>`<tr><td>${page*20+index+1}</td><td>${escapeHtml(row.name)}</td>${weightNames.map(name=>`<td>${row.scores[name]==null?'—':Number(row.scores[name]).toFixed(1)}</td>`).join('')}<td><b>${row.final==null?'—':Number(row.final).toFixed(1)}</b></td></tr>`).join('')}</tbody></table><p class="grade-foot">Ponderaciones: ${report.weights.map(w=>`${escapeHtml(w.criterio)} ${w.porcentaje}%`).join(' · ')}</p></section>`});const activityChunks=chunks(report.activities,10);activityChunks.forEach((activities,activityPage)=>{chunks(report.rows,18).forEach((rows,studentPage)=>{html+=`<section class="grade-print-page">${gradeHead(report,`Tareas del trimestre · ${report.subject}`)}<h2>Actividades ${activities[0]?.code||'—'} a ${activities[activities.length-1]?.code||'—'}${studentPage?' · continuación':''}</h2><table><thead><tr><th>Núm.</th><th>Alumno</th>${activities.map(a=>`<th>${escapeHtml(a.code)}</th>`).join('')}</tr></thead><tbody>${rows.map((row,index)=>`<tr><td>${studentPage*18+index+1}</td><td>${escapeHtml(row.name)}</td>${activities.map(a=>`<td>${escapeHtml(row.taskMarks[report.activities.indexOf(a)]||'—')}</td>`).join('')}</tr>`).join('')}</tbody></table><p class="grade-foot">✓ Completa · I Incompleta · NR No realizó · F Falta · — Sin evaluación</p></section>`})});chunks(report.activities,12).forEach((activities,page)=>{html+=`<section class="grade-print-page">${gradeHead(report,`Catálogo de actividades · ${report.subject}`)}<h2>Detalle de actividades${page?' (continuación)':''}</h2><table><thead><tr><th>Clave</th><th>Fecha</th><th>Horario</th><th>Actividad</th><th>Proyecto</th></tr></thead><tbody>${activities.map(a=>`<tr><td>${escapeHtml(a.code)}</td><td>${escapeHtml(formatDateShort(a.date))}</td><td>${escapeHtml(formatTime(a.start))}–${escapeHtml(formatTime(a.end))}</td><td>${escapeHtml(a.name)}</td><td>${escapeHtml(a.project)}</td></tr>`).join('')}</tbody></table></section>`});return html}
function printGradeReport(){if(!state.gradeReport)return;printHtmlDocument(gradeReportHtml(state.gradeReport,false),'landscape')}
async function generateConsolidatedReport(){const trimester=$('#gradeTrimester').value;await runAction(async()=>{const report=await server('getConsolidatedGradeReport',trimester);const content=chunks(report.rows,20).map((rows,page)=>`<section class="grade-print-page"><header class="grade-print-head"><h1>Reporte general trimestral</h1><p>${escapeHtml(report.config.escuela||'')} · Trimestre ${report.trimester}</p></header><table><thead><tr><th>Núm.</th><th>Alumno</th>${report.subjects.map(s=>`<th>${escapeHtml(s)}</th>`).join('')}</tr></thead><tbody>${rows.map((row,index)=>`<tr><td>${page*20+index+1}</td><td>${escapeHtml(row.name)}</td>${row.grades.map(g=>`<td>${g==null?'—':Number(g).toFixed(1)}</td>`).join('')}</tr>`).join('')}</tbody></table></section>`).join('');printHtmlDocument(content,'landscape')})}
async function setPaymentEventActive(eventId,active){if(!confirm(active?'¿Reactivar este evento?':'¿Archivar este evento? Su historial se conservará.'))return;await runAction(async()=>{const result=await server('setPaymentEventActive',eventId,active);paymentEventCache.delete(String(eventId));state.paymentsInitial=await server('getPaymentsInitialData');backPaymentEvents();toast(result.message)})}
async function syncPaymentStudents(){if(!confirm('¿Sincronizar la lista actual de alumnos con el Control de pagos? El historial anterior se conservará.'))return;await runAction(async()=>{const result=await server('syncPaymentStudents');state.paymentsInitial=result.initialData;renderPaymentsHome();toast(result.message)})}
