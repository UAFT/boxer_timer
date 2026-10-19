import { installLocalization } from './i18n/locale.js';
import { AUDIO_KEYS } from './core/constants.js';
import { clonePreset } from './state/presets.js';
import { compileProgram, normalizeProgram, PRESET_NAMES, PROGRAM_KEY } from './core/program.js';
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
let programEntries = [];
try { programEntries = normalizeProgram(JSON.parse(localStorage.getItem(PROGRAM_KEY) || '[]')); } catch {}
let programRunning = false;
let programSnapshot = null;
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
  renderProgram();
}

const timer = new TimerEngine({
  onTick: (state) => {
    renderTimer(els, state, { metronomePanelOpen: isMetronomePanelOpen(), ladderExpanded: uiState.ladderExpanded });
    renderProgram();
    metronome.syncPhase(state);
  },
  onStateChange: (state) => {
    renderTimer(els, state, { metronomePanelOpen: isMetronomePanelOpen(), ladderExpanded: uiState.ladderExpanded });
    renderProgram();
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
  if (programRunning) exitProgram();
  timer.applyConfig({ ...activeSettings, presetId: activePresetId });
  setSettingsForm(els, activeSettings);
  renderCurrentState();
}

async function handleToggleRun() {
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

  if (programEntries.length && !programRunning) { startProgram(); return; }
  timer.start();
}

function handleReset() {
  if (programRunning) { exitProgram(); }
  audio.stopAll();
  timer.reset();
  metronome.stop();
}

function handleSelectPreset(presetId) {
  if (programRunning) exitProgram();
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


function persistProgram() {
  localStorage.setItem(PROGRAM_KEY, JSON.stringify(programEntries));
  renderProgram();
}
function addProgramStage(presetId) {
  if (!PRESET_NAMES[presetId] || programRunning || programEntries.length >= 24) return;
  programEntries.push({ presetId, restAfterSec: 60 });
  persistProgram();
}
function removeProgramStage(index) {
  if (programRunning) return;
  programEntries.splice(index,1);
  persistProgram();
}
function moveProgramStage(index, delta) {
  if (programRunning || index+delta<0 || index+delta>=programEntries.length) return;
  [programEntries[index],programEntries[index+delta]]=[programEntries[index+delta],programEntries[index]];
  persistProgram();
}
function setProgramRest(index,delta) {
  if (programRunning || !programEntries[index]) return;
  programEntries[index].restAfterSec = Math.max(0,Math.min(3600,programEntries[index].restAfterSec+delta));
  persistProgram();
}
function startProgram() {
  if (!programEntries.length) return;
  audio.stopAll();
  metronome.stop();
  programSnapshot = compileProgram(programEntries,profiles);
  if (!programSnapshot.length) return;
  programRunning = true;
  timer.applyConfig({ ...activeSettings, presetId: activePresetId, programRounds: programSnapshot, intervalMode:'standard' });
  syncMetronome();
  renderCurrentState();
  timer.start();
}
function exitProgram() {
  programRunning=false;
  programSnapshot=null;
  timer.applyConfig({ ...activeSettings, presetId: activePresetId });
  renderCurrentState();
}
function russianRoundCount(count) {
  const n = Math.abs(Number(count));
  const lastTwo = n % 100;
  const suffix = lastTwo >= 11 && lastTwo <= 14 ? 'раундов'
    : n % 10 === 1 ? 'раунд'
    : n % 10 >= 2 && n % 10 <= 4 ? 'раунда' : 'раундов';
  return String(count) + ' ' + suffix;
}

function russianBlockCount(count) {
  const n = Math.abs(Number(count));
  const lastTwo = n % 100;
  const suffix = lastTwo >= 11 && lastTwo <= 14 ? 'блоков'
    : n % 10 === 1 ? 'блок'
    : n % 10 >= 2 && n % 10 <= 4 ? 'блока' : 'блоков';
  return String(count) + ' ' + suffix;
}

function renderProgram() {
  const panel=document.getElementById('programPanel');
  if (!panel) return;
  panel.hidden=!programEntries.length;
  document.getElementById('programStart').hidden=programRunning;
  document.getElementById('programExit').hidden=!programRunning;
  for (const tab of els.presetTabs) {
    const positions=programEntries.flatMap((entry,i)=>entry.presetId===tab.dataset.preset?[i+1]:[]);
    tab.classList.toggle('has-program',positions.length>0);
    let badge=tab.querySelector('.preset-order');
    if (!badge) {badge=document.createElement('span');badge.className='preset-order';tab.append(badge);}
    badge.replaceChildren(...positions.map(i=>{const b=document.createElement('b');b.textContent=String(i);return b;}));
  }
  const list=document.getElementById('programList');
  const activeIndex=programRunning && timer.state.roundIndex>0 ? programSnapshot?.[timer.state.roundIndex-1]?.stageIndex : -1;
  // Stage entries reference live preset profiles; refresh details when a preset changes.
  // During playback, keep the compiled program snapshot stable.
  const signature=JSON.stringify([programEntries,programRunning,programRunning ? null : programEntries.map(entry=>profiles[entry.presetId])]);
  if (list.dataset.signature!==signature) {
    list.replaceChildren();
    programEntries.forEach((entry,i)=>{
      const card=document.createElement('div');card.className='program-stage-card';card.dataset.stage=String(i);
      const stage=document.createElement('div');stage.className='program-stage';
      const main=document.createElement('div');main.className='program-stage-main';
      const name=document.createElement('strong');name.textContent='Этап '+(i+1)+' · '+PRESET_NAMES[entry.presetId];
      const detail=document.createElement('small');const cfg=profiles[entry.presetId];
      detail.textContent=cfg.intervalMode==='ladder' ? 'Лестница · '+russianRoundCount(cfg.rounds)+(cfg.blockEnabled?' · '+russianBlockCount(cfg.blockCount):'') : (entry.presetId==='tabata2020x24' ? 'Скоростной' : 'Обычный')+' · '+russianRoundCount(cfg.rounds)+' · '+String(Math.floor(cfg.workSec/60)).padStart(2,'0')+':'+String(cfg.workSec%60).padStart(2,'0');
      main.append(name,detail);stage.append(main);
      if (!programRunning) {
        for (const [label,fn] of [['↑',()=>moveProgramStage(i,-1)],['↓',()=>moveProgramStage(i,1)],['×',()=>removeProgramStage(i)]]) {
          const b=document.createElement('button');b.type='button';b.textContent=label;b.setAttribute('aria-label',label==='×'?'Удалить этап':label==='↑'?'Поднять этап':'Опустить этап');b.addEventListener('click',fn);stage.append(b);
        }
      }
      card.append(stage);
      if (i<programEntries.length-1) {
        const rest=document.createElement('div');rest.className='program-rest';
        const label=document.createElement('span');label.textContent='Отдых между этапами';
        const minus=document.createElement('button');minus.textContent='−';minus.disabled=programRunning;minus.addEventListener('click',()=>setProgramRest(i,-5));
        const time=document.createElement('strong');time.textContent=String(Math.floor(entry.restAfterSec/60)).padStart(2,'0')+':'+String(entry.restAfterSec%60).padStart(2,'0');
        const plus=document.createElement('button');plus.textContent='+';plus.disabled=programRunning;plus.addEventListener('click',()=>setProgramRest(i,5));
        rest.append(label,minus,time,plus);card.append(rest);
      }
      list.append(card);
    });
    list.dataset.signature=signature;
  }
  for (const card of list.querySelectorAll('.program-stage-card')) card.classList.toggle('is-current',Number(card.dataset.stage)===activeIndex);
}
function bindProgram() {
  let hold=null;
  for (const tab of els.presetTabs) {
    let consumed=false;
    const cancel=()=>{if(hold!==null){clearTimeout(hold);hold=null;}};
    tab.addEventListener('pointerdown',e=>{
      if(e.button!==0) return;
      consumed=false;cancel();
      hold=setTimeout(()=>{hold=null;consumed=true;addProgramStage(tab.dataset.preset);},550);
    });
    tab.addEventListener('pointerup',cancel);
    tab.addEventListener('pointercancel',cancel);
    tab.addEventListener('pointerleave',cancel);
    tab.addEventListener('contextmenu',e=>e.preventDefault());
    tab.addEventListener('click',e=>{if(consumed){e.stopImmediatePropagation();e.preventDefault();consumed=false;}},true);
  }
  document.getElementById('programClear').addEventListener('click',()=>{if(!programRunning){programEntries=[];persistProgram();}});
  document.getElementById('programStart').addEventListener('click',async()=>{await audio.unlock();startProgram();});
  document.getElementById('programExit').addEventListener('click',exitProgram);
}

function bootstrap() {
  audio.setEnabled(activeSettings.audioEnabled);
  syncMetronome();
  setActivePreset(els, activePresetId);
  setSettingsForm(els, activeSettings);
  timer.applyConfig({ ...activeSettings, presetId: activePresetId });
  bindPresetTabs(els, handleSelectPreset);
  bindProgram();
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
  installLocalization(document.querySelectorAll('[data-language]'));
}

bootstrap();
