import { PHASES } from '../core/constants.js';

export class MetronomeEngine {
  constructor() {
    this.enabled = false;
    this.bpm = 20;
    this.context = null;
    this.intervalId = null;
    this.running = false;
  }

  setConfig({ enabled, bpm }) {
    this.enabled = Boolean(enabled);
    this.bpm = Math.max(0, Number.isFinite(bpm) ? bpm : 0);
    if (!this.enabled || this.bpm <= 0) {
      this.stop();
    } else if (this.running) {
      this.restart();
    }
  }

  async ensureContext() {
    if (!this.context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      this.context = new AudioContextClass();
    }
    if (this.context.state === 'suspended') {
      try {
        await this.context.resume();
      } catch {
        return null;
      }
    }
    return this.context;
  }

  async tick() {
    const ctx = await this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 1260;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  async start() {
    if (!this.enabled || this.bpm <= 0 || this.running) return;
    this.running = true;
    await this.tick();
    const intervalMs = Math.max(80, Math.round(60000 / this.bpm));
    this.intervalId = window.setInterval(() => {
      this.tick();
    }, intervalMs);
  }

  stop() {
    if (this.intervalId) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.running = false;
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

    if (!shouldRun) {
      this.stop();
      return;
    }

    if (!this.running) {
      this.start();
    }
  }
}
