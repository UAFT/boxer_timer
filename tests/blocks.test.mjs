import test from 'node:test';
import assert from 'node:assert/strict';
import {totalRoundsForConfig,workSecForRound,restSecAfterRound,blockRestSecAfterRound,totalDurationSecForConfig,remainingTotalSecForState,displayDurationsForState} from '../app/js/core/schedule.js';
import {editableRestField} from '../app/js/core/ladder-blocks.js';
import {compileProgram} from '../app/js/core/program.js';
import {clonePreset} from '../app/js/state/presets.js';
import {TimerEngine} from '../app/js/timer/timer-engine.js';

const config={intervalMode:'ladder',rounds:1,workSec:10,restSec:10,restStepSec:0,workStepSec:0,blockEnabled:true,blockCount:5,blockRestSec:10,countdownEnabled:false};
const profiles={classic1:clonePreset('classic1')};
const stages=[{presetId:'classic1',title:'Лестница',settings:config}];

test('standalone ladder: one round per each of 5 blocks means both rests, no final rest',()=>{
 assert.equal(totalRoundsForConfig(config),5);
 assert.deepEqual(Array.from({length:5},(_,i)=>workSecForRound(config,i+1)),[10,10,10,10,10]);
 assert.deepEqual(Array.from({length:5},(_,i)=>i<4?restSecAfterRound(config,i+1):0),[10,10,10,10,0]);
 assert.deepEqual(Array.from({length:5},(_,i)=>blockRestSecAfterRound(config,i+1)),[10,10,10,10,0]);
 assert.equal(totalDurationSecForConfig(config),130);
 assert.equal(remainingTotalSecForState({phase:'work',roundIndex:1,remainingSec:10,config}),130);
 assert.equal(remainingTotalSecForState({phase:'rest',roundIndex:1,remainingSec:10,config}),120);
 assert.equal(remainingTotalSecForState({phase:'block_rest',roundIndex:1,remainingSec:10,config}),110);
});

test('program stage carries both rests independently with exact 1 round x 5 blocks',()=>{
 const rows=compileProgram(stages,profiles);
 assert.equal(rows.length,5);
 assert.deepEqual(rows.map(r=>[r.localRound,r.block,r.restSec,r.blockRestSec]),[[1,1,10,10],[1,2,10,10],[1,3,10,10],[1,4,10,10],[1,5,0,0]]);
 assert.equal(totalDurationSecForConfig({programRounds:rows}),130);
 assert.equal(rows.reduce((sum,r)=>sum+r.workSec+r.restSec+r.blockRestSec,0),130);
});

test('true three consecutive phases work -> round rest -> block rest -> next work, standalone and program',async()=>{
 const original=globalThis.window;globalThis.window={setInterval:()=>123,clearInterval:()=>{}};
 try {
  for(const source of [config,{programRounds:compileProgram(stages,profiles),rounds:1}]){
   const signals=[];const timer=new TimerEngine({onEvent:e=>signals.push(e.type)});
   timer.applyConfig({...source,countdownEnabled:false});timer.beginWorkPhase(1);
   assert.equal(timer.state.phase,'work');assert.equal(timer.state.remainingSec,10);
   await timer.finishCurrentPhase();assert.equal(timer.state.phase,'rest');assert.equal(timer.state.remainingSec,10);
   await timer.finishCurrentPhase();assert.equal(timer.state.phase,'block_rest');assert.equal(timer.state.remainingSec,10);
   await timer.finishCurrentPhase();assert.equal(timer.state.phase,'work');assert.equal(timer.state.roundIndex,2);
   assert.deepEqual(signals,['round-end-zero','block-rest-start-zero','block-rest-end-zero']);
   timer.beginWorkPhase(5);await timer.finishCurrentPhase();assert.equal(timer.state.phase,'finished');
   assert.equal(signals.at(-1),'workout-end-zero');timer.stopInterval();
  }
 } finally {globalThis.window=original;}
});

test('step changes reset per block, normal rest and block rest never overwrite each other',()=>{
 const c={...config,rounds:3,blockCount:3,workSec:60,restSec:35,workStepSec:5,restStepSec:-5,blockRestSec:60};
 assert.deepEqual(Array.from({length:9},(_,i)=>workSecForRound(c,i+1)),[60,65,70,60,65,70,60,65,70]);
 assert.deepEqual(Array.from({length:9},(_,i)=>i<8?restSecAfterRound(c,i+1):0),[35,30,25,35,30,25,35,30,0]);
 assert.deepEqual(Array.from({length:9},(_,i)=>blockRestSecAfterRound(c,i+1)),[0,0,60,0,0,60,0,0,0]);
 const rows=compileProgram([{presetId:'classic1',settings:c}],profiles);
 assert.deepEqual(rows.map(r=>r.blockRestSec),[0,0,60,0,0,60,0,0,0]);
 assert.equal(totalDurationSecForConfig(c),9*65+(35+30+25)*2+(35+30)+120);
 assert.equal(totalDurationSecForConfig({programRounds:rows}),totalDurationSecForConfig(c));
});

test('the main +/- edits round rest, and gear continues to edit inter-block rest independently',()=>{
 const c={...config,workSec:60,restSec:35,blockRestSec:60};
 assert.equal(editableRestField(c,'restSec'),'restSec');
 assert.equal(displayDurationsForState({phase:'idle',roundIndex:0,config:c}).restSec,35);
 assert.equal(totalDurationSecForConfig(c),5*60+4*35+4*60);
 c[editableRestField(c,'restSec')]-=5;
 assert.equal(displayDurationsForState({phase:'idle',roundIndex:0,config:c}).restSec,30);
 assert.equal(blockRestSecAfterRound(c,1),60);
 assert.equal(totalDurationSecForConfig(c),5*60+4*30+4*60);
});

test('zero-duration normal rest can jump straight into block rest without fake round start',async()=>{
 const original=globalThis.window;globalThis.window={setInterval:()=>123,clearInterval:()=>{}};
 try{
  const signals=[];const t=new TimerEngine({onEvent:e=>signals.push(e.type)});
  t.applyConfig({...config,restSec:0});t.beginWorkPhase(1);
  await t.finishCurrentPhase();assert.equal(t.state.phase,'block_rest');
  await t.finishCurrentPhase();assert.equal(t.state.phase,'work');assert.equal(t.state.roundIndex,2);
  assert.deepEqual(signals,['block-rest-start-zero','block-rest-end-zero']);
  t.stopInterval();
 }finally{globalThis.window=original;}
});
