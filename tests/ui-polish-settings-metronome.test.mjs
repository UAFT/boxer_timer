import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { translateText } from '../app/js/i18n/locale.js';
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const html = read('../app/index.html');
const main = read('../app/styles/main.css');
const kit = read('../app/styles/fight-tech-ui-kit.css');
const render = read('../app/js/ui/render.js');

test('settings choice rows use as many equal columns as they have buttons', () => {
  assert.match(html, /class="choice-row ft-diary-record-row"[^>]*>\s*<button[^>]*data-diary-record="auto"/);
  assert.match(html, /class="choice-row ft-warning-row"[^>]*>(\s*<button[^>]*data-warning-seconds="\d+"[^>]*>[^<]*<\/button>){3}\s*<\/div>/);
  assert.match(main, /\.choice-row\.ft-diary-record-row\s*\{\s*grid-template-columns:\s*repeat\(2,/);
  assert.match(main, /\.choice-row\.ft-warning-row\s*\{\s*grid-template-columns:\s*repeat\(3,/);
});

test('preview labels never shrink below a word and keep numbers with their word', () => {
  assert.match(main, /\.settings-modal \.ladder-preview-row\s*\{\s*grid-template-columns:\s*minmax\(min-content,/);
  assert.ok(render.includes("<span>Раунд\\u00a0'+localRoundFor(config,i)+'</span>"));
  assert.equal(translateText('Раунд 1 · Фаза 1', 'en'), 'Round 1 · Phase 1');
  assert.equal(translateText('Фаза 2', 'en'), 'Phase 2');
});

test('metronome button: neighbouring --ft-raised surface, thin solid black outline, bold black label centred by flex', () => {
  assert.match(kit, /\.metro-mask\{background:var\(--ft-raised\);color:#111;border:1\.5px solid #111;[^}]*border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center\}/);
  assert.match(kit, /\.metro-mask-title\{color:#111;font-weight:800;line-height:1\}/);
  // An empty note took 6 px under the label and raised it (owner screenshot 2026-11-01).
  assert.match(kit, /\.metro-mask-note:empty\{display:none\}/);
  assert.doesNotMatch(kit, /\.metro-mask\{background:#fff/);
});
