import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deleteDialogLabels, installDeleteConfirmation } from '../app/js/ui/delete-confirmation.js';

function fakeDialog(lang='ru') {
  const elements = new Map();
  const listeners = new Map();
  const doc = {
    documentElement:{lang}, activeElement:null,
    getElementById:id=>elements.get(id),
    addEventListener:(type,handler)=>listeners.set(type,handler),
    removeEventListener:(type,handler)=>{if(listeners.get(type)===handler)listeners.delete(type);},
    emit:(type,event)=>listeners.get(type)?.(event)
  };
  for(const id of ['programDeleteConfirmModal','programDeleteConfirmTitle','programDeleteConfirmMessage','programDeleteConfirmName','programDeleteConfirmCancel','programDeleteConfirmAccept','programLibraryMine']) {
    const events=new Map();
    elements.set(id, {
      id, hidden:id==='programDeleteConfirmModal', isConnected:true, textContent:'',
      focus(){doc.activeElement=this;},
      addEventListener(type,fn){events.set(type,fn);},
      click(event={}){events.get('click')?.({target:this,...event});}
    });
  }
  return {doc,get:id=>elements.get(id)};
}

test('localized delete confirmation uses current app language and cancels safely',()=>{
  const {doc,get}=fakeDialog('ru');
  const open=installDeleteConfirmation(doc);let count=0;
  const trigger={isConnected:true,focus(){doc.activeElement=this;}};
  open({name:'Работа на мешке - 1',trigger,onConfirm(){count++;}});
  assert.equal(get('programDeleteConfirmModal').hidden,false);
  assert.equal(get('programDeleteConfirmTitle').textContent,'Удалить программу?');
  assert.equal(get('programDeleteConfirmName').textContent,'Работа на мешке - 1');
  assert.equal(get('programDeleteConfirmCancel').textContent,'Отмена');
  assert.equal(get('programDeleteConfirmAccept').textContent,'Удалить');
  assert.equal(doc.activeElement,get('programDeleteConfirmCancel'));
  get('programDeleteConfirmCancel').click();
  assert.equal(get('programDeleteConfirmModal').hidden,true);
  assert.equal(doc.activeElement,trigger);
  assert.equal(count,0);
  open({name:'Другой',trigger,onConfirm(){count++;}});
  let prevented=false;
  doc.emit('keydown',{key:'Escape',preventDefault(){prevented=true;}});
  assert.equal(prevented,true);
  assert.equal(get('programDeleteConfirmModal').hidden,true);
  assert.equal(count,0);
  open({name:'Новая',trigger,onConfirm(){count++;}});
  get('programDeleteConfirmModal').click();
  assert.equal(get('programDeleteConfirmModal').hidden,true);
  assert.equal(count,0);
});

test('English confirmed action fires only once and keyboard focus stays trapped',()=>{
  const {doc,get}=fakeDialog('en');let count=0;
  const open=installDeleteConfirmation(doc);
  const trigger={isConnected:true,focus(){doc.activeElement=this;}};
  open({name:'Test <script> title',trigger,onConfirm(){count++;}});
  assert.equal(get('programDeleteConfirmTitle').textContent,'Delete program?');
  assert.equal(get('programDeleteConfirmMessage').textContent,'This action cannot be undone.');
  assert.equal(get('programDeleteConfirmName').textContent,'Test <script> title');
  assert.equal(get('programDeleteConfirmCancel').textContent,'Cancel');
  assert.equal(get('programDeleteConfirmAccept').textContent,'Delete');
  let prevented=false;
  doc.emit('keydown',{key:'Tab',shiftKey:true,preventDefault(){prevented=true;}});
  assert.equal(prevented,true);
  assert.equal(doc.activeElement,get('programDeleteConfirmAccept'));
  get('programDeleteConfirmAccept').click();
  get('programDeleteConfirmAccept').click();
  assert.equal(count,1);
  assert.equal(get('programDeleteConfirmModal').hidden,true);
  assert.equal(doc.activeElement,get('programLibraryMine'));
  assert.equal(deleteDialogLabels('ru').cancel,'Отмена');
});

test('dialog DOM, CSS and app wiring are in source without native confirm',()=>{
  const html=readFileSync(new URL('../app/index.html',import.meta.url),'utf8');
  const app=readFileSync(new URL('../app/js/app.js',import.meta.url),'utf8');
  const css=readFileSync(new URL('../app/styles/delete-confirmation.css',import.meta.url),'utf8');
  for(const id of ['programDeleteConfirmModal','programDeleteConfirmTitle','programDeleteConfirmMessage','programDeleteConfirmName','programDeleteConfirmCancel','programDeleteConfirmAccept'])
    assert.ok(html.includes('id="'+id+'"'),id);
  assert.ok(html.includes('role="alertdialog"'));
  assert.ok(html.includes('./styles/delete-confirmation.css'));
  assert.ok(css.includes('.ft-delete-dialog'));
  assert.ok(app.includes('installDeleteConfirmation'));
  assert.ok(!app.includes('window.confirm('));
});
