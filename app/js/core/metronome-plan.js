// STAGE 4: a stage may carry its own metronome — on/off, straight or subdivided, a tempo, and optionally a tempo per round.
// It plays only in work (MetronomeEngine.canRun). A stage without it keeps the timer screen's metronome, as before.
export const BPM_MIN = 1, BPM_MAX = 300, DEFAULT_BPM = 20;
const bpmOf = v => { const n = Number(v); return v !== null && v !== '' && Number.isInteger(n) && n >= BPM_MIN && n <= BPM_MAX ? n : null; };

const trimEnd = list => { while (list.length && list[list.length - 1] === null) list.pop(); return list; };
export function normalizeStageMetronome(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return {
    enabled: raw.enabled === true,
    mode: raw.mode === 'subdivided' ? 'subdivided' : 'direct',
    bpm: bpmOf(raw.bpm) ?? DEFAULT_BPM,
    perRound: raw.perRound === true,
    // Per-round tempos are kept when the round count shrinks; a round without its own tempo uses the stage tempo.
    roundBpm: trimEnd((Array.isArray(raw.roundBpm) ? raw.roundBpm : []).slice(0, 200).map(bpmOf))
  };
}

// Round n (1-based, counted through all blocks of the stage).
export const roundBpm = (m, n) => (m.perRound && m.roundBpm[n - 1]) || m.bpm;

// 60 / BPM seconds, at most two decimals; «≈» when the true value has more (60/7 = 8.571…). RU uses a decimal comma.
export function beatInterval(bpm, lang) {
  const sec = 60 / bpm, shown = Math.round(sec * 100) / 100;
  return (Math.abs(shown - sec) > 1e-9 ? '≈' : '') + String(shown).replace('.', lang === 'en' ? '.' : ',');
}
export const metronomeLine = (bpm, lang) => lang === 'en'
  ? `${bpm} beats/min · every ${beatInterval(bpm, lang)} sec`
  : `${bpm} уд/мин · каждые ${beatInterval(bpm, lang)} с`;
