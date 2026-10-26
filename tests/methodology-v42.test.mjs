import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {METHODOLOGY_V42 as M} from '../app/js/library/methodology-v42-data.js';
import {renderMethodologyV42,renderProgramBody,programChips,V42_NO_ROUNDS_NOTICE} from '../app/js/library/methodology-v42-view.js';

const stages=M.sections.flatMap(s=>s.stages);
const programs=stages.flatMap(t=>t.programs);
const FORMATS=['Бой с тенью','Перед зеркалом','На мешке','На лапах','Работа в паре'];
const LABELS=['Имитация без партнёра','Техника выполнения','Подготовительное упражнение'];

test('approved V4.2 tree: 7 sections, 54 stages, 170 programs in the approved order',()=>{
 assert.deepEqual(M.counts,{sections:7,stages:54,programs:170});
 assert.deepEqual(M.sections.map(s=>s.id),['S1','S2','S3','S4','S5','S6','S7']);
 assert.deepEqual(stages.map(t=>t.no),Array.from({length:54},(_,i)=>i+1));
 assert.equal(new Set(programs.map(p=>p.id)).size,170);
 assert.ok(!M.sections.some(s=>/дальн/i.test(s.title)&&/средн/i.test(s.title)),'no separate long↔middle section');
});

test('close range: technique, then exits before entries, counter-entry before own-attack entry, then series',()=>{
 const pos=k=>stages.findIndex(t=>t.id===k);
 assert.deepEqual(M.sections[4].stages.map(t=>t.id),['CLOSE-EXIT','CLOSE-ENTRY','TR-CLOSE-COMBINE']);
 assert.ok(pos('CLOSE-ACTIVE-DEF')<pos('CLOSE-EXIT')&&pos('TR-CLOSE-COMBINE')<pos('CLOSE-REPEAT'));
 const entry=stages.find(t=>t.id==='CLOSE-ENTRY').programs.map(p=>p.id);
 const lastCounter=Math.max(...entry.map((id,i)=>id.includes('-CNT-')?i:-1));
 const firstAttack=entry.findIndex(id=>id.includes('-ATT-'));
 assert.ok(lastCounter>=0&&firstAttack>lastCounter);
 for(const k of ['FAR-FEINT','FAR-ROPES'])assert.equal(M.sections.find(s=>s.stages.some(t=>t.id===k)).id,'S2',k);
 assert.equal(M.sections.find(s=>s.stages.some(t=>t.id==='CLOSE-CORNER')).id,'S6');
});

test('user-facing text is clean instruction: no book references, page numbers, record IDs or audit placeholders',()=>{
 const bad=/Огуренк|Романенк|Булычев|первоисточник|\bстр\.\s?\d|\bp\d+\b|web\d|рис\.\s?\d|\bEV-|\b(?:ROM|OGE\d*|BUL)-|OCR|сопоставлен|редактор|\[|\]/;
 const texts=[...M.sections.map(s=>s.title),...stages.flatMap(t=>[t.title,t.task]),
  ...programs.flatMap(p=>[p.title,...p.criteria.flat(),...p.exercises.flatMap(e=>[e.text,e.needs,e.equipment,...e.formats,...e.labels])])];
 for(const text of texts)assert.ok(!bad.test(text),text.slice(0,120));
 for(const p of programs)for(const [label,text] of p.criteria){assert.ok(['Техника','Тактика','Особенности выполнения','Типичные ошибки'].includes(label));assert.ok(text.trim(),p.id+' '+label);}
});

test('every program lists concrete exercises; formats come only from the five approved labels',()=>{
 for(const p of programs){
  assert.ok(p.exercises.length>0,p.id);
  for(const e of p.exercises){
   assert.ok(e.text.length>3,p.id);
   for(const f of e.formats)assert.ok(FORMATS.includes(f),f);
   for(const l of e.labels)assert.ok(LABELS.includes(l),l);
   assert.ok(!(e.formats.includes('Бой с тенью')&&e.labels.includes('Имитация без партнёра')));
  }
  for(const f of p.formats)assert.ok(FORMATS.includes(f));
 }
 const lap=programs.flatMap(p=>p.exercises).filter(e=>e.formats.includes('На лапах'));
 assert.ok(lap.length&&lap.every(e=>/лап/.test(e.needs)));
});

function mockDoc(){
 const make=tag=>{const node={tag,className:'',textContent:'',dataset:{},open:false,children:[],listeners:{},
  append(...c){this.children.push(...c);},addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);},
  toggle(){this.open=!this.open;for(const fn of this.listeners.toggle||[])fn();}};return node;};
 return {createElement:make};
}
const find=(n,cls)=>(n.children||[]).flatMap(c=>[...(c.className?.split(' ').includes(cls)?[c]:[]),...find(c,cls)]);

test('preview renders lazily and never offers playback; program shows notice, criteria and the full exercise list',()=>{
 const doc=mockDoc();
 const root=renderMethodologyV42(doc,M);
 const sections=find(root,'ft-route-section');
 assert.equal(sections.length,7);
 assert.equal(find(root,'ft-v42-program').length,0,'programs are built only when opened');
 const s5=sections[4];s5.toggle();
 const step=find(s5,'ft-route-step').find(x=>x.dataset.stage==='CLOSE-ENTRY');step.toggle();
 const cards=find(step,'ft-v42-program');
 assert.equal(cards.length,5);
 cards[1].toggle();
 const body=find(cards[1],'ft-v42-program-body')[0];
 assert.equal(find(body,'ft-v42-notice')[0].textContent,V42_NO_ROUNDS_NOTICE);
 assert.equal(find(body,'ft-v42-exercise').length,stages.find(t=>t.id==='CLOSE-ENTRY').programs[1].exercises.length);
 const tags=JSON.stringify(root);
 assert.ok(!/"button"/.test(tags),'no buttons: nothing can start or add to the timer');
 const p=programs.find(x=>x.id==='PRG-MECH-STRAIGHT-1');
 assert.deepEqual(programChips(p),['Имитация без партнёра']);
 assert.ok(find(renderProgramBody(doc,p),'ft-v42-criterion').length>=2);
});

test('library nav keeps the old tabs and adds the read-only methodology tab',()=>{
 const html=readFileSync(new URL('../app/index.html',import.meta.url),'utf8');
 for(const id of ['programLibraryMine','programLibraryTemplates','ftTreePreviewTab','ftMethodV42Tab','ftWorkoutImportBtn'])assert.ok(html.includes('id="'+id+'"'),id);
 assert.ok(html.includes('styles/methodology-v42.css'));
 const app=readFileSync(new URL('../app/js/app.js',import.meta.url),'utf8');
 assert.ok(app.includes("import('./library/methodology-v42-data.js')"),'data loads on demand, not at startup');
});

import {V42_WORKOUTS} from '../app/js/library/methodology-v42-rounds.js';
import {workoutTotalSec} from '../app/js/library/methodology-v42-view.js';
import {boxingStage} from '../app/js/library/boxing-stage.js';
import {compileProgram} from '../app/js/core/program.js';
import {PRESETS} from '../app/js/state/presets.js';

test('owner program «Прямой и подставка; шаг назад»: 15 rounds 2:00/1:00, no trailing rest, 44:00 through the real compiler',()=>{
 const w=V42_WORKOUTS['PRG-FAR-STRAIGHT-1'];
 assert.deepEqual(Object.keys(V42_WORKOUTS),['PRG-FAR-STRAIGHT-1'],'only the first program has rounds');
 assert.ok(programs.some(p=>p.id===w.id&&p.title===w.name));
 assert.equal(w.rounds.length,15);
 assert.deepEqual(w.blocks.map(b=>b[1]),[1,3,4,3,4]);
 assert.ok(w.rounds.every(r=>r.workSec===120&&r.restSec===60));
 assert.equal(workoutTotalSec(w),44*60);
 const rounds=compileProgram([boxingStage(w)],PRESETS,{cycles:1});
 assert.equal(rounds.length,15);
 assert.equal(rounds.at(-1).restSec,0);
 assert.equal(rounds.reduce((s,r)=>s+r.workSec+r.restSec,0),2640);
 assert.equal(rounds[0].roundName,'Прямой левой в голову с места');
});

test('owner rounds: block order by stance then hand, strike with the step, подставка (never парирование), opposite palm',()=>{
 const w=V42_WORKOUTS['PRG-FAR-STRAIGHT-1'];
 const key=w.rounds.map(r=>(r.stance.startsWith('лево')?'L':'R')+(r.hand==='левой'?'l':'r')).join('');
 assert.equal(key,'Ll'.repeat(4)+'Lr'.repeat(4)+'Rl'.repeat(3)+'Rr'.repeat(4));
 for(const [i,r] of w.rounds.entries()){
  assert.ok(r.name.startsWith('Прямой '+r.hand),i);
  assert.ok(!/париров|отбив/i.test(r.name+r.description),i);
  assert.ok(r.description.includes('подставка открытой ладони '+(r.hand==='левой'?'правой':'левой')+' руки'),i);
  assert.ok(r.description.length<=560,i);
  if(i)assert.ok(r.description.includes('одновременно с постановкой ноги'),i);
 }
 assert.ok(w.rounds[0].description.includes('без шага'));
 for(const i of [3,7,10,14])assert.ok(w.rounds[i].description.includes('Без возврата'),i);
 for(const i of [1,2,4,5,6,8,9,11,12,13])assert.ok(w.rounds[i].description.includes('Возврат'),i);
});

test('methodology tab: only the owner program shows rounds and one add button; others keep the notice',()=>{
 const doc=mockDoc();const added=[];
 const root=renderMethodologyV42(doc,M,{workouts:V42_WORKOUTS,onAdd:w=>{added.push(w.id);return true;}});
 const s2=find(root,'ft-route-section')[1];s2.toggle();
 const step=find(s2,'ft-route-step').find(x=>x.dataset.stage==='FAR-STRAIGHT-ATTDEF');step.toggle();
 const cards=find(step,'ft-v42-program');
 cards.forEach(c=>c.toggle());
 const own=cards.find(c=>c.dataset.program==='PRG-FAR-STRAIGHT-1');
 assert.equal(find(own,'ft-v42-round').length,15);
 assert.equal(find(own,'ft-v42-notice').length,0);
 assert.equal(find(own,'ft-v42-exercise').length,programs.find(p=>p.id==='PRG-FAR-STRAIGHT-1').exercises.length,'source exercises kept');
 const add=find(own,'ft-v42-add');assert.equal(add.length,1);
 add[0].listeners.click[0]();assert.deepEqual(added,['PRG-FAR-STRAIGHT-1']);
 for(const c of cards.filter(c=>c!==own)){assert.equal(find(c,'ft-v42-add').length,0);assert.equal(find(c,'ft-v42-notice').length,1);}
});
