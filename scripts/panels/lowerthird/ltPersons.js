/**
 * scripts/panels/lowerthird/ltPersons.js — Gestion des personnes (répertoire, impromptu, drag & drop)
 * NTIC Bible Projector · US-REFACTOR-LT
 * Dépendances globales : dataService, App, esc, logEvent, safePostMessage, showToast,
 *   _refreshLTPreview, renderLowerThirdPanel
 */

// ─────────────────────────────────────────────────────────────
//  PAYLOAD SETTINGS PERSONNE (factorisé)
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
//  BIND DES ACTIONS SUR LES PERSONNES (Projeter, Éditer, Supprimer)
// ─────────────────────────────────────────────────────────────
function _bindPersonActions(container) {
  // ── Projeter ───────────────────────────────────────────────
  document.querySelectorAll('.lt-project-person').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const person = await dataService.getPerson(Number(btn.dataset.id));
      if (!person) return;
      App.currentPersonActive = person.id;
      App.lastProjectedPersonNom   = person.nom;
      App.lastProjectedPersonTitre = person.titre;
      logEvent('Projection personne', { personId: person.id, nom: person.nom });
      sendLT('person', {
        nom: person.nom,
        titre: person.titre,
        ltType: App.settings.ltType,
        settings: _personSettings(),
      });
      _refreshLTPreview();
      showToast(`▶ ${person.nom} projeté`, 'success');
      document.querySelectorAll('.lt-person-card').forEach((c) => c.classList.remove('active'));
      btn.closest('.lt-person-card')?.classList.add('active');
    });
  });

  // ── Éditer inline (avec validation étape 6.2) ─────────────
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
        <input type="text" class="edit-nom"   value="${esc(currentNom)}"   placeholder="Nom"   style="flex:1; min-width:120px;" maxlength="80">
        <input type="text" class="edit-titre" value="${esc(currentTitre)}" placeholder="Titre" style="flex:1; min-width:120px;" maxlength="80">
        <button class="btn btn-sm btn-primary save-edit">✓</button>
        <button class="btn btn-sm btn-ghost   cancel-edit">✗</button>`;
      card.insertBefore(editForm, card.querySelector('.lt-person-actions'));

      const nomEdit   = editForm.querySelector('.edit-nom');
      const titreEdit = editForm.querySelector('.edit-titre');

      const save = async () => {
        const newNom = nomEdit.value.trim();
        if (!newNom) { showToast('⚠ Le nom est obligatoire', 'warning'); return; }
        if (newNom.length > 80) { showToast('⚠ Nom trop long (max 80 caractères)', 'warning'); return; }
        if (titreEdit.value.trim().length > 80) { showToast('⚠ Titre trop long (max 80 caractères)', 'warning'); return; }
        const person = await dataService.getPerson(id);
        if (person) {
          person.nom   = newNom;
          person.titre = titreEdit.value.trim();
          await dataService.savePerson(person);
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

  // ── Supprimer personne avec confirmation inline ────────────
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
        await dataService.deletePerson(id);
        if (App.currentPersonActive === id) App.currentPersonActive = null;
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

// ─────────────────────────────────────────────────────────────
//  FORMULAIRE AJOUT PERSONNE (avec validation étape 6.2)
// ─────────────────────────────────────────────────────────────
function _bindAddPerson(container) {
  const nomInput   = document.getElementById('lt-new-nom');
  const titreInput = document.getElementById('lt-new-titre');

  document.getElementById('lt-add-person-btn')?.addEventListener('click', async () => {
    const nom   = nomInput?.value?.trim();
    const titre = titreInput?.value?.trim();
    if (!nom || !titre) { showToast('⚠ Nom et titre sont requis', 'warning'); return; }
    if (nom.length > 80) { showToast('⚠ Nom trop long (max 80 caractères)', 'warning'); return; }
    if (titre.length > 80) { showToast('⚠ Titre trop long (max 80 caractères)', 'warning'); return; }
    await dataService.savePerson({ nom, titre, createdAt: Date.now() });
    if (nomInput)   nomInput.value   = '';
    if (titreInput) titreInput.value = '';
    showToast(`✅ Personne "${nom}" ajoutée`, 'success');
    await renderLowerThirdPanel(container);
  });
}

// ─────────────────────────────────────────────────────────────
//  PROJECTION IMPROMPTU (SANS SAUVEGARDE)
// ─────────────────────────────────────────────────────────────
function _bindImpromptu() {
  document.getElementById('lt-project-impromptu-btn')?.addEventListener('click', () => {
    const nom   = document.getElementById('lt-impromptu-nom')?.value?.trim();
    const titre = document.getElementById('lt-impromptu-titre')?.value?.trim();
    if (!nom || !titre) { showToast('⚠ Veuillez saisir un nom et un titre', 'warning'); return; }
    App.currentPersonActive = null;
    App.lastProjectedPersonNom   = nom;
    App.lastProjectedPersonTitre = titre;
    logEvent('Projection personne (impromptu)', { nom, titre });
    sendLT('person', {
      nom: nom,
      titre: titre,
      ltType: App.settings.ltType,
      settings: _personSettings(),
    });
    _refreshLTPreview();
    showToast(`🎙 ${nom} (impromptu) projeté`, 'success');
  });
}

// ─────────────────────────────────────────────────────────────
//  DRAG & DROP POUR RÉORDONNER LES CARTES PERSONNES
// ─────────────────────────────────────────────────────────────
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
    await dataService.saveSetting('personsOrder', ids);
    showToast('Ordre sauvegardé', 'success');
  });
}