import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {presetOrderPositions,renderPresetOrders} from '../app/js/ui/preset-order.js';

function makeTab(id){
  const classes=new Set();
  const badge={className:'preset-order',children:[],attributes:{},replaceChildren(...children){this.children=children;},setAttribute(k,v){this.attributes[k]=v;}};
  return {dataset:{preset:id},badge,classes,classList:{toggle(k,on){if(on)classes.add(k);else classes.delete(k);}},querySelector:k=>k==='.preset-order'?badge:null,append(v){this.badge=v;}};
}
const doc={createElement(){return {className:'',textContent:''};}};
const mk=id=>({presetId:id});
test('preset ordinal badges represent actual sequence and repeat occurrences',()=>{
  const tabs=['classic3','classic2','classic1','tabata2020x24'].map(makeTab);
  const entries=[mk('classic3'),mk('classic2'),mk('classic3')];
  renderPresetOrders(tabs,entries,doc);
  assert.deepEqual(tabs[0].badge.children.map(x=>x.textContent),['1','3']);
  assert.deepEqual(tabs[1].badge.children.map(x=>x.textContent),['2']);
  assert.deepEqual(tabs[2].badge.children,[]);
  assert.equal(tabs[0].badge.attributes['aria-label'],'Позиции в программе: 1, 3');
  assert.equal(tabs[0].classes.has('has-program'),true);
  assert.equal(tabs[1].classes.has('has-program'),true);
  assert.equal(tabs[2].classes.has('has-program'),false);
  entries.push(mk('classic2'));
  renderPresetOrders(tabs,entries,doc);
  assert.deepEqual(tabs[1].badge.children.map(x=>x.textContent),['2','4']);
  entries.splice(0,1);
  renderPresetOrders(tabs,entries,doc);
  assert.deepEqual(tabs[0].badge.children.map(x=>x.textContent),['2']);
  assert.deepEqual(tabs[1].badge.children.map(x=>x.textContent),['1','3']);
  entries.length=0;renderPresetOrders(tabs,entries,doc);
  assert.ok(tabs.every(t=>!t.classes.has('has-program')&&t.badge.children.length===0));
});
test('preset-order module and orange fill are integrated without expanding app.js',()=>{
 const app=readFileSync(new URL('../app/js/app.js',import.meta.url),'utf8');
 const style=readFileSync(new URL('../app/styles/timer-disclosure.css',import.meta.url),'utf8');
 assert.ok(app.includes('renderPresetOrders(els.presetTabs, programEntries);'));
 assert.ok(!app.includes('const positions=[]'));
 assert.ok(style.includes('.preset-row .preset-tab.has-program{background:linear-gradient('));
 assert.deepEqual(presetOrderPositions([mk('classic3'),mk('classic1'),mk('classic3')],'classic3'),[1,3]);
});
