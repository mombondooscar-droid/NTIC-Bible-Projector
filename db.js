/**
 * ============================================================
 *  NTIC BIBLE PROJECTOR — db.js
 *  BibleDB : wrapper IndexedDB
 *  Version : 2.0  |  Sprint : US-06 (ajout store favorites)
 * ============================================================
 *
 *  Stores :
 *    - bibles   : données des bibles JSON importées
 *    - songs    : chants avec strophes
 *    - persons  : Lower Third personnes
 *    - settings : paramètres clé/valeur
 *    - favorites: favoris versets + chants  ← US-06 nouveau
 */

class BibleDB {
  // ── Configuration ──────────────────────────────────────────
  static DB_NAME    = 'bible-projector';
  static DB_VERSION = 2; // v2 : ajout du store favorites

  constructor() {
    this._db          = null;
    this._openPromise = null;
  }

  // ── Ouverture / initialisation ──────────────────────────────
  /**
   * Ouvre la base de données (singleton).
   * Appelée une seule fois au démarrage via init() dans app.js.
   */
  async open() {
    if (this._db)          return this._db;
    if (this._openPromise) return this._openPromise;

    this._openPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(BibleDB.DB_NAME, BibleDB.DB_VERSION);

      req.onupgradeneeded = (e) =>
        this._upgradeDB(e.target.result, e.oldVersion);

      req.onsuccess = (e) => {
        this._db = e.target.result;
        // Gestion des fermetures inattendues
        this._db.onversionchange = () => this._db.close();
        resolve(this._db);
      };

      req.onerror   = (e) => reject(e.target.error);
      req.onblocked = ()  => console.warn('[BibleDB] DB bloquée par un autre onglet');
    });

    return this._openPromise;
  }

  /**
   * Crée / met à jour les object stores selon la version.
   * Chaque bloc "if (oldVersion < N)" s'exécute en migration incrémentale.
   */
  _upgradeDB(db, oldVersion) {
    // ── Version 1 : stores d'origine (US-02) ─────────────────
    if (oldVersion < 1) {
      // Bibles : clé = nom du fichier (ex: "LSG", "KJV")
      if (!db.objectStoreNames.contains('bibles')) {
        const s = db.createObjectStore('bibles', { keyPath: 'name' });
        s.createIndex('by_name', 'name', { unique: true });
      }

      // Chants : id auto-increment
      if (!db.objectStoreNames.contains('songs')) {
        const s = db.createObjectStore('songs', {
          keyPath: 'id', autoIncrement: true,
        });
        s.createIndex('by_title', 'title', { unique: false });
      }

      // Personnes Lower Third : id auto-increment
      if (!db.objectStoreNames.contains('persons')) {
        const s = db.createObjectStore('persons', {
          keyPath: 'id', autoIncrement: true,
        });
        s.createIndex('by_nom', 'nom', { unique: false });
      }

      // Paramètres : clé/valeur générique
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    }

    // ── Version 2 : store favorites (US-06) ──────────────────
    if (oldVersion < 2) {
      if (!db.objectStoreNames.contains('favorites')) {
        const s = db.createObjectStore('favorites', {
          keyPath: 'id', autoIncrement: true,
        });
        // Index par type : 'verse' | 'song'
        s.createIndex('by_type',  'type',  { unique: false });
        // Index par étiquette libre
        s.createIndex('by_label', 'label', { unique: false });
        // Index par référence unique ("Jean_3_16" ou "song_42")
        s.createIndex('by_ref',   'ref',   { unique: true  });
      }
    }
  }

  // ── Helper interne : obtenir la DB ouverte ─────────────────
  async _getDB() {
    return this._db || this.open();
  }

  // ══════════════════════════════════════════════════════════
  //  BIBLES
  // ══════════════════════════════════════════════════════════

  /** Sauvegarde (insert ou replace) une bible complète. */
  async saveBible(name, data) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction('bibles', 'readwrite');
      const req = tx.objectStore('bibles').put({ name, data });
      req.onsuccess = () => resolve();
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  /** Retourne les données JSON d'une bible, ou null si absente. */
  async getBible(name) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction('bibles', 'readonly');
      const req = tx.objectStore('bibles').get(name);
      req.onsuccess = (e) => resolve(e.target.result?.data ?? null);
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  /** Retourne la liste des noms de bibles importées. */
  async getAllBibleNames() {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction('bibles', 'readonly');
      const req = tx.objectStore('bibles').getAllKeys();
      req.onsuccess = (e) => resolve(e.target.result ?? []);
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  /** Supprime une bible par son nom. */
  async deleteBible(name) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction('bibles', 'readwrite');
      const req = tx.objectStore('bibles').delete(name);
      req.onsuccess = () => resolve();
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  // ══════════════════════════════════════════════════════════
  //  CHANTS
  // ══════════════════════════════════════════════════════════

  /**
   * Crée ou met à jour un chant.
   * Si song.id est absent → add (nouveau), sinon → put (mise à jour).
   * @returns {Promise<number>} id du chant sauvegardé
   */
  async saveSong(song) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx   = db.transaction('songs', 'readwrite');
      const data = {
        ...song,
        modified: Date.now(),
        created:  song.created ?? Date.now(),
      };
      const req = data.id ? tx.objectStore('songs').put(data)
                          : tx.objectStore('songs').add(data);
      req.onsuccess = (e) => resolve(e.target.result); // retourne l'id
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  /** Retourne un chant par id, ou null. */
  async getSong(id) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction('songs', 'readonly');
      const req = tx.objectStore('songs').get(Number(id));
      req.onsuccess = (e) => resolve(e.target.result ?? null);
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  /** Retourne tous les chants (non triés). */
  async getAllSongs() {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction('songs', 'readonly');
      const req = tx.objectStore('songs').getAll();
      req.onsuccess = (e) => resolve(e.target.result ?? []);
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  /** Supprime un chant par id. */
  async deleteSong(id) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction('songs', 'readwrite');
      const req = tx.objectStore('songs').delete(Number(id));
      req.onsuccess = () => resolve();
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  // ══════════════════════════════════════════════════════════
  //  PERSONNES (LOWER THIRD)
  // ══════════════════════════════════════════════════════════

  /**
   * Crée ou met à jour une personne.
   * @returns {Promise<number>} id de la personne sauvegardée
   */
  async savePerson(person) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx   = db.transaction('persons', 'readwrite');
      const data = { ...person, createdAt: person.createdAt ?? Date.now() };
      const req  = data.id ? tx.objectStore('persons').put(data)
                           : tx.objectStore('persons').add(data);
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  /** Retourne une personne par id, ou null. */
  async getPerson(id) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction('persons', 'readonly');
      const req = tx.objectStore('persons').get(Number(id));
      req.onsuccess = (e) => resolve(e.target.result ?? null);
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  /** Retourne toutes les personnes. */
  async getAllPersons() {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction('persons', 'readonly');
      const req = tx.objectStore('persons').getAll();
      req.onsuccess = (e) => resolve(e.target.result ?? []);
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  /** Supprime une personne par id. */
  async deletePerson(id) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction('persons', 'readwrite');
      const req = tx.objectStore('persons').delete(Number(id));
      req.onsuccess = () => resolve();
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  // ══════════════════════════════════════════════════════════
  //  PARAMÈTRES
  // ══════════════════════════════════════════════════════════

  /** Sauvegarde un paramètre (upsert). */
  async saveSetting(key, value) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction('settings', 'readwrite');
      const req = tx.objectStore('settings').put({ key, value });
      req.onsuccess = () => resolve();
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  /**
   * Lit un paramètre.
   * @param {string} key
   * @param {*}      defaultValue  Valeur retournée si absente
   */
  async getSetting(key, defaultValue = null) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction('settings', 'readonly');
      const req = tx.objectStore('settings').get(key);
      req.onsuccess = (e) =>
        resolve(e.target.result !== undefined ? e.target.result.value : defaultValue);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  // ══════════════════════════════════════════════════════════
  //  FAVORIS  (US-06)
  // ══════════════════════════════════════════════════════════

  /**
   * Ajoute ou met à jour un favori (upsert par ref).
   *
   * Schéma attendu :
   * {
   *   type:    'verse' | 'song',
   *   ref:     String,   // ex: "Jean_3_16" | "song_42"
   *   label:   String,   // étiquette libre, défaut ""
   *   title:   String,   // ex: "Jean 3:16"
   *   content: String,   // aperçu texte
   *   createdAt: Number  // Date.now() (auto si absent)
   * }
   *
   * @returns {Promise<number>} id du favori
   */
  async addFavorite(item) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction('favorites', 'readwrite');
      const store = tx.objectStore('favorites');
      const idx   = store.index('by_ref');

      // Vérifier si ce ref existe déjà (pour conserver createdAt)
      const getReq = idx.get(item.ref);

      getReq.onsuccess = (e) => {
        const existing = e.target.result;
        const data = {
          ...item,
          label:     item.label     ?? '',
          createdAt: existing?.createdAt ?? Date.now(),
        };
        // Si existant, on conserve son id pour faire un put
        if (existing) data.id = existing.id;

        const putReq = store.put(data);
        putReq.onsuccess = (e) => resolve(e.target.result);
        putReq.onerror   = (e) => reject(e.target.error);
      };

      getReq.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Supprime un favori par sa référence unique.
   * Ne lève pas d'erreur si absent.
   * @param {string} ref
   */
  async removeFavorite(ref) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction('favorites', 'readwrite');
      const store = tx.objectStore('favorites');
      const idx   = store.index('by_ref');

      const getReq = idx.get(ref);
      getReq.onsuccess = (e) => {
        const item = e.target.result;
        if (!item) { resolve(); return; }

        const delReq = store.delete(item.id);
        delReq.onsuccess = () => resolve();
        delReq.onerror   = (e) => reject(e.target.error);
      };
      getReq.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Vérifie si un ref est déjà en favori.
   * @param   {string}  ref
   * @returns {Promise<boolean>}
   */
  async isFavorite(ref) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction('favorites', 'readonly');
      const store = tx.objectStore('favorites');
      const req   = store.index('by_ref').count(ref);
      req.onsuccess = (e) => resolve(e.target.result > 0);
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  /**
   * Retourne tous les favoris, triés par date décroissante (plus récent en premier).
   * @returns {Promise<Array>}
   */
  async getAllFavorites() {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction('favorites', 'readonly');
      const req = tx.objectStore('favorites').getAll();
      req.onsuccess = (e) => {
        const items = e.target.result ?? [];
        items.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
        resolve(items);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Retourne les favoris filtrés par étiquette, triés par date décroissante.
   * @param   {string} label
   * @returns {Promise<Array>}
   */
  async getFavoritesByLabel(label) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction('favorites', 'readonly');
      const req = tx.objectStore('favorites').index('by_label').getAll(label);
      req.onsuccess = (e) => {
        const items = e.target.result ?? [];
        items.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
        resolve(items);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Met à jour l'étiquette d'un favori identifié par son ref.
   * @param {string} ref
   * @param {string} newLabel
   */
  async updateFavoriteLabel(ref, newLabel) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction('favorites', 'readwrite');
      const store = tx.objectStore('favorites');
      const idx   = store.index('by_ref');

      const getReq = idx.get(ref);
      getReq.onsuccess = (e) => {
        const item = e.target.result;
        if (!item) { resolve(); return; }

        item.label     = newLabel ?? '';
        const putReq   = store.put(item);
        putReq.onsuccess = () => resolve();
        putReq.onerror   = (e) => reject(e.target.error);
      };
      getReq.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Exporte tous les favoris sous forme de JSON formaté.
   * Format conforme à la spec US-06.
   * @returns {Promise<string>} JSON string (pretty-print)
   */
  async exportFavoritesJSON() {
    const favorites = await this.getAllFavorites();
    const payload   = {
      export: {
        app:        'NTIC Bible Projector',
        version:    '1.0-sp6',
        exportedAt: new Date().toISOString(),
        count:      favorites.length,
      },
      favorites: favorites.map((f) => ({
        type:      f.type      ?? 'verse',
        ref:       f.ref       ?? '',
        label:     f.label     ?? '',
        title:     f.title     ?? '',
        content:   f.content   ?? '',
        createdAt: f.createdAt ?? 0,
      })),
    };
    return JSON.stringify(payload, null, 2);
  }
}

// ── Singleton global — utilisé dans app.js via window.db ──────
const db = new BibleDB();