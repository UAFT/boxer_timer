// Navigation overlay for the methodology tab: V63 (2026-10-28), regrouped by the owner canon in V64 (2026-10-28). Data only: the book tree
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

// Stage 9: the trainee's straight is fixed in a program (9.1–9.4), mixed programs stay whole (9.5).
// Stage 10: the trainee's answering straight is fixed in a program (10.1–10.4), meeting punches (10.5), mixed programs whole (10.6).
const answers = (hz) => ['BASE', 'PARRY-HEAD', 'PARRY-BODY', 'PARRY-UP', 'PARRY-OUT', 'SLIP'].map(s => `FT-S10-ANS-${hz}-${s}`);
export const V63_SUBSTAGES = {
  'FAR-STRAIGHT-ATTDEF': [
    { id: 'S9-1', title: '9.1 Левый прямой в голову', straight: 'LH', workouts: ['FT-S9-VAR-LEFT-HEAD', 'FT-S9-VARX-LEFT-HEAD'] },
    { id: 'S9-2', title: '9.2 Правый прямой в голову', straight: 'RH', workouts: ['FT-S9-VAR-RIGHT-HEAD', 'FT-S9-VARX-RIGHT-HEAD'] },
    { id: 'S9-3', title: '9.3 Левый прямой в корпус', straight: 'LB', workouts: ['FT-S9-VAR-LEFT-BODY', 'FT-S9-VARX-LEFT-BODY'] },
    { id: 'S9-4', title: '9.4 Правый прямой в корпус', straight: 'RB', workouts: ['FT-S9-VAR-RIGHT-BODY', 'FT-S9-VARX-RIGHT-BODY'] },
    { id: 'S9-5', title: '9.5 Комбинированные программы', workouts: [
      'FT-S9-STEPBACK-HEAD', 'FT-S9-STEPBACK-BODY', 'FT-S9-STEPBACK-MIXED', 'PRG-FAR-STRAIGHT-1', 'FT-S9-PALM-BODY', 'FT-S9-PALM-MIXED',
      'FT-S9-BENT-HEAD', 'FT-S9-BODY-BENT-ARM', 'FT-S9-BENT-MIXED', 'FT-S9-PULLBACK', 'FT-S9-PULLBACK-BODY', 'FT-S9-PULLBACK-MIXED',
      'FT-S9-ELBOW-HEAD', 'FT-S9-ELBOW-BODY', 'FT-S9-DOUBLE-ELBOW', 'FT-S9-VAR2-LEFT-HEAD-BODY', 'FT-S9-VAR2-LEFT-BODY-HEAD',
      'FT-S9-VAR2-RIGHT-HEAD-BODY', 'FT-S9-VAR2-RIGHT-BODY-HEAD', 'FT-S9-PARRY', 'FT-S9-PARRY-BODY'] },
  ],
  'FAR-STRAIGHT-COUNTER': [
    { id: 'S10-1', title: '10.1 Все защиты + ответный левый прямой в голову', answer: 'LH', workouts: answers('LH') },
    { id: 'S10-2', title: '10.2 Все защиты + ответный правый прямой в голову', answer: 'RH', workouts: answers('RH') },
    { id: 'S10-3', title: '10.3 Все защиты + ответный левый прямой в корпус', answer: 'LB', workouts: answers('LB') },
    { id: 'S10-4', title: '10.4 Все защиты + ответный правый прямой в корпус', answer: 'RB', workouts: answers('RB') },
    { id: 'S10-5', title: '10.5 Защита со встречной атакой', workouts: [] },
    { id: 'S10-6', title: '10.6 Комбинированные программы', workouts: [
      'FT-S10-ANS-STEPBACK', 'FT-S10-ANS-PULL', 'FT-S10-ANS-PULLSTEP', 'FT-S10-ANS-PALM', 'FT-S10-ANS-BENT', 'FT-S10-ANS-ELBOW',
      'FT-S10-ANS-PARRY', 'FT-S10-ANS-PARRY-BACK', 'FT-S10-ANS-PARRY-BREAK', 'FT-S10-ANS-PARRY-SIDE',
      'FT-S10-ANS-BODYPARRY-SPOT', 'FT-S10-ANS-BODYPARRY-BACK', 'FT-S10-ANS-BODYPARRY-BREAK', 'FT-S10-ANS-BODYPARRY-SIDE',
      'FT-S10-V61-PARRY-UP-SPOT', 'FT-S10-V61-PARRY-UP-BACK', 'FT-S10-V61-PARRY-UP-SIDE',
      'FT-S10-V61-PARRY-OUT-SPOT', 'FT-S10-V61-PARRY-OUT-BACK', 'FT-S10-V61-PARRY-OUT-SIDE',
      'FT-S10-V61-SLIP-OUT-SPOT', 'FT-S10-V61-SLIP-OUT-BACK', 'FT-S10-V61-SLIP-OUT-RETREAT', 'FT-S10-V61-SLIP-OUT-STEPRET',
      'FT-S10-V61-SLIP-OUT-SIDE', 'FT-S10-V61-SLIP-OUT-DIAG', 'FT-S10-ANS-MIXED', 'FT-S10-ANS-MIXED-BODYPARRY'] },
  ],
  'FAR-PARRY': [
    { id: 'S11-1', title: '11.1 Прямой левой партнёра: уклон вправо, вход на ближнюю', workouts: ['FT-S11-SLIP-RIGHT-CLOSE'] },
    { id: 'S11-2', title: '11.2 Прямой правой партнёра: уклон влево, вход на ближнюю', workouts: ['FT-S11-SLIP-LEFT-CLOSE'] },
    { id: 'S11-3', title: '11.3 Комбинированные программы', workouts: [] },
    { id: 'S11-4', title: '11.4 Другие входы на ближнюю', workouts: [] },
  ],
};
