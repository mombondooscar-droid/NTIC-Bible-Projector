/**
 * ============================================================
 *  scripts/utils/dataService.js — Service de données unifié
 *  NTIC Bible Projector · v1.7 (étape 10.2 : clé API dans headers)
 *  + En-tête X-API-Key pour toutes les requêtes HTTP
 *  + Cache mémoire, gestion d'erreurs, etc.
 * ============================================================
 */

const DATA_SERVICE = (() => {
  // ─── État interne ──────────────────────────────────────────
  let _serverAvailable = true;
  let _serverHealthy = true;
  let _lastHealthCheck = 0;
  let _healthCheckInterval = null;
  const HEALTH_CHECK_INTERVAL = 30000;
  const HEALTH_CHECK_TIMEOUT = 3000;
  let _discoveryDone = false;

  // ─── Caches mémoire ──────────────────────────────────────
  const _bibleCache = new Map();
  const _songCache = new Map();
  const _personCache = new Map();
  const _timerCache = new Map();
  let _favoritesCache = null;

  // ─── Helpers ──────────────────────────────────────────────
  function _getServerUrl() {
    return App.settings?.serverUrl || 'http://localhost:8080';
  }

  function _isServerMode() {
    return App.settings?.serverMode === true && _serverHealthy;
  }

  function _getApiKey() {
    return App.settings?.apiKey || '';
  }

  // ─── Vérification de santé ──────────────────────────────
  async function _checkServerHealth(force = false) {
    const now = Date.now();
    if (!force && now - _lastHealthCheck < HEALTH_CHECK_INTERVAL) {
      return _serverAvailable;
    }
    _lastHealthCheck = now;
    try {
      const resp = await fetch(`${_getServerUrl()}/status`, {
        signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT),
        headers: { 'X-API-Key': _getApiKey() },
      });
      _serverAvailable = resp.ok;
      return _serverAvailable;
    } catch (_) {
      _serverAvailable = false;
      return false;
    }
  }

  async function _performHealthCheck() {
    const previous = _serverHealthy;
    const ok = await _checkServerHealth(true);
    if (ok !== previous) {
      _serverHealthy = ok;
      if (ok) {
        App.settings.serverMode = true;
        await db.saveSetting('serverMode', true);
        window.dispatchEvent(new CustomEvent('server-status-changed', { detail: { healthy: true } }));
        showToast('🔄 Serveur reconnecté, mode serveur activé.', 'info', 4000);
      } else {
        App.settings.serverMode = false;
        await db.saveSetting('serverMode', false);
        window.dispatchEvent(new CustomEvent('server-status-changed', { detail: { healthy: false } }));
        showToast('⚠️ Serveur indisponible, passage en mode local.', 'warning', 3000);
      }
    }
  }

  function startHealthCheck() {
    if (_healthCheckInterval) clearInterval(_healthCheckInterval);
    _performHealthCheck();
    _healthCheckInterval = setInterval(_performHealthCheck, HEALTH_CHECK_INTERVAL);
  }

  function stopHealthCheck() {
    if (_healthCheckInterval) {
      clearInterval(_healthCheckInterval);
      _healthCheckInterval = null;
    }
  }

  function getServerHealth() {
    return _serverHealthy;
  }

  // ─── API CALL AVEC CLÉ API DANS LES HEADERS (étape 10.2) ──
  async function _apiCall(endpoint, options = {}) {
    const url = `${_getServerUrl()}${endpoint}`;
    try {
      const resp = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': _getApiKey(),
          ...(options.headers || {}),
        },
      });
      if (!resp.ok) {
        let errMsg;
        try {
          const errJson = await resp.json();
          errMsg = errJson.error || `HTTP ${resp.status}`;
        } catch (_) {
          errMsg = `HTTP ${resp.status}`;
        }
        const error = new Error(errMsg);
        error.status = resp.status;
        throw error;
      }
      return resp.json();
    } catch (err) {
      if (err.name === 'AbortError' || err.type === 'aborted' || err.message.includes('fetch')) {
        err.network = true;
      } else if (!err.status) {
        err.network = true;
      }
      throw err;
    }
  }

  async function _withFallback(apiFn, dbFn, fallbackMsg = 'Mode hors-ligne') {
    if (!_isServerMode()) {
      if (!_serverHealthy && App.settings?.serverMode) {
        if (fallbackMsg) showToast(`⚠ ${fallbackMsg}`, 'warning', 2000);
      }
      return dbFn();
    }
    try {
      return await apiFn();
    } catch (err) {
      _serverHealthy = false;
      App.settings.serverMode = false;
      await db.saveSetting('serverMode', false);
      window.dispatchEvent(new CustomEvent('server-status-changed', { detail: { healthy: false } }));
      if (err.network) {
        showToast('⚠️ Connexion au serveur perdue, passage en mode local.', 'warning', 4000);
      } else {
        showToast(`❌ Erreur serveur : ${err.message}`, 'error', 4000);
      }
      return dbFn();
    }
  }

  // ─── Découverte avec clé API ─────────────────────────────
  async function discoverServer() {
    if (_discoveryDone) return;
    _discoveryDone = true;

    const existingUrl = await db.getSetting('serverUrl');
    if (existingUrl && existingUrl !== 'http://localhost:8080') {
      App.settings.serverUrl = existingUrl;
      App.settings.serverMode = true;
      await db.saveSetting('serverMode', true);
      console.log('[Discovery] URL déjà configurée :', existingUrl);
      _serverHealthy = true;
      _serverAvailable = true;
      window.dispatchEvent(new CustomEvent('server-status-changed', { detail: { healthy: true } }));
      return existingUrl;
    }

    try {
      const resp = await fetch('http://localhost:8080/status', {
        signal: AbortSignal.timeout(1500),
        headers: { 'X-API-Key': _getApiKey() },
      });
      if (resp.ok) {
        const serverUrl = 'http://localhost:8080';
        App.settings.serverUrl = serverUrl;
        App.settings.serverMode = true;
        await db.saveSetting('serverUrl', serverUrl);
        await db.saveSetting('serverMode', true);
        showToast(`🔍 Serveur trouvé : ${serverUrl}`, 'success', 3000);
        console.log('[Discovery] Serveur trouvé sur localhost');
        _serverHealthy = true;
        _serverAvailable = true;
        window.dispatchEvent(new CustomEvent('server-status-changed', { detail: { healthy: true } }));
        return serverUrl;
      }
    } catch (e) { /* ignoré */ }

    const hostname = window.location.hostname;
    if (hostname && hostname !== 'localhost' && hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
      const ipUrl = `http://${hostname}:8080`;
      try {
        const resp = await fetch(`${ipUrl}/status`, {
          signal: AbortSignal.timeout(1500),
          headers: { 'X-API-Key': _getApiKey() },
        });
        if (resp.ok) {
          App.settings.serverUrl = ipUrl;
          App.settings.serverMode = true;
          await db.saveSetting('serverUrl', ipUrl);
          await db.saveSetting('serverMode', true);
          showToast(`🔍 Serveur trouvé : ${ipUrl} (via hostname)`, 'success', 3000);
          console.log('[Discovery] Serveur trouvé sur IP', hostname);
          _serverHealthy = true;
          _serverAvailable = true;
          window.dispatchEvent(new CustomEvent('server-status-changed', { detail: { healthy: true } }));
          return ipUrl;
        }
      } catch (e) { /* ignoré */ }
    }

    App.settings.serverMode = false;
    await db.saveSetting('serverMode', false);
    console.log('[Discovery] Aucun serveur trouvé, mode local.');
    return null;
  }

  // ─── SONGS ──────────────────────────────────────────────────
  async function getAllSongs() {
    if (_songCache.size > 0) return Array.from(_songCache.values());
    const songs = await _withFallback(
      () => _apiCall('/api/songs'),
      () => db.getAllSongs(),
      'Chants en mode local'
    );
    songs.forEach(s => _songCache.set(s.id, s));
    return songs;
  }

  async function getSong(id) {
    if (_songCache.has(id)) return _songCache.get(id);
    const song = await _withFallback(
      () => _apiCall(`/api/songs/${id}`),
      () => db.getSong(id),
      'Chant en mode local'
    );
    if (song) _songCache.set(id, song);
    return song;
  }

  async function saveSong(song) {
    const isUpdate = !!song.id;
    let lastKnownVersion = null;
    if (isUpdate && song.updatedAt) {
      lastKnownVersion = song.updatedAt;
    } else if (isUpdate) {
      try {
        const existing = await db.getSong(song.id);
        if (existing && existing.updatedAt) {
          lastKnownVersion = existing.updatedAt;
        }
      } catch (e) {}
    }

    const apiFn = async () => {
      const body = { ...song };
      if (lastKnownVersion !== null) {
        body._lastKnownVersion = lastKnownVersion;
      }
      if (isUpdate) {
        return _apiCall(`/api/songs/${song.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
      } else {
        return _apiCall('/api/songs', {
          method: 'POST',
          body: JSON.stringify(song),
        });
      }
    };

    const dbFn = async () => {
      if (isUpdate) {
        await db.saveSong(song);
        _songCache.set(song.id, song);
        return song;
      } else {
        const id = await db.saveSong(song);
        const newSong = { ...song, id };
        _songCache.set(id, newSong);
        return newSong;
      }
    };

    try {
      if (!_isServerMode()) {
        return dbFn();
      }
      const result = await apiFn();
      if (isUpdate) {
        _songCache.set(song.id, result);
      } else {
        _songCache.set(result.id, result);
      }
      return result;
    } catch (err) {
      if (err.message && err.message.includes('409') || err.status === 409) {
        let serverObj = null;
        try {
          const resp = await fetch(`${_getServerUrl()}/api/songs/${song.id}`, {
            headers: { 'X-API-Key': _getApiKey() },
          });
          if (resp.ok) {
            serverObj = await resp.json();
          }
        } catch (e) {}
        if (serverObj) {
          showToast(`⚠️ Conflit détecté pour "${serverObj.title || 'chant'}". La version serveur a été chargée.`, 'warning', 5000);
          await db.saveSong(serverObj);
          _songCache.set(serverObj.id, serverObj);
          if (App.currentSong && App.currentSong.id === song.id) {
            App.currentSong = serverObj;
          }
          return serverObj;
        } else {
          showToast(`⚠️ Conflit détecté pour le chant.`, 'warning', 3000);
          return null;
        }
      } else {
        _serverHealthy = false;
        App.settings.serverMode = false;
        await db.saveSetting('serverMode', false);
        window.dispatchEvent(new CustomEvent('server-status-changed', { detail: { healthy: false } }));
        if (err.network) {
          showToast('⚠️ Connexion au serveur perdue, sauvegarde locale.', 'warning', 3000);
        } else {
          showToast(`❌ Erreur serveur : ${err.message}`, 'error', 4000);
        }
        if (isUpdate) {
          await db.saveSong(song);
          _songCache.set(song.id, song);
          return song;
        } else {
          const id = await db.saveSong(song);
          const newSong = { ...song, id };
          _songCache.set(id, newSong);
          return newSong;
        }
      }
    }
  }

  async function deleteSong(id) {
    const result = await _withFallback(
      () => _apiCall(`/api/songs/${id}`, { method: 'DELETE' }),
      () => db.deleteSong(id),
      'Suppression locale du chant'
    );
    _songCache.delete(id);
    return result;
  }

  async function searchSongs(query) {
    const songs = await getAllSongs();
    const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return songs.filter(s => {
      const title = (s.title || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const author = (s.author || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return title.includes(q) || author.includes(q);
    });
  }

  // ─── PERSONS ────────────────────────────────────────────────
  async function getAllPersons() {
    if (_personCache.size > 0) return Array.from(_personCache.values());
    const persons = await _withFallback(
      () => _apiCall('/api/persons'),
      () => db.getAllPersons(),
      'Personnes en mode local'
    );
    persons.forEach(p => _personCache.set(p.id, p));
    return persons;
  }

  async function getPerson(id) {
    if (_personCache.has(id)) return _personCache.get(id);
    const person = await _withFallback(
      () => _apiCall(`/api/persons/${id}`),
      () => db.getPerson(id),
      'Personne en mode local'
    );
    if (person) _personCache.set(id, person);
    return person;
  }

  async function savePerson(person) {
    const isUpdate = !!person.id;
    let lastKnownVersion = null;
    if (isUpdate && person.updatedAt) {
      lastKnownVersion = person.updatedAt;
    } else if (isUpdate) {
      try {
        const existing = await db.getPerson(person.id);
        if (existing && existing.updatedAt) {
          lastKnownVersion = existing.updatedAt;
        }
      } catch (e) {}
    }

    const apiFn = async () => {
      const body = { ...person };
      if (lastKnownVersion !== null) {
        body._lastKnownVersion = lastKnownVersion;
      }
      if (isUpdate) {
        return _apiCall(`/api/persons/${person.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
      } else {
        return _apiCall('/api/persons', {
          method: 'POST',
          body: JSON.stringify(person),
        });
      }
    };

    const dbFn = async () => {
      if (isUpdate) {
        await db.savePerson(person);
        _personCache.set(person.id, person);
        return person;
      } else {
        const id = await db.savePerson(person);
        const newPerson = { ...person, id };
        _personCache.set(id, newPerson);
        return newPerson;
      }
    };

    try {
      if (!_isServerMode()) {
        return dbFn();
      }
      const result = await apiFn();
      if (isUpdate) {
        _personCache.set(person.id, result);
      } else {
        _personCache.set(result.id, result);
      }
      return result;
    } catch (err) {
      if (err.message && err.message.includes('409')) {
        let serverObj = null;
        try {
          const resp = await fetch(`${_getServerUrl()}/api/persons/${person.id}`, {
            headers: { 'X-API-Key': _getApiKey() },
          });
          if (resp.ok) {
            serverObj = await resp.json();
          }
        } catch (e) {}
        if (serverObj) {
          showToast(`⚠️ Conflit détecté pour "${serverObj.nom || 'personne'}". La version serveur a été chargée.`, 'warning', 5000);
          await db.savePerson(serverObj);
          _personCache.set(serverObj.id, serverObj);
          return serverObj;
        } else {
          showToast(`⚠️ Conflit détecté pour la personne.`, 'warning', 3000);
          return null;
        }
      } else {
        _serverHealthy = false;
        App.settings.serverMode = false;
        await db.saveSetting('serverMode', false);
        window.dispatchEvent(new CustomEvent('server-status-changed', { detail: { healthy: false } }));
        if (err.network) {
          showToast('⚠️ Connexion au serveur perdue, sauvegarde locale.', 'warning', 3000);
        } else {
          showToast(`❌ Erreur serveur : ${err.message}`, 'error', 4000);
        }
        if (isUpdate) {
          await db.savePerson(person);
          _personCache.set(person.id, person);
          return person;
        } else {
          const id = await db.savePerson(person);
          const newPerson = { ...person, id };
          _personCache.set(id, newPerson);
          return newPerson;
        }
      }
    }
  }

  async function deletePerson(id) {
    const result = await _withFallback(
      () => _apiCall(`/api/persons/${id}`, { method: 'DELETE' }),
      () => db.deletePerson(id),
      'Suppression locale de la personne'
    );
    _personCache.delete(id);
    return result;
  }

  // ─── FAVORITES ──────────────────────────────────────────────
  async function getAllFavorites() {
    if (_favoritesCache !== null) return _favoritesCache;
    const favorites = await _withFallback(
      () => _apiCall('/api/favorites'),
      () => db.getAllFavorites(),
      'Favoris en mode local'
    );
    _favoritesCache = favorites;
    return favorites;
  }

  async function addFavorite(item) {
    const result = await _withFallback(
      () => _apiCall('/api/favorites', {
        method: 'POST',
        body: JSON.stringify(item),
      }),
      () => db.addFavorite(item),
      'Favori sauvegardé localement'
    );
    _favoritesCache = null;
    return result;
  }

  async function removeFavorite(ref) {
    const result = await _withFallback(
      () => _apiCall(`/api/favorites/by-ref/${encodeURIComponent(ref)}`, { method: 'DELETE' }),
      () => db.removeFavorite(ref),
      'Suppression locale du favori'
    );
    _favoritesCache = null;
    return result;
  }

  async function isFavorite(ref) {
    const favs = await getAllFavorites();
    return favs.some(f => f.ref === ref);
  }

  async function updateFavoriteLabel(ref, newLabel) {
    const result = await _withFallback(
      () => _apiCall(`/api/favorites/by-ref/${encodeURIComponent(ref)}`, {
        method: 'PUT',
        body: JSON.stringify({ label: newLabel }),
      }),
      () => db.updateFavoriteLabel(ref, newLabel),
      'Étiquette mise à jour localement'
    );
    _favoritesCache = null;
    return result;
  }

  async function exportFavoritesJSON() {
    const favorites = await getAllFavorites();
    const payload = {
      export: {
        app: 'NTIC Bible Projector',
        version: '1.0',
        exportedAt: new Date().toISOString(),
        count: favorites.length,
      },
      favorites: favorites.map((f) => ({
        type: f.type ?? 'verse',
        ref: f.ref ?? '',
        label: f.label ?? '',
        title: f.title ?? '',
        content: f.content ?? '',
        createdAt: f.createdAt ?? 0,
      })),
    };
    return JSON.stringify(payload, null, 2);
  }

  // ─── SETTINGS ───────────────────────────────────────────────
  async function getSetting(key, defaultValue = null) {
    if (!_isServerMode()) {
      return db.getSetting(key, defaultValue);
    }
    try {
      const data = await _apiCall(`/api/settings/${key}`);
      return data !== undefined ? data : defaultValue;
    } catch (err) {
      if (err.network) {
        showToast('⚠️ Serveur indisponible, lecture locale', 'warning', 2000);
      }
      return db.getSetting(key, defaultValue);
    }
  }

  async function saveSetting(key, value) {
    if (!_isServerMode()) {
      return db.saveSetting(key, value);
    }
    try {
      await _apiCall(`/api/settings/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ value }),
      });
      await db.saveSetting(key, value);
    } catch (err) {
      if (err.network) {
        showToast('⚠️ Serveur indisponible, sauvegarde locale', 'warning', 2000);
      }
      return db.saveSetting(key, value);
    }
  }

  async function getAllSettings() {
    if (!_isServerMode()) {
      const all = await db.getAllSettings();
      const obj = {};
      all.forEach(item => { obj[item.key] = item.value; });
      return obj;
    }
    try {
      return _apiCall('/api/settings');
    } catch (err) {
      if (err.network) {
        showToast('⚠️ Serveur indisponible, lecture locale', 'warning', 2000);
      }
      const all = await db.getAllSettings();
      const obj = {};
      all.forEach(item => { obj[item.key] = item.value; });
      return obj;
    }
  }

  // ─── BIBLES ──────────────────────────────────────────────────
  async function getBibleVersions() {
    return _withFallback(
      () => _apiCall('/api/bible/versions').then(r => r.versions),
      () => db.getAllBibleNames(),
      'Bibles en mode local'
    );
  }

  async function getBible(name) {
    if (_bibleCache.has(name)) return _bibleCache.get(name);
    const data = await _withFallback(
      () => _apiCall(`/api/bible/load?name=${encodeURIComponent(name)}`),
      () => db.getBible(name),
      'Bible en mode local'
    );
    if (data) _bibleCache.set(name, data);
    return data;
  }

  async function saveBibleToServer(name, data) {
    if (!_isServerMode()) {
      throw new Error('Serveur non disponible');
    }
    const result = await _apiCall('/api/bibles', {
      method: 'POST',
      body: JSON.stringify({ name, data }),
    });
    _bibleCache.set(name, data);
    return result;
  }

  async function deleteBibleFromServer(name) {
    if (!_isServerMode()) {
      throw new Error('Serveur non disponible');
    }
    const result = await _apiCall(`/api/bibles/${encodeURIComponent(name)}`, { method: 'DELETE' });
    _bibleCache.delete(name);
    return result;
  }

  async function syncAllBiblesFromServer(progressCallback) {
    const serverUrl = _getServerUrl();
    if (!_isServerMode()) {
      throw new Error(`Serveur non disponible ou mode serveur désactivé (${serverUrl})`);
    }

    try {
      const testResp = await fetch(`${serverUrl}/status`, {
        signal: AbortSignal.timeout(3000),
        headers: { 'X-API-Key': _getApiKey() },
      });
      if (!testResp.ok) {
        throw new Error(`Le serveur répond avec l'erreur ${testResp.status}`);
      }
    } catch (e) {
      throw new Error(`Impossible de contacter le serveur à l'adresse ${serverUrl}. Vérifiez que le serveur est lancé et que l'IP est correcte.`);
    }

    const versions = await getBibleVersions();
    const total = versions.length;
    let done = 0;
    for (const name of versions) {
      const data = await getBible(name);
      if (data && typeof data === 'object' && Object.keys(data).length > 0) {
        await db.saveBible(name, data);
        _bibleCache.set(name, data);
        done++;
        if (progressCallback) progressCallback(done, total);
      } else {
        done++;
        if (progressCallback) progressCallback(done, total);
        console.warn(`[dataService] Bible "${name}" ignorée (données vides ou invalides)`);
      }
    }
    return { imported: done, total };
  }

  // ─── TIMERS ──────────────────────────────────────────────────
  async function getAllTimers() {
    if (_timerCache.size > 0) return Array.from(_timerCache.values());
    const timers = await _withFallback(
      () => _apiCall('/api/timers'),
      () => db.getAllTimers(),
      'Timers en mode local'
    );
    timers.forEach(t => _timerCache.set(t.id, t));
    return timers;
  }

  async function getTimer(id) {
    if (_timerCache.has(id)) return _timerCache.get(id);
    const timer = await _withFallback(
      () => _apiCall(`/api/timers/${id}`),
      () => db.getTimer(id),
      'Timer en mode local'
    );
    if (timer) _timerCache.set(id, timer);
    return timer;
  }

  async function saveTimer(timer) {
    const isUpdate = !!timer.id;
    let lastKnownVersion = null;
    if (isUpdate && timer.updatedAt) {
      lastKnownVersion = timer.updatedAt;
    } else if (isUpdate) {
      try {
        const existing = await db.getTimer(timer.id);
        if (existing && existing.updatedAt) {
          lastKnownVersion = existing.updatedAt;
        }
      } catch (e) {}
    }

    const apiFn = async () => {
      const body = { ...timer };
      if (lastKnownVersion !== null) {
        body._lastKnownVersion = lastKnownVersion;
      }
      if (isUpdate) {
        return _apiCall(`/api/timers/${timer.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
      } else {
        return _apiCall('/api/timers', {
          method: 'POST',
          body: JSON.stringify(timer),
        });
      }
    };

    const dbFn = async () => {
      if (isUpdate) {
        await db.saveTimer(timer);
        _timerCache.set(timer.id, timer);
        return timer;
      } else {
        const id = await db.saveTimer(timer);
        const newTimer = { ...timer, id };
        _timerCache.set(id, newTimer);
        return newTimer;
      }
    };

    try {
      if (!_isServerMode()) {
        return dbFn();
      }
      const result = await apiFn();
      if (isUpdate) {
        _timerCache.set(timer.id, result);
      } else {
        _timerCache.set(result.id, result);
      }
      return result;
    } catch (err) {
      if (err.message && err.message.includes('409')) {
        let serverObj = null;
        try {
          const resp = await fetch(`${_getServerUrl()}/api/timers/${timer.id}`, {
            headers: { 'X-API-Key': _getApiKey() },
          });
          if (resp.ok) {
            serverObj = await resp.json();
          }
        } catch (e) {}
        if (serverObj) {
          showToast(`⚠️ Conflit détecté pour "${serverObj.title || 'timer'}". La version serveur a été chargée.`, 'warning', 5000);
          await db.saveTimer(serverObj);
          _timerCache.set(serverObj.id, serverObj);
          return serverObj;
        } else {
          showToast(`⚠️ Conflit détecté pour le timer.`, 'warning', 3000);
          return null;
        }
      } else {
        _serverHealthy = false;
        App.settings.serverMode = false;
        await db.saveSetting('serverMode', false);
        window.dispatchEvent(new CustomEvent('server-status-changed', { detail: { healthy: false } }));
        if (err.network) {
          showToast('⚠️ Connexion au serveur perdue, sauvegarde locale.', 'warning', 3000);
        } else {
          showToast(`❌ Erreur serveur : ${err.message}`, 'error', 4000);
        }
        if (isUpdate) {
          await db.saveTimer(timer);
          _timerCache.set(timer.id, timer);
          return timer;
        } else {
          const id = await db.saveTimer(timer);
          const newTimer = { ...timer, id };
          _timerCache.set(id, newTimer);
          return newTimer;
        }
      }
    }
  }

  async function deleteTimer(id) {
    const result = await _withFallback(
      () => _apiCall(`/api/timers/${id}`, { method: 'DELETE' }),
      () => db.deleteTimer(id),
      'Suppression locale du timer'
    );
    _timerCache.delete(id);
    return result;
  }

  async function lockTimer(id, sessionId) {
    if (!_isServerMode()) {
      return true;
    }
    try {
      const result = await _apiCall(`/api/timers/${id}/lock`, {
        method: 'POST',
        body: JSON.stringify({ sessionId }),
      });
      return result.success === true;
    } catch (err) {
      if (err.network) {
        showToast('⚠️ Serveur indisponible, verrouillage local', 'warning', 2000);
        return true;
      }
      return false;
    }
  }

  async function unlockTimer(id, sessionId) {
    if (!_isServerMode()) {
      return true;
    }
    try {
      const result = await _apiCall(`/api/timers/${id}/unlock`, {
        method: 'POST',
        body: JSON.stringify({ sessionId }),
      });
      return result.success === true;
    } catch (err) {
      if (err.network) {
        showToast('⚠️ Serveur indisponible, déverrouillage local', 'warning', 2000);
        return true;
      }
      return false;
    }
  }

  async function getTimerLock(id) {
    if (!_isServerMode()) {
      return null;
    }
    try {
      const result = await _apiCall(`/api/timers/${id}/lock`);
      return result.lockedBy || null;
    } catch (err) {
      return null;
    }
  }

  // ─── LOGS ────────────────────────────────────────────────────
  async function sendLog(level, message, data = null) {
    if (!_isServerMode()) {
      db.log(level, message, data);
      return;
    }
    try {
      await _apiCall('/api/logs', {
        method: 'POST',
        body: JSON.stringify({ level, message, data }),
      });
    } catch (err) {
      db.log(level, message, data);
    }
  }

  async function getLogs() {
    if (!_isServerMode()) {
      return db.getAllLogs();
    }
    try {
      return _apiCall('/api/logs');
    } catch (err) {
      return db.getAllLogs();
    }
  }

  // ─── Synchronisation complète ──────────────────────────────
  async function syncAllFromServer() {
    if (!_isServerMode()) {
      throw new Error('Serveur non disponible ou mode serveur désactivé');
    }
    try {
      const songs = await _apiCall('/api/songs');
      const persons = await _apiCall('/api/persons');
      const favorites = await _apiCall('/api/favorites');
      const settings = await _apiCall('/api/settings');
      const timers = await _apiCall('/api/timers');

      _songCache.clear();
      songs.forEach(s => _songCache.set(s.id, s));
      _personCache.clear();
      persons.forEach(p => _personCache.set(p.id, p));
      _favoritesCache = favorites;
      _timerCache.clear();
      timers.forEach(t => _timerCache.set(t.id, t));

      const allSongs = await db.getAllSongs();
      for (const s of allSongs) { await db.deleteSong(s.id); }
      for (const song of songs) { await db.saveSong(song); }

      const allPersons = await db.getAllPersons();
      for (const p of allPersons) { await db.deletePerson(p.id); }
      for (const person of persons) { await db.savePerson(person); }

      const allFavs = await db.getAllFavorites();
      for (const f of allFavs) { await db.removeFavorite(f.ref); }
      for (const fav of favorites) { await db.addFavorite(fav); }

      const allSettings = await db.getAllSettings();
      for (const s of allSettings) { await db.saveSetting(s.key, null); }
      for (const [key, value] of Object.entries(settings)) {
        await db.saveSetting(key, value);
        App.settings[key] = value;
      }

      const allTimers = await db.getAllTimers();
      for (const t of allTimers) { await db.deleteTimer(t.id); }
      for (const timer of timers) { await db.saveTimer(timer); }

      showToast('✅ Synchronisation complète effectuée', 'success', 3000);
      return true;
    } catch (err) {
      showToast('❌ Erreur synchronisation : ' + err.message, 'error', 4000);
      throw err;
    }
  }

  async function checkServerHealth(force = false) {
    if (force) { _lastHealthCheck = 0; }
    return _checkServerHealth(force);
  }

  // ─── API publique ──────────────────────────────────────────
  return {
    getAllSongs, getSong, saveSong, deleteSong, searchSongs,
    getAllPersons, getPerson, savePerson, deletePerson,
    getAllFavorites, addFavorite, removeFavorite, isFavorite,
    updateFavoriteLabel, exportFavoritesJSON,
    getSetting, saveSetting, getAllSettings,
    getBibleVersions, getBible, saveBibleToServer, deleteBibleFromServer,
    syncAllBiblesFromServer,
    getAllTimers, getTimer, saveTimer, deleteTimer,
    lockTimer, unlockTimer, getTimerLock,
    sendLog, getLogs,
    startHealthCheck, stopHealthCheck, getServerHealth,
    checkServerHealth, syncAllFromServer,
    discoverServer,
  };
})();

window.dataService = DATA_SERVICE;

// Lancer la découverte automatique
setTimeout(() => {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      DATA_SERVICE.startHealthCheck();
      DATA_SERVICE.discoverServer();
    });
  } else {
    DATA_SERVICE.startHealthCheck();
    DATA_SERVICE.discoverServer();
  }
}, 1000);

console.warn('[dataService] Chargé ✓');