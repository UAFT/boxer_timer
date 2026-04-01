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
const PRESET_FIELDS = ['rounds', 'workSec', 'restSec'];
const PRESTART_COUNTDOWN_EVENTS = new Set(['prestart-count-3', 'prestart-count-2', 'prestart-count-1']);
const TRANSITION_AUDIO_EVENTS = new Set(['round-start-zero', 'round-end-zero', 'rest-end-zero', 'workout-end-zero']);

const els = getDomRefs();
const audio = new AudioEngine();
const metronome = new MetronomeEngine();

function resolveEventAudioKey(event, settings) {
  if (PRESTART_COUNTDOWN_EVENTS.has(event.type)) {
    return (settings.countdownEnabled && event.type === 'prestart-count-3') ? AUDIO_KEYS.COUNTDOWN_321 : null;
  }

  if (event.type === 'warning-tick') {
    return AUDIO_KEYS.WARNING_TICK;
  }

  if (event.type === 'round-start-zero' || event.type === 'rest-end-zero') {
    return `cue_round_start_${settings.workStartCueVariant || 'v2'}`;
  }
  if (event.type === 'round-end-zero') {
    return `cue_rest_start_${settings.restStartCueVariant || 'v2'}`;
  }
  if (event.type === 'workout-end-zero') {
    return `cue_workout_end_${settings.workoutEndCueVariant || 'v2'}`;
  }
  return null;
}

let activePresetId = DEFAULT_PRESET_ID;
let activeSettings = loadSettings(clonePreset(DEFAULT_PRESET_ID));
const uiState = {
  metronomePanel: 'collapsed'
};

function isMetronomePanelOpen() {
  return uiState.metronomePanel === 'expanded';
}

function setMetronomePanel(panel, { render = true } = {}) {
  uiState.metronomePanel = panel === 'expanded' ? 'expanded' : 'collapsed';
  if (render) renderCurrentState();
}

function renderCurrentState() {
  renderTimer(els, timer.state, { metronomePanelOpen: isMetronomePanelOpen() });
}

const timer = new TimerEngine({
  onTick: (state) => {
    renderTimer(els, state, { metronomePanelOpen: isMetronomePanelOpen() });
    metronome.syncPhase(state);
  },
  onStateChange: (state) => {
    renderTimer(els, state, { metronomePanelOpen: isMetronomePanelOpen() });
    metronome.syncPhase(state);
  },
  onEvent: async (event) => {
    const key = resolveEventAudioKey(event, activeSettings);
    if (!key) return;
    if (TRANSITION_AUDIO_EVENTS.has(event.type)) {
      audio.stopAll();
    }
    await audio.play(key);
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
  await audio.unlock();
  await metronome.unlock();
  await audio.preloadAll();
  syncMetronome();

  if (timer.isPaused) {
    timer.start();
    return;
  }

  if (timer.state?.phase && timer.state.phase !== 'idle' && timer.state.phase !== 'finished') {
    audio.stopAll();
    timer.pause();
    return;
  }

  timer.start();
}

function handleReset() {
  audio.stopAll();
  timer.reset();
  metronome.stop();
}

function handleSelectPreset(presetId) {
  activePresetId = presetId || DEFAULT_PRESET_ID;
  setActivePreset(els, activePresetId);
  const preset = clonePreset(activePresetId);
  const merged = { ...activeSettings };
  for (const key of PRESET_FIELDS) merged[key] = preset[key];
  applySettings(merged);
  closeSettings(els);
}

function handleSaveSettings() {
  applySettings({ ...activeSettings, ...readSettingsForm(els) });
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
      setMetronomePanel('collapsed', { render: false });
    } else {
      draft.metronomeEnabled = true;
      setMetronomePanel('expanded', { render: false });
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

  setMetronomePanel(willEnable ? 'expanded' : 'collapsed', { render: false });
  applySettings(draft);
}

function handleSelectMetronomeMode(mode) {
  if (!mode) return;
  const draft = { ...activeSettings, metronomeMode: mode, metronomeEnabled: true };
  if (!draft.metronomeBpm || draft.metronomeBpm <= 0) {
    draft.metronomeBpm = DEFAULT_METRONOME_BPM;
  }
  setMetronomePanel('expanded', { render: false });
  applySettings(draft);
}

function handleOpenMetronomeCard(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  if (isMetronomePanelOpen()) return;

  const draft = {
    ...activeSettings,
    metronomeEnabled: true,
    metronomeMode: activeSettings.metronomeMode || 'direct'
  };
  if (!draft.metronomeBpm || draft.metronomeBpm <= 0) {
    draft.metronomeBpm = DEFAULT_METRONOME_BPM;
  }

  setMetronomePanel('expanded', { render: false });
  applySettings(draft);
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
