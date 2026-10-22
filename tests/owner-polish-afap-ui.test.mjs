import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LIBRARY} from '../app/js/library/catalog.js';
import {stageForWorkout} from '../app/js/library/native-adapter.js';
import {compileProgram} from '../app/js/core/program.js';
import {clonePreset} from '../app/js/state/presets.js';

const profiles={classic1:clonePreset('classic1')};
const html=readFileSync(new URL('../app/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../app/styles/fight-tech-ui-kit.css',import.meta.url),'utf8');
const js=readFileSync(new URL('../app/js/app.js',import.meta.url),'utf8');

for(const workout of LIBRARY.filter(w=>w.mode==='afap')) {
 test('AFAP '+workout.id+' is available through existing count-up engine',()=>{
  const stage=stageForWorkout(workout);
  assert.ok(stage);
  assert.equal(stage.settings.intervalMode,'count_up');
  assert.equal(stage.settings.ladderEnabled,false);
  assert.equal(stage.settings.blockEnabled,false);
  assert.equal(stage.roundDescriptions[0],workout.tasks.join(' · '));
  const rounds=compileProgram([stage],profiles);
  assert.equal(rounds.length,1);
  assert.equal(rounds[0].intervalMode,'count_up');
  assert.equal(rounds[0].workSec,0);
  assert.equal(rounds[0].restSec,0);
  assert.match(rounds[0].stageTitle,/AFAP/);
 });
}

test('AFAP works as a stage with a following 60-second interstage rest',()=>{
 const stage=stageForWorkout(LIBRARY.find(w=>w.mode==='afap'));
 const followed={...stageForWorkout(LIBRARY.find(w=>w.id==='W01')),restAfterSec:0};
 const rows=compileProgram([stage,followed],{classic1:profiles.classic1,classic3:clonePreset('classic3')});
 assert.equal(rows[0].restSec,60);
 assert.equal(rows[0].intervalMode,'count_up');
 assert.equal(rows[1].intervalMode,'standard');
});

test('compact controls and dual-phase ladder plus exist without a new mode',()=>{
 assert.match(html,/id="stageDualLadderPlus"/);
 assert.match(js,/stageDualLadderPlus.*addEventListener\('click'/);
 assert.match(js,/id\('LadderEnabled'\)\.checked=!paired/);
 assert.match(css,/ft-saved-program-add/);
 assert.match(css,/ft-stage-combo-button/);
 assert.match(css,/\.ladder-preview-row strong:last-child/);
 assert.match(css,/#roundEditInput:focus/);
});
