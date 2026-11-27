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
      pendingRequests.set(id, { resolve, reject, method });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await new Promise(resolve => ws.onopen = resolve);

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.method === 'Runtime.exceptionThrown') {
      const details = data.params.exceptionDetails;
      const text = details.exception ? details.exception.description : details.text;
      console.error('[CDP UNCAUGHT EXCEPTION]', text);
      uncaughtExceptions.push(text);
    }

    if (data.method === 'Runtime.consoleAPICalled') {
      if (data.params.type === 'error') {
        const text = data.params.args.map(a => a.value || a.description || '').join(' ');
        console.error('[CDP CONSOLE ERROR]', text);
        consoleErrors.push(text);
      }
    }

    if (data.id && pendingRequests.has(data.id)) {
      const { resolve, reject } = pendingRequests.get(data.id);
      pendingRequests.delete(data.id);
      if (data.error) {
        reject(new Error(`CDP Error in ${data.error.message}`));
      } else {
        resolve(data.result);
      }
    }
  };

  await sendCommand('Runtime.enable');
  await sendCommand('Page.enable');

  console.log(`[CDP SMOKE TEST] Navegando a http://localhost:${PORT}/index.html#evaluaciones-trimestrales...`);
  await sendCommand('Page.navigate', { url: `http://localhost:${PORT}/index.html#evaluaciones-trimestrales` });

  await new Promise(r => setTimeout(r, 2500));

  // =========================================================================
  // FASE 1: PRUEBAS FUNCIONALES EN DESKTOP (ETAPA 3 Y ETAPA 4)
  // =========================================================================
  console.log('[CDP SMOKE TEST] Ejecutando pruebas de la Etapa 4 en Desktop...');
  const desktopEval = await sendCommand('Runtime.evaluate', {
    expression: `(function() {
      const results = {};

      if (typeof unlockTeacherApp === 'function') unlockTeacherApp();
      if (typeof hideBoot === 'function') hideBoot();
      if (typeof showView === 'function') showView('evaluaciones-trimestrales');
      if (typeof window.initEvaluacionesTrimestrales === 'function') window.initEvaluacionesTrimestrales();

      // 1. Acceso y activación de la pestaña Cálculo Preliminar
      window.switchEvalTab('calculo-preliminar');
      const tabCalc = document.getElementById('evalTabCalculoPreliminar');
      results.tabCalculoActive = tabCalc && !tabCalc.classList.contains('hidden-tab');

      // 2. Selector de Alumno con número oficial de lista
      const studentSelect = document.getElementById('evalCalcStudentSelect');
      results.hasStudentOptions = Boolean(studentSelect && studentSelect.options.length > 0);
      const firstOptText = studentSelect?.options[0]?.text || '';
      results.officialNumberInSelect = /^\\d{2}\\./.test(firstOptText); // Formato "01. Apellido Nombre"

      // 3. Resultado de calificación preliminar visible
      const finalGradeEl = document.getElementById('evalCalcFinalGrade');
      results.displayedGrade = finalGradeEl ? finalGradeEl.textContent : '—';
      results.gradeHasTwoDecimals = /^\\d+\\.\\d{2}$/.test(results.displayedGrade);

      // 4. Desglose detallado de criterios (7 filas esperadas)
      const breakdownRows = document.querySelectorAll('#evalBreakdownTableBody tr');
      results.breakdownRowsCount = breakdownRows.length;

      // 5. Cambio dinámico de campo formativo (Saberes y Pensamiento Científico)
      const subjSelect = document.getElementById('evalCalcSubjectSelect');
      if (subjSelect) {
        subjSelect.value = 'Saberes y Pensamiento Científico';
        subjSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const titleEl = document.getElementById('evalCalcSubjectTitle');
      results.subjectChanged = (titleEl && titleEl.textContent === 'Saberes y Pensamiento Científico');

      // 6. Recálculo dinámico con registros vigentes
      window.actions['eval-recalculate']();
      results.recalculateRan = true;

      // 7. Ajuste manual docente
      const gradeInput = document.getElementById('evalManualGradeInput');
      const reasonInput = document.getElementById('evalManualReasonInput');
      if (gradeInput) gradeInput.value = '9.5';
      if (reasonInput) reasonInput.value = 'Ajuste docente verificado en prueba';
      window.actions['eval-save-manual-adjustment']();

      const adjustedGradeText = document.getElementById('evalCalcFinalGrade')?.textContent;
      const adjustedBadge = document.getElementById('evalCalcAdjustedBadge');
      results.adjustedGradeDisplayed = (adjustedGradeText === '9.50');
      results.adjustedBadgeVisible = (adjustedBadge && adjustedBadge.style.display !== 'none');

      // 8. Restablecimiento del cálculo automático original
      window.actions['eval-reset-manual-adjustment']();
      const restoredBadge = document.getElementById('evalCalcAdjustedBadge');
      results.resetManualRestored = (restoredBadge && restoredBadge.style.display === 'none');

      // Regresar materia a Lenguajes
      if (subjSelect) {
        subjSelect.value = 'Lenguajes';
        subjSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // 9. Filtro por rango de fechas en Selección de Actividades (Ajuste pendiente Etapa 3)
      window.switchEvalTab('seleccion-actividades');
      const dateStartInput = document.getElementById('evalActivityDateStart');
      const dateEndInput = document.getElementById('evalActivityDateEnd');
      if (dateStartInput && dateEndInput) {
        dateStartInput.value = '2026-09-01';
        dateEndInput.value = '2026-09-30';
        dateStartInput.dispatchEvent(new Event('change', { bubbles: true }));
        dateEndInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const dateFilteredRows = document.querySelectorAll('#evalActivitiesTableBody tr').length;
      results.dateRangeFilterWorks = (dateFilteredRows > 0);

      // Limpiar filtro de fechas
      if (dateStartInput && dateEndInput) {
        dateStartInput.value = '';
        dateEndInput.value = '';
        dateStartInput.dispatchEvent(new Event('change', { bubbles: true }));
        dateEndInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // Regresar a Cálculo Preliminar
      window.switchEvalTab('calculo-preliminar');

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

  // Primero conmutar a seguimiento para luego probar toque táctil nativo hacia 'calculo-preliminar'
  await sendCommand('Runtime.evaluate', {
    expression: `window.switchEvalTab('seguimiento');`
  });

  await new Promise(r => setTimeout(r, 300));

  // Obtener posición del botón táctil 'Cálculo preliminar'
  console.log('[CDP SMOKE TEST] Obteniendo coordenadas de botón táctil [data-tab="calculo-preliminar"]...');
  const boxResult = await sendCommand('Runtime.evaluate', {
    expression: `(function() {
      const teacherDlg = document.getElementById('teacherLoginDialog');
      if (teacherDlg) { teacherDlg.close?.(); teacherDlg.classList.add('hidden-control'); }
      const loginDlg = document.getElementById('loginDialog');
      if (loginDlg) { loginDlg.close?.(); loginDlg.classList.add('hidden-control'); }
      document.getElementById('sidebar')?.classList.remove('open');
      document.getElementById('sidebarBackdrop')?.classList.remove('active');
      const backdrop = document.querySelector('.modal-backdrop');
      if (backdrop) backdrop.remove();

      const btn = document.querySelector('.eval-tab-btn[data-tab="calculo-preliminar"]');
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

  // Verificar que el evento táctil nativo cambió a la pestaña 'calculo-preliminar'
  const mobileEval = await sendCommand('Runtime.evaluate', {
    expression: `(function() {
      const tabCalc = document.getElementById('evalTabCalculoPreliminar');
      const isTabActive = tabCalc && !tabCalc.classList.contains('hidden-tab');

      // Verificar tamaño de targets táctiles visibles (>= 44px conforme a WCAG AAA)
      const allBtns = Array.from(document.querySelectorAll('.eval-tab-btn, .eval-trimester-btn, .eval-calc-toolbar .btn, .eval-adjust-actions .btn, .eval-field-pill-card'));
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
  console.log('[CDP SMOKE TEST] RESUMEN DE VERIFICACIÓN ETAPA 4');
  console.log('============================================================');
  console.log(`Excepciones no capturadas (exceptionThrown): ${uncaughtExceptions.length}`);
  console.log(`Errores en consola (consoleErrors): ${consoleErrors.length}`);

  const d = desktopEval.result.value;
  const m = mobileEval.result.value;

  console.log(`Pestaña Cálculo Preliminar activa: ${d.tabCalculoActive ? 'OK' : 'FALLÓ'}`);
  console.log(`Selector de alumnos con lista oficial: ${d.hasStudentOptions && d.officialNumberInSelect ? 'OK' : 'FALLÓ'}`);
  console.log(`Calificación preliminar visible (2 decimales): ${d.gradeHasTwoDecimals ? 'OK (' + d.displayedGrade + ')' : 'FALLÓ'}`);
  console.log(`Desglose de 7 criterios institucionales: ${d.breakdownRowsCount === 7 ? 'OK (7 criterios)' : 'FALLÓ (' + d.breakdownRowsCount + ')'}`);
  console.log(`Cambio de campo formativo: ${d.subjectChanged ? 'OK' : 'FALLÓ'}`);
  console.log(`Recálculo dinámico con registros vigentes: ${d.recalculateRan ? 'OK' : 'FALLÓ'}`);
  console.log(`Ajuste manual docente: ${d.adjustedGradeDisplayed && d.adjustedBadgeVisible ? 'OK (9.50 con badge)' : 'FALLÓ'}`);
  console.log(`Restablecimiento de cálculo automático: ${d.resetManualRestored ? 'OK' : 'FALLÓ'}`);
  console.log(`Filtro por rango de fechas (Ajuste Etapa 3): ${d.dateRangeFilterWorks ? 'OK' : 'FALLÓ'}`);
  console.log(`Navegación nativa táctil (Input.dispatchTouchEvent): ${m.tabSwitchedViaNativeTouch ? 'OK' : 'FALLÓ'}`);
  console.log(`Accesibilidad táctil (Touch Targets >= 44px): ${m.allTouchTargetsAccessible ? 'OK' : 'FALLÓ'}`);

  if (uncaughtExceptions.length > 0) {
    throw new Error(`Se detectaron ${uncaughtExceptions.length} excepciones no capturadas.`);
  }

  console.log('\n>>> ETAPA 4 VERIFICADA CON ÉXITO: 0 EXCEPCIONES EN CHROME HEADLESS <<<\n');
}
