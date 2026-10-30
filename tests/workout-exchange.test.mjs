import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import { stageForWorkout } from '../app/js/library/native-adapter.js';
import { LIBRARY, RETIRED_LIBRARY } from '../app/js/library/catalog.js';
import {parseWorkoutFile, serializeWorkoutFile, storeImportedWorkout, resolveSenderSettings, workoutFileName, WorkoutFileError, WORKOUT_FILE_MAX_BYTES} from '../app/js/sharing/workout-file.js';
import {shareWorkout} from '../app/js/sharing/file-transfer.js';

const workout=stageForWorkout(RETIRED_LIBRARY.find(w=>w.id==='B05'));
const example={name:'Бокс · Силовая',entries:[workout,{...workout,title:'Мой блок',roundNames:['Руки','Ноги'],roundDescriptions:['Сильно',''],restAfterSec:55}],options:{cycles:2,cycleRestSec:90}};

test('ftworkout v1 JSON roundtrip preserves settings, descriptions, cycles, offline structure',()=>{
 const encoded=serializeWorkoutFile(example);
 assert.ok(encoded.includes('fighttech.workout'));
 assert.ok(!encoded.includes('pimport-'));
 const decoded=parseWorkoutFile(encoded);
 assert.equal(decoded.name,example.name);
 assert.equal(decoded.entries[0].title,'Бокс — Работа с гантелями');
 assert.deepEqual(decoded.entries[0].roundNames,workout.roundNames);
 assert.deepEqual(decoded.entries[0].settings,workout.settings);
 assert.equal(decoded.entries[1].roundDescriptions[0],'Сильно');
 assert.equal(decoded.entries[1].restAfterSec,55);
 assert.deepEqual(decoded.options,{cycles:2,cycleRestSec:90});
 assert.ok(workoutFileName('Бокс / День 1').endsWith('.ftworkout'));
 assert.ok(Buffer.byteLength(encoded,'utf8')<WORKOUT_FILE_MAX_BYTES);
});

test('legacy saved stage with no settings exports actual sender profile, not recipient defaults',()=>{
 const legacy={...example,entries:[{...workout,settings:null}]};
 const senderProfile={...workout.settings,workSec:173,restSec:47};
 const resolved=resolveSenderSettings(legacy,{[workout.presetId]:senderProfile});
 const shared=parseWorkoutFile(serializeWorkoutFile(resolved));
 assert.equal(shared.entries[0].settings.workSec,173);
 assert.equal(shared.entries[0].settings.restSec,47);
 assert.equal(legacy.entries[0].settings,null);
 assert.throws(()=>serializeWorkoutFile(legacy),{code:'invalid'});
});

test('tampered, unrelated, oversized or future-version files are rejected',()=>{
 const base=JSON.parse(serializeWorkoutFile(example));
 const bad=[
  {value:{...base,format:'malware'},code:'invalid'},
  {value:{...base,version:3},code:'version'},
  {value:{...base,entries:[]},code:'invalid'},
  {value:{...base,entries:[{...base.entries[0],presetId:'bad'}]},code:'invalid'},
  {value:{...base,entries:[{...base.entries[0],settings:{...workout.settings,workSec:-1}}]},code:'invalid'},
  {value:{...base,entries:[{...base.entries[0],settings:{...workout.settings,blockEnabled:true,blockCount:999}}]},code:'invalid'},
  {value:{...base,entries:[{...base.entries[0],settings:{...workout.settings,unsafe:{foo:1}}}]},code:'invalid'},
  {value:{...base,name:''},code:'invalid'},
  {value:{...base,options:{cycles:200,cycleRestSec:60}},code:'invalid'}
 ];
 for(const {value,code} of bad)assert.throws(()=>parseWorkoutFile(JSON.stringify(value)),{code});
 assert.throws(()=>parseWorkoutFile('not json'),{code:'invalid'});
 assert.throws(()=>parseWorkoutFile(' '.repeat(WORKOUT_FILE_MAX_BYTES+1)),{code:'too_large'});
});

test('import saves distinct copy atomically; storage failure does not mutate existing state',()=>{
 const raw=parseWorkoutFile(serializeWorkoutFile(example));
 const old=[{id:'original',name:example.name,entries:example.entries,options:example.options}];
 let stored=null;
 const storage={setItem:(key,text)=>{stored={key,text};}};
 const next=storeImportedWorkout(old,raw,storage,'saved-programs','pimport-1');
 assert.equal(old.length,1);
 assert.equal(next.length,2);
 assert.equal(next[1].id,'pimport-1');
 assert.deepEqual(next[1].entries,raw.entries);
 assert.equal(JSON.parse(stored.text).length,2);
 assert.throws(()=>storeImportedWorkout(next,raw,storage,'saved-programs','pimport-1'),{code:'invalid'});
 assert.throws(()=>storeImportedWorkout(old,raw,{setItem:()=>{throw Error('QuotaExceeded');}},'saved-programs','pimport-2'),/QuotaExceeded/);
 assert.equal(old.length,1);
 assert.throws(()=>storeImportedWorkout(Array(100).fill(old[0]),raw,storage,'saved-programs','next'),{code:'limit'});
});

test('Android-native share writes UTF-8 file in Cache, passes real file URI to Share plugin',async()=>{
 let file,share;
 const win={Capacitor:{Plugins:{
  Filesystem:{writeFile:async options=>{file=options;},getUri:async()=>({uri:'file:///data/user/0/cache/dummy.ftworkout'})},
  Share:{share:async options=>{share=options;}}
 }}};
 const result=await shareWorkout(example,{win,nav:{},doc:{}});
 assert.equal(result,'shared');
 assert.equal(file.directory,'CACHE');
 assert.ok(file.path.endsWith('.ftworkout'));
 assert.equal(Buffer.from(file.data,'base64').toString('utf8'),serializeWorkoutFile(example));
 assert.deepEqual(share.files,['file:///data/user/0/cache/dummy.ftworkout']);
 assert.equal(share.title,example.name);
});

test('native mode without plugins refuses false-success browser download',async()=>{
 await assert.rejects(()=>shareWorkout(example,{win:{Capacitor:{isNativePlatform:()=>true}},nav:{},doc:{}}),/native_unavailable/);
});

test('UI provides file picker and share action, no engine change',()=>{
 const html=readFileSync(new URL('../app/index.html',import.meta.url),'utf8');
 const app=readFileSync(new URL('../app/js/app.js',import.meta.url),'utf8');
 for(const id of ['ftWorkoutImportBtn','ftWorkoutImportFile','ftWorkoutImportModal','ftWorkoutImportCancel','ftWorkoutImportAccept','ftWorkoutExchangeStatus']) assert.ok(html.includes('id="'+id+'"'),id);
 assert.ok(html.includes('accept="*/*"'),'Android file picker accepts unknown .ftworkout MIME');
 assert.ok(app.includes('installWorkoutExchange'));
 assert.ok(app.includes('storeImportedWorkout'));
 assert.ok(app.includes('exchange.shareButton(entry)'));
});
