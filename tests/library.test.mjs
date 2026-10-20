import test from 'node:test';
import assert from 'node:assert/strict';
import {LIBRARY,CATEGORIES,findWorkout,buildSteps,buildSequence} from '../app/js/library/catalog.js';
test('all nine requested categories populated',()=>{
  assert.equal(CATEGORIES.length,9);
  for(const [cat] of CATEGORIES)assert.ok(LIBRARY.some(x=>x.category===cat),cat);
  assert.equal(new Set(LIBRARY.map(x=>x.id)).size,LIBRARY.length);
  assert.equal(LIBRARY.length,34);
});
test('20/20 repeats exercises with no extra final rest',()=>{
  const s=buildSteps(findWorkout('I01'));
  assert.equal(s.filter(x=>x.kind==='work').length,12);
  assert.equal(s.filter(x=>x.kind==='rest').length,11);
  assert.equal(s.reduce((n,x)=>n+x.seconds,0),460);
});
test('EMOM one task per minute and AMRAP one continuous interval',()=>{
  const emom=buildSteps(findWorkout('E01'));
  assert.equal(emom.length,12);
  assert.ok(emom.every(x=>x.seconds===60));
  assert.equal(buildSteps(findWorkout('A01'))[0].seconds,1200);
});
test('Tabata 8 sets per exercise and 20/10, AFAP manually completed',()=>{
  const t=buildSteps(findWorkout('T04'));
  assert.equal(t.filter(x=>x.kind==='work').length,32);
  assert.equal(t.filter(x=>x.kind==='rest').length,32);
  assert.equal(buildSteps(findWorkout('T01')).reduce((n,x)=>n+x.seconds,0),240);
  assert.equal(t[0].seconds,20);
  assert.equal(t[1].seconds,10);
  assert.equal(buildSteps(findWorkout('F01'))[0].kind,'afap');
});
test('composition preserves order and inter-program rest',()=>{
  const s=buildSequence(['W02','B01','F01'],60);
  assert.equal(s.filter(x=>x.title==='Отдых между программами').length,2);
  assert.equal(s[0].programId,'W02');
  assert.equal(s.at(-1).programId,'F01');
});
