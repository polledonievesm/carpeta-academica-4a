# REGLAS DE ARQUITECTURA, ESTABILIDAD Y VERIFICACIÓN (CARPETA ACADÉMICA)

Este proyecto es una Single Page Application (SPA) modular en JavaScript Vanilla sin empaquetador. Para evitar regresiones, bloqueos en cascada y botones inactivos, todo agente de IA DEBE cumplir estrictamente estas reglas:

## 1. COMPONENTES NÚCLEO PROTEGIDOS (PROHIBIDO TOCAR SIN PETICIÓN EXPLÍCITA)
Los siguientes archivos son los cimientos del sistema y están BLINDADOS. Si el usuario pide cambios en una vista (ej. Expediente, Asistencia, Familias), NO modifiques:
- `js/core/navigation.js` (Enrutador, historial y despachador de eventos).
- `js/core/state-api.js` (Conexiones con Google Sheets / Supabase y estado global).
- `index.html` (Estructura de la aplicación, barra de navegación y modales globales).

## 2. REGLA DE ACCIONES DESACOPLADAS (MODULARIDAD OBLIGATORIA)
- Toda nueva acción o botón interactivo (`data-action="..."`) debe registrarse de manera descentralizada dentro del archivo de la vista correspondiente mediante:
  `window.actions = window.actions || {};`
  `window.actions['mi-accion'] = (...args) => (window.miFuncion || miFuncion)?.(...args);`
- NUNCA agregar funciones rígidas en listas globales sin envoltura perezosa (*lazy evaluation*). Si una función no ha cargado aún, el despachador NO debe romper el resto de la aplicación.
- NUNCA llamar a `showView()` de manera cíclica o recursiva desde las funciones de inicialización de vista (`openView()`).

## 3. AISLAMIENTO POR ARCHIVO DE VISTA
- Cambios de diseño o lógica del Expediente: ÚNICAMENTE en `js/vistas/expediente.js` y `css/expediente.css`.
- Cambios en Familias: ÚNICAMENTE en `js/vistas/familias.js` y `css/familias.css`.
- Cambios en Asistencia: ÚNICAMENTE en `js/vistas/asistencia.js` y `css/asistencia.css`.

## 4. PROTOCOLO OBLIGATORIO DE PRUEBA EN NAVEGADOR (SMOKE TEST)
Antes de responder al usuario que un cambio está listo:
1. Ejecutar una verificación automatizada con Google Chrome Headless vía CDP (Chrome DevTools Protocol).
2. Verificar que se cargue la vista solicitada y que se capturen las excepciones del navegador.
3. Confirmar que existan CERO (0) excepciones no capturadas (`exceptionThrown`) en la consola.
4. Si se detecta un error de JavaScript, corregirlo antes de entregar.

## 5. REGLAS DE GIT Y SINCRONIZACIÓN LOCAL
- Mantener siempre sincronizados `C:\Users\Polledo\Documents\GitHub\carpeta-academica-4a` y `C:\Users\Polledo\Downloads\carpeta-academica-4a-main`.
- JAMÁS ejecutar `git push` a repositorios remotos sin autorización previa y explícita del usuario.
- En caso de autorizarse una actualización remota de historial, utilizar siempre `--force-with-lease` indicando la referencia remota esperada, y JAMÁS `--force` indiscriminado ni `--all`.

## 6. ESTÁNDAR OBLIGATORIO DE DOCUMENTACIÓN Y TRAZABILIDAD DEL CÓDIGO
Esta regla es de cumplimiento obligatorio y permanente para todos los módulos actuales y futuros de Carpeta Académica (Google Apps Script, JavaScript Vanilla, HTML y CSS):

### 6.1. Encabezado Obligatorio de Archivo
Todo archivo debe comenzar con un bloque de documentación que detalle:
- Nombre exacto del archivo.
- Nombre del módulo al que pertenece.
- Propósito general del archivo en la arquitectura del sistema.
- Fecha de creación (si es conocida; en caso contrario: «Fecha de creación no registrada»).
- Fecha de última modificación (fecha real de la intervención).
- Índice de secciones numeradas.
- Funciones principales que contiene.
- Dependencias internas y externas.
- Historial acumulativo de modificaciones.

### 6.2. Identificación Visual de Secciones
- Separar visualmente cada bloque lógico mediante comentarios destacados con títulos descriptivos en español.
- Numerar las secciones de forma secuencial.
- En `Database.gs`, documentar cada definición de tabla/hoja indicando su nombre oficial y propósito en el modelo de datos.

### 6.3. Documentación Individual de Funciones
Cada función nueva o modificada debe incluir inmediatamente antes de su declaración un bloque JSDoc estructurado con:
- Título descriptivo en español.
- Nombre técnico de la función.
- Fecha de creación (o «Fecha de creación no registrada»).
- Fecha de última modificación (fecha real).
- Qué hace (descripción concisa de la operación).
- Para qué sirve (utilidad en el flujo escolar).
- Por qué se creó (necesidad del diseño modular).
- Parámetros que recibe (tipos y significado).
- Resultado que devuelve (estructura, tipo y casos de error).
- Dependencias relevantes (servicios, tablas u otras funciones).
- Historial de modificaciones acumulativo (fecha, cambio, motivo, problema que resuelve y etapa relacionada).

### 6.4. Historial Acumulativo de Modificaciones
- Cada modificación funcional o documental debe registrarse en el historial de la función y del archivo.
- No eliminar el historial previo.
- Diferenciar expresamente entre una «Modificación funcional» y una «Modificación exclusivamente documental».
- No modificar nombres técnicos, firmas, parámetros ni valores de retorno únicamente por motivos organizativos.

## 7. POLÍTICA ESTRICTA DE PRIVACIDAD, PROTECCIÓN DE DATOS Y SEGURIDAD (PERMANENTE)
Para garantizar la confidencialidad absoluta de la información de la comunidad escolar y evitar exposiciones en repositorios públicos:

### 7.1. Prohibición de Datos Personales en Archivos Públicos
- Queda ESTRICTAMENTE PROHIBIDO incrustar, hardcodear o almacenar nombres de alumnos, tutores o docentes, CURPs, matrículas escolares, teléfonos, correos personales o cualquier dato personal en archivos JavaScript, HTML, CSS, JSON, TXT o comentarios de código accesibles públicamente.
- Todo padrón escolar, lista de alumnos o catálogo debe ser recuperado EXCLUSIVAMENTE en tiempo de ejecución a través de servicios autenticados del backend institucional (Google Apps Script).
- En caso de requerir valores de demostración, ejemplos sintácticos o pruebas locales, se utilizarán exclusivamente datos FICTICIOS explícitos (ej. "PÉREZ LÓPEZ JUAN CARLOS", CURP "DEMO00000000000000", matrículas genéricas).

### 7.2. Datos en Pruebas Automatizadas
- Las suites de pruebas en la carpeta `tests/` deben operar con mocks y fixtures 100% ficticios.
- Ningún archivo de prueba rastreado por Git debe incluir identificadores de personas reales.

### 7.3. Auditoría Preventiva Previa a la Publicación
- Antes de cualquier commit o despliegue a producción, verificar que `git diff` y `git status` no introduzcan datos personales reales ni patrones oficiales de CURP (`[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d`).
- Verificar que archivos temporales de texto (*dumps*, reportes locales de depuración o listas de cotejo) no se encuentren en el área de preparación (*staging*).

### 7.4. Protección de Respaldos y Archivos Sensibles en Git
- El archivo `.gitignore` debe blindar permanentemente cualquier archivo `.zip`, `.tar.gz`, `.bak`, `.dump`, volcados de base de datos, credenciales (`.env`, `*.token`, `*.pem`, `*.key`) y archivos `.txt` de análisis interno con datos escolares.
- Todo archivo sensible local debe residir fuera de las rutas rastreadas.

### 7.5. Protección Contra Regresiones Históricas en Git
- Toda integración de ramas de desarrollo (como `desarrollo-7b2` o etapas posteriores) debe basarse ÚNICAMENTE sobre el historial saneado post-hotfix.
- Queda terminantemente prohibido hacer merge de ramas o commits huérfanos que contengan los commits anteriores al saneamiento para evitar reintroducir objetos purgados al grafo de Git.
