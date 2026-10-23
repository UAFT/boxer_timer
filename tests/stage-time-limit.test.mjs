import test from 'node:test';
import assert from 'node:assert/strict';
import {stageTwoPhaseSave} from '../app/js/ui/two-phase-editor.js';

// Stage times are capped at 60:00 like everywhere else. Typing 60:59 was accepted;
// the card then showed 60:59 while the timer ran 60:00.
function withFields(values,run){
 const original=globalThis.document;let focused=null;
 const fields=Object.fromEntries(Object.entries(values).map(([id,value])=>[id,{value,focus(){focused=id;}}]));
 globalThis.document={getElementById:id=>fields[id]};
 try{return {result:run(),focused};}finally{globalThis.document=original;}
}
const phaseTwo=(min,sec)=>({stageSettingsPhaseTwoMin:String(min),stageSettingsPhaseTwoSec:String(sec),stageSettingsPhaseOne:'Джеб',stageSettingsPhaseTwo:'Тень'});

test('phase 2 accepts 60:00 and rejects 60:59',()=>{
 const cfg={};
 assert.equal(withFields(phaseTwo(60,0),()=>stageTwoPhaseSave(cfg)).result,true);
 assert.equal(cfg.phaseTwoSec,3600);
 const over=withFields(phaseTwo(60,59),()=>stageTwoPhaseSave({}));
 assert.equal(over.result,false);
 assert.equal(over.focused,'stageSettingsPhaseTwoMin');
});

test('the stage editor applies the same 60:00 ceiling to work and rest',async()=>{
 const {readFileSync}=await import('node:fs');
 const app=readFileSync(new URL('../app/js/app.js',import.meta.url),'utf8');
 assert.ok(app.includes("sec>59||min*60+sec>3600||(key==='Work'&&min*60+sec<5)"));
});
