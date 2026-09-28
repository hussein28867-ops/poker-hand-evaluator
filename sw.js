/*
 * Service worker: makes the app work offline.
 * When you change any file, bump CACHE_VERSION so phones pick up the new version.
 */
const CACHE_VERSION = 'v1';
const CACHE_NAME = 'poker-hand-evaluator-' + CACHE_VERSION;
const ASSETS = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'evaluator.js',
  'manifest.json',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Serve from cache instantly, refresh the cache in the background (stale-while-revalidate).
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(req, { ignoreSearch: true }).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => (req.mode === 'navigate' ? cache.match('index.html') : undefined));
        return cached || network;
      })
    )
  );
});
