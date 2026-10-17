// Offline shell: a dropped hall Wi-Fi never white-screens a game. Pages are network-first, static files cache-first,
// /api is never cached (answers are retried by the page itself).
const V = 'expo-v2'
const SHELL = ['/', '/play.html', '/game.html', '/result.html', '/join.html', '/css/app.css', '/js/app.js', '/js/game.js', '/js/result.js',
  '/fonts/cairo-arabic-900-normal.woff2', '/fonts/ibm-plex-sans-arabic-arabic-600-normal.woff2', '/fonts/ibm-plex-sans-arabic-arabic-700-normal.woff2',
  '/fonts/inter-latin-800-normal.woff2', '/assets/brand/logo_ksau.png', '/assets/brand/cyber_mark_keyed.png', '/assets/brand/logo_baseerah.png']
self.addEventListener('install', (e) => e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())))
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())))
const PAGE = { '/play': '/play.html', '/join': '/join.html' }
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return
  if (e.request.mode === 'navigate') {
    const shell = PAGE[url.pathname] || (url.pathname.startsWith('/play/') ? '/game.html' : url.pathname.startsWith('/result/') ? '/result.html' : null)
    e.respondWith(fetch(e.request).then((r) => { if (r.ok && shell) caches.open(V).then((c) => c.put(shell, r.clone())); return r })
      .catch(() => caches.match(shell || url.pathname).then((r) => r || caches.match('/'))))
    return
  }
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => {
    if (r.ok && /\.(css|js|woff2|png|jpg)$/.test(url.pathname)) { const copy = r.clone(); caches.open(V).then((c) => c.put(e.request, copy)) }
    return r
  })))
})
