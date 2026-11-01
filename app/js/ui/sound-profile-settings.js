// Settings → Общее → «Сигналы метронома»: «Щелчки» (the original clicks) or «Электронные» with a tone A/B/C
// in the Fight Tech choice dialog. Saved at once; the metronome switches from its next beat.
import { TONES } from '../audio/sound-profile.js';
import { choiceField } from './choice-dialog.js';

export function installSoundProfileSettings(doc, { get, set }) {
  const host = doc.getElementById('ftMetronomeTone');
  const radios = [...doc.querySelectorAll('input[name="ftMetronomeSoundKind"]')];
  if (!host || !radios.length) return null;
  const options = Object.entries(TONES).map(([t, hz]) => ({ value: t, ru: `${t} · ${hz} Гц`, en: `${t} · ${hz} Hz` }));
  const tone = choiceField(doc, { label: { ru: 'Электронный сигнал', en: 'Electronic sound' }, options, value: get().tone,
    onChange: v => set({ ...get(), tone: v }) });
  tone.el.setAttribute('aria-label', 'Электронный сигнал');
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
