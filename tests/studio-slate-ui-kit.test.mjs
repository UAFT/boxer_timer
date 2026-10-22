import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const html=readFileSync(new URL('../app/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../app/styles/fight-tech-ui-kit.css',import.meta.url),'utf8');
const locale=readFileSync(new URL('../app/js/i18n/locale.js',import.meta.url),'utf8');
test('Studio Slate loaded last and light tokenized for full plan/program screens',()=>{
 assert.match(html,/styles\/program-screen\.css[\s\S]*styles\/fight-tech-ui-kit\.css/);
 assert.match(css,/color-scheme:light/);
 for(const token of ['--ft-bg','--ft-surface','--ft-ink','--ft-steel-gradient','--ft-line','--ft-shadow'])assert.ok(css.includes(token),token);
 assert.match(css,/\.ladder-live\.is-expanded/);
 assert.match(css,/\.program-stage-card/);
});
test('one language dropdown keeps auto/RU/EN options and stored preference',()=>{
 const match=html.match(/<select id="languageSelect"[^>]*>([\s\S]*?)<\/select>/);
 assert.ok(match);
 assert.deepEqual([...match[1].matchAll(/<option value="([^"]+)"/g)].map(x=>x[1]),['auto','ru','en']);
 assert.doesNotMatch(html,/class="language-choices"/);
 assert.match(locale,/localStorage\.setItem\(LANGUAGE_KEY,preference\)/);
 assert.match(locale,/languageDropdown\.addEventListener\('change'/);
});
test('UI Kit does not alter schedule engine',()=>{
 assert.doesNotMatch(css,/@import|url\(/);
 assert.ok(!html.includes('data-new-preset'));
});
