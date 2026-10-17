// Offline cache. Add new files to FILES; bump VERSION to drop old caches.
const VERSION = 'v27';
const CACHE = `breakit-${VERSION}`;
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/autosave.js',
  'js/colours.js',
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
  'games/blocks/worker.js',
  'games/mahjong/index.js',
  'games/mahjong/board.js',
  'games/mahjong/engine.js',
  'games/mahjong/stats.js',
  'games/loop/index.js',
  'games/loop/board.js',
  'games/loop/engine.js',
  'games/loop/stats.js',
  'games/loop/worker.js',
  'games/garlic/index.js',
  'games/garlic/board.js',
  'games/garlic/engine.js',
  'games/garlic/stats.js',
  'games/solitaire/index.js',
  'games/solitaire/board.js',
  'games/solitaire/engine.js',
  'games/solitaire/stats.js',
  'games/solitaire/worker.js',
  'js/previews.js',
  'games/hola/index.js',
  'games/hola/board.js',
  'games/hola/engine.js',
  'games/hola/stats.js',
  'games/pans/index.js',
  'games/pans/board.js',
  'games/pans/generator.js',
  'games/pans/solver.js',
  'games/pans/stats.js',
  'games/pans/worker.js',
  'icons/favicon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

// Install fresh copies straight from the server, never from the browser's HTTP cache, so one
// version's files are never mixed with another's.
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => (k.startsWith('games-') || k.startsWith('breakin-') || k.startsWith('breakit-')) && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()));
});

// Network first so updates show up straight away; cached copy when offline. 'no-cache' makes the
// browser check with the server every time instead of reusing a copy GitHub Pages said was good
// for 10 minutes. Without it a phone could get new scripts with an old stylesheet.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  const fresh = e.request.mode === 'navigate'
    ? fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' })
    : fetch(e.request, { cache: 'no-cache' });
  e.respondWith(
    fresh.then(res => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
