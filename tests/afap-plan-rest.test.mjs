import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLadderPlanRows} from '../app/js/ui/ladder-plan-rows.js';
import {compileProgram} from '../app/js/core/program.js';
import {stageForWorkout,LIBRARY} from '../app/js/library/native-adapter.js';
import {clonePreset} from '../app/js/state/presets.js';

// After an AFAP stage is finished by hand the engine runs the stage's rest before
// the next stage, but the plan never showed that rest (found by the plan/engine
// differential check of audit R2).
const profiles=Object.fromEntries(['classic3','classic2','classic1','tabata2020x24'].map(id=>[id,clonePreset(id)]));
const afap=stageForWorkout(LIBRARY.find(w=>w.mode==='afap'));

test('the plan shows the rest after an AFAP stage, and none after the last one',()=>{
 const rounds=compileProgram([afap,{presetId:'classic1',title:'',restAfterSec:0},afap],profiles,{cycles:1});
 assert.equal(rounds[0].restSec,60);
 const html=buildLadderPlanRows({programRounds:rounds});
 const afapRows=html.match(/<div class="ladder-live-row ft-afap-row".*?<\/span>/g);
 assert.equal(afapRows.length,2);
 assert.ok(afapRows[0].includes('Таймер · прямой отсчёт'));
 assert.equal(afapRows[0].includes('· отдых'),false);
 assert.ok(html.includes('class="ladder-stage-rest-chip" data-after-round="1"'));
 assert.ok(html.includes('Отдых между этапами 1–2 / 01:00'));
 assert.equal(afapRows[1].includes('отдых'),false);
});

test('a zero rest after AFAP is not shown, because none is run',()=>{
 const rounds=compileProgram([{...afap,restAfterSec:0},{presetId:'classic1',title:'',restAfterSec:0}],profiles,{cycles:1});
 assert.equal(buildLadderPlanRows({programRounds:rounds}).includes('прямой отсчёт · отдых'),false);
});
