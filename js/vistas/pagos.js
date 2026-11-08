/* ==========================================================================
   MÓDULO DE VISTA: CONTROL DE PAGOS Y LIBROS FINANCIEROS
   ========================================================================== */
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
async function createPaymentEvent(e){e.preventDefault();const form=e.currentTarget;if(form.dataset.saving==='1')return;const payload=formData(form);payload.requestKey=ensureRequestKey(form,'PAYEV');setFormSaving(form,true);const ok=await runAction(async()=>{const result=await server('createPaymentEvent',payload);$('#paymentEventFormPanel').classList.add('hidden-control');state.paymentsInitial=await server('getPaymentsInitialData');renderPaymentsHome();toast(result.message);await openPaymentEvent(result.eventId)});setFormSaving(form,false);if(ok)resetRequestKey(form)}
async function openPaymentEvent(eventId,force=false){
  const cached=paymentEventCache.get(String(eventId));
  if(cached&&!force){
    state.paymentDetail=cached;
    renderPaymentDetail();
    $('#paymentsHome').classList.add('hidden-control');
    $('#paymentEventDetail').classList.remove('hidden-control');
    window.scrollTo(0,0);
    server('getPaymentEventDetail',eventId).then(detail=>{
      paymentEventCache.set(String(eventId),detail);
      if(state.paymentDetail&&String(state.paymentDetail.event?.id)===String(eventId)){
        state.paymentDetail=detail;
        renderPaymentDetail();
      }
    }).catch(err=>console.warn('Revalidación en segundo plano:',err));
    return;
  }
  await runAction(async()=>{
    state.paymentDetail=await server('getPaymentEventDetail',eventId);
    paymentEventCache.set(String(eventId),state.paymentDetail);
    renderPaymentDetail();
    $('#paymentsHome').classList.add('hidden-control');
    $('#paymentEventDetail').classList.remove('hidden-control');
    window.scrollTo(0,0);
  });
}
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
async function saveStudentPayment(e){e.preventDefault();const form=e.currentTarget;if(form.dataset.saving==='1')return;const payload=formData(form);payload.eventId=state.paymentDetail.event.id;payload.requestKey=ensureRequestKey(form,'PAY');setFormSaving(form,true);const ok=await runAction(async()=>{const result=await server('saveStudentPayment',payload);state.paymentDetail=result.detail;paymentEventCache.set(String(payload.eventId),result.detail);$('#paymentDialog').close();renderPaymentDetail();toast(result.message)});setFormSaving(form,false);if(ok)resetRequestKey(form)}
async function savePaymentCut(e){e.preventDefault();const form=e.currentTarget;if(form.dataset.saving==='1')return;const payload=formData(form);payload.eventId=state.paymentDetail.event.id;if(!confirm(`¿Registrar un corte por ${paymentMoney(payload.amount)}?`))return;payload.requestKey=ensureRequestKey(form,'CUT');setFormSaving(form,true);const ok=await runAction(async()=>{const result=await server('savePaymentCut',payload);state.paymentDetail=result.detail;paymentEventCache.set(String(payload.eventId),result.detail);form.reset();renderPaymentDetail();toast(result.message)});setFormSaving(form,false);if(ok)resetRequestKey(form)}
async function savePaymentMovement(e){e.preventDefault();const form=e.currentTarget;if(form.dataset.saving==='1')return;const payload=formData(form);payload.eventId=state.paymentDetail.event.id;if(!confirm(`¿Registrar ${payload.type.toLowerCase()} por ${paymentMoney(payload.amount)}?`))return;payload.requestKey=ensureRequestKey(form,'MOV');setFormSaving(form,true);const ok=await runAction(async()=>{const result=await server('savePaymentMovement',payload);state.paymentDetail=result.detail;paymentEventCache.set(String(payload.eventId),result.detail);form.reset();renderPaymentDetail();toast(result.message)});setFormSaving(form,false);if(ok)resetRequestKey(form)}
function renderPaymentLedgers(){
  const detail=state.paymentDetail;const ledger=(rows,kind)=>rows.length?rows.slice().reverse().map(item=>`<div class="payment-ledger-row"><div><strong>${kind==='cut'?'Corte':item.type==='RETIRO'?'Retiro':'Reposición'}</strong><small>${escapeHtml(formatDateShort(item.date))}${item.description?' · '+escapeHtml(item.description):''}</small></div><b>${paymentMoney(item.amount)}</b></div>`).join(''):'<p class="muted">Sin movimientos.</p>';
  $('#paymentCutsList').innerHTML=ledger(detail.cuts,'cut');$('#paymentMovementsList').innerHTML=ledger(detail.movements,'movement');
  $('#paymentHistoryList').innerHTML=detail.payments.length?detail.payments.slice().reverse().map(item=>`<div class="payment-ledger-row"><div><strong>${escapeHtml(item.studentName)}</strong><small>${escapeHtml(item.type)} · ${escapeHtml(formatDateShort(item.date))}${item.note?' · '+escapeHtml(item.note):''}</small></div><b>${paymentMoney(item.amount)}</b></div>`).join(''):'<p class="muted">Todavía no hay pagos registrados.</p>';
}
function renderPaymentFinancial(){const s=state.paymentDetail.summary;const rows=[['Total esperado',s.expectedTotal],['Cobrado',s.collected],['Saldo por cobrar',s.outstanding],['Entrega esperada',s.expectedDelivery],['Margen esperado',s.expectedMargin],['Entrega acumulada',s.accruedDelivery],['Margen acumulado',s.accruedMargin],['Cortes entregados',s.cutsTotal],['Deuda por retiros',s.debt],['Efectivo disponible',s.cashAvailable]];$('#paymentFinancialSummary').innerHTML=rows.map(([label,value])=>`<div class="payment-money-box"><span>${escapeHtml(label)}</span><b>${paymentMoney(value)}</b></div>`).join('')}
