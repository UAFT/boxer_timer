// Android Back via the Capacitor App plugin. Once a listener is registered the plugin
// does nothing by itself, so every case is decided here:
//  1. an open menu or dialog closes through its own Cancel/Close button, so its usual
//     close logic runs (Settings keep their autosave);
//  2. the full-screen plan collapses;
//  3. during a workout the first press only warns; a second press within 2.5 s moves the
//     app to the background, as Home does (the workout is not reset);
//  4. otherwise the app moves to the background, as Android 12+ does for a root screen.
const CLOSERS = [
  ['ftLanguageList', 'ftLanguageTrigger'],
  // × first: Back closes a question without answering it (the diary's «Записать?» is asked again later).
  ['programDeleteConfirmModal', 'programDeleteConfirmDismiss', 'programDeleteConfirmCancel'],
  ['ftWorkoutImportModal', 'ftWorkoutImportCancel'],
  ['roundEditModal', 'roundEditCancel'],
  ['stageSettingsModal', 'stageSettingsCancel'],
  ['programSaveModal', 'programSaveClose'],
  ['programLibraryModal', 'programLibraryBack', 'programLibraryClose'],
  ['settingsModal', 'closeSettingsBtn'],
  ['ladderLive', 'ladderExpand']
];
const CONFIRM_MS = 2500;
const HINTS = {
  ru: 'Идёт тренировка. Нажмите «Назад» ещё раз, чтобы свернуть приложение.',
  en: 'Workout in progress. Press Back again to minimize the app.'
};

export function installBackButton({win = globalThis.window, doc = globalThis.document, isWorkoutActive = () => false,
  now = () => Date.now(), timers = globalThis} = {}) {
  const app = win?.Capacitor?.Plugins?.App;
  let warnedAt = -Infinity, hintTimer = null;
  const hint = doc.getElementById('ftBackHint');
  const hideHint = () => { if (hint) hint.hidden = true; };
  function closeTop() {
    for (const [id, ...buttons] of CLOSERS) {
      const overlay = doc.getElementById(id);
      if (!overlay || overlay.hidden) continue;
      if (id === 'ladderLive' && !overlay.classList.contains('is-expanded')) continue;
      const button = buttons.map(name => doc.getElementById(name)).find(candidate => candidate && !candidate.hidden);
      if (button) { button.click(); return true; }
    }
    return false;
  }
  function onBack() {
    if (closeTop()) return 'closed';
    if (isWorkoutActive() && now() - warnedAt > CONFIRM_MS) {
      warnedAt = now();
      if (hint) {
        hint.textContent = HINTS[doc.documentElement?.lang === 'en' ? 'en' : 'ru'];
        hint.hidden = false;
        timers.clearTimeout(hintTimer);
        hintTimer = timers.setTimeout(hideHint, CONFIRM_MS);
      }
      return 'warned';
    }
    warnedAt = -Infinity;
    hideHint();
    app?.minimizeApp?.()?.catch?.(() => {});
    return 'minimized';
  }
  app?.addListener?.('backButton', onBack);
  return { onBack };
}
