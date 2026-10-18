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
