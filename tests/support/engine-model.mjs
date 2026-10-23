// Differential model (from audit R2): what the timer DOES on a virtual clock vs what
// the user is SHOWN (plan rows, totals, remaining) vs the schedule functions.
import {installLoop} from './vloop.mjs';
import {TimerEngine} from '../../app/js/timer/timer-engine.js';
import * as S from '../../app/js/core/schedule.js';
import {buildLadderPlanRows} from '../../app/js/ui/ladder-plan-rows.js';

export async function runWorkout(cfg, {countUpSec = () => 7.3, cueDelay = 0, jitter} = {}) {
  const loop = installLoop({jitter});
  const timeline = [], cues = [], ticks = [];
  let engine, started = false;
  try {
    engine = new TimerEngine({
      onStateChange: s => { if (!started) return; const last = timeline.at(-1); if (!last || last.phase !== s.phase || last.round !== s.roundIndex) timeline.push({phase: s.phase, round: s.roundIndex, t: loop.now}); },
      onTick: s => { if (!started || s.phase === 'idle') return; ticks.push({t: loop.now, phase: s.phase, round: s.roundIndex, rem: s.remainingSec, remTotal: S.remainingTotalSecForState(s)}); },
      onEvent: ev => { cues.push({type: ev.type, round: ev.roundIndex, rem: ev.remainingSec, t: loop.now}); return cueDelay ? loop.after(cueDelay) : undefined; }
    });
    engine.applyConfig(cfg);
    const t0 = loop.now;
    started = true;
    engine.start();
    let guard = 0;
    while (engine.state.phase !== 'finished') {
      if (++guard > 5_000_000) throw new Error('runaway');
      if (engine.state.phase === 'count_up' && !engine.transitioning) {
        await loop.advanceTo(loop.now + Math.round(countUpSec() * 1000));
        void engine.finishStage();
        await loop.drain();
        continue;
      }
      if (!await loop.step()) throw new Error('stalled in ' + engine.state.phase);
    }
    await loop.drain();
    return {t0, timeline, cues, ticks, config: engine.config, maxIntervals: loop.maxEngineIntervals};
  } finally { engine?.stopInterval(); loop.teardown(); }
}

const isCountUp = (cfg, r) => cfg.programRounds?.length ? cfg.programRounds[r - 1]?.intervalMode === 'count_up' : cfg.intervalMode === 'count_up';
export function expectedPhases(cfg) {
  const R = S.totalRoundsForConfig(cfg), out = [{phase: 'countdown', round: 1, d: 4}];
  for (let r = 1; r <= R; r++) {
    if (isCountUp(cfg, r)) out.push({phase: 'count_up', round: r, d: null});
    else {
      out.push({phase: 'work', round: r, d: S.workSecForRound(cfg, r)});
      const p2 = S.phaseTwoSecForRound(cfg, r);
      if (p2 > 0) out.push({phase: 'work_two', round: r, d: p2});
    }
    if (r < R) {
      const rest = S.restSecAfterRound(cfg, r), br = S.blockRestSecAfterRound(cfg, r);
      if (rest > 0) out.push({phase: 'rest', round: r, d: rest});
      if (br > 0) out.push({phase: 'block_rest', round: r, d: br});
    }
  }
  out.push({phase: 'finished', round: R, d: 0});
  return out;
}
function zeroCue(a, b) {
  if (b.phase === 'finished') return {type: 'workout-end-zero', round: a.round};
  if (a.phase === 'countdown') return {type: 'round-start-zero', round: 1};
  if (a.phase === 'work' && b.phase === 'work_two') return {type: 'phase-two-start-zero', round: a.round};
  if (['work', 'work_two', 'count_up'].includes(a.phase)) {
    if (b.phase === 'rest') return {type: 'round-end-zero', round: a.round};
    if (b.phase === 'block_rest') return {type: 'block-rest-start-zero', round: a.round};
    return {type: 'round-start-zero', round: a.round + 1};
  }
  if (a.phase === 'rest') return b.phase === 'block_rest' ? {type: 'block-rest-start-zero', round: a.round} : {type: 'rest-end-zero', round: a.round};
  if (a.phase === 'block_rest') return {type: 'block-rest-end-zero', round: a.round};
  return {type: '?', round: a.round};
}
// The expanded workout plan, parsed back into phases.
const mmss = s => { const [m, x] = s.split(':').map(Number); return m * 60 + x; };
export function planPhases(cfg) {
  const html = buildLadderPlanRows(cfg), out = [];
  for (const token of html.split(/(?=<div class="ladder-live-row|<div class="ladder-rest-row)/)) {
    const rest = /^<div class="ladder-rest-row" data-after-round="(\d+)"><span>[^<]*<\/span><strong class="ladder-rest-duration">(\d+:\d\d)<\/strong>/.exec(token);
    if (rest) { out.push({phase: 'block_rest', round: +rest[1], d: mmss(rest[2])}); continue; }
    const m = /^<div class="ladder-live-row( ft-afap-row| ft-two-phase-plan)?" data-round="(\d+)">/.exec(token);
    if (!m) continue;
    const round = +m[2];
    if (m[1] === ' ft-afap-row') {
      out.push({phase: 'count_up', round, d: null});
      const after = /прямой отсчёт(?: · \d+:\d\d)? · отдых (\d+:\d\d)/.exec(token);
      if (after) out.push({phase: 'rest', round, d: mmss(after[1])});
      continue;
    }
    if (m[1] === ' ft-two-phase-plan') {
      const t = [...token.matchAll(/<strong>(\d+:\d\d|—)<\/strong>/g)].map(x => x[1]);
      out.push({phase: 'work', round, d: mmss(t[0])}, {phase: 'work_two', round, d: mmss(t[1])});
      if (t[2] && t[2] !== '—' && mmss(t[2]) > 0) out.push({phase: 'rest', round, d: mmss(t[2])});
      continue;
    }
    const w = /работа (\d+:\d\d) · отдых (\d+:\d\d|—)/.exec(token);
    out.push({phase: 'work', round, d: mmss(w[1])});
    if (w[2] !== '—' && mmss(w[2]) > 0) out.push({phase: 'rest', round, d: mmss(w[2])});
  }
  return out;
}
// Phases, durations, plan rows, every cue with its exact time, "Всего" and "Осталось".
export function check(name, run, problems) {
  const exp = expectedPhases(run.config);
  const obs = run.timeline.map((p, i) => ({...p, d: i + 1 < run.timeline.length ? (run.timeline[i + 1].t - p.t) / 1000 : 0}));
  const fail = msg => problems.push(name + ': ' + msg);
  if (run.maxIntervals > 1) fail('more than one engine interval active: ' + run.maxIntervals);
  if (obs.length !== exp.length) fail(`phase count ${obs.length} != expected ${exp.length}`);
  for (let i = 0; i < Math.min(obs.length, exp.length); i++) {
    const o = obs[i], e = exp[i];
    if (o.phase !== e.phase || o.round !== e.round) { fail(`#${i} phase ${o.phase}/${o.round} != ${e.phase}/${e.round}`); break; }
    if (e.d !== null && e.phase !== 'finished' && Math.abs(o.d - e.d) > 1e-9) fail(`#${i} ${e.phase}/${e.round} lasted ${o.d}s != ${e.d}s`);
  }
  const plan = planPhases(run.config).filter(p => p.d === null || p.d > 0);
  const core = exp.slice(1, -1);
  const planKey = p => p.phase + '/' + p.round + '/' + p.d;
  const planSeq = plan.map(planKey).join(' '), coreSeq = core.map(planKey).join(' ');
  if (planSeq !== coreSeq) fail('PLAN != ENGINE\n   plan: ' + planSeq.slice(0, 300) + '\n engine: ' + coreSeq.slice(0, 300));
  const expCues = [];
  const w = run.config.countdownEnabled === false ? 0 : run.config.warningSeconds;
  for (let i = 0; i < obs.length - 1 && i < exp.length - 1; i++) {
    const a = obs[i], start = (a.t - run.t0) / 1000, end = start + a.d;
    if (a.phase === 'countdown') for (const k of [4, 3, 2, 1]) expCues.push({type: 'prestart-count-' + k, round: 1, t: start + 4 - k});
    if (['work', 'work_two', 'rest', 'block_rest'].includes(a.phase) && w > 0) for (let k = Math.min(w, a.d - 1); k >= 1; k--) expCues.push({type: 'warning-tick', round: a.round, t: end - k, rem: k});
    expCues.push({...zeroCue(a, obs[i + 1]), t: end});
  }
  const obsCues = run.cues.map(c => ({type: c.type, round: c.round, t: (c.t - run.t0) / 1000, ...(c.rem !== undefined ? {rem: c.rem} : {})}));
  const key = c => `${c.type}@${c.round}@${(+c.t).toFixed(3)}${c.rem !== undefined ? '#' + c.rem : ''}`;
  const A = obsCues.map(key), B = expCues.map(key);
  if (A.join(' ') !== B.join(' ')) {
    let i = 0; while (A[i] === B[i]) i++;
    fail(`cues diverge at #${i}: got ${A.slice(i, i + 3).join(' ')} | expected ${B.slice(i, i + 3).join(' ')}`);
  }
  if (!exp.some(p => p.phase === 'count_up')) {
    const total = core.reduce((s, p) => s + p.d, 0);
    if (S.totalDurationSecForConfig(run.config) !== total) fail(`Всего ${S.totalDurationSecForConfig(run.config)} != engine ${total}`);
    const endT = obs.at(-1).t;
    const bad = run.ticks.filter(k => k.phase !== 'countdown' && k.phase !== 'finished' && k.remTotal !== Math.ceil((endT - k.t) / 1000 - 1e-9));
    if (bad.length) fail(`Осталось wrong on ${bad.length} ticks, e.g. ${JSON.stringify(bad[0])}`);
  }
}
