/**
 * SUITE DE PRUEBAS UNITARIAS: ACTIVACIÓN Y VERIFICACIÓN DE PERSISTENCIA
 * ETAPA 7A.3 — Carpeta Académica
 * 
 * Verifica rigurosamente:
 * 1. Supresión de trimestre || 1: rechazo estricto de nulos, falsy, decimales y malformados.
 * 2. Consultas ignoran lotes no consolidados (incluso sin versión previa).
 * 3. Escritura y recuperación de versión consolidada V1.
 * 4. Actualización parcial y conservación de ponderaciones, configuraciones, actividades y exclusiones previas.
 * 5. Idempotencia ante reintentos con mismo batchId y rechazo de reintentos inconsistentes.
 * 6. Detección y rechazo de conflictos de versión (control de concurrencia).
 */

const assert = require('assert');
const fs = require('fs');

// Cargar código de EvaluacionesTrimestrales.gs.txt
const evalCode = fs.readFileSync('EvaluacionesTrimestrales.gs.txt', 'utf8');

// Tablas en memoria simulando Google Sheets
let sheetsData = {
  Alumnos: [
    { id: 'ALU-1', numeroLista: 1, nombre: 'García Pérez Juan', estatus: 'ACTIVO', grupo: '4A' },
    { id: 'ALU-2', numeroLista: 2, nombre: 'López Morales Ana', estatus: 'ACTIVO', grupo: '4A' }
  ],
  EvalConfig: [],
  EvalActividades: [],
  EvalCalificaciones: [],
  EvalDesempeno: [],
  EvalMensajes: [],
  EvalBancoRecomendaciones: [],
  EvalVersiones: []
};

// Funciones globales simuladas de Database.gs y Apps Script
global.readRows_ = function (tableName) {
  return (sheetsData[tableName] || []).map(r => Object.assign({}, r));
};

global.upsertObjectsBatch_ = function (tableName, objects, idKey) {
  if (!sheetsData[tableName]) sheetsData[tableName] = [];
  objects.forEach(obj => {
    var key = idKey || 'id';
    var idx = sheetsData[tableName].findIndex(r => String(r[key]) === String(obj[key]));
    if (idx >= 0) {
      sheetsData[tableName][idx] = Object.assign({}, obj);
    } else {
      sheetsData[tableName].push(Object.assign({}, obj));
    }
  });
};

global.appendObjects_ = function (tableName, objects) {
  if (!sheetsData[tableName]) sheetsData[tableName] = [];
  objects.forEach(obj => sheetsData[tableName].push(Object.assign({}, obj)));
};

global.now_ = function () {
  return new Date().toISOString();
};

global.SpreadsheetApp = {
  flush: function () {}
};

global.Session = {
  getScriptTimeZone: function () { return 'America/Cancun'; }
};

global.Utilities = {
  computeDigest: function (algo, str) {
    var crypto = require('crypto');
    var hash = crypto.createHash('sha256').update(str).digest();
    return Array.from(hash);
  },
  base64Encode: function (bytes) {
    return Buffer.from(bytes).toString('base64');
  },
  DigestAlgorithm: { SHA_256: 'SHA_256' },
  Charset: { UTF_8: 'UTF_8' }
};

global.LockService = {
  getScriptLock: function () {
    return {
      tryLock: function () { return true; },
      releaseLock: function () {}
    };
  }
};

global.validarSesion_ = function (token) {
  if (token === 'VALID_TOKEN_DOCENTE') {
    return { ok: true, usuario: 'docente_titular_4a', grupo: '4A', cicloEscolar: '2026-2027' };
  }
  return { ok: false, error: 'Token inválido' };
};

// Catálogo canónico de tablas
global.DB_EVALUACIONES = {
  EvalConfig: ['id', 'cicloEscolar', 'grupo', 'trimestre', 'fechaInicio', 'fechaFin', 'estadoPeriodo', 'ponderacionesJson', 'valoresTareasJson', 'valoresConductaJson', 'valoresParticipacionJson', 'configAsistenciaJson', 'ajustesAdminJson', 'batchId', 'version', 'actualizadoEn', 'actualizadoPor'],
  EvalActividades: ['id', 'cicloEscolar', 'grupo', 'trimestre', 'campoFormativo', 'criterio', 'actividadId', 'tipoActividad', 'fechaActividad', 'nombreActividad', 'seleccionada', 'peso', 'exclusionesAlumnosJson', 'batchId', 'version', 'actualizadoEn', 'actualizadoPor'],
  EvalCalificaciones: ['id', 'cicloEscolar', 'grupo', 'trimestre', 'alumnoId', 'numeroLista', 'campoFormativo', 'modalidad', 'desgloseAutoJson', 'desgloseManualJson', 'examenGrade', 'configAplicadaJson', 'actividadesRefJson', 'calcGradeOriginal', 'calcGradePreliminar', 'ajusteManual', 'motivoAjuste', 'authorizedGrade', 'status', 'authorizedAt', 'authorizedPor', 'batchId', 'estadoConsolidacion', 'version', 'actualizadoEn', 'actualizadoPor'],
  EvalDesempeno: ['id', 'cicloEscolar', 'grupo', 'trimestre', 'alumnoId', 'numeroLista', 'indicadorId', 'valoracion', 'catalogoVersion', 'estadoRevision', 'origen', 'trimestreOrigen', 'batchId', 'estadoConsolidacion', 'version', 'actualizadoEn', 'actualizadoPor'],
  EvalMensajes: ['id', 'cicloEscolar', 'grupo', 'trimestre', 'alumnoId', 'numeroLista', 'mensaje', 'caracteres', 'templateId', 'estadoRevision', 'batchId', 'estadoConsolidacion', 'version', 'actualizadoEn', 'actualizadoPor'],
  EvalBancoRecomendaciones: ['id', 'categoria', 'campoFormativo', 'nivel', 'texto', 'caracteres', 'estadoAprobacion', 'activo', 'creadoEn', 'actualizadoEn', 'actualizadoPor', 'version', 'recomendacionId', 'loteVersionId'],
  EvalVersiones: ['id', 'cicloEscolar', 'grupo', 'trimestre', 'alumnoId', 'tipoOperacion', 'batchId', 'versionAnterior', 'versionNueva', 'motivoModificacion', 'snapshotJson', 'payloadHash', 'creadoEn', 'usuario', 'estadoConsolidacion']
};

// Cargar y evaluar EvaluacionesTrimestrales.gs.txt en el contexto global
eval(evalCode);

console.log('--- INICIO DE PRUEBAS: ACTIVACIÓN Y VERIFICACIÓN DE PERSISTENCIA ---');

const TOKEN = 'VALID_TOKEN_DOCENTE';

// ============================================================================
// PRUEBA 1: Supresión de trimestre || 1 en getTrimesterEvaluationBundle y syncTrimesterEvaluationBatch
// ============================================================================
console.log('\n[PRUEBA 1] Supresión de valores por defecto permisivos (trimestre || 1)');

// 1.1 getTrimesterEvaluationBundle sin trimestre o con valores inválidos
assert.throws(() => getTrimesterEvaluationBundle({ cicloEscolar: '2026-2027', grupo: '4A' }, TOKEN), /TRIMESTRE_INVALIDO/i);
assert.throws(() => getTrimesterEvaluationBundle({ cicloEscolar: '2026-2027', grupo: '4A', trimestre: null }, TOKEN), /TRIMESTRE_INVALIDO/i);
assert.throws(() => getTrimesterEvaluationBundle({ cicloEscolar: '2026-2027', grupo: '4A', trimestre: 0 }, TOKEN), /TRIMESTRE_INVALIDO/i);
assert.throws(() => getTrimesterEvaluationBundle({ cicloEscolar: '2026-2027', grupo: '4A', trimestre: false }, TOKEN), /TRIMESTRE_INVALIDO/i);
assert.throws(() => getTrimesterEvaluationBundle({ cicloEscolar: '2026-2027', grupo: '4A', trimestre: 1.5 }, TOKEN), /TRIMESTRE_INVALIDO/i);
assert.throws(() => getTrimesterEvaluationBundle({ cicloEscolar: '2026-2027', grupo: '4A', trimestre: '1abc' }, TOKEN), /TRIMESTRE_INVALIDO/i);
console.log('  ✓ 1.1 getTrimesterEvaluationBundle rechaza estrictamente cualquier trimestre no entero en [1, 2, 3]');

// 1.2 syncTrimesterEvaluationBatch sin trimestre o con valores inválidos
assert.throws(() => syncTrimesterEvaluationBatch({ batchId: 'B1', cicloEscolar: '2026-2027', grupo: '4A', baseVersion: 0 }, TOKEN), /TRIMESTRE_INVALIDO/i);
assert.throws(() => syncTrimesterEvaluationBatch({ batchId: 'B1', cicloEscolar: '2026-2027', grupo: '4A', trimestre: null, baseVersion: 0 }, TOKEN), /TRIMESTRE_INVALIDO/i);
assert.throws(() => syncTrimesterEvaluationBatch({ batchId: 'B1', cicloEscolar: '2026-2027', grupo: '4A', trimestre: 0, baseVersion: 0 }, TOKEN), /TRIMESTRE_INVALIDO/i);
assert.throws(() => syncTrimesterEvaluationBatch({ batchId: 'B1', cicloEscolar: '2026-2027', grupo: '4A', trimestre: 4, baseVersion: 0 }, TOKEN), /TRIMESTRE_INVALIDO/i);
console.log('  ✓ 1.2 syncTrimesterEvaluationBatch rechaza estrictamente cualquier trimestre inválido');

// ============================================================================
// PRUEBA 2: Consultas ignoran lotes no consolidados (incluso sin versión previa)
// ============================================================================
console.log('\n[PRUEBA 2] Consultas ignoran lotes no consolidados (estado inicial sin versión)');

// Simular filas residuales o en preparación en EvalConfig y EvalActividades
sheetsData.EvalConfig = [{
  id: '2026-2027_4A_T1_BATCH_NO_CONSOLIDADO',
  cicloEscolar: '2026-2027',
  grupo: '4A',
  trimestre: 1,
  batchId: 'BATCH_NO_CONSOLIDADO',
  ponderacionesJson: JSON.stringify({ tareas: 99 }),
  version: 1
}];

sheetsData.EvalActividades = [{
  id: '2026-2027_4A_T1_BATCH_NO_CONSOLIDADO_Lenguajes_general_act1',
  cicloEscolar: '2026-2027',
  grupo: '4A',
  trimestre: 1,
  campoFormativo: 'Lenguajes',
  actividadId: 'act1',
  batchId: 'BATCH_NO_CONSOLIDADO',
  exclusionesAlumnosJson: JSON.stringify(['ALU-1'])
}];

// EvalVersiones está vacío (no hay lote consolidado)
sheetsData.EvalVersiones = [];

const bundleInicial = getTrimesterEvaluationBundle({ cicloEscolar: '2026-2027', grupo: '4A', trimestre: 1 }, TOKEN);
assert.strictEqual(bundleInicial.ok, true);
assert.strictEqual(bundleInicial.data.versionVigente, 0, 'versionVigente debe ser 0');
assert.strictEqual(bundleInicial.data.batchIdVigente, null, 'batchIdVigente debe ser null');
assert.strictEqual(bundleInicial.data.config, null, 'config debe ser null (ignora lote no consolidado)');
assert.strictEqual(bundleInicial.data.actividades.length, 0, 'actividades debe ser [] (ignora lote no consolidado)');
assert.strictEqual(bundleInicial.data.calificaciones.length, 0);
console.log('  ✓ 2.1 getTrimesterEvaluationBundle ignora registros de lotes no consolidados cuando no hay versión');

// ============================================================================
// PRUEBA 3: Escritura y consolidación de la versión 1 (V1)
// ============================================================================
console.log('\n[PRUEBA 3] Escritura y consolidación de versión 1 (V1)');

// 23 indicadores canónicos para ALU-1 y ALU-2
const ratingsCompletos = {
  acad_lectura: 'E', acad_escritura: 'E', acad_matematicas: 'B', acad_contenidos: 'B',
  hab_tareas: 'E', hab_actividades: 'E', hab_completos: 'B', hab_materiales: 'B',
  hab_limpieza: 'E', hab_indicaciones: 'E', hab_autonomia: 'B', hab_concentracion: 'B', hab_participacion: 'E',
  cond_companeros: 'E', cond_docente: 'E', cond_acuerdos: 'B', cond_autorregulacion: 'B',
  cond_conflictos: 'E', cond_colaborativo: 'E', cond_actitud: 'B', cond_mobiliario: 'B',
  asis_regular: 'E', asis_puntualidad: 'E'
};

const payloadV1 = {
  batchId: 'BATCH_2026_T1_V1',
  cicloEscolar: '2026-2027',
  grupo: '4A',
  trimestre: 1,
  baseVersion: 0,
  config: {
    fechaInicio: '2026-09-01',
    fechaFin: '2026-11-30',
    estadoPeriodo: 'activo',
    ponderaciones: { tareas: 50, examen: 30, proyectos: 20 },
    valoresTareas: { entregaPuntual: 10, calidad: 10 }
  },
  actividades: [
    {
      campoFormativo: 'Lenguajes',
      criterio: 'tareas',
      actividadId: 'ACT-001',
      nombreActividad: 'Ensayo literario',
      peso: 1.5,
      exclusionesAlumnos: ['ALU-2']
    }
  ],
  calificaciones: [
    { alumnoId: 'ALU-1', campoFormativo: 'Lenguajes', calcGradeOriginal: 9.5, authorizedGrade: 9.5, status: 'AUTORIZADA' },
    { alumnoId: 'ALU-2', campoFormativo: 'Lenguajes', calcGradeOriginal: 8.0, authorizedGrade: 8.0, status: 'AUTORIZADA' }
  ],
  desempeno: [
    { alumnoId: 'ALU-1', ratings: ratingsCompletos, isReviewed: true },
    { alumnoId: 'ALU-2', ratings: ratingsCompletos, isReviewed: true }
  ],
  mensajes: [
    { alumnoId: 'ALU-1', mensaje: 'Excelente desempeño y constancia en el trabajo escolar.' },
    { alumnoId: 'ALU-2', mensaje: 'Buen rendimiento académico y compromiso en el aula.' }
  ]
};

const resV1 = syncTrimesterEvaluationBatch(payloadV1, TOKEN);
assert.strictEqual(resV1.ok, true);
assert.strictEqual(resV1.data.version, 1);
assert.strictEqual(resV1.data.batchId, 'BATCH_2026_T1_V1');
console.log('  ✓ 3.1 syncTrimesterEvaluationBatch consolida versión 1 exitosamente');

// Consultar V1 con getTrimesterEvaluationBundle
const bundleV1 = getTrimesterEvaluationBundle({ cicloEscolar: '2026-2027', grupo: '4A', trimestre: 1 }, TOKEN);
assert.strictEqual(bundleV1.ok, true);
assert.strictEqual(bundleV1.data.versionVigente, 1);
assert.strictEqual(bundleV1.data.batchIdVigente, 'BATCH_2026_T1_V1');
assert.ok(bundleV1.data.config !== null);
assert.strictEqual(bundleV1.data.config.ponderaciones.tareas, 50);
assert.strictEqual(bundleV1.data.config.valoresTareas.entregaPuntual, 10);
assert.strictEqual(bundleV1.data.actividades.length, 1);
assert.deepStrictEqual(bundleV1.data.actividades[0].exclusionesAlumnos, ['ALU-2']);
assert.strictEqual(bundleV1.data.calificaciones.length, 2);
console.log('  ✓ 3.2 getTrimesterEvaluationBundle recupera V1 con propiedades JSON deserializadas');

// ============================================================================
// PRUEBA 4: Guardado parcial y conservación de datos previos
// ============================================================================
console.log('\n[PRUEBA 4] Guardado parcial: conservación de config, ponderaciones, actividades y exclusiones');

// Payload V2 parcial: SOLO actualiza la calificación de ALU-1 en Saberes y Pensamiento Científico
// NO incluye config ni actividades, ni calificaciones de ALU-2
const payloadV2Parcial = {
  batchId: 'BATCH_2026_T1_V2',
  cicloEscolar: '2026-2027',
  grupo: '4A',
  trimestre: 1,
  baseVersion: 1,
  calificaciones: [
    { alumnoId: 'ALU-1', campoFormativo: 'Saberes y Pensamiento Científico', calcGradeOriginal: 10.0, authorizedGrade: 10.0, status: 'AUTORIZADA' }
  ]
};

const resV2 = syncTrimesterEvaluationBatch(payloadV2Parcial, TOKEN);
assert.strictEqual(resV2.ok, true);
assert.strictEqual(resV2.data.version, 2);
assert.strictEqual(resV2.data.batchId, 'BATCH_2026_T1_V2');
console.log('  ✓ 4.1 Guardado parcial consolidado a versión 2');

// Consultar V2 con getTrimesterEvaluationBundle
const bundleV2 = getTrimesterEvaluationBundle({ cicloEscolar: '2026-2027', grupo: '4A', trimestre: 1 }, TOKEN);
assert.strictEqual(bundleV2.data.versionVigente, 2);
assert.strictEqual(bundleV2.data.batchIdVigente, 'BATCH_2026_T1_V2');

// Verificar conservación de config y ponderaciones
assert.ok(bundleV2.data.config !== null, 'config no debe ser nulo en guardado parcial');
assert.strictEqual(bundleV2.data.config.ponderaciones.tareas, 50, 'ponderaciones.tareas debe conservarse en 50');
assert.strictEqual(bundleV2.data.config.ponderaciones.examen, 30, 'ponderaciones.examen debe conservarse en 30');
assert.strictEqual(bundleV2.data.config.valoresTareas.entregaPuntual, 10, 'valoresTareas debe conservarse');

// Verificar conservación de actividades y exclusiones
assert.strictEqual(bundleV2.data.actividades.length, 1, 'actividades debe conservarse');
assert.strictEqual(bundleV2.data.actividades[0].actividadId, 'ACT-001');
assert.deepStrictEqual(bundleV2.data.actividades[0].exclusionesAlumnos, ['ALU-2'], 'exclusionesAlumnos debe conservarse');

// Verificar conservación de calificaciones previas (fusión de grupo)
assert.strictEqual(bundleV2.data.calificaciones.length, 3, 'deben existir 3 calificaciones (2 previas de lenguajes + 1 nueva de saberes)');
assert.ok(bundleV2.data.calificaciones.some(c => c.alumnoId === 'ALU-2' && c.campoFormativo === 'Lenguajes'), 'ALU-2 en Lenguajes se conservó');
assert.ok(bundleV2.data.calificaciones.some(c => c.alumnoId === 'ALU-1' && c.campoFormativo === 'Saberes y Pensamiento Científico'), 'ALU-1 en Saberes agregado');

// Verificar conservación de desempeño y mensajes de ambos alumnos
assert.strictEqual(bundleV2.data.desempeno.length, 2, 'desempeño de ambos alumnos conservado');
assert.strictEqual(bundleV2.data.mensajes.length, 2, 'mensajes de ambos alumnos conservados');
console.log('  ✓ 4.2 Guardado parcial conservó 100% de ponderaciones, exclusiones, actividades y alumnos previos');

// ============================================================================
// PRUEBA 5: Idempotencia y control de concurrencia
// ============================================================================
console.log('\n[PRUEBA 5] Idempotencia y control de concurrencia');

// 5.1 Reintento con mismo batchId y mismo payload
const resReintento = syncTrimesterEvaluationBatch(payloadV2Parcial, TOKEN);
assert.strictEqual(resReintento.ok, true);
assert.strictEqual(resReintento.data.idempotent, true);
assert.strictEqual(resReintento.data.version, 2);
console.log('  ✓ 5.1 Reintento idempotente reconocido con éxito (sin duplicación)');

// 5.2 Conflicto de versión (baseVersion desfasada)
const payloadDesfasado = {
  batchId: 'BATCH_2026_T1_V_DESFASADO',
  cicloEscolar: '2026-2027',
  grupo: '4A',
  trimestre: 1,
  baseVersion: 1, // El servidor ya está en versión 2
  calificaciones: [
    { alumnoId: 'ALU-1', campoFormativo: 'Lenguajes', calcGradeOriginal: 10.0, authorizedGrade: 10.0, status: 'AUTORIZADA' }
  ]
};

assert.throws(() => syncTrimesterEvaluationBatch(payloadDesfasado, TOKEN), /CONFLICTO_VERSION/i);
console.log('  ✓ 5.2 Rechazo correcto de concurrencia ante baseVersion desfasada (CONFLICTO_VERSION)');

// 5.3 Reintento inconsistente (mismo batchId con payload alterado)
const payloadInconsistente = Object.assign({}, payloadV2Parcial, {
  calificaciones: [
    { alumnoId: 'ALU-1', campoFormativo: 'Saberes y Pensamiento Científico', calcGradeOriginal: 5.0, authorizedGrade: 5.0, status: 'AUTORIZADA' }
  ]
});
assert.throws(() => syncTrimesterEvaluationBatch(payloadInconsistente, TOKEN), /CONFLICTO_REINTENTO_INCONSISTENTE/i);
console.log('  ✓ 5.3 Rechazo de reintento inconsistente con mismo batchId pero hash diferente');

console.log('\n=== TODAS LAS PRUEBAS DE PERSISTENCIA Y BUNDLE PASARON EXITOSAMENTE (100%) ===\n');
