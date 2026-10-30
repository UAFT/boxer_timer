import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../app/styles/methodology-v42.css', import.meta.url), 'utf8');

test('Google Play MVP: Tree and Methodology tabs are hidden, Mine/Library/import stay', () => {
  for (const id of ['ftTreePreviewTab', 'ftMethodV42Tab']) assert.match(html, new RegExp('id="' + id + '" hidden>'), id);
  for (const id of ['programLibraryMine', 'programLibraryTemplates', 'ftWorkoutImportBtn', 'programLibraryOpen'])
    assert.doesNotMatch(html, new RegExp('id="' + id + '"[^>]*hidden'), id);
  // Two visible tabs plus the import button.
  assert.ok(css.includes('.ft-library-nav{grid-template-columns:repeat(2,minmax(min-content,1fr)) 44px!important'));
  assert.ok(css.includes('@media (max-width:340px){.program-library-modal .ft-library-nav{grid-template-columns:repeat(2,minmax(0,1fr)) 44px!important'));
  // No other entry point into the methodology or the tree.
  assert.equal((html.match(/Методик|Дерево/g) || []).length, 2);
});

test('Google Play MVP: every Library string has English, Russian stays as is, no mixed words', async () => {
  globalThis.localStorage ??= { getItem() { return null; }, setItem() {} };
  const { translateText } = await import('../app/js/i18n/locale.js');
  const { LIBRARY, CATEGORIES } = await import('../app/js/library/catalog.js');
  const texts = new Set(CATEGORIES.map(c => c[1]));
  for (const w of LIBRARY) {
    for (const s of [w.name, w.folder, w.subfolder, w.note, w.equipment, w.phaseOneName, w.phaseTwoName, ...(w.tasks || [])]) if (s) texts.add(s);
    for (const r of Array.isArray(w.rounds) ? w.rounds : []) for (const s of [r.name, r.description, r.stance]) if (s) texts.add(s);
  }
  const left = [...texts].filter(s => /[А-Яа-яЁё]/.test(translateText(s, 'en')));
  assert.deepEqual(left, []);
  for (const s of texts) assert.equal(translateText(s, 'ru'), s);
  assert.equal(translateText('Работа ног', 'en'), 'Footwork');                          // not «Work ног»
  assert.equal(translateText('1. Джеб с шагом вперёд и назад', 'en'), '1. Jab with a step forward and back');
  assert.equal(translateText('Разминка, 4', 'en'), 'Warm-up, 4');
});

test('Google Play MVP: My Programs start empty, library cards hide the book methodology', () => {
  const app = readFileSync(new URL('../app/js/app.js', import.meta.url), 'utf8');
  const view = readFileSync(new URL('../app/js/ui/workout-plan-view.js', import.meta.url), 'utf8');
  assert.match(app, /let savedPrograms = \[\];/);
  assert.match(app, /if\(!savedPrograms\.length\)\{const empty=/);
  assert.match(view, /const method = null;/);
  assert.doesNotMatch(view, /'Источник'/);
});

test('Google Play MVP 2026-10-31: «Бокс» has no «Ранее добавленные», counts come from the remaining data', async () => {
  const { LIBRARY, CATEGORIES, RETIRED_LIBRARY } = await import('../app/js/library/catalog.js');
  const { libraryLevel, UNFILED } = await import('../app/js/library/library-browser.js');
  const sections = Object.fromEntries(libraryLevel(LIBRARY, CATEGORIES, {}).items.map(i => [i.key, i.count]));
  assert.deepEqual(sections, { warmup: 4, boxing: 149, two_phase: 3, interval: 4, amrap: 4, afap: 4, emom: 4, tabata: 4, cardio: 4, abs: 4, cooldown: 2 });
  const folders = libraryLevel(LIBRARY, CATEGORIES, { category: 'boxing' }).items.map(i => [i.label, i.count]);
  assert.deepEqual(folders, [['Работа на мешке', 84], ['Работа перед зеркалом / Бой с тенью', 54], ['Работа с отягощением / Физподготовка', 18], ['Круговые тренировки', 2]]);
  assert.ok(!folders.some(([label]) => label === UNFILED));
  assert.deepEqual(RETIRED_LIBRARY.map(w => w.id), ['B01', 'B02', 'B05']);
  assert.ok(!LIBRARY.some(w => RETIRED_LIBRARY.some(r => r.id === w.id)));
});

test('Google Play MVP 2026-10-31: programs already on the phone survive the update unchanged', async () => {
  const { normalizeLibrary } = await import('../app/js/core/program.js');
  const { stageTitleParts } = await import('../app/js/ui/stage-title.js');
  const { clonePreset } = await import('../app/js/state/presets.js');
  // The three programs from the owner's phone screenshot, one with a stage added earlier from the retired «Комплекс 1».
  const stage = title => ({ presetId: 'classic2', title, roundNames: [], phaseOneOverrides: [], phaseTwoOverrides: [], roundDescriptions: [],
    roundTimingOverrides: [], settings: { ...clonePreset('classic2'), rounds: 2, workSec: 60, restSec: 30 }, restAfterSec: 0 });
  const stored = [
    { id: 'p1', name: 'Программа 1', entries: [stage('Бокс — Комплекс 1')], options: { cycles: 1, cycleRestSec: 60 } },
    { id: 'p2', name: 'Сила + лёгкость', entries: [stage('Двухфазные — Сила + лёгкость')], options: { cycles: 2, cycleRestSec: 45 } },
    { id: 'p3', name: 'Тестовая', entries: [stage('Своё')], options: { cycles: 1, cycleRestSec: 60 } }
  ];
  assert.deepEqual(normalizeLibrary(JSON.parse(JSON.stringify(stored))), stored);
  assert.deepEqual(stageTitleParts('Бокс — Комплекс 1'), { category: 'Бокс', workout: 'Комплекс 1' });
  // Nothing in the app removes saved programs on start; only the user's own delete rewrites the list.
  const app = readFileSync(new URL('../app/js/app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /localStorage\.(clear|removeItem)\(/);
  assert.equal((app.match(/store\(LIBRARY_KEY/g) || []).length, 1);
});
