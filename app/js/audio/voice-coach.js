// Optional device text-to-speech; offline when an OS voice is installed.
let lastKey = '';
let generation = 0;
export function stopVoice() {
  lastKey = '';
  generation++;
  if ('speechSynthesis' in globalThis) speechSynthesis.cancel();
}
export function announceRound(eventType, round, language = 'ru') {
  if (!round || !('speechSynthesis' in globalThis)) return;
  const key = `:::`;
  if (key === lastKey) return;
  lastKey = key;
  const thisGeneration = ++generation;
  const name = round.roundName || round.stageTitle || '';
  const message = eventType === 'round-end-zero'
    ? (language === 'en' ? 'Rest' : 'Отдых')
    : (language === 'en' ? `Round . . Go!` : `Раунд . . Работа!`);
  try {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = language === 'en' ? 'en-US' : 'ru-RU';
    utterance.rate = 1.15;
    setTimeout(() => { if (generation === thisGeneration && lastKey === key) speechSynthesis.speak(utterance); }, 650);
  } catch { /* No voice installed: timer continues. */ }
}
