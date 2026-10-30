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
