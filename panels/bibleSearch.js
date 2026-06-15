/**
 * panels/bibleSearch.js — Recherche Bible (texte + référence + suggestions)
 * NTIC Bible Projector · US-R13 Sprint R4
 * Dépendances globales : App, esc, debounce, showToast, safePostMessage,
 *   projectVerse (utils/bibleProjection.js), BIBLE_BOOKS, stripAccents,
 *   levenshtein, parseRef, searchFullText (utils/bibleHelpers.js), ICONS
 * Scope global — chargé AVANT panels/biblePanel.js dans index.html
 */

// ─────────────────────────────────────────────────────────────
//  ÉTAT LOCAL DE RECHERCHE
// ─────────────────────────────────────────────────────────────
let currentSearchMode = 'text';

// ─────────────────────────────────────────────────────────────
//  FONCTIONS DE RECHERCHE
// ─────────────────────────────────────────────────────────────

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
        <button class="btn btn-sm btn-ghost search-close" aria-label="Fermer">${ICONS.close}</button>
      </div>
      ${results.map(r => {
        const highlighted = highlightText(r.text, document.getElementById('search-fulltext')?.value || '');
        return `
          <div class="search-result-card">
            <div class="search-result-ref">${esc(r.ref)}</div>
            <p class="search-result-text">${highlighted}</p>
            <button class="btn btn-sm btn-primary btn-sr-project"
                    data-text="${esc(r.text)}" data-ref="${esc(r.ref)}">${ICONS.project} Envoyer à l'écran</button>
          </div>`;
      }).join('')}
    `;
  } else { // mode référence
    container.innerHTML = `
      <div class="search-count">${results.length} résultat${results.length > 1 ? 's' : ''}
        <button class="btn btn-sm btn-ghost search-close" aria-label="Fermer">${ICONS.close}</button>
      </div>
      ${results.map(r => `
        <div class="search-result-card">
          <div class="search-result-ref">${esc(r.ref)}</div>
          <p class="search-result-text">${esc(r.text.substring(0, 150))}${r.text.length > 150 ? '…' : ''}</p>
          <button class="btn btn-sm btn-primary btn-sr-project"
                  data-text="${esc(r.text)}" data-ref="${esc(r.ref)}">${ICONS.project} Envoyer à l'écran</button>
        </div>
      `).join('')}
    `;
  }
  container.classList.remove('hidden');
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
  container.querySelectorAll('.btn-sr-project').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = btn.dataset.text;
      const ref  = btn.dataset.ref;
      projectVerse(text, ref);
      // Mettre à jour la sélection courante
      App.selectedVerse = { text, ref };
    });
  });
}

function highlightText(text, query) {
  if (!query || query.length < 2) return esc(text);
  const q = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${q})`, 'gi');
  return esc(text).replace(re, '<mark>$1</mark>');
}

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
        handleRefSearch();
      });
    });
  } else {
    suggestionsList.hidden = true;
  }
  const parsed = parseRef(raw);
  if (parsed && App.bibleData && App.bibleData[parsed.book] && App.bibleData[parsed.book][parsed.chapter]) {
    let verseText = '';
    if (parsed.verse && App.bibleData[parsed.book][parsed.chapter][parsed.verse]) {
      verseText = App.bibleData[parsed.book][parsed.chapter][parsed.verse];
      displaySearchResults([{ ref: `${parsed.book} ${parsed.chapter}:${parsed.verse}`, text: verseText, book: parsed.book, chapter: parsed.chapter, verse: parsed.verse }], 'ref');
    } else if (!parsed.verse) {
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
    if (resultsDiv) resultsDiv.classList.add('hidden');
  }
}