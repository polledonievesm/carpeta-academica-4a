/**
 * CARPETA ACADÉMICA 4.° A - FIXTURE DEL MODO DEMOSTRACIÓN DEL PORTAL FAMILIAR
 * Datos exclusivamente ficticios para auditoría visual y pruebas en entorno local.
 * NO CONTIENE DATOS REALES NI CREDENCIALES VÁLIDAS.
 */
(function () {
  'use strict';

  const DEMO_STUDENT = {
    id: 'DEMO-001',
    name: 'MATEO HERNÁNDEZ LÓPEZ (DEMOSTRACIÓN)',
    listNumber: '00',
    curp: 'HELM160315HQRNPD01',
    fechaNacimiento: '15 de marzo de 2016'
  };

  const DEMO_SCHOOL = {
    name: 'Escuela Primaria Francisco Hoil Torres T.V.',
    group: '4.º A',
    cycle: 'Ciclo escolar 2026–2027',
    shift: 'Turno vespertino',
    cct: '23DPR0136V',
    teacher: 'Prof. Michel Otaner Polledo Nieves',
    totalWeeks: 41
  };

  const DEMO_ACCOUNT = {
    username: 'demo.tutor',
    email: 'demo@example.invalid',
    phone: 'TELÉFONO FICTICIO NO UTILIZABLE',
    mustChangePassword: false,
    lastAccess: 'Hoy a las 08:00 hrs (Sesión demostrativa)'
  };

  // Estado inicial incompleto para activar el popup real #familyIncompleteNoticeDialog
  const INCOMPLETE_PROFILE = {
    alumnoApellidoPaterno: 'HERNÁNDEZ',
    alumnoApellidoMaterno: 'LÓPEZ',
    alumnoNombres: 'MATEO',
    tutorApellidoPaterno: 'HERNÁNDEZ',
    tutorApellidoMaterno: 'PÉREZ',
    tutorNombres: 'TUTOR DE DEMOSTRACIÓN',
    tutorParentesco: 'Madre, padre o tutor',
    tutorTelefono: '', // Pendiente para activar popup
    tutorTelefonoAlterno: '',
    calle: '', // Incompleto para activar popup
    numeroExterior: '',
    numeroInterior: '',
    entreCalles: '',
    colonia: '',
    region: '',
    codigoPostal: '',
    referencias: '',
    contactoEmergenciaNombre: '',
    contactoEmergencia: '',
    dataConfirmedAt: null
  };

  // Estado completo simulado al confirmar datos
  const COMPLETE_PROFILE = {
    alumnoApellidoPaterno: 'HERNÁNDEZ',
    alumnoApellidoMaterno: 'LÓPEZ',
    alumnoNombres: 'MATEO',
    tutorApellidoPaterno: 'HERNÁNDEZ',
    tutorApellidoMaterno: 'PÉREZ',
    tutorNombres: 'TUTOR DE DEMOSTRACIÓN',
    tutorParentesco: 'Padre',
    tutorTelefono: 'TELÉFONO FICTICIO NO UTILIZABLE',
    tutorTelefonoAlterno: 'TELÉFONO FICTICIO NO UTILIZABLE',
    calle: 'Calle Ficticia Demostración 4-A',
    numeroExterior: '123',
    numeroInterior: '',
    entreCalles: 'Entre Calle Demo y Av. Simulación',
    colonia: 'Fraccionamiento Demostración',
    region: 'Región 00',
    codigoPostal: '77500',
    referencias: 'Fachada blanca con cancel gris (Domicilio ficticio de prueba)',
    contactoEmergenciaNombre: 'FAMILIAR DE EMERGENCIA DEMO',
    contactoEmergencia: 'FAMILIAR DE EMERGENCIA DEMO',
    contactoEmergenciaTelefono: 'TELÉFONO FICTICIO NO UTILIZABLE',
    dataConfirmedAt: '2026-11-10T08:00:00Z'
  };

  const DEMO_CONTACTS = [
    {
      id: 'contact-demo-1',
      apellidoPaterno: 'HERNÁNDEZ',
      apellidoMaterno: 'RUIZ',
      nombres: 'PRIMERA PERSONA FICTICIA',
      parentesco: 'Tía',
      telefono: 'TELÉFONO FICTICIO NO UTILIZABLE'
    },
    {
      id: 'contact-demo-2',
      apellidoPaterno: 'LÓPEZ',
      apellidoMaterno: 'GÓMEZ',
      nombres: 'SEGUNDA PERSONA FICTICIA',
      parentesco: 'Abuelo',
      telefono: 'TELÉFONO FICTICIO NO UTILIZABLE'
    },
    {
      id: 'contact-demo-3',
      apellidoPaterno: '',
      apellidoMaterno: '',
      nombres: '',
      parentesco: '',
      telefono: ''
    }
  ];

  // =========================================================================
  // SEMANA 1
  // Asistencia perfecta L-V (100%), 2 tareas entregadas, 1 pendiente
  // Conducta adecuada (9.2), participación alta, observación positiva
  // =========================================================================
  const WEEK_1_DATA = {
    trimester: 1,
    periodLabel: 'Semana 1 · Del 31 de agosto al 4 de septiembre de 2026',
    updatedAt: '2026-09-04T18:00:00Z',
    taskSummary: { completed: 2, total: 3, percentage: 66.7 },
    attendanceSummary: {
      attended: 5,
      total: 5,
      percentage: 100,
      late: 0,
      justifiedDates: [],
      absenceDates: [],
      lateDates: []
    },
    conductSummary: { score: 9.2, label: 'Adecuada' },
    participationSummary: { score: 9.5, label: 'Alta' },
    observation: 'Mateo muestra excelente disposición para el trabajo cooperativo y cumple con entusiasmo sus actividades escolares.',
    weeklyTasks: [
      {
        start: '2026-08-31',
        completed: 2,
        pending: 1,
        tasks: [
          {
            date: '2026-08-31',
            start: '13:30',
            end: '14:30',
            title: 'Lectura y comprensión: Conociendo mi comunidad',
            source: 'Lenguajes',
            type: 'Actividad en clase',
            material: 'Libro de proyectos comunitarios',
            pages: '12 a 15',
            project: 'Comunitario',
            status: 'Entregada',
            feedback: 'Excelente comprensión lectora y trazo claro.',
            instructions: 'Leer el texto y responder el cuestionario de las páginas indicadas.'
          },
          {
            date: '2026-09-02',
            start: '14:30',
            end: '15:30',
            title: 'Desafíos matemáticos: Sumas y restas con transformación',
            source: 'Saberes y Pensamiento Científico',
            type: 'Evidencia práctica',
            material: 'Cuaderno de cuadrícula',
            project: 'Aula',
            status: 'Entregada',
            feedback: 'Planteamientos y operaciones resueltos correctamente.',
            instructions: 'Resolver los 5 problemas razonados en el cuaderno.'
          },
          {
            date: '2026-09-04',
            start: '16:00',
            end: '17:00',
            title: 'Ficha de convivencia democrática y acuerdos de aula',
            source: 'Ética, Naturaleza y Sociedades',
            type: 'Tarea complementaria',
            material: 'Ficha impresa',
            project: 'Escolar',
            status: 'Pendiente',
            feedback: '',
            opportunities: 'Entregar en la primera sesión de la siguiente semana.',
            instructions: 'Ilustrar los acuerdos de convivencia y solicitar firma del tutor.'
          }
        ]
      }
    ],
    fields: [
      {
        name: 'Lenguajes',
        grade: 9.5,
        completed: 1,
        total: 1,
        scores: { Tareas: 10, Asistencia: 10, Conducta: 9.5, Participación: 9.5, Examen: 9.0 },
        weights: [
          { criterio: 'Tareas', porcentaje: 30 },
          { criterio: 'Asistencia', porcentaje: 20 },
          { criterio: 'Conducta', porcentaje: 20 },
          { criterio: 'Participación', porcentaje: 20 },
          { criterio: 'Examen', porcentaje: 10 }
        ],
        pending: [],
        tasks: [
          {
            date: '2026-08-31',
            name: 'Lectura y comprensión: Conociendo mi comunidad',
            title: 'Lectura y comprensión: Conociendo mi comunidad',
            status: 'Entregada',
            source: 'Lenguajes'
          }
        ]
      },
      {
        name: 'Saberes y Pensamiento Científico',
        grade: 9.0,
        completed: 1,
        total: 1,
        sources: [
          { name: 'Matemático', grade: 9.2, completed: 1, total: 1 },
          { name: 'Científico', grade: 8.8, completed: 0, total: 0 }
        ],
        scores: { Tareas: 9.5, Asistencia: 10, Conducta: 9.0, Participación: 9.0 },
        weights: [
          { criterio: 'Tareas', porcentaje: 35 },
          { criterio: 'Asistencia', porcentaje: 25 },
          { criterio: 'Conducta', porcentaje: 20 },
          { criterio: 'Participación', porcentaje: 20 }
        ],
        pending: [],
        tasks: [
          {
            date: '2026-09-02',
            name: 'Desafíos matemáticos: Sumas y restas con transformación',
            title: 'Desafíos matemáticos: Sumas y restas con transformación',
            status: 'Entregada',
            source: 'Saberes y Pensamiento Científico'
          }
        ]
      },
      {
        name: 'Ética, Naturaleza y Sociedades',
        grade: 8.8,
        completed: 0,
        total: 1,
        scores: { Tareas: 7.0, Asistencia: 10, Conducta: 9.0, Participación: 9.0 },
        weights: [
          { criterio: 'Tareas', porcentaje: 30 },
          { criterio: 'Asistencia', porcentaje: 20 },
          { criterio: 'Conducta', porcentaje: 25 },
          { criterio: 'Participación', porcentaje: 25 }
        ],
        pending: [
          {
            status: 'Pendiente',
            name: 'Ficha de convivencia democrática y acuerdos de aula',
            date: '2026-09-04',
            source: 'Ética, Naturaleza y Sociedades',
            project: 'Escolar'
          }
        ],
        tasks: []
      },
      {
        name: 'De lo Humano y lo Comunitario',
        grade: 9.2,
        completed: 0,
        total: 0,
        scores: { Asistencia: 10, Conducta: 9.5, Participación: 9.5 },
        weights: [
          { criterio: 'Asistencia', porcentaje: 30 },
          { criterio: 'Conducta', porcentaje: 35 },
          { criterio: 'Participación', porcentaje: 35 }
        ],
        pending: [],
        tasks: []
      }
    ],
    weeklyReport: {
      student: DEMO_STUDENT,
      school: DEMO_SCHOOL,
      period: { start: '2026-08-31', end: '2026-09-04' },
      attendance: {
        records: [
          { date: '2026-08-31', status: 'A' },
          { date: '2026-09-01', status: 'A' },
          { date: '2026-09-02', status: 'A' },
          { date: '2026-09-03', status: 'A' },
          { date: '2026-09-04', status: 'A' }
        ],
        justificationNotes: []
      },
      tasks: [
        {
          date: '2026-08-31',
          source: 'Lenguajes',
          title: 'Lectura y comprensión: Conociendo mi comunidad',
          type: 'Actividad en clase',
          material: 'Libro de proyectos comunitarios',
          pages: '12 a 15',
          instructions: 'Lectura y análisis de textos informativos.',
          status: 'Entregada'
        },
        {
          date: '2026-09-02',
          source: 'Saberes y Pensamiento Científico',
          title: 'Desafíos matemáticos: Sumas y restas con transformación',
          type: 'Evidencia práctica',
          material: 'Cuaderno de cuadrícula',
          instructions: 'Resolución de operaciones y problemas razonados.',
          status: 'Entregada'
        },
        {
          date: '2026-09-04',
          source: 'Ética, Naturaleza y Sociedades',
          title: 'Ficha de convivencia democrática y acuerdos de aula',
          type: 'Tarea complementaria',
          material: 'Ficha impresa',
          instructions: 'Reflexión y dibujo sobre los acuerdos en el salón.',
          status: 'Pendiente'
        }
      ],
      learnings: [
        {
          title: 'Comprensión y producción de textos informativos',
          pda: 'Identifica ideas centrales y secundarias en textos de interés comunitario.',
          level: 'Consolidado'
        },
        {
          title: 'Resolución de situaciones problemáticas con sumas y restas',
          pda: 'Aplica el algoritmo convencional en situaciones vinculadas a su contexto cotidiano.',
          level: 'En desarrollo'
        }
      ],
      achievements: [
        'Excelente integración y participación activa en los primeros proyectos colaborativos del ciclo escolar.'
      ],
      observations: [
        {
          category: 'Desempeño general',
          text: 'Mateo muestra excelente disposición para el trabajo cooperativo y cumple con entusiasmo sus actividades escolares.'
        },
        {
          category: 'Participación en clase',
          text: 'Participación alta y respetuosa durante las dinámicas grupales.'
        }
      ],
      guidance: [
        'Mantener el hábito de revisión diaria del horario y útiles escolares.',
        'Dedicar 15 minutos de lectura en voz alta en el hogar.'
      ]
    }
  };

  // =========================================================================
  // SEMANA 2
  // Lunes: A, Martes: R (retardo), Miércoles: A, Jueves: J (justificada), Viernes: A
  // 1 tarea entregada, 1 incompleta, 1 entregada tarde
  // Conducta adecuada (8.0), participación media, observación de seguimiento
  // =========================================================================
  const WEEK_2_DATA = {
    trimester: 1,
    periodLabel: 'Semana 2 · Del 7 al 11 de septiembre de 2026',
    updatedAt: '2026-09-11T18:00:00Z',
    taskSummary: { completed: 2, total: 3, percentage: 66.7 },
    attendanceSummary: {
      attended: 4,
      total: 5,
      percentage: 80,
      late: 1,
      justifiedDates: ['2026-09-10'],
      absenceDates: [],
      lateDates: ['2026-09-08']
    },
    conductSummary: { score: 8.0, label: 'Adecuada' },
    participationSummary: { score: 8.0, label: 'Media' },
    observation: 'Se sugiere repasar en casa las lecturas diarias y apoyar en la entrega puntual de las tareas complementarias.',
    weeklyTasks: [
      {
        start: '2026-09-07',
        completed: 2,
        pending: 0,
        tasks: [
          {
            date: '2026-09-07',
            start: '13:30',
            end: '14:30',
            title: 'Cartel ecológico: Reducción y reciclaje en la escuela',
            source: 'Ética, Naturaleza y Sociedades',
            type: 'Proyecto colaborativo',
            material: 'Cartulina y colores',
            project: 'Escolar',
            status: 'Entregada',
            feedback: 'Buena propuesta y mensaje gráfico claro.',
            instructions: 'Elaborar un cartel sobre el cuidado del agua y la basura.'
          },
          {
            date: '2026-09-09',
            start: '14:30',
            end: '15:30',
            title: 'Investigación: Ecosistemas y fauna de Quintana Roo',
            source: 'Saberes y Pensamiento Científico',
            type: 'Reporte de indagación',
            material: 'Libro de proyectos y recortes',
            project: 'Comunitario',
            status: 'Incompleta',
            feedback: 'Faltó incluir la tabla comparativa y conclusiones.',
            opportunities: 'Completar el apartado de conclusiones para evaluación.',
            instructions: 'Describir 3 especies locales y su relación con el hábitat.'
          },
          {
            date: '2026-09-11',
            start: '16:00',
            end: '17:00',
            title: 'Redacción narrativa: Una anécdota en mi familia',
            source: 'Lenguajes',
            type: 'Texto libre',
            material: 'Cuaderno de líneas',
            project: 'Aula',
            status: 'Entregada tarde',
            feedback: 'Entregada con retraso debido a cita médica; contenido bien estructurado.',
            instructions: 'Escribir inicio, desarrollo y desenlace de una experiencia personal.'
          }
        ]
      }
    ],
    fields: [
      {
        name: 'Lenguajes',
        grade: 8.5,
        completed: 1,
        total: 1,
        scores: { Tareas: 8.0, Asistencia: 8.5, Conducta: 8.5, Participación: 8.0, Examen: 8.5 },
        weights: [
          { criterio: 'Tareas', porcentaje: 30 },
          { criterio: 'Asistencia', porcentaje: 20 },
          { criterio: 'Conducta', porcentaje: 20 },
          { criterio: 'Participación', porcentaje: 20 },
          { criterio: 'Examen', porcentaje: 10 }
        ],
        pending: [],
        tasks: [
          {
            date: '2026-09-11',
            name: 'Redacción narrativa: Una anécdota en mi familia',
            title: 'Redacción narrativa: Una anécdota en mi familia',
            status: 'Entregada tarde',
            source: 'Lenguajes'
          }
        ]
      },
      {
        name: 'Saberes y Pensamiento Científico',
        grade: 7.8,
        completed: 0,
        total: 1,
        sources: [
          { name: 'Matemático', grade: 8.0, completed: 0, total: 0 },
          { name: 'Científico', grade: 7.5, completed: 0, total: 1 }
        ],
        scores: { Tareas: 7.0, Asistencia: 8.0, Conducta: 8.0, Participación: 8.0 },
        weights: [
          { criterio: 'Tareas', porcentaje: 35 },
          { criterio: 'Asistencia', porcentaje: 25 },
          { criterio: 'Conducta', porcentaje: 20 },
          { criterio: 'Participación', porcentaje: 20 }
        ],
        pending: [],
        tasks: [
          {
            date: '2026-09-09',
            name: 'Investigación: Ecosistemas y fauna de Quintana Roo',
            title: 'Investigación: Ecosistemas y fauna de Quintana Roo',
            status: 'Incompleta',
            source: 'Saberes y Pensamiento Científico'
          }
        ]
      },
      {
        name: 'Ética, Naturaleza y Sociedades',
        grade: 8.5,
        completed: 1,
        total: 1,
        scores: { Tareas: 9.0, Asistencia: 8.5, Conducta: 8.5, Participación: 8.0 },
        weights: [
          { criterio: 'Tareas', porcentaje: 30 },
          { criterio: 'Asistencia', porcentaje: 20 },
          { criterio: 'Conducta', porcentaje: 25 },
          { criterio: 'Participación', porcentaje: 25 }
        ],
        pending: [],
        tasks: [
          {
            date: '2026-09-07',
            name: 'Cartel ecológico: Reducción y reciclaje en la escuela',
            title: 'Cartel ecológico: Reducción y reciclaje en la escuela',
            status: 'Entregada',
            source: 'Ética, Naturaleza y Sociedades'
          }
        ]
      },
      {
        name: 'De lo Humano y lo Comunitario',
        grade: 8.2,
        completed: 0,
        total: 0,
        scores: { Asistencia: 8.5, Conducta: 8.0, Participación: 8.0 },
        weights: [
          { criterio: 'Asistencia', porcentaje: 30 },
          { criterio: 'Conducta', porcentaje: 35 },
          { criterio: 'Participación', porcentaje: 35 }
        ],
        pending: [],
        tasks: []
      }
    ],
    weeklyReport: {
      student: DEMO_STUDENT,
      school: DEMO_SCHOOL,
      period: { start: '2026-09-07', end: '2026-09-11' },
      attendance: {
        records: [
          { date: '2026-09-07', status: 'A' },
          { date: '2026-09-08', status: 'R' },
          { date: '2026-09-09', status: 'A' },
          { date: '2026-09-10', status: 'J' },
          { date: '2026-09-11', status: 'A' }
        ],
        justificationNotes: ['Jueves 10 de sep: Justificante médico por consulta presentado en dirección.']
      },
      tasks: [
        {
          date: '2026-09-07',
          source: 'Ética, Naturaleza y Sociedades',
          title: 'Cartel ecológico: Reducción y reciclaje en la escuela',
          type: 'Proyecto colaborativo',
          material: 'Cartulina y colores',
          instructions: 'Diseño de cartel informativo escolar.',
          status: 'Entregada'
        },
        {
          date: '2026-09-09',
          source: 'Saberes y Pensamiento Científico',
          title: 'Investigación: Ecosistemas y fauna de Quintana Roo',
          type: 'Reporte de indagación',
          material: 'Libro de proyectos y recortes',
          instructions: 'Ficha de campo sobre flora y fauna de la región.',
          status: 'Incompleta'
        },
        {
          date: '2026-09-11',
          source: 'Lenguajes',
          title: 'Redacción narrativa: Una anécdota en mi familia',
          type: 'Texto libre',
          material: 'Cuaderno de líneas',
          instructions: 'Redacción narrativa estructurada con inicio, nudo y desenlace.',
          status: 'Entregada tarde'
        }
      ],
      learnings: [
        {
          title: 'Ecosistemas y relaciones ecológicas comunitarias',
          pda: 'Explica las interacciones entre los factores bióticos y abióticos en su entorno inmediato.',
          level: 'En proceso'
        },
        {
          title: 'Narración de sucesos del pasado y presente',
          pda: 'Reconoce y utiliza tiempos verbales para narrar sucesos y experiencias personales.',
          level: 'Consolidado'
        }
      ],
      achievements: [
        'Participó con entusiasmo en la brigada escolar de reciclaje.',
        'Mejoró notablemente la claridad y ortografía en sus textos escritos.'
      ],
      observations: [
        {
          category: 'Seguimiento pedagógico',
          text: 'Se sugiere repasar en casa las lecturas diarias y apoyar en la entrega puntual de las tareas complementarias.'
        },
        {
          category: 'Puntualidad y asistencia',
          text: 'Se registró 1 retardo el martes y 1 falta justificada el jueves por cita médica.'
        }
      ],
      guidance: [
        'Revisar las tareas los martes por la tarde para asegurar su entrega en tiempo y forma.',
        'Concluir en casa la tabla comparativa de ecosistemas para fortalecer el aprendizaje.'
      ]
    }
  };

  // Exportar el objeto fixture global
  window.FAMILY_PORTAL_DEMO_FIXTURE = {
    student: DEMO_STUDENT,
    school: DEMO_SCHOOL,
    account: DEMO_ACCOUNT,
    incompleteProfile: INCOMPLETE_PROFILE,
    completeProfile: COMPLETE_PROFILE,
    contacts: DEMO_CONTACTS,
    week1: WEEK_1_DATA,
    week2: WEEK_2_DATA
  };
})();
