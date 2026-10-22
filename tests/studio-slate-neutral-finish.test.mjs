import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {installCustomLanguageSelect} from '../app/js/i18n/custom-language-select.js';
const html=readFileSync(new URL('../app/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../app/styles/fight-tech-ui-kit.css',import.meta.url),'utf8');
class El extends EventTarget {
 constructor(text='') {super();this.textContent=text;this.dataset={};this.attrs={};this.hidden=true;this.focused=false;}
 setAttribute(key,value) {this.attrs[key]=value;}
 getAttribute(key){return this.attrs[key];}
 focus(){this.focused=true;}
 contains(target){return target===this||this.children?.includes(target);}
 querySelectorAll(){return this.children||[];}
}
function fixture() {
 const select=new El();select.value='auto';
 const trigger=new El();const list=new El();const label=new El();const picker=new El();
 const options=['auto','ru','en'].map((code,i)=>{const el=new El(['Авто / Auto','Русский','English'][i]);el.dataset.ftLang=code;return el;});
 list.children=options;picker.children=[trigger,list,label,...options];
 const objects={ftLanguageTrigger:trigger,ftLanguageList:list,ftLanguageSelected:label,ftLanguagePicker:picker};
 const root=new El();root.getElementById=id=>objects[id];
 const menu=installCustomLanguageSelect(select,root);
 return {select,trigger,list,label,options,root,menu};
}
test('custom picker retains original language contract, does not open Android select',()=>{
 assert.match(html,/<select id="languageSelect"[^>]*tabindex="-1"[^>]*aria-hidden="true"/);
 assert.match(html,/<button type="button" class="ft-language-trigger"[^>]*aria-haspopup="listbox"/);
 assert.match(html,/id="ftLanguageList" role="listbox"/);
 assert.match(css,/\.ft-language-picker #languageSelect\{[\s\S]*pointer-events:none!important/);
 const ui=fixture();assert.equal(ui.label.textContent,'Авто / Auto');
 ui.trigger.dispatchEvent(new Event('click'));
 assert.equal(ui.list.hidden,false);assert.equal(ui.trigger.getAttribute('aria-expanded'),'true');
 let changes=0;ui.select.addEventListener('change',()=>changes++);
 ui.options[1].dispatchEvent(new Event('click'));
 assert.equal(ui.select.value,'ru');assert.equal(changes,1);
 assert.equal(ui.list.hidden,true);assert.equal(ui.label.textContent,'Русский');
 assert.equal(ui.options[1].getAttribute('aria-selected'),'true');
 assert.equal(ui.options[0].getAttribute('aria-selected'),'false');
});
test('custom picker keyboard and outside tap dismiss without changing stored language',()=>{
 const ui=fixture();const arrow=new Event('keydown',{cancelable:true});Object.defineProperty(arrow,'key',{value:'ArrowDown'});
 ui.trigger.dispatchEvent(arrow);assert.equal(ui.list.hidden,false);assert.equal(ui.options[0].focused,true);
 ui.root.dispatchEvent(new Event('pointerdown'));
 assert.equal(ui.list.hidden,true);assert.equal(ui.select.value,'auto');
});
test('neutral program + library + editor skin supersedes legacy dark declarations',()=>{
 for(const target of [
 '.program-panel .program-stage-card>.program-stage',
 '.program-panel .program-stage-card>.program-stage-timing',
 '.program-library-modal .program-library-list .program-library-entry-open',
 '.program-library-modal .ft-saved-program-entry .ft-program-title',
 '.stage-settings-modal .stage-number-control button',
 '.stage-settings-modal .ft-stage-phase-item>input',
 '.round-edit-modal textarea',
 '.settings-modal .ft-language-list button[aria-selected=true]']){
   assert.ok(css.includes(target),target);
 }
 assert.match(css,/\.program-library-modal \.program-library-list \.native-library-add\{[\s\S]*?var\(--ft-card\)/);
 assert.match(css,/\.stage-settings-modal \.stage-mode-choices button\.selected/);
});
