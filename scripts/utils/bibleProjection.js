/**
 * utils/bibleProjection.js — Projection versets, segmentation
 * NTIC Bible Projector · US-R11 Sprint R3
 * + Cahier des charges "Modes bilingue et explicatif" : projectVerse() route
 *   désormais vers show-dual-bilingual / show-dual-explanatory selon
 *   App.activeDisplayMode (remplace l'ancien bibleDual.js / mode alternance).
 * + US-2.9 : Amélioration navigation clavier — projectSegmentOnly() et paramètre target.
 * + Correction : paramètre noSegment pour mode diapositive.
 * + US-REL-03 : Ajout de resyncCurrentState() pour resynchronisation sans effet de bord.
 * Dépendances globales : db, App, esc, showToast, safePostMessage, logEvent,
 *   ICONS, renderProjectionSegNav (projection-shared.js — runtime only)
 * Scope global — chargé AVANT panels/ dans index.html
 */

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
  if (segments.length > 1 && segments[segments.length - 1].split(' ').length < 5) {
    segments[segments.length - 2] += ' ' + segments.pop();
  }
  return segments;
}

function setActiveSegment(idx) {
  document.querySelectorAll('.seg-cell').forEach((c, i) => {
    c.classList.toggle('seg-cell--active', i === idx);
  });
}

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

  // ÉTAPE 1 : envoi unifié du segment
  sendLT('verse', {
    reference: refStr,
    text: segmentText,
    segmentIndex: index,
    totalSegments: segments.length,
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

  _updateSegmentBar(segments, index);
  setActiveSegment(index);
}

function projectSegmentOnly(segmentText, index, refStr, total) {
  if (!segmentText) return;
  safePostMessage({
    type: 'verse:segment',
    segmentIndex:  index,
    segmentText,
    totalSegments: total || 1,
    reference:     refStr || App.lastBibleRef || '',
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
  if (App.currentSegments && App.currentSegments.length > 1) {
    setActiveSegment(index);
    _updateSegmentBar(App.currentSegments, index);
  }
}
window.projectSegmentOnly = projectSegmentOnly;

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

async function syncNavToRef(refStr) {
  const match = refStr.match(/^(.+?)\s+(\d+):(\d+)$/);
  if (!match) return;
  const [, book, chapter, verse] = match;
  if (!App.bibleData?.[book]) return;
  const booksList = document.getElementById('books-list');
  if (booksList) {
    const bookBtn = booksList.querySelector(`.nav-item--book[data-book="${CSS.escape(book)}"]`);
    if (bookBtn && !bookBtn.classList.contains('active')) {
      bookBtn.click();
      await new Promise((r) => setTimeout(r, 60));
    }
  }
  const chaptersList = document.getElementById('chapters-list');
  if (chaptersList) {
    const chBtn = chaptersList.querySelector(`.nav-item--chapter[data-chapter="${CSS.escape(chapter)}"]`);
    if (chBtn && !chBtn.classList.contains('active')) {
      chBtn.click();
      await new Promise((r) => setTimeout(r, 60));
    }
  }
  const versesList = document.getElementById('verses-list');
  if (versesList) {
    const ref = `${book} ${chapter}:${verse}`;
    const verseCard = versesList.querySelector(`.verse-card[data-ref="${CSS.escape(ref)}"]`);
    versesList.querySelectorAll('.verse-card').forEach((c) => c.classList.remove('projected'));
    verseCard?.classList.add('projected');
    verseCard?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function _parseSimpleRef(refStr) {
  if (!refStr) return null;
  const m = refStr.match(/^(.+?)\s+(\d+):(\d+)$/);
  if (!m) return null;
  return { book: m[1], chapter: m[2], verse: m[3] };
}

function _dualStylePayload() {
  return {
    primaryRefColor:     App.settings.primaryRefColor,
    primaryTextColor:    App.settings.primaryTextColor,
    primaryFontFamily:   App.settings.primaryFontFamily,
    primaryRefSize:      App.settings.primaryRefSize,
    primaryTextSize:     App.settings.primaryTextSize,
    secondaryRefColor:   App.settings.secondaryRefColor,
    secondaryTextColor:  App.settings.secondaryTextColor,
    secondaryFontFamily: App.settings.secondaryFontFamily,
    secondaryRefSize:    App.settings.secondaryRefSize,
    secondaryTextSize:   App.settings.secondaryTextSize,
  };
}

async function _loadSecondaryBibleData(versionName) {
  if (!versionName) return null;
  if (App._bilingualDataCache && App._bilingualDataCacheName === versionName) {
    return App._bilingualDataCache;
  }
  try {
    const data = await db.getBible(versionName);
    App._bilingualDataCache     = data;
    App._bilingualDataCacheName = versionName;
    return data;
  } catch (e) {
    console.warn('[Bilingue] Échec chargement version secondaire', e);
    return null;
  }
}

async function _projectBilingual(refStr, text) {
  const parsed        = _parseSimpleRef(refStr);
  const secondaryName = App.bilingual.secondVersion;
  let secondary = null;
  if (parsed && secondaryName) {
    const dataB = await _loadSecondaryBibleData(secondaryName);
    const txt   = dataB?.[parsed.book]?.[parsed.chapter]?.[parsed.verse];
    if (txt) {
      secondary = { ref: refStr, text: txt, version: secondaryName };
    }
  }
  if (!secondaryName) {
    showToast('⚠ Sélectionnez une version secondaire pour le mode bilingue', 'warning');
  } else if (!secondary) {
    showToast('⚠ Verset introuvable dans la version secondaire', 'warning');
  }
  safePostMessage({
    type: 'show-dual-bilingual',
    data: {
      primary:   { ref: refStr, text, version: App.settings.currentBible || '' },
      secondary: secondary || { ref: '', text: '', version: '' },
      style: _dualStylePayload(),
    },
  });
  showToast(`📖 ${refStr} projeté (bilingue)`, 'success');
}

function _projectExplanatory(refStr, text) {
  const exp = App.explanatory;
  const secondary = (exp && exp.ref && exp.text)
    ? { ref: exp.ref, text: exp.text, version: exp.version || App.settings.currentBible || '' }
    : null;
  if (!secondary) {
    showToast('⚠ Saisissez une référence explicative valide', 'warning');
  }
  safePostMessage({
    type: 'show-dual-explanatory',
    data: {
      primary:   { ref: refStr, text, version: App.settings.currentBible || '' },
      secondary: secondary || { ref: '', text: '', version: '' },
      style: _dualStylePayload(),
    },
  });
  showToast(`📖 ${refStr} projeté (explicatif)`, 'success');
}

function hideDualProjection() {
  safePostMessage({ type: 'hide-dual' });
}

function projectVerse(text, refStr, options = {}) {
  const { noSegment = false } = options || {};

  logEvent('Projection verset', { ref: refStr, mode: App.activeDisplayMode, noSegment });

  App.lastBibleRef  = refStr;
  App.lastBibleText = text;

  db.saveSetting('lastBibleRef', refStr).catch(e => console.warn('saveSetting lastBibleRef failed', e));
  db.saveSetting('lastBibleText', text).catch(e => console.warn('saveSetting lastBibleText failed', e));

  if (App.activeDisplayMode === 'bilingual') {
    App.currentSegments = null;
    App.currentSegmentIndex = 0;
    _updateSegmentBar([], 0);
    _projectBilingual(refStr, text);
    syncNavToRef(refStr);
    if (typeof window.flashStagingAsSent === 'function') window.flashStagingAsSent();
    return;
  }
  if (App.activeDisplayMode === 'explanatory') {
    App.currentSegments = null;
    App.currentSegmentIndex = 0;
    _updateSegmentBar([], 0);
    _projectExplanatory(refStr, text);
    syncNavToRef(refStr);
    if (typeof window.flashStagingAsSent === 'function') window.flashStagingAsSent();
    return;
  }

  if (noSegment) {
    safePostMessage({
      type: 'show-slide',
      data: {
        reference: refStr,
        text: text,
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
    _updateSegmentBar([], 0);
    showToast(`📖 ${refStr} projeté (diapositive)`, 'success');
    syncNavToRef(refStr);
    if (typeof window.flashStagingAsSent === 'function') window.flashStagingAsSent();
    return;
  }

  const segments = segmentVerse(text);
  App.currentSegments = segments;
  App.currentSegmentIndex = 0;

  if (segments.length > 1) {
    _projectSegment(segments, 0, refStr);
    showToast(`📖 ${refStr} projeté (${segments.length} segments)`, 'success');
  } else {
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
    _updateSegmentBar(segments, 0);
    showToast(`📖 ${refStr} projeté`, 'success');
  }

  // ÉTAPE 1 : envoi unifié du verset complet (même si segmenté, on envoie le texte complet)
  sendLT('verse', {
    reference: refStr,
    text: text,
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

  syncNavToRef(refStr);
  if (typeof window.flashStagingAsSent === 'function') window.flashStagingAsSent();
}

/**
 * US-REL-03 : Resynchronisation silencieuse de l'état courant.
 * Retransmet le verset affiché (complet ou segmenté) sans toast,
 * sans ré-écriture DB, sans recalcul.
 * À utiliser lors des reconnexions réseau, ouverture de fenêtres, etc.
 */
function resyncCurrentState() {
  if (App.lastBibleRef && App.lastBibleText) {
    const refStr = App.lastBibleRef;
    const text = App.lastBibleText;
    const segments = App.currentSegments || segmentVerse(text);
    const segIdx = App.currentSegmentIndex || 0;

    // Retransmission du verset complet
    safePostMessage({
      type: 'show-verse',
      data: {
        reference: refStr,
        text: text,
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

    // Si plusieurs segments, retransmettre le segment actuel
    if (segments.length > 1) {
      const segmentText = segments[segIdx] || text;
      safePostMessage({
        type: 'verse:segment',
        segmentIndex: segIdx,
        segmentText,
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
    }

    // ÉTAPE 1 : envoi unifié pour la resynchronisation (verset complet)
    sendLT('verse', {
      reference: refStr,
      text: text,
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
    // Pas de toast, pas de réécriture DB
  }
}
window.resyncCurrentState = resyncCurrentState;

// ─────────────────────────────────────────────────────────────
//  PIP PREVIEW — Mise à jour de l'aperçu dans le panneau Bible
// ─────────────────────────────────────────────────────────────

/**
 * Met à jour l'aperçu PIP (Picture-in-Picture) dans le panneau Bible.
 * @param {Object} data - { mode: 'song'|'verse', title?, author?, strophes?, currentStrophe?, text? }
 */
function updatePipPreview(data) {
  const pip = document.getElementById('pip-preview');
  if (!pip) return;
  const content = pip.querySelector('.pip-content');
  if (!content) return;

  if (data.mode === 'song') {
    const title = data.title || '';
    const author = data.author || '';
    const strophe = data.strophes?.[data.currentStrophe] || '';
    content.innerHTML = `
      <div style="font-weight:bold; font-size:1.1rem; margin-bottom:0.2rem;">${esc(title)}</div>
      <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:0.3rem;">${esc(author)}</div>
      <div style="font-size:0.95rem; line-height:1.5; white-space:pre-wrap;">${esc(strophe)}</div>
    `;
  } else if (data.mode === 'verse' && data.text) {
    content.textContent = data.text;
  } else {
    content.textContent = data.text || '';
  }
}

// Rendre disponible globalement
window.updatePipPreview = updatePipPreview;