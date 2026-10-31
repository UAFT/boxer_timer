import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { beatInterval, metronomeLine, normalizeStageMetronome, roundBpm } from '../app/js/core/metronome-plan.js';
import { compileProgram, normalizeProgram } from '../app/js/core/program.js';
import { parseWorkoutFile, serializeWorkoutFile } from '../app/js/sharing/workout-file.js';
import { newSession, putSnapshot } from '../app/js/diary/store.js';
import { LIBRARY, stageForWorkout } from '../app/js/library/native-adapter.js';
import { MetronomeEngine } from '../app/js/audio/metronome-engine.js';
import { PHASES } from '../app/js/core/constants.js';

const settings = (rounds = 3) => ({ intervalMode: 'standard', rounds, workSec: 60, restSec: 30, phaseTwoSec: 30, ladderEnabled: false, blockEnabled: false });
const stage = (metronome, rounds = 3) => ({ presetId: 'classic3', title: 'A', restAfterSec: 60, settings: settings(rounds), ...(metronome ? { metronome } : {}) });

test('60 / BPM: exact decimals, local decimal sign, «≈» only when rounded', () => {
  assert.deepEqual([8, 6, 5, 15, 30, 60, 300].map(b => beatInterval(b, 'ru')), ['7,5', '10', '12', '4', '2', '1', '0,2']);
  assert.equal(beatInterval(8, 'en'), '7.5');
  assert.equal(beatInterval(7, 'ru'), '≈8,57');
  assert.equal(beatInterval(9, 'en'), '≈6.67');
  assert.equal(beatInterval(16, 'ru'), '3,75');
  assert.equal(metronomeLine(8, 'ru'), '8 уд/мин · каждые 7,5 с');
  assert.equal(metronomeLine(8, 'en'), '8 beats/min · every 7.5 sec');
  assert.doesNotMatch(metronomeLine(7, 'en'), /[А-Яа-яЁё]/);
});

test('stage metronome is normalized; invalid tempos fall back, rounds without a tempo use the stage tempo', () => {
  assert.equal(normalizeStageMetronome(null), null);
  assert.equal(normalizeStageMetronome([1]), null);
  const m = normalizeStageMetronome({ enabled: true, mode: 'subdivided', bpm: 0, perRound: true, roundBpm: [8, '6', 5.5, 301, null] });
  assert.deepEqual(m, { enabled: true, mode: 'subdivided', bpm: 20, perRound: true, roundBpm: [8, 6] });
  assert.deepEqual([1, 2, 3, 4, 9].map(n => roundBpm(m, n)), [8, 6, 20, 20, 20]);
  assert.equal(roundBpm({ ...m, perRound: false }, 1), 20);
  assert.equal(normalizeStageMetronome({ mode: 'x', bpm: 15 }).mode, 'direct');
});

test('each stage has its own tempo; a stage can step its tempo per round; others keep the timer metronome', () => {
  const rounds = compileProgram([
    stage({ enabled: true, bpm: 15 }, 2),
    stage({ enabled: true, bpm: 30, mode: 'subdivided' }, 2),
    stage({ enabled: true, bpm: 8, perRound: true, roundBpm: [8, 6, 5] }, 3),
    stage({ enabled: false, bpm: 40 }, 1),
    stage(null, 1)
  ], {});
  assert.deepEqual(rounds.map(r => r.metronome ? r.metronome.bpm + r.metronome.mode[0] : '-'), ['15d', '15d', '30s', '30s', '8d', '6d', '5d', '-', '-']);
  // Rounds added later inherit the stage tempo; the stored per-round tempos stay.
  const grown = compileProgram([stage({ enabled: true, bpm: 8, perRound: true, roundBpm: [8, 6, 5] }, 5)], {});
  assert.deepEqual(grown.map(r => r.metronome.bpm), [8, 6, 5, 8, 8]);
  const shrunk = normalizeProgram([stage({ enabled: true, bpm: 8, perRound: true, roundBpm: [8, 6, 5] }, 1)]);
  assert.deepEqual(shrunk[0].metronome.roundBpm, [8, 6, 5]);
});

test('stages without a metronome keep their stored shape (no new key, same snapshot hash)', () => {
  const [plain] = normalizeProgram([stage(null)]);
  assert.equal(Object.hasOwn(plain, 'metronome'), false);
  assert.equal(Object.hasOwn(compileProgram([plain], {})[0], 'metronome'), false);
});

test('the metronome survives My/Diary normalization and a workout file round trip', () => {
  const entries = normalizeProgram([stage({ enabled: true, bpm: 8, perRound: true, roundBpm: [8, 6, 5] })]);
  const back = parseWorkoutFile(serializeWorkoutFile({ name: 'M', entries, options: { cycles: 1, cycleRestSec: 60 } }));
  assert.deepEqual(back.entries[0].metronome, entries[0].metronome);
  assert.throws(() => parseWorkoutFile(JSON.stringify({ format: 'fighttech.workout', version: 2, name: 'x', options: { cycles: 1, cycleRestSec: 0 },
    entries: [{ ...entries[0], metronome: { roundBpm: 'x' } }] })));
});

test('a copy taken from the library is independent: editing it never changes the library', () => {
  const workout = LIBRARY.find(w => stageForWorkout(w));
  const before = JSON.stringify(stageForWorkout(workout));
  const [copy] = normalizeProgram([stageForWorkout(workout)]);
  copy.title = 'changed'; copy.roundNames[0] = 'changed'; copy.settings.rounds = 99;
  copy.metronome = normalizeStageMetronome({ enabled: true, bpm: 8 });
  assert.equal(JSON.stringify(stageForWorkout(workout)), before);
});

test('two dates of one program are independent: editing one appointment leaves the other date as it was', () => {
  const snapshots = {}, snap = { name: 'P', entries: normalizeProgram([stage(null)]), options: { cycles: 1, cycleRestSec: 60 } };
  const a = newSession(snapshots, { date: '2026-11-18', snap, origin: 'save' });
  const b = newSession(snapshots, { date: '2026-11-19', snap, origin: 'save' });
  assert.equal(a.planRef, b.planRef);
  const edited = structuredClone(snap); edited.entries[0].metronome = normalizeStageMetronome({ enabled: true, bpm: 6 }); edited.entries[0].roundNames = ['Скакалка'];
  a.planRef = putSnapshot(snapshots, edited);
  assert.notEqual(a.planRef, b.planRef);
  assert.equal(Object.hasOwn(snapshots[b.planRef].entries[0], 'metronome'), false);
  assert.deepEqual(snapshots[a.planRef].entries[0].roundNames, ['Скакалка']);
});

test('engine: beats only in work, every 60/BPM ms; a tempo change restarts the count; rest and pause are silent', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  globalThis.window = { setTimeout, clearTimeout };
  const plays = [];
  const engine = new MetronomeEngine({ unlock: async () => {}, play: async (key) => { plays.push([Date.now(), key]); }, stopTag: () => {} });
  const work = { phase: PHASES.WORK, isPaused: false, remainingSec: 999, config: { countdownEnabled: false } };
  const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
  const advance = async ms => { for (let i = 0; i < ms / 250; i++) { t.mock.timers.tick(250); await flush(); } };
  engine.setConfig({ enabled: true, bpm: 8, mode: 'direct' });
  engine.syncPhase(work); await flush();
  await advance(15000);
  assert.deepEqual(plays.map(p => p[0]), [0, 7500, 15000]);
  plays.length = 0;
  engine.setConfig({ enabled: true, bpm: 6, mode: 'direct' }); await flush();
  await advance(20000);
  assert.deepEqual(plays.map(p => p[0] - 15000), [0, 10000, 20000]);
  plays.length = 0;
  engine.syncPhase({ ...work, phase: PHASES.REST }); await advance(30000);
  engine.syncPhase({ ...work, isPaused: true }); await advance(30000);
  assert.equal(plays.length, 0);
  // Subdivided: the accent and three quieter sub-beats per beat (60/BPM / 4).
  engine.setConfig({ enabled: true, bpm: 15, mode: 'subdivided' });
  engine.syncPhase(work); await flush(); await advance(4000);
  assert.deepEqual(plays.map(p => p[1]), ['metronome_direct', 'metronome_subdivided', 'metronome_subdivided', 'metronome_subdivided', 'metronome_direct']);
  engine.stop(); await advance(10000);
  assert.equal(plays.length, 5);
  delete globalThis.window;
});

test('app wiring: the stage tempo follows the running round and the editor and diary share one stage dialog', () => {
  const app = readFileSync(new URL('../app/js/app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("const stage = programRunning ? programSnapshot?.[Math.max(1, timer.state?.roundIndex || 1) - 1]?.metronome : null;"));
  assert.equal(app.match(/followStageMetronome\(\);\n    metronome\.syncPhase\(state\);/g).length, 2);
  assert.ok(app.includes('openStageSettings(i,target)') && app.includes('renameProgramRound(i,j,false,edit,target)'));
  assert.equal(app.match(/function openStageSettings\(/g).length, 1);
  const view = readFileSync(new URL('../app/js/diary/calendar-view.js', import.meta.url), 'utf8');
  assert.equal(view.includes('ft-diary-edit'), false);
  const html = readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
  assert.equal(html.match(/id="stageSettingsModal"/g).length, 1);
});
