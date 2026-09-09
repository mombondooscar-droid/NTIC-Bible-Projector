/**
 * scripts/panels/timer/timerForm.js — Formulaire de création de minuteur
 * NTIC Bible Projector · US-REFACTOR-TIMER
 * Dépendances globales : esc, getTimerManager, renderTimerPanel, showToast
 */

// ─────────────────────────────────────────────────────────────
//  CONSTRUCTION HTML DU FORMULAIRE
// ─────────────────────────────────────────────────────────────
function buildNewTimerFormHtml() {
  return `
    <div class="settings-section" style="margin-bottom:0;">
      <div style="display:flex; flex-wrap:wrap; gap:0.75rem; align-items:flex-end;">
        <div style="flex:2; min-width:140px;">
          <label class="field-label" for="new-timer-title">Titre</label>
          <input type="text" id="new-timer-title" class="field-input" placeholder="Ex: Prédication" maxlength="40">
        </div>
        <div style="flex:1; min-width:100px;">
          <label class="field-label" for="new-timer-mode">Mode</label>
          <select id="new-timer-mode" class="field-select">
            <option value="countdown">Countdown</option>
            <option value="specific_time">Heure spécifique</option>
            <option value="specific_date">Date spécifique</option>
            <option value="clock">Horloge</option>
          </select>
        </div>
        <div style="flex:1; min-width:80px;" id="new-timer-duration-group">
          <label class="field-label" for="new-timer-duration">Durée (min)</label>
          <input type="number" id="new-timer-duration" class="field-input" placeholder="15" min="0" step="1">
        </div>
        <div style="flex:1; min-width:80px; display:none;" id="new-timer-time-group">
          <label class="field-label" for="new-timer-time">Heure (HH:MM)</label>
          <input type="time" id="new-timer-time" class="field-input" value="12:00">
        </div>
        <div style="flex:1; min-width:100px; display:none;" id="new-timer-datetime-group">
          <label class="field-label" for="new-timer-datetime">Date & heure</label>
          <input type="datetime-local" id="new-timer-datetime" class="field-input">
        </div>
        <div style="flex:2; min-width:120px;">
          <label class="field-label" for="new-timer-alert">Message d'alerte</label>
          <input type="text" id="new-timer-alert" class="field-input" placeholder="Temps dépassé !" maxlength="60">
        </div>
        <div style="display:flex; gap:0.5rem; flex-shrink:0;">
          <button class="btn btn-primary btn-sm" id="btn-create-timer-confirm">✓ Créer</button>
          <button class="btn btn-ghost btn-sm" id="btn-create-timer-cancel">✗ Annuler</button>
        </div>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
//  GESTIONNAIRE D'AFFICHAGE DES CHAMPS SELON LE MODE
// ─────────────────────────────────────────────────────────────
function _toggleModeFields() {
  const mode = document.getElementById('new-timer-mode')?.value;
  const durationGroup = document.getElementById('new-timer-duration-group');
  const timeGroup = document.getElementById('new-timer-time-group');
  const datetimeGroup = document.getElementById('new-timer-datetime-group');
  if (durationGroup) durationGroup.style.display = mode === 'countdown' ? 'block' : 'none';
  if (timeGroup) timeGroup.style.display = mode === 'specific_time' ? 'block' : 'none';
  if (datetimeGroup) datetimeGroup.style.display = mode === 'specific_date' ? 'block' : 'none';
}

// ─────────────────────────────────────────────────────────────
//  BIND DES ÉVÉNEMENTS DU FORMULAIRE (avec validation étape 6.3)
// ─────────────────────────────────────────────────────────────
function bindNewTimerForm(container) {
  const tm = getTimerManager();
  const form = document.getElementById('new-timer-form');
  const newBtn = document.getElementById('btn-new-timer');
  
  if (newBtn && form) {
    newBtn.addEventListener('click', () => {
      form.style.display = form.style.display === 'none' ? 'block' : 'none';
      if (form.style.display === 'block') {
        document.getElementById('new-timer-title')?.focus();
        _toggleModeFields();
      }
    });
  }

  document.getElementById('btn-create-timer-cancel')?.addEventListener('click', () => {
    if (form) form.style.display = 'none';
  });

  document.getElementById('btn-create-timer-confirm')?.addEventListener('click', async () => {
    const title = document.getElementById('new-timer-title')?.value?.trim() || '';
    // Validation du titre (étape 6.3)
    if (!title) { showToast('⚠ Le titre est obligatoire', 'warning'); return; }
    if (title.length > 40) { showToast('⚠ Titre trop long (max 40 caractères)', 'warning'); return; }

    const mode = document.getElementById('new-timer-mode')?.value || 'countdown';
    const alertMsg = document.getElementById('new-timer-alert')?.value?.trim() || '';
    let targetDuration = null;
    let targetTime = null;
    let targetDateTime = null;

    if (mode === 'countdown') {
      const mins = parseInt(document.getElementById('new-timer-duration')?.value) || 0;
      if (mins <= 0) { showToast('⚠ La durée doit être positive', 'warning'); return; }
      targetDuration = mins * 60 * 1000;
    } else if (mode === 'specific_time') {
      targetTime = document.getElementById('new-timer-time')?.value || '12:00';
    } else if (mode === 'specific_date') {
      targetDateTime = document.getElementById('new-timer-datetime')?.value;
      if (!targetDateTime) { showToast('⚠ Veuillez sélectionner une date et heure', 'warning'); return; }
    }

    const timer = await tm.createTimer({
      title,
      mode,
      targetDuration,
      targetTime,
      targetDateTime,
      alertMessage: alertMsg,
      warningThreshold: 60,
      criticalThreshold: 10,
      format: 'auto',
      order: tm.getAllTimers().length,
    });
    if (timer) {
      form.style.display = 'none';
      document.getElementById('new-timer-title').value = '';
      document.getElementById('new-timer-duration').value = '';
      document.getElementById('new-timer-time').value = '12:00';
      document.getElementById('new-timer-datetime').value = '';
      document.getElementById('new-timer-alert').value = '';
      await renderTimerPanel(document.getElementById('app'));
      showToast(`✅ Minuteur « ${timer.title} » créé`, 'success');
    }
  });

  document.getElementById('new-timer-mode')?.addEventListener('change', _toggleModeFields);
}