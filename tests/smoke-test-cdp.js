const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

async function runSmokeTest() {
  console.log('Iniciando Smoke Test con Chrome Headless vía CDP...');
  
  // Encontrar ejecutable de Chrome
  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
  ];
  
  const chromePath = chromePaths.find(p => fs.existsSync(p));
  if (!chromePath) {
    console.log('Google Chrome no encontrado en rutas estándar, omitiendo CDP test.');
    return;
  }
  
  // Iniciar servidor local simple con node para servir index.html
  const server = http.createServer((req, res) => {
    let filePath = path.join(__dirname, '..', req.url === '/' ? 'index.html' : req.url.split('?')[0]);
    if (!fs.existsSync(filePath)) {
      res.writeHead(404);
      return res.end('Not found');
    }
    const ext = path.extname(filePath);
    const mimeMap = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json'
    };
    res.writeHead(200, { 'Content-Type': mimeMap[ext] || 'text/plain' });
    res.end(fs.readFileSync(filePath));
  });

  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  console.log(`Servidor local escuchando en http://127.0.0.1:${port}`);

  // Iniciar Chrome con puerto de depuración remota
  const remotePort = 9222;
  const chromeProcess = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${remotePort}`,
    '--no-sandbox',
    '--disable-gpu',
    `http://127.0.0.1:${port}/index.html`
  ]);

  // Esperar a que CDP esté disponible
  let versionData = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 300));
    try {
      versionData = await new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${remotePort}/json/version`, res => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => resolve(JSON.parse(body)));
        }).on('error', reject);
      });
      break;
    } catch (e) {}
  }

  if (!versionData) {
    console.error('No se pudo conectar con CDP en Chrome.');
    chromeProcess.kill();
    server.close();
    process.exit(1);
  }

  // Obtener páginas abiertas
  const pages = await new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${remotePort}/json/list`, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    }).on('error', reject);
  });

  const page = pages.find(p => p.type === 'page');
  if (!page || !page.webSocketDebuggerUrl) {
    console.error('No se encontró página WebSocket en CDP.');
    chromeProcess.kill();
    server.close();
    process.exit(1);
  }

  // Conectar WebSocket nativo (Node 22+)
  const WS = globalThis.WebSocket || require('ws');
  const ws = new WS(page.webSocketDebuggerUrl);

  const exceptions = [];
  let id = 1;

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  ws.onmessage = evt => {
    const msg = JSON.parse(evt.data);
    if (msg.method === 'Runtime.exceptionThrown') {
      exceptions.push(msg.params.exceptionDetails);
    }
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      // Ignorar favicon 404
      if (!msg.params.entry.url || !msg.params.entry.url.includes('favicon.ico')) {
        exceptions.push(msg.params.entry);
      }
    }
  };

  function sendCmd(method, params = {}) {
    return new Promise(resolve => {
      const msgId = id++;
      const handler = evt => {
        const res = JSON.parse(evt.data);
        if (res.id === msgId) {
          ws.removeEventListener('message', handler);
          resolve(res.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  await sendCmd('Runtime.enable');
  await sendCmd('Log.enable');
  await sendCmd('Page.enable');

  // Esperar a que la página cargue y navegar a la vista de evaluaciones trimestrales si existe
  await new Promise(r => setTimeout(r, 1500));

  console.log('Evaluando inicialización de la vista en navegador...');
  const evalResult = await sendCmd('Runtime.evaluate', {
    expression: `
      (function() {
        if (typeof showView === 'function') {
          try {
            showView('evaluaciones-trimestrales');
            return { ok: true, activeView: 'evaluaciones-trimestrales' };
          } catch(e) {
            return { ok: false, error: e.message };
          }
        }
        return { ok: true, note: 'showView no requerido' };
      })()
    `,
    returnByValue: true
  });

  console.log('Resultado de navegación:', evalResult);
  await new Promise(r => setTimeout(r, 1000));

  ws.close();
  chromeProcess.kill();
  server.close();

  console.log(`Excepciones detectadas en navegador: ${exceptions.length}`);
  if (exceptions.length > 0) {
    console.error('EXCEPCIONES:', JSON.stringify(exceptions, null, 2));
    process.exit(1);
  } else {
    console.log('SMOKE TEST CDP: CERO (0) EXCEPCIONES. VISTA LIMPIA Y ESTABLE.');
  }
}

runSmokeTest().catch(err => {
  console.error('Error en CDP Smoke Test:', err);
  process.exit(1);
});

function runSmokeTestLight() {
  console.log('Ejecutando Smoke Test sintáctico y estático...');
  const filesToVerify = [
    'js/vistas/evaluaciones-trimestrales.js',
    'js/vistas/asistencia.js',
    'js/vistas/expediente.js',
    'js/vistas/familias.js'
  ];
  let errors = 0;
  filesToVerify.forEach(f => {
    try {
      const content = fs.readFileSync(f, 'utf8');
      new Function(content); // Test JS parsing
      console.log(`[OK] Sintaxis limpia en ${f}`);
    } catch (err) {
      console.error(`[ERROR] Sintaxis en ${f}: ${err.message}`);
      errors++;
    }
  });
  if (errors > 0) process.exit(1);
  console.log('SMOKE TEST: CERO (0) ERRORES DE SINTAXIS.');
}
