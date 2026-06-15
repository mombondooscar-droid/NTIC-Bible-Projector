/**
 * ============================================================
 *  projection-shared.js — Utilitaires partagés (fenêtres de projection)
 *  NTIC Bible Projector · Demande #5 — Éclatement projection.html
 *  Scope global (pas de module) — chargé après constants.js dans
 *  chaque fichier projection-*.html
 *
 *  ⚠ AUTONOME : ce fichier ne doit dépendre d'AUCUN autre fichier
 *  de l'application (app.js, panels/, store.js, db.js…).
 *  Il ne dépend QUE de constants.js (pour BC_MESSAGE_VERSION).
 * ============================================================
 */

// ─────────────────────────────────────────────────────────────
//  ÉCHAPPEMENT HTML (copie autonome de utils/dom.js::esc)
// ─────────────────────────────────────────────────────────────
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─────────────────────────────────────────────────────────────
//  CANAL DE PROJECTION (BroadcastChannel + fallback localStorage)
//  Variante autonome de utils/dom.js::createProjectionChannel,
//  sans dépendance à showToast() ni à App.
// ─────────────────────────────────────────────────────────────

/** Clé localStorage utilisée pour le fallback (un préfixe par canal). */
const PROJ_BC_FALLBACK_PREFIX = 'ntic_proj_fallback_';

/**
 * Crée un canal de communication compatible BroadcastChannel,
 * avec repli sur localStorage si BroadcastChannel n'est pas supporté
 * (anciens navigateurs / certains contextes WebView).
 *
 * @param {string} channelName  Nom du canal (ex: PROJECTION_CHANNELS.LT)
 * @returns {Object} Objet canal avec .postMessage() et .onmessage
 */
function createProjectionChannel(channelName) {
  // Support natif
  if (typeof BroadcastChannel !== 'undefined') {
    return new BroadcastChannel(channelName);
  }

  // Fallback localStorage
  console.warn(`[ProjectionChannel:${channelName}] BroadcastChannel non supporté → fallback localStorage`);

  const storageKey = PROJ_BC_FALLBACK_PREFIX + channelName;
  let messageHandler = null;
  let storageListener = null;

  const fallbackChannel = {
    postMessage(msg) {
      try {
        const fullMsg = { ...msg, _ts: Date.now() };
        localStorage.setItem(storageKey, JSON.stringify(fullMsg));
      } catch (e) {
        console.warn(`[ProjectionChannel:${channelName}] postMessage error`, e);
      }
    },

    set onmessage(fn) {
      if (storageListener) {
        window.removeEventListener('storage', storageListener);
      }
      messageHandler = fn;
      if (!fn) return;

      storageListener = (e) => {
        if (e.key !== storageKey || !e.newValue) return;
        try {
          const rawMsg = JSON.parse(e.newValue);
          if (messageHandler) messageHandler({ data: rawMsg });
        } catch (err) {
          console.warn(`[ProjectionChannel:${channelName}] Erreur parsing message`, err);
        }
      };
      window.addEventListener('storage', storageListener);
    },

    addEventListener(type, listener) {
      if (type === 'message') this.onmessage = listener;
    },
    removeEventListener(type, listener) {
      if (type === 'message') this.onmessage = null;
    },

    close() {
      if (storageListener) window.removeEventListener('storage', storageListener);
    },
  };

  return fallbackChannel;
}

// ─────────────────────────────────────────────────────────────
//  VÉRIFICATION DE VERSION DES MESSAGES
// ─────────────────────────────────────────────────────────────
/**
 * Vérifie qu'un message reçu correspond à la version BC attendue.
 * @param {*} msg
 * @returns {boolean} true si le message est valide et utilisable
 */
function isValidProjectionMessage(msg) {
  if (!msg) return false;
  if (msg.version !== BC_MESSAGE_VERSION) {
    console.warn('[Projection] Message ignoré : version', msg.version, '(attendu', BC_MESSAGE_VERSION, ')');
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────
//  MASQUAGE GÉNÉRIQUE DES MODES
// ─────────────────────────────────────────────────────────────
/**
 * Bascule l'attribut .active sur les conteneurs `.proj-mode` /
 * éléments d'overlay d'une fenêtre de projection.
 *
 * @param {string[]} modeIds   Liste des ids de conteneurs de mode
 * @param {string|null} activeId  Id du mode à activer (null = tout masquer)
 */
function showProjectionMode(modeIds, activeId) {
  modeIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', id === activeId);
  });
}

/** Masque tous les overlays d'une fenêtre (retour à l'écran vide/transparent). */
function hideAllProjectionModes(modeIds) {
  showProjectionMode(modeIds, null);
}

// ─────────────────────────────────────────────────────────────
//  ANIMATIONS LOWER THIRD (in / out)
// ─────────────────────────────────────────────────────────────
/**
 * Déclenche une animation d'entrée ou de sortie sur un wrapper LT,
 * en relançant l'animation CSS même si la classe est déjà présente.
 * @param {HTMLElement|null} wrapper
 * @param {'in'|'out'} direction
 */
function triggerProjectionAnim(wrapper, direction) {
  if (!wrapper) return;
  const addCls    = direction === 'in' ? 'anim-in'  : 'anim-out';
  const removeCls = direction === 'in' ? 'anim-out' : 'anim-in';
  wrapper.classList.remove(removeCls);
  void wrapper.offsetWidth; // reflow forcé pour rejouer l'animation
  wrapper.classList.add(addCls);
}

// ─────────────────────────────────────────────────────────────
//  NAVIGATION PAR SEGMENTS (points)
// ─────────────────────────────────────────────────────────────
/**
 * Affiche des points de navigation pour les segments (verset long, strophes…).
 * @param {string} navId        Id du conteneur des points
 * @param {Array}  segments      Tableau (longueur = nombre de points)
 * @param {number} activeIndex   Index du point actif
 */
function renderProjectionSegNav(navId, segments, activeIndex) {
  const nav = document.getElementById(navId);
  if (!nav) return;
  nav.innerHTML = '';
  if (!segments || segments.length <= 1) return;
  segments.forEach((_, i) => {
    const dot = document.createElement('span');
    dot.className = 'seg-dot' + (i === activeIndex ? ' active' : '');
    nav.appendChild(dot);
  });
}

// ─────────────────────────────────────────────────────────────
//  SURLIGNAGE (US-20) — version générique réutilisable
// ─────────────────────────────────────────────────────────────
/**
 * Surligne les occurrences de `selectedText` dans l'élément ciblé.
 * Échappement XSS strict — aucun input utilisateur brut dans innerHTML.
 *
 * @param {HTMLElement|null} el      Élément texte cible
 * @param {string} selectedText      Texte sélectionné à surligner
 * @param {string} color             Couleur de surbrillance (#hex)
 */
function highlightProjectionText(el, selectedText, color) {
  if (!el || !selectedText) return;

  // 1. Récupérer le texte brut (sans marks existants)
  const plainText = el.innerText || el.textContent || '';

  // 2. Encoder HTML le texte brut (protection XSS)
  const htmlEncoded = plainText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

  // 3. Remplacer les occurrences par des <mark>
  const escaped = selectedText
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const safeColor = (color || '#FFD700').replace(/[^#a-zA-Z0-9]/g, '');
  const re = new RegExp(`(${escaped})`, 'gi');

  el.innerHTML = htmlEncoded.replace(
    re,
    `<mark style="background:${safeColor};color:#000;border-radius:3px;padding:0 2px;">$1</mark>`,
  );
}

console.warn('[ProjectionShared] Utilitaires chargés ✓');
