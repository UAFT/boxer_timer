import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compileProgram} from '../app/js/core/program.js';
import {clonePreset} from '../app/js/state/presets.js';
import {buildLadderPlanRows,ladderPlanPhaseCaption} from '../app/js/ui/ladder-plan-rows.js';
import {syncLadderStepLabels} from '../app/js/ui/ladder-step-labels.js';

const profiles={classic1:clonePreset('classic1')};
const createStage=(name,settings={})=>({
 presetId:'classic1',title:name,settings:{...clonePreset('classic1'),rounds:2,workSec:10,restSec:10,...settings}
});
const program=[
 createStage('Разминка'),
 createStage('Руки',{intervalMode:'ladder',blockEnabled:true,blockCount:2,blockRestSec:15}),
 createStage('Сила + легкость',{intervalMode:'two_phase',phaseTwoSec:15,phaseOneName:'Кувалда',phaseTwoName:'Бой с тенью'}),
 createStage('Заминка'),
];
const compiled=compileProgram(program,profiles);

test('four-stage workout caption identifies position AND total, with the exact block position',()=>{
 const config={programRounds:compiled};
 const blockTwo=compiled.findIndex(row=>row.stageIndex===1&&row.block===2&&row.localRound===2);
 assert.ok(blockTwo>=0,'stage 2 block 2 round 2 exists');
 const caption=ladderPlanPhaseCaption({config,roundIndex:blockTwo+1,phase:'work'});
 assert.equal(caption,'Этап 2 из 4 · Блок 2 из 2 · Раунд 2 · Работа');
 const firstThird=compiled.findIndex(row=>row.stageIndex===2);
 assert.equal(ladderPlanPhaseCaption({config,roundIndex:firstThird+1,phase:'work'}),
 'Этап 3 из 4 · Раунд 1 · Фаза 1');
 assert.equal(ladderPlanPhaseCaption({config,roundIndex:firstThird+1,phase:'work_two'}),
 'Этап 3 из 4 · Раунд 1 · Фаза 2');
});

test('program stage headings include stage count; standalone mode remains unchanged',()=>{
 const html=buildLadderPlanRows({programRounds:compiled});
 const modes=['Обычный','Лестница','Две фазы','Обычный'];
 for(const [i,name] of program.map((entry,i)=>[i+1,entry.title])){
  assert.ok(html.includes('Этап '+i+' из 4 · '+modes[i-1]+' · всего'),'mode at stage '+i);
  assert.ok(html.includes('<div class="ladder-stage-title">'+name+'</div>'),'title on its own row at stage '+i);
 }
 assert.match(html,/Блок 2 из 2/);
 const standalone=buildLadderPlanRows({...clonePreset('classic1'),rounds:2});
 assert.doesNotMatch(standalone,/Этап \d+ из/);
});

test('stage total counts distinct stage indices, not repeated cycles',()=>{
 const rows=compileProgram(program.slice(0,2),profiles,{cycles:2,cycleRestSec:20});
 const caption=ladderPlanPhaseCaption({config:{programRounds:rows},roundIndex:rows.findIndex(r=>r.cycleIndex===1&&r.stageIndex===0)+1,phase:'work'});
 assert.equal(caption,'Этап 1 из 2 · Раунд 1 · Работа');
});

test('dual-phase ladder labels switch without changing interval settings',()=>{
 const label={textContent:''};
 const control={attrs:{},setAttribute(key,value){this.attrs[key]=value;}};
 const root={getElementById(id){return id==='workStepSecLabel'?label:id==='workStepSecControl'?control:null;}};
 assert.equal(syncLadderStepLabels(root,{intervalMode:'ladder',ladderEnabled:false}),'Шаг работы по раундам');
 assert.equal(syncLadderStepLabels(root,{intervalMode:'two_phase',ladderEnabled:true}),'Шаг фазы 1 по раундам');
 assert.equal(label.textContent,control.attrs['aria-label']);
 assert.equal(syncLadderStepLabels(root,{intervalMode:'two_phase',ladderEnabled:false}),'Шаг работы по раундам');
});

test('settings show phase 1, phase 2, then rest; default remains work/rest',()=>{
 const html=readFileSync(new URL('../app/index.html',import.meta.url),'utf8');
 const label=html.indexOf('id="workStepSecLabel"');
 const phaseTwo=html.indexOf('id="phaseTwoStepFields"');
 const rest=html.indexOf('Шаг отдыха по раундам');
 assert.ok(label>0&&phaseTwo>label&&rest>phaseTwo);
 assert.match(html,/id="phaseTwoStepFields" hidden/);
 const bindings=readFileSync(new URL('../app/js/ui/bindings.js',import.meta.url),'utf8');
 const render=readFileSync(new URL('../app/js/ui/render.js',import.meta.url),'utf8');
 assert.match(bindings,/syncLadderStepLabels\(document,\{intervalMode:mode,ladderEnabled:els.ladderEnabledInput.checked\}\)/);
 assert.match(render,/syncLadderStepLabels\(document,\{intervalMode:els.intervalModeInput.value/);
});

test('pending two-phase round 1 and round 2 use same neutral background while active stays highlighted',()=>{
 const css=readFileSync(new URL('../app/styles/fight-tech-ui-kit.css',import.meta.url),'utf8');
 assert.match(css,/\.ladder-live-list \.ladder-live-row\.ft-two-phase-plan:not\(\.is-active\)[\s\S]*?background:#f8f9fa!important/);
 for(const kind of ['phase-one','phase-two','ft-round-rest'])
   assert.ok(css.includes('.ft-work-phase.'+kind+' {'),'pending '+kind+' has its own chip');
 assert.match(css,/\.ladder-live-list \.ladder-live-row\.ft-two-phase-plan:nth-child\(even\):not\(\.is-active\)/);
 const active=readFileSync(new URL('../app/styles/program-screen.css',import.meta.url),'utf8');
 assert.match(active,/\.ladder-live-row\.ft-two-phase-plan\.is-active\{background:/);
});
