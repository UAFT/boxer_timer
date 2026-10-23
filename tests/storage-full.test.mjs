import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {writeJson,STORAGE_FULL_MESSAGE} from '../app/js/state/storage.js';
import {storeImportedWorkout,parseWorkoutFile} from '../app/js/sharing/workout-file.js';
import {clonePreset} from '../app/js/state/presets.js';

// A full localStorage used to throw in the middle of a save: the new or updated
// program showed in the list but was gone after the next launch.
const full={setItem(){const e=new Error('quota');e.name='QuotaExceededError';throw e;}};

test('a failed write reports false instead of throwing; a good one stores JSON',()=>{
 assert.equal(writeJson('k',{a:1},full),false);
 const saved={};
 assert.equal(writeJson('k',{a:1},{setItem:(k,v)=>{saved[k]=v;}}),true);
 assert.equal(saved.k,'{"a":1}');
 assert.match(STORAGE_FULL_MESSAGE.ru,/память приложения заполнена/);
});

test('an import into a full storage leaves the library list unchanged',()=>{
 const program=parseWorkoutFile(JSON.stringify({format:'fighttech.workout',version:1,name:'A',options:{cycles:1,cycleRestSec:0},
  entries:[{presetId:'classic3',title:'',restAfterSec:0,settings:{...clonePreset('classic3'),rounds:3,workSec:60,restSec:30}}]}));
 const existing=[];
 assert.throws(()=>storeImportedWorkout(existing,program,full,'lib','id1'),/quota/);
 assert.deepEqual(existing,[]);
});

test('every program and library write in the app goes through the checked helper',()=>{
 const app=readFileSync(new URL('../app/js/app.js',import.meta.url),'utf8');
 assert.equal(/localStorage\.setItem/.test(app),false);
 assert.ok(app.includes('function persistLibrary(next) {if(!store(LIBRARY_KEY,next))return false;savedPrograms=next;return true;}'));
 for(const call of ['if(!persistLibrary(savedPrograms.filter(','if(!persistLibrary(savedPrograms.map(','if(!persistLibrary([...savedPrograms,snapshot(name,id)]))return;'])assert.ok(app.includes(call),call);
});
