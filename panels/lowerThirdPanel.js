/**
 * ============================================================
 *  panels/lowerThirdPanel.js — Panneau Lower Third
 *  NTIC Bible Projector · Extrait de app.js (refactoring SP-13)
 *  Dépendances globales :
 *    utils/dom.js      → esc, showToast, safePostMessage
 *    panels/biblePanel → projectVerse
 *    app.js            → App, updatePipPreview, logEvent
 *    db.js             → db
 *    constants.js      → ICONS
 * ============================================================
 */

// ─────────────────────────────────────────────────────────────
//  APERÇU LOWER THIRD (US-32)
// ─────────────────────────────────────────────────────────────

/** Construit l'aperçu du style ICC Graduation — verset (badge pill + carte blanche) */
function _buildLTPreviewGraduation(settings, ref, text) {
  return `
    <div class="lt-preview-graduation" style="position:relative; width:${settings.ltWidth}px; height:${settings.ltHeight}px; pointer-events:none;">
      <div class="reference-badge" style="position:absolute; left:0; top:0; height:64px; min-width:240px; padding:0 36px; display:flex; align-items:center; justify-content:center; border-radius:32px; background:linear-gradient(90deg, #0a2f8b 0%, #2347d1 35%, #d6009d 100%); box-shadow:0 12px 24px rgba(0,0,0,.35); z-index:3;">
        <span style="color:${settings.ltRefColor}; font-size:${settings.ltRefSize}px; font-weight:900; letter-spacing:1.8px; text-transform:uppercase; white-space:nowrap;">${esc(ref)}</span>
      </div>
      <div class="main-card" style="position:absolute; left:0; right:0; top:34px; height:calc(${settings.ltHeight}px - 34px); border-radius:40px; background:white; padding:8px; box-shadow:0 18px 32px rgba(0,0,0,.28);">
        <div class="card-inner" style="position:relative; width:100%; height:100%; border-radius:32px; background:linear-gradient(180deg, rgba(255,255,255,.99), rgba(250,250,250,.98)); overflow:hidden;">
          <div class="verset-text" style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; padding:0 72px; text-align:center; color:${settings.ltVerseColor}; font-size:${settings.ltVerseSize}px; font-weight:900; letter-spacing:1.5px; text-transform:uppercase; line-height:1.15; text-shadow:0 1px 0 rgba(255,255,255,.85);">
            ${esc(text)}
          </div>
        </div>
      </div>
    </div>
  `;
}

/** Construit l'aperçu du style ICC Graduation — personne (deux blocs côte-à-côte) */
function _buildLTPreviewGraduationPerson(settings, nom, titre) {
  const nameSize  = settings.personNameSize  || 30;
  const titleSize = settings.personTitleSize || 24;
  const font      = settings.ltFontFamily    || 'Arial Black';
  return `
    <div style="position:relative; width:${settings.ltWidth}px; height:${settings.ltHeight}px; display:flex; align-items:flex-end; pointer-events:none;">
      <div style="background:#ffffff; height:120px; flex:1; border-top-right-radius:60px; display:flex; flex-direction:column; justify-content:center; padding-left:40px; box-shadow:0 4px 15px rgba(0,0,0,.2); overflow:hidden;">
        <p style="font-size:${nameSize}px; font-family:'${font}', sans-serif; font-weight:900; color:#222; margin:0; letter-spacing:.06em; text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(nom)}</p>
      </div>
      <div style="background:linear-gradient(to right, #0a194e, #4a148c, #b71c1c); height:120px; flex:1; border-top-left-radius:60px; display:flex; flex-direction:column; justify-content:center; padding-left:40px; box-shadow:0 4px 15px rgba(0,0,0,.2); overflow:hidden;">
        <p style="font-size:${titleSize}px; font-family:'${font}', sans-serif; font-weight:700; color:#ffffff; margin:0; text-transform:uppercase; letter-spacing:.08em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(titre)}</p>
      </div>
    </div>
  `;
}

/** Construit l'aperçu du style Tour PAC */
function _buildLTPreviewTourpac(settings, ref, text) {
  return `
    <div class="lt-preview-tourpac" style="position:relative; width:${settings.ltWidth}px; height:${settings.ltHeight}px; pointer-events:none;">
      <div class="lt" style="position:relative; width:100%; height:100%; display:flex; align-items:stretch; clip-path:polygon(0% 0%, calc(100% - 24px) 0%, 100% 22px, 100% 100%, 0% 100%); border-radius:3px 16px 16px 3px; box-shadow:0 30px 50px -20px rgba(0,0,0,.45);">
        <div class="lt-bar" style="width:8px; flex-shrink:0; display:flex; flex-direction:column; border-radius:3px 0 0 3px; overflow:hidden;">
          <span style="flex:1; background:#009A44;"></span>
          <span style="flex:1; background:#FBDE4A;"></span>
          <span style="flex:1; background:#DC241F;"></span>
        </div>
        <div class="lt-body" style="flex:1; background:rgba(255,255,255,.92); backdrop-filter:blur(24px); padding:12px 20px 14px 18px; display:flex; flex-direction:column; gap:4px; border-radius:0 14px 14px 0; position:relative;">
          <div class="lt-l1" style="font-family:${settings.ltFontFamily}; font-weight:700; font-size:${settings.ltRefSize}px; letter-spacing:.08em; text-transform:uppercase; color:#009A44; line-height:1.25;">${esc(ref)}</div>
          <div class="lt-l2" style="font-family:${settings.ltFontFamily}; font-weight:300; font-style:italic; font-size:${settings.ltVerseSize}px; line-height:1.55; letter-spacing:.02em; color:#000; overflow-y:auto; max-height:100%; white-space:pre-wrap;">${esc(text)}</div>
        </div>
      </div>
    </div>
  `;
}

/** Rafraîchit l'aperçu du Lower Third dans le panneau */
function _refreshLTPreview() {
  const container = document.getElementById('lt-preview-box');
  if (!container) return;
  const inner = container.querySelector('.lt-preview-inner');
  if (!inner) return;

  const s = App.settings;
  // 'ictheme' est l'alias interne de 'graduation' (constants.js intouché)
  const isGraduation = s.ltType !== 'tourpac';

  // Aperçu personne graduation : quand une personne est active et style graduation
  if (isGraduation && App.currentPersonActive && App.lastProjectedPersonNom) {
    inner.innerHTML = _buildLTPreviewGraduationPerson(
      s,
      App.lastProjectedPersonNom,
      App.lastProjectedPersonTitre || ''
    );
    return;
  }

  // Aperçu verset (par défaut)
  const ref = App.lastBibleRef || 'Jean 3:16';
  let text = App.lastBibleText || 'Dieu a tant aimé le monde qu\'il a donné son Fils unique...';
  if (text.length > 100) text = text.slice(0, 100) + '…';

  const html = isGraduation
    ? _buildLTPreviewGraduation(s, ref, text)
    : _buildLTPreviewTourpac(s, ref, text);

  inner.innerHTML = html;
}

// ─────────────────────────────────────────────────────────────
//  HTML — construction du squelette du panneau
// ─────────────────────────────────────────────────────────────
function _buildLTHtml(persons) {
  const styleName = App.settings.ltType === 'tourpac' ? 'Tour PAC' : 'ICC Graduation';
  return `
    <div class="panel panel-lt" id="panel-lt">
      <!-- US-32 : Aperçu Lower Third -->
      <div class="lt-preview-box" id="lt-preview-box">
        <div class="lt-preview-inner" style="transform: scale(0.35); transform-origin: center center;">
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
            <input type="text" id="lt-new-nom" class="field-input" placeholder="Jean Dupont">
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
//  SOUS-FONCTIONS PRIVÉES
// ─────────────────────────────────────────────────────────────

/** Masquer + Reprojeter le dernier verset */
function _bindVerseActions() {
  document.getElementById('lt-hide-verse-btn')?.addEventListener('click', () => {
    safePostMessage({ type: 'hide-lower-third' });
    App.currentPersonActive = null;
    updatePipPreview({ mode: 'blank' });
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

/** Construire le payload settings personne (factorisé) */
function _personSettings() {
  return {
    refColor:      App.settings.ltRefColor,
    verseColor:    App.settings.ltVerseColor,
    fontFamily:    App.settings.ltFontFamily,
    width:         App.settings.ltWidth,
    height:        App.settings.ltHeight,
    nameFontSize:  App.settings.personNameSize,
    titleFontSize: App.settings.personTitleSize,
  };
}

/** Projeter, éditer, supprimer une personne du répertoire */
function _bindPersonActions(container) {
  // ── Projeter ───────────────────────────────────────────────
  document.querySelectorAll('.lt-project-person').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const person = await db.getPerson(Number(btn.dataset.id));
      if (!person) return;
      App.currentPersonActive = person.id;
      App.lastProjectedPersonNom   = person.nom;
      App.lastProjectedPersonTitre = person.titre;
      logEvent('Projection personne', { personId: person.id, nom: person.nom });
      safePostMessage({
        type: 'show-person',
        data: { nom: person.nom, titre: person.titre, ltType: App.settings.ltType, settings: _personSettings() },
      });
      updatePipPreview({ mode: 'person', nom: person.nom, titre: person.titre });
      _refreshLTPreview();
      showToast(`▶ ${person.nom} projeté`, 'success');
      document.querySelectorAll('.lt-person-card').forEach((c) => c.classList.remove('active'));
      btn.closest('.lt-person-card')?.classList.add('active');
    });
  });

  // ── Éditer inline ──────────────────────────────────────────
  document.querySelectorAll('.lt-edit-person').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id   = Number(btn.dataset.id);
      const card = btn.closest('.lt-person-card');
      if (!card || card.querySelector('.edit-form')) return;

      const contentDiv  = card.querySelector('div:first-child');
      const currentNom  = contentDiv.querySelector('div:first-child').textContent;
      const currentTitre = contentDiv.querySelector('div:last-child').textContent;
      contentDiv.style.display = 'none';

      const editForm = document.createElement('div');
      editForm.className  = 'edit-form';
      editForm.style.cssText = 'flex:1; display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;';
      editForm.innerHTML  = `
        <input type="text" class="edit-nom"   value="${esc(currentNom)}"   placeholder="Nom"   style="flex:1; min-width:120px;">
        <input type="text" class="edit-titre" value="${esc(currentTitre)}" placeholder="Titre" style="flex:1; min-width:120px;">
        <button class="btn btn-sm btn-primary save-edit">✓</button>
        <button class="btn btn-sm btn-ghost   cancel-edit">✗</button>`;
      card.insertBefore(editForm, card.querySelector('.lt-person-actions'));

      const nomEdit   = editForm.querySelector('.edit-nom');
      const titreEdit = editForm.querySelector('.edit-titre');

      const save = async () => {
        const newNom = nomEdit.value.trim();
        if (!newNom) { showToast('Le nom est obligatoire', 'warning'); return; }
        const person = await db.getPerson(id);
        if (person) {
          person.nom   = newNom;
          person.titre = titreEdit.value.trim();
          await db.savePerson(person);
          showToast('✅ Personne modifiée', 'success');
          await renderLowerThirdPanel(container);
        }
      };
      const cancel = () => { editForm.remove(); contentDiv.style.display = ''; };

      editForm.querySelector('.save-edit')?.addEventListener('click', save);
      editForm.querySelector('.cancel-edit')?.addEventListener('click', cancel);
      nomEdit.addEventListener('keydown',   (e) => { if (e.key === 'Enter') save(); });
      titreEdit.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
    });
  });

  // ── Supprimer personne avec confirmation inline (pattern fav-delete-confirm) ──
  document.querySelectorAll('.lt-delete-person').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.id);
      const card = btn.closest('.lt-person-card');
      if (!card || card.querySelector('.fav-delete-confirm')) return;

      const nameEl = card.querySelector('div:first-child div:first-child');
      const personName = nameEl ? nameEl.textContent : 'cette personne';

      const confirmDiv = document.createElement('div');
      confirmDiv.className = 'fav-delete-confirm';
      confirmDiv.innerHTML = `
        <span>Supprimer ${esc(personName)} ?</span>
        <button class="btn btn-sm btn-danger btn-del-yes">Oui</button>
        <button class="btn btn-sm btn-ghost btn-del-no">Non</button>`;
      card.appendChild(confirmDiv);

      const yesBtn = confirmDiv.querySelector('.btn-del-yes');
      const noBtn = confirmDiv.querySelector('.btn-del-no');
      const removeConfirm = () => {
        if (confirmDiv.parentNode) confirmDiv.remove();
      };
      noBtn?.addEventListener('click', removeConfirm);

      yesBtn?.addEventListener('click', async () => {
        await db.deletePerson(id);
        if (App.currentPersonActive === id) App.currentPersonActive = null;
        // Animation de disparition
        card.style.cssText = 'opacity:0;transform:translateX(12px);transition:all .2s';
        setTimeout(() => {
          card.remove();
          showToast(`${ICONS.delete} Personne supprimée`, 'info');
        }, 200);
      });

      setTimeout(removeConfirm, 5000);
    });
  });
}

/** Formulaire ➕ Ajouter une personne */
function _bindAddPerson(container) {
  const nomInput   = document.getElementById('lt-new-nom');
  const titreInput = document.getElementById('lt-new-titre');

  document.getElementById('lt-add-person-btn')?.addEventListener('click', async () => {
    const nom   = nomInput?.value?.trim();
    const titre = titreInput?.value?.trim();
    if (!nom || !titre) { showToast('Veuillez remplir le nom et le titre', 'warning'); return; }
    await db.savePerson({ id: Date.now(), nom, titre, createdAt: Date.now() });
    if (nomInput)   nomInput.value   = '';
    if (titreInput) titreInput.value = '';
    showToast(`✅ Personne "${nom}" ajoutée`, 'success');
    await renderLowerThirdPanel(container);
  });
}

/** Projection impromptu (sans sauvegarde) */
function _bindImpromptu() {
  document.getElementById('lt-project-impromptu-btn')?.addEventListener('click', () => {
    const nom   = document.getElementById('lt-impromptu-nom')?.value?.trim();
    const titre = document.getElementById('lt-impromptu-titre')?.value?.trim();
    if (!nom || !titre) { showToast('Veuillez saisir un nom et un titre', 'warning'); return; }
    App.currentPersonActive = null;
    App.lastProjectedPersonNom   = nom;
    App.lastProjectedPersonTitre = titre;
    logEvent('Projection personne (impromptu)', { nom, titre });
    safePostMessage({
      type: 'show-person',
      data: { nom, titre, ltType: App.settings.ltType, settings: _personSettings() },
    });
    updatePipPreview({ mode: 'person', nom, titre });
    _refreshLTPreview();
    showToast(`🎙 ${nom} (impromptu) projeté`, 'success');
  });
}

/** Drag-and-drop pour réordonner les cartes personnes (US-17) */
function _bindDragSort(container) {
  const list = document.getElementById('lt-persons-list');
  if (!list) return;

  let dragSrc = null;

  list.addEventListener('dragstart', (e) => {
    const card = e.target.closest('.lt-person-card');
    if (!card) return;
    dragSrc = card;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });

  list.addEventListener('dragover', (e) => {
    e.preventDefault();
    const card = e.target.closest('.lt-person-card');
    if (!card || card === dragSrc) return;
    e.dataTransfer.dropEffect = 'move';
    const rect = card.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    if (e.clientY < midY) {
      list.insertBefore(dragSrc, card);
    } else {
      list.insertBefore(dragSrc, card.nextSibling);
    }
  });

  list.addEventListener('dragend', async (e) => {
    const card = e.target.closest('.lt-person-card');
    card?.classList.remove('dragging');
    dragSrc = null;
    const ids = [...list.querySelectorAll('.lt-person-card')]
      .map((c) => Number(c.dataset.id));
    await db.saveSetting('personsOrder', ids);
    showToast('Ordre sauvegardé', 'success');
  });
}

// Mise à jour du badge d'information du style actif
function _updateStyleBadge() {
  const badge = document.getElementById('lt-style-badge');
  if (badge) {
    badge.textContent = App.settings.ltType === 'tourpac' ? 'Tour PAC' : 'ICC Graduation';
  }
}

// ─────────────────────────────────────────────────────────────
//  PANNEAU PRINCIPAL — orchestrateur
// ─────────────────────────────────────────────────────────────
async function renderLowerThirdPanel(container) {
  let persons = await db.getAllPersons();

  // Restaurer l'ordre sauvegardé (US-17)
  const order = await db.getSetting('personsOrder', null);
  if (order && Array.isArray(order)) {
    persons.sort((a, b) => {
      const ia = order.indexOf(a.id);
      const ib = order.indexOf(b.id);
      return (ia === -1 ? 9999 : ia) - (ib === -1 ? 9999 : ib);
    });
  }

  container.innerHTML = _buildLTHtml(persons);

  // Initialiser l'aperçu
  _refreshLTPreview();
  _updateStyleBadge();

  _bindVerseActions();
  _bindPersonActions(container);
  _bindAddPerson(container);
  _bindImpromptu();
  _bindDragSort(container);

  // Écouter les changements de paramètres LT (couleurs, polices, tailles)
  window.addEventListener('lt-settings-changed', () => {
    _refreshLTPreview();
    _updateStyleBadge();
  });

  // Restaurer la carte active
  if (App.currentPersonActive) {
    document.querySelector(`.lt-person-card[data-id="${App.currentPersonActive}"]`)?.classList.add('active');
  }
}