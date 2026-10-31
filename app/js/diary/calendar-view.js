// «Дневник» tab: month calendar and, under it, the selected day's workouts. The same calendar picks dates in «Сохранить».
import { compileProgram, normalizeOptions, normalizeProgram, PRESET_NAMES } from '../core/program.js';
import { hasLadder } from '../core/ladder-blocks.js';
import { LIBRARY, stageForWorkout } from '../library/native-adapter.js';
import { createActionIcon, renderSavedProgramCard, russianCount, timeClock, timeWords } from '../ui/library-card-view.js';
import { libraryDescription, renderCompactCard, renderDescription } from '../ui/workout-plan-view.js';
import { dayDots, dayStatus, dropUnused, localDate, monthCells, newId } from './store.js';

const TEXT = {
  ru: { prev: 'Предыдущий месяц', next: 'Следующий месяц', today: 'Сегодня', count: 'Тренировок: ', month: 'Месяц', year: 'Год',
    day: { empty: 'Тренировок нет', planned: 'Запланировано', done: 'Выполнено', partial: 'Выполнено не полностью', missed: 'Пропущено' },
    legend: [['done', 'Выполнено'], ['partial', 'Частично'], ['planned', 'Запланировано'], ['missed', 'Пропущено']],
    done: 'Выполнена', planned: 'Запланирована', missed: 'Тренировка не запускалась', running: 'Не завершена',
    rounds: (n, total) => 'Выполнено раундов: ' + n + (total ? ' из ' + total : ''),
    plan: 'План: ', actual: 'Фактически: ', started: 'Начало ', stages: (n, total) => 'этапов: ' + n + ' из ' + total, program: 'Программа', add: 'Добавить тренировку', source: 'Откуда',
    mine: 'Мои программы', library: 'Библиотека', noMine: 'В «Мои» пока нет программ.', assign: 'Назначить на дату',
    menu: 'Действия', move: 'Перенести на дату', repeat: 'Повторить на дату', remove: 'Удалить из календаря',
    pickMove: name => 'Выберите дату, чтобы перенести «' + name + '»', pickRepeat: name => 'Выберите дату, чтобы повторить «' + name + '»',
    cancelPick: 'Не переносить', loading: 'Загрузка дневника…',
    assignDates: 'Назначить на даты', pickAssign: name => 'Отметьте даты для «' + name + '»', pickDates: 'Выберите даты в календаре',
    start: 'Начать тренировку', addStage: 'Добавить этап', saveAs: 'Сохранить как…', stage: 'Этап ', between: 'Отдых между этапами: ', betweenCycles: 'Пауза между циклами: ',
    cycles: n => 'Циклы: ' + n, roundsCount: n => russianCount(n), total: 'Всего: ', noLimit: 'Без ограничения времени',
    deleteForever: 'Удалить тренировку', draftFailed: 'Не удалось записать тренировку в дневник. Добавленные блоки сохранены здесь — нажмите × ещё раз.',
    untitled: 'Новая программа', timer: 'Таймер', modes: { standard: 'обычный', ladder: 'лестница', two_phase: 'две фазы', count_up: 'прямой отсчёт', blocks: 'блоки', speed: 'Скоростной' },
    newer: 'Дневник записан более новой версией приложения. Обновите приложение: записи сохранены, но здесь их нельзя изменить.',
    damaged: 'Файл дневника не читается. Записи не изменялись и не удалялись; изменения дневника отключены.',
    failed: 'Не удалось записать дневник. Ничего не изменено.' },
  en: { prev: 'Previous month', next: 'Next month', today: 'Today', count: 'Workouts: ', month: 'Month', year: 'Year',
    day: { empty: 'No workouts', planned: 'Planned', done: 'Completed', partial: 'Not fully completed', missed: 'Missed' },
    legend: [['done', 'Completed'], ['partial', 'Partial'], ['planned', 'Planned'], ['missed', 'Missed']],
    done: 'Completed', planned: 'Planned', missed: 'Workout was not started', running: 'Not finished',
    rounds: (n, total) => 'Rounds completed: ' + n + (total ? ' of ' + total : ''),
    plan: 'Plan: ', actual: 'Actual: ', started: 'Started ', stages: (n, total) => 'stages: ' + n + ' of ' + total, program: 'Program', add: 'Add workout', source: 'From',
    mine: 'My programs', library: 'Library', noMine: 'No programs in «Mine» yet.', assign: 'Assign to date',
    menu: 'Actions', move: 'Move to date', repeat: 'Repeat on date', remove: 'Remove from calendar',
    pickMove: name => 'Pick a date to move «' + name + '»', pickRepeat: name => 'Pick a date to repeat «' + name + '»',
    cancelPick: 'Cancel', loading: 'Loading diary…',
    assignDates: 'Assign to dates', pickAssign: name => 'Tick the dates for «' + name + '»', pickDates: 'Pick dates in the calendar',
    start: 'Start workout', addStage: 'Add stage', saveAs: 'Save as…', stage: 'Stage ', between: 'Rest between stages: ', betweenCycles: 'Rest between cycles: ',
    cycles: n => 'Cycles: ' + n, roundsCount: n => n + (n === 1 ? ' round' : ' rounds'), total: 'Total: ', noLimit: 'No time limit',
    deleteForever: 'Delete workout', draftFailed: 'Could not write the workout to the diary. The added blocks are kept here — tap × again.',
    untitled: 'New program', timer: 'Timer', modes: { standard: 'standard', ladder: 'ladder', two_phase: 'two phases', count_up: 'count up', blocks: 'blocks', speed: 'Speed' },
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

// Plain-timer runs are named from what was actually set, in the language shown now: preset (3′/2′/1′/Speed) and the
// main timer's modes — standard, ladder (+ blocks), two phases (+ ladder, + blocks), count up.
export function timerLabel(entry, lang) {
  const t = diaryText(lang), c = entry?.settings || {}, m = t.modes;
  const preset = entry?.presetId === 'tabata2020x24' ? m.speed : PRESET_NAMES[entry?.presetId] || '';
  const mode = c.intervalMode === 'count_up' ? m.count_up
    : c.intervalMode === 'two_phase' ? m.two_phase + (c.ladderEnabled ? ' + ' + m.ladder : '')
    : c.intervalMode === 'ladder' ? m.ladder : m.standard;
  return t.timer + (preset ? ' ' + preset : '') + ' · ' + mode + (hasLadder(c) && c.blockEnabled && c.intervalMode !== 'count_up' ? ' + ' + m.blocks : '');
}
export const sessionTitle = (session, snap, lang) =>
  session.origin === 'timer' && snap?.entries?.length === 1 ? timerLabel(snap.entries[0], lang) : snap?.name || diaryText(lang).untitled;

// In-app dropdown in the Tree filter's style (never the OS picker). options: [[value, text]].
// A tap anywhere outside an open dropdown or ⋮ menu closes it; taps inside (its items, its own toggle) work as usual.
const watched = new WeakSet();
function closeOnOutsideTap(doc) {
  if (watched.has(doc)) return;
  watched.add(doc);
  doc.addEventListener('pointerdown', e => { for (const d of doc.querySelectorAll('details.ft-dropdown[open],details.ft-diary-menu[open]')) if (!d.contains(e.target)) d.open = false; });
}
export function dropdown(doc, { label, options, value, onChange, className = '' }) {
  closeOnOutsideTap(doc);
  const box = el(doc, 'details', 'ft-route-filter-menu ft-dropdown' + (className ? ' ' + className : ''));
  const trigger = el(doc, 'summary', 'ft-route-filter-trigger');
  trigger.setAttribute('aria-label', label + ': ' + (options.find(([v]) => v === value)?.[1] ?? ''));
  trigger.append(el(doc, 'span', 'ft-dropdown-value', options.find(([v]) => v === value)?.[1] ?? ''), el(doc, 'span', 'ft-route-filter-arrow', '⌄'));
  const list = el(doc, 'div', 'ft-route-filter-options'); list.setAttribute('role', 'listbox');
  for (const [v, text] of options) {
    const o = button(doc, 'ft-route-filter-option' + (v === value ? ' is-active' : ''), text, () => { box.open = false; if (v !== value) onChange(v); });
    o.setAttribute('role', 'option'); o.setAttribute('aria-selected', String(v === value)); o.dataset.value = String(v);
    list.append(o);
  }
  box.append(trigger, list);
  return box;
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
      const years = sessions.map(s => Number(s.date.slice(0, 4)));
      const thisYear = Number(today.slice(0, 4));
      const from = Math.min(thisYear - 10, cal.month.y, ...years), to = Math.max(thisYear + 10, cal.month.y, ...years);
      row.append(dropdown(doc, { label: t.month, className: 'ft-diary-select', options: Array.from({ length: 12 }, (_, m) => [m, monthName(m)]), value: cal.month.m, onChange: m => go(cal.month.y, m) }),
        dropdown(doc, { label: t.year, className: 'ft-diary-select', options: Array.from({ length: to - from + 1 }, (_, i) => [from + i, String(from + i)]), value: cal.month.y, onChange: y => go(y, cal.month.m) }));
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

// A stage that came from the library gets the library card's own description; any other stage, an honest empty state.
let byTitle = null;
function libraryWorkout(stage) {
  if (!byTitle) { byTitle = new Map(); for (const w of LIBRARY) { const st = stageForWorkout(w); if (st?.title && !byTitle.has(st.title)) byTitle.set(st.title, w); } }
  return byTitle.get(stage.title) || null;
}
const stageName = (stage, lang) => stage.title || timerLabel(stage, lang);

// host: getDiary(), savedPrograms(), profiles(), startSession(session, snap), openProgram(program, date),
// renderStages(session, snap, {expanded, commit, removeWorkout}), saveAs(session, snap), addStages(session, snap),
// assign(snapshots, program, date), startLibrary(date), confirmRemove({name, trigger, onConfirm}), confirmDelete({...}).
export function createDiaryView(doc, host, { now = () => new Date() } = {}) {
  const cal = createCalendar(doc, { now });
  const multi = createCalendar(doc, { now, multi: true });
  let pick = null, adding = false, source = 'mine', note = '';
  // Opened stages of planned appointments (session id + stage index), kept while the diary is redrawn after an edit.
  const opened = new Set();
  closeOnOutsideTap(doc);

  // Only what was recorded: never-started and partly done are told apart; partial shows the rounds and stages really finished.
  function stateText(session, today, t, snap) {
    if (session.status === 'done') return t.done;
    if (session.status === 'planned') return session.date < today ? t.missed : t.planned;
    const done = session.facts?.roundsDone || 0;
    const ends = compileProgram(snap.entries, {}, snap.options).map(r => r.stageRound === r.stageRounds);
    const stages = ends.length > 1 && ends.filter(Boolean).length > 1 ? ' · ' + t.stages(ends.slice(0, done).filter(Boolean).length, ends.filter(Boolean).length) : '';
    return t.running + ' · ' + t.rounds(done, session.facts?.roundsTotal) + stages;
  }

  // One workout = one card: title, status, rounds and total time (work, rests, between stages), then each stage as the
  // existing compact card (tap: its rounds; ☰: its description) with the real rest between stages.
  function sessionCard(diary, session, today, t, lang, rerender) {
    const snap = diary.snapshot(session.execRef || session.planRef) || { name: t.program, entries: [], options: {} };
    const name = sessionTitle(session, snap, lang);
    const entries = normalizeProgram(snap.entries), options = normalizeOptions(snap.options);
    const all = compileProgram(entries, {}, options);
    const card = el(doc, 'article', 'ft-diary-session is-' + (session.status === 'planned' && session.date < today ? 'missed' : session.status));
    const top = el(doc, 'div', 'ft-diary-session-top');
    top.append(el(doc, 'strong', 'ft-diary-session-name ft-program-title', name), menu(diary, session, snap, name, t, rerender));
    const times = [stateText(session, today, t, snap)];
    if (session.startedAt) times.push(t.started + new Intl.DateTimeFormat(lang === 'en' ? 'en' : 'ru', { hour: '2-digit', minute: '2-digit' }).format(new Date(session.startedAt)));
    if (session.facts?.activeSec > 0) times.push(t.actual + timeWords(session.facts.activeSec, lang));
    const total = all.reduce((sum, r) => sum + r.workSec + (r.phaseTwoSec || 0) + r.restSec + (r.blockRestSec || 0), 0);
    card.append(top, el(doc, 'p', 'ft-program-badge', times.join(' · ')),
      el(doc, 'p', 'ft-diary-session-facts', [t.roundsCount(all.length), ...(options.cycles > 1 ? [t.cycles(options.cycles)] : []),
        all.some(r => r.intervalMode === 'count_up') ? t.noLimit : t.total + timeWords(total, lang)].join(' · ')));
    const stages = el(doc, 'div', 'ft-diary-stages');
    // A planned appointment is edited in place with the editor's own stage cards (STAGE 4); a done or partial record
    // stays read-only history.
    if (session.status === 'planned' && host.renderStages) {
      const key = i => session.id + ':' + i;
      // drop(i, n): stage i of n leaves; the stages after it keep their open/closed state at their new index.
      const drop = (i, n) => { const open = Array.from({ length: n }, (_, j) => opened.delete(key(j))); open.splice(i, 1); open.forEach((o, j) => o && opened.add(key(j))); };
      stages.append(host.renderStages(session, snap, { expanded: { has: i => opened.has(key(i)), toggle: i => opened.has(key(i)) ? opened.delete(key(i)) : opened.add(key(i)), drop },
        commit: mutate => change(diary, mutate, rerender), removeWorkout: trigger => removeAssignment(diary, session, name, trigger, rerender) }));
    } else entries.forEach((stage, i) => {
      const workout = libraryWorkout(stage);
      stages.append(renderCompactCard(doc, { className: 'ft-diary-stage', title: t.stage + (i + 1) + ' · ' + stageName(stage, lang),
        rounds: compileProgram([stage], {}, { cycles: 1 }), lang,
        description: elx => workout ? libraryDescription(doc, elx, workout, lang) : renderDescription(doc, elx, [], lang) }));
      if (i < entries.length - 1) stages.append(el(doc, 'p', 'ft-diary-between', t.between + timeClock(stage.restAfterSec)));
    });
    if (options.cycles > 1) stages.append(el(doc, 'p', 'ft-diary-between', t.betweenCycles + timeClock(options.cycleRestSec)));
    // STAGE 4.1: stages from the library go into THIS workout (no new workout); «Добавить тренировку» stays outside the card.
    if (session.status === 'planned' && host.addStages) stages.append(button(doc, 'ft-diary-add-stage', t.addStage, () => host.addStages(session, snap)));
    const actions = el(doc, 'div', 'ft-diary-session-actions');
    // «Изменить» is gone: the stage cards above are edited in place (owner addendum).
    actions.append(button(doc, 'ft-diary-start', t.start, () => host.startSession(session, snap)));
    card.append(stages, actions);
    return card;
  }

  function menu(diary, session, snap, name, t, rerender) {
    const box = el(doc, 'details', 'ft-diary-menu');
    const summary = el(doc, 'summary', 'ft-diary-menu-button', '⋮'); summary.setAttribute('aria-label', t.menu + ': ' + name);
    const items = el(doc, 'div', 'ft-diary-menu-list');
    const choose = kind => () => { pick = { kind, id: session.id, name }; box.open = false; if (kind === 'assign') { multi.selected.clear(); multi.month = null; multi.show(session.date); } rerender(); };
    const label = name + ' · ' + session.date.split('-').reverse().join('.');
    if (session.status === 'planned') items.append(button(doc, 'ft-diary-menu-item', t.move, choose('move')));
    items.append(button(doc, 'ft-diary-menu-item', t.repeat, choose('repeat')), button(doc, 'ft-diary-menu-item', t.assignDates, choose('assign')));
    if (host.saveAs) items.append(button(doc, 'ft-diary-menu-item', t.saveAs, () => { box.open = false; host.saveAs(session, snap); }));
    if (session.status === 'planned') items.append(button(doc, 'ft-diary-menu-item', t.remove, () => { box.open = false; removeAssignment(diary, session, name, summary, rerender); }));
    else items.append(button(doc, 'ft-diary-menu-item', t.deleteForever, () => {
      box.open = false;
      // Owner 2026-10-31: a done or partial record may be deleted for good, after the stronger confirmation.
      host.confirmDelete({ name: label, trigger: summary, onConfirm: () => change(diary, d => {
        const i = d.sessions.findIndex(x => x.id === session.id); if (i < 0) return false;
        d.sessions.splice(i, 1); dropUnused(d);
      }, rerender) });
    }));
    box.append(summary, items);
    return box;
  }

  // ⋮ «Удалить из календаря» and × of a workout's only stage: one dialog, one handler.
  function removeAssignment(diary, session, name, trigger, rerender) {
    host.confirmRemove({ name: name + ' · ' + session.date.split('-').reverse().join('.'), trigger, onConfirm: () => change(diary, d => {
      const s = d.sessions.find(x => x.id === session.id && x.status === 'planned'); if (!s) return false;
      // Removing an assignment keeps the record (status canceled): it only leaves the calendar.
      s.status = 'canceled'; s.canceledAt = Date.now(); s.updatedAt = s.canceledAt;
    }, rerender) });
  }

  async function change(diary, mutate, rerender) {
    note = (await diary.commit(mutate)) === false ? diaryText(doc.documentElement.lang).failed : '';
    rerender();
  }

  function addPanel(diary, date, t, lang, rerender) {
    const panel = el(doc, 'div', 'ft-diary-add');
    const label = el(doc, 'div', 'ft-diary-source');
    label.append(el(doc, 'span', '', t.source), dropdown(doc, { label: t.source, className: 'ft-diary-source-menu', options: [['mine', t.mine], ['library', t.library]], value: source,
      onChange: v => { if (v === 'library') { adding = false; host.startLibrary(date); } else { source = v; rerender(); } } }));
    panel.append(label);
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

  // «Назначить на даты»: the same workout on more dates. A date that already has it planned is skipped, its own date stays.
  function assignMore(diary, rerender) {
    const { id } = pick, dates = [...multi.selected].sort();
    pick = null;
    change(diary, d => {
      const s = d.sessions.find(x => x.id === id); if (!s) return false;
      const ref = s.execRef || s.planRef, at = Date.now();
      let added = 0;
      for (const date of dates) {
        if (date === s.date || d.sessions.some(x => x.date === date && x.status === 'planned' && (x.planRef === ref || (s.programId && x.programId === s.programId)))) continue;
        d.sessions.push({ id: newId('d'), date, status: 'planned', programId: s.programId ?? null, planRef: ref, origin: 'assign', repeatOf: s.id, createdAt: at, updatedAt: at });
        added++;
      }
      if (!added) return false;
    }, rerender);
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
      hint.append(el(doc, 'span', '', ({ move: t.pickMove, repeat: t.pickRepeat, assign: t.pickAssign })[pick.kind](pick.name)), button(doc, 'ft-diary-hint-cancel', '×', () => { pick = null; rerender(); }));
      hint.lastChild.setAttribute('aria-label', t.cancelPick);
    }
    if (pick?.kind === 'assign') {
      const surface = multi.render(lang, sessions, { onChange: rerender, hint });
      const n = multi.selected.size;
      const go = button(doc, 'ft-diary-assign-confirm', n ? assignLabel(n, lang) : t.pickDates, () => assignMore(diary, rerender));
      go.disabled = !n;
      surface.append(go);
      root.append(surface);
    } else {
      const onTap = key => {
        adding = false;
        if (!pick) return;
        const { kind, id } = pick; pick = null;
        change(diary, d => {
          const s = d.sessions.find(x => x.id === id); if (!s) return false;
          if (kind === 'move') { if (s.status !== 'planned' || s.date === key) return false; s.date = key; s.updatedAt = Date.now(); return; }
          const at = Date.now();
          d.sessions.push({ id: newId('d'), date: key, status: 'planned', programId: s.programId ?? null,
            planRef: s.execRef || s.planRef, origin: 'repeat', repeatOf: s.id, createdAt: at, updatedAt: at });
        }, rerender);
      };
      root.append(cal.render(lang, sessions, { onTap, onChange: rerender, hint }));
    }

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
  // show(date): open the diary on this date (after a library pick, «×» comes back here).
  return { render, calendar: cal, show(date) { pick = null; adding = false; cal.selected = date; cal.show(date); } };
}
