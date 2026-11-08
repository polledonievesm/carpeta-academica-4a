/* ==========================================================================
   SERVICE WORKER - CARPETA ACADÉMICA (MODO OFFLINE Y CACHÉ)
   ========================================================================== */
const CACHE_NAME = 'carpeta-academica-v2.2';
const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './logo-ia-polledo-symbol.png',
  './config.js',
  './css/base.css',
  './css/sidebar.css',
  './css/registro-diario.css',
  './css/calificaciones.css',
  './css/familias.css',
  './css/inscripcion.css',
  './css/modales.css',
  './js/core/bancos-loader.js',
  './js/core/state-api.js',
  './js/core/auth-boot.js',
  './js/core/navigation.js',
  './js/core/utils.js',
  './js/core/backup.js',
  './js/core/pwa-manager.js',
  './js/core/supabase-client.js',
  './js/vistas/dashboard.js',
  './js/vistas/registro-diario.js',
  './js/vistas/asistencia.js',
  './js/vistas/academico.js',
  './js/vistas/familias.js',
  './js/vistas/pagos.js',
  './js/vistas/calificaciones.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Precacheando aplicación para modo offline...');
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[SW] Algunos recursos estáticos no pudieron precachearse:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // No interceptar peticiones de Google Apps Script o APIs externas para evitar respuestas obsoletas
  if (url.hostname.includes('script.google.com') || url.hostname.includes('googleusercontent.com')) {
    return;
  }

  // Estrategia Stale-While-Revalidate para recursos estáticos del sitio
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Fallback offline para navegación principal
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });

      return cachedResponse || fetchPromise;
    })
  );
});
