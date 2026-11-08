/* ==========================================================================
   MÓDULO: COPIAS DE SEGURIDAD (RESPALDO EN 1 CLIC Y RESTAURACIÓN)
   ========================================================================== */

function downloadGroupBackup() {
  try {
    const backupData = {
      version: '2.1-modular',
      timestamp: new Date().toISOString(),
      fechaLegible: new Date().toLocaleString('es-MX'),
      grupo: '4A',
      state: {
        config: state.config,
        students: state.students,
        subjects: state.subjects,
        projects: state.projects,
        attendance: state.attendance,
        attendanceRecords: state.attendanceRecords,
        stats: state.stats
      },
      localStorageDrafts: {}
    };

    // Respaldar borradores locales clave
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('carpeta_') || key.startsWith('jornada_') || key.includes('draft'))) {
        try {
          backupData.localStorageDrafts[key] = localStorage.getItem(key);
        } catch (_) {}
      }
    }

    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const dateStr = new Date().toISOString().slice(0, 10);
    const link = document.createElement('a');
    link.href = url;
    link.download = `respaldo-carpeta-academica-4A-${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast('✓ Copia de seguridad descargada correctamente.');
  } catch (err) {
    console.error('Error al generar respaldo:', err);
    toast('Error al generar copia de seguridad: ' + err.message, true);
  }
}

function restoreGroupBackupFromFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (!data || !data.state) {
        throw new Error('El archivo no contiene un formato de respaldo válido de Carpeta Académica.');
      }

      const count = (data.state.students || []).length;
      if (!confirm(`Se restaurará el respaldo del ${data.fechaLegible || data.timestamp}. Alumnos: ${count}. ¿Deseas continuar?`)) {
        return;
      }

      // Restaurar estado en memoria
      Object.assign(state, data.state);

      // Restaurar borradores
      if (data.localStorageDrafts) {
        Object.entries(data.localStorageDrafts).forEach(([k, v]) => {
          try { localStorage.setItem(k, v); } catch (_) {}
        });
      }

      // Guardar en bootstrap cache para persistencia
      saveBootstrapCache(data.state);

      toast('✓ Respaldo restaurado con éxito. Recargando...', false);
      setTimeout(() => location.reload(), 1200);
    } catch (err) {
      alert('Error al restaurar respaldo: ' + err.message);
    }
  };
  reader.readAsText(file);
}

function updateSettingsStats() {
  const sc = document.getElementById('settingsStudentCount');
  const pc = document.getElementById('settingsProjectCount');
  if (sc) sc.textContent = (state.students || []).length;
  if (pc) pc.textContent = (state.projects || []).length;
}

window.downloadGroupBackup = downloadGroupBackup;
window.restoreGroupBackupFromFile = restoreGroupBackupFromFile;
window.updateSettingsStats = updateSettingsStats;
