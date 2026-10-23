import test from 'node:test';
import assert from 'node:assert/strict';
import {runWorkout,check} from './support/engine-model.mjs';
import {mulberry32} from './support/vloop.mjs';
import * as S from '../app/js/core/schedule.js';
import {compileProgram} from '../app/js/core/program.js';
import {normalizeSettings} from '../app/js/state/settings-store.js';
import {clonePreset} from '../app/js/state/presets.js';
import {LIBRARY} from '../app/js/library/catalog.js';
import {stageForWorkout} from '../app/js/library/native-adapter.js';
import {starterPrograms} from '../app/js/core/starter-programs.js';

// Release gate from audit R2: every preset, starter program and library workout,
// plus seeded random timers and programs, run on a virtual clock. The phases, their
// durations to the millisecond, every cue with its exact time, the plan rows, "Всего"
// and "Осталось" must all agree with the schedule.
const PRESETS=['classic3','classic2','classic1','tabata2020x24'];
const profiles=Object.fromEntries(PRESETS.map(id=>[id,normalizeSettings(clonePreset(id),clonePreset(id))]));
const programConfig=(entries,options={cycles:1,cycleRestSec:60},active='classic3')=>
 ({...profiles[active],presetId:active,programRounds:compileProgram(entries,profiles,options),intervalMode:'standard'});
async function verify(cases){
 const problems=[];
 for(const [name,cfg] of cases)check(name,await runWorkout(cfg),problems);
 assert.deepEqual(problems,[]);
}

test('presets, starter programs and every library workout match their plan exactly',async()=>{
 const cases=PRESETS.map(id=>['preset:'+id,{...profiles[id],presetId:id}]);
 for(const p of starterPrograms)cases.push(['starter:'+p.id,programConfig(p.entries,p.options)]);
 for(const w of LIBRARY){const stage=stageForWorkout(w);assert.ok(stage,w.id);cases.push(['library:'+w.id,programConfig([stage])]);}
 await verify(cases);
});

test('seeded random timers and programs match their plan exactly',async()=>{
 const rnd=mulberry32(20261023),pick=a=>a[Math.floor(rnd()*a.length)],int=(a,b)=>a+Math.floor(rnd()*(b-a+1));
 const stage=()=>{
  const mode=pick(['standard','ladder','two_phase','two_phase','count_up']);
  const settings=normalizeSettings({rounds:int(1,5),workSec:int(1,25),restSec:pick([0,0,int(1,15)]),phaseTwoSec:int(1,20),
   intervalMode:mode,ladderEnabled:mode==='two_phase'&&rnd()<.5,workStepSec:pick([-10,-5,0,5,10]),restStepSec:pick([-5,0,5]),
   phaseTwoStepSec:pick([-5,0,5]),blockEnabled:rnd()<.5,blockCount:int(1,3),blockRestSec:pick([0,5,10,15]),warningSeconds:pick([0,4,10])},clonePreset('classic1'));
  const roundTimingOverrides=Array.from({length:S.totalRoundsForConfig(settings)},()=>rnd()<.3?{workSec:int(1,20),...(rnd()<.5?{restSec:int(0,9)}:{}),...(rnd()<.5?{phaseTwoSec:int(1,9)}:{})}:null);
  return {presetId:pick(PRESETS),title:'S',restAfterSec:pick([0,5,10]),settings,roundTimingOverrides};
 };
 const cases=[];
 for(let i=0;i<Number(process.env.FT_DIFF_CASES||120);i++){
  if(rnd()<.4){const st=stage();cases.push(['standalone#'+i,{...st.settings,presetId:'classic1'}]);}
  else cases.push(['program#'+i,{...programConfig(Array.from({length:int(1,4)},stage),{cycles:int(1,3),cycleRestSec:pick([0,5,10])},pick(PRESETS)),warningSeconds:pick([0,4,10])}]);
 }
 await verify(cases);
});
