import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stageModeLabel} from '../app/js/ui/stage-mode-label.js';
import {renderStageTitle} from '../app/js/ui/stage-title.js';
import {buildLadderPlanRows} from '../app/js/ui/ladder-plan-rows.js';
import {clonePreset} from '../app/js/state/presets.js';
import {compileProgram} from '../app/js/core/program.js';

function doc(){
 return {createElement(tag){return {tag,className:'',textContent:'',children:[],append(el){this.children.push(el)}};}};
}
const cases=[
 ['Плиометрика','classic1',{intervalMode:'standard'},'Обычный'],
 ['Руки','classic1',{intervalMode:'ladder'},'Лестница'],
 ['Сила + легкость','classic1',{intervalMode:'two_phase',phaseTwoSec:15},'Две фазы'],
 ['Скорость','tabata2020x24',{intervalMode:'standard'},'Скоростной'],
 ['Пирамида','classic1',{intervalMode:'two_phase',phaseTwoSec:15,ladderEnabled:true},'Две фазы + Лестница'],
];

test('five stage variants share exactly one mode vocabulary, independent of user titles',()=>{
 for(const [name,presetId,settings,mode] of cases){
  const conf={presetId,...settings};
  assert.equal(stageModeLabel(conf),mode);
  const children=renderStageTitle(doc(),1,name,{config:conf}).children;
  assert.equal(children[0].textContent,'Этап 1 — '+mode);
  assert.equal(children.at(-1).textContent,name);
 }
});

test('compiled four-stage program always has mode / duration above user title',()=>{
 const profiles={classic1:clonePreset('classic1'),tabata2020x24:clonePreset('tabata2020x24')};
 const stages=cases.slice(0,4).map(([name,presetId,settings])=>({
  title:name,presetId,settings:{...clonePreset(presetId),rounds:2,workSec:10,restSec:10,...settings}
 }));
 const config={programRounds:compileProgram(stages,profiles)};
 const html=buildLadderPlanRows(config);
 for(const [index,entry] of stages.entries()){
  const heading='Этап '+(index+1)+' из 4 · '+stageModeLabel({...entry.settings,presetId:entry.presetId})+' · всего ';
  const at=html.indexOf(heading);
  assert.ok(at>=0,'heading '+heading);
  const title=html.indexOf('<div class="ladder-stage-title">'+entry.title+'</div>',at);
  assert.ok(title>at,'stage name is separated and below stage '+(index+1));
 }
 assert.ok(html.indexOf('Скоростной · всего')<html.indexOf('>Скорость</div>'));
 assert.doesNotMatch(html,/Скорость · Скоростной/);
});

test('title is HTML-escaped, mode never comes from user-defined names',()=>{
 const profiles={classic1:clonePreset('classic1')};
 const config={programRounds:compileProgram([{
  title:'<Руки> & Кувалда',presetId:'classic1',
  settings:{...clonePreset('classic1'),rounds:1,workSec:10}
 }],profiles)};
 const html=buildLadderPlanRows(config);
 assert.ok(html.includes('Этап 1 из 1 · Обычный · всего'));
 assert.ok(html.includes('<div class="ladder-stage-title">&lt;Руки&gt; &amp; Кувалда</div>'));
});

test('pending two-phase rounds show three DIFFERENT silver chips, active has independent treatment',()=>{
 const css=readFileSync(new URL('../app/styles/fight-tech-ui-kit.css',import.meta.url),'utf8');
 const expected={ 'phase-one':'#ebf0f2','phase-two':'#f1f3f5','ft-round-rest':'#e9eef1'};
 for(const [phase,color] of Object.entries(expected)){
  const selector='.ladder-live-list .ladder-live-row.ft-two-phase-plan:not(.is-active) .ft-work-phase.'+phase+' {';
  assert.ok(css.includes(selector),'separate '+phase);
  assert.ok(css.slice(css.indexOf(selector)).includes('background:'+color+'!important'),'specific '+phase+' color');
 }
 assert.match(css,/\.ft-two-phase-plan \.ft-work-phase\.is-active/);
});
