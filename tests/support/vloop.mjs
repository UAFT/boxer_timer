// Virtual event loop for the timer engine: fake window timers + Date.now.
// Deterministic; optional per-tick jitter models a busy main thread.
export function installLoop({start = 1_000_000, jitter = () => 0} = {}) {
  const loop = {now: start, timers: new Map(), seq: 0, engineIntervals: new Set(), maxEngineIntervals: 0};
  const realNow = Date.now, realWindow = globalThis.window;
  globalThis.window = {
    setInterval(fn, ms) {
      const id = ++loop.seq;
      loop.timers.set(id, {fn, ms, next: loop.now + ms + jitter(), interval: true});
      loop.engineIntervals.add(id);
      loop.maxEngineIntervals = Math.max(loop.maxEngineIntervals, loop.engineIntervals.size);
      return id;
    },
    clearInterval(id) { loop.timers.delete(id); loop.engineIntervals.delete(id); },
    setTimeout(fn, ms) { const id = ++loop.seq; loop.timers.set(id, {fn, ms, next: loop.now + Math.max(0, ms), interval: false}); return id; },
    clearTimeout(id) { loop.timers.delete(id); }
  };
  Date.now = () => loop.now;
  // Fired timers are virtual, so one macrotask flushes every pending microtask chain.
  loop.drain = () => new Promise(r => setImmediate(r));
  // Runs the earliest timer; returns false when nothing is scheduled.
  loop.step = async (limitTime = Infinity) => {
    let best = null;
    for (const [id, t] of loop.timers) if (!best || t.next < best[1].next || (t.next === best[1].next && id < best[0])) best = [id, t];
    if (!best || best[1].next > limitTime) return false;
    const [id, t] = best;
    loop.beforeFire?.(Math.max(loop.now, t.next));
    loop.now = Math.max(loop.now, t.next);
    if (t.interval) t.next = loop.now + t.ms + jitter(); else loop.timers.delete(id);
    t.fn();
    await loop.drain();
    return true;
  };
  loop.advanceTo = async (time) => { while (await loop.step(time)) {} loop.now = Math.max(loop.now, time); await loop.drain(); };
  loop.after = (ms) => new Promise(resolve => globalThis.window.setTimeout(resolve, ms));
  loop.teardown = () => { Date.now = realNow; globalThis.window = realWindow; };
  return loop;
}
export function mulberry32(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
