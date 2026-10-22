import test from 'node:test';
import assert from 'node:assert/strict';
import {totalDurationSecForConfig,remainingTotalSecForState,phaseTwoSecForRound} from '../app/js/core/schedule.js';
import {compileProgram,normalizeLibrary,normalizeProgram} from '../app/js/core/program.js';
import {TimerEngine} from '../app/js/timer/timer-engine.js';
import {programDurationSec} from '../app/js/ui/program-presentation.js';
import {programCardTimings} from '../app/js/ui/library-card-view.js';
import {buildLadderPlanRows,ladderPlanPhaseCaption} from '../app/js/ui/ladder-plan-rows.js';
import {normalizeSettings} from '../app/js/state/settings-store.js';
import {clonePreset} from '../app/js/state/presets.js';
import {PHASES} from '../app/js/core/constants.js';

const settings={...clonePreset('classic1'),intervalMode:'two_phase',rounds:5,workSec:60,phaseTwoSec:40,restSec:60,countdownEnabled:false,phaseOneName:'Кувалда',phaseTwoName:'Бой с тенью'};
const entry={presetId:'classic1',title:'Две фазы',roundNames:['Раунд 1','','','Раунд 4'],phaseOneOverrides:['','','','Бросок медбола в стену','Бросок медбола в пол'],phaseTwoOverrides:[],settings,restAfterSec:0};
const profiles={classic1:clonePreset('classic1')};
test('two phase totals 12:20, no final rest',()=>{
 assert.equal(totalDurationSecForConfig(settings),740);
 assert.equal(remainingTotalSecForState({config:settings,phase:PHASES.WORK,roundIndex:1,remainingSec:60}),740);
 assert.equal(remainingTotalSecForState({config:settings,phase:PHASES.WORK_TWO,roundIndex:1,remainingSec:40}),680);
 assert.equal(remainingTotalSecForState({config:settings,phase:PHASES.REST,roundIndex:1,remainingSec:60}),640);
 assert.equal(phaseTwoSecForRound(settings,3),40);
});
test('one stage five rounds, labels from common fields with round 4/5 overrides',()=>{
 const rows=compileProgram([entry],profiles);
 assert.equal(rows.length,5);
 assert.deepEqual(rows.map(x=>[x.workSec,x.phaseTwoSec,x.restSec]),[[60,40,60],[60,40,60],[60,40,60],[60,40,60],[60,40,0]]);
 assert.equal(rows[0].phaseOneName,'Кувалда');assert.equal(rows[3].phaseOneName,'Бросок медбола в стену');
 assert.equal(rows[4].phaseOneName,'Бросок медбола в пол');
 assert.ok(rows.every(x=>x.phaseTwoName==='Бой с тенью'));
 assert.equal(totalDurationSecForConfig({programRounds:rows}),740);
 assert.equal(programDurationSec([entry],profiles),740);
 assert.equal(programCardTimings({entries:[entry],options:{}},profiles).total,740);
 assert.equal(programCardTimings({entries:[entry],options:{}},profiles).stages[0].duration,740);
 const html=buildLadderPlanRows({programRounds:rows});
 assert.equal((html.match(/class="ladder-live-row ft-two-phase-plan"/g)||[]).length,5);
 assert.ok(html.includes('Фаза 1 · Бросок медбола в стену'));
 assert.ok(html.includes('Фаза 2 · Бой с тенью'));
 assert.ok(!html.includes('Лестница · Лестница'));
});
test('saved program round overrides round-trip without losing old settings',()=>{
 const normalized=normalizeLibrary(JSON.parse(JSON.stringify([{id:'t1',name:'Две фазы',entries:[entry],options:{}}])));
 assert.equal(normalized[0].entries[0].phaseOneOverrides[3],'Бросок медбола в стену');
 assert.equal(normalized[0].entries[0].settings.phaseTwoSec,40);
 assert.equal(normalized[0].entries[0].settings.intervalMode,'two_phase');
 const s=normalizeSettings(settings,clonePreset('classic1'));
 assert.equal(s.phaseTwoSec,40);assert.equal(s.phaseOneName,'Кувалда');
 assert.equal(normalizeSettings({},clonePreset('classic1')).intervalMode,'standard');
 assert.equal(compileProgram(normalizeProgram([{presetId:'classic1'}]),profiles)[0].phaseTwoSec,0);
});
test('working phase 1 -> phase 2 -> rest -> next round -> finish, stable events',async()=>{
 const original=globalThis.window;globalThis.window={setInterval:()=>123,clearInterval:()=>{}};
 try{
  for(const cfg of [settings,{...settings,intervalMode:'standard',programRounds:compileProgram([entry],profiles)}]){
   const events=[];const timer=new TimerEngine({onEvent:e=>events.push(e.type)});
   timer.applyConfig(cfg);timer.beginWorkPhase(1);
   assert.equal(timer.state.phase,PHASES.WORK);assert.equal(timer.state.remainingSec,60);
   await timer.finishCurrentPhase();assert.equal(timer.state.phase,PHASES.WORK_TWO);assert.equal(timer.state.remainingSec,40);
   await timer.finishCurrentPhase();assert.equal(timer.state.phase,PHASES.REST);assert.equal(timer.state.remainingSec,60);
   await timer.finishCurrentPhase();assert.equal(timer.state.phase,PHASES.WORK);assert.equal(timer.state.roundIndex,2);
   assert.deepEqual(events,['phase-two-start-zero','round-end-zero','rest-end-zero']);
   timer.beginWorkPhase(5);await timer.finishCurrentPhase();await timer.finishCurrentPhase();
   assert.equal(timer.state.phase,PHASES.FINISHED);assert.equal(events.at(-1),'workout-end-zero');
   timer.stopInterval();
  }
 }finally{globalThis.window=original;}
});
test('paused second phase resumes with its same time; active title changes by phase',()=>{
 assert.equal(ladderPlanPhaseCaption({phase:PHASES.WORK,roundIndex:1,config:settings}),'Раунд 1 · Фаза 1');
 assert.equal(ladderPlanPhaseCaption({phase:PHASES.WORK_TWO,roundIndex:1,config:settings}),'Раунд 1 · Фаза 2');
 assert.equal(ladderPlanPhaseCaption({phase:PHASES.REST,roundIndex:1,config:settings}),'Раунд 1 · Отдых');
 assert.equal(ladderPlanPhaseCaption({phase:PHASES.IDLE,config:settings}),'');
});


test('two-phase workout exchange exports version 2 and retains labels while v1 remains compatible',async()=>{
 const {serializeWorkoutFile,parseWorkoutFile,WorkoutFileError}=await import('../app/js/sharing/workout-file.js');
 const source={name:'Кувалда и бой с тенью',entries:[entry],options:{cycles:1,cycleRestSec:60}};
 const encoded=serializeWorkoutFile(source);
 assert.equal(JSON.parse(encoded).version,2);
 const parsed=parseWorkoutFile(encoded);
 assert.equal(parsed.entries[0].phaseOneOverrides[3],'Бросок медбола в стену');
 assert.equal(parsed.entries[0].settings.phaseTwoSec,40);
 const old={name:'Обычная',entries:[{presetId:'classic1',title:'Обычная',restAfterSec:0,settings:{rounds:3,workSec:60,restSec:30,intervalMode:'standard'}}],options:{cycles:1,cycleRestSec:60}};
 const oldEncoded=serializeWorkoutFile(old);
 assert.equal(JSON.parse(oldEncoded).version,1);
 assert.equal(parseWorkoutFile(oldEncoded).entries.length,1);
 assert.throws(()=>parseWorkoutFile(JSON.stringify({...JSON.parse(encoded),version:3})),e=>e.code==='version');
});
