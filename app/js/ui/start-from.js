// One «Этап / Раунд → Начать тренировку с» control for the program editor, the workout plan and a diary workout.
// It only picks a position; the run itself is the normal program start from that position (core/program.js startIndex).
import { translateText } from '../i18n/locale.js';
const TEXT = { ru: { stage: 'Этап ', block: 'Блок ', round: 'Раунд ' }, en: { stage: 'Stage ', block: 'Block ', round: 'Round ' } };
// The option text is built per language here (data-ft-ru/en). A name is put in English only when every word of it is known
// (library names); a user's own name stays as written.
const name = (text, lang) => { const en = lang === 'en' ? translateText(text, 'en') : text; return /[А-Яа-яЁё]/.test(en) ? text : en; };
function option(doc, value, parts) {
  const o = doc.createElement('option');
  o.value = String(value);
  const text = lang => parts.map(p => typeof p === 'string' ? name(p, lang) : TEXT[lang][p.k] + p.n).join(' · ');
  o.dataset.ftRu = text('ru'); o.dataset.ftEn = text('en');
  o.textContent = text(doc.documentElement.lang === 'en' ? 'en' : 'ru');
  return o;
}
// rounds: the first cycle of the compiled program. onStart({stage, round}) starts the run.
export function renderStartFrom(doc, { rounds, disabled = false, onStart }) {
  const box = doc.createElement('div'); box.className = 'ft-start-from';
  const field = (label, select) => { const l = doc.createElement('label'); l.className = 'ft-start-from-field'; const s = doc.createElement('span'); s.textContent = label; l.append(s, select); return l; };
  const stage = doc.createElement('select'), round = doc.createElement('select');
  stage.className = round.className = 'ft-start-from-select';
  const stages = [...new Set(rounds.map(r => r.stageIndex))];
  for (const i of stages) {
    const title = rounds.find(r => r.stageIndex === i).stageTitle;
    stage.append(option(doc, i, [{ k: 'stage', n: i + 1 }, ...(title ? [title] : [])]));
  }
  const fillRounds = () => {
    round.replaceChildren(...rounds.filter(r => r.stageIndex === Number(stage.value)).map(r => option(doc, r.stageRound,
      [...(r.blockCount > 1 ? [{ k: 'block', n: r.block }] : []), { k: 'round', n: r.blockCount > 1 ? r.localRound : r.stageRound }, ...(r.roundName ? [r.roundName] : [])])));
  };
  // A new stage starts again from its round 1.
  stage.addEventListener('change', fillRounds);
  fillRounds();
  const go = doc.createElement('button'); go.type = 'button'; go.className = 'ft-start-from-go'; go.textContent = 'Начать тренировку с';
  go.disabled = stage.disabled = round.disabled = disabled || !stages.length;
  go.addEventListener('click', () => onStart({ stage: Number(stage.value), round: Number(round.value) }));
  const row = doc.createElement('div'); row.className = 'ft-start-from-row';
  row.append(field('Этап', stage), field('Раунд', round));
  box.append(row, go);
  return box;
}
