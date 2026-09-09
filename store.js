/**
 * ============================================================
 *  store.js — État global centralisé
 *  NTIC Bible Projector · SP-13 US-R07
 *  + Modes d'affichage enrichis (bilingue simplifié + explicatif)
 *    — Remplace l'ancien dualMode / dualConfig (alternance)
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

  // ── Modes d'affichage enrichis ───────────────────────────
  // 'normal' | 'bilingual' | 'explanatory' — un seul actif à la fois
  activeDisplayMode:   'normal',

  // ── Mode bilingue (simplifié — côte à côte, suit la navigation) ──
  bilingual: {
    secondVersion:      null,   // nom de la version secondaire (string)
  },

  // ── Mode explicatif (référence fixe, indépendante de la navigation) ──
  explanatory: {
    reference:           '',    // référence saisie (ex: "Jean 3:16")
    version:              null, // version sélectionnée (string ou null = version principale)
    text:                 '',   // texte du verset explicatif (rempli automatiquement)
    book:                 '',   // livre extrait
    chapter:              '',   // chapitre extrait
    verse:                '',   // verset extrait
    ref:                  '',   // référence formatée (ex: "Jean 3:16")
  },

  // ── Chants ──────────────────────────────────────────────
  currentSong:         null,   // objet chant en cours d'édition
  currentStropheIdx:   0,      // index strophe affichée

  // ── Lower Third ─────────────────────────────────────────
  currentPersonActive: null,   // id personne LT active (US-10)
  lastProjectedPersonNom:   '',   // dernier nom personne LT projeté
  lastProjectedPersonTitre: '',   // dernier titre personne LT projeté

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