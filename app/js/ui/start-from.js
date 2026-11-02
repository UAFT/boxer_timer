// One «Начать тренировку с» control for the program editor, the workout plan and a diary workout.
// It only picks a position; the run itself is the normal program start from that position (core/program.js startIndex).
// Collapsed it is one row; expanded: «Этап | Раунд» labels with ˄, two equal dropdowns (Fight Tech choice dialog), the start button.
import { wholeTranslation as name } from '../i18n/locale.js';
import { bilingual, choiceField } from './choice-dialog.js';
const TEXT = { ru: { stage: 'Этап ', block: 'Блок ', round: 'Раунд ' }, en: { stage: 'Stage ', block: 'Block ', round: 'Round ' } };
const option = (value, parts) => {
  const text = lang => parts.map(p => typeof p === 'string' ? name(p, lang) : TEXT[lang][p.k] + p.n).join(' · ');
  return { value: String(value), ru: text('ru'), en: text('en') };
};
const chevron = doc => Object.assign(doc.createElement('span'), { className: 'ft-choice-chevron' });
let seq = 0;
// rounds: the first cycle of the compiled program. onStart({stage, round}) starts the run.
export function renderStartFrom(doc, { rounds, disabled = false, onStart }) {
  const id = 'ftStartFrom' + (++seq);
  const box = doc.createElement('div'); box.className = 'ft-start-from';
  const stages = [...new Set(rounds.map(r => r.stageIndex))];
  const stageOptions = stages.map(i => { const title = rounds.find(r => r.stageIndex === i).stageTitle; return option(i, [{ k: 'stage', n: i + 1 }, ...(title ? [title] : [])]); });
  const roundOptions = stage => rounds.filter(r => r.stageIndex === Number(stage)).map(r => option(r.stageRound,
    [...(r.blockCount > 1 ? [{ k: 'block', n: r.block }] : []), { k: 'round', n: r.blockCount > 1 ? r.localRound : r.stageRound }, ...(r.roundName ? [r.roundName] : [])]));
  const toggle = doc.createElement('button'); toggle.type = 'button'; toggle.className = 'ft-start-from-toggle';
  toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-controls', id);
  toggle.append(bilingual(doc, 'span', 'ft-start-from-toggle-text', 'Начать тренировку с', 'Start workout from'), chevron(doc));
  const panel = doc.createElement('div'); panel.className = 'ft-start-from-panel'; panel.id = id; panel.hidden = true;
  const labels = doc.createElement('div'); labels.className = 'ft-start-from-labels';
  const stageLabel = bilingual(doc, 'span', '', 'Этап', 'Stage'), roundLabel = bilingual(doc, 'span', '', 'Раунд', 'Round');
  stageLabel.id = id + 's'; roundLabel.id = id + 'r';
  const collapse = doc.createElement('button'); collapse.type = 'button'; collapse.className = 'ft-start-from-collapse';
  collapse.setAttribute('aria-expanded', 'true'); collapse.setAttribute('aria-controls', id); collapse.setAttribute('aria-label', 'Свернуть');
  collapse.append(chevron(doc));
  labels.append(stageLabel, roundLabel, collapse);
  const round = choiceField(doc, { label: { ru: 'Раунд', en: 'Round' }, options: roundOptions(stages[0]), value: '1', labelledBy: roundLabel.id, onChange: () => fit() });
  // A new stage starts again from its round 1.
  const stage = choiceField(doc, { label: { ru: 'Этап', en: 'Stage' }, options: stageOptions, value: String(stages[0] ?? ''), labelledBy: stageLabel.id,
    onChange: v => { round.set(roundOptions(v), roundOptions(v)[0]?.value); fit(); } });
  stage.el.classList.add('ft-start-from-select'); round.el.classList.add('ft-start-from-select');
  // «Раунд» over the second dropdown, shown only when the two are stacked.
  const stackedLabel = bilingual(doc, 'span', 'ft-start-from-stacked-label', 'Раунд', 'Round'); stackedLabel.setAttribute('aria-hidden', 'true');
  const row = doc.createElement('div'); row.className = 'ft-start-from-row'; row.append(stage.el, stackedLabel, round.el);
  const go = doc.createElement('button'); go.type = 'button'; go.className = 'ft-start-from-go'; go.textContent = 'Начать тренировку с';
  toggle.disabled = go.disabled = stage.el.disabled = round.el.disabled = disabled || !stages.length;
  go.addEventListener('click', () => onStart({ stage: Number(stage.value), round: Number(round.value) }));
  // Words never break inside: when one cannot fit beside the other dropdown, the two stack (as Settings «Подписка» does).
  const fit = () => { panel.classList.remove('is-stacked'); if ([...row.querySelectorAll('.ft-choice-value')].some(v => v.scrollWidth > v.clientWidth + 1)) panel.classList.add('is-stacked'); };
  // Refit on a new width only: stacking changes the height, which must not trigger another round.
  let width = 0;
  globalThis.ResizeObserver && new ResizeObserver(([e]) => { const w = Math.round(e.contentRect.width); if (w && w !== width) { width = w; fit(); } }).observe(panel);
  const expand = open => { panel.hidden = !open; toggle.hidden = open; if (open) fit(); (open ? collapse : toggle).focus(); };
  toggle.addEventListener('click', () => expand(true));
  collapse.addEventListener('click', () => expand(false));
  panel.append(labels, row, go);
  box.append(toggle, panel);
  return box;
}
