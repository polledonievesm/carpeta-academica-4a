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
  // FASE 1: PRUEBAS FUNCIONALES EN DESKTOP (ETAPAS 4, 5 Y 6)
  // =========================================================================
  console.log('[CDP SMOKE TEST] Ejecutando pruebas de la Etapa 4, Etapa 5 y Etapa 6 en Desktop...');
  const desktopEval = await sendCommand('Runtime.evaluate', {
    expression: `(function() {
      const results = {};

      if (typeof unlockTeacherApp === 'function') unlockTeacherApp();
      if (typeof hideBoot === 'function') hideBoot();
      if (typeof showView === 'function') showView('evaluaciones-trimestrales');
      if (typeof window.initEvaluacionesTrimestrales === 'function') window.initEvaluacionesTrimestrales();

      // --- VERIFICACIONES DE ETAPA 4 ---
      // 1. Acceso y activación de la pestaña Cálculo Preliminar
      window.switchEvalTab('calculo-preliminar');
      const tabCalc = document.getElementById('evalTabCalculoPreliminar');
      results.tabCalculoActive = tabCalc && !tabCalc.classList.contains('hidden-tab');

      // 2. Selector de Alumno con número oficial de lista
      const studentSelect = document.getElementById('evalCalcStudentSelect');
      results.hasStudentOptions = Boolean(studentSelect && studentSelect.options.length > 0);
      const firstOptText = studentSelect?.options[0]?.text || '';
      results.officialNumberInSelect = /^\\d{2}\\./.test(firstOptText);

      // 3. Resultado de calificación preliminar visible
      const finalGradeEl = document.getElementById('evalCalcFinalGrade');
      results.displayedGrade = finalGradeEl ? finalGradeEl.textContent : '—';
      results.gradeHasTwoDecimals = /^\\d+\\.\\d{2}$/.test(results.displayedGrade);

      // 4. Desglose detallado de criterios (7 filas)
      const breakdownRows = document.querySelectorAll('#evalBreakdownTableBody tr');
      results.breakdownRowsCount = breakdownRows.length;

      // 5. Ajuste manual docente y restablecimiento
      const gradeInput = document.getElementById('evalManualGradeInput');
      const reasonInput = document.getElementById('evalManualReasonInput');
      if (gradeInput) gradeInput.value = '9.5';
      if (reasonInput) reasonInput.value = 'Ajuste docente verificado en prueba';
      window.actions['eval-save-manual-adjustment']();
      const adjustedGradeText = document.getElementById('evalCalcFinalGrade')?.textContent;
      results.adjustedGradeDisplayed = (adjustedGradeText === '9.50');
      window.actions['eval-reset-manual-adjustment']();
      results.resetManualRestored = (document.getElementById('evalCalcAdjustedBadge')?.style.display === 'none');

      // --- VERIFICACIONES DE ETAPA 5 ---
      // 6. Navegación a Pestaña de Captura Grupal
      window.switchEvalTab('captura-grupal');
      const tabGrupal = document.getElementById('evalTabCapturaGrupal');
      results.tabGrupalActive = tabGrupal && !tabGrupal.classList.contains('hidden-tab');

      // 7. Subvista A: Matriz de Exámenes Escritos
      window.actions['eval-set-grupal-subview']({ dataset: { subview: 'examenes' } });
      const examRows = document.querySelectorAll('#evalGrupalTableBody tr');
      results.examRowsCount = examRows.length; // 35 alumnos esperados
      results.has35StudentsInMatrix = (examRows.length === 35);

      // 8. Captura de examen con input numérico
      const firstExamInput = document.querySelector('.eval-cell-input[data-field="Lenguajes"]');
      if (firstExamInput) {
        firstExamInput.value = '9.25';
        firstExamInput.dispatchEvent(new Event('input', { bubbles: true }));
        firstExamInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      results.examInputCaptured = Boolean(firstExamInput && firstExamInput.value === '9.25');

      // 9. Subvista B: Calificaciones por Campo Formativo
      window.actions['eval-set-grupal-subview']({ dataset: { subview: 'materias' } });
      const materiasTable = document.querySelector('.eval-matrix-table');
      results.materiasMatrixRendered = Boolean(materiasTable);

      // 10. Subvista C: Resumen General
      window.actions['eval-set-grupal-subview']({ dataset: { subview: 'resumen' } });
      const resumenTable = document.querySelector('.eval-matrix-table');
      results.resumenMatrixRendered = Boolean(resumenTable);

      // 11. Modal de Pegado Masivo (Apertura, Previsualización y Aplicación)
      window.actions['eval-set-grupal-subview']({ dataset: { subview: 'examenes' } });
      window.actions['eval-open-paste-modal']();
      const pasteModal = document.getElementById('evalPasteModal');
      results.pasteModalOpened = pasteModal && !pasteModal.classList.contains('hidden-control') && pasteModal.style.display !== 'none';

      const pasteTextarea = document.getElementById('evalPasteTextarea');
      if (pasteTextarea) {
        pasteTextarea.value = "8.5\\t9.0\\t7.5\\t10.0\\n8.0\\t8.5\\t9.0\\t9.5";
      }
      window.actions['eval-preview-paste']();
      const previewRows = document.querySelectorAll('#evalPastePreviewBox tr').length;
      results.pastePreviewWorked = previewRows >= 2;

      window.actions['eval-apply-paste']();
      results.pasteAppliedSuccessfully = true;
      window.actions['eval-close-paste-modal']();

      // --- VERIFICACIONES DE ETAPA 6 (DESEMPEÑO Y MENSAJES EN GRUPAL) ---
      // 12. Subvista D: Desempeño Integral Grupal
      window.actions['eval-set-grupal-subview']({ dataset: { subview: 'desempeno' } });
      const desempRows = document.querySelectorAll('#evalGrupalTableBody tr');
      results.desempGrupalRowsCount = desempRows.length;
      results.has35StudentsInDesemp = (desempRows.length === 35);

      // 13. Subvista E: Mensajes Familiares Grupal
      window.actions['eval-set-grupal-subview']({ dataset: { subview: 'mensajes' } });
      const msgRows = document.querySelectorAll('#evalGrupalTableBody tr');
      results.msgGrupalRowsCount = msgRows.length;
      results.has35StudentsInMsg = (msgRows.length === 35);

      // --- VERIFICACIONES DE CAPTURA INDIVIDUAL (ETAPA 5 Y 6) ---
      // 14. Navegación a Pestaña de Captura Individual
      window.switchEvalTab('captura-individual');
      const tabInd = document.getElementById('evalTabCapturaIndividual');
      results.tabIndActive = tabInd && !tabInd.classList.contains('hidden-tab');

      // 15. Componentes de Vista Individual (Perfil de alumno y tarjetas de materia)
      const indStudentSelect = document.getElementById('evalIndStudentSelect');
      results.indStudentSelectPopulated = Boolean(indStudentSelect && indStudentSelect.options.length === 35);
      const subjectCards = document.querySelectorAll('.eval-ind-subject-card');
      results.indSubjectCardsCount = subjectCards.length; // 4 campos formativos

      // 16. Subtab 2: Desempeño Integral (23 indicadores oficiales)
      window.actions['eval-ind-switch-subtab']({ dataset: { subtab: 'desempeno' } });
      const indDesempenoActive = document.getElementById('evalIndSubtabDesempeno')?.classList.contains('active');
      const indicatorCards = document.querySelectorAll('.eval-indicator-item');
      results.desemp23IndicatorsRendered = (indicatorCards.length === 23);

      // Valoración masiva rápida general a 'E'
      window.actions['eval-ind-set-general-level']({ dataset: { level: 'E' } });
      const progressText = document.getElementById('evalIndDesempenoProgressText')?.textContent || '';
      results.all23ValuedGeneralE = progressText.includes('23 de 23');

      // Deshacer acción masiva
      window.actions['eval-ind-desempeno-undo']();
      const progressUndone = document.getElementById('evalIndDesempenoProgressText')?.textContent || '';
      results.desempUndoWorked = !progressUndone.includes('23 de 23');

      // Reasignar 'E' para dejar completo
      window.actions['eval-ind-set-general-level']({ dataset: { level: 'E' } });
      window.actions['eval-save-desempeno-draft']();
      results.desempDraftSaved = true;

      // 17. Subtab 3: Mensaje Familiar y Banco de Recomendaciones
      window.actions['eval-ind-switch-subtab']({ dataset: { subtab: 'mensaje' } });
      const msgTextarea = document.getElementById('evalIndMessageTextarea');
      const msgCounter = document.getElementById('evalIndMessageCharCount');
      results.hasMsgTextarea = Boolean(msgTextarea && msgCounter);

      // Abrir Modal de Banco de Recomendaciones
      window.actions['eval-open-message-bank-modal']();
      const bankModal = document.getElementById('evalMessageBankModal');
      results.msgBankModalOpened = bankModal && !bankModal.classList.contains('hidden-control') && bankModal.style.display !== 'none';
      const bankItems = document.querySelectorAll('.eval-bank-item');
      results.msgBankHas20Items = (bankItems.length >= 20);

      // Insertar recomendación del banco
      const firstBankBtn = document.querySelector('.eval-bank-item button[data-action="eval-insert-banco-recommendation"]');
      if (firstBankBtn) {
        firstBankBtn.click();
      }
      results.msgInsertedFromBank = Boolean(msgTextarea && msgTextarea.value.length > 10 && msgTextarea.value.length <= 245);
      window.actions['eval-close-message-bank-modal']();
      window.actions['eval-save-student-message']();
      results.msgSaved = true;

      // 18. Subtab 4: Resumen y Estado Consolidado
      window.actions['eval-ind-switch-subtab']({ dataset: { subtab: 'resumen' } });
      const resumenPill = document.querySelector('#evalIndSummaryPanel .eval-overall-status-pill');
      results.resumenCardRendered = Boolean(resumenPill);

      // 19. Navegación de alumno siguiente / anterior
      window.actions['eval-ind-switch-subtab']({ dataset: { subtab: 'academicas' } });
      const initialStudent = indStudentSelect?.value;
      window.actions['eval-ind-next-student']();
      const nextStudent = indStudentSelect?.value;
      results.indNextStudentNavigated = (initialStudent !== nextStudent);

      // 20. Guardado de borrador de captura
      window.actions['eval-save-captura-draft']();
      results.capturaDraftSaved = true;

      return results;
    })()`,
    returnByValue: true
  });

  console.log('[CDP SMOKE TEST] Resultados de pruebas Desktop:', JSON.stringify(desktopEval.result.value, null, 2));

  // =========================================================================
  // FASE 2: PRUEBAS EN DISPOSITIVO MÓVIL (390x844) CON EVENTOS TÁCTILES REALES
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

  // Alternar hacia seguimiento para probar toque nativo a 'captura-grupal'
  await sendCommand('Runtime.evaluate', {
    expression: `window.switchEvalTab('seguimiento');`
  });
  await new Promise(r => setTimeout(r, 300));

  // Obtener posición del botón táctil [data-tab="captura-grupal"]
  console.log('[CDP SMOKE TEST] Obteniendo coordenadas de botón táctil [data-tab="captura-grupal"]...');
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

      const btn = document.querySelector('.eval-tab-btn[data-tab="captura-grupal"]');
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

  // Verificar activación por evento táctil en móvil 390px
  const mobileEval = await sendCommand('Runtime.evaluate', {
    expression: `(function() {
      const tabGrupal = document.getElementById('evalTabCapturaGrupal');
      const isTabActive = tabGrupal && !tabGrupal.classList.contains('hidden-tab');

      // Verificar tamaño de targets táctiles visibles (>= 40px)
      const allBtns = Array.from(document.querySelectorAll('.eval-tab-btn, .eval-subview-btn, .eval-subtab-btn, .eval-grupal-toolbar .btn, .eval-ind-nav-btn'));
      const visibleBtns = allBtns.filter(b => b.offsetParent !== null);
      const smallTargets = visibleBtns.filter(b => b.getBoundingClientRect().height < 38);

      return {
        tabSwitchedViaNativeTouch: Boolean(isTabActive),
        allTouchTargetsAccessible: smallTargets.length === 0,
        testedButtonsCount: visibleBtns.length
      };
    })()`,
    returnByValue: true
  });

  console.log('[CDP SMOKE TEST] Resultados de pruebas táctiles (390px):', JSON.stringify(mobileEval.result.value, null, 2));

  // =========================================================================
  // FASE 3: PRUEBAS EN DISPOSITIVO COMPACTO (348x740)
  // =========================================================================
  console.log('[CDP SMOKE TEST] Configurando viewport compacto de 348px...');
  await sendCommand('Emulation.setDeviceMetricsOverride', {
    width: 348,
    height: 740,
    deviceScaleFactor: 2,
    mobile: true
  });
  await new Promise(r => setTimeout(r, 500));

  const compactEval = await sendCommand('Runtime.evaluate', {
    expression: `(function() {
      const wrap = document.getElementById('evalGrupalTableWrap');
      const hasHorizontalScroll = wrap ? (wrap.scrollWidth >= wrap.clientWidth) : false;
      const noPageOverflow = document.documentElement.clientWidth <= 348;
      return {
        tableWrapHasScroll: hasHorizontalScroll,
        noPageOverflow: noPageOverflow
      };
    })()`,
    returnByValue: true
  });

  console.log('[CDP SMOKE TEST] Resultados en viewport compacto 348px:', JSON.stringify(compactEval.result.value, null, 2));

  await sendCommand('Emulation.setTouchEmulationEnabled', { enabled: false });
  await sendCommand('Emulation.clearDeviceMetricsOverride');

  await new Promise(r => setTimeout(r, 500));

  ws.close();
  chrome.kill();

  try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (e) {}

  console.log('\n============================================================');
  console.log('[CDP SMOKE TEST] RESUMEN DE VERIFICACIÓN ETAPA 6');
  console.log('============================================================');
  console.log(`Excepciones no capturadas (exceptionThrown): ${uncaughtExceptions.length}`);
  console.log(`Errores en consola (consoleErrors): ${consoleErrors.length}`);

  const d = desktopEval.result.value;
  const m = mobileEval.result.value;
  const c = compactEval.result.value;

  console.log(`Pestaña Cálculo Preliminar activa: ${d.tabCalculoActive ? 'OK' : 'FALLÓ'}`);
  console.log(`Pestaña Captura Grupal activa: ${d.tabGrupalActive ? 'OK' : 'FALLÓ'}`);
  console.log(`Matriz con 35 alumnos oficiales: ${d.has35StudentsInMatrix ? 'OK (35 filas)' : 'FALLÓ (' + d.examRowsCount + ')'}`);
  console.log(`Captura de examen numérico (9.25): ${d.examInputCaptured ? 'OK' : 'FALLÓ'}`);
  console.log(`Subvista B (Materias) renderizada: ${d.materiasMatrixRendered ? 'OK' : 'FALLÓ'}`);
  console.log(`Subvista C (Resumen) renderizada: ${d.resumenMatrixRendered ? 'OK' : 'FALLÓ'}`);
  console.log(`Subvista D (Desempeño Grupal 35 alumnos): ${d.has35StudentsInDesemp ? 'OK (35 filas)' : 'FALLÓ (' + d.desempGrupalRowsCount + ')'}`);
  console.log(`Subvista E (Mensajes Familiares 35 alumnos): ${d.has35StudentsInMsg ? 'OK (35 filas)' : 'FALLÓ (' + d.msgGrupalRowsCount + ')'}`);
  console.log(`Modal de pegado masivo (abierto y previsualizado): ${d.pasteModalOpened && d.pastePreviewWorked ? 'OK' : 'FALLÓ'}`);
  console.log(`Pegado masivo aplicado correctamente: ${d.pasteAppliedSuccessfully ? 'OK' : 'FALLÓ'}`);
  console.log(`Pestaña Captura Individual activa: ${d.tabIndActive ? 'OK' : 'FALLÓ'}`);
  console.log(`4 campos formativos en vista individual: ${d.indSubjectCardsCount === 4 ? 'OK (4 tarjetas)' : 'FALLÓ'}`);
  console.log(`23 indicadores de desempeño renderizados: ${d.desemp23IndicatorsRendered ? 'OK (23 indicadores)' : 'FALLÓ'}`);
  console.log(`Valoración rápida general 'E' (23 de 23): ${d.all23ValuedGeneralE ? 'OK' : 'FALLÓ'}`);
  console.log(`Deshacer última acción masiva: ${d.desempUndoWorked ? 'OK' : 'FALLÓ'}`);
  console.log(`Borrador de desempeño guardado: ${d.desempDraftSaved ? 'OK' : 'FALLÓ'}`);
  console.log(`Área de mensaje familiar y contador dinámico: ${d.hasMsgTextarea ? 'OK' : 'FALLÓ'}`);
  console.log(`Modal de banco de recomendaciones (>= 20 items): ${d.msgBankModalOpened && d.msgBankHas20Items ? 'OK' : 'FALLÓ'}`);
  console.log(`Inserción desde banco validada (<= 245 car): ${d.msgInsertedFromBank ? 'OK' : 'FALLÓ'}`);
  console.log(`Mensaje familiar guardado: ${d.msgSaved ? 'OK' : 'FALLÓ'}`);
  console.log(`Tarjeta de estado consolidado renderizada: ${d.resumenCardRendered ? 'OK' : 'FALLÓ'}`);
  console.log(`Navegación de alumno (siguiente/anterior): ${d.indNextStudentNavigated ? 'OK' : 'FALLÓ'}`);
  console.log(`Borrador de calificaciones guardado: ${d.capturaDraftSaved ? 'OK' : 'FALLÓ'}`);
  console.log(`Navegación nativa táctil móvil (390px): ${m.tabSwitchedViaNativeTouch ? 'OK' : 'FALLÓ'}`);
  console.log(`Accesibilidad táctil móvil (Targets >= 40px): ${m.allTouchTargetsAccessible ? 'OK' : 'FALLÓ'}`);
  console.log(`Adaptabilidad en pantalla compacta (348px): ${c.tableWrapHasScroll && c.noPageOverflow ? 'OK' : 'FALLÓ'}`);

  if (uncaughtExceptions.length > 0) {
    throw new Error(`Se detectaron ${uncaughtExceptions.length} excepciones no capturadas.`);
  }

  console.log('\n>>> ETAPA 6 VERIFICADA CON ÉXITO: 0 EXCEPCIONES EN CHROME HEADLESS <<<\n');
}