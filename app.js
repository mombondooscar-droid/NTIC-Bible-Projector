// app.js v2.0 - NAGAD Bible (Amélioration WebSocket, Front-end fluide, Robustesse)
// ============================================================
// Améliorations :
// - Intégration du nouveau WSClient robuste
// - Gestion des erreurs améliorée
// - Animations CSS plus fluides
// - Buffer de messages optimisé
// - Reconnexion intelligente
// - Heartbeats pour maintenir la connexion
// - Indicateurs visuels améliorés
// ============================================================

// ============================================================
// ÉTAT GLOBAL
// ============================================================

// App = Store -> store.js  |  SETTINGS_KEYS/DEFAULTS -> constants.js

// Canaux de projection (BroadcastChannel + Fallback)
// 5 fenêtres actives : bible, chant, lt-verset, lt-personne, timer
const projChannels = {
  bible:      createProjectionChannel(PROJECTION_CHANNELS.BIBLE,       false),
  chant:      createProjectionChannel(PROJECTION_CHANNELS.CHANT,       false),
  ltVerset:   createProjectionChannel(PROJECTION_CHANNELS.LT_VERSET,   false),
  ltPersonne: createProjectionChannel(PROJECTION_CHANNELS.LT_PERSONNE, false),
  timer:      createProjectionChannel(PROJECTION_CHANNELS.TIMER,       false),
};

// Rendre accessible globalement pour safePostMessage (dom.js)
window.projChannels = projChannels;

// Canaux @deprecated conservés pour rétro-compatibilité
const _legacyProjChannel   = createProjectionChannel(PROJECTION_CHANNELS.LEGACY, true);
const _deprecatedLtChannel = createProjectionChannel(PROJECTION_CHANNELS.LT,    false);

// ============================================================
// GESTION DES VERROUS (par ressource)
// ============================================================

// Verrous locaux (état miroir du serveur)
let _locks = {
  bible: false,
  chant: false,
  lt: false,
  timer: false,
  default: false
};
let _lockHolders = {}; // resource -> sessionId
let _pendingProjection = null;

function getResourceForMessage(msg) {
  if (!msg || !msg.type) return 'default';
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

// ============================================================
// GESTION DE L'ÉTAT PARTAGÉ
// ============================================================

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
      const resource = 'default';
      if (updates.lockedBy === null) {
        _locks[resource] = false;
        _lockHolders[resource] = null;
        if (!silent) enableProjectionButtons(true);
      } else if (updates.lockedBy === TAB_ID) {
        _locks[resource] = true;
        _lockHolders[resource] = updates.lockedBy;
        if (!silent) enableProjectionButtons(true);
      } else {
        _locks[resource] = false;
        _lockHolders[resource] = updates.lockedBy;
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

// ============================================================
// SYSTÈME DE VERROUILLAGE AMÉLIORÉ
// ============================================================

function enableProjectionButtons(enabled) {
  const btns = document.querySelectorAll('.btn-project, .btn-project-verse, .btn-project-song, .btn-project-person, .staging-send-btn');
  btns.forEach(btn => {
    if (!btn) return;
    btn.disabled = !enabled;
    btn.title = enabled ? 'Projeter' : '\ud83d\udd12 Verrouillé par un autre opérateur';
  });
}

function projectWithLock(msg) {
  if (!WSClient.isConnected || App.settings.relayEnabled === false) {
    safePostMessage(msg);
    return;
  }

  const resource = getResourceForMessage(msg);
  
  // Si on a déjà le verrou, envoyer directement
  if (WSClient.isLocked(resource) && WSClient.getLockHolder(resource) === TAB_ID) {
    const versionedMsg = { ...msg, _sessionId: TAB_ID, resource: resource };
    safePostMessage(versionedMsg);
    WSClient.send(versionedMsg);
    return;
  }

  // Si le verrou est détenu par quelqu'un d'autre
  if (WSClient.isLocked(resource) && WSClient.getLockHolder(resource) !== TAB_ID) {
    const holder = WSClient.getLockHolder(resource);
    showToast(`\ud83d\udd12 ${resource} est verrouillé par ${holder || 'un autre opérateur'}`, 'warning', 2000);
    return;
  }

  // Demander le verrou
  _pendingProjection = msg;
  WSClient.requestLock(resource, (response) => {
    if (response.success) {
      // Verrou obtenu, envoyer le message
      const versionedMsg = { ...msg, _sessionId: TAB_ID, resource: resource };
      safePostMessage(versionedMsg);
      WSClient.send(versionedMsg);
      _pendingProjection = null;
    } else {
      showToast(`\ud83d\udd12 Impossible d'obtenir le verrou pour "${resource}"`, 'warning', 2000);
      _pendingProjection = null;
    }
  });
}

function releaseLock(resource) {
  WSClient.releaseLock(resource);
  _locks[resource] = false;
  _lockHolders[resource] = null;
  showToast(`\ud83d\udd13 Verrou libéré pour "${resource}"`, 'info', 1500);
}

// ============================================================
// INDICATEUR VISUEL WEBSOCKET AMÉLIORÉ
// ============================================================

function updateRelayIndicator(state) {
  const el = document.getElementById('ws-status');
  if (!el) return;
  
  const STATES = {
    connected: { 
      text: '\ud83d\udfe2 Relais actif', 
      color: 'var(--success, #28a745)', 
      icon: '\ud83d\udfe2',
      pulse: false 
    },
    connecting: { 
      text: '\u23f3 Connexion...', 
      color: 'var(--warning, #ffc107)', 
      icon: '\u23f3',
      pulse: true 
    },
    disconnected: { 
      text: '\ud83d\udfe1 Relais hors ligne', 
      color: 'var(--danger, #dc3545)', 
      icon: '\ud83d\udfe1',
      pulse: false 
    },
    disabled: { 
      text: '\ud83d\udd34 Relais désactivé', 
      color: 'var(--muted, #6c757d)', 
      icon: '\ud83d\udd34',
      pulse: false 
    },
    error: { 
      text: '\u274c Erreur de connexion', 
      color: 'var(--danger, #dc3545)', 
      icon: '\u274c',
      pulse: true 
    }
  };
  
  const s = STATES[state] || STATES.disconnected;
  el.textContent = `${s.icon} ${s.text}`;
  el.style.color = s.color;
  el.style.animation = s.pulse ? 'pulse 2s infinite' : 'none';
  el.title = `État du relais réseau: ${s.text}`;
}

// ============================================================
// GESTION DES MESSAGES WEBSOCKET
// ============================================================

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

// ============================================================
// SYNCHRONISATION DES BIBLES DEPUIS LE SERVEUR
// ============================================================

async function refreshBiblesFromServer() {
  try {
    const serverUrl = App.settings.serverUrl || 'http://localhost:8080';
    console.log('[Bible] Synchronisation depuis', serverUrl);

    const res = await fetch(`${serverUrl}/api/bible/versions`, { 
      signal: AbortSignal.timeout(5000),
      headers: { 'X-API-Key': App.settings.apiKey || 'nagad-dev-key-2024' }
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    if (!data.versions) return;

    for (const name of data.versions) {
      const bibleRes = await fetch(`${serverUrl}/api/bible/load?name=${encodeURIComponent(name)}`, { 
        signal: AbortSignal.timeout(8000),
        headers: { 'X-API-Key': App.settings.apiKey || 'nagad-dev-key-2024' }
      });
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

    showToast(`\ud83d\udcda ${data.versions.length} Bible(s) synchronisée(s) depuis le serveur`, 'success', 3000);
  } catch (err) {
    console.warn('[Bible] Échec synchronisation :', err);
    const url = App.settings.serverUrl || 'localhost';
    showToast(`\u274c Synchronisation des Bibles échouée (${url}). Vérifiez l'URL du serveur et le pare-feu.`, 'error', 5000);
  }
}

// ============================================================
// RELAY HTTP
// ============================================================

async function postToRelay(msg) {
  try {
    const serverUrl = App.settings.serverUrl || 'http://localhost:8080';
    await fetch(`${serverUrl}/relay`, {
      method:  'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-API-Key': App.settings.apiKey || 'nagad-dev-key-2024'
      },
      body:    JSON.stringify(msg),
    });
  } catch(e) {
    // Silencieux — serveur peut être absent ; le BroadcastChannel local continue
  }
}
window.postToRelay = postToRelay;

// ============================================================
// OUVERTURE DES FENÊTRES DE PROJECTION
// ============================================================

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
    transition: opacity 0.2s ease, transform 0.2s ease;
    opacity: 0; transform: translateY(-10px);
  `;
  
  const items = [
    { label: '\ud83d\udcd6 Bible',          key: 'projection-bible' },
    { label: '\ud83c\udfb5 Chant',          key: 'projection-chant' },
    { label: '\ud83c\udfaf Lower Third',    key: 'projection-lt' },
    { label: '\u23f1 Timer',          key: 'projection-timer' },
    { label: '\ud83d\udce6 Ouvrir tout',    key: 'all' },
  ];
  
  items.forEach(item => {
    const opt = document.createElement('button');
    opt.className = 'dropdown-menu-item';
    opt.textContent = item.label;
    opt.style.cssText = `
      background:transparent; border:none; padding:8px 12px; text-align:left; 
      cursor:pointer; width:100%; font-family:var(--font-ui); font-size:0.85rem; 
      color:var(--text); border-radius:var(--radius-xs);
      transition: background 0.15s ease, color 0.15s ease;
    `;
    opt.addEventListener('mouseenter', () => { 
      opt.style.background = 'var(--bg-card-hover)'; 
      opt.style.color = 'var(--text-hover)'; 
    });
    opt.addEventListener('mouseleave', () => { 
      opt.style.background = 'transparent'; 
      opt.style.color = 'var(--text)'; 
    });
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

  // Animation d'entrée
  requestAnimationFrame(() => {
    menu.style.opacity = '1';
    menu.style.transform = 'translateY(0)';
  });

  setTimeout(() => {
    document.addEventListener('click', function handler(e) {
      if (!menu.contains(e.target) && e.target !== btn) {
        menu.style.opacity = '0';
        menu.style.transform = 'translateY(-10px)';
        setTimeout(() => {
          menu.remove();
        }, 200);
        document.removeEventListener('click', handler);
      }
    });
  }, 0);
}

// ============================================================
// SYNCHRONISATION DES FENÊTRES DE PROJECTION
// ============================================================

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
        const allStrophesTexts = typeof buildAllStrophesTexts === 'function' ? buildAllStrophesTexts(strophes) : [];
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

// ============================================================
// VERROUILLAGE CROSS-TABS
// ============================================================

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
    showToast(`\u26a0 ${name} : autre onglet actif - nouvelle tentative...`, 'warning', 2000);
    await new Promise(r => setTimeout(r, 500));
    if (!acquireLock()) {
      db.log('warn', `Lock toujours actif pour ${name}, écriture forcée`);
      showToast(`\u26a0 ${name} : conflit persistant, exécution forcée`, 'warning', 2000);
    }
  }
  try {
    await fn();
  } finally {
    releaseLock();
  }
}

// ============================================================
// LOGGING SYSTÈME
// ============================================================

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

// ============================================================
// PATCH safePostMessage POUR WEBSOCKET + LOCK
// ============================================================

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

    // Utiliser le nouveau WSClient
    if (WSClient.isConnected) {
      WSClient.send(relayMsg);
    }

    // Fallback HTTP
    postToRelay(relayMsg);
  };
}

// Patch projectVerse pour utiliser projectWithLock
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
  
  if (WSClient.isConnected) {
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
  if (projectionTypes.includes(msg.type) && WSClient.isConnected) {
    projectWithLock(msg);
  } else {
    safePostMessage(msg);
  }
};

// ============================================================
// GESTION DE L'OVERLAY DE CHARGEMENT
// ============================================================

function hideLoadingOverlay() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.style.opacity = '0';
    setTimeout(() => {
      overlay.style.display = 'none';
    }, 300);
  }
}

// ============================================================
// INITIALISATION DES ÉLÉMENTS UI
// ============================================================

function initUI() {
  // Indicateur WebSocket
  const wsStatus = document.createElement('span');
  wsStatus.id = 'ws-status';
  wsStatus.title = 'État du relais réseau — cliquez pour les paramètres réseau';
  wsStatus.style.cssText = [
    'font-size:0.7rem', 'padding:2px 8px', 'border-radius:4px',
    'margin-left:8px', 'cursor:pointer', 'user-select:none',
    'transition: color 0.2s ease, animation 0.2s ease'
  ].join(';');
  wsStatus.addEventListener('click', () => navigateTo('settings'));
  
  const headerRight = document.querySelector('.header-right');
  if (headerRight) headerRight.appendChild(wsStatus);
  
  // Mettre à jour l'indicateur
  if (App.settings.relayEnabled === false) {
    updateRelayIndicator('disabled');
  } else {
    updateRelayIndicator(WSClient.state);
  }
  
  // Écouteur pour les changements de relay
  window.addEventListener('relay-toggle-changed', (e) => {
    App.settings.relayEnabled = e.detail.enabled;
    if (!e.detail.enabled) {
      updateRelayIndicator('disabled');
      WSClient.disconnect();
      for (let key in _locks) {
        _locks[key] = false;
        _lockHolders[key] = null;
      }
      enableProjectionButtons(true);
    } else {
      updateRelayIndicator(WSClient.state);
      WSClient.connect();
    }
  });
  
  // Écouteur pour les changements d'état WebSocket
  WSClient.on('connect', () => {
    updateRelayIndicator('connected');
    console.log('[WSClient] Connecté au serveur WebSocket');
    syncProjectionWindows();
  });
  
  WSClient.on('disconnect', () => {
    updateRelayIndicator(WSClient.state);
    console.log('[WSClient] Déconnecté du serveur WebSocket');
  });
  
  WSClient.on('error', (error) => {
    updateRelayIndicator('error');
    console.error('[WSClient] Erreur:', error);
    if (error.type === 'authentication_failed') {
      showToast('\u274c Authentification échouée. Vérifiez la clé API.', 'error', 5000);
    }
  });
  
  WSClient.on('stateUpdate', (update) => {
    console.log('[WSClient] Mise à jour d'état:', update.type);
    if (update.type === 'full') {
      // Synchroniser l'état local
      if (update.state.lastBibleRef) {
        App.lastBibleRef = update.state.lastBibleRef;
        App.lastBibleText = update.state.lastBibleText || '';
      }
      if (update.state.currentPersonActive) {
        App.currentPersonActive = update.state.currentPersonActive;
      }
      syncProjectionWindows();
    }
  });
  
  WSClient.on('lockChange', (lockInfo) => {
    const resource = lockInfo.resource || 'default';
    _locks[resource] = lockInfo.granted;
    _lockHolders[resource] = lockInfo.holder;
    
    const anyLock = Object.values(_locks).some(v => v === true);
    enableProjectionButtons(!anyLock || _lockHolders[resource] === TAB_ID);
    
    if (lockInfo.granted) {
      showToast(`\ud83d\udd12 Verrou obtenu pour "${resource}"`, 'success', 2000);
    } else if (lockInfo.holder) {
      showToast(`\ud83d\udd12 "${resource}" verrouillé par ${lockInfo.holder}`, 'warning', 2000);
    }
  });
  
  // Bouton de projection
  const btnOpenProjection = document.getElementById('btn-open-projection');
  if (btnOpenProjection) {
    btnOpenProjection.addEventListener('click', showProjectionMenu);
  }
  
  // Bouton clear live
  document.getElementById('btn-live-clear')?.addEventListener('click', () => {
    safePostMessage({ type: 'hide-lower-third' });
    if (App.activeDisplayMode !== 'normal') {
      safePostMessage({ type: 'hide-dual' });
    }
    showToast('Écran effacé', 'info', 1200);
  });
  
  // Favoris
  document.getElementById('btn-favorites')?.addEventListener('click', openFavoritesModal);
  document.getElementById('favorites-modal-close')?.addEventListener('click', closeFavoritesModal);
  document.getElementById('favorites-modal-cancel')?.addEventListener('click', closeFavoritesModal);
  document.getElementById('favorites-modal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      closeFavoritesModal();
    }
  });
  
  // Version du footer
  const footerVer = document.getElementById('footer-version');
  if (footerVer) footerVer.textContent = 'v2.0 \u00b7 PWA \u00b7 WebSocket v2';
}

// ============================================================
// GESTION DES ÉVÉNEMENTS GLOBAUX
// ============================================================

function initGlobalEvents() {
  // Événements de navigation
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
  
  // Fermeture des tiroirs
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
}

// ============================================================
// DÉMARRAGE (AUTO-DISCOVERY INTÉGRÉE)
// ============================================================

async function init() {
  try {
    // Initialiser la base de données
    await db.open();
    logEvent('Application démarrée', { version: '2.0' });

    // Charger les paramètres
    const vals = await Promise.all(
      SETTINGS_KEYS.map((k) => db.getSetting(k, SETTINGS_DEFAULTS[k])),
    );
    SETTINGS_KEYS.forEach((k, i) => { App.settings[k] = vals[i]; });

    // Charger l'état précédent
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

    // Appliquer le thème
    applyTheme(App.settings.ltType);

    // Découvrir le serveur
    const discovered = await WSClient.discoverServer();
    if (discovered) {
      console.log('[App] Serveur découvert, mode serveur activé');
      const names = await db.getAllBibleNames();
      if (names.length === 0 && App.settings.relayEnabled !== false) {
        await refreshBiblesFromServer();
      }
    } else {
      console.log('[App] Aucun serveur trouvé, mode local');
    }

    // Initialiser le Service Worker
    initServiceWorker();
    initTabs();
    initSwipeGestures();
    initKeyboardShortcuts();
    initShortcutsModal();
    initAboutModal();

    // Initialiser l'UI
    initUI();
    initGlobalEvents();

    // Patch safePostMessage
    patchSafePostMessageForWS();

    // Synchroniser les Bibles si mode serveur
    if (App.settings.relayEnabled !== false) {
      setTimeout(refreshBiblesFromServer, 500);
    }

    // Connexion WebSocket
    if (App.settings.relayEnabled !== false) {
      WSClient.connect();
    }

    // Vérifier la santé du serveur
    setTimeout(() => {
      const healthy = dataService.getServerHealth();
      if (!healthy && App.settings?.serverMode) {
        updateOfflineBanner(true);
      }
    }, 1000);

    // Cacher l'overlay de chargement
    hideLoadingOverlay();

    // Écouteur pour les changements de statut serveur
    window.addEventListener('server-status-changed', onServerStatusChanged);

  } catch (err) {
    console.error('[App] Erreur init :', err);
    db.log('error', 'Initialisation échouée', { message: err.message, stack: err.stack });
    hideLoadingOverlay();
    showToast('\u26a0 Erreur d\'initialisation : ' + err.message, 'error', 6000);
  }
}

// ============================================================
// POINT D'ENTRÉE
// ============================================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
