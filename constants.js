/**
 * ============================================================
 *  constants.js — Constantes partagées
 *  NTIC Bible Projector · SP-13 US-R07 + US-UX09/R#10 + US-UX10/R#14
 *  Mise à jour Demande #X : éclatement projection-lt.html →
 *    projection-lt-verset.html + projection-lt-personne.html
 *    Ajout canaux LT_VERSET et LT_PERSONNE.
 *  Mise à jour Cahier des charges "Modes bilingue et explicatif" :
 *    Ajout des clés de style pour les blocs principal/secondaire
 *    des modes d'affichage enrichis (remplace l'ancien dualMode).
 *  Scope global (pas de module) — chargé en premier
 * ============================================================
 */

// ─────────────────────────────────────────────────────────────
//  POLICES DISPONIBLES (référence unique)
// ─────────────────────────────────────────────────────────────
const FONTS = [
  'Arial', 'Arial Black', 'Times New Roman', 'Georgia',
  'Montserrat', 'Open Sans', 'Cinzel',
];

// ─────────────────────────────────────────────────────────────
//  CLÉ DE SETTINGS (référence unique)
// ─────────────────────────────────────────────────────────────
const SETTINGS_KEYS = [
  // Lower Third
  'ltType', 'ltRefColor', 'ltVerseColor', 'ltFontFamily',
  'ltRefSize', 'ltVerseSize', 'personNameSize', 'personTitleSize',
  'ltWidth', 'ltHeight',
  // Chants
  'songBgColor', 'songTextColor', 'songFontSize', 'songFontFamily',
  'songShowTitle', 'songShowAuthor', 'songUppercase', 'songTextAlign',
  // Diapositives Bible
  'slideRefSize', 'slideVerseSize', 'slideRefColor', 'slideVerseColor',
  'slideFont', 'slideTextAlign', 'slideBg',
  // Modes d'affichage enrichis (principal)
  'primaryRefColor',
  'primaryTextColor',
  'primaryFontFamily',
  'primaryRefSize',
  'primaryTextSize',
  // Modes d'affichage enrichis (secondaire)
  'secondaryRefColor',
  'secondaryTextColor',
  'secondaryFontFamily',
  'secondaryRefSize',
  'secondaryTextSize',
  // Relay réseau
  'relayEnabled',
  // Mode serveur (US-R09-02)
  'serverMode',
  'serverUrl',
];

// ─────────────────────────────────────────────────────────────
//  VALEURS PAR DÉFAUT (source unique de vérité)
// ─────────────────────────────────────────────────────────────
const SETTINGS_DEFAULTS = {
  // Lower Third
  ltType:           'ictheme',
  ltRefColor:       '#ffffff',
  ltVerseColor:     '#16308f',
  ltFontFamily:     'Arial Black',
  ltRefSize:        30,
  ltVerseSize:      38,
  personNameSize:   30,
  personTitleSize:  24,
  ltWidth:          1240,
  ltHeight:         248,
  // Chants
  songBgColor:      '#080810',
  songTextColor:    '#f5f0e8',
  songFontSize:     70,
  songFontFamily:   'Arial Black',
  songShowTitle:    true,
  songShowAuthor:   true,
  songUppercase:    false,
  songTextAlign:    'center',
  // Diapositives Bible
  slideRefSize:     32,
  slideVerseSize:   48,
  slideRefColor:    '#f0c060',
  slideVerseColor:  '#f5f0e8',
  slideFont:        'Arial',
  slideTextAlign:   'center',
  slideBg:          '#0a0a0a',
  // Modes d'affichage enrichis (principal)
  primaryRefColor:     '#f0c060',
  primaryTextColor:    '#f5f0e8',
  primaryFontFamily:   'Arial',
  primaryRefSize:      32,
  primaryTextSize:     48,
  // Modes d'affichage enrichis (secondaire)
  secondaryRefColor:   '#00cc66',
  secondaryTextColor:  '#d0d8ec',
  secondaryFontFamily: 'Arial',
  secondaryRefSize:    32,
  secondaryTextSize:   48,
  // Relay réseau (actif par défaut)
  relayEnabled: true,
  // Mode serveur (US-R09-02)
  serverMode: false,
  serverUrl: 'http://localhost:8080',
};

// ============================================================
//  ICONS — système SVG cohérent
// ============================================================
const ICONS = {
  project:  '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
  bible:    '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  songs:    '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  favorite: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  settings: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  lt:       '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
  delete:   '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>',
  edit:     '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  export:   '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  label:    '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
  close:    '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  import:   '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
  copy:     '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>',
};

// ============================================================
//  VERSION DES MESSAGES BROADCASTCHANNEL
// ============================================================
const BC_MESSAGE_VERSION = 1;

// ============================================================
//  CANAUX DE PROJECTION DÉDIÉS
// ============================================================
const PROJECTION_CHANNELS = {
  LEGACY:      'projection-channel',
  BIBLE:       'projection-bible',
  CHANT:       'projection-chant',
  LT:          'projection-lt',
  LT_VERSET:   'projection-lt-verset',
  LT_PERSONNE: 'projection-lt-personne',
  TIMER:       'projection-timer',
};