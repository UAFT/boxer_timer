// An active workout belongs to the timer engine, not to the page currently
// being inspected. Previewing other presets must not reconfigure live playback.
const ACTIVE_PHASES = new Set(['countdown', 'work', 'work_two', 'rest', 'block_rest', 'count_up']);
export function isPlaybackProtected(timer, programRunning = false) {
  return Boolean(programRunning || ACTIVE_PHASES.has(timer?.state?.phase));
}
// 'running' | 'paused' | 'off' for a timer state; drives the screen wake lock.
export function playbackState(state) {
  if (!ACTIVE_PHASES.has(state?.phase)) return 'off';
  return state.isPaused ? 'paused' : 'running';
}
export function applyPresetWithoutInterrupting(timer, settings, {programRunning = false} = {}) {
  if (isPlaybackProtected(timer, programRunning)) return false;
  timer.applyConfig(settings);
  return true;
}
// Live metronome controls can be changed safely without recompiling a workout.
export function applyLiveMetronome(timer, source) {
  if (!timer?.config) return;
  timer.config.metronomeBpm = source.metronomeBpm;
  timer.config.metronomeMode = source.metronomeMode;
  timer.config.metronomeEnabled = source.metronomeEnabled;
}
