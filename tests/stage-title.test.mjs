import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stageTitleParts, renderStageTitle} from '../app/js/ui/stage-title.js';

function fakeDoc() {
  return {createElement(tag) {return {
    tag, className:'', textContent:'', children:[], append(child){this.children.push(child);}
  };}};
}

test('library stage is displayed as stage, category, workout without rewriting saved title',()=>{
  for(const [raw,category,workout] of [
    ['Кардио — Скакалка 3 × 3','Кардио','Скакалка 3 × 3'],
    ['Бокс — Комплекс 1','Бокс','Комплекс 1'],
    ['Основная работа — Комплекс 1','Бокс','Комплекс 1'],
    ['Основная тренировка · мешок — Комплекс 1','Бокс','Комплекс 1'],
    ['Бокс — Работа с гантелями','Бокс','Работа с гантелями']
  ]) {
    const before=raw;
    assert.deepEqual(stageTitleParts(raw),{category,workout});
    const root=renderStageTitle(fakeDoc(),2,raw);
    assert.deepEqual(root.children.map(x=>x.textContent),['Этап 2',category,workout]);
    assert.deepEqual(root.children.map(x=>x.className),['program-stage-number','program-stage-category','program-stage-workout']);
    assert.equal(raw,before,'stored label remains unchanged');
  }
});

test('user stages remain unsplit, even when containing an em dash',()=>{
  const root=renderStageTitle(fakeDoc(),3,'Мой тренер — сложная работа');
  assert.deepEqual(root.children.map(x=>x.textContent),['Этап 3','Мой тренер — сложная работа']);
  assert.deepEqual(stageTitleParts(''),stageTitleParts(''), 'deterministic lookup');
  assert.deepEqual(renderStageTitle(fakeDoc(),4,'').children.map(x=>x.textContent),['Этап 4']);
});

test('stage rendering hides ordinary only, special mode text remains unchanged',()=>{
  const app=readFileSync(new URL('../app/js/app.js',import.meta.url),'utf8');
  const html=readFileSync(new URL('../app/index.html',import.meta.url),'utf8');
  const style=readFileSync(new URL('../app/styles/stage-title.css',import.meta.url),'utf8');
  assert.ok(app.includes("cfg.intervalMode==='ladder' ? 'Лестница' : (entry.presetId==='tabata2020x24' ? 'Скоростной' : '')"));
  assert.ok(!app.includes("'Скоростной' : 'Обычный'"));
  assert.ok(app.includes('renderStageTitle(document,i+1,entry.title)'));
  assert.ok(html.includes('./styles/stage-title.css'));
  assert.ok(style.includes('.program-stage-number'));
  assert.ok(style.includes('.program-stage-category'));
  assert.ok(style.includes('.program-stage-workout'));
});
