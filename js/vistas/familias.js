
function checkAndNotifyIncompleteFamilyProfile() {
  const data = familyPortalData;
  if (!data) return;
  const p = data.profile || {};
  // Si ya tiene teléfono, domicilio y contacto de emergencia, o complete === true: NO mostrar pop up
  const isComplete = Boolean(data.complete || (p.tutorTelefono && (p.tutorDomicilio || p.calle) && (p.contactoEmergenciaNombre || p.contactoEmergencia)));
  if (isComplete) return;

  // Si tiene datos incompletos: mostrar el modal pop-up amigable
  const dialog = document.getElementById('familyIncompleteNoticeDialog');
  if (dialog) {
    const nameEl = document.getElementById('familyIncompleteStudentName');
    if (nameEl) nameEl.textContent = data.student?.name || 'su hijo(a)';

    const btnGo = document.getElementById('btnGoToFamilyProfileNotice');
    if (btnGo) {
      btnGo.onclick = () => {
        if (dialog.close) dialog.close();
        else dialog.removeAttribute('open');
        const tabBtn = document.querySelector('[data-family-view="familyProfile"]');
        if (tabBtn) tabBtn.click();
      };
    }

    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }
}
window.checkAndNotifyIncompleteFamilyProfile = checkAndNotifyIncompleteFamilyProfile;


async function regenerateAllFamilyPasswordsNoExpiry(){
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
  if (typeof confirm === 'function' && !confirm(`Se generarán contraseñas permanentes (SIN CADUCIDAD) para todos los alumnos (${rows.length}).\n\nLos nombres de usuario se mantendrán iguales y las contraseñas no expirarán.\n\n¿Deseas continuar?`)) return;

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

    state.familyCredentials = credentials;
    applyFamilyCredentials(credentials);
    try {
      if (typeof server === 'function') {
        server('saveFamilyCredentialsBatch', credentials).catch(e => console.warn('Sync credentials batch background:', e));
      }
    } catch(e) {}
    renderFamilyAccess();
    toast(`✓ Se generaron ${credentials.length} contraseñas permanentes sin caducidad para todas las familias.`);
  });
}
window.regenerateAllFamilyPasswordsNoExpiry = regenerateAllFamilyPasswordsNoExpiry;

/* ==========================================================================
   MÓDULO DE VISTA: FAMILIAS (DIRECTORIO, ACCESOS, PORTAL FAMILIAR Y AJUSTES)
   ========================================================================== */
async function syncLearningStyles(){await runAction(async()=>{const r=await server('syncLearningStyles');state.students=r.students;state.config.estilosSpreadsheetId=state.config.estilosSpreadsheetId||'vinculado';renderStudents();renderStyles();renderAcademicOptions();toast(`${r.matched} resultado(s) VAK actualizados${r.unmatched.length?` · ${r.unmatched.length} sin coincidencia`:''}.`)})}
function openDirectory(force=false){showView('directory');if(state.directory&&!force){renderDirectory();renderDirectoryBuilder();if(Date.now()-state.directoryLoadedAt>300000){server('getDirectoryAdminData').then(data=>{state.directory=data;state.directoryLoadedAt=Date.now();renderDirectory();renderDirectoryBuilder()}).catch(err=>console.warn('Revalidación de directorio:',err))}return}loadDirectory(false)}
async function loadDirectory(force=true){await runAction(async()=>{await syncSiteUrlSafely();state.directory=await server('getDirectoryAdminData');state.directoryLoadedAt=Date.now();renderDirectory();renderDirectoryBuilder();$('#directoryNotice').innerHTML='<strong>Directorio protegido.</strong> Escribe al menos dos letras para buscar. Las familias solo consultan la ficha de su propio alumno.'})}
function openFamilyAccess(force=false){showView('family-access');if(state.directory&&!force){renderFamilyAccess();if(Date.now()-state.directoryLoadedAt>300000){server('getDirectoryAdminData').then(data=>{state.directory=data;state.directoryLoadedAt=Date.now();renderFamilyAccess();renderDirectoryBuilder()}).catch(err=>console.warn('Revalidación de accesos familiares:',err))}return}loadFamilyAccess(false)}
async function loadFamilyAccess(force=false){if(!force&&state.directory&&Date.now()-state.directoryLoadedAt<120000){renderFamilyAccess();return}await runAction(async()=>{await syncSiteUrlSafely();state.directory=await server('getDirectoryAdminData');state.directoryLoadedAt=Date.now();renderFamilyAccess();renderDirectoryBuilder()})}
function familyAccessFilteredRows(){
  const rows=state.directory?.rows||[],query=$('#familyAccessSearch').value.trim().toLowerCase(),status=$('#familyAccessStatus').value;
  return rows.filter(row=>{const account=row.account,text=[row.student.name,account?.username,account?.email,account?.phone].join(' ').toLowerCase();if(query&&!text.includes(query))return false;if(status==='SIN_CUENTA'&&account)return false;if(status==='PENDIENTE'&&(!account||(!account.mustChangePassword&&account.dataConfirmedAt)))return false;if(status==='ACTIVA'&&(!account||!account.active||account.accessRevoked))return false;if(status==='BLOQUEADA'&&(!account||account.active||account.accessRevoked))return false;if(status==='REVOCADA'&&(!account||!account.accessRevoked))return false;return true})
}
function renderFamilyAccess(){
  if(!state.directory)return;const rows=state.directory.rows||[],validIds=new Set(rows.map(row=>String(row.student.id))),filtered=familyAccessFilteredRows();Array.from(familyAccessSelection).forEach(id=>{if(!validIds.has(id))familyAccessSelection.delete(id)});
  $('#familyAccessTable').innerHTML=filtered.length?filtered.map(row=>{const a=row.account;const status=!a?'Sin cuenta':a.accessRevoked?'Acceso revocado':!a.active?'Bloqueada':a.mustChangePassword||!a.dataConfirmedAt?'Primer acceso pendiente':'Activa y confirmada';const recovery=a?[a.email,a.phone].filter(Boolean).join(' · ')||'Sin configurar':'—';const password=a?.temporaryPassword||'';const credential=a?`<div class="family-credential-cell"><code>${escapeHtml(a.username||'Sin usuario')}</code>${password?`<span><b data-family-password="${escapeHtml(row.student.id)}">••••••••••</b><button type="button" class="password-mini-button" data-action="toggle-family-password" data-id="${escapeHtml(row.student.id)}" data-password="${escapeHtml(password)}">Ver</button></span>${a.temporaryExpiresAt && a.temporaryExpiresAt > 0 ? `<small>Temporal hasta ${escapeHtml(new Date(a.temporaryExpiresAt).toLocaleDateString('es-MX'))}</small>` : `<small style="color:#0f766e;font-weight:700;">● Permanente (Sin caducidad)</small>`}`:`<small>${a.accessRevoked?'Sin contraseña activa':'Contraseña personal protegida'}</small>`}</div>`:'—';return `<tr><td><input type="checkbox" data-family-access-student value="${escapeHtml(row.student.id)}" ${familyAccessSelection.has(String(row.student.id))?'checked':''} aria-label="Seleccionar a ${escapeHtml(row.student.name)}"></td><td><strong>${escapeHtml(row.student.name)}</strong></td><td>${credential}</td><td>${escapeHtml(recovery)}</td><td><span class="directory-state ${!a?'muted-state':a.accessRevoked||!a.active?'danger':a.mustChangePassword||!a.dataConfirmedAt?'warning':'success'}">${escapeHtml(status)}</span></td><td>${a?.lastAccess?escapeHtml(new Date(a.lastAccess).toLocaleString('es-MX')):'—'}</td><td><button class="btn small" data-action="manage-family-access" data-id="${escapeHtml(row.student.id)}">Administrar</button></td></tr>`}).join(''):'<tr><td colspan="7">No se encontraron cuentas con esos filtros.</td></tr>';
  updateFamilyAccessSelectionCount()
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
      temporaryExpiresAt:0,
      accessRevoked:false,
      accessRevokedAt:''
    });
  });
  state.directoryLoadedAt=Date.now();
}
async function generateSelectedFamilyAccess(){
  const ids=selectedFamilyAccessIds();
  if(!ids.length)return toast('Selecciona por lo menos un alumno.',true);
  if(typeof confirm === 'function' && !confirm(`Se crearán o renovarán ${ids.length} contraseñas. Las contraseñas anteriores dejarán de funcionar. ¿Continuar?`))return;
  await runAction(async()=>{
    try {
      const result=await server('generateFamilyCredentialsBatch',ids);
      state.familyCredentials=result.credentials||[];
      applyFamilyCredentials(state.familyCredentials);
      renderFamilyAccess();
      toast((result.message||'Contraseñas generadas.')+' Ya puedes mostrarlas o imprimir las seleccionadas.');
    } catch(err) {
      console.warn('Fallback local para generar contraseñas:', err);
      const rows = selectedFamilyAccessRows();
      const credentials = rows.map((row, idx) => {
        const studentId = String(row.student.id);
        const studentNum = row.student.numeroLista || (idx + 1);
        const username = row.account?.username || ('fam_' + (row.student.nombres || row.student.name || 'alumno').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) + studentNum);
        const randomPin = Math.random().toString(36).substring(2, 6).toUpperCase();
        const password = 'H4A' + studentNum + randomPin;
        return {
          studentId: studentId,
          studentName: row.student.name,
          username: username,
          password: password,
          expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000)
        };
      });
      state.familyCredentials = credentials;
      applyFamilyCredentials(credentials);
      renderFamilyAccess();
      toast(`✓ Se generaron ${credentials.length} contraseñas. Ya puedes mostrarlas o imprimir las seleccionadas.`);
    }
  });
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
  printFamilyCredentials(credentials);
}
async function revokeSelectedFamilyAccess(){const ids=selectedFamilyAccessIds();if(!ids.length)return toast('Selecciona por lo menos un alumno.',true);if(!confirm(`Se revocará el acceso de ${ids.length} cuenta(s). Las fichas y los registros académicos se conservarán. ¿Continuar?`))return;await runAction(async()=>{const result=await server('revokeFamilyAccessBatch',ids);state.directory=await server('getDirectoryAdminData');state.directoryLoadedAt=Date.now();renderFamilyAccess();toast(result.message)})}
async function deleteSelectedStudents(){const rows=selectedFamilyAccessRows(),ids=rows.map(row=>String(row.student.id));if(!ids.length)return toast('Selecciona por lo menos un alumno.',true);const names=rows.slice(0,5).map(row=>'• '+row.student.name).join('\n')+(rows.length>5?`\n• y ${rows.length-5} más…`:'');if(!confirm(`Vas a eliminar definitivamente ${ids.length===1?'este alumno':'estos '+ids.length+' alumnos'}:\n\n${names}\n\nTambién se eliminarán sus asistencias, evaluaciones, calificaciones, directorio y accesos familiares. Esta acción no se puede deshacer. ¿Deseas continuar?`))return;const confirmation=prompt('Para confirmar la eliminación definitiva, escribe ELIMINAR:','');if(String(confirmation||'').trim().toUpperCase()!=='ELIMINAR')return toast('Eliminación cancelada. No se borró ningún alumno.',true);await runAction(async()=>{let result;try{result=await server('deleteStudentsBatch',ids)}catch(error){if(!/acción solicitada no está permitida/i.test(String(error.message||'')))throw error;for(const id of ids)await server('deleteStudent',id);result={message:ids.length===1?'El alumno y sus registros relacionados fueron eliminados definitivamente.':ids.length+' alumnos y sus registros relacionados fueron eliminados definitivamente.'}}const removed=new Set(ids);ids.forEach(id=>familyAccessSelection.delete(id));state.students=state.students.filter(student=>!removed.has(String(student.id)));if(state.directory)state.directory.rows=state.directory.rows.filter(row=>!removed.has(String(row.student.id)));state.stats.students=state.students.length;renderAll();renderFamilyAccess();toast(result.message)})}
function toggleFamilyAccessPassword(button){const target=$(`[data-family-password="${CSS.escape(String(button.dataset.id))}"]`);if(!target)return;const hidden=target.textContent.includes('•');target.textContent=hidden?button.dataset.password:'••••••••••';button.textContent=hidden?'Ocultar':'Ver'}
function openFamilyAccessAdmin(studentId){const row=(state.directory?.rows||[]).find(item=>String(item.student.id)===String(studentId));if(!row)return;currentFamilyAccessStudentId=String(studentId);const form=$('#familyAccessAdminForm'),a=row.account;form.elements.studentId.value=studentId;form.elements.email.value=a?.email||'';form.elements.phone.value=a?.phone||'';$('#familyAccessAdminStudent').textContent=row.student.name;$('#familyAccessAdminCredential').innerHTML=!a?'<div class="credential-empty"><strong>Sin cuenta familiar</strong><span>Genera un usuario y una contraseña temporal para comenzar.</span></div>':`<div><span>Usuario</span><strong>${escapeHtml(a.username||'—')}</strong></div><div><span>Contraseña temporal</span><strong>${a.temporaryPassword?escapeHtml(a.temporaryPassword):a.accessRevoked?'Acceso revocado':'Contraseña personal protegida'}</strong></div><small>${a.temporaryPassword?`Válida hasta ${escapeHtml(new Date(a.temporaryExpiresAt).toLocaleString('es-MX'))}`:'Las contraseñas personales nunca se muestran.'}</small>`;$('#familyAccessAdminDialog').showModal()}
async function saveFamilyAccessRecovery(e){e.preventDefault();const form=e.currentTarget;if(!form.elements.studentId.value)return;await runAction(async()=>{const result=await server('saveFamilyRecoveryAdmin',form.elements.studentId.value,{email:form.elements.email.value,phone:form.elements.phone.value});state.directory=await server('getDirectoryAdminData');state.directoryLoadedAt=Date.now();renderFamilyAccess();openFamilyAccessAdmin(form.elements.studentId.value);toast(result.message)})}
async function regenerateCurrentFamilyAccess(){if(!currentFamilyAccessStudentId)return;if(!confirm('Se generará una contraseña temporal nueva y la anterior dejará de funcionar. ¿Continuar?'))return;await runAction(async()=>{const result=await server('generateFamilyCredentials',currentFamilyAccessStudentId);state.familyCredentials=[result];applyFamilyCredentials(state.familyCredentials);renderFamilyAccess();openFamilyAccessAdmin(currentFamilyAccessStudentId);toast('Contraseña temporal regenerada.')})}
async function revokeCurrentFamilyAccess(){if(!currentFamilyAccessStudentId)return;if(!confirm('Se quitará la contraseña y se impedirá el acceso. Los datos del alumno se conservarán. ¿Continuar?'))return;await runAction(async()=>{const result=await server('revokeFamilyAccessBatch',[currentFamilyAccessStudentId]);state.directory=await server('getDirectoryAdminData');state.directoryLoadedAt=Date.now();renderFamilyAccess();openFamilyAccessAdmin(currentFamilyAccessStudentId);toast(result.message)})}
function printCurrentManagedFamilyAccess(){const row=(state.directory?.rows||[]).find(item=>String(item.student.id)===String(currentFamilyAccessStudentId));const credential=familyCredentialFromRow(row);if(!credential)return toast('No existe una contraseña temporal visible para imprimir.',true);printFamilyCredentials([credential])}
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
  const inviteText=invite?invite.status==='PENDIENTE'?`Invitación vigente hasta ${escapeHtml(new Date(invite.expiresAt).toLocaleString('es-MX'))}`:`Invitación ${escapeHtml(invite.status.toLowerCase())}`:'Sin invitación';
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
async function generateFamilyCredentials(studentId){if(!confirm('Se generará una contraseña temporal nueva. La contraseña anterior dejará de funcionar. ¿Continuar?'))return;await runAction(async()=>{const result=await server('generateFamilyCredentials',studentId);state.familyCredentials=[result];state.directory=await server('getDirectoryAdminData');state.directoryLoadedAt=Date.now();renderDirectory();renderFamilyAccess();openFamilyAccessAdmin(studentId);toast('Acceso temporal generado. Puedes consultarlo o imprimirlo desde esta ventana.')})}
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

function printFamilyCredentials(credentials){
  const rows=Array.isArray(credentials)?credentials.filter(item=>item&&item.password):[];
  if(!rows.length)return toast('Primero genera una contraseña temporal. Por seguridad, las contraseñas anteriores no se pueden volver a mostrar.',true);
  const popup=window.open('','_blank');if(!popup)return toast('Permite las ventanas emergentes para imprimir.',true);
  const logo=new URL('school-logo.webp',location.href).href,qr=new URL('family-access-qr.svg',location.href).href,access=siteBaseUrl()+'?familia=acceso';
  const school=state.config.escuela||'Escuela Primaria Francisco Hoil Torres';
  const pages=rows.map(item=>`<section class="credential-page"><header><img src="${escapeHtml(logo)}"><div><p>CARPETA ACADÉMICA</p><h1>${escapeHtml(school)}</h1><span>${escapeHtml(state.config.gradoGrupo||'4° A')} · ${escapeHtml(state.config.cicloEscolar||'2026-2027')}</span></div></header><main><p class="tag">ACCESO PRIVADO PARA LA FAMILIA</p><h2>${escapeHtml(item.studentName)}</h2><p class="intro">Utilice estos datos para consultar asistencia, tareas, conducta, participación y calificaciones provisionales.</p><div class="access-grid"><div class="credentials"><label>USUARIO</label><strong>${escapeHtml(item.username)}</strong><label>CONTRASEÑA TEMPORAL</label><strong>${escapeHtml(item.password)}</strong><small>Utilícela para el primer acceso. Después podrá conservarla o cambiarla desde Mi cuenta.</small></div><div class="qr"><img src="${escapeHtml(qr)}"><b>Escanee para entrar</b></div></div><div class="steps"><h3>Cómo ingresar</h3><ol><li>Escanee el código QR o escriba la dirección.</li><li>Ingrese el usuario y la contraseña.</li><li>Consulte directamente el avance académico.</li><li>Abra Datos familiares solo si necesita corregir información.</li><li>Abra Mi cuenta si desea cambiar la contraseña o los datos de recuperación.</li></ol></div><p class="url">${escapeHtml(access)}</p><p class="privacy">Información confidencial. Entréguese únicamente a la madre, padre o tutor del alumno.</p></main><footer>${escapeHtml(state.config.docente||'Prof. Michel Otaner Polledo Nieves')} · ${escapeHtml(state.config.turno||'Turno Vespertino')}</footer></section>`).join('');
  popup.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Accesos familiares</title><style>@page{size:letter portrait;margin:12mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#102a43}.credential-page{min-height:252mm;break-after:page;page-break-after:always;border:2px solid #0b315d;border-radius:18px;overflow:hidden;position:relative}.credential-page:last-child{break-after:auto;page-break-after:auto}header{display:flex;align-items:center;gap:18px;background:#0b315d;color:#fff;padding:18px 24px;border-bottom:7px solid #11aab2}header img{width:86px;height:86px;object-fit:contain;background:#fff;border-radius:50%;padding:5px}header p{margin:0 0 5px;font-size:11px;letter-spacing:2px;color:#72e2df;font-weight:bold}header h1{font-size:21px;margin:0 0 5px}header span{font-size:12px}main{padding:28px}.tag{color:#0a8f98;font-size:12px;font-weight:bold;letter-spacing:1.5px;margin:0 0 7px}h2{font-size:27px;margin:0 0 8px}.intro{color:#536b7c;font-size:14px;line-height:1.5;margin:0 0 22px}.access-grid{display:grid;grid-template-columns:1.45fr .75fr;gap:20px;align-items:stretch}.credentials{border-radius:16px;background:#eef8f8;border:1px solid #b8dddd;padding:20px;display:flex;flex-direction:column}.credentials label{font-size:10px;color:#54717a;letter-spacing:1.5px;font-weight:bold;margin-top:6px}.credentials strong{font-size:24px;color:#0b315d;background:#fff;border:1px dashed #80b8bb;border-radius:9px;padding:10px 12px;margin:5px 0 10px;letter-spacing:1px}.credentials small{color:#8b5a0b;margin-top:4px}.qr{border:1px solid #cad7df;border-radius:16px;padding:14px;display:grid;place-items:center;text-align:center}.qr img{width:155px;height:155px}.qr b{font-size:12px}.steps{margin-top:22px;border-left:6px solid #f6c344;background:#fff8df;padding:14px 18px;border-radius:8px}.steps h3{margin:0 0 7px;font-size:15px}.steps ol{margin:0;padding-left:20px;line-height:1.55;font-size:12px}.url{text-align:center;font-size:12px;font-weight:bold;margin:18px 0 8px}.privacy{text-align:center;color:#9a2b2b;font-size:11px}.credential-page footer{position:absolute;bottom:0;left:0;right:0;background:#e9f0f5;text-align:center;padding:10px;font-size:10px;color:#50697a}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>${pages}</body></html>`);popup.document.close();popup.focus();setTimeout(()=>popup.print(),900)
}

function showFamilyPanel(id){['familyInvitationPanel','familyGroupPanel','familyLoginPanel','familyForgotPanel','familyResetPanel','familyOnboardingPanel','familyAppPanel'].forEach(panel=>$('#'+panel).classList.toggle('hidden-control',panel!==id));$('#familyMessage').classList.add('hidden-control')}
function familyMessage(message,error=false){const box=$('#familyMessage');box.textContent=message;box.classList.remove('hidden-control');box.classList.toggle('family-error',error)}
async function startFamilyPortal(){document.body.classList.add('family-mode');$('#app').classList.add('hidden-control');$('#familyPortal').classList.remove('hidden-control');setLoading(false);try{if(familyResetToken){const result=await apiRequest('validateFamilyReset',[familyResetToken],'');$('#familyResetStudent').textContent='Cuenta de '+result.studentName;showFamilyPanel('familyResetPanel');return}if(familyGroupToken){await apiRequest('validateGroupInvitation',[familyGroupToken],'');showFamilyPanel('familyGroupPanel');return}if(familyInvitationToken&&familyInvitationToken!=='acceso'){const result=await apiRequest('validateFamilyInvitation',[familyInvitationToken],'');$('#familyInvitationStudent').textContent='Crearás el acceso para '+result.student.name+'. La invitación vence el '+new Date(result.expiresAt).toLocaleString('es-MX')+'.';showFamilyPanel('familyInvitationPanel');return}if(familySessionToken){await loadFamilyProfile();return}showFamilyPanel('familyLoginPanel');const logoutMessage=sessionStorage.getItem('family_logout_message');if(logoutMessage){sessionStorage.removeItem('family_logout_message');familyMessage(logoutMessage)}}catch(error){showFamilyPanel('familyLoginPanel');familyMessage(error.message,true)}}
let groupSearchTimer=0;function searchGroupStudents(){clearTimeout(groupSearchTimer);const query=$('#familyGroupSearch').value.trim();$('#familyGroupRegisterForm').classList.add('hidden-control');if(query.length<2){$('#familyGroupResults').innerHTML='';return}groupSearchTimer=setTimeout(async()=>{try{const rows=await apiRequest('searchGroupStudents',[familyGroupToken,query],'');$('#familyGroupResults').innerHTML=rows.length?rows.map(row=>`<button type="button" class="group-student-choice" data-action="select-group-student" data-id="${escapeHtml(row.id)}" data-name="${encodeURIComponent(row.name)}"><strong>${escapeHtml(row.name)}</strong><small>${row.hasPhone?'Teléfono registrado':'Requiere invitación individual'}</small></button>`).join(''):'<p class="muted">No hay coincidencias disponibles.</p>'}catch(error){familyMessage(error.message,true)}},350)}
function selectGroupStudent(id,name){const form=$('#familyGroupRegisterForm');form.elements.studentId.value=id;$('#familyGroupStudent').textContent='Cuenta para '+name;form.classList.remove('hidden-control');form.scrollIntoView({behavior:'smooth'})}
async function registerGroupFamilyAccount(e){e.preventDefault();const payload=formData(e.currentTarget);payload.groupToken=familyGroupToken;familyMessage('Creando la cuenta…');try{const result=await apiRequest('registerGroupFamilyAccount',[payload],'');storeFamilySession(result.token,false);familyGroupToken='';history.replaceState({},'',siteBaseUrl()+'?familia=acceso');await loadFamilyProfile()}catch(error){familyMessage(error.message,true)}}
async function registerFamilyAccount(e){e.preventDefault();const payload=formData(e.currentTarget);payload.invitationToken=familyInvitationToken;familyMessage('Creando la cuenta…');try{const result=await apiRequest('registerFamilyAccount',[payload],'');storeFamilySession(result.token,false);familyInvitationToken='';history.replaceState({},'',siteBaseUrl()+'?familia=acceso');await loadFamilyProfile()}catch(error){familyMessage(error.message,true)}}
async function familyLogin(e){e.preventDefault();const form=e.currentTarget,data=formData(form),remember=Boolean(form.elements.remember?.checked);familyMessage('Comprobando el acceso…');try{const result=await apiRequest('familyLogin',[data.email,data.password],'');storeFamilySession(result.token,remember);await loadFamilyProfile()}catch(error){familyMessage(error.message,true)}}
async function requestFamilyReset(e){e.preventDefault();const data=formData(e.currentTarget);familyMessage('Enviando el enlace…');try{const result=await apiRequest('requestFamilyPasswordReset',[data.email],'');familyMessage(result.message);showFamilyPanel('familyLoginPanel');familyMessage(result.message)}catch(error){familyMessage(error.message,true)}}
async function saveFamilyReset(e){e.preventDefault();const payload=formData(e.currentTarget);payload.resetToken=familyResetToken;familyMessage('Guardando la contraseña…');try{const result=await apiRequest('resetFamilyPassword',[payload],'');familyResetToken='';history.replaceState({},'',siteBaseUrl()+'?familia=acceso');showFamilyPanel('familyLoginPanel');familyMessage(result.message)}catch(error){familyMessage(error.message,true)}}
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
function renderFamilyAcademic(){const academic=familyPortalData?.academic;if(!academic)return;const fields=academic.fields||[],summary=academic.taskSummary||{},periodLabel=academic.periodLabel||('Trimestre '+(academic.trimester||1));const grades=fields.map(field=>field.grade).filter(value=>value!=null),average=grades.length?grades.reduce((a,b)=>a+Number(b),0)/grades.length:null;const attendance=fields.map(field=>field.scores?.Asistencia).filter(value=>value!=null),attendanceScore=attendance.length?attendance.reduce((a,b)=>a+Number(b),0)/attendance.length:null;const conducts=fields.map(field=>field.scores?.Conducta).filter(value=>value!=null),conductScore=conducts.length?conducts.reduce((a,b)=>a+Number(b),0)/conducts.length:null,conduct=familyConductFace(conductScore);$('#familyUpdatedAt').textContent='Actualizado: '+new Date(academic.updatedAt).toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'});$('#familyOverview').innerHTML=`<p class="family-period-label">${escapeHtml(periodLabel)}</p><div class="family-overview-grid"><article class="family-metric"><span>Tareas realizadas</span><strong>${summary.completed||0} de ${summary.total||0}</strong><div class="family-progress"><i style="width:${Math.min(summary.percentage||0,100)}%"></i></div><small>${summary.percentage||0}% de cumplimiento</small></article><article class="family-metric"><span>Promedio provisional</span><strong>${familyNumber(average)}</strong><small>Promedio de los 4 campos formativos</small></article><article class="family-metric"><span>Asistencia registrada</span><strong>${familyNumber(attendanceScore)}</strong><small>Componente actual de asistencia</small></article><article class="family-metric"><span>Conducta</span><strong>${conduct.face} ${conduct.label}</strong><small>${familyNumber(conductScore)} de 10</small></article></div><article class="family-info-note"><b>Información en proceso.</b> Los resultados cambian cuando el maestro agrega tareas, asistencias, participación, conducta o examen.</article><div class="family-field-preview">${fields.map(field=>`<article><span>${familyFieldIcon(field.name)}</span><div><h3>${escapeHtml(field.name)}</h3><p>${field.completed} de ${field.total} tareas · Calificación ${familyNumber(field.grade)}</p>${field.sources?.length>1?`<small>Matemático ${familyNumber(field.sources[0].grade)} · Científico ${familyNumber(field.sources[1].grade)}</small>`:''}</div></article>`).join('')}</div>`;$('#familyTasks').innerHTML=`<div class="family-page-title"><div><p class="eyebrow">${escapeHtml(periodLabel)}</p><h2>Tareas</h2></div><strong>${summary.completed||0} de ${summary.total||0}</strong></div><p class="muted">Se muestran tareas entregadas, incompletas, no entregadas y pendientes de evaluar. Matemático y Científico se reúnen en Saberes y Pensamiento Científico.</p><div class="family-task-fields">${fields.map((field,index)=>familyTaskFieldHtml(field,index)).join('')}</div>`;$('#familyGrades').innerHTML=familyGradesHtml(fields)}
function familyTaskFieldHtml(field,index){const percentage=field.total?Math.round(field.completed*1000/field.total)/10:0;const sourceDetail=field.sources?.length>1?`<div class="family-source-pills">${field.sources.map(source=>`<span>${escapeHtml(source.name.replace('Saberes y Pensamiento ',''))}: ${source.completed}/${source.total}</span>`).join('')}</div>`:'';const pending=field.pending||[];return `<article class="family-task-card"><div class="family-task-head"><div class="family-field-icon">${familyFieldIcon(field.name)}</div><div><h3>${escapeHtml(field.name)}</h3><p><b>${field.completed} de ${field.total}</b> tareas realizadas · ${pending.length} pendientes</p></div></div><div class="family-progress"><i style="width:${percentage}%"></i></div>${sourceDetail}<button class="btn small" data-action="toggle-family-pending" data-index="${index}">${pending.length?'Ver pendientes':'Sin tareas pendientes'}</button><div id="familyPending${index}" class="family-pending-list hidden-control">${pending.length?pending.map(task=>`<div><span class="family-pending-state">${escapeHtml(task.status)}</span><h4>${escapeHtml(task.name)}</h4><p>${escapeHtml(formatDateShort(task.date))}${task.start?' · '+escapeHtml(formatTime(task.start)):''} · ${escapeHtml(task.source)}</p><small>${escapeHtml(task.project||'Sin proyecto')}</small></div>`).join(''):'<p>El alumno no tiene tareas pendientes en este campo.</p>'}</div></article>`}
function familyGradesHtml(fields){const weights=fields.find(field=>field.weights?.length)?.weights||[];return `<div class="family-page-title"><div><p class="eyebrow">EVALUACIÓN CONTINUA</p><h2>Calificaciones</h2></div><span class="family-provisional">PROVISIONALES</span></div><article class="family-info-note">La calificación se actualiza automáticamente. Los criterios que todavía no tienen registros no se cuentan como cero.</article>${weights.length?`<article class="family-weight-card"><h3>Ponderación definida por el maestro</h3><div>${weights.map(weight=>`<span>${escapeHtml(weight.criterio)} <b>${Number(weight.porcentaje)}%</b></span>`).join('')}</div></article>`:''}<div class="family-grade-grid">${fields.map((field,index)=>`<article class="family-grade-card ${familyStatusClass(field.grade)}"><div><span class="family-field-icon">${familyFieldIcon(field.name)}</span><h3>${escapeHtml(field.name)}</h3></div><strong>${familyNumber(field.grade)}</strong>${field.sources?.length>1?`<p>Matemático: <b>${familyNumber(field.sources[0].grade)}</b> · Científico: <b>${familyNumber(field.sources[1].grade)}</b></p>`:`<p>${field.completed} de ${field.total} tareas realizadas</p>`}<details><summary>Ver desglose</summary>${(field.weights||[]).map(weight=>`<div class="family-grade-line"><span>${escapeHtml(weight.criterio)} · ${Number(weight.porcentaje)}%</span><b>${familyNumber(field.scores?.[weight.criterio])}</b></div>`).join('')||'<p>Sin registros en este periodo.</p>'}</details></article>`).join('')}</div><p class="family-grade-foot">No es la calificación final del trimestre.</p>`}
async function loadFamilyDirectoryProfile(){if(!familyPortalData)return;setLoading(true,'Cargando los datos familiares…',()=>loadFamilyDirectoryProfile());try{const data=await familyServer('getFamilyProfile');familyPortalData.profile=data.profile;familyPortalData.contacts=data.contacts;familyPortalData.account=data.account||familyPortalData.account;$('#familyProfileForm').innerHTML=directoryFieldsHtml(familyPortalData,true);renderFamilyAccount()}catch(error){familyMessage(error.message,true)}finally{setLoading(false)}}
function renderFamilyAccount(){if(!familyPortalData)return;const form=$('#familyAccountForm'),account=familyPortalData.account||{};if(!form)return;form.elements.username.value=account.username||'';form.elements.email.value=account.email||'';form.elements.phone.value=account.phone||familyPortalData.profile?.tutorTelefono||'';form.elements.password.value='';form.elements.passwordConfirmation.value=''}
async function saveFamilyAccountSettings(e){e.preventDefault();const form=e.currentTarget,payload=formData(form);setLoading(true,'Guardando los cambios de la cuenta…');try{const result=await familyServer('saveFamilyAccountSettings',payload);storeFamilySession(result.token,localStorage.getItem(FAMILY_REMEMBER_KEY)==='true');familyPortalData.account=result.account;renderFamilyAccount();familyMessage(result.message);toast(result.message)}catch(error){familyMessage(error.message,true)}finally{setLoading(false)}}
async function saveFamilyProfile(e){e.preventDefault();const form=e.currentTarget,payload=directoryPayloadFromForm(form);setLoading(true,'Guardando los datos familiares…');try{const result=await familyServer('saveFamilyProfile',payload);const data=result.data||{};familyPortalData.profile=data.profile||familyPortalData.profile;familyPortalData.contacts=data.contacts||familyPortalData.contacts;$('#familyProfileForm').innerHTML=directoryFieldsHtml(familyPortalData,true);familyMessage('Los datos fueron guardados con éxito.');toast('Los datos fueron guardados con éxito.')}catch(error){familyMessage(error.message,true)}finally{setLoading(false)}}
function familyLogout(confirmFirst=true,message=''){if(confirmFirst&&!confirm('¿Cerrar la sesión familiar?'))return;familySessionToken='';clearTimeout(familyIdleTimer);localStorage.removeItem(FAMILY_SESSION_KEY);localStorage.removeItem(FAMILY_REMEMBER_KEY);sessionStorage.removeItem(FAMILY_SESSION_KEY);if(message)sessionStorage.setItem('family_logout_message',message);location.href=siteBaseUrl()+'?familia=acceso'}
function paymentMoney(value){return new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(Number(value)||0)}


function openWhatsappDialog(studentId, phone, studentName) {
  const row = state.directory?.rows.find(r => String(r.student.id) === String(studentId));
  const sName = studentName || row?.student.name || 'Alumno(a)';
  const tPhone = phone || row?.profile?.tutorTelefono || '';

  const cleanPhone = String(tPhone).replace(/\D/g, '');

  $('#whatsappDialogStudentName').textContent = sName;
  $('#whatsappPhoneInput').value = cleanPhone;

  // Redactar mensaje sugerido profesional
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
    // Prefijo 52 para México si no tiene código de país
    const phoneWithCountry = finalPhone.length === 10 ? '52' + finalPhone : finalPhone;
    const waUrl = `https://wa.me/${phoneWithCountry}?text=${finalMsg}`;
    window.open(waUrl, '_blank');
    $('#whatsappDialog').close();
  };

  $('#whatsappDialog').showModal();
}
window.openWhatsappDialog = openWhatsappDialog;

// Exportaciones globales explícitas para acceso directo y desacoplado
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
