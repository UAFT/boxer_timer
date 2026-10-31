import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {openDiary,newSession,putSnapshot,dayStatus,dayDots,monthCells,localDate,dropUnused} from '../app/js/diary/store.js';
import {assignLabel,diaryText} from '../app/js/diary/calendar-view.js';

const TODAY='2026-11-15';
const s=(date,status,id=date+status+Math.random())=>({id,date,status});

test('day status: empty, planned, done, partial, missed; canceled ignored', () => {
  assert.equal(dayStatus([],TODAY,TODAY),'empty');
  assert.equal(dayStatus([s('2026-11-20','planned'),s('2026-11-20','planned')],'2026-11-20',TODAY),'planned');
  assert.equal(dayStatus([s(TODAY,'planned')],TODAY,TODAY),'planned','today is not missed yet');
  assert.equal(dayStatus([s('2026-11-10','planned')],'2026-11-10',TODAY),'missed');
  assert.equal(dayStatus([s('2026-11-10','done'),s('2026-11-10','done')],'2026-11-10',TODAY),'done');
  assert.equal(dayStatus([s('2026-11-10','partial')],'2026-11-10',TODAY),'partial');
  assert.equal(dayStatus([s('2026-11-10','in_progress')],'2026-11-10',TODAY),'partial');
  assert.equal(dayStatus([s('2026-11-13','done'),s('2026-11-13','partial')],'2026-11-13',TODAY),'partial');
  assert.equal(dayStatus([s('2026-11-10','done'),s('2026-11-10','planned')],'2026-11-10',TODAY),'partial','done + missed');
  assert.equal(dayStatus([s('2026-11-10','canceled')],'2026-11-10',TODAY),'empty');
  assert.equal(dayStatus([s('2026-11-10','done'),s('2026-11-10','canceled')],'2026-11-10',TODAY),'done');
  assert.equal(dayStatus([s('2026-11-11','done')],'2026-11-10',TODAY),'empty','other dates do not leak');
});

test('dots: none for one workout, none for planned ahead, green done, gray not completed', () => {
  assert.deepEqual(dayDots([s('2026-11-10','partial')],'2026-11-10',TODAY),[]);
  assert.deepEqual(dayDots([s('2026-11-13','done'),s('2026-11-13','partial')],'2026-11-13',TODAY),['done','open']);
  assert.deepEqual(dayDots([s('2026-11-10','done'),s('2026-11-10','planned')],'2026-11-10',TODAY),['done','open'],'missed is gray, same as partial');
  assert.deepEqual(dayDots([s('2026-11-20','planned'),s('2026-11-20','planned')],'2026-11-20',TODAY),[]);
  assert.deepEqual(dayDots([s(TODAY,'done'),s(TODAY,'planned')],TODAY,TODAY),['done']);
});

test('month grid is Monday-first with local dates', () => {
  const nov=monthCells(2026,10); // 1 Nov 2026 is a Sunday
  assert.equal(nov.indexOf('2026-11-01'),6);
  assert.equal(nov.filter(Boolean).length,30);
  assert.equal(monthCells(2026,5).indexOf('2026-06-01'),0); // Monday
  assert.equal(monthCells(2028,1).filter(Boolean).at(-1),'2028-02-29');
  assert.equal(localDate(new Date(2026,10,1,23,59)),'2026-11-01','local date, not UTC');
});

const memory=(init={})=>{const files={...init},writes=[];return {files,writes,
  read:async slot=>files[slot]??null,write:async(slot,text)=>{writes.push(slot);files[slot]=text;}};};
const snap=(name,rounds=3)=>({name,entries:[{presetId:'classic3',title:'',settings:{rounds,workSec:180,restSec:60}}],options:{cycles:1,cycleRestSec:60}});

test('diary writes the two slots in turn; a spoiled newest slot falls back to the last good one', async () => {
  const back=memory();
  const d=await openDiary(back);
  assert.equal(d.state,'ok');
  assert.equal(await d.commit(x=>{x.sessions.push(newSession(x.snapshots,{date:TODAY,snap:snap('A'),origin:'test'}));}),true);
  assert.equal(await d.commit(x=>{x.sessions.push(newSession(x.snapshots,{date:TODAY,snap:snap('B'),origin:'test'}));}),true);
  assert.deepEqual(back.writes,['a','b']);
  assert.equal(JSON.parse(back.files.b).seq,2);
  back.files.b=back.files.b.slice(0,40); // crash in the middle of writing slot b
  const again=await openDiary(back);
  assert.equal(again.state,'ok');
  assert.deepEqual(again.sessions.map(s=>again.snapshot(s.planRef).name),['A'],'last good copy');
  await again.commit(x=>{x.sessions[0].date='2026-11-16';});
  assert.equal(back.writes.at(-1),'b','next write never touches the good slot');
  assert.equal((await openDiary(back)).sessions[0].date,'2026-11-16');
});

test('newer schema and unreadable files are never written', async () => {
  const newer=memory({a:JSON.stringify({schema:2,seq:9,sessions:[]})});
  const d=await openDiary(newer);
  assert.equal(d.state,'newer');
  assert.equal(await d.commit(()=>{}),false);
  const broken=memory({a:'{broken',b:'nope'});
  const e=await openDiary(broken);
  assert.equal(e.state,'damaged');
  assert.equal(await e.commit(()=>{}),false);
  assert.deepEqual([...newer.writes,...broken.writes],[]);
  assert.equal(broken.files.a,'{broken','left exactly as it was');
  const failing={read:async()=>{throw new Error('EACCES');},write:async()=>{throw new Error('must not write');}};
  assert.equal((await openDiary(failing)).state,'damaged','a read error is not taken for an empty diary');
});

test('a failed write leaves the diary as it was', async () => {
  let fail=false;
  const back=memory(),real=back.write;back.write=async(...a)=>{if(fail)throw new Error('disk full');return real(...a);};
  const d=await openDiary(back);
  await d.commit(x=>{x.sessions.push(newSession(x.snapshots,{date:TODAY,snap:snap('A'),origin:'test'}));});
  fail=true;
  assert.equal(await d.commit(x=>{x.sessions.length=0;}),false);
  assert.equal(d.sessions.length,1);
});

test('snapshots are stored once by content; sessions keep their own ids and dates', () => {
  const snapshots={};
  const a=newSession(snapshots,{date:'2026-11-01',snap:snap('A'),programId:'p1',origin:'test'});
  const b=newSession(snapshots,{date:'2026-11-08',snap:snap('A'),programId:'p1',origin:'test'});
  const c=newSession(snapshots,{date:'2026-11-08',snap:snap('A',4),programId:'p1',origin:'test'});
  assert.equal(a.planRef,b.planRef);
  assert.notEqual(a.planRef,c.planRef);
  assert.notEqual(a.id,b.id);
  assert.equal(Object.keys(snapshots).length,2);
  assert.equal(putSnapshot(snapshots,snap('A')),a.planRef);
});

test('assign button counts dates in Russian and English', () => {
  assert.equal(assignLabel(1,'ru'),'Назначить на 1 дату');
  assert.equal(assignLabel(3,'ru'),'Назначить на 3 даты');
  assert.equal(assignLabel(5,'ru'),'Назначить на 5 дат');
  assert.equal(assignLabel(21,'ru',true),'Сохранить и назначить на 21 дату');
  assert.equal(assignLabel(2,'en'),'Assign to 2 dates');
});

test('Play tab row: Мои | Библиотека | Дневник | import; Tree and Methodology stay hidden', () => {
  const html=readFileSync(new URL('../app/index.html',import.meta.url),'utf8');
  const nav=html.match(/<div class="program-library-tabs ft-library-nav">([\s\S]*?)<\/div>/)[1];
  const ids=[...nav.matchAll(/<button[^>]*id="([^"]+)"([^>]*)>/g)].map(m=>[m[1],/\shidden\b/.test(m[2])]);
  assert.deepEqual(ids,[['programLibraryMine',false],['programLibraryTemplates',false],['ftTreePreviewTab',true],['ftMethodV42Tab',true],['programLibraryDiary',false],['ftWorkoutImportBtn',false]]);
  assert.match(html,/styles\/methodology-v42\.css" \/>\s*<link rel="stylesheet" href=".\/styles\/diary\.css"/);
});

test('capacity: 3500 records over ten years stay readable and nothing is dropped', async () => {
  const back=memory(),d=await openDiary(back);
  const programs=Array.from({length:40},(_,i)=>snap('P'+i,2+i%9));
  await d.commit(x=>{for(let i=0;i<3500;i++){const day=new Date(2017,0,1+Math.floor(i*3650/3500));
    x.sessions.push(newSession(x.snapshots,{date:localDate(day),snap:programs[i%40],programId:'p'+(i%40),origin:'test'}));}});
  const again=await openDiary(back);
  assert.equal(again.sessions.length,3500);
  assert.equal(again.sessions[0].date,'2017-01-01','oldest record still there');
  assert.equal(Object.keys(JSON.parse(back.files.a).snapshots).length,40,'repeats share snapshots');
  assert.ok(back.files.a.length<1.2e6,'about 300 bytes per record: '+back.files.a.length);
});

test('commit: true when written, null when there was nothing to change, false on failure', async () => {
  const files={},back={read:async s=>files[s]??null,write:async(s,t)=>{files[s]=t;}};
  const d=await openDiary(back);
  assert.equal(await d.commit(()=>false),null);
  assert.deepEqual(files,{},'nothing written');
  assert.equal(await d.commit(x=>{x.sessions.push(newSession(x.snapshots,{date:'2026-11-15',snap:{name:'A',entries:[],options:{}},origin:'test'}));}),true);
  back.write=async()=>{throw new Error('disk');};
  assert.equal(await d.commit(x=>{x.sessions.length=0;}),false);
  assert.equal(d.sessions.length,1);
});

test('dropUnused removes only snapshots no session (canceled included) points at', () => {
  const draft={sessions:[],snapshots:{}};
  const a=newSession(draft.snapshots,{date:'2026-11-15',snap:{name:'A'},origin:'t'});
  const c=newSession(draft.snapshots,{date:'2026-11-16',snap:{name:'C'},origin:'t'});c.status='canceled';
  const done=newSession(draft.snapshots,{date:'2026-11-17',snap:{name:'P'},origin:'t'});done.execRef=putSnapshot(draft.snapshots,{name:'E'});
  putSnapshot(draft.snapshots,{name:'orphan'});
  draft.sessions.push(a,c,done);
  dropUnused(draft);
  assert.deepEqual(Object.values(draft.snapshots).map(x=>x.name).sort(),['A','C','E','P']);
});

test('STAGE 3.1 UI ships RU and EN together and uses no native selects in the diary or «Сохранить»', () => {
  const view=readFileSync(new URL('../app/js/diary/calendar-view.js',import.meta.url),'utf8');
  const html=readFileSync(new URL('../app/index.html',import.meta.url),'utf8');
  assert.ok(!/createElement\('select'\)|'select', 'ft-diary-select'/.test(view));
  assert.ok(!/<select id="programSaveDest"/.test(html));
  const shape=o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k,v&&typeof v==='object'&&!Array.isArray(v)?shape(v):typeof v]));
  assert.deepEqual(shape(diaryText('en')),shape(diaryText('ru')),'every Russian diary string has an English one');
  const strings=o=>Object.values(o).flatMap(v=>typeof v==='function'?[String(v(1,2))]:Array.isArray(v)?v.flat():v&&typeof v==='object'?strings(v):[v]);
  assert.deepEqual(strings(diaryText('en')).filter(x=>/[А-Яа-яЁё]/.test(x)),[],'English texts are English');
});
