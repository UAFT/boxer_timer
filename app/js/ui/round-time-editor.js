import { totalRoundsForConfig,workSecForRound,phaseTwoSecForRound,restSecAfterRound } from '../core/schedule.js';
import { normalizeRoundTimingOverrides } from '../core/program.js';
import { formatTime } from '../core/time.js';

export function parseTimeValue(text,{allowZero=false}={}){
 const match=/^(\d{1,2}):([0-5]\d)$/.exec(String(text||'').trim());
 if(!match)return null;
 const sec=Number(match[1])*60+Number(match[2]);
 return sec<=3600&&(sec>0||allowZero)?sec:null;
}
export function automaticRoundTime(config,index){
 return {workSec:workSecForRound(config,index+1),
  phaseTwoSec:phaseTwoSecForRound(config,index+1),
  restSec:restSecAfterRound(config,index+1)};
}
export function saveRoundTiming(stage,index,config,values) {
 const baseline=automaticRoundTime(config,index);
 const original=normalizeRoundTimingOverrides(stage.roundTimingOverrides);
 const override={};
 for(const key of ['workSec','phaseTwoSec','restSec']){
  if(key==='phaseTwoSec'&&baseline.phaseTwoSec===0)continue;
  if(key==='restSec'&&index===totalRoundsForConfig(config)-1)continue;
  if(values[key]!==undefined&&values[key]!==baseline[key])override[key]=values[key];
 }
 original[index]=Object.keys(override).length?override:null;
 stage.roundTimingOverrides=original;
 return original[index];
}
export function loadRoundTimingEditor(stage,index,config,{hidden=false}={}){
 const root=document.getElementById('roundEditTimes');
 root.hidden=hidden;
 if(hidden)return;
 const baseline=automaticRoundTime(config,index);
 const manual=normalizeRoundTimingOverrides(stage.roundTimingOverrides)[index]||{};
 const last=index===totalRoundsForConfig(config)-1;
 for(const [key,id] of [['workSec','roundEditWorkTime'],['phaseTwoSec','roundEditPhaseTwoTime'],['restSec','roundEditRestTime']]){
  const input=document.getElementById(id);
  input.value=formatTime(manual[key]??baseline[key]);
  input.disabled=(key==='phaseTwoSec'&&baseline.phaseTwoSec===0)||(key==='restSec'&&last);
  input.closest('label').hidden=key==='phaseTwoSec'&&baseline.phaseTwoSec===0;
  input.classList.toggle('is-manual',manual[key]!==undefined);
 }
 document.getElementById('roundEditLastRestNote').hidden=!last;
 const reset=document.getElementById('roundEditResetTiming');
 reset.hidden=!Object.keys(manual).length;
 reset.onclick=()=>{
  for(const [key,id] of [['workSec','roundEditWorkTime'],['phaseTwoSec','roundEditPhaseTwoTime'],['restSec','roundEditRestTime']]){
   const input=document.getElementById(id);
   input.value=formatTime(baseline[key]);input.classList.remove('is-manual');
  }
  reset.hidden=true;
 };
}
export function readRoundTimingEditor(config,index){
 const result={};
 for(const [key,id] of [['workSec','roundEditWorkTime'],['phaseTwoSec','roundEditPhaseTwoTime'],['restSec','roundEditRestTime']]){
  const input=document.getElementById(id);
  if(input.disabled||input.closest('label').hidden)continue;
  const value=parseTimeValue(input.value,{allowZero:key==='restSec'});
  if(value===null){input.setCustomValidity('Формат ММ:СС, не более 60:00');input.reportValidity();input.focus();return null;}
  input.setCustomValidity('');
  result[key]=value;
 }
 return result;
}
