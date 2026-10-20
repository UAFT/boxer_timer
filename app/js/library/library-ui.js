import {LIBRARY,CATEGORIES,findWorkout,buildSequence} from './catalog.js';
const KEY='fighttech.library.selection.v1';
const SAVED='fighttech.library.saved.v1';
const fmt=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
const safeParse=(key,fallback)=>{try {return JSON.parse(localStorage.getItem(key))||fallback;}catch{return fallback;}};
const button=(label,fn,cls='')=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.className=cls;b.addEventListener('click',fn);return b;};
const node=(tag,cls,content)=>{const e=document.createElement(tag);e.className=cls;if(content!==undefined)e.textContent=content;return e;};
export function installWorkoutLibrary({onStart,onStop,onCue}={}) {
  const opener=document.createElement('button');
  opener.type='button';
  opener.id='openWorkoutLibrary';
  opener.className='program-library-trigger';
  opener.textContent='Программа';
  const presetRow=document.querySelector('.preset-row');
  presetRow.insertAdjacentElement('afterend',opener);
  const backdrop=node('div','modal-backdrop workout-library-backdrop');
  backdrop.hidden=true;
  backdrop.id='workoutLibraryModal';
  const panel=node('section','library-panel panel');
  panel.id='workoutLibrary';
  panel.setAttribute('role','dialog');
  panel.setAttribute('aria-modal','true');
  panel.setAttribute('aria-label','Программа · библиотека тренировок');
  const existingProgram=document.getElementById('programPanel');
  if(existingProgram) {
    existingProgram.classList.add('library-existing-program');
    backdrop.append(existingProgram);
  }
  backdrop.append(panel);
  document.body.append(backdrop);
  const open=()=>{backdrop.hidden=false;document.body.classList.add('workout-library-open');};
  const close=()=>{backdrop.hidden=true;document.body.classList.remove('workout-library-open');};
  opener.addEventListener('click',open);
  backdrop.addEventListener('click',e=>{if(e.target===backdrop)close();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!backdrop.hidden)close();});
  let selection=(Array.isArray(safeParse(KEY,[]))?safeParse(KEY,[]):[]).filter(id=>findWorkout(id));
  let saved=Array.isArray(safeParse(SAVED,[]))?safeParse(SAVED,[]):[];
  let category='warmup',sequence=[],index=0,elapsed=0,paused=true,startedAt=0,interval=null,running=false;
  let lastSecond=-1;
  const head=node('div','library-head');
  head.append(node('strong','', 'БИБЛИОТЕКА ТРЕНИРОВОК'));
  head.append(button('Закрыть',close));
  const body=node('div','library-body');
  const categories=node('div','library-categories');
  const items=node('div','library-items');
  const compose=node('div','library-compose');
  const player=node('div','library-player');
  body.append(categories,items,compose,player);
  panel.append(head,body);
  const persist=()=>localStorage.setItem(KEY,JSON.stringify(selection));
  const save=()=>localStorage.setItem(SAVED,JSON.stringify(saved));
  const isActive=()=>running;
  function renderCategories(){
    categories.replaceChildren();
    CATEGORIES.forEach(([id,name])=>categories.append(button(name,()=>{category=id;renderCategories();renderItems();},'library-tab'+(category===id?' active':''))));
  }
  function renderItems(){
    items.replaceChildren();
    LIBRARY.filter(w=>w.category===category).forEach(w=>{
      const row=node('div','library-item');
      const desc=node('div','library-item-desc');
      desc.append(node('strong','',w.name),node('small','',w.id+' · '+w.mode.toUpperCase()+(w.equipment?' · '+w.equipment:'')));
      row.append(desc,button('Подробнее',()=>{const detail=row.querySelector('.library-detail');if(detail){detail.remove();return;}const d=node('div','library-detail',w.tasks.join(' → ')+(w.note?'\n'+w.note:''));row.append(d);}));
      row.append(button('＋',()=>{if(isActive()||selection.length>=24)return;selection.push(w.id);persist();renderCompose();},'library-add'));
      items.append(row);
    });
  }
  function renderCompose(){
    compose.replaceChildren(node('h3','','Собрать тренировку'));
    if(!selection.length)compose.append(node('p','library-muted','Выбери программу из разделов выше. Можно добавить несколько.'));
    selection.forEach((id,i)=>{
      const w=findWorkout(id);if(!w)return;
      const row=node('div','library-selected');
      row.append(node('span','',String(i+1)+'. '+w.name));
      row.append(button('↑',()=>move(i,-1)),button('↓',()=>move(i,1)),button('×',()=>{if(running)return;selection.splice(i,1);persist();renderCompose();}));
      compose.append(row);
    });
    const actions=node('div','library-actions');
    actions.append(button('Сохранить',()=>{if(!selection.length||running)return;const name=prompt('Название тренировки','Моя тренировка');if(!name?.trim())return;saved.push({name:name.trim().slice(0,80),ids:[...selection]});save();renderCompose();}));
    actions.append(button('Очистить',()=>{if(running)return;selection=[];persist();renderCompose();}));
    actions.append(button('▶ Старт',()=>start(),'library-primary'));
    compose.append(actions);
    if(saved.length){
      compose.append(node('h4','','Мои составные тренировки'));
      saved.forEach((s,i)=>{
        const row=node('div','library-selected');
        row.append(node('span','',s.name));
        row.append(button('Загрузить',()=>{if(running)return;selection=s.ids.filter(id=>findWorkout(id));persist();renderCompose();}));
        row.append(button('×',()=>{if(running)return;saved.splice(i,1);save();renderCompose();}));
        compose.append(row);
      });
    }
  }
  function move(i,d){const j=i+d;if(running||j<0||j>=selection.length)return;[selection[i],selection[j]]=[selection[j],selection[i]];persist();renderCompose();}
  function stop(){
    if(interval)clearInterval(interval);interval=null;
    running=false;paused=true;sequence=[];elapsed=0;index=0;lastSecond=-1;
    onStop?.();renderPlayer();renderCompose();
  }
  function step(){return sequence[index];}
  function start(){
    if(running||!selection.length)return;
    sequence=buildSequence(selection,60);if(!sequence.length)return;
    onStart?.();running=true;paused=false;index=0;elapsed=0;lastSecond=-1;
    startedAt=Date.now();interval=setInterval(tick,120);onCue?.('start');renderPlayer();renderCompose();
  }
  function advance(){
    const current=step();if(!current)return;
    index++;elapsed=0;lastSecond=-1;startedAt=Date.now();
    if(index>=sequence.length){onCue?.('end');stop();return;}
    onCue?.(step().kind==='rest'?'rest':'start');
    renderPlayer();
  }
  function tick(){
    if(!running||paused)return;
    const s=step();if(!s)return;
    elapsed=(Date.now()-startedAt)/1000;
    if(s.kind!=='afap' && elapsed>=s.seconds){advance();return;}
    const whole=Math.floor(elapsed);
    if(whole!==lastSecond){lastSecond=whole;renderPlayer();}
  }
  function pause(){
    if(!running)return;
    if(paused){startedAt=Date.now()-elapsed*1000;paused=false;}else{elapsed=(Date.now()-startedAt)/1000;paused=true;}
    renderPlayer();
  }
  function renderPlayer(){
    player.replaceChildren();
    if(!running){player.hidden=true;return;}player.hidden=false;
    const s=step();if(!s)return;
    player.append(node('small','','ЭТАП '+(index+1)+' ИЗ '+sequence.length+' · '+(s.programName||'')));
    player.append(node('h3','',s.title));
    player.append(node('p','library-muted',s.description||''));
    player.append(node('div','library-clock',fmt(s.kind==='afap'?Math.floor(elapsed):Math.max(0,Math.ceil(s.seconds-elapsed)))));
    player.append(node('p','library-muted',s.kind==='afap'?'Секундомер · завершение вручную':s.kind==='rest'?'Отдых':'Работа'));
    const actions=node('div','library-actions');
    actions.append(button(paused?'Продолжить':'Пауза',pause,'library-primary'));
    if(s.kind==='afap')actions.append(button('Готово · далее',advance,'library-primary'));
    actions.append(button('Стоп',stop));
    player.append(actions);
  }
  renderCategories();renderItems();renderCompose();renderPlayer();
  return {stop,isActive};
}
