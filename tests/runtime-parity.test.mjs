import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The methodology build shares the Play MVP runtime fixes; its Tree, Methodology and data stay.
const html = readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const flow = readFileSync(new URL('../.github/workflows/android-signed-apk.yml', import.meta.url), 'utf8');

test('methodology build: Tree and Methodology tabs stay visible; at ≤340px the import column holds its 44px button', () => {
  const css = readFileSync(new URL('../app/styles/methodology-v42.css', import.meta.url), 'utf8');
  assert.ok(css.includes('@media (max-width:340px){.program-library-modal .ft-library-nav{grid-template-columns:repeat(4,auto) 44px!important'));
  for (const id of ['ftTreePreviewTab', 'ftMethodV42Tab', 'programLibraryMine', 'programLibraryTemplates', 'ftWorkoutImportBtn'])
    assert.doesNotMatch(html, new RegExp('id="' + id + '"[^>]*hidden'), id);
});

test('methodology APK: Android 15+ system bars, API 36, versionCode above the Play MVP 1.0.6, emulator smoke', () => {
  assert.ok(flow.includes('"adjustMarginsForEdgeToEdge":"auto"'));
  assert.ok(flow.includes("key+' = 36'") && flow.includes("grep -q \"targetSdkVersion:'36'\""));
  assert.ok(flow.includes("str(20000+(int(time.time())-1793318400)//60)"));
  assert.ok(flow.includes('FT_VARIANT: methodology') && flow.includes('scripts/android_play_smoke.mjs'));
});

test('every Library string of the unchanged methodology data has English, Russian stays as is', async () => {
  globalThis.localStorage ??= { getItem() { return null; }, setItem() {} };
  const { translateText } = await import('../app/js/i18n/locale.js');
  const { LIBRARY, CATEGORIES } = await import('../app/js/library/catalog.js');
  const texts = new Set(CATEGORIES.map(c => c[1]));
  for (const w of LIBRARY) {
    for (const s of [w.name, w.folder, w.subfolder, w.note, w.equipment, w.phaseOneName, w.phaseTwoName, ...(w.tasks || [])]) if (s) texts.add(s);
    for (const r of Array.isArray(w.rounds) ? w.rounds : []) for (const s of [r.name, r.description, r.stance]) if (s) texts.add(s);
  }
  assert.deepEqual([...texts].filter(s => /[А-Яа-яЁё]/.test(translateText(s, 'en'))), []);
  for (const s of texts) assert.equal(translateText(s, 'ru'), s);
  assert.equal(translateText('Работа ног', 'en'), 'Footwork');
});
