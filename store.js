/**
 * ============================================================
 *  store.js — État global centralisé
 *  NTIC Bible Projector · SP-13 US-R07
 *  Dépendances : constants.js (SETTINGS_DEFAULTS)
 *  Scope global (pas de module) — chargé après constants.js
 * ============================================================
 */

const Store = {
  // ── Navigation ──────────────────────────────────────────
  currentTab:          'bible',

  // ── Bible ───────────────────────────────────────────────
  bibleData:           null,   // données de la bible active en mémoire
  lastBibleRef:        '',     // dernière référence projetée (US-09)
  lastBibleText:       '',     // dernier texte projeté (US-09)
  searchMode:          'text', // 'text' | 'ref'

  // ── Mode bilingue (Demande #6) ──────────────────────────
  dualMode:            false,                // toggle on/off
  bibleDataB:          null,                 // seconde version (pour dual-version)
  dualConfig: {
    verseA:            null,                 // { ref, text, version }
    verseB:            null,
    mode:              'side',               // 'side' | 'alternate'
    interval:          5,                    // secondes (alternance)
    intervalActive:    false,
    intervalTimer:     null,
  },

  // ── Chants ──────────────────────────────────────────────
  currentSong:         null,   // objet chant en cours d'édition
  currentStropheIdx:   0,      // index strophe affichée

  // ── Lower Third ─────────────────────────────────────────
  currentPersonActive: null,   // id personne LT active (US-10)
  lastProjectedPersonNom:   '',   // dernier nom personne LT projeté
  lastProjectedPersonTitre: '',   // dernier titre personne LT projeté

  // ── PIP (aperçu projection — US-11) ─────────────────────
  pipEnabled:          false,
  lastProjectionState: { mode: 'blank' },

  // ── Paramètres (initialisés depuis SETTINGS_DEFAULTS) ───
  settings: { ...SETTINGS_DEFAULTS },

  // ── Accesseurs pratiques ────────────────────────────────
  /** Lit un paramètre. */
  get(key) {
    return this.settings[key];
  },

  /** Écrit un paramètre en mémoire (sans persister en DB). */
  set(key, value) {
    this.settings[key] = value;
    return this;
  },

  /** Écrit plusieurs paramètres d'un coup. */
  merge(partial) {
    Object.assign(this.settings, partial);
    return this;
  },
};

/**
 * Alias de rétro-compatibilité.
 * Tous les panneaux existants utilisent `App.*` — aucune
 * modification nécessaire dans les 5 fichiers de panneaux.
 */
const App = Store;