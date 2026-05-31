const BUILD_VERSION = new URL(self.location.href).searchParams.get('v') || Date.now().toString();
const CACHE_NAME = `exploride-${BUILD_VERSION}`;
const TILE_CACHE = `explomapa-tiles-${BUILD_VERSION}`;
const RUNTIME_CACHE = `explomapa-runtime-${BUILD_VERSION}`;

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
      try {
        await cache.add(asset);
      } catch (e) {
        console.warn('[SW] cache miss', asset, e);
      }
    }));
  })());
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(k => ![CACHE_NAME, TILE_CACHE, RUNTIME_CACHE].includes(k))
        .map(k => caches.delete(k))
    );
    await clients.claim();
  })());
});

function isTileRequest(url) {
  return url.hostname.includes('tile') || url.pathname.includes('/tile/') || url.pathname.includes('/tiles/');
}

function isArchiveImageryRequest(url) {
  return (
    url.hostname === 'wayback.maptiles.arcgis.com' ||
    (url.hostname === 'mapy.geoportal.gov.pl' && url.pathname.includes('/PZGIK/ORTO/WMS/') && url.pathname.includes('ResolutionTime'))
  );
}

function isFirestoreOrAuth(url) {
  return url.hostname.includes('firestore') || url.hostname.includes('googleapis.com') || url.hostname.includes('firebase') || url.pathname.includes('/auth');
}

function isNavigationRequest(request) {
  return request.mode === 'navigate';
}

function isIndexRequest(url) {
  return url.pathname === '/ExploMapa/' || url.pathname === '/ExploMapa/index.html';
}

function isStaticCacheFirstAsset(request, url) {
  const destination = request.destination;
  return (
    destination === 'image' ||
    destination === 'font' ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.webp')
  );
}

function isCssOrJs(request, url) {
  const destination = request.destination;
  return (
    destination === 'style' ||
    destination === 'script' ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js')
  );
}

async function networkFirstForNavigation(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(request);
    cache.put(request, fresh.clone());
    return fresh;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    return cache.match('/ExploMapa/index.html');
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const fresh = await fetch(request);
  cache.put(request, fresh.clone());
  return fresh;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then(response => {
      cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);

  return cached || networkPromise;
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

  if (isFirestoreOrAuth(url) || isArchiveImageryRequest(url)) {
    event.respondWith(fetch(request));
    return;
  }

  if (isNavigationRequest(request) || isIndexRequest(url)) {
    event.respondWith(networkFirstForNavigation(request));
    return;
  }

  if (isTileRequest(url)) {
    event.respondWith(cacheFirst(request, TILE_CACHE));
    return;
  }

  if (isCssOrJs(request, url)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (isStaticCacheFirstAsset(request, url)) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
