const APP_VERSION = '__APP_VERSION__';
const CACHE_NAME = `blackboard-text-shell-${APP_VERSION}`;
const APP_SHELL = [
  './',
  './index.html',
  './editor.html',
  './editor.css',
  './editor.js',
  './privacy.html',
  './site.webmanifest',
  './icons/icon-48.png',
  './icons/icon-128.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './fonts/InterVariable.woff2',
  './fonts/InterTight-Variable.ttf',
  './src/core/backup.js',
  './src/core/legacy-chrome.js',
  './src/core/schema.js',
  './src/core/workspace-lock.js',
  './src/core/workspace-store.js',
  './src/ui/app-status.js',
  './src/ui/pwa-updates.js'
];

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
