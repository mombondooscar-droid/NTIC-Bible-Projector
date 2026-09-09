/**
 * ============================================================
 *  utils/bibleHelpers.js — Helpers bibliques
 *  NTIC Bible Projector · Extrait de app.js (refactoring SP-13)
 *  + Recherche plein texte (searchFullText)
 *  + Dictionnaire complet des 66 livres avec abréviations et alias
 *  + parseRefExtended pour les références complexes (plages, listes)
 *  Scope global (pas de module) — chargé avant app.js
 * ============================================================
 */

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
//  PARSE RÉFÉRENCE BIBLIQUE (simple)
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
//  PARSE RÉFÉRENCE ÉTENDUE (plages, listes)
// ─────────────────────────────────────────────────────────────
/**
 * Parse une référence biblique avec support des plages et listes.
 * Exemples : "Jean 3:16-18", "Eph 2:8,10", "Ps 23", "Jean3:16"
 * @param {string} input
 * @returns {{ book: string, chapter: number | null, verses: number[] | null, raw: string } | null}
 */
function parseRefExtended(input) {
  const raw = input.trim();
  if (!raw) return null;

  // Normalisation : ajouter un espace entre livre et chiffre si manquant
  // "Jean3:16" → "Jean 3:16"
  let normalized = raw.replace(/([a-zA-ZÀ-ÿ]+)(\d+)/, '$1 $2');
  // Remplacer plusieurs espaces par un seul
  normalized = normalized.replace(/\s+/g, ' ').trim();

  // Extraire le nom du livre et le reste
  // On cherche le premier chiffre pour séparer livre et chapitre
  const firstDigitMatch = normalized.match(/\d/);
  if (!firstDigitMatch) {
    // Pas de chiffre → seulement un livre
    const bookMatch = matchBookName(normalized);
    if (!bookMatch) return null;
    return { book: bookMatch.book, chapter: null, verses: null, raw };
  }
  const digitIndex = firstDigitMatch.index;
  const bookPart = normalized.substring(0, digitIndex).trim();
  const rest = normalized.substring(digitIndex).trim();

  const bookMatch = matchBookName(bookPart);
  if (!bookMatch) return null;

  // Extraire le chapitre
  const chapterMatch = rest.match(/^(\d+)/);
  if (!chapterMatch) {
    return { book: bookMatch.book, chapter: null, verses: null, raw };
  }
  const chapter = parseInt(chapterMatch[1], 10);
  const afterChapter = rest.substring(chapterMatch[0].length).trim();

  // Si plus rien après le chapitre → pas de verset
  if (!afterChapter) {
    return { book: bookMatch.book, chapter, verses: null, raw };
  }

  // Extraire les versets (plage ou liste)
  // Supprimer les séparateurs : ":", ".", "," mais on garde "-"
  let versePart = afterChapter.replace(/^[:.,]\s*/, '').trim();
  if (!versePart) {
    return { book: bookMatch.book, chapter, verses: null, raw };
  }

  let verses = [];
  // Gérer les plages (ex: "16-18") et les listes (ex: "16,18,20")
  // On remplace les virgules par un séparateur pour faciliter le split
  const parts = versePart.split(',').map(s => s.trim());
  for (const part of parts) {
    if (part.includes('-')) {
      const range = part.split('-').map(s => parseInt(s.trim(), 10));
      if (range.length === 2 && !isNaN(range[0]) && !isNaN(range[1])) {
        const start = Math.min(range[0], range[1]);
        const end = Math.max(range[0], range[1]);
        for (let v = start; v <= end; v++) {
          verses.push(v);
        }
      }
    } else {
      const num = parseInt(part, 10);
      if (!isNaN(num)) {
        verses.push(num);
      }
    }
  }

  // Supprimer les doublons et trier
  verses = [...new Set(verses)].sort((a, b) => a - b);

  return {
    book: bookMatch.book,
    chapter,
    verses: verses.length > 0 ? verses : null,
    raw
  };
}

// ─────────────────────────────────────────────────────────────
//  RECHERCHE PLEIN TEXTE
// ─────────────────────────────────────────────────────────────
/**
 * Recherche plein texte dans toutes les Bibles chargées.
 * @param {string} query - mots-clés (normalisés plus tard)
 * @param {string} scope - 'all' ou 'current-book' (utilise App.settings.currentBook)
 * @returns {Array<{ ref: string, text: string, book: string, chapter: string, verse: string }>}
 */
function searchFullText(query, scope = 'all') {
  if (!query.trim()) return [];
  const q = stripAccents(query.trim());
  const data = App.bibleData;
  if (!data) return [];

  const results = [];
  const books = scope === 'current-book' && App.settings.currentBook
    ? { [App.settings.currentBook]: data[App.settings.currentBook] }
    : data;

  for (const [book, chapters] of Object.entries(books)) {
    if (!chapters) continue;
    for (const [chapter, verses] of Object.entries(chapters)) {
      if (!verses) continue;
      for (const [verse, text] of Object.entries(verses)) {
        if (typeof text !== 'string') continue;
        if (stripAccents(text).includes(q)) {
          results.push({
            ref: `${book} ${chapter}:${verse}`,
            text: text,
            book,
            chapter,
            verse,
          });
          if (results.length >= 50) break;
        }
      }
      if (results.length >= 50) break;
    }
    if (results.length >= 50) break;
  }
  return results;
}