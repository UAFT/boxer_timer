// Metronome sound profiles and the Fight Tech choice dialog (2026-11-01).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadSoundProfile, saveSoundProfile, soundKeys, SOUND_PROFILE_KEY, TONES } from '../app/js/audio/sound-profile.js';
import { AUDIO_FILE_MAP } from '../app/js/audio/catalog.js';
import { translateText } from '../app/js/i18n/locale.js';

const read = p => readFileSync(new URL('../app/' + p, import.meta.url));
const sha = p => createHash('sha256').update(read(p)).digest('hex');
const store = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), m }; };

test('no stored choice, a broken one or an unknown kind = the original clicks (an update never changes the sound)', () => {
  assert.deepEqual(loadSoundProfile(store()), { kind: 'click', tone: 'A' });
  assert.deepEqual(loadSoundProfile(store({ [SOUND_PROFILE_KEY]: '{bad' })), { kind: 'click', tone: 'A' });
  assert.deepEqual(loadSoundProfile(store({ [SOUND_PROFILE_KEY]: '{"kind":"beep","tone":"Z"}' })), { kind: 'click', tone: 'A' });
  assert.deepEqual(soundKeys(loadSoundProfile(store())), { strong: 'metronome_direct', weak: 'metronome_subdivided', tick: 'cue_warning_tick', gain: null });
});

test('a saved choice comes back after a restart; clicks keep the last tone for later', () => {
  const s = store();
  saveSoundProfile({ kind: 'electronic', tone: 'C' }, s);
  assert.deepEqual(loadSoundProfile(s), { kind: 'electronic', tone: 'C' });
  saveSoundProfile({ kind: 'click', tone: 'C' }, s);
  assert.deepEqual(loadSoundProfile(s), { kind: 'click', tone: 'C' });
});

test('each tone maps accent, subdivision and countdown tick to its own pair, played at gain 1', () => {
  for (const t of Object.keys(TONES)) {
    const k = soundKeys({ kind: 'electronic', tone: t });
    assert.deepEqual(k, { strong: `metronome_strong_${t}`, weak: `metronome_weak_${t}`, tick: `metronome_strong_${t}`, gain: 1 });
    assert.match(AUDIO_FILE_MAP[k.strong], new RegExp(`/electronic/${t}_\\w+_${TONES[t]}_strong\\.wav$`));
    assert.match(AUDIO_FILE_MAP[k.weak], new RegExp(`/electronic/${t}_\\w+_${TONES[t]}_weak\\.wav$`));
  }
});

test('bundled electronic files are the delivered ones, byte for byte; the original clicks are untouched', () => {
  const want = {
    'A_soft_1400_strong.wav': '1e39488e6488a9cb862bf5d4b102b0d75bdfe84f5eb99cf50f5243d0d433d112',
    'A_soft_1400_weak.wav': '719a8fa73a6dfef6ea18c76caaa90da6c48339e7054df7e709717484330f0629',
    'B_clear_1600_strong.wav': 'f0368e1d29b5ecb53e3047e776f6755f14669c325513df6945a2fb210b7ae727',
    'B_clear_1600_weak.wav': '145d15bf83593c437854845ec5fbb954f2fe5d8c959386e4470928db0a6ca867',
    'C_bright_1800_strong.wav': '5c5b4bb2ed34d73e49dd2df9460dd42be733379bec4bab06bd10cd402ab42a35',
    'C_bright_1800_weak.wav': 'b168ef9bba1804c50c5c4f65539173aced6015dcda928ebf21b8f7c58fc2ecdc'
  };
  for (const [f, h] of Object.entries(want)) assert.equal(sha('assets/audio/metronome/electronic/' + f), h, f);
  assert.equal(sha('assets/audio/metronome/metronome_single_runtime.wav'), 'cffb0c6223abb802bcfd185a4e83664942e368b43d1637586e180e501c0ad83c');
  assert.equal(sha('assets/audio/metronome/metronome_split_upbeat_runtime.wav'), '1b66955097b2e08dd4d0f5ae452ecdb9daa47d7b58fbae5cc3f9e9a25bfde880');
  assert.equal(sha('assets/audio/cues/warning_tick_runtime.wav'), 'cffb0c6223abb802bcfd185a4e83664942e368b43d1637586e180e501c0ad83c');
  assert.equal(AUDIO_FILE_MAP.metronome_direct, './assets/audio/metronome/metronome_single_runtime.wav');
  assert.equal(AUDIO_FILE_MAP.metronome_subdivided, './assets/audio/metronome/metronome_split_upbeat_runtime.wav');
  assert.equal(AUDIO_FILE_MAP.cue_warning_tick, './assets/audio/cues/warning_tick_runtime.wav');
});

test('the metronome engine plays the chosen pair: accent = strong, subdivision = weak; clicks keep 1.5 / 1.35', async () => {
  globalThis.window ??= globalThis;
  const { MetronomeEngine } = await import('../app/js/audio/metronome-engine.js');
  const played = [];
  const m = new MetronomeEngine({ play: async (key, o) => played.push([key, o.volume]), stopTag() {}, unlock: async () => true });
  await m.playDirectBeat(); await m.playSubdivisionBeat();
  m.setSoundProfile({ kind: 'electronic', tone: 'B' });
  await m.playDirectBeat(); await m.playSubdivisionBeat();
  assert.deepEqual(played, [['metronome_direct', 1.5], ['metronome_subdivided', 1.35], ['metronome_strong_B', 1], ['metronome_weak_B', 1]]);
});

test('countdown and warning ticks follow the profile; gongs keep their own files', () => {
  const app = read('js/app.js').toString();
  assert.match(app, /PRESTART_COUNTDOWN_EVENTS\.has\(event\.type\)\) \{\n\s*return \{ key: sound\.tick, tag: 'countdown', volume: sound\.gain \?\? 1\.25 \}/);
  assert.match(app, /event\.type === 'warning-tick'\) \{\n\s*return \{ key: sound\.tick, tag: 'warning', volume: sound\.gain \?\? 1\.2 \}/);
  for (const gong of ["'cue_round_start_v2'", "'cue_rest_start_v2'", "'cue_rest_start_v1'", "'cue_workout_end_v2'"]) assert.ok(app.includes(gong), gong);
});

test('no native <select> in the start-from control or the sound settings; the choice dialog closes first on Back', () => {
  const html = read('index.html').toString();
  assert.deepEqual([...html.matchAll(/<select id="(\w+)"/g)].map(m => m[1]), ['languageSelect']);
  for (const f of ['js/ui/start-from.js', 'js/ui/sound-profile-settings.js', 'js/ui/choice-dialog.js']) assert.doesNotMatch(read(f).toString(), /createElement\('select'\)/, f);
  assert.match(read('js/platform/back-button.js').toString(), /const CLOSERS = \[\n[^\n]*\n\s*\['ftChoiceDialog', 'ftChoiceDialogClose'\],/);
  assert.match(html, /id="audioEnabledInput"[\s\S]*<span>Сигналы таймера<\/span>[\s\S]*id="ftMetronomeSound"[\s\S]*id="ftMetronomeSoundClick"[\s\S]*id="ftMetronomeSoundElectronic"[\s\S]*id="ftMetronomeTone" hidden/);
});

test('every new UI string has its English', () => {
  for (const [ru, en] of [['Сигналы метронома', 'Metronome sounds'], ['Щелчки', 'Clicks'], ['Электронные', 'Electronic'], ['Электронный сигнал', 'Electronic sound'], ['Свернуть', 'Collapse'], ['Закрыть', 'Close'], ['Начать тренировку с', 'Start workout from']])
    assert.equal(translateText(ru, 'en'), en, ru);
});
