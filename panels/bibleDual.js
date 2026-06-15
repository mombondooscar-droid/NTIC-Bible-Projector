/**
 * panels/bibleDual.js — Mode bilingue / dual (côte-à-côte + alternance)
 * NTIC Bible Projector · US-R14 Sprint R4
 * Dépendances globales : db, App, esc, showToast, safePostMessage,
 *   updatePipPreview (utils/bibleProjection.js), ICONS
 * Scope global — chargé AVANT panels/biblePanel.js dans index.html
 */

// ─────────────────────────────────────────────────────────────
//  FONCTIONS DU MODE BILINGUE
// ─────────────────────────────────────────────────────────────

/** Remplit le sélecteur de versions pour le côté B */
async function populateVersionSelectB(selectEl, currentVersion) {
  const names = await db.getAllBibleNames();
  selectEl.innerHTML = names.map(n => `<option value="${esc(n)}" ${n === currentVersion ? 'selected' : ''}>${esc(n)}</option>`).join('');
}

/** Charge le verset pour un côté (A ou B) et met à jour l'UI */
async function loadDualVerse(side, book, chapter, verse) {
  if (!book || !chapter || !verse) return;
  const data = side === 'A' ? App.bibleData : App.bibleDataB;
  if (!data) return;
  const text = data[book]?.[chapter]?.[verse];
  if (!text) return;
  const ref = `${book} ${chapter}:${verse}`;
  if (side === 'A') {
    App.dualConfig.verseA = { ref, text, version: App.settings.currentBible };
  } else {
    App.dualConfig.verseB = { ref, text, version: document.getElementById('dual-version-b').value };
  }
  // Mettre à jour l'affichage des aperçus
  const previewA = document.getElementById('dual-preview-a');
  const previewB = document.getElementById('dual-preview-b');
  if (previewA && App.dualConfig.verseA) previewA.innerHTML = `<div class="dual-ref">${esc(App.dualConfig.verseA.ref)}</div><div class="dual-text">${esc(App.dualConfig.verseA.text)}</div>`;
  if (previewB && App.dualConfig.verseB) previewB.innerHTML = `<div class="dual-ref">${esc(App.dualConfig.verseB.ref)}</div><div class="dual-text">${esc(App.dualConfig.verseB.text)}</div>`;
  // Activer le bouton de projection si les deux versets sont présents
  const projectBtn = document.getElementById('btn-project-dual');
  if (projectBtn) projectBtn.disabled = !(App.dualConfig.verseA && App.dualConfig.verseB);
}

/** Initialise les listes livres/chapitres/versets pour un côté */
async function initDualNavigator(side, bibleData) {
  if (!bibleData) return;
  const books = Object.keys(bibleData);
  const booksContainer = document.getElementById(`dual-books-${side.toLowerCase()}`);
  const chaptersContainer = document.getElementById(`dual-chapters-${side.toLowerCase()}`);
  const versesContainer = document.getElementById(`dual-verses-${side.toLowerCase()}`);

  // Remplir livres
  booksContainer.innerHTML = books.map(book => `<button class="nav-item nav-item--book dual-book" data-book="${esc(book)}">${esc(book)}</button>`).join('');
  booksContainer.querySelectorAll('.dual-book').forEach(btn => {
    btn.addEventListener('click', () => {
      const book = btn.dataset.book;
      const chapters = Object.keys(bibleData[book]);
      chaptersContainer.innerHTML = chapters.map(ch => `<button class="nav-item nav-item--chapter dual-chapter" data-chapter="${ch}">${ch}</button>`).join('');
      chaptersContainer.querySelectorAll('.dual-chapter').forEach(chBtn => {
        chBtn.addEventListener('click', () => {
          const chapter = chBtn.dataset.chapter;
          const verses = bibleData[book][chapter];
          const verseKeys = Object.keys(verses);
          versesContainer.innerHTML = verseKeys.map(v => `<button class="nav-item nav-item--verse dual-verse" data-verse="${v}">${v}</button>`).join('');
          versesContainer.querySelectorAll('.dual-verse').forEach(vBtn => {
            vBtn.addEventListener('click', () => {
              const verse = vBtn.dataset.verse;
              loadDualVerse(side, book, chapter, verse);
            });
          });
        });
      });
    });
  });
}

/** Construit les deux colonnes de navigation indépendantes */
async function renderDualPanel(container) {
  const bibleNames = await db.getAllBibleNames();
  const versionA = App.settings.currentBible;
  const versionB = App.dualConfig.verseB?.version || versionA;
  const sideAHtml = `
    <div class="dual-col">
      <h3>Version A : ${esc(versionA)}</h3>
      <div class="dual-nav-col">
        <div class="dual-books" id="dual-books-a"></div>
        <div class="dual-chapters" id="dual-chapters-a"></div>
        <div class="dual-verses" id="dual-verses-a"></div>
      </div>
      <div class="dual-preview" id="dual-preview-a"></div>
    </div>`;
  const sideBHtml = `
    <div class="dual-col">
      <h3>
        Version B :
        <select id="dual-version-b" class="field-select">${bibleNames.map(n => `<option value="${esc(n)}" ${n === versionB ? 'selected' : ''}>${esc(n)}</option>`).join('')}
        </select>
      </h3>
      <div class="dual-nav-col">
        <div class="dual-books" id="dual-books-b"></div>
        <div class="dual-chapters" id="dual-chapters-b"></div>
        <div class="dual-verses" id="dual-verses-b"></div>
      </div>
      <div class="dual-preview" id="dual-preview-b"></div>
    </div>`;
  container.innerHTML = `
    <div class="dual-toolbar">
      <div class="dual-mode-selector">
        <button id="dual-mode-side" class="btn btn-sm ${App.dualConfig.mode === 'side' ? 'btn-primary' : 'btn-ghost'}">Côte à côte</button>
        <button id="dual-mode-alternate" class="btn btn-sm ${App.dualConfig.mode === 'alternate' ? 'btn-primary' : 'btn-ghost'}">Alternance</button>
      </div>
      <div class="dual-interval" id="dual-interval-control" style="${App.dualConfig.mode === 'alternate' ? '' : 'display:none'}">
        <label>Intervalle (s) : <input type="range" id="dual-interval-slider" min="3" max="10" step="0.5" value="${App.dualConfig.interval}"></label>
        <span id="dual-interval-value">${App.dualConfig.interval}s</span>
        <button id="dual-start-stop" class="btn btn-sm btn-ghost">${App.dualConfig.intervalActive ? '⏸ Arrêter' : '▶ Démarrer'}</button>
      </div>
      <button id="btn-project-dual" class="btn btn-primary" ${App.dualConfig.verseA && App.dualConfig.verseB ? '' : 'disabled'}>🔄 Projeter bilingue</button>
    </div>
    <div class="dual-content">
      ${sideAHtml}
      ${sideBHtml}
    </div>`;

  // Charger les données de la version B si différente
  if (versionB !== versionA) {
    const dataB = await db.getBible(versionB);
    App.bibleDataB = dataB;
  } else {
    App.bibleDataB = App.bibleData;
  }

  // Initialiser les navigateurs pour chaque côté
  await initDualNavigator('A', App.bibleData);
  await initDualNavigator('B', App.bibleDataB);

  // Gestion du sélecteur de version B
  const versionSelectB = document.getElementById('dual-version-b');
  versionSelectB?.addEventListener('change', async (e) => {
    const newVer = e.target.value;
    const data = await db.getBible(newVer);
    App.bibleDataB = data;
    App.dualConfig.verseB = null;
    await initDualNavigator('B', data);
    document.getElementById('dual-preview-b').innerHTML = '';
    const projectBtn = document.getElementById('btn-project-dual');
    if (projectBtn) projectBtn.disabled = !(App.dualConfig.verseA && App.dualConfig.verseB);
  });

  // Mode d'affichage
  document.getElementById('dual-mode-side')?.addEventListener('click', () => {
    App.dualConfig.mode = 'side';
    if (App.dualConfig.intervalTimer) clearInterval(App.dualConfig.intervalTimer);
    App.dualConfig.intervalActive = false;
    document.getElementById('dual-mode-side').classList.add('btn-primary');
    document.getElementById('dual-mode-side').classList.remove('btn-ghost');
    document.getElementById('dual-mode-alternate').classList.add('btn-ghost');
    document.getElementById('dual-mode-alternate').classList.remove('btn-primary');
    document.getElementById('dual-interval-control').style.display = 'none';
  });
  document.getElementById('dual-mode-alternate')?.addEventListener('click', () => {
    App.dualConfig.mode = 'alternate';
    document.getElementById('dual-mode-alternate').classList.add('btn-primary');
    document.getElementById('dual-mode-alternate').classList.remove('btn-ghost');
    document.getElementById('dual-mode-side').classList.add('btn-ghost');
    document.getElementById('dual-mode-side').classList.remove('btn-primary');
    document.getElementById('dual-interval-control').style.display = '';
  });

  // Slider intervalle
  const slider = document.getElementById('dual-interval-slider');
  const valSpan = document.getElementById('dual-interval-value');
  slider?.addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    valSpan.textContent = v + 's';
    App.dualConfig.interval = v;
    if (App.dualConfig.intervalActive) {
      // Redémarrer l'alternance avec le nouvel intervalle
      startAlternateMode();
    }
  });

  // Bouton start/stop alternance
  const startStop = document.getElementById('dual-start-stop');
  startStop?.addEventListener('click', () => {
    if (App.dualConfig.intervalActive) {
      stopAlternateMode();
    } else {
      startAlternateMode();
    }
  });

  // Bouton de projection
  document.getElementById('btn-project-dual')?.addEventListener('click', () => {
    if (!App.dualConfig.verseA || !App.dualConfig.verseB) {
      showToast('Sélectionnez un verset dans chaque colonne', 'warning');
      return;
    }
    safePostMessage({
      type: 'show-dual-verse',
      data: {
        verseA: App.dualConfig.verseA,
        verseB: App.dualConfig.verseB,
        mode: App.dualConfig.mode,
        interval: App.dualConfig.interval,
        style: {
          ltType: App.settings.ltType,
          refColor: App.settings.ltRefColor,
          verseColor: App.settings.ltVerseColor,
          fontFamily: App.settings.ltFontFamily,
          width: App.settings.ltWidth,
          height: App.settings.ltHeight,
          refFontSize: App.settings.ltRefSize,
          verseFontSize: App.settings.ltVerseSize,
        },
      },
    });
    showToast('📖 Projection bilingue envoyée', 'success');
  });
}

/** Démarre le mode alternance (toutes les X secondes, projette alternativement) */
function startAlternateMode() {
  if (App.dualConfig.intervalTimer) clearInterval(App.dualConfig.intervalTimer);
  App.dualConfig.intervalActive = true;
  let showA = true;
  const projectBtn = document.getElementById('btn-project-dual');
  if (projectBtn) projectBtn.disabled = true; // désactiver projection manuelle
  const startStopBtn = document.getElementById('dual-start-stop');
  if (startStopBtn) startStopBtn.textContent = '⏸ Arrêter';

  // Première projection immédiate
  sendAlternateProjection(showA);
  App.dualConfig.intervalTimer = setInterval(() => {
    showA = !showA;
    sendAlternateProjection(showA);
  }, App.dualConfig.interval * 1000);
}

function stopAlternateMode() {
  if (App.dualConfig.intervalTimer) {
    clearInterval(App.dualConfig.intervalTimer);
    App.dualConfig.intervalTimer = null;
  }
  App.dualConfig.intervalActive = false;
  const startStopBtn = document.getElementById('dual-start-stop');
  if (startStopBtn) startStopBtn.textContent = '▶ Démarrer';
  const projectBtn = document.getElementById('btn-project-dual');
  if (projectBtn && App.dualConfig.verseA && App.dualConfig.verseB) projectBtn.disabled = false;
}

function sendAlternateProjection(showA) {
  const verse = showA ? App.dualConfig.verseA : App.dualConfig.verseB;
  if (!verse) return;
  // En mode alternance, on envoie un message standard show-verse pour n'afficher qu'un seul verset
  safePostMessage({
    type: 'show-verse',
    data: {
      reference: verse.ref,
      text: verse.text,
      style: {
        ltType: App.settings.ltType,
        refColor: App.settings.ltRefColor,
        verseColor: App.settings.ltVerseColor,
        fontFamily: App.settings.ltFontFamily,
        width: App.settings.ltWidth,
        height: App.settings.ltHeight,
        refFontSize: App.settings.ltRefSize,
        verseFontSize: App.settings.ltVerseSize,
      },
    },
  });
  updatePipPreview({ mode: 'bible', reference: verse.ref, text: verse.text });
}