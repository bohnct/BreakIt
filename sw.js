// Offline cache. Add new files to FILES; bump VERSION to drop old caches.
const VERSION = 'v2';
const CACHE = `games-${VERSION}`;
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/games.js',
  'js/playtimer.js',
  'js/settings.js',
  'js/stats.js',
  'js/storage.js',
  'js/theme.js',
  'js/ui.js',
  'games/blocks/index.js',
  'games/blocks/board.js',
  'games/blocks/engine.js',
  'games/blocks/stats.js',
  'games/pans/index.js',
  'games/pans/board.js',
  'games/pans/generator.js',
  'games/pans/solver.js',
  'games/pans/stats.js',
  'games/pans/worker.js',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('games-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()));
});

// Network first so updates show up straight away; cached copy when offline.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
