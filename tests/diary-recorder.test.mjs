import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRecorder,roundsDoneFrom,applyRun,recordMode,RUN_KEY,RECORD_KEY} from '../app/js/diary/recorder.js';
import {openDiary,newSession,localDate} from '../app/js/diary/store.js';

const memoryStorage=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),map:m};};
const snap=(name,rounds=3)=>({name,entries:[{presetId:'classic3',title:'',settings:{rounds,workSec:180,restSec:60}}],options:{cycles:1,cycleRestSec:60}});
const clock=start=>{let t=start;return {now:()=>t,go:ms=>{t+=ms;}};};
const S=(phase,roundIndex)=>({phase,roundIndex});
// Drives a recorder like the timer does: each call is one state change after ms of wall time.
function drive(rec,c,steps){for(const [ms,phase,round,paused=false] of steps){c.go(ms);rec.observe(S(phase,round),paused);}}

test('rounds count only after their work ends', () => {
  assert.equal(roundsDoneFrom(S('countdown',1)),0);
  assert.equal(roundsDoneFrom(S('work',1)),0);
  assert.equal(roundsDoneFrom(S('rest',1)),1);
  assert.equal(roundsDoneFrom(S('work',3)),2);
  assert.equal(roundsDoneFrom(S('block_rest',4)),4);
  assert.equal(roundsDoneFrom(S('finished',6)),6);
  assert.equal(roundsDoneFrom(S('idle',0)),0);
});

test('completed run: done, every round, time without countdown and pauses', () => {
  const st=memoryStorage(),c=clock(new Date(2026,10,15,10,0).getTime()),rec=createRecorder({storage:st,now:c.now});
  rec.begin({snap:snap('A',2),roundsTotal:2,origin:'program'});
  drive(rec,c,[[0,'countdown',1],[4000,'work',1],[60000,'work',1,true],[30000,'work',1,false],[120000,'rest',1],[60000,'work',2],[180000,'finished',2]]);
  const run=rec.finish(true);
  assert.equal(run.status,'done');
  assert.equal(run.roundsDone,2);
  assert.equal(run.activeMs,(60+120+60+180)*1000,'countdown 4 s and the 30 s paused are not counted');
  assert.equal(run.date,'2026-11-15');
});

test('stopped early: partial with only the rounds really finished', () => {
  const st=memoryStorage(),c=clock(Date.now()),rec=createRecorder({storage:st,now:c.now});
  rec.begin({snap:snap('A',8),roundsTotal:8,origin:'program'});
  drive(rec,c,[[0,'work',1],[180000,'rest',1],[60000,'work',2],[90000,'work',2]]);
  const run=rec.finish(false);
  assert.equal(run.status,'partial');
  assert.equal(run.roundsDone,1,'round 2 was interrupted, so it is not counted');
  assert.equal(run.activeMs,330000);
});

test('reset during the countdown or right away records nothing', () => {
  const st=memoryStorage(),c=clock(Date.now()),rec=createRecorder({storage:st,now:c.now});
  rec.begin({snap:snap('A'),roundsTotal:3,origin:'timer'});
  drive(rec,c,[[0,'countdown',1],[3000,'countdown',1]]);
  assert.equal(rec.finish(false),null);
  assert.equal(st.getItem(RUN_KEY),null);
});

test('pause alone records nothing; pause then resume keeps one run', () => {
  const st=memoryStorage(),c=clock(Date.now()),rec=createRecorder({storage:st,now:c.now});
  rec.begin({snap:snap('A'),roundsTotal:3,origin:'timer'});
  const id=rec.active.runId;
  drive(rec,c,[[0,'work',1],[20000,'work',1,true],[600000,'work',1,true],[0,'work',1,false],[10000,'rest',1]]);
  assert.equal(rec.active.runId,id,'still the same run');
  assert.equal(rec.leftover(),null,'an active run is not a leftover');
  assert.equal(rec.active.activeMs,30000);
});

test('crash or kill: the run left behind keeps its last real progress and is offered once', () => {
  const st=memoryStorage(),c=clock(Date.now());
  const rec=createRecorder({storage:st,now:c.now});
  rec.begin({snap:snap('A',6),roundsTotal:6,sessionId:'d1',origin:'program'});
  drive(rec,c,[[0,'work',1],[180000,'rest',1],[60000,'work',2],[100000,'work',2,true]]);
  // process killed here; a new app start:
  const next=createRecorder({storage:st,now:c.now});
  const left=next.leftover();
  assert.equal(left.status,'partial');
  assert.equal(left.roundsDone,1);
  assert.equal(left.sessionId,'d1');
  next.settle(left.runId);
  assert.equal(next.leftover(),null,'settled runs are never offered again');
  // killed before any real work: nothing to offer
  const r2=createRecorder({storage:st,now:c.now});r2.begin({snap:snap('B'),roundsTotal:3,origin:'timer'});r2.observe(S('countdown',1),false);
  assert.equal(createRecorder({storage:st,now:c.now}).leftover(),null);
});

test('a finished run not yet saved survives a restart as finished', () => {
  const st=memoryStorage(),c=clock(Date.now()),rec=createRecorder({storage:st,now:c.now});
  rec.begin({snap:snap('A',1),roundsTotal:1,origin:'timer'});
  drive(rec,c,[[0,'work',1],[180000,'finished',1]]);
  const run=rec.finish(true);
  const left=createRecorder({storage:st,now:c.now}).leftover();
  assert.equal(left.runId,run.runId);
  assert.equal(left.status,'done');
});

test('recording is idempotent and anchored to the start date across midnight', () => {
  const draft={sessions:[],snapshots:{}};
  const c=clock(new Date(2026,10,10,23,50).getTime()),rec=createRecorder({storage:memoryStorage(),now:c.now});
  rec.begin({snap:snap('Night',12),roundsTotal:12,origin:'timer'});
  drive(rec,c,[[0,'work',1],[40*60000,'finished',12]]);
  const run=rec.finish(true);
  assert.equal(localDate(new Date(run.endedAt)),'2026-11-11');
  applyRun(draft,run);
  assert.equal(applyRun(draft,run),false,'second save of the same run is refused');
  assert.equal(draft.sessions.length,1);
  assert.equal(draft.sessions[0].date,'2026-11-10','start date, never split');
  assert.equal(draft.sessions[0].facts.activeSec,2400);
});

test('a run fills its own assignment, else a not-started one of the same program that day, else a new session', () => {
  const draft={sessions:[],snapshots:{}};
  const plan=newSession(draft.snapshots,{date:'2026-11-15',snap:snap('Plan'),programId:'p1',origin:'save'});
  const other=newSession(draft.snapshots,{date:'2026-11-16',snap:snap('Plan'),programId:'p1',origin:'save'});
  draft.sessions.push(plan,other);
  const base={startedAt:1,endedAt:2,roundsDone:3,roundsTotal:3,activeMs:540000,status:'done',date:'2026-11-15'};
  applyRun(draft,{...base,runId:'r1',snap:snap('Plan edited',4),sessionId:null,programId:'p1',origin:'program'});
  assert.equal(draft.sessions.length,2,'filled the planned one');
  assert.equal(plan.status,'done');
  assert.notEqual(plan.execRef,plan.planRef,'edits made before start are the execution snapshot; the plan stays');
  assert.equal(other.status,'planned','another day is not touched');
  applyRun(draft,{...base,runId:'r2',snap:snap('Plan'),sessionId:plan.id,programId:'p1',origin:'program'});
  assert.equal(draft.sessions.length,3,'its assignment is already done: a second session that day');
  applyRun(draft,{...base,runId:'r3',snap:snap('Timer 3′',1),sessionId:null,programId:null,origin:'timer',status:'partial',roundsDone:0});
  const timer=draft.sessions.at(-1);
  assert.equal(timer.origin,'timer');
  assert.equal(timer.programId,null);
  assert.equal(timer.status,'partial');
});

test('history is immutable: editing or deleting the source program changes no recorded session', async () => {
  const files={},back={read:async s=>files[s]??null,write:async(s,t)=>{files[s]=t;}};
  const d=await openDiary(back);
  const program=snap('Source',3);
  await d.commit(x=>applyRun(x,{runId:'r1',date:'2026-11-01',startedAt:1,endedAt:2,roundsDone:3,roundsTotal:3,activeMs:1,status:'done',snap:program,programId:'p1',sessionId:null,origin:'program'}));
  program.name='Renamed';program.entries[0].settings.rounds=9; // the user edits the program afterwards
  const again=await openDiary(back);
  const s=again.sessions[0];
  assert.equal(again.snapshot(s.execRef).name,'Source');
  assert.equal(again.snapshot(s.execRef).entries[0].settings.rounds,3);
});

test('capacity: 3200 recorded runs plus plans stay readable without loss', async () => {
  const files={},back={read:async s=>files[s]??null,write:async(s,t)=>{files[s]=t;}};
  const d=await openDiary(back);
  await d.commit(x=>{for(let i=0;i<3200;i++){const date=localDate(new Date(2018,0,1+i));
    applyRun(x,{runId:'r'+i,date,startedAt:i,endedAt:i+1,roundsDone:i%7,roundsTotal:6+i%30,activeMs:600000,status:i%5?'done':'partial',snap:snap('P'+(i%60),2+i%30),programId:'p'+(i%60),sessionId:null,origin:'program'});}});
  const again=await openDiary(back);
  assert.equal(again.sessions.length,3200);
  assert.equal(again.sessions[0].date,'2018-01-01');
  const bytes=Math.max(...Object.values(files).map(t=>t.length));
  assert.ok(bytes<2e6,'bytes: '+bytes);
});

test('gear setting: ask unless set to automatic; app wiring', () => {
  const st=memoryStorage();
  assert.equal(recordMode(st),'ask');
  st.setItem(RECORD_KEY,JSON.stringify('auto'));
  assert.equal(recordMode(st),'auto');
  const app=readFileSync(new URL('../app/js/app.js',import.meta.url),'utf8');
  const html=readFileSync(new URL('../app/index.html',import.meta.url),'utf8');
  assert.match(html,/data-diary-record="auto">Автоматически<\/button>\s*<button[^>]*data-diary-record="ask">Спрашивать/);
  // start, natural end, reset and exit are the only places a run begins or ends; pause is not one of them.
  assert.equal(app.match(/beginRun\(/g).length,3);
  assert.ok(app.includes("if (state.phase === 'finished' && recorder.active) endRun(true);"));
  assert.ok(app.includes('function handleReset() {\n  if (recorder.active) endRun(false);'));
  assert.ok(app.includes('function exitProgram() {\n  if (recorder.active) endRun(false);'));
  const pauseBranch=app.slice(app.indexOf('async function handleToggleRun()'),app.indexOf('await audioReady;'));
  assert.ok(!/endRun|beginRun/.test(pauseBranch),'pause and continue never record');
});
