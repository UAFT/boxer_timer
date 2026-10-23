import test from 'node:test';
import assert from 'node:assert/strict';
import {TimerEngine} from '../app/js/timer/timer-engine.js';
import {PHASES} from '../app/js/core/constants.js';
import {clonePreset} from '../app/js/state/presets.js';
import {normalizeSettings} from '../app/js/state/settings-store.js';

// A phase transition awaits its audio cue. Reset/Pause pressed while the cue is
// pending must win over the transition that was already under way.
function clockFixture(){
 const originalWindow=globalThis.window,originalNow=Date.now;
 let now=100000;const active=new Set();let id=0;
 globalThis.window={setInterval:()=>{id+=1;active.add(id);return id;},clearInterval:x=>active.delete(x)};
 Date.now=()=>now;
 return {advance(ms){now+=ms;},running:()=>active.size>0,
  teardown(){globalThis.window=originalWindow;Date.now=originalNow;}};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const config=over=>({...normalizeSettings(clonePreset('classic1'),clonePreset('classic1')),warningSeconds:0,...over});
function heldCue(type){
 const held={release:null};
 held.onEvent=event=>event.type===type?new Promise(resolve=>{held.release=resolve;}):undefined;
 return held;
}

test('Reset during a pending start cue does not restart the workout',async()=>{
 const clock=clockFixture();
 try{
  const cue=heldCue('round-start-zero');
  const engine=new TimerEngine({onEvent:cue.onEvent});
  engine.applyConfig(config({rounds:2,workSec:10,restSec:5}));
  engine.start();clock.advance(4000);engine.handleIntervalTick();
  assert.equal(engine.transitioning,true);
  engine.reset();
  cue.release();await flush();
  assert.equal(engine.state.phase,PHASES.IDLE);
  assert.equal(clock.running(),false);
  // The next workout is not blocked by the abandoned transition.
  engine.start();clock.advance(4000);engine.handleIntervalTick();await flush();
  assert.equal(engine.state.phase,PHASES.COUNTDOWN);
  cue.release();await flush();
  assert.equal(engine.state.phase,PHASES.WORK);
 }finally{clock.teardown();}
});

test('Pause during a pending rest cue enters the rest paused and keeps it paused',async()=>{
 const clock=clockFixture();
 try{
  const cue=heldCue('round-end-zero');
  const engine=new TimerEngine({onEvent:cue.onEvent});
  engine.applyConfig(config({rounds:2,workSec:10,restSec:5}));
  engine.start();clock.advance(4000);engine.handleIntervalTick();await flush();
  clock.advance(10000);engine.handleIntervalTick();
  engine.pause();
  cue.release();await flush();
  assert.equal(engine.state.phase,PHASES.REST);
  assert.equal(engine.isPaused,true);
  assert.equal(clock.running(),false);
  clock.advance(3000);engine.handleIntervalTick();
  assert.equal(engine.state.remainingSec,5);
  engine.resume();clock.advance(2000);engine.handleIntervalTick();
  assert.equal(engine.state.remainingSec,3);
 }finally{clock.teardown();}
});

test('Pause/resume keeps the exact remaining time, not the displayed whole second',async()=>{
 const clock=clockFixture();
 try{
  const engine=new TimerEngine();
  engine.applyConfig(config({rounds:1,workSec:60,restSec:0}));
  engine.start();clock.advance(4000);engine.handleIntervalTick();await flush();
  const endsAt=engine.tickEndsAt;
  for(let i=0;i<10;i+=1){clock.advance(1010);engine.handleIntervalTick();engine.pause();clock.advance(5000);engine.resume();}
  assert.equal(engine.tickEndsAt,endsAt+10*5000);
 }finally{clock.teardown();}
});

test('Count-up pause/resume keeps the sub-second elapsed part',async()=>{
 const clock=clockFixture();
 try{
  const engine=new TimerEngine();
  engine.applyConfig({...config({}),intervalMode:'count_up',countdownEnabled:false});
  engine.start();
  for(let i=0;i<4;i+=1){clock.advance(1700);engine.handleIntervalTick();engine.pause();clock.advance(9000);engine.resume();}
  engine.handleIntervalTick();
  assert.equal(engine.state.remainingSec,6);
 }finally{clock.teardown();}
});
