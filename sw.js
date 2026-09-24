const CACHE_VERSION = 'newenko-v14';
// Mosaicos de mapa (red externa): caché aparte y acotada para no
// mezclar tiles con el shell precacheado ni crecer sin límite
// (spec UX §18-19). Sobrevive a actualizaciones de la app.
const TILES_CACHE = 'newenko-tiles-v1';
const TILES_MAX = 150;

const isTileRequest = (hostname) =>
  hostname === 'server.arcgisonline.com' ||
  hostname === 'tile.openstreetmap.org' ||
  hostname.endsWith('.tile.openstreetmap.org');
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './styles/tokens.css',
  './styles/main.css',
  './styles/responsive.css',
  './src/app.js',
  './src/router.js',
  './src/managers/RouteManager.js',
  './src/managers/NavigationManager.js',
  './src/managers/ProgressManager.js',
  './src/managers/StationManager.js',
  './src/managers/OfflineManager.js',
  './src/managers/SafetyManager.js',
  './src/managers/WeatherManager.js',
  './src/components/MapView.js',
  './src/components/MapScreen.js',
  './src/components/NavigationView.js',
  './src/components/WelcomeView.js',
  './src/components/LoadingScreen.js',
  './src/components/SafetyChecklistView.js',
  './src/components/PortalEntranceView.js',
  './src/components/ElevationProfile.js',
  './src/components/GpsBanner.js',
  './src/components/ProgressCard.js',
  './src/components/NavigationControls.js',
  './src/components/TopAppBar.js',
  './src/components/BottomNavBar.js',
  './src/components/StationOverlay.js',
  './src/components/QrScannerModal.js',
  './src/components/CumbreView.js',
  './src/components/FinalizacionView.js',
  './src/demo/DemoController.js',
  './src/utils/geo.js',
  './src/utils/storage.js',
  './src/utils/format.js',
  './src/utils/loader.js',
  './src/utils/elevation.js',
  './src/utils/gpx.js',
  './src/utils/toast.js',
  './data/route.geojson',
  './data/stations.json',
  './data/trail.json',
  './data/safety.json',
  './assets/vendor/jsqr.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-192-maskable.png',
  './assets/icons/icon-512-maskable.png',
  './assets/icons/apple-touch-icon.png',
  './assets/logo/isologo-newenko.png',
  './assets/logo/isotipo-newenko.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// Fotos referenciadas por la app (heroes, galería y fichas). Se cachean en un
// paso aparte: una foto faltante nunca debe impedir cachear el shell.
const APP_PHOTOS = [
  './assets/images/panoramica-valle.jpg',
  './assets/images/pasarela-tablas-madera.jpg',
  './assets/images/cascada-cortina.jpg',
  './assets/images/cascada-principal.jpg',
  './assets/images/sendero-talud-raices.jpg',
  './assets/images/pasamanos-coigues.jpg',
  './assets/images/sendero-musgo-helechos.jpg'
];

// Descarta los mosaicos más viejos al superar el límite de la caché.
function trimCache(cache, max) {
  return cache.keys().then((keys) => {
    if (keys.length <= max) return undefined;
    const excess = keys.slice(0, keys.length - max);
    return Promise.all(excess.map((k) => cache.delete(k)));
  });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL).catch(() => {})
        .then(() => cache.addAll(APP_PHOTOS).catch(() => {})))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(
        keys
          .filter((k) => k !== CACHE_VERSION && k !== TILES_CACHE)
          .map((k) => caches.delete(k))
      ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match('./index.html').then((cached) => cached || Response.error()))
    );
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy)).catch(() => {});
            }
            return response;
          })
      )
    );
    return;
  }

  // Mosaicos de mapa (OSM / Esri): cache-first en su propia caché acotada.
  if (isTileRequest(url.hostname)) {
    event.respondWith(
      caches.open(TILES_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((response) => {
            const cacheable = response && (response.ok || response.type === 'opaque');
            if (cacheable) {
              const copy = response.clone();
              cache
                .put(request, copy)
                .then(() => trimCache(cache, TILES_MAX))
                .catch(() => {});
            }
            return response;
          });
        })
      )
    );
    return;
  }

  // Otras cruzadas (p. ej. CDN): cache-first solo con respuestas válidas.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response && (response.ok || response.type === 'opaque')) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
    )
  );
});