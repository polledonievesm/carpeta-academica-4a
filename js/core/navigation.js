/* ==========================================================================
   MÓDULO: ENRUTADOR DE VISTAS, MENÚ LATERAL Y DESPACHADOR DE ACCIONES
   ========================================================================== */
function bindUI(){
  ['click','keydown','touchstart'].forEach(type=>document.addEventListener(type,()=>{if(document.body.classList.contains('family-mode'))resetFamilyIdleTimer()},{passive:true}));
  $$('.nav-item').forEach(b=>b.addEventListener('click',()=>{
    closeMobileSidebarNav();
    b.dataset.view==='payments'?openPayments():b.dataset.view==='directory'?openDirectory():b.dataset.view==='family-access'?openFamilyAccess():b.dataset.view==='grades'?openGrades():b.dataset.view==='attendance'?openAttendance():b.dataset.view==='enrollment-admin'?openEnrollmentAdmin():b.dataset.view==='daily'?openClassForm():b.dataset.view==='observations'?(window.loadObservations?window.loadObservations():showView('observations')):b.dataset.view==='pda-observations'?(window.openPdaObservations?window.openPdaObservations():showView('pda-observations')):showView(b.dataset.view);
  }));
  $$('[data-view-link]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.viewLink)));
  document.addEventListener('click',e=>{const close=e.target.closest('[data-close]');if(close){$('#'+close.dataset.close)?.close();return}const a=e.target.closest('[data-action]');if(!a)return;actions[a.dataset.action]?.(a)});
  // Control de apertura/cierre en móvil y colapso en PC
  if (localStorage.getItem('carpeta_sidebar_collapsed') === '1' && window.innerWidth > 900) {
    $('#sidebar')?.classList.add('collapsed');
    $('.main')?.classList.add('sidebar-collapsed');
  }

  function toggleSidebarNav() {
    if (window.innerWidth <= 900) {
      const sidebar = $('#sidebar');
      const backdrop = $('#sidebarBackdrop');
      const isOpen = sidebar ? sidebar.classList.toggle('open') : false;
      if (backdrop) backdrop.classList.toggle('active', isOpen);
    } else {
      const sidebar = $('#sidebar');
      const main = $('.main');
      if (sidebar) {
        const isCollapsed = sidebar.classList.toggle('collapsed');
        if (main) main.classList.toggle('sidebar-collapsed', isCollapsed);
        localStorage.setItem('carpeta_sidebar_collapsed', isCollapsed ? '1' : '0');
      }
    }
  }

  function closeMobileSidebarNav() {
    if (window.innerWidth <= 900) {
      $('#sidebar')?.classList.remove('open');
      $('#sidebarBackdrop')?.classList.remove('active');
    }
  }

  $('#menuButton')?.addEventListener('click', toggleSidebarNav);
  $('#sidebarCollapse')?.addEventListener('click', () => {
    if (window.innerWidth <= 900) {
      closeMobileSidebarNav();
    } else {
      toggleSidebarNav();
    }
  });
  $('#sidebarBackdrop')?.addEventListener('click', closeMobileSidebarNav);
  $('#studentSearch').addEventListener('input',renderStudents);
  $('#projectSearch').addEventListener('input',renderProjects);
  $('#projectStatus').addEventListener('change',renderProjects);
  $('#attendanceDate').addEventListener('change',loadAttendanceDay);
  $('#classDate').addEventListener('change',()=>loadClassAttendance());
  $('#attendanceReportType').addEventListener('change',toggleAttendanceReportMode);
  $('#attendanceStudent').addEventListener('change',()=>{if($('#attendanceStudent').value)loadAttendanceReport()});
  $('#attendanceReportDate').addEventListener('change',()=>{if($('#attendanceStudent').value&&$('#attendanceReportType').value==='weekly')loadAttendanceReport()});
  $('#attendancePeriod').addEventListener('change',()=>{if($('#attendanceStudent').value&&$('#attendanceReportType').value==='monthly')loadAttendanceReport()});
  $('#academicReportType').addEventListener('change',toggleAcademicReportMode);
  $('#attendanceList').addEventListener('click',selectAttendanceStatus);
  $('#attendanceList').addEventListener('input',updateAttendanceNote);
  $('#studentForm').addEventListener('submit',saveStudentForm);
  $('#projectForm').addEventListener('submit',saveProjectForm);
  $('#classForm').addEventListener('submit',saveClassForm);
  $('#evaluationList').addEventListener('change',updateClassEvaluation);
  $('#evaluationList').addEventListener('input',updateClassEvaluation);
  $('#loginForm').addEventListener('submit',login);
  $('#backupFileInput')?.addEventListener('change', e => {
    if (e.target.files && e.target.files[0]) {
      window.restoreGroupBackupFromFile(e.target.files[0]);
    }
  });
  $('#paymentEventForm').addEventListener('submit',createPaymentEvent);
  $('#studentPaymentForm').addEventListener('submit',saveStudentPayment);
  $('#paymentCutForm').addEventListener('submit',savePaymentCut);
  $('#paymentMovementForm').addEventListener('submit',savePaymentMovement);
  $('#paymentStudentSearch').addEventListener('input',renderPaymentStudents);
  $('#paymentStudentFilter').addEventListener('change',renderPaymentStudents);
  $('#directorySearch').addEventListener('input',renderDirectory);
  $('#directoryStatus').addEventListener('change',renderDirectory);
  $('#familyAccessSearch').addEventListener('input',renderFamilyAccess);
  $('#familyAccessStatus').addEventListener('change',renderFamilyAccess);
  $('#familyAccessAdminForm').addEventListener('submit',saveFamilyAccessRecovery);
  $('#familyAccessTable').addEventListener('change',e=>{if(e.target.matches('[data-family-access-student]')){const id=String(e.target.value);e.target.checked?familyAccessSelection.add(id):familyAccessSelection.delete(id);updateFamilyAccessSelectionCount()}});
  $('#familyAccessSelectAll').addEventListener('change',e=>setFamilyAccessSelection(e.target.checked?'visible':'none'));
  $('#loginDialog').addEventListener('cancel',e=>{if(!sessionToken)e.preventDefault()});
  $('#directoryForm').addEventListener('submit',saveDirectoryForm);
  $('#familyRegisterForm').addEventListener('submit',registerFamilyAccount);
  $('#familyLoginForm').addEventListener('submit',familyLogin);
  $('#familyForgotForm').addEventListener('submit',requestFamilyReset);
  $('#familyResetForm').addEventListener('submit',saveFamilyReset);
  $('#familyProfileForm').addEventListener('submit',saveFamilyProfile);
  $('#familyAccountForm').addEventListener('submit',saveFamilyAccountSettings);
  $('#familyOnboardingForm').addEventListener('submit',completeFamilyOnboarding);
  $('#familyGroupSearch').addEventListener('input',searchGroupStudents);
  $('#familyGroupRegisterForm').addEventListener('submit',registerGroupFamilyAccount);
  $('#familyTrimester').addEventListener('change',loadFamilyAcademic);
  $('#familyPeriodType').addEventListener('change',()=>{toggleFamilyPeriodControls();loadFamilyAcademic()});
  $('#familyPeriodDate').addEventListener('change',loadFamilyAcademic);
  $('#familyPeriodMonthValue').addEventListener('change',loadFamilyAcademic);
  $('.family-tabs').addEventListener('click',e=>{const button=e.target.closest('[data-family-view]');if(button)showFamilyView(button.dataset.familyView)});
  $('#subjectForm').addEventListener('submit',saveSubjectForm);
  $('#gradeWeightsList').addEventListener('input',updateGradeWeightTotal);
  installDraftAutosave($('#projectForm'),DRAFT_KEYS.project,null,'projectDraftStatus');
  installDraftAutosave($('#classForm'),DRAFT_KEYS.classRecord,()=>({evaluations:state.classEvaluations}),'classDraftStatus');
  window.addEventListener('pagehide',()=>{
    if($('#projectDialog')?.open)writeDraft($('#projectForm'),DRAFT_KEYS.project,null,'projectDraftStatus');
    if($('#view-daily')?.classList.contains('active'))writeDraft($('#classForm'),DRAFT_KEYS.classRecord,()=>({evaluations:state.classEvaluations}),'classDraftStatus');
  });
}
const actions={
  'logout':()=>logout(),
  'download-backup': () => window.downloadGroupBackup && window.downloadGroupBackup(),
  'test-supabase': async () => {
    const el = document.getElementById('supabaseConnectionStatus');
    if (el) el.innerHTML = '<span class="status-indicator warning"></span> Probando conexión con Supabase...';
    try {
      if (typeof window.testSupabaseConnection !== 'function') throw new Error('Cliente no disponible');
      const res = await window.testSupabaseConnection();
      if (el) {
        if (res.ok) {
          el.innerHTML = '<span class="status-indicator success" style="background:#10b981;"></span> <span style="color:#059669;">Conectado (' + res.latency + ' ms) · Listo</span>';
          if (typeof window.toast === 'function') window.toast('✓ ' + res.message);
        } else if (res.needsSchema) {
          el.innerHTML = '<span class="status-indicator warning" style="background:#f59e0b;"></span> <span style="color:#d97706;">Conectado · Tablas pendientes en SQL Editor</span>';
          if (typeof window.toast === 'function') window.toast('⚠️ ' + res.message, true);
        }
      }
    } catch (err) {
      if (el) el.innerHTML = '<span class="status-indicator danger" style="background:#ef4444;"></span> <span style="color:#dc2626;">Error de conexión</span>';
      if (typeof window.toast === 'function') window.toast('Error Supabase: ' + err.message, true);
    }
  },
  'sync-supabase': async () => {
    try {
      if (typeof window.syncStudentsToSupabase !== 'function') throw new Error('Cliente no disponible');
      if (typeof window.toast === 'function') window.toast('Sincronizando alumnos con Supabase...');
      const count = await window.syncStudentsToSupabase();
      if (typeof window.toast === 'function') window.toast('✓ ' + count + ' alumnos sincronizados en la nube.');
    } catch (err) {
      if (typeof window.toast === 'function') window.toast('Error al sincronizar: ' + err.message, true);
      alert('Aviso de sincronización: ' + err.message);
    }
  },
  'send-whatsapp-student': btn => window.openWhatsappDialog && window.openWhatsappDialog(btn.dataset.id, btn.dataset.phone, btn.dataset.name),
  'new-student':()=>openStudent(),
  'new-project':()=>openProject(),
  'go-daily':()=>openClassForm(),
  'open-project':btn=>openProjectWorkspace(btn.dataset.id),
  'back-projects':()=>showView('projects'),
  'edit-current-project':()=>state.currentProject&&openProject(state.currentProject),
  'new-class':()=>openClassForm(state.currentProject?.id),
  'edit-class':btn=>openClassForm(state.currentProject?.id,btn.dataset.id),
  'cancel-class':()=>{if(readDraft(DRAFT_KEYS.classRecord))toast('La actividad quedó guardada como borrador.');state.currentProject?showView('project-detail'):showView('dashboard')},
  'discard-project-draft':()=>discardDraft(DRAFT_KEYS.project,'projectDraftStatus'),
  'discard-class-draft':()=>discardDraft(DRAFT_KEYS.classRecord,'classDraftStatus'),
  'all-complete':()=>setAllEvaluations('trabajo','Completo'),
  'all-adequate':()=>setAllEvaluations('conducta','Adecuada'),
  'weekly-report':()=>openAcademicReports('weekly'),
  'individual-report':()=>openAcademicReports('monthly'),
  'academic-report':loadAcademicReport,
  'print-academic-report':()=>window.print(),
  'daily-report':loadDailyReport,
  'all-present':()=>{(state.attendance?.students||[]).forEach(s=>state.attendanceRecords[s.id]={status:'A',note:''});renderAttendanceList()},
  'save-attendance':saveAttendanceDay,
  'no-class':saveNoClassDay,
  'attendance-report':loadAttendanceReport,
  'edit-student':btn=>openStudent(state.students.find(x=>x.id===btn.dataset.id)),
  'delete-student':async btn=>{if(!confirm('¿Eliminar definitivamente a este alumno y sus registros? Esta acción no se puede deshacer.'))return;await runAction(async()=>{const id=String(btn.dataset.id),r=await server('deleteStudent',id);state.students=state.students.filter(student=>String(student.id)!==id);if(state.directory)state.directory.rows=state.directory.rows.filter(row=>String(row.student.id)!==id);state.stats.students=state.students.length;renderAll();toast(r.message)})},
  'delete-project':async btn=>{if(!confirm('¿Eliminar definitivamente este proyecto, sus actividades y evaluaciones? Esta acción no se puede deshacer.'))return;await runAction(async()=>{const id=String(btn.dataset.id),r=await server('deleteProject',id);state.projects=state.projects.filter(project=>String(project.id)!==id);state.stats.projects=state.projects.filter(project=>project.estado==='Activo').length;state.stats.classes=Math.max(0,Number(state.stats.classes||0)-Number(r.deletedActivities||0));renderAll();showView('projects');toast(r.message)})},
  'sync-styles':syncLearningStyles,
  'open-payments':openPayments,
  'refresh-payments':loadPayments,
  'sync-payment-students':syncPaymentStudents,
  'toggle-payment-event-form':togglePaymentEventForm,
  'open-payment-event':btn=>openPaymentEvent(btn.dataset.id),
  'back-payment-events':backPaymentEvents,
  'archive-payment-event':btn=>setPaymentEventActive(btn.dataset.id,false),
  'reactivate-payment-event':btn=>setPaymentEventActive(btn.dataset.id,true),
  'archive-current-payment-event':()=>state.paymentDetail&&setPaymentEventActive(state.paymentDetail.event.id,false),
  'payment-abono':btn=>openStudentPayment(btn.dataset.id,'ABONO'),
  'payment-total':btn=>openStudentPayment(btn.dataset.id,'TOTAL'),
  'open-directory':openDirectory,
  'refresh-directory':loadDirectory,
  'toggle-directory-report':toggleDirectoryReport,
  'edit-directory':btn=>openDirectoryForm(btn.dataset.id),
  'generate-family-invite':btn=>generateFamilyInvitation(btn.dataset.id),
  'revoke-family-invite':btn=>revokeFamilyInvitation(btn.dataset.id),
  'generate-family-reset':btn=>generateFamilyReset(btn.dataset.id),
  'generate-family-credentials':btn=>generateFamilyCredentials(btn.dataset.id),
  'toggle-family-account':btn=>setFamilyAccountActive(btn.dataset.id,btn.dataset.active==='true'),
  'delete-family-access':btn=>deleteFamilyAccess(btn.dataset.id),
  'directory-delete-student':btn=>deleteDirectoryStudent(btn.dataset.id),
  'copy-directory-link':copyDirectoryLink,
  'select-all-directory':()=>setDirectorySelection(true),
  'clear-directory-selection':()=>setDirectorySelection(false),
  'preview-directory-report':previewDirectoryReport,
  'print-directory-report':printDirectoryReport,
  'print-directory-profile':btn=>printDirectoryProfile(btn.dataset.id),
  'view-directory':btn=>viewDirectoryProfile(btn.dataset.id),
  'group-family-invite':generateGroupFamilyInvitation,
  'refresh-family-access':()=>loadFamilyAccess(true),
  'select-all-family-access':()=>setFamilyAccessSelection('visible'),
  'select-without-family-access':()=>setFamilyAccessSelection('without'),
  'clear-family-access':()=>setFamilyAccessSelection('none'),
  'generate-selected-family-access':generateSelectedFamilyAccess,
  'print-selected-family-access':printSelectedFamilyAccess,
  'revoke-selected-family-access':revokeSelectedFamilyAccess,
  'delete-selected-students':deleteSelectedStudents,
  'manage-family-access':btn=>openFamilyAccessAdmin(btn.dataset.id),
  'toggle-family-password':btn=>toggleFamilyAccessPassword(btn),
  'regenerate-current-family-access':regenerateCurrentFamilyAccess,
  'revoke-current-family-access':revokeCurrentFamilyAccess,
  'print-current-managed-family-access':printCurrentManagedFamilyAccess,
  'print-current-family-access':()=>printFamilyCredentials(state.familyCredentials),
  'select-group-student':btn=>selectGroupStudent(btn.dataset.id,decodeURIComponent(btn.dataset.name||'')),
  'projects-all':()=>setProjectsMode('all'),
  'projects-fields':()=>setProjectsMode('fields'),
  'new-subject':()=>openSubjectForm(),
  'edit-subject':btn=>openSubjectForm(state.subjects.find(x=>x.id===btn.dataset.id)),
  'delete-subject':btn=>deleteSubject(btn.dataset.id),
  'grades-refresh':()=>loadGrades(true),
  'load-grade-weights':loadGradeWeights,
  'add-grade-criterion':()=>addGradeCriterion(),
  'remove-grade-criterion':btn=>{btn.closest('.grade-weight-row').remove();updateGradeWeightTotal()},
  'save-grade-weights':saveGradeWeights,
  'save-manual-grades':saveManualGrades,
  'generate-grade-report':generateGradeReport,
  'generate-consolidated-report':generateConsolidatedReport,
  'print-grade-report':()=>printGradeReport(),
  'open-family-login':()=>{location.href=siteBaseUrl()+'?familia=acceso'},
  'show-family-forgot':()=>showFamilyPanel('familyForgotPanel'),
  'show-family-login':()=>showFamilyPanel('familyLoginPanel'),
  'back-teacher-login':()=>{location.href=siteBaseUrl()},
  'toggle-family-pending':btn=>{const list=$('#familyPending'+btn.dataset.index);if(list){list.classList.toggle('hidden-control');btn.textContent=list.classList.contains('hidden-control')?'Ver pendientes':'Ocultar pendientes'}},
  'family-logout':familyLogout
};
function showView(id){
  $$('.view').forEach(v=>v.classList.toggle('active',v.id===id));
  $$('.nav-item').forEach(b=>{
    const isActive=b.dataset.view===id;
    b.classList.toggle('active',isActive);
    if(isActive){
      const parentGroup=b.closest('.nav-group');
      if(parentGroup) parentGroup.open=true;
    }
  });
  $$('.nav-group').forEach(grp=>{
    grp.classList.toggle('has-active',Boolean(grp.querySelector('.nav-item.active')));
  });
  if (id === 'settings' && window.updateSettingsStats) window.updateSettingsStats();
  const title=$('#currentViewTitle');
  if(title)title.textContent=VIEW_TITLES[id]||'Carpeta Académica';
  $('#sidebar')?.classList.remove('open');
  $('#sidebarBackdrop')?.classList.remove('active');
  window.scrollTo(0,0);
}
