/**
 * ============================================================
 *  NTIC BIBLE PROJECTOR — SERVICE WORKER
 *  Version : 1.0.0  |  Cache : bible-projector-v3
 *  Stratégie : Cache-First → Network Fallback → Offline Page
 *  Mise à jour US-06 : CACHE_VERSION 'v2' → 'v3'
 * ============================================================
 */

// ── Configuration ──────────────────────────────────────────
const CACHE_VERSION = 'v3'; // US-06 : onglet Favoris
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
  './style.css',
  './offline.html',
  './projection.html',
  './manifest.json',
  './assets/icons/icon-192x192.png',
  './assets/icons/icon-512x512.png',
  './assets/icons/favicon.ico',
  './assets/icons/apple-touch-icon.png',
];

/** Page de fallback HTML pour les navigations hors ligne. */
const NAVIGATE_FALLBACK = './offline.html';


// ── INSTALL ─────────────────────────────────────────────────
/**
 * Phase d'installation : on pré-cache tous les assets critiques.
 * skipWaiting() force l'activation immédiate sans attendre
 * que les onglets existants soient fermés.
 */
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
/**
 * Phase d'activation : nettoyage des anciens caches.
 * Tout cache dont le nom ≠ CACHE_NAME est supprimé automatiquement,
 * ce qui gère les mises à jour de version sans code supplémentaire.
 */
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
/**
 * Stratégie : Cache-First avec Network Fallback.
 *
 * Flux :
 *   1. Cherche la réponse dans le cache.
 *   2. Si trouvée → retourne depuis le cache (rapide, offline).
 *   3. Si non trouvée → tente le réseau.
 *   4. Si réseau réussit → met en cache la nouvelle réponse.
 *   5. Si réseau échoue + navigation HTML → sert offline.html.
 *   6. Si réseau échoue + autre asset → laisse le navigateur gérer.
 *
 * NOTE : Seules les requêtes GET sont interceptées.
 *        Les POST (API, formulaires) passent directement en réseau.
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // On n'intercepte que les GET
  if (request.method !== 'GET') return;

  // On n'intercepte pas les extensions de navigateur ou non-HTTP
  if (!request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        // ✅ Cache hit : réponse instantanée
        if (cachedResponse) return cachedResponse;

        // Cache miss → tenter le réseau
        return fetch(request)
          .then((networkResponse) => {
            // Mettre en cache uniquement les réponses valides et "basic"
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

            // Fallback HTML offline pour les navigations
            if (request.destination === 'document') {
              return caches.match(NAVIGATE_FALLBACK);
            }
            // Pour les autres assets, on retourne undefined (erreur normale)
            return undefined;
          });
      })
  );
});


// ── MESSAGE ──────────────────────────────────────────────────
/**
 * Gestion des messages envoyés par app.js.
 * Permet à l'app de demander un skipWaiting explicite lors d'une mise à jour
 * (ex: bouton "Mettre à jour" dans le toast PWA).
 */
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    console.warn('[SW] Message SKIP_WAITING reçu → activation forcée');
    self.skipWaiting();
  }
});
