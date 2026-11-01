import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { resolveLanguage, translateText } from '../app/js/i18n/locale.js';
test('auto follows Russian phone locale; otherwise English',()=>{
  assert.equal(resolveLanguage('auto','ru-RU'),'ru');
  assert.equal(resolveLanguage('auto','en-US'),'en');
  assert.equal(resolveLanguage('auto','hi-IN'),'en');
  assert.equal(resolveLanguage('en','ru-RU'),'en');
  assert.equal(resolveLanguage('ru','en-US'),'ru');
});
test('translates modes, stages and timer without altering numeric values',()=>{
  assert.equal(translateText('Этап 3 · Лестница · 3 раундов','en'),'Stage 3 · Ladder · 3 rounds');
  assert.equal(translateText('Раунд 1 · 01:00 · отдых 00:30','en'),'Round 1 · 01:00 · rest 00:30');
  assert.equal(translateText('Раунд 1','ru'),'Раунд 1');
});
test('a refresh pass compiles no patterns and keeps the original translations',()=>{
  // Reference: the per-call implementation that each timer tick used to run for every text node.
  const source=readFileSync(new URL('../app/js/i18n/locale.js',import.meta.url),'utf8');
  const pairs=Function('return '+source.slice(source.indexOf('const pairs = ')+14,source.indexOf('.sort((a,b)'))+';')();
  pairs.sort((a,b)=>b[0].length-a[0].length);
  const reference=text=>pairs.reduce((r,[ru,en])=>r.replace(new RegExp('(?<![А-Яа-яЁё])'+ru.replace(/[.*+?^$()|[\]{}\\]/g,'\\$&')+'(?![А-Яа-яЁё])','g'),en),text);
  const samples=[...pairs.map(p=>p[0]),'Этап 2/3 · Блок 1/2 · Раунд 4/6 · Джеб','Отдых 00:30','Работа · Лестница','Мой бой: Работа ногами','3 раунда × 2 блока · отдых между блоками 01:00'];
  // Library parts (here «Джеб») are looked up in LIBRARY_EN before the UI patterns.
  const expected=samples.map(reference).map(x=>x.replace('· Джеб','· Jab'));
  let built=0;const Native=globalThis.RegExp;
  globalThis.RegExp=new Proxy(Native,{construct(target,args){built++;return new target(...args);}});
  try{for(let pass=0;pass<2;pass++)assert.deepEqual(samples.map(text=>translateText(text,'en')),expected);}
  finally{globalThis.RegExp=Native;}
  assert.equal(built,0);
});
test('stage editor captions and hints switch fully to English in every mode',()=>{
  assert.equal(translateText('Время фазы 1','en'),'Phase 1 duration');
  assert.equal(translateText('Время фазы 2','en'),'Phase 2 duration');
  const app=readFileSync(new URL('../app/js/app.js',import.meta.url),'utf8');
  const modeSync=app.slice(app.indexOf('function syncStageSettingsMode'),app.indexOf('const metroField'));
  const combo=readFileSync(new URL('../app/js/ui/interval-mode-combo.js',import.meta.url),'utf8');
  const literals=[...(modeSync+combo).matchAll(/'([^'\n]*[А-Яа-яЁё][^'\n]*)'/g)].map(m=>m[1]);
  assert.ok(literals.includes('Время фазы 1'),'the two-phase caption is still a literal here');
  for (const ru of literals) assert.doesNotMatch(translateText(ru,'en'),/[А-Яа-яЁё]/,ru);
});
