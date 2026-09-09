/**
 * ============================================================
 *  panels/songsPanel.js — Orchestrateur panneau Chants
 *  NTIC Bible Projector · US-R17 Sprint R5
 *  Dépendances : panels/songsList.js · panels/songsEditor.js
 *  Scope global
 * ============================================================
 */

// ─────────────────────────────────────────────────────────────
//  PANNEAU PRINCIPAL
// ─────────────────────────────────────────────────────────────
async function renderSongsPanel(container) {
  const songs   = await dataService.getAllSongs();
  const favRefs = await getFavRefsSet();

  songs.forEach((s) => { s._isFav = favRefs.has(`song_${s.id}`); });
  _songsFilterQuery = '';

  container.innerHTML = `
    <div class="panel panel-songs" id="panel-songs">
      <div class="songs-list-col">
        <div class="songs-list-header">
          <span class="songs-list-title">${ICONS.songs} Chants (${songs.length})</span>
          <button class="btn btn-sm btn-primary" id="btn-new-song" aria-label="Nouveau chant">＋</button>
        </div>
        <div style="padding: 0 8px 8px 8px;">
          <input type="search" id="songs-search-input" class="field-input"
                 placeholder="🔍 Rechercher par titre..."
                 aria-label="Filtrer les chants" style="width:100%;">
        </div>
        <div id="new-song-form-slot"></div>
        <div class="songs-list-body" id="songs-list-body">
          ${renderSongCards(songs)}
        </div>
      </div>
      <div class="songs-editor-col" id="songs-editor-col">
        <div class="songs-editor-empty">
          <span>🎶</span>
          <p>Sélectionnez un chant pour l'éditer</p>
        </div>
      </div>
    </div>`;

  document.getElementById('songs-search-input')?.addEventListener('input', (e) => {
    _songsFilterQuery = e.target.value;
    refreshSongsList();
  });

  bindSongCards();
  document.getElementById('btn-new-song')?.addEventListener('click', showNewSongForm);
}

// ─────────────────────────────────────────────────────────────
//  EXPOSITION GLOBALE
// ─────────────────────────────────────────────────────────────
window.renderSongsPanel = renderSongsPanel;

console.warn('[songsPanel] Chargé ✓');