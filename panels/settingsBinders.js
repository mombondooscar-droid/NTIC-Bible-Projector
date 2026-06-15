/**
 * panels/settingsBinders.js — Handlers événements panneau Paramètres
 * NTIC Bible Projector · US-R15 Sprint R4
 * Dépendances globales : db, App, esc, showToast, safePostMessage,
 *   withWriteLock, logEvent, applyTheme, updatePipPreview (app.js / utils/),
 *   FONTS, SETTINGS_KEYS, SETTINGS_DEFAULTS (constants.js)
 * Scope global — chargé AVANT panels/settingsPanel.js dans index.html
 */

// ─────────────────────────────────────────────────────────────
//  BINDERS DES SOUS-SECTIONS
// ─────────────────────────────────────────────────────────────

/** Section Bible : import + liste + suppression (avec validation stricte US-37) */
function _bindBibleImport() {
  const fileInput = document.getElementById('bible-file-inp');
  const msg       = document.getElementById('bible-import-msg');

  fileInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    msg.innerHTML = `
      <progress id="bible-import-progress" max="100" value="0"
                style="width:100%;height:6px;accent-color:var(--primary);"></progress>
      <span style="font-size:0.8rem;"> Lecture du fichier…</span>`;
    const progress = () => document.getElementById('bible-import-progress');

    try {
      // 1. Lecture
      const text = await file.text();
      progress()?.setAttribute('value', '25');

      // 2. Parse JSON avec reviver sécurisé (problème #12 : __proto__, constructor)
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

      // 3. Validation stricte de la structure (3 niveaux)
      if (typeof data !== 'object' || Array.isArray(data) || data === null)
        throw new Error('Format invalide : l\'objet racine doit être un objet JSON');

      const topKeys = Object.keys(data);
      if (topKeys.length === 0)
        throw new Error('Fichier vide : aucun livre détecté');

      let totalChapters = 0;
      let totalVerses = 0;

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

      // 4. Résumé et confirmation (via modal personnalisée car confirm() interdit)
      const resume = `📊 Résumé : ${topKeys.length} livre(s), ${totalChapters} chapitre(s), ${totalVerses} verset(s). Importer ?`;
      const confirmed = await _confirmModal(resume, "Importer", "Annuler");
      if (!confirmed) {
        msg.innerHTML = `<span style="color:var(--warning)">⏸ Import annulé</span>`;
        return;
      }

      // 5. Sauvegarde IDB
      const name = file.name.replace(/\.json$/i, '');
      await db.saveBible(name, data);
      progress()?.setAttribute('value', '100');

      // Log de l'événement
      logEvent('Import Bible', { name, books: topKeys.length, chapters: totalChapters, verses: totalVerses });

      msg.innerHTML = `<span style="color:var(--success)">✅ « ${esc(name)} » importée (${topKeys.length} livres, ${totalVerses} versets)</span>`;
      showToast(`📖 Bible « ${esc(name)} » importée (${topKeys.length} livres)`, 'success', 4000);
      loadBibleList();
    } catch (err) {
      db.log('error', 'Échec import Bible', { message: err.message, fileName: file.name });
      msg.innerHTML = `<span style="color:var(--danger)">❌ ${esc(err.message)}</span>`;
      showToast('❌ Import échoué : ' + err.message, 'error', 6000);
    } finally {
      fileInput.value = '';
    }
  });

  loadBibleList();
}

/**
 * Boîte de dialogue de confirmation personnalisée (car confirm/alert interdits)
 * @param {string} message
 * @param {string} okLabel
 * @param {string} cancelLabel
 * @returns {Promise<boolean>}
 */
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

/** Section Chants : sliders + cases + alignement + sauvegarde */
function _bindSongSettings() {
  // Slider taille police
  document.getElementById('song-font-size')?.addEventListener('input', function () {
    document.getElementById('song-font-size-val').textContent = this.value;
  });

  // Boutons d'alignement
  document.querySelectorAll('[data-align-settings-align]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const align = btn.dataset.alignSettingsAlign;
      if (align === App.settings.songTextAlign) return;
      App.settings.songTextAlign = align;
      await db.saveSetting('songTextAlign', align);
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

  // Sauvegarde avec lock
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

      await Promise.all(Object.entries(vals).map(([k, v]) => db.saveSetting(k, v)));
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

/** Section Lower Third : sliders + sauvegarde + dispatch d'événement pour aperçu + thème */
function _bindLTSettings() {
  // Sliders LT avec affichage valeur live
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

      await Promise.all(Object.entries(vals).map(([k, v]) => db.saveSetting(k, v)));
      App.merge(vals);

      // US-52 : Appliquer le thème visuel en fonction du ltType
      if (typeof window.applyTheme === 'function') {
        window.applyTheme(vals.ltType);
      }

      const msg = document.getElementById('settings-saved');
      if (msg) {
        msg.innerHTML = '<span style="color:var(--success)">✅ Paramètres LT enregistrés</span>';
        setTimeout(() => { msg.innerHTML = ''; }, 2000);
      }
      showToast('💾 Paramètres Lower Third enregistrés', 'success');

      // Dispatch d'un événement pour que le panneau Lower Third mette à jour son aperçu
      window.dispatchEvent(new CustomEvent('lt-settings-changed'));
      // Rafraîchir le PIP si nécessaire
      if (typeof window.updatePipPreview === 'function' && App.lastProjectionState) {
        window.updatePipPreview(App.lastProjectionState);
      }
      logEvent('Sauvegarde paramètres Lower Third', vals);
    }, 'Sauvegarde paramètres LT');
  });
}

/** Section Diapositives : sliders + alignement + sauvegarde + envoi immédiat à la projection */
function _bindSlideSettings() {
  // Sliders live
  [
    ['slide-ref-size',   'slide-ref-size-val'],
    ['slide-verse-size', 'slide-verse-size-val'],
  ].forEach(([rangeId, valId]) => {
    document.getElementById(rangeId)?.addEventListener('input', function () {
      document.getElementById(valId).textContent = this.value;
    });
  });

  // Boutons alignement diapositives
  document.querySelectorAll('[data-slide-align]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const align = btn.dataset.slideAlign;
      if (align === App.settings.slideTextAlign) return;
      App.settings.slideTextAlign = align;
      await db.saveSetting('slideTextAlign', align);
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

      await Promise.all(Object.entries(vals).map(([k, v]) => db.saveSetting(k, v)));
      App.merge(vals);

      // Envoi immédiat des paramètres à la fenêtre de projection (mode slide)
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

/** Section Configuration : export + import JSON + export logs + toastDuration slider */
function _bindConfigIO(container) {
  // Export config
  document.getElementById('btn-export-config')?.addEventListener('click', async () => {
    const config = {
      exportedAt: new Date().toISOString(),
      app: 'NTIC Bible Projector',
      version: '1.0-sp18',
      settings: {},
    };
    const vals = await Promise.all(SETTINGS_KEYS.map((k) => db.getSetting(k, null)));
    SETTINGS_KEYS.forEach((k, i) => { config.settings[k] = vals[i]; });

    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url });
    a.download = `ntic-config-${Date.now()}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('📤 Configuration exportée', 'success');
  });

  // Export logs
  document.getElementById('btn-export-logs')?.addEventListener('click', async () => {
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

  // Gestion du slider toastDuration
  const toastRange = document.getElementById('toast-duration-range');
  const toastValue = document.getElementById('toast-duration-value');
  if (toastRange && toastValue) {
    toastRange.addEventListener('input', (e) => {
      const val = e.target.value;
      toastValue.textContent = val + ' ms';
    });
    toastRange.addEventListener('change', async (e) => {
      const val = parseInt(e.target.value, 10);
      await db.saveSetting('toastDuration', val);
      App.settings.toastDuration = val;
      showToast(`Durée des notifications : ${val} ms`, 'success', 2000);
    });
  }

  const importInput  = document.getElementById('import-config-file');
  const configStatus = document.getElementById('config-status');

  importInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    configStatus.innerHTML = '<span>⏳ Import en cours…</span>';
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed?.settings || typeof parsed.settings !== 'object') {
        throw new Error('Format invalide : clé "settings" absente');
      }

      await withWriteLock(async () => {
        for (const key of SETTINGS_KEYS) {
          if (!(key in parsed.settings)) continue;
          const value = parsed.settings[key];

          if (key.toLowerCase().includes('color') || key === 'slideBg') {
            if (typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value))
              await db.saveSetting(key, value);
          } else if (['ltType', 'ltFontFamily', 'songFontFamily', 'slideFont'].includes(key)) {
            if (typeof value === 'string') await db.saveSetting(key, value);
          } else if (['songShowTitle', 'songShowAuthor', 'songUppercase'].includes(key)) {
            if (typeof value === 'boolean') await db.saveSetting(key, value);
          } else if (['songTextAlign', 'slideTextAlign'].includes(key)) {
            if (['left', 'center', 'right'].includes(value)) await db.saveSetting(key, value);
          } else if (typeof value === 'number') {
            await db.saveSetting(key, value);
          }
        }
        // Après import, recharger le panneau pour mettre à jour l'affichage et appliquer le thème
        await renderSettingsPanel(container);
        if (typeof window.applyTheme === 'function') {
          const newLtType = await db.getSetting('ltType', SETTINGS_DEFAULTS.ltType);
          window.applyTheme(newLtType);
        }
      }, 'Import configuration');

      configStatus.innerHTML = '<span style="color:var(--success)">✅ Configuration importée</span>';
      showToast('📥 Configuration importée', 'success');
      logEvent('Import configuration', { fileName: file.name });
    } catch (err) {
      configStatus.innerHTML = `<span style="color:var(--danger)">❌ ${esc(err.message)}</span>`;
      showToast('❌ Échec import', 'error');
      db.log('error', 'Échec import configuration', { message: err.message });
    } finally {
      importInput.value = '';
    }
  });
}