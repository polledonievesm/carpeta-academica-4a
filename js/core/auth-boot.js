/* ==========================================================================
   MÓDULO: AUTENTICACIÓN, INICIO DE SESIÓN Y BOOT SCREEN
   ========================================================================== */
async function login(e){e.preventDefault();const form=e.currentTarget;$('#loginError').textContent='';const submitBtn=$('button[type="submit"]',form);const origText=submitBtn?submitBtn.textContent:'';if(submitBtn){submitBtn.disabled=true;submitBtn.textContent='Comprobando acceso…'}setGasSyncStatus('syncing','Iniciando sesión…');try{const r=await apiRequest('login',[form.elements.username.value,form.elements.password.value],'');sessionToken=r.token;localStorage.setItem(SESSION_KEY,sessionToken);form.elements.password.value='';$('#loginDialog').close();setGasSyncStatus('syncing','Cargando datos del grupo…');const cached=readBootstrapCache();if(cached){Object.assign(state,cached);unlockTeacherApp();hideBoot();renderAll();syncBootstrapInBackground()}else{await loadApp()}}catch(error){setGasSyncStatus('hidden');showLogin(error.message)}finally{if(submitBtn){submitBtn.disabled=false;submitBtn.textContent=origText}setLoading(false)}}
function logout(confirmFirst=true){if(confirmFirst&&!confirm('¿Cerrar la sesión de Carpeta Académica?'))return;sessionToken='';localStorage.removeItem(SESSION_KEY);localStorage.removeItem(BOOTSTRAP_CACHE_KEY);location.reload()}
function isSessionError(message){return /sesión|sesion|inicia sesión|inicia sesion|venció|vencio/i.test(String(message||''))}

async function loadApp(){
  setGasSyncStatus('syncing','Conectando con Google…');
  let slowTimer=setTimeout(()=>setGasSyncStatus('slow','Google tarda más de lo habitual…'),7000);
  try{
    let data;
    try{data=await server('getBootstrapDataLite')}catch(error){if(!/acción solicitada no está permitida/i.test(String(error.message||'')))throw error;data=await server('getBootstrapData')}
    clearTimeout(slowTimer);
    Object.assign(state,data);
    saveBootstrapCache(data);
    renderAll();
    unlockTeacherApp();
    hideBoot();
    setLoading(false);
    setGasSyncStatus('synced','✓ Conectado');
    gasSyncFadeTimer=setTimeout(()=>setGasSyncStatus('hidden'),2200);
  }catch(e){
    clearTimeout(slowTimer);
    setLoading(false);
    if(isSessionError(e.message)){
      sessionToken='';
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(BOOTSTRAP_CACHE_KEY);
      hideBoot();
      setGasSyncStatus('hidden');
      showLogin(e.message);
    }else{
      setGasSyncStatus('error','⚠️ Sin conexión · Reintentar',()=>loadApp());
      showBoot('No fue posible cargar los datos. Revisa tu conexión y vuelve a intentarlo.',true);
    }
  }
}
