/**
 * ============================================================
 *  panels/settingsPanel.js — Panneau Paramètres (orchestrateur + HTML builder)
 *  NTIC Bible Projector · US-R15 Sprint R4
 *  Dépendances globales :
 *    constants.js  → FONTS, SETTINGS_KEYS, SETTINGS_DEFAULTS
 *    store.js      → App (alias Store)
 *    utils/dom.js  → esc, showToast, safePostMessage
 *    db.js         → db
 *    app.js        → withWriteLock, logEvent, updatePipPreview, applyTheme
 *    panels/settingsBinders.js → _bindBibleImport, _bindSongSettings, _bindLTSettings,
 *                               _bindSlideSettings, _bindConfigIO
 * ============================================================
 */

// ─────────────────────────────────────────────────────────────
//  HTML — squelette du panneau (4 sections)
// ─────────────────────────────────────────────────────────────
function _buildSettingsHtml(s) {
  const fOpts = (sel) => FONTS.map((f) =>
    `<option value="${f}" ${f === sel ? 'selected' : ''}>${f}</option>`
  ).join('');

  const alignBtns = (prefix, current) => ['left', 'center', 'right'].map((v) =>
    `<button class="btn btn-sm ${current === v ? 'btn-primary' : 'btn-ghost'}"
             data-${prefix}-align="${v}">${v === 'left' ? '⇤ Gauche' : v === 'right' ? 'Droite ⇥' : '≡ Centre'}</button>`
  ).join('');

  return `
    <div class="panel panel-settings" id="panel-settings">

      <section class="settings-section">
        <h2 class="settings-section-title">📚 Import de Bible</h2>
        <p class="settings-hint">Format JSON : <code>{ "Livre": { "1": { "1": "texte…" } } }</code></p>
        <label class="field-label" for="bible-file-inp">Fichier JSON (.json)</label>
        <input type="file" id="bible-file-inp" accept=".json" class="field-file">
        <div id="bible-import-msg" aria-live="polite" style="margin-top:6px;font-size:0.85rem;"></div>
        <div class="bible-list" id="bible-list" style="margin-top:12px;"></div>
      </section>

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
            <div style="display:flex;gap:8px;margin-top:6px;">${alignBtns('align-settings', s.songTextAlign)}</div>
          </div>
        </div>
        <button class="btn btn-primary" id="btn-save-song-settings" style="margin-top:14px;">💾 Enregistrer Chants</button>
        <div id="song-settings-saved" aria-live="polite" style="margin-top:6px;font-size:0.85rem;"></div>
      </section>

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
      </section>

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
            <div style="display:flex;gap:8px;margin-top:6px;">${alignBtns('slide', s.slideTextAlign)}</div>
          </div>
          <div class="settings-row">
            <label class="field-label" for="slide-bg">Couleur de fond</label>
            <input type="color" id="slide-bg" class="field-color" value="${s.slideBg}">
          </div>
        </div>
        <button class="btn btn-primary" id="btn-save-slide-settings" style="margin-top:14px;">💾 Enregistrer Diapositives</button>
        <div id="slide-settings-saved" aria-live="polite" style="margin-top:6px;font-size:0.85rem;"></div>
      </section>

      <section class="settings-section">
        <h2 class="settings-section-title">⚙️ Configuration</h2>
        <div class="settings-grid" style="margin-bottom:16px;">
          <div class="settings-row">
            <label class="field-label">Durée des toasts (ms)</label>
            <input type="range" id="toast-duration-range" class="field-range" min="1000" max="5000" step="100" value="${s.toastDuration}">
            <span id="toast-duration-value" style="font-size:0.8rem; margin-top:4px; display:inline-block;">${s.toastDuration} ms</span>
          </div>
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;">
          <button class="btn btn-primary" id="btn-export-config">📤 Exporter la configuration</button>
          <label class="btn btn-ghost" style="cursor:pointer;">
            📥 Importer une configuration
            <input type="file" id="import-config-file" accept=".json" style="display:none;">
          </label>
          <button class="btn btn-ghost" id="btn-export-logs">📄 Exporter les logs système</button>
        </div>
        <div id="config-status" aria-live="polite" style="margin-top:8px;font-size:0.85rem;"></div>
      </section>

    </div>`;
}

// ─────────────────────────────────────────────────────────────
//  LISTE BIBLES (utilisée par biblePanel + settingsPanel)
// ─────────────────────────────────────────────────────────────
async function loadBibleList() {
  const names = await db.getAllBibleNames();
  const list  = document.getElementById('bible-list');
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
        loadBibleList();
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
//  PANNEAU PRINCIPAL — orchestrateur
// ─────────────────────────────────────────────────────────────
async function renderSettingsPanel(container) {
  // Rafraîchir les settings depuis la DB avant d'afficher
  const vals = await Promise.all(SETTINGS_KEYS.map((k) => db.getSetting(k, SETTINGS_DEFAULTS[k])));
  SETTINGS_KEYS.forEach((k, i) => { App.settings[k] = vals[i]; });

  container.innerHTML = _buildSettingsHtml(App.settings);

  _bindBibleImport();
  _bindSongSettings();
  _bindLTSettings();
  _bindSlideSettings();
  _bindConfigIO(container);
}