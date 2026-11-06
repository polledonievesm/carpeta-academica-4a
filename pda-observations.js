/* ==========================================================================
   BANCO DE OBSERVACIONES POR PDA Y MATEMÁTICAS - FASE 4 (4.º GRADO)
   Nueva Escuela Mexicana - Carpeta Académica
   ========================================================================== */

(function () {
  'use strict';

  let currentHistoryMode = 'current'; // 'current' (semana) o 'all' (todo el ciclo)
  let selectedObservationData = null;

  const BLOQUES_MATEMATICAS_ORDEN = [
    'Números y numeración',
    'Fracciones',
    'Números decimales',
    'Suma y resta',
    'Multiplicación y división',
    'Líneas, ángulos y simetría',
    'Figuras planas',
    'Perímetro y área',
    'Cuerpos geométricos',
    'Ubicación espacial',
    'Medidas',
    'Estadística y datos'
  ];

  function getBancoPda() {
    return Array.isArray(window.BANCO_OBSERVACIONES_PDA) ? window.BANCO_OBSERVACIONES_PDA : [];
  }

  function getBancoMatematicas() {
    return Array.isArray(window.BANCO_OBSERVACIONES_MATEMATICAS) ? window.BANCO_OBSERVACIONES_MATEMATICAS : [];
  }

  function getStudents() {
    if (window.state && Array.isArray(window.state.students)) {
      return window.state.students;
    }
    return [];
  }

  function getToday() {
    if (typeof window.todayCancun === 'function') {
      return window.todayCancun();
    }
    return new Date().toISOString().slice(0, 10);
  }

  function showToast(message, isError) {
    if (typeof window.toast === 'function') {
      window.toast(message, isError);
    } else {
      alert(message);
    }
  }

  function escapeHtmlStr(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Comprobar si el filtro actual apunta exclusivamente a Matemáticas
  function isMathMode() {
    const fieldSelect = document.getElementById('pdaFieldFilter');
    const field = fieldSelect ? fieldSelect.value.trim() : '';
    if (field === 'Saberes y Pensamiento Matemático') return true;
    if (field === 'Saberes y Pensamiento Científico') {
      const subArea = document.getElementById('pdaSubAreaFilter')?.value;
      if (subArea === 'matematicas') return true;
    }
    return false;
  }

  // Comprobar si incluye Matemáticas
  function includesMath() {
    const fieldSelect = document.getElementById('pdaFieldFilter');
    const field = fieldSelect ? fieldSelect.value.trim() : '';
    if (field === 'Saberes y Pensamiento Matemático') return true;
    if (field === 'Saberes y Pensamiento Científico') {
      const subArea = document.getElementById('pdaSubAreaFilter')?.value;
      return subArea !== 'ciencias';
    }
    if (!field) return true; // "Todos los campos" incluye ambos
    return false;
  }

  // Comprobar si incluye PDA generales
  function includesGeneralPda() {
    const fieldSelect = document.getElementById('pdaFieldFilter');
    const field = fieldSelect ? fieldSelect.value.trim() : '';
    if (field === 'Saberes y Pensamiento Matemático') return false;
    if (field === 'Saberes y Pensamiento Científico') {
      const subArea = document.getElementById('pdaSubAreaFilter')?.value;
      return subArea !== 'matematicas';
    }
    return true; // Lenguajes, Ética, Humano o Todos
  }

  // Poblar selector de alumnos
  function populateStudentSelect() {
    const select = document.getElementById('pdaStudentSelect');
    if (!select) return;
    const currentVal = select.value;
    const students = getStudents();

    let html = '<option value="">Selecciona un alumno</option>';
    students.forEach(st => {
      const name = typeof window.fullName === 'function' ? window.fullName(st) : (st.nombre || st.name || st.id);
      html += `<option value="${escapeHtmlStr(st.id)}">${escapeHtmlStr(name)}</option>`;
    });
    select.innerHTML = html;
    if (currentVal) select.value = currentVal;
  }

  // Inicializar eventos de filtros curriculares
  function initCurricularFilters() {
    const fieldSelect = document.getElementById('pdaFieldFilter');
    const subAreaSelect = document.getElementById('pdaSubAreaFilter');
    const contentSelect = document.getElementById('pdaContentFilter');
    const pdaSelect = document.getElementById('pdaSelectFilter');
    const levelSelect = document.getElementById('pdaLevelFilter');
    const searchInput = document.getElementById('pdaSearch');

    if (!fieldSelect || !contentSelect || !pdaSelect) return;

    fieldSelect.addEventListener('change', () => {
      const subWrap = document.getElementById('pdaSubAreaWrap');
      if (subWrap) {
        if (fieldSelect.value === 'Saberes y Pensamiento Científico') {
          subWrap.style.display = 'block';
        } else {
          subWrap.style.display = 'none';
          if (subAreaSelect) subAreaSelect.value = 'todas';
        }
      }
      updateContentOptions();
      updatePdaOptions();
      renderPdaObservations();
    });

    subAreaSelect?.addEventListener('change', () => {
      updateContentOptions();
      updatePdaOptions();
      renderPdaObservations();
    });

    contentSelect.addEventListener('change', () => {
      updatePdaOptions();
      renderPdaObservations();
    });

    pdaSelect.addEventListener('change', () => {
      renderPdaObservations();
    });

    levelSelect?.addEventListener('change', () => {
      renderPdaObservations();
    });

    searchInput?.addEventListener('input', () => {
      renderPdaObservations();
    });
  }

  // Actualizar el primer selector secundario (Contenido curricular o Bloque matemático)
  function updateContentOptions() {
    const contentSelect = document.getElementById('pdaContentFilter');
    const contentLabel = contentSelect?.parentElement;
    if (!contentSelect) return;

    const mathActive = isMathMode();
    const incMath = includesMath();
    const incPda = includesGeneralPda();

    // Actualizar texto del label descriptivo
    if (contentLabel && contentLabel.firstChild) {
      if (mathActive) {
        contentLabel.childNodes[0].nodeValue = 'Bloque matemático (12 bloques)\n                ';
      } else if (incMath && incPda) {
        contentLabel.childNodes[0].nodeValue = 'Contenido curricular / Bloque matemático\n                ';
      } else {
        contentLabel.childNodes[0].nodeValue = 'Contenido curricular oficial\n                ';
      }
    }

    let html = '';
    if (mathActive) {
      html = '<option value="">Todos los bloques matemáticos (12)</option>';
      BLOQUES_MATEMATICAS_ORDEN.forEach(b => {
        html += `<option value="BLOQUE:${escapeHtmlStr(b)}">${escapeHtmlStr(b)}</option>`;
      });
    } else {
      const fieldSelect = document.getElementById('pdaFieldFilter');
      const selectedField = fieldSelect ? fieldSelect.value.trim() : '';

      html = '<option value="">Todos los contenidos curriculares</option>';

      // Contenidos PDA
      if (incPda) {
        const bancoPda = getBancoPda();
        const contenidosSet = new Set();
        bancoPda.forEach(item => {
          if (!selectedField || item.campo === selectedField || (selectedField === 'Saberes y Pensamiento Científico' && item.campo.includes('Saberes'))) {
            if (item.contenido && !item.contenido.startsWith('(Continuación')) {
              contenidosSet.add(item.contenido.trim());
            }
          }
        });
        const contenidos = Array.from(contenidosSet).sort((a, b) => a.localeCompare(b, 'es'));
        if (contenidos.length) {
          if (incMath) html += '<optgroup label="Contenidos SEP - Fase 4">';
          contenidos.forEach(c => {
            html += `<option value="${escapeHtmlStr(c)}">${escapeHtmlStr(c)}</option>`;
          });
          if (incMath) html += '</optgroup>';
        }
      }

      // Bloques de Matemáticas
      if (incMath) {
        html += '<optgroup label="Matemáticas - Bloques temáticos">';
        BLOQUES_MATEMATICAS_ORDEN.forEach(b => {
          html += `<option value="BLOQUE:${escapeHtmlStr(b)}">${escapeHtmlStr(b)}</option>`;
        });
        html += '</optgroup>';
      }
    }

    contentSelect.innerHTML = html;
  }

  // Actualizar el segundo selector secundario (PDA o Tema evaluado)
  function updatePdaOptions() {
    const pdaSelect = document.getElementById('pdaSelectFilter');
    const pdaLabel = pdaSelect?.parentElement;
    const contentSelect = document.getElementById('pdaContentFilter');
    if (!pdaSelect) return;

    const mathActive = isMathMode();
    const incMath = includesMath();
    const incPda = includesGeneralPda();
    const selectedContentVal = contentSelect ? contentSelect.value.trim() : '';
    const isBlockSelected = selectedContentVal.startsWith('BLOQUE:');
    const selectedBlock = isBlockSelected ? selectedContentVal.slice(7) : '';

    if (pdaLabel && pdaLabel.firstChild) {
      if (mathActive || isBlockSelected) {
        pdaLabel.childNodes[0].nodeValue = 'Tema o aprendizaje evaluado (200 temas)\n                ';
      } else {
        pdaLabel.childNodes[0].nodeValue = 'PDA (Proceso de Desarrollo de Aprendizaje)\n                ';
      }
    }

    let html = '';
    if (mathActive || isBlockSelected) {
      html = '<option value="">Todos los temas de Matemáticas</option>';
      const mathBanco = getBancoMatematicas();
      const temasVistos = new Set();
      const temasList = [];

      mathBanco.forEach(item => {
        if (!selectedBlock || item.bloque === selectedBlock) {
          if (!temasVistos.has(item.tema)) {
            temasVistos.add(item.tema);
            temasList.push({ num: item.numero, tema: item.tema, bloque: item.bloque });
          }
        }
      });

      temasList.sort((a, b) => a.num - b.num);
      temasList.forEach(t => {
        const label = `${t.num}. ${t.tema}${!selectedBlock ? ` (${t.bloque})` : ''}`;
        html += `<option value="TEMA:${escapeHtmlStr(t.tema)}">${escapeHtmlStr(label)}</option>`;
      });
    } else {
      const fieldSelect = document.getElementById('pdaFieldFilter');
      const selectedField = fieldSelect ? fieldSelect.value.trim() : '';

      html = '<option value="">Todos los PDA del filtro seleccionado</option>';

      if (incPda) {
        const bancoPda = getBancoPda();
        const pdasSet = new Set();
        bancoPda.forEach(item => {
          const matchField = !selectedField || item.campo === selectedField || (selectedField === 'Saberes y Pensamiento Científico' && item.campo.includes('Saberes'));
          const matchContent = !selectedContentVal || item.contenido === selectedContentVal;
          if (matchField && matchContent && item.pda) {
            pdasSet.add(item.pda.trim());
          }
        });

        const pdasList = Array.from(pdasSet).sort((a, b) => a.localeCompare(b, 'es'));
        if (pdasList.length) {
          if (incMath) html += '<optgroup label="PDA oficiales de 4.º">';
          pdasList.forEach(p => {
            const shortText = p.length > 95 ? p.slice(0, 92) + '…' : p;
            html += `<option value="${escapeHtmlStr(p)}">${escapeHtmlStr(shortText)}</option>`;
          });
          if (incMath) html += '</optgroup>';
        }
      }

      if (incMath && !selectedContentVal) {
        html += '<optgroup label="Temas de Matemáticas">';
        const mathBanco = getBancoMatematicas();
        const temasVistos = new Set();
        mathBanco.forEach(item => {
          if (!temasVistos.has(item.tema)) {
            temasVistos.add(item.tema);
            html += `<option value="TEMA:${escapeHtmlStr(item.tema)}">${item.numero}. ${escapeHtmlStr(item.tema)} (${escapeHtmlStr(item.bloque)})</option>`;
          }
        });
        html += '</optgroup>';
      }
    }

    pdaSelect.innerHTML = html;
  }

  // Filtrar observaciones combinadas
  function getFilteredObservations() {
    const bancoPda = getBancoPda();
    const bancoMath = getBancoMatematicas();

    const field = (document.getElementById('pdaFieldFilter')?.value || '').trim();
    const contentVal = (document.getElementById('pdaContentFilter')?.value || '').trim();
    const pdaVal = (document.getElementById('pdaSelectFilter')?.value || '').trim();
    const level = (document.getElementById('pdaLevelFilter')?.value || '').trim();
    const query = (document.getElementById('pdaSearch')?.value || '').trim().toLowerCase();

    const isBlockFilter = contentVal.startsWith('BLOQUE:');
    const selectedBlock = isBlockFilter ? contentVal.slice(7) : '';
    const isTopicFilter = pdaVal.startsWith('TEMA:');
    const selectedTopic = isTopicFilter ? pdaVal.slice(5) : '';

    const results = [];

    // 1. Filtrar PDA generales si corresponde
    const allowPda = includesGeneralPda() && !isBlockFilter && !isTopicFilter;
    if (allowPda) {
      bancoPda.forEach(row => {
        if (field && field !== 'Saberes y Pensamiento Científico' && row.campo !== field) return;
        if (field === 'Saberes y Pensamiento Científico' && !row.campo.includes('Saberes')) return;
        if (contentVal && row.contenido !== contentVal) return;
        if (pdaVal && row.pda !== pdaVal) return;
        if (level && row.nivel !== level) return;
        if (query) {
          const haystack = `${row.id} ${row.campo} ${row.contenido} ${row.pda} ${row.nivel} ${row.texto}`.toLowerCase();
          if (!haystack.includes(query)) return false;
        }
        results.push(row);
      });
    }

    // 2. Filtrar observaciones de Matemáticas si corresponde
    const allowMath = includesMath() && (!contentVal || isBlockFilter);
    if (allowMath) {
      bancoMath.forEach(row => {
        if (selectedBlock && row.bloque !== selectedBlock) return;
        if (selectedTopic && row.tema !== selectedTopic) return;
        if (level && row.nivel !== level) return;
        if (query) {
          const haystack = `${row.id} Matemáticas ${row.bloque} ${row.tema} ${row.nivel} ${row.texto}`.toLowerCase();
          if (!haystack.includes(query)) return false;
        }
        results.push(row);
      });
    }

    return results;
  }

  // Renderizar la lista de observaciones
  function renderPdaObservations() {
    const listHost = document.getElementById('pdaObservationsList');
    const badge = document.getElementById('pdaCountBadge');
    const summary = document.getElementById('pdaActiveSummary');
    if (!listHost) return;

    const filtered = getFilteredObservations();
    const totalCatalog = getBancoPda().length + getBancoMatematicas().length;

    const contentVal = (document.getElementById('pdaContentFilter')?.value || '').trim();
    const pdaVal = (document.getElementById('pdaSelectFilter')?.value || '').trim();
    const isTopic = pdaVal.startsWith('TEMA:');
    const isBlock = contentVal.startsWith('BLOQUE:');

    // Resumen visual de lo seleccionado
    if (summary) {
      if (isTopic) {
        summary.style.display = 'block';
        const topicName = pdaVal.slice(5);
        summary.innerHTML = `<strong>Tema de Matemáticas en evaluación:</strong> ${escapeHtmlStr(topicName)} ${isBlock ? `· Bloque: ${escapeHtmlStr(contentVal.slice(7))}` : ''}`;
      } else if (pdaVal) {
        summary.style.display = 'block';
        summary.innerHTML = `<strong>PDA oficial en evaluación:</strong> ${escapeHtmlStr(pdaVal)}`;
      } else if (isBlock) {
        summary.style.display = 'block';
        summary.innerHTML = `<strong>Bloque matemático seleccionado:</strong> ${escapeHtmlStr(contentVal.slice(7))} (Filtra por tema para ver sus 5 observaciones por nivel)`;
      } else {
        summary.style.display = 'none';
        summary.innerHTML = '';
      }
    }

    if (badge) {
      badge.textContent = `${filtered.length} de ${totalCatalog} observaciones`;
    }

    if (!filtered.length) {
      listHost.innerHTML = '<p class="muted" style="padding:16px;text-align:center;">No se encontraron observaciones con los filtros seleccionados.</p>';
      return;
    }

    // Si hay un tema o PDA seleccionado, mostramos todas (normalmente 5 o 15). Si no, limitamos a 60 para máxima fluidez.
    const isSpecificSelected = Boolean(pdaVal);
    const displayList = isSpecificSelected ? filtered : filtered.slice(0, 60);

    let html = '';
    displayList.forEach(item => {
      const isSelected = selectedObservationData && selectedObservationData.id === item.id;
      const levelClass = item.nivel === 'Logrado' ? 'logrado' : (item.nivel === 'En proceso' ? 'en-proceso' : 'requiere-apoyo');
      const isMath = Boolean(item.bloque || item.tema);

      const headerLabel = isMath
        ? `Matemáticas · ${escapeHtmlStr(item.bloque)} · Opción ${item.opcion} de 5`
        : `${escapeHtmlStr(item.campo)} · Opción ${item.opcion} de 5`;

      const metaText = isMath
        ? `<b>Tema:</b> ${escapeHtmlStr(item.tema)}${item.contenido ? ` · <b>Contenido:</b> ${escapeHtmlStr(item.contenido)}` : ''}`
        : `<b>PDA:</b> ${escapeHtmlStr(item.pda.length > 120 ? item.pda.slice(0, 117) + '…' : item.pda)}`;

      html += `
        <article class="observation-choice ${isSelected ? 'selected' : ''}" data-pda-id="${escapeHtmlStr(item.id)}" style="cursor:pointer;position:relative;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <span style="color:#168f98;font-weight:700;">${headerLabel}</span>
            <span class="pda-level-badge ${levelClass}">${escapeHtmlStr(item.nivel)}</span>
          </div>
          <b style="font-size:0.92rem;line-height:1.45;color:#17324d;margin:4px 0 2px 0;">${escapeHtmlStr(item.texto)}</b>
          <small class="muted" style="display:block;font-size:0.75rem;line-height:1.3;margin-top:2px;">
            ${metaText}
          </small>
          <div class="button-row" style="margin-top:6px;gap:6px;">
            <button type="button" class="btn small primary" data-action="select-pda-obs" data-id="${escapeHtmlStr(item.id)}">Seleccionar</button>
            <button type="button" class="btn small" data-action="copy-inline-pda" data-text="${escapeHtmlStr(item.texto)}">Copiar</button>
          </div>
        </article>
      `;
    });

    if (filtered.length > displayList.length) {
      html += `<p class="muted" style="text-align:center;font-size:0.8rem;padding:8px;">Mostrando las primeras 60 observaciones coincidentes. Selecciona un Bloque y Tema para ver sus 5 de cada nivel.</p>`;
    }

    listHost.innerHTML = html;
  }

  // Cargar observación en el formulario de asignación
  function selectPdaObservation(obsId) {
    const bancoPda = getBancoPda();
    const bancoMath = getBancoMatematicas();
    const item = bancoPda.find(r => r.id === obsId) || bancoMath.find(r => r.id === obsId);
    if (!item) return;

    selectedObservationData = item;

    const form = document.getElementById('pdaRecordForm');
    if (!form) return;

    const isMath = Boolean(item.bloque || item.tema);

    form.elements.observacionId.value = item.id;
    form.elements.campo.value = isMath ? 'Saberes y Pensamiento Científico' : item.campo;
    form.elements.nivel.value = item.nivel;
    form.elements.pda.value = isMath ? `Matemáticas · ${item.bloque}: ${item.tema}` : item.pda;
    form.elements.texto.value = item.texto;

    // Sugerencia pedagógica para recomendación según nivel
    if (!form.elements.recomendacion.value) {
      if (item.nivel === 'Logrado') {
        form.elements.recomendacion.value = 'Felicitar al alumno y motivarle a seguir profundizando en sus aprendizajes.';
      } else if (item.nivel === 'En proceso') {
        form.elements.recomendacion.value = 'Repasar las actividades en casa y fortalecer la práctica constante con apoyo de la familia.';
      } else {
        form.elements.recomendacion.value = 'Acompañar de cerca las tareas escolares y coordinar con el docente actividades de refuerzo en casa.';
      }
    }

    // Actualizar clase selected en tarjetas
    document.querySelectorAll('#pdaObservationsList .observation-choice').forEach(card => {
      card.classList.toggle('selected', card.dataset.pdaId === item.id);
    });

    if (window.innerWidth < 850) {
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // Copiar texto al portapapeles
  async function copyText(text) {
    if (!text) {
      showToast('No hay texto para copiar', true);
      return;
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      showToast('✓ Observación copiada al portapapeles');
    } catch (err) {
      showToast('No se pudo copiar automáticamente', true);
    }
  }

  // Guardar observación para el alumno
  async function savePdaRecord(e) {
    e.preventDefault();
    const form = document.getElementById('pdaRecordForm');
    if (!form) return;

    const studentId = form.elements.alumnoId.value;
    if (!studentId) {
      showToast('Selecciona a un alumno para registrar la observación.', true);
      form.elements.alumnoId.focus();
      return;
    }

    const fecha = form.elements.fecha.value || getToday();
    const campo = form.elements.campo.value || 'Saberes y Pensamiento Científico';
    const nivel = form.elements.nivel.value || 'Logrado';
    const pdaOrTopic = form.elements.pda.value.trim();
    const texto = form.elements.texto.value.trim();
    const recomendacion = form.elements.recomendacion.value.trim();
    const autorizada = form.elements.autorizada.checked;

    if (!texto) {
      showToast('Escribe o selecciona la observación a registrar.', true);
      form.elements.texto.focus();
      return;
    }

    const payload = {
      alumnoId: studentId,
      fecha: fecha,
      categoria: campo,
      tipo: nivel,
      texto: texto,
      recomendacion: recomendacion,
      evidencia: pdaOrTopic ? `Aprendizaje: ${pdaOrTopic}` : '',
      observacionId: form.elements.observacionId.value || '',
      autorizada: autorizada
    };

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Guardando…';
    }

    try {
      let result;
      if (typeof window.server === 'function') {
        result = await window.server('saveObservationOccurrence', payload);
        if (result && result.duplicate && confirm(result.message)) {
          payload.confirmarOcurrencia = true;
          result = await window.server('saveObservationOccurrence', payload);
        }
      }

      showToast(result?.message || '✓ Observación guardada correctamente');

      // Limpiar texto temporal del formulario sin deseleccionar alumno ni fecha
      form.elements.texto.value = '';
      form.elements.recomendacion.value = '';
      form.elements.observacionId.value = '';
      selectedObservationData = null;
      document.querySelectorAll('#pdaObservationsList .observation-choice').forEach(card => card.classList.remove('selected'));

      // Actualizar historial del alumno
      await loadPdaHistory(studentId);
    } catch (err) {
      console.error('Error al guardar observación:', err);
      showToast('Error al guardar: ' + (err.message || 'Intente de nuevo'), true);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Guardar en registro del alumno';
      }
    }
  }

  // Cargar historial de observaciones del alumno seleccionado
  async function loadPdaHistory(studentId) {
    const host = document.getElementById('pdaHistoryRecords');
    if (!host) return;

    if (!studentId) {
      host.innerHTML = '<p class="muted" style="padding:14px;text-align:center;">Selecciona un alumno para consultar sus observaciones registradas.</p>';
      return;
    }

    host.innerHTML = '<p class="muted" style="padding:14px;text-align:center;">Cargando historial del alumno…</p>';

    try {
      const filters = { alumnoId: studentId };
      const dateInput = document.getElementById('pdaRecordDate');
      const currentDate = dateInput ? dateInput.value : getToday();

      if (currentHistoryMode === 'current' && typeof window.weekMonday === 'function') {
        filters.semanaInicio = window.weekMonday(currentDate);
      }

      let rows = [];
      if (typeof window.server === 'function') {
        rows = await window.server('getObservationRecords', filters);
      }

      if (!rows || !rows.length) {
        host.innerHTML = `<p class="muted" style="padding:14px;text-align:center;">${currentHistoryMode === 'current' ? 'No hay observaciones registradas en esta semana para este alumno.' : 'No hay observaciones registradas para este alumno.'}</p>`;
        return;
      }

      let html = '';
      rows.forEach(row => {
        const isAuth = row.autorizada === true || String(row.autorizada) === 'true';
        const dateStr = typeof window.formatDateShort === 'function' ? window.formatDateShort(row.fecha) : row.fecha;

        html += `
          <article class="observation-record" style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:12px;background:#fff;border:1px solid #d7e1e9;border-radius:10px;">
            <div style="flex:1;">
              <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px;">
                <span class="badge">${escapeHtmlStr(row.categoria || 'Curricular')}</span>
                <span class="pda-level-badge ${row.tipo === 'Logrado' ? 'logrado' : (row.tipo === 'En proceso' ? 'en-proceso' : 'requiere-apoyo')}">${escapeHtmlStr(row.tipo || 'Evaluación')}</span>
              </div>
              <b style="color:#17324d;display:block;margin-bottom:4px;">${escapeHtmlStr(row.texto)}</b>
              ${row.recomendacion ? `<p style="font-size:0.8rem;color:#0b315d;margin:3px 0;"><b>Recomendación:</b> ${escapeHtmlStr(row.recomendacion)}</p>` : ''}
              <p class="muted" style="font-size:0.75rem;margin:3px 0;">${escapeHtmlStr(dateStr)} ${row.evidencia ? `· ${escapeHtmlStr(row.evidencia)}` : ''}</p>
            </div>
            <label class="check" style="white-space:nowrap;font-size:0.8rem;">
              <input type="checkbox" data-authorize-observation="${escapeHtmlStr(row.id)}" ${isAuth ? 'checked' : ''}> En reporte
            </label>
          </article>
        `;
      });

      host.innerHTML = html;
    } catch (err) {
      host.innerHTML = '<p class="muted" style="padding:14px;text-align:center;">No fue posible cargar el historial.</p>';
    }
  }

  // Restablecer filtros
  function resetPdaFilters() {
    const fieldSelect = document.getElementById('pdaFieldFilter');
    const subAreaSelect = document.getElementById('pdaSubAreaFilter');
    const subWrap = document.getElementById('pdaSubAreaWrap');
    const contentSelect = document.getElementById('pdaContentFilter');
    const pdaSelect = document.getElementById('pdaSelectFilter');
    const levelSelect = document.getElementById('pdaLevelFilter');
    const searchInput = document.getElementById('pdaSearch');

    if (fieldSelect) fieldSelect.value = '';
    if (subAreaSelect) subAreaSelect.value = 'todas';
    if (subWrap) subWrap.style.display = 'none';

    updateContentOptions();
    if (contentSelect) contentSelect.value = '';
    updatePdaOptions();
    if (pdaSelect) pdaSelect.value = '';
    if (levelSelect) levelSelect.value = '';
    if (searchInput) searchInput.value = '';

    renderPdaObservations();
    showToast('Filtros restablecidos');
  }

  // Función pública para abrir la vista
  window.openPdaObservations = function () {
    if (typeof window.showView === 'function') {
      window.showView('pda-observations');
    }

    populateStudentSelect();

    const dateInput = document.getElementById('pdaRecordDate');
    if (dateInput && !dateInput.value) {
      dateInput.value = getToday();
    }

    updateContentOptions();
    updatePdaOptions();
    renderPdaObservations();

    const studentSelect = document.getElementById('pdaStudentSelect');
    if (studentSelect && studentSelect.value) {
      loadPdaHistory(studentSelect.value);
    }
  };

  // Inicialización de eventos al cargar el DOM
  document.addEventListener('DOMContentLoaded', () => {
    initCurricularFilters();

    const pdaForm = document.getElementById('pdaRecordForm');
    pdaForm?.addEventListener('submit', savePdaRecord);

    document.getElementById('btnCopyPdaText')?.addEventListener('click', () => {
      const text = document.getElementById('pdaFormTexto')?.value || '';
      copyText(text);
    });

    document.getElementById('pdaStudentSelect')?.addEventListener('change', e => {
      loadPdaHistory(e.target.value);
    });

    document.getElementById('pdaRecordDate')?.addEventListener('change', () => {
      const studentId = document.getElementById('pdaStudentSelect')?.value;
      if (studentId) loadPdaHistory(studentId);
    });

    document.addEventListener('click', e => {
      const selectBtn = e.target.closest('[data-action="select-pda-obs"]');
      if (selectBtn) {
        selectPdaObservation(selectBtn.dataset.id);
        return;
      }

      const copyBtn = e.target.closest('[data-action="copy-inline-pda"]');
      if (copyBtn) {
        copyText(copyBtn.dataset.text);
        return;
      }

      const card = e.target.closest('#pdaObservationsList .observation-choice');
      if (card && !e.target.closest('button')) {
        selectPdaObservation(card.dataset.pdaId);
        return;
      }

      const resetBtn = e.target.closest('[data-action="reset-pda-filters"]');
      if (resetBtn) {
        resetPdaFilters();
        return;
      }

      const histCurr = e.target.closest('[data-action="pda-history-current"]');
      if (histCurr) {
        currentHistoryMode = 'current';
        const stId = document.getElementById('pdaStudentSelect')?.value;
        if (stId) loadPdaHistory(stId);
        return;
      }

      const histAll = e.target.closest('[data-action="pda-history-all"]');
      if (histAll) {
        currentHistoryMode = 'all';
        const stId = document.getElementById('pdaStudentSelect')?.value;
        if (stId) loadPdaHistory(stId);
        return;
      }
    });
  });
})();
