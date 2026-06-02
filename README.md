# NTIC Bible Projector — PWA
## NTIC Makabandilou · Version 1.0-sp12

> Application PWA offline-first de projection biblique pour la régie de diffusion de l'ICC (Impact Centre Chrétien).  
> Convertie depuis la base Python/Tkinter `fc16b.py` (v28.6) · 5 onglets · projection 1920×1080 · Lower Third broadcast.

---

## ⚡ Démarrage Rapide

### Option A — `npx http-server` (recommandé)

```bash
# Se placer dans le dossier racine du projet
cd ntic-bible-projector

# Lancer le serveur (no-cache)
npx http-server -c-1 -p 8080

# Ouvrir dans Chrome / Edge / Firefox
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

> ⚠️ **Obligatoire** : servir via HTTP (pas `file://`).  
> Le Service Worker et le BroadcastChannel ne fonctionnent pas en protocole `file://`.

---

## 🏗️ Structure des fichiers

```
ntic-bible-projector/
├── index.html            App shell — header, nav 5 onglets, footer
│                         Logo NTIC embarqué en base64 (aucune dépendance externe)
├── app.js                SPA routing, 5 panneaux, BroadcastChannel, PIP (2 649 L)
├── db.js                 BibleDB v2 — wrapper IndexedDB (5 stores)
├── style.css             Design system — variables CSS, dark theme, responsive
├── service-worker.js     Cache-First · bible-projector-v4 · offline fallback
├── manifest.json         PWA manifest — icons, shortcuts, display standalone
├── projection.html       Fenêtre de projection 1920×1080 (BroadcastChannel)
├── offline.html          Page de fallback hors ligne
├── icons/
│   ├── icon-192.png      Icône PWA 192×192 — logo NTIC (pains & poissons)
│   ├── icon-512.png      Icône PWA 512×512
│   └── favicon.ico       Favicon multi-résolution (16 / 32 / 48 px)
└── README.md             Ce fichier
```

---

## 🗄️ Base de données — IndexedDB `bible-projector` v2

| Store | Clé | Contenu |
|-------|-----|---------|
| `bibles` | `name` | Données JSON des versions bibliques importées |
| `songs` | `id` (autoIncrement) | Chants avec titre, auteur, strophes, métadonnées |
| `persons` | `id` (autoIncrement) | Répertoire personnes Lower Third (nom, titre) |
| `settings` | `key` | Paramètres persistants (police, taille, alignement…) |
| `favorites` | `id` (autoIncrement) | Favoris versets & chants, étiquettes, index `by_ref` + `by_label` |

---

## ✅ User Stories livrées

| US | Titre | Statut |
|----|-------|--------|
| US-01 | Architecture PWA de base — Service Worker, offline, manifest | ✅ |
| US-02 | IndexedDB — stores `bibles`, `songs`, `persons`, `settings` | ✅ |
| US-03 | Onglet Bible — navigation Livre → Chapitre → Verset | ✅ |
| US-04 | Onglet Chants — CRUD complet, strophes, aperçu slides | ✅ |
| US-05 | Fenêtre Projection — BroadcastChannel, 1920×1080 | ✅ |
| US-06 | Favoris + Recherche plein texte (store `favorites`) | ✅ |
| US-07 | Paramètres — police, taille, couleurs, style Lower Third | ✅ |
| US-08 | Projection Chants via BroadcastChannel | ✅ |
| US-09 | Projection Versets via BroadcastChannel | ✅ |
| US-10 | Lower Third — CRUD personnes, styles `ictheme` / `tourpac` | ✅ |
| US-11 | Picture-in-Picture Preview (miroir projection in-app) | ✅ |
| US-12 | Recherche par référence + correction de frappe (Levenshtein) | ✅ |
| US-13 | Alignement texte chants — Gauche / Centre / Droite | ✅ |
| **B-02** | Logo NTIC officiel (pains & poissons) · SW cache v3 → **v4** | ✅ |

---

## 🔧 Architecture technique

| Composant | Stratégie | Détails |
|-----------|-----------|---------|
| Service Worker | Cache-First | Pre-cache INSTALL → sert depuis cache → fallback réseau → `offline.html` |
| Cache | `bible-projector-v4` | Versionnée, nettoyage auto à ACTIVATE |
| Projection | `BroadcastChannel` | Canal `projection-channel` · fallback `postMessage` si non supporté |
| SPA Routing | Vanilla JS | `data-tab` attributes, `history.replaceState`, deep link `?tab=` |
| Base de données | IndexedDB v2 | Classe `BibleDB`, 5 stores, migrations versionnées |
| Réseau | `online` / `offline` events | Indicateur LED animé dans le header |
| PIP Preview | `BroadcastChannel` miroir | Fenêtre réduite reflétant l'écran de projection |
| Mises à jour | Toast UI | `updatefound` SW → bouton "Mettre à jour" |

---

## 🎙 Lower Third — Styles broadcast

Deux styles disponibles, sélectionnables depuis l'onglet **Lower Third** ou les **Paramètres** :

| Style | ID | Description | Usage |
|-------|----|-------------|-------|
| ICC Badge Gauche | `ictheme` | Bandeau bleu/doré ancré à gauche, badge référence | Services ICC reguliers |
| Tour PAC | `tourpac` | Bandeau couleurs Congo-Brazzaville, animation wipe | Campagne Tour PAC (Pour l'Amour du Congo) |

Animations : `slideInUp` · `slideOutDown` · `fadeInScaleLeft` · `wipe-in/out` · `text-in/out`

---

## 📱 Test Offline

1. Ouvrir `http://localhost:8080` dans Chrome
2. **DevTools** (`F12`) → onglet **Application**
3. **Service Workers** → cocher **Offline**
4. Rafraîchir (`F5`) → l'app charge depuis le cache
5. Naviguer hors scope → `offline.html` s'affiche

---

## 📲 Installation PWA

### Chrome / Edge
1. Ouvrir `http://localhost:8080`
2. Icône **Install** (⊕) dans la barre d'adresse → **Installer "NTIC Bible Projector"**
3. S'ouvre sans barre d'adresse (mode `standalone`)

### Android
Menu Chrome → **Ajouter à l'écran d'accueil**

### iOS (Safari)
Partager (□↑) → **Sur l'écran d'accueil**

---

## ✅ Checklist de Validation

### Fonctionnel
- [ ] App charge sans erreur console
- [ ] Service Worker installé (DevTools → Application → SW → `bible-projector-v4`)
- [ ] Mode offline : app charge depuis le cache
- [ ] Mode offline : `offline.html` affiché sur navigation inconnue
- [ ] PWA installable (icône ⊕ dans Chrome)
- [ ] Logo NTIC (pains & poissons dorés) visible dans le header
- [ ] Favicon NTIC visible dans l'onglet navigateur
- [ ] 5 onglets opérationnels : Bible · Favoris · Chants · Lower Third · Paramètres
- [ ] Deep link `?tab=songs` charge le bon onglet
- [ ] Indicateur Online/Offline (● vert/rouge) réactif
- [ ] Toast de mise à jour SW s'affiche lors d'un update
- [ ] Fenêtre Projection s'ouvre en 1920×1080
- [ ] BroadcastChannel : verset/chant projeté en temps réel
- [ ] PIP Preview reflète la projection
- [ ] Lower Third affiché/masqué depuis l'onglet dédié
- [ ] Changement style LT (ictheme ↔ tourpac) sans rechargement
- [ ] Recherche plein texte + correction de frappe (Levenshtein)
- [ ] Alignement chants (G/C/D) persisté en IndexedDB

### Qualité
- [ ] Zéro erreur W3C (validator.w3.org)
- [ ] Zéro 404 en console
- [ ] Responsive : 375px · 768px · 1024px · 1920px
- [ ] Contraste texte ≥ 4.5:1 (WCAG AA)
- [ ] Navigation clavier visible (Tab)
- [ ] Manifest valide (web.dev/measure)

### Performance
- [ ] Premier affichage < 1 s (localhost)
- [ ] INSTALL SW < 500 ms
- [ ] Taille ZIP < 600 KB (hors données bibliques)

---

## 📦 Dépendances

**Aucune dépendance runtime.** Vanilla JS · CSS natif · IndexedDB natif · BroadcastChannel natif.

La police `Sora` est chargée via Google Fonts CDN — le CSS utilise `system-ui` comme fallback offline.  
Le logo NTIC est embarqué en **base64** directement dans `index.html` (aucun fichier externe requis pour l'affichage).

---

## 🚀 Prochaines étapes possibles

| Priorité | Fonctionnalité |
|----------|----------------|
| 🔴 Haute | Import de données bibliques JSON (onglet Paramètres → importer) |
| 🔴 Haute | Export favoris JSON (sauvegarde / partage) |
| 🟡 Moyenne | Styles Lower Third additionnels (Neon, Exousia, Fragments) |
| 🟡 Moyenne | Multi-fenêtre projection (écran secondaire API) |
| 🟢 Basse | Thème clair / sombre commutable |
| 🟢 Basse | Notifications push pour rappels de service |

---

## 📄 Licence

© 2025 NTIC Makabandilou — Usage interne ICC · Brazzaville, République du Congo.
