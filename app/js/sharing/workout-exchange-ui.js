import { parseWorkoutFile, WORKOUT_FILE_MAX_BYTES, WorkoutFileError } from './workout-file.js';
import { shareWorkout } from './file-transfer.js';
import { createActionIcon } from '../ui/library-card-view.js';

const copies = {
  ru: {
    share:'Поделиться',import:'Импортировать',choose:'Выбери файл .ftworkout из «Загрузок»',
    preview:'Импорт программы',stages:'Этапов',cycles:'Циклов',cancel:'Отмена',save:'Сохранить в «Мои»',
    imported:'Программа сохранена в «Мои программы».',downloaded:'Файл создан. Его можно отправить через Telegram.',
    error:'Не удалось отправить файл. Попробуй ещё раз.', invalid:'Файл не является программой Fight Tech или повреждён.',
    version:'Версия файла не поддерживается.',too_large:'Файл слишком большой (максимум 128 КБ).',
    limit:'Лимит: 100 сохранённых программ.',read:'Не удалось прочитать файл.'
  },
  en: {
    share:'Share',import:'Import',choose:'Choose a .ftworkout file from Downloads',
    preview:'Import program',stages:'Stages',cycles:'Cycles',cancel:'Cancel',save:'Save to My Programs',
    imported:'Program saved to My Programs.',downloaded:'File created. You can send it using Telegram.',
    error:'Could not share the file. Please try again.',invalid:'Invalid or corrupted Fight Tech program file.',
    version:'Unsupported file version.',too_large:'File too large (maximum 128 KB).',
    limit:'Limit: 100 saved programs.',read:'Unable to read the file.'
  }
};
const copy = doc => copies[doc.documentElement.lang === 'en' ? 'en' : 'ru'];
export function installWorkoutExchange({doc = document, getSavedPrograms, onImported, isRunning = () => false,
  share = shareWorkout, prepareExport = program => program} = {}) {
  const byId=id=>doc.getElementById(id);
  const fileInput=byId('ftWorkoutImportFile');
  const trigger=byId('ftWorkoutImportBtn');
  const dialog=byId('ftWorkoutImportModal');
  const cancel=byId('ftWorkoutImportCancel');
  const accept=byId('ftWorkoutImportAccept');
  const feedback=byId('ftWorkoutExchangeStatus');
  let pending=null;
  function message(text) {feedback.textContent=text;}
  function close() {
    pending=null;dialog.hidden=true;doc.removeEventListener('keydown',keyHandler);
    trigger.focus();
  }
  function keyHandler(event) {
    if (event.key==='Escape') {event.preventDefault();close();}
    if (event.key!=='Tab')return;
    const controls=[cancel,accept].filter(b=>!b.disabled);
    const index=controls.indexOf(doc.activeElement);
    if(index<0 || (event.shiftKey&&index===0) || (!event.shiftKey&&index===controls.length-1)){
      event.preventDefault();controls[event.shiftKey?controls.length-1:0].focus();
    }
  }
  function showPreview(program) {
    const t=copy(doc);
    byId('ftWorkoutImportTitle').textContent=t.preview;
    byId('ftWorkoutImportName').textContent=program.name;
    byId('ftWorkoutImportDetails').textContent=t.stages+': '+program.entries.length+' · '+t.cycles+': '+program.options.cycles;
    cancel.textContent=t.cancel;accept.textContent=t.save;
    accept.disabled=getSavedPrograms().length>=100;
    pending=program;dialog.hidden=false;
    doc.addEventListener('keydown',keyHandler);cancel.focus();
  }
  trigger.addEventListener('click',()=>{
    if(isRunning()) return;
    feedback.textContent='';fileInput.value='';fileInput.click();
  });
  fileInput.addEventListener('change',async()=>{
    const file=fileInput.files?.[0];fileInput.value='';if(!file)return;
    try {
      if(file.size>WORKOUT_FILE_MAX_BYTES) throw new WorkoutFileError('too_large');
      showPreview(parseWorkoutFile(await file.text()));
    } catch(error) {message(copy(doc)[error.code]||copy(doc).read);}
  });
  cancel.addEventListener('click',close);
  dialog.addEventListener('click',event=>{if(event.target===dialog)close();});
  accept.addEventListener('click',()=>{
    if(!pending || isRunning())return;
    if(getSavedPrograms().length>=100){message(copy(doc).limit);close();return;}
    try {onImported(pending);close();message(copy(doc).imported);}
    catch(error) {message(copy(doc).error);close();}
  });
  async function shareSaved(program,button) {
    if(isRunning() || button.disabled)return;
    message('');button.disabled=true;
    try {
      const result=await share(prepareExport(program));
      if(result==='downloaded')message(copy(doc).downloaded);
    } catch(error) {
      if(error?.name!=='AbortError' && !/cancel|cancell|dismiss/i.test(String(error?.message||''))) message(copy(doc).error);
    } finally {button.disabled=isRunning();}
  }
  function shareButton(program) {
    const button=doc.createElement('button');button.type='button';
    button.className='ft-share-button';button.append(createActionIcon(doc,'share'));
    button.title=copy(doc).share;
    button.setAttribute('aria-label',copy(doc).share+' «'+program.name+'»');
    button.disabled=isRunning();
    button.addEventListener('click',()=>shareSaved(program,button));
    return button;
  }
  return {
    shareButton,
    shareSaved,
    shareLabel:()=>copy(doc).share,
    importLabel:()=>copy(doc).import,
    refresh() { trigger.setAttribute('aria-label',copy(doc).import);trigger.title=copy(doc).import;trigger.disabled=isRunning(); }
  };
}
