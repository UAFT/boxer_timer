import { AUDIO_KEYS } from './core/constants.js';
import { clonePreset } from './state/presets.js';
import { loadSettings, normalizeSettings, saveSettings } from './state/settings-store.js';
import { AudioEngine } from './audio/audio-engine.js';
import { TimerEngine } from './timer/timer-engine.js';
import { getDomRefs } from './ui/dom.js';
import {
  closeSettings,
  openSettings,
  readSettingsForm,
  renderAudioStatus,
  renderDebug,
  renderTimer,
  setActivePreset,
  setSettingsForm
} from './ui/render.js';
import { bindControls, bindPresetTabs } from './ui/bindings.js';

const DEFAULT_PRESET_ID = 'classic3';
const els = getDomRefs();
const audio = new AudioEngine();

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

const timer = new TimerEngine({
  onTick: (state) => {
    renderTimer(els, state);
  },
  onStateChange: (state) => {
    renderTimer(els, state);
  },
  onEvent: async (event) => {
    const countdownAudioKey = COUNTDOWN_EVENT_TO_AUDIO[event.type];
    if (countdownAudioKey) {
      await audio.play(countdownAudioKey);
      updateAudioDebug();
      return;
    }

    const zeroAudioKey = ZERO_EVENT_TO_AUDIO[event.type];
    if (zeroAudioKey) {
      await audio.play(zeroAudioKey);
      updateAudioDebug();
    }
  }
});

function updateAudioDebug() {
  const missing = audio.getMissingAudioKeys();
  renderAudioStatus(els, {
    enabled: activeSettings.audioEnabled,
    missingCount: missing.length
  });

  renderDebug(
    els,
    [
      `preset: ${activePresetId}`,
      `audioEnabled: ${activeSettings.audioEnabled}`,
      `missingAudio: ${missing.length ? missing.join(', ') : 'none'}`,
      `contract: countdown=3/2/1, zero-cue=separate event, local-only runtime`
    ].join('\n')
  );
}

function applySettings(nextSettings) {
  activeSettings = normalizeSettings(nextSettings, clonePreset(activePresetId));
  saveSettings(activeSettings);
  audio.setEnabled(activeSettings.audioEnabled);
  timer.applyConfig(activeSettings);
  setSettingsForm(els, activeSettings);
  updateAudioDebug();
}

async function handleStart() {
  await audio.preloadAll();
  updateAudioDebug();
  timer.start();
}

function handlePause() {
  timer.pause();
}

function handleReset() {
  timer.reset();
}

function handleSelectPreset(presetId) {
  activePresetId = presetId || DEFAULT_PRESET_ID;
  setActivePreset(els, activePresetId);
  applySettings(clonePreset(activePresetId));
  closeSettings(els);
}

function handleSaveSettings() {
  applySettings(readSettingsForm(els));
  closeSettings(els);
}

function bootstrap() {
  audio.setEnabled(activeSettings.audioEnabled);
  setActivePreset(els, activePresetId);
  setSettingsForm(els, activeSettings);
  timer.applyConfig(activeSettings);
  bindPresetTabs(els, handleSelectPreset);
  bindControls(els, {
    onStart: handleStart,
    onPause: handlePause,
    onReset: handleReset,
    onOpenSettings: () => openSettings(els),
    onCloseSettings: () => closeSettings(els),
    onSaveSettings: handleSaveSettings
  });
  updateAudioDebug();
}

bootstrap();
