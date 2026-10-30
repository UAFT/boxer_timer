import test from 'node:test';
import assert from 'node:assert/strict';
import {announceRound,announcedRound,stopVoice} from '../app/js/audio/voice-coach.js';
import {compileProgram} from '../app/js/core/program.js';
import {clonePreset} from '../app/js/state/presets.js';

// Audit R2 VC-1: the phrase templates had lost their placeholders when the module was
// written: "Раунд . . Работа!" with a constant de-duplication key, so one phrase per
// workout was spoken. Each round is announced with its number and exercise.
function speech(t){
 t.mock.timers.enable({apis:['setTimeout']});
 const spoken=[];
 globalThis.speechSynthesis={cancel(){},speak(u){spoken.push([u.text,u.lang]);}};
 globalThis.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
 t.after(()=>{delete globalThis.speechSynthesis;delete globalThis.SpeechSynthesisUtterance;stopVoice();});
 return spoken;
}
const profiles=Object.fromEntries(['classic3','classic2','classic1','tabata2020x24'].map(id=>[id,clonePreset(id)]));
const rounds=compileProgram([{presetId:'classic1',title:'Бокс',restAfterSec:0,roundNames:['Джеб','Кросс'],
 settings:{...clonePreset('classic1'),rounds:3,workSec:60,restSec:30}}],profiles,{cycles:1});

test('each round start names its number and exercise; the rest is announced',t=>{
 const spoken=speech(t);
 for(const event of [{type:'round-start-zero',roundIndex:1},{type:'round-end-zero',roundIndex:1},{type:'rest-end-zero',roundIndex:1},
  {type:'round-end-zero',roundIndex:2},{type:'rest-end-zero',roundIndex:2}]){
  announceRound(event.type,announcedRound(event,rounds),'ru');t.mock.timers.tick(650);
 }
 assert.deepEqual(spoken.map(x=>x[0]),['Раунд 1. Джеб. Работа!','Отдых','Раунд 2. Кросс. Работа!','Отдых','Раунд 3. Бокс. Работа!']);
 assert.equal(spoken[0][1],'ru-RU');
});

test('the same cue is not repeated, a newer phrase replaces a pending one, English works',t=>{
 const spoken=speech(t);
 announceRound('round-start-zero',rounds[0],'en');announceRound('round-start-zero',rounds[0],'en');
 t.mock.timers.tick(650);
 assert.deepEqual(spoken,[['Round 1. Jab. Go!','en-US']]);   // Play MVP: library names are spoken in English too
 announceRound('round-end-zero',rounds[0],'ru');announceRound('rest-end-zero',rounds[1],'ru');
 t.mock.timers.tick(650);
 assert.deepEqual(spoken.slice(1).map(x=>x[0]),['Раунд 2. Кросс. Работа!']);
});

test('the round after a rest or a block rest is the next one, not the one that ended',()=>{
 assert.equal(announcedRound({type:'round-start-zero',roundIndex:1},rounds).stageRound,1);
 assert.equal(announcedRound({type:'rest-end-zero',roundIndex:1},rounds).stageRound,2);
 assert.equal(announcedRound({type:'block-rest-end-zero',roundIndex:2},rounds).stageRound,3);
 assert.equal(announcedRound({type:'round-end-zero',roundIndex:2},rounds).stageRound,2);
});
