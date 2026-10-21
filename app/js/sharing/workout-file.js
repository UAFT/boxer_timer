import { PRESET_NAMES, normalizeOptions, normalizeProgram } from '../core/program.js';
import { clonePreset } from '../state/presets.js';

export const WORKOUT_FILE_FORMAT = 'fighttech.workout';
export const WORKOUT_FILE_VERSION = 2;
export const WORKOUT_FILE_MAX_BYTES = 128 * 1024;

export class WorkoutFileError extends Error {
  constructor(code) { super(code); this.name = 'WorkoutFileError'; this.code = code; }
}
const invalid = () => { throw new WorkoutFileError('invalid'); };
const plain = v => v !== null && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const integer = (x, min, max) => Number.isInteger(x) && x >= min && x <= max;
const string = (x, max, nonempty = false) => typeof x === 'string' && x.length <= max && (!nonempty || !!x.trim());
const configBounds = {
  rounds: [1,99],workSec:[5,3600],phaseTwoSec:[5,3600],restSec:[0,3600],
  workStepSec:[-600,600],restStepSec:[-600,600],blockCount:[1,99],blockRestSec:[0,3600],
  metronomeBpm:[0,300],warningSeconds:[0,10]
};
function checkSettings(settings, presetId) {
  if (settings === null) return clonePreset(presetId);
  if (!plain(settings) || Object.keys(settings).length > 40) invalid();
  for (const [k,v] of Object.entries(settings)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') invalid();
    if (v !== null && typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean') invalid();
    if (typeof v === 'string' && v.length > 100) invalid();
    if (typeof v === 'number' && (!Number.isFinite(v) || Math.abs(v) > 100000)) invalid();
    if (configBounds[k] && !integer(v,...configBounds[k])) invalid();
  }
  for (const k of ['rounds','workSec','restSec']) if (!integer(settings[k],...configBounds[k])) invalid();
  if (settings.intervalMode != null && !['standard','ladder','two_phase'].includes(settings.intervalMode)) invalid();
  if (settings.intervalMode==='two_phase' && !integer(settings.phaseTwoSec,5,3600)) invalid();
  if (settings.blockEnabled != null && typeof settings.blockEnabled !== 'boolean') invalid();
  if (settings.blockEnabled && !integer(settings.blockCount,1,99)) invalid();
  if (settings.countdownEnabled != null && typeof settings.countdownEnabled !== 'boolean') invalid();
  return settings;
}
function checkEntries(entries, options) {
  if (!Array.isArray(entries) || entries.length < 1 || entries.length > 24) invalid();
  let total = 0;
  for (const entry of entries) {
    if (!plain(entry) || !Object.hasOwn(PRESET_NAMES,entry.presetId)) invalid();
    if (!string(entry.title,80) || !integer(entry.restAfterSec,0,3600)) invalid();
    for (const [key,length] of [['roundNames',100],['phaseOneOverrides',100],['phaseTwoOverrides',100],['roundDescriptions',600]]) {
      if (entry[key] != null && (!Array.isArray(entry[key]) || entry[key].length > 200 || entry[key].some(x=>!string(x,length)))) invalid();
    }
    if (!plain(entry.settings)) invalid(); // v1 files always carry sender settings
    const cfg = checkSettings(entry.settings,entry.presetId);
    total += cfg.rounds * (cfg.blockEnabled && cfg.intervalMode === 'ladder' ? cfg.blockCount : 1);
  }
  if (total * options.cycles > 10000) invalid();
}
export function parseWorkoutFile(contents) {
  if (typeof contents !== 'string' || new TextEncoder().encode(contents).length > WORKOUT_FILE_MAX_BYTES) throw new WorkoutFileError('too_large');
  let value;
  try { value = JSON.parse(contents); } catch { throw new WorkoutFileError('invalid'); }
  if (!plain(value) || value.format !== WORKOUT_FILE_FORMAT) throw new WorkoutFileError('invalid');
  if (![1,WORKOUT_FILE_VERSION].includes(value.version)) throw new WorkoutFileError('version');
  if(value.version===1 && value.entries?.some(e=>e?.settings?.intervalMode==='two_phase' || e?.phaseOneOverrides?.length || e?.phaseTwoOverrides?.length))invalid();
  if (!string(value.name,80,true) || !plain(value.options) || !integer(value.options.cycles,1,20)
      || !integer(value.options.cycleRestSec,0,3600)) invalid();
  checkEntries(value.entries,value.options);
  const entries = normalizeProgram(value.entries);
  if (entries.length !== value.entries.length) invalid();
  return {name:value.name,entries,options:normalizeOptions(value.options)};
}
export function serializeWorkoutFile(program) {
  if (!program || typeof program !== 'object') invalid();
  const entries=normalizeProgram(program.entries);
  const usesTwo=entries.some(e=>e.settings?.intervalMode==='two_phase'||e.phaseOneOverrides?.length||e.phaseTwoOverrides?.length);
  const value={format:WORKOUT_FILE_FORMAT,version:usesTwo?WORKOUT_FILE_VERSION:1,
    name:program.name,entries,options:normalizeOptions(program.options)};
  const json=JSON.stringify(value,null,2);
  // The same validation contract applies to our own exports.
  parseWorkoutFile(json);
  return json;
}
export function workoutFileName(name) {
  const cleaned = String(name||'').normalize('NFC').replace(/[\\/:*?"<>|\x00-\x1f]/g,'_')
    .replace(/\s+/g,'_').replace(/[^\p{L}\p{N}_-]/gu,'').slice(0,56).replace(/^_+|_+$/g,'');
  return (cleaned || 'Fight_Tech_Workout') + '.ftworkout';
}

// Store the imported workout as an independent copy, without touching active playback.
export function storeImportedWorkout(existing, workout, storage, key, newId) {
  if (!Array.isArray(existing) || existing.length >= 100) throw new WorkoutFileError('limit');
  if (typeof newId !== 'string' || !newId || existing.some(x=>x.id===newId)) invalid();
  const imported=parseWorkoutFile(serializeWorkoutFile(workout));
  const next=[...existing,{...imported,id:newId}];
  // Write first: if localStorage is full, the caller keeps its in-memory list unchanged.
  storage.setItem(key,JSON.stringify(next));
  return next;
}

export function resolveSenderSettings(program, profiles) {
  return {...program,entries:program.entries.map(stage=>({
    ...stage,
    settings: stage.settings ?? structuredClone(profiles[stage.presetId])
  }))};
}
