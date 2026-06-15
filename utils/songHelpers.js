/**
 * ============================================================
 *  utils/songHelpers.js — Helpers chants / strophes
 *  NTIC Bible Projector · Extrait de app.js (refactoring SP-13)
 *  Scope global (pas de module) — chargé avant app.js
 * ============================================================
 */

// ─────────────────────────────────────────────────────────────
//  PARSE / RECONSTRUCT STROPHES
// ─────────────────────────────────────────────────────────────
/**
 * Découpe un texte brut en tableau de strophes.
 * Les blocs sont séparés par une ligne vide.
 * Les lignes préfixées par '*' sont des traductions.
 *
 * @param {string} text
 * @returns {Array<{ lines: string[], translations: string[] }>}
 */
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

/**
 * Reconstruit un texte brut depuis un tableau de strophes.
 * Inverse de parseStrophes().
 *
 * @param {Array<{ lines: string[], translations: string[] }>} strophes
 * @returns {string}
 */
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

// ─────────────────────────────────────────────────────────────
//  BUILD ALL STROPHES TEXTS
// ─────────────────────────────────────────────────────────────
/**
 * Convertit un tableau de strophes en tableau de chaînes de texte
 * affichables, une entrée par strophe (lignes + traductions entrelacées).
 *
 * Factorise le pattern répété 3× dans app.js (slide-prev, slide-next,
 * btn-project-slide) et 1× dans renderFavoritesPanel.
 *
 * Équivalent inline supprimé :
 *   const allStrophesTexts = strophes.map(st => {
 *     let txt = '';
 *     (st.lines ?? []).forEach((line, i) => {
 *       txt += line;
 *       if (st.translations?.[i]) txt += '\n*' + st.translations[i];
 *       if (i < (st.lines ?? []).length - 1) txt += '\n';
 *     });
 *     return txt;
 *   });
 *
 * @param {Array<{ lines: string[], translations: string[] }>} strophes
 * @returns {string[]}
 */
function buildAllStrophesTexts(strophes) {
  return (strophes ?? []).map((st) => {
    const lines = st.lines ?? [];
    let txt = '';
    lines.forEach((line, i) => {
      txt += line;
      if (st.translations?.[i]) txt += '\n*' + st.translations[i];
      if (i < lines.length - 1) txt += '\n';
    });
    return txt;
  });
}
