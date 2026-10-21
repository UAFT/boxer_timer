import test from 'node:test';
import assert from 'node:assert/strict';
import { clonePreset } from '../app/js/state/presets.js';
import { loadProfileState, saveProfileState, normalizeSettings } from '../app/js/state/settings-store.js';
import { workSecForRound } from '../app/js/core/schedule.js';
const storage = new Map();
globalThis.window = { localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) } };
test('independent saved presets', () => {
  const profiles = Object.fromEntries(['classic3','classic2','classic1','tabata2020x24'].map(id => [id, normalizeSettings(null, clonePreset(id))]));
  profiles.classic1.workSec = 45;
  saveProfileState('classic1', profiles);
  const result = loadProfileState();
  assert.equal(result.activeId, 'classic1');
  assert.equal(result.profiles.classic1.workSec, 45);
  assert.equal(result.profiles.classic3.workSec, 180);
});
test('ladder', () => {
  const config = { workSec:60, workStepSec:-20, intervalMode:'ladder' };
  assert.deepEqual([1,2,3].map(i=>workSecForRound(config,i)), [60,40,20]);
});


test('fresh install initializes every preset for long-press without first selecting each tab',()=>{
  storage.clear();
  const result=loadProfileState();
  assert.deepEqual(Object.keys(result.profiles).sort(),['classic1','classic2','classic3','tabata2020x24'].sort());
  for(const id of ['classic1','classic2','classic3','tabata2020x24']) {
    assert.deepEqual(result.profiles[id],clonePreset(id));
  }
});

test('partially saved and migrated profiles retain configured values while filling missing tabs',()=>{
  storage.clear();
  storage.set('andar.fight.timer.profiles.v1',JSON.stringify({activeId:'classic2',profiles:{classic3:{...clonePreset('classic3'),workSec:170},classic2:{...clonePreset('classic2'),restSec:35}}}));
  const saved=loadProfileState();
  assert.equal(saved.activeId,'classic2');
  assert.equal(saved.profiles.classic2.restSec,35);
  assert.equal(saved.profiles.classic3.workSec,170);
  assert.equal(saved.profiles.classic1.workSec,60);
  assert.equal(saved.profiles.tabata2020x24.workSec,20);
  storage.clear();
  storage.set('andar.fight.timer.settings.v11',JSON.stringify({...clonePreset('classic3'),workSec:165}));
  const migrated=loadProfileState();
  assert.equal(migrated.profiles.classic3.workSec,165);
  assert.equal(migrated.profiles.classic2.workSec,120);
  assert.equal(migrated.profiles.classic1.workSec,60);
});
