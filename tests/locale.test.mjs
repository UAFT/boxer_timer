import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLanguage, translateText } from '../app/js/i18n/locale.js';
test('auto follows Russian phone locale; otherwise English',()=>{
  assert.equal(resolveLanguage('auto','ru-RU'),'ru');
  assert.equal(resolveLanguage('auto','en-US'),'en');
  assert.equal(resolveLanguage('auto','hi-IN'),'en');
  assert.equal(resolveLanguage('en','ru-RU'),'en');
  assert.equal(resolveLanguage('ru','en-US'),'ru');
});
test('translates modes, stages and timer without altering numeric values',()=>{
  assert.equal(translateText('Этап 3 · Лестница · 3 раундов','en'),'Stage 3 · Ladder · 3 rounds');
  assert.equal(translateText('Раунд 1 · 01:00 · отдых 00:30','en'),'Round 1 · 01:00 · rest 00:30');
  assert.equal(translateText('Раунд 1','ru'),'Раунд 1');
});
