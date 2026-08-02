const APP_VERSION = '__APP_VERSION__';
const CACHE_NAME = `blackboard-text-shell-${APP_VERSION}`;
// The build replaces this placeholder with the files it actually copied into
// dist/pwa, so a new page or module can never be left out of the offline
// shell by hand. See scripts/build.mjs.
const APP_SHELL = ['__APP_SHELL__'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  // Do not call skipWaiting here. An update is activated only after the UI has
  // offered an explicit reload and the editor has flushed its pending save.
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames
      .filter(cacheName => cacheName.startsWith('blackboard-text-shell-') && cacheName !== CACHE_NAME)
      .map(cacheName => caches.delete(cacheName)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;

    try {
      const response = await fetch(event.request);
      if (response.ok && response.type === 'basic') {
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, response.clone());
      }
      return response;
    } catch (error) {
      if (event.request.mode === 'navigate') {
        return (await caches.match('./editor.html')) || Response.error();
      }
      return Response.error();
    }
  })());
});
