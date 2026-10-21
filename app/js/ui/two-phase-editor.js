export function stageTwoPhaseLoad(cfg){
 const $=id=>document.getElementById(id);
 $('stageSettingsPhaseOne').value=cfg.phaseOneName||'';
 $('stageSettingsPhaseTwo').value=cfg.phaseTwoName||'';
 $('stageSettingsPhaseTwoMin').value=Math.floor((cfg.phaseTwoSec||40)/60);
 $('stageSettingsPhaseTwoSec').value=(cfg.phaseTwoSec||40)%60;
}
export function stageTwoPhaseSave(cfg){
 const $=id=>document.getElementById(id);
 const min=Number($('stageSettingsPhaseTwoMin').value),sec=Number($('stageSettingsPhaseTwoSec').value);
 if(!Number.isInteger(min)||min<0||min>60||!Number.isInteger(sec)||sec<0||sec>59||min*60+sec<5){$('stageSettingsPhaseTwoMin').focus();return false;}
 cfg.phaseTwoSec=min*60+sec;
 cfg.phaseOneName=$('stageSettingsPhaseOne').value.trim().slice(0,100);
 cfg.phaseTwoName=$('stageSettingsPhaseTwo').value.trim().slice(0,100);
 return true;
}
export function roundTwoPhaseLoad(stage,index,enabled){
 const root=document.getElementById('roundEditPhases');root.hidden=!enabled;
 if(!enabled)return;
 document.getElementById('roundEditPhaseOne').value=stage.phaseOneOverrides?.[index]||'';
 document.getElementById('roundEditPhaseTwo').value=stage.phaseTwoOverrides?.[index]||'';
 document.getElementById('roundEditPhaseOne').placeholder=stage.settings?.phaseOneName||'Фаза 1';
 document.getElementById('roundEditPhaseTwo').placeholder=stage.settings?.phaseTwoName||'Фаза 2';
}
export function roundTwoPhaseSave(stage,index){
 for(const [key,id] of [['phaseOneOverrides','roundEditPhaseOne'],['phaseTwoOverrides','roundEditPhaseTwo']]){
  const values=Array.isArray(stage[key])?[...stage[key]]:[];
  values[index]=document.getElementById(id).value.trim().slice(0,100);stage[key]=values;
 }
}
