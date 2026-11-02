// Accumulated UX fixes (owner 2026-11-02): countdown sounds, two-phase stage metronome, 10 BPM default, stage
// identity (sourceId/uid), several diaries and the diary file. Browser acceptance: project evidence CHIEF_ENGINEER_EXECUTION__20261102.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadCountdownProfile, saveSoundProfile, COUNTDOWN_SOUND_KEY, SOUND_PROFILE_KEY } from '../app/js/audio/sound-profile.js';
import { normalizeStageMetronome, phaseOn, programMetronomeConfig, DEFAULT_BPM } from '../app/js/core/metronome-plan.js';
import { compileProgram, normalizeProgram } from '../app/js/core/program.js';
import { serializeDiaryFile, parseDiaryFile, diaryFileName, DIARY_FILE_MAX_BYTES } from '../app/js/diary/diary-file.js';
import { createDiaries, loadRegistry, replaceDiary, readBackup, DIARIES_KEY, MAX_DIARIES } from '../app/js/diary/diaries.js';
import { storageBackend, fileBackend, openDiary } from '../app/js/diary/store.js';

const store = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m }; };
const settings = { intervalMode: 'two_phase', rounds: 2, workSec: 30, phaseTwoSec: 20, restSec: 10, audioEnabled: true, warningSeconds: 4, countdownEnabled: true,
  workStepSec: 0, restStepSec: 0, phaseTwoStepSec: 0, ladderEnabled: false, blockEnabled: false, blockCount: 1, blockRestSec: 0, metronomeBpm: 10, metronomeMode: 'direct' };
const stage = extra => ({ presetId: 'classic3', title: 'Этап', roundNames: [], phaseOneOverrides: [], phaseTwoOverrides: [], roundDescriptions: [], roundTimingOverrides: [], settings, restAfterSec: 0, ...extra });

test('A: countdown sounds — nothing chosen = what 0.2.208 played (follows the metronome); own choice wins after that', () => {
  const s = store();
  assert.deepEqual(loadCountdownProfile(s), { kind: 'click', tone: 'A' });
  saveSoundProfile({ kind: 'electronic', tone: 'B' }, s);
  assert.deepEqual(loadCountdownProfile(s), { kind: 'electronic', tone: 'B' });
  saveSoundProfile({ kind: 'click', tone: 'C' }, s, COUNTDOWN_SOUND_KEY);
  assert.deepEqual(loadCountdownProfile(s), { kind: 'click', tone: 'C' });
  assert.equal(JSON.parse(s.m.get(SOUND_PROFILE_KEY)).kind, 'electronic', 'the metronome choice is untouched');
});

test('C: phases — absent = both (old stages), only one-of-two is stored, [off,off] is never a state', () => {
  assert.equal(normalizeStageMetronome({ enabled: true }).phases, undefined);
  for (const bad of [[true, true], [false, false], [true], ['x', false], null]) assert.equal(normalizeStageMetronome({ enabled: true, phases: bad }).phases, undefined, JSON.stringify(bad));
  assert.deepEqual(normalizeStageMetronome({ phases: [false, true] }).phases, [false, true]);
  const m = { phases: [false, true] };
  assert.equal(phaseOn(m, 'work'), false); assert.equal(phaseOn(m, 'work_two'), true);
  assert.equal(phaseOn({}, 'work'), true); assert.equal(phaseOn({}, 'work_two'), true);
  const round = { metronome: { enabled: true, bpm: 40, mode: 'direct', phases: [true, false] } };
  assert.equal(programMetronomeConfig(round, settings, false, 'work').enabled, true);
  assert.equal(programMetronomeConfig(round, settings, false, 'work_two').enabled, false);
  assert.equal(programMetronomeConfig(round, settings, true, 'work').enabled, false, 'the 10-second lock still wins');
});

test('C: the compiled program carries the phases of a two-phase stage; a stage without them sounds in both', () => {
  const on = compileProgram(normalizeProgram([stage({ metronome: { enabled: true, bpm: 40, phases: [false, true] } })]), {}, { cycles: 1 });
  assert.deepEqual(on[0].metronome.phases, [false, true]);
  const both = compileProgram(normalizeProgram([stage({ metronome: { enabled: true, bpm: 40 } })]), {}, { cycles: 1 });
  assert.equal(both[0].metronome.phases, undefined);
});

test('D: 10 BPM for a new value; a saved tempo is kept', () => {
  assert.equal(DEFAULT_BPM, 10);
  assert.equal(normalizeStageMetronome({ enabled: true }).bpm, 10);
  assert.equal(normalizeStageMetronome({ enabled: true, bpm: 20 }).bpm, 20);
  assert.deepEqual(normalizeStageMetronome({ perRound: true, roundBpm: [null, 60] }).roundBpm, [null, 60]);
});

test('B/E: a stage keeps its source id and its own uid through normalization; bad ones are dropped', () => {
  const [a, b] = normalizeProgram([stage({ sourceId: 'lib:B07', uid: 'st1' }), stage({ sourceId: 7, uid: 'x'.repeat(121) })]);
  assert.equal(a.sourceId, 'lib:B07'); assert.equal(a.uid, 'st1');
  assert.equal(b.sourceId, undefined); assert.equal(b.uid, undefined);
});

test('E: «+» on a saved program appends a copy of every stage (it used to open/replace the workout)', () => {
  const app = readFileSync(new URL('../app/js/app.js', import.meta.url), 'utf8');
  assert.match(app, /onAdd:\(\)=>appendProgram\(entry\)/);
});

const SNAP = { name: 'Тренировка', entries: normalizeProgram([stage({ metronome: { enabled: true, bpm: 40, phases: [false, true] }, sourceId: 'lib:B07' })]), options: { cycles: 2, cycleRestSec: 45 } };
const DIARY = { name: 'Аркадий', snapshots: { s1: SNAP, unused: SNAP }, sessions: [
  { id: 'a', date: '2026-11-01', status: 'done', planRef: 's1', execRef: 's1', programId: null, origin: 'diary', runId: 'r', createdAt: 1, updatedAt: 2, facts: { roundsDone: 4, roundsTotal: 4, activeSec: 200 } },
  { id: 'b', date: '2026-11-09', status: 'planned', planRef: 's1', programId: null, origin: 'diary', createdAt: 1, updatedAt: 1 },
  { id: 'c', date: '2026-12-01', status: 'canceled', planRef: 's1', programId: null, origin: 'diary', createdAt: 1, updatedAt: 1, canceledAt: 3 }] };

test('G3: diary file round trip — every session and its full snapshot; unused snapshots stay home; summary', () => {
  const file = parseDiaryFile(serializeDiaryFile(DIARY, new Date('2026-11-02T10:00:00Z')));
  assert.equal(file.name, 'Аркадий');
  assert.deepEqual(file.sessions, DIARY.sessions);
  assert.deepEqual(Object.keys(file.snapshots), ['s1']);
  assert.deepEqual(file.snapshots.s1, SNAP);
  assert.deepEqual(file.summary, { workouts: 2, from: '2026-11-01', to: '2026-11-09' });
  assert.equal(diaryFileName('Аркадий П.', '2026-11-02'), 'Fight_Tech_Аркадий_П_2026-11-02.ftdiary');
  assert.equal(diaryFileName('', '2026-11-02'), 'Fight_Tech_2026-11-02.ftdiary');
});

test('G4: a damaged, foreign, newer or oversized file is refused with a reason; unknown fields are not carried over', () => {
  const good = JSON.parse(serializeDiaryFile(DIARY));
  const code = text => { try { parseDiaryFile(text); return 'ok'; } catch (e) { return e.code ?? e.message; } };
  assert.equal(code('{'), 'invalid');
  assert.equal(code(JSON.stringify({ ...good, format: 'fighttech.workout' })), 'invalid');
  assert.equal(code(JSON.stringify({ ...good, version: 2 })), 'version');
  assert.equal(code(JSON.stringify({ ...good, sessions: [{ ...good.sessions[0], planRef: 'missing' }] })), 'invalid');
  assert.equal(code(JSON.stringify({ ...good, sessions: [good.sessions[0], good.sessions[0]] })), 'invalid');
  assert.equal(code(JSON.stringify({ ...good, sessions: [{ ...good.sessions[0], status: 'hacked' }] })), 'invalid');
  assert.equal(code(JSON.stringify({ ...good, snapshots: { s1: { ...good.snapshots.s1, entries: [{ presetId: 'x' }] } } })), 'invalid');
  assert.equal(code('x'.repeat(DIARY_FILE_MAX_BYTES + 1)), 'too_large');
  const extra = parseDiaryFile(JSON.stringify({ ...good, sessions: [{ ...good.sessions[0], evil: '<script>' }] }));
  assert.equal(extra.sessions[0].evil, undefined);
});

test('G1: registry — «Мой дневник» always first and undeletable; create, rename, switch, remove; a missing diary opens «Мой дневник»', async () => {
  const s = store({ [DIARIES_KEY]: '{broken' });
  assert.deepEqual(loadRegistry(s), { list: [{ id: 'main', name: '' }], active: 'main' });
  const d = createDiaries({ storage: s, backend: id => storageBackend(s, id) });
  assert.equal(d.name('main', 'en'), 'My diary'); assert.equal(d.name('main', 'ru'), 'Мой дневник');
  const ids = []; for (let i = 0; i < 7; i++) ids.push(d.create('Д' + i));
  assert.equal(d.list.length, 8); assert.equal(d.active, ids[6]);
  assert.ok(d.rename(ids[0], 'Аня')); assert.equal(d.name(ids[0]), 'Аня');
  assert.ok(d.setActive(ids[0])); assert.equal(loadRegistry(s).active, ids[0]);
  assert.equal(await d.remove('main'), false);
  // Records of one diary never land in another.
  assert.notEqual(await (await d.open(ids[0])).commit(x => { x.sessions.push({ id: 'q', date: '2026-11-02', status: 'planned', planRef: 'p' }); x.snapshots.p = SNAP; }), false);
  assert.equal((await d.open(ids[1])).sessions.length, 0);
  assert.equal((await d.open('main')).sessions.length, 0);
  assert.ok(await d.remove(ids[0]));
  assert.equal(d.active, 'main'); assert.equal(d.has(ids[0]), false);
  assert.equal([...s.m.keys()].some(k => k.includes(ids[0] + '.')), false, 'its files are gone');
  assert.equal(await d.open(ids[0]), await d.open('main'));
  while (d.list.length < MAX_DIARIES) d.create('x');
  assert.equal(d.create('one too many'), null);
});

test('G1: «Мой дневник» keeps the exact files and keys of every earlier version', () => {
  const s = store(), paths = [];
  storageBackend(s, 'main').write('a', '1'); storageBackend(s, 'd1').write('a', '1');
  assert.deepEqual([...s.m.keys()], ['fighttech.diary.v1.a', 'fighttech.diary.v1.d1.a']);
  const fs = { writeFile: o => paths.push(o.path) };
  fileBackend(fs, 'main').write('b', ''); fileBackend(fs, 'd1').write('backup', '');
  assert.deepEqual(paths, ['fighttech-diary-b.json', 'fighttech-diary-d1-backup.json']);
});

test('G4: replace = backup first, then one commit; a failed backup or write leaves the diary exactly as it was; restore', async () => {
  const s = store(), b = storageBackend(s, 'd1');
  const diary = await openDiary(b);
  await diary.commit(x => { x.sessions.push({ id: 'old', date: '2026-10-01', status: 'done', planRef: 'p', programId: null, origin: 'timer', createdAt: 1, updatedAt: 1 }); x.snapshots.p = SNAP; });
  const before = structuredClone({ sessions: diary.sessions, snapshots: diary.snapshots });
  const incoming = parseDiaryFile(serializeDiaryFile(DIARY));
  const failing = { ...b, write: async slot => { if (slot === 'backup') throw new Error('disk'); return b.write(slot); } };
  assert.equal(await replaceDiary(diary, failing, incoming, 'Дима'), 'backup_failed');
  assert.deepEqual({ sessions: diary.sessions, snapshots: diary.snapshots }, before);
  const set = s.setItem; s.setItem = (k, v) => { if (/\.d1\.[ab]$/.test(k)) throw new Error('quota'); return set(k, v); };
  assert.equal(await replaceDiary(diary, b, incoming, 'Дима'), 'failed');
  s.setItem = set;
  assert.deepEqual({ sessions: (await openDiary(b)).sessions }, { sessions: before.sessions }, 'nothing half-written on disk');
  const fresh = await openDiary(b);
  assert.equal(await replaceDiary(fresh, b, incoming, 'Дима'), 'ok');
  assert.deepEqual((await openDiary(b)).sessions, incoming.sessions);
  const backup = await readBackup(b);
  assert.deepEqual(backup.sessions, before.sessions);
  assert.equal(await replaceDiary(fresh, b, backup, 'Дима'), 'ok');
  assert.deepEqual((await openDiary(b)).sessions, before.sessions);
});

test('A: the first start of this build writes the inherited countdown choice down (later metronome changes do not move it)', () => {
  const app = readFileSync(new URL('../app/js/app.js', import.meta.url), 'utf8');
  assert.match(app, /let countdownProfile = loadCountdownProfile\(\);\n[^\n]*\nif \(localStorage\.getItem\(COUNTDOWN_SOUND_KEY\) === null\) saveSoundProfile\(countdownProfile, localStorage, COUNTDOWN_SOUND_KEY\);/);
});
