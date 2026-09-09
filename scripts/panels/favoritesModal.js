// favoritesModal.js (complet)
/**
 * ============================================================
 *  scripts/panels/favoritesModal.js — Modale Favoris (remplace l'onglet)
 *  NTIC Bible Projector · US-REFACTOR-FAVORITES-MODAL
 *  Version améliorée avec gestion des cas particuliers.
 * ============================================================
 */

// ─────────────────────────────────────────────────────────────
//  RÉFÉRENCE DE LA MODALE (évite les sélecteurs répétés)
// ─────────────────────────────────────────────────────────────
let _modalRef = null;
let _refreshInProgress = false;

function _getModal() {
  if (!_modalRef) {
    _modalRef = document.getElementById('favorites-modal');
  }
  return _modalRef;
}

// ─────────────────────────────────────────────────────────────
//  CONSTRUCTION HTML DES CARTES (identique à l'ancien favoritesPanel)
// ─────────────────────────────────────────────────────────────
function buildFavCards(favorites, labelFilter = '', searchQuery = '') {
  let items = favorites;

  if (labelFilter) items = items.filter((f) => f.label === labelFilter);

  if (searchQuery) {
    const q = searchQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    items = items.filter((f) => {
      const t = (f.title   ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const c = (f.content ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return t.includes(q) || c.includes(q);
    });
  }

  if (items.length === 0) {
    return `<div class="fav-empty">
      <span class="fav-empty-icon">☆</span>
      <h3>Aucun favori${labelFilter ? ` pour « ${esc(labelFilter)} »` : ''}</h3>
      <p>${labelFilter || searchQuery
        ? 'Essayez un autre filtre ou effacez la recherche.'
        : "Marquez des versets ★ dans l'onglet Bible ou des chants dans l'onglet Chants."
      }</p>
    </div>`;
  }

  return items.map((fav) => `
    <div class="fav-card" data-ref="${esc(fav.ref)}" data-id="${fav.id}" data-type="${fav.type}"
         data-title="${esc(fav.title ?? '')}" data-content="${esc(fav.content ?? '')}">
      <div class="fav-card-header">
        <span class="fav-type-badge fav-type-badge--${fav.type}">
          ${fav.type === 'verse' ? `${ICONS.bible} Verset` : `${ICONS.songs} Chant`}
        </span>
        <span class="fav-date">${fmtDate(fav.createdAt)}</span>
      </div>
      <div class="fav-card-body">
        <div class="fav-title">${esc(fav.title ?? '')}</div>
        <div class="fav-content">${esc(fav.content ?? '')}</div>
      </div>
      <div class="fav-label-zone" id="fav-label-zone-${fav.id}">
        ${fav.label
          ? `<button class="fav-label-badge btn-filter-label" data-label="${esc(fav.label)}"
                     aria-label="Filtrer par ${esc(fav.label)}">${ICONS.label} ${esc(fav.label)}</button>`
          : '<span class="fav-no-label">Sans étiquette</span>'
        }
      </div>
      <div class="fav-card-actions">
        <button class="btn btn-sm btn-primary btn-fav-project"
                data-ref="${esc(fav.ref)}" data-type="${fav.type}" data-title="${esc(fav.title ?? '')}"
                data-content="${esc(fav.content ?? '')}"
                aria-label="Projeter ${esc(fav.title ?? '')}">${ICONS.project} Envoyer à l’écran</button>
        <button class="btn btn-sm btn-ghost btn-fav-label"
                data-id="${fav.id}" data-ref="${esc(fav.ref)}"
                data-current-label="${esc(fav.label ?? '')}"
                aria-label="Modifier l'étiquette">${ICONS.edit} Modifier étiquette</button>
        <button class="btn btn-sm btn-ghost btn-fav-delete"
                data-ref="${esc(fav.ref)}"
                style="color:var(--danger)" aria-label="Supprimer ce favori">${ICONS.delete}</button>
      </div>
    </div>`).join('');
}

// ─────────────────────────────────────────────────────────────
//  ACTIONS SUR LES FAVORIS (depuis la modale)
// ─────────────────────────────────────────────────────────────

function _bindProjectButtons() {
  document.querySelectorAll('.btn-fav-project').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ref = btn.dataset.ref;
      const type = btn.dataset.type;
      const title = btn.dataset.title;
      const content = btn.dataset.content;
      const fav = { ref, type, title, content };
      await projectFavorite(fav);
      App.selectedFavorite = fav;
      document.querySelectorAll('.fav-card').forEach(c => c.classList.remove('selected-fav'));
      btn.closest('.fav-card')?.classList.add('selected-fav');
    });
  });
}

function _bindLabelFilterBadges() {
  document.querySelectorAll('.btn-filter-label').forEach((badge) => {
    badge.addEventListener('click', () => {
      const sel = document.getElementById('fav-label-filter');
      if (sel) {
        sel.value = badge.dataset.label;
        sel.dispatchEvent(new Event('change'));
      }
    });
  });
}

function _bindLabelEditButtons() {
  document.querySelectorAll('.btn-fav-label').forEach((btn) => {
    btn.addEventListener('click', () => {
      const { id, ref } = btn.dataset;
      const zone = document.getElementById(`fav-label-zone-${id}`);
      if (!zone || zone.dataset.editing) return;
      zone.dataset.editing = '1';

      const current = btn.dataset.currentLabel ?? '';
      zone.innerHTML = `
        <div class="fav-label-edit">
          <input type="text" id="fav-label-input-${id}" class="fav-label-input"
                 value="${esc(current)}" placeholder="Ex: Culte du dimanche"
                 aria-label="Nouvelle étiquette" maxlength="60">
          <button class="btn btn-sm btn-primary btn-label-ok"     aria-label="Valider">✓</button>
          <button class="btn btn-sm btn-ghost   btn-label-cancel" aria-label="Annuler">✗</button>
        </div>`;

      const input = document.getElementById(`fav-label-input-${id}`);
      input?.focus();

      const doSave = async () => {
        await dataService.updateFavoriteLabel(ref, input?.value?.trim() ?? '');
        showToast(`${ICONS.label} Étiquette mise à jour`, 'success');
        delete zone.dataset.editing;
        refreshFavoritesModal();
      };
      const doCancel = () => { delete zone.dataset.editing; refreshFavoritesModal(); };

      zone.querySelector('.btn-label-ok')?.addEventListener('click', doSave);
      zone.querySelector('.btn-label-cancel')?.addEventListener('click', doCancel);
      input?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter')  { e.preventDefault(); doSave(); }
        if (e.key === 'Escape') { e.preventDefault(); doCancel(); }
      });
    });
  });
}

function _bindDeleteButtons() {
  document.querySelectorAll('.btn-fav-delete').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const card = btn.closest('.fav-card');
      if (!card || card.querySelector('.fav-delete-confirm')) return;

      const confirm = document.createElement('div');
      confirm.className = 'fav-delete-confirm';
      confirm.innerHTML = `
        <span>Supprimer ce favori ?</span>
        <button class="btn btn-sm btn-danger btn-del-yes" data-ref="${esc(btn.dataset.ref)}">Oui</button>
        <button class="btn btn-sm btn-ghost  btn-del-no">Non</button>`;
      card.appendChild(confirm);

      confirm.querySelector('.btn-del-yes')?.addEventListener('click', async () => {
        await dataService.removeFavorite(btn.dataset.ref);
        card.style.cssText = 'opacity:0;transform:translateX(12px);transition:all .2s';
        setTimeout(async () => {
          card.remove();
          showToast(`${ICONS.delete} Favori supprimé`, 'info');
          const remaining = await dataService.getAllFavorites();
          rebuildLabelFilter(remaining, document.getElementById('fav-label-filter')?.value ?? '');
          refreshFavoritesModal(); // rafraîchit la liste si besoin
        }, 200);
      });
      confirm.querySelector('.btn-del-no')?.addEventListener('click', () => confirm.remove());
    });
  });
}

function _bindSelectFavorite() {
  document.querySelectorAll('.fav-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.btn-fav-project') ||
          e.target.closest('.btn-fav-label') ||
          e.target.closest('.btn-fav-delete') ||
          e.target.closest('.fav-label-badge')) {
        return;
      }
      const ref = card.dataset.ref;
      const type = card.dataset.type;
      const title = card.dataset.title;
      const content = card.dataset.content;
      App.selectedFavorite = { ref, type, title, content };
      document.querySelectorAll('.fav-card').forEach(c => c.classList.remove('selected-fav'));
      card.classList.add('selected-fav');
      showToast(`Favori sélectionné : ${title}`, 'info');
    });
  });
}

function bindFavCards() {
  _bindProjectButtons();
  _bindLabelFilterBadges();
  _bindLabelEditButtons();
  _bindDeleteButtons();
  _bindSelectFavorite();
}

// ─────────────────────────────────────────────────────────────
//  PROJECTION UNIFIÉE
// ─────────────────────────────────────────────────────────────
async function projectFavorite(fav) {
  if (!fav) return;

  if (fav.type === 'verse') {
    const { book, chapter, verse } = parseVerseRef(fav.ref);
    const text = App.bibleData?.[book]?.[chapter]?.[verse] ?? fav.content;
    projectVerse(text, fav.title || `${book} ${chapter}:${verse}`);
  } else {
    const songId = Number(fav.ref.replace('song_', ''));
    const song   = await dataService.getSong(songId);
    if (song?.strophes?.length > 0) {
      const allStrophesTexts = buildAllStrophesTexts(song.strophes);
      safePostMessage({
        type: 'show-song',
        data: {
          title:        song.title  ?? '',
          author:       song.author ?? '',
          lines:        song.strophes[0].lines        ?? [],
          translations: song.strophes[0].translations ?? [],
          strophes:     allStrophesTexts,
          currentIndex: 0,
          showTitle:  App.settings.songShowTitle,
          showAuthor: App.settings.songShowAuthor,
          settings: {
            bgColor:    App.settings.songBgColor,
            textColor:  App.settings.songTextColor,
            fontFamily: App.settings.songFontFamily,
            fontSize:   App.settings.songFontSize,
            showTitle:  App.settings.songShowTitle,
            showAuthor: App.settings.songShowAuthor,
            uppercase:  App.settings.songUppercase,
            textAlign:  App.settings.songTextAlign,
          },
        },
      });
      updatePipPreview({
        mode: 'song',
        title:  song.title,
        author: song.author,
        strophes: allStrophesTexts,
        currentStrophe: 0,
      });
      showToast(`🎵 ${esc(song.title)} projeté`, 'success');
    } else {
      showToast('⚠ Aucune strophe à projeter', 'warning');
    }
  }
}

// ─────────────────────────────────────────────────────────────
//  RAFFRAÎCHISSEMENT DE LA MODALE (avec verrou)
// ─────────────────────────────────────────────────────────────
async function refreshFavoritesModal() {
  if (_refreshInProgress) return;
  const modal = _getModal();
  if (!modal || modal.getAttribute('aria-hidden') === 'true') return;

  _refreshInProgress = true;
  try {
    const allFavs = await dataService.getAllFavorites();
    const search  = document.getElementById('fav-search')?.value?.trim() ?? '';
    const label   = document.getElementById('fav-label-filter')?.value   ?? '';
    const list    = document.getElementById('fav-list');
    if (!list) return;

    list.innerHTML = buildFavCards(allFavs, label, search);
    bindFavCards();
    rebuildLabelFilter(allFavs, label);
  } finally {
    _refreshInProgress = false;
  }
}

function rebuildLabelFilter(favorites, currentVal = '') {
  const sel = document.getElementById('fav-label-filter');
  if (!sel) return;
  const labels = [...new Set(favorites.map((f) => f.label).filter(Boolean))].sort();
  sel.innerHTML = `<option value="">🏷️ Toutes</option>
    ${labels.map((l) => `<option value="${esc(l)}" ${l === currentVal ? 'selected' : ''}>${esc(l)}</option>`).join('')}`;
}

// ─────────────────────────────────────────────────────────────
//  INITIALISATION DES ÉVÉNEMENTS DE LA MODALE
// ─────────────────────────────────────────────────────────────
function initFavoritesModalEvents() {
  const modal = _getModal();
  if (!modal) return;

  // Recherche et filtre
  document.getElementById('fav-search')?.addEventListener(
    'input', debounce(refreshFavoritesModal, 200)
  );
  document.getElementById('fav-label-filter')?.addEventListener('change', refreshFavoritesModal);

  // Export JSON
  document.getElementById('btn-fav-export')?.addEventListener('click', async () => {
    const json = await dataService.exportFavoritesJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url });
    a.download = `favorites_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`${ICONS.export} Téléchargement JSON effectué`, 'success');
  });

  // Bouton Projeter (sticky)
  document.getElementById('btn-fav-project-selected')?.addEventListener('click', () => {
    if (App.selectedFavorite) {
      projectFavorite(App.selectedFavorite);
    } else {
      showToast('Aucun favori sélectionné. Cliquez sur un favori pour le sélectionner.', 'warning');
    }
  });

  // Clic sur l'overlay pour fermer (renforce la sécurité)
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeFavoritesModal();
    }
  });
}

// ─────────────────────────────────────────────────────────────
//  EXPOSITION GLOBALE
// ─────────────────────────────────────────────────────────────
window.refreshFavoritesModal = refreshFavoritesModal;
window.projectFavorite = projectFavorite;
window.bindFavCards = bindFavCards;
window.buildFavCards = buildFavCards;

// Auto-initialisation au chargement (si la modale existe)
document.addEventListener('DOMContentLoaded', () => {
  initFavoritesModalEvents();
});

console.warn('[favoritesModal] Chargé ✓');