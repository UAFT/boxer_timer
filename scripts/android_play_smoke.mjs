// Smoke test of the Play MVP on an Android emulator.
// 1. The signed release APK (from the AAB) installs, launches and does not crash.
// 2. A debug build of the same project is driven through the WebView DevTools protocol: library tabs,
//    Library → add a workout, start, screen lock, Home, Back. Timer time is compared with wall time,
//    and a 1 s JS heartbeat shows whether the page kept running while locked / in the background.
// Usage: node scripts/android_play_smoke.mjs <release.apk> <debug.apk> <out_dir>
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const PKG = 'com.andarfighttech.boxertimer';
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
// A cold emulator needs time before the WebView paints.
adb('install', '-r', RELEASE); adb('logcat', '-c'); launch(); await sleep(25);
const dumpsys = adb('shell', 'dumpsys', 'package', PKG);
report.release = { targetSdk: (dumpsys.match(/targetSdk=(\d+)/) || [])[1], versionName: (dumpsys.match(/versionName=(\S+)/) || [])[1], foreground: foreground(), crashes: crashes() };
shot('01_release_main'); step('release_launch', report.release);
if (!report.release.foreground || report.release.crashes.length) fail('release APK did not start cleanly');
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

// Library: Mine / Library / import only.
await click('programLibraryOpen'); await sleep(800);
const nav = await js(`[...document.querySelector('.ft-library-nav').children].filter(b=>b.offsetParent!==null).map(b=>b.id)`);
const methodText = await js(`/Методик|Methodolog|Дерево|Tree/.test(document.body.innerText)`);
shot('02_library_mine'); step('library_tabs', { nav, methodText });
if (JSON.stringify(nav) !== JSON.stringify(['programLibraryMine', 'programLibraryTemplates', 'ftWorkoutImportBtn']) || methodText) fail('library tabs: ' + JSON.stringify(nav));
await click('programLibraryTemplates'); await sleep(800);
const folders = await js(`[...document.querySelectorAll('#programLibraryList .ft-library-folder')].map(b=>b.getAttribute('aria-label'))`);
shot('03_library'); step('library_folders', { folders });
if (!(folders?.length >= 5)) fail('library folders missing');
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

report.crashes = crashes();
report.js_errors = adb('logcat', '-d').split('\n').filter(l => /Capacitor\/Console.*(ERROR|Uncaught)|chromium.*Uncaught/.test(l)).slice(0, 20);
if (report.crashes.length) fail('crash in logcat');
writeFileSync(`${OUT}/logcat.txt`, adb('logcat', '-d'));
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
ws.close();
console.log(report.failures.length ? 'SMOKE FAIL' : 'SMOKE PASS');
process.exit(report.failures.length ? 1 : 0);
