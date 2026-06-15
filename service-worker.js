/**
 * ============================================================
 *  NTIC BIBLE PROJECTOR — SERVICE WORKER
 *  Version : 1.0.0  |  Cache : bible-projector-v19
 *  Stratégie : Cache-First → Network Fallback → Offline Page
 *  Mise à jour US-R15 Sprint R4 : ajout de panels/settingsBinders.js
 * ============================================================
 */

// ── Configuration ──────────────────────────────────────────
const CACHE_VERSION = 'v19'; // incrémenté US-R15 Sprint R4
const CACHE_NAME    = `bible-projector-${CACHE_VERSION}`;

/**
 * Assets critiques mis en cache au moment de l'INSTALL.
 * Chemins relatifs au scope du service worker (racine du projet).
 */
const URLS_TO_CACHE = [
  './',
  './index.html',
  './app.js',
  './db.js',
  './constants.js',
  './store.js',
  './style.css',
  './offline.html',
  './projection.html',
  // ── Demande #5 : fenêtres de projection dédiées ─────────
  './projection-bible.html',
  './projection-chant.html',
  './projection-lt.html',            // @deprecated — conservé pour rétro-compat
  // ── Demande #XX : éclatement projection-lt → 2 fenêtres ─
  './projection-lt-verset.html',
  './projection-lt-personne.html',
  './projection-shared.js',
  './manifest.json',
  // ── US-R10 : feuilles de style modulaires ──────────────
  './styles/base.css',
  './styles/components.css',
  './styles/panels.css',
  './styles/responsive.css',
  // ── Utils ──────────────────────────────────────────────
  './utils/dom.js',
  './utils/bibleHelpers.js',
  './utils/songHelpers.js',
  './utils/bibleNavigation.js',
  './utils/bibleProjection.js',
  // ── Panels ─────────────────────────────────────────────
  './panels/bibleSearch.js',
  './panels/bibleDual.js',
  './panels/biblePanel.js',
  './panels/songsPanel.js',
  './panels/favoritesPanel.js',
  './panels/lowerThirdPanel.js',
  './panels/settingsBinders.js',    // NOUVEAU US-R15
  './panels/settingsPanel.js',
  // ── Icons ──────────────────────────────────────────────
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/favicon.ico',
];

/** Page de fallback HTML pour les navigations hors ligne. */
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
self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;
  if (!request.url.startsWith('http')) return;

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