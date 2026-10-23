import test from 'node:test';
import assert from 'node:assert/strict';
import {installLoop,mulberry32} from './support/vloop.mjs';
import {expectedPhases} from './support/engine-model.mjs';
import {TimerEngine} from '../app/js/timer/timer-engine.js';
import {compileProgram} from '../app/js/core/program.js';
import {normalizeSettings} from '../app/js/state/settings-store.js';
import {clonePreset} from '../app/js/state/presets.js';

// Release gate from audit R2: random Start/Pause/Continue/Reset/«Завершить этап» presses
// at random moments, with a jittery tick and cues that settle late or never in time
// (suspended audio). After every step: phases follow the plan, a paused clock does not
// move, at most one engine interval runs, Reset stops everything, and each completed
// phase ran for its planned time plus at most tick jitter and the 300 ms cue bound.
function randomConfig(rnd,pick,int){
 const stage=()=>{
  const mode=pick(['standard','ladder','two_phase','count_up']);
  return {presetId:'classic1',title:'',restAfterSec:pick([0,5]),settings:normalizeSettings({rounds:int(1,3),workSec:int(2,8),restSec:pick([0,int(1,5)]),
   phaseTwoSec:int(1,5),intervalMode:mode,ladderEnabled:mode==='two_phase'&&rnd()<.5,blockEnabled:rnd()<.5,blockCount:int(1,2),
   blockRestSec:pick([0,5]),warningSeconds:pick([0,4])},clonePreset('classic1'))};
 };
 if(rnd()<.5)return {...stage().settings,presetId:'classic1'};
 const rows=compileProgram(Array.from({length:int(1,3)},stage),{classic1:clonePreset('classic1')},{cycles:int(1,2),cycleRestSec:pick([0,5])});
 return {...normalizeSettings(clonePreset('classic1'),clonePreset('classic1')),programRounds:rows,intervalMode:'standard',warningSeconds:pick([0,4])};
}

async function fuzzCase(rnd,c,problems){
 const pick=a=>a[Math.floor(rnd()*a.length)],int=(a,b)=>a+Math.floor(rnd()*(b-a+1));
 const cueDelay=pick([0,0,50,300,1200,60000]);
 const loop=installLoop({jitter:()=>int(0,15)});
 const cfg=randomConfig(rnd,pick,int);
 const log=[];let run=null,engine;
 const fail=msg=>{problems.push(`case ${c} (cueDelay ${cueDelay}): ${msg} | ${log.slice(-10).join(' ')}`);throw new Error('stop');};
 try{
  engine=new TimerEngine({
   onStateChange:s=>{
    if(!run||s.phase==='idle')return;
    const last=run.seen.at(-1);
    if(!last||last.phase!==s.phase||last.round!==s.roundIndex)run.seen.push({phase:s.phase,round:s.roundIndex,active:0});
   },
   onEvent:()=>cueDelay?loop.after(cueDelay):undefined
  });
  engine.applyConfig(cfg);
  let lastNow=loop.now,frozen=null;
  // Unpaused time up to a timer firing belongs to the phase that was current before it.
  const account=(time=loop.now)=>{const cur=run?.seen.at(-1);if(cur&&!engine.isPaused)cur.active+=time-lastNow;lastNow=time;};
  loop.beforeFire=account;
  const startRun=()=>{run={exp:expectedPhases(engine.config),seen:[]};engine.start();log.push('start');};
  startRun();
  for(let a=0;a<60&&engine.state.phase!=='finished';a++){
   const until=loop.now+int(100,3500);
   while(loop.now<until){
    if(!await loop.step(until))loop.now=until;
    account();
    if(engine.isPaused&&!engine.transitioning){
     if(frozen===null)frozen=engine.state.remainingSec;
     else if(frozen!==engine.state.remainingSec)fail(`remaining changed while paused ${frozen} -> ${engine.state.remainingSec}`);
     if(loop.engineIntervals.size)fail('interval running while paused');
    }else frozen=null;
    if(loop.engineIntervals.size>1)fail('two engine intervals');
   }
   // A finished count-up stage passes through WORK for its transition; it is not a phase of its own.
   const real=run.seen.filter((p,i)=>!(p.phase==='work'&&run.seen[i-1]?.phase==='count_up'&&run.seen[i-1].round===p.round));
   for(let i=0;i<real.length;i++)if(real[i].phase+'/'+real[i].round!==run.exp[i].phase+'/'+run.exp[i].round)
    fail(`phase #${i} ${real[i].phase}/${real[i].round} not in plan (expected ${run.exp[i].phase}/${run.exp[i].round})`);
   for(let i=0;i+1<real.length;i++){
    const p=real[i],e=run.exp[i];
    if(e.d===null||p.checked)continue;
    const sec=p.active/1000;
    if(sec<e.d-1e-6||sec>e.d+0.25+Math.min(cueDelay,300)/1000+1e-6)fail(`${e.phase}/${e.round} active ${sec.toFixed(3)}s vs planned ${e.d}s`);
    p.checked=true;
   }
   // A UI event is a task: pending microtasks settle before the press.
   await loop.drain();
   const act=pick(['pause','pause','resume','resume','reset','finish','none']);
   log.push(act+'@'+engine.state.phase+(engine.transitioning?'*':'')+(engine.isPaused?'P':''));
   if(act==='pause')engine.pause();
   if(act==='resume')engine.start();
   if(act==='finish'&&engine.state.phase==='count_up')void engine.finishStage();
   if(act==='reset'){
    engine.reset();await loop.drain();
    if(engine.state.phase!=='idle'||loop.engineIntervals.size)fail(`reset did not stop: ${engine.state.phase}`);
    await loop.advanceTo(loop.now+2000);
    if(engine.state.phase!=='idle'||loop.engineIntervals.size)fail(`ghost after reset: ${engine.state.phase}`);
    lastNow=loop.now;frozen=null;startRun();
   }
   if(act==='pause'||act==='resume')lastNow=loop.now;
   await loop.drain();
   if(engine.state.phase==='count_up'&&rnd()<.3&&!engine.isPaused)void engine.finishStage();
  }
 }catch(error){if(error.message!=='stop')problems.push(`case ${c}: ${error.stack}`);}
 finally{engine?.reset();await loop.drain();loop.teardown();}
}

test('random presses with late or stuck cues never break the timer invariants',async()=>{
 const problems=[];let unhandled=0;
 const onUnhandled=()=>{unhandled+=1;};
 process.on('unhandledRejection',onUnhandled);
 try{
  const rnd=mulberry32(7);
  for(let c=0;c<Number(process.env.FT_FUZZ_CASES||150);c++)await fuzzCase(rnd,c,problems);
 }finally{process.off('unhandledRejection',onUnhandled);}
 assert.equal(unhandled,0);
 assert.deepEqual(problems.slice(0,5),[]);
});
