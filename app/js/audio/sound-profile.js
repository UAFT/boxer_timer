// Metronome sound profile (Settings → Общее → «Сигналы метронома»). One choice for the whole app, kept apart from the
// per-preset settings. No stored choice = the original clicks, so an update never changes the sound by itself.
export const SOUND_PROFILE_KEY = 'fighttech.metronome.sound.v1';
// Electronic pairs from FightTech_Audio_ABC_20261101.zip (docs/FIGHT_TECH_AUDIO_PROFILES.md): strong = accent, weak = subdivision.
export const TONES = { A: 1400, B: 1600, C: 1800 };
const DEFAULT = { kind: 'click', tone: 'A' };

export function loadSoundProfile(storage = globalThis.localStorage) {
  try {
    const v = JSON.parse(storage?.getItem(SOUND_PROFILE_KEY) || 'null');
    return { kind: v?.kind === 'electronic' ? 'electronic' : 'click', tone: v?.tone in TONES ? v.tone : 'A' };
  } catch { return { ...DEFAULT }; }
}
export function saveSoundProfile(profile, storage = globalThis.localStorage) {
  try { storage?.setItem(SOUND_PROFILE_KEY, JSON.stringify({ kind: profile.kind, tone: profile.tone })); return true; } catch { return false; }
}
// The click family: the metronome accent, its subdivision and the countdown/warning tick (the same click file).
// Electronic files play at their own level (gain 1, no boost): their RMS is already ~5 dB above the click at its gain 1.5,
// their peak (−3.6 dBFS) below it; a boost would push them to 0 dBFS. See docs/FIGHT_TECH_AUDIO_PROFILES.md.
export function soundKeys(profile) {
  if (profile?.kind !== 'electronic') return { strong: 'metronome_direct', weak: 'metronome_subdivided', tick: 'cue_warning_tick', gain: null };
  const t = profile.tone in TONES ? profile.tone : 'A';
  return { strong: `metronome_strong_${t}`, weak: `metronome_weak_${t}`, tick: `metronome_strong_${t}`, gain: 1 };
}
