import { timeClock, timeWords, russianCount } from './library-card-view.js';

// Compact workout cards (library and «Мои»): every figure comes from the compiled rounds the
// timer plays, so a card never shows a uniform time the workout does not have.
const roundsTotal = rounds => rounds.reduce((sum, r) => sum + r.workSec + (r.phaseTwoSec || 0) + r.restSec + (r.blockRestSec || 0), 0);
const span = values => {
  const low = Math.min(...values), high = Math.max(...values);
  return timeClock(low) + (low === high ? '' : '–' + timeClock(high));
};

export function planSummary(rounds, lang = 'ru') {
  const ru = lang !== 'en';
  const unbounded = rounds.some(r => r.intervalMode === 'count_up');
  const timed = rounds.filter(r => r.intervalMode !== 'count_up');
  const total = unbounded ? (ru ? 'Без ограничения времени' : 'No time limit') : timeWords(roundsTotal(rounds), lang);
  if (!timed.length) return { line: ru ? 'Прямой отсчёт · без ограничения времени' : 'Count up · no time limit', total, unbounded };
  const count = ru ? russianCount(rounds.length) : rounds.length + (rounds.length === 1 ? ' round' : ' rounds');
  const twos = timed.filter(r => r.phaseTwoSec > 0).map(r => r.phaseTwoSec);
  const rests = rounds.slice(0, -1).map(r => r.restSec);
  const blocks = rounds.filter(r => r.blockRestSec > 0).map(r => r.blockRestSec);
  const line = [count,
    (ru ? 'работа ' : 'work ') + span(timed.map(r => r.workSec)) + (twos.length ? ' + ' + span(twos) : ''),
    (ru ? 'отдых ' : 'rest ') + (rests.length ? span(rests) : timeClock(0)),
    ...(blocks.length ? [(ru ? 'между блоками ' : 'between blocks ') + span(blocks)] : [])
  ].join(' · ');
  return { line, total, unbounded };
}

function add(doc, parent, tag, className, text) {
  const el = doc.createElement(tag); el.className = className; el.textContent = text; parent.append(el); return el;
}

// One row per played round, in playback order; the last round has no rest after it.
export function renderPlanList(doc, rounds, lang = 'ru') {
  const ru = lang !== 'en';
  const list = doc.createElement('ol'); list.className = 'ft-plan-rounds';
  const multi = rounds.some(r => r.stageIndex > 0) || rounds.some(r => r.cycleIndex > 0);
  rounds.forEach((r, i) => {
    const prev = rounds[i - 1];
    if (multi && (!prev || prev.stageIndex !== r.stageIndex || prev.cycleIndex !== r.cycleIndex))
      add(doc, list, 'li', 'ft-plan-stage', (r.cycles > 1 ? (ru ? 'Цикл ' : 'Cycle ') + (r.cycleIndex + 1) + ' · ' : '')
        + (ru ? 'Этап ' : 'Stage ') + (r.stageIndex + 1) + (r.stageTitle ? ' · ' + r.stageTitle : ''));
    const item = doc.createElement('li'); item.className = 'ft-plan-round';
    const phases = r.phaseTwoSec > 0 ? [r.phaseOneName, r.phaseTwoName].filter(Boolean).join(' → ') : '';
    add(doc, item, 'strong', 'ft-plan-round-name', (i + 1) + '. ' + (r.roundName || phases || (ru ? 'Раунд ' : 'Round ') + r.stageRound));
    const work = r.intervalMode === 'count_up' ? (ru ? 'прямой отсчёт' : 'count up')
      : (ru ? 'работа ' : 'work ') + timeClock(r.workSec) + (r.phaseTwoSec > 0 ? ' + ' + timeClock(r.phaseTwoSec) : '');
    const last = i === rounds.length - 1, next = rounds[i + 1];
    const restLabel = last || !r.restSec ? '' : next && next.cycleIndex !== r.cycleIndex ? (ru ? 'пауза между циклами ' : 'between cycles ')
      : next && next.stageIndex !== r.stageIndex ? (ru ? 'пауза между этапами ' : 'between stages ') : (ru ? 'отдых ' : 'rest ');
    add(doc, item, 'span', 'ft-plan-round-time', [work,
      ...(restLabel ? [restLabel + timeClock(r.restSec)] : []),
      ...(!last && r.blockRestSec > 0 ? [(ru ? 'между блоками ' : 'between blocks ') + timeClock(r.blockRestSec)] : [])
    ].join(' · '));
    if (r.roundDescription) add(doc, item, 'small', 'ft-plan-round-note', r.roundDescription);
    list.append(item);
  });
  return list;
}

export function createMenuIcon(doc) {
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [name, value] of [['viewBox', '0 0 24 24'], ['fill', 'none'], ['stroke', 'currentColor'], ['stroke-width', '1.9'], ['stroke-linecap', 'round'], ['aria-hidden', 'true']]) svg.setAttribute(name, value);
  svg.classList.add('ft-action-icon');
  for (const y of [6, 12, 18]) { const p = doc.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', 'M4 ' + y + 'h16'); svg.append(p); }
  return svg;
}

let panelSeq = 0;
// Card body toggles the round plan, the ☰ button toggles the description; both panels are
// built on first open. Action buttons sit outside the body, so expanding never adds.
export function renderCompactCard(doc, { className = '', title, rounds, lang = 'ru', badge = '', plan, description, actions = [] }) {
  const ru = lang !== 'en';
  const id = 'ft-card-' + (++panelSeq);
  const row = doc.createElement('div'); row.className = 'program-library-entry ft-saved-program-entry ft-compact-card' + (className ? ' ' + className : '');
  const body = doc.createElement('button'); body.type = 'button'; body.className = 'program-library-entry-open ft-saved-program-open';
  const heading = doc.createElement('div'); heading.className = 'ft-saved-program-heading';
  add(doc, heading, 'strong', 'ft-program-title', title);
  if (rounds.length) {
    const facts = planSummary(rounds, lang);
    add(doc, heading, 'span', 'ft-program-summary', facts.line);
    add(doc, heading, 'span', 'ft-program-total', facts.total);
  } else add(doc, heading, 'span', 'ft-program-summary', ru ? 'Требует отдельного режима таймера' : 'Needs a separate timer mode');
  if (badge) add(doc, heading, 'span', 'ft-program-badge', badge);
  body.append(heading);
  const panel = (kind, build) => {
    const el = doc.createElement('div'); el.className = 'ft-card-panel ft-card-' + kind; el.id = id + '-' + kind; el.hidden = true;
    let ready = false;
    return { el, toggle() { if (!ready) { build(el); ready = true; } el.hidden = !el.hidden; return !el.hidden; } };
  };
  const planPanel = panel('plan', plan || (el => el.append(renderPlanList(doc, rounds, lang))));
  const infoPanel = panel('info', description);
  const bodyLabel = open => (ru ? (open ? 'Свернуть план ' : 'Показать план ') : (open ? 'Collapse plan ' : 'Show plan ')) + title;
  body.setAttribute('aria-expanded', 'false'); body.setAttribute('aria-controls', planPanel.el.id); body.setAttribute('aria-label', bodyLabel(false));
  body.addEventListener('click', () => {
    const open = planPanel.toggle();
    body.setAttribute('aria-expanded', String(open)); body.setAttribute('aria-label', bodyLabel(open));
    row.classList.toggle('is-expanded', open);
  });
  const info = doc.createElement('button'); info.type = 'button'; info.className = 'ft-description-button';
  info.title = ru ? 'Описание' : 'Description';
  info.setAttribute('aria-label', (ru ? 'Описание ' : 'Description ') + title);
  info.setAttribute('aria-expanded', 'false'); info.setAttribute('aria-controls', infoPanel.el.id);
  info.append(createMenuIcon(doc));
  info.addEventListener('click', () => info.setAttribute('aria-expanded', String(infoPanel.toggle())));
  const controls = doc.createElement('div'); controls.className = 'ft-program-actions';
  controls.append(info, ...actions);
  row.append(body, controls, infoPanel.el, planPanel.el);
  return row;
}

// Description panel: only what the data holds; otherwise an honest empty state.
export function renderDescription(doc, el, sections, lang = 'ru') {
  const shown = sections.filter(([, text]) => text);
  if (!shown.length) { add(doc, el, 'p', 'ft-card-empty', lang !== 'en' ? 'Описание пока не добавлено.' : 'No description yet.'); return; }
  for (const [label, text] of shown) {
    const block = doc.createElement('p'); block.className = 'ft-card-section';
    add(doc, block, 'strong', 'ft-card-section-label', label);
    add(doc, block, 'span', 'ft-card-section-text', text);
    el.append(block);
  }
}

const DRAFT = /ПРОЕКТ|НЕ ГОТОВ|DRAFT|NOT READY/i;
// Library workout: same compact card; + adds the stage exactly as before.
export function renderLibraryWorkoutCard(doc, workout, { rounds = [], lang = 'ru', addDisabled = false, onAdd, plusIcon } = {}) {
  const ru = lang !== 'en';
  const plus = doc.createElement('button'); plus.type = 'button'; plus.className = 'native-library-add ft-library-add';
  plus.disabled = addDisabled; plus.title = ru ? 'Добавить' : 'Add';
  plus.setAttribute('aria-label', (ru ? 'Добавить ' : 'Add ') + workout.name);
  const icon = () => plus.replaceChildren(plusIcon ? plusIcon() : '+');
  icon();
  plus.addEventListener('click', () => { if (onAdd?.()) { plus.replaceChildren('✓'); setTimeout(icon, 800); } });
  const description = el => renderDescription(doc, el, [
    [ru ? 'Оборудование' : 'Equipment', workout.equipment],
    [ru ? 'Упражнения' : 'Exercises', workout.mode === 'boxing_sequence' ? '' : (workout.tasks || []).join(' · ')],
    [ru ? 'Примечание' : 'Note', workout.note],
    [ru ? 'Источник' : 'Source', workout.source]
  ], lang);
  return renderCompactCard(doc, { className: 'ft-library-workout', title: workout.name, rounds, lang, description, actions: [plus],
    badge: DRAFT.test(workout.note || '') ? (ru ? 'Черновик — см. описание' : 'Draft — see description') : '',
    plan: rounds.length ? undefined : el => add(doc, el, 'p', 'ft-card-empty', ru ? 'План недоступен: требуется отдельный режим таймера.' : 'No plan: needs a separate timer mode.') });
}
