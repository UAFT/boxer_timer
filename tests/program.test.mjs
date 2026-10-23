import test from 'node:test';
import assert from 'node:assert/strict';
import {compileProgram,normalizeProgram,syncStagesWithPreset} from '../app/js/core/program.js';
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
 assert.equal(rows[5].restSec,30);
 assert.equal(rows[5].blockRestSec,90);
 assert.equal(rows[8].restSec,45);
 const config={programRounds:rows,rounds:3};
 assert.equal(totalRoundsForConfig(config),12);
 assert.equal(restSecAfterRound(config,3),75);
 assert.equal(workSecForRound(config,4),60);
 assert.equal(totalDurationSecForConfig(config),rows.reduce((sum,r,i)=>sum+r.workSec+(i<rows.length-1?r.restSec+(r.blockRestSec||0):0),0));
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
test('program cycles preserve names, independent settings, stage rests and cycle rests',()=>{
 const stages=[
  {presetId:'classic3',title:'Разминка',restAfterSec:60,settings:{rounds:1,workSec:180,restSec:60,intervalMode:'standard'}},
  {presetId:'classic2',title:'Скорость',restAfterSec:0,settings:{rounds:2,workSec:20,restSec:20,intervalMode:'standard'}}
 ];
 const rows=compileProgram(stages,profiles,{cycles:2,cycleRestSec:120});
 assert.equal(rows.length,6);
 assert.deepEqual(rows.map(x=>x.workSec),[180,20,20,180,20,20]);
 assert.deepEqual(rows.map(x=>x.restSec),[60,20,120,60,20,0]);
 assert.deepEqual(rows.map(x=>x.cycleIndex),[0,0,0,1,1,1]);
 assert.equal(rows[0].stageTitle,'Разминка');
 assert.equal(rows[3].stageTitle,'Разминка');
 assert.equal(totalDurationSecForConfig({programRounds:rows}),180*2+20*4+60*2+20*2+120);
 profiles.classic3.workSec=600;
 assert.equal(compileProgram(stages,profiles,{cycles:1})[0].workSec,180);
});
test('round names and descriptions survive normalization and compilation',()=>{
 const input=[{presetId:'classic3',title:'Техника',roundNames:['Двойки','Тройки'],roundDescriptions:['Два удара','Три удара'],settings:{rounds:2,workSec:180,restSec:60,intervalMode:'standard'}}];
 const normalized=normalizeProgram(input);
 assert.deepEqual(normalized[0].roundNames,['Двойки','Тройки']);
 const rows=compileProgram(normalized,profiles,{cycles:2});
 assert.deepEqual(rows.map(x=>x.roundName),['Двойки','Тройки','Двойки','Тройки']);
 assert.equal(rows[0].roundDescription,'Два удара');
});
test('ladder block boundary uses configured block rest in compiled program',()=>{
 const config={rounds:4,workSec:20,restSec:20,intervalMode:'ladder',workStepSec:0,restStepSec:0,blockEnabled:true,blockCount:2,blockRestSec:40};
 assert.equal(totalRoundsForConfig(config),8);
 assert.equal(restSecAfterRound(config,4),20);
 const rows=compileProgram([{presetId:'classic2',settings:config}],profiles);
 assert.equal(rows[3].restSec,20);
 assert.equal(rows[3].blockRestSec,40);
 assert.equal(rows[7].restSec,0);
 assert.equal(rows[7].blockRestSec,0);
});
test('closing Settings without edits leaves stages with their own settings untouched',()=>{
 const preset={rounds:5,workSec:60,restSec:60,intervalMode:'standard',phaseTwoSec:40,phaseOneName:'',phaseTwoName:'',ladderEnabled:false,blockEnabled:false,blockCount:1,blockRestSec:90,workStepSec:0,restStepSec:0,phaseTwoStepSec:0,warningSeconds:4};
 const twoPhase={presetId:'classic1',settings:{...preset,intervalMode:'two_phase',phaseTwoSec:60,phaseOneName:'Джеб',phaseTwoName:'Бой с тенью'}};
 const ladder={presetId:'classic1',settings:{...preset,intervalMode:'ladder',workStepSec:30,blockEnabled:true,blockCount:2}};
 const entries=[twoPhase,ladder].map(e=>structuredClone(e));
 assert.equal(syncStagesWithPreset(entries,'classic1',preset,{...preset}),false);
 assert.equal(syncStagesWithPreset(entries,'classic1',preset,{...preset,warningSeconds:10}),false);
 assert.deepEqual(entries,[twoPhase,ladder]);
});
test('a Settings edit reaches same-preset stages only in the changed field',()=>{
 const preset={intervalMode:'standard',workStepSec:0,blockCount:1,phaseTwoSec:40,phaseOneName:''};
 const entries=[{presetId:'classic1',settings:{...preset,intervalMode:'two_phase',phaseTwoSec:60,phaseOneName:'Джеб'}},
  {presetId:'classic3',settings:{...preset}},{presetId:'classic1'},{presetId:'classic1',settings:{...preset,intervalMode:'count_up'}}];
 assert.equal(syncStagesWithPreset(entries,'classic1',preset,{...preset,workStepSec:15}),true);
 assert.deepEqual(entries[0].settings,{...preset,intervalMode:'two_phase',phaseTwoSec:60,phaseOneName:'Джеб',workStepSec:15});
 assert.equal(entries[1].settings.workStepSec,0);
 assert.equal(entries[2].settings,undefined);
 assert.equal(entries[3].settings.workStepSec,0);
});
