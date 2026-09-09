# NAGA Bible – README

## 📖 Présentation

**NAGA Bible** est une application web complète de gestion de projection pour églises, conférences et événements. Elle permet à un opérateur (régie) de contrôler l’affichage de versets bibliques, de chants, d’intervenants (lower third), de minuteurs et de diapositives sur un ou plusieurs écrans de projection.

L’application fonctionne en mode « régie » (interface de contrôle) et en mode « écran » (fenêtres de projection). Elle peut être utilisée en local (hors ligne) ou en réseau avec un serveur central pour synchroniser plusieurs postes.

---

## 🚀 Fonctionnalités principales

- **📜 Bible**  
  - Chargement de plusieurs versions bibliques (fichiers JSON).  
  - Navigation par livre, chapitre et verset.  
  - Projection de versets avec **segmentation automatique** (si plus de 30 mots).  
  - **Modes d'affichage** : Normal, Bilingue (deux versions côte à côte), Explicatif (verset principal + verset de référence fixe).  
  - Recherche plein texte et par référence (avec auto‑complétion).  
  - Marque‑pages (favoris) pour les versets.

- **🎵 Chants**  
  - Création, édition et suppression de chants.  
  - Gestion des strophes avec traduction (`*ligne`).  
  - Projection strophe par strophe avec aperçu « diapositive ».  
  - Favoris pour les chants.

- **👤 Intervenants (Lower Third)**  
  - Gestion d’un répertoire de personnes (nom, titre).  
  - Projection instantanée d’un intervenant (style ICC Graduation ou Tour PAC).  
  - Mode impromptu (sans sauvegarde).  
  - Aperçu en direct du lower third.

- **⏱ Minuteurs**  
  - Création de minuteurs (countdown, heure spécifique, date spécifique, horloge).  
  - Contrôle : Démarrer, Pause, Arrêter, Réinitialiser.  
  - Seuils d’alerte (avertissement / critique) avec clignotement.  
  - Diffusion en temps réel sur les écrans de projection.

- **⭐ Favoris**  
  - Centralisation des versets et chants favoris.  
  - Étiquetage et filtrage.  
  - Projection directe depuis les favoris.

- **⚙️ Paramètres**  
  - Personnalisation complète des styles (couleurs, polices, tailles, alignements) pour chaque mode.  
  - Gestion des Bibles (import/export, suppression).  
  - Configuration réseau (serveur, relais WebSocket).  
  - Sauvegarde et restauration complète des données (JSON).

- **🌐 Mode réseau**  
  - Serveur central (HTTP + WebSocket) pour synchroniser plusieurs régies et écrans.  
  - Découverte automatique du serveur (localhost / IP).  
  - Clé API pour sécuriser les échanges.

---

## 🛠 Technologies

- **Frontend** :  
  - HTML5, CSS3 (variables, animations, responsive)  
  - JavaScript (Vanilla) – architecture modulaire.  
  - `BroadcastChannel` pour la communication entre fenêtres (régie ↔ écrans).  

- **Stockage local** :  
  - IndexedDB (via une couche d’abstraction `db.js`).  

- **Serveur** (optionnel) :  
  - Python 3.8+ avec `aiohttp` (WebSocket et HTTP).  

- **Hors ligne** :  
  - Service Worker pour la mise en cache et la disponibilité hors ligne.

---

## 📦 Installation

### Prérequis
- Navigateur moderne (Chrome, Edge, Firefox, Safari) avec support de `BroadcastChannel`.
- (Optionnel) Python 3.8+ pour le serveur.

### Étapes

1. **Cloner le dépôt** :
   ```bash
   git clone https://github.com/votre-org/naga-bible.git
   cd naga-bible
   ```

2. **Installer les dépendances du serveur** (si utilisation réseau) :
   ```bash
   pip install aiohttp
   ```

3. **Configurer la clé API** (recommandé pour le serveur) :
   - Dans votre terminal, définir la variable d’environnement :
     ```bash
     export NAGA_API_KEY="votre_cle_secrete"
     ```
   - Par défaut, la clé est `dev-key` (non sécurisée en production).

4. **Lancer le serveur** (optionnel) :
   ```bash
   python server.py
   ```
   Le serveur démarre sur `http://0.0.0.0:8080`.  
   - `http://localhost:8080/status` – état du serveur.  
   - WebSocket sur `ws://localhost:8080/ws?apiKey=votre_cle`.

5. **Ouvrir l’application cliente** :
   - Placez les fichiers dans un serveur web statique (ex: `python -m http.server 8000`) ou ouvrez directement `index.html` (attention aux CORS).  
   - L’application détectera automatiquement le serveur si présent.

---

## 🧭 Utilisation

### Interface régie
- L’interface principale est divisée en onglets : **Bible**, **Chants**, **Intervenants**, **Minuteurs**, **Paramètres**.
- Cliquez sur un onglet pour accéder à ses fonctionnalités.

### Projection sur écrans
- Ouvrez une fenêtre de projection (ex: `projection-bible.html`) dans un autre onglet ou une autre fenêtre.
- La régie envoie les commandes via `BroadcastChannel` ; les écrans affichent le contenu en temps réel.
- Si le serveur est actif, les messages sont relayés à toutes les fenêtres connectées.

### Raccourcis clavier
- Dans l’onglet Bible, les flèches **↑** et **↓** permettent de naviguer entre les segments ou les versets.  
- La barre d’espace peut être utilisée pour projeter le verset sélectionné.

---

## 🔒 Sécurité

- **Clé API** : Toutes les requêtes vers le serveur (HTTP et WebSocket) doivent inclure la clé API.  
  - HTTP : en‑tête `X-API-Key`.  
  - WebSocket : paramètre d’URL `?apiKey=...`.  
- Le serveur rejette toute connexion sans clé valide.
- La clé par défaut (`dev-key`) est à changer impérativement en production.

---

## 📁 Structure du projet

```
/
├── index.html                 # Interface régie
├── projection-*.html          # Fenêtres de projection (bible, chant, lt, timer)
├── sw.js                      # Service Worker
├── styles/                    # CSS (base, animations, panels, responsive, components)
├── scripts/
│   ├── app.js                 # Point d’entrée de l’application
│   ├── utils/                 # Helpers, services (dataService, timerManager, dom, etc.)
│   ├── panels/                # Modules d’interface (Bible, Chants, LT, Timers, Settings)
│   └── constants.js           # ICONS, FONTS, SETTINGS_KEYS, etc.
├── server.py                  # Serveur Python (optionnel)
└── README.md
```

---

## 👨‍💻 Développement

### Ajouter une nouvelle Bible
- Le format attendu est un objet JSON avec la structure :
  ```json
  {
    "Genèse": {
      "1": { "1": "Au commencement...", "2": "..." },
      "2": { ... }
    },
    ...
  }
  ```
- Importer le fichier via l’onglet Paramètres → Gérer les Bibles.

### Ajouter un nouveau type de contenu
- Créez un panneau dans `scripts/panels/`.
- Définissez une fonction `renderXxxPanel(container)`.
- Ajoutez un onglet dans `index.html` et l’appel correspondant dans `navigateTo()`.

### Modifier les styles
- Les variables CSS sont dans `styles/base.css` (thème sombre).
- Les composants sont factorisés dans `components.css`.

### Tester les modifications
- Utilisez un serveur statique local (ex: `live-server`).
- Assurez-vous que `BroadcastChannel` fonctionne (ouvrez plusieurs onglets).

---

## 🤝 Contribution

Les contributions sont les bienvenues !  
- Signalez les bugs via les issues.  
- Proposez des améliorations via des pull requests.  
- Respectez le style de code existant (fonctions globales, conventions de nommage).

---

## 📄 Licence

Ce projet est distribué sous licence MIT.  
Voir le fichier `LICENSE` pour plus d’informations.

---

## 📬 Contact

Pour toute question, contactez l’équipe NAGA à l’adresse suivante :  
✉️ mombondooscar@gmail.com
