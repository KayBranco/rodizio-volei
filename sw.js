/* sw.js — deixa o app funcionar sem internet. Estratégia: rede primeiro (sempre pega a versão nova), cache como reserva. */
const CACHE = 'rodizio-v4';
const FILES = ['./', 'index.html', 'tutorial.html', 'styles.css', 'engine.js', 'data.js', 'ui.js', 'court.js', 'teams.js', 'match.js', 'stats.js', 'app.js', 'icon.svg', 'manifest.webmanifest'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
