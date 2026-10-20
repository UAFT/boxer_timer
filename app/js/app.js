import { installWorkoutLibrary } from './library/library-ui.js';
import { installLocalization } from './i18n/locale.js';
import { AUDIO_KEYS } from './core/constants.js';
import { clonePreset } from './state/presets.js';
import { createLegacyProgramController } from './program/legacy-program-controller.js';
import { loadProfileState, saveProfileState, normalizeSettings } from './state/settings-store.js';
import { AudioEngine } from './audio/audio-engine.js';
import { MetronomeEngine } from './audio/metronome-engine.js';
import { TimerEngine } from './timer/timer-engine.js';
import { getDomRefs } from './ui/dom.js';
import {
  closeSettings,
  openSettings,
  readSettingsForm,
  renderTimer,
  renderLadderPreview,
  setActivePreset,
  setSettingsForm
} from './ui/render.js';
import { bindControls, bindPresetTabs } from './ui/bindings.js';

const DEFAULT_PRESET_ID = 'classic3';
const STEP_RULES = {
  workSec: { step: 5, min: 5, max: 3600 },
  restSec: { step: 5, min: 0, max: 3600 },
  rounds: { step: 1, min: 1, max: 99 },
  metronomeBpm: { step: 1, min: 0, max: 300 },
  workStepSec: { step: 5, min: -600, max: 600 },
  restStepSec: { step: 5, min: -600, max: 600 }
};
const DEFAULT_METRONOME_BPM = 20;
const PRESTART_COUNTDOWN_EVENTS = new Set(['prestart-count-4', 'prestart-count-3', 'prestart-count-2', 'prestart-count-1']);
const METRONOME_SUPPRESS_EVENTS = new Set(['round-end-zero', 'workout-end-zero']);
const ROUND_START_SYNC_EVENTS = new Set(['round-start-zero', 'rest-end-zero']);
const ZERO_TRANSITION_EVENTS = new Set(['round-start-zero', 'round-end-zero', 'rest-end-zero', 'workout-end-zero']);

const els = getDomRefs();
const audio = new AudioEngine();
const metronome = new MetronomeEngine(audio);

function isMetronomeLocked(settings) {
  return Number(settings?.warningSeconds ?? 0) === 10;
}

function coerceMetronomeForWarning(settings) {
  if (!isMetronomeLocked(settings)) return settings;
  return { ...settings, metronomeEnabled: false };
}

function resolveEventAudioSpec(event, settings) {
  if (PRESTART_COUNTDOWN_EVENTS.has(event.type)) {
    return { key: AUDIO_KEYS.WARNING_TICK, tag: 'countdown', volume: 1.25 };
  }

  if (event.type === 'warning-tick') {
    return { key: AUDIO_KEYS.WARNING_TICK, tag: 'warning', volume: 1.2 };
  }

  if (event.type === 'round-start-zero') {
    return { key: 'cue_round_start_v2', tag: 'transition', volume: 1.6 };
  }
  if (event.type === 'round-end-zero') {
    return { key: 'cue_rest_start_v2', tag: 'transition', volume: 1.6 };
  }
  if (event.type === 'rest-end-zero') {
    return { key: 'cue_round_start_v2', tag: 'transition', volume: 1.6 };
  }
  if (event.type === 'workout-end-zero') {
    return { key: 'cue_workout_end_v2', tag: 'transition', volume: 1.7 };
  }
  return null;
}

const profileState = loadProfileState();
const profiles = { ...profileState.profiles };
let activePresetId = profileState.activeId;
let activeSettings = normalizeSettings(profiles[activePresetId], clonePreset(activePresetId));
let libraryController = null;
let legacyProgram = null;
const uiState = {
  metronomePanel: 'collapsed',
  ladderExpanded: false
};

function isMetronomePanelOpen() {
  return uiState.metronomePanel === 'expanded';
}

function setMetronomePanel(panel, { render = true } = {}) {
  uiState.metronomePanel = panel === 'expanded' ? 'expanded' : 'collapsed';
  if (render) renderCurrentState();
}

function renderCurrentState() {
  renderTimer(els, { ...timer.state, config: timer.config, isPaused: timer.isPaused }, { metronomePanelOpen: isMetronomePanelOpen(), ladderExpanded: uiState.ladderExpanded });
  legacyProgram?.renderProgram();
}

const timer = new TimerEngine({
  onTick: (state) => {
    renderTimer(els, state, { metronomePanelOpen: isMetronomePanelOpen(), ladderExpanded: uiState.ladderExpanded });
    legacyProgram?.renderProgram();
    metronome.syncPhase(state);
  },
  onStateChange: (state) => {
    renderTimer(els, state, { metronomePanelOpen: isMetronomePanelOpen(), ladderExpanded: uiState.ladderExpanded });
    legacyProgram?.renderProgram();
    metronome.syncPhase(state);
  },
  onEvent: async (event) => {
    const spec = resolveEventAudioSpec(event, activeSettings);
    if (!spec) return;
    if (METRONOME_SUPPRESS_EVENTS.has(event.type)) {
      metronome.suppressFor(450);
    }
    if (ROUND_START_SYNC_EVENTS.has(event.type)) {
      metronome.armRoundStartCueSync();
    }
    if (ZERO_TRANSITION_EVENTS.has(event.type)) {
      audio.stopTag('warning');
      audio.stopTag('transition');
    }
    await audio.play(spec.key, { tag: spec.tag, volume: spec.volume });
  }
});

function syncMetronome() {
  metronome.setConfig({
    enabled: activeSettings.metronomeEnabled && isMetronomePanelOpen() && !isMetronomeLocked(activeSettings),
    bpm: activeSettings.metronomeBpm,
    mode: activeSettings.metronomeMode
  });
}

function applySettings(nextSettings) {
  activeSettings = coerceMetronomeForWarning(normalizeSettings(nextSettings, clonePreset(activePresetId)));
  if (isMetronomeLocked(activeSettings)) {
    setMetronomePanel('collapsed', { render: false });
  }
  profiles[activePresetId] = { ...activeSettings };
  saveProfileState(activePresetId, profiles);
  audio.setEnabled(activeSettings.audioEnabled);
  syncMetronome();
  if (legacyProgram?.isRunning()) legacyProgram.exitProgram();
  timer.applyConfig({ ...activeSettings, presetId: activePresetId });
  setSettingsForm(els, activeSettings);
  renderCurrentState();
}

async function handleToggleRun() {
  if (libraryController?.isActive()) return;
  await audio.unlock();
  syncMetronome();

  if (timer.isPaused) {
    timer.start();
    return;
  }

  if (timer.state?.phase && timer.state.phase !== 'idle' && timer.state.phase !== 'finished') {
    audio.stopAll();
    metronome.stop();
    timer.pause();
    return;
  }

  if (legacyProgram?.hasEntries() && !legacyProgram.isRunning()) { legacyProgram.startProgram(); return; }
  timer.start();
}

function handleReset() {
  if (libraryController?.isActive()) { libraryController.stop(); return; }
  if (legacyProgram?.isRunning()) { legacyProgram.exitProgram(); }
  audio.stopAll();
  timer.reset();
  metronome.stop();
}

function handleSelectPreset(presetId) {
  if (legacyProgram?.isRunning()) legacyProgram.exitProgram();
  if (!presetId || !['classic3', 'classic2', 'classic1', 'tabata2020x24'].includes(presetId)) return;
  activePresetId = presetId;
  setActivePreset(els, activePresetId);
  applySettings(normalizeSettings(profiles[activePresetId], clonePreset(activePresetId)));
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


function handleAdjustLadderStep({ target, direction }, event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  const rule = STEP_RULES[target];
  if (!rule || (target !== 'workStepSec' && target !== 'restStepSec')) return;
  const sign = direction === 'down' ? -1 : 1;
  const next = Math.min(rule.max, Math.max(rule.min, (activeSettings[target] ?? 0) + sign * rule.step));
  applySettings({ ...activeSettings, [target]: next, intervalMode: 'ladder' });
}

function handleToggleMetronome(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  if (isMetronomeLocked(activeSettings)) return;

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
  if (!mode || isMetronomeLocked(activeSettings)) return;
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
  if (isMetronomePanelOpen() || isMetronomeLocked(activeSettings)) return;

  const draft = { ...activeSettings };
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
  timer.applyConfig({ ...activeSettings, presetId: activePresetId });
  bindPresetTabs(els, handleSelectPreset);
  legacyProgram = createLegacyProgramController({
    els, audio, metronome, timer,
    getProfiles:()=>profiles,
    getActiveSettings:()=>activeSettings,
    getActivePresetId:()=>activePresetId,
    syncMetronome, renderCurrentState
  });
  legacyProgram.bindProgram();
  bindControls(els, {
    onToggleRun: handleToggleRun,
    onReset: handleReset,
    onOpenSettings: () => openSettings(els),
    onCloseSettings: () => closeSettings(els),
    onSaveSettings: handleSaveSettings,
    onPreviewChange: () => renderLadderPreview(els, activeSettings),
    onAdjustValue: handleAdjustValue,
    onAdjustLadderStep: handleAdjustLadderStep,
    onToggleMetronome: handleToggleMetronome,
    onSelectMetronomeMode: handleSelectMetronomeMode,
    onOpenMetronomeCard: handleOpenMetronomeCard
  });
  els.ladderExpand.addEventListener('click', () => {
    uiState.ladderExpanded = !uiState.ladderExpanded;
    renderCurrentState();
  });
  els.ladderFullPause.addEventListener('click', handleToggleRun);
  renderCurrentState();
  libraryController = installWorkoutLibrary({
    onStart: () => { void audio.unlock(); audio.stopAll(); metronome.stop(); if(legacyProgram?.isRunning())legacyProgram.exitProgram(); timer.reset(); },
    onStop: () => {},
    onCue: (kind) => { audio.stopTag('transition'); void audio.play(kind==='end'?'cue_workout_end_v2':kind==='rest'?'cue_rest_start_v2':'cue_round_start_v2',{tag:'transition',volume:1.5}); }
  });
  installLocalization(document.querySelectorAll('[data-language]'));
}

bootstrap();
