/**
 * scripts/panels/bible/bibleCommonEvents.js — Événements communs du panneau Bible
 * NTIC Bible Projector · US-REFACTOR-02
 * Extrait de biblePanel.js (bindCommonEventHandlers)
 * Gère les boutons de navigation par segments, le bouton de projection sticky,
 * et tout autre gestionnaire partagé.
 */

function initBibleCommonEvents() {
  const prevBtn = document.querySelector('.seg-btn-prev');
  const nextBtn = document.querySelector('.seg-btn-next');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (App.currentSegments?.length > 1 && App.currentSegmentIndex > 0) {
        _projectSegment(App.currentSegments, App.currentSegmentIndex - 1, App.lastBibleRef);
      }
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (App.currentSegments?.length > 1 && App.currentSegmentIndex < App.currentSegments.length - 1) {
        _projectSegment(App.currentSegments, App.currentSegmentIndex + 1, App.lastBibleRef);
      }
    });
  }

  const stickyBtn = document.getElementById('btn-project-selected-verse');
  if (stickyBtn) {
    stickyBtn.addEventListener('click', () => {
      if (App.selectedVerse && App.selectedVerse.text && App.selectedVerse.ref) {
        projectVerse(App.selectedVerse.text, App.selectedVerse.ref, { noSegment: true });
      } else {
        showToast('Aucun verset sélectionné. Cliquez sur un verset pour le sélectionner.', 'warning');
      }
    });
  }
}

window.initBibleCommonEvents = initBibleCommonEvents;