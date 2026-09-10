// app.js (version complète avec modifications pour la fusion LT)
// ... (l'ensemble du fichier app.js est reproduit ci-dessous avec les modifications)
// Pour des raisons de longueur, je fournis le fichier complet.
// Les modifications se situent dans les fonctions openProjectionWindows et showProjectionMenu.

// app.js (version complète avec ajouts PIP, clic direct verset, mode slide, fallback BC,
//         logging global et verrouillage cross‑tabs, + AUDIT ERGO #4, + US-52 Thème Tourpac)
// + Mise à jour Demande #5 : 4 canaux de projection dédiés
// + US-59 : Correction withWriteLock() avec try/finally pour garantir releaseLock()
// + Cahier des charges "Modes bilingue et explicatif" : suppression de l'ancien
//   dualMode / dualConfig ; les nouveaux états sont dans store.js (bilingual / explanatory).
// + US-2.11 : Synchronisation à l'ouverture des fenêtres de projection.
// + US-2.9 : Amélioration navigation clavier (Home, End, Alt+↓/↑).
// + US-T04 : Module Timer — ajout canal timer, fenêtre projection-timer, onglet Timer.
// + Sujet 2 : Client WebSocket pour communication multi‑PC.
// + Sujet 6 extension : Synchronisation automatique des Bibles depuis le serveur.
// + UX : Menu déroulant de projection au lieu d'ouverture massive.
// + US-REL-02 : Alignement des tables de routage (suppression de routeMap redondante).
// + US-REL-03 : Utilisation de resyncCurrentState() dans syncProjectionWindows().
// + US-R10-01 : Fallback IndexedDB + Bandeau Hors-ligne
// + AXE 1 : Gestion des messages sync:full-state et sync:state-update
// + AXE 2 : Découverte automatique du serveur (via /status + WebRTC)
// + AXE 3 : Verrouillage global de la projection (remplacé par verrouillage par ressource)
// + AXE 5 : Fiabilité des reconnexions
// + AUTO‑DISCOVERY : appel à discoverServer() dans init()
// + Étape 1 : Suppression SSE/Polling
// + Étape 4 : Verrouillage par ressource (Bible, Chant, LT, Timer)
// + Étape 5 : Buffer de messages pour reconnexion (sync:replay)

/**
 * ============================================================
 *  NAGAD BIBLE — app.js
 *  Version : 1.0-sp30  |  Sprint : US-13 + Sujet 2 + Sujet 6 + US-R10-01 + AXE-1/2/3/5 + RESOURCE-LOCK + REPLAY
 *  Modifié : Suppression de l'onglet Favoris, remplacement par une modale
 *  Ajout : Gestion des tiroirs latéraux (drawers) avec fermeture améliorée
 *  Ajout : Verrouillage par ressource (Bible, Chant, LT, Timer)
 *  Ajout : Buffer de messages pour reconnexion (sync:replay)
 * ============================================================
 */

// ─────────────────────────────────────────────────────────────
//  ÉTAT GLOBAL
// ─────────────────────────────────────────────────────────────
// App = Store → store.js  |  SETTINGS_KEYS/DEFAULTS → constants.js

// ─────────────────────────────────────────────────────────────
//  CANAUX DE PROJECTION (BroadcastChannel + Fallback US-38)
//  5 fenêtres actives : bible · chant · lt-verset · lt-personne · timer
// ─────────────────────────────────────────────────────────────

/** Canaux actifs (5 fenêtres). */
const projChannels = {
  bible:      createProjectionChannel(PROJECTION_CHANNELS.BIBLE,       false),
  chant:      createProjectionChannel(PROJECTION_CHANNELS.CHANT,       false),
  ltVerset:   createProjectionChannel(PROJECTION_CHANNELS.LT_VERSET,   false),
  ltPersonne: createProjectionChannel(PROJECTION_CHANNELS.LT_PERSONNE, false),
  timer:      createProjectionChannel(PROJECTION_CHANNELS.TIMER,       false),
};

// Rendre accessible globalement pour safePostMessage (dom.js)
window.projChannels = projChannels;

// Canaux @deprecated conservés pour rétro-compatibilité (non utilisés par safePostMessage)
const _legacyProjChannel   = createProjectionChannel(PROJECTION_CHANNELS.LEGACY, true);
const _deprecatedLtChannel = createProjectionChannel(PROJECTION_CHANNELS.LT,    false);

// ─────────────────────────────────────────────────────────────
//  WEBSOCKET CLIENT (Sujet 2) + AXE-1/2/3/5 + RESOURCE LOCK + REPLAY
// ─────────────────────────────────────────────────────────────
let wsClient = null;
let wsReconnectTimer = null;
let wsConnected = false;
let _reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;

// Verrous par ressource (état local)
let _locks = {
  bible: false,
  chant: false,
  lt: false,
  timer: false,
  default: false
};
let _lockHolders = {}; // resource -> sessionId
let _pendingProjection = null;
let _lockRequested = false;

// ─── Déterminer la ressource à partir du type de message ───
function getResourceForMessage(msg) {
  const type = msg.type;
  if (type === 'show-verse' || type === 'show-slide' || type === 'verse:segment' ||
      type === 'show-dual-bilingual' || type === 'show-dual-explanatory' ||
      type === 'hide-dual') {
    return 'bible';
  }
  if (type === 'show-song' || type === 'song-next-strophe' || type === 'song-prev-strophe') {
    return 'chant';
  }
  if (type === 'show-person' || type === 'show-lt' || type === 'hide-lower-third') {
    return 'lt';
  }
  if (type === 'show-timer-state' || type === 'timer-tick' || type === 'timer-hide-chrono') {
    return 'timer';
  }
  return 'default';
}

// ─── Application silencieuse des mises à jour d'état ───
function _applyStateUpdate(msg, options = { silent: false }) {
  const silent = options.silent || false;
  
  if (msg.type === 'sync:state-update') {
    const updates = msg.updates;
    if (updates.lastBibleRef !== undefined) {
      App.lastBibleRef = updates.lastBibleRef;
      App.lastBibleText = updates.lastBibleText || '';
      if (!silent && typeof updateStagingPanel === 'function') {
        updateStagingPanel(App.lastBibleText, App.lastBibleRef);
      }
      if (!silent) {
        const badge = document.getElementById('last-projected-ref');
        if (badge) {
          const textEl = badge.querySelector('.last-ref-text');
          if (textEl) textEl.textContent = App.lastBibleRef;
        }
      }
    }
    if (updates.currentPersonActive) {
      App.currentPersonActive = updates.currentPersonActive;
      App.lastProjectedPersonNom = updates.currentPersonActive.nom || '';
      App.lastProjectedPersonTitre = updates.currentPersonActive.titre || '';
    }
    if (updates.currentSong) {
      App.currentSong = updates.currentSong;
      App.currentStropheIdx = updates.currentStropheIdx || 0;
    }
    if (updates.activeDisplayMode) {
      App.activeDisplayMode = updates.activeDisplayMode;
    }
    if (updates.bilingualSecondVersion !== undefined) {
      App.bilingual.secondVersion = updates.bilingualSecondVersion;
    }
    if (updates.explanatoryRef !== undefined) {
      App.explanatory.reference = updates.explanatoryRef || '';
    }
    if (updates.activeTimers) {
      const tm = getTimerManager();
      tm.timers = updates.activeTimers;
    }
    if (updates.lockedBy !== undefined) {
      if (updates.lockedBy === null) {
        _locks['default'] = false;
        _lockHolders['default'] = null;
        if (!silent) enableProjectionButtons(true);
      } else if (updates.lockedBy === TAB_ID) {
        _locks['default'] = true;
        _lockHolders['default'] = updates.lockedBy;
        if (!silent) enableProjectionButtons(true);
      } else {
        _locks['default'] = false;
        _lockHolders['default'] = updates.lockedBy;
        if (!silent) enableProjectionButtons(false);
      }
    }
  }
  
  if (msg.type === 'show-verse' || msg.type === 'show-slide' || msg.type === 'verse:segment') {
    if (!silent && msg.data && typeof updateStagingPanel === 'function') {
      updateStagingPanel(msg.data.text || msg.segmentText, msg.data.reference || msg.reference);
    }
  }
}

function connectWebSocket() {
  if (wsClient && (wsClient.readyState === WebSocket.OPEN || wsClient.readyState === WebSocket.CONNECTING)) {
    return;
  }

  try {
    const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${location.host}`;
    wsClient = new WebSocket(wsUrl);

    wsClient.onopen = () => {
      wsConnected = true;
      _reconnectAttempts = 0;
      console.log('[Relay] ✅ Connecté au serveur (port 8080)');
      updateRelayIndicator('connected');

      // AXE-2 amélioré : récupérer l'IP réelle depuis le serveur
      fetch('/status')
        .then(r => r.json())
        .then(data => {
          if (data.ips && data.ips.length > 0) {
            const realIp = data.ips.find(ip => !ip.startsWith('127.'));
            if (realIp) {
              const serverUrl = `http://${realIp}:8080`;
              const currentUrl = App.settings.serverUrl || 'http://localhost:8080';
              if (currentUrl !== serverUrl) {
                App.settings.serverUrl = serverUrl;
                db.saveSetting('serverUrl', serverUrl).catch(() => {});
                console.log('[Discovery] URL serveur mise à jour depuis /status :', serverUrl);
                showToast(`🔍 Serveur détecté : ${serverUrl}`, 'info', 3000);
              }
            }
          }
        })
        .catch(() => {});

      // Demander l'état
      if (wsClient.readyState === WebSocket.OPEN) {
        wsClient.send(JSON.stringify({
          type: 'sync:request-state',
          sessionId: TAB_ID,
        }));
      }

      syncProjectionWindows();

      // Synchroniser les Bibles si elles sont absentes
      db.getAllBibleNames().then(names => {
        if (names.length === 0 && App.settings.relayEnabled !== false) {
          refreshBiblesFromServer();
        }
      });
    };

    wsClient.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        
        // Ignorer les messages de version incompatible
        if (msg.type !== 'bible-list-update' && msg.type !== 'sync:full-state' && 
            msg.type !== 'sync:state-update' && msg.type !== 'sync:lock-granted' && 
            msg.type !== 'sync:lock-denied' && msg.type !== 'sync:lock-updated' && 
            msg.type !== 'sync:replay' && msg.version !== BC_MESSAGE_VERSION) {
          console.warn('[WS] Message ignoré : version incompatible', msg.version);
          return;
        }

        // ── Messages de replay (buffer de reconnexion) ──
        if (msg.type === 'sync:replay') {
          console.log('[WS] Replay buffer reçu (', msg.messages?.length || 0, 'messages)');
          if (msg.messages && Array.isArray(msg.messages)) {
            // Traiter les messages replay sans notifications
            for (const replayMsg of msg.messages) {
              _applyStateUpdate(replayMsg, { silent: true });
              handleIncomingWSMessage(replayMsg);
            }
          }
          return;
        }

        // ── Gestion du verrou par ressource ──
        if (msg.type === 'sync:lock-granted') {
          const resource = msg.resource || 'default';
          _locks[resource] = true;
          _lockHolders[resource] = msg.sessionId;
          _lockRequested = false;
          showToast(`🔒 Verrouillage obtenu pour "${resource}"`, 'success', 2000);
          enableProjectionButtons(true);
          if (_pendingProjection) {
            const pending = _pendingProjection;
            _pendingProjection = null;
            setTimeout(() => {
              safePostMessage(pending);
            }, 100);
          }
          return;
        }

        if (msg.type === 'sync:lock-denied') {
          const resource = msg.resource || 'default';
          _locks[resource] = false;
          _lockHolders[resource] = null;
          _lockRequested = false;
          const holder = msg.heldBy || 'un autre opérateur';
          showToast(`🔒 Projection verrouillée sur "${resource}" par ${holder}`, 'warning', 3000);
          enableProjectionButtons(false);
          _pendingProjection = null;
          return;
        }

        if (msg.type === 'sync:lock-updated') {
          const resource = msg.resource || 'default';
          if (msg.heldBy === null) {
            _locks[resource] = false;
            _lockHolders[resource] = null;
            const anyLock = Object.values(_locks).some(v => v === true);
            enableProjectionButtons(!anyLock);
          } else if (msg.heldBy === TAB_ID) {
            _locks[resource] = true;
            _lockHolders[resource] = msg.heldBy;
            enableProjectionButtons(true);
          } else {
            _locks[resource] = false;
            _lockHolders[resource] = msg.heldBy;
            enableProjectionButtons(false);
          }
          return;
        }

        // AXE-1 : Synchronisation d'état complet
        if (msg.type === 'sync:full-state') {
          const state = msg.state;
          if (state) {
            console.log('[WS] Sync full-state reçu');
            App.lastBibleRef = state.lastBibleRef || '';
            App.lastBibleText = state.lastBibleText || '';
            App.currentSegments = state.currentSegments || [];
            App.currentSegmentIndex = state.currentSegmentIndex || 0;
            App.currentSong = state.currentSong || null;
            App.currentStropheIdx = state.currentStropheIdx || 0;
            if (state.currentPersonActive) {
              App.currentPersonActive = state.currentPersonActive;
              App.lastProjectedPersonNom = state.currentPersonActive.nom || '';
              App.lastProjectedPersonTitre = state.currentPersonActive.titre || '';
            }
            App.activeDisplayMode = state.activeDisplayMode || 'normal';
            App.bilingual.secondVersion = state.bilingualSecondVersion || null;
            App.explanatory.reference = state.explanatoryRef || '';
            if (state.activeTimers && state.activeTimers.length > 0) {
              const tm = getTimerManager();
              tm.timers = state.activeTimers;
            }
            if (state.lockedBy) {
              if (state.lockedBy === TAB_ID) {
                _locks['default'] = true;
                _lockHolders['default'] = state.lockedBy;
                enableProjectionButtons(true);
              } else {
                _locks['default'] = false;
                _lockHolders['default'] = state.lockedBy;
                enableProjectionButtons(false);
                showToast(`🔒 Projection contrôlée par ${state.lockedBy.slice(0, 8)}...`, 'info', 3000);
              }
            } else {
              _locks['default'] = false;
              _lockHolders['default'] = null;
              enableProjectionButtons(true);
            }
            renderPanel(App.currentTab);
            syncProjectionWindows();
            if (App.lastBibleRef && App.lastBibleText && typeof updateStagingPanel === 'function') {
              updateStagingPanel(App.lastBibleText, App.lastBibleRef);
            }
            showToast('🔄 État synchronisé avec le serveur', 'info', 3000);
          }
          return;
        }

        // AXE-1 : Mise à jour incrémentale
        if (msg.type === 'sync:state-update') {
          const updates = msg.updates;
          console.log('[WS] Sync state-update reçu:', updates);
          _applyStateUpdate(msg, { silent: false });
          return;
        }

        if (msg.type === 'bible-list-update') {
          console.log('[WS] Liste des Bibles mise à jour :', msg.versions);
          if (msg.versions && Array.isArray(msg.versions)) {
            refreshBiblesFromServer();
          }
          return;
        }

        if (msg._origin === TAB_ID) return;
        handleIncomingWSMessage(msg);
      } catch (e) {
        console.warn('[WS] Erreur parsing message entrant :', e);
      }
    };

    wsClient.onclose = () => {
      wsConnected = false;
      for (let key in _locks) {
        _locks[key] = false;
        _lockHolders[key] = null;
      }
      _reconnectAttempts++;
      if (_reconnectAttempts <= MAX_RECONNECT_ATTEMPTS) {
        console.warn(`[Relay] ⚠️ Connexion perdue — reconnexion (${_reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
        updateRelayIndicator('offline');
        scheduleWSReconnect();
      } else {
        console.warn('[Relay] ⚠️ Nombre maximal de reconnexions atteint');
        updateRelayIndicator('disabled');
        showToast('⚠️ Connexion au serveur perdue. Rechargez la page.', 'error', 5000);
      }
    };

    wsClient.onerror = (err) => {
      console.warn('[WS] Erreur WebSocket:', err);
    };
  } catch (err) {
    console.warn('[WS] Échec de la connexion WebSocket :', err);
    scheduleWSReconnect();
  }
}

function scheduleWSReconnect() {
  if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
  const delay = Math.min(5000 + (_reconnectAttempts * 2000), 30000);
  wsReconnectTimer = setTimeout(() => {
    console.log('[WS] Tentative de reconnexion...');
    connectWebSocket();
  }, delay);
}

function handleIncomingWSMessage(msg) {
  const channels = PROJ_ROUTE_MAP[msg.type];
  if (channels) {
    for (const chName of channels) {
      const ch = projChannels[chName];
      if (ch && typeof ch.postMessage === 'function') {
        ch.postMessage(msg);
      }
    }
  }
}

// ─── AXE-3 : Projection avec verrou (par ressource) ──────────

function enableProjectionButtons(enabled) {
  document.querySelectorAll('.btn-project, .btn-project-verse, .btn-project-song, .btn-project-person, .staging-send-btn')
    .forEach(btn => {
      if (!btn) return;
      btn.disabled = !enabled;
      btn.title = enabled ? 'Projeter' : '🔒 Verrouillé par un autre opérateur';
    });
}

function projectWithLock(msg) {
  if (!wsConnected || App.settings.relayEnabled === false) {
    safePostMessage(msg);
    return;
  }

  const resource = getResourceForMessage(msg);
  const sessionId = TAB_ID;

  if (_locks[resource] && _lockHolders[resource] === sessionId) {
    const versionedMsg = { ...msg, _sessionId: sessionId, resource: resource };
    safePostMessage(versionedMsg);
    wsClient.send(JSON.stringify({
      type: 'sync:request-lock',
      resource: resource,
      sessionId: sessionId,
    }));
    return;
  }

  if (_locks[resource] && _lockHolders[resource] !== sessionId) {
    showToast(`🔒 ${resource} est verrouillé par un autre opérateur`, 'warning', 2000);
    return;
  }

  _pendingProjection = msg;

  if (!_lockRequested) {
    _lockRequested = true;
    wsClient.send(JSON.stringify({
      type: 'sync:request-lock',
      resource: resource,
      sessionId: sessionId,
    }));
    showToast(`🔒 Demande de verrouillage pour "${resource}"...`, 'info', 2000);
  }
}

function releaseLock(resource) {
  if (wsConnected && _locks[resource] && _lockHolders[resource] === TAB_ID) {
    wsClient.send(JSON.stringify({
      type: 'sync:release-lock',
      resource: resource,
      sessionId: TAB_ID,
    }));
    _locks[resource] = false;
    _lockHolders[resource] = null;
    showToast(`🔓 Verrou libéré pour "${resource}"`, 'info', 1500);
  }
}

// ─────────────────────────────────────────────────────────────
//  RELAY — INDICATEUR VISUEL (3 états)
// ─────────────────────────────────────────────────────────────
function updateRelayIndicator(state) {
  const el = document.getElementById('ws-status');
  if (!el) return;
  const STATES = {
    connected: { text: '🟢 Relais actif',      color: 'var(--success)' },
    disabled:  { text: '🔴 Relais désactivé',  color: 'var(--danger)'  },
    offline:   { text: '🟡 Relais hors ligne', color: 'var(--warning)' },
  };
  const s = STATES[state] || STATES.offline;
  el.textContent = s.text;
  el.style.color = s.color;
}

// ─────────────────────────────────────────────────────────────
//  RELAY HTTP — POST vers /relay  (pour OBS / SSE / cross-device)
// ─────────────────────────────────────────────────────────────
async function postToRelay(msg) {
  try {
    await fetch('/relay', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(msg),
    });
  } catch(e) {
    // Silencieux — serveur peut être absent ; le BroadcastChannel local continue
  }
}
window.postToRelay = postToRelay;

// ─────────────────────────────────────────────────────────────
//  SYNCHRONISATION DES BIBLES DEPUIS LE SERVEUR (Sujet 6 + AXE-2)
// ─────────────────────────────────────────────────────────────

async function refreshBiblesFromServer() {
  try {
    const serverUrl = App.settings.serverUrl || 'http://localhost:8080';
    console.log('[Bible] Synchronisation depuis', serverUrl);

    const res = await fetch(`${serverUrl}/api/bible/versions`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    if (!data.versions) return;

    for (const name of data.versions) {
      const bibleRes = await fetch(`${serverUrl}/api/bible/load?name=${encodeURIComponent(name)}`, { signal: AbortSignal.timeout(8000) });
      const bibleData = await bibleRes.json();
      if (typeof bibleData === 'object' && !Array.isArray(bibleData) && Object.keys(bibleData).length > 0) {
        await db.saveBible(name, bibleData);
      } else {
        console.warn(`[Bible] Données invalides pour ${name}, ignorées.`);
      }
    }

    const currentBible = await db.getSetting('currentBible');
    if (currentBible && data.versions.includes(currentBible)) {
      const bibleData = await db.getBible(currentBible);
      if (bibleData) {
        App.bibleData = bibleData;
        if (App.currentTab === 'bible') {
          const booksList = document.getElementById('books-list');
          if (booksList && typeof renderBooksGrid === 'function') {
            renderBooksGrid(Object.keys(bibleData));
          }
        }
      }
    }

    if (typeof loadBibleList === 'function') {
      loadBibleList();
    }

    showToast(`📚 ${data.versions.length} Bible(s) synchronisée(s) depuis le serveur`, 'success', 3000);
  } catch (err) {
    console.warn('[Bible] Échec synchronisation :', err);
    const url = App.settings.serverUrl || 'localhost';
    showToast(`❌ Synchronisation des Bibles échouée (${url}). Vérifiez l'URL du serveur et le pare-feu.`, 'error', 5000);
  }
}

// ─────────────────────────────────────────────────────────────
//  OUVERTURE DES FENÊTRES DE PROJECTION (menu déroulant)
// ─────────────────────────────────────────────────────────────

function openProjectionWindows(which = 'all') {
  const windows = [
    { file: './projection-bible.html',        name: 'projection-bible' },
    { file: './projection-chant.html',        name: 'projection-chant' },
    { file: './projection-lt.html',           name: 'projection-lt' },
    { file: './projection-timer.html',        name: 'projection-timer' },
  ];

  let toOpen = windows;
  if (which !== 'all') {
    const filter = which;
    toOpen = windows.filter(w => w.name === filter);
  }

  toOpen.forEach((win, i) => {
    window.open(win.file, win.name,
      `width=1280,height=720,menubar=no,toolbar=no,location=no,status=no,left=${100 + i * 60},top=${100 + i * 60}`);
  });

  setTimeout(() => {
    syncProjectionWindows();
  }, 300);
}

function showProjectionMenu() {
  const btn = document.getElementById('btn-open-projection');
  if (!btn) return;

  const existing = document.getElementById('proj-menu-dropdown');
  if (existing) { existing.remove(); return; }

  const menu = document.createElement('div');
  menu.id = 'proj-menu-dropdown';
  menu.style.cssText = `
    position: absolute; top: calc(100% + 4px); right: 0;
    background: var(--bg-card); border: 1px solid var(--border-mid);
    border-radius: var(--radius-sm); padding: 6px;
    min-width: 180px; z-index: 200; box-shadow: var(--shadow-card);
    display: flex; flex-direction: column; gap: 4px;
  `;
  const items = [
    { label: '📖 Bible',          key: 'projection-bible' },
    { label: '🎵 Chant',          key: 'projection-chant' },
    { label: '🎯 Lower Third',    key: 'projection-lt' },
    { label: '⏱ Timer',          key: 'projection-timer' },
    { label: '📦 Ouvrir tout',    key: 'all' },
  ];
  items.forEach(item => {
    const opt = document.createElement('button');
    opt.className = 'dropdown-menu-item';
    opt.textContent = item.label;
    opt.style.cssText = 'background:transparent; border:none; padding:8px 12px; text-align:left; cursor:pointer; width:100%; font-family:var(--font-ui); font-size:0.85rem; color:var(--text); border-radius:var(--radius-xs);';
    opt.addEventListener('mouseenter', () => { opt.style.background = 'var(--bg-card-hover)'; });
    opt.addEventListener('mouseleave', () => { opt.style.background = 'transparent'; });
    opt.addEventListener('click', () => {
      openProjectionWindows(item.key);
      menu.remove();
    });
    menu.appendChild(opt);
  });

  const rect = btn.getBoundingClientRect();
  const headerRight = btn.closest('.header-right');
  if (headerRight) {
    headerRight.style.position = 'relative';
    headerRight.appendChild(menu);
  } else {
    document.body.appendChild(menu);
    menu.style.top = (rect.bottom + 4) + 'px';
    menu.style.left = (rect.left + rect.width - 180) + 'px';
  }

  setTimeout(() => {
    document.addEventListener('click', function handler(e) {
      if (!menu.contains(e.target) && e.target !== btn) {
        menu.remove();
        document.removeEventListener('click', handler);
      }
    });
  }, 0);
}

function syncProjectionWindows() {
  if (App.lastBibleRef && App.lastBibleText) {
    if (typeof resyncCurrentState === 'function') {
      resyncCurrentState();
    } else {
      projectVerse(App.lastBibleText, App.lastBibleRef);
    }
  }

  if (App.currentSong && App.currentStropheIdx !== undefined) {
    const strophes = App.currentSong.strophes || [];
    if (strophes.length > 0) {
      const idx = Math.min(App.currentStropheIdx, strophes.length - 1);
      const s = strophes[idx];
      if (s) {
        const title  = App.currentSong.title  || '';
        const author = App.currentSong.author || '';
        const allStrophesTexts = buildAllStrophesTexts(strophes);
        safePostMessage({
          type: 'show-song',
          data: {
            title, author,
            lines:        s.lines        || [],
            translations: s.translations || [],
            strophes:     allStrophesTexts,
            currentIndex: idx,
            showTitle:    App.settings.songShowTitle,
            showAuthor:   App.settings.songShowAuthor,
            settings: {
              bgColor:    App.settings.songBgColor,
              textColor:  App.settings.songTextColor,
              fontFamily: App.settings.songFontFamily,
              fontSize:   App.settings.songFontSize,
              showTitle:  App.settings.songShowTitle,
              showAuthor: App.settings.songShowAuthor,
              uppercase:  App.settings.songUppercase,
              textAlign:  App.settings.songTextAlign,
            },
          },
        });
      }
    }
  }

  if (App.lastProjectedPersonNom) {
    safePostMessage({
      type: 'show-person',
      data: {
        nom:   App.lastProjectedPersonNom,
        titre: App.lastProjectedPersonTitre || '',
        ltType: App.settings.ltType,
        settings: {
          refColor:      App.settings.ltRefColor,
          verseColor:    App.settings.ltVerseColor,
          fontFamily:    App.settings.ltFontFamily,
          width:         App.settings.ltWidth,
          height:        App.settings.ltHeight,
          nameFontSize:  App.settings.personNameSize,
          titleFontSize: App.settings.personTitleSize,
        },
      },
    });
  }
}

// ─────────────────────────────────────────────────────────────
//  UTILITAIRES (déjà définis dans dom.js)
// ─────────────────────────────────────────────────────────────
// esc(), debounce(), fmtDate(), showToast(), createProjectionChannel() sont dans dom.js
// buildVerseRef(), parseVerseRef() → bibleHelpers.js
// buildAllStrophesTexts() → songHelpers.js

// ─────────────────────────────────────────────────────────────
//  VERROUILLAGE CROSS-TABS (Problème #17)
// ─────────────────────────────────────────────────────────────

const TAB_ID = (() => {
  let id = sessionStorage.getItem('ntic_tab_id');
  if (!id) {
    id = Math.random().toString(36).slice(2);
    sessionStorage.setItem('ntic_tab_id', id);
  }
  return id;
})();

const LOCK_KEY = 'ntic_write_lock';
const LOCK_TTL = 3000;

function acquireLock() {
  const existing = localStorage.getItem(LOCK_KEY);
  if (existing) {
    try {
      const lock = JSON.parse(existing);
      if (lock && (Date.now() - lock.ts) < LOCK_TTL && lock.tab !== TAB_ID) {
        return false;
      }
    } catch(e) {}
  }
  localStorage.setItem(LOCK_KEY, JSON.stringify({ tab: TAB_ID, ts: Date.now() }));
  return true;
}

function releaseLock() {
  const current = localStorage.getItem(LOCK_KEY);
  if (current) {
    try {
      const lock = JSON.parse(current);
      if (lock.tab === TAB_ID) {
        localStorage.removeItem(LOCK_KEY);
      }
    } catch(e) {}
  }
}

async function withWriteLock(fn, name = 'Écriture') {
  if (!acquireLock()) {
    db.log('warn', `Lock actif pour ${name}, tentative 1`);
    showToast(`⚠ ${name} : autre onglet actif - nouvelle tentative...`, 'warning', 2000);
    await new Promise(r => setTimeout(r, 500));
    if (!acquireLock()) {
      db.log('warn', `Lock toujours actif pour ${name}, écriture forcée`);
      showToast(`⚠ ${name} : conflit persistant, exécution forcée`, 'warning', 2000);
    }
  }
  try {
    await fn();
  } finally {
    releaseLock();
  }
}

// ─────────────────────────────────────────────────────────────
//  LOGGING SYSTÈME (Problème #18)
// ─────────────────────────────────────────────────────────────

function logEvent(action, details) {
  db.log('info', action, details);
}

window.onerror = function(message, source, lineno, colno, error) {
  db.log('error', `Global error: ${message}`, {
    source, lineno, colno,
    stack: error?.stack
  });
  return false;
};

window.onunhandledrejection = function(event) {
  db.log('error', `Unhandled rejection: ${event.reason}`, {
    reason: event.reason?.toString()
  });
};

window.withWriteLock = withWriteLock;
window.logEvent = logEvent;
window.acquireLock = acquireLock;
window.releaseLock = releaseLock;
window.releaseProjectionLock = function(resource) {
  releaseLock(resource);
};

// ─────────────────────────────────────────────────────────────
//  THÈME VISUEL PILOTÉ PAR ltType (US-52)
// ─────────────────────────────────────────────────────────────

function applyTheme(ltType) {
  const isTourpac = ltType === 'tourpac';
  if (isTourpac) {
    document.documentElement.dataset.theme = 'tourpac';
  } else {
    delete document.documentElement.dataset.theme;
  }
}

window.applyTheme = applyTheme;

// ─────────────────────────────────────────────────────────────
//  SERVICE WORKER (US-01)
// ─────────────────────────────────────────────────────────────

function initServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register('./service-worker.js')
    .then((reg) => {
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing;
        newSW?.addEventListener('statechange', () => {
          if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner();
          }
        });
      });
    })
    .catch((err) => console.error('[SW] Enregistrement échoué :', err));

  window.addEventListener('online',  () => setNetworkStatus(true));
  window.addEventListener('offline', () => setNetworkStatus(false));
  setNetworkStatus(navigator.onLine);
}

function setNetworkStatus(online) {
  const el = document.getElementById('status-indicator');
  if (!el) return;
  el.className   = online ? 'online' : 'offline';
  el.textContent = online ? 'En ligne' : 'Hors ligne';
  el.setAttribute('aria-label', `Statut réseau : ${online ? 'en ligne' : 'hors ligne'}`);
}

function showUpdateBanner() {
  const toast = document.getElementById('update-toast');
  if (!toast) return;
  toast.classList.remove('hidden');

  document.getElementById('btn-update-now')?.addEventListener('click', () => {
    logEvent('Mise à jour PWA', {});
    navigator.serviceWorker.controller?.postMessage({ type: 'SKIP_WAITING' });
    window.location.href = window.location.href;
  }, { once: true });

  document.getElementById('btn-update-dismiss')?.addEventListener('click', () => {
    toast.classList.add('hidden');
  }, { once: true });
}

// ─────────────────────────────────────────────────────────────
//  SKELETON UI (M6)
// ─────────────────────────────────────────────────────────────

function renderSkeleton() {
  return `
    <div class="skeleton-panel">
      <div class="skeleton-header"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-grid">
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
//  ROUTING SPA (US-01)
// ─────────────────────────────────────────────────────────────

function initTabs() {
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.tab));
  });

  if (window.innerWidth <= 768) {
    const existingProjBtn = document.getElementById('btn-open-projection');
    const nav = document.getElementById('main-tabs');
    if (existingProjBtn && nav && !document.getElementById('mobile-proj-tab')) {
      const projTab = document.createElement('button');
      projTab.id = 'mobile-proj-tab';
      projTab.className = 'tab';
      projTab.innerHTML = '<span class="tab-icon">🖥</span><span class="tab-label">Projeter</span>';
      projTab.addEventListener('click', openProjectionWindows);
      nav.appendChild(projTab);
      existingProjBtn.style.display = 'none';
    }
  }

  document.getElementById('btn-open-projection')?.addEventListener('click', showProjectionMenu);

  const params   = new URLSearchParams(location.search);
  const initTab  = params.get('tab') || 'bible';
  navigateTo(initTab, false);
}

function updateDocumentTitle(tab) {
  const titles = {
    bible: 'Bible',
    songs: 'Chants',
    'lower-third': 'Lower Third',
    settings: 'Paramètres',
    timer: 'Temps'
  };
  document.title = `NAGAD Bible — ${titles[tab] || 'Bible'}`;
}

function navigateTo(tab, pushState = true) {
  App.currentTab = tab;

  document.querySelectorAll('.tab').forEach((btn) => {
    const active = btn.dataset.tab === tab;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', String(active));
  });

  if (pushState) {
    const url = new URL(location.href);
    url.searchParams.set('tab', tab);
    history.replaceState({ tab }, '', url.toString());
  }

  updateDocumentTitle(tab);
  renderPanel(tab);
}

async function renderPanel(tab) {
  const main = document.getElementById('app');
  if (!main) return;

  main.innerHTML = renderSkeleton();

  try {
    switch (tab) {
      case 'bible':       await renderBiblePanel(main);       break;
      case 'favorites':   // fallthrough
      default:            await renderBiblePanel(main);
        break;
      case 'songs':       await renderSongsPanel(main);       break;
      case 'lower-third': await renderLowerThirdPanel(main);  break;
      case 'settings':    await renderSettingsPanel(main);    break;
      case 'timer':       await renderTimerPanel(main);       break;
    }
  } catch (err) {
    console.error('[App] Erreur panneau :', err);
    db.log('error', `Erreur rendu panneau ${tab}`, { message: err.message, stack: err.stack });
    main.innerHTML = `<div class="panel-error">
      <span class="panel-error-icon">⚠️</span>
      <p>Erreur : ${esc(err.message)}</p>
      <button class="btn btn-primary" id="reload-panel-btn">⟳ Recharger</button>
    </div>`;
    document.getElementById('reload-panel-btn')?.addEventListener('click', () => renderPanel(tab));
  }
}

// ─────────────────────────────────────────────────────────────
//  US-015 : GESTES TACTILES (swipe horizontal)
// ─────────────────────────────────────────────────────────────

function initSwipeGestures() {
  if (!('ontouchstart' in window)) return;

  let touchStartX = 0;
  let touchStartY = 0;

  document.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    const endX  = e.changedTouches[0].screenX;
    const endY  = e.changedTouches[0].screenY;
    const diffX = touchStartX - endX;
    const diffY = Math.abs(touchStartY - endY);

    if (Math.abs(diffX) < 50 || diffY > Math.abs(diffX) * 0.8) return;

    if (diffX > 0) {
      document.dispatchEvent(new CustomEvent('app:next-segment'));
    } else {
      document.dispatchEvent(new CustomEvent('app:prev-segment'));
    }
  }, { passive: true });
}

// ─────────────────────────────────────────────────────────────
//  US-015 : HAMBURGER MENU (mobile)
// ─────────────────────────────────────────────────────────────

function initHamburger() {
  const hamburger = document.getElementById('btn-hamburger');
  const nav       = document.getElementById('main-tabs');
  const iconSpan  = document.getElementById('hamburger-icon');
  if (!hamburger || !nav || !iconSpan) return;

  hamburger.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('nav-open');
    hamburger.setAttribute('aria-expanded', String(isOpen));
    iconSpan.textContent = isOpen ? '✕' : '☰';
  });

  nav.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      nav.classList.remove('nav-open');
      hamburger.setAttribute('aria-expanded', 'false');
      iconSpan.textContent = '☰';
    });
  });

  document.addEventListener('click', (e) => {
    if (!nav.contains(e.target) && e.target !== hamburger) {
      nav.classList.remove('nav-open');
      hamburger.setAttribute('aria-expanded', 'false');
      iconSpan.textContent = '☰';
    }
  });
}

// ─────────────────────────────────────────────────────────────
//  US-40 : RACCOURCIS CLAVIER GLOBAUX (AMÉLIORÉS)
// ─────────────────────────────────────────────────────────────

function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    const active = document.activeElement;
    if (active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName)) return;

    const tab = App.currentTab;
    switch (e.key) {
      case 'ArrowRight':
        if (tab === 'bible') {
          if (App.currentSegments?.length > 1 &&
              App.currentSegmentIndex < App.currentSegments.length - 1) {
            const nextBtn = document.querySelector('.seg-btn-next');
            if (nextBtn && !nextBtn.disabled) nextBtn.click();
          } else if (typeof window.bibleNextVerse === 'function') {
            window.bibleNextVerse();
          }
        } else if (tab === 'songs') {
          document.dispatchEvent(new CustomEvent('app:next-segment'));
        }
        e.preventDefault();
        break;

      case 'ArrowLeft':
        if (tab === 'bible') {
          if (App.currentSegments?.length > 1 && App.currentSegmentIndex > 0) {
            const prevBtn = document.querySelector('.seg-btn-prev');
            if (prevBtn && !prevBtn.disabled) prevBtn.click();
          } else if (typeof window.biblePrevVerse === 'function') {
            window.biblePrevVerse();
          }
        } else if (tab === 'songs') {
          document.dispatchEvent(new CustomEvent('app:prev-segment'));
        }
        e.preventDefault();
        break;

      case 'ArrowDown':
        if (e.altKey && tab === 'bible') {
          if (App.currentSegments?.length > 1 &&
              App.currentSegmentIndex < App.currentSegments.length - 1) {
            const nextBtn = document.querySelector('.seg-btn-next');
            if (nextBtn && !nextBtn.disabled) nextBtn.click();
          }
          e.preventDefault();
        } else if (tab === 'bible' && !e.altKey) {
          if (typeof window.bibleNextVerse === 'function') window.bibleNextVerse();
          e.preventDefault();
        }
        break;

      case 'ArrowUp':
        if (e.altKey && tab === 'bible') {
          if (App.currentSegments?.length > 1 && App.currentSegmentIndex > 0) {
            const prevBtn = document.querySelector('.seg-btn-prev');
            if (prevBtn && !prevBtn.disabled) prevBtn.click();
          }
          e.preventDefault();
        } else if (tab === 'bible' && !e.altKey) {
          if (typeof window.biblePrevVerse === 'function') window.biblePrevVerse();
          e.preventDefault();
        }
        break;

      case 'Home':
        if (tab === 'bible') {
          const versesList = document.getElementById('verses-list');
          if (versesList) {
            const firstCard = versesList.querySelector('.verse-card');
            if (firstCard) {
              firstCard.click();
              firstCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          }
          e.preventDefault();
        }
        break;

      case 'End':
        if (tab === 'bible') {
          const versesList = document.getElementById('verses-list');
          if (versesList) {
            const cards = versesList.querySelectorAll('.verse-card');
            if (cards.length > 0) {
              const lastCard = cards[cards.length - 1];
              lastCard.click();
              lastCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          }
          e.preventDefault();
        }
        break;

      case ' ':
      case 'Space':
        if (tab === 'bible') {
          const projectBtn = document.getElementById('btn-project-selected-verse');
          if (projectBtn) projectBtn.click();
        } else if (tab === 'songs') {
          const projectBtn = document.getElementById('btn-project-slide');
          if (projectBtn) projectBtn.click();
        }
        e.preventDefault();
        break;

      case 'Escape':
        safePostMessage({ type: 'hide-lower-third' });
        if (App.activeDisplayMode !== 'normal') {
          safePostMessage({ type: 'hide-dual' });
        }
        const favModal = document.getElementById('favorites-modal');
        if (favModal && favModal.getAttribute('aria-hidden') === 'false') {
          closeFavoritesModal();
        }
        document.querySelectorAll('.drawer[aria-hidden="false"]').forEach(d => closeDrawer(d.id));
        e.preventDefault();
        break;

      default:
        break;
    }
  });
}

function initShortcutsModal() {
  const btn = document.getElementById('btn-shortcuts');
  const modal = document.getElementById('shortcuts-modal');
  if (!btn || !modal) return;

  const _focusables = () => Array.from(
    modal.querySelectorAll('button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
  );

  const show = () => {
    modal.classList.add('visible');
    modal.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => _focusables()[0]?.focus());
  };
  const hide = () => {
    modal.classList.remove('visible');
    modal.setAttribute('aria-hidden', 'true');
    btn.focus();
  };

  btn.addEventListener('click', show);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) hide();
  });
  const closeBtn = document.getElementById('close-shortcuts');
  if (closeBtn) closeBtn.addEventListener('click', hide);

  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { hide(); e.preventDefault(); return; }
    if (e.key !== 'Tab') return;
    const foc = _focusables();
    if (!foc.length) { e.preventDefault(); return; }
    const first = foc[0], last = foc[foc.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { last.focus(); e.preventDefault(); }
    } else {
      if (document.activeElement === last) { first.focus(); e.preventDefault(); }
    }
  });
}

function initAboutModal() {
  const btn   = document.getElementById('btn-about');
  const modal = document.getElementById('about-modal');
  if (!btn || !modal) return;

  const _focusables = () => Array.from(
    modal.querySelectorAll('button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
  );

  const show = () => {
    modal.classList.add('visible');
    modal.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => _focusables()[0]?.focus());
  };
  const hide = () => {
    modal.classList.remove('visible');
    modal.setAttribute('aria-hidden', 'true');
    btn.focus();
  };

  btn.addEventListener('click', show);
  modal.addEventListener('click', (e) => { if (e.target === modal) hide(); });
  modal.querySelector('.about-close')?.addEventListener('click', hide);

  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { hide(); e.preventDefault(); return; }
    if (e.key !== 'Tab') return;
    const foc = _focusables();
    if (!foc.length) { e.preventDefault(); return; }
    const first = foc[0], last = foc[foc.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { last.focus(); e.preventDefault(); }
    } else {
      if (document.activeElement === last) { first.focus(); e.preventDefault(); }
    }
  });
}

// ─────────────────────────────────────────────────────────────
//  FAVORIS MODALE : ouverture / fermeture
// ─────────────────────────────────────────────────────────────

function openFavoritesModal() {
  const modal = document.getElementById('favorites-modal');
  if (!modal) return;
  if (modal.getAttribute('aria-hidden') === 'false') {
    closeFavoritesModal();
    return;
  }
  modal.setAttribute('aria-hidden', 'false');
  modal.style.display = 'flex';
  refreshFavoritesModal();
  document.getElementById('fav-search')?.focus();
}

function closeFavoritesModal() {
  const modal = document.getElementById('favorites-modal');
  if (!modal) return;
  modal.setAttribute('aria-hidden', 'true');
  modal.style.display = 'none';
}

window.openFavoritesModal = openFavoritesModal;
window.closeFavoritesModal = closeFavoritesModal;

// ─────────────────────────────────────────────────────────────
//  TIROIRS LATÉRAUX (DRAWERS)
// ─────────────────────────────────────────────────────────────

function openDrawer(drawerId) {
  const otherId = drawerId === 'drawer-bibles' ? 'drawer-network' : 'drawer-bibles';
  const otherDrawer = document.getElementById(otherId);
  if (otherDrawer && otherDrawer.getAttribute('aria-hidden') === 'false') {
    closeDrawer(otherId);
  }

  const drawer = document.getElementById(drawerId);
  if (!drawer) return;
  if (drawer.getAttribute('aria-hidden') === 'false') {
    closeDrawer(drawerId);
    return;
  }
  drawer.setAttribute('aria-hidden', 'false');
  drawer.style.display = 'flex';
  const firstFocusable = drawer.querySelector('button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (firstFocusable) {
    setTimeout(() => firstFocusable.focus(), 100);
  }
  if (drawerId === 'drawer-bibles') {
    refreshDrawerBiblesList();
  }
  if (drawerId === 'drawer-network') {
    refreshDrawerNetworkStatus();
  }
}

function closeDrawer(drawerId) {
  const drawer = document.getElementById(drawerId);
  if (!drawer) return;
  drawer.setAttribute('aria-hidden', 'true');
  drawer.style.display = 'none';
}

window.openDrawer = openDrawer;
window.closeDrawer = closeDrawer;

// ─────────────────────────────────────────────────────────────
//  RAFRAÎCHISSEMENT DES DONNÉES DANS LES TIROIRS
// ─────────────────────────────────────────────────────────────

function refreshDrawerBiblesList() {
  if (typeof loadBibleList === 'function') {
    loadBibleList('drawer-bible-list');
  }
}

function refreshDrawerNetworkStatus() {
  const statusBadge = document.getElementById('drawer-server-mode-status-badge');
  if (statusBadge) {
    statusBadge.textContent = App.settings?.serverMode ? '🟢 Connecté au serveur' : '🔴 Mode local (hors ligne)';
  }
  const connStatus = document.getElementById('drawer-server-connection-status');
  if (connStatus) {
    connStatus.textContent = App.settings?.serverMode ? '✅ Connecté' : '⏳ En attente de connexion...';
  }
  const relayToggle = document.getElementById('drawer-relay-toggle');
  const relayBadge = document.getElementById('drawer-relay-status-badge');
  if (relayToggle && relayBadge) {
    const enabled = App.settings?.relayEnabled !== false;
    relayToggle.checked = enabled;
    relayBadge.textContent = enabled ? '🟢 Activé' : '🔴 Désactivé';
    relayBadge.style.color = enabled ? 'var(--success)' : 'var(--danger)';
  }
}

// ─────────────────────────────────────────────────────────────
//  US-R10-01 : BANDEAU FALLBACK HORS-LIGNE
// ─────────────────────────────────────────────────────────────

let _offlineBanner = null;

function updateOfflineBanner(show) {
  let banner = document.getElementById('offline-banner');
  if (!show) {
    if (banner) {
      banner.remove();
      _offlineBanner = null;
    }
    return;
  }

  if (banner) {
    banner.querySelector('.offline-msg').textContent = '⚠️ Mode Hors-ligne — Données locales uniquement. Synchronisation en attente.';
    return;
  }

  banner = document.createElement('div');
  banner.id = 'offline-banner';
  banner.style.cssText = `
    background: rgba(224, 80, 80, 0.15);
    border-bottom: 1px solid rgba(224, 80, 80, 0.3);
    padding: 8px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
    font-size: 0.85rem;
    color: var(--text);
    backdrop-filter: blur(4px);
    z-index: 100;
    position: sticky;
    top: calc(var(--header-h) + var(--nav-h) + var(--live-bar-h));
  `;

  const msgSpan = document.createElement('span');
  msgSpan.className = 'offline-msg';
  msgSpan.textContent = '⚠️ Mode Hors-ligne — Données locales uniquement. Synchronisation en attente.';

  const btnContainer = document.createElement('div');
  btnContainer.style.display = 'flex';
  btnContainer.style.gap = '8px';

  const syncBtn = document.createElement('button');
  syncBtn.className = 'btn btn-sm btn-primary';
  syncBtn.textContent = '🔄 Synchroniser';
  syncBtn.addEventListener('click', async () => {
    try {
      syncBtn.disabled = true;
      syncBtn.textContent = '⏳ Synchronisation...';
      await dataService.syncAllFromServer();
      if (dataService.getServerHealth()) {
        updateOfflineBanner(false);
      }
      await renderPanel(App.currentTab);
    } catch (err) {
    } finally {
      syncBtn.disabled = false;
      syncBtn.textContent = '🔄 Synchroniser';
    }
  });

  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn btn-sm btn-ghost';
  closeBtn.textContent = '✕';
  closeBtn.style.color = 'var(--text-muted)';
  closeBtn.setAttribute('aria-label', 'Fermer le bandeau');
  closeBtn.addEventListener('click', () => {
    banner.style.display = 'none';
  });

  btnContainer.appendChild(syncBtn);
  btnContainer.appendChild(closeBtn);
  banner.appendChild(msgSpan);
  banner.appendChild(btnContainer);

  const liveBar = document.getElementById('live-status-bar');
  if (liveBar && liveBar.parentNode) {
    liveBar.parentNode.insertBefore(banner, liveBar.nextSibling);
  } else {
    document.body.prepend(banner);
  }

  _offlineBanner = banner;
}

function onServerStatusChanged(event) {
  const healthy = event.detail.healthy;
  if (!healthy && App.settings?.serverMode) {
    updateOfflineBanner(true);
  } else if (healthy) {
    updateOfflineBanner(false);
  }
}

// ─────────────────────────────────────────────────────────────
//  PATCH safePostMessage POUR WEBSOCKET + LOCK (Sujet 2 + AXE 3)
// ─────────────────────────────────────────────────────────────

function patchSafePostMessageForWS() {
  if (typeof window.safePostMessage !== 'function') {
    setTimeout(patchSafePostMessageForWS, 100);
    return;
  }

  const original = window.safePostMessage;

  window.safePostMessage = function(msg) {
    original(msg);

    if (App.settings.relayEnabled === false) return;

    const resource = getResourceForMessage(msg);
    const relayMsg = { ...msg, version: BC_MESSAGE_VERSION, _origin: TAB_ID, resource: resource };

    if (wsConnected && wsClient && wsClient.readyState === WebSocket.OPEN) {
      try {
        wsClient.send(JSON.stringify(relayMsg));
      } catch(e) {
        console.warn('[Relay-WS] Échec envoi :', e);
      }
    }

    postToRelay(relayMsg);
  };
}

// ─── PATCH projectVerse pour utiliser projectWithLock ────────

const originalProjectVerse = window.projectVerse || function() {};
window.projectVerse = function(text, refStr, options = {}) {
  const msg = {
    type: 'show-verse',
    data: {
      reference: refStr,
      text: text,
      style: {
        ltType: App.settings.ltType,
        refColor: App.settings.ltRefColor,
        verseColor: App.settings.ltVerseColor,
        fontFamily: App.settings.ltFontFamily,
        width: App.settings.ltWidth,
        height: App.settings.ltHeight,
        refFontSize: App.settings.ltRefSize,
        verseFontSize: App.settings.ltVerseSize,
      },
    },
  };
  if (wsConnected) {
    projectWithLock(msg);
  } else {
    safePostMessage(msg);
  }
  if (typeof originalProjectVerse === 'function') {
    originalProjectVerse(text, refStr, options);
  }
};

window.safePostMessageWithLock = function(msg) {
  const projectionTypes = ['show-verse', 'show-slide', 'verse:segment', 'show-song', 'show-person', 'show-dual-bilingual', 'show-dual-explanatory'];
  if (projectionTypes.includes(msg.type) && wsConnected) {
    projectWithLock(msg);
  } else {
    safePostMessage(msg);
  }
};

// ─────────────────────────────────────────────────────────────
//  DÉMARRAGE (AUTO-DISCOVERY INTÉGRÉE)
// ─────────────────────────────────────────────────────────────

async function init() {
  try {
    await db.open();
    logEvent('Application démarrée', { version: '1.0-sp30' });

    const vals = await Promise.all(
      SETTINGS_KEYS.map((k) => db.getSetting(k, SETTINGS_DEFAULTS[k])),
    );
    SETTINGS_KEYS.forEach((k, i) => { App.settings[k] = vals[i]; });

    App.lastBibleRef  = await db.getSetting('lastBibleRef',  '');
    App.lastBibleText = await db.getSetting('lastBibleText', '');

    App.activeDisplayMode       = await db.getSetting('activeDisplayMode', 'normal');
    App.bilingual.secondVersion = await db.getSetting('bilingualSecondVersion', null);
    App.explanatory.reference   = await db.getSetting('explanatoryReference', '');
    App.explanatory.version     = await db.getSetting('explanatoryVersion', null);
    App.explanatory.text        = await db.getSetting('explanatoryText', '');
    App.explanatory.book        = await db.getSetting('explanatoryBook', '');
    App.explanatory.chapter     = await db.getSetting('explanatoryChapter', '');
    App.explanatory.verse       = await db.getSetting('explanatoryVerse', '');
    App.explanatory.ref         = await db.getSetting('explanatoryRef', '');

    applyTheme(App.settings.ltType);

    const discovered = await dataService.discoverServer();
    if (discovered) {
      console.log('[App] Serveur découvert, mode serveur activé');
      const names = await db.getAllBibleNames();
      if (names.length === 0 && App.settings.relayEnabled !== false) {
        await refreshBiblesFromServer();
      }
    } else {
      console.log('[App] Aucun serveur trouvé, mode local');
    }

    initServiceWorker();
    initTabs();
    initSwipeGestures();
    initKeyboardShortcuts();
    initShortcutsModal();
    initAboutModal();

    window.addEventListener('server-status-changed', onServerStatusChanged);

    setTimeout(() => {
      const healthy = dataService.getServerHealth();
      if (!healthy && App.settings?.serverMode) {
        updateOfflineBanner(true);
      }
    }, 1000);

    document.getElementById('btn-live-clear')?.addEventListener('click', () => {
      safePostMessage({ type: 'hide-lower-third' });
      if (App.activeDisplayMode !== 'normal') {
        safePostMessage({ type: 'hide-dual' });
      }
      showToast('Écran effacé', 'info', 1200);
    });

    document.getElementById('btn-favorites')?.addEventListener('click', openFavoritesModal);

    document.getElementById('favorites-modal-close')?.addEventListener('click', closeFavoritesModal);
    document.getElementById('favorites-modal-cancel')?.addEventListener('click', closeFavoritesModal);
    document.getElementById('favorites-modal')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        closeFavoritesModal();
      }
    });

    const footerVer = document.getElementById('footer-version');
    if (footerVer) footerVer.textContent = 'v1.0 · PWA · IndexedDB';

    hideLoadingOverlay();

    document.addEventListener('app:next-segment', () => {
      if (App.currentTab === 'songs' && App.currentSong) {
        const nextBtn = document.getElementById('slide-next');
        if (nextBtn && !nextBtn.disabled) nextBtn.click();
      } else if (App.currentTab === 'bible' && App.bibleData) {
        document.dispatchEvent(new CustomEvent('app:next-verse'));
      }
    });

    document.addEventListener('app:prev-segment', () => {
      if (App.currentTab === 'songs' && App.currentSong) {
        const prevBtn = document.getElementById('slide-prev');
        if (prevBtn && !prevBtn.disabled) prevBtn.click();
      } else if (App.currentTab === 'bible' && App.bibleData) {
        document.dispatchEvent(new CustomEvent('app:prev-verse'));
      }
    });

    if (typeof bibleNextVerse !== 'undefined') {
      document.addEventListener('app:next-verse', () => bibleNextVerse());
      document.addEventListener('app:prev-verse', () => biblePrevVerse());
    }

    patchSafePostMessageForWS();

    const wsStatus = document.createElement('span');
    wsStatus.id        = 'ws-status';
    wsStatus.title     = 'État du relais réseau — cliquez pour les paramètres réseau';
    wsStatus.style.cssText = [
      'font-size:0.7rem', 'padding:2px 8px', 'border-radius:4px',
      'margin-left:8px',  'cursor:pointer',   'user-select:none',
    ].join(';');
    wsStatus.addEventListener('click', () => navigateTo('settings'));
    const headerRight = document.querySelector('.header-right');
    if (headerRight) headerRight.appendChild(wsStatus);

    if (App.settings.relayEnabled === false) {
      updateRelayIndicator('disabled');
    } else {
      updateRelayIndicator('offline');
      connectWebSocket();
    }

    window.addEventListener('relay-toggle-changed', (e) => {
      App.settings.relayEnabled = e.detail.enabled;
      if (!e.detail.enabled) {
        updateRelayIndicator('disabled');
        if (wsReconnectTimer) { clearTimeout(wsReconnectTimer); wsReconnectTimer = null; }
        if (wsClient) {
          try { wsClient.close(); } catch(err) {}
          wsClient = null;
        }
        wsConnected = false;
        for (let key in _locks) {
          _locks[key] = false;
          _lockHolders[key] = null;
        }
        enableProjectionButtons(true);
      } else {
        connectWebSocket();
      }
    });

    if (App.settings.relayEnabled !== false) {
      setTimeout(refreshBiblesFromServer, 500);
    }

    // ─── ÉCOUTEURS POUR LA FERMETURE DES TIROIRS ───
    document.addEventListener('click', function(e) {
      const closeEl = e.target.closest('[data-drawer-close]');
      if (closeEl) {
        const drawer = closeEl.closest('.drawer');
        if (drawer) {
          closeDrawer(drawer.id);
          e.preventDefault();
        }
      }
    });

  } catch (err) {
    console.error('[App] Erreur init :', err);
    db.log('error', 'Initialisation échouée', { message: err.message, stack: err.stack });
    hideLoadingOverlay();
    showToast('⚠ Erreur d\'initialisation : ' + err.message, 'error', 6000);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}