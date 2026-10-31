import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyPresetWithoutInterrupting,applyLiveMetronome,isPlaybackProtected} from '../app/js/ui/playback-guard.js';

const fakeTimer=(phase='idle')=>({
  state:{phase},config:{programRounds:[{workSec:60,restSec:30}],metronomeBpm:20,metronomeMode:'direct',metronomeEnabled:false},
  count:0,applyConfig(next){this.count++;this.config=next;this.state.phase='idle';}
});
test('preset navigation and settings may not reset any running phase',()=>{
 for(const phase of ['countdown','work','work_two','rest','block_rest']){
  const timer=fakeTimer(phase),live=timer.config,stages=live.programRounds;
  assert.equal(isPlaybackProtected(timer),true,phase);
  assert.equal(applyPresetWithoutInterrupting(timer,{rounds:1,workSec:100},{programRunning:false}),false);
  assert.equal(timer.count,0);
  assert.equal(timer.state.phase,phase);
  assert.strictEqual(timer.config,live);
  assert.strictEqual(timer.config.programRounds,stages);
 }
});
test('paused work and an idle-looking saved program remain protected',()=>{
 const running=fakeTimer('work');running.isPaused=true;
 assert.equal(applyPresetWithoutInterrupting(running,{rounds:2}),false);
 const idleProgram=fakeTimer('idle');
 assert.equal(applyPresetWithoutInterrupting(idleProgram,{rounds:2},{programRunning:true}),false);
 assert.equal(idleProgram.count,0);
});
test('a fully stopped ordinary timer can accept a new preset',()=>{
 for(const phase of ['idle','finished']){
  const timer=fakeTimer(phase);
  assert.equal(isPlaybackProtected(timer),false);
  assert.equal(applyPresetWithoutInterrupting(timer,{rounds:2}),true);
  assert.equal(timer.count,1);
  assert.equal(timer.config.rounds,2);
 }
});
test('metronome control during workout changes only metronome properties',()=>{
 const timer=fakeTimer('work');
 const snapshot=timer.config.programRounds;
 applyLiveMetronome(timer,{metronomeEnabled:true,metronomeBpm:72,metronomeMode:'subdivided'});
 assert.equal(timer.config.metronomeEnabled,true);
 assert.equal(timer.config.metronomeBpm,72);
 assert.equal(timer.config.metronomeMode,'subdivided');
 assert.strictEqual(timer.config.programRounds,snapshot);
 assert.equal(timer.count,0);
});
test('navigation actions are guarded while running and stop is explicit',()=>{
 const app=readFileSync(new URL('../app/js/app.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../app/index.html',import.meta.url),'utf8');
 const select=app.slice(app.indexOf('function handleSelectPreset('),app.indexOf('function handleSaveSettings('));
 assert.ok(!select.includes('exitProgram('),'choosing another preset may not exit');
 assert.ok(app.includes('applyPresetWithoutInterrupting(timer,'));
 assert.ok(app.includes('isPlaybackProtected(timer,programRunning)'));
 assert.ok(app.includes('document.getElementById(\'programLibraryOpen\').disabled=false;'));
 assert.ok(app.includes('document.getElementById(\'programStart\').disabled=isPlaybackProtected(timer,programRunning)'));
 assert.ok(app.includes('if (isPlaybackProtected(timer,programRunning)) return false;'),'opening a program never replaces a running workout');
 assert.ok(html.includes('id="programExit" hidden>Остановить программу</button>'));
 assert.ok(!app.includes('window.confirm('));
});
