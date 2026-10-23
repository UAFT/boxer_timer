import test from 'node:test';
import assert from 'node:assert/strict';
import {installScreenWake} from '../app/js/platform/screen-wake.js';
import {playbackState} from '../app/js/ui/playback-guard.js';

// The screen stays on while a workout runs or is briefly paused; the lock is taken
// again after the app returns to the screen, and never left behind after Reset.
function fixture({supported=true}={}){
 const requests=[];const timeouts=new Map();let id=0;const listeners={};
 const doc={visibilityState:'visible',addEventListener:(type,fn)=>{listeners[type]=fn;}};
 const nav=supported?{wakeLock:{request:type=>{
  assert.equal(type,'screen');
  const sentinel={released:false,handlers:[],addEventListener(t,fn){if(t==='release')this.handlers.push(fn);},
   release(){this.released=true;return Promise.resolve();},drop(){this.released=true;this.handlers.forEach(fn=>fn());}};
  requests.push(sentinel);return Promise.resolve(sentinel);
 }}}:{};
 const timers={setTimeout:(fn,ms)=>{timeouts.set(++id,{fn,ms});return id;},clearTimeout:x=>timeouts.delete(x)};
 const wake=installScreenWake({nav,doc,timers});
 return {wake,requests,doc,listeners,timeouts};
}
const flush=async()=>{for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));};

test('the playback state maps timer phases to running, paused and off',()=>{
 assert.equal(playbackState({phase:'idle'}),'off');
 assert.equal(playbackState({phase:'finished'}),'off');
 for(const phase of ['countdown','work','work_two','rest','block_rest','count_up'])assert.equal(playbackState({phase}),'running');
 assert.equal(playbackState({phase:'rest',isPaused:true}),'paused');
});

test('Start takes the lock once, Reset releases it',async()=>{
 const f=fixture();
 f.wake.sync('running');f.wake.sync('running');await flush();
 assert.equal(f.requests.length,1);assert.equal(f.wake.held,true);
 f.wake.sync('off');
 assert.equal(f.wake.held,false);assert.equal(f.requests[0].released,true);
});

test('a pause keeps the screen on for 10 minutes, then lets it sleep; Continue takes it again',async()=>{
 const f=fixture();
 f.wake.sync('running');await flush();
 f.wake.sync('paused');
 assert.equal(f.wake.held,true);
 const [timeout]=[...f.timeouts.values()];
 assert.equal(timeout.ms,600000);
 timeout.fn();
 assert.equal(f.wake.held,false);
 f.wake.sync('running');await flush();
 assert.equal(f.requests.length,2);assert.equal(f.wake.held,true);
 assert.equal(f.timeouts.size,0);
});

test('the system drops the lock when the app is hidden; it is taken again on return',async()=>{
 const f=fixture();
 f.wake.sync('running');await flush();
 f.doc.visibilityState='hidden';f.requests[0].drop();
 assert.equal(f.wake.held,false);
 f.doc.visibilityState='visible';f.listeners.visibilitychange();await flush();
 assert.equal(f.requests.length,2);assert.equal(f.wake.held,true);
 // After the workout, returning to the app takes nothing.
 f.wake.sync('off');f.listeners.visibilitychange();await flush();
 assert.equal(f.requests.length,2);
});

test('Reset before the lock arrives releases it as soon as it does; no API means no error',async()=>{
 const f=fixture();
 f.wake.sync('running');f.wake.sync('off');await flush();
 assert.equal(f.requests[0].released,true);assert.equal(f.wake.held,false);
 const none=fixture({supported:false});
 none.wake.sync('running');await flush();
 assert.equal(none.wake.held,false);
});
