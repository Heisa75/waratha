// Waratha service worker
// Bump CACHE_VERSION whenever index.html or other assets change.
const CACHE_VERSION = 'waratha-v7-2026-10-19';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_VERSION).then(cache => cache.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// The app shell is the root or index.html; any other page on this origin
// (an older build left in place, an error page) must not overwrite it.
function isShell(url) {
  try {
    const p = new URL(url).pathname;
    return p.endsWith('/') || p.endsWith('/index.html');
  } catch (e) { return false; }
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Pages: network first so content fixes reach users; cached copy when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          // Only a healthy response for the app shell itself may become the
          // offline copy. Without this an error page, a captive-portal login
          // page, or another page served from this origin replaces the app.
          if (res.ok && isShell(req.url)) {
            const copy = res.clone();
            event.waitUntil(
              caches.open(CACHE_VERSION).then(c => c.put('./index.html', copy)).catch(() => {})
            );
          }
          return res;
        })
        .catch(() => caches.match('./index.html')
          .then(hit => hit || caches.match('./'))
          .then(hit => hit || new Response(
            '<!doctype html><meta charset="utf-8"><title>Offline</title>' +
            '<p style="font:16px system-ui;padding:24px">Offline — reopen once you have a connection.</p>',
            { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } })))
    );
    return;
  }

  // Everything else (icons, fonts): cache first, then network, and keep a copy.
  // Opaque responses are deliberately not cached: their status is always 0, so
  // a captive portal's reply is indistinguishable from the real file and would
  // be served from the cache for good.
  event.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) {
        const copy = res.clone();
        event.waitUntil(
          caches.open(CACHE_VERSION).then(c => c.put(req, copy)).catch(() => {})
        );
      }
      return res;
    }).catch(() => caches.match(req).then(h => h || Response.error())))
  );
});
