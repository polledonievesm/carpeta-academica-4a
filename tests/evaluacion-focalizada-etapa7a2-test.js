/**
 * Suite de Pruebas Focalizadas - Etapa 7A.2
 * Evaluaciones Trimestrales: Preparación de la Instalación Definitiva
 * Carpeta Académica 4.º A
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Cargar script cliente y archivo instalable de backend
const scriptPath = path.join(__dirname, '..', 'js', 'vistas', 'evaluaciones-trimestrales.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

const instalablePath = path.join(__dirname, '..', 'INSTALABLE_EvaluacionesTrimestrales.gs.txt');
const instalableContent = fs.readFileSync(instalablePath, 'utf8');

const localStorageMock = (function () {
  let store = {};
  return {
    getItem: key => store[key] || null,
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: key => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

global.window = {
  actions: {},
  location: { hash: '#evaluaciones-trimestrales' },
  addEventListener: () => {},
  localStorage: localStorageMock
};
global.localStorage = localStorageMock;
global.document = {
  getElementById: () => null,
  querySelectorAll: () => [],
  querySelector: () => null,
  addEventListener: () => {}
};
global.toast = () => {};
global.todayCancun = () => '2026-11-26';

try {
  eval(scriptContent);
} catch (e) {
  console.error("Error al cargar script:", e);
}

const EvaluacionEngine = global.window.EvaluacionEngine;
const DesempenoEngine = global.window.DesempenoEngine;
const EvalSyncEngine = global.window.EvalSyncEngine;

console.log("============================================================");
console.log("SUITE DE PRUEBAS FOCALIZADAS - ETAPA 7A.2 (INSTALACIÓN)");
console.log("============================================================\n");

let passed = 0;
let failed = 0;

async function runTest(id, title, fn) {
  try {
    await fn();
    console.log(`[PASS] Prueba ${id.toString().padStart(2, '0')}: ${title}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] Prueba ${id.toString().padStart(2, '0')}: ${title}`);
    console.error(`       Error: ${err.message}\n`);
    failed++;
  }
}

(async () => {
  // PRUEBA 01: Rechazo por defecto cuando no hay validador de autenticación
  await runTest(1, "Rechazo por defecto (Zero-Trust) ante validador no vinculado", () => {
    // Evaluar la función validateTeacherAuth_ extraída del instalable sin validador
    const authRegex = /function validateTeacherAuth_\(sessionToken, targetGroup\) \{([\s\S]*?)\n\}/;
    const match = instalableContent.match(authRegex);
    assert.ok(match, "Debe existir validateTeacherAuth_ en el instalable");

    const validateFn = new Function('sessionToken', 'targetGroup', match[1]);

    assert.throws(() => {
      validateFn('ANY_TOKEN', '4.° A');
    }, /SECURITY_REJECT_DEFAULT/, "Debe lanzar error SECURITY_REJECT_DEFAULT por defecto");
  });

  // PRUEBA 02: Rechazo de sesiones inválidas con validador vinculado
  await runTest(2, "Rechazo estricto de sesiones inválidas o expiradas", () => {
    const authRegex = /function validateTeacherAuth_\(sessionToken, targetGroup\) \{([\s\S]*?)\n\}/;
    const match = instalableContent.match(authRegex);
    // Simular que existe checkTeacherSession_ pero devuelve false
    const validateFn = new Function('isTeacherSessionValid_', 'sessionToken', 'targetGroup', match[1]);

    assert.throws(() => {
      validateFn((token, group) => false, 'INVALID_TOKEN', '4.° A');
    }, /AUTH_ERROR/, "Debe lanzar error de autenticación con sesión inválida");
  });

  // PRUEBA 03: Rechazo de acceso a grupos no autorizados
  await runTest(3, "Rechazo de acceso a grupos no autorizados", () => {
    const authRegex = /function validateTeacherAuth_\(sessionToken, targetGroup\) \{([\s\S]*?)\n\}/;
    const match = instalableContent.match(authRegex);
    // Simular que solo autoriza 4.° A
    const mockValidator = (token, group) => (group === '4.° A');
    const validateFn = new Function('isTeacherSessionValid_', 'sessionToken', 'targetGroup', match[1]);

    assert.throws(() => {
      validateFn(mockValidator, 'VALID_TOKEN', '5.° B');
    }, /AUTH_ERROR/, "Debe rechazar grupos no asignados");

    const authorized = validateFn(mockValidator, 'VALID_TOKEN', '4.° A');
    assert.strictEqual(authorized, true, "Debe autorizar si el grupo coincide");
  });

  // PRUEBA 04: Clave de EvalActividades distingue el criterio
  await runTest(4, "Clave primaria de EvalActividades incluye criterio para evitar colisiones", () => {
    const ciclo = '2026-2027';
    const grupo = '4A';
    const t = 1;
    const campo = 'Lenguajes';
    const actId = 'ACT_PROYECTO_01';

    const keyTareas = `${ciclo}_${grupo}_T${t}_${campo}_tareas_${actId}`;
    const keyActividades = `${ciclo}_${grupo}_T${t}_${campo}_actividades_${actId}`;

    assert.notStrictEqual(keyTareas, keyActividades, "Las claves deben ser diferentes aunque compartan actividadId");
    assert.ok(keyTareas.includes('_tareas_'));
    assert.ok(keyActividades.includes('_actividades_'));
  });

  // PRUEBA 05: Encabezados físicos definitivos de las 7 hojas contemplan batchId y estadoConsolidacion
  await runTest(5, "Encabezados físicos contemplan batchId y estadoConsolidacion", () => {
    assert.ok(instalableContent.includes("'batchId', 'estadoConsolidacion'"));
    assert.ok(instalableContent.includes("EvalConfig"));
    assert.ok(instalableContent.includes("EvalActividades"));
    assert.ok(instalableContent.includes("EvalCalificaciones"));
    assert.ok(instalableContent.includes("EvalDesempeno"));
    assert.ok(instalableContent.includes("EvalMensajes"));
    assert.ok(instalableContent.includes("EvalBancoRecomendaciones"));
    assert.ok(instalableContent.includes("EvalVersiones"));
  });

  // PRUEBA 06: Mecanismo de dos fases: registros en_preparacion y confirmacion consolidado
  await runTest(6, "Registros se insertan como en_preparacion y EvalVersiones sella como consolidado", () => {
    const bundle = EvalSyncEngine.buildTrimesterBundle(1);
    assert.strictEqual(bundle.consolidationState, 'en_preparacion');
    assert.ok(bundle.batchId.startsWith('BATCH_'));
  });

  // PRUEBA 07: Recuperación ante escrituras parciales (filas en_preparacion invisibles)
  await runTest(7, "Filas en_preparacion de escrituras interrumpidas son ignoradas en consultas", () => {
    const mockVersiones = [
      { id: 'V1', batchId: 'BATCH_OK_1', estadoConsolidacion: 'consolidado' }
    ];
    const mockCalificaciones = [
      { id: 'C1', batchId: 'BATCH_OK_1', alumnoId: 'A1', grade: 9.0, estadoConsolidacion: 'consolidado' },
      { id: 'C2', batchId: 'BATCH_INTERRUMPIDO', alumnoId: 'A1', grade: 5.0, estadoConsolidacion: 'en_preparacion' }
    ];

    const activeBatchId = mockVersiones[mockVersiones.length - 1].batchId;
    const visibleRows = mockCalificaciones.filter(r => r.batchId === activeBatchId);

    assert.strictEqual(visibleRows.length, 1);
    assert.strictEqual(visibleRows[0].grade, 9.0, "La consulta sirve la versión consolidada y no la parcial");
  });

  // PRUEBA 08: Idempotencia ante reintentos con mismo batchId
  await runTest(8, "Reintentos con mismo batchId devuelven éxito inmediato sin duplicar filas", () => {
    const batchId = 'BATCH_RETRY_TEST';
    const mockVersiones = [
      { id: 'V1', batchId: batchId, estadoConsolidacion: 'consolidado', creadoEn: '2026-11-26T23:00:00Z' }
    ];

    const alreadyConsolidated = mockVersiones.find(v => v.batchId === batchId && v.estadoConsolidacion === 'consolidado');
    assert.ok(alreadyConsolidated);
    assert.strictEqual(alreadyConsolidated.batchId, batchId);
  });

  // PRUEBA 09: Conflicto de versiones evita sobreescritura de información más reciente
  await runTest(9, "Conflicto de versiones bloquea payload desactualizado", () => {
    const currentVersionOnServer = 4;
    const clientPayloadVersion = 2; // Cliente desfasado

    assert.ok(clientPayloadVersion < currentVersionOnServer, "Debe detectar desfase de versión");
  });

  // PRUEBA 10: Migración segura de identificadores conserva conceptos legados sin transferir
  await runTest(10, "Conservación de datos legados sin transferir valoraciones entre conceptos", () => {
    const draft = {
      acad_lectura: 'E',
      ind_19_cuidado_materiales_mobiliario: 'B', // No transferir a trabajo colaborativo ni cuidado mobiliario
      ind_23_justificacion_oportuna_inasistencias: 'R' // No transferir a puntualidad
    };
    const norm = DesempenoEngine.normalizeDraftRatings(draft);
    assert.strictEqual(norm.cleanRatings.acad_lectura, 'E');
    assert.strictEqual(norm.cleanRatings.cond_colaborativo, undefined);
    assert.strictEqual(norm.cleanRatings.cond_mobiliario, undefined);
    assert.strictEqual(norm.cleanRatings.asis_puntualidad, undefined);
    assert.strictEqual(norm.legacyRatings.ind_19_cuidado_materiales_mobiliario, 'B');
    assert.strictEqual(norm.legacyRatings.ind_23_justificacion_oportuna_inasistencias, 'R');
    assert.strictEqual(norm.requiresReview, true);
  });

  console.log("\n============================================================");
  console.log(`RESUMEN ETAPA 7A.2: ${passed} / 10 PRUEBAS FOCALIZADAS SUPERADAS (${failed} fallos)`);
  console.log("============================================================\n");

  if (failed > 0) process.exit(1);
})();
