const BUILD_VERSION = new URL(self.location.href).searchParams.get('v') || Date.now().toString();
const CACHE_NAME = `exploride-${BUILD_VERSION}`;
const TILE_CACHE = `explomapa-tiles-${BUILD_VERSION}`;
const RUNTIME_CACHE = `explomapa-runtime-${BUILD_VERSION}`;
const GEOPORTAL_TILE_CACHE = 'explomapa-geoportal-tiles-v1';
const GEOPORTAL_TILE_LIMIT = 160;
let geoportalCacheWrites = Promise.resolve();
const tileCacheStats = {
  startedAt: new Date().toISOString(),
  build: BUILD_VERSION,
  xyz: { hits: 0, network: 0, errors: 0 },
  geoportal: { hits: 0, network: 0, errors: 0, uncachedFallbacks: 0, writes: 0, evictions: 0 }
};

const APP_SHELL = [
  '/ExploMapa/',
  '/ExploMapa/index.html',
  '/ExploMapa/style.css',
  '/ExploMapa/offline-uploads.js',
  '/ExploMapa/pin-import.js',
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
        .filter(k => ![CACHE_NAME, TILE_CACHE, RUNTIME_CACHE, GEOPORTAL_TILE_CACHE].includes(k))
        .map(k => caches.delete(k))
    );
    await clients.claim();
  })());
});

function isTileRequest(url) {
  return url.hostname.includes('tile') || url.pathname.includes('/tile/') || url.pathname.includes('/tiles/');
}

function isGeoportalTile(request, url) {
  if (request.destination !== 'image' || url.hostname !== 'mapy.geoportal.gov.pl' ||
      !url.pathname.startsWith('/wss/service/PZGIK/')) return false;
  const query = new URLSearchParams(url.search.toLowerCase());
  const service = query.get('service');
  const operation = query.get('request');
  return (service === 'wms' && operation === 'getmap') ||
    (service === 'wmts' && operation === 'gettile');
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
  const stats = cacheName === TILE_CACHE ? tileCacheStats.xyz : null;
  if (cached) {
    if (stats) stats.hits++;
    return cached;
  }

  if (stats) stats.network++;
  try {
    const fresh = await fetch(request);
    if (stats && !fresh.ok && fresh.type !== 'opaque') stats.errors++;
    cache.put(request, fresh.clone());
    return fresh;
  } catch (error) {
    if (stats) stats.errors++;
    throw error;
  }
}

async function loadGeoportalTile(request) {
  let cache;
  try {
    cache = await caches.open(GEOPORTAL_TILE_CACHE);
    const cached = await cache.match(request);
    if (cached) {
      tileCacheStats.geoportal.hits++;
      return { response: cached };
    }
  } catch (error) {
    console.warn('[SW] Geoportal cache unavailable', error);
  }

  let response;
  tileCacheStats.geoportal.network++;
  try {
    // A readable response lets us reject errors and XML replies before caching.
    response = await fetch(request, { mode: 'cors', credentials: 'omit' });
  } catch (error) {
    if (request.signal.aborted) throw error;
    tileCacheStats.geoportal.uncachedFallbacks++;
    try {
      return { response: await fetch(request) };
    } catch (fallbackError) {
      if (!request.signal.aborted) tileCacheStats.geoportal.errors++;
      throw fallbackError;
    }
  }

  const contentType = response.headers.get('content-type') || '';
  const cacheControl = response.headers.get('cache-control') || '';
  if (!response.ok || !contentType.startsWith('image/')) tileCacheStats.geoportal.errors++;
  if (!cache || !response.ok || !contentType.startsWith('image/') ||
      /\b(no-store|no-cache|private)\b/i.test(cacheControl)) return { response };

  const copy = response.clone();
  geoportalCacheWrites = geoportalCacheWrites.then(async () => {
    await cache.put(request, copy);
    tileCacheStats.geoportal.writes++;
    const keys = await cache.keys();
    for (const key of keys.slice(0, Math.max(0, keys.length - GEOPORTAL_TILE_LIMIT))) {
      if (await cache.delete(key)) tileCacheStats.geoportal.evictions++;
    }
  }).catch(error => console.warn('[SW] Geoportal tile cache write failed', error));

  return { response, stored: geoportalCacheWrites };
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
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'GET_MAP_TILE_DEBUG_STATS') {
    event.source?.postMessage({ type: 'MAP_TILE_DEBUG_STATS', stats: tileCacheStats });
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

  if (isGeoportalTile(request, url)) {
    const result = loadGeoportalTile(request);
    event.respondWith(result.then(({ response }) => response));
    event.waitUntil(result.then(({ stored }) => stored).catch(() => {}));
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
