import {stageModeLabel} from './stage-mode-label.js';
// One presentation source for independent round rest and inter-block rest.
import {totalRoundsForConfig,workSecForRound,phaseTwoSecForRound,restSecAfterRound,blockRestSecAfterRound,blockCount,blockForRound,localRoundFor} from '../core/schedule.js';
import {formatTime} from '../core/time.js';
import {PHASES} from '../core/constants.js';
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Stage count comes from the compiled program, not total rounds or block count.
// Repeated cycles reuse stageIndex and must not inflate the total stage count.
const programStageCount=config=>new Set((config?.programRounds||[]).map(row=>row.stageIndex).filter(Number.isInteger)).size;
const stagePosition=(index,total)=>'Этап '+(index+1)+' из '+total;

export function ladderPlanPhaseCaption(state,{preview=false}={}){
 if(preview||state.phase===PHASES.IDLE)return '';
 if(state.phase===PHASES.FINISHED)return 'Завершено';
 if(state.phase===PHASES.COUNTDOWN)return 'Старт';
 const row=state.config?.programRounds?.[Math.max(0,(state.roundIndex||1)-1)];
 const two=Boolean(row?.phaseTwoSec)||state.config?.intervalMode==='two_phase';
 if(state.phase===PHASES.COUNT_UP)return (row?stagePosition(row.stageIndex,programStageCount(state.config))+' · ':'')+'Таймер';
 const phase=state.phase===PHASES.WORK?(two?'Фаза 1':'Работа')
  :state.phase===PHASES.WORK_TWO?'Фаза 2'
  :state.phase===PHASES.REST?'Отдых'
  :state.phase===PHASES.BLOCK_REST?'Отдых между блоками':'';
 const stage=row?stagePosition(row.stageIndex,programStageCount(state.config))+' · ':'';
 const block=row?.blockCount>1?'Блок '+row.block+' из '+row.blockCount+' · ':'';
 const round=row?(row.blockCount>1?row.localRound:row.stageRound):state.roundIndex;
 return stage+block+'Раунд '+round+(phase?' · '+phase:'');
}
export function ladderPlanControl(state,{preview=false}={}){
 const idle=state.phase===PHASES.IDLE||state.phase===PHASES.FINISHED;
 const canStart=preview||idle,canPause=!preview&&!idle;
 return {disabled:!canStart&&!canPause,play:canStart||Boolean(state.isPaused),
  label:canStart?(preview?'Запустить программу':'Запустить тренировку'):state.isPaused?'Продолжить':'Пауза'};
}
export function buildLadderPlanRows(config){
 const rows=[];let stageOpen=false,blockOpen=false;
 const stageTotal=programStageCount(config);
 const closeBlock=()=>{if(blockOpen){rows.push('</div>');blockOpen=false;}};
 const closeStage=()=>{closeBlock();if(stageOpen){rows.push('</div>');stageOpen=false;}};
 for(let i=1;i<=totalRoundsForConfig(config);i++){
  const pr=config.programRounds?.[i-1];
  if(pr&&pr.stageRound===1){
   closeStage();
   if(pr.stageIndex===0&&pr.cycles>1)rows.push('<div class="ladder-cycle-label">Цикл '+(pr.cycleIndex+1)+' из '+pr.cycles+'</div>');
   rows.push('<div class="ladder-stage-outline">');stageOpen=true;
  }
  if(pr&&pr.blockCount>1&&pr.localRound===1){closeBlock();rows.push('<div class="ladder-block-outline">');blockOpen=true;}
  if(pr&&pr.stageRound===1){
   const stageRounds=config.programRounds.filter(r=>r.stageIndex===pr.stageIndex&&r.cycleIndex===pr.cycleIndex);
   const seconds=stageRounds.reduce((sum,r,index)=>sum+r.workSec+(r.phaseTwoSec||0)+(index<stageRounds.length-1?r.restSec+(r.blockRestSec||0):0),0);
   const title=pr.stageTitle?escapeHtml(pr.stageTitle):'';
   const mode=stageModeLabel(pr);
   rows.push('<div class="ladder-block-label" data-stage="'+pr.stageIndex+'">'+stagePosition(pr.stageIndex,stageTotal)+' · '+mode+(pr.intervalMode==='count_up'?' · без лимита':' · всего '+formatTime(seconds))+'</div>');
   if(title)rows.push('<div class="ladder-stage-title">'+title+'</div>');
  }
  const block=pr?.block??blockForRound(config,i);
  const blocks=pr?.blockCount??blockCount(config);
  if(blocks>1&&(pr?pr.localRound:localRoundFor(config,i))===1){
   rows.push('<div class="ladder-block-label" data-block="'+block+'"'+(pr?' data-stage="'+pr.stageIndex+'"':'')+'>Блок '+block+' из '+blocks+'</div>');
  }
  const rest=i<totalRoundsForConfig(config)?formatTime(restSecAfterRound(config,i)):'—';
  const title=pr?.roundName?' · '+escapeHtml(pr.roundName):'';
  const round=pr?pr.localRound:localRoundFor(config,i);
  const phaseTwo=phaseTwoSecForRound(config,i);
  if(pr?.intervalMode==='count_up'||(!pr&&config.intervalMode==='count_up')){
   const tasks=pr?.roundDescription?'<div class="ft-afap-tasks">'+escapeHtml(pr.roundDescription).replace(/\s*[·•]\s*/g,'<br>')+'</div>':'';
   // The rest after a manually finished stage runs like any other; the plan shows it too.
   const restAfter=i<totalRoundsForConfig(config)&&restSecAfterRound(config,i)>0?' · отдых '+rest:'';
   rows.push('<div class="ladder-live-row ft-afap-row" data-round="'+i+'"><span class="ladder-plan">Таймер · прямой отсчёт'+(Number.isInteger(pr?.actualElapsedSec)?' · '+formatTime(pr.actualElapsedSec):'')+restAfter+tasks+'</span><strong class="ladder-count"></strong></div>');
  }else if(phaseTwo>0){
   const one=escapeHtml(pr?.phaseOneName||config.phaseOneName||'');
   const two=escapeHtml(pr?.phaseTwoName||config.phaseTwoName||'');
   rows.push('<div class="ladder-live-row ft-two-phase-plan" data-round="'+i+'"><div class="ladder-plan">Раунд '+round+title+'</div>'+
      '<div class="ft-work-phase phase-one" data-phase="one"><span>Фаза 1'+(one?' · '+one:'')+'</span><strong>'+formatTime(workSecForRound(config,i))+'</strong><b class="ladder-count"></b></div>'+
      '<div class="ft-work-phase phase-two" data-phase="two"><span>Фаза 2'+(two?' · '+two:'')+'</span><strong>'+formatTime(phaseTwo)+'</strong><b class="ladder-count"></b></div>'+
      (i<totalRoundsForConfig(config)?'<div class="ft-work-phase ft-round-rest" data-phase="rest"><span>Отдых</span><strong>'+rest+'</strong><b class="ladder-count"></b></div>':'')+'</div>');
  } else {
   rows.push('<div class="ladder-live-row" data-round="'+i+'"><span class="ladder-plan"><span class="ladder-plan-name">Раунд '+round+title+'</span><span class="ladder-plan-timing">работа '+formatTime(workSecForRound(config,i))+' · отдых '+rest+'</span></span><strong class="ladder-count"></strong></div>');
  }
  const between=blockRestSecAfterRound(config,i);
  if(between>0){
   closeBlock();
   rows.push('<div class="ladder-rest-row" data-after-round="'+i+'"><span>Отдых между блоками</span><strong class="ladder-rest-duration">'+formatTime(between)+'</strong><strong class="ladder-count"></strong></div>');
  }
 }
 closeStage();return rows.join('');
}
export function syncLadderPlanRows(list,state,{preview=false}={}){
 const active=preview||![PHASES.WORK,PHASES.WORK_TWO,PHASES.REST,PHASES.BLOCK_REST,PHASES.COUNTDOWN,PHASES.COUNT_UP].includes(state.phase)?0:state.roundIndex;
 const pauseActive=state.phase===PHASES.BLOCK_REST&&active>0;
 const current=state.config.programRounds?.[active-1];
 const block=active>0?(current?.block??blockForRound(state.config,active)):0;
 for(const heading of list.querySelectorAll('.ladder-block-label')){
  heading.classList.toggle('is-active',current?
   Number(heading.dataset.stage)===current.stageIndex&&(!heading.dataset.block||Number(heading.dataset.block)===block):
   Number(heading.dataset.block)===block);
 }
 for(const row of list.querySelectorAll('.ladder-live-row')){
  const isCurrent=Number(row.dataset.round)===active&&!pauseActive;
  row.classList.toggle('is-active',isCurrent);
  if(row.classList.contains('ft-two-phase-plan')){
   for(const part of row.querySelectorAll('[data-phase]')){
    const selected=isCurrent && part.dataset.phase===({work:'one',work_two:'two',rest:'rest'}[state.phase]);
    part.classList.toggle('is-active',selected);
    part.querySelector('.ladder-count').textContent=selected?'→ '+formatTime(state.remainingSec):'';
    const duration=part.querySelector('strong');if(duration)duration.hidden=selected;
   }
  }else row.querySelector('.ladder-count').textContent=isCurrent?(state.phase===PHASES.REST?'Отдых ':'→ ')+formatTime(state.remainingSec):'';
 }
 for(const row of list.querySelectorAll('.ladder-rest-row')){
  const isCurrent=Number(row.dataset.afterRound)===active&&pauseActive;
  row.classList.toggle('is-active',isCurrent);
  row.querySelector('.ladder-count').textContent=isCurrent?formatTime(state.remainingSec):'';
 }
 const newActive=active+':'+pauseActive;
 if(list.dataset.activeRound!==newActive){
  list.dataset.activeRound=newActive;
  if(!active)list.scrollTop=0;
  else{
   const selector=pauseActive?'.ladder-rest-row[data-after-round="'+active+'"]':'.ladder-live-row[data-round="'+active+'"]';
   const row=list.querySelector(selector);
   if(row&&row.offsetTop+row.offsetHeight>list.scrollTop+list.clientHeight)list.scrollTo({top:row.offsetTop+row.offsetHeight-list.clientHeight,behavior:'smooth'});
  }
 }
}
