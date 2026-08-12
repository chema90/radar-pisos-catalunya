const CACHE = 'radar-pisos-v8-multicapa';
const APP_SHELL = ['./', './data/municipalities.json', './data/interest-zones.json', './data/known-zones.json', './data/municipality-zones/girona.geojson', './data/municipality-zones/barcelona.geojson', './sql-wasm.wasm'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request).then(response => {
  if (event.request.method === 'GET' && new URL(event.request.url).origin === location.origin) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
  return response;
}).catch(() => hit))));
