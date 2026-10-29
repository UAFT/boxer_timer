// Navigation overlay for the methodology tab: V63 (2026-10-28), regrouped by the owner canon in V64 (2026-10-28), V65 and V66 (2026-10-29). Data only: the book tree
// (methodology-v42-data.js) and the trainings (methodology-v42-rounds.js) are not changed here. A stage listed here shows these substages,
// each training exactly once, then one «Книжные карточки» substage with all its book program cards read-only. Removing the import in
// methodology-v42-view.js restores the V58–V61 layout.
export const V63_STAGE_TITLES = {
  'FAR-STRAIGHT-COUNTER': 'Одиночные прямые: защита — ответ, встречные',   // V67 owner TASK 2026-10-29
  'FAR-PARRY': 'Защитные действия с переходом на ближнюю дистанцию',
};

// Literal hand and target of a single straight that opens the round (stance does not mirror it). Double straights and the mixed parry
// round have none.
const OWN = /[Пп]рям[а-яё]* (левой|правой)[^.;,]*?в (голову|корпус|туловище)/;
const LEAD = /^(Левый|Правый) прямой в (голову|корпус)/;   // V66: a stage 9 round name opens with the full straight
export function openingStraight(round) {
  if (/Два прям/.test(round.name)) return null;
  const l = LEAD.exec(round.name);
  if (l) return (l[1] === 'Левый' ? 'L' : 'R') + (l[2] === 'голову' ? 'H' : 'B');
  const m = OWN.exec(round.name) || OWN.exec(round.description);
  return m ? (m[1] === 'левой' ? 'L' : 'R') + (m[2] === 'голову' ? 'H' : 'B') : null;
}

// V65 (2026-10-29), boxing school: a substage = one fixed straight + one kind of defence, cards = technical programs of that kind, in
// school order (legs → blocks → parries → double elbow → pull-backs → slips → variative); combined programs whole at the end of a stage.
const ST = { LH: 'Левый прямой в голову', RH: 'Правый прямой в голову', LB: 'Левый прямой в корпус', RB: 'Правый прямой в корпус' };
const ANS = { LH: 'Ответный левый прямой в голову', RH: 'Ответный правый прямой в голову', LB: 'Ответный левый прямой в корпус', RB: 'Ответный правый прямой в корпус' };
const OTHER = { L: 'R', R: 'L' };
const KIND = { FEET: 'защита ногами', BLOCK: 'подставки', PARRY: 'отбивы', ELBOW: 'двойная локтевая защита', PULL: 'оттяжки', SLIP: 'уклоны', VAR: 'вариативная защита' };
// V66 (2026-10-29, owner TASK V66): per straight — 1 movement card, 2 block cards (palms, bent arms), 8 parry cards (in/out/up/down × left/right
// hand), 2 double-elbow cards (head, body), 1 pull-back card, 1 variative program of 10 rounds. Replaced V65 cards are archived in the data.
const PARRY = ['IN', 'OUT', 'UP', 'DOWN'].flatMap(d => ['L', 'R'].map(h => `PARRY-${d}-${h}`));
function stage9(k) {
  const p = `FT-S9-${k}-`, o = OTHER[k[0]];
  return [['FEET', ['STEPBACK']], ['BLOCK', ['PALM-' + o, 'BENT-' + o]], ['PARRY', PARRY], ['ELBOW', ['ELBOW-H', 'ELBOW-B']], ['PULL', ['PULL']], ['VAR', ['VAR']]]
    .map(([c, s]) => ({ id: `S9-${k}-${c}`, title: `${ST[k]} — ${KIND[c]}`, straight: k, workouts: s.map(x => p + x) }));
}
function stage10(k) {
  const p = `FT-S10-ANS-${k}-`;
  return [['FEET', ['STEPBACK']], ['BLOCK', ['PALM', 'BENT']], ['PARRY', ['PARRY-HEAD', 'PARRY-BODY', 'PARRY-OUT', 'PARRY-UP']], ['ELBOW', ['ELBOW']],
    ['PULL', ['PULL', 'PULLSTEP']], ['SLIP', ['SLIP']], ['VAR', ['BASE']]]
    // V67: defence first, then the answer
    .map(([c, s]) => ({ id: `S10-${k}-${c}`, title: `${KIND[c][0].toUpperCase()}${KIND[c].slice(1)} — ${ANS[k][0].toLowerCase()}${ANS[k].slice(1)}`, answer: k, workouts: s.map(x => p + x) }));
}
const number = (no, list) => list.map((s, i) => ({ ...s, title: `${no}.${i + 1} ${s.title}` }));
export const V63_SUBSTAGES = {
  'FAR-STRAIGHT-ATTDEF': number(9, [...['LH', 'RH', 'LB', 'RB'].flatMap(stage9),
    { id: 'S9-MIXED', title: 'Комбинированные программы', workouts: [
      'FT-S9-STEPBACK-HEAD', 'FT-S9-STEPBACK-BODY', 'FT-S9-STEPBACK-MIXED', 'PRG-FAR-STRAIGHT-1', 'FT-S9-PALM-BODY', 'FT-S9-PALM-MIXED',
      'FT-S9-BENT-HEAD', 'FT-S9-BODY-BENT-ARM', 'FT-S9-BENT-MIXED', 'FT-S9-PULLBACK', 'FT-S9-PULLBACK-BODY', 'FT-S9-PULLBACK-MIXED',
      'FT-S9-ELBOW-HEAD', 'FT-S9-ELBOW-BODY', 'FT-S9-DOUBLE-ELBOW', 'FT-S9-PARRY', 'FT-S9-PARRY-BODY'] },
    { id: 'S9-DOUBLE', title: 'Два прямых одной рукой — вариативная защита', workouts: [
      'FT-S9-VAR2-LEFT-HEAD-BODY', 'FT-S9-VAR2-LEFT-BODY-HEAD', 'FT-S9-VAR2-RIGHT-HEAD-BODY', 'FT-S9-VAR2-RIGHT-BODY-HEAD'] }]),
  'FAR-STRAIGHT-COUNTER': number(10, [...['LH', 'RH', 'LB', 'RB'].flatMap(stage10),
    { id: 'S10-MEET', title: 'Встречные', workouts: ['FT-S10-MEET-SLIPR-LB', 'FT-S10-MEET-SLIPR-LH', 'FT-S10-MEET-SLIPR-LHOOK',
      'FT-S10-MEET-SLIPL-RB', 'FT-S10-MEET-SLIPL-RH', 'FT-S10-MEET-SLIPL-RHOOK'] },
    { id: 'S10-MIXED', title: 'Комбинированные программы', workouts: [
      'FT-S10-ANS-STEPBACK', 'FT-S10-ANS-PULL', 'FT-S10-ANS-PULLSTEP', 'FT-S10-ANS-PALM', 'FT-S10-ANS-BENT', 'FT-S10-ANS-ELBOW',
      'FT-S10-ANS-PARRY', 'FT-S10-ANS-PARRY-BACK', 'FT-S10-ANS-PARRY-BREAK', 'FT-S10-ANS-PARRY-SIDE',
      'FT-S10-ANS-BODYPARRY-SPOT', 'FT-S10-ANS-BODYPARRY-BACK', 'FT-S10-ANS-BODYPARRY-BREAK', 'FT-S10-ANS-BODYPARRY-SIDE',
      'FT-S10-V61-PARRY-UP-SPOT', 'FT-S10-V61-PARRY-UP-BACK', 'FT-S10-V61-PARRY-UP-SIDE',
      'FT-S10-V61-PARRY-OUT-SPOT', 'FT-S10-V61-PARRY-OUT-BACK', 'FT-S10-V61-PARRY-OUT-SIDE',
      'FT-S10-V61-SLIP-OUT-SPOT', 'FT-S10-V61-SLIP-OUT-BACK', 'FT-S10-V61-SLIP-OUT-RETREAT', 'FT-S10-V61-SLIP-OUT-STEPRET',
      'FT-S10-V61-SLIP-OUT-SIDE', 'FT-S10-V61-SLIP-OUT-DIAG', 'FT-S10-ANS-MIXED', 'FT-S10-ANS-MIXED-BODYPARRY'] }]),
  'FAR-PARRY': [
    { id: 'S11-1', title: '11.1 Прямой левой партнёра: уклон вправо, вход на ближнюю', workouts: ['FT-S11-SLIP-RIGHT-CLOSE'] },
    { id: 'S11-2', title: '11.2 Прямой правой партнёра: уклон влево, вход на ближнюю', workouts: ['FT-S11-SLIP-LEFT-CLOSE'] },
    // V68/V69 owner TASKs 2026-10-29: own substages; the reserved S11-3/S11-4 keep their ids and order, numbers shift
    { id: 'S11-COUNTER', title: '11.3 Вход на ближнюю со встречным ударом', workouts: ['FT-S11-COUNTER-SLIPR-LH', 'FT-S11-COUNTER-SLIPR-LB',
      'FT-S11-COUNTER-SLIPL-RH', 'FT-S11-COUNTER-SLIPL-RB'] },
    { id: 'S11-PARRY', title: '11.4 Вход на ближнюю через отбив внутрь', workouts: ['FT-S11-PARRY-IN-RIGHT-CLOSE', 'FT-S11-PARRY-IN-LEFT-CLOSE'] },
    { id: 'S11-3', title: '11.5 Комбинированные программы', workouts: [] },
    { id: 'S11-4', title: '11.6 Другие входы на ближнюю', workouts: [] },
  ],
};
