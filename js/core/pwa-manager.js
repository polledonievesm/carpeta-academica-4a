/* ==========================================================================
   MÓDULO: GESTOR DE PWA, INSTALACIÓN Y MONITOREO DE CONECTIVIDAD OFFLINE
   ========================================================================== */

let deferredInstallPrompt = null;

// Registro de Service Worker
if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => {
        console.log('[PWA] Service Worker registrado con éxito en alcance:', reg.scope);
      })
      .catch(err => {
        console.warn('[PWA] Fallo al registrar Service Worker:', err);
      });
  });
}

// Monitoreo de Conectividad (Online / Offline)
function handleOnlineStatus() {
  const offlineBadge = document.getElementById('offlineSyncBadge');
  if (navigator.onLine) {
    if (offlineBadge) {
      offlineBadge.style.display = 'none';
    }
    toast('✓ Conectado a internet. Sincronizando...', false);
    if (typeof syncBootstrapInBackground === 'function') {
      syncBootstrapInBackground();
    }
  } else {
    if (!offlineBadge) {
      createOfflineBadge();
    } else {
      offlineBadge.style.display = 'inline-flex';
    }
    toast('📡 Modo sin conexión. Puedes continuar calificando, tus datos se guardan en tu teléfono.', false);
  }
}

function createOfflineBadge() {
  const badge = document.createElement('div');
  badge.id = 'offlineSyncBadge';
  badge.style.cssText = 'position:fixed;bottom:16px;right:16px;background:#073B61;color:#ffffff;padding:8px 14px;border-radius:999px;font-size:12px;font-weight:700;display:inline-flex;align-items:center;gap:6px;box-shadow:0 4px 14px rgba(0,0,0,0.3);z-index:9999;border:1px solid #12B8B5;';
  badge.innerHTML = '<span>📡</span> Modo sin conexión (Guardado local)';
  document.body.appendChild(badge);
}

window.addEventListener('online', handleOnlineStatus);
window.addEventListener('offline', handleOnlineStatus);

// Manejo del evento de instalación en celular/PC
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  
  const installBtn = document.getElementById('pwaInstallBtn');
  if (installBtn) {
    installBtn.style.display = 'inline-flex';
    installBtn.onclick = async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      const choiceResult = await deferredInstallPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        toast('¡Gracias por instalar Carpeta Académica!', false);
      }
      deferredInstallPrompt = null;
      installBtn.style.display = 'none';
    };
  }
});

window.addEventListener('appinstalled', () => {
  console.log('[PWA] Aplicación instalada exitosamente.');
  deferredInstallPrompt = null;
  const installBtn = document.getElementById('pwaInstallBtn');
  if (installBtn) installBtn.style.display = 'none';
});
