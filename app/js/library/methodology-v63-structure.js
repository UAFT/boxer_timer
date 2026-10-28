// V63 navigation overlay for the methodology tab (owner-approved 2026-10-28). Data only: the book tree (methodology-v42-data.js) and the
// trainings (methodology-v42-rounds.js) are not changed. A stage listed here shows these unnumbered substages, each training exactly once,
// then all of its book program cards read-only. Removing the import in methodology-v42-view.js restores the V58–V61 layout.
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

const BODY_PARRY_NOTE = 'Отбив внутрь от прямых в корпус — расширение владельца. В книге (Романенко, ROM-P1-OT05/OT06) от ударов в туловище — отбив кнаружи.';
const COMBINED_NOTE = 'Программы, где чередуются руки или цели, и программы из двух прямых подряд. Каждая программа целая, раунды не разделены.';

export const V63_SUBSTAGES = {
  'FAR-STRAIGHT-ATTDEF': [
    { id: 'S9-1', title: '9.1 Прямой левой в голову', straight: 'LH', workouts: ['FT-S9-VAR-LEFT-HEAD'] },
    { id: 'S9-2', title: '9.2 Прямой правой в голову', straight: 'RH', workouts: ['FT-S9-VAR-RIGHT-HEAD'] },
    { id: 'S9-3', title: '9.3 Прямой левой в корпус', straight: 'LB', workouts: ['FT-S9-VAR-LEFT-BODY'] },
    { id: 'S9-4', title: '9.4 Прямой правой в корпус', straight: 'RB', workouts: ['FT-S9-VAR-RIGHT-BODY'] },
    { id: 'S9-COMBINED', title: 'Комбинированная работа', note: COMBINED_NOTE, workouts: [
      'FT-S9-STEPBACK-HEAD', 'FT-S9-STEPBACK-BODY', 'FT-S9-STEPBACK-MIXED', 'PRG-FAR-STRAIGHT-1', 'FT-S9-PALM-BODY', 'FT-S9-PALM-MIXED',
      'FT-S9-BENT-HEAD', 'FT-S9-BODY-BENT-ARM', 'FT-S9-BENT-MIXED', 'FT-S9-PULLBACK', 'FT-S9-PULLBACK-BODY', 'FT-S9-PULLBACK-MIXED',
      'FT-S9-ELBOW-HEAD', 'FT-S9-ELBOW-BODY', 'FT-S9-DOUBLE-ELBOW', 'FT-S9-VAR2-LEFT-HEAD-BODY', 'FT-S9-VAR2-LEFT-BODY-HEAD',
      'FT-S9-VAR2-RIGHT-HEAD-BODY', 'FT-S9-VAR2-RIGHT-BODY-HEAD', 'FT-S9-PARRY', 'FT-S9-PARRY-BODY'] },
  ],
  'FAR-STRAIGHT-COUNTER': [
    { id: 'S10-STEPBACK', title: 'Ответные после защиты шагом назад', workouts: ['FT-S10-ANS-STEPBACK'] },
    { id: 'S10-PULL', title: 'Ответные после оттяжки', workouts: ['FT-S10-ANS-PULL', 'FT-S10-ANS-PULLSTEP'] },
    { id: 'S10-BLOCK', title: 'Ответные после подставок', workouts: ['FT-S10-ANS-PALM', 'FT-S10-ANS-BENT'] },
    { id: 'S10-ELBOW', title: 'Ответные после двойной локтевой защиты', workouts: ['FT-S10-ANS-ELBOW'] },
    { id: 'S10-PARRY-SPOT', title: 'Ответные после отбивов на месте', note: BODY_PARRY_NOTE, workouts: [
      'FT-S10-ANS-PARRY', 'FT-S10-ANS-BODYPARRY-SPOT', 'FT-S10-V61-PARRY-UP-SPOT', 'FT-S10-V61-PARRY-OUT-SPOT'] },
    { id: 'S10-PARRY-BACK', title: 'Ответные после отбивов с шагом назад', note: BODY_PARRY_NOTE, workouts: [
      'FT-S10-ANS-PARRY-BACK', 'FT-S10-ANS-PARRY-BREAK', 'FT-S10-ANS-BODYPARRY-BACK', 'FT-S10-ANS-BODYPARRY-BREAK',
      'FT-S10-V61-PARRY-UP-BACK', 'FT-S10-V61-PARRY-OUT-BACK'] },
    { id: 'S10-PARRY-SIDE', title: 'Ответные после отбивов со смещением в сторону (смена угла)', note: BODY_PARRY_NOTE, workouts: [
      'FT-S10-ANS-PARRY-SIDE', 'FT-S10-ANS-BODYPARRY-SIDE', 'FT-S10-V61-PARRY-UP-SIDE', 'FT-S10-V61-PARRY-OUT-SIDE'] },
    { id: 'S10-SLIP', title: 'Ответные после уклонов', workouts: [
      'FT-S10-V61-SLIP-OUT-SPOT', 'FT-S10-V61-SLIP-OUT-BACK', 'FT-S10-V61-SLIP-OUT-RETREAT', 'FT-S10-V61-SLIP-OUT-STEPRET',
      'FT-S10-V61-SLIP-OUT-SIDE', 'FT-S10-V61-SLIP-OUT-DIAG'] },
    { id: 'S10-COMBINED', title: 'Комбинированная работа', note: 'Ответные после разных защит в одной программе. Каждая программа целая.',
      workouts: ['FT-S10-ANS-MIXED', 'FT-S10-ANS-MIXED-BODYPARRY'] },
    { id: 'S10-MEETING', title: 'Встречные удары', note: 'Программ пока нет: они готовятся отдельно. Книжные упражнения — в карточках ниже.', workouts: [] },
  ],
};
