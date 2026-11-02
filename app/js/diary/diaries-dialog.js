// G1 «⋮» of the diary calendar (owner 2026-11-02): a regular dialog, not a bottom sheet. On top, the diaries (✓ = the
// active one; a tap switches it and the calendar behind, the dialog stays open); under it, the actions on the active
// diary. Create/rename ask for a name in the same dialog; delete, replace and restore ask through the app's confirmation.
import { bilingual } from '../ui/choice-dialog.js';
import { DIARY_FILE_MAX_BYTES, DIARY_NAME_MAX, diaryFileName, parseDiaryFile, serializeDiaryFile } from './diary-file.js';
import { MAX_DIARIES, readBackup, replaceDiary } from './diaries.js';
import { localDate } from './store.js';

const T = {
  ru: { title: 'Дневники', close: 'Закрыть', create: 'Создать дневник', send: 'Отправить дневник', save: 'Сохранить дневник в файл',
    load: 'Загрузить дневник из файла', rename: 'Переименовать дневник', remove: 'Удалить дневник', restore: 'Восстановить из резервной копии',
    name: 'Название дневника', cancel: 'Отмена', ok: 'Создать', okRename: 'Сохранить', needName: 'Введите название.',
    created: n => 'Создан дневник «' + n + '».', renamed: n => 'Дневник называется «' + n + '».', removed: n => 'Дневник «' + n + '» удалён.',
    saved: p => 'Файл сохранён: ' + p, downloaded: 'Файл скачан.', shared: 'Файл передан.', sendFailed: 'Не удалось отправить файл.',
    saveFailed: 'Не удалось сохранить файл. Используйте «Отправить дневник» — например, в Google Диск.', limit: 'Достигнут предел: 30 дневников.',
    readonly: 'Этот дневник сейчас только для чтения; изменения отключены.', storage: 'Не удалось записать: память приложения заполнена.',
    replaced: n => 'Дневник «' + n + '» заменён содержимым файла. Прежнее содержимое — в резервной копии.',
    restored: n => 'Дневник «' + n + '» восстановлен из резервной копии.', failed: 'Не удалось записать дневник. Ничего не изменено.',
    backupFailed: 'Не удалось сохранить резервную копию. Дневник не изменён.',
    invalid: 'Файл не является дневником Fight Tech или повреждён. Дневник не изменён.', version: 'Версия файла не поддерживается. Дневник не изменён.',
    too_large: 'Файл слишком большой (максимум 16 МБ). Дневник не изменён.', read: 'Не удалось прочитать файл. Дневник не изменён.',
    replaceTitle: n => 'Заменить дневник «' + n + '»?',
    replaceMessage: n => 'Всё содержимое дневника «' + n + '» будет заменено содержимым файла. Остальные дневники не изменятся. Перед заменой текущее содержимое сохранится в резервную копию.',
    replace: 'Заменить', fileFacts: (f, p) => 'Файл: ' + f + ' · в файле дневник «' + (p.name || '—') + '» · тренировок: ' + p.summary.workouts
      + (p.summary.from ? ' · с ' + day(p.summary.from) + ' по ' + day(p.summary.to) : '') + (p.exportedAt ? ' · создан ' + day(p.exportedAt.slice(0, 10)) : ''),
    removeTitle: 'Удалить дневник?', removeMessage: n => 'Все тренировки дневника «' + n + '» будут удалены с этого устройства без возможности восстановления. Остальные дневники не изменятся.',
    restoreTitle: 'Восстановить дневник?', restoreMessage: n => 'Текущее содержимое дневника «' + n + '» будет заменено резервной копией (она сохранена перед последней заменой из файла).',
    restoreOk: 'Восстановить', removeOk: 'Удалить', active: 'активный' },
  en: { title: 'Diaries', close: 'Close', create: 'Create diary', send: 'Send diary', save: 'Save diary to file',
    load: 'Load diary from file', rename: 'Rename diary', remove: 'Delete diary', restore: 'Restore from backup',
    name: 'Diary name', cancel: 'Cancel', ok: 'Create', okRename: 'Save', needName: 'Enter a name.',
    created: n => 'Diary «' + n + '» created.', renamed: n => 'The diary is now «' + n + '».', removed: n => 'Diary «' + n + '» deleted.',
    saved: p => 'File saved: ' + p, downloaded: 'File downloaded.', shared: 'File shared.', sendFailed: 'Could not send the file.',
    saveFailed: 'Could not save the file. Use «Send diary» instead — for example to Google Drive.', limit: 'Limit reached: 30 diaries.',
    readonly: 'This diary is read-only now; changes are off.', storage: 'Could not save: app storage is full.',
    replaced: n => 'Diary «' + n + '» was replaced with the file. The previous content is in the backup.',
    restored: n => 'Diary «' + n + '» was restored from the backup.', failed: 'Could not write the diary. Nothing was changed.',
    backupFailed: 'Could not save the backup. The diary was not changed.',
    invalid: 'Not a Fight Tech diary file, or the file is damaged. The diary was not changed.', version: 'Unsupported file version. The diary was not changed.',
    too_large: 'File too large (maximum 16 MB). The diary was not changed.', read: 'Could not read the file. The diary was not changed.',
    replaceTitle: n => 'Replace diary «' + n + '»?',
    replaceMessage: n => 'All content of diary «' + n + '» will be replaced with the file. Other diaries stay unchanged. The current content is saved to a backup first.',
    replace: 'Replace', fileFacts: (f, p) => 'File: ' + f + ' · diary in the file «' + (p.name || '—') + '» · workouts: ' + p.summary.workouts
      + (p.summary.from ? ' · ' + day(p.summary.from) + ' to ' + day(p.summary.to) : '') + (p.exportedAt ? ' · created ' + day(p.exportedAt.slice(0, 10)) : ''),
    removeTitle: 'Delete the diary?', removeMessage: n => 'All workouts of diary «' + n + '» will be deleted from this device for good. Other diaries stay unchanged.',
    restoreTitle: 'Restore the diary?', restoreMessage: n => 'The current content of diary «' + n + '» will be replaced with the backup (saved before the last replacement from a file).',
    restoreOk: 'Restore', removeOk: 'Delete', active: 'active' }
};
const day = key => key.split('-').reverse().join('.');
const cancelled = e => e?.name === 'AbortError' || /cancel|dismiss/i.test(String(e?.message || ''));

// host: diaries (diaries.js), confirm (the app's confirmation dialog), onSwitch(id) after the active diary changed,
// files {share({data,name,title}), save({data,name})}.
export function createDiariesDialog(doc, { diaries, confirm, onSwitch, files }) {
  const t = () => T[doc.documentElement.lang === 'en' ? 'en' : 'ru'];
  const lang = () => doc.documentElement.lang === 'en' ? 'en' : 'ru';
  let back = null, opener = null, form = null, status = '', hasBackup = false, busy = false;
  const name = id => diaries.name(id, lang());
  const confirmOpen = () => !doc.getElementById('programDeleteConfirmModal')?.hidden;

  function el(tag, className, text) { const e = doc.createElement(tag); if (className) e.className = className; if (text != null) e.textContent = text; return e; }
  function action(label, run, { disabled = false, danger = false } = {}) {
    const b = el('button', 'ft-diaries-action' + (danger ? ' is-danger' : ''), label); b.type = 'button'; b.disabled = disabled || busy;
    b.addEventListener('click', run); return b;
  }
  const say = text => { status = text; render(); };

  async function refreshBackup() { hasBackup = !!(await readBackup(diaries.backend(diaries.active))); }

  function render(focus) {
    if (!back) return;
    const x = t(), box = back.firstChild, active = diaries.active;
    const head = el('div', 'ft-choice-head');
    const h = bilingual(doc, 'h3', 'ft-choice-title', T.ru.title, T.en.title); h.id = 'ftDiariesTitle';
    const close = el('button', 'ft-choice-close', '×'); close.type = 'button'; close.id = 'ftDiariesDialogClose'; close.setAttribute('aria-label', x.close);
    close.addEventListener('click', () => form ? (form = null, render()) : api.close());
    head.append(h, close);
    const body = el('div', 'ft-diaries-body');
    if (form) {
      const label = el('label', 'ft-diaries-field'); label.append(el('span', '', x.name));
      const input = el('input'); input.id = 'ftDiaryNameInput'; input.type = 'text'; input.maxLength = DIARY_NAME_MAX; input.autocomplete = 'off';
      input.value = form.value; label.append(input);
      const row = el('div', 'ft-diaries-form-actions');
      const submit = () => {
        const value = input.value.trim();
        if (!value) { status = x.needName; form.value = ''; return render('input'); }
        if (form.kind === 'create') {
          const id = diaries.create(value);
          if (!id) return say(diaries.list.length >= MAX_DIARIES ? x.limit : x.storage);
          form = null; status = x.created(value); switched();
        } else {
          if (!diaries.rename(diaries.active, value)) return say(x.storage);
          form = null; status = x.renamed(value); onSwitch?.(); render();
        }
      };
      input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
      const cancel = el('button', 'ft-diaries-cancel', x.cancel); cancel.type = 'button'; cancel.addEventListener('click', () => { form = null; status = ''; render(); });
      const ok = el('button', 'ft-diaries-ok', form.kind === 'create' ? x.ok : x.okRename); ok.type = 'button'; ok.id = 'ftDiaryNameOk'; ok.addEventListener('click', submit);
      row.append(cancel, ok);
      body.append(label, row);
    } else {
      const list = el('div', 'ft-diaries-list'); list.setAttribute('role', 'radiogroup'); list.setAttribute('aria-labelledby', 'ftDiariesTitle');
      for (const d of diaries.list) {
        const b = el('button', 'ft-diaries-item' + (d.id === active ? ' is-active' : '')); b.type = 'button'; b.dataset.diary = d.id;
        b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(d.id === active));
        b.append(el('span', 'ft-diaries-check', d.id === active ? '✓' : ''), el('span', 'ft-diaries-name', name(d.id)));
        b.addEventListener('click', () => { if (d.id !== diaries.active && diaries.setActive(d.id)) { status = ''; switched(d.id); } });
        list.append(b);
      }
      const acts = el('div', 'ft-diaries-actions');
      acts.append(action(x.create, () => { status = ''; form = { kind: 'create', value: '' }; render('input'); }, { disabled: diaries.list.length >= MAX_DIARIES }),
        action(x.send, () => transfer('share')), action(x.save, () => transfer('save')), action(x.load, pickFile),
        action(x.rename, () => { status = ''; form = { kind: 'rename', value: name(active) }; render('input'); }));
      if (hasBackup) acts.append(action(x.restore, restore));
      acts.append(action(x.remove, remove, { disabled: active === 'main', danger: true }));
      body.append(list, acts);
    }
    const line = el('p', 'ft-diaries-status', status); line.setAttribute('role', 'status'); line.setAttribute('aria-live', 'polite'); line.id = 'ftDiariesStatus';
    body.append(line);
    box.replaceChildren(head, body);
    const target = focus === 'input' ? box.querySelector('#ftDiaryNameInput') : focus ? box.querySelector(`[data-diary="${focus}"]`) : null;
    // Focus stays in the dialog (the confirmation hands it back to the library when it closes).
    (target || (!back.contains(doc.activeElement) && !confirmOpen() ? box.querySelector('.ft-diaries-item.is-active') || close : null))?.focus();
  }
  // The active diary changed (tap, create): the calendar behind follows at once; the dialog stays open.
  async function switched(id = diaries.active) { await onSwitch?.(); await refreshBackup(); render(id); }

  async function exportText() {
    const id = diaries.active, store = await diaries.open(id);
    return { data: serializeDiaryFile({ name: name(id), sessions: store.sessions, snapshots: store.snapshots || {} }), name: diaryFileName(name(id), localDate()), title: name(id) };
  }
  async function transfer(kind) {
    const x = t(); busy = true; status = ''; render();
    try {
      const file = await exportText();
      const result = kind === 'share' ? await files.share(file) : await files.save(file);
      status = result === 'shared' ? x.shared : result === 'downloaded' ? x.downloaded : x.saved(result);
    } catch (e) { status = cancelled(e) ? '' : kind === 'share' ? x.sendFailed : x.saveFailed; }
    busy = false; render();
  }
  function pickFile() {
    status = '';
    const input = el('input'); input.type = 'file'; input.accept = '*/*'; input.hidden = true;
    input.addEventListener('change', async () => {
      const file = input.files?.[0]; input.remove(); if (!file) return;
      const x = t();
      let parsed;
      try {
        if (file.size > DIARY_FILE_MAX_BYTES) throw Object.assign(new Error(), { code: 'too_large' });
        parsed = parseDiaryFile(await file.text());
      } catch (e) { return say(x[e?.code] || x.read); }
      const id = diaries.active, target = name(id);
      // What the file holds, before the explicit «Заменить»: the user checks it is the right file.
      confirm({ name: x.fileFacts(file.name, parsed), trigger: null, labels: {
        ru: { title: T.ru.replaceTitle(target), message: T.ru.replaceMessage(target), delete: T.ru.replace },
        en: { title: T.en.replaceTitle(target), message: T.en.replaceMessage(target), delete: T.en.replace } },
        onConfirm: () => apply(id, parsed, t().replaced(target)), onCancel: () => render(), onDismiss: () => render() });
    });
    doc.body.append(input); input.click();
  }
  async function apply(id, parsed, done) {
    const x = t(); busy = true; render();
    const store = await diaries.open(id);
    const result = await replaceDiary(store, diaries.backend(id), parsed, name(id));
    busy = false;
    status = result === 'ok' ? done : result === 'readonly' ? x.readonly : result === 'backup_failed' ? x.backupFailed : x.failed;
    if (result === 'ok') await onSwitch?.();
    await refreshBackup(); render();
  }
  async function restore() {
    const id = diaries.active, target = name(id), copy = await readBackup(diaries.backend(id));
    if (!copy) { hasBackup = false; return render(); }
    confirm({ name: target, trigger: null, labels: {
      ru: { title: T.ru.restoreTitle, message: T.ru.restoreMessage(target), delete: T.ru.restoreOk },
      en: { title: T.en.restoreTitle, message: T.en.restoreMessage(target), delete: T.en.restoreOk } },
      onConfirm: () => apply(id, copy, t().restored(target)), onCancel: () => render(), onDismiss: () => render() });
  }
  function remove() {
    const id = diaries.active, target = name(id);
    if (id === 'main') return;
    confirm({ name: target, trigger: null, labels: {
      ru: { title: T.ru.removeTitle, message: T.ru.removeMessage(target), delete: T.ru.removeOk },
      en: { title: T.en.removeTitle, message: T.en.removeMessage(target), delete: T.en.removeOk } },
      onConfirm: async () => { const ok = await diaries.remove(id); status = ok ? t().removed(target) : t().storage; switched(); },
      onCancel: () => render(), onDismiss: () => render() });
  }

  const api = {
    get open() { return !!back; },
    async show(trigger = null) {
      api.close(false);
      opener = trigger; form = null; status = '';
      back = el('div', 'ft-diaries-backdrop'); back.id = 'ftDiariesDialog';
      const box = el('div', 'ft-choice-dialog ft-diaries-dialog'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'ftDiariesTitle');
      back.append(box);
      back.addEventListener('click', e => { if (e.target === back) api.close(); });
      back.addEventListener('keydown', e => {
        if (confirmOpen()) return;
        if (e.key === 'Escape') { e.preventDefault(); form ? (form = null, render()) : api.close(); }
        else if (e.key === 'Tab') {
          const items = [...box.querySelectorAll('button:not(:disabled),input')], i = items.indexOf(doc.activeElement);
          e.preventDefault(); items[(i + (e.shiftKey ? items.length - 1 : 1) + items.length) % items.length]?.focus();
        }
      });
      doc.body.append(back);
      render(diaries.active);
      await refreshBackup(); render(diaries.active);
    },
    close(refocus = true) { back?.remove(); back = null; form = null; if (refocus) opener?.focus?.(); },
    render
  };
  return api;
}
