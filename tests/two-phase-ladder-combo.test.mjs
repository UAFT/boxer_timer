import test from 'node:test';
import assert from 'node:assert/strict';
import {hasLadder} from '../app/js/core/ladder-blocks.js';
import {phaseTwoSecForRound,workSecForRound,restSecAfterRound,totalDurationSecForConfig,remainingTotalSecForState} from '../app/js/core/schedule.js';
import {compileProgram,normalizeProgram} from '../app/js/core/program.js';
import {clonePreset} from '../app/js/state/presets.js';
import {TimerEngine} from '../app/js/timer/timer-engine.js';
import {ladderPlanPhaseCaption,buildLadderPlanRows} from '../app/js/ui/ladder-plan-rows.js';
import {saveRoundTiming,parseTimeValue} from '../app/js/ui/round-time-editor.js';
import {serializeWorkoutFile,parseWorkoutFile} from '../app/js/sharing/workout-file.js';
const cfg={...clonePreset('classic1'),intervalMode:'two_phase',ladderEnabled:true,
 rounds:4,workSec:60,phaseTwoSec:40,restSec:60,workStepSec:-20,phaseTwoStepSec:0,restStepSec:0,
 phaseOneName:'Кувалда',phaseTwoName:'Бой с тенью'};
const profiles={classic1:clonePreset('classic1')};
const stage=()=>({presetId:'classic1',title:'Дровосек',settings:structuredClone(cfg),restAfterSec:0});
test('two-phase ladder: independent phase1, phase2, rest step and exact duration',()=>{
 assert.equal(hasLadder(cfg),true);
 assert.equal(hasLadder({...cfg,ladderEnabled:false}),false);
 assert.deepEqual(Array.from({length:4},(_,i)=>workSecForRound(cfg,i+1)),[60,40,20,1]);
 assert.deepEqual(Array.from({length:4},(_,i)=>phaseTwoSecForRound(cfg,i+1)),[40,40,40,40]);
 assert.deepEqual(Array.from({length:4},(_,i)=>restSecAfterRound(cfg,i+1)),[60,60,60,60]);
 assert.equal(totalDurationSecForConfig(cfg),60+40+20+1+40*4+60*3);
 const b={...cfg,workStepSec:-5,phaseTwoStepSec:-10,restStepSec:-5};
 assert.deepEqual(Array.from({length:4},(_,i)=>phaseTwoSecForRound(b,i+1)),[40,30,20,10]);
 assert.deepEqual(Array.from({length:4},(_,i)=>restSecAfterRound(b,i+1)),[60,55,50,45]);
 assert.equal(totalDurationSecForConfig(b),210+100+165); // work 60+55+50+45
});
test('manual overrides preserve automatic neighboring rounds and can be cleared',()=>{
 const s=stage();
 saveRoundTiming(s,2,cfg,{workSec:13,phaseTwoSec:30,restSec:45});
 let compiled=compileProgram([s],profiles);
 assert.equal(compiled[0].workSec,60);
 assert.equal(compiled[1].workSec,40);
 assert.deepEqual([compiled[2].workSec,compiled[2].phaseTwoSec,compiled[2].restSec],[13,30,45]);
 assert.equal(compiled[3].workSec,1);
 assert.equal(compiled[3].restSec,0);
 assert.equal(totalDurationSecForConfig({programRounds:compiled}),compiled.reduce((sum,r)=>sum+r.workSec+r.phaseTwoSec+r.restSec,0));
 const encoded=serializeWorkoutFile({name:'Дровосек',entries:[s],options:{cycles:1,cycleRestSec:60}});
 const imported=parseWorkoutFile(encoded);
 assert.deepEqual(imported.entries[0].roundTimingOverrides[2],{workSec:13,phaseTwoSec:30,restSec:45});
 saveRoundTiming(s,2,cfg,{workSec:20,phaseTwoSec:40,restSec:60});
 assert.equal(s.roundTimingOverrides[2],null);
 assert.deepEqual(normalizeProgram([s])[0].roundTimingOverrides[2],null);
 assert.equal(parseTimeValue('00:13'),13);
 assert.equal(parseTimeValue('00:00'),null);
 assert.equal(parseTimeValue('00:00',{allowZero:true}),0);
 assert.equal(parseTimeValue('20:80'),null);
});
test('program plan shows correct stage round phase and individual timings',()=>{
 const s=stage();saveRoundTiming(s,1,cfg,{workSec:45,phaseTwoSec:35,restSec:20});
 const rows=compileProgram([s],profiles);
 const text=buildLadderPlanRows({programRounds:rows});
 assert.ok(text.includes('Фаза 1 · Кувалда'));
 assert.ok(text.includes('00:45'));
 assert.ok(text.includes('00:35'));
 assert.ok(text.includes('00:20'));
 assert.equal(ladderPlanPhaseCaption({config:{programRounds:rows},roundIndex:2,phase:'work_two'}),'Этап 1 · Раунд 2 · Фаза 2');
 assert.equal(ladderPlanPhaseCaption({config:{programRounds:rows},roundIndex:3,phase:'rest'}),'Этап 1 · Раунд 3 · Отдых');
});
test('single timer engine follows combined phase1->phase2->rest->next automatically',async()=>{
 const prev=globalThis.window;globalThis.window={setInterval:()=>123,clearInterval:()=>{}};
 try{
  for(const config of [cfg,{programRounds:compileProgram([stage()],profiles)}]){
   const t=new TimerEngine();t.applyConfig(config);t.beginWorkPhase(1);
   assert.equal(t.state.remainingSec,60);
   await t.finishCurrentPhase();assert.equal(t.state.phase,'work_two');assert.equal(t.state.remainingSec,40);
   await t.finishCurrentPhase();assert.equal(t.state.phase,'rest');assert.equal(t.state.remainingSec,60);
   await t.finishCurrentPhase();assert.equal(t.state.phase,'work');assert.equal(t.state.remainingSec,40);
   t.stopInterval();
  }
 }finally{globalThis.window=prev;}
});
