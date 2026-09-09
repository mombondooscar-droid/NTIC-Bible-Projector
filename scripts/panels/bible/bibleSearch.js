/**
 * scripts/panels/bible/bibleSearch.js — Recherche biblique (texte + référence)
 * NTIC Bible Projector · US-REFACTOR-01
 * Extrait de scripts/panels/bible/biblePanel.js
 * Dépendances globales : App, db, stripAccents, levenshtein,
 *   BIBLE_BOOKS, parseRef, parseRefExtended, searchFullText,
 *   projectVerse, updateStagingPanel (window), showToast, debounce, esc,
 *   ICONS
 */

function initSearchFeatures() {
  const textInput = document.getElementById('search-fulltext');
  const refInput = document.getElementById('search-ref-input');
  const btnText = document.getElementById('btn-search-text');
  const btnRef = document.getElementById('btn-search-ref');
  const scopeSelect = document.getElementById('search-scope');
  const resultsContainer = document.getElementById('search-results');
  const suggestionsList = document.getElementById('book-suggestions');

  if (!textInput || !refInput) return;

  const setMode = (mode) => {
    const isText = mode === 'text';
    textInput.style.display = isText ? '' : 'none';
    refInput.style.display = isText ? 'none' : '';
    btnText.className = `btn btn-sm ${isText ? 'btn-primary' : 'btn-ghost'}`;
    btnRef.className = `btn btn-sm ${isText ? 'btn-ghost' : 'btn-primary'}`;
    document.getElementById('search-scope').style.display = isText ? '' : 'none';
    resultsContainer.style.display = 'none';
    suggestionsList.hidden = true;
    if (isText) {
      textInput.focus();
      textInput.value = '';
    } else {
      refInput.focus();
      refInput.value = '';
    }
  };

  btnText.addEventListener('click', () => setMode('text'));
  btnRef.addEventListener('click', () => setMode('ref'));

  const debouncedTextSearch = debounce(() => {
    const query = textInput.value.trim();
    if (!query) {
      resultsContainer.style.display = 'none';
      return;
    }
    const scope = scopeSelect.value;
    const results = searchFullText(query, scope);
    if (results.length === 0) {
      resultsContainer.innerHTML = `<div class="search-empty">Aucun résultat</div>`;
      resultsContainer.style.display = 'block';
      return;
    }
    const qWords = stripAccents(query).split(/\s+/).filter(w => w.length > 1);
    const highlightText = (txt) => {
      let highlighted = txt;
      qWords.forEach(word => {
        const regex = new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        highlighted = highlighted.replace(regex, '<mark>$1</mark>');
      });
      return highlighted;
    };
    resultsContainer.innerHTML = `
      <div class="search-count">${results.length} résultat${results.length > 1 ? 's' : ''}</div>
      ${results.map(r => `
        <div class="search-result-card" data-ref="${esc(r.ref)}" data-text="${esc(r.text)}" data-book="${esc(r.book)}" data-chapter="${esc(r.chapter)}" data-verse="${esc(r.verse)}">
          <div class="search-result-ref">${esc(r.ref)}</div>
          <div class="search-result-text">${highlightText(r.text)}</div>
          <button class="btn btn-sm btn-primary btn-project-result" data-ref="${esc(r.ref)}" data-text="${esc(r.text)}">
            ${ICONS.project} Projeter
          </button>
        </div>
      `).join('')}
    `;
    resultsContainer.style.display = 'block';
    resultsContainer.querySelectorAll('.btn-project-result').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const ref = btn.dataset.ref;
        const text = btn.dataset.text;
        if (ref && text) {
          projectVerse(text, ref);
          if (typeof updateStagingPanel === 'function') {
            updateStagingPanel(text, ref);
          }
          resultsContainer.style.display = 'none';
        }
      });
    });
  }, 300);

  textInput.addEventListener('input', debouncedTextSearch);

  // Recherche par référence — autocomplete amélioré
  const updateSuggestions = debounce(() => {
    const raw = refInput.value.trim();
    if (raw.length < 2) {
      suggestionsList.hidden = true;
      return;
    }
    const norm = stripAccents(raw);
    const suggestions = [];
    // Parcourir les livres pour trouver des correspondances (exactes ou par Levenshtein)
    for (const b of BIBLE_BOOKS) {
      const fullNorm = stripAccents(b.full);
      if (b.abbr.some(a => stripAccents(a) === norm) ||
          fullNorm === norm ||
          b.aliases.some(al => stripAccents(al) === norm)) {
        suggestions.push(b.full);
      }
    }
    if (suggestions.length === 0) {
      for (const b of BIBLE_BOOKS) {
        const fullNorm = stripAccents(b.full);
        if (levenshtein(norm, fullNorm) <= 2) {
          suggestions.push(b.full);
          if (suggestions.length >= 5) break;
        }
      }
    }
    if (suggestions.length > 0) {
      suggestionsList.innerHTML = suggestions.map(s =>
        `<li class="suggestion-item" data-book="${esc(s)}">${esc(s)}</li>`
      ).join('');
      suggestionsList.hidden = false;
      suggestionsList.querySelectorAll('.suggestion-item').forEach(li => {
        li.addEventListener('click', () => {
          refInput.value = li.dataset.book + ' ';
          suggestionsList.hidden = true;
          refInput.focus();
          handleRefSearch();
        });
      });
    } else {
      suggestionsList.hidden = true;
    }
  }, 200);

  refInput.addEventListener('input', updateSuggestions);

  const handleRefSearch = () => {
    const raw = refInput.value.trim();
    if (!raw) {
      resultsContainer.style.display = 'none';
      return;
    }
    const parsed = parseRefExtended(raw);
    if (!parsed) {
      resultsContainer.innerHTML = `
        <div class="search-empty">
          ⚠️ Référence non reconnue. Essayez le mode <strong>Texte</strong> pour une recherche par mots-clés.
          <br>
          <button class="btn btn-sm btn-primary" id="switch-to-text-btn">${ICONS.bible} Basculer en mode Texte</button>
        </div>
      `;
      resultsContainer.style.display = 'block';
      document.getElementById('switch-to-text-btn')?.addEventListener('click', () => setMode('text'));
      return;
    }
    const { book, chapter, verses } = parsed;
    if (!App.bibleData?.[book]) {
      resultsContainer.innerHTML = `<div class="search-empty">📕 Livre "${book}" introuvable dans la version actuelle.</div>`;
      resultsContainer.style.display = 'block';
      return;
    }
    if (chapter === null) {
      const booksList = document.getElementById('books-list');
      if (booksList) {
        const bookBtn = booksList.querySelector(`.nav-item--book[data-book="${CSS.escape(book)}"]`);
        if (bookBtn) bookBtn.click();
      }
      resultsContainer.innerHTML = `<div class="search-empty">📖 Navigation vers <strong>${book}</strong>.</div>`;
      resultsContainer.style.display = 'block';
      refInput.value = '';
      suggestionsList.hidden = true;
      return;
    }
    if (!App.bibleData[book][chapter]) {
      resultsContainer.innerHTML = `<div class="search-empty">⚠️ Chapitre ${chapter} introuvable dans ${book}.</div>`;
      resultsContainer.style.display = 'block';
      const booksList = document.getElementById('books-list');
      if (booksList) {
        const bookBtn = booksList.querySelector(`.nav-item--book[data-book="${CSS.escape(book)}"]`);
        if (bookBtn) bookBtn.click();
      }
      return;
    }
    if (verses === null || verses.length === 0) {
      const booksList = document.getElementById('books-list');
      if (booksList) {
        const bookBtn = booksList.querySelector(`.nav-item--book[data-book="${CSS.escape(book)}"]`);
        if (bookBtn) bookBtn.click();
      }
      setTimeout(() => {
        const chaptersList = document.getElementById('chapters-list');
        if (chaptersList) {
          const chBtn = chaptersList.querySelector(`.nav-item--chapter[data-chapter="${CSS.escape(chapter)}"]`);
          if (chBtn) chBtn.click();
        }
      }, 100);
      resultsContainer.innerHTML = `<div class="search-empty">📑 Navigation vers <strong>${book} ${chapter}</strong>.</div>`;
      resultsContainer.style.display = 'block';
      refInput.value = '';
      suggestionsList.hidden = true;
      return;
    }
    const existingVerses = verses.filter(v => {
      const vStr = String(v);
      return App.bibleData[book][chapter].hasOwnProperty(vStr);
    });
    if (existingVerses.length === 0) {
      resultsContainer.innerHTML = `<div class="search-empty">⚠️ Aucun verset trouvé pour ${book} ${chapter}.</div>`;
      resultsContainer.style.display = 'block';
      const booksList = document.getElementById('books-list');
      if (booksList) {
        const bookBtn = booksList.querySelector(`.nav-item--book[data-book="${CSS.escape(book)}"]`);
        if (bookBtn) bookBtn.click();
      }
      setTimeout(() => {
        const chaptersList = document.getElementById('chapters-list');
        if (chaptersList) {
          const chBtn = chaptersList.querySelector(`.nav-item--chapter[data-chapter="${CSS.escape(chapter)}"]`);
          if (chBtn) chBtn.click();
        }
      }, 100);
      return;
    }
    const firstVerse = existingVerses[0];
    const firstRef = `${book} ${chapter}:${firstVerse}`;
    const firstText = App.bibleData[book][chapter][String(firstVerse)];
    projectVerse(firstText, firstRef);
    if (typeof updateStagingPanel === 'function') {
      updateStagingPanel(firstText, firstRef);
    }
    let resultsHtml = `
      <div class="search-count">
        ${existingVerses.length} verset${existingVerses.length > 1 ? 's' : ''} trouvé${existingVerses.length > 1 ? 's' : ''}
        <span style="font-size:0.7rem; color:var(--text-muted); margin-left:8px;">Le premier a été projeté</span>
      </div>
    `;
    existingVerses.forEach((v, idx) => {
      const ref = `${book} ${chapter}:${v}`;
      const text = App.bibleData[book][chapter][String(v)];
      const isFirst = idx === 0;
      resultsHtml += `
        <div class="search-result-card" data-ref="${esc(ref)}" data-text="${esc(text)}" style="${isFirst ? 'border-left:3px solid var(--primary);' : ''}">
          <div class="search-result-ref">${esc(ref)} ${isFirst ? '<span style="font-size:0.7rem; background:var(--primary); color:white; padding:0 6px; border-radius:4px; margin-left:6px;">Projeté</span>' : ''}</div>
          <div class="search-result-text">${esc(text)}</div>
          <button class="btn btn-sm btn-primary btn-project-result" data-ref="${esc(ref)}" data-text="${esc(text)}">
            ${ICONS.project} Projeter
          </button>
        </div>
      `;
    });
    resultsContainer.innerHTML = resultsHtml;
    resultsContainer.style.display = 'block';
    resultsContainer.querySelectorAll('.btn-project-result').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const ref = btn.dataset.ref;
        const text = btn.dataset.text;
        if (ref && text) {
          projectVerse(text, ref);
          if (typeof updateStagingPanel === 'function') {
            updateStagingPanel(text, ref);
          }
          resultsContainer.querySelectorAll('.search-result-card').forEach(c => {
            c.style.borderLeft = '';
            const badge = c.querySelector('.search-result-ref span');
            if (badge && badge.textContent.includes('Projeté')) badge.remove();
          });
          const card = btn.closest('.search-result-card');
          if (card) {
            card.style.borderLeft = '3px solid var(--primary)';
            const refDiv = card.querySelector('.search-result-ref');
            if (refDiv) {
              const badge = document.createElement('span');
              badge.style.cssText = 'font-size:0.7rem; background:var(--primary); color:white; padding:0 6px; border-radius:4px; margin-left:6px;';
              badge.textContent = 'Projeté';
              refDiv.appendChild(badge);
            }
          }
        }
      });
    });
    const booksList = document.getElementById('books-list');
    if (booksList) {
      const bookBtn = booksList.querySelector(`.nav-item--book[data-book="${CSS.escape(book)}"]`);
      if (bookBtn) bookBtn.click();
    }
    setTimeout(() => {
      const chaptersList = document.getElementById('chapters-list');
      if (chaptersList) {
        const chBtn = chaptersList.querySelector(`.nav-item--chapter[data-chapter="${CSS.escape(chapter)}"]`);
        if (chBtn) chBtn.click();
      }
    }, 100);
    refInput.value = '';
    suggestionsList.hidden = true;
  };

  refInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      suggestionsList.hidden = true;
      handleRefSearch();
    }
    if (e.key === 'Escape') {
      suggestionsList.hidden = true;
    }
  });

  document.addEventListener('click', (e) => {
    const searchBar = document.querySelector('.search-bar');
    if (searchBar && !searchBar.contains(e.target)) {
      suggestionsList.hidden = true;
    }
  });
}