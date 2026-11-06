/* ==========================================================================
   BANCO DE OBSERVACIONES POR PDA - FASE 4 (4.º GRADO)
   Nueva Escuela Mexicana - Carpeta Académica
   ========================================================================== */

(function () {
  'use strict';

  let currentHistoryMode = 'current'; // 'current' (semana) o 'all' (todo el ciclo)
  let selectedObservationData = null;

  function getBancoPda() {
    return Array.isArray(window.BANCO_OBSERVACIONES_PDA) ? window.BANCO_OBSERVACIONES_PDA : [];
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

  // Inicializar o refrescar lista de alumnos en el formulario de PDA
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

  // Inicializar selectores de filtros curriculares
  function initCurricularFilters() {
    const fieldSelect = document.getElementById('pdaFieldFilter');
    const contentSelect = document.getElementById('pdaContentFilter');
    const pdaSelect = document.getElementById('pdaSelectFilter');
    const levelSelect = document.getElementById('pdaLevelFilter');
    const searchInput = document.getElementById('pdaSearch');

    if (!fieldSelect || !contentSelect || !pdaSelect) return;

    // Actualizar contenidos cuando cambia el campo formativo
    fieldSelect.addEventListener('change', () => {
      updateContentOptions();
      updatePdaOptions();
      renderPdaObservations();
    });

    // Actualizar PDAs cuando cambia el contenido
    contentSelect.addEventListener('change', () => {
      updatePdaOptions();
      renderPdaObservations();
    });

    // Actualizar cuando cambia el PDA o el nivel
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

  function updateContentOptions() {
    const fieldSelect = document.getElementById('pdaFieldFilter');
    const contentSelect = document.getElementById('pdaContentFilter');
    if (!contentSelect) return;

    const selectedField = fieldSelect ? fieldSelect.value.trim() : '';
    const banco = getBancoPda();

    const contenidosSet = new Set();
    banco.forEach(item => {
      if (!selectedField || item.campo === selectedField) {
        if (item.contenido && !item.contenido.startsWith('(Continuación')) {
          contenidosSet.add(item.contenido.trim());
        }
      }
    });

    const contenidos = Array.from(contenidosSet).sort((a, b) => a.localeCompare(b, 'es'));
    let html = '<option value="">Todos los contenidos curriculares</option>';
    contenidos.forEach(c => {
      html += `<option value="${escapeHtmlStr(c)}">${escapeHtmlStr(c)}</option>`;
    });
    contentSelect.innerHTML = html;
  }

  function updatePdaOptions() {
    const fieldSelect = document.getElementById('pdaFieldFilter');
    const contentSelect = document.getElementById('pdaContentFilter');
    const pdaSelect = document.getElementById('pdaSelectFilter');
    if (!pdaSelect) return;

    const selectedField = fieldSelect ? fieldSelect.value.trim() : '';
    const selectedContent = contentSelect ? contentSelect.value.trim() : '';
    const banco = getBancoPda();

    const pdasSet = new Set();
    banco.forEach(item => {
      const matchField = !selectedField || item.campo === selectedField;
      const matchContent = !selectedContent || item.contenido === selectedContent;
      if (matchField && matchContent && item.pda) {
        pdasSet.add(item.pda.trim());
      }
    });

    const pdasList = Array.from(pdasSet).sort((a, b) => a.localeCompare(b, 'es'));
    let html = '<option value="">Todos los PDA del filtro seleccionado</option>';
    pdasList.forEach(p => {
      const shortText = p.length > 90 ? p.slice(0, 87) + '…' : p;
      html += `<option value="${escapeHtmlStr(p)}">${escapeHtmlStr(shortText)}</option>`;
    });
    pdaSelect.innerHTML = html;
  }

  // Filtrar observaciones según los controles
  function getFilteredObservations() {
    const banco = getBancoPda();
    const field = (document.getElementById('pdaFieldFilter')?.value || '').trim();
    const content = (document.getElementById('pdaContentFilter')?.value || '').trim();
    const pda = (document.getElementById('pdaSelectFilter')?.value || '').trim();
    const level = (document.getElementById('pdaLevelFilter')?.value || '').trim();
    const query = (document.getElementById('pdaSearch')?.value || '').trim().toLowerCase();

    return banco.filter(row => {
      if (field && row.campo !== field) return false;
      if (content && row.contenido !== content) return false;
      if (pda && row.pda !== pda) return false;
      if (level && row.nivel !== level) return false;
      if (query) {
        const haystack = `${row.id} ${row.campo} ${row.contenido} ${row.pda} ${row.nivel} ${row.texto}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }

  // Renderizar la lista de observaciones
  function renderPdaObservations() {
    const listHost = document.getElementById('pdaObservationsList');
    const badge = document.getElementById('pdaCountBadge');
    const summary = document.getElementById('pdaActiveSummary');
    if (!listHost) return;

    const filtered = getFilteredObservations();
    const totalBanco = getBancoPda().length;
    const selectedPda = document.getElementById('pdaSelectFilter')?.value;

    // Resumen activo
    if (summary) {
      if (selectedPda) {
        summary.style.display = 'block';
        summary.innerHTML = `<strong>PDA en evaluación:</strong> ${escapeHtmlStr(selectedPda)}`;
      } else {
        summary.style.display = 'none';
        summary.innerHTML = '';
      }
    }

    if (badge) {
      badge.textContent = `${filtered.length} de ${totalBanco} observaciones`;
    }

    if (!filtered.length) {
      listHost.innerHTML = '<p class="muted" style="padding:16px;text-align:center;">No se encontraron observaciones con los filtros seleccionados.</p>';
      return;
    }

    // Limit display to 60 items if no specific PDA is chosen to ensure smooth performance
    const displayList = selectedPda ? filtered : filtered.slice(0, 60);

    let html = '';
    displayList.forEach(item => {
      const isSelected = selectedObservationData && selectedObservationData.id === item.id;
      const levelClass = item.nivel === 'Logrado' ? 'logrado' : (item.nivel === 'En proceso' ? 'en-proceso' : 'requiere-apoyo');

      html += `
        <article class="observation-choice ${isSelected ? 'selected' : ''}" data-pda-id="${escapeHtmlStr(item.id)}" style="cursor:pointer;position:relative;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <span>${escapeHtmlStr(item.campo)} · Opción ${item.opcion} de 5</span>
            <span class="pda-level-badge ${levelClass}">${escapeHtmlStr(item.nivel)}</span>
          </div>
          <b style="font-size:0.92rem;line-height:1.45;color:#17324d;">${escapeHtmlStr(item.texto)}</b>
          <small class="muted" style="display:block;font-size:0.75rem;line-height:1.3;margin-top:2px;">
            <b>PDA:</b> ${escapeHtmlStr(item.pda.length > 120 ? item.pda.slice(0, 117) + '…' : item.pda)}
          </small>
          <div class="button-row" style="margin-top:6px;gap:6px;">
            <button type="button" class="btn small primary" data-action="select-pda-obs" data-id="${escapeHtmlStr(item.id)}">Seleccionar</button>
            <button type="button" class="btn small" data-action="copy-inline-pda" data-text="${escapeHtmlStr(item.texto)}">Copiar</button>
          </div>
        </article>
      `;
    });

    if (filtered.length > displayList.length) {
      html += `<p class="muted" style="text-align:center;font-size:0.8rem;padding:8px;">Mostrando las primeras 60 observaciones coincidentes. Filtra por Contenido o PDA para ver las 5 de cada nivel.</p>`;
    }

    listHost.innerHTML = html;
  }

  // Cargar una observación en el formulario de la derecha
  function selectPdaObservation(obsId) {
    const banco = getBancoPda();
    const item = banco.find(r => r.id === obsId);
    if (!item) return;

    selectedObservationData = item;

    const form = document.getElementById('pdaRecordForm');
    if (!form) return;

    form.elements.observacionId.value = item.id;
    form.elements.campo.value = item.campo;
    form.elements.nivel.value = item.nivel;
    form.elements.pda.value = item.pda;
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

    // Si está en pantalla pequeña, hacer scroll suave al formulario
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

  // Guardar observación de PDA para el alumno
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
    const campo = form.elements.campo.value || 'Lenguajes';
    const nivel = form.elements.nivel.value || 'Logrado';
    const pda = form.elements.pda.value.trim();
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
      evidencia: pda ? `PDA: ${pda}` : '',
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
      console.error('Error al guardar observación de PDA:', err);
      showToast('Error al guardar: ' + (err.message || 'Intente de nuevo'), true);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Guardar en registro del alumno';
      }
    }
  }

  // Cargar historial de observaciones de PDA del alumno seleccionado
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
                <span class="badge">${escapeHtmlStr(row.categoria || 'PDA')}</span>
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

  // Restablecer todos los filtros
  function resetPdaFilters() {
    const fieldSelect = document.getElementById('pdaFieldFilter');
    const contentSelect = document.getElementById('pdaContentFilter');
    const pdaSelect = document.getElementById('pdaSelectFilter');
    const levelSelect = document.getElementById('pdaLevelFilter');
    const searchInput = document.getElementById('pdaSearch');

    if (fieldSelect) fieldSelect.value = '';
    updateContentOptions();
    if (contentSelect) contentSelect.value = '';
    updatePdaOptions();
    if (pdaSelect) pdaSelect.value = '';
    if (levelSelect) levelSelect.value = '';
    if (searchInput) searchInput.value = '';

    renderPdaObservations();
    showToast('Filtros restablecidos');
  }

  // Función principal pública para abrir la vista de Observaciones por PDA
  window.openPdaObservations = function () {
    if (typeof window.showView === 'function') {
      window.showView('pda-observations');
    }

    populateStudentSelect();

    const dateInput = document.getElementById('pdaRecordDate');
    if (dateInput && !dateInput.value) {
      dateInput.value = getToday();
    }

    if (!document.getElementById('pdaContentFilter')?.options.length || document.getElementById('pdaContentFilter')?.options.length <= 1) {
      updateContentOptions();
      updatePdaOptions();
    }

    renderPdaObservations();

    const studentSelect = document.getElementById('pdaStudentSelect');
    if (studentSelect && studentSelect.value) {
      loadPdaHistory(studentSelect.value);
    }
  };

  // Inicialización de eventos al cargar el DOM
  document.addEventListener('DOMContentLoaded', () => {
    initCurricularFilters();

    // Eventos del formulario
    const pdaForm = document.getElementById('pdaRecordForm');
    pdaForm?.addEventListener('submit', savePdaRecord);

    // Botón de copiar en el formulario
    document.getElementById('btnCopyPdaText')?.addEventListener('click', () => {
      const text = document.getElementById('pdaFormTexto')?.value || '';
      copyText(text);
    });

    // Cambio de alumno en formulario
    document.getElementById('pdaStudentSelect')?.addEventListener('change', e => {
      loadPdaHistory(e.target.value);
    });

    // Cambio de fecha en formulario
    document.getElementById('pdaRecordDate')?.addEventListener('change', () => {
      const studentId = document.getElementById('pdaStudentSelect')?.value;
      if (studentId) loadPdaHistory(studentId);
    });

    // Delegación de clics en la lista de observaciones
    document.addEventListener('click', e => {
      // Seleccionar observación
      const selectBtn = e.target.closest('[data-action="select-pda-obs"]');
      if (selectBtn) {
        selectPdaObservation(selectBtn.dataset.id);
        return;
      }

      // Copiar inline
      const copyBtn = e.target.closest('[data-action="copy-inline-pda"]');
      if (copyBtn) {
        copyText(copyBtn.dataset.text);
        return;
      }

      // Clic en la tarjeta misma
      const card = e.target.closest('#pdaObservationsList .observation-choice');
      if (card && !e.target.closest('button')) {
        selectPdaObservation(card.dataset.pdaId);
        return;
      }

      // Botón restablecer filtros
      const resetBtn = e.target.closest('[data-action="reset-pda-filters"]');
      if (resetBtn) {
        resetPdaFilters();
        return;
      }

      // Historial esta semana vs todo el ciclo
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
