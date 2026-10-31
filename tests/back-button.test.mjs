import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {installBackButton} from '../app/js/platform/back-button.js';

// Android Back: dialogs close first, an active workout is never left by one stray
// press, and otherwise the app goes to the background instead of doing nothing.
function fixture({active=false}={}){
 const clicks=[];const elements={};let minimized=0;let handler=null;let time=1000;
 const el=(id,hidden=true)=>(elements[id]={id,hidden,classList:{set:new Set(),contains(x){return this.set.has(x);}},
  click(){clicks.push(id);},textContent:''});
 for(const id of ['ftLanguageList','programDeleteConfirmModal','ftWorkoutImportModal','roundEditModal','stageSettingsModal',
  'programSaveModal','programLibraryModal','settingsModal','ladderLive','ftBackHint','programLibraryBack'])el(id);
 for(const id of ['ftLanguageTrigger','programDeleteConfirmCancel','ftWorkoutImportCancel','roundEditCancel','stageSettingsCancel',
  'programSaveClose','programLibraryClose','closeSettingsBtn','ladderExpand'])el(id,false);
 const doc={getElementById:id=>elements[id]||null,documentElement:{lang:'ru'}};
 const win={Capacitor:{Plugins:{App:{addListener:(name,fn)=>{assert.equal(name,'backButton');handler=fn;},
  minimizeApp:()=>{minimized+=1;return Promise.resolve();}}}}};
 const state={active};
 const timers={setTimeout:()=>1,clearTimeout:()=>{}};
 installBackButton({win,doc,isWorkoutActive:()=>state.active,now:()=>time,timers});
 return {elements,clicks,state,press:()=>handler(),advance:ms=>{time+=ms;},minimized:()=>minimized};
}

test('Back closes the top dialog through its own close button, one per press',()=>{
 const f=fixture();
 f.elements.settingsModal.hidden=false;f.elements.ftLanguageList.hidden=false;
 assert.equal(f.press(),'closed');assert.deepEqual(f.clicks,['ftLanguageTrigger']);
 f.elements.ftLanguageList.hidden=true;
 assert.equal(f.press(),'closed');assert.deepEqual(f.clicks,['ftLanguageTrigger','closeSettingsBtn']);
 assert.equal(f.minimized(),0);
});

test('in the library Back first leaves a category, then closes the library',()=>{
 const f=fixture();
 f.elements.programLibraryModal.hidden=false;f.elements.programLibraryBack.hidden=false;
 f.press();f.elements.programLibraryBack.hidden=true;f.press();
 assert.deepEqual(f.clicks,['programLibraryBack','programLibraryClose']);
});

test('a dialog over the library closes before the library, the full-screen plan collapses',()=>{
 const f=fixture();
 f.elements.programLibraryModal.hidden=false;f.elements.programDeleteConfirmModal.hidden=false;
 f.press();
 assert.deepEqual(f.clicks,['programDeleteConfirmCancel']);
 const g=fixture();
 g.elements.ladderLive.hidden=false;
 assert.equal(g.press(),'minimized'); // a collapsed plan is part of the screen, not an overlay
 g.elements.ladderLive.classList.set.add('is-expanded');
 assert.equal(g.press(),'closed');assert.deepEqual(g.clicks,['ladderExpand']);
});

test('Back on a confirmation presses its × (no answer), not its cancel button',()=>{
 const f=fixture();
 f.elements.programDeleteConfirmModal.hidden=false;
 f.elements.programDeleteConfirmDismiss={id:'programDeleteConfirmDismiss',hidden:false,click(){f.clicks.push('programDeleteConfirmDismiss');}};
 f.press();
 assert.deepEqual(f.clicks,['programDeleteConfirmDismiss']);
});

test('during a workout the first press warns, a second press within 2.5 s minimizes',()=>{
 const f=fixture({active:true});
 assert.equal(f.press(),'warned');
 assert.equal(f.elements.ftBackHint.hidden,false);
 assert.match(f.elements.ftBackHint.textContent,/ещё раз/);
 f.advance(2000);
 assert.equal(f.press(),'minimized');assert.equal(f.minimized(),1);
 assert.equal(f.elements.ftBackHint.hidden,true);
 // A later stray press warns again instead of leaving.
 f.advance(10000);
 assert.equal(f.press(),'warned');
 f.advance(3000);
 assert.equal(f.press(),'warned');
 assert.equal(f.minimized(),1);
});

test('without a workout Back moves the app to the background',()=>{
 const f=fixture();
 assert.equal(f.press(),'minimized');assert.equal(f.minimized(),1);
});

test('every dialog the handler knows exists in the page with its close button',()=>{
 const html=readFileSync(new URL('../app/index.html',import.meta.url),'utf8');
 const source=readFileSync(new URL('../app/js/platform/back-button.js',import.meta.url),'utf8');
 const ids=[...source.matchAll(/'([A-Za-z]+)'/g)].map(m=>m[1]).filter(id=>/Modal|List|Cancel|Close|Back|Trigger|Btn|ladder/.test(id));
 for(const id of ids)assert.ok(html.includes('id="'+id+'"'),id);
 assert.ok(html.includes('id="ftBackHint"'));
 const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
 assert.equal(pkg.dependencies['@capacitor/app'],'7.1.2');
});

test('an open diary ⋮ menu closes on Back before the library window, choosing nothing',()=>{
 const clicks=[];let handler=null;const menu={open:true};
 const library={hidden:false,click(){clicks.push('library');}};
 const doc={getElementById:id=>id==='programLibraryModal'?library:id==='programLibraryClose'?{hidden:false,click(){clicks.push('programLibraryClose');}}:null,
  querySelector:sel=>sel.includes('ft-diary-menu[open]') && menu.open ? menu : null,documentElement:{lang:'ru'}};
 installBackButton({win:{Capacitor:{Plugins:{App:{addListener:(n,fn)=>{handler=fn;},minimizeApp:()=>Promise.resolve()}}}},doc,timers:{setTimeout:()=>1,clearTimeout:()=>{}}});
 assert.equal(handler(),'closed');assert.equal(menu.open,false);assert.deepEqual(clicks,[]);
 assert.equal(handler(),'closed');assert.deepEqual(clicks,['programLibraryClose']);
});
