/**
 * utils/bibleNavigation.js — Navigation Bible (livres / chapitres / versets / mobile)
 * NTIC Bible Projector · US-R11 Sprint R3
 * + US-2.9 : Amélioration navigation clavier — utilisation de projectSegmentOnly()
 * + Refonte attachVerseCardEvents() : clic carte = projection immédiate, clic segment = LT segment, projection verset entier
 * + Navigation clavier ↑↓ : segment suivant/précédent, bord = verset suivant/précédent
 * + UX mobile : barre inférieure avec retour et saisie directe
 * Dépendances globales : db, App, esc, showToast, safePostMessage,
 *   updatePipPreview (utils/bibleProjection.js),
 *   projectVerse (utils/bibleProjection.js),
 *   renderBiblePanel (panels/biblePanel.js — runtime only),
 *   ICONS, segmentVerse, _projectSegment, buildVerseRef, getFavRefsSet
 * Scope global — chargé AVANT panels/ dans index.html
 */

// ─────────────────────────────────────────────────────────────
//  VARIABLES D'ÉTAT (navigation mobile par étapes)
// ─────────────────────────────────────────────────────────────
let _mobileStep = 0;           // 0: livres, 1: chapitres, 2: versets
let _selectedBook = null;
let _selectedChapter = null;
let _isMobileView = window.matchMedia('(max-width: 767px)').matches;

// Détection des changements d'orientation / taille
window.matchMedia('(max-width: 767px)').addEventListener('change', (e) => {
  _isMobileView = e.matches;
  renderBiblePanel(document.getElementById('app'));
});

// ─────────────────────────────────────────────────────────────
//  HELPER : cache de refs favoris (optimisation US-06)
// ─────────────────────────────────────────────────────────────
async function getFavRefsSet() {
  const favs = await dataService.getAllFavorites();
  return new Set(favs.map((f) => f.ref));
}

// ─────────────────────────────────────────────────────────────
//  CHARGEMENT VERSION BIBLE
// ─────────────────────────────────────────────────────────────
async function loadBibleVersion(name) {
  if (!name) return;
  App.settings.currentBible = name;

  const data = await db.getBible(name);
  if (!data) return;

  App.bibleData           = data;
  App.settings.currentBook    = null;
  App.settings.currentChapter = null;

  if (!_isMobileView) {
    renderBooksGrid(Object.keys(data));
  } else {
    _mobileStep = 0;
    _selectedBook = null;
    _selectedChapter = null;
    _renderMobileStep();
  }
}

// ─────────────────────────────────────────────────────────────
//  GRILLES LIVRES / CHAPITRES / VERSETS (desktop)
// ─────────────────────────────────────────────────────────────
function renderBooksGrid(books) {
  const list = document.getElementById('books-list');
  if (!list) return;

  list.innerHTML = books.map((book) => `
    <button class="nav-item nav-item--book" data-book="${esc(book)}"
            title="${esc(book)}" aria-label="Livre ${esc(book)}">
      ${esc(book)}
    </button>`).join('');

  list.querySelectorAll('.nav-item--book').forEach((btn) => {
    btn.addEventListener('click', () => {
      list.querySelectorAll('.nav-item--book').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      App.settings.currentBook    = btn.dataset.book;
      App.settings.currentChapter = null;
      renderChaptersGrid(btn.dataset.book);
    });
  });

  if (list.querySelector('.nav-item--book')) list.querySelector('.nav-item--book').click();
}

function renderChaptersGrid(book) {
  const list = document.getElementById('chapters-list');
  if (!list || !App.bibleData?.[book]) return;

  const chapters = Object.keys(App.bibleData[book]);
  list.innerHTML  = chapters.map((ch) => `
    <button class="nav-item nav-item--chapter" data-chapter="${esc(ch)}"
            aria-label="Chapitre ${ch}">${ch}</button>`).join('');

  list.querySelectorAll('.nav-item--chapter').forEach((btn) => {
    btn.addEventListener('click', () => {
      list.querySelectorAll('.nav-item--chapter').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      App.settings.currentChapter = btn.dataset.chapter;
      renderVersesList(book, btn.dataset.chapter);
    });
  });

  if (list.querySelector('.nav-item--chapter')) list.querySelector('.nav-item--chapter').click();
}

async function renderVersesList(book, chapter) {
  const list = document.getElementById('verses-list');
  if (!list) return;

  const verses = App.bibleData?.[book]?.[chapter];
  if (!verses) { list.innerHTML = ''; return; }

  list.innerHTML = '<div class="spinner-sm"></div>';

  const favRefs   = await getFavRefsSet();
  const verseNums = Object.keys(verses);
  const SEG_ALPHA = 'abcdefghijklmnopqrstuvwxyz';

  list.innerHTML = verseNums.map((num) => {
    const ref       = buildVerseRef(book, chapter, num);
    const isFav     = favRefs.has(ref);
    const verseText = verses[num];
    const segments  = segmentVerse(verseText);
    const refStr    = `${book} ${chapter}:${num}`;

    const segmentsHtml = segments.length > 1
      ? `<div class="verse-segments-grid" aria-label="Segments du verset ${num}">
          ${segments.map((seg, idx) => {
            const lbl = (SEG_ALPHA[idx] || String(idx + 1)) + num;
            return `<div class="seg-cell"
                         data-seg-idx="${idx}"
                         data-seg-ref="${esc(refStr)}"
                         data-seg-total="${segments.length}"
                         role="button"
                         aria-label="Segment ${lbl}">
              <span class="seg-cell-label">${esc(lbl)}</span>${esc(seg)}
            </div>`;
          }).join('')}
        </div>`
      : '';

    return `
      <div class="verse-card" data-ref="${esc(ref)}"
           data-book="${esc(book)}" data-chapter="${esc(chapter)}" data-verse="${esc(num)}"
           data-text="${esc(verseText)}">
        <div class="verse-card-actions">
          <button class="btn-star ${isFav ? 'starred' : ''}"
                  data-ref="${esc(ref)}" data-type="verse"
                  data-book="${esc(book)}" data-chapter="${esc(chapter)}" data-verse="${esc(num)}"
                  aria-label="${isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}"
                  aria-pressed="${isFav}">
            ${isFav ? '★' : '☆'}
          </button>
          <button class="btn btn-ghost btn-sm btn-copy-verse-icon"
                  data-text="${esc(verseText)}"
                  title="Copier le texte de ce verset"
                  aria-label="Copier le texte de ce verset">${ICONS.copy}</button>
        </div>
        <p class="verse-text"><strong>${num}.</strong> ${esc(verseText)}</p>
        ${segmentsHtml}
      </div>`;
  }).join('');

  attachVerseCardEvents(list);
}

// ─────────────────────────────────────────────────────────────
//  ÉVÉNEMENTS CARTES VERSETS — REFONTE COMPLÈTE (Sujet 4)
// ─────────────────────────────────────────────────────────────
function attachVerseCardEvents(container) {
  // ── Clic sur la carte principale (le verset entier) ──
  container.querySelectorAll('.verse-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.btn-star') || e.target.closest('.seg-cell') || e.target.closest('.btn-copy-verse-icon')) return;

      const book    = card.dataset.book;
      const chapter = card.dataset.chapter;
      const verse   = card.dataset.verse;
      const text    = card.dataset.text;
      if (!book || !chapter || !verse || !text) return;

      const ref = `${book} ${chapter}:${verse}`;

      App.currentSegments = segmentVerse(text);
      App.currentSegmentIndex = 0;
      App.selectedVerse = { text, ref };

      projectVerse(text, ref);

      syncNavToRef(ref);

      if (typeof updateStagingPanel === 'function') {
        updateStagingPanel(text, ref);
      }

      container.querySelectorAll('.verse-card').forEach(c => c.classList.remove('selected-verse'));
      card.classList.add('selected-verse');
      card.querySelectorAll('.seg-cell').forEach(c => c.classList.remove('active', 'seg-cell--active'));
    });
  });

  // ── Favoris ★ (migré vers dataService pour cohérence mode serveur) ──
  container.querySelectorAll('.btn-star').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const { ref, book, chapter, verse } = btn.dataset;
      const verses = App.bibleData[book]?.[chapter];
      const wasStarred = btn.classList.contains('starred');
      if (wasStarred) {
        await dataService.removeFavorite(ref);
        btn.classList.remove('starred');
        btn.textContent = '☆';
        btn.setAttribute('aria-label', 'Ajouter aux favoris');
        btn.setAttribute('aria-pressed', 'false');
      } else {
        await dataService.addFavorite({
          type: 'verse', ref, label: '',
          title: `${book} ${chapter}:${verse}`,
          content: verses?.[verse] ?? '',
        });
        btn.classList.add('starred');
        btn.textContent = '★';
        btn.setAttribute('aria-label', 'Retirer des favoris');
        btn.setAttribute('aria-pressed', 'true');
        showToast('★ Ajouté aux favoris', 'success');
      }
    });
  });

  // ── Copier texte (inchangé) ──────────────────────────────
  container.querySelectorAll('.btn-copy-verse-icon').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const text = btn.dataset.text;
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        showToast('✅ Verset copié', 'success', 1500);
      } catch (err) {
        console.warn('Copie échouée', err);
        showToast('⚠ Copie non disponible', 'warning');
      }
    });
  });

  // ── Clic sur un segment ───────────────────────────────────
  container.querySelectorAll('.seg-cell').forEach((cell) => {
    cell.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = cell.closest('.verse-card');
      if (!card) return;
      const verseText = card.dataset.text ?? '';
      const refStr = cell.dataset.segRef;
      const idx = parseInt(cell.dataset.segIdx, 10);
      const segments = segmentVerse(verseText);
      const segmentText = segments[idx] || '';

      App.currentSegments = segments;
      App.currentSegmentIndex = idx;
      App.selectedVerse = { text: verseText, ref: refStr };

      safePostMessage({
        type: 'show-verse',
        data: {
          reference: refStr,
          text: verseText,
          style: {
            ltType:         App.settings.ltType,
            refColor:       App.settings.ltRefColor,
            verseColor:     App.settings.ltVerseColor,
            fontFamily:     App.settings.ltFontFamily,
            width:          App.settings.ltWidth,
            height:         App.settings.ltHeight,
            refFontSize:    App.settings.ltRefSize,
            verseFontSize:  App.settings.ltVerseSize,
          },
        },
      });

      safePostMessage({
        type: 'verse:segment',
        segmentIndex: idx,
        segmentText: segmentText,
        totalSegments: segments.length,
        reference: refStr,
        style: {
          ltType:         App.settings.ltType,
          refColor:       App.settings.ltRefColor,
          verseColor:     App.settings.ltVerseColor,
          fontFamily:     App.settings.ltFontFamily,
          width:          App.settings.ltWidth,
          height:         App.settings.ltHeight,
          refFontSize:    App.settings.ltRefSize,
          verseFontSize:  App.settings.ltVerseSize,
        },
      });

      _updateSegmentBar(segments, idx);
      card.querySelectorAll('.seg-cell').forEach(c => c.classList.remove('active', 'seg-cell--active'));
      cell.classList.add('active', 'seg-cell--active');

      syncNavToRef(refStr);

      if (typeof updateStagingPanel === 'function') {
        updateStagingPanel(segmentText, refStr);
      }

      container.querySelectorAll('.verse-card').forEach(c => c.classList.remove('selected-verse'));
      card.classList.add('selected-verse');

      showToast(`📖 ${refStr} (segment ${idx+1}/${segments.length}) projeté`, 'success');
    });
  });
}

// ─────────────────────────────────────────────────────────────
//  NAVIGATION MOBILE PAR ÉTAPES — avec barre inférieure
// ─────────────────────────────────────────────────────────────
function _renderMobileStep() {
  const stepsContainer = document.getElementById('bible-mobile-steps');
  if (!stepsContainer) return;

  let content = '';
  let bottomBar = '';

  if (_mobileStep === 0) {
    const books = Object.keys(App.bibleData);
    content = `
      <div class="mobile-step-header">📖 Livres</div>
      <div class="mobile-books-grid" id="mobile-books-list">
        ${books.map(book => `<button class="mobile-book-btn" data-book="${esc(book)}">${esc(book)}</button>`).join('')}
      </div>`;
    bottomBar = `
      <div class="mobile-bottom-bar" style="position:sticky; bottom:0; background:var(--bg-card); padding:8px; display:flex; gap:8px; border-top:1px solid var(--border);">
        <input type="text" id="mobile-ref-input" placeholder="Ex: Jean 3:16" style="flex:1; padding:8px; border-radius:var(--radius-xs); border:1px solid var(--border-mid); background:var(--bg-input); color:var(--text);">
        <button class="btn btn-sm btn-primary" id="mobile-go-ref">Aller</button>
      </div>`;
  } else if (_mobileStep === 1 && _selectedBook) {
    const chapters = Object.keys(App.bibleData[_selectedBook]);
    content = `
      <div class="mobile-step-header">
        <span>${esc(_selectedBook)} — Chapitres</span>
      </div>
      <div class="mobile-chapters-grid" id="mobile-chapters-list">
        ${chapters.map(ch => `<button class="mobile-chapter-btn" data-chapter="${esc(ch)}">${ch}</button>`).join('')}
      </div>`;
    bottomBar = `
      <div class="mobile-bottom-bar" style="position:sticky; bottom:0; background:var(--bg-card); padding:8px; display:flex; gap:8px; border-top:1px solid var(--border);">
        <button class="mobile-back-btn" id="mobile-back-chapters" style="background:transparent; border:none; color:var(--text); font-size:1.2rem; padding:8px; cursor:pointer;">← Retour</button>
        <input type="text" id="mobile-ref-input" placeholder="Ex: Jean 3:16" style="flex:1; padding:8px; border-radius:var(--radius-xs); border:1px solid var(--border-mid); background:var(--bg-input); color:var(--text);">
        <button class="btn btn-sm btn-primary" id="mobile-go-ref">Aller</button>
      </div>`;
  } else if (_mobileStep === 2 && _selectedBook && _selectedChapter) {
    const versesObj = App.bibleData[_selectedBook][_selectedChapter];
    content = `
      <div class="mobile-step-header">
        <span>${esc(_selectedBook)} ${_selectedChapter}</span>
      </div>
      <div class="mobile-verses-list" id="mobile-verses-list"></div>`;
    bottomBar = `
      <div class="mobile-bottom-bar" style="position:sticky; bottom:0; background:var(--bg-card); padding:8px; display:flex; gap:8px; border-top:1px solid var(--border);">
        <button class="mobile-back-btn" id="mobile-back-verses" style="background:transparent; border:none; color:var(--text); font-size:1.2rem; padding:8px; cursor:pointer;">← Retour</button>
        <input type="text" id="mobile-ref-input" placeholder="Ex: Jean 3:16" style="flex:1; padding:8px; border-radius:var(--radius-xs); border:1px solid var(--border-mid); background:var(--bg-input); color:var(--text);">
        <button class="btn btn-sm btn-primary" id="mobile-go-ref">Aller</button>
      </div>`;
  }

  stepsContainer.innerHTML = content + bottomBar;

  // Gestionnaires des boutons retour
  document.getElementById('mobile-back-chapters')?.addEventListener('click', () => {
    _mobileStep = 0;
    _renderMobileStep();
  });
  document.getElementById('mobile-back-verses')?.addEventListener('click', () => {
    _mobileStep = 1;
    _renderMobileStep();
  });

  // Gestionnaire de saisie directe
  const goBtn = document.getElementById('mobile-go-ref');
  const refInput = document.getElementById('mobile-ref-input');
  if (goBtn && refInput) {
    const goToRef = () => {
      const raw = refInput.value.trim();
      if (!raw) return;
      const parsed = parseRef(raw);
      if (!parsed) {
        showToast('Référence invalide (ex: Jean 3:16)', 'warning');
        return;
      }
      const { book, chapter, verse } = parsed;
      if (!App.bibleData?.[book]) {
        showToast(`Livre "${book}" introuvable`, 'warning');
        return;
      }
      if (!App.bibleData[book][chapter]) {
        showToast(`Chapitre ${chapter} introuvable`, 'warning');
        return;
      }
      // Navigation directe
      _selectedBook = book;
      _selectedChapter = String(chapter);
      _mobileStep = 2;
      _renderMobileStep();
      // Afficher le verset si précisé
      if (verse) {
        const text = App.bibleData[book][chapter][verse];
        if (text) {
          const refStr = `${book} ${chapter}:${verse}`;
          projectVerse(text, refStr);
          App.selectedVerse = { text, ref: refStr };
          if (typeof updateStagingPanel === 'function') {
            updateStagingPanel(text, refStr);
          }
          showToast(`📖 ${refStr} projeté`, 'success');
        } else {
          showToast(`Verset ${verse} introuvable`, 'warning');
        }
      }
    };
    goBtn.addEventListener('click', goToRef);
    refInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') goToRef(); });
  }

  // Gestionnaire des clics sur livres/chapitres
  if (_mobileStep === 0) {
    document.querySelectorAll('.mobile-book-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _selectedBook = btn.dataset.book;
        _mobileStep = 1;
        _renderMobileStep();
      });
    });
  } else if (_mobileStep === 1 && _selectedBook) {
    document.querySelectorAll('.mobile-chapter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _selectedChapter = btn.dataset.chapter;
        _mobileStep = 2;
        _renderMobileStep();
      });
    });
  } else if (_mobileStep === 2 && _selectedBook && _selectedChapter) {
    const versesContainer = document.getElementById('mobile-verses-list');
    if (versesContainer) {
      renderMobileVersesList(_selectedBook, _selectedChapter, versesContainer);
    }
  }
}

async function renderMobileVersesList(book, chapter, container) {
  const verses = App.bibleData[book][chapter];
  const favRefs = await getFavRefsSet();
  const verseNums = Object.keys(verses);
  container.innerHTML = verseNums.map(num => {
    const ref = buildVerseRef(book, chapter, num);
    const isFav = favRefs.has(ref);
    const verseText = verses[num];
    const segments = segmentVerse(verseText);
    const segmentsHtml = segments.length > 1
      ? `<div class="verse-segments-grid">
          ${segments.map((seg, idx) => {
            const lbl = String.fromCharCode(97 + idx) + num;
            return `<div class="seg-cell" data-seg-idx="${idx}" data-seg-ref="${book} ${chapter}:${num}" data-seg-total="${segments.length}">
                      <span class="seg-cell-label">${lbl}</span>${esc(seg)}
                    </div>`;
          }).join('')}
        </div>`
      : '';
    return `
      <div class="verse-card" data-ref="${esc(ref)}" data-book="${esc(book)}" data-chapter="${chapter}" data-verse="${num}" data-text="${esc(verseText)}">
        <div class="verse-card-actions">
          <button class="btn-star ${isFav ? 'starred' : ''}" data-ref="${esc(ref)}" data-type="verse" data-book="${esc(book)}" data-chapter="${chapter}" data-verse="${num}" aria-label="${isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}" aria-pressed="${isFav}">${isFav ? '★' : '☆'}</button>
          <button class="btn btn-ghost btn-sm btn-copy-verse-icon" data-text="${esc(verseText)}" title="Copier le texte de ce verset" aria-label="Copier le texte de ce verset">${ICONS.copy}</button>
        </div>
        <p class="verse-text"><strong>${num}.</strong> ${esc(verseText)}</p>
        ${segmentsHtml}
      </div>`;
  }).join('');

  attachVerseCardEvents(container);
}

// ─────────────────────────────────────────────────────────────
//  NAVIGATION VERSET PAR CLAVIER — ↑ / ↓ (REFONTE)
// ─────────────────────────────────────────────────────────────

window.bibleNextVerse = function () {
  const list = document.getElementById('verses-list');
  if (!list) return;
  const cards = Array.from(list.querySelectorAll('.verse-card'));
  if (cards.length === 0) return;

  let activeIdx = cards.findIndex(c => c.classList.contains('selected-verse'));
  if (activeIdx === -1) {
    activeIdx = 0;
  }

  const currentCard = cards[activeIdx];
  const text = currentCard.dataset.text;
  const ref = currentCard.dataset.ref;
  const segments = segmentVerse(text);

  let segIdx = App.currentSegmentIndex;
  if (segIdx === undefined || segIdx === null) segIdx = 0;

  if (segments.length > 1 && segIdx < segments.length - 1) {
    const nextSegIdx = segIdx + 1;
    const segCells = currentCard.querySelectorAll('.seg-cell');
    if (segCells.length > nextSegIdx) {
      segCells[nextSegIdx].click();
    }
    return;
  }

  const nextIdx = activeIdx + 1;
  if (nextIdx < cards.length) {
    cards[nextIdx].click();
    cards[nextIdx].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
};

window.biblePrevVerse = function () {
  const list = document.getElementById('verses-list');
  if (!list) return;
  const cards = Array.from(list.querySelectorAll('.verse-card'));
  if (cards.length === 0) return;

  let activeIdx = cards.findIndex(c => c.classList.contains('selected-verse'));
  if (activeIdx === -1) {
    activeIdx = 0;
  }

  const currentCard = cards[activeIdx];
  const text = currentCard.dataset.text;
  const ref = currentCard.dataset.ref;
  const segments = segmentVerse(text);

  let segIdx = App.currentSegmentIndex;
  if (segIdx === undefined || segIdx === null) segIdx = 0;

  if (segments.length > 1 && segIdx > 0) {
    const prevSegIdx = segIdx - 1;
    const segCells = currentCard.querySelectorAll('.seg-cell');
    if (segCells.length > prevSegIdx) {
      segCells[prevSegIdx].click();
    }
    return;
  }

  const prevIdx = activeIdx - 1;
  if (prevIdx >= 0) {
    cards[prevIdx].click();
    cards[prevIdx].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
};