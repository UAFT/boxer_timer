import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bindControls} from '../app/js/ui/bindings.js';
import {readSettingsForm} from '../app/js/ui/render.js';
import {normalizeSettings} from '../app/js/state/settings-store.js';
import {clonePreset} from '../app/js/state/presets.js';

const read=path=>readFileSync(new URL('../app/'+path,import.meta.url),'utf8');

function node(dataset={}) {
 const handlers={};
 return {dataset,hidden:false,checked:false,value:'',textContent:'',disabled:false,
  classList:{toggle(){},add(){},remove(){}},setAttribute(){},
  addEventListener(type,fn){(handlers[type]??=[]).push(fn);},
  fire(type,extra={}){for(const fn of handlers[type]||[])fn({target:this,button:0,detail:1,stopPropagation(){},preventDefault(){},...extra});}
 };
}

function makeSettingsFixture(){
 const els={};
 for(const id of ['startBtn','resetBtn','settingsBtn','closeSettingsBtn','metronomeToggleBtn','metronomeCardToggleBtn','settingsModal','audioEnabledInput','warningSecondsInput','intervalModeInput','ladderEnabledInput','blockSettings','blockEnabledInput','blockCountInput','blockRestSecInput','blockCountDisplay','blockRestSecDisplay','phaseTwoStepSecInput','phaseTwoStepSecDisplay','workStepSecInput','workStepSecDisplay','restStepSecInput','restStepSecDisplay'])els[id]=node();
 els.saveSettingsBtn=null; // Removed from the UI.
 els.intervalModeInput.value='standard';els.warningSecondsInput.value='4';
 els.blockCountInput.value='2';els.blockRestSecInput.value='90';
 els.blockEnabledInput.checked=true;
 for(const id of ['workStepSecInput','restStepSecInput','phaseTwoStepSecInput'])els[id].value='0';
 els.warningChoiceButtons=[node({warningSeconds:'0'}),node({warningSeconds:'4'}),node({warningSeconds:'10'})];
 els.intervalModeButtons=['standard','two_phase','ladder','count_up'].map(intervalMode=>node({intervalMode}));
 els.blockStepButtons=[node({blockTarget:'blockCount',blockDirection:'up'}),node({blockTarget:'blockRestSec',blockDirection:'up'})];
 els.ladderStepButtons=[node({ladderTarget:'workStepSec',ladderDirection:'up'})];
 els.stepperButtons=[];els.metronomeModeButtons=[];
 els.cueVariantButtons=[node({cueTarget:'workStartCueVariant',cueValue:'v1'})];
 els.workStartCueVariantInput=node();els.workStartCueVariantInput.value='v2';
 return els;
}

test('gear settings auto-persist every toggle, step and mode without a Save button',()=>{
 const savedDoc=globalThis.document;
 const inputs=Object.fromEntries(['ladderStepsFields','phaseTwoStepFields','intervalModeExplainer','countUpExplainer','workStepSecLabel','workStepSecControl','workStepSecNote'].map(id=>[id,node()]));
 globalThis.document={getElementById:id=>inputs[id]};
 try {
  const els=makeSettingsFixture();let saved=0,preview=0,close=0;
  bindControls(els,{onSettingsChange(){saved++},onPreviewChange(){preview++},onCloseSettings(){close++},onAdjustLadderStep(){saved++}});
  els.audioEnabledInput.fire('change');assert.equal(saved,1);
  els.warningChoiceButtons[2].fire('click');assert.equal(saved,2);assert.equal(els.warningSecondsInput.value,'10');
  els.blockEnabledInput.fire('change');assert.equal(saved,3);
  els.blockStepButtons[0].fire('click');assert.equal(saved,4);assert.equal(els.blockCountInput.value,'3');
  els.blockStepButtons[1].fire('click');assert.equal(saved,5);assert.equal(els.blockRestSecInput.value,'95');
  els.intervalModeButtons[1].fire('click');assert.equal(preview,1);assert.equal(els.intervalModeInput.value,'two_phase');
  els.ladderStepButtons[0].fire('click');assert.equal(saved,6);
  els.cueVariantButtons[0].fire('click');assert.equal(saved,7);assert.equal(els.workStartCueVariantInput.value,'v1');
  els.settingsModal.fire('click',{target:els.settingsModal});assert.equal(close,1);
 } finally {globalThis.document=savedDoc;}
});

test('settings snapshot retains hidden block toggle until ladder is selected again',()=>{
 const els=makeSettingsFixture();
 els.intervalModeInput.value='standard';
 const form=readSettingsForm(els);
 assert.equal(form.blockEnabled,true);
 const base=clonePreset('classic1');
 const result=normalizeSettings({...base,...form},base);
 assert.equal(result.blockEnabled,true);
 assert.equal(result.intervalMode,'standard');
});

test('stage ladder numbers and shell X match visual contract',()=>{
 const css=read('styles/fight-tech-ui-kit.css');
 const html=read('index.html');
 const app=read('js/app.js');
 assert.match(css,/\.stage-settings-modal #stageSettingsLadder input\[type="number"\]\{/);
 assert.match(css,/font-weight:750!important/);
 assert.match(css,/text-align:center!important/);
 for(const key of ['WorkStep','RestStep','Blocks','BlockRest']) assert.match(html,new RegExp('id="stageSettings'+key+'"'));
 assert.match(html,/id="closeSettingsBtn" aria-label="Закрыть настройки"[^>]*>×<\/button>/);
 assert.doesNotMatch(html,/id="saveSettingsBtn"/);
 assert.match(app,/onSettingsChange: \(\) => handleSaveSettings\(\)/);
 assert.match(app,/onPreviewChange: \(\) => handleSaveSettings\(\)/);
 assert.match(app,/onCloseSettings: \(\) => handleSaveSettings\(\{close:true\}\)/);
 assert.match(app,/if\(close\) closeSettings\(els\)/);
});
