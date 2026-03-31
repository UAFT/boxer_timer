import { PHASES } from '../core/constants.js';

export class MetronomeEngine {
  constructor() {
    this.enabled = false;
    this.bpm = 20;
    this.mode = 'direct';
    this.context = null;
    this.intervalId = null;
    this.running = false;
    this.subStep = 0;
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

  async tick({ accented = true } = {}) {
    const ctx = await this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = accented ? 'square' : 'sine';
    osc.frequency.value = accented ? 1260 : 860;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(accented ? 0.08 : 0.018, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (accented ? 0.05 : 0.035));

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + (accented ? 0.06 : 0.04));
  }

  getStepMs() {
    const beatMs = Math.max(80, Math.round(60000 / this.bpm));
    if (this.mode === 'subdivided') return Math.max(60, Math.round(beatMs / 2));
    return beatMs;
  }

  async step() {
    if (this.mode === 'subdivided') {
      await this.tick({ accented: this.subStep === 0 });
      this.subStep = this.subStep === 0 ? 1 : 0;
      return;
    }

    await this.tick({ accented: true });
  }

  async start() {
    if (!this.enabled || this.bpm <= 0 || this.running) return;
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

    if (!shouldRun) {
      this.stop();
      return;
    }

    if (!this.running) {
      this.start();
    }
  }
}
