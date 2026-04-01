import { PHASES } from '../core/constants.js';

export class MetronomeEngine {
  constructor(audioEngine) {
    this.audio = audioEngine;
    this.enabled = false;
    this.bpm = 20;
    this.mode = 'direct';
    this.intervalId = null;
    this.running = false;
    this.subStep = 0;
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

  async unlock() {
    return this.audio.unlock();
  }

  suppressFor(ms = 350) {
    this.suppressUntilMs = Math.max(this.suppressUntilMs, Date.now() + Math.max(0, ms));
    this.stop();
  }

  async playStepKey(key) {
    await this.audio.play(key, { tag: 'metronome' });
  }

  getStepMs() {
    const beatMs = Math.max(80, Math.round(60000 / this.bpm));
    if (this.mode === 'subdivided') return Math.max(60, Math.round(beatMs / 2));
    return beatMs;
  }

  async step() {
    if (this.mode === 'subdivided') {
      await this.playStepKey(this.subStep === 0 ? 'metronome_direct' : 'metronome_subdivided');
      this.subStep = this.subStep === 0 ? 1 : 0;
      return;
    }

    await this.playStepKey('metronome_direct');
  }

  async start() {
    if (!this.enabled || this.bpm <= 0 || this.running) return;
    if (Date.now() < this.suppressUntilMs) return;
    this.running = true;
    this.subStep = 0;
    await this.step();
    this.intervalId = window.setInterval(() => {
      void this.step();
    }, this.getStepMs());
  }

  stop() {
    if (this.intervalId) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.audio.stopTag('metronome');
    this.running = false;
    this.subStep = 0;
  }

  restart() {
    this.stop();
    void this.start();
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
      void this.start();
    }
  }
}
