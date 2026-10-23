import test from 'node:test';
import assert from 'node:assert/strict';
import {CATEGORIES,LIBRARY,findWorkout,buildSteps} from '../app/js/library/catalog.js';
import {stageForWorkout} from '../app/js/library/native-adapter.js';
import {compileProgram,normalizeProgram} from '../app/js/core/program.js';
import {clonePreset} from '../app/js/state/presets.js';
import {stageTimingRows} from '../app/js/ui/stage-timing-rows.js';
import {buildLadderPlanRows} from '../app/js/ui/ladder-plan-rows.js';
import {timeClock} from '../app/js/ui/library-card-view.js';

const profiles=Object.fromEntries(['classic1','classic2','classic3','tabata2020x24'].map(id=>[id,clonePreset(id)]));
const cases=[
 {id:'TP01',title:'Сила + лёгкость',first:'Кувалда',firstTimes:[60,60,60,60,60],rest:60,total:840},
 {id:'TP02',title:'Сила + лёгкость 2',first:'Медицинбол',firstTimes:[60,60,60,60,60],rest:60,total:840},
 {id:'TP03',title:'Сила + лёгкость — микс',first:'Кувалда',firstTimes:[30,30,30,60,60,60],rest:40,total:830}
];
test('new two-phase section and stable IDs, existing categories preserved',()=>{
 assert.deepEqual(CATEGORIES.find(([id])=>id==='two_phase'),['two_phase','Двухфазные']);
 assert.deepEqual(LIBRARY.filter(x=>x.category==='two_phase').map(x=>x.id),cases.map(x=>x.id));
 assert.equal(new Set(LIBRARY.map(x=>x.id)).size,LIBRARY.length);
 assert.equal(LIBRARY.length,189);
});
for(const item of cases){
 test(item.id+' uses real TWO_PHASE engine: per-round phases, names, rest and exact total',()=>{
  const workout=findWorkout(item.id),stage=stageForWorkout(workout);
  assert.equal(workout.name,item.title);
  assert.equal(workout.mode,'two_phase');
  assert.equal(stage.settings.intervalMode,'two_phase');
  assert.equal(stage.settings.ladderEnabled,false);
  const rows=compileProgram([stage],profiles);
  assert.equal(rows.length,item.firstTimes.length);
  assert.deepEqual(rows.map(r=>r.workSec),item.firstTimes);
  assert.deepEqual(rows.map(r=>r.phaseTwoSec),item.firstTimes.map(()=>60));
  assert.deepEqual(rows.map(r=>r.restSec),item.firstTimes.map((_,i)=>i===item.firstTimes.length-1?0:item.rest));
  assert.deepEqual(rows.map(r=>r.phaseOneName),item.firstTimes.map((_,i)=>item.id==='TP03'&&i>=3?'Медицинбол':item.first));
  assert.deepEqual(rows.map(r=>r.phaseTwoName),item.firstTimes.map(()=> 'Бой с тенью'));
  assert.equal(rows.reduce((s,r)=>s+r.workSec+r.phaseTwoSec+r.restSec,0),item.total);
  const steps=buildSteps(workout);
  assert.deepEqual(steps.filter(s=>s.phase===1).map(s=>s.seconds),item.firstTimes);
  assert.deepEqual(steps.filter(s=>s.phase===2).map(s=>s.seconds),item.firstTimes.map(()=>60));
  assert.equal(steps.filter(s=>s.kind==='rest').length,item.firstTimes.length-1);
  assert.equal(steps.reduce((sum,x)=>sum+x.seconds,0),item.total);
  const normalized=normalizeProgram([stage])[0];
  assert.deepEqual(compileProgram([normalized],profiles),rows,'save/load preserves all phases/timing');
  const plan=buildLadderPlanRows({programRounds:rows});
  assert.ok(plan.includes('Этап 1 из 1 · Две фазы'));
  assert.ok(plan.includes('Фаза 1 · '+item.first));
  assert.ok(plan.includes('Фаза 2 · Бой с тенью'));
  if(item.id==='TP03'){
   assert.ok(plan.includes('Фаза 1 · Медицинбол'));
   const labels=stageTimingRows(stage.settings,{total:item.total,rounds:rows});
   assert.match(labels[0][1],/фаза 1 00:30–01:00/);
  }
 });
}
test('catalog time formatting can show independent phase/timer totals',()=>{
 assert.equal(timeClock(840),'14:00');
 assert.equal(timeClock(830),'13:50');
});
