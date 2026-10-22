import { STORAGE_KEY } from '../core/constants.js';
import { clampInt } from '../core/time.js';
import { clonePreset } from './presets.js';

const WARNING_VALUES = new Set([0, 4, 10]);

function normalizeMetronomeMode(rawMode, fallbackMode) {
  return rawMode === 'subdivided' ? 'subdivided' : (fallbackMode === 'subdivided' ? 'subdivided' : 'direct');
}

function normalizeVariant(rawValue, fallbackValue = 'v2') {
  return rawValue === 'v1' ? 'v1' : (rawValue === 'v2' ? 'v2' : (fallbackValue === 'v1' ? 'v1' : 'v2'));
}

function normalizeIntervalMode(rawMode, fallbackMode = 'standard') {
  return ['standard','ladder','two_phase'].includes(rawMode) ? rawMode : (['standard','ladder','two_phase'].includes(fallbackMode)?fallbackMode:'standard');
}

function normalizeStepSeconds(rawValue, fallbackValue = 0) {
  const value = clampInt(rawValue, -600, 600, fallbackValue);
  return Math.round(value / 5) * 5;
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
    phaseTwoSec: clampInt(raw?.phaseTwoSec, 1, 3600, fallback.phaseTwoSec ?? 40),
    phaseOneName: String(raw?.phaseOneName ?? fallback.phaseOneName ?? '').slice(0,100),
    phaseTwoName: String(raw?.phaseTwoName ?? fallback.phaseTwoName ?? '').slice(0,100),
    countdownEnabled: true,
    warningSeconds: normalizeWarningSeconds(raw?.warningSeconds, fallback.warningSeconds ?? 10),
    audioEnabled: raw?.audioEnabled !== false,
    metronomeEnabled: Boolean(raw?.metronomeEnabled),
    metronomeBpm: clampInt(raw?.metronomeBpm, 0, 300, fallback.metronomeBpm ?? 20),
    metronomeMode: normalizeMetronomeMode(raw?.metronomeMode, fallback.metronomeMode),
    intervalMode: normalizeIntervalMode(raw?.intervalMode, fallback.intervalMode),
    ladderEnabled: Boolean(raw?.ladderEnabled) && normalizeIntervalMode(raw?.intervalMode, fallback.intervalMode) === 'two_phase',
    phaseTwoStepSec: normalizeStepSeconds(raw?.phaseTwoStepSec, fallback.phaseTwoStepSec ?? 0),
    blockEnabled: Boolean(raw?.blockEnabled),
    blockCount: clampInt(raw?.blockCount, 1, 99, fallback.blockCount ?? 1),
    blockRestSec: Math.round(clampInt(raw?.blockRestSec, 0, 3600, fallback.blockRestSec ?? 90) / 5) * 5,
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

const PROFILE_KEY = 'andar.fight.timer.profiles.v1';
const PROFILE_IDS = ['classic3', 'classic2', 'classic1', 'tabata2020x24'];

export function loadProfileState() {
  let saved = null;
  try { saved = JSON.parse(window.localStorage.getItem(PROFILE_KEY) || 'null'); } catch {}
  // A fresh/partially migrated installation must have a profile for EVERY tab.
  // A long press adds its program stage without selecting the tab first.
  const profiles = Object.fromEntries(PROFILE_IDS.map(id => [id, clonePreset(id)]));
  if (saved?.profiles && typeof saved.profiles === 'object' && !Array.isArray(saved.profiles)) {
    for (const id of PROFILE_IDS) {
      if (saved.profiles[id] && typeof saved.profiles[id] === 'object' && !Array.isArray(saved.profiles[id])) {
        profiles[id] = saved.profiles[id];
      }
    }
    return { activeId: PROFILE_IDS.includes(saved.activeId) ? saved.activeId : 'classic3', profiles };
  }
  let legacy = null;
  try { legacy = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null'); } catch {}
  if (legacy && typeof legacy === 'object' && !Array.isArray(legacy)) profiles.classic3 = legacy;
  return { activeId: 'classic3', profiles };
}

export function saveProfileState(activeId, profiles) {
  try { window.localStorage.setItem(PROFILE_KEY, JSON.stringify({ activeId, profiles })); } catch {}
}
