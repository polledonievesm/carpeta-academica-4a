/**
 * SUITE DE PRUEBAS UNITARIAS: AJUSTES FINALES DEL INSTALADOR Y VALIDACIÓN ESTRICTA
 * ETAPA 7A.3 — Carpeta Académica
 * 
 * Verifica exclusivamente los 3 puntos requeridos:
 * 1. evalValidateTrimester_: validación estricta (rechazo de decimales, cadenas malformadas, booleanos, fuera de [1, 2, 3]).
 * 2. evalValidateStudentId_: rechazo por defecto con PADRON_NO_DISPONIBLE y ALUMNO_NO_AUTORIZADO.
 * 3. Instalador:
 *    - Exigencia estricta de DB_EVALUACIONES (rechazo de DB como sustituto).
 *    - Coincidencia exacta de cantidad, nombre y orden de columnas.
 *    - Comprobación preventiva obligatoria de todas las condiciones antes de crear hojas.
 *    - Uso de skipLockCheck=true para no re-adquirir ScriptLock durante la instalación.
 *    - Cero escrituras en verificación.
 */

const assert = require('assert');
const fs = require('fs');

// Cargar EvaluacionesTrimestrales.gs.txt en contexto simulado
const evalCode = fs.readFileSync('EvaluacionesTrimestrales.gs.txt', 'utf8');

// Entorno simulado de Apps Script
global.SpreadsheetApp = {
  getActiveSpreadsheet: () => mockSpreadsheet,
  flush: () => {}
};
global.Session = {
  getScriptTimeZone: () => 'America/Cancun'
};
global.Utilities = {
  computeDigest: (algo, str) => [1, 2, 3, 4],
  base64Encode: (bytes) => 'mockHash',
  DigestAlgorithm: { SHA_256: 'SHA_256' }
};
global.LockService = {
  getScriptLock: () => mockScriptLock
};
global.validarSesion_ = (token) => ({ ok: true, usuario: 'docente_test' });

let lockCallCount = 0;
let mockScriptLock = {
  tryLock: (timeout) => {
    lockCallCount++;
    return true;
  },
  releaseLock: () => {}
};

// Crear mock de Spreadsheet y Hojas
let mockSheets = {};
let mockSpreadsheet = {
  getSheetByName: (name) => mockSheets[name] || null,
  insertSheet: (name) => {
    mockSheets[name] = createMockSheet(name, []);
    return mockSheets[name];
  }
};

function createMockSheet(name, headers) {
  let h = [...headers];
  return {
    getName: () => name,
    getLastColumn: () => h.length,
    getLastRow: () => (h.length > 0 ? 1 : 0),
    getRange: (row, col, numRows, numCols) => ({
      getValues: () => [h.slice(col - 1, col - 1 + numCols)],
      setValues: (vals) => { h = [...vals[0]]; },
      setFontWeight: () => {},
    }),
    setFrozenRows: () => {}
  };
}

// Ejecutar el código de EvaluacionesTrimestrales en este contexto global
eval(evalCode);

console.log('--- INICIO DE PRUEBAS: AJUSTE FINAL DEL INSTALADOR ---');

// ============================================================================
// PRUEBA 1: evalValidateTrimester_ (Validación estricta)
// ============================================================================
console.log('\n[PRUEBA 1] evalValidateTrimester_');

// 1.1 Rechazo de nulos, indefinidos y booleanos
assert.throws(() => evalValidateTrimester_(null), /TRIMESTRE_INVALIDO.*nulo/i);
assert.throws(() => evalValidateTrimester_(undefined), /TRIMESTRE_INVALIDO.*indefinido/i);
assert.throws(() => evalValidateTrimester_(true), /TRIMESTRE_INVALIDO.*booleano/i);
assert.throws(() => evalValidateTrimester_(false), /TRIMESTRE_INVALIDO.*booleano/i);
console.log('  ✓ 1.1 Rechaza null, undefined, true, false');

// 1.2 Rechazo de decimales
assert.throws(() => evalValidateTrimester_(1.5), /TRIMESTRE_INVALIDO/i);
assert.throws(() => evalValidateTrimester_(2.0001), /TRIMESTRE_INVALIDO/i);
assert.throws(() => evalValidateTrimester_("1.5"), /TRIMESTRE_INVALIDO/i);
console.log('  ✓ 1.2 Rechaza números y cadenas con decimales');

// 1.3 Rechazo de cadenas malformadas o fuera de rango
assert.throws(() => evalValidateTrimester_(""), /TRIMESTRE_INVALIDO/i);
assert.throws(() => evalValidateTrimester_("   "), /TRIMESTRE_INVALIDO/i);
assert.throws(() => evalValidateTrimester_("1abc"), /TRIMESTRE_INVALIDO/i);
assert.throws(() => evalValidateTrimester_("0"), /TRIMESTRE_INVALIDO/i);
assert.throws(() => evalValidateTrimester_(0), /TRIMESTRE_INVALIDO/i);
assert.throws(() => evalValidateTrimester_(4), /TRIMESTRE_INVALIDO/i);
assert.throws(() => evalValidateTrimester_("4"), /TRIMESTRE_INVALIDO/i);
assert.throws(() => evalValidateTrimester_("-1"), /TRIMESTRE_INVALIDO/i);
console.log('  ✓ 1.3 Rechaza cadenas malformadas, vacías y números fuera de [1, 2, 3]');

// 1.4 Aceptación exclusiva de 1, 2 y 3 (entero numérico o cadena válida)
assert.strictEqual(evalValidateTrimester_(1), 1);
assert.strictEqual(evalValidateTrimester_(2), 2);
assert.strictEqual(evalValidateTrimester_(3), 3);
assert.strictEqual(evalValidateTrimester_("1"), 1);
assert.strictEqual(evalValidateTrimester_(" 2 "), 2);
assert.strictEqual(evalValidateTrimester_("3"), 3);
console.log('  ✓ 1.4 Acepta estrictamente 1, 2 y 3 retornando tipo number');

// ============================================================================
// PRUEBA 2: evalValidateStudentId_ (Rechazo por defecto)
// ============================================================================
console.log('\n[PRUEBA 2] evalValidateStudentId_');

// 2.1 Alumno ID vacío
assert.throws(() => evalValidateStudentId_('', { 'ALU-1': true }, '4A'), /ALUMNO_INVALIDO/i);
assert.throws(() => evalValidateStudentId_(null, { 'ALU-1': true }, '4A'), /ALUMNO_INVALIDO/i);
console.log('  ✓ 2.1 Rechaza identificador vacío o nulo');

// 2.2 Padrón vacío, no disponible o nulo (Zero-Trust)
assert.throws(() => evalValidateStudentId_('ALU-1', null, '4A'), /PADRON_NO_DISPONIBLE/i);
assert.throws(() => evalValidateStudentId_('ALU-1', undefined, '4A'), /PADRON_NO_DISPONIBLE/i);
assert.throws(() => evalValidateStudentId_('ALU-1', {}, '4A'), /PADRON_NO_DISPONIBLE/i);
console.log('  ✓ 2.2 Rechaza por defecto cuando el padrón está vacío o no disponible (PADRON_NO_DISPONIBLE)');

// 2.3 Alumno no perteneciente al padrón autorizado
assert.throws(() => evalValidateStudentId_('ALU-INTRUSO', { 'ALU-1': true, 'ALU-2': true }, '4A'), /ALUMNO_NO_AUTORIZADO/i);
console.log('  ✓ 2.3 Rechaza alumno no perteneciente al padrón escolar autorizado (ALUMNO_NO_AUTORIZADO)');

// 2.4 Alumno válido
assert.doesNotThrow(() => evalValidateStudentId_('ALU-1', { 'ALU-1': true, 'ALU-2': true }, '4A'));
console.log('  ✓ 2.4 Acepta alumno existente en padrón escolar');

// ============================================================================
// PRUEBA 3: Instalador — Exigencia estricta de DB_EVALUACIONES (Rechazo de DB)
// ============================================================================
console.log('\n[PRUEBA 3] Instalador — DB_EVALUACIONES estricto');

// Simular DB definido pero DB_EVALUACIONES indefinido
global.DB = { Alumnos: ['id', 'nombre'] };
const originalDBEval = global.DB_EVALUACIONES;
delete global.DB_EVALUACIONES;

// Verificar que migrate rechaza la ausencia de DB_EVALUACIONES y no usa DB
assert.throws(() => migrateEvaluacionesTrimestralesSchema_(mockSpreadsheet), /INSTALACION_ERROR.*DB_EVALUACIONES/i);
console.log('  ✓ 3.1 migrateEvaluacionesTrimestralesSchema_ rechaza ausencia de DB_EVALUACIONES (no usa DB)');

// Verificar que verificarInstalacion reporta la falta de DB_EVALUACIONES
const checkSinDBEval = verificarInstalacionEvaluacionesTrimestrales();
assert.strictEqual(checkSinDBEval.ok, false);
assert.strictEqual(checkSinDBEval.listoParaCrearHojas, false);
assert.ok(checkSinDBEval.dependenciasFaltantes.some(d => d.includes('DB_EVALUACIONES')));
console.log('  ✓ 3.2 verificarInstalacionEvaluacionesTrimestrales no autoriza instalación sin DB_EVALUACIONES');

// Restaurar DB_EVALUACIONES
global.DB_EVALUACIONES = {
  EvalConfig: ['id', 'cicloEscolar', 'grupo', 'trimestre', 'fechaInicio', 'fechaFin', 'estadoPeriodo', 'ponderacionesJson', 'valoresTareasJson', 'valoresConductaJson', 'valoresParticipacionJson', 'configAsistenciaJson', 'ajustesAdminJson', 'batchId', 'version', 'actualizadoEn', 'actualizadoPor'],
  EvalActividades: ['id', 'cicloEscolar', 'grupo', 'trimestre', 'campoFormativo', 'criterio', 'actividadId', 'tipoActividad', 'fechaActividad', 'nombreActividad', 'seleccionada', 'peso', 'exclusionesAlumnosJson', 'batchId', 'version', 'actualizadoEn', 'actualizadoPor'],
  EvalCalificaciones: ['id', 'cicloEscolar', 'grupo', 'trimestre', 'alumnoId', 'numeroLista', 'campoFormativo', 'modalidad', 'desgloseAutoJson', 'desgloseManualJson', 'examenGrade', 'configAplicadaJson', 'actividadesRefJson', 'calcGradeOriginal', 'calcGradePreliminar', 'ajusteManual', 'motivoAjuste', 'authorizedGrade', 'status', 'authorizedAt', 'authorizedPor', 'batchId', 'estadoConsolidacion', 'version', 'actualizadoEn', 'actualizadoPor'],
  EvalDesempeno: ['id', 'cicloEscolar', 'grupo', 'trimestre', 'alumnoId', 'numeroLista', 'indicadorId', 'valoracion', 'catalogoVersion', 'estadoRevision', 'origen', 'trimestreOrigen', 'batchId', 'estadoConsolidacion', 'version', 'actualizadoEn', 'actualizadoPor'],
  EvalMensajes: ['id', 'cicloEscolar', 'grupo', 'trimestre', 'alumnoId', 'numeroLista', 'mensaje', 'caracteres', 'templateId', 'estadoRevision', 'batchId', 'estadoConsolidacion', 'version', 'actualizadoEn', 'actualizadoPor'],
  EvalBancoRecomendaciones: ['id', 'categoria', 'campoFormativo', 'nivel', 'texto', 'caracteres', 'estadoAprobacion', 'activo', 'creadoEn', 'actualizadoEn', 'actualizadoPor', 'version', 'recomendacionId', 'loteVersionId'],
  EvalVersiones: ['id', 'cicloEscolar', 'grupo', 'trimestre', 'alumnoId', 'tipoOperacion', 'batchId', 'versionAnterior', 'versionNueva', 'motivoModificacion', 'snapshotJson', 'payloadHash', 'creadoEn', 'usuario', 'estadoConsolidacion']
};

// ============================================================================
// PRUEBA 4: Coincidencia exacta de cantidad, nombre y orden de columnas
// ============================================================================
console.log('\n[PRUEBA 4] Coincidencia exacta de columnas en hojas existentes');

// 4.1 Hoja con menos columnas que las requeridas
mockSheets = {};
mockSheets['EvalConfig'] = createMockSheet('EvalConfig', ['id', 'cicloEscolar', 'grupo']); // Faltan columnas
let resCheck = verificarInstalacionEvaluacionesTrimestrales();
assert.strictEqual(resCheck.encabezadosCompatibles, false);
assert.strictEqual(resCheck.listoParaCrearHojas, false);
assert.ok(resCheck.erroresEsquema.some(e => e.hoja === 'EvalConfig' && e.error.includes('Cantidad de columnas incompatible')));
console.log('  ✓ 4.1 Rechaza hoja con menor cantidad de columnas');

// 4.2 Hoja con más columnas que las requeridas
let extraHeaders = [...global.DB_EVALUACIONES.EvalConfig, 'columna_extra_invalida'];
mockSheets['EvalConfig'] = createMockSheet('EvalConfig', extraHeaders);
resCheck = verificarInstalacionEvaluacionesTrimestrales();
assert.strictEqual(resCheck.encabezadosCompatibles, false);
assert.strictEqual(resCheck.listoParaCrearHojas, false);
assert.ok(resCheck.erroresEsquema.some(e => e.hoja === 'EvalConfig' && e.error.includes('Cantidad de columnas incompatible')));
console.log('  ✓ 4.2 Rechaza hoja con mayor cantidad de columnas');

// 4.3 Hoja con misma cantidad pero nombre de columna o orden incorrecto
let permutedHeaders = [...global.DB_EVALUACIONES.EvalConfig];
permutedHeaders[0] = 'codigo_identificador'; // En vez de 'id'
mockSheets['EvalConfig'] = createMockSheet('EvalConfig', permutedHeaders);
resCheck = verificarInstalacionEvaluacionesTrimestrales();
assert.strictEqual(resCheck.encabezadosCompatibles, false);
assert.strictEqual(resCheck.listoParaCrearHojas, false);
assert.ok(resCheck.erroresEsquema.some(e => e.hoja === 'EvalConfig' && e.esperado === 'id'));
console.log('  ✓ 4.3 Rechaza hoja con discrepancia en nombre u orden de columnas');

// ============================================================================
// PRUEBA 5: Comprobación preventiva y ScriptLock sin duplicación (skipLockCheck)
// ============================================================================
console.log('\n[PRUEBA 5] Instalador seguro: comprobación previa y skipLockCheck');

// 5.1 aplicarInstalacionEvaluacionesTrimestrales cancela de inmediato si preCheck detecta incompatibilidad
mockSheets['EvalConfig'] = createMockSheet('EvalConfig', ['id_invalido']); // Incompatible
assert.throws(() => aplicarInstalacionEvaluacionesTrimestrales(), /INSTALACION_CANCELADA/i);
console.log('  ✓ 5.1 Cancela antes de crear hojas si preCheck detecta incompatibilidades');

// 5.2 Cuando el libro está limpio (sin hojas incompatibles), verificarInstalacion tiene escrituras: 0
mockSheets = {};
const verifLimpio = verificarInstalacionEvaluacionesTrimestrales();
assert.strictEqual(verifLimpio.escrituras, 0);
assert.strictEqual(verifLimpio.hojasPorCrear.length, 7);
assert.strictEqual(verifLimpio.listoParaCrearHojas, true);
console.log('  ✓ 5.2 Verificación preventiva reporta exactamente 0 escrituras y listoParaCrearHojas: true');

// 5.3 Ejecución de aplicarInstalacionEvaluacionesTrimestrales y uso de skipLockCheck
lockCallCount = 0;
// Resetear hojas
mockSheets = {};
const resultadoInstalacion = aplicarInstalacionEvaluacionesTrimestrales();
assert.strictEqual(resultadoInstalacion.ok, true);
assert.strictEqual(resultadoInstalacion.hojasCreadas.length, 7);
assert.strictEqual(resultadoInstalacion.hojasRestantesPorCrear, 0);

// Comprobar que en postVerificación se usó skipLockCheck=true:
// En toda la corrida de aplicarInstalacionEvaluacionesTrimestrales:
// - preCheck (skipLockCheck=false) -> 1 tryLock
// - evalWithScriptLock_ -> 1 tryLock
// - postVer (skipLockCheck=true) -> 0 tryLock adicionales
assert.strictEqual(lockCallCount, 2, 'lockCallCount debe ser exactamente 2 (preCheck + evalWithScriptLock, sin postVer lock duplicado)');
console.log('  ✓ 5.3 aplicarInstalacionEvaluacionesTrimestrales no genera bloqueo duplicado (skipLockCheck activo)');

console.log('\n=== TODAS LAS PRUEBAS DEL AJUSTE FINAL DEL INSTALADOR PASARON EXITOSAMENTE (100%) ===\n');
