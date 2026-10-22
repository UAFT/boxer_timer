import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadRoundTimingEditor} from '../app/js/ui/round-time-editor.js';
import {clonePreset} from '../app/js/state/presets.js';

function mountEditor() {
  const ids={};
  const dom=(id,props={})=>ids[id]={id,hidden:false,...props};
  dom('roundEditTimes');dom('roundEditWorkCaption',{textContent:''});
  dom('roundEditLastRestNote');dom('roundEditResetTiming');
  for(const [name,id] of [['work','roundEditWorkTime'],['second','roundEditPhaseTwoTime'],['rest','roundEditRestTime']]) {
    const label={hidden:false};
    dom(id,{value:'',disabled:false,closest:()=>label,classList:{toggle() {},remove() {}}});
    ids[name+'Label']=label;
  }
  return ids;
}

test('one-phase and speed stage show only Work/Rest, never Phase 2',()=>{
  const previous=globalThis.document, elements=mountEditor();
  globalThis.document={getElementById:(id)=>elements[id]};
  try {
    for(const preset of ['classic1','tabata2020x24']) {
      const cfg={...clonePreset(preset),intervalMode:'standard',rounds:8,workSec:20,restSec:10};
      loadRoundTimingEditor({roundTimingOverrides:[]},0,cfg);
      assert.equal(elements.roundEditWorkCaption.textContent,'Работа');
      assert.equal(elements.secondLabel.hidden,true);
      assert.equal(elements.roundEditPhaseTwoTime.disabled,true);
      assert.equal(elements.workLabel.hidden,false);
      assert.equal(elements.restLabel.hidden,false);
    }
    const ladder={...clonePreset('classic1'),intervalMode:'ladder',rounds:4};
    loadRoundTimingEditor({},0,ladder);
    assert.equal(elements.secondLabel.hidden,true);
  } finally {globalThis.document=previous;}
});

test('two-phase stage shows Phase 1 and Phase 2',()=>{
  const previous=globalThis.document,elements=mountEditor();
  globalThis.document={getElementById:(id)=>elements[id]};
  try {
    loadRoundTimingEditor({},0,{...clonePreset('classic1'),intervalMode:'two_phase',phaseTwoSec:40,rounds:5});
    assert.equal(elements.roundEditWorkCaption.textContent,'Работа / Фаза 1');
    assert.equal(elements.secondLabel.hidden,false);
    assert.equal(elements.roundEditPhaseTwoTime.disabled,false);
  } finally {globalThis.document=previous;}
});

test('grid CSS honors hidden phase input, not just its DOM hidden flag',()=>{
  const css=readFileSync(new URL('../app/styles/fight-tech-ui-kit.css',import.meta.url),'utf8');
  assert.match(css,/\.round-edit-modal \.ft-round-time-grid label\[hidden\]\{display:none!important\}/);
});
