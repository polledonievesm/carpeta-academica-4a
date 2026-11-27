/**
 * ============================================================================
 * PRUEBAS FOCALIZADAS DE COMPORTAMIENTO — ETAPA 7A.3 (CORRECCIÓN PUNTUAL)
 * ============================================================================
 * 
 * Verifica exclusivamente los 8 comportamientos exigidos por el docente:
 *   1. Guardado parcial de indicadores de un mismo alumno (fusión acumulativa).
 *   2. Conservación de los 23 indicadores previamente registrados ante guardado parcial.
 *   3. Revisión explícita de indicadores completos (revisado solo con confirmación y 23 completos; rechazo de inválidos).
 *   4. Autoría generada en servidor (authorizedPor y authorizedAt del servidor; conservación si no hay cambio).
 *   5. Rechazo de alumnos inexistentes contra el padrón escolar autorizado.
 *   6. Aislamiento estricto entre trimestres y validación de trimestre en [1, 2, 3].
 *   7. Diagnóstico de encabezados incompatibles en verificarInstalacionEvaluacionesTrimestrales.
 *   8. Verificación con cero (0) escrituras en el diagnóstico preventivo.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('============================================================');
console.log('EJECUTANDO SUITE DE PRUEBAS FOCALIZADAS — ETAPA 7A.3 CORRECCIÓN');
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
  insertSheet: function () { return mockConfigSheet; }
};

global.SpreadsheetApp = {
  getActiveSpreadsheet: function () { return mockSpreadsheet; },
  openById: function () { return mockSpreadsheet; },
  flush: function () {}
};

global.Session = {
  getScriptTimeZone: function () { return 'America/Cancun'; }
};

global.Utilities = {
  DigestAlgorithm: { SHA_256: 'SHA_256' },
  Charset: { UTF_8: 'UTF_8' },
  formatDate: function (date) {
    return (date instanceof Date ? date : new Date()).toISOString();
  },
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
      getDataAsString: function () { return Buffer.from(bytes).toString('utf8'); }
    };
  },
  getUuid: function () { return crypto.randomUUID(); }
};

let scriptLockAcquired = false;
global.LockService = {
  getScriptLock: function () {
    return {
      tryLock: function () {
        scriptLockAcquired = true;
        return true;
      },
      releaseLock: function () {
        scriptLockAcquired = false;
      }
    };
  }
};

// Cargar AttendanceLegacy.gs.txt para autenticación auténtica
let attCode = fs.readFileSync('AttendanceLegacy.gs.txt', 'utf8');
attCode = attCode.replace(/^const\s+/gm, 'var ');
eval(attCode);

// Extraer DB_EVALUACIONES de Database.gs.txt sin cargar readRows_
let dbCode = fs.readFileSync('Database.gs.txt', 'utf8');
const dbEvalMatch = dbCode.match(/const DB_EVALUACIONES\s*=\s*\{[\s\S]*?\n\};/);
eval(dbEvalMatch[0].replace('const DB_EVALUACIONES', 'global.DB_EVALUACIONES'));

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

// Token de docente auténtico
function getValidTeacherToken() {
  const normUser = normalizarUsuario_('profesor_titular');
  const payloadStr = JSON.stringify({
    user: normUser,
    expiresAt: Date.now() + 1000 * 60 * 60,
    nonce: Utilities.getUuid()
  });
  const payloadB64 = Utilities.base64EncodeWebSafe(payloadStr);
  const signature = firmarToken_(payloadB64, 'hash_secreto_docente');
  return payloadB64 + '.' + signature;
}

const validToken = getValidTeacherToken();

// Configurar padrón escolar autorizado simulado
const mockStudents = [
  { id: 'ALU001', nombreCompleto: 'ALUMNO DE PRUEBA UNO', numeroLista: 1, activo: true },
  { id: 'ALU002', nombreCompleto: 'ALUMNO DE PRUEBA DOS', numeroLista: 2, activo: true }
];

// PRUEBA 01: Guardado parcial de indicadores de un mismo alumno (fusión acumulativa)
runTest('01', 'Guardado parcial de indicadores de un mismo alumno fusiona valoraciones', () => {
  const writtenRows = {};
  global.upsertObjectsBatch_ = function (name, batch) { writtenRows[name] = batch; };
  global.appendObjects_ = function (name, batch) { writtenRows[name] = batch; };

  global.readRows_ = function (name) {
    if (name === 'Alumnos') return mockStudents;
    if (name === 'EvalVersiones') {
      return [{
        cicloEscolar: '2026-2027', grupo: '4A', trimestre: 1,
        versionNueva: 1, batchId: 'batch_v1', estadoConsolidacion: 'consolidado'
      }];
    }
    if (name === 'EvalDesempeno') {
      return [{
        cicloEscolar: '2026-2027', grupo: '4A', trimestre: 1, batchId: 'batch_v1',
        alumnoId: 'ALU001',
        valoracion: JSON.stringify({
          acad_lectura: 'E',
          acad_escritura: 'B'
        }),
        estadoRevision: 'pendiente',
        estadoConsolidacion: 'consolidado'
      }];
    }
    return [];
  };

  // Guardado parcial: solo envía acad_matematicas y acad_contenidos
  const res = syncTrimesterEvaluationBatch({
    cicloEscolar: '2026-2027', grupo: '4° A', trimestre: 1,
    batchId: 'batch_v2', baseVersion: 1,
    desempeno: [{
      alumnoId: 'ALU001',
      ratings: {
        acad_matematicas: 'R',
        acad_contenidos: 'B'
      }
    }]
  }, validToken);

  assert.strictEqual(res.ok, true);
  const desemps = writtenRows['EvalDesempeno'];
  assert.ok(desemps && desemps.length > 0);
  const alu1 = desemps.find(d => d.alumnoId === 'ALU001');
  const merged = JSON.parse(alu1.valoracion);
  // Deben coexistir tanto los 2 indicadores anteriores como los 2 nuevos
  assert.strictEqual(merged.acad_lectura, 'E', 'Debe conservar acad_lectura previa');
  assert.strictEqual(merged.acad_escritura, 'B', 'Debe conservar acad_escritura previa');
  assert.strictEqual(merged.acad_matematicas, 'R', 'Debe incorporar acad_matematicas');
  assert.strictEqual(merged.acad_contenidos, 'B', 'Debe incorporar acad_contenidos');
});

// PRUEBA 02: Conservación de los 23 indicadores previamente registrados ante guardado parcial
runTest('02', 'Conservación de los 23 indicadores previamente registrados ante guardado parcial', () => {
  const writtenRows = {};
  global.upsertObjectsBatch_ = function (name, batch) { writtenRows[name] = batch; };
  global.appendObjects_ = function (name, batch) { writtenRows[name] = batch; };

  // Crear catálogo completo de 23 indicadores para ALU001 en V1
  const full23Ratings = {};
  for (var k in EVAL_INDICADORES_VALIDOS) {
    full23Ratings[k] = 'B';
  }

  global.readRows_ = function (name) {
    if (name === 'Alumnos') return mockStudents;
    if (name === 'EvalVersiones') {
      return [{
        cicloEscolar: '2026-2027', grupo: '4A', trimestre: 1,
        versionNueva: 1, batchId: 'batch_v1', estadoConsolidacion: 'consolidado'
      }];
    }
    if (name === 'EvalDesempeno') {
      return [{
        cicloEscolar: '2026-2027', grupo: '4A', trimestre: 1, batchId: 'batch_v1',
        alumnoId: 'ALU001',
        valoracion: JSON.stringify(full23Ratings),
        estadoRevision: 'revisado',
        estadoConsolidacion: 'consolidado'
      }];
    }
    return [];
  };

  // Enviar guardado parcial actualizando ÚNICAMENTE 1 indicador
  const res = syncTrimesterEvaluationBatch({
    cicloEscolar: '2026-2027', grupo: '4A', trimestre: 1,
    batchId: 'batch_v2', baseVersion: 1,
    desempeno: [{
      alumnoId: 'ALU001',
      ratings: { acad_lectura: 'E' },
      isReviewed: true
    }]
  }, validToken);

  assert.strictEqual(res.ok, true);
  const alu1 = writtenRows['EvalDesempeno'].find(d => d.alumnoId === 'ALU001');
  const merged = JSON.parse(alu1.valoracion);
  assert.strictEqual(Object.keys(merged).length, 23, 'Deben conservarse los 23 indicadores completos');
  assert.strictEqual(merged.acad_lectura, 'E', 'El indicador actualizado debe ser E');
  assert.strictEqual(merged.hab_tareas, 'B', 'Los indicadores restantes deben conservar su valor');
  assert.strictEqual(alu1.estadoRevision, 'revisado', 'Debe permanecer revisado al tener confirmación y 23 completos');
});

// PRUEBA 03: Revisión explícita de indicadores completos y rechazo de inválidos
runTest('03', 'Revisión explícita exige confirmación y 23 indicadores; rechaza inválidos', () => {
  global.readRows_ = function (name) {
    if (name === 'Alumnos') return mockStudents;
    return [];
  };

  // Caso A: isReviewed=true pero solo 4 indicadores -> estadoRevision debe ser 'pendiente'
  const writtenRowsA = {};
  global.upsertObjectsBatch_ = function (name, batch) { writtenRowsA[name] = batch; };
  syncTrimesterEvaluationBatch({
    cicloEscolar: '2026-2027', grupo: '4A', trimestre: 1,
    batchId: 'batch_a', baseVersion: 0,
    desempeno: [{
      alumnoId: 'ALU001',
      ratings: { acad_lectura: 'E', acad_escritura: 'B', acad_matematicas: 'B', acad_contenidos: 'E' },
      isReviewed: true
    }]
  }, validToken);
  assert.strictEqual(writtenRowsA['EvalDesempeno'][0].estadoRevision, 'pendiente', 'Incompleto (<23) debe quedar pendiente aunque isReviewed=true');

  // Caso B: Rechazo de indicador inválido
  assert.throws(() => {
    syncTrimesterEvaluationBatch({
      cicloEscolar: '2026-2027', grupo: '4A', trimestre: 1,
      batchId: 'batch_b', baseVersion: 0,
      desempeno: [{
        alumnoId: 'ALU001',
        ratings: { indicador_inventado: 'E' }
      }]
    }, validToken);
  }, /INDICADOR_INVALIDO/);

  // Caso C: Rechazo de valoración inválida
  assert.throws(() => {
    syncTrimesterEvaluationBatch({
      cicloEscolar: '2026-2027', grupo: '4A', trimestre: 1,
      batchId: 'batch_c', baseVersion: 0,
      desempeno: [{
        alumnoId: 'ALU001',
        ratings: { acad_lectura: 'NIVEL_INEXISTENTE' }
      }]
    }, validToken);
  }, /VALORACION_INVALIDA/);
});

// PRUEBA 04: Autoría generada en servidor y conservación en registros inalterados
runTest('04', 'authorizedPor y authorizedAt generados en servidor; conservados si no cambian', () => {
  const writtenRows = {};
  global.upsertObjectsBatch_ = function (name, batch) { writtenRows[name] = batch; };
  global.appendObjects_ = function (name, batch) { writtenRows[name] = batch; };

  const fechaOriginal = '2026-10-15T10:00:00.000Z';
  const docenteOriginal = 'DOCENTE_ANTERIOR';

  global.readRows_ = function (name) {
    if (name === 'Alumnos') return mockStudents;
    if (name === 'EvalVersiones') {
      return [{
        cicloEscolar: '2026-2027', grupo: '4A', trimestre: 1,
        versionNueva: 1, batchId: 'batch_v1', estadoConsolidacion: 'consolidado'
      }];
    }
    if (name === 'EvalCalificaciones') {
      return [
        {
          cicloEscolar: '2026-2027', grupo: '4A', trimestre: 1, batchId: 'batch_v1',
          alumnoId: 'ALU001', campoFormativo: 'Lenguajes',
          authorizedGrade: 9.0, status: 'AUTORIZADA',
          authorizedAt: fechaOriginal, authorizedPor: docenteOriginal
        },
        {
          cicloEscolar: '2026-2027', grupo: '4A', trimestre: 1, batchId: 'batch_v1',
          alumnoId: 'ALU002', campoFormativo: 'Lenguajes',
          authorizedGrade: 8.0, status: 'AUTORIZADA',
          authorizedAt: fechaOriginal, authorizedPor: docenteOriginal
        }
      ];
    }
    return [];
  };

  // Enviar actualización: ALU001 cambia calificación a 9.5; ALU002 no se incluye en payload (merge)
  const res = syncTrimesterEvaluationBatch({
    cicloEscolar: '2026-2027', grupo: '4A', trimestre: 1,
    batchId: 'batch_v2', baseVersion: 1,
    calificaciones: [{
      alumnoId: 'ALU001', campoFormativo: 'Lenguajes',
      authorizedGrade: 9.5, status: 'AUTORIZADA',
      authorizedPor: 'HACK_CLIENTE', authorizedAt: '2020-01-01'
    }]
  }, validToken);

  assert.strictEqual(res.ok, true);
  const califs = writtenRows['EvalCalificaciones'];
  const a1 = califs.find(c => c.alumnoId === 'ALU001');
  const a2 = califs.find(c => c.alumnoId === 'ALU002');

  // ALU001: autoría generada en servidor por el usuario de la sesión, ignorando HACK_CLIENTE
  assert.strictEqual(a1.authorizedPor, 'PROFESOR_TITULAR');
  assert.notStrictEqual(a1.authorizedAt, '2020-01-01');

  // ALU002: inalterado, debe conservar autoría y fecha originales
  assert.strictEqual(a2.authorizedPor, docenteOriginal);
  assert.strictEqual(a2.authorizedAt, fechaOriginal);
});

// PRUEBA 05: Rechazo de alumnos inexistentes contra el padrón escolar autorizado
runTest('05', 'Rechazo estricto de alumnos inexistentes fuera del padrón autorizado', () => {
  global.readRows_ = function (name) {
    if (name === 'Alumnos') return mockStudents; // Solo contiene ALU001 y ALU002
    return [];
  };

  assert.throws(() => {
    syncTrimesterEvaluationBatch({
      cicloEscolar: '2026-2027', grupo: '4A', trimestre: 1,
      batchId: 'batch_err_alumno', baseVersion: 0,
      calificaciones: [{
        alumnoId: 'ALUMNO_INEXISTENTE_999', campoFormativo: 'Lenguajes', authorizedGrade: 8.0
      }]
    }, validToken);
  }, /ALUMNO_NO_AUTORIZADO/);
});

// PRUEBA 06: Aislamiento entre trimestres y validación estricta de trimestre [1, 2, 3]
runTest('06', 'Aislamiento estricto de registros entre trimestres y rechazo de T4', () => {
  global.readRows_ = function (name) {
    if (name === 'Alumnos') return mockStudents;
    if (name === 'EvalVersiones') {
      return [
        { cicloEscolar: '2026-2027', grupo: '4A', trimestre: 1, versionNueva: 1, batchId: 'b_t1', estadoConsolidacion: 'consolidado' },
        { cicloEscolar: '2026-2027', grupo: '4A', trimestre: 2, versionNueva: 1, batchId: 'b_t2', estadoConsolidacion: 'consolidado' }
      ];
    }
    if (name === 'EvalCalificaciones') {
      return [
        { cicloEscolar: '2026-2027', grupo: '4A', trimestre: 1, batchId: 'b_t1', alumnoId: 'ALU001', campoFormativo: 'Lenguajes', authorizedGrade: 7.0 },
        { cicloEscolar: '2026-2027', grupo: '4A', trimestre: 2, batchId: 'b_t2', alumnoId: 'ALU001', campoFormativo: 'Lenguajes', authorizedGrade: 10.0 }
      ];
    }
    return [];
  };

  // Consulta de T1 no debe traer datos de T2
  const b1 = getTrimesterEvaluationBundle({ cicloEscolar: '2026-2027', grupo: '4° A', trimestre: 1 }, validToken);
  assert.strictEqual(b1.data.calificaciones[0].authorizedGrade, 7.0);

  // Consulta de T2 no debe traer datos de T1
  const b2 = getTrimesterEvaluationBundle({ cicloEscolar: '2026-2027', grupo: '4A', trimestre: 2 }, validToken);
  assert.strictEqual(b2.data.calificaciones[0].authorizedGrade, 10.0);

  // Rechazo de trimestre inválido
  assert.throws(() => {
    getTrimesterEvaluationBundle({ cicloEscolar: '2026-2027', grupo: '4A', trimestre: 4 }, validToken);
  }, /TRIMESTRE_INVALIDO/);
});

// PRUEBA 07: Diagnóstico de encabezados incompatibles en verificarInstalacionEvaluacionesTrimestrales
runTest('07', 'Diagnóstico detecta encabezados incompatibles y bloquea listoParaCrearHojas', () => {
  // Simular que EvalCalificaciones existe pero tiene columnas incorrectas
  global.SpreadsheetApp = {
    getActiveSpreadsheet: function () {
      return {
        getSheetByName: function (name) {
          if (name === 'EvalCalificaciones') {
            return {
              getLastColumn: () => 5,
              getRange: function () {
                return { getValues: () => [['id', 'columna_invalida', 'col3', 'col4', 'col5']] };
              }
            };
          }
          return null;
        }
      };
    }
  };

  const diag = verificarInstalacionEvaluacionesTrimestrales();
  assert.strictEqual(diag.ok, false);
  assert.strictEqual(diag.encabezadosCompatibles, false);
  assert.strictEqual(diag.listoParaCrearHojas, false);
  assert.ok(diag.erroresEsquema.length > 0, 'Debe reportar errores de esquema');
});

// PRUEBA 08: Verificación con cero (0) escrituras en diagnóstico preventivo
runTest('08', 'verificarInstalacionEvaluacionesTrimestrales realiza CERO (0) escrituras', () => {
  let writeAttempted = false;
  global.SpreadsheetApp = {
    getActiveSpreadsheet: function () {
      return {
        getSheetByName: function () { return null; },
        insertSheet: function () { writeAttempted = true; throw new Error('Escritura no permitida'); }
      };
    }
  };

  const diag = verificarInstalacionEvaluacionesTrimestrales();
  assert.strictEqual(diag.escrituras, 0);
  assert.strictEqual(writeAttempted, false, 'No debe intentar ninguna operación de escritura');
  assert.strictEqual(diag.validadorDisponible, true);
  assert.strictEqual(diag.bloqueoPendiente, false);
  assert.strictEqual(diag.hojasPorCrear.length, 7);
  assert.strictEqual(diag.listoParaCrearHojas, true);
});

console.log('\n============================================================');
console.log(`RESUMEN ETAPA 7A.3 CORRECCIÓN: ${passed} / ${total} PRUEBAS SUPERADAS (${total === passed ? '100%' : 'CON FALLAS'})`);
console.log('============================================================');

if (passed !== total) process.exit(1);
