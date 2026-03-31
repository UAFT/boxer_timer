import { PHASES } from '../core/constants.js';
import { formatTime } from '../core/time.js';

function phaseLabelText(state) {
  if (state.isPaused) return 'Пауза';
  switch (state.phase) {
    case PHASES.COUNTDOWN:
      return 'Отсчёт';
    case PHASES.WORK:
      return 'Работа';
    case PHASES.REST:
      return 'Отдых';
    case PHASES.FINISHED:
      return 'Готово';
    default:
      return 'Готов';
  }
}

function roundLabelText(state) {
  if (state.phase === PHASES.IDLE) return `Раунд 0 из ${state.totalRounds}`;
  return `Раунд ${state.roundIndex} из ${state.totalRounds}`;
}

function totalDurationSec(config) {
  return (config.rounds * config.workSec) + (Math.max(0, config.rounds - 1) * config.restSec);
}

function remainingTotalSec(state) {
  const { config } = state;
  if (state.phase === PHASES.IDLE) return totalDurationSec(config);
  if (state.phase === PHASES.FINISHED) return 0;

  let remaining = Math.max(0, state.remainingSec);
  const roundsAfterCurrent = Math.max(0, config.rounds - state.roundIndex);

  if (state.phase === PHASES.WORK) {
    remaining += roundsAfterCurrent * (config.workSec + config.restSec);
    if (state.roundIndex === config.rounds) {
      remaining -= config.restSec;
    }
    return Math.max(0, remaining);
  }

  if (state.phase === PHASES.REST) {
    remaining += roundsAfterCurrent * (config.workSec + config.restSec);
    return Math.max(0, remaining);
  }

  if (state.phase === PHASES.COUNTDOWN) {
    return totalDurationSec(config);
  }

  return totalDurationSec(config);
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
  els.metricMetronome.textContent = String(state.config.metronomeBpm);
  els.metricTotal.textContent = formatTime(totalDurationSec(state.config));
  els.metricRemaining.textContent = formatTime(remainingTotalSec(state));
  els.metronomeStatus.textContent = state.config.metronomeEnabled
    ? `${state.config.metronomeBpm} BPM`
    : 'Выкл';

  els.startBtn.textContent = state.isPaused ? 'Продолжить' : 'Старт';
  els.pauseBtn.disabled = state.phase === PHASES.IDLE || state.phase === PHASES.FINISHED || state.isPaused;
}

export function setSettingsForm(els, settings) {
  els.roundsInput.value = settings.rounds;
  els.workSecInput.value = settings.workSec;
  els.restSecInput.value = settings.restSec;
  els.countdownEnabledInput.checked = settings.countdownEnabled;
  els.warning10EnabledInput.checked = settings.warning10Enabled;
  els.audioEnabledInput.checked = settings.audioEnabled;
  els.metronomeEnabledInput.checked = settings.metronomeEnabled;
  els.metronomeBpmInput.value = settings.metronomeBpm;
}

export function readSettingsForm(els) {
  return {
    rounds: Number(els.roundsInput.value),
    workSec: Number(els.workSecInput.value),
    restSec: Number(els.restSecInput.value),
    countdownEnabled: els.countdownEnabledInput.checked,
    warning10Enabled: els.warning10EnabledInput.checked,
    audioEnabled: els.audioEnabledInput.checked,
    metronomeEnabled: els.metronomeEnabledInput.checked,
    metronomeBpm: Number(els.metronomeBpmInput.value)
  };
}

export function setActivePreset(els, presetId) {
  els.presetTabs.forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.preset === presetId);
  });
}

export function openSettings(els) {
  els.settingsModal.hidden = false;
}

export function closeSettings(els) {
  els.settingsModal.hidden = true;
}
