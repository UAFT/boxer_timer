export const PRESETS = {
  classic3: {
    id: 'classic3',
    label: "3′",
    rounds: 5,
    workSec: 180,
    restSec: 60,
    countdownEnabled: true,
    warningSeconds: 4,
    audioEnabled: true,
    metronomeEnabled: false,
    metronomeBpm: 20,
    metronomeMode: 'direct',
    intervalMode: 'standard',
    workStepSec: 0,
    restStepSec: 0,
    workStartCueVariant: 'v2',
    restStartCueVariant: 'v2',
    workoutEndCueVariant: 'v2'
  },
  classic2: {
    id: 'classic2',
    label: "2′",
    rounds: 5,
    workSec: 120,
    restSec: 60,
    countdownEnabled: true,
    warningSeconds: 4,
    audioEnabled: true,
    metronomeEnabled: false,
    metronomeBpm: 20,
    metronomeMode: 'direct',
    intervalMode: 'standard',
    workStepSec: 0,
    restStepSec: 0,
    workStartCueVariant: 'v2',
    restStartCueVariant: 'v2',
    workoutEndCueVariant: 'v2'
  },
  classic1: {
    id: 'classic1',
    label: "1′",
    rounds: 5,
    workSec: 60,
    restSec: 60,
    countdownEnabled: true,
    warningSeconds: 4,
    audioEnabled: true,
    metronomeEnabled: false,
    metronomeBpm: 20,
    metronomeMode: 'direct',
    intervalMode: 'standard',
    workStepSec: 0,
    restStepSec: 0,
    workStartCueVariant: 'v2',
    restStartCueVariant: 'v2',
    workoutEndCueVariant: 'v2'
  },
  tabata2020x24: {
    id: 'tabata2020x24',
    label: '⚡',
    rounds: 24,
    workSec: 20,
    restSec: 20,
    countdownEnabled: true,
    warningSeconds: 4,
    audioEnabled: true,
    metronomeEnabled: false,
    metronomeBpm: 20,
    metronomeMode: 'direct',
    intervalMode: 'standard',
    workStepSec: 0,
    restStepSec: 0,
    workStartCueVariant: 'v2',
    restStartCueVariant: 'v2',
    workoutEndCueVariant: 'v2'
  }
};

export function clonePreset(presetId) {
  const preset = PRESETS[presetId] ?? PRESETS.classic3;
  return structuredClone ? structuredClone(preset) : JSON.parse(JSON.stringify(preset));
}
