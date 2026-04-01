import { PHASES } from '../core/constants.js';
import { clampInt } from '../core/time.js';

const DEFAULT_CONFIG = {
  rounds: 12,
  workSec: 180,
  restSec: 60,
  countdownEnabled: true,
  warningSeconds: 10,
  audioEnabled: true,
  metronomeEnabled: false,
  metronomeBpm: 20,
  metronomeMode: 'direct'
};

function createIdleState(config) {
  return {
    phase: PHASES.IDLE,
    roundIndex: 0,
    totalRounds: config.rounds,
    remainingSec: config.workSec,
    phaseDurationSec: config.workSec,
    nextLabel: 'Следующий этап не запущен',
    countdownText: '',
    progress: 0
  };
}


function effectiveWarningSecondsForPhase(config, phase) {
  if (config?.countdownEnabled === false) return 0;
  if (phase === PHASES.WORK || phase === PHASES.REST) return Math.max(0, Number(config?.warningSeconds ?? 0));
  const value = Number(config?.warningSeconds ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function countdownTextForPhase(phase, remainingSec, warningSeconds) {
  if ((phase === PHASES.WORK || phase === PHASES.REST) && warningSeconds > 0 && remainingSec > 0 && remainingSec <= warningSeconds) {
    return phase === PHASES.WORK
      ? `Предупреждение конца раунда · ${warningSeconds} сек`
      : `Предупреждение конца отдыха · ${warningSeconds} сек`;
  }

  return '';
}

function nextLabelForPhase(phase, remainingSec, warningSeconds) {
  if (phase === PHASES.WORK) {
    if (warningSeconds > 0 && remainingSec > 0 && remainingSec <= warningSeconds) {
      return 'На нуле: старт отдыха';
    }
    return 'Идёт рабочий интервал';
  }

  if (phase === PHASES.REST) {
    if (warningSeconds > 0 && remainingSec > 0 && remainingSec <= warningSeconds) {
      return 'На нуле: старт следующего раунда';
    }
    return 'Идёт отдых';
  }

  return '—';
}

function normalizeWarningSeconds(rawValue) {
  const value = clampInt(rawValue, 0, 10, DEFAULT_CONFIG.warningSeconds);
  return [0, 4, 10].includes(value) ? value : DEFAULT_CONFIG.warningSeconds;
}

export class TimerEngine {
  constructor({ onTick, onStateChange, onEvent } = {}) {
    this.onTick = onTick ?? (() => {});
    this.onStateChange = onStateChange ?? (() => {});
    this.onEvent = onEvent ?? (() => {});
    this.intervalId = null;
    this.tickEndsAt = 0;
    this.isPaused = false;
    this.transitioning = false;
    this.applyConfig(DEFAULT_CONFIG);
  }

  applyConfig(nextConfig) {
    this.config = {
      rounds: clampInt(nextConfig?.rounds, 1, 99, DEFAULT_CONFIG.rounds),
      workSec: clampInt(nextConfig?.workSec, 1, 3600, DEFAULT_CONFIG.workSec),
      restSec: clampInt(nextConfig?.restSec, 0, 3600, DEFAULT_CONFIG.restSec),
      countdownEnabled: nextConfig?.countdownEnabled !== false,
      warningSeconds: normalizeWarningSeconds(nextConfig?.warningSeconds),
      audioEnabled: nextConfig?.audioEnabled !== false,
      metronomeEnabled: Boolean(nextConfig?.metronomeEnabled),
      metronomeBpm: clampInt(nextConfig?.metronomeBpm, 0, 300, DEFAULT_CONFIG.metronomeBpm),
      metronomeMode: nextConfig?.metronomeMode === 'subdivided' ? 'subdivided' : 'direct'
    };
    this.reset();
  }

  reset() {
    this.stopInterval();
    this.isPaused = false;
    this.state = createIdleState(this.config);
    this.emitState();
    this.emitTick();
  }

  start() {
    if (this.state.phase === PHASES.IDLE) {
      void this.beginPrestart(1);
      return;
    }

    if (this.isPaused) {
      this.resume();
    }
  }

  pause() {
    if (this.state.phase === PHASES.IDLE || this.state.phase === PHASES.FINISHED) return;
    if (this.isPaused) return;
    this.isPaused = true;
    this.stopInterval();
    this.emitState();
  }

  resume() {
    if (!this.isPaused) return;
    this.isPaused = false;
    const remainingSec = this.state.remainingSec;
    this.tickEndsAt = Date.now() + remainingSec * 1000;
    this.startInterval();
    this.emitState();
  }

  async beginPrestart(roundIndex) {
    if (!this.config.countdownEnabled) {
      await this.emitEvent({ type: 'round-start-zero', roundIndex });
      this.beginWorkPhase(roundIndex);
      return;
    }

    this.state = {
      phase: PHASES.COUNTDOWN,
      roundIndex,
      totalRounds: this.config.rounds,
      remainingSec: 4,
      phaseDurationSec: 4,
      nextLabel: 'На нуле: старт первого раунда',
      countdownText: 'Предстартовый отсчёт 4-3-2-1',
      progress: 0
    };
    this.tickEndsAt = Date.now() + 4000;
    this.emitState();
    this.emitTick();
    this.onEvent({ type: 'prestart-count-4', roundIndex });
    this.startInterval();
  }

  beginWorkPhase(roundIndex) {
    this.state = {
      phase: PHASES.WORK,
      roundIndex,
      totalRounds: this.config.rounds,
      remainingSec: this.config.workSec,
      phaseDurationSec: Math.max(1, this.config.workSec),
      nextLabel: nextLabelForPhase(PHASES.WORK, this.config.workSec, effectiveWarningSecondsForPhase(this.config, PHASES.WORK)),
      countdownText: countdownTextForPhase(PHASES.WORK, this.config.workSec, effectiveWarningSecondsForPhase(this.config, PHASES.WORK)),
      progress: 0
    };

    this.tickEndsAt = Date.now() + this.config.workSec * 1000;
    this.emitState();
    this.emitTick();
    this.startInterval();
  }

  beginRestPhase(roundIndex) {
    this.state = {
      phase: PHASES.REST,
      roundIndex,
      totalRounds: this.config.rounds,
      remainingSec: this.config.restSec,
      phaseDurationSec: Math.max(1, this.config.restSec),
      nextLabel: nextLabelForPhase(PHASES.REST, this.config.restSec, effectiveWarningSecondsForPhase(this.config, PHASES.REST)),
      countdownText: countdownTextForPhase(PHASES.REST, this.config.restSec, effectiveWarningSecondsForPhase(this.config, PHASES.REST)),
      progress: 0
    };

    this.tickEndsAt = Date.now() + this.config.restSec * 1000;
    this.emitState();
    this.emitTick();
    this.startInterval();
  }

  async finishCurrentPhase() {
    const { phase, roundIndex, totalRounds } = this.state;

    if (phase === PHASES.COUNTDOWN) {
      await this.emitEvent({ type: 'round-start-zero', roundIndex });
      this.beginWorkPhase(roundIndex);
      return;
    }

    if (phase === PHASES.WORK) {
      if (roundIndex >= totalRounds) {
        await this.finishWorkout(roundIndex);
        return;
      }

      await this.emitEvent({ type: 'round-end-zero', roundIndex });

      if (this.config.restSec > 0) {
        this.beginRestPhase(roundIndex);
        return;
      }

      await this.emitEvent({ type: 'round-start-zero', roundIndex: roundIndex + 1 });
      this.beginWorkPhase(roundIndex + 1);
      return;
    }

    if (phase === PHASES.REST) {
      await this.emitEvent({ type: 'rest-end-zero', roundIndex });
      this.beginWorkPhase(roundIndex + 1);
    }
  }

  async finishWorkout(roundIndex) {
    this.stopInterval();
    this.state = {
      phase: PHASES.FINISHED,
      roundIndex,
      totalRounds: this.config.rounds,
      remainingSec: 0,
      phaseDurationSec: 1,
      nextLabel: 'Серия завершена',
      countdownText: '',
      progress: 100
    };
    this.emitState();
    this.emitTick();
    await this.emitEvent({ type: 'workout-end-zero', roundIndex });
  }

  emitEvent(event) {
    try {
      return Promise.resolve(this.onEvent(event));
    } catch {
      return Promise.resolve();
    }
  }

  startInterval() {
    this.stopInterval();
    this.intervalId = window.setInterval(() => this.handleIntervalTick(), 100);
  }

  stopInterval() {
    if (this.intervalId) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  emitCountdownEvent(phase, remainingSec, roundIndex) {
    if (remainingSec < 1 || remainingSec > 4) return;

    if (phase === PHASES.COUNTDOWN) {
      this.onEvent({ type: `prestart-count-${remainingSec}`, roundIndex });
    }
  }

  handleIntervalTick() {
    const now = Date.now();
    const remainingMs = Math.max(0, this.tickEndsAt - now);
    const nextRemainingSec = Math.ceil(remainingMs / 1000);
    const prevRemainingSec = this.state.remainingSec;

    if (nextRemainingSec !== prevRemainingSec) {
      this.state.remainingSec = nextRemainingSec;
      this.state.progress = this.computeProgress();

      if (this.state.phase === PHASES.WORK || this.state.phase === PHASES.REST) {
        const effectiveWarningSeconds = effectiveWarningSecondsForPhase(this.config, this.state.phase);
        this.state.nextLabel = nextLabelForPhase(
          this.state.phase,
          nextRemainingSec,
          effectiveWarningSeconds
        );
        this.state.countdownText = countdownTextForPhase(
          this.state.phase,
          nextRemainingSec,
          effectiveWarningSeconds
        );
      }

      this.emitTick();

      {
        const effectiveWarningSeconds = effectiveWarningSecondsForPhase(this.config, this.state.phase);
        if (
          (this.state.phase === PHASES.WORK || this.state.phase === PHASES.REST) &&
          effectiveWarningSeconds > 0 &&
          nextRemainingSec >= 1 &&
          nextRemainingSec <= effectiveWarningSeconds
        ) {
          this.onEvent({
            type: 'warning-tick',
            roundIndex: this.state.roundIndex,
            phase: this.state.phase,
            remainingSec: nextRemainingSec
          });
        }
      }

      if (this.state.phase === PHASES.COUNTDOWN && nextRemainingSec >= 1 && nextRemainingSec <= 4) {
        this.emitCountdownEvent(this.state.phase, nextRemainingSec, this.state.roundIndex);
      }
    }

    if (remainingMs > 0) {
      return;
    }

    if (this.transitioning) {
      return;
    }

    this.transitioning = true;
    this.stopInterval();
    void this.finishCurrentPhase().finally(() => {
      this.transitioning = false;
    });
  }

  computeProgress() {
    const duration = Math.max(1, this.state.phaseDurationSec);
    const remaining = Math.max(0, this.state.remainingSec);
    return Math.max(0, Math.min(100, ((duration - remaining) / duration) * 100));
  }

  emitState() {
    this.onStateChange({ ...this.state, isPaused: this.isPaused, config: { ...this.config } });
  }

  emitTick() {
    this.onTick({ ...this.state, isPaused: this.isPaused, config: { ...this.config } });
  }
}
