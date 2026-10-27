import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {METHODOLOGY_V42 as M} from '../app/js/library/methodology-v42-data.js';
import {renderMethodologyV42,renderProgramBody,V42_NO_ROUNDS_NOTICE} from '../app/js/library/methodology-v42-view.js';

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
 assert.equal(find(root,'ft-v42-intro').length,0,'no intro paragraph');
 assert.equal(find(root,'ft-v42-chips').length,0);
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
import {stageForWorkout} from '../app/js/library/native-adapter.js';
import {compileProgram} from '../app/js/core/program.js';
import {PRESETS} from '../app/js/state/presets.js';
const W=V42_WORKOUTS['PRG-FAR-STRAIGHT-1'];
const P1=programs.find(p=>p.id==='PRG-FAR-STRAIGHT-1');

test('owner program «Прямой и подставка: шаг назад»: 15 rounds 2:00/1:00, no trailing rest, 44:00 through the Tree adapter and real compiler',()=>{
 assert.deepEqual(Object.keys(V42_WORKOUTS),['FT-S9-STEP-BACK','PRG-FAR-STRAIGHT-1','FT-S9-BODY-BENT-ARM','FT-S9-PULLBACK'],'exactly four owner programs, owner teaching order (V46): step back, palm, bent arm, pullback');
 assert.equal(W.name,'Прямые в голову — защита подставкой открытой ладони');
 assert.equal(P1.title,'Прямой и подставка; шаг назад','methodology title untouched');
 assert.equal(W.rounds.length,15);
 assert.deepEqual(W.blocks.map(b=>b[1]),[1,3,4,3,4]);
 assert.ok(W.rounds.every(r=>r.workSec===120&&r.restSec===60));
 assert.equal(workoutTotalSec(W),44*60);
 const stage=stageForWorkout(W);
 assert.equal(stage.title,'Бокс — Прямые в голову — защита подставкой открытой ладони');
 const rounds=compileProgram([stage],PRESETS,{cycles:1});
 assert.equal(rounds.length,15);
 assert.equal(rounds.at(-1).restSec,0);
 assert.equal(rounds.reduce((s,r)=>s+r.workSec+r.restSec,0),2640);
 assert.deepEqual(rounds.map(r=>r.roundName),W.rounds.map(r=>r.name));
 assert.deepEqual(rounds.map(r=>r.roundDescription),W.rounds.map(r=>r.stance+' · '+r.description),'timer keeps the full descriptions');
});

// Expected movement per round: [stance L/R, hand, stepping foot, its move, kind, trailing foot]
const PLAN=[['L','левой',null,null,'still'],
 ['L','левой','Передняя левая','шагает вперёд','return'],['L','левой','Задняя правая','шагает вправо','return'],['L','левой','Задняя правая','шагает вправо','follow','передняя левая'],
 ['L','правой','Передняя левая','шагает вперёд','return'],['L','правой','Задняя правая','делает короткий подшаг вперёд','return'],['L','правой','Передняя левая','шагает влево','return'],['L','правой','Передняя левая','шагает влево','follow','задняя правая'],
 ['R','левой','Передняя правая','шагает вперёд','return'],['R','левой','Задняя левая','шагает влево','return'],['R','левой','Задняя левая','шагает влево','follow','передняя правая'],
 ['R','правой','Передняя правая','шагает вперёд','return'],['R','правой','Задняя левая','делает короткий подшаг вперёд','return'],['R','правой','Передняя правая','шагает вправо','return'],['R','правой','Передняя правая','шагает вправо','follow','задняя левая']];
const TITLES=['Прямой левой с места','Прямой левой с шагом вперёд и синхронным возвратом','Прямой левой с шагом вправо и синхронным возвратом',
 'Прямой левой со смещением вправо и синхронным подтягиванием','Прямой правой с шагом вперёд и синхронным возвратом','Прямой правой с подшагом вперёд и синхронным возвратом',
 'Прямой правой с шагом влево и синхронным возвратом','Прямой правой со смещением влево и синхронным подтягиванием','Прямой левой с шагом вперёд и синхронным возвратом',
 'Прямой левой с шагом влево и синхронным возвратом','Прямой левой со смещением влево и синхронным подтягиванием','Прямой правой с шагом вперёд и синхронным возвратом',
 'Прямой правой с подшагом вперёд и синхронным возвратом','Прямой правой с шагом вправо и синхронным возвратом','Прямой правой со смещением вправо и синхронным подтягиванием'];
const gen=w=>w.toLowerCase().replace(/ая$/,'ой');

test('approved rounds: compact titles; punch lands with the stepping foot, hand returns together with the foot (return) or the trailing foot (displacement)',()=>{
 assert.deepEqual(W.rounds.map(r=>r.name),TITLES);
 assert.equal(new Set(W.rounds.map(r=>r.stance+r.name)).size,15,'a title repeats only in the other stance');
 assert.equal(new Set(W.rounds.map(r=>r.description)).size,15);
 for(const [i,[st,hand,foot,move,kind,trail]] of PLAN.entries()){
  const r=W.rounds[i],d=r.description,h=hand.slice(0,-2)+'ая';
  assert.equal(r.stance,st==='L'?'левосторонняя стойка':'правосторонняя стойка',i);
  assert.equal(r.hand,hand,i);
  assert.ok(!/стойк/i.test(r.name)&&!/ног/.test(r.name),'stance and feet live in the description: '+r.name);
  assert.ok(!/сначала шаг|потом удар|отдельным движением/.test(d),i);
  if(kind==='still'){
   assert.ok(d.startsWith('Без шага, ноги остаются на месте. Прямой левой в голову'),i);
   assert.ok(!/возврат\S* (левой|правой) ноги|подтягива|шагает/.test(d),'stationary round: no foot recovery');continue;}
  assert.ok(!/ноги (не двигаются|остаются на месте)/.test(d),'a stepping round never says the feet stay: '+i);
  const f=foot.split(' ')[1];
  assert.ok(d.startsWith(foot+' нога '+move),i);
  assert.ok(d.includes('одновременно прямой '+hand+' в голову: кулак достигает цели в момент постановки '+gen(f)+' ноги.'),i);
  if(kind==='return'){
   assert.ok(r.name.endsWith('и синхронным возвратом'),r.name);
   assert.ok(d.includes('Затем '+h+' рука возвращается к подбородку синхронно с возвратом '+gen(f)+' ноги в исходное положение: стойка и исходная точка восстановлены.'),i);
   assert.ok(!d.includes('подтягивается'),i);
  }else{
   assert.ok(/^Прямой (левой|правой) со смещением (влево|вправо) и синхронным подтягиванием$/.test(r.name),r.name);
   assert.ok(r.name.includes(move.split(' ').at(-1)),'title direction matches the step');
   assert.ok(d.includes('Затем '+trail+' нога подтягивается синхронно с возвратом '+hand+' руки к подбородку; ширина стойки восстанавливается, ноги не скрещиваются. Остаётесь на новом месте, в исходную точку не возвращаетесь.'),i);
   assert.ok(!d.includes('исходное положение'),i);
  }
 }
});

test('partner is optional; B uses the open palm opposite to the strike, no defender step-back; no parrying, no source references, no counterpunch',()=>{
 for(const [i,r] of W.rounds.entries()){
  const d=r.description,palm=r.hand==='левой'?'правой':'левой',guard=r.hand==='левой'?'Правая':'Левая';
  assert.ok(d.endsWith('С партнёром (по желанию): А бьёт, Б подставляет открытую ладонь '+palm+' руки.'),i);
  assert.ok(d.includes(guard+' перчатка весь раунд у подбородка'),i);
  assert.ok(d.includes('партнёр не обязателен'),i);
  assert.ok(!/шаг назад|париров|отбив|контрудар|ответн|исходном упражнен|источник/i.test(r.name+d),i);
  assert.ok((r.stance+' · '+d).length<=600,i);
  assert.equal(r.cue,r.stance);
 }
});

const SRC9=M.sections[1].stages.find(t=>t.id==='FAR-STRAIGHT-ATTDEF');
const LS='левосторонняя стойка',RS='правосторонняя стойка';
const timed=(w,n,min)=>{
 assert.equal(w.stageId,'FAR-STRAIGHT-ATTDEF');
 assert.equal(w.rounds.length,n);assert.equal(w.blocks.reduce((s,b)=>s+b[1],0),n);
 assert.ok(w.rounds.every(r=>r.workSec===120&&r.restSec===60&&r.cue===r.stance));
 assert.equal(workoutTotalSec(w),min*60);
 const rounds=compileProgram([stageForWorkout(w)],PRESETS,{cycles:1});
 assert.equal(rounds.length,n);assert.equal(rounds.at(-1).restSec,0);
 assert.equal(rounds.reduce((s,r)=>s+r.workSec+r.restSec,0),min*60);
 assert.deepEqual(rounds.map(r=>r.roundDescription),w.rounds.map(r=>r.stance+' · '+r.description));
 assert.equal(new Set(w.rounds.map(r=>r.stance+r.name)).size,n);
 for(const r of w.rounds){
  assert.ok((r.stance+' · '+r.description).length<=600&&r.name.length<=100,r.name);
  assert.ok(!/париров|отбив|двойн|уклон|смена ролей|весь раунд, Б|сначала шаг|исходном упражнен|источник|контрудар/i.test(r.name+r.description),r.name);
 }
};
const crit1=Object.fromEntries(P1.criteria),M1={technique:crit1['Техника'],tactics:crit1['Тактика'],execution:crit1['Особенности выполнения'],typicalMistakes:crit1['Типичные ошибки']};

test('program 2 (source #3): 13 rounds, 38:00; program 1 movement families minus the rear short step, body target, bent arm opposite to the strike',()=>{
 const w=V42_WORKOUTS['FT-S9-BODY-BENT-ARM'];timed(w,13,38);
 assert.equal(w.name,'Прямые в туловище — защита подставкой согнутой руки');
 assert.deepEqual(w.methodology,M1,'same source program fields, verbatim');
 const plan=PLAN.filter((_,i)=>i!==5&&i!==12);
 for(const [i,[st,hand,foot,move,kind,trail]] of plan.entries()){
  const r=w.rounds[i],d=r.description,h=hand.slice(0,-2)+'ая';
  assert.equal(r.stance,st==='L'?LS:RS,i);assert.equal(r.hand,hand,i);
  assert.equal(r.name,TITLES[W.rounds.indexOf(W.rounds.find((x,j)=>PLAN[j]===plan[i]))].replace(/^Прямой (левой|правой) /,'Прямой $1 в туловище '),i);
  assert.ok(d.endsWith('Б подставляет согнутую в локте '+(hand==='левой'?'правую':'левую')+' руку.'),i);
  assert.ok(!/ладон|в голову|шаг назад/.test(d),i);
  if(kind==='still'){assert.ok(d.startsWith('Без шага, ноги остаются на месте. Прямой левой в туловище'));continue;}
  const f=foot.split(' ')[1];
  assert.ok(d.startsWith(foot+' нога '+move+', одновременно прямой '+hand+' в туловище: кулак достигает цели в момент постановки '+gen(f)+' ноги.'),i);
  if(kind==='return')assert.ok(d.includes('Затем '+h+' рука возвращается к подбородку синхронно с возвратом '+gen(f)+' ноги в исходное положение'),i);
  else assert.ok(d.includes('Затем '+trail+' нога подтягивается синхронно с возвратом '+hand+' руки к подбородку')&&d.includes('в исходную точку не возвращаетесь'),i);
 }
});

test('program 3 (source #4): 11 rounds, 32:00; A steps in, B takes one step back, lead hand forward only against the head',()=>{
 const w=V42_WORKOUTS['FT-S9-STEP-BACK'];timed(w,11,32);
 assert.equal(w.name,'Защита шагом назад с выставлением передней руки');
 assert.deepEqual(w.methodology,M1);
 const exp=[[LS,'левой','в голову'],[LS,'левой','в голову'],[LS,'правой','в голову'],[LS,'левой','в туловище'],[LS,'правой','в туловище'],[LS,null,null],
  [RS,'левой','в голову'],[RS,'правой','в голову'],[RS,'левой','в туловище'],[RS,'правой','в туловище'],[RS,null,null]];
 for(const [i,[st,hand,target]] of exp.entries()){
  const r=w.rounds[i],d=r.description,[lead,rear]=st===LS?['левая','правая']:['правая','левая'];
  assert.equal(r.stance,st,i);
  assert.ok(d.includes('Б защищается одним шагом назад: '+rear+' нога шагает назад, '+lead+' подтягивается, стойка восстанавливается на новом месте'),i);
  assert.ok(!/ладон|подставк|согнут/.test(d),'no blocks: '+i);
  if(!hand){assert.ok(r.name.startsWith('Прямой левой или правой в голову или туловище'));assert.ok(d.includes('при ударе в голову '+lead+' рука выставлена вперёд для страховки'));continue;}
  assert.equal(r.hand,hand);
  assert.ok(r.name.startsWith('Прямой '+hand+' '+target+(i===0?' с места':' с шагом вперёд')),r.name);
  assert.equal(d.includes(lead+' рука выставлена вперёд для страховки'),target==='в голову','lead hand only against the head: '+i);
  if(i===0)assert.ok(d.startsWith('А: без шага, ноги остаются на месте'));
  else assert.ok(d.startsWith('А: передняя '+lead+' нога шагает вперёд, одновременно прямой '+hand+' '+target+': кулак достигает цели в момент постановки '+gen(lead)+' ноги. Затем задняя '+rear+' подтягивается синхронно с возвратом '+hand+' руки'),i);
 }
});

test('program 4 (owner V45): pullback, left stance, head only, 8 rounds, 23:00; 3/7 step back with the pullback then return, 4/8 step back with the pullback then the lead foot follows',()=>{
 const w=V42_WORKOUTS['FT-S9-PULLBACK'];timed(w,8,23);
 assert.equal(w.name,'Прямые в голову — защита оттяжкой назад');
 assert.ok(Object.values(w.methodology).every(Boolean)&&Object.keys(w.methodology).length===4);
 assert.ok(w.rounds.every(r=>r.stance===LS&&/оттяжк/.test(r.description)&&!/в туловище/.test(r.description)));
 assert.ok(w.rounds.every(r=>r.description.endsWith('С партнёром: А бьёт, Б уходит оттяжкой и отвечает прямым, А защищается подставкой.')),'paired drill is a description, not a round');
 for(const [k,hand] of ['левой','правой'].entries()){
  const [r1,r2,r3,r4]=w.rounds.slice(k*4,k*4+4);
  assert.ok([r1,r2,r3,r4].every(r=>r.hand===hand&&r.name.startsWith('Прямой '+hand)));
  assert.ok(r1.description.startsWith('Без шага, стопы на месте. Прямой '+hand+' в голову')&&r1.description.includes(' рука возвращается к подбородку одновременно с оттяжкой назад'));
  assert.ok(r2.description.startsWith('Передняя левая нога шагает вперёд, одновременно прямой '+hand+' в голову')&&r2.description.includes('левая нога возвращается в исходное положение синхронно с возвратом '+hand+' руки к подбородку и оттяжкой назад'));
  assert.ok(r3.description.includes('возврат руки к подбородку, шаг задней правой ноги назад и оттяжка — одновременно. Затем правая нога возвращается в исходное положение: стойка и исходная точка восстановлены'));
  assert.ok(r4.description.includes('Затем задняя правая шагает назад одновременно с оттяжкой, левая подтягивается к ней: остаётесь на новом месте, на шаг дальше исходной точки'));
  assert.ok(!/возвращается в исходное положение/.test(r4.description.split('Затем задняя')[1]),'4/8: no return to the start');
 }
});

test('parrying stays deferred; source records untouched; exercises #5/#6 are not programs',()=>{
 assert.deepEqual(SRC9.programs.map(p=>p.id),['PRG-FAR-STRAIGHT-1','PRG-FAR-STRAIGHT-B1','PRG-FAR-STRAIGHT-B2','PRG-FAR-STRAIGHT-B3']);
 assert.ok(!V42_WORKOUTS['PRG-FAR-STRAIGHT-B1']&&!V42_WORKOUTS['PRG-FAR-STRAIGHT-B2'],'V43 proposals removed');
 assert.equal(P1.exercises[2].text,'А — прямые левой или правой в туловище с места и с шагом; Б — подставка согнутой руки (от левой — правую, от правой — левую).');
 assert.equal(P1.exercises[3].text,'А — прямой левой или правой в голову; Б — шаг назад, левая рука выставлена для страховки. А — прямой в туловище; Б — шаг назад.');
});

test('four methodical fields are the approved V4.2 text verbatim; the six source exercises stay in the data unedited',()=>{
 const crit=Object.fromEntries(P1.criteria);
 assert.deepEqual(W.methodology,{technique:crit['Техника'],tactics:crit['Тактика'],execution:crit['Особенности выполнения'],typicalMistakes:crit['Типичные ошибки']});
 assert.deepEqual(P1.exercises.map(e=>e.id),['ROM-P1-S01','ROM-P1-S02','ROM-P1-S03','ROM-P1-S04','ROM-L1-01','ROM-MECH-PADS']);
 assert.equal(P1.exercises[1].text,'А — прямой правой в голову с места и с шагом; Б — подставка открытой ладони правой руки.');
});

test('methodology tab: stage 9 shows exactly the four Tree lesson cards, in order, no wrapper, no summary, no source cards',()=>{
 const doc=mockDoc();const asked=[];
 const root=renderMethodologyV42(doc,M,{workouts:V42_WORKOUTS,lessonCard:(w,stageId)=>{asked.push([w.id,stageId]);const c=doc.createElement('div');c.className='ft-route-lesson';return c;}});
 const s2=find(root,'ft-route-section')[1];s2.toggle();
 assert.equal(asked.length,0,'cards are built only when the stage opens');
 const step=find(s2,'ft-route-step').find(x=>x.dataset.stage==='FAR-STRAIGHT-ATTDEF');step.toggle();
 const WITH=Object.keys(V42_WORKOUTS);
 assert.equal(WITH.length,4);
 assert.deepEqual(asked,WITH.map(id=>[id,'FAR-STRAIGHT-ATTDEF']),'once each, in order');
 assert.equal(find(step,'ft-v42-stage-task').length,0);
 const content=find(step,'ft-v42-programs')[0];
 assert.deepEqual(content.children.map(c=>c.dataset.program),WITH,'only the four cards, directly in the stage list');
 assert.equal(find(step,'ft-v42-program').length,0,'no source program cards, no parent card');
 // other stages keep their summary and read-only program cards
 const other=find(s2,'ft-route-step').find(x=>x.dataset.stage!=='FAR-STRAIGHT-ATTDEF'&&M.sections[1].stages.find(t=>t.id===x.dataset.stage).task);other.toggle();
 assert.equal(find(other,'ft-v42-stage-task').length,1);
 const cards=find(other,'ft-v42-program');
 assert.equal(cards.length,M.sections[1].stages.find(t=>t.id===other.dataset.stage).programs.length);
 cards.forEach(c=>c.toggle());
 for(const c of cards){assert.equal(find(c,'ft-v42-notice')[0].textContent,V42_NO_ROUNDS_NOTICE);assert.ok(find(c,'ft-v42-chip').every(x=>x.textContent==='Повторение'));}
});

test('one Tree lesson card implementation serves both the Tree and the methodology tab',()=>{
 const app=readFileSync(new URL('../app/js/app.js',import.meta.url),'utf8');
 assert.equal(app.split("lesson.className='ft-route-lesson'").length-1,1);
 assert.ok(app.includes('const lesson=ftLessonCard(workout,node.id,list)'));
 assert.ok(app.includes('lessonCard:(workout,stageId)=>ftLessonCard(workout,stageId,list)'));
 assert.ok(!/ft-v42-(add|round|workout|intro)/.test(app+readFileSync(new URL('../app/styles/methodology-v42.css',import.meta.url),'utf8')),'no bespoke blocks left');
});
