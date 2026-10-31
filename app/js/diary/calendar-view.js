// «Дневник» tab: month calendar and, under it, the selected day's workouts. The same calendar picks dates in «Сохранить».
import { createActionIcon, renderSavedProgramCard, russianCount, timeWords } from '../ui/library-card-view.js';
import { dayDots, dayStatus, localDate, monthCells, newId } from './store.js';

const TEXT = {
  ru: { prev: 'Предыдущий месяц', next: 'Следующий месяц', today: 'Сегодня', count: 'Тренировок: ', month: 'Месяц', year: 'Год',
    day: { empty: 'Тренировок нет', planned: 'Запланировано', done: 'Выполнено', partial: 'Выполнено не полностью', missed: 'Пропущено' },
    legend: [['done', 'Выполнено'], ['partial', 'Частично'], ['planned', 'Запланировано'], ['missed', 'Пропущено']],
    done: 'Выполнена', planned: 'Запланирована', missed: 'Тренировка не запускалась', running: 'Не завершена',
    rounds: (n, total) => 'Выполнено раундов: ' + n + (total ? ' из ' + total : ''),
    plan: 'План: ', actual: 'Фактически: ', program: 'Программа', add: 'Добавить тренировку', source: 'Откуда',
    mine: 'Мои программы', library: 'Библиотека', noMine: 'В «Мои» пока нет программ.', assign: 'Назначить на дату',
    menu: 'Действия', move: 'Перенести на дату', repeat: 'Повторить на дату', remove: 'Удалить из календаря',
    pickMove: name => 'Выберите дату, чтобы перенести «' + name + '»', pickRepeat: name => 'Выберите дату, чтобы повторить «' + name + '»',
    cancelPick: 'Не переносить', loading: 'Загрузка дневника…',
    newer: 'Дневник записан более новой версией приложения. Обновите приложение: записи сохранены, но здесь их нельзя изменить.',
    damaged: 'Файл дневника не читается. Записи не изменялись и не удалялись; изменения дневника отключены.',
    failed: 'Не удалось записать дневник. Ничего не изменено.' },
  en: { prev: 'Previous month', next: 'Next month', today: 'Today', count: 'Workouts: ', month: 'Month', year: 'Year',
    day: { empty: 'No workouts', planned: 'Planned', done: 'Completed', partial: 'Not fully completed', missed: 'Missed' },
    legend: [['done', 'Completed'], ['partial', 'Partial'], ['planned', 'Planned'], ['missed', 'Missed']],
    done: 'Completed', planned: 'Planned', missed: 'Workout was not started', running: 'Not finished',
    rounds: (n, total) => 'Rounds completed: ' + n + (total ? ' of ' + total : ''),
    plan: 'Plan: ', actual: 'Actual: ', program: 'Program', add: 'Add workout', source: 'From',
    mine: 'My programs', library: 'Library', noMine: 'No programs in «Mine» yet.', assign: 'Assign to date',
    menu: 'Actions', move: 'Move to date', repeat: 'Repeat on date', remove: 'Remove from calendar',
    pickMove: name => 'Pick a date to move «' + name + '»', pickRepeat: name => 'Pick a date to repeat «' + name + '»',
    cancelPick: 'Cancel', loading: 'Loading diary…',
    newer: 'The diary was written by a newer app version. Update the app: records are kept but cannot be changed here.',
    damaged: 'The diary file cannot be read. No record was changed or deleted; diary changes are off.',
    failed: 'Could not write the diary. Nothing was changed.' }
};
export const diaryText = lang => TEXT[lang === 'en' ? 'en' : 'ru'];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
export const fromKey = key => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); };
// «Назначить на 1 дату / 3 даты / 5 дат».
export function assignLabel(n, lang, alsoSave = false) {
  if (lang === 'en') return (alsoSave ? 'Save and assign to ' : 'Assign to ') + n + (n === 1 ? ' date' : ' dates');
  return (alsoSave ? 'Сохранить и назначить на ' : 'Назначить на ') + russianCount(n, ['дату', 'даты', 'дат']);
}

function el(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}
function button(doc, className, text, onClick) {
  const b = el(doc, 'button', className, text); b.type = 'button'; b.addEventListener('click', onClick); return b;
}

// Month grid with ‹ › and a tap-to-open month/year selector. multi: each tap toggles a date (kept across months).
export function createCalendar(doc, { now = () => new Date(), multi = false } = {}) {
  const cal = { month: null, selected: multi ? new Set() : null, picker: false };
  cal.show = key => { const d = fromKey(key); cal.month = { y: d.getFullYear(), m: d.getMonth() }; };
  cal.render = (lang, sessions, { onTap, onChange, hint } = {}) => {
    const t = diaryText(lang), locale = lang === 'en' ? 'en' : 'ru';
    const today = localDate(now());
    if (!cal.month) cal.show(multi ? today : cal.selected || today);
    if (!multi && !cal.selected) cal.selected = today;
    const surface = el(doc, 'section', 'ft-diary-calendar');
    const go = (y, m) => { const d = new Date(y, m, 1); cal.month = { y: d.getFullYear(), m: d.getMonth() }; onChange(); };
    const step = (label, sign, delta) => { const b = button(doc, 'ft-diary-step', sign, () => go(cal.month.y, cal.month.m + delta)); b.setAttribute('aria-label', label); return b; };
    const monthName = m => cap(new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2024, m, 1)));
    const title = button(doc, 'ft-diary-month-title', monthName(cal.month.m) + ' ' + cal.month.y, () => { cal.picker = !cal.picker; onChange(); });
    title.setAttribute('aria-expanded', String(cal.picker));
    const nav = el(doc, 'div', 'ft-diary-month');
    nav.append(step(t.prev, '‹', -1), title, step(t.next, '›', 1));
    surface.append(nav);
    if (cal.picker) {
      // Inline month and year; a change moves the calendar at once, a second tap on the title folds it.
      const row = el(doc, 'div', 'ft-diary-picker');
      const select = (label, options, value, apply) => {
        const s = el(doc, 'select', 'ft-diary-select'); s.setAttribute('aria-label', label);
        for (const [v, text] of options) { const o = el(doc, 'option', '', text); o.value = String(v); s.append(o); }
        s.value = String(value); s.addEventListener('change', () => apply(Number(s.value)));
        return s;
      };
      const years = sessions.map(s => Number(s.date.slice(0, 4)));
      const thisYear = Number(today.slice(0, 4));
      const from = Math.min(thisYear - 10, cal.month.y, ...years), to = Math.max(thisYear + 10, cal.month.y, ...years);
      row.append(select(t.month, Array.from({ length: 12 }, (_, m) => [m, monthName(m)]), cal.month.m, m => go(cal.month.y, m)),
        select(t.year, Array.from({ length: to - from + 1 }, (_, i) => [from + i, String(from + i)]), cal.month.y, y => go(y, cal.month.m)));
      surface.append(row);
    }
    if (hint) surface.append(hint);
    const grid = el(doc, 'div', 'ft-diary-grid');
    const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    for (let i = 0; i < 7; i++) grid.append(el(doc, 'span', 'ft-diary-weekday', cap(weekday.format(new Date(2024, 0, 1 + i)))));
    for (const key of monthCells(cal.month.y, cal.month.m)) {
      if (!key) { grid.append(el(doc, 'span', 'ft-diary-blank')); continue; }
      const status = dayStatus(sessions, key, today);
      const picked = multi ? cal.selected.has(key) : key === cal.selected;
      const chip = button(doc, 'ft-diary-day is-' + status, null, () => {
        if (multi) { if (!cal.selected.delete(key)) cal.selected.add(key); } else cal.selected = key;
        onTap?.(key); onChange();
      });
      chip.dataset.date = key;
      if (key === today) chip.classList.add('is-today');
      if (picked) chip.classList.add('is-selected');
      chip.setAttribute('aria-pressed', String(picked));
      chip.setAttribute('aria-label', new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(fromKey(key)) + ', ' + t.day[status] + (key === today ? ', ' + t.today : ''));
      chip.append(el(doc, 'span', 'ft-diary-num', String(Number(key.slice(8)))));
      const dots = dayDots(sessions, key, today);
      if (dots.length) { const row = el(doc, 'span', 'ft-diary-dots'); for (const d of dots) row.append(el(doc, 'i', 'ft-diary-dot is-' + d)); chip.append(row); }
      grid.append(chip);
    }
    const legend = el(doc, 'div', 'ft-diary-legend');
    for (const [status, label] of t.legend) { const item = el(doc, 'span', 'ft-diary-legend-item'); item.append(el(doc, 'i', 'ft-diary-swatch is-' + status), label); legend.append(item); }
    legend.append(button(doc, 'ft-diary-today', t.today, () => { if (!multi) cal.selected = today; cal.show(today); onChange(); }));
    surface.append(grid, legend);
    return surface;
  };
  return cal;
}

// host: getDiary(), savedPrograms(), openSession(session, snap), openProgram(program, date), assign(program, date),
// startLibrary(date), confirmRemove({name, trigger, onConfirm}).
export function createDiaryView(doc, host, { now = () => new Date() } = {}) {
  const cal = createCalendar(doc, { now });
  let pick = null, adding = false, source = 'mine', note = '';

  function stateText(session, today, t) {
    if (session.status === 'done') return t.done;
    if (session.status === 'planned') return session.date < today ? t.missed : t.planned;
    return t.running + ' · ' + t.rounds(session.facts?.roundsDone || 0, session.facts?.roundsTotal);
  }

  function sessionCard(diary, session, today, t, lang, rerender) {
    const snap = diary.snapshot(session.execRef || session.planRef) || { name: t.program, entries: [], options: {} };
    const program = { id: session.id, name: snap.name || t.program, entries: snap.entries, options: snap.options };
    const times = [stateText(session, today, t)];
    if (session.facts?.activeSec > 0) times.push(t.actual + timeWords(session.facts.activeSec, lang));
    const menu = el(doc, 'details', 'ft-diary-menu');
    const summary = el(doc, 'summary', 'ft-diary-menu-button', '⋮'); summary.setAttribute('aria-label', t.menu + ': ' + program.name);
    const items = el(doc, 'div', 'ft-diary-menu-list');
    const choose = kind => () => { pick = { kind, id: session.id, name: program.name }; menu.open = false; rerender(); };
    if (session.status === 'planned') items.append(button(doc, 'ft-diary-menu-item', t.move, choose('move')));
    items.append(button(doc, 'ft-diary-menu-item', t.repeat, choose('repeat')));
    const remove = button(doc, 'ft-diary-menu-item', t.remove, () => {
      menu.open = false;
      host.confirmRemove({ name: program.name + ' · ' + session.date.split('-').reverse().join('.'), trigger: summary, onConfirm: () => change(diary, d => {
        const s = d.sessions.find(x => x.id === session.id); if (!s) return false;
        // Removing an assignment keeps the record (status canceled): history is never erased from storage.
        s.status = 'canceled'; s.canceledAt = Date.now(); s.updatedAt = s.canceledAt;
      }, rerender) });
    });
    items.append(remove);
    menu.append(summary, items);
    const card = renderSavedProgramCard(doc, program, {}, { lang, badge: times.join(' · '), actions: [menu], onOpen: () => host.openSession(session, snap) });
    card.classList.add('ft-diary-session', 'is-' + session.status);
    return card;
  }

  async function change(diary, mutate, rerender) {
    note = (await diary.commit(mutate)) ? '' : diaryText(doc.documentElement.lang).failed;
    rerender();
  }

  function addPanel(diary, date, t, lang, rerender) {
    const panel = el(doc, 'div', 'ft-diary-add');
    const label = el(doc, 'label', 'ft-diary-source', t.source);
    const select = el(doc, 'select', 'ft-diary-select');
    for (const [v, text] of [['mine', t.mine], ['library', t.library]]) { const o = el(doc, 'option', '', text); o.value = v; select.append(o); }
    select.value = source;
    select.addEventListener('change', () => { source = select.value; if (source === 'library') { source = 'mine'; adding = false; host.startLibrary(date); } else rerender(); });
    label.append(select); panel.append(label);
    const programs = host.savedPrograms();
    if (!programs.length) panel.append(el(doc, 'p', 'ft-card-empty', t.noMine));
    for (const program of programs) {
      const plus = button(doc, 'ft-saved-program-add ft-diary-assign', null, () => {
        if (plus.disabled) return; plus.disabled = true;
        adding = false; change(diary, d => { d.sessions.push(host.assign(d.snapshots, program, date)); }, rerender);
      });
      plus.setAttribute('aria-label', t.assign + ': ' + program.name); plus.title = t.assign; plus.append(createActionIcon(doc, 'plus'));
      panel.append(renderSavedProgramCard(doc, program, host.profiles(), { lang, actions: [plus], onOpen: () => host.openProgram(program, date) }));
    }
    return panel;
  }

  function render(list, lang = 'ru') {
    const t = diaryText(lang), locale = lang === 'en' ? 'en' : 'ru';
    const rerender = () => render(list, lang);
    const diary = host.getDiary();
    if (!diary) { list.replaceChildren(el(doc, 'p', 'ft-route-muted', t.loading)); return; }
    const today = localDate(now());
    const sessions = diary.sessions;
    const root = el(doc, 'div', 'ft-diary');
    if (diary.state !== 'ok') root.append(el(doc, 'p', 'ft-diary-alert', t[diary.state]));
    let hint = null;
    if (pick) {
      hint = el(doc, 'div', 'ft-diary-hint');
      hint.append(el(doc, 'span', '', (pick.kind === 'move' ? t.pickMove : t.pickRepeat)(pick.name)), button(doc, 'ft-diary-hint-cancel', '×', () => { pick = null; rerender(); }));
      hint.lastChild.setAttribute('aria-label', t.cancelPick);
    }
    const onTap = key => {
      adding = false;
      if (!pick) return;
      const { kind, id } = pick; pick = null;
      change(diary, d => {
        const s = d.sessions.find(x => x.id === id); if (!s) return false;
        if (kind === 'move') { if (s.status !== 'planned' || s.date === key) return false; s.date = key; s.updatedAt = Date.now(); return; }
        const now = Date.now();
        d.sessions.push({ id: newId('d'), date: key, status: 'planned', programId: s.programId ?? null,
          planRef: s.execRef || s.planRef, origin: 'repeat', repeatOf: s.id, createdAt: now, updatedAt: now });
      }, rerender);
    };
    root.append(cal.render(lang, sessions, { onTap, onChange: rerender, hint }));

    const detail = el(doc, 'section', 'ft-diary-detail');
    const selected = cal.selected;
    const daySessions = sessions.filter(s => s.date === selected && s.status !== 'canceled');
    detail.append(el(doc, 'h3', 'ft-diary-detail-date',
      cap(new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(fromKey(selected)))));
    const status = dayStatus(sessions, selected, today);
    detail.append(el(doc, 'p', 'ft-diary-detail-status', status === 'empty' ? t.day.empty : t.day[status] + ' · ' + t.count + daySessions.length));
    if (note) detail.append(el(doc, 'p', 'ft-diary-alert', note));
    for (const s of daySessions) detail.append(sessionCard(diary, s, today, t, lang, rerender));
    if (diary.state === 'ok') {
      const add = button(doc, 'ft-diary-add-toggle', t.add, () => { adding = !adding; rerender(); });
      add.setAttribute('aria-expanded', String(adding));
      detail.append(add);
      if (adding) detail.append(addPanel(diary, selected, t, lang, rerender));
    }
    root.append(detail);
    list.replaceChildren(root);
  }
  return { render, calendar: cal };
}
