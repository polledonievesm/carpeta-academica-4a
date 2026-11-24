function defaultEvaluation(studentId){
  return { alumnoId: studentId, trabajo: "Completo", conducta: "Adecuada", participacion: "Media", desempeno: "", observacionLibre: "", instrumentResults: {} };
}
/* ==========================================================================
   MÓDULO DE VISTA: REGISTRO DIARIO Y EVALUACIONES DE CLASE (RD-03/10-R12)
   ========================================================================== */
// Actividad y registro multicontexto gestionados centralizadamente en js/core/utils.js

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

function checkContextMatch(form, payload) {
  if (!form || !payload) return false;
  const curId = form.elements?.id?.value || '';
  const payloadId = payload.id || '';

  // 1. Si era una actualización (payload.id existe), debe coincidir exactamente el ID
  if (payloadId) {
    return curId === payloadId;
  }

  // 2. Si el formulario ya tiene un ID asignado que no coincide con payload, no es el mismo contexto
  if (curId && curId !== payloadId) return false;

  // 3. Comparar localId
  const curLocalId = form.elements?.localId?.value || '';
  const payloadLocalId = payload.localId || '';
  if (curLocalId && payloadLocalId) {
    if (curLocalId !== payloadLocalId) return false;
  }

  // 4. Comparar requestKey
  const curKey = form.elements?.requestKey?.value || '';
  const payloadKey = payload.requestKey || '';
  if (curKey && payloadKey) {
    if (curKey !== payloadKey) return false;
  }

  // 5. Coincidencia por identificador estable
  if (curLocalId && payloadLocalId && curLocalId === payloadLocalId) return true;
  if (curKey && payloadKey && curKey === payloadKey) return true;

  // NUNCA coincidir únicamente por fecha y proyecto
  return false;
}

function detectSubsequentEdits(draft, form, sentPayload, currentEvaluations, isSameContext) {
  if (!sentPayload) return false;

  if (isSameContext && form) {
    const curDraft = serializeFormDraft(form);
    const formFields = ['actividad', 'materia', 'material', 'fecha', 'horaInicio', 'horaFin', 'proyectoId'];
    for (const f of formFields) {
      if (curDraft[f] !== undefined && sentPayload[f] !== undefined && String(curDraft[f]).trim() !== String(sentPayload[f]).trim()) {
        return true;
      }
    }
  }

  if (draft && draft.data) {
    const draftFields = ['actividad', 'materia', 'material', 'fecha', 'horaInicio', 'horaFin', 'proyectoId'];
    for (const f of draftFields) {
      if (draft.data[f] !== undefined && sentPayload[f] !== undefined && String(draft.data[f]).trim() !== String(sentPayload[f]).trim()) {
        return true;
      }
    }
  }

  const sentEvals = Array.isArray(sentPayload.evaluaciones) ? sentPayload.evaluaciones : [];
  const sentMap = {};
  sentEvals.forEach(e => {
    const sid = String(e.alumnoId || e.id || '');
    if (sid) sentMap[sid] = e;
  });

  if (isSameContext && currentEvaluations && typeof currentEvaluations === 'object') {
    for (const [sid, ev] of Object.entries(currentEvaluations)) {
      const orig = sentMap[String(sid)];
      if (!orig) continue;
      if (String(ev.trabajo || '') !== String(orig.trabajo || '')) return true;
      if (String(ev.conducta || '') !== String(orig.conducta || '')) return true;
      if (String(ev.participacion || '') !== String(orig.participacion || '')) return true;
      if (String(ev.observacionLibre || '') !== String(orig.observacionLibre || '')) return true;
    }
  }

  const draftEvals = draft?.extra?.evaluations;
  if (draftEvals && typeof draftEvals === 'object') {
    for (const [sid, ev] of Object.entries(draftEvals)) {
      const orig = sentMap[String(sid)];
      if (!orig) continue;
      if (String(ev.trabajo || '') !== String(orig.trabajo || '')) return true;
      if (String(ev.conducta || '') !== String(orig.conducta || '')) return true;
      if (String(ev.participacion || '') !== String(orig.participacion || '')) return true;
      if (String(ev.observacionLibre || '') !== String(orig.observacionLibre || '')) return true;
    }
  }

  return false;
}

async function saveClassForm(e){
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
  const form = (e && (e.currentTarget || e.target)) || $('#classForm');
  if (!form) return;
  if (form.dataset.saving === '1') return;
  if (!state.classStudents || !state.classStudents.length) {
    return toast('Primero guarda la asistencia; no hay alumnos presentes para evaluar.', true);
  }

  const curDraft = readDraft(DRAFT_KEYS.classRecord);
  const pendingOp = curDraft?.pendingOperation;

  // Regla 5: Normalizar operaciones pendientes que venían de un rechazo explícito de validación del servidor
  const isValidationErr = pendingOp && pendingOp.status === 'rejected' && (
    typeof isValidationRejection === 'function' && isValidationRejection(pendingOp.lastError || curDraft?.error)
  );
  if (isValidationErr && (pendingOp.status === 'uncertain' || pendingOp.status === 'in_flight')) {
    pendingOp.status = 'rejected';
    if (curDraft.status === 'Pendiente de guardar') curDraft.status = 'Borrador';
  }

  // Fallo 1 corregido: Si la operación restaurada estaba en 'in_flight' o 'uncertain', tratarla como resultado incierto
  const isPendingUncertain = pendingOp && (pendingOp.status === 'uncertain' || pendingOp.status === 'in_flight') && pendingOp.payload;

  // E. Borrador antiguo incierto sin protocolo RD-03: bloquear reenvío y conservar datos
  if (curDraft) {
    const hasUncertainStatus = curDraft.status === 'Pendiente de guardar' || curDraft.status === 'Guardando' || pendingOp?.status === 'uncertain' || pendingOp?.status === 'in_flight';
    const isRd03Operation = pendingOp && pendingOp.payload && pendingOp.payload.protocolVersion === 'RD-03';
    if (hasUncertainStatus && !isRd03Operation) {
      toast('Operación previa en estado incierto creada con protocolo anterior. No se reenviará automáticamente para evitar duplicados. Se requiere conciliación guiada.', true);
      return;
    }
  }

  // D. Conflicto de clave: no regenerar automáticamente ni enviar creación nueva
  if (pendingOp && pendingOp.status === 'conflict') {
    toast('Operación detenida por conflicto de clave previo (409 Conflict). Requiere conciliación guiada antes de continuar.', true);
    return;
  }

  // Determinar payload a enviar:
  // Mientras el resultado sea incierto (incluyendo 'in_flight' restaurado tras recarga),
  // reintentar exclusivamente el payload original con su misma clave.
  // Conservar por separado las ediciones posteriores del docente.
  let payloadToSend;
  let isRetryingUncertain = false;

  if (isPendingUncertain) {
    payloadToSend = JSON.parse(JSON.stringify(pendingOp.payload));
    isRetryingUncertain = true;
    pendingOp.status = 'uncertain'; // Normalizar si venía como in_flight restaurado
    if (form.elements.requestKey) {
      form.elements.requestKey.value = payloadToSend.requestKey;
    }
  } else {
    payloadToSend = formData(form);
    payloadToSend.protocolVersion = 'RD-03';
    payloadToSend.localId = form.elements.localId?.value || (typeof ensureLocalId === 'function' ? ensureLocalId(form, 'ACT-LOC', true) : (payloadToSend.requestKey || ''));
    payloadToSend.requestKey = form.elements.requestKey?.value || ensureRequestKey(form, 'ACT', true);
    payloadToSend.evaluaciones = state.classStudents.map(s => state.classEvaluations[s.id]);
    payloadToSend.proyectoId = form.elements.proyectoId?.value || '';
  }

  // Proyecto opcional en RD-03-R24:
  // Mientras el resultado sea incierto, conservar clave y payload completos e inmutables.
  // No incorporar el proyecto del formulario a un payload pendiente incierto.
  if (!isRetryingUncertain) {
    const formProjVal = form.elements.proyectoId?.value || '';
    if (!payloadToSend.proyectoId && formProjVal) {
      payloadToSend.proyectoId = formProjVal;
    }
    if (!payloadToSend.proyectoId) {
      payloadToSend.proyectoId = '';
    }
  } else {
    if (payloadToSend.proyectoId === undefined || payloadToSend.proyectoId === null) {
      payloadToSend.proyectoId = '';
    }
  }

  if (!confirm(`¿Guardar la actividad y la evaluación de ${payloadToSend.evaluaciones.length} alumnos?`)) return;

  const opToStore = isRetryingUncertain ? pendingOp : {
    requestKey: payloadToSend.requestKey,
    localId: payloadToSend.localId || '',
    payload: JSON.parse(JSON.stringify(payloadToSend)),
    status: 'in_flight',
    sentAt: new Date().toISOString(),
    targetFormId: form.elements.id?.value || '',
    targetDate: payloadToSend.fecha || ''
  };
  opToStore.status = 'in_flight';

  // H. Fallo de almacenamiento local antes del envío:
  // Si falla ese almacenamiento, detener el envío conservando el formulario y mostrar el error.
  // Cero llamadas al servidor y formulario conservado.
  try {
    const draftToSave = {
      updatedAt: new Date().toISOString(),
      status: 'Guardando',
      error: '',
      data: serializeFormDraft(form),
      extra: { evaluations: state.classEvaluations },
      pendingOperation: opToStore
    };
    localStorage.setItem(DRAFT_KEYS.classRecord, JSON.stringify(draftToSave));
    saveActivityToRegistry(opToStore.requestKey, draftToSave);
    showDraftStatus('classDraftStatus', draftToSave.updatedAt);
    window.dispatchEvent(new CustomEvent('drafts-updated'));
  } catch (storageError) {
    console.error('Fallo de almacenamiento local antes del envío:', storageError);
    toast('Error crítico: No se pudo asegurar la copia de respaldo en almacenamiento local. Envío detenido para evitar duplicados.', true);
    return;
  }

  setFormSaving(form, true);

  let saveResult = null;
  const ok = await runAction(async () => {
    saveResult = await server('saveClassRecord', payloadToSend);
  });

  setFormSaving(form, false);

  if (!ok) {
    const errText = window.__lastActionError || 'No fue posible completar el guardado.';
    try {
      const curDraftNow = readDraft(DRAFT_KEYS.classRecord);
      const isSameCtxNow = checkContextMatch(form, payloadToSend);
      const draftMatchesOp = curDraftNow && checkDraftMatchesActivity(curDraftNow, payloadToSend);

      const failOp = (draftMatchesOp && curDraftNow.pendingOperation) ? curDraftNow.pendingOperation : opToStore;
      const isConflict = errText.includes('409 Conflict') || errText.includes('ConflictError');
      const isValidation = typeof isValidationRejection === 'function' ? isValidationRejection(errText) : /Selecciona un proyecto|Selecciona una fecha|Indica la hora|La hora de término|Materia, actividad y material|Primero registra y guarda la asistencia/i.test(errText);

      if (isConflict) {
        failOp.status = 'conflict';
        failOp.lastError = errText;
      } else if (isValidation) {
        // Regla 4: Rechazo explícito de validación (ocurrió antes de cualquier escritura en BD)
        failOp.status = 'rejected';
        failOp.lastError = errText;
      } else {
        // Pérdida de respuesta / fallo de red tras envío (resultado incierto)
        failOp.status = 'uncertain';
        failOp.lastError = errText;
      }

      // 1. Si el borrador activo coincide, actualizarlo en DRAFT_KEYS.classRecord
      if (draftMatchesOp) {
        curDraftNow.status = isConflict ? 'Conflicto de clave' : (isValidation ? 'Borrador' : 'Pendiente de guardar');
        curDraftNow.error = errText;
        curDraftNow.pendingOperation = failOp;
        localStorage.setItem(DRAFT_KEYS.classRecord, JSON.stringify(curDraftNow));
        window.dispatchEvent(new CustomEvent('drafts-updated'));
        if (isConflict) {
          toast('Conflicto detectado en el servidor (409 Conflict). La clave y los datos se preservan para conciliación guiada. No se regeneró la clave.', true);
        } else {
          showPendingSaveDialog(DRAFT_KEYS.classRecord);
        }
      } else {
        console.warn('Respuesta tardía de error recibida para operación no coincidente con el borrador activo:', payloadToSend.requestKey);
      }

      // 2. SIEMPRE registrar la operación fallida en el registro multicontexto para que no se pierda
      const regEntry = findInActivityRegistry({ requestKey: payloadToSend.requestKey }) || {
        updatedAt: new Date().toISOString(),
        data: payloadToSend,
        extra: { evaluations: state.classEvaluations }
      };
      regEntry.status = isConflict ? 'Conflicto de clave' : 'Pendiente de guardar';
      regEntry.error = errText;
      regEntry.pendingOperation = failOp;
      saveActivityToRegistry(payloadToSend.requestKey, regEntry);

    } catch (e) {
      console.warn('Error al actualizar estado tras fallo:', e);
    }
    return;
  }

  // Éxito en el servidor
  handleSaveClassRecordSuccess(saveResult, payloadToSend, form, opToStore);
}

function handleSaveClassRecordSuccess(saveResult, payloadToSend, form, opToStore) {
  const returnedClassId = saveResult?.activity?.id || saveResult?.classRecord?.id || saveResult?.id;

  // Comprobar si el formulario visible coincide con la operación confirmada
  const isSameContext = checkContextMatch(form, payloadToSend);

  if (isSameContext && form) {
    if (returnedClassId) {
      if (form.elements?.id) form.elements.id.value = returnedClassId;
      const titleEl = $('#classFormTitle');
      if (titleEl) titleEl.textContent = 'Editar actividad';
    }
    resetRequestKey(form);
  }

  // Comprobar coincidencia con el borrador en localStorage usando checkDraftMatchesActivity
  const draftOnSuccess = readDraft(DRAFT_KEYS.classRecord);
  const draftMatchesOp = draftOnSuccess && checkDraftMatchesActivity(draftOnSuccess, payloadToSend);

  let subsequentEditsData = null;

  if (draftMatchesOp) {
    // Detectar y preservar modificaciones posteriores de todos los datos y evaluaciones
    const hasSubsequentEdits = detectSubsequentEdits(draftOnSuccess, form, payloadToSend, state.classEvaluations, isSameContext);

    if (hasSubsequentEdits) {
      const currentFormDraft = isSameContext ? serializeFormDraft(form) : {};
      const updatedDraftData = Object.assign({}, draftOnSuccess.data || {}, currentFormDraft);
      if (returnedClassId) updatedDraftData.id = returnedClassId;
      const newDraft = {
        updatedAt: new Date().toISOString(),
        status: 'Borrador',
        error: '',
        data: updatedDraftData,
        extra: { evaluations: (isSameContext && state.classEvaluations) ? state.classEvaluations : (draftOnSuccess.extra?.evaluations || {}) },
        pendingOperation: null
      };
      subsequentEditsData = newDraft;
      localStorage.setItem(DRAFT_KEYS.classRecord, JSON.stringify(newDraft));
      showDraftStatus('classDraftStatus', newDraft.updatedAt);
      window.dispatchEvent(new CustomEvent('drafts-updated'));
      toast('Se confirmó el guardado pendiente. Las modificaciones posteriores permanecen como borrador y actualizarán esta actividad.');
    } else {
      clearDraft(DRAFT_KEYS.classRecord, 'classDraftStatus');
    }
  } else {
    }

  // SIEMPRE registrar la confirmación de la actividad en el registro multicontexto
  try {
    const regItemA = findInActivityRegistry({ requestKey: payloadToSend.requestKey }) || {
      updatedAt: new Date().toISOString(),
      data: JSON.parse(JSON.stringify(payloadToSend)),
      extra: { evaluations: state.classEvaluations }
    };
    if (regItemA) {
      if (returnedClassId) {
        regItemA.id = returnedClassId;
        if (regItemA.data) regItemA.data.id = returnedClassId;
      }
      const hasRegEdits = detectSubsequentEdits(regItemA, isSameContext ? form : null, payloadToSend, isSameContext ? state.classEvaluations : null, isSameContext);
      regItemA.status = (subsequentEditsData || hasRegEdits) ? 'Borrador' : 'Completada';
      if (subsequentEditsData) {
        regItemA.data = Object.assign({}, regItemA.data || {}, subsequentEditsData.data || {});
        regItemA.extra = subsequentEditsData.extra;
      }
      // Marcar operación confirmada para que no sea tratada como incierta
      if (!regItemA.pendingOperation && opToStore) {
        regItemA.pendingOperation = opToStore;
      }
      if (regItemA.pendingOperation) {
        regItemA.pendingOperation.status = 'confirmed';
        regItemA.pendingOperation.assignedId = returnedClassId;
      }
      if (returnedClassId) saveActivityToRegistry(returnedClassId, regItemA);
      if (payloadToSend.localId) saveActivityToRegistry(payloadToSend.localId, regItemA);
      saveActivityToRegistry(payloadToSend.requestKey, regItemA);
    }
  } catch (regErr) {
    console.warn('Error al actualizar registro multicontexto en éxito:', regErr);
  }

  state.stats.activities = Number(state.stats.activities || 0) + (payloadToSend.id ? 0 : 1);
  if (saveResult && saveResult.followUp !== undefined) state.stats.followUp = saveResult.followUp;

  if (state.projectWorkspace && String(state.currentProject?.id) === String(payloadToSend.proyectoId) && saveResult && saveResult.activity) {
    const rows = state.projectWorkspace.activities || [];
    const index = rows.findIndex(row => String(row.id) === String(saveResult.activity.id));
    if (index < 0) rows.unshift(saveResult.activity);
    else rows[index] = saveResult.activity;
    state.projectWorkspace.activities = rows;
  } else if (payloadToSend.proyectoId && saveResult && saveResult.activity) {
    state.currentProject = state.projects.find(project => String(project.id) === String(payloadToSend.proyectoId)) || { id: payloadToSend.proyectoId, nombre: 'Proyecto' };
    state.projectWorkspace = { project: state.currentProject, activities: [saveResult.activity] };
  }

  if (typeof renderProjectWorkspace === 'function') renderProjectWorkspace();
  if (typeof renderStats === 'function') renderStats();
  if (isSameContext && typeof showView === 'function') {
    showView('project-detail');
  }
  if (typeof toast === 'function') {
    toast((saveResult && saveResult.message) || 'Actividad y evaluaciones guardadas correctamente.');
  }
}

if (typeof window !== 'undefined') {
  window.handleSaveClassRecordSuccess = handleSaveClassRecordSuccess;
}

function formatDateShort(value){if(!value)return 'Sin fecha';const [y,m,d]=String(value).split('-');return `${d}/${m}/${y}`}
function formatTime(value){if(!value)return '';const [h,m]=String(value).split(':').map(Number);return `${h%12||12}:${String(m||0).padStart(2,'0')} ${h<12?'a. m.':'p. m.'}`}

function cleanClassHour(value) {
  if (!value) return '';
  const s = String(value).trim();
  if (s === '1899-12-30' || s.includes('1899-12-30')) return ''; // Dato corrupto donde se perdió la información horaria en Google Sheets
  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) return s;
  const m = s.match(/T([01]\d|2[0-3]):([0-5]\d)/);
  if (m) return `${m[1]}:${m[2]}`;
  return '';
}

function isValidClassHour(value) {
  if (!value) return false;
  const s = String(value).trim();
  if (s === '1899-12-30' || s.includes('1899-12-30')) return false;
  const cleaned = cleanClassHour(s);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(cleaned);
}
window.cleanClassHour = cleanClassHour;
window.isValidClassHour = isValidClassHour;




/**
 * ============================================================================
 * MÓDULO CONSOLIDADO: REGISTRO DIARIO (RD-03/10-R26)
 * ============================================================================
 * Correcciones técnicas de R26:
 * 1. Conexión con estructuras reales de state-api.js (state declarado con const,
 *    attendance como objeto, carga inicial y sincronización tras guardar).
 * 2. Crear no es calificar: eliminación de asignación automática de Completo/Logrado.
 *    Crear actividad la deja Sin calificar y sin inventar evaluaciones.
 * 3. Conservación integral de evaluaciones y resultados de instrumentos al editar metadatos.
 * 4. Guardado y reintentos reales: requestKey y payload estables en uncertain,
 *    protección contra doble clic, eliminación limpia que previene recreación tras recarga.
 * 5. Corrección de referencia claseId: classId en saveGradingActivity.
 * 6. Plazo justificado: elección y confirmación por el docente, validación en backend
 *    y reapertura excepcional con motivo obligatorio sin falsos acuses antes de persistir.
 * ============================================================================
 */

// --------------------------------------------------------------------------

// ==========================================================================
// CATÁLOGO DE MATERIALES, PDA E INSTRUMENTOS CURRICULARES
// ==========================================================================
function getPdasForSubject(materia) {
  const list = [];
  const matNorm = String(materia || '').toLowerCase();

  // 1. Matemáticas y Científico
  if (matNorm.includes('matemát') || matNorm.includes('matemat') || matNorm.includes('científico') || matNorm.includes('cientifico')) {
    if (Array.isArray(window.BANCO_OBSERVACIONES_MATEMATICAS)) {
      const seenTemas = new Set();
      window.BANCO_OBSERVACIONES_MATEMATICAS.forEach(item => {
        if (item.tema && !seenTemas.has(item.tema)) {
          seenTemas.add(item.tema);
          list.push({
            area: 'Saberes y Pensamiento Científico / Matemático',
            bloque: item.bloque || '',
            tema: item.tema,
            label: (item.bloque ? item.bloque + ': ' : '') + item.tema
          });
        }
      });
    }
  }

  // 2. Banco general de PDA (Lenguajes, Ética, De lo Humano, etc.)
  if (Array.isArray(window.BANCO_OBSERVACIONES_PDA)) {
    const seenPdas = new Set();
    window.BANCO_OBSERVACIONES_PDA.forEach(item => {
      const itemCampo = String(item.campo || '').toLowerCase();
      let match = false;
      if (matNorm.includes('lenguaje') && itemCampo.includes('lenguaje')) match = true;
      else if (matNorm.includes('ética') && itemCampo.includes('ética')) match = true;
      else if (matNorm.includes('humano') && itemCampo.includes('humano')) match = true;
      else if (matNorm.includes('científico') && itemCampo.includes('científico')) match = true;

      if (match && item.pda && !seenPdas.has(item.pda)) {
        seenPdas.add(item.pda);
        list.push({
          area: item.campo || 'Campo formativo',
          bloque: item.contenido || '',
          tema: item.pda,
          label: (item.contenido ? item.contenido + ' — ' : '') + item.pda
        });
      }
    });
  }

  return list;
}
window.getPdasForSubject = getPdasForSubject;

function getObservationsForPda(materia, temaOrPda, nivel) {
  const results = [];
  const normTema = String(temaOrPda || '').trim().toLowerCase();
  const normNivel = String(nivel || 'Logrado').trim().toLowerCase();

  // Buscar en Banco de Matemáticas
  if (Array.isArray(window.BANCO_OBSERVACIONES_MATEMATICAS) && normTema) {
    window.BANCO_OBSERVACIONES_MATEMATICAS.forEach(item => {
      if (String(item.tema || '').trim().toLowerCase() === normTema &&
          String(item.nivel || '').trim().toLowerCase() === normNivel) {
        results.push(item.texto);
      }
    });
  }

  // Buscar en Banco general de PDA
  if (Array.isArray(window.BANCO_OBSERVACIONES_PDA) && normTema && !results.length) {
    window.BANCO_OBSERVACIONES_PDA.forEach(item => {
      if (String(item.pda || '').trim().toLowerCase() === normTema &&
          String(item.nivel || '').trim().toLowerCase() === normNivel) {
        if (Array.isArray(item.observaciones)) {
          results.push(...item.observaciones);
        } else if (item.observacion) {
          results.push(item.observacion);
        }
      }
    });
  }

  return results;
}
window.getObservationsForPda = getObservationsForPda;

function renderPdaOptionsHtml(materia, selectedPda = '') {
  const pdas = getPdasForSubject(materia);
  if (!pdas || !pdas.length) {
    return '<option value="">-- Sin PDA asociado o escribe tema libre --</option>';
  }
  let out = '<option value="">-- Selecciona PDA asociado --</option>';
  pdas.forEach(p => {
    const isSel = String(selectedPda).trim() === String(p.tema).trim() ? 'selected' : '';
    out += `<option value="${escapeHtml(p.tema)}" ${isSel}>${escapeHtml(p.label || p.tema)}</option>`;
  });
  if (selectedPda && !pdas.some(p => String(p.tema).trim() === String(selectedPda).trim())) {
    out += `<option value="${escapeHtml(selectedPda)}" selected>${escapeHtml(selectedPda)}</option>`;
  }
  return out;
}
window.renderPdaOptionsHtml = renderPdaOptionsHtml;

function renderMaterialOptionsHtml(selected = '') {
  const sel = String(selected || '').trim();
  const known = [
    'Lenguajes', 'Saberes y Pensamiento Matemático', 'Saberes y Pensamiento Científico',
    'Ética, Naturaleza y Sociedades', 'De lo Humano y lo Comunitario', 'Dibujo', 'Ortografía',
    'Libro de Texto Gratuito (LTG)', 'La Guía Escolar', 'PRACMATICA', 'C.A.P. (Comprender, Aprender y Practicar)',
    'Hoja de trabajo', 'Otro material'
  ];
  let customOpt = '';
  if (sel && !known.includes(sel)) {
    customOpt = `<option value="${escapeHtml(sel)}" selected>${escapeHtml(sel)}</option>`;
  }
  return `
    <option value="">Selecciona</option>
    ${customOpt}
    <optgroup label="Cuadernos">
      <option value="Lenguajes" ${sel==='Lenguajes'?'selected':''}>Lenguajes</option>
      <option value="Saberes y Pensamiento Matemático" ${sel==='Saberes y Pensamiento Matemático'?'selected':''}>Saberes y Pensamiento Matemático</option>
      <option value="Saberes y Pensamiento Científico" ${sel==='Saberes y Pensamiento Científico'?'selected':''}>Saberes y Pensamiento Científico</option>
      <option value="Ética, Naturaleza y Sociedades" ${sel==='Ética, Naturaleza y Sociedades'?'selected':''}>Ética, Naturaleza y Sociedades</option>
      <option value="De lo Humano y lo Comunitario" ${sel==='De lo Humano y lo Comunitario'?'selected':''}>De lo Humano y lo Comunitario</option>
      <option value="Dibujo" ${sel==='Dibujo'?'selected':''}>Dibujo</option>
      <option value="Ortografía" ${sel==='Ortografía'?'selected':''}>Ortografía</option>
    </optgroup>
    <optgroup label="Libros">
      <option value="Libro de Texto Gratuito (LTG)" ${sel==='Libro de Texto Gratuito (LTG)'?'selected':''}>Libro de Texto Gratuito (LTG)</option>
      <option value="La Guía Escolar" ${sel==='La Guía Escolar'?'selected':''}>La Guía Escolar</option>
      <option value="PRACMATICA" ${sel==='PRACMATICA'?'selected':''}>PRACMATICA</option>
      <option value="C.A.P. (Comprender, Aprender y Practicar)" ${sel==='C.A.P. (Comprender, Aprender y Practicar)'?'selected':''}>C.A.P. (Comprender, Aprender y Practicar)</option>
    </optgroup>
    <option value="Hoja de trabajo" ${sel==='Hoja de trabajo'?'selected':''}>Hoja de trabajo</option>
    <option value="Otro material" ${sel==='Otro material'?'selected':''}>Otro material</option>
  `;
}
window.renderMaterialOptionsHtml = renderMaterialOptionsHtml;

function renderInstrumentOptionsHtml(selected = '') {
  const gs = getGlobalState();
  const instruments = gs.instruments || (typeof state !== 'undefined' ? state.instruments : []) || [];
  let out = '<option value="">Evaluación sencilla</option>';
  instruments.forEach(inst => {
    const isSel = String(selected || '').trim() === String(inst.id || '').trim() ? 'selected' : '';
    const label = inst.titulo || inst.nombre || ('Instrumento #' + inst.id);
    out += `<option value="${escapeHtml(inst.id)}" ${isSel}>${escapeHtml(label)}</option>`;
  });
  return out;
}
window.renderInstrumentOptionsHtml = renderInstrumentOptionsHtml;

// 1. HELPERS DE ESTADO GLOBAL Y ASISTENCIA REAL
// --------------------------------------------------------------------------
function getGlobalState() {
  const gs = (typeof state !== 'undefined' ? state : (window.state || {}));
  if (typeof window !== 'undefined' && typeof state !== 'undefined' && !window.state) {
    window.state = state;
  }
  return gs;
}
window.getGlobalState = getGlobalState;

function getAttendanceMapForDate(date) {
  if (!date) return {};
  const gs = getGlobalState();
  if (gs.attendanceDay && gs.attendanceDay.date === date && gs.attendanceDay.existing) {
    return gs.attendanceDay.existing;
  }
  if (gs.classAttendanceDay && gs.classAttendanceDay.date === date && gs.classAttendanceDay.existing) {
    return gs.classAttendanceDay.existing;
  }
  if (gs.attendance && typeof gs.attendance === 'object' && gs.attendance.day && gs.attendance.day.date === date) {
    return gs.attendance.day.existing || {};
  }
  return gs.attendanceRecordsByDate?.[date] || {};
}
window.getAttendanceMapForDate = getAttendanceMapForDate;

async function loadAttendanceForDate(date) {
  if (!date) return {};
  const cached = getAttendanceMapForDate(date);
  if (Object.keys(cached).length > 0) return cached;
  const gs = getGlobalState();
  try {
    const dayData = await server('getDayData', date);
    if (dayData && dayData.existing) {
      gs.attendanceRecordsByDate = gs.attendanceRecordsByDate || {};
      gs.attendanceRecordsByDate[date] = dayData.existing;
      return dayData.existing;
    }
  } catch (e) {
    console.warn('loadAttendanceForDate: no fue posible consultar asistencia del día', date, e);
  }
  return {};
}
window.loadAttendanceForDate = loadAttendanceForDate;

window.dailyActivitiesQueryStatus = 'idle'; // 'idle' | 'loading' | 'error' | 'success'
window.dailyActivitiesQueryError = null;

async function loadDailyActivities(forceRefresh = false) {
  const gs = getGlobalState();
  gs.classes = gs.classes || gs.activities || [];
  gs.evaluations = gs.evaluations || [];

  if (window.dailyActivitiesLoaded && !forceRefresh && window.dailyActivitiesQueryStatus === 'success') {
    renderDailyActivitiesList();
    return;
  }

  window.dailyActivitiesQueryStatus = 'loading';
  window.dailyActivitiesQueryError = null;
  renderDailyActivitiesList();

  try {
    if (typeof server === 'function') {
      let resp = null;
      let usedFallback = false;
      try {
        resp = await server('getDailyActivities');
      } catch (primaryErr) {
        // Fallback a consulta existente getDailyAcademicReport si getDailyActivities no está en el despachador
        if (/acción solicitada no está permitida|accion solicitada no esta permitida|no está permitida|no esta permitida/i.test(String(primaryErr.message || ''))) {
          console.warn('loadDailyActivities: getDailyActivities no permitida en backend. Reutilizando consulta getDailyAcademicReport...');
          const queryDate = window.dailyState?.filterDate || getTodayIsoCancun();
          try {
            const reportResp = await server('getDailyAcademicReport', queryDate);
            if (reportResp && Array.isArray(reportResp.classes)) {
              resp = {
                classes: reportResp.classes,
                evaluations: gs.evaluations || []
              };
              usedFallback = true;
            }
          } catch (eReport) {
            console.warn('loadDailyActivities: fallback getDailyAcademicReport tampoco respondió:', eReport.message);
          }
        }
        if (!resp) throw primaryErr;
      }

      if (resp && Array.isArray(resp.classes)) {
        if (usedFallback) {
          const map = new Map((gs.classes || []).map(c => [String(c.id), c]));
          resp.classes.forEach(c => map.set(String(c.id), c));
          gs.classes = Array.from(map.values());
          gs.activities = gs.classes;
        } else {
          gs.classes = resp.classes;
          gs.activities = resp.classes;
        }
        if (Array.isArray(resp.evaluations)) {
          gs.evaluations = resp.evaluations;
        }
        window.dailyActivitiesLoaded = true;
        window.dailyActivitiesQueryStatus = 'success';
        window.dailyActivitiesQueryError = null;
      } else {
        throw new Error('La respuesta recibida no contiene una lista válida de actividades.');
      }
    } else {
      window.dailyActivitiesLoaded = true;
      window.dailyActivitiesQueryStatus = 'success';
      window.dailyActivitiesQueryError = null;
    }
  } catch (e) {
    console.warn('loadDailyActivities: error al consultar actividades del servidor:', e.message);
    window.dailyActivitiesQueryStatus = 'error';
    window.dailyActivitiesQueryError = e.message || 'La conexión con Google tardó demasiado. Intenta nuevamente.';
  }

  renderDailyActivitiesList();
}
window.loadDailyActivities = loadDailyActivities;

// --------------------------------------------------------------------------
// 2. UTILIDADES DE FECHA, ZONA HORARIA Y FALTAS JUSTIFICADAS (AMERICA/CANCUN)
// --------------------------------------------------------------------------
function getTodayIsoCancun() {
  try {
    const dtf = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Cancun',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return dtf.format(new Date());
  } catch (e) {
    if (typeof todayCancun === 'function') return todayCancun();
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
window.getTodayIsoCancun = getTodayIsoCancun;

function esDiaHabilEscolar(isoDateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(isoDateStr || ''))) return false;
  const [y, m, d] = String(isoDateStr).split('-').map(Number);
  const cur = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const dayOfWeek = cur.getUTCDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;

  const calendar = window.CARPETA_PLANNING_CALENDAR;
  if (calendar && typeof calendar.resolve === 'function') {
    const res = calendar.resolve(isoDateStr);
    if (res && (res.type === 'vacation' || res.type === 'suspension' || res.type === 'before' || res.type === 'after')) {
      return false;
    }
  }
  return true;
}
window.esDiaHabilEscolar = esDiaHabilEscolar;

function calcularFechaLimiteJustificada(fechaReincorporacionIso, diasHabiles = 5) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fechaReincorporacionIso || ''))) return '';
  const [y, m, d] = String(fechaReincorporacionIso).split('-').map(Number);
  let cur = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

  let count = 0;
  let deadline = '';
  while (count < diasHabiles) {
    cur.setUTCDate(cur.getUTCDate() + 1);
    const iso = `${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, '0')}-${String(cur.getUTCDate()).padStart(2, '0')}`;
    if (esDiaHabilEscolar(iso)) {
      count++;
      deadline = iso;
    }
  }
  return deadline;
}
window.calcularFechaLimiteJustificada = calcularFechaLimiteJustificada;

function findReincorporationDateFromHistory(studentId, classDate) {
  if (!classDate) return '';
  const gs = getGlobalState();
  const byDate = gs.attendanceRecordsByDate || {};
  const dates = Object.keys(byDate).filter(d => d > classDate).sort();
  for (const d of dates) {
    const dayMap = byDate[d] || {};
    const item = dayMap[studentId] || dayMap[String(studentId)];
    const st = String(typeof item === 'object' ? item?.status : item || '').toUpperCase();
    if (st === 'A' || st === 'R') {
      return d;
    }
  }
  return '';
}
window.findReincorporationDateFromHistory = findReincorporationDateFromHistory;

function evaluarEstadoJustificada(evalRow, todayCancun = getTodayIsoCancun()) {
  const row = evalRow || {};
  const fechaLimite = row.fechaLimiteJustificada || '';
  const fechaEntrega = row.fechaEntrega || '';
  const reabiertoMotivo = String(row.reabiertoMotivo || '').trim();
  const reabiertoEn = row.reabiertoEn || '';
  const reabiertoFechaLimite = row.reabiertoFechaLimite || '';
  const fechaInicioPlazo = row.fechaInicioPlazo || '';

  // 1. Si el alumno ya cuenta con entrega registrada
  if (fechaEntrega) {
    if (fechaLimite && fechaEntrega <= fechaLimite) {
      return {
        estado: 'Entregada dentro del plazo autorizado',
        cssClass: 'badge-success',
        vencido: false,
        puedeEntregar: false
      };
    }
    if (reabiertoMotivo && reabiertoFechaLimite && fechaEntrega <= reabiertoFechaLimite) {
      return {
        estado: 'Entregada en reapertura autorizada',
        cssClass: 'badge-info',
        vencido: false,
        puedeEntregar: false
      };
    }
    return {
      estado: 'Plazo vencido · Sin entrega',
      cssClass: 'badge-danger',
      vencido: true,
      puedeEntregar: false
    };
  }

  // 2. Aún no entrega y NO tiene reincorporación confirmada
  if (!fechaInicioPlazo && !fechaLimite) {
    if (reabiertoMotivo && reabiertoFechaLimite && todayCancun <= reabiertoFechaLimite) {
      return {
        estado: 'Reapertura autorizada · Pendiente de entrega',
        cssClass: 'badge-info',
        vencido: false,
        puedeEntregar: true
      };
    }
    // Sin reincorporación confirmada, NO se habilita la entrega ordinaria
    return {
      estado: 'Pendiente de reincorporación',
      cssClass: 'badge-neutral',
      vencido: false,
      puedeEntregar: false,
      faltaReincorporacion: true
    };
  }

  // 3. Con reincorporación confirmada y plazo calculado
  if (fechaLimite) {
    if (todayCancun > fechaLimite) {
      if (reabiertoMotivo && reabiertoFechaLimite) {
        if (todayCancun <= reabiertoFechaLimite) {
          return {
            estado: 'Reapertura autorizada · Pendiente de entrega',
            cssClass: 'badge-info',
            vencido: false,
            puedeEntregar: true
          };
        } else {
          return {
            estado: 'Plazo vencido (prórroga expirada) · Sin entrega',
            cssClass: 'badge-danger',
            vencido: true,
            puedeEntregar: false
          };
        }
      }
      return {
        estado: 'Plazo vencido · Sin entrega',
        cssClass: 'badge-danger',
        vencido: true,
        puedeEntregar: false
      };
    } else {
      return {
        estado: 'Pendiente con justificación',
        cssClass: 'badge-warning',
        vencido: false,
        puedeEntregar: true
      };
    }
  }

  return {
    estado: 'Pendiente de reincorporación',
    cssClass: 'badge-neutral',
    vencido: false,
    puedeEntregar: false,
    faltaReincorporacion: true
  };
}
window.evaluarEstadoJustificada = evaluarEstadoJustificada;

// --------------------------------------------------------------------------
// 3. CÁLCULO DE MÉTRICAS DIFERENCIADAS (SIN CONFUNDIR CONCEPTOS)
// --------------------------------------------------------------------------
function computeActivityMetrics(act, allEvaluations = [], attendanceExisting = {}, allStudents = []) {
  const actId = String(act.id || '');
  const evalsForAct = (allEvaluations || []).filter(e => String(e.claseId) === actId);
  const evalByStudent = {};
  evalsForAct.forEach(e => { evalByStudent[String(e.alumnoId)] = e; });

  const activeStudents = (allStudents || []).filter(s => s.activo !== false);

  // Soporte tanto para mapa { [studentId]: { status, note } } como para array legacy
  const getStatus = (sId) => {
    if (Array.isArray(attendanceExisting)) {
      const found = attendanceExisting.find(x => String(x.studentId) === String(sId));
      return String(found?.status || '').toUpperCase();
    }
    const item = attendanceExisting[sId] || attendanceExisting[String(sId)];
    return String(typeof item === 'object' ? item?.status : item || '').toUpperCase();
  };

  const presentSet = new Set();
  const absentSet = new Set();
  const justifiedSet = new Set();

  activeStudents.forEach(s => {
    const st = getStatus(s.id);
    if (st === 'A' || st === 'R') presentSet.add(String(s.id));
    else if (st === 'J') {
      justifiedSet.add(String(s.id));
      absentSet.add(String(s.id));
    } else if (st === 'F') {
      absentSet.add(String(s.id));
    }
  });

  // BLOQUEO 1: El universo de alumnos considerados NO se reduce al calificar.
  // En una actividad con alumnos presentes, todos los evaluables son considerados.
  const hasAttendanceRecords = presentSet.size > 0 || absentSet.size > 0;
  let consideredStudents = [];
  if (hasAttendanceRecords) {
    consideredStudents = activeStudents.filter(s => presentSet.has(String(s.id)) || justifiedSet.has(String(s.id)));
    if (!consideredStudents.length) consideredStudents = activeStudents;
  } else {
    consideredStudents = activeStudents;
  }

  let gradedCount = 0;
  let ungradedCount = 0;
  let pendingDeliveryCount = 0;

  const gradedStudents = [];
  const ungradedStudents = [];
  const pendingDeliveryStudents = [];

  consideredStudents.forEach(s => {
    const sid = String(s.id);
    const ev = evalByStudent[sid];

    // Regla estricta: Calificado significa que tiene desempeño o nota de instrumento
    const hasGrade = Boolean(ev && (String(ev.desempeno || '').trim() || (ev.calificacionInstrumento !== '' && ev.calificacionInstrumento !== null && ev.calificacionInstrumento !== undefined)));
    if (hasGrade) {
      gradedCount++;
      gradedStudents.push(s);
    } else {
      ungradedCount++;
      ungradedStudents.push(s);
    }

    // Pendiente de entrega: SOLO quien no ha entregado y está pendiente
    const isJustified = justifiedSet.has(sid);
    const delivered = Boolean(ev && (ev.trabajo === 'Completo' || ev.trabajo === 'Entregada tarde' || ev.fechaEntrega));
    if (!delivered && (isJustified || (ev && ev.trabajo === 'Pendiente'))) {
      pendingDeliveryCount++;
      pendingDeliveryStudents.push(s);
    }
  });

  let estado = 'Sin calificar';
  if (gradedCount > 0 && gradedCount === consideredStudents.length) {
    estado = 'Calificada';
  } else if (gradedCount > 0) {
    estado = 'En proceso';
  }

  return {
    totalConsiderados: consideredStudents.length,
    calificados: gradedCount,
    sinCalificar: ungradedCount,
    ausentesTotal: absentSet.size,
    ausentesJustificados: justifiedSet.size,
    pendientesEntrega: pendingDeliveryCount,
    estado,
    consideredStudents,
    gradedStudents,
    ungradedStudents,
    pendingDeliveryStudents,
    justifiedStudents: activeStudents.filter(s => justifiedSet.has(String(s.id))),
    absentStudents: activeStudents.filter(s => absentSet.has(String(s.id)))
  };
}
window.computeActivityMetrics = computeActivityMetrics;

// --------------------------------------------------------------------------
// 4. ESTADO DE INTERFAZ LOCAL Y SELECCIÓN MÚLTIPLE
// --------------------------------------------------------------------------
window.dailyState = {
  activities: [],
  selectedIds: new Set(),
  activeMode: 'list',
  createDraftActivities: [],
  editBatchDraftActivities: [],
  gradingActivityId: null,
  gradingEvaluations: {},
  filterDate: ''
};

// --------------------------------------------------------------------------
// 5. RENDERIZADO DE LA LISTA UNIFICADA DE ACTIVIDADES
// --------------------------------------------------------------------------
function renderDailyActivitiesList() {
  const container = document.getElementById('dailyActivitiesList');
  const loadingEl = document.getElementById('dailyActivitiesLoading');
  const errorEl = document.getElementById('dailyActivitiesError');
  const errorMsgEl = document.getElementById('dailyActivitiesErrorMessage');
  const updateNoticeEl = document.getElementById('dailyActivitiesUpdateNotice');
  const updateNoticeTextEl = document.getElementById('dailyActivitiesUpdateNoticeText');
  const emptyWrap = document.getElementById('dailyActivitiesEmpty');
  const countEl = document.getElementById('activitiesVisibleCount');
  if (!container) return;

  const gs = getGlobalState();
  const allClases = gs.classes || gs.activities || window.dailyState.activities || [];
  const allEvals = gs.evaluations || [];
  const allStudents = gs.students || [];

  const setVisible = (el, visible) => {
    if (!el || !el.classList) return;
    if (typeof el.classList.toggle === 'function') {
      el.classList.toggle('hidden-control', !visible);
    } else if (!visible) {
      el.classList.add('hidden-control');
    } else {
      el.classList.remove('hidden-control');
    }
  };

  // CASO 1: ESTADO CARGANDO
  if (window.dailyActivitiesQueryStatus === 'loading') {
    setVisible(errorEl, false);
    setVisible(emptyWrap, false);
    if (!allClases.length) {
      setVisible(loadingEl, true);
      setVisible(updateNoticeEl, false);
      setVisible(container, false);
      if (countEl) countEl.textContent = 'Cargando…';
      updateSelectionButtons();
      return;
    } else {
      setVisible(loadingEl, false);
      setVisible(updateNoticeEl, true);
      if (updateNoticeTextEl) updateNoticeTextEl.textContent = '⏳ Actualizando actividades con Google Sheets…';
    }
  }
  // CASO 2: ESTADO CONSULTA FALLIDA
  else if (window.dailyActivitiesQueryStatus === 'error') {
    setVisible(loadingEl, false);
    setVisible(emptyWrap, false); // NUNCA mostrar vacío ante consulta fallida
    if (!allClases.length) {
      setVisible(errorEl, true);
      if (errorMsgEl) {
        if (/acción solicitada no está permitida|accion solicitada no esta permitida|no está permitida|no esta permitida/i.test(window.dailyActivitiesQueryError || '')) {
          errorMsgEl.innerHTML = 'La consulta histórica <code>getDailyActivities</code> no está registrada en el despachador de Google Apps Script.<br><small style="color:#78350f;">Se requiere agregar <code>case \'getDailyActivities\':</code> en el despachador de <b>WebBridge.gs</b> para sincronizar el historial completo.</small>';
        } else {
          errorMsgEl.textContent = window.dailyActivitiesQueryError || 'La conexión con Google tardó demasiado. Intenta nuevamente.';
        }
      }
      setVisible(updateNoticeEl, false);
      setVisible(container, false);
      if (countEl) countEl.textContent = '0 actividades';
      updateSelectionButtons();
      return;
    } else {
      // Conservar datos previamente cargados si falla una actualización
      setVisible(errorEl, false);
      setVisible(updateNoticeEl, true);
      if (updateNoticeTextEl) {
        updateNoticeTextEl.textContent = `⚠️ No fue posible actualizar con el servidor (${window.dailyActivitiesQueryError || 'error de conexión'}). Mostrando actividades cargadas previamente.`;
      }
    }
  }
  // CASO 3 & 4: CONSULTA EXITOSA O IDLE
  else {
    setVisible(loadingEl, false);
    setVisible(errorEl, false);
    setVisible(updateNoticeEl, false);
  }

  // Ordenar por creadoEn desc (las más recientes arriba)
  let list = [...allClases].sort((a, b) => {
    const tA = a.creadoEn ? new Date(a.creadoEn).getTime() : 0;
    const tB = b.creadoEn ? new Date(b.creadoEn).getTime() : 0;
    return tB - tA;
  });

  if (window.dailyState.filterDate) {
    list = list.filter(a => String(a.fecha) === String(window.dailyState.filterDate));
  }

  if (countEl) countEl.textContent = `${list.length} actividad(es)`;

  // CASO 3: CONSULTA EXITOSA SIN ACTIVIDADES
  if (!list.length) {
    container.innerHTML = '';
    setVisible(container, false);
    if (window.dailyActivitiesQueryStatus !== 'error' && window.dailyActivitiesQueryStatus !== 'loading') {
      setVisible(emptyWrap, true);
    }
    updateSelectionButtons();
    return;
  }

  // CASO 4: CONSULTA EXITOSA CON ACTIVIDADES
  setVisible(emptyWrap, false);
  setVisible(container, true);

  const html = list.map(act => {
    const attExisting = getAttendanceMapForDate(act.fecha);
    const metrics = computeActivityMetrics(act, allEvals, attExisting, allStudents);
    const isSelected = window.dailyState.selectedIds.has(String(act.id));

    let estadoClass = 'badge-neutral';
    if (metrics.estado === 'Calificada') estadoClass = 'badge-success';
    else if (metrics.estado === 'En proceso') estadoClass = 'badge-warning';

    const fechaActividad = act.fecha || 'Sin fecha';
    const fechaCreacion = act.creadoEn ? new Date(act.creadoEn).toLocaleDateString('es-MX', { hour: '2-digit', minute: '2-digit' }) : 'Histórica';
    const proyectoBadge = act.proyectoId ? `<span class="badge badge-info" style="font-size:0.75rem;">📂 Proyecto: ${escapeHtml(act.proyectoId)}</span>` : '<span class="badge badge-neutral" style="font-size:0.75rem;">Libre (Sin proyecto)</span>';

    return `
      <article class="panel activity-card ${isSelected ? 'selected' : ''}" data-class-id="${act.id}" style="margin-bottom:12px;padding:14px 18px;border-left:4px solid ${isSelected ? '#0284c7' : '#cbd5e1'};
">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <div style="display:flex;align-items:flex-start;gap:12px;flex:1;min-width:280px;">
            <input type="checkbox" class="activity-select-checkbox" data-id="${act.id}" ${isSelected ? 'checked' : ''} style="width:20px;height:20px;margin-top:4px;cursor:pointer;">
            <div>
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;">
                <button type="button" class="btn-link activity-title-btn" data-action="open-activity" data-id="${act.id}" style="font-size:1.1rem;font-weight:700;color:#0b315d;background:none;border:none;cursor:pointer;padding:0;text-align:left;">
                  ${escapeHtml(act.actividad || 'Actividad sin nombre')}
                </button>
                <span class="badge ${estadoClass}">${metrics.estado}</span>
                ${proyectoBadge}
              </div>
              <div style="font-size:0.875rem;color:#475569;display:flex;gap:16px;flex-wrap:wrap;">
                <span>📚 <strong>Materia:</strong> ${escapeHtml(act.materia || 'General')}</span>
                <span>📅 <strong>Fecha actividad:</strong> ${fechaActividad}</span>
                <span>⏰ <strong>Creado:</strong> ${fechaCreacion}</span>
              </div>
            </div>
          </div>
        </div>

        <div style="margin-top:12px;padding-top:10px;border-top:1px solid #e2e8f0;display:flex;gap:14px;flex-wrap:wrap;font-size:0.85rem;">
          <span>👥 Total considerados: <strong>${metrics.totalConsiderados}</strong></span>
          <button type="button" class="btn-link metric-badge-btn" data-action="show-breakdown" data-type="calificados" data-id="${act.id}" style="color:#16a34a;background:none;border:none;cursor:pointer;padding:0;">
            ✓ Calificados: <strong>${metrics.calificados}</strong>
          </button>
          <button type="button" class="btn-link metric-badge-btn" data-action="show-breakdown" data-type="sin-calificar" data-id="${act.id}" style="color:#d97706;background:none;border:none;cursor:pointer;padding:0;">
            ⏳ Sin calificar: <strong>${metrics.sinCalificar}</strong>
          </button>
          <button type="button" class="btn-link metric-badge-btn" data-action="show-breakdown" data-type="ausentes" data-id="${act.id}" style="color:#64748b;background:none;border:none;cursor:pointer;padding:0;">
            🚫 Ausentes: <strong>${metrics.ausentesTotal}</strong> ${metrics.ausentesJustificados > 0 ? `(${metrics.ausentesJustificados} justificada(s))` : ''}
          </button>
          ${metrics.pendientesEntrega > 0 ? `
            <button type="button" class="btn-link metric-badge-btn" data-action="show-breakdown" data-type="pendientes-entrega" data-id="${act.id}" style="color:#dc2626;font-weight:600;background:none;border:none;cursor:pointer;padding:0;">
              ⚠️ Pendientes de entrega: <strong>${metrics.pendientesEntrega}</strong>
            </button>
          ` : ''}
        </div>
      </article>
    `;
  }).join('');

  container.innerHTML = html;

  // Bindings
  container.querySelectorAll('.activity-select-checkbox').forEach(cb => {
    cb.addEventListener('change', e => {
      toggleSelectActivity(e.target.dataset.id, e.target.checked);
    });
  });

  container.querySelectorAll('.activity-title-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      openGradingView(btn.dataset.id);
    });
  });

  container.querySelectorAll('.metric-badge-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      showStudentBreakdownModal(btn.dataset.type, btn.dataset.id);
    });
  });

  updateSelectionButtons();
}
window.renderDailyActivitiesList = renderDailyActivitiesList;

function updateSelectionButtons() {
  const count = window.dailyState.selectedIds.size;
  const btnEdit = document.getElementById('btnEditSelectedActivities');
  const btnDelete = document.getElementById('btnDeleteSelectedActivities');
  const selectAllCb = document.getElementById('selectAllActivities');

  if (btnEdit) {
    btnEdit.disabled = count === 0;
    btnEdit.title = count === 0 ? 'Selecciona al menos una actividad' : `Editar ${count} actividad(es)`;
  }
  if (btnDelete) {
    btnDelete.disabled = count === 0;
    btnDelete.title = count === 0 ? 'Selecciona al menos una actividad' : `Eliminar ${count} actividad(es)`;
  }

  const gs = getGlobalState();
  const allClases = gs.classes || gs.activities || window.dailyState.activities || [];
  if (selectAllCb) {
    selectAllCb.checked = allClases.length > 0 && count === allClases.length;
    selectAllCb.indeterminate = count > 0 && count < allClases.length;
  }
}
window.updateSelectionButtons = updateSelectionButtons;

function toggleSelectActivity(id, isSelected) {
  if (isSelected) {
    window.dailyState.selectedIds.add(String(id));
  } else {
    window.dailyState.selectedIds.delete(String(id));
  }
  const card = document.querySelector(`.activity-card[data-class-id="${id}"]`);
  if (card) {
    card.classList.toggle('selected', isSelected);
    card.style.borderLeftColor = isSelected ? '#0284c7' : '#cbd5e1';
  }
  updateSelectionButtons();
}
window.toggleSelectActivity = toggleSelectActivity;

function toggleSelectAllActivities(selectAll) {
  const gs = getGlobalState();
  const allClases = gs.classes || gs.activities || window.dailyState.activities || [];
  if (selectAll) {
    allClases.forEach(a => window.dailyState.selectedIds.add(String(a.id)));
  } else {
    window.dailyState.selectedIds.clear();
  }
  renderDailyActivitiesList();
}
window.toggleSelectAllActivities = toggleSelectAllActivities;

// --------------------------------------------------------------------------
// 6. CREACIÓN DE ACTIVIDADES EN LOTE (PROYECTO OPCIONAL Y SIN CALIFICAR)
// --------------------------------------------------------------------------
let _isSavingNewBatch = false;

function openCreateActivitiesView(initialProjectId = '') {
  window.dailyState.activeMode = 'create';
  document.getElementById('dailyMainView')?.classList.add('hidden-control');
  document.getElementById('dailyEditBatchView')?.classList.add('hidden-control');
  document.getElementById('dailyGradingView')?.classList.add('hidden-control');
  const createView = document.getElementById('dailyCreateView');
  if (createView) createView.classList.remove('hidden-control');

  const draftKey = 'carpeta_academica_draft_create_batch_v1';
  const savedDraft = localStorage.getItem(draftKey);
  if (savedDraft) {
    try {
      const parsed = JSON.parse(savedDraft);
      if (Array.isArray(parsed) && parsed.length > 0) {
        window.dailyState.createDraftActivities = parsed;
        renderCreateActivitiesList();
        checkCreateDraftNotice();
        return;
      }
    } catch (e) {}
  }

  window.dailyState.createDraftActivities = [createEmptyActivityTemplate(initialProjectId)];
  renderCreateActivitiesList();
  checkCreateDraftNotice();
}
window.openCreateActivitiesView = openCreateActivitiesView;

function createEmptyActivityTemplate(projectId = '') {
  return {
    tempId: 'NEW-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    actividad: '',
    materia: '',
    pdaTema: '',
    material: 'Lenguajes',
    tipoActividad: 'Clase',
    paginas: '',
    instrucciones: '',
    fecha: getTodayIsoCancun(),
    horaInicio: '13:00',
    horaFin: '14:00',
    instrumentoId: '',
    linkProject: Boolean(projectId),
    proyectoId: projectId || ''
  };
}
window.createEmptyActivityTemplate = createEmptyActivityTemplate;

function syncCreateCardsDomToMemory() {
  const container = document.getElementById('createActivitiesList');
  if (!container || !window.dailyState.createDraftActivities) return;
  window.dailyState.createDraftActivities.forEach(act => {
    const card = container.querySelector(`.create-activity-card[data-temp-id="${act.tempId}"]`);
    if (!card) return;
    card.querySelectorAll('.create-field').forEach(input => {
      const field = input.dataset.field;
      if (field && input.value !== undefined) {
        act[field] = input.value;
      }
    });
    const cb = card.querySelector('.create-link-project-cb');
    if (cb) {
      act.linkProject = cb.checked;
      if (!act.linkProject) act.proyectoId = '';
    }
  });
}

function addAnotherCreateActivityCard() {
  syncCreateCardsDomToMemory();
  const newAct = createEmptyActivityTemplate();
  window.dailyState.createDraftActivities.push(newAct);
  renderCreateActivitiesList();
  saveCreateBatchDraft();
  const cards = document.querySelectorAll('.create-activity-card');
  if (cards.length) cards[cards.length - 1].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
window.addAnotherCreateActivityCard = addAnotherCreateActivityCard;

function renderCreateActivitiesList() {
  const container = document.getElementById('createActivitiesList');
  if (!container) return;

  const gs = getGlobalState();
  const projects = gs.projects || (typeof state !== 'undefined' ? state.projects : []) || [];
  const subjects = gs.subjects || (typeof state !== 'undefined' ? state.subjects : []) || [
    { nombre: 'Lenguajes' },
    { nombre: 'Saberes y Pensamiento Matemático' },
    { nombre: 'Saberes y Pensamiento Científico' },
    { nombre: 'Ética, Naturaleza y Sociedades' },
    { nombre: 'De lo Humano y lo Comunitario' }
  ];

  container.innerHTML = window.dailyState.createDraftActivities.map((act, index) => {
    return `
      <div class="panel create-activity-card" data-temp-id="${act.tempId}" style="margin-bottom:16px;padding:16px;border:1px solid #cbd5e1;border-radius:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <h4 style="margin:0;color:#0b315d;">Actividad #${index + 1}</h4>
          ${window.dailyState.createDraftActivities.length > 1 ? `
            <button type="button" class="btn danger small" onclick="removeCreateActivityCard('${act.tempId}')">Eliminar tarjeta</button>
          ` : ''}
        </div>

        <div class="form-grid two" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:12px;">
          <label style="font-weight:600;font-size:0.85rem;">Nombre de la actividad *
            <input type="text" class="input create-field" data-temp-id="${act.tempId}" data-field="actividad" value="${escapeHtml(act.actividad)}" placeholder="Ej. Identificamos los órganos del aparato digestivo" required>
          </label>

          <label style="font-weight:600;font-size:0.85rem;">Materia / Campo formativo *
            <select class="input create-field" data-temp-id="${act.tempId}" data-field="materia" required>
              <option value="">Selecciona materia</option>
              ${subjects.map(s => `<option value="${escapeHtml(s.nombre)}" ${act.materia === s.nombre ? 'selected' : ''}>${escapeHtml(s.nombre)}</option>`).join('')}
            </select>
          </label>

          <label style="font-weight:600;font-size:0.85rem;grid-column: 1 / -1;">PDA asociado (según la materia seleccionada)
            <select class="input create-field" data-temp-id="${act.tempId}" data-field="pdaTema">
              ${renderPdaOptionsHtml(act.materia, act.pdaTema)}
            </select>
          </label>

          <label style="font-weight:600;font-size:0.85rem;">Cuaderno, libro o material *
            <select class="input create-field" data-temp-id="${act.tempId}" data-field="material" required>
              ${renderMaterialOptionsHtml(act.material)}
            </select>
          </label>

          <label style="font-weight:600;font-size:0.85rem;">Tipo de actividad
            <select class="input create-field" data-temp-id="${act.tempId}" data-field="tipoActividad">
              <option value="Clase" ${act.tipoActividad === 'Clase' ? 'selected' : ''}>Clase</option>
              <option value="Tarea para casa" ${act.tipoActividad === 'Tarea para casa' ? 'selected' : ''}>Tarea para casa</option>
            </select>
          </label>

          <label style="font-weight:600;font-size:0.85rem;">Páginas realizadas
            <input type="text" class="input create-field" data-temp-id="${act.tempId}" data-field="paginas" value="${escapeHtml(act.paginas)}" placeholder="Ej. 42 y 43">
          </label>

          <label style="font-weight:600;font-size:0.85rem;">Fecha de realización *
            <input type="date" class="input create-field" data-temp-id="${act.tempId}" data-field="fecha" value="${act.fecha}" required>
          </label>

          <label style="font-weight:600;font-size:0.85rem;">Hora inicio *
            <input type="time" class="input create-field" data-temp-id="${act.tempId}" data-field="horaInicio" value="${cleanClassHour(act.horaInicio) || '13:00'}" required>
          </label>

          <label style="font-weight:600;font-size:0.85rem;">Hora fin *
            <input type="time" class="input create-field" data-temp-id="${act.tempId}" data-field="horaFin" value="${cleanClassHour(act.horaFin) || '14:00'}" required>
          </label>

          <label style="font-weight:600;font-size:0.85rem;grid-column: 1 / -1;">Instrumento de evaluación (opcional)
            <select class="input create-field" data-temp-id="${act.tempId}" data-field="instrumentoId">
              ${renderInstrumentOptionsHtml(act.instrumentoId)}
            </select>
          </label>

          <label style="font-weight:600;font-size:0.85rem;grid-column: 1 / -1;">Instrucciones completas
            <textarea class="input create-field" data-temp-id="${act.tempId}" data-field="instrucciones" rows="2" placeholder="Escribe las indicaciones que verá la familia en el reporte">${escapeHtml(act.instrucciones)}</textarea>
          </label>
        </div>

        <!-- Casilla compacta alineada a la izquierda -->
        <div style="margin-top:12px;padding:10px 14px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0;text-align:left;">
          <label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;margin:0;font-weight:600;font-size:0.85rem;color:#1e293b;">
            <input type="checkbox" class="create-link-project-cb" data-temp-id="${act.tempId}" ${act.linkProject ? 'checked' : ''} style="width:16px;height:16px;margin:0;cursor:pointer;">
            <span>Vincular a un proyecto (opcional)</span>
          </label>

          <div class="create-project-select-wrap ${act.linkProject ? '' : 'hidden-control'}" data-temp-id="${act.tempId}" style="margin-top:8px;">
            <label style="margin:0;font-size:0.82rem;font-weight:600;color:#475569;">Proyecto activo vinculado:
              <select class="input create-field project-select" data-temp-id="${act.tempId}" data-field="proyectoId" style="margin-top:4px;">
                <option value="">-- Selecciona un proyecto --</option>
                ${projects.map(p => `<option value="${escapeHtml(p.id)}" ${String(act.proyectoId) === String(p.id) ? 'selected' : ''}>${escapeHtml(p.nombre || p.id)}</option>`).join('')}
              </select>
            </label>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Eventos para los campos
  container.querySelectorAll('.create-field').forEach(input => {
    const handleFieldChange = (e) => {
      const tempId = e.target.dataset.tempId;
      const field = e.target.dataset.field;
      const item = window.dailyState.createDraftActivities.find(x => x.tempId === tempId);
      if (!item) return;

      item[field] = e.target.value;

      // Si cambió materia: actualizar ÚNICAMENTE el selector de PDA de esta tarjeta sin recargar las demás tarjetas
      if (field === 'materia') {
        item.pdaTema = '';
        const card = container.querySelector(`.create-activity-card[data-temp-id="${tempId}"]`);
        const pdaSelect = card?.querySelector('[data-field="pdaTema"]');
        if (pdaSelect) {
          pdaSelect.innerHTML = renderPdaOptionsHtml(item.materia, '');
        }
      }
      saveCreateBatchDraft();
    };
    input.addEventListener('input', handleFieldChange);
    input.addEventListener('change', handleFieldChange);
  });

  // Evento para la casilla de proyecto
  container.querySelectorAll('.create-link-project-cb').forEach(cb => {
    cb.addEventListener('change', e => {
      const tempId = e.target.dataset.tempId;
      const item = window.dailyState.createDraftActivities.find(x => x.tempId === tempId);
      if (item) {
        item.linkProject = e.target.checked;
        if (!item.linkProject) item.proyectoId = '';
        saveCreateBatchDraft();
        const wrap = container.querySelector(`.create-project-select-wrap[data-temp-id="${tempId}"]`);
        if (wrap) wrap.classList.toggle('hidden-control', !item.linkProject);
      }
    });
  });
}
window.renderCreateActivitiesList = renderCreateActivitiesList;

function removeCreateActivityCard(tempId) {
  window.dailyState.createDraftActivities = window.dailyState.createDraftActivities.filter(x => x.tempId !== tempId);
  if (!window.dailyState.createDraftActivities.length) {
    window.dailyState.createDraftActivities.push(createEmptyActivityTemplate());
  }
  renderCreateActivitiesList();
  saveCreateBatchDraft();
}
window.removeCreateActivityCard = removeCreateActivityCard;

function saveCreateBatchDraft() {
  const draftKey = 'carpeta_academica_draft_create_batch_v1';
  localStorage.setItem(draftKey, JSON.stringify(window.dailyState.createDraftActivities));
  checkCreateDraftNotice();
}

function checkCreateDraftNotice() {
  const notice = document.getElementById('createDraftNotice');
  const draftKey = 'carpeta_academica_draft_create_batch_v1';
  const hasDraft = Boolean(localStorage.getItem(draftKey));
  if (notice) notice.classList.toggle('hidden-control', !hasDraft);
}

// CREAR NO ES CALIFICAR + PERSISTENCIA Y REINTENTOS REALES
async function saveNewActivitiesBatch() {
  if (_isSavingNewBatch) return;
  _isSavingNewBatch = true;

  syncCreateCardsDomToMemory();
  const activities = window.dailyState.createDraftActivities;
  if (!activities || !activities.length) {
    _isSavingNewBatch = false;
    return;
  }

  // Validaciones
  for (let i = 0; i < activities.length; i++) {
    const act = activities[i];
    if (!String(act.actividad || '').trim()) {
      _isSavingNewBatch = false;
      return alert(`Falta el nombre en la actividad #${i + 1}`);
    }
    if (!String(act.materia || '').trim()) {
      _isSavingNewBatch = false;
      return alert(`Selecciona la materia en la actividad #${i + 1}`);
    }
    if (!String(act.fecha || '').trim()) {
      _isSavingNewBatch = false;
      return alert(`Falta la fecha en la actividad #${i + 1}`);
    }
    if (act.linkProject && !String(act.proyectoId || '').trim()) {
      _isSavingNewBatch = false;
      return alert(`Seleccionaste vincular a proyecto en la actividad #${i + 1}, pero no elegiste cuál.`);
    }
  }

  if (typeof setLoading === 'function') setLoading(true, 'Guardando nuevas actividades...');
  const gs = getGlobalState();
  let successCount = 0;
  const errors = [];
  const failedIndices = [];

  for (let i = 0; i < activities.length; i++) {
    const act = activities[i];
    const actKey = act.tempId || ('TEMP-' + i);

    let existingOp = null;
    if (typeof findInActivityRegistry === 'function') {
      const regEntry = findInActivityRegistry({ localId: actKey });
      if (regEntry && regEntry.pendingOperation && (regEntry.pendingOperation.status === 'uncertain' || regEntry.pendingOperation.status === 'in_flight')) {
        existingOp = regEntry.pendingOperation;
      }
    }

    const requestKey = existingOp ? existingOp.requestKey : `REQ-ACT-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`;

    const payload = existingOp ? existingOp.payload : {
      requestKey,
      protocolVersion: 'RD-03',
      actividad: String(act.actividad).trim(),
      materia: String(act.materia).trim(),
      pdaTema: act.pdaTema || '',
      fecha: String(act.fecha).trim(),
      horaInicio: act.horaInicio || '13:00',
      horaFin: act.horaFin || '14:00',
      material: String(act.material || 'Lenguajes').trim(),
      tipoActividad: act.tipoActividad || 'Clase',
      paginas: act.paginas || '',
      instrucciones: act.instrucciones || '',
      instrumentoId: act.instrumentoId || '',
      proyectoId: act.linkProject ? String(act.proyectoId || '').trim() : '',
      // REGLA CLAVE R26: CREAR NO ES CALIFICAR (cero evaluaciones inventadas)
      evaluaciones: []
    };

    if (typeof saveActivityToRegistry === 'function') {
      saveActivityToRegistry(actKey, {
        status: 'Guardando',
        pendingOperation: { requestKey, payload, status: 'in_flight' }
      });
    }

    try {
      const resp = await server('saveClassRecord', payload);
      if (resp && resp.ok) {
        successCount++;
        const savedRec = resp.activity || resp.classRecord;
        if (typeof saveActivityToRegistry === 'function') {
          saveActivityToRegistry(actKey, {
            id: savedRec?.id,
            localId: actKey,
            status: 'Guardado',
            pendingOperation: null
          });
        }
        gs.classes = gs.classes || [];
        if (savedRec) {
          gs.classes.unshift(savedRec);
        }
        gs.stats = gs.stats || {};
        gs.stats.activities = (gs.stats.activities || 0) + 1;
      } else {
        failedIndices.push(i);
        errors.push(`Actividad #${i + 1}: ${resp?.error || 'No se pudo guardar'}`);
      }
    } catch (e) {
      failedIndices.push(i);
      const isNetError = /interrumpió|conex|tardó|tiempo de espera/i.test(String(e.message || ''));
      if (isNetError && typeof saveActivityToRegistry === 'function') {
        saveActivityToRegistry(actKey, {
          localId: actKey,
          status: 'Pendiente de guardar',
          error: e.message,
          pendingOperation: { requestKey, payload, status: 'uncertain' }
        });
      } else if (typeof saveActivityToRegistry === 'function') {
        saveActivityToRegistry(actKey, {
          localId: actKey,
          status: 'Borrador',
          error: e.message,
          pendingOperation: { requestKey, payload, status: 'rejected' }
        });
      }
      errors.push(`Actividad #${i + 1}: ${e.message}`);
    }
  }

  if (typeof setLoading === 'function') setLoading(false);
  _isSavingNewBatch = false;

  if (successCount === activities.length) {
    localStorage.removeItem('carpeta_academica_draft_create_batch_v1');
    if (typeof toast === 'function') toast(`Se crearon exitosamente ${successCount} actividad(es).`);
    backToDailyActivitiesList();
  } else {
    // Si hubo guardado parcial, conservamos únicamente las tarjetas que fallaron
    if (successCount > 0 && failedIndices.length > 0) {
      window.dailyState.createDraftActivities = window.dailyState.createDraftActivities.filter((_, idx) => failedIndices.includes(idx));
      saveCreateDraftToStorage();
      renderCreateCards();
    }
    // Si fallaron todas (successCount === 0), dejamos window.dailyState.createDraftActivities intacto en pantalla
    alert(`Se guardaron ${successCount} de ${activities.length} actividades.\nErrores:\n${errors.join('\n')}`);
  }
}
window.saveNewActivitiesBatch = saveNewActivitiesBatch;

function backToDailyActivitiesList() {
  window.dailyState.activeMode = 'list';
  document.getElementById('dailyCreateView')?.classList.add('hidden-control');
  document.getElementById('dailyEditBatchView')?.classList.add('hidden-control');
  document.getElementById('dailyGradingView')?.classList.add('hidden-control');
  document.getElementById('dailyMainView')?.classList.remove('hidden-control');
  window.dailyState.selectedIds.clear();
  renderDailyActivitiesList();
}
window.backToDailyActivitiesList = backToDailyActivitiesList;

// 7. EDICIÓN EN LOTE (CONSERVACIÓN ÍNTEGRA DE EVALUACIONES E INSTRUMENTOS)
// --------------------------------------------------------------------------
let _isSavingBatchEdits = false;

function openBatchEditView() {
  const selectedCount = window.dailyState.selectedIds.size;
  if (!selectedCount) return alert('Selecciona al menos una actividad para editar.');

  window.dailyState.activeMode = 'edit-batch';
  window.dailyState.batchEditsDirty = false;
  document.getElementById('dailyMainView')?.classList.add('hidden-control');
  document.getElementById('dailyCreateView')?.classList.add('hidden-control');
  document.getElementById('dailyGradingView')?.classList.add('hidden-control');
  const editView = document.getElementById('dailyEditBatchView');
  if (editView) editView.classList.remove('hidden-control');

  const gs = getGlobalState();
  const allClases = gs.classes || gs.activities || window.dailyState.activities || [];
  window.dailyState.editBatchDraftActivities = allClases
    .filter(a => window.dailyState.selectedIds.has(String(a.id)))
    .map(a => Object.assign({}, a));

  renderBatchEditActivitiesList();
}
window.openBatchEditView = openBatchEditView;

function renderBatchEditActivitiesList() {
  const container = document.getElementById('editBatchActivitiesList');
  if (!container) return;

  const gs = getGlobalState();
  const projects = gs.projects || (typeof state !== 'undefined' ? state.projects : []) || [];
  const subjects = gs.subjects || (typeof state !== 'undefined' ? state.subjects : []) || [
    { nombre: 'Lenguajes' },
    { nombre: 'Saberes y Pensamiento Matemático' },
    { nombre: 'Saberes y Pensamiento Científico' },
    { nombre: 'Ética, Naturaleza y Sociedades' },
    { nombre: 'De lo Humano y lo Comunitario' }
  ];

  container.innerHTML = window.dailyState.editBatchDraftActivities.map((act, index) => {
    return `
      <div class="panel batch-edit-card" data-id="${act.id}" style="margin-bottom:16px;padding:16px;border:1px solid #cbd5e1;border-radius:8px;">
        <h4 style="margin:0 0 12px 0;color:#0b315d;">Actividad #${index + 1}: ${escapeHtml(act.actividad || act.id)} <small class="muted">(ID: ${act.id})</small></h4>
        <div class="form-grid two" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:12px;">
          <label style="font-weight:600;font-size:0.85rem;">Nombre de la actividad *
            <input type="text" class="input edit-field" data-id="${act.id}" data-field="actividad" value="${escapeHtml(act.actividad)}" required>
          </label>

          <label style="font-weight:600;font-size:0.85rem;">Materia / Campo formativo *
            <select class="input edit-field" data-id="${act.id}" data-field="materia" required>
              ${subjects.map(s => `<option value="${escapeHtml(s.nombre)}" ${act.materia === s.nombre ? 'selected' : ''}>${escapeHtml(s.nombre)}</option>`).join('')}
            </select>
          </label>

          <label style="font-weight:600;font-size:0.85rem;grid-column: 1 / -1;">PDA asociado
            <select class="input edit-field" data-id="${act.id}" data-field="pdaTema">
              ${renderPdaOptionsHtml(act.materia, act.pdaTema)}
            </select>
          </label>

          <label style="font-weight:600;font-size:0.85rem;">Cuaderno, libro o material *
            <select class="input edit-field" data-id="${act.id}" data-field="material" required>
              ${renderMaterialOptionsHtml(act.material)}
            </select>
          </label>

          <label style="font-weight:600;font-size:0.85rem;">Tipo de actividad
            <select class="input edit-field" data-id="${act.id}" data-field="tipoActividad">
              <option value="Clase" ${act.tipoActividad === 'Clase' ? 'selected' : ''}>Clase</option>
              <option value="Tarea para casa" ${act.tipoActividad === 'Tarea para casa' ? 'selected' : ''}>Tarea para casa</option>
            </select>
          </label>

          <label style="font-weight:600;font-size:0.85rem;">Páginas realizadas
            <input type="text" class="input edit-field" data-id="${act.id}" data-field="paginas" value="${escapeHtml(act.paginas || '')}">
          </label>

          <label style="font-weight:600;font-size:0.85rem;">Fecha de realización *
            <input type="date" class="input edit-field" data-id="${act.id}" data-field="fecha" value="${act.fecha}" required>
          </label>

          <label style="font-weight:600;font-size:0.85rem;">Hora inicio *
            <input type="time" class="input edit-field" data-id="${act.id}" data-field="horaInicio" value="${cleanClassHour(act.horaInicio)}" required>
          </label>

          <label style="font-weight:600;font-size:0.85rem;">Hora fin *
            <input type="time" class="input edit-field" data-id="${act.id}" data-field="horaFin" value="${cleanClassHour(act.horaFin)}" required>
          </label>

          <label style="font-weight:600;font-size:0.85rem;">Proyecto vinculado
            <select class="input edit-field" data-id="${act.id}" data-field="proyectoId">
              <option value="">Sin proyecto (Libre)</option>
              ${projects.map(p => `<option value="${escapeHtml(p.id)}" ${String(act.proyectoId) === String(p.id) ? 'selected' : ''}>${escapeHtml(p.nombre || p.id)}</option>`).join('')}
            </select>
          </label>

          <label style="font-weight:600;font-size:0.85rem;">Instrumento de evaluación
            <select class="input edit-field" data-id="${act.id}" data-field="instrumentoId">
              ${renderInstrumentOptionsHtml(act.instrumentoId)}
            </select>
          </label>

          <label style="font-weight:600;font-size:0.85rem;grid-column: 1 / -1;">Instrucciones completas
            <textarea class="input edit-field" data-id="${act.id}" data-field="instrucciones" rows="2">${escapeHtml(act.instrucciones || '')}</textarea>
          </label>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.edit-field').forEach(input => {
    const handleFieldChange = (e) => {
      const id = e.target.dataset.id;
      const field = e.target.dataset.field;
      const item = window.dailyState.editBatchDraftActivities.find(x => String(x.id) === String(id));
      if (!item) return;

      item[field] = e.target.value;
      item._dirty = true;
      window.dailyState.batchEditsDirty = true;

      if (field === 'materia') {
        item.pdaTema = '';
        const card = container.querySelector(`.batch-edit-card[data-id="${id}"]`);
        const pdaSelect = card?.querySelector('[data-field="pdaTema"]');
        if (pdaSelect) {
          pdaSelect.innerHTML = renderPdaOptionsHtml(item.materia, '');
        }
      }
    };
    input.addEventListener('input', handleFieldChange);
    input.addEventListener('change', handleFieldChange);
  });
}
window.renderBatchEditActivitiesList = renderBatchEditActivitiesList;

// CONSERVACIÓN DE EVALUACIONES + GUARDADO Y REINTENTOS REALES
async function saveBatchEdits() {
  if (_isSavingBatchEdits) return;
  _isSavingBatchEdits = true;

  const activities = window.dailyState.editBatchDraftActivities;
  if (!activities || !activities.length) {
    _isSavingBatchEdits = false;
    return;
  }

  if (typeof setLoading === 'function') setLoading(true, 'Guardando cambios...');
  const gs = getGlobalState();
  let successCount = 0;
  const errors = [];

  for (let i = 0; i < activities.length; i++) {
    const act = activities[i];
    const actId = String(act.id);

    const existingEvals = (gs.evaluations || []).filter(e => String(e.claseId) === actId);

    let existingOp = null;
    if (typeof findInActivityRegistry === 'function') {
      const regEntry = findInActivityRegistry({ id: actId });
      if (regEntry && regEntry.pendingOperation && (regEntry.pendingOperation.status === 'uncertain' || regEntry.pendingOperation.status === 'in_flight')) {
        existingOp = regEntry.pendingOperation;
      }
    }

    const requestKey = existingOp ? existingOp.requestKey : `REQ-EDIT-${actId}-${Date.now()}`;

    const cleanIni = cleanClassHour(act.horaInicio);
    const cleanFin = cleanClassHour(act.horaFin);
    if (!isValidClassHour(act.horaInicio) || !isValidClassHour(act.horaFin) || cleanFin <= cleanIni) {
      if (typeof setLoading === 'function') setLoading(false);
      _isSavingBatchEdits = false;
      return alert(`La actividad "${act.actividad || actId}" no tiene un horario válido o no está disponible en el registro. Ingresa hora de inicio y fin en formato HH:mm (la hora de fin debe ser posterior a la de inicio).`);
    }

    const payload = existingOp ? existingOp.payload : {
      id: act.id,
      requestKey,
      protocolVersion: 'RD-03',
      actividad: String(act.actividad).trim(),
      materia: String(act.materia).trim(),
      pdaTema: act.pdaTema || '',
      fecha: String(act.fecha).trim(),
      horaInicio: cleanIni,
      horaFin: cleanFin,
      material: String(act.material || 'Lenguajes').trim(),
      tipoActividad: act.tipoActividad || 'Clase',
      paginas: act.paginas || '',
      instrucciones: act.instrucciones || '',
      proyectoId: String(act.proyectoId || '').trim(),
      instrumentoId: act.instrumentoId || '',
      instrumentoTipo: act.instrumentoTipo || (act.instrumentoId ? 'INSTRUMENTO' : 'SIMPLE'),
      // REGLA CLAVE R26: Conservación íntegra de evaluaciones existentes
      evaluaciones: existingEvals
    };

    if (typeof saveActivityToRegistry === 'function') {
      saveActivityToRegistry(actId, {
        id: actId,
        status: 'Guardando',
        pendingOperation: { requestKey, payload, status: 'in_flight' }
      });
    }

    try {
      const resp = await server('saveClassRecord', payload);
      if (resp && resp.ok) {
        successCount++;
        const savedRec = resp.activity || resp.classRecord;
        if (typeof saveActivityToRegistry === 'function') {
          saveActivityToRegistry(actId, {
            id: actId,
            status: 'Guardado',
            pendingOperation: null
          });
        }
        if (gs.classes) {
          const idx = gs.classes.findIndex(c => String(c.id) === actId);
          if (idx >= 0 && savedRec) {
            gs.classes[idx] = Object.assign({}, gs.classes[idx], savedRec);
          }
        }
      } else {
        errors.push(`Actividad #${actId}: ${resp?.error || 'No se pudo guardar'}`);
      }
    } catch (e) {
      const isNetError = /interrumpió|conex|tardó|tiempo de espera/i.test(String(e.message || ''));
      if (isNetError && typeof saveActivityToRegistry === 'function') {
        saveActivityToRegistry(actId, {
          id: actId,
          status: 'Pendiente de guardar',
          error: e.message,
          pendingOperation: { requestKey, payload, status: 'uncertain' }
        });
      } else if (typeof saveActivityToRegistry === 'function') {
        saveActivityToRegistry(actId, {
          id: actId,
          status: 'Borrador',
          error: e.message,
          pendingOperation: { requestKey, payload, status: 'rejected' }
        });
      }
      errors.push(`Actividad #${actId}: ${e.message}`);
    }
  }

  if (typeof setLoading === 'function') setLoading(false);
  _isSavingBatchEdits = false;

  if (successCount === activities.length) {
    window.dailyState.batchEditsDirty = false;
    if (typeof toast === 'function') toast(`Se actualizaron exitosamente ${successCount} actividad(es).`);
    backToDailyActivitiesList();
  } else {
    alert(`Se actualizaron ${successCount} de ${activities.length} actividades.\nErrores:\n${errors.join('\n')}`);
    renderDailyActivitiesList();
  }
}
window.saveBatchEdits = saveBatchEdits;

function handleBackFromBatchEdits() {
  if (window.dailyState.batchEditsDirty) {
    const modal = document.getElementById('modalConfirmDiscardEdits');
    if (modal) {
      modal.classList.remove('hidden-control');
      return;
    }
    if (!confirm('Tienes cambios sin guardar en las actividades. ¿Deseas descartarlos y regresar?')) {
      return;
    }
  }
  backToDailyActivitiesList();
}
window.handleBackFromBatchEdits = handleBackFromBatchEdits;

// 8. ELIMINACIÓN EN LOTE (LIMPIEZA QUE IMPIDE RECREACIÓN POR BORRADOR ANTIGUO)
// --------------------------------------------------------------------------
function confirmDeleteSelectedActivities() {
  const selectedIds = Array.from(window.dailyState.selectedIds);
  if (!selectedIds.length) return alert('Selecciona al menos una actividad para eliminar.');

  const gs = getGlobalState();
  const allClases = gs.classes || gs.activities || window.dailyState.activities || [];
  const allEvals = gs.evaluations || [];

  const toDelete = allClases.filter(c => selectedIds.includes(String(c.id)));
  const affectedEvals = allEvals.filter(e => selectedIds.includes(String(e.claseId)));

  const countEl = document.getElementById('deleteCountText');
  const namesEl = document.getElementById('deleteNamesList');
  const evalsEl = document.getElementById('deleteEvalsWarning');

  if (countEl) countEl.textContent = `¿Estás seguro de eliminar ${toDelete.length} actividad(es)?`;
  if (namesEl) namesEl.innerHTML = toDelete.map(a => `<li>${escapeHtml(a.actividad || a.id)} (Fecha: ${a.fecha || 'Sin fecha'})</li>`).join('');
  if (evalsEl) evalsEl.textContent = `Esta acción eliminará de forma irreversible ${affectedEvals.length} evaluación(es) asociada(s).`;

  const modal = document.getElementById('modalConfirmDeleteActivities');
  if (modal) {
    modal.classList.remove('hidden-control');
  } else {
    if (confirm(`¿Eliminar definitivamente ${toDelete.length} actividad(es)?`)) {
      executeDeleteSelectedActivities(selectedIds);
    }
  }
}
window.confirmDeleteSelectedActivities = confirmDeleteSelectedActivities;

async function executeDeleteSelectedActivities(idsToDelete = null) {
  const ids = idsToDelete || Array.from(window.dailyState.selectedIds);
  if (!ids.length) return;

  const modal = document.getElementById('modalConfirmDeleteActivities');
  if (modal) modal.classList.add('hidden-control');

  if (typeof setLoading === 'function') setLoading(true, 'Eliminando actividades seleccionadas...');
  try {
    const resp = await server('deleteClassRecords', ids);
    if (resp && resp.ok) {
      const deletedSet = new Set(ids.map(String));
      const gs = getGlobalState();

      if (gs.classes) {
        gs.classes = gs.classes.filter(c => !deletedSet.has(String(c.id)));
      }
      if (gs.activities) {
        gs.activities = gs.activities.filter(c => !deletedSet.has(String(c.id)));
      }
      if (gs.evaluations) {
        gs.evaluations = gs.evaluations.filter(e => !deletedSet.has(String(e.claseId)));
      }
      if (gs.stats) {
        gs.stats.activities = (gs.classes || []).length;
      }

      // DEFECTO 4: Limpieza local que impide recreación por un borrador o reintento antiguo
      ids.forEach(id => {
        const strId = String(id);
        const curDraft = typeof readDraft === 'function' ? readDraft(DRAFT_KEYS.classRecord) : null;
        if (curDraft && (String(curDraft.data?.id) === strId || String(curDraft.data?.localId) === strId)) {
          if (typeof clearDraft === 'function') clearDraft(DRAFT_KEYS.classRecord);
        }

        // Limpiar del registro multicontexto
        if (typeof getActivityRegistry === 'function') {
          const reg = getActivityRegistry();
          const keysToDelete = new Set();
          const targetIds = new Set([strId]);

          // Primera pasada: identificar alias asociados
          Object.keys(reg).forEach(k => {
            const entry = reg[k];
            if (!entry) return;
            const entryId = String(entry.id || entry.data?.id || entry.pendingOperation?.payload?.id || entry.payload?.id || '');
            if (targetIds.has(entryId) || targetIds.has(k)) {
              keysToDelete.add(k);
              const locId = String(entry.localId || entry.data?.localId || entry.pendingOperation?.payload?.localId || entry.payload?.localId || '');
              if (locId) targetIds.add(locId);
              const reqK = String(entry.requestKey || entry.pendingOperation?.requestKey || entry.pendingOperation?.payload?.requestKey || '');
              if (reqK) targetIds.add(reqK);
            }
          });

          // Segunda pasada: limpiar todas las entradas que coincidan con cualquiera de los alias
          Object.keys(reg).forEach(k => {
            const entry = reg[k];
            if (!entry) return;
            const entryId = String(entry.id || entry.data?.id || entry.pendingOperation?.payload?.id || entry.payload?.id || '');
            const locId = String(entry.localId || entry.data?.localId || entry.pendingOperation?.payload?.localId || entry.payload?.localId || '');
            const reqK = String(entry.requestKey || entry.pendingOperation?.requestKey || entry.pendingOperation?.payload?.requestKey || '');
            if (targetIds.has(k) || (entryId && targetIds.has(entryId)) || (locId && targetIds.has(locId)) || (reqK && targetIds.has(reqK))) {
              keysToDelete.add(k);
            }
          });

          keysToDelete.forEach(k => delete reg[k]);
          try { localStorage.setItem(ACTIVITY_REGISTRY_KEY, JSON.stringify(reg)); } catch (e) {}
        }
      });

      window.dailyState.selectedIds.clear();
      if (typeof toast === 'function') toast('Actividades eliminadas correctamente.');
    } else {
      alert(`No fue posible eliminar: ${resp?.error || 'Error'}`);
    }
  } catch (e) {
    alert(`Error al eliminar actividades: ${e.message}`);
  } finally {
    if (typeof setLoading === 'function') setLoading(false);
    renderDailyActivitiesList();
  }
}
window.executeDeleteSelectedActivities = executeDeleteSelectedActivities;

// --------------------------------------------------------------------------
// 9. CALIFICACIÓN INDIVIDUAL (SEPARACIÓN DE FECHAS, PLAZO JUSTIFICADO Y REAPERTURA)
// --------------------------------------------------------------------------
let _isSavingGrading = false;

function isStudentEvaluationModified(currentEv, initialEv) {
  if (!currentEv) return false;
  if (!initialEv) {
    return Boolean(
      currentEv.desempeno || currentEv.trabajo || currentEv.fechaEntrega ||
      (currentEv.calificacionInstrumento !== undefined && currentEv.calificacionInstrumento !== '' && currentEv.calificacionInstrumento !== null) ||
      (currentEv.instrumentResults && Object.keys(currentEv.instrumentResults).length > 0) ||
      currentEv.conducta || currentEv.participacion || currentEv.observacionLibre ||
      currentEv.reabiertoMotivo || currentEv.fechaInicioPlazo || currentEv.fechaLimiteJustificada
    );
  }

  const fields = [
    'trabajo', 'desempeno', 'conducta', 'participacion', 'observacionLibre',
    'fechaEntrega', 'calificacionInstrumento', 'nivelInstrumento', 'areasOportunidad',
    'mensajeInstrumento', 'estadoEntrega', 'fechaInicioPlazo', 'fechaLimiteJustificada',
    'reabiertoMotivo', 'reabiertoEn', 'reabiertoFechaLimite'
  ];

  for (const f of fields) {
    const curVal = currentEv[f] === undefined || currentEv[f] === null ? '' : String(currentEv[f]).trim();
    const initVal = initialEv[f] === undefined || initialEv[f] === null ? '' : String(initialEv[f]).trim();
    if (curVal !== initVal) return true;
  }

  const curInst = currentEv.instrumentResults || {};
  const initInst = initialEv.instrumentResults || {};
  const curKeys = Object.keys(curInst);
  const initKeys = Object.keys(initInst);
  if (curKeys.length !== initKeys.length) return true;
  for (const k of curKeys) {
    if (String(curInst[k] || '') !== String(initInst[k] || '')) return true;
  }

  return false;
}
window.isStudentEvaluationModified = isStudentEvaluationModified;

async function openGradingView(classId) {
  window.dailyState.activeMode = 'grading';
  window.dailyState.gradingActivityId = String(classId);

  document.getElementById('dailyMainView')?.classList.add('hidden-control');
  document.getElementById('dailyCreateView')?.classList.add('hidden-control');
  document.getElementById('dailyEditBatchView')?.classList.add('hidden-control');
  const gradingView = document.getElementById('dailyGradingView');
  if (gradingView) gradingView.classList.remove('hidden-control');

  if (typeof setLoading === 'function') setLoading(true, 'Cargando datos de la actividad...');
  let classRecord = null;
  let evaluations = [];
  let instrumentResults = [];

  try {
    const data = await server('getClassRecord', classId);
    classRecord = data.classRecord;
    evaluations = data.evaluations || [];
    instrumentResults = data.instrumentResults || [];
  } catch (e) {
    console.warn('Error al consultar getClassRecord en backend:', e.message);
  }

  const instrumentResultsByStudent = {};
  (instrumentResults || []).forEach(r => {
    try {
      instrumentResultsByStudent[String(r.alumnoId)] = typeof r.resultadosJson === 'string' ? JSON.parse(r.resultadosJson) : (r.resultadosJson || {});
    } catch (e) {
      instrumentResultsByStudent[String(r.alumnoId)] = {};
    }
  });

  const gs = getGlobalState();
  if (!classRecord && gs.classes) {
    classRecord = gs.classes.find(c => String(c.id) === String(classId));
  }
  if (!classRecord) {
    if (typeof setLoading === 'function') setLoading(false);
    alert('No se encontró la actividad seleccionada.');
    return backToDailyActivitiesList();
  }

  window.dailyState.gradingActivity = classRecord;
  if (gs.classes) {
    const cIdx = gs.classes.findIndex(c => String(c.id) === String(classId));
    if (cIdx >= 0) {
      gs.classes[cIdx] = Object.assign({}, gs.classes[cIdx], classRecord);
    } else {
      gs.classes.push(classRecord);
    }
  }

  // Cargar asistencia de la FECHA DE LA ACTIVIDAD (nunca la fecha actual)
  let attExisting = {};
  let hasAttendance = false;
  try {
    attExisting = await loadAttendanceForDate(classRecord.fecha);
    hasAttendance = Boolean(attExisting && ((Array.isArray(attExisting) && attExisting.length > 0) || (typeof attExisting === 'object' && Object.keys(attExisting).length > 0)));
  } catch (e) {
    hasAttendance = false;
  }
  window.dailyState.gradingAttendanceMissing = !hasAttendance;

  const allStudents = gs.students || [];
  const evalMap = {};
  evaluations.forEach(ev => { evalMap[String(ev.alumnoId)] = Object.assign({}, ev); });

  // Los campos de evaluación comienzan VACÍOS para alumnos sin captura previa
  allStudents.forEach(s => {
    const sid = String(s.id);
    if (!evalMap[sid]) {
      evalMap[sid] = {
        alumnoId: sid,
        trabajo: '',
        desempeno: '',
        conducta: '',
        participacion: '',
        observacionLibre: '',
        fechaEntrega: '',
        evaluadoEn: '',
        estadoEntrega: '',
        fechaInicioPlazo: '',
        fechaLimiteJustificada: '',
        reabiertoMotivo: '',
        reabiertoEn: '',
        instrumentResults: {}
      };
    }
  });

  window.dailyState.gradingEvaluations = evalMap;
  window.dailyState.initialGradingEvaluations = JSON.parse(JSON.stringify(evalMap));
  if (typeof setLoading === 'function') setLoading(false);

  // Renderizar cabecera de la actividad
  const titleEl = document.getElementById('gradingActivityTitle');
  const metaEl = document.getElementById('gradingActivityMeta');
  if (titleEl) titleEl.textContent = classRecord.actividad || 'Actividad sin título';
  if (metaEl) {
    const pdaLabel = classRecord.pdaTema ? ` · PDA: ${classRecord.pdaTema}` : '';
    const hIni = cleanClassHour(classRecord.horaInicio);
    const hFin = cleanClassHour(classRecord.horaFin);
    let horarioLabel = '';
    if (isValidClassHour(classRecord.horaInicio) && isValidClassHour(classRecord.horaFin) && hFin > hIni) {
      horarioLabel = ` · Horario: ${hIni} - ${hFin}`;
    } else {
      horarioLabel = ' · Horario: (Horario no disponible en el registro)';
    }
    metaEl.textContent = `Materia: ${classRecord.materia || 'General'} · Fecha de clase: ${classRecord.fecha || 'Sin fecha'}${horarioLabel}${pdaLabel}`;
  }

  renderGradingStudentsList(allStudents, classRecord, attExisting);
}
window.openGradingView = openGradingView;

function renderGradingStudentsList(students, classRecord, attExisting = {}) {
  const container = document.getElementById('gradingStudentsList');
  if (!container) return;

  const todayIso = getTodayIsoCancun();
  const evalMap = window.dailyState.gradingEvaluations;
  const activeStudents = (students || []).filter(s => s.activo !== false);

  const btnSaveTop = document.getElementById('btnSaveGradingTop');
  const btnSaveBottom = document.getElementById('btnSaveGradingBottom');

  // Si la asistencia no está registrada o no pudo consultarse, se informa y se bloquea la evaluación ordinaria
  if (window.dailyState.gradingAttendanceMissing) {
    if (btnSaveTop) btnSaveTop.disabled = true;
    if (btnSaveBottom) btnSaveBottom.disabled = true;
    const countersBar = document.getElementById('gradingCountersBar');
    if (countersBar) {
      countersBar.innerHTML = `<span class="badge badge-danger" style="font-size:0.85rem;">Asistencia no registrada</span>`;
    }

    container.innerHTML = `
      <div class="panel" style="padding:22px;background:#fffbeb;border:2px solid #f59e0b;border-radius:10px;text-align:center;">
        <div style="font-size:2.4rem;margin-bottom:8px;">⚠️</div>
        <h3 style="color:#b45309;margin:0 0 8px 0;">Asistencia no registrada para el día ${escapeHtml(classRecord.fecha || 'de la actividad')}</h3>
        <p style="color:#92400e;max-width:620px;margin:0 auto 16px auto;font-size:0.95rem;line-height:1.5;">
          No es posible calificar esta actividad porque la asistencia de la fecha <strong>${escapeHtml(classRecord.fecha || '')}</strong> no ha sido registrada o no pudo consultarse en el Pase de lista.<br>
          Conforme a las reglas del sistema, <strong>no se utiliza la lista completa del grupo como reemplazo</strong>. Por favor, acude al Pase de lista para registrar la asistencia correspondiente antes de calificar a los alumnos asistentes.
        </p>
        <button type="button" class="btn primary" onclick="showView('attendance')">Ir al Pase de lista</button>
      </div>
    `;
    return;
  }

  if (btnSaveTop) btnSaveTop.disabled = false;
  if (btnSaveBottom) btnSaveBottom.disabled = false;

  const gs = getGlobalState();
  const allInstruments = gs.instruments || (window.state && window.state.instruments) || [];
  const currentInstrument = classRecord.instrumentoId ? allInstruments.find(i => String(i.id) === String(classRecord.instrumentoId)) : null;

  const getStatus = (sId) => {
    if (Array.isArray(attExisting)) {
      const found = attExisting.find(x => String(x.studentId) === String(sId));
      return String(found?.status || '').toUpperCase();
    }
    const item = attExisting[sId] || attExisting[String(sId)];
    return String(typeof item === 'object' ? item?.status : item || '').toUpperCase();
  };

  // Clasificación estricta de alumnos conforme a asistencia:
  // - A / R: Lista ordinaria de calificación
  // - J: Apartado de Entregas por falta justificada
  // - F: Ausentes injustificados (no evaluables)
  const presentStudents = activeStudents.filter(s => getStatus(s.id) === 'A' || getStatus(s.id) === 'R');
  const justifiedStudents = activeStudents.filter(s => getStatus(s.id) === 'J');
  const absentStudents = activeStudents.filter(s => getStatus(s.id) === 'F');

  const attendedCount = activeStudents.filter(s => getStatus(s.id) === 'A').length;
  const tardyCount = activeStudents.filter(s => getStatus(s.id) === 'R').length;

  // Conteo de calificación ordinaria progresiva
  const gradedCount = presentStudents.filter(s => {
    const ev = evalMap[String(s.id)];
    if (!ev) return false;
    const hasInst = ev.instrumentResults && Object.keys(ev.instrumentResults).length > 0;
    return Boolean(ev.trabajo || ev.desempeno || ev.conducta || ev.participacion || hasInst);
  }).length;

  const countersBar = document.getElementById('gradingCountersBar');
  if (countersBar) {
    const isComplete = presentStudents.length > 0 && gradedCount === presentStudents.length;
    countersBar.innerHTML = `
      <span class="badge ${isComplete ? 'badge-success' : 'badge-warning'}" style="font-size:0.85rem;">
        ${isComplete ? '✓ Actividad calificada' : `Calificación ordinaria: ${gradedCount} de ${presentStudents.length} evaluados`}
      </span>
      <span class="badge badge-neutral" style="font-size:0.85rem;">
        👥 Asistieron: ${presentStudents.length} (${attendedCount} presentes, ${tardyCount} con retardo)
      </span>
      <span class="badge badge-neutral" style="font-size:0.85rem;">
        Faltas: ${absentStudents.length} injustificadas · ${justifiedStudents.length} justificadas
      </span>
    `;
  }

  // Selector explícito de Instrumento de evaluación opcional
  const hasInstrument = Boolean(classRecord.instrumentoId);
  const instrumentToggleHtml = `
    <section class="panel" style="margin-bottom:16px;padding:12px 16px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
        <label style="font-weight:700;font-size:0.9rem;display:flex;align-items:center;gap:8px;color:#0b315d;margin:0;cursor:pointer;">
          <input type="checkbox" id="toggleUseInstrument" ${hasInstrument ? 'checked' : ''} style="width:16px;height:16px;">
          <span>Evaluar con Instrumento de evaluación curricular</span>
        </label>
        <div id="wrapInstrumentSelect" class="${hasInstrument ? '' : 'hidden-control'}" style="flex:1;max-width:450px;">
          <select id="selectGradingInstrument" class="input" style="font-size:0.85rem;">
            <option value="">-- Sin instrumento (evaluación sencilla) --</option>
            ${allInstruments.map(i => `<option value="${escapeHtml(i.id)}" ${String(classRecord.instrumentoId) === String(i.id) ? 'selected' : ''}>${escapeHtml(i.titulo || i.nombre || i.id)} (${escapeHtml(i.tipo || 'RÚBRICA')})</option>`).join('')}
          </select>
        </div>
      </div>
      <div style="font-size:0.8rem;color:#64748b;margin-top:6px;">
        ${hasInstrument ? 'Los criterios del instrumento comenzarán vacíos para alumnos sin captura previa. Solo se calculan notas cuando todos los criterios estén completos.' : 'Modo sencillo activo: se evalúa entrega, desempeño docente, conducta y participación.'}
      </div>
    </section>
  `;

  // 1. LISTA ORDINARIA: ÚNICAMENTE alumnos con estado A o R
  let ordinaryListHtml = '';
  if (!presentStudents.length) {
    ordinaryListHtml = `
      <div class="panel" style="padding:16px;background:#f1f5f9;border-radius:8px;margin-bottom:16px;text-align:center;color:#475569;">
        No hubo alumnos con asistencia o retardo registrados en esta fecha.
      </div>
    `;
  } else {
    ordinaryListHtml = presentStudents.map((s, index) => {
      const sid = String(s.id);
      const ev = evalMap[sid] || {};
      const attStatus = getStatus(s.id);

      // Instrumento de evaluación si está activo
      let instrumentHtml = '';
      if (currentInstrument) {
        const results = ev.instrumentResults || {};
        const tipo = currentInstrument.tipo || 'RUBRICA';
        if (tipo === 'EXAMEN') {
          const gradeVal = results.__grade !== undefined ? results.__grade : (ev.calificacionInstrumento !== undefined ? ev.calificacionInstrumento : '');
          instrumentHtml = `
            <div style="margin-top:10px;padding:10px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;">
              <div style="font-weight:600;font-size:0.9rem;color:#166534;margin-bottom:6px;">
                📝 Examen: ${escapeHtml(currentInstrument.titulo || currentInstrument.nombre || 'Evaluación')}
              </div>
              <label style="font-size:0.85rem;color:#166534;">Calificación obtenida (0 a 10):
                <input type="number" step="0.1" min="0" max="10" class="grading-field instrument-criterion-field" data-student="${sid}" data-criterion="__grade" value="${gradeVal !== '' ? gradeVal : ''}" placeholder="Pendiente de calificar" style="width:160px;margin-left:8px;">
              </label>
              ${gradeVal !== '' ? `<span class="badge" style="margin-left:10px;background:#166534;color:#fff;">Nota: ${gradeVal}</span>` : '<span class="badge badge-neutral" style="margin-left:10px;">Pendiente</span>'}
            </div>
          `;
        } else {
          const criterios = currentInstrument.criterios || [];
          const niveles = currentInstrument.niveles || [
            { code: 'NE', label: 'Nivel esperado' },
            { code: 'EN', label: 'En desarrollo' },
            { code: 'RA', label: 'Requiere apoyo' }
          ];

          const answeredCriteriaCount = criterios.filter(c => results[c.id] && String(results[c.id]).trim() !== '').length;
          const isCriteriaComplete = criterios.length > 0 && answeredCriteriaCount === criterios.length;

          const critRows = criterios.map(c => {
            const sel = results[c.id] || '';
            return `
              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;gap:10px;flex-wrap:wrap;">
                <span style="font-size:0.85rem;color:#1e293b;flex:1;min-width:200px;">${escapeHtml(c.texto || c.nombre || c.id)}:</span>
                <select class="grading-field instrument-criterion-field" data-student="${sid}" data-criterion="${escapeHtml(c.id)}" style="font-size:0.85rem;padding:3px 6px;">
                  <option value="" ${!sel ? 'selected' : ''}>-- Sin calificar --</option>
                  ${niveles.map(n => `<option value="${escapeHtml(n.code)}" ${sel === n.code ? 'selected' : ''}>${escapeHtml(n.code)}: ${escapeHtml(n.label || n.etiqueta || n.code)}</option>`).join('')}
                </select>
              </div>
            `;
          }).join('');

          let badgeInst = '';
          if (isCriteriaComplete && ev.calificacionInstrumento !== undefined && ev.calificacionInstrumento !== '') {
            badgeInst = `<span class="badge" style="background:#166534;color:#fff;font-size:0.8rem;">Nota: ${ev.calificacionInstrumento} (${escapeHtml(ev.nivelInstrumento || '')})</span>`;
          } else if (answeredCriteriaCount > 0) {
            badgeInst = `<span class="badge badge-warning" style="font-size:0.8rem;">⚠️ Criterios pendientes (${answeredCriteriaCount} de ${criterios.length})</span>`;
          } else {
            badgeInst = `<span class="badge badge-neutral" style="font-size:0.8rem;">Sin calificar</span>`;
          }

          instrumentHtml = `
            <div style="margin-top:10px;padding:10px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <div style="font-weight:600;font-size:0.9rem;color:#166534;">
                  📋 ${escapeHtml(currentInstrument.titulo || currentInstrument.nombre || 'Instrumento de evaluación')}
                </div>
                ${badgeInst}
              </div>
              <div style="margin-top:6px;">${critRows}</div>
              ${ev.mensajeInstrumento ? `<div style="margin-top:6px;font-size:0.8rem;color:#15803d;"><em>${escapeHtml(ev.mensajeInstrumento)}</em></div>` : ''}
            </div>
          `;
        }
      }

      // Para alumnos sin evaluación previa, la fecha de entrega comienza VACÍA (sin fechas inventadas ni supuestas)
      const defaultEntrega = ev.fechaEntrega || '';

      return `
        <article class="panel grading-student-card" data-student="${sid}" style="margin-bottom:14px;padding:14px 18px;border-left:4px solid #0284c7;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;margin-bottom:8px;">
            <div style="font-size:1.05rem;font-weight:700;color:#0b315d;">
              <span>${index + 1}. </span>${escapeHtml(s.name || s.nombreCompleto || s.nombre || sid)}
            </div>
            <div>
              <span class="badge badge-neutral" style="font-size:0.75rem;">Asistencia: ${attStatus === 'A' ? 'A (Presente)' : 'R (Retardo)'}</span>
            </div>
          </div>

          ${instrumentHtml}

          <div class="form-grid" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:10px;margin-top:10px;">
            <label>Entrega / Trabajo
              <select class="grading-field" data-student="${sid}" data-field="trabajo">
                <option value="" ${!ev.trabajo ? 'selected' : ''}>-- Sin registrar --</option>
                <option value="Completo" ${ev.trabajo === 'Completo' ? 'selected' : ''}>Entregada</option>
                <option value="Incompleto" ${ev.trabajo === 'Incompleto' ? 'selected' : ''}>Incompleta</option>
                <option value="No trabajó" ${ev.trabajo === 'No trabajó' ? 'selected' : ''}>No entregó</option>
                <option value="Entregada tarde" ${ev.trabajo === 'Entregada tarde' ? 'selected' : ''}>Entregada tarde</option>
                <option value="Pendiente" ${ev.trabajo === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
              </select>
            </label>

            <label>Fecha de entrega (Alumno)
              <input type="date" class="grading-field" data-student="${sid}" data-field="fechaEntrega" value="${defaultEntrega}">
            </label>

            <label>Desempeño docente
              <input type="text" class="grading-field" data-student="${sid}" data-field="desempeno" value="${escapeHtml(ev.desempeno || '')}" placeholder="Logrado, En proceso...">
            </label>

            <label>Conducta
              <select class="grading-field" data-student="${sid}" data-field="conducta">
                <option value="" ${!ev.conducta ? 'selected' : ''}>-- Sin registrar --</option>
                <option value="Excelente" ${ev.conducta === 'Excelente' ? 'selected' : ''}>Excelente</option>
                <option value="Adecuada" ${ev.conducta === 'Adecuada' ? 'selected' : ''}>Adecuada</option>
                <option value="Requiere apoyo" ${ev.conducta === 'Requiere apoyo' ? 'selected' : ''}>Requiere apoyo</option>
              </select>
            </label>

            <label>Participación
              <select class="grading-field" data-student="${sid}" data-field="participacion">
                <option value="" ${!ev.participacion ? 'selected' : ''}>-- Sin registrar --</option>
                <option value="Alta" ${ev.participacion === 'Alta' ? 'selected' : ''}>Alta</option>
                <option value="Media" ${ev.participacion === 'Media' ? 'selected' : ''}>Media</option>
                <option value="Nula" ${ev.participacion === 'Nula' ? 'selected' : ''}>Nula</option>
              </select>
            </label>
          </div>

          <div style="margin-top:8px;">
            <label style="display:block;font-size:0.85rem;color:#475569;">Observaciones
              <input type="text" class="grading-field" data-student="${sid}" data-field="observacionLibre" value="${escapeHtml(ev.observacionLibre || '')}" placeholder="Opcional" style="width:100%;">
            </label>
          </div>
        </article>
      `;
    }).join('');
  }

  // 2. APARTADO SEPARADO: ENTREGAS POR FALTA JUSTIFICADA (alumnos con J)
  let justifiedSectionHtml = '';
  if (justifiedStudents.length > 0) {
    const justifiedCards = justifiedStudents.map((s, idx) => {
      const sid = String(s.id);
      const ev = evalMap[sid] || {};
      const isReopened = Boolean(String(ev.reabiertoMotivo || '').trim());

      // Buscar reincorporación sugerida en historial de asistencia
      const reincorporacionSugerida = ev.fechaInicioPlazo || findReincorporationDateFromHistory(sid, classRecord.fecha);
      const limitePlazo = ev.fechaLimiteJustificada || (reincorporacionSugerida ? calcularFechaLimiteJustificada(reincorporacionSugerida, 5) : '');

      const justState = evaluarEstadoJustificada(Object.assign({}, ev, {
        fechaInicioPlazo: reincorporacionSugerida,
        fechaLimiteJustificada: limitePlazo
      }), todayIso);

      const isDeadlineExpired = justState.vencido && !isReopened;
      const disabledAttr = isDeadlineExpired ? 'disabled' : '';

      return `
        <article class="panel grading-justified-card" data-student="${sid}" style="margin-bottom:14px;padding:14px 18px;border-left:4px solid #eab308;background:#fffdfa;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px;">
            <div style="font-size:1.05rem;font-weight:700;color:#713f12;">
              <span>${idx + 1}. </span>${escapeHtml(s.name || s.nombreCompleto || sid)}
            </div>
            <div>
              <span class="badge ${justState.cssClass}" style="font-size:0.8rem;">${justState.estado}</span>
              ${justState.faltaReincorporacion ? '<span style="font-size:0.8rem;color:#b45309;margin-left:8px;">(Pendiente de confirmación de regreso a clases)</span>' : ''}
            </div>
          </div>

          <div style="margin:10px 0;padding:10px 14px;background:#fefce8;border:1px solid #fde047;border-radius:6px;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
              <span style="font-size:0.85rem;color:#713f12;">
                Ausencia justificada registrada en Pase de lista. Plazo acordado: <strong>5 días hábiles</strong> a partir del día siguiente de clase.
              </span>
              ${isDeadlineExpired ? `
                <button type="button" class="btn danger small" onclick="promptReopenJustifiedDeadline('${sid}')">
                  🔓 Reapertura de plazo
                </button>
              ` : ''}
            </div>

            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:12px;margin-top:8px;">
              <label style="font-size:0.8rem;color:#713f12;">Fecha de reincorporación (Regreso a clase):
                <input type="date" class="grading-field just-start-date" data-student="${sid}" data-field="fechaInicioPlazo" value="${reincorporacionSugerida}" style="width:100%;font-size:0.85rem;">
              </label>
              <label style="font-size:0.8rem;color:#713f12;">Fecha límite autorizada (inclusiva):
                <input type="date" class="grading-field just-limit-date" data-student="${sid}" data-field="fechaLimiteJustificada" value="${limitePlazo}" style="width:100%;font-size:0.85rem;">
              </label>
            </div>

            ${isReopened ? `
              <div style="margin-top:8px;font-size:0.8rem;color:#0369a1;background:#e0f2fe;padding:6px 10px;border-radius:4px;">
                🔓 <strong>Reapertura autorizada:</strong> ${escapeHtml(ev.reabiertoMotivo)} ${ev.reabiertoEn ? `(${ev.reabiertoEn.slice(0, 10)})` : ''} · <em>Nueva fecha límite: ${escapeHtml(ev.reabiertoFechaLimite || '')}</em>
              </div>
            ` : ''}
          </div>

          <div class="form-grid" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:10px;margin-top:10px;">
            <label>Entrega autorizada
              <select class="grading-field" data-student="${sid}" data-field="trabajo" ${disabledAttr}>
                <option value="" ${!ev.trabajo ? 'selected' : ''}>-- Sin entrega registrada --</option>
                <option value="Completo" ${ev.trabajo === 'Completo' ? 'selected' : ''}>Entregada dentro del plazo</option>
                <option value="Incompleto" ${ev.trabajo === 'Incompleto' ? 'selected' : ''}>Incompleta</option>
                <option value="No trabajó" ${ev.trabajo === 'No trabajó' ? 'selected' : ''}>No entregó</option>
                <option value="Pendiente" ${ev.trabajo === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
              </select>
            </label>

            <label>Fecha de entrega recibida
              <input type="date" class="grading-field" data-student="${sid}" data-field="fechaEntrega" value="${ev.fechaEntrega || ''}" ${disabledAttr}>
            </label>

            <label>Desempeño docente
              <input type="text" class="grading-field" data-student="${sid}" data-field="desempeno" value="${escapeHtml(ev.desempeno || '')}" placeholder="Logrado, Requiere apoyo..." ${disabledAttr}>
            </label>

            <label>Conducta
              <select class="grading-field" data-student="${sid}" data-field="conducta" ${disabledAttr}>
                <option value="" ${!ev.conducta ? 'selected' : ''}>-- Sin registrar --</option>
                <option value="Excelente" ${ev.conducta === 'Excelente' ? 'selected' : ''}>Excelente</option>
                <option value="Adecuada" ${ev.conducta === 'Adecuada' ? 'selected' : ''}>Adecuada</option>
                <option value="Requiere apoyo" ${ev.conducta === 'Requiere apoyo' ? 'selected' : ''}>Requiere apoyo</option>
              </select>
            </label>

            <label>Participación
              <select class="grading-field" data-student="${sid}" data-field="participacion" ${disabledAttr}>
                <option value="" ${!ev.participacion ? 'selected' : ''}>-- Sin registrar --</option>
                <option value="Alta" ${ev.participacion === 'Alta' ? 'selected' : ''}>Alta</option>
                <option value="Media" ${ev.participacion === 'Media' ? 'selected' : ''}>Media</option>
                <option value="Nula" ${ev.participacion === 'Nula' ? 'selected' : ''}>Nula</option>
              </select>
            </label>
          </div>

          <div style="margin-top:8px;">
            <label style="display:block;font-size:0.85rem;color:#475569;">Observaciones de justificación
              <input type="text" class="grading-field" data-student="${sid}" data-field="observacionLibre" value="${escapeHtml(ev.observacionLibre || '')}" placeholder="Detalles de justificación u entrega especial" style="width:100%;" ${disabledAttr}>
            </label>
          </div>
        </article>
      `;
    }).join('');

    justifiedSectionHtml = `
      <section class="justified-deliveries-section" style="margin-top:24px;border-top:2px dashed #fde047;padding-top:16px;">
        <h3 style="color:#854d0e;margin:0 0 12px 0;display:flex;align-items:center;gap:8px;">
          <span>📋 Entregas por falta justificada</span>
          <span class="badge badge-warning" style="font-size:0.85rem;">${justifiedStudents.length} alumno(s) con estado J</span>
        </h3>
        ${justifiedCards}
      </section>
    `;
  }

  // 3. NOTA INFORMATIVA: ALUMNOS CON FALTA INJUSTIFICADA (F)
  const absentSectionHtml = `
    <aside class="unexcused-absences-notice" style="margin-top:20px;padding:12px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:0.85rem;color:#475569;">
      ℹ️ <strong>Alumnos con falta injustificada (${absentStudents.length}):</strong> ${absentStudents.map(s => escapeHtml(s.name || s.nombreCompleto || s.nombre || s.id)).join(', ') || 'Ninguno'}.<br>
      <em>Conforme a la normativa académica, los alumnos con falta injustificada no aparecen en la lista ordinaria y no son evaluables para esta fecha.</em>
    </aside>
  `;

  container.innerHTML = `
    ${instrumentToggleHtml}
    <section>
      <h3 style="color:#0b315d;margin:0 0 12px 0;display:flex;align-items:center;gap:8px;">
        <span>📝 Evaluación ordinaria</span>
        <span class="badge badge-neutral" style="font-size:0.85rem;">${presentStudents.length} alumnos asistentes</span>
      </h3>
      ${ordinaryListHtml}
    </section>
    ${justifiedSectionHtml}
    ${absentSectionHtml}
  `;

  // Listeners de campos de calificación
  container.querySelectorAll('.grading-field').forEach(input => {
    input.addEventListener('change', e => {
      const sid = e.target.dataset.student;
      const field = e.target.dataset.field;
      if (field && evalMap[sid]) {
        evalMap[sid][field] = e.target.value;
        if (field === 'fechaInicioPlazo') {
          const limitInput = container.querySelector(`.just-limit-date[data-student="${sid}"]`);
          if (limitInput && !evalMap[sid].fechaLimiteJustificada) {
            const calculatedLimit = calcularFechaLimiteJustificada(e.target.value, 5);
            limitInput.value = calculatedLimit;
            evalMap[sid].fechaLimiteJustificada = calculatedLimit;
          }
        }
      }
    });
  });

  // Listeners de criterios de instrumento
  container.querySelectorAll('.instrument-criterion-field').forEach(input => {
    input.addEventListener('change', e => {
      const sid = e.target.dataset.student;
      const crit = e.target.dataset.criterion;
      if (sid && crit && evalMap[sid]) {
        evalMap[sid].instrumentResults = evalMap[sid].instrumentResults || {};
        if (e.target.value === '') {
          delete evalMap[sid].instrumentResults[crit];
        } else {
          evalMap[sid].instrumentResults[crit] = e.target.value;
        }
      }
    });
  });

  // Listener para el toggle de Instrumento
  const toggleInst = document.getElementById('toggleUseInstrument');
  const selectInst = document.getElementById('selectGradingInstrument');
  toggleInst?.addEventListener('change', e => {
    const wrap = document.getElementById('wrapInstrumentSelect');
    if (wrap) wrap.classList.toggle('hidden-control', !e.target.checked);
    if (!e.target.checked) {
      classRecord.instrumentoId = '';
      classRecord.instrumentoTipo = 'SIMPLE';
      renderGradingStudentsList(students, classRecord, attExisting);
    }
  });

  selectInst?.addEventListener('change', e => {
    classRecord.instrumentoId = e.target.value;
    classRecord.instrumentoTipo = e.target.value ? 'INSTRUMENTO' : 'SIMPLE';
    renderGradingStudentsList(students, classRecord, attExisting);
  });

  // Botones de atajo rápido: aplican ÚNICAMENTE a alumnos de la lista ordinaria (presentes A/R)
  document.getElementById('btnGradingAllComplete')?.addEventListener('click', () => {
    presentStudents.forEach(s => {
      const sid = String(s.id);
      if (evalMap[sid]) {
        evalMap[sid].trabajo = 'Completo';
        evalMap[sid].fechaEntrega = evalMap[sid].fechaEntrega || classRecord.fecha || getTodayIsoCancun();
      }
    });
    renderGradingStudentsList(students, classRecord, attExisting);
  });

  document.getElementById('btnGradingAllAdequate')?.addEventListener('click', () => {
    presentStudents.forEach(s => {
      const sid = String(s.id);
      if (evalMap[sid]) {
        evalMap[sid].conducta = 'Adecuada';
        evalMap[sid].participacion = 'Media';
      }
    });
    renderGradingStudentsList(students, classRecord, attExisting);
  });
}
window.renderGradingStudentsList = renderGradingStudentsList;

// DEFECTO 5: REFERENCIA claseId: classId CORREGIDA + PERSISTENCIA Y REGRESO
async function saveGradingActivity() {
  if (_isSavingGrading) return;
  _isSavingGrading = true;

  const classId = window.dailyState.gradingActivityId;
  if (!classId) {
    _isSavingGrading = false;
    return;
  }

  const gs = getGlobalState();
  const allClases = gs.classes || gs.activities || window.dailyState.activities || [];
  const classRecord = window.dailyState.gradingActivity || allClases.find(c => String(c.id) === String(classId)) || { id: classId };

  // VALIDACIÓN ESTRICTA DE HORARIO: No inventar horas desconocidas ni sustituir con 13:00 / 14:00
  const rawHIni = classRecord.horaInicio;
  const rawHFin = classRecord.horaFin;
  const hIni = cleanClassHour(rawHIni);
  const hFin = cleanClassHour(rawHFin);
  const isScheduleValid = isValidClassHour(rawHIni) && isValidClassHour(rawHFin) && hFin > hIni;

  if (!isScheduleValid) {
    _isSavingGrading = false;
    if (typeof setLoading === 'function') setLoading(false);
    const msg = 'No es posible guardar las calificaciones porque el horario de la actividad no es válido o no está disponible en el registro. Por favor, edita la actividad para registrar un horario válido (HH:mm) antes de calificar.';
    if (typeof toast === 'function') toast(msg, true);
    if (typeof alert === 'function') alert(msg);
    return;
  }

  const evalMap = window.dailyState.gradingEvaluations || {};
  const initMap = window.dailyState.initialGradingEvaluations || {};
  const evaluationsList = Object.values(evalMap);

  // Mapear evaluaciones asegurando marca temporal evaluadoEn para calificaciones asignadas
  const timestamp = new Date().toISOString();
  const attExisting = getAttendanceMapForDate(classRecord.fecha);

  // Filtrar ÚNICAMENTE alumnos que fueron modificados o capturados respecto al estado inicial
  const rows = evaluationsList.filter(ev => {
    const sid = String(ev.alumnoId);
    return isStudentEvaluationModified(ev, initMap[sid]);
  }).map(ev => {
    const hasInstrumentAnswers = ev.instrumentResults && Object.keys(ev.instrumentResults).length > 0;
    return Object.assign({}, ev, {
      claseId: classId,
      evaluadoEn: ev.evaluadoEn || (ev.desempeno || hasInstrumentAnswers ? timestamp : '')
    });
  });

  // Clave estable
  let existingOp = null;
  if (typeof findInActivityRegistry === 'function') {
    const regEntry = findInActivityRegistry({ id: String(classId) });
    if (regEntry && regEntry.pendingOperation && (regEntry.pendingOperation.status === 'uncertain' || regEntry.pendingOperation.status === 'in_flight')) {
      existingOp = regEntry.pendingOperation;
    }
  }

  const requestKey = existingOp ? existingOp.requestKey : `REQ-GRADE-${classId}-${Date.now()}`;

  const payload = existingOp ? existingOp.payload : {
    id: classId,
    requestKey,
    protocolVersion: 'RD-03',
    fecha: classRecord.fecha || '',
    horaInicio: hIni,
    horaFin: hFin,
    materia: classRecord.materia || 'Lenguajes',
    pdaTema: classRecord.pdaTema || '',
    actividad: classRecord.actividad || 'Actividad',
    material: classRecord.material || 'Cuaderno',
    proyectoId: classRecord.proyectoId || '',
    tipoActividad: classRecord.tipoActividad || 'Clase',
    paginas: classRecord.paginas || '',
    instrucciones: classRecord.instrucciones || '',
    instrumentoId: classRecord.instrumentoId || '',
    instrumentoTipo: classRecord.instrumentoTipo || (classRecord.instrumentoId ? 'INSTRUMENTO' : 'SIMPLE'),
    evaluaciones: rows
  };
  window.dailyState.lastGradingPayload = payload;

  if (typeof setLoading === 'function') setLoading(true, 'Guardando calificaciones...');
  if (typeof saveActivityToRegistry === 'function') {
    saveActivityToRegistry(classId, {
      id: classId,
      data: payload,
      status: 'Guardando',
      pendingOperation: { requestKey, payload, status: 'in_flight' }
    });
  }

  try {
    const resp = await server('saveClassRecord', payload);
    if (resp && resp.ok) {
      if (typeof saveActivityToRegistry === 'function') {
        saveActivityToRegistry(classId, { status: 'Guardado', pendingOperation: null });
      }

      // Actualizar estado local: fusionar las evaluaciones que cambiaron sin borrar las existentes
      gs.evaluations = gs.evaluations || [];
      const updatedSids = new Set(rows.map(r => String(r.alumnoId)));
      gs.evaluations = gs.evaluations.filter(e => !(String(e.claseId) === String(classId) && updatedSids.has(String(e.alumnoId))));
      rows.forEach(r => gs.evaluations.push(r));

      // Actualizar el estado inicial para reflejar que los cambios actuales ya fueron guardados
      window.dailyState.initialGradingEvaluations = JSON.parse(JSON.stringify(window.dailyState.gradingEvaluations || {}));

      if (gs.classes) {
        const cIdx = gs.classes.findIndex(c => String(c.id) === String(classId));
        if (cIdx >= 0 && resp.activity) {
          gs.classes[cIdx] = resp.activity;
        }
      }

      if (typeof toast === 'function') toast('Calificaciones guardadas correctamente.');
      if (typeof setLoading === 'function') setLoading(false);
      _isSavingGrading = false;
      backToDailyActivitiesList();
    } else {
      if (typeof setLoading === 'function') setLoading(false);
      _isSavingGrading = false;
      alert(`No fue posible guardar las calificaciones: ${resp?.error || 'Error'}`);
    }
  } catch (e) {
    if (typeof setLoading === 'function') setLoading(false);
    _isSavingGrading = false;
    const isNetError = /interrumpió|conex|tardó|tiempo de espera/i.test(String(e.message || ''));
    if (isNetError && typeof saveActivityToRegistry === 'function') {
      saveActivityToRegistry(classId, {
        id: classId,
        data: payload,
        status: 'Pendiente de guardar',
        error: e.message,
        pendingOperation: { requestKey, payload, status: 'uncertain' }
      });
    } else if (typeof saveActivityToRegistry === 'function') {
      saveActivityToRegistry(classId, {
        id: classId,
        data: payload,
        status: 'Borrador',
        error: e.message,
        pendingOperation: { requestKey, payload, status: 'rejected' }
      });
    }
    alert(`Error al guardar calificaciones: ${e.message}`);
  }
}
window.saveGradingActivity = saveGradingActivity;

function promptReopenJustifiedDeadline(studentId) {
  const reason = prompt('Motivo obligatorio de reapertura de plazo excepcional:\n(Ej. Justificante médico complementario entregado por tutor)');
  if (reason === null) return;
  const trimmed = String(reason || '').trim();
  if (!trimmed) {
    return alert('El motivo de reapertura es obligatorio para autorizar la entrega fuera de plazo.');
  }

  const todayIso = getTodayIsoCancun();
  const defaultNewLimit = calcularFechaLimiteJustificada(todayIso);
  const newLimitPrompt = prompt('Nueva fecha límite autorizada (YYYY-MM-DD):\n(Se calcula a 5 días hábiles escolares a partir de hoy)', defaultNewLimit);
  if (newLimitPrompt === null) return;
  const newLimit = String(newLimitPrompt || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newLimit)) {
    return alert('Debes ingresar una fecha límite válida con formato YYYY-MM-DD.');
  }

  const evalMap = window.dailyState.gradingEvaluations || {};
  if (evalMap[studentId]) {
    evalMap[studentId].reabiertoMotivo = trimmed;
    evalMap[studentId].reabiertoEn = todayIso;
    evalMap[studentId].reabiertoFechaLimite = newLimit;
  }

  const gs = getGlobalState();
  const allClases = gs.classes || gs.activities || window.dailyState.activities || [];
  const classRecord = allClases.find(c => String(c.id) === String(window.dailyState.gradingActivityId)) || {};
  const attExisting = getAttendanceMapForDate(classRecord.fecha);

  renderGradingStudentsList(gs.students || [], classRecord, attExisting);
  if (typeof toast === 'function') {
    toast(`Reapertura autorizada hasta el ${newLimit}. Registra la entrega y pulsa Guardar.`);
  }
}
window.promptReopenJustifiedDeadline = promptReopenJustifiedDeadline;

// --------------------------------------------------------------------------
// 10. MODAL DE DESGLOSE DE ALUMNOS (SIN DUPLICADOS)
// --------------------------------------------------------------------------
function showStudentBreakdownModal(type, classId) {
  const modal = document.getElementById('modalDailyStudentBreakdown');
  const titleEl = document.getElementById('breakdownModalTitle');
  const listEl = document.getElementById('breakdownModalList');
  if (!modal || !listEl) return;

  const gs = getGlobalState();
  const allClases = gs.classes || gs.activities || window.dailyState.activities || [];
  const allEvals = gs.evaluations || [];
  const allStudents = gs.students || [];

  const act = allClases.find(c => String(c.id) === String(classId));
  if (!act) return;

  const attExisting = getAttendanceMapForDate(act.fecha);
  const metrics = computeActivityMetrics(act, allEvals, attExisting, allStudents);

  let targetStudents = [];
  let modalTitle = 'Desglose de alumnos';

  if (type === 'calificados') {
    modalTitle = `Alumnos calificados (${metrics.calificados})`;
    targetStudents = metrics.gradedStudents;
  } else if (type === 'sin-calificar') {
    modalTitle = `Alumnos sin calificar (${metrics.sinCalificar})`;
    targetStudents = metrics.ungradedStudents;
  } else if (type === 'ausentes') {
    modalTitle = `Alumnos ausentes (${metrics.ausentesTotal})`;
    targetStudents = metrics.absentStudents;
  } else if (type === 'pendientes-entrega') {
    modalTitle = `Pendientes de entrega (${metrics.pendientesEntrega})`;
    targetStudents = metrics.pendingDeliveryStudents;
  }

  if (titleEl) titleEl.textContent = `${modalTitle} · ${act.actividad || act.id}`;

  if (!targetStudents.length) {
    listEl.innerHTML = '<li style="color:#64748b;font-style:italic;">No hay alumnos en esta categoría.</li>';
  } else {
    // Alumnos únicos por ID para evitar duplicados
    const seen = new Set();
    const unique = [];
    targetStudents.forEach(s => {
      if (!seen.has(String(s.id))) {
        seen.add(String(s.id));
        unique.push(s);
      }
    });

    listEl.innerHTML = unique.map((s, idx) => {
      return `
        <li style="padding:6px 0;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;">
          <span><strong>${idx + 1}.</strong> ${escapeHtml(s.name || s.nombreCompleto || s.id)}</span>
          <span style="color:#64748b;font-size:0.85rem;">ID: ${s.id}</span>
        </li>
      `;
    }).join('');
  }

  modal.classList.remove('hidden-control');
}
window.showStudentBreakdownModal = showStudentBreakdownModal;

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[m]);
}
window.escapeHtml = escapeHtml;

// --------------------------------------------------------------------------
// 11. REGISTRO DE ACCIONES DESACOPLADAS (REGLA 2 DE ARQUITECTURA)
// --------------------------------------------------------------------------
window.actions = window.actions || {};
window.actions['open-create-activities'] = () => openCreateActivitiesView();
window.actions['create-activity'] = () => openCreateActivitiesView();
window.actions['edit-selected-activities'] = () => openBatchEditView();
window.actions['delete-selected-activities'] = () => confirmDeleteSelectedActivities();
window.actions['open-batch-edit'] = () => openBatchEditView();
window.actions['confirm-delete-activities'] = () => confirmDeleteSelectedActivities();
window.actions['save-new-activities'] = () => saveNewActivitiesBatch();
window.actions['cancel-create-activities'] = () => backToDailyActivitiesList();
window.actions['add-create-activity'] = () => addAnotherCreateActivityCard();
window.actions['save-batch-edits'] = () => saveBatchEdits();
window.actions['back-from-batch-edits'] = () => handleBackFromBatchEdits();
window.actions['save-grading-activity'] = () => saveGradingActivity();
window.actions['back-from-grading'] = () => backToDailyActivitiesList();
window.actions['retry-load-daily'] = () => loadDailyActivities(true);

// Integración de apertura de vista diaria desde navigation.js
const prevOpenClassForm = window.openClassForm;
window.openClassForm = async function(projectId = '', classId = '', targetMode = '') {
  const form = document.getElementById('classForm');
  if (form && form.elements && form.elements.proyectoId) {
    form.elements.proyectoId.value = projectId || '';
  }
  if (typeof prevOpenClassForm === 'function') {
    await prevOpenClassForm(projectId, classId, targetMode);
  }
  if (classId) {
    // Si existe vista unificada, preparar gradingView
    if (document.getElementById('dailyGradingView')) {
      openGradingView(classId);
    }
    return;
  }
  if (projectId) {
    openCreateActivitiesView(projectId);
    return;
  }
  // Apertura general de Registro diario
  backToDailyActivitiesList();
  loadDailyActivities();
};

// Bindings de interfaz
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnOpenCreateActivities')?.addEventListener('click', () => openCreateActivitiesView());
  document.getElementById('btnCreateActivity')?.addEventListener('click', () => openCreateActivitiesView());
  document.getElementById('btnEditSelectedActivities')?.addEventListener('click', () => openBatchEditView());
  document.getElementById('btnDeleteSelectedActivities')?.addEventListener('click', () => confirmDeleteSelectedActivities());
  document.getElementById('selectAllActivities')?.addEventListener('change', e => toggleSelectAllActivities(e.target.checked));

  document.getElementById('btnAddAnotherCreateActivity')?.addEventListener('click', addAnotherCreateActivityCard);
  document.getElementById('btnAddCreateActivity')?.addEventListener('click', addAnotherCreateActivityCard);
  document.getElementById('btnSaveNewActivities')?.addEventListener('click', saveNewActivitiesBatch);
  document.getElementById('btnSaveNewActivitiesBottom')?.addEventListener('click', saveNewActivitiesBatch);
  document.getElementById('btnCancelCreateActivities')?.addEventListener('click', backToDailyActivitiesList);
  document.getElementById('btnCancelCreateActivitiesBottom')?.addEventListener('click', backToDailyActivitiesList);

  document.getElementById('btnSaveBatchEdits')?.addEventListener('click', saveBatchEdits);
  document.getElementById('btnSaveBatchEditsBottom')?.addEventListener('click', saveBatchEdits);
  document.getElementById('btnBackBatchEdits')?.addEventListener('click', handleBackFromBatchEdits);
  document.getElementById('btnBackBatchEditsBottom')?.addEventListener('click', handleBackFromBatchEdits);

  document.getElementById('btnSaveGradingTop')?.addEventListener('click', saveGradingActivity);
  document.getElementById('btnSaveGradingBottom')?.addEventListener('click', saveGradingActivity);
  document.getElementById('btnBackToMainFromGrading')?.addEventListener('click', backToDailyActivitiesList);
  document.getElementById('btnBackGradingBottom')?.addEventListener('click', backToDailyActivitiesList);

  document.getElementById('btnRetryLoadDailyActivities')?.addEventListener('click', () => loadDailyActivities(true));
  document.getElementById('btnRetryUpdateDailyActivities')?.addEventListener('click', () => loadDailyActivities(true));
  document.getElementById('btnConfirmDeleteActivities')?.addEventListener('click', () => executeDeleteSelectedActivities());
  document.getElementById('btnCancelDeleteActivities')?.addEventListener('click', () => {
    document.getElementById('modalConfirmDeleteActivities')?.classList.add('hidden-control');
  });

  document.getElementById('btnCloseBreakdownModal')?.addEventListener('click', () => {
    document.getElementById('modalDailyStudentBreakdown')?.classList.add('hidden-control');
  });

  document.getElementById('filterDailyDate')?.addEventListener('change', e => {
    window.dailyState.filterDate = e.target.value;
    loadDailyActivities(true);
  });
  document.getElementById('btnClearDailyFilter')?.addEventListener('click', () => {
    const f = document.getElementById('filterDailyDate');
    if (f) f.value = '';
    window.dailyState.filterDate = '';
    renderDailyActivitiesList();
  });

  document.getElementById('btnConfirmDiscardEdits')?.addEventListener('click', () => {
    document.getElementById('modalConfirmDiscardEdits')?.classList.add('hidden-control');
    backToDailyActivitiesList();
  });
  document.getElementById('btnCancelDiscardEdits')?.addEventListener('click', () => {
    document.getElementById('modalConfirmDiscardEdits')?.classList.add('hidden-control');
  });
});


function openDailyView() {
  window.dailyState = window.dailyState || {};
  window.dailyState.activeMode = 'list';
  document.getElementById('dailyCreateView')?.classList.add('hidden-control');
  document.getElementById('dailyEditBatchView')?.classList.add('hidden-control');
  document.getElementById('dailyGradingView')?.classList.add('hidden-control');
  document.getElementById('dailyMainView')?.classList.remove('hidden-control');
  loadDailyActivities();
}
window.openDailyView = openDailyView;

// Despachador de acciones (Regla 2 de Arquitectura)
window.actions = window.actions || {};
Object.assign(window.actions, {
  'go-daily': () => (window.openDailyView || openDailyView)(),
  'create-activity': () => (window.openCreateActivitiesView || openCreateActivitiesView)(),
  'cancel-create-activities': () => (window.backToDailyActivitiesList || backToDailyActivitiesList)(),
  'save-new-activities': () => (window.saveNewActivitiesBatch || saveNewActivitiesBatch)(),
  'edit-selected-activities': () => (window.openBatchEditView || openBatchEditView)(),
  'back-from-batch-edits': () => (window.handleBackFromBatchEdits || handleBackFromBatchEdits)(),
  'save-batch-edits': () => (window.saveBatchEdits || saveBatchEdits)(),
  'delete-selected-activities': () => (window.confirmDeleteSelectedActivities || confirmDeleteSelectedActivities)(),
  'retry-load-daily': () => (window.loadDailyActivities || loadDailyActivities)(true)
});
