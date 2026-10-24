import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {LIBRARY, CATEGORIES} from '../app/js/library/catalog.js';
import {BOXING_LIBRARY, SHARED_SHADOW_BAG_IDS} from '../app/js/library/boxing-149.js';
import {stageForWorkout} from '../app/js/library/native-adapter.js';
import {libraryLevel, libraryUp, libraryOpen, UNFILED} from '../app/js/library/library-browser.js';
import {compileProgram, normalizeProgram} from '../app/js/core/program.js';
import {parseWorkoutFile, serializeWorkoutFile} from '../app/js/sharing/workout-file.js';
import {PRESETS} from '../app/js/state/presets.js';

// Expected values come from the approved source FIGHT_TECH_BOXING_LIBRARY_149_READY_FOR_INTEGRATION.json
// (version 2026-10-24-rev02, sha256 48d87660…d4d9), checked against it independently.
const BAG='Работа на мешке', SHADOW='Работа перед зеркалом / Бой с тенью',
  WEIGHTS='Работа с отягощением / Физподготовка', CIRCUITS='Круговые тренировки';
const boxing=LIBRARY.filter(x=>x.mode==='boxing_sequence');
const byId=id=>boxing.find(x=>x.id===id);
const count=(list,key)=>list.reduce((acc,x)=>({...acc,[key(x)]:(acc[key(x)]||0)+1}),{});
const compiled=w=>compileProgram([stageForWorkout(w)],PRESETS);
// The timeline a person lives through: every work phase and every rest, in order.
const timeline=rounds=>rounds.flatMap(r=>[r.workSec,...(r.phaseTwoSec?[r.phaseTwoSec]:[]),...(r.restSec?[-r.restSec]:[])]);
const sourceTimeline=w=>w.rounds.flatMap(r=>[r.workSec,...(r.restSec?[-r.restSec]:[])]);

test('149 unique workouts in four boxing folders with the approved subfolders',()=>{
 assert.equal(BOXING_LIBRARY.length,149);
 assert.equal(new Set(boxing.map(x=>x.id)).size,149);
 assert.equal(new Set(LIBRARY.map(x=>x.id)).size,LIBRARY.length);
 assert.equal(LIBRARY.length,40+149);
 assert.deepEqual(count(boxing,x=>x.folder),{[BAG]:84,[SHADOW]:45,[WEIGHTS]:18,[CIRCUITS]:2});
 assert.deepEqual(count(boxing,x=>x.folder+' › '+x.subfolder),{
  [BAG+' › Дальняя дистанция']:24,[BAG+' › Средняя дистанция / Боковые в голову']:12,
  [BAG+' › Средняя дистанция / Боковые в корпус']:12,[BAG+' › Средняя дистанция / Удары снизу']:12,
  [BAG+' › Ближняя дистанция']:12,[BAG+' › Смешанные дистанции']:12,
  [SHADOW+' › Передвижение']:6,[SHADOW+' › Защитные действия']:5,[SHADOW+' › Атака в движении']:5,
  [SHADOW+' › Маневрирование и бой с тенью']:4,[SHADOW+' › Бой с тенью']:12,[SHADOW+' › Работа перед зеркалом']:13,
  [WEIGHTS+' › Двухфазные комплексы']:12,[WEIGHTS+' › Отягощения']:6,[CIRCUITS+' › Круговые программы']:2});
});

test('bag: 120 s work, 40 s rest, the same tasks in the strong then the weak stance, no doubling',()=>{
 const bag=BOXING_LIBRARY.filter(x=>x.folder===BAG);
 assert.equal(bag.reduce((sum,w)=>sum+w.rounds.length,0),1312);
 assert.equal(bag.reduce((sum,w)=>sum+new Set(w.rounds.map(r=>r.name)).size,0),656);
 for(const w of bag){
  const half=w.rounds.length/2;
  assert.ok(Number.isInteger(half)&&half>=4,w.id);
  assert.deepEqual(w.rounds.slice(0,half).map(r=>r.stance),Array(half).fill('сильная стойка'),w.id);
  assert.deepEqual(w.rounds.slice(half).map(r=>r.stance),Array(half).fill('слабая стойка'),w.id);
  assert.deepEqual(w.rounds.slice(half).map(r=>r.name),w.rounds.slice(0,half).map(r=>r.name),w.id);
  const rounds=compiled(byId(w.id));
  assert.equal(rounds.length,w.rounds.length,w.id);
  assert.ok(rounds.every(r=>r.workSec===120),w.id);
  assert.deepEqual(rounds.map(r=>r.restSec),[...Array(rounds.length-1).fill(40),0],w.id);
  assert.match(rounds[0].roundDescription,/^сильная стойка/);assert.match(rounds.at(-1).roundDescription,/^слабая стойка/);
 }
});

test('every workout runs its exact source timeline, names and descriptions, with no rest after the last round',()=>{
 for(const source of BOXING_LIBRARY){
  const w=byId(source.id),rounds=compiled(w);
  assert.equal(source.rounds.at(-1).restSec,0,source.id);
  assert.equal(rounds.at(-1).restSec,0,source.id);
  assert.deepEqual(timeline(rounds),sourceTimeline(source),source.id);
  if(rounds[0].intervalMode==='two_phase'){
   rounds.forEach((r,i)=>{
    assert.equal(r.phaseOneName,source.rounds[2*i].name,source.id);
    assert.equal(r.phaseTwoName,source.rounds[2*i+1].name,source.id);
    assert.equal(r.roundDescription,[...new Set([source.rounds[2*i].description,source.rounds[2*i+1].description])].join(' → '),source.id);
   });
  }else rounds.forEach((r,i)=>{
   const name=source.rounds[i].name;
   assert.equal(r.roundName,name.replace('Раунд '+(i+1)+'. ',''),source.id+':'+i);
   assert.ok(name.endsWith(r.roundName)&&r.roundName.length>0,source.id+':'+i);
   assert.equal(r.roundDescription,[source.rounds[i].stance,source.rounds[i].description].filter(Boolean).join(' · '),source.id+':'+i);
  });
 }
});

test('shadow and mirror keep separate 1-minute and 2-minute ready-to-run variants',()=>{
 for(const n of ['01','02','03','04','05','07']){
  const one=compiled(byId('MIRROR_'+n+'_60')),two=compiled(byId('MIRROR_'+n+'_120'));
  assert.deepEqual(one.map(r=>r.workSec),[60,60,60,60]);assert.deepEqual(two.map(r=>r.workSec),[120,120,120,120]);
  assert.deepEqual(one.map(r=>r.restSec),[30,30,30,0]);assert.deepEqual(two.map(r=>r.restSec),[30,30,30,0]);
  assert.deepEqual(one.map(r=>r.roundName),two.map(r=>r.roundName));
 }
 assert.deepEqual(compiled(byId('SHADOW_01')).map(r=>r.roundName),['Джеб с шагом вперёд и назад','Джеб при боковом смещении','Джеб с изменением дистанции']);
});

test('speed circuit 2 x 4 x 180 s with 30 s transitions and 180 s between circles; combined 6 x 180 s, 60 s, 300 s between blocks',()=>{
 const speed=compiled(byId('DEGTYAREV_CIRCUIT')),combined=compiled(byId('ROMANENKO_COMBINED'));
 assert.deepEqual(speed.map(r=>r.workSec),Array(8).fill(180));
 assert.deepEqual(speed.map(r=>r.restSec),[30,30,30,180,30,30,30,0]);
 assert.deepEqual(speed.slice(4).map(r=>r.roundName),speed.slice(0,4).map(r=>r.roundName));
 assert.deepEqual(combined.map(r=>r.workSec),Array(6).fill(180));
 assert.deepEqual(combined.map(r=>r.restSec),[60,60,300,60,60,0]);
 assert.equal(byId('DEGTYAREV_CIRCUIT').folder,CIRCUITS);assert.equal(byId('ROMANENKO_COMBINED').folder,CIRCUITS);
});

test('two-phase complexes run on the two-phase engine: 6 rounds of 30 s + 90 s, 40 s rest',()=>{
 const twoPhase=boxing.filter(w=>stageForWorkout(w).settings.intervalMode==='two_phase').map(w=>w.id);
 assert.deepEqual(twoPhase,BOXING_LIBRARY.filter(x=>x.mode==='two_phase').map(x=>x.id));
 assert.equal(twoPhase.length,12);
 const rounds=compiled(byId('BOX-CON-001'));
 assert.equal(rounds.length,6);
 assert.deepEqual(rounds.map(r=>[r.workSec,r.phaseTwoSec,r.restSec]),[...Array(5).fill([30,90,40]),[30,90,0]]);
 assert.equal(rounds[0].phaseOneName,'Контролируемые движения передней рукой с лёгкой гантелью');
 assert.equal(rounds[0].phaseTwoName,'Джеб → выход');
 // Sequences keep their own varied phases exactly, e.g. 3:00, 2:00, 3:00 + 5:00 rest, 3:00.
 assert.deepEqual(compiled(byId('ROMANENKO_WARMUP')).map(r=>[r.workSec,r.restSec]),[[180,0],[120,0],[180,300],[180,0]]);
});

test('a workout survives storage and .ftworkout export unchanged, including 141-character round names',()=>{
 for(const id of ['BOX-065','BOX-CON-001','DEGTYAREV_CIRCUIT','MIRROR_07_120']){
  const stage=stageForWorkout(byId(id));
  const stored=normalizeProgram(JSON.parse(JSON.stringify([stage])));
  assert.deepEqual(compileProgram(stored,PRESETS),compileProgram([stage],PRESETS),id);
  const shared=parseWorkoutFile(serializeWorkoutFile({name:id,entries:[stage],options:{cycles:1,cycleRestSec:60}}));
  assert.deepEqual(compileProgram(shared.entries,PRESETS),compileProgram([stage],PRESETS),id);
 }
 assert.equal(Math.max(...BOXING_LIBRARY.flatMap(w=>w.rounds.map(r=>r.name.length))),141);
});

test('library navigation: sections, boxing folders and subfolders with counts, Back one level at a time',()=>{
 const root=libraryLevel(LIBRARY,CATEGORIES,{});
 assert.equal(root.back,false);
 assert.deepEqual(root.items.map(i=>i.key),CATEGORIES.map(([id])=>id));
 assert.equal(root.items.find(i=>i.key==='boxing').count,152);
 let path=libraryOpen({},root.items.find(i=>i.key==='boxing'));
 const folders=libraryLevel(LIBRARY,CATEGORIES,path);
 assert.equal(folders.title,'Бокс');
 assert.deepEqual(folders.items.map(i=>[i.label,i.count]),[[BAG,84],[SHADOW,54],[WEIGHTS,18],[CIRCUITS,2],[UNFILED,3]]);
 path=libraryOpen(path,folders.items[0]);
 const bag=libraryLevel(LIBRARY,CATEGORIES,path);
 assert.deepEqual(bag.items.map(i=>i.count),[24,12,12,12,12,12]);
 path=libraryOpen(path,bag.items[1]);
 const hooks=libraryLevel(LIBRARY,CATEGORIES,path);
 assert.equal(hooks.title,'Средняя дистанция / Боковые в голову');
 assert.equal(hooks.items.length,12);assert.ok(hooks.items.every(i=>i.kind==='workout'));
 assert.deepEqual(libraryUp(path),{category:'boxing',folder:BAG});
 assert.deepEqual(libraryUp(libraryUp(path)),{category:'boxing'});
 assert.deepEqual(libraryUp(libraryUp(libraryUp(path))),{});
 // The bag programs the source shares with shadow boxing are listed there too, stored once.
 const shadow=libraryLevel(LIBRARY,CATEGORIES,{category:'boxing',folder:SHADOW});
 assert.equal(shadow.items.at(-1).label,'Общие с работой на мешке');
 const shared=libraryLevel(LIBRARY,CATEGORIES,{category:'boxing',folder:SHADOW,subfolder:'Общие с работой на мешке'});
 assert.deepEqual(shared.items.map(i=>i.workout.id),SHARED_SHADOW_BAG_IDS);
 assert.ok(shared.items.every(i=>i.workout.folder===BAG));
 // A lone subfolder is skipped; sections without folders list workouts directly, as before.
 assert.deepEqual(libraryLevel(LIBRARY,CATEGORIES,{category:'boxing',folder:CIRCUITS}).items.map(i=>i.workout.id),['DEGTYAREV_CIRCUIT','ROMANENKO_COMBINED']);
 assert.deepEqual(libraryLevel(LIBRARY,CATEGORIES,{category:'boxing',folder:UNFILED}).items.map(i=>i.workout.id),['B01','B02','B05']);
 for(const [id] of CATEGORIES.filter(([id])=>id!=='boxing')){
  const level=libraryLevel(LIBRARY,CATEGORIES,{category:id});
  assert.deepEqual(level.items.map(i=>i.workout.id),LIBRARY.filter(w=>w.category===id).map(w=>w.id),id);
 }
});

test('workout notes, including draft and safety warnings, reach the library card',()=>{
 assert.match(byId('MEDBALL_9').note,/^ПРОЕКТ, НЕ ГОТОВ К ЗАПУСКУ/);
 assert.match(byId('BAR_6KG').note,/требует допуска тренера/);
 assert.deepEqual(byId('BOX-001').tasks.length,6);
});

test('the 40 workouts that existed before the boxing library build exactly the same stages',()=>{
 const legacy=LIBRARY.filter(w=>w.mode!=='boxing_sequence');
 assert.equal(legacy.length,40);
 // Hash of the same list built by commit 8546ab4, before any boxing workout was added.
 assert.equal(createHash('sha256').update(JSON.stringify(legacy.map(w=>[w.id,stageForWorkout(w)]))).digest('hex'),
  '72b52a10ec15ee0e000681bda4cc873636b46668f7a1f7431bef203b164affa7');
});
