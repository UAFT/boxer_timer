// localStorage throws when it is full (the library alone may hold 100 programs of up to
// 128 KB). A failed write is reported, never half-applied: callers keep their state.
export const STORAGE_FULL_MESSAGE = {
  ru: 'Не удалось сохранить: память приложения заполнена. Удалите ненужные программы и повторите.',
  en: 'Could not save: app storage is full. Delete programs you no longer need and try again.'
};
export function writeJson(key, value, storage = globalThis.localStorage) {
  try { storage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}
