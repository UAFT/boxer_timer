// Navigation overlay for the methodology tab: V63 (2026-10-28), regrouped by the owner canon in V64 (2026-10-28) and V65 (2026-10-29). Data only: the book tree
// (methodology-v42-data.js) and the trainings (methodology-v42-rounds.js) are not changed here. A stage listed here shows these substages,
// each training exactly once, then one «Книжные карточки» substage with all its book program cards read-only. Removing the import in
// methodology-v42-view.js restores the V58–V61 layout.
export const V63_STAGE_TITLES = {
  'FAR-PARRY': 'Защитные действия с переходом на ближнюю дистанцию',
};

// Literal hand and target of a single straight that opens the round (stance does not mirror it). Double straights and the mixed parry
// round have none.
const OWN = /[Пп]рям[а-яё]* (левой|правой)[^.;,]*?в (голову|корпус|туловище)/;
export function openingStraight(round) {
  if (/Два прям/.test(round.name)) return null;
  const m = OWN.exec(round.name) || OWN.exec(round.description);
  return m ? (m[1] === 'левой' ? 'L' : 'R') + (m[2] === 'голову' ? 'H' : 'B') : null;
}

// V65 (2026-10-29), boxing school: a substage = one fixed straight + one kind of defence, cards = technical programs of that kind, in
// school order (legs → blocks → parries → double elbow → pull-backs → slips → variative); combined programs whole at the end of a stage.
const ST = { LH: 'Левый прямой в голову', RH: 'Правый прямой в голову', LB: 'Левый прямой в корпус', RB: 'Правый прямой в корпус' };
const ANS = { LH: 'Ответный левый прямой в голову', RH: 'Ответный правый прямой в голову', LB: 'Ответный левый прямой в корпус', RB: 'Ответный правый прямой в корпус' };
const OTHER = { L: 'R', R: 'L' };
const KIND = { FEET: 'защита ногами', BLOCK: 'подставки', PARRY: 'отбивы', ELBOW: 'двойная локтевая защита', PULL: 'оттяжки', SLIP: 'уклоны', VAR: 'вариативная защита' };
const VAR9 = { LH: ['FT-S9-VAR-LEFT-HEAD', 'FT-S9-VARX-LEFT-HEAD'], RH: ['FT-S9-VAR-RIGHT-HEAD', 'FT-S9-VARX-RIGHT-HEAD'],
  LB: ['FT-S9-VAR-LEFT-BODY', 'FT-S9-VARX-LEFT-BODY'], RB: ['FT-S9-VAR-RIGHT-BODY', 'FT-S9-VARX-RIGHT-BODY'] };
function stage9(k) {
  const p = `FT-S9-${k}-`, o = OTHER[k[0]], elbow = k[1] === 'H' ? [p + 'ELBOW-H', p + 'ELBOW-B'] : [p + 'ELBOW-B'];
  return [['FEET', [p + 'STEPBACK']], ['BLOCK', [p + 'PALM-' + o, p + 'BENT-' + o]], ['PARRY', [p + 'PARRY-IN-' + o]], ['ELBOW', elbow],
    ['PULL', [p + 'PULL', p + 'PULLSTEP']], ['VAR', VAR9[k]]].map(([c, workouts]) => ({ id: `S9-${k}-${c}`, title: `${ST[k]} — ${KIND[c]}`, straight: k, workouts }));
}
function stage10(k) {
  const p = `FT-S10-ANS-${k}-`;
  return [['FEET', ['STEPBACK']], ['BLOCK', ['PALM', 'BENT']], ['PARRY', ['PARRY-HEAD', 'PARRY-BODY', 'PARRY-OUT', 'PARRY-UP']], ['ELBOW', ['ELBOW']],
    ['PULL', ['PULL', 'PULLSTEP']], ['SLIP', ['SLIP']], ['VAR', ['BASE']]]
    .map(([c, s]) => ({ id: `S10-${k}-${c}`, title: `${ANS[k]} — ${KIND[c]}`, answer: k, workouts: s.map(x => p + x) }));
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
    { id: 'S10-MEET', title: 'Защита со встречной атакой', workouts: [] },
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
    { id: 'S11-3', title: '11.3 Комбинированные программы', workouts: [] },
    { id: 'S11-4', title: '11.4 Другие входы на ближнюю', workouts: [] },
  ],
};
