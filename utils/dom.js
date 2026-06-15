/**
 * ============================================================
 *  utils/dom.js — Utilitaires DOM / UI
 *  NTIC Bible Projector · Extrait de app.js (refactoring SP-13)
 *  + Demande #5 : routage multi‑canal dans safePostMessage
 *  + Demande #6 : routage show-dual-verse vers canal bible
 *  + Correction fallback : clé localStorage unique par canal (Sprint 21)
 *  Scope global (pas de module) — chargé avant app.js
 * ============================================================
 */

// ─────────────────────────────────────────────────────────────
//  ÉCHAPPEMENT HTML
// ─────────────────────────────────────────────────────────────
/** Échappe les caractères HTML dangereux. */
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─────────────────────────────────────────────────────────────
//  DEBOUNCE
// ─────────────────────────────────────────────────────────────
/** Retourne une fonction « debounced » (retardée). */
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ─────────────────────────────────────────────────────────────
//  FORMAT DATE
// ─────────────────────────────────────────────────────────────
/** Formate un timestamp en date courte (fr-FR). */
function fmtDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

// ─────────────────────────────────────────────────────────────
//  TOAST (notification légère, non-bloquante)
// ─────────────────────────────────────────────────────────────
function showToast(msg, type = 'info', duration) {
  document.getElementById('_toast')?.remove();

  // Si aucune durée n'est passée, utiliser le paramètre utilisateur (via App.settings) ou 2400 par défaut
  let finalDuration = duration;
  if (finalDuration === undefined) {
    finalDuration = (typeof App !== 'undefined' && App?.settings?.toastDuration) ? App.settings.toastDuration : 2400;
  }

  const el = document.createElement('div');
  el.id        = '_toast';
  el.className = `app-toast app-toast--${type}`;
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.textContent = msg;
  document.body.appendChild(el);

  requestAnimationFrame(() => el.classList.add('app-toast--visible'));

  setTimeout(() => {
    el.classList.remove('app-toast--visible');
    setTimeout(() => el.remove(), 300);
  }, finalDuration);
}

// ─────────────────────────────────────────────────────────────
//  BROADCAST CHANNEL — CANAL DE PROJECTION AVEC FALLBACK (US-38)
// ─────────────────────────────────────────────────────────────

/**
 * Crée un canal de communication compatible BroadcastChannel ou fallback localStorage.
 * @param {string} channelName - Nom du canal (utilisé pour la clé de stockage en fallback)
 * @param {boolean} showToastWarning - Afficher un avertissement si fallback activé (défaut true)
 * @returns {Object} Objet canal avec méthode postMessage et propriété onmessage
 */
function createProjectionChannel(channelName, showToastWarning = true) {
  // Support natif
  if (typeof BroadcastChannel !== 'undefined') {
    return new BroadcastChannel(channelName);
  }

  // Fallback localStorage avec une clé unique par canal
  const storageKey = 'ntic_proj_fallback_' + channelName;

  console.warn(`[ProjectionChannel:${channelName}] BroadcastChannel non supporté → fallback localStorage (clé: ${storageKey})`);
  if (showToastWarning && typeof showToast === 'function') {
    // Affiche un toast unique pour l'application principale (pas pour la fenêtre de projection)
    if (!window._fallbackShown) {
      window._fallbackShown = true;
      showToast('⚠ Mode communication simplifié (localStorage). Aucune perte de fonctionnalité, mais légère latence.', 'warning', 5000);
    }
  }

  let messageHandler = null;
  let storageListener = null;

  const fallbackChannel = {
    postMessage(msg) {
      try {
        const fullMsg = { ...msg, _ts: Date.now() };
        localStorage.setItem(storageKey, JSON.stringify(fullMsg));
      } catch (e) {
        console.warn(`[FallbackChannel:${channelName}] postMessage error`, e);
      }
    },

    set onmessage(fn) {
      // Nettoyer l'ancien écouteur
      if (storageListener) {
        window.removeEventListener('storage', storageListener);
      }
      messageHandler = fn;
      if (!fn) return;

      storageListener = (e) => {
        if (e.key !== storageKey || !e.newValue) return;
        try {
          const rawMsg = JSON.parse(e.newValue);
          // Vérification de version (la version est ajoutée par safePostMessage)
          if (rawMsg.version !== undefined && rawMsg.version !== BC_MESSAGE_VERSION) {
            console.warn(`[FallbackChannel:${channelName}] Message ignoré : version incompatible`, rawMsg.version);
            return;
          }
          // Supprimer immédiatement pour éviter les traitements en double
          localStorage.removeItem(storageKey);
          if (messageHandler) {
            messageHandler({ data: rawMsg });
          }
        } catch (err) {
          console.warn(`[FallbackChannel:${channelName}] Erreur parsing message`, err);
        }
      };
      window.addEventListener('storage', storageListener);
    },

    // Méthodes optionnelles pour compatibilité EventTarget
    addEventListener(type, listener) {
      if (type === 'message') this.onmessage = listener;
    },
    removeEventListener(type, listener) {
      if (type === 'message' && messageHandler === listener) this.onmessage = null;
    },

    close() {
      if (storageListener) window.removeEventListener('storage', storageListener);
    }
  };

  return fallbackChannel;
}

// ============================================================
//  ROUTAGE MULTI-CANAL POUR safePostMessage (Demande #5)
// ============================================================

/**
 * Table de routage des messages BroadcastChannel.
 * Chaque type peut cibler un ou plusieurs canaux.
 */
const PROJ_ROUTE_MAP = {
  'show-verse':        ['bible', 'ltVerset'],
  'show-lower-third':  ['ltVerset'],
  'verse:segment':     ['bible', 'ltVerset'],
  'highlight:words':   ['bible', 'ltVerset'],
  'highlight:clear':   ['bible', 'ltVerset'],
  'show-slide':        ['bible'],
  'slide-settings':    ['bible'],
  'show-song':         ['chant'],
  'song-settings':     ['chant'],
  'song-next-strophe': ['chant'],
  'song-prev-strophe': ['chant'],
  'show-person':       ['ltPersonne'],
  'hide-lower-third':  ['ltVerset', 'ltPersonne'],
  // Demande #6 : Dual verset / version
  'show-dual-verse':   ['bible'],
};

/**
 * Envoie un message sur le(s) canal(aux) de projection approprié(s).
 * @param {Object} msg - message sans version (version ajoutée automatiquement)
 */
function safePostMessage(msg) {
  try {
    const versionedMsg = { ...msg, version: BC_MESSAGE_VERSION };
    const channels = window.projChannels;
    if (!channels) {
      console.warn('[safePostMessage] projChannels non disponible');
      return;
    }

    const types = PROJ_ROUTE_MAP[msg.type];
    if (types) {
      types.forEach(type => {
        const ch = channels[type];
        if (ch && typeof ch.postMessage === 'function') {
          ch.postMessage(versionedMsg);
        } else {
          console.warn(`[safePostMessage] Canal "${type}" non trouvé`);
        }
      });
    } else {
      // Type inconnu → diffusion sur tous les canaux (forward-compat)
      Object.values(channels).forEach(ch => {
        if (ch && typeof ch.postMessage === 'function') ch.postMessage(versionedMsg);
      });
    }
  } catch (e) {
    console.warn('[BroadcastChannel] Échec envoi message', e);
  }
}

// ─────────────────────────────────────────────────────────────
//  OVERLAY DE CHARGEMENT (US-01)
// ─────────────────────────────────────────────────────────────
function hideLoadingOverlay() {
  const overlay = document.getElementById('sw-loading-overlay');
  if (!overlay) return;
  overlay.style.transition = 'opacity 0.5s ease';
  overlay.style.opacity    = '0';
  setTimeout(() => overlay.remove(), 500);
}