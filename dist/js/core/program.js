import { totalRoundsForConfig, workSecForRound, restSecAfterRound } from './schedule.js';
export const PRESET_NAMES = { classic3: '3′', classic2: '2′', classic1: '1′', tabata2020x24: '⚡' };
export const PROGRAM_KEY = 'andar.fight.timer.program.v1';
export const LIBRARY_KEY = 'fighttech.program.library.v1';
export const PROGRAM_OPTIONS_KEY = 'fighttech.program.options.v1';
const bounded = (value, min, max, fallback) => Number.isFinite(Number(value)) ? Math.max(min,Math.min(max,Math.round(Number(value)))) : fallback;
export function normalizeOptions(raw) { return { cycles: bounded(raw?.cycles,1,20,1), cycleRestSec: bounded(raw?.cycleRestSec,0,3600,60) }; }
export function normalizeLibrary(raw) { return (Array.isArray(raw)?raw:[]).slice(0,100).filter(x=>x && typeof x.id==='string' && typeof x.name==='string').map(x=>({id:x.id,name:x.name.slice(0,80),entries:normalizeProgram(x.entries),options:normalizeOptions(x.options)})); }

export function normalizeProgram(raw) {
  const entries = Array.isArray(raw) ? raw : [];
  return entries.slice(0, 24).filter(x => PRESET_NAMES[x?.presetId]).map(x => ({
    presetId: x.presetId,
    title: typeof x.title==='string' ? x.title.slice(0,80) : '',
    settings: x.settings && typeof x.settings==='object' && !Array.isArray(x.settings) ? structuredClone(x.settings) : null,
    restAfterSec: Math.max(0, Math.min(3600, Math.round((Number(x.restAfterSec) || 0) / 5) * 5))
  }));
}
export function compileProgram(entries, profiles, options = {}) {
  const stages = normalizeProgram(entries);
  const programRounds = [];
  const {cycles,cycleRestSec} = normalizeOptions(options);
  for (let cycleIndex=0;cycleIndex<cycles;cycleIndex++) stages.forEach((stage, stageIndex) => {
    const config = structuredClone(stage.settings || profiles[stage.presetId]);
    const total = totalRoundsForConfig(config);
    for (let i=1;i<=total;i++) {
      programRounds.push({
        workSec: workSecForRound(config,i),
        restSec: i<total ? restSecAfterRound(config,i) : (stageIndex<stages.length-1 ? stage.restAfterSec : cycleIndex<cycles-1 ? cycleRestSec : 0),
        stageIndex, stageRound: i, stageRounds: total, presetId: stage.presetId,
        stageTitle: stage.title, cycleIndex, cycles, cycleRestSec,
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
