// Keeps the screen on during a workout via the Screen Wake Lock API. Android WebView
// grants it without a prompt (AwPermissionManager auto-grants WAKE_LOCK_SCREEN, M85+).
// The system drops the lock whenever the app is hidden, so it is taken again on return.
// A pause keeps the screen on for a water break, not for a forgotten timer.
const PAUSED_KEEP_MS = 10 * 60 * 1000;

export function installScreenWake({nav = globalThis.navigator, doc = globalThis.document, timers = globalThis} = {}) {
  let wanted = false, lock = null, pending = false, pauseTimer = null;
  const release = () => {
    const held = lock;
    lock = null;
    held?.release?.()?.catch?.(() => {});
  };
  function acquire() {
    if (!wanted || lock || pending || !nav?.wakeLock || doc.visibilityState !== 'visible') return;
    pending = true;
    Promise.resolve().then(() => nav.wakeLock.request('screen')).then(sentinel => {
      lock = sentinel;
      sentinel.addEventListener?.('release', () => { if (lock === sentinel) lock = null; });
      if (!wanted) release();
    }, () => {}).finally(() => { pending = false; });
  }
  doc.addEventListener('visibilitychange', () => { if (doc.visibilityState === 'visible') acquire(); });
  return {
    // 'running' | 'paused' | 'off', see playbackState().
    sync(state) {
      timers.clearTimeout(pauseTimer);
      pauseTimer = null;
      wanted = state === 'running' || state === 'paused';
      if (state === 'paused') pauseTimer = timers.setTimeout(() => { wanted = false; release(); }, PAUSED_KEEP_MS);
      if (wanted) acquire(); else release();
    },
    get held() { return lock !== null; }
  };
}
