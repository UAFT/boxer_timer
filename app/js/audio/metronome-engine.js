import { PHASES } from '../core/constants.js';

const SAMPLE_MAP = {
  direct: './assets/audio/metronome/metronome_single_runtime.wav',
  subdivided: './assets/audio/metronome/metronome_split_runtime.wav'
};

export class MetronomeEngine {
  constructor() {
    this.enabled = false;
    this.bpm = 20;
    this.mode = 'direct';
    this.intervalId = null;
    this.running = false;
    this.subStep = 0;
    this.cache = new Map();
    this.unlocked = false;
    this.suppressUntilMs = 0;
  }

  setConfig({ enabled, bpm, mode }) {
    this.enabled = Boolean(enabled);
    this.bpm = Math.max(0, Number.isFinite(bpm) ? bpm : 0);
    this.mode = mode === 'subdivided' ? 'subdivided' : 'direct';
    if (!this.enabled || this.bpm <= 0) {
      this.stop();
    } else if (this.running) {
      this.restart();
    }
  }

  async preloadSample(kind) {
    const src = SAMPLE_MAP[kind];
    if (!src) return null;
    if (this.cache.has(kind)) return this.cache.get(kind);

    const audio = new Audio(src);
    audio.preload = 'auto';
    this.cache.set(kind, audio);

    try {
      await new Promise((resolve, reject) => {
        const onCanPlay = () => {
          cleanup();
          resolve(audio);
        };
        const onError = () => {
          cleanup();
          reject(new Error(`Metronome sample missing: ${kind}`));
        };
        const cleanup = () => {
          audio.removeEventListener('canplaythrough', onCanPlay);
          audio.removeEventListener('error', onError);
        };
        audio.addEventListener('canplaythrough', onCanPlay, { once: true });
        audio.addEventListener('error', onError, { once: true });
        audio.load();
      });
    } catch {
      return null;
    }

    return audio;
  }

  async unlock() {
    if (this.unlocked) return true;
    const sample = await this.preloadSample('direct');
    await this.preloadSample('subdivided');
    if (!sample) {
      this.unlocked = true;
      return true;
    }
    try {
      sample.muted = true;
      sample.currentTime = 0;
      await sample.play();
      sample.pause();
      sample.currentTime = 0;
      sample.muted = false;
      this.unlocked = true;
      return true;
    } catch {
      sample.muted = false;
      return false;
    }
  }

  suppressFor(ms = 350) {
    this.suppressUntilMs = Math.max(this.suppressUntilMs, Date.now() + Math.max(0, ms));
    this.stop();
  }

  async playSample(kind) {
    const base = this.cache.get(kind) || await this.preloadSample(kind);
    if (!base) return;
    try {
      const audio = base.cloneNode(true);
      audio.currentTime = 0;
      await audio.play();
    } catch {
      // no-op
    }
  }

  getStepMs() {
    const beatMs = Math.max(80, Math.round(60000 / this.bpm));
    if (this.mode === 'subdivided') return Math.max(60, Math.round(beatMs / 2));
    return beatMs;
  }

  async step() {
    if (this.mode === 'subdivided') {
      await this.playSample(this.subStep === 0 ? 'direct' : 'subdivided');
      this.subStep = this.subStep === 0 ? 1 : 0;
      return;
    }

    await this.playSample('direct');
  }

  async start() {
    if (!this.enabled || this.bpm <= 0 || this.running) return;
    if (Date.now() < this.suppressUntilMs) return;
    this.running = true;
    this.subStep = 0;
    await this.step();
    this.intervalId = window.setInterval(() => {
      this.step();
    }, this.getStepMs());
  }

  stop() {
    if (this.intervalId) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.running = false;
    this.subStep = 0;
  }

  restart() {
    this.stop();
    this.start();
  }

  syncPhase(state) {
    const shouldRun =
      this.enabled &&
      this.bpm > 0 &&
      !state.isPaused &&
      (state.phase === PHASES.WORK || state.phase === PHASES.REST);

    if (!shouldRun || Date.now() < this.suppressUntilMs) {
      this.stop();
      return;
    }

    if (!this.running) {
      this.start();
    }
  }
}
