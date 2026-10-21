// Only new element on the existing large timer: phase selector. Round duration
// buttons edit the selected phase; rest/round controls are untouched.
export function installTwoPhaseToggle({getSettings,onSelect}){
 const root=document.getElementById('twoPhaseSwitch');
 let chosen=1,started=null;
 function select(n){chosen=n===2?2:1;render(getSettings());onSelect?.();}
 for(const button of root.querySelectorAll('button'))button.addEventListener('click',()=>select(Number(button.dataset.phasePick)));
 root.addEventListener('pointerdown',e=>{started={x:e.clientX,y:e.clientY};});
 root.addEventListener('pointerup',e=>{if(!started)return;const dx=e.clientX-started.x,dy=e.clientY-started.y;started=null;if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy)*1.2)select(dx>0?2:1);});
 root.addEventListener('pointercancel',()=>{started=null;});
 function render(config,state){
  const row=state?.config?.programRounds?.[Math.max(0,(state.roundIndex||1)-1)];
  const enabled=row?row.phaseTwoSec>0:config?.intervalMode==='two_phase';
  root.hidden=!enabled;
  const active=state&&!['idle','finished'].includes(state.phase) && enabled
   ?(state.phase==='work_two'?2:state.phase==='work'?1:chosen)
   :chosen;
  for(const btn of root.querySelectorAll('button')){
   const selected=Number(btn.dataset.phasePick)===active;
   btn.classList.toggle('is-active',selected);btn.setAttribute('aria-pressed',String(selected));
  }
 }
 return {render,selected:()=>chosen,workTarget:()=>getSettings().intervalMode==='two_phase'&&chosen===2?'phaseTwoSec':'workSec',select};
}
