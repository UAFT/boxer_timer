import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PHASES} from '../app/js/core/constants.js';
import {buildLadderPlanRows,ladderPlanControl,ladderPlanPhaseCaption} from '../app/js/ui/ladder-plan-rows.js';
import {stageTimingRows} from '../app/js/ui/stage-timing-rows.js';
import {compileProgram} from '../app/js/core/program.js';
import {clonePreset} from '../app/js/state/presets.js';
const cfg={...clonePreset('classic1'),intervalMode:'ladder',rounds:1,workSec:10,restSec:10,blockEnabled:true,blockCount:5,blockRestSec:10,workStepSec:0,restStepSec:0};
const profiles={classic1:clonePreset('classic1')};
const rows=compileProgram([{presetId:'classic1',title:'Лестница',settings:cfg}],profiles);
const work={phase:PHASES.WORK,isPaused:false};
test('standalone plan ready has usable Play, running toggles Pause, paused toggles Continue',()=>{
 assert.deepEqual(ladderPlanControl({phase:PHASES.IDLE},{preview:false}),{disabled:false,play:true,label:'Запустить тренировку'});
 assert.deepEqual(ladderPlanControl({phase:PHASES.FINISHED},{preview:false}),{disabled:false,play:true,label:'Запустить тренировку'});
 assert.deepEqual(ladderPlanControl(work,{preview:false}),{disabled:false,play:false,label:'Пауза'});
 assert.deepEqual(ladderPlanControl({...work,isPaused:true},{preview:false}),{disabled:false,play:true,label:'Продолжить'});
 assert.deepEqual(ladderPlanControl({phase:PHASES.IDLE},{preview:true}),{disabled:false,play:true,label:'Запустить программу'});
});
test('phase caption follows timer state, not a fixed current round label',()=>{
 assert.equal(ladderPlanPhaseCaption({phase:PHASES.IDLE}),'');
 assert.equal(ladderPlanPhaseCaption({phase:PHASES.COUNTDOWN}),'Старт');
 assert.equal(ladderPlanPhaseCaption({phase:PHASES.WORK,roundIndex:2,config:cfg}),'Раунд 2 · Работа');
 assert.equal(ladderPlanPhaseCaption({phase:PHASES.REST,roundIndex:2,config:cfg}),'Раунд 2 · Отдых');
 assert.equal(ladderPlanPhaseCaption({phase:PHASES.BLOCK_REST,roundIndex:2,config:cfg}),'Раунд 2 · Отдых между блоками');
 assert.equal(ladderPlanPhaseCaption({phase:PHASES.WORK},{preview:true}),'');
});
test('standalone ladder displays separate rest rows between blocks, without final rest',()=>{
 const html=buildLadderPlanRows(cfg);
 assert.equal((html.match(/class="ladder-live-row"/g)||[]).length,5);
 assert.equal((html.match(/class="ladder-rest-row"/g)||[]).length,4);
 assert.ok(html.includes('<span class="ladder-plan-name">Раунд 1</span><span class="ladder-plan-timing">работа 00:10 · отдых 00:10</span>'));
 assert.ok(html.includes('<span>Отдых между блоками</span>'));
 assert.ok(html.indexOf('data-round="1"')<html.indexOf('data-after-round="1"'));
 assert.ok(html.indexOf('data-after-round="1"')<html.indexOf('Блок 2 из 5'));
 assert.equal(html.includes('data-after-round="5"'),false);
 assert.equal(html.includes('между блоками 00:10</span>'),false,'block rest is NOT concatenated into a round');
});
test('saved program mode uses the exact same plan contract with one stage and five blocks',()=>{
 const program=buildLadderPlanRows({programRounds:rows});
 assert.equal((program.match(/class="ladder-rest-row"/g)||[]).length,4);
 assert.equal((program.match(/class="ladder-live-row"/g)||[]).length,5);
 assert.ok(program.includes('Этап 1 из 1 · Лестница · всего 02:10'));
 assert.ok(program.includes('<div class="ladder-stage-title">Лестница</div>'));
 assert.equal(program.includes('Лестница · Лестница'),false);
 assert.ok(program.indexOf('data-after-round="1"')<program.indexOf('Блок 2 из 5'));
});
test('editor summary consistently has three semantic rows only when blocks exist',()=>{
 const blocks=stageTimingRows(cfg,{rounds:rows,total:130});
 assert.deepEqual(blocks,[
  ['program-stage-count','1 раунд'],['program-stage-work','работа 00:10'],['program-stage-rest','отдых 00:10'],
  ['program-stage-block-rest','5 блоков · отдых между блоками 00:10'],['program-stage-sum','Всего: 02:10']
 ]);
 const normal={...cfg,blockEnabled:false,rounds:2};
 const normalRows=stageTimingRows(normal,{rounds:[{},{}],total:30});
 assert.equal(normalRows.length,4);
 assert.equal(normalRows.some(x=>x[0]==='program-stage-block-rest'),false);
});
test('CSS keeps fixed countdown and block-rest separate: legacy marquee cannot overlap',()=>{
 const css=readFileSync(new URL('../app/styles/program-screen.css',import.meta.url),'utf8');
 const app=readFileSync(new URL('../app/js/app.js',import.meta.url),'utf8');
 const render=readFileSync(new URL('../app/js/ui/render.js',import.meta.url),'utf8');
 assert.ok(css.includes('.ladder-rest-row.is-active'));
 assert.ok(css.includes('white-space:normal!important;overflow:visible!important'));
 assert.ok(render.includes('ladderPlanControl(state,{preview})'));
 assert.ok(app.includes('els.ladderFullPause.addEventListener(\'click\', handleToggleRun)'));
});
