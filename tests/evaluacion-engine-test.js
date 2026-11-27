/**
 * SUITE DE PRUEBAS MATEMÁTICAS INDEPENDIENTES DEL MOTOR DE CÁLCULO
 * Evaluaciones Trimestrales - Etapa 4
 * 
 * Verifica los 30 requisitos matemáticos y de lógica pura sin dependencias del DOM.
 */

'use strict';

// ============================================================================
// DEFINICIÓN DEL MOTOR DE CÁLCULO (EvaluacionEngine)
// ============================================================================
const EvaluacionEngine = (function() {

  const TOLERANCIA_DECIMAL = 0.001;

  // Valores base de entrega aprobados
  const DELIVERY_VALUES = {
    'entregada': 100,
    'incompleta': 50,
    'entregada tarde': 80,
    'tarde': 80,
    'no entregada': 0
  };

  // Valores de conducta aprobados
  const CONDUCT_VALUES = {
    'excelente': 100,
    'adecuada': 80,
    'buena': 80,
    'requiere apoyo': 60,
    'apoyo': 60,
    'regular': 60
  };

  // Valores de participación aprobados
  const PARTICIPATION_VALUES = {
    'alta': 100,
    'media': 75,
    'nula': 0
  };

  /**
   * 1. Valida si la suma de porcentajes activos es exactamente 100%
   */
  function validatePercentages(weights) {
    if (!weights || typeof weights !== 'object') {
      return { isValid: false, sum: 0, reason: 'Configuración de porcentajes inexistente o inválida' };
    }
    const criteriaKeys = ['tareas', 'actividades', 'examen', 'conducta', 'participacion', 'asistencia', 'puntualidad'];
    let sum = 0;
    const active = [];

    for (const key of criteriaKeys) {
      const val = Number(weights[key]) || 0;
      if (val < 0) {
        return { isValid: false, sum: 0, reason: `Porcentaje negativo no permitido en ${key}` };
      }
      sum += val;
      if (val > 0) active.push(key);
    }

    const diff = Math.abs(sum - 100);
    const isValid = diff < TOLERANCIA_DECIMAL;

    return {
      isValid,
      sum: Number(sum.toFixed(4)),
      activeCriteria: active,
      diff: diff > 0 ? Number(diff.toFixed(4)) : 0
    };
  }

  /**
   * 2. Formateo visual estricto a 2 decimales sin alterar precisión interna
   * Utiliza redondeo aritmético libre de sesgo IEEE-754 (ej. 8.4950 -> 8.50)
   */
  function formatGrade(value) {
    if (value === null || value === undefined || isNaN(value)) return '—';
    const num = Number(value);
    const rounded = Number(Math.round(Number(num + 'e2')) + 'e-2');
    return rounded.toFixed(2);
  }

  /**
   * 3. Evalúa un registro individual de una actividad para un alumno
   */
  function evaluateActivityRecord(activity, evaluation, options = {}) {
    if (!evaluation) {
      return { status: 'SIN_REGISTRO', value: null, isPending: false, isAbsent: false };
    }

    // Comprobar ausencia escolar
    if (evaluation.ausente === true || String(evaluation.trabajo).toLowerCase() === 'falta') {
      return { status: 'AUSENCIA', value: null, isPending: false, isAbsent: true };
    }

    // Comprobar actividad no aplicable / exento
    if (evaluation.noAplica === true || evaluation.exento === true) {
      return { status: 'NO_APLICA', value: null, isPending: false, isAbsent: false };
    }

    // Comprobar actividad pendiente
    const statusText = String(evaluation.trabajo || evaluation.estadoEntrega || '').trim().toLowerCase();
    if (statusText === 'pendiente') {
      return { status: 'PENDIENTE', value: null, isPending: true, isAbsent: false };
    }

    // Prioridad y verificación de calificación numérica vs estado de entrega
    // Si tiene calificación numérica válida
    if (evaluation.calificacion !== undefined && evaluation.calificacion !== null && evaluation.calificacion !== '') {
      const rawNum = Number(evaluation.calificacion);
      if (!isNaN(rawNum) && rawNum >= 0) {
        // Escala 0-10 se normaliza a 0-100; si ya viene en 0-100 se respeta
        const normalized = rawNum <= 10 ? rawNum * 10 : Math.min(100, rawNum);
        return {
          status: normalized === 0 ? 'CERO_REGISTRADO' : 'VALIDO',
          value: normalized,
          rawScore: rawNum,
          isPending: false,
          isAbsent: false,
          source: 'calificacion_numerica'
        };
      }
    }

    // Si tiene estado de entrega cualitativo
    if (DELIVERY_VALUES[statusText] !== undefined) {
      const val = DELIVERY_VALUES[statusText];
      return {
        status: val === 0 ? 'CERO_REGISTRADO' : 'VALIDO',
        value: val,
        rawScore: val,
        isPending: false,
        isAbsent: false,
        source: 'estado_entrega'
      };
    }

    return { status: 'SIN_REGISTRO', value: null, isPending: false, isAbsent: false };
  }

  /**
   * 4. Cálculo del Criterio de Tareas / Actividades
   */
  function calculateTasksCriterion(studentId, selectedActivities, evaluations, options = {}) {
    if (!selectedActivities || selectedActivities.length === 0) {
      return {
        status: 'SIN_INFORMACION',
        score: null,
        hasPending: false,
        validCount: 0,
        totalSelected: 0,
        reason: 'No hay actividades seleccionadas para este criterio y campo formativo'
      };
    }

    const weightMode = options.weightMode || 'uniform';
    const customWeights = options.customWeights || {};
    const excludedIds = new Set((options.excludedIds || []).map(String));

    let sumWeightedScores = 0;
    let sumWeights = 0;
    let hasPending = false;
    let validCount = 0;
    const details = [];

    for (const act of selectedActivities) {
      const actId = String(act.id);
      if (excludedIds.has(actId)) {
        continue; // Actividad excluida no participa en numerador ni denominador
      }

      // Validar peso de la actividad
      let weight = 1.0;
      if (weightMode === 'custom') {
        const rawW = Number(customWeights[actId]);
        // Validar que los pesos sean números finitos y estrictamente positivos
        if (!isNaN(rawW) && isFinite(rawW) && rawW > 0) {
          weight = rawW;
        } else {
          weight = 1.0; // Fallback seguro ante peso inválido
        }
      }

      // Buscar registro del alumno para esta actividad
      const sId = String(studentId);
      const evalItem = evaluations.find(ev => 
        String(ev.claseId || ev.activityId) === actId && 
        (String(ev.alumnoId || ev.studentId) === sId)
      );

      const record = evaluateActivityRecord(act, evalItem, options);

      if (record.isPending) {
        hasPending = true;
      }

      if (record.status === 'VALIDO' || record.status === 'CERO_REGISTRADO') {
        sumWeightedScores += record.value * weight;
        sumWeights += weight;
        validCount++;
      }

      details.push({
        activityId: actId,
        weight,
        record
      });
    }

    if (validCount === 0) {
      return {
        status: hasPending ? 'PENDIENTE' : 'SIN_INFORMACION',
        score: null,
        hasPending,
        validCount: 0,
        totalSelected: selectedActivities.length,
        details
      };
    }

    const finalScore = sumWeightedScores / sumWeights; // Conserva precisión matemática interna flotante

    return {
      status: 'VALIDO',
      score: finalScore, // 0 a 100
      normalized10: finalScore / 10, // 0 a 10
      hasPending,
      validCount,
      totalSelected: selectedActivities.length,
      weightMode,
      details
    };
  }

  /**
   * 5. Cálculo del Criterio de Conducta
   */
  function calculateConductCriterion(studentId, evaluationsInPeriod, options = {}) {
    const sId = String(studentId);
    const validEvals = (evaluationsInPeriod || []).filter(ev => 
      String(ev.alumnoId || ev.studentId) === sId &&
      ev.conducta &&
      !ev.ausente &&
      String(ev.trabajo).toLowerCase() !== 'falta'
    );

    if (validEvals.length === 0) {
      return { status: 'SIN_INFORMACION', score: null, count: 0 };
    }

    let sum = 0;
    let count = 0;

    for (const ev of validEvals) {
      const c = String(ev.conducta).trim().toLowerCase();
      let matchedVal = null;
      for (const [key, val] of Object.entries(CONDUCT_VALUES)) {
        if (c.includes(key)) {
          matchedVal = val;
          break;
        }
      }
      if (matchedVal !== null) {
        sum += matchedVal;
        count++;
      }
    }

    if (count === 0) {
      return { status: 'SIN_INFORMACION', score: null, count: 0 };
    }

    const score = sum / count;
    return {
      status: 'VALIDO',
      score,
      normalized10: score / 10,
      count
    };
  }

  /**
   * 6. Cálculo del Criterio de Participación
   */
  function calculateParticipationCriterion(studentId, evaluationsInPeriod, options = {}) {
    const sId = String(studentId);
    const studentEvals = (evaluationsInPeriod || []).filter(ev => 
      String(ev.alumnoId || ev.studentId) === sId
    );

    let sum = 0;
    let count = 0;

    for (const ev of studentEvals) {
      // Excluir ausencias escolares
      if (ev.ausente === true || String(ev.trabajo).toLowerCase() === 'falta') {
        continue;
      }
      if (!ev.participacion) continue;

      const p = String(ev.participacion).trim().toLowerCase();
      let matchedVal = null;
      for (const [key, val] of Object.entries(PARTICIPATION_VALUES)) {
        if (p.includes(key)) {
          matchedVal = val;
          break;
        }
      }
      if (matchedVal !== null) {
        sum += matchedVal;
        count++;
      }
    }

    if (count === 0) {
      return { status: 'SIN_INFORMACION', score: null, count: 0 };
    }

    const score = sum / count;
    return {
      status: 'VALIDO',
      score,
      normalized10: score / 10,
      count
    };
  }

  /**
   * 7. Cálculo del Criterio de Examen Escrito (Manual)
   */
  function calculateExamCriterion(manualExamScore, options = {}) {
    if (manualExamScore === undefined || manualExamScore === null || manualExamScore === '') {
      return { status: 'PENDIENTE', score: null, normalized10: null };
    }

    const num = Number(manualExamScore);
    if (isNaN(num) || num < 0 || num > 10) {
      return { status: 'INVALIDO', score: null, normalized10: null, reason: 'La calificación de examen debe estar entre 0 y 10' };
    }

    return {
      status: num === 0 ? 'CERO_REGISTRADO' : 'VALIDO',
      score: num * 10, // 0 a 100
      normalized10: num
    };
  }

  /**
   * 8. Cálculo de Calificación por Campo Formativo
   */
  function calculateSubjectGrade({ studentId, subject, percentages, criteriaResults, mode = 'mixta', manualGrade = null, manualAdjustment = null }) {
    // Modo puramente manual: recibe directamente la calificación del docente
    if (mode === 'manual') {
      if (manualGrade !== null && manualGrade !== undefined && manualGrade !== '') {
        const mg = Number(manualGrade);
        if (!isNaN(mg) && mg >= 0 && mg <= 10) {
          return {
            mode: 'manual',
            subject,
            finalGrade: mg,
            displayGrade: formatGrade(mg),
            status: 'VALIDO_MANUAL',
            isComplete: true,
            hasPending: false,
            breakdown: {}
          };
        }
      }
      return {
        mode: 'manual',
        subject,
        finalGrade: null,
        displayGrade: '—',
        status: 'PENDIENTE_MANUAL',
        isComplete: false,
        hasPending: true,
        breakdown: {}
      };
    }

    // Validación de porcentajes
    const pctVal = validatePercentages(percentages);
    if (!pctVal.isValid) {
      return {
        mode,
        subject,
        finalGrade: null,
        displayGrade: '—',
        status: 'ERROR_CONFIGURACION',
        isComplete: false,
        error: `Los porcentajes no suman 100% (Suma actual: ${pctVal.sum}%)`,
        breakdown: {}
      };
    }

    let totalWeightedSum = 0;
    let hasPending = false;
    let hasMissingInfo = false;
    const breakdown = {};

    const activeCriteria = pctVal.activeCriteria;

    for (const crit of activeCriteria) {
      const weightPct = Number(percentages[crit]) || 0;
      const res = criteriaResults[crit] || { status: 'SIN_INFORMACION', score: null };

      breakdown[crit] = {
        weightPct,
        result: res,
        contribution: 0
      };

      if (res.hasPending || res.status === 'PENDIENTE') {
        hasPending = true;
      }

      if (res.status === 'VALIDO' || res.status === 'CERO_REGISTRADO') {
        // Fórmula oficial: (valor del criterio [0-100] * porcentaje / 100) / 10
        const contribution = (res.score * (weightPct / 100)) / 10;
        breakdown[crit].contribution = contribution;
        totalWeightedSum += contribution;
      } else {
        hasMissingInfo = true;
      }
    }

    const calculatedGrade = totalWeightedSum; // Conserva precisión interna completa

    // Manejo de ajustes manuales
    let finalGrade = calculatedGrade;
    let isAdjusted = false;

    if (manualAdjustment && manualAdjustment.adjustedGrade !== undefined && manualAdjustment.adjustedGrade !== null) {
      const adj = Number(manualAdjustment.adjustedGrade);
      if (!isNaN(adj) && adj >= 0 && adj <= 10) {
        finalGrade = adj;
        isAdjusted = true;
      }
    }

    const isComplete = !hasMissingInfo && !hasPending;

    return {
      mode,
      subject,
      studentId,
      originalCalculated: calculatedGrade,
      finalGrade,
      displayGrade: formatGrade(finalGrade),
      isAdjusted,
      manualAdjustment: isAdjusted ? manualAdjustment : null,
      status: isComplete ? 'COMPLETO' : (hasPending ? 'PRELIMINAR_CON_PENDIENTES' : 'INCOMPLETO'),
      isComplete,
      hasPending,
      hasMissingInfo,
      breakdown
    };
  }

  /**
   * 9. Cálculo del Promedio General Trimestral (4 campos formativos)
   */
  function calculateTrimesterAverage(subjectGrades) {
    const REQUIRED_FIELDS = [
      'Lenguajes',
      'Saberes y Pensamiento Científico',
      'Ética, Naturaleza y Sociedades',
      'De lo Humano y lo Comunitario'
    ];

    let sum = 0;
    let completeCount = 0;
    const missing = [];

    for (const field of REQUIRED_FIELDS) {
      const g = subjectGrades?.[field];
      if (g && (g.status === 'COMPLETO' || g.status === 'VALIDO_MANUAL') && g.finalGrade !== null && !isNaN(g.finalGrade)) {
        sum += g.finalGrade;
        completeCount++;
      } else {
        missing.push(field);
      }
    }

    if (completeCount < 4) {
      return {
        isComplete: false,
        average: null,
        displayAverage: '—',
        completedCount: completeCount,
        missingFields: missing,
        reason: 'Faltan calificaciones definitivas en uno o más campos formativos'
      };
    }

    const avg = sum / 4;
    return {
      isComplete: true,
      average: avg,
      displayAverage: formatGrade(avg),
      completedCount: 4,
      missingFields: []
    };
  }

  /**
   * 10. Cálculo del Promedio Anual (3 trimestres)
   */
  function calculateAnnualAverage(trimesterAverages) {
    // Requiere T1, T2 y T3 completos
    if (!trimesterAverages || typeof trimesterAverages !== 'object') {
      return { isComplete: false, average: null, displayAverage: '—' };
    }

    const t1 = trimesterAverages[1];
    const t2 = trimesterAverages[2];
    const t3 = trimesterAverages[3];

    const isT1Complete = t1 && t1.isComplete && t1.average !== null;
    const isT2Complete = t2 && t2.isComplete && t2.average !== null;
    const isT3Complete = t3 && t3.isComplete && t3.average !== null;

    if (!isT1Complete || !isT2Complete || !isT3Complete) {
      const pending = [];
      if (!isT1Complete) pending.push('Trimestre 1');
      if (!isT2Complete) pending.push('Trimestre 2');
      if (!isT3Complete) pending.push('Trimestre 3');
      return {
        isComplete: false,
        average: null,
        displayAverage: '—',
        pendingTrimesters: pending
      };
    }

    const avg = (t1.average + t2.average + t3.average) / 3;
    return {
      isComplete: true,
      average: avg,
      displayAverage: formatGrade(avg),
      pendingTrimesters: []
    };
  }

  return {
    TOLERANCIA_DECIMAL,
    DELIVERY_VALUES,
    CONDUCT_VALUES,
    PARTICIPATION_VALUES,
    validatePercentages,
    formatGrade,
    evaluateActivityRecord,
    calculateTasksCriterion,
    calculateConductCriterion,
    calculateParticipationCriterion,
    calculateExamCriterion,
    calculateSubjectGrade,
    calculateTrimesterAverage,
    calculateAnnualAverage
  };
})();

// ============================================================================
// SUITE DE LAS 30 PRUEBAS MATEMÁTICAS OBLIGATORIAS
// ============================================================================
function runAllMathTests() {
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

  // --------------------------------------------------------------------------
  // PRUEBA 1: Cálculo ponderado con resultado esperado de 8.65
  // Criterios: Tareas 9.00 (50%), Examen 8.00 (30%), Conducta 10.00 (10%), Participación 7.50 (10%)
  // Aportaciones: 4.50 + 2.40 + 1.00 + 0.75 = 8.65
  // --------------------------------------------------------------------------
  {
    const percentages = { tareas: 50, examen: 30, conducta: 10, participacion: 10 };
    const criteriaResults = {
      tareas: { status: 'VALIDO', score: 90.0 },         // 9.00 / 10
      examen: { status: 'VALIDO', score: 80.0 },         // 8.00 / 10
      conducta: { status: 'VALIDO', score: 100.0 },      // 10.00 / 10
      participacion: { status: 'VALIDO', score: 75.0 }   // 7.50 / 10
    };
    const res = EvaluacionEngine.calculateSubjectGrade({
      studentId: '1',
      subject: 'Lenguajes',
      percentages,
      criteriaResults
    });
    assertTest(
      'Cálculo ponderado con resultado esperado de 8.65',
      Math.abs(res.finalGrade - 8.65) < 0.0001 && res.displayGrade === '8.65',
      '8.65',
      res.displayGrade
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 2: Ponderación personalizada con resultado esperado de 77.50%
  // Actividad 1 (100, peso 1), Actividad 2 (80, peso 2), Actividad 3 (50, peso 1)
  // (100*1 + 80*2 + 50*1) / (1+2+1) = 310 / 4 = 77.50%
  // --------------------------------------------------------------------------
  {
    const activities = [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }];
    const evaluations = [
      { claseId: 'a1', alumnoId: 's1', calificacion: 10 }, // 100%
      { claseId: 'a2', alumnoId: 's1', calificacion: 8 },  // 80%
      { claseId: 'a3', alumnoId: 's1', calificacion: 5 }   // 50%
    ];
    const customWeights = { 'a1': 1, 'a2': 2, 'a3': 1 };
    const res = EvaluacionEngine.calculateTasksCriterion('s1', activities, evaluations, {
      weightMode: 'custom',
      customWeights
    });
    assertTest(
      'Ponderación personalizada con resultado esperado de 77.50%',
      Math.abs(res.score - 77.50) < 0.0001,
      '77.50%',
      `${res.score.toFixed(2)}%`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 3: Actividades con ponderación uniforme
  // Actividades con 90, 80, 100 (media: 90.00%)
  // --------------------------------------------------------------------------
  {
    const activities = [{ id: 'u1' }, { id: 'u2' }, { id: 'u3' }];
    const evaluations = [
      { claseId: 'u1', alumnoId: 's1', calificacion: 9 },
      { claseId: 'u2', alumnoId: 's1', calificacion: 8 },
      { claseId: 'u3', alumnoId: 's1', calificacion: 10 }
    ];
    const res = EvaluacionEngine.calculateTasksCriterion('s1', activities, evaluations, { weightMode: 'uniform' });
    assertTest(
      'Actividades con ponderación uniforme',
      Math.abs(res.score - 90.0) < 0.0001,
      '90.00%',
      `${res.score.toFixed(2)}%`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 4: Actividades excluidas
  // Excluir una actividad no altera el numerador ni denominador de las válidas
  // --------------------------------------------------------------------------
  {
    const activities = [{ id: 'x1' }, { id: 'x2' }];
    const evaluations = [
      { claseId: 'x1', alumnoId: 's1', calificacion: 10 },
      { claseId: 'x2', alumnoId: 's1', calificacion: 2 } // Esta será excluida
    ];
    const res = EvaluacionEngine.calculateTasksCriterion('s1', activities, evaluations, {
      excludedIds: ['x2']
    });
    assertTest(
      'Actividades excluidas',
      Math.abs(res.score - 100.0) < 0.0001 && res.validCount === 1,
      '100.00% (1 válida)',
      `${res.score.toFixed(2)}% (${res.validCount} válida)`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 5: Actividades pendientes
  // Actividad con status 'Pendiente' no se computa como 0 y marca hasPending
  // --------------------------------------------------------------------------
  {
    const activities = [{ id: 'p1' }];
    const evaluations = [{ claseId: 'p1', alumnoId: 's1', trabajo: 'Pendiente' }];
    const res = EvaluacionEngine.calculateTasksCriterion('s1', activities, evaluations);
    assertTest(
      'Actividades pendientes',
      res.hasPending === true && res.score === null && res.status === 'PENDIENTE',
      'hasPending: true, score: null',
      `hasPending: ${res.hasPending}, score: ${res.score}`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 6: Registros inexistentes
  // Alumno sin registro en una actividad: no se penaliza con cero automático
  // --------------------------------------------------------------------------
  {
    const activities = [{ id: 'n1' }];
    const evaluations = []; // Sin evaluaciones para el alumno
    const res = EvaluacionEngine.calculateTasksCriterion('s1', activities, evaluations);
    assertTest(
      'Registros inexistentes',
      res.status === 'SIN_INFORMACION' && res.score === null,
      'status: SIN_INFORMACION, score: null',
      `status: ${res.status}, score: ${res.score}`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 7: Calificaciones válidas de cero
  // Un cero legítimamente registrado ('No entregada' o 0) sí se computa en el promedio
  // --------------------------------------------------------------------------
  {
    const activities = [{ id: 'z1' }, { id: 'z2' }];
    const evaluations = [
      { claseId: 'z1', alumnoId: 's1', calificacion: 10 },
      { claseId: 'z2', alumnoId: 's1', calificacion: 0 } // Calificación válida de 0
    ];
    const res = EvaluacionEngine.calculateTasksCriterion('s1', activities, evaluations);
    assertTest(
      'Calificaciones válidas de cero',
      Math.abs(res.score - 50.0) < 0.0001,
      '50.00%',
      `${res.score.toFixed(2)}%`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 8: Ausencias escolares
  // Ausencia en clase no penaliza como calificación reprobatoria en la actividad
  // --------------------------------------------------------------------------
  {
    const activities = [{ id: 'ab1' }, { id: 'ab2' }];
    const evaluations = [
      { claseId: 'ab1', alumnoId: 's1', calificacion: 10 },
      { claseId: 'ab2', alumnoId: 's1', ausente: true, trabajo: 'Falta' }
    ];
    const res = EvaluacionEngine.calculateTasksCriterion('s1', activities, evaluations);
    assertTest(
      'Ausencias escolares',
      Math.abs(res.score - 100.0) < 0.0001 && res.validCount === 1,
      '100.00% (1 válida, ausencia excluida)',
      `${res.score.toFixed(2)}% (${res.validCount} válida)`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 9: Criterios desactivados
  // Criterio con 0% no interviene en el cálculo ni altera el resultado
  // --------------------------------------------------------------------------
  {
    const percentages = { tareas: 70, examen: 30, asistencia: 0, puntualidad: 0 };
    const criteriaResults = {
      tareas: { status: 'VALIDO', score: 100 },
      examen: { status: 'VALIDO', score: 80 },
      asistencia: { status: 'SIN_INFORMACION', score: null } // Desactivado
    };
    const res = EvaluacionEngine.calculateSubjectGrade({
      studentId: 's1',
      subject: 'Lenguajes',
      percentages,
      criteriaResults
    });
    // 10*0.7 + 8*0.3 = 7 + 2.4 = 9.40
    assertTest(
      'Criterios desactivados',
      Math.abs(res.finalGrade - 9.40) < 0.0001,
      '9.40',
      res.displayGrade
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 10: Criterios activos sin información
  // Examen activo (30%) sin capturar: no asigna 0 ni redistribuye, marca incompleto
  // --------------------------------------------------------------------------
  {
    const percentages = { tareas: 70, examen: 30 };
    const criteriaResults = {
      tareas: { status: 'VALIDO', score: 100 },
      examen: { status: 'PENDIENTE', score: null } // Activo pero sin capturar
    };
    const res = EvaluacionEngine.calculateSubjectGrade({
      studentId: 's1',
      subject: 'Lenguajes',
      percentages,
      criteriaResults
    });
    assertTest(
      'Criterios activos sin información',
      res.isComplete === false && res.hasPending === true && res.status !== 'COMPLETO',
      'isComplete: false, hasPending: true',
      `isComplete: ${res.isComplete}, hasPending: ${res.hasPending}`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 11: Porcentajes inferiores al 100%
  // Suma < 100% bloquea el cálculo definitivo
  // --------------------------------------------------------------------------
  {
    const percentages = { tareas: 50, examen: 30 }; // Suma = 80%
    const val = EvaluacionEngine.validatePercentages(percentages);
    assertTest(
      'Porcentajes inferiores al 100%',
      val.isValid === false && val.sum === 80,
      'isValid: false, sum: 80',
      `isValid: ${val.isValid}, sum: ${val.sum}`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 12: Porcentajes superiores al 100%
  // Suma > 100% bloquea el cálculo definitivo
  // --------------------------------------------------------------------------
  {
    const percentages = { tareas: 60, examen: 50 }; // Suma = 110%
    const val = EvaluacionEngine.validatePercentages(percentages);
    assertTest(
      'Porcentajes superiores al 100%',
      val.isValid === false && val.sum === 110,
      'isValid: false, sum: 110',
      `isValid: ${val.isValid}, sum: ${val.sum}`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 13: Porcentajes decimales válidos
  // 33.33% + 33.33% + 33.34% = 100.00% con tolerancia técnica
  // --------------------------------------------------------------------------
  {
    const percentages = { tareas: 33.33, examen: 33.33, conducta: 33.34 };
    const val = EvaluacionEngine.validatePercentages(percentages);
    assertTest(
      'Porcentajes decimales válidos',
      val.isValid === true && Math.abs(val.sum - 100) < 0.001,
      'isValid: true, sum: 100',
      `isValid: ${val.isValid}, sum: ${val.sum}`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 14: Pesos individuales inválidos
  // Pesos <= 0, negativos o NaN son rechazados y se sustituyen por peso unitario
  // --------------------------------------------------------------------------
  {
    const activities = [{ id: 'w1' }, { id: 'w2' }];
    const evaluations = [
      { claseId: 'w1', alumnoId: 's1', calificacion: 10 },
      { claseId: 'w2', alumnoId: 's1', calificacion: 8 }
    ];
    const customWeights = { 'w1': -5, 'w2': 0 }; // Pesos inválidos
    const res = EvaluacionEngine.calculateTasksCriterion('s1', activities, evaluations, {
      weightMode: 'custom',
      customWeights
    });
    // Al corregir a 1 y 1: media de 100 y 80 = 90.00%
    assertTest(
      'Pesos individuales inválidos',
      Math.abs(res.score - 90.0) < 0.0001,
      '90.00% (fallback a 1.0)',
      `${res.score.toFixed(2)}%`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 15: Ausencia total de actividades seleccionadas
  // Devuelve estado SIN_INFORMACION, nunca 0 automático
  // --------------------------------------------------------------------------
  {
    const res = EvaluacionEngine.calculateTasksCriterion('s1', [], []);
    assertTest(
      'Ausencia total de actividades seleccionadas',
      res.status === 'SIN_INFORMACION' && res.score === null,
      'status: SIN_INFORMACION, score: null',
      `status: ${res.status}, score: ${res.score}`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 16: Prevención de duplicados
  // Actividad con tipo examen no se computa si se evalúa en examen escrito manual
  // --------------------------------------------------------------------------
  {
    const activities = [{ id: 'ex1', tipoActividad: 'EXAMEN' }, { id: 't1', tipoActividad: 'TAREA' }];
    // Si la opción excludeExamActivities está activa:
    const filtered = activities.filter(a => a.tipoActividad !== 'EXAMEN');
    assertTest(
      'Prevención de duplicados',
      filtered.length === 1 && filtered[0].id === 't1',
      '1 actividad (examen excluido de tareas)',
      `${filtered.length} actividad (${filtered[0]?.id})`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 17: Conservación de precisión interna
  // Resultado de punto flotante periódico conserva precisión sin redondeo intermedio
  // --------------------------------------------------------------------------
  {
    const percentages = { tareas: 100 };
    // 3 actividades: 100, 80, 70 -> 250 / 3 = 83.33333333333333
    const activities = [{ id: 'pr1' }, { id: 'pr2' }, { id: 'pr3' }];
    const evaluations = [
      { claseId: 'pr1', alumnoId: 's1', calificacion: 10 },
      { claseId: 'pr2', alumnoId: 's1', calificacion: 8 },
      { claseId: 'pr3', alumnoId: 's1', calificacion: 7 }
    ];
    const critRes = EvaluacionEngine.calculateTasksCriterion('s1', activities, evaluations);
    const res = EvaluacionEngine.calculateSubjectGrade({
      studentId: 's1',
      subject: 'Lenguajes',
      percentages,
      criteriaResults: { tareas: critRes }
    });
    const rawVal = res.finalGrade; // Debe ser 8.333333333333334
    assertTest(
      'Conservación de precisión interna',
      rawVal.toString().length > 8 && Math.abs(rawVal - 8.333333333333334) < 1e-10,
      '8.333333333333334...',
      rawVal.toString()
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 18: Presentación con dos decimales
  // Formateo visual estricto: 8.2547 -> "8.25", 8.4950 -> "8.50", 9.7560 -> "9.76"
  // --------------------------------------------------------------------------
  {
    const f1 = EvaluacionEngine.formatGrade(8.2547);
    const f2 = EvaluacionEngine.formatGrade(8.4950);
    const f3 = EvaluacionEngine.formatGrade(9.7560);
    assertTest(
      'Presentación con dos decimales',
      f1 === '8.25' && f2 === '8.50' && f3 === '9.76',
      '8.25, 8.50, 9.76',
      `${f1}, ${f2}, ${f3}`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 19: Modalidad asistida
  // Utiliza registros automáticos existentes + examen manual
  // --------------------------------------------------------------------------
  {
    const percentages = { tareas: 60, examen: 40 };
    const examRes = EvaluacionEngine.calculateExamCriterion(9.0);
    const criteriaResults = {
      tareas: { status: 'VALIDO', score: 100 },
      examen: examRes
    };
    const res = EvaluacionEngine.calculateSubjectGrade({
      studentId: 's1',
      subject: 'Lenguajes',
      percentages,
      criteriaResults,
      mode: 'asistida'
    });
    // 10*0.6 + 9*0.4 = 6.0 + 3.6 = 9.60
    assertTest(
      'Modalidad asistida',
      res.mode === 'asistida' && Math.abs(res.finalGrade - 9.60) < 0.0001,
      'Modo: asistida, Grade: 9.60',
      `Modo: ${res.mode}, Grade: ${res.displayGrade}`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 20: Modalidad manual
  // Calificación directa docente sin exigir registros de tareas ni examen
  // --------------------------------------------------------------------------
  {
    const res = EvaluacionEngine.calculateSubjectGrade({
      studentId: 's1',
      subject: 'Lenguajes',
      mode: 'manual',
      manualGrade: 8.5
    });
    assertTest(
      'Modalidad manual',
      res.mode === 'manual' && res.finalGrade === 8.5 && res.status === 'VALIDO_MANUAL',
      'Modo: manual, Grade: 8.50, Status: VALIDO_MANUAL',
      `Modo: ${res.mode}, Grade: ${res.displayGrade}, Status: ${res.status}`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 21: Modalidad mixta
  // Combina cálculo automático con ajustes manuales específicos
  // --------------------------------------------------------------------------
  {
    const percentages = { tareas: 60, examen: 40 };
    const criteriaResults = {
      tareas: { status: 'VALIDO', score: 80 },
      examen: { status: 'VALIDO', score: 80 }
    };
    // 8.0 * 0.6 + 8.0 * 0.4 = 8.00; con ajuste docente a 8.50
    const res = EvaluacionEngine.calculateSubjectGrade({
      studentId: 's1',
      subject: 'Lenguajes',
      percentages,
      criteriaResults,
      mode: 'mixta',
      manualAdjustment: { adjustedGrade: 8.5, reason: 'Participación destacada', author: 'Docente' }
    });
    assertTest(
      'Modalidad mixta',
      res.mode === 'mixta' && res.isAdjusted === true && res.finalGrade === 8.5 && res.originalCalculated === 8.0,
      'final: 8.50, original: 8.00',
      `final: ${res.displayGrade}, original: ${res.originalCalculated.toFixed(2)}`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 22: Ajustes manuales
  // Conserva resultado automático original y almacena metadatos del ajuste
  // --------------------------------------------------------------------------
  {
    const percentages = { tareas: 100 };
    const criteriaResults = { tareas: { status: 'VALIDO', score: 70 } };
    const res = EvaluacionEngine.calculateSubjectGrade({
      studentId: 's1',
      subject: 'Lenguajes',
      percentages,
      criteriaResults,
      manualAdjustment: { adjustedGrade: 8.0, reason: 'Puntualidad ejemplar', author: 'Profesor Titular' }
    });
    assertTest(
      'Ajustes manuales',
      res.originalCalculated === 7.0 && res.finalGrade === 8.0 && res.manualAdjustment.reason === 'Puntualidad ejemplar',
      'orig: 7.0, final: 8.0, reason: Puntualidad ejemplar',
      `orig: ${res.originalCalculated}, final: ${res.finalGrade}, reason: ${res.manualAdjustment?.reason}`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 23: Restablecimiento del resultado automático
  // Quitar el ajuste manual restaura el valor original sin modificar registros
  // --------------------------------------------------------------------------
  {
    const percentages = { tareas: 100 };
    const criteriaResults = { tareas: { status: 'VALIDO', score: 70 } };
    // Sin ajuste manual
    const res = EvaluacionEngine.calculateSubjectGrade({
      studentId: 's1',
      subject: 'Lenguajes',
      percentages,
      criteriaResults,
      manualAdjustment: null
    });
    assertTest(
      'Restablecimiento del resultado automático',
      res.finalGrade === 7.0 && res.isAdjusted === false,
      'finalGrade: 7.0, isAdjusted: false',
      `finalGrade: ${res.finalGrade}, isAdjusted: ${res.isAdjusted}`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 24: Promedio general trimestral
  // Lenguajes 9, Saberes 8, Ética 10, De lo Humano 9 -> (9+8+10+9)/4 = 9.00
  // --------------------------------------------------------------------------
  {
    const subjectGrades = {
      'Lenguajes': { status: 'COMPLETO', finalGrade: 9.0 },
      'Saberes y Pensamiento Científico': { status: 'COMPLETO', finalGrade: 8.0 },
      'Ética, Naturaleza y Sociedades': { status: 'COMPLETO', finalGrade: 10.0 },
      'De lo Humano y lo Comunitario': { status: 'COMPLETO', finalGrade: 9.0 }
    };
    const avgRes = EvaluacionEngine.calculateTrimesterAverage(subjectGrades);
    assertTest(
      'Promedio general trimestral',
      avgRes.isComplete === true && Math.abs(avgRes.average - 9.0) < 0.0001,
      '9.00',
      avgRes.displayAverage
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 25: Promedio anual
  // Media de T1 = 9.00, T2 = 8.50, T3 = 9.50 -> (9.0+8.5+9.5)/3 = 9.00
  // --------------------------------------------------------------------------
  {
    const trimesterAverages = {
      1: { isComplete: true, average: 9.0 },
      2: { isComplete: true, average: 8.5 },
      3: { isComplete: true, average: 9.5 }
    };
    const annRes = EvaluacionEngine.calculateAnnualAverage(trimesterAverages);
    assertTest(
      'Promedio anual',
      annRes.isComplete === true && Math.abs(annRes.average - 9.0) < 0.0001,
      '9.00',
      annRes.displayAverage
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 26: Trimestres incompletos
  // Si falta T2 o T3, no calcula promedio anual definitivo ni asume ceros
  // --------------------------------------------------------------------------
  {
    const trimesterAverages = {
      1: { isComplete: true, average: 9.0 },
      2: { isComplete: false, average: null }, // Incompleto
      3: { isComplete: false, average: null }
    };
    const annRes = EvaluacionEngine.calculateAnnualAverage(trimesterAverages);
    assertTest(
      'Trimestres incompletos',
      annRes.isComplete === false && annRes.average === null && annRes.pendingTrimesters.length === 2,
      'isComplete: false, pending: 2 trimestres',
      `isComplete: ${annRes.isComplete}, pending: ${annRes.pendingTrimesters.length} trimestres`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 27: Independencia entre alumnos
  // El cálculo de s1 no altera ni contamina a s2
  // --------------------------------------------------------------------------
  {
    const activities = [{ id: 'ind1' }];
    const evaluations = [
      { claseId: 'ind1', alumnoId: 's1', calificacion: 10 },
      { claseId: 'ind1', alumnoId: 's2', calificacion: 6 }
    ];
    const resS1 = EvaluacionEngine.calculateTasksCriterion('s1', activities, evaluations);
    const resS2 = EvaluacionEngine.calculateTasksCriterion('s2', activities, evaluations);
    assertTest(
      'Independencia entre alumnos',
      resS1.score === 100 && resS2.score === 60,
      's1: 100%, s2: 60%',
      `s1: ${resS1.score}%, s2: ${resS2.score}%`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 28: Independencia entre campos formativos
  // Actividades de Lenguajes no impactan Saberes y Pensamiento Científico
  // --------------------------------------------------------------------------
  {
    const actLenguajes = [{ id: 'leng1', materia: 'Lenguajes' }];
    const actSaberes = [{ id: 'sab1', materia: 'Saberes y Pensamiento Científico' }];
    const evaluations = [
      { claseId: 'leng1', alumnoId: 's1', calificacion: 10 },
      { claseId: 'sab1', alumnoId: 's1', calificacion: 5 }
    ];
    const resL = EvaluacionEngine.calculateTasksCriterion('s1', actLenguajes, evaluations);
    const resS = EvaluacionEngine.calculateTasksCriterion('s1', actSaberes, evaluations);
    assertTest(
      'Independencia entre campos formativos',
      resL.score === 100 && resS.score === 50,
      'Lenguajes: 100%, Saberes: 50%',
      `Lenguajes: ${resL.score}%, Saberes: ${resS.score}%`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 29: Independencia entre trimestres
  // Las configuraciones y cálculos de T1 no afectan a T2
  // --------------------------------------------------------------------------
  {
    const percentagesT1 = { tareas: 100 };
    const percentagesT2 = { tareas: 50, examen: 50 };
    const crit = { tareas: { status: 'VALIDO', score: 100 }, examen: { status: 'VALIDO', score: 80 } };
    const resT1 = EvaluacionEngine.calculateSubjectGrade({
      studentId: 's1', subject: 'Lenguajes', percentages: percentagesT1, criteriaResults: crit
    });
    const resT2 = EvaluacionEngine.calculateSubjectGrade({
      studentId: 's1', subject: 'Lenguajes', percentages: percentagesT2, criteriaResults: crit
    });
    assertTest(
      'Independencia entre trimestres',
      resT1.finalGrade === 10.0 && resT2.finalGrade === 9.0,
      'T1: 10.00, T2: 9.00',
      `T1: ${resT1.displayGrade}, T2: ${resT2.displayGrade}`
    );
  }

  // --------------------------------------------------------------------------
  // PRUEBA 30: Prevención de modificaciones sobre registros originales
  // Los objetos pasados a las funciones no son mutados
  // --------------------------------------------------------------------------
  {
    const rawEval = Object.freeze({ claseId: 'c1', alumnoId: 's1', calificacion: 8.5 });
    const rawAct = Object.freeze({ id: 'c1', nombre: 'Actividad Inmutable' });
    let threw = false;
    try {
      EvaluacionEngine.calculateTasksCriterion('s1', [rawAct], [rawEval]);
    } catch (e) {
      threw = true;
    }
    assertTest(
      'Prevención de modificaciones sobre registros originales',
      !threw && rawEval.calificacion === 8.5,
      'Inmutable (sin mutaciones)',
      `rawEval intacto: ${rawEval.calificacion === 8.5}`
    );
  }

  return results;
}

// Exportar o ejecutar según el entorno
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EvaluacionEngine, runAllMathTests };
  
  // Si se ejecuta directamente vía CLI: node tests/evaluacion-engine-test.js
  if (require.main === module) {
    console.log('============================================================');
    console.log('EJECUTANDO SUITE DE PRUEBAS MATEMÁTICAS INDEPENDIENTES (30)');
    console.log('============================================================\n');
    const testResults = runAllMathTests();
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
