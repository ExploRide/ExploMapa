const CACHE_NAME = 'explomapa-ui-fix-2026-05-25-v1';
const TILE_CACHE = 'explomapa-tiles-ui-fix-2026-05-25-v1';

const APP_SHELL = [
  '/ExploMapa/',
  '/ExploMapa/index.html',
  '/ExploMapa/style.css',
  '/ExploMapa/offline-uploads.js',
  '/ExploMapa/firestore-setup.js',
  '/ExploMapa/leaflet-tilelayer-wmts.js',
  '/ExploMapa/manifest.json',
  '/ExploMapa/fav1080.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css',
  'https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.js',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js',
  'https://cdn.jsdelivr.net/npm/twemoji@14.0.2/dist/twemoji.min.js',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-storage.js'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(APP_SHELL.map(async (asset) => {
      try { await cache.add(asset); } catch (e) { console.warn('[SW] cache miss', asset, e); }
    }));
  })());
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => ![CACHE_NAME, TILE_CACHE].includes(k)).map(k => caches.delete(k)));
    await clients.claim();
  })());
});

function isTileRequest(url) {
  return url.hostname.includes('tile') || url.pathname.includes('/tile/') || url.pathname.includes('/tiles/');
}

function isFirestoreOrAuth(url) {
  return url.hostname.includes('firestore') || url.hostname.includes('googleapis.com') || url.hostname.includes('firebase') || url.pathname.includes('/auth');
}


self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (isFirestoreOrAuth(url)) {
    event.respondWith(fetch(request));
    return;
  }

  if (isTileRequest(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(TILE_CACHE);
      const cached = await cache.match(request);
      const networkPromise = fetch(request).then(res => {
        cache.put(request, res.clone());
        return res;
      }).catch(() => cached);
      return cached || networkPromise;
    })());
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      return cached || fetch(request);
    })());
  }
});
