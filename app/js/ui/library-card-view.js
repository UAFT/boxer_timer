import { compileProgram, normalizeProgram, normalizeOptions, PRESET_NAMES } from '../core/program.js';

const ROUND_RU = ['раунд', 'раунда', 'раундов'];
export function russianCount(count, forms = ROUND_RU) {
  const n=Math.abs(count), mod100=n%100, mod10=n%10;
  return count+' '+forms[mod100>=11&&mod100<=14?2:mod10===1?0:mod10>=2&&mod10<=4?1:2];
}
export function timeClock(seconds) {
  const sec=Math.max(0,Math.round(seconds));
  return String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');
}
export function timeWords(seconds, lang = 'ru') {
  const sec=Math.max(0,Math.round(seconds));
  const min=Math.floor(sec/60), remainder=sec%60;
  if (lang==='en') return (min?min+' min':'')+(min&&remainder?' ':'')+(remainder?remainder+' sec':(!min?'0 sec':''));
  const minutes=min?russianCount(min,['минута','минуты','минут']):'';
  const remaining=remainder?russianCount(remainder,['секунда','секунды','секунд']):'';
  return [minutes,remaining].filter(Boolean).join(' ') || '0 секунд';
}
export function programCardTimings(program, profiles) {
  const stages=normalizeProgram(program.entries);
  const options=normalizeOptions(program.options);
  const all=compileProgram(stages,profiles,options);
  const total=all.reduce((sum,round)=>sum+round.workSec+(round.phaseTwoSec||0)+round.restSec+(round.blockRestSec||0),0);
  const unbounded=all.some(round=>round.intervalMode==='count_up');
  const stageData=stages.map((stage,index)=>{
    const rounds=compileProgram([stage],profiles,{cycles:1});
    const duration=rounds.reduce((sum,r)=>sum+r.workSec+(r.phaseTwoSec||0)+r.restSec+(r.blockRestSec||0),0);
    const cfg=stage.settings||profiles[stage.presetId];
    const workTimes=rounds.map(r=>r.workSec);
    const workLow=Math.min(...workTimes),workHigh=Math.max(...workTimes);
    const work=workLow===workHigh?timeClock(workLow):timeClock(workLow)+'–'+timeClock(workHigh);
    // Show the configured rest; for ladders, show the effective range when it changes.
    const restTimes=rounds.slice(0,-1).map(r=>r.restSec);
    const restLow=restTimes.length?Math.min(...restTimes):0;
    const restHigh=restTimes.length?Math.max(...restTimes):0;
    const rest=restLow===restHigh?timeClock(restLow):timeClock(restLow)+'–'+timeClock(restHigh);
    const blocks=(cfg?.intervalMode==='ladder'||(cfg?.intervalMode==='two_phase'&&cfg?.ladderEnabled)) && cfg.blockEnabled ? Number(cfg.blockCount)||1 : 1;
    return {index:index+1,title:stage.title||PRESET_NAMES[stage.presetId],unbounded:cfg?.intervalMode==='count_up',rounds:rounds.length,roundsPerBlock:Math.max(1,Number(cfg.rounds)||1),blocks,
      work,rest,duration,phaseTwo:cfg?.intervalMode==='two_phase'?(cfg.ladderEnabled?timeClock(Math.min(...rounds.map(r=>r.phaseTwoSec)))+'–'+timeClock(Math.max(...rounds.map(r=>r.phaseTwoSec))):timeClock(cfg.phaseTwoSec||40)):'',blockRest:blocks>1?timeClock(cfg.blockRestSec||0):'',
      restAfter:index<stages.length-1?stage.restAfterSec:0,
      intervalMode:cfg?.intervalMode};
  });
  return {total,unbounded,cycles:options.cycles,cycleRestSec:options.cycleRestSec,stages:stageData};
}
function add(doc,parent,tag,className,text) {
  const el=doc.createElement(tag);el.className=className;el.textContent=text;parent.append(el);return el;
}
export function createActionIcon(doc, kind) {
  const paths={
    share:['circle:18,5,2','circle:6,12,2','circle:18,19,2','path:M8 11l8-5','path:M8 13l8 5'],
    trash:['path:M3 6h18','path:M8 6V4h8v2','path:M19 6l-1 15H6L5 6','path:M10 10v7','path:M14 10v7'],
    download:['path:M12 3v13','path:M7 11l5 5 5-5','path:M4 18v3h16v-3'],
    plus:['path:M12 5v14','path:M5 12h14']
  };
  const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');
  svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.9');
  svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');
  svg.setAttribute('aria-hidden','true');svg.classList.add('ft-action-icon');
  for(const spec of paths[kind]||[]) {
    const [type,data]=spec.split(':');const el=doc.createElementNS('http://www.w3.org/2000/svg',type);
    if(type==='circle') {const [cx,cy,r]=data.split(',');el.setAttribute('cx',cx);el.setAttribute('cy',cy);el.setAttribute('r',r);}
    else el.setAttribute('d',data);
    svg.append(el);
  }
  return svg;
}
export function renderSavedProgramCard(doc, program, profiles, {lang='ru',onOpen,onShareButton,onDelete}={}) {
  const ru=lang!=='en',timing=programCardTimings(program,profiles);
  const row=doc.createElement('div');row.className='program-library-entry ft-saved-program-entry';
  const open=doc.createElement('button');open.type='button';open.className='program-library-entry-open ft-saved-program-open';
  const heading=doc.createElement('div');heading.className='ft-saved-program-heading';
  add(doc,heading,'strong','ft-program-title',program.name);
  add(doc,heading,'span','ft-program-total',timing.unbounded?(ru?'Без ограничения времени':'No time limit'):timeWords(timing.total,lang));
  open.append(heading);
  open.setAttribute('aria-expanded','false');
  open.setAttribute('aria-label',(ru?'Показать состав программы ':'Show workout details ')+program.name);
  const summary=doc.createElement('div');summary.className='program-library-summary ft-program-stages';
  let detailsReady=false;
  const renderDetails=()=>{
   if(detailsReady)return;
   detailsReady=true;
   for(const stage of timing.stages) {
    const block=doc.createElement('div');block.className='ft-program-stage';
    add(doc,block,'span','ft-stage-label',(ru?'Этап ':'Stage ')+stage.index);
    add(doc,block,'strong','ft-stage-title',stage.title);
    const roundCount=ru?russianCount(stage.roundsPerBlock):stage.roundsPerBlock+' rounds';
    const label=stage.blocks>1
      ? (ru?roundCount+' × '+russianCount(stage.blocks,['блок','блока','блоков']):roundCount+' × '+stage.blocks+' blocks')
      : (ru?russianCount(stage.rounds):stage.rounds+' rounds');
    add(doc,block,'span','ft-stage-details',stage.unbounded
      ?(ru?'Прямой отсчёт · до ручного завершения':'Count up · until finished manually')
      :(ru?label+' · работа '+stage.work+' · отдых '+stage.rest:
        label+' · work '+stage.work+' · rest '+stage.rest));
    if(stage.phaseTwo)add(doc,block,'small','ft-stage-block-rest',(ru?'Фаза 2: ':'Phase 2: ')+stage.phaseTwo);
    if(stage.blocks>1)add(doc,block,'small','ft-stage-block-rest',(ru?'Отдых между блоками: ':'Between blocks: ')+stage.blockRest);
    add(doc,block,'span','ft-stage-total',stage.unbounded
      ?(ru?'Время не ограничено':'No time limit')
      :(ru?'Всего: ':'Total: ')+timeWords(stage.duration,lang));
    if(stage.restAfter>0) add(doc,block,'small','ft-stage-rest-after',
      (ru?'Между этапами: ':'Between stages: ')+timeClock(stage.restAfter));
    summary.append(block);
  }
   if(timing.cycles>1)add(doc,summary,'small','ft-program-cycles',ru?
    'Циклы: '+timing.cycles+' · пауза между циклами: '+timeClock(timing.cycleRestSec):
    'Cycles: '+timing.cycles+' · between cycles: '+timeClock(timing.cycleRestSec));
   const load=doc.createElement('button');load.type='button';load.className='ft-saved-program-load';
   load.textContent=ru?'Открыть программу':'Open workout';
   load.addEventListener('click',()=>onOpen?.());
   summary.append(load);
  };
  summary.id='ft-program-details-'+String(program.id||program.name).replace(/[^a-z0-9_-]/gi,'_');
  summary.hidden=true;
  open.setAttribute('aria-controls',summary.id);
  const expand=()=>{
    if(summary.hidden)renderDetails();
    summary.hidden=!summary.hidden;
    const expanded=!summary.hidden;
    open.setAttribute('aria-expanded',String(expanded));
    open.setAttribute('aria-label',(ru?(expanded?'Свернуть программу ':'Показать состав программы '):(expanded?'Collapse workout ':'Show workout details '))+program.name);
    row.classList.toggle('is-expanded',expanded);
  };
  open.addEventListener('click',expand);
  row.append(open,summary);
  const controls=doc.createElement('div');controls.className='ft-program-actions';
  const quickAdd=doc.createElement('button');quickAdd.type='button';quickAdd.className='ft-saved-program-add';
  quickAdd.setAttribute('aria-label',(ru?'Открыть программу ':'Open workout ')+program.name);
  quickAdd.title=ru?'Открыть программу':'Open workout';quickAdd.append(createActionIcon(doc,'plus'));
  quickAdd.addEventListener('click',()=>onOpen?.());
  controls.append(quickAdd,onShareButton());
  const remove=doc.createElement('button');remove.type='button';remove.className='program-library-entry-delete ft-trash-button';
  remove.setAttribute('aria-label',(ru?'Удалить программу ':'Delete program ')+program.name);
  remove.title=ru?'Удалить':'Delete';remove.append(createActionIcon(doc,'trash'));
  remove.addEventListener('click',()=>onDelete(remove));controls.append(remove);
  row.append(controls);
  return row;
}
