// Smoke test on an Android emulator, shared by the Play MVP and the methodology build (FT_VARIANT=methodology).
// 1. The signed release APK (from the AAB) installs, launches and does not crash.
// 2. A debug build of the same project is driven through the WebView DevTools protocol: library tabs,
//    Library → add a workout, start, screen lock, Home, Back. Timer time is compared with wall time,
//    and a 1 s JS heartbeat shows whether the page kept running while locked / in the background.
// Usage: node scripts/android_play_smoke.mjs <release.apk> <debug.apk> <out_dir>
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const PKG = 'com.andarfighttech.boxertimer';
const METHODOLOGY = process.env.FT_VARIANT === 'methodology';
const [RELEASE, DEBUG, OUT] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const adb = (...a) => { try { return execFileSync('adb', a, { encoding: 'utf8', maxBuffer: 64 << 20 }); } catch (e) { return String(e.stdout || ''); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const report = { steps: [], failures: [] };
const step = (name, data = {}) => { report.steps.push({ step: name, ...data }); console.log(name, JSON.stringify(data)); };
const fail = msg => { report.failures.push(msg); console.log('FAIL', msg); };
const shot = name => writeFileSync(`${OUT}/${name}.png`, execFileSync('adb', ['exec-out', 'screencap', '-p'], { maxBuffer: 64 << 20 }));
const foreground = () => /(?:mResumedActivity|topResumedActivity)[^\n]*com\.andarfighttech\.boxertimer/.test(adb('shell', 'dumpsys', 'activity', 'activities'));
const launch = () => adb('shell', 'am', 'start', '-W', '-n', `${PKG}/.MainActivity`);
const crashes = () => adb('logcat', '-d').split('\n').filter(l => l.includes('FATAL EXCEPTION') || (l.includes('AndroidRuntime') && l.includes(PKG)));

// 1. Release APK.
// A cold emulator needs time before the WebView paints: wait until the screenshot is no longer a blank page
// (a blank 320×640 capture is a few kB, the timer screen tens of kB).
adb('install', '-r', RELEASE); adb('logcat', '-c'); launch();
const t0 = Date.now(); let painted = 0;
while (Date.now() - t0 < 120000) { const size = execFileSync('adb', ['exec-out', 'screencap', '-p'], { maxBuffer: 64 << 20 }).length; if (size > 20000) { painted = size; break; } await sleep(2000); }
const dumpsys = adb('shell', 'dumpsys', 'package', PKG);
report.release = { paint_s: painted ? Math.round((Date.now() - t0) / 1000) : null, png_bytes: painted, targetSdk: (dumpsys.match(/targetSdk=(\d+)/) || [])[1], versionName: (dumpsys.match(/versionName=(\S+)/) || [])[1], foreground: foreground(), crashes: crashes() };
shot('01_release_main'); step('release_launch', report.release);
if (!report.release.foreground || report.release.crashes.length || !painted) fail('release APK did not start and paint cleanly');
adb('uninstall', PKG);

// 2. Debug build through DevTools.
adb('install', '-r', DEBUG); adb('logcat', '-c'); launch(); await sleep(10);
const pid = adb('shell', 'pidof', PKG).trim();
adb('forward', 'tcp:9222', `localabstract:webview_devtools_remote_${pid}`);
const target = (await (await fetch('http://127.0.0.1:9222/json')).json()).find(t => t.type === 'page');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
let seq = 0; const waiting = new Map();
ws.onmessage = m => { const d = JSON.parse(m.data); waiting.get(d.id)?.(d); waiting.delete(d.id); };
const js = expr => new Promise(ok => { const id = ++seq; waiting.set(id, d => ok(d.result?.result?.value)); ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true, awaitPromise: true } })); });
const click = id => js(`document.getElementById(${JSON.stringify(id)}).click()`);
for (let i = 0; i < 60 && !(await js(`document.visibilityState==='visible'&&!!document.getElementById('startBtn')&&document.readyState==='complete'`)); i++) { if (i % 10 === 9) launch(); await sleep(1000); }
await sleep(2000);
const secs = t => { const m = /^(\d+):(\d\d)$/.exec((t || '').trim()); return m ? +m[1] * 60 + +m[2] : null; };
const state = () => js(`({main:document.getElementById('mainTime').textContent,rem:document.getElementById('metricRemaining').textContent,phase:document.getElementById('phaseLabel').textContent,round:document.getElementById('roundLabel').textContent,
  btn:document.getElementById('startBtn').textContent.trim(),hint:!document.getElementById('ftBackHint')?.hidden,visible:document.visibilityState,now:Date.now()})`);

// Library tabs: the Play MVP shows Mine / Library / import only, the methodology build adds Tree and Methodology.
await click('programLibraryOpen'); await sleep(800);
const nav = await js(`[...document.querySelector('.ft-library-nav').children].filter(b=>b.offsetParent!==null).map(b=>b.id)`);
const navFills = await js(`(()=>{const n=document.querySelector('.ft-library-nav'),v=[...n.children].filter(b=>b.offsetParent!==null),r=e=>e.getBoundingClientRect();return Math.abs(r(v[v.length-1]).right-r(n).right)<=1&&v.every(b=>r(b).right<=r(n).right+0.5)})()`);
const methodText = await js(`/Методик|Methodolog|Дерево|Tree/.test(document.body.innerText)`);
shot('02_library_mine'); step('library_tabs', { nav, navFills, methodText });
const tabs = METHODOLOGY ? ['programLibraryMine', 'programLibraryTemplates', 'ftTreePreviewTab', 'ftMethodV42Tab', 'ftWorkoutImportBtn'] : ['programLibraryMine', 'programLibraryTemplates', 'programLibraryDiary', 'ftWorkoutImportBtn'];
if (JSON.stringify([...nav].sort()) !== JSON.stringify([...tabs].sort()) || methodText !== METHODOLOGY || !navFills) fail('library tabs: ' + JSON.stringify(nav));
// Fresh install (owner 2026-10-31): «Мои» holds no preloaded programs, only the empty-state hint.
const mine = await js(`({empty:!!document.querySelector('#programLibraryList .ft-mine-empty'),cards:document.querySelectorAll('#programLibraryList .ft-saved-program-entry').length})`);
step('mine_fresh_install', mine);
if (!mine?.empty || mine.cards) fail('«Мои» is not empty on a fresh install: ' + JSON.stringify(mine));
if (!METHODOLOGY) {
  // Diary (STAGE 1): Monday-first month grid, today selected, nothing written to storage.
  const before = await js(`Object.keys(localStorage).sort().join()`);
  await click('programLibraryDiary'); await sleep(800);
  const diary = await js(`({week:[...document.querySelectorAll('.ft-diary-weekday')].length,days:document.querySelectorAll('.ft-diary-day').length,selected:document.querySelectorAll('.ft-diary-day.is-selected').length,overflow:document.querySelector('.ft-diary').scrollWidth-document.querySelector('.ft-diary').clientWidth,keys:Object.keys(localStorage).sort().join()})`);
  shot('02c_diary'); step('diary', diary);
  if (!(diary?.week === 7 && diary.days >= 28 && diary.selected === 1 && diary.overflow <= 0 && diary.keys === before)) fail('diary: ' + JSON.stringify(diary));
}
if (METHODOLOGY) {
  for (const [id, name] of [['ftTreePreviewTab', '02a_tree'], ['ftMethodV42Tab', '02b_methodology']]) {
    await click(id); await sleep(1000);
    const shown = await js(`({items:document.getElementById('programLibraryList').children.length,text:document.getElementById('programLibraryList').innerText.length})`);
    shot(name); step(name, shown);
    if (!(shown?.items > 0 && shown.text > 100)) fail(name + ' is empty');
  }
}
await click('programLibraryTemplates'); await sleep(800);
const folders = await js(`[...document.querySelectorAll('#programLibraryList .ft-library-folder')].map(b=>b.getAttribute('aria-label'))`);
shot('03_library'); step('library_folders', { folders });
if (!(folders?.length >= 5)) fail('library folders missing');
if (!METHODOLOGY) {
  // Play MVP «Бокс»: four folders, 149 workouts, no «Ранее добавленные».
  await js(`document.querySelectorAll('#programLibraryList .ft-library-folder')[1].click()`); await sleep(600);
  const boxing = await js(`[...document.querySelectorAll('#programLibraryList .ft-library-folder')].map(b=>b.getAttribute('aria-label'))`);
  shot('03a_boxing'); step('boxing_folders', { section: folders[1], boxing });
  if (!/, 149$/.test(folders[1]) || boxing?.length !== 4 || boxing.some(l => /Ранее добавленные|Previously added/.test(l))) fail('Play MVP boxing folders: ' + JSON.stringify(boxing));
  await click('programLibraryBack'); await sleep(600);
}
await js(`document.querySelector('#programLibraryList .ft-library-folder').click()`); await sleep(600);
const added = await js(`(()=>{const b=[...document.querySelectorAll('#programLibraryList button')].find(b=>!b.disabled&&/plus|add/i.test(b.className+b.innerHTML));if(!b)return false;b.click();return true})()`);
shot('04_folder'); step('library_add', { added });
if (!added) fail('could not add a library workout');
// Android Back inside a folder goes up to the sections, the next Back closes the dialog (Capacitor App plugin listener).
adb('shell', 'input', 'keyevent', '4'); await sleep(1200);
const upLevel = await js(`({open:!document.getElementById('programLibraryModal').hidden,folders:document.querySelectorAll('#programLibraryList .ft-library-folder').length})`);
adb('shell', 'input', 'keyevent', '4'); await sleep(1200);
const libClosed = await js(`document.getElementById('programLibraryModal').hidden`);
step('back_in_library', { upLevel, libClosed, foreground: foreground() });
if (!upLevel.open || upLevel.folders < 5 || !libClosed || !foreground()) fail('Back in the library: expected folder → sections → closed');

// Diary STAGE 2 (Play): «Сохранить» → «В дневник» → today → the assignment lands in the app's data folder (Filesystem plugin),
// not in localStorage, and the calendar shows it.
if (!METHODOLOGY) {
  await click('programSaveOpen'); await sleep(600);
  await js(`document.querySelector('#programSaveDest [data-value="diary"]').click()`); await sleep(600);
  await js(`document.querySelector('#programSaveCalendar .ft-diary-day.is-today').click()`); await sleep(400);
  const label = await js(`document.getElementById('programSaveConfirm').textContent`);
  shot('04a_save_diary');
  await click('programSaveConfirm'); await sleep(1500);
  const file = await js(`(async()=>{const fs=Capacitor.Plugins.Filesystem;const out={};for(const s of ['a','b']){try{const t=(await fs.readFile({path:'fighttech-diary-'+s+'.json',directory:'DATA',encoding:'utf8'})).data;const j=JSON.parse(t);out[s]={seq:j.seq,sessions:j.sessions.length,snapshots:Object.keys(j.snapshots).length,bytes:t.length}}catch(e){out[s]=String(e.message||e)}}out.localStorageDiary=Object.keys(localStorage).filter(k=>k.startsWith('fighttech.diary'));return out})()`);
  await click('programLibraryOpen'); await sleep(600); await click('programLibraryDiary'); await sleep(800);
  const chip = await js(`document.querySelector('.ft-diary-day.is-today').className`);
  shot('04b_diary_assigned'); step('diary_assign', { label, file, chip });
  if (!(file?.a?.sessions === 1 && file.localStorageDiary?.length === 0 && /is-planned/.test(chip))) fail('diary assignment not stored in the data folder: ' + JSON.stringify({ file, chip }));
  // STAGE 3.1: Diary → today → Add → Library → two blocks → × writes ONE appointment and comes back to the same date.
  await js(`document.querySelector('.ft-diary-day.is-today').click()`); await sleep(300);
  await js(`document.querySelector('.ft-diary-add-toggle').click()`); await sleep(300);
  await js(`document.querySelector('.ft-diary-source-menu [data-value="library"]').click()`); await sleep(600);
  for (let i = 0; i < 4 && !(await js(`!!document.querySelector('.ft-library-add:not([disabled])')`)); i++) { await js(`document.querySelector('.ft-library-folder').click()`); await sleep(400); }
  await js(`document.querySelectorAll('.ft-library-add:not([disabled])')[0].click()`); await sleep(800);
  await js(`document.querySelectorAll('.ft-library-add:not([disabled])')[1].click()`); await sleep(800);
  shot('04c_library_draft');
  await click('programLibraryClose'); await sleep(1500);
  const draft = await js(`(async()=>{const fs=Capacitor.Plugins.Filesystem;const all=[];for(const s of ['a','b']){try{all.push(JSON.parse((await fs.readFile({path:'fighttech-diary-'+s+'.json',directory:'DATA',encoding:'utf8'})).data))}catch{}}const d=all.sort((x,y)=>y.seq-x.seq)[0];return {seq:d.seq,stages:d.sessions.map(x=>d.snapshots[x.planRef].entries.length),open:!document.getElementById('programLibraryModal').hidden,diaryTab:document.getElementById('programLibraryDiary').classList.contains('is-active'),selectedToday:!!document.querySelector('.ft-diary-day.is-today.is-selected'),cards:document.querySelectorAll('.ft-diary-session').length}})()`);
  shot('04d_diary_after_x'); step('diary_library_x', draft);
  if (!(JSON.stringify(draft?.stages) === '[1,2]' && draft.open && draft.diaryTab && draft.selectedToday && draft.cards === 2)) fail('Diary → Library → × did not write one appointment back to the date: ' + JSON.stringify(draft));
  adb('shell', 'input', 'keyevent', '4'); await sleep(1200);
  if (!(await js(`document.getElementById('programLibraryModal').hidden`))) fail('Back did not close the diary');
}

// Workout with a JS heartbeat.
await js(`window.__beats=[];setInterval(()=>window.__beats.push(Date.now()),1000);true`);
await click('startBtn'); await sleep(8000);
const s0 = await state(); shot('05_running'); step('running', s0);
const beatsIn = async (a, b) => js(`window.__beats.filter(t=>t>${a}&&t<${b}).length`);
const measure = async (name, before, action, ms) => {
  action(); await sleep(ms);
  adb('shell', 'input', 'keyevent', '224'); adb('shell', 'wm', 'dismiss-keyguard'); launch(); await sleep(3000);
  const after = await state(); shot(name);
  const wall = (after.now - before.now) / 1000, timer = secs(before.rem) - secs(after.rem);
  const beats = await beatsIn(before.now + 2000, before.now + ms);
  const data = { wall_s: +wall.toFixed(1), timer_s: timer, drift_s: +(wall - timer).toFixed(1), heartbeats_while_away: beats, of_expected: Math.round((ms - 2000) / 1000), after };
  step(name, data);
  if (Math.abs(data.drift_s) > 3) fail(`${name}: timer drift ${data.drift_s}s`);
  return after;
};
const s1 = await measure('06_after_lock', s0, () => adb('shell', 'input', 'keyevent', '26'), 30000);
const s2 = await measure('07_after_home', s1, () => adb('shell', 'input', 'keyevent', '3'), 20000);

// Back during a workout: first press warns, the second within 2.5 s minimizes, the workout keeps running.
adb('shell', 'input', 'keyevent', '4'); await sleep(500);
const once = await state(); const fgOnce = foreground(); shot('08_back_once'); step('back_once', { foreground: fgOnce, hint: once.hint });
if (!fgOnce || !once.hint) fail('first Back during a workout did not warn');
adb('shell', 'input', 'keyevent', '4'); await sleep(1500);
const fgTwice = foreground(); launch(); await sleep(2500);
const twice = await state(); step('back_twice', { minimized: !fgTwice, after: twice });
if (fgTwice || secs(twice.rem) === null || secs(twice.rem) >= secs(s2.rem)) fail('second Back: expected minimize with the workout still running');

// Speech: recorded, never asserted. Round announcements need speechSynthesis inside the WebView.
report.speech = await js(`new Promise(ok=>{const s=globalThis.speechSynthesis;if(!s)return ok({available:false});setTimeout(()=>ok({available:true,voices:s.getVoices().map(v=>v.lang+' '+v.name).slice(0,20)}),1500)})`);
step('speech', report.speech);

// Billing plugin (Play MVP only): the Kotlin bridge answers; nothing is bought. The google_apis image has no Play Store,
// so BILLING_UNAVAILABLE / SERVICE_UNAVAILABLE here is expected and recorded, not a failure.
if (!METHODOLOGY) {
  report.billing = await js(`(async()=>{const b=globalThis.Capacitor?.Plugins?.FtBilling;if(!b)return {plugin:false};const d=await b.deviceInfo();const q=await b.queryPurchases();const p=await b.getProducts({productIds:['ft_smoke_probe']});return {plugin:true,androidId:!!d.androidId,purchases:q.responseCode,products:p.responseCode}})()`);
  step('billing', report.billing);
  if (!report.billing?.plugin || !report.billing.androidId) fail('FtBilling plugin is not registered or has no ANDROID_ID');
  // Diary STAGE 3: the workout above is still running; with «Автоматически» a stop records what was really done
  // (status partial, rounds counted only once finished) into the data-folder file, filling today's STAGE 2 assignment.
  await js(`(()=>{document.getElementById('settingsBtn').click();document.querySelector('[data-diary-record="auto"]').click();document.getElementById('closeSettingsBtn').click();return true})()`);
  const progress = await js(`JSON.parse(localStorage.getItem('fighttech.diary.run.v1')||'null')`);
  await js(`document.getElementById('resetBtn').click()`); await sleep(2000);
  const recorded = await js(`(async()=>{const fs=Capacitor.Plugins.Filesystem;const all=[];for(const s of ['a','b']){try{all.push(JSON.parse((await fs.readFile({path:'fighttech-diary-'+s+'.json',directory:'DATA',encoding:'utf8'})).data))}catch{}}const d=all.sort((x,y)=>y.seq-x.seq)[0];return {seq:d.seq,sessions:d.sessions.map(x=>({status:x.status,origin:x.origin,facts:x.facts})),runLeft:localStorage.getItem('fighttech.diary.run.v1')}})()`);
  step('diary_record', { progress: progress && { roundsDone: progress.roundsDone, activeMs: progress.activeMs }, recorded });
  const run = recorded?.sessions?.find(x => x.facts);
  if (!(run?.status === 'partial' && run.facts.activeSec > 30 && recorded.runLeft === null && recorded.sessions.length === 2)) fail('diary run not recorded: ' + JSON.stringify(recorded));
  // STAGE 3.1: «Спрашивать»; Android Back on «Записать?» is no answer: the run waits and is asked again when «Дневник» opens.
  await js(`(()=>{document.getElementById('settingsBtn').click();document.querySelector('[data-diary-record="ask"]').click();document.getElementById('closeSettingsBtn').click();return true})()`);
  await js(`document.getElementById('programStart').click()`); await sleep(9000);
  await js(`document.getElementById('resetBtn').click()`); await sleep(1200);
  const asked = await js(`!document.getElementById('programDeleteConfirmModal').hidden && document.getElementById('programDeleteConfirmTitle').textContent`);
  shot('09_record_question');
  adb('shell', 'input', 'keyevent', '4'); await sleep(1200);
  const afterBack = await js(`({open:!document.getElementById('programDeleteConfirmModal').hidden,pending:JSON.parse(localStorage.getItem('fighttech.diary.pending.v1')||'[]').length})`);
  await click('programLibraryOpen'); await sleep(600); await click('programLibraryDiary'); await sleep(1200);
  const again = await js(`!document.getElementById('programDeleteConfirmModal').hidden`);
  await click('programDeleteConfirmAccept'); await sleep(1500);
  const final = await js(`(async()=>{const fs=Capacitor.Plugins.Filesystem;const all=[];for(const s of ['a','b']){try{all.push(JSON.parse((await fs.readFile({path:'fighttech-diary-'+s+'.json',directory:'DATA',encoding:'utf8'})).data))}catch{}}const d=all.sort((x,y)=>y.seq-x.seq)[0];return {sessions:d.sessions.length,pending:JSON.parse(localStorage.getItem('fighttech.diary.pending.v1')||'[]').length}})()`);
  step('diary_back_on_question', { asked, afterBack, again, final });
  if (!(asked && !afterBack.open && afterBack.pending === 1 && again && final.sessions === 3 && final.pending === 0)) fail('Back on «Записать?» lost or declined the run: ' + JSON.stringify({ asked, afterBack, again, final }));
  // STAGE 4: a planned appointment edited in place (stage ✎ → stage metronome 30/min, round 2 at 60/min), started from
  // its card. Metronome sounds are told apart by buffer length; intervals are measured in the WebView in real time
  // (JS scheduling — the speaker's own latency and Android audio focus need a real phone).
  await js(`(()=>{document.getElementById('programLibraryDiary').click();document.querySelector('.ft-diary-day.is-today').click();return true})()`); await sleep(800);
  const edited = await js(`(async()=>{const set=(id,v)=>{const e=document.getElementById(id);e.value=String(v);e.dispatchEvent(new Event('input',{bubbles:true}));};
    const card=[...document.querySelectorAll('.ft-diary-session')].find(c=>c.querySelector('.ft-diary-program'));if(!card)return {card:false};
    card.querySelector('.program-stage-timing').click();await new Promise(r=>setTimeout(r,300));
    card.querySelector('.program-stage-edit').click();await new Promise(r=>setTimeout(r,300));
    const dialog=!document.getElementById('stageSettingsModal').hidden;
    for(const [id,v] of [['stageSettingsRounds',2],['stageSettingsWorkMin',0],['stageSettingsWorkSec',20],['stageSettingsRestMin',0],['stageSettingsRestSec',10]])set(id,v);
    document.getElementById('stageSettingsMetroOn').click();set('stageSettingsMetroBpm',30);document.getElementById('stageSettingsMetroPerRound').click();
    const rows=document.querySelectorAll('#stageSettingsMetroRounds input');rows[1].value='60';rows[1].dispatchEvent(new Event('input',{bubbles:true}));
    const hint=document.getElementById('stageSettingsMetroInterval').textContent;
    document.getElementById('stageSettingsSave').click();await new Promise(r=>setTimeout(r,1500));
    const fs=Capacitor.Plugins.Filesystem;const all=[];for(const s of ['a','b']){try{all.push(JSON.parse((await fs.readFile({path:'fighttech-diary-'+s+'.json',directory:'DATA',encoding:'utf8'})).data))}catch{}}
    const d=all.sort((x,y)=>y.seq-x.seq)[0];const metro=d.sessions.filter(x=>x.status==='planned').map(x=>d.snapshots[x.planRef].entries[0].metronome).filter(Boolean);
    return {card:true,dialog,hint,metro,rows:[...document.querySelectorAll('.ft-diary-program .program-round-metronome')].map(x=>x.textContent).slice(0,2)}})()`);
  shot('10_diary_stage_metronome');
  // Durations of the two metronome sounds as this device decodes them, then a log of every sound start.
  await js(`(async()=>{const ctx=new AudioContext();const dur=async u=>(await ctx.decodeAudioData(await (await fetch(u)).arrayBuffer())).duration;
    window.__metro=[await dur('./assets/audio/metronome/metronome_single_runtime.wav'),await dur('./assets/audio/metronome/metronome_split_upbeat_runtime.wav')];ctx.close();
    window.__snd=[];const st=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...a){if(this.buffer)window.__snd.push([Date.now(),this.buffer.duration]);return st.apply(this,a);};return true})()`);
  await js(`(()=>{[...document.querySelectorAll('.ft-diary-session')].find(c=>c.querySelector('.ft-diary-program')).querySelector('.ft-diary-start').click();return true})()`);
  await sleep(4000); shot('11_stage_metronome_running'); await sleep(50000);
  await js(`document.getElementById('resetBtn').click()`); await sleep(1500);
  const audio = await js(`(()=>{const m=window.__metro;const beats=window.__snd.filter(([,d])=>m.some(x=>Math.abs(x-d)<0.002)).map(([t])=>t);
    const gaps=beats.slice(1).map((t,i)=>t-beats[i]);return {beats:beats.length,gaps}})()`);
  const quick = audio?.gaps?.filter(g => g < 1500) || [], slow = audio?.gaps?.filter(g => g >= 1500 && g < 2500) || [];
  const jitter = Math.max(0, ...slow.map(g => Math.abs(g - 2000)), ...quick.map(g => Math.abs(g - 1000)));
  step('stage4_metronome', { edited, audio: { beats: audio?.beats, slow: slow.length, quick: quick.length, maxJitterMs: jitter, longGaps: audio?.gaps?.filter(g => g >= 2500) } });
  if (!(edited?.dialog && edited.metro?.some(m => m.enabled && m.bpm === 30 && m.roundBpm?.[1] === 60) && /каждые 2 с|every 2 sec/.test(edited.hint))) fail('STAGE 4: stage metronome not saved to the appointment: ' + JSON.stringify(edited));
  if (!(slow.length >= 5 && quick.length >= 5 && jitter <= 120)) fail('STAGE 4: stage metronome tempo/round switch not heard as configured: ' + JSON.stringify(audio));
  // STAGE 4.1: «Добавить этап» puts library blocks into THIS appointment (same id, no new workout); the stage toolbar sits
  // on the heading row; × asks first, hardware Back on that question deletes nothing, «Удалить» removes just that stage.
  const diaryFile = `(async()=>{const fs=Capacitor.Plugins.Filesystem;const all=[];for(const s of ['a','b']){try{all.push(JSON.parse((await fs.readFile({path:'fighttech-diary-'+s+'.json',directory:'DATA',encoding:'utf8'})).data))}catch{}}const d=all.sort((x,y)=>y.seq-x.seq)[0];const p=d.sessions.filter(x=>x.status==='planned');return {sessions:d.sessions.length,planned:p.map(x=>({id:x.id,n:d.snapshots[x.planRef].entries.length}))}})()`;
  await js(`(()=>{document.getElementById('programLibraryOpen').click();document.getElementById('programLibraryDiary').click();document.querySelector('.ft-diary-day.is-today').click();return true})()`); await sleep(1000);
  // The stopped metronome run above is offered as «Записать?» when the diary opens; decline it so the next dialog is ours.
  const declined41 = await js(`(()=>{const m=document.getElementById('programDeleteConfirmModal');if(m.hidden)return null;const t=document.getElementById('programDeleteConfirmTitle').textContent;document.getElementById('programDeleteConfirmCancel').click();return t})()`); await sleep(800);
  const before41 = await js(diaryFile);
  const row41 = await js(`(()=>{const c=[...document.querySelectorAll('.ft-diary-session')].find(c=>c.querySelector('.ft-diary-program'));if(!c)return null;
    return [...c.querySelectorAll('.program-stage')].map(st=>{const n=st.querySelector('.program-stage-number').getBoundingClientRect(),b=[...st.querySelectorAll(':scope>button')].map(x=>x.getBoundingClientRect());const mid=x=>(x.top+x.bottom)/2;
      return {buttons:b.length,sameRow:b.every(x=>Math.abs(mid(x)-mid(n))<14)}})})()`);
  await js(`(()=>{[...document.querySelectorAll('.ft-diary-session')].find(c=>c.querySelector('.ft-diary-program')).querySelector('.ft-diary-add-stage').click();return true})()`); await sleep(800);
  const picker = await js(`(async()=>{for(let i=0;i<4&&!document.querySelector('.ft-library-add:not([disabled])');i++){document.querySelector('.ft-library-folder').click();await new Promise(r=>setTimeout(r,300));}
    const hint=!!document.querySelector('.ft-library-insert');for(let i=0;i<2;i++){document.querySelector('.ft-library-add:not([disabled])').click();await new Promise(r=>setTimeout(r,300));}return {hint}})()`);
  shot('12_stage41_picker');
  await click('programLibraryClose'); await sleep(1500);
  const inserted = await js(diaryFile);
  shot('13_stage41_inserted');
  await js(`(()=>{const c=[...document.querySelectorAll('.ft-diary-session')].find(c=>c.querySelector('.ft-diary-program'));const st=[...c.querySelectorAll('.program-stage')].pop();st.querySelectorAll(':scope>button')[3].click();return true})()`); await sleep(600);
  const ask41 = await js(`document.getElementById('programDeleteConfirmModal').hidden?null:document.getElementById('programDeleteConfirmTitle').textContent`);
  adb('shell', 'input', 'keyevent', '4'); await sleep(800);
  const afterBack41 = await js(diaryFile);
  await js(`(()=>{const c=[...document.querySelectorAll('.ft-diary-session')].find(c=>c.querySelector('.ft-diary-program'));const st=[...c.querySelectorAll('.program-stage')].pop();st.querySelectorAll(':scope>button')[3].click();return true})()`); await sleep(600);
  await click('programDeleteConfirmAccept'); await sleep(1500);
  const removed41 = await js(diaryFile);
  step('stage41_diary', { declined41, before41, row41, picker, inserted, ask41, afterBack41, removed41 });
  // Stage count over all planned workouts (the card's own id is not on the page); the workout count must not change.
  const own = d => ({ n: (d?.planned || []).reduce((a, x) => a + x.n, 0) });
  if (!(row41?.length && row41.every(r => r.buttons === 4 && r.sameRow))) fail('STAGE 4.1: stage toolbar not on the heading row: ' + JSON.stringify(row41));
  if (!(picker?.hint && inserted.sessions === before41.sessions && inserted.planned.length === before41.planned.length && own(inserted)?.n === own(before41)?.n + 2)) fail('STAGE 4.1: library stages not inserted into the same workout: ' + JSON.stringify({ before41, picker, inserted }));
  if (!(/Удалить этап\?|Remove the stage\?/.test(ask41 || '') && JSON.stringify(afterBack41) === JSON.stringify(inserted) && own(removed41)?.n === own(inserted)?.n - 1)) fail('STAGE 4.1: stage × confirm/Back/remove wrong: ' + JSON.stringify({ ask41, afterBack41, removed41 }));
  adb('shell', 'input', 'keyevent', '4'); await sleep(800);
}

report.crashes = crashes();
report.js_errors = adb('logcat', '-d').split('\n').filter(l => /Capacitor\/Console.*(ERROR|Uncaught)|chromium.*Uncaught/.test(l)).slice(0, 20);
if (report.crashes.length) fail('crash in logcat');
writeFileSync(`${OUT}/logcat.txt`, adb('logcat', '-d'));
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
ws.close();
console.log(report.failures.length ? 'SMOKE FAIL' : 'SMOKE PASS');
process.exit(report.failures.length ? 1 : 0);
