/**
 * utils/bibleProjection.js — Projection versets, PIP, segmentation, surlignage
 * NTIC Bible Projector · US-R11 Sprint R3
 * Dépendances globales : db, App, esc, showToast, safePostMessage, logEvent,
 *   ICONS, renderProjectionSegNav (projection-shared.js — runtime only)
 * Scope global — chargé AVANT panels/ dans index.html
 * IMPORTANT : updatePipPreview et projectVerse sont appelées depuis
 *   songsPanel.js, lowerThirdPanel.js, favoritesPanel.js, settingsPanel.js
 */

// ═════════════════════════════════════════════════════════════
//  APERÇU PROJECTION (PIP) — CORRIGÉ
// ═════════════════════════════════════════════════════════════

/**
 * Met à jour l'affichage du panneau PIP à partir d'un état de projection.
 * @param {Object} state - { mode, reference?, text?, title?, author?, strophes?, currentStrophe?, nom?, titre? }
 */
function updatePipPreview(state) {
  // TOUJOURS mémoriser le dernier état (même si PIP désactivé)
  App.lastProjectionState = state;

  if (!App.pipEnabled) return;

  const container = document.getElementById('pip-content');
  if (!container) return;

  switch (state.mode) {
    case 'bible':
      container.innerHTML = `
        <div style="font-weight:bold; color:#f59e0b; margin-bottom:4px;">${esc(state.reference || '')}</div>
        <div style="line-height:1.45; word-break:break-word;">${esc(state.text || '')}</div>
      `;
      break;
    case 'song':
      let stropheText = '';
      if (state.strophes && Array.isArray(state.strophes) && state.currentStrophe !== undefined) {
        stropheText = state.strophes[state.currentStrophe] || '';
      } else if (state.lines) {
        let tmp = '';
        for (let i = 0; i < state.lines.length; i++) {
          tmp += state.lines[i];
          if (state.translations?.[i]) tmp += '\n*' + state.translations[i];
          if (i < state.lines.length - 1) tmp += '\n';
        }
        stropheText = tmp;
      }
      container.innerHTML = `
        ${state.title ? `<div style="font-weight:bold; margin-bottom:3px;">${esc(state.title)}</div>` : ''}
        ${state.author ? `<div style="opacity:0.7; margin-bottom:4px;">${esc(state.author)}</div>` : ''}
        <div style="line-height:1.45; word-break:break-word;">${esc(stropheText.substring(0, 150))}${stropheText.length > 150 ? '…' : ''}</div>
      `;
      break;
    case 'person':
      container.innerHTML = `
        <div style="font-weight:bold; margin-bottom:4px;">${esc(state.nom || '')}</div>
        <div style="opacity:0.8;">${esc(state.titre || '')}</div>
      `;
      break;
    case 'slide':
      container.innerHTML = `
        <div style="font-weight:bold; color:#f0c060; margin-bottom:4px;">${esc(state.reference || '')}</div>
        <div style="line-height:1.45; word-break:break-word;">${esc((state.text || '').substring(0, 100))}${state.text?.length > 100 ? '…' : ''}</div>
      `;
      break;
    default: // blank
      container.innerHTML = '<div style="opacity:0.5;">Aucune projection</div>';
      break;
  }
}

/**
 * Active ou désactive l'aperçu flottant.
 * @param {boolean} enabled
 */
async function setPipEnabled(enabled) {
  App.pipEnabled = enabled;
  const pipEl = document.getElementById('pip-preview');
  if (pipEl) {
    pipEl.classList.toggle('pip-hidden', !enabled);
  }
  await db.saveSetting('pipEnabled', enabled);
  if (enabled && App.lastProjectionState) {
    updatePipPreview(App.lastProjectionState);
  }
}

// ─────────────────────────────────────────────────────────────
//  US-24 : PIP DÉPLAÇABLE (drag natif, position persistée IDB)
// ─────────────────────────────────────────────────────────────
function initPipDrag() {
  const pip    = document.getElementById('pip-preview');
  const header = pip?.querySelector('.pip-header');
  if (!pip || !header) return;

  let startX = 0, startY = 0, startLeft = 0, startTop = 0, dragging = false;

  function _getPoint(e) { return e.touches ? e.touches[0] : e; }

  function onStart(e) {
    if (e.target.closest('#pip-close')) return;
    dragging  = true;
    const pt  = _getPoint(e);
    startX    = pt.clientX;
    startY    = pt.clientY;
    const cs  = window.getComputedStyle(pip);
    startLeft = parseInt(cs.left)  || (window.innerWidth  - pip.offsetWidth  - 16);
    startTop  = parseInt(cs.top)   || (window.innerHeight - pip.offsetHeight - 80);
    header.style.cursor = 'grabbing';
    e.preventDefault();
  }

  function onMove(e) {
    if (!dragging) return;
    const pt     = _getPoint(e);
    const newLeft = Math.max(0, Math.min(startLeft + pt.clientX - startX, window.innerWidth  - pip.offsetWidth));
    const newTop  = Math.max(0, Math.min(startTop  + pt.clientY - startY, window.innerHeight - pip.offsetHeight));
    pip.style.left   = newLeft + 'px';
    pip.style.top    = newTop  + 'px';
    pip.style.right  = 'auto';
    pip.style.bottom = 'auto';
  }

  async function onEnd() {
    if (!dragging) return;
    dragging = false;
    header.style.cursor = 'grab';
    await db.saveSetting('pip_position', {
      x: parseInt(pip.style.left)  || 0,
      y: parseInt(pip.style.top)   || 0,
    });
  }

  header.addEventListener('mousedown',  onStart);
  header.addEventListener('touchstart', onStart, { passive: false });
  document.addEventListener('mousemove', onMove);
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('mouseup',   onEnd);
  document.addEventListener('touchend',  onEnd);
}

// ─────────────────────────────────────────────────────────────
//  US-19 : SEGMENTATION DES VERSETS
// ─────────────────────────────────────────────────────────────

/** Découpe un texte en segments de 25 mots (si > 30 mots). */
function segmentVerse(text) {
  const words = text.trim().split(/\s+/);
  if (words.length <= 30) return [text];
  const segments = [];
  const SIZE = 25;
  for (let i = 0; i < words.length; i += SIZE) {
    segments.push(words.slice(i, i + SIZE).join(' '));
  }
  // Fusionner le dernier segment s'il a moins de 5 mots
  if (segments.length > 1 && segments[segments.length - 1].split(' ').length < 5) {
    segments[segments.length - 2] += ' ' + segments.pop();
  }
  return segments;
}

/**
 * Met à jour l'indicateur visuel du segment actif dans la liste des segments.
 * @param {number} idx Index du segment actif
 */
function setActiveSegment(idx) {
  document.querySelectorAll('.seg-cell').forEach((c, i) => {
    c.classList.toggle('seg-cell--active', i === idx);
  });
}

/** Projette un segment précis et met à jour l'UI de navigation. */
function _projectSegment(segments, index, refStr) {
  const segmentText = segments[index];
  App.currentSegments     = segments;
  App.currentSegmentIndex = index;

  safePostMessage({
    type: 'verse:segment',
    segmentIndex:  index,
    segmentText,
    totalSegments: segments.length,
    reference:     refStr,
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

  updatePipPreview({ mode: 'bible', reference: refStr, text: segmentText });
  _updateSegmentBar(segments, index);
  setActiveSegment(index);
}

/** Met à jour la barre de navigation segments dans le panneau contrôle. */
function _updateSegmentBar(segments, activeIndex) {
  const bar = document.getElementById('verse-segment-bar');
  if (!bar) return;

  if (!segments || segments.length <= 1) {
    bar.classList.add('hidden');
    return;
  }

  const dotsEl  = bar.querySelector('.verse-seg-dots');
  const prevBtn = bar.querySelector('.seg-btn-prev');
  const nextBtn = bar.querySelector('.seg-btn-next');
  const infoEl  = bar.querySelector('.verse-seg-info');

  if (dotsEl) {
    dotsEl.innerHTML = segments.map((_, i) => `
      <span class="verse-seg-dot ${i === activeIndex ? 'active' : ''}"
            data-seg="${i}" title="Segment ${i + 1}"></span>
    `).join('');
    dotsEl.querySelectorAll('.verse-seg-dot').forEach((dot) => {
      dot.addEventListener('click', () => {
        const idx = Number(dot.dataset.seg);
        if (idx !== App.currentSegmentIndex) {
          _projectSegment(App.currentSegments, idx, App.lastBibleRef);
        }
      });
    });
  }
  if (prevBtn) prevBtn.disabled = (activeIndex === 0);
  if (nextBtn) nextBtn.disabled = (activeIndex === segments.length - 1);
  if (infoEl)  infoEl.textContent = `${activeIndex + 1} / ${segments.length}`;
  bar.classList.remove('hidden');
}

// ─────────────────────────────────────────────────────────────
//  US-18 : SYNCHRONISATION DE LA NAVIGATION APRÈS RECHERCHE
// ─────────────────────────────────────────────────────────────

/**
 * Synchronise les colonnes Livres / Chapitres / Versets avec une référence.
 * @param {string} refStr  Format : "Jean 3:16" ou "1 Rois 18:1"
 */
async function syncNavToRef(refStr) {
  const match = refStr.match(/^(.+?)\s+(\d+):(\d+)$/);
  if (!match) return;
  const [, book, chapter, verse] = match;
  if (!App.bibleData?.[book]) return;

  // 1. Activer le bon livre
  const booksList = document.getElementById('books-list');
  if (booksList) {
    const bookBtn = booksList.querySelector(`.nav-item--book[data-book="${CSS.escape(book)}"]`);
    if (bookBtn && !bookBtn.classList.contains('active')) {
      bookBtn.click();
      await new Promise((r) => setTimeout(r, 60));
    }
  }

  // 2. Activer le bon chapitre
  const chaptersList = document.getElementById('chapters-list');
  if (chaptersList) {
    const chBtn = chaptersList.querySelector(`.nav-item--chapter[data-chapter="${CSS.escape(chapter)}"]`);
    if (chBtn && !chBtn.classList.contains('active')) {
      chBtn.click();
      await new Promise((r) => setTimeout(r, 60));
    }
  }

  // 3. Scroller et marquer le verset projeté
  const versesList = document.getElementById('verses-list');
  if (versesList) {
    const ref = `${book} ${chapter}:${verse}`;
    const verseCard = versesList.querySelector(`.verse-card[data-ref="${CSS.escape(ref)}"]`);
    versesList.querySelectorAll('.verse-card').forEach((c) => c.classList.remove('projected'));
    verseCard?.classList.add('projected');
    verseCard?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function projectVerse(text, refStr) {
  // Log de l'événement
  const segments = segmentVerse(text);
  logEvent('Projection verset', { ref: refStr, segmentMode: segments.length > 1 });

  App.lastBibleRef  = refStr;
  App.lastBibleText = text;

  // ── PERSISTANCE INDEXEDDB ───────────────────
  db.saveSetting('lastBibleRef', refStr).catch(e => console.warn('saveSetting lastBibleRef failed', e));
  db.saveSetting('lastBibleText', text).catch(e => console.warn('saveSetting lastBibleText failed', e));

  App.currentSegments     = segments;
  App.currentSegmentIndex = 0;

  if (segments.length > 1) {
    // Projeter le premier segment via verse:segment
    _projectSegment(segments, 0, refStr);
    showToast(`📖 ${refStr} projeté (${segments.length} segments)`, 'success');
  } else {
    // Verset court : projection normale
    safePostMessage({
      type: 'show-verse',
      data: {
        reference: refStr,
        text,
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
    updatePipPreview({ mode: 'bible', reference: refStr, text });
    _updateSegmentBar(segments, 0); // cache la barre si 1 seul segment
    showToast(`📖 ${refStr} projeté`, 'success');
  }

  // US-18 : synchroniser les colonnes de navigation
  syncNavToRef(refStr);
}

// ─────────────────────────────────────────────────────────────
//  US-20 : SURLIGNAGE DE MOTS SÉLECTIONNÉS
// ─────────────────────────────────────────────────────────────

/**
 * Initialise la barre de surlignage dans le panneau Bible.
 * Apparaît lors d'une sélection de texte dans #verses-list.
 */
function _initHighlightToolbar() {
  const toolbar    = document.getElementById('highlight-toolbar');
  const versesList = document.getElementById('verses-list');
  if (!toolbar) return;

  let selectedColor = '#FFD700';

  // ── Sélection de couleur ──────────────────────────────────
  toolbar.querySelectorAll('.hl-color-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toolbar.querySelectorAll('.hl-color-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      selectedColor = btn.dataset.color;
    });
  });

  // ── Bouton Surligner ─────────────────────────────────────
  toolbar.querySelector('.btn-hl-apply')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const sel  = window.getSelection();
    const text = sel ? sel.toString().trim() : '';
    if (!text) { showToast('Sélectionnez du texte d\'abord', 'warning'); return; }
    safePostMessage({ type: 'highlight:words', selectedText: text, color: selectedColor });
    toolbar.classList.add('hidden');
    sel?.removeAllRanges();
    showToast('🖊️ Surlignage appliqué dans la projection', 'success');
  });

  // ── Bouton Effacer ───────────────────────────────────────
  toolbar.querySelector('.btn-hl-clear')?.addEventListener('click', (e) => {
    e.stopPropagation();
    safePostMessage({ type: 'highlight:clear' });
    toolbar.classList.add('hidden');
    showToast('🧹 Surlignage effacé', 'info');
  });

  // ── Afficher la barre sur sélection (mouse & touch) ──────
  const _showIfSelected = () => {
    setTimeout(() => {
      const sel  = window.getSelection();
      const text = sel ? sel.toString().trim() : '';
      toolbar.classList.toggle('hidden', text.length === 0);
    }, 30);
  };

  if (versesList) {
    versesList.addEventListener('mouseup',  _showIfSelected);
    versesList.addEventListener('touchend', _showIfSelected);
  }

  // ── Masquer sur clic extérieur ───────────────────────────
  document.addEventListener('mousedown', (e) => {
    if (!toolbar.contains(e.target) && !e.target.closest('#verses-list')) {
      window.getSelection()?.removeAllRanges();
      toolbar.classList.add('hidden');
    }
  }, { capture: true });
}
