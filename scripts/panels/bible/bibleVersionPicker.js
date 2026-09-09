/**
 * ============================================================
 *  scripts/panels/bible/bibleVersionPicker.js — Sélecteur de version custom
 *  NTIC Bible Projector · US-REFACTOR-02
 *  Extrait de biblePanel.js (bindCommonEventHandlers)
 *  Gère le dropdown de sélection de version Bible.
 *  Dépendances globales : db, App, esc, showToast, loadBibleVersion (bibleNavigation)
 * ============================================================
 */

// ─────────────────────────────────────────────────────────────
//  INITIALISATION DU SÉLECTEUR
// ─────────────────────────────────────────────────────────────
function initVersionPicker() {
  const versionBtn      = document.getElementById('bible-version-btn');
  const versionDropdown = document.getElementById('bible-version-dropdown');
  const versionLabel    = document.getElementById('bible-version-btn-label');

  if (!versionBtn || !versionDropdown) return;

  // S'assurer que les options sont focusables via tabindex
  versionDropdown.querySelectorAll('.bible-version-option').forEach((opt) => {
    opt.setAttribute('tabindex', '-1');
  });

  // ── Ouverture / fermeture ────────────────────────────────
  versionBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = versionDropdown.classList.toggle('open');
    versionBtn.setAttribute('aria-expanded', String(isOpen));
    if (isOpen) {
      const activeOpt = versionDropdown.querySelector('.bible-version-option.active')
        || versionDropdown.querySelector('.bible-version-option');
      activeOpt?.focus();
    }
  });

  // ── Navigation clavier dans le dropdown ──────────────────
  versionDropdown.addEventListener('keydown', (e) => {
    const opts = Array.from(versionDropdown.querySelectorAll('.bible-version-option'));
    const focused = document.activeElement;
    const idx = opts.indexOf(focused);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      opts[(idx + 1) % opts.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      opts[(idx - 1 + opts.length) % opts.length]?.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (focused && focused.classList.contains('bible-version-option')) focused.click();
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      versionDropdown.classList.remove('open');
      versionBtn.setAttribute('aria-expanded', 'false');
      versionBtn.focus();
    }
  });

  // ── Sélection d'une version ──────────────────────────────
  versionDropdown.querySelectorAll('.bible-version-option').forEach((opt) => {
    opt.addEventListener('click', async () => {
      const newVersion = opt.dataset.version;
      if (!newVersion) return;

      // Mettre à jour l'UI
      versionDropdown.querySelectorAll('.bible-version-option').forEach((o) => {
        const isActive = o.dataset.version === newVersion;
        o.classList.toggle('active', isActive);
        o.setAttribute('aria-selected', String(isActive));
        const existing = o.querySelector('.version-check');
        if (isActive && !existing) {
          o.insertAdjacentHTML('beforeend', '<span class="version-check">✓</span>');
        } else if (!isActive && existing) {
          existing.remove();
        }
      });

      if (versionLabel) versionLabel.textContent = newVersion;

      versionDropdown.classList.remove('open');
      versionBtn.setAttribute('aria-expanded', 'false');

      // Sauvegarder et charger la nouvelle version
      const savedBook    = App.settings.currentBook;
      const savedChapter = App.settings.currentChapter;

      await db.saveSetting('currentBible', newVersion);
      await loadBibleVersion(newVersion);

      // Restaurer la navigation si possible
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
  });

  // ── Fermeture au clic extérieur ──────────────────────────
  document.addEventListener('click', (e) => {
    const pickerWrap = document.getElementById('bible-version-picker-wrap');
    if (!pickerWrap?.contains(e.target)) {
      versionDropdown.classList.remove('open');
      versionBtn.setAttribute('aria-expanded', 'false');
    }
  });
}

// Exposer globalement
window.initVersionPicker = initVersionPicker;

console.warn('[bibleVersionPicker] Chargé ✓');