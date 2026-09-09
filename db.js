/**
 * ============================================================
 *  NTIC BIBLE PROJECTOR — db.js
 *  BibleDB : wrapper IndexedDB
 *  Version : 7.0  |  Sprint : Sujet 3 + Sujet 8 (timers enrichis)
 * ============================================================
 *
 *  Stores :
 *    - bibles   : données des bibles JSON importées
 *    - songs    : chants avec strophes
 *    - persons  : Lower Third personnes
 *    - settings : paramètres clé/valeur
 *    - favorites: favoris versets + chants
 *    - logs     : journal système
 *    - timers   : minuteurs (champs enrichis pour Sujet 8)
 */

class BibleDB {
  static DB_NAME    = 'bible-projector';
  static DB_VERSION = 7;

  constructor() {
    this._db          = null;
    this._openPromise = null;
  }

  async open() {
    if (this._db) return this._db;
    if (this._openPromise) return this._openPromise;

    this._openPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(BibleDB.DB_NAME, BibleDB.DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        const transaction = e.target.transaction;
        this._upgradeDB(db, e.oldVersion, transaction);
      };

      req.onsuccess = (e) => {
        this._db = e.target.result;
        this._db.onversionchange = () => this._db.close();
        resolve(this._db);
      };

      req.onerror   = (e) => reject(e.target.error);
      req.onblocked = () => console.warn('[BibleDB] DB bloquée par un autre onglet');
    });

    return this._openPromise;
  }

  _upgradeDB(db, oldVersion, transaction) {
    // Version 1 à 5 : comme avant
    if (oldVersion < 1) {
      if (!db.objectStoreNames.contains('bibles')) {
        const s = db.createObjectStore('bibles', { keyPath: 'name' });
        s.createIndex('by_name', 'name', { unique: true });
      }
      if (!db.objectStoreNames.contains('songs')) {
        const s = db.createObjectStore('songs', { keyPath: 'id', autoIncrement: true });
        s.createIndex('by_title', 'title', { unique: false });
      }
      if (!db.objectStoreNames.contains('persons')) {
        const s = db.createObjectStore('persons', { keyPath: 'id', autoIncrement: true });
        s.createIndex('by_nom', 'nom', { unique: false });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    }
    if (oldVersion < 2) {
      if (!db.objectStoreNames.contains('favorites')) {
        const s = db.createObjectStore('favorites', { keyPath: 'id', autoIncrement: true });
        s.createIndex('by_type',  'type',  { unique: false });
        s.createIndex('by_label', 'label', { unique: false });
        s.createIndex('by_ref',   'ref',   { unique: true });
      }
    }
    if (oldVersion < 3) {
      if (!db.objectStoreNames.contains('logs')) {
        const s = db.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
        s.createIndex('by_ts', 'ts', { unique: false });
        s.createIndex('by_level', 'level', { unique: false });
      }
    }
    if (oldVersion < 4) {
      const songsStore = transaction.objectStore('songs');
      if (!songsStore.indexNames.contains('by_author')) {
        songsStore.createIndex('by_author', 'author', { unique: false });
      }
    }
    if (oldVersion < 5) {
      if (!db.objectStoreNames.contains('timers')) {
        const s = db.createObjectStore('timers', { keyPath: 'id' });
        s.createIndex('by_order',   'order',  { unique: false });
        s.createIndex('by_status',  'status', { unique: false });
        s.createIndex('by_visible', 'visibleOnStage', { unique: false });
      }
    }
    // Version 6 : ajout des méthodes clear (Sujet 3) — déjà fait sans changer le schéma
    // Version 7 : ajout d'index pour les nouveaux champs
    if (oldVersion < 7) {
      const timerStore = transaction.objectStore('timers');
      if (!timerStore.indexNames.contains('by_mode')) {
        timerStore.createIndex('by_mode', 'mode', { unique: false });
      }
      // by_status existe déjà, on le conserve
      // on peut ajouter by_warning_threshold si besoin, mais pas obligatoire
    }
  }

  async _getDB() {
    return this._db || this.open();
  }

  // ─── LOGS ────────────────────────────────────────────────
  async log(level, message, data = null) {
    try {
      const db = await this._getDB();
      const tx = db.transaction('logs', 'readwrite');
      const store = tx.objectStore('logs');
      store.add({ level, message, data, ts: Date.now() });
      store.count().onsuccess = (e) => {
        const count = e.target.result;
        if (count > 200) {
          const toDelete = count - 200;
          const getAllReq = store.getAll();
          getAllReq.onsuccess = () => {
            const all = getAllReq.result;
            all.sort((a, b) => a.id - b.id);
            for (let i = 0; i < toDelete; i++) {
              store.delete(all[i].id);
            }
          };
        }
      };
    } catch (err) {
      console.warn('[BibleDB] Échec écriture log:', err);
    }
  }

  async getAllLogs() {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('logs', 'readonly');
      const req = tx.objectStore('logs').getAll();
      req.onsuccess = () => {
        const logs = req.result || [];
        logs.sort((a, b) => b.ts - a.ts);
        resolve(logs);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  // ─── BIBLES ──────────────────────────────────────────────
  async saveBible(name, data) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('bibles', 'readwrite');
      const req = tx.objectStore('bibles').put({ name, data });
      req.onsuccess = () => resolve();
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  async getBible(name) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('bibles', 'readonly');
      const req = tx.objectStore('bibles').get(name);
      req.onsuccess = (e) => resolve(e.target.result?.data ?? null);
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  async getAllBibleNames() {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('bibles', 'readonly');
      const req = tx.objectStore('bibles').getAllKeys();
      req.onsuccess = (e) => resolve(e.target.result ?? []);
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  async deleteBible(name) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('bibles', 'readwrite');
      const req = tx.objectStore('bibles').delete(name);
      req.onsuccess = () => resolve();
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  // ─── CHANTS ──────────────────────────────────────────────
  async saveSong(song) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('songs', 'readwrite');
      const data = { ...song, modified: Date.now(), created: song.created ?? Date.now() };
      const req = data.id ? tx.objectStore('songs').put(data) : tx.objectStore('songs').add(data);
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  async getSong(id) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('songs', 'readonly');
      const req = tx.objectStore('songs').get(Number(id));
      req.onsuccess = (e) => resolve(e.target.result ?? null);
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  async getAllSongs() {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('songs', 'readonly');
      const req = tx.objectStore('songs').getAll();
      req.onsuccess = (e) => {
        const songs = e.target.result ?? [];
        songs.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? '', 'fr', { sensitivity: 'base' }));
        resolve(songs);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async searchSongsByTitle(query) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('songs', 'readonly');
      const idx = tx.objectStore('songs').index('by_title');
      const range = query ? IDBKeyRange.bound(query, query + '\uffff', false, false) : null;
      const req = range ? idx.openCursor(range) : idx.openCursor();
      const results = [];
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) { results.push(cursor.value); cursor.continue(); }
        else resolve(results);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async searchSongs(query) {
    const all = await this.getAllSongs();
    const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return all.filter(s => {
      const title = (s.title || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const author = (s.author || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return title.includes(q) || author.includes(q);
    });
  }

  async deleteSong(id) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('songs', 'readwrite');
      const req = tx.objectStore('songs').delete(Number(id));
      req.onsuccess = () => resolve();
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  // ─── PERSONNES ────────────────────────────────────────────
  async savePerson(person) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('persons', 'readwrite');
      const data = { ...person, createdAt: person.createdAt ?? Date.now() };
      const req = data.id ? tx.objectStore('persons').put(data) : tx.objectStore('persons').add(data);
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  async getPerson(id) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('persons', 'readonly');
      const req = tx.objectStore('persons').get(Number(id));
      req.onsuccess = (e) => resolve(e.target.result ?? null);
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  async getAllPersons() {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('persons', 'readonly');
      const req = tx.objectStore('persons').getAll();
      req.onsuccess = (e) => resolve(e.target.result ?? []);
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  async deletePerson(id) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('persons', 'readwrite');
      const req = tx.objectStore('persons').delete(Number(id));
      req.onsuccess = () => resolve();
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  // ─── PARAMÈTRES ────────────────────────────────────────────
  async saveSetting(key, value) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('settings', 'readwrite');
      const req = tx.objectStore('settings').put({ key, value });
      req.onsuccess = () => resolve();
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  async getSetting(key, defaultValue = null) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('settings', 'readonly');
      const req = tx.objectStore('settings').get(key);
      req.onsuccess = (e) => resolve(e.target.result !== undefined ? e.target.result.value : defaultValue);
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  // Ajout audit R11 : requis par dataService.getAllSettings() / syncAllFromServer()
  async getAllSettings() {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('settings', 'readonly');
      const req = tx.objectStore('settings').getAll();
      req.onsuccess = (e) => resolve(e.target.result ?? []);
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  // ─── FAVORIS ──────────────────────────────────────────────
  async addFavorite(item) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('favorites', 'readwrite');
      const store = tx.objectStore('favorites');
      const idx = store.index('by_ref');
      const getReq = idx.get(item.ref);
      getReq.onsuccess = (e) => {
        const existing = e.target.result;
        const data = { ...item, label: item.label ?? '', createdAt: existing?.createdAt ?? Date.now() };
        if (existing) data.id = existing.id;
        const putReq = store.put(data);
        putReq.onsuccess = (e) => resolve(e.target.result);
        putReq.onerror   = (e) => reject(e.target.error);
      };
      getReq.onerror = (e) => reject(e.target.error);
    });
  }

  async removeFavorite(ref) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('favorites', 'readwrite');
      const store = tx.objectStore('favorites');
      const idx = store.index('by_ref');
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

  async isFavorite(ref) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('favorites', 'readonly');
      const store = tx.objectStore('favorites');
      const req = store.index('by_ref').count(ref);
      req.onsuccess = (e) => resolve(e.target.result > 0);
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  async getAllFavorites() {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('favorites', 'readonly');
      const req = tx.objectStore('favorites').getAll();
      req.onsuccess = (e) => {
        const items = e.target.result ?? [];
        items.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
        resolve(items);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async getFavoritesByLabel(label) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('favorites', 'readonly');
      const req = tx.objectStore('favorites').index('by_label').getAll(label);
      req.onsuccess = (e) => {
        const items = e.target.result ?? [];
        items.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
        resolve(items);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async updateFavoriteLabel(ref, newLabel) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('favorites', 'readwrite');
      const store = tx.objectStore('favorites');
      const idx = store.index('by_ref');
      const getReq = idx.get(ref);
      getReq.onsuccess = (e) => {
        const item = e.target.result;
        if (!item) { resolve(); return; }
        item.label = newLabel ?? '';
        const putReq = store.put(item);
        putReq.onsuccess = () => resolve();
        putReq.onerror   = (e) => reject(e.target.error);
      };
      getReq.onerror = (e) => reject(e.target.error);
    });
  }

  async exportFavoritesJSON() {
    const favorites = await this.getAllFavorites();
    const payload = {
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

  // ─── TIMERS (version enrichie pour Sujet 8) ──────────────
  async saveTimer(timer) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('timers', 'readwrite');
      const store = tx.objectStore('timers');
      const data = {
        ...timer,
        updatedAt: Date.now(),
        createdAt: timer.createdAt ?? Date.now(),
        // S'assurer que les nouveaux champs existent (migration)
        mode: timer.mode || 'countdown',
        targetTimestamp: timer.targetTimestamp || null,
        warningThreshold: timer.warningThreshold || 60,
        criticalThreshold: timer.criticalThreshold || 10,
        format: timer.format || 'auto',
        alertMessage: timer.alertMessage || '',
        blink: timer.blink || false,
      };
      const req = store.put(data);
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  async getTimer(id) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('timers', 'readonly');
      const req = tx.objectStore('timers').get(id);
      req.onsuccess = (e) => resolve(e.target.result ?? null);
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  async getAllTimers() {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('timers', 'readonly');
      const req = tx.objectStore('timers').getAll();
      req.onsuccess = (e) => {
        const timers = e.target.result ?? [];
        timers.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        resolve(timers);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async deleteTimer(id) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('timers', 'readwrite');
      const req = tx.objectStore('timers').delete(id);
      req.onsuccess = () => resolve();
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  async clearAllTimers() {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('timers', 'readwrite');
      const req = tx.objectStore('timers').clear();
      req.onsuccess = () => resolve();
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  // ─── CLEAR METHODS (Sujet 3) ──────────────────────────────
  async clearBibles() { /* ... */ }
  async clearSongs() { /* ... */ }
  async clearPersons() { /* ... */ }
  async clearFavorites() { /* ... */ }
  async clearSettings() { /* ... */ }
}

const db = new BibleDB();