// app.js (version complète avec ajouts PIP, clic direct verset, mode slide, fallback BC,
//         logging global et verrouillage cross‑tabs, + AUDIT ERGO #4, + US-52 Thème Tourpac)
// + Mise à jour Demande #5 : 4 canaux de projection dédiés
// + US-59 : Correction withWriteLock() avec try/finally pour garantir releaseLock()

/**
 * ============================================================
 *  NTIC BIBLE PROJECTOR — app.js
 *  Version : 1.0-sp20  |  Sprint : US-13 + Audit ergonomique
 *  + M1 à M7, T1 à T3, PC1 à PC4
 *  + US-52 Thème clair Tourpac piloté par ltType
 *  + Demande #5 : canaux dédiés et ouverture 4 fenêtres
 * ============================================================
 */

// ─────────────────────────────────────────────────────────────
//  ÉTAT GLOBAL
// ─────────────────────────────────────────────────────────────
// App = Store → store.js  |  SETTINGS_KEYS/DEFAULTS → constants.js

// ─────────────────────────────────────────────────────────────
//  CANAUX DE PROJECTION (BroadcastChannel + Fallback US-38)
//  4 fenêtres actives : bible · chant · lt-verset · lt-personne
// ─────────────────────────────────────────────────────────────

/** Canaux actifs (4 fenêtres). */
const projChannels = {
  bible:      createProjectionChannel(PROJECTION_CHANNELS.BIBLE,      false),
  chant:      createProjectionChannel(PROJECTION_CHANNELS.CHANT,      false),
  ltVerset:   createProjectionChannel(PROJECTION_CHANNELS.LT_VERSET,  false),
  ltPersonne: createProjectionChannel(PROJECTION_CHANNELS.LT_PERSONNE, false),
};

// Rendre accessible globalement pour safePostMessage (dom.js)
window.projChannels = projChannels;

// Canaux @deprecated conservés pour rétro-compatibilité (non utilisés par safePostMessage)
const _legacyProjChannel   = createProjectionChannel(PROJECTION_CHANNELS.LEGACY, true);
const _deprecatedLtChannel = createProjectionChannel(PROJECTION_CHANNELS.LT,    false);

// ─────────────────────────────────────────────────────────────
//  OUVERTURE DES FENÊTRES DE PROJECTION (4 fenêtres dédiées)
// ─────────────────────────────────────────────────────────────

/** Ouvre les 4 fenêtres de projection si elles ne sont pas déjà ouvertes. */
function openProjectionWindows() {
  const windows = [
    { file: './projection-bible.html',        name: 'projection-bible' },
    { file: './projection-chant.html',        name: 'projection-chant' },
    { file: './projection-lt-verset.html',    name: 'projection-lt-verset' },
    { file: './projection-lt-personne.html',  name: 'projection-lt-personne' },
  ];
  windows.forEach((win, i) => {
    // window.open avec le même name réutilise une fenêtre existante
    window.open(win.file, win.name,
      `width=1280,height=720,menubar=no,toolbar=no,location=no,status=no,left=${100 + i * 60},top=${100 + i * 60}`);
  });
}

// ─────────────────────────────────────────────────────────────
//  UTILITAIRES
// ─────────────────────────────────────────────────────────────
// esc() → utils/dom.js
// debounce() → utils/dom.js
// fmtDate() → utils/dom.js
// buildVerseRef() / parseVerseRef() → utils/bibleHelpers.js
// showToast() → utils/dom.js
// createProjectionChannel() → utils/dom.js

// ─────────────────────────────────────────────────────────────
//  VERROUILLAGE CROSS-TABS (Problème #17)
// ─────────────────────────────────────────────────────────────

// Identifiant unique de l'onglet (persistant dans la session)
const TAB_ID = (() => {
  let id = sessionStorage.getItem('ntic_tab_id');
  if (!id) {
    id = Math.random().toString(36).slice(2);
    sessionStorage.setItem('ntic_tab_id', id);
  }
  return id;
})();

const LOCK_KEY = 'ntic_write_lock';
const LOCK_TTL = 3000; // 3 secondes

function acquireLock() {
  const existing = localStorage.getItem(LOCK_KEY);
  if (existing) {
    try {
      const lock = JSON.parse(existing);
      if (lock && (Date.now() - lock.ts) < LOCK_TTL && lock.tab !== TAB_ID) {
        return false; // lock actif par un autre onglet
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

/**
 * Exécute une opération d'écriture avec gestion du lock cross-tabs.
 * @param {Function} fn   Fonction asynchrone à exécuter
 * @param {string}   name Nom de l'opération (pour les toasts)
 */
async function withWriteLock(fn, name = 'Écriture') {
  if (!acquireLock()) {
    db.log('warn', `Lock actif pour ${name}, tentative 1`);
    showToast(`⚠ ${name} : autre onglet actif - nouvelle tentative...`, 'warning', 2000);
    await new Promise(r => setTimeout(r, 500));
    if (!acquireLock()) {
      db.log('warn', `Lock toujours actif pour ${name}, écriture forcée`);
      showToast(`⚠ ${name} : conflit persistant, exécution forcée`, 'warning', 2000);
      // On continue malgré le lock
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

/**
 * Enregistre un événement clé dans le journal système.
 * @param {string} action
 * @param {object} details
 */
function logEvent(action, details) {
  db.log('info', action, details);
}

// Gestionnaires d'erreurs globales
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

// Rendre disponibles dans le scope global pour les panneaux
window.withWriteLock = withWriteLock;
window.logEvent = logEvent;
window.acquireLock = acquireLock;
window.releaseLock = releaseLock;

// ─────────────────────────────────────────────────────────────
//  THÈME VISUEL PILOTÉ PAR ltType (US-52)
// ─────────────────────────────────────────────────────────────

/**
 * Applique le thème visuel en fonction du ltType.
 * @param {string} ltType 'tourpac' ou autre (ictheme/graduation)
 */
function applyTheme(ltType) {
  const isTourpac = ltType === 'tourpac';
  if (isTourpac) {
    document.documentElement.dataset.theme = 'tourpac';
  } else {
    // Pour tout autre modèle, on revient au thème sombre par défaut
    delete document.documentElement.dataset.theme;
  }
}

// Rendre disponible globalement pour settingsPanel.js
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
    logEvent('Mise à jour PWA', { version: CACHE_VERSION });
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

  // M2 : sur mobile, déplacer le bouton Projection dans la nav
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
      // Masquer le bouton original
      existingProjBtn.style.display = 'none';
    }
  }

  document.getElementById('btn-open-projection')?.addEventListener('click', openProjectionWindows);

  const params   = new URLSearchParams(location.search);
  const initTab  = params.get('tab') || 'bible';
  navigateTo(initTab, false);
}

// PC1 : titre dynamique
function updateDocumentTitle(tab) {
  const titles = {
    bible: 'Bible',
    favorites: 'Favoris',
    songs: 'Chants',
    'lower-third': 'Lower Third',
    settings: 'Paramètres'
  };
  document.title = `NTIC Bible Projector — ${titles[tab] || 'Bible'}`;
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

  // M6 : skeleton UI
  main.innerHTML = renderSkeleton();

  try {
    switch (tab) {
      case 'bible':       await renderBiblePanel(main);       break;
      case 'favorites':   await renderFavoritesPanel(main);   break;
      case 'songs':       await renderSongsPanel(main);       break;
      case 'lower-third': await renderLowerThirdPanel(main);  break;
      case 'settings':    await renderSettingsPanel(main);    break;
      default:            await renderBiblePanel(main);
    }
  } catch (err) {
    console.error('[App] Erreur panneau :', err);
    db.log('error', `Erreur rendu panneau ${tab}`, { message: err.message, stack: err.stack });
    // M7 : bouton recharger
    main.innerHTML = `<div class="panel-error">
      <span class="panel-error-icon">⚠️</span>
      <p>Erreur : ${esc(err.message)}</p>
      <button class="btn btn-primary" id="reload-panel-btn">⟳ Recharger</button>
    </div>`;
    document.getElementById('reload-panel-btn')?.addEventListener('click', () => renderPanel(tab));
  }
}

// Les panneaux sont chargés dynamiquement depuis les fichiers dédiés
// HELPER : cache de refs favoris (optimisation US-06)
// getFavRefsSet / displaySearchResults / highlightText / currentSearchMode
// onSearchModeChange / handleFullTextSearch / handleRefSearch
// renderBiblePanel / loadBibleVersion / renderBooksGrid / renderChaptersGrid
// renderVersesList / toggleVerseFavorite / projectVerse
// → panels/biblePanel.js

// safePostMessage() → utils/dom.js

// ═════════════════════════════════════════════════════════════
//  PANNEAU FAVORIS
// ═════════════════════════════════════════════════════════════
// renderFavoritesPanel / buildFavCards / refreshFavList / rebuildLabelFilter
// bindFavCards (→ _bindProjectButtons / _bindLabelFilterBadges / _bindLabelEditButtons / _bindDeleteButtons)
// → panels/favoritesPanel.js

// ═════════════════════════════════════════════════════════════
//  PANNEAU CHANTS (US-04 + ★ US-06 + US-08 + US-13)
// ═════════════════════════════════════════════════════════════

// _songsFilterQuery / refreshSongsList / renderSongsPanel / renderSongCards
// bindSongCards / showNewSongForm / renderSongEditor (+ _bind* + _buildEditorHtml)
// getCurrentStrophes / renderSlidePreview / updateSlidePreview
// → panels/songsPanel.js

// ═════════════════════════════════════════════════════════════
//  PANNEAU LOWER THIRD
// ═════════════════════════════════════════════════════════════
// renderLowerThirdPanel (→ _buildLTHtml / _bindVerseActions
//   _bindPersonActions / _bindAddPerson / _bindImpromptu)
// → panels/lowerThirdPanel.js

// ═════════════════════════════════════════════════════════════
//  PANNEAU PARAMÈTRES
// ═════════════════════════════════════════════════════════════
// FONTS / allowedKeys → constants.js (FONTS + SETTINGS_KEYS)
// renderSettingsPanel → _renderBibleImport / _renderSongSettings
//   _renderLTSettings / _renderSlideSettings / _renderConfigIO
// loadBibleList → panels/settingsPanel.js

// hideLoadingOverlay() → utils/dom.js

// ─────────────────────────────────────────────────────────────
//  US-015 : GESTES TACTILES (swipe horizontal)
// ─────────────────────────────────────────────────────────────

/**
 * Active le swipe horizontal sur appareils tactiles uniquement.
 * Swipe gauche → app:next-segment  |  Swipe droite → app:prev-segment
 */
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

    // Ignorer si trop court ou essentiellement vertical (scroll)
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
//  US-40 : RACCOURCIS CLAVIER GLOBAUX
// ─────────────────────────────────────────────────────────────

function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    const active = document.activeElement;
    if (active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName)) return;

    const tab = App.currentTab;
    switch (e.key) {
      case 'ArrowRight':
        if (tab === 'bible') {
          if (typeof window.bibleNextVerse === 'function') window.bibleNextVerse();
        } else if (tab === 'songs') {
          document.dispatchEvent(new CustomEvent('app:next-segment'));
        }
        e.preventDefault();
        break;
      case 'ArrowLeft':
        if (tab === 'bible') {
          if (typeof window.biblePrevVerse === 'function') window.biblePrevVerse();
        } else if (tab === 'songs') {
          document.dispatchEvent(new CustomEvent('app:prev-segment'));
        }
        e.preventDefault();
        break;
      case 'ArrowUp':
        if (tab === 'bible') {
          const prevBtn = document.querySelector('.seg-btn-prev');
          if (prevBtn && !prevBtn.disabled) prevBtn.click();
          e.preventDefault();
        }
        break;
      case 'ArrowDown':
        if (tab === 'bible') {
          const nextBtn = document.querySelector('.seg-btn-next');
          if (nextBtn && !nextBtn.disabled) nextBtn.click();
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

  const show = () => {
    modal.classList.add('visible');
    modal.setAttribute('aria-hidden', 'false');
  };
  const hide = () => {
    modal.classList.remove('visible');
    modal.setAttribute('aria-hidden', 'true');
  };

  btn.addEventListener('click', show);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) hide();
  });
  const closeBtn = document.getElementById('close-shortcuts');
  if (closeBtn) closeBtn.addEventListener('click', hide);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('visible')) {
      hide();
      e.preventDefault();
    }
  });
}

// ─────────────────────────────────────────────────────────────
//  DÉMARRAGE
// ─────────────────────────────────────────────────────────────
async function init() {
  try {
    await db.open();
    logEvent('Application démarrée', { version: '1.0-sp20' });

    // Chargement parallèle des settings (SETTINGS_KEYS/DEFAULTS → constants.js)
    const vals = await Promise.all(
      SETTINGS_KEYS.map((k) => db.getSetting(k, SETTINGS_DEFAULTS[k])),
    );
    SETTINGS_KEYS.forEach((k, i) => { App.settings[k] = vals[i]; });

    // ── R#13 (Problème #2) : Restaurer la dernière référence projetée ──
    App.lastBibleRef  = await db.getSetting('lastBibleRef',  '');
    App.lastBibleText = await db.getSetting('lastBibleText', '');

    // ── US-52 : Appliquer le thème en fonction du ltType chargé ──
    const ltType = App.settings.ltType;
    applyTheme(ltType);

    const pipEnabled = await db.getSetting('pipEnabled', false);
    await setPipEnabled(pipEnabled);

    initServiceWorker();
    initTabs();
    initSwipeGestures();  // US-015
    initHamburger();      // US-015
    initKeyboardShortcuts(); // US-40
    initShortcutsModal();    // US-40

    const btnPip = document.getElementById('btn-pip');
    if (btnPip) {
      btnPip.addEventListener('click', () => setPipEnabled(!App.pipEnabled));
    }
    const pipClose = document.getElementById('pip-close');
    if (pipClose) {
      pipClose.addEventListener('click', () => setPipEnabled(false));
    }

    // US-24 : Restaurer la position du PIP et activer le drag
    const pipPos = await db.getSetting('pip_position', null);
    if (pipPos) {
      const pipEl = document.getElementById('pip-preview');
      if (pipEl) {
        pipEl.style.left   = pipPos.x + 'px';
        pipEl.style.top    = pipPos.y + 'px';
        pipEl.style.right  = 'auto';
        pipEl.style.bottom = 'auto';
      }
    }
    initPipDrag(); // défini dans panels/biblePanel.js (US-24)

    const footerVer = document.getElementById('footer-version');
    if (footerVer) footerVer.textContent = 'v1.0 · PWA · IndexedDB';

    hideLoadingOverlay();

    document.addEventListener('app:next-segment', () => {
      if (App.currentTab === 'songs' && App.currentSong) {
        const nextBtn = document.getElementById('slide-next');
        if (nextBtn && !nextBtn.disabled) {
          nextBtn.click();
        }
      } else if (App.currentTab === 'bible' && App.bibleData) {
        const event = new CustomEvent('app:next-verse');
        document.dispatchEvent(event);
      }
    });

    document.addEventListener('app:prev-segment', () => {
      if (App.currentTab === 'songs' && App.currentSong) {
        const prevBtn = document.getElementById('slide-prev');
        if (prevBtn && !prevBtn.disabled) {
          prevBtn.click();
        }
      } else if (App.currentTab === 'bible' && App.bibleData) {
        const event = new CustomEvent('app:prev-verse');
        document.dispatchEvent(event);
      }
    });

    if (typeof bibleNextVerse !== 'undefined') {
      document.addEventListener('app:next-verse', () => bibleNextVerse());
      document.addEventListener('app:prev-verse', () => biblePrevVerse());
    }

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