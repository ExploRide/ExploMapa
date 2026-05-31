const CACHE_NAME = 'explomapa-v1';
const RUNTIME_CACHE = 'runtime-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/style.css',
  '/manifest.webmanifest',
  '/firestore-setup.js',
  '/offline-uploads.js'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    await Promise.all(
      APP_SHELL.map(async asset => {
        try {
          await cache.add(asset);
        } catch (error) {
          console.warn(`[SW] Failed to cache asset: ${asset}`, error);
        }
      })
    );
  })());

  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME && k !== RUNTIME_CACHE).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

function isArchiveImageryRequest(url) {
  return (
    url.hostname === 'wayback.maptiles.arcgis.com' ||
    (url.hostname === 'mapy.geoportal.gov.pl' && url.pathname.includes('/PZGIK/ORTO/WMS/') && url.pathname.includes('ResolutionTime'))
  );
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (isArchiveImageryRequest(url)) {
    event.respondWith(fetch(event.request));
    return;
  }
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(event.request).then(resp => resp || fetch(event.request))
    );
    return;
  }
  if (url.hostname.includes('tile') || url.pathname.includes('/tiles/')) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(cache =>
        fetch(event.request).then(res => {
          cache.put(event.request, res.clone());
          return res;
        }).catch(() => cache.match(event.request))
      )
    );
  }
});
