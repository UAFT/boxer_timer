// Play release closeout (2026-11-02): fixes for the release audit 0.2.213 findings. On-device evidence: the emulator
// smoke and scripts/android_storage_check.mjs in CI (Android 10/11/13/16); project evidence PLAY_CLOSEOUT_METHODOLOGY_PARITY__20261102.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { serializeDiaryFile, parseDiaryFile } from '../app/js/diary/diary-file.js';
import { normalizeProgram } from '../app/js/core/program.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const PLUGIN = 'native/ft-billing/android/src/main/';

test('Android 6–10 «Сохранить в файл»: storage permissions only up to API 29, legacy storage for Android 10', () => {
  const manifest = read(PLUGIN + 'AndroidManifest.xml');
  for (const p of ['READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE'])
    assert.match(manifest, new RegExp(`<uses-permission android:name="android\\.permission\\.${p}" android:maxSdkVersion="29" />`), p);
  assert.doesNotMatch(manifest, /MANAGE_EXTERNAL_STORAGE|READ_MEDIA_/, 'no broad or media storage access');
  assert.match(manifest, /android:requestLegacyExternalStorage="true"/);
  // The app writes exactly here (Documents/Fight Tech), the path the permissions are for.
  assert.match(read('app/js/sharing/file-transfer.js'), /path:'Fight Tech\/'\+name,data:utf8Base64\(data\),directory:'DOCUMENTS'/);
});

test('Auto Backup stays on with explicit rules: the diaries and localStorage only, the same for Android ≤11 and 12+', () => {
  const manifest = read(PLUGIN + 'AndroidManifest.xml');
  assert.match(manifest, /android:fullBackupContent="@xml\/ft_backup_rules"/);
  assert.match(manifest, /android:dataExtractionRules="@xml\/ft_data_extraction_rules"/);
  assert.doesNotMatch(manifest, /allowBackup/, 'the app manifest keeps allowBackup="true" (owner: backup stays on)');
  const includes = xml => [...xml.matchAll(/<include domain="([a-z_]+)" path="([^"]+)" \/>/g)].map(m => m[1] + ':' + m[2]);
  const expected = ['file:.', 'root:app_webview/Default/Local Storage/', 'root:app_webview/Local Storage/'];
  const old = read(PLUGIN + 'res/xml/ft_backup_rules.xml');
  assert.deepEqual(includes(old), expected);
  const rules = read(PLUGIN + 'res/xml/ft_data_extraction_rules.xml');
  for (const section of ['cloud-backup', 'device-transfer']) {
    const body = rules.match(new RegExp(`<${section}>([\\s\\S]*?)</${section}>`))?.[1];
    assert.deepEqual(includes(body || ''), expected, section);
  }
  // Nothing limits when a backup is made (no requireFlags / encryption condition): the owner wants the diary to survive.
  assert.doesNotMatch(old + rules, /<exclude|requireFlags|disableIfNoEncryptionCapabilities/);
  // The diaries are files in the app's data folder (Directory.DATA = files/), the domain "file" above.
  assert.match(read('app/js/diary/store.js'), /directory: 'DATA', encoding: 'utf8', data: text/);
});

test('WebView usage statistics are not sent to Google', () => {
  assert.match(read(PLUGIN + 'AndroidManifest.xml'), /<meta-data android:name="android\.webkit\.WebView\.MetricsOptOut" android:value="true" \/>/);
});

test('diary import: a date must be a real calendar day of 1970–2199 (2026-13-45, 2026-02-30, 0000, 9999 refused)', () => {
  const settings = { intervalMode: 'standard', rounds: 2, workSec: 30, restSec: 10 };
  const snap = { name: 'План', entries: normalizeProgram([{ presetId: 'classic1', title: 'Этап', settings, restAfterSec: 0 }]), options: { cycles: 1, cycleRestSec: 60 } };
  const file = date => serializeDiaryFile({ name: 'Т', snapshots: { p: snap }, sessions: [{ id: 's', date, status: 'planned', planRef: 'p', createdAt: 1, updatedAt: 1 }] });
  const code = date => { try { parseDiaryFile(file(date)); return 'ok'; } catch (e) { return e.code ?? e.message; } };
  for (const ok of ['2026-11-02', '2024-02-29', '1970-01-01', '2199-12-31']) assert.equal(code(ok), 'ok', ok);
  for (const bad of ['2026-13-45', '2026-02-30', '2025-02-29', '2026-00-10', '1969-12-31', '2200-01-01', '0000-01-01', '9999-12-31'])
    assert.equal(code(bad), 'invalid', bad);
});

test('outside the Android app (no Play billing plugin) the entitlement server is never contacted', () => {
  const app = read('app/js/app.js');
  assert.match(app, /const offline = \(\) => Promise\.reject\(new TypeError\('no billing outside the Android app'\)\);/);
  assert.match(app, /createBillingAccess\(\{ plugin, appVersion: 'play-mvp', fetch: plugin \? undefined : offline \}\)/);
});

test('privacy policy: a link in Settings (RU + EN) to the address given to Google Play; it opens outside the app', async () => {
  const html = read('app/index.html');
  const link = html.match(/<a class="ft-privacy-link" id="ftPrivacyLink" href="([^"]+)" target="_blank" rel="noopener">([^<]+)<\/a>/);
  assert.ok(link, 'link present');
  assert.equal(link[1], 'https://andarfighttech.com/fight-tech/privacy-policy.html');
  assert.equal(link[2], 'Политика конфиденциальности');
  const settings = html.slice(html.indexOf('id="settingsModal"'), html.indexOf('id="ftBackHint"'));
  // In Settings, right before Subscription, which stays the last section (owner, 2026-11-01; billing-ui.test.mjs).
  const privacy = settings.indexOf('id="ftPrivacyLink"'), subscription = settings.indexOf('id="ftSubscriptionCard"');
  assert.ok(privacy > 0 && subscription > privacy && settings.slice(privacy, subscription).split('<section').length === 2, 'just before Subscription');
  globalThis.localStorage ??= { getItem() { return null; }, setItem() {} };
  const { translateText } = await import('../app/js/i18n/locale.js');
  assert.equal(translateText('Политика конфиденциальности', 'en'), 'Privacy Policy');
  assert.equal(translateText('Конфиденциальность', 'en'), 'Privacy');
  assert.ok(existsSync(new URL('../app/styles/fight-tech-ui-kit.css', import.meta.url)) && /\.ft-privacy-link\{[^}]*min-height:var\(--ft-touch-target\)/.test(read('app/styles/fight-tech-ui-kit.css')));
});

// Owner 2026-11-02 (device screenshots): English «Single straights» → stage editor showed «Бокс — Одиночные прямые»,
// round 1 «Jab» → pencil → «Exercise name» held «Джеб». Library text is stored in Russian; editors now show it as the
// cards do and give the stored text back when left unchanged.
const ui = async () => {
  globalThis.localStorage ??= { getItem() { return null; }, setItem() {} };
  return { ...(await import('../app/js/i18n/locale.js')), ...(await import('../app/js/library/native-adapter.js')),
    ...(await import('../app/js/library/catalog.js')), ...(await import('../app/js/core/starter-programs.js')) };
};
const cyrillic = /[А-Яа-яЁё]/;

test('EN inventory: every name, round, phase and description a library workout puts into a stage is English', async () => {
  const { wholeTranslation, stageForWorkout, LIBRARY, RETIRED_LIBRARY, starterPrograms } = await ui();
  const texts = new Set();
  const add = s => { if (s) texts.add(s); };
  // RETIRED_LIBRARY: «Ранее добавленные», gone from the Play library but still inside programs saved from it earlier.
  for (const w of [...LIBRARY, ...RETIRED_LIBRARY]) {
    const stage = stageForWorkout(w);
    assert.ok(stage, w.id);
    add(stage.title); add(stage.settings?.phaseOneName); add(stage.settings?.phaseTwoName);
    for (const key of ['roundNames', 'roundDescriptions', 'phaseOneOverrides', 'phaseTwoOverrides']) (stage[key] || []).forEach(add);
  }
  // The 2026-10-20 starter programs are no longer put into «Мои», but copies of them stay on phones that had them.
  for (const p of starterPrograms) { add(p.name); for (const e of p.entries) { add(e.title); (e.roundNames || []).forEach(add); (e.roundDescriptions || []).forEach(add); } }
  assert.ok(texts.size > 1000, 'inventory size ' + texts.size);
  assert.deepEqual([...texts].filter(s => cyrillic.test(wholeTranslation(s, 'en'))), []);
  for (const s of texts) assert.equal(wholeTranslation(s, 'ru'), s);
});

test('EN editors: Single straights → stage name «Boxing — Single straights», round 1 «Jab»; unchanged save keeps the Russian', async () => {
  const { showEditable, editedText, stageForWorkout, LIBRARY } = await ui();
  const stage = stageForWorkout(LIBRARY.find(w => w.id === 'BOX-001'));
  assert.equal(stage.title, 'Бокс — Одиночные прямые');
  assert.equal(stage.roundNames[0], 'Джеб');
  const field = () => ({ value: '' });
  const title = field(), round = field(), description = field();
  showEditable(title, stage.title, 'en'); showEditable(round, stage.roundNames[0], 'en'); showEditable(description, stage.roundDescriptions[0], 'en');
  assert.equal(title.value, 'Boxing — Single straights');
  assert.equal(round.value, 'Jab');
  assert.ok(description.value && !cyrillic.test(description.value), description.value);
  // Saved as shown: the stored library text stays Russian, so the Russian screen still shows «Джеб».
  assert.equal(editedText(title), 'Бокс — Одиночные прямые');
  assert.equal(editedText(round), 'Джеб');
  assert.equal(editedText(description), stage.roundDescriptions[0]);
  // The user's own edit is kept exactly as typed, in either language, and shown as typed afterwards.
  round.value = 'Jab twice'; assert.equal(editedText(round), 'Jab twice');
  showEditable(round, 'Jab twice', 'ru'); assert.equal(round.value, 'Jab twice');
  showEditable(round, 'Джеб — мой вариант', 'en'); assert.equal(round.value, 'Джеб — мой вариант', 'never half-translated');
  showEditable(round, 'Джеб', 'ru'); assert.equal(round.value, 'Джеб');
  // A field never opened through showEditable reads as is.
  assert.equal(editedText({ value: 'x' }), 'x');
});

test('EN editors: every name/description field opens through showEditable and saves through editedText', () => {
  const app = read('app/js/app.js'), phases = read('app/js/ui/two-phase-editor.js');
  assert.match(app, /showEditable\(input,stage\[field\]\?\.\[roundIndex\]\|\|''\);/);
  assert.match(app, /values\[ctx\.roundIndex\]=editedText\(input\)\.trim\(\)/);
  assert.match(app, /showEditable\(id\('Name'\),entry\.title\|\|''\);/);
  assert.match(app, /entry\.title=editedText\(id\('Name'\)\)\.trim\(\)/);
  assert.match(app, /showEditable\(nameInput,src\.name\|\|''\);/);
  assert.match(app, /const name=editedText\(nameInput\)\.trim\(\)\.slice\(0,MAX_TITLE\)/);
  assert.match(app, /collisionAck===editedText\(nameInput\)\.trim\(\)/);
  for (const id of ['stageSettingsPhaseOne', 'stageSettingsPhaseTwo', 'roundEditPhaseOne', 'roundEditPhaseTwo']) assert.match(phases, new RegExp(`showEditable\\([^)]*'${id}'\\)`), id);
  assert.equal((phases.match(/editedText\(/g) || []).length, 3);
  // No other field is filled straight from stored names or descriptions.
  assert.doesNotMatch(app + phases, /\.value=(stage|entry|src|cfg)\b[^;]*(title|name|Names|Descriptions|Overrides)/i);
});
