import { PHASES } from '../core/constants.js';
import { clampInt } from '../core/time.js';
import { restSecAfterRound, phaseTwoSecForRound, blockRestSecAfterRound, workSecForRound, totalRoundsForConfig } from '../core/schedule.js';

const DEFAULT_CONFIG = {
  rounds: 12,
  workSec: 180,
  restSec: 60,
  intervalMode: 'standard',
  workStepSec: 0,
  restStepSec: 0,
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
    totalRounds: totalRoundsForConfig(config),
    remainingSec: workSecForRound(config, 1),
    phaseDurationSec: workSecForRound(config, 1),
    nextLabel: 'Следующий этап не запущен',
    countdownText: '',
    progress: 0
  };
}


function effectiveWarningSecondsForPhase(config, phase) {
  if (config?.countdownEnabled === false) return 0;
  if (phase === PHASES.WORK || phase === PHASES.WORK_TWO || phase === PHASES.REST || phase === PHASES.BLOCK_REST) return Math.max(0, Number(config?.warningSeconds ?? 0));
  const value = Number(config?.warningSeconds ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function countdownTextForPhase(phase, remainingSec, warningSeconds) {
  void phase;
  void remainingSec;
  void warningSeconds;
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

  if (phase === PHASES.BLOCK_REST) return 'Отдых между блоками';
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
    this.tickStartedAt = 0;
    this.lastElapsedSec = 0;
    this.isPaused = false;
    this.transitioning = false;
    this.applyConfig(DEFAULT_CONFIG);
  }

  applyConfig(nextConfig) {
    this.config = {
      presetId: nextConfig?.presetId || null,
      rounds: clampInt(nextConfig?.rounds, 1, 99, DEFAULT_CONFIG.rounds),
      programRounds: Array.isArray(nextConfig?.programRounds) ? structuredClone(nextConfig.programRounds) : null,
      workSec: clampInt(nextConfig?.workSec, 1, 3600, DEFAULT_CONFIG.workSec),
      phaseTwoSec: clampInt(nextConfig?.phaseTwoSec, 1, 3600, 40),
      phaseOneName: String(nextConfig?.phaseOneName || '').slice(0,100),
      phaseTwoName: String(nextConfig?.phaseTwoName || '').slice(0,100),
      restSec: clampInt(nextConfig?.restSec, 0, 3600, DEFAULT_CONFIG.restSec),
      blockEnabled: Boolean(nextConfig?.blockEnabled),
      blockCount: clampInt(nextConfig?.blockCount, 1, 99, 1),
      blockRestSec: Math.round(clampInt(nextConfig?.blockRestSec, 0, 3600, 90) / 5) * 5,
      intervalMode: ['standard','ladder','two_phase','count_up'].includes(nextConfig?.intervalMode) ? nextConfig.intervalMode : 'standard',
      ladderEnabled: Boolean(nextConfig?.ladderEnabled) && nextConfig?.intervalMode === 'two_phase',
      phaseTwoStepSec: Math.round(clampInt(nextConfig?.phaseTwoStepSec,-600,600,0)/5)*5,
      workStepSec: Math.round(clampInt(nextConfig?.workStepSec, -600, 600, DEFAULT_CONFIG.workStepSec) / 5) * 5,
      restStepSec: Math.round(clampInt(nextConfig?.restStepSec, -600, 600, DEFAULT_CONFIG.restStepSec) / 5) * 5,
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
    this.lastElapsedSec = 0;
    this.state = createIdleState(this.config);
    this.emitState();
    this.emitTick();
  }

  start() {
    if (this.state.phase === PHASES.IDLE) {
      if (this.isCountUpRound(1)) this.beginCountUpPhase(1);
      else void this.beginPrestart(1);
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
    if (this.state.phase === PHASES.COUNT_UP) this.tickStartedAt = Date.now() - remainingSec * 1000;
    else this.tickEndsAt = Date.now() + remainingSec * 1000;
    this.startInterval();
    this.emitState();
  }

  isCountUpRound(roundIndex) {
    return this.config.programRounds?.length
      ? this.config.programRounds[roundIndex-1]?.intervalMode === 'count_up'
      : this.config.intervalMode === 'count_up';
  }

  beginCountUpPhase(roundIndex) {
    this.stopInterval();
    this.isPaused=false;
    this.tickStartedAt=Date.now();
    this.state={phase:PHASES.COUNT_UP,roundIndex,totalRounds:totalRoundsForConfig(this.config),
      remainingSec:0,phaseDurationSec:1,nextLabel:'Прямой отсчёт',countdownText:'',progress:0};
    this.emitState();this.emitTick();this.startInterval();
  }

  // Manual completion is the sole way to advance an unbounded stage.
  async finishStage() {
    if (this.state.phase !== PHASES.COUNT_UP || this.transitioning) return false;
    this.transitioning=true;
    this.stopInterval();
    this.isPaused=false;
    this.lastElapsedSec=this.state.remainingSec;
    const index=this.state.roundIndex;
    if(this.config.programRounds?.[index-1]?.intervalMode==='count_up')this.config.programRounds[index-1].actualElapsedSec=this.lastElapsedSec;
    this.state.phase=PHASES.WORK;
    try { await this.finishCurrentPhase(); }
    finally { this.transitioning=false; }
    return {roundIndex:index,elapsedSec:this.lastElapsedSec};
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
      totalRounds: totalRoundsForConfig(this.config),
      remainingSec: 4,
      phaseDurationSec: 4,
      nextLabel: 'На нуле: старт первого раунда',
      countdownText: '',
      progress: 0
    };
    this.tickEndsAt = Date.now() + 4000;
    this.emitState();
    this.emitTick();
    this.onEvent({ type: 'prestart-count-4', roundIndex });
    this.startInterval();
  }

  beginWorkPhase(roundIndex) {
    if (this.isCountUpRound(roundIndex)) { this.beginCountUpPhase(roundIndex); return; }
    this.state = {
      phase: PHASES.WORK,
      roundIndex,
      totalRounds: totalRoundsForConfig(this.config),
      remainingSec: workSecForRound(this.config, roundIndex),
      phaseDurationSec: Math.max(1, workSecForRound(this.config, roundIndex)),
      nextLabel: nextLabelForPhase(PHASES.WORK, workSecForRound(this.config, roundIndex), effectiveWarningSecondsForPhase(this.config, PHASES.WORK)),
      countdownText: countdownTextForPhase(PHASES.WORK, workSecForRound(this.config, roundIndex), effectiveWarningSecondsForPhase(this.config, PHASES.WORK)),
      progress: 0
    };

    this.tickEndsAt = Date.now() + workSecForRound(this.config, roundIndex) * 1000;
    this.emitState();
    this.emitTick();
    this.startInterval();
  }

  beginWorkTwoPhase(roundIndex) {
    const sec=phaseTwoSecForRound(this.config,roundIndex);
    this.state={phase:PHASES.WORK_TWO,roundIndex,totalRounds:totalRoundsForConfig(this.config),
      remainingSec:sec,phaseDurationSec:Math.max(1,sec),nextLabel:'Идёт фаза 2',countdownText:'',progress:0};
    this.tickEndsAt=Date.now()+sec*1000;
    this.emitState();this.emitTick();this.startInterval();
  }

  beginBlockRestPhase(roundIndex) {
    const sec=blockRestSecAfterRound(this.config,roundIndex);
    this.state={
      phase:PHASES.BLOCK_REST,
      roundIndex,
      totalRounds:totalRoundsForConfig(this.config),
      remainingSec:sec,
      phaseDurationSec:Math.max(1,sec),
      nextLabel:'Отдых между блоками',
      countdownText:'',progress:0
    };
    this.tickEndsAt=Date.now()+sec*1000;
    this.emitState();this.emitTick();this.startInterval();
  }

  beginRestPhase(roundIndex) {
    this.state = {
      phase: PHASES.REST,
      roundIndex,
      totalRounds: totalRoundsForConfig(this.config),
      remainingSec: restSecAfterRound(this.config, roundIndex),
      phaseDurationSec: Math.max(1, restSecAfterRound(this.config, roundIndex)),
      nextLabel: nextLabelForPhase(PHASES.REST, restSecAfterRound(this.config, roundIndex), effectiveWarningSecondsForPhase(this.config, PHASES.REST)),
      countdownText: countdownTextForPhase(PHASES.REST, restSecAfterRound(this.config, roundIndex), effectiveWarningSecondsForPhase(this.config, PHASES.REST)),
      progress: 0
    };

    this.tickEndsAt = Date.now() + restSecAfterRound(this.config, roundIndex) * 1000;
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

    if (phase === PHASES.WORK && phaseTwoSecForRound(this.config,roundIndex)>0) {
      await this.emitEvent({type:'phase-two-start-zero',roundIndex});
      this.beginWorkTwoPhase(roundIndex);
      return;
    }

    if (phase === PHASES.WORK || phase === PHASES.WORK_TWO) {
      if (roundIndex >= totalRounds) {
        await this.finishWorkout(roundIndex);
        return;
      }

      const hasRoundRest=restSecAfterRound(this.config,roundIndex)>0;
      const hasBlockRest=blockRestSecAfterRound(this.config,roundIndex)>0;
      if (hasRoundRest) {
        await this.emitEvent({type:'round-end-zero',roundIndex});
        this.beginRestPhase(roundIndex);
        return;
      }
      if (hasBlockRest) {
        await this.emitEvent({type:'block-rest-start-zero',roundIndex});
        this.beginBlockRestPhase(roundIndex);
        return;
      }
      await this.emitEvent({type:'round-start-zero',roundIndex:roundIndex+1});
      this.beginWorkPhase(roundIndex + 1);
      return;
    }

    if (phase === PHASES.REST) {
      if (blockRestSecAfterRound(this.config,roundIndex)>0) {
        await this.emitEvent({type:'block-rest-start-zero',roundIndex});
        this.beginBlockRestPhase(roundIndex);
      } else {
        await this.emitEvent({type:'rest-end-zero',roundIndex});
        this.beginWorkPhase(roundIndex+1);
      }
      return;
    }
    if (phase === PHASES.BLOCK_REST) {
      await this.emitEvent({type:'block-rest-end-zero',roundIndex});
      this.beginWorkPhase(roundIndex+1);
    }
  }

  async finishWorkout(roundIndex) {
    this.stopInterval();
    this.state = {
      phase: PHASES.FINISHED,
      roundIndex,
      totalRounds: totalRoundsForConfig(this.config),
      remainingSec: this.isCountUpRound(roundIndex) ? this.lastElapsedSec : 0,
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
    if (this.state.phase === PHASES.COUNT_UP) {
      if (this.isPaused) return;
      const elapsed=Math.max(0,Math.floor((now-this.tickStartedAt)/1000));
      if (elapsed!==this.state.remainingSec) {this.state.remainingSec=elapsed;this.emitTick();}
      return;
    }
    const remainingMs = Math.max(0, this.tickEndsAt - now);
    const nextRemainingSec = Math.ceil(remainingMs / 1000);
    const prevRemainingSec = this.state.remainingSec;

    if (nextRemainingSec !== prevRemainingSec) {
      this.state.remainingSec = nextRemainingSec;
      this.state.progress = this.computeProgress();

      if (this.state.phase === PHASES.WORK || this.state.phase === PHASES.REST || this.state.phase === PHASES.BLOCK_REST) {
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
          (this.state.phase === PHASES.WORK || this.state.phase === PHASES.REST || this.state.phase === PHASES.BLOCK_REST) &&
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
