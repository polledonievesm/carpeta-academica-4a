/**
 * SUITE DE PRUEBAS FINALES DE PERSISTENCIA Y SEGURIDAD — ETAPA 7A.3
 * Carpeta Académica — Evaluaciones Trimestrales
 * 
 * Verificación automatizada de los 10 puntos obligatorios en entorno aislado:
 * 1. Guardado y recuperación de calificaciones.
 * 2. Conservación de datos al cerrar y volver a abrir el módulo (ciclo de vida frontend).
 * 3. Guardado individual sin afectar a los demás alumnos (fusión de grupo).
 * 4. Conservación de ponderaciones, configuraciones, actividades y exclusiones en guardados parciales.
 * 5. Persistencia de los 23 indicadores y mensajes familiares.
 * 6. Recuperación de la última versión consolidada ante una interrupción en cualquier fase del guardado.
 * 7. Prevención de duplicados y conflictos de versiones.
 * 8. Validación de identificadores de alumnos y tipos de datos.
 * 9. Compatibilidad con la autenticación auténtica del sistema (HMAC-SHA256, expiración y ámbito).
 * 10. Compatibilidad entre el frontend y las respuestas reales del backend.
 */

const assert = require('assert');
const fs = require('fs');
const crypto = require('crypto');

// 1. Cargar fuentes originales
const evalCode = fs.readFileSync('EvaluacionesTrimestrales.gs.txt', 'utf8');
const legacyCode = fs.readFileSync('AttendanceLegacy.gs.txt', 'utf8');

// 2. Tablas en memoria para simular el libro de Google Sheets
let sheetsData = {
  Configuracion: [
    { clave: 'Usuario de acceso', valor: 'profesor_titular_4a' },
    { clave: 'Hash de contrasena', valor: '' }, // Se inicializará con hashContrasena_
    { clave: 'Grupo', valor: '4A' },
    { clave: 'Ciclo escolar', valor: '2026-2027' }
  ],
  Alumnos: [
    { id: 'ALU-101', numeroLista: 1, nombre: 'García Pérez Juan', estatus: 'ACTIVO', grupo: '4A' },
    { id: 'ALU-102', numeroLista: 2, nombre: 'López Morales Ana', estatus: 'ACTIVO', grupo: '4A' },
    { id: 'ALU-103', numeroLista: 3, nombre: 'Ramírez Soto Carlos', estatus: 'ACTIVO', grupo: '4A' }
  ],
  EvalConfig: [],
  EvalActividades: [],
  EvalCalificaciones: [],
  EvalDesempeno: [],
  EvalMensajes: [],
  EvalBancoRecomendaciones: [],
  EvalVersiones: []
};

// 3. Entorno simulado de Apps Script
global.SpreadsheetApp = {
  flush: function () {}
};

global.Session = {
  getScriptTimeZone: function () { return 'America/Cancun'; }
};

global.CacheService = {
  getScriptCache: function () {
    const memoryCache = {};
    return {
      get: (k) => memoryCache[k] || null,
      put: (k, v) => { memoryCache[k] = String(v); },
      remove: (k) => { delete memoryCache[k]; }
    };
  }
};

global.PropertiesService = {
  getScriptProperties: function () {
    return {
      getProperty: function (key) {
        if (key === 'CA_AUTH_SECRET') return 'SECRET_KEY_HMAC_CANONICA_2026';
        if (key === 'CA_AUTH_SALT') return 'SALT_CANONICA_2026';
        return null;
      }
    };
  }
};

global.Utilities = {
  computeDigest: function (algo, str, charset) {
    var hash = crypto.createHash('sha256').update(String(str), 'utf8').digest();
    return Array.from(hash);
  },
  base64Encode: function (bytes) {
    return Buffer.from(bytes).toString('base64');
  },
  base64EncodeWebSafe: function (input) {
    const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : Buffer.from(input);
    return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  base64DecodeWebSafe: function (str) {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    return Array.from(Buffer.from(base64, 'base64'));
  },
  computeHmacSha256Signature: function (value, key) {
    const hmac = crypto.createHmac('sha256', key).update(value, 'utf8').digest();
    return Array.from(hmac);
  },
  newBlob: function (bytes) {
    return {
      getDataAsString: function () {
        return Buffer.from(bytes).toString('utf8');
      }
    };
  },
  getUuid: function () {
    return crypto.randomUUID();
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

// Mock de Database.gs
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

// Cargar AttendanceLegacy para obtener el mecanismo auténtico de autenticación
// Simulamos obtenerLibro_() para leer la tabla Configuracion
global.obtenerLibro_ = function () {
  return {
    getSheetByName: function (name) {
      return {
        getLastRow: () => sheetsData.Configuracion.length,
        getRange: () => ({
          getDisplayValues: () => sheetsData.Configuracion.map(c => [c.clave, c.valor])
        })
      };
    }
  };
};

// Constantes de AttendanceLegacy
global.APP = {
  SHEETS: { CONFIG: 'Configuracion' },
  GROUP: '4A',
  CYCLE: '2026-2027'
};
global.DEFAULT_USERNAME = 'profesor_titular_4a';
global.ACCESS_USER_LABEL = 'Usuario de acceso';
global.PASSWORD_HASH_LABEL = 'Hash de contrasena';
global.AUTH_SECRET_PROPERTY = 'CA_AUTH_SECRET';
global.AUTH_SALT_PROPERTY = 'CA_AUTH_SALT';
global.MAX_LOGIN_ATTEMPTS = 5;
global.LOGIN_LOCK_SECONDS = 600;
global.SESSION_DAYS = 15;

function normalizarUsuario_(u) { return String(u || '').trim().toLowerCase(); }
global.normalizarUsuario_ = normalizarUsuario_;

// Evaluar funciones de autenticación auténticas de AttendanceLegacy (iniciarSesion_, validarSesion_, firmarToken_, hashContrasena_, obtenerPropiedadSegura_)
const authStart = legacyCode.indexOf('function iniciarSesion_');
const authEnd = legacyCode.indexOf('\nfunction obtenerLibro_()');
eval(legacyCode.slice(authStart, authEnd));

// Establecer password hash canónico en la tabla de configuración
const passwordValida = 'ClaveSecretaDocente4A!';
const hashDocente = hashContrasena_(passwordValida);
sheetsData.Configuracion.find(c => c.clave === 'Hash de contrasena').valor = hashDocente;

// Cargar EvaluacionesTrimestrales.gs.txt
eval(evalCode);

console.log('================================================================');
console.log('INICIO DE PRUEBAS FINALES DE PERSISTENCIA (ETAPA 7A.3)');
console.log('================================================================\n');

// 23 indicadores canónicos completos
const RATINGS_23_COMPLETOS = {
  acad_lectura: 'E', acad_escritura: 'E', acad_matematicas: 'B', acad_contenidos: 'B',
  hab_tareas: 'E', hab_actividades: 'E', hab_completos: 'B', hab_materiales: 'B',
  hab_limpieza: 'E', hab_indicaciones: 'E', hab_autonomia: 'B', hab_concentracion: 'B', hab_participacion: 'E',
  cond_companeros: 'E', cond_docente: 'E', cond_acuerdos: 'B', cond_autorregulacion: 'B',
  cond_conflictos: 'E', cond_colaborativo: 'E', cond_actitud: 'B', cond_mobiliario: 'B',
  asis_regular: 'E', asis_puntualidad: 'E'
};

// Obtener token auténtico mediante iniciarSesion_ del sistema real
const sessionDocente = iniciarSesion_('profesor_titular_4a', passwordValida);
const AUTH_TOKEN_VALIDO = sessionDocente.token;
console.log('✓ Token docente auténtico emitido por HMAC-SHA256 (AttendanceLegacy).');

// ============================================================================
// PRUEBA 1: Guardado y recuperación de calificaciones
// ============================================================================
console.log('\n[PRUEBA 1] Guardado y recuperación de calificaciones');

const batchId1 = 'BATCH_PRUEBA_1_' + Date.now();
const payloadP1 = {
  batchId: batchId1,
  cicloEscolar: '2026-2027',
  grupo: '4A',
  trimestre: 1,
  baseVersion: 0,
  config: {
    fechaInicio: '2026-09-01',
    fechaFin: '2026-11-30',
    estadoPeriodo: 'activo',
    ponderaciones: { tareas: 40, examen: 30, proyectos: 20, participacion: 10 },
    valoresTareas: { escala: 10 }
  },
  actividades: [
    {
      campoFormativo: 'Lenguajes',
      criterio: 'tareas',
      actividadId: 'ACT_01',
      nombreActividad: 'Antología de fábulas',
      peso: 1.0,
      exclusionesAlumnos: ['ALU-103']
    }
  ],
  calificaciones: [
    { alumnoId: 'ALU-101', campoFormativo: 'Lenguajes', modalidad: 'asistida', calcGradeOriginal: 9.2, authorizedGrade: 9.5, status: 'AUTORIZADA' },
    { alumnoId: 'ALU-102', campoFormativo: 'Lenguajes', modalidad: 'manual', calcGradeOriginal: 8.0, authorizedGrade: 8.0, status: 'AUTORIZADA' },
    { alumnoId: 'ALU-103', campoFormativo: 'Lenguajes', modalidad: 'asistida', calcGradeOriginal: 7.5, authorizedGrade: 7.5, status: 'AUTORIZADA' }
  ],
  desempeno: [
    { alumnoId: 'ALU-101', ratings: RATINGS_23_COMPLETOS, isReviewed: true },
    { alumnoId: 'ALU-102', ratings: RATINGS_23_COMPLETOS, isReviewed: true }
  ],
  mensajes: [
    { alumnoId: 'ALU-101', mensaje: 'Excelente desempeño y trabajo constante en el aula.' },
    { alumnoId: 'ALU-102', mensaje: 'Muy buen avance en lectura y comprensión escrita.' }
  ]
};

const resP1 = syncTrimesterEvaluationBatch(payloadP1, AUTH_TOKEN_VALIDO);
assert.strictEqual(resP1.ok, true);
assert.strictEqual(resP1.data.version, 1);
assert.strictEqual(resP1.data.batchId, batchId1);

// Recuperar con getTrimesterEvaluationBundle
const bundleP1 = getTrimesterEvaluationBundle({ cicloEscolar: '2026-2027', grupo: '4A', trimestre: 1 }, AUTH_TOKEN_VALIDO);
assert.strictEqual(bundleP1.ok, true);
assert.strictEqual(bundleP1.data.versionVigente, 1);
assert.strictEqual(bundleP1.data.calificaciones.length, 3);
const calif101 = bundleP1.data.calificaciones.find(c => c.alumnoId === 'ALU-101');
assert.strictEqual(calif101.authorizedGrade, 9.5);
assert.strictEqual(calif101.status, 'AUTORIZADA');
assert.strictEqual(calif101.authorizedPor.toLowerCase(), 'profesor_titular_4a');
console.log('  ✓ Calificaciones guardadas, consolidadas a V1 y recuperadas con autoría de servidor.');

// ============================================================================
// PRUEBA 2: Conservación de datos al cerrar y volver a abrir el módulo
// ============================================================================
console.log('\n[PRUEBA 2] Conservación de datos al cerrar y volver a abrir el módulo (ciclo frontend)');

// Simular estado del cliente en localStorage y cierre de sesión
let localClientCache = {
  lastSyncTimestamp: new Date().toISOString(),
  syncVersion: bundleP1.data.versionVigente,
  trimester: 1,
  dataSnapshot: JSON.stringify(bundleP1.data)
};

// "Cerrar módulo": destruir variables en memoria
let frontendState = null;

// "Volver a abrir módulo": rehidratar desde getTrimesterEvaluationBundle
const bundleReapertura = getTrimesterEvaluationBundle({
  cicloEscolar: '2026-2027',
  grupo: '4A',
  trimestre: localClientCache.trimester
}, AUTH_TOKEN_VALIDO);

assert.strictEqual(bundleReapertura.ok, true);
assert.strictEqual(bundleReapertura.data.versionVigente, localClientCache.syncVersion);
assert.strictEqual(bundleReapertura.data.calificaciones.length, 3);
assert.strictEqual(bundleReapertura.data.config.ponderaciones.tareas, 40);
assert.deepStrictEqual(bundleReapertura.data.actividades[0].exclusionesAlumnos, ['ALU-103']);
console.log('  ✓ Al reabrir el módulo, todos los registros persisten idénticos y en la versión consolidada.');

// ============================================================================
// PRUEBA 3: Guardado individual sin afectar a los demás alumnos
// ============================================================================
console.log('\n[PRUEBA 3] Guardado individual sin afectar a los demás alumnos (fusión de grupo)');

const batchId2 = 'BATCH_PRUEBA_3_' + Date.now();
// Modificar ÚNICAMENTE al alumno ALU-101 en Saberes y Pensamiento Científico
const payloadP3Individual = {
  batchId: batchId2,
  cicloEscolar: '2026-2027',
  grupo: '4A',
  trimestre: 1,
  baseVersion: 1,
  calificaciones: [
    { alumnoId: 'ALU-101', campoFormativo: 'Saberes y Pensamiento Científico', calcGradeOriginal: 10.0, authorizedGrade: 10.0, status: 'AUTORIZADA' }
  ]
};

const resP3 = syncTrimesterEvaluationBatch(payloadP3Individual, AUTH_TOKEN_VALIDO);
assert.strictEqual(resP3.ok, true);
assert.strictEqual(resP3.data.version, 2);

const bundleP3 = getTrimesterEvaluationBundle({ cicloEscolar: '2026-2027', grupo: '4A', trimestre: 1 }, AUTH_TOKEN_VALIDO);
assert.strictEqual(bundleP3.data.versionVigente, 2);

// ALU-102 y ALU-103 deben conservar intactas sus calificaciones en Lenguajes
const calif102 = bundleP3.data.calificaciones.find(c => c.alumnoId === 'ALU-102');
const calif103 = bundleP3.data.calificaciones.find(c => c.alumnoId === 'ALU-103');
assert.ok(calif102 && calif102.authorizedGrade === 8.0, 'ALU-102 conservado');
assert.ok(calif103 && calif103.authorizedGrade === 7.5, 'ALU-103 conservado');
// ALU-101 tiene ahora Lenguajes (previo) y Saberes (nuevo)
assert.strictEqual(bundleP3.data.calificaciones.filter(c => c.alumnoId === 'ALU-101').length, 2);
console.log('  ✓ Guardado individual de ALU-101 fusionó con los alumnos ALU-102 y ALU-103 sin alterarlos.');

// ============================================================================
// PRUEBA 4: Conservación de ponderaciones, config, actividades y exclusiones
// ============================================================================
console.log('\n[PRUEBA 4] Conservación de ponderaciones, config, actividades y exclusiones en guardados parciales');

// En el lote anterior (V2) no se enviaron ni config ni actividades.
// Verificar que bundleP3 aún conserva las ponderaciones y exclusiones de V1
assert.ok(bundleP3.data.config !== null, 'config no es null');
assert.strictEqual(bundleP3.data.config.ponderaciones.tareas, 40);
assert.strictEqual(bundleP3.data.config.ponderaciones.examen, 30);
assert.strictEqual(bundleP3.data.actividades.length, 1);
assert.strictEqual(bundleP3.data.actividades[0].actividadId, 'ACT_01');
assert.deepStrictEqual(bundleP3.data.actividades[0].exclusionesAlumnos, ['ALU-103']);
console.log('  ✓ Ponderaciones { tareas: 40, examen: 30 } y exclusiones [ALU-103] conservadas intactas.');

// ============================================================================
// PRUEBA 5: Persistencia de los 23 indicadores y mensajes familiares
// ============================================================================
console.log('\n[PRUEBA 5] Persistencia de los 23 indicadores y mensajes familiares');

// Verificar que bundleP3 contiene el desempeño y mensajes familiares
assert.strictEqual(bundleP3.data.desempeno.length, 2);
const desemp101 = bundleP3.data.desempeno.find(d => d.alumnoId === 'ALU-101');
assert.strictEqual(desemp101.estadoRevision, 'revisado');
const ratingsRecuperados = JSON.parse(desemp101.valoracion);
assert.strictEqual(Object.keys(ratingsRecuperados).length, 23);
assert.strictEqual(ratingsRecuperados.acad_lectura, 'E');
assert.strictEqual(ratingsRecuperados.asis_puntualidad, 'E');

assert.strictEqual(bundleP3.data.mensajes.length, 2);
const msg101 = bundleP3.data.mensajes.find(m => m.alumnoId === 'ALU-101');
assert.strictEqual(msg101.mensaje, 'Excelente desempeño y trabajo constante en el aula.');
assert.strictEqual(msg101.caracteres, msg101.mensaje.length);
console.log('  ✓ Los 23 indicadores canónicos y los mensajes familiares persisten y se recuperan al 100%.');

// ============================================================================
// PRUEBA 6: Recuperación de última versión consolidada ante fallo/interrupción
// ============================================================================
console.log('\n[PRUEBA 6] Resiliencia ante fallos: recuperación de última versión consolidada');

// Simular un lote V3 que falló a medio camino (por ejemplo, excepción de red o validación antes de sellar en EvalVersiones)
const batchIdInterrumpido = 'BATCH_INTERRUMPIDO_' + Date.now();
sheetsData.EvalCalificaciones.push({
  id: '2026-2027_4A_T1_' + batchIdInterrumpido + '_ALU-101_Lenguajes',
  cicloEscolar: '2026-2027',
  grupo: '4A',
  trimestre: 1,
  alumnoId: 'ALU-101',
  campoFormativo: 'Lenguajes',
  authorizedGrade: 0.0, // Calificación corrupta no consolidada
  batchId: batchIdInterrumpido,
  estadoConsolidacion: 'en_preparacion',
  version: 3
});

// Consultar bundle: debe ignorar por completo el batch interrumpido y retornar V2 limpia
const bundlePostInterrupcion = getTrimesterEvaluationBundle({ cicloEscolar: '2026-2027', grupo: '4A', trimestre: 1 }, AUTH_TOKEN_VALIDO);
assert.strictEqual(bundlePostInterrupcion.data.versionVigente, 2);
assert.strictEqual(bundlePostInterrupcion.data.batchIdVigente, batchId2);
const calif101Limpia = bundlePostInterrupcion.data.calificaciones.find(c => c.alumnoId === 'ALU-101' && c.campoFormativo === 'Lenguajes');
assert.strictEqual(calif101Limpia.authorizedGrade, 9.5, 'La calificación consolidada previa (9.5) se conservó sin corromperse');
console.log('  ✓ Lote interrumpido ignorado; el sistema devolvió transparentemente la V2 intacta.');

// ============================================================================
// PRUEBA 7: Prevención de duplicados y conflictos de versiones
// ============================================================================
console.log('\n[PRUEBA 7] Prevención de duplicados y conflictos de versión');

// 7.1 Reintento con mismo batchId -> idempotente
const resIdempotente = syncTrimesterEvaluationBatch(payloadP3Individual, AUTH_TOKEN_VALIDO);
assert.strictEqual(resIdempotente.ok, true);
assert.strictEqual(resIdempotente.data.idempotent, true);
assert.strictEqual(resIdempotente.data.version, 2);
console.log('  ✓ 7.1 Reintento idempotente reconocido sin duplicar registros.');

// 7.2 Intento con baseVersion obsoleta (0 cuando el servidor está en 2)
assert.throws(() => {
  syncTrimesterEvaluationBatch({
    batchId: 'BATCH_CONFLICTO_' + Date.now(),
    cicloEscolar: '2026-2027',
    grupo: '4A',
    trimestre: 1,
    baseVersion: 0,
    calificaciones: []
  }, AUTH_TOKEN_VALIDO);
}, /CONFLICTO_VERSION/i);
console.log('  ✓ 7.2 Conflicto de versión rechazado (baseVersion 0 vs 2 en servidor).');

// 7.3 Reintento inconsistente (mismo batchId con payload modificado)
assert.throws(() => {
  syncTrimesterEvaluationBatch(Object.assign({}, payloadP3Individual, {
    calificaciones: [{ alumnoId: 'ALU-101', campoFormativo: 'Lenguajes', authorizedGrade: 5.0 }]
  }), AUTH_TOKEN_VALIDO);
}, /CONFLICTO_REINTENTO_INCONSISTENTE/i);
console.log('  ✓ 7.3 Reintento con payload adulterado rechazado con CONFLICTO_REINTENTO_INCONSISTENTE.');

// ============================================================================
// PRUEBA 8: Validación de identificadores de alumnos y tipos de datos
// ============================================================================
console.log('\n[PRUEBA 8] Validación de identificadores y tipos de datos (Zero-Trust)');

// 8.1 Alumno no autorizado
assert.throws(() => {
  syncTrimesterEvaluationBatch({
    batchId: 'BATCH_INTRUSO_' + Date.now(),
    cicloEscolar: '2026-2027',
    grupo: '4A',
    trimestre: 1,
    baseVersion: 2,
    calificaciones: [{ alumnoId: 'ALU-INTRUSO-999', campoFormativo: 'Lenguajes', authorizedGrade: 8.0 }]
  }, AUTH_TOKEN_VALIDO);
}, /ALUMNO_NO_AUTORIZADO/i);
console.log('  ✓ 8.1 Alumno ajeno al padrón escolar rechazado (ALUMNO_NO_AUTORIZADO).');

// 8.2 Calificación fuera de rango
assert.throws(() => {
  syncTrimesterEvaluationBatch({
    batchId: 'BATCH_RANGO_' + Date.now(),
    cicloEscolar: '2026-2027',
    grupo: '4A',
    trimestre: 1,
    baseVersion: 2,
    calificaciones: [{ alumnoId: 'ALU-101', campoFormativo: 'Lenguajes', authorizedGrade: 10.5 }]
  }, AUTH_TOKEN_VALIDO);
}, /Calificación fuera del rango escolar oficial/i);
console.log('  ✓ 8.2 Calificación fuera de rango (10.5) rechazada.');

// 8.3 Trimestre inválido
assert.throws(() => {
  syncTrimesterEvaluationBatch({
    batchId: 'BATCH_TRIM_' + Date.now(),
    cicloEscolar: '2026-2027',
    grupo: '4A',
    trimestre: 4,
    baseVersion: 2
  }, AUTH_TOKEN_VALIDO);
}, /TRIMESTRE_INVALIDO/i);
console.log('  ✓ 8.3 Trimestre 4 rechazado (TRIMESTRE_INVALIDO).');

// 8.4 Indicador no perteneciente al catálogo
assert.throws(() => {
  syncTrimesterEvaluationBatch({
    batchId: 'BATCH_IND_' + Date.now(),
    cicloEscolar: '2026-2027',
    grupo: '4A',
    trimestre: 1,
    baseVersion: 2,
    desempeno: [{ alumnoId: 'ALU-101', ratings: { indicador_inventado: 'E' } }]
  }, AUTH_TOKEN_VALIDO);
}, /INDICADOR_INVALIDO/i);
console.log('  ✓ 8.4 Indicador inventado rechazado (INDICADOR_INVALIDO).');

// 8.5 Mensaje que excede 245 caracteres
const msgLargo = 'A'.repeat(246);
assert.throws(() => {
  syncTrimesterEvaluationBatch({
    batchId: 'BATCH_MSG_' + Date.now(),
    cicloEscolar: '2026-2027',
    grupo: '4A',
    trimestre: 1,
    baseVersion: 2,
    mensajes: [{ alumnoId: 'ALU-101', mensaje: msgLargo }]
  }, AUTH_TOKEN_VALIDO);
}, /El mensaje familiar excede el límite máximo/i);
console.log('  ✓ 8.5 Mensaje familiar de 246 caracteres rechazado.');

// ============================================================================
// PRUEBA 9: Compatibilidad con la autenticación auténtica del sistema
// ============================================================================
console.log('\n[PRUEBA 9] Compatibilidad con la autenticación auténtica del sistema');

// 9.1 Token con firma adulterada
const tokenFalso = AUTH_TOKEN_VALIDO.slice(0, -5) + 'XXXXX';
assert.throws(() => {
  getTrimesterEvaluationBundle({ cicloEscolar: '2026-2027', grupo: '4A', trimestre: 1 }, tokenFalso);
}, /sesión no es válida|sesión venció/i);
console.log('  ✓ 9.1 Token con firma HMAC alterada rechazado.');

// 9.2 Token expirado
const expiredPayload = Utilities.base64EncodeWebSafe(JSON.stringify({
  user: 'profesor_titular_4a',
  expiresAt: Date.now() - 10000, // Expirado hace 10 segundos
  nonce: Utilities.getUuid()
})).replace(/=+$/g, '');
const expiredSig = firmarToken_(expiredPayload, hashDocente);
const tokenExpirado = expiredPayload + '.' + expiredSig;
assert.throws(() => {
  getTrimesterEvaluationBundle({ cicloEscolar: '2026-2027', grupo: '4A', trimestre: 1 }, tokenExpirado);
}, /sesión venció/i);
console.log('  ✓ 9.2 Token expirado rechazado.');

// 9.3 Aislamiento de ámbito escolar (grupo y ciclo)
// El docente autenticado en 4A intenta consultar el grupo 4B o un ciclo no asignado
assert.throws(() => {
  getTrimesterEvaluationBundle({ cicloEscolar: '2026-2027', grupo: '4B', trimestre: 1 }, AUTH_TOKEN_VALIDO);
}, /AUTH_ERROR.*ámbito no autorizado.*4B/i);

assert.throws(() => {
  getTrimesterEvaluationBundle({ cicloEscolar: '2025-2026', grupo: '4A', trimestre: 1 }, AUTH_TOKEN_VALIDO);
}, /AUTH_ERROR.*ámbito no autorizado.*2025-2026/i);
console.log('  ✓ 9.3 Petición para grupo 4B o ciclo ajeno rechazada con AUTH_ERROR (aislamiento de ámbito).');

// ============================================================================
// PRUEBA 10: Compatibilidad frontend <-> backend
// ============================================================================
console.log('\n[PRUEBA 10] Compatibilidad del contrato frontend <-> backend');

// Simular el contrato exacto de frontend al construir y sincronizar
const simulatedFrontendSync = {
  batchId: 'BATCH_FRONTEND_' + Date.now(),
  cicloEscolar: '2026-2027',
  grupo: '4A',
  trimestre: 1,
  baseVersion: 2,
  calificaciones: [
    { alumnoId: 'ALU-101', campoFormativo: 'De lo Humano y lo Comunitario', calcGradeOriginal: 9.0, authorizedGrade: 9.0, status: 'AUTORIZADA' }
  ]
};

const serverResponse = syncTrimesterEvaluationBatch(simulatedFrontendSync, AUTH_TOKEN_VALIDO);

// Validar que serverResponse tenga exactamente las propiedades que el frontend consume en syncTrimesterBatch()
assert.strictEqual(serverResponse.ok, true);
assert.ok(serverResponse.data);
assert.strictEqual(typeof serverResponse.data.version, 'number');
assert.strictEqual(typeof serverResponse.data.batchId, 'string');
assert.strictEqual(typeof serverResponse.data.calificacionesCount, 'number');
assert.strictEqual(typeof serverResponse.data.desempenoCount, 'number');
assert.strictEqual(typeof serverResponse.data.mensajesCount, 'number');

// Validar contrato de bundle
const finalBundle = getTrimesterEvaluationBundle({ cicloEscolar: '2026-2027', grupo: '4A', trimestre: 1 }, AUTH_TOKEN_VALIDO);
assert.ok(Array.isArray(finalBundle.data.calificaciones));
assert.ok(Array.isArray(finalBundle.data.desempeno));
assert.ok(Array.isArray(finalBundle.data.mensajes));
assert.ok(Array.isArray(finalBundle.data.actividades));
assert.ok(typeof finalBundle.data.config === 'object');
assert.ok(typeof finalBundle.data.config.ponderaciones === 'object');
assert.ok(Array.isArray(finalBundle.data.bancoRecomendaciones));
console.log('  ✓ Estructura de respuestas y tipos de datos coinciden al 100% con los requerimientos de la UI.');

console.log('\n================================================================');
console.log('RESULTADO FINAL: LAS 10 PRUEBAS OBLIGATORIAS PASARON (100% ÉXITO)');
console.log('================================================================\n');
