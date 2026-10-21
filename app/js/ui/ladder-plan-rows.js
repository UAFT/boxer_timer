// One presentation source for independent round rest and inter-block rest.
import {totalRoundsForConfig,workSecForRound,restSecAfterRound,blockRestSecAfterRound,blockCount,blockForRound,localRoundFor} from '../core/schedule.js';
import {formatTime} from '../core/time.js';
import {PHASES} from '../core/constants.js';
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const modeName=round=>round.presetId==='tabata2020x24'?'Скоростной':round.intervalMode==='ladder'?'Лестница':'';
export function ladderPlanPhaseCaption(state,{preview=false}={}){
 if(preview||state.phase===PHASES.IDLE)return '';
 switch(state.phase){
  case PHASES.COUNTDOWN:return 'Старт';
  case PHASES.WORK:return 'Раунд';
  case PHASES.REST:return 'Отдых';
  case PHASES.BLOCK_REST:return 'Отдых между блоками';
  case PHASES.FINISHED:return 'Завершено';
  default:return '';
 }
}
export function ladderPlanControl(state,{preview=false}={}){
 const idle=state.phase===PHASES.IDLE||state.phase===PHASES.FINISHED;
 const canStart=preview||idle,canPause=!preview&&!idle;
 return {disabled:!canStart&&!canPause,play:canStart||Boolean(state.isPaused),
  label:canStart?(preview?'Запустить программу':'Запустить тренировку'):state.isPaused?'Продолжить':'Пауза'};
}
export function buildLadderPlanRows(config){
 const rows=[];let stageOpen=false,blockOpen=false;
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
   const seconds=stageRounds.reduce((sum,r,index)=>sum+r.workSec+(index<stageRounds.length-1?r.restSec+(r.blockRestSec||0):0),0);
   const title=pr.stageTitle?escapeHtml(pr.stageTitle):'';
   const mode=modeName(pr),label=title||mode;
   const suffix=mode&&label!==mode?' · '+mode:'';
   rows.push('<div class="ladder-block-label" data-stage="'+pr.stageIndex+'">Этап '+(pr.stageIndex+1)+(label?' · '+label:'')+suffix+' · всего '+formatTime(seconds)+'</div>');
  }
  const block=pr?.block??blockForRound(config,i);
  const blocks=pr?.blockCount??blockCount(config);
  if(blocks>1&&(pr?pr.localRound:localRoundFor(config,i))===1){
   rows.push('<div class="ladder-block-label" data-block="'+block+'"'+(pr?' data-stage="'+pr.stageIndex+'"':'')+'>Блок '+block+' из '+blocks+'</div>');
  }
  const rest=i<totalRoundsForConfig(config)?formatTime(restSecAfterRound(config,i)):'—';
  const title=pr?.roundName?' · '+escapeHtml(pr.roundName):'';
  const round=pr?pr.localRound:localRoundFor(config,i);
  rows.push('<div class="ladder-live-row" data-round="'+i+'"><span class="ladder-plan">Раунд '+round+title+' · работа '+formatTime(workSecForRound(config,i))+' · отдых '+rest+'</span><strong class="ladder-count"></strong></div>');
  const between=blockRestSecAfterRound(config,i);
  if(between>0){
   closeBlock();
   rows.push('<div class="ladder-rest-row" data-after-round="'+i+'"><span>Отдых между блоками</span><strong class="ladder-rest-duration">'+formatTime(between)+'</strong><strong class="ladder-count"></strong></div>');
  }
 }
 closeStage();return rows.join('');
}
export function syncLadderPlanRows(list,state,{preview=false}={}){
 const active=preview||![PHASES.WORK,PHASES.REST,PHASES.BLOCK_REST,PHASES.COUNTDOWN].includes(state.phase)?0:state.roundIndex;
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
  row.querySelector('.ladder-count').textContent=isCurrent?(state.phase===PHASES.REST?'Отдых ':'→ ')+formatTime(state.remainingSec):'';
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
