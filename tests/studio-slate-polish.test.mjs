import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildLadderPlanRows} from '../app/js/ui/ladder-plan-rows.js';
import {compileProgram} from '../app/js/core/program.js';
import {clonePreset} from '../app/js/state/presets.js';

const css=readFileSync(new URL('../app/styles/fight-tech-ui-kit.css',import.meta.url),'utf8');
const combo=readFileSync(new URL('../app/js/ui/interval-mode-combo.js',import.meta.url),'utf8');

test('mode-chip long press suppresses text selection but preserves touch/click',()=>{
 assert.match(css,/\.settings-modal button\[data-interval-mode\][\s\S]*?-webkit-user-select:none!important/);
 assert.match(css,/touch-action:manipulation/);
 assert.match(combo,/addEventListener\('selectstart', event=>event\.preventDefault\(\)\)/);
 assert.match(combo,/addEventListener\('dragstart', event=>event\.preventDefault\(\)\)/);
 assert.match(combo,/setTimeout\([\s\S]*?enabledInput\.checked=!enabledInput\.checked/);
});

test('regular plan separates long exercise name from work/rest without losing timing',()=>{
 const config=clonePreset('classic1');
 const rows=compileProgram([{
  presetId:'classic1',title:'Плиометрика',settings:{...config,rounds:1,workSec:10,restSec:10},
  roundNames:['Выпрыгивание с высокой амплитудой из приседа']
 }],{classic1:config});
 const markup=buildLadderPlanRows({programRounds:rows});
 assert.match(markup,/<span class="ladder-plan-name">Раунд 1 · Выпрыгивание с высокой амплитудой из приседа<\/span><span class="ladder-plan-timing">работа 00:10 · отдых —<\/span>/);
 assert.match(css,/\.ladder-live-row:not\(\.ft-two-phase-plan\) \.ladder-plan/);
 assert.match(css,/\.ladder-live-row \.ladder-plan-timing/);
});

test('steel active rest and program title; active preset has distinct graphite outline',()=>{
 assert.match(css,/\.preset-row \.preset-tab\.is-active[\s\S]*?outline:3px solid #223e43!important/);
 assert.match(css,/\.ladder-live-list \.ladder-rest-row\.is-active \.ladder-count/);
 assert.match(css,/\.program-panel \.program-current-duration::first-letter[\s\S]*?var\(--ft-steel\)!important/);
 assert.match(css,/\.program-library-modal \.ft-library-header>button/);
 assert.match(css,/\.program-library-modal \.ft-saved-program-entry \.ft-program-actions>button/);
});
