import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileProgram, startIndex } from '../app/js/core/program.js';
import { createRecorder, applyRun } from '../app/js/diary/recorder.js';
import { ladderPlanPhaseCaption } from '../app/js/ui/ladder-plan-rows.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const base = { workStepSec: 0, restStepSec: 0, phaseTwoStepSec: 0, ladderEnabled: false, blockEnabled: false, blockCount: 1, blockRestSec: 0 };
const entries = [
  { presetId: 'classic3', title: 'A', restAfterSec: 15, settings: { ...base, intervalMode: 'standard', rounds: 3, workSec: 20, restSec: 10 },
    roundTimingOverrides: [null, { workSec: 25, restSec: 12 }], metronome: { enabled: true, mode: 'direct', bpm: 60, perRound: true, roundBpm: [null, 120, 30] } },
  { presetId: 'classic2', title: 'B', restAfterSec: 10, settings: { ...base, intervalMode: 'two_phase', rounds: 2, workSec: 10, phaseTwoSec: 8, restSec: 6 } },
  { presetId: 'classic1', title: '', settings: { ...base, intervalMode: 'ladder', ladderEnabled: true, rounds: 3, workSec: 10, workStepSec: 5, restSec: 5 } }
];
const memory = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };

test('startIndex: position in the first cycle; later cycles whole; no such position → -1', () => {
  const rounds = compileProgram(entries, {}, { cycles: 2, cycleRestSec: 20 });
  assert.equal(rounds.length, 16);
  assert.equal(startIndex(rounds, 0, 1), 0);
  const i = startIndex(rounds, 1, 2), rest = rounds.slice(i);
  assert.equal(i, 4);
  assert.deepEqual([rest[0].stageIndex, rest[0].stageRound, rest[0].phaseTwoSec, rest[0].restSec], [1, 2, 8, 10]);
  assert.equal(rest.filter(r => r.cycleIndex === 1).length, 8);
  // per-round override and tempo travel with their round
  const r2 = rounds[startIndex(rounds, 0, 2)];
  assert.deepEqual([r2.workSec, r2.restSec, r2.metronome.bpm], [25, 12, 120]);
  for (const [s, r] of [[3, 1], [0, 4], [1, 0], [-1, 1]]) assert.equal(startIndex(rounds, s, r), -1);
});

test('plan caption counts every stage when the run starts at a later stage', () => {
  const rounds = compileProgram(entries, {}, { cycles: 1 });
  const config = { programRounds: rounds.slice(startIndex(rounds, 1, 2)) };
  assert.equal(ladderPlanPhaseCaption({ phase: 'work', roundIndex: 1, config }), 'Этап 2 из 3 · Раунд 2 · Фаза 1');
});

test('recorder: a run started past round 1 is partial even when it reaches the end; skipped rounds are never done', () => {
  const storage = memory();
  const rec = createRecorder({ storage, now: () => 1000 });
  rec.begin({ snap: { name: 'x', entries, options: {} }, roundsTotal: 8, startFrom: { stage: 2, round: 2, skipped: 4 }, origin: 'program' });
  const run = rec.finish(true);
  assert.deepEqual([run.status, run.roundsDone, run.roundsTotal, run.startFrom.skipped], ['partial', 4, 8, 4]);
  const draft = { sessions: [], snapshots: {} };
  applyRun(draft, run);
  assert.deepEqual(draft.sessions[0].facts.startFrom, { stage: 2, round: 2, skipped: 4 });
  assert.equal(draft.sessions[0].status, 'partial');
  // a normal start is unchanged: done, every round
  rec.begin({ snap: { name: 'x', entries, options: {} }, roundsTotal: 8, origin: 'program' });
  const full = rec.finish(true);
  assert.deepEqual([full.status, full.roundsDone, 'startFrom' in full], ['done', 8, false]);
});

test('one control and one engine for the editor, the plan and the diary', () => {
  const app = read('app/js/app.js'), diary = read('app/js/diary/calendar-view.js'), html = read('app/index.html');
  assert.match(app, /for \(const id of \['programStartFrom','ladderStartFrom'\]\)[^\n]*renderStartFrom\(/);
  assert.match(diary, /renderStartFrom\(doc, \{ rounds: compileProgram\(entries, \{\}, \{ cycles: 1 \}\), onStart: from => host\.startSession\(session, snap, from\) \}\)/);
  assert.match(app, /startSession:async\(session,snap,from=null\)=>\{[\s\S]*?startProgram\(from\);/);
  assert.match(app, /programSnapshot = compiled\.slice\(skipped\);/);
  assert.equal((app.match(/startIndex\(/g) || []).length, 1);
  // below «Запустить программу»; below the plan's total/Play/remaining row
  assert.ok(html.indexOf('id="programStartFrom"') > html.indexOf('id="programStart"'));
  assert.ok(html.indexOf('id="ladderStartFrom"') > html.indexOf('id="ladderProgramRemaining"'));
  assert.doesNotMatch(html + app + diary, /Начать отсюда/);
});

test('a stage metronome in the saved editor program no longer stops the start-up (smallLine is hoisted)', () => {
  const app = read('app/js/app.js');
  assert.match(app, /\nfunction smallLine\(className,text\) \{/);
  assert.doesNotMatch(app, /const smallLine=/);
});

test('Settings «Подписка»: Restore | Manage 1fr 1fr or stacked, centred, words never break, hidden stays hidden', () => {
  const kit = read('app/styles/fight-tech-ui-kit.css'), paywall = read('app/js/billing/paywall.js');
  assert.match(kit, /\.ft-subscription-actions\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\);align-items:stretch\}/);
  assert.match(kit, /\.ft-subscription-actions\.is-stacked\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(kit, /\.ft-subscription-actions button\[hidden\]\{display:none\}/);
  assert.match(kit, /\.ft-subscription-actions button\{display:flex;align-items:center;justify-content:center;text-align:center;[^}]*overflow-wrap:normal;word-break:normal;hyphens:none\}/);
  assert.match(paywall, /b\.scrollWidth > b\.clientWidth \+ 1\)\) actions\.classList\.add\('is-stacked'\)/);
  assert.match(read('app/index.html'), /id="ftSubscriptionManage" hidden>Управление в Google Play</);
});
