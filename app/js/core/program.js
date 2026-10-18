import { totalRoundsForConfig, workSecForRound, restSecAfterRound } from './schedule.js';
export const PRESET_NAMES = { classic3: '3′', classic2: '2′', classic1: '1′', tabata2020x24: '⚡' };
export const PROGRAM_KEY = 'andar.fight.timer.program.v1';
export function normalizeProgram(raw) {
  const entries = Array.isArray(raw) ? raw : [];
  return entries.slice(0, 24).filter(x => PRESET_NAMES[x?.presetId]).map(x => ({
    presetId: x.presetId,
    restAfterSec: Math.max(0, Math.min(3600, Math.round((Number(x.restAfterSec) || 0) / 5) * 5))
  }));
}
export function compileProgram(entries, profiles) {
  const stages = normalizeProgram(entries);
  const programRounds = [];
  stages.forEach((stage, stageIndex) => {
    const config = structuredClone(profiles[stage.presetId]);
    const total = totalRoundsForConfig(config);
    for (let i=1;i<=total;i++) {
      programRounds.push({
        workSec: workSecForRound(config,i),
        restSec: i<total ? restSecAfterRound(config,i) : (stageIndex<stages.length-1 ? stage.restAfterSec : 0),
        stageIndex, stageRound: i, stageRounds: total, presetId: stage.presetId,
        intervalMode: config.intervalMode,
        block: config.intervalMode==='ladder' && config.blockEnabled ? Math.floor((i-1)/config.rounds)+1 : 1,
        blockCount: config.intervalMode==='ladder' && config.blockEnabled ? config.blockCount : 1,
        localRound: (i-1)%config.rounds+1,
        localRounds: config.rounds
      });
    }
  });
  return programRounds;
}
