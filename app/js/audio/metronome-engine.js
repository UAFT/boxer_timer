import { PHASES } from '../core/constants.js';

export class MetronomeEngine {
  constructor(audioEngine) {
    this.audio = audioEngine;
    this.enabled = false;
    this.bpm = 20;
    this.mode = 'direct';
    this.timeoutId = null;
    this.running = false;
    this.subStep = 0;
    this.suppressUntilMs = 0;
    this.runToken = 0;
    this.lastState = null;
    this.skipStrongOnNextStart = false;
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

  armRoundStartCueSync() {
    this.skipStrongOnNextStart = true;
  }

  suppressFor(ms = 350) {
    this.suppressUntilMs = Math.max(this.suppressUntilMs, Date.now() + Math.max(0, ms));
    this.stop();
  }

  canRun(state = this.lastState) {
    return Boolean(
      state &&
      this.enabled &&
      this.bpm > 0 &&
      !state.isPaused &&
      state.phase === PHASES.WORK &&
      Date.now() >= this.suppressUntilMs
    );
  }

  async playStepKey(key, volume = 1.6) {
    await this.audio.play(key, { tag: 'metronome', volume });
  }

  getBeatMs() {
    return Math.max(80, Math.round(60000 / this.bpm));
  }

  getSubdivisionMs() {
    const beatMs = this.getBeatMs();
    if (this.mode === 'subdivided') return Math.max(40, Math.round(beatMs / 4));
    return beatMs;
  }

  async playDirectBeat() {
    await this.playStepKey('metronome_direct', 1.5);
  }

  async playSubdivisionBeat() {
    await this.playStepKey('metronome_subdivided', 1.35);
  }

  shouldMuteStrongBeat(state = this.lastState) {
    const remainingSec = Number(state?.remainingSec ?? 0);
    const warningSeconds = Number(state?.config?.warningSeconds ?? 0);
    return Boolean(
      this.mode === 'subdivided' &&
      state?.phase === PHASES.WORK &&
      warningSeconds > 0 &&
      remainingSec > 0 &&
      remainingSec <= 3
    );
  }

  scheduleTimeout(token, delay, fn) {
    if (!this.running || token !== this.runToken) return;
    this.timeoutId = window.setTimeout(async () => {
      if (!this.running || token !== this.runToken || !this.canRun()) return;
      await fn();
    }, Math.max(0, delay));
  }

  scheduleBeatCycle(token) {
    if (!this.running || token !== this.runToken || !this.canRun()) return;
    const beatMs = this.getBeatMs();
    this.scheduleTimeout(token, beatMs, async () => {
      await this.playDirectBeat();
      this.scheduleBeatCycle(token);
    });
  }

  async runSubdividedStep(token, stepIndex = 0) {
    if (!this.running || token !== this.runToken || !this.canRun()) return;
    const normalizedStep = ((stepIndex % 4) + 4) % 4;
    const subdivisionMs = this.getSubdivisionMs();

    if (normalizedStep === 0) {
      if (!this.shouldMuteStrongBeat()) {
        await this.playDirectBeat();
      }
    } else {
      await this.playSubdivisionBeat();
    }

    this.scheduleTimeout(token, subdivisionMs, async () => {
      await this.runSubdividedStep(token, normalizedStep + 1);
    });
  }

  async start() {
    if (!this.canRun() || this.running) return;
    const token = ++this.runToken;
    this.running = true;
    this.subStep = 0;
    const skipStrong = this.skipStrongOnNextStart;
    this.skipStrongOnNextStart = false;

    if (this.mode === 'subdivided') {
      if (skipStrong) {
        this.scheduleTimeout(token, this.getSubdivisionMs(), async () => {
          await this.runSubdividedStep(token, 1);
        });
      } else {
        await this.runSubdividedStep(token, 0);
      }
      return;
    }

    if (skipStrong) {
      this.scheduleBeatCycle(token);
      return;
    }

    await this.playDirectBeat();
    if (!this.running || token !== this.runToken || !this.canRun()) return;
    this.scheduleBeatCycle(token);
  }

  stop() {
    this.runToken += 1;
    if (this.timeoutId) {
      window.clearTimeout(this.timeoutId);
      this.timeoutId = null;
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
    this.lastState = state;
    const shouldRun = this.canRun(state);

    if (!shouldRun) {
      this.stop();
      return;
    }

    if (!this.running) {
      void this.start();
    }
  }
}
