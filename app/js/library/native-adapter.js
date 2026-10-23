import { CATEGORIES, LIBRARY, buildSteps } from './catalog.js';
import { clonePreset } from '../state/presets.js';

// Adapter: catalog entries become ordinary legacy program stages. No second timer.
export { CATEGORIES, LIBRARY };
export function stageForWorkout(workout) {
  if (!workout) return null;
  if (workout.mode === 'boxing_sequence') {
    const rounds=workout.rounds;
    if(!Array.isArray(rounds)||rounds.length<1||rounds.length>200||rounds.some(r=>!Number.isInteger(r.workSec)||r.workSec<1||r.workSec>3600||!Number.isInteger(r.restSec)||r.restSec<0||r.restSec>3600))return null;
    return {presetId:'classic2',title:'Бокс — '+workout.name,
      settings:{...clonePreset('classic2'),intervalMode:'standard',ladderEnabled:false,blockEnabled:false,rounds:rounds.length,workSec:rounds[0].workSec,restSec:rounds[0].restSec,workStepSec:0,restStepSec:0},
      roundNames:rounds.map(r=>r.name),roundDescriptions:rounds.map(r=>[r.stance,r.description].filter(Boolean).join(' · ')),
      roundTimingOverrides:rounds.map((r,i)=>({workSec:r.workSec,restSec:i===rounds.length-1?0:r.restSec})),restAfterSec:0};
  }
  if (workout.mode === 'afap') {
    // Use the existing count-up engine. Finishing is manual; the next stage
    // (if present) starts after restAfterSec, not after a fabricated timeout.
    return {
      presetId:'classic1',title:'AFAP — '+workout.name,
      settings:{...clonePreset('classic1'),intervalMode:'count_up',ladderEnabled:false,blockEnabled:false,
        rounds:1,workStepSec:0,restStepSec:0},
      roundNames:[workout.name],roundDescriptions:[workout.tasks.join(' · ')],restAfterSec:60
    };
  }
  if(workout.mode==='two_phase') {
    // Use the existing program compiler. The mixed workout varies phase 1
    // with sparse timing/name overrides, never a new clock implementation.
    const count=Number(workout.rounds);
    if(!Number.isInteger(count)||count<1||count>200)return null;
    const steps=buildSteps(workout);
    if(steps.some(step=>!Number.isInteger(step.seconds)||step.seconds<1||step.seconds>3600))return null;
    const settings={
      ...clonePreset('classic1'),
      intervalMode:'two_phase',ladderEnabled:false,blockEnabled:false,
      rounds:count,workSec:workout.work,phaseTwoSec:workout.phaseTwoSec,
      restSec:workout.rest,workStepSec:0,restStepSec:0,phaseTwoStepSec:0,
      phaseOneName:workout.phaseOneName,phaseTwoName:workout.phaseTwoName
    };
    return {
      presetId:'classic1',title:'Двухфазные — '+workout.name,
      settings,restAfterSec:60,
      // No duplicated round labels: the editor/plan derives them from the
      // current phase names, including later user edits to each round.
      phaseOneOverrides:workout.phaseOneOverrides||[],
      phaseTwoOverrides:workout.phaseTwoOverrides||[],
      roundTimingOverrides:workout.roundTimingOverrides||[]
    };
  }

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
