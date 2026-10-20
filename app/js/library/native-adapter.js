import { CATEGORIES, LIBRARY, buildSteps } from './catalog.js';
import { clonePreset } from '../state/presets.js';

// Adapter: catalog entries become ordinary legacy program stages. No second timer.
export { CATEGORIES, LIBRARY };
export function stageForWorkout(workout) {
  if (!workout || workout.mode === 'afap') return null; // manual-stop clock is not supported by legacy engine
  const steps = buildSteps(workout);
  const work = steps.filter(s=>s.kind==='work');
  if (!work.length || work.length>200 || work.some(s=>s.seconds<1 || s.seconds>3600)) return null;
  const first = work[0];
  const presetId = workout.mode==='tabata'?'tabata2020x24':'classic3';
  const settings = {...clonePreset(presetId), intervalMode:'standard',blockEnabled:false,rounds:work.length,
    workSec:first.seconds,restSec:0,workStepSec:0,restStepSec:0};
  // Standard engine supports equal-length rounds. Varying durations are not silently flattened.
  if (work.some(s=>s.seconds!==first.seconds)) return null;
  const rest = steps.filter(s=>s.kind==='rest');
  const rests = rest.filter((_,i)=>i<work.length-1);
  const restSec=rests.length?rests[0].seconds:0;
  if(rests.some(s=>s.seconds!==restSec))return null;
  settings.restSec=restSec;
  const title = CATEGORIES.find(c=>c[0]===workout.category)?.[1] || workout.category;
  return {presetId,title:title+' — '+workout.name,roundNames:work.map(s=>s.title),
    roundDescriptions:work.map(s=>s.description||''),settings,restAfterSec:60};
}
