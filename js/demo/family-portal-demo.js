/**
 * CARPETA ACADÉMICA 4.° A - CONTROLADOR DEL MODO DEMOSTRACIÓN DEL PORTAL FAMILIAR
 * Permite la auditoría visual y de experiencia de usuario de manera segura en localhost.
 * BLOQUEA CUALQUIER LLAMADA A APPS SCRIPT, GOOGLE SHEETS O SERVICIOS EXTERNOS.
 */
(function () {
  'use strict';

  // 1. Verificación estricta de entorno local
  const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  if (!isLocalHost) {
    console.warn('[SEGURIDAD] Modo demostración bloqueado en entorno no local.');
    if (typeof history !== 'undefined' && history.replaceState) {
      history.replaceState({}, '', (window.siteBaseUrl ? window.siteBaseUrl() : '') + '?familia=acceso');
    }
    return;
  }

  // Bandera global de demostración activa y contador de llamadas bloqueadas
  window.__familyDemoActive = true;
  window.__demoAppsScriptCallsBlocked = 0;

  // Estado en memoria de la demostración
  let currentWeek = sessionStorage.getItem('family_demo_week') || '1';
  let isDataConfirmed = sessionStorage.getItem('family_demo_confirmed') === 'true';

  const fixture = window.FAMILY_PORTAL_DEMO_FIXTURE || {};

  /**
   * Helper para asignar familyPortalData tanto a la variable interna de familias.js como a window
   */
  function setPortalData(data) {
    if (typeof window.setFamilyPortalData === 'function') {
      window.setFamilyPortalData(data);
    }
    window.familyPortalData = data;
  }

  /**
   * Obtiene una copia profunda del fixture para la semana activa.
   */
  function buildPortalData(weekNumber = currentWeek, confirmed = isDataConfirmed) {
    const weekNum = parseInt(weekNumber, 10) || 1;
    let weekData;
    if (weekNum === 2) {
      weekData = fixture.week2;
    } else if (weekNum === 1) {
      weekData = fixture.week1;
    } else {
      // Periodo escolar dinámico obtenido del calendario escolar
      const p = (typeof window.getPeriodByNumber === 'function')
        ? window.getPeriodByNumber(weekNum)
        : null;

      const trimester = (weekNum <= 13) ? 1 : ((weekNum <= 26) ? 2 : 3);
      const startMon = p ? p.startMondayIso : '2026-08-31';
      const endFri = p ? p.endFridayIso : '2026-09-04';
      const rangeStr = p ? p.rangeLabel : '';
      const tagStr = p?.tag ? ` · ${p.tag}` : '';
      const periodLabel = `Semana ${weekNum}${tagStr} · ${rangeStr}`;

      weekData = {
        trimester: trimester,
        periodLabel: periodLabel,
        updatedAt: null,
        taskSummary: { completed: 0, total: 0, percentage: 0 },
        attendanceSummary: {
          attended: 0,
          total: 0,
          percentage: 0,
          late: 0,
          justifiedDates: [],
          absenceDates: [],
          lateDates: []
        },
        conductSummary: { score: 0, label: 'Pendiente' },
        participationSummary: { score: 0, label: 'Pendiente' },
        observation: '',
        weeklyTasks: [],
        weeklyReport: {
          period: { start: startMon, end: endFri },
          attendance: { records: [] },
          tasks: []
        }
      };
    }
    const profile = confirmed ? Object.assign({}, fixture.completeProfile) : Object.assign({}, fixture.incompleteProfile);

    return {
      student: Object.assign({}, fixture.student),
      school: Object.assign({}, fixture.school, { totalWeeks: 41 }),
      account: Object.assign({}, fixture.account),
      profile: profile,
      contacts: (fixture.contacts || []).map(c => Object.assign({}, c)),
      complete: Boolean(confirmed),
      academic: JSON.parse(JSON.stringify(weekData))
    };
  }

  window.setDemoWeek = function (weekNumber, targetDate, pushHistory = true) {
    currentWeek = String(weekNumber);
    sessionStorage.setItem('family_demo_week', currentWeek);
    const updated = buildPortalData(currentWeek, isDataConfirmed);
    setPortalData(updated);

    let defaultDate = targetDate;
    if (!defaultDate) {
      if (currentWeek === '2') {
        defaultDate = '2026-09-07';
      } else if (currentWeek === '1') {
        defaultDate = '2026-08-31';
      } else {
        const p = (typeof window.getPeriodByNumber === 'function')
          ? window.getPeriodByNumber(parseInt(currentWeek, 10))
          : null;
        defaultDate = p?.defaultDate || p?.startMondayIso || '2026-08-31';
      }
    }

    if (typeof window.setFamilyDateModern === 'function') {
      window.setFamilyDateModern(defaultDate, pushHistory);
    } else if (typeof window.renderFamilyPortal === 'function') {
      window.renderFamilyPortal();
    }
  };

  /**
   * 2. Cortafuegos y bloqueo central de peticiones hacia Apps Script
   */
  function setupCircuitBreaker() {
    // Interceptar fetch
    const originalFetch = window.fetch;
    window.fetch = async function (resource, init) {
      const url = typeof resource === 'string' ? resource : (resource && resource.url) || '';
      if (window.__familyDemoActive && /script\.google\.com|macros\/s/i.test(url)) {
        window.__demoAppsScriptCallsBlocked++;
        console.info('[BLOQUEO DEMO] Petición externa hacia Apps Script neutralizada. Contador:', window.__demoAppsScriptCallsBlocked);
        return new Response(JSON.stringify({ ok: true, simulated: true, message: 'Acción simulada. No se modificaron datos reales.' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return originalFetch.apply(this, arguments);
    };

    // Interceptar familyServer
    window.familyServer = async function (action, ...args) {
      return handleDemoAction(action, args);
    };

    // Interceptar apiRequest
    if (typeof window.apiRequest === 'function') {
      const origApiRequest = window.apiRequest;
      window.apiRequest = async function (action, payload = [], token = '') {
        if (window.__familyDemoActive) {
          return handleDemoAction(action, payload);
        }
        return origApiRequest(action, payload, token);
      };
    }

    // Interceptar server
    if (typeof window.server === 'function') {
      const origServer = window.server;
      window.server = async function (action, ...args) {
        if (window.__familyDemoActive) {
          return handleDemoAction(action, args);
        }
        return origServer(action, ...args);
      };
    }

    // Interceptar openWhatsappDialog
    window.openWhatsappDialog = function (studentId, phone, studentName) {
      if (window.toast) {
        window.toast('Acción simulada. No se envían mensajes en modo demostración.');
      } else {
        alert('Acción simulada. No se envían mensajes en modo demostración.');
      }
    };
  }

  /**
   * Manejador central de acciones simuladas en memoria
   */
  function handleDemoAction(action, payload) {
    console.info('[MODO DEMO] Acción simulada:', action);

    switch (action) {
      case 'getFamilyPortalInitialData':
      case 'getFamilyPortalData': {
        const d = buildPortalData(currentWeek, isDataConfirmed);
        setPortalData(d);
        return d;
      }
      case 'getFamilyAcademicPeriodData': {
        const weekData = currentWeek === '2' ? fixture.week2 : fixture.week1;
        return JSON.parse(JSON.stringify(weekData));
      }
      case 'getFamilyProfile': {
        const p = isDataConfirmed ? fixture.completeProfile : fixture.incompleteProfile;
        return {
          profile: Object.assign({}, p),
          contacts: (fixture.contacts || []).map(c => Object.assign({}, c)),
          account: Object.assign({}, fixture.account)
        };
      }
      case 'saveFamilyProfile': {
        isDataConfirmed = true;
        sessionStorage.setItem('family_demo_confirmed', 'true');
        const updated = buildPortalData(currentWeek, true);
        setPortalData(updated);
        if (window.toast) window.toast('Acción simulada. Datos guardados en memoria.');
        return {
          success: true,
          message: 'Acción simulada. No se modificaron datos reales.',
          data: {
            profile: updated.profile,
            contacts: updated.contacts,
            complete: true
          }
        };
      }
      case 'saveFamilyAccountSettings': {
        if (window.toast) window.toast('Acción simulada. Configuración de cuenta guardada en memoria.');
        return {
          success: true,
          message: 'Acción simulada. No se modificaron datos reales.',
          account: Object.assign({}, fixture.account),
          token: 'demo-session-token'
        };
      }
      case 'completeFamilyOnboarding': {
        isDataConfirmed = true;
        sessionStorage.setItem('family_demo_confirmed', 'true');
        if (window.toast) window.toast('Acción simulada. Contraseña actualizada en memoria.');
        return {
          success: true,
          message: 'Acción simulada. No se modificaron datos reales.',
          token: 'demo-session-token'
        };
      }
      case 'familyLogin': {
        return {
          token: 'demo-session-token',
          message: 'Acceso simulado correcto.'
        };
      }
      case 'validateFamilyInvitation': {
        return {
          student: Object.assign({}, fixture.student),
          expiresAt: '2026-11-20T12:00:00Z'
        };
      }
      case 'validateGroupInvitation': {
        return { ok: true };
      }
      case 'searchGroupStudents': {
        return [
          {
            id: 'DEMO-001',
            name: 'HERNÁNDEZ LÓPEZ MATEO (DEMOSTRACIÓN)',
            hasPhone: true
          }
        ];
      }
      case 'requestFamilyPasswordReset': {
        return {
          message: 'Acción simulada. Enlace ficticio de recuperación generado.'
        };
      }
      case 'validateFamilyReset': {
        return {
          studentName: 'MATEO HERNÁNDEZ LÓPEZ (DEMOSTRACIÓN)'
        };
      }
      case 'resetFamilyPassword': {
        return {
          message: 'Acción simulada. La contraseña fue actualizada en memoria.'
        };
      }
      default: {
        return {
          ok: true,
          message: 'Acción simulada. No se modificaron datos reales.'
        };
      }
    }
  }

  /**
   * 3. Inyección de estilos y marca visual permanente
   */
  function injectDemoStyles() {
    if (document.getElementById('familyDemoStyles')) return;
    const style = document.createElement('style');
    style.id = 'familyDemoStyles';
    style.textContent = `
      .family-demo-watermark {
        position: sticky;
        top: 0;
        z-index: 10001;
        background: linear-gradient(90deg, #92400e, #d97706, #92400e);
        color: #ffffff;
        font-family: inherit;
        font-size: 11.5px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        text-align: center;
        padding: 5px 12px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }
      .family-demo-watermark span {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #fef08a;
        box-shadow: 0 0 6px #fef08a;
      }
      .family-demo-toolbar-dock {
        position: fixed;
        bottom: 14px;
        right: 14px;
        z-index: 10002;
        font-family: system-ui, -apple-system, sans-serif;
      }
      .family-demo-toggle-btn {
        background: #0f172a;
        color: #f8fafc;
        border: 2px solid #38bdf8;
        border-radius: 999px;
        padding: 10px 18px;
        font-size: 12.5px;
        font-weight: 800;
        cursor: pointer;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        display: flex;
        align-items: center;
        gap: 8px;
        transition: transform 0.15s ease, background 0.2s ease;
      }
      .family-demo-toggle-btn:hover {
        transform: scale(1.03);
        background: #1e293b;
      }
      .family-demo-toolbar {
        position: absolute;
        bottom: 50px;
        right: 0;
        width: min(440px, calc(100vw - 28px));
        max-height: 80vh;
        overflow-y: auto;
        background: #0f172a;
        color: #e2e8f0;
        border: 1px solid #334155;
        border-radius: 18px;
        padding: 16px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.45);
        display: none;
      }
      .family-demo-toolbar.open {
        display: block;
      }
      .family-demo-toolbar-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        border-bottom: 1px solid #334155;
        padding-bottom: 8px;
      }
      .family-demo-toolbar-head h3 {
        margin: 0;
        font-size: 13.5px;
        font-weight: 800;
        color: #38bdf8;
        letter-spacing: 0.05em;
      }
      .family-demo-toolbar-head button {
        background: transparent;
        border: 0;
        color: #94a3b8;
        font-size: 18px;
        cursor: pointer;
        padding: 2px 6px;
      }
      .family-demo-section-label {
        font-size: 10px;
        font-weight: 800;
        text-transform: uppercase;
        color: #94a3b8;
        letter-spacing: 0.06em;
        margin: 10px 0 6px;
      }
      .family-demo-btn-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 6px;
      }
      .family-demo-btn-grid.three {
        grid-template-columns: repeat(3, 1fr);
      }
      .family-demo-btn {
        background: #1e293b;
        color: #f1f5f9;
        border: 1px solid #475569;
        border-radius: 8px;
        padding: 7px 10px;
        font-size: 11px;
        font-weight: 700;
        text-align: left;
        cursor: pointer;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        transition: background 0.15s ease, border-color 0.15s ease;
      }
      .family-demo-btn:hover {
        background: #334155;
        border-color: #38bdf8;
      }
      .family-demo-btn.highlight {
        background: #0284c7;
        border-color: #38bdf8;
        color: #ffffff;
      }
      .family-demo-btn.warn {
        background: #b45309;
        border-color: #f59e0b;
        color: #ffffff;
      }
      .family-demo-btn.danger {
        background: #991b1b;
        border-color: #f87171;
        color: #ffffff;
      }
      .family-demo-week-switch {
        display: flex;
        background: #1e293b;
        border-radius: 10px;
        padding: 3px;
        margin-bottom: 10px;
        border: 1px solid #334155;
      }
      .family-demo-week-btn {
        flex: 1;
        background: transparent;
        border: 0;
        color: #94a3b8;
        padding: 6px 10px;
        font-size: 11px;
        font-weight: 800;
        border-radius: 7px;
        cursor: pointer;
        text-align: center;
      }
      .family-demo-week-btn.active {
        background: #0284c7;
        color: #ffffff;
      }
      .family-demo-quick-login-card {
        margin-top: 14px;
        padding: 12px;
        background: #f0fdf4;
        border: 1.5px dashed #22c55e;
        border-radius: 12px;
        text-align: center;
      }
      .family-demo-quick-login-card p {
        margin: 0 0 8px;
        font-size: 12px;
        color: #15803d;
        font-weight: 700;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * 4. Inyección del banner de marca visual en la parte superior
   */
  function ensureWatermark() {
    if (document.getElementById('familyDemoWatermark')) return;
    const banner = document.createElement('div');
    banner.id = 'familyDemoWatermark';
    banner.className = 'family-demo-watermark';
    banner.innerHTML = '<span></span> MODO DEMOSTRACIÓN · DATOS FICTICIOS <span></span>';
    const portal = document.getElementById('familyPortal');
    if (portal) {
      portal.insertBefore(banner, portal.firstChild);
    } else {
      document.body.insertBefore(banner, document.body.firstChild);
    }
  }

  /**
   * 5. Agrega botón rápido de acceso simulado en la pantalla de login
   */
  function enhanceLoginPanel() {
    const loginForm = document.getElementById('familyLoginForm');
    if (!loginForm || document.getElementById('familyDemoQuickLoginBtn')) return;

    // Rellenar campos de login con credenciales demo ficticias
    const emailInput = loginForm.querySelector('input[name="email"]');
    const passInput = loginForm.querySelector('input[name="password"]');
    if (emailInput && !emailInput.value) emailInput.value = 'demo.tutor';
    if (passInput && !passInput.value) passInput.value = 'Demostracion2026!';

    const box = document.createElement('div');
    box.className = 'family-demo-quick-login-card';
    box.innerHTML = `
      <p>💡 Modo demostración activo: no se requieren credenciales reales.</p>
      <button type="button" id="familyDemoQuickLoginBtn" class="btn primary full-button" style="background:#0284c7;border-color:#0284c7;font-weight:800;padding:10px;">
        🚀 Entrar con cuenta de demostración
      </button>
    `;
    loginForm.appendChild(box);

    document.getElementById('familyDemoQuickLoginBtn').addEventListener('click', () => {
      simulateLogin();
    });
  }

  /**
   * Simula el inicio de sesión y dispara el flujo inicial (con popup de actualización)
   */
  async function simulateLogin() {
    if (typeof window.storeFamilySession === 'function') {
      window.storeFamilySession('demo-session-token-local', false);
    }
    sessionStorage.setItem('family_demo_session', 'active');

    // Cargar datos en memoria (inicialmente con datos pendientes para que salte el popup)
    const initialData = buildPortalData(currentWeek, isDataConfirmed);
    setPortalData(initialData);

    if (typeof window.renderFamilyPortal === 'function') {
      window.renderFamilyPortal();
    }
    if (typeof window.showFamilyPanel === 'function') {
      window.showFamilyPanel('familyAppPanel');
    }

    // Si aún no está confirmado, abrir el popup real #familyIncompleteNoticeDialog
    if (!isDataConfirmed) {
      setTimeout(() => {
        openRealIncompletePopup();
      }, 180);
    }
  }

  /**
   * Abre y enlaza el popup real #familyIncompleteNoticeDialog
   */
  function openRealIncompletePopup() {
    if (typeof window.checkAndNotifyIncompleteFamilyProfile === 'function') {
      window.checkAndNotifyIncompleteFamilyProfile();
    }
  }

  /**
   * Simula la confirmación de datos: asigna dataConfirmedAt, actualiza el perfil y refresca
   */
  function simulateConfirmData(goToProfile = false) {
    isDataConfirmed = true;
    sessionStorage.setItem('family_demo_confirmed', 'true');

    // Actualizar datos del portal en memoria con el perfil completo
    const confirmedData = buildPortalData(currentWeek, true);
    setPortalData(confirmedData);

    const dialog = document.getElementById('familyIncompleteNoticeDialog');
    if (dialog && dialog.open) {
      if (dialog.close) dialog.close();
      else dialog.removeAttribute('open');
    }

    if (typeof window.renderFamilyPortal === 'function') {
      window.renderFamilyPortal();
    }

    if (goToProfile) {
      const tabBtn = document.querySelector('[data-family-view="familyProfile"]');
      if (tabBtn) tabBtn.click();
    }

    if (window.toast) {
      window.toast('✓ Datos confirmados en memoria (Modo Demostración).');
    }
  }

  /**
   * Cambia la semana académica ficticia activa (Semana 1 / Semana 2)
   */
  function switchDemoWeek(week) {
    currentWeek = String(week);
    sessionStorage.setItem('family_demo_week', currentWeek);

    // Actualizar botones de semana en la barra
    document.querySelectorAll('.family-demo-week-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.week === currentWeek);
    });

    // Actualizar fecha de planeación para sincronizar con enhancements.js
    if (currentWeek === '1') {
      window.planningSelectedDate = '2026-08-31';
    } else {
      window.planningSelectedDate = '2026-09-07';
    }

    const typeEl = document.getElementById('familyPeriodType');
    const dateEl = document.getElementById('familyPeriodDate');
    if (typeEl) typeEl.value = 'week';
    if (dateEl) dateEl.value = window.planningSelectedDate;

    // Actualizar el portal data en memoria
    const weekData = buildPortalData(currentWeek, isDataConfirmed);
    setPortalData(weekData);

    if (typeof window.setFamilyDateModern === 'function') {
      window.setFamilyDateModern(window.planningSelectedDate);
    }
    if (typeof window.renderFamilyPortal === 'function') {
      window.renderFamilyPortal();
    }
    if (typeof window.renderFamilyAcademic === 'function') {
      window.renderFamilyAcademic();
    }
    if (typeof window.renderFamilyWeeklyReport === 'function') {
      window.renderFamilyWeeklyReport();
    }

    if (window.toast) {
      window.toast(`Mostrando información de la Semana ${currentWeek}.`);
    }
  }

  /**
   * Carga una simulación de estado sin datos para auditoría visual
   */
  function showEmptyState() {
    const emptyData = buildPortalData(currentWeek, isDataConfirmed);
    emptyData.academic.taskSummary = { completed: 0, total: 0, percentage: 0 };
    emptyData.academic.attendanceSummary = { attended: 0, total: 0, percentage: 0, late: 0, justifiedDates: [], absenceDates: [], lateDates: [] };
    emptyData.academic.weeklyTasks = [];
    emptyData.academic.fields.forEach(f => {
      f.completed = 0;
      f.total = 0;
      f.tasks = [];
      f.pending = [];
    });
    emptyData.academic.weeklyReport.tasks = [];
    emptyData.academic.weeklyReport.learnings = [];
    emptyData.academic.weeklyReport.achievements = [];
    emptyData.academic.weeklyReport.observations = [];
    setPortalData(emptyData);

    if (typeof window.renderFamilyPortal === 'function') window.renderFamilyPortal();
    if (typeof window.renderFamilyAcademic === 'function') window.renderFamilyAcademic();
    if (typeof window.renderFamilyWeeklyReport === 'function') window.renderFamilyWeeklyReport();
    if (window.toast) window.toast('Visualizando estado sin datos registrados.');
  }

  /**
   * 6. Construcción de la barra de navegación flotante del modo local
   */
  function buildDemoToolbar() {
    if (document.getElementById('familyDemoToolbarDock')) return;

    const dock = document.createElement('aside');
    dock.id = 'familyDemoToolbarDock';
    dock.className = 'family-demo-toolbar-dock';
    dock.innerHTML = `
      <div id="familyDemoToolbar" class="family-demo-toolbar">
        <div class="family-demo-toolbar-head">
          <h3>🛠️ MODO DEMOSTRACIÓN</h3>
          <button type="button" id="familyDemoCloseToolbar" title="Cerrar panel">✕</button>
        </div>

        <div class="family-demo-section-label">SELECCIÓN DE SEMANA ACADÉMICA</div>
        <div class="family-demo-week-switch">
          <button type="button" class="family-demo-week-btn ${currentWeek === '1' ? 'active' : ''}" data-week="1">Semana 1 (Asist. 100%)</button>
          <button type="button" class="family-demo-week-btn ${currentWeek === '2' ? 'active' : ''}" data-week="2">Semana 2 (Incidencias)</button>
        </div>

        <div class="family-demo-section-label">FLUJO Y PANTALLAS PRINCIPALES</div>
        <div class="family-demo-btn-grid">
          <button type="button" class="family-demo-btn highlight" data-demo-action="start-flow">🔄 Iniciar recorrido</button>
          <button type="button" class="family-demo-btn" data-demo-action="show-login">🔑 Pantalla de acceso</button>
          <button type="button" class="family-demo-btn" data-demo-action="show-first-access">📩 Primer acceso</button>
          <button type="button" class="family-demo-btn warn" data-demo-action="show-popup">⚠️ Mostrar popup</button>
          <button type="button" class="family-demo-btn" data-demo-action="confirm-data">✅ Simular confirmación</button>
          <button type="button" class="family-demo-btn" data-demo-action="show-app">🏠 Portal principal</button>
        </div>

        <div class="family-demo-section-label">SECCIONES DEL PORTAL FAMILIAR</div>
        <div class="family-demo-btn-grid three">
          <button type="button" class="family-demo-btn" data-demo-action="view-overview">📊 Resumen</button>
          <button type="button" class="family-demo-btn" data-demo-action="view-attendance">📅 Asistencia</button>
          <button type="button" class="family-demo-btn" data-demo-action="view-tasks">📝 Tareas</button>
          <button type="button" class="family-demo-btn" data-demo-action="view-grades">🏅 Calificaciones</button>
          <button type="button" class="family-demo-btn" data-demo-action="view-conduct">🤝 Conducta</button>
          <button type="button" class="family-demo-btn" data-demo-action="view-profile">👥 Familiares</button>
          <button type="button" class="family-demo-btn" data-demo-action="view-contacts">🛡️ Autorizados</button>
          <button type="button" class="family-demo-btn" data-demo-action="view-account">⚙️ Mi cuenta</button>
          <button type="button" class="family-demo-btn highlight" data-demo-action="view-weekly-report">📄 Reporte semanal</button>
        </div>

        <div class="family-demo-section-label">RECUPERACIÓN Y ESTADOS VISUALES</div>
        <div class="family-demo-btn-grid">
          <button type="button" class="family-demo-btn highlight" data-demo-action="day-filled">☀️ Día con datos</button>
          <button type="button" class="family-demo-btn warn" data-demo-action="day-empty">📭 Día sin publicar</button>
          <button type="button" class="family-demo-btn" data-demo-action="show-reset">❓ Recuperar clave</button>
          <button type="button" class="family-demo-btn" data-demo-action="show-loading">⏳ Estado cargando</button>
          <button type="button" class="family-demo-btn" data-demo-action="show-empty">📭 Semana vacía</button>
          <button type="button" class="family-demo-btn" data-demo-action="show-error">⚠️ Error controlado</button>
          <button type="button" class="family-demo-btn" data-demo-action="show-expired">⏰ Sesión vencida</button>
          <button type="button" class="family-demo-btn warn" data-demo-action="reset-demo">🔄 Restablecer todo</button>
        </div>

        <div style="margin-top:12px;border-top:1px solid #334155;padding-top:10px;">
          <button type="button" class="family-demo-btn danger" style="width:100%;text-align:center;padding:9px;" data-demo-action="exit-demo">
            🚪 Salir del modo demostración
          </button>
        </div>
      </div>

      <button type="button" id="familyDemoToggleBtn" class="family-demo-toggle-btn">
        <span>🛠️</span>
        <span>Controles Demo</span>
      </button>
    `;
    document.body.appendChild(dock);

    // Eventos de la barra
    const toggleBtn = document.getElementById('familyDemoToggleBtn');
    const toolbar = document.getElementById('familyDemoToolbar');
    const closeBtn = document.getElementById('familyDemoCloseToolbar');

    toggleBtn.addEventListener('click', () => {
      toolbar.classList.toggle('open');
    });
    closeBtn.addEventListener('click', () => {
      toolbar.classList.remove('open');
    });

    // Selector de semanas
    dock.querySelectorAll('.family-demo-week-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        switchDemoWeek(btn.dataset.week);
      });
    });

    // Despachador de acciones de la barra
    dock.querySelectorAll('[data-demo-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        handleToolbarAction(btn.dataset.demoAction);
      });
    });
  }

  /**
   * Ejecuta la acción seleccionada en la barra de demostración
   */
  function handleToolbarAction(action) {
    switch (action) {
      case 'start-flow': {
        isDataConfirmed = false;
        sessionStorage.setItem('family_demo_confirmed', 'false');
        sessionStorage.removeItem('family_demo_session');
        window.familySessionToken = '';
        if (typeof window.showFamilyPanel === 'function') {
          window.showFamilyPanel('familyLoginPanel');
        }
        enhanceLoginPanel();
        if (window.toast) window.toast('Recorrido reiniciado: pantalla de acceso.');
        break;
      }
      case 'show-login': {
        if (typeof window.showFamilyPanel === 'function') {
          window.showFamilyPanel('familyLoginPanel');
        }
        enhanceLoginPanel();
        break;
      }
      case 'show-first-access': {
        if (typeof window.showFamilyPanel === 'function') {
          window.showFamilyPanel('familyInvitationPanel');
          const studentEl = document.getElementById('familyInvitationStudent');
          if (studentEl) {
            studentEl.textContent = 'Crearás el acceso para MATEO HERNÁNDEZ LÓPEZ (DEMOSTRACIÓN). La invitación vence el 20 de noviembre de 2026.';
          }
        }
        break;
      }
      case 'show-popup': {
        isDataConfirmed = false;
        sessionStorage.setItem('family_demo_confirmed', 'false');
        setPortalData(buildPortalData(currentWeek, false));
        openRealIncompletePopup();
        break;
      }
      case 'confirm-data': {
        simulateConfirmData(false);
        break;
      }
      case 'show-app': {
        const d = buildPortalData(currentWeek, isDataConfirmed);
        setPortalData(d);
        if (typeof window.showFamilyPanel === 'function') {
          window.showFamilyPanel('familyAppPanel');
        }
        if (typeof window.renderFamilyPortal === 'function') {
          window.renderFamilyPortal();
        }
        break;
      }
      case 'view-overview': {
        handleToolbarAction('show-app');
        if (typeof window.showFamilyView === 'function') window.showFamilyView('familyOverview');
        break;
      }
      case 'view-attendance': {
        handleToolbarAction('view-overview');
        setTimeout(() => {
          document.querySelector('.attendance-metric')?.scrollIntoView({ behavior: 'smooth' });
        }, 150);
        break;
      }
      case 'view-tasks': {
        handleToolbarAction('show-app');
        if (typeof window.showFamilyView === 'function') window.showFamilyView('familyTasks');
        break;
      }
      case 'view-grades': {
        handleToolbarAction('show-app');
        if (typeof window.showFamilyView === 'function') window.showFamilyView('familyGrades');
        break;
      }
      case 'view-conduct': {
        handleToolbarAction('view-overview');
        setTimeout(() => {
          document.querySelector('.conduct-metric')?.scrollIntoView({ behavior: 'smooth' });
        }, 150);
        break;
      }
      case 'view-profile': {
        handleToolbarAction('show-app');
        if (typeof window.showFamilyView === 'function') window.showFamilyView('familyProfile');
        break;
      }
      case 'view-contacts': {
        handleToolbarAction('view-profile');
        setTimeout(() => {
          document.querySelector('.directory-contact')?.scrollIntoView({ behavior: 'smooth' });
        }, 150);
        break;
      }
      case 'view-account': {
        handleToolbarAction('show-app');
        if (typeof window.showFamilyView === 'function') window.showFamilyView('familyAccount');
        break;
      }
      case 'view-weekly-report': {
        handleToolbarAction('show-app');
        if (typeof window.openFamilyWeeklyReport === 'function') {
          window.openFamilyWeeklyReport();
        } else if (typeof window.showFamilyView === 'function') {
          window.showFamilyView('familyWeeklyReport');
        }
        break;
      }
      case 'show-reset': {
        if (typeof window.showFamilyPanel === 'function') {
          window.showFamilyPanel('familyResetPanel');
          const resetStudent = document.getElementById('familyResetStudent');
          if (resetStudent) resetStudent.textContent = 'Cuenta de MATEO HERNÁNDEZ LÓPEZ (DEMOSTRACIÓN)';
        }
        break;
      }
      case 'show-loading': {
        if (typeof window.setLoading === 'function') {
          window.setLoading(true, 'Cargando avance académico (Demostración)…');
          setTimeout(() => {
            window.setLoading(false);
          }, 2500);
        }
        break;
      }
      case 'day-filled': {
        handleToolbarAction('show-app');
        if (typeof window.setFamilyDateModern === 'function') window.setFamilyDateModern('2026-08-31');
        if (typeof window.showFamilyView === 'function') window.showFamilyView('familyOverview');
        if (window.toast) window.toast('Consultando día con publicaciones completas (31 de agosto).');
        break;
      }
      case 'day-empty': {
        handleToolbarAction('show-app');
        if (typeof window.setFamilyDateModern === 'function') window.setFamilyDateModern('2026-09-01');
        if (typeof window.showFamilyView === 'function') window.showFamilyView('familyOverview');
        if (window.toast) window.toast('Consultando día sin información publicada (1 de septiembre).');
        break;
      }
      case 'show-empty': {
        handleToolbarAction('show-app');
        showEmptyState();
        break;
      }
      case 'show-error': {
        if (typeof window.showFamilyPanel === 'function') window.showFamilyPanel('familyLoginPanel');
        if (typeof window.familyMessage === 'function') {
          window.familyMessage('Error controlado de ejemplo: No se pudo verificar el acceso familiar.', true);
        }
        break;
      }
      case 'show-expired': {
        if (typeof window.showFamilyPanel === 'function') window.showFamilyPanel('familyLoginPanel');
        if (typeof window.familyMessage === 'function') {
          window.familyMessage('Tu sesión familiar expiró por inactividad. Ingresa de nuevo.', false);
        }
        break;
      }
      case 'reset-demo': {
        sessionStorage.removeItem('family_demo_confirmed');
        sessionStorage.removeItem('family_demo_session');
        sessionStorage.removeItem('family_demo_week');
        currentWeek = '1';
        isDataConfirmed = false;
        handleToolbarAction('start-flow');
        break;
      }
      case 'exit-demo': {
        sessionStorage.removeItem('family_demo_confirmed');
        sessionStorage.removeItem('family_demo_session');
        sessionStorage.removeItem('family_demo_week');
        window.__familyDemoActive = false;
        const targetUrl = (window.siteBaseUrl ? window.siteBaseUrl() : '') + '?familia=acceso';
        window.location.href = targetUrl;
        break;
      }
    }
  }

  /**
   * 7. Inicializador público principal llamado por familias.js
   */
  window.initFamilyPortalDemo = function () {
    console.info('[MODO DEMO] Inicializando modo demostración local seguro...');
    setupCircuitBreaker();
    injectDemoStyles();
    ensureWatermark();
    buildDemoToolbar();

    // Comprobar si ya había una sesión demo activa en este navegador (por ejemplo tras F5)
    const hasActiveSession = sessionStorage.getItem('family_demo_session') === 'active';

    if (hasActiveSession) {
      const d = buildPortalData(currentWeek, isDataConfirmed);
      setPortalData(d);
      if (typeof window.showFamilyPanel === 'function') {
        window.showFamilyPanel('familyAppPanel');
      }
      if (typeof window.renderFamilyPortal === 'function') {
        window.renderFamilyPortal();
      }
    } else {
      // Iniciar en pantalla de acceso con botón rápido y credenciales de muestra
      if (typeof window.showFamilyPanel === 'function') {
        window.showFamilyPanel('familyLoginPanel');
      }
      enhanceLoginPanel();
    }
  };

  // Autoejecución si el documento ya estaba listo al cargar el script
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(window.initFamilyPortalDemo, 50);
  } else {
    document.addEventListener('DOMContentLoaded', window.initFamilyPortalDemo);
  }
})();
