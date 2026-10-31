import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseWorkoutFile,WorkoutFileError} from '../app/js/sharing/workout-file.js';
import {compileProgram,normalizeProgram,MAX_PROGRAM_ROUNDS} from '../app/js/core/program.js';
import {clonePreset} from '../app/js/state/presets.js';

const profiles=Object.fromEntries(['classic3','classic2','classic1','tabata2020x24'].map(id=>[id,clonePreset(id)]));
const file=({settings={},cycles=1,entries=1}={})=>JSON.stringify({format:'fighttech.workout',version:1,name:'Подарок',options:{cycles,cycleRestSec:0},
 entries:Array.from({length:entries},()=>({presetId:'classic3',title:'Раунды',restAfterSec:0,settings:{...clonePreset('classic3'),rounds:3,workSec:180,restSec:60,...settings}}))});

// Audit R2 IMP-1: a stage setting the app never writes ("programRounds" as a string)
// made the stage look like a compiled program: 100 rounds of undefined length,
// total NaN, the whole "workout" over in 14 s with 101 bells.
test('a received file cannot smuggle unknown keys into stage settings',()=>{
 const program=parseWorkoutFile(file({settings:{programRounds:'x'.repeat(100),presetId:'tabata2020x24',evil:true}}));
 for(const key of ['programRounds','presetId','evil'])assert.equal(key in program.entries[0].settings,false,key);
 assert.equal(program.entries[0].settings.rounds,3);
 const rounds=compileProgram(program.entries,profiles,program.options);
 assert.equal(rounds.length,3);
 assert.ok(rounds.every(r=>r.workSec===180&&Number.isFinite(r.restSec)));
});

test('stored programs keep every known setting exactly as it was',()=>{
 const settings={...clonePreset('classic1'),intervalMode:'two_phase',phaseTwoSec:45,phaseOneName:'Джеб',phaseTwoName:'Тень',
  ladderEnabled:true,phaseTwoStepSec:5,blockEnabled:true,blockCount:3,blockRestSec:90,workStepSec:10,restStepSec:-5,rounds:'4'};
 const [entry]=normalizeProgram([{presetId:'classic1',title:'',restAfterSec:60,settings:{...settings,programRounds:[{workSec:1}]}}]);
 assert.deepEqual(entry.settings,settings);
});

test('an imported program above 1000 rounds is refused with its own reason; 1000 is accepted',()=>{
 assert.equal(MAX_PROGRAM_ROUNDS,1000);
 assert.equal(parseWorkoutFile(file({settings:{rounds:50},cycles:20})).entries.length,1);
 assert.throws(()=>parseWorkoutFile(file({settings:{rounds:51},cycles:20})),e=>e instanceof WorkoutFileError&&e.code==='too_long');
 const ui=readFileSync(new URL('../app/js/sharing/workout-exchange-ui.js',import.meta.url),'utf8');
 assert.ok(ui.includes("too_long:'Программа слишком длинная (максимум 1000 раундов).'"));
});

test('compiling a pathological editor program stays bounded; one stage stays exact',()=>{
 const huge={...clonePreset('classic3'),intervalMode:'ladder',rounds:99,blockEnabled:true,blockCount:99,workSec:5,restSec:0};
 const started=process.hrtime.bigint();
 const rounds=compileProgram(Array.from({length:24},()=>({presetId:'classic3',title:'',restAfterSec:0,settings:huge})),profiles,{cycles:20});
 assert.ok(rounds.length>MAX_PROGRAM_ROUNDS&&rounds.length<=10001,String(rounds.length));
 assert.ok(Number(process.hrtime.bigint()-started)/1e6<5000);
 assert.equal(compileProgram([{presetId:'classic3',title:'',restAfterSec:0,settings:huge}],profiles,{cycles:1}).length,9801);
});

test('the editor refuses to start or save a program above the limit and edits only 200 rounds',()=>{
 const app=readFileSync(new URL('../app/js/app.js',import.meta.url),'utf8');
 assert.ok(app.includes('isPlaybackProtected(timer,programRunning) || refuseTooLong(programEntries,programOptions)) return;'));
 // Start + the single «Сохранить» button (diary STAGE 2 merged «Обновить» and «Сохранить как новую»).
 assert.equal(app.match(/refuseTooLong\(programEntries,programOptions\)/g).length,1);
 // STAGE 4: the one «Сохранить» button checks whatever it saves (the editor's program or a diary appointment).
 assert.ok(app.includes('if(saving || refuseTooLong(src.entries,src.options))return;'));
 assert.ok(app.includes('for(let j=0;j<Math.min(rounds,200);j++)'));
 // No plan preview either: drawing a too-long plan would only freeze the screen.
 assert.ok(app.includes('return rounds.length > MAX_PROGRAM_ROUNDS ? null : rounds;'));
});
