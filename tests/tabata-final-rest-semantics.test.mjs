import test from 'node:test';
import assert from 'node:assert/strict';
import {LIBRARY,buildSteps} from '../app/js/library/catalog.js';
import {stageForWorkout} from '../app/js/library/native-adapter.js';
import {compileProgram} from '../app/js/core/program.js';
import {totalDurationSecForConfig} from '../app/js/core/schedule.js';

for (const [id,rounds,duration] of [['T01',8,230],['T02',8,230],['T03',8,230],['T04',32,950]]) {
 test(`: Tabata ends immediately after final work; no redundant rest/beep`,()=>{
  const workout=LIBRARY.find(row=>row.id===id);
  const steps=buildSteps(workout);
  assert.equal(steps.filter(row=>row.kind==='work').length,rounds);
  assert.equal(steps.filter(row=>row.kind==='rest').length,rounds-1);
  assert.equal(steps.at(-1).kind,'work');
  assert.equal(steps.reduce((sum,row)=>sum+row.seconds,0),duration);
  const stage=stageForWorkout(workout);
  const compiled=compileProgram([stage],{[stage.presetId]:stage.settings});
  assert.equal(compiled.at(-1).restSec,0);
  assert.equal(totalDurationSecForConfig({programRounds:compiled}),duration);
 });
}
