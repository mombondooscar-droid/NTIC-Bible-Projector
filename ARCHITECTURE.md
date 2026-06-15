## 📄 `ARCHITECTURE.md` (version finale SP22+)

```markdown
# NTIC Bible Projector — Architecture Technique
> Version : v1.0 · Sprint R4 (US-R13, R14, R15) · Dernière mise à jour : 2026-06-15

---

## 1. Structure des fichiers (finale)

```
NTIC Bible Projector/
│
├── index.html                  ← SPA shell (routing, chargement scripts)
├── manifest.json               ← PWA manifest (VERROUILLÉ)
├── service-worker.js           ← Cache-First SW (VERROUILLÉ sauf CACHE_VERSION)
├── offline.html                ← Page fallback offline (VERROUILLÉ)
│
├── app.js                      ← Orchestrateur init() uniquement — ~280L
├── constants.js                ← Source unique : FONTS, SETTINGS_KEYS, SETTINGS_DEFAULTS,
│                                  ICONS, BC_MESSAGE_VERSION, PROJECTION_CHANNELS
├── store.js                    ← État global centralisé + alias App = Store
├── db.js                       ← BibleDB : wrapper IndexedDB v4 ← NE PAS MODIFIER
│
├── style.css                   ← Import-only (4 @import)
├── styles/
│   ├── base.css                ← Variables CSS, reset, header, nav, main, footer
│   ├── components.css          ← Boutons, champs, toasts, modales, PIP, raccourcis
│   ├── panels.css              ← Bible, Favoris, Chants, Lower Third, Paramètres
│   └── responsive.css          ← Toutes les media queries
│
├── utils/                      ← Fonctions globales partagées (chargées avant panels)
│   ├── dom.js                  ← esc, debounce, fmtDate, showToast, safePostMessage,
│   │                              createProjectionChannel, PROJ_ROUTE_MAP, hideLoadingOverlay
│   ├── bibleHelpers.js         ← BIBLE_BOOKS, stripAccents, levenshtein, matchBookName,
│   │                              parseRef, searchFullText, buildVerseRef, parseVerseRef,
│   │                              buildInvertedIndex, getInvertedIndex
│   ├── songHelpers.js          ← parseStrophes, reconstructText, buildAllStrophesTexts
│   ├── bibleNavigation.js      ← getFavRefsSet, loadBibleVersion, renderBooksGrid,
│   │                              renderChaptersGrid, renderVersesList,
│   │                              attachVerseCardEvents, _renderMobileStep,
│   │                              renderMobileVersesList
│   │                              (État : _isMobileView, _mobileStep, _selectedBook, _selectedChapter)
│   └── bibleProjection.js      ← updatePipPreview, setPipEnabled, initPipDrag,
│                                  segmentVerse, setActiveSegment, _projectSegment,
│                                  _updateSegmentBar, syncNavToRef, projectVerse,
│                                  _initHighlightToolbar
│
├── panels/                     ← Rendus HTML des onglets (chargés après utils)
│   ├── bibleSearch.js          ← Recherche Bible (texte/référence) — extrait US-R13
│   ├── bibleDual.js            ← Mode bilingue (côte-à-côte/alternance) — extrait US-R14
│   ├── biblePanel.js           ← Orchestrateur Bible + gestionnaires communs (~280L)
│   ├── songsPanel.js           ← Panneau Chants complet
│   ├── favoritesPanel.js       ← Panneau Favoris complet
│   ├── lowerThirdPanel.js      ← Panneau Lower Third complet
│   ├── settingsBinders.js      ← Handlers événements Paramètres — extrait US-R15
│   └── settingsPanel.js        ← Panneau Paramètres orchestrateur + HTML builder (~200L)
│
├── projection-bible.html       ← Fenêtre dédiée : versets plein écran + slide + dual
├── projection-chant.html       ← Fenêtre dédiée : chants (titre, paroles, strophes)
├── projection-lt-verset.html   ← Fenêtre dédiée : Lower Third verset (ictheme/tourpac)
├── projection-lt-personne.html ← Fenêtre dédiée : Lower Third personne (ictheme/tourpac)
└── projection-shared.js        ← Utilitaires autonomes partagés par les 4 fenêtres
                                   (esc, createProjectionChannel, isValidProjectionMessage,
                                   showProjectionMode, triggerProjectionAnim,
                                   renderProjectionSegNav, highlightProjectionText)
```

---

## 2. Ordre de chargement `index.html` (final)

> ⚠️ L'ordre est strict. Toute modification peut provoquer des erreurs de symboles indéfinis.

```html
<!-- Couche 1 : Fondations (pas de dépendances externes) -->
<script src="./db.js"></script>
<script src="./constants.js"></script>
<script src="./store.js"></script>

<!-- Couche 2 : Utilitaires DOM (dépend de constants.js) -->
<script src="./utils/dom.js"></script>

<!-- Couche 3 : Helpers métier (dépend de store.js + dom.js) -->
<script src="./utils/bibleHelpers.js"></script>
<script src="./utils/songHelpers.js"></script>

<!-- Couche 4 : Utilitaires Bible (dépend de db.js + dom.js + bibleHelpers.js) -->
<script src="./utils/bibleNavigation.js"></script>   ← AVANT tous les panels
<script src="./utils/bibleProjection.js"></script>   ← AVANT tous les panels

<!-- Couche 5 : Panels (dépendent de toutes les couches précédentes) -->
<script src="./panels/bibleSearch.js"></script>      ← NOUVEAU US-R13
<script src="./panels/bibleDual.js"></script>        ← NOUVEAU US-R14
<script src="./panels/biblePanel.js"></script>       ← orchestrateur Bible
<script src="./panels/songsPanel.js"></script>
<script src="./panels/favoritesPanel.js"></script>
<script src="./panels/lowerThirdPanel.js"></script>
<script src="./panels/settingsBinders.js"></script>   ← NOUVEAU US-R15
<script src="./panels/settingsPanel.js"></script>    ← orchestrateur Paramètres

<!-- Couche 6 : Orchestrateur (dépend de tout) -->
<script src="./app.js"></script>
```

**Règles critiques :**
- `bibleNavigation.js` et `bibleProjection.js` restent en Couche 4
- `bibleSearch.js`, `bibleDual.js`, `settingsBinders.js` sont chargés juste avant leurs panels respectifs
- `biblePanel.js` appelle des fonctions de `bibleSearch.js` (`currentSearchMode`, `handleFullTextSearch`, etc.) et de `bibleDual.js` (`renderDualPanel`, etc.)
- `settingsPanel.js` appelle des fonctions de `settingsBinders.js` (`_bindBibleImport`, etc.)

---

## 3. Carte mentale des dépendances inter-fichiers

```
app.js
 ├── db.js (open, saveSetting, getSetting, log)
 ├── constants.js (SETTINGS_KEYS, SETTINGS_DEFAULTS, BC_MESSAGE_VERSION, PROJECTION_CHANNELS)
 ├── store.js (App)
 ├── utils/dom.js (createProjectionChannel, showToast, hideLoadingOverlay, safePostMessage, esc)
 ├── utils/bibleHelpers.js (buildVerseRef, parseVerseRef)
 ├── utils/bibleProjection.js (setPipEnabled, initPipDrag, updatePipPreview)
 ├── panels/biblePanel.js (renderBiblePanel)
 ├── panels/songsPanel.js (renderSongsPanel)
 ├── panels/favoritesPanel.js (renderFavoritesPanel)
 ├── panels/lowerThirdPanel.js (renderLowerThirdPanel)
 └── panels/settingsPanel.js (renderSettingsPanel)

panels/biblePanel.js
 ├── utils/bibleNavigation.js (getFavRefsSet, loadBibleVersion, renderBooksGrid, renderChaptersGrid, renderVersesList, attachVerseCardEvents, _renderMobileStep, renderMobileVersesList, _isMobileView)
 ├── utils/bibleProjection.js (updatePipPreview, projectVerse, _projectSegment, _updateSegmentBar, _initHighlightToolbar)
 ├── utils/bibleHelpers.js (stripAccents, levenshtein, BIBLE_BOOKS, parseRef, searchFullText, buildVerseRef, parseVerseRef)
 ├── panels/bibleSearch.js (currentSearchMode, displaySearchResults, highlightText, handleFullTextSearch, handleRefSearch, onSearchModeChange)
 ├── panels/bibleDual.js (renderDualPanel, startAlternateMode, stopAlternateMode, sendAlternateProjection)
 ├── utils/dom.js (esc, debounce, showToast, safePostMessage)
 ├── constants.js (ICONS)
 ├── store.js (App)
 └── db.js (getAllBibleNames, getSetting, saveSetting, getBible, getAllFavorites)

panels/bibleSearch.js
 ├── utils/bibleProjection.js (projectVerse)
 ├── utils/bibleHelpers.js (BIBLE_BOOKS, stripAccents, levenshtein, parseRef, searchFullText)
 ├── utils/dom.js (esc)
 ├── constants.js (ICONS)
 └── store.js (App)

panels/bibleDual.js
 ├── db.js (getAllBibleNames, getBible)
 ├── store.js (App)
 ├── utils/dom.js (esc, showToast, safePostMessage)
 ├── utils/bibleProjection.js (updatePipPreview)
 └── constants.js (ICONS)

panels/settingsPanel.js
 ├── constants.js (FONTS, SETTINGS_KEYS, SETTINGS_DEFAULTS)
 ├── store.js (App)
 ├── utils/dom.js (esc, showToast, safePostMessage)
 ├── db.js (getAllBibleNames, getSetting, saveSetting, deleteBible)
 ├── app.js (withWriteLock, logEvent, updatePipPreview, applyTheme)
 └── panels/settingsBinders.js (_bindBibleImport, _bindSongSettings, _bindLTSettings, _bindSlideSettings, _bindConfigIO)

panels/settingsBinders.js
 ├── db.js (saveBible, getAllBibleNames, deleteBible, saveSetting, getSetting, getAllLogs, log)
 ├── store.js (App)
 ├── utils/dom.js (esc, showToast, safePostMessage)
 ├── app.js (withWriteLock, logEvent, applyTheme, updatePipPreview)
 ├── constants.js (FONTS, SETTINGS_KEYS, SETTINGS_DEFAULTS)
 └── panels/settingsPanel.js (loadBibleList, renderSettingsPanel)

panels/songsPanel.js
 ├── db.js (getAllSongs, saveSong, getSong, deleteSong, removeFavorite, addFavorite)
 ├── store.js (App)
 ├── utils/dom.js (esc, debounce, showToast, safePostMessage)
 ├── utils/songHelpers.js (parseStrophes, reconstructText, buildAllStrophesTexts)
 ├── utils/bibleProjection.js (updatePipPreview)
 ├── panels/biblePanel.js (getFavRefsSet)
 ├── constants.js (ICONS)
 └── app.js (logEvent, withWriteLock)

panels/favoritesPanel.js
 ├── db.js (getAllFavorites, exportFavoritesJSON, removeFavorite, updateFavoriteLabel, getSong)
 ├── store.js (App)
 ├── utils/dom.js (esc, debounce, fmtDate, showToast, safePostMessage)
 ├── utils/bibleHelpers.js (parseVerseRef)
 ├── utils/songHelpers.js (buildAllStrophesTexts)
 ├── utils/bibleProjection.js (updatePipPreview)
 ├── panels/biblePanel.js (projectVerse)
 └── constants.js (ICONS)

panels/lowerThirdPanel.js
 ├── db.js (getAllPersons, savePerson, getPerson, deletePerson, saveSetting, getSetting)
 ├── store.js (App)
 ├── utils/dom.js (esc, showToast, safePostMessage)
 ├── utils/bibleProjection.js (updatePipPreview)
 ├── panels/biblePanel.js (projectVerse)
 ├── constants.js (ICONS)
 └── app.js (logEvent)

utils/bibleNavigation.js
 ├── db.js (getAllFavorites, getBible)
 ├── store.js (App)
 ├── utils/dom.js (esc, showToast, safePostMessage)
 ├── utils/bibleProjection.js (updatePipPreview, projectVerse, segmentVerse, _projectSegment)
 ├── utils/bibleHelpers.js (buildVerseRef)
 ├── constants.js (ICONS)
 └── panels/biblePanel.js (renderBiblePanel) [appel runtime]

utils/bibleProjection.js
 ├── db.js (saveSetting)
 ├── store.js (App)
 ├── utils/dom.js (esc, showToast, safePostMessage)
 ├── constants.js (ICONS)
 └── projection-shared.js (renderProjectionSegNav) [runtime]

utils/dom.js
 ├── constants.js (BC_MESSAGE_VERSION)
 └── store.js (App) [optionnel pour toastDuration]

utils/bibleHelpers.js
 └── store.js (App)

utils/songHelpers.js
 └── (aucune dépendance externe)

app.js
 └── (dépend de tout)

projection-*.html + projection-shared.js
 └── constants.js (BC_MESSAGE_VERSION, PROJECTION_CHANNELS)
```

---

## 4. Tableau des fonctions globales exposées par chaque module

| Module | Fonctions globales |
|--------|-------------------|
| `db.js` | `db` (instance de `BibleDB`), `BibleDB` (classe) |
| `constants.js` | `FONTS`, `SETTINGS_KEYS`, `SETTINGS_DEFAULTS`, `ICONS`, `BC_MESSAGE_VERSION`, `PROJECTION_CHANNELS` |
| `store.js` | `Store`, `App` (alias) |
| `utils/dom.js` | `esc`, `debounce`, `fmtDate`, `showToast`, `createProjectionChannel`, `safePostMessage`, `hideLoadingOverlay`, `PROJ_ROUTE_MAP` |
| `utils/bibleHelpers.js` | `buildVerseRef`, `parseVerseRef`, `stripAccents`, `levenshtein`, `matchBookName`, `parseRef`, `searchFullText`, `buildInvertedIndex`, `getInvertedIndex`, `BIBLE_BOOKS` |
| `utils/songHelpers.js` | `parseStrophes`, `reconstructText`, `buildAllStrophesTexts` |
| `utils/bibleNavigation.js` | `getFavRefsSet`, `loadBibleVersion`, `renderBooksGrid`, `renderChaptersGrid`, `renderVersesList`, `attachVerseCardEvents`, `_renderMobileStep`, `renderMobileVersesList`<br>Variables d'état : `_isMobileView`, `_mobileStep`, `_selectedBook`, `_selectedChapter` |
| `utils/bibleProjection.js` | `updatePipPreview`, `setPipEnabled`, `initPipDrag`, `segmentVerse`, `setActiveSegment`, `_projectSegment`, `_updateSegmentBar`, `syncNavToRef`, `projectVerse`, `_initHighlightToolbar` |
| `panels/bibleSearch.js` | `currentSearchMode`, `displaySearchResults`, `highlightText`, `onSearchModeChange`, `handleFullTextSearch`, `handleRefSearch` |
| `panels/bibleDual.js` | `populateVersionSelectB`, `loadDualVerse`, `initDualNavigator`, `renderDualPanel`, `startAlternateMode`, `stopAlternateMode`, `sendAlternateProjection` |
| `panels/biblePanel.js` | `renderBiblePanel`, `bindCommonEventHandlers` |
| `panels/songsPanel.js` | `renderSongsPanel`, `renderSongCards`, `bindSongCards`, `renderSongEditor`, `getCurrentStrophes`, `renderSlidePreview`, `updateSlidePreview`, `refreshSongsList`, `showNewSongForm` |
| `panels/favoritesPanel.js` | `renderFavoritesPanel`, `buildFavCards`, `refreshFavList`, `rebuildLabelFilter`, `bindFavCards`, `projectFavorite` |
| `panels/lowerThirdPanel.js` | `renderLowerThirdPanel` |
| `panels/settingsBinders.js` | `_bindBibleImport`, `_confirmModal`, `_bindSongSettings`, `_bindLTSettings`, `_bindSlideSettings`, `_bindConfigIO` |
| `panels/settingsPanel.js` | `renderSettingsPanel`, `loadBibleList`, `_buildSettingsHtml` (interne) |
| `app.js` | `openProjectionWindows`, `navigateTo`, `renderPanel`, `applyTheme`, `withWriteLock`, `logEvent`, `acquireLock`, `releaseLock`, `init` (auto-exécuté) |
| `projection-shared.js` | `esc`, `createProjectionChannel`, `isValidProjectionMessage`, `showProjectionMode`, `hideAllProjectionModes`, `triggerProjectionAnim`, `renderProjectionSegNav`, `highlightProjectionText` |
| `projection-*.html` (scripts internes) | `MODE_IDS`, `channel`, `_state`, `_render*`, `_apply*Style`, etc. (privées) |

---

## 5. Fichiers verrouillés (inchangés)

> Ces fichiers ne doivent **jamais** être modifiés sans accord explicite du chef de projet.

| Fichier | Raison |
|---------|--------|
| `db.js` | Couche de persistance critique — version v4 stable |
| `manifest.json` | PWA manifest — changement = perte d'installabilité |
| `offline.html` | Page fallback autonome — pas de dépendances |
| `projection-shared.js` | Autonome par construction — pas de dépendances app |

**`service-worker.js`** : seul `CACHE_VERSION` est modifiable (incrémenter à chaque modification de fichier caché). Toute autre modification nécessite une validation.

---

## 6. IndexedDB — Stores (inchangé, version 4)

| Store | Clé | Index | Rôle |
|-------|-----|-------|------|
| `bibles` | `name` | `by_name` | Fichiers Bible JSON complets |
| `songs` | `id` (auto) | `by_title`, `by_author` | Chants (titre, auteur, strophes) |
| `persons` | `id` (auto) | `by_nom` | Personnes Lower Third |
| `settings` | `key` | — | Paramètres clé/valeur |
| `favorites` | `id` (auto) | `by_type`, `by_label`, `by_ref` | Favoris versets + chants |
| `logs` | `id` (auto) | `by_ts`, `by_level` | Journal système (max 200 entrées) |

---

## 7. BroadcastChannel — Canaux et messages (inchangé)

### Canaux dédiés

| Constante | Valeur | Fenêtre cible |
|-----------|--------|---------------|
| `PROJECTION_CHANNELS.BIBLE` | `'projection-bible'` | `projection-bible.html` |
| `PROJECTION_CHANNELS.CHANT` | `'projection-chant'` | `projection-chant.html` |
| `PROJECTION_CHANNELS.LT_VERSET` | `'projection-lt-verset'` | `projection-lt-verset.html` |
| `PROJECTION_CHANNELS.LT_PERSONNE` | `'projection-lt-personne'` | `projection-lt-personne.html` |
| `PROJECTION_CHANNELS.LEGACY` | `'projection-channel'` | @deprecated |
| `PROJECTION_CHANNELS.LT` | `'projection-lt'` | @deprecated |

### Table de routage (`PROJ_ROUTE_MAP` dans `utils/dom.js`)

| Type de message | Canaux destinataires |
|----------------|----------------------|
| `show-verse` | `bible`, `ltVerset` |
| `show-lower-third` | `ltVerset` |
| `verse:segment` | `bible`, `ltVerset` |
| `highlight:words` | `bible`, `ltVerset` |
| `highlight:clear` | `bible`, `ltVerset` |
| `show-slide` | `bible` |
| `slide-settings` | `bible` |
| `show-song` | `chant` |
| `song-settings` | `chant` |
| `song-next-strophe` | `chant` |
| `song-prev-strophe` | `chant` |
| `show-person` | `ltPersonne` |
| `hide-lower-third` | `ltVerset`, `ltPersonne` |
| `show-dual-verse` | `bible` |

---

## 8. Thème visuel (inchangé)

Piloté par `App.settings.ltType` via `applyTheme(ltType)` dans `app.js` :

| Valeur `ltType` | Attribut HTML | Thème |
|----------------|---------------|-------|
| `'tourpac'` | `data-theme="tourpac"` | Clair — couleurs Congo (vert/rouge/jaune) |
| `'ictheme'` (défaut) | *(aucun attribut)* | Sombre — bleu/violet |

---

## 9. Conventions de nommage (inchangées)

| Convention | Exemples |
|------------|----------|
| Fonctions privées de panel | `_bindVerseActions()`, `_buildLTHtml()` |
| Fonctions d'état mobile | `_mobileStep`, `_selectedBook` |
| Messages BC | camelCase avec tirets : `show-verse`, `hide-lower-third` |
| IDs HTML critiques | `#app`, `#pip-preview`, `#pip-content`, `#verse-segment-bar` |
| Classes CSS de mode | `.proj-mode`, `.proj-mode.active` |
| CustomEvents | `app:next-segment`, `app:prev-segment`, `app:next-verse` |
| Canaux BC | `PROJECTION_CHANNELS.BIBLE` (constante) → `'projection-bible'` (valeur) |

---

## 10. Cimetière du projet — BANNISSEMENT PERMANENT

Ne jamais réintroduire sans accord explicite :

- `model2` rectangle Lower Third style
- Classes CSS `lt-c-*` (centered Lower Third)
- Double-clic bold verse function
- Raccourcis clavier 1–9 pour les slots Lower Third
- Fonction `create_display_files`
- Style `staggered` (remplacé par `ictheme`)
- Mécanisme de changement Bible en deux étapes
- `projection.html` monolithique (remplacé par 4 fichiers dédiés)

---

## 11. Évolution récente (SP22+)

| US | Fichier créé | Fichier modifié | Description |
|----|--------------|----------------|-------------|
| US-R13 | `panels/bibleSearch.js` | `biblePanel.js`, `service-worker.js`, `index.html` | Extraction de la recherche Bible |
| US-R14 | `panels/bibleDual.js` | `biblePanel.js`, `service-worker.js`, `index.html` | Extraction du mode bilingue |
| US-R15 | `panels/settingsBinders.js` | `settingsPanel.js`, `service-worker.js`, `index.html` | Extraction des handlers paramètres |

**Version SW actuelle : `v19`** (incrémentée à chaque extraction).

---

*Document généré automatiquement par Claude (Orchestrateur Agile) — Sprint R4 · US-R13/14/15*
```