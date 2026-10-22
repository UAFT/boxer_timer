import test from 'node:test';
import assert from 'node:assert/strict';
import {TimerEngine} from '../app/js/timer/timer-engine.js';
import {PHASES} from '../app/js/core/constants.js';
import {clonePreset} from '../app/js/state/presets.js';
import {normalizeSettings} from '../app/js/state/settings-store.js';
import {compileProgram} from '../app/js/core/program.js';
import {totalDurationSecForConfig,totalRoundsForConfig,workSecForRound} from '../app/js/core/schedule.js';
import {stageModeLabel} from '../app/js/ui/stage-mode-label.js';
import {stageTimingRows} from '../app/js/ui/stage-timing-rows.js';
import {buildLadderPlanRows} from '../app/js/ui/ladder-plan-rows.js';
import {serializeWorkoutFile,parseWorkoutFile} from '../app/js/sharing/workout-file.js';

const base=clonePreset('classic1');
const stopwatch=()=>({...base,intervalMode:'count_up'});
const stage=(mode,restAfterSec=0,workSec=20)=>({
 presetId:'classic1',title:mode==='count_up'?'AFAP':'Заминка',restAfterSec,
 settings:{...base,intervalMode:mode,rounds:2,workSec,restSec:10}
});
function clockFixture(){
 const originalWindow=globalThis.window,originalNow=Date.now;
 let now=100000;
 globalThis.window={setInterval:()=>1,clearInterval:()=>{}};
 Date.now=()=>now;
 return {advance(seconds){now+=seconds*1000;},
  teardown(){globalThis.window=originalWindow;Date.now=originalNow;}};
}

test('standalone stopwatch counts upward, pauses, resumes and finishes only manually',async()=>{
 const clock=clockFixture();
 try{
  const engine=new TimerEngine();
  engine.applyConfig(stopwatch());
  assert.equal(engine.state.remainingSec,0);
  assert.equal(totalRoundsForConfig(engine.config),1);
  assert.equal(totalDurationSecForConfig(engine.config),0);
  engine.start();
  assert.equal(engine.state.phase,PHASES.COUNT_UP);
  clock.advance(13);engine.handleIntervalTick();assert.equal(engine.state.remainingSec,13);
  clock.advance(500);engine.handleIntervalTick();assert.equal(engine.state.phase,PHASES.COUNT_UP);
  engine.pause();
  assert.equal(engine.isPaused,true);
  clock.advance(1000);
  engine.resume();
  clock.advance(7);engine.handleIntervalTick();assert.equal(engine.state.remainingSec,520);
  assert.equal(engine.state.phase,PHASES.COUNT_UP);
  const completed=await engine.finishStage();
  assert.equal(completed.elapsedSec,520);
  assert.equal(engine.state.phase,PHASES.FINISHED);
  assert.equal(engine.state.remainingSec,520);
  assert.equal(await engine.finishStage(),false);
 }finally{clock.teardown();}
});

test('a count-up stage advances to interstage rest and then the next timed stage',async()=>{
 const clock=clockFixture();
 try{
  const entries=[stage('count_up',15),stage('standard',0,20)];
  const compiled=compileProgram(entries,{classic1:base});
  assert.equal(compiled.length,3);
  assert.equal(compiled[0].workSec,0);
  assert.equal(compiled[0].phaseTwoSec,0);
  assert.equal(compiled[0].restSec,15);
  const engine=new TimerEngine();
  engine.applyConfig({...base,programRounds:compiled,intervalMode:'standard'});
  engine.start();
  assert.equal(engine.state.phase,PHASES.COUNT_UP);
  clock.advance(18);engine.handleIntervalTick();
  await engine.finishStage();
  assert.equal(engine.config.programRounds[0].actualElapsedSec,18);
  assert.equal(engine.state.phase,PHASES.REST);
  assert.equal(engine.state.remainingSec,15);
  await engine.finishCurrentPhase();
  assert.equal(engine.state.phase,PHASES.WORK);
  assert.equal(engine.state.roundIndex,2);
  assert.equal(engine.state.remainingSec,20);
  assert.match(buildLadderPlanRows(engine.config),/Таймер · прямой отсчёт · 00:18/);
 }finally{clock.teardown();}
});

test('a timed stage can transition into the manual stopwatch stage',async()=>{
 const clock=clockFixture();
 try{
  const entries=[stage('standard',0,20),stage('count_up')];
  const compiled=compileProgram(entries,{classic1:base});
  const engine=new TimerEngine();
  engine.applyConfig({...base,programRounds:compiled});
  engine.beginWorkPhase(2);
  await engine.finishCurrentPhase();
  assert.equal(engine.state.phase,PHASES.COUNT_UP);
  assert.equal(engine.state.roundIndex,3);
  const file=serializeWorkoutFile({name:'Программа AFAP',entries,options:{cycles:1,cycleRestSec:0}});
  assert.equal(parseWorkoutFile(file).entries[1].settings.intervalMode,'count_up');
 }finally{clock.teardown();}
});

test('count-up mode persists and does not create fake rounds or rest controls',()=>{
 assert.equal(normalizeSettings(stopwatch(),base).intervalMode,'count_up');
 assert.equal(totalRoundsForConfig(stopwatch()),1);
 assert.equal(workSecForRound(stopwatch(),1),0);
 assert.equal(stageModeLabel(stopwatch()),'Таймер');
 assert.match(stageTimingRows(stopwatch(),{rounds:[],total:0})[0][1],/Прямой отсчёт/);
});
