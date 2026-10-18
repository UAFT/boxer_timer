import test from 'node:test';
import assert from 'node:assert/strict';
import {compileProgram,normalizeProgram} from '../app/js/core/program.js';
import {totalRoundsForConfig,restSecAfterRound,workSecForRound,totalDurationSecForConfig} from '../app/js/core/schedule.js';
import {TimerEngine} from '../app/js/timer/timer-engine.js';
const profiles={
 classic3:{rounds:3,workSec:180,restSec:60,intervalMode:'standard'},
 classic2:{rounds:3,workSec:60,restSec:30,intervalMode:'ladder',workStepSec:-20,restStepSec:0,blockEnabled:true,blockCount:2,blockRestSec:90}
};
test('3-2-3 duplicate stages, independent boundary rests, full duration',()=>{
 const stages=normalizeProgram([{presetId:'classic3',restAfterSec:75},{presetId:'classic2',restAfterSec:45},{presetId:'classic3'}]);
 const rows=compileProgram(stages,profiles);
 assert.equal(rows.length,12);
 assert.deepEqual(rows.map(r=>r.workSec),[180,180,180,60,40,20,60,40,20,180,180,180]);
 assert.equal(rows[2].restSec,75);
 assert.equal(rows[5].restSec,90);
 assert.equal(rows[8].restSec,45);
 const config={programRounds:rows,rounds:3};
 assert.equal(totalRoundsForConfig(config),12);
 assert.equal(restSecAfterRound(config,3),75);
 assert.equal(workSecForRound(config,4),60);
 assert.equal(totalDurationSecForConfig(config),rows.reduce((sum,r,i)=>sum+r.workSec+(i<rows.length-1?r.restSec:0),0));
});
test('engine automatically transitions from one preset to another',async()=>{
 globalThis.window={setInterval:()=>1,clearInterval:()=>{}};
 const rows=compileProgram([{presetId:'classic3',restAfterSec:75},{presetId:'classic2'}],profiles);
 const t=new TimerEngine({onEvent:()=>Promise.resolve()});
 t.applyConfig({programRounds:rows,rounds:3,countdownEnabled:false});
 t.beginWorkPhase(3);
 await t.finishCurrentPhase();
 assert.equal(t.state.phase,'rest');
 assert.equal(t.state.remainingSec,75);
 await t.finishCurrentPhase();
 assert.equal(t.state.phase,'work');
 assert.equal(t.state.roundIndex,4);
 assert.equal(t.state.remainingSec,60);
 t.reset();
});
