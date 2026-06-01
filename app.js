// app.js (version complète avec ajouts PIP, recherche avancée, et alignement chants)

/**
 * ============================================================
 *  NTIC BIBLE PROJECTOR — app.js
 *  Version : 1.0-sp12  |  Sprint : US-13 (Alignement chants)
 *  + US-08 Projection Chants, US-09 Versets, US-07 Paramètres, US-06 Recherche
 *  + US-11 Picture-in-Picture Preview (PIP)
 *  + US-12 Recherche par référence + correction de frappe
 *  + US-13 Alignement du texte des chants (gauche/centre/droite)
 * ============================================================
 *
 *  PANNEAUX :
 *    renderBiblePanel()       — US-03 + ★ US-06 + US-12
 *    renderFavoritesPanel()   — US-06
 *    renderSongsPanel()       — US-04 + ★ US-06 + US-08 + US-13
 *    renderLowerThirdPanel()  — US-10 complet
 *    renderSettingsPanel()    — US-07 + US-13
 *
 *  INTERDIT (cf. spec) :
 *    - confirm() / alert() / prompt()
 *    - location.reload()
 *    - import / export ES modules
 *    - localStorage pour données fonctionnelles
 * ============================================================
 */

// ─────────────────────────────────────────────────────────────
//  ÉTAT GLOBAL
// ─────────────────────────────────────────────────────────────
const App = {
  currentTab:          'bible',
  bibleData:           null,   // données de la bible active en mémoire
  currentSong:         null,   // objet chant en cours d'édition
  currentStropheIdx:   0,      // index strophe affichée
  currentPersonActive: null,   // id personne LT active (US-10)
  // US-09 : dernier verset projeté (référence et texte)
  lastBibleRef:        '',
  lastBibleText:       '',
  // PIP (aperçu projection)
  pipEnabled:          false,
  lastProjectionState: { mode: 'blank' }, // dernier état connu pour restauration
  searchMode:          'text', // 'text' ou 'ref'
  settings: {
    // Bible
    currentBible:      null,
    // Lower Third
    ltType:            'ictheme',
    ltRefColor:        '#ffffff',
    ltVerseColor:      '#16308f',
    ltFontFamily:      'Arial Black',
    ltWidth:           1240,
    ltHeight:          248,
    ltRefFontSize:     30,
    ltVerseFontSize:   38,
    personNameSize:    30,
    personTitleSize:   24,
    // Chants (US-07)
    songBgColor:       '#000000',
    songTextColor:     '#ffffff',
    songFontSize:      70,
    songFontFamily:    'Arial Black',
    songShowTitle:     true,
    songShowAuthor:    true,
    songUppercase:     false,
    // US-13 : alignement du texte des chants (left, center, right)
    songTextAlign:     'center',
  },
};

// ─────────────────────────────────────────────────────────────
//  CANAL DE PROJECTION (BroadcastChannel — US-05)
// ─────────────────────────────────────────────────────────────
let projChannel;
try {
  projChannel = new BroadcastChannel('projection-channel');
} catch (_) {
  // Fallback si BroadcastChannel non supporté
  projChannel = { postMessage: () => {} };
}

// ─────────────────────────────────────────────────────────────
//  UTILITAIRES
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

/** Retourne une fonction "debounced" (retardée). */
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/** Formate un timestamp en date courte (fr-FR). */
function fmtDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

/**
 * Construit le ref unique d'un verset.
 * "Jean 3:16" → "Jean_3_16"  (espaces → underscores)
 */
function buildVerseRef(book, chapter, verse) {
  return `${book.replace(/ /g, '_')}_${chapter}_${verse}`;
}

/**
 * Parse un ref de verset vers ses composants.
 * "Jean_3_16" → { book: "Jean", chapter: "3", verse: "16" }
 * Fonctionne même pour des livres multi-mots : "1_Jean_3_16"
 */
function parseVerseRef(ref) {
  const parts   = ref.split('_');
  const verse   = parts.pop();
  const chapter = parts.pop();
  const book    = parts.join(' ');
  return { book, chapter, verse };
}

// ─────────────────────────────────────────────────────────────
//  TOAST (notification légère, non-bloquante)
// ─────────────────────────────────────────────────────────────
function showToast(msg, type = 'info', duration = 2400) {
  document.getElementById('_toast')?.remove();

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
  }, duration);
}

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
    navigator.serviceWorker.controller?.postMessage({ type: 'SKIP_WAITING' });
    window.location.href = window.location.href;
  }, { once: true });

  document.getElementById('btn-update-dismiss')?.addEventListener('click', () => {
    toast.classList.add('hidden');
  }, { once: true });
}

// ─────────────────────────────────────────────────────────────
//  ROUTING SPA (US-01)
// ─────────────────────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.tab));
  });

  document.getElementById('btn-open-projection')?.addEventListener('click', () => {
    window.open('./projection.html', 'bible-projection',
      'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no');
  });

  const params   = new URLSearchParams(location.search);
  const initTab  = params.get('tab') || 'bible';
  navigateTo(initTab, false);
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

  renderPanel(tab);
}

async function renderPanel(tab) {
  const main = document.getElementById('app');
  if (!main) return;

  main.innerHTML = `<div class="panel-loading" aria-busy="true">
    <div class="spinner" aria-label="Chargement…"></div>
  </div>`;

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
    main.innerHTML = `<div class="panel-error">
      <span class="panel-error-icon">⚠️</span>
      <p>Erreur : ${esc(err.message)}</p>
    </div>`;
  }
}

// ─────────────────────────────────────────────────────────────
//  HELPER : cache de refs favoris (optimisation US-06)
// ─────────────────────────────────────────────────────────────
async function getFavRefsSet() {
  const favs = await db.getAllFavorites();
  return new Set(favs.map((f) => f.ref));
}

// ═════════════════════════════════════════════════════════════
//  APERÇU PROJECTION (PIP)
// ═════════════════════════════════════════════════════════════

/**
 * Met à jour l'affichage du panneau PIP à partir d'un état de projection.
 * @param {Object} state - { mode, reference?, text?, title?, author?, strophes?, currentStrophe?, nom?, titre? }
 */
function updatePipPreview(state) {
  if (!App.pipEnabled) return;

  App.lastProjectionState = state;
  const container = document.getElementById('pip-content');
  if (!container) return;

  switch (state.mode) {
    case 'bible':
      container.innerHTML = `
        <div style="font-weight:bold; color:#f59e0b;">${escapeHtml(state.reference || '')}</div>
        <div style="margin-top:6px; font-size:0.75rem; line-height:1.4;">${escapeHtml(state.text || '')}</div>
      `;
      break;
    case 'song':
      let stropheText = '';
      if (state.strophes && Array.isArray(state.strophes) && state.currentStrophe !== undefined) {
        stropheText = state.strophes[state.currentStrophe] || '';
      } else if (state.lines) {
        // fallback si on reçoit lines/translations
        let tmp = '';
        for (let i = 0; i < state.lines.length; i++) {
          tmp += state.lines[i];
          if (state.translations?.[i]) tmp += '\n*' + state.translations[i];
          if (i < state.lines.length - 1) tmp += '\n';
        }
        stropheText = tmp;
      }
      container.innerHTML = `
        ${state.title ? `<div style="font-weight:bold; margin-bottom:4px;">${escapeHtml(state.title)}</div>` : ''}
        ${state.author ? `<div style="font-size:0.7rem; opacity:0.7;">${escapeHtml(state.author)}</div>` : ''}
        <div style="margin-top:6px; font-size:0.7rem; line-height:1.4;">${escapeHtml(stropheText.substring(0, 150))}${stropheText.length > 150 ? '…' : ''}</div>
      `;
      break;
    case 'person':
      container.innerHTML = `
        <div style="font-weight:bold;">${escapeHtml(state.nom || '')}</div>
        <div style="font-size:0.7rem;">${escapeHtml(state.titre || '')}</div>
      `;
      break;
    default: // blank
      container.innerHTML = '<div style="opacity:0.5;">Aucune projection</div>';
      break;
  }
}

/**
 * Active ou désactive l'aperçu flottant.
 * @param {boolean} enabled
 */
async function setPipEnabled(enabled) {
  App.pipEnabled = enabled;
  const pipEl = document.getElementById('pip-preview');
  if (pipEl) {
    pipEl.classList.toggle('pip-hidden', !enabled);
  }
  await db.saveSetting('pipEnabled', enabled);
  // Si on active, on rafraîchit avec le dernier état connu
  if (enabled && App.lastProjectionState) {
    updatePipPreview(App.lastProjectionState);
  }
}

// Helper d'échappement HTML pour le PIP (identique à esc mais évite collision)
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ═════════════════════════════════════════════════════════════
//  RECHERCHE AVANCÉE (US-12)
// ═════════════════════════════════════════════════════════════

/** Supprime les accents et met en minuscules. */
function stripAccents(str) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Distance de Levenshtein (matrice DP). */
function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = a[j-1] === b[i-1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i-1][j] + 1,
        matrix[i][j-1] + 1,
        matrix[i-1][j-1] + cost
      );
    }
  }
  return matrix[b.length][a.length];
}

/** Dictionnaire complet des 66 livres (nom canonique + abréviations + alias). */
const BIBLE_BOOKS = [
  { full: "Genèse",        abbr: ["Gn","Gen"],        aliases: ["genese","genesis"] },
  { full: "Exode",         abbr: ["Ex"],              aliases: ["exode","exodus","éxode"] },
  { full: "Lévitique",     abbr: ["Lv","Lev"],        aliases: ["levitique","leviticus"] },
  { full: "Nombres",       abbr: ["Nb","Nom"],        aliases: ["nombres","numbers"] },
  { full: "Deutéronome",   abbr: ["Dt","Deut"],       aliases: ["deuteronome","deuteronomy"] },
  { full: "Josué",         abbr: ["Jos"],             aliases: ["josue","joshua"] },
  { full: "Juges",         abbr: ["Jg","Jug"],        aliases: ["juges","judges"] },
  { full: "Ruth",          abbr: ["Rt","Ruth"],       aliases: [] },
  { full: "1 Samuel",      abbr: ["1S","1Sa"],        aliases: ["1samuel","premier samuel"] },
  { full: "2 Samuel",      abbr: ["2S","2Sa"],        aliases: ["2samuel","deuxieme samuel"] },
  { full: "1 Rois",        abbr: ["1R","1Rois"],      aliases: ["1rois","premier rois"] },
  { full: "2 Rois",        abbr: ["2R","2Rois"],      aliases: ["2rois","deuxieme rois"] },
  { full: "1 Chroniques",  abbr: ["1Ch","1Chr"],      aliases: ["1chroniques","premier chroniques"] },
  { full: "2 Chroniques",  abbr: ["2Ch","2Chr"],      aliases: ["2chroniques","deuxieme chroniques"] },
  { full: "Esdras",        abbr: ["Esd"],             aliases: [] },
  { full: "Néhémie",       abbr: ["Ne","Néh"],        aliases: ["nehemie","nehemiah"] },
  { full: "Esther",        abbr: ["Est"],             aliases: [] },
  { full: "Job",           abbr: ["Jb"],              aliases: [] },
  { full: "Psaumes",       abbr: ["Ps","Psaume"],     aliases: ["psaume","psalm"] },
  { full: "Proverbes",     abbr: ["Pr","Prov"],       aliases: ["proverbe","proverbs"] },
  { full: "Ecclésiaste",   abbr: ["Ec","Ecc"],        aliases: ["ecclesiaste","ecclesiastes"] },
  { full: "Cantique des Cantiques", abbr: ["Ct","Cant"], aliases: ["cantique"] },
  { full: "Ésaïe",         abbr: ["Es","És","Esa","Is"], aliases: ["esaie","isaie","isaiah","esaï"] },
  { full: "Jérémie",       abbr: ["Jr","Jer"],        aliases: ["jeremie","jeremiah"] },
  { full: "Lamentations",  abbr: ["La","Lam"],        aliases: [] },
  { full: "Ézéchiel",      abbr: ["Ez","Éz","Eze"],   aliases: ["ezechiel","ezekiel"] },
  { full: "Daniel",        abbr: ["Da","Dan"],        aliases: [] },
  { full: "Osée",          abbr: ["Os"],              aliases: ["osee","hosea"] },
  { full: "Joël",          abbr: ["Jl","Joel"],       aliases: [] },
  { full: "Amos",          abbr: ["Am"],              aliases: [] },
  { full: "Abdias",        abbr: ["Ab","Abd"],        aliases: [] },
  { full: "Jonas",         abbr: ["Jon"],             aliases: ["jonah"] },
  { full: "Michée",        abbr: ["Mi","Mic"],        aliases: ["michee","micah"] },
  { full: "Nahum",         abbr: ["Na"],              aliases: [] },
  { full: "Habacuc",       abbr: ["Ha","Hab"],        aliases: [] },
  { full: "Sophonie",      abbr: ["So","Sop"],        aliases: ["sophonie","zephaniah"] },
  { full: "Aggée",         abbr: ["Ag","Hag"],        aliases: ["aggee","haggai"] },
  { full: "Zacharie",      abbr: ["Za","Zac"],        aliases: ["zacharie","zechariah"] },
  { full: "Malachie",      abbr: ["Ml","Mal"],        aliases: [] },
  { full: "Matthieu",      abbr: ["Mt","Matt"],       aliases: ["matthew"] },
  { full: "Marc",          abbr: ["Mc","Mr"],         aliases: ["mark"] },
  { full: "Luc",           abbr: ["Lc","Lu"],         aliases: ["luke"] },
  { full: "Jean",          abbr: ["Jn"],              aliases: ["john"] },
  { full: "Actes",         abbr: ["Ac"],              aliases: ["acts"] },
  { full: "Romains",       abbr: ["Rm","Rom"],        aliases: ["romans"] },
  { full: "1 Corinthiens", abbr: ["1Co","1Cor"],      aliases: ["1corinthiens","premier corinthiens"] },
  { full: "2 Corinthiens", abbr: ["2Co","2Cor"],      aliases: ["2corinthiens","deuxieme corinthiens"] },
  { full: "Galates",       abbr: ["Ga","Gal"],        aliases: [] },
  { full: "Éphésiens",     abbr: ["Eph","Éph"],       aliases: ["ephesiens","ephe","ephesians"] },
  { full: "Philippiens",   abbr: ["Ph","Phil"],       aliases: ["philippians"] },
  { full: "Colossiens",    abbr: ["Col"],             aliases: [] },
  { full: "1 Thessaloniciens", abbr: ["1Th","1Thes"], aliases: ["1thessaloniciens","premier thessaloniciens"] },
  { full: "2 Thessaloniciens", abbr: ["2Th","2Thes"], aliases: ["2thessaloniciens","deuxieme thessaloniciens"] },
  { full: "1 Timothée",    abbr: ["1Ti","1Tim"],      aliases: ["1timothee","premier timothee"] },
  { full: "2 Timothée",    abbr: ["2Ti","2Tim"],      aliases: ["2timothee","deuxieme timothee"] },
  { full: "Tite",          abbr: ["Tt","Tit"],        aliases: [] },
  { full: "Philémon",      abbr: ["Phm","Philém"],    aliases: ["philemon"] },
  { full: "Hébreux",       abbr: ["He","Heb"],        aliases: ["hebrews"] },
  { full: "Jacques",       abbr: ["Jc","Jas"],        aliases: ["james"] },
  { full: "1 Pierre",      abbr: ["1P","1Pi"],        aliases: ["1pierre","premier pierre"] },
  { full: "2 Pierre",      abbr: ["2P","2Pi"],        aliases: ["2pierre","deuxieme pierre"] },
  { full: "1 Jean",        abbr: ["1Jn"],             aliases: ["1jean","premier jean"] },
  { full: "2 Jean",        abbr: ["2Jn"],             aliases: ["2jean","deuxieme jean"] },
  { full: "3 Jean",        abbr: ["3Jn"],             aliases: ["3jean","troisieme jean"] },
  { full: "Jude",          abbr: ["Jud"],             aliases: [] },
  { full: "Apocalypse",    abbr: ["Ap","Apo","Rev"],  aliases: ["revelation","apocalypse"] }
];

/**
 * Recherche un nom de livre dans BIBLE_BOOKS.
 * @param {string} input  chaîne normalisée (sans accents, minuscule)
 * @returns {{ book: string, confidence: number } | null}
 */
function matchBookName(input) {
  const norm = stripAccents(input).trim();
  if (!norm) return null;
  // 1. correspondance exacte sur abbréviation ou full ou alias
  for (const b of BIBLE_BOOKS) {
    const fullNorm = stripAccents(b.full);
    if (fullNorm === norm) return { book: b.full, confidence: 1 };
    for (const ab of b.abbr) {
      if (stripAccents(ab) === norm) return { book: b.full, confidence: 1 };
    }
    for (const al of b.aliases) {
      if (stripAccents(al) === norm) return { book: b.full, confidence: 1 };
    }
  }
  // 2. Levenshtein distance <= 2
  let best = null;
  let bestDist = Infinity;
  for (const b of BIBLE_BOOKS) {
    const fullNorm = stripAccents(b.full);
    const dist = levenshtein(norm, fullNorm);
    if (dist <= 2 && dist < bestDist) {
      bestDist = dist;
      best = { book: b.full, confidence: 1 - dist / Math.max(norm.length, fullNorm.length) };
    }
    for (const ab of b.abbr) {
      const abNorm = stripAccents(ab);
      const distAb = levenshtein(norm, abNorm);
      if (distAb <= 2 && distAb < bestDist) {
        bestDist = distAb;
        best = { book: b.full, confidence: 1 - distAb / Math.max(norm.length, abNorm.length) };
      }
    }
    for (const al of b.aliases) {
      const alNorm = stripAccents(al);
      const distAl = levenshtein(norm, alNorm);
      if (distAl <= 2 && distAl < bestDist) {
        bestDist = distAl;
        best = { book: b.full, confidence: 1 - distAl / Math.max(norm.length, alNorm.length) };
      }
    }
  }
  return best;
}

/**
 * Parse une chaîne de référence biblique (ex: "Jn 3:16", "Esaie 40:31", "1 Corinthiens 13").
 * @param {string} input
 * @returns {{ book: string, chapter: number, verse: number | null } | null}
 */
function parseRef(input) {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // regex capture : nom livre (lettres, chiffres, espaces) + chapitre + optionnel verset
  const match = trimmed.match(/^([\d\s]*[a-zA-ZÀ-ÿ]+(?:\s+[\d\w]+)?)\s+(\d+)\s*[:.,]\s*(\d+)?$/i);
  if (!match) return null;
  let bookPart = match[1].trim();
  const chapter = parseInt(match[2], 10);
  const verse = match[3] ? parseInt(match[3], 10) : null;
  const bookMatch = matchBookName(bookPart);
  if (!bookMatch) return null;
  return { book: bookMatch.book, chapter, verse };
}

/**
 * Recherche plein texte dans App.bibleData.
 * @param {string} query
 * @returns {Array<{ ref: string, text: string, book: string, chapter: number, verse: number }>}
 */
function searchFullText(query) {
  if (!query || query.length < 2 || !App.bibleData) return [];
  const q = stripAccents(query);
  const results = [];
  outer:
  for (const [book, chapters] of Object.entries(App.bibleData)) {
    for (const [ch, verses] of Object.entries(chapters)) {
      for (const [v, text] of Object.entries(verses)) {
        if (stripAccents(text).includes(q)) {
          results.push({
            ref: `${book} ${ch}:${v}`,
            text,
            book,
            chapter: parseInt(ch, 10),
            verse: parseInt(v, 10),
          });
          if (results.length >= 50) break outer;
        }
      }
    }
  }
  return results;
}

/**
 * Affiche les résultats de recherche (plein texte ou référence) dans le panneau.
 */
function displaySearchResults(results, mode) {
  const container = document.getElementById('bible-search-results');
  if (!container) return;
  if (!results || results.length === 0) {
    container.innerHTML = `<div class="search-empty">Aucun résultat trouvé</div>`;
    container.classList.remove('hidden');
    return;
  }
  if (mode === 'text') {
    container.innerHTML = `
      <div class="search-count">${results.length} résultat${results.length > 1 ? 's' : ''} (max 50)
        <button class="btn btn-sm btn-ghost search-close" aria-label="Fermer">✕</button>
      </div>
      ${results.map(r => {
        const highlighted = highlightText(r.text, document.getElementById('search-fulltext')?.value || '');
        return `
          <div class="search-result-card">
            <div class="search-result-ref">${esc(r.ref)}</div>
            <p class="search-result-text">${highlighted}</p>
            <button class="btn btn-sm btn-primary btn-sr-project"
                    data-text="${esc(r.text)}" data-ref="${esc(r.ref)}">🖥 Projeter</button>
          </div>`;
      }).join('')}
    `;
  } else { // mode référence
    container.innerHTML = `
      <div class="search-count">${results.length} résultat${results.length > 1 ? 's' : ''}
        <button class="btn btn-sm btn-ghost search-close" aria-label="Fermer">✕</button>
      </div>
      ${results.map(r => `
        <div class="search-result-card">
          <div class="search-result-ref">${esc(r.ref)}</div>
          <p class="search-result-text">${esc(r.text.substring(0, 150))}${r.text.length > 150 ? '…' : ''}</p>
          <button class="btn btn-sm btn-primary btn-sr-project"
                  data-text="${esc(r.text)}" data-ref="${esc(r.ref)}">🖥 Projeter</button>
        </div>
      `).join('')}
    `;
  }
  container.classList.remove('hidden');
  // Fermeture
  container.querySelector('.search-close')?.addEventListener('click', () => {
    container.classList.add('hidden');
    if (mode === 'text') {
      const input = document.getElementById('search-fulltext');
      if (input) input.value = '';
    } else {
      const input = document.getElementById('search-ref-input');
      if (input) input.value = '';
    }
  });
  // Événements projection
  container.querySelectorAll('.btn-sr-project').forEach(btn => {
    btn.addEventListener('click', () => projectVerse(btn.dataset.text, btn.dataset.ref));
  });
}

function highlightText(text, query) {
  if (!query || query.length < 2) return esc(text);
  const q = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${q})`, 'gi');
  return esc(text).replace(re, '<mark>$1</mark>');
}

// ─────────────────────────────────────────────────────────────
//  GESTIONNAIRES DE RECHERCHE
// ─────────────────────────────────────────────────────────────
let currentSearchMode = 'text';

function onSearchModeChange(mode) {
  currentSearchMode = mode;
  const textInput = document.getElementById('search-fulltext');
  const refInput = document.getElementById('search-ref-input');
  const resultsDiv = document.getElementById('bible-search-results');
  const suggestionsList = document.getElementById('book-suggestions');
  if (mode === 'text') {
    if (textInput) textInput.style.display = 'block';
    if (refInput) refInput.style.display = 'none';
    if (suggestionsList) suggestionsList.hidden = true;
    if (textInput) textInput.focus();
  } else {
    if (textInput) textInput.style.display = 'none';
    if (refInput) refInput.style.display = 'block';
    if (refInput) refInput.focus();
    if (suggestionsList) suggestionsList.hidden = true;
  }
  if (resultsDiv) resultsDiv.classList.add('hidden');
}

async function handleFullTextSearch() {
  const input = document.getElementById('search-fulltext');
  const query = input?.value?.trim() ?? '';
  if (query.length < 2) {
    document.getElementById('bible-search-results')?.classList.add('hidden');
    return;
  }
  const results = searchFullText(query);
  displaySearchResults(results, 'text');
}

async function handleRefSearch() {
  const input = document.getElementById('search-ref-input');
  const raw = input?.value?.trim() ?? '';
  const resultsDiv = document.getElementById('bible-search-results');
  const suggestionsList = document.getElementById('book-suggestions');
  if (raw.length < 2) {
    if (resultsDiv) resultsDiv.classList.add('hidden');
    if (suggestionsList) suggestionsList.hidden = true;
    return;
  }
  // Suggestions : recherche de livre approximative
  const norm = stripAccents(raw);
  const suggestions = [];
  for (const b of BIBLE_BOOKS) {
    const fullNorm = stripAccents(b.full);
    if (fullNorm.startsWith(norm) || levenshtein(norm, fullNorm) <= 2) {
      suggestions.push(b.full);
      if (suggestions.length >= 5) break;
    } else {
      for (const ab of b.abbr) {
        const abNorm = stripAccents(ab);
        if (abNorm.startsWith(norm) || levenshtein(norm, abNorm) <= 2) {
          suggestions.push(b.full);
          break;
        }
      }
      if (suggestions.length >= 5) break;
    }
  }
  if (suggestions.length > 0) {
    suggestionsList.innerHTML = suggestions.map(s => `<li class="suggestion-item" data-book="${esc(s)}">${esc(s)}</li>`).join('');
    suggestionsList.hidden = false;
    suggestionsList.querySelectorAll('.suggestion-item').forEach(li => {
      li.addEventListener('click', () => {
        if (input) input.value = li.dataset.book + ' ';
        suggestionsList.hidden = true;
        handleRefSearch(); // relance la recherche
      });
    });
  } else {
    suggestionsList.hidden = true;
  }
  // tentative de parsing complet
  const parsed = parseRef(raw);
  if (parsed && App.bibleData && App.bibleData[parsed.book] && App.bibleData[parsed.book][parsed.chapter]) {
    let verseText = '';
    if (parsed.verse && App.bibleData[parsed.book][parsed.chapter][parsed.verse]) {
      verseText = App.bibleData[parsed.book][parsed.chapter][parsed.verse];
      displaySearchResults([{ ref: `${parsed.book} ${parsed.chapter}:${parsed.verse}`, text: verseText, book: parsed.book, chapter: parsed.chapter, verse: parsed.verse }], 'ref');
    } else if (!parsed.verse) {
      // afficher tout le chapitre ?
      const verses = App.bibleData[parsed.book][parsed.chapter];
      const results = Object.entries(verses).map(([v, txt]) => ({
        ref: `${parsed.book} ${parsed.chapter}:${v}`,
        text: txt,
        book: parsed.book,
        chapter: parsed.chapter,
        verse: parseInt(v, 10)
      }));
      displaySearchResults(results, 'ref');
    } else {
      displaySearchResults([], 'ref');
    }
  } else if (parsed) {
    displaySearchResults([], 'ref');
  } else {
    // pas de parsing valide, on cache les résultats
    if (resultsDiv) resultsDiv.classList.add('hidden');
  }
}

// ═════════════════════════════════════════════════════════════
//  PANNEAU BIBLE (US-03 + ★ US-06 + US-12)
// ═════════════════════════════════════════════════════════════
async function renderBiblePanel(container) {
  const bibleNames  = await db.getAllBibleNames();
  const savedBible  = await db.getSetting('currentBible');
  const activeBible = savedBible || bibleNames[0] || null;

  if (bibleNames.length === 0) {
    container.innerHTML = `
      <div class="panel panel-bible">
        <div class="empty-state">
          <div class="empty-state-icon">📚</div>
          <h2>Aucune Bible chargée</h2>
          <p>Importez un fichier JSON dans <strong>Paramètres</strong>.</p>
          <button class="btn btn-primary" id="go-settings">⚙️ Aller aux Paramètres</button>
        </div>
      </div>`;
    document.getElementById('go-settings')?.addEventListener('click', () => navigateTo('settings'));
    return;
  }

  container.innerHTML = `
    <div class="panel panel-bible" id="panel-bible">
      <div class="bible-toolbar">
        <select id="bible-version-select" class="field-select" aria-label="Choisir une version de la Bible">
          ${bibleNames.map((n) => `<option value="${esc(n)}" ${n === activeBible ? 'selected' : ''}>${esc(n)}</option>`).join('')}
        </select>
        <!-- Barre de recherche avancée (US-12) -->
        <div class="advanced-search-bar">
          <div class="search-mode-toggle">
            <button id="btn-search-text" class="btn btn-sm ${currentSearchMode === 'text' ? 'btn-primary' : 'btn-ghost'}">📖 Texte</button>
            <button id="btn-search-ref" class="btn btn-sm ${currentSearchMode === 'ref' ? 'btn-primary' : 'btn-ghost'}">🔍 Référence</button>
          </div>
          <div class="search-input-group">
            <input type="search" id="search-fulltext" class="bible-search-input" placeholder="🔍 Mots-clés…" ${currentSearchMode === 'text' ? '' : 'style="display:none"'}>
            <input type="text" id="search-ref-input" class="bible-search-input" placeholder="Ex: Jn 3:16, Esaie 40:31…" ${currentSearchMode === 'ref' ? '' : 'style="display:none"'}>
            <ul id="book-suggestions" class="suggestions-list" hidden></ul>
          </div>
        </div>
      </div>

      <div class="bible-nav-grid" role="navigation" aria-label="Navigation biblique">
        <div class="bible-nav-col">
          <div class="bible-nav-col-header">📖 Livres</div>
          <div class="bible-nav-col-body" id="books-list">
            <div class="spinner-sm"></div>
          </div>
        </div>
        <div class="bible-nav-col">
          <div class="bible-nav-col-header">📑 Chapitres</div>
          <div class="bible-nav-col-body" id="chapters-list"></div>
        </div>
        <div class="bible-nav-col bible-nav-col--verses">
          <div class="bible-nav-col-header">📝 Versets</div>
          <div class="bible-nav-col-body" id="verses-list"></div>
        </div>
      </div>

      <div id="bible-search-results" class="bible-search-results hidden" aria-live="polite"></div>
    </div>`;

  await loadBibleVersion(activeBible);

  document.getElementById('bible-version-select')?.addEventListener('change', async (e) => {
    await db.saveSetting('currentBible', e.target.value);
    await loadBibleVersion(e.target.value);
  });

  // Gestionnaires recherche avancée
  const btnText = document.getElementById('btn-search-text');
  const btnRef = document.getElementById('btn-search-ref');
  const inputText = document.getElementById('search-fulltext');
  const inputRef = document.getElementById('search-ref-input');
  const suggestions = document.getElementById('book-suggestions');

  if (btnText && btnRef) {
    btnText.addEventListener('click', () => {
      currentSearchMode = 'text';
      btnText.classList.add('btn-primary');
      btnText.classList.remove('btn-ghost');
      btnRef.classList.add('btn-ghost');
      btnRef.classList.remove('btn-primary');
      if (inputText) inputText.style.display = 'block';
      if (inputRef) inputRef.style.display = 'none';
      if (suggestions) suggestions.hidden = true;
      if (inputText) inputText.focus();
      document.getElementById('bible-search-results')?.classList.add('hidden');
    });
    btnRef.addEventListener('click', () => {
      currentSearchMode = 'ref';
      btnRef.classList.add('btn-primary');
      btnRef.classList.remove('btn-ghost');
      btnText.classList.add('btn-ghost');
      btnText.classList.remove('btn-primary');
      if (inputRef) inputRef.style.display = 'block';
      if (inputText) inputText.style.display = 'none';
      if (suggestions) suggestions.hidden = true;
      if (inputRef) inputRef.focus();
      document.getElementById('bible-search-results')?.classList.add('hidden');
    });
  }

  if (inputText) {
    inputText.addEventListener('input', debounce(() => handleFullTextSearch(), 300));
  }
  if (inputRef) {
    inputRef.addEventListener('input', debounce(() => handleRefSearch(), 300));
    inputRef.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        suggestions.hidden = true;
        inputRef.value = '';
        document.getElementById('bible-search-results')?.classList.add('hidden');
      }
    });
  }
}

async function loadBibleVersion(name) {
  if (!name) return;
  App.settings.currentBible = name;

  const data = await db.getBible(name);
  if (!data) return;

  App.bibleData           = data;
  App.settings.currentBook    = null;
  App.settings.currentChapter = null;

  renderBooksGrid(Object.keys(data));
}

function renderBooksGrid(books) {
  const list = document.getElementById('books-list');
  if (!list) return;

  list.innerHTML = books.map((book) => `
    <button class="nav-item nav-item--book" data-book="${esc(book)}"
            title="${esc(book)}" aria-label="Livre ${esc(book)}">
      ${esc(book.length > 7 ? book.substring(0, 6) + '…' : book)}
    </button>`).join('');

  list.querySelectorAll('.nav-item--book').forEach((btn) => {
    btn.addEventListener('click', () => {
      list.querySelectorAll('.nav-item--book').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      App.settings.currentBook    = btn.dataset.book;
      App.settings.currentChapter = null;
      renderChaptersGrid(btn.dataset.book);
    });
  });

  list.querySelector('.nav-item--book')?.click(); // auto-sélection
}

function renderChaptersGrid(book) {
  const list = document.getElementById('chapters-list');
  if (!list || !App.bibleData?.[book]) return;

  const chapters = Object.keys(App.bibleData[book]);
  list.innerHTML  = chapters.map((ch) => `
    <button class="nav-item nav-item--chapter" data-chapter="${esc(ch)}"
            aria-label="Chapitre ${ch}">${ch}</button>`).join('');

  list.querySelectorAll('.nav-item--chapter').forEach((btn) => {
    btn.addEventListener('click', () => {
      list.querySelectorAll('.nav-item--chapter').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      App.settings.currentChapter = btn.dataset.chapter;
      renderVersesList(book, btn.dataset.chapter);
    });
  });

  list.querySelector('.nav-item--chapter')?.click();
}

async function renderVersesList(book, chapter) {
  const list = document.getElementById('verses-list');
  if (!list) return;

  const verses = App.bibleData?.[book]?.[chapter];
  if (!verses) { list.innerHTML = ''; return; }

  list.innerHTML = '<div class="spinner-sm"></div>';

  const favRefs   = await getFavRefsSet();
  const verseNums = Object.keys(verses);

  list.innerHTML = verseNums.map((num) => {
    const ref    = buildVerseRef(book, chapter, num);
    const isFav  = favRefs.has(ref);
    return `
      <div class="verse-card" data-ref="${esc(ref)}">
        <div class="verse-card-header">
          <span class="verse-num">${num}</span>
          <button class="btn-star ${isFav ? 'starred' : ''}"
                  data-ref="${esc(ref)}" data-type="verse"
                  data-book="${esc(book)}" data-chapter="${esc(chapter)}" data-verse="${esc(num)}"
                  aria-label="${isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}"
                  aria-pressed="${isFav}">
            ${isFav ? '★' : '☆'}
          </button>
        </div>
        <p class="verse-text">${esc(verses[num])}</p>
        <div class="verse-actions">
          <button class="btn btn-sm btn-primary btn-verse-project"
                  data-book="${esc(book)}" data-chapter="${esc(chapter)}"
                  data-verse="${esc(num)}" data-text="${esc(verses[num])}">
            🖥 Projeter
          </button>
        </div>
      </div>`;
  }).join('');

  list.querySelectorAll('.btn-star').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleVerseFavorite(btn, verses);
    });
  });

  list.querySelectorAll('.btn-verse-project').forEach((btn) => {
    btn.addEventListener('click', () => {
      const refStr = `${btn.dataset.book} ${btn.dataset.chapter}:${btn.dataset.verse}`;
      projectVerse(btn.dataset.text, refStr);
    });
  });
}

async function toggleVerseFavorite(btn, verses) {
  const { ref, book, chapter, verse } = btn.dataset;
  const wasStarred = btn.classList.contains('starred');

  if (wasStarred) {
    await db.removeFavorite(ref);
    btn.classList.remove('starred');
    btn.textContent = '☆';
    btn.setAttribute('aria-label', 'Ajouter aux favoris');
    btn.setAttribute('aria-pressed', 'false');
  } else {
    await db.addFavorite({
      type:    'verse',
      ref,
      label:   '',
      title:   `${book} ${chapter}:${verse}`,
      content: verses?.[verse] ?? '',
    });
    btn.classList.add('starred');
    btn.textContent = '★';
    btn.setAttribute('aria-label', 'Retirer des favoris');
    btn.setAttribute('aria-pressed', 'true');
    showToast('★ Ajouté aux favoris', 'success');
  }
}

function projectVerse(text, refStr) {
  App.lastBibleRef = refStr;
  App.lastBibleText = text;

  safePostMessage({
    type: 'show-verse',
    data: {
      reference: refStr,
      text,
      style: {
        ltType:         App.settings.ltType,
        refColor:       App.settings.ltRefColor,
        verseColor:     App.settings.ltVerseColor,
        fontFamily:     App.settings.ltFontFamily,
        width:          App.settings.ltWidth,
        height:         App.settings.ltHeight,
        refFontSize:    App.settings.ltRefFontSize,
        verseFontSize:  App.settings.ltVerseFontSize,
      },
    },
  });

  // Mise à jour de l'aperçu PIP
  updatePipPreview({
    mode: 'bible',
    reference: refStr,
    text: text,
  });

  showToast(`📖 ${refStr} projeté`, 'success');
}

// Sécurisation des envois BroadcastChannel
function safePostMessage(msg) {
  try {
    projChannel.postMessage(msg);
  } catch (e) {
    console.warn('[BroadcastChannel] Échec envoi message', e);
  }
}

// Les anciennes fonctions handleBibleSearch sont remplacées, mais conservées pour compatibilité (non utilisées)
async function handleBibleSearch() {
  // déprécié – remplacé par handleFullTextSearch
}

// ═════════════════════════════════════════════════════════════
//  PANNEAU FAVORIS (US-06)
// ═════════════════════════════════════════════════════════════
async function renderFavoritesPanel(container) {
  const allFavs = await db.getAllFavorites();
  const labels  = [...new Set(allFavs.map((f) => f.label).filter(Boolean))].sort();
  const activeLabel = new URLSearchParams(location.search).get('label') ?? '';

  container.innerHTML = `
    <div class="panel panel-favorites" id="panel-favorites">
      <div class="favorites-toolbar">
        <input type="search" id="fav-search" class="fav-search-input"
               placeholder="🔍 Rechercher…" aria-label="Rechercher dans les favoris">
        <div class="favorites-toolbar-right">
          <select id="fav-label-filter" class="fav-label-select" aria-label="Filtrer par étiquette">
            <option value="">🏷 Toutes</option>
            ${labels.map((l) => `<option value="${esc(l)}" ${l === activeLabel ? 'selected' : ''}>${esc(l)}</option>`).join('')}
          </select>
          <button class="btn btn-sm btn-ghost" id="btn-fav-export" aria-label="Exporter les favoris JSON">
            ⬇ Export
          </button>
        </div>
      </div>

      <div id="fav-list" class="fav-list" aria-live="polite">
        ${buildFavCards(allFavs, activeLabel)}
      </div>
    </div>`;

  document.getElementById('fav-search')?.addEventListener(
    'input', debounce(refreshFavList, 200),
  );

  document.getElementById('fav-label-filter')?.addEventListener('change', (e) => {
    const label = e.target.value;
    const url   = new URL(location.href);
    label ? url.searchParams.set('label', label) : url.searchParams.delete('label');
    history.replaceState({ tab: 'favorites', label }, '', url.toString());
    refreshFavList();
  });

  document.getElementById('btn-fav-export')?.addEventListener('click', async () => {
    const json = await db.exportFavoritesJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `favorites_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('⬇ Export téléchargé', 'success');
  });

  bindFavCards();
}

function buildFavCards(favorites, labelFilter = '', searchQuery = '') {
  let items = favorites;

  if (labelFilter) items = items.filter((f) => f.label === labelFilter);

  if (searchQuery) {
    const q = searchQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    items = items.filter((f) => {
      const t = (f.title   ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const c = (f.content ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return t.includes(q) || c.includes(q);
    });
  }

  if (items.length === 0) {
    return `<div class="fav-empty">
      <span class="fav-empty-icon">☆</span>
      <h3>Aucun favori${labelFilter ? ` pour « ${esc(labelFilter)} »` : ''}</h3>
      <p>${labelFilter || searchQuery
        ? 'Essayez un autre filtre ou effacez la recherche.'
        : 'Marquez des versets ★ dans l\'onglet Bible ou des chants dans l\'onglet Chants.'
      }</p>
    </div>`;
  }

  return items.map((fav) => `
    <div class="fav-card" data-ref="${esc(fav.ref)}" data-id="${fav.id}" data-type="${fav.type}">
      <div class="fav-card-header">
        <span class="fav-type-badge fav-type-badge--${fav.type}">
          ${fav.type === 'verse' ? '📖 Verset' : '🎵 Chant'}
        </span>
        <span class="fav-date">${fmtDate(fav.createdAt)}</span>
      </div>
      <div class="fav-card-body">
        <div class="fav-title">${esc(fav.title ?? '')}</div>
        <div class="fav-content">${esc((fav.content ?? '').substring(0, 130))}${(fav.content ?? '').length > 130 ? '…' : ''}</div>
      </div>
      <div class="fav-label-zone" id="fav-label-zone-${fav.id}">
        ${fav.label
          ? `<button class="fav-label-badge btn-filter-label" data-label="${esc(fav.label)}"
                     aria-label="Filtrer par ${esc(fav.label)}">🏷 ${esc(fav.label)}</button>`
          : '<span class="fav-no-label">Sans étiquette</span>'
        }
      </div>
      <div class="fav-card-actions">
        <button class="btn btn-sm btn-primary btn-fav-project"
                data-ref="${esc(fav.ref)}" data-type="${fav.type}" data-title="${esc(fav.title ?? '')}"
                aria-label="Projeter ${esc(fav.title ?? '')}">🖥 Projeter</button>
        <button class="btn btn-sm btn-ghost btn-fav-label"
                data-id="${fav.id}" data-ref="${esc(fav.ref)}"
                data-current-label="${esc(fav.label ?? '')}"
                aria-label="Modifier l'étiquette">✏ Étiquette</button>
        <button class="btn btn-sm btn-ghost btn-fav-delete"
                data-ref="${esc(fav.ref)}"
                style="color:var(--danger)" aria-label="Supprimer ce favori">🗑</button>
      </div>
    </div>`).join('');
}

async function refreshFavList() {
  const allFavs = await db.getAllFavorites();
  const search  = document.getElementById('fav-search')?.value?.trim()  ?? '';
  const label   = document.getElementById('fav-label-filter')?.value    ?? '';
  const list    = document.getElementById('fav-list');
  if (!list) return;
  list.innerHTML = buildFavCards(allFavs, label, search);
  bindFavCards();
  rebuildLabelFilter(allFavs, label);
}

function rebuildLabelFilter(favorites, currentVal = '') {
  const sel = document.getElementById('fav-label-filter');
  if (!sel) return;
  const labels = [...new Set(favorites.map((f) => f.label).filter(Boolean))].sort();
  sel.innerHTML = `<option value="">🏷 Toutes</option>
    ${labels.map((l) => `<option value="${esc(l)}" ${l === currentVal ? 'selected' : ''}>${esc(l)}</option>`).join('')}`;
}

function bindFavCards() {
  document.querySelectorAll('.btn-fav-project').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const { ref, type, title } = btn.dataset;

      if (type === 'verse') {
        const { book, chapter, verse } = parseVerseRef(ref);
        const text = App.bibleData?.[book]?.[chapter]?.[verse] ?? '';
        projectVerse(text, title || `${book} ${chapter}:${verse}`);
      } else {
        const songId = Number(ref.replace('song_', ''));
        const song = await db.getSong(songId);
        if (song?.strophes?.length > 0) {
          const allStrophesTexts = song.strophes.map(st => reconstructText([st]));
          safePostMessage({
            type: 'show-song',
            data: {
              title:        song.title ?? '',
              author:       song.author ?? '',
              lines:        song.strophes[0].lines ?? [],
              translations: song.strophes[0].translations ?? [],
              strophes:     allStrophesTexts,
              currentIndex: 0,
              showTitle:    App.settings.songShowTitle,
              showAuthor:   App.settings.songShowAuthor,
              settings: {
                bgColor:     App.settings.songBgColor,
                textColor:   App.settings.songTextColor,
                fontFamily:  App.settings.songFontFamily,
                fontSize:    App.settings.songFontSize,
                showTitle:   App.settings.songShowTitle,
                showAuthor:  App.settings.songShowAuthor,
                uppercase:   App.settings.songUppercase,
                textAlign:   App.settings.songTextAlign, // US-13
              },
            },
          });
          updatePipPreview({
            mode: 'song',
            title: song.title,
            author: song.author,
            strophes: allStrophesTexts,
            currentStrophe: 0,
          });
          showToast(`🎵 ${esc(song.title)} projeté`, 'success');
        } else {
          showToast('⚠ Aucune strophe à projeter', 'warning');
        }
      }
    });
  });

  document.querySelectorAll('.btn-filter-label').forEach((badge) => {
    badge.addEventListener('click', () => {
      const label = badge.dataset.label;
      const sel = document.getElementById('fav-label-filter');
      if (sel) {
        sel.value = label;
        sel.dispatchEvent(new Event('change'));
      }
    });
  });

  document.querySelectorAll('.btn-fav-label').forEach((btn) => {
    btn.addEventListener('click', () => {
      const { id, ref } = btn.dataset;
      const zone = document.getElementById(`fav-label-zone-${id}`);
      if (!zone || zone.dataset.editing) return;
      zone.dataset.editing = '1';

      const current = btn.dataset.currentLabel ?? '';
      zone.innerHTML = `
        <div class="fav-label-edit">
          <input type="text" id="fav-label-input-${id}" class="fav-label-input"
                 value="${esc(current)}" placeholder="Ex: Culte du dimanche"
                 aria-label="Nouvelle étiquette" maxlength="60">
          <button class="btn btn-sm btn-primary btn-label-ok" aria-label="Valider">✓</button>
          <button class="btn btn-sm btn-ghost btn-label-cancel" aria-label="Annuler">✗</button>
        </div>`;

      const input = document.getElementById(`fav-label-input-${id}`);
      input?.focus();

      const doSave = async () => {
        const newLabel = input?.value?.trim() ?? '';
        await db.updateFavoriteLabel(ref, newLabel);
        showToast('🏷 Étiquette mise à jour', 'success');
        delete zone.dataset.editing;
        await refreshFavList();
      };

      const doCancel = () => {
        delete zone.dataset.editing;
        refreshFavList();
      };

      zone.querySelector('.btn-label-ok')?.addEventListener('click', doSave);
      zone.querySelector('.btn-label-cancel')?.addEventListener('click', doCancel);
      input?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter')  { e.preventDefault(); doSave(); }
        if (e.key === 'Escape') { e.preventDefault(); doCancel(); }
      });
    });
  });

  document.querySelectorAll('.btn-fav-delete').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const card = btn.closest('.fav-card');
      if (!card) return;
      if (card.querySelector('.fav-delete-confirm')) return;

      const confirm = document.createElement('div');
      confirm.className = 'fav-delete-confirm';
      confirm.innerHTML = `
        <span>Supprimer ce favori ?</span>
        <button class="btn btn-sm btn-danger btn-del-yes" data-ref="${esc(btn.dataset.ref)}">Oui</button>
        <button class="btn btn-sm btn-ghost btn-del-no">Non</button>`;
      card.appendChild(confirm);

      confirm.querySelector('.btn-del-yes')?.addEventListener('click', async () => {
        await db.removeFavorite(btn.dataset.ref);
        card.style.cssText = 'opacity:0;transform:translateX(12px);transition:all .2s';
        setTimeout(async () => {
          card.remove();
          showToast('🗑 Favori supprimé', 'info');
          const remaining = await db.getAllFavorites();
          const label = document.getElementById('fav-label-filter')?.value ?? '';
          rebuildLabelFilter(remaining, label);
        }, 200);
      });

      confirm.querySelector('.btn-del-no')?.addEventListener('click', () => confirm.remove());
    });
  });
}

// ═════════════════════════════════════════════════════════════
//  PANNEAU CHANTS (US-04 + ★ US-06 + US-08 + US-13)
// ═════════════════════════════════════════════════════════════

let _songsFilterQuery = '';

async function refreshSongsList() {
  const allSongs = await db.getAllSongs();
  let filtered = allSongs;
  if (_songsFilterQuery.trim() !== '') {
    const q = _songsFilterQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    filtered = allSongs.filter(s => {
      const title = (s.title || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const author = (s.author || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return title.includes(q) || author.includes(q);
    });
  }
  const favRefs = await getFavRefsSet();
  filtered.forEach(s => { s._isFav = favRefs.has(`song_${s.id}`); });
  const container = document.getElementById('songs-list-body');
  if (container) {
    container.innerHTML = renderSongCards(filtered);
    bindSongCards();
  }
  const titleSpan = document.querySelector('#panel-songs .songs-list-title');
  if (titleSpan) titleSpan.textContent = `🎵 Chants (${filtered.length})`;
}

async function renderSongsPanel(container) {
  const songs   = await db.getAllSongs();
  const favRefs = await getFavRefsSet();

  songs.forEach((s) => { s._isFav = favRefs.has(`song_${s.id}`); });

  _songsFilterQuery = '';

  container.innerHTML = `
    <div class="panel panel-songs" id="panel-songs">
      <div class="songs-list-col">
        <div class="songs-list-header">
          <span class="songs-list-title">🎵 Chants (${songs.length})</span>
          <button class="btn btn-sm btn-primary" id="btn-new-song" aria-label="Nouveau chant">＋</button>
        </div>
        <div style="padding: 0 8px 8px 8px;">
          <input type="search" id="songs-search-input" class="field-input" 
                 placeholder="🔍 Rechercher par titre ou auteur..." 
                 aria-label="Filtrer les chants" style="width:100%;">
        </div>
        <div id="new-song-form-slot"></div>
        <div class="songs-list-body" id="songs-list-body">
          ${renderSongCards(songs)}
        </div>
      </div>
      <div class="songs-editor-col" id="songs-editor-col">
        <div class="songs-editor-empty">
          <span>🎶</span>
          <p>Sélectionnez un chant pour l'éditer</p>
        </div>
      </div>
    </div>`;

  const searchInput = document.getElementById('songs-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      _songsFilterQuery = e.target.value;
      refreshSongsList();
    });
  }

  bindSongCards();
  document.getElementById('btn-new-song')?.addEventListener('click', showNewSongForm);
}

function renderSongCards(songs) {
  if (songs.length === 0) {
    return `<div class="songs-empty">Aucun chant. Appuyez sur <strong>＋</strong> pour commencer.</div>`;
  }
  return songs.map((s) => `
    <div class="song-card ${App.currentSong?.id === s.id ? 'active' : ''}"
         data-id="${s.id}" tabindex="0" role="button"
         aria-label="${esc(s.title ?? 'Sans titre')}" aria-selected="${App.currentSong?.id === s.id}">
      <div class="song-card-info">
        <div class="song-card-title">${esc(s.title ?? 'Sans titre')}</div>
        <div class="song-card-author">${esc(s.author ?? '')}</div>
        <div class="song-card-meta">${(s.strophes ?? []).length} strophe${(s.strophes ?? []).length !== 1 ? 's' : ''}</div>
      </div>
      <button class="btn-star ${s._isFav ? 'starred' : ''}"
              data-ref="song_${s.id}" data-song-id="${s.id}"
              aria-label="${s._isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}"
              aria-pressed="${!!s._isFav}">
        ${s._isFav ? '★' : '☆'}
      </button>
    </div>`).join('');
}

function bindSongCards() {
  document.querySelectorAll('.song-card').forEach((card) => {
    card.addEventListener('click', async (e) => {
      if (e.target.closest('.btn-star')) return;
      const song = await db.getSong(Number(card.dataset.id));
      if (!song) return;
      document.querySelectorAll('.song-card').forEach((c) => {
        c.classList.remove('active');
        c.setAttribute('aria-selected', 'false');
      });
      card.classList.add('active');
      card.setAttribute('aria-selected', 'true');
      renderSongEditor(song);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); }
    });
  });

  document.querySelectorAll('.song-card .btn-star').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const songId = Number(btn.dataset.songId);
      const song   = await db.getSong(songId);
      if (!song) return;

      const ref = `song_${songId}`;
      const wasStarred = btn.classList.contains('starred');

      if (wasStarred) {
        await db.removeFavorite(ref);
        btn.classList.remove('starred');
        btn.textContent = '☆';
        btn.setAttribute('aria-pressed', 'false');
        btn.setAttribute('aria-label', 'Ajouter aux favoris');
      } else {
        const preview = (song.strophes?.[0]?.lines ?? song.lyrics ?? []).join(' ');
        await db.addFavorite({
          type:    'song',
          ref,
          label:   '',
          title:   song.title ?? 'Sans titre',
          content: preview.substring(0, 200),
        });
        btn.classList.add('starred');
        btn.textContent = '★';
        btn.setAttribute('aria-pressed', 'true');
        btn.setAttribute('aria-label', 'Retirer des favoris');
        showToast('★ Ajouté aux favoris', 'success');
      }
    });
  });
}

function showNewSongForm() {
  const slot = document.getElementById('new-song-form-slot');
  if (!slot || slot.children.length > 0) return;

  slot.innerHTML = `
    <div class="new-song-form">
      <input type="text" id="new-song-title-input" class="field-input"
             placeholder="Titre du chant…" aria-label="Titre du nouveau chant" maxlength="80">
      <div class="new-song-form-btns">
        <button class="btn btn-sm btn-primary" id="new-song-ok" aria-label="Créer">✓</button>
        <button class="btn btn-sm btn-ghost" id="new-song-cancel" aria-label="Annuler">✗</button>
      </div>
    </div>`;

  const input = document.getElementById('new-song-title-input');
  input?.focus();

  document.getElementById('new-song-ok')?.addEventListener('click', async () => {
    const title = input?.value?.trim();
    if (!title) { showToast('⚠ Saisissez un titre', 'warning'); return; }
    slot.innerHTML = '';
    const id = await db.saveSong({ title, author: '', strophes: [], lyrics: [], translation: [] });
    const song = await db.getSong(id);
    await refreshSongsList();
    if (song) {
      document.querySelector(`.song-card[data-id="${id}"]`)?.click();
    }
    showToast('✅ Chant créé', 'success');
  });

  document.getElementById('new-song-cancel')?.addEventListener('click', () => {
    slot.innerHTML = '';
  });

  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  document.getElementById('new-song-ok')?.click();
    if (e.key === 'Escape') document.getElementById('new-song-cancel')?.click();
  });
}

function parseStrophes(text) {
  if (!text?.trim()) return [];
  const result = [];
  for (const block of text.split(/\n\s*\n/)) {
    const lines = [], trans = [];
    for (const line of block.split('\n')) {
      const l = line.trimEnd();
      if (!l) continue;
      if (l.startsWith('*')) { trans.push(l.slice(1).trimStart()); }
      else                   { lines.push(l); trans.push(''); }
    }
    if (lines.length > 0) {
      result.push({ lines, translations: trans.slice(0, lines.length) });
    }
  }
  return result;
}

function reconstructText(strophes) {
  return (strophes ?? []).map((s) => {
    const out = [];
    (s.lines ?? []).forEach((line, i) => {
      out.push(line);
      if (s.translations?.[i]) out.push('*' + s.translations[i]);
    });
    return out.join('\n');
  }).join('\n\n');
}

function renderSongEditor(song) {
  App.currentSong      = song;
  App.currentStropheIdx = 0;

  const col = document.getElementById('songs-editor-col');
  if (!col) return;

  const text  = reconstructText(song.strophes ?? []);
  const total = (song.strophes ?? []).length;

  // US-13 : ajout des boutons d'alignement
  const currentAlign = App.settings.songTextAlign || 'center';
  const alignButtons = `
    <div class="song-align-buttons" style="display: flex; gap: 8px; margin: 10px 0;">
      <button class="btn btn-sm ${currentAlign === 'left' ? 'btn-primary' : 'btn-ghost'}" data-align="left" title="Aligner à gauche">⇤ Gauche</button>
      <button class="btn btn-sm ${currentAlign === 'center' ? 'btn-primary' : 'btn-ghost'}" data-align="center" title="Centrer">≡ Centre</button>
      <button class="btn btn-sm ${currentAlign === 'right' ? 'btn-primary' : 'btn-ghost'}" data-align="right" title="Aligner à droite">Droite ⇥</button>
    </div>
  `;

  col.innerHTML = `
    <div class="song-editor">
      <div class="song-editor-meta">
        <input type="text" id="song-title-inp" class="song-meta-field"
               value="${esc(song.title ?? '')}" placeholder="Titre" aria-label="Titre">
        <input type="text" id="song-author-inp" class="song-meta-field"
               value="${esc(song.author ?? '')}" placeholder="Auteur" aria-label="Auteur">
      </div>

      ${alignButtons}

      <div class="song-editor-body">
        <div class="song-lyrics-zone">
          <label class="field-label" for="song-lyrics-ta">
            Paroles — ligne normale = original, <code>*ligne</code> = traduction
          </label>
          <textarea id="song-lyrics-ta" class="song-lyrics-ta"
                    aria-label="Paroles">${esc(text)}</textarea>
          <div class="strophe-count" id="strophe-count">
            ${total} strophe${total !== 1 ? 's' : ''} détectée${total !== 1 ? 's' : ''}
          </div>
        </div>

        <div class="song-slides-zone">
          <div class="slides-nav">
            <button class="btn btn-sm btn-ghost" id="slide-prev" aria-label="Strophe précédente">◀</button>
            <span class="slide-indicator" id="slide-indicator" aria-live="polite">
              ${total > 0 ? '1 / ' + total : '—'}
            </span>
            <button class="btn btn-sm btn-ghost" id="slide-next" aria-label="Strophe suivante">▶</button>
          </div>
          <div class="slide-preview" id="slide-preview" aria-live="polite">
            ${renderSlidePreview(song.strophes ?? [], 0)}
          </div>
          <button class="btn btn-primary btn-project-slide" id="btn-project-slide">
            🖥 Projeter cette strophe
          </button>
        </div>
      </div>

      <div class="song-editor-footer">
        <button class="btn btn-primary" id="btn-save-song">💾 Enregistrer</button>
        <button class="btn btn-ghost btn-sm btn-song-delete" id="btn-delete-song"
                style="color:var(--danger)">🗑 Supprimer</button>
      </div>
    </div>`;

  // Gestion des boutons d'alignement
  document.querySelectorAll('[data-align]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const align = btn.dataset.align;
      if (align === App.settings.songTextAlign) return;
      App.settings.songTextAlign = align;
      await db.saveSetting('songTextAlign', align);
      // Mettre à jour l'apparence des boutons
      document.querySelectorAll('[data-align]').forEach(b => {
        if (b.dataset.align === align) {
          b.classList.remove('btn-ghost');
          b.classList.add('btn-primary');
        } else {
          b.classList.remove('btn-primary');
          b.classList.add('btn-ghost');
        }
      });
      // Envoyer la nouvelle configuration à la projection
      safePostMessage({
        type: 'song-settings',
        settings: {
          bgColor:     App.settings.songBgColor,
          textColor:   App.settings.songTextColor,
          fontSize:    App.settings.songFontSize,
          fontFamily:  App.settings.songFontFamily,
          showTitle:   App.settings.songShowTitle,
          showAuthor:  App.settings.songShowAuthor,
          uppercase:   App.settings.songUppercase,
          textAlign:   App.settings.songTextAlign,
        },
      });
      showToast(`Alignement : ${align === 'left' ? 'gauche' : align === 'right' ? 'droite' : 'centré'}`, 'success');
    });
  });

  document.getElementById('song-lyrics-ta')?.addEventListener('input', function () {
    const strophes = parseStrophes(this.value);
    const n = strophes.length;
    document.getElementById('strophe-count').textContent =
      `${n} strophe${n !== 1 ? 's' : ''} détectée${n !== 1 ? 's' : ''}`;
    App.currentSong._previewStrophes = strophes;
    updateSlidePreview();
  });

  document.getElementById('slide-prev')?.addEventListener('click', () => {
    if (App.currentStropheIdx > 0) {
      App.currentStropheIdx--;
      updateSlidePreview();
      safePostMessage({ type: 'song-prev-strophe' });
      // Mettre à jour l'aperçu PIP
      const strophes = getCurrentStrophes();
      const allStrophesTexts = strophes.map(st => {
        let txt = '';
        (st.lines ?? []).forEach((line, i) => {
          txt += line;
          if (st.translations?.[i]) txt += '\n*' + st.translations[i];
          if (i < (st.lines ?? []).length - 1) txt += '\n';
        });
        return txt;
      });
      updatePipPreview({
        mode: 'song',
        title: App.currentSong?.title ?? '',
        author: App.currentSong?.author ?? '',
        strophes: allStrophesTexts,
        currentStrophe: App.currentStropheIdx,
      });
    }
  });

  document.getElementById('slide-next')?.addEventListener('click', () => {
    const strophes = getCurrentStrophes();
    if (App.currentStropheIdx < strophes.length - 1) {
      App.currentStropheIdx++;
      updateSlidePreview();
      safePostMessage({ type: 'song-next-strophe' });
      const allStrophesTexts = strophes.map(st => {
        let txt = '';
        (st.lines ?? []).forEach((line, i) => {
          txt += line;
          if (st.translations?.[i]) txt += '\n*' + st.translations[i];
          if (i < (st.lines ?? []).length - 1) txt += '\n';
        });
        return txt;
      });
      updatePipPreview({
        mode: 'song',
        title: App.currentSong?.title ?? '',
        author: App.currentSong?.author ?? '',
        strophes: allStrophesTexts,
        currentStrophe: App.currentStropheIdx,
      });
    }
  });

  document.getElementById('btn-project-slide')?.addEventListener('click', () => {
    const strophes = getCurrentStrophes();
    const s = strophes[App.currentStropheIdx];
    if (!s) { showToast('⚠ Aucune strophe à projeter', 'warning'); return; }

    const allStrophesTexts = strophes.map(st => {
      let text = '';
      (st.lines ?? []).forEach((line, i) => {
        text += line;
        if (st.translations?.[i]) text += '\n*' + st.translations[i];
        if (i < (st.lines ?? []).length - 1) text += '\n';
      });
      return text;
    });

    safePostMessage({
      type: 'show-song',
      data: {
        title:        document.getElementById('song-title-inp')?.value ?? App.currentSong.title ?? '',
        author:       document.getElementById('song-author-inp')?.value ?? App.currentSong.author ?? '',
        lines:        s.lines ?? [],
        translations: s.translations ?? [],
        strophes:     allStrophesTexts,
        currentIndex: App.currentStropheIdx,
        showTitle:    App.settings.songShowTitle,
        showAuthor:   App.settings.songShowAuthor,
        settings: {
          bgColor:     App.settings.songBgColor,
          textColor:   App.settings.songTextColor,
          fontFamily:  App.settings.songFontFamily,
          fontSize:    App.settings.songFontSize,
          showTitle:   App.settings.songShowTitle,
          showAuthor:  App.settings.songShowAuthor,
          uppercase:   App.settings.songUppercase,
          textAlign:   App.settings.songTextAlign,
        },
      },
    });
    updatePipPreview({
      mode: 'song',
      title: document.getElementById('song-title-inp')?.value ?? App.currentSong.title ?? '',
      author: document.getElementById('song-author-inp')?.value ?? App.currentSong.author ?? '',
      strophes: allStrophesTexts,
      currentStrophe: App.currentStropheIdx,
    });
    showToast('🎵 Strophe projetée', 'success');
  });

  document.getElementById('btn-save-song')?.addEventListener('click', async () => {
    const title    = document.getElementById('song-title-inp')?.value?.trim() ?? '';
    const author   = document.getElementById('song-author-inp')?.value?.trim() ?? '';
    const rawText  = document.getElementById('song-lyrics-ta')?.value ?? '';
    const strophes = parseStrophes(rawText);

    const updated = {
      ...App.currentSong,
      title, author, strophes,
      lyrics:      strophes.flatMap((s) => s.lines),
      translation: strophes.flatMap((s) => s.translations),
    };

    await db.saveSong(updated);
    App.currentSong = updated;

    await refreshSongsList();
    document.querySelector(`.song-card[data-id="${updated.id}"]`)?.classList.add('active');

    updateSlidePreview();
    showToast('✅ Chant enregistré', 'success');
  });

  document.getElementById('btn-delete-song')?.addEventListener('click', async () => {
    const footer = document.querySelector('.song-editor-footer');
    if (!footer || footer.querySelector('.song-delete-confirm')) return;

    const conf = document.createElement('div');
    conf.className = 'song-delete-confirm';
    conf.innerHTML = `<span>Supprimer « ${esc(App.currentSong?.title ?? '')} » ?</span>
      <button class="btn btn-sm btn-danger" id="song-del-yes">Oui</button>
      <button class="btn btn-sm btn-ghost" id="song-del-no">Non</button>`;
    footer.appendChild(conf);

    document.getElementById('song-del-yes')?.addEventListener('click', async () => {
      if (!App.currentSong) return;
      await db.deleteSong(App.currentSong.id);
      await db.removeFavorite(`song_${App.currentSong.id}`);
      App.currentSong = null;

      await refreshSongsList();

      const col = document.getElementById('songs-editor-col');
      if (col) col.innerHTML = `<div class="songs-editor-empty"><span>🎶</span><p>Sélectionnez un chant</p></div>`;
      showToast('🗑 Chant supprimé', 'info');
    });

    document.getElementById('song-del-no')?.addEventListener('click', () => conf.remove());
  });
}

function getCurrentStrophes() {
  return App.currentSong?._previewStrophes
    ?? App.currentSong?.strophes
    ?? [];
}

function renderSlidePreview(strophes, idx) {
  if (!strophes?.length) return '<div class="slide-empty">Aucune strophe</div>';
  const s = strophes[idx] ?? strophes[0];
  return `<div class="slide-content">
    ${(s.lines ?? []).map((line, i) => `
      <div class="slide-line">${esc(line)}
        ${s.translations?.[i] ? `<div class="slide-trans">${esc(s.translations[i])}</div>` : ''}
      </div>`).join('')}
  </div>`;
}

function updateSlidePreview() {
  const strophes = getCurrentStrophes();
  const preview  = document.getElementById('slide-preview');
  const indicator = document.getElementById('slide-indicator');
  if (preview)   preview.innerHTML  = renderSlidePreview(strophes, App.currentStropheIdx);
  if (indicator) indicator.textContent = strophes.length
    ? `${App.currentStropheIdx + 1} / ${strophes.length}`
    : '—';
}

// ═════════════════════════════════════════════════════════════
//  PANNEAU LOWER THIRD (US-10 complet)
// ═════════════════════════════════════════════════════════════

async function renderLowerThirdPanel(container) {
  const persons = await db.getAllPersons();

  container.innerHTML = `
    <div class="panel panel-lt" id="panel-lt">
      <!-- Sous-panneau Versets -->
      <div class="settings-section" style="margin-bottom: 1.5rem;">
        <h2 class="settings-section-title">📖 Versets</h2>
        <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem;">
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <span class="field-label" style="margin:0;">Style :</span>
            <label class="checkbox-row">
              <input type="radio" name="lt-type-radio" value="ictheme" ${App.settings.ltType === 'ictheme' ? 'checked' : ''}>
              <span>ICC Badge Gauche</span>
            </label>
            <label class="checkbox-row">
              <input type="radio" name="lt-type-radio" value="tourpac" ${App.settings.ltType === 'tourpac' ? 'checked' : ''}>
              <span>Tour PAC</span>
            </label>
          </div>
          <div style="flex:1; min-width: 200px;">
            <span class="field-label">Dernier verset projeté :</span>
            <div id="lt-last-ref" style="font-family: monospace; font-size: 0.9rem; background: var(--bg-input); padding: 4px 8px; border-radius: var(--radius-sm);">
              ${App.lastBibleRef || '—'}
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" id="lt-hide-verse-btn">🙈 Masquer</button>
          <button class="btn btn-primary btn-sm" id="lt-reproject-verse-btn">📖 Reprojeter</button>
        </div>
      </div>

      <!-- Sous-panneau Personnes -->
      <div class="settings-section">
        <h2 class="settings-section-title">👥 Personnes</h2>
        <div id="lt-persons-list" style="display: flex; flex-direction: column; gap: 0.75rem;">
          ${persons.length === 0
            ? `<div class="empty-state" style="padding:1rem;"><div class="empty-state-icon">👤</div><p>Aucune personne enregistrée.</p></div>`
            : persons.map(p => `
                <div class="lt-person-card" data-id="${p.id}" style="display: flex; align-items: center; gap: 1rem; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.6rem 1rem;">
                  <div style="flex:1; min-width:0;">
                    <div style="font-weight:700;">${esc(p.nom || '—')}</div>
                    <div style="font-size:0.8rem; color:var(--text-muted);">${esc(p.titre || '')}</div>
                  </div>
                  <div style="display: flex; gap: 0.5rem; flex-shrink:0;">
                    <button class="btn btn-sm btn-primary lt-project-person" data-id="${p.id}" data-nom="${esc(p.nom)}" data-titre="${esc(p.titre)}">🖥 Projeter</button>
                    <button class="btn btn-sm btn-ghost lt-edit-person" data-id="${p.id}" data-nom="${esc(p.nom)}" data-titre="${esc(p.titre)}">✏️</button>
                    <button class="btn btn-sm btn-danger lt-delete-person" data-id="${p.id}" style="color:var(--danger);">🗑</button>
                  </div>
                </div>
              `).join('')}
        </div>
        <div style="margin-top: 1rem; display: flex; gap: 1rem; flex-wrap: wrap; align-items: flex-end;">
          <div style="flex:1; min-width: 180px;">
            <label class="field-label" for="lt-new-nom">Nom</label>
            <input type="text" id="lt-new-nom" class="field-input" placeholder="Jean Dupont">
          </div>
          <div style="flex:1; min-width: 180px;">
            <label class="field-label" for="lt-new-titre">Titre</label>
            <input type="text" id="lt-new-titre" class="field-input" placeholder="Pasteur">
          </div>
          <button class="btn btn-primary" id="lt-add-person-btn">➕ Ajouter personne</button>
        </div>

        <div style="margin-top: 1.5rem; border-top: 1px solid var(--border); padding-top: 1rem;">
          <h3 class="settings-section-title" style="margin-top:0;">⚡ Intervenant impromptu</h3>
          <div style="display: flex; gap: 1rem; flex-wrap: wrap; align-items: flex-end;">
            <div style="flex:1; min-width: 180px;">
              <label class="field-label" for="lt-impromptu-nom">Nom</label>
              <input type="text" id="lt-impromptu-nom" class="field-input" placeholder="Nom">
            </div>
            <div style="flex:1; min-width: 180px;">
              <label class="field-label" for="lt-impromptu-titre">Titre</label>
              <input type="text" id="lt-impromptu-titre" class="field-input" placeholder="Titre">
            </div>
            <button class="btn btn-secondary" id="lt-project-impromptu-btn">🎙 Projeter sans sauvegarde</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // ── Gestionnaires d'événements ──────────────────────────────

  // 1. Changement de style (radio)
  const radios = document.querySelectorAll('input[name="lt-type-radio"]');
  radios.forEach(radio => {
    radio.addEventListener('change', async (e) => {
      if (e.target.checked) {
        const newType = e.target.value;
        if (newType !== App.settings.ltType) {
          App.settings.ltType = newType;
          await db.saveSetting('ltType', newType);
          showToast(`Style Lower Third changé pour ${newType === 'ictheme' ? 'ICC Badge Gauche' : 'Tour PAC'}`, 'success');
        }
      }
    });
  });

  // 2. Masquer verset
  document.getElementById('lt-hide-verse-btn')?.addEventListener('click', () => {
    safePostMessage({ type: 'hide-lower-third' });
    App.currentPersonActive = null;
    updatePipPreview({ mode: 'blank' });
    showToast('Lower Third masqué', 'info');
  });

  // 3. Reprojeter dernier verset
  document.getElementById('lt-reproject-verse-btn')?.addEventListener('click', () => {
    if (App.lastBibleRef && App.lastBibleText) {
      projectVerse(App.lastBibleText, App.lastBibleRef);
    } else {
      showToast('Aucun verset précédent à reprojeter', 'warning');
    }
  });

  // 4. Ajouter une personne
  const addBtn = document.getElementById('lt-add-person-btn');
  const nomInput = document.getElementById('lt-new-nom');
  const titreInput = document.getElementById('lt-new-titre');
  addBtn?.addEventListener('click', async () => {
    const nom = nomInput?.value?.trim();
    const titre = titreInput?.value?.trim();
    if (!nom || !titre) {
      showToast('Veuillez remplir le nom et le titre', 'warning');
      return;
    }
    const newPerson = {
      id: Date.now(),
      nom,
      titre,
      createdAt: Date.now(),
    };
    await db.savePerson(newPerson);
    if (nomInput) nomInput.value = '';
    if (titreInput) titreInput.value = '';
    showToast(`✅ Personne "${nom}" ajoutée`, 'success');
    await renderLowerThirdPanel(container);
  });

  // 5. Projection d'une personne (depuis carte)
  document.querySelectorAll('.lt-project-person').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.id);
      const person = await db.getPerson(id);
      if (!person) return;
      App.currentPersonActive = id;
      safePostMessage({
        type: 'show-person',
        data: {
          nom: person.nom,
          titre: person.titre,
          ltType: App.settings.ltType,
          settings: {
            refColor: App.settings.ltRefColor,
            verseColor: App.settings.ltVerseColor,
            fontFamily: App.settings.ltFontFamily,
            width: App.settings.ltWidth,
            height: App.settings.ltHeight,
            nameFontSize: App.settings.personNameSize,
            titleFontSize: App.settings.personTitleSize,
          },
        },
      });
      updatePipPreview({
        mode: 'person',
        nom: person.nom,
        titre: person.titre,
      });
      showToast(`▶ ${person.nom} projeté`, 'success');
      // Mettre à jour le surlignage
      document.querySelectorAll('.lt-person-card').forEach(card => card.classList.remove('active'));
      btn.closest('.lt-person-card')?.classList.add('active');
    });
  });

  // 6. Édition inline (NOUVEAU)
  document.querySelectorAll('.lt-edit-person').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = Number(btn.dataset.id);
      const card = btn.closest('.lt-person-card');
      if (!card || card.querySelector('.edit-form')) return;

      const nameDiv = card.querySelector('div:first-child > div:first-child');
      const titleDiv = card.querySelector('div:first-child > div:last-child');
      const currentNom = nameDiv.textContent;
      const currentTitre = titleDiv.textContent;

      const contentDiv = card.querySelector('div:first-child');
      contentDiv.style.display = 'none';

      const editForm = document.createElement('div');
      editForm.className = 'edit-form';
      editForm.style.cssText = 'flex:1; display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;';
      editForm.innerHTML = `
        <input type="text" class="edit-nom" value="${esc(currentNom)}" placeholder="Nom" style="flex:1; min-width:120px;">
        <input type="text" class="edit-titre" value="${esc(currentTitre)}" placeholder="Titre" style="flex:1; min-width:120px;">
        <button class="btn btn-sm btn-primary save-edit">✓</button>
        <button class="btn btn-sm btn-ghost cancel-edit">✗</button>
      `;
      card.insertBefore(editForm, card.querySelector('.lt-person-actions'));

      const saveBtn = editForm.querySelector('.save-edit');
      const cancelBtn = editForm.querySelector('.cancel-edit');
      const nomEdit = editForm.querySelector('.edit-nom');
      const titreEdit = editForm.querySelector('.edit-titre');

      const save = async () => {
        const newNom = nomEdit.value.trim();
        const newTitre = titreEdit.value.trim();
        if (!newNom) {
          showToast('Le nom est obligatoire', 'warning');
          return;
        }
        const person = await db.getPerson(id);
        if (person) {
          person.nom = newNom;
          person.titre = newTitre;
          await db.savePerson(person);
          showToast(`✅ Personne modifiée`, 'success');
          await renderLowerThirdPanel(container);
        }
      };

      const cancel = () => {
        editForm.remove();
        contentDiv.style.display = '';
      };

      saveBtn.addEventListener('click', save);
      cancelBtn.addEventListener('click', cancel);
      nomEdit.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
      titreEdit.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
    });
  });

  // 7. Suppression avec confirmation inline
  document.querySelectorAll('.lt-delete-person').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.id);
      const card = btn.closest('.lt-person-card');
      if (!card || card.querySelector('.confirm-delete')) return;

      const confirmDiv = document.createElement('div');
      confirmDiv.className = 'confirm-delete';
      confirmDiv.style.cssText = 'margin-left: 0.5rem; display: inline-flex; gap: 0.3rem; align-items: center;';
      confirmDiv.innerHTML = `
        <span style="font-size:0.75rem;">Confirmer ?</span>
        <button class="btn btn-xs btn-danger confirm-yes" style="padding:2px 6px;">Oui</button>
        <button class="btn btn-xs btn-ghost confirm-no" style="padding:2px 6px;">Non</button>
      `;
      card.appendChild(confirmDiv);

      const yesBtn = confirmDiv.querySelector('.confirm-yes');
      const noBtn = confirmDiv.querySelector('.confirm-no');
      yesBtn?.addEventListener('click', async () => {
        await db.deletePerson(id);
        if (App.currentPersonActive === id) App.currentPersonActive = null;
        confirmDiv.remove();
        showToast('🗑 Personne supprimée', 'info');
        await renderLowerThirdPanel(container);
      });
      noBtn?.addEventListener('click', () => confirmDiv.remove());
      setTimeout(() => { if (confirmDiv.parentNode) confirmDiv.remove(); }, 5000);
    });
  });

  // 8. Intervenant impromptu
  const impromptuNom = document.getElementById('lt-impromptu-nom');
  const impromptuTitre = document.getElementById('lt-impromptu-titre');
  document.getElementById('lt-project-impromptu-btn')?.addEventListener('click', () => {
    const nom = impromptuNom?.value?.trim();
    const titre = impromptuTitre?.value?.trim();
    if (!nom || !titre) {
      showToast('Veuillez saisir un nom et un titre', 'warning');
      return;
    }
    App.currentPersonActive = null;
    safePostMessage({
      type: 'show-person',
      data: {
        nom,
        titre,
        ltType: App.settings.ltType,
        settings: {
          refColor: App.settings.ltRefColor,
          verseColor: App.settings.ltVerseColor,
          fontFamily: App.settings.ltFontFamily,
          width: App.settings.ltWidth,
          height: App.settings.ltHeight,
          nameFontSize: App.settings.personNameSize,
          titleFontSize: App.settings.personTitleSize,
        },
      },
    });
    updatePipPreview({
      mode: 'person',
      nom,
      titre,
    });
    showToast(`🎙 ${nom} (impromptu) projeté`, 'success');
  });

  // 9. Surligner la carte active
  if (App.currentPersonActive) {
    const activeCard = document.querySelector(`.lt-person-card[data-id="${App.currentPersonActive}"]`);
    if (activeCard) activeCard.classList.add('active');
  }
}

// ═════════════════════════════════════════════════════════════
//  PANNEAU PARAMÈTRES (US-07 + US-13)
// ═════════════════════════════════════════════════════════════

const FONTS = ['Arial', 'Arial Black', 'Times New Roman', 'Georgia', 'Montserrat', 'Open Sans', 'Cinzel'];

async function renderSettingsPanel(container) {
  const get = async (key, def) => await db.getSetting(key, def);
  const ltType = await get('ltType', 'ictheme');
  const ltRefColor = await get('ltRefColor', '#ffffff');
  const ltVerseColor = await get('ltVerseColor', '#16308f');
  const ltFontFamily = await get('ltFontFamily', 'Arial Black');
  const ltRefSize = await get('ltRefSize', 30);
  const ltVerseSize = await get('ltVerseSize', 38);
  const personNameSize = await get('personNameSize', 30);
  const personTitleSize = await get('personTitleSize', 24);
  const ltWidth = await get('ltWidth', 1240);
  const ltHeight = await get('ltHeight', 248);
  const songBgColor = await get('songBgColor', '#000000');
  const songTextColor = await get('songTextColor', '#ffffff');
  const songFontSize = await get('songFontSize', 70);
  const songFontFamily = await get('songFontFamily', 'Arial Black');
  const songShowTitle = await get('songShowTitle', true);
  const songShowAuthor = await get('songShowAuthor', true);
  const songUppercase = await get('songUppercase', false);
  const songTextAlign = await get('songTextAlign', 'center'); // US-13

  Object.assign(App.settings, {
    ltType, ltRefColor, ltVerseColor, ltFontFamily, ltRefSize, ltVerseSize,
    personNameSize, personTitleSize, ltWidth, ltHeight,
    songBgColor, songTextColor, songFontSize, songFontFamily,
    songShowTitle, songShowAuthor, songUppercase, songTextAlign,
  });

  container.innerHTML = `
    <div class="panel panel-settings" id="panel-settings">
      <section class="settings-section">
        <h2 class="settings-section-title">📚 Import de Bible</h2>
        <p class="settings-hint">Format JSON attendu : <code>{ "Livre": { "1": { "1": "texte…" } } }</code></p>
        <label class="field-label" for="bible-file-inp">Fichier JSON (.json)</label>
        <input type="file" id="bible-file-inp" accept=".json" class="field-file">
        <div id="bible-import-msg" aria-live="polite" style="margin-top:6px;font-size:0.85rem;"></div>
        <div class="bible-list" id="bible-list" style="margin-top:12px;"></div>
      </section>

      <section class="settings-section">
        <h2 class="settings-section-title">🎵 Paramètres Chants</h2>
        <div class="settings-grid">
          <div class="settings-row">
            <label class="field-label" for="song-bg-color">Couleur fond</label>
            <input type="color" id="song-bg-color" class="field-color" value="${songBgColor}">
          </div>
          <div class="settings-row">
            <label class="field-label" for="song-text-color">Couleur texte</label>
            <input type="color" id="song-text-color" class="field-color" value="${songTextColor}">
          </div>
          <div class="settings-row">
            <label class="field-label" for="song-font-family">Police</label>
            <select id="song-font-family" class="field-select">
              ${FONTS.map(f => `<option value="${f}" ${f === songFontFamily ? 'selected' : ''}>${f}</option>`).join('')}
            </select>
          </div>
          <div class="settings-row">
            <label class="field-label">Taille police : <strong id="song-font-size-val">${songFontSize}</strong>px</label>
            <input type="range" id="song-font-size" class="field-range" min="20" max="120" value="${songFontSize}">
          </div>
          <div class="settings-row">
            <label class="checkbox-row" for="song-show-title">
              <input type="checkbox" id="song-show-title" ${songShowTitle ? 'checked' : ''}> Afficher le titre
            </label>
          </div>
          <div class="settings-row">
            <label class="checkbox-row" for="song-show-author">
              <input type="checkbox" id="song-show-author" ${songShowAuthor ? 'checked' : ''}> Afficher l'auteur
            </label>
          </div>
          <div class="settings-row">
            <label class="checkbox-row" for="song-uppercase">
              <input type="checkbox" id="song-uppercase" ${songUppercase ? 'checked' : ''}> Texte en majuscules
            </label>
          </div>
          <div class="settings-row">
            <label class="field-label">Alignement du texte :</label>
            <div style="display: flex; gap: 8px; margin-top: 6px;">
              <button class="btn btn-sm ${songTextAlign === 'left' ? 'btn-primary' : 'btn-ghost'}" data-align-settings="left" title="Aligner à gauche">⇤ Gauche</button>
              <button class="btn btn-sm ${songTextAlign === 'center' ? 'btn-primary' : 'btn-ghost'}" data-align-settings="center" title="Centrer">≡ Centre</button>
              <button class="btn btn-sm ${songTextAlign === 'right' ? 'btn-primary' : 'btn-ghost'}" data-align-settings="right" title="Aligner à droite">Droite ⇥</button>
            </div>
          </div>
        </div>
        <button class="btn btn-primary" id="btn-save-song-settings" style="margin-top:14px;">💾 Enregistrer Chants</button>
        <div id="song-settings-saved" aria-live="polite" style="margin-top:6px;font-size:0.85rem;"></div>
      </section>

      <section class="settings-section">
        <h2 class="settings-section-title">🎙 Lower Third</h2>
        <div class="settings-grid">
          <div class="settings-row">
            <label class="field-label" for="s-lt-type">Modèle</label>
            <select id="s-lt-type" class="field-select">
              <option value="ictheme" ${ltType === 'ictheme' ? 'selected' : ''}>ICC Badge Gauche</option>
              <option value="tourpac" ${ltType === 'tourpac' ? 'selected' : ''}>Tour PAC</option>
            </select>
          </div>
          <div class="settings-row">
            <label class="field-label" for="s-lt-ref-col">Couleur référence</label>
            <input type="color" id="s-lt-ref-col" class="field-color" value="${ltRefColor}">
          </div>
          <div class="settings-row">
            <label class="field-label" for="s-lt-verse-col">Couleur verset</label>
            <input type="color" id="s-lt-verse-col" class="field-color" value="${ltVerseColor}">
          </div>
          <div class="settings-row">
            <label class="field-label" for="s-lt-font">Police</label>
            <select id="s-lt-font" class="field-select">
              ${FONTS.map(f => `<option value="${f}" ${f === ltFontFamily ? 'selected' : ''}>${f}</option>`).join('')}
            </select>
          </div>
          <div class="settings-row">
            <label class="field-label">Taille référence : <strong id="s-ref-val">${ltRefSize}</strong>px</label>
            <input type="range" id="s-lt-ref-size" class="field-range" min="10" max="80" value="${ltRefSize}">
          </div>
          <div class="settings-row">
            <label class="field-label">Taille verset : <strong id="s-verse-val">${ltVerseSize}</strong>px</label>
            <input type="range" id="s-lt-verse-size" class="field-range" min="10" max="80" value="${ltVerseSize}">
          </div>
          <div class="settings-row">
            <label class="field-label">Nom personne : <strong id="s-name-val">${personNameSize}</strong>px</label>
            <input type="range" id="s-lt-name-size" class="field-range" min="10" max="80" value="${personNameSize}">
          </div>
          <div class="settings-row">
            <label class="field-label">Titre personne : <strong id="s-title-val">${personTitleSize}</strong>px</label>
            <input type="range" id="s-lt-title-size" class="field-range" min="10" max="80" value="${personTitleSize}">
          </div>
          <div class="settings-row">
            <label class="field-label" for="s-lt-width">Largeur (px)</label>
            <input type="number" id="s-lt-width" class="field-input" value="${ltWidth}" min="100" max="3840">
          </div>
          <div class="settings-row">
            <label class="field-label" for="s-lt-height">Hauteur (px)</label>
            <input type="number" id="s-lt-height" class="field-input" value="${ltHeight}" min="50" max="600">
          </div>
        </div>
        <button class="btn btn-primary" id="btn-save-lt" style="margin-top:14px;">💾 Enregistrer LT</button>
        <div id="settings-saved" aria-live="polite" style="margin-top:6px;font-size:0.85rem;"></div>
      </section>

      <section class="settings-section">
        <h2 class="settings-section-title">⚙️ Configuration</h2>
        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
          <button class="btn btn-primary" id="btn-export-config">📤 Exporter la configuration</button>
          <label class="btn btn-ghost" style="cursor: pointer;">
            📥 Importer une configuration
            <input type="file" id="import-config-file" accept=".json" style="display: none;">
          </label>
        </div>
        <div id="config-status" aria-live="polite" style="margin-top:8px;font-size:0.85rem;"></div>
      </section>
    </div>`;

  // Gestion des boutons d'alignement dans les paramètres
  document.querySelectorAll('[data-align-settings]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const align = btn.dataset.alignSettings;
      if (align === App.settings.songTextAlign) return;
      App.settings.songTextAlign = align;
      await db.saveSetting('songTextAlign', align);
      // Mettre à jour l'apparence des boutons
      document.querySelectorAll('[data-align-settings]').forEach(b => {
        if (b.dataset.alignSettings === align) {
          b.classList.remove('btn-ghost');
          b.classList.add('btn-primary');
        } else {
          b.classList.remove('btn-primary');
          b.classList.add('btn-ghost');
        }
      });
      // Envoyer la nouvelle configuration à la projection
      safePostMessage({
        type: 'song-settings',
        settings: {
          bgColor:     App.settings.songBgColor,
          textColor:   App.settings.songTextColor,
          fontSize:    App.settings.songFontSize,
          fontFamily:  App.settings.songFontFamily,
          showTitle:   App.settings.songShowTitle,
          showAuthor:  App.settings.songShowAuthor,
          uppercase:   App.settings.songUppercase,
          textAlign:   App.settings.songTextAlign,
        },
      });
      showToast(`Alignement : ${align === 'left' ? 'gauche' : align === 'right' ? 'droite' : 'centré'}`, 'success');
    });
  });

  const bibleFileInput = document.getElementById('bible-file-inp');
  const bibleImportMsg = document.getElementById('bible-import-msg');
  bibleFileInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    bibleImportMsg.innerHTML = '<span>⏳ Import en cours…</span>';
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const name = file.name.replace(/\.json$/i, '');
      await db.saveBible(name, data);
      bibleImportMsg.innerHTML = `<span style="color:var(--success)">✅ « ${esc(name)} » importée avec succès</span>`;
      loadBibleList();
    } catch (err) {
      bibleImportMsg.innerHTML = `<span style="color:var(--danger)">❌ ${esc(err.message)}</span>`;
    }
  });

  await loadBibleList();

  [
    ['s-lt-ref-size',   's-ref-val'],
    ['s-lt-verse-size', 's-verse-val'],
    ['s-lt-name-size',  's-name-val'],
    ['s-lt-title-size', 's-title-val']
  ].forEach(([rangeId, valId]) => {
    document.getElementById(rangeId)?.addEventListener('input', function () {
      document.getElementById(valId).textContent = this.value;
    });
  });

  const songFontSizeInput = document.getElementById('song-font-size');
  const songFontSizeVal = document.getElementById('song-font-size-val');
  songFontSizeInput?.addEventListener('input', function () {
    songFontSizeVal.textContent = this.value;
  });

  document.getElementById('btn-save-song-settings')?.addEventListener('click', async () => {
    const newSongBgColor = document.getElementById('song-bg-color')?.value || '#000000';
    const newSongTextColor = document.getElementById('song-text-color')?.value || '#ffffff';
    let newSongFontSize = parseInt(document.getElementById('song-font-size')?.value, 10);
    if (isNaN(newSongFontSize)) newSongFontSize = 70;
    newSongFontSize = Math.min(120, Math.max(20, newSongFontSize));
    if (newSongFontSize !== parseInt(document.getElementById('song-font-size')?.value, 10)) {
      showToast('⚠ Taille police ajustée (20-120)', 'warning');
    }
    const newSongFontFamily = document.getElementById('song-font-family')?.value || 'Arial Black';
    const newSongShowTitle = document.getElementById('song-show-title')?.checked === true;
    const newSongShowAuthor = document.getElementById('song-show-author')?.checked === true;
    const newSongUppercase = document.getElementById('song-uppercase')?.checked === true;
    // Récupérer l'alignement depuis les boutons actifs
    let newSongTextAlign = 'center';
    const activeAlignBtn = document.querySelector('[data-align-settings].btn-primary');
    if (activeAlignBtn) newSongTextAlign = activeAlignBtn.dataset.alignSettings;

    await db.saveSetting('songBgColor', newSongBgColor);
    await db.saveSetting('songTextColor', newSongTextColor);
    await db.saveSetting('songFontSize', newSongFontSize);
    await db.saveSetting('songFontFamily', newSongFontFamily);
    await db.saveSetting('songShowTitle', newSongShowTitle);
    await db.saveSetting('songShowAuthor', newSongShowAuthor);
    await db.saveSetting('songUppercase', newSongUppercase);
    await db.saveSetting('songTextAlign', newSongTextAlign);

    Object.assign(App.settings, {
      songBgColor: newSongBgColor,
      songTextColor: newSongTextColor,
      songFontSize: newSongFontSize,
      songFontFamily: newSongFontFamily,
      songShowTitle: newSongShowTitle,
      songShowAuthor: newSongShowAuthor,
      songUppercase: newSongUppercase,
      songTextAlign: newSongTextAlign,
    });

    safePostMessage({
      type: 'song-settings',
      settings: {
        bgColor: newSongBgColor,
        textColor: newSongTextColor,
        fontSize: newSongFontSize,
        fontFamily: newSongFontFamily,
        showTitle: newSongShowTitle,
        showAuthor: newSongShowAuthor,
        uppercase: newSongUppercase,
        textAlign: newSongTextAlign,
      },
    });

    const savedMsg = document.getElementById('song-settings-saved');
    if (savedMsg) {
      savedMsg.innerHTML = '<span style="color:var(--success)">✅ Paramètres chants enregistrés</span>';
      setTimeout(() => { savedMsg.innerHTML = ''; }, 2000);
    }
    showToast('💾 Paramètres chants enregistrés', 'success');
  });

  document.getElementById('btn-save-lt')?.addEventListener('click', async () => {
    const vals = {
      ltType:          document.getElementById('s-lt-type')?.value,
      ltRefColor:      document.getElementById('s-lt-ref-col')?.value,
      ltVerseColor:    document.getElementById('s-lt-verse-col')?.value,
      ltFontFamily:    document.getElementById('s-lt-font')?.value,
      ltRefSize:       parseInt(document.getElementById('s-lt-ref-size')?.value, 10),
      ltVerseSize:     parseInt(document.getElementById('s-lt-verse-size')?.value, 10),
      personNameSize:  parseInt(document.getElementById('s-lt-name-size')?.value, 10),
      personTitleSize: parseInt(document.getElementById('s-lt-title-size')?.value, 10),
      ltWidth:         parseInt(document.getElementById('s-lt-width')?.value, 10),
      ltHeight:        parseInt(document.getElementById('s-lt-height')?.value, 10),
    };
    if (isNaN(vals.ltRefSize)) vals.ltRefSize = 30;
    if (isNaN(vals.ltVerseSize)) vals.ltVerseSize = 38;
    if (isNaN(vals.personNameSize)) vals.personNameSize = 30;
    if (isNaN(vals.personTitleSize)) vals.personTitleSize = 24;
    if (isNaN(vals.ltWidth)) vals.ltWidth = 1240;
    if (isNaN(vals.ltHeight)) vals.ltHeight = 248;

    await Promise.all(Object.entries(vals).map(([k, v]) => db.saveSetting(k, v)));
    Object.assign(App.settings, vals);
    const msgDiv = document.getElementById('settings-saved');
    if (msgDiv) msgDiv.innerHTML = '<span style="color:var(--success)">✅ Paramètres LT enregistrés</span>';
    showToast('💾 Paramètres Lower Third enregistrés', 'success');
  });

  document.getElementById('btn-export-config')?.addEventListener('click', async () => {
    const allKeys = [
      'ltType', 'ltRefColor', 'ltVerseColor', 'ltFontFamily', 'ltRefSize', 'ltVerseSize',
      'personNameSize', 'personTitleSize', 'ltWidth', 'ltHeight',
      'songBgColor', 'songTextColor', 'songFontSize', 'songFontFamily',
      'songShowTitle', 'songShowAuthor', 'songUppercase', 'songTextAlign'
    ];
    const config = {
      exportedAt: new Date().toISOString(),
      app: 'NTIC Bible Projector',
      version: '1.0-sp12',
      settings: {}
    };
    for (const key of allKeys) {
      config.settings[key] = await db.getSetting(key, null);
    }
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ntic-config-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('📤 Configuration exportée', 'success');
  });

  const importFileInput = document.getElementById('import-config-file');
  const importLabel = document.querySelector('label[for="import-config-file"]');
  if (importLabel) {
    importLabel.addEventListener('click', () => {
      importFileInput.click();
    });
  }
  importFileInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const statusDiv = document.getElementById('config-status');
    statusDiv.innerHTML = '<span>⏳ Import en cours…</span>';
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed.settings || typeof parsed.settings !== 'object') {
        throw new Error('Format invalide : settings manquant');
      }
      const allowedKeys = [
        'ltType', 'ltRefColor', 'ltVerseColor', 'ltFontFamily', 'ltRefSize', 'ltVerseSize',
        'personNameSize', 'personTitleSize', 'ltWidth', 'ltHeight',
        'songBgColor', 'songTextColor', 'songFontSize', 'songFontFamily',
        'songShowTitle', 'songShowAuthor', 'songUppercase', 'songTextAlign'
      ];
      for (const key of allowedKeys) {
        if (key in parsed.settings) {
          let value = parsed.settings[key];
          if (key.includes('Color')) {
            if (typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value)) {
              await db.saveSetting(key, value);
            } else {
              console.warn(`Import : clé ${key} ignorée (couleur invalide)`);
            }
          } else if (key === 'ltType' || key === 'ltFontFamily' || key === 'songFontFamily') {
            if (typeof value === 'string') await db.saveSetting(key, value);
          } else if (key === 'songShowTitle' || key === 'songShowAuthor' || key === 'songUppercase') {
            if (typeof value === 'boolean') await db.saveSetting(key, value);
          } else if (key === 'songTextAlign') {
            if (value === 'left' || value === 'center' || value === 'right') await db.saveSetting(key, value);
          } else if (typeof value === 'number') {
            await db.saveSetting(key, value);
          }
        }
      }
      await renderSettingsPanel(container);
      statusDiv.innerHTML = '<span style="color:var(--success)">✅ Configuration importée avec succès</span>';
      showToast('📥 Configuration importée', 'success');
    } catch (err) {
      statusDiv.innerHTML = `<span style="color:var(--danger)">❌ Erreur : ${esc(err.message)}</span>`;
      showToast('❌ Échec de l\'import', 'error');
    } finally {
      importFileInput.value = '';
    }
  });
}

async function loadBibleList() {
  const names = await db.getAllBibleNames();
  const list = document.getElementById('bible-list');
  if (!list) return;
  if (names.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">Aucune Bible importée.</p>';
    return;
  }
  list.innerHTML = names.map((n) => `
    <div class="bible-list-item">
      <span>📖 ${esc(n)}</span>
      <button class="btn btn-sm btn-ghost" data-name="${esc(n)}"
              style="color:var(--danger)" aria-label="Supprimer ${esc(n)}">🗑</button>
    </div>`).join('');
  list.querySelectorAll('button[data-name]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const name = btn.dataset.name;
      if (btn.dataset.confirm) {
        await db.deleteBible(name);
        showToast(`🗑 Bible « ${esc(name)} » supprimée`, 'info');
        await loadBibleList();
      } else {
        btn.dataset.confirm = '1';
        btn.textContent = '⚠ Confirmer';
        btn.style.background = 'var(--danger)';
        btn.style.color = '#fff';
        setTimeout(() => {
          delete btn.dataset.confirm;
          btn.textContent = '🗑';
          btn.style.background = '';
          btn.style.color = 'var(--danger)';
        }, 3000);
      }
    });
  });
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

// ─────────────────────────────────────────────────────────────
//  DÉMARRAGE
// ─────────────────────────────────────────────────────────────
async function init() {
  try {
    await db.open();

    const keys = [
      'ltType', 'ltRefColor', 'ltVerseColor', 'ltFontFamily',
      'ltRefSize', 'ltVerseSize', 'personNameSize', 'personTitleSize',
      'ltWidth', 'ltHeight',
      'songBgColor', 'songTextColor', 'songFontSize', 'songFontFamily',
      'songShowTitle', 'songShowAuthor', 'songUppercase',
      'songTextAlign' // US-13
    ];
    const defaults = {
      ltType: 'ictheme', ltRefColor: '#ffffff', ltVerseColor: '#16308f',
      ltFontFamily: 'Arial Black', ltRefSize: 30, ltVerseSize: 38,
      personNameSize: 30, personTitleSize: 24, ltWidth: 1240, ltHeight: 248,
      songBgColor: '#000000', songTextColor: '#ffffff', songFontSize: 70,
      songFontFamily: 'Arial Black', songShowTitle: true, songShowAuthor: true,
      songUppercase: false, songTextAlign: 'center',
    };
    for (const k of keys) {
      const v = await db.getSetting(k, defaults[k]);
      App.settings[k] = v;
    }

    // Récupérer préférence PIP
    const pipEnabled = await db.getSetting('pipEnabled', false);
    await setPipEnabled(pipEnabled);

    initServiceWorker();
    initTabs();

    // Écouteurs des boutons PIP
    const btnPip = document.getElementById('btn-pip');
    if (btnPip) {
      btnPip.addEventListener('click', () => setPipEnabled(!App.pipEnabled));
    }
    const pipClose = document.getElementById('pip-close');
    if (pipClose) {
      pipClose.addEventListener('click', () => setPipEnabled(false));
    }

    const footerVer = document.getElementById('footer-version');
    if (footerVer) footerVer.textContent = 'v1.0-sp12 · PWA · IndexedDB';

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
    hideLoadingOverlay();
    showToast('⚠ Erreur d\'initialisation : ' + err.message, 'error', 6000);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}