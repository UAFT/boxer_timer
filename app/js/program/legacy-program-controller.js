import { compileProgram, normalizeProgram, PRESET_NAMES, PROGRAM_KEY } from '../core/program.js';

export function createLegacyProgramController({els, audio, metronome, timer, getProfiles, getActiveSettings, getActivePresetId, syncMetronome, renderCurrentState}) {
const profiles = getProfiles();
let programEntries = [];
try { programEntries = normalizeProgram(JSON.parse(localStorage.getItem(PROGRAM_KEY) || '[]')); } catch {}
let programRunning = false;
let programSnapshot = null;
const active = () => getActiveSettings();
const preset = () => getActivePresetId();
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
  timer.applyConfig({ ...active(), presetId: preset(), programRounds: programSnapshot, intervalMode:'standard' });
  syncMetronome();
  renderCurrentState();
  timer.start();
}
function exitProgram() {
  programRunning=false;
  programSnapshot=null;
  timer.applyConfig({ ...active(), presetId: preset() });
  renderCurrentState();
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
  const signature=JSON.stringify([programEntries,programRunning]);
  if (list.dataset.signature!==signature) {
    list.replaceChildren();
    programEntries.forEach((entry,i)=>{
      const card=document.createElement('div');card.className='program-stage-card';card.dataset.stage=String(i);
      const stage=document.createElement('div');stage.className='program-stage';
      const main=document.createElement('div');main.className='program-stage-main';
      const name=document.createElement('strong');name.textContent='Этап '+(i+1)+' · '+PRESET_NAMES[entry.presetId];
      const detail=document.createElement('small');const cfg=profiles[entry.presetId];
      detail.textContent=cfg.intervalMode==='ladder' ? 'Лестница · '+cfg.rounds+' раундов'+(cfg.blockEnabled?' · блоков '+cfg.blockCount:'') : (entry.presetId==='tabata2020x24' ? 'Скоростной' : 'Обычный')+' · '+cfg.rounds+' раундов · '+String(Math.floor(cfg.workSec/60)).padStart(2,'0')+':'+String(cfg.workSec%60).padStart(2,'0');
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

return {
  startProgram, exitProgram, renderProgram, bindProgram,
  isRunning:()=>programRunning, hasEntries:()=>programEntries.length>0,
  getSnapshot:()=>programSnapshot
};
}
