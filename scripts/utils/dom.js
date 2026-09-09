/**
 * utils/dom.js — Utilitaires DOM / UI
 * NTIC Bible Projector · Extrait de app.js (refactoring SP-13)
 * + Demande #5 : routage multi‑canal dans safePostMessage
 * + Cahier des charges "Modes bilingue et explicatif" : routage
 *   show-dual-bilingual / show-dual-explanatory / hide-dual vers
 *   le canal bible (remplace l'ancien show-dual-verse)
 * + Correction fallback : clé localStorage unique par canal (Sprint 21)
 * + US-T04 : routage des messages du module Timer vers le canal timer
 * + UX : badge de mode actif dans la barre live
 * + US-REL-05 : Suppression des messages fantômes (timer-create/update/delete)
 * ============================================================
 */

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function fmtDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function showToast(msg, type = 'info', duration) {
  document.getElementById('_toast')?.remove();
  const finalDuration = duration !== undefined ? duration : 2400;
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

function createProjectionChannel(channelName, showToastWarning = true) {
  if (typeof BroadcastChannel !== 'undefined') {
    return new BroadcastChannel(channelName);
  }
  const storageKey = 'ntic_proj_fallback_' + channelName;
  console.warn(`[ProjectionChannel:${channelName}] BroadcastChannel non supporté → fallback localStorage (clé: ${storageKey})`);
  if (showToastWarning && typeof showToast === 'function') {
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
      if (storageListener) {
        window.removeEventListener('storage', storageListener);
      }
      messageHandler = fn;
      if (!fn) return;
      storageListener = (e) => {
        if (e.key !== storageKey || !e.newValue) return;
        try {
          const rawMsg = JSON.parse(e.newValue);
          if (rawMsg.version !== undefined && rawMsg.version !== BC_MESSAGE_VERSION) {
            console.warn(`[FallbackChannel:${channelName}] Message ignoré : version incompatible`, rawMsg.version);
            return;
          }
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

/**
 * Envoie un message unifié pour les Lower Third (LT).
 * @param {'verse'|'person'} subtype - Type de LT
 * @param {Object} data - Données spécifiques au subtype
 */
function sendLT(subtype, data) {
  const msg = {
    type: 'show-lt',
    subtype: subtype,
    data: data,
  };
  safePostMessage(msg);
  console.debug('[sendLT]', subtype, data);
}

// Source unique de routage pour les messages de projection.
// Utilisée à la fois par safePostMessage (émission locale) et handleIncomingWSMessage (réception réseau).
// US-REL-05 : suppression des messages fantômes timer-create/update/delete.
const PROJ_ROUTE_MAP = {
  'show-verse':            ['bible', 'ltVerset'],
  'show-lower-third':      ['ltVerset'],
  'verse:segment':         ['bible', 'ltVerset'],
  'show-slide':            ['bible'],
  'slide-settings':        ['bible'],
  'show-song':             ['chant'],
  'song-settings':         ['chant'],
  'song-next-strophe':     ['chant'],
  'song-prev-strophe':     ['chant'],
  'show-person':           ['ltPersonne'],
  'show-lt':               ['ltVerset', 'ltPersonne'],
  'hide-lower-third':      ['ltVerset', 'ltPersonne'],
  'show-dual-bilingual':   ['bible', 'ltVerset'],
  'show-dual-explanatory': ['bible', 'ltVerset'],
  'hide-dual':             ['bible'],
  'show-timer-state':      ['timer'],
  'timer-tick':            ['timer'],
  'timer-hide-chrono':     ['timer'],
};

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
      Object.values(channels).forEach(ch => {
        if (ch && typeof ch.postMessage === 'function') ch.postMessage(versionedMsg);
      });
    }
    _updateLiveStatusBar(msg);
  } catch (e) {
    console.warn('[BroadcastChannel] Échec envoi message', e);
  }
}

function _updateLiveStatusBar(msg) {
  const bar      = document.getElementById('live-status-bar');
  const label    = document.getElementById('live-status-label');
  const content  = document.getElementById('live-status-content');
  if (!bar) return;

  const _set = (cls, labelText, contentText) => {
    bar.className            = 'live-status-bar ' + cls;
    if (label)    label.textContent   = labelText;
    if (content)  content.textContent = contentText;
  };

  switch (msg.type) {
    case 'show-verse':
      _set('live-status--bible', 'EN DIRECT', msg.data?.reference || '');
      break;
    case 'verse:segment':
      _set('live-status--bible', 'EN DIRECT', msg.reference || '');
      break;
    case 'show-slide':
      _set('live-status--bible', 'Diapositive', msg.data?.reference || '');
      break;
    case 'show-dual-bilingual':
      _set('live-status--bible', 'Bilingue', msg.data?.primary?.ref || '');
      break;
    case 'show-dual-explanatory':
      _set('live-status--bible', 'Explicatif', msg.data?.primary?.ref || '');
      break;
    case 'show-song':
      _set('live-status--song', 'EN DIRECT', msg.data?.title || '');
      break;
    case 'show-person':
      _set('live-status--person', 'EN DIRECT', msg.data?.nom || '');
      break;
    case 'show-lower-third':
      _set('live-status--bible', 'Lower Third', msg.data?.reference || '');
      break;
    case 'hide-lower-third':
    case 'hide-dual':
      _set('live-status--blank', 'Écran vide', '');
      break;
    default:
      break;
  }
}

function hideLoadingOverlay() {
  const overlay = document.getElementById('sw-loading-overlay');
  if (!overlay) return;
  overlay.style.transition = 'opacity 0.5s ease';
  overlay.style.opacity    = '0';
  setTimeout(() => overlay.remove(), 500);
}