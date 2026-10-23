import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LIBRARY} from '../app/js/library/catalog.js';
import {stageForWorkout} from '../app/js/library/native-adapter.js';
import {compileProgram} from '../app/js/core/program.js';
import {clonePreset} from '../app/js/state/presets.js';
import {buildLadderPlanRows} from '../app/js/ui/ladder-plan-rows.js';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
test('expanded plan uses same finishStage action as timer',()=>{
 assert.match(read('../app/index.html'),/id="ladderFinishStage"[^>]*hidden/);
 assert.match(read('../app/js/app.js'),/getElementById\('ladderFinishStage'\).*timer\.finishStage\(\)/);
 assert.match(read('../app/js/ui/render.js'),/ladderFinishStage'\)\.hidden=preview\|\|state\.phase!==PHASES\.COUNT_UP/);
});
test('AFAP plan presents real library tasks, not hardcoded exercises',()=>{
 for(const workout of LIBRARY.filter(w=>w.mode==='afap')){
  const stage=stageForWorkout(workout);
  const config={...stage.settings,programRounds:compileProgram([stage],{classic1:clonePreset('classic1')})};
  const html=buildLadderPlanRows(config);
  for(const task of workout.tasks)assert.ok(html.includes(task),`: `);
 }
});
