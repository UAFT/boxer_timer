// Training diary storage. STAGE 1 only reads; planning (STAGE 2) and run capture (STAGE 3) will write.
// A session belongs only to the local calendar date it started on, even if it ends after midnight.
export const DIARY_KEY = 'fighttech.diary.v1';
export const DIARY_SCHEMA = 1;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = new Set(['planned', 'in_progress', 'partial', 'done', 'canceled']);

export function localDate(d = new Date()) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Unknown schema or broken JSON reads as empty and is never overwritten here.
export function readDiary(storage = globalThis.localStorage) {
  let raw;
  try { raw = JSON.parse(storage.getItem(DIARY_KEY) || 'null'); } catch { return []; }
  if (!raw || raw.schema !== DIARY_SCHEMA || !Array.isArray(raw.sessions)) return [];
  return raw.sessions.filter(s => s && typeof s.id === 'string' && DATE.test(s.date) && STATUSES.has(s.status));
}

// What the calendar shows for one session on a given day.
function view(session, date, today) {
  if (session.status === 'done') return 'done';
  if (session.status === 'planned') return date < today ? 'missed' : 'planned';
  return 'incomplete';
}

// Day chip: empty | planned | done | partial | missed. Canceled sessions do not count.
// ponytail: done + still-planned on today/future shows as partial; flagged to the owner as ambiguous.
export function dayStatus(sessions, date, today) {
  const views = sessions.filter(s => s.date === date && s.status !== 'canceled').map(s => view(s, date, today));
  if (!views.length) return 'empty';
  for (const only of ['done', 'planned', 'missed']) if (views.every(v => v === only)) return only;
  return 'partial';
}

// Dots appear only with two or more sessions: done = dark green, not completed = gray, planned ahead = none.
export function dayDots(sessions, date, today) {
  const views = sessions.filter(s => s.date === date && s.status !== 'canceled').map(s => view(s, date, today));
  if (views.length < 2) return [];
  return views.filter(v => v !== 'planned').map(v => v === 'done' ? 'done' : 'open');
}

// Monday-first month grid: leading nulls, then 'YYYY-MM-DD' for each day.
export function monthCells(year, month) {
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells = Array(lead).fill(null);
  for (let d = 1; d <= days; d++) cells.push(localDate(new Date(year, month, d)));
  return cells;
}
