import { PHASES } from '../core/constants.js';
import { formatTime } from '../core/time.js';

function phaseLabelText(state) {
  if (state.isPaused) return 'Пауза';
  switch (state.phase) {
    case PHASES.COUNTDOWN:
      return 'Предстарт';
    case PHASES.WORK:
      return 'Раунд';
    case PHASES.REST:
      return 'Отдых';
    case PHASES.FINISHED:
      return 'Готово';
    default:
      return 'Готов';
  }
}

function roundLabelText(state) {
  if (state.phase === PHASES.IDLE) return `Раунд 0 / ${state.totalRounds}`;
  return `Раунд ${state.roundIndex} / ${state.totalRounds}`;
}

export function renderTimer(els, state) {
  els.mainTime.textContent = formatTime(state.remainingSec);
  els.phaseLabel.textContent = phaseLabelText(state);
  els.roundLabel.textContent = roundLabelText(state);
  els.phaseCaption.textContent = state.nextLabel || '—';
  els.countdownCaption.textContent = state.countdownText || '';
  els.progressFill.style.width = `${state.progress || 0}%`;

  els.metricWork.textContent = formatTime(state.config.workSec);
  els.metricRest.textContent = formatTime(state.config.restSec);
  els.metricRounds.textContent = String(state.config.rounds);

  els.startBtn.textContent = state.isPaused ? 'Продолжить' : 'Старт';
  els.pauseBtn.disabled = state.phase === PHASES.IDLE || state.phase === PHASES.FINISHED;
}

export function setSettingsForm(els, settings) {
  els.roundsInput.value = settings.rounds;
  els.workSecInput.value = settings.workSec;
  els.restSecInput.value = settings.restSec;
  els.countdownEnabledInput.checked = settings.countdownEnabled;
  els.warning10EnabledInput.checked = settings.warning10Enabled;
  els.audioEnabledInput.checked = settings.audioEnabled;
}

export function readSettingsForm(els) {
  return {
    rounds: Number(els.roundsInput.value),
    workSec: Number(els.workSecInput.value),
    restSec: Number(els.restSecInput.value),
    countdownEnabled: els.countdownEnabledInput.checked,
    warning10Enabled: els.warning10EnabledInput.checked,
    audioEnabled: els.audioEnabledInput.checked
  };
}

export function setActivePreset(els, presetId) {
  els.presetTabs.forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.preset === presetId);
  });
}

export function openSettings(els) {
  els.settingsPanel.hidden = false;
}

export function closeSettings(els) {
  els.settingsPanel.hidden = true;
}

export function renderAudioStatus(els, { enabled, missingCount }) {
  if (!enabled) {
    els.audioStatusBadge.textContent = 'audio off';
    els.audioStatusBadge.className = 'badge badge-warn';
    return;
  }

  if (missingCount > 0) {
    els.audioStatusBadge.textContent = `missing ${missingCount}`;
    els.audioStatusBadge.className = 'badge badge-warn';
    return;
  }

  els.audioStatusBadge.textContent = 'audio ready';
  els.audioStatusBadge.className = 'badge badge-ok';
}

export function renderDebug(els, text) {
  els.debugBox.textContent = text;
}
