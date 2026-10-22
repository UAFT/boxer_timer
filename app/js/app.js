import { CATEGORIES, LIBRARY, stageForWorkout } from './library/native-adapter.js';
import { starterPrograms } from './core/starter-programs.js';
import { announceRound, stopVoice } from './audio/voice-coach.js';
import { installDeleteConfirmation } from './ui/delete-confirmation.js';
import { installTimerDisclosure } from './ui/timer-disclosure.js';
import { renderStageTitle } from './ui/stage-title.js';
import {stageTimingRows} from './ui/stage-timing-rows.js';
import {installTwoPhaseToggle} from './ui/two-phase-toggle.js';
import {installIntervalModeCombo} from './ui/interval-mode-combo.js';
import {isPlaybackProtected, applyPresetWithoutInterrupting, applyLiveMetronome} from './ui/playback-guard.js';
import {loadRoundTimingEditor,readRoundTimingEditor,saveRoundTiming} from './ui/round-time-editor.js';
import {hasLadder} from './core/ladder-blocks.js';
import {stageTwoPhaseLoad,stageTwoPhaseSave,roundTwoPhaseLoad,roundTwoPhaseSave} from './ui/two-phase-editor.js';
import { installWorkoutExchange } from './sharing/workout-exchange-ui.js';
import { storeImportedWorkout, resolveSenderSettings } from './sharing/workout-file.js';
import { renderSavedProgramCard, timeWords } from './ui/library-card-view.js';
import { syncEditorProgramHeader, editorProgramIdentity } from './ui/program-presentation.js';
import { renderPresetOrders } from './ui/preset-order.js';
import { editableRestField } from './core/ladder-blocks.js';
import { installLocalization } from './i18n/locale.js';
import { AUDIO_KEYS } from './core/constants.js';
import { clonePreset } from './state/presets.js';
import { compileProgram, normalizeProgram, normalizeOptions, normalizeLibrary, LIBRARY_KEY, PROGRAM_OPTIONS_KEY, PRESET_NAMES, PROGRAM_KEY } from './core/program.js';
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
  phaseTwoSec: { step: 5, min: 5, max: 3600 },
  restSec: { step: 5, min: 0, max: 3600 },
  rounds: { step: 1, min: 1, max: 99 },
  metronomeBpm: { step: 1, min: 0, max: 300 },
  workStepSec: { step: 5, min: -600, max: 600 },
  restStepSec: { step: 5, min: -600, max: 600 },
  phaseTwoStepSec: { step: 5, min: -600, max: 600 }
};
const DEFAULT_METRONOME_BPM = 20;
const PRESTART_COUNTDOWN_EVENTS = new Set(['prestart-count-4', 'prestart-count-3', 'prestart-count-2', 'prestart-count-1']);
const METRONOME_SUPPRESS_EVENTS = new Set(['round-end-zero', 'block-rest-start-zero', 'workout-end-zero']);
const ROUND_START_SYNC_EVENTS = new Set(['round-start-zero', 'rest-end-zero', 'block-rest-end-zero', 'phase-two-start-zero']);
const ZERO_TRANSITION_EVENTS = new Set(['round-start-zero', 'round-end-zero', 'rest-end-zero', 'block-rest-start-zero', 'block-rest-end-zero', 'phase-two-start-zero', 'workout-end-zero']);

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
  if (event.type === 'phase-two-start-zero') return { key: 'cue_round_start_v1', tag:'transition', volume:1.6 };
  if (event.type === 'round-end-zero') {
    return { key: 'cue_rest_start_v2', tag: 'transition', volume: 1.6 };
  }
  if (event.type === 'rest-end-zero') {
    return { key: 'cue_round_start_v2', tag: 'transition', volume: 1.6 };
  }
  if (event.type === 'block-rest-start-zero') {
    // A separate cue variant makes the block boundary recognizable by ear.
    return { key: 'cue_rest_start_v1', tag: 'transition', volume: 1.6 };
  }
  if (event.type === 'block-rest-end-zero') {
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
const phaseToggle=installTwoPhaseToggle({getSettings:()=>activeSettings,onSelect:()=>renderCurrentState()});
let programEntries = [];
try { programEntries = normalizeProgram(JSON.parse(localStorage.getItem(PROGRAM_KEY) || '[]')); } catch {}
let programOptions = normalizeOptions({});
let savedPrograms = [];
try { programOptions=normalizeOptions(JSON.parse(localStorage.getItem(PROGRAM_OPTIONS_KEY) || '{}')); } catch {}
try { savedPrograms=normalizeLibrary(JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]')); } catch {}
let openedProgramId = null;
let openedProgramName = '';
let libraryTab = 'mine';
let libraryCategory = null;
const builtInPrograms = [
  ...starterPrograms,
  {id:'built-box',name:'Классический бокс',entries:[{presetId:'classic3',title:'Раунды',restAfterSec:0,settings:{...clonePreset('classic3'),rounds:12,workSec:180,restSec:60}}],options:{cycles:1,cycleRestSec:60}},
  {id:'built-tech',name:'Разминка и техника',entries:[{presetId:'classic3',title:'Разминка',restAfterSec:60,settings:{...clonePreset('classic3'),rounds:1,workSec:180}},{presetId:'classic2',title:'Техника',restAfterSec:0,settings:{...clonePreset('classic2'),rounds:6,workSec:60,restSec:30}}],options:{cycles:1,cycleRestSec:60}},
  {id:'built-speed',name:'Скоростная работа',entries:[{presetId:'tabata2020x24',title:'Скорость',restAfterSec:0,settings:{...clonePreset('tabata2020x24'),rounds:4,workSec:20,restSec:20,intervalMode:'ladder',blockEnabled:true,blockCount:2,blockRestSec:20,workStepSec:0,restStepSec:0}}],options:{cycles:1,cycleRestSec:60}}
];
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

function previewProgram() { return programEntries.length ? compileProgram(programEntries, profiles, programOptions) : null; }
const timerDisclosure=installTimerDisclosure();
function syncTimerVisibility(){timerDisclosure.sync(programEntries.length>0,programRunning);}
function liveTimerSettings() {
  return isPlaybackProtected(timer,programRunning) ? timer.config : activeSettings;
}
function renderCurrentState() {
  renderTimer(els, { ...timer.state, config: timer.config, isPaused: timer.isPaused }, { metronomePanelOpen: isMetronomePanelOpen(), ladderExpanded: uiState.ladderExpanded, programName:openedProgramName, previewRounds: !programRunning && programEntries.length ? previewProgram() : null, editablePhase:phaseToggle.selected() });
  phaseToggle.render(liveTimerSettings(),timer?.state);
  renderProgram();
  syncTimerVisibility();
}

let timer;
timer = new TimerEngine({
  onTick: (state) => {
    renderTimer(els, state, { metronomePanelOpen: isMetronomePanelOpen(), ladderExpanded: uiState.ladderExpanded, programName:openedProgramName, previewRounds: !programRunning && programEntries.length ? previewProgram() : null, editablePhase:phaseToggle.selected() });
    phaseToggle.render(liveTimerSettings(),state);
    renderProgram();
    syncTimerVisibility();
    metronome.syncPhase(state);
  },
  onStateChange: (state) => {
    renderTimer(els, state, { metronomePanelOpen: isMetronomePanelOpen(), ladderExpanded: uiState.ladderExpanded, programName:openedProgramName, previewRounds: !programRunning && programEntries.length ? previewProgram() : null, editablePhase:phaseToggle.selected() });
    phaseToggle.render(liveTimerSettings(),state);
    renderProgram();
    syncTimerVisibility();
    metronome.syncPhase(state);
  },
  onEvent: async (event) => {
    const spec = resolveEventAudioSpec(event, timer.config);
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
    if (programRunning && timer.config.audioEnabled && ['round-start-zero','rest-end-zero','round-end-zero','block-rest-end-zero'].includes(event.type)) {
      const round=programSnapshot?.[Math.max(0,(event.roundIndex || timer.state.roundIndex)-1)];
      announceRound(event.type,round,document.documentElement.lang?.startsWith('en')?'en':'ru');
    }
  }
});

function syncMetronome() {
  const settings = liveTimerSettings();
  metronome.setConfig({
    enabled: settings.metronomeEnabled && isMetronomePanelOpen() && !isMetronomeLocked(settings),
    bpm: settings.metronomeBpm,
    mode: settings.metronomeMode
  });
}

function applySettings(nextSettings, { liveMetronome = false } = {}) {
  activeSettings = coerceMetronomeForWarning(normalizeSettings(nextSettings, clonePreset(activePresetId)));
  if (isMetronomeLocked(activeSettings)) {
    setMetronomePanel('collapsed', { render: false });
  }
  profiles[activePresetId] = { ...activeSettings };
  saveProfileState(activePresetId, profiles);
  // Browsing/adjusting a preset must never reset or replace the active workout.
  const updatedLive = applyPresetWithoutInterrupting(timer,
    { ...activeSettings, presetId: activePresetId }, {programRunning});
  if (updatedLive) audio.setEnabled(activeSettings.audioEnabled);
  else if (liveMetronome) applyLiveMetronome(timer,activeSettings);
  syncMetronome();
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
  stopVoice();
  if (programRunning) { exitProgram(); }
  audio.stopAll();
  timer.reset();
  metronome.stop();
}

function handleSelectPreset(presetId) {
  if (!presetId || !['classic3', 'classic2', 'classic1', 'tabata2020x24'].includes(presetId)) return;
  activePresetId = presetId;
  setActivePreset(els, activePresetId);
  applySettings(normalizeSettings(profiles[activePresetId], clonePreset(activePresetId)));
  closeSettings(els);
}

function handleSaveSettings() {
  applySettings({ ...activeSettings, ...readSettingsForm(els) });
  // A program stage may carry a saved preset snapshot. Keep its ladder/block
  // controls in sync with the preset the user just edited in Settings.
  if (programEntries.length && !programRunning) {
    const fields=['intervalMode','phaseTwoSec','phaseOneName','phaseTwoName','ladderEnabled','phaseTwoStepSec','blockEnabled','blockCount','blockRestSec','workStepSec','restStepSec'];
    let changed=false;
    for (const entry of programEntries) {
      if (!entry.settings || entry.presetId!==activePresetId) continue;
      for (const field of fields) entry.settings[field]=activeSettings[field];
      changed=true;
    }
    if (changed) persistProgram();
  }
  closeSettings(els);
}

function handleAdjustValue({ target, direction }, event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();

  const field = target==='workSec' ? phaseToggle.workTarget() : editableRestField(activeSettings, target);
  const rule = STEP_RULES[field];
  if (!rule) return;
  const sign = direction === 'down' ? -1 : 1;
  const next = Math.min(rule.max, Math.max(rule.min, (activeSettings[field] ?? 0) + sign * rule.step));
  const draft = { ...activeSettings, [field]: next };

  if (target === 'metronomeBpm') {
    if (next === 0) {
      draft.metronomeEnabled = false;
      setMetronomePanel('collapsed', { render: false });
    } else {
      draft.metronomeEnabled = true;
      setMetronomePanel('expanded', { render: false });
    }
  }

  applySettings(draft,{liveMetronome:target==='metronomeBpm'});
}


function handleAdjustLadderStep({ target, direction }, event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  const rule = STEP_RULES[target];
  if (!rule || !['workStepSec','restStepSec','phaseTwoStepSec'].includes(target)) return;
  const sign = direction === 'down' ? -1 : 1;
  const form=readSettingsForm(els);
  const next = Math.min(rule.max, Math.max(rule.min, (Number(form[target]) || 0) + sign * rule.step));
  applySettings({ ...activeSettings, ...form, [target]: next });
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
  applySettings(draft,{liveMetronome:true});
}

function handleSelectMetronomeMode(mode) {
  if (!mode || isMetronomeLocked(activeSettings)) return;
  const draft = { ...activeSettings, metronomeMode: mode, metronomeEnabled: true };
  if (!draft.metronomeBpm || draft.metronomeBpm <= 0) {
    draft.metronomeBpm = DEFAULT_METRONOME_BPM;
  }
  setMetronomePanel('expanded', { render: false });
  applySettings(draft,{liveMetronome:true});
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
  applySettings(draft,{liveMetronome:true});
}


function persistOptions() {
  localStorage.setItem(PROGRAM_OPTIONS_KEY, JSON.stringify(programOptions));
  renderCurrentState();
}
function persistProgram() {
  localStorage.setItem(PROGRAM_KEY, JSON.stringify(programEntries));
  if(!programEntries.length)timerDisclosure.reset();
  renderCurrentState();
}
function addProgramStage(presetId) {
  if (!PRESET_NAMES[presetId] || programRunning || programEntries.length >= 24) return;
  programEntries.push({ presetId, title:'', restAfterSec: 60, ...(presetId===activePresetId && activeSettings.intervalMode==='two_phase'?{settings:structuredClone(activeSettings)}:{}) });
  timerDisclosure.keepExpandedOnPresetAdd();
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
let roundEditorContext=null;
function closeRoundEditor() {
  document.getElementById('roundEditModal').hidden=true;
  const trigger=roundEditorContext?.trigger;
  roundEditorContext=null;
  trigger?.focus();
}
function renameProgramRound(stageIndex, roundIndex, description=false, trigger=null) {
  if (programRunning || !programEntries[stageIndex]) return;
  const stage=programEntries[stageIndex];
  const field=description?'roundDescriptions':'roundNames';
  const input=document.getElementById('roundEditInput');
  const en=document.documentElement.lang==='en';
  const label=description?(en?'Exercise description':'Описание упражнения'):(en?'Exercise name':'Название упражнения');
  roundEditorContext={stageIndex,roundIndex,field,description,trigger};
  document.getElementById('roundEditTitle').textContent=label;
  document.getElementById('roundEditLabel').textContent=label;
  document.getElementById('roundEditCancel').textContent=en?'Cancel':'Отмена';
  document.getElementById('roundEditSave').textContent=en?'Save':'Сохранить';
  input.maxLength=description?600:100;
  input.rows=description?5:2;
  input.value=stage[field]?.[roundIndex]||'';
  const roundConfig=stage.settings || profiles[stage.presetId];
  roundTwoPhaseLoad(stage,roundIndex,!description && roundConfig.intervalMode==='two_phase');
  loadRoundTimingEditor(stage,roundIndex,roundConfig,{hidden:description});
  document.getElementById('roundEditModal').hidden=false;
  input.focus();
  input.setSelectionRange(input.value.length,input.value.length);
}
function bindRoundEditor() {
  const modal=document.getElementById('roundEditModal');
  const input=document.getElementById('roundEditInput');
  document.getElementById('roundEditCancel').addEventListener('click',closeRoundEditor);
  document.getElementById('roundEditSave').addEventListener('click',()=>{
    const ctx=roundEditorContext;
    if (!ctx || programRunning || !programEntries[ctx.stageIndex]) return closeRoundEditor();
    const stage=programEntries[ctx.stageIndex];
    const roundConfig=stage.settings || profiles[stage.presetId];
    const timings=ctx.description?{}:readRoundTimingEditor(roundConfig,ctx.roundIndex);
    if(timings===null)return;
    const values=Array.isArray(stage[ctx.field])?[...stage[ctx.field]]:[];
    values[ctx.roundIndex]=input.value.trim().slice(0,ctx.description?600:100);
    stage[ctx.field]=values;
    if(!ctx.description){
      if(roundConfig.intervalMode==='two_phase')roundTwoPhaseSave(stage,ctx.roundIndex);
      saveRoundTiming(stage,ctx.roundIndex,roundConfig,timings);
    }
    closeRoundEditor();
    persistProgram();
  });
  modal.addEventListener('click',event=>{if(event.target===modal)closeRoundEditor();});
  modal.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();closeRoundEditor();}
    if(event.key==='Tab'){
      const controls=[input,...(document.getElementById('roundEditPhases').hidden?[]:[document.getElementById('roundEditPhaseOne'),document.getElementById('roundEditPhaseTwo')]),...(document.getElementById('roundEditTimes').hidden?[]:[...document.querySelectorAll('#roundEditTimes input:not(:disabled)')]),document.getElementById('roundEditCancel'),document.getElementById('roundEditSave')];
      const index=controls.indexOf(document.activeElement);
      if(index>=0){event.preventDefault();controls[(index+(event.shiftKey?controls.length-1:1))%controls.length].focus();}
    }
  });
}
function renameProgramStage(index) {
  if (programRunning || !programEntries[index]) return;
  const name = window.prompt('Название этапа', programEntries[index].title || '');
  if (name === null) return;
  programEntries[index].title = name.trim().slice(0,80);
  persistProgram();
}

let stageSettingsIndex = null;
function openStageSettings(index) {
  if(programRunning || !programEntries[index])return;
  stageSettingsIndex=index;
  const entry=programEntries[index], cfg=entry.settings || profiles[entry.presetId];
  const id=name=>document.getElementById('stageSettings'+name);
  id('Name').value=entry.title||'';
  for(const key of ['Work','Rest']){const v=Number(cfg[key==='Work'?'workSec':'restSec'])||0;id(key+'Min').value=Math.floor(v/60);id(key+'Sec').value=v%60;}
  for(const [key,value] of [['Rounds',cfg.rounds],
    ['WorkStep',cfg.workStepSec||0],['RestStep',cfg.restStepSec||0],['PhaseTwoStep',cfg.phaseTwoStepSec||0],
    ['Blocks',cfg.blockCount||2],['BlockRest',cfg.blockRestSec||60]])id(key).value=value;
  id('Mode').value=['ladder','two_phase'].includes(cfg.intervalMode)?cfg.intervalMode:'standard';
  id('LadderEnabled').checked=!!cfg.ladderEnabled;
  id('BlockEnabled').checked=!!cfg.blockEnabled;
  stageTwoPhaseLoad(cfg);
  syncStageSettingsMode();
  document.getElementById('stageSettingsModal').hidden=false;
}
function syncStageSettingsMode(){
  const mode=document.getElementById('stageSettingsMode').value;
  const ladder=hasLadder({intervalMode:mode,ladderEnabled:document.getElementById('stageSettingsLadderEnabled').checked});
  const work=document.getElementById('stageSettingsWorkMin').closest('label');
  const workGrid=document.querySelector('#stageSettingsModal .stage-settings-grid');
  const workSlot=document.getElementById('stageSettingsPhaseOneTimeSlot');
  if(mode==='two_phase'){
    workSlot.append(work);
  }else if(work.parentElement!==workGrid){
    workGrid.insertBefore(work,document.getElementById('stageSettingsRestMin').closest('label'));
  }
  document.getElementById('stageSettingsWorkCaption').textContent=mode==='two_phase'?'Время фазы 1':'Работа';
  document.querySelectorAll('[data-stage-mode]').forEach(b=>{
    const selected=b.dataset.stageMode===mode || (mode==='two_phase'&&ladder&&b.dataset.stageMode==='ladder');
    b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));
  });
  document.getElementById('stageSettingsLadder').hidden=!ladder;
  document.getElementById('stageSettingsPhaseTwoStepField').hidden=mode!=='two_phase'||!ladder;
  document.getElementById('stageSettingsTwoPhase').hidden=mode!=='two_phase';
  document.getElementById('stageSettingsBlockFields').hidden=!ladder || !document.getElementById('stageSettingsBlockEnabled').checked;
}
function closeStageSettings(){
  document.getElementById('stageSettingsModal').hidden=true;stageSettingsIndex=null;
}
function bindStageSettings(){
  const id=name=>document.getElementById('stageSettings'+name);
  installIntervalModeCombo({buttons:[...document.querySelectorAll('[data-stage-mode]')].map(b=>{b.dataset.intervalMode=b.dataset.stageMode;return b;}),
    modeInput:id('Mode'),enabledInput:id('LadderEnabled'),onChange:syncStageSettingsMode});
  id('BlockEnabled').addEventListener('change',syncStageSettingsMode);
  for(const key of ['WorkMin','WorkSec','RestMin','RestSec','PhaseTwoMin','PhaseTwoSec','Rounds']){
    const input=id(key), unit=key==='Rounds'?1:1, min=key.endsWith('Sec')?0:key==='Rounds'?1:0;
    const max=key.endsWith('Sec')?59:key==='Rounds'?99:60;
    const parent=input.parentElement;
    const control=document.createElement('div');control.className='stage-number-control';
    const minus=document.createElement('button');minus.type='button';minus.textContent='−';minus.setAttribute('aria-label','Уменьшить '+key);
    const plus=document.createElement('button');plus.type='button';plus.textContent='+';plus.setAttribute('aria-label','Увеличить '+key);
    const adjust=(delta)=>{input.value=String(Math.max(min,Math.min(max,(Number(input.value)||0)+delta)));};
    for(const [button,sign] of [[minus,-1],[plus,1]]){
      let delay=null,repeat=null,held=false;
      const stop=()=>{clearTimeout(delay);clearInterval(repeat);delay=null;repeat=null;};
      button.addEventListener('pointerdown',e=>{
        if(e.button!==0)return;
        held=false;stop();
        delay=setTimeout(()=>{held=true;adjust(sign*5);repeat=setInterval(()=>adjust(sign*5),110);},450);
      });
      button.addEventListener('pointerup',()=>{stop();if(!held)adjust(sign*unit);held=false;});
      button.addEventListener('pointercancel',stop);
      button.addEventListener('lostpointercapture',stop);
      button.addEventListener('contextmenu',e=>e.preventDefault());
    }
    input.replaceWith(control);control.append(minus,input,plus);
  }
  id('Cancel').addEventListener('click',closeStageSettings);
  document.getElementById('stageSettingsModal').addEventListener('click',event=>{
    if(event.target.id==='stageSettingsModal')closeStageSettings();
  });
  id('Save').addEventListener('click',()=>{
    const index=stageSettingsIndex;
    if(index===null || programRunning || !programEntries[index])return;
    const specs=[['Rounds',1,99],['PhaseTwoStep',-600,600],['WorkStep',-600,600],
      ['RestStep',-600,600],['Blocks',1,99],['BlockRest',0,3600]];
    const values={};
    for(const [key,min,max] of specs){
      const input=id(key),n=Number(input.value);
      if(!Number.isFinite(n)||!Number.isInteger(n)||n<min||n>max){
        input.focus();input.reportValidity();return;
      }
      values[key]=n;
    }
    for(const key of ['Work','Rest']){const min=Number(id(key+'Min').value),sec=Number(id(key+'Sec').value);if(!Number.isInteger(min)||!Number.isInteger(sec)||min<0||min>60||sec<0||sec>59||(key==='Work'&&min*60+sec<5)){id(key+'Min').focus();return;}values[key]=min*60+sec;}
    const entry=programEntries[index];
    const cfg=structuredClone(entry.settings || profiles[entry.presetId]);
    Object.assign(cfg,{workSec:values.Work,restSec:values.Rest,rounds:values.Rounds,
      workStepSec:values.WorkStep,restStepSec:values.RestStep,phaseTwoStepSec:values.PhaseTwoStep,
      ladderEnabled:id('Mode').value==='two_phase'&&id('LadderEnabled').checked,
      intervalMode:['ladder','two_phase'].includes(id('Mode').value)?id('Mode').value:'standard',
      blockEnabled:(id('Mode').value==='ladder'||(id('Mode').value==='two_phase'&&id('LadderEnabled').checked))&&id('BlockEnabled').checked,
      blockCount:values.Blocks,blockRestSec:values.BlockRest});
    if(cfg.intervalMode==='two_phase' && !stageTwoPhaseSave(cfg))return;
    // Keep the original library task labels where possible; extra rounds remain editable.
    entry.settings=cfg;
    entry.title=id('Name').value.trim().slice(0,80);
    closeStageSettings();persistProgram();
  });
}

function startProgram() {
  if (!programEntries.length || isPlaybackProtected(timer,programRunning)) return;
  audio.stopAll();
  metronome.stop();
  programSnapshot = compileProgram(programEntries,profiles,programOptions);
  if (!programSnapshot.length) return;
  programRunning = true;
  timer.applyConfig({ ...activeSettings, presetId: activePresetId, programRounds: programSnapshot, intervalMode:'standard' });
  syncMetronome();
  renderCurrentState();
  timer.start();
}
function exitProgram() {
  stopVoice();
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

function formatProgramTime(sec) {return String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');}
function stageTiming(entry) {
  const rounds=compileProgram([entry],profiles,{cycles:1});
  const total=rounds.reduce((sum,round)=>sum+round.workSec+(round.phaseTwoSec||0)+round.restSec+(round.blockRestSec||0),0);
  return {rounds,total};
}
function stageTimingText(entry) {
  const cfg=entry.settings||profiles[entry.presetId];
  const {rounds,total}=stageTiming(entry);
  const blocks=hasLadder(cfg) && cfg.blockEnabled ? Math.max(1,Number(cfg.blockCount)||1) : 1;
  return { detail: (blocks>1?russianRoundCount(cfg.rounds)+' × '+russianBlockCount(blocks):russianRoundCount(rounds.length))
    +' · работа '+formatProgramTime(cfg.workSec)+' · отдых '+formatProgramTime(cfg.restSec)
    +(blocks>1?' · между блоками '+formatProgramTime(cfg.blockRestSec):''), total };
}
function renderProgram() {
  const panel=document.getElementById('programPanel');
  if (!panel) return;
  panel.hidden=false;
  syncEditorProgramHeader(document,{name:openedProgramName,entries:programEntries,profiles,options:programOptions,lang:document.documentElement.lang});
  document.getElementById('programStart').hidden=programRunning || !programEntries.length;
  document.getElementById('programStart').disabled=isPlaybackProtected(timer,programRunning);
  document.getElementById('programCycleCount').textContent=String(programOptions.cycles);
  document.getElementById('programCycleRestRow').hidden=programOptions.cycles===1;
  document.getElementById('programCycleRestValue').textContent=formatProgramTime(programOptions.cycleRestSec);
  document.querySelector('.program-cycle-panel').querySelectorAll('button').forEach(b=>b.disabled=programRunning);
  document.getElementById('programSaveOpen').disabled=programRunning || !programEntries.length;
  document.getElementById('programLibraryOpen').disabled=false;
  document.getElementById('programExit').hidden=!programRunning;
  renderPresetOrders(els.presetTabs, programEntries);
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
      const cfg=entry.settings || profiles[entry.presetId];
      const heading=renderStageTitle(document,i+1,entry.title,{mode:cfg.intervalMode==='two_phase'?'Две фазы':cfg.intervalMode==='ladder'?'Лестница':''});
      const detail=document.createElement('small');
      const kind=document.createElement('small');kind.className='program-stage-kind';
      kind.textContent=['ladder','two_phase'].includes(cfg.intervalMode) ? '' : (entry.presetId==='tabata2020x24' ? 'Скоростной' : '');
      detail.className='program-stage-timing';
      const timing=stageTiming(entry), english=document.documentElement.lang==='en';
      timing.manual=entry.roundTimingOverrides?.some(Boolean);
      for(const [klass,text] of stageTimingRows(cfg,timing,english)){const item=document.createElement('span');item.className=klass;item.textContent=text;detail.append(item);}
      main.append(heading);if(kind.textContent)main.append(kind);stage.append(main);
      if (!programRunning) {
        const edit=document.createElement('button');edit.type='button';edit.textContent='✎';edit.className='program-stage-edit';edit.setAttribute('aria-label','Настройки этапа '+(i+1));edit.addEventListener('click',()=>openStageSettings(i));stage.append(edit);
        for (const [label,fn] of [['↑',()=>moveProgramStage(i,-1)],['↓',()=>moveProgramStage(i,1)],['×',()=>removeProgramStage(i)]]) {
          const b=document.createElement('button');b.type='button';b.textContent=label;b.setAttribute('aria-label',label==='×'?'Удалить этап':label==='↑'?'Поднять этап':'Опустить этап');b.addEventListener('click',fn);stage.append(b);
        }
      }
      card.append(stage,detail);
      if (!programRunning) {
        const rounds=compileProgram([entry],profiles,{cycles:1}).length;
        const editor=document.createElement('div');editor.className='program-round-editor';
        for(let j=0;j<rounds;j++) {
          const line=document.createElement('div');line.className='program-round-edit-row';
          const label=document.createElement('span');
          const local=hasLadder(cfg)&&cfg.blockEnabled ? (j%Math.max(1,cfg.rounds))+1 : j+1;
          const block=hasLadder(cfg)&&cfg.blockEnabled&&cfg.blockCount>1 ? 'Блок '+(Math.floor(j/Math.max(1,cfg.rounds))+1)+' · ' : '';
          label.textContent=block+'Раунд '+local+' · '+(entry.roundNames?.[j]|| (cfg.intervalMode==='two_phase' ? [entry.phaseOneOverrides?.[j]||cfg.phaseOneName||'Фаза 1',entry.phaseTwoOverrides?.[j]||cfg.phaseTwoName||'Фаза 2'].join(' / ') : 'Без названия'));
          const edit=document.createElement('button');edit.type='button';edit.textContent='✎';edit.setAttribute('aria-label','Название раунда '+(j+1));edit.addEventListener('click',()=>renameProgramRound(i,j,false,edit));
          const desc=document.createElement('button');desc.type='button';desc.textContent='≡';desc.setAttribute('aria-label','Описание раунда '+(j+1));desc.addEventListener('click',()=>renameProgramRound(i,j,true,desc));
          line.append(label,edit,desc);editor.append(line);
        }
        card.append(editor);
      }
      if (i<programEntries.length-1) {
        const rest=document.createElement('div');rest.className='program-rest';
        const label=document.createElement('span');label.className='program-rest-label';label.textContent='Отдых между этапами';
        const minus=document.createElement('button');minus.textContent='−';minus.disabled=programRunning;minus.addEventListener('click',()=>setProgramRest(i,-5));
        const time=document.createElement('strong');time.textContent=String(Math.floor(entry.restAfterSec/60)).padStart(2,'0')+':'+String(entry.restAfterSec%60).padStart(2,'0');
        const plus=document.createElement('button');plus.textContent='+';plus.disabled=programRunning;plus.addEventListener('click',()=>setProgramRest(i,5));
        const controls=document.createElement('div');controls.className='program-rest-controls';controls.append(time,minus,plus);rest.append(label,controls);card.append(rest);
      }
      list.append(card);
    });
    list.dataset.signature=signature;
  }
  for (const card of list.querySelectorAll('.program-stage-card')) card.classList.toggle('is-current',Number(card.dataset.stage)===activeIndex);
}
function bindProgramLibrary() {
  const byId=id=>document.getElementById(id);
  const library=byId('programLibraryModal');
  const save=byId('programSaveModal');
  const confirmDeletion=installDeleteConfirmation();
  const close=()=>{library.hidden=true;save.hidden=true;};
  function persistLibrary() {localStorage.setItem(LIBRARY_KEY,JSON.stringify(savedPrograms));}
  const exchange=installWorkoutExchange({
    getSavedPrograms:()=>savedPrograms,
    isRunning:()=>programRunning,
    prepareExport:program=>resolveSenderSettings(program,profiles),
    onImported:program=>{
      const id='pimport-'+Date.now()+'-'+Math.random().toString(36).slice(2,10);
      savedPrograms=storeImportedWorkout(savedPrograms,program,localStorage,LIBRARY_KEY,id);
      libraryTab='mine';libraryCategory=null;
      renderLibrary();
    }
  });
  function snapshot(name,id) {
    return {id,name,entries:normalizeProgram(programEntries.map(x=>({...x,settings:x.settings || structuredClone(profiles[x.presetId])}))),options:normalizeOptions(programOptions)};
  }
  function openEntry(entry, builtIn=false) {
    if (isPlaybackProtected(timer,programRunning)) return;
    programEntries=normalizeProgram(entry.entries);
    programOptions=normalizeOptions(entry.options);
    openedProgramId=builtIn?null:entry.id;
    openedProgramName=entry.name;
    localStorage.setItem(PROGRAM_KEY,JSON.stringify(programEntries));
    localStorage.setItem(PROGRAM_OPTIONS_KEY,JSON.stringify(programOptions));
    timer.applyConfig({...activeSettings,presetId:activePresetId});
    close();renderCurrentState();
  }
  function renderLibrary() {
    const list=byId('programLibraryList');list.replaceChildren();
    byId('ftWorkoutExchangeToolbar').hidden=libraryTab!=='mine';
    exchange.refresh();
    byId('programLibraryMine').classList.toggle('is-active',libraryTab==='mine');
    byId('programLibraryTemplates').classList.toggle('is-active',libraryTab==='templates');
    const back=byId('programLibraryBack');
    back.hidden=libraryTab!=='templates' || !libraryCategory;
    byId('programLibraryTitle').textContent=libraryTab==='mine'?'Мои программы':libraryCategory?(CATEGORIES.find(x=>x[0]===libraryCategory)?.[1]||'Библиотека'):'Разделы';
    if(libraryTab==='templates' && !libraryCategory) {
      for(const [id,label] of CATEGORIES) {
        const button=document.createElement('button');button.type='button';
        button.className='program-library-entry-open';button.textContent=label;
        button.addEventListener('click',()=>{libraryCategory=id;renderLibrary();});
        const row=document.createElement('div');row.className='program-library-entry';row.append(button);list.append(row);
      }
      return;
    }
    if(libraryTab==='templates') {
      for(const workout of LIBRARY.filter(x=>x.category===libraryCategory)) {
        const row=document.createElement('div');row.className='program-library-entry';
        const info=document.createElement('div');info.className='native-library-info';
        const title=document.createElement('strong');title.textContent=workout.name;
        const description=document.createElement('small');description.textContent=workout.tasks.join(' · ');
        const preview=stageForWorkout(workout);
        if(preview){
          const cfg=preview.settings;
          const timing=document.createElement('small');timing.className='native-library-timing';
          const meta=stageTimingText(preview);
          timing.textContent=meta.detail;
          const total=document.createElement('small');total.className='native-library-total';
          total.textContent='Всего: '+timeWords(meta.total,document.documentElement.lang);
          info.append(title,timing,total,description);
        }else info.append(title,description);
        const plus=document.createElement('button');plus.type='button';plus.className='native-library-add';plus.textContent='+';
        const supported=!!stageForWorkout(workout);plus.disabled=!supported || programRunning || programEntries.length>=24;
        plus.setAttribute('aria-label','Добавить '+workout.name);
        if(!supported) description.textContent+=' · требует отдельного режима таймера';
        plus.addEventListener('click',()=>{
          const stage=stageForWorkout(workout);if(!stage||programRunning||programEntries.length>=24)return;
          programEntries.push(stage);persistProgram();
          plus.textContent='✓';setTimeout(()=>{plus.textContent='+';},800);
        });
        row.append(info,plus);list.append(row);
      }
      return;
    }
    for(const entry of savedPrograms) {
      list.append(renderSavedProgramCard(document,entry,profiles,{
        lang:document.documentElement.lang,
        onOpen:()=>openEntry(entry,false),
        onShareButton:()=>exchange.shareButton(entry),
        onDelete:del=>confirmDeletion({name:entry.name,trigger:del,onConfirm:()=>{
          savedPrograms=savedPrograms.filter(x=>x.id!==entry.id);
          if(openedProgramId===entry.id)openedProgramId=null;
          persistLibrary();renderLibrary();renderCurrentState();
        }})
      }));
    }
  }
  byId('programLibraryOpen').addEventListener('click',()=>{libraryTab='mine';libraryCategory=null;renderLibrary();library.hidden=false;});
  byId('programLibraryClose').addEventListener('click',close);
  byId('programLibraryBack').addEventListener('click',()=>{libraryCategory=null;renderLibrary();});
  byId('programLibraryMine').addEventListener('click',()=>{libraryTab='mine';libraryCategory=null;renderLibrary();});
  byId('programLibraryTemplates').addEventListener('click',()=>{libraryTab='templates';libraryCategory=null;renderLibrary();});
  const current=byId('programSaveCurrent'),fields=byId('programSaveNewFields');
  const overwrite=byId('programSaveOverwrite');
  byId('programSaveOpen').addEventListener('click',()=>{
    const existing=editorProgramIdentity(openedProgramId,savedPrograms);
    current.hidden=!existing;current.textContent=existing?.name||'';
    overwrite.hidden=!existing;fields.hidden=true;
    byId('programNameInput').value='';save.hidden=false;
  });
  byId('programSaveClose').addEventListener('click',close);
  overwrite.addEventListener('click',()=>{
    const existing=editorProgramIdentity(openedProgramId,savedPrograms);
    if(!existing)return;
    savedPrograms=savedPrograms.map(x=>x.id===existing.id?snapshot(existing.name,existing.id):x);
    openedProgramName=existing.name;persistLibrary();close();renderCurrentState();
  });
  byId('programSaveCopy').addEventListener('click',()=>{
    fields.hidden=false;byId('programNameInput').focus();
  });
  byId('programSaveCreate').addEventListener('click',()=>{
    const name=byId('programNameInput').value.trim();if(!name||savedPrograms.length>=100)return;
    const id='p'+Date.now()+'-'+Math.random().toString(36).slice(2,8);
    savedPrograms.push(snapshot(name,id));openedProgramId=id;openedProgramName=name;
    persistLibrary();close();renderCurrentState();
  });
  for (const [id,key,delta] of [['programCycleMinus','cycles',-1],['programCyclePlus','cycles',1],['programCycleRestMinus','cycleRestSec',-5],['programCycleRestPlus','cycleRestSec',5]]) {
    byId(id).addEventListener('click',()=>{if(programRunning)return;const limit=key==='cycles'?20:3600;const min=key==='cycles'?1:0;programOptions=normalizeOptions({...programOptions,[key]:Math.max(min,Math.min(limit,programOptions[key]+delta))});persistOptions();});
  }
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
  document.getElementById('programClear').addEventListener('click',()=>{if(!programRunning){programEntries=[];openedProgramName='';openedProgramId=null;persistProgram();}});
  document.getElementById('programStart').addEventListener('click',async()=>{await audio.unlock();startProgram();});
  document.getElementById('programExit').addEventListener('click',()=>{if(programRunning)exitProgram();});
  bindProgramLibrary();
}

function bootstrap() {
  audio.setEnabled(activeSettings.audioEnabled);
  syncMetronome();
  setActivePreset(els, activePresetId);
  setSettingsForm(els, activeSettings);
  timer.applyConfig({ ...activeSettings, presetId: activePresetId });
  bindPresetTabs(els, handleSelectPreset);
  bindStageSettings();
  bindProgram();
  bindRoundEditor();
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
