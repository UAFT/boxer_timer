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
    assert.deepEqual(root.children.map(x=>x.textContent),['Этап 2 — Обычный',category,workout]);
    assert.deepEqual(root.children.map(x=>x.className),['program-stage-number','program-stage-category','program-stage-workout']);
    assert.equal(raw,before,'stored label remains unchanged');
  }
});

test('user stages remain unsplit, even when containing an em dash',()=>{
  const root=renderStageTitle(fakeDoc(),3,'Мой тренер — сложная работа');
  assert.deepEqual(root.children.map(x=>x.textContent),['Этап 3 — Обычный','Мой тренер — сложная работа']);
  assert.deepEqual(stageTitleParts(''),stageTitleParts(''), 'deterministic lookup');
  assert.deepEqual(renderStageTitle(fakeDoc(),4,'').children.map(x=>x.textContent),['Этап 4 — Обычный']);
});

test('editor always shows canonical mode before title, no stray mode label beneath',()=>{
  const app=readFileSync(new URL('../app/js/app.js',import.meta.url),'utf8');
  const style=readFileSync(new URL('../app/styles/fight-tech-ui-kit.css',import.meta.url),'utf8');
  assert.match(app,/renderStageTitle\(document,i\+1,entry.title,\{config:/);
  assert.doesNotMatch(app,/kind\.textContent=/);
  assert.match(style,/\.program-stage-card>\.program-stage>\.program-stage-main\{/);
  assert.match(style,/display:flex!important/);
  assert.match(style,/white-space:nowrap!important/);
});


test('ladder stage shows mode beside stage index without duplicating a bare ladder title',()=>{
 const doc=fakeDoc();
 const simple=renderStageTitle(doc,1,'Лестница',{mode:'Лестница'});
 assert.deepEqual(simple.children.map(x=>x.textContent),['Этап 1 — Лестница','Лестница']);
 const named=renderStageTitle(doc,2,'Мой силовой комплекс',{mode:'Лестница'});
 assert.deepEqual(named.children.map(x=>x.textContent),['Этап 2 — Лестница','Мой силовой комплекс']);
});
