import { STORAGE_KEY } from '../core/constants.js';
import { clampInt } from '../core/time.js';

const WARNING_VALUES = new Set([0, 4, 10]);

function normalizeMetronomeMode(rawMode, fallbackMode) {
  return rawMode === 'subdivided' ? 'subdivided' : (fallbackMode === 'subdivided' ? 'subdivided' : 'direct');
}

function normalizeVariant(rawValue, fallbackValue = 'v2') {
  return rawValue === 'v1' ? 'v1' : (rawValue === 'v2' ? 'v2' : (fallbackValue === 'v1' ? 'v1' : 'v2'));
}

function normalizeIntervalMode(rawMode, fallbackMode = 'standard') {
  return rawMode === 'ladder' ? 'ladder' : (fallbackMode === 'ladder' ? 'ladder' : 'standard');
}

function normalizeStepSeconds(rawValue, fallbackValue = 0) {
  return clampInt(rawValue, -600, 600, fallbackValue);
}

function normalizeWarningSeconds(rawValue, fallbackValue = 4) {
  const value = clampInt(rawValue, 0, 10, fallbackValue);
  return WARNING_VALUES.has(value) ? value : fallbackValue;
}

export function normalizeSettings(raw, fallback) {
  return {
    rounds: clampInt(raw?.rounds, 1, 99, fallback.rounds),
    workSec: clampInt(raw?.workSec, 1, 3600, fallback.workSec),
    restSec: clampInt(raw?.restSec, 0, 3600, fallback.restSec),
    countdownEnabled: true,
    warningSeconds: normalizeWarningSeconds(raw?.warningSeconds, fallback.warningSeconds ?? 10),
    audioEnabled: raw?.audioEnabled !== false,
    metronomeEnabled: Boolean(raw?.metronomeEnabled),
    metronomeBpm: clampInt(raw?.metronomeBpm, 0, 300, fallback.metronomeBpm ?? 20),
    metronomeMode: normalizeMetronomeMode(raw?.metronomeMode, fallback.metronomeMode),
    intervalMode: normalizeIntervalMode(raw?.intervalMode, fallback.intervalMode),
    workStepSec: normalizeStepSeconds(raw?.workStepSec, fallback.workStepSec ?? 0),
    restStepSec: normalizeStepSeconds(raw?.restStepSec, fallback.restStepSec ?? 0),
    workStartCueVariant: normalizeVariant(raw?.workStartCueVariant, fallback.workStartCueVariant),
    restStartCueVariant: normalizeVariant(raw?.restStartCueVariant, fallback.restStartCueVariant),
    workoutEndCueVariant: normalizeVariant(raw?.workoutEndCueVariant, fallback.workoutEndCueVariant)
  };
}

export function loadSettings(fallback) {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    return normalizeSettings(JSON.parse(raw), fallback);
  } catch {
    return fallback;
  }
}

export function saveSettings(settings) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
