// One timer card, two states. No duplicate standalone toggle above the card.
export function installTimerDisclosure(doc = document) {
  const button = doc.getElementById('timerRevealToggle');
  const body = doc.body;
  let expanded = false;
  let hasProgram = false;
  let running = false;
  const sync = (programExists, isRunning = false) => {
    hasProgram = Boolean(programExists);
    running = Boolean(isRunning);
    const collapsed = hasProgram && !expanded;
    const lang = doc.documentElement.lang === 'en' ? 'en' : 'ru';
    body.classList.toggle('program-timer-collapsed', collapsed);
    body.classList.toggle('program-timer-running', running);
    button.hidden = !hasProgram;
    button.setAttribute('aria-expanded', String(!collapsed));
    button.setAttribute('aria-label', lang === 'en'
      ? (collapsed ? 'Expand timer' : 'Collapse timer')
      : (collapsed ? 'Развернуть таймер' : 'Свернуть таймер'));
    const title = button.querySelector('.timer-disclosure-title');
    if (title) title.textContent = lang === 'en' ? 'Training timer' : 'Обычный таймер';
  };
  button.addEventListener('click', () => {
    if (!hasProgram) return;
    expanded = !expanded;
    sync(hasProgram,running);
  });
  return {
    sync,
    // A held preset creates a program while the user is still composing it.
    // Keep the whole timer and its preset row visible for further holds.
    keepExpandedOnPresetAdd() { expanded = true; },
    reset() {expanded=false;}
  };
}
