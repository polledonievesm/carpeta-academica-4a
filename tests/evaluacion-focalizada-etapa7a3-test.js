/**
 * ============================================================================
 * PRUEBAS FOCALIZADAS OBLIGATORIAS — ETAPA 7A.3 (VALIDACIÓN FINAL PARA INSTALACIÓN)
 * ============================================================================
 * 
 * Verifica las 10 directrices clave exigidas por el docente:
 *   1. Integración con el mecanismo auténtico de autenticación: validarSesion_(sessionToken).
 *   2. Validación de identidad auténtica, vigencia temporal y ámbito escolar (grupo 4A y ciclo).
 *   3. Blindaje contra vías alternas: confirmación de que isDirectoryPublicAction_ no expone las acciones.
 *   4. Control estricto de concurrencia y ScriptLock.
 *   5. Control de versiones exacto con baseVersion entera (sin decimales ni conversiones parciales).
 *   6. Detección de colisiones e idempotencia segura ante reintentos de red.
 *   7. Persistencia consolidada con fusión (Merge) de alumnos en guardados individuales y parciales.
 *   8. Conservación de las 7 tablas (EvalConfig, EvalActividades, EvalCalificaciones, EvalDesempeno, EvalMensajes, EvalBancoRecomendaciones, EvalVersiones).
 *   9. Verificación de CERO (0) escrituras en diagnóstico preventivo.
 *  10. Aislamiento de DB_EVALUACIONES en Database.gs para proteger ensureInstalled_.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('============================================================');
console.log('EJECUTANDO SUITE DE PRUEBAS FOCALIZADAS — ETAPA 7A.3 (FINAL)');
console.log('============================================================\n');

// 1. Simulación de entorno Google Apps Script en Node.js
const mockPropertiesStore = {
  'SPREADSHEET_ID': 'mock_spreadsheet_123',
  'ATTENDANCE_AUTH_SECRET': 'secret_key_mock_456'
};

global.PropertiesService = {
  getScriptProperties: function () {
    return {
      getProperty: function (key) { return mockPropertiesStore[key] || null; },
      setProperty: function (key, val) { mockPropertiesStore[key] = String(val); }
    };
  }
};

const mockConfigSheet = {
  getLastRow: () => 5,
  getRange: function () {
    return {
      getDisplayValues: () => [
        ['Usuario de acceso', 'profesor_titular'],
        ['Contraseña protegida', 'hash_secreto_docente'],
        ['Grado y grupo', '4°A'],
        ['Ciclo escolar', '2026-2027']
      ],
      setValues: function () {},
      setFontWeight: function () {}
    };
  },
  setFrozenRows: function () {},
  getLastColumn: function () { return 0; }
};

const mockSpreadsheet = {
  getSheetByName: function (sheetName) {
    if (sheetName === 'Configuración') return mockConfigSheet;
    return null;
  },
  insertSheet: function () {
    return mockConfigSheet;
  }
};

global.SpreadsheetApp = {
  getActiveSpreadsheet: function () { return mockSpreadsheet; },
  openById: function (id) { return mockSpreadsheet; },
  flush: function () {}
};

global.Utilities = {
  DigestAlgorithm: { SHA_256: 'SHA_256' },
  Charset: { UTF_8: 'UTF_8' },
  computeDigest: function (alg, str) {
    const hash = crypto.createHash('sha256').update(str, 'utf8').digest();
    return Array.from(hash).map(b => (b > 127 ? b - 256 : b));
  },
  computeHmacSha256Signature: function (value, key) {
    const hmac = crypto.createHmac('sha256', key).update(value, 'utf8').digest();
    return Array.from(hmac).map(b => (b > 127 ? b - 256 : b));
  },
  base64DecodeWebSafe: function (str) {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    return Buffer.from(base64, 'base64');
  },
  base64EncodeWebSafe: function (input) {
    const buf = Buffer.isBuffer(input) ? input : Array.isArray(input) ? Buffer.from(input.map(b => (b < 0 ? b + 256 : b))) : Buffer.from(String(input), 'utf8');
    return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  newBlob: function (bytes) {
    return {
      getDataAsString: function (enc) {
        return Buffer.from(bytes).toString('utf8');
      }
    };
  },
  getUuid: function () {
    return crypto.randomUUID();
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

// Cargar AttendanceLegacy.gs.txt para validarSesion_ y firmarToken_
let attCode = fs.readFileSync('AttendanceLegacy.gs.txt', 'utf8');
attCode = attCode.replace(/^const\s+/gm, 'var ');
eval(attCode);

// Cargar EvaluacionesTrimestrales.gs.txt
let evalCode = fs.readFileSync('EvaluacionesTrimestrales.gs.txt', 'utf8');
evalCode = evalCode.replace(/^const\s+/gm, 'var ');
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

// Helper para crear token válido
function getValidTeacherToken(user = 'profesor_titular', expiresOffset = 1000 * 60 * 60) {
  const normUser = normalizarUsuario_(user);
  const payloadStr = JSON.stringify({
    user: normUser,
    expiresAt: Date.now() + expiresOffset,
    nonce: Utilities.getUuid()
  });
  const payloadB64 = Utilities.base64EncodeWebSafe(payloadStr);
  const signature = firmarToken_(payloadB64, 'hash_secreto_docente');
  return payloadB64 + '.' + signature;
}

// PRUEBA 01: Rechazo si el token es nulo o inválido
runTest('01', 'Rechazo Zero-Trust con validarSesion_ ante token nulo o malformado', () => {
  assert.throws(() => {
    validateTeacherAuth_(null, '4A', '2026-2027');
  }, /Tu sesión no es válida/);

  assert.throws(() => {
    validateTeacherAuth_('TOKEN_MALFORMADO_SIN_PUNTO', '4A', '2026-2027');
  }, /Tu sesión no es válida/);
});

// PRUEBA 02: Aceptación y verificación de identidad, grupo y ciclo con validarSesion_
runTest('02', 'Validación exitosa de identidad docente, vigencia y ámbito escolar (4A, 2026-2027)', () => {
  const validToken = getValidTeacherToken('profesor_titular');
  const session = validateTeacherAuth_(validToken, '4A', '2026-2027');
  assert.strictEqual(session.ok, true);
  assert.strictEqual(session.usuario, 'PROFESOR_TITULAR');
  assert.strictEqual(session.grupo, '4°A');
  assert.strictEqual(session.cicloEscolar, '2026-2027');

  // Rechazo si el token está expirado
  const expToken = getValidTeacherToken('profesor_titular', -10000);
  assert.throws(() => {
    validateTeacherAuth_(expToken, '4A', '2026-2027');
  }, /Tu sesión venció/);

  // Rechazo si el grupo escolar no coincide
  assert.throws(() => {
    validateTeacherAuth_(validToken, '5B', '2026-2027');
  }, /ámbito no autorizado/);

  // Rechazo si el ciclo escolar no coincide
  assert.throws(() => {
    validateTeacherAuth_(validToken, '4A', '2025-2026');
  }, /ámbito no autorizado/);
});

// PRUEBA 03: Blindaje de rutas públicas: isDirectoryPublicAction_ no expone evaluaciones trimestrales
runTest('03', 'Blindaje Zero-Trust: getTrimesterEvaluationBundle y syncTrimesterEvaluationBatch no son públicas', () => {
  const dfCode = fs.readFileSync('c:/Users/Polledo/Desktop/archivos de appscript/DirectoryFamily.txt', 'utf8');
  eval(dfCode.match(/function\s+isDirectoryPublicAction_[\s\S]*?\n\}/)[0]);

  assert.strictEqual(isDirectoryPublicAction_('getTrimesterEvaluationBundle'), false, 'getTrimesterEvaluationBundle NUNCA debe ser pública');
  assert.strictEqual(isDirectoryPublicAction_('syncTrimesterEvaluationBatch'), false, 'syncTrimesterEvaluationBatch NUNCA debe ser pública');
  assert.strictEqual(isDirectoryPublicAction_('getFamilyProfile'), true, 'getFamilyProfile sí es pública');
});

// PRUEBA 04: Control de versiones exige coincidencia EXACTA con la última consolidada
runTest('04', 'Exigencia de coincidencia EXACTA entre baseVersion y última versión consolidada', () => {
  const validToken = getValidTeacherToken('profesor_titular');

  global.readRows_ = function (name) {
    if (name === 'EvalVersiones') {
      return [{
        cicloEscolar: '2026-2027', grupo: '4A', trimestre: 1,
        versionNueva: 3, batchId: 'batch_003', estadoConsolidacion: 'consolidado'
      }];
    }
    return [];
  };

  // Versión inferior (2 !== 3) rechazada
  assert.throws(() => {
    syncTrimesterEvaluationBatch({
      cicloEscolar: '2026-2027', grupo: '4A', trimestre: 1,
      batchId: 'batch_004', baseVersion: 2, calificaciones: []
    }, validToken);
  }, /CONFLICTO_VERSION/);

  // Versión superior (4 !== 3) rechazada
  assert.throws(() => {
    syncTrimesterEvaluationBatch({
      cicloEscolar: '2026-2027', grupo: '4A', trimestre: 1,
      batchId: 'batch_004', baseVersion: 4, calificaciones: []
    }, validToken);
  }, /CONFLICTO_VERSION/);
});

// PRUEBA 05: Hash en servidor e Idempotencia segura ante reintentos
runTest('05', 'Idempotencia segura: reintento idéntico retorna éxito, contenido divergente se rechaza', () => {
  const validToken = getValidTeacherToken('profesor_titular');

  const testPayload = {
    cicloEscolar: '2026-2027', grupo: '4A', trimestre: 1,
    batchId: 'batch_reintento_01', baseVersion: 0,
    calificaciones: [{ alumnoId: 'ALU1', campoFormativo: 'Lenguajes', examenGrade: 9.5 }],
    desempeno: [], mensajes: [], config: {}, actividades: [], bancoRecomendaciones: []
  };

  const expectedHash = computeBundleIntegrityHash_(testPayload);

  global.readRows_ = function (name) {
    if (name === 'EvalVersiones') {
      return [{
        cicloEscolar: '2026-2027', grupo: '4A', trimestre: 1,
        versionNueva: 1, batchId: 'batch_reintento_01',
        payloadHash: expectedHash,
        estadoConsolidacion: 'consolidado'
      }];
    }
    return [];
  };

  // 1. Reintento con mismo hash -> Exitoso e idempotente
  const res = syncTrimesterEvaluationBatch(testPayload, validToken);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.data.idempotent, true);

  // 2. Reintento con contenido alterado (mismo batchId) -> Rechazado
  const alteredPayload = Object.assign({}, testPayload, {
    calificaciones: [{ alumnoId: 'ALU1', campoFormativo: 'Lenguajes', examenGrade: 5.0 }]
  });
  assert.throws(() => {
    syncTrimesterEvaluationBatch(alteredPayload, validToken);
  }, /CONFLICTO_REINTENTO_INCONSISTENTE/);
});

// PRUEBA 06: Concurrencia con ScriptLock
runTest('06', 'Bloqueo exclusivo ScriptLock liberado garantizado en bloque finally', () => {
  scriptLockAcquired = false;
  evalWithScriptLock_(() => {
    assert.strictEqual(scriptLockAcquired, true, 'El lock debe estar adquirido dentro del callback');
  });
  assert.strictEqual(scriptLockAcquired, false, 'El lock debe liberarse en el bloque finally');
});

// PRUEBA 07: Fusión de alumnos al guardar alumno individual para no perder a los demás
runTest('07', 'Guardado individual de alumno fusiona y preserva al resto de los alumnos', () => {
  const validToken = getValidTeacherToken('profesor_titular');

  const writtenRows = {};
  global.upsertObjectsBatch_ = function (name, batch) { writtenRows[name] = batch; };
  global.appendObjects_ = function (name, batch) { writtenRows[name] = batch; };

  // Simular que en la versión V1 existen los alumnos A001 y A002
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
    calificaciones: [{ alumnoId: 'A001', campoFormativo: 'Lenguajes', examenGrade: 10.0 }]
  }, validToken);

  assert.strictEqual(res.ok, true);
  const batchCalif = writtenRows['EvalCalificaciones'];
  assert.strictEqual(batchCalif.length, 2, 'El lote debe conservar ambos alumnos');
  const a1 = batchCalif.find(c => c.alumnoId === 'A001');
  const a2 = batchCalif.find(c => c.alumnoId === 'A002');
  assert.strictEqual(a1.examenGrade, 10.0, 'A001 debe tener la nueva calificación');
  assert.strictEqual(a2.examenGrade, 9.0, 'A002 debe conservar su calificación previa intacta');
});

// PRUEBA 08: Persistencia del banco de recomendaciones con trazabilidad por versión
runTest('08', 'Banco de recomendaciones preserva registros históricos mediante loteVersionId', () => {
  const validToken = getValidTeacherToken('profesor_titular');

  const writtenRows = {};
  global.upsertObjectsBatch_ = function (name, batch) { writtenRows[name] = batch; };
  global.appendObjects_ = function (name, batch) { writtenRows[name] = batch; };

  global.readRows_ = function (name) {
    if (name === 'EvalVersiones') return [];
    if (name === 'EvalBancoRecomendaciones') {
      return [
        { id: 'REC_V1_01', recomendacionId: 'REC01', loteVersionId: 'BATCH_PREV', texto: 'Recomendación previa V1', activo: true, estadoAprobacion: 'aprobado' }
      ];
    }
    return [];
  };

  const res = syncTrimesterEvaluationBatch({
    cicloEscolar: '2026-2027', grupo: '4A', trimestre: 1,
    batchId: 'batch_bank_01', baseVersion: 0,
    calificaciones: [],
    bancoRecomendaciones: [
      { id: 'REC01', texto: 'Recomendación actualizada V2', activo: true, estadoAprobacion: 'aprobada', categoria: 'pedagogica', campoFormativo: 'Lenguajes', nivel: 'E' }
    ]
  }, validToken);

  assert.strictEqual(res.ok, true);
  const savedBank = writtenRows['EvalBancoRecomendaciones'];
  assert.ok(Array.isArray(savedBank) && savedBank.length === 1);
  assert.strictEqual(savedBank[0].recomendacionId, 'REC01');
  assert.strictEqual(savedBank[0].loteVersionId, 'VER_2026-2027_4A_T1_batch_bank_01');
});

// PRUEBA 09: verificarInstalacionEvaluacionesTrimestrales realiza CERO (0) escrituras
runTest('09', 'verificarInstalacionEvaluacionesTrimestrales realiza CERO (0) escrituras', () => {
  let writeAttempted = false;
  global.SpreadsheetApp = {
    getActiveSpreadsheet: function () {
      return {
        getSheetByName: function () { return null; },
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
console.log(`RESUMEN ETAPA 7A.3 (FINAL): ${passed} / ${total} PRUEBAS SUPERADAS (${total === passed ? '100%' : 'CON FALLAS'})`);
console.log('============================================================');

if (passed !== total) process.exit(1);
