# NTIC Bible Projector

Application PWA de projection pour églises et conférences.  
Permet d’afficher des versets bibliques, des chants et des lower thirds (nom/titre) sur un écran externe (projecteur, OBS, …) via 4 fenêtres indépendantes.

---

## 🚀 Démarrage rapide

1. **Télécharger** ou **cloner** le projet.
2. **Ouvrir `index.html`** dans un navigateur moderne (Chrome, Edge, Firefox, Safari).
3. La première fois, l’application s’installe comme une **PWA** (icône disponible sur mobile/desktop).
4. **Importer une Bible** (format JSON) dans l’onglet `⚙️ Paramètres`.
5. **Ouvrir les fenêtres de projection** via le bouton `🖥 Projection` (4 fenêtres popup).
6. Cliquer sur un verset ou une strophe → projection instantanée.

---

## 📚 Fonctionnalités principales

| Module | Description |
|--------|-------------|
| **Bible** | Navigation livres/chapitres/versets, recherche par mot-clé ou référence, segmentation des versets longs, projection plein écran ou lower‑third, surlignage, mode bilingue (côte‑à‑côte ou alternance). |
| **Chants** | Création/édition de chants (format strophes + traductions avec `*`), aperçu strophe par strophe, projection sur l’écran chant dédié. |
| **Favoris** | Marquage de versets ou chants, étiquetage, filtrage, export JSON. |
| **Lower Third** | Gestion des personnes (nom + titre), projection immédiate, deux styles visuels (ICC Graduation / Tourpac), aperçu en direct. |
| **Paramètres** | Import/export configuration, réglages des polices, couleurs, tailles, thème clair Tourpac, gestion des Bibles importées. |

---

## 🖥 Fenêtres de projection

L’application ouvre **4 fenêtres indépendantes** :

- `projection-bible.html` : affichage plein écran du verset (diapositive) + mode dual.
- `projection-chant.html` : paroles du chant + navigation strophes.
- `projection-lt-verset.html` : lower‑third pour le verset en cours.
- `projection-lt-personne.html` : lower‑third pour la personne sélectionnée.

La communication entre fenêtres utilise **BroadcastChannel** (avec fallback `localStorage` si nécessaire).  
Toutes les fenêtres se referment/réouvrent automatiquement si vous recliquez sur `🖥 Projection`.

---

## ⌨️ Raccourcis clavier

| Touche | Action |
|--------|--------|
| `→` / `←` | Verset suivant / précédent (Bible) – Strophe suivante / précédente (Chants) |
| `↑` / `↓` | Segment suivant / précédent (versets longs) |
| `Espace` | Projeter le verset ou la strophe sélectionné(e) |
| `Échap` | Masquer la projection (mode blank) |

---

## 💾 Persistance et hors‑ligne

- **IndexedDB** : stockage des Bibles, chants, personnes, favoris, paramètres, logs.
- **Service Worker** (cache‑first) : l’application fonctionne hors ligne après la première visite.
- **Verrou cross‑tabs** : évite les conflits d’écriture simultanés.
- **Logs système** : erreurs et événements clés accessibles dans l’onglet Paramètres (export JSON).

---

## 🛠 Installation en tant que PWA

1. Visitez l’application avec **https** (ou `localhost` pour le développement).
2. Cliquez sur l’icône **Install** dans la barre d’adresse (ou `⋮` → `Installer l’application`).
3. L’icône `NTIC Bible Projector` apparaît sur votre bureau / écran d’accueil.
4. Lancez‑la comme une application native (même hors ligne).

---

## 📦 Format des fichiers JSON

- **Bible** : `{ "Genèse": { "1": { "1": "Au commencement…", "2": "…" }, "2": {…} }, … }`
- **Configuration exportée** : objet JSON avec clé `settings` contenant toutes les préférences.

---

## 🧪 Développement

Projet 100% vanilla (pas de framework).  
Structure modulaire : `utils/` pour les helpers, `panels/` pour les onglets, `styles/` pour le CSS.  
Point d’entrée : `index.html` → ordre de chargement strict (voir `ARCHITECTURE.md`).

### Modifier le code

1. Modifiez les fichiers `.js`, `.css`, `.html` à votre convenance.
2. **Incrémentez `CACHE_VERSION`** dans `service-worker.js` pour forcer la mise à jour du cache.
3. Testez en local (serveur http, ex. `npx http-server`).

---

*Pour plus de détails techniques, voir `ARCHITECTURE.md`.*