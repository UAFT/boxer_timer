import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {METHODOLOGY_V42 as M} from '../app/js/library/methodology-v42-data.js';
import {renderMethodologyV42,renderProgramBody,V42_NO_ROUNDS_NOTICE} from '../app/js/library/methodology-v42-view.js';
import {V63_SUBSTAGES,V63_STAGE_TITLES,openingStraight} from '../app/js/library/methodology-v63-structure.js';

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
const ORDER23=['FT-S9-STEPBACK-HEAD','FT-S9-STEPBACK-BODY','FT-S9-STEPBACK-MIXED','PRG-FAR-STRAIGHT-1','FT-S9-PALM-BODY','FT-S9-PALM-MIXED',
 'FT-S9-BENT-HEAD','FT-S9-BODY-BENT-ARM','FT-S9-BENT-MIXED','FT-S9-PULLBACK','FT-S9-PULLBACK-BODY','FT-S9-PULLBACK-MIXED','FT-S9-ELBOW-HEAD','FT-S9-ELBOW-BODY','FT-S9-DOUBLE-ELBOW',
 'FT-S9-VAR-LEFT-HEAD','FT-S9-VAR-LEFT-BODY','FT-S9-VAR-RIGHT-HEAD','FT-S9-VAR-RIGHT-BODY',
 'FT-S9-VAR2-LEFT-HEAD-BODY','FT-S9-VAR2-LEFT-BODY-HEAD','FT-S9-VAR2-RIGHT-HEAD-BODY','FT-S9-VAR2-RIGHT-BODY-HEAD'];
const ORDER10=['FT-S10-ANS-STEPBACK','FT-S10-ANS-PALM','FT-S10-ANS-BENT','FT-S10-ANS-PULL','FT-S10-ANS-PULLSTEP','FT-S10-ANS-ELBOW','FT-S10-ANS-PARRY','FT-S10-ANS-PARRY-BACK','FT-S10-ANS-PARRY-BREAK','FT-S10-ANS-PARRY-SIDE',
 'FT-S10-ANS-BODYPARRY-SPOT','FT-S10-ANS-BODYPARRY-BACK','FT-S10-ANS-BODYPARRY-BREAK','FT-S10-ANS-BODYPARRY-SIDE','FT-S10-ANS-MIXED','FT-S10-ANS-MIXED-BODYPARRY'];
const ORDER9=[...ORDER23,'FT-S9-PARRY','FT-S9-PARRY-BODY'];
const ORDER61=['FT-S10-V61-PARRY-UP-SPOT','FT-S10-V61-PARRY-UP-BACK','FT-S10-V61-PARRY-UP-SIDE','FT-S10-V61-PARRY-OUT-SPOT','FT-S10-V61-PARRY-OUT-BACK','FT-S10-V61-PARRY-OUT-SIDE',
 'FT-S10-V61-SLIP-OUT-SPOT','FT-S10-V61-SLIP-OUT-BACK','FT-S10-V61-SLIP-OUT-RETREAT','FT-S10-V61-SLIP-OUT-STEPRET','FT-S10-V61-SLIP-OUT-SIDE','FT-S10-V61-SLIP-OUT-DIAG'];
const S10=[...ORDER10,...ORDER61];
const own=stage=>Object.keys(V42_WORKOUTS).filter(id=>V42_WORKOUTS[id].stageId===stage);
const W=V42_WORKOUTS['PRG-FAR-STRAIGHT-1'];
const P1=programs.find(p=>p.id==='PRG-FAR-STRAIGHT-1');

test('owner program «Прямой и подставка: шаг назад»: 15 rounds 2:00/1:00, no trailing rest, 44:00 through the Tree adapter and real compiler',()=>{
 assert.deepEqual(Object.keys(V42_WORKOUTS),[...ORDER9,...S10],'V51: 15 matrix programs (defence × head/body/mixed), then V50 and V51 microprograms; V57: + parry; V54–V57: stage 10');
 assert.deepEqual(own('FAR-STRAIGHT-ATTDEF'),ORDER9);assert.deepEqual(own('FAR-STRAIGHT-COUNTER'),S10);
 assert.ok(!V42_WORKOUTS['FT-S9-STEP-BACK'],'the V47 combined step-back program is superseded (V48)');
 assert.equal(ORDER23.reduce((s,id)=>s+V42_WORKOUTS[id].rounds.length,0),220);
 assert.equal(Object.values(V42_WORKOUTS).reduce((s,w)=>s+w.rounds.length,0),238+142+72,'V59: stage 9 — 25 programs / 238 rounds, stage 10 — 16 programs / 142 rounds; V61: + 12 programs / 72 rounds');
 assert.equal(W.name,'Прямые в голову — подставка открытой ладонью');
 assert.equal(P1.title,'Прямой и подставка; шаг назад','methodology title untouched');
 assert.equal(W.rounds.length,15);
 assert.deepEqual(W.blocks.map(b=>b[1]),[1,3,4,3,4]);
 assert.ok(W.rounds.every(r=>r.workSec===120&&r.restSec===60));
 assert.equal(workoutTotalSec(W),44*60);
 const stage=stageForWorkout(W);
 assert.equal(stage.title,'Бокс — Прямые в голову — подставка открытой ладонью');
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
  assert.ok(d.endsWith('С партнёром (по желанию): ученик бьёт, партнёр подставляет открытую ладонь '+palm+' руки.'),i);
  assert.ok(d.includes(guard+' перчатка весь раунд у подбородка'),i);
  assert.ok(d.includes('партнёр не обязателен'),i);
  assert.ok(!/шаг назад|париров|отбив|контрудар|ответн|исходном упражнен|источник/i.test(r.name+d),i);
  assert.ok((r.stance+' · '+d).length<=600,i);
  assert.equal(r.cue,r.stance);
 }
});

const SRC9=M.sections[1].stages.find(t=>t.id==='FAR-STRAIGHT-ATTDEF');
const LS='левосторонняя стойка',RS='правосторонняя стойка';
const timed=(w,n,min,stage='FAR-STRAIGHT-ATTDEF',parry=false)=>{   // parry: V56 owner canon allows «отбив» in the parry program only
 assert.equal(w.stageId,stage);
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
  assert.ok(!(parry?/париров|двойн\S* шаг|уклон|смена ролей|весь раунд, Б|сначала шаг|исходном упражнен|источник|контрудар/i:/париров|отбив|двойн\S* шаг|уклон|смена ролей|весь раунд, Б|сначала шаг|исходном упражнен|источник|контрудар/i).test(r.name+r.description),r.name);
 }
};
const crit1=Object.fromEntries(P1.criteria),M1={technique:crit1['Техника'],tactics:crit1['Тактика'],execution:crit1['Особенности выполнения'],typicalMistakes:crit1['Типичные ошибки']};

test('program 2 (source #3): 13 rounds, 38:00; program 1 movement families minus the rear short step, body target, bent arm opposite to the strike',()=>{
 const w=V42_WORKOUTS['FT-S9-BODY-BENT-ARM'];timed(w,13,38);
 assert.equal(w.name,'Прямые в корпус — подставка согнутой руки');
 assert.deepEqual(w.methodology,M1,'same source program fields, verbatim');
 const plan=PLAN.filter((_,i)=>i!==5&&i!==12);
 for(const [i,[st,hand,foot,move,kind,trail]] of plan.entries()){
  const r=w.rounds[i],d=r.description,h=hand.slice(0,-2)+'ая';
  assert.equal(r.stance,st==='L'?LS:RS,i);assert.equal(r.hand,hand,i);
  assert.equal(r.name,TITLES[W.rounds.indexOf(W.rounds.find((x,j)=>PLAN[j]===plan[i]))].replace(/^Прямой (левой|правой) /,'Прямой $1 в туловище '),i);
  assert.ok(d.endsWith('ученик бьёт, партнёр подставляет согнутую в локте '+(hand==='левой'?'правую':'левую')+' руку.'),i);
  assert.ok(!/ладон|в голову|шаг назад/.test(d),i);
  if(kind==='still'){assert.ok(d.startsWith('Без шага, ноги остаются на месте. Прямой левой в туловище'));continue;}
  const f=foot.split(' ')[1];
  assert.ok(d.startsWith(foot+' нога '+move+', одновременно прямой '+hand+' в туловище: кулак достигает цели в момент постановки '+gen(f)+' ноги.'),i);
  if(kind==='return')assert.ok(d.includes('Затем '+h+' рука возвращается к подбородку синхронно с возвратом '+gen(f)+' ноги в исходное положение'),i);
  else assert.ok(d.includes('Затем '+trail+' нога подтягивается синхронно с возвратом '+hand+' руки к подбородку')&&d.includes('в исходную точку не возвращаетесь'),i);
 }
});

test('V49 matrix cells (V51 approved): counts, attack target per program, mixed order L head, R head, L body, R body, body level, defence hand and partner zone',()=>{
 const C={'FT-S9-STEPBACK-HEAD':[8,23,'h'],'FT-S9-STEPBACK-BODY':[8,23,'b'],'FT-S9-STEPBACK-MIXED':[16,47,'m'],'FT-S9-PALM-BODY':[8,23,'b'],'FT-S9-PALM-MIXED':[16,47,'m'],
  'FT-S9-BENT-HEAD':[8,23,'h'],'FT-S9-BENT-MIXED':[16,47,'m'],'FT-S9-PULLBACK-BODY':[8,23,'b'],'FT-S9-PULLBACK-MIXED':[16,47,'m'],'FT-S9-ELBOW-HEAD':[8,23,'h'],'FT-S9-ELBOW-BODY':[8,23,'b']};
 const tgt=n=>/в корпус/.test(n)?'b':/в голову/.test(n)?'h':'?';
 for(const [id,[n,min,kind]] of Object.entries(C)){
  const w=V42_WORKOUTS[id];timed(w,n,min);
  assert.ok(!/ЧЕРНОВИК/.test(JSON.stringify(w)),id);
  const t=w.rounds.map(r=>tgt(r.name)),h=w.rounds.map(r=>r.hand);
  if(kind!=='m')assert.ok(t.every(x=>x===kind),id);
  else for(let i=0;i<n;i+=4)assert.deepEqual([...t.slice(i,i+4)].join()+h.slice(i,i+4).join(),'h,h,b,b'+'левой,правой,левой,правой',id+i);
  w.rounds.forEach((r,i)=>{const d=r.description,body=t[i]==='b';
   assert.equal(/уровень ниже (за счёт )?сгибани\S* ног, таз поворачивается/.test(d),body,'body level: '+id+i);
   const opp=r.hand==='левой'?'правой':'левой';
   if(/PALM/.test(id))assert.ok(d.includes('подставка открытой ладони '+opp+' руки у подбородка')&&d.endsWith('прямым '+r.hand+' в голову, ученик защищается.'),id+i);
   if(/BENT-/.test(id))assert.ok(d.includes('подставка согнутой '+opp+' руки к ')&&d.endsWith('прямым '+r.hand+' в корпус, ученик защищается.'),id+i);
   if(id==='FT-S9-ELBOW-HEAD')assert.ok(d.includes('двойная локтевая защита головы')&&d.endsWith('прямым в голову, ученик защищается.'),id+i);
   if(id==='FT-S9-ELBOW-BODY')assert.ok(d.includes('двойная локтевая защита корпуса')&&d.endsWith('прямым в корпус, ученик защищается.'),id+i);
   if(/STEPBACK/.test(id))assert.ok(d.indexOf('прямой '+r.hand)<d.indexOf('отход одним шагом назад'),'attack first, then the step back: '+id+i);
   if(/PULLBACK-/.test(id))assert.ok(/оттяжк/.test(d)&&!/шагает (вправо|влево)/.test(d),id+i);
  });
 }
 // step back: both stances, no lateral steps
 for(const id of ['FT-S9-STEPBACK-HEAD','FT-S9-STEPBACK-BODY','FT-S9-STEPBACK-MIXED']){const w=V42_WORKOUTS[id];
  assert.deepEqual([...new Set(w.rounds.map(r=>r.stance))],[LS,RS]);assert.ok(w.rounds.every(r=>!/шагает (вправо|влево)/.test(r.description)),id);}
});

test('V51 microprograms: two straights of the same hand from the spot, then one defence in the V50 order; 6 rounds, 17:00, independent blocks',()=>{
 const T=['отход шагом назад','подставка ладони','подставка согнутой руки','оттяжка назад','защита головы','защита корпуса'];
 const Z=['в голову','в голову','в корпус','в голову','в голову','в корпус'];
 for(const [id,hand,t1,t2] of [['FT-S9-VAR2-LEFT-HEAD-BODY','левой','в голову','в корпус'],['FT-S9-VAR2-LEFT-BODY-HEAD','левой','в корпус','в голову'],
   ['FT-S9-VAR2-RIGHT-HEAD-BODY','правой','в голову','в корпус'],['FT-S9-VAR2-RIGHT-BODY-HEAD','правой','в корпус','в голову']]){
  const w=V42_WORKOUTS[id];timed(w,6,17);assert.equal(w.blocks.length,1);
  w.rounds.forEach((r,i)=>{const d=r.description;
   assert.equal(r.name,'Два прямых '+hand+': '+t1+', '+t2+' — '+T[i]);assert.equal(r.hand,hand);
   assert.ok(d.startsWith('Без шага, ноги на месте: два прямых '+hand+' подряд. Первый '+t1+'.'),id+i);
   const second=d.indexOf('. Второй '+t2+'.');assert.ok(second>0&&d.indexOf('Рука возвращается к подбородку')<second,'return to guard before the second punch: '+id+i);
   assert.equal((d.match(/уровень ниже за счёт сгибания ног, таз поворачивается/g)||[]).length,1,'one body punch, level lowered by the legs: '+id+i);
   if(t1==='в корпус')assert.ok(d.slice(0,second).includes('уровень восстанавливается'),'level back before the head punch: '+id+i);
   assert.ok(d.endsWith('после удара партнёр отвечает прямым '+Z[i]+', ученик защищается.'),id+i);
   assert.ok(!/с шагом|шагает вперёд|шагает вправо|шагает влево/.test(d.slice(0,second+12)),'stationary attack');});
 }
 const all=compileProgram(ORDER23.slice(19).map(id=>stageForWorkout(V42_WORKOUTS[id])),PRESETS,{cycles:1});
 assert.equal(all.length,24,'blocks are appended by the coach, nothing is pre-joined');
});

test('V50 microprograms: 6 rounds, 17:00 each, stationary punch, the defence changes every round in the owner order',()=>{
 const T=['отход шагом назад','подставка ладони','подставка согнутой руки','оттяжка назад','защита головы','защита корпуса'];
 const Z=['в голову','в голову','в корпус','в голову','в голову','в корпус'];
 for(const [id,title,hand,target] of [['FT-S9-VAR-LEFT-HEAD','Левый прямой в голову — вариативная защита','левой','в голову'],['FT-S9-VAR-LEFT-BODY','Левый прямой в корпус — вариативная защита','левой','в корпус'],
   ['FT-S9-VAR-RIGHT-HEAD','Правый прямой в голову — вариативная защита','правой','в голову'],['FT-S9-VAR-RIGHT-BODY','Правый прямой в корпус — вариативная защита','правой','в корпус']]){
  const w=V42_WORKOUTS[id];timed(w,6,17);assert.equal(w.name,title);
  const opp=hand==='левой'?'правой':'левой';
  w.rounds.forEach((r,i)=>{const d=r.description;
   assert.equal(r.name,'Прямой '+hand+' '+target+' — '+T[i]);assert.equal(r.hand,hand);assert.equal(r.stance,LS);
   assert.ok(d.startsWith('Без шага, ноги на месте: прямой '+hand+' '+target+'.'),'stationary attack first: '+id+i);
   assert.equal(/уровень ниже за счёт сгибания ног, таз поворачивается/.test(d),target==='в корпус');
   assert.ok(d.includes('В правосторонней стойке — зеркально.'));
   assert.ok(d.endsWith('после удара партнёр отвечает прямым '+Z[i]+', ученик защищается.'),'partner threat matches the defended zone: '+id+i);
   assert.ok(!/с шагом|шагает вперёд|шагает вправо|шагает влево/.test(d),'no attacking footwork');});
  const d=w.rounds.map(r=>r.description);
  assert.ok(d[0].includes('Затем')&&d[0].includes('отход одним шагом назад: задняя правая нога шагает назад, левая подтягивается'));
  assert.ok(d[1].includes('подставка открытой ладони '+opp+' руки у подбородка'));
  assert.ok(d[2].includes('подставка согнутой '+opp+' руки к '+(hand==='левой'?'правому':'левому')+' боку'));
  assert.ok(d[3].includes('рука возвращается к подбородку одновременно с оттяжкой назад'));
  assert.ok(d[4].includes('двойная локтевая защита головы')&&d[5].includes('двойная локтевая защита корпуса'));
 }
 // the coach joins microprograms in the timer: each keeps its own rests, the timer adds its usual 60 s between programs
 const two=compileProgram([stageForWorkout(V42_WORKOUTS['FT-S9-VAR-LEFT-HEAD']),stageForWorkout(V42_WORKOUTS['FT-S9-VAR-RIGHT-HEAD'])],PRESETS,{cycles:1});
 assert.equal(two.length,12);assert.equal(two[5].restSec,60);assert.equal(two.at(-1).restSec,0);
 const four=compileProgram(['FT-S9-VAR-LEFT-HEAD','FT-S9-VAR-LEFT-BODY','FT-S9-VAR-RIGHT-HEAD','FT-S9-VAR-RIGHT-BODY'].map(id=>stageForWorkout(V42_WORKOUTS[id])),PRESETS,{cycles:1});
 assert.equal(four.length,24);assert.equal(four.reduce((s,r)=>s+r.workSec+r.restSec,0),71*60,'joined: 24 rounds, 23 rests');
});

test('program 4 (owner V45): pullback, left stance, head only, 8 rounds, 23:00; 3/7 step back with the pullback then return, 4/8 step back with the pullback then the lead foot follows',()=>{
 const w=V42_WORKOUTS['FT-S9-PULLBACK'];timed(w,8,23);
 assert.equal(w.name,'Прямые в голову — защита оттяжкой назад');
 assert.ok(Object.values(w.methodology).every(Boolean)&&Object.keys(w.methodology).length===4);
 assert.ok(w.rounds.every(r=>r.stance===LS&&/оттяжк/.test(r.description)&&!/в туловище/.test(r.description)));
 assert.ok(w.rounds.every(r=>r.description.endsWith('С партнёром: ученик бьёт и оттяжкой уходит от ответного прямого партнёра.')),'paired drill is a description, not a round');
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

test('double elbow guard (V47 #5): 16 rounds, 47:00; every attack is a straight to the head, head/body is the defended zone; both stances mirrored in one text',()=>{
 const w=V42_WORKOUTS['FT-S9-DOUBLE-ELBOW'];timed(w,16,47);
 assert.equal(w.name,'Прямые удары — двойная локтевая защита головы и корпуса');
 assert.ok(Object.values(w.methodology).every(Boolean)&&Object.keys(w.methodology).length===4);
 const V=[['с места',null,null],['с шагом вперёд и возвратом',['передняя левая шагает вперёд','передняя правая шагает вперёд'],['передняя левая шагает вперёд','передняя правая шагает вперёд']],
  ['с шагом SIDE и возвратом',['задняя правая шагает вправо','задняя левая шагает влево'],['передняя левая шагает влево','передняя правая шагает вправо']],
  ['со смещением SIDE',['задняя правая шагает вправо, передняя левая подтягивается','задняя левая шагает влево, передняя правая подтягивается'],['передняя левая шагает влево, задняя правая подтягивается','передняя правая шагает вправо, задняя левая подтягивается']]];
 let i=0;
 for(const [vt,left,right] of V)for(const zone of ['головы','корпуса'])for(const hand of ['левой','правой']){
  const r=w.rounds[i++],d=r.description,feet=hand==='левой'?left:right;
  const side=hand==='левой'?'вправо':'влево';
  assert.equal(r.name,'Прямой '+hand+' '+vt.replace('SIDE',side)+' — защита '+zone,'left-lead direction explicit: '+i);assert.equal(r.hand,hand);
  assert.ok(d.includes('прямой '+hand+' в голову'),'attack always to the head: '+i);
  assert.ok(!/прямой (левой|правой) в корпус,/.test(d.split('С партнёром')[0]),i);
  assert.ok(d.includes('двойная локтевая защита '+zone),i);
  assert.ok(d.endsWith('С партнёром: после удара партнёр бьёт прямой '+(zone==='головы'?'в голову':'в корпус')+', ученик принимает его на защиту.'),'incoming attack matches the defended zone: '+i);
  if(!feet){assert.ok(d.startsWith('Без шага'));continue;}
  assert.ok(d.includes('Левосторонняя стойка: '+feet[0]+'. Правосторонняя — зеркально: '+feet[1]+'.'),i);
  assert.ok(d.includes(vt==='со смещением SIDE'?'Стойка остаётся на новом месте, вне линии атаки':'Шагнувшая нога возвращается на линию атаки'),i);
 }
 assert.ok(!/париров|отбив/.test(JSON.stringify(w)));
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

test('V63 stage 9: substages 9.1–9.4 by the trainee\'s opening straight + «Комбинированная работа»; every training exactly once, whole; book cards visible',()=>{
 const doc=mockDoc();const asked=[];
 const root=renderMethodologyV42(doc,M,{workouts:V42_WORKOUTS,lessonCard:(w,stageId)=>{asked.push([w.id,stageId]);const c=doc.createElement('div');c.className='ft-route-lesson';return c;}});
 const s2=find(root,'ft-route-section')[1];s2.toggle();
 const step=find(s2,'ft-route-step').find(x=>x.dataset.stage==='FAR-STRAIGHT-ATTDEF');step.toggle();
 assert.equal(find(step.children[0],'ft-route-step-title')[0].textContent,'Одиночные прямые: атака и защита','stage 9 name unchanged');
 assert.equal(asked.length,0,'trainings are built only when their substage opens');
 const WITH=own('FAR-STRAIGHT-ATTDEF');assert.equal(WITH.length,25);
 const subs=find(step,'ft-v42-program').filter(c=>c.dataset.program.startsWith('S9-'));
 assert.deepEqual(subs.map(c=>find(c,'ft-v42-program-title')[0].textContent),['9.1 Прямой левой в голову','9.2 Прямой правой в голову','9.3 Прямой левой в корпус','9.4 Прямой правой в корпус','Комбинированная работа']);
 subs.forEach(c=>c.toggle());
 const shown=subs.flatMap(c=>find(c,'ft-route-lesson').map(l=>l.dataset.program));
 assert.deepEqual([...shown].sort(),[...WITH].sort(),'all 25, none lost');assert.equal(new Set(shown).size,25,'none duplicated');
 assert.equal(asked.length,25,'each training built once');
 assert.deepEqual(subs.map(c=>find(c.children[0],'ft-v42-stage-count')[0].textContent),['1 трен.','1 трен.','1 трен.','1 трен.','21 трен.']);
 assert.equal(subs.reduce((n,c)=>n+find(c,'ft-route-lesson').reduce((m,l)=>m+V42_WORKOUTS[l.dataset.program].rounds.length,0),0),238,'238 rounds');
 // single groups hold only programs whose every round opens with that literal straight (stance never mirrors the hand name)
 for(const [c,g] of subs.slice(0,4).map((c,i)=>[c,['LH','RH','LB','RB'][i]]))
  for(const l of find(c,'ft-route-lesson'))assert.ok(V42_WORKOUTS[l.dataset.program].rounds.every(r=>openingStraight(r)===g),l.dataset.program);
 // V51 two-straight programs are not labelled single: they stay whole in the combined substage
 assert.ok(find(subs[4],'ft-route-lesson').map(l=>l.dataset.program).filter(id=>id.includes('VAR2')).length===4);
 // references: rounds of the combined programs with this opening straight, by number; not counted as trainings
 const refs=subs.slice(0,4).map(c=>find(c,'ft-v42-aliases')[0].children.map(li=>li.textContent));
 assert.ok(refs[0].includes('Прямые в голову — подставка открытой ладонью — раунды 1, 2, 3, 4, 9, 10, 11'));
 assert.ok(refs[3].includes('Прямые в корпус — подставка согнутой руки — раунды 5, 6, 7, 11, 12, 13'));
 assert.deepEqual(refs.map(r=>r.reduce((n,t)=>n+t.split(', ').length,0)),[51,52,43,42],'V62 matrix: 57/58/49/48 rounds minus the 6 of each single program');
 const books=find(step,'ft-v42-program').filter(c=>!c.dataset.program.startsWith('S9-'));
 assert.deepEqual(books.map(c=>c.dataset.program),SRC9.programs.map(p=>p.id),'four book cards visible again, book order');
 books.forEach(c=>c.toggle());assert.equal(books.reduce((n,c)=>n+find(c,'ft-v42-exercise').length,0),31,'31 book exercises');
});

test('one Tree lesson card implementation serves both the Tree and the methodology tab',()=>{
 const app=readFileSync(new URL('../app/js/app.js',import.meta.url),'utf8');
 assert.equal(app.split("lesson.className='ft-route-lesson'").length-1,1);
 assert.ok(app.includes('const lesson=ftLessonCard(workout,node.id,list)'));
 assert.ok(app.includes('lessonCard:(workout,stageId)=>ftLessonCard(workout,stageId,list)'));
 assert.ok(!/ft-v42-(add|round|workout|intro)/.test(app+readFileSync(new URL('../app/styles/methodology-v42.css',import.meta.url),'utf8')),'no bespoke blocks left');
});

test('V53: section header counts stages; each stage row has a chip with the cards that stage shows (trainings with rounds vs read-only programs)',()=>{
 for(const opts of [{workouts:V42_WORKOUTS,lessonCard:()=>{const c=mockDoc().createElement('div');c.className='ft-route-lesson';return c;}},{}]){
  const root=renderMethodologyV42(mockDoc(),M,opts);const heads=[];
  for(const s of find(root,'ft-route-section')){
   const counter=find(s,'ft-v42-count')[0].textContent;
   s.toggle();const steps=find(s,'ft-route-step');
   assert.equal(counter,String(steps.length),s.dataset.section);heads.push(Number(counter));
   for(const st of steps){
    const head=st.children[0],chip=find(head,'ft-v42-stage-count')[0];
    assert.deepEqual(head.children.map(c=>c.className.split(' ')[0]),['ft-route-step-dot','ft-route-step-title','ft-v42-stage-count','ft-route-chevron'],'chip sits right, before the chevron');
    st.toggle();find(st,'ft-v42-program').forEach(c=>c.toggle());   // V58: trainings may sit inside a substage card
    const lessons=find(st,'ft-route-lesson').length,programs=find(st,'ft-v42-program').length;
    assert.ok(!(lessons&&programs)||find(st,'ft-v42-substage').length,'a stage shows trainings or programs; both only through substages');
    if(lessons){assert.equal(chip.textContent,lessons+' трен.');assert.ok(chip.className.includes('ft-v42-stage-count-run'));}
    else assert.equal(chip.textContent,programs+' прогр.',st.dataset.stage);
   }
  }
  assert.deepEqual(heads,[8,19,5,8,3,7,4],'original stage counts');
  if(opts.lessonCard){const s2=find(root,'ft-route-section')[1];const st9=find(s2,'ft-route-step').find(x=>x.dataset.stage==='FAR-STRAIGHT-ATTDEF');
   assert.equal(find(st9.children[0],'ft-v42-stage-count')[0].textContent,'25 трен.');
   const st10=find(s2,'ft-route-step').find(x=>x.dataset.stage==='FAR-STRAIGHT-COUNTER');
   assert.equal(find(st10.children[0],'ft-v42-stage-count')[0].textContent,'28 трен.','V54–V61: stage 10 chip counts its runnable trainings (inside the first substage)');
   assert.equal(find(s2,'ft-v42-stage-count').filter(c=>!c.className.includes('-run')).reduce((n,c)=>n+parseInt(c.textContent),0),71-6,'non-run chips: the other 18 stages, stage 10 counts trainings');}
 }
});

test('V54–V57 stage 10: step-back module 12 rounds (V55 forward diagonals), five 8-round response modules, V56 8-round inside parry, V57 three 8-round parry footwork modules + one 16-round integration program; defence first, then one answering straight',()=>{
 const LS='левосторонняя стойка',ORD=[['левой','в голову',0],['правой','в голову',0],['левой','в корпус',0],['правой','в корпус',0],['левой','в голову',1],['правой','в голову',1],['левой','в корпус',1],['правой','в корпус',1]];
 const T=['Шаг назад с выставлением передней руки','Подставка открытой ладони','Подставка согнутой руки','Оттяжка туловищем без шага','Оттяжка с шагом назад','Двойная локтевая защита'];
 const ok=(d,id,parry=false)=>{assert.ok(d.indexOf('Защита')>=0&&d.indexOf('Защита')<d.indexOf('ответный прямой'),'defence before the answer: '+id);
  assert.ok(d.includes('Ответ — после защиты, не вместе с ударом.')&&(/бой с тенью, зеркало или мешок|Без партнёра — тень, зеркало, мешок/.test(d)||/ по диагонали вперёд-/.test(d))&&d.endsWith('В правосторонней стойке — зеркально.'),id);
  assert.ok(!(parry?/встречн|уклон|париров|кнаружи/i:/встречн|уклон|париров|отбив/i).test(d),'no counter/slip (parry only in parry rounds): '+id);};
 ORDER10.slice(0,6).forEach((id,k)=>{const w=V42_WORKOUTS[id];
  if(k===0){timed(w,12,35,'FAR-STRAIGHT-COUNTER');assert.deepEqual(w.blocks,[['С места',4],['С шагом вперёд',4],['По диагонали вперёд',4]]);}
  else{timed(w,8,23,'FAR-STRAIGHT-COUNTER');assert.deepEqual(w.blocks,[['С места',4],['С шагом вперёд',4]]);}
  w.rounds.slice(0,8).forEach((r,i)=>{const [h,t,f]=ORD[i],d=r.description;ok(d,id+i);assert.equal(r.stance,LS);assert.equal(r.hand,h);
   assert.equal(r.name,T[k]+' — ответ '+h+' '+t+(f?' с шагом вперёд':' с места'));
   assert.ok(d.includes('ответный прямой '+h+' '+t+(f?' с шагом вперёд: кулак у цели при постановке передней ноги, задняя подтягивается':' с места')),id+i);
   assert.equal(d.includes('В корпус: ниже сгибанием ног, поворот таза'),t==='в корпус');
   assert.equal(d.includes('с места — координация с новой позиции, удар может не доставать'),!f&&(k===0||k===4),'stationary after a retreat is a coordination drill: '+id+i);
   if(k===1||k===2)assert.ok(/После его (лев|прав)ого отвечает защищавшая рука, после (лев|прав)ого — другая\./.test(d),'same and opposite hand: '+id+i);
   assert.ok(d.startsWith(k===5?'Партнёр по кругу: левой в голову, правой в голову, левой в корпус, правой в корпус.':'Партнёр поочерёдно: прямой левой и прямой правой '+(k===2?'в корпус.':'в голову.')),'incoming alternates, target matches the guard: '+id+i);});});
 // V56: basic inside parry on the spot, exactly the owner's 8 rounds
 const P=V42_WORKOUTS['FT-S10-ANS-PARRY'];timed(P,8,23,'FAR-STRAIGHT-COUNTER',true);assert.deepEqual(P.blocks,[['От прямого левой',4],['От прямого правой',4]]);
 const PO=[['левой','правой','в голову'],['левой','левой','в голову'],['левой','правой','в корпус'],['левой','левой','в корпус'],['правой','левой','в голову'],['правой','правой','в голову'],['правой','левой','в корпус'],['правой','правой','в корпус']];
 P.rounds.forEach((r,i)=>{const [inc,ans,t]=PO[i],par=inc==='левой'?'правой':'левой',same=ans===par,d=r.description;assert.equal(r.hand,ans);
  assert.equal(r.name,'Отбив внутрь '+par+' от прямого '+inc+' — ответ '+ans+' '+t+(same?' (та же рука)':' (другая рука)'));
  assert.ok(d.startsWith('Партнёр: прямой '+inc+' в голову. Защита — отбив внутрь: в последний момент '+par.slice(0,-2)+'ая открытая перчатка по предплечью уводит его '+inc.slice(0,-2)+'ую внутрь, к его свободной '+par+' руке'),'owner canon: inside parry by the opposite hand: '+i);
  assert.ok(d.indexOf('отбив внутрь')<d.indexOf('ответный прямой '+ans+' '+t+' с места')&&d.includes('Ответ — после отбива, не вместе с ударом.')&&d.includes('Не подставка'),i);
  assert.ok(!/кнаружи|наружу|шаг назад|шагом|встречн|уклон/.test(d),'stationary inside parry only: '+i);assert.equal(d.includes('В корпус: ниже сгибанием ног'),t==='в корпус');});
 // V55: rounds 9-12 — protective retreat, then the diagonal step FORWARD with the answer, then the other foot follows with the hand
 V42_WORKOUTS['FT-S10-ANS-STEPBACK'].rounds.slice(8).forEach((r,i)=>{const h=i<2?'левой':'правой',t=i%2?'в корпус':'в голову',d=r.description;ok(d,'DIAG'+i);
  const [foot,dir,follow]=i<2?['правая','вправо','Левая']:['левая','влево','Правая'];assert.equal(r.hand,h);
  assert.equal(r.name,'Шаг назад с выставлением передней руки — ответ '+h+' '+t+' с шагом по диагонали вперёд-'+dir);
  const a=d.indexOf('Партнёр: прямой '+h+' в голову.'),b=d.indexOf('Защита: шаг правой назад'),c=d.indexOf('партнёр промахивается'),e=d.indexOf('Затем '+foot+' нога по диагонали вперёд-'+dir+', одновременно ответный прямой '+h+' '+t),f=d.indexOf(follow+' нога подтягивается вместе с возвратом '+h+' руки к подбородку');
  assert.ok(a===0&&a<b&&b<c&&c<e&&e<f,'retreat, then the diagonal forward with the answer, then the follow-up: '+i);
  assert.ok(d.includes('Второго шага назад нет.')&&!/назад-(вправо|влево)/.test(d),'no backward diagonal: '+i);
  assert.equal(d.includes('В корпус: ниже сгибанием ног'),t==='в корпус');});
 const m=V42_WORKOUTS['FT-S10-ANS-MIXED'];timed(m,16,47,'FAR-STRAIGHT-COUNTER',true);assert.deepEqual(m.blocks,[['Ответы в голову',8],['Ответы в корпус',8]]);
 const Z=['Шаг назад с выставлением передней руки','Подставка открытой ладони','Подставка согнутой руки','Оттяжка туловищем без шага','Оттяжка с шагом назад','Двойная локтевая защита головы','Двойная локтевая защита корпуса','Отбив внутрь на месте'];
 m.rounds.forEach((r,i)=>{const t=i<8?'в голову':'в корпус',d=r.description;ok(d,'MIX'+i,i%8===7);assert.equal(r.name,Z[i%8]+' — ответ левой и правой '+t);
  assert.ok(d.includes('ответный прямой по очереди левой и правой '+t+' с места'),'deterministic L/R answers: '+i);
  assert.ok(d.startsWith('Партнёр поочерёдно: прямой левой и прямой правой '+([2,6].includes(i%8)?'в корпус.':'в голову.')),'incoming target matches the guard: '+i);});
 for(const id of ORDER10){const t=V42_WORKOUTS[id].methodology;assert.deepEqual(Object.keys(t),['technique','tactics','execution','typicalMistakes']);
  assert.ok(/одновременно с ударом партнёра \(так нельзя: ответ — только после (защиты|отбива)\)/.test(t.typicalMistakes),'listed as an error, never as the sequence');
  assert.ok(!/одновременно с ударом/.test(t.technique+t.tactics+t.execution));}
 const all=compileProgram(ORDER10.map(id=>stageForWorkout(V42_WORKOUTS[id])),PRESETS,{cycles:1});
 assert.equal(all.length,142,'sixteen independent blocks, joined only by the coach');
 // V57: inside parry with footwork — same 8 pairings as V56; every protective step back starts with the rear right foot
 const FOOT={BACK:()=>'одновременно шаг задней правой назад; затем правая нога возвращается на место',BREAK:()=>'одновременно шаг задней правой назад, левая подтягивается полностью — дистанция разорвана',
  SIDE:inc=>inc==='левой'?'одновременно шаг правой вправо, левая подтягивается; поворот туловища на правой ноге влево':'одновременно шаг левой влево, правая подтягивается; поворот туловища на левой ноге вправо'};
 const HOW={BACK:'с места',BREAK:'с шагом вперёд: кулак у цели с постановкой передней ноги',SIDE:'с новой позиции, смещение закончено'};
 for(const v of ['BACK','BREAK','SIDE']){const w=V42_WORKOUTS['FT-S10-ANS-PARRY-'+v];timed(w,8,23,'FAR-STRAIGHT-COUNTER',true);
  w.rounds.forEach((r,i)=>{const [inc,ans,t]=PO[i],par=inc==='левой'?'правой':'левой',same=ans===par,d=r.description;ok(d.replace('после отбива','после защиты'),v+i,true);assert.equal(r.hand,ans);
   assert.ok(d.startsWith('Партнёр: прямой '+inc+' в голову. Защита — отбив внутрь: '+par.slice(0,-2)+'ая открытая перчатка по предплечью уводит его '+inc.slice(0,-2)+'ую к его свободной '+par+' руке; '+FOOT[v](inc)),v+i);
   assert.ok(d.includes('Затем ответный прямой '+ans+' ('+(same?'той же рукой':'другой рукой')+') '+t+' '+HOW[v]),'answer after the defence: '+v+i);
   assert.ok(!/назад-(вправо|влево)|вперёд-(вправо|влево)/.test(d),'no diagonals in parry footwork: '+v+i);assert.equal(d.includes('В корпус: ниже сгибанием ног'),t==='в корпус');});}
});

test('V57/V59 stage 9: inside parry program — own straight, the partner answers with the same hand; parry on the spot, back+return, back+break, step right, step left; one solo round through all five',()=>{
 const w=V42_WORKOUTS['FT-S9-PARRY'];timed(w,9,26,'FAR-STRAIGHT-ATTDEF',true);
 assert.deepEqual(w.blocks,[['На месте',2],['Шаг назад и возврат',2],['Шаг назад, разрыв дистанции',2],['Смещение вправо и влево',2],['Смешанный раунд',1]]);
 const S=[['левой','на месте'],['правой','на месте'],['левой','с шагом назад и возвратом'],['правой','с шагом назад и возвратом'],['левой','с шагом назад, разрыв дистанции'],['правой','с шагом назад, разрыв дистанции'],['левой','со смещением вправо'],['правой','со смещением влево']];
 S.forEach(([h,v],i)=>{const r=w.rounds[i],d=r.description,par=h==='левой'?'правой':'левой';assert.equal(r.name,'Прямой '+h+' в голову — отбив внутрь '+par+' '+v);
  const own=d.indexOf('Свой прямой '+h+' в голову с места, рука возвращается к подбородку.'),inc=d.indexOf('Затем партнёр отвечает прямым '+h+' в голову.'),def=d.indexOf('Защита — отбив внутрь: '+par.slice(0,-2)+'ая открытая перчатка');
  assert.ok(own===0&&own<inc&&inc<def,'own attack, then the partner, then the parry: '+i);assert.ok(d.includes('бой с тенью, зеркало или мешок'));
  if(/назад/.test(v))assert.ok(d.includes('шаг задней правой назад'),'rear right foot first: '+i);});
 // V59: the solo round names the five variants in words, in order; no letter shorthand anywhere
 const mix=w.rounds[8].description;assert.equal(w.rounds[8].name,'Смешанный раунд: пять вариантов отбива по кругу');
 const at=['На месте: свой левой, отбив правой.','С возвратом: свой правой, отбив левой, шаг правой назад и обратно.','С разрывом дистанции: свой левой, отбив правой, шаг правой назад, левая подтягивается.',
  'Смещение вправо: свой левой, отбив правой, шаг правой вправо, левая подтягивается, поворот туловища.','Смещение влево: свой правой, отбив левой, шаг левой влево, правая подтягивается, поворот туловища.'].map(x=>mix.indexOf(x));
 assert.ok(at.every((x,i)=>x>0&&(i===0||x>at[i-1])),'five variants in order, one round');
 assert.ok(mix.startsWith('Без партнёра'));
 for(const x of Object.values(V42_WORKOUTS))assert.ok(!/[AА]–[EЕ]|\b[ABCDE] —/.test(JSON.stringify(x)),'no A–E shorthand: '+x.id);
});

test('V63 stage 10: answer programs by defence family, combined work whole, empty meeting-punch substage, all six book cards visible; stage 11 renamed, 13 book exercises',()=>{
 const doc=mockDoc();const asked=[];
 const root=renderMethodologyV42(doc,M,{workouts:V42_WORKOUTS,lessonCard:(w,stageId)=>{asked.push([w.id,stageId]);const c=doc.createElement('div');c.className='ft-route-lesson';return c;}});
 const s2=find(root,'ft-route-section')[1];s2.toggle();
 const st=find(s2,'ft-route-step').find(x=>x.dataset.stage==='FAR-STRAIGHT-COUNTER');st.toggle();
 assert.equal(find(st.children[0],'ft-route-step-title')[0].textContent,'Одиночные прямые: ответные, затем встречные','stage 10 name unchanged');
 assert.equal(find(st.children[0],'ft-v42-stage-count')[0].textContent,'28 трен.');
 const book=M.sections[1].stages.find(t=>t.id==='FAR-STRAIGHT-COUNTER');
 const subs=find(st,'ft-v42-program').filter(c=>c.dataset.program.startsWith('S10-'));
 assert.deepEqual(subs.map(c=>find(c,'ft-v42-program-title')[0].textContent),['Ответные после защиты шагом назад','Ответные после оттяжки','Ответные после подставок','Ответные после двойной локтевой защиты',
  'Ответные после отбивов на месте','Ответные после отбивов с шагом назад','Ответные после отбивов со смещением в сторону (смена угла)','Ответные после уклонов','Комбинированная работа','Встречные удары']);
 assert.equal(find(st,'ft-route-step').length,0,'substages are not numbered stages');
 subs.forEach(c=>c.toggle());
 const shown=subs.flatMap(c=>find(c,'ft-route-lesson').map(l=>l.dataset.program));
 assert.deepEqual([...shown].sort(),[...S10].sort(),'all 28');assert.equal(new Set(shown).size,28);
 assert.deepEqual(subs.map(c=>find(c,'ft-route-lesson').length),[1,2,2,1,4,6,4,6,2,0]);
 assert.equal(shown.reduce((n,id)=>n+V42_WORKOUTS[id].rounds.length,0),214);
 assert.deepEqual(find(subs[8],'ft-route-lesson').map(l=>l.dataset.program),['FT-S10-ANS-MIXED','FT-S10-ANS-MIXED-BODYPARRY']);
 const meet=subs[9];assert.equal(find(meet,'ft-v42-program-meta')[0].textContent,'Пока нет программ');assert.equal(find(meet.children[0],'ft-v42-stage-count').length,0,'no count chip on the empty substage');
 assert.ok(subs.slice(4,7).every(c=>find(c,'ft-v42-stage-task')[0].textContent.includes('расширение владельца')),'inside body parry marked as owner extension of the book outward parry');
 assert.ok(S10.every(id=>V42_WORKOUTS[id].programId==='PRG-FAR-STRAIGHT-2'),'programId kept (data unchanged)');
 const books=find(st,'ft-v42-program').filter(c=>!c.dataset.program.startsWith('S10-'));
 assert.deepEqual(books.map(c=>c.dataset.program),book.programs.map(p=>p.id),'six book cards, book order');
 books.forEach(c=>c.toggle());
 books.forEach((c,i)=>{assert.equal(find(c,'ft-v42-exercise').length,book.programs[i].exercises.length);assert.equal(find(c,'ft-route-lesson').length,0);});
 assert.deepEqual(book.programs[0].exercises.map(e=>e.id),['ROM-P1-S05','ROM-L2-01','ROM-L2-02','ROM-L2-03']);
 // stage 11: approved title, four book cards with 13 exercises, no trainings
 const s11=find(s2,'ft-route-step').find(x=>x.dataset.stage==='FAR-PARRY');
 assert.equal(find(s11.children[0],'ft-route-step-title')[0].textContent,'Защитные действия с переходом на ближнюю дистанцию');
 assert.equal(M.sections[1].stages.find(t=>t.id==='FAR-PARRY').title,'Отбивы и уклон назад от прямых','data untouched: title comes from the overlay');
 s11.toggle();const c11=find(s11,'ft-v42-program');c11.forEach(c=>c.toggle());
 assert.equal(c11.length,4);assert.equal(c11.reduce((n,c)=>n+find(c,'ft-v42-exercise').length,0),13);assert.equal(find(s11,'ft-route-lesson').length,0);
 // the other stages are unaffected by the overlay
 assert.deepEqual(Object.keys(V63_SUBSTAGES),['FAR-STRAIGHT-ATTDEF','FAR-STRAIGHT-COUNTER']);assert.deepEqual(Object.keys(V63_STAGE_TITLES),['FAR-PARRY']);
});

test('V63 opening straight: literal hand and target, matches the V62 per-round matrix (stage 9)',()=>{
 const n={};for(const id of own('FAR-STRAIGHT-ATTDEF'))for(const r of V42_WORKOUTS[id].rounds){const g=openingStraight(r)||'none';n[g]=(n[g]||0)+1;}
 assert.deepEqual(n,{LH:57,RH:58,LB:49,RB:48,none:26},'24 two-straight rounds + 2 mixed parry rounds have no single opening straight');
 const rs=V42_WORKOUTS['PRG-FAR-STRAIGHT-1'].rounds.filter(r=>r.stance.startsWith('правосторонняя'));assert.ok(rs.length&&rs.every(r=>openingStraight(r)[0]===(/левой/.test(r.name)?'L':'R')),'right stance keeps literal hand names');
});

test('V63 role labels: trainee and partner named explicitly; оттяжка belongs to the trainee in its own programs',()=>{
 for(const w of Object.values(V42_WORKOUTS))for(const r of w.rounds){assert.ok(!/(^|[^А-Яа-яЁё])[АБ]([^А-Яа-яЁё]|$)/.test(r.description),w.id+' '+r.name);assert.ok((r.stance+' · '+r.description).length<=600);}
 for(const id of ['FT-S9-PULLBACK','FT-S9-PULLBACK-BODY','FT-S9-PULLBACK-MIXED'])assert.ok(V42_WORKOUTS[id].rounds.every(r=>/оттяжк/.test(r.description.split('С партнёром')[0])&&r.description.endsWith('С партнёром: ученик бьёт и оттяжкой уходит от ответного прямого партнёра.')),id);
});

test('V59 body-level inside parry: stage 9 program (own straight to the body, partner answers to the body) and stage 10 four 8-round programs + compact mixed',()=>{
 // stage 9: separate program, head program kept
 const b=V42_WORKOUTS['FT-S9-PARRY-BODY'];timed(b,9,26,'FAR-STRAIGHT-ATTDEF',true);assert.equal(b.name,'Прямые в корпус — защита отбивом внутрь');
 const S=[['левой','на месте'],['правой','на месте'],['левой','с шагом назад и возвратом'],['правой','с шагом назад и возвратом'],['левой','с шагом назад, разрыв дистанции'],['правой','с шагом назад, разрыв дистанции'],['левой','со смещением вправо'],['правой','со смещением влево']];
 S.forEach(([h,v],i)=>{const r=b.rounds[i],d=r.description,par=h==='левой'?'правой':'левой';assert.equal(r.name,'Прямой '+h+' в корпус — отбив внутрь '+par+' '+v);
  const own=d.indexOf('Свой прямой '+h+' в корпус с места: ниже сгибанием ног, поворот таза'),inc=d.indexOf('Затем партнёр отвечает прямым '+h+' в корпус.'),
   def=d.indexOf('Защита — отбив внутрь предплечьем: '+par.slice(0,-2)+'ая опускается к корпусу и с поворотом туловища округло уводит его '+h.slice(0,-2)+'ую к его свободной '+par+' руке');
  assert.ok(own===0&&own<inc&&inc<def,'own body attack, then his body straight, then the forearm parry to his free arm: '+i);
  assert.ok(d.includes('голова закрыта другой перчаткой')&&!d.includes('ладон'),'not a palm block, head covered: '+i);
  if(/назад/.test(v))assert.ok(d.includes('шаг задней правой назад'));});
 assert.equal(b.rounds[8].name,'Смешанный раунд: пять вариантов отбива по кругу — удары в корпус');assert.ok(b.rounds[8].description.includes('отбить внутрь предплечьем'));
 // stage 10: the owner's exact matrix, body incoming, four footwork variants
 const PO=[['левой','правой','в голову'],['левой','левой','в голову'],['левой','правой','в корпус'],['левой','левой','в корпус'],['правой','левой','в голову'],['правой','правой','в голову'],['правой','левой','в корпус'],['правой','правой','в корпус']];
 const FW={SPOT:()=>'стопы на месте.',BACK:()=>'одновременно шаг задней правой назад; затем правая нога возвращается на место',BREAK:()=>'одновременно шаг задней правой назад, левая подтягивается — дистанция разорвана',
  SIDE:inc=>inc==='левой'?'одновременно шаг правой вправо, левая подтягивается, поворот туловища на правой ноге влево':'одновременно шаг левой влево, правая подтягивается, поворот туловища на левой ноге вправо'};
 const HOW={SPOT:'с места',BACK:'с места',BREAK:'с шагом вперёд: кулак у цели с постановкой ноги',SIDE:'после смещения, с новой позиции'};
 for(const v of ['SPOT','BACK','BREAK','SIDE']){const w=V42_WORKOUTS['FT-S10-ANS-BODYPARRY-'+v];timed(w,8,23,'FAR-STRAIGHT-COUNTER',true);assert.equal(w.programId,'PRG-FAR-STRAIGHT-2');
  w.rounds.forEach((r,i)=>{const [inc,ans,t]=PO[i],par=inc==='левой'?'правой':'левой',same=ans===par,d=r.description;assert.equal(r.hand,ans);
   assert.ok(d.startsWith('Партнёр: прямой '+inc+' в корпус. Защита — отбив внутрь предплечьем: '+par.slice(0,-2)+'ая опускается к корпусу и с поворотом туловища округло уводит его '+inc.slice(0,-2)+'ую к его свободной '+par+' руке; '+FW[v](inc)),v+i);
   assert.ok(d.includes('Затем ответный прямой '+ans+' ('+(same?'той же рукой':'другой рукой')+') '+t+' '+HOW[v]),'answer after the defence: '+v+i);
   assert.ok(d.includes('Ответ — после отбива, не вместе с ударом.')&&d.includes('Без партнёра')&&!/кнаружи|уклон|встречн/.test(d),v+i);
   assert.equal(d.includes('В корпус: ниже сгибанием ног'),t==='в корпус','answer target is separate from his target: '+v+i);});}
 // compact body mixed: five variants, head block then body block; the head-level mixed program keeps its 16 rounds
 const m=V42_WORKOUTS['FT-S10-ANS-MIXED-BODYPARRY'];timed(m,10,29,'FAR-STRAIGHT-COUNTER',true);assert.deepEqual(m.blocks,[['Ответы в голову',5],['Ответы в корпус',5]]);
 const N=['на месте','с шагом назад и возвратом','с шагом назад, разрыв дистанции','со смещением вправо','со смещением влево'];
 m.rounds.forEach((r,i)=>{const t=i<5?'в голову':'в корпус',d=r.description;assert.equal(r.name,'Отбив удара в корпус '+N[i%5]+' — ответ левой и правой '+t);
  assert.ok(/^Партнёр: прямые/.test(d)&&d.includes('в корпус')&&d.includes('отбив внутрь предплечьем')&&d.includes('Затем ответный прямой по очереди левой и правой '+t),i);
  if(i%5===3)assert.ok(d.startsWith('Партнёр: прямые левой в корпус.')&&d.includes('шаг правой вправо'));if(i%5===4)assert.ok(d.startsWith('Партнёр: прямые правой в корпус.')&&d.includes('шаг левой влево'));});
 assert.equal(V42_WORKOUTS['FT-S10-ANS-MIXED'].rounds.length,16);
});

test('V61: twelve separate short programs in stage 10 / first substage — upward and outward parries 3 × 8, outward slips 6 × 4; owner matrix, defence first, then one answering straight',()=>{
 const T=['Отбивы наверх на месте','Отбивы наверх с шагом назад','Отбивы наверх с полным боковым смещением','Отбивы наружу на месте','Отбивы наружу с шагом назад','Отбивы наружу с полным боковым смещением',
  'Уклоны наружу на месте','Уклоны наружу с шагом назад','Уклоны наружу с полным отходом назад','Уклоны наружу с боковым шагом и возвратом','Уклоны наружу с полным боковым смещением','Уклоны наружу с диагональным продвижением вперёд'];
 const OPP={'левой':'правой','правой':'левой'},SIDE={'левой':'вправо','правой':'влево'};
 const PM=[['левой','правой','в голову'],['правой','левой','в голову'],['левой','левой','в голову'],['правой','правой','в голову'],['левой','правой','в корпус'],['правой','левой','в корпус'],['левой','левой','в корпус'],['правой','правой','в корпус']];
 const SM=[['левой','правой','в голову'],['правой','левой','в голову'],['левой','правой','в корпус'],['правой','левой','в корпус']];
 const FOOT=[/стопы на месте\./,/шаг с возвратом — одновременно шаг задней правой назад, левая стоит; затем правая на прежнее место, стойка восстановлена\./,null];
 // OWNER FOOTWORK CANON V61: step-return moves ONE foot and brings it back, reply from the restored stance; full displacement — the second foot follows, new place, no return
 const KIND=r=>/стопы на месте/.test(r)?'spot':/шаг с возвратом/.test(r)?'ret':/полное смещение/.test(r)?'full':'';
 const WANT=['spot','ret','full','spot','ret','full','spot','ret','full','ret','full','full'];
 assert.equal(ORDER61.reduce((s,id)=>s+V42_WORKOUTS[id].rounds.length,0),72);
 ORDER61.forEach((id,k)=>{const w=V42_WORKOUTS[id],n=k<6?8:4;assert.equal(w.name,T[k]);assert.equal(w.stageId,'FAR-STRAIGHT-COUNTER');assert.equal(w.programId,'PRG-FAR-STRAIGHT-2');
  assert.equal(w.rounds.length,n);assert.equal(workoutTotalSec(w),(n*120+(n-1)*60));assert.ok(w.rounds.every(r=>r.workSec===120&&r.restSec===60&&r.cue===r.stance&&r.stance==='левосторонняя стойка'));
  const c=compileProgram([stageForWorkout(w)],PRESETS,{cycles:1});assert.equal(c.length,n);assert.equal(c.at(-1).restSec,0);
  assert.deepEqual(Object.keys(w.methodology),['technique','tactics','execution','typicalMistakes']);
  const mt=Object.values(w.methodology).join(' ');assert.ok(!/книг|автор|описан|разучива|источник|методичк|[А-ЕA-E]–[А-ЕA-E]|урок \d/i.test(mt),'standalone methodology: '+id);
  assert.ok(/одновременно с ударом партнёра \(так нельзя: ответ — только после защиты\)/.test(w.methodology.typicalMistakes));
  w.rounds.forEach((r,i)=>{const [inc,ans,t]=(k<6?PM:SM)[i],d=r.description,full=r.stance+' · '+d;assert.ok(full.length<=600&&r.name.length<=100,r.name);assert.equal(r.hand,ans);
   assert.ok(d.startsWith('Партнёр: прямой '+inc+' в голову. Защита — '),'incoming punch first: '+id+i);
   assert.ok(d.indexOf('Защита')<d.indexOf('Затем ответный прямой '+ans),'defence, then the answer: '+id+i);
   assert.ok(d.includes('ответный прямой '+ans)&&d.includes(' '+t+' ')&&d.includes('Ответ — после защиты, не вместе с ударом.')&&d.includes('Без партнёра')&&d.endsWith('В правосторонней стойке — зеркально.'),id+i);
   assert.equal(d.includes('В корпус — ниже, сгибанием ног.'),t==='в корпус');
   const kd=KIND(d);assert.equal(kd,WANT[k],'footwork kind named in every round: '+id+i);
   if(kd==='ret')assert.ok(/стоит; затем (правая|левая) на прежнее место, стойка восстановлена/.test(d)&&!/подтягивается/.test(d),'one foot moves and returns: '+id+i);
   if(kd==='full')assert.ok(/подтягивается/.test(d)&&/без возврата|новое место/.test(d)&&!/на прежнее место/.test(d),'second foot follows, new place: '+id+i);
   assert.ok(w.methodology.execution.includes(kd==='spot'?'Работа ног: стопы на месте.':kd==='ret'?'Работа ног: шаг с возвратом':'Работа ног: полное смещение'),'notes name the footwork kind: '+id);
   assert.ok(!/встречн|уклон внутрь|книг|автор|описан|разучива|одновременно с ударом/i.test(r.name+d),'no counter, no inward slip, no source prose: '+id+i);
   if(k<6){const par=OPP[inc],kind=k<3?'наверх':'наружу',v=k%3;assert.ok(r.name.startsWith('Отбив '+par+' '+kind),r.name);
    assert.ok(d.includes('Защита — отбив '+kind+': '+(par==='правой'?'правая':'левая')+' предплечьем'),'parry by the hand opposite to his: '+id+i);
    if(k>=3)assert.ok(d.includes('руку '+SIDE[inc]+', наружу'),'outward: from his left to my right, from his right to my left: '+id+i);
    assert.equal(d.includes(ans===par?'(та же рука)':'(другая рука)'),true);
    if(v<2)assert.ok(FOOT[v].test(d),id+i);else assert.ok(d.includes(inc==='левой'?'шаг правой вправо, левая подтягивается, ноги не скрещиваются':'шаг левой влево, правая подтягивается, ноги не скрещиваются'),'lateral: lead with the foot on the travel side: '+id+i);
    if(v===1)assert.ok(d.includes('из восстановленной стойки')&&!d.includes('левая подтягивается'),'step-return: one foot only, reply from the restored stance: '+id+i);}
   else{assert.equal(ans,OPP[inc]);assert.ok(d.includes('Защита — уклон '+SIDE[inc]+', наружу от его '+inc+' руки: колени сгибаются'),'outward slip: '+id+i);
    assert.ok(d.includes('подбородок прижат')&&d.includes('голова уходит с линии удара'));
    const v=k-6;assert.ok([/стопы на месте\./,/шаг задней правой назад, левая стоит; затем правая на прежнее место, стойка восстановлена\..*из восстановленной стойки/,/шаг задней правой назад, левая подтягивается; дистанция разорвана, без возврата\..*с шагом вперёд левой/,
     /шаг (правой вправо, левая|левой влево, правая) стоит; затем (правая|левая) на прежнее место, стойка восстановлена\..*из восстановленной стойки/,/ноги не скрещиваются; поворот на (правой|левой) ноге/,/полное смещение по диагонали — шаг (правой вперёд-вправо|левой вперёд-влево), (левая|правая) подтягивается; новое место/][v].test(d),'footwork variant: '+id+i);}});});
});
