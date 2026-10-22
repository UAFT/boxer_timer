import test from 'node:test';
import assert from 'node:assert/strict';
import {attachVerticalTimeSwipe,adjustClockSeconds,swipeSteps} from '../app/js/ui/time-swipe.js';
import {adjustStageField} from '../app/js/ui/stage-time-stepper.js';
import {readFileSync} from 'node:fs';
function field() {
 const listeners=new Map();
 const element={
  disabled:false,captured:null,blurred:false,
  classList:{add(){}},
  addEventListener(type,fn){listeners.set(type,fn);},
  setPointerCapture(id){this.captured=id;},
  hasPointerCapture(id){return this.captured===id;},
  releasePointerCapture(id){if(this.captured===id)this.captured=null;},
  blur(){this.blurred=true;},
  emit(type,{id=1,x=10,y=100}={}){
    const event={pointerId:id,button:0,clientX:x,clientY:y,cancelable:true,preventDefault(){this.prevented=true;}};
    listeners.get(type)?.(event);
    return event;
  }
 };
 return element;
}
test('swipe math: up subtracts, down adds, partial drag makes no change',()=>{
 assert.equal(swipeSteps(100,80),0);
 assert.equal(swipeSteps(100,78),-1);
 assert.equal(swipeSteps(100,144),2);
 assert.equal(adjustClockSeconds(10,-1),5);
 assert.equal(adjustClockSeconds(10,1),15);
 assert.equal(adjustClockSeconds(0,-1,{min:0}),0);
 assert.equal(adjustClockSeconds(5,-1,{min:5}),5);
 assert.equal(adjustClockSeconds(3598,1),3600);
});
test('vertical drag changes only once per 22px step; sideways drag and tap leave numeric value intact',()=>{
 let seconds=30;
 const input=field();
 attachVerticalTimeSwipe(input,step=>{seconds=adjustClockSeconds(seconds,step);});
 input.emit('pointerdown',{y:100});
 input.emit('pointermove',{y:107});
 input.emit('pointerup',{y:107});
 assert.equal(seconds,30);
 assert.equal(input.blurred,false);
 input.emit('pointerdown',{y:100});
 input.emit('pointermove',{y:123});
 assert.equal(seconds,35);
 input.emit('pointermove',{y:148});
 assert.equal(seconds,40);
 input.emit('pointermove',{y:77});
 assert.equal(seconds,25,'reversing direction subtracts all crossed steps');
 input.emit('pointerup',{y:77});
 assert.equal(input.blurred,true);
 input.emit('pointerdown',{y:100});
 input.emit('pointermove',{x:100,y:103});
 input.emit('pointerup',{x:100,y:103});
 assert.equal(seconds,25,'horizontal swipe should not adjust');
});
test('stage minute/sec chips use five-second swipes, preserve +/- button increments and editing',()=>{
 const js=readFileSync(new URL('../app/js/ui/stage-time-stepper.js',import.meta.url),'utf8');
 assert.match(js,/const secondsField=key\.endsWith\('Min'\)\?key\.slice\(0,-3\)\+'Sec':key;/);
 assert.match(js,/attachVerticalTimeSwipe\(input,sign=>adjustStageField\(lookup,secondsField,sign\)\)/);
 const values={WorkMin:{value:'1'},WorkSec:{value:'0'}};
 assert.equal(adjustStageField(key=>values[key],'WorkSec',-1),55);
 assert.equal(values.WorkMin.value,'0');
 assert.equal(values.WorkSec.value,'55');
 const round=readFileSync(new URL('../app/js/ui/round-time-editor.js',import.meta.url),'utf8');
 assert.match(round,/installRoundTimeSwipes/);
});
test('two-phase uses only phase name controls; standard and description retain general field',()=>{
 const app=readFileSync(new URL('../app/js/app.js',import.meta.url),'utf8');
 assert.match(app,/const usePhases=!description && roundConfig\.intervalMode==='two_phase';/);
 assert.match(app,/input\.hidden=usePhases;/);
 assert.match(app,/if\(ctx\.description \|\| roundConfig\.intervalMode!=='two_phase'\)/);
 const css=readFileSync(new URL('../app/styles/fight-tech-ui-kit.css',import.meta.url),'utf8');
 assert.match(css,/#roundEditInput\[hidden\]\{display:none!important\}/);
});
