const APP_VERSION = '__APP_VERSION__';
const CACHE_PREFIX = `blackboard-text-shell-${encodeURIComponent(self.registration.scope)}:`;
const CACHE_NAME = `${CACHE_PREFIX}${APP_VERSION}`;
// The build replaces this placeholder with the files it actually copied into
// dist/pwa, so a new page or module can never be left out of the offline
// shell by hand. See scripts/build.mjs.
const APP_SHELL = ['__APP_SHELL__'];

self.addEventListener('install', event => {
  // cache: 'reload' skips the HTTP cache. GitHub Pages lets browsers keep files
  // for ten minutes, which could otherwise put the previous version's files
  // into this version's cache.
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL.map(url => new Request(url, { cache: 'reload' })))));
  // Do not call skipWaiting here. An update is activated only after the UI has
  // offered an explicit reload and the editor has flushed its pending save.
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames
      .filter(cacheName => cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME)
      .map(cacheName => caches.delete(cacheName)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || event.request.cache === 'no-store') return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  const navigate = event.request.mode === 'navigate';
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Pages read their query (read.html?s=…, editor.html?app) in the browser,
    // so one cached copy of each page serves every query.
    const cached = await cache.match(event.request, { ignoreSearch: navigate });
    if (cached) return cached;

    try {
      const response = await fetch(event.request);
      // Only plain URLs are added; caching each shared-link address separately
      // would grow the cache without bound.
      if (response.ok && response.type === 'basic' && !requestUrl.search) {
        cache.put(event.request, response.clone());
      }
      return response;
    } catch (error) {
      if (navigate) {
        const directoryIndex = requestUrl.pathname.endsWith('/')
          ? await cache.match(new URL('index.html', requestUrl).href)
          : null;
        return directoryIndex || (await cache.match('./editor.html')) || Response.error();
      }
      return Response.error();
    }
  })());
});
