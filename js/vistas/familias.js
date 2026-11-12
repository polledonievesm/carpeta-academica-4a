
function getStudentFirstNameForNotice(student, profile) {
  const namesStr = profile?.alumnoNombres || '';
  let raw = '';
  if (namesStr.trim()) {
    raw = namesStr.trim().split(/\s+/)[0];
  } else {
    const clean = String(student?.name || '').replace(/\s*\([^)]*\)/g, '').trim();
    raw = clean.split(/\s+/)[0] || 'tu hijo(a)';
  }
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase() : 'tu hijo(a)';
}

function checkAndNotifyIncompleteFamilyProfile() {
  const data = familyPortalData;
  if (!data) return;
  if (sessionStorage.getItem('family_notice_dismissed') === 'true') return;
  const p = data.profile || {};
  // Si ya tiene teléfono, domicilio y contacto de emergencia, o complete === true: NO mostrar pop up
  const isComplete = Boolean(data.complete || (p.tutorTelefono && (p.tutorDomicilio || p.calle) && (p.contactoEmergenciaNombre || p.contactoEmergencia)));
  if (isComplete) return;

  const dialog = document.getElementById('familyIncompleteNoticeDialog');
  if (!dialog) return;

  const firstName = getStudentFirstNameForNotice(data.student, p);

  // Clases y atributos de accesibilidad estándar (role dialog, aria-modal, aria-labelledby)
  dialog.className = 'modal family-update-modal';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'familyIncompleteNoticeTitle');

  dialog.innerHTML = `
    <div class="family-update-modal__header">
      <h2 id="familyIncompleteNoticeTitle" class="family-update-modal__title">Actualiza tus datos familiares</h2>
      <button type="button" class="family-update-modal__close" id="btnFamilyIncompleteClose" aria-label="Cerrar aviso">✕</button>
    </div>
    <div class="family-update-modal__body">
      <p class="family-update-modal__desc">
        Revisa los datos de contacto y emergencia de <strong>${escapeHtml(firstName)}</strong> para que la escuela pueda comunicarse contigo cuando sea necesario.
      </p>
      <p class="family-update-modal__note">
        <i>ℹ️</i>
        <span>Si ya los actualizaste o prefieres hacerlo después, puedes continuar al portal.</span>
      </p>
    </div>
    <div class="family-update-modal__footer">
      <button type="button" class="btn family-update-modal__btn-secondary" id="btnFamilyIncompleteDismiss">Ahora no</button>
      <button type="button" class="btn primary family-update-modal__btn-primary" id="btnGoToFamilyProfileNotice">Revisar mis datos</button>
    </div>
  `;

  let lastActiveElement = document.activeElement;

  function closeDialog(proceedToProfile = false) {
    sessionStorage.setItem('family_notice_dismissed', 'true');
    if (dialog.close) dialog.close();
    else dialog.removeAttribute('open');

    if (proceedToProfile) {
      if (typeof showFamilyViewModern === 'function') {
        showFamilyViewModern('familyProfile', true);
      } else {
        const tabBtn = document.querySelector('[data-family-view="familyProfile"]');
        if (tabBtn) tabBtn.click();
      }
    } else if (lastActiveElement && typeof lastActiveElement.focus === 'function') {
      try { lastActiveElement.focus(); } catch (e) {}
    }
  }

  const btnClose = document.getElementById('btnFamilyIncompleteClose');
  const btnDismiss = document.getElementById('btnFamilyIncompleteDismiss');
  const btnReview = document.getElementById('btnGoToFamilyProfileNotice');

  if (btnClose) btnClose.onclick = () => closeDialog(false);
  if (btnDismiss) btnDismiss.onclick = () => closeDialog(false);
  if (btnReview) btnReview.onclick = () => closeDialog(true);

  // Manejo accesible de tecla Escape (mismo comportamiento que "Ahora no")
  dialog.oncancel = (e) => {
    e.preventDefault();
    closeDialog(false);
  };

  if (typeof dialog.showModal === 'function') {
    if (!dialog.open) dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
  }

  // Foco inicial en el botón principal ("Revisar mis datos")
  setTimeout(() => {
    btnReview?.focus();
  }, 50);
}
window.checkAndNotifyIncompleteFamilyProfile = checkAndNotifyIncompleteFamilyProfile;

// ==========================================================================
// ZONA HORARIA Y FORMATEO DE FECHAS OFICIAL (AMERICA/CANCUN)
// ==========================================================================
const CANCUN_TZ = 'America/Cancun';

function formatCancunDate(val, options = {}) {
  if (val === null || val === undefined) return '—';
  const str = String(val).trim();
  if (!str) return '—';

  const dateOnlyMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, y, m, d] = dateOnlyMatch;
    return `${d}/${m}/${y}`;
  }

  try {
    const num = Number(str);
    const d = !isNaN(num) && str !== '' ? new Date(num) : new Date(str);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es-MX', Object.assign({ timeZone: CANCUN_TZ }, options));
  } catch(e) {
    return String(val);
  }
}

function formatCancunDateTime(val, options = {}) {
  if (val === null || val === undefined) return '—';
  const str = String(val).trim();
  if (!str) return '—';

  // 1. Detección estricta de formato histórico de solo fecha YYYY-MM-DD
  const dateOnlyMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, y, m, d] = dateOnlyMatch;
    // Mostrar la fecha original como componentes de calendario en formato mexicano DD/MM/YYYY sin hora
    return `${d}/${m}/${y}`;
  }

  // 2. Timestamp completo ISO, milisegundos numéricos o fecha con hora
  try {
    const num = Number(str);
    const d = !isNaN(num) && str !== '' ? new Date(num) : new Date(str);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('es-MX', Object.assign({ timeZone: CANCUN_TZ }, options));
  } catch(e) {
    return String(val);
  }
}

if (typeof window !== 'undefined') {
  window.formatCancunDate = formatCancunDate;
  window.formatCancunDateTime = formatCancunDateTime;
}

// ==========================================================================
// CONTROL DE CONCURRENCIA, DEBOUNCE Y BLOQUEO DE TECLAS
// ==========================================================================
let _isFamilyCredentialsOperationBusy = false;
let _isFamilyDirectoryLoading = false;

if (typeof window !== 'undefined' && !window._familyEnterLockAttached) {
  window._familyEnterLockAttached = true;
  window.addEventListener('keydown', (e) => {
    if (_isFamilyCredentialsOperationBusy && e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
}

function setFamilyCredentialsBusy(busy) {
  _isFamilyCredentialsOperationBusy = busy;
  const buttons = document.querySelectorAll(
    '[data-action="generate-selected-family-access"], [data-action="regenerate-all-family-passwords-no-expiry"], [data-action="regenerate-current-family-access"], [data-action="generate-family-credentials"]'
  );
  buttons.forEach(btn => {
    btn.disabled = busy;
    btn.style.opacity = busy ? '0.6' : '';
    btn.style.pointerEvents = busy ? 'none' : '';
  });
}

// ==========================================================================
// GENERADOR OFICIAL DE CÓDIGO QR EN SVG (QRCODE-GENERATOR V1.4.4)
// ==========================================================================
function generateFamilyQrSvg(text) {
  try {
    const qrFn = typeof qrcode === 'function' ? qrcode : (typeof window !== 'undefined' ? window.qrcode : null);
    if (!qrFn) {
      console.warn('qrcode-generator no está disponible.');
      return null;
    }
    // Type 0 (auto-detección de versión de matriz ISO/IEC 18004)
    // Nivel de corrección 'Q' (~25% de tolerancia de error, ideal para impresión física)
    const qr = qrFn(0, 'Q');
    qr.addData(String(text || ''));
    qr.make();

    // Generar SVG con zona blanca de seguridad de 4 módulos y azul marino oscuro #0b315d
    const svgTag = qr.createSvgTag({
      scalable: true,
      margin: 4
    });

    return svgTag.replace(/fill="black"/g, 'fill="#0b315d"');
  } catch(e) {
    console.error('Error al generar código QR con qrcode-generator:', e);
    return null;
  }
}

async function regenerateAllFamilyPasswordsNoExpiry(){
  if (_isFamilyCredentialsOperationBusy) return;

  if (!state.directory) state.directory = { rows: [] };
  if (!state.directory.rows || !state.directory.rows.length) {
    if (state.students && state.students.length) {
      state.directory.rows = state.students.map((s, idx) => ({
        student: {
          id: s.id,
          name: s.name || s.nombreCompleto || (typeof fullName === 'function' ? fullName(s) : '') || ('Alumno ' + (idx + 1)),
          numeroLista: s.numeroLista || (idx + 1)
        },
        account: {}
      }));
    }
  }
  const rows = state.directory.rows || [];
  if (!rows.length) return toast('No hay alumnos registrados en el directorio.', true);
  if (typeof confirm === 'function' && !confirm(`Se generarán contraseñas permanentes (SIN CADUCIDAD) para todos los alumnos (${rows.length}).\n\nLos nombres de usuario se mantendrán iguales y las contraseñas no expirarán.\n\n⚠️ Las contraseñas previas de los tutores dejarán de funcionar.\n\n¿Deseas continuar?`)) return;

  setFamilyCredentialsBusy(true);
  try {
    await runAction(async () => {
      const credentials = [];
      rows.forEach((row, idx) => {
        const studentId = String(row.student.id);
        const studentNum = row.student.numeroLista || (idx + 1);
        const username = row.account?.username || ('fam_' + (row.student.nombres || row.student.name || 'alumno').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) + studentNum);
        const randomPin = Math.random().toString(36).substring(2, 6).toUpperCase();
        const password = 'H4A' + studentNum + randomPin;

        credentials.push({
          studentId: studentId,
          studentName: row.student.name,
          username: username,
          password: password,
          expiresAt: 0
        });
      });

      // Persistencia real y confirmación de Google Sheets antes de actualizar
      if (typeof server === 'function') {
        await server('saveFamilyCredentialsBatch', credentials);
      }
      state.familyCredentials = credentials;
      applyFamilyCredentials(credentials);
      renderFamilyAccess();
      toast(`✓ Se generaron y guardaron ${credentials.length} contraseñas permanentes sin caducidad en Google Sheets.`);
    });
  } catch(err) {
    console.error('Error al persistir lote en Google Sheets:', err);
    toast(`⚠️ No se pudieron guardar las contraseñas en Google Sheets: ${err.message || 'Error de conexión'}. No se aplicaron cambios.`, true);
  } finally {
    setFamilyCredentialsBusy(false);
  }
}
window.regenerateAllFamilyPasswordsNoExpiry = regenerateAllFamilyPasswordsNoExpiry;

/* ==========================================================================
   MÓDULO DE VISTA: FAMILIAS (DIRECTORIO, ACCESOS, PORTAL FAMILIAR Y AJUSTES)
   ========================================================================== */
async function syncLearningStyles(){await runAction(async()=>{const r=await server('syncLearningStyles');state.students=r.students;state.config.estilosSpreadsheetId=state.config.estilosSpreadsheetId||'vinculado';renderStudents();renderStyles();renderAcademicOptions();toast(`${r.matched} resultado(s) VAK actualizados${r.unmatched.length?` · ${r.unmatched.length} sin coincidencia`:''}.`)})}
function openDirectory(force=false){showView('directory');if(state.directory&&!force){renderDirectory();renderDirectoryBuilder();if(Date.now()-state.directoryLoadedAt>300000){server('getDirectoryAdminData').then(data=>{state.directory=data;state.directoryLoadedAt=Date.now();renderDirectory();renderDirectoryBuilder()}).catch(err=>console.warn('Revalidación de directorio:',err))}return}loadDirectory(false)}
async function loadDirectory(force=true){await runAction(async()=>{await syncSiteUrlSafely();state.directory=await server('getDirectoryAdminData');state.directoryLoadedAt=Date.now();renderDirectory();renderDirectoryBuilder();$('#directoryNotice').innerHTML='<strong>Directorio protegido.</strong> Escribe al menos dos letras para buscar. Las familias solo consultan la ficha de su propio alumno.'})}
function openFamilyAccess(force=false){showView('family-access');if(state.directory&&!force){renderFamilyAccess();if(Date.now()-state.directoryLoadedAt>300000){server('getDirectoryAdminData').then(data=>{state.directory=data;state.directoryLoadedAt=Date.now();renderFamilyAccess();renderDirectoryBuilder()}).catch(err=>console.warn('Revalidación de accesos familiares:',err))}return}loadFamilyAccess(false)}

async function loadFamilyAccess(force=false){
  if(!force && state.directory && Date.now() - state.directoryLoadedAt < 120000){
    renderFamilyAccess();
    return;
  }
  if (_isFamilyDirectoryLoading) return;
  _isFamilyDirectoryLoading = true;
  const tbody = document.getElementById('familyAccessTable');
  if (tbody && !state.directory) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center;padding:36px 16px;background:#f8fafc;">
          <div style="display:inline-flex;align-items:center;gap:12px;font-weight:700;color:var(--navy);font-size:14px;">
            <span class="family-access-spinner" style="display:inline-block;width:18px;height:18px;border:3px solid #cbd5e1;border-top-color:var(--teal);border-radius:50%;animation:familySpin 0.8s linear infinite;"></span>
            <span>Cargando accesos familiares desde Google Sheets…</span>
          </div>
          <p style="margin:8px 0 0;font-size:12px;color:var(--muted);">Sincronizando cuentas del grupo...</p>
        </td>
      </tr>
    `;
  }
  try {
    await syncSiteUrlSafely();
    state.directory = await server('getDirectoryAdminData');
    state.directoryLoadedAt = Date.now();
    renderFamilyAccess();
    renderDirectoryBuilder();
  } catch (err) {
    console.error('Error al cargar accesos familiares:', err);
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center;padding:32px 16px;background:#fff5f5;border:1px solid #fed7d7;">
            <p style="margin:0 0 10px;color:#c53030;font-weight:700;font-size:14px;">
              ⚠️ No se pudieron recuperar los accesos familiares: ${escapeHtml(err.message || 'Error de conexión con Google')}
            </p>
            <p style="margin:0 0 16px;font-size:12px;color:#742a2a;">Comprueba tu conexión o reintenta la sincronización con Google Sheets.</p>
            <button type="button" class="btn primary small" onclick="window.loadFamilyAccess && window.loadFamilyAccess(true)">
              🔄 Reintentar
            </button>
          </td>
        </tr>
      `;
    }
    toast('No se pudieron recuperar los accesos familiares. Puedes reintentar.', true);
  } finally {
    _isFamilyDirectoryLoading = false;
  }
}

function familyAccessFilteredRows(){
  const rows=state.directory?.rows||[],query=$('#familyAccessSearch').value.trim().toLowerCase(),status=$('#familyAccessStatus').value;
  return rows.filter(row=>{const account=row.account,text=[row.student.name,account?.username,account?.email,account?.phone].join(' ').toLowerCase();if(query&&!text.includes(query))return false;if(status==='SIN_CUENTA'&&account)return false;if(status==='PENDIENTE'&&(!account||(!account.mustChangePassword&&account.dataConfirmedAt)))return false;if(status==='ACTIVA'&&(!account||!account.active||account.accessRevoked))return false;if(status==='BLOQUEADA'&&(!account||account.active||account.accessRevoked))return false;if(status==='REVOCADA'&&(!account||!account.accessRevoked))return false;return true})
}

function renderFamilyAccess(){
  if(!state.directory) {
    const tbody = document.getElementById('familyAccessTable');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center;padding:36px 16px;background:#f8fafc;">
            <div style="display:inline-flex;align-items:center;gap:12px;font-weight:700;color:var(--navy);font-size:14px;">
              <span class="family-access-spinner" style="display:inline-block;width:18px;height:18px;border:3px solid #cbd5e1;border-top-color:var(--teal);border-radius:50%;animation:familySpin 0.8s linear infinite;"></span>
              <span>Cargando accesos familiares desde Google Sheets…</span>
            </div>
            <p style="margin:8px 0 0;font-size:12px;color:var(--muted);">Recuperando cuentas y estado del grupo...</p>
          </td>
        </tr>
      `;
    }
    if (!_isFamilyDirectoryLoading) {
      loadFamilyAccess(false);
    }
    return;
  }

  const rows=state.directory.rows||[],validIds=new Set(rows.map(row=>String(row.student.id))),filtered=familyAccessFilteredRows();Array.from(familyAccessSelection).forEach(id=>{if(!validIds.has(id))familyAccessSelection.delete(id)});
  $('#familyAccessTable').innerHTML=filtered.length?filtered.map(row=>{const a=row.account;const status=!a?'Sin cuenta':a.accessRevoked?'Acceso revocado':!a.active?'Bloqueada':a.mustChangePassword||!a.dataConfirmedAt?'Primer acceso pendiente':'Activa y confirmada';const recovery=a?[a.email,a.phone].filter(Boolean).join(' · ')||'Sin configurar':'—';const password=a?.temporaryPassword||'';const credential=a?`<div class="family-credential-cell"><code>${escapeHtml(a.username||'Sin usuario')}</code>${password?`<span><b data-family-password="${escapeHtml(row.student.id)}">••••••••••</b><button type="button" class="password-mini-button" data-action="toggle-family-password" data-id="${escapeHtml(row.student.id)}" data-password="${escapeHtml(password)}">Ver</button></span>${a.temporaryExpiresAt && a.temporaryExpiresAt > 0 ? `<small>Temporal hasta ${escapeHtml(formatCancunDate(a.temporaryExpiresAt))}</small>` : `<small style="color:#0f766e;font-weight:700;">● Permanente (Sin caducidad)</small>`}`:`<small>${a.accessRevoked?'Sin contraseña activa':'Contraseña personal protegida'}</small>`}</div>`:'—';return `<tr><td><input type="checkbox" data-family-access-student value="${escapeHtml(row.student.id)}" ${familyAccessSelection.has(String(row.student.id))?'checked':''} aria-label="Seleccionar a ${escapeHtml(row.student.name)}"></td><td><strong>${escapeHtml(row.student.name)}</strong></td><td>${credential}</td><td>${escapeHtml(recovery)}</td><td><span class="directory-state ${!a?'muted-state':a.accessRevoked||!a.active?'danger':a.mustChangePassword||!a.dataConfirmedAt?'warning':'success'}">${escapeHtml(status)}</span></td><td>${a?.lastAccess?escapeHtml(formatCancunDateTime(a.lastAccess)):'—'}</td><td><button class="btn small" data-action="manage-family-access" data-id="${escapeHtml(row.student.id)}">Administrar</button></td></tr>`}).join(''):'<tr><td colspan="7">No se encontraron cuentas con esos filtros.</td></tr>';
  updateFamilyAccessSelectionCount();
}

function selectedFamilyAccessIds(){return Array.from(familyAccessSelection)}
function selectedFamilyAccessRows(){const ids=new Set(selectedFamilyAccessIds());return (state.directory?.rows||[]).filter(row=>ids.has(String(row.student.id)))}
function familyCredentialFromRow(row){const a=row?.account;if(!a?.temporaryPassword)return null;return {studentId:row.student.id,studentName:row.student.name,username:a.username,password:a.temporaryPassword,expiresAt:a.temporaryExpiresAt}}
function updateFamilyAccessSelectionCount(){const count=selectedFamilyAccessIds().length;const label=$('#familyAccessSelectedCount');if(label)label.textContent=`${count} seleccionado${count===1?'':'s'}`;const visible=familyAccessFilteredRows().map(row=>String(row.student.id)),selectedVisible=visible.filter(id=>familyAccessSelection.has(id)).length,master=$('#familyAccessSelectAll');if(master){master.checked=visible.length>0&&selectedVisible===visible.length;master.indeterminate=selectedVisible>0&&selectedVisible<visible.length}}
function setFamilyAccessSelection(mode){const allowed=new Set(familyAccessFilteredRows().filter(row=>mode!=='without'||!row.account).map(row=>String(row.student.id)));if(mode==='none')familyAccessSelection.clear();else allowed.forEach(id=>familyAccessSelection.add(id));$$('[data-family-access-student]').forEach(input=>input.checked=familyAccessSelection.has(String(input.value)));updateFamilyAccessSelectionCount()}

function applyFamilyCredentials(credentials){
  const byStudent=new Map((credentials||[]).map(item=>[String(item.studentId),item]));
  (state.directory?.rows||[]).forEach(row=>{
    const credential=byStudent.get(String(row.student.id));
    if(!credential)return;
    row.account=Object.assign({},row.account||{},{
      username:credential.username,
      active:true,
      mustChangePassword:false,
      temporaryPassword:credential.password,
      temporaryExpiresAt:credential.expiresAt || 0,
      accessRevoked:false,
      accessRevokedAt:''
    });
  });
  state.directoryLoadedAt=Date.now();
}

async function generateSelectedFamilyAccess(){
  if (_isFamilyCredentialsOperationBusy) return;

  const rows = selectedFamilyAccessRows();
  if(!rows.length) return toast('Selecciona por lo menos un alumno.', true);

  const withoutAccount = rows.filter(r => !r.account || !r.account.username);
  const withAccount = rows.filter(r => r.account && r.account.username);

  let targetIds = [];
  let isRegeneration = false;

  if (withAccount.length > 0 && withoutAccount.length > 0) {
    const choice = confirm(
      `Seleccionaste ${rows.length} alumnos:\n` +
      `• ${withoutAccount.length} NO tienen cuenta.\n` +
      `• ${withAccount.length} YA tienen credencial activa.\n\n` +
      `¿Deseas generar ÚNICAMENTE las ${withoutAccount.length} credenciales faltantes (conservando las de los tutores que ya tienen acceso)?\n\n` +
      `[Aceptar] = Solo generar faltantes (${withoutAccount.length})\n` +
      `[Cancelar] = Ver opción de regenerar a todos`
    );

    if (choice) {
      targetIds = withoutAccount.map(r => String(r.student.id));
      isRegeneration = false;
    } else {
      const confirmRegen = confirm(
        `⚠️ ATENCIÓN: Regenerar las ${withAccount.length} cuentas existentes creará nuevas contraseñas e INVALIDARÁ los accesos actuales de los tutores.\n\n` +
        `¿Deseas regenerar las contraseñas de TODOS los ${rows.length} alumnos seleccionados?`
      );
      if (!confirmRegen) return;
      targetIds = rows.map(r => String(r.student.id));
      isRegeneration = true;
    }
  } else if (withAccount.length > 0 && withoutAccount.length === 0) {
    const ok = confirm(
      `⚠️ ATENCIÓN: Los ${withAccount.length} alumnos seleccionados ya tienen credenciales.\n\n` +
      `Regenerar creará nuevas contraseñas y las contraseñas anteriores dejarán de funcionar de inmediato para los tutores.\n\n` +
      `¿Deseas continuar y regenerar las contraseñas seleccionadas?`
    );
    if (!ok) return;
    targetIds = withAccount.map(r => String(r.student.id));
    isRegeneration = true;
  } else {
    const ok = confirm(`Se crearán credenciales permanentes para los ${withoutAccount.length} alumnos seleccionados sin cuenta. ¿Continuar?`);
    if (!ok) return;
    targetIds = withoutAccount.map(r => String(r.student.id));
    isRegeneration = false;
  }

  if (!targetIds.length) return;

  setFamilyCredentialsBusy(true);
  try {
    await runAction(async () => {
      const result = await server('generateFamilyCredentialsBatch', targetIds);
      if (!result || !result.credentials) {
        throw new Error('Google Sheets no confirmó el guardado de credenciales.');
      }
      state.familyCredentials = result.credentials || [];
      applyFamilyCredentials(state.familyCredentials);
      renderFamilyAccess();
      toast(`✓ ${result.message || (isRegeneration ? 'Contraseñas regeneradas y guardadas en Google Sheets.' : 'Credenciales creadas y guardadas en Google Sheets.')} Listas para imprimir.`);
    });
  } catch (err) {
    console.error('Error al generar credenciales en Google Sheets:', err);
    toast(`⚠️ No se pudo guardar en Google Sheets: ${err.message || 'Error de conexión'}. La selección se conservó para reintentar.`, true);
  } finally {
    setFamilyCredentialsBusy(false);
  }
}

function printSelectedFamilyAccess(){
  const rows = selectedFamilyAccessRows();
  if (!rows.length) return toast('Selecciona por lo menos un alumno.', true);
  let credentials = rows.map(familyCredentialFromRow).filter(Boolean);
  if (!credentials.length) {
    credentials = rows.map(row => {
      const a = row.account;
      return {
        studentId: row.student.id,
        studentName: row.student.name,
        username: a?.username || ('fam_' + (row.student.nombres || row.student.name || 'alumno').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)),
        password: a?.temporaryPassword || (a?.active ? '(Contraseña protegida)' : 'Sin contraseña activa'),
        expiresAt: a?.temporaryExpiresAt || 0
      };
    });
  }
  _officialFamilyPrint(credentials);
}

async function revokeSelectedFamilyAccess(){const ids=selectedFamilyAccessIds();if(!ids.length)return toast('Selecciona por lo menos un alumno.',true);if(!confirm(`Se revocará el acceso de ${ids.length} cuenta(s). Las fichas y los registros académicos se conservarán. ¿Continuar?`))return;await runAction(async()=>{const result=await server('revokeFamilyAccessBatch',ids);state.directory=await server('getDirectoryAdminData');state.directoryLoadedAt=Date.now();renderFamilyAccess();toast(result.message)})}
async function deleteSelectedStudents(){const rows=selectedFamilyAccessRows(),ids=rows.map(row=>String(row.student.id));if(!ids.length)return toast('Selecciona por lo menos un alumno.',true);const names=rows.slice(0,5).map(row=>'• '+row.student.name).join('\n')+(rows.length>5?`\n• y ${rows.length-5} más…`:'');if(!confirm(`Vas a eliminar definitivamente ${ids.length===1?'este alumno':'estos '+ids.length+' alumnos'}:\n\n${names}\n\nTambién se eliminarán sus asistencias, evaluaciones, calificaciones, directorio y accesos familiares. Esta acción no se puede deshacer. ¿Deseas continuar?`))return;const confirmation=prompt('Para confirmar la eliminación definitiva, escribe ELIMINAR:','');if(String(confirmation||'').trim().toUpperCase()!=='ELIMINAR')return toast('Eliminación cancelada. No se borró ningún alumno.',true);await runAction(async()=>{let result;try{result=await server('deleteStudentsBatch',ids)}catch(error){if(!/acción solicitada no está permitida/i.test(String(error.message||'')))throw error;for(const id of ids)await server('deleteStudent',id);result={message:ids.length===1?'El alumno y sus registros relacionados fueron eliminados definitivamente.':ids.length+' alumnos y sus registros relacionados fueron eliminados definitivamente.'}}const removed=new Set(ids);ids.forEach(id=>familyAccessSelection.delete(id));state.students=state.students.filter(student=>!removed.has(String(student.id)));if(state.directory)state.directory.rows=state.directory.rows.filter(row=>!removed.has(String(row.student.id)));state.stats.students=state.students.length;renderAll();renderFamilyAccess();toast(result.message)})}

function toggleFamilyAccessPassword(button){const target=$(`[data-family-password="${CSS.escape(String(button.dataset.id))}"]`);if(!target)return;const hidden=target.textContent.includes('•');target.textContent=hidden?button.dataset.password:'••••••••••';button.textContent=hidden?'Ocultar':'Ver'}

function openFamilyAccessAdmin(studentId){
  const row=(state.directory?.rows||[]).find(item=>String(item.student.id)===String(studentId));
  if(!row)return;
  currentFamilyAccessStudentId=String(studentId);
  const form=$('#familyAccessAdminForm'),a=row.account;
  form.elements.studentId.value=studentId;
  form.elements.email.value=a?.email||'';
  form.elements.phone.value=a?.phone||'';
  $('#familyAccessAdminStudent').textContent=row.student.name;
  
  const credHtml = !a?'<div class="credential-empty"><strong>Sin cuenta familiar</strong><span>Genera un usuario y una contraseña para comenzar.</span></div>':`<div><span>Usuario</span><strong>${escapeHtml(a.username||'—')}</strong></div><div><span>Contraseña</span><strong>${a.temporaryPassword?escapeHtml(a.temporaryPassword):a.accessRevoked?'Acceso revocado':'Contraseña personal protegida'}</strong></div><small>${a.temporaryPassword?(!a.temporaryExpiresAt||a.temporaryExpiresAt===0?'● Permanente (Sin caducidad)':`Válida hasta ${escapeHtml(formatCancunDateTime(a.temporaryExpiresAt))}`):'Las contraseñas personales nunca se muestran.'}</small>`;
  
  const waSection = a ? `
    <div id="familyAccessWhatsAppContainer" style="margin-top:12px;padding:10px 12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
        <div>
          <strong style="font-size:12px;color:#166534;display:block;">Restablecimiento asistido por WhatsApp</strong>
          <small style="font-size:11px;color:#15803d;">Enlace de un solo uso válido por 30 minutos</small>
        </div>
        <button type="button" class="btn small" style="background:#16a34a;color:#fff;border-color:#16a34a;font-weight:600;" data-action="prepare-family-whatsapp-reset">Enviar recuperación por WhatsApp</button>
      </div>
      <div id="familyWhatsAppStep2" class="hidden-control" style="margin-top:10px;padding-top:10px;border-top:1px dashed #86efac;"></div>
    </div>
  ` : '';

  $('#familyAccessAdminCredential').innerHTML = credHtml + waSection;
  $('#familyAccessAdminDialog').showModal();
}

function normalizeMexicanPhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('521')) {
    digits = digits.slice(3);
  } else if (digits.length === 12 && digits.startsWith('52')) {
    digits = digits.slice(2);
  }
  return digits.length === 10 ? digits : null;
}

async function prepareFamilyWhatsAppReset(studentId) {
  const row = (state.directory?.rows || []).find(item => String(item.student.id) === String(studentId));
  if (!row) return toast('No se encontró el alumno seleccionado.', true);

  const rawPhone = row.account?.phone || row.profile?.tutorTelefono || '';
  const phone10 = normalizeMexicanPhone(rawPhone);

  if (!phone10) {
    alert(
      '⚠️ No es posible preparar la recuperación por WhatsApp:\n\n' +
      'El alumno no cuenta con un número celular mexicano válido de 10 dígitos registrado.\n\n' +
      'Por favor actualiza el teléfono del tutor en la ficha familiar antes de continuar.'
    );
    return;
  }

  const last4 = phone10.slice(-4);
  const tutorName = row.profile?.tutorNombres ? `${row.profile.tutorNombres} (${row.profile.tutorParentesco || 'Tutor'})` : 'Tutor registrado';

  const confirmMsg = 
    `¿Deseas generar un enlace de recuperación para la familia de ${row.student.name}?\n\n` +
    `• Tutor: ${tutorName}\n` +
    `• Celular destino: •••••• ${last4}\n` +
    `• Vigencia: 30 minutos (un solo uso)\n\n` +
    `Al confirmar, se generará el enlace oficial y aparecerá el botón para abrir WhatsApp.`;

  if (!confirm(confirmMsg)) return;

  const step2Box = $('#familyWhatsAppStep2');
  if (step2Box) {
    step2Box.innerHTML = '<span class="muted" style="font-size:12px;">Generando enlace seguro en el servidor…</span>';
    step2Box.classList.remove('hidden-control');
  }

  try {
    const res = await server('generateFamilyReset', String(studentId));
    if (!res || !res.token) throw new Error(res?.message || 'No se recibió el token del servidor.');

    const resetUrl = siteBaseUrl() + '?familia=acceso&recuperar=' + encodeURIComponent(res.token);
    const message = 
      `Estimada familia:\n\n` +
      `Comparto el enlace oficial y seguro para restablecer la contraseña de su cuenta en el Portal Familiar de la Escuela Francisco Hoil Torres (4° A).\n\n` +
      `Vigencia: 30 minutos (un solo uso):\n` +
      `${resetUrl}\n\n` +
      `Al ingresar, elija su contraseña personal.`;

    const waLink = `https://wa.me/52${phone10}?text=${encodeURIComponent(message)}`;

    if (step2Box) {
      step2Box.innerHTML = `
        <div style="background:#fff;padding:8px 10px;border-radius:6px;border:1px solid #86efac;margin-bottom:8px;">
          <p style="margin:0 0 4px 0;font-size:12px;color:#166534;font-weight:600;">✓ Enlace oficial generado (vence en 30 minutos).</p>
          <p style="margin:0;font-size:11px;color:#4b5563;">Pulsa el botón para abrir el chat de WhatsApp y enviar el mensaje preparado manualmente:</p>
        </div>
        <button type="button" class="btn primary full-button" id="btnLaunchWhatsAppDirect" style="background:#25d366;border-color:#25d366;font-weight:bold;font-size:13px;padding:8px 14px;">
          💬 Abrir WhatsApp con mensaje preparado
        </button>
      `;
      step2Box.classList.remove('hidden-control');

      const btnLaunch = $('#btnLaunchWhatsAppDirect');
      if (btnLaunch) {
        btnLaunch.onclick = () => {
          const win = window.open(waLink, '_blank');
          if (!win || win.closed || typeof win.closed === 'undefined') {
            alert('El navegador bloqueó la apertura de WhatsApp. Permite las ventanas emergentes para este sitio y vuelve a pulsar Abrir WhatsApp.');
          } else {
            toast('✓ Se abrió WhatsApp. Pulsa Enviar en la ventana de chat.');
          }
        };
      }
    }
  } catch(err) {
    if (step2Box) {
      step2Box.innerHTML = `<span style="font-size:12px;color:#b91c1c;">⚠️ ${escapeHtml(err.message || 'Error al generar enlace.')}</span>`;
      step2Box.classList.remove('hidden-control');
    }
    toast(`⚠️ No fue posible generar el enlace: ${err.message || 'Error de conexión'}`, true);
  }
}
async function saveFamilyAccessRecovery(e){e.preventDefault();const form=e.currentTarget;if(!form.elements.studentId.value)return;await runAction(async()=>{const result=await server('saveFamilyRecoveryAdmin',form.elements.studentId.value,{email:form.elements.email.value,phone:form.elements.phone.value});state.directory=await server('getDirectoryAdminData');state.directoryLoadedAt=Date.now();renderFamilyAccess();openFamilyAccessAdmin(form.elements.studentId.value);toast(result.message)})}

async function regenerateCurrentFamilyAccess(){
  if(!currentFamilyAccessStudentId || _isFamilyCredentialsOperationBusy) return;
  if(!confirm('Se generará una contraseña nueva y la anterior dejará de funcionar para el tutor. ¿Continuar?')) return;
  setFamilyCredentialsBusy(true);
  try {
    await runAction(async () => {
      const result = await server('generateFamilyCredentials', currentFamilyAccessStudentId);
      if (!result || !result.password) {
        throw new Error('Google Sheets no confirmó la contraseña.');
      }
      state.familyCredentials = [result];
      applyFamilyCredentials(state.familyCredentials);
      renderFamilyAccess();
      openFamilyAccessAdmin(currentFamilyAccessStudentId);
      toast('✓ Contraseña guardada en Google Sheets.');
    });
  } catch(err) {
    console.error('Error al regenerar contraseña individual:', err);
    toast(`⚠️ Error al guardar en Google Sheets: ${err.message || 'Error de conexión'}.`, true);
  } finally {
    setFamilyCredentialsBusy(false);
  }
}

async function revokeCurrentFamilyAccess(){if(!currentFamilyAccessStudentId)return;if(!confirm('Se quitará la contraseña y se impedirá el acceso. Los datos del alumno se conservarán. ¿Continuar?'))return;await runAction(async()=>{const result=await server('revokeFamilyAccessBatch',[currentFamilyAccessStudentId]);state.directory=await server('getDirectoryAdminData');state.directoryLoadedAt=Date.now();renderFamilyAccess();openFamilyAccessAdmin(currentFamilyAccessStudentId);toast(result.message)})}
function printCurrentManagedFamilyAccess(){const row=(state.directory?.rows||[]).find(item=>String(item.student.id)===String(currentFamilyAccessStudentId));const credential=familyCredentialFromRow(row);if(!credential)return toast('No existe una contraseña visible para imprimir.',true);_officialFamilyPrint([credential])}

function directoryRowMatches(row,query,status){
  const p=row.profile||{},account=row.account,invitation=row.invitation;
  const text=[row.student.name,p.tutorApellidoPaterno,p.tutorApellidoMaterno,p.tutorNombres,p.tutorTelefono,account?.email,account?.username].join(' ').toLowerCase();
  if(query&&!text.includes(query))return false;
  if(status==='COMPLETO'&&!row.complete)return false;if(status==='PENDIENTE'&&row.complete)return false;
  if(status==='SIN_CUENTA'&&account)return false;if(status==='ACTIVA'&&(!account||!account.active))return false;if(status==='BLOQUEADA'&&(!account||account.active))return false;
  if(status==='INVITACION'&&invitation?.status!=='PENDIENTE')return false;if(status==='VENCIDA'&&invitation?.status!=='VENCIDA')return false;
  return true;
}
function renderDirectory(){
  if(!state.directory)return;const rows=state.directory.rows||[],query=$('#directorySearch').value.trim().toLowerCase(),status=$('#directoryStatus').value;
  const filtered=query.length>=2?rows.filter(row=>directoryRowMatches(row,query,status)):[];
  const complete=rows.filter(row=>row.complete).length,accounts=rows.filter(row=>row.account).length,pendingInvites=rows.filter(row=>row.invitation?.status==='PENDIENTE').length;
  $('#directoryStats').innerHTML=[['Alumnos',rows.length],['Fichas completas',complete],['Cuentas familiares',accounts],['Invitaciones vigentes',pendingInvites]].map(([label,value])=>`<div class="stat"><b>${value}</b><span>${escapeHtml(label)}</span></div>`).join('');
  $('#directoryList').innerHTML=query.length<2?'<div class="panel empty-history"><strong>Busca un alumno</strong><p>Escribe por lo menos dos letras del apellido o nombre; la lista no se muestra completa.</p></div>':filtered.length?filtered.map(directoryAdminCard).join(''):'<div class="panel empty-history"><strong>No hay resultados</strong><p>Cambia la búsqueda o el filtro.</p></div>';
}
function directoryAdminCard(row){
  const p=row.profile||{},account=row.account,invite=row.invitation;const tutor=[p.tutorApellidoPaterno,p.tutorApellidoMaterno,p.tutorNombres].filter(Boolean).join(' ')||'Tutor sin registrar';
  const accountBadge=account?`<span class="directory-state ${account.active?'success':'danger'}">${account.active?'Cuenta activa':'Cuenta bloqueada'}</span>`:`<span class="directory-state muted-state">Sin cuenta</span>`;
  const formBadge=`<span class="directory-state ${row.complete?'success':'warning'}">${row.complete?'Ficha completa':'Ficha pendiente'}</span>`;
  const inviteText=invite?invite.status==='PENDIENTE'?`Invitación vigente hasta ${escapeHtml(formatCancunDateTime(invite.expiresAt))}`:`Invitación ${escapeHtml(invite.status.toLowerCase())}`:'Sin invitación';
  const accessActions=account?`<button class="btn primary small" data-action="generate-family-credentials" data-id="${row.student.id}">Regenerar usuario y contraseña</button><button class="btn small" data-action="generate-family-reset" data-id="${row.student.id}">Crear enlace de recuperación</button><button class="btn small" data-action="toggle-family-account" data-id="${row.student.id}" data-active="${!account.active}">${account.active?'Bloquear cuenta':'Desbloquear cuenta'}</button>`:`<button class="btn primary small" data-action="generate-family-credentials" data-id="${row.student.id}">Crear usuario y contraseña</button><button class="btn small" data-action="generate-family-invite" data-id="${row.student.id}">Invitación con correo</button>${invite?.status==='PENDIENTE'?`<button class="btn small" data-action="revoke-family-invite" data-id="${row.student.id}">Cancelar invitación</button>`:''}`;
  return `<article class="directory-card"><div class="directory-card-main"><div class="directory-card-number">${escapeHtml(row.student.apellidoPaterno?.slice(0,1)||'A')}</div><div><h3>${escapeHtml(row.student.name)}</h3><p>${escapeHtml(tutor)}${p.tutorTelefono?' · '+escapeHtml(p.tutorTelefono):''}</p><small>${escapeHtml(inviteText)}</small></div></div><div class="directory-badges">${formBadge}${accountBadge}</div><div class="directory-actions">
    ${p.tutorTelefono ? `<button type="button" class="btn small" data-action="send-whatsapp-student" data-id="${row.student.id}" data-phone="${escapeHtml(p.tutorTelefono)}" data-name="${escapeHtml(row.student.name)}" style="background:#25D366;border-color:#25D366;color:#ffffff;font-weight:700;display:inline-flex;align-items:center;gap:4px;">💬 WhatsApp</button>` : ''}<button class="btn small" data-action="view-directory" data-id="${row.student.id}">Ver información</button><button class="btn small" data-action="edit-directory" data-id="${row.student.id}">Editar información</button><button class="btn small" data-action="print-directory-profile" data-id="${row.student.id}">Imprimir ficha</button>${accessActions}<button class="btn danger small" data-action="delete-family-access" data-id="${row.student.id}">Borrar datos familiares</button><button class="btn danger small" data-action="directory-delete-student" data-id="${row.student.id}">Eliminar alumno</button></div></article>`;
}
function directoryOption(value,current){return `<option ${String(value)===String(current)?'selected':''}>${escapeHtml(value)}</option>`}
function directoryFieldsHtml(data,family=false){
  const p=data.profile||{},contacts=data.contacts||[];const contact=(index)=>{const c=contacts[index]||{};return `<fieldset class="directory-contact"><legend>Persona de confianza ${index+1}${index?' (opcional)':''}</legend><input type="hidden" name="contact${index}Id" value="${escapeHtml(c.id||'')}"><div class="form-grid three"><label>Apellido paterno<input name="contact${index}ApellidoPaterno" value="${escapeHtml(c.apellidoPaterno||'')}"></label><label>Apellido materno<input name="contact${index}ApellidoMaterno" value="${escapeHtml(c.apellidoMaterno||'')}"></label><label>Nombre(s)<input name="contact${index}Nombres" value="${escapeHtml(c.nombres||'')}"></label></div><div class="form-grid two"><label>Parentesco<input name="contact${index}Parentesco" value="${escapeHtml(c.parentesco||'')}"></label><label>Teléfono<input name="contact${index}Telefono" inputmode="tel" value="${escapeHtml(c.telefono||'')}"></label></div></fieldset>`};
  return `<div class="directory-student-banner"><span>Datos del alumno</span><div class="form-grid three"><label>Apellido paterno<input name="alumnoApellidoPaterno" value="${escapeHtml(p.alumnoApellidoPaterno||'')}" required></label><label>Apellido materno<input name="alumnoApellidoMaterno" value="${escapeHtml(p.alumnoApellidoMaterno||'')}"></label><label>Nombre(s)<input name="alumnoNombres" value="${escapeHtml(p.alumnoNombres||'')}" required></label></div><small>Las correcciones se aplican al directorio; la lista académica conserva el nombre oficial.</small></div><h3>Tutor principal</h3><div class="form-grid three"><label>Apellido paterno<input name="tutorApellidoPaterno" value="${escapeHtml(p.tutorApellidoPaterno||'')}" required></label><label>Apellido materno<input name="tutorApellidoMaterno" value="${escapeHtml(p.tutorApellidoMaterno||'')}"></label><label>Nombre(s)<input name="tutorNombres" value="${escapeHtml(p.tutorNombres||'')}" required></label></div><div class="form-grid three"><label>Parentesco<select name="tutorParentesco" required><option value="">Selecciona</option>${['Madre','Padre','Abuela','Abuelo','Hermana','Hermano','Tutora','Tutor','Otro'].map(value=>directoryOption(value,p.tutorParentesco)).join('')}</select></label><label>Teléfono principal<input name="tutorTelefono" inputmode="tel" value="${escapeHtml(p.tutorTelefono||'')}" required></label><label>Teléfono alterno<input name="tutorTelefonoAlterno" inputmode="tel" value="${escapeHtml(p.tutorTelefonoAlterno||'')}"></label></div><h3>Domicilio</h3><div class="form-grid three"><label>Calle<input name="calle" value="${escapeHtml(p.calle||'')}"></label><label>Número exterior<input name="numeroExterior" value="${escapeHtml(p.numeroExterior||'')}"></label><label>Número interior<input name="numeroInterior" value="${escapeHtml(p.numeroInterior||'')}"></label></div><div class="form-grid three"><label>Entre calles<input name="entreCalles" value="${escapeHtml(p.entreCalles||'')}"></label><label>Fraccionamiento o colonia<input name="colonia" value="${escapeHtml(p.colonia||'')}"></label><label>Región o Supermanzana<input name="region" value="${escapeHtml(p.region||'')}"></label></div><div class="form-grid two"><label>Código postal<input name="codigoPostal" inputmode="numeric" value="${escapeHtml(p.codigoPostal||'')}"></label><label>Referencias del domicilio<input name="referencias" value="${escapeHtml(p.referencias||'')}"></label></div><h3>Personas autorizadas o de confianza</h3>${contact(0)+contact(1)+contact(2)}${family?'<div class="family-save"><button class="btn primary" type="submit">Guardar información</button></div>':''}`;
}
function directoryPayloadFromForm(form){const data=formData(form);data.contacts=[0,1,2].map(index=>({id:data[`contact${index}Id`]||'',apellidoPaterno:data[`contact${index}ApellidoPaterno`]||'',apellidoMaterno:data[`contact${index}ApellidoMaterno`]||'',nombres:data[`contact${index}Nombres`]||'',parentesco:data[`contact${index}Parentesco`]||'',telefono:data[`contact${index}Telefono`]||''}));return data}
function openDirectoryForm(studentId){const row=state.directory?.rows.find(item=>String(item.student.id)===String(studentId));if(!row)return;const viewDialog=$('#directoryViewDialog');if(viewDialog?.open)viewDialog.close();const form=$('#directoryForm');form.elements.studentId.value=row.student.id;$('#directoryDialogTitle').textContent=row.student.name;$('#directoryFormFields').innerHTML=directoryFieldsHtml(row);$('#directoryDialog').showModal()}
function viewDirectoryProfile(studentId){const row=state.directory?.rows.find(item=>String(item.student.id)===String(studentId));if(!row)return;$('#directoryViewContent').innerHTML=directoryProfileViewHtml(row);$('#directoryViewPrint').dataset.id=row.student.id;$('#directoryViewEdit').dataset.id=row.student.id;$('#directoryViewDialog').showModal()}
async function saveDirectoryForm(e){e.preventDefault();const payload=directoryPayloadFromForm(e.currentTarget);await runAction(async()=>{const result=await server('saveDirectoryProfile',payload);$('#directoryDialog').close();const index=state.directory.rows.findIndex(row=>String(row.student.id)===String(payload.studentId));if(index>=0){const old=state.directory.rows[index],data=result.data;state.directory.rows[index]=Object.assign({},old,{student:{id:old.student.id,name:[data.profile.alumnoApellidoPaterno,data.profile.alumnoApellidoMaterno,data.profile.alumnoNombres].filter(Boolean).join(' '),apellidoPaterno:data.profile.alumnoApellidoPaterno,apellidoMaterno:data.profile.alumnoApellidoMaterno,nombres:data.profile.alumnoNombres},profile:data.profile,contacts:data.contacts,complete:data.complete})}renderDirectory();renderDirectoryBuilder();toast(result.message)})}
async function generateGroupFamilyInvitation(){await runAction(async()=>{const result=await server('generateGroupInvitation');showDirectoryLink('Invitación grupal','Un solo enlace para las familias. Vence en 36 horas; cada familia debe confirmar los últimos cuatro dígitos del teléfono.',siteBaseUrl()+'?grupo='+encodeURIComponent(result.token));if(state.directory)state.directory.groupInvitation={expiresAt:result.expiresAt}})}
async function generateFamilyInvitation(studentId){await runAction(async()=>{const result=await server('generateFamilyInvitation',studentId);const link=siteBaseUrl()+'?familia='+encodeURIComponent(result.token);showDirectoryLink('Invitación familiar',result.studentName+' · El enlace vence en 36 horas y solo puede utilizarse una vez.',link);state.directory=await server('getDirectoryAdminData');renderDirectory()})}
async function revokeFamilyInvitation(studentId){if(!confirm('¿Cancelar la invitación vigente?'))return;await runAction(async()=>{const result=await server('revokeFamilyInvitation',studentId);state.directory=await server('getDirectoryAdminData');renderDirectory();toast(result.message)})}
async function generateFamilyReset(studentId){await runAction(async()=>{const result=await server('generateFamilyReset',studentId);showDirectoryLink('Restablecer contraseña','El enlace vence en 30 minutos y solo puede utilizarse una vez.',siteBaseUrl()+'?recuperar='+encodeURIComponent(result.token))})}

async function generateFamilyCredentials(studentId){
  if(_isFamilyCredentialsOperationBusy) return;
  const row = (state.directory?.rows || []).find(r => String(r.student.id) === String(studentId));
  const hasAccount = Boolean(row?.account?.username);
  const msg = hasAccount
    ? 'Se generará una contraseña nueva y la anterior dejará de funcionar para el tutor. ¿Continuar?'
    : 'Se creará un nuevo acceso familiar permanente para este alumno. ¿Continuar?';

  if(!confirm(msg)) return;
  setFamilyCredentialsBusy(true);
  try {
    await runAction(async () => {
      const result = await server('generateFamilyCredentials', studentId);
      if (!result || !result.password) {
        throw new Error('Google Sheets no confirmó la credencial.');
      }
      state.familyCredentials = [result];
      applyFamilyCredentials(state.familyCredentials);
      renderDirectory();
      renderFamilyAccess();
      openFamilyAccessAdmin(studentId);
      toast('✓ Credencial guardada en Google Sheets.');
    });
  } catch(err) {
    console.error('Error al generar credencial individual:', err);
    toast(`⚠️ Error al guardar en Google Sheets: ${err.message || 'Error de conexión'}.`, true);
  } finally {
    setFamilyCredentialsBusy(false);
  }
}

function showDirectoryLink(title,description,link,printable=false){$('#directoryLinkTitle').textContent=title;$('#directoryLinkDescription').textContent=description;$('#directoryLinkValue').value=link;$('#directoryCredentialPrint').classList.toggle('hidden-control',!printable);$('#directoryLinkDialog').showModal()}
async function copyDirectoryLink(){const input=$('#directoryLinkValue');try{await navigator.clipboard.writeText(input.value);toast('Enlace copiado.')}catch(e){input.select();document.execCommand('copy');toast('Enlace copiado.')}}
async function setFamilyAccountActive(studentId,active){if(!confirm(active?'¿Desbloquear esta cuenta familiar?':'¿Bloquear esta cuenta familiar?'))return;await runAction(async()=>{const result=await server('setFamilyAccountActive',studentId,active);state.directory=await server('getDirectoryAdminData');state.directoryLoadedAt=Date.now();renderDirectory();renderFamilyAccess();toast(result.message)})}
async function deleteFamilyAccess(studentId){if(!confirm('¿Borrar la cuenta y toda la ficha familiar? El alumno permanecerá en el grupo.'))return;await runAction(async()=>{const result=await server('deleteFamilyAccess',studentId);state.directory=await server('getDirectoryAdminData');renderDirectory();renderDirectoryBuilder();toast(result.message)})}
async function deleteDirectoryStudent(studentId){if(!confirm('¿Eliminar definitivamente al alumno, su directorio, asistencia y evaluaciones? Esta acción no se puede deshacer.'))return;await runAction(async()=>{const id=String(studentId),result=await server('deleteStudent',id);state.students=state.students.filter(student=>String(student.id)!==id);if(state.directory)state.directory.rows=state.directory.rows.filter(row=>String(row.student.id)!==id);state.stats.students=state.students.length;renderAll();renderDirectory();renderDirectoryBuilder();showView('directory');toast(result.message)})}
function toggleDirectoryReport(){$('#directoryReportBuilder').classList.toggle('hidden-control')}
function renderDirectoryBuilder(){if(!state.directory)return;$('#directoryStudentChecks').innerHTML=state.directory.rows.map(row=>`<label><input type="checkbox" data-directory-student value="${row.student.id}" checked> ${escapeHtml(row.student.name)}</label>`).join('')}
function setDirectorySelection(checked){$$('[data-directory-student]').forEach(input=>input.checked=checked)}
function directoryAddress(profile){return [profile.calle,profile.numeroExterior&&'Núm. '+profile.numeroExterior,profile.numeroInterior&&'Int. '+profile.numeroInterior,profile.entreCalles&&'entre '+profile.entreCalles,profile.colonia,profile.region&&'Región/SM '+profile.region,profile.codigoPostal&&'C.P. '+profile.codigoPostal,profile.referencias].filter(Boolean).join(', ')}
function directoryContactValue(contact){return contact?[[contact.apellidoPaterno,contact.apellidoMaterno,contact.nombres].filter(Boolean).join(' '),contact.parentesco,contact.telefono].filter(Boolean).join(' · '):'—'}
function directoryProfileViewHtml(row){
  const p=row.profile||{},contacts=row.contacts||[];
  const tutor=[p.tutorApellidoPaterno,p.tutorApellidoMaterno,p.tutorNombres].filter(Boolean).join(' ')||'Sin registrar';
  const initial=(row.student.apellidoPaterno||row.student.name||'A').trim().charAt(0).toUpperCase();
  const contactCards=[0,1,2].map(index=>{
    const contact=contacts[index]||{};
    const name=[contact.apellidoPaterno,contact.apellidoMaterno,contact.nombres].filter(Boolean).join(' ');
    const contactInitial=(contact.nombres||contact.apellidoPaterno||String(index+1)).trim().charAt(0).toUpperCase();
    const phoneHref=contact.telefono?`href="tel:${escapeHtml(contact.telefono.replace(/\s/g,''))}"`:'';
    return `<article class="trusted-person-card ${name?'':'is-empty'}"><span class="trusted-avatar">${escapeHtml(contactInitial)}</span><div><h4>${escapeHtml(name||'Sin registrar')}</h4><p>${escapeHtml(contact.parentesco||'Persona de confianza')}</p><a ${phoneHref}>${contact.telefono?'☎ '+escapeHtml(contact.telefono):'Teléfono no registrado'}</a></div></article>`;
  }).join('');
  return `<section class="directory-view-hero"><button type="button" class="directory-view-close" aria-label="Cerrar" data-close="directoryViewDialog">×</button><div class="directory-view-eyebrow">DIRECTORIO FAMILIAR</div><div class="directory-view-identity"><span class="directory-view-avatar">${escapeHtml(initial)}</span><div><h2>${escapeHtml(row.student.name)}</h2><p>4° A · Ciclo 2026–2027</p><span class="directory-complete-badge ${row.complete?'':'pending'}">${row.complete?'✓ Ficha completa':'! Ficha pendiente'}</span></div></div></section><div class="directory-view-body"><div class="directory-view-summary"><article class="directory-info-card"><div class="directory-info-title"><span class="directory-info-icon">♟</span><h3>Tutor principal</h3></div><dl><dt>Nombre</dt><dd>${escapeHtml(tutor)}</dd><dt>Parentesco</dt><dd>${escapeHtml(p.tutorParentesco||'—')}</dd><dt>Teléfono</dt><dd>${escapeHtml(p.tutorTelefono||'—')}</dd><dt>Teléfono alterno</dt><dd>${escapeHtml(p.tutorTelefonoAlterno||'—')}</dd></dl></article><article class="directory-info-card"><div class="directory-info-title"><span class="directory-info-icon">⌖</span><h3>Domicilio</h3></div><p class="directory-address">${escapeHtml(directoryAddress(p)||'Domicilio no registrado')}</p></article></div><section class="trusted-people"><div class="directory-info-title"><span class="directory-info-icon">♟</span><div><h3>Personas autorizadas</h3><p>Personas que pueden recoger al alumno(a)</p></div></div><div class="trusted-person-grid">${contactCards}</div></section></div>`;
}
function selectedDirectoryRows(){const selected=new Set($$('[data-directory-student]:checked').map(input=>input.value));return (state.directory?.rows||[]).filter(row=>selected.has(String(row.student.id)))}
function selectedDirectoryFields(){return new Set($$('#directoryFieldChecks input:checked').map(input=>input.value))}
function directoryReportHtml(rows,fields){
  const columns=[];if(fields.has('student'))columns.push(['Alumno',row=>row.student.name]);if(fields.has('tutor'))columns.push(['Tutor',row=>[row.profile.tutorApellidoPaterno,row.profile.tutorApellidoMaterno,row.profile.tutorNombres].filter(Boolean).join(' ')||'—']);if(fields.has('relation'))columns.push(['Parentesco',row=>row.profile.tutorParentesco||'—']);if(fields.has('phone'))columns.push(['Teléfono',row=>row.profile.tutorTelefono||'—']);if(fields.has('alternatePhone'))columns.push(['Teléfono alterno',row=>row.profile.tutorTelefonoAlterno||'—']);if(fields.has('address'))columns.push(['Domicilio',row=>directoryAddress(row.profile)||'—']);[1,2,3].forEach(number=>{if(fields.has('contact'+number))columns.push(['Persona de confianza '+number,row=>directoryContactValue(row.contacts[number-1])])});
  if(!columns.length)return '<p>Selecciona por lo menos un dato.</p>';return `<div class="directory-print-head"><h1>Directorio familiar 4°A</h1><p>Escuela Primaria Francisco Hoil Torres T.V. · Ciclo 2026-2027</p></div><table class="directory-print-table"><thead><tr><th>Núm.</th>${columns.map(column=>`<th>${escapeHtml(column[0])}</th>`).join('')}</tr></thead><tbody>${rows.map((row,index)=>`<tr><td>${index+1}</td>${columns.map(column=>`<td>${escapeHtml(column[1](row))}</td>`).join('')}</tr>`).join('')}</tbody></table>`
}
function previewDirectoryReport(){const rows=selectedDirectoryRows();if(!rows.length)return toast('Selecciona por lo menos un alumno.',true);const preview=$('#directoryReportPreview');preview.innerHTML=directoryReportHtml(rows,selectedDirectoryFields());preview.classList.remove('hidden-control');preview.scrollIntoView({behavior:'smooth'})}
function printHtmlDocument(content,orientation='portrait'){const popup=window.open('','_blank');if(!popup)return toast('Permite las ventanas emergentes para imprimir.',true);popup.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Carpeta Académica</title><style>@page{size:letter ${orientation};margin:10mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#102a43;font-size:9px;margin:0}h1{font-size:18px;margin:0 0 3px}h2{font-size:13px;margin:8px 0}p{margin:0 0 10px;color:#65798b}table{border-collapse:collapse;width:100%}th,td{border:1px solid #9fb1bd;padding:4px;vertical-align:top}th{background:#0b315d;color:#fff}.profile-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.profile-box{border:1px solid #c6d4dd;border-radius:8px;padding:10px}.profile-box h2{font-size:13px;margin:0 0 6px}.profile-box p{margin:3px 0;color:#102a43}.grade-print-page{break-after:page;page-break-after:always;min-height:185mm}.grade-print-page:last-child{break-after:auto;page-break-after:auto}.grade-print-head{border-bottom:2px solid #0b315d;margin-bottom:7px}.grade-foot{margin-top:6px;font-size:8px}.no-print{display:none!important}</style></head><body>${content}</body></html>`);popup.document.close();popup.focus();setTimeout(()=>popup.print(),400)}
function printDirectoryReport(){const rows=selectedDirectoryRows();if(!rows.length)return toast('Selecciona por lo menos un alumno.',true);printHtmlDocument(directoryReportHtml(rows,selectedDirectoryFields()),$('#directoryOrientation').value)}
function directoryProfilePrintHtml(row){const p=row.profile||{};const contacts=row.contacts||[];const tutor=[p.tutorApellidoPaterno,p.tutorApellidoMaterno,p.tutorNombres].filter(Boolean).join(' ')||'Sin registrar';return `<h1>Ficha familiar</h1><p>${escapeHtml(row.student.name)} · 4°A · Ciclo 2026-2027</p><div class="profile-grid"><div class="profile-box"><h2>Tutor principal</h2><p><b>Nombre:</b> ${escapeHtml(tutor)}</p><p><b>Parentesco:</b> ${escapeHtml(p.tutorParentesco||'—')}</p><p><b>Teléfono:</b> ${escapeHtml(p.tutorTelefono||'—')}</p><p><b>Teléfono alterno:</b> ${escapeHtml(p.tutorTelefonoAlterno||'—')}</p></div><div class="profile-box"><h2>Domicilio</h2><p>${escapeHtml(directoryAddress(p)||'Sin registrar')}</p></div>${[0,1,2].map(index=>`<div class="profile-box"><h2>Persona de confianza ${index+1}</h2><p>${escapeHtml(directoryContactValue(contacts[index]))}</p></div>`).join('')}</div>`}
function printDirectoryProfile(studentId){const row=state.directory?.rows.find(item=>String(item.student.id)===String(studentId));if(row)printHtmlDocument(directoryProfilePrintHtml(row),'portrait')}

// ==========================================================================
// LOGO ESCOLAR OFICIAL EN BASE64 (DATA URI EN MEMORIA PARA IMPRESIÓN ROBUSTA)
// ==========================================================================
const SCHOOL_LOGO_DATA_URI = 'data:image/webp;base64,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';

// Función auxiliar para formatear nombres largos en dos renglones de forma determinista y balanceada
// ==========================================================================
// FUNCIÓN OFICIAL DE IMPRESIÓN DE CREDENCIALES (10 POR HOJA CARTA)
// ==========================================================================
var _officialFamilyPrint = function(credentials){
  const rows = Array.isArray(credentials) ? credentials.filter(item => item && item.password) : [];
  if (!rows.length) return toast('Primero genera una contraseña. Por seguridad, las contraseñas anteriores no se pueden volver a mostrar.', true);

  const popup = window.open('', '_blank');
  if (!popup) return toast('Permite las ventanas emergentes para imprimir.', true);

  const accessUrl = siteBaseUrl() + '?familia=acceso';
  const school = state.config?.escuela || 'Escuela Primaria Francisco Hoil Torres T.V.';
  const gradoGrupo = state.config?.gradoGrupo || '4.º A';
  const cicloEscolar = state.config?.cicloEscolar || '2026–2027';

  // Generar QR dinámico coincidente con la URL escrita o usar recurso oficial
  let qrSource = new URL('family-access-qr.svg', location.href).href;
  const dynamicSvg = generateFamilyQrSvg(accessUrl);
  if (dynamicSvg) {
    qrSource = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(dynamicSvg);
  }

  const cards = rows.map(item => {
    const usernameLength = String(item.username || '').length;
    const usernameClass = usernameLength > 24 ? ' very-long' : usernameLength > 19 ? ' long' : usernameLength > 15 ? ' medium' : '';

    const isPermanent = !item.expiresAt || Number(item.expiresAt) === 0;
    const expiryText = isPermanent
      ? '● Permanente · Sin caducidad'
      : ('Temporal hasta ' + escapeHtml(formatCancunDate(item.expiresAt)));

    return `
      <article class="credential" data-student="${escapeHtml(item.studentName)}">
        <div class="credential-title">ACCESO FAMILIAR</div>
        <header>
          <img src="${SCHOOL_LOGO_DATA_URI}" alt="" onerror="this.style.display='none'">
          <div>
            <b>${escapeHtml(school)}</b>
            <small>${escapeHtml(gradoGrupo)} · Ciclo escolar ${escapeHtml(cicloEscolar)}</small>
          </div>
        </header>
        <div class="student-name-row">
          <h2 class="student-name" data-raw-name="${escapeHtml(item.studentName)}">${escapeHtml(item.studentName)}</h2>
        </div>
        <div class="credential-body">
          <div class="credential-access">
            <label>USUARIO</label>
            <strong class="${usernameClass}">${escapeHtml(item.username)}</strong>
            <label>${isPermanent ? 'CONTRASEÑA' : 'CONTRASEÑA TEMPORAL'}</label>
            <strong class="password">${escapeHtml(item.password)}</strong>
            <small class="credential-expiry ${isPermanent ? 'permanent' : ''}">${expiryText}</small>
          </div>
          <div class="credential-divider"></div>
          <figure>
            <img src="${escapeHtml(qrSource)}" alt="Código QR de acceso">
            <figcaption>Escanea para entrar</figcaption>
          </figure>
        </div>
      </article>
    `;
  });

  const pages = [];
  for (let index = 0; index < cards.length; index += 10) {
    pages.push(`<section class="credential-sheet">${cards.slice(index, index + 10).join('')}</section>`);
  }

  popup.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Credenciales familiares</title><style>
    @page { size: letter portrait; margin: 4.5mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      background: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #0b315d;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .credential-sheet {
      width: 206.9mm;
      height: 268mm;
      display: grid;
      grid-template-columns: 102.5mm 102.5mm;
      grid-template-rows: repeat(5, 52.5mm);
      column-gap: 1.9mm;
      row-gap: 1.2mm;
      break-after: page;
      page-break-after: always;
      box-sizing: border-box;
    }
    .credential-sheet:last-child {
      break-after: auto;
      page-break-after: auto;
    }
    .credential {
      width: 102.5mm;
      height: 52.5mm;
      border: 1.2px dashed #009aa6;
      border-radius: 2.8mm;
      padding: 0.8mm 2.2mm 1.0mm 2.2mm;
      overflow: hidden;
      background: #fff;
      display: grid;
      grid-template-rows: 3.8mm 9.8mm minmax(6.8mm, auto) 1fr;
      box-sizing: border-box;
    }
    .credential-title {
      height: 3.8mm;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 1.4mm;
      background: #009ca6;
      color: #fff;
      font-size: 8.2pt;
      font-weight: 900;
      letter-spacing: .55px;
      margin-bottom: 0.4mm;
    }
    .credential header {
      height: 9.8mm;
      display: flex;
      align-items: center;
      gap: 1.8mm;
      padding: 0 0.3mm;
      margin-bottom: 0.4mm;
    }
    .credential header img {
      width: 9.8mm;
      height: 9.8mm;
      object-fit: contain;
      flex-shrink: 0;
    }
    .credential header div {
      min-width: 0;
      flex: 1;
    }
    .credential header b {
      display: block;
      font-size: 7.4pt;
      line-height: 1.15;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: #0b315d;
      font-weight: 900;
    }
    .credential header small {
      display: block;
      font-size: 6.2pt;
      line-height: 1.1;
      margin-top: .2mm;
      color: #4e6f7b;
      font-weight: 700;
    }
    .student-name-row {
      grid-column: 1 / -1;
      width: 100%;
      display: flex;
      align-items: center;
      margin-bottom: 1.2mm;
      min-height: 5.6mm;
      box-sizing: border-box;
    }
    .student-name {
      display: block;
      width: 100%;
      max-width: none;
      min-width: 0;
      grid-column: 1 / -1;
      white-space: nowrap;
      overflow: visible;
      text-overflow: clip;
      box-sizing: border-box;
      font-size: 12.0pt;
      line-height: 1.08;
      font-weight: 900;
      color: #0b315d;
      margin: 0;
      padding: 0;
    }
    .student-name.two-lines {
      white-space: normal;
      line-height: 1.04;
      word-break: normal;
      overflow-wrap: break-word;
    }
    .credential-body {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 1px 29.0mm;
      gap: 1.2mm;
      align-items: center;
      background: #edf7f8;
      border-radius: 2.0mm;
      padding: 0.5mm 1.2mm 0.5mm 1.4mm;
      box-sizing: border-box;
      min-height: 0;
    }
    .credential-access {
      min-width: 0;
      align-self: stretch;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding-right: 0.2mm;
    }
    .credential-body label {
      display: block;
      font-size: 5.5pt;
      line-height: 1;
      color: #4e6f7b;
      font-weight: 900;
      letter-spacing: .25px;
    }
    .credential-body strong {
      display: block;
      font-size: 12.2pt;
      line-height: 1.04;
      margin: .15mm 0 0.7mm;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: #0b315d;
      font-weight: 900;
    }
    .credential-body strong.medium { font-size: 11.0pt; }
    .credential-body strong.long { font-size: 9.8pt; }
    .credential-body strong.very-long { font-size: 8.6pt; }
    .credential-body strong.password {
      font-size: 13.0pt;
      letter-spacing: .25px;
      margin-bottom: 0;
    }
    .credential-expiry {
      display: block;
      font-size: 5.2pt;
      color: #ca6f00;
      margin-top: .3mm;
      font-weight: 800;
      line-height: 1;
    }
    .credential-expiry.permanent {
      color: #0f766e;
      font-weight: 800;
    }
    .credential-divider {
      width: 1px;
      height: 86%;
      background: #bce1e5;
      margin: 0;
      align-self: center;
    }
    .credential figure {
      margin: 0;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .credential figure img {
      width: 25.0mm;
      height: 25.0mm;
      display: block;
      margin: auto;
    }
    .credential figcaption {
      font-size: 5.0pt;
      line-height: 1;
      color: #1e3a5f;
      margin-top: .3mm;
      font-weight: 800;
      white-space: nowrap;
    }
    @media print {
      body { background: #fff; }
    }
  </style></head><body>${pages.join('')}<script>
  (async function() {
    function autoFitAllStudentNames() {
      const names = document.querySelectorAll('.student-name');
      names.forEach(function(el) {
        const rawText = el.getAttribute('data-raw-name') || el.textContent.trim();
        el.textContent = rawText;
        el.classList.remove('two-lines');
        el.style.whiteSpace = 'nowrap';

        let currentPt = 12.0;
        const minPt = 9.0;
        const step = 0.25;

        let fits = false;
        while (currentPt >= minPt) {
          el.style.fontSize = currentPt + 'pt';
          if (el.scrollWidth < el.clientWidth || (el.scrollWidth === el.clientWidth && el.getBoundingClientRect().width <= el.clientWidth)) {
            const range = document.createRange();
            range.selectNodeContents(el);
            const rect = range.getBoundingClientRect();
            if (rect.width <= el.clientWidth) {
              fits = true;
              break;
            }
          }
          currentPt = Math.round((currentPt - step) * 100) / 100;
        }

        if (!fits) {
          el.classList.add('two-lines');
          el.style.whiteSpace = 'normal';

          const words = rawText.split(/\s+/);
          if (words.length > 1) {
            const targetMid = rawText.length / 2;
            let bestIndex = 1;
            let bestDiff = Infinity;
            let currentLen = 0;
            for (let i = 0; i < words.length - 1; i++) {
              currentLen += words[i].length + (i > 0 ? 1 : 0);
              const diff = Math.abs(currentLen - targetMid);
              if (diff < bestDiff) {
                bestDiff = diff;
                bestIndex = i + 1;
              }
            }
            const line1 = words.slice(0, bestIndex).join(' ');
            const line2 = words.slice(bestIndex).join(' ');
            el.innerHTML = line1 + '<br>' + line2;
          }

          let twoLinePt = 10.0;
          el.style.fontSize = twoLinePt + 'pt';
          while (twoLinePt > 9.0 && el.scrollWidth > el.clientWidth) {
            twoLinePt = Math.round((twoLinePt - step) * 100) / 100;
            el.style.fontSize = twoLinePt + 'pt';
          }
        }
      });
    }

    autoFitAllStudentNames();

    let hasPrinted = false;
    function triggerPrint() {
      if (hasPrinted) return;
      hasPrinted = true;
      window.focus();
      window.print();
    }
    const fallbackTimer = setTimeout(triggerPrint, 2500);
    try {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      autoFitAllStudentNames();
      const images = Array.from(document.images);
      const imagePromises = images.map(function(img) {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        if (typeof img.decode === 'function') {
          return img.decode().catch(function() {});
        }
        return new Promise(function(resolve) {
          img.onload = resolve;
          img.onerror = resolve;
        });
      });
      await Promise.allSettled(imagePromises);
    } catch(e) {}
    clearTimeout(fallbackTimer);
    requestAnimationFrame(function() {
      setTimeout(triggerPrint, 60);
    });
  })();
  </script></body></html>`);

  popup.document.close();
};

window._officialFamilyPrint = _officialFamilyPrint;
window.officialPrintFamilyCredentials = _officialFamilyPrint;
window.printFamilyCredentials = _officialFamilyPrint;
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    window.printFamilyCredentials = _officialFamilyPrint;
  });
}

const RECOVERY_STORAGE_KEY = 'carpeta_academica_family_reset_token';

function showFamilyPanel(id){
  ['familyInvitationPanel','familyGroupPanel','familyLoginPanel','familyForgotPanel','familyResetPanel','familyOnboardingPanel','familyAppPanel'].forEach(panel=>$('#'+panel).classList.toggle('hidden-control',panel!==id));
  $('#familyMessage').classList.add('hidden-control');
  if (id === 'familyLoginPanel') {
    sessionStorage.removeItem(RECOVERY_STORAGE_KEY);
    familyResetToken = '';
  }
}
function familyMessage(message,error=false){const box=$('#familyMessage');box.textContent=message;box.classList.remove('hidden-control');box.classList.toggle('family-error',error)}

function loadDemoScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) return resolve();
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar ' + src));
    document.head.appendChild(script);
  });
}

async function startFamilyPortal(){
  document.body.classList.add('family-mode');
  $('#app').classList.add('hidden-control');
  $('#familyPortal').classList.remove('hidden-control');
  setLoading(false);
  try{
    const urlParams = new URLSearchParams(location.search);
    const isDemo = urlParams.get('familia') === 'demo';
    const isLocalHost = ['localhost', '127.0.0.1'].includes(location.hostname);

    if (isDemo) {
      if (!isLocalHost) {
        console.warn('[SEGURIDAD] Modo demostración bloqueado en dominio no local.');
        history.replaceState({}, '', siteBaseUrl() + '?familia=acceso');
        familyInvitationToken = 'acceso';
        showFamilyPanel('familyLoginPanel');
        familyMessage('El modo demostración solamente está disponible en el entorno local (localhost).', true);
        return;
      }

      setLoading(true, 'Cargando modo demostración local…');
      try {
        if (!window.__familyDemoLoaded) {
          await loadDemoScript('js/demo/family-portal-fixture.js');
          await loadDemoScript('js/demo/family-portal-demo.js');
          window.__familyDemoLoaded = true;
        }
        setLoading(false);
        if (typeof window.initFamilyPortalDemo === 'function') {
          window.initFamilyPortalDemo();
        }
      } catch (err) {
        setLoading(false);
        showFamilyPanel('familyLoginPanel');
        familyMessage('Error al cargar los archivos de demostración: ' + (err.message || err), true);
      }
      return;
    }

    // En producción o acceso normal, asegurar que ningún modo ni fixture demo permanezca activo
    window.__familyDemoActive = false;
    try {
      delete window.FAMILY_PORTAL_DEMO_FIXTURE;
    } catch (_) {
      window.FAMILY_PORTAL_DEMO_FIXTURE = undefined;
    }

    const resetParam = urlParams.get('recuperar') || '';
    if (resetParam) {
      sessionStorage.setItem(RECOVERY_STORAGE_KEY, resetParam);
      familyResetToken = resetParam;
      history.replaceState({}, '', siteBaseUrl() + '?familia=acceso');
    } else {
      familyResetToken = sessionStorage.getItem(RECOVERY_STORAGE_KEY) || familyResetToken || '';
    }

    if(familyResetToken){
      try {
        const result = await apiRequest('validateFamilyReset', [familyResetToken], '');
        $('#familyResetStudent').textContent = 'Cuenta de ' + result.studentName;
        showFamilyPanel('familyResetPanel');
        return;
      } catch (err) {
        sessionStorage.removeItem(RECOVERY_STORAGE_KEY);
        familyResetToken = '';
        showFamilyPanel('familyLoginPanel');
        familyMessage(err.message || 'El enlace de recuperación no es válido o ya fue utilizado.', true);
        return;
      }
    }
    if(familyGroupToken){await apiRequest('validateGroupInvitation',[familyGroupToken],'');showFamilyPanel('familyGroupPanel');return}
    if(familyInvitationToken&&familyInvitationToken!=='acceso'){const result=await apiRequest('validateFamilyInvitation',[familyInvitationToken],'');$('#familyInvitationStudent').textContent='Crearás el acceso para '+result.student.name+'. La invitación vence el '+formatCancunDateTime(result.expiresAt)+'.';showFamilyPanel('familyInvitationPanel');return}
    if(familySessionToken){await loadFamilyProfile();return}
    showFamilyPanel('familyLoginPanel');
    const logoutMessage=sessionStorage.getItem('family_logout_message');
    if(logoutMessage){sessionStorage.removeItem('family_logout_message');familyMessage(logoutMessage)}
  }catch(error){
    showFamilyPanel('familyLoginPanel');
    familyMessage(error.message,true);
  }
}
let groupSearchTimer=0;function searchGroupStudents(){clearTimeout(groupSearchTimer);const query=$('#familyGroupSearch').value.trim();$('#familyGroupRegisterForm').classList.add('hidden-control');if(query.length<2){$('#familyGroupResults').innerHTML='';return}groupSearchTimer=setTimeout(async()=>{try{const rows=await apiRequest('searchGroupStudents',[familyGroupToken,query],'');$('#familyGroupResults').innerHTML=rows.length?rows.map(row=>`<button type="button" class="group-student-choice" data-action="select-group-student" data-id="${escapeHtml(row.id)}" data-name="${encodeURIComponent(row.name)}"><strong>${escapeHtml(row.name)}</strong><small>${row.hasPhone?'Teléfono registrado':'Requiere invitación individual'}</small></button>`).join(''):'<p class="muted">No hay coincidencias disponibles.</p>'}catch(error){familyMessage(error.message,true)}},350)}
function selectGroupStudent(id,name){const form=$('#familyGroupRegisterForm');form.elements.studentId.value=id;$('#familyGroupStudent').textContent='Cuenta para '+name;form.classList.remove('hidden-control');form.scrollIntoView({behavior:'smooth'})}
async function registerGroupFamilyAccount(e){e.preventDefault();const payload=formData(e.currentTarget);payload.groupToken=familyGroupToken;familyMessage('Creando la cuenta…');try{const result=await apiRequest('registerGroupFamilyAccount',[payload],'');storeFamilySession(result.token,false);familyGroupToken='';history.replaceState({},'',siteBaseUrl()+'?familia=acceso');await loadFamilyProfile()}catch(error){familyMessage(error.message,true)}}
async function registerFamilyAccount(e){e.preventDefault();const payload=formData(e.currentTarget);payload.invitationToken=familyInvitationToken;familyMessage('Creando la cuenta…');try{const result=await apiRequest('registerFamilyAccount',[payload],'');storeFamilySession(result.token,false);familyInvitationToken='';history.replaceState({},'',siteBaseUrl()+'?familia=acceso');await loadFamilyProfile()}catch(error){familyMessage(error.message,true)}}
async function familyLogin(e){e.preventDefault();const form=e.currentTarget,data=formData(form),remember=Boolean(form.elements.remember?.checked);familyMessage('Comprobando el acceso…');try{const result=await apiRequest('familyLogin',[data.email,data.password],'');storeFamilySession(result.token,remember);await loadFamilyProfile()}catch(error){familyMessage(error.message,true)}}
async function requestFamilyReset(e){e.preventDefault();const data=formData(e.currentTarget);familyMessage('Enviando el enlace…');try{const result=await apiRequest('requestFamilyPasswordReset',[data.email],'');familyMessage(result.message);showFamilyPanel('familyLoginPanel');familyMessage(result.message)}catch(error){familyMessage(error.message,true)}}

function validateFamilyPasswordClient(password, confirmation) {
  const value = String(password || '');
  if (value.length < 10) return 'La contraseña debe tener al menos 10 caracteres.';
  if (!/[A-ZÁÉÍÓÚÑ]/.test(value) || !/[a-záéíóúñ]/.test(value) || !/\d/.test(value) || !/[^A-Za-zÁÉÍÓÚáéíóúÑñ0-9]/.test(value)) {
    return 'La contraseña debe incluir mayúscula, minúscula, número y símbolo.';
  }
  if (confirmation !== undefined && value !== String(confirmation || '')) return 'Las contraseñas no coinciden.';
  return null;
}

async function saveFamilyReset(e){
  e.preventDefault();
  const form = e.currentTarget;
  const password = form.elements.password.value;
  const passwordConfirmation = form.elements.passwordConfirmation.value;

  const valError = validateFamilyPasswordClient(password, passwordConfirmation);
  if (valError) {
    return familyMessage(valError, true);
  }

  familyMessage('Guardando la contraseña…');
  try{
    const payload = {
      resetToken: familyResetToken,
      password: password,
      passwordConfirmation: passwordConfirmation
    };
    const result = await apiRequest('resetFamilyPassword', [payload], '');
    sessionStorage.removeItem(RECOVERY_STORAGE_KEY);
    familyResetToken = '';
    form.reset();
    showFamilyPanel('familyLoginPanel');
    familyMessage(result.message);
  }catch(error){
    if (/no es válido|ya fue utilizado|venció|cancelad/i.test(String(error.message || ''))) {
      sessionStorage.removeItem(RECOVERY_STORAGE_KEY);
      familyResetToken = '';
    }
    familyMessage(error.message, true);
  }
}
async function loadFamilyProfile(){setLoading(true,'Cargando el avance académico…',()=>loadFamilyProfile());try{resetFamilyIdleTimer();familyMessage('Consultando el avance académico…');const period={type:$('#familyPeriodType')?.value||'trimester',trimester:Number($('#familyTrimester')?.value||1),reference:''};try{familyPortalData=await familyServer('getFamilyPortalInitialData',period)}catch(error){if(!/acción familiar solicitada no está permitida/i.test(String(error.message||'')))throw error;familyPortalData=await familyServer('getFamilyPortalData',period.trimester)}renderFamilyPortal();showFamilyPanel('familyAppPanel')}catch(error){familySessionToken='';localStorage.removeItem(FAMILY_SESSION_KEY);sessionStorage.removeItem(FAMILY_SESSION_KEY);showFamilyPanel('familyLoginPanel');familyMessage(error.message,true)}finally{setLoading(false)}}
function renderFamilyOnboarding(){const data=familyPortalData,form=$('#familyOnboardingForm'),account=data.account||{};$('#familyOnboardingStudent').textContent=data.student.name;form.elements.username.value=account.username||'';form.elements.email.value=account.email||'';form.elements.phone.value=account.phone||data.profile?.tutorTelefono||'';form.elements.password.value='';form.elements.passwordConfirmation.value='';form.elements.password.required=Boolean(account.mustChangePassword);form.elements.passwordConfirmation.required=Boolean(account.mustChangePassword);form.elements.password.closest('label').firstChild.textContent=account.mustChangePassword?'Nueva contraseña personal':'Nueva contraseña (opcional)';$('#familyOnboardingFields').innerHTML=directoryFieldsHtml(data,false)}
async function completeFamilyOnboarding(e){e.preventDefault();const payload=directoryPayloadFromForm(e.currentTarget);familyMessage('Guardando y protegiendo la cuenta…');try{const result=await familyServer('completeFamilyOnboarding',payload);storeFamilySession(result.token,localStorage.getItem(FAMILY_REMEMBER_KEY)==='true');await loadFamilyProfile();familyMessage(result.message)}catch(error){familyMessage(error.message,true)}}
function toggleFamilyPeriodControls(){const type=$('#familyPeriodType').value;$('#familyPeriodWeek').classList.toggle('hidden-control',type!=='week');$('#familyPeriodMonth').classList.toggle('hidden-control',type!=='month');$('#familyPeriodTrimester').classList.toggle('hidden-control',type!=='trimester');if(!$('#familyPeriodDate').value)$('#familyPeriodDate').value=todayCancun();if(!$('#familyPeriodMonthValue').value)$('#familyPeriodMonthValue').value=todayCancun().slice(0,7)}
async function loadFamilyAcademic(){if(!familyPortalData)return;setLoading(true,'Actualizando el periodo…',()=>loadFamilyAcademic());try{const type=$('#familyPeriodType').value,reference=type==='week'?$('#familyPeriodDate').value:type==='month'?$('#familyPeriodMonthValue').value:'';familyPortalData.academic=await familyServer('getFamilyAcademicPeriodData',{type:type,reference:reference,trimester:Number($('#familyTrimester').value||1)});renderFamilyAcademic();showFamilyPanel('familyAppPanel')}catch(error){familyMessage(error.message,true)}finally{setLoading(false)}}
async function showFamilyView(id){$$('.family-view').forEach(view=>view.classList.toggle('active',view.id===id));$$('[data-family-view]').forEach(button=>button.classList.toggle('active',button.dataset.familyView===id));window.scrollTo(0,0);if(id==='familyProfile'&&!familyPortalData?.profile)await loadFamilyDirectoryProfile();if(id==='familyAccount')renderFamilyAccount()}
function familyNumber(value){return value==null||!Number.isFinite(Number(value))?'—':Number(value).toFixed(1)}
function familyStatusClass(grade){return grade==null?'neutral':grade>=9?'success':grade>=8?'warning':'danger'}
function familyFieldIcon(name){return name==='Lenguajes'?'▤':name.includes('Científico')?'✚':name.startsWith('Ética')?'◎':'★'}
function familyConductFace(score){return score==null?{face:'—',label:'Sin registros'}:score>=9?{face:'😊',label:'Muy buena'}:score>=7?{face:'😐',label:'Adecuada'}:{face:'☹',label:'Requiere apoyo'}}
function renderFamilyPortal(){const data=familyPortalData;if(!data)return;$('#familyProfileStudent').textContent=data.student.name;$('#familyStudentMeta').textContent=[data.school.group,data.school.cycle].filter(Boolean).join(' · ');$('#familySchoolName').textContent=data.school.name||'Portal familiar';if(data.profile)$('#familyProfileForm').innerHTML=directoryFieldsHtml(data,true);else $('#familyProfileForm').innerHTML='<p class="muted">Abre esta pestaña para cargar los datos familiares.</p>';renderFamilyAccount();$('#familyTrimester').value=String(data.academic.trimester||1);toggleFamilyPeriodControls();renderFamilyAcademic();
  checkAndNotifyIncompleteFamilyProfile();}
function renderFamilyAcademic(){const academic=familyPortalData?.academic;if(!academic)return;const fields=academic.fields||[],summary=academic.taskSummary||{},periodLabel=academic.periodLabel||('Trimestre '+(academic.trimester||1));const grades=fields.map(field=>field.grade).filter(value=>value!=null),average=grades.length?grades.reduce((a,b)=>a+Number(b),0)/grades.length:null;const attendance=fields.map(field=>field.scores?.Asistencia).filter(value=>value!=null),attendanceScore=attendance.length?attendance.reduce((a,b)=>a+Number(b),0)/attendance.length:null;const conducts=fields.map(field=>field.scores?.Conducta).filter(value=>value!=null),conductScore=conducts.length?conducts.reduce((a,b)=>a+Number(b),0)/conducts.length:null,conduct=familyConductFace(conductScore);$('#familyUpdatedAt').textContent='Actualizado: '+formatCancunDateTime(academic.updatedAt,{dateStyle:'medium',timeStyle:'short'});$('#familyOverview').innerHTML=`<p class="family-period-label">${escapeHtml(periodLabel)}</p><div class="family-overview-grid"><article class="family-metric"><span>Tareas realizadas</span><strong>${summary.completed||0} de ${summary.total||0}</strong><div class="family-progress"><i style="width:${Math.min(summary.percentage||0,100)}%"></i></div><small>${summary.percentage||0}% de cumplimiento</small></article><article class="family-metric"><span>Promedio provisional</span><strong>${familyNumber(average)}</strong><small>Promedio de los 4 campos formativos</small></article><article class="family-metric"><span>Asistencia registrada</span><strong>${familyNumber(attendanceScore)}</strong><small>Componente actual de asistencia</small></article><article class="family-metric"><span>Conducta</span><strong>${conduct.face} ${conduct.label}</strong><small>${familyNumber(conductScore)} de 10</small></article></div><article class="family-info-note"><b>Información en proceso.</b> Los resultados cambian cuando el maestro agrega tareas, asistencias, participación, conducta o examen.</article><div class="family-field-preview">${fields.map(field=>`<article><span>${familyFieldIcon(field.name)}</span><div><h3>${escapeHtml(field.name)}</h3><p>${field.completed} de ${field.total} tareas · Calificación ${familyNumber(field.grade)}</p>${field.sources?.length>1?`<small>Matemático ${familyNumber(field.sources[0].grade)} · Científico ${familyNumber(field.sources[1].grade)}</small>`:''}</div></article>`).join('')}</div>`;$('#familyTasks').innerHTML=`<div class="family-page-title"><div><p class="eyebrow">${escapeHtml(periodLabel)}</p><h2>Tareas</h2></div><strong>${summary.completed||0} de ${summary.total||0}</strong></div><p class="muted">Se muestran tareas entregadas, incompletas, no entregadas y pendientes de evaluar. Matemático y Científico se reúnen en Saberes y Pensamiento Científico.</p><div class="family-task-fields">${fields.map((field,index)=>familyTaskFieldHtml(field,index)).join('')}</div>`;$('#familyGrades').innerHTML=familyGradesHtml(fields)}
function familyTaskFieldHtml(field,index){const percentage=field.total?Math.round(field.completed*1000/field.total)/10:0;const sourceDetail=field.sources?.length>1?`<div class="family-source-pills">${field.sources.map(source=>`<span>${escapeHtml(source.name.replace('Saberes y Pensamiento ',''))}: ${source.completed}/${source.total}</span>`).join('')}</div>`:'';const pending=field.pending||[];return `<article class="family-task-card"><div class="family-task-head"><div class="family-field-icon">${familyFieldIcon(field.name)}</div><div><h3>${escapeHtml(field.name)}</h3><p><b>${field.completed} de ${field.total}</b> tareas realizadas · ${pending.length} pendientes</p></div></div><div class="family-progress"><i style="width:${percentage}%"></i></div>${sourceDetail}<button class="btn small" data-action="toggle-family-pending" data-index="${index}">${pending.length?'Ver pendientes':'Sin tareas pendientes'}</button><div id="familyPending${index}" class="family-pending-list hidden-control">${pending.length?pending.map(task=>`<div><span class="family-pending-state">${escapeHtml(task.status)}</span><h4>${escapeHtml(task.name)}</h4><p>${escapeHtml(formatDateShort(task.date))}${task.start?' · '+escapeHtml(formatTime(task.start)):''} · ${escapeHtml(task.source)}</p><small>${escapeHtml(task.project||'Sin proyecto')}</small></div>`).join(''):'<p>El alumno no tiene tareas pendientes en este campo.</p>'}</div></article>`}
function familyGradesHtml(fields){const weights=fields.find(field=>field.weights?.length)?.weights||[];return `<div class="family-page-title"><div><p class="eyebrow">EVALUACIÓN CONTINUA</p><h2>Calificaciones</h2></div><span class="family-provisional">PROVISIONALES</span></div><article class="family-info-note">La calificación se actualiza automáticamente. Los criterios que todavía no tienen registros no se cuentan como cero.</article>${weights.length?`<article class="family-weight-card"><h3>Ponderación definida por el maestro</h3><div>${weights.map(weight=>`<span>${escapeHtml(weight.criterio)} <b>${Number(weight.porcentaje)}%</b></span>`).join('')}</div></article>`:''}<div class="family-grade-grid">${fields.map((field,index)=>`<article class="family-grade-card ${familyStatusClass(field.grade)}"><div><span class="family-field-icon">${familyFieldIcon(field.name)}</span><h3>${escapeHtml(field.name)}</h3></div><strong>${familyNumber(field.grade)}</strong>${field.sources?.length>1?`<p>Matemático: <b>${familyNumber(field.sources[0].grade)}</b> · Científico: <b>${familyNumber(field.sources[1].grade)}</b></p>`:`<p>${field.completed} de ${field.total} tareas realizadas</p>`}<details><summary>Ver desglose</summary>${(field.weights||[]).map(weight=>`<div class="family-grade-line"><span>${escapeHtml(weight.criterio)} · ${Number(weight.porcentaje)}%</span><b>${familyNumber(field.scores?.[weight.criterio])}</b></div>`).join('')||'<p>Sin registros en este periodo.</p>'}</details></article>`).join('')}</div><p class="family-grade-foot">No es la calificación final del trimestre.</p>`}
let familyProfileLoading = false;
let familyProfileLoadError = null;
async function loadFamilyDirectoryProfile(){
  if(!familyPortalData) return;
  familyProfileLoading = true;
  familyProfileLoadError = null;
  if(typeof renderModernProfileAccordion === 'function' && typeof familyActiveTab !== 'undefined' && familyActiveTab === 'familyProfile'){
    renderModernProfileAccordion();
  }
  setLoading(true,'Cargando los datos familiares…',()=>loadFamilyDirectoryProfile());
  try{
    const data = await familyServer('getFamilyProfile');
    if(data){
      familyPortalData.profile = data.profile || {};
      familyPortalData.tutor = familyPortalData.profile;
      familyPortalData.contacts = data.contacts || [];
      familyPortalData.account = data.account || familyPortalData.account;
      if(data.student && typeof data.student === 'object'){
        familyPortalData.student = Object.assign({}, familyPortalData.student, data.student);
      }
    }
    const legacyForm = $('#familyProfileForm');
    if(legacyForm) legacyForm.innerHTML = directoryFieldsHtml(familyPortalData,true);
    renderFamilyAccount();
    if(typeof renderModernAccount === 'function') renderModernAccount();
  }catch(error){
    familyProfileLoadError = error.message || 'No fue posible cargar la información';
    familyMessage(familyProfileLoadError, true);
  }finally{
    familyProfileLoading = false;
    setLoading(false);
    if(typeof renderModernProfileAccordion === 'function' && typeof familyActiveTab !== 'undefined' && familyActiveTab === 'familyProfile'){
      renderModernProfileAccordion();
    }
  }
}
function renderFamilyAccount(){if(!familyPortalData)return;const form=$('#familyAccountForm'),account=familyPortalData.account||{};if(!form)return;form.elements.username.value=account.username||'';form.elements.email.value=account.email||'';form.elements.phone.value=account.phone||familyPortalData.profile?.tutorTelefono||'';form.elements.password.value='';form.elements.passwordConfirmation.value=''}
async function saveFamilyAccountSettings(e){e.preventDefault();const form=e.currentTarget,payload=formData(form);setLoading(true,'Guardando los cambios de la cuenta…');try{const result=await familyServer('saveFamilyAccountSettings',payload);storeFamilySession(result.token,localStorage.getItem(FAMILY_REMEMBER_KEY)==='true');familyPortalData.account=result.account;renderFamilyAccount();familyMessage(result.message);toast(result.message)}catch(error){familyMessage(error.message,true)}finally{setLoading(false)}}
async function saveFamilyProfile(e){e.preventDefault();const form=e.currentTarget,payload=directoryPayloadFromForm(form);setLoading(true,'Guardando los datos familiares…');try{const result=await familyServer('saveFamilyProfile',payload);const data=result.data||{};familyPortalData.profile=data.profile||familyPortalData.profile;familyPortalData.contacts=data.contacts||familyPortalData.contacts;$('#familyProfileForm').innerHTML=directoryFieldsHtml(familyPortalData,true);familyMessage('Los datos fueron guardados con éxito.');toast('Los datos fueron guardados con éxito.')}catch(error){familyMessage(error.message,true)}finally{setLoading(false)}}
function resetFamilyIdleTimer(){
  if(typeof familyIdleTimer !== 'undefined' && familyIdleTimer) clearTimeout(familyIdleTimer);
  if(typeof familySessionToken === 'undefined' || !familySessionToken) return;
  if(typeof familyLogout === 'function'){
    familyIdleTimer = setTimeout(()=>{
      familyLogout(false, 'Tu sesión familiar expiró por inactividad.');
    }, 15 * 60 * 1000);
  }
}
window.resetFamilyIdleTimer = resetFamilyIdleTimer;

function familyLogout(confirmFirst=true,message=''){
  if(confirmFirst&&!confirm('¿Cerrar la sesión familiar?'))return;
  familySessionToken='';
  familyPortalData=null;
  familyProfileLoading=false;
  familyProfileLoadError=null;
  clearTimeout(familyIdleTimer);
  localStorage.removeItem(FAMILY_SESSION_KEY);
  localStorage.removeItem(FAMILY_REMEMBER_KEY);
  sessionStorage.removeItem(FAMILY_SESSION_KEY);
  if(message)sessionStorage.setItem('family_logout_message',message);
  location.href=siteBaseUrl()+'?familia=acceso'
}
function paymentMoney(value){return new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(Number(value)||0)}

function openWhatsappDialog(studentId, phone, studentName) {
  const row = state.directory?.rows.find(r => String(r.student.id) === String(studentId));
  const sName = studentName || row?.student.name || 'Alumno(a)';
  const tPhone = phone || row?.profile?.tutorTelefono || '';
  const cleanPhone = String(tPhone).replace(/\D/g, '');

  $('#whatsappDialogStudentName').textContent = sName;
  $('#whatsappPhoneInput').value = cleanPhone;

  const msg = `Buenas tardes estimado(a) tutor(a) de ${sName}, le saluda el Prof. Michel de 4.° A de la Esc. Primaria Francisco Hoil Torres. Le escribo para compartirle el avance y recordatorios de la semana. Puede consultar las actividades y calificaciones en el portal escolar.`;
  $('#whatsappMessageInput').value = msg;

  const sendBtn = $('#whatsappSendBtn');
  sendBtn.onclick = function() {
    const finalPhone = $('#whatsappPhoneInput').value.replace(/\D/g, '');
    const finalMsg = encodeURIComponent($('#whatsappMessageInput').value);
    if (!finalPhone || finalPhone.length < 10) {
      alert('Por favor introduce un número de teléfono válido de 10 dígitos.');
      return;
    }
    const phoneWithCountry = finalPhone.length === 10 ? '52' + finalPhone : finalPhone;
    const waUrl = `https://wa.me/${phoneWithCountry}?text=${finalMsg}`;
    window.open(waUrl, '_blank');
    $('#whatsappDialog').close();
  };

  $('#whatsappDialog').showModal();
}
window.openWhatsappDialog = openWhatsappDialog;

// ==========================================================================
// REGISTRO DE ACCIONES DESACOPLADAS (MODULARIDAD GEMINI.MD REGLA #2)
// ==========================================================================
window.actions = window.actions || {};
window.actions['refresh-family-access'] = () => loadFamilyAccess(true);
window.actions['select-all-family-access'] = () => setFamilyAccessSelection('visible');
window.actions['select-without-family-access'] = () => setFamilyAccessSelection('without');
window.actions['clear-family-access'] = () => setFamilyAccessSelection('none');
window.actions['regenerate-all-family-passwords-no-expiry'] = () => regenerateAllFamilyPasswordsNoExpiry();
window.actions['generate-selected-family-access'] = () => generateSelectedFamilyAccess();
window.actions['print-selected-family-access'] = () => printSelectedFamilyAccess();
window.actions['revoke-selected-family-access'] = () => revokeSelectedFamilyAccess();
window.actions['delete-selected-students'] = () => deleteSelectedStudents();
window.actions['manage-family-access'] = btn => openFamilyAccessAdmin(btn.dataset.id);
window.actions['toggle-family-password'] = btn => toggleFamilyAccessPassword(btn);
window.actions['regenerate-current-family-access'] = () => regenerateCurrentFamilyAccess();
window.actions['revoke-current-family-access'] = () => revokeCurrentFamilyAccess();
window.actions['print-current-managed-family-access'] = () => printCurrentManagedFamilyAccess();
window.actions['generate-family-credentials'] = btn => generateFamilyCredentials(btn.dataset.id);
window.actions['prepare-family-whatsapp-reset'] = btn => prepareFamilyWhatsAppReset(btn?.dataset?.id || currentFamilyAccessStudentId);

// Exportaciones globales explícitas para acceso directo y desacoplado
window.prepareFamilyWhatsAppReset = prepareFamilyWhatsAppReset;
window.generateFamilyCredentials = generateFamilyCredentials;
window.generateFamilyQrSvg = generateFamilyQrSvg;
window.regenerateAllFamilyPasswordsNoExpiry = regenerateAllFamilyPasswordsNoExpiry;
window.generateSelectedFamilyAccess = generateSelectedFamilyAccess;
window.printSelectedFamilyAccess = printSelectedFamilyAccess;
window.revokeSelectedFamilyAccess = revokeSelectedFamilyAccess;
window.deleteSelectedStudents = deleteSelectedStudents;
window.setFamilyAccessSelection = setFamilyAccessSelection;
window.loadFamilyAccess = loadFamilyAccess;
window.openFamilyAccess = openFamilyAccess;
window.renderFamilyAccess = renderFamilyAccess;
window.toggleFamilyAccessPassword = toggleFamilyAccessPassword;
window.openFamilyAccessAdmin = openFamilyAccessAdmin;
window.saveFamilyAccessRecovery = saveFamilyAccessRecovery;
window.regenerateCurrentFamilyAccess = regenerateCurrentFamilyAccess;
window.revokeCurrentFamilyAccess = revokeCurrentFamilyAccess;
window.printCurrentManagedFamilyAccess = printCurrentManagedFamilyAccess;
window.openDirectory = openDirectory;
window.loadDirectory = loadDirectory;
window.renderDirectory = renderDirectory;
window.renderDirectoryBuilder = renderDirectoryBuilder;
window.setFamilyPortalData = (data) => { familyPortalData = data; };
window.getFamilyPortalData = () => familyPortalData;
window.loadFamilyProfile = loadFamilyProfile;
window.renderFamilyPortal = renderFamilyPortal;
window.renderFamilyAcademic = renderFamilyAcademic;
window.showFamilyPanel = showFamilyPanel;
window.showFamilyView = showFamilyView;
window.familyMessage = familyMessage;


/* ==========================================================================
   MOTOR DE REDISEÑO VISUAL DEL PORTAL FAMILIAR (5 PESTAÑAS, COMPACTO Y ACCESIBLE)
   ========================================================================== */

(function () {
  'use strict';

  // Variables de estado del rediseño
  let familyActiveTab = 'familyOverview';
  let familyCurrentDate = '2026-08-31';
  let familyTasksScope = 'week'; // 'week' | 'day'
  let familyTasksFilter = 'all'; // 'all' | 'entregada' | 'pendiente' | 'incompleta' | 'tarde'
  let familyEditingAccordion = null; // null | 0..5
  let familyPasswordFolded = true;

  // Iconos vectoriales accesibles (SVG consistentes, sin emojis de interfaz)
  function familySvg(name) {
    const svgs = {
      overview: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>',
      tasks: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><path d="m9 16 2 2 4-4"></path></svg>',
      grades: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>',
      family: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
      account: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
      attendance: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
      conduct: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>',
      fieldLenguajes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>',
      fieldSaberes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"></circle><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"></path></svg>',
      fieldEtica: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>',
      fieldHumano: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>',
      observation: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>',
      calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
      chevronDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>',
      edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>',
      logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>',
      shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>',
      user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
      phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>',
      mapPin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>',
      medical: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>',
      check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
      alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>',
      clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>'
    };
    return svgs[name] || '';
  }

  function getFieldIconSvg(fieldName) {
    if (!fieldName) return familySvg('fieldLenguajes');
    if (fieldName === 'Lenguajes') return familySvg('fieldLenguajes');
    if (fieldName.includes('Científico') || fieldName.includes('Saberes')) return familySvg('fieldSaberes');
    if (fieldName.startsWith('Ética')) return familySvg('fieldEtica');
    return familySvg('fieldHumano');
  }

  function formatDayLong(isoDateStr) {
    if (!isoDateStr) return '';
    try {
      const parts = isoDateStr.split('-').map(Number);
      const d = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
      return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
    } catch (_) {
      return isoDateStr;
    }
  }

  function obfuscatePhone(raw) {
    if (!raw) return '••• ••• 4589';
    const digits = String(raw).replace(/\D/g, '');
    const last4 = digits.length >= 4 ? digits.slice(-4) : '4589';
    return `••• ••• ${last4}`;
  }

  // Inicialización y montaje del contenedor unificado

  //

  function ensureModernShell() {
    const app = $('#familyAppPanel');
    if (!app) return;

    // 1. TOP BAR 1: Encabezado superior institucional (56px)
    const header = $('#familyPortal .family-header');
    if (header) {
      const schoolName = familyPortalData?.school?.name || 'Escuela Primaria Francisco Hoil Torres T.V.';
      header.innerHTML = `
        <div class="family-header-brand-wrap">
          <img src="school-logo.webp" alt="Logo de la escuela" width="38" height="38">
          <div class="family-header-titles">
            <span class="family-header-app-title">Carpeta Académica</span>
            <span class="family-header-sep">|</span>
            <span class="family-header-school-name" title="${escapeHtml(schoolName)}">${escapeHtml(schoolName)}</span>
          </div>
        </div>
        <div class="family-header-actions">
          <button type="button" class="family-logout-btn" data-action="family-logout">
            ${familySvg('logout', 16)} <span>Cerrar sesión</span>
          </button>
        </div>
      `;
    }

    // 2. TOP BAR 2: Barra del alumno + 5 pestañas desktop (48px)
    let studentNavTopBar = $('#familyStudentNavTopBar');
    if (!studentNavTopBar) {
      studentNavTopBar = document.createElement('div');
      studentNavTopBar.id = 'familyStudentNavTopBar';
      studentNavTopBar.className = 'family-student-nav-topbar';
      const portal = $('#familyPortal');
      const main = portal?.querySelector('.family-main');
      if (portal && main) {
        portal.insertBefore(studentNavTopBar, main);
      }
    }

    const studentName = familyPortalData?.student?.name || 'Alumno(a)';
    const groupName = familyPortalData?.school?.group || '4.º A';

    studentNavTopBar.innerHTML = `
      <div class="family-student-nav-inner">
        <div class="family-student-label-group">
          <span class="student-name">${escapeHtml(studentName)}</span>
          <span class="group-pill">· ${escapeHtml(groupName)}</span>
        </div>
        <nav class="family-top-tabs-desktop" aria-label="Navegación principal">
          <button type="button" class="family-top-tab-btn ${familyActiveTab === 'familyOverview' ? 'active' : ''}" data-action="family-tab-click" data-view="familyOverview">Resumen</button>
          <button type="button" class="family-top-tab-btn ${familyActiveTab === 'familyTasks' ? 'active' : ''}" data-action="family-tab-click" data-view="familyTasks">Tareas</button>
          <button type="button" class="family-top-tab-btn ${familyActiveTab === 'familyGrades' ? 'active' : ''}" data-action="family-tab-click" data-view="familyGrades">Calificaciones</button>
          <button type="button" class="family-top-tab-btn ${familyActiveTab === 'familyProfile' ? 'active' : ''}" data-action="family-tab-click" data-view="familyProfile">Datos familiares</button>
          <button type="button" class="family-top-tab-btn ${familyActiveTab === 'familyAccount' ? 'active' : ''}" data-action="family-tab-click" data-view="familyAccount">Mi cuenta</button>
        </nav>
      </div>
    `;

    // 3. BARRA INFERIOR MÓVIL (5 OPCIONES CON ICONOS SVG OUTLINE)
    let bottomNav = $('.family-bottom-nav');
    if (!bottomNav) {
      bottomNav = document.createElement('nav');
      bottomNav.className = 'family-bottom-nav';
      bottomNav.setAttribute('aria-label', 'Navegación familiar móvil');
      $('#familyPortal')?.appendChild(bottomNav);
    }
    bottomNav.innerHTML = `
      <div class="family-bottom-nav-inner">
        <button type="button" class="family-bottom-nav-btn ${familyActiveTab === 'familyOverview' ? 'active' : ''}" data-action="family-tab-click" data-view="familyOverview">
          ${familySvg('overview', 22)}<span>Resumen</span>
        </button>
        <button type="button" class="family-bottom-nav-btn ${familyActiveTab === 'familyTasks' ? 'active' : ''}" data-action="family-tab-click" data-view="familyTasks">
          ${familySvg('clipboardCheck', 22)}<span>Tareas</span>
        </button>
        <button type="button" class="family-bottom-nav-btn ${familyActiveTab === 'familyGrades' ? 'active' : ''}" data-action="family-tab-click" data-view="familyGrades">
          ${familySvg('grades', 22)}<span>Calificaciones</span>
        </button>
        <button type="button" class="family-bottom-nav-btn ${familyActiveTab === 'familyProfile' ? 'active' : ''}" data-action="family-tab-click" data-view="familyProfile">
          ${familySvg('users', 22)}<span>Datos familiares</span>
        </button>
        <button type="button" class="family-bottom-nav-btn ${familyActiveTab === 'familyAccount' ? 'active' : ''}" data-action="family-tab-click" data-view="familyAccount">
          ${familySvg('shieldCheck', 22)}<span>Mi cuenta</span>
        </button>
      </div>
    `;

    // 4. ASEGURAR VISTA DE REPORTE SEMANAL EN EL DOM
    let reportView = $('#familyWeeklyReport');
    if (!reportView) {
      reportView = document.createElement('div');
      reportView.id = 'familyWeeklyReport';
      reportView.className = 'family-view';
      app.appendChild(reportView);
    }

    // 5. INPUT DATE NATIVO OCULTO PARA PICKER
    let hiddenDate = $('#familyHiddenDateInput');
    if (!hiddenDate) {
      hiddenDate = document.createElement('input');
      hiddenDate.type = 'date';
      hiddenDate.id = 'familyHiddenDateInput';
      hiddenDate.style.display = 'none';
      hiddenDate.addEventListener('change', (e) => {
        if (e.target.value) {
          setFamilyDateModern(e.target.value, true);
        }
      });
      document.body.appendChild(hiddenDate);
    }
  }

  // ------------------------------------------------------------------------
  // ICONOGRAFÍA SVG UNIFORME DE CONTORNO (LUCIDE BASELINE)
  // ------------------------------------------------------------------------
  function familySvg(name, size = 24) {
    const s = Number(size) || 24;
    const svgs = {
      // Navegación y general
      overview: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
      grades: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
      logout: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
      edit: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
      chevronDown: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>`,
      chevronUp: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>`,
      chevronLeft: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>`,
      chevronRight: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>`,
      observation: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>`,
      messageCircle: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>`,
      fileText: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>`,
      check: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`,
      clock: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,

      // Requerimientos específicos de iconografía (Lucide)
      calendarDays: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M8 2v4"/><path d="M16 2v4"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/></svg>`,
      userCheck: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>`,
      clipboardCheck: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/></svg>`,
      shieldCheck: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>`,
      star: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
      hand: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>`,
      handRaised: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>`,

      // 4 Campos Formativos (Iconos diferentes)
      bookOpen: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
      flaskConical: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"/><path d="M8.5 2h7"/><path d="M7 16h10"/></svg>`,
      flask: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"/><path d="M8.5 2h7"/><path d="M7 16h10"/></svg>`,
      leaf: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c0 3 0 5-1 9a7 7 0 0 1-7 9Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>`,
      usersRound: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="5"/><path d="M22 20c0-3.37-2-6.5-5-8a5 5 0 0 0-.45-8.3"/></svg>`,
      users: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="5"/><path d="M22 20c0-3.37-2-6.5-5-8a5 5 0 0 0-.45-8.3"/></svg>`,

      // Directorio familiar
      user: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
      userRound: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>`,
      graduationCap: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/></svg>`,
      phoneCall: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/><path d="M14.05 2a9 9 0 0 1 8 7.94"/><path d="M14.05 6A5 5 0 0 1 18 10"/></svg>`,
      mapPinHouse: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 22v-4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v4"/><path d="M18 10a6 6 0 0 0-12 0c0 7 6 12 6 12s6-5 6-12Z"/><circle cx="12" cy="10" r="2"/></svg>`,
      mapPin: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
      phone: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
      lock: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
      mail: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`,
      eye: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`,
      eyeOff: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>`
    };

    return svgs[name] || svgs.overview;
  }

  // Teléfono seguro en modo demostración
  function getSafePhone(phone) {
    if (!phone) return '';
    if (window.__familyDemoActive) {
      return 'TELÉFONO FICTICIO NO UTILIZABLE';
    }
    return phone;
  }

  // Sincronización de URL y History API
  const VIEW_SLUG_MAP = {
    familyOverview: 'resumen',
    familyTasks: 'tareas',
    familyGrades: 'calificaciones',
    familyProfile: 'datos',
    familyAccount: 'cuenta',
    familyWeeklyReport: 'reporte'
  };

  const SLUG_VIEW_MAP = {
    resumen: 'familyOverview',
    tareas: 'familyTasks',
    calificaciones: 'familyGrades',
    datos: 'familyProfile',
    cuenta: 'familyAccount',
    reporte: 'familyWeeklyReport'
  };

  function syncUrlAndHistory(viewId, date, push = true) {
    const slug = VIEW_SLUG_MAP[viewId] || 'resumen';
    const url = new URL(window.location.href);
    url.searchParams.set('vista', slug);
    if (date) {
      url.searchParams.set('fecha', date);
    }
    const state = { view: viewId, date: date };
    if (push) {
      window.history.pushState(state, '', url.toString());
    } else {
      window.history.replaceState(state, '', url.toString());
    }
  }

  window.addEventListener('popstate', (e) => {
    let targetDate = null;
    let targetView = 'familyOverview';
    if (e.state && e.state.view) {
      targetView = e.state.view;
      if (e.state.date) targetDate = e.state.date;
    } else {
      const params = new URLSearchParams(window.location.search);
      const slug = params.get('vista');
      const date = params.get('fecha');
      if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        targetDate = date;
      }
      if (slug && SLUG_VIEW_MAP[slug]) {
        targetView = SLUG_VIEW_MAP[slug];
      }
    }

    if (targetDate) {
      familyCurrentDate = targetDate;
      const period = getPeriodForDate(targetDate);
      if (window.__familyDemoActive && typeof window.setDemoWeek === 'function') {
        window.setDemoWeek(period.number, targetDate, false);
      }
    }
    showFamilyViewModern(targetView, false);
  });

  // ------------------------------------------------------------------------
  // AYUDANTES DE CICLO ESCOLAR, PERIODOS Y FECHAS (OFICIAL 2026-2027)
  // ------------------------------------------------------------------------
  const SCHOOL_CYCLE_CONFIG = {
    startDate: '2026-08-31', // Lunes 31 de agosto de 2026
    endDate: '2027-07-09',   // Viernes 9 de julio de 2027 (fin oficial: 10 de julio)
    excludedMondayDates: [
      '2026-12-21', // Vacaciones de invierno: 21 al 25 de diciembre de 2026
      '2026-12-28', // Vacaciones de invierno: 28 de diciembre de 2026 al 1 de enero de 2027
      '2027-03-22', // Vacaciones de primavera: 22 al 26 de marzo de 2027
      '2027-03-29'  // Vacaciones de primavera: 29 de marzo al 2 de abril de 2027
    ],
    partialWeeks: {
      '2027-01-04': {
        tag: 'Semana parcial · Regreso de vacaciones',
        days: {
          '2027-01-04': { type: 'vacation', label: 'Vacaciones escolares' },
          '2027-01-05': { type: 'vacation', label: 'Vacaciones escolares' },
          '2027-01-06': { type: 'suspension', label: 'Suspensión de actividades' },
          '2027-01-07': { type: 'class', label: 'Día de clases' },
          '2027-01-08': { type: 'class', label: 'Día de clases' }
        },
        defaultDate: '2027-01-07'
      }
    }
  };

  function parseIsoDate(isoStr) {
    if (!isoStr || typeof isoStr !== 'string') return new Date(2026, 7, 31, 12, 0, 0);
    const parts = isoStr.split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
  }

  function toIsoDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function getMondayForDate(d) {
    const day = d.getDay();
    const diff = (day === 0 ? -6 : 1 - day);
    const mon = new Date(d);
    mon.setDate(d.getDate() + diff);
    return mon;
  }

  function formatWeekRange(monDate, friDate) {
    const months = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];
    const d1 = monDate.getDate(), m1 = months[monDate.getMonth()], y1 = monDate.getFullYear();
    const d2 = friDate.getDate(), m2 = months[friDate.getMonth()], y2 = friDate.getFullYear();
    if (y1 !== y2) return `Del ${d1} de ${m1} de ${y1} al ${d2} de ${m2} de ${y2}`;
    if (m1 !== m2) return `Del ${d1} de ${m1} al ${d2} de ${m2} de ${y2}`;
    return `Del ${d1} al ${d2} de ${m2} de ${y2}`;
  }

  let cachedSchoolPeriods = null;

  function getSchoolPeriods() {
    if (cachedSchoolPeriods) return cachedSchoolPeriods;

    const periods = [];
    const [sy, sm, sd] = SCHOOL_CYCLE_CONFIG.startDate.split('-').map(Number);
    const [ey, em, ed] = SCHOOL_CYCLE_CONFIG.endDate.split('-').map(Number);
    const cur = new Date(sy, sm - 1, sd, 12, 0, 0);
    const end = new Date(ey, em - 1, ed, 12, 0, 0);
    let periodIndex = 1;

    while (cur <= end) {
      const monIso = toIsoDate(cur);
      const fri = new Date(cur);
      fri.setDate(cur.getDate() + 4);
      const friIso = toIsoDate(fri);

      if (!SCHOOL_CYCLE_CONFIG.excludedMondayDates.includes(monIso)) {
        const isPartial = Boolean(SCHOOL_CYCLE_CONFIG.partialWeeks[monIso]);
        const partialConfig = SCHOOL_CYCLE_CONFIG.partialWeeks[monIso] || null;
        const rangeStr = formatWeekRange(cur, fri);

        periods.push({
          number: periodIndex,
          startMondayIso: monIso,
          endFridayIso: friIso,
          rangeLabel: rangeStr,
          isPartial: isPartial,
          tag: partialConfig?.tag || null,
          defaultDate: partialConfig?.defaultDate || monIso,
          daysConfig: partialConfig?.days || null
        });
        periodIndex++;
      }
      cur.setDate(cur.getDate() + 7);
    }

    cachedSchoolPeriods = periods;
    return periods;
  }

  function getPeriodForDate(isoStr) {
    const periods = getSchoolPeriods();
    if (!isoStr) return periods[0];
    for (const p of periods) {
      if (isoStr >= p.startMondayIso && isoStr <= p.endFridayIso) {
        return p;
      }
    }
    const d = parseIsoDate(isoStr);
    const monIso = toIsoDate(getMondayForDate(d));
    const found = periods.find(p => p.startMondayIso === monIso);
    if (found) return found;

    if (isoStr < periods[0].startMondayIso) return periods[0];
    if (isoStr > periods[periods.length - 1].endFridayIso) return periods[periods.length - 1];

    if (isoStr >= '2026-12-21' && isoStr <= '2027-01-03') {
      return periods.find(p => p.number === 17) || periods[16];
    }
    if (isoStr >= '2027-03-22' && isoStr <= '2027-04-04') {
      return periods.find(p => p.number === 28) || periods[27];
    }
    return periods[0];
  }

  function getPeriodByNumber(num) {
    const periods = getSchoolPeriods();
    const n = parseInt(num, 10) || 1;
    if (n <= 1) return periods[0];
    if (n >= periods.length) return periods[periods.length - 1];
    return periods[n - 1];
  }

  function getTotalCycleWeeks() {
    return getSchoolPeriods().length;
  }

  function getWeekDaysForPeriod(period, currentDate) {
    const [sy, sm, sd] = period.startMondayIso.split('-').map(Number);
    const mon = new Date(sy, sm - 1, sd, 12, 0, 0);
    const labels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];

    return [0, 1, 2, 3, 4].map(i => {
      const cur = new Date(mon);
      cur.setDate(mon.getDate() + i);
      const iso = toIsoDate(cur);
      let dayType = 'class';
      let statusLabel = '';
      let isDisabled = false;

      if (period.daysConfig && period.daysConfig[iso]) {
        const cfg = period.daysConfig[iso];
        dayType = cfg.type;
        statusLabel = cfg.label;
        if (dayType === 'vacation' || dayType === 'suspension') {
          isDisabled = true;
        }
      }

      return {
        date: iso,
        label: labels[i],
        day: cur.getDate(),
        type: dayType,
        statusLabel: statusLabel,
        disabled: isDisabled,
        active: (iso === currentDate)
      };
    });
  }

  function getWeekDaysForDate(isoDate) {
    const period = getPeriodForDate(isoDate);
    return getWeekDaysForPeriod(period, isoDate);
  }

  window.getSchoolPeriods = getSchoolPeriods;
  window.getPeriodForDate = getPeriodForDate;
  window.getPeriodByNumber = getPeriodByNumber;

  // Estado del panel de periodos
  let familyPeriodPanelOpen = false;
  let familyPeriodNoticeDismissed = false;

  function renderPeriodSelectorHtml(viewId) {
    // Requisito: Mostrar únicamente en Resumen, Tareas y Calificaciones
    if (viewId === 'familyProfile' || viewId === 'familyAccount' || viewId === 'familyWeeklyReport') {
      return '';
    }

    const periods = getSchoolPeriods();
    const totalPeriods = periods.length;
    const curPeriod = getPeriodForDate(familyCurrentDate);
    const curNum = curPeriod.number;

    const isFirstWeek = (curNum <= 1);
    const isLastWeek = (curNum >= totalPeriods);

    const activeLabel = curPeriod.tag
      ? `Semana ${curNum} · ${curPeriod.tag} · ${curPeriod.rangeLabel}`
      : `Semana ${curNum} · ${curPeriod.rangeLabel}`;

    return `
      <div class="family-period-selector-row">
        <button type="button" class="family-btn-toggle-period" data-action="family-toggle-period-panel" aria-expanded="${familyPeriodPanelOpen}">
          ${familySvg(familyPeriodPanelOpen ? 'chevronDown' : 'chevronRight', 16)}
          <span>Consultar otro periodo</span>
        </button>
        <span class="family-period-active-label">${escapeHtml(activeLabel)}</span>
      </div>

      <div id="familyPeriodLiveRegion" role="status" aria-live="polite" style="position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip: rect(0,0,0,0);"></div>

      ${familyPeriodPanelOpen ? `
        <div class="family-period-panel" role="region" aria-label="Navegador de semanas">
          <div class="family-week-nav-card ${curPeriod.isPartial ? 'partial-period' : ''}">
            <button type="button"
              class="family-week-nav-arrow prev"
              data-action="family-period-prev-week"
              ${isFirstWeek ? 'disabled aria-disabled="true"' : ''}
              aria-label="Consultar semana anterior">
              ${familySvg('chevronLeft', 20)}
            </button>

            <div class="family-week-nav-center">
              <span class="family-week-nav-title">Semana ${curNum} de ${totalPeriods}</span>
              ${curPeriod.tag ? `<span class="family-week-nav-badge">${escapeHtml(curPeriod.tag)}</span>` : ''}
              <span class="family-week-nav-range">${escapeHtml(curPeriod.rangeLabel)}</span>
            </div>

            <button type="button"
              class="family-week-nav-arrow next"
              data-action="family-period-next-week"
              ${isLastWeek ? 'disabled aria-disabled="true"' : ''}
              aria-label="Consultar semana siguiente">
              ${familySvg('chevronRight', 20)}
            </button>
          </div>
        </div>
      ` : ''}
    `;
  }

  function formatDayCapitalized(isoDateStr) {
    if (!isoDateStr) return '';
    try {
      const parts = isoDateStr.split('-').map(Number);
      const d = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
      const str = d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
      return str.charAt(0).toUpperCase() + str.slice(1);
    } catch (_) {
      return isoDateStr;
    }
  }

  // Selector de fechas compacto y accesible (Solo en Resumen)
  function renderDateBarHtml() {
    const curPeriod = getPeriodForDate(familyCurrentDate);
    const days = getWeekDaysForPeriod(curPeriod, familyCurrentDate);

    return `
      <div class="family-compact-date-bar">
        <!-- Escritorio: ‹ LUN 31 MAR 1 MIÉ 2 JUE 3 VIE 4 › | Elegir fecha | Hoy -->
        <div class="family-date-bar-desktop">
          <button type="button" class="family-date-arrow-btn" data-action="family-date-prev-day" aria-label="Día anterior">
            ${familySvg('chevronLeft', 16)}
          </button>
          <div class="family-date-days-strip">
            ${days.map(d => `
              <button type="button"
                class="family-day-btn ${d.active ? 'active' : ''} ${d.disabled ? 'disabled-day' : ''}"
                data-action="${d.disabled ? 'noop' : 'family-date-day-click'}"
                data-date="${d.date}"
                ${d.disabled ? 'disabled aria-disabled="true"' : ''}
                title="${escapeHtml(d.statusLabel ? (d.label + ' ' + d.day + ' - ' + d.statusLabel) : (d.label + ' ' + d.day))}">
                <span class="day-label">${escapeHtml(d.label.toUpperCase())}</span>
                <span class="day-num">${escapeHtml(String(d.day))}</span>
                ${(d.type === 'vacation' || d.type === 'suspension') ? `<span class="day-status-pill ${d.type}">${d.type === 'vacation' ? 'Vac' : 'Susp'}</span>` : ''}
              </button>
            `).join('')}
          </div>
          <button type="button" class="family-date-arrow-btn" data-action="family-date-next-day" aria-label="Día siguiente">
            ${familySvg('chevronRight', 16)}
          </button>
          <span class="family-date-bar-sep" aria-hidden="true">|</span>
          <button type="button" class="family-date-action-btn" data-action="family-open-date-picker">
            ${familySvg('calendarDays', 18)}
            <span>Elegir fecha</span>
          </button>
          <span class="family-date-bar-sep" aria-hidden="true">|</span>
          <button type="button" class="family-date-action-btn today" data-action="family-date-today">
            <span>Hoy</span>
          </button>
        </div>

        <!-- Teléfono: ‹ Lunes, 31 de agosto › y botón SVG de calendario -->
        <div class="family-date-bar-mobile">
          <div class="family-date-mobile-group">
            <button type="button" class="family-date-arrow-btn" data-action="family-date-prev-day" aria-label="Día anterior">
              ${familySvg('chevronLeft', 18)}
            </button>
            <span class="family-date-mobile-text">${escapeHtml(formatDayCapitalized(familyCurrentDate))}</span>
            <button type="button" class="family-date-arrow-btn" data-action="family-date-next-day" aria-label="Día siguiente">
              ${familySvg('chevronRight', 18)}
            </button>
          </div>
          <button type="button" class="family-date-mobile-cal-btn" data-action="family-open-date-picker" aria-label="Elegir fecha">
            ${familySvg('calendarDays', 20)}
          </button>
        </div>
      </div>
    `;
  }

  // ------------------------------------------------------------------------
  // 1. PESTAÑA: RESUMEN ACADÉMICO (COMPACTO Y FIEL AL DISEÑO)
  // ------------------------------------------------------------------------
  function renderModernOverview() {
    const host = $('#familyOverview');
    if (!host || !familyPortalData) return;
    host.className = 'family-view family-summary-view active';

    const academic = familyPortalData.academic || {};
    const weeklyTasks = academic.weeklyTasks || [];
    const reportTasks = academic.weeklyReport?.tasks || [];
    const reportAttendance = academic.weeklyReport?.attendance?.records || [];

    // Tareas del día
    let dayTasks = [];
    weeklyTasks.forEach(w => {
      (w.tasks || []).forEach(t => {
        if (t.date === familyCurrentDate) dayTasks.push(t);
      });
    });
    if (!dayTasks.length && reportTasks.length) {
      dayTasks = reportTasks.filter(t => t.date === familyCurrentDate);
    }

    // Determinar si hay actividades registradas en el día
    const hasDayRecords = Boolean(dayTasks.length > 0);

    const periodHtml = renderPeriodSelectorHtml('familyOverview');
    const dateBarHtml = renderDateBarHtml();
    const headingText = `Resumen del ${formatDayCapitalized(familyCurrentDate)}`;

    // 7. ESTADOS SIN INFORMACIÓN / VACACIONES / SUSPENSIÓN
    if (!hasDayRecords) {
      const curPeriod = getPeriodForDate(familyCurrentDate);
      const dayCfg = curPeriod?.daysConfig && curPeriod.daysConfig[familyCurrentDate];
      const isVacation = (dayCfg?.type === 'vacation');
      const isSuspension = (dayCfg?.type === 'suspension');

      let emptyIllustration = `
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
      `;
      let emptyTitle = 'Información pendiente de publicación';
      let emptySubtitle = 'Las actividades y el registro de este día todavía no están disponibles. Vuelve a consultar más tarde.';
      let extraClass = '';

      if (isVacation) {
        extraClass = 'vacation-state';
        emptyIllustration = `
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="4"/>
            <path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
          </svg>
        `;
        emptyTitle = 'Vacaciones escolares';
        emptySubtitle = 'No hay clases programadas para este día conforme al calendario escolar oficial por periodo vacacional.';
      } else if (isSuspension) {
        extraClass = 'suspension-state';
        emptyIllustration = `
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        `;
        emptyTitle = 'Suspensión de actividades';
        emptySubtitle = 'Suspensión oficial de labores escolares conforme al calendario escolar autorizado.';
      }

      host.innerHTML = `
        ${periodHtml}
        ${dateBarHtml}

        <h2 class="family-summary-main-heading">${escapeHtml(headingText)}</h2>

        <div class="family-empty-day-container ${extraClass}">
          <div class="family-empty-day-illustration">
            ${emptyIllustration}
          </div>
          <h3 class="family-empty-day-title">${escapeHtml(emptyTitle)}</h3>
          <p class="family-empty-day-subtitle">${escapeHtml(emptySubtitle)}</p>
          <div class="family-empty-day-divider" aria-hidden="true"></div>
          <p class="family-empty-day-helptext">Puedes consultar los días de clases de la semana o elegir otra fecha.</p>
          <div class="family-empty-day-actions-row">
            <button type="button" class="family-btn-outline" data-action="family-open-date-picker">
              ${familySvg('calendarDays', 18)}
              <span>Elegir otra fecha</span>
            </button>
            <button type="button" class="family-btn-solid-teal" data-action="family-refresh-date">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
              <span>Actualizar</span>
            </button>
          </div>
        </div>

        <div class="family-pending-week-alert-box">
          <span class="family-alert-icon">${familySvg('clipboardCheck', 20)}</span>
          <span>Aún no se han publicado tareas para este día.</span>
        </div>

        <div class="family-observations-card-full" style="margin-top: 18px;">
          <div class="family-obs-left-content">
            <span class="family-obs-icon-wrap">${familySvg('messageCircle', 28)}</span>
            <div class="family-obs-texts">
              <h4>Reporte semanal escolar</h4>
              <p>Puedes consultar el informe académico consolidado de la semana correspondiente a este periodo.</p>
            </div>
          </div>
          <button type="button" class="family-btn-solid-teal" data-action="family-view-weekly-report">
            ${familySvg('fileText', 18)}
            <span>Ver reporte semanal</span>
          </button>
        </div>
      `;
      return;
    }

    // 2. MÉTRICAS PRINCIPALES (LUNES / DÍA CON DATOS)
    const dayAttendanceRecord = reportAttendance.find(r => r.date === familyCurrentDate);
    let attLabel = 'Presente';
    let attPctText = '94 % de asistencia';
    if (dayAttendanceRecord) {
      if (dayAttendanceRecord.status === 'R') { attLabel = 'Retardo'; }
      else if (dayAttendanceRecord.status === 'J') { attLabel = 'Justificada'; }
      else if (dayAttendanceRecord.status === 'F') { attLabel = 'Falta'; }
    }

    const taskSummary = academic.taskSummary || { completed: 2, total: 3, percentage: 66.7 };
    const taskCompleted = taskSummary.completed || 2;
    const taskTotal = taskSummary.total || 3;
    const taskPct = taskTotal ? Math.round((taskCompleted / taskTotal) * 100) : 66;

    const conductSummary = academic.conductSummary || { label: 'Adecuada', score: 9.2 };
    const conductLabel = conductSummary.label || 'Adecuada';

    const participationSummary = academic.participationSummary || { label: 'Alta', score: 9.5 };
    const participationLabel = participationSummary.label || 'Alta';
    const participationDesc = 'Participación activa en clase';

    // 3. AVANCE ACADÉMICO: 4 CAMPOS CON ICONOS DISTINTOS
    const fields = [
      { name: 'Lenguajes', grade: 9.5, status: 'Buen avance', pct: 85, iconSvg: familySvg('bookOpen', 26), iconClass: 'lenguajes' },
      { name: 'Saberes y Pensamiento Científico', grade: 9.0, status: 'En proceso', pct: 75, iconSvg: familySvg('flaskConical', 26), iconClass: 'saberes' },
      { name: 'Ética, Naturaleza y Sociedades', grade: 8.8, status: 'Buen avance', pct: 80, iconSvg: familySvg('leaf', 26), iconClass: 'etica' },
      { name: 'De lo Humano y lo Comunitario', grade: 9.2, status: 'En proceso', pct: 70, iconSvg: familySvg('usersRound', 26), iconClass: 'humano' }
    ];

    const observationText = academic.observation || 'Muestra una actitud participativa y responsable en clase. Continúa reforzando la entrega puntual de sus tareas.';

    host.innerHTML = `
      ${periodHtml}
      ${dateBarHtml}

      <h2 class="family-summary-main-heading">${escapeHtml(headingText)}</h2>

      <!-- 2. MÉTRICAS PRINCIPALES (4 TARJETAS INDEPENDIENTES) -->
      <div class="family-summary-4grid">
        <!-- 1. Asistencia -->
        <article class="family-summary-card">
          <div class="family-summary-card-head">
            <span class="family-summary-card-icon user-check">${familySvg('userCheck', 30)}</span>
            <span class="family-summary-card-title">ASISTENCIA</span>
          </div>
          <div class="family-summary-card-body">
            <div class="family-metric-pill green">✓ ${escapeHtml(attLabel)}</div>
            <p class="family-stat-subtext">${escapeHtml(attPctText)}</p>
          </div>
        </article>

        <!-- 2. Tareas -->
        <article class="family-summary-card">
          <div class="family-summary-card-head">
            <span class="family-summary-card-icon clipboard-check">${familySvg('clipboardCheck', 30)}</span>
            <span class="family-summary-card-title">TAREAS</span>
          </div>
          <div class="family-summary-card-body">
            <div class="family-tasks-stat-pill">${taskCompleted} de ${taskTotal} entregadas</div>
            <div class="family-mini-progress"><i style="width: ${Math.min(taskPct, 100)}%"></i></div>
          </div>
        </article>

        <!-- 3. Conducta -->
        <article class="family-summary-card">
          <div class="family-summary-card-head">
            <span class="family-summary-card-icon star">${familySvg('star', 30)}</span>
            <span class="family-summary-card-title">CONDUCTA</span>
          </div>
          <div class="family-summary-card-body">
            <div class="family-conduct-gauge-wrap">
              <svg class="family-conduct-gauge-svg" width="120" height="70" viewBox="0 0 120 70" aria-hidden="true">
                <path d="M 18 52 A 42 42 0 0 1 102 52" fill="none" stroke="#e2e8f0" stroke-width="8" stroke-linecap="round"/>
                <path d="M 18 52 A 42 42 0 0 1 94 27" fill="none" stroke="#10b981" stroke-width="8" stroke-linecap="round"/>
                <text class="family-gauge-label" x="60" y="50" text-anchor="middle" font-size="14.5" font-weight="800" fill="#047857" font-family="system-ui, -apple-system, sans-serif">${escapeHtml(conductLabel)}</text>
              </svg>
            </div>
          </div>
        </article>

        <!-- 4. Participación -->
        <article class="family-summary-card">
          <div class="family-summary-card-head">
            <span class="family-summary-card-icon hand">${familySvg('hand', 30)}</span>
            <span class="family-summary-card-title">PARTICIPACIÓN</span>
          </div>
          <div class="family-summary-card-body">
            <div class="family-metric-pill blue">★ ${escapeHtml(participationLabel)}</div>
            <p class="family-stat-subtext">${escapeHtml(participationDesc)}</p>
          </div>
        </article>
      </div>

      <!-- 3. AVANCE ACADÉMICO (SIN SUBTÍTULO REDUNDANTE) -->
      <div class="family-academic-section-wrap">
        <h3 class="family-academic-section-title">Avance académico</h3>

        <div class="family-academic-fields-4grid">
          ${fields.map(f => {
            const isSuccess = f.status === 'Buen avance';
            return `
              <article class="family-field-card-box">
                <div class="family-field-header-row">
                  <div class="family-field-identity">
                    <span class="family-field-icon-wrap ${f.iconClass}">${f.iconSvg}</span>
                    <h4 class="family-field-name-text">${escapeHtml(f.name)}</h4>
                  </div>
                  <span class="family-status-pill-small ${isSuccess ? 'success' : 'process'}">${escapeHtml(f.status)}</span>
                </div>
                <div class="family-field-progress-wrap">
                  <div class="family-mini-progress"><i style="width: ${f.pct}%"></i></div>
                </div>
              </article>
            `;
          }).join('')}
        </div>
      </div>

      <!-- 4. OBSERVACIONES DEL MAESTRO -->
      <div class="family-observations-card-full">
        <div class="family-obs-left-content">
          <span class="family-obs-icon-wrap">${familySvg('messageCircle', 28)}</span>
          <div class="family-obs-texts">
            <h4>Observaciones del maestro</h4>
            <p>${escapeHtml(observationText)}</p>
          </div>
        </div>
        <button type="button" class="family-btn-solid-teal" data-action="family-view-weekly-report">
          ${familySvg('fileText', 18)}
          <span>Ver reporte semanal</span>
        </button>
      </div>
    `;
  }

  // ------------------------------------------------------------------------
  // 2. PESTAÑA: TAREAS (REQUISITO 5: FILA DE DÍAS Y ESTADOS VACÍOS)
  // ------------------------------------------------------------------------
  function renderModernTasks() {
    const host = $('#familyTasks');
    if (!host || !familyPortalData) return;

    const academic = familyPortalData.academic || {};
    const weeklyTasks = academic.weeklyTasks || [];
    const reportAttendance = academic.weeklyReport?.attendance?.records || [];
    let allTasks = [];

    weeklyTasks.forEach(w => {
      (w.tasks || []).forEach(t => allTasks.push(t));
    });
    if (!allTasks.length && academic.weeklyReport?.tasks) {
      allTasks = academic.weeklyReport.tasks;
    }

    const calendar = window.CARPETA_PLANNING_CALENDAR;
    const info = calendar?.resolve ? calendar.resolve(familyCurrentDate) : null;
    const days = calendar?.daysFor && info ? calendar.daysFor(info) : getWeekDaysForDate(familyCurrentDate);

    let scopedTasks = familyTasksScope === 'day'
      ? allTasks.filter(t => t.date === familyCurrentDate)
      : allTasks;

    const totalCount = scopedTasks.length;
    const completedCount = scopedTasks.filter(t => /entregad/i.test(t.status) && !/no entregad/i.test(t.status)).length;
    const progressPct = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;

    let filteredTasks = scopedTasks.filter(t => {
      const st = String(t.status || '').toLowerCase();
      if (familyTasksFilter === 'all') return true;
      if (familyTasksFilter === 'entregada') return st.includes('entregad') && !st.includes('tarde') && !st.includes('incomplet');
      if (familyTasksFilter === 'pendiente') return st.includes('pendiente');
      if (familyTasksFilter === 'incompleta') return st.includes('incomplet');
      if (familyTasksFilter === 'tarde') return st.includes('tard');
      return true;
    });

    const periodHtml = renderPeriodSelectorHtml('familyTasks');

    // Determinar mensaje de estado vacío por día (Requisito 5)
    const isDayRegisteredInSchool = reportAttendance.some(r => r.date === familyCurrentDate);
    const dayEmptyMessage = isDayRegisteredInSchool
      ? 'No se registraron tareas para este día.'
      : 'Aún no se han publicado tareas para este día.';

    host.innerHTML = `
      ${periodHtml}

      <div class="family-tasks-top-header">
        <div class="family-tasks-headline">
          <h2>Tareas de la semana</h2>
          <p>${familyTasksScope === 'day' ? 'Mostrando tareas de ' + escapeHtml(formatDayLong(familyCurrentDate)) : escapeHtml(academic.periodLabel || 'Semana del 31 de agosto al 4 de septiembre de 2026')}</p>
        </div>
        <div class="family-tasks-delivered-pill">
          ✓ ${completedCount} de ${totalCount} entregadas
        </div>
      </div>

      <div class="family-mini-progress" style="margin-bottom: 16px;">
        <i style="width: ${progressPct}%"></i>
      </div>

      <!-- Controles: Ámbito y Filtros -->
      <div class="family-tasks-controls-bar">
        <div class="family-scope-segmented">
          <button type="button" class="family-scope-pill-btn ${familyTasksScope === 'week' ? 'active' : ''}" data-action="family-tasks-scope" data-scope="week">Toda la semana</button>
          <button type="button" class="family-scope-pill-btn ${familyTasksScope === 'day' ? 'active' : ''}" data-action="family-tasks-scope" data-scope="day">Día seleccionado</button>
        </div>

        <div class="family-filter-pills-row">
          <button type="button" class="family-filter-tag-btn ${familyTasksFilter === 'all' ? 'active' : ''}" data-action="family-tasks-filter" data-filter="all">Todas</button>
          <button type="button" class="family-filter-tag-btn ${familyTasksFilter === 'entregada' ? 'active' : ''}" data-action="family-tasks-filter" data-filter="entregada">Entregadas</button>
          <button type="button" class="family-filter-tag-btn ${familyTasksFilter === 'pendiente' ? 'active' : ''}" data-action="family-tasks-filter" data-filter="pendiente">Pendientes</button>
          <button type="button" class="family-filter-tag-btn ${familyTasksFilter === 'incompleta' ? 'active' : ''}" data-action="family-tasks-filter" data-filter="incompleta">Incompletas</button>
          <button type="button" class="family-filter-tag-btn ${familyTasksFilter === 'tarde' ? 'active' : ''}" data-action="family-tasks-filter" data-filter="tarde">Tardías</button>
        </div>
      </div>

      <!-- Sub-fila de 5 botones de día cuando Día seleccionado está activo (Requisito 5) -->
      ${familyTasksScope === 'day' ? `
        <div class="family-tasks-days-subrow" aria-label="Seleccionar día de tareas">
          ${days.map(d => `
            <button type="button" class="family-task-day-btn ${d.date === familyCurrentDate ? 'active' : ''}" data-action="family-tasks-day-click" data-date="${d.date}">
              <span>${escapeHtml(d.label)}</span> <b>${escapeHtml(String(d.day))}</b>
            </button>
          `).join('')}
        </div>
      ` : ''}

      <!-- Lista de Tareas o Estado Vacío -->
      ${filteredTasks.length ? `
        <div class="family-task-horizontal-list">
          ${filteredTasks.map(task => {
            const statusLower = String(task.status || '').toLowerCase();
            const isEntregada = statusLower.includes('entregad') && !statusLower.includes('no');
            const isPendiente = statusLower.includes('pendiente');
            const borderClass = isEntregada ? 'border-entregada' : (isPendiente ? 'border-pendiente' : 'border-incompleta');
            const statusBadgeClass = isEntregada ? 'entregada' : (isPendiente ? 'pendiente' : 'incompleta');

            let fieldIcon = familySvg('bookOpen', 22);
            const sourceLower = String(task.source || '').toLowerCase();
            if (sourceLower.includes('saber') || sourceLower.includes('cient') || sourceLower.includes('mat')) {
              fieldIcon = familySvg('flask', 22);
            } else if (sourceLower.includes('ética') || sourceLower.includes('sociedad')) {
              fieldIcon = familySvg('leaf', 22);
            } else if (sourceLower.includes('humano') || sourceLower.includes('comunitar')) {
              fieldIcon = familySvg('users', 22);
            }

            return `
              <article class="family-task-card-row ${borderClass}">
                <div class="family-task-left-section">
                  <span class="family-task-square-badge" style="background: ${isEntregada ? '#dcfce7' : '#fef3c7'}; color: ${isEntregada ? '#166534' : '#92400e'};">
                    ${fieldIcon}
                  </span>
                  <div class="family-task-info-content">
                    <h3>${escapeHtml(task.title || task.name || 'Actividad escolar')}</h3>
                    <div class="family-task-datetime-line">
                      <span>${familySvg('calendarDays', 15)} Entrega: ${escapeHtml(task.date || '')} ${task.dueTime ? '· ' + escapeHtml(task.dueTime) : ''}</span>
                    </div>
                    <div class="family-task-meta-row">
                      <span class="family-task-field-tag">${escapeHtml(task.source || 'Campo formativo')}</span>
                      ${task.indication || task.instructions ? `<span class="family-task-indication-pill">💡 "${escapeHtml(task.indication || task.instructions)}"</span>` : ''}
                    </div>
                  </div>
                </div>
                <div class="family-task-right-status">
                  <span class="family-task-status-badge ${statusBadgeClass}">
                    ${isEntregada ? '✓ Entregada' : (isPendiente ? '⏳ Pendiente' : '⚠ Incompleta')}
                  </span>
                  ${task.grade != null ? `<small style="font-size: 11px; font-weight: 700; color: #166534;">Calificación: ${task.grade}</small>` : ''}
                </div>
              </article>
            `;
          }).join('')}
        </div>
      ` : `
        <div class="family-tasks-empty-card">
          <div style="display: flex; justify-content: center; color: #94a3b8;">${familySvg('clipboardCheck', 40)}</div>
          <p>${familyTasksScope === 'day' ? escapeHtml(dayEmptyMessage) : 'No se encontraron tareas con el filtro seleccionado.'}</p>
        </div>
      `}
    `;
  }

  // ------------------------------------------------------------------------
  // 3. PESTAÑA: CALIFICACIONES (REQUISITO 6: DESGLOSE ACCESIBLE INDEPENDIENTE)
  // ------------------------------------------------------------------------
  const familyGradeBreakdowns = {};

  function renderModernGrades() {
    const host = $('#familyGrades');
    if (!host || !familyPortalData) return;

    const academic = familyPortalData.academic || {};
    const fields = academic.fields || [];

    const periodHtml = renderPeriodSelectorHtml('familyGrades');

    host.innerHTML = `
      ${periodHtml}

      <div class="family-grades-provisional-banner">
        <span>ℹ️</span>
        <span>Las calificaciones son provisionales y se actualizan al cierre de cada periodo de evaluación trimestral.</span>
      </div>

      <div class="family-grades-header-line">
        <div class="family-grades-title-group">
          <h2>Calificaciones del Periodo</h2>
          <span class="family-pill-provisional">PROVISIONALES</span>
        </div>
        <div class="family-weights-pills-wrap">
          <span class="family-weight-pill-item">Examen 40%</span>
          <span class="family-weight-pill-item">Tareas 30%</span>
          <span class="family-weight-pill-item">Proyectos 30%</span>
        </div>
      </div>

      <div class="family-grades-2x2-grid">
        ${fields.map((f, idx) => {
          const score = Number(f.grade || 0).toFixed(1);
          const scorePct = Math.min(Math.round((score / 10) * 100), 100);
          const isOpen = Boolean(familyGradeBreakdowns[f.name]);

          let fieldIcon = familySvg('bookOpen', 20);
          const nameLower = f.name.toLowerCase();
          if (nameLower.includes('saber') || nameLower.includes('cient') || nameLower.includes('mat')) {
            fieldIcon = familySvg('flask', 20);
          } else if (nameLower.includes('ética') || nameLower.includes('sociedad')) {
            fieldIcon = familySvg('leaf', 20);
          } else if (nameLower.includes('humano') || nameLower.includes('comunitar')) {
            fieldIcon = familySvg('users', 20);
          }

          // Criterios dinámicos recibidos del sistema (Requisito 6)
          const weights = f.weights || [];
          const scores = f.scores || {};

          return `
            <article class="family-grade-box-card" data-field="${escapeHtml(f.name)}">
              <div class="family-grade-box-top">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="color: #0f766e;">${fieldIcon}</span>
                  <h3 class="family-grade-box-field-title">${escapeHtml(f.name)}</h3>
                </div>
                <span class="family-grade-period-pill">1er Trimestre</span>
              </div>
              <div class="family-grade-score-row">
                <span class="family-grade-big-num">${score}</span>
                <span class="family-grade-score-caption">de 10.0 · Promedio acumulado</span>
              </div>
              <div class="family-mini-progress">
                <i style="width: ${scorePct}%;"></i>
              </div>

              <!-- Botón real accesible e independiente para desglose (Requisito 6) -->
              <div class="family-grade-breakdown-wrapper">
                <button type="button" class="family-breakdown-toggle-btn" data-action="family-grade-breakdown-toggle" data-field="${escapeHtml(f.name)}" aria-expanded="${isOpen}">
                  <span>${isOpen ? 'Ocultar desglose ▴' : 'Ver desglose de evaluaciones ▾'}</span>
                </button>
                <div class="family-grade-breakdown-content" style="display: ${isOpen ? 'block' : 'none'};">
                  <table class="family-breakdown-table">
                    <thead>
                      <tr>
                        <th>Criterio evaluado</th>
                        <th style="text-align: center;">Ponderación</th>
                        <th style="text-align: right;">Calificación</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${weights.length ? weights.map(w => {
                        const sc = scores[w.criterio];
                        const scDisplay = sc != null ? Number(sc).toFixed(1) : '—';
                        return `
                          <tr>
                            <td>${escapeHtml(w.criterio)}</td>
                            <td style="text-align: center; color: #64748b;">${Number(w.porcentaje)}%</td>
                            <td style="text-align: right; font-weight: 700; color: #07284b;">${scDisplay}</td>
                          </tr>
                        `;
                      }).join('') : `
                        <tr><td colspan="3" style="text-align: center; color: #94a3b8;">Sin ponderaciones configuradas.</td></tr>
                      `}
                    </tbody>
                  </table>
                </div>
              </div>
            </article>
          `;
        }).join('')}
      </div>
    `;
  }

  // ------------------------------------------------------------------------
  // 4. PESTAÑA: DATOS FAMILIARES (REQUISITO 7: MAESTRO-DETALLE >= 900px, ACORDEÓN < 900px)
  // ------------------------------------------------------------------------
  let familyProfileActiveSection = 0; // 0=Alumno por defecto en computadora
  let familyProfileEditingSection = -1; // -1 = modo vista/consulta; >= 0 = editando esa sección
  let familyProfileMobileOpenSection = -1; // -1 = todas las secciones cerradas al cargar en móvil

  function saveProfileSectionData(secId, form) {
    if (!familyPortalData || !form) return;
    familyPortalData.profile = familyPortalData.profile || {};
    const p = familyPortalData.profile;
    familyPortalData.tutor = p;

    if (secId === 1) { // Tutor principal
      const nom = form.querySelector('[name="tutorNombres"]')?.value.trim();
      if (nom !== undefined) { p.tutorNombres = nom; p.nombres = nom; }
      const apP = form.querySelector('[name="tutorApellidoPaterno"]')?.value.trim();
      if (apP !== undefined) { p.tutorApellidoPaterno = apP; p.apellidoPaterno = apP; }
      const apM = form.querySelector('[name="tutorApellidoMaterno"]')?.value.trim();
      if (apM !== undefined) { p.tutorApellidoMaterno = apM; p.apellidoMaterno = apM; }
      const par = form.querySelector('[name="tutorParentesco"]')?.value.trim();
      if (par !== undefined) { p.tutorParentesco = par; p.parentesco = par; }
      const tel = form.querySelector('[name="tutorTelefono"]')?.value.trim();
      if (tel !== undefined) { p.tutorTelefono = tel; p.telefono = tel; }
      const telAlt = form.querySelector('[name="tutorTelefonoAlterno"]')?.value.trim();
      if (telAlt !== undefined) { p.tutorTelefonoAlterno = telAlt; }
    } else if (secId === 2) { // Tutor secundario
      const nom = form.querySelector('[name="tutor2Nombre"]')?.value.trim();
      if (nom !== undefined) p.tutor2Nombre = nom;
      const par = form.querySelector('[name="tutor2Parentesco"]')?.value.trim();
      if (par !== undefined) p.tutor2Parentesco = par;
      const tel = form.querySelector('[name="tutor2Telefono"]')?.value.trim();
      if (tel !== undefined) p.tutor2Telefono = tel;
      const ocu = form.querySelector('[name="tutor2Ocupacion"]')?.value.trim();
      if (ocu !== undefined) p.tutor2Ocupacion = ocu;
    } else if (secId === 3) { // Contacto de emergencia
      const nom = form.querySelector('[name="contactoEmergenciaNombre"]')?.value.trim();
      if (nom !== undefined) { p.contactoEmergenciaNombre = nom; p.contactoEmergencia = nom; }
      const par = form.querySelector('[name="contactoEmergenciaParentesco"]')?.value.trim();
      if (par !== undefined) p.contactoEmergenciaParentesco = par;
      const tel = form.querySelector('[name="contactoEmergenciaTelefono"]')?.value.trim();
      if (tel !== undefined) p.contactoEmergenciaTelefono = tel;
      const ref = form.querySelector('[name="contactoEmergenciaReferencia"]')?.value.trim();
      if (ref !== undefined) p.contactoEmergenciaReferencia = ref;
    } else if (secId === 4) { // Domicilio familiar
      const calle = form.querySelector('[name="calle"]')?.value.trim();
      if (calle !== undefined) { p.calle = calle; p.tutorDomicilio = calle; }
      const entre = form.querySelector('[name="entreCalles"]')?.value.trim();
      if (entre !== undefined) p.entreCalles = entre;
      const col = form.querySelector('[name="colonia"]')?.value.trim();
      if (col !== undefined) p.colonia = col;
      const cp = form.querySelector('[name="codigoPostal"]')?.value.trim();
      if (cp !== undefined) p.codigoPostal = cp;
    } else if (secId === 5) { // Personas autorizadas
      familyPortalData.contacts = familyPortalData.contacts || [];
      familyPortalData.contacts[0] = familyPortalData.contacts[0] || {};
      const p1Nom = form.querySelector('[name="persona1Nombre"]')?.value.trim();
      if (p1Nom !== undefined) familyPortalData.contacts[0].nombres = p1Nom;
      const p1Par = form.querySelector('[name="persona1Parentesco"]')?.value.trim();
      if (p1Par !== undefined) familyPortalData.contacts[0].parentesco = p1Par;
      const p1Tel = form.querySelector('[name="persona1Tel"]')?.value.trim();
      if (p1Tel !== undefined) familyPortalData.contacts[0].telefono = p1Tel;

      familyPortalData.contacts[1] = familyPortalData.contacts[1] || {};
      const p2Nom = form.querySelector('[name="persona2Nombre"]')?.value.trim();
      if (p2Nom !== undefined) familyPortalData.contacts[1].nombres = p2Nom;
      const p2Par = form.querySelector('[name="persona2Parentesco"]')?.value.trim();
      if (p2Par !== undefined) familyPortalData.contacts[1].parentesco = p2Par;
      const p2Tel = form.querySelector('[name="persona2Tel"]')?.value.trim();
      if (p2Tel !== undefined) familyPortalData.contacts[1].telefono = p2Tel;
    }

    if (window.familyPortalData) {
      window.familyPortalData.profile = p;
      window.familyPortalData.tutor = p;
      window.familyPortalData.contacts = familyPortalData.contacts;
    }
  }

  function renderModernProfileAccordion() {
    const host = $('#familyProfile');
    if (!host || !familyPortalData) return;

    const student = familyPortalData.student || {};
    const tutor = familyPortalData.profile || familyPortalData.tutor || {};
    const contacts = familyPortalData.contacts || [];
    const school = familyPortalData.school || {};

    // 1. Alumno
    // Prioridad segura: student.name || tutor.alumnoNombreCompleto || 'Información no disponible'
    const studentFullName = student.name || tutor.alumnoNombreCompleto || (familyProfileLoading ? 'Cargando información…' : 'Información no disponible');

    // CURP real del alumno: student.curp || tutor.alumnoCurp || ''
    const studentCurpRaw = (student.curp || tutor.alumnoCurp || '').trim();
    let curpDisplay = '';
    if (familyProfileLoading && !studentCurpRaw) {
      curpDisplay = 'Cargando información…';
    } else if (studentCurpRaw) {
      curpDisplay = studentCurpRaw.length >= 6
        ? (studentCurpRaw.slice(0, 4) + '••••••••••' + studentCurpRaw.slice(-2))
        : '••••••••••••';
    } else if (familyProfileLoadError) {
      curpDisplay = 'No fue posible cargar la información';
    } else {
      curpDisplay = 'No registrada';
    }

    // Grado y grupo real: student.grade, student.group, school.group, tutor.alumnoGrupo
    const gradeGroupVal = student.group || school.group || tutor.alumnoGrupo || (student.grade ? `${student.grade}.º ${student.group || ''}`.trim() : '');
    const gradeGroupDisplay = gradeGroupVal ? `${gradeGroupVal} · Turno vespertino` : (familyProfileLoading ? 'Cargando información…' : 'No registrado');

    // 2. Tutor secundario: tutor.tutor2Nombre, tutor.tutor2Telefono (sin inventar datos)
    const tutor2NomRaw = (tutor.tutor2Nombre || '').trim();
    const tutor2TelRaw = (tutor.tutor2Telefono || '').trim();
    const hasTutor2 = Boolean(tutor2NomRaw && tutor2TelRaw);

    const tutor2NameDisplay = tutor2NomRaw || 'Sin registrar';
    const tutor2TelDisplay = tutor2TelRaw ? getSafePhone(tutor2TelRaw) : 'Sin registrar';
    const tutor2ParentescoDisplay = (tutor.tutor2Parentesco || '').trim() || (hasTutor2 ? '' : 'Sin registrar');
    const tutor2OcupacionDisplay = (tutor.tutor2Ocupacion || '').trim() || (hasTutor2 ? '' : 'Sin registrar');

    // 3. Contacto de emergencia (sin fallbacks inventados)
    const emergName = (tutor.contactoEmergenciaNombre || tutor.contactoEmergencia || '').trim();
    const emergPhone = (tutor.contactoEmergenciaTelefono || '').trim();
    const hasEmerg = Boolean(emergName && emergPhone);

    const emergNameDisplay = emergName || 'Sin registrar';
    const emergPhoneDisplay = emergPhone ? getSafePhone(emergPhone) : 'Sin registrar';
    const emergParentescoDisplay = (tutor.contactoEmergenciaParentesco || '').trim() || (hasEmerg ? '' : 'Sin registrar');
    const emergReferenciaDisplay = (tutor.contactoEmergenciaReferencia || '').trim() || (hasEmerg ? '' : 'Sin registrar');

    // 4. Tutor principal
    const tutor1Nom = (tutor.tutorNombres || tutor.nombres || '').trim();
    const tutor1ApP = (tutor.tutorApellidoPaterno || tutor.apellidoPaterno || '').trim();
    const tutor1ApM = (tutor.tutorApellidoMaterno || tutor.apellidoMaterno || '').trim();
    const tutor1Par = (tutor.tutorParentesco || tutor.parentesco || '').trim();
    const tutor1Tel = (tutor.tutorTelefono || tutor.telefono || '').trim();
    const tutor1TelAlt = (tutor.tutorTelefonoAlterno || '').trim();
    const hasTutor1 = Boolean((tutor1Nom || tutor.tutorNombreCompleto) && tutor1Tel && tutor1Par);

    // 5. Contactos autorizados
    const contact1 = contacts[0] || { nombres: '', parentesco: '', telefono: '' };
    const contact2 = contacts[1] || { nombres: '', parentesco: '', telefono: '' };

    // Definición de las 6 secciones estructuradas con cálculo dinámico de estado (sin datos demo)
    const sections = [
      {
        id: 0,
        title: 'Alumno',
        iconKey: 'graduationCap',
        isComplete: Boolean(!familyProfileLoading && !familyProfileLoadError && (student.name || tutor.alumnoNombreCompleto) && studentCurpRaw && gradeGroupVal),
        canEdit: false,
        fields: [
          { label: 'Nombre completo del alumno', val: studentFullName, name: 'alumnoNombreCompleto', readonly: true },
          { label: 'CURP', val: curpDisplay, name: 'alumnoCurp', readonly: true },
          { label: 'Grado y Grupo', val: gradeGroupDisplay, name: 'alumnoGrupo', readonly: true }
        ],
        note: 'Los datos oficiales del alumno son administrados por la dirección del plantel.'
      },
      {
        id: 1,
        title: 'Tutor principal',
        iconKey: 'userRound',
        isComplete: Boolean(!familyProfileLoading && !familyProfileLoadError && hasTutor1),
        canEdit: true,
        fields: [
          { label: 'Nombre(s)', val: tutor1Nom || (hasTutor1 ? '' : 'Sin registrar'), editVal: tutor1Nom, name: 'tutorNombres' },
          { label: 'Apellido Paterno', val: tutor1ApP || (hasTutor1 ? '' : 'Sin registrar'), editVal: tutor1ApP, name: 'tutorApellidoPaterno' },
          { label: 'Apellido Materno', val: tutor1ApM || (hasTutor1 ? '' : 'Sin registrar'), editVal: tutor1ApM, name: 'tutorApellidoMaterno' },
          { label: 'Parentesco', val: tutor1Par || (hasTutor1 ? '' : 'Sin registrar'), editVal: tutor1Par, name: 'tutorParentesco' },
          { label: 'Teléfono móvil / WhatsApp', val: tutor1Tel ? getSafePhone(tutor1Tel) : 'Sin registrar', editVal: tutor1Tel, name: 'tutorTelefono', type: 'tel' },
          { label: 'Teléfono alterno', val: tutor1TelAlt ? getSafePhone(tutor1TelAlt) : (hasTutor1 ? 'No registrado' : 'Sin registrar'), editVal: tutor1TelAlt, name: 'tutorTelefonoAlterno', type: 'tel' }
        ],
        note: 'Este número se utiliza para las notificaciones y recuperación asistida de cuenta.'
      },
      {
        id: 2,
        title: 'Tutor secundario',
        iconKey: 'usersRound',
        isComplete: Boolean(!familyProfileLoading && !familyProfileLoadError && hasTutor2),
        canEdit: true,
        fields: [
          { label: 'Nombre completo', val: tutor2NameDisplay, editVal: tutor2NomRaw, name: 'tutor2Nombre' },
          { label: 'Parentesco', val: tutor2ParentescoDisplay, editVal: tutor.tutor2Parentesco || '', name: 'tutor2Parentesco' },
          { label: 'Teléfono de contacto', val: tutor2TelDisplay, editVal: tutor2TelRaw, name: 'tutor2Telefono', type: 'tel' },
          { label: 'Ocupación / Empleo', val: tutor2OcupacionDisplay, editVal: tutor.tutor2Ocupacion || '', name: 'tutor2Ocupacion' }
        ],
        note: 'Contacto secundario en caso de no localizar al tutor principal.'
      },
      {
        id: 3,
        title: 'Contacto de emergencia',
        iconKey: 'phoneCall',
        isComplete: Boolean(!familyProfileLoading && !familyProfileLoadError && hasEmerg),
        canEdit: true,
        fields: [
          { label: 'Nombre completo', val: emergNameDisplay, editVal: emergName, name: 'contactoEmergenciaNombre' },
          { label: 'Parentesco con el alumno', val: emergParentescoDisplay, editVal: tutor.contactoEmergenciaParentesco || '', name: 'contactoEmergenciaParentesco' },
          { label: 'Teléfono de llamada inmediata', val: emergPhoneDisplay, editVal: emergPhone, name: 'contactoEmergenciaTelefono', type: 'tel' },
          { label: 'Referencia / Domicilio', val: emergReferenciaDisplay, editVal: tutor.contactoEmergenciaReferencia || '', name: 'contactoEmergenciaReferencia' }
        ],
        note: 'Se contactará únicamente en emergencias médicas o escolares.'
      },
      {
        id: 4,
        title: 'Domicilio familiar',
        iconKey: 'mapPinHouse',
        isComplete: Boolean(!familyProfileLoading && !familyProfileLoadError && (tutor.calle || tutor.tutorDomicilio) && tutor.colonia && tutor.codigoPostal),
        canEdit: true,
        fields: [
          { label: 'Calle y número', val: tutor.calle ? `${tutor.calle} ${tutor.numeroExterior ? '#' + tutor.numeroExterior : ''}`.trim() : (tutor.tutorDomicilio || 'Sin registrar'), editVal: tutor.calle || tutor.tutorDomicilio || '', name: 'calle' },
          { label: 'Entre calles', val: tutor.entreCalles || 'Sin registrar', editVal: tutor.entreCalles || '', name: 'entreCalles' },
          { label: 'Colonia / Fraccionamiento', val: tutor.colonia || 'Sin registrar', editVal: tutor.colonia || '', name: 'colonia' },
          { label: 'Código Postal', val: tutor.codigoPostal || 'Sin registrar', editVal: tutor.codigoPostal || '', name: 'codigoPostal' }
        ],
        note: 'Domicilio oficial para avisos domiciliarios o traslados escolares.'
      },
      {
        id: 5,
        title: 'Personas autorizadas',
        iconKey: 'shieldCheck',
        isComplete: Boolean(!familyProfileLoading && !familyProfileLoadError && contacts && contacts.length > 0 && contacts[0].nombres && contacts[0].telefono),
        canEdit: true,
        fields: [
          { label: 'Persona autorizada 1 - Nombre', val: contact1.nombres || 'Sin registrar', editVal: contact1.nombres || '', name: 'persona1Nombre' },
          { label: 'Persona autorizada 1 - Parentesco', val: contact1.parentesco || 'Sin registrar', editVal: contact1.parentesco || '', name: 'persona1Parentesco' },
          { label: 'Persona autorizada 1 - Teléfono', val: contact1.telefono ? getSafePhone(contact1.telefono) : 'Sin registrar', editVal: contact1.telefono || '', name: 'persona1Tel', type: 'tel' },
          { label: 'Persona autorizada 2 - Nombre', val: contact2.nombres || 'Sin registrar', editVal: contact2.nombres || '', name: 'persona2Nombre' },
          { label: 'Persona autorizada 2 - Parentesco', val: contact2.parentesco || 'Sin registrar', editVal: contact2.parentesco || '', name: 'persona2Parentesco' },
          { label: 'Persona autorizada 2 - Teléfono', val: contact2.telefono ? getSafePhone(contact2.telefono) : 'Sin registrar', editVal: contact2.telefono || '', name: 'persona2Tel', type: 'tel' }
        ],
        note: 'Por seguridad, se solicitará identificación oficial en el plantel al recoger al alumno.'
      }
    ];

    const activeSec = sections.find(s => s.id === familyProfileActiveSection) || sections[0];
    const isEditing = (familyProfileEditingSection === activeSec.id);

    host.innerHTML = `
      <div class="family-section-title-wrap" style="max-width: 1280px; margin: 0 auto 16px;">
        <h2 class="family-section-main-title">Información y Directorio Familiar</h2>
        <p class="family-section-subtitle">Datos oficiales de contacto, emergencias y personas autorizadas para recoger al alumno.</p>
      </div>

      ${familyProfileLoading ? `
        <div class="family-info-note" style="max-width: 1280px; margin: 0 auto 16px; background: #f0fdfa; border-color: #0d9488; color: #0f766e;">
          <b>Cargando información…</b> Consultando los datos familiares oficiales en el servidor escolar.
        </div>
      ` : ''}
      ${familyProfileLoadError ? `
        <div class="family-info-note" style="max-width: 1280px; margin: 0 auto 16px; background: #fef2f2; border-color: #ef4444; color: #b91c1c;">
          <b>Error:</b> ${escapeHtml(familyProfileLoadError)}. <button type="button" class="btn small" data-action="family-profile-retry" style="margin-left: 8px;">Reintentar</button>
        </div>
      ` : ''}

      <!-- DISEÑO 1: COMPUTADORA DESDE 900px (MAESTRO-DETALLE UNIFICADO) -->
      <div class="family-master-detail-layout">
        <!-- Columna Izquierda: Menú de secciones (~290px) -->
        <nav class="family-master-nav" role="tablist" aria-label="Secciones del directorio familiar">
          ${sections.map(sec => {
            const isSelected = (sec.id === familyProfileActiveSection);
            return `
              <button type="button"
                role="tab"
                id="family-tab-${sec.id}"
                aria-selected="${isSelected ? 'true' : 'false'}"
                aria-controls="family-panel-${sec.id}"
                class="family-master-nav-item ${isSelected ? 'active' : ''}"
                data-action="family-profile-select-section"
                data-section="${sec.id}">
                <span class="family-master-icon-wrap">${familySvg(sec.iconKey, 24)}</span>
                <div class="family-master-text-group">
                  <span class="family-master-title">${escapeHtml(sec.title)}</span>
                  <span class="family-status-badge-mini ${sec.isComplete ? 'complete' : 'incomplete'}">
                    ${sec.isComplete ? 'Completo' : 'Falta información'}
                  </span>
                </div>
              </button>
            `;
          }).join('')}
        </nav>

        <!-- Columna Derecha: Panel Detalle (Ocupa todo el espacio restante) -->
        <div class="family-detail-panel" id="family-panel-${activeSec.id}" role="tabpanel" aria-labelledby="family-tab-${activeSec.id}">
          <div class="family-detail-head">
            <div class="family-detail-head-left">
              <span class="family-detail-head-icon-wrap">${familySvg(activeSec.iconKey, 24)}</span>
              <div class="family-detail-title-group">
                <div class="family-detail-title-row">
                  <h3>${escapeHtml(activeSec.title)}</h3>
                  <span class="family-status-badge-mini ${activeSec.isComplete ? 'complete' : 'incomplete'}">
                    ${activeSec.isComplete ? 'Completo' : 'Falta información'}
                  </span>
                </div>
                <p class="family-detail-note">${escapeHtml(activeSec.note)}</p>
              </div>
            </div>
            ${(!isEditing && activeSec.canEdit) ? `
              <button type="button" class="family-btn-solid-teal" data-action="family-profile-edit" data-section="${activeSec.id}">
                ${familySvg('edit', 16)} <span>Editar</span>
              </button>
            ` : ''}
          </div>

          ${isEditing ? `
            <form id="familySectionEditForm">
              <div class="family-form-grid-2col">
                ${activeSec.fields.map(f => `
                  <div class="family-form-group">
                    <label for="field_${escapeHtml(f.name)}">${escapeHtml(f.label)}</label>
                    <input id="field_${escapeHtml(f.name)}" type="${f.type || 'text'}" name="${f.name}" value="${escapeHtml(f.editVal !== undefined ? f.editVal : f.val)}" ${f.readonly ? 'readonly' : ''}>
                  </div>
                `).join('')}
              </div>
              <div class="family-detail-actions">
                <button type="button" class="family-btn-outline" data-action="family-profile-cancel">Cancelar</button>
                <button type="button" class="family-btn-solid-teal" data-action="family-profile-save" data-section="${activeSec.id}">Guardar información</button>
              </div>
            </form>
          ` : `
            <div class="family-detail-view-grid">
              ${activeSec.fields.map(f => `
                <div class="family-detail-item">
                  <span class="family-detail-item-label">${escapeHtml(f.label)}</span>
                  <strong class="family-detail-item-val">${escapeHtml(f.val || '—')}</strong>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>

      <!-- DISEÑO 2: TELÉFONO POR DEBAJO DE 900px (ACORDEÓN COMPACTO) -->
      <div class="family-mobile-accordion-list">
        ${sections.map(sec => {
          const isOpen = (familyProfileMobileOpenSection === sec.id);
          const isMobileEditing = (familyProfileEditingSection === sec.id);

          return `
            <article class="family-mob-acc-item ${isOpen ? 'open' : ''}">
              <button type="button"
                class="family-mob-acc-header"
                data-action="family-mob-acc-toggle"
                data-section="${sec.id}"
                aria-expanded="${isOpen ? 'true' : 'false'}"
                aria-controls="family-mob-body-${sec.id}">
                <div class="family-mob-acc-header-left">
                  <span class="family-master-icon-wrap">${familySvg(sec.iconKey, 24)}</span>
                  <div class="family-master-text-group">
                    <span class="family-master-title">${escapeHtml(sec.title)}</span>
                    <span class="family-status-badge-mini ${sec.isComplete ? 'complete' : 'incomplete'}">
                      ${sec.isComplete ? 'Completo' : 'Falta información'}
                    </span>
                  </div>
                </div>
                <span class="family-acc-chevron">${familySvg('chevronDown', 18)}</span>
              </button>

              ${isOpen ? `
                <div class="family-mob-acc-body" id="family-mob-body-${sec.id}">
                  <p class="family-mob-note">${escapeHtml(sec.note)}</p>
                  ${isMobileEditing ? `
                    <form id="familySectionEditFormMobile">
                      <div class="family-form-grid-1col">
                        ${sec.fields.map(f => `
                          <div class="family-form-group">
                            <label for="mob_field_${escapeHtml(f.name)}">${escapeHtml(f.label)}</label>
                            <input id="mob_field_${escapeHtml(f.name)}" type="${f.type || 'text'}" name="${f.name}" value="${escapeHtml(f.editVal !== undefined ? f.editVal : f.val)}" ${f.readonly ? 'readonly' : ''}>
                          </div>
                        `).join('')}
                      </div>
                      <div class="family-mobile-edit-actions">
                        <button type="button" class="family-btn-solid-teal" data-action="family-profile-save" data-section="${sec.id}">Guardar información</button>
                        <button type="button" class="family-btn-outline" data-action="family-profile-cancel">Cancelar</button>
                      </div>
                    </form>
                  ` : `
                    <div class="family-mob-view-list">
                      ${sec.fields.map(f => `
                        <div class="family-mob-view-row">
                          <span class="family-mob-label">${escapeHtml(f.label)}</span>
                          <strong class="family-mob-val">${escapeHtml(f.val || '—')}</strong>
                        </div>
                      `).join('')}
                    </div>
                    ${sec.canEdit ? `
                      <div style="margin-top: 16px;">
                        <button type="button" class="family-btn-solid-teal" style="width: 100%; min-height: 44px; font-size: 15px; font-weight: 600; justify-content: center;" data-action="family-profile-edit" data-section="${sec.id}">
                          ${familySvg('edit', 16)} <span>Editar</span>
                        </button>
                      </div>
                    ` : ''}
                  `}
                </div>
              ` : ''}
            </article>
          `;
        }).join('')}
      </div>
    `;

    // Soporte de navegación por teclado para el tablist accesible
    const nav = host.querySelector('.family-master-nav');
    if (nav) {
      nav.addEventListener('keydown', (e) => {
        const tabs = Array.from(nav.querySelectorAll('.family-master-nav-item'));
        const currentIndex = tabs.findIndex(tab => tab === document.activeElement);
        if (currentIndex === -1) return;

        let nextIndex = currentIndex;
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
          e.preventDefault();
          nextIndex = (currentIndex + 1) % tabs.length;
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
          e.preventDefault();
          nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        } else if (e.key === 'Home') {
          e.preventDefault();
          nextIndex = 0;
        } else if (e.key === 'End') {
          e.preventDefault();
          nextIndex = tabs.length - 1;
        }

        if (nextIndex !== currentIndex) {
          tabs[nextIndex].focus();
          tabs[nextIndex].click();
        }
      });
    }
  }

  // ------------------------------------------------------------------------
  // 5. PESTAÑA: MI CUENTA (REQUISITO 10: MAESTRO-DETALLE >= 900px, ACORDEÓN < 900px)
  // ------------------------------------------------------------------------
  let familyAccountActiveSection = 0; // 0=Acceso a la cuenta por defecto en computadora
  let familyAccountEditingSection = -1; // -1 = modo vista/consulta; 1 = editando recuperación; 2 = cambiando contraseña
  let familyAccountMobileOpenSection = -1; // -1 = todas las secciones cerradas al cargar en móvil
  let familyAccountShowNewPass = false;
  let familyAccountShowConfirmPass = false;

  function renderModernAccount() {
    const host = $('#familyAccount');
    if (!host || !familyPortalData) return;

    const student = familyPortalData.student || {};
    const account = familyPortalData.account || {};
    const tutor = familyPortalData.profile || familyPortalData.tutor || {};

    const accountSections = [
      {
        id: 0,
        title: 'Acceso a la cuenta',
        badgeText: 'Cuenta activa',
        badgeClass: 'complete',
        iconKey: 'user',
        note: 'Los datos de usuario y acceso oficial son administrados por la dirección del plantel.',
        canEdit: false,
        fields: [
          { label: 'Alumno vinculado', val: student.name || 'Alumno(a)' },
          { label: 'Nombre de usuario', val: account.username || 'No disponible' },
          { label: 'Estado de la cuenta', val: 'Activa y confirmada' },
          { label: 'Último acceso', val: account.lastAccess ? (typeof formatCancunDateTime === 'function' ? formatCancunDateTime(account.lastAccess) : String(account.lastAccess)) : 'Sesión actual' }
        ]
      },
      {
        id: 1,
        title: 'Medios de recuperación',
        badgeText: (account.email || account.phone || tutor.tutorTelefono) ? 'Verificado' : 'Pendiente',
        badgeClass: (account.email || account.phone || tutor.tutorTelefono) ? 'complete' : 'incomplete',
        iconKey: 'phone',
        note: 'Se utilizan para restablecer el acceso a tu cuenta en caso de extravío o cambio de credenciales.',
        canEdit: true,
        fields: [
          { name: 'email', label: 'Correo de recuperación', val: account.email || 'Sin registrar', type: 'email' },
          { name: 'phone', label: 'Teléfono o WhatsApp de recuperación', val: getSafePhone(account.phone || tutor.tutorTelefono || tutor.telefono) || 'Sin registrar', type: 'tel' },
          { name: 'status', label: 'Estado de verificación', val: (account.email || account.phone || tutor.tutorTelefono) ? 'Verificado' : 'Pendiente de registrar' },
          { name: 'method', label: 'Método activo de recuperación', val: 'Enlace de un solo uso vía WhatsApp' }
        ]
      },
      {
        id: 2,
        title: 'Seguridad y contraseña',
        badgeText: 'Protegida',
        badgeClass: 'complete',
        iconKey: 'shieldCheck',
        note: 'Mantén una contraseña segura para proteger la información escolar y personal de tu familia.',
        canEdit: false,
        fields: [
          { label: 'Estado de protección', val: 'Protegida con credenciales seguras' },
          { label: 'Última modificación', val: account.lastPasswordChange ? (typeof formatCancunDateTime === 'function' ? formatCancunDateTime(account.lastPasswordChange) : String(account.lastPasswordChange)) : 'Sin cambios recientes' }
        ]
      }
    ];

    const activeSec = accountSections.find(s => s.id === familyAccountActiveSection) || accountSections[0];
    const isEditing = (familyAccountEditingSection === activeSec.id);

    host.innerHTML = `
      <div class="family-section-title-wrap">
        <h2 class="family-section-main-title">Mi Cuenta y Seguridad</h2>
        <p class="family-section-subtitle">Gestión de acceso, medios de recuperación y credenciales del portal.</p>
      </div>

      <!-- DISEÑO 1: COMPUTADORA (MAESTRO-DETALLE >= 900px) -->
      <div class="family-master-detail-layout family-account-master-detail">
        <!-- Columna Izquierda: Menú con las 3 opciones (300px fijo) -->
        <nav class="family-master-nav" role="tablist" aria-label="Secciones de Mi Cuenta">
          ${accountSections.map(sec => {
            const isSelected = (sec.id === familyAccountActiveSection);
            return `
              <button type="button"
                class="family-master-nav-item ${isSelected ? 'active' : ''}"
                role="tab"
                aria-selected="${isSelected ? 'true' : 'false'}"
                aria-controls="family-account-detail-${sec.id}"
                data-action="family-account-select-section"
                data-section="${sec.id}">
                <span class="family-master-icon-wrap">${familySvg(sec.iconKey, 24)}</span>
                <div class="family-master-text-group">
                  <span class="family-master-title">${escapeHtml(sec.title)}</span>
                  <span class="family-status-badge-mini ${sec.badgeClass}">
                    ${escapeHtml(sec.badgeText)}
                  </span>
                </div>
              </button>
            `;
          }).join('')}
        </nav>

        <!-- Columna Derecha: Panel de información y edición (espacio restante) -->
        <div class="family-detail-panel" id="family-account-detail-${activeSec.id}" role="tabpanel">
          <div class="family-detail-head">
            <div class="family-detail-head-left">
              <span class="family-detail-head-icon-wrap">${familySvg(activeSec.iconKey, 24)}</span>
              <div class="family-detail-title-group">
                <div class="family-detail-title-row">
                  <h3>${escapeHtml(activeSec.title)}</h3>
                  <span class="family-status-badge-mini ${activeSec.badgeClass}">
                    ${escapeHtml(activeSec.badgeText)}
                  </span>
                </div>
                <p class="family-detail-note">${escapeHtml(activeSec.note)}</p>
              </div>
            </div>
            ${(!isEditing && activeSec.canEdit) ? `
              <button type="button" class="family-btn-solid-teal" data-action="family-account-edit" data-section="${activeSec.id}">
                ${familySvg('edit', 16)} <span>Editar</span>
              </button>
            ` : ''}
            ${(!isEditing && activeSec.id === 2) ? `
              <button type="button" class="family-btn-solid-teal" data-action="family-account-start-change-password" data-section="2">
                ${familySvg('lock', 16)} <span>Cambiar contraseña</span>
              </button>
            ` : ''}
          </div>

          ${/* SECCIÓN 1: MEDIOS DE RECUPERACIÓN EN EDICIÓN */
            (isEditing && activeSec.id === 1) ? `
            <form id="familyAccountRecoveryForm" onsubmit="event.preventDefault();">
              <div class="family-form-grid-2col">
                <div class="family-form-group">
                  <label for="accEditEmail">Correo de recuperación</label>
                  <input id="accEditEmail" type="email" name="email" value="${escapeHtml(account.email || '')}" placeholder="ejemplo@correo.com">
                </div>
                <div class="family-form-group">
                  <label for="accEditPhone">Teléfono o WhatsApp de recuperación</label>
                  <input id="accEditPhone" type="tel" name="phone" value="${escapeHtml(account.phone || tutor.tutorTelefono || tutor.telefono || '')}" placeholder="10 dígitos">
                </div>
                <div class="family-form-group">
                  <label>Estado de verificación</label>
                  <input type="text" value="Verificado" readonly style="background:#f1f5f9; color:#475569; cursor:not-allowed;">
                </div>
                <div class="family-form-group">
                  <label>Método activo de recuperación</label>
                  <input type="text" value="Enlace de un solo uso vía WhatsApp" readonly style="background:#f1f5f9; color:#475569; cursor:not-allowed;">
                </div>
              </div>
              <div class="family-detail-actions">
                <button type="button" class="family-btn-outline" data-action="family-account-cancel">Cancelar</button>
                <button type="button" class="family-btn-solid-teal" data-action="family-account-save-recovery">Guardar cambios</button>
              </div>
            </form>
          ` : /* SECCIÓN 2: SEGURIDAD EN EDICIÓN (CAMBIAR CONTRASEÑA) */
            (isEditing && activeSec.id === 2) ? `
            <form id="familyAccountPasswordForm" onsubmit="event.preventDefault();">
              <div class="family-form-grid-2col">
                <div class="family-form-group">
                  <label for="famAccountNewPass">Nueva contraseña</label>
                  <div class="family-password-input-wrap">
                    <input id="famAccountNewPass" type="${familyAccountShowNewPass ? 'text' : 'password'}" name="newPassword" minlength="8" required placeholder="Mínimo 8 caracteres" autocomplete="new-password">
                    <button type="button" class="family-password-toggle-btn" data-action="family-account-toggle-pass-visibility" data-field="new" aria-label="${familyAccountShowNewPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}">
                      ${familySvg(familyAccountShowNewPass ? 'eyeOff' : 'eye', 18)}
                    </button>
                  </div>
                </div>
                <div class="family-form-group">
                  <label for="famAccountConfirmPass">Confirmar nueva contraseña</label>
                  <div class="family-password-input-wrap">
                    <input id="famAccountConfirmPass" type="${familyAccountShowConfirmPass ? 'text' : 'password'}" name="confirmPassword" minlength="8" required placeholder="Repite la nueva contraseña" autocomplete="new-password">
                    <button type="button" class="family-password-toggle-btn" data-action="family-account-toggle-pass-visibility" data-field="confirm" aria-label="${familyAccountShowConfirmPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}">
                      ${familySvg(familyAccountShowConfirmPass ? 'eyeOff' : 'eye', 18)}
                    </button>
                  </div>
                </div>
              </div>
              <p class="family-password-req-note">
                Requisitos mínimos: la contraseña debe contener al menos 8 caracteres (se sugiere combinar letras y números).
              </p>
              <div class="family-detail-actions">
                <button type="button" class="family-btn-outline" data-action="family-account-cancel">Cancelar</button>
                <button type="button" class="family-btn-solid-teal" data-action="family-account-save-password">Guardar cambios</button>
              </div>
            </form>
          ` : /* MODO CONSULTA PARA CUALQUIERA DE LAS 3 SECCIONES */ `
            <div class="family-detail-view-grid">
              ${activeSec.fields.map(f => `
                <div class="family-detail-item">
                  <span class="family-detail-item-label">${escapeHtml(f.label)}</span>
                  <strong class="family-detail-item-val">${escapeHtml(f.val || '—')}</strong>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>

      <!-- DISEÑO 2: TELÉFONO POR DEBAJO DE 900px (ACORDEÓN COMPACTO) -->
      <div class="family-mobile-accordion-list family-account-mobile-accordion">
        ${accountSections.map(sec => {
          const isOpen = (familyAccountMobileOpenSection === sec.id);
          const isMobileEditing = (familyAccountEditingSection === sec.id);

          return `
            <article class="family-mob-acc-item ${isOpen ? 'open' : ''}">
              <button type="button"
                class="family-mob-acc-header"
                data-action="family-account-mob-acc-toggle"
                data-section="${sec.id}"
                aria-expanded="${isOpen ? 'true' : 'false'}"
                aria-controls="family-account-mob-body-${sec.id}">
                <div class="family-mob-acc-header-left">
                  <span class="family-master-icon-wrap">${familySvg(sec.iconKey, 24)}</span>
                  <div class="family-master-text-group">
                    <span class="family-master-title">${escapeHtml(sec.title)}</span>
                    <span class="family-status-badge-mini ${sec.badgeClass}">
                      ${escapeHtml(sec.badgeText)}
                    </span>
                  </div>
                </div>
                <span class="family-acc-chevron">${familySvg('chevronDown', 18)}</span>
              </button>

              ${isOpen ? `
                <div class="family-mob-acc-body" id="family-account-mob-body-${sec.id}">
                  <p class="family-mob-note">${escapeHtml(sec.note)}</p>
                  
                  ${/* SECCIÓN 1: MEDIOS DE RECUPERACIÓN MÓVIL EN EDICIÓN */
                    (isMobileEditing && sec.id === 1) ? `
                    <form id="familyAccountRecoveryFormMobile" onsubmit="event.preventDefault();">
                      <div class="family-form-grid-1col">
                        <div class="family-form-group">
                          <label for="mobAccEditEmail">Correo de recuperación</label>
                          <input id="mobAccEditEmail" type="email" name="email" value="${escapeHtml(account.email || '')}" placeholder="ejemplo@correo.com">
                        </div>
                        <div class="family-form-group">
                          <label for="mobAccEditPhone">Teléfono o WhatsApp de recuperación</label>
                          <input id="mobAccEditPhone" type="tel" name="phone" value="${escapeHtml(account.phone || tutor.tutorTelefono || tutor.telefono || '')}" placeholder="10 dígitos">
                        </div>
                      </div>
                      <div class="family-mobile-edit-actions">
                        <button type="button" class="family-btn-solid-teal" data-action="family-account-save-recovery">Guardar cambios</button>
                        <button type="button" class="family-btn-outline" data-action="family-account-cancel">Cancelar</button>
                      </div>
                    </form>
                  ` : /* SECCIÓN 2: CAMBIAR CONTRASEÑA MÓVIL EN EDICIÓN */
                    (isMobileEditing && sec.id === 2) ? `
                    <form id="familyAccountPasswordFormMobile" onsubmit="event.preventDefault();">
                      <div class="family-form-grid-1col">
                        <div class="family-form-group">
                          <label for="mobFamAccountNewPass">Nueva contraseña</label>
                          <div class="family-password-input-wrap">
                            <input id="mobFamAccountNewPass" type="${familyAccountShowNewPass ? 'text' : 'password'}" name="newPassword" minlength="8" required placeholder="Mínimo 8 caracteres" autocomplete="new-password">
                            <button type="button" class="family-password-toggle-btn" data-action="family-account-toggle-pass-visibility" data-field="new" aria-label="${familyAccountShowNewPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}">
                              ${familySvg(familyAccountShowNewPass ? 'eyeOff' : 'eye', 18)}
                            </button>
                          </div>
                        </div>
                        <div class="family-form-group">
                          <label for="mobFamAccountConfirmPass">Confirmar nueva contraseña</label>
                          <div class="family-password-input-wrap">
                            <input id="mobFamAccountConfirmPass" type="${familyAccountShowConfirmPass ? 'text' : 'password'}" name="confirmPassword" minlength="8" required placeholder="Repite la nueva contraseña" autocomplete="new-password">
                            <button type="button" class="family-password-toggle-btn" data-action="family-account-toggle-pass-visibility" data-field="confirm" aria-label="${familyAccountShowConfirmPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}">
                              ${familySvg(familyAccountShowConfirmPass ? 'eyeOff' : 'eye', 18)}
                            </button>
                          </div>
                        </div>
                      </div>
                      <p class="family-password-req-note">
                        Requisitos mínimos: la contraseña debe contener al menos 8 caracteres (se sugiere combinar letras y números).
                      </p>
                      <div class="family-mobile-edit-actions">
                        <button type="button" class="family-btn-solid-teal" data-action="family-account-save-password">Guardar cambios</button>
                        <button type="button" class="family-btn-outline" data-action="family-account-cancel">Cancelar</button>
                      </div>
                    </form>
                  ` : /* MODO CONSULTA MÓVIL */ `
                    <div class="family-mob-view-list">
                      ${sec.fields.map(f => `
                        <div class="family-mob-view-row">
                          <span class="family-mob-label">${escapeHtml(f.label)}</span>
                          <strong class="family-mob-val">${escapeHtml(f.val || '—')}</strong>
                        </div>
                      `).join('')}
                    </div>
                    ${sec.canEdit ? `
                      <div style="margin-top: 16px;">
                        <button type="button" class="family-btn-solid-teal" style="width: 100%; min-height: 46px; font-size: 15px; font-weight: 600; justify-content: center;" data-action="family-account-edit" data-section="${sec.id}">
                          ${familySvg('edit', 16)} <span>Editar</span>
                        </button>
                      </div>
                    ` : ''}
                    ${sec.id === 2 ? `
                      <div style="margin-top: 16px;">
                        <button type="button" class="family-btn-solid-teal" style="width: 100%; min-height: 46px; font-size: 15px; font-weight: 600; justify-content: center;" data-action="family-account-start-change-password" data-section="2">
                          ${familySvg('lock', 16)} <span>Cambiar contraseña</span>
                        </button>
                      </div>
                    ` : ''}
                  `}
                </div>
              ` : ''}
            </article>
          `;
        }).join('')}
      </div>
    `;

    // Soporte de navegación por teclado para el tablist accesible
    const nav = host.querySelector('.family-master-nav');
    if (nav) {
      nav.addEventListener('keydown', (e) => {
        const tabs = Array.from(nav.querySelectorAll('.family-master-nav-item'));
        const currentIndex = tabs.findIndex(tab => tab === document.activeElement);
        if (currentIndex === -1) return;

        let nextIndex = currentIndex;
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
          e.preventDefault();
          nextIndex = (currentIndex + 1) % tabs.length;
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
          e.preventDefault();
          nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        } else if (e.key === 'Home') {
          e.preventDefault();
          nextIndex = 0;
        } else if (e.key === 'End') {
          e.preventDefault();
          nextIndex = tabs.length - 1;
        }

        if (nextIndex !== currentIndex) {
          tabs[nextIndex].focus();
          tabs[nextIndex].click();
        }
      });
    }
  }

  // ------------------------------------------------------------------------
  // 6. REPORTE SEMANAL EN PDF (CONSERVADO INTACTO)
  // ------------------------------------------------------------------------
  function renderModernWeeklyReport() {
    const host = $('#familyWeeklyReport');
    if (!host || !familyPortalData) return;

    const student = familyPortalData.student || {};
    const school = familyPortalData.school || {};
    const academic = familyPortalData.academic || {};

    if (!student || !student.name) {
      host.innerHTML = `
        <div class="family-weekly-report-container" style="padding: 32px 16px; text-align: center;">
          <p style="color: #b91c1c; font-weight: 600; font-size: 15px;">No fue posible generar el reporte semanal porque no se cuenta con una identidad válida del alumno.</p>
          <button type="button" class="family-btn-outline" data-action="family-report-back" style="margin-top: 16px;">
            ← Volver al portal
          </button>
        </div>
      `;
      return;
    }

    const studentName = student.name;
    const groupName = school.group || student.group || '4.º A';
    const periodStr = academic.periodLabel || 'Semana 1 · Del 31 de agosto al 4 de septiembre de 2026';

    const attendanceDays = [
      { day: 'Lunes 31', status: 'Presente' },
      { day: 'Martes 1', status: 'Presente' },
      { day: 'Miércoles 2', status: 'Presente' },
      { day: 'Jueves 3', status: 'Presente' },
      { day: 'Viernes 4', status: 'Presente' }
    ];

    const tasksList = [
      { date: '31/08/2026', field: 'Lenguajes', name: 'Lectura comentada pág. 18', status: 'Entregada', grade: '10.0' },
      { date: '01/09/2026', field: 'Saberes y Pensamiento Científico', name: 'Ejercicios de multiplicación', status: 'Entregada', grade: '9.5' },
      { date: '03/09/2026', field: 'Ética, Naturaleza y Sociedades', name: 'Investigación de ecosistemas', status: 'Entregada', grade: '10.0' },
      { date: '04/09/2026', field: 'Saberes y Pensamiento Científico', name: 'Maqueta del Sistema Solar', status: 'Pendiente', grade: '—' }
    ];

    host.innerHTML = `
      <div class="family-weekly-report-container">
        <div class="family-report-actions-bar">
          <button type="button" class="family-btn-outline" data-action="family-report-back">
            ← Volver al portal
          </button>
          <button type="button" class="family-btn-solid-teal" data-action="family-print-report">
            🖨️ Imprimir / Guardar como PDF
          </button>
        </div>

        <div class="family-report-sheet">
          <div class="family-report-inst-header">
            <div class="family-report-inst-titles">
              <h2>Escuela Primaria Francisco Hoil Torres T.V.</h2>
              <p>C.C.T. 23DPR0136V · CICLO ESCOLAR 2026–2027 · TURNO VESPERTINO</p>
            </div>
            <img src="school-logo.webp" alt="Logo escolar" width="46" height="46">
          </div>

          <div class="family-report-sheet-banner">
            REPORTE SEMANAL DE DESEMPEÑO ACADÉMICO
          </div>

          <div class="family-report-metadata-grid">
            <div><strong>ALUMNO:</strong> ${escapeHtml(studentName)}</div>
            <div><strong>GRADO Y GRUPO:</strong> ${escapeHtml(groupName)}</div>
            <div><strong>PERIODO:</strong> ${escapeHtml(periodStr)}</div>
          </div>

          <div class="family-report-section-ribbon">REGISTRO DE ASISTENCIA SEMANAL</div>
          <table class="family-report-table">
            <thead>
              <tr>
                ${attendanceDays.map(d => `<th>${escapeHtml(d.day)}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              <tr>
                ${attendanceDays.map(d => `<td style="color: #166534; font-weight: 700;">✓ ${escapeHtml(d.status)}</td>`).join('')}
              </tr>
            </tbody>
          </table>

          <div class="family-report-section-ribbon">ACTIVIDADES Y TAREAS EVALUADAS</div>
          <table class="family-report-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Campo Formativo</th>
                <th>Actividad</th>
                <th>Estado</th>
                <th>Calificación</th>
              </tr>
            </thead>
            <tbody>
              ${tasksList.map(t => `
                <tr>
                  <td>${escapeHtml(t.date)}</td>
                  <td>${escapeHtml(t.field)}</td>
                  <td>${escapeHtml(t.name)}</td>
                  <td>${escapeHtml(t.status)}</td>
                  <td><strong>${escapeHtml(t.grade)}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="family-report-section-ribbon">OBSERVACIONES Y RECOMENDACIONES DEL MAESTRO</div>
          <div style="border: 1px solid #cbd5e1; padding: 12px 14px; font-size: 12px; line-height: 1.5; color: #334155; margin-bottom: 24px;">
            ${window.__familyDemoActive
              ? 'Mateo ha demostrado un avance muy favorable durante esta semana. Mantiene una conducta adecuada, participa de manera activa en las dinámicas grupales y sus entregas reflejan dedicación. Se recomienda continuar fortaleciendo los proyectos de indagación científica en casa.'
              : `${escapeHtml(studentName)} mantiene un avance constante en sus actividades académicas y formativas. Los registros de evaluación se actualizan permanentemente en el portal escolar.`}
          </div>

          <div style="display: flex; justify-content: space-around; margin-top: 36px; padding-top: 14px; text-align: center; font-size: 11.5px; color: #475569;">
            <div style="border-top: 1px solid #94a3b8; width: 220px; padding-top: 4px;">
              Prof. Michel Otaner Polledo Nieves<br><strong>Maestro de Grupo 4.º A</strong>
            </div>
            <div style="border-top: 1px solid #94a3b8; width: 220px; padding-top: 4px;">
              Firma de enterado(a)<br><strong>Madre, Padre o Tutor</strong>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ------------------------------------------------------------------------
  // NAVEGACIÓN Y CONMUTACIÓN DE VISTAS CON HISTORY API
  // ------------------------------------------------------------------------
  function showFamilyViewModern(id, pushHistory = true) {
    familyActiveTab = id;

    // Actualizar botones en Top Bar 2 (Desktop)
    $$('.family-top-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === id);
    });

    // Actualizar botones en barra móvil inferior
    $$('.family-bottom-nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === id);
    });

    // Conmutar paneles en el DOM
    $$('.family-view').forEach(view => {
      view.classList.toggle('active', view.id === id);
    });

    // Ocultar Consultar otro periodo en Datos y Cuenta (Requisito 8)
    const otherPeriods = $('.family-other-periods');
    if (otherPeriods) {
      const allowed = (id === 'familyOverview' || id === 'familyTasks' || id === 'familyGrades');
      otherPeriods.style.display = allowed ? 'block' : 'none';
    }

    // Actualizar URL y entrada de historial
    syncUrlAndHistory(id, familyCurrentDate, pushHistory);

    window.scrollTo({ top: 0, behavior: 'instant' });

    // Renderizar la vista activa
    if (id === 'familyOverview') renderModernOverview();
    else if (id === 'familyTasks') renderModernTasks();
    else if (id === 'familyGrades') renderModernGrades();
    else if (id === 'familyProfile') {
      if (typeof window !== 'undefined' && window.innerWidth < 900 && familyProfileEditingSection === -1) {
        familyProfileMobileOpenSection = -1;
      }
      if (!window.__familyDemoActive && !familyPortalData?.profile && !familyProfileLoading) {
        loadFamilyDirectoryProfile();
      }
      renderModernProfileAccordion();
    }
    else if (id === 'familyAccount') {
      if (typeof window !== 'undefined' && window.innerWidth < 900 && familyAccountEditingSection === -1) {
        familyAccountMobileOpenSection = -1;
      }
      renderModernAccount();
    }
    else if (id === 'familyWeeklyReport') renderModernWeeklyReport();
  }

  function setFamilyDateModern(newDate, pushHistory = true) {
    if (!newDate) return;
    familyCurrentDate = newDate;
    window.familyCurrentDate = newDate;
    if (window.__familyDemoActive && typeof window.setDemoWeek === 'function') {
      const p = getPeriodForDate(newDate);
      const w = String(p.number);
      if (w !== sessionStorage.getItem('family_demo_week')) {
        window.setDemoWeek(w, newDate, pushHistory);
        return;
      }
    }
    syncUrlAndHistory(familyActiveTab, newDate, pushHistory);
    if (familyActiveTab === 'familyOverview') {
      renderModernOverview();
    } else if (familyActiveTab === 'familyTasks') {
      renderModernTasks();
    } else if (familyActiveTab === 'familyGrades') {
      renderModernGrades();
    }
  }

  // RENDER MAESTRO DEL PORTAL FAMILIAR
  function renderFamilyPortalModern() {
    if (!familyPortalData) return;

    // Leer parámetros iniciales de URL si existen (soporte para F5)
    const urlParams = new URLSearchParams(window.location.search);
    const slug = urlParams.get('vista');
    const dateParam = urlParams.get('fecha');

    if (slug && SLUG_VIEW_MAP[slug]) {
      familyActiveTab = SLUG_VIEW_MAP[slug];
    }
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      familyCurrentDate = dateParam;
    }

    ensureModernShell();
    showFamilyViewModern(familyActiveTab, false);

    // Comprobar popup de actualización si aplica
    if (typeof checkAndNotifyIncompleteFamilyProfile === 'function') {
      checkAndNotifyIncompleteFamilyProfile();
    }
  }

  // ------------------------------------------------------------------------
  // REGISTRO DE ACCIONES DESACOPLADAS (REGLA #2 GEMINI.MD)
  // ------------------------------------------------------------------------
  window.actions = window.actions || {};

  window.actions['family-tab-click'] = (btn) => {
    const viewId = btn.dataset.view;
    if (viewId) showFamilyViewModern(viewId, true);
  };

  window.actions['family-date-day-click'] = (btn) => {
    const date = btn.dataset.date;
    if (date) setFamilyDateModern(date, true);
  };

  window.actions['family-date-today'] = () => {
    const curPeriod = getPeriodForDate(familyCurrentDate);
    const targetDate = curPeriod.defaultDate || curPeriod.startMondayIso;
    setFamilyDateModern(targetDate, true);
  };

  window.actions['family-date-prev-day'] = () => {
    const calendar = window.CARPETA_PLANNING_CALENDAR;
    if (calendar?.shiftDay) {
      setFamilyDateModern(calendar.shiftDay(familyCurrentDate, -1), true);
    } else {
      const d = new Date(familyCurrentDate + 'T00:00:00');
      d.setDate(d.getDate() - 1);
      setFamilyDateModern(d.toISOString().split('T')[0], true);
    }
  };

  window.actions['family-date-next-day'] = () => {
    const calendar = window.CARPETA_PLANNING_CALENDAR;
    if (calendar?.shiftDay) {
      setFamilyDateModern(calendar.shiftDay(familyCurrentDate, 1), true);
    } else {
      const d = new Date(familyCurrentDate + 'T00:00:00');
      d.setDate(d.getDate() + 1);
      setFamilyDateModern(d.toISOString().split('T')[0], true);
    }
  };

  window.actions['family-open-date-picker'] = () => {
    const input = $('#familyHiddenDateInput');
    if (input) {
      if (typeof input.showPicker === 'function') input.showPicker();
      else input.click();
    }
  };

  window.actions['family-refresh-date'] = () => {
    renderModernOverview();
  };

  window.actions['family-view-weekly-report'] = () => {
    showFamilyViewModern('familyWeeklyReport', true);
  };

  window.actions['family-report-back'] = () => {
    showFamilyViewModern('familyOverview', true);
  };

  window.actions['family-print-report'] = () => {
    window.print();
  };

  window.actions['family-tasks-scope'] = (btn) => {
    const scope = btn.dataset.scope;
    if (scope && (scope === 'week' || scope === 'day')) {
      familyTasksScope = scope;
      renderModernTasks();
    }
  };

  window.actions['family-tasks-day-click'] = (btn) => {
    const date = btn.dataset.date;
    if (date) {
      setFamilyDateModern(date, true);
    }
  };

  window.actions['family-tasks-filter'] = (btn) => {
    const filter = btn.dataset.filter;
    if (filter) {
      familyTasksFilter = filter;
      renderModernTasks();
    }
  };

  // Botón independiente para desglose de calificaciones (Requisito 6)
  window.actions['family-grade-breakdown-toggle'] = (btn) => {
    const fieldName = btn.dataset.field;
    if (!fieldName) return;
    familyGradeBreakdowns[fieldName] = !familyGradeBreakdowns[fieldName];
    renderModernGrades();
  };

  // Consultar otro periodo (Selector compacto de periodos escolares)
  function navigateToPeriod(targetPeriod, pushHistory = true) {
    if (!targetPeriod) return;
    const targetDate = targetPeriod.defaultDate || targetPeriod.startMondayIso;
    if (window.__familyDemoActive && typeof window.setDemoWeek === 'function') {
      window.setDemoWeek(targetPeriod.number, targetDate, pushHistory);
    } else {
      setFamilyDateModern(targetDate, pushHistory);
    }
    const live = $('#familyPeriodLiveRegion');
    if (live) {
      live.textContent = `Semana ${targetPeriod.number} seleccionada: ${targetPeriod.rangeLabel}.`;
    }
  }

  window.actions['family-period-prev-week'] = () => {
    const curPeriod = getPeriodForDate(familyCurrentDate);
    if (curPeriod.number <= 1) return;
    const targetPeriod = getPeriodByNumber(curPeriod.number - 1);
    navigateToPeriod(targetPeriod, true);
  };

  window.actions['family-period-next-week'] = () => {
    const periods = getSchoolPeriods();
    const curPeriod = getPeriodForDate(familyCurrentDate);
    if (curPeriod.number >= periods.length) return;
    const targetPeriod = getPeriodByNumber(curPeriod.number + 1);
    navigateToPeriod(targetPeriod, true);
  };

  window.actions['noop'] = () => {};

  window.actions['family-toggle-period-panel'] = () => {
    familyPeriodPanelOpen = !familyPeriodPanelOpen;
    familyPeriodNoticeDismissed = false;
    if (familyActiveTab === 'familyOverview') renderModernOverview();
    else if (familyActiveTab === 'familyTasks') renderModernTasks();
    else if (familyActiveTab === 'familyGrades') renderModernGrades();
  };

  window.actions['family-select-period'] = (btn) => {
    const periodId = btn.dataset.periodId;
    familyPeriodPanelOpen = false;
    if (window.__familyDemoActive && typeof window.setDemoWeek === 'function') {
      window.setDemoWeek(periodId);
      const live = $('#familyPeriodLiveRegion');
      if (live) live.textContent = `Periodo cambiado a Semana ${periodId}.`;
      if (typeof toast === 'function') toast(`Periodo cambiado a Semana ${periodId}.`);
    }
  };

  window.actions['family-dismiss-period-notice'] = () => {
    familyPeriodNoticeDismissed = true;
    familyPeriodPanelOpen = false;
    if (familyActiveTab === 'familyOverview') renderModernOverview();
    else if (familyActiveTab === 'familyTasks') renderModernTasks();
    else if (familyActiveTab === 'familyGrades') renderModernGrades();
  };

  // Acciones de Datos Familiares (Requisito 7)
  window.actions['family-profile-select-section'] = (item) => {
    const secId = Number(item.dataset.section);
    if (!isNaN(secId)) {
      familyProfileActiveSection = secId;
      familyProfileEditingSection = -1;
      renderModernProfileAccordion();
      const btn = document.querySelector(`.family-master-nav-item[data-section="${secId}"]`);
      if (btn) btn.focus();
    }
  };

  window.actions['family-profile-edit'] = (btn) => {
    const secId = Number(btn.dataset.section);
    if (!isNaN(secId)) {
      familyProfileEditingSection = secId;
      renderModernProfileAccordion();
    }
  };

  window.actions['family-profile-cancel'] = () => {
    familyProfileEditingSection = -1;
    renderModernProfileAccordion();
  };

  window.actions['family-profile-retry'] = () => {
    loadFamilyDirectoryProfile();
  };

  window.actions['family-profile-save'] = (btn) => {
    const secId = Number(btn?.dataset?.section ?? familyProfileEditingSection);
    const form = document.querySelector('#familySectionEditForm') || document.querySelector('#familySectionEditFormMobile');
    if (form && !isNaN(secId) && secId >= 0) {
      saveProfileSectionData(secId, form);
    }
    familyProfileEditingSection = -1;
    renderModernProfileAccordion();
    if (typeof toast === 'function') toast('Información familiar guardada correctamente.');
  };

  window.actions['family-mob-acc-toggle'] = (header) => {
    const secId = Number(header.dataset.section);
    if (!isNaN(secId)) {
      familyProfileMobileOpenSection = (familyProfileMobileOpenSection === secId) ? -1 : secId;
      familyProfileEditingSection = -1;
      renderModernProfileAccordion();
    }
  };

  // Acciones de Mi Cuenta y Seguridad (Requisito 10)
  window.actions['family-account-select-section'] = (item) => {
    const secId = Number(item.dataset.section);
    if (!isNaN(secId)) {
      familyAccountActiveSection = secId;
      familyAccountEditingSection = -1;
      renderModernAccount();
      const btn = document.querySelector(`.family-account-master-detail .family-master-nav-item[data-section="${secId}"]`);
      if (btn) btn.focus();
    }
  };

  window.actions['family-account-mob-acc-toggle'] = (header) => {
    const secId = Number(header.dataset.section);
    if (!isNaN(secId)) {
      familyAccountMobileOpenSection = (familyAccountMobileOpenSection === secId) ? -1 : secId;
      familyAccountEditingSection = -1;
      renderModernAccount();
    }
  };

  window.actions['family-account-edit'] = (btn) => {
    const secId = Number(btn.dataset.section);
    if (!isNaN(secId)) {
      familyAccountEditingSection = secId;
      renderModernAccount();
    }
  };

  window.actions['family-account-cancel'] = () => {
    familyAccountEditingSection = -1;
    familyAccountShowNewPass = false;
    familyAccountShowConfirmPass = false;
    renderModernAccount();
  };

  window.actions['family-account-save-recovery'] = () => {
    const form = document.querySelector('#familyAccountRecoveryForm') || document.querySelector('#familyAccountRecoveryFormMobile');
    if (!form || !familyPortalData) return;
    const emailInput = form.querySelector('[name="email"]');
    const phoneInput = form.querySelector('[name="phone"]');
    const emailVal = emailInput ? emailInput.value.trim() : '';
    const phoneVal = phoneInput ? phoneInput.value.trim() : '';

    if (!emailVal || !emailVal.includes('@') || !emailVal.includes('.')) {
      if (typeof toast === 'function') toast('Por favor ingresa un correo de recuperación válido.');
      return;
    }
    if (!phoneVal || phoneVal.length < 7) {
      if (typeof toast === 'function') toast('Por favor ingresa un número de teléfono válido.');
      return;
    }

    familyPortalData.account = familyPortalData.account || {};
    familyPortalData.account.email = emailVal;
    familyPortalData.account.phone = phoneVal;
    if (familyPortalData.profile) {
      familyPortalData.profile.tutorTelefono = phoneVal;
    }

    familyAccountEditingSection = -1;
    renderModernAccount();
    if (typeof toast === 'function') toast('Medios de recuperación guardados correctamente.');
  };

  window.actions['family-account-start-change-password'] = () => {
    familyAccountEditingSection = 2;
    familyAccountShowNewPass = false;
    familyAccountShowConfirmPass = false;
    renderModernAccount();
  };

  window.actions['family-account-toggle-pass-visibility'] = (btn) => {
    const field = btn?.dataset?.field;
    const newPassInput = document.querySelector('#famAccountNewPass') || document.querySelector('#mobFamAccountNewPass');
    const confirmPassInput = document.querySelector('#famAccountConfirmPass') || document.querySelector('#mobFamAccountConfirmPass');
    const newPassVal = newPassInput ? newPassInput.value : '';
    const confirmPassVal = confirmPassInput ? confirmPassInput.value : '';

    if (field === 'new') {
      familyAccountShowNewPass = !familyAccountShowNewPass;
    } else if (field === 'confirm') {
      familyAccountShowConfirmPass = !familyAccountShowConfirmPass;
    }

    renderModernAccount();

    const newPassAfter = document.querySelector('#famAccountNewPass') || document.querySelector('#mobFamAccountNewPass');
    const confirmPassAfter = document.querySelector('#famAccountConfirmPass') || document.querySelector('#mobFamAccountConfirmPass');
    if (newPassAfter) newPassAfter.value = newPassVal;
    if (confirmPassAfter) confirmPassAfter.value = confirmPassVal;
  };

  window.actions['family-account-save-password'] = () => {
    const form = document.querySelector('#familyAccountPasswordForm') || document.querySelector('#familyAccountPasswordFormMobile');
    if (!form || !familyPortalData) return;
    const newPassInput = form.querySelector('[name="newPassword"]');
    const confirmPassInput = form.querySelector('[name="confirmPassword"]');
    const newPass = newPassInput ? newPassInput.value : '';
    const confirmPass = confirmPassInput ? confirmPassInput.value : '';

    if (!newPass || newPass.length < 8) {
      if (typeof toast === 'function') toast('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (newPass !== confirmPass) {
      if (typeof toast === 'function') toast('Las contraseñas ingresadas no coinciden.');
      return;
    }

    familyPortalData.account = familyPortalData.account || {};
    familyPortalData.account.temporaryPassword = newPass;
    familyPortalData.account.lastPasswordChange = 'Hoy, ' + new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
    familyAccountEditingSection = -1;
    familyAccountShowNewPass = false;
    familyAccountShowConfirmPass = false;
    renderModernAccount();
    if (typeof toast === 'function') toast('Contraseña actualizada correctamente.');
  };

  window.actions['family-toggle-change-password'] = () => {
    const section = $('#familyPasswordChangeSection');
    if (section) {
      section.style.display = (section.style.display === 'none' || !section.style.display) ? 'block' : 'none';
    }
  };

  // Reemplazar / conectar funciones globales
  window.renderFamilyPortal = renderFamilyPortalModern;
  window.renderFamilyAcademic = renderFamilyPortalModern;
  window.showFamilyView = showFamilyViewModern;
  window.renderFamilyWeeklyReport = renderModernWeeklyReport;
  window.setFamilyDateModern = setFamilyDateModern;

})();
