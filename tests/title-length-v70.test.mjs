import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeProgram,normalizeLibrary,MAX_TITLE} from '../app/js/core/program.js';
import {parseWorkoutFile,serializeWorkoutFile} from '../app/js/sharing/workout-file.js';
import {stageForWorkout} from '../app/js/library/native-adapter.js';
import {V42_WORKOUTS} from '../app/js/library/methodology-v42-rounds.js';

// V70 (owner 2026-10-29): long program titles are kept whole — stored, exported, imported — and the UI wraps them.
const long=V42_WORKOUTS['FT-S11-PARRY-IN-RIGHT-CLOSE'];
test('a library title over 100 characters survives the timer program, the saved library and a .ftworkout round trip',()=>{
 const stage=stageForWorkout(long);assert.ok(stage.title.length>100&&stage.title.endsWith(long.name));
 const [entry]=normalizeProgram([stage]);assert.equal(entry.title,stage.title,'no silent truncation');
 assert.equal(normalizeLibrary([{id:'x',name:stage.title,entries:[stage],options:{}}])[0].name,stage.title);
 const back=parseWorkoutFile(serializeWorkoutFile({name:stage.title,entries:[stage],options:{cycles:1,cycleRestSec:60}}));
 assert.equal(back.name,stage.title);assert.equal(back.entries[0].title,stage.title);
 assert.ok(MAX_TITLE>=2*Math.max(...Object.values(V42_WORKOUTS).map(w=>('Бокс — '+w.name).length)));
});
test('editor inputs and title rendering do not cut the title',()=>{
 const html=readFileSync(new URL('../app/index.html',import.meta.url),'utf8'),app=readFileSync(new URL('../app/js/app.js',import.meta.url),'utf8');
 for(const id of ['stageSettingsName','programNameInput'])assert.ok(new RegExp(`id="${id}"[^>]*maxlength="${MAX_TITLE}"`).test(html),id);
 assert.ok(!/title[^;]*slice\(0,80\)/.test(app)&&!app.includes("name.trim().slice(0,80)"));
 const css=readFileSync(new URL('../app/styles/stage-title.css',import.meta.url),'utf8');
 assert.ok(/\.program-stage-workout\{[^}]*overflow-wrap:anywhere/.test(css)&&!/\.program-stage-workout\{[^}]*(nowrap|ellipsis)/.test(css));
 // a long title is laid out across the card under the buttons, without splitting words
 assert.ok(app.includes("if((entry.title||'').length>40)stage.classList.add('is-long-title');"));
 const kit=readFileSync(new URL('../app/styles/fight-tech-ui-kit.css',import.meta.url),'utf8');
 assert.ok(kit.includes('.program-stage.is-long-title>.program-stage-main{grid-column:1/-1;grid-row:2}')&&kit.includes('.is-long-title .program-stage-workout{overflow-wrap:break-word}'));
});
