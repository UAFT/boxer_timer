import test from 'node:test';
import assert from 'node:assert/strict';
import {phaseLabelFor} from '../app/js/ui/render.js';

// A paused program showed an empty phase label during plain work: only the button
// text told the user the clock had stopped.
const program={programRounds:[{workSec:60,phaseTwoSec:0,restSec:30,stageIndex:0},{workSec:30,phaseTwoSec:20,restSec:0,stageIndex:1}],intervalMode:'standard'};

test('plain program work keeps its empty phase label while running and shows the pause',()=>{
 assert.equal(phaseLabelFor({phase:'work',roundIndex:1,config:program}),'');
 assert.equal(phaseLabelFor({phase:'work',roundIndex:1,isPaused:true,config:program}),'Пауза · Программа');
 assert.equal(phaseLabelFor({phase:'rest',roundIndex:1,isPaused:true,config:program}),'Пауза · Программа');
 assert.equal(phaseLabelFor({phase:'work',roundIndex:2,config:program}),'Работа · Программа');
});

test('the standalone timer labels are unchanged',()=>{
 const standalone={rounds:3,workSec:60,restSec:30,intervalMode:'standard',presetId:'classic1'};
 assert.equal(phaseLabelFor({phase:'work',roundIndex:1,config:standalone}),'Работа · Обычный');
 assert.equal(phaseLabelFor({phase:'work',roundIndex:1,isPaused:true,config:standalone}),'Пауза · Обычный');
 assert.equal(phaseLabelFor({phase:'finished',roundIndex:3,config:standalone}),'Готово');
});
