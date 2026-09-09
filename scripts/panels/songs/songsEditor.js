/**
 * panels/songsEditor.js — Éditeur de chant (strophes, slides, sauvegarde)
 * NTIC Bible Projector · US-R17 Sprint R5
 * Dépendances globales : dataService, App, esc, showToast, safePostMessage,
 *   updatePipPreview, logEvent, withWriteLock, parseStrophes, reconstructText,
 *   buildAllStrophesTexts, ICONS
 * Scope global — chargé AVANT panels/songsPanel.js
 */

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

function _stropheLabel(strophe, idx, allStrophes) {
  if (strophe.type === 'chorus') return 'Refrain';
  if (strophe.type === 'bridge') return 'Pont';
  if (strophe.type === 'intro')  return 'Intro';
  if (strophe.type === 'outro')  return 'Outro';
  const verseNum = allStrophes.slice(0, idx).filter(
    (s) => !['chorus', 'bridge', 'intro', 'outro'].includes(s.type),
  ).length + 1;
  return `Strophe ${verseNum}`;
}

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

function _projectStropheAtIdx(idx) {
  const strophes = getCurrentStrophes();
  const s = strophes[idx];
  if (!s) return;

  App.currentStropheIdx = idx;

  const title  = document.getElementById('song-title-inp')?.value  ?? App.currentSong?.title  ?? '';
  const author = document.getElementById('song-author-inp')?.value ?? App.currentSong?.author ?? '';
  const allStrophesTexts = buildAllStrophesTexts(strophes);
  const label  = _stropheLabel(s, idx, strophes);

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

function _syncActiveStropheCard(idx) {
  document.querySelectorAll('.strophe-card').forEach((c, i) => {
    const active = (i === idx);
    c.classList.toggle('active', active);
    c.setAttribute('aria-pressed', String(active));
  });
  updateSlidePreview();
}

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

function _bindAlignButtons() {
  document.querySelectorAll('[data-align]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const align = btn.dataset.align;
      if (align === App.settings.songTextAlign) return;
      App.settings.songTextAlign = align;
      await dataService.saveSetting('songTextAlign', align);

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

function _bindLyricsTextarea() {
  document.getElementById('song-lyrics-ta')?.addEventListener('input', function () {
    const strophes = parseStrophes(this.value);
    const n = strophes.length;
    document.getElementById('strophe-count').textContent =
      `${n} strophe${n !== 1 ? 's' : ''} détectée${n !== 1 ? 's' : ''}`;
    App.currentSong._previewStrophes = strophes;
    
    if (App.currentStropheIdx >= strophes.length) {
      App.currentStropheIdx = Math.max(0, strophes.length - 1);
    }
    if (App.currentStropheIdx < 0) App.currentStropheIdx = 0;
    
    updateSlidePreview();

    const grid = document.getElementById('strophes-grid');
    if (grid) {
      grid.innerHTML = _buildStrophesGrid(strophes, App.currentStropheIdx);
      _bindStropheCards();
    }
  });
}

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

// ─────────────────────────────────────────────────────────────
//  BIND SAUVEGARDE AVEC VALIDATION (étape 6.1)
// ─────────────────────────────────────────────────────────────
function _bindSaveButton() {
  document.getElementById('btn-save-song')?.addEventListener('click', async () => {
    await withWriteLock(async () => {
      const title    = document.getElementById('song-title-inp')?.value?.trim()  ?? '';
      const author   = document.getElementById('song-author-inp')?.value?.trim() ?? '';
      // Validation (étape 6.1)
      if (!title) { showToast('⚠ Le titre est obligatoire', 'warning'); return; }
      if (title.length > 80) { showToast('⚠ Titre trop long (max 80 caractères)', 'warning'); return; }
      if (author.length > 80) { showToast('⚠ Auteur trop long (max 80 caractères)', 'warning'); return; }

      const rawText  = document.getElementById('song-lyrics-ta')?.value          ?? '';
      const strophes = parseStrophes(rawText);

      const updated = {
        ...App.currentSong,
        title, author, strophes,
        lyrics:      strophes.flatMap((s) => s.lines),
        translation: strophes.flatMap((s) => s.translations),
      };

      const saved = await dataService.saveSong(updated);
      if (!saved) { showToast('❌ Erreur lors de la sauvegarde', 'error'); return; }
      App.currentSong = saved;

      await refreshSongsList();
      document.querySelector(`.song-card[data-id="${saved.id}"]`)?.classList.add('active');
      updateSlidePreview();
      showToast('✅ Chant enregistré', 'success');
      logEvent('Sauvegarde chant', { songId: saved.id, title: saved.title });
    }, 'Sauvegarde chant');
  });
}

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
        await dataService.deleteSong(id);
        await dataService.removeFavorite(`song_${id}`);

        if (cardToRemove) {
          cardToRemove.style.cssText = 'opacity:0;transform:translateX(12px);transition:all .2s';
          setTimeout(() => {
            cardToRemove.remove();
            const remaining = document.querySelectorAll('.song-card').length;
            const titleSpan = document.querySelector('#panel-songs .songs-list-title');
            if (titleSpan) titleSpan.textContent = `${ICONS.songs} Chants (${remaining})`;
            const col = document.getElementById('songs-editor-col');
            if (col) col.innerHTML = `<div class="songs-editor-empty"><span>🎶</span><p>Sélectionnez un chant</p></div>`;
            App.currentSong = null;
            showToast(`${ICONS.delete} Chant supprimé`, 'info');
            logEvent('Suppression chant', { songId: id, title: songTitle });
          }, 200);
        } else {
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

function _buildEditorHtml(song, text, total, currentAlign) {
  const a = (v) => currentAlign === v ? 'btn-primary' : 'btn-ghost';
  return `
    <div class="song-editor">
      <div class="song-editor-meta">
        <input type="text" id="song-title-inp"  class="song-meta-field"
               value="${esc(song.title  ?? '')}" placeholder="Titre"  aria-label="Titre" maxlength="80">
        <input type="text" id="song-author-inp" class="song-meta-field"
               value="${esc(song.author ?? '')}" placeholder="Auteur" aria-label="Auteur" maxlength="80">
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

function renderSongEditor(song) {
  App.currentSong       = song;
  App.currentStropheIdx = 0;

  const col = document.getElementById('songs-editor-col');
  if (!col) return;

  const text         = reconstructText(song.strophes ?? []);
  const total        = (song.strophes ?? []).length;
  const currentAlign = App.settings.songTextAlign || 'center';

  col.innerHTML = _buildEditorHtml(song, text, total, currentAlign);

  _bindAlignButtons();
  _bindLyricsTextarea();
  _bindStropheNav();
  _bindStropheCards();
  _bindProjectButton();
  _bindSaveButton();
  _bindDeleteButton();
}