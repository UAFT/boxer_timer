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
 const create=(tag)=>({tag,className:'',textContent:'',title:'',attributes:{},children:[],classList:{add(name){this.owner.className=[this.owner.className,name].filter(Boolean).join(' ');}},setAttribute(name,value){this.attributes[name]=value;},addEventListener(event,handler){this['on'+event]=handler;},append(...children){this.children.push(...children);}});
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

test('stage hierarchy and top-right icons render in one saved-program card',()=>{
 let opened=0,deleted=0;
 const doc=mockDoc();
 const card=renderSavedProgramCard(doc,program,profiles,{
  lang:'ru',onOpen:()=>opened++,onDelete:()=>deleted++,onShareButton:()=>{const btn=doc.createElement('button');btn.className='ft-share-button';return btn;}
 });
 assert.equal(card.className,'program-library-entry ft-saved-program-entry');
 const title=findAll(card,'ft-program-title')[0];
 assert.equal(title.textContent,'Программа 1');
 assert.equal(findAll(card,'ft-program-total')[0].textContent,'45 минут');
 assert.deepEqual(findAll(card,'ft-stage-label').map(x=>x.textContent),['Этап 1','Этап 2']);
 assert.equal(findAll(card,'ft-stage-title')[0].textContent,'Кардио — Скакалка 3 × 3');
 assert.equal(findAll(card,'ft-stage-details')[0].textContent,'3 раунда · работа 03:00 · отдых 01:00');
 assert.equal(findAll(card,'ft-stage-total')[0].textContent,'Всего: 11 минут');
 assert.equal(findAll(card,'ft-stage-rest-after')[0].textContent,'Между этапами: 03:00');
 const actions=findAll(card,'ft-program-actions')[0];
 assert.ok(actions);
 assert.equal(actions.children.length,2);
 assert.equal(findAll(card,'ft-trash-button').length,1);
 assert.equal(findAll(card,'ft-action-icon').length,1);
 card.children[0].onclick();actions.children[1].onclick();
 assert.equal(opened,1);assert.equal(deleted,1);
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
 assert.ok(css.includes('.ft-program-actions{position:absolute;right:12px;top:11px'));
 assert.ok(css.includes('.ft-library-nav{display:grid;grid-template-columns:'));
});
