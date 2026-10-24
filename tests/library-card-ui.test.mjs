import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {programCardTimings,timeWords,timeClock,renderSavedProgramCard} from '../app/js/ui/library-card-view.js';
import {compileProgram} from '../app/js/core/program.js';
import {clonePreset} from '../app/js/state/presets.js';

const profiles={classic3:clonePreset('classic3'),classic2:clonePreset('classic2'),classic1:clonePreset('classic1'),tabata2020x24:clonePreset('tabata2020x24')};
const cardio={presetId:'classic3',title:'Кардио — Скакалка 3 × 3',settings:{...profiles.classic3,rounds:3,workSec:180,restSec:60},restAfterSec:180};
const boxing={presetId:'classic2',title:'Бокс — Комплекс 1',settings:{...profiles.classic2,rounds:1,workSec:1860,restSec:60},restAfterSec:0};
const program={id:'p1',name:'Программа 1',entries:[cardio,boxing],options:{cycles:1,cycleRestSec:60}};

function mockDoc(){
 const create=(tag)=>({tag,className:'',textContent:'',title:'',attributes:{},children:[],classList:{
  add(name){this.owner.className=[this.owner.className,name].filter(Boolean).join(' ');},
  toggle(name,flag){const classes=this.owner.className.split(' ').filter(Boolean).filter(x=>x!==name);if(flag)classes.push(name);this.owner.className=classes.join(' ');}
 },setAttribute(name,value){this.attributes[name]=value;},addEventListener(event,handler){this['on'+event]=handler;},append(...children){this.children.push(...children);}});
 const element=tag=>{const el=create(tag);el.classList.owner=el;return el;};
 return {createElement:element,createElementNS:(_namespace,tag)=>element(tag)};
}
function findAll(node,classname){return [...(node?.children||[]).flatMap(child=>[...(child.className?.split(' ').includes(classname)?[child]:[]),...findAll(child,classname)])];}

test('saved library program shows accurate 45-minute total including 3-minute between-stage rest',()=>{
 const data=programCardTimings(program,profiles);
 const engine=compileProgram(program.entries,profiles,program.options);
 assert.equal(data.total,2700);
 assert.equal(engine.reduce((n,row)=>n+row.workSec+row.restSec,0),2700);
 assert.equal(timeWords(data.total),'45 минут');
 assert.equal(data.stages[0].duration,660);
 assert.equal(timeWords(data.stages[0].duration),'11 минут');
 assert.deepEqual([data.stages[0].rounds,data.stages[0].work,data.stages[0].rest,data.stages[0].restAfter],[3,'03:00','01:00',180]);
 assert.equal(data.stages[1].duration,1860);
 assert.equal(data.stages[1].restAfter,0);
});

test('saved-program card: compact summary, lazy plan and description, four independent actions',()=>{
 let opened=0,deleted=0,shared=0;
 const doc=mockDoc();
 const card=renderSavedProgramCard(doc,program,profiles,{
  lang:'ru',onOpen:()=>opened++,onDelete:()=>deleted++,onShareButton:()=>{const btn=doc.createElement('button');btn.className='ft-share-button';btn.addEventListener('click',()=>shared++);return btn;}
 });
 assert.equal(card.className,'program-library-entry ft-saved-program-entry ft-compact-card');
 assert.equal(findAll(card,'ft-program-title')[0].textContent,'Программа 1');
 assert.equal(findAll(card,'ft-program-summary')[0].textContent,'4 раунда · работа 03:00–31:00 · отдых 01:00–03:00');
 assert.equal(findAll(card,'ft-program-total')[0].textContent,'45 минут');
 const [body,actions,info,plan]=card.children;
 assert.equal(actions.className,'ft-program-actions');
 assert.deepEqual(actions.children.map(b=>b.className),['ft-description-button','ft-saved-program-add','ft-share-button','program-library-entry-delete ft-trash-button']);
 assert.equal(plan.hidden,true,'saved cards start collapsed');assert.equal(info.hidden,true);
 assert.equal(body.attributes['aria-expanded'],'false');assert.equal(body.attributes['aria-controls'],plan.id);
 assert.equal(findAll(card,'ft-plan-round').length,0,'plan is lazy');
 body.onclick();
 assert.equal(plan.hidden,false);assert.equal(info.hidden,true,'body opens only the plan');
 assert.equal(body.attributes['aria-expanded'],'true');
 assert.deepEqual(findAll(card,'ft-plan-round-time').map(x=>x.textContent),
  ['работа 03:00 · отдых 01:00','работа 03:00 · отдых 01:00','работа 03:00 · пауза между этапами 03:00','работа 31:00']);
 assert.deepEqual(findAll(card,'ft-plan-stage').map(x=>x.textContent),['Этап 1 · Кардио — Скакалка 3 × 3','Этап 2 · Бокс — Комплекс 1']);
 actions.children[0].onclick();
 assert.equal(info.hidden,false);assert.equal(actions.children[0].attributes['aria-expanded'],'true');
 assert.deepEqual(findAll(card,'ft-stage-label').map(x=>x.textContent),['Этап 1','Этап 2']);
 assert.equal(findAll(card,'ft-stage-details')[0].textContent,'3 раунда · работа 03:00 · отдых 01:00');
 assert.equal(findAll(card,'ft-stage-rest-after')[0].textContent,'Между этапами: 03:00');
 assert.equal(findAll(card,'ft-card-empty')[0].textContent,'Цель и заметки для этой программы не добавлены.');
 body.onclick();
 assert.equal(plan.hidden,true,'second tap collapses the plan');assert.equal(info.hidden,false,'description stays independent');
 assert.equal(opened+deleted+shared,0,'expanding never opens, shares or deletes');
 body.onclick();
 assert.equal(findAll(card,'ft-plan-round').length,4,'plan is built once');
 findAll(card,'ft-saved-program-load')[0].onclick();
 actions.children[1].onclick(); // Quick + loads without expanding first.
 actions.children[2].onclick();
 actions.children[3].onclick();
 assert.deepEqual([opened,shared,deleted],[2,1,1]);
});

test('saved AFAP program presents unbounded time rather than misleading zero',()=>{
 const afap={...program,id:'afap',name:'AFAP',entries:[{presetId:'classic1',title:'На время',settings:{...profiles.classic1,intervalMode:'count_up'},restAfterSec:0}]};
 const data=programCardTimings(afap,profiles);
 assert.equal(data.unbounded,true);
 const doc=mockDoc();
 const card=renderSavedProgramCard(doc,afap,profiles,{onShareButton:()=>doc.createElement('button')});
 assert.equal(findAll(card,'ft-program-total')[0].textContent,'Без ограничения времени');
 assert.equal(findAll(card,'ft-program-summary')[0].textContent,'Прямой отсчёт · без ограничения времени');
 card.children[0].onclick();
 assert.equal(findAll(card,'ft-plan-round-time')[0].textContent,'прямой отсчёт');
 card.children[1].children[0].onclick();
 assert.match(findAll(card,'ft-stage-details')[0].textContent,/Прямой отсчёт/);
 assert.equal(findAll(card,'ft-stage-total')[0].textContent,'Время не ограничено');
});

test('cycle pause and final rest handling agree with compiled timer',()=>{
 const multi={...program,options:{cycles:2,cycleRestSec:120}};
 const data=programCardTimings(multi,profiles);
 assert.equal(data.total,2*2700+120);
 assert.equal(data.cycles,2);
 const rows=compileProgram(multi.entries,profiles,multi.options);
 assert.equal(data.total,rows.reduce((sum,r)=>sum+r.workSec+r.restSec,0));
 assert.equal(rows.at(-1).restSec,0);
 assert.equal(rows[3].restSec,120);
 assert.equal(timeWords(90),'1 минута 30 секунд');
 assert.equal(timeClock(65),'01:05');
});

test('compact import nav and separate actions use icon buttons without replacing delete confirmation',()=>{
 const html=readFileSync(new URL('../app/index.html',import.meta.url),'utf8');
 const app=readFileSync(new URL('../app/js/app.js',import.meta.url),'utf8');
 const exchange=readFileSync(new URL('../app/js/sharing/workout-exchange-ui.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../app/styles/workout-exchange.css',import.meta.url),'utf8');
 const tabs=html.match(/class="program-library-tabs ft-library-nav"([\s\S]*?)<\/div>/)?.[1]||'';
 for(const id of ['programLibraryMine','programLibraryTemplates','ftWorkoutImportBtn'])assert.ok(tabs.includes('id="'+id+'"'),id);
 assert.ok(tabs.includes('ft-action-icon'));
 assert.ok(exchange.includes("createActionIcon(doc,'share')"));
 assert.ok(app.includes('renderSavedProgramCard(document,entry,profiles'));
 assert.ok(app.includes('confirmDeletion({name:entry.name,trigger:del,onConfirm:()=>{'));
 assert.ok(readFileSync(new URL('../app/styles/compact-card.css',import.meta.url),'utf8').includes('.ft-compact-card .ft-program-actions{position:static;display:flex;flex-wrap:wrap'));
 assert.ok(css.includes('.ft-library-nav{display:grid;grid-template-columns:'));
});
