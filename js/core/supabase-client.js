/* ==========================================================================
   CONECTOR DE BASE DE DATOS EN LA NUBE (SUPABASE POSTGRESQL)
   Permite guardar y consultar calificaciones y asistencias en milisegundos.
   ========================================================================== */

const SUPABASE_CONFIG = {
  url: 'https://wdnzjopfrpkqomsoywwu.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indkbnpqb3BmcnBrcW9tc295d3d1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQxMDE4MzUsImV4cCI6MjEwOTY3NzgzNX0.zZp0g1yvDZaFgiJcVWC250D-Ix2CliMMy2XlpPNaz3s'
};

let _supabaseClient = null;

function getSupabase() {
  if (_supabaseClient) return _supabaseClient;
  if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
    _supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
    return _supabaseClient;
  }
  return null;
}

// Probar conexión en vivo con Supabase
async function testSupabaseConnection() {
  const sb = getSupabase();
  if (!sb) {
    throw new Error('La librería cliente de Supabase no se ha inicializado.');
  }
  const startTime = performance.now();
  const { data, error } = await sb.from('alumnos').select('id', { count: 'exact', head: true });
  const latency = Math.round(performance.now() - startTime);

  if (error) {
    if (error.code === 'PGRST205') {
      return {
        ok: false,
        needsSchema: true,
        latency,
        message: 'Conexión autenticada con éxito, pero aún falta ejecutar el script SQL para crear las tablas.'
      };
    }
    throw error;
  }

  return {
    ok: true,
    needsSchema: false,
    latency,
    message: `¡Conexión exitosa con Supabase! Tiempo de respuesta: ${latency} ms`
  };
}

// Sincronizar lista de alumnos local hacia Supabase
async function syncStudentsToSupabase() {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase no disponible');
  const students = (typeof state !== 'undefined' && state.students) ? state.students : [];
  if (!students.length) throw new Error('No hay alumnos cargados en memoria para sincronizar.');

  const payload = students.map((s, idx) => {
    const studentFullName = (typeof fullName === 'function' ? fullName(s) : '') ||
      s.nombreCompleto ||
      [s.apellidoPaterno, s.apellidoMaterno, s.nombres].filter(Boolean).join(' ') ||
      s.name ||
      s.nombre ||
      ('Alumno ' + (s.numeroLista || idx + 1));

    return {
      id: String(s.id || s.numeroLista || (idx + 1)),
      numero_lista: Number(s.numeroLista || (idx + 1)),
      nombre: studentFullName,
      apellido_paterno: s.apellidoPaterno || '',
      apellido_materno: s.apellidoMaterno || '',
      nombres: s.nombres || studentFullName,
      curp: s.curp || '',
      estilo_aprendizaje: s.estilo || s.estiloAprendizaje || '',
      tutor_nombre: s.tutorNombre || '',
      tutor_telefono: s.tutorTelefono || '',
      updated_at: new Date().toISOString()
    };
  });

  const { data, error } = await sb.from('alumnos').upsert(payload, { onConflict: 'id' });
  if (error) throw error;
  return payload.length;
}

// Acciones directas para la interfaz de usuario (evita problemas de caché de scripts)
async function testSupabaseConnectionUI() {
  const el = document.getElementById('supabaseConnectionStatus');
  if (el) el.innerHTML = '<span class="status-indicator warning"></span> Probando conexión con Supabase...';
  try {
    const res = await testSupabaseConnection();
    if (el) {
      if (res.ok) {
        el.innerHTML = '<span class="status-indicator success" style="background:#10b981;display:inline-block;width:10px;height:10px;border-radius:50%;"></span> <span style="color:#059669;font-weight:700;">✓ Conectado (' + res.latency + ' ms) · En línea</span>';
        if (typeof window.toast === 'function') window.toast('✓ ' + res.message);
        else alert('✓ ' + res.message);
      } else if (res.needsSchema) {
        el.innerHTML = '<span class="status-indicator warning" style="background:#f59e0b;display:inline-block;width:10px;height:10px;border-radius:50%;"></span> <span style="color:#d97706;font-weight:700;">⚠️ Conectado · Falta ejecutar tablas</span>';
        if (typeof window.toast === 'function') window.toast('⚠️ ' + res.message, true);
        else alert('⚠️ ' + res.message);
      }
    }
  } catch (err) {
    if (el) el.innerHTML = '<span class="status-indicator danger" style="background:#ef4444;display:inline-block;width:10px;height:10px;border-radius:50%;"></span> <span style="color:#dc2626;font-weight:700;">❌ Error de conexión: ' + err.message + '</span>';
    alert('Error al conectar con Supabase: ' + err.message);
  }
}

async function syncStudentsToSupabaseUI() {
  try {
    if (typeof window.toast === 'function') window.toast('Sincronizando alumnos con Supabase...');
    const count = await syncStudentsToSupabase();
    const msg = '✓ ¡Éxito! ' + count + ' alumnos sincronizados y respaldados en la nube de Supabase.';
    if (typeof window.toast === 'function') window.toast(msg);
    alert(msg);
  } catch (err) {
    alert('Aviso de sincronización: ' + err.message);
  }
}

window.SUPABASE_CONFIG = SUPABASE_CONFIG;
window.getSupabase = getSupabase;
window.testSupabaseConnection = testSupabaseConnection;
window.syncStudentsToSupabase = syncStudentsToSupabase;
window.testSupabaseConnectionUI = testSupabaseConnectionUI;
window.syncStudentsToSupabaseUI = syncStudentsToSupabaseUI;
