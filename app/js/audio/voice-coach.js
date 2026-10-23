// Optional device text-to-speech; offline when an OS voice is installed.
let lastKey = '';
let generation = 0;
export function stopVoice() {
  lastKey = '';
  generation++;
  if ('speechSynthesis' in globalThis) speechSynthesis.cancel();
}
// The round a cue introduces: the rest/block-rest end cues carry the round that just ended.
export function announcedRound(event, rounds) {
  const index = ['rest-end-zero', 'block-rest-end-zero'].includes(event.type) ? event.roundIndex : event.roundIndex - 1;
  return rounds?.[Math.max(0, index)];
}
export function announceRound(eventType, round, language = 'ru') {
  if (!round || !('speechSynthesis' in globalThis)) return;
  // The template placeholders were lost when this file was first written ("Раунд . . Работа!",
  // key ":::" so only the first phrase of a workout was ever spoken).
  const key = `${eventType}:${round.cycleIndex}:${round.stageIndex}:${round.stageRound}`;
  if (key === lastKey) return;
  lastKey = key;
  const thisGeneration = ++generation;
  const name = round.roundName || round.stageTitle || '';
  const number = round.blockCount > 1 ? round.localRound : round.stageRound;
  const message = eventType === 'round-end-zero'
    ? (language === 'en' ? 'Rest' : 'Отдых')
    : [language === 'en' ? `Round ${number}` : `Раунд ${number}`, name, language === 'en' ? 'Go!' : 'Работа!'].filter(Boolean).join('. ');
  try {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = language === 'en' ? 'en-US' : 'ru-RU';
    utterance.rate = 1.15;
    setTimeout(() => { if (generation === thisGeneration && lastKey === key) speechSynthesis.speak(utterance); }, 650);
  } catch { /* No voice installed: timer continues. */ }
}
