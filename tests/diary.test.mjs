import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DIARY_KEY,readDiary,dayStatus,dayDots,monthCells,localDate} from '../app/js/diary/store.js';

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

test('reader is tolerant and never writes', () => {
  const writes=[];
  const store=v=>({getItem:k=>k===DIARY_KEY?v:null,setItem:(...a)=>writes.push(a),removeItem:(...a)=>writes.push(a)});
  assert.deepEqual(readDiary(store(null)),[]);
  assert.deepEqual(readDiary(store('{broken')),[]);
  assert.deepEqual(readDiary(store(JSON.stringify({schema:2,sessions:[s(TODAY,'done')]}))),[],'unknown schema is not read');
  const ok=readDiary(store(JSON.stringify({schema:1,sessions:[{id:'a',date:TODAY,status:'done'},{id:'b',date:'15.11.2026',status:'done'},{id:'c',date:TODAY,status:'lost'},null]})));
  assert.deepEqual(ok.map(x=>x.id),['a']);
  assert.equal(writes.length,0);
});

test('Play tab row: Мои | Библиотека | Дневник | import; Tree and Methodology stay hidden', () => {
  const html=readFileSync(new URL('../app/index.html',import.meta.url),'utf8');
  const nav=html.match(/<div class="program-library-tabs ft-library-nav">([\s\S]*?)<\/div>/)[1];
  const ids=[...nav.matchAll(/<button[^>]*id="([^"]+)"([^>]*)>/g)].map(m=>[m[1],/\shidden\b/.test(m[2])]);
  assert.deepEqual(ids,[['programLibraryMine',false],['programLibraryTemplates',false],['ftTreePreviewTab',true],['ftMethodV42Tab',true],['programLibraryDiary',false],['ftWorkoutImportBtn',false]]);
  assert.match(html,/styles\/methodology-v42\.css" \/>\s*<link rel="stylesheet" href=".\/styles\/diary\.css"/);
});
