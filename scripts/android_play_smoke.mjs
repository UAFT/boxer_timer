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
const tabs = METHODOLOGY ? ['programLibraryMine', 'programLibraryTemplates', 'ftTreePreviewTab', 'ftMethodV42Tab', 'ftWorkoutImportBtn'] : ['programLibraryMine', 'programLibraryTemplates', 'ftWorkoutImportBtn'];
if (JSON.stringify([...nav].sort()) !== JSON.stringify([...tabs].sort()) || methodText !== METHODOLOGY || !navFills) fail('library tabs: ' + JSON.stringify(nav));
// Fresh install (owner 2026-10-31): «Мои» holds no preloaded programs, only the empty-state hint.
const mine = await js(`({empty:!!document.querySelector('#programLibraryList .ft-mine-empty'),cards:document.querySelectorAll('#programLibraryList .ft-saved-program-entry').length})`);
step('mine_fresh_install', mine);
if (!mine?.empty || mine.cards) fail('«Мои» is not empty on a fresh install: ' + JSON.stringify(mine));
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
}

report.crashes = crashes();
report.js_errors = adb('logcat', '-d').split('\n').filter(l => /Capacitor\/Console.*(ERROR|Uncaught)|chromium.*Uncaught/.test(l)).slice(0, 20);
if (report.crashes.length) fail('crash in logcat');
writeFileSync(`${OUT}/logcat.txt`, adb('logcat', '-d'));
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
ws.close();
console.log(report.failures.length ? 'SMOKE FAIL' : 'SMOKE PASS');
process.exit(report.failures.length ? 1 : 0);
