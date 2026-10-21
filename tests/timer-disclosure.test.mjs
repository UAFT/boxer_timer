import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installTimerDisclosure } from '../app/js/ui/timer-disclosure.js';

function mockDoc() {
  const attrs={};const listeners={};const classes=new Set();
  const title={textContent:''};
  const button={hidden:true,attrs,addEventListener:(n,fn)=>listeners[n]=fn,setAttribute:(n,v)=>attrs[n]=v,querySelector:()=>title,click:()=>listeners.click()};
  const doc={documentElement:{lang:'ru'},body:{classList:{toggle:(c,on)=>on?classes.add(c):classes.delete(c),contains:c=>classes.has(c)}},getElementById:id=>id==='timerRevealToggle'?button:null};
  return {doc,button,title,classes};
}

test('only one integrated disclosure: collapsed for program, expands full timer, preserves running state',()=>{
  const {doc,button,title,classes}=mockDoc();
  const ui=installTimerDisclosure(doc);
  ui.sync(false,false);
  assert.equal(button.hidden,true);
  assert.equal(classes.has('program-timer-collapsed'),false);
  ui.sync(true,false);
  assert.equal(button.hidden,false);
  assert.equal(button.attrs['aria-expanded'],'false');
  assert.equal(button.attrs['aria-label'],'Развернуть таймер');
  assert.equal(title.textContent,'Обычный таймер');
  assert.equal(classes.has('program-timer-collapsed'),true);
  button.click();
  assert.equal(button.attrs['aria-expanded'],'true');
  assert.equal(button.attrs['aria-label'],'Свернуть таймер');
  assert.equal(classes.has('program-timer-collapsed'),false);
  ui.sync(true,true);
  assert.equal(classes.has('program-timer-running'),true);
  assert.equal(classes.has('program-timer-collapsed'),false);
  doc.documentElement.lang='en';ui.sync(true,true);
  assert.equal(button.attrs['aria-label'],'Collapse timer');
  button.click();
  assert.equal(classes.has('program-timer-collapsed'),true);
  assert.equal(button.attrs['aria-label'],'Expand timer');
  ui.reset();ui.sync(false,false);
  assert.equal(button.hidden,true);
  assert.equal(classes.has('program-timer-collapsed'),false);
});

test('collapse control is nested in timer card, no external strip, other app modules unchanged',()=>{
  const html=readFileSync(new URL('../app/index.html',import.meta.url),'utf8');
  const css=readFileSync(new URL('../app/styles/timer-disclosure.css',import.meta.url),'utf8');
  const app=readFileSync(new URL('../app/js/app.js',import.meta.url),'utf8');
  const catalog=readFileSync(new URL('../app/js/library/catalog.js',import.meta.url),'utf8');
  const cardStart=html.indexOf('class="timer-card panel"');
  const button=html.indexOf('id="timerRevealToggle"');
  const cardEnd=html.indexOf('</section>',cardStart);
  assert.ok(cardStart >= 0 && button > cardStart && button < cardEnd,'toggle must live inside card');
  assert.equal(html.match(/id="timerRevealToggle"/g)?.length,1);
  assert.ok(css.includes('body.program-timer-collapsed .param-grid{display:none!important}'));
  assert.ok(app.includes('installTimerDisclosure'));
  assert.ok(catalog.includes("['boxing','Бокс']"));
  assert.ok(!catalog.includes("make('B03'"));
  assert.ok(!catalog.includes("make('B04'"));
  assert.ok(catalog.includes("make('B05'"));
});
