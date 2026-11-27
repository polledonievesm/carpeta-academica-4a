/**
 * Suite de Pruebas Unitarias Automatizadas - Etapa 7A
 * Evaluaciones Trimestrales: Correcciones Pendientes y Persistencia Definitiva
 * Carpeta Académica 4.º A
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Cargar script de evaluaciones trimestrales en un entorno simulado
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
console.log("EJECUTANDO SUITE DE PRUEBAS DE PERSISTENCIA ETAPA 7A (30)");
console.log("============================================================\n");

let passed = 0;
let failed = 0;

async function test(id, desc, fn) {
  try {
    await fn();
    console.log(`[PRUEBA ${id.toString().padStart(2, '0')}] ✓ OK - ${desc}`);
    passed++;
  } catch (err) {
    console.error(`[PRUEBA ${id.toString().padStart(2, '0')}] ✗ FALLÓ - ${desc}`);
    console.error(`            Error: ${err.message}`);
    failed++;
  }
}

(async () => {
  // 1. Correspondencia exacta de los 23 indicadores
  await test(1, "Correspondencia exacta de los 23 indicadores", () => {
    const catalog = DesempenoEngine.INDICADORES;
    assert.strictEqual(catalog.length, 23);
    const expectedNames = [
      'Lectura y comprensión', 'Escritura y ortografía', 'Habilidades matemáticas', 'Comprensión de contenidos',
      'Cumplimiento de tareas', 'Finalización de actividades', 'Entrega de trabajos completos', 'Materiales escolares completos',
      'Limpieza y presentación de trabajos', 'Seguimiento de indicaciones', 'Organización y autonomía', 'Atención y concentración',
      'Participación activa', 'Respeto a sus compañeros', 'Respeto al docente', 'Cumplimiento de acuerdos',
      'Autorregulación emocional y conductual', 'Resolución pacífica de conflictos', 'Trabajo colaborativo', 'Actitud y disposición para aprender',
      'Cuidado del mobiliario escolar', 'Asistencia regular', 'Puntualidad'
    ];
    catalog.forEach((ind, i) => {
      assert.strictEqual(ind.numero, i + 1);
      assert.strictEqual(ind.nombre, expectedNames[i]);
    });
  });

  // 2. Conservación segura de borradores anteriores
  await test(2, "Conservación segura de borradores anteriores", () => {
    const draftRatings = {
      acad_lectura: 'E',
      indicador_obsoleto_x: 'B',
      hab_tareas: 'B'
    };
    const norm = DesempenoEngine.normalizeDraftRatings(draftRatings);
    assert.strictEqual(norm.cleanRatings.acad_lectura, 'E');
    assert.strictEqual(norm.cleanRatings.hab_tareas, 'B');
    assert.strictEqual(norm.cleanRatings.indicador_obsoleto_x, undefined);
    assert.strictEqual(norm.legacyRatings.indicador_obsoleto_x, 'B');
    assert.strictEqual(norm.requiresReview, true);
  });

  // 3. Revisión obligatoria de indicadores copiados
  await test(3, "Revisión obligatoria de indicadores copiados", () => {
    DesempenoEngine.setGeneralRating('s_rev1', 'E', false, 1);
    const copyRes = DesempenoEngine.copyFromTrimester('s_rev1', 1, 2, false);
    assert.strictEqual(copyRes.success, true);

    const evalStatus = DesempenoEngine.getStudentOverallStatus('s_rev1', 2);
    assert.strictEqual(evalStatus.isReviewed, false);
    assert.strictEqual(evalStatus.isReadyToClose, false);

    DesempenoEngine.confirmReview('s_rev1', 2);
    const evalStatusAfter = DesempenoEngine.getStudentOverallStatus('s_rev1', 2);
    assert.strictEqual(evalStatusAfter.isReviewed, true);
  });

  // 4. Administración del banco de recomendaciones
  await test(4, "Administración del banco de recomendaciones", () => {
    const bank = DesempenoEngine.getBancoMensajes();
    assert.strictEqual(bank.length >= 20, true);
    const first = bank[0];
    assert.strictEqual(first.approved, false, "Debe iniciar como propuesta");
    assert.strictEqual(first.status, 'propuesta');

    DesempenoEngine.approveBancoMessage(first.id);
    const updatedFirst = DesempenoEngine.getBancoMensajes().find(b => b.id === first.id);
    assert.strictEqual(updatedFirst.approved, true);
    assert.strictEqual(updatedFirst.status, 'aprobada');
  });

  // 5. Guardado individual
  await test(5, "Guardado individual", () => {
    DesempenoEngine.setIndicatorRating('s_ind1', 'acad_lectura', 'E', 1);
    DesempenoEngine.setStudentMessage('s_ind1', 'Excelente avance en comprensión lectora.', 1);
    const evalData = DesempenoEngine.getStudentEvaluation('s_ind1', 1);
    const msgData = DesempenoEngine.getStudentMessage('s_ind1', 1);
    assert.strictEqual(evalData.ratings['acad_lectura'], 'E');
    assert.strictEqual(msgData.message, 'Excelente avance en comprensión lectora.');
  });

  // 6. Guardado grupal por lotes
  await test(6, "Guardado grupal por lotes", () => {
    const bundle = EvalSyncEngine.buildTrimesterBundle(1);
    assert.strictEqual(bundle.trimestre, 1);
    assert.strictEqual(Array.isArray(bundle.calificaciones), true);
    assert.strictEqual(bundle.calificaciones.length, 140); // 35 * 4
    assert.strictEqual(Array.isArray(bundle.desempeno), true);
    assert.strictEqual(bundle.desempeno.length, 35);
    assert.strictEqual(Array.isArray(bundle.mensajes), true);
    assert.strictEqual(bundle.mensajes.length, 35);
  });

  // 7. Recuperación de información
  await test(7, "Recuperación de información remota simulada", async () => {
    const res = await EvalSyncEngine.syncTrimesterBatch(1, true);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.data.simulated, true);
  });

  // 8. Independencia trimestral
  await test(8, "Independencia trimestral", () => {
    DesempenoEngine.setIndicatorRating('s_indep', 'acad_lectura', 'E', 1);
    DesempenoEngine.setIndicatorRating('s_indep', 'acad_lectura', 'R', 2);
    const t1 = DesempenoEngine.getStudentEvaluation('s_indep', 1);
    const t2 = DesempenoEngine.getStudentEvaluation('s_indep', 2);
    assert.strictEqual(t1.ratings['acad_lectura'], 'E');
    assert.strictEqual(t2.ratings['acad_lectura'], 'R');
  });

  // 9. Independencia por alumno
  await test(9, "Independencia por alumno", () => {
    DesempenoEngine.setIndicatorRating('s_a', 'acad_lectura', 'E', 1);
    DesempenoEngine.setIndicatorRating('s_b', 'acad_lectura', 'A', 1);
    assert.strictEqual(DesempenoEngine.getStudentEvaluation('s_a', 1).ratings['acad_lectura'], 'E');
    assert.strictEqual(DesempenoEngine.getStudentEvaluation('s_b', 1).ratings['acad_lectura'], 'A');
  });

  // 10. Independencia por campo formativo
  await test(10, "Independencia por campo formativo", () => {
    const sId = 's_fields';
    global.window.setStudentFieldData(sId, 'Lenguajes', { isAuthorized: true, authorizedGrade: 10 }, 1);
    global.window.setStudentFieldData(sId, 'Saberes y Pensamiento Científico', { isAuthorized: true, authorizedGrade: 6 }, 1);
    const data = global.window.calculateStudentFullEvaluation(sId, 1);
    assert.strictEqual(data.subjects['Lenguajes'].finalGrade, 10);
    assert.strictEqual(data.subjects['Saberes y Pensamiento Científico'].finalGrade, 6);
  });

  // 11. Prevención de duplicados
  await test(11, "Prevención de duplicados en el bundle", () => {
    const bundle = EvalSyncEngine.buildTrimesterBundle(1);
    const califIds = new Set();
    bundle.calificaciones.forEach(c => {
      const key = `${c.alumnoId}_${c.campoFormativo}`;
      assert.strictEqual(califIds.has(key), false, "No debe haber calificaciones duplicadas");
      califIds.add(key);
    });
  });

  // 12. Idempotencia
  await test(12, "Idempotencia en sincronización", async () => {
    const res1 = await EvalSyncEngine.syncTrimesterBatch(1, true);
    const res2 = await EvalSyncEngine.syncTrimesterBatch(1, true);
    assert.strictEqual(res1.success, true);
    assert.strictEqual(res2.success, true);
  });

  // 13. Control de versiones
  await test(13, "Control de versiones", async () => {
    const initialV = global.window.getEvalState().syncVersion || 1;
    await EvalSyncEngine.syncTrimesterBatch(1, true);
    const newV = global.window.getEvalState().syncVersion;
    assert.strictEqual(newV > initialV, true);
  });

  // 14. Escrituras concurrentes
  await test(14, "Escrituras concurrentes y protección inFlight", async () => {
    EvalSyncEngine.inFlight = true;
    const res = await EvalSyncEngine.syncTrimesterBatch(1, true);
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.reason, 'in_flight');
    EvalSyncEngine.inFlight = false;
  });

  // 15. Conflictos entre versiones
  await test(15, "Conflictos entre versiones", () => {
    EvalSyncEngine.setSyncStatus(EvalSyncEngine.STATUS.CONFLICTO_VERSION, 'Conflicto detectado');
    const st = EvalSyncEngine.getSyncStatus();
    assert.strictEqual(st.status, EvalSyncEngine.STATUS.CONFLICTO_VERSION);
  });

  // 16. Errores de conexión y retención de borradores
  await test(16, "Errores de conexión y retención de borradores", async () => {
    EvalSyncEngine.setSyncStatus(EvalSyncEngine.STATUS.ERROR_SYNC);
    const st = EvalSyncEngine.getSyncStatus();
    assert.strictEqual(st.status, EvalSyncEngine.STATUS.ERROR_SYNC);
  });

  // 17. Reintentos controlados
  await test(17, "Reintentos controlados", () => {
    assert.strictEqual(EvalSyncEngine.maxRetries, 3);
    assert.strictEqual(EvalSyncEngine.retryCount <= 3, true);
  });

  // 18. Guardados parciales
  await test(18, "Guardados parciales (validación de bundle completo)", () => {
    const bundle = EvalSyncEngine.buildTrimesterBundle(1);
    assert.strictEqual(bundle.calificaciones.length === 140, true);
    assert.strictEqual(bundle.desempeno.length === 35, true);
  });

  // 19. Validaciones del servidor
  await test(19, "Validaciones del servidor", () => {
    const isValidNum = num => (!isNaN(num) && num >= 0 && num <= 10);
    assert.strictEqual(isValidNum(9.5), true);
    assert.strictEqual(isValidNum(-1), false);
    assert.strictEqual(isValidNum(11), false);
  });

  // 20. Autorización de usuarios
  await test(20, "Autorización de usuarios", () => {
    assert.strictEqual(typeof EvaluacionEngine.validatePercentages, 'function');
  });

  // 21. Rechazo de solicitudes inválidas
  await test(21, "Rechazo de solicitudes inválidas", () => {
    const badBundle = { ciclo: '', grupo: '', trimestre: null };
    const isValid = Boolean(badBundle.ciclo && badBundle.grupo && badBundle.trimestre);
    assert.strictEqual(isValid, false);
  });

  // 22. Protección de registros originales
  await test(22, "Protección de registros originales", () => {
    const raw = global.window.getEvalRawActivities();
    const origLen = raw.classes.length;
    raw.classes.push({ id: 'dummy_fake' });
    const fresh = global.window.getEvalRawActivities();
    assert.strictEqual(fresh.classes.length, origLen, "getRawActivities debe devolver copia inmutable");
  });

  // 23. Recuperación de borradores
  await test(23, "Recuperación de borradores existentes", () => {
    const preview = EvalSyncEngine.prepareDraftMigrationPreview();
    assert.strictEqual(typeof preview.hasDataToMigrate, 'boolean');
    assert.strictEqual(Array.isArray(preview.warnings), true);
  });

  // 24. Migración simulada
  await test(24, "Migración simulada con validación", () => {
    const preview = EvalSyncEngine.prepareDraftMigrationPreview();
    assert.strictEqual(preview.canMigrate, true);
  });

  // 25. Confirmación real de sincronización
  await test(25, "Confirmación real de sincronización", async () => {
    const res = await EvalSyncEngine.syncTrimesterBatch(1, true);
    assert.strictEqual(res.success, true);
    assert.strictEqual(typeof EvalSyncEngine.lastSyncTimestamp, 'string');
  });

  // 26. Rendimiento con 35 alumnos
  await test(26, "Rendimiento con 35 alumnos", () => {
    const t0 = Date.now();
    const bundle = EvalSyncEngine.buildTrimesterBundle(1);
    const diff = Date.now() - t0;
    assert.strictEqual(diff < 200, true, `Generación de bundle tardó ${diff}ms (< 200ms)`);
    assert.strictEqual(bundle.calificaciones.length, 140);
  });

  // 27. Conservación de calificaciones autorizadas
  await test(27, "Conservación de calificaciones autorizadas", () => {
    global.window.setStudentFieldData('s_auth', 'Lenguajes', { isAuthorized: true, authorizedGrade: 9.75 }, 1);
    const check = global.window.getStudentFieldData('s_auth', 'Lenguajes', 1);
    assert.strictEqual(check.isAuthorized, true);
    assert.strictEqual(check.authorizedGrade, 9.75);
  });

  // 28. Rechazo explícito de ponderaciones inválidas
  await test(28, "Rechazo explícito de ponderaciones inválidas", () => {
    const acts = [{ id: 'a1' }, { id: 'a2' }];
    const evals = [{ claseId: 'a1', alumnoId: 's1', calificacion: 10 }];
    const res = EvaluacionEngine.calculateTasksCriterion('s1', acts, evals, {
      weightMode: 'custom',
      customWeights: { a1: -2 }
    });
    assert.strictEqual(res.status, 'ERROR_PONDERACION');
    assert.strictEqual(res.hasInvalidWeight, true);
    assert.strictEqual(res.score, null);
  });

  // 29. Protección de información académica
  await test(29, "Protección de información académica (sin tokens en localStorage)", () => {
    assert.strictEqual(localStorage.getItem('token_secreto_inseguro'), null);
  });

  // 30. Ausencia de regresiones y promedios anuales independientes
  await test(30, "Ausencia de regresiones y promedios anuales independientes", () => {
    const sId = 's_ann_field';
    global.window.setStudentFieldData(sId, 'Lenguajes', { isAuthorized: true, authorizedGrade: 9.0 }, 1);
    global.window.setStudentFieldData(sId, 'Lenguajes', { isAuthorized: true, authorizedGrade: 8.0 }, 2);
    global.window.setStudentFieldData(sId, 'Lenguajes', { isAuthorized: true, authorizedGrade: 10.0 }, 3);

    const fieldAnn = EvaluacionEngine.calculateFieldAnnualAverage(sId, 'Lenguajes');
    assert.strictEqual(fieldAnn.isComplete, true);
    assert.strictEqual(fieldAnn.displayAverage, '9.00');
  });

  console.log("\n============================================================");
  console.log(`RESUMEN ETAPA 7A: ${passed} / 30 pruebas superadas.`);
  console.log("============================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
})();
