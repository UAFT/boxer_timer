// Small, opt-in input gesture: upward = -5 sec; downward = +5 sec.
// Do not listen on a scroll container; only the numeric control owns the swipe.
export const SWIPE_STEP_PX = 22;
export function swipeSteps(startY, currentY, stepPx=SWIPE_STEP_PX) {
  const steps=Math.trunc((currentY-startY)/stepPx);
  return steps || 0;
}
export function attachVerticalTimeSwipe(input, onStep, {stepPx=SWIPE_STEP_PX}={}) {
  if (!input || typeof onStep!=='function') throw new TypeError('Input and callback required');
  let gesture=null;
  input.classList.add('ft-swipe-time');
  const finish=()=>{
    if(gesture && input.releasePointerCapture && input.hasPointerCapture?.(gesture.id)){
      input.releasePointerCapture(gesture.id);
    }
    gesture=null;
  };
  input.addEventListener('pointerdown',event=>{
    if(input.disabled || event.button!==0 || gesture) return;
    gesture={id:event.pointerId,startX:event.clientX,startY:event.clientY,applied:0,swiped:false};
    try { input.setPointerCapture?.(event.pointerId); } catch {}
  });
  input.addEventListener('pointermove',event=>{
    if(!gesture||event.pointerId!==gesture.id||input.disabled)return;
    const dx=Math.abs(event.clientX-gesture.startX);
    const dy=Math.abs(event.clientY-gesture.startY);
    if(!gesture.swiped && dx>dy && dx>stepPx/2) {finish();return;}
    const total=swipeSteps(gesture.startY,event.clientY,stepPx);
    if(total===gesture.applied)return;
    gesture.swiped=true;
    if(event.cancelable)event.preventDefault();
    // Defensive bound if a pointer jumps (e.g. on app resume).
    const diff=Math.max(-20,Math.min(20,total-gesture.applied));
    for(let i=0;i<Math.abs(diff);i++)onStep(Math.sign(diff));
    gesture.applied+=diff;
  });
  input.addEventListener('pointerup',event=>{
    if(gesture?.id!==event.pointerId)return;
    if(gesture.swiped){
      if(event.cancelable)event.preventDefault();
      input.blur?.();
    }
    finish();
  });
  input.addEventListener('pointercancel',finish);
  input.addEventListener('lostpointercapture',()=>{gesture=null;});
}
export function adjustClockSeconds(value,sign,{min=0,max=3600}={}) {
  return Math.max(min,Math.min(max,Math.round(Number(value)||0)+5*(sign<0?-1:1)));
}
