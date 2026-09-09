/**
 * ============================================================
 *  panels/settingsPanel.js — Panneau Paramètres (orchestrateur)
 *  NTIC Bible Projector · US-R15 Sprint R4
 *  Version autonome : toutes les fonctions sont définies à l'intérieur.
 * ============================================================
 */

// ─────────────────────────────────────────────────────────────
//  CONSTRUCTION HTML DES SOUS-SECTIONS
// ─────────────────────────────────────────────────────────────

function _buildSongSettingsHtml(s) {
  const fOpts = (sel) => FONTS.map((f) =>
    `<option value="${f}" ${f === sel ? 'selected' : ''}>${f}</option>`
  ).join('');

  const alignBtns = (current) => ['left', 'center', 'right'].map((v) =>
    `<button class="btn btn-sm ${current === v ? 'btn-primary' : 'btn-ghost'}"
             data-align-settings-align="${v}">${v === 'left' ? '⇤ Gauche' : v === 'right' ? 'Droite ⇥' : '≡ Centre'}</button>`
  ).join('');

  return `
    <section class="settings-section">
      <h2 class="settings-section-title">🎵 Paramètres Chants</h2>
      <div class="settings-grid">
        <div class="settings-row">
          <label class="field-label" for="song-bg-color">Couleur fond</label>
          <input type="color" id="song-bg-color" class="field-color" value="${s.songBgColor}">
        </div>
        <div class="settings-row">
          <label class="field-label" for="song-text-color">Couleur texte</label>
          <input type="color" id="song-text-color" class="field-color" value="${s.songTextColor}">
        </div>
        <div class="settings-row">
          <label class="field-label" for="song-font-family">Police</label>
          <select id="song-font-family" class="field-select">${fOpts(s.songFontFamily)}</select>
        </div>
        <div class="settings-row">
          <label class="field-label">Taille police : <strong id="song-font-size-val">${s.songFontSize}</strong>px</label>
          <input type="range" id="song-font-size" class="field-range" min="20" max="120" value="${s.songFontSize}">
        </div>
        <div class="settings-row">
          <label class="checkbox-row">
            <input type="checkbox" id="song-show-title" ${s.songShowTitle ? 'checked' : ''}> Afficher le titre
          </label>
        </div>
        <div class="settings-row">
          <label class="checkbox-row">
            <input type="checkbox" id="song-show-author" ${s.songShowAuthor ? 'checked' : ''}> Afficher l'auteur
          </label>
        </div>
        <div class="settings-row">
          <label class="checkbox-row">
            <input type="checkbox" id="song-uppercase" ${s.songUppercase ? 'checked' : ''}> Texte en majuscules
          </label>
        </div>
        <div class="settings-row">
          <label class="field-label">Alignement :</label>
          <div style="display:flex;gap:8px;margin-top:6px;">${alignBtns(s.songTextAlign)}</div>
        </div>
      </div>
      <button class="btn btn-primary" id="btn-save-song-settings" style="margin-top:14px;">💾 Enregistrer Chants</button>
      <div id="song-settings-saved" aria-live="polite" style="margin-top:6px;font-size:0.85rem;"></div>
    </section>`;
}

function _buildLTSettingsHtml(s) {
  const fOpts = (sel) => FONTS.map((f) =>
    `<option value="${f}" ${f === sel ? 'selected' : ''}>${f}</option>`
  ).join('');

  return `
    <section class="settings-section">
      <h2 class="settings-section-title">🎙 Lower Third</h2>
      <div class="settings-grid">
        <div class="settings-row">
          <label class="field-label" for="s-lt-type">Modèle</label>
          <select id="s-lt-type" class="field-select">
            <option value="ictheme" ${s.ltType === 'ictheme' ? 'selected' : ''}>ICC Graduation</option>
            <option value="tourpac" ${s.ltType === 'tourpac' ? 'selected' : ''}>Tour PAC</option>
          </select>
        </div>
        <div class="settings-row">
          <label class="field-label" for="s-lt-ref-col">Couleur référence</label>
          <input type="color" id="s-lt-ref-col" class="field-color" value="${s.ltRefColor}">
        </div>
        <div class="settings-row">
          <label class="field-label" for="s-lt-verse-col">Couleur verset</label>
          <input type="color" id="s-lt-verse-col" class="field-color" value="${s.ltVerseColor}">
        </div>
        <div class="settings-row">
          <label class="field-label" for="s-lt-font">Police</label>
          <select id="s-lt-font" class="field-select">${fOpts(s.ltFontFamily)}</select>
        </div>
        <div class="settings-row">
          <label class="field-label">Taille référence : <strong id="s-ref-val">${s.ltRefSize}</strong>px</label>
          <input type="range" id="s-lt-ref-size" class="field-range" min="10" max="80" value="${s.ltRefSize}">
        </div>
        <div class="settings-row">
          <label class="field-label">Taille verset : <strong id="s-verse-val">${s.ltVerseSize}</strong>px</label>
          <input type="range" id="s-lt-verse-size" class="field-range" min="10" max="80" value="${s.ltVerseSize}">
        </div>
        <div class="settings-row">
          <label class="field-label">Nom personne : <strong id="s-name-val">${s.personNameSize}</strong>px</label>
          <input type="range" id="s-lt-name-size" class="field-range" min="10" max="80" value="${s.personNameSize}">
        </div>
        <div class="settings-row">
          <label class="field-label">Titre personne : <strong id="s-title-val">${s.personTitleSize}</strong>px</label>
          <input type="range" id="s-lt-title-size" class="field-range" min="10" max="80" value="${s.personTitleSize}">
        </div>
        <div class="settings-row">
          <label class="field-label" for="s-lt-width">Largeur (px)</label>
          <input type="number" id="s-lt-width" class="field-input" value="${s.ltWidth}" min="100" max="3840">
        </div>
        <div class="settings-row">
          <label class="field-label" for="s-lt-height">Hauteur (px)</label>
          <input type="number" id="s-lt-height" class="field-input" value="${s.ltHeight}" min="50" max="600">
        </div>
      </div>
      <button class="btn btn-primary" id="btn-save-lt" style="margin-top:14px;">💾 Enregistrer LT</button>
      <div id="settings-saved" aria-live="polite" style="margin-top:6px;font-size:0.85rem;"></div>
    </section>`;
}

function _buildSlideSettingsHtml(s) {
  const fOpts = (sel) => FONTS.map((f) =>
    `<option value="${f}" ${f === sel ? 'selected' : ''}>${f}</option>`
  ).join('');

  const alignBtns = (current) => ['left', 'center', 'right'].map((v) =>
    `<button class="btn btn-sm ${current === v ? 'btn-primary' : 'btn-ghost'}"
             data-slide-align="${v}">${v === 'left' ? '⇤ Gauche' : v === 'right' ? 'Droite ⇥' : '≡ Centre'}</button>`
  ).join('');

  return `
    <section class="settings-section">
      <h2 class="settings-section-title">📺 Diapositives (mode plein écran)</h2>
      <div class="settings-grid">
        <div class="settings-row">
          <label class="field-label">Taille référence : <strong id="slide-ref-size-val">${s.slideRefSize}</strong>px</label>
          <input type="range" id="slide-ref-size" class="field-range" min="16" max="96" value="${s.slideRefSize}">
        </div>
        <div class="settings-row">
          <label class="field-label">Taille verset : <strong id="slide-verse-size-val">${s.slideVerseSize}</strong>px</label>
          <input type="range" id="slide-verse-size" class="field-range" min="24" max="120" value="${s.slideVerseSize}">
        </div>
        <div class="settings-row">
          <label class="field-label" for="slide-ref-color">Couleur référence</label>
          <input type="color" id="slide-ref-color" class="field-color" value="${s.slideRefColor}">
        </div>
        <div class="settings-row">
          <label class="field-label" for="slide-verse-color">Couleur verset</label>
          <input type="color" id="slide-verse-color" class="field-color" value="${s.slideVerseColor}">
        </div>
        <div class="settings-row">
          <label class="field-label" for="slide-font">Police</label>
          <select id="slide-font" class="field-select">${fOpts(s.slideFont)}</select>
        </div>
        <div class="settings-row">
          <label class="field-label">Alignement :</label>
          <div style="display:flex;gap:8px;margin-top:6px;">${alignBtns(s.slideTextAlign)}</div>
        </div>
        <div class="settings-row">
          <label class="field-label" for="slide-bg">Couleur de fond</label>
          <input type="color" id="slide-bg" class="field-color" value="${s.slideBg}">
        </div>
      </div>
      <button class="btn btn-primary" id="btn-save-slide-settings" style="margin-top:14px;">💾 Enregistrer Diapositives</button>
      <div id="slide-settings-saved" aria-live="polite" style="margin-top:6px;font-size:0.85rem;"></div>
    </section>`;
}

function _buildDualSettingsHtml(s) {
  const fOpts = (sel) => FONTS.map((f) =>
    `<option value="${f}" ${f === sel ? 'selected' : ''}>${f}</option>`
  ).join('');

  return `
    <section class="settings-section">
      <h2 class="settings-section-title">📊 Modes d'affichage enrichis</h2>
      <p class="settings-hint">Personnalisez l'apparence des blocs pour les modes <strong>bilingue</strong> et <strong>explicatif</strong> à l'écran de projection.</p>
      <div class="settings-grid">
        <div class="settings-row">
          <label class="field-label" for="primary-ref-color">Couleur référence (principal)</label>
          <input type="color" id="primary-ref-color" class="field-color" value="${s.primaryRefColor}">
        </div>
        <div class="settings-row">
          <label class="field-label" for="primary-text-color">Couleur texte (principal)</label>
          <input type="color" id="primary-text-color" class="field-color" value="${s.primaryTextColor}">
        </div>
        <div class="settings-row">
          <label class="field-label" for="primary-font-family">Police (principal)</label>
          <select id="primary-font-family" class="field-select">${fOpts(s.primaryFontFamily)}</select>
        </div>
        <div class="settings-row">
          <label class="field-label">Taille référence (principal) : <strong id="primary-ref-size-val">${s.primaryRefSize}</strong>px</label>
          <input type="range" id="primary-ref-size" class="field-range" min="16" max="96" value="${s.primaryRefSize}">
        </div>
        <div class="settings-row">
          <label class="field-label">Taille texte (principal) : <strong id="primary-text-size-val">${s.primaryTextSize}</strong>px</label>
          <input type="range" id="primary-text-size" class="field-range" min="24" max="120" value="${s.primaryTextSize}">
        </div>

        <div class="settings-row">
          <label class="field-label" for="secondary-ref-color">Couleur référence (secondaire)</label>
          <input type="color" id="secondary-ref-color" class="field-color" value="${s.secondaryRefColor}">
        </div>
        <div class="settings-row">
          <label class="field-label" for="secondary-text-color">Couleur texte (secondaire)</label>
          <input type="color" id="secondary-text-color" class="field-color" value="${s.secondaryTextColor}">
        </div>
        <div class="settings-row">
          <label class="field-label" for="secondary-font-family">Police (secondaire)</label>
          <select id="secondary-font-family" class="field-select">${fOpts(s.secondaryFontFamily)}</select>
        </div>
        <div class="settings-row">
          <label class="field-label">Taille référence (secondaire) : <strong id="secondary-ref-size-val">${s.secondaryRefSize}</strong>px</label>
          <input type="range" id="secondary-ref-size" class="field-range" min="16" max="96" value="${s.secondaryRefSize}">
        </div>
        <div class="settings-row">
          <label class="field-label">Taille texte (secondaire) : <strong id="secondary-text-size-val">${s.secondaryTextSize}</strong>px</label>
          <input type="range" id="secondary-text-size" class="field-range" min="24" max="120" value="${s.secondaryTextSize}">
        </div>
      </div>
      <button class="btn btn-primary" id="btn-save-dual-settings" style="margin-top:14px;">💾 Enregistrer</button>
      <div id="dual-settings-saved" aria-live="polite" style="margin-top:6px;font-size:0.85rem;"></div>
    </section>`;
}

// ─────────────────────────────────────────────────────────────
//  BINDERS POUR LES SOUS-SECTIONS
// ─────────────────────────────────────────────────────────────

function _bindSongSettings() {
  document.getElementById('song-font-size')?.addEventListener('input', function () {
    document.getElementById('song-font-size-val').textContent = this.value;
  });

  document.querySelectorAll('[data-align-settings-align]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const align = btn.dataset.alignSettingsAlign;
      if (align === App.settings.songTextAlign) return;
      App.settings.songTextAlign = align;
      await dataService.saveSetting('songTextAlign', align);
      document.querySelectorAll('[data-align-settings-align]').forEach((b) => {
        b.classList.toggle('btn-primary', b.dataset.alignSettingsAlign === align);
        b.classList.toggle('btn-ghost',   b.dataset.alignSettingsAlign !== align);
      });
      safePostMessage({
        type: 'song-settings',
        settings: { ...App.settings,
          bgColor: App.settings.songBgColor, textColor: App.settings.songTextColor,
          fontSize: App.settings.songFontSize, fontFamily: App.settings.songFontFamily,
          showTitle: App.settings.songShowTitle, showAuthor: App.settings.songShowAuthor,
          uppercase: App.settings.songUppercase, textAlign: align,
        },
      });
      showToast(`Alignement : ${align === 'left' ? 'gauche' : align === 'right' ? 'droite' : 'centré'}`, 'success');
    });
  });

  document.getElementById('btn-save-song-settings')?.addEventListener('click', async () => {
    await withWriteLock(async () => {
      let size = parseInt(document.getElementById('song-font-size')?.value, 10);
      if (isNaN(size)) size = 70;
      size = Math.min(120, Math.max(20, size));

      const active = document.querySelector('[data-align-settings-align].btn-primary');
      const vals = {
        songBgColor:    document.getElementById('song-bg-color')?.value    || '#000000',
        songTextColor:  document.getElementById('song-text-color')?.value  || '#ffffff',
        songFontSize:   size,
        songFontFamily: document.getElementById('song-font-family')?.value || 'Arial Black',
        songShowTitle:  document.getElementById('song-show-title')?.checked  === true,
        songShowAuthor: document.getElementById('song-show-author')?.checked === true,
        songUppercase:  document.getElementById('song-uppercase')?.checked   === true,
        songTextAlign:  active?.dataset.alignSettingsAlign ?? 'center',
      };

      await Promise.all(Object.entries(vals).map(([k, v]) => dataService.saveSetting(k, v)));
      App.merge(vals);

      safePostMessage({
        type: 'song-settings',
        settings: {
          bgColor: vals.songBgColor, textColor: vals.songTextColor,
          fontSize: vals.songFontSize, fontFamily: vals.songFontFamily,
          showTitle: vals.songShowTitle, showAuthor: vals.songShowAuthor,
          uppercase: vals.songUppercase, textAlign: vals.songTextAlign,
        },
      });

      const saved = document.getElementById('song-settings-saved');
      if (saved) {
        saved.innerHTML = '<span style="color:var(--success)">✅ Paramètres chants enregistrés</span>';
        setTimeout(() => { saved.innerHTML = ''; }, 2000);
      }
      showToast('💾 Paramètres chants enregistrés', 'success');
      logEvent('Sauvegarde paramètres chants', vals);
    }, 'Sauvegarde paramètres chants');
  });
}

function _bindLTSettings() {
  [
    ['s-lt-ref-size',   's-ref-val'],
    ['s-lt-verse-size', 's-verse-val'],
    ['s-lt-name-size',  's-name-val'],
    ['s-lt-title-size', 's-title-val'],
  ].forEach(([rangeId, valId]) => {
    document.getElementById(rangeId)?.addEventListener('input', function () {
      document.getElementById(valId).textContent = this.value;
    });
  });

  document.getElementById('btn-save-lt')?.addEventListener('click', async () => {
    await withWriteLock(async () => {
      const vals = {
        ltType:          document.getElementById('s-lt-type')?.value,
        ltRefColor:      document.getElementById('s-lt-ref-col')?.value,
        ltVerseColor:    document.getElementById('s-lt-verse-col')?.value,
        ltFontFamily:    document.getElementById('s-lt-font')?.value,
        ltRefSize:       parseInt(document.getElementById('s-lt-ref-size')?.value, 10)    || 30,
        ltVerseSize:     parseInt(document.getElementById('s-lt-verse-size')?.value, 10)  || 38,
        personNameSize:  parseInt(document.getElementById('s-lt-name-size')?.value, 10)   || 30,
        personTitleSize: parseInt(document.getElementById('s-lt-title-size')?.value, 10)  || 24,
        ltWidth:         parseInt(document.getElementById('s-lt-width')?.value, 10)       || 1240,
        ltHeight:        parseInt(document.getElementById('s-lt-height')?.value, 10)      || 248,
      };

      await Promise.all(Object.entries(vals).map(([k, v]) => dataService.saveSetting(k, v)));
      App.merge(vals);

      if (typeof window.applyTheme === 'function') {
        window.applyTheme(vals.ltType);
      }

      const msg = document.getElementById('settings-saved');
      if (msg) {
        msg.innerHTML = '<span style="color:var(--success)">✅ Paramètres LT enregistrés</span>';
        setTimeout(() => { msg.innerHTML = ''; }, 2000);
      }
      showToast('💾 Paramètres Lower Third enregistrés', 'success');
      window.dispatchEvent(new CustomEvent('lt-settings-changed'));
      logEvent('Sauvegarde paramètres Lower Third', vals);
    }, 'Sauvegarde paramètres LT');
  });
}

function _bindSlideSettings() {
  [
    ['slide-ref-size',   'slide-ref-size-val'],
    ['slide-verse-size', 'slide-verse-size-val'],
  ].forEach(([rangeId, valId]) => {
    document.getElementById(rangeId)?.addEventListener('input', function () {
      document.getElementById(valId).textContent = this.value;
    });
  });

  document.querySelectorAll('[data-slide-align]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const align = btn.dataset.slideAlign;
      if (align === App.settings.slideTextAlign) return;
      App.settings.slideTextAlign = align;
      await dataService.saveSetting('slideTextAlign', align);
      document.querySelectorAll('[data-slide-align]').forEach((b) => {
        b.classList.toggle('btn-primary', b.dataset.slideAlign === align);
        b.classList.toggle('btn-ghost',   b.dataset.slideAlign !== align);
      });
      showToast(`Alignement diapo : ${align === 'left' ? 'gauche' : align === 'right' ? 'droite' : 'centré'}`, 'success');
    });
  });

  document.getElementById('btn-save-slide-settings')?.addEventListener('click', async () => {
    await withWriteLock(async () => {
      const active = document.querySelector('[data-slide-align].btn-primary');
      const vals = {
        slideRefSize:   parseInt(document.getElementById('slide-ref-size')?.value, 10)   || 32,
        slideVerseSize: parseInt(document.getElementById('slide-verse-size')?.value, 10) || 48,
        slideRefColor:  document.getElementById('slide-ref-color')?.value   || '#f0c060',
        slideVerseColor:document.getElementById('slide-verse-color')?.value || '#ffffff',
        slideFont:      document.getElementById('slide-font')?.value        || 'Arial',
        slideTextAlign: active?.dataset.slideAlign ?? 'center',
        slideBg:        document.getElementById('slide-bg')?.value          || '#000000',
      };

      await Promise.all(Object.entries(vals).map(([k, v]) => dataService.saveSetting(k, v)));
      App.merge(vals);

      safePostMessage({
        type: 'slide-settings',
        settings: {
          refSize:   vals.slideRefSize,
          verseSize: vals.slideVerseSize,
          refColor:  vals.slideRefColor,
          verseColor:vals.slideVerseColor,
          font:      vals.slideFont,
          textAlign: vals.slideTextAlign,
          bg:        vals.slideBg,
        },
      });

      const saved = document.getElementById('slide-settings-saved');
      if (saved) {
        saved.innerHTML = '<span style="color:var(--success)">✅ Paramètres diapositives enregistrés</span>';
        setTimeout(() => { saved.innerHTML = ''; }, 2000);
      }
      showToast('💾 Paramètres diapositives enregistrés', 'success');
      logEvent('Sauvegarde paramètres diapositives', vals);
    }, 'Sauvegarde paramètres diapositives');
  });
}

function _bindDualModeSettings() {
  [
    ['primary-ref-size',    'primary-ref-size-val'],
    ['primary-text-size',   'primary-text-size-val'],
    ['secondary-ref-size',  'secondary-ref-size-val'],
    ['secondary-text-size', 'secondary-text-size-val'],
  ].forEach(([rangeId, valId]) => {
    document.getElementById(rangeId)?.addEventListener('input', function () {
      document.getElementById(valId).textContent = this.value;
    });
  });

  document.getElementById('btn-save-dual-settings')?.addEventListener('click', async () => {
    await withWriteLock(async () => {
      const vals = {
        primaryRefColor:     document.getElementById('primary-ref-color')?.value     || '#f0c060',
        primaryTextColor:    document.getElementById('primary-text-color')?.value    || '#f5f0e8',
        primaryFontFamily:   document.getElementById('primary-font-family')?.value   || 'Arial',
        primaryRefSize:      parseInt(document.getElementById('primary-ref-size')?.value, 10)   || 32,
        primaryTextSize:     parseInt(document.getElementById('primary-text-size')?.value, 10)  || 48,
        secondaryRefColor:   document.getElementById('secondary-ref-color')?.value   || '#00cc66',
        secondaryTextColor:  document.getElementById('secondary-text-color')?.value  || '#d0d8ec',
        secondaryFontFamily: document.getElementById('secondary-font-family')?.value || 'Arial',
        secondaryRefSize:    parseInt(document.getElementById('secondary-ref-size')?.value, 10)  || 32,
        secondaryTextSize:   parseInt(document.getElementById('secondary-text-size')?.value, 10) || 48,
      };

      await Promise.all(Object.entries(vals).map(([k, v]) => dataService.saveSetting(k, v)));
      App.merge(vals);

      const saved = document.getElementById('dual-settings-saved');
      if (saved) {
        saved.innerHTML = '<span style="color:var(--success)">✅ Paramètres enregistrés</span>';
        setTimeout(() => { saved.innerHTML = ''; }, 2000);
      }
      showToast('💾 Paramètres des modes enrichis enregistrés', 'success');

      if ((App.activeDisplayMode === 'bilingual' || App.activeDisplayMode === 'explanatory')
          && App.lastBibleRef && App.lastBibleText && typeof projectVerse === 'function') {
        projectVerse(App.lastBibleText, App.lastBibleRef);
      }

      logEvent('Sauvegarde paramètres modes enrichis', vals);
    }, 'Sauvegarde paramètres modes enrichis');
  });
}

// ─────────────────────────────────────────────────────────────
//  HTML PRINCIPAL
// ─────────────────────────────────────────────────────────────
function _buildSettingsHtml(s) {
  return `
    <div class="panel panel-settings" id="panel-settings">

      <!-- Barre d'outils avec boutons d'ouverture des tiroirs -->
      <div style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:16px;">
        <button class="btn btn-primary" id="btn-open-bibles-drawer">
          📚 Gérer les Bibles
        </button>
        <button class="btn btn-ghost" id="btn-open-network-drawer">
          🌐 Réseau &amp; Sauvegarde
        </button>
      </div>

      <!-- Chants -->
      ${_buildSongSettingsHtml(s)}

      <!-- Lower Third -->
      ${_buildLTSettingsHtml(s)}

      <!-- Diapositives -->
      ${_buildSlideSettingsHtml(s)}

      <!-- Modes enrichis -->
      ${_buildDualSettingsHtml(s)}

    </div>`;
}

// ─────────────────────────────────────────────────────────────
//  LISTE BIBLES (utilisée par le tiroir)
// ─────────────────────────────────────────────────────────────
async function loadBibleList(containerId = 'drawer-bible-list') {
  const names = await db.getAllBibleNames();
  const list = document.getElementById(containerId);
  if (!list) return;

  if (names.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">Aucune Bible importée.</p>';
    return;
  }

  list.innerHTML = names.map((n) => `
    <div class="bible-list-item">
      <span>📖 ${esc(n)}</span>
      <button class="btn btn-sm btn-ghost" data-name="${esc(n)}"
              style="color:var(--danger)" aria-label="Supprimer ${esc(n)}">🗑</button>
    </div>`).join('');

  list.querySelectorAll('button[data-name]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const name = btn.dataset.name;
      if (btn.dataset.confirm) {
        await db.deleteBible(name);
        showToast(`🗑 Bible « ${esc(name)} » supprimée`, 'info');
        loadBibleList(containerId);
      } else {
        btn.dataset.confirm = '1';
        btn.textContent = '⚠ Confirmer';
        Object.assign(btn.style, { background: 'var(--danger)', color: '#fff' });
        setTimeout(() => {
          delete btn.dataset.confirm;
          btn.textContent = '🗑';
          btn.style.background = '';
          btn.style.color = 'var(--danger)';
        }, 3000);
      }
    });
  });
}

// ─────────────────────────────────────────────────────────────
//  FONCTIONS UTILITAIRES POUR LE RELAIS (copiées depuis app.js)
// ─────────────────────────────────────────────────────────────
function _relayUpdateBadge(enabled, el) {
  if (!el) return;
  el.textContent  = enabled ? '🟢 Activé'    : '🔴 Désactivé';
  el.style.color  = enabled ? 'var(--success)' : 'var(--danger)';
}

function _relayFetchIP(ipId, urlId) {
  const ipEl = document.getElementById(ipId || 'drawer-relay-server-ip');
  const urlEl = document.getElementById(urlId || 'drawer-relay-obs-url');
  if (!ipEl) return;

  const ip = location.hostname;
  ipEl.textContent  = ip;
  if (urlEl) urlEl.textContent = `http://${ip}:8080/projection-bible.html`;

  fetch('/status').then(r => r.json()).then(data => {
    if (data.ips && data.ips.length) {
      const realIp = data.ips[0];
      ipEl.textContent  = realIp;
      if (urlEl) urlEl.textContent = `http://${realIp}:8080/projection-bible.html`;
    }
  }).catch(() => { /* serveur absent */ });
}

// ─────────────────────────────────────────────────────────────
//  MODALE DE CONFIRMATION (copiée depuis settingsImport.js)
// ─────────────────────────────────────────────────────────────
function _confirmModal(message, okLabel = "OK", cancelLabel = "Annuler") {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box" style="max-width:400px;">
        <div class="modal-header">
          <h2>Confirmation</h2>
          <button class="modal-close" aria-label="Fermer">✕</button>
        </div>
        <div style="margin: 16px 0;">${esc(message)}</div>
        <div class="modal-footer">
          <button class="btn btn-primary modal-ok">${okLabel}</button>
          <button class="btn btn-ghost modal-cancel">${cancelLabel}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.classList.add('modal--visible');

    const close = () => overlay.remove();
    overlay.querySelector('.modal-ok')?.addEventListener('click', () => { close(); resolve(true); });
    overlay.querySelector('.modal-cancel')?.addEventListener('click', () => { close(); resolve(false); });
    overlay.querySelector('.modal-close')?.addEventListener('click', () => { close(); resolve(false); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) { close(); resolve(false); } });
  });
}

// ─────────────────────────────────────────────────────────────
//  IMPORT COMPLET (copié depuis settingsConfigIO.js)
// ─────────────────────────────────────────────────────────────
async function importAllData(json, mode) {
  if (!json || typeof json !== 'object') {
    throw new Error('Fichier invalide : l\'objet racine doit être un objet JSON');
  }
  if (!json.version) {
    throw new Error('Version non spécifiée dans le fichier');
  }
  const stores = ['bibles', 'songs', 'persons', 'favorites', 'settings', 'timers'];
  for (const store of stores) {
    if (json[store] !== undefined && !Array.isArray(json[store]) && typeof json[store] !== 'object') {
      throw new Error(`Store "${store}" doit être un objet ou un tableau`);
    }
  }

  if (mode === 'replace') {
    await db.clearBibles();
    await db.clearSongs();
    await db.clearPersons();
    await db.clearFavorites();
    await db.clearSettings();
    await db.clearAllTimers();
  }

  if (json.bibles && typeof json.bibles === 'object') {
    for (const [name, data] of Object.entries(json.bibles)) {
      if (mode === 'merge') {
        const existing = await db.getBible(name);
        if (existing) continue;
      }
      await db.saveBible(name, data);
    }
  }

  if (Array.isArray(json.songs)) {
    for (const song of json.songs) {
      if (!song.id) {
        song.id = Date.now() + Math.random();
      }
      if (mode === 'merge') {
        const existing = await db.getSong(song.id);
        if (existing) continue;
      }
      await db.saveSong(song);
    }
  }

  if (Array.isArray(json.persons)) {
    for (const person of json.persons) {
      if (!person.id) {
        person.id = 'lt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      }
      if (mode === 'merge') {
        const existing = await db.getPerson(person.id);
        if (existing) continue;
      }
      await db.savePerson(person);
    }
  }

  if (Array.isArray(json.favorites)) {
    for (const fav of json.favorites) {
      if (mode === 'merge') {
        const existing = await db.isFavorite(fav.ref);
        if (existing) continue;
      }
      await db.addFavorite({
        type: fav.type || 'verse',
        ref: fav.ref,
        label: fav.label || '',
        title: fav.title || '',
        content: fav.content || '',
        createdAt: fav.createdAt || Date.now(),
      });
    }
  }

  if (json.settings && typeof json.settings === 'object') {
    for (const [key, value] of Object.entries(json.settings)) {
      if (mode === 'merge') {
        const existing = await db.getSetting(key);
        if (existing !== null && existing !== undefined) continue;
      }
      await db.saveSetting(key, value);
    }
  }

  if (Array.isArray(json.timers)) {
    for (const timer of json.timers) {
      if (!timer.id) {
        timer.id = 'chrono_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      }
      if (mode === 'merge') {
        const existing = await db.getTimer(timer.id);
        if (existing) continue;
      }
      await db.saveTimer(timer);
    }
  }

  const currentBible = await db.getSetting('currentBible');
  if (currentBible) {
    const data = await db.getBible(currentBible);
    if (data) {
      App.bibleData = data;
    }
  }

  showToast(`✅ Import ${mode === 'replace' ? 'remplacement' : 'fusion'} terminé`, 'success');
  logEvent('Import complet', { mode, stores: Object.keys(json).filter(k => k !== 'version' && k !== 'exportedAt') });
}

// ─────────────────────────────────────────────────────────────
//  INITIALISATION DES TIROIRS
// ─────────────────────────────────────────────────────────────
function initDrawerBibles() {
  // Import fichier unique
  const fileInput = document.getElementById('drawer-bible-file-inp');
  const msg = document.getElementById('drawer-bible-import-msg');
  if (fileInput && msg) {
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      msg.innerHTML = `
        <progress id="drawer-bible-import-progress" max="100" value="0"
                  style="width:100%;height:6px;accent-color:var(--primary);"></progress>
        <span style="font-size:0.8rem;"> Lecture du fichier…</span>`;
      const progress = () => document.getElementById('drawer-bible-import-progress');
      try {
        const text = await file.text();
        progress()?.setAttribute('value', '25');
        const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
        let data;
        try {
          data = JSON.parse(text, (key, val) => {
            if (FORBIDDEN_KEYS.has(key)) return undefined;
            return val;
          });
        } catch (parseErr) {
          throw new Error('JSON invalide : ' + parseErr.message);
        }
        progress()?.setAttribute('value', '50');
        if (typeof data !== 'object' || Array.isArray(data) || data === null)
          throw new Error('Format invalide : l\'objet racine doit être un objet JSON');
        const topKeys = Object.keys(data);
        if (topKeys.length === 0)
          throw new Error('Fichier vide : aucun livre détecté');
        let totalChapters = 0, totalVerses = 0;
        for (const [book, chapters] of Object.entries(data)) {
          if (typeof chapters !== 'object' || Array.isArray(chapters) || chapters === null)
            throw new Error(`⚠ Structure invalide : "${book}" n'est pas un objet (niv. 2 attendu un objet, trouvé ${typeof chapters})`);
          for (const [chapter, verses] of Object.entries(chapters)) {
            if (typeof verses !== 'object' || Array.isArray(verses) || verses === null)
              throw new Error(`⚠ Structure invalide : livre "${book}", chapitre ${chapter} : niv. 3 attendu un objet, trouvé ${typeof verses}`);
            totalChapters++;
            for (const [verse, text] of Object.entries(verses)) {
              if (typeof text !== 'string')
                throw new Error(`⚠ Structure invalide : livre "${book}", chapitre ${chapter}, verset ${verse} : attendu une chaîne, trouvé ${typeof text}`);
              totalVerses++;
            }
          }
        }
        progress()?.setAttribute('value', '75');
        const resume = `📊 Résumé : ${topKeys.length} livre(s), ${totalChapters} chapitre(s), ${totalVerses} verset(s). Importer ?`;
        const confirmed = await _confirmModal(resume, "Importer", "Annuler");
        if (!confirmed) {
          msg.innerHTML = `<span style="color:var(--warning)">⏸ Import annulé</span>`;
          return;
        }
        const name = file.name.replace(/\.json$/i, '');
        await db.saveBible(name, data);
        progress()?.setAttribute('value', '100');
        logEvent('Import Bible (tiroir)', { name, books: topKeys.length, chapters: totalChapters, verses: totalVerses });
        msg.innerHTML = `<span style="color:var(--success)">✅ « ${esc(name)} » importée (${topKeys.length} livres, ${totalVerses} versets)</span>`;
        showToast(`📖 Bible « ${esc(name)} » importée (${topKeys.length} livres)`, 'success', 4000);
        loadBibleList('drawer-bible-list');
      } catch (err) {
        db.log('error', 'Échec import Bible (tiroir)', { message: err.message, fileName: file.name });
        msg.innerHTML = `<span style="color:var(--danger)">❌ ${esc(err.message)}</span>`;
        showToast('❌ Import échoué : ' + err.message, 'error', 6000);
      } finally {
        fileInput.value = '';
      }
    });
  }

  // Import dossier
  const folderInput = document.getElementById('drawer-bible-folder-inp');
  const folderMsg = document.getElementById('drawer-bible-folder-msg');
  const folderProgress = document.getElementById('drawer-bible-folder-progress');
  if (folderInput && folderMsg && folderProgress) {
    folderInput.addEventListener('change', async (e) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      const jsonFiles = [];
      for (const file of files) {
        if (file.name.endsWith('.json')) jsonFiles.push(file);
      }
      if (jsonFiles.length === 0) {
        folderMsg.innerHTML = `<span style="color:var(--warning)">⚠ Aucun fichier .json trouvé dans le dossier.</span>`;
        folderInput.value = '';
        return;
      }
      folderInput.disabled = true;
      folderProgress.style.display = 'block';
      folderProgress.max = jsonFiles.length;
      folderProgress.value = 0;
      let imported = 0, ignored = 0, errors = [];
      for (let i = 0; i < jsonFiles.length; i++) {
        const file = jsonFiles[i];
        try {
          const text = await file.text();
          const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
          let data;
          try {
            data = JSON.parse(text, (key, val) => {
              if (FORBIDDEN_KEYS.has(key)) return undefined;
              return val;
            });
          } catch (parseErr) {
            throw new Error(`JSON invalide : ${parseErr.message}`);
          }
          if (typeof data !== 'object' || Array.isArray(data) || data === null)
            throw new Error('Format invalide : l\'objet racine doit être un objet JSON');
          const topKeys = Object.keys(data);
          if (topKeys.length === 0)
            throw new Error('Fichier vide : aucun livre détecté');
          for (const [book, chapters] of Object.entries(data)) {
            if (typeof chapters !== 'object' || Array.isArray(chapters) || chapters === null)
              throw new Error(`"${book}" n'est pas un objet (niv. 2 attendu un objet)`);
            for (const [chapter, verses] of Object.entries(chapters)) {
              if (typeof verses !== 'object' || Array.isArray(verses) || verses === null)
                throw new Error(`"${book}" ${chapter} : niv. 3 attendu un objet`);
              for (const [verse, text] of Object.entries(verses)) {
                if (typeof text !== 'string')
                  throw new Error(`"${book}" ${chapter}:${verse} : attendu une chaîne, trouvé ${typeof text}`);
              }
            }
          }
          const name = file.name.replace(/\.json$/i, '');
          await db.saveBible(name, data);
          imported++;
          logEvent('Import Bible (dossier, tiroir)', { name, books: topKeys.length });
        } catch (err) {
          ignored++;
          errors.push(`${file.name} : ${err.message}`);
          db.log('error', 'Échec import Bible (dossier, tiroir)', { fileName: file.name, error: err.message });
        }
        folderProgress.value = i + 1;
      }
      let finalMsg = `✅ ${imported} Bible(s) importée(s)`;
      if (ignored > 0) {
        finalMsg += `, ${ignored} ignorée(s) (format invalide)`;
        if (errors.length <= 5) {
          finalMsg += `<br><span style="font-size:0.75rem;color:var(--text-muted);">${errors.join('<br>')}</span>`;
        } else {
          finalMsg += `<br><span style="font-size:0.75rem;color:var(--text-muted);">${errors.length} erreurs (voir console)</span>`;
          console.warn('Erreurs d\'import de Bibles :', errors);
        }
      }
      folderMsg.innerHTML = finalMsg;
      showToast(`📚 ${imported} Bible(s) importée(s)${ignored > 0 ? `, ${ignored} ignorée(s)` : ''}`, imported > 0 ? 'success' : 'warning');
      folderInput.disabled = false;
      folderProgress.style.display = 'none';
      folderProgress.value = 0;
      folderInput.value = '';
      loadBibleList('drawer-bible-list');
    });
  }

  // Synchronisation depuis le serveur
  const syncBtn = document.getElementById('drawer-btn-sync-bibles-from-server');
  const progressContainer = document.getElementById('drawer-bible-sync-progress-container');
  const progressBar = document.getElementById('drawer-bible-sync-progress');
  const statusDiv = document.getElementById('drawer-bible-sync-status');
  const resultDiv = document.getElementById('drawer-bible-sync-result');
  if (syncBtn) {
    syncBtn.addEventListener('click', async () => {
      if (!App.settings.serverMode) {
        showToast('⚠️ Mode serveur non actif. Vérifiez la connexion au serveur.', 'warning', 3000);
        return;
      }
      const healthy = await dataService.checkServerHealth(true);
      if (!healthy) {
        showToast('⚠️ Serveur indisponible. Vérifiez la connexion.', 'error', 3000);
        return;
      }
      progressContainer.style.display = 'block';
      progressBar.value = 0;
      progressBar.max = 100;
      statusDiv.textContent = 'Récupération de la liste des Bibles...';
      resultDiv.innerHTML = '';
      syncBtn.disabled = true;
      try {
        const versions = await dataService.getBibleVersions();
        if (!versions || versions.length === 0) {
          statusDiv.textContent = 'Aucune Bible disponible sur le serveur.';
          progressContainer.style.display = 'none';
          syncBtn.disabled = false;
          return;
        }
        const total = versions.length;
        statusDiv.textContent = `Synchronisation de ${total} Bible(s)...`;
        progressBar.max = total;
        let imported = 0;
        for (let i = 0; i < total; i++) {
          const name = versions[i];
          statusDiv.textContent = `Téléchargement de "${name}" (${i+1}/${total})...`;
          progressBar.value = i + 1;
          try {
            const data = await dataService.getBible(name);
            if (data && typeof data === 'object' && Object.keys(data).length > 0) {
              await db.saveBible(name, data);
              imported++;
            }
          } catch (err) {
            console.warn(`[BibleSync] Erreur pour ${name}:`, err);
          }
          progressBar.value = i + 1;
        }
        statusDiv.textContent = `Synchronisation terminée. ${imported}/${total} Bible(s) importée(s).`;
        resultDiv.innerHTML = `<span style="color:var(--success);">✅ ${imported} Bible(s) synchronisée(s) avec succès.</span>`;
        if (imported < total) {
          resultDiv.innerHTML += `<span style="color:var(--warning);"> ⚠️ ${total - imported} ignorée(s) (données invalides).</span>`;
        }
        loadBibleList('drawer-bible-list');
        showToast(`📚 ${imported} Bible(s) synchronisée(s)`, 'success', 3000);
      } catch (err) {
        statusDiv.textContent = `Erreur : ${err.message}`;
        resultDiv.innerHTML = `<span style="color:var(--danger);">❌ ${err.message}</span>`;
        showToast('❌ Échec de la synchronisation des Bibles', 'error', 4000);
      } finally {
        syncBtn.disabled = false;
        setTimeout(() => {
          progressContainer.style.display = 'none';
        }, 5000);
      }
    });
  }

  // Charger la liste initiale
  loadBibleList('drawer-bible-list');
}

function initDrawerNetwork() {
  // Mode réseau (statut lecture seule) — déjà mis à jour via refreshDrawerNetworkStatus
  // Relais réseau
  const toggle = document.getElementById('drawer-relay-toggle');
  const badge = document.getElementById('drawer-relay-status-badge');
  if (toggle) {
    toggle.checked = App.settings.relayEnabled !== false;
    _relayUpdateBadge(toggle.checked, badge);
    _relayFetchIP('drawer-relay-server-ip', 'drawer-relay-obs-url');
    toggle.addEventListener('change', async () => {
      const enabled = toggle.checked;
      App.settings.relayEnabled = enabled;
      await dataService.saveSetting('relayEnabled', enabled);
      _relayUpdateBadge(enabled, badge);
      window.dispatchEvent(new CustomEvent('relay-toggle-changed', { detail: { enabled } }));
      showToast(enabled ? '🟢 Relais réseau activé' : '🔴 Relais réseau désactivé', 'info', 2200);
    });
  }

  // Export/Import complet
  const exportBtn = document.getElementById('drawer-btn-export-all');
  const importBtn = document.getElementById('drawer-btn-import-all');
  const importFileInput = document.getElementById('drawer-import-all-file');
  const exportLogsBtn = document.getElementById('drawer-btn-export-logs');
  const configStatus = document.getElementById('drawer-config-status');

  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      try {
        const bibleNames = await db.getAllBibleNames();
        const bibles = {};
        for (const name of bibleNames) {
          bibles[name] = await db.getBible(name);
        }
        const songs = await db.getAllSongs();
        const persons = await db.getAllPersons();
        const favorites = await db.getAllFavorites();
        const settings = {};
        for (const key of SETTINGS_KEYS) {
          settings[key] = await db.getSetting(key, SETTINGS_DEFAULTS[key]);
        }
        const timers = await db.getAllTimers();
        const payload = {
          version: '1.0',
          exportedAt: new Date().toISOString(),
          bibles, songs, persons, favorites, settings, timers
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const dateStr = new Date().toISOString().slice(0, 10);
        a.download = `ntic-export-${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('📤 Export complet effectué', 'success');
        logEvent('Export complet (tiroir)', { size: blob.size });
      } catch (err) {
        console.error('Export error:', err);
        showToast('❌ Échec de l\'export', 'error');
        db.log('error', 'Export complet échoué', { message: err.message });
      }
    });
  }

  if (importBtn && importFileInput) {
    importBtn.addEventListener('click', () => {
      importFileInput.click();
    });
    importFileInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        const mode = await _confirmModal(json);
        if (mode) {
          await withWriteLock(async () => {
            await importAllData(json, mode);
            const newLtType = await db.getSetting('ltType', SETTINGS_DEFAULTS.ltType);
            if (typeof window.applyTheme === 'function') {
              window.applyTheme(newLtType);
            }
            if (configStatus) {
              configStatus.innerHTML = `<span style="color:var(--success)">✅ Import ${mode === 'replace' ? 'remplacement' : 'fusion'} terminé</span>`;
              setTimeout(() => { configStatus.innerHTML = ''; }, 5000);
            }
            loadBibleList('drawer-bible-list');
          }, 'Import complet');
        }
      } catch (err) {
        showToast('❌ Erreur import : ' + err.message, 'error');
        db.log('error', 'Import complet échoué', { message: err.message });
      } finally {
        importFileInput.value = '';
      }
    });
  }

  if (exportLogsBtn) {
    exportLogsBtn.addEventListener('click', async () => {
      const logs = await db.getAllLogs();
      const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url });
      a.download = `ntic-logs-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('📄 Logs exportés', 'success');
    });
  }
}

// ─────────────────────────────────────────────────────────────
//  PANNEAU PRINCIPAL — orchestrateur
// ─────────────────────────────────────────────────────────────
async function renderSettingsPanel(container) {
  let settings = {};
  try {
    settings = await dataService.getAllSettings();
    SETTINGS_KEYS.forEach(key => {
      if (settings[key] === undefined) {
        settings[key] = SETTINGS_DEFAULTS[key];
      }
    });
  } catch (err) {
    const vals = await Promise.all(SETTINGS_KEYS.map((k) => db.getSetting(k, SETTINGS_DEFAULTS[k])));
    SETTINGS_KEYS.forEach((k, i) => { settings[k] = vals[i]; });
  }

  Object.assign(App.settings, settings);

  container.innerHTML = _buildSettingsHtml(App.settings);

  // Initialiser les binders
  _bindSongSettings();
  _bindLTSettings();
  _bindSlideSettings();
  _bindDualModeSettings();

  // Initialiser les fonctionnalités des tiroirs
  initDrawerBibles();
  initDrawerNetwork();

  // Écouteurs pour les boutons d'ouverture des tiroirs
  document.getElementById('btn-open-bibles-drawer')?.addEventListener('click', () => openDrawer('drawer-bibles'));
  document.getElementById('btn-open-network-drawer')?.addEventListener('click', () => openDrawer('drawer-network'));
}

// Exposer loadBibleList globalement pour les autres modules
window.loadBibleList = loadBibleList;