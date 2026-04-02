import { clampInt } from "./time.js";

function normalizeMode(mode) {
  return mode === "ladder" ? "ladder" : "standard";
}

export function workSecForRound(config, roundIndex) {
  const base = clampInt(config?.workSec, 1, 3600, 180);
  if (normalizeMode(config?.intervalMode) !== "ladder") return base;
  const step = clampInt(config?.workStepSec, -3600, 3600, 0);
  const value = base + Math.max(0, Number(roundIndex || 1) - 1) * step;
  return Math.min(3600, Math.max(1, value));
}

export function restSecAfterRound(config, roundIndex) {
  const base = clampInt(config?.restSec, 0, 3600, 60);
  if (normalizeMode(config?.intervalMode) !== "ladder") return base;
  const step = clampInt(config?.restStepSec, -3600, 3600, 0);
  const value = base + Math.max(0, Number(roundIndex || 1) - 1) * step;
  return Math.min(3600, Math.max(0, value));
}

export function totalDurationSecForConfig(config) {
  const rounds = clampInt(config?.rounds, 1, 99, 1);
  let total = 0;
  for (let round = 1; round <= rounds; round += 1) {
    total += workSecForRound(config, round);
    if (round < rounds) total += restSecAfterRound(config, round);
  }
  return total;
}

export function remainingTotalSecForState(state) {
  const config = state?.config || {};
  const rounds = clampInt(config?.rounds, 1, 99, 1);
  const roundIndex = Math.max(1, Number(state?.roundIndex || 1));

  if (state?.phase === 'idle' || state?.phase === 'countdown') return totalDurationSecForConfig(config);
  if (state?.phase === 'finished') return 0;

  let remaining = Math.max(0, Number(state?.remainingSec || 0));

  if (state?.phase === 'work') {
    if (roundIndex < rounds) remaining += restSecAfterRound(config, roundIndex);
    for (let round = roundIndex + 1; round <= rounds; round += 1) {
      remaining += workSecForRound(config, round);
      if (round < rounds) remaining += restSecAfterRound(config, round);
    }
    return remaining;
  }

  if (state?.phase === 'rest') {
    for (let round = roundIndex + 1; round <= rounds; round += 1) {
      remaining += workSecForRound(config, round);
      if (round < rounds) remaining += restSecAfterRound(config, round);
    }
    return remaining;
  }

  return totalDurationSecForConfig(config);
}

export function displayDurationsForState(state) {
  const config = state?.config || {};
  const rounds = clampInt(config?.rounds, 1, 99, 1);
  const currentRound = Math.max(1, Math.min(rounds, Number(state?.roundIndex || 1)));

  if (state?.phase === 'rest') {
    return {
      workSec: workSecForRound(config, Math.min(rounds, currentRound + 1)),
      restSec: restSecAfterRound(config, currentRound)
    };
  }

  return {
    workSec: workSecForRound(config, currentRound),
    restSec: restSecAfterRound(config, currentRound)
  };
}
