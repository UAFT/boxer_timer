// Stage timing buttons share the main timer's five-second granularity.
// A minute adjustment is 60 seconds; round-count adjustments remain ±1.
// Carry/borrow across minute boundaries rather than clamping seconds at 59.
const TIME_PREFIXES = ['Work','Rest','PhaseTwo'];
const BOUNDS = {Work:[5,3600],Rest:[0,3600],PhaseTwo:[5,3600]};

export function stageFieldIncrement(key) {
  if (key === 'Rounds') return 1;
  if (TIME_PREFIXES.some(prefix => key === prefix+'Sec')) return 5;
  if (TIME_PREFIXES.some(prefix => key === prefix+'Min')) return 60;
  throw new Error('Unknown stage stepper field: '+key);
}

export function adjustStageField(lookup,key,direction){
  if (!['WorkMin','WorkSec','RestMin','RestSec','PhaseTwoMin','PhaseTwoSec','Rounds'].includes(key))
    throw new Error('Unknown stage field: '+key);
  const sign=direction < 0 ? -1 : 1;
  if(key==='Rounds'){
    const input=lookup('Rounds');
    input.value=String(Math.max(1,Math.min(99,(Number(input.value)||0)+sign)));
    return Number(input.value);
  }
  const prefix=key.endsWith('Min')?key.slice(0,-3):key.slice(0,-3);
  const minute=lookup(prefix+'Min'),second=lookup(prefix+'Sec');
  const min=Math.max(0,Number(minute.value)||0),sec=Math.max(0,Number(second.value)||0);
  const [lower,upper]=BOUNDS[prefix];
  const current=Math.min(upper,Math.max(0,Math.round(min*60+sec)));
  const total=Math.max(lower,Math.min(upper,current+sign*stageFieldIncrement(key)));
  minute.value=String(Math.floor(total/60));
  second.value=String(total%60);
  return total;
}

export function installStageTimeSteppers({lookup,scope=document}){
  for(const key of ['WorkMin','WorkSec','RestMin','RestSec','PhaseTwoMin','PhaseTwoSec','Rounds']){
    const input=lookup(key);
    const control=scope.createElement('div');
    control.className='stage-number-control';
    const minus=scope.createElement('button');
    minus.type='button';minus.textContent='−';minus.setAttribute('aria-label','Уменьшить '+key);
    const plus=scope.createElement('button');
    plus.type='button';plus.textContent='+';plus.setAttribute('aria-label','Увеличить '+key);
    for(const [button,sign] of [[minus,-1],[plus,1]]){
      let delay=null,repeat=null,held=false;
      const stop=()=>{clearTimeout(delay);clearInterval(repeat);delay=null;repeat=null;};
      button.addEventListener('pointerdown',e=>{
        if(e.button!==0)return;
        held=false;stop();
        delay=setTimeout(()=>{
          held=true;adjustStageField(lookup,key,sign);
          repeat=setInterval(()=>adjustStageField(lookup,key,sign),110);
        },450);
      });
      button.addEventListener('pointerup',()=>{stop();if(!held)adjustStageField(lookup,key,sign);held=false;});
      button.addEventListener('pointercancel',stop);
      button.addEventListener('lostpointercapture',stop);
      button.addEventListener('contextmenu',e=>e.preventDefault());
      // Keyboard activation triggers click without pointer events.
      button.addEventListener('click',e=>{if(e.detail===0)adjustStageField(lookup,key,sign);});
    }
    input.replaceWith(control);
    control.append(minus,input,plus);
  }
}
