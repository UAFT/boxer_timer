import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stageTimingRows } from '../app/js/ui/stage-timing-rows.js';
import { compileProgram, normalizeProgram } from '../app/js/core/program.js';
import { LIBRARY, stageForWorkout } from '../app/js/library/native-adapter.js';

const app = readFileSync(new URL('../app/js/app.js', import.meta.url), 'utf8');
const view = readFileSync(new URL('../app/js/diary/calendar-view.js', import.meta.url), 'utf8');

test('two-phase summary: «label — time» pairs from one shared formatter, RU and EN, true timings', () => {
  const config = { intervalMode: 'two_phase', rounds: 5, workSec: 60, phaseTwoSec: 40, restSec: 60 };
  const rounds = compileProgram([{ presetId: 'classic3', title: '', settings: config }], {}, { cycles: 1 });
  const total = rounds.reduce((s, r) => s + r.workSec + r.phaseTwoSec + r.restSec, 0);
  assert.deepEqual(stageTimingRows(config, { total, rounds }), [
    ['program-stage-two-phase-meta', '5 раундов · фаза 1 — 01:00 · фаза 2 — 00:40 · отдых — 01:00'], ['program-stage-sum', 'Всего: 12:20']]);
  assert.equal(stageTimingRows(config, { total, rounds }, true)[0][1], '5 rounds · phase 1 — 01:00 · phase 2 — 00:40 · rest — 01:00');
  assert.doesNotMatch(stageTimingRows(config, { total, rounds }, true)[0][1], /\//);
  // Program and Diary both draw stage timing through renderStageCards → stageTimingRows.
  assert.equal(app.match(/stageTimingRows\(/g).length, 1);
});

test('× of a Diary stage: the only stage → the ⋮ «Удалить из календаря» handler; 2+ stages → only that stage, confirmed', () => {
  assert.ok(app.includes('if (t.removeStage) return t.removeStage(index,trigger);'));
  assert.ok(app.includes('if(entries.length<=1)return removeWorkout(trigger);'));
  assert.ok(app.includes("title:'Удалить этап?'") && app.includes("title:'Remove the stage?'"));
  // One handler for both entry points.
  assert.equal(view.match(/removeAssignment\(diary, session, name, /g).length, 3); // the handler + ⋮ + × of the only stage
  assert.equal(view.match(/host\.confirmRemove\(/g).length, 1);
  // Buttons never reach the stage's expand/collapse handler; ↑ ↓ are disabled at the ends; the toolbar shows open or closed.
  assert.ok(app.includes("b.addEventListener('click',e=>{e.stopPropagation();fn(b);});"));
  assert.ok(app.includes("['↑',()=>moveProgramStage(i,-1,target),i===0],['↓',()=>moveProgramStage(i,1,target),i===entries.length-1]"));
  assert.ok(app.includes('    if (editable) {\n      const edit='));
});

test('«Добавить этап» inserts library stages into the same appointment, never a new workout; completed records stay read-only', () => {
  assert.ok(view.includes("if (session.status === 'planned' && host.addStages) stages.append(button(doc, 'ft-diary-add-stage', t.addStage,"));
  assert.ok(view.includes("addStage: 'Добавить этап'") && view.includes("addStage: 'Add stage'"));
  assert.ok(app.includes('if(draft.insert)return false;'));
  assert.ok(app.includes('libraryDraft.entries.length>(libraryDraft.base||0)'));
  // A done record keeps the compact read-only cards (no editor host).
  assert.ok(view.includes("if (session.status === 'planned' && host.renderStages)"));
});

test('stages copied from the library are independent snapshots; picking one block twice gives two equal, separate stages', () => {
  const workout = LIBRARY.find(w => stageForWorkout(w)?.roundNames?.length);
  const before = JSON.stringify(stageForWorkout(workout));
  const entries = normalizeProgram([stageForWorkout(workout), stageForWorkout(workout)]);
  assert.equal(JSON.stringify(entries[0]), JSON.stringify(entries[1]));
  entries[0].roundNames[0] = 'changed'; entries[0].settings.rounds = 9;
  assert.notEqual(entries[1].roundNames[0], 'changed');
  assert.equal(JSON.stringify(stageForWorkout(workout)), before);
  assert.equal(Object.hasOwn(entries[1], 'metronome'), false);
});
