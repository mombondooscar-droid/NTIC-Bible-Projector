/**
 * ============================================================
 *  panels/songsPanel.js — Panneau Chants
 *  NTIC Bible Projector · Extrait de app.js (refactoring SP-13)
 *  Dépendances globales :
 *    utils/dom.js      → esc, debounce, showToast, safePostMessage
 *    utils/songHelpers → parseStrophes, reconstructText, buildAllStrophesTexts
 *    app.js            → App (état global), updatePipPreview, logEvent, withWriteLock
 *    panels/biblePanel → getFavRefsSet   (favoris partagé)
 *    db.js             → db (IndexedDB)
 *    constants.js      → ICONS
 * ============================================================
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
    // Utilisation de l'index by_title pour une recherche optimisée (US-35)
    filtered = await db.searchSongsByTitle(_songsFilterQuery);
  } else {
    filtered = await db.getAllSongs();
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

async function renderSongsPanel(container) {
  const songs   = await db.getAllSongs();
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
      const song = await db.getSong(Number(card.dataset.id));
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
      const song   = await db.getSong(songId);
      if (!song) return;

      const ref = `song_${songId}`;
      if (btn.classList.contains('starred')) {
        await db.removeFavorite(ref);
        btn.classList.remove('starred');
        btn.textContent = '☆';
        btn.setAttribute('aria-pressed', 'false');
        btn.setAttribute('aria-label', 'Ajouter aux favoris');
      } else {
        const preview = (song.strophes?.[0]?.lines ?? song.lyrics ?? []).join(' ');
        await db.addFavorite({
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
//  FORMULAIRE NOUVEAU CHANT
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
    if (!title) { showToast('⚠ Saisissez un titre', 'warning'); return; }
    slot.innerHTML = '';
    const id   = await db.saveSong({ title, author: '', strophes: [], lyrics: [], translation: [] });
    const song = await db.getSong(id);
    await refreshSongsList();
    if (song) document.querySelector(`.song-card[data-id="${id}"]`)?.click();
    showToast('✅ Chant créé', 'success');
  });

  document.getElementById('new-song-cancel')?.addEventListener('click', () => { slot.innerHTML = ''; });

  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  document.getElementById('new-song-ok')?.click();
    if (e.key === 'Escape') document.getElementById('new-song-cancel')?.click();
  });
}

// ─────────────────────────────────────────────────────────────
//  APERÇU DIAPOSITIVE
// ─────────────────────────────────────────────────────────────
function getCurrentStrophes() {
  return App.currentSong?._previewStrophes ?? App.currentSong?.strophes ?? [];
}

function renderSlidePreview(strophes, idx) {
  if (!strophes?.length) return '<div class="slide-empty">Aucune strophe</div>';
  const s = strophes[idx] ?? strophes[0];
  return `<div class="slide-content">
    ${(s.lines ?? []).map((line, i) => `
      <div class="slide-line">${esc(line)}
        ${s.translations?.[i] ? `<div class="slide-trans">${esc(s.translations[i])}</div>` : ''}
      </div>`).join('')}
  </div>`;
}

function updateSlidePreview() {
  const strophes  = getCurrentStrophes();
  const preview   = document.getElementById('slide-preview');
  const indicator = document.getElementById('slide-indicator');
  if (preview)   preview.innerHTML     = renderSlidePreview(strophes, App.currentStropheIdx);
  if (indicator) indicator.textContent = strophes.length
    ? `${App.currentStropheIdx + 1} / ${strophes.length}`
    : '—';
}

// ─────────────────────────────────────────────────────────────
//  US-23 : GRILLE STROPHES CLIQUABLES
// ─────────────────────────────────────────────────────────────

/** Retourne le label lisible d'une strophe selon son type. */
function _stropheLabel(strophe, idx, allStrophes) {
  if (strophe.type === 'chorus') return 'Refrain';
  if (strophe.type === 'bridge') return 'Pont';
  if (strophe.type === 'intro')  return 'Intro';
  if (strophe.type === 'outro')  return 'Outro';
  // Verse : numéroter uniquement les couplets
  const verseNum = allStrophes.slice(0, idx).filter(
    (s) => !['chorus', 'bridge', 'intro', 'outro'].includes(s.type),
  ).length + 1;
  return `Strophe ${verseNum}`;
}

/** Génère le HTML de la grille de cartes strophes. */
function _buildStrophesGrid(strophes, currentIdx) {
  if (!strophes || strophes.length === 0) {
    return `<div class="strophe-card-empty">Aucune strophe — saisissez des paroles ci-contre</div>`;
  }
  return strophes.map((s, i) => {
    const label   = _stropheLabel(s, i, strophes);
    const raw     = (s.lines ?? []).slice(0, 2).join(' ');
    const preview = raw.length > 80 ? raw.slice(0, 77) + '…' : raw;
    return `<div class="strophe-card ${i === currentIdx ? 'active' : ''}"
                 data-idx="${i}" tabindex="0" role="button"
                 aria-label="${esc(label)}" aria-pressed="${i === currentIdx}">
      <div class="strophe-card-header">${esc(label)}</div>
      <div class="strophe-card-body">${preview ? esc(preview) : '<em>Vide</em>'}</div>
    </div>`;
  }).join('');
}

/** Projette la strophe à l'index donné et met à jour l'état/UI. */
function _projectStropheAtIdx(idx) {
  const strophes = getCurrentStrophes();
  const s = strophes[idx];
  if (!s) return;

  App.currentStropheIdx = idx;

  const title  = document.getElementById('song-title-inp')?.value  ?? App.currentSong?.title  ?? '';
  const author = document.getElementById('song-author-inp')?.value ?? App.currentSong?.author ?? '';
  const allStrophesTexts = buildAllStrophesTexts(strophes);
  const label  = _stropheLabel(s, idx, strophes);

  // Log de l'événement
  logEvent('Projection chant', { songId: App.currentSong.id, stropheIdx: idx, songTitle: App.currentSong.title });

  safePostMessage({
    type: 'show-song',
    data: {
      title, author,
      lines:        s.lines        ?? [],
      translations: s.translations ?? [],
      strophes:     allStrophesTexts,
      currentIndex: idx,
      showTitle:    App.settings.songShowTitle,
      showAuthor:   App.settings.songShowAuthor,
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
    mode: 'song', title, author,
    strophes: allStrophesTexts,
    currentStrophe: idx,
  });
  showToast(`🎵 ${label} projetée`, 'success');
}

/** Synchronise la carte active sans reconstruire toute la grille. */
function _syncActiveStropheCard(idx) {
  document.querySelectorAll('.strophe-card').forEach((c, i) => {
    const active = (i === idx);
    c.classList.toggle('active', active);
    c.setAttribute('aria-pressed', String(active));
  });
  updateSlidePreview(); // met à jour l'indicateur #slide-indicator
}

/** Branche les handlers clic/clavier sur les cartes strophes. */
function _bindStropheCards() {
  document.querySelectorAll('.strophe-card').forEach((card) => {
    card.addEventListener('click', () => {
      const idx = Number(card.dataset.idx);
      _syncActiveStropheCard(idx);
      _projectStropheAtIdx(idx);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); }
    });
  });
}

// ─────────────────────────────────────────────────────────────
//  ÉDITEUR DE CHANT — sous-fonctions privées
// ─────────────────────────────────────────────────────────────

/** Boutons d'alignement Gauche / Centre / Droite */
function _bindAlignButtons() {
  document.querySelectorAll('[data-align]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const align = btn.dataset.align;
      if (align === App.settings.songTextAlign) return;
      App.settings.songTextAlign = align;
      await db.saveSetting('songTextAlign', align);

      document.querySelectorAll('[data-align]').forEach((b) => {
        const active = b.dataset.align === align;
        b.classList.toggle('btn-primary', active);
        b.classList.toggle('btn-ghost',   !active);
      });

      safePostMessage({
        type: 'song-settings',
        settings: {
          bgColor:    App.settings.songBgColor,
          textColor:  App.settings.songTextColor,
          fontSize:   App.settings.songFontSize,
          fontFamily: App.settings.songFontFamily,
          showTitle:  App.settings.songShowTitle,
          showAuthor: App.settings.songShowAuthor,
          uppercase:  App.settings.songUppercase,
          textAlign:  App.settings.songTextAlign,
        },
      });
      const label = align === 'left' ? 'gauche' : align === 'right' ? 'droite' : 'centré';
      showToast(`Alignement : ${label}`, 'success');
    });
  });
}

/** Textarea paroles → mise à jour compteur + grille strophes + ajustement index (Problème #9) */
function _bindLyricsTextarea() {
  document.getElementById('song-lyrics-ta')?.addEventListener('input', function () {
    const strophes = parseStrophes(this.value);
    const n = strophes.length;
    document.getElementById('strophe-count').textContent =
      `${n} strophe${n !== 1 ? 's' : ''} détectée${n !== 1 ? 's' : ''}`;
    App.currentSong._previewStrophes = strophes;
    
    // ✅ Problème #9 : ajuster l'index courant si nécessaire
    if (App.currentStropheIdx >= strophes.length) {
      App.currentStropheIdx = Math.max(0, strophes.length - 1);
    }
    if (App.currentStropheIdx < 0) App.currentStropheIdx = 0;
    
    updateSlidePreview(); // met à jour l'indicateur

    // US-23 : reconstruire la grille avec les nouvelles strophes parsées
    const grid = document.getElementById('strophes-grid');
    if (grid) {
      grid.innerHTML = _buildStrophesGrid(strophes, App.currentStropheIdx);
      _bindStropheCards();
    }
  });
}

/** Boutons ◀ / ▶ de navigation entre strophes (US-23 : sync carte active) */
function _bindStropheNav() {
  document.getElementById('slide-prev')?.addEventListener('click', () => {
    if (App.currentStropheIdx <= 0) return;
    App.currentStropheIdx--;
    _syncActiveStropheCard(App.currentStropheIdx);
    safePostMessage({ type: 'song-prev-strophe' });
    const allStrophesTexts = buildAllStrophesTexts(getCurrentStrophes());
    updatePipPreview({
      mode: 'song',
      title:  App.currentSong?.title  ?? '',
      author: App.currentSong?.author ?? '',
      strophes: allStrophesTexts,
      currentStrophe: App.currentStropheIdx,
    });
  });

  document.getElementById('slide-next')?.addEventListener('click', () => {
    const strophes = getCurrentStrophes();
    if (App.currentStropheIdx >= strophes.length - 1) return;
    App.currentStropheIdx++;
    _syncActiveStropheCard(App.currentStropheIdx);
    safePostMessage({ type: 'song-next-strophe' });
    const allStrophesTexts = buildAllStrophesTexts(strophes);
    updatePipPreview({
      mode: 'song',
      title:  App.currentSong?.title  ?? '',
      author: App.currentSong?.author ?? '',
      strophes: allStrophesTexts,
      currentStrophe: App.currentStropheIdx,
    });
  });
}

/** Bouton 🖥 Projeter cette strophe (existant, sera wrapper) */
function _bindProjectButton() {
  document.getElementById('btn-project-slide')?.addEventListener('click', () => {
    const strophes = getCurrentStrophes();
    const s = strophes[App.currentStropheIdx];
    if (!s) { showToast('⚠ Aucune strophe à projeter', 'warning'); return; }

    const title  = document.getElementById('song-title-inp')?.value  ?? App.currentSong.title  ?? '';
    const author = document.getElementById('song-author-inp')?.value ?? App.currentSong.author ?? '';
    const allStrophesTexts = buildAllStrophesTexts(strophes);

    safePostMessage({
      type: 'show-song',
      data: {
        title, author,
        lines:        s.lines        ?? [],
        translations: s.translations ?? [],
        strophes:     allStrophesTexts,
        currentIndex: App.currentStropheIdx,
        showTitle:    App.settings.songShowTitle,
        showAuthor:   App.settings.songShowAuthor,
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
      mode: 'song', title, author,
      strophes: allStrophesTexts,
      currentStrophe: App.currentStropheIdx,
    });
    showToast('🎵 Strophe projetée', 'success');
  });
}

/** Bouton 💾 Enregistrer */
function _bindSaveButton() {
  document.getElementById('btn-save-song')?.addEventListener('click', async () => {
    await withWriteLock(async () => {
      const title    = document.getElementById('song-title-inp')?.value?.trim()  ?? '';
      const author   = document.getElementById('song-author-inp')?.value?.trim() ?? '';
      const rawText  = document.getElementById('song-lyrics-ta')?.value          ?? '';
      const strophes = parseStrophes(rawText);

      const updated = {
        ...App.currentSong,
        title, author, strophes,
        lyrics:      strophes.flatMap((s) => s.lines),
        translation: strophes.flatMap((s) => s.translations),
      };

      await db.saveSong(updated);
      App.currentSong = updated;

      await refreshSongsList();
      document.querySelector(`.song-card[data-id="${updated.id}"]`)?.classList.add('active');
      updateSlidePreview();
      showToast('✅ Chant enregistré', 'success');
      logEvent('Sauvegarde chant', { songId: updated.id, title: updated.title });
    }, 'Sauvegarde chant');
  });
}

/** Bouton 🗑 Supprimer (avec confirmation inline pattern fav-delete-confirm) */
function _bindDeleteButton() {
  document.getElementById('btn-delete-song')?.addEventListener('click', async () => {
    if (!App.currentSong) return;
    const footer = document.querySelector('.song-editor-footer');
    if (!footer || footer.querySelector('.fav-delete-confirm')) return;

    const songTitle = App.currentSong.title || 'Sans titre';
    const cardToRemove = document.querySelector(`.song-card[data-id="${App.currentSong.id}"]`);

    const confirmDiv = document.createElement('div');
    confirmDiv.className = 'fav-delete-confirm';
    confirmDiv.innerHTML = `
      <span>Supprimer « ${esc(songTitle)} » ?</span>
      <button class="btn btn-sm btn-danger btn-del-yes">Oui</button>
      <button class="btn btn-sm btn-ghost btn-del-no">Non</button>`;
    footer.appendChild(confirmDiv);

    const yesBtn = confirmDiv.querySelector('.btn-del-yes');
    const noBtn = confirmDiv.querySelector('.btn-del-no');
    const removeConfirm = () => {
      if (confirmDiv.parentNode) confirmDiv.remove();
    };
    noBtn?.addEventListener('click', removeConfirm);

    yesBtn?.addEventListener('click', async () => {
      await withWriteLock(async () => {
        const id = App.currentSong.id;
        await db.deleteSong(id);
        await db.removeFavorite(`song_${id}`);

        if (cardToRemove) {
          // Animation de suppression
          cardToRemove.style.cssText = 'opacity:0;transform:translateX(12px);transition:all .2s';
          setTimeout(() => {
            cardToRemove.remove();
            // Mise à jour du compteur dans l'en-tête
            const remaining = document.querySelectorAll('.song-card').length;
            const titleSpan = document.querySelector('#panel-songs .songs-list-title');
            if (titleSpan) titleSpan.textContent = `${ICONS.songs} Chants (${remaining})`;
            // Vider l'éditeur
            const col = document.getElementById('songs-editor-col');
            if (col) col.innerHTML = `<div class="songs-editor-empty"><span>🎶</span><p>Sélectionnez un chant</p></div>`;
            App.currentSong = null;
            showToast(`${ICONS.delete} Chant supprimé`, 'info');
            logEvent('Suppression chant', { songId: id, title: songTitle });
          }, 200);
        } else {
          // Fallback si la carte n'est pas trouvée
          await refreshSongsList();
          const col = document.getElementById('songs-editor-col');
          if (col) col.innerHTML = `<div class="songs-editor-empty"><span>🎶</span><p>Sélectionnez un chant</p></div>`;
          App.currentSong = null;
          showToast(`${ICONS.delete} Chant supprimé`, 'info');
          logEvent('Suppression chant (fallback)', { songId: id, title: songTitle });
        }
      }, 'Suppression chant');
    });

    setTimeout(removeConfirm, 5000);
  });
}

/** Génère le squelette HTML de l'éditeur de chant. */
function _buildEditorHtml(song, text, total, currentAlign) {
  const a = (v) => currentAlign === v ? 'btn-primary' : 'btn-ghost';
  return `
    <div class="song-editor">
      <div class="song-editor-meta">
        <input type="text" id="song-title-inp"  class="song-meta-field"
               value="${esc(song.title  ?? '')}" placeholder="Titre"  aria-label="Titre">
        <input type="text" id="song-author-inp" class="song-meta-field"
               value="${esc(song.author ?? '')}" placeholder="Auteur" aria-label="Auteur">
      </div>

      <div class="song-align-buttons" style="display:flex; gap:8px; margin:10px 0;">
        <button class="btn btn-sm ${a('left')}"   data-align="left"   title="Aligner à gauche">⇤ Gauche</button>
        <button class="btn btn-sm ${a('center')}" data-align="center" title="Centrer">≡ Centre</button>
        <button class="btn btn-sm ${a('right')}"  data-align="right"  title="Aligner à droite">Droite ⇥</button>
      </div>

      <div class="song-editor-body">
        <div class="song-lyrics-zone">
          <label class="field-label" for="song-lyrics-ta">
            Paroles — ligne normale = original, <code>*ligne</code> = traduction
          </label>
          <textarea id="song-lyrics-ta" class="song-lyrics-ta" aria-label="Paroles">${esc(text)}</textarea>
          <div class="strophe-count" id="strophe-count">
            ${total} strophe${total !== 1 ? 's' : ''} détectée${total !== 1 ? 's' : ''}
          </div>
        </div>

        <div class="song-slides-zone">
          <div class="slides-nav">
            <button class="btn btn-sm btn-ghost" id="slide-prev" aria-label="Strophe précédente">◀</button>
            <span class="slide-indicator" id="slide-indicator" aria-live="polite">
              ${total > 0 ? '1 / ' + total : '—'}
            </span>
            <button class="btn btn-sm btn-ghost" id="slide-next" aria-label="Strophe suivante">▶</button>
          </div>
          <div class="strophes-grid" id="strophes-grid">
            ${_buildStrophesGrid(song.strophes ?? [], 0)}
          </div>
        </div>
      </div>

      <!-- R#13 : Le footer existant devient le wrapper sticky -->
      <div class="panel-project-action">
        <div class="song-editor-footer">
          <button class="btn btn-primary"          id="btn-save-song">💾 Enregistrer</button>
          <button class="btn btn-primary"          id="btn-project-slide">${ICONS.project} Envoyer à l’écran</button>
          <button class="btn btn-ghost btn-sm btn-song-delete" id="btn-delete-song"
                  style="color:var(--danger)">${ICONS.delete} Supprimer</button>
        </div>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
//  ÉDITEUR DE CHANT — orchestrateur (~30 lignes)
// ─────────────────────────────────────────────────────────────
function renderSongEditor(song) {
  App.currentSong       = song;
  App.currentStropheIdx = 0;

  const col = document.getElementById('songs-editor-col');
  if (!col) return;

  const text         = reconstructText(song.strophes ?? []);
  const total        = (song.strophes ?? []).length;
  const currentAlign = App.settings.songTextAlign || 'center';

  col.innerHTML = _buildEditorHtml(song, text, total, currentAlign);

  // Brancher tous les handlers
  _bindAlignButtons();
  _bindLyricsTextarea();
  _bindStropheNav();
  _bindStropheCards();   // US-23 : cartes strophes cliquables
  _bindProjectButton();
  _bindSaveButton();
  _bindDeleteButton();
}