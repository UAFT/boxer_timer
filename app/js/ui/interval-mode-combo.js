// Short tap selects a base mode. Holding the existing Ladder button while
// Two phases is selected toggles automatic ladder steps without a new preset.
export const hasDualMode = (mode,enabled)=>mode==='two_phase' && Boolean(enabled);
export function installIntervalModeCombo({buttons,modeInput,enabledInput,onChange}){
  const refresh=()=>{
    const mode=modeInput.value,dual=hasDualMode(mode,enabledInput.checked);
    for(const button of buttons){
      const selected=button.dataset.intervalMode===mode || (dual&&button.dataset.intervalMode==='ladder');
      button.classList.toggle('is-active',selected);
      button.classList.toggle('selected',selected);
      button.setAttribute('aria-pressed',String(selected));
      if(button.dataset.intervalMode==='ladder'){
        button.title=mode==='two_phase'?'Удерживайте, чтобы включить или выключить лестницу':'Лестница';
      }
    }
    onChange?.();
  };
  for(const button of buttons){
    let timer=null,held=false,start=null;
    const cancel=()=>{if(timer!==null)clearTimeout(timer);timer=null;start=null;};
    // Android WebView may treat a long press as selecting button text.
    // Suppress selection without cancelling pointer/click events used by the
    // two-phase + ladder hold gesture.
    button.addEventListener('selectstart', event=>event.preventDefault());
    button.addEventListener('dragstart', event=>event.preventDefault());
    button.addEventListener('pointerdown',event=>{
      if(event.button!==0 || button.disabled)return;
      held=false;cancel();
      if(button.dataset.intervalMode!=='ladder'||modeInput.value!=='two_phase')return;
      start={x:event.clientX,y:event.clientY};
      timer=setTimeout(()=>{
        held=true;timer=null;
        enabledInput.checked=!enabledInput.checked;
        refresh();
      },520);
    });
    button.addEventListener('pointermove',event=>{
      if(start&&(Math.abs(event.clientX-start.x)>15||Math.abs(event.clientY-start.y)>15))cancel();
    });
    button.addEventListener('pointerup',cancel);
    button.addEventListener('pointercancel',cancel);
    button.addEventListener('pointerleave',cancel);
    button.addEventListener('contextmenu',event=>{
      if(button.dataset.intervalMode==='ladder'&&modeInput.value==='two_phase'){
        event.preventDefault();cancel();
        if(!held){held=true;enabledInput.checked=!enabledInput.checked;refresh();}
      }
    });
    button.addEventListener('click',event=>{
      if(held){event.preventDefault();event.stopPropagation();held=false;return;}
      modeInput.value=button.dataset.intervalMode;
      enabledInput.checked=false;
      refresh();
    });
  }
  return {refresh};
}
