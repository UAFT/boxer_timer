// G3/G4 (owner 2026-11-02): one diary as a self-contained file — every workout with its full snapshot (stages,
// rounds, names, times, two phases, ladder, metronome, cycles), dates and statuses. Nothing refers to the sender's
// library or «Мои». Versioned and validated; read and written offline. An import replaces one diary as a whole.
import { MAX_TITLE, normalizeOptions, normalizeProgram } from '../core/program.js';
import { checkEntries, WorkoutFileError } from '../sharing/workout-file.js';

export const DIARY_FILE_FORMAT = 'fighttech.diary';
export const DIARY_FILE_VERSION = 1;
export const DIARY_FILE_MAX_BYTES = 16 * 1024 * 1024;
export const DIARY_NAME_MAX = 60;
const MAX_SESSIONS = 50000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
// A real day of a plausible year: «2026-13-45» would never show in the calendar, «0000»/«9999» would stretch its
// year list to thousands of entries (release audit 0.2.213, R8).
const calendarDay = v => {
  if (typeof v !== 'string' || !DATE.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number), day = new Date(Date.UTC(y, m - 1, d));
  return y >= 1970 && y <= 2199 && day.getUTCMonth() === m - 1 && day.getUTCDate() === d;
};
const STATUSES = new Set(['planned', 'in_progress', 'partial', 'done', 'canceled']);
const invalid = () => { throw new WorkoutFileError('invalid'); };
const plain = v => v !== null && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const str = (v, max) => typeof v === 'string' && v.length <= max;
const count = v => Number.isInteger(v) && v >= 0 && v <= 1e7;
const time = v => Number.isFinite(v) && v >= 0 && v < 1e14;

// Exactly the fields a diary session has (store.js, recorder.js, calendar-view.js); anything else is not carried over.
function checkSession(s, snapshots) {
  if (!plain(s) || !str(s.id, 80) || !s.id || !calendarDay(s.date) || !STATUSES.has(s.status)) invalid();
  if (!str(s.planRef, 80) || !Object.hasOwn(snapshots, s.planRef)) invalid();
  if (s.execRef != null && (!str(s.execRef, 80) || !Object.hasOwn(snapshots, s.execRef))) invalid();
  if (s.programId != null && !str(s.programId, 120)) invalid();
  for (const k of ['origin', 'runId', 'repeatOf']) if (s[k] != null && !str(s[k], 80)) invalid();
  for (const k of ['createdAt', 'updatedAt', 'startedAt', 'endedAt', 'canceledAt']) if (s[k] != null && !time(s[k])) invalid();
  const out = {};
  for (const k of ['id', 'date', 'status', 'programId', 'planRef', 'execRef', 'origin', 'createdAt', 'updatedAt', 'runId', 'startedAt', 'endedAt', 'canceledAt', 'repeatOf'])
    if (s[k] !== undefined) out[k] = s[k];
  if (s.facts != null) {
    const f = s.facts;
    if (!plain(f) || !count(f.roundsDone ?? 0) || !count(f.roundsTotal ?? 0) || !count(f.activeSec ?? 0)) invalid();
    out.facts = { roundsDone: f.roundsDone ?? 0, roundsTotal: f.roundsTotal ?? 0, activeSec: f.activeSec ?? 0 };
    if (f.startFrom != null) {
      const p = f.startFrom;
      if (!plain(p) || ![p.stage, p.round, p.skipped].every(count)) invalid();
      out.facts.startFrom = { stage: p.stage, round: p.round, skipped: p.skipped };
    }
  }
  return out;
}
// A workout snapshot: what the diary stored (diarySnap in app.js). Normalizing it gives back the same object.
function checkSnapshot(snap) {
  if (!plain(snap) || !str(snap.name ?? '', MAX_TITLE) || !Array.isArray(snap.entries)) invalid();
  const options = normalizeOptions(snap.options);
  if (snap.entries.length) checkEntries(snap.entries, options);
  const entries = normalizeProgram(snap.entries);
  if (entries.length !== snap.entries.length) invalid();
  return { name: snap.name ?? '', entries, options };
}

// diary: {name, sessions, snapshots}. Only snapshots that a session uses are written.
export function serializeDiaryFile({ name, sessions, snapshots }, now = new Date()) {
  const used = new Set(sessions.flatMap(s => [s.planRef, s.execRef]).filter(Boolean));
  const value = { format: DIARY_FILE_FORMAT, version: DIARY_FILE_VERSION, exportedAt: now.toISOString(), diary: { name: String(name || '').slice(0, DIARY_NAME_MAX) },
    sessions, snapshots: Object.fromEntries(Object.entries(snapshots).filter(([ref]) => used.has(ref))) };
  const json = JSON.stringify(value);
  parseDiaryFile(json); // our own export obeys the same contract as an import
  return json;
}

// → {name, exportedAt, sessions, snapshots, summary:{workouts, from, to}}. Throws WorkoutFileError(invalid|version|too_large).
export function parseDiaryFile(contents) {
  if (typeof contents !== 'string' || new TextEncoder().encode(contents).length > DIARY_FILE_MAX_BYTES) throw new WorkoutFileError('too_large');
  let value;
  try { value = JSON.parse(contents); } catch { invalid(); }
  if (!plain(value) || value.format !== DIARY_FILE_FORMAT) invalid();
  if (value.version !== DIARY_FILE_VERSION) throw new WorkoutFileError('version');
  if (!plain(value.diary) || !str(value.diary.name ?? '', DIARY_NAME_MAX) || !Array.isArray(value.sessions) || value.sessions.length > MAX_SESSIONS
    || !plain(value.snapshots) || Object.keys(value.snapshots).length > MAX_SESSIONS * 2) invalid();
  const snapshots = {};
  for (const [ref, snap] of Object.entries(value.snapshots)) { if (!str(ref, 80) || !ref) invalid(); snapshots[ref] = checkSnapshot(snap); }
  const sessions = value.sessions.map(s => checkSession(s, snapshots));
  if (new Set(sessions.map(s => s.id)).size !== sessions.length) invalid();
  const dates = sessions.filter(s => s.status !== 'canceled').map(s => s.date).sort();
  return { name: value.diary.name ?? '', exportedAt: str(value.exportedAt, 40) ? value.exportedAt : '', sessions, snapshots,
    summary: { workouts: dates.length, from: dates[0] || '', to: dates[dates.length - 1] || '' } };
}

export function diaryFileName(name, date) {
  const cleaned = String(name || '').normalize('NFC').replace(/\s+/g, '_').replace(/[^\p{L}\p{N}_-]/gu, '').slice(0, 40).replace(/^_+|_+$/g, '');
  return 'Fight_Tech_' + (cleaned ? cleaned + '_' : '') + date + '.ftdiary';
}
