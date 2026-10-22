import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {adjustStageField,stageFieldIncrement} from '../app/js/ui/stage-time-stepper.js';

function inputs(initial){
 const map=new Map(Object.entries(initial).map(([key,value])=>[key,{value:String(value)}]));
 return key=>{assert.ok(map.has(key),'known input '+key);return map.get(key);};
}

test('stage editor advances seconds by 5, borrowing/carrying across minutes',()=>{
 for(const prefix of ['Work','Rest','PhaseTwo']){
  const get=inputs({[prefix+'Min']:0,[prefix+'Sec']:55});
  assert.equal(stageFieldIncrement(prefix+'Sec'),5);
  assert.equal(stageFieldIncrement(prefix+'Min'),60);
  assert.equal(adjustStageField(get,prefix+'Sec',1),60);
  assert.equal(get(prefix+'Min').value,'1');
  assert.equal(get(prefix+'Sec').value,'0');
  assert.equal(adjustStageField(get,prefix+'Sec',-1),55);
  assert.equal(get(prefix+'Min').value,'0');
  assert.equal(get(prefix+'Sec').value,'55');
 }
});

test('minute buttons remain one-minute steps, rounds remain one, no invalid negative time',()=>{
 const get=inputs({WorkMin:1,WorkSec:10,RestMin:0,RestSec:0,PhaseTwoMin:0,PhaseTwoSec:5,Rounds:2});
 assert.equal(adjustStageField(get,'WorkMin',1),130);
 assert.equal(get('WorkMin').value,'2');
 assert.equal(get('WorkSec').value,'10');
 assert.equal(adjustStageField(get,'WorkMin',-1),70);
 assert.equal(adjustStageField(get,'RestSec',-1),0);
 assert.equal(adjustStageField(get,'PhaseTwoSec',-1),5,'phase two >=5s');
 assert.equal(adjustStageField(get,'Rounds',-1),1);
 assert.equal(adjustStageField(get,'Rounds',-1),1);
 assert.equal(adjustStageField(get,'Rounds',1),2);
});

test('short and long taps use the same function; preserve 1s values from imported/manual programs',()=>{
 const app=readFileSync(new URL('../app/js/app.js',import.meta.url),'utf8');
 const control=readFileSync(new URL('../app/js/ui/stage-time-stepper.js',import.meta.url),'utf8');
 assert.match(app,/installStageTimeSteppers\(\{lookup:id\}\)/);
 assert.match(control,/pointerup[\s\S]*?adjustStageField\(lookup,key,sign\)/);
 assert.match(control,/setTimeout\([\s\S]*?adjustStageField\(lookup,key,sign\)/);
 const get=inputs({RestMin:0,RestSec:11});
 assert.equal(adjustStageField(get,'RestSec',1),16);
 assert.equal(adjustStageField(get,'RestSec',-1),11);
});

test('editor stage header and name are stacked in FIRST grid column alongside action buttons',()=>{
 const css=readFileSync(new URL('../app/styles/fight-tech-ui-kit.css',import.meta.url),'utf8');
 const selector='.program-panel .program-stage-card>.program-stage>.program-stage-main{';
 const index=css.lastIndexOf(selector);
 assert.ok(index>0);
 const block=css.slice(index,css.indexOf('}',index));
 assert.match(block,/display:block!important/);
 assert.match(block,/grid-column:1/);
 assert.match(block,/grid-row:1/);
 const title=css.slice(css.lastIndexOf('.program-stage-card>.program-stage>.program-stage-main>.program-stage-title-stack{'));
 assert.match(title,/display:flex!important/);
 assert.match(title,/flex-direction:column/);
 assert.doesNotMatch(css.slice(index),/\.program-stage-number\s*\{[^}]*grid-row:2/);
 const html=readFileSync(new URL('../app/index.html',import.meta.url),'utf8');
 for(const field of ['WorkSec','RestSec','PhaseTwoSec']){
  assert.match(html,new RegExp('id="stageSettings'+field+'"[^>]*step="5"'));
 }
});
