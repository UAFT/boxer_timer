import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stageTimingRows} from '../app/js/ui/stage-timing-rows.js';
import {buildLadderPlanRows} from '../app/js/ui/ladder-plan-rows.js';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');

test('two work phases have one compact timing line followed by a separate total',()=>{
 const rows=stageTimingRows({intervalMode:'two_phase',workSec:60,phaseTwoSec:40,restSec:60},{total:740,rounds:new Array(5).fill({})});
 assert.deepEqual(rows,[
  ['program-stage-two-phase-meta','5 раундов · фаза 1 — 01:00 · фаза 2 — 00:40 · отдых — 01:00'],
  ['program-stage-sum','Всего: 12:20']
 ]);
 assert.deepEqual(stageTimingRows({intervalMode:'two_phase',workSec:60,phaseTwoSec:40,restSec:60},{total:740,rounds:new Array(5).fill({})},true),[
  ['program-stage-two-phase-meta','5 rounds · phase 1 — 01:00 · phase 2 — 00:40 · rest — 01:00'],
  ['program-stage-sum','Total: 12:20']
 ]);
});
test('two phase plan groups each round then full-width phase 1, phase 2, rest; no final rest',()=>{
 const plan=buildLadderPlanRows({intervalMode:'two_phase',rounds:2,workSec:60,phaseTwoSec:40,restSec:60,phaseOneName:'Кувалда',phaseTwoName:'Бой с тенью'});
 assert.equal((plan.match(/ft-two-phase-plan/g)||[]).length,2);
 const first=plan.slice(plan.indexOf('data-round="1"'),plan.indexOf('data-round="2"'));
 const last=plan.slice(plan.indexOf('data-round="2"'));
 assert.ok(first.indexOf('Раунд 1')<first.indexOf('Фаза 1 · Кувалда'));
 assert.ok(first.indexOf('Фаза 1 · Кувалда')<first.indexOf('Фаза 2 · Бой с тенью'));
 assert.ok(first.indexOf('Фаза 2 · Бой с тенью')<first.indexOf('Отдых'));
 assert.ok(!last.includes('ft-round-rest'));
 const css=read('../app/styles/program-screen.css');
 assert.ok(css.includes('.ladder-live-row.ft-two-phase-plan{'));
 assert.ok(css.includes('grid-template-columns:minmax(0,1fr)!important'));
});
test('two-phase editor has direct names and phase-specific time, ladder controls available only if combined',()=>{
 const html=read('../app/index.html');
 assert.ok(html.includes('id="stageSettingsPhaseOneTimeSlot"'));
 assert.ok(html.includes('id="stageSettingsPhaseTwoMin"'));
 assert.ok(html.includes('id="ladderStepsFields"'));
 assert.ok(html.includes('id="intervalModeExplainer" hidden'));
 const app=read('../app/js/app.js'),bindings=read('../app/js/ui/bindings.js'),render=read('../app/js/ui/render.js');
 assert.ok(app.includes("workSlot.append(work)"));
 assert.ok(app.includes("Время фазы 1"));
 assert.ok(app.includes("workGrid.insertBefore(work"));
 assert.ok(bindings.includes("installIntervalModeCombo"));
 assert.ok(bindings.includes("document.getElementById('ladderStepsFields').hidden=!ladder"));
 assert.ok(render.includes("document.getElementById('ladderStepsFields').hidden=!ladder"));
 assert.ok(render.includes("'<div class=\"ladder-preview-row\"><span>Раунд '+i+' · Фаза 1"));
});
