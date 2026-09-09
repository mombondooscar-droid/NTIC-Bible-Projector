/**
 * scripts/panels/bible/biblePanel.js — Panneau Bible (orchestrateur)
 * NTIC Bible Projector · US-REFACTOR-02
 * Version refactorisée : délègue aux modules spécialisés.
 * SUPPRESSION DE LA STAGING ZONE (Demande #2)
 */

async function renderBiblePanel(container) {
  const bibleNames  = await db.getAllBibleNames();
  const savedBible  = await db.getSetting('currentBible');
  const activeBible = savedBible || bibleNames[0] || null;

  const [
    savedMode, savedSecondVersion,
    savedExpRef, savedExpVersion, savedExpText,
    savedExpBook, savedExpChapter, savedExpVerse, savedExpRefFull,
  ] = await Promise.all([
    db.getSetting('activeDisplayMode', 'normal'),
    db.getSetting('bilingualSecondVersion', null),
    db.getSetting('explanatoryReference', ''),
    db.getSetting('explanatoryVersion', null),
    db.getSetting('explanatoryText', ''),
    db.getSetting('explanatoryBook', ''),
    db.getSetting('explanatoryChapter', ''),
    db.getSetting('explanatoryVerse', ''),
    db.getSetting('explanatoryRef', ''),
  ]);
  App.activeDisplayMode        = savedMode || 'normal';
  App.bilingual.secondVersion  = savedSecondVersion || null;
  App.explanatory.reference    = savedExpRef    || '';
  App.explanatory.version      = savedExpVersion || null;
  App.explanatory.text         = savedExpText   || '';
  App.explanatory.book         = savedExpBook   || '';
  App.explanatory.chapter      = savedExpChapter || '';
  App.explanatory.verse        = savedExpVerse  || '';
  App.explanatory.ref          = savedExpRefFull || '';

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

  const lastRefHtml = App.lastBibleRef
    ? `<div class="last-projected-badge" id="last-projected-ref" aria-label="Dernier verset projeté : ${esc(App.lastBibleRef)}">
         <span class="last-ref-icon">📌</span>
         <span class="last-ref-text">${esc(App.lastBibleRef)}</span>
       </div>`
    : '';

  const displayModesToolbarHtml = _buildDisplayModesToolbarHtml();

  const versionPickerHtml = `
    <div class="bible-version-picker" id="bible-version-picker-wrap">
      <button class="bible-version-btn" id="bible-version-btn"
              aria-haspopup="listbox" aria-expanded="false"
              title="Choisir la version de la Bible">
        📖 <span class="version-picker-label" id="bible-version-btn-label">${esc(activeBible || '—')}</span>
        <span class="version-picker-arrow">▾</span>
        ${bibleNames.length > 1 ? `<span class="bible-version-badge">${bibleNames.length}</span>` : ''}
      </button>
      <div class="bible-version-dropdown" id="bible-version-dropdown" role="listbox" aria-label="Versions disponibles">
        ${bibleNames.map((n) => `
          <div class="bible-version-option ${n === activeBible ? 'active' : ''}"
               data-version="${esc(n)}" role="option"
               aria-selected="${n === activeBible ? 'true' : 'false'}">
            <span class="version-icon">📖</span>
            <span>${esc(n)}</span>
            ${n === activeBible ? '<span class="version-check">✓</span>' : ''}
          </div>`).join('')}
      </div>
    </div>`;

  // Fusion de la barre de recherche et de la toolbar
  const unifiedToolbarHtml = `
    <div class="bible-toolbar" style="display:flex; flex-wrap:wrap; gap:8px; align-items:center; padding:8px 12px; background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-sm); margin-bottom:12px;">
      ${versionPickerHtml}
      ${lastRefHtml}
      <div style="flex:1; min-width:160px; display:flex; gap:4px;">
        <button class="btn btn-sm btn-primary" id="btn-search-text" data-mode="text">Texte</button>
        <button class="btn btn-sm btn-ghost" id="btn-search-ref" data-mode="ref">Référence</button>
      </div>
      <select id="search-scope" class="field-select" style="max-width:120px; font-size:0.8rem;">
        <option value="all">Toute</option>
        <option value="current-book">Livre courant</option>
      </select>
      <input type="search" id="search-fulltext" class="field-input" placeholder="Mots-clés…" style="flex:2; min-width:120px;">
      <input type="search" id="search-ref-input" class="field-input" placeholder="Ex: Jn 3:16" style="flex:2; min-width:120px; display:none;">
      <ul id="book-suggestions" class="suggestions-list" hidden></ul>
      <div id="search-results" style="width:100%; display:none; margin-top:8px;"></div>
    </div>`;

  const isMobile = window.matchMedia('(max-width: 767px)').matches;

  if (isMobile) {
    container.innerHTML = `
      <div class="panel panel-bible" id="panel-bible">
        ${unifiedToolbarHtml}
        ${displayModesToolbarHtml}
        <div class="bible-mobile-steps" id="bible-mobile-steps"></div>
        <div id="verse-segment-bar" class="verse-segment-bar hidden" aria-label="Navigation segments">
          <button class="btn btn-sm btn-ghost seg-btn-prev" title="Segment précédent (←)">◀</button>
          <div class="verse-seg-dots"></div>
          <span class="verse-seg-info">1 / 1</span>
          <button class="btn btn-sm btn-ghost seg-btn-next" title="Segment suivant (→)">▶</button>
        </div>
        <!-- STAGING ZONE SUPPRIMÉE -->
      </div>`;
    await loadBibleVersion(activeBible);
    window._mobileStep = 0;
    window._selectedBook = null;
    window._selectedChapter = null;
    window._renderMobileStep();
  } else {
    container.innerHTML = `
      <div class="panel panel-bible" id="panel-bible">
        ${unifiedToolbarHtml}
        ${displayModesToolbarHtml}
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
        <div id="verse-segment-bar" class="verse-segment-bar hidden" aria-label="Navigation segments">
          <button class="btn btn-sm btn-ghost seg-btn-prev" title="Segment précédent (←)">◀</button>
          <div class="verse-seg-dots"></div>
          <span class="verse-seg-info">1 / 1</span>
          <button class="btn btn-sm btn-ghost seg-btn-next" title="Segment suivant (→)">▶</button>
        </div>
        <!-- STAGING ZONE SUPPRIMÉE -->
      </div>`;
    await loadBibleVersion(activeBible);
    renderBooksGrid(Object.keys(App.bibleData || {}));
  }

  if (typeof initDisplayModes === 'function') {
    initDisplayModes(container);
  }
  if (typeof initSearchFeatures === 'function') {
    initSearchFeatures();
  }
  if (typeof initVersionPicker === 'function') {
    initVersionPicker();
  }
  if (typeof initBibleCommonEvents === 'function') {
    initBibleCommonEvents();
  }
  if (App.selectedVerse?.text && App.selectedVerse?.ref) {
    updateStagingPanel(App.selectedVerse.text, App.selectedVerse.ref);
  }
}

window.renderBiblePanel = renderBiblePanel;