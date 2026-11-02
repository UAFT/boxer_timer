// One code base, two builds (Phase B, 2026-11-02): the Play MVP and the methodology build differ by app/js/build-variant.js
// only. Both branches run this file; the methodology-only parts (Tree, Methodology, B01/B02/B05) are asserted per variant.
// Folds in the methodology branch's tests/runtime-parity.test.mjs (8676b65).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { BUILD_VARIANT } from '../app/js/build-variant.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const sha = data => createHash('sha256').update(data).digest('hex');
const methodology = BUILD_VARIANT === 'methodology';

test('build variant: one line of code, play or methodology; the smoke reads it, no workflow derives it from the branch', () => {
  const src = read('app/js/build-variant.js');
  assert.deepEqual(src.split('\n').filter(l => l.trim() && !l.startsWith('//')), [`export const BUILD_VARIANT = '${BUILD_VARIANT}';`]);
  assert.ok(['play', 'methodology'].includes(BUILD_VARIANT));
  assert.match(read('scripts/android_play_smoke.mjs'), /readFileSync\(new URL\('\.\.\/app\/js\/build-variant\.js', import\.meta\.url\)/);
  for (const f of ['android-signed-apk.yml', 'android-play-aab.yml']) assert.doesNotMatch(read('.github/workflows/' + f), /FT_VARIANT|&& 'play' \|\| 'methodology'/, f);
  // The Play AAB refuses to build from the methodology variant.
  assert.match(read('.github/workflows/android-play-aab.yml'), /grep -qx "export const BUILD_VARIANT = 'play';" app\/js\/build-variant\.js \|\| \{/);
});

test('methodology data are byte for byte those of the methodology branch 8676b65, in both builds', () => {
  const pinned = {
    'app/js/library/methodology-v42-data.js': 'f5c8f40c8aeafd8496e674461d2b8498c27b2bef9bc08b4bd52fc6335336ed1d',
    'app/js/library/methodology-v42-rounds.js': '9ee3885d3c6215c3e17df2bd4e8c4ac7cfd58ef8d84c8ff9bda3f98b9516c583',
    'app/js/library/methodology-v42-view.js': '277c8616c340c76c989cfb6e2cdf7cc63f97839517293ef84481a2417bb86fd9',
    'app/js/library/methodology-v63-structure.js': 'f454fd325b38ad773bf2db3f66aa1d75e59d9fcd45ccf329e7075887683e18be',
    'app/js/library/tree-preview-data.js': 'adbaa0f59daab1648788542f6ee3739b0ea71f854f6fe41916dd7e3243ee0d6f'
  };
  for (const [file, hash] of Object.entries(pinned)) assert.equal(sha(readFileSync(new URL('../' + file, import.meta.url))), hash, file);
});

test('Tree and Methodology: in the page of both builds, shown by the methodology build only, in a second tab row', () => {
  const html = read('app/index.html');
  for (const id of ['ftTreePreviewTab', 'ftMethodV42Tab']) assert.match(html, new RegExp(`id="${id}" hidden>`), id);
  const app = read('app/js/app.js');
  assert.match(app, /document\.documentElement\.dataset\.variant=BUILD_VARIANT;/);
  assert.match(app, /if\(BUILD_VARIANT==='methodology'\)for\(const id of \['ftTreePreviewTab','ftMethodV42Tab'\]\)document\.getElementById\(id\)\.hidden=false;/);
  // Owner 2026-11-02 (addendum C): the first row stays the Play row (Mine / Library / Diary / import); Tree | Methodology
  // sit under it. Only these two rules depend on the variant.
  const css = read('app/styles/methodology-v42.css');
  assert.match(css, /html\[data-variant="methodology"\] #ftTreePreviewTab\{grid-row:2;grid-column:1\/3\}/);
  assert.match(css, /html\[data-variant="methodology"\] #ftMethodV42Tab\{grid-row:2;grid-column:3\/5\}/);
  const styles = readdirSync(new URL('../app/styles/', import.meta.url)).filter(f => f.endsWith('.css')).map(f => read('app/styles/' + f));
  assert.equal(styles.join('\n').match(/data-variant/g).length, 2);
});

test('library: the methodology build has B01, B02, B05 after the warm-ups exactly as 8676b65; the Play MVP has none', async () => {
  const { LIBRARY, RETIRED_LIBRARY } = await import('../app/js/library/catalog.js');
  const drafts = LIBRARY.filter(w => RETIRED_LIBRARY.some(r => r.id === w.id));
  if (!methodology) return assert.deepEqual(drafts, []);
  assert.deepEqual(LIBRARY.slice(4, 7).map(w => w.id), ['B01', 'B02', 'B05']);
  // JSON of the three entries as the methodology branch 8676b65 builds them.
  assert.equal(sha(JSON.stringify(drafts)), 'b9076f218adf1f3fa84c8da6c9a30abb365cc9c7a7d76ee8d4db6dfe2a7fbab9');
});

test('common workflow: Android 15+ system bars, API 36, one versionCode clock for both lines, the emulator smoke', () => {
  for (const f of ['android-signed-apk.yml', 'android-play-aab.yml']) {
    const flow = read('.github/workflows/' + f);
    assert.ok(flow.includes('"adjustMarginsForEdgeToEdge":"auto"'), f);
    assert.ok(flow.includes("key+' = 36'") && flow.includes("grep -q \"targetSdkVersion:'36'\""), f);
    assert.ok(flow.includes("str(20000+(int(time.time())-1793318400)//60)"), f);
    assert.ok(flow.includes('scripts/android_play_smoke.mjs'), f);
  }
});

test('every Library string has English in both builds, Russian stays as is', async () => {
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
