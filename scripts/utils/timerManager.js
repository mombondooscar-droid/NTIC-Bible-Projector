/**
 * ============================================================
 *  utils/timerManager.js — Gestion centralisée des minuteurs (Sujet 8)
 *  NTIC Bible Projector · US-T04 Sprint R7 (refonte)
 *  + US-R11-01 : Facade vers serveur via dataService
 *  Gère les 4 modes : countdown, specific_time, specific_date, clock
 *  Persistance en IndexedDB via db.js, broadcast via safePostMessage
 *  Si serverMode actif, synchronise avec le serveur.
 * ============================================================
 */

class TimerManager {
  constructor() {
    this.timers = [];
    this.intervals = {};
    this.clockInterval = null;
    this._initialized = false;
    this._sessionId = null;
    this._broadcastInterval = null;
  }

  _getSessionId() {
    if (!this._sessionId) {
      this._sessionId = sessionStorage.getItem('ntic_tab_id');
      if (!this._sessionId) {
        this._sessionId = Math.random().toString(36).slice(2);
        sessionStorage.setItem('ntic_tab_id', this._sessionId);
      }
    }
    return this._sessionId;
  }

  async load() {
    // Charger depuis dataService (qui gère le fallback)
    const stored = await dataService.getAllTimers();
    this.timers = stored.map(t => ({
      ...t,
      mode: t.mode || 'countdown',
      targetTimestamp: t.targetTimestamp || null,
      warningThreshold: t.warningThreshold || 60,
      criticalThreshold: t.criticalThreshold || 10,
      format: t.format || 'auto',
      alertMessage: t.alertMessage || '',
      blink: t.blink || false,
      alertShown: t.alertShown || false,
      lockedBy: t.lockedBy || null,
    }));
    this.timers.sort((a, b) => (a.order || 0) - (b.order || 0));
    for (const timer of this.timers) {
      if (timer.status === 'running') {
        this._startTimer(timer);
      }
    }
    this._startSystemClock();
    this._initialized = true;
    this._broadcastState();
    // Démarrer un intervalle pour la diffusion des ticks
    this._startBroadcastLoop();
  }

  _startBroadcastLoop() {
    if (this._broadcastInterval) clearInterval(this._broadcastInterval);
    this._broadcastInterval = setInterval(() => {
      // Diffuser l'état des timers en cours
      const running = this.timers.filter(t => t.status === 'running' || t.mode === 'clock');
      if (running.length > 0) {
        for (const timer of running) {
          if (timer.mode === 'clock') continue;
          // Mise à jour de l'état pour broadcast
          this._broadcastTick(timer);
        }
      }
    }, 1000);
  }

  async createTimer(params) {
    const id = 'timer_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const now = Date.now();
    let targetTimestamp = null;
    let elapsed = 0;
    let status = 'idle';

    if (params.mode === 'countdown') {
      targetTimestamp = now + (params.targetDuration || 0);
      elapsed = params.targetDuration || 0;
    } else if (params.mode === 'specific_time') {
      const [h, m] = (params.targetTime || '00:00').split(':').map(Number);
      const target = new Date();
      target.setHours(h || 0, m || 0, 0, 0);
      if (target.getTime() <= now) target.setDate(target.getDate() + 1);
      targetTimestamp = target.getTime();
      elapsed = targetTimestamp - now;
    } else if (params.mode === 'specific_date') {
      const dt = new Date(params.targetDateTime || Date.now());
      targetTimestamp = dt.getTime();
      elapsed = targetTimestamp - now;
    } else if (params.mode === 'clock') {
      targetTimestamp = null;
      elapsed = 0;
      status = 'clock';
    }

    const timer = {
      id,
      title: params.title || 'Minuteur',
      mode: params.mode || 'countdown',
      targetTimestamp,
      elapsed: Math.max(0, elapsed),
      status: status,
      order: params.order !== undefined ? params.order : this.timers.length,
      visibleOnStage: true,
      severity: 'normal',
      warningThreshold: params.warningThreshold || 60,
      criticalThreshold: params.criticalThreshold || 10,
      format: params.format || 'auto',
      alertMessage: params.alertMessage || '',
      blink: false,
      alertShown: false,
      lockedBy: null,
      createdAt: now,
      updatedAt: now,
    };
    timer.severity = this._computeSeverity(timer);
    // Sauvegarder via dataService
    await dataService.saveTimer(timer);
    this.timers.push(timer);
    this._broadcastState();
    return timer;
  }

  async updateTimer(id, updates) {
    const idx = this.timers.findIndex(t => t.id === id);
    if (idx === -1) return null;
    const timer = this.timers[idx];
    Object.assign(timer, updates);
    timer.updatedAt = Date.now();
    timer.severity = this._computeSeverity(timer);
    if (updates.status && updates.status !== timer.status) {
      if (timer.status === 'running') {
        this._startTimer(timer);
      } else {
        this._stopTimer(id);
        timer.alertShown = false;
      }
    }
    await dataService.saveTimer(timer);
    this._broadcastState();
    return timer;
  }

  async deleteTimer(id) {
    this._stopTimer(id);
    this.timers = this.timers.filter(t => t.id !== id);
    await dataService.deleteTimer(id);
    this._broadcastState();
  }

  async startTimer(id) {
    const timer = this.timers.find(t => t.id === id);
    if (!timer || timer.status === 'running' || timer.mode === 'clock') return;
    
    // Tentative de verrouillage sur le serveur
    const sessionId = this._getSessionId();
    const locked = await dataService.lockTimer(id, sessionId);
    if (!locked) {
      const lockedBy = await dataService.getTimerLock(id);
      showToast(`⚠ Timer verrouillé par un autre utilisateur (${lockedBy || 'inconnu'}).`, 'warning', 3000);
      return;
    }
    timer.lockedBy = sessionId;
    
    timer.status = 'running';
    timer.updatedAt = Date.now();
    timer.severity = this._computeSeverity(timer);
    timer.alertShown = false;
    await dataService.saveTimer(timer);
    this._startTimer(timer);
    this._broadcastState();
  }

  async pauseTimer(id) {
    this._stopTimer(id);
    const timer = this.timers.find(t => t.id === id);
    if (!timer) return;
    const sessionId = this._getSessionId();
    // Vérifier que le timer est verrouillé par nous
    if (timer.lockedBy && timer.lockedBy !== sessionId) {
      showToast(`⚠ Timer contrôlé par un autre utilisateur.`, 'warning', 3000);
      return;
    }
    timer.status = 'paused';
    timer.updatedAt = Date.now();
    timer.severity = 'paused';
    timer.alertShown = false;
    await dataService.saveTimer(timer);
    // Libérer le verrou
    await dataService.unlockTimer(id, sessionId);
    timer.lockedBy = null;
    this._broadcastState();
  }

  async stopTimer(id) {
    this._stopTimer(id);
    const timer = this.timers.find(t => t.id === id);
    if (!timer) return;
    const sessionId = this._getSessionId();
    if (timer.lockedBy && timer.lockedBy !== sessionId) {
      showToast(`⚠ Timer contrôlé par un autre utilisateur.`, 'warning', 3000);
      return;
    }
    timer.status = 'stopped';
    timer.updatedAt = Date.now();
    timer.severity = 'stopped';
    timer.alertShown = false;
    await dataService.saveTimer(timer);
    await dataService.unlockTimer(id, sessionId);
    timer.lockedBy = null;
    this._broadcastState();
  }

  async resetTimer(id) {
    this._stopTimer(id);
    const timer = this.timers.find(t => t.id === id);
    if (!timer) return;
    const sessionId = this._getSessionId();
    if (timer.lockedBy && timer.lockedBy !== sessionId) {
      showToast(`⚠ Timer contrôlé par un autre utilisateur.`, 'warning', 3000);
      return;
    }
    const now = Date.now();
    if (timer.mode === 'countdown') {
      timer.elapsed = timer.targetTimestamp ? timer.targetTimestamp - timer.createdAt : 0;
    } else if (timer.mode === 'specific_time' || timer.mode === 'specific_date') {
      timer.elapsed = timer.targetTimestamp ? timer.targetTimestamp - now : 0;
    }
    timer.elapsed = Math.max(0, timer.elapsed || 0);
    timer.status = 'idle';
    timer.updatedAt = now;
    timer.severity = this._computeSeverity(timer);
    timer.alertShown = false;
    await dataService.saveTimer(timer);
    await dataService.unlockTimer(id, sessionId);
    timer.lockedBy = null;
    this._broadcastState();
  }

  async adjustTime(id, deltaMs) {
    const timer = this.timers.find(t => t.id === id);
    if (!timer) return;
    const sessionId = this._getSessionId();
    if (timer.lockedBy && timer.lockedBy !== sessionId) {
      showToast('⏳ Timer contrôlé par un autre utilisateur.', 'warning');
      return;
    }
    if (timer.status === 'running') {
      showToast('⏳ Pause avant d\'ajuster le temps', 'warning');
      return;
    }
    timer.elapsed = Math.max(0, timer.elapsed + deltaMs);
    timer.updatedAt = Date.now();
    timer.severity = this._computeSeverity(timer);
    timer.alertShown = false;
    await dataService.saveTimer(timer);
    this._broadcastState();
  }

  _startTimer(timer) {
    if (this.intervals[timer.id]) {
      clearInterval(this.intervals[timer.id]);
    }
    this.intervals[timer.id] = setInterval(async () => {
      const fresh = this.timers.find(t => t.id === timer.id);
      if (!fresh || fresh.status !== 'running') {
        clearInterval(this.intervals[timer.id]);
        delete this.intervals[timer.id];
        return;
      }
      const now = Date.now();
      if (fresh.mode === 'countdown') {
        const remaining = fresh.targetTimestamp - now;
        fresh.elapsed = Math.max(0, remaining);
      } else if (fresh.mode === 'specific_time' || fresh.mode === 'specific_date') {
        const remaining = fresh.targetTimestamp - now;
        fresh.elapsed = Math.max(0, remaining);
      } else if (fresh.mode === 'clock') {
        return;
      }
      fresh.updatedAt = now;
      fresh.severity = this._computeSeverity(fresh);
      if (fresh.elapsed <= 0 && !fresh.alertShown && fresh.status === 'running') {
        fresh.alertShown = true;
      }
      await dataService.saveTimer(fresh);
      this._broadcastTick(fresh);
    }, 1000);
  }

  _stopTimer(id) {
    if (this.intervals[id]) {
      clearInterval(this.intervals[id]);
      delete this.intervals[id];
    }
  }

  _startSystemClock() {
    if (this.clockInterval) clearInterval(this.clockInterval);
    this.clockInterval = setInterval(() => {
      this._broadcastClock();
    }, 1000);
  }

  _computeSeverity(timer) {
    if (timer.status === 'paused') return 'paused';
    if (timer.status === 'stopped') return 'stopped';
    if (timer.mode === 'clock') return 'normal';
    const remaining = timer.elapsed;
    const remainingSec = Math.floor(remaining / 1000);
    if (remaining <= 0) {
      timer.blink = true;
      return 'critical';
    }
    if (remainingSec <= timer.criticalThreshold) {
      timer.blink = true;
      return 'critical';
    }
    if (remainingSec <= timer.warningThreshold) {
      timer.blink = false;
      return 'warning';
    }
    timer.blink = false;
    return 'normal';
  }

  _broadcastState() {
    const visible = this.timers.filter(t => t.visibleOnStage !== false && t.mode !== 'clock');
    const clocks = this.timers.filter(t => t.mode === 'clock' && t.visibleOnStage !== false);
    safePostMessage({
      type: 'show-timer-state',
      data: {
        timers: visible,
        clocks: clocks,
        systemClock: true,
      },
    });
  }

  _broadcastTick(timer) {
    safePostMessage({
      type: 'timer-tick',
      id: timer.id,
      elapsed: timer.elapsed,
      severity: timer.severity,
      blink: timer.blink || false,
      alertActive: timer.alertShown && timer.elapsed <= 0 && timer.status === 'running',
    });
    // Audit R11 : le panneau de contrôle (timerPanel.js) écoute ce
    // CustomEvent sur window pour rafraîchir la carte du timer en direct.
    // safePostMessage() seul ne notifie que les fenêtres de projection.
    window.dispatchEvent(new CustomEvent('timer-tick', { detail: { id: timer.id } }));
  }

  _broadcastClock() {
    const now = new Date();
    const timeStr = now.toTimeString().slice(0, 8);
    safePostMessage({
      type: 'timer-tick',
      id: 'system-clock',
      time: timeStr,
      timestamp: now.getTime(),
    });
  }

  getTimer(id) {
    return this.timers.find(t => t.id === id);
  }

  getAllTimers() {
    return this.timers;
  }

  static formatTime(ms, format = 'auto') {
    if (ms < 0) ms = 0;
    const totalSec = Math.floor(ms / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;

    if (format === 'auto') {
      if (days > 0) return `${days}j ${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
      if (hours > 0) return `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
      if (minutes > 0) return `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
      return `${String(seconds).padStart(2,'0')}`;
    } else {
      let result = format;
      const h24 = hours;
      const hCumul = days * 24 + hours;
      const mCumul = hCumul * 60 + minutes;
      const dayStr = String(days);
      const hourStr = String(h24).padStart(2, '0');
      const hourCumulStr = String(hCumul);
      const minStr = String(minutes).padStart(2, '0');
      const minCumulStr = String(mCumul);
      const secStr = String(seconds).padStart(2, '0');
      const dateStr = new Date().toLocaleDateString('fr-FR');
      const timeStr = new Date().toLocaleTimeString('fr-FR', {hour12: false});
      result = result.replace(/%d/g, dayStr);
      result = result.replace(/%0h/g, hourStr);
      result = result.replace(/%h/g, String(h24));
      result = result.replace(/%0H/g, hourCumulStr);
      result = result.replace(/%H/g, hourCumulStr);
      result = result.replace(/%0m/g, minStr);
      result = result.replace(/%m/g, String(minutes));
      result = result.replace(/%0M/g, minCumulStr);
      result = result.replace(/%M/g, minCumulStr);
      result = result.replace(/%0s/g, secStr);
      result = result.replace(/%s/g, String(seconds));
      result = result.replace(/%D/g, dateStr);
      result = result.replace(/%T/g, timeStr);
      return result;
    }
  }
}

let timerManager = null;
function getTimerManager() {
  if (!timerManager) {
    timerManager = new TimerManager();
    timerManager.load();
  }
  return timerManager;
}

window.getTimerManager = getTimerManager;