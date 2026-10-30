// Play MVP clean starter data (owner 2026-10-31) on an emulator with the exact release APKs.
// A phone that already has programs (from the methodology build or MVP 1.0.11) is updated with `adb install -r` to the new
// MVP: every saved program, the main-screen program, options and language must stay byte-equal, «Мои» shows them, and
// Library → «Бокс» no longer has «Ранее добавленные». Fresh-install checks live in the build's own smoke.
// Usage: node mvp_clean_starter.mjs <from.apk> <to.apk> <out_dir>
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const PKG = 'com.andarfighttech.boxertimer';
const [FROM, TO, OUT] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const adb = (...a) => { try { return execFileSync('adb', a, { encoding: 'utf8', maxBuffer: 64 << 20 }); } catch (e) { return String(e.stdout || '') + String(e.stderr || ''); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const report = { steps: [], failures: [], crashes: [] };
const step = (name, data = {}) => { report.steps.push({ step: name, ...data }); console.log(name, JSON.stringify(data)); };
const fail = msg => { report.failures.push(msg); console.log('FAIL', msg); };
const shot = name => writeFileSync(`${OUT}/${name}.png`, execFileSync('adb', ['exec-out', 'screencap', '-p'], { maxBuffer: 64 << 20 }));
const launch = () => adb('shell', 'am', 'start', '-W', '-n', `${PKG}/.MainActivity`);
const crashes = () => adb('logcat', '-d').split('\n').filter(l => l.includes('FATAL EXCEPTION') || (l.includes('AndroidRuntime') && l.includes(PKG)));
const pkgInfo = () => { const d = adb('shell', 'dumpsys', 'package', PKG); const g = re => (d.match(re) || [])[1];
  return { versionCode: g(/versionCode=(\d+)/), versionName: g(/versionName=(\S+)/), firstInstallTime: g(/firstInstallTime=([^\n]+)/) }; };
const KEYS = ['fighttech.program.library.v1', 'andar.fight.timer.program.v1', 'fighttech.program.options.v1', 'fighttech.language.v1'];
const NAMES = ['Программа 1', 'Сила + лёгкость', 'Тестовая'];

adb('root'); await sleep(3000); adb('wait-for-device');
let port = 9300;
async function openApp(name) {
  report.crashes.push(...crashes()); adb('logcat', '-c'); launch(); await sleep(8000);
  let pid = '', target;
  for (let i = 0; i < 30 && !target; i++) {
    pid = adb('shell', 'pidof', PKG).trim();
    if (pid && adb('shell', 'cat', '/proc/net/unix').includes(`webview_devtools_remote_${pid}`)) {
      adb('forward', `tcp:${++port}`, `localabstract:webview_devtools_remote_${pid}`);
      try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page'); } catch {}
    }
    if (!target) { if (i % 10 === 9) launch(); await sleep(2000); }
  }
  if (!target) { fail(`${name}: no WebView DevTools socket (pid ${pid})`); return null; }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
  let seq = 0; const waiting = new Map();
  ws.onmessage = m => { const d = JSON.parse(m.data); waiting.get(d.id)?.(d); waiting.delete(d.id); };
  const js = expr => new Promise(ok => { const id = ++seq; waiting.set(id, d => ok(d.result?.result?.value)); ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true, awaitPromise: true } })); });
  for (let i = 0; i < 60 && !(await js(`document.readyState==='complete'&&!!document.getElementById('startBtn')`)); i++) await sleep(1000);
  await sleep(2000);
  return { js, close: () => ws.close() };
}
const storage = p => p.js(`JSON.stringify(Object.fromEntries(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)])))`).then(JSON.parse);
// Chromium writes localStorage to disk with a delay: leave the app through Home and wait before stopping it.
async function settle() { adb('shell', 'input', 'keyevent', '3'); await sleep(10000); adb('shell', 'am', 'force-stop', PKG); await sleep(1000); }
async function library(p, name) {
  await p.js(`document.getElementById('programLibraryOpen').click()`); await sleep(800);
  await p.js(`document.getElementById('programLibraryMine').click()`); await sleep(800);
  const mine = await p.js(`[...document.querySelectorAll('#programLibraryList .ft-saved-program-entry')].map(e=>e.innerText)`);
  shot(`${name}_mine`);
  await p.js(`document.getElementById('programLibraryTemplates').click()`); await sleep(800);
  const section = await p.js(`document.querySelectorAll('#programLibraryList .ft-library-folder')[1].getAttribute('aria-label')`);
  await p.js(`document.querySelectorAll('#programLibraryList .ft-library-folder')[1].click()`); await sleep(800);
  const boxing = await p.js(`[...document.querySelectorAll('#programLibraryList .ft-library-folder')].map(b=>b.getAttribute('aria-label'))`);
  shot(`${name}_boxing`);
  await p.js(`document.getElementById('programLibraryModal').hidden=true`);
  return { mine, section, boxing };
}

// 1. The old build with programs on it, like the owner's phone.
step('install_from', { out: adb('install', FROM).trim(), ...pkgInfo() });
let p = await openApp('from');
if (!p) { writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1)); process.exit(1); }
await p.js(`localStorage.setItem('fighttech.language.v1','ru');location.reload()`); p.close(); await sleep(4000);
p = await openApp('from_ru');
// «Программа 1» is saved through the UI from the «Ранее добавленные» workout «Комплекс 1»; the other two are written directly.
await p.js(`document.getElementById('programLibraryOpen').click()`); await sleep(800);
await p.js(`document.getElementById('programLibraryTemplates').click()`); await sleep(800);
await p.js(`document.querySelectorAll('#programLibraryList .ft-library-folder')[1].click()`); await sleep(800);
const fromBoxing = await p.js(`[...document.querySelectorAll('#programLibraryList .ft-library-folder')].map(b=>b.getAttribute('aria-label'))`);
await p.js(`[...document.querySelectorAll('#programLibraryList .ft-library-folder')].find(b=>/^Ранее добавленные/.test(b.getAttribute('aria-label'))).click()`); await sleep(800);
const added = await p.js(`(()=>{const c=[...document.querySelectorAll('#programLibraryList .program-library-entry')].find(e=>e.innerText.includes('Комплекс 1'));const b=c&&[...c.querySelectorAll('button')].find(b=>!b.disabled&&/plus|add/i.test(b.className+b.innerHTML));if(!b)return false;b.click();return true})()`);
await p.js(`document.getElementById('programLibraryModal').hidden=true`); await sleep(500);
await p.js(`document.getElementById('programSaveOpen').click()`); await sleep(500);
await p.js(`document.getElementById('programSaveCopy').click()`); await sleep(300);
await p.js(`document.getElementById('programNameInput').value=${JSON.stringify(NAMES[0])};document.getElementById('programSaveCreate').click()`); await sleep(800);
await p.js(`(()=>{const lib=JSON.parse(localStorage.getItem('fighttech.program.library.v1')||'[]');const prog=JSON.parse(localStorage.getItem('andar.fight.timer.program.v1')||'[]');
  lib.push({id:'owner-2',name:${JSON.stringify(NAMES[1])},entries:prog,options:{cycles:2,cycleRestSec:45}},{id:'owner-3',name:${JSON.stringify(NAMES[2])},entries:prog,options:{cycles:1,cycleRestSec:60}});
  localStorage.setItem('fighttech.program.library.v1',JSON.stringify(lib));return true})()`);
p.close(); await settle();
p = await openApp('from_reopen');
const seeded = await storage(p), before = await library(p, '01_from');
step('seeded', { added, fromBoxing, keys: Object.keys(seeded), ...before, ...pkgInfo() });
writeFileSync(`${OUT}/storage_from.json`, JSON.stringify(seeded, null, 1));
const savedNames = JSON.parse(seeded['fighttech.program.library.v1'] || '[]').map(x => x.name);
if (!added || JSON.stringify(savedNames) !== JSON.stringify(NAMES) || before.mine.length !== 3 || !KEYS.every(k => k in seeded)) fail('seeding the old build');
if (!fromBoxing?.some(l => /^Ранее добавленные, 3$/.test(l))) fail('the old build should still show «Ранее добавленные, 3»: ' + JSON.stringify(fromBoxing));
p.close(); await settle();
const first = pkgInfo().firstInstallTime;

// 2. The new Play MVP over it.
step('install_to', { out: adb('install', '-r', TO).trim(), ...pkgInfo() });
p = await openApp('to');
if (p) {
  const s = await storage(p), after = await library(p, '02_to');
  writeFileSync(`${OUT}/storage_to.json`, JSON.stringify(s, null, 1));
  const changed = Object.keys(seeded).filter(k => s[k] !== seeded[k]), missing = Object.keys(seeded).filter(k => !(k in s));
  // The saved program built from the retired workout still opens with its stage.
  await p.js(`document.getElementById('programLibraryOpen').click()`); await sleep(800);
  await p.js(`document.getElementById('programLibraryMine').click()`); await sleep(800);
  await p.js(`[...document.querySelectorAll('#programLibraryList .ft-saved-program-entry')].find(e=>e.innerText.includes(${JSON.stringify(NAMES[0])})).querySelector('.ft-saved-program-open').click()`); await sleep(1500);
  const opened = await p.js(`({program:localStorage.getItem('andar.fight.timer.program.v1'),text:document.body.innerText.includes('Комплекс 1')})`);
  shot('03_to_opened');
  const savedEntries = JSON.stringify(JSON.parse(seeded['fighttech.program.library.v1'])[0].entries);
  step('to', { changed, missing, added: Object.keys(s).filter(k => !(k in seeded)), ...after, opened: { text: opened.text, same: opened.program === savedEntries }, ...pkgInfo() });
  if (changed.length || missing.length) fail('data changed by the update: ' + JSON.stringify({ changed, missing }));
  if (after.mine.length !== 3 || !NAMES.every(n => after.mine.some(t => t.includes(n)))) fail('«Мои» after the update: ' + JSON.stringify(after.mine));
  if (after.section !== 'Бокс, 149' || after.boxing?.length !== 4 || after.boxing.some(l => /Ранее добавленные/.test(l))) fail('«Бокс» after the update: ' + JSON.stringify(after));
  if (!opened.text || opened.program !== savedEntries) fail('saved «Программа 1» does not open with its stage');
  p.close();
}
await settle();
adb('shell', 'tar', '-czf', '/sdcard/data_to.tgz', '-C', '/data/data', PKG); adb('pull', '/sdcard/data_to.tgz', `${OUT}/data_to.tgz`);
const last = pkgInfo();
step('install_history', { firstInstallTime_unchanged: last.firstInstallTime === first, ...last });
if (last.firstInstallTime !== first) fail('firstInstallTime changed: the app was reinstalled, not updated');
report.crashes.push(...crashes());
if (report.crashes.length) fail('crash in logcat');
writeFileSync(`${OUT}/logcat.txt`, adb('logcat', '-d'));
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
console.log(report.failures.length ? 'CLEAN STARTER FAIL' : 'CLEAN STARTER PASS');
process.exit(report.failures.length ? 1 : 0);
