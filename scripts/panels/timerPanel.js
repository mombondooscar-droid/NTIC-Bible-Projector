let _panelClockInterval = null;
let _currentTimers = [];

async function renderTimerPanel(container) {
  const tm = getTimerManager();
  await tm.load();
  _currentTimers = tm.getAllTimers();
  _currentTimers.sort((a, b) => (a.order || 0) - (b.order || 0));

  container.innerHTML = _buildTimerPanelHtml(_currentTimers);
  _startPanelClock();
  bindNewTimerForm(container);
  bindTimerCardEvents(container, _currentTimers);
  tm._broadcastState();

  // ✅ Ajout du gestionnaire pour le bouton "Cacher tous les chronos"
  document.getElementById('btn-hide-all-chronos')?.addEventListener('click', () => {
    safePostMessage({ type: 'timer-hide-chrono' });
    showToast('Chronos masqués', 'info');
  });
}

function _buildTimerPanelHtml(timers) {
  const cardsHtml = buildTimerListHtml(timers);

  return `
    <div class="panel panel-timer" id="panel-timer">
      <div class="settings-section" style="margin-bottom:1rem;">
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem;">
          <h2 class="settings-section-title" style="margin-bottom:0;">🕒 Horloge système</h2>
          <span id="panel-clock" style="font-family:'Cinzel','Georgia',serif; font-size:2.2rem; font-weight:700; color:var(--text); letter-spacing:0.04em;">--:--:--</span>
        </div>
      </div>

      <div class="settings-section">
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.8rem;">
          <h2 class="settings-section-title" style="margin-bottom:0;">⏱ Minuteurs (${timers.length})</h2>
          <div style="display:flex; gap:0.5rem;">
            <button class="btn btn-sm btn-ghost" id="btn-hide-all-chronos" style="color:var(--text-muted);">
              🙈 Cacher tous les chronos
            </button>
            <button class="btn btn-primary btn-sm" id="btn-new-timer">
              ${ICONS.import} Nouveau minuteur
            </button>
          </div>
        </div>
        <div id="timers-list" style="display:flex; flex-direction:column; gap:0.75rem;">
          ${cardsHtml}
        </div>
      </div>

      <div id="new-timer-form" style="display:none; margin-top:0.5rem;">
        ${buildNewTimerFormHtml()}
      </div>

      <div class="settings-section" style="margin-top:1rem;">
        <h3 class="settings-section-title" style="font-size:0.9rem;">🎮 Hotkeys OBS</h3>
        <div style="display:flex; flex-wrap:wrap; gap:0.5rem;">
          <button class="btn btn-sm btn-ghost" data-hotkey="start">▶ Démarrer</button>
          <button class="btn btn-sm btn-ghost" data-hotkey="pause">⏸ Pause</button>
          <button class="btn btn-sm btn-ghost" data-hotkey="stop">⏹ Arrêter</button>
          <button class="btn btn-sm btn-ghost" data-hotkey="add1">+1 min</button>
          <button class="btn btn-sm btn-ghost" data-hotkey="sub1">-1 min</button>
          <button class="btn btn-sm btn-ghost" data-hotkey="reset">⟲ Réinitialiser</button>
        </div>
        <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.5rem;">
          Configurez ces raccourcis dans OBS (paramètres → Hotkeys) pour contrôler le timer actif.
        </div>
      </div>
    </div>
  `;
}

function _startPanelClock() {
  if (_panelClockInterval) clearInterval(_panelClockInterval);
  _updatePanelClock();
  _panelClockInterval = setInterval(_updatePanelClock, 1000);
}

function _updatePanelClock() {
  const el = document.getElementById('panel-clock');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toTimeString().slice(0, 8);
}

window.addEventListener('timer-tick', (e) => {
  const data = e.detail;
  if (data && data.id) {
    const tm = getTimerManager();
    const timer = tm.getTimer(data.id);
    if (timer) {
      updateTimerCardDisplay(timer);
    }
  }
});

window.renderTimerPanel = renderTimerPanel;