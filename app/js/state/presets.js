export const PRESETS = {
  classic3: {
    id: 'classic3',
    label: "3′",
    rounds: 12,
    workSec: 180,
    restSec: 60,
    countdownEnabled: true,
    warning10Enabled: true,
    audioEnabled: true
  },
  classic2: {
    id: 'classic2',
    label: "2′",
    rounds: 12,
    workSec: 120,
    restSec: 60,
    countdownEnabled: true,
    warning10Enabled: true,
    audioEnabled: true
  },
  classic1: {
    id: 'classic1',
    label: "1′",
    rounds: 12,
    workSec: 60,
    restSec: 30,
    countdownEnabled: true,
    warning10Enabled: false,
    audioEnabled: true
  },
  tabata2020x24: {
    id: 'tabata2020x24',
    label: "⚡",
    rounds: 24,
    workSec: 20,
    restSec: 20,
    countdownEnabled: true,
    warning10Enabled: false,
    audioEnabled: true
  }
};

export function clonePreset(presetId) {
  const preset = PRESETS[presetId] ?? PRESETS.classic3;
  return structuredClone ? structuredClone(preset) : JSON.parse(JSON.stringify(preset));
}
