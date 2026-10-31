// STAGE 3: what a timer run actually did, recorded into the diary. Nothing here invents progress:
// rounds count only once their work phase has ended, time only while the timer runs (not paused, not the countdown).
// The run in progress is mirrored to localStorage so a crash or kill still leaves its real progress behind.
import { writeJson } from '../state/storage.js';
import { localDate, newId, newSession, putSnapshot } from './store.js';

export const RUN_KEY = 'fighttech.diary.run.v1';
export const RECORD_KEY = 'fighttech.diary.record.v1';
const WORKING = new Set(['work', 'work_two', 'count_up']);

// Gear setting «Запись тренировок в дневник»: 'auto' records at once, anything else asks first.
export function recordMode(storage = globalThis.localStorage) {
  try { return JSON.parse(storage.getItem(RECORD_KEY)) === 'auto' ? 'auto' : 'ask'; } catch { return 'ask'; }
}

// Rounds whose work is over, from a timer state: rest/finished after round r means r is done; work of r means r-1.
export function roundsDoneFrom(state) {
  const r = Number(state?.roundIndex) || 0;
  if (state?.phase === 'rest' || state?.phase === 'block_rest' || state?.phase === 'finished') return r;
  if (WORKING.has(state?.phase) || state?.phase === 'countdown') return Math.max(0, r - 1);
  return 0;
}

export function createRecorder({ storage = globalThis.localStorage, now = () => Date.now() } = {}) {
  let run = null, lastPhase = 'idle', lastPaused = false, savedAt = 0;
  // ponytail: whole-run rewrite every phase change and at most every 10 s; a crash loses at most 10 s of counted time.
  const save = () => { savedAt = now(); writeJson(RUN_KEY, run, storage); };
  return {
    get active() { return run; },
    // snap: the program exactly as started (edits made before Start included). link: {sessionId, programId}.
    begin({ snap, roundsTotal, sessionId = null, programId = null, origin }) {
      const t = now();
      run = { runId: newId('r'), date: localDate(new Date(t)), startedAt: t, updatedAt: t, snap, roundsTotal, sessionId, programId, origin,
        roundsDone: 0, activeMs: 0 };
      lastPhase = 'idle'; lastPaused = false;
      save();
    },
    // Called on every timer state change and tick; time counts only between two observations of a running phase.
    observe(state, paused) {
      if (!run) return;
      const t = now();
      if (!lastPaused && lastPhase !== 'idle' && lastPhase !== 'countdown' && lastPhase !== 'finished') run.activeMs += Math.max(0, t - run.updatedAt);
      run.updatedAt = t;
      const done = Math.max(run.roundsDone, roundsDoneFrom(state));
      const changed = done !== run.roundsDone || state?.phase !== lastPhase || paused !== lastPaused;
      run.roundsDone = done; lastPhase = state?.phase || 'idle'; lastPaused = !!paused;
      if (changed || t - savedAt >= 10000) save();
    },
    // completed: the timer reached its end. Returns the finished run, or null when nothing was actually done.
    finish(completed) {
      if (!run) return null;
      const ended = run;
      run = null;
      ended.endedAt = now();
      ended.status = completed ? 'done' : 'partial';
      if (completed) ended.roundsDone = ended.roundsTotal || ended.roundsDone;
      if (!completed && !ended.roundsDone && ended.activeMs < 1000) { storage.removeItem(RUN_KEY); return null; }
      writeJson(RUN_KEY, ended, storage);
      return ended;
    },
    // A run left behind by a crash or kill: its last saved progress, never more. Null when there is none.
    leftover() {
      if (run) return null;
      let saved;
      try { saved = JSON.parse(storage.getItem(RUN_KEY) || 'null'); } catch { return null; }
      if (!saved || typeof saved.runId !== 'string' || !saved.snap) return null;
      if (!saved.status) {
        if (!saved.roundsDone && saved.activeMs < 1000) { storage.removeItem(RUN_KEY); return null; }
        saved.status = 'partial'; saved.endedAt = saved.updatedAt;
      }
      return saved;
    },
    // Recorded or declined: the run is settled and never offered again.
    settle(runId) {
      try { if (JSON.parse(storage.getItem(RUN_KEY) || 'null')?.runId === runId) storage.removeItem(RUN_KEY); } catch { storage.removeItem(RUN_KEY); }
    }
  };
}

// Diary mutation for one finished run. Idempotent: a run already in the diary is never added twice.
// A run fills the assignment it was opened from, or a not-started assignment of the same program, on its start date;
// otherwise it becomes a new session. The start date is the record's date even if the run ended after midnight.
export function applyRun(draft, run) {
  if (draft.sessions.some(s => s.runId === run.runId)) return false;
  const execRef = putSnapshot(draft.snapshots, run.snap);
  const open = s => s.status === 'planned' && s.date === run.date;
  const target = draft.sessions.find(s => s.id === run.sessionId && open(s))
    || (run.programId ? draft.sessions.find(s => open(s) && s.programId === run.programId) : null);
  const session = target || newSession(draft.snapshots, { date: run.date, snap: run.snap, programId: run.programId, origin: run.origin });
  Object.assign(session, { status: run.status, execRef, runId: run.runId, startedAt: run.startedAt, endedAt: run.endedAt, updatedAt: run.endedAt,
    facts: { roundsDone: run.roundsDone, roundsTotal: run.roundsTotal, activeSec: Math.round(run.activeMs / 1000) } });
  if (!target) draft.sessions.push(session);
}
