/**
 * ============================================================
 *  projection-shared.js — Utilitaires partagés (fenêtres de projection)
 *  NTIC Bible Projector · Version simplifiée (WebSocket only)
 *  Scope global (pas de module) — chargé après constants.js
 * ============================================================
 */

// ─────────────────────────────────────────────────────────────
//  ÉCHAPPEMENT HTML (copie autonome)
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
// ─────────────────────────────────────────────────────────────
const PROJ_BC_FALLBACK_PREFIX = 'ntic_proj_fallback_';

function createProjectionChannel(channelName) {
  if (typeof BroadcastChannel !== 'undefined') {
    return new BroadcastChannel(channelName);
  }

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
function showProjectionMode(modeIds, activeId) {
  modeIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', id === activeId);
  });
}

function hideAllProjectionModes(modeIds) {
  showProjectionMode(modeIds, null);
}

// ─────────────────────────────────────────────────────────────
//  ANIMATIONS LOWER THIRD
// ─────────────────────────────────────────────────────────────
function triggerProjectionAnim(wrapper, direction) {
  if (!wrapper) return;
  const addCls    = direction === 'in' ? 'anim-in'  : 'anim-out';
  const removeCls = direction === 'in' ? 'anim-out' : 'anim-in';
  wrapper.classList.remove(removeCls);
  void wrapper.offsetWidth;
  wrapper.classList.add(addCls);
}

// ─────────────────────────────────────────────────────────────
//  NAVIGATION PAR SEGMENTS
// ─────────────────────────────────────────────────────────────
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
//  CLIENT RELAY (WebSocket uniquement)
//  Les fenêtres de projection utilisent WebSocket pour recevoir
//  les messages depuis le serveur. Plus de SSE/Polling.
// ─────────────────────────────────────────────────────────────

function initRelayClient(onMessage) {
  if (typeof location === 'undefined') return null;
  if (!location.protocol.startsWith('http')) return null;

  // On utilise directement WebSocket
  const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProtocol}//${location.host}`;
  
  let ws = null;
  let active = true;
  let reconnectTimer = null;
  
  function connect() {
    if (!active) return;
    try {
      ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('[Relay] WebSocket connecté');
        // S'abonner aux topics selon le canal de la fenêtre
        // Le topic est détecté à partir de l'URL de la fenêtre
        let topic = 'default';
        if (location.pathname.includes('projection-bible')) topic = 'bible';
        else if (location.pathname.includes('projection-chant')) topic = 'chant';
        else if (location.pathname.includes('projection-lt')) topic = 'lt';
        else if (location.pathname.includes('projection-timer')) topic = 'timer';
        
        if (topic !== 'default') {
          ws.send(JSON.stringify({ type: 'subscribe', topic }));
          console.log(`[Relay] Abonné au topic : ${topic}`);
        }
      };
      
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (isValidProjectionMessage(msg)) {
            onMessage(msg);
          }
        } catch (err) {
          console.warn('[Relay] Erreur parsing message', err);
        }
      };
      
      ws.onclose = () => {
        console.warn('[Relay] WebSocket fermé, tentative de reconnexion...');
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
          if (active) connect();
        }, 3000);
      };
      
      ws.onerror = (err) => {
        console.warn('[Relay] Erreur WebSocket', err);
      };
    } catch (err) {
      console.warn('[Relay] Échec connexion WebSocket', err);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => {
        if (active) connect();
      }, 3000);
    }
  }
  
  connect();
  
  return {
    close() {
      active = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        try { ws.close(); } catch(e) {}
        ws = null;
      }
    }
  };
}

console.warn('[ProjectionShared] Utilitaires chargés ✓');