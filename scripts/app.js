/**
 * scripts/app.js — Application principale NTIC Bible Projector
 * Version avec clé API pour WebSocket (étape 10.2)
 */

// ─── Variables globales ──────────────────────────────────────
const BC_MESSAGE_VERSION = 2;

// ─── Initialisation ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Créer les canaux de communication
  window.projChannels = {
    bible:      createProjectionChannel('proj_bible'),
    chant:      createProjectionChannel('proj_chant'),
    ltVerset:   createProjectionChannel('proj_lt_verset'),
    ltPersonne: createProjectionChannel('proj_lt_personne'),
    timer:      createProjectionChannel('proj_timer'),
  };

  // Indicateur de connectivité
  const headerRight = document.querySelector('.header-right');
  if (headerRight) {
    const statusIndicator = document.createElement('div');
    statusIndicator.id = 'server-status-indicator';
    statusIndicator.className = 'server-status-indicator';
    statusIndicator.style.display = 'flex';
    statusIndicator.style.alignItems = 'center';
    statusIndicator.style.gap = '6px';
    statusIndicator.style.fontSize = '0.7rem';
    statusIndicator.style.color = 'var(--text-muted)';
    statusIndicator.innerHTML = `
      <span class="status-dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--text-dim);transition:background 0.3s;"></span>
      <span class="status-label">Serveur</span>
    `;
    headerRight.appendChild(statusIndicator);
  }

  window.addEventListener('server-status-changed', (e) => {
    const healthy = e.detail.healthy;
    const indicator = document.getElementById('server-status-indicator');
    if (indicator) {
      const dot = indicator.querySelector('.status-dot');
      const label = indicator.querySelector('.status-label');
      if (healthy) {
        dot.style.background = 'var(--success)';
        dot.style.boxShadow = '0 0 6px var(--success)';
        label.textContent = 'Serveur connecté';
        indicator.style.color = 'var(--success)';
      } else {
        dot.style.background = 'var(--danger)';
        dot.style.boxShadow = 'none';
        label.textContent = 'Serveur hors ligne';
        indicator.style.color = 'var(--danger)';
      }
    }
  });

  // ─── Récupération de la clé API (étape 10.2) ─────────────
  (async function initApiKey() {
    let apiKey = await db.getSetting('apiKey');
    if (!apiKey) {
      // Si aucune clé n'est stockée, on demande à l'utilisateur (ou on utilise une clé par défaut)
      // Pour une application réelle, on peut afficher une modale de saisie
      // Ici, on utilise une clé par défaut pour le développement
      apiKey = 'dev-key';
      await db.saveSetting('apiKey', apiKey);
    }
    App.settings.apiKey = apiKey;
  })();

  // Connexion WebSocket avec clé API
  connectWebSocket();

  // Navigation initiale
  navigateTo('bible');

  // Écouteur de messages inter-fenêtres (BroadcastChannel)
  Object.values(window.projChannels).forEach(channel => {
    channel.addEventListener('message', handleIncomingProjMessage);
  });

  // Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(() => console.log('SW enregistré'))
      .catch(err => console.warn('SW échec', err));
  }
});

// ─── Connexion WebSocket avec clé API (étape 10.2) ─────────
function connectWebSocket() {
  const wsUrl = (App.settings.serverUrl || 'http://localhost:8080').replace('http', 'ws') + '/ws';
  const apiKey = App.settings.apiKey || '';
  // Ajouter la clé API comme paramètre d'URL
  const fullWsUrl = apiKey ? `${wsUrl}?apiKey=${encodeURIComponent(apiKey)}` : wsUrl;
  const ws = new WebSocket(fullWsUrl);
  ws.onopen = () => {
    console.log('WebSocket connecté');
    window._ws = ws;
  };
  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      handleIncomingWSMessage(msg);
    } catch (e) {
      console.warn('Erreur parsing message WebSocket', e);
    }
  };
  ws.onerror = (err) => {
    console.warn('WebSocket erreur', err);
  };
  ws.onclose = () => {
    console.warn('WebSocket fermé, tentative de reconnexion dans 5s');
    setTimeout(connectWebSocket, 5000);
  };
  window._ws = ws;
}

// ─── Gestion des messages entrants (WebSocket) ─────────────
function handleIncomingWSMessage(msg) {
  if (msg.type && msg.type !== 'ws-ping') {
    safePostMessage({ ...msg, _fromNetwork: true });
  }
}

// ─── Gestion des messages entrants (BroadcastChannel) ──────
function handleIncomingProjMessage(event) {
  const msg = event.data;
  if (!msg || !msg.type) return;
  if (msg._fromNetwork) return;
  const relayEnabled = App.settings.relayEnabled;
  if (relayEnabled && window._ws && window._ws.readyState === WebSocket.OPEN) {
    window._ws.send(JSON.stringify(msg));
  }
}

// ─── Navigation ─────────────────────────────────────────────
async function navigateTo(tab) {
  const app = document.getElementById('app');
  if (!app) return;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  const targetTab = document.querySelector(`.tab[data-tab="${tab}"]`);
  if (targetTab) targetTab.classList.add('active');

  switch (tab) {
    case 'bible':
      await renderBiblePanel(app);
      break;
    case 'songs':
      await renderSongsPanel(app);
      break;
    case 'lowerthird':
      await renderLowerThirdPanel(app);
      break;
    case 'timers':
      await renderTimerPanel(app);
      break;
    case 'settings':
      await renderSettingsPanel(app);
      break;
    default:
      app.innerHTML = `<div class="panel"><p>Onglet inconnu</p></div>`;
  }
}

window.navigateTo = navigateTo;