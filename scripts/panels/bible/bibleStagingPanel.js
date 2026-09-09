/**
 * ============================================================
 *  scripts/panels/bible/bibleStagingPanel.js — Staging Panel (Stage → Send)
 *  NTIC Bible Projector · US-REFACTOR-02
 *  Extrait de biblePanel.js
 *  Gère l'affichage du panneau de staging et le feedback d'envoi.
 *  Dépendances globales : esc, ICONS (constants.js)
 * ============================================================
 */

// ─────────────────────────────────────────────────────────────
//  MISE À JOUR DU STAGING PANEL
// ─────────────────────────────────────────────────────────────
function updateStagingPanel(text, ref) {
  const zone    = document.querySelector('.staging-zone');
  const info    = document.getElementById('staging-info');
  const sendBtn = document.getElementById('btn-project-selected-verse');
  if (!info) return;

  if (text && ref) {
    info.innerHTML = `
      <div class="staging-badge staging-badge--ready">
        <span class="staging-badge-dot"></span>En attente
      </div>
      <div class="staging-verse-ref">${esc(ref)}</div>
      <div class="staging-verse-text">${esc(text)}</div>`;
    zone?.classList.add('staging--ready');
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.title = "Envoyer ce verset à l'écran (Espace)";
    }
  } else {
    info.innerHTML = `<span class="staging-hint">Cliquez sur un verset pour le sélectionner</span>`;
    zone?.classList.remove('staging--ready');
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.title = "Sélectionnez un verset pour activer l'envoi";
    }
  }
}

// ─────────────────────────────────────────────────────────────
//  FEEDBACK VISUEL "EN DIRECT"
// ─────────────────────────────────────────────────────────────
function flashStagingAsSent() {
  const info = document.getElementById('staging-info');
  if (!info) return;
  const badge = info.querySelector('.staging-badge');
  if (!badge) return;
  badge.className = 'staging-badge staging-badge--sent';
  badge.innerHTML = '<span class="staging-badge-dot"></span>EN DIRECT';
  setTimeout(() => {
    if (badge.parentNode) {
      badge.className = 'staging-badge staging-badge--ready';
      badge.innerHTML = '<span class="staging-badge-dot"></span>En attente';
    }
  }, 2500);
}

// Exposer globalement
window.updateStagingPanel = updateStagingPanel;
window.flashStagingAsSent = flashStagingAsSent;

console.warn('[bibleStagingPanel] Chargé ✓');