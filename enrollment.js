const ENROLLMENT_SESSION_KEY='carpeta_academica_enrollment_session_v1';
let enrollmentLinkToken='';
let enrollmentSessionToken=localStorage.getItem(ENROLLMENT_SESSION_KEY)||'';
let enrollmentDraftData=null;
let enrollmentCurrentStep=1;
let enrollmentAdminData=null;
let enrollmentAdminCurrent=null;

const ENROLLMENT_QUESTIONS=[
  'Muestra interés por aprender cosas nuevas.','Comprende con facilidad lo que lee.','Lee con seguridad y confianza.',
  'Expresa sus ideas con claridad al hablar.','Escribe con letra legible y ordenada.','Escribe respetando las reglas básicas de ortografía.',
  'Resuelve operaciones matemáticas acordes a su grado escolar.','Identifica cómo resolver un problema matemático.',
  'Utiliza correctamente las tablas de multiplicar.','Reconoce y continúa series numéricas.','Organiza y cuida sus útiles escolares.',
  'Cumple con tareas y responsabilidades escolares.','Mantiene la atención al realizar una actividad.',
  'Sigue instrucciones sin necesidad de repetirlas constantemente.','Realiza sus actividades de manera independiente.',
  'Participa y coopera en actividades con otros niños.','Mantiene una buena relación con otros niños.',
  'Respeta las reglas establecidas en casa y en la escuela.','Controla sus emociones ante diferentes situaciones.',
  'Reconoce cuando comete un error y procura corregirlo.','Dice la verdad cuando se le pregunta sobre una situación.',
  'Respeta las pertenencias de los demás.'
];

function enrollmentApi(name,...args){return apiRequest(name,args,enrollmentSessionToken)}
function enrollmentPanelsHide(){$$('#familyPortal main > section').forEach(panel=>panel.classList.add('hidden-control'))}

async function startEnrollmentPortal(token){
  enrollmentLinkToken=token;$('#app').classList.add('hidden-control');$('#familyPortal').classList.remove('hidden-control');setLoading(false);
  enrollmentPanelsHide();
  try{
    const info=await apiRequest('validateEnrollmentLink',[token],'');
    $('#familySchoolName').textContent=info.school||'Inscripción escolar';
    $('#enrollmentWelcomeSchool').textContent=[info.school,info.period.group,info.period.cycle].filter(Boolean).join(' · ');
    buildEnrollmentDynamicFields();
    if(enrollmentSessionToken){try{await loadEnrollmentDraft();return}catch(error){enrollmentSessionToken='';localStorage.removeItem(ENROLLMENT_SESSION_KEY)}}
    $('#enrollmentWelcomePanel').classList.remove('hidden-control');
    $('#enrollmentCreateAccountForm').classList.toggle('hidden-control',!info.open);
    familyMessage(info.open?'Crea una cuenta o continúa una inscripción guardada.':'El periodo está cerrado para cuentas nuevas. Si ya comenzaste, puedes continuar e imprimir.');
  }catch(error){familyMessage(error.message,true)}
}

function buildEnrollmentDynamicFields(){
  if(!$('#authorizedPeopleFields').children.length){
    $('#authorizedPeopleFields').innerHTML=[1,2,3].map(number=>`<fieldset class="authorized-person"><legend>Persona autorizada ${number}</legend><div class="form-grid three"><label>Nombre completo<input name="autorizado${number}Nombre" ${number===1?'required':''}></label><label>Parentesco<input name="autorizado${number}Parentesco" ${number===1?'required':''}></label><label>Teléfono<input name="autorizado${number}Telefono" inputmode="tel" ${number===1?'required':''}></label></div><div class="photo-upload-card compact"><label>Fotografía<input type="file" accept="image/*" data-enrollment-photo="autorizado${number}"></label><img data-enrollment-preview="autorizado${number}" alt="Vista previa"></div></fieldset>`).join('');
  }
  if(!$('#academicAssessmentFields').children.length){
    $('#academicAssessmentFields').innerHTML=ENROLLMENT_QUESTIONS.map((question,index)=>`<fieldset><legend>${escapeHtml(question)}</legend>${['Siempre','Casi siempre','Algunas veces','Nunca'].map(value=>`<label><input type="radio" name="valoracion${index+1}" value="${value}"> ${value}</label>`).join('')}</fieldset>`).join('');
  }
  $$('[data-enrollment-photo]').forEach(input=>{if(!input.dataset.bound){input.dataset.bound='1';input.addEventListener('change',handleEnrollmentPhoto)}});
}

document.addEventListener('DOMContentLoaded',()=>{
  $('#enrollmentCreateAccountForm')?.addEventListener('submit',createEnrollmentAccount);
  $('#enrollmentLoginForm')?.addEventListener('submit',loginEnrollmentAccount);
  $('#enrollmentPeriodForm')?.addEventListener('submit',createEnrollmentPeriod);
  $('#enrollmentAdminSearch')?.addEventListener('input',renderEnrollmentAdminList);
  Object.assign(actions,{
    'generate-all-family-access':generateAllFamilyAccess,
    'refresh-enrollment-admin':()=>loadEnrollmentAdmin(true),
    'toggle-enrollment-period-form':toggleEnrollmentPeriodForm,
    'copy-enrollment-link':button=>copyEnrollmentLink(button.dataset.url||''),
    'toggle-enrollment-period':button=>toggleEnrollmentPeriod(button.dataset.id,button.dataset.status),
    'open-enrollment-detail':button=>openEnrollmentAdminDetail(button.dataset.id),
    'check-enrollment-curp':checkEnrollmentCurp,
    'save-enrollment-draft':()=>saveEnrollmentDraft(false),
    'enrollment-prev':()=>changeEnrollmentStep(-1),
    'enrollment-next':()=>changeEnrollmentStep(1),
    'enrollment-logout':logoutEnrollment,
    'preview-enrollment-form':()=>printEnrollment(false),
    'submit-enrollment':submitEnrollment,
    'admin-print-enrollment':()=>printEnrollment(true),
    'admin-request-enrollment-correction':requestEnrollmentCorrection,
    'admin-approve-enrollment':approveEnrollment
  });
});

async function createEnrollmentAccount(event){
  event.preventDefault();const payload=formData(event.currentTarget);payload.periodToken=enrollmentLinkToken;setLoading(true);
  try{const result=await apiRequest('createEnrollmentAccount',[payload],'');enrollmentSessionToken=result.token;localStorage.setItem(ENROLLMENT_SESSION_KEY,enrollmentSessionToken);await loadEnrollmentDraft();familyMessage(result.message)}catch(error){familyMessage(error.message,true)}finally{setLoading(false)}
}
async function loginEnrollmentAccount(event){
  event.preventDefault();const data=formData(event.currentTarget);setLoading(true);
  try{const result=await apiRequest('enrollmentLogin',[data.email,data.password],'');enrollmentSessionToken=result.token;localStorage.setItem(ENROLLMENT_SESSION_KEY,enrollmentSessionToken);await loadEnrollmentDraft();familyMessage(result.message)}catch(error){familyMessage(error.message,true)}finally{setLoading(false)}
}
async function loadEnrollmentDraft(){
  enrollmentDraftData=await enrollmentApi('getEnrollmentDraft');enrollmentCurrentStep=Math.max(1,Math.min(8,Number(enrollmentDraftData.enrollment.currentStep||1)));
  enrollmentPanelsHide();$('#enrollmentWizardPanel').classList.remove('hidden-control');
  $('#enrollmentWizardMeta').textContent=[enrollmentDraftData.period.name,enrollmentDraftData.period.group,enrollmentDraftData.period.cycle].filter(Boolean).join(' · ');
  fillEnrollmentForm(enrollmentDraftData.enrollment.data||{});await loadEnrollmentPhotoPreviews();renderEnrollmentStep();
}

function fillEnrollmentForm(data){
  const form=$('#enrollmentWizardForm');Object.entries(data).forEach(([key,value])=>{
    const controls=form.elements[key];if(!controls)return;
    if(controls instanceof RadioNodeList){[...controls].forEach(control=>control.checked=String(control.value)===String(value))}
    else if(controls.type==='checkbox')controls.checked=Boolean(value)&&String(value)!=='false';else controls.value=value??'';
  });
  const account=enrollmentDraftData?.account||{};if(!form.elements.tutorTelefono.value)form.elements.tutorTelefono.value=account.phone||'';
  if(!form.elements.gradoGrupoNuevo.value)form.elements.gradoGrupoNuevo.value=enrollmentDraftData?.period?.group||'';
  if(!form.elements.cicloEscolarNuevo.value)form.elements.cicloEscolarNuevo.value=enrollmentDraftData?.period?.cycle||'';
}

function enrollmentFormObject(){
  const result={};new FormData($('#enrollmentWizardForm')).forEach((value,key)=>{if(!(value instanceof File))result[key]=value});return result;
}
function renderEnrollmentStep(){
  $$('.enrollment-step').forEach(section=>section.classList.toggle('hidden-control',Number(section.dataset.enrollmentStep)!==enrollmentCurrentStep));
  const percent=enrollmentDraftData?.enrollment?.percentage||Math.round((enrollmentCurrentStep-1)*100/8);
  $('#enrollmentStepLabel').textContent=`Paso ${enrollmentCurrentStep} de 8`;$('#enrollmentPercentLabel').textContent=percent+'%';$('#enrollmentProgressBar').style.width=percent+'%';
  $('#enrollmentPrevButton').disabled=enrollmentCurrentStep===1;$('#enrollmentNextButton').classList.toggle('hidden-control',enrollmentCurrentStep===8);
  const titles=['CURP y datos del alumno','Domicilio y seguridad social','Datos escolares','Datos del tutor','Personas autorizadas','Familia y hogar','Salud y apoyos','Desempeño y revisión'];
  $('#enrollmentWizardTitle').textContent=titles[enrollmentCurrentStep-1];window.scrollTo({top:0,behavior:'smooth'});
}
async function changeEnrollmentStep(direction){
  if(direction>0){const section=$(`[data-enrollment-step="${enrollmentCurrentStep}"]`);const invalid=[...section.querySelectorAll('[required]')].find(control=>!control.checkValidity());if(invalid){invalid.reportValidity();return}}
  await saveEnrollmentDraft(true);enrollmentCurrentStep=Math.max(1,Math.min(8,enrollmentCurrentStep+direction));renderEnrollmentStep();
}
async function saveEnrollmentDraft(silent=false){
  setLoading(true);try{const result=await enrollmentApi('saveEnrollmentDraft',{data:enrollmentFormObject(),currentStep:enrollmentCurrentStep});enrollmentDraftData.enrollment=result.enrollment;if(!silent)familyMessage(result.message);renderEnrollmentStep();return true}catch(error){familyMessage(error.message,true);return false}finally{setLoading(false)}
}
async function checkEnrollmentCurp(){
  const input=$('#enrollmentWizardForm').elements.curp;if(!input.value.trim())return input.reportValidity();setLoading(true);
  try{const result=await enrollmentApi('checkEnrollmentCurp',input.value);const info=result.info,form=$('#enrollmentWizardForm');form.elements.curp.value=info.curp;form.elements.fechaNacimiento.value=info.fechaNacimiento;form.elements.edad.value=info.edad;form.elements.sexo.value=info.sexo;form.elements.entidadNacimiento.value=info.entidadNacimiento;if(result.existingStudent)fillEnrollmentForm(Object.assign({},result.existingStudent,info));const box=$('#enrollmentCurpResult');box.textContent=result.message;box.classList.remove('hidden-control')}catch(error){familyMessage(error.message,true)}finally{setLoading(false)}
}

async function compressEnrollmentImage(file){
  if(!file||!file.type.startsWith('image/'))throw new Error('Selecciona un archivo de imagen.');
  const bitmap=await createImageBitmap(file),maxW=800,maxH=1067,scale=Math.min(maxW/bitmap.width,maxH/bitmap.height,1),width=Math.max(1,Math.round(bitmap.width*scale)),height=Math.max(1,Math.round(bitmap.height*scale));
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;canvas.getContext('2d').drawImage(bitmap,0,0,width,height);bitmap.close();
  let quality=.8,dataUrl=canvas.toDataURL('image/webp',quality);while(dataUrl.length*0.75>650000&&quality>.45){quality-=.1;dataUrl=canvas.toDataURL('image/webp',quality)}return dataUrl;
}
async function handleEnrollmentPhoto(event){
  const input=event.currentTarget,type=input.dataset.enrollmentPhoto,file=input.files?.[0];if(!file)return;setLoading(true);
  try{const dataUrl=await compressEnrollmentImage(file);const result=await enrollmentApi('uploadEnrollmentPhoto',{type,dataUrl});$(`[data-enrollment-preview="${type}"]`).src=dataUrl;$(`[data-enrollment-preview="${type}"]`).classList.add('has-photo');familyMessage(result.message)}catch(error){familyMessage(error.message,true);input.value=''}finally{setLoading(false)}
}
async function loadEnrollmentPhotoPreviews(){
  const photos=enrollmentDraftData?.photos||[];for(const photo of photos){try{const result=await enrollmentApi('getEnrollmentPhoto',photo.type);if(result.found){const image=$(`[data-enrollment-preview="${photo.type}"]`);if(image){image.src=result.dataUrl;image.classList.add('has-photo')}}}catch(error){}}
}
function logoutEnrollment(){enrollmentSessionToken='';localStorage.removeItem(ENROLLMENT_SESSION_KEY);location.href=siteBaseUrl()+'?inscripcion='+encodeURIComponent(enrollmentLinkToken)}
async function submitEnrollment(){
  const form=$('#enrollmentWizardForm');if(!form.elements.confirmacionVeracidad.checked)return familyMessage('Confirma que revisaste la información antes de enviarla.',true);
  if(!await saveEnrollmentDraft(true))return;if(!confirm('¿Enviar la ficha a la escuela? Podrás imprimirla inmediatamente.'))return;setLoading(true);
  try{const result=await enrollmentApi('submitEnrollment');enrollmentDraftData.enrollment=result.enrollment;familyMessage(result.message);await printEnrollment(false)}catch(error){familyMessage(error.message,true)}finally{setLoading(false)}
}

async function generateAllFamilyAccess(){
  if(!state.directory)await loadFamilyAccess(true);const ids=(state.directory?.rows||[]).map(row=>row.student.id);if(!ids.length)return toast('No hay alumnos para generar accesos.',true);
  if(!confirm(`Se crearán o renovarán ${ids.length} contraseñas temporales. ¿Continuar?`))return;
  await runAction(async()=>{const result=await server('generateFamilyCredentialsBatch',ids);state.familyCredentials=result.credentials||[];state.directory=await server('getDirectoryAdminData');state.directoryLoadedAt=Date.now();renderFamilyAccess();toast(result.message+' Ya puedes imprimir las tarjetas.')})
}

function printFamilyCredentials(credentials){
  const rows=Array.isArray(credentials)?credentials.filter(item=>item&&item.password):[];
  if(!rows.length)return toast('Primero genera los accesos. Las contraseñas anteriores no pueden volver a mostrarse.',true);
  const popup=window.open('','_blank');if(!popup)return toast('Permite las ventanas emergentes para imprimir.',true);
  const logo=new URL('school-logo.webp',location.href).href,qr=new URL('family-access-qr.svg',location.href).href,access=siteBaseUrl()+'?familia=acceso',school=state.config.escuela||'Escuela Primaria Francisco Hoil Torres';
  const cards=rows.map(item=>`<article class="access-card"><header><img src="${escapeHtml(logo)}"><div><b>${escapeHtml(school)}</b><span>${escapeHtml(state.config.gradoGrupo||'4° A')} · ${escapeHtml(state.config.cicloEscolar||'2026-2027')}</span></div></header><p class="tag">ACCESO FAMILIAR</p><h2>${escapeHtml(item.studentName)}</h2><div class="card-body"><div><label>USUARIO</label><strong>${escapeHtml(item.username)}</strong><label>CONTRASEÑA TEMPORAL</label><strong>${escapeHtml(item.password)}</strong><small>Vence: ${escapeHtml(new Date(Number(item.expiresAt)).toLocaleDateString('es-MX'))}</small></div><img class="qr" src="${escapeHtml(qr)}"></div><ol><li>Escanea el código.</li><li>Inicia sesión.</li><li>Confirma tus datos y cambia la contraseña.</li></ol><p class="url">${escapeHtml(access)}</p><footer>Información confidencial para la madre, padre o tutor.</footer></article>`).join('');
  popup.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Tarjetas de acceso familiar</title><style>@page{size:letter portrait;margin:8mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#102a43;display:grid;grid-template-columns:1fr 1fr;gap:6mm}.access-card{height:127mm;border:1.5px dashed #65798b;border-radius:9px;padding:7mm;position:relative;break-inside:avoid;overflow:hidden}.access-card header{display:flex;gap:8px;align-items:center;border-bottom:3px solid #10a9b0;padding-bottom:7px}.access-card header img{width:40px;height:40px;object-fit:contain}.access-card header div{display:flex;flex-direction:column;font-size:9px}.access-card header b{font-size:10px}.tag{font-size:8px;letter-spacing:1px;color:#078f98;font-weight:800;margin:8px 0 3px}.access-card h2{font-size:15px;margin:0 0 7px}.card-body{display:grid;grid-template-columns:1fr 72px;gap:8px;align-items:center;background:#eef8f8;border-radius:8px;padding:8px}.card-body div{display:flex;flex-direction:column}.card-body label{font-size:7px;font-weight:bold;color:#55717b}.card-body strong{font-size:13px;background:white;border:1px dashed #7fb6b9;border-radius:5px;padding:5px;margin:2px 0 5px}.card-body small{font-size:7px}.qr{width:70px;height:70px}.access-card ol{font-size:8px;line-height:1.4;padding-left:16px;margin:7px 0}.url{font-size:6.8px;text-align:center;overflow-wrap:anywhere;margin:4px}.access-card footer{position:absolute;left:7mm;right:7mm;bottom:5mm;font-size:7px;color:#9a2b2b;text-align:center}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>${cards}</body></html>`);popup.document.close();popup.focus();setTimeout(()=>popup.print(),800);
}

function openEnrollmentAdmin(){showView('enrollment-admin');loadEnrollmentAdmin(false)}
async function loadEnrollmentAdmin(force=false){
  if(enrollmentAdminData&&!force){renderEnrollmentAdmin();return}await runAction(async()=>{if(state.config.directorioSiteUrl!==siteBaseUrl()){await server('saveDirectorySiteUrl',siteBaseUrl());state.config.directorioSiteUrl=siteBaseUrl()}enrollmentAdminData=await server('getEnrollmentAdminData');renderEnrollmentAdmin()})
}
function renderEnrollmentAdmin(){
  const stats=enrollmentAdminData?.stats||{};$('#enrollmentAdminStats').innerHTML=[['Fichas',stats.total||0],['Borradores',stats.drafts||0],['Enviadas',stats.submitted||0],['Aprobadas',stats.approved||0]].map(([label,value])=>`<div class="stat"><b>${value}</b><span>${label}</span></div>`).join('');
  $('#enrollmentPeriods').innerHTML=(enrollmentAdminData?.periods||[]).length?enrollmentAdminData.periods.map(period=>`<article class="enrollment-period-card"><div><span class="directory-state ${period.status==='ABIERTO'?'success':'muted-state'}">${escapeHtml(period.status)}</span><h3>${escapeHtml(period.name)}</h3><p>${escapeHtml([period.group,period.cycle,period.startDate&&'Desde '+formatDateShort(period.startDate),period.endDate&&'Hasta '+formatDateShort(period.endDate)].filter(Boolean).join(' · '))}</p></div><div class="button-row">${period.url?`<button class="btn primary small" data-action="copy-enrollment-link" data-url="${escapeHtml(period.url)}">Copiar enlace</button>`:''}<button class="btn small" data-action="toggle-enrollment-period" data-id="${escapeHtml(period.id)}" data-status="${period.status==='ABIERTO'?'CERRADO':'ABIERTO'}">${period.status==='ABIERTO'?'Cerrar':'Reabrir'}</button></div></article>`).join(''):'<p class="muted">Todavía no se ha creado un periodo de inscripción.</p>';renderEnrollmentAdminList();
}
function renderEnrollmentAdminList(){
  const query=$('#enrollmentAdminSearch')?.value.trim().toLowerCase()||'',rows=(enrollmentAdminData?.enrollments||[]).filter(row=>[row.name,row.curp,row.email].join(' ').toLowerCase().includes(query));
  $('#enrollmentAdminList').innerHTML=rows.length?rows.map(row=>`<article class="enrollment-admin-row"><div><span class="directory-state ${row.status==='APROBADA'?'success':row.status==='ENVIADA'?'warning':row.status==='REQUIERE_CORRECCION'?'danger':'muted-state'}">${escapeHtml(row.status.replaceAll('_',' '))}</span><h3>${escapeHtml(row.name)}</h3><p>${escapeHtml(row.curp||'CURP pendiente')} · ${escapeHtml(row.email)}</p><div class="enrollment-mini-progress"><i style="width:${row.percentage}%"></i></div></div><div><strong>${row.percentage}%</strong><button class="btn small" data-action="open-enrollment-detail" data-id="${escapeHtml(row.id)}">Abrir ficha</button></div></article>`).join(''):'<p class="muted">No se encontraron inscripciones.</p>';
}
function toggleEnrollmentPeriodForm(){$('#enrollmentPeriodFormPanel').classList.toggle('hidden-control')}
async function createEnrollmentPeriod(event){event.preventDefault();await runAction(async()=>{const result=await server('createEnrollmentPeriod',formData(event.currentTarget));event.currentTarget.reset();$('#enrollmentPeriodFormPanel').classList.add('hidden-control');enrollmentAdminData=await server('getEnrollmentAdminData');renderEnrollmentAdmin();showDirectoryLink('Enlace general de inscripción','Envía el mismo enlace a todas las familias del grupo.',result.url);toast(result.message)})}
async function copyEnrollmentLink(url){try{await navigator.clipboard.writeText(url);toast('Enlace de inscripción copiado.')}catch(error){showDirectoryLink('Enlace de inscripción','Copia y envía este enlace a las familias.',url)}}
async function toggleEnrollmentPeriod(id,status){if(!confirm(status==='CERRADO'?'¿Cerrar este periodo de inscripción?':'¿Reabrir este periodo?'))return;await runAction(async()=>{const result=await server('setEnrollmentPeriodStatus',id,status);enrollmentAdminData=await server('getEnrollmentAdminData');renderEnrollmentAdmin();toast(result.message)})}
async function openEnrollmentAdminDetail(id){await runAction(async()=>{enrollmentAdminCurrent=await server('getEnrollmentAdminDetail',id);const data=enrollmentAdminCurrent.enrollment.data||{};$('#enrollmentAdminDialogTitle').textContent=[data.apellidoPaterno,data.apellidoMaterno,data.nombres].filter(Boolean).join(' ')||'Ficha de inscripción';$('#enrollmentAdminDetail').innerHTML=enrollmentDigitalCard(enrollmentAdminCurrent);$('#enrollmentAdminDialog').showModal()})}
function enrollmentDigitalCard(detail){const e=detail.enrollment,d=e.data||{};return `<div class="enrollment-digital-status"><span class="directory-state warning">${escapeHtml(e.status.replaceAll('_',' '))}</span><span>${e.percentage}% completado</span><span>Actualizada: ${escapeHtml(e.updatedAt||'')}</span></div><div class="enrollment-digital-grid"><article><h3>Alumno</h3><p><b>${escapeHtml([d.apellidoPaterno,d.apellidoMaterno,d.nombres].filter(Boolean).join(' '))}</b></p><p>CURP: ${escapeHtml(d.curp||'—')}</p><p>Nacimiento: ${escapeHtml(d.fechaNacimiento||'—')} · ${escapeHtml(d.sexo||'—')}</p></article><article><h3>Tutor</h3><p><b>${escapeHtml([d.tutorApellidoPaterno,d.tutorApellidoMaterno,d.tutorNombres].filter(Boolean).join(' '))}</b></p><p>${escapeHtml(d.tutorParentesco||'—')} · ${escapeHtml(d.tutorTelefono||'—')}</p><p>${escapeHtml(detail.account.email||'—')}</p></article><article><h3>Domicilio</h3><p>${escapeHtml([d.domicilioCalle,d.domicilioNumeroExterior,d.domicilioColonia,d.domicilioRegion].filter(Boolean).join(', ')||'—')}</p></article><article><h3>Salud</h3><p>Alergias: ${escapeHtml(d.alergias||'—')}</p><p>Diagnóstico: ${escapeHtml(d.diagnostico||'—')}</p></article></div>${e.reviewNotes?`<div class="integration-note"><b>Observaciones:</b> ${escapeHtml(e.reviewNotes)}</div>`:''}`}
async function requestEnrollmentCorrection(){if(!enrollmentAdminCurrent)return;const notes=prompt('Escribe qué información debe corregir la familia:','');if(!notes)return;await runAction(async()=>{const result=await server('reviewEnrollment',enrollmentAdminCurrent.enrollment.id,'CORRECTION',notes);$('#enrollmentAdminDialog').close();enrollmentAdminData=await server('getEnrollmentAdminData');renderEnrollmentAdmin();toast(result.message)})}
async function approveEnrollment(){if(!enrollmentAdminCurrent||!confirm('¿Aprobar la inscripción e integrar al alumno en todo el sistema?'))return;await runAction(async()=>{const result=await server('approveEnrollment',enrollmentAdminCurrent.enrollment.id);$('#enrollmentAdminDialog').close();enrollmentAdminData=await server('getEnrollmentAdminData');Object.assign(state,await server('getBootstrapData'));renderAll();renderEnrollmentAdmin();toast(result.message)})}

async function enrollmentPhotosForPrint(admin){
  const types=['alumno','tutor','madre','padre','autorizado1','autorizado2','autorizado3'],result={};for(const type of types){try{const photo=admin?await server('getEnrollmentPhotoAdmin',enrollmentAdminCurrent.enrollment.id,type):await enrollmentApi('getEnrollmentPhoto',type);if(photo.found)result[type]=photo.dataUrl}catch(error){}}return result;
}
async function printEnrollment(admin=false){
  setLoading(true);try{let detail;if(admin){if(!enrollmentAdminCurrent)return;detail=enrollmentAdminCurrent}else{detail=await enrollmentApi('getEnrollmentDraft');enrollmentDraftData=detail}const photos=await enrollmentPhotosForPrint(admin);const html=enrollmentPrintDocument(detail,photos);const popup=window.open('','_blank');if(!popup)return toast('Permite las ventanas emergentes para imprimir.',true);popup.document.write(html);popup.document.close();popup.focus();setTimeout(()=>popup.print(),700)}catch(error){admin?toast(error.message,true):familyMessage(error.message,true)}finally{setLoading(false)}
}
function pv(value){return escapeHtml(value||'—')}
function photoBox(photos,type,label){return `<div class="print-photo">${photos[type]?`<img src="${photos[type]}">`:`<span>PEGAR<br>FOTO<br>ACTUAL</span>`}<small>${label}</small></div>`}
function line(label,value){return `<div class="print-line"><b>${label}</b><span>${pv(value)}</span></div>`}
function enrollmentPrintHeader(config){return `<header><img src="school-logo.webp"><div><b>SERVICIOS EDUCATIVOS DE QUINTANA ROO</b><span>DIRECCIÓN DE EDUCACIÓN PRIMARIA</span><span>ZONA ESCOLAR 064 · C.C.T. ${pv(config.cct||'23DPR0136V')}</span><strong>${pv(config.escuela||'ESC. PRIM. FRANCISCO HOIL TORRES')}</strong></div></header>`}
function enrollmentPrintDocument(detail,photos){
  const d=detail.enrollment.data||{},config=detail.config||{},assessment=ENROLLMENT_QUESTIONS.map((question,index)=>`<tr><td>${escapeHtml(question)}</td>${['Siempre','Casi siempre','Algunas veces','Nunca'].map(value=>`<td>${d['valoracion'+(index+1)]===value?'X':''}</td>`).join('')}</tr>`).join('');
  const authorized=[1,2,3].map(number=>`<div class="authorized-print">${photoBox(photos,'autorizado'+number,'Persona '+number)}<div>${line('Nombre:',d['autorizado'+number+'Nombre'])}${line('Parentesco:',d['autorizado'+number+'Parentesco'])}${line('Teléfono:',d['autorizado'+number+'Telefono'])}</div></div>`).join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Ficha de inscripción</title><style>@page{size:letter portrait;margin:8mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#111;font-size:9.5px}.sheet{width:100%;min-height:255mm;page-break-after:always;position:relative}.sheet:last-child{page-break-after:auto}header{display:flex;justify-content:flex-end;align-items:center;border-bottom:1px solid #222;padding-bottom:5px;margin-bottom:7px;text-align:right;gap:9px}header img{width:48px;height:48px;object-fit:contain}header div{display:flex;flex-direction:column;line-height:1.25}header strong{font-size:10px}.page-title{text-align:center;font-size:14px;margin:7px 0}.content-photo{display:grid;grid-template-columns:94px 1fr;gap:10px}.print-photo{width:88px;height:105px;border:1px solid #222;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;overflow:hidden}.print-photo img{width:100%;height:86px;object-fit:cover}.print-photo small{font-size:7px}.print-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px 9px}.print-grid.two{grid-template-columns:repeat(2,1fr)}.print-line{min-height:22px;border-bottom:1px solid #333;padding:3px 1px}.print-line b{display:block;font-size:7.5px;text-transform:uppercase}.print-line span{font-size:9.5px}.block{border:1px solid #555;padding:6px;margin:7px 0}.block h2{font-size:11px;margin:0 0 5px;background:#e9eef3;padding:4px}.authorized-print{display:grid;grid-template-columns:94px 1fr;gap:8px;border:1px solid #777;padding:6px;margin:6px 0}.authorized-print .print-photo{height:77px}.authorized-print .print-photo img{height:60px}.parents{display:grid;grid-template-columns:1fr 1fr;gap:8px}.assessment{width:100%;border-collapse:collapse;font-size:7.2px}.assessment th,.assessment td{border:1px solid #555;padding:2px;text-align:center}.assessment td:first-child{text-align:left}.assessment th:first-child{width:68%}.footer{position:absolute;bottom:0;right:0;font-weight:bold}.signature{margin-top:14px;text-align:center}.signature span{display:inline-block;border-top:1px solid #222;width:230px;padding-top:4px}@media print{button{display:none}}</style></head><body>
  <section class="sheet">${enrollmentPrintHeader(config)}<div class="page-title">FICHA DE INSCRIPCIÓN · DATOS DEL ALUMNO(A)</div><div class="content-photo">${photoBox(photos,'alumno','Alumno(a)')}<div><div class="print-grid">${line('Apellido paterno',d.apellidoPaterno)}${line('Apellido materno',d.apellidoMaterno)}${line('Nombre(s)',d.nombres)}</div><div class="print-grid">${line('CURP',d.curp)}${line('Fecha de nacimiento',d.fechaNacimiento)}${line('Lugar de nacimiento',d.lugarNacimiento)}</div><div class="print-grid">${line('Edad',d.edad)}${line('Sexo',d.sexo)}${line('Entidad de nacimiento',d.entidadNacimiento)}</div></div></div><div class="block"><h2>Información personal y de salud</h2><div class="print-grid">${line('Peso',d.peso)}${line('Estatura',d.estatura)}${line('Tipo de sangre',d.tipoSangre)}${line('Estado de salud',d.estadoSalud)}${line('Nacionalidad',d.nacionalidad)}${line('Lengua materna',d.lenguaMaterna)}</div><div class="print-grid">${line('Cuenta con seguro',d.cuentaSeguro)}${line('Institución',d.institucionSeguro)}${line('Núm. de seguridad social',d.numeroSeguroSocial)}</div>${line('Vive con',d.viveCon)}${line('Observaciones',d.observacionesVivienda)}</div><div class="block"><h2>Domicilio</h2><div class="print-grid">${line('SM/Región',d.domicilioRegion)}${line('Manzana',d.domicilioManzana)}${line('Lote',d.domicilioLote)}${line('Calle',d.domicilioCalle)}${line('Número exterior',d.domicilioNumeroExterior)}${line('Interior/Depto.',d.domicilioNumeroInterior)}</div><div class="print-grid two">${line('Entre calles',d.domicilioEntreCalles)}${line('Colonia/Fraccionamiento',d.domicilioColonia)}</div>${line('Referencias',d.domicilioReferencias)}</div><div class="block"><h2>Datos escolares</h2><div class="print-grid two">${line('Escuela de procedencia',d.escuelaProcedencia)}${line('Entidad',d.entidadEscuelaProcedencia)}</div><div class="print-grid">${line('Grado anterior',d.gradoAnterior)}${line('Promedio final',d.promedioAnterior)}${line('Repitió grado',d.repitioGrado+' '+(d.gradoRepetido||''))}</div><div class="print-grid two">${line('Nuevo grado y grupo',d.gradoGrupoNuevo)}${line('Ciclo escolar',d.cicloEscolarNuevo)}</div></div><span class="footer">1</span></section>
  <section class="sheet">${enrollmentPrintHeader(config)}<div class="page-title">DATOS DEL TUTOR Y PERSONAS AUTORIZADAS</div><div class="content-photo">${photoBox(photos,'tutor','Tutor principal')}<div><div class="print-grid">${line('Apellido paterno',d.tutorApellidoPaterno)}${line('Apellido materno',d.tutorApellidoMaterno)}${line('Nombre(s)',d.tutorNombres)}</div><div class="print-grid">${line('Parentesco',d.tutorParentesco)}${line('Teléfono',d.tutorTelefono)}${line('Teléfono alterno',d.tutorTelefonoAlterno)}</div><div class="print-grid">${line('CURP',d.tutorCurp)}${line('Fecha de nacimiento',d.tutorFechaNacimiento)}${line('Lugar de nacimiento',d.tutorLugarNacimiento)}</div></div></div><div class="block"><div class="print-grid">${line('Nacionalidad',d.tutorNacionalidad)}${line('Lengua materna',d.tutorLenguaMaterna)}${line('Estado civil',d.tutorEstadoCivil)}${line('Nivel de estudios',d.tutorEstudios)}${line('Ocupación',d.tutorOcupacion)}${line('Correo de cuenta',detail.account?.email)}</div></div><h2 class="page-title">PERSONAS AUTORIZADAS PARA RETIRAR AL ALUMNO(A)</h2>${authorized}<span class="footer">2</span></section>
  <section class="sheet">${enrollmentPrintHeader(config)}<div class="page-title">DATOS DE LOS PADRES E INFORMACIÓN FAMILIAR</div><div class="parents"><div class="block"><h2>Madre</h2><div class="content-photo">${photoBox(photos,'madre','Madre')}<div>${line('Nombre',d.madreNombres)}${line('Edad',d.madreEdad)}${line('Estado civil',d.madreEstadoCivil)}${line('Escolaridad',d.madreEscolaridad)}${line('Teléfono',d.madreTelefono)}${line('Ocupación',d.madreOcupacion)}${line('Empresa',d.madreEmpresa)}${line('Teléfono del trabajo',d.madreTelefonoTrabajo)}</div></div></div><div class="block"><h2>Padre</h2><div class="content-photo">${photoBox(photos,'padre','Padre')}<div>${line('Nombre',d.padreNombres)}${line('Edad',d.padreEdad)}${line('Estado civil',d.padreEstadoCivil)}${line('Escolaridad',d.padreEscolcolaridad||d.padreEscolaridad)}${line('Teléfono',d.padreTelefono)}${line('Ocupación',d.padreOcupacion)}${line('Empresa',d.padreEmpresa)}${line('Teléfono del trabajo',d.padreTelefonoTrabajo)}</div></div></div></div><div class="block"><h2>Información del hogar</h2><div class="print-grid">${line('Personas en casa',d.personasEnCasa)}${line('Traslado a la escuela',d.medioTransporte)}${line('Tiempo de traslado',d.tiempoTraslado)}</div><div class="print-grid two">${line('Ayuda con tareas',d.ayudaTareas)}${line('Tiempo de tareas',d.tiempoTareas)}</div><div class="print-grid">${line('Ocio/pasatiempos',d.tiempoOcio)}${line('Lectura',d.tiempoLectura)}${line('Convivencia',d.tiempoConvivencia)}</div></div><div class="block"><h2>Apoyos educativos y cuestiones médicas</h2>${line('USAER, educación especial u otro apoyo',d.apoyoEducativo)}${line('Diagnóstico importante',d.diagnostico)}${line('Alergias',d.alergias)}${line('Enfermedades crónicas',d.enfermedadesCronicas)}${line('Medicamentos o tratamiento',d.medicamentos)}<div class="print-grid">${line('Problemas para mirar',d.problemaMirar)}${line('Caminar',d.problemaCaminar)}${line('Escuchar',d.problemaEscuchar)}</div>${line('Estudios o información adicional',d.estudiosMedicos)}</div><span class="footer">3</span></section>
  <section class="sheet">${enrollmentPrintHeader(config)}<div class="page-title">DESEMPEÑO ACADÉMICO</div><p>Marque la frecuencia con la que observa cada conducta. La información será utilizada para favorecer el desarrollo integral del alumno.</p><table class="assessment"><thead><tr><th>Aspecto</th><th>Siempre</th><th>Casi siempre</th><th>Algunas veces</th><th>Nunca</th></tr></thead><tbody>${assessment}</tbody></table><div class="block"><h2>Acciones que se realizarán en casa</h2><p>${pv(d.accionesEnCasa)}</p></div><div class="signature"><span>Nombre y firma de la madre, padre o tutor</span></div><span class="footer">4</span></section>
  </body></html>`;
}
