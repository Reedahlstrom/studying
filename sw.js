/* Learn Things Good service worker — offline-first app shell. */
const VERSION = 'ledger-v9';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './curriculum.js',
  './passages.js',
  './math.js',
  './planner.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => Promise.allSettled(ASSETS.map((a) => c.add(a))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  // GitHub Pages serves assets with a 10-minute max-age, so a plain fetch() can
  // be answered from the browser's HTTP cache — and then we'd cache that stale
  // copy too. `no-cache` forces a revalidation with the server (cheap 304 when
  // nothing changed), so a deploy is visible on the next load rather than in
  // ten minutes' time.
  const revalidating = new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' });

  // Navigations: network first, fall back to the cached shell when offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(revalidating)
        .then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put('./index.html', copy)); return res; })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // Assets: network first too — a cache-first app shell serves yesterday's CSS/JS
  // for a whole extra load. Cache is the offline fallback, refreshed on every hit.
  e.respondWith(
    fetch(revalidating)
      .then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; })
      .catch(() => caches.match(req))
  );
});
