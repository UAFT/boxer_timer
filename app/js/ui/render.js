import { PHASES } from '../core/constants.js';
import { formatTime } from '../core/time.js';
import { displayDurationsForState, remainingTotalSecForState, totalDurationSecForConfig, workSecForRound, restSecAfterRound, totalRoundsForConfig, blockCount, localRoundFor, blockForRound } from '../core/schedule.js';

function intervalModeTitle(config) {
  return config?.programRounds?.length ? 'Программа' : (config?.presetId === 'tabata2020x24' ? 'Скоростной' : (config?.intervalMode === 'ladder' ? 'Лестница' : 'Обычный'));
}

function programStageMode(round) {
  return round.presetId === 'tabata2020x24' ? 'Скоростной' : (round.intervalMode === 'ladder' ? 'Лестница' : 'Обычный');
}

function phaseLabelText(state) {
  const modeTitle = intervalModeTitle(state?.config);
  if (state.isPaused) return `Пауза · ${modeTitle}`;
  switch (state.phase) {
    case PHASES.COUNTDOWN:
      return `Отсчёт · ${modeTitle}`;
    case PHASES.WORK:
      return `Работа · ${modeTitle}`;
    case PHASES.REST:
      return `Отдых · ${modeTitle}`;
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
  const roundActive = [PHASES.WORK, PHASES.REST, PHASES.COUNTDOWN].includes(state.phase);
  els.roundLabel.classList.toggle('round-active', roundActive);
  if (roundActive && state.config.programRounds?.length) {
    const r=state.config.programRounds[Math.max(0,state.roundIndex-1)];
    const stages=new Set(state.config.programRounds.map(x=>x.stageIndex)).size;
    els.roundLabel.innerHTML='Этап <span class="block-number">'+(r.stageIndex+1)+'</span>/'+stages+' · Раунд <span class="round-number">'+r.stageRound+'</span>/'+r.stageRounds;
  } else if (roundActive) {
    const blocks = blockCount(state.config);
    els.roundLabel.innerHTML = blocks > 1
      ? `Блок <span class="block-number">${blockForRound(state.config, state.roundIndex)}</span>/${blocks} · Раунд <span class="round-number">${localRoundFor(state.config, state.roundIndex)}</span>/${state.config.rounds}`
      : `Раунд <span class="round-number">${state.roundIndex}</span> из ${state.totalRounds}`;
  }
  renderLiveLadder(els, state, uiState);
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


export function renderLiveLadder(els, state, ui = {}) {
  const panel = els.ladderLive;
  if (!panel) return;
  const config = state.config;
  panel.hidden = config.intervalMode !== 'ladder' && !config.programRounds?.length;
  const ladderTitle = panel.querySelector('.ladder-live-head strong');
  if (ladderTitle) ladderTitle.textContent = config.programRounds?.length ? 'ПРОГРАММА' : 'ЛЕСТНИЦА';
  if (panel.hidden) return;
  const expanded = Boolean(ui.ladderExpanded);
  panel.classList.toggle('is-expanded', expanded);
  els.ladderExpand.textContent = expanded ? '⤡' : '⤢';
  els.ladderExpand.setAttribute('aria-expanded', String(expanded));
  els.ladderExpand.setAttribute('aria-label', expanded ? 'Свернуть лестницу' : 'Развернуть лестницу');
  els.ladderFullControls.hidden = !expanded;
  els.ladderFullTime.textContent = formatTime(state.remainingSec);
  els.ladderFullPause.textContent = state.phase === PHASES.IDLE || state.phase === PHASES.FINISHED
    ? 'Старт' : state.isPaused ? 'Продолжить' : 'Пауза';

  const list = els.ladderLiveList;
  const key = config.programRounds?.length ? JSON.stringify(config.programRounds) : [config.rounds, config.workSec, config.restSec, config.workStepSec, config.restStepSec, config.blockEnabled, config.blockCount, config.blockRestSec].join(':');
  if (list.dataset.scheduleKey !== key) {
    const rows = [];
    let openStage = false;
    for (let i = 1; i <= totalRoundsForConfig(config); i += 1) {
      const pr=config.programRounds?.[i-1];
      if (pr && pr.stageRound===1) {
        if (openStage) rows.push('</section>');
        rows.push('<section class="ladder-stage-group" data-stage-group="'+pr.stageIndex+'">');
        openStage = true;
        rows.push('<div class="ladder-block-label" data-stage="'+pr.stageIndex+'">Этап '+(pr.stageIndex+1)+' · '+programStageMode(pr)+'</div>');
      }
      if (pr && pr.blockCount>1 && pr.localRound===1) rows.push('<div class="ladder-block-label" data-block="'+pr.block+'" data-stage="'+pr.stageIndex+'">Блок '+pr.block+' из '+pr.blockCount+'</div>');
      if (!pr && blockCount(config) > 1 && localRoundFor(config,i) === 1) rows.push(`<div class="ladder-block-label" data-block="${blockForRound(config,i)}">Блок ${blockForRound(config,i)} из ${blockCount(config)}</div>`);
      const rest = i < totalRoundsForConfig(config) ? formatTime(restSecAfterRound(config, i)) : '—';
      rows.push(`<div class="ladder-live-row" data-round="${i}"><span class="ladder-plan">Раунд ${pr ? pr.localRound : localRoundFor(config, i)} · ${formatTime(workSecForRound(config, i))} · отдых ${rest}</span><strong class="ladder-count"></strong></div>`);
    }
    if (openStage) rows.push('</section>');
    list.innerHTML = rows.join('');
    list.dataset.scheduleKey = key;
    list.dataset.activeRound = '';
  }

  const active = [PHASES.WORK, PHASES.REST, PHASES.COUNTDOWN].includes(state.phase) ? state.roundIndex : 0;
  const currentProgramRound = config.programRounds?.[active-1];
  const currentBlock = active > 0 ? (currentProgramRound?.block ?? blockForRound(config, active)) : 0;
  for (const group of list.querySelectorAll('.ladder-stage-group')) {
    group.classList.toggle('is-active', active > 0 && Number(group.dataset.stageGroup) === currentProgramRound?.stageIndex);
  }
  for (const heading of list.querySelectorAll('.ladder-block-label')) {
    heading.classList.toggle('is-active', currentProgramRound ? Number(heading.dataset.stage)===currentProgramRound.stageIndex && (!heading.dataset.block || Number(heading.dataset.block)===currentBlock) : Number(heading.dataset.block)===currentBlock);
  }
  for (const row of list.querySelectorAll('.ladder-live-row')) {
    const current = Number(row.dataset.round) === active;
    row.classList.toggle('is-active', current);
    const countdown = row.querySelector('.ladder-count');
    countdown.textContent = current ? (state.phase === PHASES.REST ? 'Отдых ' : state.phase === PHASES.COUNTDOWN ? 'старт ' : '→ ') + formatTime(state.remainingSec) : '';
  }

  if (list.dataset.activeRound !== String(active)) {
    list.dataset.activeRound = String(active);
    if (!active) list.scrollTop = 0;
    else {
      const row = list.querySelector(`[data-round="${active}"]`);
      if (row && row.offsetTop + row.offsetHeight > list.scrollTop + list.clientHeight) {
        list.scrollTo({ top: row.offsetTop + row.offsetHeight - list.clientHeight, behavior: 'smooth' });
      }
    }
  }
}

export function renderLadderPreview(els, settings) {
  const panel = document.getElementById('ladderPreview');
  if (!panel) return;
  const config = { ...settings, ...readSettingsForm(els) };
  const rounds = Math.max(1, Number(config.rounds || 1));
  const count = Math.min(rounds, 8);
  const rows = [];
  for (let i = 1; i <= count; i += 1) {
    rows.push(`<div class="ladder-preview-row"><span>Раунд ${i}</span><strong>${formatTime(workSecForRound(config, i))}</strong><span>Отдых</span><strong>${i < rounds ? formatTime(restSecAfterRound(config, i)) : '—'}</strong></div>`);
  }
  panel.innerHTML = `<div class="ladder-preview-title">Предварительный просмотр</div>${rows.join('')}${rounds > count ? `<div class="settings-inline-note">Показаны первые ${count} из ${rounds} раундов</div>` : ''}${config.intervalMode === 'ladder' && !config.workStepSec && !config.restStepSec ? '<div class="settings-inline-note">Оба шага равны нулю: все раунды будут одинаковыми.</div>' : ''}`;
}

export function setSettingsForm(els, settings) {
  els.audioEnabledInput.checked = settings.audioEnabled;
  els.warningSecondsInput.value = String(settings.warningSeconds ?? 4);
  els.intervalModeInput.value = settings.intervalMode || 'standard';
  els.blockSettings.hidden = settings.intervalMode !== 'ladder';
  els.blockEnabledInput.checked = Boolean(settings.blockEnabled);
  els.blockCountInput.value = String(settings.blockCount ?? 1);
  els.blockRestSecInput.value = String(settings.blockRestSec ?? 90);
  els.blockCountDisplay.textContent = els.blockCountInput.value;
  els.blockRestSecDisplay.textContent = formatTime(Number(els.blockRestSecInput.value));
  els.workStepSecInput.value = String(settings.workStepSec ?? 0);
  els.restStepSecInput.value = String(settings.restStepSec ?? 0);
  if (els.workStepSecDisplay) els.workStepSecDisplay.textContent = stepLabel(settings.workStepSec ?? 0);
  if (els.restStepSecDisplay) els.restStepSecDisplay.textContent = stepLabel(settings.restStepSec ?? 0);
  applyChoiceButtons(els.warningChoiceButtons, els.warningSecondsInput.value, 'warningSeconds');
  applyChoiceButtons(els.intervalModeButtons, els.intervalModeInput.value, 'intervalMode');
  renderLadderPreview(els, settings);
}

export function readSettingsForm(els) {
  return {
    audioEnabled: els.audioEnabledInput.checked,
    warningSeconds: Number(els.warningSecondsInput.value || '0'),
    intervalMode: els.intervalModeInput.value || 'standard',
    blockEnabled: els.intervalModeInput.value === 'ladder' && els.blockEnabledInput.checked,
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
