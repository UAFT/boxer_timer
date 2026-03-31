import { STORAGE_KEY } from '../core/constants.js';
import { clampInt } from '../core/time.js';

export function normalizeSettings(raw, fallback) {
  return {
    rounds: clampInt(raw?.rounds, 1, 99, fallback.rounds),
    workSec: clampInt(raw?.workSec, 1, 3600, fallback.workSec),
    restSec: clampInt(raw?.restSec, 0, 3600, fallback.restSec),
    countdownEnabled: Boolean(raw?.countdownEnabled),
    warning10Enabled: Boolean(raw?.warning10Enabled),
    audioEnabled: raw?.audioEnabled !== false
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
