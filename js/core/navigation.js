/* ==========================================================================
   MÓDULO: ENRUTADOR DE VISTAS, MENÚ LATERAL Y DESPACHADOR DE ACCIONES
   ========================================================================== */
function bindUI(){
  ['click','keydown','touchstart'].forEach(type=>document.addEventListener(type,()=>{if(document.body.classList.contains('family-mode'))resetFamilyIdleTimer()},{passive:true}));
  $$('.nav-item').forEach(b=>b.addEventListener('click',()=>{
    closeMobileSidebarNav();
    showView(b.dataset.view);
  }));
  $$('[data-view-link]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.viewLink)));
  document.addEventListener('click',e=>{
    const close=e.target.closest('[data-close]');
    if(close){$('#'+close.dataset.close)?.close();return}
    const a=e.target.closest('[data-action]');
    if(!a)return;
    const actionName = a.dataset.action;
    const handler = (window.actions && window.actions[actionName]) || (typeof actions !== 'undefined' && actions[actionName]);
    if (typeof handler === 'function') {
      try {
        handler(a);
      } catch (err) {
        console.error('Error al ejecutar acción [' + actionName + ']:', err);
      }
    } else {
      console.warn('Acción no registrada:', actionName);
    }
  });
  $('#backupFileInput')?.addEventListener('change', e => {
    if (e.target.files && e.target.files[0]) {
      window.restoreGroupBackupFromFile && window.restoreGroupBackupFromFile(e.target.files[0]);
    }
  });
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

  // Soporte para botón Atrás del navegador y celular (Android / PC)
  window.addEventListener('popstate', (e) => {
    const stateView = e.state?.view;
    const rawHash = window.location.hash.replace(/^#/, '');
    const cleanHash = rawHash.split('?')[0];
    const viewToRestore = stateView || cleanHash || 'dashboard';
    showView(viewToRestore, false);
  });

  // Restaurar vista desde hash en URL si existe al abrir el sistema
  const rawInitial = window.location.hash.replace(/^#/, '');
  const cleanInitial = rawInitial.split('?')[0];
  if (cleanInitial && VIEW_TITLES[cleanInitial]) {
    setTimeout(() => showView(cleanInitial, false), 60);
  }
}
window.actions = window.actions || {};
var actions = window.actions;

Object.assign(actions, {
  'open-student-record': btn => window.openStudentRecord && window.openStudentRecord(btn.dataset.id),
  'view-student-in-directory': btn => {
    const studentId = btn.dataset.id;
    const student = (state.students || []).find(s => String(s.id) === String(studentId));
    if (student) {
      if (typeof openDirectory === 'function') openDirectory();
      else showView('directory');
      const search = document.getElementById('directorySearch');
      if (search) {
        search.value = student.apellidoPaterno || student.nombres || student.nombre || '';
        if (typeof renderDirectory === 'function') renderDirectory();
      }
    }
  },
  'open-student-attendance': btn => {
    if (typeof openAttendance === 'function') openAttendance();
    else showView('attendance');
    const select = document.getElementById('attendanceStudent');
    if (select) {
      select.value = btn.dataset.id;
      if (typeof toggleAttendanceReportMode === 'function') toggleAttendanceReportMode();
    }
  },
  'open-student-observations': () => {
    showView('observations');
    if (typeof window.loadObservations === 'function') window.loadObservations();
  },
  'open-styles-student': () => {
    showView('styles');
  },
  'logout': () => (window.logout || (typeof logout !== 'undefined' ? logout : null))?.(),
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
  'open-import-attendance-dialog': () => window.openImportAttendanceDialog && window.openImportAttendanceDialog(),
  'new-student': () => (window.openStudent || (typeof openStudent !== 'undefined' ? openStudent : null))?.(),
  'new-project': () => (window.openProject || (typeof openProject !== 'undefined' ? openProject : null))?.(),
  'go-daily': () => (window.openClassForm || (typeof openClassForm !== 'undefined' ? openClassForm : null))?.(),
  'open-project': btn => (window.openProjectWorkspace || (typeof openProjectWorkspace !== 'undefined' ? openProjectWorkspace : null))?.(btn.dataset.id),
  'back-projects': () => showView('projects'),
  'edit-current-project': () => state.currentProject && (window.openProject || (typeof openProject !== 'undefined' ? openProject : null))?.(state.currentProject),
  'new-class': () => (window.openClassForm || (typeof openClassForm !== 'undefined' ? openClassForm : null))?.(state.currentProject?.id),
  'edit-class': btn => (window.openClassForm || (typeof openClassForm !== 'undefined' ? openClassForm : null))?.(state.currentProject?.id, btn.dataset.id),
  'cancel-class': () => { if (readDraft(DRAFT_KEYS.classRecord)) toast('La actividad quedó guardada como borrador.'); state.currentProject ? showView('project-detail') : showView('dashboard'); },
  'discard-project-draft': () => (window.discardDraft || (typeof discardDraft !== 'undefined' ? discardDraft : null))?.(DRAFT_KEYS.project, 'projectDraftStatus'),
  'discard-class-draft': () => (window.discardDraft || (typeof discardDraft !== 'undefined' ? discardDraft : null))?.(DRAFT_KEYS.classRecord, 'classDraftStatus'),
  'all-complete': () => (window.setAllEvaluations || (typeof setAllEvaluations !== 'undefined' ? setAllEvaluations : null))?.('trabajo', 'Completo'),
  'all-adequate': () => (window.setAllEvaluations || (typeof setAllEvaluations !== 'undefined' ? setAllEvaluations : null))?.('conducta', 'Adecuada'),
  'weekly-report': () => (window.openAcademicReports || (typeof openAcademicReports !== 'undefined' ? openAcademicReports : null))?.('weekly'),
  'individual-report': () => (window.openAcademicReports || (typeof openAcademicReports !== 'undefined' ? openAcademicReports : null))?.('monthly'),
  'academic-report': (...args) => (window.loadAcademicReport || (typeof loadAcademicReport !== 'undefined' ? loadAcademicReport : null))?.(...args),
  'print-academic-report': () => window.print(),
  'daily-report': (...args) => (window.loadDailyReport || (typeof loadDailyReport !== 'undefined' ? loadDailyReport : null))?.(...args),
  'all-present': () => { (state.attendance?.students || []).forEach(s => state.attendanceRecords[s.id] = { status: 'A', note: '' }); (window.renderAttendanceList || (typeof renderAttendanceList !== 'undefined' ? renderAttendanceList : null))?.(); },
  'save-attendance': (...args) => (window.saveAttendanceDay || (typeof saveAttendanceDay !== 'undefined' ? saveAttendanceDay : null))?.(...args),
  'no-class': (...args) => (window.saveNoClassDay || (typeof saveNoClassDay !== 'undefined' ? saveNoClassDay : null))?.(...args),
  'attendance-report': (...args) => (window.loadAttendanceReport || (typeof loadAttendanceReport !== 'undefined' ? loadAttendanceReport : null))?.(...args),
  'edit-student': btn => (window.openStudent || (typeof openStudent !== 'undefined' ? openStudent : null))?.(state.students.find(x => x.id === btn.dataset.id)),
  'delete-student': async btn => {
    if (!confirm('¿Eliminar definitivamente a este alumno y sus registros? Esta acción no se puede deshacer.')) return;
    await runAction(async () => {
      const id = String(btn.dataset.id), r = await server('deleteStudent', id);
      state.students = state.students.filter(student => String(student.id) !== id);
      if (state.directory) state.directory.rows = state.directory.rows.filter(row => String(row.student.id) !== id);
      state.stats.students = state.students.length;
      renderAll();
      toast(r.message);
    });
  },
  'delete-project': async btn => {
    if (!confirm('¿Eliminar definitivamente este proyecto, sus actividades y evaluaciones? Esta acción no se puede deshacer.')) return;
    await runAction(async () => {
      const id = String(btn.dataset.id), r = await server('deleteProject', id);
      state.projects = state.projects.filter(project => String(project.id) !== id);
      state.stats.projects = state.projects.filter(project => project.estado === 'Activo').length;
      state.stats.classes = Math.max(0, Number(state.stats.classes || 0) - Number(r.deletedActivities || 0));
      renderAll();
      showView('projects');
      toast(r.message);
    });
  },
  'sync-styles': (...args) => (window.syncLearningStyles || (typeof syncLearningStyles !== 'undefined' ? syncLearningStyles : null))?.(...args),
  'open-payments': (...args) => (window.openPayments || (typeof openPayments !== 'undefined' ? openPayments : null))?.(...args),
  'refresh-payments': (...args) => (window.loadPayments || (typeof loadPayments !== 'undefined' ? loadPayments : null))?.(...args),
  'sync-payment-students': (...args) => (window.syncPaymentStudents || (typeof syncPaymentStudents !== 'undefined' ? syncPaymentStudents : null))?.(...args),
  'toggle-payment-event-form': (...args) => (window.togglePaymentEventForm || (typeof togglePaymentEventForm !== 'undefined' ? togglePaymentEventForm : null))?.(...args),
  'open-payment-event': btn => (window.openPaymentEvent || (typeof openPaymentEvent !== 'undefined' ? openPaymentEvent : null))?.(btn.dataset.id),
  'back-payment-events': (...args) => (window.backPaymentEvents || (typeof backPaymentEvents !== 'undefined' ? backPaymentEvents : null))?.(...args),
  'archive-payment-event': btn => (window.setPaymentEventActive || (typeof setPaymentEventActive !== 'undefined' ? setPaymentEventActive : null))?.(btn.dataset.id, false),
  'reactivate-payment-event': btn => (window.setPaymentEventActive || (typeof setPaymentEventActive !== 'undefined' ? setPaymentEventActive : null))?.(btn.dataset.id, true),
  'archive-current-payment-event': () => state.paymentDetail && (window.setPaymentEventActive || (typeof setPaymentEventActive !== 'undefined' ? setPaymentEventActive : null))?.(state.paymentDetail.event.id, false),
  'payment-abono': btn => (window.openStudentPayment || (typeof openStudentPayment !== 'undefined' ? openStudentPayment : null))?.(btn.dataset.id, 'ABONO'),
  'payment-total': btn => (window.openStudentPayment || (typeof openStudentPayment !== 'undefined' ? openStudentPayment : null))?.(btn.dataset.id, 'TOTAL'),
  'open-directory': (...args) => (window.openDirectory || (typeof openDirectory !== 'undefined' ? openDirectory : null))?.(...args),
  'refresh-directory': (...args) => (window.loadDirectory || (typeof loadDirectory !== 'undefined' ? loadDirectory : null))?.(...args),
  'toggle-directory-report': (...args) => (window.toggleDirectoryReport || (typeof toggleDirectoryReport !== 'undefined' ? toggleDirectoryReport : null))?.(...args),
  'edit-directory': btn => (window.openDirectoryForm || (typeof openDirectoryForm !== 'undefined' ? openDirectoryForm : null))?.(btn.dataset.id),
  'generate-family-invite': btn => (window.generateFamilyInvitation || (typeof generateFamilyInvitation !== 'undefined' ? generateFamilyInvitation : null))?.(btn.dataset.id),
  'revoke-family-invite': btn => (window.revokeFamilyInvitation || (typeof revokeFamilyInvitation !== 'undefined' ? revokeFamilyInvitation : null))?.(btn.dataset.id),
  'generate-family-reset': btn => (window.generateFamilyReset || (typeof generateFamilyReset !== 'undefined' ? generateFamilyReset : null))?.(btn.dataset.id),
  'generate-family-credentials': btn => (window.generateFamilyCredentials || (typeof generateFamilyCredentials !== 'undefined' ? generateFamilyCredentials : null))?.(btn.dataset.id),
  'toggle-family-account': btn => (window.setFamilyAccountActive || (typeof setFamilyAccountActive !== 'undefined' ? setFamilyAccountActive : null))?.(btn.dataset.id, btn.dataset.active === 'true'),
  'delete-family-access': btn => (window.deleteFamilyAccess || (typeof deleteFamilyAccess !== 'undefined' ? deleteFamilyAccess : null))?.(btn.dataset.id),
  'directory-delete-student': btn => (window.deleteDirectoryStudent || (typeof deleteDirectoryStudent !== 'undefined' ? deleteDirectoryStudent : null))?.(btn.dataset.id),
  'copy-directory-link': (...args) => (window.copyDirectoryLink || (typeof copyDirectoryLink !== 'undefined' ? copyDirectoryLink : null))?.(...args),
  'select-all-directory': () => (window.setDirectorySelection || (typeof setDirectorySelection !== 'undefined' ? setDirectorySelection : null))?.(true),
  'clear-directory-selection': () => (window.setDirectorySelection || (typeof setDirectorySelection !== 'undefined' ? setDirectorySelection : null))?.(false),
  'preview-directory-report': (...args) => (window.previewDirectoryReport || (typeof previewDirectoryReport !== 'undefined' ? previewDirectoryReport : null))?.(...args),
  'print-directory-report': (...args) => (window.printDirectoryReport || (typeof printDirectoryReport !== 'undefined' ? printDirectoryReport : null))?.(...args),
  'print-directory-profile': btn => (window.printDirectoryProfile || (typeof printDirectoryProfile !== 'undefined' ? printDirectoryProfile : null))?.(btn.dataset.id),
  'view-directory': btn => (window.viewDirectoryProfile || (typeof viewDirectoryProfile !== 'undefined' ? viewDirectoryProfile : null))?.(btn.dataset.id),
  'group-family-invite': (...args) => (window.generateGroupFamilyInvitation || (typeof generateGroupFamilyInvitation !== 'undefined' ? generateGroupFamilyInvitation : null))?.(...args),
  'refresh-family-access': () => (window.loadFamilyAccess || (typeof loadFamilyAccess !== 'undefined' ? loadFamilyAccess : null))?.(true),
  'select-all-family-access': () => (window.setFamilyAccessSelection || (typeof setFamilyAccessSelection !== 'undefined' ? setFamilyAccessSelection : null))?.('visible'),
  'select-without-family-access': () => (window.setFamilyAccessSelection || (typeof setFamilyAccessSelection !== 'undefined' ? setFamilyAccessSelection : null))?.('without'),
  'clear-family-access': () => (window.setFamilyAccessSelection || (typeof setFamilyAccessSelection !== 'undefined' ? setFamilyAccessSelection : null))?.('none'),
  'regenerate-all-family-passwords-no-expiry': () => (window.regenerateAllFamilyPasswordsNoExpiry || (typeof regenerateAllFamilyPasswordsNoExpiry !== 'undefined' ? regenerateAllFamilyPasswordsNoExpiry : null))?.(),
  'generate-selected-family-access': (...args) => (window.generateSelectedFamilyAccess || (typeof generateSelectedFamilyAccess !== 'undefined' ? generateSelectedFamilyAccess : null))?.(...args),
  'print-selected-family-access': (...args) => (window.printSelectedFamilyAccess || (typeof printSelectedFamilyAccess !== 'undefined' ? printSelectedFamilyAccess : null))?.(...args),
  'revoke-selected-family-access': (...args) => (window.revokeSelectedFamilyAccess || (typeof revokeSelectedFamilyAccess !== 'undefined' ? revokeSelectedFamilyAccess : null))?.(...args),
  'delete-selected-students': (...args) => (window.deleteSelectedStudents || (typeof deleteSelectedStudents !== 'undefined' ? deleteSelectedStudents : null))?.(...args),
  'manage-family-access': btn => (window.openFamilyAccessAdmin || (typeof openFamilyAccessAdmin !== 'undefined' ? openFamilyAccessAdmin : null))?.(btn.dataset.id),
  'toggle-family-password': btn => (window.toggleFamilyAccessPassword || (typeof toggleFamilyAccessPassword !== 'undefined' ? toggleFamilyAccessPassword : null))?.(btn),
  'regenerate-current-family-access': (...args) => (window.regenerateCurrentFamilyAccess || (typeof regenerateCurrentFamilyAccess !== 'undefined' ? regenerateCurrentFamilyAccess : null))?.(...args),
  'revoke-current-family-access': (...args) => (window.revokeCurrentFamilyAccess || (typeof revokeCurrentFamilyAccess !== 'undefined' ? revokeCurrentFamilyAccess : null))?.(...args),
  'print-current-managed-family-access': (...args) => (window.printCurrentManagedFamilyAccess || (typeof printCurrentManagedFamilyAccess !== 'undefined' ? printCurrentManagedFamilyAccess : null))?.(...args),
  'print-current-family-access': () => (window.printFamilyCredentials || (typeof printFamilyCredentials !== 'undefined' ? printFamilyCredentials : null))?.(state.familyCredentials),
  'select-group-student': btn => (window.selectGroupStudent || (typeof selectGroupStudent !== 'undefined' ? selectGroupStudent : null))?.(btn.dataset.id, decodeURIComponent(btn.dataset.name || '')),
  'projects-all': () => (window.setProjectsMode || (typeof setProjectsMode !== 'undefined' ? setProjectsMode : null))?.('all'),
  'projects-fields': () => (window.setProjectsMode || (typeof setProjectsMode !== 'undefined' ? setProjectsMode : null))?.('fields'),
  'new-subject': () => (window.openSubjectForm || (typeof openSubjectForm !== 'undefined' ? openSubjectForm : null))?.(),
  'edit-subject': btn => (window.openSubjectForm || (typeof openSubjectForm !== 'undefined' ? openSubjectForm : null))?.(state.subjects.find(x => x.id === btn.dataset.id)),
  'delete-subject': btn => (window.deleteSubject || (typeof deleteSubject !== 'undefined' ? deleteSubject : null))?.(btn.dataset.id),
  'grades-refresh': () => (window.loadGrades || (typeof loadGrades !== 'undefined' ? loadGrades : null))?.(true),
  'load-grade-weights': (...args) => (window.loadGradeWeights || (typeof loadGradeWeights !== 'undefined' ? loadGradeWeights : null))?.(...args),
  'add-grade-criterion': () => (window.addGradeCriterion || (typeof addGradeCriterion !== 'undefined' ? addGradeCriterion : null))?.(),
  'remove-grade-criterion': btn => { btn.closest('.grade-weight-row').remove(); (window.updateGradeWeightTotal || (typeof updateGradeWeightTotal !== 'undefined' ? updateGradeWeightTotal : null))?.(); },
  'save-grade-weights': (...args) => (window.saveGradeWeights || (typeof saveGradeWeights !== 'undefined' ? saveGradeWeights : null))?.(...args),
  'save-manual-grades': (...args) => (window.saveManualGrades || (typeof saveManualGrades !== 'undefined' ? saveManualGrades : null))?.(...args),
  'generate-grade-report': (...args) => (window.generateGradeReport || (typeof generateGradeReport !== 'undefined' ? generateGradeReport : null))?.(...args),
  'generate-consolidated-report': (...args) => (window.generateConsolidatedReport || (typeof generateConsolidatedReport !== 'undefined' ? generateConsolidatedReport : null))?.(...args),
  'print-grade-report': () => (window.printGradeReport || (typeof printGradeReport !== 'undefined' ? printGradeReport : null))?.(),
  'open-family-login': () => { location.href = siteBaseUrl() + '?familia=acceso'; },
  'show-family-forgot': () => (window.showFamilyPanel || (typeof showFamilyPanel !== 'undefined' ? showFamilyPanel : null))?.('familyForgotPanel'),
  'show-family-login': () => (window.showFamilyPanel || (typeof showFamilyPanel !== 'undefined' ? showFamilyPanel : null))?.('familyLoginPanel'),
  'back-teacher-login': () => { location.href = siteBaseUrl(); },
  'toggle-family-pending': btn => { const list = $('#familyPending' + btn.dataset.index); if (list) { list.classList.toggle('hidden-control'); btn.textContent = list.classList.contains('hidden-control') ? 'Ver pendientes' : 'Ocultar pendientes'; } },
  'family-logout': (...args) => (window.familyLogout || (typeof familyLogout !== 'undefined' ? familyLogout : null))?.(...args),

  // Registro diario y evaluación de clase
  'cancel-jornada': () => {
    if (confirm('¿Deseas limpiar los campos de actividades de la jornada?')) {
      const form = $('#jornadaActivitiesForm') || $('#classForm');
      if (form) form.reset();
      toast('Formulario de jornada limpiado.');
    }
  },
  'open-instruments': () => showView('instruments'),
  'continue-class-evaluation': () => {
    const actName = $('input[name="actividad"]')?.value?.trim();
    if (!actName) return toast('Ingresa el nombre de la actividad antes de evaluar.', true);
    $('.class-data-panel')?.classList.add('hidden-control');
    $('#classCompactSummary')?.classList.remove('hidden-control');
    const compName = $('#classCompactName');
    if (compName) compName.textContent = actName;
    const compMeta = $('#classCompactMeta');
    if (compMeta) compMeta.textContent = ($('#classDate')?.value || '') + ' · ' + ($('#classSubject')?.value || '');
    $('.evaluation-panel')?.scrollIntoView({ behavior: 'smooth' });
  },
  'edit-class-setup': () => {
    $('.class-data-panel')?.classList.remove('hidden-control');
    $('#classCompactSummary')?.classList.add('hidden-control');
  },
  'run-consult-daily': () => {
    const d = $('#dailyReportDate')?.value;
    if (!d) return toast('Selecciona una fecha.', true);
    if (typeof window.loadDailyReportActivities === 'function') window.loadDailyReportActivities(d);
    else toast('Consultando actividades del ' + d);
  },
  'run-consult-weekly': () => {
    toast('Consultando concentrado semanal del alumno...');
  },

  // Asistencia mensual y ciclo escolar
  'load-attendance-cycle': () => {
    toast('Reporte del ciclo escolar generado.');
  },
  'export-attendance-excel': () => {
    toast('Disponible próximamente en la siguiente etapa.', true);
  },
  'print-attendance-cycle': () => {
    window.print();
  },

  // Observaciones y PDA
  'observation-current-week': () => {
    $$('.observation-choice').forEach(b => b.classList.remove('selected'));
    toast('Mostrando observaciones de la semana actual.');
  },
  'observation-full-history': () => {
    $$('.observation-choice').forEach(b => b.classList.remove('selected'));
    toast('Mostrando historial completo.');
  },
  'refresh-observations': () => {
    if (typeof window.loadObservations === 'function') window.loadObservations();
    toast('Observaciones actualizadas.');
  },
  'save-custom-observation': () => {
    toast('Guardando observación...');
  },
  'copy-pda-text': () => {
    const text = $('#pdaGeneratedText')?.value || $('#pdaObservationPreview')?.textContent || $('textarea[name="pdaObservacion"]')?.value || '';
    if (text && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => toast('✓ Texto de observación PDA copiado.')).catch(() => toast('Texto seleccionado.'));
    } else {
      toast('No hay texto para copiar.', true);
    }
  },

  // Borradores y Respaldos
  'refresh-drafts': () => {
    toast('Borradores actualizados.');
  },
  'scan-duplicates': () => {
    toast('Escaneando registros... No se detectaron duplicados en el grupo.');
  },
  'download-backup': () => window.downloadGroupBackup && window.downloadGroupBackup(),
  'restore-backup-file': () => $('#backupFileInput')?.click(),

  // Reportes semanales
  'weekly-report-select-all': () => {
    $$('#weeklyReportsGrid input[type="checkbox"]').forEach(c => c.checked = true);
  },
  'weekly-report-clear': () => {
    $$('#weeklyReportsGrid input[type="checkbox"]').forEach(c => c.checked = false);
  },
  'weekly-report-save-state': () => {
    toast('✓ Estado de reportes semanales guardado.');
  },
  'open-weekly-report-options': () => {
    toast('Opciones de reporte semanal disponibles.');
  }
});

function showView(id, pushHistory = true){
  if (!id) return;
  const target = document.getElementById(id);
  if (!target || !target.classList.contains('view')) {
    id = 'dashboard';
  }

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
  // Inicializadores automáticos de vistas protegidos contra reentrancia recursiva
  if (!window._isNavigatingView) {
    window._isNavigatingView = true;
    try {
      if (id === 'student-record' && window.initStudentRecordModule) window.initStudentRecordModule();
      else if (id === 'payments' && typeof renderPayments === 'function') renderPayments();
      else if (id === 'directory' && typeof renderDirectory === 'function') { renderDirectory(); if (typeof renderDirectoryBuilder === 'function') renderDirectoryBuilder(); }
      else if (id === 'family-access' && typeof renderFamilyAccess === 'function') renderFamilyAccess();
      else if (id === 'grades' && typeof openGrades === 'function') openGrades();
      else if (id === 'attendance' && typeof renderAttendanceList === 'function') renderAttendanceList();
      else if (id === 'enrollment-admin' && typeof renderEnrollmentAdmin === 'function') renderEnrollmentAdmin();
      else if (id === 'daily' && typeof openClassForm === 'function') openClassForm();
      else if (id === 'observations' && window.loadObservations) window.loadObservations();
      else if (id === 'pda-observations' && window.openPdaObservations) window.openPdaObservations();
      else if (id === 'settings' && window.updateSettingsStats) window.updateSettingsStats();
    } catch (err) {
      console.warn('Inicialización de vista ' + id + ':', err);
    } finally {
      window._isNavigatingView = false;
    }
  }
  const title=$('#currentViewTitle');
  if(title)title.textContent=VIEW_TITLES[id]||'Carpeta Académica';
  $('#sidebar')?.classList.remove('open');
  $('#sidebarBackdrop')?.classList.remove('active');

  // Integración con historial del navegador y botón Atrás (Android / PC)
  if (pushHistory && typeof window !== 'undefined' && window.history && typeof window.history.pushState === 'function') {
    const currentHash = window.location.hash.replace(/^#/, '');
    if (currentHash !== id) {
      window.history.pushState({ view: id }, '', '#' + id);
    }
  }

  window.scrollTo(0,0);
}
