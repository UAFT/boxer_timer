import {compileProgram} from '../core/program.js';
import {timeWords} from './library-card-view.js';

export function editorProgramIdentity(savedId,savedPrograms){
  return savedPrograms.find(p=>p.id===savedId)||null;
}
export function programDurationSec(entries,profiles,options){
  return compileProgram(entries,profiles,options).reduce((n,r)=>n+r.workSec+r.restSec,0);
}
export function programHeading(name,entries,profiles,options,lang='ru'){
  if(!entries.length)return {name:'',duration:'',visible:false};
  return {name:name|| (lang==='en'?'New program':'Новая программа'),duration:timeWords(programDurationSec(entries,profiles,options),lang),visible:true};
}
export function formatStageDetail(ordinal,work,rest,lang='ru') {
  return lang==='en' ? ordinal+' · work '+work+' · rest '+rest : ordinal+' · работа '+work+' · отдых '+rest;
}
export function syncEditorProgramHeader(doc,{name,entries,profiles,options,lang}={}) {
  const details=programHeading(name,entries,profiles,options,lang);
  const container=doc.getElementById('programActiveInfo');
  doc.getElementById('programCurrentName').textContent=details.name;
  doc.getElementById('programCurrentDuration').textContent=details.visible?'— '+details.duration:'';
  container.hidden=!details.visible;
  return details;
}
