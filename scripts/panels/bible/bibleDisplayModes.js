/**
 * scripts/panels/bible/bibleDisplayModes.js — Modes d'affichage enrichis
 * NTIC Bible Projector · US-REFACTOR-02
 * Extrait de scripts/panels/bible/biblePanel.js
 * Gère les modes normal, bilingue et explicatif.
 * Dépendances globales : App, db, esc, showToast, safePostMessage,
 *   projectVerse, hideDualProjection, stripAccents, levenshtein,
 *   BIBLE_BOOKS, parseRef, ICONS
 */

function _buildDisplayModesToolbarHtml() {
  const expRefValue = esc(App.explanatory.reference || '');
  return `
    <div class="display-modes-toolbar">
      <span class="display-mode-label">Mode</span>

      <div class="seg-control display-mode-buttons" role="group" aria-label="Modes d'affichage">
        <button id="btn-mode-normal" class="seg-control-btn" data-mode="normal"
                aria-pressed="false" title="Mode Normal — affiche un seul verset sans segmentation">
          ✦ Normal
        </button>
        <button id="btn-mode-bilingual" class="seg-control-btn" data-mode="bilingual"
                aria-pressed="false" title="Mode Bilingue — deux versions côte à côte (navigation synchronisée)">
          ⇆ Bilingue
        </button>
        <button id="btn-mode-explanatory" class="seg-control-btn" data-mode="explanatory"
                aria-pressed="false" title="Mode Explicatif — verset principal + verset de référence fixe">
          ✎ Explicatif
        </button>
      </div>

      <div id="bilingual-controls" class="mode-controls" style="display:flex; opacity:0.5; pointer-events:none;">
        <select id="bilingual-version-select" class="field-select" disabled
                aria-label="Version secondaire pour le mode bilingue"
                style="max-width:160px; font-size:0.82rem;">
          <option value="">Choisir une version…</option>
        </select>
      </div>

      <div id="explanatory-controls" class="mode-controls" style="display:flex; opacity:0.5; pointer-events:none;">
        <div class="explanatory-input-group">
          <input type="text" id="explanatory-ref-input" class="field-input"
                 placeholder="Ex : Jean 3:16…" value="${expRefValue}" disabled
                 aria-label="Référence du verset explicatif"
                 style="max-width:160px; font-size:0.82rem;">
          <button id="explanatory-clear-btn" style="position:absolute; right:8px; top:50%; transform:translateY(-50%); background:transparent; border:none; color:var(--text-muted); cursor:pointer; font-size:1rem; z-index:5;" title="Effacer la référence">✕</button>
          <ul id="explanatory-suggestions" class="suggestions-list" hidden></ul>
        </div>
        <select id="explanatory-version-select" class="field-select" disabled
                aria-label="Version du verset explicatif"
                style="max-width:130px; font-size:0.82rem;">
          <option value="">Version principale</option>
        </select>
      </div>
    </div>`;
}

function _updateModeButtonsUI() {
  document.querySelectorAll('.display-mode-buttons [data-mode]').forEach((btn) => {
    const active = btn.dataset.mode === App.activeDisplayMode;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
}

function _updateModeControlsUI() {
  const bilingualControls   = document.getElementById('bilingual-controls');
  const explanatoryControls = document.getElementById('explanatory-controls');
  const bilingualSelect     = document.getElementById('bilingual-version-select');
  const explanatoryInput    = document.getElementById('explanatory-ref-input');
  const explanatorySelect   = document.getElementById('explanatory-version-select');

  if (bilingualControls) {
    const isActive = App.activeDisplayMode === 'bilingual';
    bilingualControls.style.opacity = isActive ? '1' : '0.5';
    bilingualControls.style.pointerEvents = isActive ? 'auto' : 'none';
  }
  if (explanatoryControls) {
    const isActive = App.activeDisplayMode === 'explanatory';
    explanatoryControls.style.opacity = isActive ? '1' : '0.5';
    explanatoryControls.style.pointerEvents = isActive ? 'auto' : 'none';
  }
  if (bilingualSelect) bilingualSelect.disabled = App.activeDisplayMode !== 'bilingual';
  if (explanatoryInput) explanatoryInput.disabled = App.activeDisplayMode !== 'explanatory';
  if (explanatorySelect) explanatorySelect.disabled = App.activeDisplayMode !== 'explanatory';
}

async function _setActiveDisplayMode(mode) {
  if (App.activeDisplayMode === mode) return;
  App.activeDisplayMode = mode;
  await db.saveSetting('activeDisplayMode', mode);
  _updateModeButtonsUI();
  _updateModeControlsUI();
  if (mode === 'normal') {
    if (typeof hideDualProjection === 'function') hideDualProjection();
  }
  if (App.lastBibleRef && App.lastBibleText) {
    projectVerse(App.lastBibleText, App.lastBibleRef);
  }
}

function _bindDisplayModeButtons() {
  document.querySelectorAll('.display-mode-buttons [data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => _setActiveDisplayMode(btn.dataset.mode));
  });
}

async function _populateBilingualVersionSelect() {
  const sel = document.getElementById('bilingual-version-select');
  if (!sel) return;
  const names = await db.getAllBibleNames();
  sel.innerHTML = '<option value="">Sélectionner une version</option>' +
    names.map((n) => `<option value="${esc(n)}" ${n === App.bilingual.secondVersion ? 'selected' : ''}>${esc(n)}</option>`).join('');
}

async function _populateExplanatoryVersionSelect() {
  const sel = document.getElementById('explanatory-version-select');
  if (!sel) return;
  const names = await db.getAllBibleNames();
  sel.innerHTML = '<option value="">Version principale</option>' +
    names.map((n) => `<option value="${esc(n)}" ${n === App.explanatory.version ? 'selected' : ''}>${esc(n)}</option>`).join('');
}

function _bindBilingualVersionSelect() {
  const sel = document.getElementById('bilingual-version-select');
  sel?.addEventListener('change', async () => {
    const val = sel.value || null;
    App.bilingual.secondVersion = val;
    App._bilingualDataCache     = null;
    App._bilingualDataCacheName = null;
    await db.saveSetting('bilingualSecondVersion', val);
    if (App.lastBibleRef && App.lastBibleText && App.activeDisplayMode === 'bilingual') {
      projectVerse(App.lastBibleText, App.lastBibleRef);
    }
  });
}

function _bindExplanatoryVersionSelect() {
  const sel = document.getElementById('explanatory-version-select');
  sel?.addEventListener('change', async () => {
    const val = sel.value || null;
    App.explanatory.version = val;
    await db.saveSetting('explanatoryVersion', val);
    if (App.explanatory.reference) await _loadExplanatoryVerse();
  });
}

function _bindExplanatoryInput() {
  const input           = document.getElementById('explanatory-ref-input');
  const suggestionsList = document.getElementById('explanatory-suggestions');
  const clearBtn        = document.getElementById('explanatory-clear-btn');
  if (!input) return;

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      input.value = '';
      App.explanatory.reference = '';
      db.saveSetting('explanatoryReference', '');
      App.explanatory.text = '';
      showToast('Référence effacée', 'info');
      suggestionsList.hidden = true;
    });
  }

  input.addEventListener('input', debounce(() => {
    const raw = input.value.trim();
    if (raw.length < 2) {
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
      }
    }
    if (!suggestionsList) return;
    if (suggestions.length > 0) {
      suggestionsList.innerHTML = suggestions.map((s) =>
        `<li class="suggestion-item" data-book="${esc(s)}">${esc(s)}</li>`).join('');
      suggestionsList.hidden = false;
      suggestionsList.querySelectorAll('.suggestion-item').forEach((li) => {
        li.addEventListener('click', () => {
          input.value = li.dataset.book + ' ';
          suggestionsList.hidden = true;
          input.focus();
        });
      });
    } else {
      suggestionsList.hidden = true;
    }
  }, 250));

  const _validate = async () => {
    const raw = input.value.trim();
    if (!raw) return;
    App.explanatory.reference = raw;
    await db.saveSetting('explanatoryReference', raw);
    if (suggestionsList) suggestionsList.hidden = true;
    await _loadExplanatoryVerse();
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); _validate(); }
    if (e.key === 'Escape' && suggestionsList) { suggestionsList.hidden = true; }
  });
  input.addEventListener('blur', () => {
    setTimeout(() => { if (suggestionsList) suggestionsList.hidden = true; }, 150);
  });
}

async function _loadExplanatoryVerse() {
  const raw = (App.explanatory.reference || '').trim();
  const parsed = raw ? parseRef(raw) : null;
  if (!parsed) {
    showToast('⚠ Référence explicative invalide', 'warning');
    return false;
  }

  const verName = App.explanatory.version;
  let data;
  if (!verName || verName === App.settings.currentBible) {
    data = App.bibleData;
  } else {
    data = await db.getBible(verName);
  }

  const chapterObj = data?.[parsed.book]?.[parsed.chapter];
  if (!chapterObj) {
    showToast('⚠ Référence introuvable dans cette version', 'warning');
    return false;
  }
  const verseNum = parsed.verse != null ? String(parsed.verse) : Object.keys(chapterObj)[0];
  const text = chapterObj?.[verseNum];
  if (!text) {
    showToast('⚠ Verset introuvable pour cette référence', 'warning');
    return false;
  }

  App.explanatory.book    = parsed.book;
  App.explanatory.chapter = String(parsed.chapter);
  App.explanatory.verse   = String(verseNum);
  App.explanatory.text    = text;
  App.explanatory.ref     = `${parsed.book} ${parsed.chapter}:${verseNum}`;

  await Promise.all([
    db.saveSetting('explanatoryBook',    App.explanatory.book),
    db.saveSetting('explanatoryChapter', App.explanatory.chapter),
    db.saveSetting('explanatoryVerse',   App.explanatory.verse),
    db.saveSetting('explanatoryText',    App.explanatory.text),
    db.saveSetting('explanatoryRef',     App.explanatory.ref),
  ]);

  showToast(`📚 Verset explicatif : ${App.explanatory.ref}`, 'success');

  if (App.activeDisplayMode === 'explanatory' && App.lastBibleRef && App.lastBibleText) {
    projectVerse(App.lastBibleText, App.lastBibleRef);
  }
  return true;
}

function initDisplayModes(container) {
  _updateModeButtonsUI();
  _updateModeControlsUI();
  _bindDisplayModeButtons();
  _bindBilingualVersionSelect();
  _bindExplanatoryVersionSelect();
  _bindExplanatoryInput();
  _populateBilingualVersionSelect();
  _populateExplanatoryVersionSelect();
}