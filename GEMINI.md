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
- JAMÁS ejecutar `git push` a repositorios remotos. Los commits locales son seguros y respetan el control del usuario.

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
