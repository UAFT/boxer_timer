import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { translateText } from '../app/js/i18n/locale.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const html = read('../app/index.html');
const app = read('../app/js/app.js');
const paywall = read('../app/js/billing/paywall.js');
const locale = read('../app/js/i18n/locale.js');

test('subscription card follows General inside the existing Settings modal', () => {
  const settings = html.indexOf('id="settingsModal"');
  const general = html.indexOf('>Общее<', settings);
  const subscription = html.indexOf('id="ftSubscriptionCard"', settings);
  const intervalMode = html.indexOf('>Режим интервалов<', settings);
  assert.ok(settings >= 0, 'Settings modal exists');
  assert.ok(general > settings && subscription > general && intervalMode > subscription);
  for (const id of [
    'ftSubscriptionStatus',
    'ftSubscriptionOffers',
    'ftSubscriptionPurchase',
    'ftSubscriptionRestore',
    'ftSubscriptionManage'
  ]) assert.match(html, new RegExp('id="' + id + '"'));
});

test('both workout entry points consult the billing gate', () => {
  const toggle = app.slice(app.indexOf('async function handleToggleRun'), app.indexOf('function handleReset'));
  const programStart = app.indexOf('function startProgram');
  const program = app.slice(programStart, app.indexOf('\nfunction ', programStart + 1));
  assert.match(toggle, /billing\.canStart\(\)/);
  assert.match(program, /billing\.canStart\(\)/);
});

test('billing UI uses only Play product details for prices', () => {
  const directory = new URL('../app/js/billing/', import.meta.url);
  const billing = readdirSync(directory)
    .filter((name) => name.endsWith('.js'))
    .map((name) => read('../app/js/billing/' + name))
    .join('\n');
  assert.doesNotMatch(billing, /₽|\$\s?\d|USD|RUB|\b249\b/);
  assert.match(paywall, /getProducts\(\{ productIds: ids \}\)/);
  assert.match(paywall, /formattedPrice/);
  assert.match(paywall, /billingPeriod/);
});

test('every Russian billing UI string has a complete English pair', () => {
  const cardStart = html.indexOf('id="ftSubscriptionCard"');
  const cardEnd = html.indexOf('</section>', cardStart);
  const card = html.slice(cardStart, cardEnd);
  const jsStrings = [...paywall.matchAll(/'([^'\n]*[А-Яа-яЁё][^'\n]*)'/g)].map((match) => match[1]);
  const cardStrings = [...card.matchAll(/>([^<>]*[А-Яа-яЁё][^<>]*)</g)]
    .map((match) => match[1].trim())
    .filter(Boolean);
  const strings = [...new Set([...jsStrings, ...cardStrings])];
  assert.ok(strings.length > 10);
  for (const source of strings) {
    const translated = translateText(source, 'en');
    assert.notEqual(translated, source, source);
    assert.doesNotMatch(translated, /[А-Яа-яЁё]/, source);
    assert.ok(locale.includes("['" + source + "','"), source);
  }
});
