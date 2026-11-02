// G1 (owner 2026-11-02): several independent diaries on this device. «Мой дневник» ('main') always exists and is the
// diary every earlier version wrote, file for file; others are added, renamed and deleted by the user. The list and the
// active one are kept in localStorage; each diary's records live in its own files (store.js).
import { writeJson } from '../state/storage.js';
import { defaultBackend, newId, openDiary } from './store.js';
import { DIARY_FILE_FORMAT, DIARY_FILE_VERSION, DIARY_NAME_MAX, parseDiaryFile } from './diary-file.js';

export const DIARIES_KEY = 'fighttech.diaries.v1';
export const MAX_DIARIES = 30;
const ID = /^[a-z0-9-]{1,40}$/;
export const mainName = lang => lang === 'en' ? 'My diary' : 'Мой дневник';

export function loadRegistry(storage = globalThis.localStorage) {
  let raw = null;
  try { raw = JSON.parse(storage.getItem(DIARIES_KEY) || 'null'); } catch {}
  const list = [{ id: 'main', name: '' }];
  for (const d of Array.isArray(raw?.list) ? raw.list : [])
    if (d && ID.test(d.id) && d.id !== 'main' && typeof d.name === 'string' && !list.some(x => x.id === d.id)) list.push({ id: d.id, name: d.name.slice(0, DIARY_NAME_MAX) });
  const own = raw?.list?.find?.(d => d?.id === 'main');
  if (typeof own?.name === 'string') list[0].name = own.name.slice(0, DIARY_NAME_MAX);
  return { list: list.slice(0, MAX_DIARIES), active: list.some(d => d.id === raw?.active) ? raw.active : 'main' };
}

// open(id) is cached: one store per diary for the whole session, so writes to it stay in one queue.
export function createDiaries({ storage = globalThis.localStorage, win = globalThis, backend = id => defaultBackend(win, id) } = {}) {
  let reg = loadRegistry(storage);
  const stores = new Map();
  const save = next => { if (!writeJson(DIARIES_KEY, next, storage)) return false; reg = next; return true; };
  const damaged = { state: 'damaged', sessions: [], snapshots: {}, snapshot: () => null, commit: async () => false };
  const api = {
    get list() { return reg.list; },
    get active() { return reg.active; },
    has: id => reg.list.some(d => d.id === id),
    name(id, lang) { const d = reg.list.find(x => x.id === id); return d?.name || (id === 'main' || !d ? mainName(lang) : ''); },
    backend,
    // A missing diary (deleted meanwhile) resolves to «Мой дневник»: a record is never dropped for want of a diary.
    open(id) {
      const key = api.has(id) ? id : 'main';
      if (!stores.has(key)) stores.set(key, openDiary(backend(key)).catch(() => damaged));
      return stores.get(key);
    },
    setActive(id) { return api.has(id) && (id === reg.active || save({ ...reg, active: id })); },
    create(name) {
      if (reg.list.length >= MAX_DIARIES) return null;
      const id = newId('d').toLowerCase().replace(/[^a-z0-9-]/g, '');
      return save({ list: [...reg.list, { id, name: name.slice(0, DIARY_NAME_MAX) }], active: id }) ? id : null;
    },
    rename(id, name) { return api.has(id) && save({ ...reg, list: reg.list.map(d => d.id === id ? { ...d, name: name.slice(0, DIARY_NAME_MAX) } : d) }); },
    // The list forgets the diary first; its files go after (a failed file delete leaves an orphan file, never a lost diary).
    async remove(id) {
      if (id === 'main' || !api.has(id)) return false;
      if (!save({ list: reg.list.filter(d => d.id !== id), active: reg.active === id ? 'main' : reg.active })) return false;
      stores.delete(id);
      const b = backend(id);
      for (const slot of ['a', 'b', 'backup']) await b.remove(slot).catch(() => {});
      return true;
    }
  };
  return api;
}

// G4: the selected diary is replaced as a whole by a parsed file. First its current content is written to its 'backup'
// slot; no backup, no replacement. The replacement itself is one store commit (a new slot, the old one untouched), so a
// failure leaves the diary exactly as it was. → 'ok' | 'readonly' | 'backup_failed' | 'failed'.
export async function replaceDiary(store, backend, incoming, name = '') {
  if (store.state !== 'ok') return 'readonly';
  const backup = { format: DIARY_FILE_FORMAT, version: DIARY_FILE_VERSION, exportedAt: new Date().toISOString(), diary: { name }, backup: true,
    sessions: store.sessions, snapshots: store.snapshots };
  try { await backend.write('backup', JSON.stringify(backup)); } catch { return 'backup_failed'; }
  const ok = await store.commit(d => { d.sessions = structuredClone(incoming.sessions); d.snapshots = structuredClone(incoming.snapshots); });
  return ok === false ? 'failed' : 'ok';
}
// The copy kept by the last replacement, parsed like any diary file; null when there is none or it cannot be read.
export async function readBackup(backend) {
  try { const text = await backend.read('backup'); return text ? parseDiaryFile(text) : null; } catch { return null; }
}
