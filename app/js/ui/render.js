import { PHASES } from '../core/constants.js';
import { formatTime } from '../core/time.js';
import { displayDurationsForState, remainingTotalSecForState, totalDurationSecForConfig } from '../core/schedule.js';

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

function metronomeModeLabel(mode) {
  return mode === 'subdivided' ? 'Дробный' : 'Прямой';
}

function stepLabel(sec) {
  const value = Number(sec || 0);
  if (!value) return 'без шага';
  const sign = value > 0 ? '+' : '−';
  const abs = Math.abs(value);
  const mm = Math.floor(abs / 60);
  const ss = abs % 60;
  const parts = [];
  if (mm) parts.push(`${mm} мин`);
  if (ss || !parts.length) parts.push(`${ss} сек`);
  return `${sign}${parts.join(' ')}`;
}

function intervalCaption(config) {
  if (config.intervalMode !== 'ladder') return '';
  return `Лестница · работа ${stepLabel(config.workStepSec)} · отдых ${stepLabel(config.restStepSec)}`;
}

function applyChoiceButtons(buttons, targetValue, dataKey) {
  buttons.forEach((button) => {
    const value = button.dataset[dataKey];
    const isActive = String(value) === String(targetValue);
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

export function renderTimer(els, state, uiState = {}) {
  const metronomeLocked = Number(state.config.warningSeconds ?? 0) === 10;
  const metronomePanelOpen = !metronomeLocked && Boolean(uiState.metronomePanelOpen);

  els.mainTime.textContent = formatTime(state.remainingSec);
  els.phaseLabel.textContent = phaseLabelText(state);
  els.roundLabel.textContent = roundLabelText(state);
  els.phaseCaption.textContent = intervalCaption(state.config);
  els.countdownCaption.textContent = '';
  els.progressFill.style.width = `${state.progress || 0}%`;

  const displayDurations = displayDurationsForState(state);
  els.metricWork.textContent = formatTime(displayDurations.workSec);
  els.metricRest.textContent = formatTime(displayDurations.restSec);
  els.metricRounds.textContent = String(state.config.rounds);
  els.metricMetronome.textContent = String(state.config.metronomeBpm ?? 0);
  els.metricTotal.textContent = formatTime(totalDurationSecForConfig(state.config));
  els.metricRemaining.textContent = formatTime(remainingTotalSecForState(state));
  els.metronomeStatus.textContent = metronomeLocked
    ? 'Недоступно · warning 10 сек'
    : (state.config.metronomeEnabled
      ? `${metronomeModeLabel(state.config.metronomeMode)} · Вкл`
      : `${metronomeModeLabel(state.config.metronomeMode)} · Выкл`);

  els.metronomeMaskNote.textContent = '';

  els.metronomeToggleBtn.classList.toggle('is-on', !metronomeLocked && Boolean(state.config.metronomeEnabled));
  els.metronomeToggleBtn.setAttribute('aria-pressed', !metronomeLocked && state.config.metronomeEnabled ? 'true' : 'false');
  els.metronomeToggleBtn.disabled = metronomeLocked;

  els.metronomeModeButtons.forEach((button) => {
    const isActive = !metronomeLocked && button.dataset.metronomeMode === state.config.metronomeMode;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    button.disabled = metronomeLocked;
  });

  els.metronomeCard.classList.toggle('is-collapsed', !metronomePanelOpen);
  els.metronomeCard.classList.toggle('is-locked', metronomeLocked);
  els.metronomeCardToggleBtn.setAttribute('aria-expanded', metronomePanelOpen ? 'true' : 'false');
  els.metronomeCardToggleBtn.setAttribute('aria-hidden', metronomePanelOpen ? 'true' : 'false');
  els.metronomeCardToggleBtn.setAttribute('aria-disabled', metronomeLocked ? 'true' : 'false');

  if (state.phase === PHASES.IDLE || state.phase === PHASES.FINISHED) {
    els.startBtn.textContent = 'Старт';
  } else if (state.isPaused) {
    els.startBtn.textContent = 'Продолжить';
  } else {
    els.startBtn.textContent = 'Пауза';
  }
}

export function setSettingsForm(els, settings) {
  els.audioEnabledInput.checked = settings.audioEnabled;
  els.warningSecondsInput.value = String(settings.warningSeconds ?? 4);
  els.intervalModeInput.value = settings.intervalMode || 'standard';
  els.workStepSecInput.value = String(settings.workStepSec ?? 0);
  els.restStepSecInput.value = String(settings.restStepSec ?? 0);
  els.workStartCueVariantInput.value = settings.workStartCueVariant || 'v2';
  els.restStartCueVariantInput.value = settings.restStartCueVariant || 'v2';
  els.workoutEndCueVariantInput.value = settings.workoutEndCueVariant || 'v2';

  applyChoiceButtons(els.warningChoiceButtons, els.warningSecondsInput.value, 'warningSeconds');
  applyChoiceButtons(els.intervalModeButtons, els.intervalModeInput.value, 'intervalMode');
  applyChoiceButtons(els.workStepChoiceButtons, els.workStepSecInput.value, 'workStepSec');
  applyChoiceButtons(els.restStepChoiceButtons, els.restStepSecInput.value, 'restStepSec');
  applyChoiceButtons(
    els.cueVariantButtons.filter((button) => button.dataset.cueTarget === 'workStartCueVariant'),
    els.workStartCueVariantInput.value,
    'cueValue'
  );
  applyChoiceButtons(
    els.cueVariantButtons.filter((button) => button.dataset.cueTarget === 'restStartCueVariant'),
    els.restStartCueVariantInput.value,
    'cueValue'
  );
  applyChoiceButtons(
    els.cueVariantButtons.filter((button) => button.dataset.cueTarget === 'workoutEndCueVariant'),
    els.workoutEndCueVariantInput.value,
    'cueValue'
  );
}

export function readSettingsForm(els) {
  return {
    audioEnabled: els.audioEnabledInput.checked,
    warningSeconds: Number(els.warningSecondsInput.value || '0'),
    intervalMode: els.intervalModeInput.value || 'standard',
    workStepSec: Number(els.workStepSecInput.value || '0'),
    restStepSec: Number(els.restStepSecInput.value || '0'),
    workStartCueVariant: els.workStartCueVariantInput.value || 'v2',
    restStartCueVariant: els.restStartCueVariantInput.value || 'v2',
    workoutEndCueVariant: els.workoutEndCueVariantInput.value || 'v2'
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
