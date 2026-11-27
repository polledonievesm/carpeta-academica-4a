/**
 * ============================================================================
 * PRUEBAS FOCALIZADAS OBLIGATORIAS — ETAPA 7A.3 (RESOLUCIÓN FINAL DE BLOQUEOS)
 * ============================================================================
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('============================================================');
console.log('EJECUTANDO SUITE DE PRUEBAS FOCALIZADAS — ETAPA 7A.3 V3');
console.log('============================================================\n');

// 1. Simulación de entorno Google Apps Script en Node.js
global.Utilities = {
  DigestAlgorithm: { SHA_256: 'SHA_256' },
  Charset: { UTF_8: 'UTF_8' },
  computeDigest: function (alg, str) {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(str, 'utf8').digest();
    return Array.from(hash).map(b => (b > 127 ? b - 256 : b));
  }
};

let scriptLockAcquired = false;
global.LockService = {
  getScriptLock: function () {
    return {
      tryLock: function (timeout) {
        scriptLockAcquired = true;
        return true;
      },
      releaseLock: function () {
        scriptLockAcquired = false;
      }
    };
  }
};

global.SpreadsheetApp = {
  getActiveSpreadsheet: function () {
    return {
      getSheetByName: function () { return null; },
      insertSheet: function () {
        return {
          getRange: function () { return { setValues: function () {}, setFontWeight: function () {} }; },
          setFrozenRows: function () {},
          getLastColumn: function () { return 0; }
        };
      },
      flush: function () {}
    };
  }
};

// Cargar EvaluacionesTrimestrales.gs.txt
const evalCode = fs.readFileSync('EvaluacionesTrimestrales.gs.txt', 'utf8');
eval(evalCode);

let passed = 0;
let total = 0;

function runTest(num, name, fn) {
  total++;
  try {
    fn();
    console.log(`[PASS] Prueba ${num}: ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] Prueba ${num}: ${name} -> ${err.message}`);
  }
}

// PRUEBA 01: Rechazo por defecto si validarSesionDocenteAutentica_ no existe
runTest('01', 'Rechazo por defecto estricto (Zero-Trust) sin validador', () => {
  delete global.validarSesionDocenteAutentica_;
  assert.throws(() => {
    validateTeacherAuth_('TOKEN_CUALQUIERA', '4A');
  }, /SECURITY_REJECT_DEFAULT/);
});

// PRUEBA 02: Aceptación y extracción de identidad desde la sesión del servidor
runTest('02', 'Extracción de identidad responsable exclusivamente desde session.usuario', () => {
  global.validarSesionDocenteAutentica_ = function (token, group) {
    if (token === 'DOCENTE_VALIDO_OK' && group === '4A') {
      return { ok: true, usuario: 'profesor_titular_4a', rol: 'docente' };
    }
    return null;
  };
  const session = validateTeacherAuth_('DOCENTE_VALIDO_OK', '4A');
  assert.strictEqual(session.usuario, 'profesor_titular_4a');
});

// PRUEBA 03: Validación estricta de baseVersion sin conversiones parciales ni decimales
runTest('03', 'Validación estricta de baseVersion entera (sin decimales ni 2abc)', () => {
  assert.strictEqual(validateStrictIntegerVersion_(0), 0);
  assert.strictEqual(validateStrictIntegerVersion_(5), 5);
  assert.strictEqual(validateStrictIntegerVersion_('3'), 3);
  // Rechazo de decimales
  assert.throws(() => validateStrictIntegerVersion_(2.5), /no se aceptan números decimales/);
  // Rechazo de conversiones parciales
  assert.throws(() => validateStrictIntegerVersion_('2abc'), /no se aceptan conversiones parciales/);
  // Rechazo de negativos
  assert.throws(() => validateStrictIntegerVersion_(-1), /no negativo/);
});

// PRUEBA 04: Control de versiones exige coincidencia EXACTA con la última consolidada
runTest('04', 'Exigencia de coincidencia EXACTA entre baseVersion y última versión consolidada', () => {
  global.readRows_ = function (name) {
    if (name === 'EvalVersiones') {
      return [{
        cicloEscolar: '2026-2027', grupo: '4A', trimestre: 1,
        versionNueva: 3, batchId: 'batch_003', estadoConsolidacion: 'consolidado'
      }];
    }
    return [];
  };

  // Versión inferior (2 !== 3) debe ser rechazada
  assert.throws(() => {
    syncTrimesterEvaluationBatch({
      cicloEscolar: '2026-2027', grupo: '4A', trimestre: 1,
      batchId: 'batch_004', baseVersion: 2,
      calificaciones: []
    }, 'DOCENTE_VALIDO_OK');
  }, /CONFLICTO_VERSION/);

  // Versión superior (4 !== 3) también debe ser rechazada
  assert.throws(() => {
    syncTrimesterEvaluationBatch({
      cicloEscolar: '2026-2027', grupo: '4A', trimestre: 1,
      batchId: 'batch_004', baseVersion: 4,
      calificaciones: []
    }, 'DOCENTE_VALIDO_OK');
  }, /CONFLICTO_VERSION/);
});

// PRUEBA 05: Hash en servidor incluye los 7 componentes que se modifican
runTest('05', 'Cálculo de hash de integridad en servidor cubre los 7 componentes modificados', () => {
  const basePayload = {
    cicloEscolar: '2026-2027', grupo: '4A', trimestre: 1,
    config: { fechaInicio: '2026-09-01' },
    actividades: [{ actividadId: 'act1', campoFormativo: 'Lenguajes' }],
    calificaciones: [{ alumnoId: 'A001', campoFormativo: 'Lenguajes', examenGrade: 9.0 }],
    desempeno: [{ alumnoId: 'A001', ratings: { acad_lectura: 'E' } }],
    mensajes: [{ alumnoId: 'A001', mensaje: 'Buen trabajo' }],
    bancoRecomendaciones: [{ texto: 'Recomendación 1' }]
  };
  const hash1 = computeBundleIntegrityHash_(basePayload);
  assert.strictEqual(hash1.length, 64);

  // Modificar banco de recomendaciones debe alterar el hash
  const payloadModBanco = JSON.parse(JSON.stringify(basePayload));
  payloadModBanco.bancoRecomendaciones[0].texto = 'Recomendación modificada';
  const hash2 = computeBundleIntegrityHash_(payloadModBanco);
  assert.notStrictEqual(hash1, hash2, 'Modificación en bancoRecomendaciones debe alterar el hash');

  // Modificar actividades debe alterar el hash
  const payloadModAct = JSON.parse(JSON.stringify(basePayload));
  payloadModAct.actividades[0].actividadId = 'act2';
  const hash3 = computeBundleIntegrityHash_(payloadModAct);
  assert.notStrictEqual(hash1, hash3, 'Modificación en actividades debe alterar el hash');
});

// PRUEBA 06: Concurrencia utiliza evalWithScriptLock_ (ScriptLock)
runTest('06', 'Uso de ScriptLock compatible con Web App sin bloqueos anidados', () => {
  let executed = false;
  const res = evalWithScriptLock_(() => {
    executed = true;
    return 'EXITO_LOCK';
  });
  assert.strictEqual(res, 'EXITO_LOCK');
  assert.strictEqual(executed, true);
  assert.strictEqual(scriptLockAcquired, false, 'El lock debe liberarse en el bloque finally');
});

// PRUEBA 07: Fusión de alumnos al guardar alumno individual para no perder a los demás
runTest('07', 'Guardado individual de alumno fusiona y preserva al resto de los alumnos', () => {
  const writtenRows = {};
  global.upsertObjectsBatch_ = function (name, batch) {
    writtenRows[name] = batch;
  };
  global.appendObjects_ = function (name, batch) {
    writtenRows[name] = batch;
  };

  // Simular que en la versión V1 ('batch_001') existen los alumnos A001 y A002
  global.readRows_ = function (name) {
    if (name === 'EvalVersiones') {
      return [{
        cicloEscolar: '2026-2027', grupo: '4A', trimestre: 1,
        versionNueva: 1, batchId: 'batch_001', estadoConsolidacion: 'consolidado'
      }];
    }
    if (name === 'EvalCalificaciones') {
      return [
        { batchId: 'batch_001', alumnoId: 'A001', campoFormativo: 'Lenguajes', examenGrade: 8.0 },
        { batchId: 'batch_001', alumnoId: 'A002', campoFormativo: 'Lenguajes', examenGrade: 9.0 }
      ];
    }
    return [];
  };

  // Guardar ÚNICAMENTE al alumno A001 con nueva calificación (10.0) en V2
  const res = syncTrimesterEvaluationBatch({
    cicloEscolar: '2026-2027', grupo: '4A', trimestre: 1,
    batchId: 'batch_002', baseVersion: 1,
    calificaciones: [
      { alumnoId: 'A001', campoFormativo: 'Lenguajes', examenGrade: 10.0 }
    ]
  }, 'DOCENTE_VALIDO_OK');

  assert.strictEqual(res.ok, true);
  const batchCalif = writtenRows['EvalCalificaciones'];
  assert.strictEqual(batchCalif.length, 2, 'El lote debe conservar ambos alumnos');
  const a1 = batchCalif.find(c => c.alumnoId === 'A001');
  const a2 = batchCalif.find(c => c.alumnoId === 'A002');
  assert.strictEqual(a1.examenGrade, 10.0, 'A001 debe tener la nueva calificación');
  assert.strictEqual(a2.examenGrade, 9.0, 'A002 debe conservar su calificación previa intacta');
});

// PRUEBA 08: Recuperación de banco de recomendaciones y datos consolidados en bundle
runTest('08', 'getTrimesterEvaluationBundle recupera banco de recomendaciones y datos consolidados', () => {
  global.readRows_ = function (name) {
    if (name === 'EvalVersiones') {
      return [{
        cicloEscolar: '2026-2027', grupo: '4A', trimestre: 1,
        versionNueva: 1, batchId: 'batch_001', estadoConsolidacion: 'consolidado'
      }];
    }
    if (name === 'EvalBancoRecomendaciones') {
      return [
        { id: 'REC1', texto: 'Fortalecer lectura diaria', activo: true },
        { id: 'REC2', texto: 'Recomendación inactiva', activo: false }
      ];
    }
    return [];
  };

  const bundle = getTrimesterEvaluationBundle({
    cicloEscolar: '2026-2027', grupo: '4A', trimestre: 1
  }, 'DOCENTE_VALIDO_OK');

  assert.strictEqual(bundle.ok, true);
  assert.ok(Array.isArray(bundle.data.bancoRecomendaciones));
  assert.strictEqual(bundle.data.bancoRecomendaciones.length, 1);
  assert.strictEqual(bundle.data.bancoRecomendaciones[0].id, 'REC1');
});

// PRUEBA 09: verificarInstalacionEvaluacionesTrimestrales realiza CERO (0) escrituras
runTest('09', 'verificarInstalacionEvaluacionesTrimestrales realiza CERO (0) escrituras', () => {
  let writeAttempted = false;
  global.SpreadsheetApp = {
    getActiveSpreadsheet: function () {
      return {
        getSheetByName: function (name) { return null; },
        insertSheet: function () { writeAttempted = true; throw new Error('Escritura no permitida en verificación'); }
      };
    }
  };
  const r = verificarInstalacionEvaluacionesTrimestrales();
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.escrituras, 0);
  assert.strictEqual(r.hojasPorCrear.length, 7);
  assert.strictEqual(writeAttempted, false);
});

// PRUEBA 10: Aislamiento de DB_EVALUACIONES en Database.gs.txt
runTest('10', 'Aislamiento de DB_EVALUACIONES en Database.gs.txt protege ensureInstalled_', () => {
  const dbCode = fs.readFileSync('Database.gs.txt', 'utf8');
  eval(dbCode.replace(/const DB\s*=/, 'global.DB =').replace(/const DB_EVALUACIONES\s*=/, 'global.DB_EVALUACIONES ='));
  const evalModuleTables = ['EvalConfig', 'EvalActividades', 'EvalCalificaciones', 'EvalDesempeno', 'EvalMensajes', 'EvalBancoRecomendaciones', 'EvalVersiones'];
  const newTablesInDB = evalModuleTables.filter(k => k in global.DB);
  assert.strictEqual(newTablesInDB.length, 0, 'DB no debe contener las nuevas tablas Eval* para proteger ensureInstalled');
  assert.ok(typeof global.DB_EVALUACIONES !== 'undefined', 'DB_EVALUACIONES debe estar definido');
  assert.strictEqual(Object.keys(global.DB_EVALUACIONES).length, 7, 'DB_EVALUACIONES debe contener las 7 tablas');
});

console.log('\n============================================================');
console.log(`RESUMEN ETAPA 7A.3 V3: ${passed} / ${total} PRUEBAS SUPERADAS (${total === passed ? '100%' : 'CON FALLAS'})`);
console.log('============================================================');
