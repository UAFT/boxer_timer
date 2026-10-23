import test from 'node:test';
import assert from 'node:assert/strict';
import {TimerEngine} from '../app/js/timer/timer-engine.js';
import {clonePreset} from '../app/js/state/presets.js';
import {normalizeSettings} from '../app/js/state/settings-store.js';

// Drives the engine on a fake clock in 100 ms ticks and records every event with
// its time since Start, so the countdown and warning semantics are pinned exactly.
async function eventsFor(settings){
 const originalWindow=globalThis.window,originalNow=Date.now;
 let now=1000000;
 globalThis.window={setInterval:()=>1,clearInterval:()=>{},setTimeout:()=>1,clearTimeout:()=>{}};
 Date.now=()=>now;
 try{
  const events=[];const start=now;
  const engine=new TimerEngine({onEvent:event=>{events.push([event.type,(now-start)/1000,event.remainingSec??null,event.phase??null]);}});
  engine.applyConfig(normalizeSettings({...clonePreset('classic1'),...settings},clonePreset('classic1')));
  engine.start();
  for(let i=0;i<20000&&engine.state.phase!=='finished';i++){
   now+=100;engine.handleIntervalTick();
   for(let j=0;j<4;j++)await new Promise(resolve=>setImmediate(resolve));
  }
  assert.equal(engine.state.phase,'finished');
  return events;
 }finally{globalThis.window=originalWindow;Date.now=originalNow;}
}
const ticks=(events,phase)=>events.filter(e=>e[0]==='warning-tick'&&e[3]===phase).map(e=>e[2]);

test('the start countdown is 4 s: ticks at 0/1/2/3 s, the first round starts at 4 s',async()=>{
 const events=await eventsFor({rounds:1,workSec:10,restSec:0,warningSeconds:0});
 assert.deepEqual(events.slice(0,5).map(e=>[e[0],e[1]]),[
  ['prestart-count-4',0],['prestart-count-3',1],['prestart-count-2',2],['prestart-count-1',3],['round-start-zero',4]]);
});

test('the "5 сек" warning chip is 4 ticks at 4-3-2-1 s left plus the bell at zero',async()=>{
 const events=await eventsFor({rounds:2,workSec:10,restSec:6,warningSeconds:4});
 assert.deepEqual(ticks(events,'work'),[4,3,2,1,4,3,2,1]);
 assert.deepEqual(ticks(events,'rest'),[4,3,2,1]);
 const end=events.find(e=>e[0]==='round-end-zero');
 const lastTick=events.filter(e=>e[0]==='warning-tick'&&e[3]==='work')[3];
 assert.equal(end[1]-lastTick[1],1);
});

test('the 10 s warning ticks 10..1 and "Нет" plays no ticks',async()=>{
 assert.deepEqual(ticks(await eventsFor({rounds:1,workSec:15,restSec:0,warningSeconds:10}),'work'),[10,9,8,7,6,5,4,3,2,1]);
 assert.equal((await eventsFor({rounds:2,workSec:8,restSec:6,warningSeconds:0})).filter(e=>e[0]==='warning-tick').length,0);
});

test('two phases: the warning sounds before phase 2 and before the rest that follows phase 2',async()=>{
 const events=await eventsFor({rounds:2,workSec:8,phaseTwoSec:7,restSec:6,intervalMode:'two_phase',warningSeconds:4});
 assert.deepEqual(ticks(events,'work'),[4,3,2,1,4,3,2,1]);
 assert.deepEqual(ticks(events,'work_two'),[4,3,2,1,4,3,2,1]);
 const order=events.map(e=>e[0]).filter(t=>t!=='warning-tick');
 assert.deepEqual(order,['prestart-count-4','prestart-count-3','prestart-count-2','prestart-count-1','round-start-zero',
  'phase-two-start-zero','round-end-zero','rest-end-zero','phase-two-start-zero','workout-end-zero']);
});
