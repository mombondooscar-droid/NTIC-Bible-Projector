function _severityColor(severity) {
  switch (severity) {
    case 'critical': return '#FF0000';
    case 'warning':  return '#FF8C00';
    case 'normal':   return 'var(--text)';
    case 'paused':   return '#6b7280';
    case 'stopped':  return '#4b5563';
    default:         return 'var(--text)';
  }
}

function _statusColor(status) {
  switch (status) {
    case 'running': return '#4ade80';
    case 'paused':  return '#facc15';
    case 'stopped': return '#9ca3af';
    default:        return '#9aa0b0';
  }
}

function buildTimerCardHtml(timer) {
  const tm = getTimerManager();
  const timeStr = tm.constructor.formatTime(timer.elapsed || 0, timer.format || 'auto');
  const severity = timer.severity || 'normal';
  const status = timer.status || 'idle';
  const isVisible = timer.visibleOnStage !== false;
  const isClock = timer.mode === 'clock';

  return `
    <div class="timer-card" data-id="${esc(timer.id)}" style="background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-sm); padding:0.75rem 1rem; transition:border-color 0.2s;">
      <div style="display:flex; flex-wrap:wrap; align-items:center; gap:0.5rem 0.75rem;">

        <div style="flex:2; min-width:120px;">
          <span class="timer-title-edit" data-id="${esc(timer.id)}" style="font-weight:700; font-size:0.9rem; cursor:pointer; border-bottom:1px dashed var(--border-mid); padding:0 4px;" title="Cliquer pour modifier">
            ${esc(timer.title)}
          </span>
          <span style="font-size:0.7rem; color:var(--text-muted); margin-left:6px;">#${timer.id.slice(-4)}</span>
          <span style="font-size:0.7rem; color:var(--accent); margin-left:6px;">${esc(timer.mode)}</span>
        </div>

        <div style="flex:1; min-width:80px; text-align:center;">
          <span class="timer-value" data-severity="${esc(severity)}" style="font-family:'Arial Black',sans-serif; font-size:1.5rem; font-weight:900; color:${_severityColor(severity)};">
            ${esc(timeStr)}
          </span>
          ${timer.blink ? '<span style="animation:blink 1s infinite;">⚠️</span>' : ''}
        </div>

        <div style="flex-shrink:0;">
          <span class="timer-status-badge status-${esc(status)}" style="font-size:0.7rem; font-weight:600; text-transform:uppercase; padding:2px 10px; border-radius:40px; background:rgba(255,255,255,0.05); color:${_statusColor(status)};">
            ${esc(status)}
          </span>
        </div>

        <div style="display:flex; flex-wrap:wrap; gap:4px; flex-shrink:0;">
          ${!isClock ? `
            <button class="btn btn-sm btn-primary btn-timer-start" data-id="${esc(timer.id)}" ${status === 'running' ? 'disabled' : ''}
                    title="Démarrer le minuteur" aria-label="Démarrer">▶ Démarrer</button>
            <button class="btn btn-sm btn-ghost btn-timer-pause" data-id="${esc(timer.id)}" ${status !== 'running' ? 'disabled' : ''}
                    title="Mettre en pause" aria-label="Pause">⏸ Pause</button>
            <button class="btn btn-sm btn-ghost btn-timer-stop" data-id="${esc(timer.id)}" ${status === 'stopped' || status === 'idle' ? 'disabled' : ''}
                    title="Arrêter le minuteur" aria-label="Arrêter">⏹ Arrêter</button>
            <button class="btn btn-sm btn-ghost btn-timer-reset" data-id="${esc(timer.id)}" ${status === 'running' ? 'disabled' : ''}
                    title="Réinitialiser" aria-label="Réinitialiser">⟲ Réinitialiser</button>
            <button class="btn btn-sm btn-ghost btn-timer-toggle-options" data-id="${esc(timer.id)}"
                    title="Options avancées" aria-label="Options avancées">⚙️</button>
          ` : `
            <span style="font-size:0.75rem; color:var(--text-muted);">Horloge</span>
          `}
        </div>

        <div class="timer-options" style="display:none; width:100%; margin-top:8px; border-top:1px solid var(--border); padding-top:8px; flex-wrap:wrap; gap:0.5rem; align-items:center;">
          ${!isClock ? `
            <div style="display:flex; flex-wrap:wrap; gap:3px; align-items:center;">
              <button class="btn btn-sm btn-ghost btn-timer-adjust" data-id="${esc(timer.id)}" data-delta="-600000" title="-10 min">-10</button>
              <button class="btn btn-sm btn-ghost btn-timer-adjust" data-id="${esc(timer.id)}" data-delta="-300000" title="-5 min">-5</button>
              <button class="btn btn-sm btn-ghost btn-timer-adjust" data-id="${esc(timer.id)}" data-delta="-60000" title="-1 min">-1</button>
              <button class="btn btn-sm btn-ghost btn-timer-adjust" data-id="${esc(timer.id)}" data-delta="60000" title="+1 min">+1</button>
              <button class="btn btn-sm btn-ghost btn-timer-adjust" data-id="${esc(timer.id)}" data-delta="300000" title="+5 min">+5</button>
              <button class="btn btn-sm btn-ghost btn-timer-adjust" data-id="${esc(timer.id)}" data-delta="600000" title="+10 min">+10</button>
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:3px; align-items:center;">
              <input type="number" class="timer-warning-input" data-id="${esc(timer.id)}" placeholder="Warn" value="${timer.warningThreshold || 60}" style="width:44px; padding:2px 4px; background:var(--bg-input); border:1px solid var(--border-mid); border-radius:var(--radius-xs); font-size:0.7rem; text-align:center;" title="Seuil d'avertissement (s)">
              <input type="number" class="timer-critical-input" data-id="${esc(timer.id)}" placeholder="Crit" value="${timer.criticalThreshold || 10}" style="width:44px; padding:2px 4px; background:var(--bg-input); border:1px solid var(--border-mid); border-radius:var(--radius-xs); font-size:0.7rem; text-align:center;" title="Seuil critique (s)">
              <button class="btn btn-sm btn-ghost btn-timer-threshold" data-id="${esc(timer.id)}" title="Appliquer seuils">✓</button>
              <input type="text" class="timer-format-input" data-id="${esc(timer.id)}" placeholder="Format" value="${esc(timer.format || 'auto')}" style="width:80px; padding:2px 4px; background:var(--bg-input); border:1px solid var(--border-mid); border-radius:var(--radius-xs); font-size:0.7rem; text-align:center;" title="Format (auto ou code)">
              <button class="btn btn-sm btn-ghost btn-timer-format" data-id="${esc(timer.id)}" title="Appliquer format">✓</button>
            </div>
          ` : ''}
          <div style="display:flex; gap:4px; margin-left:auto;">
            <button class="btn btn-sm btn-ghost btn-timer-visibility" data-id="${esc(timer.id)}" title="${isVisible ? 'Masquer de l\'écran' : 'Afficher sur l\'écran'}">
              ${isVisible ? '👁' : '🚫'}
            </button>
            <button class="btn btn-sm btn-danger btn-timer-delete" data-id="${esc(timer.id)}" style="color:var(--danger);"
                    title="Supprimer ce minuteur" aria-label="Supprimer">${ICONS.delete}</button>
          </div>
        </div>

      </div>
      <div class="timer-delete-confirm" style="display:none !important; margin-top:0.5rem; padding:0.5rem; background:rgba(224,80,80,0.08); border:1px solid rgba(224,80,80,0.2); border-radius:var(--radius-xs); font-size:0.8rem; color:var(--text-muted); display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
        <span>Supprimer ce minuteur ?</span>
        <button class="btn btn-sm btn-danger btn-del-yes" data-id="${esc(timer.id)}">Oui</button>
        <button class="btn btn-sm btn-ghost btn-del-no">Non</button>
      </div>
    </div>
  `;
}

function buildTimerListHtml(timers) {
  if (timers.length === 0) {
    return `<div class="empty-state"><div class="empty-state-icon">⏱</div><p>Aucun minuteur. Créez-en un ci-dessous.</p></div>`;
  }
  return timers.map(t => buildTimerCardHtml(t)).join('');
}