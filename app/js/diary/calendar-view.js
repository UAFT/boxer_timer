// «Дневник» tab: month calendar and the selected day's sessions. Read-only in STAGE 1.
import { compileProgram, normalizeOptions, normalizeProgram } from '../core/program.js';
import { timeWords } from '../ui/library-card-view.js';
import { renderPlanList } from '../ui/workout-plan-view.js';
import { dayDots, dayStatus, localDate, monthCells, readDiary } from './store.js';

const TEXT = {
  ru: { prev: 'Предыдущий месяц', next: 'Следующий месяц', today: 'Сегодня', count: 'Тренировок: ',
    day: { empty: 'Тренировок нет', planned: 'Запланировано', done: 'Выполнено', partial: 'Выполнено не полностью', missed: 'Не выполнено' },
    legend: [['done', 'Выполнено'], ['partial', 'Частично'], ['planned', 'Запланировано']],
    done: 'Выполнена', planned: 'Запланирована', missed: 'Тренировка не запускалась', running: 'Не завершена',
    rounds: (n, total) => 'Выполнено раундов: ' + n + (total ? ' из ' + total : ''),
    plan: 'План: ', actual: 'Фактически: ', program: 'Программа' },
  en: { prev: 'Previous month', next: 'Next month', today: 'Today', count: 'Workouts: ',
    day: { empty: 'No workouts', planned: 'Planned', done: 'Completed', partial: 'Not fully completed', missed: 'Not completed' },
    legend: [['done', 'Completed'], ['partial', 'Partial'], ['planned', 'Planned']],
    done: 'Completed', planned: 'Planned', missed: 'Workout was not started', running: 'Not finished',
    rounds: (n, total) => 'Rounds completed: ' + n + (total ? ' of ' + total : ''),
    plan: 'Plan: ', actual: 'Actual: ', program: 'Program' }
};
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const fromKey = key => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); };

function el(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function createDiaryView(doc, { storage = globalThis.localStorage, now = () => new Date() } = {}) {
  let month = null, selected = null;

  function sessionCard(session, today, t, lang) {
    const card = el(doc, 'details', 'ft-diary-session');
    const head = el(doc, 'summary', 'ft-diary-session-head');
    const snap = session.snapshot || {};
    head.append(el(doc, 'strong', 'ft-diary-session-name', snap.name || t.program));
    let state;
    if (session.status === 'done') state = t.done;
    else if (session.status === 'planned') state = session.date < today ? t.missed : t.planned;
    else state = t.running + ' · ' + t.rounds(session.facts?.roundsDone || 0, snap.roundsTotal);
    head.append(el(doc, 'span', 'ft-diary-session-state', state));
    const times = [];
    if (snap.plannedSec > 0) times.push(t.plan + timeWords(snap.plannedSec, lang));
    if (session.facts?.activeSec > 0) times.push(t.actual + timeWords(session.facts.activeSec, lang));
    if (times.length) head.append(el(doc, 'span', 'ft-diary-session-time', times.join(' · ')));
    card.append(head);
    // Stored snapshot carries its own settings, so later edits to «Мои» never change history.
    const rounds = compileProgram(normalizeProgram(snap.entries), {}, normalizeOptions(snap.options));
    if (rounds.length) card.append(renderPlanList(doc, rounds, lang));
    return card;
  }

  function render(list, lang = 'ru') {
    const t = TEXT[lang === 'en' ? 'en' : 'ru'], locale = lang === 'en' ? 'en' : 'ru';
    const today = localDate(now());
    if (!month) { const d = now(); month = { y: d.getFullYear(), m: d.getMonth() }; }
    if (!selected) selected = today;
    const sessions = readDiary(storage);
    const rerender = () => render(list, lang);
    const root = el(doc, 'div', 'ft-diary');
    const surface = el(doc, 'section', 'ft-diary-calendar');

    const nav = el(doc, 'div', 'ft-diary-month');
    const step = (label, sign, delta) => {
      const b = el(doc, 'button', 'ft-diary-step', sign); b.type = 'button'; b.setAttribute('aria-label', label);
      b.addEventListener('click', () => { const d = new Date(month.y, month.m + delta, 1); month = { y: d.getFullYear(), m: d.getMonth() }; rerender(); });
      return b;
    };
    const title = el(doc, 'h3', 'ft-diary-month-title',
      cap(new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(month.y, month.m, 1))) + ' ' + month.y);
    const todayBtn = el(doc, 'button', 'ft-diary-today', t.today); todayBtn.type = 'button';
    todayBtn.addEventListener('click', () => { const d = now(); month = { y: d.getFullYear(), m: d.getMonth() }; selected = localDate(d); rerender(); });
    nav.append(step(t.prev, '‹', -1), title, step(t.next, '›', 1));

    const grid = el(doc, 'div', 'ft-diary-grid');
    const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    for (let i = 0; i < 7; i++) grid.append(el(doc, 'span', 'ft-diary-weekday', cap(weekday.format(new Date(2024, 0, 1 + i)))));
    for (const key of monthCells(month.y, month.m)) {
      if (!key) { grid.append(el(doc, 'span', 'ft-diary-blank')); continue; }
      const status = dayStatus(sessions, key, today);
      const chip = el(doc, 'button', 'ft-diary-day is-' + status); chip.type = 'button';
      chip.dataset.date = key;
      if (key === today) chip.classList.add('is-today');
      if (key === selected) chip.classList.add('is-selected');
      chip.setAttribute('aria-pressed', String(key === selected));
      chip.setAttribute('aria-label', new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(fromKey(key)) + ', ' + t.day[status]);
      chip.append(el(doc, 'span', 'ft-diary-num', String(Number(key.slice(8)))));
      const dots = dayDots(sessions, key, today);
      if (dots.length) { const row = el(doc, 'span', 'ft-diary-dots'); for (const d of dots) row.append(el(doc, 'i', 'ft-diary-dot is-' + d)); chip.append(row); }
      chip.addEventListener('click', () => { selected = key; rerender(); });
      grid.append(chip);
    }
    const legend = el(doc, 'div', 'ft-diary-legend');
    for (const [status, label] of t.legend) { const item = el(doc, 'span', 'ft-diary-legend-item'); item.append(el(doc, 'i', 'ft-diary-swatch is-' + status), label); legend.append(item); }
    legend.append(todayBtn);
    surface.append(nav, grid, legend);

    const detail = el(doc, 'section', 'ft-diary-detail');
    const daySessions = sessions.filter(s => s.date === selected && s.status !== 'canceled');
    detail.append(el(doc, 'h3', 'ft-diary-detail-date',
      cap(new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(fromKey(selected)))));
    const status = dayStatus(sessions, selected, today);
    detail.append(el(doc, 'p', 'ft-diary-detail-status', status === 'empty' ? t.day.empty : t.day[status] + ' · ' + t.count + daySessions.length));
    for (const s of daySessions) detail.append(sessionCard(s, today, t, lang));

    root.append(surface, detail);
    list.replaceChildren(root);
  }
  return { render };
}
