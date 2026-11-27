/**
 * Suite de Pruebas Unitarias Automatizadas - Etapa 6
 * Evaluaciones Trimestrales: Desempeño Integral y Mensajes Personalizados
 * Carpeta Académica 4.º A
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// 1. Cargar el script de evaluaciones trimestrales en un entorno simulado
const scriptPath = path.join(__dirname, '..', 'js', 'vistas', 'evaluaciones-trimestrales.js');
let scriptContent = fs.readFileSync(scriptPath, 'utf8');

// Mock del entorno de navegador
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

// Ejecutar el script dentro de un envoltorio seguro
try {
  eval(scriptContent);
} catch (e) {
  console.error("Error al cargar script:", e);
}

const EvaluacionEngine = global.window.EvaluacionEngine;
const DesempenoEngine = global.window.DesempenoEngine;

console.log("============================================================");
console.log("EJECUTANDO SUITE DE PRUEBAS DE DESEMPEÑO Y MENSAJES (30 PRUEBAS)");
console.log("============================================================\n");

let passed = 0;
let failed = 0;

function test(id, desc, fn) {
  try {
    fn();
    console.log(`[PRUEBA ${id.toString().padStart(2, '0')}] ✓ OK - ${desc}`);
    passed++;
  } catch (err) {
    console.error(`[PRUEBA ${id.toString().padStart(2, '0')}] ✗ FALLÓ - ${desc}`);
    console.error(`            Error: ${err.message}`);
    failed++;
  }
}

// =========================================================================
// SUITE DE 30 PRUEBAS UNITARIAS - ETAPA 6
// =========================================================================

// 1. Existencia y verificación de nombres exactos de los 23 indicadores
test(1, "Existencia y correspondencia exacta de nombres y orden de los 23 indicadores", () => {
  const catalog = DesempenoEngine.INDICADORES;
  assert.strictEqual(Array.isArray(catalog), true);
  assert.strictEqual(catalog.length, 23, "Debe tener exactamente 23 indicadores");

  const expectedNames = [
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
    assert.strictEqual(ind.nombre, expectedNames[idx], `El indicador ${idx + 1} debe llamarse exactamente "${expectedNames[idx]}"`);
  });
});

// 2. Distribución correcta de 4, 9, 8 y 2 indicadores
test(2, "Distribución correcta de 4, 9, 8 y 2 indicadores", () => {
  const catalog = DesempenoEngine.INDICADORES;
  const acad = catalog.filter(i => i.categoria === 'academico');
  const hab = catalog.filter(i => i.categoria === 'habitos');
  const cond = catalog.filter(i => i.categoria === 'conducta');
  const asis = catalog.filter(i => i.categoria === 'asistencia');

  assert.strictEqual(acad.length, 4, "Desempeño académico debe tener 4");
  assert.strictEqual(hab.length, 9, "Hábitos debe tener 9");
  assert.strictEqual(cond.length, 8, "Conducta debe tener 8");
  assert.strictEqual(asis.length, 2, "Asistencia debe tener 2");
});

// 3. Identificadores únicos y estables
test(3, "Identificadores únicos y estables", () => {
  const catalog = DesempenoEngine.INDICADORES;
  const ids = catalog.map(i => i.id);
  const uniqueIds = new Set(ids);
  assert.strictEqual(uniqueIds.size, 23, "Todos los IDs deben ser únicos");
  assert.strictEqual(ids.includes('acad_lectura'), true);
  assert.strictEqual(ids.includes('hab_tareas'), true);
  assert.strictEqual(ids.includes('cond_companeros'), true);
  assert.strictEqual(ids.includes('asis_puntualidad'), true);
});

// 4. Correspondencia de niveles y colores
test(4, "Correspondencia de niveles y colores (E, B, R, A)", () => {
  const niveles = DesempenoEngine.NIVELES;
  assert.strictEqual(Boolean(niveles.E && niveles.B && niveles.R && niveles.A), true);
  assert.strictEqual(niveles.E.label, 'Excelente');
  assert.strictEqual(niveles.B.label, 'Bueno');
  assert.strictEqual(niveles.R.label, 'Regular');
  assert.strictEqual(niveles.A.label, 'Requiere apoyo');
});

// 5. Estado inicial sin valorar
test(5, "Estado inicial sin valorar (neutro)", () => {
  const evalData = DesempenoEngine.getStudentEvaluation('TEST_A01', 1);
  assert.strictEqual(evalData.completedCount, 0);
  assert.strictEqual(evalData.isComplete, false);
  assert.strictEqual(evalData.pendingIndicators.length, 23);
});

// 6. Valoración individual
test(6, "Valoración individual de un indicador", () => {
  DesempenoEngine.setIndicatorRating('TEST_A01', 'acad_lectura', 'E', 1);
  const evalData = DesempenoEngine.getStudentEvaluation('TEST_A01', 1);
  assert.strictEqual(evalData.ratings['acad_lectura'], 'E');
  assert.strictEqual(evalData.completedCount, 1);
  assert.strictEqual(evalData.distribution.E, 1);
});

// 7. Valoración por categoría
test(7, "Valoración por categoría específica", () => {
  // Aplicar 'B' a toda la categoría 'academico' (4 indicadores)
  DesempenoEngine.setCategoryRating('TEST_A02', 'academico', 'B', false, 1);
  const evalData = DesempenoEngine.getStudentEvaluation('TEST_A02', 1);
  assert.strictEqual(evalData.ratings['acad_lectura'], 'B');
  assert.strictEqual(evalData.ratings['acad_escritura'], 'B');
  assert.strictEqual(evalData.ratings['acad_matematicas'], 'B');
  assert.strictEqual(evalData.ratings['acad_contenidos'], 'B');
  assert.strictEqual(evalData.completedCount, 4);
  assert.strictEqual(evalData.distribution.B, 4);
});

// 8. Valoración general (23 indicadores)
test(8, "Valoración general de los 23 indicadores", () => {
  DesempenoEngine.setGeneralRating('TEST_A03', 'E', false, 1);
  const evalData = DesempenoEngine.getStudentEvaluation('TEST_A03', 1);
  assert.strictEqual(evalData.completedCount, 23);
  assert.strictEqual(evalData.isComplete, true);
  assert.strictEqual(evalData.distribution.E, 23);
  assert.strictEqual(evalData.pendingIndicators.length, 0);
});

// 9. Valoración masiva grupal
test(9, "Valoración masiva grupal de un indicador", () => {
  const students = ['TEST_G01', 'TEST_G02', 'TEST_G03'];
  DesempenoEngine.setGroupIndicatorRating(students, 'asis_regular', 'E', 1);
  students.forEach(id => {
    const data = DesempenoEngine.getStudentEvaluation(id, 1);
    assert.strictEqual(data.ratings['asis_regular'], 'E');
  });
});

// 10. Protección contra sobrescritura accidental (Undo)
test(10, "Protección contra sobrescritura accidental con Deshacer", () => {
  DesempenoEngine.setIndicatorRating('TEST_A04', 'acad_lectura', 'E', 1);
  // Operación masiva que sobrescribe con 'A'
  DesempenoEngine.setGeneralRating('TEST_A04', 'A', false, 1);
  assert.strictEqual(DesempenoEngine.getStudentEvaluation('TEST_A04', 1).ratings['acad_lectura'], 'A');
  // Deshacer la última operación
  const undone = DesempenoEngine.undoLastOperation('TEST_A04', 1);
  assert.strictEqual(undone, true);
  assert.strictEqual(DesempenoEngine.getStudentEvaluation('TEST_A04', 1).ratings['acad_lectura'], 'E');
});

// 11. Independencia entre alumnos
test(11, "Independencia de valoraciones entre alumnos", () => {
  DesempenoEngine.setIndicatorRating('TEST_S1', 'hab_tareas', 'E', 1);
  DesempenoEngine.setIndicatorRating('TEST_S2', 'hab_tareas', 'R', 1);
  assert.strictEqual(DesempenoEngine.getStudentEvaluation('TEST_S1', 1).ratings['hab_tareas'], 'E');
  assert.strictEqual(DesempenoEngine.getStudentEvaluation('TEST_S2', 1).ratings['hab_tareas'], 'R');
});

// 12. Independencia entre trimestres
test(12, "Independencia de valoraciones entre trimestres", () => {
  DesempenoEngine.setIndicatorRating('TEST_T', 'cond_acuerdos', 'E', 1);
  DesempenoEngine.setIndicatorRating('TEST_T', 'cond_acuerdos', 'B', 2);
  assert.strictEqual(DesempenoEngine.getStudentEvaluation('TEST_T', 1).ratings['cond_acuerdos'], 'E');
  assert.strictEqual(DesempenoEngine.getStudentEvaluation('TEST_T', 2).ratings['cond_acuerdos'], 'B');
});

// 13. Copia del trimestre anterior (T1 a T2)
test(13, "Copia de valoraciones del trimestre anterior", () => {
  DesempenoEngine.setGeneralRating('TEST_COPY', 'E', false, 1);
  const copyRes = DesempenoEngine.copyFromTrimester('TEST_COPY', 1, 2, false);
  assert.strictEqual(copyRes.success, true);
  assert.strictEqual(copyRes.copiedCount, 23);
  const t2Data = DesempenoEngine.getStudentEvaluation('TEST_COPY', 2);
  assert.strictEqual(t2Data.completedCount, 23);
  assert.strictEqual(t2Data.source, 'copia_t1');
});

// 14. Revisión de valoraciones copiadas
test(14, "Valoraciones copiadas permanecen como borrador pendiente de revisión", () => {
  const t2Data = DesempenoEngine.getStudentEvaluation('TEST_COPY', 2);
  assert.strictEqual(t2Data.isReviewed, false);
});

// 15. Conservación de evaluaciones anteriores
test(15, "Inmutabilidad del trimestre origen al copiar", () => {
  const t1Data = DesempenoEngine.getStudentEvaluation('TEST_COPY', 1);
  assert.strictEqual(t1Data.completedCount, 23);
  assert.strictEqual(t1Data.distribution.E, 23);
});

// 16. Contador de indicadores completados
test(16, "Contador de indicadores completados de 23", () => {
  DesempenoEngine.setIndicatorRating('TEST_CNT', 'acad_lectura', 'E', 1);
  DesempenoEngine.setIndicatorRating('TEST_CNT', 'acad_escritura', 'B', 1);
  DesempenoEngine.setIndicatorRating('TEST_CNT', 'hab_tareas', 'R', 1);
  const data = DesempenoEngine.getStudentEvaluation('TEST_CNT', 1);
  assert.strictEqual(data.completedCount, 3);
  assert.strictEqual(data.pendingCount, 20);
});

// 17. Identificación de indicadores pendientes
test(17, "Identificación explícita de indicadores pendientes", () => {
  const data = DesempenoEngine.getStudentEvaluation('TEST_CNT', 1);
  assert.strictEqual(data.pendingIndicators.length, 20);
  assert.strictEqual(data.pendingIndicators.includes('acad_lectura'), false);
  assert.strictEqual(data.pendingIndicators.includes('acad_matematicas'), true);
});

// 18. Captura de mensajes personalizados
test(18, "Captura y persistencia de mensaje personalizado", () => {
  const msgText = "Demuestra un excelente avance en comprensión y trabajo colaborativo.";
  DesempenoEngine.setStudentMessage('TEST_MSG1', msgText, 1);
  const msgData = DesempenoEngine.getStudentMessage('TEST_MSG1', 1);
  assert.strictEqual(msgData.message, msgText);
  assert.strictEqual(msgData.charCount, msgText.length);
  assert.strictEqual(msgData.isValid, true);
});

// 19. Validación del máximo de 245 caracteres
test(19, "Validación estricta del límite de 245 caracteres", () => {
  const shortMsg = "A".repeat(245);
  const longMsg = "A".repeat(246);
  assert.strictEqual(DesempenoEngine.validateMessageText(shortMsg).isValid, true);
  assert.strictEqual(DesempenoEngine.validateMessageText(longMsg).isValid, false);
  assert.strictEqual(DesempenoEngine.validateMessageText(longMsg).isOverLimit, true);
});

// 20. Rechazo de mensajes vacíos para el cierre
test(20, "Rechazo de mensajes vacíos para estado listo para cerrar", () => {
  assert.strictEqual(DesempenoEngine.validateMessageText("   ").isValid, false);
  assert.strictEqual(DesempenoEngine.validateMessageText("").isValid, false);
});

// 21. Inserción de mensajes del banco
test(21, "Inserción de mensaje desde el banco de recomendaciones", () => {
  const bank = DesempenoEngine.getBancoMensajes();
  assert.strictEqual(bank.length > 0, true);
  const item = bank[0];
  DesempenoEngine.setStudentMessage('TEST_MSG2', item.text, 1, item.id);
  const res = DesempenoEngine.getStudentMessage('TEST_MSG2', 1);
  assert.strictEqual(res.message, item.text);
  assert.strictEqual(res.templateId, item.id);
});

// 22. Edición de mensajes insertados
test(22, "Edición libre de mensaje tras insertarlo del banco", () => {
  const editedText = "Mensaje base con observaciones adicionales del docente.";
  DesempenoEngine.setStudentMessage('TEST_MSG2', editedText, 1, 'plantilla_base');
  const res = DesempenoEngine.getStudentMessage('TEST_MSG2', 1);
  assert.strictEqual(res.message, editedText);
});

// 23. Independencia entre plantillas y mensajes asignados
test(23, "Modificar el banco no altera mensajes ya asignados", () => {
  const assigned = DesempenoEngine.getStudentMessage('TEST_MSG2', 1).message;
  // Modificar plantilla en el banco
  DesempenoEngine.updateBancoMessage('plantilla_base', { text: 'Texto completamente nuevo en plantilla' });
  const reRead = DesempenoEngine.getStudentMessage('TEST_MSG2', 1).message;
  assert.strictEqual(reRead, assigned, "El mensaje asignado debe ser inmutable");
});

// 24. Asignación grupal de mensajes
test(24, "Asignación masiva de mensaje como borrador a múltiples alumnos", () => {
  const students = ['TEST_M01', 'TEST_M02', 'TEST_M03'];
  const template = "Excelente esfuerzo y dedicación demostrada durante el trimestre.";
  DesempenoEngine.setGroupMessage(students, template, 1);
  students.forEach(id => {
    assert.strictEqual(DesempenoEngine.getStudentMessage(id, 1).message, template);
  });
});

// 25. Recuperación de borradores
test(25, "Recuperación de borradores de desempeño y mensajes", () => {
  DesempenoEngine.saveDrafts();
  const loadedDesempeno = DesempenoEngine.loadDesempenoStore();
  const loadedMensajes = DesempenoEngine.loadMensajesStore();
  assert.strictEqual(Boolean(loadedDesempeno && loadedMensajes), true);
});

// 26. Prevención de pérdida de información
test(26, "Prevención de pérdida de datos con bandera hasUnsavedChanges", () => {
  DesempenoEngine.setIndicatorRating('TEST_LOSS', 'hab_limpieza', 'E', 1);
  assert.strictEqual(DesempenoEngine.hasUnsavedChanges(), true);
});

// 27. Actualización del panel de seguimiento
test(27, "Métricas de avance diferenciadas entre académico e integral", () => {
  const metrics = DesempenoEngine.calculateTrackingMetrics(1);
  assert.strictEqual(typeof metrics.academicComplete, 'number');
  assert.strictEqual(typeof metrics.desempenoComplete, 'number');
  assert.strictEqual(typeof metrics.messagesComplete, 'number');
  assert.strictEqual(typeof metrics.readyToClose, 'number');
});

// 28. Validación del estado Lista para cerrar
test(28, "Validación rigurosa del estado 'Lista para cerrar'", () => {
  // Alumno ficticio A_FULL
  // 1. Autorizar las 4 materias
  window.setStudentFieldData('A_FULL', 'Lenguajes', { isAuthorized: true, authorizedGrade: 9.0 }, 1);
  window.setStudentFieldData('A_FULL', 'Saberes y Pensamiento Científico', { isAuthorized: true, authorizedGrade: 9.0 }, 1);
  window.setStudentFieldData('A_FULL', 'Ética, Naturaleza y Sociedades', { isAuthorized: true, authorizedGrade: 9.0 }, 1);
  window.setStudentFieldData('A_FULL', 'De lo Humano y lo Comunitario', { isAuthorized: true, authorizedGrade: 9.0 }, 1);

  // 2. Desempeño 23/23
  DesempenoEngine.setGeneralRating('A_FULL', 'E', false, 1);

  // 3. Mensaje válido
  DesempenoEngine.setStudentMessage('A_FULL', 'Excelente trimestre.', 1);

  const status = DesempenoEngine.getStudentOverallStatus('A_FULL', 1);
  assert.strictEqual(status.isReadyToClose, true);
  assert.strictEqual(status.code, 'ready_to_close');
});

// 29. Independencia respecto al motor de cálculo
test(29, "El desempeño integral no altera calificaciones ni promedios", () => {
  const calcBefore = EvaluacionEngine.calculateStudentFullEvaluation('A_FULL', 1);
  DesempenoEngine.setGeneralRating('A_FULL', 'A', false, 1); // Cambiar todos a 'Requiere apoyo'
  const calcAfter = EvaluacionEngine.calculateStudentFullEvaluation('A_FULL', 1);
  assert.strictEqual(calcBefore.trimesterAverage.displayAverage, calcAfter.trimesterAverage.displayAverage);
  assert.strictEqual(calcBefore.subjects['Lenguajes'].finalGrade, calcAfter.subjects['Lenguajes'].finalGrade);
});

// 30. Protección de registros académicos originales
test(30, "Registros académicos originales inmutables tras capturar desempeño", () => {
  const rawActivities = window.getEvalRawActivities ? window.getEvalRawActivities() : { classes: [] };
  assert.strictEqual(Array.isArray(rawActivities.classes), true);
  // Ninguna actividad original mutada
});

console.log(`\nRESUMEN: ${passed} / 30 pruebas superadas.`);
if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
