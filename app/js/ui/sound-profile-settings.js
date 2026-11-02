// Settings → Общее: «Сигналы отсчёта» and «Сигналы метронома», each «Щелчки» (the original clicks) or «Электронные»
// with a tone A/B/C in the Fight Tech choice dialog. Two independent choices, saved at once.
import { TONES } from '../audio/sound-profile.js';
import { choiceField } from './choice-dialog.js';

// name: the radio group name (ftCountdownSound / ftMetronomeSound); its tone dropdown goes into #<name>Tone.
export function installSoundProfileSettings(doc, { name = 'ftMetronomeSound', label = { ru: 'Электронный сигнал', en: 'Electronic sound' }, get, set }) {
  const host = doc.getElementById(name + 'Tone');
  const radios = [...doc.querySelectorAll(`input[name="${name}Kind"]`)];
  if (!host || !radios.length) return null;
  const options = Object.entries(TONES).map(([t, hz]) => ({ value: t, ru: `${t} · ${hz} Гц`, en: `${t} · ${hz} Hz` }));
  const tone = choiceField(doc, { label, options, value: get().tone, onChange: v => set({ ...get(), tone: v }) });
  tone.el.setAttribute('aria-label', label.ru);
  host.append(tone.el);
  const sync = () => {
    const p = get();
    for (const r of radios) r.checked = r.value === p.kind;
    host.hidden = p.kind !== 'electronic';
    tone.set(options, p.tone);
  };
  for (const r of radios) r.addEventListener('change', () => { if (r.checked) { set({ ...get(), kind: r.value }); sync(); } });
  sync();
  return { sync };
}
