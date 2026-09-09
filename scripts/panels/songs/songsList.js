/**
 * panels/songsList.js — Liste et cartes chants
 * NTIC Bible Projector · US-R17 Sprint R5
 * Dépendances globales : dataService, App, esc, debounce, showToast, getFavRefsSet,
 *   renderSongEditor (panels/songsEditor.js — runtime), ICONS
 * Scope global — chargé AVANT panels/songsPanel.js
 */

// ─────────────────────────────────────────────────────────────
//  ÉTAT LOCAL
// ─────────────────────────────────────────────────────────────
let _songsFilterQuery = '';

// ─────────────────────────────────────────────────────────────
//  LISTE DES CHANTS
// ─────────────────────────────────────────────────────────────
async function refreshSongsList() {
  let filtered = [];
  if (_songsFilterQuery.trim() !== '') {
    filtered = await dataService.searchSongs(_songsFilterQuery);
  } else {
    filtered = await dataService.getAllSongs();
  }
  
  const favRefs = await getFavRefsSet();
  filtered.forEach(s => { s._isFav = favRefs.has(`song_${s.id}`); });

  const container = document.getElementById('songs-list-body');
  if (container) {
    container.innerHTML = renderSongCards(filtered);
    bindSongCards();
  }
  const titleSpan = document.querySelector('#panel-songs .songs-list-title');
  if (titleSpan) titleSpan.textContent = `${ICONS.songs} Chants (${filtered.length})`;
}

// ─────────────────────────────────────────────────────────────
//  CARTES CHANTS
// ─────────────────────────────────────────────────────────────
function renderSongCards(songs) {
  if (songs.length === 0) {
    return `<div class="songs-empty">Aucun chant. Appuyez sur <strong>＋</strong> pour commencer.</div>`;
  }
  return songs.map((s) => `
    <div class="song-card ${App.currentSong?.id === s.id ? 'active' : ''}"
         data-id="${s.id}" tabindex="0" role="button"
         aria-label="${esc(s.title ?? 'Sans titre')}" aria-selected="${App.currentSong?.id === s.id}">
      <div class="song-card-info">
        <div class="song-card-title">${esc(s.title ?? 'Sans titre')}</div>
        <div class="song-card-author">${esc(s.author ?? '')}</div>
        <div class="song-card-meta">${(s.strophes ?? []).length} strophe${(s.strophes ?? []).length !== 1 ? 's' : ''}</div>
      </div>
      <button class="btn-star ${s._isFav ? 'starred' : ''}"
              data-ref="song_${s.id}" data-song-id="${s.id}"
              aria-label="${s._isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}"
              aria-pressed="${!!s._isFav}">
        ${s._isFav ? '★' : '☆'}
      </button>
    </div>`).join('');
}

function bindSongCards() {
  document.querySelectorAll('.song-card').forEach((card) => {
    card.addEventListener('click', async (e) => {
      if (e.target.closest('.btn-star')) return;
      const song = await dataService.getSong(Number(card.dataset.id));
      if (!song) return;
      document.querySelectorAll('.song-card').forEach((c) => {
        c.classList.remove('active');
        c.setAttribute('aria-selected', 'false');
      });
      card.classList.add('active');
      card.setAttribute('aria-selected', 'true');
      renderSongEditor(song);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); }
    });
  });

  document.querySelectorAll('.song-card .btn-star').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const songId = Number(btn.dataset.songId);
      const song   = await dataService.getSong(songId);
      if (!song) return;

      const ref = `song_${songId}`;
      if (btn.classList.contains('starred')) {
        await dataService.removeFavorite(ref);
        btn.classList.remove('starred');
        btn.textContent = '☆';
        btn.setAttribute('aria-pressed', 'false');
        btn.setAttribute('aria-label', 'Ajouter aux favoris');
      } else {
        const preview = (song.strophes?.[0]?.lines ?? song.lyrics ?? []).join(' ');
        await dataService.addFavorite({
          type: 'song', ref, label: '',
          title:   song.title ?? 'Sans titre',
          content: preview.substring(0, 200),
        });
        btn.classList.add('starred');
        btn.textContent = '★';
        btn.setAttribute('aria-pressed', 'true');
        btn.setAttribute('aria-label', 'Retirer des favoris');
        showToast('★ Ajouté aux favoris', 'success');
      }
    });
  });
}

// ─────────────────────────────────────────────────────────────
//  FORMULAIRE NOUVEAU CHANT (avec validation étape 6.1)
// ─────────────────────────────────────────────────────────────
function showNewSongForm() {
  const slot = document.getElementById('new-song-form-slot');
  if (!slot || slot.children.length > 0) return;

  slot.innerHTML = `
    <div class="new-song-form">
      <input type="text" id="new-song-title-input" class="field-input"
             placeholder="Titre du chant…" aria-label="Titre du nouveau chant" maxlength="80">
      <div class="new-song-form-btns">
        <button class="btn btn-sm btn-primary" id="new-song-ok" aria-label="Créer">✓</button>
        <button class="btn btn-sm btn-ghost" id="new-song-cancel" aria-label="Annuler">✗</button>
      </div>
    </div>`;

  const input = document.getElementById('new-song-title-input');
  input?.focus();

  document.getElementById('new-song-ok')?.addEventListener('click', async () => {
    const title = input?.value?.trim();
    if (!title) { showToast('⚠ Le titre est obligatoire', 'warning'); return; }
    if (title.length > 80) { showToast('⚠ Le titre ne peut pas dépasser 80 caractères', 'warning'); return; }
    slot.innerHTML = '';
    const songData = { title, author: '', strophes: [], lyrics: [], translation: [] };
    const saved = await dataService.saveSong(songData);
    if (!saved) { showToast('❌ Erreur lors de la création', 'error'); return; }
    const song = await dataService.getSong(saved.id);
    await refreshSongsList();
    if (song) document.querySelector(`.song-card[data-id="${saved.id}"]`)?.click();
    showToast('✅ Chant créé', 'success');
  });

  document.getElementById('new-song-cancel')?.addEventListener('click', () => { slot.innerHTML = ''; });

  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  document.getElementById('new-song-ok')?.click();
    if (e.key === 'Escape') document.getElementById('new-song-cancel')?.click();
  });
}