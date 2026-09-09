/**
 * scripts/panels/lowerthird/ltVerses.js — Actions sur les versets
 * NTIC Bible Projector · US-REFACTOR-LT
 * Dépendances globales : safePostMessage, App, showToast, projectVerse
 */

// ─────────────────────────────────────────────────────────────
//  BIND DES ACTIONS SUR LES VERSETS (Masquer / Reprojeter)
// ─────────────────────────────────────────────────────────────
function _bindVerseActions() {
  document.getElementById('lt-hide-verse-btn')?.addEventListener('click', () => {
    safePostMessage({ type: 'hide-lower-third' });
    App.currentPersonActive = null;
    showToast('Lower Third masqué', 'info');
  });

  document.getElementById('lt-reproject-verse-btn')?.addEventListener('click', () => {
    if (App.lastBibleRef && App.lastBibleText) {
      projectVerse(App.lastBibleText, App.lastBibleRef);
    } else {
      showToast('Aucun verset précédent à reprojeter', 'warning');
    }
  });
}