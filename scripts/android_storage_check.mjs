// Android 10–16 storage check for the debug APK (release audit 0.2.213: R6 save-to-file on Android ≤ 10, R7 backup rules).
// 1. «Сохранить в файл»: the Filesystem plugin writes Documents/Fight Tech/<file>; on Android 6–10 the system asks for the
//    storage permission first (tapped «Allow» here). The bytes on shared storage must be the bytes written.
// 2. Auto Backup with the app's own rules: a diary file and a localStorage key are backed up to the local transport, the
//    app is uninstalled and installed again, and both come back. The backup must hold nothing but files/ and the
//    WebView's localStorage.
// The plugin is called through Capacitor's native bridge, not the app's UI: the API 29/30 emulator images ship
// WebView 74/83, too old for the app itself (it needs WebView 98+, kept current by Google Play on real phones).
// Usage: node scripts/android_storage_check.mjs <debug.apk> <out_dir>
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const PKG = 'com.andarfighttech.boxertimer';
const [APK, OUT] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const adb = (...a) => { try { return execFileSync('adb', a, { encoding: 'utf8', maxBuffer: 64 << 20 }); } catch (e) { return String(e.stdout || '') + String(e.stderr || ''); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const report = { api: +adb('shell', 'getprop', 'ro.build.version.sdk').trim(), steps: [], failures: [] };
const step = (name, data = {}) => { report.steps.push({ step: name, ...data }); console.log(name, JSON.stringify(data)); };
const fail = msg => { report.failures.push(msg); console.log('FAIL', msg); };
const shot = name => writeFileSync(`${OUT}/${name}.png`, execFileSync('adb', ['exec-out', 'screencap', '-p'], { maxBuffer: 64 << 20 }));
const sha = s => createHash('sha256').update(s).digest('hex');

adb('root'); await sleep(3000); adb('wait-for-device');
// No test run writes device records into the production entitlement server (R13): the app's UID gets no network.
const isolate = () => {
  const uid = (adb('shell', 'pm', 'list', 'packages', '-U', PKG).match(/uid:(\d+)/) || [])[1];
  if (uid) for (const t of ['iptables', 'ip6tables']) { adb('shell', t, '-D', 'OUTPUT', '-m', 'owner', '--uid-owner', uid, '-j', 'REJECT'); adb('shell', t, '-I', 'OUTPUT', '-m', 'owner', '--uid-owner', uid, '-j', 'REJECT'); }
  return uid;
};
// A DevTools session on the app's WebView; js(expr) evaluates in the page, awaiting a returned promise.
async function connect() {
  adb('shell', 'am', 'start', '-W', '-n', `${PKG}/.MainActivity`);
  let target = null;
  for (let i = 0; i < 40 && !target; i++) {
    await sleep(1500);
    const pid = adb('shell', 'pidof', PKG).trim();
    if (!pid) continue;
    adb('forward', 'tcp:9333', `localabstract:webview_devtools_remote_${pid}`);
    try { target = (await (await fetch('http://127.0.0.1:9333/json')).json()).find(t => t.type === 'page'); } catch {}
  }
  if (!target) throw new Error('no WebView DevTools target');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
  let seq = 0; const waiting = new Map();
  ws.onmessage = m => { const d = JSON.parse(m.data); waiting.get(d.id)?.(d); waiting.delete(d.id); };
  const js = expr => new Promise(ok => { const id = ++seq; const t = setTimeout(() => ok({ timeout: true }), 90000);
    waiting.set(id, d => { clearTimeout(t); ok(d.result?.exceptionDetails ? { error: d.result.exceptionDetails.exception?.description || d.result.exceptionDetails.text } : d.result?.result?.value); });
    ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true, awaitPromise: true } })); });
  for (let i = 0; i < 30 && !(await js(`typeof Capacitor==='object'&&typeof Capacitor.nativePromise==='function'`)); i++) await sleep(1000);
  return { js, close: () => ws.close() };
}
const call = (method, options) => `Capacitor.nativePromise('Filesystem',${JSON.stringify(method)},${JSON.stringify(options)}).then(r=>({ok:true,r}),e=>({ok:false,error:String(e&&(e.message||e.code)||e)}))`;
// The system permission dialog (Android 6–10): «Allow» is tapped while the plugin call waits for it.
const allowButton = () => {
  adb('shell', 'uiautomator', 'dump', '/sdcard/ui.xml');
  const node = [...adb('shell', 'cat', '/sdcard/ui.xml').matchAll(/<node [^>]*>/g)].map(m => m[0])
    .find(n => /permission_allow_button|resource-id="android:id\/button1"/.test(n) || /text="(Allow|ALLOW|Разрешить|РАЗРЕШИТЬ)"/.test(n));
  const b = node && /bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(node);
  return b ? [(+b[1] + +b[3]) >> 1, (+b[2] + +b[4]) >> 1] : null;
};
async function withPermission(js, expr, screenshot) {
  const pending = js(expr);
  let tapped = null;
  for (let i = 0; i < 8 && !tapped && report.api <= 29; i++) {
    await sleep(1500);
    const xy = allowButton();
    if (xy) { if (screenshot) shot(screenshot); adb('shell', 'input', 'tap', String(xy[0]), String(xy[1])); tapped = xy; }
  }
  return { result: await pending, tapped };
}
const FILE = 'Fight Tech/storage-check.ftdiary';
const SHARED = '/sdcard/Documents/' + FILE;
const text = JSON.stringify({ format: 'fighttech.diary', check: 'storage', api: report.api, at: new Date().toISOString(), ru: 'Мой дневник' });
const b64 = Buffer.from(text, 'utf8').toString('base64');
const TOKEN = 'storage-check-' + Date.now();
const DIARY = JSON.stringify({ schema: 1, seq: 1, sessions: [], snapshots: {}, token: TOKEN });

adb('uninstall', PKG); adb('install', '-t', APK);
const uid = isolate();
const app = await connect();
step('installed', { uid, webview: adb('shell', 'dumpsys', 'webviewupdate').match(/Current WebView package \(name, version\): \(([^)]+)\)/)?.[1] });

// 1. Save to Documents/Fight Tech (what «Сохранить в файл» calls).
const { result: written, tapped: allow } = await withPermission(app.js, call('writeFile', { path: FILE, data: b64, directory: 'DOCUMENTS', recursive: true }), '01_permission_dialog');
const onDisk = adb('shell', `sha256sum '${SHARED}' 2>/dev/null`).trim().split(/\s+/)[0] || null;
const readBack = await app.js(call('readFile', { path: FILE, directory: 'DOCUMENTS', encoding: 'utf8' }));
const perms = adb('shell', 'dumpsys', 'package', PKG).split('\n').filter(l => /EXTERNAL_STORAGE|requestLegacy|LEGACY_STORAGE/.test(l)).map(l => l.trim());
step('save_to_documents', { allowTapped: allow, written, sharedSha: onDisk, expectedSha: sha(text), readBackSame: readBack?.r?.data === text, permissions: perms });
if (!(written?.ok && onDisk === sha(text) && readBack?.r?.data === text)) fail('save to Documents/Fight Tech failed: ' + JSON.stringify({ written, onDisk }));
if (report.api <= 29 && !allow) fail('Android ≤ 10: no storage permission dialog was shown');

// 2. Backup → uninstall → install → restore.
const seeded = await app.js(`(async()=>{localStorage.setItem('fighttech.storage-check',${JSON.stringify(TOKEN)});
  const w=await ${call('writeFile', { path: 'fighttech-diary-a.json', data: DIARY, directory: 'DATA', encoding: 'utf8' })};return {w,ls:localStorage.getItem('fighttech.storage-check')}})()`);
app.close();
// WebView commits localStorage to disk (LevelDB) a few seconds after a write: wait for the token itself, then leave the
// app in the background. No force-stop: Android does not back up a stopped app («Backup is not allowed»).
let lsOnDisk = false;
for (let i = 0; i < 20 && !lsOnDisk; i++) { await sleep(1500); lsOnDisk = adb('shell', `grep -rl '${TOKEN}' /data/data/${PKG}/app_webview 2>/dev/null`).trim() !== ''; }
adb('shell', 'input', 'keyevent', 'KEYCODE_HOME'); await sleep(1000);
const dataFiles = adb('shell', `find /data/data/${PKG} -type f 2>/dev/null`).split('\n').map(s => s.trim().replace(`/data/data/${PKG}/`, '')).filter(Boolean).sort();
writeFileSync(`${OUT}/data_files_before_backup.txt`, dataFiles.join('\n') + '\n');
adb('shell', 'bmgr', 'enable', 'true');
const transport = adb('shell', 'bmgr', 'transport', 'com.android.localtransport/.LocalTransport').trim();
// One backup at a time: while Android's own pass runs (it starts once backup is enabled), a requested one is skipped
// («Skipping backup since one is already in progress» → «Transport error»): try again.
const backedUp = new RegExp(`Package ${PKG.replace(/\./g, '\\.')} with result: Success`);
let backup = '', attempts = 0;
while (attempts < 8 && !backedUp.test(backup)) { if (attempts++) await sleep(10000); backup = adb('shell', 'bmgr', 'backupnow', PKG).trim(); }
// The local transport keeps the archive in /data/cache/backup (older Android) or in its own app folder (newer).
const findFull = roots => adb('shell', `find ${roots} -path '*_full*' -name '${PKG}' 2>/dev/null`).trim().split('\n')[0];
const fullPath = findFull('/data/cache/backup /data/data/com.android.localtransport /data/user_de/0/com.android.localtransport') || findFull('/data -xdev');
let entries = [];
if (fullPath) {
  execFileSync('adb', ['pull', fullPath, `${OUT}/backup_full.tar`]);
  // Android writes the archive as a tar stream; read it as one, keeping whatever was read before an error.
  entries = execFileSync('python3', ['-c', 'import sys,tarfile\nn=[]\ntry:\n  t=tarfile.open(sys.argv[1],"r|")\n  for m in t: n.append(m.name)\nexcept Exception as e: n.append("#error "+str(e))\nprint("\\n".join(n))', `${OUT}/backup_full.tar`], { encoding: 'utf8' }).split('\n').filter(Boolean);
}
writeFileSync(`${OUT}/backup_entries.txt`, entries.join('\n') + '\n');
const appEntries = entries.filter(e => !/^apps\/[^/]+\/_(manifest|meta)$/.test(e) && !e.startsWith('#error'));
// Everything under files/ and the two localStorage folders, plus the folders leading to them; nothing else.
const allowed = ['f/', 'r/app_webview/Default/Local Storage/', 'r/app_webview/Local Storage/'].map(x => `apps/${PKG}/` + x);
const outside = appEntries.filter(e => !allowed.some(a => e.startsWith(a) || a.startsWith(e.replace(/\/?$/, '/'))));
step('backup', { seeded, lsOnDisk, transport, attempts, backup, fullPath, entries: entries.length, diary: entries.some(e => e.endsWith('/f/fighttech-diary-a.json')), localStorage: entries.some(e => /\/r\/app_webview\/(Default\/)?Local Storage\//.test(e)), outside });
if (!backedUp.test(backup) || !fullPath) fail('backupnow did not succeed: ' + backup);
if (!entries.some(e => e.endsWith('/f/fighttech-diary-a.json')) || !entries.some(e => /\/r\/app_webview\/(Default\/)?Local Storage\//.test(e))) fail('backup misses the diary file or localStorage');
if (outside.length) fail('backup holds more than the diaries and localStorage: ' + outside.slice(0, 10).join(', '));

adb('shell', 'pm', 'uninstall', '--user', '0', PKG);
const gone = adb('shell', `ls /data/data/${PKG} 2>&1`).trim();
// A moment after the uninstall MediaProvider leaves the app's file in Documents to no one (owner_package_name NULL); a
// reinstall before that would still own it. Waited for, so the resave below meets a file of an earlier installation.
const owner = () => adb('shell', `content query --uri content://media/external/file --projection owner_package_name --where "_display_name='storage-check.ftdiary'"`).trim();
let orphan = owner();
for (let i = 0; i < 20 && orphan.includes('owner_package_name=' + PKG); i++) { await sleep(1500); orphan = owner(); }
const reinstalled = adb('install', '-t', APK).trim().split('\n').pop();
isolate();
await sleep(5000); // the install-time restore
const again = await connect();
const restored = await again.js(`(async()=>({ls:localStorage.getItem('fighttech.storage-check'),diary:await ${call('readFile', { path: 'fighttech-diary-a.json', directory: 'DATA', encoding: 'utf8' })}}))()`);
step('restore', { gone, orphan, reinstalled, restored: { ls: restored?.ls, diarySame: restored?.diary?.r?.data === DIARY } });
if (!(restored?.ls === TOKEN && restored?.diary?.r?.data === DIARY)) fail('restore after reinstall lost data: ' + JSON.stringify(restored));

// After a reinstall the earlier file in Documents belongs to the previous installation (Android 11+): the plugin may not
// overwrite it (recorded), and the app's own «Сохранить в файл» then saves the copy under a new name. Asserted where the
// app's code loads (Android 11+); the API 29 image's WebView 74 cannot run it.
const resave = await withPermission(again.js, call('writeFile', { path: FILE, data: b64, directory: 'DOCUMENTS', recursive: true }));
const appSave = await again.js(`import('/js/sharing/file-transfer.js').then(m=>m.saveFile({data:${JSON.stringify(text)},name:'storage-check.ftdiary'}))
  .then(path=>({ok:true,path}),e=>({ok:false,error:String(e&&e.message||e)}))`);
const appSaveSha = appSave?.ok ? adb('shell', `sha256sum '/sdcard/${appSave.path}' 2>/dev/null`).trim().split(/\s+/)[0] || null : null;
step('resave_after_reinstall', { plugin: resave, app: appSave, newName: appSave?.path !== 'Documents/' + FILE, appSaveSame: appSaveSha === sha(text) });
if (report.api >= 30 && !(appSave?.ok && appSaveSha === sha(text))) fail('«Сохранить в файл» after a reinstall failed: ' + JSON.stringify(appSave));
again.close();

writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
writeFileSync(`${OUT}/logcat.txt`, adb('logcat', '-d'));
console.log(report.failures.length ? 'STORAGE FAIL' : 'STORAGE PASS');
process.exit(report.failures.length ? 1 : 0);
