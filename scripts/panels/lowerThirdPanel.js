/**
 * ============================================================
 *  panels/lowerThirdPanel.js — Panneau Lower Third (orchestrateur)
 *  NTIC Bible Projector · US-REFACTOR-LT
 *  Orchestre l'affichage et délègue les sous-fonctions aux modules.
 *  Dépendances globales :
 *    utils/dom.js      → esc, showToast, safePostMessage
 *    panels/biblePanel → projectVerse
 *    app.js            → App, updatePipPreview, logEvent
 *    dataService       → dataService (US-R09-02)
 *    constants.js      → ICONS
 * ============================================================
 */

// ─────────────────────────────────────────────────────────────
//  HTML — SQUELETTE DU PANNEAU
// ─────────────────────────────────────────────────────────────
function _buildLTHtml(persons) {
  const styleName = App.settings.ltType === 'tourpac' ? 'Tour PAC' : 'ICC Graduation';
  return `
    <div class="panel panel-lt" id="panel-lt">
      <!-- US-32 : Aperçu Lower Third -->
      <div class="lt-preview-box" id="lt-preview-box">
        <div class="lt-preview-inner" style="transform: scale(0.50); transform-origin: center center;">
          <!-- Rempli dynamiquement par _refreshLTPreview() -->
        </div>
      </div>

      <!-- Sous-panneau Versets (sans radio, badge lecture seule) -->
      <div class="settings-section" style="margin-bottom: 1.5rem;">
        <h2 class="settings-section-title">${ICONS.bible} Versets</h2>
        <div style="display:flex; align-items:center; gap:1rem; flex-wrap:wrap; margin-bottom:1rem;">
          <div class="settings-hint" style="margin:0;">
            Style actif : <strong id="lt-style-badge">${styleName}</strong>
          </div>
          <div style="flex:1; min-width:200px;">
            <span class="field-label">Dernier verset projeté :</span>
            <div id="lt-last-ref" style="font-family:monospace; font-size:0.9rem; background:var(--bg-input); padding:4px 8px; border-radius:var(--radius-sm);">
              ${App.lastBibleRef || '—'}
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" id="lt-hide-verse-btn">🙈 Masquer</button>
          <button class="btn btn-primary   btn-sm" id="lt-reproject-verse-btn">${ICONS.bible} Reprojeter</button>
        </div>
      </div>

      <!-- Sous-panneau Personnes -->
      <div class="settings-section">
        <h2 class="settings-section-title">👥 Personnes</h2>
        <div id="lt-persons-list" style="display:flex; flex-direction:column; gap:0.75rem;">
          ${persons.length === 0
            ? `<div class="empty-state" style="padding:1rem;"><div class="empty-state-icon">👤</div><p>Aucune personne enregistrée.</p></div>`
            : persons.map((p) => `
                <div class="lt-person-card" data-id="${p.id}" draggable="true" style="display:flex; align-items:center; gap:1rem; background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-sm); padding:0.6rem 1rem;">
                  <div style="flex:1; min-width:0;">
                    <div style="font-weight:700;">${esc(p.nom   || '—')}</div>
                    <div style="font-size:0.8rem; color:var(--text-muted);">${esc(p.titre || '')}</div>
                  </div>
                  <div style="display:flex; gap:0.5rem; flex-shrink:0;">
                    <button class="btn btn-sm btn-primary lt-project-person" data-id="${p.id}" data-nom="${esc(p.nom)}" data-titre="${esc(p.titre)}">${ICONS.project} Projeter</button>
                    <button class="btn btn-sm btn-ghost   lt-edit-person"    data-id="${p.id}" data-nom="${esc(p.nom)}" data-titre="${esc(p.titre)}">${ICONS.edit}</button>
                    <button class="btn btn-sm btn-danger  lt-delete-person"  data-id="${p.id}" style="color:var(--danger);">${ICONS.delete}</button>
                  </div>
                </div>`).join('')
          }
        </div>

        <!-- Formulaire ajout -->
        <div style="margin-top:1rem; display:flex; gap:1rem; flex-wrap:wrap; align-items:flex-end;">
          <div style="flex:1; min-width:180px;">
            <label class="field-label" for="lt-new-nom">Nom</label>
            <input type="text" id="lt-new-nom" class="field-input" placeholder="Gervais Ebata">
          </div>
          <div style="flex:1; min-width:180px;">
            <label class="field-label" for="lt-new-titre">Titre</label>
            <input type="text" id="lt-new-titre" class="field-input" placeholder="Pasteur">
          </div>
          <button class="btn btn-primary" id="lt-add-person-btn">➕ Ajouter personne</button>
        </div>

        <!-- Impromptu -->
        <div style="margin-top:1.5rem; border-top:1px solid var(--border); padding-top:1rem;">
          <h3 class="settings-section-title" style="margin-top:0;">⚡ Intervenant impromptu</h3>
          <div style="display:flex; gap:1rem; flex-wrap:wrap; align-items:flex-end;">
            <div style="flex:1; min-width:180px;">
              <label class="field-label" for="lt-impromptu-nom">Nom</label>
              <input type="text" id="lt-impromptu-nom" class="field-input" placeholder="Nom">
            </div>
            <div style="flex:1; min-width:180px;">
              <label class="field-label" for="lt-impromptu-titre">Titre</label>
              <input type="text" id="lt-impromptu-titre" class="field-input" placeholder="Titre">
            </div>
            <button class="btn btn-secondary" id="lt-project-impromptu-btn">🎙 Projeter sans sauvegarde</button>
          </div>
        </div>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
//  MISE À JOUR DU BADGE DE STYLE
// ─────────────────────────────────────────────────────────────
function _updateStyleBadge() {
  const badge = document.getElementById('lt-style-badge');
  if (badge) {
    badge.textContent = App.settings.ltType === 'tourpac' ? 'Tour PAC' : 'ICC Graduation';
  }
}

// ─────────────────────────────────────────────────────────────
//  PANNEAU PRINCIPAL — ORCHESTRATEUR
// ─────────────────────────────────────────────────────────────
async function renderLowerThirdPanel(container) {
  let persons = await dataService.getAllPersons();

  const order = await dataService.getSetting('personsOrder', null);
  if (order && Array.isArray(order)) {
    persons.sort((a, b) => {
      const ia = order.indexOf(a.id);
      const ib = order.indexOf(b.id);
      return (ia === -1 ? 9999 : ia) - (ib === -1 ? 9999 : ib);
    });
  }

  container.innerHTML = _buildLTHtml(persons);

  _refreshLTPreview();
  _updateStyleBadge();

  _bindVerseActions();
  _bindPersonActions(container);
  _bindAddPerson(container);
  _bindImpromptu();
  _bindDragSort(container);

  window.addEventListener('lt-settings-changed', () => {
    _refreshLTPreview();
    _updateStyleBadge();
  });

  if (App.currentPersonActive) {
    document.querySelector(`.lt-person-card[data-id="${App.currentPersonActive}"]`)?.classList.add('active');
  }
}