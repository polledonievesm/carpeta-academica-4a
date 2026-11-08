/* ==========================================================================
   MÓDULO: ESTADO GLOBAL Y COMUNICACIÓN API CON GOOGLE APPS SCRIPT
   ========================================================================== */
const state={config:{},subjects:[],rubrics:[],students:[],projects:[],stats:{},attendance:null,attendanceLoadedAt:0,attendanceDay:null,attendanceRecords:{},attendanceSummary:null,currentProject:null,projectWorkspace:null,classEvaluations:{},classStudents:[],classAttendanceDay:null,paymentsInitial:null,paymentsLoadedAt:0,paymentDetail:null,directory:null,directoryLoadedAt:0,familyCredentials:[],grades:null,gradeWeights:[],gradeReport:null,projectMode:'all'};
const $=(s,r=document)=>r.querySelector(s);const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const API_SOURCE='pase-lista-4a-api';
const API_URL=String(window.CARPETA_ACADEMICA_CONFIG?.apiUrl||'').trim();
const SESSION_KEY='carpeta_academica_session_v1';
const BOOTSTRAP_CACHE_KEY='carpeta_academica_bootstrap_cache_v1';
const FAMILY_SESSION_KEY='carpeta_academica_family_session_v1';
const FAMILY_REMEMBER_KEY='carpeta_academica_family_remember_v1';
const DRAFT_KEYS={project:'carpeta_academica_draft_project_v1',classRecord:'carpeta_academica_draft_activity_v1',instrument:'carpeta_academica_draft_instrument_v1'};
const pendingRequests=new Map();
const inFlightServerCalls=new Map();
const draftTimers=new Map();
let sessionToken=localStorage.getItem(SESSION_KEY)||'';
let familySessionToken=sessionStorage.getItem(FAMILY_SESSION_KEY)||(localStorage.getItem(FAMILY_REMEMBER_KEY)==='true'?localStorage.getItem(FAMILY_SESSION_KEY)||'':'');
if(localStorage.getItem(FAMILY_REMEMBER_KEY)!=='true')localStorage.removeItem(FAMILY_SESSION_KEY);
let familyIdleTimer=null;
let familyInvitationToken='';
let familyResetToken='';
let familyGroupToken='';
let familyPortalData=null;
let currentFamilyAccessStudentId='';
let loadingShowTimer=0;
let loadingSlowTimer=0;
let activeLoadingCount=0;
let lastActionRetry=null;
let gasSyncFadeTimer=null;
const familyAccessSelection=new Set();
const paymentEventCache=new Map();
const gradeReportCache=new Map();
const VIEW_TITLES={dashboard:'Inicio',students:'Lista de alumnos',styles:'Estilos de aprendizaje',projects:'Proyectos','project-detail':'Proyecto',daily:'Registro diario',attendance:'Asistencia','attendance-reports':'Reportes de asistencia',reports:'Reportes',grades:'Calificaciones',instruments:'Instrumentos',observations:'Observaciones de conducta','pda-observations':'Observaciones por PDA',drafts:'Borradores',directory:'Directorio familiar','family-access':'Accesos familiares',payments:'Control de pagos',settings:'Configuración','enrollment-admin':'Inscripción'};
document.addEventListener('DOMContentLoaded',()=>{bindUI();$('#bootRetry')?.addEventListener('click',()=>loadApp());$('#operationLoaderRetry')?.addEventListener('click',()=>{const retry=lastActionRetry;setLoading(false);if(retry)retry()});startApp()});
window.addEventListener('message',receiveApiMessage);

function setGasSyncStatus(status,text='',retry=null){
  const el=$('#gasSyncIndicator'),label=$('#gasSyncText');
  if(!el||!label)return;
  clearTimeout(gasSyncFadeTimer);
  if(status==='hidden'){el.classList.add('hidden-control');return}
  el.className=`gas-sync-indicator ${status}`;
  label.textContent=text||(status==='syncing'?'Conectando con Google…':status==='synced'?'✓ Sincronizado':status==='slow'?'Google responde lento…':'⚠️ Error de conexión');
  el.onclick=(status==='error'&&typeof retry==='function')?retry:null;
  el.classList.remove('hidden-control');
}
function readBootstrapCache(){
  try{const raw=localStorage.getItem(BOOTSTRAP_CACHE_KEY);return raw?JSON.parse(raw):null}catch(e){return null}
}
function saveBootstrapCache(data){
  try{if(data&&typeof data==='object')localStorage.setItem(BOOTSTRAP_CACHE_KEY,JSON.stringify(data))}catch(e){}
}

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
    const safeArgs = (typeof window !== 'undefined' && typeof window.sanitizePayload === 'function') ? window.sanitizePayload(args) : args;
    const fields={requestId,action,args:JSON.stringify(safeArgs),sessionToken:token||''};
    Object.entries(fields).forEach(([name,value])=>{const input=document.createElement('input');input.type='hidden';input.name=name;input.value=value;form.appendChild(input)});
    document.body.appendChild(form);
    const timer=setTimeout(()=>{pendingRequests.delete(requestId);iframe.remove();reject(new Error('La conexión con Google tardó demasiado. Intenta nuevamente.'))},45000);
    pendingRequests.set(requestId,{resolve,reject,iframe,timer});form.submit();form.remove();
  });
}
function server(name,...args){
  const key=name+'|'+JSON.stringify(args);
  if(inFlightServerCalls.has(key))return inFlightServerCalls.get(key);
  setGasSyncStatus('syncing','Consultando Google…');
  const request=apiRequest(name,args).finally(()=>{
    inFlightServerCalls.delete(key);
    if(inFlightServerCalls.size===0){
      setGasSyncStatus('synced','✓ Listo');
      gasSyncFadeTimer=setTimeout(()=>setGasSyncStatus('hidden'),1800);
    }
  });
  inFlightServerCalls.set(key,request);
  return request;
}
function familyServer(name,...args){return apiRequest(name,args,familySessionToken)}
function storeFamilySession(token,remember=false){familySessionToken=token||'';sessionStorage.setItem(FAMILY_SESSION_KEY,familySessionToken);if(remember){localStorage.setItem(FAMILY_SESSION_KEY,familySessionToken);localStorage.setItem(FAMILY_REMEMBER_KEY,'true')}else{localStorage.removeItem(FAMILY_SESSION_KEY);localStorage.removeItem(FAMILY_REMEMBER_KEY)}resetFamilyIdleTimer()}
function isLocalSite(){return /^(http:\/\/localhost|http:\/\/127\.0\.0\.1|file:)/i.test(location.origin)}
function siteBaseUrl(){if(isLocalSite()&&state.config?.directorioSiteUrl){return state.config.directorioSiteUrl}return location.origin+location.pathname}
async function syncSiteUrlSafely(){const current=siteBaseUrl();if(!isLocalSite()&&/^https?:\/\/[^/]+\/.+/i.test(current)&&state.config?.directorioSiteUrl!==current){try{await server('saveDirectorySiteUrl',current);state.config.directorioSiteUrl=current}catch(e){console.warn('Aviso: no fue necesario actualizar la URL del sitio:',e.message)}}}
function lockTeacherApp(){document.body.classList.add('teacher-login-mode');$('#app')?.classList.add('auth-protected')}
function unlockTeacherApp(){document.body.classList.remove('teacher-login-mode');$('#app')?.classList.remove('auth-protected')}
function showBoot(message='Preparando el acceso seguro…',retry=false){const box=$('#bootScreen');if(!box)return;$('#bootStatus').textContent=message;$('#bootRetry').classList.toggle('hidden-control',!retry);box.classList.remove('hidden-control')}
function hideBoot(){$('#bootScreen')?.classList.add('hidden-control');$('#loading')?.classList.add('hidden')}

async function startApp(){
  $('#loading')?.classList.add('hidden');
  const params=new URLSearchParams(location.search);
  familyInvitationToken=params.get('familia')||'';
  familyResetToken=params.get('recuperar')||'';
  familyGroupToken=params.get('grupo')||'';
  const enrollment=params.get('inscripcion')||'';
  if(enrollment){hideBoot();setLoading(false);return startEnrollmentPortal(enrollment)}
  if(familyInvitationToken||familyResetToken||familyGroupToken){hideBoot();setLoading(false);return startFamilyPortal()}
  if(sessionToken){
    const cached=readBootstrapCache();
    if(cached){
      Object.assign(state,cached);
      unlockTeacherApp();
      hideBoot();
      setLoading(false);
      renderAll();
      syncBootstrapInBackground();
    }else{
      unlockTeacherApp();
      hideBoot();
      renderAll();
      await loadApp();
      setLoading(false);
    }
  }else{
    setLoading(false);
    hideBoot();
    showLogin();
  }
}

async function syncBootstrapInBackground(){
  setGasSyncStatus('syncing','Sincronizando con Google…');
  let slowTimer=setTimeout(()=>setGasSyncStatus('slow','Google responde con lentitud…'),7000);
  try{
    let data;
    try{data=await server('getBootstrapDataLite')}catch(error){if(!/acción solicitada no está permitida/i.test(String(error.message||'')))throw error;data=await server('getBootstrapData')}
    clearTimeout(slowTimer);
    Object.assign(state,data);
    saveBootstrapCache(data);
    renderAll();
    setGasSyncStatus('synced','✓ Datos actualizados');
    gasSyncFadeTimer=setTimeout(()=>setGasSyncStatus('hidden'),2200);
  }catch(e){
    clearTimeout(slowTimer);
    if(isSessionError(e.message)){
      sessionToken='';
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(BOOTSTRAP_CACHE_KEY);
      setGasSyncStatus('hidden');
      hideBoot();
      showLogin(e.message);
    }else{
      setGasSyncStatus('error','⚠️ Sin conexión con Google · Reintentar',()=>syncBootstrapInBackground());
    }
  }
}

function showLogin(message=''){lockTeacherApp();$('#loginError').textContent=message;const dialog=$('#loginDialog');if(!dialog.open)dialog.showModal();setTimeout(()=>$('#loginForm').elements.username.focus(),50)}
