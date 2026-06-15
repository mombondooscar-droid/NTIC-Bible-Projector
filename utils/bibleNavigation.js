/**
 * utils/bibleNavigation.js — Navigation Bible (livres / chapitres / versets / mobile)
 * NTIC Bible Projector · US-R11 Sprint R3
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
  const favs = await db.getAllFavorites();
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
    // En mobile, on réinitialise les étapes
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
        <div class="verse-card-header">
          <span class="verse-num">${num}</span>
          <div style="display: flex; gap: 6px;">
            <button class="btn-star ${isFav ? 'starred' : ''}"
                    data-ref="${esc(ref)}" data-type="verse"
                    data-book="${esc(book)}" data-chapter="${esc(chapter)}" data-verse="${esc(num)}"
                    aria-label="${isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}"
                    aria-pressed="${isFav}">
              ${isFav ? '★' : '☆'}
            </button>
            <button class="btn btn-sm btn-ghost btn-slide"
                    data-book="${esc(book)}" data-chapter="${esc(chapter)}"
                    data-verse="${esc(num)}" data-text="${esc(verseText)}"
                    title="Projection plein écran (diapositive)">${ICONS.slide}</button>
            <button class="btn btn-ghost btn-sm btn-copy-verse"
                    data-text="${esc(verseText)}"
                    aria-label="Copier le texte de ce verset">📋 Copier</button>
          </div>
        </div>
        <p class="verse-text">${esc(verseText)}</p>
        ${segmentsHtml}
      </div>`;
  }).join('');

  attachVerseCardEvents(list);
}

// ─────────────────────────────────────────────────────────────
//  ÉVÉNEMENTS CARTES VERSETS
// ─────────────────────────────────────────────────────────────
function attachVerseCardEvents(container) {
  // Clic carte entière → projection
  container.querySelectorAll('.verse-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.btn-star') || e.target.closest('.btn-slide') || e.target.closest('.seg-cell') || e.target.closest('.btn-copy-verse')) return;
      const book    = card.dataset.book;
      const chapter = card.dataset.chapter;
      const verse   = card.dataset.verse;
      const text    = card.dataset.text;
      if (book && chapter && verse && text) {
        projectVerse(text, `${book} ${chapter}:${verse}`);
        App.selectedVerse = { text, ref: `${book} ${chapter}:${verse}` };
        container.querySelectorAll('.verse-card').forEach(c => c.classList.remove('selected-verse'));
        card.classList.add('selected-verse');
      }
    });
  });

  // Favoris ★
  container.querySelectorAll('.btn-star').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const { ref, book, chapter, verse } = btn.dataset;
      const verses = App.bibleData[book]?.[chapter];
      const wasStarred = btn.classList.contains('starred');
      if (wasStarred) {
        await db.removeFavorite(ref);
        btn.classList.remove('starred');
        btn.textContent = '☆';
        btn.setAttribute('aria-label', 'Ajouter aux favoris');
        btn.setAttribute('aria-pressed', 'false');
      } else {
        await db.addFavorite({
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

  // Bouton slide 📺
  container.querySelectorAll('.btn-slide').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const text = btn.dataset.text;
      const ref = `${btn.dataset.book} ${btn.dataset.chapter}:${btn.dataset.verse}`;
      safePostMessage({
        type: 'show-slide',
        data: {
          reference: ref, text,
          style: {
            refSize: App.settings.slideRefSize,
            verseSize: App.settings.slideVerseSize,
            refColor: App.settings.slideRefColor,
            verseColor: App.settings.slideVerseColor,
            font: App.settings.slideFont,
            textAlign: App.settings.slideTextAlign,
            bg: App.settings.slideBg,
          },
        },
      });
      updatePipPreview({ mode: 'slide', reference: ref, text });
      showToast(`${ICONS.slide} ${ref} (diapositive)`, 'success');
      App.selectedVerse = { text, ref };
    });
  });

  // Copier texte
  container.querySelectorAll('.btn-copy-verse').forEach((btn) => {
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

  // Segments
  container.querySelectorAll('.seg-cell').forEach((cell) => {
    cell.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = cell.closest('.verse-card');
      if (!card) return;
      const verseText = card.dataset.text ?? '';
      const refStr = cell.dataset.segRef;
      const idx = parseInt(cell.dataset.segIdx, 10);
      const segments = segmentVerse(verseText);
      card.querySelectorAll('.seg-cell').forEach(c => c.classList.remove('active', 'seg-cell--active'));
      cell.classList.add('active', 'seg-cell--active');
      _projectSegment(segments, idx, refStr);
      App.selectedVerse = { text: verseText, ref: refStr };
    });
  });
}

// ─────────────────────────────────────────────────────────────
//  NAVIGATION MOBILE PAR ÉTAPES
// ─────────────────────────────────────────────────────────────
function _renderMobileStep() {
  const stepsContainer = document.getElementById('bible-mobile-steps');
  if (!stepsContainer) return;

  if (_mobileStep === 0) {
    // Afficher la liste des livres
    const books = Object.keys(App.bibleData);
    stepsContainer.innerHTML = `
      <div class="mobile-step-header">📖 Livres</div>
      <div class="mobile-books-grid" id="mobile-books-list">
        ${books.map(book => `<button class="mobile-book-btn" data-book="${esc(book)}">${esc(book)}</button>`).join('')}
      </div>`;
    document.querySelectorAll('.mobile-book-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _selectedBook = btn.dataset.book;
        _mobileStep = 1;
        _renderMobileStep();
      });
    });
  } else if (_mobileStep === 1 && _selectedBook) {
    const chapters = Object.keys(App.bibleData[_selectedBook]);
    stepsContainer.innerHTML = `
      <div class="mobile-step-header">
        <button class="mobile-back-btn" id="mobile-back-chapters">←</button>
        <span>${esc(_selectedBook)} — Chapitres</span>
      </div>
      <div class="mobile-chapters-grid" id="mobile-chapters-list">
        ${chapters.map(ch => `<button class="mobile-chapter-btn" data-chapter="${esc(ch)}">${ch}</button>`).join('')}
      </div>`;
    document.getElementById('mobile-back-chapters')?.addEventListener('click', () => {
      _mobileStep = 0;
      _renderMobileStep();
    });
    document.querySelectorAll('.mobile-chapter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _selectedChapter = btn.dataset.chapter;
        _mobileStep = 2;
        _renderMobileStep();
      });
    });
  } else if (_mobileStep === 2 && _selectedBook && _selectedChapter) {
    const versesObj = App.bibleData[_selectedBook][_selectedChapter];
    stepsContainer.innerHTML = `
      <div class="mobile-step-header">
        <button class="mobile-back-btn" id="mobile-back-verses">←</button>
        <span>${esc(_selectedBook)} ${_selectedChapter}</span>
      </div>
      <div class="mobile-verses-list" id="mobile-verses-list"></div>`;
    document.getElementById('mobile-back-verses')?.addEventListener('click', () => {
      _mobileStep = 1;
      _renderMobileStep();
    });
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
        <div class="verse-card-header">
          <span class="verse-num">${num}</span>
          <div style="display: flex; gap: 6px;">
            <button class="btn-star ${isFav ? 'starred' : ''}" data-ref="${esc(ref)}" data-type="verse" data-book="${esc(book)}" data-chapter="${chapter}" data-verse="${num}" aria-label="${isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}" aria-pressed="${isFav}">${isFav ? '★' : '☆'}</button>
            <button class="btn btn-sm btn-ghost btn-slide" data-book="${esc(book)}" data-chapter="${chapter}" data-verse="${num}" data-text="${esc(verseText)}" title="Projection plein écran (diapositive)">${ICONS.slide}</button>
            <button class="btn btn-ghost btn-sm btn-copy-verse" data-text="${esc(verseText)}" aria-label="Copier le texte de ce verset">📋</button>
          </div>
        </div>
        <p class="verse-text">${esc(verseText)}</p>
        ${segmentsHtml}
      </div>`;
  }).join('');

  // Attacher les événements (identique à renderVersesList)
  attachVerseCardEvents(container);
}
