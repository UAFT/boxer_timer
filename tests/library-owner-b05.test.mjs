import test from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, LIBRARY, findWorkout, buildSteps } from '../app/js/library/catalog.js';
import { stageForWorkout } from '../app/js/library/native-adapter.js';
import { compileProgram } from '../app/js/core/program.js';
import { clonePreset } from '../app/js/state/presets.js';

const names = [
  'Прямые удары', 'Боковые удары', 'Удары снизу', 'Защитные действия',
  'Свободный стиль в сильной стойке', 'Свободный стиль в слабой стойке', 'Ускорение'
];

test('main workout category retains its identity and drops equipment restriction', () => {
  assert.equal(CATEGORIES.find(([id]) => id === 'boxing')?.[1], 'Бокс');
  assert.equal(LIBRARY.filter(w => w.category === 'boxing').length, 3);
  assert.equal(LIBRARY.length, 37);
  assert.equal(new Set(LIBRARY.map(w => w.id)).size, LIBRARY.length);
  assert.deepEqual(['B01','B02','B05'], LIBRARY.filter(w => w.category === 'boxing').map(w => w.id));
});

test('B05 seven two-minute rounds, six one-minute rests, 20-minute total', () => {
  const workout = findWorkout('B05');
  assert.ok(workout);
  assert.equal(workout.equipment, 'Гантели');
  assert.deepEqual(workout.tasks, names);
  assert.equal(workout.work, 120);
  assert.equal(workout.rest, 60);
  const steps = buildSteps(workout);
  assert.equal(steps.filter(s => s.kind === 'work').length, 7);
  assert.equal(steps.filter(s => s.kind === 'rest').length, 6);
  assert.equal(steps.reduce((s, v) => s + v.seconds, 0), 1200);
  const stage = stageForWorkout(workout);
  assert.ok(stage, 'must be convertible into the existing timer');
  const profiles = Object.fromEntries(['classic1','classic2','classic3','tabata2020x24'].map(x => [x,clonePreset(x)]));
  const rounds = compileProgram([stage],profiles);
  assert.equal(rounds.length, 7);
  assert.deepEqual(rounds.map(r => r.roundName), names);
  assert.deepEqual(rounds.map(r => r.workSec), Array(7).fill(120));
  assert.deepEqual(rounds.map(r => r.restSec), [60,60,60,60,60,60,0]);
  assert.equal(rounds.reduce((sum,r) => sum + r.workSec + r.restSec, 0), 1200);
});
