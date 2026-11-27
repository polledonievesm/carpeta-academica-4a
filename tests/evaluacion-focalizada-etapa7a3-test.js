/**
 * ============================================================================
 * PRUEBAS FOCALIZADAS OBLIGATORIAS — ETAPA 7A.3 (AJUSTES FINALES Y ESTÁNDAR)
 * ============================================================================
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('============================================================');
console.log('EJECUTANDO SUITE DE PRUEBAS FOCALIZADAS — ETAPA 7A.3');
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

global.LockService = {
  getDocumentLock: function () {
    return {
      waitLock: function () {},
      releaseLock: function () {}
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

// PRUEBA 03: Rechazo si el grupo no coincide
runTest('03', 'Rechazo de sesión si el grupo escolar no está autorizado', () => {
  assert.throws(() => {
    validateTeacherAuth_('DOCENTE_VALIDO_OK', '4B');
  }, /AUTH_ERROR/);
});

// PRUEBA 04: Control de versiones exige coincidencia EXACTA con la última consolidada
runTest('04', 'Exigencia de coincidencia EXACTA entre baseVersion y última versión consolidada', () => {
  // Simular versión consolidada actual = 3
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
    }, /CONFLICTO_VERSION/);
  });
});

// PRUEBA 05: Cálculo de hash en servidor ignora hash del cliente
runTest('05', 'Cálculo de hash de integridad exclusivamente en el servidor', () => {
  const payload = {
    cicloEscolar: '2026-2027', grupo: '4A', trimestre: 1,
    hash: 'HASH_FALSO_DEL_CLIENTE',
    calificaciones: [{ alumnoId: 'A001', campoFormativo: 'Lenguajes', examenGrade: 9.5 }]
  };
  const computed = computeBundleIntegrityHash_(payload);
  assert.notStrictEqual(computed, 'HASH_FALSO_DEL_CLIENTE');
  assert.strictEqual(computed.length, 64); // SHA-256 hex
});

// PRUEBA 06: Fusión de alumnos al guardar alumno individual para no perder a los demás
runTest('06', 'Guardado individual de alumno fusiona y preserva al resto de los alumnos', () => {
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
  // Verificar que el nuevo lote en EvalCalificaciones contenga TANTO a A001 como a A002
  const batchCalif = writtenRows['EvalCalificaciones'];
  assert.strictEqual(batchCalif.length, 2, 'El lote debe conservar ambos alumnos');
  const a1 = batchCalif.find(c => c.alumnoId === 'A001');
  const a2 = batchCalif.find(c => c.alumnoId === 'A002');
  assert.strictEqual(a1.examenGrade, 10.0, 'A001 debe tener la nueva calificación');
  assert.strictEqual(a2.examenGrade, 9.0, 'A002 debe conservar su calificación previa intacta');
});

// PRUEBA 07: snapshotJson compacto respeta límites de Google Sheets (<500 caracteres)
runTest('07', 'snapshotJson compacto en EvalVersiones (<500 caracteres)', () => {
  const versionsWritten = [];
  global.appendObjects_ = function (name, batch) {
    if (name === 'EvalVersiones') versionsWritten.push(...batch);
  };
  global.readRows_ = function (name) {
    return []; // sin versiones previas
  };

  syncTrimesterEvaluationBatch({
    cicloEscolar: '2026-2027', grupo: '4A', trimestre: 1,
    batchId: 'batch_compact_test', baseVersion: 0,
    calificaciones: [{ alumnoId: 'A001', campoFormativo: 'Lenguajes', examenGrade: 9.0 }]
  }, 'DOCENTE_VALIDO_OK');

  assert.strictEqual(versionsWritten.length, 1);
  const snap = versionsWritten[0].snapshotJson;
  assert.ok(snap.length < 500, `snapshotJson debe ser compacto: longitud actual ${snap.length}`);
  const parsed = JSON.parse(snap);
  assert.strictEqual(parsed.calificacionesCount, 1);
});

// PRUEBA 08: verificarInstalacionEvaluacionesTrimestrales es estrictamente de solo lectura (0 escrituras)
runTest('08', 'verificarInstalacionEvaluacionesTrimestrales realiza CERO (0) escrituras', () => {
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

// PRUEBA 09: DB_EVALUACIONES independiente previene creación automática en setupSystem y ensureInstalled
runTest('09', 'Aislamiento de DB_EVALUACIONES impide creación automática por ensureInstalled', () => {
  const dbCode = fs.readFileSync('Database.gs.txt', 'utf8');
  eval(dbCode.replace(/const DB\s*=/, 'global.DB =').replace(/const DB_EVALUACIONES\s*=/, 'global.DB_EVALUACIONES ='));
  // Las 7 tablas nuevas de evaluación trimestral no deben estar en DB para proteger ensureInstalled_
  const evalModuleTables = ['EvalConfig', 'EvalActividades', 'EvalCalificaciones', 'EvalDesempeno', 'EvalMensajes', 'EvalBancoRecomendaciones', 'EvalVersiones'];
  const newTablesInDB = evalModuleTables.filter(k => k in global.DB);
  assert.strictEqual(newTablesInDB.length, 0, 'DB no debe contener las nuevas tablas Eval* para proteger ensureInstalled');
  assert.ok(typeof global.DB_EVALUACIONES !== 'undefined', 'DB_EVALUACIONES debe estar definido');
  assert.strictEqual(Object.keys(global.DB_EVALUACIONES).length, 7, 'DB_EVALUACIONES debe contener las 7 tablas');
});

// PRUEBA 10: Validación de formato y límites en validateGradeValue_ y validateFamilyMessage_
runTest('10', 'Reglas escolares: notas (0.00 - 10.00) y mensajes a familias (máx 245 car)', () => {
  assert.strictEqual(validateGradeValue_(null), null);
  assert.strictEqual(validateGradeValue_(0), 0.00);
  assert.strictEqual(validateGradeValue_(8.654), 8.65);
  assert.throws(() => validateGradeValue_(10.5), /fuera del rango escolar/);
  assert.strictEqual(validateFamilyMessage_('Excelente desempeño').length, 19);
  const longMsg = 'A'.repeat(246);
  assert.throws(() => validateFamilyMessage_(longMsg), /excede el límite máximo de 245/);
});

console.log('\n============================================================');
console.log(`RESUMEN ETAPA 7A.3: ${passed} / ${total} PRUEBAS SUPERADAS (${total === passed ? '100%' : 'CON FALLAS'})`);
console.log('============================================================');
