import {syncLadderStepLabels} from './ladder-step-labels.js';
import { PHASES } from '../core/constants.js';
import {hasLadder} from '../core/ladder-blocks.js';
import { formatTime } from '../core/time.js';
import {buildLadderPlanRows,syncLadderPlanRows,ladderPlanPhaseCaption,ladderPlanControl} from './ladder-plan-rows.js';
import { displayDurationsForState, remainingTotalSecForState, totalDurationSecForConfig, workSecForRound, phaseTwoSecForRound, restSecAfterRound, blockRestSecAfterRound, totalRoundsForConfig, blockCount, localRoundFor, blockForRound } from '../core/schedule.js';

function intervalModeTitle(config) {
  return config?.intervalMode==='count_up' ? 'Таймер' : config?.programRounds?.length ? 'Программа' : (config?.presetId === 'tabata2020x24' ? 'Скоростной' : (config?.intervalMode === 'ladder' ? 'Лестница' : config?.intervalMode==='two_phase'?'Две фазы':'Обычный'));
}

function phaseLabelText(state) {
  const modeTitle = intervalModeTitle(state?.config);
  if (state.isPaused) return `Пауза · ${modeTitle}`;
  switch (state.phase) {
    case PHASES.COUNTDOWN:
      return `Отсчёт · ${modeTitle}`;
    case PHASES.COUNT_UP:
      return 'Прямой отсчёт';
    case PHASES.WORK:
      return `Работа · ${modeTitle}`;
    case PHASES.REST:
      return `Отдых · ${modeTitle}`;
    case PHASES.BLOCK_REST:
      return `Между блоками · ${modeTitle}`;
    case PHASES.FINISHED:
      return 'Готово';
    default:
      return `Готов · ${modeTitle}`;
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
  if (!hasLadder(config)) return '';
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

  const row=state.config.programRounds?.[Math.max(0,state.roundIndex-1)];
  const countUpActive=state.phase===PHASES.COUNT_UP;
  const countUpStandalone=state.config.intervalMode==='count_up'&&!state.config.programRounds?.length;
  const hasUnboundedTime=countUpStandalone||state.config.programRounds?.some(r=>r.intervalMode==='count_up');
  document.body.classList.toggle('ft-count-up-standalone',Boolean(countUpStandalone));
  document.body.classList.toggle('ft-unbounded-program',Boolean(hasUnboundedTime));
  els.finishStageBtn.hidden=!countUpActive;
  els.mainTime.textContent = formatTime(state.remainingSec);
  els.phaseLabel.textContent = state.config.programRounds?.length && state.phase === PHASES.WORK && !state.config.programRounds?.[state.roundIndex-1]?.phaseTwoSec ? '' : phaseLabelText(state);
  els.roundLabel.textContent = roundLabelText(state);
  const roundActive = [PHASES.WORK, PHASES.WORK_TWO, PHASES.REST, PHASES.BLOCK_REST, PHASES.COUNTDOWN, PHASES.COUNT_UP].includes(state.phase);
  els.roundLabel.classList.toggle('round-active', roundActive);
  if (roundActive && state.config.programRounds?.length) {
    const r=state.config.programRounds[Math.max(0,state.roundIndex-1)];
    const stages=new Set(state.config.programRounds.map(x=>x.stageIndex)).size;
    els.roundLabel.textContent='Этап '+(r.stageIndex+1)+'/'+stages+(r.blockCount>1?' · Блок '+r.block+'/'+r.blockCount:'')+' · Раунд '+(r.blockCount>1?r.localRound:r.stageRound)+'/'+(r.blockCount>1?r.localRounds:r.stageRounds)+(r.roundName?' · '+r.roundName:'');
    if(countUpActive)els.roundLabel.textContent='Этап '+(r.stageIndex+1)+' из '+stages+' · Таймер';
  } else if (roundActive && !countUpActive) {
    const blocks = blockCount(state.config);
    els.roundLabel.innerHTML = blocks > 1
      ? `Блок <span class="block-number">${blockForRound(state.config, state.roundIndex)}</span>/${blocks} · Раунд <span class="round-number">${localRoundFor(state.config, state.roundIndex)}</span>/${state.config.rounds}`
      : `Раунд <span class="round-number">${state.roundIndex}</span> из ${state.totalRounds}`;
  }
  if(countUpStandalone)els.roundLabel.textContent='';
  renderLiveLadder(els, state, uiState);
  els.phaseCaption.textContent = intervalCaption(state.config);
  els.countdownCaption.textContent = '';
  els.progressFill.style.width = `${state.progress || 0}%`;

  const displayDurations = displayDurationsForState(state);
  const hasPhaseTwo=row?row.phaseTwoSec>0:state.config.intervalMode==='two_phase';
  const selected=state.phase===PHASES.WORK_TWO?2:state.phase===PHASES.WORK?1:(uiState.editablePhase||1);
  els.metricWork.textContent = countUpStandalone?'—':formatTime(hasPhaseTwo&&selected===2?(row?.phaseTwoSec||state.config.phaseTwoSec||40):displayDurations.workSec);
  els.metricRest.textContent = countUpStandalone?'—':formatTime(displayDurations.restSec);
  els.metricRounds.textContent = countUpStandalone?'—':String(state.config.rounds);
  els.metricMetronome.textContent = String(state.config.metronomeBpm ?? 0);
  els.metricTotal.textContent = hasUnboundedTime?'—':formatTime(totalDurationSecForConfig(state.config));
  els.metricRemaining.textContent = hasUnboundedTime?'—':formatTime(remainingTotalSecForState(state));
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


function escapeStageTitle(value) {return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function renderLiveLadder(els, state, ui = {}) {
  const panel = els.ladderLive;
  if (!panel) return;
  const preview = Boolean(ui.previewRounds?.length && !state.config.programRounds?.length);
  const config = preview ? { ...state.config, programRounds: ui.previewRounds } : state.config;
  panel.hidden = !['ladder','two_phase'].includes(config.intervalMode) && !config.programRounds?.length;
  const ladderTitle = panel.querySelector('.ladder-live-head strong');
  if (ladderTitle) ladderTitle.textContent = config.programRounds?.length ? 'ПЛАН ТРЕНИРОВКИ'+(ui.programName?' — '+ui.programName:'') : (config.intervalMode==='two_phase'?(config.ladderEnabled?'ДВЕ ФАЗЫ · ЛЕСТНИЦА':'ДВЕ ФАЗЫ'):'ЛЕСТНИЦА');
  if (panel.hidden) return;
  const expanded = Boolean(ui.ladderExpanded);
  panel.classList.toggle('is-expanded', expanded);
  els.ladderExpand.textContent = expanded ? '⤡' : '⤢';
  els.ladderExpand.setAttribute('aria-expanded', String(expanded));
  els.ladderExpand.setAttribute('aria-label', expanded ? 'Свернуть лестницу' : 'Развернуть лестницу');
  els.ladderFullControls.hidden = !expanded;
  const total = totalDurationSecForConfig(config);
  const remaining = preview ? total : remainingTotalSecForState(state);
  const unbounded=config.intervalMode==='count_up'||config.programRounds?.some(r=>r.intervalMode==='count_up');
  document.getElementById('ladderProgramTotal').textContent = unbounded?'—':formatTime(total);
  document.getElementById('ladderProgramRemaining').textContent = unbounded?'—':formatTime(remaining);
  document.getElementById('ladderCurrentLabel').textContent = ladderPlanPhaseCaption(state,{preview});
  els.ladderFullTime.textContent = preview ? formatTime(total) : formatTime(state.remainingSec);
  const control=ladderPlanControl(state,{preview});
  els.ladderFullPause.disabled=control.disabled;
  els.ladderFullPause.innerHTML=control.play?'<span aria-hidden="true">▶</span>':'<span aria-hidden="true">Ⅱ</span>';
  els.ladderFullPause.setAttribute('aria-label',control.label);

  const list = els.ladderLiveList;
  const key = config.programRounds?.length ? JSON.stringify(config.programRounds) : [config.rounds, config.workSec, config.restSec, config.workStepSec, config.restStepSec, config.phaseTwoStepSec, config.ladderEnabled, config.blockEnabled, config.blockCount, config.blockRestSec,config.intervalMode,config.phaseTwoSec,config.phaseOneName,config.phaseTwoName].join(':');
  if (list.dataset.scheduleKey !== key) {
    list.innerHTML = buildLadderPlanRows(config);
    list.dataset.scheduleKey=key;
    list.dataset.activeRound='';
  }
  syncLadderPlanRows(list,state,{preview});
}

export function renderLadderPreview(els, settings) {
  const panel = document.getElementById('ladderPreview');
  if (!panel) return;
  const config = { ...settings, ...readSettingsForm(els) };
  panel.hidden=config.intervalMode==='count_up';
  if(panel.hidden)return;
  const rounds = totalRoundsForConfig(config);
  const count = Math.min(rounds, 12);
  const rows = [];
  for (let i = 1; i <= count; i += 1) {
    if(blockCount(config)>1 && localRoundFor(config,i)===1)rows.push(`<div class="settings-inline-note">Блок ${blockForRound(config,i)} из ${blockCount(config)}</div>`);
    if(config.intervalMode==='two_phase') {
      rows.push('<div class="ladder-preview-row"><span>Раунд '+i+' · Фаза 1</span><strong>'+formatTime(workSecForRound(config,i))+'</strong><span>Фаза 2</span><strong>'+formatTime(phaseTwoSecForRound(config,i))+'</strong></div>');
      if(i<rounds)rows.push('<div class="settings-inline-note">Отдых: '+formatTime(restSecAfterRound(config,i))+'</div>');
    } else {
      rows.push('<div class="ladder-preview-row"><span>Раунд '+localRoundFor(config,i)+'</span><strong>'+formatTime(workSecForRound(config,i))+'</strong><span>Отдых</span><strong>'+(i<rounds?formatTime(restSecAfterRound(config,i)):'—')+'</strong></div>');
    }
    const pause=blockRestSecAfterRound(config,i);
    if(pause>0)rows.push(`<div class="settings-inline-note">Отдых между блоками: ${formatTime(pause)}</div>`);
  }
  panel.innerHTML = `<div class="ladder-preview-title">Предварительный просмотр</div>${rows.join('')}${rounds > count ? `<div class="settings-inline-note">Показаны первые ${count} из ${rounds} раундов</div>` : ''}${hasLadder(config) && !config.workStepSec && !config.restStepSec && !config.phaseTwoStepSec ? '<div class="settings-inline-note">Все шаги равны нулю: все раунды будут одинаковыми.</div>' : ''}`;
}

export function setSettingsForm(els, settings) {
  els.audioEnabledInput.checked = settings.audioEnabled;
  els.warningSecondsInput.value = String(settings.warningSeconds ?? 4);
  els.intervalModeInput.value = settings.intervalMode || 'standard';
  els.ladderEnabledInput.checked = Boolean(settings.ladderEnabled);
  syncLadderStepLabels(document,{intervalMode:els.intervalModeInput.value,ladderEnabled:els.ladderEnabledInput.checked});
  const ladder=hasLadder(settings);
  document.getElementById('ladderStepsFields').hidden=!ladder;
  document.getElementById('phaseTwoStepFields').hidden=!ladder||settings.intervalMode!=='two_phase';
  document.getElementById('intervalModeExplainer').hidden=!ladder;
  document.getElementById('countUpExplainer').hidden=settings.intervalMode!=='count_up';
  els.blockSettings.hidden = !ladder;
  els.blockEnabledInput.checked = Boolean(settings.blockEnabled);
  els.blockCountInput.value = String(settings.blockCount ?? 1);
  els.blockRestSecInput.value = String(settings.blockRestSec ?? 90);
  els.blockCountDisplay.textContent = els.blockCountInput.value;
  els.blockRestSecDisplay.textContent = formatTime(Number(els.blockRestSecInput.value));
  els.workStepSecInput.value = String(settings.workStepSec ?? 0);
  els.restStepSecInput.value = String(settings.restStepSec ?? 0);
  els.phaseTwoStepSecInput.value = String(settings.phaseTwoStepSec ?? 0);
  els.phaseTwoStepSecDisplay.textContent=stepLabel(settings.phaseTwoStepSec??0);
  if (els.workStepSecDisplay) els.workStepSecDisplay.textContent = stepLabel(settings.workStepSec ?? 0);
  if (els.restStepSecDisplay) els.restStepSecDisplay.textContent = stepLabel(settings.restStepSec ?? 0);
  applyChoiceButtons(els.warningChoiceButtons, els.warningSecondsInput.value, 'warningSeconds');
  els.intervalModeButtons.forEach(button=>{
    const selected=button.dataset.intervalMode===els.intervalModeInput.value ||
      (button.dataset.intervalMode==='ladder'&&settings.intervalMode==='two_phase'&&settings.ladderEnabled);
    button.classList.toggle('is-active',selected);
    button.setAttribute('aria-pressed',String(selected));
  });
  renderLadderPreview(els, settings);
}

export function readSettingsForm(els) {
  return {
    audioEnabled: els.audioEnabledInput.checked,
    warningSeconds: Number(els.warningSecondsInput.value || '0'),
    intervalMode: els.intervalModeInput.value || 'standard',
    ladderEnabled: els.intervalModeInput.value === 'two_phase' && els.ladderEnabledInput.checked,
    phaseTwoStepSec:Number(els.phaseTwoStepSecInput.value||'0'),
    // Keep the owner's block toggle even if another mode temporarily hides it.
    blockEnabled: els.blockEnabledInput.checked,
    blockCount: Number(els.blockCountInput.value),
    blockRestSec: Number(els.blockRestSecInput.value),
    workStepSec: Number(els.workStepSecInput.value || '0'),
    restStepSec: Number(els.restStepSecInput.value || '0')
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
