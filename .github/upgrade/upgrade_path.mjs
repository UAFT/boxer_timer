// Upgrade path on an emulator with the exact release APKs: methodology (old) → Play MVP → methodology (new).
// Each step is `adb install -r` over the previous app, never an uninstall. User data is seeded once through the
// first app (a library workout added in the UI, a saved program, settings, language) and must survive every step.
// Release WebViews are reached through DevTools because the emulator image is debuggable (ro.debuggable=1).
// Usage: node upgrade_path.mjs <old.apk> <mvp.apk> <new.apk> <out_dir>
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const PKG = 'com.andarfighttech.boxertimer';
const [OLD, MVP, NEW, OUT] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const adb = (...a) => { try { return execFileSync('adb', a, { encoding: 'utf8', maxBuffer: 64 << 20 }); } catch (e) { return String(e.stdout || '') + String(e.stderr || ''); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const report = { device: {}, steps: [], failures: [], crashes: [] };
const step = (name, data = {}) => { report.steps.push({ step: name, ...data }); console.log(name, JSON.stringify(data)); };
const fail = msg => { report.failures.push(msg); console.log('FAIL', msg); };
const shot = name => writeFileSync(`${OUT}/${name}.png`, execFileSync('adb', ['exec-out', 'screencap', '-p'], { maxBuffer: 64 << 20 }));
const launch = () => adb('shell', 'am', 'start', '-W', '-n', `${PKG}/.MainActivity`);
const crashes = () => adb('logcat', '-d').split('\n').filter(l => l.includes('FATAL EXCEPTION') || (l.includes('AndroidRuntime') && l.includes(PKG)));
const pkgInfo = () => { const d = adb('shell', 'dumpsys', 'package', PKG); const g = re => (d.match(re) || [])[1];
  return { versionCode: g(/versionCode=(\d+)/), versionName: g(/versionName=(\S+)/), firstInstallTime: g(/firstInstallTime=([^\n]+)/), lastUpdateTime: g(/lastUpdateTime=([^\n]+)/) }; };
const SEED_NAME = 'Проверка обновления';
const SEEDED = ['andar.fight.timer.program.v1', 'fighttech.program.library.v1', 'fighttech.program.options.v1', 'andar.fight.timer.settings.v11', 'andar.fight.timer.profiles.v1', 'fighttech.language.v1'];

adb('root'); await sleep(3000); adb('wait-for-device');
report.device = { build_type: adb('shell', 'getprop', 'ro.build.type').trim(), debuggable: adb('shell', 'getprop', 'ro.debuggable').trim(), sdk: adb('shell', 'getprop', 'ro.build.version.sdk').trim() };
step('device', report.device);

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
  if (!target) { fail(`${name}: no WebView DevTools socket (pid ${pid})`); writeFileSync(`${OUT}/unix_${name}.txt`, adb('shell', 'cat', '/proc/net/unix')); return null; }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
  let seq = 0; const waiting = new Map();
  ws.onmessage = m => { const d = JSON.parse(m.data); waiting.get(d.id)?.(d); waiting.delete(d.id); };
  const js = expr => new Promise(ok => { const id = ++seq; waiting.set(id, d => ok(d.result?.result?.value)); ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true, awaitPromise: true } })); });
  const ready = async () => { for (let i = 0; i < 60 && !(await js(`document.readyState==='complete'&&!!document.getElementById('startBtn')`)); i++) await sleep(1000); await sleep(2000); };
  await ready();
  return { js, ready, close: () => ws.close() };
}
const storage = p => p.js(`JSON.stringify(Object.fromEntries(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)])))`).then(JSON.parse);
const ui = p => p.js(`({lang:document.documentElement.lang,start:document.getElementById('startBtn').textContent.trim(),main:document.getElementById('mainTime').textContent,round:document.getElementById('roundLabel').textContent})`);
async function mine(p, name) {
  await p.js(`document.getElementById('programLibraryOpen').click()`); await sleep(800);
  await p.js(`document.getElementById('programLibraryMine').click()`); await sleep(800);
  const r = await p.js(`({hasSeed:document.getElementById('programLibraryList').innerText.includes(${JSON.stringify(SEED_NAME)}),
    tree:!!document.getElementById('ftTreePreviewTab')?.offsetParent,methodology:!!document.getElementById('ftMethodV42Tab')?.offsetParent})`);
  shot(name);
  await p.js(`document.getElementById('programLibraryModal').hidden=true`);
  return r;
}
function backup(name) {
  adb('shell', 'am', 'force-stop', PKG);
  adb('shell', 'tar', '-czf', `/sdcard/${name}.tgz`, '-C', '/data/data', PKG);
  adb('pull', `/sdcard/${name}.tgz`, `${OUT}/${name}.tgz`);
}

// 1. Old methodology build, fresh install, data seeded.
step('install_old', { out: adb('install', OLD).trim(), ...pkgInfo() });
let p = await openApp('old');
if (!p) { writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1)); process.exit(1); }
await p.js(`document.getElementById('programLibraryOpen').click()`); await sleep(800);
await p.js(`document.getElementById('programLibraryTemplates').click()`); await sleep(800);
await p.js(`document.querySelector('#programLibraryList .ft-library-folder').click()`); await sleep(600);
const added = await p.js(`(()=>{const b=[...document.querySelectorAll('#programLibraryList button')].find(b=>!b.disabled&&/plus|add/i.test(b.className+b.innerHTML));if(!b)return false;b.click();return true})()`);
await p.js(`document.getElementById('programLibraryModal').hidden=true`); await sleep(500);
await p.js(`(()=>{const prog=JSON.parse(localStorage.getItem('andar.fight.timer.program.v1')||'[]');
  localStorage.setItem('fighttech.program.library.v1',JSON.stringify([{id:'upgrade-check-1',name:${JSON.stringify(SEED_NAME)},entries:prog,options:{cycles:2,cycleRestSec:45}}]));
  localStorage.setItem('fighttech.program.options.v1',JSON.stringify({cycles:3,cycleRestSec:30}));
  const s=JSON.parse(localStorage.getItem('andar.fight.timer.settings.v11')||'{}');
  localStorage.setItem('andar.fight.timer.settings.v11',JSON.stringify({...s,rounds:7,workSec:150,restSec:45}));
  localStorage.setItem('fighttech.language.v1','en');return true})()`);
p.close(); adb('shell', 'am', 'force-stop', PKG); await sleep(1000);
p = await openApp('old_reopen');
const seeded = await storage(p), uiOld = await ui(p), mineOld = await mine(p, '01_old_mine');
step('seeded_old', { added, keys: Object.keys(seeded), ui: uiOld, mine: mineOld, ...pkgInfo() });
writeFileSync(`${OUT}/storage_old.json`, JSON.stringify(seeded, null, 1));
if (!added || !mineOld.hasSeed || !mineOld.tree || !mineOld.methodology || uiOld.lang !== 'en') fail('seeding in the old methodology build');
p.close(); backup('data_1_old');
const first = pkgInfo().firstInstallTime;

// Same keys, same values; a later build may add keys of its own (for example the Play MVP billing record).
const compare = (name, s) => {
  const changed = Object.keys(seeded).filter(k => s[k] !== seeded[k]);
  const missing = SEEDED.filter(k => k in seeded && !(k in s));
  const added = Object.keys(s).filter(k => !(k in seeded));
  writeFileSync(`${OUT}/storage_${name}.json`, JSON.stringify(s, null, 1));
  return { changed, missing, added };
};

// 2. Play MVP over it.
step('install_mvp', { out: adb('install', '-r', MVP).trim(), ...pkgInfo() });
p = await openApp('mvp');
if (p) {
  const d = compare('mvp', await storage(p)), u = await ui(p), m = await mine(p, '02_mvp_mine');
  step('mvp', { diff: d, ui: u, mine: m, ...pkgInfo() });
  if (d.changed.length || d.missing.length || !m.hasSeed || m.tree || m.methodology || u.lang !== 'en' || u.main !== uiOld.main) fail('data or variant after the Play MVP upgrade');
  p.close();
}
backup('data_2_mvp');

// 3. The old methodology build cannot go back over the MVP: Android refuses a lower versionCode and keeps the app.
const down = adb('install', '-r', OLD).trim();
step('downgrade_old_over_mvp', { out: down, ...pkgInfo() });
if (!/INSTALL_FAILED_VERSION_DOWNGRADE/.test(down)) fail('old methodology APK was not refused over the MVP');

// 4. New methodology build over the MVP.
step('install_new', { out: adb('install', '-r', NEW).trim(), ...pkgInfo() });
p = await openApp('new');
if (p) {
  const d = compare('new', await storage(p)), u = await ui(p), m = await mine(p, '03_new_mine');
  await p.js(`document.getElementById('programLibraryOpen').click()`); await sleep(800);
  await p.js(`document.getElementById('ftMethodV42Tab').click()`); await sleep(1200);
  const meth = await p.js(`({items:document.getElementById('programLibraryList').children.length,text:document.getElementById('programLibraryList').innerText.length})`);
  shot('04_new_methodology');
  step('new', { diff: d, ui: u, mine: m, methodology: meth, ...pkgInfo() });
  if (d.changed.length || d.missing.length || !m.hasSeed || !m.tree || !m.methodology || !(meth?.items > 0) || u.lang !== 'en' || u.main !== uiOld.main) fail('data or variant after returning to the methodology build');
  p.close();
}
backup('data_3_new');
const last = pkgInfo();
step('install_history', { firstInstallTime_unchanged: last.firstInstallTime === first, ...last });
if (last.firstInstallTime !== first) fail('firstInstallTime changed: the app was reinstalled, not updated');

report.crashes.push(...crashes());
if (report.crashes.length) fail('crash in logcat');
writeFileSync(`${OUT}/logcat.txt`, adb('logcat', '-d'));
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
console.log(report.failures.length ? 'UPGRADE FAIL' : 'UPGRADE PASS');
process.exit(report.failures.length ? 1 : 0);
