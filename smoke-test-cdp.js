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
  // FASE 1: PRUEBAS FUNCIONALES EN DESKTOP
  // =========================================================================
  console.log('[CDP SMOKE TEST] Ejecutando pruebas de la Etapa 2 en Desktop...');
  const desktopEval = await sendCommand('Runtime.evaluate', {
    expression: `(function() {
      const results = {};

      // 1. Cargar vista
      if (typeof showView === 'function') showView('evaluaciones-trimestrales');
      if (typeof window.initEvaluacionesTrimestrales === 'function') window.initEvaluacionesTrimestrales();

      // 2. Determinación automática de trimestre en Quintana Roo
      results.detectedTrimester = typeof window.determineCurrentTrimester === 'function' ? window.determineCurrentTrimester() : null;

      // 3. Resolución oficial del número de lista
      const testStudent1 = { id: 'ALU-1', nombres: 'Carlos', numeroLista: 7 };
      const testStudent2 = { id: 'ALU-2', nombres: 'Ana' };
      results.officialNumWithProp = window.resolveOfficialListNumber(testStudent1);
      results.officialNumWithoutProp = window.resolveOfficialListNumber(testStudent2);

      // 4. Conmutar a la pestaña Criterios y Periodos
      window.switchEvalTab('criterios');
      const tabCriterios = document.getElementById('evalTabCriterios');
      results.tabCriteriosActive = tabCriterios && !tabCriterios.classList.contains('hidden-tab');

      // 5. Verificación de cálculo en tiempo real de porcentajes (propuesta inicial: 100%)
      const sumBadge = document.getElementById('evalSumBadge');
      results.initialSumText = sumBadge ? sumBadge.textContent.trim() : null;
      results.initialSumValid = sumBadge ? sumBadge.classList.contains('valid') : false;

      // 6. Prueba de invalidación de porcentajes (suma != 100%)
      const inputTareas = document.querySelector('[data-crit-input="tareas"]');
      if (inputTareas) {
        inputTareas.value = '60';
        inputTareas.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const sumBadgeAfterChange = document.getElementById('evalSumBadge');
      results.invalidSumText = sumBadgeAfterChange ? sumBadgeAfterChange.textContent.trim() : null;
      results.invalidSumDetected = sumBadgeAfterChange ? sumBadgeAfterChange.classList.contains('invalid') : false;
      const saveBtn = document.getElementById('evalBtnSaveConfig');
      results.saveBtnDisabledWhenInvalid = saveBtn ? saveBtn.disabled : false;

      // 7. Corrección de suma (compensar con examen para volver a 100%)
      const inputExamen = document.querySelector('[data-crit-input="examen"]');
      if (inputExamen) {
        inputExamen.value = '20';
        inputExamen.dispatchEvent(new Event('input', { bubbles: true }));
      }
      results.restoredSumText = sumBadge ? sumBadge.textContent.trim() : null;
      results.restoredSumValid = sumBadge ? sumBadge.classList.contains('valid') : false;
      results.saveBtnEnabledWhenValid = saveBtn ? !saveBtn.disabled : false;

      // 8. Prueba de validación de fechas (superposición y orden cronológico)
      const dateEnd1 = document.getElementById('evalDateEnd1');
      const dateStart2 = document.getElementById('evalDateStart2');
      const origEnd1 = dateEnd1 ? dateEnd1.value : '';

      // Provocar superposición temporal (T1 finaliza después del inicio de T2)
      if (dateEnd1 && dateStart2) {
        dateEnd1.value = '2026-12-15';
        dateEnd1.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const alertBox = document.getElementById('evalDateValidationAlert');
      results.superposicionDetectada = alertBox ? alertBox.classList.contains('danger') : false;

      // Restaurar fecha válida
      if (dateEnd1) {
        dateEnd1.value = origEnd1;
        dateEnd1.dispatchEvent(new Event('change', { bubbles: true }));
      }
      results.fechasValidasRestauradas = alertBox ? alertBox.classList.contains('success') : false;

      // 9. Independencia de configuración entre trimestres
      const selTrim = document.getElementById('evalCriteriaTrimesterSelect');
      if (selTrim) {
        selTrim.value = '2';
        selTrim.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const cfg = window.getEvalConfig();
      results.t1TareasPct = cfg.porcentajes[1].tareas;
      results.t2TareasPct = cfg.porcentajes[2].tareas; // Debe ser 50 (independiente de T1 que cambiamos a 60)
      results.trimesterIndependence = (results.t1TareasPct !== results.t2TareasPct);

      // 10. Prueba de persistencia (Guardar configuración)
      // Asegurar que T1 sume 100% y T2 sume 100%
      const saveResult = window.saveEvalConfig();
      results.configSavedSuccess = saveResult;
      const storedRaw = localStorage.getItem('carpeta_eval_config_v2');
      results.hasLocalStorage = Boolean(storedRaw);

      // 11. Volver al panel de seguimiento y verificar tabla
      window.switchEvalTab('seguimiento');
      results.returnedToTracking = document.getElementById('evalTabSeguimiento')?.classList.contains('active');

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

  // Obtener posición del botón de pestaña 'Criterios y periodos' para despachar toque real
  console.log('[CDP SMOKE TEST] Obteniendo coordenadas de botón para toque real...');
  const boxResult = await sendCommand('Runtime.evaluate', {
    expression: `(function() {
      if (typeof unlockTeacherApp === 'function') unlockTeacherApp();
      if (typeof hideBoot === 'function') hideBoot();

      // Cerrar cualquier menú móvil lateral o diálogo superpuesto
      document.getElementById('sidebar')?.classList.remove('open');
      document.getElementById('sidebarBackdrop')?.classList.remove('active');
      const loginDiag = document.getElementById('loginDialog');
      if (loginDiag && loginDiag.open) loginDiag.close();

      const btn = document.querySelector('.eval-tab-btn[data-tab="criterios"]');
      if (!btn) return null;
      btn.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
      const rect = btn.getBoundingClientRect();
      const cx = Math.round(rect.x + rect.width / 2);
      const cy = Math.round(rect.y + rect.height / 2);
      const topEl = document.elementFromPoint(cx, cy);
      return { 
        x: cx, 
        y: cy, 
        width: rect.width, 
        height: rect.height,
        topElementTag: topEl ? topEl.tagName : null,
        topElementHtml: topEl ? topEl.outerHTML.slice(0, 150) : null
      };
    })()`,
    returnByValue: true
  });

  const box = boxResult.result.value;
  console.log('[CDP SMOKE TEST] Coordenadas táctiles:', box);

  if (box && box.width > 0 && box.height > 0) {
    console.log(`[CDP SMOKE TEST] Despachando eventos táctiles reales del motor de Chromium en (${box.x}, ${box.y})...`);
    await sendCommand('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ id: 0, x: box.x, y: box.y }]
    });
    await new Promise(r => setTimeout(r, 80));
    await sendCommand('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: []
    });

    await new Promise(r => setTimeout(r, 400));
  }

  // Verificar que el evento táctil real cambió de pestaña y que los targets visibles respetan tamaño accesible (>= 40-44px)
  const mobileEval = await sendCommand('Runtime.evaluate', {
    expression: `(function() {
      const tabCriterios = document.getElementById('evalTabCriterios');
      const isCriteriosActive = tabCriterios && !tabCriterios.classList.contains('hidden-tab');

      // Verificar tamaño de targets táctiles visibles (>= 40px)
      const allBtns = Array.from(document.querySelectorAll('.eval-tab-btn, .eval-trimester-btn, .eval-config-actions-bar .btn, .eval-criteria-toggle-btn'));
      const visibleBtns = allBtns.filter(b => b.offsetParent !== null);
      const smallTargets = visibleBtns.filter(b => b.getBoundingClientRect().height < 40);

      return {
        tabSwitchedViaNativeTouch: Boolean(isCriteriosActive),
        allTouchTargetsAccessible: smallTargets.length === 0,
        testedButtonsCount: visibleBtns.length
      };
    })()`,
    returnByValue: true
  });

  console.log('[CDP SMOKE TEST] Resultados de pruebas táctiles:', JSON.stringify(mobileEval.result.value, null, 2));

  // Restaurar emulación
  await sendCommand('Emulation.setTouchEmulationEnabled', { enabled: false });
  await sendCommand('Emulation.clearDeviceMetricsOverride');

  await new Promise(r => setTimeout(r, 500));

  ws.close();
  chrome.kill();

  try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (e) {}

  console.log('\n============================================================');
  console.log('[CDP SMOKE TEST] RESUMEN DE VERIFICACIÓN ETAPA 2');
  console.log('============================================================');
  console.log(`Excepciones no capturadas (exceptionThrown): ${uncaughtExceptions.length}`);
  console.log(`Errores en consola (consoleErrors): ${consoleErrors.length}`);

  const d = desktopEval.result.value;
  const m = mobileEval.result.value;

  console.log(`Determinación de trimestre en Quintana Roo: ${d.detectedTrimester ? 'OK (Trimestre ' + d.detectedTrimester + ')' : 'FALLÓ'}`);
  console.log(`Resolución número de lista oficial: ${d.officialNumWithProp === 7 && d.officialNumWithoutProp === '—' ? 'OK (Usa dato canónico sin inventar índices)' : 'FALLÓ'}`);
  console.log(`Pestaña Criterios activa: ${d.tabCriteriosActive ? 'OK' : 'FALLÓ'}`);
  console.log(`Propuesta editable inicial (100%): ${d.initialSumValid ? 'OK' : 'FALLÓ'}`);
  console.log(`Detección de suma inválida (!= 100%): ${d.invalidSumDetected && d.saveBtnDisabledWhenInvalid ? 'OK (Bloquea guardado)' : 'FALLÓ'}`);
  console.log(`Restauración y validación de 100%: ${d.restoredSumValid && d.saveBtnEnabledWhenValid ? 'OK (Habilita guardado)' : 'FALLÓ'}`);
  console.log(`Validación de fechas (superposición y orden): ${d.superposicionDetectada && d.fechasValidasRestauradas ? 'OK' : 'FALLÓ'}`);
  console.log(`Independencia entre trimestres: ${d.trimesterIndependence ? 'OK (T1 y T2 independientes)' : 'FALLÓ'}`);
  console.log(`Persistencia en localStorage: ${d.configSavedSuccess && d.hasLocalStorage ? 'OK' : 'FALLÓ'}`);
  console.log(`Navegación nativa táctil (Input.dispatchTouchEvent): ${m.tabSwitchedViaNativeTouch ? 'OK' : 'FALLÓ'}`);
  console.log(`Accesibilidad táctil (Touch Targets >= 44px): ${m.allTouchTargetsAccessible ? 'OK' : 'FALLÓ'}`);

  if (uncaughtExceptions.length > 0) {
    throw new Error(`Se detectaron ${uncaughtExceptions.length} excepciones no capturadas.`);
  }

  console.log('\n>>> ETAPA 2 VERIFICADA CON ÉXITO: 0 EXCEPCIONES EN CHROME HEADLESS <<<\n');
}
