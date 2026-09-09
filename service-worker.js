// service-worker.js (version mise à jour)
/**
 * ============================================================
 *  NAGAD BIBLE — SERVICE WORKER
 *  Version : 1.0.0  |  Cache : nagad-bible-v38
 *  Stratégie : Cache-First → Network Fallback → Offline Page
 * ============================================================
 */

// ── Configuration ──────────────────────────────────────────
const CACHE_VERSION = 'v38';
const CACHE_NAME    = `nagad-bible-${CACHE_VERSION}`;

const URLS_TO_CACHE = [
  './',
  './index.html',
  './app.js',
  './db.js',
  './constants.js',
  './store.js',
  './offline.html',
  './projection-bible.html',
  './projection-chant.html',

  './projection-timer.html',
  './projection-shared.js',
  './manifest.json',
  './styles/base.css',
  './styles/components.css',
  './styles/panels.css',
  './styles/responsive.css',
  './scripts/utils/dom.js',
  './scripts/utils/dataService.js',
  './scripts/utils/bibleHelpers.js',
  './scripts/utils/songHelpers.js',
  './scripts/utils/bibleNavigation.js',
  './scripts/utils/bibleProjection.js',
  './scripts/utils/timerManager.js',
  './scripts/panels/bible/bibleSearch.js',
  './scripts/panels/bible/bibleDisplayModes.js',
  './scripts/panels/bible/biblePanel.js',
  './scripts/panels/songs/songsList.js',
  './scripts/panels/songs/songsEditor.js',
  './scripts/panels/songs/songsPanel.js',
  './scripts/panels/favoritesModal.js',
  './scripts/panels/timer/timerList.js',
  './scripts/panels/timer/timerForm.js',
  './scripts/panels/timer/timerControls.js',
  './scripts/panels/timerPanel.js',
  './scripts/panels/lowerthird/ltPreview.js',

  './scripts/panels/lowerthird/ltPersons.js',
  './scripts/panels/lowerThirdPanel.js',
  './scripts/panels/settingsPanel.js',
  './scripts/utils/wsClient.js',
  './styles/animations.css',

];

const NAVIGATE_FALLBACK = './offline.html';

// ── INSTALL ─────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.warn('[SW] INSTALL — Mise en cache des assets critiques…');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.warn(`[SW] Cache ouvert : ${CACHE_NAME}`);
        return cache.addAll(URLS_TO_CACHE);
      })
      .then(() => {
        console.warn('[SW] Assets mis en cache avec succès ✓');
        return self.skipWaiting();
      })
      .catch((err) => {
        console.error('[SW] Échec de la mise en cache au INSTALL :', err);
      })
  );
});

// ── ACTIVATE ────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.warn('[SW] ACTIVATE — Nettoyage des anciens caches…');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.warn(`[SW] Suppression ancien cache : ${name}`);
              return caches.delete(name);
            })
        )
      )
      .then(() => {
        console.warn('[SW] Activation terminée. Clients repris ✓');
        return self.clients.claim();
      })
      .catch((err) => {
        console.error('[SW] Erreur lors de l\'activation :', err);
      })
  );
});

// ── FETCH ────────────────────────────────────────────────────
const NO_CACHE_PATHS = ['/relay', '/status', '/api/'];

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;
  if (!request.url.startsWith('http')) return;

  try {
    const url = new URL(request.url);
    if (NO_CACHE_PATHS.some(p => url.pathname.startsWith(p))) return;
  } catch(e) { return; }

  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;

        return fetch(request)
          .then((networkResponse) => {
            if (
              networkResponse &&
              networkResponse.status === 200 &&
              networkResponse.type === 'basic'
            ) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return networkResponse;
          })
          .catch((fetchError) => {
            console.warn('[SW] Fetch échoué pour :', request.url, fetchError);

            if (request.destination === 'document') {
              return caches.match(NAVIGATE_FALLBACK);
            }
            return undefined;
          });
      })
  );
});

// ── MESSAGE ──────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    console.warn('[SW] Message SKIP_WAITING reçu → activation forcée');
    self.skipWaiting();
  }
});