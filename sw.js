/**
 * Service Worker — Neuro-Kinetic Web Hub
 * Abilita il funzionamento offline tramite Cache API.
 * Strategia: Cache First con fallback alla rete.
 */

const CACHE_NAME = 'nk-hub-v4';

// Risorse da mettere in cache per il funzionamento offline
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icon.svg',
];

// ── INSTALLAZIONE: pre-caching delle risorse principali ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Pre-caching risorse statiche...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  // Forziamo l'attivazione immediata senza attendere che le
  // schede esistenti vengano chiuse
  self.skipWaiting();
});

// ── ATTIVAZIONE: pulizia cache vecchie ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── FETCH: strategia Cache First ──
// Serve dalla cache se disponibile, altrimenti va in rete
self.addEventListener('fetch', event => {
  // Non intercettiamo le richieste ai CDN esterni (TF.js, Chart.js)
  // per evitare problemi di CORS e versionamento
  if (event.request.url.includes('cdn.jsdelivr.net') ||
      event.request.url.includes('fonts.googleapis.com') ||
      event.request.url.includes('fonts.gstatic.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // Se la risorsa è in cache, la restituiamo direttamente
      if (cachedResponse) {
        return cachedResponse;
      }
      // Altrimenti facciamo la richiesta alla rete
      return fetch(event.request).then(networkResponse => {
        // Mettiamo in cache anche le nuove risorse scaricate
        if (networkResponse && networkResponse.status === 200) {
          const cloned = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
        }
        return networkResponse;
      });
    })
  );
});
