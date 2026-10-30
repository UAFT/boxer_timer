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
  // No other entry point into the methodology or the tree.
  assert.equal((html.match(/Методик|Дерево/g) || []).length, 2);
});
