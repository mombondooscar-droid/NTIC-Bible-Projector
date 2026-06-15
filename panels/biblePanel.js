/**
 * ============================================================
 *  panels/biblePanel.js — Panneau Bible (orchestrateur + recherche)
 *  NTIC Bible Projector · US-R14 Sprint R4
 *  Dépendances globales :
 *    utils/bibleNavigation.js  → getFavRefsSet, loadBibleVersion, renderBooksGrid,
 *                               renderChaptersGrid, renderVersesList,
 *                               attachVerseCardEvents, _renderMobileStep,
 *                               renderMobileVersesList, _isMobileView
 *    utils/bibleProjection.js  → updatePipPreview, projectVerse, segmentVerse,
 *                               _projectSegment, _updateSegmentBar, syncNavToRef,
 *                               setPipEnabled, initPipDrag, _initHighlightToolbar
 *    utils/bibleHelpers.js     → stripAccents, levenshtein, BIBLE_BOOKS, parseRef,
 *                               searchFullText, buildVerseRef, parseVerseRef
 *    panels/bibleSearch.js     → currentSearchMode, displaySearchResults,
 *                               highlightText, handleFullTextSearch,
 *                               handleRefSearch, onSearchModeChange
 *    panels/bibleDual.js       → renderDualPanel, startAlternateMode, stopAlternateMode,
 *                               sendAlternateProjection (et autres fonctions dual)
 *    utils/dom.js              → esc, debounce, showToast, safePostMessage
 *    constants.js              → ICONS
 *    store.js                  → App
 *    db.js                     → db
 * ============================================================
 */

// ─────────────────────────────────────────────────────────────
//  AFFICHAGE DES RÉSULTATS DE RECHERCHE (dans bibleSearch.js)
//  MODE BILINGUE (dans bibleDual.js)
// ─────────────────────────────────────────────────────────────

// ═════════════════════════════════════════════════════════════
//  PANNEAU BIBLE (refonte responsive : 3 colonnes desktop / étapes mobile)
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
          <button class="btn btn-primary" id="go-settings">${ICONS.settings} Aller aux Paramètres</button>
        </div>
      </div>`;
    document.getElementById('go-settings')?.addEventListener('click', () => navigateTo('settings'));
    return;
  }

  // Badge dernière référence projetée
  const lastRefHtml = App.lastBibleRef
    ? `<div class="last-projected-badge" id="last-projected-ref" aria-label="Dernier verset projeté : ${esc(App.lastBibleRef)}">
         <span class="last-ref-icon">📌</span>
         <span class="last-ref-text">${esc(App.lastBibleRef)}</span>
       </div>`
    : '';

  // Bouton toggle mode bilingue (Demande #6)
  const toggleDualBtnHtml = `<button id="toggle-dual-mode" class="btn btn-sm btn-ghost">${App.dualMode ? '🔁 Mode bilingue (ON)' : '🔁 Mode bilingue (OFF)'}</button>`;

  if (_isMobileView) {
    // Mode mobile : navigation par étapes
    container.innerHTML = `
      <div class="panel panel-bible" id="panel-bible">
        <div class="bible-toolbar">
          <select id="bible-version-select" class="field-select" aria-label="Choisir une version de la Bible">
            ${bibleNames.map((n) => `<option value="${esc(n)}" ${n === activeBible ? 'selected' : ''}>${esc(n)}</option>`).join('')}
          </select>
          ${toggleDualBtnHtml}
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
          ${lastRefHtml}
        </div>

        <div class="bible-mobile-steps" id="bible-mobile-steps"></div>

        <div id="bible-search-results" class="bible-search-results hidden" aria-live="polite"></div>

        <!-- US-19 : Barre navigation segments (versets longs) -->
        <div id="verse-segment-bar" class="verse-segment-bar hidden" aria-label="Navigation segments">
          <button class="btn btn-sm btn-ghost seg-btn-prev" title="Segment précédent (←)">◀</button>
          <div class="verse-seg-dots"></div>
          <span class="verse-seg-info">1 / 1</span>
          <button class="btn btn-sm btn-ghost seg-btn-next" title="Segment suivant (→)">▶</button>
        </div>

        <!-- US-20 : Barre de surlignage (apparaît sur sélection de texte) -->
        <div id="highlight-toolbar" class="highlight-toolbar hidden" role="toolbar" aria-label="Surlignage">
          <div class="hl-colors">
            <button class="hl-color-btn active" data-color="#FFD700" style="background:#FFD700" title="Jaune or"></button>
            <button class="hl-color-btn"        data-color="#00e5ff" style="background:#00e5ff" title="Cyan"></button>
            <button class="hl-color-btn"        data-color="#FF8C00" style="background:#FF8C00" title="Orange"></button>
            <button class="hl-color-btn"        data-color="#00e676" style="background:#00e676" title="Vert"></button>
          </div>
          <button class="btn btn-sm btn-primary btn-hl-apply">🖊️ Surligner</button>
          <button class="btn btn-sm btn-ghost   btn-hl-clear">🧹 Effacer</button>
        </div>

        <!-- R#13 : CTA sticky projet -->
        <div class="panel-project-action">
          <button class="btn btn-primary" id="btn-project-selected-verse">
            ${ICONS.project} Envoyer le verset sélectionné
          </button>
        </div>
      </div>`;

    await loadBibleVersion(activeBible);
    // Réinitialiser l'étape mobile
    _mobileStep = 0;
    _selectedBook = null;
    _selectedChapter = null;
    _renderMobileStep();

  } else {
    // Mode desktop : 3 colonnes
    container.innerHTML = `
      <div class="panel panel-bible" id="panel-bible">
        <div class="bible-toolbar">
          <select id="bible-version-select" class="field-select" aria-label="Choisir une version de la Bible">
            ${bibleNames.map((n) => `<option value="${esc(n)}" ${n === activeBible ? 'selected' : ''}>${esc(n)}</option>`).join('')}
          </select>
          ${toggleDualBtnHtml}
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
          ${lastRefHtml}
        </div>

        <div class="bible-nav-grid bible-desktop-grid">
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

        <!-- US-19 : Barre navigation segments (versets longs) -->
        <div id="verse-segment-bar" class="verse-segment-bar hidden" aria-label="Navigation segments">
          <button class="btn btn-sm btn-ghost seg-btn-prev" title="Segment précédent (←)">◀</button>
          <div class="verse-seg-dots"></div>
          <span class="verse-seg-info">1 / 1</span>
          <button class="btn btn-sm btn-ghost seg-btn-next" title="Segment suivant (→)">▶</button>
        </div>

        <!-- US-20 : Barre de surlignage (apparaît sur sélection de texte) -->
        <div id="highlight-toolbar" class="highlight-toolbar hidden" role="toolbar" aria-label="Surlignage">
          <div class="hl-colors">
            <button class="hl-color-btn active" data-color="#FFD700" style="background:#FFD700" title="Jaune or"></button>
            <button class="hl-color-btn"        data-color="#00e5ff" style="background:#00e5ff" title="Cyan"></button>
            <button class="hl-color-btn"        data-color="#FF8C00" style="background:#FF8C00" title="Orange"></button>
            <button class="hl-color-btn"        data-color="#00e676" style="background:#00e676" title="Vert"></button>
          </div>
          <button class="btn btn-sm btn-primary btn-hl-apply">🖊️ Surligner</button>
          <button class="btn btn-sm btn-ghost   btn-hl-clear">🧹 Effacer</button>
        </div>

        <!-- R#13 : CTA sticky projet -->
        <div class="panel-project-action">
          <button class="btn btn-primary" id="btn-project-selected-verse">
            ${ICONS.project} Envoyer le verset sélectionné
          </button>
        </div>
      </div>`;

    await loadBibleVersion(activeBible);
    renderBooksGrid(Object.keys(App.bibleData || {}));
  }

  // Gestionnaires communs (recherche, segments, surlignage) – identiques quelque soit le mode
  bindCommonEventHandlers();

  // Bouton toggle bilingue
  const toggleBtn = document.getElementById('toggle-dual-mode');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', async () => {
      App.dualMode = !App.dualMode;
      if (!App.dualMode) {
        // Désactiver l'alternance si elle tournait
        if (App.dualConfig.intervalTimer) clearInterval(App.dualConfig.intervalTimer);
        App.dualConfig.intervalActive = false;
        App.dualConfig.intervalTimer = null;
        // Cacher l'UI dual et réafficher l'interface normale
        const dualPanel = document.getElementById('dual-panel');
        if (dualPanel) dualPanel.style.display = 'none';
        const normalGrid = document.querySelector('.bible-desktop-grid');
        if (normalGrid) normalGrid.style.display = '';
        // Recharger la vue normale
        await loadBibleVersion(App.settings.currentBible);
        renderBooksGrid(Object.keys(App.bibleData || {}));
      } else {
        // Activer le mode dual : cacher la grille normale, afficher le panneau dual
        const normalGrid = document.querySelector('.bible-desktop-grid');
        if (normalGrid) normalGrid.style.display = 'none';
        let dualPanel = document.getElementById('dual-panel');
        if (!dualPanel) {
          dualPanel = document.createElement('div');
          dualPanel.id = 'dual-panel';
          dualPanel.className = 'dual-panel';
          container.appendChild(dualPanel);
        }
        dualPanel.style.display = 'block';
        await renderDualPanel(dualPanel);
      }
      toggleBtn.innerHTML = App.dualMode ? '🔁 Mode bilingue (ON)' : '🔁 Mode bilingue (OFF)';
    });
  }
}

function bindCommonEventHandlers() {
  // Changement de version avec restauration contexte
  const versionSelect = document.getElementById('bible-version-select');
  if (versionSelect) {
    versionSelect.addEventListener('change', async (e) => {
      const newVersion = e.target.value;
      const savedBook = App.settings.currentBook;
      const savedChapter = App.settings.currentChapter;

      await db.saveSetting('currentBible', newVersion);
      await loadBibleVersion(newVersion);

      if (savedBook && App.bibleData?.[savedBook]) {
        const booksList = document.getElementById('books-list');
        const targetBookBtn = booksList?.querySelector(`.nav-item--book[data-book="${CSS.escape(savedBook)}"]`);
        if (targetBookBtn) {
          targetBookBtn.click();
          setTimeout(() => {
            const chaptersList = document.getElementById('chapters-list');
            if (savedChapter && App.bibleData?.[savedBook]?.[savedChapter]) {
              const targetChapterBtn = chaptersList?.querySelector(`.nav-item--chapter[data-chapter="${CSS.escape(savedChapter)}"]`);
              if (targetChapterBtn) targetChapterBtn.click();
              else {
                const firstChapter = chaptersList?.querySelector('.nav-item--chapter');
                if (firstChapter) firstChapter.click();
                showToast(`⚠ Chapitre ${savedChapter} introuvable dans ${savedBook}`, 'warning');
              }
            } else if (savedChapter) {
              showToast(`⚠ Chapitre ${savedChapter} introuvable dans ${savedBook}`, 'warning');
              const firstChapter = chaptersList?.querySelector('.nav-item--chapter');
              if (firstChapter) firstChapter.click();
            }
          }, 100);
        } else {
          showToast(`⚠ Livre ${savedBook} introuvable dans cette version`, 'warning');
        }
      } else if (savedBook) {
        showToast(`⚠ Livre ${savedBook} introuvable dans cette version`, 'warning');
      }
    });
  }

  // Gestionnaires recherche avancée (les fonctions sont dans bibleSearch.js)
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

  // US-19 : boutons Préc / Suiv de la barre segments
  document.querySelector('.seg-btn-prev')?.addEventListener('click', () => {
    if (App.currentSegments?.length > 1 && App.currentSegmentIndex > 0) {
      _projectSegment(App.currentSegments, App.currentSegmentIndex - 1, App.lastBibleRef);
    }
  });
  document.querySelector('.seg-btn-next')?.addEventListener('click', () => {
    if (App.currentSegments?.length > 1 && App.currentSegmentIndex < App.currentSegments.length - 1) {
      _projectSegment(App.currentSegments, App.currentSegmentIndex + 1, App.lastBibleRef);
    }
  });

  // US-19 : navigation clavier ← → pour les segments
  const _segKeyHandler = (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (!App.currentSegments || App.currentSegments.length <= 1) return;
    if (e.key === 'ArrowRight' && App.currentSegmentIndex < App.currentSegments.length - 1) {
      e.preventDefault();
      _projectSegment(App.currentSegments, App.currentSegmentIndex + 1, App.lastBibleRef);
    } else if (e.key === 'ArrowLeft' && App.currentSegmentIndex > 0) {
      e.preventDefault();
      _projectSegment(App.currentSegments, App.currentSegmentIndex - 1, App.lastBibleRef);
    }
  };
  document.removeEventListener('keydown', window._bibleSegKeyHandler);
  window._bibleSegKeyHandler = _segKeyHandler;
  document.addEventListener('keydown', _segKeyHandler);

  // US-20 : Initialiser la barre de surlignage
  _initHighlightToolbar();

  // R#13 : Bouton sticky projection du verset sélectionné
  const stickyBtn = document.getElementById('btn-project-selected-verse');
  if (stickyBtn) {
    stickyBtn.addEventListener('click', () => {
      if (App.selectedVerse && App.selectedVerse.text && App.selectedVerse.ref) {
        projectVerse(App.selectedVerse.text, App.selectedVerse.ref);
      } else {
        showToast('Aucun verset sélectionné. Cliquez sur un verset pour le sélectionner.', 'warning');
      }
    });
  }
}