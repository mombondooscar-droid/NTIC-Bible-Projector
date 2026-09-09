/**
 * ============================================================
 *  scripts/utils/wsClient.js - Client WebSocket Robuste v3.0
 *  NAGAD Bible - Communication multi-PC améliorée
 * 
 * Fonctionnalités :
 * - Connexion/déconnexion automatique avec backoff exponentiel
 * - Heartbeats bidirectionnels pour maintenir la connexion
 * - Buffer de messages en cas de déconnexion
 * - Reconnexion intelligente avec gestion des erreurs
 * - Gestion des verrous par ressource
 * - Synchronisation d'état complète
 * - Découverte automatique du serveur
 * - Gestion de la clé API
 * ============================================================
 */

const WSClient = (function() {
  'use strict';

  // ============================================================
  // CONFIGURATION
  // ============================================================
  const CONFIG = {
    // Délais de reconnexion (backoff exponentiel)
    RECONNECT_DELAY_BASE: 1000,    // 1 seconde
    RECONNECT_DELAY_MAX: 30000,   // 30 secondes
    RECONNECT_MAX_ATTEMPTS: Infinity, // Pas de limite
    
    // Heartbeats
    HEARTBEAT_INTERVAL: 25000,    // 25 secondes
    HEARTBEAT_TIMEOUT: 5000,      // 5 secondes pour répondre
    HEARTBEAT_MISSING_LIMIT: 3,   // 3 heartbeats manqués = déconnecté
    
    // Buffer
    BUFFER_MAX_SIZE: 100,
    BUFFER_FLUSH_ON_RECONNECT: true,
    
    // Timeouts
    CONNECTION_TIMEOUT: 5000,    // 5 secondes pour établir la connexion
    MESSAGE_TIMEOUT: 3000,       // 3 secondes pour envoyer un message
    SERVER_DISCOVERY_TIMEOUT: 1500, // 1.5 secondes pour découvrir le serveur
  };

  // ============================================================
  // ÉTAT INTERNE
  // ============================================================
  let _ws = null;
  let _url = '';
  let _connected = false;
  let _connecting = false;
  let _reconnectAttempts = 0;
  let _reconnectTimer = null;
  let _heartbeatTimer = null;
  let _heartbeatCheckTimer = null;
  let _lastHeartbeatSent = 0;
  let _lastMessageReceived = 0;
  let _lastHeartbeatAckReceived = 0;
  let _heartbeatMissedCount = 0;
  let _sessionId = '';
  let _serverInfo = null;
  
  // Buffer de messages
  let _messageBuffer = [];
  
  // Verrous locaux
  let _locks = {
    bible: false,
    chant: false,
    lt: false,
    timer: false,
    default: false
  };
  let _lockHolders = {};
  
  // Callbacks
  let _onConnect = null;
  let _onDisconnect = null;
  let _onMessage = null;
  let _onStateUpdate = null;
  let _onLockChange = null;
  let _onError = null;
  let _onServerDiscovered = null;

  // États possibles
  const STATES = {
    DISCONNECTED: 'disconnected',
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    ERROR: 'error',
    RECONNECTING: 'reconnecting'
  };
  let _state = STATES.DISCONNECTED;

  // ============================================================
  // UTILITAIRES
  // ============================================================

  function _generateSessionId() {
    return 'ws-' + Math.random().toString(36).slice(2, 11) + '-' + Date.now().toString(36).slice(-4);
  }

  function _getApiKey() {
    return (window.App && window.App.settings && window.App.settings.apiKey) || 'nagad-dev-key-2024';
  }

  function _getServerUrl() {
    if (window.App && window.App.settings && window.App.settings.serverUrl) {
      return window.App.settings.serverUrl;
    }
    return 'http://localhost:8080';
  }

  function _buildWebSocketUrl() {
    const baseUrl = _getServerUrl();
    let url;
    
    // Remplacer http:// par ws:// ou https:// par wss://
    if (baseUrl.startsWith('https://')) {
      url = 'wss://' + baseUrl.slice(8);
    } else if (baseUrl.startsWith('http://')) {
      url = 'ws://' + baseUrl.slice(7);
    } else {
      url = baseUrl;
    }
    
    // Ajouter les paramètres de requête
    const apiKey = _getApiKey();
    const sessionId = _sessionId || _generateSessionId();
    const tabId = (window.App && window.App.tabId) || 'unknown';
    
    url += (url.includes('?') ? '&' : '?') + 
      `apiKey=${encodeURIComponent(apiKey)}&` +
      `sessionId=${encodeURIComponent(sessionId)}&` +
      `clientName=${encodeURIComponent('NAGAD-Bible-' + tabId)}`;
    
    return url;
  }

  function _getResourceForMessage(msg) {
    if (!msg || !msg.type) return 'default';
    
    const type = msg.type;
    if (type === 'show-verse' || type === 'show-slide' || type === 'verse:segment' ||
        type === 'show-dual-bilingual' || type === 'show-dual-explanatory' ||
        type === 'hide-dual') {
      return 'bible';
    }
    if (type === 'show-song' || type === 'song-next-strophe' || type === 'song-prev-strophe') {
      return 'chant';
    }
    if (type === 'show-person' || type === 'show-lt' || type === 'hide-lower-third') {
      return 'lt';
    }
    if (type === 'show-timer-state' || type === 'timer-tick' || type === 'timer-hide-chrono') {
      return 'timer';
    }
    return 'default';
  }

  function _setState(newState) {
    const oldState = _state;
    _state = newState;
    
    console.log(`[WSClient] État changé: ${oldState} -> ${newState}`);
    
    // Notifier les callbacks
    if (oldState === STATES.CONNECTED && newState !== STATES.CONNECTED) {
      if (_onDisconnect) _onDisconnect({ state: newState });
    }
    
    if (newState === STATES.CONNECTED) {
      if (_onConnect) _onConnect({ state: newState, serverInfo: _serverInfo, sessionId: _sessionId });
    }
  }

  // ============================================================
  // GESTION DES VERROUS
  // ============================================================

  function _requestLock(resource, sessionId, callback) {
    if (!_connected || !_ws || _ws.readyState !== WebSocket.OPEN) {
      if (callback) callback({ success: false, error: 'Non connecté' });
      return;
    }

    try {
      _ws.send(JSON.stringify({
        type: 'sync:request-lock',
        resource: resource || 'default',
        sessionId: sessionId || _sessionId
      }));
      
      if (callback) callback({ success: true, pending: true });
    } catch (e) {
      console.warn('[WSClient] Erreur demande de verrou:', e);
      if (callback) callback({ success: false, error: e.message });
    }
  }

  function _releaseLock(resource, sessionId) {
    if (!_connected || !_ws || _ws.readyState !== WebSocket.OPEN) return;

    try {
      _ws.send(JSON.stringify({
        type: 'sync:release-lock',
        resource: resource || 'default',
        sessionId: sessionId || _sessionId
      }));
    } catch (e) {
      console.warn('[WSClient] Erreur libération de verrou:', e);
    }
  }

  function isLocked(resource) {
    return _locks[resource || 'default'] === true;
  }

  function getLockHolder(resource) {
    return _lockHolders[resource || 'default'];
  }

  // ============================================================
  // GESTION DU BUFFER
  // ============================================================

  function _addToBuffer(message) {
    // Éviter les doublons
    const messageStr = JSON.stringify(message);
    const alreadyInBuffer = _messageBuffer.some(msg => JSON.stringify(msg) === messageStr);
    if (alreadyInBuffer) return;
    
    _messageBuffer.push(message);
    
    // Limiter la taille du buffer
    if (_messageBuffer.length > CONFIG.BUFFER_MAX_SIZE) {
      _messageBuffer = _messageBuffer.slice(-CONFIG.BUFFER_MAX_SIZE);
    }
    
    console.log(`[WSClient] Message ajouté au buffer (taille: ${_messageBuffer.length})`);
  }

  function _flushBuffer() {
    if (_messageBuffer.length === 0) return;
    
    console.log(`[WSClient] Flush du buffer (${_messageBuffer.length} messages)`);
    
    const messagesToSend = _messageBuffer.splice(0);
    
    messagesToSend.forEach(msg => {
      _sendMessage(msg);
    });
  }

  // ============================================================
  // ENVOI DE MESSAGES
  // ============================================================

  function _sendMessage(message, priority = false) {
    if (!_connected || !_ws || _ws.readyState !== WebSocket.OPEN) {
      // Bufferiser si prioritaire ou si buffer activé
      if (CONFIG.BUFFER_FLUSH_ON_RECONNECT || priority) {
        _addToBuffer(message);
      }
      return false;
    }

    try {
      // Ajouter la version et l'origine
      const msgToSend = {
        ...message,
        version: window.BC_MESSAGE_VERSION || 1,
        _origin: _sessionId,
        _timestamp: Date.now()
      };
      
      _ws.send(JSON.stringify(msgToSend));
      _lastMessageReceived = Date.now();
      return true;
    } catch (e) {
      console.warn('[WSClient] Erreur envoi message:', e);
      _addToBuffer(message);
      return false;
    }
  }

  function send(message) {
    return _sendMessage(message, true);
  }

  function sendWithLock(message, resource) {
    const actualResource = resource || _getResourceForMessage(message);
    
    // Si on a déjà le verrou, envoyer directement
    if (_locks[actualResource] && _lockHolders[actualResource] === _sessionId) {
      return _sendMessage(message);
    }
    
    // Si le verrou est détenu par quelqu'un d'autre
    if (_locks[actualResource] && _lockHolders[actualResource] !== _sessionId) {
      const holder = _lockHolders[actualResource];
      console.warn(`[WSClient] Ressource "${actualResource}" verrouillée par ${holder}`);
      if (window.showToast) {
        window.showToast(`\ud83d\udd12 "${actualResource}" est verrouillé par ${holder}`, 'warning', 2000);
      }
      return false;
    }
    
    // Demander le verrou
    return _requestLock(actualResource, _sessionId, (response) => {
      if (response.success) {
        // Attendre la confirmation du verrou
        setTimeout(() => {
          if (_locks[actualResource] && _lockHolders[actualResource] === _sessionId) {
            _sendMessage(message);
          }
        }, 100);
      } else {
        console.warn('[WSClient] Impossible d\'obtenir le verrou pour:', actualResource);
        _addToBuffer(message);
      }
    });
  }

  // ============================================================
  // GESTION DE L'ÉTAT
  // ============================================================

  function _calculateReconnectDelay(attempt) {
    // Backoff exponentiel avec limite
    const delay = CONFIG.RECONNECT_DELAY_BASE * Math.pow(2, Math.min(attempt, 6));
    return Math.min(delay, CONFIG.RECONNECT_DELAY_MAX);
  }

  function _scheduleReconnect() {
    if (_reconnectTimer) clearTimeout(_reconnectTimer);
    
    const delay = _calculateReconnectDelay(_reconnectAttempts);
    
    console.log(`[WSClient] Reconnexion dans ${delay}ms (tentative ${_reconnectAttempts + 1})`);
    
    _reconnectTimer = setTimeout(() => {
      _reconnectAttempts++;
      connect();
    }, delay);
  }

  function _startHeartbeat() {
    if (_heartbeatTimer) clearInterval(_heartbeatTimer);
    
    _heartbeatTimer = setInterval(() => {
      if (_connected && _ws && _ws.readyState === WebSocket.OPEN) {
        _lastHeartbeatSent = Date.now();
        try {
          _ws.send(JSON.stringify({
            type: 'heartbeat',
            sessionId: _sessionId,
            timestamp: Date.now()
          }));
          console.debug('[WSClient] Heartbeat envoyé');
        } catch (e) {
          console.warn('[WSClient] Erreur envoi heartbeat:', e);
        }
      }
    }, CONFIG.HEARTBEAT_INTERVAL);
    
    // Démarrer le vérificateur de heartbeat
    _startHeartbeatCheck();
  }

  function _startHeartbeatCheck() {
    if (_heartbeatCheckTimer) clearInterval(_heartbeatCheckTimer);
    
    _heartbeatCheckTimer = setInterval(() => {
      if (_connected) {
        const now = Date.now();
        const timeSinceLastAck = now - _lastHeartbeatAckReceived;
        
        // Si on n'a pas reçu d'acknowledgment depuis trop longtemps
        if (timeSinceLastAck > CONFIG.HEARTBEAT_INTERVAL * 1.5) {
          _heartbeatMissedCount++;
          console.warn(`[WSClient] Heartbeat manqué #${_heartbeatMissedCount}`);
          
          if (_heartbeatMissedCount >= CONFIG.HEARTBEAT_MISSING_LIMIT) {
            console.warn('[WSClient] Trop de heartbeats manqués, reconnexion...');
            disconnect();
            _scheduleReconnect();
          }
        } else {
          _heartbeatMissedCount = 0;
        }
      }
    }, CONFIG.HEARTBEAT_INTERVAL / 2);
  }

  function _stopHeartbeat() {
    if (_heartbeatTimer) {
      clearInterval(_heartbeatTimer);
      _heartbeatTimer = null;
    }
    if (_heartbeatCheckTimer) {
      clearInterval(_heartbeatCheckTimer);
      _heartbeatCheckTimer = null;
    }
  }

  function _checkConnectionHealth() {
    if (_connected && _ws) {
      const timeSinceLastMessage = Date.now() - _lastMessageReceived;
      const timeSinceLastHeartbeat = Date.now() - _lastHeartbeatSent;
      
      if (timeSinceLastMessage > CONFIG.HEARTBEAT_INTERVAL * 2 &&
          timeSinceLastHeartbeat > CONFIG.HEARTBEAT_INTERVAL * 2) {
        console.warn('[WSClient] Aucune activité détectée, vérification de la connexion...');
        
        // Envoyer un ping pour vérifier
        if (_ws.readyState === WebSocket.OPEN) {
          try {
            _ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
          } catch (e) {
            console.warn('[WSClient] Ping échoué, reconnexion...');
            disconnect();
            _scheduleReconnect();
          }
        }
      }
    }
  }

  // ============================================================
  // CONNEXION WEBSOCKET
  // ============================================================

  function connect() {
    if (_connecting || _connected) {
      console.log('[WSClient] Déjà connecté ou en cours de connexion');
      return;
    }

    _setState(STATES.CONNECTING);
    _connecting = true;
    _heartbeatMissedCount = 0;
    
    console.log('[WSClient] Tentative de connexion...');
    
    try {
      _url = _buildWebSocketUrl();
      console.log('[WSClient] URL:', _url);
      
      _ws = new WebSocket(_url);
      
      _ws.onopen = () => {
        _connecting = false;
        _connected = true;
        _reconnectAttempts = 0;
        _heartbeatMissedCount = 0;
        _setState(STATES.CONNECTED);
        
        console.log('[WSClient] Connecté au serveur WebSocket');
        
        // Démarrer le heartbeat
        _startHeartbeat();
        
        // Envoyer la demande d'état initial
        _sendMessage({
          type: 'sync:request-state',
          sessionId: _sessionId,
          clientName: 'NAGAD-Bible-Client'
        });
        
        // Flush du buffer
        if (CONFIG.BUFFER_FLUSH_ON_RECONNECT) {
          _flushBuffer();
        }
        
        // Notifier
        if (_onConnect) {
          _onConnect({ state: STATES.CONNECTED, sessionId: _sessionId, serverInfo: _serverInfo });
        }
      };
      
      _ws.onmessage = (event) => {
        _lastMessageReceived = Date.now();
        
        try {
          const message = JSON.parse(event.data);
          console.debug('[WSClient] Message reçu:', message.type);
          
          // Vérifier la version
          if (message.version !== undefined && 
              message.version !== (window.BC_MESSAGE_VERSION || 1)) {
            console.warn('[WSClient] Message ignoré: version incompatible', message.version);
            return;
          }
          
          // Traiter selon le type
          _handleIncomingMessage(message);
          
        } catch (e) {
          console.warn('[WSClient] Erreur parsing message:', e);
        }
      };
      
      _ws.onclose = (event) => {
        _connected = false;
        _connecting = false;
        _stopHeartbeat();
        
        console.log(`[WSClient] Connexion fermée: code=${event.code}, reason=${event.reason || 'unknown'}`);
        
        // Déterminer la raison
        let newState = STATES.DISCONNECTED;
        if (event.code === 1008) {
          newState = STATES.ERROR;
          if (_onError) _onError({ type: 'authentication_failed', code: 1008, message: 'Clé API invalide' });
        } else if (event.code === 1001) {
          // Going away - tentative de reconnexion
          newState = STATES.DISCONNECTED;
        } else if (event.code >= 1000) {
          newState = STATES.ERROR;
        }
        
        _setState(newState);
        
        // Planifier la reconnexion
        _scheduleReconnect();
      };
      
      _ws.onerror = (event) => {
        console.error('[WSClient] Erreur WebSocket:', event);
        
        if (_onError) {
          _onError({ type: 'websocket_error', event: event, timestamp: Date.now() });
        }
      };
      
      // Timeout de connexion
      const connectionTimeout = setTimeout(() => {
        if (_connecting && !_connected) {
          console.warn('[WSClient] Timeout de connexion');
          if (_ws) {
            try {
              _ws.close();
            } catch (e) {}
          }
          _connecting = false;
          _scheduleReconnect();
        }
      }, CONFIG.CONNECTION_TIMEOUT);
      
      // Nettoyer le timeout
      _ws._connectionTimeout = connectionTimeout;
      
    } catch (e) {
      console.error('[WSClient] Erreur création WebSocket:', e);
      _connecting = false;
      _setState(STATES.ERROR);
      _scheduleReconnect();
      if (_onError) _onError({ type: 'websocket_creation_failed', error: e, timestamp: Date.now() });
    }
  }

  function disconnect() {
    if (!_connected && !_connecting) return;
    
    console.log('[WSClient] Déconnexion...');
    
    // Arrêter les timers
    if (_reconnectTimer) {
      clearTimeout(_reconnectTimer);
      _reconnectTimer = null;
    }
    
    _stopHeartbeat();
    
    // Fermer la connexion
    if (_ws) {
      try {
        if (_ws.readyState === WebSocket.OPEN || _ws.readyState === WebSocket.CONNECTING) {
          _ws.close(1000, 'Client disconnect');
        }
      } catch (e) {
        console.warn('[WSClient] Erreur fermeture WebSocket:', e);
      }
      _ws = null;
    }
    
    _connected = false;
    _connecting = false;
    _setState(STATES.DISCONNECTED);
  }

  function reconnect() {
    disconnect();
    setTimeout(() => connect(), 100);
  }

  // ============================================================
  // TRAITEMENT DES MESSAGES ENTRANTS
  // ============================================================

  function _handleIncomingMessage(message) {
    const type = message.type;
    
    // Heartbeat du serveur
    if (type === 'heartbeat' || type === 'heartbeat-ack') {
      // Répondre au heartbeat pour maintenir la connexion
      if (_connected && _ws && _ws.readyState === WebSocket.OPEN && type === 'heartbeat') {
        try {
          _ws.send(JSON.stringify({
            type: 'heartbeat-ack',
            sessionId: _sessionId,
            timestamp: Date.now()
          }));
          _lastHeartbeatAckReceived = Date.now();
        } catch (e) {
          console.warn('[WSClient] Erreur réponse heartbeat:', e);
        }
      } else if (type === 'heartbeat-ack') {
        _lastHeartbeatAckReceived = Date.now();
      }
      return;
    }
    
    // Ping
    if (type === 'ping') {
      if (_connected && _ws && _ws.readyState === WebSocket.OPEN) {
        try {
          _ws.send(JSON.stringify({
            type: 'pong',
            timestamp: message.timestamp || Date.now()
          }));
        } catch (e) {
          console.warn('[WSClient] Erreur réponse ping:', e);
        }
      }
      return;
    }
    
    // Pong
    if (type === 'pong') {
      return;
    }
    
    // Synchronisation d'état
    if (type === 'sync:full-state') {
      _handleFullState(message);
      return;
    }
    
    if (type === 'sync:state-update') {
      _handleStateUpdate(message);
      return;
    }
    
    // Messages de verrouillage
    if (type === 'sync:lock-granted') {
      _handleLockGranted(message);
      return;
    }
    
    if (type === 'sync:lock-denied') {
      _handleLockDenied(message);
      return;
    }
    
    if (type === 'sync:lock-updated') {
      _handleLockUpdated(message);
      return;
    }
    
    // Messages de replay
    if (type === 'sync:replay') {
      _handleReplay(message);
      return;
    }
    
    // Messages de projection
    if (type === 'client:connected' || type === 'client:disconnected') {
      _handleClientEvent(message);
      return;
    }
    
    // Messages normaux (à transmettre au BroadcastChannel local)
    _handleProjectionMessage(message);
  }

  function _handleFullState(message) {
    console.log('[WSClient] État complet reçu');
    
    const state = message.state || {};
    
    // Mettre à jour l'état local
    if (window.App) {
      window.App.lastBibleRef = state.lastBibleRef || '';
      window.App.lastBibleText = state.lastBibleText || '';
      window.App.currentSegments = state.currentSegments || [];
      window.App.currentSegmentIndex = state.currentSegmentIndex || 0;
      window.App.currentSong = state.currentSong || null;
      window.App.currentStropheIdx = state.currentStropheIdx || 0;
      
      if (state.currentPersonActive) {
        window.App.currentPersonActive = state.currentPersonActive;
        window.App.lastProjectedPersonNom = state.currentPersonActive.nom || '';
        window.App.lastProjectedPersonTitre = state.currentPersonActive.titre || '';
      }
      
      window.App.activeDisplayMode = state.activeDisplayMode || 'normal';
      window.App.bilingual.secondVersion = state.bilingualSecondVersion || null;
      window.App.explanatory.reference = state.explanatoryRef || '';
      
      if (state.activeTimers && state.activeTimers.length > 0 && typeof window.getTimerManager === 'function') {
        const tm = window.getTimerManager();
        tm.timers = state.activeTimers;
      }
      
      // Mettre à jour les verrous
      if (state.lockedResources) {
        Object.keys(state.lockedResources).forEach(resource => {
          const holder = state.lockedResources[resource];
          _locks[resource] = holder !== null;
          _lockHolders[resource] = holder;
        });
      }
    }
    
    // Notifier
    if (_onStateUpdate) {
      _onStateUpdate({ type: 'full', state: state, timestamp: Date.now() });
    }
    
    // Synchroniser les fenêtres de projection
    if (typeof window.syncProjectionWindows === 'function') {
      window.syncProjectionWindows();
    }
  }

  function _handleStateUpdate(message) {
    console.log('[WSClient] Mise à jour d\'état reçue');
    
    const updates = message.updates || {};
    
    // Appliquer les mises à jour
    if (window.App) {
      if (updates.lastBibleRef !== undefined) {
        window.App.lastBibleRef = updates.lastBibleRef;
        window.App.lastBibleText = updates.lastBibleText || '';
      }
      
      if (updates.currentPersonActive !== undefined) {
        window.App.currentPersonActive = updates.currentPersonActive;
        if (updates.currentPersonActive) {
          window.App.lastProjectedPersonNom = updates.currentPersonActive.nom || '';
          window.App.lastProjectedPersonTitre = updates.currentPersonActive.titre || '';
        }
      }
      
      if (updates.currentSong !== undefined) {
        window.App.currentSong = updates.currentSong;
      }
      
      if (updates.currentStropheIdx !== undefined) {
        window.App.currentStropheIdx = updates.currentStropheIdx;
      }
      
      if (updates.activeDisplayMode !== undefined) {
        window.App.activeDisplayMode = updates.activeDisplayMode;
      }
      
      if (updates.bilingualSecondVersion !== undefined) {
        window.App.bilingual.secondVersion = updates.bilingualSecondVersion;
      }
      
      if (updates.explanatoryRef !== undefined) {
        window.App.explanatory.reference = updates.explanatoryRef || '';
      }
      
      if (updates.activeTimers !== undefined && typeof window.getTimerManager === 'function') {
        const tm = window.getTimerManager();
        tm.timers = updates.activeTimers;
      }
      
      // Verrous
      if (updates.lockedResources) {
        Object.keys(updates.lockedResources).forEach(resource => {
          const holder = updates.lockedResources[resource];
          _locks[resource] = holder !== null;
          _lockHolders[resource] = holder;
        });
      }
    }
    
    // Notifier
    if (_onStateUpdate) {
      _onStateUpdate({ type: 'partial', updates: updates, timestamp: Date.now() });
    }
  }

  function _handleLockGranted(message) {
    const resource = message.resource || 'default';
    const sessionId = message.sessionId;
    
    _locks[resource] = true;
    _lockHolders[resource] = sessionId;
    
    console.log(`[WSClient] Verrou accordé pour ${resource} à ${sessionId}`);
    
    if (_onLockChange) {
      _onLockChange({ resource, granted: true, holder: sessionId, timestamp: Date.now() });
    }
  }

  function _handleLockDenied(message) {
    const resource = message.resource || 'default';
    const heldBy = message.heldBy;
    
    _locks[resource] = false;
    _lockHolders[resource] = heldBy;
    
    console.log(`[WSClient] Verrou refusé pour ${resource}, détenu par ${heldBy}`);
    
    if (_onLockChange) {
      _onLockChange({ resource, granted: false, holder: heldBy, timestamp: Date.now() });
    }
  }

  function _handleLockUpdated(message) {
    const resource = message.resource || 'default';
    const heldBy = message.heldBy;
    
    _locks[resource] = heldBy !== null;
    _lockHolders[resource] = heldBy;
    
    console.log(`[WSClient] Verrou mis à jour pour ${resource}: ${heldBy || 'libre'}`);
    
    if (_onLockChange) {
      _onLockChange({ resource, granted: heldBy === _sessionId, holder: heldBy, timestamp: Date.now() });
    }
  }

  function _handleReplay(message) {
    const messages = message.messages || [];
    
    console.log(`[WSClient] Replay de ${messages.length} messages`);
    
    // Traiter chaque message du replay
    messages.forEach(msg => {
      _handleIncomingMessage(msg);
    });
  }

  function _handleClientEvent(message) {
    console.log(`[WSClient] Événement client: ${message.type}`, {
      sessionId: message.sessionId,
      clientName: message.clientName
    });
  }

  function _handleProjectionMessage(message) {
    // Notifier le callback local (pour les panels, etc.)
    if (_onMessage) {
      _onMessage(message);
    }
    
    // NE PAS appeler safePostMessage ici pour éviter la boucle infinie
    // Les messages de projection sont déjà diffusés via BroadcastChannel
    // par le patch dans app.js. Si on les renvoie ici, on crée une boucle.
  }

  // ============================================================
  // DÉCOUVERTE DU SERVEUR
  // ============================================================

  async function discoverServer() {
    // Si déjà découvert, ne pas refaire
    if (_serverInfo) return _serverInfo;
    
    const existingUrl = _getServerUrl();
    if (existingUrl && existingUrl !== 'http://localhost:8080') {
      _serverInfo = { url: existingUrl, discovered: false };
      return _serverInfo;
    }
    
    const apiKey = _getApiKey();
    const checkUrl = async (url) => {
      try {
        const response = await fetch(`${url}/status`, {
          signal: AbortSignal.timeout(CONFIG.SERVER_DISCOVERY_TIMEOUT),
          headers: { 'X-API-Key': apiKey }
        });
        
        if (response.ok) {
          const data = await response.json();
          return {
            url: url,
            discovered: true,
            info: data
          };
        }
      } catch (e) {
        return null;
      }
      return null;
    };
    
    // Essayer localhost d'abord
    let result = await checkUrl('http://localhost:8080');
    if (result) {
      _serverInfo = result;
      console.log('[WSClient] Serveur découvert sur localhost:8080');
      if (_onServerDiscovered) {
        _onServerDiscovered(_serverInfo);
      }
      return _serverInfo;
    }
    
    // Essayer l'hôte courant
    const hostname = window.location.hostname;
    if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      result = await checkUrl(`http://${hostname}:8080`);
      if (result) {
        _serverInfo = result;
        console.log(`[WSClient] Serveur découvert sur ${hostname}:8080`);
        if (_onServerDiscovered) {
          _onServerDiscovered(_serverInfo);
        }
        return _serverInfo;
      }
    }
    
    // Essayer sur le même port que la page actuelle
    if (window.location.port) {
      result = await checkUrl(`ws://${window.location.hostname}:${window.location.port}`);
      if (result) {
        _serverInfo = result;
        console.log(`[WSClient] Serveur découvert sur ${window.location.host}`);
        if (_onServerDiscovered) {
          _onServerDiscovered(_serverInfo);
        }
        return _serverInfo;
      }
    }
    
    // Aucun serveur trouvé
    _serverInfo = null;
    return null;
  }

  // ============================================================
  // API PUBLIQUE
  // ============================================================

  return {
    // Configuration
    config: {
      get apiKey() { return _getApiKey(); },
      set apiKey(value) { 
        if (window.App && window.App.settings) {
          window.App.settings.apiKey = value;
        }
      },
      get serverUrl() { return _getServerUrl(); },
      set serverUrl(value) { 
        if (window.App && window.App.settings) {
          window.App.settings.serverUrl = value;
        }
      }
    },
    
    // État
    get state() { return _state; },
    get isConnected() { return _connected; },
    get isConnecting() { return _connecting; },
    get sessionId() { return _sessionId; },
    get serverInfo() { return _serverInfo; },
    get lastMessageTime() { return _lastMessageReceived; },
    get lastHeartbeatTime() { return _lastHeartbeatSent; },
    get reconnectAttempts() { return _reconnectAttempts; },
    
    // Callbacks
    on: function(event, callback) {
      switch (event) {
        case 'connect': _onConnect = callback; break;
        case 'disconnect': _onDisconnect = callback; break;
        case 'message': _onMessage = callback; break;
        case 'stateUpdate': _onStateUpdate = callback; break;
        case 'lockChange': _onLockChange = callback; break;
        case 'error': _onError = callback; break;
        case 'serverDiscovered': _onServerDiscovered = callback; break;
      }
      return this;
    },
    
    // Connexion
    connect: connect,
    disconnect: disconnect,
    reconnect: reconnect,
    
    // Messagerie
    send: send,
    sendWithLock: sendWithLock,
    
    // Verrous
    requestLock: function(resource, callback) {
      _requestLock(resource, _sessionId, callback);
    },
    releaseLock: function(resource) {
      _releaseLock(resource, _sessionId);
    },
    isLocked: isLocked,
    getLockHolder: getLockHolder,
    
    // Découverte
    discoverServer: discoverServer,
    
    // Buffer
    get bufferSize() { return _messageBuffer.length; },
    flushBuffer: _flushBuffer,
    
    // Initialisation
    init: function(sessionId) {
      _sessionId = sessionId || _generateSessionId();
      
      // Sauvegarder dans sessionStorage pour persistance
      try {
        sessionStorage.setItem('ws_session_id', _sessionId);
      } catch (e) {
        console.warn('[WSClient] Impossible de sauvegarder sessionId:', e);
      }
      
      return this;
    },
    
    // Utilities
    getResourceForMessage: _getResourceForMessage
  };
})();

// Initialiser automatiquement
if (typeof window !== 'undefined') {
  // Récupérer le sessionId depuis sessionStorage
  let savedSessionId = null;
  try {
    savedSessionId = sessionStorage.getItem('ws_session_id');
  } catch (e) {}
  
  WSClient.init(savedSessionId);
  
  // Rendre disponible globalement
  window.WSClient = WSClient;
  
  // Patch pour compatibilité ascendante
  window.WSClientV2 = WSClient;
}

// Exporter pour les modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WSClient;
}
