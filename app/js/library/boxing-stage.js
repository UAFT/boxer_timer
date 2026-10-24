import { clonePreset } from '../state/presets.js';

// Approved boxing workouts carry every round with its own work and rest; they become one
// ordinary program stage with per-round overrides, so nothing is flattened or rounded.
const seconds = (value, min) => Number.isInteger(value) && value >= min && value <= 3600;
// Shadow and mirror sources number their own rounds ("Раунд 2. …"); the timer already shows
// the number, so exactly that prefix is dropped and nothing else of the source text.
function withoutOwnNumber(name, index) {
  const prefix = 'Раунд ' + (index + 1) + '. ';
  return name.startsWith(prefix) ? name.slice(prefix.length) : name;
}
// Two-phase sources list phase 1 (no rest after it) and phase 2 (then the rest) as
// alternating rows. They run on the existing two-phase engine, which counts real rounds.
function isTwoPhase(workout) {
  const rounds = workout.rounds;
  return workout.sourceMode === 'two_phase' && rounds.length % 2 === 0 && rounds.every((r, i) => i % 2 === 1 || r.restSec === 0);
}

export function boxingStage(workout) {
  const rounds = workout.rounds;
  if (!Array.isArray(rounds) || !rounds.length || rounds.some(r => !seconds(r.workSec, 1) || !seconds(r.restSec, 0))) return null;
  const title = 'Бокс — ' + workout.name;
  if (isTwoPhase(workout)) {
    const count = rounds.length / 2;
    if (count > 200) return null;
    const one = i => rounds[2 * i], two = i => rounds[2 * i + 1], each = fn => Array.from({ length: count }, (_, i) => fn(i));
    return {
      presetId: 'classic1', title,
      settings: { ...clonePreset('classic1'), intervalMode: 'two_phase', ladderEnabled: false, blockEnabled: false,
        rounds: count, workSec: one(0).workSec, phaseTwoSec: two(0).workSec, restSec: two(0).restSec,
        workStepSec: 0, restStepSec: 0, phaseTwoStepSec: 0 },
      phaseOneOverrides: each(i => one(i).name),
      phaseTwoOverrides: each(i => two(i).name),
      roundDescriptions: each(i => [...new Set([one(i).description, two(i).description].filter(Boolean))].join(' → ')),
      roundTimingOverrides: each(i => ({ workSec: one(i).workSec, phaseTwoSec: two(i).workSec, restSec: i === count - 1 ? 0 : two(i).restSec })),
      restAfterSec: 60
    };
  }
  if (rounds.length > 200) return null;
  return {
    presetId: 'classic2', title,
    settings: { ...clonePreset('classic2'), intervalMode: 'standard', ladderEnabled: false, blockEnabled: false,
      rounds: rounds.length, workSec: rounds[0].workSec, restSec: rounds[0].restSec, workStepSec: 0, restStepSec: 0 },
    roundNames: rounds.map((r, i) => withoutOwnNumber(r.name, i)),
    roundDescriptions: rounds.map(r => [r.stance, r.description].filter(Boolean).join(' · ')),
    roundTimingOverrides: rounds.map((r, i) => ({ workSec: r.workSec, restSec: i === rounds.length - 1 ? 0 : r.restSec })),
    restAfterSec: 60
  };
}
