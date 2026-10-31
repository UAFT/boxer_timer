// Training diary storage. History is kept for good: nothing here ever expires or purges a record.
// A session belongs only to the local calendar date it started on, even if it ends after midnight.
// On Android the diary is a file in the app's private data folder (localStorage holds ~5.2M chars for the
// whole app, too little for years of history); a browser keeps the same two slots in localStorage.
export const DIARY_KEY = 'fighttech.diary.v1';
export const DIARY_SCHEMA = 1;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = new Set(['planned', 'in_progress', 'partial', 'done', 'canceled']);
const SLOTS = ['a', 'b'];

export function localDate(d = new Date()) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
export const newId = prefix => prefix + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);

// Two slots written in turn, each carrying a sequence number: a crash mid-write can only spoil the slot being
// written, never the last good copy. No rename is needed, so it does not depend on how the platform replaces files.
export function fileBackend(fs) {
  const path = slot => 'fighttech-diary-' + slot + '.json';
  return {
    async read(slot) {
      try { return (await fs.readFile({ path: path(slot), directory: 'DATA', encoding: 'utf8' })).data; }
      catch (error) { if (/not exist|not found|no such/i.test(String(error?.message || error))) return null; throw error; }
    },
    write: (slot, text) => fs.writeFile({ path: path(slot), directory: 'DATA', encoding: 'utf8', data: text })
  };
}
export function storageBackend(storage = globalThis.localStorage) {
  return {
    async read(slot) { return storage.getItem(DIARY_KEY + '.' + slot); },
    async write(slot, text) { storage.setItem(DIARY_KEY + '.' + slot, text); }
  };
}
export function defaultBackend(win = globalThis) {
  const fs = win.Capacitor?.isNativePlatform?.() && win.Capacitor?.Plugins?.Filesystem;
  return fs ? fileBackend(fs) : storageBackend(win.localStorage);
}

function validSessions(list) {
  return (Array.isArray(list) ? list : []).filter(s => s && typeof s.id === 'string' && DATE.test(s.date) && STATUSES.has(s.status));
}
// Snapshots are stored once by content; sessions point at them. Repeating a program adds only its session row.
function hash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h.toString(36) + text.length.toString(36);
}
export function putSnapshot(snapshots, snap) {
  const text = JSON.stringify(snap);
  for (let n = 0; ; n++) {
    const ref = 's' + hash(text) + (n ? '-' + n : '');
    if (!snapshots[ref]) { snapshots[ref] = JSON.parse(text); return ref; }
    if (JSON.stringify(snapshots[ref]) === text) return ref;
  }
}

// Snapshots no session points at any more (an edited draft, a permanently deleted record). Canceled sessions keep theirs.
export function dropUnused(draft) {
  const used = new Set(draft.sessions.flatMap(s => [s.planRef, s.execRef]));
  for (const ref of Object.keys(draft.snapshots)) if (!used.has(ref)) delete draft.snapshots[ref];
}

// state: ok | newer (written by a later app version) | damaged (no readable copy). Only ok is ever written,
// so a file this version cannot read is left exactly as it is.
export async function openDiary(backend = defaultBackend()) {
  const copies = [];
  let unreadable = 0, newer = false;
  for (const slot of SLOTS) {
    let raw;
    try {
      const text = await backend.read(slot);
      if (text == null || text === '') continue;
      raw = JSON.parse(text);
    } catch { unreadable++; continue; }
    if (!raw || typeof raw.schema !== 'number') { unreadable++; continue; }
    if (raw.schema > DIARY_SCHEMA) { newer = true; continue; }
    copies.push({ slot, seq: Number(raw.seq) || 0, data: raw });
  }
  copies.sort((x, y) => y.seq - x.seq);
  const best = copies[0];
  const state = newer ? 'newer' : best || !unreadable ? 'ok' : 'damaged';
  let data = best ? { schema: DIARY_SCHEMA, seq: best.seq, sessions: validSessions(best.data.sessions), snapshots: { ...(best.data.snapshots || {}) } }
    : { schema: DIARY_SCHEMA, seq: 0, sessions: [], snapshots: {} };
  let slot = best?.slot || 'b';
  let queue = Promise.resolve();
  return {
    state,
    get sessions() { return data.sessions; },
    snapshot: ref => data.snapshots[ref] || null,
    // mutate(draft) edits a copy; the copy replaces the diary only once it is written. Resolves true when written,
    // null when mutate declined (returned false: nothing to change), false when the diary is read-only or the write failed.
    commit(mutate) {
      const run = queue.then(async () => {
        if (state !== 'ok') return false;
        const draft = structuredClone(data);
        if (mutate(draft) === false) return null;
        draft.seq = data.seq + 1;
        const target = slot === 'a' ? 'b' : 'a';
        try { await backend.write(target, JSON.stringify(draft)); } catch { return false; }
        data = draft; slot = target;
        return true;
      });
      queue = run.catch(() => false);
      return run;
    }
  };
}

// One calendar assignment of a program snapshot to a date. The program itself is never copied.
export function newSession(snapshots, { date, snap, programId = null, origin }) {
  const now = Date.now();
  return { id: newId('d'), date, status: 'planned', programId, planRef: putSnapshot(snapshots, snap), origin, createdAt: now, updatedAt: now };
}

// What the calendar shows for one session on a given day.
function view(session, date, today) {
  if (session.status === 'done') return 'done';
  if (session.status === 'planned') return date < today ? 'missed' : 'planned';
  return 'incomplete';
}
const live = (sessions, date) => sessions.filter(s => s.date === date && s.status !== 'canceled');

// Day chip: empty | planned | done | partial | missed. Removed (canceled) sessions do not count.
// ponytail: done + still-planned on today/future shows as partial; flagged to the owner as ambiguous.
export function dayStatus(sessions, date, today) {
  const views = live(sessions, date).map(s => view(s, date, today));
  if (!views.length) return 'empty';
  for (const only of ['done', 'planned', 'missed']) if (views.every(v => v === only)) return only;
  return 'partial';
}

// Dots appear only with two or more sessions: done = dark green, not completed = gray, planned ahead = none.
export function dayDots(sessions, date, today) {
  const views = live(sessions, date).map(s => view(s, date, today));
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
