import test from 'node:test';
import assert from 'node:assert/strict';
import {stageTimingRows} from '../app/js/ui/stage-timing-rows.js';
import {compileProgram} from '../app/js/core/program.js';
import {clonePreset} from '../app/js/state/presets.js';

// The editor's stage card printed the base work/rest even when the rounds differ:
// 03:00/01:00 for a stage whose edited round runs 00:30/00:10, and 01:00 for a
// ladder going 01:00 to 02:30. The library card already showed ranges.
const profiles=Object.fromEntries(['classic3','classic2','classic1','tabata2020x24'].map(id=>[id,clonePreset(id)]));
const card=entry=>{const rounds=compileProgram([entry],profiles,{cycles:1});return Object.fromEntries(stageTimingRows(entry.settings||profiles[entry.presetId],{rounds,total:0}));};

test('a per-round edit widens the card to the real work and rest range',()=>{
 const entry={presetId:'classic3',title:'',restAfterSec:0,settings:{...clonePreset('classic3'),rounds:3,workSec:180,restSec:60},
  roundTimingOverrides:[{workSec:30,restSec:10}]};
 const rows=card(entry);
 assert.equal(rows['program-stage-work'],'работа 00:30–03:00');
 assert.equal(rows['program-stage-rest'],'отдых 00:10–01:00');
});

test('a ladder shows its range; a uniform stage reads exactly as before',()=>{
 const ladder={presetId:'classic1',title:'',restAfterSec:0,settings:{...clonePreset('classic1'),intervalMode:'ladder',rounds:4,workSec:60,workStepSec:30,restSec:30,restStepSec:0}};
 assert.equal(card(ladder)['program-stage-work'],'работа 01:00–02:30');
 assert.equal(card(ladder)['program-stage-rest'],'отдых 00:30');
 const plain={presetId:'classic3',title:'',restAfterSec:60};
 assert.equal(card(plain)['program-stage-work'],'работа 03:00');
 assert.equal(card(plain)['program-stage-rest'],'отдых 01:00');
});
