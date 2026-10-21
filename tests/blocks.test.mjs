import test from 'node:test';
import assert from 'node:assert/strict';
import {totalRoundsForConfig,workSecForRound,restSecAfterRound,totalDurationSecForConfig} from '../app/js/core/schedule.js';
test('repeated ladder blocks',()=>{
 const c={intervalMode:'ladder',rounds:3,workSec:60,workStepSec:-20,restSec:30,blockEnabled:true,blockCount:3,blockRestSec:90};
 assert.equal(totalRoundsForConfig(c),9);
 assert.deepEqual(Array.from({length:9},(_,i)=>workSecForRound(c,i+1)),[60,40,20,60,40,20,60,40,20]);
 assert.equal(restSecAfterRound(c,3),90);
 assert.equal(restSecAfterRound(c,6),90);
 assert.equal(totalDurationSecForConfig(c),720);
});

import {displayDurationsForState} from '../app/js/core/schedule.js';
import {editableRestField} from '../app/js/core/ladder-blocks.js';
import {compileProgram} from '../app/js/core/program.js';
import {clonePreset} from '../app/js/state/presets.js';
import {TimerEngine} from '../app/js/timer/timer-engine.js';

test('ladder rest steps reset in each block while inter-block rest remains separate',()=>{
 const c={intervalMode:'ladder',rounds:3,workSec:60,workStepSec:5,restSec:35,restStepSec:-5,blockEnabled:true,blockCount:3,blockRestSec:60};
 assert.deepEqual(Array.from({length:9},(_,i)=>workSecForRound(c,i+1)),[60,65,70,60,65,70,60,65,70]);
 assert.deepEqual(Array.from({length:9},(_,i)=>i===8?0:restSecAfterRound(c,i+1)),[35,30,60,35,30,60,35,30,0]);
 assert.equal(totalDurationSecForConfig(c),9*65+3*35+3*30+2*60);
 const compiled=compileProgram([{presetId:'classic1',settings:c,restAfterSec:0}],{classic1:clonePreset('classic1')});
 assert.deepEqual(compiled.map(r=>r.restSec),[35,30,60,35,30,60,35,30,0]);
});

test('one round per block: main rest +/- must update actual between-block rest',()=>{
 const c={intervalMode:'ladder',rounds:1,workSec:60,restSec:35,restStepSec:0,blockEnabled:true,blockCount:5,blockRestSec:60};
 assert.equal(editableRestField(c,'restSec'),'blockRestSec');
 assert.equal(editableRestField(c,'workSec'),'workSec');
 assert.equal(displayDurationsForState({phase:'idle',roundIndex:0,config:c}).restSec,60);
 assert.equal(totalDurationSecForConfig(c),540);
 c[editableRestField(c,'restSec')]-=5;
 assert.equal(displayDurationsForState({phase:'idle',roundIndex:0,config:c}).restSec,55);
 assert.equal(totalDurationSecForConfig(c),520);
 assert.deepEqual(Array.from({length:5},(_,i)=>i===4?0:restSecAfterRound(c,i+1)),[55,55,55,55,0]);
 c.rounds=2;
 assert.equal(editableRestField(c,'restSec'),'restSec');
 assert.equal(displayDurationsForState({phase:'idle',roundIndex:0,config:c}).restSec,35);
 assert.equal(restSecAfterRound(c,2),55);
});

test('ladder block rest and work transitions produce the expected existing audio events',async()=>{
 const original=globalThis.window;
 globalThis.window={setInterval:()=>123,clearInterval:()=>{}};
 try{
  const events=[];
  const timer=new TimerEngine({onEvent:e=>events.push(e.type),onTick:()=>{},onStateChange:()=>{}});
  const c={...clonePreset('classic1'),intervalMode:'ladder',rounds:2,workSec:60,restSec:35,blockEnabled:true,blockCount:2,blockRestSec:60,workStepSec:0,restStepSec:0,countdownEnabled:false};
  timer.applyConfig(c);
  timer.beginWorkPhase(1);
  assert.equal(timer.state.remainingSec,60);
  await timer.finishCurrentPhase();
  assert.equal(timer.state.phase,'rest');assert.equal(timer.state.remainingSec,35);
  await timer.finishCurrentPhase();
  assert.equal(timer.state.phase,'work');assert.equal(timer.state.roundIndex,2);
  await timer.finishCurrentPhase();
  assert.equal(timer.state.phase,'rest');assert.equal(timer.state.remainingSec,60);
  await timer.finishCurrentPhase();
  assert.equal(timer.state.phase,'work');assert.equal(timer.state.roundIndex,3);
  await timer.finishCurrentPhase();
  assert.equal(timer.state.phase,'rest');assert.equal(timer.state.remainingSec,35);
  await timer.finishCurrentPhase();
  await timer.finishCurrentPhase();
  assert.equal(timer.state.phase,'finished');
  assert.deepEqual(events,['round-end-zero','rest-end-zero','round-end-zero','rest-end-zero','round-end-zero','rest-end-zero','workout-end-zero']);
  timer.stopInterval();
 } finally {globalThis.window=original;}
});
