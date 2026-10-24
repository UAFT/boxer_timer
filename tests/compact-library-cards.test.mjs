import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LIBRARY, CATEGORIES, stageForWorkout} from '../app/js/library/native-adapter.js';
import {libraryLevel} from '../app/js/library/library-browser.js';
import {compileProgram} from '../app/js/core/program.js';
import {timeClock} from '../app/js/ui/library-card-view.js';
import {renderLibraryWorkoutCard, planSummary} from '../app/js/ui/workout-plan-view.js';

function mockDoc(){
 const element=tag=>{const el={tag,className:'',textContent:'',title:'',hidden:false,disabled:false,attributes:{},children:[],
  setAttribute(name,value){this.attributes[name]=value;},addEventListener(event,handler){this['on'+event]=handler;},
  append(...c){this.children.push(...c);},replaceChildren(...c){this.children=c;}};
  el.classList={add:name=>{el.className=[el.className,name].filter(Boolean).join(' ');},
   toggle:(name,flag)=>{const k=el.className.split(' ').filter(x=>x&&x!==name);if(flag)k.push(name);el.className=k.join(' ');}};
  return el;};
 return {createElement:element,createElementNS:(_ns,tag)=>element(tag)};
}
const findAll=(node,cls)=>(node?.children||[]).flatMap(c=>[...(c.className?.split?.(' ').includes(cls)?[c]:[]),...findAll(c,cls)]);
const roundsOf=w=>compileProgram([stageForWorkout(w)],{},{cycles:1});
function card(w,opts={}){const doc=mockDoc();return renderLibraryWorkoutCard(doc,w,{rounds:roundsOf(w),...opts});}
const byId=id=>LIBRARY.find(w=>w.id===id);

test('folder counters: bold, far right, no parentheses, counted from the data',()=>{
 const app=readFileSync(new URL('../app/js/app.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../app/styles/compact-card.css',import.meta.url),'utf8');
 assert.ok(app.includes("count.className='ft-library-count';count.textContent=String(item.count)"));
 assert.ok(!app.includes("item.label+' ('+item.count+')'"));
 assert.match(css,/\.ft-library-count\{margin-left:auto;font-weight:800/);
 const root=libraryLevel(LIBRARY,CATEGORIES,{});
 for(const item of root.items)assert.equal(item.count,LIBRARY.filter(w=>w.category===item.key).length);
 assert.equal(root.items.find(i=>i.key==='boxing').count,152);
});

test('bag workout card: compact line from real rounds, no task list, plan in playback order without final rest',()=>{
 const w=byId('BOX-001'),c=card(w);
 assert.equal(findAll(c,'ft-program-summary')[0].textContent,'12 раундов · работа 02:00 · отдых 00:40');
 assert.equal(findAll(c,'ft-program-total')[0].textContent,'31 минута 20 секунд');
 assert.equal(findAll(c,'native-library-info').length,0,'old long card is gone');
 assert.equal(findAll(c,'ft-plan-round').length,0,'plan hidden until the body is tapped');
 c.children[0].onclick();
 const names=findAll(c,'ft-plan-round-name').map(x=>x.textContent),times=findAll(c,'ft-plan-round-time').map(x=>x.textContent);
 assert.equal(names.length,12);
 w.rounds.forEach((r,i)=>{
  assert.equal(names[i],(i+1)+'. '+r.name);
  assert.equal(times[i],'работа 02:00'+(i<11?' · отдых 00:40':''));
 });
 assert.equal(findAll(c,'ft-plan-round-note')[0].textContent,'сильная стойка · '+w.rounds[0].description);
 assert.equal(findAll(c,'ft-plan-round-note')[11].textContent.startsWith('слабая стойка'),true);
});

test('circuits show their real rest range and the 180/300 s pauses in the plan',()=>{
 const sp=card(byId('DEGTYAREV_CIRCUIT'));
 assert.equal(findAll(sp,'ft-program-summary')[0].textContent,'8 раундов · работа 03:00 · отдых 00:30–03:00');
 sp.children[0].onclick();
 const t=findAll(sp,'ft-plan-round-time').map(x=>x.textContent);
 assert.equal(t[3],'работа 03:00 · отдых 03:00');assert.equal(t.at(-1),'работа 03:00');
 const co=card(byId('ROMANENKO_COMBINED'));
 assert.match(findAll(co,'ft-program-summary')[0].textContent,/отдых 01:00–05:00$/);
 co.children[0].onclick();
 const ct=findAll(co,'ft-plan-round-time').map(x=>x.textContent);
 assert.equal(ct.filter(x=>x.endsWith('отдых 05:00')).length,1);assert.ok(!/отдых/.test(ct.at(-1)));
});

test('two-phase boxing plan names both phases and their times',()=>{
 const w=byId('BOX-CON-001'),c=card(w);
 assert.match(findAll(c,'ft-program-summary')[0].textContent,/работа 00:30 \+ 01:30/);
 c.children[0].onclick();
 assert.equal(findAll(c,'ft-plan-round-name')[0].textContent,'1. '+w.rounds[0].name+' → '+w.rounds[1].name);
 assert.equal(findAll(c,'ft-plan-round-time')[0].textContent,'работа 00:30 + 01:30 · отдых 00:40');
});

test('description: source notes and draft warning when present, honest empty state otherwise',()=>{
 const empty=card(byId('BOX-001'));
 const [body,actions,info]=empty.children;
 assert.equal(actions.children[0].className,'ft-description-button');
 assert.equal(actions.children[0].attributes['aria-controls'],info.id);
 actions.children[0].onclick();
 assert.equal(info.hidden,false);assert.equal(body.attributes['aria-expanded'],'false','description does not open the plan');
 assert.equal(findAll(empty,'ft-card-empty')[0].textContent,'Описание пока не добавлено.');
 const draft=LIBRARY.find(w=>/НЕ ГОТОВ/.test(w.note));
 const d=card(draft);
 assert.equal(findAll(d,'ft-program-badge')[0].textContent,'Черновик — см. описание');
 d.children[1].children[0].onclick();
 assert.deepEqual(findAll(d,'ft-card-section-text').map(x=>x.textContent),[draft.note]);
 const legacy=card(byId('I03'));legacy.children[1].children[0].onclick();
 assert.deepEqual(findAll(legacy,'ft-card-section-label').map(x=>x.textContent),['Оборудование','Упражнения','Источник']);
});

test('plus adds once and only on its own tap; expanding never adds; disabled state kept',async()=>{
 let added=0;
 const c=card(byId('BOX-001'),{onAdd:()=>{added++;return true;},plusIcon:()=>'+'});
 c.children[0].onclick();c.children[1].children[0].onclick();c.children[0].onclick();
 assert.equal(added,0);
 const plus=c.children[1].children[1];
 assert.equal(plus.attributes['aria-label'],'Добавить Одиночные прямые');
 plus.onclick();assert.equal(added,1);assert.deepEqual(plus.children,['✓']);
 await new Promise(r=>setTimeout(r,850));assert.deepEqual(plus.children,['+']);
 assert.equal(card(byId('BOX-001'),{addDisabled:true}).children[1].children[1].disabled,true);
});

test('every library workout renders a card whose plan matches its compiled rounds',()=>{
 assert.equal(LIBRARY.length,189);
 for(const w of LIBRARY){
  const rounds=roundsOf(w),c=card(w);
  c.children[0].onclick();
  assert.equal(findAll(c,'ft-plan-round').length,rounds.length,w.id);
  const times=findAll(c,'ft-plan-round-time').map(x=>x.textContent);
  if(rounds.at(-1).intervalMode!=='count_up')assert.ok(!/отдых|пауза/.test(times.at(-1)),w.id+' no rest after last');
  const s=planSummary(rounds).line;
  if(rounds.every(r=>r.workSec===rounds[0].workSec)&&rounds[0].intervalMode!=='count_up')assert.ok(s.includes('работа '+timeClock(rounds[0].workSec)),w.id);
 }
});
