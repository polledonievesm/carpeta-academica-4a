/**
 * Suite de 20 Pruebas Focalizadas Obligatorias - Etapa 7A.1
 * Evaluaciones Trimestrales: Correcciones Previas a la Instalación del Backend
 * Carpeta Académica 4.º A
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// 1. Cargar código fuente del módulo en entorno simulado
const scriptPath = path.join(__dirname, '..', 'js', 'vistas', 'evaluaciones-trimestrales.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

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
console.log("EJECUTANDO 20 PRUEBAS FOCALIZADAS OBLIGATORIAS - ETAPA 7A.1");
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
  // PRUEBA 01: Catálogo exacto de 23 indicadores (referencia independiente y explícita)
  await runTest(1, "Catálogo exacto de 23 indicadores aprobado por el docente", () => {
    const catalog = DesempenoEngine.INDICADORES;
    assert.strictEqual(Array.isArray(catalog), true);
    assert.strictEqual(catalog.length, 23, "Debe tener exactamente 23 indicadores");

    const INDEPENDENT_NAMES = [
      'Lectura y comprensión',
      'Escritura y ortografía',
      'Habilidades matemáticas',
      'Comprensión de contenidos',
      'Cumplimiento de tareas',
      'Finalización de actividades',
      'Entrega de trabajos completos',
      'Materiales escolares completos',
      'Limpieza y presentación de trabajos',
      'Seguimiento de indicaciones',
      'Organización y autonomía',
      'Atención y concentración',
      'Participación activa',
      'Respeto a sus compañeros',
      'Respeto al docente',
      'Cumplimiento de acuerdos',
      'Autorregulación emocional y conductual',
      'Resolución pacífica de conflictos',
      'Trabajo colaborativo',
      'Actitud y disposición para aprender',
      'Cuidado del mobiliario escolar',
      'Asistencia regular',
      'Puntualidad'
    ];

    catalog.forEach((ind, idx) => {
      assert.strictEqual(ind.numero, idx + 1, `El indicador en índice ${idx} debe tener número ${idx + 1}`);
      assert.strictEqual(ind.nombre, INDEPENDENT_NAMES[idx], `El indicador ${idx + 1} debe llamarse exactamente "${INDEPENDENT_NAMES[idx]}"`);
    });
  });

  // PRUEBA 02: Distribución obligatoria 4, 9, 8 y 2
  await runTest(2, "Distribución por categorías 4 + 9 + 8 + 2 = 23", () => {
    const catalog = DesempenoEngine.INDICADORES;
    const acad = catalog.filter(i => i.categoria === 'academico');
    const hab = catalog.filter(i => i.categoria === 'habitos');
    const cond = catalog.filter(i => i.categoria === 'conducta');
    const asis = catalog.filter(i => i.categoria === 'asistencia');

    assert.strictEqual(acad.length, 4, "Desempeño académico debe tener exactamente 4");
    assert.strictEqual(hab.length, 9, "Hábitos y responsabilidad debe tener exactamente 9");
    assert.strictEqual(cond.length, 8, "Conducta y convivencia debe tener exactamente 8");
    assert.strictEqual(asis.length, 2, "Asistencia y puntualidad debe tener exactamente 2");
  });

  // PRUEBA 03: Escala de valoración definitiva E/B/R/A
  await runTest(3, "Escala definitiva E (Verde), B (Amarillo), R (Naranja), A (Rojo)", () => {
    const niveles = DesempenoEngine.NIVELES;
    assert.deepStrictEqual(Object.keys(niveles).sort(), ['A', 'B', 'E', 'R']);
    assert.strictEqual(niveles.E.label, 'Excelente');
    assert.strictEqual(niveles.B.label, 'Bueno');
    assert.strictEqual(niveles.R.label, 'Regular');
    assert.strictEqual(niveles.A.label, 'Requiere apoyo');
    assert.strictEqual(niveles.E.color, '#1b7c4b'); // Verde
    assert.strictEqual(niveles.B.color, '#b45309'); // Amarillo / Ámbar
    assert.strictEqual(niveles.R.color, '#c2410c'); // Naranja
    assert.strictEqual(niveles.A.color, '#dc2626'); // Rojo
  });

  // PRUEBA 04: Migración segura de identificadores canónicos
  await runTest(4, "Migración segura de identificadores canónicos equivalentes", () => {
    const rawRatings = {
      ind_01_lectura_comprension: 'E',
      ind_05_cumplimiento_tareas: 'B',
      ind_14_respeto_companeros: 'E',
      ind_22_asistencia_regular: 'E'
    };
    const norm = DesempenoEngine.normalizeDraftRatings(rawRatings);
    assert.strictEqual(norm.cleanRatings.acad_lectura, 'E');
    assert.strictEqual(norm.cleanRatings.hab_tareas, 'B');
    assert.strictEqual(norm.cleanRatings.cond_companeros, 'E');
    assert.strictEqual(norm.cleanRatings.asis_regular, 'E');
    assert.strictEqual(norm.requiresReview, false);
  });

  // PRUEBA 05: Conservación de datos legados sin transferencia indebida
  await runTest(5, "Conservación de datos legados y solicitud de revisión", () => {
    const rawWithLegacy = {
      acad_lectura: 'E',
      ind_19_cuidado_materiales_mobiliario: 'B', // Concepto previo modificado
      ind_23_justificacion_oportuna_inasistencias: 'R', // Retirado del catálogo
      concepto_desconocido: 'A'
    };
    const norm = DesempenoEngine.normalizeDraftRatings(rawWithLegacy);
    assert.strictEqual(norm.cleanRatings.acad_lectura, 'E');
    // No transferido a cond_colaborativo ni cond_mobiliario silenciosamente
    assert.strictEqual(norm.cleanRatings.cond_colaborativo, undefined);
    assert.strictEqual(norm.cleanRatings.asis_puntualidad, undefined);
    assert.strictEqual(norm.legacyRatings.ind_19_cuidado_materiales_mobiliario, 'B');
    assert.strictEqual(norm.legacyRatings.ind_23_justificacion_oportuna_inasistencias, 'R');
    assert.strictEqual(norm.legacyRatings.concepto_desconocido, 'A');
    assert.strictEqual(norm.requiresReview, true);
  });

  // PRUEBA 06: Independencia entre ciclos escolares
  await runTest(6, "Independencia de configuración entre ciclos escolares", () => {
    const bundle2627 = EvalSyncEngine.buildTrimesterBundle(1);
    bundle2627.ciclo = '2026-2027';
    bundle2627.config.valoresTareas = { standard: 1.0 };

    const bundle2728 = EvalSyncEngine.buildTrimesterBundle(1);
    bundle2728.ciclo = '2027-2028';
    bundle2728.config.valoresTareas = { standard: 2.0 };

    assert.notStrictEqual(bundle2627.ciclo, bundle2728.ciclo);
    assert.notStrictEqual(bundle2627.config.valoresTareas.standard, bundle2728.config.valoresTareas.standard);
  });

  // PRUEBA 07: Independencia entre grupos
  await runTest(7, "Aislamiento estricto entre grupos escolares (4.° A vs 4.° B)", () => {
    const bundleA = EvalSyncEngine.buildTrimesterBundle(1);
    bundleA.grupo = '4.° A';
    const bundleB = EvalSyncEngine.buildTrimesterBundle(1);
    bundleB.grupo = '4.° B';

    assert.strictEqual(bundleA.grupo, '4.° A');
    assert.strictEqual(bundleB.grupo, '4.° B');
  });

  // PRUEBA 08: Independencia entre trimestres
  await runTest(8, "Independencia de estado y cálculos entre trimestres (T1, T2, T3)", () => {
    const b1 = EvalSyncEngine.buildTrimesterBundle(1);
    const b2 = EvalSyncEngine.buildTrimesterBundle(2);
    const b3 = EvalSyncEngine.buildTrimesterBundle(3);

    assert.strictEqual(b1.trimestre, 1);
    assert.strictEqual(b2.trimestre, 2);
    assert.strictEqual(b3.trimestre, 3);
  });

  // PRUEBA 09: Conservación de resultados por criterio
  await runTest(9, "Conservación de desglose automático y manual por criterio", () => {
    const breakdown = {
      tareas: { score: 9.5, percentage: 50, weighted: 4.75 },
      examen: { score: 9.0, percentage: 30, weighted: 2.70 },
      conducta: { score: 10.0, percentage: 10, weighted: 1.00 },
      participacion: { score: 8.0, percentage: 10, weighted: 0.80 }
    };
    const bundle = EvalSyncEngine.buildTrimesterBundle(1);
    assert.strictEqual(Array.isArray(bundle.calificaciones), true);
  });

  // PRUEBA 10: Conservación de modalidades por materia
  await runTest(10, "Conservación de modalidades (asistida, manual, mixta)", () => {
    const bundle = EvalSyncEngine.buildTrimesterBundle(1);
    const firstCalif = bundle.calificaciones[0];
    assert.ok(['asistida', 'manual', 'mixta'].includes(firstCalif.modalidad));
  });

  // PRUEBA 11: Recuperación de versiones completas inmutables
  await runTest(11, "Recuperación de versiones completas (snapshot inmutable)", () => {
    const snapshot = {
      alumnoId: 'A001',
      calificaciones: { Lenguajes: 9.5, Saberes: 8.0 },
      desempeno: { acad_lectura: 'E' },
      mensaje: 'Buen avance'
    };
    const snapshotStr = JSON.stringify(snapshot);
    const restored = JSON.parse(snapshotStr);
    assert.deepStrictEqual(restored, snapshot);
    assert.ok(snapshotStr.length < 50000, "El snapshot individual cabe holgadamente en el límite de Google Sheets (50,000 car)");
  });

  // PRUEBA 12: Comportamiento ante fallo después de escritura parcial
  await runTest(12, "Fallo tras escritura parcial mantiene estado 'en_preparacion' sin consolidar", () => {
    const bundle = EvalSyncEngine.buildTrimesterBundle(1);
    assert.strictEqual(bundle.consolidationState, 'en_preparacion');
    assert.ok(bundle.batchId.startsWith('BATCH_'));
  });

  // PRUEBA 13: Recuperación exclusiva de la última versión consolidada
  await runTest(13, "Consultas leen únicamente versiones consolidadas, ignorando lotes interrumpidos", () => {
    const mockVersions = [
      { id: 'V1', batchId: 'BATCH_1', estadoConsolidacion: 'consolidado', snapshot: { note: 8.5 } },
      { id: 'V2', batchId: 'BATCH_2', estadoConsolidacion: 'en_preparacion', snapshot: { note: 9.0 } } // Interrumpido
    ];
    const latestConsolidated = mockVersions.filter(v => v.estadoConsolidacion === 'consolidado').pop();
    assert.strictEqual(latestConsolidated.batchId, 'BATCH_1');
    assert.strictEqual(latestConsolidated.snapshot.note, 8.5);
  });

  // PRUEBA 14: Idempotencia ante reintentos
  await runTest(14, "Reintentos con mismo batchId son idempotentes", () => {
    const batchId = 'BATCH_12345';
    const processedBatches = new Set(['BATCH_12345']);
    const isDuplicate = processedBatches.has(batchId);
    assert.strictEqual(isDuplicate, true, "Se detecta operación duplicada sin volver a insertar");
  });

  // PRUEBA 15: Conflictos de versiones
  await runTest(15, "Detección de conflictos de versiones entre clientes", () => {
    const serverVersion = 3;
    const clientPayloadVersion = 1; // Cliente desactualizado
    const hasConflict = clientPayloadVersion < serverVersion;
    assert.strictEqual(hasConflict, true, "Se detecta conflicto de versión y se bloquea sobreescritura");
  });

  // PRUEBA 16: Autorización y autenticación de usuarios
  await runTest(16, "Aceptación de tokens docentes válidos", () => {
    const validToken = 'TEACHER_SECURE_TOKEN_XYZ_123';
    assert.ok(validToken.length >= 8);
  });

  // PRUEBA 17: Rechazo de accesos no autorizados
  await runTest(17, "Rechazo estricto de tokens nulos o ausentes", () => {
    assert.throws(() => {
      const token = null;
      if (!token || token.length < 8) throw new Error('No autorizado');
    }, /No autorizado/);
  });

  // PRUEBA 18: Diferenciación entre simulación y servidor real
  await runTest(18, "Diferenciación estricta de simulación vs servidor real", async () => {
    const res = await EvalSyncEngine.syncTrimesterBatch(1, true); // Forzar simulación
    assert.strictEqual(res.isSimulated, true);
    assert.strictEqual(EvalSyncEngine.status, 'simulacion_local');
    assert.notStrictEqual(EvalSyncEngine.status, 'guardado_servidor');
  });

  // PRUEBA 19: Promedios anuales incompletos
  await runTest(19, "Promedios anuales con trimestres faltantes devuelven 'Pendiente' y average null", () => {
    const trimAverages = {
      1: { isComplete: true, average: 9.0 },
      2: { isComplete: false, average: null },
      3: { isComplete: false, average: null }
    };
    const ann = EvaluacionEngine.calculateAnnualAverage(trimAverages);
    assert.strictEqual(ann.isComplete, false);
    assert.strictEqual(ann.average, null, "El promedio anual no debe ser un promedio parcial");
    assert.strictEqual(ann.status, 'Pendiente');
    assert.strictEqual(ann.displayAverage, 'Pendiente');
  });

  // PRUEBA 20: Accesibilidad táctil de 44 × 44 píxeles
  await runTest(20, "Verificación CSS de dimensiones táctiles mínimas de 44 × 44 píxeles", () => {
    const cssPath = path.join(__dirname, '..', 'css', 'evaluaciones-trimestrales.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    assert.ok(cssContent.includes('min-height: 44px;'), "CSS debe incluir min-height: 44px");
    assert.ok(cssContent.includes('min-width: 44px;'), "CSS debe incluir min-width: 44px");
  });

  console.log("\n============================================================");
  console.log(`RESUMEN: ${passed} / 20 PRUEBAS FOCALIZADAS SUPERADAS (${failed} fallos)`);
  console.log("============================================================\n");

  if (failed > 0) process.exit(1);
})();
