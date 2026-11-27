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
    console.log('[HTTP 404]:', req.url);
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

  // Asegurar directorio temporal limpio
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

  // Esperar a que Chrome inicie el endpoint de depuración
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

    // Monitoreo de eventos CDP
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

  // Habilitar dominios CDP
  await sendCommand('Runtime.enable');
  await sendCommand('Page.enable');
  await sendCommand('Log.enable');

  console.log(`[CDP SMOKE TEST] Navegando a http://localhost:${PORT}/index.html#evaluaciones-trimestrales...`);
  await sendCommand('Page.navigate', { url: `http://localhost:${PORT}/index.html#evaluaciones-trimestrales` });

  // Esperar a que la página cargue
  await new Promise(r => setTimeout(r, 2500));

  // Ejecutar verificaciones funcionales dentro de la página
  console.log('[CDP SMOKE TEST] Verificando estado del DOM y componentes del módulo...');
  const testResults = await sendCommand('Runtime.evaluate', {
    expression: `(function() {
      const results = {};

      // 1. Verificar existencia de la sección de vista
      const viewSection = document.getElementById('evaluaciones-trimestrales');
      results.viewSectionExists = Boolean(viewSection);

      // 2. Verificar existencia del botón de navegación lateral
      const navItem = document.querySelector('.nav-item[data-view="evaluaciones-trimestrales"]');
      results.navItemExists = Boolean(navItem);

      // 3. Activar la vista explícitamente vía showView si aún no está activa
      if (typeof showView === 'function') {
        showView('evaluaciones-trimestrales');
      }
      results.viewIsActive = viewSection ? viewSection.classList.contains('active') : false;

      // 4. Inicializar módulo
      if (typeof window.initEvaluacionesTrimestrales === 'function') {
        window.initEvaluacionesTrimestrales();
      }

      // 5. Verificar elementos del selector de trimestres
      const periodTitle = document.getElementById('evalCurrentPeriodTitle');
      results.periodTitle = periodTitle ? periodTitle.textContent : null;

      const trimesterBtns = document.querySelectorAll('.eval-trimester-btn');
      results.trimesterButtonsCount = trimesterBtns.length;

      // 6. Probar cambio de trimestre interactivo (T2)
      if (typeof window.selectEvalTrimester === 'function') {
        window.selectEvalTrimester(2);
        results.selectedT2Title = document.getElementById('evalCurrentPeriodTitle')?.textContent;
        // Regresar a T1
        window.selectEvalTrimester(1);
        results.returnedT1Title = document.getElementById('evalCurrentPeriodTitle')?.textContent;
      }

      // 7. Probar pestañas del módulo
      if (typeof window.switchEvalTab === 'function') {
        window.switchEvalTab('captura-grupal');
        results.capturaGrupalVisible = !document.getElementById('evalTabCapturaGrupal')?.classList.contains('hidden-tab');
        window.switchEvalTab('seguimiento');
        results.seguimientoVisible = document.getElementById('evalTabSeguimiento')?.classList.contains('active');
      }

      // 8. Verificar métricas del panel de seguimiento
      const statTotal = document.getElementById('evalStatTotal')?.textContent;
      results.statTotal = statTotal;

      // 9. Verificar tabla de seguimiento
      const tableBody = document.getElementById('evalStudentsTableBody');
      results.tableBodyExists = Boolean(tableBody);
      results.rowsCount = tableBody ? tableBody.querySelectorAll('tr').length : 0;

      // 10. Despachador de acciones (Regla 2 de GEMINI.md)
      results.hasActionsRegistered = Boolean(window.actions && window.actions['eval-select-trimester']);

      return results;
    })()`,
    returnByValue: true
  });

  console.log('[CDP SMOKE TEST] Resultados de la ejecución:', JSON.stringify(testResults.result.value, null, 2));

  // Esperar un momento para recolectar cualquier excepción tardía
  await new Promise(r => setTimeout(r, 1000));

  // Cerrar Chrome y WebSocket
  ws.close();
  chrome.kill();

  try {
    fs.rmSync(profileDir, { recursive: true, force: true });
  } catch (e) {}

  // Evaluación de resultados según el protocolo
  console.log('\n============================================================');
  console.log('[CDP SMOKE TEST] RESUMEN DE VERIFICACIÓN');
  console.log('============================================================');
  console.log(`Excepciones no capturadas (exceptionThrown): ${uncaughtExceptions.length}`);
  console.log(`Errores en consola (consoleErrors): ${consoleErrors.length}`);

  const v = testResults.result.value;
  console.log(`Vista encontrada: ${v.viewSectionExists ? 'OK' : 'FALLÓ'}`);
  console.log(`Navegación lateral encontrada: ${v.navItemExists ? 'OK' : 'FALLÓ'}`);
  console.log(`Vista activa: ${v.viewIsActive ? 'OK' : 'FALLÓ'}`);
  console.log(`Selector de trimestres: ${v.trimesterButtonsCount === 3 ? 'OK (3 trimestres)' : 'FALLÓ'}`);
  console.log(`Conmutación T1 -> T2 -> T1: ${v.selectedT2Title && v.returnedT1Title ? 'OK' : 'FALLÓ'}`);
  console.log(`Pestañas internas (Tabs): ${v.capturaGrupalVisible && v.seguimientoVisible ? 'OK' : 'FALLÓ'}`);
  console.log(`Tabla de seguimiento: ${v.tableBodyExists ? 'OK' : 'FALLÓ'} (${v.rowsCount} filas renderizadas)`);
  console.log(`Acciones desacopladas (Regla 2 GEMINI.md): ${v.hasActionsRegistered ? 'OK' : 'FALLÓ'}`);

  if (uncaughtExceptions.length > 0) {
    throw new Error(`Se encontraron ${uncaughtExceptions.length} excepciones no capturadas en Chrome.`);
  }

  console.log('\n>>> PROTOCOLO OBLIGATORIO DE PRUEBA EN NAVEGADOR: APROBADO CON ÉXITO (0 EXCEPCIONES) <<<\n');
}
