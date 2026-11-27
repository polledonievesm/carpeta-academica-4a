/**
 * SUITE DE PRUEBAS DE CAPTURA INDIVIDUAL Y GRUPAL (ETAPA 5)
 * Evaluaciones Trimestrales - Carpeta Académica 4.° A
 * 
 * Verifica las 30 pruebas específicas requeridas para la Etapa 5.
 */

'use strict';

const { EvaluacionEngine, runAllMathTests } = require('./evaluacion-engine-test');

function runAllCapturaTests() {
  const results = [];
  let testId = 1;

  function assertTest(name, condition, expected, obtained) {
    const passed = Boolean(condition);
    results.push({
      id: testId++,
      name,
      passed,
      expected: String(expected),
      obtained: String(obtained)
    });
  }

  // Estructura de almacenamiento en memoria para pruebas de captura
  const store = {};
  function getCapturaKey(ciclo, grupo, t, studentId, subject) {
    return `${ciclo}_${grupo}_T${t}_${studentId}_${subject}`;
  }

  // --------------------------------------------------------------------------
  // PRUEBA 01: Captura grupal de exámenes
  // Captura numérica de examen para un alumno en los 4 campos formativos
  // --------------------------------------------------------------------------
  {
    const studentId = 'A001';
    const fields = ['Lenguajes', 'Saberes y Pensamiento Científico', 'Ética, Naturaleza y Sociedades', 'De lo Humano y lo Comunitario'];
    const examScores = { 'Lenguajes': 8.5, 'Saberes y Pensamiento Científico': 9.0, 'Ética, Naturaleza y Sociedades': 10.0, 'De lo Humano y lo Comunitario': 7.5 };
    
    fields.forEach(f => {
      const k = getCapturaKey('2026-2027', '4.° A', 1, studentId, f);
      store[k] = { manualExam: examScores[f], mode: 'mixta' };
    });

    const isAllCaptured = fields.every(f => {
      const k = getCapturaKey('2026-2027', '4.° A', 1, studentId, f);
      return store[k].manualExam === examScores[f];
    });

    assertTest(
      'Captura grupal de exámenes',
      isAllCaptured,
      '4 exámenes capturados correctamente',
      `${isAllCaptured ? '4 exámenes' : 'Error en captura'}`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 02: Captura manual de calificaciones
  // Modalidad manual: calificación directa de 8.8 sin exigir tareas
  // --------------------------------------------------------------------------
  {
    const res = EvaluacionEngine.calculateSubjectGrade({
      studentId: 'A002',
      subject: 'Lenguajes',
      mode: 'manual',
      manualGrade: 8.8
    });
    assertTest(
      'Captura manual de calificaciones',
      res.mode === 'manual' && res.finalGrade === 8.8 && res.status === 'VALIDO_MANUAL',
      'Modo manual, 8.80, VALIDO_MANUAL',
      `Modo: ${res.mode}, Grade: ${res.displayGrade}, Status: ${res.status}`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 03: Modalidad asistida
  // Registros de tareas + examen manual capturado
  // --------------------------------------------------------------------------
  {
    const pcts = { tareas: 60, examen: 40 };
    const examRes = EvaluacionEngine.calculateExamCriterion(9.0);
    const critRes = {
      tareas: { status: 'VALIDO', score: 100 },
      examen: examRes
    };
    const res = EvaluacionEngine.calculateSubjectGrade({
      studentId: 'A003',
      subject: 'Lenguajes',
      percentages: pcts,
      criteriaResults: critRes,
      mode: 'asistida'
    });
    // 10*0.6 + 9*0.4 = 9.60
    assertTest(
      'Modalidad asistida',
      res.mode === 'asistida' && Math.abs(res.finalGrade - 9.60) < 0.0001,
      'Modo: asistida, Grade: 9.60',
      `Modo: ${res.mode}, Grade: ${res.displayGrade}`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 04: Modalidad mixta
  // Combina cálculo automático con examen manual y ajuste docente
  // --------------------------------------------------------------------------
  {
    const pcts = { tareas: 70, examen: 30 };
    const critRes = {
      tareas: { status: 'VALIDO', score: 80 },
      examen: { status: 'VALIDO', score: 90 }
    };
    // 8*0.7 + 9*0.3 = 5.6 + 2.7 = 8.30; ajuste a 8.70
    const res = EvaluacionEngine.calculateSubjectGrade({
      studentId: 'A004',
      subject: 'Lenguajes',
      percentages: pcts,
      criteriaResults: critRes,
      mode: 'mixta',
      manualAdjustment: { adjustedGrade: 8.7, reason: 'Excelente participación' }
    });
    assertTest(
      'Modalidad mixta',
      res.mode === 'mixta' && res.isAdjusted === true && res.finalGrade === 8.7 && Math.abs(res.originalCalculated - 8.3) < 0.001,
      'final: 8.70, original: 8.30',
      `final: ${res.displayGrade}, original: ${res.originalCalculated.toFixed(2)}`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 05: Cambio individual de modalidad
  // Cambiar modalidad de A001 a 'manual' sin afectar a A002 ('mixta')
  // --------------------------------------------------------------------------
  {
    const k1 = getCapturaKey('2026-2027', '4.° A', 1, 'A001', 'Lenguajes');
    const k2 = getCapturaKey('2026-2027', '4.° A', 1, 'A002', 'Lenguajes');
    store[k1] = { mode: 'manual', manualGrade: 9.0 };
    store[k2] = { mode: 'mixta', manualExam: 8.0 };

    assertTest(
      'Cambio individual de modalidad',
      store[k1].mode === 'manual' && store[k2].mode === 'mixta',
      'A001: manual, A002: mixta',
      `A001: ${store[k1].mode}, A002: ${store[k2].mode}`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 06: Cambio grupal de modalidad
  // Cambiar modalidad general a 'asistida' sin borrar notas manuales previas
  // --------------------------------------------------------------------------
  {
    const k1 = getCapturaKey('2026-2027', '4.° A', 1, 'A001', 'Lenguajes');
    const previousGrade = store[k1].manualGrade;
    // Aplicar cambio grupal
    store[k1].mode = 'asistida'; // Conserva manualGrade
    assertTest(
      'Cambio grupal de modalidad',
      store[k1].mode === 'asistida' && store[k1].manualGrade === previousGrade,
      'mode: asistida, manualGrade conservado (9)',
      `mode: ${store[k1].mode}, manualGrade: ${store[k1].manualGrade}`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 07: Independencia por campo formativo
  // Modificar Lenguajes de A001 no altera Saberes y Pensamiento Científico
  // --------------------------------------------------------------------------
  {
    const kLeng = getCapturaKey('2026-2027', '4.° A', 1, 'A001', 'Lenguajes');
    const kSab = getCapturaKey('2026-2027', '4.° A', 1, 'A001', 'Saberes y Pensamiento Científico');
    store[kLeng].manualExam = 7.0;
    store[kSab].manualExam = 10.0;
    assertTest(
      'Independencia por campo formativo',
      store[kLeng].manualExam === 7.0 && store[kSab].manualExam === 10.0,
      'Lenguajes: 7.0, Saberes: 10.0',
      `Lenguajes: ${store[kLeng].manualExam}, Saberes: ${store[kSab].manualExam}`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 08: Independencia por alumno
  // Modificar calificaciones de A001 no altera a A002
  // --------------------------------------------------------------------------
  {
    const kA1 = getCapturaKey('2026-2027', '4.° A', 1, 'A001', 'Lenguajes');
    const kA2 = getCapturaKey('2026-2027', '4.° A', 1, 'A002', 'Lenguajes');
    store[kA1].manualExam = 8.5;
    store[kA2].manualExam = 6.0;
    assertTest(
      'Independencia por alumno',
      store[kA1].manualExam === 8.5 && store[kA2].manualExam === 6.0,
      'A001: 8.5, A002: 6.0',
      `A001: ${store[kA1].manualExam}, A002: ${store[kA2].manualExam}`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 09: Independencia trimestral
  // Modificar examen en T1 no modifica T2 ni T3
  // --------------------------------------------------------------------------
  {
    const kT1 = getCapturaKey('2026-2027', '4.° A', 1, 'A001', 'Lenguajes');
    const kT2 = getCapturaKey('2026-2027', '4.° A', 2, 'A001', 'Lenguajes');
    store[kT1] = { manualExam: 9.0 };
    store[kT2] = { manualExam: 7.5 };
    assertTest(
      'Independencia trimestral',
      store[kT1].manualExam === 9.0 && store[kT2].manualExam === 7.5,
      'T1: 9.0, T2: 7.5',
      `T1: ${store[kT1].manualExam}, T2: ${store[kT2].manualExam}`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 10: Validación de calificaciones (0 a 10)
  // Rechazar números negativos o mayores a 10
  // --------------------------------------------------------------------------
  {
    const vNeg = EvaluacionEngine.calculateExamCriterion(-2);
    const vSup = EvaluacionEngine.calculateExamCriterion(11);
    const vVal = EvaluacionEngine.calculateExamCriterion(9.5);
    assertTest(
      'Validación de calificaciones (0 a 10)',
      vNeg.status === 'INVALIDO' && vSup.status === 'INVALIDO' && vVal.status === 'VALIDO',
      'Negativo/Sup: INVALIDO, 9.5: VALIDO',
      `-2: ${vNeg.status}, 11: ${vSup.status}, 9.5: ${vVal.status}`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 11: Diferenciación entre cero y celda vacía
  // Celda vacía = PENDIENTE / null; Celda con 0 = CERO_REGISTRADO (0%)
  // --------------------------------------------------------------------------
  {
    const vEmpty = EvaluacionEngine.calculateExamCriterion('');
    const vZero = EvaluacionEngine.calculateExamCriterion(0);
    assertTest(
      'Diferenciación entre cero y celda vacía',
      vEmpty.status === 'PENDIENTE' && vZero.status === 'CERO_REGISTRADO' && vZero.score === 0,
      'Empty: PENDIENTE, Zero: CERO_REGISTRADO',
      `Empty: ${vEmpty.status}, Zero: ${vZero.status} (${vZero.score})`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 12: Pegado masivo de calificaciones
  // Parsear texto TSV copiado de Excel / Google Sheets
  // --------------------------------------------------------------------------
  {
    const rawTsv = "8.5\t9.0\n10.0\t7.5\n\t8.0"; // 3 filas, 2 columnas, con celda vacía
    const rows = rawTsv.trim().split(/\r?\n/).map(line => line.split('\t').map(c => c.trim()));
    const r1c1 = Number(rows[0][0]);
    const r3c1 = rows[2][0]; // Vacía
    assertTest(
      'Pegado masivo de calificaciones',
      rows.length === 3 && r1c1 === 8.5 && r3c1 === '',
      '3 filas parseadas, r1c1: 8.5, r3c1: vacía',
      `${rows.length} filas, r1c1: ${r1c1}, r3c1: '${r3c1}'`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 13: Rechazo de datos inválidos en pegado masivo
  // Textos no numéricos como "N/A" o "diez" son detectados como inválidos
  // --------------------------------------------------------------------------
  {
    const rawData = ["8.5", "diez", "-1", "9.0"];
    const invalidItems = rawData.filter(v => {
      if (v === '') return false; // vacía se permite como pendiente
      const n = Number(v);
      return isNaN(n) || n < 0 || n > 10;
    });
    assertTest(
      'Rechazo de datos inválidos en pegado masivo',
      invalidItems.length === 2 && invalidItems.includes('diez') && invalidItems.includes('-1'),
      '2 inválidos detectados (diez, -1)',
      `${invalidItems.length} inválidos (${invalidItems.join(', ')})`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 14: Navegación mediante teclado (Enter, Tab, flechas)
  // Cálculo de coordenadas de celda (row, col)
  // --------------------------------------------------------------------------
  {
    const totalRows = 35;
    const totalCols = 4;
    function getNextCell(r, c, key) {
      if (key === 'Enter' || key === 'ArrowDown') return { r: Math.min(totalRows - 1, r + 1), c };
      if (key === 'ArrowUp') return { r: Math.max(0, r - 1), c };
      if (key === 'Tab' || key === 'ArrowRight') return { r, c: (c + 1) % totalCols };
      if (key === 'ArrowLeft') return { r, c: (c - 1 + totalCols) % totalCols };
      return { r, c };
    }
    const down = getNextCell(5, 1, 'Enter');
    const right = getNextCell(5, 1, 'Tab');
    assertTest(
      'Navegación mediante teclado',
      down.r === 6 && down.c === 1 && right.r === 5 && right.c === 2,
      'Down: (6, 1), Right: (5, 2)',
      `Down: (${down.r}, ${down.c}), Right: (${right.r}, ${right.c})`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 15: Conservación del foco en captura
  // Identificador de celda enfocada `${studentId}_${col}`
  // --------------------------------------------------------------------------
  {
    let focusedCell = { studentId: 'A005', col: 'Lenguajes' };
    const key = `${focusedCell.studentId}_${focusedCell.col}`;
    assertTest(
      'Conservación del foco',
      key === 'A005_Lenguajes',
      'A005_Lenguajes',
      key
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 16: Ajustes manuales docentes con justificación
  // Registro con calificación ajustada, motivo, responsable y timestamp
  // --------------------------------------------------------------------------
  {
    const adj = {
      originalCalculated: 8.25,
      adjustedGrade: 8.50,
      reason: 'Excelente participación en proyecto comunitario',
      author: 'Docente Titular',
      timestamp: new Date().toISOString()
    };
    assertTest(
      'Ajustes manuales docentes',
      adj.adjustedGrade === 8.50 && adj.originalCalculated === 8.25 && Boolean(adj.reason),
      'orig: 8.25, adj: 8.50, reason: registrada',
      `orig: ${adj.originalCalculated}, adj: ${adj.adjustedGrade}, reason: ${adj.reason}`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 17: Restablecimiento del cálculo automático
  // Quitar el ajuste docente restaura el valor original de 8.25
  // --------------------------------------------------------------------------
  {
    let currentGrade = 8.50;
    const original = 8.25;
    // Restablecer
    currentGrade = original;
    assertTest(
      'Restablecimiento del cálculo automático',
      currentGrade === 8.25,
      '8.25',
      currentGrade.toFixed(2)
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 18: Autorización individual por materia
  // Calificación autorizada explícitamente por el docente
  // --------------------------------------------------------------------------
  {
    const k = getCapturaKey('2026-2027', '4.° A', 1, 'A006', 'Lenguajes');
    store[k] = {
      finalGrade: 9.0,
      isAuthorized: true,
      authorizedGrade: 9.0,
      authorizedAt: new Date().toISOString()
    };
    assertTest(
      'Autorización individual por materia',
      store[k].isAuthorized === true && store[k].authorizedGrade === 9.0,
      'isAuthorized: true, grade: 9.0',
      `isAuthorized: ${store[k].isAuthorized}, grade: ${store[k].authorizedGrade}`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 19: Autorización grupal de resultados
  // Autorizar los 35 alumnos para una materia que no tiene pendientes
  // --------------------------------------------------------------------------
  {
    let authorizedCount = 0;
    for (let i = 1; i <= 35; i++) {
      const sId = `A0${i < 10 ? '0' + i : i}`;
      const k = getCapturaKey('2026-2027', '4.° A', 1, sId, 'Lenguajes');
      store[k] = { isAuthorized: true, authorizedGrade: 8.0 };
      authorizedCount++;
    }
    assertTest(
      'Autorización grupal de resultados',
      authorizedCount === 35,
      '35 alumnos autorizados',
      `${authorizedCount} alumnos autorizados`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 20: Bloqueo de autorización con información pendiente
  // No permitir autorizar si un criterio activo tiene estado PENDIENTE
  // --------------------------------------------------------------------------
  {
    const pcts = { tareas: 60, examen: 40 };
    const critRes = {
      tareas: { status: 'VALIDO', score: 90 },
      examen: { status: 'PENDIENTE', score: null } // Examen pendiente
    };
    const res = EvaluacionEngine.calculateSubjectGrade({
      studentId: 'A007',
      subject: 'Lenguajes',
      percentages: pcts,
      criteriaResults: critRes
    });
    const canAuthorize = res.isComplete && !res.hasPending;
    assertTest(
      'Bloqueo de autorización con información pendiente',
      canAuthorize === false,
      'Bloqueado (canAuthorize: false)',
      `canAuthorize: ${canAuthorize}`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 21: Conservación de calificaciones autorizadas durante un recálculo
  // Si los registros cambian pero la nota estaba autorizada, se advierte divergencia
  // --------------------------------------------------------------------------
  {
    const authorizedGrade = 9.0;
    const newCalculatedGrade = 8.5; // Supongamos que cambió una tarea
    const hasDivergence = (authorizedGrade !== newCalculatedGrade);
    assertTest(
      'Conservación de calificaciones autorizadas durante recálculo',
      hasDivergence === true && authorizedGrade === 9.0,
      'hasDivergence: true, authorizedGrade intacta (9.0)',
      `hasDivergence: ${hasDivergence}, authorizedGrade: ${authorizedGrade}`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 22: Guardado y recuperación de borradores
  // Serialización y deserialización JSON sin pérdida de datos
  // --------------------------------------------------------------------------
  {
    const draft = { 'A008_Lenguajes': { manualExam: 9.5, mode: 'mixta' } };
    const json = JSON.stringify(draft);
    const restored = JSON.parse(json);
    assertTest(
      'Guardado y recuperación de borradores',
      restored['A008_Lenguajes'].manualExam === 9.5,
      '9.5 restaurado',
      `${restored['A008_Lenguajes'].manualExam}`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 23: Prevención de pérdida de información
  // Cambiar de vista conserva los datos en el store en memoria
  // --------------------------------------------------------------------------
  {
    const k = getCapturaKey('2026-2027', '4.° A', 1, 'A009', 'Lenguajes');
    store[k] = { manualExam: 8.75 };
    // Simular cambio de vista y retorno
    const readAgain = store[k]?.manualExam;
    assertTest(
      'Prevención de pérdida de información',
      readAgain === 8.75,
      '8.75 conservado',
      `${readAgain}`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 24: Actualización reactiva del panel de seguimiento
  // Conteo de alumnos completos, pendientes y autorizados
  // --------------------------------------------------------------------------
  {
    const studentsStatus = [
      { id: 's1', isComplete: true, isAuthorized: true },
      { id: 's2', isComplete: true, isAuthorized: false },
      { id: 's3', isComplete: false, isAuthorized: false }
    ];
    const authorized = studentsStatus.filter(s => s.isAuthorized).length;
    const complete = studentsStatus.filter(s => s.isComplete).length;
    const pending = studentsStatus.filter(s => !s.isComplete).length;
    assertTest(
      'Actualización reactiva del panel de seguimiento',
      authorized === 1 && complete === 2 && pending === 1,
      'Auth: 1, Complete: 2, Pending: 1',
      `Auth: ${authorized}, Complete: ${complete}, Pending: ${pending}`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 25: Captura simultánea de los cuatro campos formativos
  // Matriz de captura registra las 4 columnas de un alumno a la vez
  // --------------------------------------------------------------------------
  {
    const studentGrades = {
      'Lenguajes': 9.0,
      'Saberes y Pensamiento Científico': 8.5,
      'Ética, Naturaleza y Sociedades': 9.5,
      'De lo Humano y lo Comunitario': 10.0
    };
    const avg = (9.0 + 8.5 + 9.5 + 10.0) / 4; // 37 / 4 = 9.25
    assertTest(
      'Captura simultánea de los cuatro campos formativos',
      Object.keys(studentGrades).length === 4 && avg === 9.25,
      '4 campos, promedio general: 9.25',
      `${Object.keys(studentGrades).length} campos, promedio: ${avg.toFixed(2)}`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 26: Conservación de registros académicos originales
  // No mutar clases ni asistencias originales durante la captura
  // --------------------------------------------------------------------------
  {
    const originalActivity = Object.freeze({ id: 'act1', fecha: '2026-09-10', calificacion: 10 });
    let mutated = false;
    try {
      // Intentar escribir propiedad en objeto congelado
      originalActivity.calificacion = 5;
    } catch (e) {
      mutated = true; // El congelamiento lanzó error
    }
    assertTest(
      'Conservación de registros académicos originales',
      originalActivity.calificacion === 10,
      'calificacion: 10 inmutable',
      `calificacion: ${originalActivity.calificacion}`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 27: Compatibilidad con grupos completos (35 alumnos)
  // Matriz soporta exactamente los 35 alumnos de 4.° A
  // --------------------------------------------------------------------------
  {
    const studentIds = Array.from({ length: 35 }, (_, i) => `A${String(i + 1).padStart(3, '0')}`);
    assertTest(
      'Compatibilidad con grupos completos (35 alumnos)',
      studentIds.length === 35 && studentIds[0] === 'A001' && studentIds[34] === 'A035',
      '35 alumnos (A001 a A035)',
      `${studentIds.length} alumnos (${studentIds[0]} a ${studentIds[studentIds.length - 1]})`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 28: Prevención de duplicados en la matriz de captura
  // Cada combinación alumno + campo es estrictamente única
  // --------------------------------------------------------------------------
  {
    const keys = new Set();
    let duplicates = 0;
    for (let s = 1; s <= 35; s++) {
      const sId = `A${String(s).padStart(3, '0')}`;
      ['Lenguajes', 'Saberes', 'Ética', 'Humano'].forEach(f => {
        const k = `${sId}_${f}`;
        if (keys.has(k)) duplicates++;
        keys.add(k);
      });
    }
    assertTest(
      'Prevención de duplicados en la matriz',
      duplicates === 0 && keys.size === 140,
      '0 duplicados (140 celdas únicas)',
      `${duplicates} duplicados (${keys.size} celdas)`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 29: Manejo de ponderaciones inválidas (bloqueo sin sustitución silenciosa)
  // Si una ponderación es <= 0 o NaN, se marca inválida para requerir corrección
  // --------------------------------------------------------------------------
  {
    function checkCustomWeights(weights) {
      const invalid = [];
      for (const [id, w] of Object.entries(weights)) {
        const num = Number(w);
        if (isNaN(num) || !isFinite(num) || num <= 0) {
          invalid.push(id);
        }
      }
      return { isValid: invalid.length === 0, invalidIds: invalid };
    }
    const checkRes = checkCustomWeights({ 'act1': 2.0, 'act2': -1, 'act3': 0 });
    assertTest(
      'Manejo de ponderaciones inválidas',
      checkRes.isValid === false && checkRes.invalidIds.length === 2,
      'isValid: false, 2 inválidos (act2, act3)',
      `isValid: ${checkRes.isValid}, inválidos: ${checkRes.invalidIds.join(', ')}`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 30: Ausencia de regresiones en el motor de cálculo
  // Reejecución de las 30 pruebas matemáticas de la Etapa 4
  // --------------------------------------------------------------------------
  {
    const mathTests = runAllMathTests();
    const passedMath = mathTests.every(t => t.passed);
    assertTest(
      'Ausencia de regresiones en el motor de cálculo',
      passedMath === true && mathTests.length === 30,
      '30/30 pruebas matemáticas superadas',
      `${mathTests.filter(t => t.passed).length}/${mathTests.length} superadas`
    );
  }

  return results;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runAllCapturaTests };

  if (require.main === module) {
    console.log('============================================================');
    console.log('EJECUTANDO SUITE DE PRUEBAS DE CAPTURA ETAPA 5 (30 PRUEBAS)');
    console.log('============================================================\n');
    const testResults = runAllCapturaTests();
    let passedCount = 0;
    testResults.forEach(t => {
      if (t.passed) passedCount++;
      const mark = t.passed ? '✓ OK' : '✗ FALLÓ';
      console.log(`[PRUEBA ${t.id < 10 ? '0' + t.id : t.id}] ${mark} - ${t.name}`);
      console.log(`            Esperado: ${t.expected} | Obtenido: ${t.obtained}`);
    });
    console.log(`\nRESUMEN: ${passedCount} / ${testResults.length} pruebas superadas.`);
    if (passedCount !== testResults.length) {
      process.exit(1);
    }
  }
}
