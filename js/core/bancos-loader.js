/* ==========================================================================
   MÓDULO: CARGA OPTIMIZADA BAJO DEMANDA DE BANCOS DE DATOS (LAZY LOADING)
   Evita descargar 3.6 MB al inicio. Carga en segundo plano al estar inactivo.
   ========================================================================== */
window.cargarBanco = function(tipo) {
  return new Promise((resolve) => {
    if (tipo === 'pda' && Array.isArray(window.BANCO_OBSERVACIONES_PDA)) return resolve();
    if (tipo === 'matematicas' && Array.isArray(window.BANCO_OBSERVACIONES_MATEMATICAS)) return resolve();
    if (tipo === 'conducta' && Array.isArray(window.BANCO_OBSERVACIONES_CONDUCTA)) return resolve();

    const mapa = {
      pda: 'banco-pda.js',
      matematicas: 'banco-matematicas.js',
      conducta: 'banco-conducta.js'
    };

    const s = document.createElement('script');
    s.src = mapa[tipo] || '';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => resolve(); // no bloquear si falla red
    document.head.appendChild(s);
  });
};

// Precarga silenciosa en momentos de inactividad (sin trabar el inicio)
if (typeof window !== 'undefined') {
  const precargarBancosEnInactividad = () => {
    setTimeout(() => {
      window.cargarBanco('pda');
      window.cargarBanco('matematicas');
      window.cargarBanco('conducta');
    }, 2500);
  };
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(precargarBancosEnInactividad, { timeout: 4000 });
  } else {
    window.addEventListener('load', precargarBancosEnInactividad, { once: true });
  }
}
