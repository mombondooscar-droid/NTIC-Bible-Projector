/**
 * ============================================================
 *  constants.js — Constantes partagées
 *  NTIC Bible Projector · SP-13 US-R07 + US-UX09/R#10 + US-UX10/R#14
 *  Mise à jour Demande #X : éclatement projection-lt.html →
 *    projection-lt-verset.html + projection-lt-personne.html
 *    Ajout canaux LT_VERSET et LT_PERSONNE.
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
  // UI
  'toastDuration',
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
  // UI
  toastDuration:    2400,
};

// ============================================================
//  ICONS — système cohérent (US-UX10 / R#14)
// ============================================================
const ICONS = {
  project:  '🖥',
  bible:    '📖',
  songs:    '🎵',
  favorite: '⭐',
  settings: '⚙️',
  lt:       '🎤',
  delete:   '🗑',
  edit:     '✏',
  export:   '⬇',
  label:    '🏷',
  pip:      '📹',
  close:    '✕',
  import:   '📥',
  copy:     '📋',
  slide:    '📺',
};

// ============================================================
//  VERSION DES MESSAGES BROADCASTCHANNEL (US-38 / Problème #16)
// ============================================================
const BC_MESSAGE_VERSION = 1;

// ============================================================
//  CANAUX DE PROJECTION DÉDIÉS
//  Demande #5  : éclatement projection.html → bible / chant / lt
//  Demande #XX : éclatement projection-lt.html → lt-verset / lt-personne
// ============================================================
const PROJECTION_CHANNELS = {
  // Canal historique — conservé pour projection.html (@deprecated)
  LEGACY:      'projection-channel',

  // projection-bible.html  → verset plein écran (diapositive) + slide
  BIBLE:       'projection-bible',

  // projection-chant.html  → mode 'song'
  CHANT:       'projection-chant',

  // projection-lt.html     → @deprecated (LT verset + personne fusionnés)
  //                          Conservé pour rétro-compatibilité uniquement.
  LT:          'projection-lt',

  // projection-lt-verset.html   → lower-third verset (ictheme / tourpac)
  LT_VERSET:   'projection-lt-verset',

  // projection-lt-personne.html → lower-third personne (ictheme / tourpac)
  LT_PERSONNE: 'projection-lt-personne',
};