const CACHE_STATIC = 'lautpintar-static-v4';
const CACHE_TILES = 'lautpintar-tiles-v3';
const CACHE_API = 'lautpintar-api-v3';
const MAX_TILE_CACHE_ENTRIES = 200;

const STATIC_ASSETS = [
  '/', '/manifest.json',
  '/static/css/variables.css', '/static/css/reset.css', '/static/css/main.css',
  '/static/js/api.js', '/static/js/map.js', '/static/js/ui.js', '/static/js/main.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_STATIC).then(cache => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_STATIC && k !== CACHE_TILES && k !== CACHE_API).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

async function trimTileCache(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_TILE_CACHE_ENTRIES) return;
  await Promise.all(keys.slice(0, keys.length - MAX_TILE_CACHE_ENTRIES).map(key => cache.delete(key)));
}

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (url.pathname.includes('/prediction/tile/')) {
    event.respondWith(
      caches.open(CACHE_TILES).then(cache => cache.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) event.waitUntil(cache.put(event.request, response.clone()).then(() => trimTileCache(cache)));
          return response;
        }).catch(() => cached || new Response('', { status: 503 }));
      }))
    );
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request.clone()).then(response => {
        if (response.ok && event.request.method === 'GET') {
          const cloned = response.clone();
          caches.open(CACHE_API).then(cache => cache.put(event.request, cloned)).catch(() => {});
        }
        return response;
      }).catch(() => caches.open(CACHE_API).then(cache => cache.match(event.request)))
    );
    return;
  }

  if (url.hostname.includes('tile.openstreetmap.org')) {
    event.respondWith(
      caches.open(CACHE_TILES).then(cache => cache.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) event.waitUntil(cache.put(event.request, response.clone()).then(() => trimTileCache(cache)));
          return response;
        });
      }))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
