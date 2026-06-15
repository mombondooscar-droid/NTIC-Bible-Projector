/**
 * ============================================================
 *  utils/bibleHelpers.js — Helpers bibliques
 *  NTIC Bible Projector · Extrait de app.js (refactoring SP-13)
 *  + US-60 : Index inversé pour recherche plein texte optimisée
 *  Scope global (pas de module) — chargé avant app.js
 * ============================================================
 */

// ─────────────────────────────────────────────────────────────
//  INDEX INVERSÉ POUR RECHERCHE PLEIN TEXTE (US-60)
// ─────────────────────────────────────────────────────────────
let _invertedIndex = null;       // index inversé des mots
let _invertedIndexBible = null;  // nom de la Bible indexée (App.settings.currentBible)

/**
 * Construit un index inversé à partir des données bibliques.
 * @param {Object} bibleData - Structure { livre: { chapitre: { verset: texte } } }
 * @returns {Object} Index { mot: [ref1, ref2, ...] }
 */
function buildInvertedIndex(bibleData) {
  const idx = {};
  for (const [book, chapters] of Object.entries(bibleData)) {
    for (const [ch, verses] of Object.entries(chapters)) {
      for (const [v, text] of Object.entries(verses)) {
        const ref = buildVerseRef(book, ch, v);
        const words = stripAccents(text).split(/\s+/);
        for (const word of words) {
          if (word.length < 2) continue;
          if (!idx[word]) idx[word] = [];
          idx[word].push(ref);
        }
      }
    }
  }
  return idx;
}

/**
 * Retourne l'index inversé pour la Bible courante (le recalcule si nécessaire).
 * @returns {Object|null}
 */
function getInvertedIndex() {
  const data = App?.bibleData;
  const name = App?.settings?.currentBible;
  if (!data) return null;
  if (_invertedIndex && _invertedIndexBible === name) return _invertedIndex;
  _invertedIndex = buildInvertedIndex(data);
  _invertedIndexBible = name;
  return _invertedIndex;
}

// ─────────────────────────────────────────────────────────────
//  REFS DE VERSETS
// ─────────────────────────────────────────────────────────────
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
//  NORMALISATION
// ─────────────────────────────────────────────────────────────
/** Supprime les accents et met en minuscules. */
function stripAccents(str) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ─────────────────────────────────────────────────────────────
//  DISTANCE DE LEVENSHTEIN
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
//  DICTIONNAIRE DES 66 LIVRES
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
//  RECHERCHE DE NOM DE LIVRE
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
//  PARSE RÉFÉRENCE BIBLIQUE
// ─────────────────────────────────────────────────────────────
/**
 * Parse une chaîne de référence biblique (ex: "Jn 3:16", "Esaie 40:31", "1 Corinthiens 13").
 * @param {string} input
 * @returns {{ book: string, chapter: number, verse: number | null } | null}
 */
function parseRef(input) {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^([\d\s]*[a-zA-ZÀ-ÿ]+(?:\s+[\d\w]+)?)\s+(\d+)\s*[:.,]\s*(\d+)?$/i);
  if (!match) return null;
  let bookPart = match[1].trim();
  const chapter = parseInt(match[2], 10);
  const verse = match[3] ? parseInt(match[3], 10) : null;
  const bookMatch = matchBookName(bookPart);
  if (!bookMatch) return null;
  return { book: bookMatch.book, chapter, verse };
}

// ─────────────────────────────────────────────────────────────
//  RECHERCHE PLEIN TEXTE (US-60 — VERSION OPTIMISÉE PAR INDEX INVERSÉ)
// ─────────────────────────────────────────────────────────────
/**
 * Recherche plein texte dans App.bibleData en utilisant un index inversé.
 * @param {string} query
 * @returns {Array<{ ref: string, text: string, book: string, chapter: number, verse: number }>}
 */
function searchFullText(query) {
  if (!query || query.length < 2 || !App.bibleData) return [];
  const q = stripAccents(query.trim());
  const idx = getInvertedIndex();
  if (!idx) return [];

  // Découper la requête en mots significatifs (≥2 caractères)
  const queryWords = q.split(/\s+/).filter(w => w.length >= 2);
  if (queryWords.length === 0) return [];

  // Pour chaque mot, récupérer les références via une recherche par inclusion (mot contenu dans le terme d'index)
  // On utilise un Set pour éliminer les doublons
  let matchingRefs = null;
  for (const word of queryWords) {
    const refsForWord = new Set();
    for (const [indexWord, refs] of Object.entries(idx)) {
      if (indexWord.includes(word)) {
        for (const ref of refs) refsForWord.add(ref);
      }
    }
    if (refsForWord.size === 0) {
      matchingRefs = new Set();
      break;
    }
    if (matchingRefs === null) {
      matchingRefs = refsForWord;
    } else {
      // Intersection : ne garder que les références présentes pour tous les mots
      matchingRefs = new Set([...matchingRefs].filter(r => refsForWord.has(r)));
      if (matchingRefs.size === 0) break;
    }
  }

  if (!matchingRefs || matchingRefs.size === 0) return [];

  // Reconstruire les résultats (max 50)
  const results = [];
  for (const ref of matchingRefs) {
    if (results.length >= 50) break;
    const { book, chapter, verse } = parseVerseRef(ref);
    const text = App.bibleData?.[book]?.[chapter]?.[verse];
    if (text) {
      results.push({
        ref: `${book} ${chapter}:${verse}`,
        text,
        book,
        chapter: parseInt(chapter, 10),
        verse: parseInt(verse, 10)
      });
    }
  }
  return results;
}