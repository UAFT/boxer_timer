import { AUDIO_FILE_MAP } from './catalog.js';

// Sound is best effort: the clock and the buttons never wait on a stuck AudioContext.
const RESUME_WAIT_MS = 800;
const PRELOAD_WAIT_MS = 1500;
// A cue that could not start this soon is dropped: a late bell misleads more than a missing one.
const STALE_CUE_MS = 1000;

// The promise's value, or null once ms have passed; never rejects.
function within(promise, ms) {
  let timer;
  const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve(null), ms); });
  return Promise.race([Promise.resolve(promise).catch(() => null), timeout]).finally(() => clearTimeout(timer));
}

function createSilentBuffer(context) {
  const buffer = context.createBuffer(1, 1, context.sampleRate);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  return source;
}

export class AudioEngine {
  constructor() {
    this.enabled = true;
    this.context = null;
    this.masterGain = null;
    this.bufferCache = new Map();
    this.pendingLoads = new Map();
    this.missing = new Set();
    this.unlocked = false;
    this.activeNodes = new Set();
  }

  setEnabled(nextValue) {
    this.enabled = Boolean(nextValue);
  }

  getMissingAudioKeys() {
    return [...this.missing.values()];
  }

  ensureContext() {
    if (this.context?.state === 'closed') this.context = null;
    if (this.context) return this.context;
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return null;
    this.context = new AudioContextCtor();
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = 1;
    this.masterGain.connect(this.context.destination);
    return this.context;
  }

  async resumeContext() {
    const context = this.ensureContext();
    if (!context) return null;
    if (context.state !== 'running') await within(context.resume(), RESUME_WAIT_MS);
    return context;
  }

  // Back on screen: get the output running before the next cue needs it.
  wake() {
    if (this.context && this.context.state !== 'running') void this.resumeContext();
  }

  async preloadAll() {
    const keys = Object.keys(AUDIO_FILE_MAP);
    await Promise.allSettled(keys.map((key) => this.preload(key)));
  }

  async preload(key) {
    const src = AUDIO_FILE_MAP[key];
    if (!src) return null;
    if (this.bufferCache.has(key)) return this.bufferCache.get(key);
    if (this.pendingLoads.has(key)) return this.pendingLoads.get(key);

    const loader = (async () => {
      const context = this.ensureContext();
      if (!context) return null;
      try {
        const response = await fetch(src);
        if (!response.ok) {
          this.missing.add(key);
          return null;
        }
        const arrayBuffer = await response.arrayBuffer();
        const decoded = await context.decodeAudioData(arrayBuffer.slice(0));
        this.bufferCache.set(key, decoded);
        return decoded;
      } catch {
        this.missing.add(key);
        return null;
      } finally {
        this.pendingLoads.delete(key);
      }
    })();

    this.pendingLoads.set(key, loader);
    return loader;
  }

  async unlock() {
    const context = await this.resumeContext();
    if (!context) return false;

    try {
      const silent = createSilentBuffer(context);
      silent.start(0);
    } catch {
      // no-op
    }

    this.unlocked = true;
    await within(this.preloadAll(), PRELOAD_WAIT_MS);
    return true;
  }

  stopAll() {
    for (const meta of [...this.activeNodes]) {
      this.stopMeta(meta);
    }
  }

  stopTag(tag) {
    if (!tag) return;
    for (const meta of [...this.activeNodes]) {
      if (meta.tag === tag) this.stopMeta(meta);
    }
  }

  stopMeta(meta) {
    if (!meta) return;
    try {
      meta.source.onended = null;
      meta.source.stop(0);
    } catch {
      // no-op
    }
    try {
      meta.source.disconnect();
    } catch {
      // no-op
    }
    try {
      meta.gain.disconnect();
    } catch {
      // no-op
    }
    this.activeNodes.delete(meta);
  }

  async play(key, { tag = 'cue', volume = 1 } = {}) {
    if (!this.enabled) return false;
    const requestedAt = Date.now();
    const context = await this.resumeContext();
    if (!context) return false;

    const buffer = await within(this.preload(key), STALE_CUE_MS);
    if (!buffer || !this.masterGain) return false;
    if (context.state !== 'running' || Date.now() - requestedAt > STALE_CUE_MS) return false;

    try {
      const source = context.createBufferSource();
      const gain = context.createGain();
      gain.gain.value = Number.isFinite(volume) ? volume : 1;
      source.buffer = buffer;
      source.connect(gain);
      gain.connect(this.masterGain);
      const meta = { source, gain, tag };
      source.onended = () => {
        this.activeNodes.delete(meta);
        try { source.disconnect(); } catch {}
        try { gain.disconnect(); } catch {}
      };
      this.activeNodes.add(meta);
      source.start(0);
      return true;
    } catch {
      return false;
    }
  }
}
