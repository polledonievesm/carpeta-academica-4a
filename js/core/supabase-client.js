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
    // Si la tabla aún no existe
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
  const students = state.students || [];
  if (!students.length) throw new Error('No hay alumnos cargados en memoria para sincronizar.');

  const payload = students.map((s, idx) => ({
    id: String(s.id || s.numeroLista || (idx + 1)),
    numero_lista: s.numeroLista || (idx + 1),
    nombre: s.nombre || s.name || 'Sin nombre',
    apellido_paterno: s.apellidoPaterno || '',
    apellido_materno: s.apellidoMaterno || '',
    nombres: s.nombres || '',
    curp: s.curp || '',
    estilo_aprendizaje: s.estiloAprendizaje || '',
    tutor_nombre: s.tutorNombre || '',
    tutor_telefono: s.tutorTelefono || '',
    updated_at: new Date().toISOString()
  }));

  const { data, error } = await sb.from('alumnos').upsert(payload, { onConflict: 'id' });
  if (error) throw error;
  return payload.length;
}

window.SUPABASE_CONFIG = SUPABASE_CONFIG;
window.getSupabase = getSupabase;
window.testSupabaseConnection = testSupabaseConnection;
window.syncStudentsToSupabase = syncStudentsToSupabase;
