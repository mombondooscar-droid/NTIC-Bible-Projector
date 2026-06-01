# US-01 : Architecture PWA de Base
## NTIC Bible Projector — Sprint 1

> Conversion de l'application Python Tkinter `fc16b.py` (v28.6) en PWA standalone offline-first.

---

## ⚡ Démarrage Rapide

### Option A — `npx http-server` (recommandé)

```bash
# Décompresser le zip, se placer dans le dossier
cd pwa-bible-projector-sprint1

# Lancer le serveur (pas de cache CDN)
npx http-server -c-1 -p 8080

# Ouvrir dans Chrome/Edge/Firefox
# → http://localhost:8080
```

### Option B — Python

```bash
python -m http.server 8080
# → http://localhost:8080
```

### Option C — VS Code Live Server

1. Installer l'extension **Live Server** (Ritwick Dey)
2. Clic droit sur `index.html` → **Open with Live Server**

> ⚠️ **Obligatoire** : L'app doit être servie via HTTP (pas `file://`)
> pour que le Service Worker et le manifest fonctionnent.

---

## 🔌 Test Offline

1. Ouvrir `http://localhost:8080` dans Chrome
2. **DevTools** (`F12`) → onglet **Application**
3. **Service Workers** → cocher **Offline**
4. Rafraîchir la page (`F5`)
5. ✅ L'app charge depuis le cache
6. Naviguer vers un onglet inexistant → `offline.html` s'affiche

---

## 📱 Test Installable (PWA)

### Chrome / Edge :
1. Ouvrir `http://localhost:8080`
2. Une icône **Install** (⊕) apparaît dans la barre d'adresse
3. Cliquer → **Installer "NTIC Bible Projector"**
4. L'app s'installe sur le bureau / menu Démarrer
5. Lancer depuis le raccourci → s'ouvre sans barre d'adresse (standalone)

### Android :
1. Ouvrir dans Chrome mobile
2. Menu → **Ajouter à l'écran d'accueil**

### iOS :
1. Ouvrir dans Safari
2. Partager (□↑) → **Sur l'écran d'accueil**

---

## 🏗️ Structure des fichiers

```
pwa-bible-projector-sprint1/
├── index.html            App shell (header, nav, main, footer)
├── app.js                Init SW, routing onglets, réseau, events
├── style.css             Design system (variables CSS, responsive)
├── service-worker.js     Cache-First strategy, offline fallback
├── manifest.json         Métadonnées PWA (icons, display, shortcuts)
├── offline.html          Page de fallback hors ligne
├── assets/
│   └── icons/
│       ├── icon-192x192.png      Icône PWA (192×192)
│       ├── icon-512x512.png      Icône PWA haute résolution (512×512)
│       ├── favicon.ico           Favicon navigateur (16/32/48px)
│       └── apple-touch-icon.png  Icône iOS (180×180)
└── README.md             Ce fichier
```

---

## 🔧 Architecture technique

| Composant | Stratégie | Détails |
|-----------|-----------|---------|
| Service Worker | Cache-First | Installe les assets au INSTALL, sert depuis cache, fallback réseau |
| Cache | `bible-projector-v1` | Versionnée, nettoyage automatique ACTIVATE |
| Offline | `offline.html` | Fallback si navigation échoue hors ligne |
| Routing | SPA (JS) | `data-tab` attributes, `history.replaceState` |
| Réseau | `window.online/offline` | Indicateur LED animé en header |
| Mises à jour | Toast UI | SW `updatefound` → bouton "Mettre à jour" |

---

## ✅ Checklist de Validation

### Fonctionnel
- [ ] App charge sans erreur console
- [ ] Service Worker s'installe (DevTools → Application → SW)
- [ ] Offline : app charge depuis cache
- [ ] Offline : `offline.html` affiché si asset manquant
- [ ] Installable : Chrome détecte la PWA (icône ⊕)
- [ ] App installée se lance hors ligne
- [ ] Indicateur Online/Offline (● vert/rouge) fonctionne
- [ ] 5 onglets cliquables, contenu change
- [ ] Deep link `?tab=songs` charge le bon onglet
- [ ] Toast de mise à jour SW apparaît lors d'un update

### Qualité
- [ ] Zéro erreur W3C (validator.w3.org)
- [ ] Zéro 404 en console
- [ ] Responsive : 375px, 768px, 1024px, 1920px
- [ ] Contraste texte ≥ 4.5:1 (WCAG AA)
- [ ] Focus visible (Tab key navigation)
- [ ] Manifest valide (manifest-validator.appspot.com)

### Performance
- [ ] Premier affichage < 1s (localhost)
- [ ] Taille ZIP < 500 KB
- [ ] INSTALL du SW < 500ms

---

## 🚀 Prochaines étapes (Sprint 2 — US-02)

| US | Fonctionnalité |
|----|----------------|
| US-02 | IndexedDB : migration données `songs_data.json` + `favorites.db` |
| US-03 | Onglet Bible : navigation livre/chapitre/verset + recherche |
| US-04 | Onglet Chants : CRUD complet + gestion strophes |
| US-05 | Lower Third : CRUD personnes + projection ictheme/tourpac |
| US-06 | Favoris : sauvegarde, étiquettes, export JSON |
| US-07 | Paramètres : polices, couleurs, taille, version Bible |

---

## 📦 Dépendances

**Aucune.** Vanilla JS + CSS natif + Pillow (génération icônes, non inclus dans le bundle).

La police `Sora` est chargée via Google Fonts CDN (non critique — le CSS utilise
un fallback `system-ui` si hors ligne).

---

## 📄 Licence

© 2025 NTIC Makabandilou — Usage interne.
