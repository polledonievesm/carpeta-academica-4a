/* ==========================================================================
   MÓDULO: IMPORTACIÓN INTELIGENTE DE LISTA DE ASISTENCIA (PDF / FOTO / TEXTO)
   Extrae automáticamente los nombres de los alumnos de listas oficiales,
   permite filtrar y validar quiénes entran, y los integra en cascada al grupo,
   asistencia, calificaciones y accesos familiares con claves permanentes.
   ========================================================================== */

let _detectedImportStudents = [];

// Palabras comunes en encabezados y pies de página de listas oficiales de la SEP
const IGNORED_HEADER_KEYWORDS = [
  'SECRETARIA', 'EDUCACION', 'PUBLICA', 'GOBIERNO', 'ESTADO', 'DIRECCION',
  'SUBDIRECCION', 'ESCUELA', 'PRIMARIA', 'SECUNDARIA', 'CICLO', 'ESCOLAR',
  'LISTA', 'ASISTENCIA', 'EVALUACION', 'TRIMESTRE', 'PERIODO', 'GRADO',
  'GRUPO', 'DOCENTE', 'MAESTRO', 'PROFESOR', 'FECHA', 'MES', 'FIRMA',
  'NUM', 'NO.', 'TOTAL', 'HOMBRES', 'MUJERES', 'OBSERVACIONES', 'NOMBRE',
  'ALUMNO', 'ALUMNA', 'CLAVE', 'TURNO', 'ZONA', 'SECTOR', 'FOLIO', 'CURP',
  'CALIFICACION', 'PROMEDIO', 'DESARROLLO', 'PROGRAMA', 'REVISION'
];

/**
 * Normaliza y separa un texto de nombre completo en apellido paterno, materno y nombres
 */
function parseStudentNameLine(line) {
  if (!line || typeof line !== 'string') return null;

  // 1. Limpieza inicial: quitar números al inicio (ej. "1.", "02 -", "(3)")
  let clean = line.replace(/^\s*(?:[\d#]+[\.\-\)\s]*)+/, '').trim();

  // Quitar símbolos y puntuación innecesaria al inicio o final
  clean = clean.replace(/^[,\.\-\*_\s]+/, '').replace(/[,\.\-\*_\s]+$/, '').trim();

  // Si la línea es muy corta o no tiene letras, ignorarla
  if (clean.length < 5 || !/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(clean)) return null;

  // Comprobar si es un encabezado o texto oficial
  const upper = clean.toUpperCase();
  const words = upper.split(/\s+/).filter(Boolean);
  
  // Si coincide predominantemente con palabras de encabezado, ignorar
  const headerMatchCount = words.filter(w => IGNORED_HEADER_KEYWORDS.includes(w)).length;
  if (headerMatchCount >= 2 || (words.length <= 2 && headerMatchCount >= 1)) {
    return null;
  }

  // 2. Si viene en formato "Apellidos, Nombres"
  if (clean.includes(',')) {
    const parts = clean.split(',');
    const apellidosStr = parts[0].trim();
    const nombresStr = parts.slice(1).join(' ').trim();
    const apParts = apellidosStr.split(/\s+/).filter(Boolean);

    return {
      apellidoPaterno: apParts[0] || '',
      apellidoMaterno: apParts.slice(1).join(' ') || '',
      nombres: nombresStr || '',
      fullName: `${apellidosStr} ${nombresStr}`.trim()
    };
  }

  // 3. Formato estándar mexicano: Apellido Paterno [Apellido Materno] Nombres
  // Reconocimiento de partículas compuestas ("DE LA", "DEL", "DE", "SAN", "VDA DE")
  const rawWords = clean.split(/\s+/).filter(Boolean);
  if (rawWords.length < 2) return null; // Un nombre requiere al menos apellido y nombre

  let apPaterno = rawWords[0];
  let apMaterno = '';
  let nombres = '';

  if (rawWords.length === 2) {
    // Ej: "PÉREZ JUAN" -> Paterno: PÉREZ, Nombres: JUAN
    apPaterno = rawWords[0];
    nombres = rawWords[1];
  } else if (rawWords.length === 3) {
    // Ej: "GÓMEZ PÉREZ JUAN" -> Paterno: GÓMEZ, Materno: PÉREZ, Nombres: JUAN
    apPaterno = rawWords[0];
    apMaterno = rawWords[1];
    nombres = rawWords[2];
  } else {
    // 4 o más palabras: ej: "HERNÁNDEZ ASTUDILLO JORGE ALEXANDER"
    // Tomar las primeras dos como apellidos y el resto como nombres
    apPaterno = rawWords[0];
    apMaterno = rawWords[1];
    nombres = rawWords.slice(2).join(' ');
  }

  return {
    apellidoPaterno: apPaterno,
    apellidoMaterno: apMaterno,
    nombres: nombres,
    fullName: clean
  };
}

/**
 * Procesa un bloque de texto multilínea y genera los objetos de alumnos
 */
function processRawTextToStudents(rawText) {
  if (!rawText) return [];
  const lines = rawText.split(/\r?\n/);
  const detected = [];
  const seenNames = new Set();

  lines.forEach(rawLine => {
    const parsed = parseStudentNameLine(rawLine);
    if (!parsed) return;

    // Normalizar para evitar duplicados en el mismo archivo
    const key = parsed.fullName.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (seenNames.has(key)) return;
    seenNames.add(key);

    detected.push({
      id: 'IMPORT-' + Math.random().toString(36).substring(2, 9),
      numeroLista: detected.length + 1,
      apellidoPaterno: parsed.apellidoPaterno,
      apellidoMaterno: parsed.apellidoMaterno,
      nombres: parsed.nombres,
      fullName: parsed.fullName,
      selected: true
    });
  });

  return detected;
}

/**
 * Extractor de texto desde archivo PDF oficial
 */
async function extractTextFromPdf(file) {
  const arrayBuffer = await file.arrayBuffer();

  // Intento 1: Usar PDF.js si está cargado
  if (typeof window.pdfjsLib !== 'undefined') {
    try {
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // Agrupar elementos por coordenada vertical Y aproximada para formar líneas correctas
        const lineMap = new Map();
        textContent.items.forEach(item => {
          const y = Math.round(item.transform[5] / 4) * 4; // tolerancia vertical de 4px
          const existing = lineMap.get(y) || [];
          existing.push({ x: item.transform[4], str: item.str });
          lineMap.set(y, existing);
        });

        // Ordenar renglones de arriba hacia abajo (Y descendente en PDF)
        const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a);
        sortedYs.forEach(y => {
          const rowItems = lineMap.get(y).sort((a, b) => a.x - b.x);
          const lineStr = rowItems.map(it => it.str).join(' ').trim();
          if (lineStr) fullText += lineStr + '\n';
        });
      }
      if (fullText.trim().length > 10) {
        return fullText;
      }
    } catch (err) {
      console.warn('Extracción con PDF.js falló, intentando extractor de respaldo...', err);
    }
  }

  // Intento 2: Extractor nativo sin librerías externas (Fallback para modo sin conexión)
  const decoder = new TextDecoder('latin1');
  const pdfString = decoder.decode(arrayBuffer);
  const textMatches = [];
  
  // Buscar cadenas de texto en objetos de texto PDF Tj y TJ
  const tjRegex = /\(([^)]+)\)\s*Tj/g;
  let match;
  while ((match = tjRegex.exec(pdfString)) !== null) {
    textMatches.push(match[1]);
  }

  const tjArrayRegex = /\[([^\]]+)\]\s*TJ/g;
  while ((match = tjArrayRegex.exec(pdfString)) !== null) {
    const innerText = match[1].replace(/\(([^)]+)\)/g, '$1 ').replace(/-\d+/g, '');
    textMatches.push(innerText);
  }

  if (textMatches.length > 0) {
    return textMatches.join('\n');
  }

  throw new Error('No se pudo extraer texto legible del PDF. Si el archivo es un documento escaneado como imagen, utiliza la pestaña "Foto / Imagen de Lista".');
}

/**
 * Extractor OCR desde Foto o Imagen tomada con celular
 */
async function extractTextFromPhoto(file, onProgress) {
  if (typeof window.Tesseract === 'undefined') {
    throw new Error('El motor de reconocimiento óptico (OCR) aún no se ha descargado o estás sin conexión. Puedes pegar la lista en la pestaña "Pegar texto directo".');
  }

  const result = await window.Tesseract.recognize(file, 'spa', {
    logger: m => {
      if (typeof onProgress === 'function' && m.status === 'recognizing text') {
        onProgress(Math.round((m.progress || 0) * 100));
      }
    }
  });

  return result.data?.text || '';
}

/**
 * Renderiza la tabla de revisión interactiva
 */
function renderImportPreview() {
  const container = document.getElementById('importPreviewSection');
  const tbody = document.getElementById('importPreviewTableBody');
  const totalCountEl = document.getElementById('importTotalCount');
  const selectedCountEl = document.getElementById('importSelectedCount');
  const confirmBtn = document.getElementById('btnConfirmImportStudents');

  if (!container || !tbody) return;

  const total = _detectedImportStudents.length;
  const selectedCount = _detectedImportStudents.filter(s => s.selected).length;

  if (total === 0) {
    container.style.display = 'none';
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.textContent = '✓ Confirmar e incorporar alumnos (0)';
    }
    return;
  }

  container.style.display = 'block';
  if (totalCountEl) totalCountEl.textContent = total;
  if (selectedCountEl) selectedCountEl.textContent = selectedCount;

  if (confirmBtn) {
    confirmBtn.disabled = selectedCount === 0;
    confirmBtn.textContent = `✓ Confirmar e incorporar alumnos (${selectedCount})`;
  }

  tbody.innerHTML = _detectedImportStudents.map((st, index) => {
    return `
      <tr style="border-bottom:1px solid #f1f5f9;background:${st.selected ? '#ffffff' : '#f8fafc'};opacity:${st.selected ? '1' : '0.6'};">
        <td style="padding:8px 10px;text-align:center;">
          <input type="checkbox" data-import-check="${index}" ${st.selected ? 'checked' : ''} style="cursor:pointer;width:16px;height:16px;">
        </td>
        <td style="padding:8px 10px;text-align:center;font-weight:700;color:#64748b;">
          ${index + 1}
        </td>
        <td style="padding:8px 10px;">
          <input type="text" data-import-name="${index}" value="${escapeHtml(st.fullName)}" 
                 style="width:100%;padding:6px 10px;border:1px solid ${st.selected ? '#cbd5e1' : '#e2e8f0'};border-radius:6px;font-size:13px;font-weight:${st.selected ? '600' : '400'};color:#1e293b;"
                 placeholder="Apellidos y nombres del alumno">
        </td>
        <td style="padding:8px 10px;text-align:center;">
          <button type="button" class="icon-button" data-import-delete="${index}" title="Quitar de la lista" style="color:#ef4444;font-size:14px;cursor:pointer;">
            ✕
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Inicializa eventos del modal de importación
 */
function initImportAttendanceEvents() {
  const dialog = document.getElementById('importAttendanceDialog');
  if (!dialog) return;

  // 1. Selector de pestañas
  const tabButtons = dialog.querySelectorAll('.import-tab-btn');
  tabButtons.forEach(btn => {
    btn.onclick = () => {
      tabButtons.forEach(b => {
        b.classList.remove('active');
        b.style.background = '#f1f5f9';
        b.style.color = '#475569';
      });
      btn.classList.add('active');
      btn.style.background = '#e0f2fe';
      btn.style.color = '#0369a1';

      const tab = btn.dataset.importTab;
      document.getElementById('importTabContentPdf').style.display = tab === 'pdf' ? 'block' : 'none';
      document.getElementById('importTabContentPhoto').style.display = tab === 'photo' ? 'block' : 'none';
      document.getElementById('importTabContentPaste').style.display = tab === 'paste' ? 'block' : 'none';
    };
  });

  // 2. Carga de archivo PDF
  const pdfInput = document.getElementById('importPdfInput');
  if (pdfInput) {
    pdfInput.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const fileNameEl = document.getElementById('importPdfFileName');
      if (fileNameEl) fileNameEl.textContent = `Analizando: ${file.name}...`;

      try {
        const text = await extractTextFromPdf(file);
        const students = processRawTextToStudents(text);
        if (students.length === 0) {
          alert('No se encontraron nombres de alumnos legibles en el PDF. Intenta copiar el texto de la lista y pegarlo en la pestaña "Pegar texto directo".');
          if (fileNameEl) fileNameEl.textContent = 'Sin resultados detectados.';
          return;
        }
        _detectedImportStudents = students;
        if (fileNameEl) fileNameEl.textContent = `✓ ${file.name} (${students.length} alumnos detectados)`;
        renderImportPreview();
      } catch (err) {
        console.error('Error procesando PDF:', err);
        alert(err.message || 'Error al procesar el archivo PDF.');
        if (fileNameEl) fileNameEl.textContent = 'Error al leer el archivo.';
      }
    };
  }

  // 3. Carga de Foto / Imagen
  const photoInput = document.getElementById('importPhotoInput');
  if (photoInput) {
    photoInput.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const fileNameEl = document.getElementById('importPhotoFileName');
      const progressBox = document.getElementById('importOcrProgress');
      const progressBar = document.getElementById('importOcrProgressBar');
      const statusText = document.getElementById('importOcrStatusText');

      if (fileNameEl) fileNameEl.textContent = file.name;
      if (progressBox) progressBox.style.display = 'block';

      try {
        const text = await extractTextFromPhoto(file, percent => {
          if (progressBar) progressBar.style.width = `${percent}%`;
          if (statusText) statusText.textContent = `Escaneando con IA (${percent}%)...`;
        });

        if (statusText) statusText.textContent = 'Analizando nombres...';
        const students = processRawTextToStudents(text);

        if (students.length === 0) {
          alert('No se pudieron reconocer claramente los nombres en la fotografía. Asegúrate de que la hoja tenga buena iluminación o prueba pegando el texto directamente.');
        } else {
          _detectedImportStudents = students;
          renderImportPreview();
        }
      } catch (err) {
        console.error('Error en OCR:', err);
        alert(err.message || 'No fue posible leer la foto.');
      } finally {
        if (progressBox) progressBox.style.display = 'none';
      }
    };
  }

  // 4. Pegar texto directo
  const btnProcessPaste = document.getElementById('btnProcessPasteText');
  if (btnProcessPaste) {
    btnProcessPaste.onclick = () => {
      const textarea = document.getElementById('importPasteText');
      const text = textarea?.value?.trim() || '';
      if (!text) {
        alert('Por favor pega o escribe al menos un nombre de alumno.');
        return;
      }
      const students = processRawTextToStudents(text);
      if (students.length === 0) {
        alert('No se detectaron nombres válidos. Escribe un nombre por renglón.');
        return;
      }
      _detectedImportStudents = students;
      renderImportPreview();
    };
  }

  // 5. Botones de selección masiva en la tabla de revisión
  const btnSelectAll = document.getElementById('btnSelectAllImport');
  if (btnSelectAll) {
    btnSelectAll.onclick = () => {
      _detectedImportStudents.forEach(s => s.selected = true);
      renderImportPreview();
    };
  }

  const btnDeselectAll = document.getElementById('btnDeselectAllImport');
  if (btnDeselectAll) {
    btnDeselectAll.onclick = () => {
      _detectedImportStudents.forEach(s => s.selected = false);
      renderImportPreview();
    };
  }

  const btnAddManual = document.getElementById('btnAddManualImportRow');
  if (btnAddManual) {
    btnAddManual.onclick = () => {
      const name = prompt('Nombre completo del alumno (Apellidos y Nombres):');
      if (!name || !name.trim()) return;
      const parsed = parseStudentNameLine(name.trim());
      _detectedImportStudents.push({
        id: 'IMPORT-' + Math.random().toString(36).substring(2, 9),
        numeroLista: _detectedImportStudents.length + 1,
        apellidoPaterno: parsed?.apellidoPaterno || '',
        apellidoMaterno: parsed?.apellidoMaterno || '',
        nombres: parsed?.nombres || name.trim(),
        fullName: name.trim().toUpperCase(),
        selected: true
      });
      renderImportPreview();
    };
  }

  // 6. Delegación de eventos en la tabla de revisión (Check, Editar texto, Eliminar)
  const tbody = document.getElementById('importPreviewTableBody');
  if (tbody) {
    tbody.onchange = (e) => {
      const check = e.target.closest('[data-import-check]');
      if (check) {
        const index = Number(check.dataset.importCheck);
        if (_detectedImportStudents[index]) {
          _detectedImportStudents[index].selected = check.checked;
          renderImportPreview();
        }
      }
    };

    tbody.oninput = (e) => {
      const input = e.target.closest('[data-import-name]');
      if (input) {
        const index = Number(input.dataset.importName);
        if (_detectedImportStudents[index]) {
          const val = input.value;
          _detectedImportStudents[index].fullName = val;
          const parsed = parseStudentNameLine(val);
          if (parsed) {
            _detectedImportStudents[index].apellidoPaterno = parsed.apellidoPaterno;
            _detectedImportStudents[index].apellidoMaterno = parsed.apellidoMaterno;
            _detectedImportStudents[index].nombres = parsed.nombres;
          }
        }
      }
    };

    tbody.onclick = (e) => {
      const delBtn = e.target.closest('[data-import-delete]');
      if (delBtn) {
        const index = Number(delBtn.dataset.importDelete);
        _detectedImportStudents.splice(index, 1);
        renderImportPreview();
      }
    };
  }

  // 7. Botón de Confirmación e Incorporación en cascada
  const btnConfirm = document.getElementById('btnConfirmImportStudents');
  if (btnConfirm) {
    btnConfirm.onclick = async () => {
      const toImport = _detectedImportStudents.filter(s => s.selected && s.fullName.trim());
      if (toImport.length === 0) {
        alert('Selecciona al menos un alumno para incorporarlo al grupo.');
        return;
      }

      btnConfirm.disabled = true;
      btnConfirm.textContent = '⏳ Incorporando alumnos al grupo...';

      try {
        await executeCascadeStudentImport(toImport);
        if (dialog.close) dialog.close();
        else dialog.removeAttribute('open');
        _detectedImportStudents = [];
      } catch (err) {
        console.error('Error al incorporar alumnos:', err);
        alert('Ocurrió un error al incorporar los alumnos: ' + err.message);
      } finally {
        btnConfirm.disabled = false;
        btnConfirm.textContent = `✓ Confirmar e incorporar alumnos (${toImport.length})`;
      }
    };
  }
}

/**
 * Ejecuta la integración en cascada para todos los alumnos seleccionados
 */
async function executeCascadeStudentImport(studentsList) {
  state.students = state.students || [];
  state.directory = state.directory || { rows: [] };
  state.stats = state.stats || {};

  const existingKeys = new Set(
    state.students.map(s => fullName(s).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""))
  );

  let addedCount = 0;
  const newStudents = [];

  studentsList.forEach(item => {
    const norm = item.fullName.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (existingKeys.has(norm)) {
      return; // Ya existe en el grupo
    }
    existingKeys.add(norm);

    // Asignar ID consecutivo limpio
    const currentMaxNum = state.students.reduce((max, s) => Math.max(max, Number(s.numeroLista || 0)), 0);
    const nextNum = currentMaxNum + addedCount + 1;
    const studentId = 'A' + String(nextNum).padStart(3, '0');

    // Generar usuario familiar y contraseña permanente sin caducidad
    const cleanFirstName = (item.nombres || item.fullName || 'alumno').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
    const username = `fam_${cleanFirstName}${nextNum}`;
    const randomPin = Math.random().toString(36).substring(2, 6).toUpperCase();
    const password = `H4A${nextNum}${randomPin}`;

    const studentObj = {
      id: studentId,
      numeroLista: nextNum,
      apellidoPaterno: item.apellidoPaterno || '',
      apellidoMaterno: item.apellidoMaterno || '',
      nombres: item.nombres || item.fullName,
      nombreCompleto: item.fullName,
      tutorUsuario: username,
      tutorNombre: '',
      edad: 9,
      estilo: 'Sin evaluar'
    };

    // Ficha en el Directorio Escolar con cuenta activa sin caducidad
    const dirRow = {
      student: {
        id: studentId,
        name: item.fullName,
        numeroLista: nextNum,
        apellidoPaterno: item.apellidoPaterno || '',
        apellidoMaterno: item.apellidoMaterno || '',
        nombres: item.nombres || item.fullName
      },
      profile: {
        tutorApellidoPaterno: '',
        tutorApellidoMaterno: '',
        tutorNombres: '',
        tutorParentesco: '',
        tutorTelefono: '',
        tutorEmail: ''
      },
      contacts: [],
      account: {
        username: username,
        active: true,
        mustChangePassword: false,
        temporaryPassword: password,
        temporaryExpiresAt: 0,
        lastAccess: null
      },
      complete: false
    };

    state.students.push(studentObj);
    state.directory.rows.push(dirRow);
    newStudents.push(studentObj);
    addedCount++;
  });

  // Reordenar alfabéticamente el grupo y reasignar números de lista si corresponde
  state.students.sort((a, b) => fullName(a).localeCompare(fullName(b), 'es'));
  state.students.forEach((st, idx) => {
    st.numeroLista = idx + 1;
    const row = state.directory.rows.find(r => String(r.student.id) === String(st.id));
    if (row) row.student.numeroLista = idx + 1;
  });

  state.stats.students = state.students.length;

  // Actualizar todas las pantallas vinculadas en el sistema
  if (typeof renderAll === 'function') renderAll();
  else {
    if (typeof renderStudents === 'function') renderStudents();
    if (typeof renderStats === 'function') renderStats();
    if (typeof renderAttendance === 'function') renderAttendance();
    if (typeof renderFamilyAccess === 'function') renderFamilyAccess();
    if (typeof renderDirectoryBuilder === 'function') renderDirectoryBuilder();
  }

  toast(`✓ ¡Listo! Se incorporaron ${addedCount} alumnos al grupo y se crearon sus accesos familiares.`);
}

/**
 * Función pública para abrir el modal desde cualquier botón
 */
function openImportAttendanceDialog() {
  const dialog = document.getElementById('importAttendanceDialog');
  if (!dialog) return;

  // Resetear estados previos
  _detectedImportStudents = [];
  const preview = document.getElementById('importPreviewSection');
  if (preview) preview.style.display = 'none';

  const fileNamePdf = document.getElementById('importPdfFileName');
  if (fileNamePdf) fileNamePdf.textContent = '';
  const fileNamePhoto = document.getElementById('importPhotoFileName');
  if (fileNamePhoto) fileNamePhoto.textContent = '';
  const pasteText = document.getElementById('importPasteText');
  if (pasteText) pasteText.value = '';

  const confirmBtn = document.getElementById('btnConfirmImportStudents');
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = '✓ Confirmar e incorporar alumnos (0)';
  }

  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

window.openImportAttendanceDialog = openImportAttendanceDialog;
window.initImportAttendanceEvents = initImportAttendanceEvents;
window.executeCascadeStudentImport = executeCascadeStudentImport;

document.addEventListener('DOMContentLoaded', () => {
  initImportAttendanceEvents();
});
