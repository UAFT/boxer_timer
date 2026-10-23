import test from 'node:test';
import assert from 'node:assert/strict';
import {TimerEngine} from '../app/js/timer/timer-engine.js';
import {AudioEngine} from '../app/js/audio/audio-engine.js';
import {PHASES} from '../app/js/core/constants.js';
import {clonePreset} from '../app/js/state/presets.js';
import {normalizeSettings} from '../app/js/state/settings-store.js';

// On a device the AudioContext can stay suspended (e.g. after the app was in the
// background) and resume() may never settle. Sound is best effort; the clock and
// the buttons must keep working.
const flush=async()=>{for(let i=0;i<6;i++)await new Promise(resolve=>setImmediate(resolve));};
function clockFixture(){
 const originalWindow=globalThis.window,originalNow=Date.now;
 let now=100000;const timeouts=new Map();let id=0;
 globalThis.window={setInterval:()=>++id,clearInterval:()=>{},
  setTimeout:(fn,ms)=>{timeouts.set(++id,{fn,at:now+ms});return id;},clearTimeout:x=>timeouts.delete(x)};
 Date.now=()=>now;
 return {advance(ms){now+=ms;for(const [key,t] of [...timeouts])if(t.at<=now){timeouts.delete(key);t.fn();}},
  teardown(){globalThis.window=originalWindow;Date.now=originalNow;}};
}
const config=over=>({...normalizeSettings(clonePreset('classic1'),clonePreset('classic1')),warningSeconds:0,...over});

test('a cue that never finishes delays the phase change by at most 300 ms',async()=>{
 const clock=clockFixture();
 try{
  const engine=new TimerEngine({onEvent:event=>event.type==='round-start-zero'?new Promise(()=>{}):undefined});
  engine.applyConfig(config({rounds:2,workSec:10,restSec:5}));
  engine.start();clock.advance(4000);engine.handleIntervalTick();await flush();
  assert.equal(engine.state.phase,PHASES.COUNTDOWN);
  clock.advance(299);await flush();
  assert.equal(engine.state.phase,PHASES.COUNTDOWN);
  clock.advance(1);await flush();
  assert.equal(engine.state.phase,PHASES.WORK);
  assert.equal(engine.state.remainingSec,10);
 }finally{clock.teardown();}
});

test('Reset during a stuck cue still wins, and a failing cue does not stop the clock',async()=>{
 const clock=clockFixture();
 try{
  const stuck=new TimerEngine({onEvent:event=>event.type==='round-start-zero'?new Promise(()=>{}):undefined});
  stuck.applyConfig(config({rounds:1,workSec:10,restSec:0}));
  stuck.start();clock.advance(4000);stuck.handleIntervalTick();await flush();
  stuck.reset();clock.advance(300);await flush();
  assert.equal(stuck.state.phase,PHASES.IDLE);
  const failing=new TimerEngine({onEvent:event=>event.type==='round-start-zero'?Promise.reject(new Error('audio')):undefined});
  failing.applyConfig(config({rounds:1,workSec:10,restSec:0}));
  failing.start();clock.advance(4000);failing.handleIntervalTick();await flush();
  assert.equal(failing.state.phase,PHASES.WORK);
 }finally{clock.teardown();}
});

test('a stuck end-of-workout bell does not leave the engine mid-transition',async()=>{
 const clock=clockFixture();
 try{
  const engine=new TimerEngine({onEvent:event=>event.type==='workout-end-zero'?new Promise(()=>{}):undefined});
  engine.applyConfig(config({rounds:1,workSec:2,restSec:0}));
  engine.start();clock.advance(4000);engine.handleIntervalTick();await flush();
  clock.advance(2000);engine.handleIntervalTick();await flush();
  assert.equal(engine.state.phase,PHASES.FINISHED);
  assert.equal(engine.transitioning,true);
  clock.advance(300);await flush();
  assert.equal(engine.transitioning,false);
 }finally{clock.teardown();}
});

class FakeContext{
 constructor(){this.state=FakeContext.initialState;this.destination={};this.sampleRate=44100;this.started=0;FakeContext.created+=1;}
 resume(){return FakeContext.resume(this);}
 createGain(){return {gain:{value:1},connect(){},disconnect(){}};}
 createBuffer(){return {};}
 createBufferSource(){const ctx=this;return {connect(){},disconnect(){},start(){ctx.started+=1;},stop(){}};}
 decodeAudioData(){return FakeContext.decode();}
}
function audioFixture(t,{state='running',resume=()=>new Promise(()=>{}),decode=async()=>({duration:1})}={}){
 t.mock.timers.enable({apis:['setTimeout','Date'],now:500000});
 const originalWindow=globalThis.window,originalFetch=globalThis.fetch;
 Object.assign(FakeContext,{initialState:state,resume,decode,created:0});
 globalThis.window={AudioContext:FakeContext};
 globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)});
 t.after(()=>{globalThis.window=originalWindow;globalThis.fetch=originalFetch;});
 return new AudioEngine();
}

test('Start waits at most 0.8 s + 1.5 s for a stuck output, and a stuck cue is skipped, not played late',async t=>{
 const audio=audioFixture(t,{state:'suspended'});
 let unlocked=false;audio.unlock().then(()=>{unlocked=true;});
 await flush();t.mock.timers.tick(799);await flush();
 assert.equal(unlocked,false);
 t.mock.timers.tick(1);await flush();
 assert.equal(unlocked,true);
 let played=null;audio.play('cue_warning_tick').then(value=>{played=value;});
 await flush();t.mock.timers.tick(800);await flush();
 assert.equal(played,false);
 assert.equal(audio.context.started,1); // only the silent unlock buffer, never the cue
});

test('a healthy output plays at once; a cue whose sound takes over 1 s to load is dropped',async t=>{
 const audio=audioFixture(t,{decode:()=>new Promise(resolve=>setTimeout(()=>resolve({duration:1}),1200))});
 let slow=null;audio.play('cue_round_start_v2').then(value=>{slow=value;});
 await flush();t.mock.timers.tick(1000);await flush();
 assert.equal(slow,false);
 t.mock.timers.tick(200);await flush();
 let fast=null;audio.play('cue_round_start_v2').then(value=>{fast=value;});
 await flush();
 assert.equal(fast,true);
 assert.equal(audio.context.started,1);
});

test('a closed AudioContext is replaced instead of silencing the rest of the workout',async t=>{
 const audio=audioFixture(t);
 assert.equal(await audio.play('cue_warning_tick'),true);
 audio.context.state='closed';
 assert.equal(await audio.play('cue_warning_tick'),true);
 assert.equal(FakeContext.created,2);
});
