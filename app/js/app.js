import { AUDIO_KEYS } from './core/constants.js';
import { clonePreset } from './state/presets.js';
import { loadSettings, normalizeSettings, saveSettings } from './state/settings-store.js';
import { AudioEngine } from './audio/audio-engine.js';
import { MetronomeEngine } from './audio/metronome-engine.js';
import { TimerEngine } from './timer/timer-engine.js';
import { getDomRefs } from './ui/dom.js';
import {
  closeSettings,
  openSettings,
  readSettingsForm,
  renderTimer,
  setActivePreset,
  setSettingsForm
} from './ui/render.js';
import { bindControls, bindPresetTabs } from './ui/bindings.js';

const DEFAULT_PRESET_ID = 'classic3';
const STEP_RULES = {
  workSec: { step: 5, min: 5, max: 3600 },
  restSec: { step: 5, min: 0, max: 3600 },
  rounds: { step: 1, min: 1, max: 99 },
  metronomeBpm: { step: 1, min: 0, max: 300 }
};
const DEFAULT_METRONOME_BPM = 20;
const PRESET_FIELDS = ['rounds', 'workSec', 'restSec', 'countdownEnabled', 'warning10Enabled'];

const els = getDomRefs();
const audio = new AudioEngine();
const metronome = new MetronomeEngine();

const COUNTDOWN_EVENT_TO_AUDIO = {
  'prestart-count-3': AUDIO_KEYS.COUNT_3,
  'prestart-count-2': AUDIO_KEYS.COUNT_2,
  'prestart-count-1': AUDIO_KEYS.COUNT_1,
  'work-final-count-3': AUDIO_KEYS.COUNT_3,
  'work-final-count-2': AUDIO_KEYS.COUNT_2,
  'work-final-count-1': AUDIO_KEYS.COUNT_1,
  'rest-final-count-3': AUDIO_KEYS.COUNT_3,
  'rest-final-count-2': AUDIO_KEYS.COUNT_2,
  'rest-final-count-1': AUDIO_KEYS.COUNT_1
};

const ZERO_EVENT_TO_AUDIO = {
  'round-start-zero': AUDIO_KEYS.ROUND_START,
  'round-end-zero': AUDIO_KEYS.ROUND_END,
  'rest-end-zero': AUDIO_KEYS.REST_END,
  'workout-end-zero': AUDIO_KEYS.WORKOUT_END,
  warning10: AUDIO_KEYS.WARNING_10
};

let activePresetId = DEFAULT_PRESET_ID;
let activeSettings = loadSettings(clonePreset(DEFAULT_PRESET_ID));
let metronomePanelOpen = false;

function renderCurrentState() {
  renderTimer(els, timer.state, { metronomePanelOpen });
}

const timer = new TimerEngine({
  onTick: (state) => {
    renderTimer(els, state, { metronomePanelOpen });
    metronome.syncPhase(state);
  },
  onStateChange: (state) => {
    renderTimer(els, state, { metronomePanelOpen });
    metronome.syncPhase(state);
  },
  onEvent: async (event) => {
    const countdownAudioKey = COUNTDOWN_EVENT_TO_AUDIO[event.type];
    if (countdownAudioKey) {
      await audio.play(countdownAudioKey);
      return;
    }

    const zeroAudioKey = ZERO_EVENT_TO_AUDIO[event.type];
    if (zeroAudioKey) {
      await audio.play(zeroAudioKey);
    }
  }
});

function syncMetronome() {
  metronome.setConfig({
    enabled: activeSettings.metronomeEnabled,
    bpm: activeSettings.metronomeBpm,
    mode: activeSettings.metronomeMode
  });
}

function applySettings(nextSettings) {
  activeSettings = normalizeSettings(nextSettings, clonePreset(activePresetId));
  saveSettings(activeSettings);
  audio.setEnabled(activeSettings.audioEnabled);
  syncMetronome();
  timer.applyConfig(activeSettings);
  setSettingsForm(els, activeSettings);
  renderCurrentState();
}

async function handleToggleRun() {
  await audio.preloadAll();
  syncMetronome();

  if (timer.isPaused) {
    timer.start();
    return;
  }

  if (timer.state?.phase && timer.state.phase !== 'idle' && timer.state.phase !== 'finished') {
    timer.pause();
    return;
  }

  timer.start();
}

function handleReset() {
  timer.reset();
  metronome.stop();
}

function handleSelectPreset(presetId) {
  const preservePanelOpen = metronomePanelOpen;
  activePresetId = presetId || DEFAULT_PRESET_ID;
  setActivePreset(els, activePresetId);
  const preset = clonePreset(activePresetId);
  const merged = { ...activeSettings };
  for (const key of PRESET_FIELDS) merged[key] = preset[key];
  applySettings(merged);
  metronomePanelOpen = preservePanelOpen;
  renderCurrentState();
  closeSettings(els);
}

function handleSaveSettings() {
  applySettings(readSettingsForm(els));
  closeSettings(els);
}

function handleAdjustValue({ target, direction }, event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();

  const rule = STEP_RULES[target];
  if (!rule) return;
  const sign = direction === 'down' ? -1 : 1;
  const next = Math.min(rule.max, Math.max(rule.min, (activeSettings[target] ?? 0) + sign * rule.step));
  const draft = { ...activeSettings, [target]: next };

  if (target === 'metronomeBpm') {
    if (next === 0) {
      draft.metronomeEnabled = false;
      metronomePanelOpen = false;
    } else {
      metronomePanelOpen = true;
    }
  }

  applySettings(draft);
}

function handleToggleMetronome(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();

  const draft = { ...activeSettings };
  const willEnable = !draft.metronomeEnabled;

  draft.metronomeEnabled = willEnable;
  if (willEnable && (!draft.metronomeBpm || draft.metronomeBpm <= 0)) {
    draft.metronomeBpm = DEFAULT_METRONOME_BPM;
  }

  metronomePanelOpen = willEnable;
  applySettings(draft);
}

function handleSelectMetronomeMode(mode) {
  if (!mode) return;
  metronomePanelOpen = true;
  applySettings({ ...activeSettings, metronomeMode: mode });
}

function handleOpenMetronomeCard(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  if (metronomePanelOpen) return;
  metronomePanelOpen = true;
  renderCurrentState();
}

function bootstrap() {
  audio.setEnabled(activeSettings.audioEnabled);
  syncMetronome();
  setActivePreset(els, activePresetId);
  setSettingsForm(els, activeSettings);
  timer.applyConfig(activeSettings);
  bindPresetTabs(els, handleSelectPreset);
  bindControls(els, {
    onToggleRun: handleToggleRun,
    onReset: handleReset,
    onOpenSettings: () => openSettings(els),
    onCloseSettings: () => closeSettings(els),
    onSaveSettings: handleSaveSettings,
    onAdjustValue: handleAdjustValue,
    onToggleMetronome: handleToggleMetronome,
    onSelectMetronomeMode: handleSelectMetronomeMode,
    onOpenMetronomeCard: handleOpenMetronomeCard
  });
  renderCurrentState();
}

bootstrap();
