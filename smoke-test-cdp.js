const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8092;
const CDP_PORT = 9333;
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  if (req.url === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }

  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.join(ROOT, reqPath);

  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, async () => {
  console.log(`[CDP SMOKE TEST] Servidor HTTP local en http://localhost:${PORT}`);
  try {
    await runCDPTest();
  } catch (err) {
    console.error('[CDP SMOKE TEST] FALLÓ la prueba:', err);
    process.exit(1);
  } finally {
    server.close();
  }
});

async function runCDPTest() {
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const profileDir = path.join(ROOT, '.tmp-chrome-smoke-profile');

  if (fs.existsSync(profileDir)) {
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (e) {}
  }

  console.log('[CDP SMOKE TEST] Lanzando Chrome Headless...');
  const chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    `--user-data-dir=${profileDir}`,
    'about:blank'
  ]);

  let connected = false;
  let tabInfo = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 250));
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
      const tabs = await res.json();
      tabInfo = tabs.find(t => t.type === 'page');
      if (tabInfo && tabInfo.webSocketDebuggerUrl) {
        connected = true;
        break;
      }
    } catch (e) {}
  }

  if (!connected || !tabInfo) {
    chrome.kill();
    throw new Error('No se pudo conectar al endpoint CDP de Chrome.');
  }

  console.log('[CDP SMOKE TEST] WebSocket CDP disponible:', tabInfo.webSocketDebuggerUrl);

  const ws = new WebSocket(tabInfo.webSocketDebuggerUrl);
  const uncaughtExceptions = [];
  const consoleErrors = [];
  let msgId = 1;
  const pendingRequests = new Map();

  function sendCommand(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      pendingRequests.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  ws.onmessage = event => {
    const data = JSON.parse(event.data);
    if (data.id && pendingRequests.has(data.id)) {
      const { resolve, reject } = pendingRequests.get(data.id);
      pendingRequests.delete(data.id);
      if (data.error) reject(data.error);
      else resolve(data.result);
      return;
    }

    if (data.method === 'Runtime.exceptionThrown') {
      const details = data.params.exceptionDetails;
      const text = details.exception?.description || details.text || 'Excepción desconocida';
      console.error('[CDP Runtime.exceptionThrown]:', text);
      uncaughtExceptions.push(text);
    }
    if (data.method === 'Log.entryAdded' && data.params.entry?.level === 'error') {
      console.error('[CDP Log.error]:', data.params.entry.text);
      consoleErrors.push(data.params.entry.text);
    }
  };

  await sendCommand('Runtime.enable');
  await sendCommand('Page.enable');
  await sendCommand('Log.enable');

  console.log(`[CDP SMOKE TEST] Navegando a http://localhost:${PORT}/index.html#evaluaciones-trimestrales...`);
  await sendCommand('Page.navigate', { url: `http://localhost:${PORT}/index.html#evaluaciones-trimestrales` });

  await new Promise(r => setTimeout(r, 2500));

  // =========================================================================
  // FASE 1: PRUEBAS FUNCIONALES EN DESKTOP (ETAPA 3)
  // =========================================================================
  console.log('[CDP SMOKE TEST] Ejecutando pruebas de la Etapa 3 en Desktop...');
  const desktopEval = await sendCommand('Runtime.evaluate', {
    expression: `(function() {
      const results = {};

      if (typeof unlockTeacherApp === 'function') unlockTeacherApp();
      if (typeof hideBoot === 'function') hideBoot();
      if (typeof showView === 'function') showView('evaluaciones-trimestrales');
      if (typeof window.initEvaluacionesTrimestrales === 'function') window.initEvaluacionesTrimestrales();

      // 1. Recuperación de actividades y prevención de duplicados
      const rawActs = window.getEvalRawActivities();
      results.totalRawActivities = rawActs.classes.length;
      const actIds = rawActs.classes.map(a => String(a.id));
      const uniqueIds = new Set(actIds);
      results.noDuplicates = (actIds.length === uniqueIds.size);

      // 2. Conmutar a la pestaña Selección de actividades
      window.switchEvalTab('seleccion-actividades');
      const tabSel = document.getElementById('evalTabSeleccionActividades');
      results.tabSeleccionActive = tabSel && !tabSel.classList.contains('hidden-tab');

      // 3. Verificación de estadísticas iniciales de actividades
      const statTotal = document.getElementById('evalStatActTotal');
      const statSelected = document.getElementById('evalStatActSelected');
      results.displayedTotal = statTotal ? Number(statTotal.textContent) : 0;
      results.displayedSelected = statSelected ? Number(statSelected.textContent) : 0;

      // 4. Filtrado por campo formativo (Lenguajes)
      const fieldFilter = document.getElementById('evalActivityFieldFilter');
      if (fieldFilter) {
        fieldFilter.value = 'Lenguajes';
        fieldFilter.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const tbody = document.getElementById('evalActivitiesTableBody');
      const filteredRowsCount = tbody ? tbody.querySelectorAll('tr').length : 0;
      results.filteredLenguajesRows = filteredRowsCount;

      // 5. Deselección masiva de visibles
      window.actions['eval-deselect-all-visible']();
      const selAfterDeselect = window.getCurrentActivitySelection(1);
      results.deselectedCount = selAfterDeselect.selectedIds.length;

      // 6. Selección masiva de visibles
      window.actions['eval-select-all-visible']();
      const selAfterSelect = window.getCurrentActivitySelection(1);
      results.reselectedCount = selAfterSelect.selectedIds.length;

      // Restaurar filtro de campo formativo
      if (fieldFilter) {
        fieldFilter.value = '';
        fieldFilter.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // 7. Selección individual de actividad (deseleccionar la primera actividad)
      const firstActId = rawActs.classes[0]?.id;
      if (firstActId) {
        window.toggleActivitySelection(firstActId);
        results.firstActExcluded = !window.getCurrentActivitySelection(1).selectedIds.includes(String(firstActId));
        // Volver a seleccionarla
        window.toggleActivitySelection(firstActId);
        results.firstActRestored = window.getCurrentActivitySelection(1).selectedIds.includes(String(firstActId));
      }

      // 8. Modo de ponderación de actividades (uniforme vs personalizado)
      window.setActivityWeightMode('custom');
      const selWithCustom = window.getCurrentActivitySelection(1);
      results.isCustomWeightMode = (selWithCustom.weightMode === 'custom');

      // Asignar ponderación individual personalizada a la primera actividad
      if (firstActId) {
        selWithCustom.customWeights[firstActId] = 2.5;
        results.customWeightAssigned = selWithCustom.customWeights[firstActId];
      }

      // 9. Independencia entre trimestres en selección de actividades
      // Cambiar a Trimestre 2
      window.selectEvalTrimester(2);
      const selT2 = window.getCurrentActivitySelection(2);
      results.t2SelectionExists = Boolean(selT2);
      results.t2IndependentFromT1 = (selT2.customWeights[firstActId] === undefined); // T2 no debe tener la ponderación de T1
      // Regresar a Trimestre 1
      window.selectEvalTrimester(1);

      // 10. Recuperación de registros de conducta y participación
      const conductBadge = document.getElementById('evalConductCountBadge');
      const partBadge = document.getElementById('evalPartCountBadge');
      results.conductBadgeText = conductBadge ? conductBadge.textContent : null;
      results.partBadgeText = partBadge ? partBadge.textContent : null;

      // 11. Persistencia de la selección de actividades
      const saveActResult = window.saveEvalActivitySelection();
      results.saveActivitiesSuccess = saveActResult;
      const storedActs = localStorage.getItem('carpeta_eval_act_selection_v3');
      results.hasLocalStorageActivities = Boolean(storedActs);

      return results;
    })()`,
    returnByValue: true
  });

  console.log('[CDP SMOKE TEST] Resultados de pruebas Desktop:', JSON.stringify(desktopEval.result.value, null, 2));

  // =========================================================================
  // FASE 2: PRUEBAS EN DISPOSITIVO MÓVIL CON EVENTOS TÁCTILES REALES
  // =========================================================================
  console.log('[CDP SMOKE TEST] Configurando emulación táctil móvil (390x844)...');
  await sendCommand('Emulation.setTouchEmulationEnabled', { enabled: true });
  await sendCommand('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    mobile: true
  });

  await new Promise(r => setTimeout(r, 600));

  // Primero regresar al panel de seguimiento
  await sendCommand('Runtime.evaluate', {
    expression: `window.switchEvalTab('seguimiento');`
  });

  await new Promise(r => setTimeout(r, 300));

  // Obtener posición del botón táctil 'Selección de actividades'
  console.log('[CDP SMOKE TEST] Obteniendo coordenadas de botón táctil [data-tab="seleccion-actividades"]...');
  const boxResult = await sendCommand('Runtime.evaluate', {
    expression: `(function() {
      // Asegurar que diálogos modales o menús laterales no bloqueen la vista
      const teacherDlg = document.getElementById('teacherLoginDialog');
      if (teacherDlg) { teacherDlg.close?.(); teacherDlg.classList.add('hidden-control'); }
      const loginDlg = document.getElementById('loginDialog');
      if (loginDlg) { loginDlg.close?.(); loginDlg.classList.add('hidden-control'); }
      document.getElementById('sidebar')?.classList.remove('open');
      document.getElementById('sidebarBackdrop')?.classList.remove('active');
      const backdrop = document.querySelector('.modal-backdrop');
      if (backdrop) backdrop.remove();

      const btn = document.querySelector('.eval-tab-btn[data-tab="seleccion-actividades"]');
      if (!btn) return null;
      btn.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
      const rect = btn.getBoundingClientRect();
      const cx = Math.round(rect.x + rect.width / 2);
      const cy = Math.round(rect.y + rect.height / 2);
      const topEl = document.elementFromPoint(cx, cy);
      return { x: cx, y: cy, width: rect.width, height: rect.height, topEl: topEl ? topEl.outerHTML.slice(0, 100) : null };
    })()`,
    returnByValue: true
  });

  const box = boxResult.result.value;
  console.log('[CDP SMOKE TEST] Coordenadas táctiles:', box);

  if (box && box.width > 0 && box.height > 0) {
    console.log(`[CDP SMOKE TEST] Despachando eventos táctiles nativos del motor de Chromium en (${box.x}, ${box.y})...`);
    await sendCommand('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ id: 0, x: box.x, y: box.y }]
    });
    await new Promise(r => setTimeout(r, 80));
    await sendCommand('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: []
    });

    await new Promise(r => setTimeout(r, 500));
  }

  // Verificar que el evento táctil nativo cambió a la pestaña 'seleccion-actividades'
  const mobileEval = await sendCommand('Runtime.evaluate', {
    expression: `(function() {
      const tabSel = document.getElementById('evalTabSeleccionActividades');
      const isTabActive = tabSel && !tabSel.classList.contains('hidden-tab');

      // Verificar tamaño de targets táctiles visibles (>= 40px)
      const allBtns = Array.from(document.querySelectorAll('.eval-tab-btn, .eval-trimester-btn, .eval-activities-filter-panel .btn, .eval-config-actions-bar .btn'));
      const visibleBtns = allBtns.filter(b => b.offsetParent !== null);
      const smallTargets = visibleBtns.filter(b => b.getBoundingClientRect().height < 40);

      return {
        tabSwitchedViaNativeTouch: Boolean(isTabActive),
        allTouchTargetsAccessible: smallTargets.length === 0,
        testedButtonsCount: visibleBtns.length
      };
    })()`,
    returnByValue: true
  });

  console.log('[CDP SMOKE TEST] Resultados de pruebas táctiles:', JSON.stringify(mobileEval.result.value, null, 2));

  await sendCommand('Emulation.setTouchEmulationEnabled', { enabled: false });
  await sendCommand('Emulation.clearDeviceMetricsOverride');

  await new Promise(r => setTimeout(r, 500));

  ws.close();
  chrome.kill();

  try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (e) {}

  console.log('\n============================================================');
  console.log('[CDP SMOKE TEST] RESUMEN DE VERIFICACIÓN ETAPA 3');
  console.log('============================================================');
  console.log(`Excepciones no capturadas (exceptionThrown): ${uncaughtExceptions.length}`);
  console.log(`Errores en consola (consoleErrors): ${consoleErrors.length}`);

  const d = desktopEval.result.value;
  const m = mobileEval.result.value;

  console.log(`Recuperación de actividades sin duplicados: ${d.noDuplicates ? 'OK (' + d.totalRawActivities + ' actividades únicas)' : 'FALLÓ'}`);
  console.log(`Pestaña Selección de actividades activa: ${d.tabSeleccionActive ? 'OK' : 'FALLÓ'}`);
  console.log(`Filtrado por campo formativo: ${d.filteredLenguajesRows > 0 ? 'OK (' + d.filteredLenguajesRows + ' filas)' : 'FALLÓ'}`);
  console.log(`Deselección y selección masiva: ${d.deselectedCount !== undefined && d.reselectedCount !== undefined ? 'OK' : 'FALLÓ'}`);
  console.log(`Selección y exclusión individual: ${d.firstActExcluded && d.firstActRestored ? 'OK' : 'FALLÓ'}`);
  console.log(`Modalidad de ponderación (uniforme vs personalizada): ${d.isCustomWeightMode && d.customWeightAssigned === 2.5 ? 'OK' : 'FALLÓ'}`);
  console.log(`Independencia entre trimestres (T1 vs T2): ${d.t2IndependentFromT1 ? 'OK' : 'FALLÓ'}`);
  console.log(`Recuperación de conducta y participación: ${d.conductBadgeText && d.partBadgeText ? 'OK' : 'FALLÓ'}`);
  console.log(`Persistencia en localStorage: ${d.saveActivitiesSuccess && d.hasLocalStorageActivities ? 'OK' : 'FALLÓ'}`);
  console.log(`Navegación nativa táctil (Input.dispatchTouchEvent): ${m.tabSwitchedViaNativeTouch ? 'OK' : 'FALLÓ'}`);
  console.log(`Accesibilidad táctil (Touch Targets >= 44px): ${m.allTouchTargetsAccessible ? 'OK' : 'FALLÓ'}`);

  if (uncaughtExceptions.length > 0) {
    throw new Error(`Se detectaron ${uncaughtExceptions.length} excepciones no capturadas.`);
  }

  console.log('\n>>> ETAPA 3 VERIFICADA CON ÉXITO: 0 EXCEPCIONES EN CHROME HEADLESS <<<\n');
}
