import { totalRoundsForConfig, workSecForRound, phaseTwoSecForRound, restSecAfterRound, blockRestSecAfterRound } from './schedule.js';
import { normalizeSettings } from '../state/settings-store.js';
import { PRESETS } from '../state/presets.js';
export const PRESET_NAMES = { classic3: '3′', classic2: '2′', classic1: '1′', tabata2020x24: '⚡' };
export const PROGRAM_KEY = 'andar.fight.timer.program.v1';
export const LIBRARY_KEY = 'fighttech.program.library.v1';
export const PROGRAM_OPTIONS_KEY = 'fighttech.program.options.v1';
// Caps the work of compiling and drawing one program; the longest library workout has 32 rounds.
export const MAX_PROGRAM_ROUNDS = 1000;
export const tooLongMessage = lang => lang === 'en'
  ? 'This program is too long: more than 1000 rounds. Reduce rounds, blocks or cycles.'
  : 'Программа слишком длинная: больше 1000 раундов. Уменьшите число раундов, блоков или циклов.';
// Stays above any single stage (99 rounds x 99 blocks), so stage cards are exact; a whole
// program past it is refused anyway. Without it 24 such stages x 20 cycles meant millions of rows.
const COMPILE_CEILING = 10000;
// Stage settings keep only setting keys: an imported "programRounds" string once turned a
// stage into 100 rounds of undefined length. Known values are kept exactly as stored.
const STAGE_SETTING_KEYS = [...Object.keys(normalizeSettings({}, PRESETS.classic3)), 'id', 'label'];
function stageSettings(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return Object.fromEntries(STAGE_SETTING_KEYS.filter(key => Object.hasOwn(raw, key)).map(key => [key, structuredClone(raw[key])]));
}
const bounded = (value, min, max, fallback) => Number.isFinite(Number(value)) ? Math.max(min,Math.min(max,Math.round(Number(value)))) : fallback;
// Sparse manual overrides: a missing key follows the automatic ladder. Zero rest is valid.
export function normalizeRoundTimingOverrides(raw) {
  return (Array.isArray(raw)?raw:[]).slice(0,200).map(row=>{
    if(!row || typeof row!=='object' || Array.isArray(row))return null;
    const result={};
    for(const field of ['workSec','phaseTwoSec','restSec']){
      if(row[field]!==undefined && row[field]!==null && row[field]!=='' &&
        Number.isFinite(Number(row[field])) && Number.isInteger(Number(row[field])) &&
        Number(row[field]) >= (field==='restSec'?0:1) && Number(row[field])<=3600)
        result[field]=Number(row[field]);
    }
    return Object.keys(result).length?result:null;
  });
}
export function normalizeOptions(raw) { return { cycles: bounded(raw?.cycles,1,20,1), cycleRestSec: bounded(raw?.cycleRestSec,0,3600,60) }; }
export function normalizeLibrary(raw) { return (Array.isArray(raw)?raw:[]).slice(0,100).filter(x=>x && typeof x.id==='string' && typeof x.name==='string').map(x=>({id:x.id,name:x.name.slice(0,80),entries:normalizeProgram(x.entries),options:normalizeOptions(x.options)})); }

export function normalizeProgram(raw) {
  const entries = Array.isArray(raw) ? raw : [];
  return entries.slice(0, 24).filter(x => PRESET_NAMES[x?.presetId]).map(x => ({
    presetId: x.presetId,
    title: typeof x.title==='string' ? x.title.slice(0,80) : '',
    roundNames: Array.isArray(x.roundNames) ? x.roundNames.slice(0,200).map(n=>String(n||'').slice(0,100)) : [],
    phaseOneOverrides: Array.isArray(x.phaseOneOverrides) ? x.phaseOneOverrides.slice(0,200).map(n=>String(n||'').slice(0,100)) : [],
    phaseTwoOverrides: Array.isArray(x.phaseTwoOverrides) ? x.phaseTwoOverrides.slice(0,200).map(n=>String(n||'').slice(0,100)) : [],
    roundDescriptions: Array.isArray(x.roundDescriptions) ? x.roundDescriptions.slice(0,200).map(n=>String(n||'').slice(0,600)) : [],
    roundTimingOverrides: normalizeRoundTimingOverrides(x.roundTimingOverrides),
    settings: stageSettings(x.settings),
    restAfterSec: Math.max(0, Math.min(3600, Math.round((Number(x.restAfterSec) || 0) / 5) * 5))
  }));
}
// A stage with its own settings follows its preset tab only in the fields just changed in Settings.
const PRESET_SYNC_FIELDS=['intervalMode','phaseTwoSec','phaseOneName','phaseTwoName','ladderEnabled','phaseTwoStepSec','blockEnabled','blockCount','blockRestSec','workStepSec','restStepSec'];
export function syncStagesWithPreset(entries, presetId, before, after) {
  const changed=PRESET_SYNC_FIELDS.filter(field=>before?.[field]!==after?.[field]);
  if (!changed.length || after?.intervalMode==='count_up') return false;
  let touched=false;
  for (const entry of entries) {
    if (!entry.settings || entry.presetId!==presetId || entry.settings.intervalMode==='count_up') continue;
    for (const field of changed) entry.settings[field]=after[field];
    touched=true;
  }
  return touched;
}
export function compileProgram(entries, profiles, options = {}) {
  const stages = normalizeProgram(entries);
  const programRounds = [];
  const {cycles,cycleRestSec} = normalizeOptions(options);
  for (let cycleIndex=0;cycleIndex<cycles;cycleIndex++) for (const [stageIndex, stage] of stages.entries()) {
    const config = structuredClone(stage.settings || stageSettings(profiles[stage.presetId]));
    const total = config.intervalMode === 'count_up' ? 1 : totalRoundsForConfig(config);
    for (let i=1;i<=total;i++) {
      if (programRounds.length > COMPILE_CEILING) return programRounds;
      const override=stage.roundTimingOverrides[i-1]||{};
      const phaseTwo=phaseTwoSecForRound(config,i);
      programRounds.push({
        workSec: config.intervalMode==='count_up' ? 0 : (override.workSec ?? workSecForRound(config,i)),
        phaseTwoSec: config.intervalMode==='count_up'?0:(phaseTwo>0?(override.phaseTwoSec ?? phaseTwo):0),
        phaseOneName: stage.phaseOneOverrides?.[i-1] || config.phaseOneName || '',
        phaseTwoName: stage.phaseTwoOverrides?.[i-1] || config.phaseTwoName || '',
        restSec: i<total ? (override.restSec ?? restSecAfterRound(config,i)) : (stageIndex<stages.length-1 ? stage.restAfterSec : cycleIndex<cycles-1 ? cycleRestSec : 0),
        blockRestSec: i<total ? blockRestSecAfterRound(config,i) : 0,
        stageIndex, stageRound: i, stageRounds: total, presetId: stage.presetId,
        stageTitle: stage.title, roundName: stage.roundNames[i-1] || '', roundDescription: stage.roundDescriptions[i-1] || '', cycleIndex, cycles, cycleRestSec,
        intervalMode: config.intervalMode,
        ladderEnabled: Boolean(config.ladderEnabled),
        timingOverridden: Object.keys(override).length>0,
        block: (config.intervalMode==='ladder'||(config.intervalMode==='two_phase'&&config.ladderEnabled)) && config.blockEnabled ? Math.floor((i-1)/config.rounds)+1 : 1,
        blockCount: (config.intervalMode==='ladder'||(config.intervalMode==='two_phase'&&config.ladderEnabled)) && config.blockEnabled ? config.blockCount : 1,
        localRound: (i-1)%config.rounds+1,
        localRounds: config.rounds
      });
    }
  }
  return programRounds;
}
