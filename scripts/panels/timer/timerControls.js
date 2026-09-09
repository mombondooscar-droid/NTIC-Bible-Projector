function updateTimerCardDisplay(timer) {
  const container = document.getElementById('timers-list');
  if (!container) return;
  const card = container.querySelector(`.timer-card[data-id="${CSS.escape(timer.id)}"]`);
  if (!card) return;

  const tm = getTimerManager();
  const timeStr = tm.constructor.formatTime(timer.elapsed || 0, timer.format || 'auto');
  const severity = timer.severity || 'normal';
  const status = timer.status || 'idle';
  const alertMsg = timer.alertMessage || '';

  const valueEl = card.querySelector('.timer-value');
  if (valueEl) {
    valueEl.textContent = timeStr;
    valueEl.className = `timer-value severity-${severity}`;
    valueEl.style.color = _severityColor(severity);
  }
  const badgeEl = card.querySelector('.timer-status-badge');
  if (badgeEl) {
    badgeEl.textContent = timer.mode === 'clock' ? 'Horloge' : status;
    badgeEl.className = `timer-status-badge status-${timer.mode === 'clock' ? 'clock' : status}`;
    badgeEl.style.color = _statusColor(timer.mode === 'clock' ? 'clock' : status);
  }
  const blinkSpan = card.querySelector('.timer-value + span');
  if (blinkSpan) {
    blinkSpan.style.display = timer.blink ? 'inline' : 'none';
  }
  const alertEl = card.querySelector('.timer-alert');
  if (alertEl) {
    alertEl.textContent = alertMsg ? `⚠ ${alertMsg}` : '';
    alertEl.style.display = alertMsg ? '' : 'none';
  }
}

function bindTimerCardEvents(container, currentTimers) {
  const tm = getTimerManager();

  container.querySelectorAll('.timer-title-edit').forEach(el => {
    el.addEventListener('click', async () => {
      const id = el.dataset.id;
      const timer = tm.getTimer(id);
      if (!timer) return;
      const newTitle = prompt('Modifier le titre :', timer.title);
      if (newTitle !== null && newTitle.trim() !== '') {
        await tm.updateTimer(id, { title: newTitle.trim() });
        el.textContent = newTitle.trim();
        showToast('Titre mis à jour', 'success');
      }
    });
  });

  container.querySelectorAll('.btn-timer-start').forEach(btn => {
    btn.addEventListener('click', () => tm.startTimer(btn.dataset.id));
  });
  container.querySelectorAll('.btn-timer-pause').forEach(btn => {
    btn.addEventListener('click', () => tm.pauseTimer(btn.dataset.id));
  });
  container.querySelectorAll('.btn-timer-stop').forEach(btn => {
    btn.addEventListener('click', () => tm.stopTimer(btn.dataset.id));
  });
  container.querySelectorAll('.btn-timer-reset').forEach(btn => {
    btn.addEventListener('click', () => tm.resetTimer(btn.dataset.id));
  });
  container.querySelectorAll('.btn-timer-toggle-options').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.timer-card');
      const options = card.querySelector('.timer-options');
      if (options) {
        options.style.display = options.style.display === 'none' ? 'flex' : 'none';
        btn.textContent = options.style.display === 'none' ? '⚙️' : '⚙️ ✕';
      }
    });
  });
  container.querySelectorAll('.btn-timer-adjust').forEach(btn => {
    btn.addEventListener('click', () => {
      const delta = parseInt(btn.dataset.delta, 10);
      tm.adjustTime(btn.dataset.id, delta);
    });
  });
  container.querySelectorAll('.btn-timer-threshold').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const card = btn.closest('.timer-card');
      const warnInput = card.querySelector('.timer-warning-input');
      const critInput = card.querySelector('.timer-critical-input');
      const warn = parseInt(warnInput?.value) || 60;
      const crit = parseInt(critInput?.value) || 10;
      await tm.updateTimer(id, { warningThreshold: warn, criticalThreshold: crit });
      showToast('Seuils mis à jour', 'success');
    });
  });
  container.querySelectorAll('.btn-timer-format').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const card = btn.closest('.timer-card');
      const formatInput = card.querySelector('.timer-format-input');
      const format = formatInput?.value?.trim() || 'auto';
      await tm.updateTimer(id, { format });
      showToast('Format mis à jour', 'success');
    });
  });
  container.querySelectorAll('.btn-timer-visibility').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const timer = tm.getTimer(id);
      if (!timer) return;
      const newVisible = !timer.visibleOnStage;
      await tm.updateTimer(id, { visibleOnStage: newVisible });
      btn.textContent = newVisible ? '👁' : '🚫';
      btn.title = newVisible ? 'Masquer de l\'écran' : 'Afficher sur l\'écran';
      showToast(newVisible ? '👁 Minuteur affiché' : '🚫 Minuteur masqué', 'info');
    });
  });

  // Suppression avec délégation
  container.addEventListener('click', (e) => {
    const target = e.target.closest('.btn-timer-delete');
    if (target) {
      const card = target.closest('.timer-card');
      if (!card) return;
      const confirmDiv = card.querySelector('.timer-delete-confirm');
      if (!confirmDiv) return;
      document.querySelectorAll('.timer-delete-confirm').forEach(div => {
        if (div !== confirmDiv) div.style.display = 'none';
      });
      confirmDiv.style.display = confirmDiv.style.display === 'flex' ? 'none' : 'flex';
      return;
    }

    const yesBtn = e.target.closest('.btn-del-yes');
    if (yesBtn) {
      e.preventDefault();
      const card = yesBtn.closest('.timer-card');
      if (!card) return;
      const id = card.dataset.id;
      tm.deleteTimer(id);
      renderTimerPanel(document.getElementById('app'));
      showToast('🗑 Minuteur supprimé', 'info');
      return;
    }

    const noBtn = e.target.closest('.btn-del-no');
    if (noBtn) {
      const confirmDiv = noBtn.closest('.timer-delete-confirm');
      if (confirmDiv) confirmDiv.style.display = 'none';
    }
  });

  container.querySelectorAll('[data-hotkey]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.hotkey;
      const activeTimer = currentTimers.find(t => t.status === 'running');
      if (!activeTimer) {
        showToast('Aucun minuteur en cours', 'warning');
        return;
      }
      const id = activeTimer.id;
      switch (action) {
        case 'start': tm.startTimer(id); break;
        case 'pause': tm.pauseTimer(id); break;
        case 'stop': tm.stopTimer(id); break;
        case 'add1': tm.adjustTime(id, 60000); break;
        case 'sub1': tm.adjustTime(id, -60000); break;
        case 'reset': tm.resetTimer(id); break;
      }
      showToast(`Action OBS : ${action}`, 'info');
    });
  });
}