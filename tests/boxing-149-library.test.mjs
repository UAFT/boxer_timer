import test from 'node:test';
import assert from 'node:assert/strict';
import {LIBRARY} from '../app/js/library/catalog.js';
import {stageForWorkout} from '../app/js/library/native-adapter.js';
import {compileProgram} from '../app/js/core/program.js';
import {PRESETS} from '../app/js/state/presets.js';
const boxing=LIBRARY.filter(x=>x.mode==='boxing_sequence');
test('149 unique approved boxing programs and four sections',()=>{
 assert.equal(boxing.length,149);assert.equal(new Set(boxing.map(x=>x.id)).size,149);
 assert.deepEqual(Object.fromEntries([...new Set(boxing.map(x=>x.folder))].map(f=>[f,boxing.filter(x=>x.folder===f).length])),{
  'Работа на мешке':84,'Работа перед зеркалом / Бой с тенью':45,
  'Работа с отягощением / Физподготовка':18,'Круговые тренировки':2});
});
test('every approved workout compiles with exact timing and no final rest',()=>{
 for(const w of boxing){const stage=stageForWorkout(w);assert.ok(stage,w.id);
  const compiled=compileProgram([stage],PRESETS);assert.equal(compiled.length,w.rounds.length,w.id);
  for(let i=0;i<compiled.length;i++){
   assert.equal(compiled[i].workSec,w.rounds[i].workSec,w.id+':'+i);
   assert.equal(compiled[i].restSec,i===compiled.length-1?0:w.rounds[i].restSec,w.id+':'+i);
   assert.equal(compiled[i].roundName,w.rounds[i].name,w.id+':'+i);
  }
 }
});
test('speed circuit 180 seconds and combined circuit 300 seconds',()=>{
 const speed=boxing.find(x=>x.id==='DEGTYAREV_CIRCUIT');const combined=boxing.find(x=>x.id==='ROMANENKO_COMBINED');
 assert.equal(speed.rounds[3].restSec,180);assert.equal(combined.rounds[2].restSec,300);
});
